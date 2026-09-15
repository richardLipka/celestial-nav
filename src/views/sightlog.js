// The log book. Nothing in the application knows the ship's position except
// the simulation itself -- everything the navigator learns has to come through
// this table.

import { fmtAngle, fmtBearing, fmtNumber } from '../core/angles.js';
import { fmtClock } from '../core/time.js';
import { t } from '../i18n.js';

const h = (tag, cls, txt) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (txt !== undefined) n.textContent = txt;
  return n;
};

const btn = (cls, label, title, onClick) => {
  const b = h('button', cls, label);
  b.type = 'button';
  if (title) b.title = title;
  b.addEventListener('click', onClick);
  return b;
};

export function createSightLog(actions) {
  const node = h('div', 'log');

  const bar = h('div', 'log-bar');
  const take = btn('log-take', t('log.take'), null, actions.add);
  const clear = btn('log-clear', t('log.clear'), null, actions.clear);
  const count = h('span', 'log-count');
  bar.append(take, clear, count);

  const hint = h('p', 'log-hint');
  const wrap = h('div', 'log-table-wrap');
  const table = h('table', 'log-table');
  wrap.append(table);

  node.append(bar, hint, wrap);

  return {
    node,
    update(d, s) {
      const obs = d.observations;
      const r = d.logResult;

      take.disabled = d.sky.H <= 0;
      take.textContent = d.sky.H <= 0 ? t('log.sunDown') : t('log.take');
      clear.disabled = obs.length === 0;
      count.textContent = obs.length ? t('log.count', { n: obs.length }) : '';

      hint.textContent = hintFor(r, d);
      hint.className =
        `log-hint ${r.stage === 'full' && r.equalAlt.pair.observed ? 'done' : ''}`;

      table.replaceChildren();
      if (!obs.length) {
        table.append(h('caption', 'log-empty', t('log.empty')));
        return;
      }

      const head = h('tr');
      for (const k of ['log.no', 'log.chrono', 'log.hs', 'log.ho', 'log.bearing']) {
        head.append(h('th', null, t(k)));
      }
      head.append(h('th', null, '')); // the actions column wants no heading
      const thead = h('thead');
      thead.append(head);
      table.append(thead);

      const body = h('tbody');
      const sorted = [...obs].sort((a, b) => a.tChrono - b.tChrono);
      const peakId = r.max ? r.max.id : null;
      const pair = r.equalAlt ? r.equalAlt.pair : null;

      for (const e of sorted) {
        const tr = h('tr', [
          e.below ? 'below' : '',
          e.id === peakId ? 'peak' : '',
          pair && pair.am.id === e.id ? 'paired' : '',
        ].filter(Boolean).join(' '));

        tr.append(
          h('td', 'num', String(sorted.indexOf(e) + 1)),
          h('td', 'mono', fmtClock(e.tChrono)),
          h('td', 'mono', e.below ? '—' : fmtAngle(e.Hs)),
          h('td', 'mono', e.below ? '—' : fmtAngle(e.Ho)),
          h('td', 'mono', e.below ? '—' : fmtBearing(e.Az)),
        );

        const acts = h('td', 'log-acts');
        // Only a rising sight can be watched back down again.
        if (!e.below && e.Az < 180) {
          acts.append(btn('log-mini', t('log.match'), t('log.matchTip'), () => actions.match(e)));
        }
        acts.append(btn('log-mini del', '×', t('log.remove'), () => actions.remove(e.id)));
        tr.append(acts);
        body.append(tr);
      }
      table.append(body);
    },
  };
}

function hintFor(r, d) {
  if (r.stage === 'none') return t('log.hint.start');
  if (!r.bracketed) return t('log.hint.bracket');
  if (!r.equalAlt) return t('log.hint.equal');
  const p = r.equalAlt.pair;
  const vars = { span: fmtNumber(p.spanHours, 1), ho: fmtAngle(p.Ho) };
  return p.observed ? t('log.hint.done', vars) : t('log.hint.interp', vars);
}

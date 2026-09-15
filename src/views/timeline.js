// The day scrubber and the sensitivity gauge, which belong together: the
// gauge only means anything as you move through the day, and what it shows is
// the whole argument of the application swinging from one pole to the other.

import { el, text, clear, arc, onCircle } from '../svg.js';
import { fmtBearing, fmtNumber } from '../core/angles.js';
import { NM_PER_CLOCK_SECOND } from '../core/horizon.js';
import { fmtClock, fmtHours } from '../core/time.js';
import { t } from '../i18n.js';

const h = (tag, cls, txt) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (txt !== undefined) n.textContent = txt;
  return n;
};

const DAY = 86400;

export function createTimeline(onScrub, onNoon) {
  const node = h('div', 'timeline');

  const head = h('div', 'tl-head');
  const title = h('span', 'tl-title', t('tl.title'));
  const noonBtn = h('button', 'tl-noon');
  noonBtn.type = 'button';
  noonBtn.textContent = t('tl.goNoon');
  noonBtn.addEventListener('click', onNoon);
  const clocks = h('div', 'tl-clocks');
  head.append(title, noonBtn, clocks);

  const wrap = h('div', 'tl-track');
  const marks = h('div', 'tl-marks');
  const input = document.createElement('input');
  input.type = 'range';
  input.id = 'day-scrub';
  input.min = '0';
  input.max = String(DAY - 1);
  input.step = '30';
  input.setAttribute('aria-label', t('tl.dayLabel'));
  input.addEventListener('input', () => onScrub(Number(input.value)));
  wrap.append(marks, input);

  const ticks = h('div', 'tl-ticks');
  for (const hh of ['00', '06', '12', '18', '24']) ticks.append(h('span', null, hh));

  const gauge = el('svg', {
    viewBox: '0 0 210 120',
    class: 'gauge',
    role: 'img',
    'aria-label': t('gauge.aria'),
  });

  const left = h('div', 'tl-left');
  left.append(head, wrap, ticks);
  const right = h('div', 'tl-right');
  right.append(gauge);
  node.append(left, right);

  return {
    node,
    update(d, s) {
      const sec = Math.round((d.now - s.date) / 1000);
      if (document.activeElement !== input) input.value = String(sec);

      clocks.replaceChildren();
      const items = [
        [t('tl.utc'), fmtClock(d.now), ''],
        [t('tl.chrono'), fmtClock(d.clockReads), d.clockErrorSec ? 'bad' : ''],
        [t('tl.apparent'), fmtHours(d.apparentTime), ''],
      ];
      for (const [k, v, cls] of items) {
        const c = h('span', `tl-clock ${cls}`);
        c.append(h('em', null, k), h('b', null, v));
        clocks.append(c);
      }

      marks.replaceChildren();
      const at = (date, cls, label) => {
        if (!date) return;
        const pct = (((date - s.date) / 1000) / DAY) * 100;
        if (pct < 0 || pct > 100) return;
        const m = h('span', `tl-mark ${cls}`);
        m.style.left = `${pct}%`;
        m.title = label;
        marks.append(m);
      };
      at(d.events.rise, 'rise', t('tl.sunrise'));
      at(d.events.set, 'set', t('tl.sunset'));
      at(d.lan, 'noon', t('tl.noon'));

      drawGauge(gauge, d, s);
    },
  };
}

function drawGauge(svg, d, s) {
  clear(svg);
  const CX = 105;
  const CY = 82;
  const R = 62;

  const v = Math.abs(d.sens); // |cos(lat) * sin(Az)|, from 0 to 1
  const nmPerSec = NM_PER_CLOCK_SECOND * v;

  svg.append(arc(CX, CY, R, 180, 0, { class: 'gauge-track' }));
  svg.append(arc(CX, CY, R, 180, 180 - 180 * v, { class: 'gauge-fill' }));

  for (const f of [0, 0.5, 1]) {
    const a = 180 - 180 * f;
    const [x1, y1] = onCircle(CX, CY, R - 6, a);
    const [x2, y2] = onCircle(CX, CY, R + 6, a);
    svg.append(el('line', { x1, y1, x2, y2, class: 'gauge-tick' }));
  }

  const [nx, ny] = onCircle(CX, CY, R - 12, 180 - 180 * v);
  svg.append(el('line', { x1: CX, y1: CY, x2: nx, y2: ny, class: 'gauge-needle' }));
  svg.append(el('circle', { cx: CX, cy: CY, r: 3.4, class: 'gauge-hub' }));

  svg.append(text(CX, 20, t('gauge.title'), { class: 'tiny lbl', 'text-anchor': 'middle' }));
  svg.append(text(6, CY + 12, t('gauge.meridian'), { class: 'tiny lbl muted' }));
  svg.append(text(204, CY + 12, t('gauge.primeVertical'), { class: 'tiny lbl muted', 'text-anchor': 'end' }));

  svg.append(
    text(CX, CY - 20, fmtNumber(v < 0.005 ? 0 : v, 2), {
      class: 'mn lbl gauge-value', 'text-anchor': 'middle',
    }),
  );
  // Inside the arc, beneath the value: below the hub it collided with the note.
  svg.append(
    text(CX, CY - 6, `Az ${fmtBearing(d.sky.Az)}`, {
      class: 'tiny lbl muted', 'text-anchor': 'middle',
    }),
  );
  // And the note gets a line of its own, clear of the two end labels -- it is
  // a whole sentence and it ran straight through "prime vertical".
  svg.append(
    text(CX, 114, describe(nmPerSec, d.sky.H), {
      class: 'tiny lbl gauge-note', 'text-anchor': 'middle',
    }),
  );
}

function describe(nmPerSec, H) {
  if (H < 0) return t('gauge.down');
  if (nmPerSec < 0.001) return t('gauge.free');
  const secPerNm = 1 / nmPerSec;
  if (secPerNm > 600) return t('gauge.over10');
  return t('gauge.perNm', {
    s: secPerNm < 10 ? fmtNumber(secPerNm, 1) : Math.round(secPerNm),
  });
}

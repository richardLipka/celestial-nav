// The work-up: the two reductions side by side, worked from the navigator's
// own log and nothing else. This is the payoff panel, so it is deliberately
// the densest one -- the whole argument is in the two columns and the bars.

import { fmtAngle, fmtMin, fmtNm, fmtNumber } from '../core/angles.js';
import { fmtClock } from '../core/time.js';
import { correctionRows } from '../core/corrections.js';
import { t } from '../i18n.js';
import { fLat, fLon, fClockError } from '../ui/format.js';

const h = (tag, cls, txt) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (txt !== undefined) n.textContent = txt;
  return n;
};

function column(title, tag, rows, result, resultClass) {
  const col = h('div', 'wu-col');
  const head = h('div', 'wu-head');
  head.append(h('h4', null, title), h('span', 'wu-needs', tag));
  col.append(head);

  const dl = h('dl', 'wu-rows');
  for (const [k, v, cls] of rows) {
    dl.append(h('dt', cls || null, k), h('dd', cls || null, v));
  }
  col.append(dl);

  const out = h('div', `wu-result ${resultClass}`);
  out.append(h('span', 'wu-result-k', result[0]), h('span', 'wu-result-v', result[1]));
  col.append(out);
  return col;
}

export function createWorkup() {
  const node = h('div', 'workup');
  return { node, update: (d, s) => draw(node, d, s) };
}

function draw(node, d, s) {
  node.replaceChildren();
  const r = d.logResult;

  if (r.stage === 'none') {
    node.append(h('p', 'wu-warn', t('wu.needLog')));
    return;
  }

  const peakSight = r.max;
  const corr = correctionRows({ terms: peakSight.terms });

  if (peakSight.Ho < 0) node.append(h('p', 'wu-warn severe', t('wu.noSight')));
  else if (peakSight.Ho < 5) {
    node.append(h('p', 'wu-warn', t('wu.lowSight', { h: fmtAngle(peakSight.Ho) })));
  }

  // --- latitude: from the meridian altitude -------------------------------
  const latRows = [
    [t('wu.hs'), fmtAngle(peakSight.Hs)],
    ...corr.map((c) => [t(`corr.${c.key}`), fmtMin(c.value), 'sub']),
    [t('wu.ho'), fmtAngle(peakSight.Ho)],
  ];
  if (r.peak.fitted) latRows.push([t('wu.fitted'), fmtAngle(r.peak.Ho), 'fit']);
  latRows.push(
    [t('wu.z'), fmtAngle(r.z)],
    [t('wu.dec'), `${fmtAngle(Math.abs(r.dec))} ${t(r.dec < 0 ? 'suffix.S' : 'suffix.N')}`],
  );

  // --- longitude: from the moment of noon ---------------------------------
  const lonRows = [];
  if (r.equalAlt) {
    const p = r.equalAlt.pair;
    const c = r.equalAlt.correctionSec;
    lonRows.push(
      [t('wu.pairAt'), fmtAngle(p.Ho), 'sub'],
      [t('wu.amAt'), fmtClock(p.am.tChrono)],
      [
        t('wu.pmAt'),
        p.observed ? fmtClock(p.pmTime) : `${fmtClock(p.pmTime)}  ${t('wu.pmInterp')}`,
        p.observed ? '' : 'bad',
      ],
      [t('wu.midpoint'), fmtClock(r.equalAlt.midpoint)],
      [t('wu.eqAltCorr'), `${c >= 0 ? '−' : '+'}${fmtNumber(Math.abs(c), 1)} s`, 'sub'],
      [t('wu.lanFound'), fmtClock(r.equalAlt.lanChrono), 'strong'],
    );
  } else {
    lonRows.push([t('wu.peakAt'), fmtClock(new Date(r.peak.tMs)), 'bad']);
  }
  lonRows.push(
    [
      t('wu.eot'),
      s.useEoT
        ? `${r.eotMin >= 0 ? '+' : '−'}${fmtNumber(Math.abs(r.eotMin), 1)} ${t('unit.min')}`
        : t('wu.ignored'),
      s.useEoT ? '' : 'bad',
    ],
    [t('wu.clockError'), fClockError(Math.round(d.clockErrorSec)), d.clockErrorSec ? 'bad' : 'sub'],
    [t('wu.times15'), '', 'sub'],
  );

  const bad = (v) => (v !== null && Math.abs(v) > 3 ? 'bad' : 'good');
  const grid = h('div', 'wu-grid');
  grid.append(
    column(t('wu.latitude'), t('wu.needsDate'), latRows, ['φ', fLat(r.lat)],
      bad(d.logError && d.logError.latNm)),
    column(t('wu.longitude'), t('wu.needsClock'), lonRows, ['λ', fLon(r.lon)],
      bad(d.logError && d.logError.lonNm)),
  );
  node.append(grid);

  // --- what it cost -------------------------------------------------------
  if (!d.logError) return;
  const errLat = Math.abs(d.logError.latNm);
  const errLon = Math.abs(d.logError.lonNm);
  const byPeak = d.logErrorByMax ? Math.abs(d.logErrorByMax.lonNm) : null;
  const showPeak = r.equalAlt && byPeak !== null;
  const scale = Math.max(errLon, errLat, showPeak ? byPeak : 0, 1e-6);

  const bars = h('div', 'wu-bars');
  bars.append(h('div', 'wu-bars-title', t('wu.errorTitle')));

  const rows = [[t('wu.barLon'), errLon, 'lon']];
  if (showPeak) rows.push([t('wu.barByPeak'), byPeak, 'peak']);
  rows.push([t('wu.barLat'), errLat, 'lat']);

  for (const [label, value, cls] of rows) {
    const row = h('div', 'wu-bar-row');
    const track = h('div', 'wu-track');
    const fill = h('div', `wu-fill ${cls}`);
    fill.style.width = value > 0 ? `max(3px, ${(value / scale) * 100}%)` : '0';
    track.append(fill);
    row.append(h('span', 'wu-bar-label', label), track, h('span', `wu-bar-value ${cls}`, fmtNm(value)));
    bars.append(row);
  }

  const note = h('p', 'wu-note');
  const total = fmtNm(d.logError.totalNm);
  if (!r.equalAlt) {
    note.textContent = t('wu.notePeakOnly', { d: fmtNm(errLon) });
  } else if (showPeak && byPeak > errLon * 2 + 1) {
    note.textContent = t('wu.noteMethods', { peak: fmtNm(byPeak), equal: fmtNm(errLon) });
  } else if (errLat < 1e-9) {
    note.textContent = t('wu.noteNoLat', { d: fmtNm(errLon) });
  } else {
    const ratio = errLon / errLat;
    note.textContent =
      ratio > 1000 ? t('wu.noteAll', { total }) : t('wu.noteRatio', { total, ratio: Math.round(ratio) });
  }
  bars.append(note);
  node.append(bars);
}

// The lunar distance tab.
//
// Four things, in the order a navigator meets them: the two bodies in the sky
// with the angle between them; the sight itself; the reduction, which is long
// and which is the point; and what an arcminute of it is worth.

import { el, text, clear } from '../svg.js';
import { fmtAngle, fmtNumber, fmtNm, dm } from '../core/angles.js';
import { fmtClock } from '../core/time.js';
import { fLon } from '../ui/format.js';
import { t } from '../i18n.js';

const h = (tag, cls, txt) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (txt !== undefined) n.textContent = txt;
  return n;
};

const W = 520;
const H = 300;
const CX = 260;
const CY = 250;
const R = 210;

/** The sky as a half-dome seen from behind the observer: azimuth across, altitude up. */
const project = (altDeg, azDeg, refAz) => {
  // Keep both bodies on screen by centring the view between them.
  const dx = ((azDeg - refAz + 540) % 360) - 180;
  return [CX + (dx / 90) * R * 0.9, CY - (altDeg / 90) * R];
};

export function createLunars(store) {
  const { set, addLunar, addLunarRound, removeLunar, clearLunars } = store;
  const node = h('div', 'lun');
  const refs = {};

  // --- the sky ------------------------------------------------------------
  const figure = h('section', 'panel p-lunsky');
  const fhd = h('div', 'panel-hd');
  fhd.append(h('h2', null, t('lun.sky')), h('span', 'panel-sub', t('lun.sky.sub')));
  const svg = el('svg', {
    viewBox: `0 0 ${W} ${H}`,
    class: 'fig-svg lun-svg',
    role: 'img',
    'aria-label': t('lun.sky.aria'),
  });
  refs.verdict = h('p', 'lun-state');
  const fbody = h('div', 'panel-body');
  fbody.append(svg, refs.verdict);
  figure.append(fhd, fbody);

  // --- the sight ----------------------------------------------------------
  const logPanel = h('section', 'panel p-lunlog');
  const lhd = h('div', 'panel-hd');
  lhd.append(h('h2', null, t('lun.log')), h('span', 'panel-sub', t('lun.log.sub')));
  const lbody = h('div', 'panel-body');

  const actions = h('div', 'lun-actions');
  refs.take = h('button', 'log-take', t('lun.take'));
  refs.take.type = 'button';
  refs.take.addEventListener('click', () => addLunar());
  refs.round = h('button', 'log-take', t('lun.round'));
  refs.round.type = 'button';
  refs.round.addEventListener('click', () => addLunarRound());
  refs.clear = h('button', 'log-clear', t('lun.clear'));
  refs.clear.type = 'button';
  refs.clear.addEventListener('click', () => clearLunars());

  const avgBox = h('label', 'rail-check');
  refs.avg = document.createElement('input');
  refs.avg.type = 'checkbox';
  refs.avg.id = 'lun-avg';
  refs.avg.addEventListener('change', () => set({ lunarAverage: refs.avg.checked }));
  avgBox.append(refs.avg, h('span', null, t('lun.average')));
  actions.append(refs.take, refs.round, refs.clear, avgBox);

  refs.note = h('p', 'lun-note');
  refs.table = h('div', 'lun-table');
  lbody.append(actions, refs.note, refs.table);
  logPanel.append(lhd, lbody);

  // --- the reduction ------------------------------------------------------
  const workPanel = h('section', 'panel p-lunwork');
  const whd = h('div', 'panel-hd');
  whd.append(h('h2', null, t('lun.work')), h('span', 'panel-sub', t('lun.work.sub')));
  refs.work = h('div', 'panel-body');
  workPanel.append(whd, refs.work);

  // --- what it costs ------------------------------------------------------
  const costPanel = h('section', 'panel p-luncost');
  const chd = h('div', 'panel-hd');
  chd.append(h('h2', null, t('lun.cost')), h('span', 'panel-sub', t('lun.cost.sub')));
  refs.cost = h('div', 'panel-body');
  costPanel.append(chd, refs.cost);

  node.append(figure, logPanel, workPanel, costPanel);

  return {
    node,
    update(d, s) {
      refs.avg.checked = s.lunarAverage;
      refs.take.disabled = !d.lunar.usable.ok;
      refs.round.disabled = !d.lunar.usable.ok;
      refs.clear.disabled = d.lunar.sights.length === 0;
      drawSky(svg, refs, d);
      drawLog(refs, d, s, removeLunar);
      drawWorkup(refs.work, d, s);
      drawCost(refs.cost, d, s);
    },
  };
}

// ---------------------------------------------------------------------------

function drawSky(svg, refs, d) {
  clear(svg);
  const g = d.lunar.geom;
  const mid = midAzimuth(g.moonAz, g.sunAz);

  // Ground and horizon.
  svg.append(el('rect', { x: 0, y: CY, width: W, height: H - CY, class: 'lun-ground' }));
  svg.append(el('line', { x1: 0, y1: CY, x2: W, y2: CY, class: 'sx-horizon' }));

  // Altitude grid, so the two altitudes can be read off the figure.
  for (const alt of [30, 60, 90]) {
    const y = CY - (alt / 90) * R;
    svg.append(el('line', { x1: 0, y1: y, x2: W, y2: y, class: 'lun-grid' }));
    svg.append(text(6, y - 4, `${alt}°`, { class: 'lbl tiny muted' }));
  }

  const both = g.appMoonAlt > 0 && g.appSunAlt > 0;
  const [mx, my] = project(g.appMoonAlt, g.moonAz, mid);
  const [sx, sy] = project(g.appSunAlt, g.sunAz, mid);

  if (both) {
    // The arc that is actually measured. Drawn straight because the figure is
    // flat; the label says what the angle really is.
    svg.append(el('line', { x1: mx, y1: my, x2: sx, y2: sy, class: 'lun-arc' }));
    const lx = (mx + sx) / 2;
    const ly = (my + sy) / 2;
    svg.append(el('rect', {
      x: lx - 44, y: ly - 22, width: 88, height: 19, rx: 3, class: 'lun-chip',
    }));
    svg.append(text(lx, ly - 8, fmtAngle(g.appDist), {
      class: 'mn lbl lun-dist', 'text-anchor': 'middle',
    }));
  }

  if (g.appSunAlt > -2) {
    svg.append(el('circle', { cx: sx, cy: sy, r: 13, class: 'sx-sun' }));
    svg.append(text(sx, sy + 30, t('lun.sun'), { class: 'lbl tiny', 'text-anchor': 'middle' }));
  }
  if (g.appMoonAlt > -2) {
    svg.append(el('circle', { cx: mx, cy: my, r: 12, class: 'lun-moon' }));
    svg.append(text(mx, my + 30, t('lun.moon'), { class: 'lbl tiny', 'text-anchor': 'middle' }));
  }

  // The rate: the one number that decides what the sight is worth.
  svg.append(text(W - 8, 20, t('lun.rate', { n: fmtNumber(Math.abs(d.lunar.rate), 3) }), {
    class: 'lbl tiny muted', 'text-anchor': 'end',
  }));

  const u = d.lunar.usable;
  refs.verdict.textContent = u.ok
    ? t('lun.ready', { d: fmtAngle(u.dist) })
    : t(`lun.no.${u.reason}`, { d: fmtAngle(u.dist) });
  refs.verdict.className = `lun-state ${u.ok ? 'good' : 'bad'}`;
}

const midAzimuth = (a, b) => {
  const diff = ((b - a + 540) % 360) - 180;
  return (a + diff / 2 + 360) % 360;
};

// ---------------------------------------------------------------------------

function drawLog(refs, d, s, removeLunar) {
  refs.table.replaceChildren();
  const n = d.lunar.sights.length;
  refs.note.textContent = n === 0 ? t('lun.empty') : t('lun.count', { n });

  if (n === 0) return;

  const table = h('table', 'log-table lun-log-table');
  const thead = h('thead');
  const hr = h('tr');
  for (const k of ['lun.col.at', 'lun.col.dist', 'lun.col.moon', 'lun.col.sun', 'lun.col.says', '']) {
    hr.append(h('th', null, k ? t(k) : ''));
  }
  thead.append(hr);
  const tb = h('tbody');

  for (const w of d.lunar.workups) {
    const row = h('tr');
    row.append(
      h('td', 'mn', fmtClock(w.sight.tChrono)),
      h('td', 'mn', fmtAngle(w.sight.Dsextant)),
      h('td', 'mn', fmtAngle(w.sight.HsMoon)),
      h('td', 'mn', fmtAngle(w.sight.HsSun)),
      h('td', 'mn', w.r.gmt ? fmtClock(w.r.gmt) : t('lun.nosolve')),
    );
    const cell = h('td');
    const del = h('button', 'log-del', '×');
    del.type = 'button';
    del.setAttribute('aria-label', t('lun.remove'));
    del.addEventListener('click', () => removeLunar(w.sight.id));
    cell.append(del);
    row.append(cell);
    tb.append(row);
  }
  table.append(thead, tb);

  const wrap = h('div', 'log-scroll');
  wrap.append(table);
  refs.table.append(wrap);

  if (d.lunar.spreadSec !== null) {
    refs.table.append(
      h('p', 'lun-spread', t('lun.spread', {
        n: fmtNumber(Math.abs(d.lunar.spreadSec), 0),
      })),
    );
  }
}

// ---------------------------------------------------------------------------

/**
 * A block of label-and-value rows, in the same markup the noon work-up uses.
 * The two reductions are the same kind of object and must look it -- and
 * `.wu-rows` is a two-column grid that already handles a long Czech label
 * wrapping without dragging its value along with it.
 */
const rows = (...items) => {
  const dl = h('dl', 'wu-rows');
  for (const [k, v, cls] of items) dl.append(h('dt', cls || null, k), h('dd', cls || null, v));
  return dl;
};

function drawWorkup(node, d, s) {
  node.replaceChildren();
  const L = d.lunar;

  if (!L.workups.length) {
    node.append(h('p', 'wu-empty', t('lun.work.empty')));
    return;
  }
  const w = L.workups[L.workups.length - 1];
  const r = w.r;

  const grid = h('div', 'lun-grid-2');

  // --- the altitudes, which only exist to make the clearing possible -------
  const left = h('div', 'wu-col');
  const lh = h('div', 'wu-head');
  lh.append(h('h4', null, t('lun.col.alts')), h('span', 'wu-needs', t('lun.col.alts.sub')));
  left.append(lh, rows(
    [t('lun.moonHs'), fmtAngle(w.sight.HsMoon)],
    [t('corr.dip'), fmtMinSigned(-r.d), 'sub'],
    [t('lun.sd'), fmtMinSigned(r.sdMoon), 'sub'],
    [t('lun.moonApp'), fmtAngle(r.appMoonAlt)],
    [t('corr.refr'), fmtMinSigned(-r.refrMoon), 'sub'],
    [t('lun.par'), fmtMinSigned(r.parMoon), 'sub'],
    [t('lun.moonTrue'), fmtAngle(r.trueMoonAlt), 'strong'],
    [t('lun.sunApp'), fmtAngle(r.appSunAlt)],
    [t('lun.sunTrue'), fmtAngle(r.trueSunAlt), 'strong'],
  ));

  // --- the distance, and the clearing -------------------------------------
  const right = h('div', 'wu-col');
  const rh = h('div', 'wu-head');
  rh.append(h('h4', null, t('lun.col.clear')), h('span', 'wu-needs', t('lun.col.clear.sub')));
  right.append(rh, rows(
    [t('lun.dSext'), fmtAngle(w.sight.Dsextant)],
    [t('lun.dLimbs'), fmtMinSigned(r.sdMoon + r.sdSun), 'sub'],
    [t('lun.dApp'), fmtAngle(r.appDist)],
    [t('lun.cleared'), fmtAngle(r.cleared), 'strong'],
    [t('lun.clearedBy'), fmtMinSigned(r.clearedBy), 'sub'],
    [t('lun.almanac'), r.gmt ? fmtClock(r.gmt) : t('lun.nosolve'), 'strong'],
  ));

  grid.append(left, right);
  node.append(grid);

  // --- and what it is all for ---------------------------------------------
  const outs = h('div', 'lun-grid-2');

  const out = h('div', 'wu-col');
  out.append(h('div', 'wu-head', ''), rows(
    [t('lun.watchSays'), fmtClock(d.clockReads)],
    [t('lun.watchError'), signedSeconds(L.watchErrorSec), 'strong'],
    [t('lun.watchTruth'), signedSeconds(d.clockErrorSec), 'sub'],
    [t('lun.gmt'), L.gmt ? fmtClock(L.gmt) : '—', 'strong'],
    [t('lun.gmtErr'), signedSeconds(L.errorSec), Math.abs(L.errorSec ?? 0) > 60 ? 'bad' : ''],
  ));
  out.querySelector('.wu-head').append(h('h4', null, t('lun.result')));

  const lon = h('div', 'wu-col');
  lon.append(h('div', 'wu-head', ''), rows(
    [t('lun.localTime'), fmtHoursClock(d.apparentTime)],
    [t('lun.lonFound'), L.lon === null ? '—' : fLon(L.lon), 'strong'],
    [t('lun.lonTruth'), fLon(s.lon), 'sub'],
    [t('lun.lonErr'), L.lonErrorNm === null ? '—' : fmtNm(Math.abs(L.lonErrorNm)),
      Math.abs(L.lonErrorNm ?? 0) > 30 ? 'bad' : ''],
  ));
  lon.querySelector('.wu-head').append(h('h4', null, t('lun.toLongitude')));

  outs.append(out, lon);
  node.append(outs);

  node.append(h('p', 'wu-note', t('lun.work.note')));
}

// ---------------------------------------------------------------------------

function drawCost(node, d, s) {
  node.replaceChildren();
  const c = d.lunar.cost;

  node.append(h('p', 'lun-lede', t('lun.cost.lede', {
    min: fmtNumber(c.minutesOfTime, 1),
    nm: fmtNumber(c.nm, 0),
  })));

  // One arcminute of sextant error, put through both methods.
  const noonNm = 1;
  const lunarNm = Math.abs(c.nm);
  const scale = Math.max(noonNm, lunarNm, 1e-6);

  const bars = h('div', 'wu-bars');
  for (const [label, value, cls] of [
    [t('lun.bar.noon'), noonNm, 'lat'],
    [t('lun.bar.lunar'), lunarNm, 'lon'],
  ]) {
    const r = h('div', 'wu-bar-row');
    const track = h('div', 'wu-track');
    const fill = h('div', `wu-fill ${cls}`);
    fill.style.width = `${(value / scale) * 100}%`;
    track.append(fill);
    r.append(h('span', 'wu-bar-label', label), track, h('span', 'wu-bar-value mn', fmtNm(value)));
    bars.append(r);
  }
  node.append(bars);

  node.append(h('p', 'wu-note', t('lun.cost.note', {
    n: fmtNumber(lunarNm / noonNm, 0),
  })));

  // And the floor underneath all of it: the almanac's own error.
  node.append(h('p', 'lun-floor', t('lun.cost.almanac')));
}

const fmtMinSigned = (min) =>
  `${min >= 0 ? '+' : '−'}${fmtNumber(Math.abs(min), 1)}′`;

const signedSeconds = (sec) =>
  sec === null || sec === undefined
    ? '—'
    : `${sec >= 0 ? '+' : '−'}${fmtNumber(Math.abs(sec), 0)} s`;

const fmtHoursClock = (hours) => {
  const s = Math.round(((hours % 24) + 24) % 24 * 3600);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;
};

export const __test = { project, midAzimuth, fmtMinSigned, signedSeconds };

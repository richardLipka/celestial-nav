// The lunar distance tab.
//
// Four things, in the order a navigator meets them: the two bodies in the sky
// with the angle between them; the sight itself; the reduction, which is long
// and which is the point; and what an arcminute of it is worth.

import { el, text, clear } from '../svg.js';
import { fmtAngle, fmtNumber, fmtNm, sind, cosd } from '../core/angles.js';
import { fmtClock } from '../core/time.js';
import { fLon } from '../ui/format.js';
import { t } from '../i18n.js';

const h = (tag, cls, txt) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (txt !== undefined) n.textContent = txt;
  return n;
};

const W = 440;
const H = 356;
const CX = 220;
const CY = 168;
const R = 146;

/**
 * The same equidistant azimuthal projection the Sky panel uses: zenith at the
 * centre, horizon at the rim, radius proportional to zenith distance.
 *
 * It has to be this and not a flat plot of azimuth against altitude. The whole
 * subject of this tab is the angle between the two bodies, and azimuth is not
 * that angle -- it converges toward the zenith. Two bodies both 60 degrees up
 * with 60 degrees of azimuth between them are 29 degrees apart, and a flat plot
 * draws them as though they were 54.
 *
 * No flat picture of a sphere can get every separation right, and this one does
 * not either: measured over seven hundred usable lunars the drawn gap is out by
 * 2 degrees for a typical sight and 10 at the ninetieth percentile. The flat
 * plot it replaced was out by 9 and 53. The chip on the arc carries the exact
 * angle, because the picture cannot.
 */
const project = (altDeg, azDeg) => {
  const r = (R * (90 - altDeg)) / 90;
  return [CX + r * sind(azDeg), CY - r * cosd(azDeg)];
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

  // --- the sky itself -----------------------------------------------------
  svg.append(el('circle', { cx: CX, cy: CY, r: R, class: 'sky-disc' }));
  for (let alt = 30; alt < 90; alt += 30) {
    svg.append(el('circle', {
      cx: CX, cy: CY, r: (R * (90 - alt)) / 90, class: 'almucantar major',
    }));
  }
  for (let az = 0; az < 360; az += 90) {
    const [x, y] = project(0, az);
    svg.append(el('line', { x1: CX, y1: CY, x2: x, y2: y, class: 'radial major' }));
  }
  for (const [key, az] of [['sky.N', 0], ['sky.E', 90], ['sky.S', 180], ['sky.W', 270]]) {
    const [x, y] = project(0, az);
    svg.append(text(CX + (x - CX) * 1.11, CY + (y - CY) * 1.11 + 4, t(key), {
      class: 'cardinal lbl', 'text-anchor': 'middle',
    }));
  }
  svg.append(el('circle', { cx: CX, cy: CY, r: 2.4, class: 'zenith-dot' }));

  const both = g.appMoonAlt > 0 && g.appSunAlt > 0;
  const [mx, my] = project(g.appMoonAlt, g.moonAz);
  const [sx, sy] = project(g.appSunAlt, g.sunAz);

  if (both) {
    // The measured arc. Drawn straight, which in this projection is very
    // nearly the great circle between them; the chip carries the exact angle.
    svg.append(el('line', { x1: mx, y1: my, x2: sx, y2: sy, class: 'lun-arc' }));
    const lx = (mx + sx) / 2;
    const ly = (my + sy) / 2;
    svg.append(el('rect', {
      x: lx - 44, y: ly - 21, width: 88, height: 19, rx: 3, class: 'lun-chip',
    }));
    svg.append(text(lx, ly - 7, fmtAngle(g.appDist), {
      class: 'mn lbl lun-dist', 'text-anchor': 'middle',
    }));
  }

  if (g.appSunAlt > 0) {
    svg.append(el('circle', { cx: sx, cy: sy, r: 11, class: 'sx-sun' }));
    svg.append(text(sx, sy + 26, t('lun.sun'), { class: 'lbl tiny', 'text-anchor': 'middle' }));
  }
  if (g.appMoonAlt > 0) {
    svg.append(el('circle', { cx: mx, cy: my, r: 10, class: 'lun-moon' }));
    svg.append(text(mx, my + 25, t('lun.moon'), { class: 'lbl tiny', 'text-anchor': 'middle' }));
  }

  // The rate: the one number that decides what the sight is worth.
  svg.append(text(W - 8, 18, t('lun.rate', { n: fmtNumber(Math.abs(d.lunar.rate), 3) }), {
    class: 'lbl tiny muted', 'text-anchor': 'end',
  }));

  const u = d.lunar.usable;
  refs.verdict.textContent = u.ok
    ? t('lun.ready', { d: fmtAngle(u.dist) })
    : t(`lun.no.${u.reason}`, { d: fmtAngle(u.dist) });
  refs.verdict.className = `lun-state ${u.ok ? 'good' : 'bad'}`;
}

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

export const __test = { project, fmtMinSigned, signedSeconds };

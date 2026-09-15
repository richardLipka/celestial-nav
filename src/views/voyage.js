// The passage, on a Mercator chart.
//
// Mercator because a rhumb line is straight on it, and a rhumb line is what a
// ship actually steers. The two tracks are the ship and the navigator's belief
// about the ship, and on a good chronometer they lie on top of each other.

import { el, text, polyline, clear } from '../svg.js';
import { D2R, fmtNm, fmtNumber, fmtBearing } from '../core/angles.js';
import { t, pick } from '../i18n.js';
import { fLat, fLon } from '../ui/format.js';
import { fmtDate } from '../core/time.js';
import { routes, routeById } from '../routes.js';

const W = 780;
const H = 430;
const PAD = { l: 42, r: 18, t: 16, b: 34 };

const h = (tag, cls, txt) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (txt !== undefined) n.textContent = txt;
  return n;
};

/** Mercator's stretched latitude, in units comparable to degrees of longitude. */
const merc = (lat) => Math.log(Math.tan(Math.PI / 4 + (Math.max(-85, Math.min(85, lat)) * D2R) / 2)) / D2R;

export function createVoyage(store) {
  const { state, set, setIn } = store;
  const node = h('div', 'voy');
  const refs = {};

  // --- controls -----------------------------------------------------------
  const bar = h('div', 'voy-bar');

  const routeSel = document.createElement('select');
  routeSel.id = 'voy-route';
  routeSel.className = 'rail-select voy-route';
  for (const r of routes) {
    const o = document.createElement('option');
    o.value = r.id;
    o.textContent = pick(r.name);
    routeSel.append(o);
  }
  routeSel.addEventListener('change', () => store.applyRoute(routeSel.value));
  refs.route = routeSel;

  const field = (label, control, out) => {
    const f = h('div', 'voy-field');
    const top = h('div', 'voy-field-head');
    top.append(h('span', 'rail-sublabel', label));
    if (out) top.append(out);
    f.append(top, control);
    return f;
  };

  const rangeFor = (id, { min, max, step, value, onInput }) => {
    const input = document.createElement('input');
    input.type = 'range';
    input.id = id;
    input.min = min;
    input.max = max;
    input.step = step;
    input.value = value;
    input.addEventListener('input', () => onInput(Number(input.value)));
    return input;
  };

  const depIn = document.createElement('input');
  depIn.type = 'date';
  depIn.id = 'voy-departure';
  depIn.className = 'rail-date voy-dep';
  depIn.addEventListener('change', () => {
    const [y, m, d] = depIn.value.split('-').map(Number);
    if (y) set({ departureDate: new Date(Date.UTC(y, m - 1, d)) });
  });
  refs.departure = depIn;

  refs.speedVal = h('output', 'rail-value');
  refs.speed = rangeFor('voy-speed', {
    min: 2, max: 12, step: 0.5, value: state.voyage.speedKts,
    onInput: (v) => setIn('voyage', { speedKts: v }),
  });
  refs.driftVal = h('output', 'rail-value');
  refs.drift = rangeFor('voy-drift', {
    min: 0, max: 2, step: 0.1, value: state.voyage.driftKts,
    onInput: (v) => setIn('voyage', { driftKts: v }),
  });
  refs.setVal = h('output', 'rail-value');
  refs.set = rangeFor('voy-set', {
    min: 0, max: 355, step: 5, value: state.voyage.setDeg,
    onInput: (v) => setIn('voyage', { setDeg: v }),
  });
  refs.biasVal = h('output', 'rail-value');
  refs.bias = rangeFor('voy-bias', {
    min: -8, max: 8, step: 0.5, value: state.voyage.steeringBiasDeg,
    onInput: (v) => setIn('voyage', { steeringBiasDeg: v }),
  });

  const chrono = h('label', 'rail-check voy-chrono');
  const chronoIn = document.createElement('input');
  chronoIn.type = 'checkbox';
  chronoIn.id = 'voy-chrono';
  chronoIn.checked = state.voyage.carryChronometer;
  chronoIn.addEventListener('change', () =>
    setIn('voyage', { carryChronometer: chronoIn.checked }),
  );
  chrono.append(chronoIn, h('span', null, t('voy.carry')));
  refs.chrono = chronoIn;

  bar.append(
    field(t('voy.route'), routeSel),
    field(t('voy.sailed'), depIn),
    field(t('voy.speed'), refs.speed, refs.speedVal),
    field(t('voy.drift'), refs.drift, refs.driftVal),
    field(t('voy.set'), refs.set, refs.setVal),
    field(t('voy.bias'), refs.bias, refs.biasVal),
    chrono,
  );

  refs.note = h('p', 'voy-note');

  const svg = el('svg', {
    viewBox: `0 0 ${W} ${H}`,
    class: 'fig-svg voy-chart',
    role: 'img',
    'aria-label': t('aria.voyage'),
  });

  refs.summary = h('div', 'voy-summary');

  node.append(bar, refs.note, svg, refs.summary);

  return {
    node,
    update(d, s) {
      const v = d.voyage;
      if (refs.route.value !== s.voyage.routeId) refs.route.value = s.voyage.routeId;
      refs.note.textContent = pick(routeById(s.voyage.routeId).note);

      setVal(refs.speed, s.voyage.speedKts);
      setVal(refs.drift, s.voyage.driftKts);
      setVal(refs.set, s.voyage.setDeg);
      setVal(refs.bias, s.voyage.steeringBiasDeg);
      refs.chrono.checked = s.voyage.carryChronometer;
      if (document.activeElement !== refs.departure) {
        refs.departure.value = fmtDate(s.departureDate);
      }

      refs.speedVal.textContent = `${fmtNumber(s.voyage.speedKts, 1)} ${t('unit.kts')}`;
      refs.driftVal.textContent = `${fmtNumber(s.voyage.driftKts, 1)} ${t('unit.kts')}`;
      refs.setVal.textContent = fmtBearing(s.voyage.setDeg);
      refs.biasVal.textContent =
        `${s.voyage.steeringBiasDeg >= 0 ? '+' : '−'}${fmtNumber(Math.abs(s.voyage.steeringBiasDeg), 1)}°`;

      drawChart(svg, v, s);
      drawSummary(refs.summary, v, s);
    },
  };
}

function setVal(input, v) {
  if (document.activeElement !== input) input.value = String(v);
}

// --- the chart -------------------------------------------------------------

function drawChart(svg, v, s) {
  clear(svg);
  if (!v || !v.legs.length) return;

  const pts = [v.start, ...v.legs.map((l) => l.truth), ...v.legs.map((l) => l.estimate)];
  if (v.destination) pts.push(v.destination);

  const xs = pts.map((p) => p.lon);
  const ys = pts.map((p) => merc(p.lat));
  const pad = 0.08;
  let x0 = Math.min(...xs);
  let x1 = Math.max(...xs);
  let y0 = Math.min(...ys);
  let y1 = Math.max(...ys);
  const mx = Math.max((x1 - x0) * pad, 0.6);
  const my = Math.max((y1 - y0) * pad, 0.6);
  x0 -= mx; x1 += mx; y0 -= my; y1 += my;

  // Mercator is conformal, so x and y must share one scale or the angles lie.
  const boxW = W - PAD.l - PAD.r;
  const boxH = H - PAD.t - PAD.b;
  const k = Math.min(boxW / (x1 - x0), boxH / (y1 - y0));
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const px = (lon) => PAD.l + boxW / 2 + (lon - cx) * k;
  const py = (lat) => PAD.t + boxH / 2 - (merc(lat) - cy) * k;
  const at = (p) => [px(p.lon), py(p.lat)];

  svg.append(el('rect', {
    x: PAD.l, y: PAD.t, width: boxW, height: boxH, class: 'voy-sea',
  }));

  // --- graticule ---------------------------------------------------------
  const stepFor = (span) => [1, 2, 5, 10, 15, 20, 30].find((q) => span / q <= 8) || 45;
  const lonStep = stepFor(x1 - x0);
  const latSpan = Math.abs(
    (Math.atan(Math.exp(y1 * D2R)) * 2 - Math.PI / 2) / D2R -
    (Math.atan(Math.exp(y0 * D2R)) * 2 - Math.PI / 2) / D2R,
  );
  const latStep = stepFor(latSpan);

  for (let lon = Math.ceil(x0 / lonStep) * lonStep; lon <= x1; lon += lonStep) {
    const x = px(lon);
    svg.append(el('line', { x1: x, y1: PAD.t, x2: x, y2: H - PAD.b, class: 'voy-grid' }));
    svg.append(text(x, H - PAD.b + 13, `${Math.abs(lon)}°${lon < 0 ? 'W' : lon > 0 ? 'E' : ''}`,
      { class: 'lbl tiny muted', 'text-anchor': 'middle' }));
  }
  for (let lat = -80; lat <= 80; lat += latStep) {
    const y = py(lat);
    if (y < PAD.t || y > H - PAD.b) continue;
    svg.append(el('line', { x1: PAD.l, y1: y, x2: W - PAD.r, y2: y, class: 'voy-grid' }));
    svg.append(text(PAD.l - 6, y + 3.5, `${Math.abs(lat)}°${lat < 0 ? 'S' : lat > 0 ? 'N' : ''}`,
      { class: 'lbl tiny muted', 'text-anchor': 'end' }));
  }
  svg.append(el('rect', {
    x: PAD.l, y: PAD.t, width: boxW, height: boxH, class: 'voy-frame',
  }));

  // --- the destination, and how close counts as arrived ------------------
  if (v.destination) {
    const [dx, dy] = at(v.destination);
    // 25 nm at this scale: a degree of latitude is 60 nm.
    const r = Math.max(4, (25 / 60) * k);
    svg.append(el('circle', { cx: dx, cy: dy, r, class: 'voy-dest-ring' }));
    svg.append(el('circle', { cx: dx, cy: dy, r: 4, class: 'voy-dest' }));
    svg.append(text(dx + 9, dy + 4, t('voy.dest'), { class: 'lbl tiny voy-dest-text' }));
  }

  // --- the two tracks ----------------------------------------------------
  svg.append(polyline([v.start, ...v.legs.map((l) => l.estimate)].map(at), { class: 'voy-believed' }));
  svg.append(polyline([v.start, ...v.legs.map((l) => l.truth)].map(at), { class: 'voy-truth' }));

  for (const leg of v.legs) {
    const [x, y] = at(leg.truth);
    svg.append(el('circle', {
      cx: x, cy: y, r: leg.sighted.usable ? 2.4 : 3.2,
      class: `voy-day ${leg.sighted.usable ? '' : 'blind'}`,
    }));
  }

  const [sx, sy] = at(v.start);
  svg.append(el('circle', { cx: sx, cy: sy, r: 4.5, class: 'voy-start' }));
  svg.append(text(sx + 9, sy + 4, t('voy.start'), { class: 'lbl tiny' }));

  const [ex, ey] = at(v.truth);
  svg.append(el('circle', { cx: ex, cy: ey, r: 5, class: 'voy-end' }));

  // --- legend ------------------------------------------------------------
  const rows = [
    [t('voy.legend.truth'), 'voy-truth'],
    [t('voy.legend.believed'), 'voy-believed'],
  ];
  rows.forEach(([label, cls], i) => {
    const y = PAD.t + 14 + i * 16;
    svg.append(el('line', { x1: W - PAD.r - 130, y1: y, x2: W - PAD.r - 106, y2: y, class: cls }));
    svg.append(text(W - PAD.r - 100, y + 3.5, label, { class: 'lbl tiny' }));
  });
}

// --- the summary -----------------------------------------------------------

function drawSummary(node, v, s) {
  node.replaceChildren();
  if (!v || !v.legs.length) return;

  const cell = (k, val, cls) => {
    const c = h('div', `voy-cell ${cls || ''}`);
    c.append(h('span', 'voy-cell-k', k), h('span', 'voy-cell-v', val));
    return c;
  };

  const carried = s.voyage.carryChronometer;
  const clock = v.legs[v.legs.length - 1].clockError;
  node.append(
    cell(t('voy.days'), String(v.legs.length)),
    cell(t('voy.worstLat'), fmtNm(v.worstLatNm), 'good'),
    cell(t('voy.finalLon'), fmtNm(Math.abs(v.error.lonNm)),
      Math.abs(v.error.lonNm) > 5 ? 'bad' : 'good'),
    // A watch you are not carrying has no error worth reporting.
    carried
      ? cell(t('voy.clockNow'), `${fmtNumber(clock, 0)} s`, Math.abs(clock) > 5 ? 'bad' : '')
      : cell(t('voy.clockNow'), t('voy.noWatch'), 'muted'),
  );

  const verdict = h('p', 'voy-verdict');
  if (!v.destination) {
    verdict.textContent = t('voy.verdict.run', { lat: fLat(v.truth.lat), lon: fLon(v.truth.lon) });
  } else if (v.arrived) {
    verdict.textContent = t('voy.verdict.arrived', {
      day: v.legs.length, off: fmtNm(v.landfall.offByNm),
    });
    verdict.classList.toggle('good', v.landfall.offByNm < 30);
  } else if (Math.abs(v.error.latNm) > 10) {
    // With no sight to be had, the latitude was never corrected either, so the
    // usual line about sitting on the right parallel would simply be false.
    verdict.textContent = t('voy.verdict.blindLost', {
      days: v.legs.length, off: fmtNm(v.truthToDestNm),
    });
    verdict.classList.add('bad');
  } else {
    verdict.textContent = t('voy.verdict.lost', {
      days: v.legs.length, off: fmtNm(v.truthToDestNm), lat: fLat(v.truth.lat),
    });
    verdict.classList.add('bad');
  }
  node.append(verdict);

  if (v.blindDays) {
    node.append(h('p', 'voy-blind', t('voy.blind', { n: v.blindDays })));
  }
}

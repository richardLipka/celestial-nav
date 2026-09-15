// The control rail: everything on the left is the state, and nothing else is.

import { fmtNumber } from '../core/angles.js';
import { fmtDate } from '../core/time.js';
import { t, pick } from '../i18n.js';
import { fLat, fLon, fClockError, fRate } from './format.js';
import { scenarios, byId, applyScenario } from '../scenarios.js';
import { places, GROUPS, placeById, findPlace, applyPlace } from '../places.js';

const h = (tag, cls, txt) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (txt !== undefined) n.textContent = txt;
  return n;
};

function group(label) {
  const g = h('div', 'rail-group');
  g.append(h('div', 'rail-label', label));
  return g;
}

function option(value, label) {
  const o = document.createElement('option');
  o.value = value;
  o.textContent = label;
  return o;
}

function slider(id, { min, max, step, value, onInput }) {
  const input = document.createElement('input');
  input.type = 'range';
  input.id = id;
  input.min = min;
  input.max = max;
  input.step = step;
  input.value = value;
  input.addEventListener('input', () => onInput(Number(input.value)));
  return input;
}

function check(id, label, checked, onChange) {
  const row = h('label', 'rail-check');
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.id = id;
  input.checked = checked;
  input.addEventListener('change', () => onChange(input.checked));
  row.append(input, h('span', null, label));
  return { row, input };
}

// The clock-error slider is cubic, so that the first few seconds -- where the
// whole lesson lives -- get most of the travel.
const posToSec = (p) => Math.round(Math.sign(p) * (Math.abs(p) / 100) ** 3 * 1800);
const secToPos = (s) => Math.sign(s) * Math.cbrt(Math.abs(s) / 1800) * 100;

// The rate slider is cubic too, because the interesting range is below one
// second a day: H4 held a twelfth, and the Longitude Act asked for under three.
const posToRate = (p) => Math.sign(p) * (Math.abs(p) / 100) ** 3 * 30;
const rateToPos = (r) => Math.sign(r) * Math.cbrt(Math.abs(r) / 30) * 100;

export function createRail(store) {
  const { state, set, setIn } = store;
  const node = h('aside', 'rail');
  const refs = {};

  // --- scenario -----------------------------------------------------------
  const gScenario = group(t('rail.scenario'));
  const sel = document.createElement('select');
  sel.id = 'scenario';
  sel.className = 'rail-select';
  // This one sits straight under its group heading rather than going through
  // labelled(), so it needs its name spelled out.
  sel.setAttribute('aria-label', t('rail.scenario'));
  for (const sc of scenarios) sel.append(option(sc.id, pick(sc.name)));
  sel.addEventListener('change', () => set(applyScenario(byId(sel.value))));
  refs.scenario = sel;
  refs.note = h('p', 'rail-note');
  gScenario.append(sel, refs.note);
  node.append(gScenario);

  // --- position -----------------------------------------------------------
  const gPos = group(t('rail.ship'));

  const placeSel = document.createElement('select');
  placeSel.id = 'place';
  placeSel.className = 'rail-select';
  placeSel.append(option('custom', t('rail.customPlace')));
  for (const key of GROUPS) {
    const og = document.createElement('optgroup');
    og.label = t(`places.${key}`);
    for (const p of places.filter((x) => x.group === key)) og.append(option(p.id, pick(p.name)));
    placeSel.append(og);
  }
  placeSel.addEventListener('change', () => {
    const p = placeById(placeSel.value);
    if (p) set(applyPlace(p));
  });
  refs.place = placeSel;

  refs.latVal = h('output', 'rail-value phi');
  refs.lonVal = h('output', 'rail-value phi');
  refs.lat = slider('lat', {
    min: -75, max: 75, step: 0.25, value: state.lat,
    onInput: (v) => set({ lat: v, secondOfDay: null }),
  });
  refs.lon = slider('lon', {
    min: -180, max: 180, step: 0.25, value: state.lon,
    onInput: (v) => set({ lon: v, secondOfDay: null }),
  });
  const dateIn = document.createElement('input');
  dateIn.type = 'date';
  dateIn.id = 'date';
  dateIn.className = 'rail-date';
  dateIn.addEventListener('change', () => {
    const [y, m, d] = dateIn.value.split('-').map(Number);
    if (y) set({ date: new Date(Date.UTC(y, m - 1, d)), secondOfDay: null });
  });
  refs.date = dateIn;

  gPos.append(
    labelled(t('rail.place'), null, placeSel),
    labelled(t('rail.latitude'), refs.latVal, refs.lat),
    labelled(t('rail.longitude'), refs.lonVal, refs.lon),
    labelled(t('rail.date'), null, dateIn),
  );
  node.append(gPos);

  // --- the chronometer ----------------------------------------------------
  const gClock = group(t('rail.chronometer'));
  refs.clockVal = h('output', 'rail-value clock');
  refs.clock = slider('clock-error', {
    min: -100, max: 100, step: 1, value: secToPos(state.clockErrorSec),
    onInput: (p) => set({ clockErrorSec: posToSec(p) }),
  });
  refs.clock.classList.add('clock-slider');
  refs.rateVal = h('output', 'rail-value clock');
  refs.rate = slider('clock-rate', {
    min: -100, max: 100, step: 1, value: rateToPos(state.clockRateSecPerDay),
    onInput: (p) => set({ clockRateSecPerDay: posToRate(p) }),
  });
  refs.rate.classList.add('clock-slider');

  const depIn = document.createElement('input');
  depIn.type = 'date';
  depIn.id = 'departure';
  depIn.className = 'rail-date';
  depIn.addEventListener('change', () => {
    const [y, m, d] = depIn.value.split('-').map(Number);
    if (y) set({ departureDate: new Date(Date.UTC(y, m - 1, d)) });
  });
  refs.departure = depIn;
  refs.accum = h('p', 'rail-accum');

  const reset = h('button', 'rail-reset', t('rail.setRight'));
  reset.type = 'button';
  reset.addEventListener('click', () => set({ clockErrorSec: 0, clockRateSecPerDay: 0 }));
  const eot = check('use-eot', t('rail.useEot'), state.useEoT, (v) => set({ useEoT: v }));
  refs.eot = eot.input;
  gClock.append(
    labelled(t('rail.error'), refs.clockVal, refs.clock),
    labelled(t('rail.rate'), refs.rateVal, refs.rate),
    labelled(t('rail.departure'), null, depIn),
    refs.accum,
    reset,
    eot.row,
  );
  node.append(gClock);

  // --- the sextant --------------------------------------------------------
  const gSext = group(t('rail.sextant'));
  refs.eyeVal = h('output', 'rail-value');
  refs.eye = slider('eye-height', {
    min: 1, max: 30, step: 0.5, value: state.eyeHeightM,
    onInput: (v) => set({ eyeHeightM: v }),
  });
  refs.ieVal = h('output', 'rail-value');
  refs.ie = slider('index-error', {
    min: -5, max: 5, step: 0.1, value: state.indexErrorMin,
    onInput: (v) => set({ indexErrorMin: v }),
  });
  gSext.append(
    labelled(t('rail.eyeHeight'), refs.eyeVal, refs.eye),
    labelled(t('rail.indexError'), refs.ieVal, refs.ie),
  );

  refs.corr = {};
  const corrBox = h('div', 'rail-checks');
  for (const [k, key] of [
    ['dip', 'corr.dip'],
    ['refraction', 'corr.refr'],
    ['semiDiameter', 'corr.sd'],
    ['parallax', 'corr.par'],
  ]) {
    const c = check(`corr-${k}`, t(key), state.corr[k], (v) => setIn('corr', { [k]: v }));
    refs.corr[k] = c.input;
    corrBox.append(c.row);
  }
  const noise = check('sextant-noise', t('rail.sextantNoise'), state.sextantNoise, (v) =>
    set({ sextantNoise: v }),
  );
  refs.noise = noise.input;
  gSext.append(h('div', 'rail-sublabel', t('rail.corrections')), corrBox, noise.row);
  node.append(gSext);

  // --- overlays -----------------------------------------------------------
  const gShow = group(t('rail.overlays'));
  refs.show = {};
  const showBox = h('div', 'rail-checks');
  for (const k of ['cop', 'lop', 'cross', 'equator', 'night', 'belowHorizon']) {
    const c = check(`show-${k}`, t(`show.${k}`), state.show[k], (v) => setIn('show', { [k]: v }));
    refs.show[k] = c.input;
    showBox.append(c.row);
  }
  gShow.append(showBox);
  node.append(gShow);

  return {
    node,
    update(d, s) {
      if (refs.scenario.value !== s.scenario) refs.scenario.value = s.scenario;
      refs.note.textContent = pick(byId(s.scenario).note);

      const here = findPlace(s.lat, s.lon);
      refs.place.value = here ? here.id : 'custom';

      setVal(refs.lat, s.lat);
      setVal(refs.lon, s.lon);
      refs.latVal.textContent = fLat(s.lat);
      refs.lonVal.textContent = fLon(s.lon);
      if (document.activeElement !== refs.date) refs.date.value = fmtDate(s.date);

      setVal(refs.clock, secToPos(s.clockErrorSec));
      refs.clockVal.textContent = fClockError(s.clockErrorSec);
      refs.clockVal.classList.toggle('bad', s.clockErrorSec !== 0);

      setVal(refs.rate, rateToPos(s.clockRateSecPerDay));
      refs.rateVal.textContent = fRate(s.clockRateSecPerDay);
      refs.rateVal.classList.toggle('bad', s.clockRateSecPerDay !== 0);
      if (document.activeElement !== refs.departure) {
        refs.departure.value = fmtDate(s.departureDate);
      }
      refs.accum.textContent = t('rail.accum', {
        // Days elapsed, not days rounded: 62 days and 17 hours is day 62.
        days: Math.floor(d.daysOut),
        total: fClockError(Math.round(d.clockErrorSec)),
      });
      refs.accum.classList.toggle('bad', Math.abs(d.clockErrorSec) >= 0.5);

      refs.eot.checked = s.useEoT;

      setVal(refs.eye, s.eyeHeightM);
      setVal(refs.ie, s.indexErrorMin);
      refs.eyeVal.textContent = t('rail.eyeVal', {
        m: fmtNumber(s.eyeHeightM, 1),
        d: fmtNumber(d.sight.terms.dip, 1),
      });
      refs.ieVal.textContent =
        `${s.indexErrorMin >= 0 ? '+' : '−'}${fmtNumber(Math.abs(s.indexErrorMin), 1)}′`;

      refs.noise.checked = s.sextantNoise;
      for (const k in refs.corr) refs.corr[k].checked = s.corr[k];
      for (const k in refs.show) refs.show[k].checked = s.show[k];
    },
  };
}

function setVal(input, v) {
  if (document.activeElement !== input) input.value = String(v);
}

function labelled(name, output, control) {
  const row = h('div', 'rail-row');
  const top = h('div', 'rail-row-head');
  // A real <label for>, not a span: otherwise a screen reader announces these
  // as unnamed sliders, and clicking the caption does nothing.
  const cap = h('label', 'rail-sublabel', name);
  if (control.id) cap.htmlFor = control.id;
  top.append(cap);
  if (output) top.append(output);
  row.append(top, control);
  return row;
}

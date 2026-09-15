// One state object, one derive step, one notification. Every panel is a pure
// function of `derived`, which is the only way four views of the same instant
// stay honest with each other.

import { norm180 } from '../core/angles.js';
import { MS_HOUR, utcHours, addSeconds, chronometerError, daysBetween } from '../core/time.js';
import { solar, subsolar, decRateMinPerHour } from '../core/sun.js';
import { horizon, sensitivity, culmination, sunEvents, diurnalArc, celestialEquator } from '../core/horizon.js';
import { correct, uncorrect, defaultOptions } from '../core/corrections.js';
import { assumedGP, noonWorkUp, circleOfPosition, angularDistance, lineOfPosition } from '../core/fix.js';
import { observe, reduceLog, matchAltitudeTime, fixError } from '../core/sights.js';
import { simulateVoyage, planPassage } from '../core/voyage.js';
import { routeById } from '../routes.js';

const listeners = new Set();

let nextSightId = 1;

export const state = {
  tab: 'simulation',
  sights: [],          // { id, t, jitterMin } -- the instants the navigator chose
  sextantNoise: true,
  lat: 18.0,
  lon: -76.8,
  date: new Date(Date.UTC(1762, 0, 19)),
  secondOfDay: null, // null means "snap to local apparent noon"
  clockErrorSec: 0,          // the watch's error on the day it sailed
  clockRateSecPerDay: 0,     // the part of its rate nobody knew about
  departureDate: new Date(Date.UTC(1762, 0, 19)),
  eyeHeightM: 3,
  indexErrorMin: 0,
  limb: 'lower',
  corr: { dip: true, refraction: true, semiDiameter: true, parallax: true },
  useEoT: true,
  globeCenter: { lat: 20, lon: -60 },
  theoryView: { lat: 28, lon: 150 },
  voyage: {
    routeId: 'trades',
    speedKts: 5,
    driftKts: 0.6,
    setDeg: 275,
    steeringBiasDeg: 2,
    carryChronometer: true,
    seed: 7,
  },
  show: { cop: true, lop: true, equator: true, night: true, belowHorizon: true },
  scenario: 'jamaica',
};

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

let derived = null;
export const get = () => derived;

export function set(patch) {
  // A new day, or a new place, makes the old log meaningless.
  const moved =
    ('date' in patch && +patch.date !== +state.date) ||
    ('lat' in patch && patch.lat !== state.lat) ||
    ('lon' in patch && patch.lon !== state.lon);
  Object.assign(state, patch);
  if (moved) state.sights = [];
  render();
}

// --- the log ---------------------------------------------------------------

/** A reading error for one sight, drawn once and kept with it. */
function drawJitter() {
  // Two uniforms averaged: roughly normal, and never more than a minute out.
  return ((Math.random() + Math.random()) - 1) * 0.6;
}

/** Log a sight at the instant currently on the timeline. */
export function addSight(at) {
  const t = at ?? derived.now;
  if (state.sights.some((s) => Math.abs(s.t - t) < 1000)) return false;
  state.sights = [...state.sights, { id: nextSightId++, t: new Date(t), jitterMin: drawJitter() }];
  render();
  return true;
}

/**
 * Clamp the sextant at a morning altitude and watch the sun come back down to
 * it. This is the real equal-altitudes method, not a shortcut.
 */
export function matchSight(entry) {
  const from = new Date(Math.max(derived.lan.getTime(), entry.t.getTime() + 60000));
  const t = matchAltitudeTime(entry.Ho, from, { lat: state.lat, lon: state.lon }, derived.opt);
  if (!t) return false;
  return addSight(t);
}

export function removeSight(id) {
  state.sights = state.sights.filter((s) => s.id !== id);
  render();
}

export function clearSights() {
  state.sights = [];
  render();
}

/** Pick a passage: it carries its own departure date, which the watch shares. */
export function applyRoute(id) {
  const r = routeById(id);
  const [y, m, d] = r.departure;
  state.voyage = {
    ...state.voyage,
    routeId: r.id,
    speedKts: r.speedKts,
    driftKts: r.driftKts,
    setDeg: r.setDeg,
  };
  state.departureDate = new Date(Date.UTC(y, m - 1, d));
  render();
}

// The passage is 20-odd noon reductions, so it is memoised on its inputs:
// without this it would be recomputed on every drag of the day scrubber.
let voyageCache = { key: null, value: null };

function runVoyage(s, opt) {
  const r = routeById(s.voyage.routeId);
  const v = s.voyage;
  const key = [
    v.routeId, v.speedKts, v.driftKts, v.setDeg, v.steeringBiasDeg, v.carryChronometer, v.seed,
    +s.departureDate, s.clockErrorSec, s.clockRateSecPerDay,
  ].join('|');
  if (voyageCache.key === key) return voyageCache.value;

  const plan = planPassage(r.from, r.to, v.speedKts);
  const value = simulateVoyage({
    start: r.from,
    destination: r.to,
    departureDate: s.departureDate,
    ...plan,
    days: plan.days + 14, // room to wander before giving up
    speedKts: v.speedKts,
    driftKts: v.driftKts,
    setDeg: v.setDeg,
    steeringBiasDeg: v.steeringBiasDeg,
    carryChronometer: v.carryChronometer,
    clockErrorSec: s.clockErrorSec,
    clockRateSecPerDay: s.clockRateSecPerDay,
    seed: v.seed,
    corrections: opt,
  });
  voyageCache = { key, value };
  return value;
}

/** Merge into a nested object without clobbering its siblings. */
export function setIn(key, patch) {
  state[key] = { ...state[key], ...patch };
  render();
}

export function render() {
  derived = derive(state);
  for (const fn of listeners) fn(derived, state);
}

function sightOptions(s, sdMin) {
  return {
    indexErrorMin: s.indexErrorMin,
    eyeHeightM: s.eyeHeightM,
    limb: s.limb,
    sdMin,
    dip: s.corr.dip,
    refraction: s.corr.refraction,
    semiDiameter: s.corr.semiDiameter,
    parallax: s.corr.parallax,
  };
}

function derive(s) {
  const lan = culmination(s.date, s.lon, true);
  const now =
    s.secondOfDay === null
      ? lan
      : new Date(s.date.getTime() + s.secondOfDay * 1000);

  // What nature does. The sky is driven by the true instant, always.
  const sky = horizon(s.lat, s.lon, now);
  const gpTrue = subsolar(now);

  // The chronometer's error is not a constant: it is whatever it was on the
  // day of departure plus the rate nobody knew about, accumulated ever since.
  const errorAt = (when) =>
    chronometerError(s.departureDate, when, s.clockErrorSec, s.clockRateSecPerDay);
  const clockErrorSec = errorAt(now);
  const daysOut = Math.max(0, daysBetween(s.departureDate, now));

  // What the navigator reads and reduces.
  const opt = sightOptions(s, sky.solar.sd);
  const Hs = uncorrect(sky.H, opt);
  const sight = correct(Hs, opt);
  const gpAssumed = assumedGP(now, clockErrorSec, s.useEoT);

  const z = 90 - sight.Ho;
  const noon = noonWorkUp(
    { lat: s.lat, lon: s.lon, date: s.date },
    { ...opt, clockErrorSec: errorAt(lan), useEoT: s.useEoT },
  );

  const events = sunEvents(s.date, s.lat, s.lon);
  const sens = sensitivity(s.lat, sky.Az);

  // --- the navigator's own log -------------------------------------------
  // Simulated from the instants they chose, then reduced using nothing but
  // the log and the almanac.
  const truth = { lat: s.lat, lon: s.lon };
  const observations = s.sights.map((g) =>
    Object.assign(observe(g.t, truth, opt, errorAt(g.t), s.sextantNoise ? g.jitterMin : 0), {
      id: g.id,
    }),
  );
  const logResult = reduceLog(observations, { useEoT: s.useEoT });
  const logFix = logResult.stage === 'none' ? null : { lat: logResult.lat, lon: logResult.lon };
  const logError = logFix ? fixError(logFix, truth) : null;
  const logErrorByMax =
    logResult.stage === 'none' ? null : fixError({ lat: logResult.lat, lon: logResult.lonByMax }, truth);

  return {
    opt,
    voyage: runVoyage(s, opt),
    clockErrorSec, // the effective error now, not the departure figure
    errorAt,
    daysOut,
    observations,
    logResult,
    logError,
    logErrorByMax,
    now,
    lan,
    isNoon: Math.abs(now - lan) < 30000,
    clockReads: addSeconds(now, clockErrorSec),
    apparentTime: (utcHours(now) + (sky.solar.eotDeg + s.lon) / 15 + 24) % 24,

    sky,
    sight,
    z,
    sens,
    sensPerMin: (sens * 15) / 60,
    decRate: decRateMinPerHour(now),

    gpTrue,
    gpAssumed: { lat: gpAssumed.lat, lon: gpAssumed.lon },
    gpOffsetDeg: norm180(gpAssumed.lon - gpTrue.lon),

    cop: circleOfPosition(gpTrue, z, 240),
    copAssumed:
      clockErrorSec === 0 ? null : circleOfPosition({ lat: gpAssumed.lat, lon: gpAssumed.lon }, z, 240),
    lop: lineOfPosition({ lat: s.lat, lon: s.lon }, sky.Az, 6),

    noon,
    events,
    track: diurnalArc(s.date, s.lat, s.lon, 240),
    equatorTrack: celestialEquator(s.lat, 180),

    observer: { lat: s.lat, lon: s.lon },
    checkZ: angularDistance({ lat: s.lat, lon: s.lon }, gpTrue),
  };
}

/** Seconds-of-day for local apparent noon, for the timeline handle. */
export const lanSecond = (d) => (d.lan - state.date) / 1000;

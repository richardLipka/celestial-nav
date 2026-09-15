// One state object, one derive step, one notification. Every panel is a pure
// function of `derived`, which is the only way four views of the same instant
// stay honest with each other.

import { norm180 } from '../core/angles.js';
import { MS_HOUR, utcHours, addSeconds, chronometerError, daysBetween } from '../core/time.js';
import { solar, subsolar, decRateMinPerHour } from '../core/sun.js';
import { horizon, sensitivity, culmination, sunEvents, diurnalArc, celestialEquator } from '../core/horizon.js';
import { correct, uncorrect, defaultOptions } from '../core/corrections.js';
import { assumedGP, noonWorkUp, circleOfPosition, angularDistance, lineOfPosition } from '../core/fix.js';
import {
  observe, reduceLog, matchAltitudeTime, fixError, runningFix, roundAssumedPosition,
} from '../core/sights.js';
import { simulateVoyage, planPassage } from '../core/voyage.js';
import { routeById } from '../routes.js';
import {
  apparentGeometry, observeLunar, reduceLunar, usable as lunarUsable,
  distanceRate, longitudeFromLunar, costOfError,
} from '../core/lunars.js';
import { solarPrecise } from '../core/sun.js';
import { byId as scenarioById, applyScenario } from '../scenarios.js';

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
  lesson: null,                    // id of the running lesson, or null
  lessonStep: 0,
  lunarSights: [],                 // { id, t, jitter } -- the lunars taken
  lunarAverage: true,              // work up the mean of the log, as one would
  skyView: 'dome',                 // 'dome' for the geometry, 'sextant' for the instrument
  sextant: { armDeg: 0, roll: false },
  voyage: {
    routeId: 'trades',
    speedKts: 5,
    driftKts: 0.6,
    setDeg: 275,
    steeringBiasDeg: 2,
    carryChronometer: true,
    seed: 7,
  },
  show: { cop: true, lop: true, cross: true, equator: true, night: true, belowHorizon: true },
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
  if (moved) {
    state.sights = [];
    // A lunar records only the instant; its three readings are recomputed from
    // wherever the ship now is. Keeping the log across a move would silently
    // rewrite what the navigator saw.
    state.lunarSights = [];
  }
  render();
}

// --- the log ---------------------------------------------------------------

/** A reading error for one sight, drawn once and kept with it. */
function drawJitter() {
  // Two uniforms averaged: roughly normal, and never more than a minute out.
  return ((Math.random() + Math.random()) - 1) * 0.6;
}

/**
 * Log a sight at the instant currently on the timeline.
 *
 * Pass `byHand` when the altitude came off the sextant view: the error is then
 * the user's own, in arcminutes, rather than a draw from the noise model, and
 * the reading-error switch must leave it alone. Their mistake is not synthetic.
 */
export function addSight(at, byHand = null) {
  const t = at ?? derived.now;
  if (state.sights.some((s) => Math.abs(s.t - t) < 1000)) return false;
  state.sights = [
    ...state.sights,
    {
      id: nextSightId++,
      t: new Date(t),
      jitterMin: byHand === null ? drawJitter() : byHand,
      byHand: byHand !== null,
    },
  ];
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

// --- lunars ----------------------------------------------------------------
// A lunar is three simultaneous readings, not one, so its reading error is
// three independent draws. The distance is the one that matters: the other two
// only enter through the clearing, where they are worth a tenth as much.

let nextLunarId = 1;

export function addLunar(at) {
  const t = at ?? derived.now;
  if (state.lunarSights.some((g) => Math.abs(g.t - t) < 1000)) return false;
  state.lunarSights = [
    ...state.lunarSights,
    {
      id: nextLunarId++,
      t: new Date(t),
      jitter: { moonMin: drawJitter(), sunMin: drawJitter(), distMin: drawJitter() },
    },
  ];
  render();
  return true;
}

/**
 * A round of sights: several in quick succession, to be averaged.
 *
 * This is not a convenience, it is the practice. One lunar carries the
 * observer's reading error whole; five carry it divided by the root of five,
 * and the twenty minutes they take is nothing beside the four hours of
 * arithmetic waiting at the other end.
 */
export function addLunarRound(count = 5, spacingMin = 3) {
  const start = derived.now.getTime();
  let added = 0;
  for (let i = 0; i < count; i++) {
    if (addLunar(new Date(start + i * spacingMin * 60000))) added++;
  }
  return added;
}

export function removeLunar(id) {
  state.lunarSights = state.lunarSights.filter((g) => g.id !== id);
  render();
}

export function clearLunars() {
  state.lunarSights = [];
  render();
}

/** The state patch a scenario implies, so a lesson step can fold it into its own. */
export const applyScenarioPatch = (id) => applyScenario(scenarioById(id));

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
    +s.departureDate, s.clockErrorSec, s.clockRateSecPerDay, s.useEoT,
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
    useEoT: s.useEoT,
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
    Object.assign(
      observe(g.t, truth, opt, errorAt(g.t), g.byHand || s.sextantNoise ? g.jitterMin : 0),
      {
        id: g.id,
        byHand: !!g.byHand,
      },
    ),
  );
  const logResult = reduceLog(observations, { useEoT: s.useEoT });
  const logFix = logResult.stage === 'none' ? null : { lat: logResult.lat, lon: logResult.lon };
  const logError = logFix ? fixError(logFix, truth) : null;
  const logErrorByMax =
    logResult.stage === 'none' ? null : fixError({ lat: logResult.lat, lon: logResult.lonByMax }, truth);

  // Two sights crossed. The assumed position is a round figure near whatever
  // the log itself says -- which is what a navigator would have used, because
  // it is what made the tables easy.
  const cross =
    logResult.stage === 'none'
      ? { enough: false, count: 0 }
      : runningFix(observations, roundAssumedPosition({ lat: logResult.lat, lon: logResult.lon }),
          { useEoT: s.useEoT });
  const crossError = cross.fix ? fixError(cross.fix, truth) : null;

  // --- the lunar distance -------------------------------------------------
  // Same split as the sight log: the geometry knows where the ship is, the
  // reduction does not -- and here it does not even need to, which is the
  // whole point of the method.
  const lunarGeom = apparentGeometry(now, truth, s.eyeHeightM);
  const lunarOk = lunarUsable(now, truth);
  const lunarObs = s.lunarSights.map((g) =>
    Object.assign(
      observeLunar(g.t, truth, opt, errorAt(g.t), s.sextantNoise ? g.jitter : {}),
      { id: g.id },
    ),
  );
  const lunarWorkups = lunarObs.map((o) => ({ sight: o, r: reduceLunar(o) }));
  const solved = lunarWorkups.filter((w) => w.r.gmt);

  // What a lunar actually yields is not "the time now" -- each sight gives the
  // Greenwich time of the instant *it* was taken. What is constant across the
  // log is the watch's error, so that is what gets averaged. A lunar does not
  // replace the chronometer; it rates it, which is what they were for.
  const errors = solved.map((w) => w.r.watchErrorSec);
  const meanWatchError = errors.length
    ? errors.reduce((a, b) => a + b, 0) / errors.length
    : null;
  // Averaging is not a trick, it is the method: the reading error is random
  // and the ephemeris error is not, so a run of sights beats one sight by the
  // square root of their number and then stops improving.
  const usedWatchError = s.lunarAverage ? meanWatchError : errors.length ? errors[errors.length - 1] : null;

  const spreadSec = errors.length > 1 ? Math.max(...errors) - Math.min(...errors) : null;

  // Correct the watch by what the lunar says, and that is Greenwich time.
  const usedGmt = usedWatchError === null
    ? null
    : new Date(now.getTime() + clockErrorSec * 1000 - usedWatchError * 1000);

  // Local apparent time is the other half, and it comes from the sun in the
  // ordinary way -- the lunar alone is a clock, never a position.
  const localApparentHours = (utcHours(now) + (solarPrecise(now).eotDeg + s.lon) / 15 + 24) % 24;
  const lunarLon = usedGmt ? longitudeFromLunar(usedGmt, localApparentHours, s.useEoT) : null;

  return {
    opt,
    lunar: {
      geom: lunarGeom,
      usable: lunarOk,
      rate: distanceRate(now),
      sights: lunarObs,
      workups: lunarWorkups,
      gmt: usedGmt,
      watchErrorSec: usedWatchError,
      meanWatchError,
      spreadSec,
      errorSec: usedGmt ? (usedGmt - now) / 1000 : null,
      lon: lunarLon,
      lonErrorNm: lunarLon === null ? null : norm180(lunarLon - s.lon) * 60 * Math.cos((s.lat * Math.PI) / 180),
      cost: costOfError(1, now, s.lat),
    },
    voyage: runVoyage(s, opt),
    clockErrorSec, // the effective error now, not the departure figure
    errorAt,
    daysOut,
    observations,
    logResult,
    cross,
    crossError,
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


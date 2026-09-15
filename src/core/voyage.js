// A passage, day by day.
//
// Three positions are tracked and they are not the same thing:
//
//   truth     where the ship actually is -- the course it really made through
//             the water, plus whatever the current did to it
//   dr        where the log and the compass say it should be, run forward from
//             yesterday's belief
//   estimate  what the navigator actually writes in the book: the latitude
//             from today's noon sight, and the longitude from either the
//             chronometer or, failing that, the dead reckoning
//
// The navigator resets to the estimate every noon, which is what real practice
// did. With a chronometer that means the error never accumulates: it is wiped
// once a day. Without one, only the latitude is wiped, and the longitude error
// compounds for the whole passage. That asymmetry is the entire point.

import { norm180, norm360, degToNm, D2R } from './angles.js';
import { MS_DAY, chronometerError } from './time.js';
import { destination, angularDistance, initialBearing, noonWorkUp } from './fix.js';
import { fixError } from './sights.js';
import { defaultOptions } from './corrections.js';

/** Deterministic, so a voyage does not reshuffle itself on every render. */
export function seededRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Knots to degrees of great circle per day. */
export const dayRun = (knots) => (knots * 24) / 60;

/**
 * Rhumb-line sailing: the single compass course that gets you there.
 *
 * Not the great circle. A ship steers one course and holds it, which traces a
 * rhumb line, and on a Mercator chart that is a straight line -- which is what
 * Mercator was for. It is longer than the great circle, and that is the price
 * of not having to alter course every watch.
 */
export function rhumb(from, to) {
  const p1 = from.lat * D2R;
  const p2 = to.lat * D2R;
  const dl = norm180(to.lon - from.lon) * D2R;
  // Difference of stretched (Mercator) latitudes.
  const dPsi = Math.log(Math.tan(Math.PI / 4 + p2 / 2) / Math.tan(Math.PI / 4 + p1 / 2));
  const q = Math.abs(dPsi) > 1e-11 ? (p2 - p1) / dPsi : Math.cos(p1);
  return {
    courseDeg: norm360(Math.atan2(dl, dPsi) / D2R),
    distanceNm: degToNm(Math.hypot(p2 - p1, q * dl) / D2R),
  };
}

/** A course, and the days it would take, to sail from one place to another. */
export function planPassage(from, to, speedKts) {
  const r = rhumb(from, to);
  return {
    courseDeg: Math.round(r.courseDeg),
    distanceNm: r.distanceNm,
    days: Math.max(1, Math.round(r.distanceNm / 60 / dayRun(speedKts))),
  };
}

/**
 * Sail it.
 *
 * `carryChronometer: false` is the pre-Harrison case: the noon sight still
 * fixes the latitude every day, and the longitude is whatever the dead
 * reckoning says it is.
 */
export function simulateVoyage(cfg) {
  const {
    start,
    destination: dest = null,
    departureDate,
    days = 25,
    courseDeg = 250,
    speedKts = 5,
    setDeg = 0,
    driftKts = 0,
    steeringBiasDeg = 0,
    clockErrorSec = 0,
    clockRateSecPerDay = 0,
    carryChronometer = true,
    useEoT = true,
    steerToDestination = true,
    arrivalNm = 25,
    sightErrorMin = 0.5,
    seed = 1,
    corrections = defaultOptions(),
  } = cfg;

  const rnd = seededRandom(seed);
  let truth = { lat: start.lat, lon: start.lon };
  let estimate = { lat: start.lat, lon: start.lon };
  const legs = [];

  let arrived = false;

  for (let day = 1; day <= days; day++) {
    // The course is laid off from where the navigator *believes* the ship is.
    // That is the whole hinge of the passage: with a chronometer the belief is
    // right and the course corrects for the current, and without one the ship
    // is steered every day towards a harbour that is not where they think.
    const steer =
      steerToDestination && dest ? rhumb(estimate, dest).courseDeg : courseDeg;

    // What the ship really did: the course actually steered, then the current.
    const throughWater = destination(truth, steer + steeringBiasDeg, dayRun(speedKts));
    truth = driftKts ? destination(throughWater, setDeg, dayRun(driftKts)) : throughWater;

    // What the book says, run on from yesterday's belief rather than from
    // yesterday's dead reckoning -- the navigator resets at every fix.
    const dr = destination(estimate, steer, dayRun(speedKts));

    const date = new Date(departureDate.getTime() + day * MS_DAY);
    const clockError = chronometerError(departureDate, date, clockErrorSec, clockRateSecPerDay);

    const work = noonWorkUp(
      { lat: truth.lat, lon: truth.lon, date },
      { ...corrections, clockErrorSec: clockError, useEoT },
    );

    // A reading error of j arcminutes lands directly on the latitude: the
    // zenith distance is short by j, so phi = dec + z is short by j too.
    const jitterMin = (rnd() + rnd() - 1) * sightErrorMin;
    const sighted = {
      lat: work.fix.lat - (work.sunBearsSouth ? 1 : -1) * (jitterMin / 60),
      lon: work.fix.lon,
      Ho: work.Ho,
      usable: work.Ho > 5,
    };

    estimate = {
      lat: sighted.usable ? sighted.lat : dr.lat,
      lon: carryChronometer && sighted.usable ? sighted.lon : dr.lon,
    };

    legs.push({
      day,
      date,
      steer,
      truth: { ...truth },
      dr,
      sighted,
      estimate: { ...estimate },
      clockError,
      error: fixError(estimate, truth),
    });

    // The navigator calls landfall when the harbour ought to be in sight.
    if (dest && degToNm(angularDistance(estimate, dest)) < arrivalNm) {
      arrived = true;
      break;
    }
  }

  const out = {
    legs,
    start: { lat: start.lat, lon: start.lon },
    truth,
    estimate,
    error: fixError(estimate, truth),
    worstLatNm: legs.reduce((m, l) => Math.max(m, Math.abs(l.error.latNm)), 0),
    blindDays: legs.filter((l) => !l.sighted.usable).length,
  };

  if (dest) {
    out.destination = { lat: dest.lat, lon: dest.lon };
    // Two different questions: how far the ship really is from the harbour,
    // and how far the navigator believes it to be.
    out.truthToDestNm = degToNm(angularDistance(truth, dest));
    out.believedToDestNm = degToNm(angularDistance(estimate, dest));
    out.arrived = arrived;
    // Landfall is where the ship actually was on the day the navigator
    // expected to see land. Without a chronometer it can be a long way off.
    if (arrived) {
      out.landfall = { day: legs.length, offByNm: out.truthToDestNm, truth: { ...truth } };
    }
  }

  return out;
}

// Turning sights into positions -- and, more to the point, showing what each
// reduction depends on. The latitude reduction never touches a clock. The
// longitude reduction is nothing but a clock.

import {
  sind, cosd, asind, acosd, atan2d, norm180, norm360, degToNm,
} from './angles.js';
import { solar } from './sun.js';
import { horizon, culmination } from './horizon.js';
import { correct, uncorrect } from './corrections.js';
import { utcHours, addSeconds } from './time.js';

// --- Spherical helpers ----------------------------------------------------

const toVec = (p) => [
  cosd(p.lat) * cosd(p.lon),
  cosd(p.lat) * sind(p.lon),
  sind(p.lat),
];
const toLL = ([x, y, z]) => ({ lat: asind(z), lon: atan2d(y, x) });

/** Great-circle angular distance between two positions, in degrees. */
export const angularDistance = (a, b) =>
  acosd(sind(a.lat) * sind(b.lat) + cosd(a.lat) * cosd(b.lat) * cosd(b.lon - a.lon));

/** Initial great-circle bearing from a to b, degrees true. */
export const initialBearing = (a, b) =>
  norm360(
    atan2d(
      sind(b.lon - a.lon) * cosd(b.lat),
      cosd(a.lat) * sind(b.lat) - sind(a.lat) * cosd(b.lat) * cosd(b.lon - a.lon),
    ),
  );

/** The point `dist` degrees from `p` along bearing `brg`. */
export function destination(p, brg, dist) {
  const lat = asind(sind(p.lat) * cosd(dist) + cosd(p.lat) * sind(dist) * cosd(brg));
  const lon =
    p.lon + atan2d(sind(brg) * sind(dist) * cosd(p.lat), cosd(dist) - sind(p.lat) * sind(lat));
  return { lat, lon: norm180(lon) };
}

/** Points along the great circle from a to b, for drawing. */
export function greatCircle(a, b, steps = 64) {
  const va = toVec(a);
  const vb = toVec(b);
  const dot = Math.max(-1, Math.min(1, va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2]));
  const w = Math.acos(dot);
  if (w < 1e-9) return [a, b];
  const out = [];
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    const s1 = Math.sin((1 - f) * w) / Math.sin(w);
    const s2 = Math.sin(f * w) / Math.sin(w);
    out.push(toLL([0, 1, 2].map((k) => s1 * va[k] + s2 * vb[k])));
  }
  return out;
}

/**
 * The circle of equal altitude: every position from which the sun would show
 * the same altitude. One sight buys this circle and never a point.
 */
export function circleOfPosition(gp, zDeg, steps = 240) {
  const out = [];
  for (let i = 0; i <= steps; i++) out.push(destination(gp, (i * 360) / steps, zDeg));
  return out;
}

/**
 * The short stretch of that circle near the ship, promoted to a straight line.
 * It always runs at right angles to the sun's bearing -- which is the rule
 * that explains both halves of the problem at once.
 */
export function lineOfPosition(p, azimuth, halfLengthDeg = 4) {
  const brg = azimuth + 90;
  return [destination(p, brg + 180, halfLengthDeg), p, destination(p, brg, halfLengthDeg)];
}

// --- The two reductions ---------------------------------------------------

/**
 * Latitude by meridian altitude.
 *
 *   z = 90 - Ho,   lat = dec + z  (sun bearing south)
 *                  lat = dec - z  (sun bearing north)
 *
 * Note what is not in the signature: a time. The observation is self-timing --
 * you watch the altitude stop rising -- and the declination it needs is a
 * lookup by date.
 */
export function latitudeFromMeridian(Ho, dec, sunBearsSouth) {
  const z = 90 - Ho;
  return sunBearsSouth ? dec + z : dec - z;
}

/**
 * Longitude from the moment of local apparent noon.
 *
 *   lon = 15 deg/h * (12h - UT of LAN) - EoT
 *
 * Both arguments are things you must be told: one by a chronometer that has
 * held Greenwich time across an ocean, the other by an almanac.
 */
export const longitudeFromLAN = (utLanHours, eotDeg) =>
  norm180(15 * (12 - utLanHours) - eotDeg);

/** The GP a navigator would compute, given a clock that is `errSec` fast. */
export function assumedGP(trueDate, errSec, useEoT = true) {
  const believed = addSeconds(trueDate, errSec);
  const s = solar(believed);
  const gha = norm360(15 * (utcHours(believed) - 12) + (useEoT ? s.eotDeg : 0));
  return { lat: s.dec, lon: norm180(-gha), believed, solar: s };
}

/** Marcq St Hilaire: compare the sight against a guess and step toward the sun. */
export function intercept(assumedPos, gp, Ho) {
  const Hc = 90 - angularDistance(assumedPos, gp);
  const az = initialBearing(assumedPos, gp);
  const interceptNm = degToNm(Ho - Hc);
  return {
    Hc,
    az,
    interceptNm,
    toward: interceptNm >= 0,
    position: destination(assumedPos, interceptNm >= 0 ? az : az + 180, Math.abs(Ho - Hc)),
  };
}

// --- The whole day's work, both ways --------------------------------------

/**
 * What the navigator gets out of a noon sight, with an imperfect chronometer.
 *
 * The sight itself is taken at true local apparent noon, because the sun says
 * when that is. Everything after it is done with the clock the navigator has,
 * and the two results fail in spectacularly different ways.
 */
export function noonWorkUp(truth, opt = {}) {
  const { clockErrorSec = 0, useEoT = true } = opt;

  // The sun culminates when it culminates. Nature does not consult the
  // almanac, so this instant is always the true one -- `useEoT` is a fact
  // about the navigator's arithmetic, and it may only affect the reduction.
  const lanTrue = culmination(truth.date, truth.lon, true);
  const geom = horizon(truth.lat, truth.lon, lanTrue);

  // The sextant reading the navigator would actually take.
  const sdOpt = { ...opt, sdMin: geom.solar.sd };
  const Hs = uncorrect(geom.H, sdOpt);
  const c = correct(Hs, sdOpt);

  // The almanac, consulted at the time the navigator believes it to be.
  const believed = addSeconds(lanTrue, clockErrorSec);
  const sBelieved = solar(believed);

  const sunBearsSouth = geom.solar.dec < truth.lat;
  const latFix = latitudeFromMeridian(c.Ho, sBelieved.dec, sunBearsSouth);
  const lonFix = longitudeFromLAN(utcHours(believed), useEoT ? sBelieved.eotDeg : 0);

  const dLat = latFix - truth.lat;
  const dLon = norm180(lonFix - truth.lon);

  return {
    lanTrue,
    believed,
    Hs,
    corrections: c,
    Ho: c.Ho,
    z: 90 - c.Ho,
    dec: sBelieved.dec,
    eotMin: sBelieved.eotMin,
    sunBearsSouth,
    fix: { lat: latFix, lon: lonFix },
    error: {
      latDeg: dLat,
      lonDeg: dLon,
      latNm: degToNm(dLat),
      lonNm: degToNm(dLon) * cosd(truth.lat),
      totalNm: Math.hypot(degToNm(dLat), degToNm(dLon) * cosd(truth.lat)),
    },
  };
}

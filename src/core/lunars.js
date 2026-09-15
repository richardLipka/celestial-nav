// Lunar distances: the clock in the sky.
//
// The moon travels its own diameter against the background in about an hour.
// So the angle between the moon and the sun is a function of absolute time,
// and it is the same function everywhere on Earth. Measure that angle, look it
// up in a table computed for Greenwich, and you have Greenwich time — without
// a chronometer, without having carried anything across the ocean.
//
// That is the whole idea, and it is why the Board of Longitude spent decades
// funding Tobias Mayer's lunar tables alongside Harrison's watches.
//
// It also very nearly does not work, and this file is mostly about why.
//
//   The moon closes on the sun at about half a degree an hour. Half a degree
//   is thirty arcminutes; an hour is sixty minutes. So one arcminute of error
//   in the measured distance is two minutes of Greenwich time, and two minutes
//   of time is half a degree of longitude, which is thirty sea miles.
//
// A noon sight turns one arcminute of sextant error into one mile of latitude.
// A lunar turns it into thirty. Everything else here -- the arcsecond
// ephemeris, the clearing, the augmentation of the moon's semi-diameter --
// follows from that one ratio.
//
// The split of `sights.js` holds here too, and for the same reason:
// `observeLunar()` knows where the ship is, `reduceLunar()` does not.

import { sind, cosd, asind, acosd, atan2d, norm180, norm360 } from './angles.js';
import { lunar } from './moon.js';
import { solarPrecise } from './sun.js';
import { dip, refraction } from './corrections.js';
import { horizon } from './horizon.js';
import { MS_HOUR, utcHours } from './time.js';

/**
 * One arcminute of error in a cleared lunar distance, in minutes of Greenwich
 * time. The moon's mean motion relative to the sun is 0.5079 degrees an hour.
 */
export const MIN_OF_TIME_PER_ARCMIN = 60 / (0.5079 * 60);

/** And the same error in sea miles of longitude, on the equator. */
export const NM_PER_ARCMIN = MIN_OF_TIME_PER_ARCMIN * 15;

/** Below this elongation the two bodies are too close to get a sextant between. */
export const MIN_ELONGATION = 15;
/** And beyond this the sun is setting as the moon rises; you need a star instead. */
export const MAX_ELONGATION = 150;

/**
 * The true geocentric angle between the centres of the moon and the sun.
 *
 * This is the quantity the almanac tabulates. It depends on the instant and on
 * nothing else — not on where the observer is, which is exactly what makes it
 * a clock rather than a position line.
 */
export function geocentricDistance(date) {
  const m = lunar(date);
  const s = solarPrecise(date);
  return acosd(
    sind(m.beta) * sind(s.beta)
      + cosd(m.beta) * cosd(s.beta) * cosd(m.lam - s.lam),
  );
}

/** How fast that angle is changing, in arcminutes per minute of time. */
export function distanceRate(date, spanMin = 30) {
  const a = geocentricDistance(new Date(date.getTime() - spanMin * 30000));
  const b = geocentricDistance(new Date(date.getTime() + spanMin * 30000));
  return ((b - a) * 60) / spanMin;
}

/**
 * The moon's semi-diameter as seen from the ground rather than from the centre
 * of the Earth. Standing on the surface puts you up to one Earth radius nearer
 * the moon, so it looks bigger overhead than on the horizon — by about a third
 * of an arcminute, which at thirty miles per arcminute is ten miles.
 */
export const augmentedSD = (sdMin, hpMin, altDeg) =>
  sdMin * (1 + sind(altDeg) * sind(hpMin / 60));

/**
 * Parallax in altitude, done properly.
 *
 * `corrections.js` has the small-angle version, which is right for the sun.
 * The moon's parallax is a whole degree and the approximation costs an
 * arcminute at low altitudes — thirty miles.
 */
export const parallaxExact = (hpMin, HaDeg) =>
  asind(sind(hpMin / 60) * cosd(HaDeg)) * 60;

/**
 * The same quantity run the other way: how far a body at a known *geocentric*
 * altitude appears to be pushed down by the observer standing on the surface.
 *
 * These two are not the same function with the argument swapped, and treating
 * them as if they were is worth most of an arcminute for the moon — which is
 * half a minute of Greenwich time. From sin p = sin(HP) sin z' and z' = z + p,
 *
 *   tan p = sin(HP) sin z / (1 - sin(HP) cos z)
 *
 * with z the geocentric zenith distance. `parallaxExact` is its exact inverse,
 * which is what lets the reduction undo what the sky did.
 */
export function parallaxFromGeocentric(hpMin, hGeoDeg) {
  const z = 90 - hGeoDeg;
  const sinHP = sind(hpMin / 60);
  return atan2d(sinHP * sind(z), 1 - sinHP * cosd(z)) * 60;
}

/**
 * Refraction is tabulated against the altitude you *see*, so going the other
 * way -- from where a body really is to where it appears -- is an inversion.
 * Two passes are ample: refraction changes by under a tenth of its own size
 * over the distance it moves anything.
 */
export function refractionToApparent(hTopoDeg) {
  let app = hTopoDeg + refraction(hTopoDeg) / 60;
  for (let i = 0; i < 3; i++) app = hTopoDeg + refraction(app) / 60;
  return app;
}

/**
 * Clearing the distance.
 *
 * The measured distance is wrong twice over: refraction lifts both bodies
 * toward the zenith, and parallax drops the moon away from it by a degree.
 * Both act straight up and down along the vertical circle through each body,
 * which means neither of them changes the *angle at the zenith* between the
 * two bodies. That is the hinge the whole method turns on.
 *
 * So write the spherical triangle zenith-moon-sun twice, once with the
 * apparent altitudes and once with the true ones, and eliminate the common
 * zenith angle between them:
 *
 *   cos D = sin h_m sin h_s + (cos h_m cos h_s / cos h_m' cos h_s')
 *                             (cos D' - sin h_m' sin h_s')
 *
 * This is exact — it is not a series, and it has no small-angle assumption in
 * it. The eighteenth century could not use it, because clearing a distance
 * this way needs five-figure logarithms and twenty minutes; the tables and
 * approximations they did use are the reason a lunar was an afternoon's work.
 */
export function clearDistance({ appDist, appMoonAlt, appSunAlt, trueMoonAlt, trueSunAlt }) {
  const num = cosd(appDist) - sind(appMoonAlt) * sind(appSunAlt);
  const den = cosd(appMoonAlt) * cosd(appSunAlt);
  const cosZ = den === 0 ? 0 : num / den;
  return acosd(
    sind(trueMoonAlt) * sind(trueSunAlt) + cosd(trueMoonAlt) * cosd(trueSunAlt) * cosZ,
  );
}

/**
 * What the two bodies actually look like from a given place at a given
 * instant: apparent (refracted, topocentric) altitudes and the apparent
 * centre-to-centre distance between them.
 *
 * This is the forward problem. It knows the position, so nothing in the
 * reduction may call it.
 */
export function apparentGeometry(date, pos, eyeHeightM = 3) {
  const m = lunar(date);
  const s = solarPrecise(date);
  const hm = horizon(pos.lat, pos.lon, date);

  // Geocentric altitudes first, from each body's own hour angle.
  const lhaMoon = norm180(m.gha + pos.lon);
  const lhaSun = norm180(s.gha + pos.lon);
  const trueMoonAlt = altitudeOf(pos, m.dec, lhaMoon);
  const trueSunAlt = altitudeOf(pos, s.dec, lhaSun);
  // Azimuth is untouched by parallax and refraction, both of which act
  // straight up and down -- which is the same fact the clearing rests on.
  const moonAz = azimuthOf(pos, m.dec, lhaMoon);
  const sunAz = azimuthOf(pos, s.dec, lhaSun);

  // Parallax pushes the moon down from its geocentric place; the air then
  // lifts what is left back up. In that order, and each with the argument its
  // own formula is defined for -- the reduction has to be able to undo this
  // step for step, or the whole method leaks half an arcminute.
  const moonTopo = trueMoonAlt - parallaxFromGeocentric(m.hp, trueMoonAlt) / 60;
  const sunTopo = trueSunAlt - parallaxFromGeocentric(s.hp, trueSunAlt) / 60;
  const appMoonAlt = refractionToApparent(moonTopo);
  const appSunAlt = refractionToApparent(sunTopo);

  // The apparent distance follows from the same zenith angle, run the other
  // way: the true distance and the true altitudes give it, and it is preserved
  // through both corrections.
  const trueDist = geocentricDistance(date);
  const cosZ = zenithAngleCos(trueDist, trueMoonAlt, trueSunAlt);
  const appDist = acosd(
    sind(appMoonAlt) * sind(appSunAlt) + cosd(appMoonAlt) * cosd(appSunAlt) * cosZ,
  );

  return {
    moon: m,
    sun: s,
    sky: hm,
    trueMoonAlt,
    trueSunAlt,
    appMoonAlt,
    appSunAlt,
    moonAz,
    sunAz,
    lhaMoon,
    lhaSun,
    trueDist,
    appDist,
    dipMin: dip(eyeHeightM),
    sdMoon: augmentedSD(m.sd, m.hp, appMoonAlt),
    sdSun: s.sd,
  };
}

const zenithAngleCos = (dist, h1, h2) => {
  const den = cosd(h1) * cosd(h2);
  return den === 0 ? 0 : (cosd(dist) - sind(h1) * sind(h2)) / den;
};

/** Altitude of a body from its declination and local hour angle. */
const altitudeOf = (pos, dec, lha) =>
  asind(sind(pos.lat) * sind(dec) + cosd(pos.lat) * cosd(dec) * cosd(lha));

/** And its azimuth, which the figure needs to draw the arc between them. */
const azimuthOf = (pos, dec, lha) =>
  norm360(
    atan2d(
      -cosd(dec) * sind(lha),
      sind(dec) * cosd(pos.lat) - cosd(dec) * sind(pos.lat) * cosd(lha),
    ),
  );

/**
 * Take the sight.
 *
 * Three readings, all off the same instrument: the moon's altitude, the sun's
 * altitude, and the distance between their near limbs. In a real ship this
 * took three people, because all three have to be simultaneous — the distance
 * is changing at half a degree an hour and the altitudes faster than that.
 *
 * `jitterMin` is the observer's error, drawn once and kept, exactly as in
 * `sights.js`. It is applied to all three readings independently, because it
 * is three separate acts of bringing two things together.
 */
export function observeLunar(t, truth, opt = {}, clockErrorSec = 0, jitter = {}) {
  const eye = opt.eyeHeightM ?? 3;
  const g = apparentGeometry(t, truth, eye);
  const d = g.dipMin;

  // Hs is what the arc reads: apparent altitude of the limb, plus dip, less
  // the index error. The lower limb for both bodies, as one would.
  const HsMoon = g.appMoonAlt - g.sdMoon / 60 + d / 60 + (jitter.moonMin ?? 0) / 60;
  const HsSun = g.appSunAlt - g.sdSun / 60 + d / 60 + (jitter.sunMin ?? 0) / 60;

  // The distance is measured near limb to near limb, so it is short of the
  // centre-to-centre angle by both semi-diameters. Dip does not enter: neither
  // end of this angle is the horizon.
  const Dsextant = g.appDist - (g.sdMoon + g.sdSun) / 60 + (jitter.distMin ?? 0) / 60;

  return {
    t,
    tChrono: new Date(t.getTime() + clockErrorSec * 1000),
    HsMoon,
    HsSun,
    Dsextant,
    eyeHeightM: eye,
    elongation: g.trueDist,
    // Kept for the display only; the reduction may not look at these.
    truth: { appDist: g.appDist, trueDist: g.trueDist, moonAlt: g.appMoonAlt, sunAlt: g.appSunAlt },
  };
}

/**
 * Work the sight up into a Greenwich time.
 *
 * Sees the three readings, the date, and the almanac. Not the position — and
 * note that it does not need one: unlike every other sight in this program, a
 * lunar distance is not a position line at all. It is a clock reading.
 */
export function reduceLunar(sight, { eyeHeightM = null, searchHours = 8 } = {}) {
  const eye = eyeHeightM ?? sight.eyeHeightM ?? 3;
  const d = dip(eye);

  // The almanac is a function of time, and the time is what we are trying to
  // find -- so start from the watch, however wrong it is, and let the answer
  // come out of the distance rather than out of the clock. The semi-diameters
  // and parallax change far too slowly for the difference to matter.
  const approx = sight.tChrono;
  const m = lunar(approx);
  const s = solarPrecise(approx);

  // Altitudes: off the arc, down by dip, up by semi-diameter to the centre.
  const HaMoonLimb = sight.HsMoon - d / 60;
  const HaSunLimb = sight.HsSun - d / 60;
  const sdMoon = augmentedSD(m.sd, m.hp, HaMoonLimb + m.sd / 60);
  const appMoonAlt = HaMoonLimb + sdMoon / 60;
  const appSunAlt = HaSunLimb + s.sd / 60;

  // And down again to the geocentric altitudes, which is where refraction and
  // parallax finally part company: one is the air, the other is the baseline.
  const refrMoon = refraction(appMoonAlt);
  const refrSun = refraction(appSunAlt);
  const parMoon = parallaxExact(m.hp, appMoonAlt - refrMoon / 60);
  const parSun = parallaxExact(s.hp, appSunAlt - refrSun / 60);
  const trueMoonAlt = appMoonAlt - refrMoon / 60 + parMoon / 60;
  const trueSunAlt = appSunAlt - refrSun / 60 + parSun / 60;

  // The measured distance, brought to centre to centre.
  const appDist = sight.Dsextant + (sdMoon + s.sd) / 60;

  const cleared = clearDistance({
    appDist, appMoonAlt, appSunAlt, trueMoonAlt, trueSunAlt,
  });

  const gmt = timeFromDistance(cleared, approx, searchHours);
  const rate = distanceRate(gmt ?? approx);

  return {
    d,
    sdMoon,
    sdSun: s.sd,
    hpMoon: m.hp,
    refrMoon,
    refrSun,
    parMoon,
    parSun,
    appMoonAlt,
    appSunAlt,
    trueMoonAlt,
    trueSunAlt,
    appDist,
    cleared,
    // How much of the correction was parallax and refraction: the difference
    // between what the sextant read and what the almanac can be asked about.
    clearedBy: (cleared - appDist) * 60,
    gmt,
    rate,
    watchErrorSec: gmt ? (sight.tChrono - gmt) / 1000 : null,
  };
}

/**
 * Invert the almanac: at what instant was the geocentric distance this?
 *
 * Scan for a bracket, then bisect. The distance is monotonic in time except at
 * new and full moon, where it turns around — which is one of the several
 * reasons a lunar cannot be taken at any old moment.
 */
export function timeFromDistance(distDeg, near, windowHours = 8, stepMin = 20) {
  const f = (ms) => geocentricDistance(new Date(ms)) - distDeg;
  const t0 = near.getTime();
  const step = stepMin * 60000;
  const n = Math.ceil((windowHours * 60) / stepMin);

  let a = t0 - n * step;
  let fa = f(a);
  for (let i = -n + 1; i <= n; i++) {
    const b = t0 + i * step;
    const fb = f(b);
    if (fa === 0) return new Date(a);
    if ((fa < 0) !== (fb < 0)) {
      // Bisect to a tenth of a second; the whole point is that seconds matter.
      let lo = a;
      let hi = b;
      let flo = fa;
      for (let k = 0; k < 60 && hi - lo > 100; k++) {
        const mid = (lo + hi) / 2;
        const fm = f(mid);
        if ((flo < 0) === (fm < 0)) { lo = mid; flo = fm; } else { hi = mid; }
      }
      return new Date((lo + hi) / 2);
    }
    a = b;
    fa = fb;
  }
  return null;
}

/**
 * Longitude, finally.
 *
 * The lunar gives Greenwich time. It says nothing whatever about where you
 * are. To turn it into a longitude you still need the local time — from the
 * sun, in the ordinary way — and the longitude is the difference between them.
 * Two separate observations, and the lunar is the hard one.
 */
export function longitudeFromLunar(gmt, localApparentHours, useEoT = true) {
  const s = solarPrecise(gmt);
  const greenwichApparent = utcHours(gmt) + (useEoT ? s.eotDeg / 15 : 0);
  return norm180(15 * (localApparentHours - greenwichApparent));
}

/**
 * The error budget, which is the lesson.
 *
 * Give it an error in the cleared distance in arcminutes and it says what that
 * is worth in Greenwich time and in longitude at a given latitude.
 */
export function costOfError(arcminutes, atDate = null, latDeg = 0) {
  const rate = atDate ? Math.abs(distanceRate(atDate)) : 0.5079;
  const minutesOfTime = arcminutes / rate;
  const degOfLongitude = (minutesOfTime / 60) * 15;
  return {
    rate,
    minutesOfTime,
    degOfLongitude,
    nm: degOfLongitude * 60 * cosd(latDeg),
  };
}

/** Whether a lunar can be taken at all at this instant, and if not, why. */
export function usable(date, pos) {
  const dist = geocentricDistance(date);
  const g = apparentGeometry(date, pos);
  if (dist < MIN_ELONGATION) return { ok: false, reason: 'tooClose', dist };
  if (dist > MAX_ELONGATION) return { ok: false, reason: 'tooFar', dist };
  if (g.appMoonAlt < 5) return { ok: false, reason: 'moonLow', dist };
  if (g.appSunAlt < 5) return { ok: false, reason: 'sunLow', dist };
  return { ok: true, dist };
}

export const HOUR = MS_HOUR;

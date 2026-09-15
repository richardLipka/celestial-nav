// The moon's position — and why this file is so much longer than sun.js.
//
// The sun needs thirty lines to reach half an arcminute. The moon does not.
// It is close enough that the Earth's and the sun's pull on it are of the same
// order, so its orbit is perturbed by everything: the ellipse breathes, the
// line of apsides turns, the plane wobbles. There is no short series.
//
// This is ELP-2000/82 truncated to the terms Meeus keeps (Astronomical
// Algorithms, ch. 47): 60 periodic terms in longitude and distance, 60 in
// latitude. It is good to about 10 arcseconds in longitude and 4 in latitude,
// which is what a lunar distance needs — see `lunars.js` for why nothing
// coarser will do.
//
// The tables are the file. They are checked in `moon.test.js` against an
// independent ephemeris, because a single mistyped coefficient here would be
// invisible on screen and wrong by miles at sea.

import { sind, cosd, asind, atan2d, norm360, norm180 } from './angles.js';
import { julianCenturies, julianDay, J2000, terrestrialTime, utcHours } from './time.js';
import { nutationInLongitude, trueObliquity } from './nutation.js';

// Earth's equatorial radius, km — the baseline for horizontal parallax.
const EARTH_RADIUS_KM = 6378.14;

/**
 * Periodic terms for longitude and distance (Meeus table 47.A).
 * Columns: D, M, M', F, then the coefficient of sine for Σl in units of
 * 1e-6 degrees, and of cosine for Σr in units of 1e-3 km.
 */
const TERMS_LR = [
  [0, 0, 1, 0, 6288774, -20905355],
  [2, 0, -1, 0, 1274027, -3699111],
  [2, 0, 0, 0, 658314, -2955968],
  [0, 0, 2, 0, 213618, -569925],
  [0, 1, 0, 0, -185116, 48888],
  [0, 0, 0, 2, -114332, -3149],
  [2, 0, -2, 0, 58793, 246158],
  [2, -1, -1, 0, 57066, -152138],
  [2, 0, 1, 0, 53322, -170733],
  [2, -1, 0, 0, 45758, -204586],
  [0, 1, -1, 0, -40923, -129620],
  [1, 0, 0, 0, -34720, 108743],
  [0, 1, 1, 0, -30383, 104755],
  [2, 0, 0, -2, 15327, 10321],
  [0, 0, 1, 2, -12528, 0],
  [0, 0, 1, -2, 10980, 79661],
  [4, 0, -1, 0, 10675, -34782],
  [0, 0, 3, 0, 10034, -23210],
  [4, 0, -2, 0, 8548, -21636],
  [2, 1, -1, 0, -7888, 24208],
  [2, 1, 0, 0, -6766, 30824],
  [1, 0, -1, 0, -5163, -8379],
  [1, 1, 0, 0, 4987, -16675],
  [2, -1, 1, 0, 4036, -12831],
  [2, 0, 2, 0, 3994, -10445],
  [4, 0, 0, 0, 3861, -11650],
  [2, 0, -3, 0, 3665, 14403],
  [0, 1, -2, 0, -2689, -7003],
  [2, 0, -1, 2, -2602, 0],
  [2, -1, -2, 0, 2390, 10056],
  [1, 0, 1, 0, -2348, 6322],
  [2, -2, 0, 0, 2236, -9884],
  [0, 1, 2, 0, -2120, 5751],
  [0, 2, 0, 0, -2069, 0],
  [2, -2, -1, 0, 2048, -4950],
  [2, 0, 1, -2, -1773, 4130],
  [2, 0, 0, 2, -1595, 0],
  [4, -1, -1, 0, 1215, -3958],
  [0, 0, 2, 2, -1110, 0],
  [3, 0, -1, 0, -892, 3258],
  [2, 1, 1, 0, -810, 2616],
  [4, -1, -2, 0, 759, -1897],
  [0, 2, -1, 0, -713, -2117],
  [2, 2, -1, 0, -700, 2354],
  [2, 1, -2, 0, 691, 0],
  [2, -1, 0, -2, 596, 0],
  [4, 0, 1, 0, 549, -1423],
  [0, 0, 4, 0, 537, -1117],
  [4, -1, 0, 0, 520, -1571],
  [1, 0, -2, 0, -487, -1739],
  [2, 1, 0, -2, -399, 0],
  [0, 0, 2, -2, -381, -4421],
  [1, 1, 1, 0, 351, 0],
  [3, 0, -2, 0, -340, 0],
  [4, 0, -3, 0, 330, 0],
  [2, -1, 2, 0, 327, 0],
  [0, 2, 1, 0, -323, 1165],
  [1, 1, -1, 0, 299, 0],
  [2, 0, 3, 0, 294, 0],
  [2, 0, -1, -2, 0, 8752],
];

/**
 * Periodic terms for latitude (Meeus table 47.B).
 * Columns: D, M, M', F, coefficient of sine for Σb in 1e-6 degrees.
 */
const TERMS_B = [
  [0, 0, 0, 1, 5128122],
  [0, 0, 1, 1, 280602],
  [0, 0, 1, -1, 277693],
  [2, 0, 0, -1, 173237],
  [2, 0, -1, 1, 55413],
  [2, 0, -1, -1, 46271],
  [2, 0, 0, 1, 32573],
  [0, 0, 2, 1, 17198],
  [2, 0, 1, -1, 9266],
  [0, 0, 2, -1, 8822],
  [2, -1, 0, -1, 8216],
  [2, 0, -2, -1, 4324],
  [2, 0, 1, 1, 4200],
  [2, 1, 0, -1, -3359],
  [2, -1, -1, 1, 2463],
  [2, -1, 0, 1, 2211],
  [2, -1, -1, -1, 2065],
  [0, 1, -1, -1, -1870],
  [4, 0, -1, -1, 1828],
  [0, 1, 0, 1, -1794],
  [0, 0, 0, 3, -1749],
  [0, 1, -1, 1, -1565],
  [1, 0, 0, 1, -1491],
  [0, 1, 1, 1, -1475],
  [0, 1, 1, -1, -1410],
  [0, 1, 0, -1, -1344],
  [1, 0, 0, -1, -1335],
  [0, 0, 3, 1, 1107],
  [4, 0, 0, -1, 1021],
  [4, 0, -1, 1, 833],
  [0, 0, 1, -3, 777],
  [4, 0, -2, 1, 671],
  [2, 0, 0, -3, 607],
  [2, 0, 2, -1, 596],
  [2, -1, 1, -1, 491],
  [2, 0, -2, 1, -451],
  [0, 0, 3, -1, 439],
  [2, 0, 2, 1, 422],
  [2, 0, -3, -1, 421],
  [2, 1, -1, 1, -366],
  [2, 1, 0, 1, -351],
  [4, 0, 0, 1, 331],
  [2, -1, 1, 1, 315],
  [2, -2, 0, -1, 302],
  [0, 0, 1, 3, -283],
  [2, 1, 1, -1, -229],
  [1, 1, 0, -1, 223],
  [1, 1, 0, 1, 223],
  [0, 1, -2, -1, -220],
  [2, 1, -1, -1, -220],
  [1, 0, 1, 1, -185],
  [2, -1, -2, -1, 181],
  [0, 1, 2, 1, -177],
  [4, 0, -2, -1, 176],
  [4, -1, -1, -1, 166],
  [1, 0, 1, -1, -164],
  [4, 0, 1, -1, 132],
  [1, 0, -1, -1, -119],
  [4, -1, 0, -1, 115],
  [2, -2, 0, 1, 107],
];

/**
 * The moon's geocentric position at one instant.
 *
 *   lam   apparent ecliptic longitude, degrees
 *   beta  ecliptic latitude, degrees
 *   distKm distance centre to centre
 *   ra, dec, gha  the equatorial position, as for the sun
 *   hp    equatorial horizontal parallax, arcminutes — the moon's great
 *         distinguishing correction, around 57'
 *   sd    semi-diameter, arcminutes, from that same distance
 */
export function lunar(date) {
  // The series runs on dynamical time. Everything else in this program runs
  // on UT, because that is what a chronometer keeps, so the conversion
  // happens here and nowhere else.
  const T = julianCenturies(terrestrialTime(date));
  const T2 = T * T;
  const T3 = T2 * T;
  const T4 = T3 * T;

  // Mean elements. L' is the moon's own mean longitude; D its elongation from
  // the sun; M and M' the two mean anomalies; F the argument of latitude,
  // which is what carries it above and below the ecliptic.
  const Lp = norm360(218.3164477 + 481267.88123421 * T - 0.0015786 * T2 + T3 / 538841 - T4 / 65194000);
  const D = norm360(297.8501921 + 445267.1114034 * T - 0.0018819 * T2 + T3 / 545868 - T4 / 113065000);
  const M = norm360(357.5291092 + 35999.0502909 * T - 0.0001536 * T2 + T3 / 24490000);
  const Mp = norm360(134.9633964 + 477198.8675055 * T + 0.0087414 * T2 + T3 / 69699 - T4 / 14712000);
  const F = norm360(93.2720950 + 483202.0175233 * T - 0.0036539 * T2 - T3 / 3526000 + T4 / 863310000);

  // Three further arguments, standing in for perturbations by Venus and
  // Jupiter and for the flattening of the Earth.
  const A1 = norm360(119.75 + 131.849 * T);
  const A2 = norm360(53.09 + 479264.290 * T);
  const A3 = norm360(313.45 + 481266.484 * T);

  // The Earth's orbit is slowly becoming less eccentric, and every term that
  // depends on the sun's anomaly has to be scaled for it.
  const E = 1 - 0.002516 * T - 0.0000074 * T2;
  const eFactor = (m) => (m === 0 ? 1 : Math.abs(m) === 1 ? E : E * E);

  let sumL = 0;
  let sumR = 0;
  for (const [d, m, mp, f, cl, cr] of TERMS_LR) {
    const arg = d * D + m * M + mp * Mp + f * F;
    const e = eFactor(m);
    sumL += cl * e * sind(arg);
    sumR += cr * e * cosd(arg);
  }

  let sumB = 0;
  for (const [d, m, mp, f, cb] of TERMS_B) {
    const arg = d * D + m * M + mp * Mp + f * F;
    sumB += cb * eFactor(m) * sind(arg);
  }

  sumL += 3958 * sind(A1) + 1962 * sind(Lp - F) + 318 * sind(A2);
  sumB += -2235 * sind(Lp)
    + 382 * sind(A3)
    + 175 * sind(A1 - F)
    + 175 * sind(A1 + F)
    + 127 * sind(Lp - Mp)
    - 115 * sind(Lp + Mp);

  // The series gives the mean equinox of date; a sight is referred to the true
  // one, so the nod goes on here. It cancels out of the moon-to-sun distance
  // and does not cancel out of either body's own place in the sky.
  const lam = norm360(Lp + sumL / 1e6 + nutationInLongitude(date));
  const beta = sumB / 1e6;
  const distKm = 385000.56 + sumR / 1000;

  const eps = trueObliquity(date);

  const dec = asind(sind(beta) * cosd(eps) + cosd(beta) * sind(eps) * sind(lam));
  const ra = norm360(
    atan2d(sind(lam) * cosd(eps) - tanOf(beta) * sind(eps), cosd(lam)),
  );

  // The moon runs on sidereal time like every other body outside the solar
  // system's centre: GHA = GHA of Aries minus right ascension.
  const gha = norm360(greenwichSiderealDeg(date) - ra);

  const hp = asind(EARTH_RADIUS_KM / distKm) * 60;
  // The moon's radius is 0.2725 of the Earth's, which is where the familiar
  // ratio between semi-diameter and horizontal parallax comes from.
  const sd = asind((0.2725 * EARTH_RADIUS_KM) / distKm) * 60;

  return { T, Lp, D, M, Mp, F, E, lam, beta, distKm, eps, ra, dec, gha, hp, sd };
}

const tanOf = (deg) => sind(deg) / cosd(deg);

/**
 * Greenwich *apparent* sidereal time, in degrees. Meeus (12.4) for the mean
 * value, plus the equation of the equinoxes.
 *
 * The equation of the equinoxes is the nutation in longitude projected on to
 * the equator, and it has to be here: the right ascension it is subtracted
 * from is referred to the true equinox of date, because `lunar()` nutates the
 * longitude. Mean sidereal time against a true right ascension would be
 * sixteen arcseconds of hour angle out of step with itself — a third of an
 * arcminute on the moon's place in the sky, which is not a rounding error at
 * the precision a lunar distance works to.
 */
export function greenwichSiderealDeg(date) {
  const T = julianCenturies(date);
  const gmst = 280.46061837
    + 360.98564736629 * (julianDay(date) - J2000)
    + 0.000387933 * T * T
    - (T * T * T) / 38710000;
  const equationOfTheEquinoxes = nutationInLongitude(date) * cosd(trueObliquity(date));
  return norm360(gmst + equationOfTheEquinoxes);
}

/** The point on Earth with the moon directly overhead. */
export function sublunar(date) {
  const m = lunar(date);
  return { lat: m.dec, lon: norm180(-m.gha) };
}

/**
 * How fast the moon is moving against the background, in arcminutes per hour
 * of its own ecliptic longitude. About 33 — half a degree an hour, which is
 * the whole reason a lunar distance can serve as a clock.
 */
export function motionMinPerHour(date) {
  const a = lunar(new Date(date.getTime() - 1800000)).lam;
  const b = lunar(new Date(date.getTime() + 1800000)).lam;
  return norm180(b - a) * 60;
}

/** Age of the moon in days since the last new moon, and its illuminated fraction. */
export function phase(date) {
  const m = lunar(date);
  const elong = norm360(m.lam - sunLongitude(date));
  return {
    elongation: elong,
    // The terminator is a cosine: 0 at new, 1 at full.
    illuminated: (1 - cosd(elong)) / 2,
    ageDays: (elong / 360) * 29.530588,
  };
}

/** The sun's apparent longitude, to the accuracy a lunar needs. See sun.js. */
function sunLongitude(date) {
  const T = julianCenturies(date);
  const L0 = norm360(280.46646 + 36000.76983 * T + 0.0003032 * T * T);
  const M = norm360(357.52911 + 35999.05029 * T - 0.0001537 * T * T);
  const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * sind(M)
    + (0.019993 - 0.000101 * T) * sind(2 * M)
    + 0.000289 * sind(3 * M);
  return norm360(L0 + C);
}

/** Hours of UT, kept here so callers need not reach into time.js for it. */
export const utHours = utcHours;

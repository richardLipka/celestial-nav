// From the GP to the observer's horizon: altitude, azimuth, and the one
// derivative that explains the whole project.

import { sind, cosd, asind, acosd, atan2d, norm360, norm180 } from './angles.js';
import { solar } from './sun.js';
import { atHours, MS_HOUR } from './time.js';

/**
 * Where the sun stands for an observer at (lat, lon) at a given instant.
 * `lha` is wrapped to (-180, 180], so its sign says morning or afternoon and
 * its magnitude says how far from local apparent noon.
 */
export function horizon(lat, lon, date) {
  const s = solar(date);
  const lha = norm180(s.gha + lon);
  const { H, Az } = altAz(lat, s.dec, lha);
  return { H, Az, lha, z: 90 - H, solar: s };
}

/**
 * Where a body of this declination and this hour angle stands in this
 * observer's sky. Everything on the theory tab is one call to this or
 * another, and it lives here so that there is only ever one of it.
 *
 * Works from either hemisphere with the latitude carrying its own sign: at
 * 34 S a body on the meridian with zero declination bears north, and this
 * says so without being told which half of the world it is in.
 */
export function altAz(lat, dec, lha) {
  return {
    H: asind(sind(lat) * sind(dec) + cosd(lat) * cosd(dec) * cosd(lha)),
    Az: norm360(
      atan2d(
        -cosd(dec) * sind(lha),
        sind(dec) * cosd(lat) - cosd(dec) * sind(lat) * cosd(lha),
      ),
    ),
  };
}

/**
 * An hour circle in this observer's sky: the half great circle of one fixed
 * hour angle, running from one celestial pole to the other.
 *
 * Greenwich's own is the one at the hour angle of the observer's longitude --
 * a point over Greenwich has, by the definition of the thing, a Greenwich
 * hour angle of zero, so its *local* hour angle is the longitude itself. Draw
 * it beside the observer's own meridian and the angle between the two, at the
 * pole, is the longitude, which is otherwise a number with nothing to see.
 */
export function hourCircle(lat, lha, steps = 72) {
  const out = [];
  for (let i = 0; i <= steps; i++) out.push(altAz(lat, -90 + (i * 180) / steps, lha));
  return out;
}

/**
 * dH/dLHA = cos(lat) * sin(Az) -- degrees of altitude per degree of hour angle.
 *
 * This single expression is the answer to "why is one easy and the other
 * impossible without a clock". A clock error displaces the GP along its
 * parallel; how much of that displacement reaches your line of position
 * depends entirely on the azimuth:
 *
 *   Az = 000 or 180 (the meridian)        sin Az = 0   the sight ignores the clock
 *   Az = 090 or 270 (the prime vertical)  |sin Az| = 1 the sight is all clock
 */
export const sensitivity = (lat, Az) => cosd(lat) * sind(Az);

/**
 * Nautical miles of position error per second of chronometer error, for a
 * sight on the prime vertical: 60 nm per degree, at 15 degrees per hour,
 * over 3600 seconds. Four seconds of clock error is a mile at the equator.
 */
export const NM_PER_CLOCK_SECOND = 0.25;

/**
 * The instant of local apparent noon on the calendar day of `date`. Solved
 * directly -- LHA = 0 gives UT = 12 - (lon + EoT)/15 -- and then iterated,
 * because EoT itself drifts across the day.
 */
export function culmination(date, lon, useEoT = true) {
  let t = atHours(date, 12);
  for (let i = 0; i < 5; i++) {
    const eot = useEoT ? solar(t).eotDeg : 0;
    t = atHours(date, 12 - (lon + eot) / 15);
  }
  return t;
}

/**
 * Sunrise and sunset, at the conventional -0.833 degrees: 34.5 arcminutes of
 * horizontal refraction plus the sun's 16 arcminute semi-diameter, because
 * what you watch touch the horizon is the upper limb of a lifted image.
 *
 * Solved separately for rise and for set, and iterated. The obvious version
 * takes the declination at noon and uses it for both, but the crossings are
 * six hours either side and the declination has moved between them -- worth
 * over a minute at 64 degrees, and asymmetric, which is exactly the sort of
 * error that looks like a bug in the drawing rather than in the arithmetic.
 */
export function sunEvents(date, lat, lon) {
  const noon = culmination(date, lon);

  /** Hours of hour angle from noon to the -0.833 crossing, for the sun at `at`. */
  const semiArc = (at) => {
    const s = solar(at);
    const c = (sind(-0.833) - sind(lat) * sind(s.dec)) / (cosd(lat) * cosd(s.dec));
    if (c >= 1) return { polar: 'night' };
    if (c <= -1) return { polar: 'day' };
    return { h0: acosd(c) / 15 };
  };

  const first = semiArc(noon);
  if (first.polar) return { noon, polar: first.polar };

  // Solved the same way culmination is, and for the same reason: the apparent
  // sun's hour angle does not advance at a flat 15 degrees an hour -- the
  // equation of time drifts underneath it. Stepping `h0` hours from noon
  // ignores that, and at the equator, where the sun crosses the horizon almost
  // vertically, it is worth a couple of arcminutes.
  //
  //   LHA = 15(UT - 12) + EoT + lon = +/- 15 h0
  //   =>  UT = 12 + (+/- 15 h0 - EoT - lon) / 15
  const solve = (sign) => {
    let t = noon;
    for (let i = 0; i < 4; i++) {
      const r = semiArc(t);
      if (r.polar) return null; // the sun stopped rising or setting mid-solve
      t = atHours(date, 12 + (sign * r.h0 * 15 - solar(t).eotDeg - lon) / 15);
    }
    return t;
  };

  const rise = solve(-1);
  const set = solve(1);
  if (!rise || !set) return { noon, polar: first.polar ?? 'day' };
  return { noon, rise, set };
}

/** The sun's whole track for one day, for drawing the diurnal arc. */
export function diurnalArc(date, lat, lon, steps = 288) {
  const noon = culmination(date, lon);
  const out = [];
  for (let i = 0; i <= steps; i++) {
    const t = new Date(noon.getTime() + ((i / steps) * 24 - 12) * MS_HOUR);
    const { H, Az } = horizon(lat, lon, t);
    out.push({ t, H, Az });
  }
  return out;
}

/**
 * The celestial equator as it crosses this observer's sky: the track a body of
 * zero declination would follow. It rises due east and sets due west from
 * every latitude, which is worth being able to see.
 */
export function celestialEquator(lat, steps = 180) {
  const out = [];
  for (let i = 0; i <= steps; i++) out.push(altAz(lat, 0, -180 + (i * 360) / steps));
  return out;
}

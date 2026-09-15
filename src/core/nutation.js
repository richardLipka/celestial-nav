// Nutation: the small nodding of the Earth's axis, on top of precession.
//
// The moon's pull on the Earth's equatorial bulge is not steady — the moon's
// orbit plane turns once in 18.6 years — so the axis traces a small ellipse
// as it precesses. The dominant term is 17 arcseconds with that same 18.6-year
// period, and it moves the equinox that every celestial longitude is measured
// from.
//
// Seventeen arcseconds is nothing to a noon sight. It is thirty seconds of
// Greenwich time in a lunar distance, so it belongs in the moon's reduction
// and in the sun's — and it has to go into *both* or neither, because an angle
// between two bodies is unchanged by turning the frame they are measured in.

import { sind, cosd, norm360 } from './angles.js';
import { julianCenturies, terrestrialTime } from './time.js';

/**
 * The four dominant terms of the nutation in longitude, in degrees.
 * Meeus (22.1) truncated: good to about half an arcsecond, which is well
 * under the ephemeris error it is correcting.
 */
export function nutationInLongitude(date) {
  const T = julianCenturies(terrestrialTime(date));

  // Longitude of the moon's ascending node — the 18.6-year cycle itself.
  const omega = norm360(125.04452 - 1934.136261 * T);
  const L = norm360(280.4665 + 36000.7698 * T); // sun's mean longitude
  const Lp = norm360(218.3165 + 481267.8813 * T); // moon's mean longitude

  const arcsec = -17.20 * sind(omega)
    - 1.32 * sind(2 * L)
    - 0.23 * sind(2 * Lp)
    + 0.21 * sind(2 * omega);

  return arcsec / 3600;
}

/** The matching nudge to the obliquity, in degrees. */
export function nutationInObliquity(date) {
  const T = julianCenturies(terrestrialTime(date));
  const omega = norm360(125.04452 - 1934.136261 * T);
  const L = norm360(280.4665 + 36000.7698 * T);
  const Lp = norm360(218.3165 + 481267.8813 * T);

  const arcsec = 9.20 * cosd(omega)
    + 0.57 * cosd(2 * L)
    + 0.10 * cosd(2 * Lp)
    - 0.09 * cosd(2 * omega);

  return arcsec / 3600;
}

/** Mean obliquity of the ecliptic, degrees. Meeus (22.2). */
export function meanObliquity(date) {
  const T = julianCenturies(terrestrialTime(date));
  return 23.4392911 - (46.8150 * T + 0.00059 * T * T - 0.001813 * T ** 3) / 3600;
}

/** True obliquity: the mean value plus the nod. */
export const trueObliquity = (date) => meanObliquity(date) + nutationInObliquity(date);

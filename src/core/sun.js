// The sun's position, low precision.
//
// Good to roughly 0.01 degrees, which is 0.6 arcminutes -- comfortably better
// than a sextant at sea, and short enough that the whole thing can be read in
// one sitting. Readability is the point: this file is part of the explanation,
// not just part of the program.

import { sind, cosd, asind, atan2d, norm360, norm180 } from './angles.js';
import { daysFromJ2000, utcHours, MS_HOUR } from './time.js';

/**
 * Everything about the sun at one instant.
 *
 *   dec    declination         -- the GP's latitude. A calendar fact.
 *   gha    Greenwich hour angle -- sets the GP's longitude. A clock fact.
 *   eotDeg equation of time, in degrees of hour angle (apparent minus mean).
 *   sd     semi-diameter, arcminutes, from the sun's actual distance.
 */
export function solar(date) {
  const n = daysFromJ2000(date);

  const L = norm360(280.460 + 0.9856474 * n); // mean longitude
  const g = norm360(357.528 + 0.9856003 * n); // mean anomaly
  const lam = norm360(L + 1.915 * sind(g) + 0.02 * sind(2 * g)); // ecliptic longitude
  const eps = 23.439 - 0.0000004 * n; // obliquity

  const dec = asind(sind(eps) * sind(lam));
  const ra = norm360(atan2d(cosd(eps) * sind(lam), cosd(lam)));

  // Apparent solar time minus mean solar time. The mean sun sits at L, the
  // true sun at ra, and the difference between their hour angles is L - ra.
  const eotDeg = norm180(L - ra);

  // GHA = 15 * (apparent time at Greenwich - 12h), and apparent = UT + EoT.
  const gha = norm360(15 * (utcHours(date) - 12) + eotDeg);

  // Distance in AU, for the semi-diameter. The sun's angular radius is
  // 0.2666 degrees at one AU.
  const dist = 1.00014 - 0.01671 * cosd(g) - 0.00014 * cosd(2 * g);

  return {
    n, L, g, lam, eps,
    dec,
    ra,
    eotDeg,
    eotMin: eotDeg * 4, // 1 degree of hour angle = 4 minutes of time
    gha,
    dist,
    sd: (0.2666 / dist) * 60,
  };
}

/** The point on Earth with the sun directly overhead. */
export function subsolar(date) {
  const s = solar(date);
  return { lat: s.dec, lon: norm180(-s.gha) };
}

/**
 * How fast the declination is moving, in arcminutes per hour. Peaks at about
 * 1.0 near the equinoxes and passes through zero at the solstices -- this is
 * the number that makes latitude indifferent to the clock.
 */
export function decRateMinPerHour(date) {
  const a = solar(new Date(date.getTime() - 0.5 * MS_HOUR)).dec;
  const b = solar(new Date(date.getTime() + 0.5 * MS_HOUR)).dec;
  return (b - a) * 60;
}

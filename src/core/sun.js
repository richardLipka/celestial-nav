// The sun's position, low precision.
//
// Good to roughly 0.01 degrees, which is 0.6 arcminutes -- comfortably better
// than a sextant at sea, and short enough that the whole thing can be read in
// one sitting. Readability is the point: this file is part of the explanation,
// not just part of the program.

import { sind, cosd, asind, atan2d, norm360, norm180 } from './angles.js';
import { daysFromJ2000, julianCenturies, terrestrialTime, utcHours, MS_HOUR } from './time.js';
import { nutationInLongitude, trueObliquity } from './nutation.js';

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

/**
 * The sun again, to about an arcsecond — which only the lunar distance needs.
 *
 * `solar()` above is good to roughly half an arcminute, and that is plenty for
 * everything else in this program: half an arcminute of the sun is half a mile
 * of latitude and it does not move the noon sight's *time* at all. A lunar
 * distance is different. The moon closes on the sun at about half a degree an
 * hour, so an arcminute of error anywhere in the measured distance is two
 * minutes of Greenwich time and half a degree of longitude — and the sun's own
 * place is part of that distance.
 *
 * So this exists, and the difference between the two functions is itself worth
 * looking at: it is the arithmetic that lunars cost and noon sights did not.
 *
 * Meeus ch. 25, with the full equation of the centre, aberration, and the
 * nutation that `solar()` leaves out.
 */
export function solarPrecise(date) {
  const T = julianCenturies(terrestrialTime(date));
  const T2 = T * T;

  const L0 = norm360(280.46646 + 36000.76983 * T + 0.0003032 * T2); // mean longitude
  const M = norm360(357.52911 + 35999.05029 * T - 0.0001537 * T2); // mean anomaly
  const e = 0.016708634 - 0.000042037 * T - 0.0000001267 * T2; // eccentricity

  // Equation of the centre: true longitude minus mean, the ellipse itself.
  const C = (1.914602 - 0.004817 * T - 0.000014 * T2) * sind(M)
    + (0.019993 - 0.000101 * T) * sind(2 * M)
    + 0.000289 * sind(3 * M);

  const nu = M + C; // true anomaly
  const dist = (1.000001018 * (1 - e * e)) / (1 + e * cosd(nu)); // AU

  // The ellipse alone leaves half an arcminute on the table, and it is not
  // noise — it is the other planets pulling on the Earth, and the Earth
  // swinging about its common centre of mass with the moon. The D term is
  // that swing: the same 29-day period as the moon, because it *is* the moon.
  const A = norm360(351.52 + 22518.7541 * T);
  const B = norm360(253.14 + 45036.8864 * T);
  const Cp = norm360(157.23 + 32964.4678 * T);
  const D = norm360(297.85 + 445267.1117 * T); // the moon's mean elongation
  const Ep = norm360(252.08 + 20.190 * T);
  const perturbation = 0.00134 * cosd(A)
    + 0.00154 * cosd(B)
    + 0.00200 * cosd(Cp)
    + 0.00179 * sind(D)
    + 0.00178 * sind(Ep);

  const trueLon = norm360(L0 + C + perturbation);

  // Aberration: the sun appears displaced backwards along its path by the
  // time the light takes to arrive, which is 20.5 arcseconds at one AU.
  const aberration = -0.005691611 / dist;
  const lam = norm360(trueLon + aberration + nutationInLongitude(date));

  const eps = trueObliquity(date);
  const dec = asind(sind(eps) * sind(lam));
  const ra = norm360(atan2d(cosd(eps) * sind(lam), cosd(lam)));

  // The equation of time still compares the true sun with the *mean* sun, so
  // it is referred to the mean longitude before nutation and aberration.
  const eotDeg = norm180(L0 - 0.0057183 - ra + nutationInLongitude(date) * cosd(eps));
  const gha = norm360(15 * (utcHours(date) - 12) + eotDeg);

  return {
    T, L0, M, e, lam, dec, ra, dist, eps,
    beta: 0, // under 1.2 arcseconds, and it is not worth pretending otherwise
    eotDeg,
    eotMin: eotDeg * 4,
    gha,
    sd: (0.2666 / dist) * 60,
    hp: 0.1469 / dist, // solar horizontal parallax, arcminutes
  };
}

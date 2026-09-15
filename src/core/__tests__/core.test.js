import { describe, it, expect } from 'vitest';
import * as Astronomy from 'astronomy-engine';

import {
  norm180, norm360, dm, fmtLat, fmtLon, departureNm, sind, cosd, asind, acosd,
} from '../angles.js';
import { fromParts, utcHours, addSeconds, MS_HOUR, chronometerError, daysBetween } from '../time.js';
import { solar, subsolar, decRateMinPerHour } from '../sun.js';
import { horizon, sensitivity, culmination, sunEvents } from '../horizon.js';
import { dip, refraction, correct, uncorrect, defaultOptions } from '../corrections.js';
import {
  angularDistance, destination, circleOfPosition, longitudeFromLAN,
  latitudeFromMeridian, noonWorkUp, intercept,
} from '../fix.js';

// Deterministic PRNG so a failure is always reproducible.
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('angles', () => {
  it('wraps hour angles to (-180, 180]', () => {
    expect(norm180(370)).toBeCloseTo(10, 12);
    expect(norm180(-190)).toBeCloseTo(170, 12);
    expect(norm180(180)).toBe(180);
    expect(norm180(-180)).toBe(180);
    expect(norm360(-1)).toBeCloseTo(359, 12);
  });

  it('formats degrees and decimal minutes, carrying at 59.95', () => {
    expect(dm(50)).toBe('50° 00.0′');
    expect(dm(49.99917)).toBe('50° 00.0′'); // 59.95' rounds up and carries
    expect(fmtLat(-33.8688)).toBe('33° 52.1′ S');
    expect(fmtLon(151.2093)).toBe('151° 12.6′ E');
  });

  it('converts longitude to departure by the cosine of the latitude', () => {
    expect(departureNm(1, 0)).toBeCloseTo(60, 9);
    expect(departureNm(1, 60)).toBeCloseTo(30, 6);
  });
});

describe('solar position', () => {
  it('reaches the solstice declinations', () => {
    expect(solar(fromParts(2025, 6, 21, 3)).dec).toBeCloseTo(23.44, 1);
    expect(solar(fromParts(2025, 12, 21, 15)).dec).toBeCloseTo(-23.44, 1);
  });

  it('puts the equation of time extremes on the right days', () => {
    let hi = { v: -99 };
    let lo = { v: 99 };
    for (let d = 0; d < 365; d++) {
      const t = new Date(Date.UTC(2025, 0, 1 + d, 12));
      const v = solar(t).eotMin;
      if (v > hi.v) hi = { v, t };
      if (v < lo.v) lo = { v, t };
    }
    expect(hi.v).toBeCloseTo(16.4, 0);
    expect(hi.t.getUTCMonth()).toBe(10); // November
    expect(hi.t.getUTCDate()).toBeGreaterThanOrEqual(1);
    expect(hi.t.getUTCDate()).toBeLessThanOrEqual(6);

    expect(lo.v).toBeCloseTo(-14.2, 0);
    expect(lo.t.getUTCMonth()).toBe(1); // February
    expect(lo.t.getUTCDate()).toBeGreaterThanOrEqual(8);
    expect(lo.t.getUTCDate()).toBeLessThanOrEqual(15);
  });

  it('drives the subsolar point west at exactly 15 degrees an hour', () => {
    const t0 = fromParts(2025, 4, 10, 6);
    const a = subsolar(t0);
    const b = subsolar(new Date(t0.getTime() + MS_HOUR));
    expect(norm180(b.lon - a.lon)).toBeCloseTo(-15, 2);
  });

  it('moves the declination by at most about a minute of arc per hour', () => {
    let peak = 0;
    for (let d = 0; d < 365; d++) {
      const r = Math.abs(decRateMinPerHour(new Date(Date.UTC(2025, 0, 1 + d, 12))));
      if (r > peak) peak = r;
    }
    expect(peak).toBeGreaterThan(0.9);
    expect(peak).toBeLessThan(1.1);
  });
});

describe('altitude and azimuth against astronomy-engine', () => {
  it('agrees within 0.02 degrees over 10 000 random sights', () => {
    const rnd = mulberry32(20260914);
    let worstAlt = 0;
    let worstSep = 0;

    for (let i = 0; i < 10000; i++) {
      const lat = (rnd() * 2 - 1) * 80;
      const lon = (rnd() * 2 - 1) * 180;
      const date = new Date(Date.UTC(2020, 0, 1) + rnd() * 10 * 365.25 * 86400000);

      const mine = horizon(lat, lon, date);

      const observer = new Astronomy.Observer(lat, lon, 0);
      const eq = Astronomy.Equator(Astronomy.Body.Sun, date, observer, true, true);
      const hor = Astronomy.Horizon(date, observer, eq.ra, eq.dec, null); // no refraction

      worstAlt = Math.max(worstAlt, Math.abs(mine.H - hor.altitude));

      // Compare the actual separation on the sky rather than the azimuth
      // difference: azimuth is a coordinate singularity near the zenith, where
      // a hair of position error becomes a degree of bearing. The separation
      // is the quantity that means something.
      worstSep = Math.max(
        worstSep,
        acosd(
          sind(mine.H) * sind(hor.altitude) +
            cosd(mine.H) * cosd(hor.altitude) * cosd(mine.Az - hor.azimuth),
        ),
      );
    }

    expect(worstAlt).toBeLessThan(0.02);
    expect(worstSep).toBeLessThan(0.02);
  });

  it('puts the sun due east an hour before an equinox noon on the equator', () => {
    // At the equator with zero declination the sun climbs the prime vertical,
    // so one hour of hour angle is exactly one hour angle of altitude.
    const noon = culmination(fromParts(2025, 3, 20), 0);
    const { Az, H } = horizon(0, 0, new Date(noon.getTime() - MS_HOUR));
    expect(Az).toBeCloseTo(90, 0);
    expect(H).toBeCloseTo(75, 0);
  });

  it('puts the sun due south at culmination in the northern hemisphere', () => {
    const t = culmination(fromParts(2025, 5, 5), -30);
    const { Az, lha } = horizon(51.48, -30, t);
    expect(Math.abs(lha)).toBeLessThan(0.02);
    expect(Az).toBeCloseTo(180, 0);
  });
});

describe('the sensitivity of a sight to the clock', () => {
  it('vanishes on the meridian and maximises on the prime vertical', () => {
    expect(sensitivity(45, 180)).toBeCloseTo(0, 12);
    expect(sensitivity(45, 0)).toBeCloseTo(0, 12);
    expect(Math.abs(sensitivity(45, 270))).toBeCloseTo(Math.cos(Math.PI / 4), 12);
  });

  it('matches the partial derivative of the altitude formula', () => {
    const lat = 38;
    const { Az, lha, solar: s } = horizon(lat, -25, fromParts(2025, 8, 14, 15));
    // Partial derivative in LHA at fixed declination -- which is what a clock
    // error actually does to a sight.
    const H = (l) => asind(sind(lat) * sind(s.dec) + cosd(lat) * cosd(s.dec) * cosd(l));
    const e = 1e-4;
    expect(sensitivity(lat, Az)).toBeCloseTo((H(lha + e) - H(lha - e)) / (2 * e), 6);
  });
});

describe('sextant corrections', () => {
  it('reproduces the standard dip and refraction figures', () => {
    expect(dip(3)).toBeCloseTo(3.05, 2);
    expect(dip(12)).toBeCloseTo(6.1, 2);
    expect(refraction(10)).toBeCloseTo(5.39, 2);
    expect(refraction(45)).toBeCloseTo(0.99, 2);
  });

  it('round-trips Ho through Hs and back', () => {
    const opt = { ...defaultOptions(), indexErrorMin: 1.4, eyeHeightM: 9 };
    for (const Ho of [8, 23.5, 47.2, 66, 84]) {
      expect(correct(uncorrect(Ho, opt), opt).Ho).toBeCloseTo(Ho, 9);
    }
  });

  it('flags sights too low for the refraction model', () => {
    expect(correct(3, defaultOptions()).lowSight).toBe(true);
    expect(correct(30, defaultOptions()).lowSight).toBe(false);
  });
});

describe('spherical geometry', () => {
  it('keeps every point of a circle of position at the same distance from the GP', () => {
    const gp = { lat: 14.2, lon: -63.7 };
    for (const p of circleOfPosition(gp, 37.5, 60)) {
      expect(angularDistance(gp, p)).toBeCloseTo(37.5, 8);
    }
  });

  it('walks a known distance and bearing', () => {
    const p = destination({ lat: 0, lon: 0 }, 90, 10);
    expect(p.lat).toBeCloseTo(0, 9);
    expect(p.lon).toBeCloseTo(10, 9);
  });

  it('recovers an assumed position by intercept when the sight is perfect', () => {
    const truth = { lat: 40, lon: -20 };
    const date = fromParts(2025, 7, 4, 14);
    const gp = subsolar(date);
    const Ho = horizon(truth.lat, truth.lon, date).H;
    const assumed = { lat: 40.5, lon: -20.5 };
    const r = intercept(assumed, gp, Ho);
    // The intercept steps onto the true circle of position.
    expect(angularDistance(r.position, gp)).toBeCloseTo(90 - Ho, 6);
  });
});

describe('the two reductions', () => {
  const date = fromParts(1762, 1, 19);

  it('recovers position when the chronometer is right', () => {
    const truth = { lat: 18.0, lon: -76.8, date };
    const w = noonWorkUp(truth, { ...defaultOptions(), clockErrorSec: 0 });
    // The floor here is Date's millisecond resolution, which quantises the
    // instant of culmination and so pins longitude at about half a metre.
    expect(w.error.totalNm).toBeLessThan(0.001);
  });

  it('inverts culmination back into longitude', () => {
    for (const lon of [-170, -76.8, 0, 12.5, 151]) {
      const t = culmination(date, lon);
      expect(longitudeFromLAN(utcHours(t), solar(t).eotDeg)).toBeCloseTo(lon, 5);
    }
  });

  it('reads latitude straight off the meridian altitude', () => {
    expect(latitudeFromMeridian(60, 20, true)).toBeCloseTo(50, 12);
    expect(latitudeFromMeridian(60, 20, false)).toBeCloseTo(-10, 12);
  });

  // The whole thesis of the project, as an assertion.
  it('loses 27 nm of longitude and nothing of latitude to a two-minute clock error', () => {
    const truth = { lat: 25, lon: -40, date: fromParts(2025, 3, 20) }; // equinox: worst case for dec drift
    const w = noonWorkUp(truth, { ...defaultOptions(), clockErrorSec: 120 });

    expect(Math.abs(w.error.lonNm)).toBeCloseTo(27.2, 1);
    expect(Math.abs(w.error.latNm)).toBeLessThan(0.05);
    expect(Math.abs(w.error.lonNm) / Math.abs(w.error.latNm)).toBeGreaterThan(500);
  });

  it('holds latitude even with the clock a full hour out', () => {
    const truth = { lat: 25, lon: -40, date: fromParts(2025, 3, 20) };
    const w = noonWorkUp(truth, { ...defaultOptions(), clockErrorSec: 3600 });
    expect(Math.abs(w.error.latNm)).toBeLessThan(1.1);
    expect(Math.abs(w.error.lonNm)).toBeGreaterThan(800);
  });

  it('costs 246 nm at the equator to ignore the equation of time in November', () => {
    const truth = { lat: 0, lon: -30, date: fromParts(2025, 11, 3) };
    const withEoT = noonWorkUp(truth, { ...defaultOptions(), useEoT: true });
    const without = noonWorkUp(truth, { ...defaultOptions(), useEoT: false });
    expect(Math.abs(withEoT.error.lonNm)).toBeLessThan(0.01);
    expect(Math.abs(without.error.lonNm)).toBeCloseTo(246, -1);
  });
});

describe('the chronometer', () => {
  const portsmouth = fromParts(1761, 11, 18);
  const jamaica = fromParts(1762, 1, 19);

  it('accumulates the rate it was never known to have', () => {
    expect(daysBetween(portsmouth, jamaica)).toBe(62);
    // H4's five seconds, as the rate that produced them.
    expect(chronometerError(portsmouth, jamaica, 0, 5 / 62)).toBeCloseTo(5, 9);
    expect(chronometerError(portsmouth, fromParts(1761, 12, 18), 0, 5 / 62)).toBeCloseTo(2.42, 2);
  });

  it('carries the departure error through unchanged when the rate is zero', () => {
    expect(chronometerError(portsmouth, jamaica, 12, 0)).toBe(12);
  });

  it('does not run backwards before the watch has sailed', () => {
    expect(chronometerError(portsmouth, fromParts(1761, 9, 1), 3, 10)).toBe(3);
  });

  it('turns the Longitude Act into a rate', () => {
    // Half a degree is two minutes of time, over a six-week passage.
    const sailed = fromParts(1765, 5, 1);
    const landfall = fromParts(1765, 6, 12);
    expect(daysBetween(sailed, landfall)).toBe(42);
    const rate = 120 / 42;
    expect(rate).toBeLessThan(3);
    expect(chronometerError(sailed, landfall, 0, rate)).toBeCloseTo(120, 9);
    // ...which is exactly half a degree of longitude.
    expect((120 * 0.25) / 60).toBeCloseTo(0.5, 9);
  });
});

describe('sun events', () => {
  it('brackets local apparent noon with sunrise and sunset', () => {
    const e = sunEvents(fromParts(2025, 6, 21), 51.48, 0);
    expect(e.rise.getTime()).toBeLessThan(e.noon.getTime());
    expect(e.set.getTime()).toBeGreaterThan(e.noon.getTime());
    const dayLength = (e.set - e.rise) / MS_HOUR;
    expect(dayLength).toBeCloseTo(16.6, 0); // midsummer at Greenwich
  });

  it('reports polar day above the arctic circle at the solstice', () => {
    expect(sunEvents(fromParts(2025, 6, 21), 78, 15).polar).toBe('day');
  });
});

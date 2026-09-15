import { describe, it, expect } from 'vitest';
import * as Astronomy from 'astronomy-engine';

import { lunar, sublunar, motionMinPerHour, phase, greenwichSiderealDeg } from '../moon.js';
import { solar, solarPrecise } from '../sun.js';
import { deltaT, terrestrialTime, fromParts } from '../time.js';
import { nutationInLongitude, meanObliquity, trueObliquity } from '../nutation.js';
import {
  geocentricDistance, distanceRate, clearDistance, apparentGeometry,
  observeLunar, reduceLunar, timeFromDistance, longitudeFromLunar, costOfError,
  usable, augmentedSD, parallaxExact, parallaxFromGeocentric, refractionToApparent,
  MIN_OF_TIME_PER_ARCMIN, NM_PER_ARCMIN,
} from '../lunars.js';

// Deterministic PRNG so a failure is always reproducible.
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const AU_KM = 149597870.7;
const span = (rnd, fromY, toY) =>
  new Date(Date.UTC(fromY, 0, 1) + rnd() * (Date.UTC(toY, 0, 1) - Date.UTC(fromY, 0, 1)));

const wrap = (d) => (d > 180 ? d - 360 : d < -180 ? d + 360 : d);

describe('delta T', () => {
  it('knows the two clocks have drifted apart by more than a minute', () => {
    // Universal time is the Earth turning, and it has been slowing. These are
    // the standard reference values, to the accuracy the fits claim.
    expect(deltaT(fromParts(1700, 1, 1))).toBeCloseTo(9, 0);
    expect(deltaT(fromParts(1800, 1, 1))).toBeCloseTo(13.7, 0);
    expect(deltaT(fromParts(1900, 1, 1))).toBeCloseTo(-2.8, 0);
    expect(deltaT(fromParts(2000, 1, 1))).toBeCloseTo(63.8, 0);
    expect(deltaT(fromParts(2025, 1, 1))).toBeGreaterThan(65);
    expect(deltaT(fromParts(2025, 1, 1))).toBeLessThan(80);
  });

  it('is continuous across every join in the piecewise fit', () => {
    // Each of these polynomials is fitted on its own interval; a typo shows up
    // as a step at the boundary, and a step in delta T is a step in the moon.
    for (const y of [1700, 1800, 1860, 1900, 1920, 1941, 1961, 1986, 2005, 2050]) {
      const before = deltaT(new Date(Date.UTC(y - 1, 11, 31)));
      const after = deltaT(new Date(Date.UTC(y, 0, 2)));
      expect(Math.abs(after - before), `discontinuity at ${y}`).toBeLessThan(1.5);
    }
  });

  it('moves the clock forward, never back', () => {
    const d = fromParts(2025, 6, 1);
    expect(terrestrialTime(d).getTime()).toBeGreaterThan(d.getTime());
  });
});

describe('nutation', () => {
  it('stays inside the 17 arcseconds it is famous for', () => {
    const rnd = mulberry32(11);
    let worst = 0;
    for (let i = 0; i < 500; i++) worst = Math.max(worst, Math.abs(nutationInLongitude(span(rnd, 1700, 2060))));
    expect(worst * 3600).toBeGreaterThan(10);
    expect(worst * 3600).toBeLessThan(20);
  });

  it('nudges the obliquity without moving it far', () => {
    const d = fromParts(1987, 4, 10);
    expect(meanObliquity(d)).toBeCloseTo(23.44, 1);
    expect(Math.abs(trueObliquity(d) - meanObliquity(d)) * 3600).toBeLessThan(10);
  });
});

describe('the moon, against an independent ephemeris', () => {
  it('places it within half an arcminute over three and a half centuries', () => {
    const rnd = mulberry32(7);
    let worstLon = 0;
    let worstLat = 0;
    let worstDist = 0;
    for (let i = 0; i < 1500; i++) {
      const d = span(rnd, 1700, 2060);
      const o = Astronomy.EclipticGeoMoon(d);
      const m = lunar(d);
      worstLon = Math.max(worstLon, Math.abs(wrap(m.lam - o.lon)) * 3600);
      worstLat = Math.max(worstLat, Math.abs(m.beta - o.lat) * 3600);
      worstDist = Math.max(worstDist, Math.abs(m.distKm - o.dist * AU_KM));
    }
    // Meeus's truncation promises about 10 arcseconds typical; this is the
    // worst of 1500 draws. Half an arcminute of the moon is one minute of
    // Greenwich time, and that is the floor this whole tab sits on.
    expect(worstLon, 'longitude, arcsec').toBeLessThan(40);
    expect(worstLat, 'latitude, arcsec').toBeLessThan(8);
    expect(worstDist, 'distance, km').toBeLessThan(40);
  });

  it('would be a minute of time worse without delta T', () => {
    // Feeding UT to a series that wants dynamical time is a silent error of
    // the exact size that matters here, so it is worth pinning.
    const d = fromParts(2025, 1, 15, 12);
    const o = Astronomy.EclipticGeoMoon(d);
    const right = Math.abs(wrap(lunar(d).lam - o.lon)) * 3600;
    // Sixty-nine seconds of moon motion, which is what ignoring it would cost.
    const drift = Math.abs(motionMinPerHour(d)) * (deltaT(d) / 3600) * 60;
    expect(right).toBeLessThan(40);
    expect(drift, 'arcsec of moon per delta T').toBeGreaterThan(30);
  });

  it('gives the moon its half-degree an hour', () => {
    // "Half a degree an hour" is the mean. The orbit is an ellipse, so the
    // real figure runs from 29 arcminutes at apogee to 38 at perigee -- a
    // thirty per cent swing, and the cost of an arcminute swings with it.
    const rnd = mulberry32(3);
    let lo = Infinity;
    let hi = 0;
    for (let i = 0; i < 300; i++) {
      const v = motionMinPerHour(span(rnd, 1700, 2060));
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
      expect(v).toBeGreaterThan(28);
      expect(v).toBeLessThan(40);
    }
    expect(hi - lo, 'the spread is real, not noise').toBeGreaterThan(6);
  });

  it('keeps semi-diameter and horizontal parallax in their fixed ratio', () => {
    // The moon's radius is 0.2725 Earth radii, and both angles are subtended
    // from the same distance, so the ratio is a constant of the moon itself.
    const rnd = mulberry32(5);
    for (let i = 0; i < 50; i++) {
      const m = lunar(span(rnd, 1700, 2060));
      expect(m.hp).toBeGreaterThan(53);
      expect(m.hp).toBeLessThan(62);
      expect(m.sd / m.hp).toBeCloseTo(0.2725, 3);
    }
  });

  it('puts the sub-lunar point under the moon', () => {
    const d = fromParts(1762, 1, 27, 18);
    const g = sublunar(d);
    const m = lunar(d);
    expect(g.lat).toBeCloseTo(m.dec, 6);
    // Straight overhead means zenith distance zero.
    const alt = apparentGeometry(d, g).trueMoonAlt;
    expect(alt).toBeCloseTo(90, 2);
  });

  it('runs the phase from new to full and back', () => {
    const newish = phase(fromParts(2025, 1, 29, 12));
    const fullish = phase(fromParts(2025, 2, 14, 12));
    expect(newish.illuminated).toBeLessThan(0.05);
    expect(fullish.illuminated).toBeGreaterThan(0.95);
    expect(greenwichSiderealDeg(fromParts(2025, 1, 1, 0))).toBeGreaterThanOrEqual(0);
  });
});

describe('the precise sun', () => {
  it('is several times better than the readable one', () => {
    const rnd = mulberry32(13);
    let worstPlain = 0;
    let worstPrecise = 0;
    for (let i = 0; i < 800; i++) {
      const d = span(rnd, 1700, 2060);
      const o = Astronomy.Ecliptic(Astronomy.GeoVector(Astronomy.Body.Sun, d, true));
      worstPlain = Math.max(worstPlain, Math.abs(wrap(solar(d).lam - o.elon)) * 3600);
      worstPrecise = Math.max(worstPrecise, Math.abs(wrap(solarPrecise(d).lam - o.elon)) * 3600);
    }
    expect(worstPrecise, 'arcsec').toBeLessThan(20);
    expect(worstPlain / worstPrecise, 'the arithmetic a lunar costs').toBeGreaterThan(3);
  });

  it('agrees with the readable one to the accuracy that one claims', () => {
    const rnd = mulberry32(17);
    for (let i = 0; i < 100; i++) {
      const d = span(rnd, 1700, 2060);
      expect(Math.abs(wrap(solar(d).dec - solarPrecise(d).dec))).toBeLessThan(0.02);
    }
  });
});

describe('parallax and refraction', () => {
  it('has an exact inverse for parallax, which the reduction depends on', () => {
    for (const hp of [54, 57, 61]) {
      for (const hGeo of [5, 20, 45, 70, 89]) {
        const p = parallaxFromGeocentric(hp, hGeo);
        const topo = hGeo - p / 60;
        // Going back the other way must return the same displacement.
        expect(parallaxExact(hp, topo), `${hp} at ${hGeo}`).toBeCloseTo(p, 6);
      }
    }
  });

  it('would leak most of an arcminute if the two were confused', () => {
    // Using the geocentric altitude as the argument of the topocentric formula
    // is the mistake, and this is what it is worth.
    const hp = 57;
    const hGeo = 45;
    const right = parallaxFromGeocentric(hp, hGeo);
    const wrong = parallaxExact(hp, hGeo);
    expect(Math.abs(right - wrong)).toBeGreaterThan(0.3);
  });

  it('inverts refraction so that a body put up comes back down', () => {
    for (const h of [5, 10, 30, 60, 85]) {
      const app = refractionToApparent(h);
      expect(app).toBeGreaterThan(h);
      expect(app - refraction60(app)).toBeCloseTo(h, 4);
    }
  });

  it('makes the moon look bigger overhead than on the horizon', () => {
    const low = augmentedSD(16, 57, 0);
    const high = augmentedSD(16, 57, 90);
    expect(low).toBeCloseTo(16, 6);
    expect(high - low).toBeGreaterThan(0.2);
    expect(high - low).toBeLessThan(0.3);
  });
});

// The refraction the module uses, in degrees, for the inversion check above.
const refraction60 = (h) => {
  const tand = (d) => Math.tan((d * Math.PI) / 180);
  return 1 / tand(h + 7.31 / (h + 4.4)) / 60;
};

describe('clearing the distance', () => {
  const truth = { lat: 18.0, lon: -76.8 };
  const when = fromParts(1762, 1, 27, 18);

  it('is exactly undone by the reduction, which is the proof it is right', () => {
    // Observe with no error at all and the reduction must hand back the very
    // instant it was taken. Anything else is a bug in the corrections, and it
    // would be invisible on screen.
    const rnd = mulberry32(23);
    let worst = 0;
    let n = 0;
    for (let i = 0; i < 300; i++) {
      const t = span(rnd, 1762, 1765);
      if (!usable(t, truth).ok) continue;
      n++;
      const r = reduceLunar(observeLunar(t, truth, { eyeHeightM: 3 }, 0, {}));
      expect(r.gmt, 'no solution found').toBeTruthy();
      worst = Math.max(worst, Math.abs(r.gmt - t) / 1000);
    }
    expect(n, 'usable sights to test').toBeGreaterThan(20);
    expect(worst, 'seconds').toBeLessThan(1);
  });

  it('is not a small correction that could be skipped', () => {
    const sight = observeLunar(when, truth, { eyeHeightM: 3 }, 0, {});
    const r = reduceLunar(sight);
    expect(Math.abs(r.clearedBy), 'arcmin').toBeGreaterThan(5);

    const naive = timeFromDistance(r.appDist, sight.tChrono, 12);
    const naiveErrMin = Math.abs(naive - when) / 60000;
    expect(naiveErrMin, 'minutes of GMT thrown away').toBeGreaterThan(10);
  });

  it('leaves the zenith angle alone, which is the hinge of the method', () => {
    // Parallax and refraction both act along the vertical circle, so the angle
    // at the zenith between the two bodies survives them untouched. If it did
    // not, no clearing would be possible at all.
    const g = apparentGeometry(when, truth);
    const cosZ = (d, h1, h2) =>
      (Math.cos((d * Math.PI) / 180) - Math.sin((h1 * Math.PI) / 180) * Math.sin((h2 * Math.PI) / 180))
      / (Math.cos((h1 * Math.PI) / 180) * Math.cos((h2 * Math.PI) / 180));
    expect(cosZ(g.appDist, g.appMoonAlt, g.appSunAlt))
      .toBeCloseTo(cosZ(g.trueDist, g.trueMoonAlt, g.trueSunAlt), 9);
  });

  it('recovers the true distance from the apparent one', () => {
    const g = apparentGeometry(when, truth);
    const back = clearDistance({
      appDist: g.appDist,
      appMoonAlt: g.appMoonAlt,
      appSunAlt: g.appSunAlt,
      trueMoonAlt: g.trueMoonAlt,
      trueSunAlt: g.trueSunAlt,
    });
    expect(back).toBeCloseTo(g.trueDist, 9);
  });
});

describe('a lunar is a clock, not a position line', () => {
  const when = fromParts(1762, 1, 27, 18);

  it('gives the same Greenwich time from anywhere on Earth', () => {
    // This is the whole claim of the method, and it is worth asserting
    // directly: the same instant, observed from five different ships, reduces
    // to the same time. A noon sight cannot do this.
    const places = [
      { lat: 18, lon: -76.8 },
      { lat: 0, lon: 0 },
      { lat: 50.1, lon: 14.4 },
      { lat: -33.9, lon: 18.4 },
      { lat: 40.7, lon: -74 },
    ];
    const times = [];
    for (const p of places) {
      if (!usable(when, p).ok) continue;
      const r = reduceLunar(observeLunar(when, p, { eyeHeightM: 3 }, 0, {}));
      times.push(r.gmt.getTime());
    }
    expect(times.length, 'places that could see both bodies').toBeGreaterThan(1);
    const spreadSec = (Math.max(...times) - Math.min(...times)) / 1000;
    expect(spreadSec, 'seconds of disagreement between ships').toBeLessThan(1);
  });

  it('does not care what the chronometer says', () => {
    // The watch is only a starting guess for the search. Put it an hour out
    // and the answer must not move.
    const truth = { lat: 18, lon: -76.8 };
    const good = reduceLunar(observeLunar(when, truth, { eyeHeightM: 3 }, 0, {}));
    const bad = reduceLunar(observeLunar(when, truth, { eyeHeightM: 3 }, 3600, {}));
    expect(Math.abs(bad.gmt - good.gmt) / 1000).toBeLessThan(1);
    expect(bad.watchErrorSec).toBeCloseTo(3600, 0);
  });
});

describe('what an arcminute costs', () => {
  const truth = { lat: 18, lon: -76.8 };
  const when = fromParts(1762, 1, 27, 18);

  it('turns one arcminute into about half an hour of longitude', () => {
    // The headline of the whole tab: a noon sight makes an arcminute worth a
    // mile, a lunar makes it worth thirty.
    expect(MIN_OF_TIME_PER_ARCMIN).toBeGreaterThan(1.9);
    expect(MIN_OF_TIME_PER_ARCMIN).toBeLessThan(2.1);
    expect(NM_PER_ARCMIN).toBeGreaterThan(28);
    expect(NM_PER_ARCMIN).toBeLessThan(32);
  });

  it('measures that amplification rather than asserting it', () => {
    const clean = reduceLunar(observeLunar(when, truth, { eyeHeightM: 3 }, 0, {}));
    for (const errMin of [0.25, 0.5, 1]) {
      const off = reduceLunar(observeLunar(when, truth, { eyeHeightM: 3 }, 0, { distMin: errMin }));
      const minutes = Math.abs(off.gmt - clean.gmt) / 60000;
      const predicted = costOfError(errMin, when).minutesOfTime;
      expect(minutes, `${errMin} arcmin`).toBeCloseTo(predicted, 1);
    }
  });

  it('scales the cost with latitude, because longitude does', () => {
    const equator = costOfError(1, when, 0);
    const high = costOfError(1, when, 60);
    expect(high.nm).toBeCloseTo(equator.nm / 2, 0);
    expect(high.minutesOfTime).toBeCloseTo(equator.minutesOfTime, 9);
  });

  it('collapses near new moon, which is why there is an elongation guard', () => {
    // The moon can pass four or five degrees above the sun, and then the
    // *separation* reaches a minimum and turns around while the elongation
    // sails on. At that moment the distance is barely changing and a lunar
    // measures nothing at all. It is the one way this method can fail
    // silently, and the 15-degree guard in `usable` is what prevents it.
    const rnd = mulberry32(29);
    const truth = { lat: 18, lon: -76.8 };
    let worstAnywhere = Infinity;
    let worstUsable = Infinity;
    let bestUsable = 0;
    let n = 0;
    for (let i = 0; i < 1500; i++) {
      const t = span(rnd, 1762, 1764);
      const rate = Math.abs(distanceRate(t));
      worstAnywhere = Math.min(worstAnywhere, rate);
      if (!usable(t, truth).ok) continue;
      n++;
      worstUsable = Math.min(worstUsable, rate);
      bestUsable = Math.max(bestUsable, rate);
    }
    expect(n, 'usable sights to judge').toBeGreaterThan(50);
    expect(worstAnywhere, 'somewhere the rate nearly vanishes').toBeLessThan(0.2);
    // But never once the guard has had its say.
    expect(worstUsable, 'and never on a sight the guard allows').toBeGreaterThan(0.35);
    expect(bestUsable).toBeLessThan(0.7);
  });
});

describe('from Greenwich time to a longitude', () => {
  it('closes the loop: a lunar plus a local time is a position', () => {
    const truth = { lat: 18, lon: -76.8 };
    const when = fromParts(1762, 1, 27, 18);
    const r = reduceLunar(observeLunar(when, truth, { eyeHeightM: 3 }, 0, {}));

    // Local apparent time comes from the sun in the ordinary way: the hour
    // angle at the ship, which the navigator has from a time sight.
    const s = solarPrecise(r.gmt);
    const lha = s.gha + truth.lon;
    const localApparentHours = 12 + lha / 15;

    const lon = longitudeFromLunar(r.gmt, localApparentHours);
    // The error here is the lunar's, amplified the way the tab says it is.
    expect(Math.abs(lon - truth.lon) * 60).toBeLessThan(2);
  });
});

describe('when a lunar cannot be taken', () => {
  const truth = { lat: 18, lon: -76.8 };

  it('refuses a moon too near the sun to get a sextant between them', () => {
    const rnd = mulberry32(31);
    let tooClose = 0;
    let ok = 0;
    for (let i = 0; i < 400; i++) {
      const u = usable(span(rnd, 1762, 1763), truth);
      if (u.reason === 'tooClose') tooClose++;
      if (u.ok) ok++;
    }
    expect(tooClose, 'new-moon days').toBeGreaterThan(0);
    expect(ok, 'usable days').toBeGreaterThan(0);
  });

  it('names the reason rather than just failing', () => {
    const rnd = mulberry32(37);
    const reasons = new Set();
    for (let i = 0; i < 600; i++) {
      const u = usable(span(rnd, 1762, 1764), truth);
      if (!u.ok) reasons.add(u.reason);
    }
    for (const r of reasons) {
      expect(['tooClose', 'tooFar', 'moonLow', 'sunLow']).toContain(r);
    }
    expect(reasons.size).toBeGreaterThan(1);
  });
});

describe('the criterion this phase was written against', () => {
  it('gives Greenwich time to within a minute, from a round of sights', () => {
    // "Done when a lunar distance gives GMT to within a minute." With an
    // observer who reads to a few tenths of an arcminute, one sight usually
    // manages it and a round of five always does -- which is exactly why a
    // round of five was the practice.
    const rnd = mulberry32(41);
    const truth = { lat: 18, lon: -76.8 };
    const draw = () => (rnd() + rnd() - 1) * 0.6;
    const jit = () => ({ moonMin: draw(), sunMin: draw(), distMin: draw() });

    const single = [];
    const rounds = [];
    let n = 0;
    for (let i = 0; i < 600 && n < 60; i++) {
      const t = span(rnd, 1762, 1765);
      if (!usable(t, truth).ok) continue;
      n++;

      const one = reduceLunar(observeLunar(t, truth, { eyeHeightM: 3 }, 0, jit()));
      if (one.gmt) single.push(Math.abs(one.gmt - t) / 1000);

      // A round: five sights three minutes apart. What is averaged is the
      // watch error, because that is the quantity common to all five.
      const errs = [];
      for (let k = 0; k < 5; k++) {
        const tk = new Date(t.getTime() + k * 180000);
        const sk = observeLunar(tk, truth, { eyeHeightM: 3 }, 0, jit());
        const rk = reduceLunar(sk);
        if (rk.gmt) errs.push((sk.tChrono - rk.gmt) / 1000);
      }
      if (errs.length === 5) rounds.push(Math.abs(errs.reduce((a, b) => a + b, 0) / 5));
    }

    expect(n, 'usable sights').toBeGreaterThan(20);
    const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
    expect(median(single), 'one sight, median seconds').toBeLessThan(40);
    expect(median(rounds), 'a round of five, median seconds').toBeLessThan(20);
    expect(rounds.every((e) => e < 60), 'every round inside a minute').toBe(true);
    // And averaging really is what bought that, not luck.
    expect(median(rounds)).toBeLessThan(median(single));
  });

  it('flatters itself, and the tab says so', () => {
    // The reduction uses the same ephemeris that placed the moon, so the
    // table's own error cancels exactly. That is worth knowing, because it is
    // the one error a real lunar could not escape -- and the panel says so in
    // both languages rather than letting the figures imply otherwise.
    const truth = { lat: 18, lon: -76.8 };
    const t = fromParts(1762, 1, 27, 18);
    const perfect = reduceLunar(observeLunar(t, truth, { eyeHeightM: 3 }, 0, {}));
    expect(Math.abs(perfect.gmt - t) / 1000, 'no residual at all').toBeLessThan(1);
  });
});

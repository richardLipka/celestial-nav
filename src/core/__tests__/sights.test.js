import { describe, it, expect } from 'vitest';

import { fromParts, MS_HOUR, addSeconds } from '../time.js';
import { culmination } from '../horizon.js';
import { defaultOptions } from '../corrections.js';
import {
  observe, reduceLog, equalAltitudePairs, equalAltitudeCorrectionSec,
  matchAltitudeTime, parabolaVertex, fixError,
} from '../sights.js';

const OPT = defaultOptions();

/** A day's worth of sights taken at the given offsets from true noon, in hours. */
function takeSights(truth, offsets, clockErrorSec = 0, jitter = () => 0) {
  const lan = culmination(truth.date, truth.lon, true);
  return offsets.map((h, i) =>
    observe(new Date(lan.getTime() + h * MS_HOUR), truth, OPT, clockErrorSec, jitter(i)));
}

// What a navigator actually does: a few sights out on the limbs for equal
// altitudes, then a close run either side of noon for the altitude itself.
// Taken at matching intervals either side, so the crossings fall on sights.
const WORKING_LOG = [-3.5, -2.5, -1.5, -0.6, -0.2, -0.07, 0.06, 0.19, 0.6, 1.5, 2.5, 3.5];

const JAMAICA = { lat: 18.0, lon: -76.8, date: fromParts(1762, 1, 19) };
const PRAHA = { lat: 50.0755, lon: 14.4378, date: fromParts(2025, 5, 14) };

describe('observing', () => {
  it('hands back only what an instrument could show', () => {
    const [s] = takeSights(JAMAICA, [0]);
    expect(s).toHaveProperty('Hs');
    expect(s).toHaveProperty('Ho');
    expect(s).toHaveProperty('Az');
    expect(s).toHaveProperty('tChrono');
    expect(s.Hs).toBeLessThan(s.Ho); // the corrections are net positive for a lower limb
  });

  it('stamps the log with the chronometer, not the truth', () => {
    const [s] = takeSights(JAMAICA, [0], 125);
    expect((s.tChrono - s.t) / 1000).toBe(125);
  });

  it('reports a sight below the horizon rather than inventing one', () => {
    const arctic = { lat: 71.17, lon: 25.78, date: fromParts(2025, 1, 19) };
    const [s] = takeSights(arctic, [0]);
    expect(s.below).toBe(true);
  });
});

describe('finding noon from a log', () => {
  const offsets = WORKING_LOG;

  it('needs sights either side of noon before it can say anything', () => {
    const onlyMorning = reduceLog(takeSights(JAMAICA, [-3, -2, -1]));
    expect(onlyMorning.bracketed).toBe(false);
    expect(onlyMorning.equalAlt).toBeNull();
    expect(onlyMorning.stage).toBe('partial');
  });

  it('pairs equal altitudes either side of the maximum', () => {
    const log = takeSights(JAMAICA, offsets);
    const r = reduceLog(log);
    expect(r.equalAlt).not.toBeNull();
    expect(r.equalAlt.pairs.length).toBeGreaterThanOrEqual(3);
    // Each pair really does sit at one altitude on both limbs.
    for (const p of r.equalAlt.pairs) {
      expect(p.spanHours).toBeGreaterThan(0.25);
      expect(p.pmTime.getTime()).toBeGreaterThan(p.am.tChrono.getTime());
    }
  });

  it('recovers local apparent noon to within a few seconds', () => {
    const lan = culmination(JAMAICA.date, JAMAICA.lon, true);
    const r = reduceLog(takeSights(JAMAICA, offsets));
    const err = Math.abs(r.equalAlt.lanChrono - lan) / 1000;
    expect(err).toBeLessThan(5);
  });

  it('beats the highest-sight method at finding noon, badly', () => {
    const lan = culmination(JAMAICA.date, JAMAICA.lon, true);
    const log = takeSights(JAMAICA, offsets);
    const r = reduceLog(log);
    const byMax = Math.abs(r.max.tChrono - lan) / 1000;
    const byEqual = Math.abs(r.equalAlt.lanChrono - lan) / 1000;
    expect(byMax).toBeGreaterThan(10 * byEqual);
  });

  // The flat maximum, stated as a test: the altitude at noon is easy to catch,
  // the instant of noon is not.
  it('recovers the meridian altitude by parabola when no sight caught the peak', () => {
    const r = reduceLog(takeSights(JAMAICA, [-1.1, -0.4, 0.35, 1.0]));
    expect(r.peak.fitted).toBe(true);
    // The highest single reading is well short of the true maximum...
    expect((90 - r.max.Ho - Math.abs(JAMAICA.lat - r.dec)) * 60).toBeGreaterThan(1);
    // ...but the fitted peak lands on it.
    expect(Math.abs(r.lat - JAMAICA.lat) * 60).toBeLessThan(1);
  });

  it('returns no fitted peak when the log never brackets the maximum', () => {
    const r = reduceLog(takeSights(JAMAICA, [-3, -2, -1]));
    expect(r.peak.fitted).toBe(false);
  });

  it('applies the equation of equal altitudes near the equinox', () => {
    // Declination moves fastest at the equinoxes, so the uncorrected midpoint
    // is furthest from noon there. Observed crossings, so that what is under
    // test is the correction and not the interpolation.
    const truth = { lat: 45, lon: -20, date: fromParts(2025, 3, 20) };
    const lan = culmination(truth.date, truth.lon, true);
    const am = observe(new Date(lan.getTime() - 3.5 * MS_HOUR), truth, OPT);
    const pm = matchAltitudeTime(am.Ho, new Date(lan.getTime() + 60000), truth, OPT);
    const r = reduceLog([
      am,
      observe(new Date(lan.getTime() - 60000), truth, OPT),
      observe(new Date(lan.getTime() + 60000), truth, OPT),
      observe(pm, truth, OPT),
    ]);
    const rawErr = Math.abs(r.equalAlt.midpoint - lan) / 1000;
    const corrErr = Math.abs(r.equalAlt.lanChrono - lan) / 1000;
    expect(Math.abs(r.equalAlt.correctionSec)).toBeGreaterThan(10);
    expect(rawErr).toBeGreaterThan(10);
    expect(corrErr).toBeLessThan(2);
  });

  it('is limited by the log when the crossing has to be interpolated', () => {
    // Sights at times that do not line up either side of noon, so no sample
    // lands on a crossing and every pair has to be interpolated. The reduction
    // still works; it is just only as good as the gaps in the log.
    const truth = { lat: 45, lon: -20, date: fromParts(2025, 3, 20) };
    const lan = culmination(truth.date, truth.lon, true);
    const r = reduceLog(takeSights(truth, [-3.4, -2.4, -1.4, -0.2, 0.1, 1.1, 2.1, 3.1]));
    expect(r.equalAlt.pair.observed).toBe(false);
    // Interpolating across an hour of log costs the best part of a minute of
    // time, which is eight miles of longitude at this latitude. That is the
    // honest price of not watching the sun down to the mark.
    expect(Math.abs(r.equalAlt.lanChrono - lan) / 1000).toBeLessThan(60);
    expect(Math.abs(r.equalAlt.lanChrono - lan) / 1000).toBeGreaterThan(10);
  });

  it('trusts an observed crossing over a merely wider interpolated one', () => {
    const lan = culmination(JAMAICA.date, JAMAICA.lon, true);
    const am = observe(new Date(lan.getTime() - 2 * MS_HOUR), JAMAICA, OPT);
    const pm = matchAltitudeTime(am.Ho, new Date(lan.getTime() + 60000), JAMAICA, OPT);
    const log = [
      observe(new Date(lan.getTime() - 3.5 * MS_HOUR), JAMAICA, OPT), // wider, but
      am,                                                             // only bracketed
      observe(new Date(lan.getTime() - 6 * 60000), JAMAICA, OPT),     // by a 3 h gap
      observe(new Date(lan.getTime() + 4 * 60000), JAMAICA, OPT),
      observe(pm, JAMAICA, OPT),
    ];
    const r = reduceLog(log);
    expect(r.equalAlt.pair.observed).toBe(true);
    expect(Math.abs(r.equalAlt.pair.spanHours - 4)).toBeLessThan(0.1);
    expect(Math.abs(r.equalAlt.lanChrono - lan) / 1000).toBeLessThan(5);
  });

  it('vanishes at the solstice, where the declination stands still', () => {
    const truth = { lat: 45, lon: -20, date: fromParts(2025, 6, 21) };
    const r = reduceLog(takeSights(truth, offsets));
    expect(Math.abs(r.equalAlt.correctionSec)).toBeLessThan(1);
  });

  it('has no correction to make when the span is zero hour angle', () => {
    expect(equalAltitudeCorrectionSec(0, 0.01, 45, 10)).toBe(0);
  });

  it('ignores sights taken with the sun below the horizon', () => {
    const log = takeSights(JAMAICA, [-8, -3, -1, 1, 3, 8]);
    const r = reduceLog(log);
    expect(r.rejected).toBe(2);
    expect(r.count).toBe(4);
  });
});

describe('watching the sun back down to an altitude', () => {
  it('finds the moment it returns, to the second', () => {
    const lan = culmination(JAMAICA.date, JAMAICA.lon, true);
    const amMs = lan.getTime() - 3 * MS_HOUR;
    const am = observe(new Date(amMs), JAMAICA, OPT);
    const pm = matchAltitudeTime(am.Ho, new Date(lan.getTime() + 60000), JAMAICA, OPT);
    expect(pm).not.toBeNull();
    const back = observe(pm, JAMAICA, OPT);
    expect(Math.abs(back.Ho - am.Ho) * 3600).toBeLessThan(1); // within an arcsecond
    // Symmetric about noon to within the declination's drift.
    expect(Math.abs((pm - lan) - (lan - amMs)) / 1000).toBeLessThan(60);
  });

  it('gives a clean pair that beats interpolation from hourly sights', () => {
    const lan = culmination(JAMAICA.date, JAMAICA.lon, true);
    const amMs = lan.getTime() - 3 * MS_HOUR;
    const am = observe(new Date(amMs), JAMAICA, OPT);
    const pmTime = matchAltitudeTime(am.Ho, new Date(lan.getTime() + 60000), JAMAICA, OPT);
    const log = [am, observe(new Date(lan.getTime() - 60000), JAMAICA, OPT),
      observe(new Date(lan.getTime() + 60000), JAMAICA, OPT), observe(pmTime, JAMAICA, OPT)];
    const r = reduceLog(log);
    expect(Math.abs(r.equalAlt.lanChrono - lan) / 1000).toBeLessThan(2);
  });

  it('declines when the sun is not descending through that altitude', () => {
    const lan = culmination(JAMAICA.date, JAMAICA.lon, true);
    expect(matchAltitudeTime(89, new Date(lan.getTime() + 60000), JAMAICA, OPT)).toBeNull();
  });
});

describe('the flat maximum, with a real sextant', () => {
  // A reading error of half a minute of arc. Perfect readings hide the whole
  // problem, because a noiseless parabola finds the vertex of a flat curve.
  const jitter = (i) => [0.4, -0.3, 0.5, -0.45, 0.35, -0.5, 0.45, -0.35, 0.3, -0.4, 0.5, -0.3][i] ?? 0;

  it('barely touches the latitude', () => {
    const r = reduceLog(takeSights(JAMAICA, WORKING_LOG, 0, jitter));
    const e = fixError({ lat: r.lat, lon: r.lon }, JAMAICA);
    expect(Math.abs(e.latNm)).toBeLessThan(2);
  });

  it('wrecks the time of noon taken from the peak, and not from equal altitudes', () => {
    const lan = culmination(JAMAICA.date, JAMAICA.lon, true);
    const r = reduceLog(takeSights(JAMAICA, WORKING_LOG, 0, jitter));
    const byPeak = Math.abs(r.peak.tMs - lan.getTime()) / 1000;
    const byEqual = Math.abs(r.equalAlt.lanChrono - lan) / 1000;
    expect(byPeak).toBeGreaterThan(30);
    expect(byEqual).toBeLessThan(byPeak / 5);
  });

  it('turns that into fifteen miles of longitude, or half a mile', () => {
    const log = takeSights(JAMAICA, WORKING_LOG, 0, jitter);
    const r = reduceLog(log);
    const byPeak = fixError({ lat: r.lat, lon: r.lonByMax }, JAMAICA);
    const byEqual = fixError({ lat: r.lat, lon: r.lon }, JAMAICA);
    expect(Math.abs(byPeak.lonNm)).toBeGreaterThan(10);
    expect(Math.abs(byEqual.lonNm)).toBeLessThan(2);
  });
});

describe('the position a log actually yields', () => {
  const offsets = WORKING_LOG;

  it('lands on the ship when the chronometer is true', () => {
    for (const truth of [JAMAICA, PRAHA]) {
      const r = reduceLog(takeSights(truth, offsets));
      const e = fixError({ lat: r.lat, lon: r.lon }, truth);
      expect(Math.abs(e.latNm), `lat ${truth.lat}`).toBeLessThan(1);
      expect(Math.abs(e.lonNm), `lon ${truth.lon}`).toBeLessThan(1.5);
    }
  });

  it('loses only longitude when the chronometer is two minutes fast', () => {
    const r = reduceLog(takeSights(PRAHA, offsets, 120));
    const e = fixError({ lat: r.lat, lon: r.lon }, PRAHA);
    expect(Math.abs(e.latNm)).toBeLessThan(1);
    // 120 s = 30' of longitude; at 50 N that is 30 * cos(50) = 19.3 nm.
    expect(Math.abs(e.lonNm)).toBeGreaterThan(17);
    expect(Math.abs(e.lonNm)).toBeLessThan(21);
  });

  it('reads the sun south of the zenith at Prague and north of it at Sydney', () => {
    expect(reduceLog(takeSights(PRAHA, offsets)).sunBearsSouth).toBe(true);
    const sydney = { lat: -33.8688, lon: 151.2093, date: fromParts(2025, 5, 14) };
    expect(reduceLog(takeSights(sydney, offsets)).sunBearsSouth).toBe(false);
  });

  it('says nothing at all from an empty log', () => {
    expect(reduceLog([]).stage).toBe('none');
    expect(reduceLog([]).count).toBe(0);
  });
});

describe('pairing', () => {
  // A short log with two sights close together near the peak: their altitudes
  // are nearly equal, which is exactly where an inverse-quadratic crossing
  // blows up, and where the honest answer is a linear one.
  it('survives two near-equal altitudes beside the peak', () => {
    const lan = culmination(JAMAICA.date, JAMAICA.lon, true);
    const am = observe(new Date(lan.getTime() - 3 * MS_HOUR), JAMAICA, OPT);
    const pmTime = matchAltitudeTime(am.Ho, new Date(lan.getTime() + 60000), JAMAICA, OPT);
    const log = [
      am,
      observe(new Date(lan.getTime() - 10 * 60000), JAMAICA, OPT),
      observe(new Date(lan.getTime() + 5 * 60000), JAMAICA, OPT),
      observe(pmTime, JAMAICA, OPT),
    ];
    const r = reduceLog(log);
    expect(r.equalAlt).not.toBeNull();
    expect(Math.abs(r.equalAlt.lanChrono - lan) / 1000).toBeLessThan(5);
    const e = fixError({ lat: r.lat, lon: r.lon }, JAMAICA);
    expect(Math.abs(e.lonNm)).toBeLessThan(2);
  });

  it('will not pair a sight with itself', () => {
    const mk = (h, Ho) => ({ tChrono: new Date(Date.UTC(2025, 0, 1, 12 + h)), Ho, Az: 180 });
    const entries = [mk(-2, 30), mk(0, 40), mk(2, 30)];
    const pairs = equalAltitudePairs(entries, 1);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].spanHours).toBeCloseTo(4, 6);
  });
});

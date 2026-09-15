import { describe, it, expect } from 'vitest';

import { fromParts } from '../time.js';
import { degToNm } from '../angles.js';
import { angularDistance } from '../fix.js';
import { defaultOptions } from '../corrections.js';
import { rhumb, planPassage, dayRun, simulateVoyage, seededRandom } from '../voyage.js';

// The trade-wind route: Las Palmas to Bridgetown, which is the passage the
// Longitude Act was written about.
const LAS_PALMAS = { lat: 28.13, lon: -15.43 };
const BRIDGETOWN = { lat: 13.11, lon: -59.6 };
const SAILED = fromParts(1765, 5, 1);

const passage = (extra = {}) => {
  const plan = planPassage(LAS_PALMAS, BRIDGETOWN, 5);
  return simulateVoyage({
    start: LAS_PALMAS,
    destination: BRIDGETOWN,
    departureDate: SAILED,
    ...plan,
    days: plan.days + 12, // room to wander
    speedKts: 5,
    driftKts: 0.6,
    setDeg: 275,
    steeringBiasDeg: 2,
    seed: 7,
    ...extra,
  });
};

describe('rhumb sailing', () => {
  it('runs due east along the equator at sixty miles a degree', () => {
    const r = rhumb({ lat: 0, lon: 0 }, { lat: 0, lon: 10 });
    expect(r.courseDeg).toBeCloseTo(90, 6);
    expect(r.distanceNm).toBeCloseTo(600, 6);
  });

  it('runs due north up a meridian', () => {
    const r = rhumb({ lat: 0, lon: 0 }, { lat: 10, lon: 0 });
    expect(r.courseDeg).toBeCloseTo(0, 6);
    expect(r.distanceNm).toBeCloseTo(600, 6);
  });

  it('shortens along a parallel by the cosine of the latitude', () => {
    const r = rhumb({ lat: 50, lon: 0 }, { lat: 50, lon: 10 });
    expect(r.courseDeg).toBeCloseTo(90, 4);
    expect(r.distanceNm).toBeCloseTo(600 * Math.cos((50 * Math.PI) / 180), 1);
  });

  it('is longer than the great circle, which is what it buys you', () => {
    const r = rhumb(LAS_PALMAS, BRIDGETOWN);
    const gc = degToNm(angularDistance(LAS_PALMAS, BRIDGETOWN));
    expect(r.distanceNm).toBeGreaterThan(gc);
    expect(r.distanceNm - gc).toBeLessThan(20); // but only just, on this route
  });

  it('plans a passage a ship could actually steer', () => {
    const plan = planPassage(LAS_PALMAS, BRIDGETOWN, 5);
    expect(plan.courseDeg).toBe(250); // west-south-west, down the trades
    expect(plan.distanceNm).toBeCloseTo(2630, -1);
    expect(plan.days).toBe(22);
    expect(dayRun(5)).toBeCloseTo(2, 9); // two degrees of great circle a day
  });
});

describe('the passage', () => {
  it('is the same passage every time it is run', () => {
    const a = passage();
    const b = passage();
    expect(b.legs.length).toBe(a.legs.length);
    expect(b.error.totalNm).toBeCloseTo(a.error.totalNm, 12);
    expect(seededRandom(3)()).toBe(seededRandom(3)());
  });

  // The whole argument, over a passage rather than a day.
  it('fixes the latitude every single day, whatever the clock is doing', () => {
    for (const extra of [
      {},
      { clockRateSecPerDay: 5 / 62 },
      { clockRateSecPerDay: 120 / 42 },
      { carryChronometer: false },
      { clockErrorSec: 1800 },
    ]) {
      const v = passage(extra);
      expect(v.worstLatNm, JSON.stringify(extra)).toBeLessThan(1);
      for (const leg of v.legs) expect(Math.abs(leg.error.latNm)).toBeLessThan(1);
    }
  });

  it('brings a good chronometer into harbour', () => {
    const v = passage({ clockRateSecPerDay: 5 / 62 }); // H4's rate
    expect(v.arrived).toBe(true);
    expect(Math.abs(v.error.lonNm)).toBeLessThan(2);
    expect(v.landfall.offByNm).toBeLessThan(30);
  });

  it('loses the harbour altogether without one', () => {
    const v = passage({ carryChronometer: false });
    expect(v.arrived).toBe(false);
    // On roughly the right parallel, and hundreds of miles along it.
    expect(Math.abs(v.error.latNm)).toBeLessThan(1);
    expect(Math.abs(v.error.lonNm)).toBeGreaterThan(200);
    expect(v.truthToDestNm).toBeGreaterThan(200);
  });

  it('puts a rate of three seconds a day at the edge of the prize', () => {
    const v = passage({ clockRateSecPerDay: 120 / 42 });
    expect(v.arrived).toBe(true);
    expect(Math.abs(v.error.lonNm)).toBeGreaterThan(5);
    expect(Math.abs(v.error.lonNm)).toBeLessThan(40);
  });

  it('orders the four cases by clock quality and nothing else', () => {
    const lon = (extra) => Math.abs(passage(extra).error.lonNm);
    const perfect = lon({});
    const h4 = lon({ clockRateSecPerDay: 5 / 62 });
    const act = lon({ clockRateSecPerDay: 120 / 42 });
    const none = lon({ carryChronometer: false });
    expect(perfect).toBeLessThan(h4);
    expect(h4).toBeLessThan(act);
    expect(act).toBeLessThan(none);
  });
});

describe('the almanac', () => {
  it('reaches the passage, like every other switch', () => {
    // Sailing across early November, when the equation of time is at its worst:
    // dropping it should cost the passage dearly, and once did not, because the
    // voyage had it hardcoded on.
    const november = { departureDate: fromParts(1765, 11, 1) };
    const on = Math.abs(passage({ ...november, useEoT: true }).error.lonNm);
    const off = Math.abs(passage({ ...november, useEoT: false }).error.lonNm);
    expect(on).toBeLessThan(5);
    expect(off).toBeGreaterThan(100);
  });
});

describe('when the sun will not oblige', () => {
  it('falls back to dead reckoning on a day with no usable sight', () => {
    // North of the Arctic circle in December there is no noon sight at all.
    const v = simulateVoyage({
      start: { lat: 71, lon: 25 },
      departureDate: fromParts(1765, 12, 1),
      days: 5,
      courseDeg: 90,
      speedKts: 5,
      steerToDestination: false,
      seed: 2,
    });
    expect(v.blindDays).toBe(5);
    for (const leg of v.legs) {
      expect(leg.sighted.usable).toBe(false);
      // With nothing to correct it, the estimate is pure dead reckoning.
      expect(leg.estimate.lat).toBeCloseTo(leg.dr.lat, 12);
      expect(leg.estimate.lon).toBeCloseTo(leg.dr.lon, 12);
    }
  });

  it('runs a plain course when given no destination to steer for', () => {
    const v = simulateVoyage({
      start: { lat: 0, lon: 0 },
      departureDate: SAILED,
      days: 3,
      courseDeg: 90,
      speedKts: 5,
      seed: 1,
    });
    expect(v.legs).toHaveLength(3);
    expect(v.destination).toBeUndefined();
    expect(v.truth.lon).toBeGreaterThan(5); // ran east
    expect(Math.abs(v.truth.lat)).toBeLessThan(0.1);
  });
});

describe('the acceptance table in ROADMAP.md', () => {
  // Four rows of figures a reader will compare against the chart in front of
  // them. Las Palmas to Bridgetown, 5 knots, 0.6 of a knot setting west.
  const base = {
    start: { lat: 28.13, lon: -15.43 },
    destination: { lat: 13.11, lon: -59.6 },
    departureDate: new Date(Date.UTC(1765, 4, 1)),
    // planPassage gives 22 days for this leg and the store allows 14 more to
    // wander in before giving up, which is the budget the chart is drawn to.
    days: planPassage({ lat: 28.13, lon: -15.43 }, { lat: 13.11, lon: -59.6 }, 5).days + 14,
    speedKts: 5,
    driftKts: 0.6,
    setDeg: 275,
    steeringBiasDeg: 2,
    seed: 7,
    opt: defaultOptions(),
    steerToDestination: true,
  };
  const run = (cfg) => simulateVoyage({ ...base, ...cfg });
  const worstLat = (v) => v.legs.reduce((m, l) => Math.max(m, Math.abs(l.error.latNm)), 0);

  it('holds the latitude to under half a mile whatever the clock does', () => {
    for (const rate of [0, 5 / 62, 120 / 42]) {
      const v = run({ carryChronometer: true, clockErrorSec: 0, clockRateSecPerDay: rate });
      expect(worstLat(v), `rate ${rate}`).toBeCloseTo(0.46, 1);
    }
    expect(worstLat(run({ carryChronometer: false })), 'and blind too').toBeCloseTo(0.46, 1);
  });

  it('makes its landfall in twenty-five days with a clock', () => {
    const perfect = run({ carryChronometer: true, clockErrorSec: 0, clockRateSecPerDay: 0 });
    expect(perfect.legs.length).toBe(25);
    expect(perfect.arrived).toBe(true);
    expect(Math.abs(perfect.error.lonNm)).toBeLessThan(0.1);
    expect(perfect.truthToDestNm).toBeCloseTo(17.5, 0);

    const h4 = run({ carryChronometer: true, clockErrorSec: 0, clockRateSecPerDay: 5 / 62 });
    expect(Math.abs(h4.error.lonNm)).toBeCloseTo(0.5, 1);
    expect(h4.truthToDestNm).toBeCloseTo(17.6, 0);

    const act = run({ carryChronometer: true, clockErrorSec: 0, clockRateSecPerDay: 120 / 42 });
    expect(Math.abs(act.error.lonNm)).toBeCloseTo(17.4, 0);
    expect(act.truthToDestNm).toBeCloseTo(23.5, 0);
  });

  it('never finds the island without one', () => {
    const blind = run({ carryChronometer: false });
    expect(blind.arrived).toBe(false);
    expect(blind.legs.length).toBe(36);
    expect(Math.abs(blind.error.lonNm)).toBeCloseTo(568, -1);
    expect(blind.truthToDestNm).toBeCloseTo(539, -1);
  });
});

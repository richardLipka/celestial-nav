// Taking sights, and working a position out of them.
//
// The two halves of this file are kept deliberately apart, because the whole
// honesty of the simulation is in the separation:
//
//   observe()   knows the truth, and returns only what a navigator could read
//               off an instrument -- a chronometer time, an altitude, a bearing
//
//   reduceLog() knows nothing but the log and the almanac, and has to work the
//               position out of them the way a navigator would
//
// Nothing in reduceLog may look at the true position. If it ever does, the
// demonstration stops being a demonstration.

import { sind, cosd, tand, norm180, degToNm } from './angles.js';
import { solar } from './sun.js';
import { horizon } from './horizon.js';
import { correct, uncorrect } from './corrections.js';
import { latitudeFromMeridian, longitudeFromLAN, intercept, assumedGP } from './fix.js';
import { utcHours, addSeconds, MS_HOUR } from './time.js';

// --- the observing half ---------------------------------------------------

/**
 * What the navigator reads, standing at `truth` at the instant `t`.
 *
 * `jitterMin` is that sight's reading error in arcminutes, drawn once when the
 * sight is taken and kept with it. Without it every sight is perfect, and a
 * perfect sight hides the single most important fact about a noon sight: that
 * the altitude near culmination is flat, so a small error in the reading
 * becomes an enormous error in the *time* of the maximum.
 */
export function observe(t, truth, opt, clockErrorSec = 0, jitterMin = 0) {
  const sky = horizon(truth.lat, truth.lon, t);
  const o = { ...opt, sdMin: sky.solar.sd };
  const Hs = uncorrect(sky.H, o) + jitterMin / 60;
  const c = correct(Hs, o);
  return {
    t,                                     // the true instant, for the simulation
    tChrono: addSeconds(t, clockErrorSec), // what the chronometer showed
    Hs: c.Hs,
    Ha: c.Ha,
    Ho: c.Ho,
    Az: sky.Az,
    terms: c.terms,
    jitterMin,
    trueH: sky.H,
    below: sky.H <= 0,
    lowSight: c.lowSight,
  };
}

/**
 * The instant the sun comes back down to a given altitude.
 *
 * This is not a shortcut: it is the actual method. You clamp the sextant at
 * the morning altitude, watch the sun descend into it, and note the time. The
 * search runs on the true altitude because that is what the observer is
 * watching through the instrument.
 */
export function matchAltitudeTime(targetHo, fromDate, truth, opt, hoursAhead = 10) {
  const f = (ms) => observe(new Date(ms), truth, opt).Ho - targetHo;
  let lo = fromDate.getTime();
  let hi = lo + hoursAhead * MS_HOUR;
  if (f(lo) <= 0 || f(hi) >= 0) return null; // not descending through it
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (f(mid) > 0) lo = mid;
    else hi = mid;
  }
  return new Date((lo + hi) / 2);
}

// --- the reducing half ----------------------------------------------------

/**
 * Time at which the descending limb passes through altitude `y`.
 *
 * Linear between the two samples that bracket it, deliberately. Inverse
 * interpolation in altitude is the wrong tool anywhere near culmination: there
 * dy/dx goes to zero, so x(y) has infinite slope and a quadratic through
 * samples that include the peak produces nonsense. The honest answer is that
 * the crossing is only known as well as the log brackets it -- which is
 * exactly why the method is to clamp the sextant and watch the sun come down
 * to the mark, putting a sample on the crossing itself.
 */
function crossingTime(pts, y) {
  let p = pts[0];
  let q = pts[pts.length - 1];
  for (let i = 0; i < pts.length - 1; i++) {
    if (pts[i].y >= y && pts[i + 1].y <= y) {
      p = pts[i];
      q = pts[i + 1];
      break;
    }
  }
  if (p.y === q.y) return q.x;
  return p.x + ((p.y - y) / (p.y - q.y)) * (q.x - p.x);
}

/** The vertex of a parabola through three points, or null if it is not a peak. */
export function parabolaVertex(p0, p1, p2) {
  const x = [p0.x, p1.x, p2.x];
  const y = [p0.y, p1.y, p2.y];
  const d = (x[0] - x[1]) * (x[0] - x[2]) * (x[1] - x[2]);
  if (Math.abs(d) < 1e-12) return null;
  const a = (x[2] * (y[1] - y[0]) + x[1] * (y[0] - y[2]) + x[0] * (y[2] - y[1])) / d;
  const b =
    (x[2] * x[2] * (y[0] - y[1]) + x[1] * x[1] * (y[2] - y[0]) + x[0] * x[0] * (y[1] - y[2])) / d;
  const c =
    (x[1] * x[2] * (x[1] - x[2]) * y[0] +
      x[2] * x[0] * (x[2] - x[0]) * y[1] +
      x[0] * x[1] * (x[0] - x[1]) * y[2]) /
    d;
  if (a >= 0) return null;
  const xv = -b / (2 * a);
  return { x: xv, y: a * xv * xv + b * xv + c };
}

/**
 * Equal altitudes: the sun passes the same altitude once going up and once
 * coming down, and local apparent noon is halfway between -- except that the
 * declination has moved in the meantime, which is what the correction below
 * accounts for.
 *
 * Every entry is a chronometer time and an altitude. Nothing else.
 */
export function equalAltitudePairs(entries, maxIndex) {
  const out = [];
  const after = entries.slice(maxIndex);

  // A matched afternoon sight will not read exactly the morning altitude --
  // the observer's eye has error too -- so the bracket is judged against a
  // reading error and not against machine precision. Two minutes of arc is
  // several times the noise on a sight, and on the steep limb it is worth only
  // a few seconds of time.
  const TOL = 2 / 60;

  for (let i = 0; i < maxIndex; i++) {
    const am = entries[i];
    for (let j = 0; j < after.length - 1; j++) {
      const p = after[j];
      const q = after[j + 1];
      if (p.Ho >= am.Ho - TOL && q.Ho <= am.Ho + TOL && p.Ho !== q.Ho) {
        const pmMs = crossingTime(
          [p, q].map((e) => ({ x: e.tChrono.getTime(), y: e.Ho })),
          am.Ho,
        );
        const spanHours = (pmMs - am.tChrono.getTime()) / MS_HOUR;
        // How far apart the two samples straddling the crossing were: the whole
        // timing uncertainty of this pair lives in that gap.
        const gapHours = (q.tChrono - p.tChrono) / MS_HOUR;
        // "Observed" means the log actually has a sight at the crossing rather
        // than either side of it -- a question about time, not about altitude,
        // because coarse sampling can land within a couple of arcminutes of the
        // target by luck and still be half an hour away from the moment.
        const toSample = Math.min(
          Math.abs(pmMs - p.tChrono.getTime()),
          Math.abs(pmMs - q.tChrono.getTime()),
        );
        if (spanHours > 0.25) {
          out.push({
            am,
            pmTime: new Date(pmMs),
            Ho: am.Ho,
            gapHours,
            observed: toSample < 60000,
            spanHours,
            midMs: (am.tChrono.getTime() + pmMs) / 2,
          });
        }
        break;
      }
    }
  }
  return out;
}

/**
 * The pair worth trusting.
 *
 * A wide pair is steeper, so a given reading error costs less time and the
 * midpoint is better -- but only if the crossing itself is pinned down. A pair
 * whose crossing had to be interpolated across three hours of log is worthless
 * however wide it is.
 *
 * So: an exactly observed crossing beats an interpolated one, and among equals
 * the widest wins. This is exactly what makes clamping the sextant and watching
 * the sun down to the mark the right thing to do -- it puts a sample on the
 * crossing, and there is nothing left to interpolate.
 */
export function bestPair(pairs) {
  const widest = (list) => list.reduce((a, b) => (!a || b.spanHours > a.spanHours ? b : a), null);
  const observed = pairs.filter((p) => p.observed);
  return observed.length ? widest(observed) : widest(pairs);
}

/**
 * The equation of equal altitudes.
 *
 * With the declination changing by ddec over the interval, the two equal
 * altitudes are not symmetric about the meridian. Differentiating
 * sin H = sin(lat) sin(dec) + cos(lat) cos(dec) cos(t) at constant H gives the
 * hour-angle offset of the midpoint from local apparent noon:
 *
 *     offset = (ddec / 2) * ( tan(lat)/sin(t) - tan(dec)/tan(t) )
 *
 * in degrees of hour angle, where t is half the elapsed interval. It needs the
 * latitude, which is why a navigator works the noon latitude out first.
 */
export function equalAltitudeCorrectionSec(spanHours, ddecDeg, latDeg, decDeg) {
  const t = (spanHours / 2) * 15;
  if (Math.abs(sind(t)) < 1e-6 || Math.abs(tand(t)) < 1e-6) return 0;
  const offsetDeg = (ddecDeg / 2) * (tand(latDeg) / sind(t) - tand(decDeg) / tand(t));
  return (offsetDeg / 15) * 3600; // hour angle -> seconds of time
}

/**
 * Work a position out of a log.
 *
 * Both ways of getting longitude are reported, because the difference between
 * them is the whole point: the highest sight fixes the latitude beautifully
 * and the time of noon terribly, and equal altitudes fix the time of noon.
 */
export function reduceLog(entries, { useEoT = true } = {}) {
  const usable = entries.filter((e) => e.Ho > 0).sort((a, b) => a.tChrono - b.tChrono);
  if (usable.length === 0) return { count: 0, stage: 'none', rejected: entries.length };

  let maxIndex = 0;
  for (let i = 1; i < usable.length; i++) if (usable[i].Ho > usable[maxIndex].Ho) maxIndex = i;
  const max = usable[maxIndex];
  const bracketed = maxIndex > 0 && maxIndex < usable.length - 1;

  // --- the meridian altitude ---------------------------------------------
  // A parabola through the three highest sights recovers the peak even when
  // no single sight caught it. This is how a run of noon sights is worked up.
  let peak = { Ho: max.Ho, tMs: max.tChrono.getTime(), fitted: false };
  if (bracketed) {
    const t0 = max.tChrono.getTime();
    const v = parabolaVertex(
      ...[maxIndex - 1, maxIndex, maxIndex + 1].map((i) => ({
        x: (usable[i].tChrono.getTime() - t0) / 1000,
        y: usable[i].Ho,
      })),
    );
    if (v && Math.abs(v.x) < 4 * 3600) peak = { Ho: v.y, tMs: t0 + v.x * 1000, fitted: true };
  }

  // --- latitude ----------------------------------------------------------
  const sPeak = solar(new Date(peak.tMs));
  const sunBearsSouth = max.Az > 90 && max.Az < 270;
  const lat = latitudeFromMeridian(peak.Ho, sPeak.dec, sunBearsSouth);

  // --- longitude the naive way: call the peak of the curve noon ----------
  const lonByMax = longitudeFromLAN(
    utcHours(new Date(peak.tMs)),
    useEoT ? sPeak.eotDeg : 0,
  );

  // --- longitude by equal altitudes --------------------------------------
  const pairs = equalAltitudePairs(usable, maxIndex);
  const best = bestPair(pairs);

  let equalAlt = null;
  if (best) {
    const dec1 = solar(best.am.tChrono).dec;
    const dec2 = solar(best.pmTime).dec;
    const correctionSec = equalAltitudeCorrectionSec(
      best.spanHours,
      dec2 - dec1,
      lat,
      (dec1 + dec2) / 2,
    );
    const lanChrono = new Date(best.midMs - correctionSec * 1000);
    const sLan = solar(lanChrono);
    equalAlt = {
      pair: best,
      pairs,
      correctionSec,
      midpoint: new Date(best.midMs),
      lanChrono,
      lon: longitudeFromLAN(utcHours(lanChrono), useEoT ? sLan.eotDeg : 0),
      eotMin: sLan.eotMin,
    };
  }

  return {
    count: usable.length,
    rejected: entries.length - usable.length,
    stage: equalAlt ? 'full' : bracketed ? 'latitude' : 'partial',
    bracketed,
    max,
    maxIndex,
    peak,
    z: 90 - peak.Ho,
    dec: sPeak.dec,
    eotMin: sPeak.eotMin,
    sunBearsSouth,
    lat,
    lonByMax,
    equalAlt,
    lon: equalAlt ? equalAlt.lon : lonByMax,
  };
}

/** How far a worked position fell from the ship, in nautical miles. */
export function fixError(fix, truth) {
  const dLat = fix.lat - truth.lat;
  const dLon = norm180(fix.lon - truth.lon);
  const latNm = degToNm(dLat);
  const lonNm = degToNm(dLon) * cosd(truth.lat);
  return { dLat, dLon, latNm, lonNm, totalNm: Math.hypot(latNm, lonNm) };
}

// --- crossing two sights ---------------------------------------------------

/**
 * Two sights, crossed.
 *
 * A single sight is a circle, never a point. Marcq St Hilaire reduces one
 * against an assumed position: work out what the altitude *would* be there,
 * and the difference -- the intercept -- is how far the ship lies toward the
 * body or away from it, along the body's bearing. The line of position runs at
 * right angles to that bearing.
 *
 * Two such lines cross. Working in nautical miles east and north of the
 * assumed position, a line of position is simply
 *
 *     x sin(Zn) + y cos(Zn) = p
 *
 * so crossing a pair is a two-by-two solve whose determinant is
 * sin(Zn1 - Zn2). Sights on nearly the same bearing therefore give nothing at
 * all, which a navigator calls a poor cut.
 *
 * `ap` is the assumed position -- conventionally a round figure, because that
 * is what made the tables easy. An entry may carry its own `ap`, which is how
 * a *running* fix works: reduce each sight from the dead-reckoning position at
 * its own moment, and the run between them cancels out of the algebra.
 */
export function crossSights(a, b, ap, { useEoT = true } = {}) {
  const line = (e) => {
    const from = e.ap || ap;
    const gp = assumedGP(e.tChrono, 0, useEoT); // the GP the navigator computes
    const r = intercept(from, { lat: gp.lat, lon: gp.lon }, e.Ho);
    return { p: r.interceptNm, zn: r.az, Hc: r.Hc, sight: e, ap: from };
  };

  const l1 = line(a);
  const l2 = line(b);
  const cutDeg = Math.abs(norm180(l1.zn - l2.zn));
  const det = sind(l1.zn) * cosd(l2.zn) - cosd(l1.zn) * sind(l2.zn);

  // sin(Zn1 - Zn2) is the determinant. Below about 15 degrees of cut the
  // crossing is worthless, and saying so is better than drawing a point.
  if (Math.abs(det) < sind(15)) return { poorCut: true, cutDeg, lines: [l1, l2] };

  const x = (l1.p * cosd(l2.zn) - cosd(l1.zn) * l2.p) / det; // nm east of the AP
  const y = (sind(l1.zn) * l2.p - l1.p * sind(l2.zn)) / det; // nm north of it
  const lat = ap.lat + y / 60;

  return {
    poorCut: false,
    cutDeg,
    lines: [l1, l2],
    ap,
    offset: { eastNm: x, northNm: y },
    fix: { lat, lon: norm180(ap.lon + x / 60 / cosd(lat)) },
  };
}

/** The best pair of sights in a log to cross, and the fix they give. */
export function runningFix(entries, ap, opts = {}) {
  const usable = entries.filter((e) => e.Ho > 5);
  if (usable.length < 2) return { enough: false, count: usable.length };

  // The nearer the cut is to a right angle, the less a reading error matters.
  let best = null;
  for (let i = 0; i < usable.length; i++) {
    for (let j = i + 1; j < usable.length; j++) {
      const quality = Math.abs(sind(norm180(usable[i].Az - usable[j].Az)));
      if (!best || quality > best.quality) best = { a: usable[i], b: usable[j], quality };
    }
  }

  return { enough: true, count: usable.length, ...crossSights(best.a, best.b, ap, opts) };
}

/** Where a navigator would put the assumed position: a round figure nearby. */
export const roundAssumedPosition = (p) => ({
  lat: Math.round(p.lat),
  lon: Math.round(p.lon),
});

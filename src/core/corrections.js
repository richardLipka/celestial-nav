// Sextant corrections: the chain from what you read to what you meant.
//
// Hs -- sextant altitude, the number on the arc
// Ha -- apparent altitude, after index error and dip
// Ho -- observed altitude, after refraction, semi-diameter and parallax
//
// These are three different quantities and the code keeps them apart, because
// collapsing them into one mutable number is exactly how the corrections
// become invisible -- and the corrections are half the subject.

import { sind, cosd, tand } from './angles.js';

/** Height of eye above the sea, in metres, to the dip of the horizon in arcmin. */
export const dip = (heightM) => (heightM > 0 ? 1.76 * Math.sqrt(heightM) : 0);

/**
 * Bennett's refraction formula, arcminutes, for an apparent altitude in degrees.
 * Below about 5 degrees the real atmosphere stops cooperating; the caller
 * should say so rather than pretend this number means anything down there.
 */
export function refraction(HaDeg) {
  if (HaDeg < -1) return 0;
  return 1 / tand(HaDeg + 7.31 / (HaDeg + 4.4));
}

/** Parallax in altitude, arcminutes. Negligible for the sun; the moon needs it. */
export const parallaxInAltitude = (HaDeg, horizontalParallaxMin = 0.15) =>
  horizontalParallaxMin * cosd(HaDeg);

export const REFRACTION_FLOOR = 5;

export const defaultOptions = () => ({
  indexErrorMin: 0,
  eyeHeightM: 3,
  sdMin: 16.0,
  limb: 'lower',
  dip: true,
  refraction: true,
  semiDiameter: true,
  parallax: true,
});

/**
 * Hs -> Ho. Returns every intermediate value; the UI shows all of them.
 * Altitudes are degrees, correction terms are arcminutes.
 */
export function correct(Hs, opt) {
  const o = { ...defaultOptions(), ...opt };

  const ie = o.indexErrorMin;
  const d = o.dip ? dip(o.eyeHeightM) : 0;
  const Ha = Hs - (ie + d) / 60;

  const refr = o.refraction ? refraction(Ha) : 0;
  const sd = o.semiDiameter ? (o.limb === 'upper' ? -o.sdMin : o.sdMin) : 0;
  const par = o.parallax ? parallaxInAltitude(Ha) : 0;
  const Ho = Ha + (-refr + sd + par) / 60;

  return {
    Hs, Ha, Ho,
    terms: { ie, dip: d, refr, sd, par },
    total: (Ho - Hs) * 60,
    lowSight: Ha < REFRACTION_FLOOR,
  };
}

/**
 * Ho -> Hs. The simulation knows the true altitude from geometry and has to
 * hand the navigator a sextant reading, which is this direction. Fixed-point
 * iteration; the corrections are small and smooth, so it converges at once.
 */
export function uncorrect(Ho, opt) {
  let Hs = Ho;
  for (let i = 0; i < 6; i++) Hs += Ho - correct(Hs, opt).Ho;
  return Hs;
}

/** Labelled rows for the corrections table in the UI. */
export function correctionRows(c) {
  return [
    { key: 'ie', label: 'index error', value: -c.terms.ie },
    { key: 'dip', label: 'dip', value: -c.terms.dip },
    { key: 'refr', label: 'refraction', value: -c.terms.refr },
    { key: 'sd', label: 'semi-diameter', value: c.terms.sd },
    { key: 'par', label: 'parallax', value: c.terms.par },
  ].filter((r) => r.value !== 0);
}

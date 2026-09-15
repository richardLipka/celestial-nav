// Angles. Degrees everywhere in the public API; radians never escape this file
// except through the trig helpers. Latitude is north-positive, longitude is
// east-positive, without exception, all the way to the formatters at the edge.

export const D2R = Math.PI / 180;
export const R2D = 180 / Math.PI;

export const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);

export const sind = (d) => Math.sin(d * D2R);
export const cosd = (d) => Math.cos(d * D2R);
export const tand = (d) => Math.tan(d * D2R);
export const asind = (x) => Math.asin(clamp(x, -1, 1)) * R2D;
export const acosd = (x) => Math.acos(clamp(x, -1, 1)) * R2D;
export const atan2d = (y, x) => Math.atan2(y, x) * R2D;

/** Wrap to [0, 360). */
export function norm360(a) {
  const r = a % 360;
  return r < 0 ? r + 360 : r;
}

/** Wrap to (-180, 180]. Hour angles live here so that culmination reads as a
 *  sign change rather than a discontinuity, and "how far from noon" is |LHA|. */
export function norm180(a) {
  const r = norm360(a);
  return r > 180 ? r - 360 : r;
}

/** Shortest signed difference b - a, wrapped to (-180, 180]. */
export const delta180 = (a, b) => norm180(b - a);

// --- Nautical units -------------------------------------------------------
// One minute of arc on a great circle is one nautical mile, by definition.

export const degToNm = (d) => d * 60;
export const nmToDeg = (nm) => nm / 60;
/** East-west distance made good for a change of longitude at a given latitude. */
export const departureNm = (dLonDeg, latDeg) => dLonDeg * 60 * cosd(latDeg);

// --- Formatting -----------------------------------------------------------
// Navigators write degrees and decimal minutes, not degrees-minutes-seconds.
//
// The decimal separator is module state because Czech writes 50° 05,3′ where
// English writes 50° 05.3′. It affects formatting only -- no arithmetic in
// this file or any other reads it.

let sep = '.';

export function setDecimalSeparator(s) {
  sep = s === ',' ? ',' : '.';
}

export const getDecimalSeparator = () => sep;

const fixed = (v, places) => v.toFixed(places).replace('.', sep);

/** Degrees + decimal minutes of a non-negative angle, with the 59.95' carry. */
export function dm(deg, places = 1, padDeg = 2) {
  let d = Math.floor(deg);
  let m = (deg - d) * 60;
  if (Number(m.toFixed(places)) >= 60) {
    m = 0;
    d += 1;
  }
  const mw = places > 0 ? places + 3 : 2;
  return `${String(d).padStart(padDeg, '0')}° ${fixed(m, places).padStart(mw, '0')}′`;
}

/** `suffix` is [north, south] / [east, west]; the UI passes localised ones. */
export const fmtLat = (deg, places = 1, suffix = ['N', 'S']) =>
  `${dm(Math.abs(deg), places, 2)} ${deg < 0 ? suffix[1] : suffix[0]}`;

export const fmtLon = (deg, places = 1, suffix = ['E', 'W']) =>
  `${dm(Math.abs(deg), places, 3)} ${deg < 0 ? suffix[1] : suffix[0]}`;

/** A plain angle such as an altitude or a zenith distance. */
export const fmtAngle = (deg, places = 1) =>
  `${deg < 0 ? '−' : ''}${dm(Math.abs(deg), places, 2)}`;

/** A correction term, always small, always in arcminutes. */
export const fmtMin = (min, places = 1) =>
  `${min < 0 ? '−' : '+'}${fixed(Math.abs(min), places)}′`;

export const fmtBearing = (deg) => `${String(Math.round(norm360(deg))).padStart(3, '0')}°`;

/** A plain decimal, so callers need not know where the separator lives. */
export const fmtNumber = (v, places = 1) => fixed(v, places);

/** Distance in nautical miles, at a sensible precision for its magnitude. */
export function fmtNm(nm) {
  const a = Math.abs(nm);
  if (a < 10) return `${fixed(nm, 2)} nm`;
  if (a < 1000) return `${fixed(nm, 1)} nm`;
  return `${Math.round(nm).toLocaleString(sep === ',' ? 'cs-CZ' : 'en-GB')} nm`;
}

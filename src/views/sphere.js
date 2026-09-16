// The spherical geometry the theory figures share.
//
// Everything here works in a plain lat/lon frame and knows nothing about what
// that frame means. The theory figures read it as altitude and azimuth --
// horizon for equator, zenith for pole -- so the same code draws the celestial
// sphere in the observer's own coordinates.

import { sind, cosd, asind, atan2d, clamp, R2D } from '../core/angles.js';

const toVec = (lat, lon) => [cosd(lat) * cosd(lon), cosd(lat) * sind(lon), sind(lat)];
const toLL = ([x, y, z]) => ({ lat: asind(z), lon: atan2d(y, x) });
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const unit = (a) => {
  const n = Math.hypot(a[0], a[1], a[2]);
  return n < 1e-9 ? null : mul(a, 1 / n);
};

/**
 * Orthographic projection of the sphere, centred on `centre`.
 *
 * `visible` is the back-face test, and it is what keeps the picture honest:
 * z is the cosine of the angular distance from the centre of the disc, so
 * `z >= 0` is exactly "within 90 degrees of the centre" -- the half of the
 * sphere a viewer outside it can see. Anything drawn through the far side
 * would read as a line across the near one.
 */
export function orthographic({ cx, cy, r, centre }) {
  const { lat: la0, lon: lo0 } = centre;
  return (lat, lon) => {
    const dl = lon - lo0;
    const x = cosd(lat) * sind(dl);
    const y = cosd(la0) * sind(lat) - sind(la0) * cosd(lat) * cosd(dl);
    const z = sind(la0) * sind(lat) + cosd(la0) * cosd(lat) * cosd(dl);
    return { x: cx + r * x, y: cy - r * y, z, visible: z >= 0 };
  };
}

/**
 * The unit tangent at V pointing along the great circle toward T: T with the
 * part of it that points at V taken away. Null when the two coincide or are
 * antipodal, where no direction is defined.
 */
export function tangent(V, T) {
  const v = toVec(V.lat, V.lon);
  const t = toVec(T.lat, T.lon);
  return unit(add(t, mul(v, -dot(t, v))));
}

/**
 * The spherical angle at V between the great circles to A and to B, in
 * degrees, always taken the short way round (0..180).
 */
export function sphericalAngle(V, A, B) {
  const u = tangent(V, A);
  const w = tangent(V, B);
  if (!u || !w) return null;
  return Math.acos(clamp(dot(u, w), -1, 1)) * R2D;
}

/**
 * The arc that marks that angle: points at a fixed angular radius from V,
 * swinging from the direction of A round to the direction of B.
 *
 * This is the only honest way to draw an angle on a sphere. The flat trick --
 * a circular arc round the vertex in screen coordinates -- is right only at
 * the centre of the disc and wrong everywhere else, because the projection
 * foreshortens one axis and not the other.
 */
export function angleArc(V, A, B, radiusDeg, steps = 24) {
  const u = tangent(V, A);
  const w = tangent(V, B);
  if (!u || !w) return [];
  const v = toVec(V.lat, V.lon);
  const th = Math.acos(clamp(dot(u, w), -1, 1));
  const sinTh = Math.sin(th);
  const out = [];
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    // Slerp between the two tangents, so the points are evenly spread round
    // the angle. Directly opposite tangents leave no shorter way round, and
    // there is nothing to draw.
    if (sinTh < 1e-9) return [];
    const dir = unit(
      add(mul(u, Math.sin((1 - f) * th) / sinTh), mul(w, Math.sin(f * th) / sinTh)),
    );
    if (!dir) continue;
    out.push(toLL(add(mul(v, cosd(radiusDeg)), mul(dir, sind(radiusDeg)))));
  }
  return out;
}

/** The point `distDeg` from `from` along the great circle toward `to`. */
export function along(from, to, distDeg) {
  const u = tangent(from, to);
  if (!u) return { ...from };
  const v = toVec(from.lat, from.lon);
  return toLL(add(mul(v, cosd(distDeg)), mul(u, sind(distDeg))));
}

/**
 * The mean direction of a set of points: add the unit vectors and normalise.
 *
 * Averaging latitudes and longitudes instead would be wrong in the ordinary
 * way -- 179 and -179 average to zero, the far side of the sphere -- and this
 * is what decides where to turn the sphere so that an angle comes into view.
 */
export function meanDirection(points) {
  let v = [0, 0, 0];
  for (const p of points) v = add(v, toVec(p.lat, p.lon));
  const u = unit(v);
  return u ? toLL(u) : null;
}

/** A parallel of the frame -- an almucantar, when the frame is the sky. */
export const parallel = (lat, from = -180, to = 180, step = 3) => {
  const out = [];
  for (let lon = from; lon <= to; lon += step) out.push({ lat, lon });
  return out;
};

/** A meridian of the frame -- a vertical circle, when the frame is the sky. */
export const meridian = (lon, from = -90, to = 90, step = 2) => {
  const out = [];
  for (let lat = from; lat <= to; lat += step) out.push({ lat, lon });
  return out;
};

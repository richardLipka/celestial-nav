// The spherical geometry the theory figures share, and the three drawing
// primitives that go with it.
//
// Everything here works in a plain lat/lon frame and knows nothing about what
// that frame means. The theory figures read it as altitude and azimuth --
// horizon for equator, zenith for pole -- so the same code draws the celestial
// sphere in the observer's own coordinates.
//
// Two projections, for two different jobs. The orthographic one is what a
// sphere looks like from outside, and is what the sphere on the stage is
// drawn in; it keeps no angle right except at the centre of the disc. The
// stereographic one is what the flat figure of the triangle is drawn in, and
// keeps every angle and nothing else.

import { sind, cosd, asind, atan2d, clamp, R2D } from '../core/angles.js';
import { greatCircle } from '../core/fix.js';
import { polyline, text } from '../svg.js';

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

// =========================================================================
// Flattening: the same triangle on a page, with its angles intact.
// =========================================================================

/**
 * Stereographic projection centred on `centre`, in plane units, with y
 * already pointing down the way a screen does.
 *
 * It is the one flattening of a sphere that keeps every angle: two great
 * circles crossing at forty degrees on the sphere cross at forty degrees on
 * the page. Nothing else about it survives -- distances and areas are both
 * wrong, and grow without bound toward the far point, which is why the scale
 * is left to `fitBox` rather than fixed here.
 *
 * It is also the reason an angle mark on the flat figure may be an ordinary
 * flat arc while the same mark on the orthographic sphere may not.
 */
export function stereographic(centre) {
  const { lat: la0, lon: lo0 } = centre;
  const c = toVec(la0, lo0);
  const east = [-sind(lo0), cosd(lo0), 0];
  const north = [-sind(la0) * cosd(lo0), -sind(la0) * sind(lo0), cosd(la0)];
  return (lat, lon) => {
    const v = toVec(lat, lon);
    const z = dot(v, c);
    // The far point itself has no image. Nothing drawn here comes within a
    // quadrant of it, and the clamp is there so that a caller who strays
    // gets a finite number rather than an SVG full of NaN.
    const k = 1 / (1 + Math.max(z, -0.99));
    return { x: dot(v, east) * k, y: -dot(v, north) * k };
  };
}

/**
 * A mapping that drops a set of plane points into a box, as large as they
 * will go. One scale for both axes -- two would shear away the angles that
 * were just so carefully kept.
 */
export function fitBox(points, { w, h, pad = 0, max = 900 }) {
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const p of points) {
    if (p.x < x0) x0 = p.x;
    if (p.x > x1) x1 = p.x;
    if (p.y < y0) y0 = p.y;
    if (p.y > y1) y1 = p.y;
  }
  if (!Number.isFinite(x0)) return (p) => ({ ...p });
  // A degenerate triangle is a line, and a line has one span of zero. That
  // axis simply does not constrain the scale -- it must not drive it to zero
  // and take the figure with it.
  const sx = x1 - x0 > 1e-9 ? (w - 2 * pad) / (x1 - x0) : Infinity;
  const sy = y1 - y0 > 1e-9 ? (h - 2 * pad) / (y1 - y0) : Infinity;
  const k = Math.min(sx, sy, max);
  const ox = (w - (x0 + x1) * k) / 2;
  const oy = (h - (y0 + y1) * k) / 2;
  return (p) => ({ x: p.x * k + ox, y: p.y * k + oy });
}

/**
 * A spherical triangle, flattened into a box: the same three corners, the
 * same three angles, and sides that come out curved, because that is what a
 * great circle looks like once its angles have been kept.
 *
 * A plane triangle could not do this. The angles of a spherical triangle add
 * to more than 180 degrees -- the excess *is* its area -- so a figure with
 * three straight sides is wrong about at least one of them.
 *
 * Corners come back in the order they were given, sides as the pairs
 * (0,1), (0,2), (1,2), and `heading[i][j]` is the direction, in degrees
 * anticlockwise from east, that the side toward corner j leaves corner i in.
 * That last one is what an angle mark is drawn from, so the mark and the
 * number beside it cannot disagree.
 */
export function flattenTriangle(A, B, C, { w, h, pad = 0, steps = 60 }) {
  const V = [A, B, C];
  const proj = stereographic(meanDirection(V) || A);
  const pairs = [[0, 1], [0, 2], [1, 2]];
  const plane = pairs.map(([i, j]) =>
    greatCircle(V[i], V[j], steps).map((p) => proj(p.lat, p.lon)));
  const map = fitBox(plane.flat(), { w, h, pad });

  // Measured across the corner -- a twentieth of a degree along the side
  // each way -- rather than from the corner outward. One step outward is a
  // chord, and a chord carries half a step of the curve with it; a step
  // either side cancels that to nothing worth drawing. Taking the chord to
  // the next sample of the side instead would be a step forty times longer
  // again. A scale and a shift turn nothing, so the plane frame will do.
  const heading = (i, j) => {
    const a = along(V[i], V[j], -0.05);
    const b = along(V[i], V[j], 0.05);
    const qa = proj(a.lat, a.lon);
    const qb = proj(b.lat, b.lon);
    return atan2d(-(qb.y - qa.y), qb.x - qa.x);
  };

  return {
    at: V.map((v) => map(proj(v.lat, v.lon))),
    sides: pairs.map(([i, j], k) => ({ from: i, to: j, pts: plane[k].map(map) })),
    angles: [
      sphericalAngle(A, B, C), sphericalAngle(B, A, C), sphericalAngle(C, A, B),
    ],
    heading: [0, 1, 2].map((i) => [0, 1, 2].map((j) => (i === j ? null : heading(i, j)))),
  };
}

// =========================================================================
// Drawing, for whichever sphere is asking.
// =========================================================================

/**
 * Draw a run of lat/lon points, dropping whatever goes round the back.
 *
 * A great circle that leaves the near side and returns has to be drawn as two
 * paths and not one, or the pen crosses the disc on its way between them and
 * writes a line that is not there.
 */
export function track(target, pts, proj, attrs) {
  let run = null;
  for (const p of pts) {
    const q = proj(p.lat, p.lon);
    if (q.visible) (run || (run = [])).push(q);
    else if (run) {
      if (run.length > 1) target.append(polyline(run, attrs));
      run = null;
    }
  }
  if (run && run.length > 1) target.append(polyline(run, attrs));
}

/** The middle of whatever part of an arc is actually on the near side. */
export function midVisible(pts, proj) {
  const vis = pts.map((p) => proj(p.lat, p.lon)).filter((q) => q.visible);
  return vis.length ? vis[Math.floor((vis.length - 1) / 2)] : null;
}

/**
 * Where to set a label for an arc: square to the middle of it, on the side
 * away from `away` -- which is normally the middle of the figure.
 *
 * A label lying along the line it names reads as part of that line. On a
 * figure whose lines are sides and whose corners are angles, that is the one
 * confusion worth spending pixels to avoid: what is written along a line here
 * is a length, and the angles are somewhere else entirely.
 *
 * Takes screen points, so the caller has already decided what is visible.
 */
export function besideMid(pts, away, k = 18) {
  if (!pts || !pts.length) return null;
  const i = Math.floor((pts.length - 1) / 2);
  const m = pts[i];
  const a = pts[Math.max(0, i - 1)];
  const b = pts[Math.min(pts.length - 1, i + 1)];
  let nx = -(b.y - a.y);
  let ny = b.x - a.x;
  const n = Math.hypot(nx, ny);
  if (n < 1e-6) return { x: m.x, y: m.y };
  nx /= n;
  ny /= n;
  if (away && (m.x - away.x) * nx + (m.y - away.y) * ny < 0) {
    nx = -nx;
    ny = -ny;
  }
  return { x: m.x + nx * k, y: m.y + ny * k };
}

/**
 * An angle of a spherical triangle, drawn where it is: a short arc swung
 * round the vertex on the surface, with its symbol pushed out past it.
 *
 * Without these the only marks on the sphere are the three sides, and what
 * they carry are distances. A distance written along a line is not an angle,
 * however many degrees it is quoted in, and a reader looking for the angles
 * of a triangle will not find them there.
 */
export function markAngle(target, proj, { V, A, B, radiusDeg, cls, label, textCls }) {
  const pts = angleArc(V, A, B, radiusDeg, 28);
  if (!pts.length) return;
  track(target, pts, proj, { class: `tri-ang ${cls}` });
  const q = midVisible(pts, proj);
  if (!q || !label) return;
  const v = proj(V.lat, V.lon);
  const dx = q.x - v.x;
  const dy = q.y - v.y;
  const n = Math.hypot(dx, dy) || 1;
  target.append(
    text(q.x + (dx / n) * 15, q.y + (dy / n) * 15 + 4, label, {
      class: `lbl gk ${textCls}`,
      'text-anchor': 'middle',
    }),
  );
}

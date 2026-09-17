// Figures for the theory tab. All three are live: they are drawn from the same
// derived state as the simulation, so the angles on the page are the angles of
// the sight currently on the timeline.

import { el, g, text, polyline, polygon, clear, arc, onCircle, arrowhead } from '../svg.js';
import { sind, cosd, norm180, fmtAngle, fmtBearing } from '../core/angles.js';
import { greatCircle } from '../core/fix.js';
import {
  orthographic, parallel, meridian, flattenTriangle, track, markAngle, besideMid,
} from './sphere.js';
import { corners } from './theorysphere.js';
import { t } from '../i18n.js';

// =========================================================================
// The navigational triangle on the celestial sphere.
//
// Drawn in the observer's own frame -- altitude for latitude, azimuth for
// longitude -- so the horizon is the equator of the picture, the zenith is its
// pole, and the triangle PZX sits where it actually is in the sky.
// =========================================================================

const W = 430;
const H3 = 360;
const CX = 215;
const CY = 178;
const R = 140;

const projector = (centre) => orthographic({ cx: CX, cy: CY, r: R, centre });

export function createTriangle3D(onRotate) {
  const svg = el('svg', {
    viewBox: `0 0 ${W} ${H3}`,
    class: 'fig-svg globe',
    role: 'img',
    'aria-label': t('aria.pzx'),
  });

  let drag = null;
  svg.addEventListener('pointerdown', (e) => {
    drag = { x: e.clientX, y: e.clientY };
    svg.setPointerCapture(e.pointerId);
  });
  svg.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const k = 180 / (svg.getBoundingClientRect().width || W);
    onRotate((e.clientX - drag.x) * -k, (e.clientY - drag.y) * k);
    drag = { x: e.clientX, y: e.clientY };
  });
  const stop = () => (drag = null);
  svg.addEventListener('pointerup', stop);
  svg.addEventListener('pointercancel', stop);

  return { node: svg, update: (d, s) => drawTriangle3D(svg, d, s) };
}

function drawTriangle3D(svg, d, s) {
  clear(svg);
  const lat = s.lat;
  const { H, Az } = d.sky;
  const north = lat >= 0;

  // The three corners, in altitude/azimuth.
  const { P, Z, X } = corners(lat, H, Az);

  const centre = s.theoryView;
  const proj = projector(centre);

  svg.append(el('circle', { cx: CX, cy: CY, r: R, class: 'globe-sea' }));

  // Below the horizon is a different world; shade it.
  const rim = [];
  for (let i = 0; i <= 180; i++) rim.push({ lat: 0, lon: -180 + i * 2 });
  track(svg, rim, proj, { class: 'horizon-circle' });

  for (let alt = -60; alt <= 60; alt += 30) if (alt) track(svg, parallel(alt), proj, { class: 'grat' });
  for (let az = 0; az < 360; az += 30) track(svg, meridian(az), proj, { class: 'grat' });

  // The observer's meridian: the great circle through N, the zenith and S.
  track(svg, meridian(0), proj, { class: 'obs-meridian' });
  track(svg, meridian(180), proj, { class: 'obs-meridian' });

  // The celestial equator, where declination is measured from.
  track(svg, d.equatorTrack.map((p) => ({ lat: p.H, lon: p.Az })), proj, { class: 'cel-equator-3d' });

  // --- the triangle -------------------------------------------------------
  const side = (a, b, cls) => track(svg, greatCircle(a, b, 80), proj, { class: cls });
  side(P, Z, 'tri-side phi');   // 90 - latitude
  side(P, X, 'tri-side dec');   // 90 - declination
  side(Z, X, 'tri-side zen');   // the zenith distance

  if (H > 0) {
    // The altitude itself, from the horizon up to the sun.
    side({ lat: 0, lon: Az }, X, 'tri-alt');
  }

  // The two angles the text names, drawn on the surface where they are. The
  // three labels below quote degrees as well, but those are lengths of arc:
  // without these marks the picture has all its numbers lying along its lines
  // and nothing at all standing in its corners.
  markAngle(svg, proj, {
    V: P, A: Z, B: X, radiusDeg: 15, cls: 'time', label: 't', textCls: 'lha-text',
  });
  markAngle(svg, proj, {
    V: Z, A: P, B: X, radiusDeg: 13, cls: 'az', label: 'Z', textCls: 'az-lbl',
  });

  svg.append(el('circle', { cx: CX, cy: CY, r: R, class: 'globe-rim' }));

  // --- labels -------------------------------------------------------------
  const mark = (p, label, cls) => {
    const q = proj(p.lat, p.lon);
    if (!q.visible) return;
    svg.append(el('circle', { cx: q.x, cy: q.y, r: 4.5, class: `mark ${cls}` }));
    svg.append(text(q.x + 8, q.y - 6, label, { class: `lbl gk ${cls}-text` }));
  };
  mark(P, 'P', 'tri-p');
  mark(Z, 'Z', 'tri-z');
  mark(X, 'X', 'tri-x');

  // Beside the side, in two short lines -- see the note on the same job in
  // theorysphere.js, which this figure is the narrow-layout twin of.
  const away = [P, Z, X].map((p) => proj(p.lat, p.lon)).reduce(
    (acc, q, i, all) => ({ x: acc.x + q.x / all.length, y: acc.y + q.y / all.length }),
    { x: 0, y: 0 },
  );
  const sideLabel = (a, b, main, val, cls) => {
    const pts = greatCircle(a, b, 40).map((p) => proj(p.lat, p.lon)).filter((q) => q.visible);
    const q = besideMid(pts, away, 16);
    if (!q) return;
    svg.append(text(q.x, q.y, main, { class: `lbl mn ${cls}`, 'text-anchor': 'middle' }));
    svg.append(text(q.x, q.y + 12, val, { class: 'lbl tiny muted', 'text-anchor': 'middle' }));
  };
  // P is the elevated pole, so PZ is 90 - |φ| in either hemisphere -- but PX is
  // 90 - δ only north of the equator. Using |δ| put a label of 67 degrees on an
  // arc this figure had just drawn at 113, which is the one contradiction a
  // drawn figure cannot get away with.
  const decFromPole = d.sky.solar.dec * (north ? 1 : -1);
  sideLabel(P, Z, north ? '90°−φ' : '90°+φ', fmtAngle(90 - Math.abs(lat)), 'phi-text');
  sideLabel(P, X, north ? '90°−δ' : '90°+δ', fmtAngle(90 - decFromPole), 'dec-text');
  if (H > 0) sideLabel(Z, X, 'z', fmtAngle(90 - H), 'zen-text');

  // cardinal points on the horizon
  for (const [key, az] of [['sky.N', 0], ['sky.E', 90], ['sky.S', 180], ['sky.W', 270]]) {
    const q = proj(0, az);
    if (!q.visible) continue;
    svg.append(text(q.x, q.y + 11, t(key), { class: 'lbl tiny', 'text-anchor': 'middle' }));
  }

  svg.append(
    text(W - 10, H3 - 8, t('fig.dragSphere'), { class: 'lbl tiny muted', 'text-anchor': 'end' }),
  );
  svg.append(text(10, H3 - 8, t('fig.pzxNote'), { class: 'lbl tiny muted' }));
}

// =========================================================================
// The same triangle, flattened.
//
// Not a schematic. This is the triangle the sphere above is drawing, put on
// the page in the one projection that keeps its angles -- so the angle marked
// at P is the hour angle to look at, and not merely a label sitting near a
// corner that was chosen once and never moved. The sides come out curved
// because the angles were kept; a figure with three straight sides would have
// to be wrong about at least one of them, the three of a spherical triangle
// adding to more than 180 degrees.
//
// The scale is not kept -- no flattening keeps both -- so the sides carry
// their lengths in writing. Their *ratios* on the page mean nothing, and the
// old figure, which drew the shortest side longest, is what taught us to say
// so out loud.
// =========================================================================

const FW = 430;
const FH = 336;

// The corners in the order `flattenTriangle` hands them back.
const AT_P = 0;
const AT_Z = 1;
const AT_X = 2;

export function createTriangleFlat() {
  const svg = el('svg', {
    viewBox: `0 0 ${FW} ${FH}`,
    class: 'fig-svg',
    role: 'img',
    'aria-label': t('aria.pzxFlat'),
  });
  return { node: svg, update: (d, s) => drawFlat(svg, d, s) };
}

function drawFlat(svg, d, s) {
  clear(svg);
  const { P, Z, X } = corners(s.lat, d.sky.H, d.sky.Az);
  // Room at the bottom for the one line of caption, and padding enough for
  // the labels, which all hang outside the triangle.
  const fig = flattenTriangle(P, Z, X, { w: FW, h: FH - 34, pad: 58 });
  const [pP, pZ, pX] = fig.at;
  const cx = (pP.x + pZ.x + pX.x) / 3;
  const cy = (pP.y + pZ.y + pX.y) / 3;

  const clampX = (x) => Math.min(Math.max(x, 28), FW - 28);
  const clampY = (y) => Math.min(Math.max(y, 16), FH - 34);

  // The spherical excess is the area, and an area of nothing is a triangle of
  // nothing: at local apparent noon P, Z and X stand on one meridian. Then
  // the figure has no inside, "push the label outward" means nothing, and
  // every label lands on the line and on the next one along. So when there is
  // no inside, `line` is the way across it: the corner names go down one side
  // of the line and everything else down the other.
  const excess = fig.angles[AT_P] + fig.angles[AT_Z] + fig.angles[AT_X] - 180;
  const line = (() => {
    if (excess >= 1) return null;
    const dx = pX.x - pP.x;
    const dy = pX.y - pP.y;
    const n = Math.hypot(dx, dy) || 1;
    return { x: -dy / n, y: dx / n };
  })();
  const shift = (p, k) => ({ x: clampX(p.x + line.x * k), y: clampY(p.y + line.y * k) });

  /** A point pushed `k` pixels away from the middle of the figure. */
  const outward = (p, k) => {
    if (line) return shift(p, -k - 8);
    const dx = p.x - cx;
    const dy = p.y - cy;
    const n = Math.hypot(dx, dy) || 1;
    return { x: clampX(p.x + (dx / n) * k), y: clampY(p.y + (dy / n) * k) };
  };

  // --- the three sides ----------------------------------------------------
  // In the order `flattenTriangle` pairs them: PZ, PX, ZX.
  //
  // P is the elevated pole -- the one above your horizon. Measured from it,
  // PZ is 90 - |φ| always, but PX is 90 - δ only north of the equator: south
  // of it the sign of the declination flips with the pole. Taking |δ| instead
  // is wrong by up to 47 degrees whenever the declination is contrary in name
  // to the latitude -- half the year -- and the sphere beside it draws the
  // true arc, so the two would disagree on screen.
  const north = s.lat >= 0;
  const decFromPole = d.sky.solar.dec * (north ? 1 : -1);
  const sides = [
    { cls: 'phi', focus: 'phi', main: north ? '90°−φ' : '90°+φ', val: fmtAngle(90 - Math.abs(s.lat)) },
    { cls: 'dec', focus: 'dec', main: north ? '90°−δ' : '90°+δ', val: fmtAngle(90 - decFromPole) },
    { cls: 'zen', focus: 'zen', main: 'z = 90°−H', val: fmtAngle(90 - d.sky.H) },
  ];
  fig.sides.forEach((side, i) => {
    svg.append(polyline(side.pts, { class: `tri-side ${sides[i].cls}` }));
  });

  // --- the angles at P and Z ---------------------------------------------
  // Swung from the direction the side actually leaves the corner in, which is
  // why the mark and the number beside it agree. A flat arc is right here and
  // only here: the projection is conformal, so what the page shows at this
  // corner is what the sphere has.
  //
  // Each is a hit target, and clicking it puts the same angle on the main
  // sphere. The transparent `hit-line` under the arc is what makes a two-pixel
  // stroke catchable by a finger.
  const gap = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const ang = (at, from, to, cls, label, sub, textCls, focus) => {
    const v = fig.at[at];
    const a1 = fig.heading[at][from];
    const a2 = fig.heading[at][to];
    if (a1 === null || a2 === null) return;
    let sweep = a2 - a1;
    while (sweep > 180) sweep -= 360;
    while (sweep < -180) sweep += 360;
    // Small enough to sit inside the corner however tight the corner is.
    const r = Math.max(13, Math.min(40, 0.3 * Math.min(gap(v, fig.at[from]), gap(v, fig.at[to]))));
    // Set along the bisector, and started there rather than centred on it
    // unless the bisector runs up or down the page. A label reading
    // "t = 44° 59,5′" is a hundred units wide; centred on a point fifty from
    // a sharp corner, half of it lands back on the corner and on the two
    // sides meeting there.
    const bisect = a1 + sweep / 2;
    // A collapsed angle has no bisector worth following: nothing is at
    // stake in a direction, and what matters is landing clear of the line.
    const [lx, ly] = line
      ? [shift(v, 34).x, v.y]
      : onCircle(v.x, v.y, r + 10, bisect);
    const cos = line ? line.x : cosd(bisect);
    const anchor = Math.abs(cos) < 0.3 ? 'middle' : (cos > 0 ? 'start' : 'end');
    const y = clampY(ly) + (!line && sind(bisect) < -0.6 ? 11 : 0);
    svg.append(
      g({ class: 'hit', 'data-focus': focus }, [
        arc(v.x, v.y, r, a1, a1 + sweep, { class: 'hit-line' }),
        arc(v.x, v.y, r, a1, a1 + sweep, { class: cls, 'stroke-width': 2.4 }),
        text(clampX(lx), y, label, { class: `lbl mn ${textCls}`, 'text-anchor': anchor }),
        sub ? text(clampX(lx), y + 13, sub, { class: 'lbl tiny muted', 'text-anchor': anchor }) : null,
      ]),
    );
  };
  // The angle at P is the hour angle. The angle at Z is the azimuth angle Z,
  // which stops at 180 where the bearing Zn runs the whole way round -- so it
  // is written as Z, with the bearing under it, and the two are different
  // numbers for half of every day.
  ang(AT_P, AT_Z, AT_X, 'ang-time', `t = ${fmtAngle(fig.angles[AT_P])}`, null, 'lha-text', 'lha');
  ang(AT_Z, AT_P, AT_X, 'ang-az', `Z = ${fmtAngle(fig.angles[AT_Z])}`,
    `Zn = ${fmtBearing(d.sky.Az)}`, 'az-lbl', 'az');

  // --- corners ------------------------------------------------------------
  const corner = (p, name, sub, cls) => {
    const q = outward(p, 19);
    svg.append(el('circle', { cx: p.x, cy: p.y, r: 5, class: `mark ${cls}` }));
    svg.append(text(q.x, q.y, name, { class: `lbl gk ${cls}-text`, 'text-anchor': 'middle' }));
    svg.append(text(q.x, q.y + 13, sub, { class: 'lbl tiny muted', 'text-anchor': 'middle' }));
  };
  corner(pP, 'P', t('fig.pole'), 'tri-p');
  corner(pZ, 'Z', t('fig.zenith'), 'tri-z');
  corner(pX, 'X', t('fig.sun'), 'tri-x');

  // --- side labels --------------------------------------------------------
  // Clicking a side shows the angle it is the complement of: PZ against the
  // pole's altitude, PX against the declination, ZX against the altitude. Each
  // pair is adjacent on the sphere and makes up a quarter circle, which is the
  // fact these three "90 minus something" sides are all standing on.
  fig.sides.forEach((side, i) => {
    // Far enough out for a label of two lines to clear a side running
    // diagonally: the offset is square to the side, and what has to clear it
    // is the corner of a box some sixty units across. Square to the side
    // rather than straight out from the middle, which reads the same for an
    // open triangle and stacks all three labels down the line for a collapsed
    // one -- the shape this figure most needs to stay legible in.
    const raw = line
      ? shift(side.pts[Math.floor((side.pts.length - 1) / 2)], 34)
      : besideMid(side.pts, { x: cx, y: cy }, 32);
    const q = { x: clampX(raw.x), y: clampY(raw.y) };
    svg.append(
      g({ class: 'hit', 'data-focus': sides[i].focus }, [
        text(q.x, q.y - 4, sides[i].main, { class: `lbl mn ${sides[i].cls}-text`, 'text-anchor': 'middle' }),
        text(q.x, q.y + 9, sides[i].val, { class: 'lbl tiny muted', 'text-anchor': 'middle' }),
      ]),
    );
  });

  // A figure with no interior is not a fault in the drawing, it is the next
  // section, so the caption says which of the two you are looking at.
  svg.append(
    text(FW / 2, FH - 9, t(line ? 'fig.flatCollapsed' : 'fig.flatNote'), {
      class: 'lbl tiny muted', 'text-anchor': 'middle',
    }),
  );
}

// =========================================================================
// Longitude, seen from above the pole: the wedge between three meridians.
// =========================================================================

const PW = 430;
const PH = 330;
const PCX = 215;
const PCY = 168;
const PR = 124;

export function createHourAngle() {
  const svg = el('svg', {
    viewBox: `0 0 ${PW} ${PH}`,
    class: 'fig-svg',
    role: 'img',
    'aria-label': t('aria.hourAngle'),
  });
  return { node: svg, update: (d, s) => drawHourAngle(svg, d, s) };
}

function drawHourAngle(svg, d, s) {
  clear(svg);
  const north = s.lat >= 0;
  // Seen from above the north pole the Earth turns anticlockwise, and hour
  // angles are measured westward -- which is clockwise on this picture.
  const dir = north ? -1 : 1;
  const gha = d.sky.solar.gha;
  const lon = s.lon;
  const lha = norm180(gha + lon);

  const at = (west) => 90 + dir * west; // maths angle of a meridian `west` degrees west of Greenwich

  svg.append(el('circle', { cx: PCX, cy: PCY, r: PR, class: 'globe-sea' }));
  // Lit half: centred on the subsolar meridian.
  const sunAng = at(gha);
  const lit = [];
  for (let i = -90; i <= 90; i += 3) lit.push(onCircle(PCX, PCY, PR, sunAng + i));
  svg.append(polygon([[PCX, PCY], ...lit], { class: 'globe-lit' }));
  svg.append(el('circle', { cx: PCX, cy: PCY, r: PR, class: 'globe-rim' }));

  const ray = (angle, cls, len = PR) => {
    const [x, y] = onCircle(PCX, PCY, len, angle);
    svg.append(el('line', { x1: PCX, y1: PCY, x2: x, y2: y, class: cls }));
    return [x, y];
  };

  const gAng = at(0);
  const oAng = at(-lon); // the observer's longitude, west-positive on this figure
  const sAng = sunAng;

  const [gx, gy] = ray(gAng, 'prime-meridian');
  const [ox, oy] = ray(oAng, 'obs-meridian thick');
  const [sx, sy] = ray(sAng, 'gp-meridian thick');

  // Sun, off to the side of its own meridian.
  const [sunX, sunY] = onCircle(PCX, PCY, PR + 46, sAng);
  svg.append(el('circle', { cx: sunX, cy: sunY, r: 9, class: 'sun-disc' }));
  for (let k = -1; k <= 1; k++) {
    const a = sAng + k * 7;
    const [x1, y1] = onCircle(PCX, PCY, PR + 34, a);
    const [x2, y2] = onCircle(PCX, PCY, PR + 6, a);
    svg.append(el('line', { x1, y1, x2, y2, class: 'sun-ray' }));
  }

  // --- the three angles ---------------------------------------------------
  const lbl = (r, a1, a2, txt, cls) => {
    const [x, y] = onCircle(PCX, PCY, r, (a1 + a2) / 2);
    return text(x, y + 4, txt, { class: `lbl mn ${cls}`, 'text-anchor': 'middle' });
  };
  svg.append(arc(PCX, PCY, 96, gAng, sAng, { class: 'ang-gha' }));
  svg.append(lbl(110, gAng, sAng, `GHA ${fmtAngle(gha)}`, 'lha-text'));

  // The local hour angle is the one of the three that is also an angle in the
  // navigational triangle, so it is the one the main sphere can show.
  svg.append(
    g({ class: 'hit', 'data-focus': 'lha' }, [
      arc(PCX, PCY, 72, oAng, sAng, { class: 'hit-line' }),
      arc(PCX, PCY, 72, oAng, sAng, { class: 'ang-lha' }),
      lbl(84, oAng, sAng, `t ${fmtAngle(Math.abs(lha))}`, 'lha-text'),
    ]),
  );

  svg.append(arc(PCX, PCY, 48, gAng, oAng, { class: 'ang-lon' }));
  svg.append(lbl(60, gAng, oAng, `λ ${fmtAngle(Math.abs(lon))}`, 'phi-text'));

  svg.append(text(gx + (gx > PCX ? 6 : -6), gy - 6, t('fig.greenwich'),
    { class: 'lbl tiny lha-text', 'text-anchor': gx > PCX ? 'start' : 'end' }));
  svg.append(text(ox + (ox > PCX ? 6 : -6), oy + 12, t('fig.yourMeridian'),
    { class: 'lbl tiny phi-text', 'text-anchor': ox > PCX ? 'start' : 'end' }));

  // rotation arrow
  const rot = arc(PCX, PCY, PR + 22, 158, 200, { class: 'rot-arrow' });
  svg.append(rot);
  const [ax, ay] = onCircle(PCX, PCY, PR + 22, 200);
  // The arc runs 158 -> 200, so its head sits at 200 and the direction of
  // travel there is 200 + 90 anticlockwise or 200 - 90 clockwise. The label on
  // it says "Earth turns": from above the north pole that is anticlockwise,
  // from above the south pole clockwise. Hour angles run the other way, which
  // is what `dir` handles, and is what these two were confused with.
  svg.append(arrowhead(ax, ay, north ? 290 : 110, 6, { class: 'rot-head' }));
  svg.append(text(20, 24, t('fig.rotation'), { class: 'lbl tiny muted' }));

  svg.append(text(PW / 2, PH - 10, t('fig.hourAngleNote'),
    { class: 'lbl tiny muted', 'text-anchor': 'middle' }));
}

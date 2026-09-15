// Figures for the theory tab. All three are live: they are drawn from the same
// derived state as the simulation, so the angles on the page are the angles of
// the sight currently on the timeline.

import { el, g, text, polyline, polygon, clear, arc, onCircle, arrowhead } from '../svg.js';
import { sind, cosd, norm180, norm360, fmtAngle, fmtBearing } from '../core/angles.js';
import { greatCircle, angularDistance } from '../core/fix.js';
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

function projector(centre) {
  const { lat: la0, lon: lo0 } = centre;
  return (lat, lon) => {
    const dl = lon - lo0;
    const x = cosd(lat) * sind(dl);
    const y = cosd(la0) * sind(lat) - sind(la0) * cosd(lat) * cosd(dl);
    const z = sind(la0) * sind(lat) + cosd(la0) * cosd(lat) * cosd(dl);
    return { x: CX + R * x, y: CY - R * y, z, visible: z >= 0 };
  };
}

function track(svg, pts, proj, attrs) {
  let run = null;
  for (const p of pts) {
    const q = proj(p.lat, p.lon);
    if (q.visible) (run || (run = [])).push(q);
    else if (run) {
      if (run.length > 1) svg.append(polyline(run, attrs));
      run = null;
    }
  }
  if (run && run.length > 1) svg.append(polyline(run, attrs));
}

const circleAt = (lat, step = 3) => {
  const out = [];
  for (let lon = -180; lon <= 180; lon += step) out.push({ lat, lon });
  return out;
};

const meridianAt = (lon, from = -90, to = 90) => {
  const out = [];
  for (let lat = from; lat <= to; lat += 2) out.push({ lat, lon });
  return out;
};

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
  const P = { lat: Math.abs(lat), lon: north ? 0 : 180 };
  const Z = { lat: 90, lon: 0 };
  const X = { lat: H, lon: Az };

  const centre = s.theoryView;
  const proj = projector(centre);

  svg.append(el('circle', { cx: CX, cy: CY, r: R, class: 'globe-sea' }));

  // Below the horizon is a different world; shade it.
  const rim = [];
  for (let i = 0; i <= 180; i++) rim.push({ lat: 0, lon: -180 + i * 2 });
  track(svg, rim, proj, { class: 'horizon-circle' });

  for (let alt = -60; alt <= 60; alt += 30) if (alt) track(svg, circleAt(alt), proj, { class: 'grat' });
  for (let az = 0; az < 360; az += 30) track(svg, meridianAt(az), proj, { class: 'grat' });

  // The observer's meridian: the great circle through N, the zenith and S.
  track(svg, meridianAt(0), proj, { class: 'obs-meridian' });
  track(svg, meridianAt(180), proj, { class: 'obs-meridian' });

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

  const sideLabel = (a, b, label, cls) => {
    const gc = greatCircle(a, b, 2);
    const m = proj(gc[1].lat, gc[1].lon);
    if (!m.visible) return;
    svg.append(text(m.x, m.y - 6, label, { class: `lbl mn ${cls}`, 'text-anchor': 'middle' }));
  };
  // P is the elevated pole, so PZ is 90 - |φ| in either hemisphere -- but PX is
  // 90 - δ only north of the equator. Using |δ| put a label of 67 degrees on an
  // arc this figure had just drawn at 113, which is the one contradiction a
  // drawn figure cannot get away with.
  const decFromPole = d.sky.solar.dec * (north ? 1 : -1);
  sideLabel(P, Z, `${north ? '90°−φ' : '90°+φ'} = ${fmtAngle(90 - Math.abs(lat))}`, 'phi-text');
  sideLabel(P, X, `${north ? '90°−δ' : '90°+δ'} = ${fmtAngle(90 - decFromPole)}`, 'dec-text');
  if (H > 0) sideLabel(Z, X, `z = ${fmtAngle(d.z)}`, 'zen-text');

  // cardinal points on the horizon
  for (const [key, az] of [['sky.N', 0], ['sky.E', 90], ['sky.S', 180], ['sky.W', 270]]) {
    const q = proj(0, az);
    if (!q.visible) continue;
    svg.append(text(q.x, q.y + 11, t(key), { class: 'lbl tiny', 'text-anchor': 'middle' }));
  }

  svg.append(
    text(W - 10, H3 - 8, t('globe.drag'), { class: 'lbl tiny muted', 'text-anchor': 'end' }),
  );
  svg.append(text(10, H3 - 8, t('fig.pzxNote'), { class: 'lbl tiny muted' }));
}

// =========================================================================
// The same triangle, flattened -- the textbook figure, with the cosine rule
// written on it.
// =========================================================================

const FW = 430;
const FH = 290;

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
  const P = [215, 46];
  const Z = [78, 232];
  const X = [352, 232];

  // Arcs bulge away from the centroid, so the figure reads as spherical.
  const cx = (P[0] + Z[0] + X[0]) / 3;
  const cy = (P[1] + Z[1] + X[1]) / 3;
  const bow = (a, b, k = 0.17) => {
    const mx = (a[0] + b[0]) / 2;
    const my = (a[1] + b[1]) / 2;
    return [mx + (mx - cx) * k, my + (my - cy) * k];
  };
  const arcPath = (a, b, cls) => {
    const c = bow(a, b);
    svg.append(el('path', {
      d: `M${a[0]} ${a[1]} Q${c[0].toFixed(1)} ${c[1].toFixed(1)} ${b[0]} ${b[1]}`,
      fill: 'none', class: cls,
    }));
    return c;
  };

  const cPZ = arcPath(P, Z, 'tri-side phi');
  const cPX = arcPath(P, X, 'tri-side dec');
  const cZX = arcPath(Z, X, 'tri-side zen');

  // --- the angles at P and Z ---------------------------------------------
  const ang = (v, a, b, r, cls) => {
    const a1 = (Math.atan2(-(a[1] - v[1]), a[0] - v[0]) * 180) / Math.PI;
    const a2 = (Math.atan2(-(b[1] - v[1]), b[0] - v[0]) * 180) / Math.PI;
    let d2 = a2 - a1;
    while (d2 > 180) d2 -= 360;
    while (d2 < -180) d2 += 360;
    svg.append(arc(v[0], v[1], r, a1, a1 + d2, { class: cls, 'stroke-width': 2.2 }));
    return onCircle(v[0], v[1], r + 16, a1 + d2 / 2);
  };
  const lp = ang(P, cPZ, cPX, 34, 'ang-time');
  const lz = ang(Z, cPZ, cZX, 30, 'ang-az');

  svg.append(text(lp[0], lp[1] + 4, 't', { class: 'lbl gk lha-text', 'text-anchor': 'middle' }));
  svg.append(text(lz[0], lz[1] + 4, 'Zₙ', { class: 'lbl gk az-lbl', 'text-anchor': 'middle' }));

  // --- corners ------------------------------------------------------------
  const corner = (p, name, sub, cls, dx, dy, anchor) => {
    svg.append(el('circle', { cx: p[0], cy: p[1], r: 5, class: `mark ${cls}` }));
    svg.append(text(p[0] + dx, p[1] + dy, name, { class: `lbl gk ${cls}-text`, 'text-anchor': anchor }));
    svg.append(text(p[0] + dx, p[1] + dy + 14, sub, { class: 'lbl tiny muted', 'text-anchor': anchor }));
  };
  corner(P, 'P', t('fig.pole'), 'tri-p', 0, -16, 'middle');
  corner(Z, 'Z', t('fig.zenith'), 'tri-z', -12, 6, 'end');
  corner(X, 'X', t('fig.sun'), 'tri-x', 12, 6, 'start');

  // --- side labels --------------------------------------------------------
  const sideLbl = (c, main, val, cls, dx, dy, anchor) => {
    svg.append(text(c[0] + dx, c[1] + dy, main, { class: `lbl mn ${cls}`, 'text-anchor': anchor }));
    svg.append(text(c[0] + dx, c[1] + dy + 13, val, { class: 'lbl tiny muted', 'text-anchor': anchor }));
  };
  // P is the elevated pole -- the one the 3D figure draws, and the one above
  // your horizon. Measured from it, PZ is 90 - |φ| always, but PX is 90 - δ
  // only north of the equator: south of it the sign of the declination flips
  // with the pole. Taking |δ| instead is wrong by up to 47 degrees whenever the
  // declination is contrary in name to the latitude -- half the year -- and the
  // 3D figure beside it draws the true arc, so the two would disagree on screen.
  const south = s.lat < 0;
  const dec = d.sky.solar.dec * (south ? -1 : 1);
  sideLbl(cPZ, south ? '90°+φ' : '90°−φ', fmtAngle(90 - Math.abs(s.lat)), 'phi-text', -10, 0, 'end');
  sideLbl(cPX, south ? '90°+δ' : '90°−δ', fmtAngle(90 - dec), 'dec-text', 10, 0, 'start');
  sideLbl(cZX, 'z = 90°−H', fmtAngle(d.z), 'zen-text', 0, 26, 'middle');
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
  svg.append(arc(PCX, PCY, 96, gAng, sAng, { class: 'ang-gha' }));
  svg.append(arc(PCX, PCY, 72, oAng, sAng, { class: 'ang-lha' }));
  svg.append(arc(PCX, PCY, 48, gAng, oAng, { class: 'ang-lon' }));

  const lbl = (r, a1, a2, txt, cls) => {
    const [x, y] = onCircle(PCX, PCY, r, (a1 + a2) / 2);
    svg.append(text(x, y + 4, txt, { class: `lbl mn ${cls}`, 'text-anchor': 'middle' }));
  };
  lbl(110, gAng, sAng, `GHA ${fmtAngle(gha)}`, 'lha-text');
  lbl(84, oAng, sAng, `t ${fmtAngle(Math.abs(lha))}`, 'lha-text');
  lbl(60, gAng, oAng, `λ ${fmtAngle(Math.abs(lon))}`, 'phi-text');

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

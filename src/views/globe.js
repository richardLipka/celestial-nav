// The same instant from outside: an orthographic globe, drawn in SVG rather
// than WebGL because what this panel needs is a labelled diagram -- angle
// arcs, a shaded wedge, dashed circles of position -- and not a lit sphere.
//
// Every curve is sampled, projected, and split into its visible runs by one
// helper, which handles the graticule, the great circles and the circle of
// equal altitude identically.

import { el, text, polygon, clear } from '../svg.js';
import { sind, cosd, norm180, fmtAngle } from '../core/angles.js';
import { t } from '../i18n.js';
import { fLat, fLon } from '../ui/format.js';
import { angularDistance, greatCircle, destination, lineOfPosition } from '../core/fix.js';
import { orthographic, track, parallel, meridian, drawLand } from './sphere.js';

const W = 424;
const H = 412;
const CX = 212;
const CY = 194;
const R = 150;

// The projection, the clipping at the limb and the graticule are the same
// here as on the theory tab's spheres, and come from the same place. This
// panel is the Earth and that one is the sky, but a sphere is a sphere.
const projector = (centre) => orthographic({ cx: CX, cy: CY, r: R, centre });

/**
 * The night hemisphere.
 *
 * Under orthographic projection the terminator -- a great circle whose pole is
 * the subsolar direction -- projects to an ellipse. Working in a frame whose
 * u axis points at the projected sun, the terminator is exactly
 *
 *     u = -cos(gamma) * sqrt(1 - w^2)
 *
 * where gamma is the angle between the subsolar direction and the view axis.
 * Night is everything to the -u side of it, so the outline is that curve plus
 * the far half of the limb.
 */
function nightOutline(center, gp) {
  const gamma = angularDistance(center, gp);
  if (sind(gamma) < 1e-4) return gamma < 90 ? null : 'full';

  const cg = cosd(gamma);
  const dl = gp.lon - center.lon;
  const xs = cosd(gp.lat) * sind(dl);
  const ys = cosd(center.lat) * sind(gp.lat) - sind(center.lat) * cosd(gp.lat) * cosd(dl);
  const th = (Math.atan2(ys, xs) * 180) / Math.PI;

  const pt = (u, w) => ({
    x: CX + R * (u * cosd(th) - w * sind(th)),
    y: CY - R * (u * sind(th) + w * cosd(th)),
  });

  const pts = [];
  for (let i = 0; i <= 90; i++) {
    const a = th + 90 + i * 2; // the limb, from one terminator end to the other
    pts.push({ x: CX + R * cosd(a), y: CY - R * sind(a) });
  }
  for (let i = 0; i <= 120; i++) {
    const w = -1 + (2 * i) / 120;
    pts.push(pt(-cg * Math.sqrt(Math.max(0, 1 - w * w)), w));
  }
  return pts;
}

export function createGlobe(onRotate) {
  const svg = el('svg', {
    viewBox: `0 0 ${W} ${H}`,
    class: 'fig-svg globe',
    role: 'img',
    'aria-label': t('aria.globe'),
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

  return { node: svg, update: (d, s) => draw(svg, d, s) };
}

function draw(svg, d, s) {
  clear(svg);
  const proj = projector(s.globeCenter);
  const obs = d.observer;
  const gp = d.gpTrue;
  const gpa = d.gpAssumed;
  const offset = Math.abs(d.gpOffsetDeg) > 1e-9;

  svg.append(el('circle', { cx: CX, cy: CY, r: R, class: 'globe-sea' }));

  if (s.show.night) {
    const night = nightOutline(s.globeCenter, gp);
    if (night === 'full') {
      svg.append(el('circle', { cx: CX, cy: CY, r: R, class: 'globe-night' }));
    } else if (night) {
      svg.append(polygon(night, { class: 'globe-night' }));
    }
  }

  // --- graticule ----------------------------------------------------------
  for (let lon = -180; lon < 180; lon += 30) {
    if (lon === 0) continue;
    track(svg, meridian(lon), proj, { class: 'grat' });
  }
  for (let lat = -60; lat <= 60; lat += 30) {
    if (lat === 0) continue;
    track(svg, parallel(lat), proj, { class: 'grat' });
  }

  // The coastlines, when asked for: an overview, to say what part of the
  // world the sight is being taken in.
  if (s.show.map) drawLand(svg, proj, null, { class: 'coast' });

  // The reference frame, when asked for: the equator, the two poles, and the
  // prime meridian -- the one line on this globe that is a human convention
  // rather than a physical fact, and drawn as one.
  if (s.show.frame) {
    track(svg, parallel(0), proj, { class: 'grat equator' });
    track(svg, meridian(0), proj, { class: 'prime-meridian' });
  }

  // --- the GP's parallel of declination -----------------------------------
  // A finer step than the graticule: this parallel is being read, not just
  // placed. The shared parallel() takes its step last, after the span.
  track(svg, parallel(gp.lat, -180, 180, 2), proj, { class: 'dec-parallel' });

  // --- local hour angle, as the wedge between two meridians ---------------
  track(svg, meridian(obs.lon), proj, { class: 'obs-meridian' });
  track(svg, meridian(gp.lon), proj, { class: 'gp-meridian' });
  const wedgeLat = obs.lat >= 0 ? 74 : -74;
  const dlon = norm180(gp.lon - obs.lon);
  const wedge = [];
  for (let i = 0; i <= 48; i++) wedge.push({ lat: wedgeLat, lon: obs.lon + (dlon * i) / 48 });
  track(svg, wedge, proj, { class: 'lha-arc' });
  const wmid = proj(wedgeLat, obs.lon + dlon / 2);
  if (wmid.visible && Math.abs(dlon) > 6) {
    svg.append(text(wmid.x, wmid.y - 6, `${t('globe.lha')} ${fmtAngle(Math.abs(dlon))}`, {
      class: 'tiny lbl lha-text', 'text-anchor': 'middle',
    }));
  }

  // --- the sight: distance to the GP, and the circle it puts you on -------
  track(svg, greatCircle(obs, gp, 90), proj, { class: 'z-arc' });
  if (s.show.cop) track(svg, d.cop, proj, { class: 'cop' });
  if (s.show.cop && d.copAssumed) track(svg, d.copAssumed, proj, { class: 'cop assumed' });
  if (s.show.lop) track(svg, d.lop, proj, { class: 'lop' });

  // --- two sights crossed ------------------------------------------------
  if (s.show.cross && d.cross && d.cross.fix) {
    for (const line of d.cross.lines) {
      // The line of position runs at right angles to the body's bearing,
      // through the point the intercept steps you to.
      const on = destination(line.ap, line.p >= 0 ? line.zn : line.zn + 180,
        Math.abs(line.p) / 60);
      track(svg, lineOfPosition(on, line.zn, 7), proj, { class: 'cross-lop' });
      track(svg, greatCircle(line.ap, on, 24), proj, { class: 'cross-intercept' });
    }
    mark(svg, proj(d.cross.ap.lat, d.cross.ap.lon), 'cross-ap', t('globe.ap'), 3.5);
    mark(svg, proj(d.cross.fix.lat, d.cross.fix.lon), 'cross-fix', t('globe.crossFix'), 5);
  }

  // The clock error, made physical: the GP displaced along its own parallel.
  if (offset) {
    const seg = [];
    for (let i = 0; i <= 40; i++) seg.push({ lat: gp.lat, lon: gp.lon + (d.gpOffsetDeg * i) / 40 });
    track(svg, seg, proj, { class: 'gp-shift' });
  }

  svg.append(el('circle', { cx: CX, cy: CY, r: R, class: 'globe-rim' }));

  // --- markers ------------------------------------------------------------
  const zMid = proj(...midpointLL(obs, gp));
  if (zMid.visible) {
    svg.append(text(zMid.x, zMid.y - 7, `z ${fmtAngle(d.z)}`, {
      class: 'mn lbl zen-text', 'text-anchor': 'middle',
    }));
  }

  const pGp = proj(gp.lat, gp.lon);
  const pGpa = proj(gpa.lat, gpa.lon);
  mark(svg, pGp, 'gp', t('globe.gp'), 6);
  if (offset) {
    // A small clock error puts the two marks on top of each other, so only
    // name the assumed one once it has somewhere of its own to sit.
    const apart = Math.hypot(pGpa.x - pGp.x, pGpa.y - pGp.y);
    mark(svg, pGpa, 'gp-assumed', apart > 18 ? t('globe.gpAssumed') : '', 5);
  }
  mark(svg, proj(obs.lat, obs.lon), 'observer', t('globe.you'), 4.5);
  // The poles go with the frame, and are marked the way the theory tab marks
  // the celestial poles they stand under.
  if (s.show.frame) {
    mark(svg, proj(90, 0), 'pole-off', 'Pn', 3.5);
    mark(svg, proj(-90, 0), 'pole-off', 'Ps', 3.5);
  }

  // --- readout ------------------------------------------------------------
  const rows = [
    [t('globe.rowGp'), `${fLat(gp.lat)}  ${fLon(gp.lon)}`],
    [t('globe.rowYou'), `${fLat(obs.lat)}  ${fLon(obs.lon)}`],
  ];
  rows.forEach(([k, v], i) => {
    svg.append(text(14, H - 26 + i * 18, k, { class: 'tiny lbl readout-k' }));
    svg.append(text(46, H - 26 + i * 18, v, { class: 'mn lbl readout-v' }));
  });
  svg.append(text(W - 14, H - 9, t('globe.drag'), {
    class: 'tiny lbl muted', 'text-anchor': 'end',
  }));
}

function midpointLL(a, b) {
  const gc = greatCircle(a, b, 2);
  const m = gc[Math.floor(gc.length / 2)];
  return [m.lat, m.lon];
}

function mark(svg, p, cls, label, r) {
  if (!p.visible) return;
  svg.append(el('circle', { cx: p.x, cy: p.y, r, class: `mark ${cls}` }));
  if (label) svg.append(text(p.x + r + 5, p.y - r, label, { class: `tiny lbl ${cls}-text` }));
}

// The main sphere: the one picture the theory tab keeps on screen while you
// read past it.
//
// It is the observer's own sky -- altitude for latitude, azimuth for longitude
// -- so the horizon is the equator of the picture and the zenith is its pole.
// Two things are drawn on top of that frame: the navigational triangle, when
// the section being read is about it, and one angle at a time, when the reader
// asks for it by clicking. Every angle here is drawn where it actually is,
// never approximated with a flat arc round a projected vertex.

import { el, text, clear, runs } from '../svg.js';
import {
  sind, cosd, asind, atan2d, norm180, norm360, fmtAngle, fmtBearing,
} from '../core/angles.js';
import { greatCircle } from '../core/fix.js';
import { hourCircle } from '../core/horizon.js';
import {
  orthographic, angleArc, parallel, meridian, track, midOf, markAngle, besideMid,
} from './sphere.js';
import { t } from '../i18n.js';

const W = 372;
const H = 356;
const CX = 186;
const CY = 170;
const R = 143;

/** Every angle the sphere can single out, in the order the chips show them. */
export const FOCUS_KEYS = ['phi', 'dec', 'alt', 'zen', 'lha', 'az'];

/** The symbol each one wears, on the chip and on the sphere alike. */
export const FOCUS_SYMBOL = {
  phi: 'φ', dec: 'δ', alt: 'H', zen: 'z', lha: 't', az: 'Zn',
};

/** Which section of the theory puts which angle on the sphere. */
export const SECTION_VIEW = {
  fact: { focus: 'zen' },
  triangle: { triangle: true },
  latitude: { triangle: true, focus: 'phi' },
  longitude: { focus: 'lha' },
  crossing: { focus: 'az' },
  sensitivity: { focus: 'az' },
};

/**
 * The three corners, in the observer's frame. P is the *elevated* pole -- the
 * one above this observer's horizon -- which is why its azimuth turns with the
 * hemisphere and its altitude is the latitude without its sign.
 */
export const corners = (lat, H0, Az) => ({
  P: { lat: Math.abs(lat), lon: lat >= 0 ? 0 : 180 },
  Z: { lat: 90, lon: 0 },
  X: { lat: H0, lon: Az },
});

/**
 * Where one angle lives on the sphere: the arc that *is* that angle, the
 * label that goes on it, and any faint lines that make it readable.
 *
 * Kept pure and exported so the arithmetic can be tested away from the DOM.
 * The test that matters is that each arc's own angular size is the quantity
 * its label quotes -- a figure that draws one number and writes another is
 * worse than no figure.
 */
export function focusSpec(key, ctx) {
  const { lat, dec, H: alt, lha, az } = ctx;
  const { P, Z, X } = corners(lat, alt, az);

  switch (key) {
    // The elevated pole's altitude is the latitude. Same fact as PZ = 90 - |φ|,
    // read from the horizon up instead of from the zenith down.
    case 'phi':
      return {
        arc: greatCircle({ lat: 0, lon: P.lon }, P, 48),
        cls: 'phi',
        label: `φ = ${fmtAngle(Math.abs(lat))}`,
        textCls: 'phi-text',
      };

    // Declination is measured from the celestial equator along the hour
    // circle, so the arc starts at the point of the equator that shares the
    // sun's hour angle -- not at the sun's foot on the horizon.
    case 'dec': {
      const foot = {
        lat: asind(cosd(lat) * cosd(lha)),
        lon: norm360(atan2d(-sind(lha), -sind(lat) * cosd(lha))),
      };
      return {
        arc: greatCircle(foot, X, 48),
        cls: 'dec',
        label: `δ = ${fmtAngle(Math.abs(dec))}`,
        textCls: 'dec-text',
        context: [greatCircle(P, foot, 40)],
      };
    }

    case 'alt':
      return {
        arc: greatCircle({ lat: 0, lon: az }, X, 48),
        cls: 'alt',
        label: `H = ${fmtAngle(alt)}`,
        textCls: 'alt-text',
      };

    case 'zen':
      return {
        arc: greatCircle(Z, X, 48),
        cls: 'zen',
        label: `z = ${fmtAngle(90 - alt)}`,
        textCls: 'zen-text',
      };

    // The hour angle is the angle *at the pole*, between your meridian and the
    // sun's. It is a rotation of the Earth, and this is where you can see that.
    case 'lha':
      return {
        arc: angleArc(P, Z, X, 16, 28),
        cls: 'time',
        label: `t = ${fmtAngle(Math.abs(lha))}`,
        textCls: 'lha-text',
        vertex: P,
        context: [greatCircle(P, Z, 40), greatCircle(P, X, 40)],
      };

    // The azimuth is the angle at the zenith between the meridian and the
    // vertical circle the sun stands on -- but it is *counted* from north
    // right round through east, so the shorter way between those two
    // directions would write 296 on an arc of 64. In this frame the zenith is
    // the pole and the azimuth is the longitude, so the angle mark is simply
    // an almucantar swept from north round to the sun's bearing, and the same
    // sweep along the horizon says where on the horizon the sun stands.
    case 'az': {
      const sweep = (alt) => {
        const out = [];
        for (let a = 0; a <= az; a += 3) out.push({ lat: alt, lon: a });
        out.push({ lat: alt, lon: az });
        return out;
      };
      return {
        arc: sweep(90 - 16),
        cls: 'az',
        label: `Zn = ${fmtBearing(az)}`,
        textCls: 'az-lbl',
        vertex: Z,
        context: [sweep(0)],
      };
    }

    default:
      return null;
  }
}

/**
 * Everything the sphere is currently being asked to show, as points.
 *
 * The far half of a sphere is not drawn -- that is what makes it a sphere and
 * not a map -- so an angle can perfectly well be pointed at and be round the
 * back. This is the list the view checks before deciding to turn.
 */
export function wantedPoints(view, ctx) {
  const { P, Z, X } = corners(ctx.lat, ctx.H, ctx.az);
  const out = [];
  if (view.triangle) out.push(P, Z, X);
  if (view.focus) {
    const spec = focusSpec(view.focus, ctx);
    if (spec) out.push(...spec.arc);
  }
  return out;
}

export function createTheorySphere(onRotate) {
  const svg = el('svg', {
    viewBox: `0 0 ${W} ${H}`,
    class: 'fig-svg globe th-sphere glass',
    role: 'img',
    'aria-label': t('aria.theorySphere'),
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

  return { node: svg, draw: (d, s, view) => draw(svg, d, s, view) };
}

function draw(svg, d, s, view = {}) {
  clear(svg);
  const { triangle = false, focus = null } = view;
  const lat = s.lat;
  const alt = d.sky.H;
  const az = d.sky.Az;
  const { P, Z, X } = corners(lat, alt, az);
  const proj = orthographic({ cx: CX, cy: CY, r: R, centre: s.theoryView });

  svg.append(el('circle', { cx: CX, cy: CY, r: R, class: 'globe-sea' }));

  // --- the frame ----------------------------------------------------------
  for (let a = -60; a <= 60; a += 30) if (a) track(svg, parallel(a), proj, { class: 'grat' });
  for (let a = 0; a < 360; a += 30) track(svg, meridian(a), proj, { class: 'grat' });
  // The horizon and your own meridian carry on round the back: they are what
  // the rest of the picture is placed against, and a horizon that stops at
  // the limb leaves half the sun's day with nothing to be above or below.
  // The graticule above does not -- drawn twice it is a wire ball.
  track(svg, parallel(0), proj, { class: 'horizon-circle' }, { class: 'horizon-circle behind' });
  track(svg, meridian(0), proj, { class: 'obs-meridian' }, { class: 'obs-meridian behind' });
  track(svg, meridian(180), proj, { class: 'obs-meridian' }, { class: 'obs-meridian behind' });

  // Greenwich, on the sky: the hour circle of the prime meridian, which is
  // where the sun stands at Greenwich apparent noon. The angle between it and
  // your own meridian, at the pole, *is* your longitude -- so without it the
  // longitude slider moves a number and nothing else, and with it the whole
  // frame swings. Dashed and in the colour of the hour, like the prime
  // meridian on the Earth globe, because it is the same human convention and
  // not a physical fact.
  const greenwich = hourCircle(lat, norm180(s.lon)).map((p) => ({ lat: p.H, lon: p.Az }));
  track(svg, greenwich, proj, { class: 'prime-meridian' }, { class: 'prime-meridian behind' });
  // Dotted, not dashed: the sun's own track for the day is dashed and the two
  // are the same colour, being the same kind of thing.
  track(svg, d.equatorTrack.map((p) => ({ lat: p.H, lon: p.Az })), proj, {
    class: 'cel-equator',
  });

  // The sun's own road for the day. X slides along it as the clock moves, and
  // that is the point of having a clock on this tab at all.
  const day = d.track.map((p) => ({ lat: p.H, lon: p.Az, up: p.H >= 0 }));
  for (const run of runs(day, (p) => !p.up)) track(svg, run, proj, { class: 'diurnal below' });
  for (const run of runs(day, (p) => p.up)) track(svg, run, proj, { class: 'diurnal' });

  // --- the triangle -------------------------------------------------------
  // Drawn when the section being read is about it, and when the reader has
  // clicked an angle, because then the triangle is the context that angle
  // sits in. Not for an angle the text merely happens to be on: the first
  // section is about the zenith distance alone, and a triangle there would be
  // three sections ahead of the argument.
  if (triangle) {
    const side = (a, b, cls) =>
      track(svg, greatCircle(a, b, 80), proj, { class: cls }, { class: `${cls} behind` });
    side(P, Z, 'tri-side phi');
    side(P, X, 'tri-side dec');
    side(Z, X, 'tri-side zen');

    // And its angles, which are the other half of what a triangle is. The
    // three side labels quote degrees too, but what they are quoting is
    // distance along an arc; drawn without these marks the picture has its
    // numbers lying on the lines and nothing standing at the corners at all.
    //
    // The angle being singled out is left to the focus below, which draws it
    // heavier and writes its value -- two marks on one corner would only be
    // the same arc twice.
    if (focus !== 'lha') {
      markAngle(svg, proj, {
        V: P, A: Z, B: X, radiusDeg: 15, cls: 'time', label: 't', textCls: 'lha-text',
        through: true,
      });
    }
    // The mark at Z is the angle Z of the triangle, which is not the bearing:
    // it stops at 180 and the bearing runs the whole way round. The `az`
    // focus draws the bearing instead, swept from north, and the prose in
    // this very section is about the difference.
    if (focus !== 'az') {
      markAngle(svg, proj, {
        V: Z, A: P, B: X, radiusDeg: 13, cls: 'az', label: 'Z', textCls: 'az-lbl',
        through: true,
      });
    }
  }

  // --- the one angle being asked about ------------------------------------
  const spec = focus ? focusSpec(focus, { lat, dec: d.sky.solar.dec, H: alt, lha: d.sky.lha, az }) : null;
  if (spec) {
    for (const c of spec.context || []) {
      track(svg, c, proj, { class: 'focus-ctx' }, { class: 'focus-ctx behind' });
    }
    track(svg, spec.arc, proj, { class: `focus-arc ${spec.cls}` },
      { class: `focus-arc ${spec.cls} behind` });
  }

  svg.append(el('circle', { cx: CX, cy: CY, r: R, class: 'globe-rim' }));

  // --- corners ------------------------------------------------------------
  const mark = (p, label, cls, extra = '') => {
    const q = proj(p.lat, p.lon);
    const far = q.visible ? '' : ' behind';
    svg.append(el('circle', {
      cx: q.x, cy: q.y, r: 4.5, class: `mark ${cls}${extra}${far}`,
    }));
    svg.append(text(q.x + 8, q.y - 6, label, { class: `lbl gk ${cls}-text${far}` }));
  };
  mark(P, 'P', 'tri-p');
  mark(Z, 'Z', 'tri-z');
  // A sun below the horizon is drawn hollow. It is where the arithmetic puts
  // it -- the equations do not stop working at sunset -- but there is no
  // sight to be taken, and a filled disc is a promise the sky is not keeping.
  mark(X, 'X', 'tri-x', alt < 0 ? ' down' : '');

  // --- labels -------------------------------------------------------------
  // The sides carry their lengths only while nothing else is being pointed at:
  // a focus writes its own number, and two numbers on one picture is one too
  // many. North of the equator PX is 90 - δ; south of it the elevated pole is
  // the other one and the sign of the declination goes with it.
  if (triangle && !spec) {
    const north = lat >= 0;
    const decFromPole = d.sky.solar.dec * (north ? 1 : -1);
    // The middle of the triangle on the page, to push each label away from.
    const away = [P, Z, X].map((p) => proj(p.lat, p.lon)).reduce(
      (acc, q, i, all) => ({ x: acc.x + q.x / all.length, y: acc.y + q.y / all.length }),
      { x: 0, y: 0 },
    );
    // Two short lines rather than one long one. Written out as
    // "90°−δ = 110° 15,9′" the label is nearly half the width of the sphere,
    // and no amount of moving it keeps that clear of the lines it crosses.
    const sideLabel = (a, b, main, val, cls) => {
      const pts = greatCircle(a, b, 40).map((p) => proj(p.lat, p.lon)).filter((q) => q.visible);
      const q = besideMid(pts, away, 16);
      if (!q) return;
      svg.append(text(q.x, q.y, main, { class: `lbl mn ${cls}`, 'text-anchor': 'middle' }));
      svg.append(text(q.x, q.y + 12, val, { class: 'lbl tiny muted', 'text-anchor': 'middle' }));
    };
    sideLabel(P, Z, north ? '90°−φ' : '90°+φ', fmtAngle(90 - Math.abs(lat)), 'phi-text');
    sideLabel(P, X, north ? '90°−δ' : '90°+δ', fmtAngle(90 - decFromPole), 'dec-text');
    sideLabel(Z, X, 'z', fmtAngle(90 - alt), 'zen-text');
  }

  if (spec) {
    const q = midOf(spec.arc, proj, true);
    if (q) {
      // An angle mark sits right on its vertex, so its label is pushed away
      // from the vertex rather than simply upward, where it would land on it.
      let [lx, ly] = [q.x, q.y - 8];
      if (spec.vertex) {
        const v = proj(spec.vertex.lat, spec.vertex.lon);
        const dx = q.x - v.x;
        const dy = q.y - v.y;
        const n = Math.hypot(dx, dy) || 1;
        lx = q.x + (dx / n) * 20;
        ly = q.y + (dy / n) * 20 + 4;
      }
      svg.append(text(lx, ly, spec.label, {
        class: `lbl mn ${spec.textCls}${q.visible ? '' : ' behind'}`, 'text-anchor': 'middle',
      }));
    }
  }

  {
    const vis = greenwich.map((p) => proj(p.lat, p.lon)).filter((q) => q.visible);
    const q = besideMid(vis, { x: CX, y: CY }, 13);
    if (q) {
      svg.append(text(q.x, q.y, t('fig.greenwich'), {
        class: 'lbl tiny lha-text', 'text-anchor': 'middle',
      }));
    }
  }

  for (const [key, a] of [['sky.N', 0], ['sky.E', 90], ['sky.S', 180], ['sky.W', 270]]) {
    const q = proj(0, a);
    if (!q.visible) continue;
    svg.append(text(q.x, q.y + 11, t(key), { class: 'lbl tiny', 'text-anchor': 'middle' }));
  }

  // Said on the figure as well as beside it: a reader looking at the picture
  // and wondering why the sun is under the horizon circle should not have to
  // look anywhere else to find out that that is exactly what has happened.
  if (alt < 0) {
    svg.append(text(W / 2, 14, t('fig.sunDown'), {
      class: 'lbl tiny fig-warn', 'text-anchor': 'middle',
    }));
  }

  svg.append(text(W - 8, H - 8, t('fig.dragSphere'), { class: 'lbl tiny muted', 'text-anchor': 'end' }));
  svg.append(text(8, H - 8, t('fig.pzxNote'), { class: 'lbl tiny muted' }));
}

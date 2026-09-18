// The meridian section: the proof that latitude is a subtraction.
//
// A cut through the Earth on the observer's own meridian -- north at the top,
// south at the bottom, the plane of the equator across the middle -- and not
// a picture of the sky. It used to be possible to read it either way, which
// is fatal in a figure whose whole argument is about where the observer is
// standing. So the Earth is named and shaded on its night side, the observer
// is a labelled dot on the surface, and the sun is a direction out in space
// rather than a body sitting on the rim.
//
// Because the sun's rays arrive parallel, the angle z measured at the
// observer reappears unchanged at the Earth's centre, where it sits on top of
// the declination and fills out the latitude. The two inner arcs always
// visibly sum to the outer one.
//
// The three directions the theory names are marked: the zenith Z straight
// overhead, the sun X, and the celestial pole P -- whose direction, from
// anywhere on Earth, is the Earth's own axis, which is why the dashed ray
// leaving the observer is parallel to the one through the poles.
//
// Note what never enters this drawing: a time.

import { el, text, title, clear, angleMark, onCircle, arc } from '../svg.js';
import { sind, cosd, fmtAngle } from '../core/angles.js';
import { fmtClock } from '../core/time.js';
import { t } from '../i18n.js';
import { fLat } from '../ui/format.js';

const W = 470;
const H = 380;
const CX = 168;
const CY = 152;
const R = 86;

// The drawing has to hold at every latitude the slider reaches, not only at
// the one it opens on: at 75 degrees the ship is nearly at the top of the
// globe and the rays leaving it have almost nowhere to go. So the globe is
// small enough that the zenith label still clears the rule at the extremes,
// and the pole ray measures the room it has before it takes it.
const RULE = 300;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function createMeridian() {
  const svg = el('svg', {
    viewBox: `0 0 ${W} ${H}`,
    class: 'fig-svg',
    role: 'img',
    'aria-label': t('aria.meridian'),
  });
  return { node: svg, update: (d, s) => draw(svg, d, s) };
}

function draw(svg, d, s) {
  clear(svg);

  const phi = s.lat;
  const dec = d.noon.dec;
  const sunSouth = d.noon.sunBearsSouth;
  const north = phi >= 0;

  const P = (deg, r) => onCircle(CX, CY, r, deg);
  const [ox, oy] = P(phi, R);
  const sun = [cosd(dec), -sind(dec)]; // screen vector pointing at the sun

  // --- the Earth ----------------------------------------------------------
  svg.append(el('circle', { cx: CX, cy: CY, r: R, class: 'globe-sea' }));
  const night = arc(CX, CY, R, dec + 90, dec + 270, { class: 'globe-night' });
  night.setAttribute('d', `${night.getAttribute('d')} Z`);
  night.removeAttribute('fill'); // the class fills it; arc() defaults to none
  svg.append(night);
  svg.append(el('circle', { cx: CX, cy: CY, r: R, class: 'globe-rim' }));
  // Named inside itself, because a shaded disc with lines through it is a
  // picture of the sky just as readily as a picture of the Earth.
  // Off the centre: every angle arc in the figure springs from there.
  const [wx, wy] = P(-138, R * 0.56);
  svg.append(text(wx, wy, t('mer.earth'), { class: 'cap lbl muted', 'text-anchor': 'middle' }));

  const [nx, ny] = P(90, R + 18);
  const [sx, sy] = P(-90, R + 18);
  svg.append(el('line', { x1: nx, y1: ny, x2: sx, y2: sy, class: 'earth-axis' }));
  svg.append(text(nx, ny - 5, t('mer.N'), { class: 'tiny lbl', 'text-anchor': 'middle' }));
  svg.append(text(sx, sy + 12, t('mer.S'), { class: 'tiny lbl', 'text-anchor': 'middle' }));

  const [ex1, ey1] = P(180, R + 20);
  const [ex2, ey2] = P(0, R + 20);
  svg.append(el('line', { x1: ex1, y1: ey1, x2: ex2, y2: ey2, class: 'equator-line' }));
  svg.append(text(ex1 + 2, ey1 - 7, t('mer.equatorPlane'), { class: 'cap lbl' }));

  // --- the sun, as a direction rather than a body on the rim --------------
  // Two rays, one through the centre and one through the ship, and they are
  // parallel: that is the whole of why the angle at the one is the angle at
  // the other. The disc is far enough out to read as "this way", not "here".
  const SUN = 174;
  for (const [px, py, len] of [[CX, CY, SUN], [ox, oy, 118]]) {
    svg.append(
      el('line', {
        x1: px + sun[0] * len, y1: py + sun[1] * len, x2: px, y2: py, class: 'sun-ray',
      }),
    );
  }
  const [sunX, sunY] = [CX + sun[0] * SUN, CY + sun[1] * SUN];
  for (let k = -1; k <= 1; k++) {
    const a = -dec + k * 9;
    const [x1, y1] = onCircle(sunX, sunY, 20, a);
    const [x2, y2] = onCircle(sunX, sunY, 11, a);
    svg.append(el('line', { x1, y1, x2, y2, class: 'sun-ray' }));
  }
  svg.append(el('circle', { cx: sunX, cy: sunY, r: 8, class: 'sun-disc' }));
  svg.append(text(sunX + sun[0] * 30, sunY + sun[1] * 30 + 5, 'X', {
    class: 'gk lbl tri-x-text', 'text-anchor': 'middle',
  }));
  svg.append(text(sunX + sun[0] * 30, sunY + sun[1] * 30 + 18, t('fig.sun'), {
    class: 'tiny lbl muted', 'text-anchor': 'middle',
  }));

  // The point the sun stands over, on the surface it stands over.
  const [gx, gy] = P(dec, R);
  svg.append(el('circle', { cx: gx, cy: gy, r: 3.6, class: 'mark gp' }));

  // --- the zenith, straight up from the ship ------------------------------
  // The letter is the outermost thing on the ray and its name sits on the
  // inward side of it: put the name outside and a zenith at 75 degrees south
  // would be writing into the arithmetic.
  const [zx, zy] = P(phi, R + 40);
  svg.append(el('line', { x1: CX, y1: CY, x2: zx, y2: zy, class: 'zenith-ray' }));
  const [lzx, lzy] = P(phi, R + 50);
  svg.append(text(lzx, lzy + 4, 'Z', { class: 'gk lbl tri-z-text', 'text-anchor': 'middle' }));
  svg.append(text(lzx, lzy + (lzy >= CY ? -9 : 17), t('mer.zenith'), {
    class: 'tiny lbl muted', 'text-anchor': 'middle',
  }));

  // --- the horizon, and the ship on it ------------------------------------
  const tan = [sind(phi), cosd(phi)]; // tangent at the observer, screen coords
  svg.append(
    el('line', {
      x1: ox - tan[0] * 74, y1: oy - tan[1] * 74,
      x2: ox + tan[0] * 74, y2: oy + tan[1] * 74,
      class: 'horizon-line',
    }),
  );
  svg.append(el('circle', { cx: ox, cy: oy, r: 4.5, class: 'mark observer' }));
  // Along the horizon, on the side away from the sun: the other side is where
  // the altitude arc is drawn, and the two would be writing over each other.
  const back = tan[0] * sun[0] + tan[1] * sun[1] > 0 ? -1 : 1;
  svg.append(text(ox + back * tan[0] * 28, oy + back * tan[1] * 28 + 4, t('globe.you'), {
    class: 'tiny lbl', 'text-anchor': 'middle',
  }));

  // --- the celestial pole, which is the axis seen from the ship -----------
  // Dashed and parallel to the axis: the pole is far enough away that the
  // direction to it is the same from the centre of the Earth and from the
  // deck, and its height above this horizon is the latitude -- which is the
  // Polaris paragraph, drawn.
  const up = north ? -1 : 1;
  const poleLen = clamp(north ? oy - 40 : 262 - oy, 24, 78);
  svg.append(el('line', {
    x1: ox, y1: oy, x2: ox, y2: oy + up * poleLen, class: 'pole-ray',
  }));
  const pLabel = oy + up * (poleLen + 11) + (north ? 0 : 5);
  // Near the pole itself the zenith is only a few degrees from it, and the
  // two labels land on each other however long the ray is. Step P aside.
  const px = ox + (Math.hypot(ox - lzx, pLabel - lzy) < 32 ? (ox <= lzx ? -21 : 21) : 0);
  svg.append(text(px, pLabel, 'P', { class: 'gk lbl tri-p-text', 'text-anchor': 'middle' }));
  svg.append(text(px, pLabel + up * 13, t('mer.toPole'), {
    class: 'tiny lbl muted', 'text-anchor': 'middle',
  }));

  // --- the angles ---------------------------------------------------------
  // Each is a hit target: clicking one draws that same angle on the main
  // sphere, on the celestial sphere rather than in this cross-section. The
  // transparent arc underneath is what gives a 2px stroke a catchable width.
  const mark = (focus, cx, cy, r, a1, a2, label, colour, labelR) => {
    const node = angleMark(cx, cy, r, a1, a2, label, colour, labelR);
    node.prepend(arc(cx, cy, r, a1, a2, { class: 'hit-line' }));
    node.prepend(title(t(`th.tip.${focus}`))); // first child, or it is not the tooltip
    node.setAttribute('class', 'hit');
    node.setAttribute('data-focus', focus);
    return node;
  };

  // At the centre: delta and z stack end to end and make phi.
  svg.append(mark('phi', CX, CY, 58, 0, phi, 'φ', 'var(--c-phi)', 71));
  svg.append(mark('dec', CX, CY, 34, 0, dec, 'δ', 'var(--c-dec)', 22));
  svg.append(mark('zen', CX, CY, 34, dec, phi, 'z', 'var(--c-zen)', 46));

  // At the observer: the same z, and the altitude that was actually measured.
  svg.append(mark('alt', ox, oy, 32, phi + (sunSouth ? -90 : 90), dec, 'H', 'var(--c-alt)', 45));
  svg.append(mark('zen', ox, oy, 18, dec, phi, 'z', 'var(--c-zen)', 28));

  // --- the arithmetic, on its own row ------------------------------------
  svg.append(el('line', { x1: 14, y1: RULE, x2: W - 14, y2: RULE, class: 'equator-line' }));

  const cell = (x, y, sym, val, colour) => {
    svg.append(text(x, y, sym, { class: 'gk lbl', fill: colour }));
    svg.append(text(x + 17, y, val, { class: 'mn lbl', fill: colour }));
  };
  cell(14, RULE + 24, 'φ', fLat(phi), 'var(--c-phi)');
  cell(14, RULE + 48, 'z', fmtAngle(d.noon.z), 'var(--c-zen)');
  cell(166, RULE + 24, 'δ', `${fmtAngle(Math.abs(dec))} ${t(dec < 0 ? 'suffix.S' : 'suffix.N')}`, 'var(--c-dec)');
  cell(166, RULE + 48, 'H', fmtAngle(d.noon.Ho), 'var(--c-alt)');

  svg.append(
    text(W - 14, RULE + 24, `φ = δ ${sunSouth ? '+' : '−'} z`, {
      class: 'mn lbl formula', 'text-anchor': 'end',
    }),
  );
  svg.append(
    text(W - 14, RULE + 44, t('mer.atLan', { t: fmtClock(d.noon.lanTrue) }), {
      class: 'tiny lbl muted', 'text-anchor': 'end',
    }),
  );
  svg.append(
    text(W - 14, RULE + 62, t('mer.noClock'), {
      class: 'tiny lbl no-clock', 'text-anchor': 'end',
    }),
  );

  // The caption goes last and at the foot, where it cannot be walked into by
  // a zenith or a pole that the latitude has swung somewhere new.
  svg.append(text(14, H - 8, t('mer.section'), { class: 'tiny lbl muted' }));
}

// The meridian section: the proof that latitude is a subtraction.
//
// Because the sun's rays arrive parallel, the angle z measured at the observer
// reappears unchanged at the Earth's centre, where it sits on top of the
// declination and fills out the latitude. The figure is drawn live from the
// current latitude and declination, and the two inner arcs always visibly sum
// to the outer one.
//
// Note what never enters this drawing: a time.

import { el, text, clear, angleMark, onCircle, arc } from '../svg.js';
import { sind, cosd, fmtAngle } from '../core/angles.js';
import { fmtClock } from '../core/time.js';
import { t } from '../i18n.js';
import { fLat } from '../ui/format.js';

const W = 424;
const H = 300;
const CX = 150;
const CY = 112;
const R = 80;

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

  const [nx, ny] = P(90, R + 14);
  const [sx, sy] = P(-90, R + 14);
  svg.append(el('line', { x1: nx, y1: ny, x2: sx, y2: sy, class: 'earth-axis' }));
  svg.append(text(nx, ny - 4, t('mer.N'), { class: 'tiny lbl', 'text-anchor': 'middle' }));
  svg.append(text(sx, sy + 11, t('mer.S'), { class: 'tiny lbl', 'text-anchor': 'middle' }));

  const [ex1, ey1] = P(180, R + 16);
  const [ex2, ey2] = P(0, R + 16);
  svg.append(el('line', { x1: ex1, y1: ey1, x2: ex2, y2: ey2, class: 'equator-line' }));
  svg.append(text(ex1 + 2, ey1 - 7, t('mer.equatorPlane'), { class: 'cap lbl' }));

  // --- parallel rays, one through the centre and one through the ship -----
  for (const [px, py, len] of [[CX, CY, 148], [ox, oy, 102]]) {
    svg.append(
      el('line', {
        x1: px + sun[0] * len, y1: py + sun[1] * len, x2: px, y2: py, class: 'sun-ray',
      }),
    );
  }
  const [gx, gy] = P(dec, R);
  svg.append(el('circle', { cx: gx, cy: gy, r: 3.6, class: 'mark gp' }));

  // --- the zenith and the horizon ----------------------------------------
  const [zx, zy] = P(phi, R + 40);
  svg.append(el('line', { x1: CX, y1: CY, x2: zx, y2: zy, class: 'zenith-ray' }));
  // Labelled partway along the ray, offset away from the sun, so that the tip
  // is free to swing wherever the latitude puts it.
  const away = sunSouth ? 1 : -1;
  const [lzx, lzy] = P(phi, R * 0.74);
  svg.append(
    text(lzx - sind(phi) * 13 * away, lzy - cosd(phi) * 13 * away + 3, t('mer.zenith'), {
      class: 'tiny lbl zen-text', 'text-anchor': 'middle',
    }),
  );

  const tan = [sind(phi), cosd(phi)]; // tangent at the observer, screen coords
  svg.append(
    el('line', {
      x1: ox - tan[0] * 68, y1: oy - tan[1] * 68,
      x2: ox + tan[0] * 68, y2: oy + tan[1] * 68,
      class: 'horizon-line',
    }),
  );
  svg.append(el('circle', { cx: ox, cy: oy, r: 4, class: 'mark observer' }));

  // --- the angles ---------------------------------------------------------
  // At the centre: delta and z stack end to end and make phi.
  svg.append(angleMark(CX, CY, 52, 0, phi, 'φ', 'var(--c-phi)', 65));
  svg.append(angleMark(CX, CY, 30, 0, dec, 'δ', 'var(--c-dec)', 19));
  svg.append(angleMark(CX, CY, 30, dec, phi, 'z', 'var(--c-zen)', 41));

  // At the observer: the same z, and the altitude that was actually measured.
  svg.append(angleMark(ox, oy, 28, phi + (sunSouth ? -90 : 90), dec, 'H', 'var(--c-alt)', 40));
  svg.append(angleMark(ox, oy, 16, dec, phi, 'z', 'var(--c-zen)', 25));

  // --- the arithmetic, on its own row ------------------------------------
  svg.append(el('line', { x1: 14, y1: 212, x2: W - 14, y2: 212, class: 'equator-line' }));

  const cell = (x, y, sym, val, colour) => {
    svg.append(text(x, y, sym, { class: 'gk lbl', fill: colour }));
    svg.append(text(x + 16, y, val, { class: 'mn lbl', fill: colour }));
  };
  cell(14, 236, 'φ', fLat(phi), 'var(--c-phi)');
  cell(14, 260, 'z', fmtAngle(d.noon.z), 'var(--c-zen)');
  cell(150, 236, 'δ', `${fmtAngle(Math.abs(dec))} ${t(dec < 0 ? 'suffix.S' : 'suffix.N')}`, 'var(--c-dec)');
  cell(150, 260, 'H', fmtAngle(d.noon.Ho), 'var(--c-alt)');

  svg.append(
    text(W - 14, 236, `φ = δ ${sunSouth ? '+' : '−'} z`, {
      class: 'mn lbl formula', 'text-anchor': 'end',
    }),
  );
  svg.append(
    text(W - 14, 256, t('mer.atLan', { t: fmtClock(d.noon.lanTrue) }), {
      class: 'tiny lbl muted', 'text-anchor': 'end',
    }),
  );
  svg.append(
    text(W - 14, 274, t('mer.noClock'), {
      class: 'tiny lbl no-clock', 'text-anchor': 'end',
    }),
  );
}

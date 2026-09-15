// Three ships, three times, one identical sky.
//
// The figure the whole longitude argument rests on. Three observers at three
// longitudes, each at its own local apparent noon, each reading the same
// altitude off the same instrument. The three pictures differ in exactly one
// thing -- where Greenwich is drawn -- and Greenwich is the one line on Earth
// that nobody can see.
//
// The declination is held still across the three panels. That is deliberate:
// the symmetry being demonstrated is the Earth's rotation, and holding the
// orbit still is what isolates it. The prose beside the figure says so, and
// says what the real declination drift would do.

import { el, text, polygon, clear, arc, onCircle, arrowhead } from '../svg.js';
import { fmtAngle } from '../core/angles.js';
import { solar } from '../core/sun.js';
import { fmtClock } from '../core/time.js';
import { atHours } from '../core/time.js';
import { t } from '../i18n.js';
import { fLon } from '../ui/format.js';

const W = 700;
const H = 312;
const CY = 118;
const R = 66;
const CX = [116, 350, 584];

// Fixed for the figure: the classic 0, 30 W, 60 W, two hours apart.
const LONGITUDES = [0, -30, -60];

export function createDegeneracy() {
  const svg = el('svg', {
    viewBox: `0 0 ${W} ${H}`,
    class: 'fig-svg',
    role: 'img',
    'aria-label': t('aria.degeneracy'),
  });
  return { node: svg, update: (d, s) => draw(svg, d, s) };
}

function draw(svg, d, s) {
  clear(svg);

  const dec = d.sky.solar.dec;
  const eotDeg = s.useEoT ? d.sky.solar.eotDeg : 0;
  // At culmination the whole sight is the difference of two latitudes.
  const z = Math.abs(s.lat - dec);
  const Ho = 90 - z;
  const sunDown = Ho <= 0;

  svg.append(text(14, 20, t('degen.heading'), { class: 'lbl tiny muted' }));

  LONGITUDES.forEach((lon, i) => {
    const cx = CX[i];
    // Seen from above the north pole the Earth turns anticlockwise and east is
    // anticlockwise with it, so Greenwich sits |lon| degrees round from an
    // observer who is west of it.
    const gAngle = Math.abs(lon);

    // --- the Earth, lit on the side facing the sun ------------------------
    const capPts = (from, to) => {
      const pts = [[cx, CY]];
      for (let a = from; a <= to; a += 3) pts.push(onCircle(cx, CY, R, a));
      return pts;
    };
    svg.append(polygon(capPts(-90, 90), { class: 'globe-lit' }));
    svg.append(polygon(capPts(90, 270), { class: 'globe-night' }));
    svg.append(el('circle', { cx, cy: CY, r: R, class: 'globe-rim' }));

    // --- the sun, off to the right of every panel -------------------------
    for (const a of [-22, 0, 22]) {
      const [x1, y1] = onCircle(cx, CY, R + 20, a);
      const [x2, y2] = onCircle(cx, CY, R + 5, a);
      svg.append(el('line', { x1, y1, x2, y2, class: 'sun-ray' }));
    }

    // --- Greenwich: the only thing that differs between the panels --------
    const [gx, gy] = onCircle(cx, CY, R, gAngle);
    svg.append(el('line', { x1: cx, y1: CY, x2: gx, y2: gy, class: 'prime-meridian' }));
    const [lx, ly] = onCircle(cx, CY, R + 15, gAngle);
    svg.append(
      text(lx + 3, ly - 3, t('fig.greenwich'), { class: 'lbl tiny lha-text' }),
    );
    if (gAngle > 6) {
      svg.append(arc(cx, CY, 38, 0, gAngle, { class: 'ang-lon' }));
      const [ax, ay] = onCircle(cx, CY, 50, gAngle / 2);
      svg.append(
        text(ax, ay + 4, fmtAngle(Math.abs(lon), 0), {
          class: 'lbl mn lha-text', 'text-anchor': 'middle',
        }),
      );
    }

    // --- the observer, standing at local noon -----------------------------
    const [ox, oy] = onCircle(cx, CY, R, 0);
    svg.append(el('line', { x1: ox, y1: oy, x2: ox + 13, y2: oy, class: 'obs-meridian thick' }));
    svg.append(el('circle', { cx: ox, cy: oy, r: 4.4, class: 'mark observer' }));

    // --- what this ship reads, and what it must be told -------------------
    const lan = atHours(d.now, 12 - (lon + eotDeg) / 15);
    const rows = [
      [sunDown ? '—' : `Ho ${fmtAngle(Ho)}`, 'lbl mn degen-read'],
      [`${fmtClock(lan)} UTC`, 'lbl mn lha-text'],
      [fLon(lon), 'lbl mn lha-text'],
    ];
    rows.forEach(([txt, cls], k) => {
      svg.append(text(cx, 216 + k * 22, txt, { class: cls, 'text-anchor': 'middle' }));
    });
  });

  // --- the point ---------------------------------------------------------
  for (const x of [(CX[0] + CX[1]) / 2, (CX[1] + CX[2]) / 2]) {
    svg.append(
      text(x, 221, '=', { class: 'lbl degen-eq', 'text-anchor': 'middle' }),
    );
  }

  // rotation, marked once
  svg.append(arc(CX[0], CY, R + 26, 150, 196, { class: 'rot-arrow' }));
  const [hx, hy] = onCircle(CX[0], CY, R + 26, 196);
  svg.append(arrowhead(hx, hy, 286, 6, { class: 'rot-head' }));
  svg.append(text(14, H - 30, t('fig.rotation'), { class: 'lbl tiny muted' }));

  svg.append(
    text(W / 2, H - 30, t('degen.cover'), {
      class: 'lbl cap degen-cover', 'text-anchor': 'middle',
    }),
  );
  svg.append(
    text(W / 2, H - 12, t('degen.held'), {
      class: 'lbl tiny muted', 'text-anchor': 'middle',
    }),
  );
}

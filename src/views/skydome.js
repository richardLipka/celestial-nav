// The sky as the navigator sees it: an azimuthal projection with the zenith at
// the centre and the horizon as the rim, so that altitude reads as distance in
// from the edge and the almucantars come out evenly spaced.
//
// The single best thing about this projection is that the vertical circle
// through the sun is a straight radial line -- so H and z appear as the two
// pieces that line is cut into, and H + z = 90 is something you can see.

import { el, g, text, polyline, clear, runs, onCircle } from '../svg.js';
import { sind, cosd, fmtAngle, fmtBearing } from '../core/angles.js';
import { t } from '../i18n.js';

const W = 424;
const H = 412;
const CX = 212;
const CY = 192;
const R = 148;

/** Altitude and azimuth to screen. North is up, east is to the right. */
const project = (alt, az) => {
  const r = (R * (90 - alt)) / 90;
  return { x: CX + r * sind(az), y: CY - r * cosd(az) };
};

const CARDINALS = [
  ['sky.N', 0], ['sky.E', 90], ['sky.S', 180], ['sky.W', 270],
];

export function createSkyDome() {
  const svg = el('svg', {
    viewBox: `0 0 ${W} ${H}`,
    class: 'fig-svg',
    role: 'img',
    'aria-label': t('aria.sky'),
  });
  return { node: svg, update: (d, s) => draw(svg, d, s) };
}

function draw(svg, d, s) {
  clear(svg);
  const { sky } = d;
  const sun = project(sky.H, sky.Az);
  const rim = project(0, sky.Az);
  const above = sky.H > 0;

  // --- the graticule of the sky ------------------------------------------
  const grid = g({ class: 'sky-grid' });
  grid.append(el('circle', { cx: CX, cy: CY, r: R, class: 'sky-disc' }));
  for (let alt = 10; alt < 90; alt += 10) {
    grid.append(
      el('circle', {
        cx: CX, cy: CY, r: (R * (90 - alt)) / 90,
        class: alt % 30 === 0 ? 'almucantar major' : 'almucantar',
      }),
    );
  }
  for (let az = 0; az < 360; az += 30) {
    const a = project(0, az);
    grid.append(
      el('line', { x1: CX, y1: CY, x2: a.x, y2: a.y, class: az % 90 === 0 ? 'radial major' : 'radial' }),
    );
  }
  svg.append(grid);

  // Altitude ticks, on the north-east diagonal where nothing else lives.
  for (const alt of [30, 60]) {
    const p = project(alt, 45);
    svg.append(text(p.x + 3, p.y - 4, `${alt}°`, { class: 'tiny lbl' }));
  }

  for (const [key, az] of CARDINALS) {
    const p = project(0, az);
    const out = { x: CX + (p.x - CX) * 1.1, y: CY + (p.y - CY) * 1.1 };
    svg.append(
      text(out.x, out.y + 4, t(key), {
        class: 'cardinal lbl',
        'text-anchor': 'middle',
      }),
    );
  }

  // --- the celestial equator: where declination is measured from ---------
  if (s.show.equator) {
    for (const run of runs(d.equatorTrack, (p) => p.H >= 0)) {
      svg.append(
        polyline(run.map((p) => project(p.H, p.Az)), { class: 'cel-equator' }),
      );
    }
    // Label it out near the eastern horizon, where the middle of the dome is
    // busy with the sight itself.
    const east = d.equatorTrack.filter((p) => p.H >= 2 && p.H < 22 && p.Az < 180)[0];
    if (east) {
      const p = project(east.H, east.Az);
      svg.append(text(p.x - 6, p.y - 5, t('sky.celEquator'), { class: 'cap lbl', 'text-anchor': 'end' }));
    }
  }

  // --- the sun's track for the day ---------------------------------------
  if (s.show.belowHorizon) {
    for (const run of runs(d.track, (p) => p.H < 0 && p.H > -14)) {
      svg.append(polyline(run.map((p) => project(p.H, p.Az)), { class: 'diurnal below' }));
    }
  }
  for (const run of runs(d.track, (p) => p.H >= 0)) {
    svg.append(polyline(run.map((p) => project(p.H, p.Az)), { class: 'diurnal' }));
  }

  // --- the elevated pole: its altitude is the latitude --------------------
  const poleAz = s.lat >= 0 ? 0 : 180;
  const pole = project(Math.abs(s.lat), poleAz);
  svg.append(
    g({}, [
      el('line', {
        x1: pole.x - 7, y1: pole.y, x2: pole.x + 7, y2: pole.y, class: 'pole-mark',
      }),
      el('line', {
        x1: pole.x, y1: pole.y - 7, x2: pole.x, y2: pole.y + 7, class: 'pole-mark',
      }),
      text(pole.x + 11, pole.y + (s.lat >= 0 ? -6 : 11), t('sky.pole'), { class: 'tiny lbl pole-text' }),
      text(
        pole.x + 11,
        pole.y + (s.lat >= 0 ? 8 : 25),
        t('sky.poleAlt', { a: fmtAngle(Math.abs(s.lat)) }),
        { class: 'tiny lbl pole-text' },
      ),
    ]),
  );

  // --- the sight itself ---------------------------------------------------
  if (above) {
    // The vertical circle is a straight radial here, so H and z are simply the
    // two pieces it is cut into by the sun.
    svg.append(
      el('line', { x1: rim.x, y1: rim.y, x2: sun.x, y2: sun.y, class: 'alt-arc' }),
    );
    svg.append(
      el('line', { x1: CX, y1: CY, x2: sun.x, y2: sun.y, class: 'zen-arc' }),
    );

    const midH = { x: (rim.x + sun.x) / 2, y: (rim.y + sun.y) / 2 };
    const midZ = { x: (CX + sun.x) / 2, y: (CY + sun.y) / 2 };
    const side = sky.Az > 180 ? -1 : 1;
    svg.append(text(midH.x + 12 * side, midH.y, `H ${fmtAngle(sky.H)}`, {
      class: 'mn lbl alt-text', 'text-anchor': side > 0 ? 'start' : 'end',
    }));
    svg.append(text(midZ.x + 12 * side, midZ.y, `z ${fmtAngle(d.z)}`, {
      class: 'mn lbl zen-text', 'text-anchor': side > 0 ? 'start' : 'end',
    }));

    svg.append(el('circle', { cx: sun.x, cy: sun.y, r: 8, class: 'sun-disc' }));
    // A tick on the rim for the bearing. The number itself is in the readout;
    // printing it here too only fights the cardinal letters.
    const b1 = project(0, sky.Az);
    const b2 = project(-4.5, sky.Az);
    svg.append(el('line', { x1: b1.x, y1: b1.y, x2: b2.x, y2: b2.y, class: 'az-tick' }));
  } else {
    svg.append(
      text(CX, CY, t('sky.belowHorizon'), {
        class: 'cap lbl muted', 'text-anchor': 'middle',
      }),
    );
  }

  // zenith
  svg.append(el('circle', { cx: CX, cy: CY, r: 2.6, class: 'zenith-dot' }));
  svg.append(text(CX, CY - 8, t('sky.zenith'), { class: 'tiny lbl', 'text-anchor': 'middle' }));

  // --- readout ------------------------------------------------------------
  const lha = sky.lha;
  const rows = [
    ['Hs', fmtAngle(d.sight.Hs)],
    ['Ho', fmtAngle(d.sight.Ho)],
    ['Az', fmtBearing(sky.Az)],
    [t('globe.lha'), `${lha >= 0 ? '+' : '−'}${fmtAngle(Math.abs(lha))}`],
  ];
  rows.forEach(([k, v], i) => {
    const x = 14 + i * 103;
    svg.append(text(x, H - 22, k, { class: 'tiny lbl readout-k' }));
    svg.append(text(x, H - 7, v, { class: 'mn lbl readout-v' }));
  });
}

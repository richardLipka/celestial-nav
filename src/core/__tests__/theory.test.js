import { describe, it, expect, beforeAll } from 'vitest';

import * as store from '../../state/store.js';
import { theory } from '../../theory.js';
import { setLang } from '../../i18n.js';

// The theory tab substitutes live figures into its equations. Each number can
// be right and the line still wrong, because a line has to *multiply out* at
// the precision it is displayed to -- rounding 42.67 days to 43 once left
// "2.857 x 43 = 121.9" on screen, and rounding the equation of time to a tenth
// of a minute left a longitude that was most of an arcminute adrift from its
// own derivation. So parse the numbers back out of the rendered TeX and check
// the arithmetic the reader can see.

/** Degrees-and-minutes pairs, as decimal degrees. Handles the Czech comma. */
const dms = (tex) =>
  [...tex.matchAll(/(-?)(\d+)\^\\circ\\,(\d+)(?:\{,\}|\.)(\d+)'/g)].map((m) =>
    (m[1] === '-' ? -1 : 1) * (Number(m[2]) + (Number(m[3]) + Number(m[4]) / 10) / 60));

const nums = (tex) =>
  (tex.match(/-?\d+(?:\{,\}|\.)?\d*/g) || [])
    .map((x) => Number(x.replace('{,}', '.')))
    .filter(Number.isFinite);

const D2R = Math.PI / 180;
const wrap = (d) => ((d + 540) % 360) - 180;

/** Render every sub block against one fully populated state. */
const render = () => {
  const d = store.get();
  const s = store.state;
  const out = new Map();
  for (const sec of theory) {
    for (const b of sec.blocks) {
      if (b.k !== 'sub') continue;
      const tex = b.fn(d, s);
      if (tex === null) continue;
      if (!out.has(sec.id)) out.set(sec.id, []);
      out.get(sec.id).push(tex);
    }
  }
  return { d, s, out };
};

const find = (out, id, startsWith) =>
  (out.get(id) || []).find((t) => t.startsWith(startsWith));

beforeAll(() => {
  setLang('en');
  store.clearSights();
  store.set({
    lat: 41,
    lon: 12,
    date: new Date(Date.UTC(2024, 4, 15)),
    departureDate: new Date(Date.UTC(2024, 3, 1)),
    clockErrorSec: 12,
    clockRateSecPerDay: 0.35,
    sextantNoise: false,
    useEoT: true,
  });
  const lan = store.get().lan.getTime();
  for (const h of [-3.5, -0.3, 0, 0.3, 3.5]) store.addSight(new Date(lan + h * 3600000));
  const morning = store.get().observations.find((o) => o.Az < 180 && o.Ho > 5);
  if (morning) store.matchSight(morning);
  store.set({ secondOfDay: 9 * 3600 }); // well off the meridian
});

describe('the substituted equations', () => {
  it('fills every one of them in from a full log', () => {
    const { out } = render();
    const total = [...out.values()].reduce((n, a) => n + a.length, 0);
    expect(total, 'sub blocks that rendered').toBeGreaterThanOrEqual(10);
    // And every sub that returns null must have a prompt to show instead.
    for (const sec of theory) {
      for (const b of sec.blocks) {
        if (b.k === 'sub' && b.fn(store.get(), store.state) === null) {
          expect(b.empty, `${sec.id} has a null sub and no empty prompt`).toBeTruthy();
        }
      }
    }
  });

  it('subtracts the altitude from ninety and converts to miles', () => {
    const { out } = render();
    const a = dms(find(out, 'fact', 'z = 90'));
    const nm = nums(find(out, 'fact', 'z = 90')).pop();
    expect(Math.abs(90 - a[0] - a[1]), 'z is not 90 - Ho').toBeLessThan(0.02);
    expect(Math.abs(a[1] * 60 - nm), 'the mileage is not sixty times the degrees').toBeLessThanOrEqual(1);
  });

  it('evaluates the altitude equation to the number it prints', () => {
    const { d, out } = render();
    const tex = find(out, 'triangle', '\\sin H = \\sin(');
    const a = dms(tex);
    const rhs = nums(tex).pop();
    const got = Math.sin(a[0] * D2R) * Math.sin(a[1] * D2R)
      + Math.cos(a[2] * D2R) * Math.cos(a[3] * D2R) * Math.cos(a[4] * D2R);
    expect(Math.abs(got - rhs)).toBeLessThan(5e-4);
    expect(a[0], 'latitude differs between the two halves').toBeCloseTo(a[2], 9);
    expect(a[1], 'declination differs between the two halves').toBeCloseTo(a[3], 9);
    expect(Math.abs(dms(find(out, 'triangle', 'H = '))[0] - d.sky.H) * 60).toBeLessThan(0.06);
  });

  it('adds the declination and the zenith distance to the latitude it prints', () => {
    const { out } = render();
    const tex = find(out, 'latitude', '\\varphi = ');
    const a = dms(tex);
    const got = / \+ /.test(tex) ? a[0] + a[1] : a[0] - a[1];
    expect(Math.abs(got - a[2]) * 60, `${tex}`).toBeLessThan(0.15);
  });

  it('gives the pole an altitude that is never negative', () => {
    const { s, out } = render();
    const a = dms(find(out, 'latitude', 'H_P = '));
    expect(a[0]).toBeGreaterThanOrEqual(0);
    expect(Math.abs(a[0] - Math.abs(s.lat)) * 60).toBeLessThan(0.06);
  });

  it('adds the longitude to the Greenwich hour angle, with the wrap', () => {
    const { out } = render();
    const a = dms(find(out, 'longitude', 't = '));
    expect(Math.abs(wrap(a[0] + a[1]) - a[2]) * 60).toBeLessThan(0.15);
  });

  it('multiplies the chronometer rate out by the days at sea', () => {
    const { d, out } = render();
    const n = nums(find(out, 'longitude', '\\Delta T = '));
    expect(Math.abs(n[0] + n[1] * n[2] - n[3]), 'the rate line does not multiply out')
      .toBeLessThanOrEqual(0.15);
    expect(Math.abs(n[3] - d.clockErrorSec)).toBeLessThan(0.2);
  });

  it('works the longitude out of the clock and the almanac, to the tenth it shows', () => {
    // The trap: a clock quoted to the second is a quarter of a mile of
    // longitude, and the equation of time quoted to a tenth of a minute is
    // three quarters of one. Both have to be shown finer than the answer.
    const { d, out } = render();
    const tex = find(out, 'longitude', '\\lambda = 15');
    const clock = tex.match(/\\text\{(\d+):(\d+):(\d+)\.(\d)\}/);
    expect(clock, 'the clock must carry a tenth of a second').toBeTruthy();
    const a = dms(tex);
    const eotDeg = a[0] * (tex.includes('(-') ? -1 : 1);
    const west = tex.includes('\\text{W}') || tex.includes('\\text{z.d.}');
    const shown = a[a.length - 1] * (west ? -1 : 1);
    const ut = Number(clock[1]) + Number(clock[2]) / 60
      + (Number(clock[3]) + Number(clock[4]) / 10) / 3600;
    const got = wrap(15 * (12 - ut) - eotDeg);
    expect(Math.abs(got - shown) * 60, `${tex}`).toBeLessThan(0.1);
    expect(Math.abs(got - d.logResult.equalAlt.lon) * 60,
      'the line disagrees with the reduction it came from').toBeLessThan(0.1);
  });

  it('takes the sine of the difference of the two bearings', () => {
    const { out } = render();
    const tex = find(out, 'crossing', '\\det = ');
    const a = dms(tex);
    const det = Number(tex.match(/\) = (-?\d+(?:\{,\}|\.)\d+)/)[1].replace('{,}', '.'));
    expect(Math.abs(Math.sin((a[0] - a[1]) * D2R) - det)).toBeLessThan(2e-3);
  });

  it('multiplies the cosine of the latitude by the sine of the azimuth', () => {
    const { d, out } = render();
    const tex = find(out, 'sensitivity', '\\frac{\\partial H}');
    const a = dms(tex);
    const shown = nums(tex).pop();
    const got = Math.cos(a[0] * D2R) * Math.sin(a[1] * D2R);
    expect(Math.abs(got - shown)).toBeLessThan(2e-3);
    expect(Math.abs(got - d.sens)).toBeLessThan(2e-3);
  });

  it('keeps the second, minute and hour figures sixty times apart', () => {
    const { s, out } = render();
    const n = nums(find(out, 'sensitivity', '1\\,\\text{s}'));
    const c = Math.cos(s.lat * D2R);
    expect(Math.abs(n[1] - 0.25 * c)).toBeLessThan(0.001);
    expect(Math.abs(n[3] - 15 * c)).toBeLessThan(0.06);
    expect(Math.abs(n[5] - 900 * c)).toBeLessThan(1.5);
    expect(Math.abs(n[3] - n[1] * 60)).toBeLessThan(0.06);
    expect(Math.abs(n[5] - n[3] * 60)).toBeLessThan(1.5);
  });

  it('survives the Czech decimal comma without losing a backslash', () => {
    setLang('cs');
    try {
      const { out } = render();
      for (const [id, lines] of out) {
        for (const tex of lines) {
          const prose = tex.replace(/\\text\{[^}]*\}/g, '');
          expect(/\d\.\d/.test(prose), `${id}: a bare decimal point in Czech maths mode`).toBe(false);
          expect(/(?<![\\\w])(sin|cos|tan|text|circ|frac|varphi|delta|lambda)\b/.test(tex),
            `${id}: a TeX control word lost its backslash`).toBe(false);
        }
      }
    } finally {
      setLang('en');
    }
  });
});

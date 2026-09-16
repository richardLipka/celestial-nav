import { describe, it, expect, beforeAll } from 'vitest';

import * as store from '../../state/store.js';
import { theory } from '../../theory.js';
import { setLang } from '../../i18n.js';
import { escapeButKeepMath } from '../../views/theory.js';
import * as Astronomy from 'astronomy-engine';
import { solarPrecise, decRateMinPerHour } from '../sun.js';
import { horizon, culmination } from '../horizon.js';

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

// =========================================================================
// A derivation that uses a symbol before it has said what the symbol is has
// not derived anything -- it is asking the reader to take it on trust. This
// table is that contract written down: every symbol below has to be named in
// prose before any equation uses it, in both languages.
// =========================================================================
describe('nothing is used before it is introduced', () => {
  // Every block of every section, in the order they are read.
  const stream = theory.flatMap((sec) => sec.blocks.map((b) => ({ sec: sec.id, b })));

  const proseOf = (b, lang) => (b.k === 'p' || b.k === 'note' ? b.text[lang] : '');
  const mathsOf = (b) => {
    if (b.k === 'math') return b.tex;
    if (b.k !== 'sub') return '';
    const tex = b.fn(store.get(), store.state);
    return tex === null || tex === undefined ? '' : tex;
  };

  const INTRODUCTIONS = [
    { what: 'the observed altitude', symbol: /H_o/,
      en: 'zenith distance', cs: 'zenitová vzdálenost' },
    { what: 'the latitude', symbol: /\\varphi/,
      en: 'your latitude \\(\\varphi\\)', cs: 'zeměpisnou šířku \\(\\varphi\\)' },
    { what: 'the declination', symbol: /\\delta/,
      en: 'declination', cs: 'deklinace' },
    { what: 'the hour angle', symbol: /\bt\b/,
      en: 'local hour angle \\(t\\)', cs: 'místní hodinový úhel \\(t\\)' },
    { what: 'the longitude', symbol: /\\lambda/,
      en: 'longitude \\(\\lambda\\)', cs: 'délku \\(\\lambda\\)' },
    { what: 'the azimuth', symbol: /Z_n/,
      en: 'azimuth angle \\(Z\\)', cs: 'azimutální úhel \\(Z\\)' },
    { what: 'the Greenwich hour angle', symbol: /\\mathrm\{GHA\}/,
      en: 'hour angle at Greenwich', cs: 'hodinový úhel Slunce vůči Greenwichi' },
    { what: 'the equation of time', symbol: /[+-] E\b/,
      en: 'equation of time', cs: 'časová rovnice' },
    { what: 'the error at the rating', symbol: /\\Delta T_0/,
      en: '\\(\\Delta T_0\\) is the error', cs: '\\(\\Delta T_0\\) chyba' },
    { what: 'the computed altitude', symbol: /H_c/,
      en: 'computed altitude', cs: 'výška vypočtená' },
    { what: 'the departure', symbol: /\\text\{dep\}/,
      en: 'departure', cs: 'departure' },
  ];

  for (const lang of ['en', 'cs']) {
    it(`introduces every symbol before an equation uses it, in ${lang}`, () => {
      for (const row of INTRODUCTIONS) {
        const used = stream.findIndex((x) => row.symbol.test(mathsOf(x.b)));
        const said = stream.findIndex((x) => proseOf(x.b, lang).includes(row[lang]));
        expect(used, `${row.what}: no equation uses it`).toBeGreaterThanOrEqual(0);
        expect(said, `${row.what}: never introduced in ${lang}`).toBeGreaterThanOrEqual(0);
        expect(said, `${row.what}: used at block ${used}, introduced at ${said} (${lang})`)
          .toBeLessThanOrEqual(used);
      }
    });
  }

  it('closes every inline formula it opens', () => {
    for (const lang of ['en', 'cs']) {
      for (const { sec, b } of stream) {
        const text = proseOf(b, lang);
        const opens = (text.match(/\\\(/g) || []).length;
        const closes = (text.match(/\\\)/g) || []).length;
        expect(opens, `${sec} (${lang})`).toBe(closes);
        expect(text, `${sec} (${lang}): display maths does not belong in prose`)
          .not.toContain('\\[');
      }
    }
  });

  it('pairs up every emphasis mark, so none reaches the page as an asterisk', () => {
    for (const lang of ['en', 'cs']) {
      for (const { sec, b } of stream) {
        const text = proseOf(b, lang);
        const stripped = text.replace(/\*\*[^*]+\*\*/g, '').replace(/\*[^*]+\*/g, '');
        expect(stripped, `${sec} (${lang}) has an unpaired asterisk`).not.toContain('*');
      }
    }
  });
});

describe('the prose renderer', () => {
  it('turns the two emphases into tags and escapes everything else', () => {
    expect(escapeButKeepMath('the **intercept**, which *would* be'))
      .toBe('the <strong>intercept</strong>, which <em>would</em> be');
    expect(escapeButKeepMath('<script>alert(1)</script>'))
      .toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
    // Inline maths comes through untouched, delimiters and all.
    expect(escapeButKeepMath('so \\(t = 0\\) and')).toBe('so \\(t = 0\\) and');
  });
});


// =========================================================================
// The sentences that quote a number about the sky, checked against the sky.
// Each one also checks that the sentence still says what was measured: edit
// the prose and the test comes with it.
// =========================================================================
describe('the figures the prose quotes', () => {
  const para = (secId, needle, lang = 'en') => {
    const sec = theory.find((x) => x.id === secId);
    return sec.blocks.find((b) => b.text?.[lang]?.includes(needle))?.text[lang];
  };

  it('has Polaris two degrees off the pole in 1762, and forty minutes off now', () => {
    // Polaris, J2000: 02h 31m 49.09s, +89 15' 50.8". Precession does the rest,
    // and astronomy-engine is the independent oracle for it.
    Astronomy.DefineStar(Astronomy.Body.Star1, 2 + 31 / 60 + 49.09 / 3600,
      89 + 15 / 60 + 50.8 / 3600, 447);
    const at = (y) => {
      const eq = Astronomy.Equator(Astronomy.Body.Star1,
        new Date(Date.UTC(y, 0, 19)), new Astronomy.Observer(0, 0, 0), true, false);
      return 90 - eq.dec;
    };
    const then = at(1762);
    const now = at(new Date().getUTCFullYear());
    expect(then).toBeGreaterThan(1.9);
    expect(then).toBeLessThan(2.1);
    // A hundred and eighteen arcminutes, which the prose calls a hundred and
    // twenty miles: one arcminute of latitude is one nautical mile.
    expect(then * 60).toBeGreaterThan(115);
    expect(then * 60).toBeLessThan(121);
    expect(now * 60).toBeLessThan(40);

    const p = para('latitude', 'Polaris');
    expect(p).toContain('two degrees from the pole');
    expect(p).toContain('a hundred and twenty');
    expect(p).toContain('under forty minutes');
  });

  it('has the equation of time reaching sixteen minutes one way and fifteen the other', () => {
    let lo = { min: 1e9 };
    let hi = { min: -1e9 };
    for (let d = 0; d < 366; d++) {
      const when = new Date(Date.UTC(1762, 0, 1) + d * 86400e3 + 12 * 3600e3);
      const min = solarPrecise(when).eotDeg * 4; // degrees of hour angle -> minutes of time
      if (min < lo.min) lo = { min, when };
      if (min > hi.min) hi = { min, when };
    }
    expect(hi.min).toBeGreaterThan(16);
    expect(hi.min).toBeLessThan(16.5);
    expect(hi.when.getUTCMonth()).toBe(10);      // November
    expect(hi.when.getUTCDate()).toBeLessThan(8); // and the start of it
    expect(lo.min).toBeLessThan(-14.5);
    expect(lo.min).toBeGreaterThan(-15);
    expect(lo.when.getUTCMonth()).toBe(1);       // February

    const p = para('longitude', 'equation of time');
    expect(p).toContain('sixteen minutes of time one way at the start of November');
    expect(p).toContain('fifteen the other in February');
  });

  it('has the declination creeping at most an arcminute an hour', () => {
    let worst = 0;
    for (let d = 0; d < 366 * 4; d++) {
      const when = new Date(Date.UTC(1762, 0, 1) + d * 86400e3);
      worst = Math.max(worst, Math.abs(decRateMinPerHour(when)));
    }
    expect(worst).toBeLessThan(1);
    expect(worst).toBeGreaterThan(0.9); // and it really does get that far
    expect(para('fact', 'declination')).toContain('at most a minute of arc an hour');
  });

  it('costs one minute of time high and five minutes low to read half an arcminute wrong', () => {
    // Near culmination the altitude curve is flat, so a reading error becomes
    // a time error -- and how big depends on how high the sun climbs.
    const offsetMinutes = (lat, date) => {
      const lan = culmination(date, 0, true);
      const hMax = horizon(lat, 0, lan).H;
      let lo = 0;
      let hi = 60;
      for (let i = 0; i < 50; i++) {
        const mid = (lo + hi) / 2;
        const h = horizon(lat, 0, new Date(lan.getTime() + mid * 60000)).H;
        if (hMax - h < 0.5 / 60) lo = mid;
        else hi = mid;
      }
      return { hMax, minutes: (lo + hi) / 2 };
    };

    const high = offsetMinutes(20, new Date(Date.UTC(1762, 5, 21)));
    expect(high.hMax).toBeGreaterThan(85);
    expect(high.minutes).toBeCloseTo(1, 0);

    const low = offsetMinutes(50, new Date(Date.UTC(1762, 0, 19)));
    expect(low.hMax).toBeLessThan(21);
    expect(low.minutes).toBeCloseTo(5, 0);

    // And nothing in between escapes the range the sentence gives.
    for (let lat = -5; lat <= 50; lat += 5) {
      const r = offsetMinutes(lat, new Date(Date.UTC(1762, 0, 19)));
      if (r.hMax < 20 || r.hMax > 88) continue;
      expect(r.minutes, `culminating at ${r.hMax.toFixed(0)}`).toBeGreaterThan(0.9);
      expect(r.minutes, `culminating at ${r.hMax.toFixed(0)}`).toBeLessThan(5.2);
    }

    const p = para('longitude', 'highest altitude');
    expect(p).toContain('one to five minutes of time');
  });
});

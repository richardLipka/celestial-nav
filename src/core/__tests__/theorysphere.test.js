import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import {
  orthographic, tangent, sphericalAngle, angleArc, along, parallel, meridian,
} from '../../views/sphere.js';
import {
  focusSpec, corners, FOCUS_KEYS, FOCUS_SYMBOL, SECTION_VIEW,
} from '../../views/theorysphere.js';
import { theory } from '../../theory.js';
import { dictionaries } from '../../i18n.js';
import { horizon } from '../horizon.js';
import { angularDistance } from '../fix.js';
import { sind, cosd, setDecimalSeparator } from '../angles.js';

beforeAll(() => setDecimalSeparator('.'));
afterAll(() => setDecimalSeparator('.'));

// A spread of skies: both hemispheres, both solstices, high sun and low, the
// sun on the meridian and the sun nearly setting.
const SKIES = [
  { name: 'Jamaica, forenoon', lat: 18, lon: -76.8, at: '1762-01-19T14:30:00Z' },
  { name: 'Jamaica, near noon', lat: 18, lon: -76.8, at: '1762-01-19T17:18:00Z' },
  { name: 'the Cape, midsummer', lat: -33.9, lon: 18.4, at: '1762-12-21T09:40:00Z' },
  { name: 'the Cape, midwinter', lat: -33.9, lon: 18.4, at: '1762-06-21T13:10:00Z' },
  { name: 'Iceland, low sun', lat: 64.1, lon: -21.9, at: '1762-03-12T15:40:00Z' },
  { name: 'the equator', lat: 0, lon: 0, at: '1762-09-08T08:20:00Z' },
  { name: 'Portsmouth, after sunset', lat: 50.8, lon: -1.1, at: '1762-01-19T20:00:00Z' },
];

const skies = SKIES.map((c) => {
  const sky = horizon(c.lat, c.lon, new Date(c.at));
  return {
    ...c,
    sky,
    ctx: { lat: c.lat, dec: sky.solar.dec, H: sky.H, lha: sky.lha, az: sky.Az },
  };
});

/** Pull the number back out of a label, whichever way the angle is written. */
const parseAngle = (s) => {
  const m = String(s).match(/(−|-)?(\d+)°(?:\s*(\d+(?:[.,]\d+)?)′)?/);
  if (!m) return null;
  const v = Number(m[2]) + (m[3] ? Number(m[3].replace(',', '.')) / 60 : 0);
  return m[1] ? -v : v;
};

describe('the projection', () => {
  const proj = orthographic({ cx: 100, cy: 100, r: 50, centre: { lat: 20, lon: -30 } });

  it('puts the centre at the centre and scales by the sine of the distance', () => {
    const c = proj(20, -30);
    expect(c.x).toBeCloseTo(100, 9);
    expect(c.y).toBeCloseTo(100, 9);
    expect(c.z).toBeCloseTo(1, 9);

    // Orthographic: the radius on the page is R sin(angular distance), which
    // is what makes the limb crowd together and the centre spread out.
    for (const p of [{ lat: 20, lon: 0 }, { lat: -40, lon: 100 }, { lat: 80, lon: -30 }]) {
      const q = proj(p.lat, p.lon);
      const d = angularDistance({ lat: 20, lon: -30 }, p);
      expect(Math.hypot(q.x - 100, q.y - 100)).toBeCloseTo(50 * sind(d), 6);
      expect(q.z).toBeCloseTo(cosd(d), 9);
    }
  });

  it('hides exactly the far half and nothing else', () => {
    let wrong = 0;
    for (let lat = -90; lat <= 90; lat += 5) {
      for (let lon = -180; lon < 180; lon += 5) {
        const near = angularDistance({ lat: 20, lon: -30 }, { lat, lon }) <= 90;
        if (proj(lat, lon).visible !== near) wrong++;
      }
    }
    expect(wrong).toBe(0);
  });
});

describe('angles measured on the sphere', () => {
  // The angle at Z is the azimuth *angle*: it is measured from the elevated
  // pole and can never exceed 180. The bearing Zn is measured from north and
  // runs the whole way round. They are the same number only north of the
  // equator with the sun in the east, which is why the sphere draws the
  // bearing as a sweep from north rather than as the angle at Z.
  it('reads the azimuth angle at the zenith, from the elevated pole', () => {
    for (const c of skies) {
      const { P, Z, X } = corners(c.lat, c.sky.H, c.sky.Az);
      const poleAz = c.lat >= 0 ? 0 : 180;
      const want = Math.abs((((c.sky.Az - poleAz + 540) % 360) - 180));
      expect(sphericalAngle(Z, P, X), c.name).toBeCloseTo(want, 5);
    }
  });

  it('keeps the bearing and that angle apart south of the equator', () => {
    const c = skies.find((x) => x.name === 'the Cape, midsummer');
    const { P, Z, X } = corners(c.lat, c.sky.H, c.sky.Az);
    // The sun bears north-east of the Cape, and the elevated pole is the
    // southern one: the angle at Z is the supplement of the bearing, not the
    // bearing. Drawing one for the other would be out by 64 degrees here.
    expect(sphericalAngle(Z, P, X)).toBeCloseTo(180 - c.sky.Az, 5);
    const sweep = focusSpec('az', c.ctx).arc;
    expect(sweep[sweep.length - 1].lon).toBeCloseTo(c.sky.Az, 9);
    expect(Math.abs(sphericalAngle(Z, P, X) - c.sky.Az)).toBeGreaterThan(60);
  });

  it('reads the hour angle as the angle at the pole', () => {
    for (const c of skies) {
      const { P, Z, X } = corners(c.lat, c.sky.H, c.sky.Az);
      // On the equator the elevated pole is on the horizon and the triangle is
      // still a triangle; only a sun exactly at the zenith would break it.
      const a = sphericalAngle(P, Z, X);
      expect(a, c.name).toBeCloseTo(Math.abs(c.sky.lha), 5);
    }
  });

  it('draws an angle arc at the radius it was asked for, between the two sides', () => {
    for (const c of skies) {
      const { P, Z, X } = corners(c.lat, c.sky.H, c.sky.Az);
      const arc = angleArc(P, Z, X, 16, 12);
      expect(arc.length, c.name).toBe(13);
      for (const p of arc) expect(angularDistance(P, p)).toBeCloseTo(16, 5);
      // The ends sit on the two sides of the angle, 16 degrees along each.
      expect(angularDistance(arc[0], along(P, Z, 16))).toBeCloseTo(0, 5);
      expect(angularDistance(arc[arc.length - 1], along(P, X, 16))).toBeCloseTo(0, 5);
      // And the arc spans the angle itself, not some flattened version of it.
      expect(sphericalAngle(P, arc[0], arc[arc.length - 1])).toBeCloseTo(Math.abs(c.sky.lha), 5);
    }
  });

  it('has no direction to offer at a point on top of itself', () => {
    expect(tangent({ lat: 90, lon: 0 }, { lat: 90, lon: 40 })).toBe(null);
    expect(angleArc({ lat: 90, lon: 0 }, { lat: 90, lon: 0 }, { lat: 0, lon: 0 }, 10)).toEqual([]);
  });

  it('walks a great circle the distance it was given', () => {
    const from = { lat: 12, lon: 34 };
    const to = { lat: -50, lon: 130 };
    for (const dist of [1, 17, 90, 140]) {
      expect(angularDistance(from, along(from, to, dist))).toBeCloseTo(dist, 6);
    }
  });

  it('lays out parallels and meridians where it says it does', () => {
    expect(parallel(30).every((p) => p.lat === 30)).toBe(true);
    expect(meridian(120).every((p) => p.lon === 120)).toBe(true);
    expect(meridian(0)[0].lat).toBe(-90);
  });
});

// The point of the whole file. A figure that draws one number and writes
// another beside it is worse than no figure, so every arc is measured and
// compared with the label it carries.
describe('each angle is drawn as long as its label says', () => {
  const measure = (key, spec) => {
    const a = spec.arc;
    // Azimuth runs from north through east all the way round, so what is
    // drawn is a sweep and not a shortest angle: add it up as it goes.
    if (key === 'az') return a[a.length - 1].lon - a[0].lon;
    return spec.vertex
      ? sphericalAngle(spec.vertex, a[0], a[a.length - 1])
      : angularDistance(a[0], a[a.length - 1]);
  };

  it('agrees with itself for every angle in every sky', () => {
    for (const c of skies) {
      for (const key of FOCUS_KEYS) {
        const spec = focusSpec(key, c.ctx);
        const drawn = measure(key, spec);
        const written = Math.abs(parseAngle(spec.label));
        // The labels are given to a tenth of an arcminute, and a bearing to a
        // whole degree, so that is the tolerance each has earned.
        const tol = key === 'az' ? 0.5 : 1 / 60 / 2;
        expect(Math.abs(drawn - written), `${c.name}: ${key}`).toBeLessThan(tol);
      }
    }
  });

  it('starts each arc where the quantity is measured from', () => {
    for (const c of skies) {
      const { P, Z, X } = corners(c.lat, c.sky.H, c.sky.Az);

      // The latitude runs from the horizon up to the elevated pole.
      const phi = focusSpec('phi', c.ctx).arc;
      expect(phi[0].lat, c.name).toBeCloseTo(0, 9);
      expect(angularDistance(phi[phi.length - 1], P)).toBeCloseTo(0, 5);

      // The altitude runs from the horizon up to the sun, on the sun's own
      // vertical circle -- so it starts at the sun's azimuth.
      const alt = focusSpec('alt', c.ctx).arc;
      expect(alt[0].lat, c.name).toBeCloseTo(0, 9);
      expect(((alt[0].lon - c.sky.Az + 540) % 360) - 180).toBeCloseTo(0, 6);

      // The zenith distance runs from the zenith to the sun.
      const zen = focusSpec('zen', c.ctx).arc;
      expect(zen[0].lat, c.name).toBeCloseTo(90, 6);
      expect(angularDistance(zen[zen.length - 1], X)).toBeCloseTo(0, 5);

      // Declination is measured from the celestial equator along the hour
      // circle, so its arc starts on the equator -- 90 degrees from the pole,
      // at the sun's own hour angle -- and not at the sun's foot on the
      // horizon, which is a different point entirely.
      const dec = focusSpec('dec', c.ctx).arc;
      expect(angularDistance(P, dec[0]), c.name).toBeCloseTo(90, 5);
      expect(sphericalAngle(P, Z, dec[0])).toBeCloseTo(Math.abs(c.sky.lha), 5);
      expect(angularDistance(dec[dec.length - 1], X)).toBeCloseTo(0, 5);
    }
  });

  it('runs the azimuth along the horizon the way a bearing is counted', () => {
    for (const c of skies) {
      const spec = focusSpec('az', c.ctx);
      const rim = spec.context[0];
      // The angle mark itself is the same sweep, lifted off the horizon.
      expect(spec.arc.every((p) => p.lat === 74), c.name).toBe(true);
      expect(spec.arc[spec.arc.length - 1].lon).toBeCloseTo(c.sky.Az, 9);
      expect(rim.every((p) => p.lat === 0), c.name).toBe(true);
      expect(rim[0].lon).toBe(0);
      expect(rim[rim.length - 1].lon).toBeCloseTo(c.sky.Az, 9);
      // Monotonic from north: a sun in the west is three quarters of the way
      // round, never a quarter of the way back.
      for (let i = 1; i < rim.length; i++) expect(rim[i].lon >= rim[i - 1].lon).toBe(true);
    }
  });
});

describe('the sphere and the text it follows', () => {
  it('names only sections that exist and only angles that can be drawn', () => {
    const ids = theory.map((s) => s.id);
    for (const [id, v] of Object.entries(SECTION_VIEW)) {
      expect(ids, `section ${id}`).toContain(id);
      if (v.focus) expect(FOCUS_KEYS).toContain(v.focus);
    }
  });

  it('gives the triangle to the section that is about the triangle', () => {
    expect(SECTION_VIEW.triangle.triangle).toBe(true);
  });

  it('has a symbol and a name in both languages for every angle', () => {
    for (const key of FOCUS_KEYS) {
      expect(FOCUS_SYMBOL[key], key).toBeTruthy();
      for (const lang of ['en', 'cs']) {
        expect(dictionaries[lang][`th.ang.${key}`], `${lang} ${key}`).toBeTruthy();
      }
    }
  });
});

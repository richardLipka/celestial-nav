import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import {
  orthographic, tangent, sphericalAngle, angleArc, along, parallel, meridian,
  stereographic, flattenTriangle, fitBox, besideMid, limbRuns, midOf,
} from '../../views/sphere.js';
import {
  focusSpec, corners, FOCUS_KEYS, FOCUS_SYMBOL, SECTION_VIEW,
} from '../../views/theorysphere.js';
import { theory } from '../../theory.js';
import { dictionaries } from '../../i18n.js';
import { horizon, culmination, altAz, hourCircle } from '../horizon.js';
import { angularDistance } from '../fix.js';
import { sind, cosd, norm180, setDecimalSeparator } from '../angles.js';

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


// =========================================================================
// The flat figure, which is the same triangle and has to prove it.
// =========================================================================

/** The angle between two screen headings, taken the short way round. */
const between = (a, b) => {
  let d = b - a;
  while (d > 180) d -= 360;
  while (d < -180) d += 360;
  return Math.abs(d);
};

const flatFor = (c, box = { w: 430, h: 302, pad: 58 }) => {
  const { P, Z, X } = corners(c.lat, c.sky.H, c.sky.Az);
  return { P, Z, X, fig: flattenTriangle(P, Z, X, box) };
};

describe('the conformal projection', () => {
  const V = { lat: 34, lon: 12 };
  const TARGETS = [
    { lat: 80, lon: -20 }, { lat: -12, lon: 60 }, { lat: 5, lon: -50 },
    { lat: 60, lon: 130 }, { lat: -40, lon: 4 }, { lat: 34, lon: 100 },
  ];

  /** The angle at V between two great circles, measured on the page. */
  const onPage = (proj, A, B) => {
    const dir = (T) => {
      const a = along(V, T, -0.02);
      const b = along(V, T, 0.02);
      const qa = proj(a.lat, a.lon);
      const qb = proj(b.lat, b.lon);
      return (Math.atan2(-(qb.y - qa.y), qb.x - qa.x) * 180) / Math.PI;
    };
    return between(dir(A), dir(B));
  };

  it('keeps every angle, and not only at the point it is centred on', () => {
    // Centred a long way from V on purpose: a projection that were only
    // right at the middle of its own picture would be no use for this.
    const proj = stereographic({ lat: -18, lon: -95 });
    let worst = 0;
    for (let i = 0; i < TARGETS.length; i++) {
      for (let j = i + 1; j < TARGETS.length; j++) {
        const truth = sphericalAngle(V, TARGETS[i], TARGETS[j]);
        worst = Math.max(worst, Math.abs(onPage(proj, TARGETS[i], TARGETS[j]) - truth));
      }
    }
    expect(worst).toBeLessThan(0.001);
  });

  it('is the reason the orthographic one cannot be used for this', () => {
    // The same measurement under the projection the spheres are drawn in.
    // It is wrong, and wrong by whole degrees, which is why an angle on the
    // sphere is drawn as an arc on its surface and never as a flat arc.
    const proj = orthographic({ cx: 0, cy: 0, r: 1, centre: { lat: -18, lon: -95 } });
    let worst = 0;
    for (let i = 0; i < TARGETS.length; i++) {
      for (let j = i + 1; j < TARGETS.length; j++) {
        const truth = sphericalAngle(V, TARGETS[i], TARGETS[j]);
        worst = Math.max(worst, Math.abs(onPage(proj, TARGETS[i], TARGETS[j]) - truth));
      }
    }
    expect(worst).toBeGreaterThan(5);
  });

  it('scales both axes alike, or the angles would be sheared away again', () => {
    const pts = [{ x: -1, y: -0.5 }, { x: 2, y: 0.25 }, { x: 0.5, y: 1.5 }];
    const map = fitBox(pts, { w: 400, h: 200, pad: 20 });
    const a = pts.map(map);
    // Every distance changed by the same factor.
    const k = Math.hypot(a[1].x - a[0].x, a[1].y - a[0].y)
      / Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
    for (let i = 0; i < 3; i++) {
      for (let j = i + 1; j < 3; j++) {
        const was = Math.hypot(pts[j].x - pts[i].x, pts[j].y - pts[i].y);
        const now = Math.hypot(a[j].x - a[i].x, a[j].y - a[i].y);
        expect(now / was).toBeCloseTo(k, 9);
      }
    }
    for (const q of a) {
      expect(q.x).toBeGreaterThanOrEqual(20 - 1e-9);
      expect(q.x).toBeLessThanOrEqual(380 + 1e-9);
      expect(q.y).toBeGreaterThanOrEqual(20 - 1e-9);
      expect(q.y).toBeLessThanOrEqual(180 + 1e-9);
    }
  });
});

describe('the flat figure of the triangle', () => {
  it('draws each angle the size the number beside it says', () => {
    for (const c of skies) {
      const { fig } = flatFor(c);
      const drawn = [
        between(fig.heading[0][1], fig.heading[0][2]),
        between(fig.heading[1][0], fig.heading[1][2]),
        between(fig.heading[2][0], fig.heading[2][1]),
      ];
      for (let i = 0; i < 3; i++) {
        expect(drawn[i], `${c.name} corner ${i}`).toBeCloseTo(fig.angles[i], 3);
      }
    }
  });

  it('puts the hour angle at P and the azimuth angle at Z', () => {
    for (const c of skies) {
      const { fig } = flatFor(c);
      expect(fig.angles[0], `${c.name} at P`).toBeCloseTo(Math.abs(c.sky.lha), 6);
      // Measured from the *elevated* pole, so it is the bearing in the north
      // and the bearing reckoned from south in the south -- the distinction
      // the figure writes out as "Z" with "Zn" underneath it.
      const fromPole = c.lat >= 0 ? c.sky.Az : Math.abs(180 - c.sky.Az);
      const want = fromPole > 180 ? 360 - fromPole : fromPole;
      expect(fig.angles[1], `${c.name} at Z`).toBeCloseTo(want, 6);
    }
  });

  it('carries an excess no plane triangle could, except where there is none', () => {
    for (const c of skies) {
      const { fig } = flatFor(c);
      const excess = fig.angles[0] + fig.angles[1] + fig.angles[2] - 180;
      // A sun a tenth of a degree off the meridian has a triangle of about
      // nothing, and that sky is in the list on purpose.
      const open = Math.abs(c.sky.lha) > 1;
      if (open) expect(excess, `${c.name}`).toBeGreaterThan(1);
      else expect(excess, `${c.name}`).toBeLessThan(1);
    }
  });

  it('collapses to one straight line when the sun is on the meridian', () => {
    const at = culmination(new Date(Date.UTC(1762, 0, 19)), -76.8, true);
    const sky = horizon(18, -76.8, at);
    const { fig } = flatFor({ lat: 18, sky });
    const [a, b] = [fig.at[0], fig.at[2]];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    let worst = 0;
    for (const side of fig.sides) {
      for (const q of side.pts) {
        // Distance from the P-X line: the cross product over its length.
        const cross = (b.x - a.x) * (q.y - a.y) - (b.y - a.y) * (q.x - a.x);
        worst = Math.max(worst, Math.abs(cross) / len);
      }
    }
    expect(len).toBeGreaterThan(100); // and it is still drawn, not a dot
    expect(worst).toBeLessThan(1);    // within a pixel of straight
  });

  it('fits the box it was given, and fills one of its two axes', () => {
    const box = { w: 430, h: 302, pad: 58 };
    for (const c of skies) {
      const { fig } = flatFor(c, box);
      const xs = fig.sides.flatMap((s) => s.pts.map((q) => q.x));
      const ys = fig.sides.flatMap((s) => s.pts.map((q) => q.y));
      const inX = Math.min(...xs) >= box.pad - 0.01 && Math.max(...xs) <= box.w - box.pad + 0.01;
      const inY = Math.min(...ys) >= box.pad - 0.01 && Math.max(...ys) <= box.h - box.pad + 0.01;
      expect(inX && inY, `${c.name} stays inside`).toBe(true);
      // As large as it goes: one axis reaches the padding on both sides.
      const fullX = Math.max(...xs) - Math.min(...xs) > box.w - 2 * box.pad - 0.5;
      const fullY = Math.max(...ys) - Math.min(...ys) > box.h - 2 * box.pad - 0.5;
      expect(fullX || fullY, `${c.name} fills one axis`).toBe(true);
    }
  });
});

describe('where a label goes', () => {
  it('stands beside the line and not along it', () => {
    const pts = [{ x: 0, y: 0 }, { x: 50, y: 50 }, { x: 100, y: 100 }];
    const q = besideMid(pts, { x: 200, y: 0 }, 20);
    // Square to the line, twenty from it.
    const cross = (100 * (q.y - 0) - 100 * (q.x - 0)) / Math.hypot(100, 100);
    expect(Math.abs(cross)).toBeCloseTo(20, 6);
    // And on the far side from the point it was told to avoid.
    expect(q.x).toBeLessThan(50);
    expect(q.y).toBeGreaterThan(50);
  });

  it('has somewhere to put a label for an arc that is one point long', () => {
    expect(besideMid([{ x: 4, y: 9 }], { x: 0, y: 0 }, 20)).toEqual({ x: 4, y: 9 });
    expect(besideMid([], { x: 0, y: 0 }, 20)).toBe(null);
  });
});


// =========================================================================
// The sphere as glass, and the sun when it is under the horizon.
// =========================================================================

describe('the sphere as glass', () => {
  const proj = orthographic({ cx: 100, cy: 100, r: 50, centre: { lat: 0, lon: 0 } });
  const circle = parallel(0, -180, 180, 2);

  it('drops the far half of a line when the sphere is solid', () => {
    const runs = limbRuns(circle, proj, false);
    expect(runs.every((r) => r.near)).toBe(true);
    const drawn = runs.reduce((n, r) => n + r.pts.length, 0);
    const visible = circle.map((q) => proj(q.lat, q.lon)).filter((q) => q.visible).length;
    expect(drawn).toBe(visible);
  });

  it('keeps both halves when it is glass, and joins them at the limb', () => {
    const runs = limbRuns(circle, proj, true);
    expect(runs.length).toBeGreaterThan(1);
    for (let i = 1; i < runs.length; i++) {
      // Near and far alternate: a run that did not change sides would not
      // have been cut.
      expect(runs[i].near).toBe(!runs[i - 1].near);
      // The crossing belongs to both runs. Without that the near line and
      // the far one leave a gap exactly where the eye expects them to meet.
      const prev = runs[i - 1].pts;
      expect(runs[i].pts[0]).toEqual(prev[prev.length - 1]);
    }
    // Nothing is lost, and the only points drawn twice are the crossings.
    const drawn = runs.reduce((n, r) => n + r.pts.length, 0);
    expect(drawn).toBe(circle.length + runs.length - 1);
  });

  it('has a middle for an arc that is wholly round the back, but only when asked', () => {
    const back = [{ lat: 0, lon: 140 }, { lat: 0, lon: 160 }, { lat: 0, lon: 180 }];
    expect(midOf(back, proj)).toBe(null);
    const q = midOf(back, proj, true);
    expect(q).not.toBe(null);
    expect(q.visible).toBe(false);
    // An arc that is partly in front gives its visible middle either way, so
    // a label never drifts round the back while its arc is still in view.
    const half = [{ lat: 0, lon: 0 }, { lat: 0, lon: 80 }, { lat: 0, lon: 140 }];
    expect(midOf(half, proj, true).visible).toBe(true);
  });
});

describe('the sun below the horizon', () => {
  it('is one of the skies every figure is checked against', () => {
    expect(skies.filter((c) => c.sky.H < 0).length).toBeGreaterThan(0);
  });

  it('is a zenith distance past ninety, and changes nothing else', () => {
    for (const c of skies.filter((x) => x.sky.H < 0)) {
      // That is the whole of what being below the horizon is. The triangle
      // is still a triangle, the hour angle is still the angle at P, and the
      // figures go on drawing it -- which is exactly why they have to say so.
      expect(90 - c.sky.H, c.name).toBeGreaterThan(90);
      const { fig } = flatFor(c);
      expect(fig.angles[0], c.name).toBeCloseTo(Math.abs(c.sky.lha), 6);
      expect(fig.angles[0] + fig.angles[1] + fig.angles[2] - 180, c.name).toBeGreaterThan(0);
    }
  });

  it('is said in both languages, on the figure and beside it', () => {
    for (const lang of ['en', 'cs']) {
      expect(dictionaries[lang]['fig.sunDown'], lang).toBeTruthy();
      const warn = dictionaries[lang]['th.sunDown'];
      expect(warn, lang).toBeTruthy();
      // The stage warning goes through the prose renderer, so its emphasis
      // has to come in pairs or the reader is shown the asterisks.
      expect(warn.replace(/\*\*[^*]+\*\*/g, ''), lang).not.toContain('*');
    }
  });
});


// =========================================================================
// Greenwich, drawn on the observer's own sky.
// =========================================================================

describe('the hour circle of the prime meridian', () => {
  it('runs from one celestial pole to the other', () => {
    for (const c of skies) {
      const { P } = corners(c.lat, c.sky.H, c.sky.Az);
      const arc = hourCircle(c.lat, norm180(c.lon), 36);
      // Ends at declination -90 and +90: the two poles, whichever of them is
      // the elevated one. Its altitude is the latitude without its sign, and
      // that is the end that matches P.
      const ends = [arc[0], arc[arc.length - 1]].map((q) => ({ lat: q.H, lon: q.Az }));
      const near = ends.map((e) => angularDistance(e, P));
      expect(Math.min(...near), c.name).toBeLessThan(1e-6);
      // Loose at the far end on purpose: an angular distance is an acos, and
      // an acos next to 180 degrees has no precision left to give.
      expect(Math.max(...near), c.name).toBeCloseTo(180, 5);
    }
  });

  it('stands at the angle from your own meridian that your longitude is', () => {
    // This is the whole reason it is drawn. Moving the longitude slider used
    // to move a number and nothing on the picture; the angle between these
    // two lines, at the pole, *is* the longitude, and now it swings.
    for (const c of skies) {
      const { P, Z } = corners(c.lat, c.sky.H, c.sky.Az);
      const t = norm180(c.lon);
      const arc = hourCircle(c.lat, t, 36);
      const onEquator = { lat: arc[18].H, lon: arc[18].Az }; // declination zero
      expect(sphericalAngle(P, Z, onEquator), c.name).toBeCloseTo(Math.abs(t), 5);
    }
  });

  it('is where the sun would stand at Greenwich apparent noon', () => {
    // A body over Greenwich has, by the definition of the thing, a Greenwich
    // hour angle of zero -- so its local hour angle is the longitude itself.
    for (const c of skies) {
      const here = altAz(c.lat, c.sky.solar.dec, norm180(c.lon));
      // Put the sun's own declination on that hour circle and it lands on it.
      const arc = hourCircle(c.lat, norm180(c.lon), 180);
      const nearest = Math.min(...arc.map((q) =>
        angularDistance({ lat: q.H, lon: q.Az }, { lat: here.H, lon: here.Az })));
      expect(nearest, c.name).toBeLessThan(1);
    }
  });

  it('is the conversion the sun already uses, with a different declination', () => {
    for (const c of skies) {
      const q = altAz(c.lat, c.sky.solar.dec, c.sky.lha);
      expect(q.H, `${c.name} altitude`).toBeCloseTo(c.sky.H, 9);
      expect(q.Az, `${c.name} azimuth`).toBeCloseTo(c.sky.Az, 9);
    }
  });
});

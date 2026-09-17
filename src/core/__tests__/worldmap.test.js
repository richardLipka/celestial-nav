import { describe, it, expect } from 'vitest';

import { LAND, LAND_SIZE } from '../../worldmap.js';
import { state } from '../../state/store.js';
import { dictionaries, LANGS } from '../../i18n.js';

// =========================================================================
// The coastlines.
//
// A map is an assertion about where the land is, and the only honest way to
// check one is to ask it about places whose answer is not in doubt. Thirty-odd
// probes, well inland and well out to sea, and none of them within a few
// degrees of a coast -- the outline is simplified to a third of a degree, and
// a probe on a beach would be testing the simplification rather than the map.
// =========================================================================

const D = Math.PI / 180;
const vec = (lat, lon) => [
  Math.cos(lat * D) * Math.cos(lon * D),
  Math.cos(lat * D) * Math.sin(lon * D),
  Math.sin(lat * D),
];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const minus = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const times = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const unit = (a) => {
  const n = Math.hypot(a[0], a[1], a[2]);
  return n < 1e-12 ? null : times(a, 1 / n);
};

/**
 * Winding number of a ring about a point, on the sphere: the sum of the
 * signed angles the ring's edges subtend at it.
 *
 * Not the flat ray-casting test, which cannot answer for Antarctica at all --
 * that ring encircles a pole, so in a longitude/latitude plane it is a band
 * 360 degrees wide and "inside" has no meaning. On the sphere it is a ring
 * like any other. Natural Earth winds its outlines one way round, so land
 * comes out at -2 pi and open sea at zero.
 */
function winding(ring, p) {
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const a = unit(minus(vec(ring[i][1], ring[i][0]),
      times(p, dot(vec(ring[i][1], ring[i][0]), p))));
    const b = unit(minus(vec(ring[i + 1][1], ring[i + 1][0]),
      times(p, dot(vec(ring[i + 1][1], ring[i + 1][0]), p))));
    if (!a || !b) continue;
    let ang = Math.acos(Math.max(-1, Math.min(1, dot(a, b))));
    if (dot(cross(a, b), p) < 0) ang = -ang;
    sum += ang;
  }
  return sum;
}

const onLand = (lat, lon) => {
  const p = vec(lat, lon);
  return LAND.some((ring) => winding(ring, p) < -Math.PI);
};

const ASHORE = [
  ['Prague', 50.1, 14.4], ['Niamey', 13.5, 2.1], ['Ulaanbaatar', 47.9, 106.9],
  ['Denver', 39.7, -105], ['Manaus', -3.1, -60], ['Alice Springs', -23.7, 133.9],
  ['Yakutsk', 62, 129.7], ['Kinshasa', -4.3, 15.3], ['Lhasa', 29.7, 91.1],
  ['Winnipeg', 49.9, -97.1], ['the south pole', -89.5, 0],
  ['inland Antarctica', -80, 60], ['inland Greenland', 72, -42],
  ['Kazakhstan', 48, 68], ['Amazonia', -5, -65], ['Madagascar', -19, 46.5],
  ['Borneo', 0.5, 114], ['Iceland', 64.8, -18.6],
];

const AFLOAT = [
  ['the North Atlantic', 30, -40], ['the Pacific', 0, -150],
  ['the Southern Ocean', -55, 90], ['the Indian Ocean', -20, 75],
  ['the North Pacific', 40, -150], ['the Gulf of Guinea', 0, 0],
  ['the north pole', 89.5, 0], ['the South Atlantic', -40, -30],
  ['the north-east Atlantic', 58, -25], ['the Tasman Sea', -40, 160],
  ['the Arabian Sea', 15, 63], ['the Coral Sea', -18, 158],
  ['the Weddell Sea', -68, -40], ['the mid Pacific', -20, -120],
];

describe('the world map', () => {
  it('puts every one of these places on the land it is on', () => {
    for (const [name, lat, lon] of ASHORE) expect(onLand(lat, lon), name).toBe(true);
  });

  it('and every one of these at sea', () => {
    for (const [name, lat, lon] of AFLOAT) expect(onLand(lat, lon), name).toBe(false);
  });

  it('knows that one pole is land and the other is not', () => {
    // The pair the flat test could never have answered, and the reason the
    // one above works on the sphere instead.
    expect(onLand(-89.5, 0), 'Antarctica').toBe(true);
    expect(onLand(89.5, 0), 'the Arctic Ocean').toBe(false);
  });

  it('is made of closed rings, in range, and has not been gutted', () => {
    let points = 0;
    for (const [i, ring] of LAND.entries()) {
      points += ring.length;
      expect(ring.length, `ring ${i}`).toBeGreaterThan(3);
      expect(ring[0], `ring ${i} is closed`).toEqual(ring[ring.length - 1]);
      for (const [lon, lat] of ring) {
        expect(lon >= -180 && lon <= 180, `ring ${i} longitude ${lon}`).toBe(true);
        expect(lat >= -90 && lat <= 90, `ring ${i} latitude ${lat}`).toBe(true);
      }
    }
    expect(LAND.length).toBe(LAND_SIZE.rings);
    expect(points).toBe(LAND_SIZE.points);
    // Small enough to ship without a build step, big enough to be a map.
    expect(points).toBeGreaterThan(900);
    expect(points).toBeLessThan(4000);
  });

  it('has the four great landmasses where they belong', () => {
    // Longitudes unwrapped along the ring, so a landmass that crosses the
    // antimeridian reads as one span rather than two.
    const box = (ring) => {
      let prev = ring[0][0];
      let lo = prev;
      let hi = prev;
      let latLo = ring[0][1];
      let latHi = ring[0][1];
      for (const [x, y] of ring) {
        // The nearest image of this longitude to the last one: a landmass
        // that crosses the antimeridian then reads as one span.
        const lon = x - Math.round((x - prev) / 360) * 360;
        prev = lon;
        lo = Math.min(lo, lon);
        hi = Math.max(hi, lon);
        latLo = Math.min(latLo, y);
        latHi = Math.max(latHi, y);
      }
      return { lo, hi, latLo, latHi };
    };
    const area = (ring) => {
      let s = 0;
      for (let i = 0; i < ring.length - 1; i++) {
        s += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
      }
      return Math.abs(s) / 2;
    };
    const biggest = [...LAND].sort((a, b) => area(b) - area(a)).slice(0, 4).map(box);
    // Africa-Eurasia: from the Atlantic coast of Africa to the Pacific coast
    // of Siberia, from the Cape to the Arctic.
    expect(biggest[0].lo).toBeLessThan(-15);
    expect(biggest[0].hi).toBeGreaterThan(170);
    expect(biggest[0].latLo).toBeLessThan(-33);
    expect(biggest[0].latHi).toBeGreaterThan(75);
    // One of the other three reaches the south pole, and one of them reaches
    // past 60 north: Antarctica and the Americas.
    expect(biggest.some((b) => b.latLo <= -89)).toBe(true);
    expect(biggest.some((b) => b.latHi > 60 && b.lo < -100)).toBe(true);
  });
});

describe('the two switches', () => {
  it('start the way the argument wants them', () => {
    // The map is an aid and starts off; the frame is what a sphere is placed
    // against and starts on.
    expect(state.show.map).toBe(false);
    expect(state.show.frame).toBe(true);
  });

  it('are named in both languages', () => {
    for (const lang of LANGS) {
      expect(dictionaries[lang]['show.map'], lang).toBeTruthy();
      expect(dictionaries[lang]['show.frame'], lang).toBeTruthy();
    }
  });
});

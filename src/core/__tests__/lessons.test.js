import { describe, it, expect, beforeEach } from 'vitest';

import * as store from '../../state/store.js';
import { applyStep } from '../../views/lessonbar.js';
import { lessons, lessonById } from '../../lessons.js';
import { verdict } from '../../views/workup.js';
import { dictionaries, LANGS } from '../../i18n.js';

// The other suites pin the physics. This one pins the *claims*: a lesson step
// says something in words, and the reader sees whatever the store derived. If
// those two drift apart the lesson is worse than useless, because it teaches
// the reader to distrust the instrument. So walk each lesson the way a reader
// does and check the screen against the sentence.

/** Step through a whole lesson and hand back the state at the end. */
const walk = (id, upTo = Infinity) => {
  const lesson = lessonById(id);
  const n = Math.min(upTo, lesson.steps.length);
  for (let i = 0; i < n; i++) applyStep(store, id, i);
  return store.get();
};

beforeEach(() => {
  store.set({ lesson: null, lessonStep: 0 });
  store.clearSights();
});

describe('every lesson step', () => {
  it('leaves the application in a state its own text describes', () => {
    for (const l of lessons) {
      for (const [i, step] of l.steps.entries()) {
        applyStep(store, l.id, i);
        const s = store.state;
        if (step.tab) expect(s.tab, `${l.id}[${i}] tab`).toBe(step.tab);
        if (step.view) expect(s.skyView, `${l.id}[${i}] view`).toBe(step.view);
        if (step.state?.scenario) expect(s.scenario, `${l.id}[${i}]`).toBe(step.state.scenario);
      }
    }
  });

  it('never leaves a step talking about a log that is empty', () => {
    // A reader can walk past the step that asked them to take a sight. Any
    // step that points at the log or the work-up has to stand on its own.
    for (const l of lessons) {
      for (const [i, step] of l.steps.entries()) {
        applyStep(store, l.id, i);
        if (step.asks) continue; // this one is asking the reader to fill it
        if (step.panel !== 'p-log' && step.panel !== 'p-workup') continue;
        const d = store.get();
        expect(d.observations.length, `${l.id}[${i}] points at an empty log`).toBeGreaterThan(0);
        expect(d.logResult.stage, `${l.id}[${i}] has nothing worked up`).not.toBe('none');
      }
    }
  });
});

describe('the noon lesson', () => {
  it('has a latitude to show by the step that announces one', () => {
    const d = walk('noon', 4);
    expect(d.logResult.stage).not.toBe('none');
    expect(Math.abs(d.logResult.lat - store.state.lat) * 60).toBeLessThan(3);
  });

  it('quotes the right two numbers for an hour of clock error', () => {
    // The last step claims the longitude jumps nine hundred miles and the
    // latitude a mile and a half. Latitude is not *quite* immune: declination
    // is looked up at the chronometer's instant, so an hour of error moves it
    // by an hour's worth of declination -- about 1' at the equinox, when
    // declination changes fastest. Saying "it has not moved" was a lie, and a
    // needless one, because the true ratio is six hundred to one.
    const a = walk('noon', 4).logResult;
    const beforeLat = a.lat;
    const beforeLon = a.lonByMax;
    const after = walk('noon').logResult;
    expect(store.state.clockErrorSec).toBe(3600);

    const latNm = Math.abs(after.lat - beforeLat) * 60;
    const lonNm = Math.abs(after.lonByMax - beforeLon) * 60 * Math.cos((after.lat * Math.PI) / 180);
    expect(latNm, 'a mile and a half').toBeGreaterThan(0.5);
    expect(latNm, 'a mile and a half').toBeLessThan(3);
    expect(lonNm, 'nine hundred miles').toBeGreaterThan(800);
    expect(lonNm, 'nine hundred miles').toBeLessThan(1000);
    expect(lonNm / latNm, 'the ratio is the whole subject').toBeGreaterThan(300);
  });
});

describe('the equal-altitudes lesson', () => {
  it('reaches a full reduction, with a pair the reader was told to make', () => {
    const d = walk('equalalt');
    expect(d.logResult.stage).toBe('full');
    expect(d.logResult.equalAlt).toBeTruthy();
    expect(d.logResult.equalAlt.pair.observed).toBe(true);
  });

  it('shows equal altitudes beating the peak, which is what it claims', () => {
    // Reading error is drawn fresh for every sight, so a single run proves
    // nothing -- the peak method wins outright now and then, by luck. The
    // lesson's claim is about the method, so test it as one: run it forty
    // times and compare the medians.
    const med = (a) => a.sort((x, y) => x - y)[Math.floor(a.length / 2)];
    const pair = [];
    const peak = [];
    for (let i = 0; i < 40; i++) {
      store.clearSights();
      const d = walk('equalalt');
      const truth = store.state.lon;
      expect(d.logResult.equalAlt, `run ${i} failed to pair`).toBeTruthy();
      pair.push(Math.abs(d.logResult.equalAlt.lon - truth) * 60);
      peak.push(Math.abs(d.logResult.lonByMax - truth) * 60);
    }
    expect(med(pair), 'equal altitudes, median error in arcminutes').toBeLessThan(med(peak));
    // And by a margin worth putting a lesson around, not a coin toss.
    expect(med(peak) / med(pair)).toBeGreaterThan(2);
  });
});

describe('the chronometer lesson', () => {
  it('arrives with the watch, comfortably inside the half degree it names', () => {
    const d = walk('clock', 3);
    expect(d.voyage.arrived).toBe(true);
    expect(d.voyage.truthToDestNm).toBeLessThan(30);
    // Half a degree of longitude, in miles along the parallel it arrives on.
    const halfDegNm = 30 * Math.cos((d.voyage.truth.lat * Math.PI) / 180);
    expect(Math.abs(d.voyage.error.lonNm)).toBeLessThan(halfDegNm);
  });

  it('loses the island without it, along the parallel and not across it', () => {
    const d = walk('clock');
    expect(d.voyage.arrived).toBe(false);
    expect(Math.abs(d.voyage.error.latNm), 'the noon sight held the latitude').toBeLessThan(5);
    expect(Math.abs(d.voyage.error.lonNm), 'hundreds of miles along it').toBeGreaterThan(200);
  });
});

describe('the sentence the work-up ends on', () => {
  const call = (o) => verdict({ byPeak: null, hasEqualAlt: true, ...o });

  it('never announces a multiple that rounds to nothing', () => {
    // The bug: equal altitudes doing its job well makes the longitude *better*
    // than the latitude, and the ratio sentence then read "0 times".
    for (const [errLon, errLat] of [[0.32, 0.64], [1, 1], [0.1, 9], [1.4, 1]]) {
      const v = call({ errLon, errLat });
      expect(v.key, `${errLon}/${errLat}`).toBe('wu.noteEven');
      expect(v.ratio).toBeUndefined();
    }
  });

  it('still counts the multiple when there is one worth quoting', () => {
    expect(call({ errLon: 90, errLat: 1 })).toEqual({ key: 'wu.noteRatio', ratio: 90 });
    expect(call({ errLon: 2, errLat: 1 })).toEqual({ key: 'wu.noteRatio', ratio: 2 });
    expect(call({ errLon: 9000, errLat: 1 }).key).toBe('wu.noteAll');
  });

  it('keeps the earlier branches', () => {
    expect(call({ errLon: 5, errLat: 1, hasEqualAlt: false }).key).toBe('wu.notePeakOnly');
    expect(call({ errLon: 1, errLat: 1, byPeak: 20 }).key).toBe('wu.noteMethods');
    expect(call({ errLon: 5, errLat: 0 }).key).toBe('wu.noteNoLat');
  });

  it('has every sentence it can choose, in both languages', () => {
    const keys = new Set();
    for (const errLon of [0, 0.3, 1, 2, 50, 5000]) {
      for (const errLat of [0, 0.5, 1, 4]) {
        for (const byPeak of [null, 0.2, 40]) {
          for (const hasEqualAlt of [true, false]) {
            keys.add(verdict({ errLat, errLon, byPeak, hasEqualAlt }).key);
          }
        }
      }
    }
    for (const k of keys) for (const lang of LANGS) expect(dictionaries[lang][k], `${lang}.${k}`).toBeTruthy();
  });
});

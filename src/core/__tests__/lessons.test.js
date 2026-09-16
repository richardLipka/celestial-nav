import { describe, it, expect, beforeEach } from 'vitest';

import * as store from '../../state/store.js';
import { applyStep } from '../../views/lessonbar.js';
import { lessons, lessonById } from '../../lessons.js';
import { verdict } from '../../views/workup.js';
import { dictionaries, LANGS } from '../../i18n.js';
import { richText } from '../../ui/text.js';

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
        const d = store.get();
        if (step.panel === 'p-log' || step.panel === 'p-workup') {
          expect(d.observations.length, `${l.id}[${i}] points at an empty log`).toBeGreaterThan(0);
          expect(d.logResult.stage, `${l.id}[${i}] has nothing worked up`).not.toBe('none');
        }
        // The lunar panels are the same promise about a different log.
        if (step.panel === 'p-lunlog' || step.panel === 'p-lunwork' || step.panel === 'p-luncost') {
          expect(d.lunar.sights.length, `${l.id}[${i}] points at an empty lunar log`).toBeGreaterThan(0);
          expect(d.lunar.gmt, `${l.id}[${i}] has no Greenwich time to show`).toBeTruthy();
        }
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
    // Walk to step 4, then apply ONLY step 5. Re-walking from the top would
    // re-run step 0, which clears the log, so step 3 would draw a *different*
    // sight with a different reading error -- and the comparison would be
    // between two sights rather than between two clocks. That is what this
    // test did at first, and it passed on luck.
    const a = walk('noon', 4).logResult;
    const beforeLat = a.lat;
    const beforeLon = a.lonByMax;
    applyStep(store, 'noon', 4);
    const after = store.get().logResult;
    expect(store.state.clockErrorSec).toBe(3600);
    expect(store.get().observations.length, 'the same single sight throughout').toBe(1);

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

describe('the lunars lesson', () => {
  it('ends up with a Greenwich time good to the minute it promises', () => {
    const d = walk('lunars');
    expect(d.lunar.sights.length, 'a round was taken').toBeGreaterThan(1);
    expect(Math.abs(d.lunar.errorSec), 'seconds of GMT').toBeLessThan(60);
  });

  it('quotes the thirty-to-one it claims in its last step', () => {
    const d = walk('lunars');
    // "one arcminute ... some thirty miles of longitude", against one mile
    // for a noon sight. The figure moves with the moon's rate, so allow the
    // range the rate actually spans rather than a single number.
    expect(Math.abs(d.lunar.cost.nm)).toBeGreaterThan(20);
    expect(Math.abs(d.lunar.cost.nm)).toBeLessThan(45);
    expect(d.lunar.cost.minutesOfTime).toBeGreaterThan(1.5);
    expect(d.lunar.cost.minutesOfTime).toBeLessThan(3);
  });
});


// =========================================================================
// What the guides say in words, against what the reader will see -- and
// against the interface, when they quote a button by name.
// =========================================================================
describe('the words the guides use', () => {
  const stepText = (id, i, lang) => lessonById(id).steps[i].text[lang];

  it('quotes only buttons that exist, by the name they actually carry', () => {
    // A guide that names a control has to name it exactly: the reader is
    // hunting the screen for those words. English sets them in “...”, Czech
    // in „...“, and every one of them must be a string from the dictionary.
    const marks = {
      en: /[“]([^”]+)[”]/g,
      cs: /[„]([^“]+)[“]/g,
    };
    let found = 0;
    for (const l of lessons) {
      for (const [i, step] of l.steps.entries()) {
        for (const lang of LANGS) {
          const values = new Set(Object.values(dictionaries[lang]));
          for (const m of step.text[lang].matchAll(marks[lang])) {
            found++;
            expect(values, `${l.id}[${i}].${lang} quotes "${m[1]}"`).toContain(m[1]);
          }
        }
      }
    }
    expect(found, 'the guides do quote controls').toBeGreaterThan(3);
  });

  it('does not tell the reader to add when the panel beside it subtracts', () => {
    // The noon lesson runs on the equinox preset, where the sun passes a few
    // arcminutes *north* of the zenith: the work-up reads phi = delta - z. The
    // step used to say "add them and you have it".
    const d = walk('noon', 4);
    expect(d.logResult.sunBearsSouth, 'the sun passes north of the zenith here').toBe(false);
    expect(stepText('noon', 3, 'en')).toContain('which side of your zenith');
    expect(stepText('noon', 3, 'cs')).toContain('kterou stranou zenitu');
    expect(stepText('noon', 3, 'en')).not.toContain('Add them');
  });

  it('moves the latitude by the one mile it now claims, not a mile and a half', () => {
    const before = walk('noon', 4).logResult.lat;
    applyStep(store, 'noon', 4);
    const moved = Math.abs(store.get().logResult.lat - before) * 60;
    expect(moved, 'one mile').toBeGreaterThan(0.85);
    expect(moved, 'one mile').toBeLessThan(1.15);
    expect(stepText('noon', 4, 'en')).toContain('one mile');
    expect(stepText('noon', 4, 'cs')).toContain('jednu míli');
  });

  it('costs a mile every four seconds off Jamaica, and half a mile an hour of it', () => {
    walk('clock', 1);
    const base = store.get().logResult;
    const cosLat = Math.cos((store.state.lat * Math.PI) / 180);
    const move = (sec) => {
      store.set({ clockErrorSec: sec });
      const r = store.get().logResult;
      return {
        lon: Math.abs(r.lon - base.lon) * 60 * cosLat,
        lat: Math.abs(r.lat - base.lat) * 60,
      };
    };

    const four = move(4);
    expect(four.lon, 'a mile for every four seconds').toBeGreaterThan(0.85);
    expect(four.lon, 'a mile for every four seconds').toBeLessThan(1.15);

    const hour = move(3600);
    expect(hour.lat, 'half a mile for a whole hour').toBeGreaterThan(0.4);
    expect(hour.lat, 'half a mile for a whole hour').toBeLessThan(0.7);
    expect(hour.lon / hour.lat, 'more than a thousand to one').toBeGreaterThan(1000);

    for (const lang of LANGS) {
      expect(stepText('clock', 0, lang).length).toBeGreaterThan(80);
    }
    expect(stepText('clock', 0, 'en')).toContain('a mile for every four seconds');
    expect(stepText('clock', 0, 'en')).toContain('half a mile for a whole hour');
    expect(stepText('clock', 0, 'cs')).toContain('o míli za každé čtyři sekundy');
    expect(stepText('clock', 0, 'cs')).toContain('půl míle za celou hodinu');
  });

  it('sails the passage in the three and a half weeks it says, not three', () => {
    const v = walk('clock', 3).voyage;
    expect(v.arrived).toBe(true);
    expect(v.legs.length, 'days at sea').toBeGreaterThan(22);
    expect(v.legs.length, 'days at sea').toBeLessThan(29);
    expect(v.legs.length / 7, 'three and a half weeks').toBeGreaterThan(3.2);
    expect(stepText('clock', 2, 'en')).toContain('three and a half weeks');
    expect(stepText('clock', 2, 'cs')).toContain('tři a půl týdne');
  });

  it('pairs up its emphasis, and leans on words the reader can see it lean on', () => {
    // The lesson bar sets innerHTML through the same renderer the theory tab
    // uses, so *rate* is italic -- but only while the marks come in pairs. It
    // set textContent for years, and those four words wore their asterisks.
    let emphasised = 0;
    for (const l of lessons) {
      for (const [i, step] of l.steps.entries()) {
        for (const lang of LANGS) {
          const text = step.text[lang];
          const stripped = text.replace(/\*\*[^*]+\*\*/g, '').replace(/\*[^*]+\*/g, '');
          expect(stripped, `${l.id}[${i}].${lang} has an unpaired asterisk`).not.toContain('*');
          if (stripped !== text) emphasised++;
          expect(richText(text), `${l.id}[${i}].${lang}`).not.toContain('*');
        }
      }
    }
    expect(emphasised, 'the guides do lean on words').toBeGreaterThan(2);
  });

  it('spreads the round of lunars over about the minute of GMT it names', () => {
    // The scatter *is* the reading error, drawn fresh every time, so one round
    // proves nothing: it has come out at a fifth of a minute and at two. The
    // claim is about the typical round, so take the median of a few dozen.
    const runs = [];
    for (let i = 0; i < 25; i++) {
      store.set({ lesson: null, lessonStep: 0, lunarSights: [] });
      runs.push(walk('lunars').lunar.spreadSec / 60);
    }
    runs.sort((a, b) => a - b);
    const median = runs[Math.floor(runs.length / 2)];
    expect(median, 'a minute or so').toBeGreaterThan(0.7);
    expect(median, 'a minute or so').toBeLessThan(2);
    expect(stepText('lunars', 1, 'en')).toContain('a minute or so of Greenwich time');
    expect(stepText('lunars', 1, 'cs')).toContain('minuta greenwichského času');
  });
});

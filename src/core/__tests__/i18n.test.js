import { describe, it, expect, afterAll } from 'vitest';

import { dictionaries, LANGS, LANG_LABEL, t, setLang, getLang, pick, latSuffix, lonSuffix } from '../../i18n.js';
import { places, GROUPS, findPlace, placeById, applyPlace } from '../../places.js';
import { fLat, fLon } from '../../ui/format.js';
import { scenarios, applyScenario, byId } from '../../scenarios.js';
import { noonWorkUp } from '../fix.js';
import { routes } from '../../routes.js';
import { lessons } from '../../lessons.js';
import { setDecimalSeparator, fmtLat, fmtLon, dm, fmtNm, fmtNumber } from '../angles.js';

const before = getLang();
afterAll(() => {
  setLang(before);
  setDecimalSeparator('.');
});

const placeholders = (s) => (s.match(/\{[a-z]+\}/gi) || []).sort().join(',');

describe('translations', () => {
  it('offers exactly Czech and English', () => {
    expect(LANGS.sort()).toEqual(['cs', 'en']);
    expect(Object.keys(dictionaries).sort()).toEqual(['cs', 'en']);
  });

  it('has no key present in one language and missing from the other', () => {
    const en = Object.keys(dictionaries.en).sort();
    const cs = Object.keys(dictionaries.cs).sort();
    expect(cs.filter((k) => !dictionaries.en[k])).toEqual([]);
    expect(en.filter((k) => !dictionaries.cs[k])).toEqual([]);
    expect(cs).toEqual(en);
  });

  it('has no blank string in either language', () => {
    for (const lang of LANGS) {
      for (const [k, v] of Object.entries(dictionaries[lang])) {
        expect(typeof v, `${lang}.${k}`).toBe('string');
        expect(v.trim().length, `${lang}.${k}`).toBeGreaterThan(0);
      }
    }
  });

  it('keeps the same placeholders in both languages', () => {
    for (const k of Object.keys(dictionaries.en)) {
      expect(placeholders(dictionaries.cs[k]), `placeholders differ for ${k}`)
        .toBe(placeholders(dictionaries.en[k]));
    }
  });

  it('substitutes placeholders in both languages', () => {
    for (const lang of LANGS) {
      setLang(lang);
      const s = t('sky.poleAlt', { a: '50° 00.0′' });
      expect(s).toContain('50° 00.0′');
      expect(s).not.toContain('{a}');
    }
  });

  it('uses distinct hemisphere suffixes so N never means two things', () => {
    setLang('en');
    expect(latSuffix()).toEqual(['N', 'S']);
    expect(lonSuffix()).toEqual(['E', 'W']);
    setLang('cs');
    // Czech "S" is sever, i.e. north -- a bare letter would be ambiguous to a
    // bilingual reader, so coordinates take the full Czech abbreviations.
    expect(latSuffix()).toEqual(['s.š.', 'j.š.']);
    expect(lonSuffix()).toEqual(['v.d.', 'z.d.']);
    expect(new Set([...latSuffix(), ...lonSuffix()]).size).toBe(4);
  });

  it('reads the compass rose in Czech as S V J Z', () => {
    setLang('cs');
    expect([t('sky.N'), t('sky.E'), t('sky.S'), t('sky.W')]).toEqual(['S', 'V', 'J', 'Z']);
    setLang('en');
    expect([t('sky.N'), t('sky.E'), t('sky.S'), t('sky.W')]).toEqual(['N', 'E', 'S', 'W']);
  });

  it('labels the switch CZ and EN, which is not what the codes are', () => {
    // The language code is 'cs'; the button has to say CZ. Upper-casing the
    // code gave CS, which a Czech reader does not recognise as their flag.
    expect(LANG_LABEL).toEqual({ cs: 'CZ', en: 'EN' });
    for (const code of LANGS) expect(LANG_LABEL[code], code).toBeTruthy();
    expect(Object.keys(LANG_LABEL).sort()).toEqual([...LANGS].sort());
  });

  it('picks the right half of an { en, cs } pair', () => {
    setLang('cs');
    expect(pick({ en: 'Prague', cs: 'Praha' })).toBe('Praha');
    setLang('en');
    expect(pick({ en: 'Prague', cs: 'Praha' })).toBe('Prague');
  });
});

describe('the decimal separator', () => {
  it('switches to a comma for Czech and back', () => {
    setLang('cs');
    expect(dm(50.0755)).toBe('50° 04,5′');
    expect(fmtNumber(3.5, 1)).toBe('3,5');
    expect(fmtNm(29.53)).toBe('29,5 nm');
    setLang('en');
    expect(dm(50.0755)).toBe('50° 04.5′');
    expect(fmtNumber(3.5, 1)).toBe('3.5');
    expect(fmtNm(29.53)).toBe('29.5 nm');
  });

  it('never touches arithmetic', () => {
    setDecimalSeparator(',');
    expect(Number.parseFloat('50.5') + 1).toBe(51.5);
    setDecimalSeparator('.');
  });
});

describe('places', () => {
  it('includes Prague and Plzeň', () => {
    const praha = placeById('praha');
    const plzen = placeById('plzen');
    expect(praha.lat).toBeCloseTo(50.08, 1);
    expect(praha.lon).toBeCloseTo(14.44, 1);
    expect(plzen.lat).toBeCloseTo(49.75, 1);
    expect(plzen.lon).toBeCloseTo(13.38, 1);
  });

  it('has unique ids, valid coordinates and a name in both languages', () => {
    expect(new Set(places.map((p) => p.id)).size).toBe(places.length);
    for (const p of places) {
      expect(Math.abs(p.lat), p.id).toBeLessThanOrEqual(90);
      expect(Math.abs(p.lon), p.id).toBeLessThanOrEqual(180);
      expect(GROUPS, p.id).toContain(p.group);
      expect(p.name.en.length, p.id).toBeGreaterThan(0);
      expect(p.name.cs.length, p.id).toBeGreaterThan(0);
    }
  });

  it('offers several Czech towns and a spread of world positions', () => {
    const cz = places.filter((p) => p.group === 'cz');
    const world = places.filter((p) => p.group === 'world');
    expect(cz.length).toBeGreaterThanOrEqual(8);
    expect(world.length).toBeGreaterThanOrEqual(8);
    // North and south of the equator, and either side of Greenwich.
    expect(world.some((p) => p.lat < -30)).toBe(true);
    expect(world.some((p) => p.lat > 60)).toBe(true);
    expect(world.some((p) => p.lon < -60)).toBe(true);
    expect(world.some((p) => p.lon > 60)).toBe(true);
  });

  it('recognises a position it has just been moved to', () => {
    for (const p of places) {
      const s = applyPlace(p);
      expect(findPlace(s.lat, s.lon).id).toBe(p.id);
    }
    expect(findPlace(41.2, 3.4)).toBeUndefined();
  });

  it('moves the ship without touching the clock', () => {
    // It used to snap the clock to the new local apparent noon, which had the
    // side effect of making the longitude control do nothing anybody could
    // see: the sun sat on the meridian at every longitude. That is the one
    // thing about longitude that is always true and the last thing this
    // program should demonstrate by accident.
    for (const p of places) {
      expect(applyPlace(p), p.id).not.toHaveProperty('secondOfDay');
    }
  });

  it('gives zero no hemisphere, in either language', () => {
    // The equator is not north and the prime meridian is not east.
    for (const lang of LANGS) {
      setLang(lang);
      expect(fLat(0), lang).toBe('00° 00.0′'.replace('.', lang === 'cs' ? ',' : '.'));
      expect(fLon(0), lang).toBe('000° 00.0′'.replace('.', lang === 'cs' ? ',' : '.'));
      // A value that still rounds to zero gets no suffix either...
      expect(fLat(0.02 / 60), lang).toMatch(/′$/);
      // ...but one that does not keeps it.
      expect(fLat(0.4 / 60), lang).not.toMatch(/′$/);
      expect(fLon(-30), lang).not.toMatch(/′$/);
    }
    setLang('en');
    expect(fLat(-0.5)).toBe('00° 30.0′ S');
    expect(fLon(30)).toBe('030° 00.0′ E');
  });

  it('formats a Czech town correctly in each language', () => {
    const praha = placeById('praha');
    setLang('en');
    expect(fmtLat(praha.lat, 1, latSuffix())).toBe('50° 04.5′ N');
    expect(fmtLon(praha.lon, 1, lonSuffix())).toBe('014° 26.3′ E');
    setLang('cs');
    expect(fmtLat(praha.lat, 1, latSuffix())).toBe('50° 04,5′ s.š.');
    expect(fmtLon(praha.lon, 1, lonSuffix())).toBe('014° 26,3′ v.d.');
  });
});

describe('lessons and routes', () => {
  it('counts the lessons the way the picker says it does', () => {
    // The picker's blurb names the number in words, and Czech inflects the
    // noun after it, so a {n} placeholder would produce bad grammar. A
    // tripwire instead: add a lesson and this fails, pointing at the string
    // that has to change with it.
    expect(lessons.length, 'if this changes, update `lesson.pick` in BOTH languages').toBe(5);
    expect(dictionaries.en['lesson.pick']).toMatch(/^Five /);
    expect(dictionaries.cs['lesson.pick']).toMatch(/^Pět /);
  });

  it('writes every lesson in both languages', () => {
    expect(lessons.length).toBeGreaterThanOrEqual(4);
    for (const l of lessons) {
      for (const lang of LANGS) {
        expect(l.title[lang], `${l.id}.title.${lang}`).toBeTruthy();
        expect(l.blurb[lang], `${l.id}.blurb.${lang}`).toBeTruthy();
      }
      expect(l.steps.length, l.id).toBeGreaterThan(1);
      for (const [i, step] of l.steps.entries()) {
        for (const lang of LANGS) {
          expect(step.text[lang], `${l.id}[${i}].${lang}`).toBeTruthy();
          expect(step.text[lang].length, `${l.id}[${i}].${lang}`).toBeGreaterThan(60);
        }
      }
    }
  });

  it('only points lessons at scenarios, tabs and panels that exist', () => {
    const ids = new Set(scenarios.map((s) => s.id));
    const tabs = new Set(['theory', 'simulation', 'voyage', 'lunars']);
    const views = new Set(['dome', 'sextant']);
    const panels = new Set([
      'p-sky', 'p-globe', 'p-log', 'p-workup',
      'p-lunsky', 'p-lunlog', 'p-lunwork', 'p-luncost',
      null, undefined,
    ]);
    for (const l of lessons) {
      for (const [i, step] of l.steps.entries()) {
        if (step.state?.scenario) expect(ids, `${l.id}[${i}]`).toContain(step.state.scenario);
        if (step.tab) expect(tabs, `${l.id}[${i}]`).toContain(step.tab);
        if (step.view) expect(views, `${l.id}[${i}]`).toContain(step.view);
        expect(panels, `${l.id}[${i}] panel`).toContain(step.panel);
      }
    }
  });

  it('names and describes every route in both languages', () => {
    for (const r of routes) {
      for (const lang of LANGS) {
        expect(r.name[lang], `${r.id}.name.${lang}`).toBeTruthy();
        expect(r.note[lang], `${r.id}.note.${lang}`).toBeTruthy();
      }
      expect(Math.abs(r.from.lat)).toBeLessThanOrEqual(90);
      expect(Math.abs(r.to.lon)).toBeLessThanOrEqual(180);
    }
  });
});

describe('scenarios', () => {
  it('quotes figures its own simulation actually produces', () => {
    // A scenario note that names a number is a claim about what the reader
    // will see in the panel beside it. These are the ones that name one.
    const run = (id) => {
      const sc = byId(id);
      const [y, m, d] = sc.date;
      return noonWorkUp(
        { lat: sc.lat, lon: sc.lon, date: new Date(Date.UTC(y, m - 1, d)) },
        { clockErrorSec: sc.clockErrorSec ?? 0, useEoT: sc.useEoT ?? true },
      );
    };

    // "the sun's highest arc of the year, 62 degrees at noon"
    expect(run('greenwich').Ho).toBeCloseTo(62, 0);

    // "the fix is still 247 nm out, because the almanac has been switched off"
    const eot = run('eot');
    expect(Math.abs(eot.error.totalNm)).toBeGreaterThan(246);
    expect(Math.abs(eot.error.totalNm)).toBeLessThan(248);
    for (const lang of LANGS) expect(byId('eot').note[lang]).toContain('247');

    // "the latitude still lands within a mile" with the clock half an hour out
    const lat = run('latsail');
    expect(Math.abs(lat.error.latNm), 'within a mile').toBeLessThan(1);
    expect(Math.abs(lat.error.lonNm), 'and the longitude worthless').toBeGreaterThan(300);

    // "declination is three arcminutes from zero", and the sun passes north of
    // the zenith there, which is why the note gives the sign rather than
    // claiming phi = 90 - Ho outright.
    const eq = run('equinox');
    expect(Math.abs(eq.dec) * 60, 'three arcminutes').toBeGreaterThan(2.5);
    expect(Math.abs(eq.dec) * 60, 'three arcminutes').toBeLessThan(4);
    expect(eq.sunBearsSouth, 'the sun passes north of the zenith').toBe(false);
    expect(Math.abs(eq.fix.lat), 'and the latitude falls out as zero').toBeLessThan(0.01);
    for (const lang of LANGS) {
      expect(byId('equinox').note[lang], lang).toContain('\u00b1(90');
    }
  });

  it('names and describes every scenario in both languages', () => {
    for (const sc of scenarios) {
      for (const lang of LANGS) {
        expect(sc.name[lang], `${sc.id}.name.${lang}`).toBeTruthy();
        expect(sc.note[lang], `${sc.id}.note.${lang}`).toBeTruthy();
        expect(sc.note[lang].length, `${sc.id}.note.${lang}`).toBeGreaterThan(40);
      }
    }
  });
});

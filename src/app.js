import * as store from './state/store.js';
import { createSkyDome } from './views/skydome.js';
import { createSextant } from './views/sextant.js';
import { createGlobe } from './views/globe.js';
import { createWorkup } from './views/workup.js';
import { createTimeline } from './views/timeline.js';
import { createSightLog } from './views/sightlog.js';
import { createTheory } from './views/theory.js';
import { createVoyage } from './views/voyage.js';
import { createLunars } from './views/lunars.js';
import { createLessonBar, createLessonPicker } from './views/lessonbar.js';
import { createRail } from './ui/rail.js';
import { byId, applyScenario } from './scenarios.js';
import { t, getLang, setLang, LANGS, LANG_LABEL } from './i18n.js';

const { state, set, subscribe, render, addSight, matchSight, removeSight, clearSights } = store;

const h = (tag, cls, txt) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (txt !== undefined) n.textContent = txt;
  return n;
};

function panel(title, subtitle, content, cls = '', extra = null) {
  const p = h('section', `panel ${cls}`);
  const hd = h('div', 'panel-hd');
  hd.append(h('h2', null, title), h('span', 'panel-sub', subtitle));
  if (extra) hd.append(extra);
  const body = h('div', 'panel-body');
  body.append(...[].concat(content));
  p.append(hd, body);
  return p;
}

function buttonGroup(cls, items, isActive, onPick) {
  const box = h('div', cls);
  box.setAttribute('role', 'group');
  const buttons = [];
  for (const it of items) {
    const b = h('button', `${cls}-btn`, it.label);
    b.type = 'button';
    if (it.lang) b.lang = it.lang;
    b.addEventListener('click', () => onPick(it.id));
    buttons.push([b, it.id]);
    box.append(b);
  }
  const sync = () => {
    for (const [b, id] of buttons) {
      const on = isActive(id);
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', String(on));
    }
  };
  sync();
  return { node: box, sync };
}

import { lessonById } from './lessons.js';

const lessonPanel = (state) => {
  const l = lessonById(state.lesson);
  return l?.steps[Math.min(state.lessonStep, l.steps.length - 1)]?.panel ?? null;
};

// The whole UI is rebuilt when the language changes. Every label would
// otherwise need its own updater, and the state lives in the store, so
// rebuilding costs nothing and cannot drift.
let detach = null;

// Whether the theory tab has already been wound off the meridian. Module
// scope, not mount() scope: a language switch remounts the whole UI, and a
// reader who had deliberately gone back to noon would find the clock moved
// out from under them for the second time.
let nudgedOffMeridian = false;

function mount() {
  if (detach) detach();

  const rotateGlobe = (key) => (dLon, dLat) => {
    const c = state[key];
    set({
      [key]: { lat: Math.max(-85, Math.min(85, c.lat + dLat)), lon: c.lon + dLon },
    });
  };

  const sky = createSkyDome();
  const sextant = createSextant(store);
  const globe = createGlobe(rotateGlobe('globeCenter'));
  const workup = createWorkup();
  const log = createSightLog({
    add: () => addSight(),
    match: (entry) => matchSight(entry),
    remove: (id) => removeSight(id),
    clear: () => clearSights(),
  });
  const timeline = createTimeline(
    (sec) => set({ secondOfDay: sec }),
    () => set({ secondOfDay: null }),
  );
  // The theory sphere turns itself when what it is asked to show is round the
  // back, which needs an absolute centre rather than the drag's increments.
  const centreTheory = (lat, lon) =>
    set({ theoryView: { lat: Math.max(-85, Math.min(85, lat)), lon } });
  const theory = createTheory(rotateGlobe('theoryView'), centreTheory);
  const voyage = createVoyage(store);
  const lunars = createLunars(store);
  const rail = createRail(store);
  const lessonBar = createLessonBar(store);
  const lessonPicker = createLessonPicker(store);

  const app = h('div', 'app');

  // --- top bar ------------------------------------------------------------
  const top = h('header', 'topbar');
  const heading = h('div', 'topbar-text');
  heading.append(h('h1', null, t('app.title')), h('p', 'tagline', t('app.tagline')));

  const tabs = buttonGroup(
    'tabs',
    [
      { id: 'theory', label: t('tab.theory') },
      { id: 'simulation', label: t('tab.simulation') },
      { id: 'voyage', label: t('tab.voyage') },
      { id: 'lunars', label: t('tab.lunars') },
    ],
    (id) => state.tab === id,
    (id) => set({ tab: id }),
  );

  const skyTabs = buttonGroup(
    'sub-tabs',
    [
      { id: 'dome', label: t('sky.tab.dome') },
      { id: 'sextant', label: t('sky.tab.sextant') },
    ],
    (id) => state.skyView === id,
    (id) => set({ skyView: id }),
  );

  const lang = buttonGroup(
    'lang',
    LANGS.map((code) => ({ id: code, label: LANG_LABEL[code], lang: code })),
    (id) => id === getLang(),
    (id) => {
      if (setLang(id)) mount();
    },
  );
  lang.node.setAttribute('aria-label', t('app.langLabel'));

  top.append(heading, tabs.node, lang.node);
  app.append(top, lessonBar.node);

  // --- the three tabs -----------------------------------------------------
  const sim = h('main', 'grid');
  sim.append(
    panel(t('panel.sky'), t('panel.sky.sub'), [sky.node, sextant.node], 'p-sky', skyTabs.node),
    panel(t('panel.earth'), t('panel.earth.sub'), globe.node, 'p-globe'),
    panel(t('panel.log'), t('panel.log.sub'), log.node, 'p-log'),
    panel(t('panel.workup'), t('panel.workup.sub'), workup.node, 'p-workup'),
    timeline.node,
  );

  const thy = h('main', 'theory-wrap');
  thy.append(theory.node);

  const voy = h('main', 'voyage-wrap');
  voy.append(voyage.node);

  // The lunars tab needs its own hands on the clock. `createTimeline` is a
  // factory and both instances read the same store, so a second one costs
  // nothing and keeps the two tabs in step by construction.
  const lunarTimeline = createTimeline(
    (sec) => set({ secondOfDay: sec }),
    () => set({ secondOfDay: null }),
  );
  const lun = h('main', 'lunar-wrap');
  lun.append(lunars.node, lunarTimeline.node);

  rail.node.prepend(lessonPicker.node);

  const body = h('div', 'body');
  body.append(rail.node, sim, thy, voy, lun);
  app.append(body);

  document.getElementById('root').replaceChildren(app);

  // The theory tab's subject is a triangle, and at local apparent noon there
  // is not one: P, Z and X stand on a single meridian, and every figure on
  // the tab is a straight line with all three of its angles either nothing or
  // everything. The clock snaps to noon by default, which is what the other
  // three tabs want, so the first time this tab is opened wind it three hours
  // back -- exactly what the hour slider in the rail does, and exactly what
  // the noon button beside it undoes.
  //
  // Not while a lesson is running: a lesson owns the instant it set, and the
  // one that opens this tab is pointing at the longitude section, where the
  // triangle is not the subject.
  const openOffTheMeridian = (d) => {
    if (nudgedOffMeridian || state.tab !== 'theory' || state.lesson) return;
    nudgedOffMeridian = true;
    if (state.secondOfDay !== null) return;
    const noon = Math.round((d.now - state.date) / 1000);
    const want = noon > 3 * 3600 ? noon - 3 * 3600 : noon + 3 * 3600;
    // Out of the render, like every other state change a view asks for.
    setTimeout(() => set({ secondOfDay: Math.min(Math.max(want, 0), 86340) }), 0);
  };

  const applyTab = () => {
    const tab = state.tab;
    // The tab is on the body element because the rail belongs to all four and
    // has to behave differently on one of them: the theory tab pins it open,
    // because every number in the derivations comes off these controls.
    body.className = `body on-${tab}`;
    sim.hidden = tab !== 'simulation';
    thy.hidden = tab !== 'theory';
    voy.hidden = tab !== 'voyage';
    lun.hidden = tab !== 'lunars';
    theory.setVisible(tab === 'theory');

    const onSextant = state.skyView === 'sextant';
    sky.node.hidden = onSextant;
    sextant.node.hidden = !onSextant;
    sextant.setLive(tab === 'simulation' && onSextant);
    skyTabs.sync();
    tabs.sync();

    // A lesson step can point at one panel; mark it and nothing else.
    const want = state.lesson ? lessonPanel(state) : null;
    for (const p of app.querySelectorAll('.panel')) {
      p.classList.toggle('lit', !!want && p.classList.contains(want));
    }
  };

  detach = subscribe((d, s) => {
    applyTab();
    openOffTheMeridian(d);
    // Panels update even while hidden: they are cheap, and it keeps the tabs
    // from ever disagreeing about the same instant.
    sky.update(d, s);
    sextant.update(d, s);
    globe.update(d, s);
    log.update(d, s);
    workup.update(d, s);
    timeline.update(d, s);
    theory.update(d, s);
    voyage.update(d, s);
    lunars.update(d, s);
    lunarTimeline.update(d, s);
    rail.update(d, s);
    lessonBar.update(d, s);
    lessonPicker.update(d, s);
  });

  render();
}

mount();
set(applyScenario(byId(state.scenario)));

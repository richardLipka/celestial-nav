import * as store from './state/store.js';
import { createSkyDome } from './views/skydome.js';
import { createGlobe } from './views/globe.js';
import { createWorkup } from './views/workup.js';
import { createTimeline } from './views/timeline.js';
import { createSightLog } from './views/sightlog.js';
import { createTheory } from './views/theory.js';
import { createRail } from './ui/rail.js';
import { byId, applyScenario } from './scenarios.js';
import { t, getLang, setLang, LANGS } from './i18n.js';

const { state, set, subscribe, render, addSight, matchSight, removeSight, clearSights } = store;

const h = (tag, cls, txt) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (txt !== undefined) n.textContent = txt;
  return n;
};

function panel(title, subtitle, content, cls = '') {
  const p = h('section', `panel ${cls}`);
  const hd = h('div', 'panel-hd');
  hd.append(h('h2', null, title), h('span', 'panel-sub', subtitle));
  const body = h('div', 'panel-body');
  body.append(content);
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

// The whole UI is rebuilt when the language changes. Every label would
// otherwise need its own updater, and the state lives in the store, so
// rebuilding costs nothing and cannot drift.
let detach = null;

function mount() {
  if (detach) detach();

  const rotateGlobe = (key) => (dLon, dLat) => {
    const c = state[key];
    set({
      [key]: { lat: Math.max(-85, Math.min(85, c.lat + dLat)), lon: c.lon + dLon },
    });
  };

  const sky = createSkyDome();
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
  const theory = createTheory(rotateGlobe('theoryView'));
  const rail = createRail(store);

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
    ],
    (id) => state.tab === id,
    (id) => set({ tab: id }),
  );

  const lang = buttonGroup(
    'lang',
    LANGS.map((code) => ({ id: code, label: code.toUpperCase(), lang: code })),
    (id) => id === getLang(),
    (id) => {
      if (setLang(id)) mount();
    },
  );
  lang.node.setAttribute('aria-label', t('app.langLabel'));

  top.append(heading, tabs.node, lang.node);
  app.append(top);

  // --- the two tabs -------------------------------------------------------
  const sim = h('main', 'grid');
  sim.append(
    panel(t('panel.sky'), t('panel.sky.sub'), sky.node, 'p-sky'),
    panel(t('panel.earth'), t('panel.earth.sub'), globe.node, 'p-globe'),
    panel(t('panel.log'), t('panel.log.sub'), log.node, 'p-log'),
    panel(t('panel.workup'), t('panel.workup.sub'), workup.node, 'p-workup'),
    timeline.node,
  );

  const thy = h('main', 'theory-wrap');
  thy.append(theory.node);

  const body = h('div', 'body');
  body.append(rail.node, sim, thy);
  app.append(body);

  document.getElementById('root').replaceChildren(app);

  const applyTab = () => {
    const onTheory = state.tab === 'theory';
    sim.hidden = onTheory;
    thy.hidden = !onTheory;
    theory.setVisible(onTheory);
    tabs.sync();
  };

  detach = subscribe((d, s) => {
    applyTab();
    // The simulation panels still update while hidden: they are cheap, and it
    // keeps the two tabs from ever disagreeing about the same instant.
    sky.update(d, s);
    globe.update(d, s);
    log.update(d, s);
    workup.update(d, s);
    timeline.update(d, s);
    theory.update(d, s);
    rail.update(d, s);
  });

  render();
}

mount();
set(applyScenario(byId(state.scenario)));

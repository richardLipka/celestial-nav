// The lesson bar: a strip under the masthead that appears when a lesson is
// running. It narrates, it sets the controls for you, and it marks the panel
// worth looking at -- and then it gets out of the way, because everything it
// touches is the same state you can reach with the sliders.

import { lessons, lessonById } from '../lessons.js';
import { t, pick } from '../i18n.js';
import { richText } from '../ui/text.js';

const h = (tag, cls, txt) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (txt !== undefined) n.textContent = txt;
  return n;
};

/** What a step does to the application when you arrive at it. */
export function applyStep(store, lessonId, index) {
  const lesson = lessonById(lessonId);
  if (!lesson) return;
  const step = lesson.steps[index];
  if (!step) return;
  const patch = { ...(step.state || {}) };
  if (step.tab) patch.tab = step.tab;
  if (step.view) patch.skyView = step.view;
  // A scenario in a step means "set that scenario up", not "set that field".
  if (patch.scenario) {
    store.set({ ...store.applyScenarioPatch(patch.scenario), ...patch });
  } else {
    store.set(patch);
  }
  // After the state has settled, so that the step can see the day it just set.
  if (step.act) step.act(store);
}

export function createLessonBar(store) {
  const { state, set } = store;
  const node = h('div', 'lesson');

  const head = h('div', 'lesson-head');
  const title = h('span', 'lesson-title');
  const count = h('span', 'lesson-count');
  const quit = h('button', 'lesson-quit', t('lesson.leave'));
  quit.type = 'button';
  quit.addEventListener('click', () => set({ lesson: null, lessonStep: 0 }));
  head.append(title, count, quit);

  const body = h('p', 'lesson-text');

  const nav = h('div', 'lesson-nav');
  const back = h('button', 'lesson-btn', t('lesson.back'));
  back.type = 'button';
  back.addEventListener('click', () => go(-1));
  const next = h('button', 'lesson-btn primary', t('lesson.next'));
  next.type = 'button';
  next.addEventListener('click', () => go(1));
  const dots = h('div', 'lesson-dots');
  nav.append(back, dots, next);

  node.append(head, body, nav);

  function go(delta) {
    const lesson = lessonById(state.lesson);
    if (!lesson) return;
    const i = state.lessonStep + delta;
    if (i < 0) return;
    if (i >= lesson.steps.length) {
      set({ lesson: null, lessonStep: 0 });
      return;
    }
    set({ lessonStep: i });
    applyStep(store, lesson.id, i);
  }

  return {
    node,
    update(d, s) {
      const lesson = lessonById(s.lesson);
      node.hidden = !lesson;
      if (!lesson) return;

      const i = Math.min(s.lessonStep, lesson.steps.length - 1);
      title.textContent = pick(lesson.title);
      count.textContent = t('lesson.count', { n: i + 1, of: lesson.steps.length });
      body.innerHTML = richText(pick(lesson.steps[i].text));
      back.disabled = i === 0;
      next.textContent = i === lesson.steps.length - 1 ? t('lesson.finish') : t('lesson.next');

      dots.replaceChildren();
      lesson.steps.forEach((_, k) => {
        const dot = h('span', `lesson-dot ${k === i ? 'on' : ''}`);
        dot.title = t('lesson.count', { n: k + 1, of: lesson.steps.length });
        dots.append(dot);
      });
    },
  };
}

/** The picker that lives at the top of the rail. */
export function createLessonPicker(store) {
  const { set } = store;
  const box = h('div', 'rail-group');
  box.append(h('div', 'rail-label', t('lesson.heading')));

  const sel = document.createElement('select');
  sel.id = 'lesson';
  sel.className = 'rail-select';
  sel.setAttribute('aria-label', t('lesson.heading'));
  const none = document.createElement('option');
  none.value = '';
  none.textContent = t('lesson.none');
  sel.append(none);
  for (const l of lessons) {
    const o = document.createElement('option');
    o.value = l.id;
    o.textContent = pick(l.title);
    sel.append(o);
  }
  sel.addEventListener('change', () => {
    if (!sel.value) {
      set({ lesson: null, lessonStep: 0 });
      return;
    }
    set({ lesson: sel.value, lessonStep: 0 });
    applyStep(store, sel.value, 0);
  });

  const blurb = h('p', 'rail-note');
  box.append(sel, blurb);

  return {
    node: box,
    update(d, s) {
      if (sel.value !== (s.lesson || '')) sel.value = s.lesson || '';
      const lesson = lessonById(s.lesson);
      blurb.textContent = lesson ? pick(lesson.blurb) : t('lesson.pick');
    },
  };
}

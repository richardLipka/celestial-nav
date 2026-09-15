// The theory tab. Static equations are typeset once; the substituted ones are
// re-typeset when the state moves, but only while the tab is actually on
// screen, and never more than once per animation frame.

import { theory } from '../theory.js';
import { t, pick, getLang } from '../i18n.js';
import { createTriangle3D, createTriangleFlat, createHourAngle } from './theoryfig.js';
import { createMeridian } from './meridian.js';

const h = (tag, cls, txt) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (txt !== undefined) n.textContent = txt;
  return n;
};

// MathJax arrives asynchronously from a CDN; if it never does, the page still
// reads, it just shows raw TeX. Everything here degrades rather than breaks.
function typeset(nodes) {
  const MJ = window.MathJax;
  if (!MJ || !MJ.typesetPromise) return Promise.resolve();
  return MJ.startup?.promise
    ? MJ.startup.promise.then(() => MJ.typesetPromise(nodes))
    : MJ.typesetPromise(nodes);
}

export function createTheory(onRotate) {
  const node = h('div', 'theory');

  const figures = {
    pzx3d: createTriangle3D(onRotate),
    pzxFlat: createTriangleFlat(),
    meridian: createMeridian(),
    hourAngle: createHourAngle(),
  };

  const subs = []; // { el, fn, empty }

  for (const section of theory) {
    const sec = h('section', `th-sec ${section.kind ? `th-${section.kind}` : ''}`);
    const head = h('div', 'th-head');
    head.append(h('span', 'th-tag', pick(section.tag)), h('h2', null, pick(section.title)));
    sec.append(head);

    const body = h('div', 'th-body');
    for (const b of section.blocks) {
      if (b.k === 'p') {
        const p = h('p', 'th-p');
        p.innerHTML = escapeButKeepMath(pick(b.text));
        body.append(p);
      } else if (b.k === 'math') {
        const m = h('div', `th-math ${b.big ? 'big' : ''}`);
        m.textContent = `\\[${b.tex}\\]`;
        body.append(m);
      } else if (b.k === 'sub') {
        const wrap = h('div', 'th-sub');
        wrap.append(h('span', 'th-sub-tag', t('theory.withYourFigures')));
        const m = h('div', 'th-sub-math');
        wrap.append(m);
        subs.push({ el: m, wrap, fn: b.fn, empty: b.empty });
        body.append(wrap);
      } else if (b.k === 'note') {
        const n = h('div', `th-note ${b.kind || ''}`);
        n.innerHTML = escapeButKeepMath(pick(b.text));
        body.append(n);
      } else if (b.k === 'fig') {
        const fig = figures[b.id];
        if (fig) {
          const f = h('figure', 'th-fig');
          f.append(fig.node);
          body.append(f);
        }
      }
    }
    sec.append(body);
    node.append(sec);
  }

  typeset([node]);

  let queued = false;
  let visible = true;
  let lastKey = null;

  return {
    node,
    setVisible(v) {
      visible = v;
      if (v) lastKey = null; // force a re-typeset on the way back in
    },
    update(d, s) {
      for (const f of Object.values(figures)) f.update(d, s);

      // Only redo the maths when the numbers have actually moved.
      const key = `${getLang()}|${d.now.getTime()}|${s.lat}|${s.lon}|${s.clockErrorSec}|${d.logResult.stage}|${d.logResult.count}`;
      if (!visible || key === lastKey) return;
      lastKey = key;

      for (const sub of subs) {
        const texStr = sub.fn(d, s);
        if (texStr === null || texStr === undefined) {
          sub.el.textContent = pick(sub.empty || { en: '', cs: '' });
          sub.wrap.classList.add('waiting');
        } else {
          sub.el.textContent = `\\[${texStr}\\]`;
          sub.wrap.classList.remove('waiting');
        }
      }

      // Coalesced with a timer rather than an animation frame: a frame never
      // arrives while the page is not being rendered, which would latch this
      // flag on and leave every later update untypeset.
      if (queued) return;
      queued = true;
      setTimeout(() => {
        queued = false;
        typeset(subs.map((x) => x.el));
      }, 0);
    },
  };
}

/** Escape the text but leave \( ... \) alone so MathJax can find it. */
function escapeButKeepMath(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// The theory tab. Static equations are typeset once; the substituted ones are
// re-typeset when the state moves, but only while the tab is actually on
// screen, and never more than once per animation frame.
//
// The tab is two columns: the argument on the left, and on the right a stage
// that never leaves the screen -- the sphere the whole subject lives on, with
// the live figures under it. Scrolling the argument moves the sphere with it:
// each section names the angle it is about, and the sphere draws that one.
// Clicking any angle, in a figure or on a chip, pins it there instead.

import { theory } from '../theory.js';
import { t, pick, getLang } from '../i18n.js';
import { createTriangle3D, createTriangleFlat, createHourAngle } from './theoryfig.js';
import { createDegeneracy } from './degeneracy.js';
import { createMeridian } from './meridian.js';
import {
  createTheorySphere, wantedPoints, FOCUS_KEYS, FOCUS_SYMBOL, SECTION_VIEW,
} from './theorysphere.js';
import { meanDirection } from './sphere.js';
import { angularDistance } from '../core/fix.js';
import { fmtAngle, fmtBearing } from '../core/angles.js';
import { fLat } from '../ui/format.js';
import { richText } from '../ui/text.js';

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

/** The live value behind each chip, in the same words the rest of the app uses. */
function chipValue(key, d, s) {
  const dec = d.sky.solar.dec;
  switch (key) {
    case 'phi': return fLat(s.lat);
    case 'dec': return `${fmtAngle(Math.abs(dec))} ${t(dec < 0 ? 'suffix.S' : 'suffix.N')}`;
    case 'alt': return fmtAngle(d.sky.H);
    case 'zen': return fmtAngle(90 - d.sky.H);
    case 'lha': return fmtAngle(Math.abs(d.sky.lha));
    case 'az': return fmtBearing(d.sky.Az);
    default: return '';
  }
}

export function createTheory(onRotate, onCentre) {
  const node = h('div', 'theory');
  const main = h('div', 'th-main');
  const stage = h('aside', 'th-stage');

  const figures = {
    pzx3d: createTriangle3D(onRotate),
    pzxFlat: createTriangleFlat(),
    meridian: createMeridian(),
    hourAngle: createHourAngle(),
    degeneracy: createDegeneracy(),
  };
  const sphere = createTheorySphere(onRotate);

  // --- the stage ----------------------------------------------------------
  const head = h('div', 'th-stage-hd');
  head.append(h('h2', null, t('th.stage.title')), h('span', 'th-stage-sub', t('th.stage.sub')));

  const chipBox = h('div', 'th-chips');
  chipBox.setAttribute('role', 'group');
  chipBox.setAttribute('aria-label', t('th.stage.pick'));
  const chips = FOCUS_KEYS.map((key) => {
    const b = h('button', `th-chip ${key}`);
    b.type = 'button';
    b.dataset.focus = key;
    b.setAttribute('aria-pressed', 'false');
    const value = h('i', 'th-chip-val');
    b.append(
      h('b', null, FOCUS_SYMBOL[key]),
      h('span', 'th-chip-name', t(`th.ang.${key}`)),
      value,
    );
    chipBox.append(b);
    return { key, button: b, value };
  });

  stage.append(head, sphere.node, chipBox, h('p', 'th-stage-hint', t('th.stage.hint')));

  // --- the argument -------------------------------------------------------
  const subs = []; // { el, fn, empty }
  const sections = []; // { id, el }, in the order they are read

  for (const section of theory) {
    const sec = h('section', `th-sec ${section.kind ? `th-${section.kind}` : ''}`);
    sec.dataset.section = section.id;
    const head2 = h('div', 'th-head');
    head2.append(h('span', 'th-tag', pick(section.tag)), h('h2', null, pick(section.title)));
    sec.append(head2);

    const body = h('div', 'th-body');
    for (const b of section.blocks) {
      if (b.k === 'p') {
        const p = h('p', 'th-p');
        p.innerHTML = richText(pick(b.text));
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
        n.innerHTML = richText(pick(b.text));
        body.append(n);
      } else if (b.k === 'fig') {
        const fig = figures[b.id];
        if (fig) {
          // The sphere in the triangle section is the same drawing the stage
          // carries, so it is hidden wherever the stage is on screen anyway
          // and kept for the narrow layout, where the stage is not sticky.
          const f = h('figure', `th-fig ${b.wide ? 'wide' : ''} ${b.id === 'pzx3d' ? 'on-stage' : ''}`);
          f.append(fig.node);
          body.append(f);
        }
      }
    }
    sec.append(body);
    main.append(sec);
    sections.push({ id: section.id, el: sec });
  }

  node.append(main, stage);
  typeset([node]);

  // --- what the sphere is showing -----------------------------------------
  let pinned = null;                      // the angle the reader clicked
  let reading = sections[0]?.id ?? null;  // the section they are in
  let last = null;                        // the state the sphere was last drawn from

  const view = () => {
    const auto = SECTION_VIEW[reading] || {};
    return { triangle: !!auto.triangle || !!pinned, focus: pinned ?? auto.focus ?? null };
  };

  const paint = () => {
    if (!last) return;
    const v = view();
    sphere.draw(last.d, last.s, v);
    for (const c of chips) {
      c.value.textContent = chipValue(c.key, last.d, last.s);
      c.button.setAttribute('aria-pressed', String(c.key === v.focus));
      c.button.classList.toggle('on', c.key === v.focus);
    }
  };

  // Half of a sphere is always facing away, so being asked to show an angle is
  // not the same as showing it. Turn only when something wanted is hidden, and
  // turn to the mean direction of everything wanted, which brings the lot into
  // view at once. Called from a timer so it never sets state inside a render.
  const reveal = () => {
    if (!last || !onCentre) return;
    const v = view();
    const want = wantedPoints(v, {
      lat: last.s.lat, H: last.d.sky.H, az: last.d.sky.Az,
      dec: last.d.sky.solar.dec, lha: last.d.sky.lha,
    });
    if (!want.length) return;
    const centre = last.s.theoryView;
    if (want.every((p) => angularDistance(centre, p) <= 82)) return;
    const m = meanDirection(want);
    if (m) onCentre(m.lat, m.lon);
  };
  const queueReveal = () => setTimeout(reveal, 0);

  // One handler for every angle on the tab: the chips are buttons and the
  // figures mark their arcs with the same attribute, so both arrive here.
  // Clicking the angle already shown lets it go back to following the text.
  node.addEventListener('click', (e) => {
    const hit = e.target.closest?.('[data-focus]');
    if (!hit || !node.contains(hit)) return;
    const key = hit.getAttribute('data-focus');
    if (!FOCUS_KEYS.includes(key)) return;
    pinned = pinned === key ? null : key;
    paint();
    queueReveal();
  });

  let queued = false;
  let visible = true;
  let lastKey = null;

  // The section being read drives the sphere: it is the last one whose heading
  // has climbed past a line a third of the way down the window.
  //
  // A scroll listener rather than an IntersectionObserver, for the same reason
  // the typesetting below uses a timer and not an animation frame. Both of
  // those are tied to the rendering loop, and a page that is not being drawn
  // never runs one -- so on a window sitting behind another the observer stays
  // silent and the sphere would follow nothing. Six rectangles per scroll is
  // not a cost worth optimising.
  const sectionInView = () => {
    const line = window.innerHeight * 0.3;
    let id = sections[0]?.id ?? null;
    for (const x of sections) {
      if (x.el.getBoundingClientRect().top > line) break;
      id = x.id;
    }
    return id;
  };
  const followScroll = () => {
    // A language switch rebuilds the whole UI, and a listener on `window`
    // would outlive its own DOM and go on drawing into a detached sphere --
    // and setting state the live one would have to fight.
    if (!node.isConnected) {
      window.removeEventListener('scroll', followScroll);
      window.removeEventListener('resize', followScroll);
      return;
    }
    // While the tab is hidden every section measures zero and the last one
    // would win, which is exactly the wrong answer to come back to.
    if (!visible || !last) return;
    const id = sectionInView();
    if (!id || id === reading) return;
    reading = id;
    paint();
    queueReveal();
  };
  window.addEventListener('scroll', followScroll, { passive: true });
  window.addEventListener('resize', followScroll);

  return {
    node,
    setVisible(v) {
      visible = v;
      if (!v) return;
      lastKey = null; // force a re-typeset on the way back in
      setTimeout(followScroll, 0); // and pick the section up where it was left
    },
    update(d, s) {
      for (const f of Object.values(figures)) f.update(d, s);
      const first = !last;
      last = { d, s };
      paint();
      if (first) queueReveal(); // the stored view may be facing the wrong way

      // Only redo the maths when the numbers have actually moved.
      const key = `${getLang()}|${d.now.getTime()}|${s.lat}|${s.lon}|${s.clockErrorSec}|${s.clockRateSecPerDay}|${+s.departureDate}|${d.logResult.stage}|${d.logResult.count}`;
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

// The instrument, from behind it.
//
// The telescope field: sea and sky through the clear half of the horizon
// glass, and the sun brought down into it off the index mirror. Swing the arc
// until the sun appears, then work the drum until its lower limb sits exactly
// on the horizon. The number on the arc is then the sextant altitude Hs.
//
// This is where the reading error stops being a slider and becomes yours: the
// sight you log carries the difference between the angle you set and the angle
// that was actually there.

import { el, text, polygon, clear } from '../svg.js';
import { fmtAngle, fmtNumber } from '../core/angles.js';
import { t } from '../i18n.js';

const W = 424;
const H = 412;
const CX = 212;
const CY = 176;
const R = 150;

// How much sky the telescope shows from the centre of the field to its edge --
// a radius, not the whole height, which is why PX_PER_DEG divides by it rather
// than by half of it. Top to bottom the glass therefore shows 2.2 degrees. A
// real one shows a few; this is tighter so a tenth of a minute is a visible
// nudge on the drum.
const FIELD_DEG = 1.1;
const PX_PER_DEG = R / FIELD_DEG;
const SUN_RADIUS_DEG = 16.0 / 60; // semi-diameter

// The arc has to be swung to within this of the altitude before the reflected
// sun swims into the field at all -- which is exactly how you hunt for it.
const CATCH_DEG = FIELD_DEG * 0.92;

const ROLL_AMPLITUDE_DEG = 0.16;
const ROLL_PERIOD_MS = 7000;

const h = (tag, cls, txt) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (txt !== undefined) n.textContent = txt;
  return n;
};

export const rollOffsetDeg = (ms) =>
  ROLL_AMPLITUDE_DEG * Math.sin((2 * Math.PI * ms) / ROLL_PERIOD_MS);

export function createSextant(store) {
  const { state, set, setIn, addSight } = store;
  const node = h('div', 'sx');
  const refs = {};
  let last = null; // the most recent { d, s }, so the roll loop can redraw
  let live = false;
  let raf = 0;

  const svg = el('svg', {
    viewBox: `0 0 ${W} ${H}`,
    class: 'fig-svg sx-field',
    role: 'img',
    'aria-label': t('aria.sextant'),
  });

  // --- the drum: drag in the field for the fine adjustment ---------------
  let drag = null;
  svg.addEventListener('pointerdown', (e) => {
    drag = e.clientY;
    svg.setPointerCapture(e.pointerId);
  });
  svg.addEventListener('pointermove', (e) => {
    if (drag === null) return;
    const scale = (svg.getBoundingClientRect().height || H) / H;
    // Down-drag raises the reading, which is how the image comes down.
    const delta = ((e.clientY - drag) / scale / PX_PER_DEG) * 0.5;
    drag = e.clientY;
    setIn('sextant', { armDeg: clampArm(state.sextant.armDeg + delta) });
  });
  const stop = () => (drag = null);
  svg.addEventListener('pointerup', stop);
  svg.addEventListener('pointercancel', stop);

  // --- the arc: coarse -----------------------------------------------------
  const bar = h('div', 'sx-bar');
  refs.arc = document.createElement('input');
  refs.arc.type = 'range';
  refs.arc.id = 'sx-arc';
  refs.arc.min = '0';
  refs.arc.max = '90';
  refs.arc.step = '0.1';
  refs.arc.className = 'sx-arc';
  refs.arc.addEventListener('input', () =>
    setIn('sextant', { armDeg: clampArm(Number(refs.arc.value)) }),
  );

  const arcLabel = h('label', 'rail-sublabel', t('sx.arc'));
  arcLabel.htmlFor = refs.arc.id;
  refs.reading = h('output', 'sx-reading');

  const head = h('div', 'sx-head');
  head.append(arcLabel, refs.reading);
  bar.append(head, refs.arc);

  const actions = h('div', 'sx-actions');
  refs.take = h('button', 'log-take sx-take', t('sx.take'));
  refs.take.type = 'button';
  refs.take.addEventListener('click', () => {
    if (!last) return;
    // Whatever is off between the angle set and the angle that was there is
    // the observer's error, and it goes into the log as their own. It is only
    // reported *after* the sight: shown live, it could simply be zeroed, and
    // there would be nothing left to learn.
    const errMin = (state.sextant.armDeg - last.d.sight.Hs) * 60;
    if (addSight(last.d.now, errMin)) {
      refs.verdict.textContent = t(
        Math.abs(errMin) < 1 ? 'sx.logged.good' : 'sx.logged',
        { n: fmtNumber(Math.abs(errMin), 1), dir: t(errMin > 0 ? 'sx.high' : 'sx.low') },
      );
      refs.verdict.className = `sx-verdict ${Math.abs(errMin) < 1 ? 'good' : ''}`;
    }
  });

  const rollBox = h('label', 'rail-check');
  refs.roll = document.createElement('input');
  refs.roll.type = 'checkbox';
  refs.roll.id = 'sx-roll';
  refs.roll.addEventListener('change', () => {
    setIn('sextant', { roll: refs.roll.checked });
    pump();
  });
  rollBox.append(refs.roll, h('span', null, t('sx.roll')));
  actions.append(refs.take, rollBox);

  refs.hint = h('p', 'sx-hint');
  refs.verdict = h('p', 'sx-verdict');

  node.append(svg, bar, actions, refs.hint, refs.verdict);

  function pump() {
    cancelAnimationFrame(raf);
    if (live && state.sextant.roll && last) {
      raf = requestAnimationFrame(function step() {
        draw(svg, refs, last.d, last.s, store);
        raf = requestAnimationFrame(step);
      });
    }
  }

  return {
    node,
    setLive(v) {
      live = v;
      pump();
    },
    update(d, s) {
      last = { d, s };
      if (document.activeElement !== refs.arc) refs.arc.value = String(s.sextant.armDeg);
      refs.roll.checked = s.sextant.roll;
      draw(svg, refs, d, s, store);
      pump();
    },
  };
}

const clampArm = (v) => Math.max(0, Math.min(90, v));

function draw(svg, refs, d, s, store) {
  clear(svg);

  const arm = s.sextant.armDeg;
  const target = d.sight.Hs; // the reading a perfect observer would get
  const roll = s.sextant.roll ? rollOffsetDeg(performance.now()) : 0;
  const sunDown = d.sky.H <= 0;

  // Where the reflected sun sits, in degrees above the horizon line.
  const offsetDeg = target - arm + roll;
  const inField = !sunDown && Math.abs(offsetDeg) < CATCH_DEG;

  const clip = el('clipPath', { id: 'sx-clip' }, [
    el('circle', { cx: CX, cy: CY, r: R }),
  ]);
  svg.append(el('defs', {}, [clip]));
  const field = el('g', { 'clip-path': 'url(#sx-clip)' });

  const horizonY = CY - roll * PX_PER_DEG;
  field.append(el('rect', { x: CX - R, y: CY - R, width: 2 * R, height: 2 * R, class: 'sx-sky' }));
  field.append(el('rect', {
    x: CX - R, y: horizonY, width: 2 * R, height: CY + R - horizonY, class: 'sx-sea',
  }));
  field.append(el('line', {
    x1: CX - R, y1: horizonY, x2: CX + R, y2: horizonY, class: 'sx-horizon',
  }));

  if (inField) {
    // The lower limb is what you bring down, so the disc sits a semi-diameter
    // above the offset: at offsetDeg = 0 the limb is exactly on the horizon.
    const limbY = horizonY - offsetDeg * PX_PER_DEG;
    const cy = limbY - SUN_RADIUS_DEG * PX_PER_DEG;
    field.append(el('circle', {
      cx: CX, cy, r: SUN_RADIUS_DEG * PX_PER_DEG, class: 'sx-sun',
    }));
  }
  svg.append(field);

  // The silvered half of the horizon glass: the reflected image only reaches
  // the eye through it.
  svg.append(el('line', { x1: CX, y1: CY - R, x2: CX, y2: CY + R, class: 'sx-split' }));
  svg.append(el('circle', { cx: CX, cy: CY, r: R, class: 'sx-rim' }));
  svg.append(text(CX - 8, CY - R + 16, t('sx.reflected'), { class: 'lbl tiny muted', 'text-anchor': 'end' }));
  svg.append(text(CX + 8, CY - R + 16, t('sx.direct'), { class: 'lbl tiny muted' }));

  // --- readout ------------------------------------------------------------
  refs.reading.textContent = fmtAngle(arm);
  refs.take.disabled = sunDown;

  if (sunDown) {
    refs.hint.textContent = t('sx.sunDown');
    refs.hint.className = 'sx-hint';
  } else if (!inField) {
    refs.hint.textContent = t('sx.swing');
    refs.hint.className = 'sx-hint';
  } else if (Math.abs(offsetDeg) * 60 < 0.6) {
    refs.hint.textContent = t('sx.onTheLimb');
    refs.hint.className = 'sx-hint good';
  } else {
    refs.hint.textContent = t(offsetDeg > 0 ? 'sx.tooLow' : 'sx.tooHigh');
    refs.hint.className = 'sx-hint';
  }

}

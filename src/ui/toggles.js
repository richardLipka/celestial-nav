// The switches that belong to a drawing, put where the drawing is.
//
// They lived in the rail, three panels away from the globe they changed,
// which for a setting is much the same as living nowhere. These are icons in
// the drawing's own header instead: eighteen units square, hand-drawn like
// every other figure in this program, and stroked and filled in
// `currentColor` so that the button's own state is what colours them.
//
// The row knows nothing about the store. It is handed an `onToggle` and is
// read from `state.show` by whoever owns it, which keeps it a view like any
// other.

import { el } from '../svg.js';
import { t } from '../i18n.js';

const line = (d) => el('path', {
  d, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.3, 'stroke-linejoin': 'round',
});
// Filled, and outlined in the same colour with a round join: at seventeen
// pixels a polygon's corners read as crystal rather than coastline.
const solid = (d) => el('path', {
  d, fill: 'currentColor', stroke: 'currentColor', 'stroke-width': 0.9, 'stroke-linejoin': 'round',
});
const ring = (r, extra = {}) => el('circle', {
  cx: 9, cy: 9, r, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.3, ...extra,
});
const dot = (cx, cy, r = 1.5) => el('circle', { cx, cy, r, fill: 'currentColor' });

/**
 * One icon each. They are drawings of what the switch draws, not symbols
 * standing for it: the map icon is a globe with land on it, the frame icon is
 * a globe with an equator, a meridian and two poles, and the night icon is a
 * globe with one side of it dark.
 */
const ICON = {
  map: () => [
    ring(7),
    solid('M3.2 8 5 5.6 8 5.2 10 6.8 8.6 9 5.4 9.6Z'),
    solid('M9.6 10.4 12.4 9.6 14.6 11 13 13.4 10.6 13Z'),
  ],
  frame: () => [
    ring(7),
    el('ellipse', {
      cx: 9, cy: 9, rx: 3.1, ry: 7, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.1,
    }),
    line('M2 9H16'),
    dot(9, 2, 1.2),
    dot(9, 16, 1.2),
  ],
  night: () => [ring(7), solid('M9 2A7 7 0 0 1 9 16Z')],
  cop: () => [ring(5.8, { 'stroke-dasharray': '2.6 2' }), dot(9, 9)],
  lop: () => [line('M2.6 13.2 15.4 4.8'), dot(9, 9)],
  cross: () => [line('M2.5 12 15.5 6'), line('M3.5 5.5 14.5 12.5'), dot(9, 9)],
};

/** The switches a picture of themselves exists for. */
export const ICON_KEYS = Object.keys(ICON);

/**
 * A row of icon switches over one drawing.
 *
 * `keys` name fields of `state.show`; the label each already has in the
 * dictionary becomes the button's name and its tooltip, so a reader who
 * cannot place the picture can hover or let a screen reader read it.
 */
export function createToggles(keys, onToggle) {
  const node = document.createElement('div');
  node.className = 'sw-row';
  node.setAttribute('role', 'group');
  node.setAttribute('aria-label', t('rail.overlays'));

  // A click has to send the opposite of what is set *now*, and the only
  // honest source of that is the state the row was last drawn from -- the row
  // does not reach into the store to ask.
  let last = null;

  const buttons = keys.map((key) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `sw sw-${key}`;
    const label = t(`show.${key}`);
    b.title = label;
    b.setAttribute('aria-label', label);
    b.setAttribute('aria-pressed', 'false');
    const svg = el('svg', { viewBox: '0 0 18 18', 'aria-hidden': 'true', focusable: 'false' });
    for (const part of ICON[key]()) svg.append(part);
    b.append(svg);
    b.addEventListener('click', () => onToggle(key, !(last && last.show[key])));
    node.append(b);
    return { key, b };
  });

  return {
    node,
    update(s) {
      last = s;
      for (const { key, b } of buttons) {
        const on = !!s.show[key];
        b.setAttribute('aria-pressed', String(on));
        b.classList.toggle('on', on);
      }
    },
  };
}

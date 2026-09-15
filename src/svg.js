// A very small SVG helper. Every figure in this application is hand-drawn SVG
// rather than a charting library, because what we need are angle arcs, labels
// that dodge each other, and strokes that read in both themes -- and nothing
// off the shelf draws an almucantar.

export const NS = 'http://www.w3.org/2000/svg';

export function el(tag, attrs = {}, children = []) {
  const n = document.createElementNS(NS, tag);
  for (const k in attrs) {
    const v = attrs[k];
    if (v !== null && v !== undefined && v !== false) n.setAttribute(k, v);
  }
  for (const c of [].concat(children)) if (c) n.append(c);
  return n;
}

export const g = (attrs = {}, children = []) => el('g', attrs, children);

export function text(x, y, s, attrs = {}) {
  const t = el('text', { x: r2(x), y: r2(y), ...attrs });
  t.textContent = s;
  return t;
}

const r2 = (n) => Math.round(n * 100) / 100;

/** points: array of [x, y] or {x, y}. */
export function polyline(points, attrs = {}) {
  if (!points || points.length < 2) return null;
  const d = points
    .map((p, i) => {
      const x = r2(p.x ?? p[0]);
      const y = r2(p.y ?? p[1]);
      return `${i ? 'L' : 'M'}${x} ${y}`;
    })
    .join(' ');
  return el('path', { d, fill: 'none', ...attrs });
}

export const polygon = (points, attrs = {}) => {
  const p = polyline(points, attrs);
  if (p) p.setAttribute('d', `${p.getAttribute('d')} Z`);
  return p;
};

/** Point on a circle, with angles measured CCW from east in a y-down world. */
export const onCircle = (cx, cy, r, deg) => [
  cx + r * Math.cos((deg * Math.PI) / 180),
  cy - r * Math.sin((deg * Math.PI) / 180),
];

/** Arc from a1 to a2, CCW-positive. Used for every angle annotation. */
export function arc(cx, cy, r, a1, a2, attrs = {}) {
  const [x1, y1] = onCircle(cx, cy, r, a1);
  const [x2, y2] = onCircle(cx, cy, r, a2);
  const large = Math.abs(a2 - a1) > 180 ? 1 : 0;
  const sweep = a2 > a1 ? 0 : 1; // CCW in maths is clockwise once y points down
  return el('path', {
    d: `M${r2(x1)} ${r2(y1)} A${r2(r)} ${r2(r)} 0 ${large} ${sweep} ${r2(x2)} ${r2(y2)}`,
    fill: 'none',
    ...attrs,
  });
}

/** An angle arc with its symbol placed on the bisector. */
export function angleMark(cx, cy, r, a1, a2, label, color, labelR = r + 13) {
  const mid = (a1 + a2) / 2;
  const [lx, ly] = onCircle(cx, cy, labelR, mid);
  return g({}, [
    arc(cx, cy, r, a1, a2, { stroke: color, 'stroke-width': 2.2 }),
    text(lx, ly + 5, label, {
      class: 'gk lbl',
      fill: color,
      'text-anchor': 'middle',
    }),
  ]);
}

export function arrowhead(x, y, deg, size = 6, attrs = {}) {
  const a = (deg * Math.PI) / 180;
  const back = a + Math.PI;
  const p = (off) => [
    x + size * Math.cos(back + off),
    y - size * Math.sin(back + off),
  ];
  const [ax, ay] = p(0.42);
  const [bx, by] = p(-0.42);
  return el('path', {
    d: `M${r2(x)} ${r2(y)} L${r2(ax)} ${r2(ay)} L${r2(bx)} ${r2(by)} Z`,
    ...attrs,
  });
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

/** Split a series into consecutive runs that satisfy a predicate. */
export function runs(items, ok) {
  const out = [];
  let cur = null;
  for (const it of items) {
    if (ok(it)) {
      if (!cur) out.push((cur = []));
      cur.push(it);
    } else cur = null;
  }
  return out;
}

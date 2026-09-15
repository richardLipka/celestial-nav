# CLAUDE.md

An interactive, bilingual (Czech/English) demonstration of why latitude falls
out of a noon sight and longitude cannot be had without a clock. Two tabs:
**Theory** (derivations, MathJax, live figures) and **Simulation** (you take
and log sights yourself, and they feed the equations).

## Commands

```bash
npm start        # static server on http://localhost:5173
npm test         # vitest, 74 tests
npm run test:watch
```

No build step. `index.html` loads ES modules straight from `src/`. The only
runtime dependency is MathJax from a CDN, for the theory tab; `vitest` and
`astronomy-engine` are dev-only, and `astronomy-engine` exists purely as an
independent oracle in the test suite — never import it from `src/`.

## Architecture

One direction of flow, no exceptions:

```
core/*.js  ->  state/store.js  ->  views/*.js
 pure fns      one derive step     pure fns of the derived state
```

`store.js` holds one `state` object. `set()` mutates it and calls `render()`,
which runs `derive(state)` once and hands the result to every subscriber. A
view is a `create*()` returning `{ node, update(derived, state) }`. Views never
reach back into the store except through the action functions it exports
(`addSight`, `matchSight`, `removeSight`, `clearSights`).

`core/` must stay free of DOM and of any notion of language. Formatting that
needs a language lives in `ui/format.js`.

## The simulation, and its one hard rule

`core/sights.js` is split in half and the split is the whole point:

- **`observe(t, truth, opt, clockErrorSec, jitterMin)`** knows where the ship
  actually is. It returns only what an instrument could show: a chronometer
  reading, a sextant altitude, a bearing.
- **`reduceLog(entries, opts)`** sees the log and the almanac and *nothing
  else*, and has to work the position out of them.

**Nothing in `reduceLog` may look at the true position.** If it ever does, the
demonstration stops being a demonstration. The same applies to anything built
on top of it.

### How a sight becomes a position

The navigator scrubs the timeline, clicks **Take a sight**, and the store
records only `{ id, t, jitterMin }` — the *instant they chose to observe*.
Everything else (Hs, Ho, azimuth) is recomputed from that instant on every
render, so moving the chronometer-error or eye-height sliders updates the whole
log live. Changing date, latitude or longitude clears the log, because a new
day or a new place makes the old one meaningless (`set()` handles this).

The reduction then produces two things that are deliberately compared on
screen:

| | how | quality |
|---|---|---|
| **latitude** | parabola through the three highest sights, `φ = δ ± z` | robust |
| **longitude, naive** | assume the peak of that parabola was noon | bad |
| **longitude, proper** | equal altitudes, midpoint minus the correction | good |

### Reading error is load-bearing

Each sight carries `jitterMin`, a reading error of a few tenths of an
arcminute, drawn once when the sight is taken and kept with it. Do not remove
it to "clean up" the numbers: with perfect readings a parabola finds the vertex
of a flat curve exactly and the entire point of the noon sight disappears. The
rail has a toggle; the default is on.

### Observed vs interpolated crossings

Equal altitudes needs the afternoon instant at which the sun returns to a
morning altitude. Either:

- the log has a sight *at* the crossing — the **watch it down** button, which
  runs `matchAltitudeTime()`, i.e. clamp the sextant and wait. `pair.observed`
  is true. This is the real historical method, not a shortcut.
- or it must be interpolated between two logged sights, and the gap between
  them sets the accuracy — an hour of gap costs the best part of a minute of
  time, which is eight miles of longitude at 45°N.

`bestPair()` prefers an observed crossing over an interpolated one, and the
widest span among equals. The UI labels which kind it used.

### The chronometer has a rate, not an error

`state.clockErrorSec` is the error **on the day it sailed**; `clockRateSecPerDay`
is the part of its rate nobody knew about; `departureDate` is when it was last
rated. The store derives `errorAt(instant)` from `chronometerError()` and uses
it **per instant** — each logged sight carries the error the watch had at that
sight. Read `d.clockErrorSec` (effective, now), never `s.clockErrorSec`
(departure), in any view.

## Conventions

- **North-positive latitude, east-positive longitude, everywhere in `core/`.**
  Conversion to N/S/E/W (or `s.š./j.š./v.d./z.d.`) happens only in formatters.
- **Hour angles wrap to `(−180°, +180°]`**, so culmination is a sign change
  rather than a discontinuity and `|LHA|` is "how far from noon".
- **`Hs` / `Ha` / `Ho` are three separate values**, never one mutable number.
  Sextant altitude → after index error and dip → after refraction, SD and
  parallax. Collapsing them is how the corrections become invisible.
- Degrees in every public signature; radians never escape `angles.js`.
- `angles.js` keeps the decimal separator as module state (`.` or `,`). It
  affects **formatting only** — no arithmetic anywhere reads it.

## Language

`src/i18n.js` holds one flat dictionary per language. Scenario and place names
live next to their own data in `scenarios.js` / `places.js` as `{ en, cs }`
pairs; use `pick()` for those and `t()` for everything else.

Changing language **rebuilds the entire UI** (`mount()` in `app.js`). State
lives in the store, so this is cheap and no label can drift out of sync. Don't
add per-label updaters.

`npm test` enforces that the two dictionaries have identical key sets, that no
string is blank, and that `{placeholders}` match across languages. A missing
translation fails the build rather than showing English inside a Czech panel.

Czech details that are easy to get wrong: decimal **comma**; compass rose
**S V J Z**; coordinates take **s.š./j.š.** and **v.d./z.d.**, never a bare
letter — Czech `S` means *north* and an English reader would take it for
*south*.

## Theory tab

`src/theory.js` is content-as-data: an array of sections of typed blocks
(`p`, `math`, `sub`, `note`, `fig`; a `fig` may set `wide: true`). `sub` blocks
are functions of the derived state returning a TeX string, or `null` to show
their `empty` prompt — that is how the equations fill with the navigator's own
figures.

- Static equations are typeset once at build; `sub` blocks are re-typeset on a
  **`setTimeout`, not `requestAnimationFrame`**. A frame never arrives while
  the page is not rendering, which would latch the debounce flag on and leave
  every later update as raw TeX.
- MathJax's default delimiters (`\(…\)`, `\[…\]`) are used deliberately. Do not
  override them in `index.html`.
- `tex()` converts a formatted angle to TeX. Remember that TeX escapes need
  **double** backslashes in JS source (`\\circ`, `\\,`). A single one silently
  becomes a literal character and the equation renders wrong rather than
  failing.

## Traps already hit

- `[hidden]` does not beat `display: grid`. `styles.css` has an explicit
  `[hidden] { display: none !important }` — without it both tabs render at once.
- Inverse interpolation in altitude near culmination is invalid: `dy/dx → 0`,
  so `x(y)` has infinite slope. `crossingTime()` is linear on the bracketing
  pair on purpose; a quadratic through samples that include the peak once
  produced a 2,491 nm fix.
- A matched afternoon sight does not read *exactly* the morning altitude — the
  observer's eye has error too. The pairing tolerance is 2′, sized to reading
  error rather than machine precision.
- Do not name a local variable `t` in a view: it shadows the imported
  translator and the TDZ makes earlier calls throw.
- A flex container with `align-items: flex-start` sizes children to their
  *content* on the cross axis. Once `.body` turns into a column at narrow
  widths that is the width, so one wide figure dragged the whole page sideways.
  It is `align-items: stretch` in the narrow media query for that reason.
- Zero belongs to no hemisphere. `fLat`/`fLon` suppress the suffix when the
  value rounds to zero, or the prime meridian reads `000° 00.0′ E`.
- A `sub` block in the theory tab must *multiply out* at the precision it
  displays. Rounding 42.67 days to 43 left `2.857 × 43 = 121.9` on screen.
- The dictionary-parity test cannot catch an untranslated **value**, only a
  missing key. Python's `str.replace` hits every occurrence, which is how the
  English `s/day` once landed in the Czech dictionary under the right key.

## Testing

`src/core/__tests__/` only — the core is what is worth pinning.

- `core.test.js` — solar position against `astronomy-engine` over 10 000 random
  sights (max Δ < 0.02°), equation-of-time extremes, dip and refraction,
  culmination round-trips, and the thesis itself as assertions.
- `sights.test.js` — the log: pairing, the equation of equal altitudes, the
  flat maximum with and without reading noise, and what a log actually yields.
- `i18n.test.js` — dictionary parity, placeholders, Czech conventions, places.

When changing anything in `core/`, run the suite before touching a view.

## Roadmap

[ROADMAP.md](ROADMAP.md) has what remains, in order. Phase 2 (chronometer
*rate* rather than a flat offset) is next and is small.

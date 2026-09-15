# CLAUDE.md

An interactive, bilingual (Czech/English) demonstration of why latitude falls
out of a noon sight and longitude cannot be had without a clock. Three tabs:
**Theory** (derivations, MathJax, live figures), **Simulation** (you take and
log sights yourself, through a sextant, and they feed the equations) and
**Voyage** (sail a passage and watch the two errors behave completely
differently). Four guided lessons walk a newcomer through all three.

## Commands

```bash
npm start        # static server on http://localhost:5173
npm test         # vitest, 115 tests
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

### The passage

`core/voyage.js` runs a day at a time and keeps three positions apart: `truth`,
`dr`, and the `estimate` the navigator writes down. The navigator resets to the
estimate at every noon, which is why a chronometer stops the error
accumulating and why, without one, only the longitude compounds.

Two things that are easy to undo by accident:

- **The daily course is laid off from the estimate, not from the truth and not
  from a fixed heading.** Hold the course fixed and the current becomes the
  deciding variable instead of the clock, which buries the whole lesson.
- **Rhumb lines, not great circles.** `rhumb()` is Mercator sailing; a ship
  holds one compass course. The chart is Mercator for the same reason, and x
  and y must share one scale or the angles lie.

The passage is memoised in the store on its inputs — it is twenty-odd noon
reductions and would otherwise re-run on every drag of the day scrubber.

## Guided lessons

`src/lessons.js` is content-as-data, like `theory.js`; `views/lessonbar.js`
renders it. A step is `{ state, tab, view, panel, act, text }`:

- `state` is patched straight into the store, so a lesson can only ever do what
  the reader could do with the controls. A `scenario` in a step means *set that
  scenario up*, not *set that field*.
- `panel` names one panel class to light. `app.js` toggles `.lit`.
- `act(store)` is for what a patch cannot express — filling the log, pinning a
  route. It runs *after* the patch, so it can see the day it just set.

Two rules, both learned the hard way:

- **A step must stand on its own.** The reader can walk past the step that
  asked them to take a sight. Any step that narrates the log or the work-up
  must guarantee its own content with `act`, or be marked `asks: true` to say
  it is requesting the sight rather than describing one. `lessons.test.js`
  walks every lesson and enforces this.
- **A sentence that quotes a number is an assertion, and needs a test.** Three
  shipped sentences were simply wrong (ROADMAP has the list). `lessons.test.js`
  now walks each lesson through the real store and checks the figures its text
  quotes.

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
- A caption beside a control must be a `<label for>`, not a `<span>`. Thirteen
  sliders once had visible names and no programmatic ones, so a screen reader
  announced every one of them as an unnamed slider. `labelled()` in `rail.js`
  and `field()` in `voyage.js` both wire it; anything appended outside them
  needs its own `aria-label`.
- Every switch must reach every tab. `useEoT` was hardcoded on inside
  `simulateVoyage`, so turning the almanac off changed the simulation and left
  the passage untouched.
- A displayed ratio must survive being less than one. `wu.noteRatio` read
  "the longitude error is {ratio} times the latitude error" and rounded; when
  equal altitudes did its job *well* the ratio fell below one and a success
  printed as "0 times". `verdict()` in `workup.js` is pure and tested for this.
- `LANGS` holds codes, not labels. Czech is `cs`, but the switch has to say
  **CZ** — `code.toUpperCase()` gave `CS`, which is not what a Czech reader
  looks for. `LANG_LABEL` keeps the two apart.
- Reading error is drawn with `Math.random()`, so any test comparing the two
  longitude methods on one run is flaky — equal altitudes loses outright now
  and then. Compare medians over tens of runs, which is the honest claim anyway.
- **A `min-width` on a grid item that spans every column sets the width of the
  column, and so of every panel in it.** `.tl-left` had `min-width: 280px`;
  with the timeline at `grid-column: 1 / -1` that put a ~340px floor under the
  whole page and scrolled it sideways on a small phone.
- A media query adds **no specificity**. A narrow-width override of a rule
  declared later in the file silently loses. The `.tabs-btn` padding override
  must stay below the base rule, and it is commented to that effect.
- `.topbar-text { min-width: 240px }` is load-bearing: it is what pushes the
  tabs onto their own line on a phone. Setting it to 0 to "fix" an overflow
  let the tabs sit alongside and broke the masthead to one word per line.
- SVG labels need real vertical separation, not four pixels. The gauge had `Az`
  at y=96 and its note at y=100; the note won and the azimuth was unreadable.
  When adding a row to a figure, grow the `viewBox` rather than squeezing.

## Testing

All of it lives in `src/core/__tests__/`. The core is what is worth pinning,
and the one exception — `lessons.test.js` — is there because a claim made in
prose is worth pinning too.

- `core.test.js` — solar position against `astronomy-engine` over 10 000 random
  sights (max Δ < 0.02°), equation-of-time extremes, dip and refraction,
  culmination round-trips, and the thesis itself as assertions.
- `sights.test.js` — the log: pairing, the equation of equal altitudes, the
  flat maximum with and without reading noise, and what a log actually yields.
- `i18n.test.js` — dictionary parity, placeholders, Czech conventions, places.
- `lessons.test.js` — walks every lesson through the real store and checks the
  application against what the step's own text says. The one suite that is
  allowed to import from `state/` and `views/`, because claims are what it
  tests; it imports only pure things (`applyStep`, `verdict`).
- `tex.test.js` — the TeX escaping trap, checked in the source *and* in the
  built strings.

When changing anything in `core/`, run the suite before touching a view.

## Roadmap

[ROADMAP.md](ROADMAP.md) has what remains. Phases 0 to 6 are done; Phase 7
(lunar distances) is the only item left, and it is a real piece of work.

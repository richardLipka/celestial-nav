# CLAUDE.md

An interactive, bilingual (Czech/English) demonstration of why latitude falls
out of a noon sight and longitude cannot be had without a clock. Four tabs:
**Theory** (derivations, MathJax, live figures), **Simulation** (you take and
log sights yourself, through a sextant, and they feed the equations),
**Voyage** (sail a passage and watch the two errors behave completely
differently) and **Lunars** (the other answer to the longitude, and why it
lost). Five guided lessons walk a newcomer through all four.

## Commands

```bash
npm start        # static server on http://localhost:5173
npm test         # vitest, 218 tests
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
  them sets the accuracy — an hour of gap costs about half a minute of time,
  which is five miles of longitude at 45°N, and the error grows as the *square*
  of the gap: two hours costs four times as much, not twice.

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
  quotes. It caught a fourth: an hour of clock error moves the noon latitude
  by one mile, and the lesson said a mile and a half.
- **A guide that names a control must name it exactly**, because the reader is
  hunting the screen for those words. Quote it in `“…”` (English) or `„…“`
  (Czech) and `lessons.test.js` checks the quoted string is a real dictionary
  value.
- **And it must not contradict the panel it is pointing at.** The noon lesson
  runs on the equinox preset, where the sun passes a few arcminutes *north* of
  the zenith and the work-up reads `φ = δ − z`; the step said "add them".
  Anything a step says about a sign has to be checked against the reduction
  that will be on screen beside it.
- The guides expect no navigation either, so the same introduce-before-use
  rule applies: the meridian, the declination, refraction, parallax and the
  lower limb are all named where a lesson first leans on them.

## Lunar distances

The moon moves its own width against the background in an hour, so the angle
between the moon and the sun is a function of absolute time and of nothing
else. That is a clock, and it is the only one a ship could have without
carrying one. `core/lunars.js` is the method; the tab is why it lost.

**The ratio the whole tab hangs on.** The moon closes on the sun at about
0.51 degrees an hour, so one arcminute of error in the cleared distance is two
minutes of Greenwich time and thirty sea miles of longitude. A noon sight
turns the same arcminute into one mile. Every other decision here follows from
that thirty-to-one, and `costOfError()` computes it from the live rate rather
than quoting the mean.

### Precision, and why it is different here

Nothing else in the program needs better than half an arcminute. This does.
Three things follow, and none of them may be quietly undone:

- **`core/moon.js`** is ELP-2000/82 truncated to Meeus's 60 + 60 terms. It is
  long because there is no short lunar theory; the tables *are* the file.
  Worst error over 1700–2060 is under 40 arcseconds in longitude, 8 in
  latitude, checked against `astronomy-engine` in `lunars.test.js`.
- **`solarPrecise()`** in `sun.js` exists beside `solar()`, which stays as the
  readable half-arcminute version everything else uses. The difference between
  them is the arithmetic a lunar costs and a noon sight does not, and the test
  asserts the ratio rather than just the accuracy.
- **Delta T.** The ephemeris runs on dynamical time, a sextant on solar time,
  and they are seventy seconds apart today. Seventy seconds of moon is forty
  arcseconds — a minute of Greenwich time. `time.js` has the Espenak–Meeus
  fits; `lunar()` converts, and it is the only place that does.

Nutation (`core/nutation.js`) goes on the moon *and* the sun or neither: an
angle between two bodies is unchanged by turning the frame they are measured
in, so applying it to one alone would invent an error rather than remove one.

### Clearing the distance

Refraction lifts both bodies toward the zenith; parallax drops the moon away
from it by a degree. Both act along the vertical circle, so neither changes the
**angle at the zenith** between the two bodies — and eliminating that common
angle between the apparent triangle and the true one is the whole method.
`clearDistance()` is exact; there is no small-angle assumption in it.

**Parallax has two formulas and they are not the same function.** Going down
from the geocentric altitude needs `parallaxFromGeocentric()`; coming back up
from what was observed needs `parallaxExact()`. They are exact inverses of each
other, and using either one in both directions leaks most of an arcminute —
which is half a minute of Greenwich time. The round-trip test exists precisely
to catch that: observe with no error at all, reduce, and the instant must come
back to within a second.

### What a lunar actually yields

Not "the time now" — each sight gives the Greenwich time of the instant it was
taken. What is constant across a log is the *watch's error*, so that is what
the store averages. A lunar does not replace the chronometer; it rates it.

And the simulation flatters it: the almanac that reduces the sight is the same
one that placed the moon, so the table's own error cancels exactly and never
appears. A real lunar carried it. The cost panel says so, in both languages.

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

### The stage, and the sphere on it

The tab is two columns: the argument, and a **stage** pinned to the top of the
right-hand column that never scrolls away. It holds the celestial sphere, six
chips carrying the live value of every angle, and nothing else. The rail is
pinned on this tab for the same reason — an equation full of live figures is
worth nothing if the figures are three screens up — and to fit one screen it
drops the groups the tab cannot express and picks up **the hour**, which every
other tab gets from the timeline under its panels. At local apparent noon the
triangle has no interior at all, so without that control the tab cannot show
its own subject.

What the sphere draws is one of:

- the **triangle**, when the section being read is about it (`SECTION_VIEW` in
  `views/theorysphere.js` maps section id → what to show), or
- **one angle**, named either by that map or by the reader clicking — a chip,
  or any angle in any figure, which carry `data-focus` and are caught by one
  delegated handler in `views/theory.js`. Clicking the angle already shown
  releases it back to following the text.

`views/sphere.js` holds the geometry both spheres share: the orthographic
projection with its back-face test, the tangent at a point, and the arc that
marks a spherical angle. **Angle marks are drawn on the sphere, never as a flat
arc round a projected vertex** — that is right only at the centre of the disc.
`focusSpec()` is pure and returns the arc *and* the label, so
`theorysphere.test.js` can measure every arc and check it is as long as its
own label says.

It holds the other projection too. The flat figure of the triangle is
**stereographic**, which is conformal: every angle on the page is the angle on
the sphere, exactly, and an angle mark *there* may be an ordinary flat arc for
that reason and no other. What it costs is the scale, so each side carries its
length in writing and the ratios on the page mean nothing. A plane triangle
could not do the job at all — the three angles of a spherical triangle add to
more than 180°, and the excess is its area — which is why the sides come out
curved. `flattenTriangle()` returns the corners, the sides, the three angles
and the direction each side leaves each corner in; the drawing takes its arcs
from that last one, so a mark and the number beside it cannot disagree.

**The tab opens three hours before local apparent noon.** The clock is snapped
to noon everywhere else, and at noon P, Z and X stand on one meridian: there
is no triangle, every figure on the tab is a straight line, and the tab cannot
show its own subject. `app.js` winds it back once, the first time the tab is
opened outside a lesson, and the noon button in the rail puts it straight
back. When it is put back, the flat figure says what has happened rather than
looking broken.

Half a sphere always faces away, so being asked to show an angle is not the
same as showing it: `reveal()` turns the sphere to the mean direction of
everything wanted, but only when something wanted is hidden, and only from a
click or a section change — never from inside a render, which would set state
mid-render.

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
- The section being read is found with a **scroll listener, not an
  `IntersectionObserver`**, for exactly the reason the typesetting uses a timer
  and not an animation frame: both observers and frames are tied to the
  rendering loop, and a window sitting behind another runs neither. Six
  rectangles per scroll is not a cost worth optimising.
- Prose may use `**bold**` and `*italic*`; `ui/text.js`'s `richText()` turns
  those two into tags after escaping the HTML, and nothing else is markdown.
  **It is the only renderer either the theory tab or the lesson bar may use.**
  The tab escaped without the emphasis and the bar did neither, so six strings
  reached the page wearing their asterisks, in both languages.

### Nothing is used before it is introduced

The tab expects a reader who knows trigonometry and no navigation, so every
navigational symbol has to be named in prose before an equation uses it.
`theory.test.js` holds a table of (symbol, the phrase that introduces it) and
checks the order in both languages; add a symbol to the derivations and add a
row. Two consequences worth knowing:

- Subscripted symbols go through MathJax (`\\(H_o\\)`, `\\(Z_n\\)`), never as
  Unicode. There is no subscript "c" in Unicode at all, so an Hc written as a
  character could never match the Ho standing beside it.
- **The angle at Z is not the bearing.** The angle in the triangle is measured
  from the elevated pole and never passes 180 degrees; the bearing Zn is
  measured from north and runs the whole way round. The tab says so where the
  angle is introduced, and uses Zn everywhere afterwards.

### Czech terminology

Checked against Czech practice rather than translated: **poziční linie** (not
"přímka"), **námořní almanach** (not "ročenka"), **lunární vzdálenosti** (not
"měsíční", which also means *monthly*), **náměr** for a bearing,
**metoda stejných výšek**, **intercept**, **kulminace**, **pravé poledne**,
**podsluneční bod (PB)** — the abbreviation the globe panel labels it with.
Sources: chovanec.com's ocean-passage write-up, tomaskudela.cz on the sextant,
and krasajachtingu.cz's beginners' piece.

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
- **A label written along a line is read as part of the line, not as a
  measurement of it.** The three sides of the triangle carried
  `90°−δ = 110° 15,9′` lying along the arc, and the question that came back was
  why the angles were being drawn on the lines. Sides now carry two short lines
  set square to the arc, and the angles are marks at the corners.
- **A triangle with no area has no inside, so "push the label outward" means
  nothing.** At local apparent noon the flat figure is one straight line and
  every label lands on it and on the next one along. `drawFlat` sees the
  collapse in the spherical excess and lays the corner names down one side of
  the line and everything else down the other.
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
- An ephemeris wants dynamical time and everything else wants UT. Feeding UT
  straight in is silent, and for the moon it is forty arcseconds — the exact
  size that matters. `lunar()` converts; nothing else should.
- **A bash heredoc eats one level of backslash**, quoted or not, so a patch
  script written inline turns `\\(` into `\(` and the delimiter vanishes from
  the JS string long before MathJax sees it. Write the script to a file with
  the Write tool. `tex.test.js` catches the result, which is the only reason
  this is a footnote rather than a shipped bug.
- **`IntersectionObserver` is as tied to the rendering loop as
  `requestAnimationFrame` is.** A page that is not being drawn fires neither —
  and neither does it fire `scroll`, which is why a scroll-driven feature
  cannot be tested in a preview pane that is not painting. Dispatch the event
  by hand to test the logic, and force a paint to test the wiring.
- A listener on `window` outlives a language switch, because `mount()` replaces
  the DOM and unsubscribes from the store but knows nothing about listeners a
  view attached elsewhere. `followScroll` removes itself the first time it
  finds its own node detached.
- **The azimuth is not the angle at Z.** The angle in the triangle is measured
  from the *elevated* pole and never exceeds 180; the bearing Zn is measured
  from north and runs the whole way round. At the Cape with the sun in the
  north-east the two differ by 64 degrees, so an angle mark drawn the short way
  round and labelled Zn draws one number and writes another.
- Parallax from the geocentric altitude and parallax from the observed one are
  different functions. Confusing them is worth 0.7 arcminutes at 45 degrees,
  which is twenty sea miles through a lunar.
- `.tabs` is `flex-shrink: 0`, so `flex-wrap` alone will not wrap it — the box
  keeps its content width and never gets narrow enough. It needs
  `flex-shrink: 1` first. Czech tab names are long enough to need this.
- `.wu-row` does not exist. The work-up rows are a `<dl class="wu-rows">` with
  `dt`/`dd`, which is a two-column grid that keeps a long wrapped label from
  dragging its value along. Reuse it rather than inventing a parallel one.
- **A derivation cannot be shown to a finer precision than its own inputs.**
  One second of time is a quarter of a mile of longitude and a tenth of a
  minute of the equation of time is three quarters of one, so a line quoting
  both of those and answering to a tenth of an arcminute could never add up.
  `fmtClockTenths` exists for that line.
- A test that walks a lesson twice walks step 0 twice, which clears the log —
  so the second walk draws a *different* sight with a different reading error.
  Apply the last step on its own instead. The first version of that test passed
  on luck and failed the moment another file changed the random sequence.
- Prose that counts things goes stale. "Four short walks" survived a fifth
  lesson; "over six weeks" outlived every passage in the program. Where a
  count appears in a string, there is a tripwire test beside it.

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
- `theory.test.js` — renders every `sub` block against a full log and checks
  that the arithmetic on screen actually works out at the precision it is
  shown to. A line whose numbers are each right and which still does not add
  up is worse than no line at all.
- `lunars.test.js` — the moon, the precise sun and delta T against
  `astronomy-engine`; the clearing proved by round trip; the thirty-to-one
  amplification measured rather than asserted; and the claim that a lunar gives
  the same Greenwich time from five different places on Earth, which is the
  whole method stated as a test.

When changing anything in `core/`, run the suite before touching a view.

## Roadmap

[ROADMAP.md](ROADMAP.md) is now a record rather than a plan: phases 0 to 7 are
all done. What is left is listed there under "Ongoing, not phased".

# Roadmap

What is built, what is not, and the order worth building it in.

## Where the project stands

Working and tested: the computational core, both tabs, the sight log and its
two reductions, Czech/English throughout, ten Czech towns and twelve world
positions, six scenarios. 69 tests, 4 800 lines, no build step.

The application currently demonstrates the thesis **within one day**. Almost
everything below is about demonstrating it the way it actually bit people:
over a passage, with an instrument in your hands, and with a clock whose error
is not a constant.

---

## Phase 0 — Put it under version control

There is no git repository. Everything so far exists in exactly one copy.

```bash
git init
printf 'node_modules/\n' > .gitignore
git add -A && git commit -m "Celestial navigation simulator"
```

**Done when** `git log` has one commit and `node_modules` is ignored.
Everything after this assumes it.

---

## Phase 1 — The degeneracy panel

*Small. The one piece of the original design that never got built, and the
clearest single statement of why longitude is impossible.*

Three views of the Earth from above the pole, side by side: three observers at
0°, 30°W and 60°W, at 12:00, 14:00 and 16:00 UTC. All three stand at local
noon. All three read the same altitude. **The pictures differ only in where
Greenwich is drawn.** Cover the prime meridian and they are the same picture.

This is exact, not approximate: rotating the Earth while advancing the clock is
a symmetry of the observation. That is the whole reason a clock has to be
carried rather than deduced.

- New: `src/views/degeneracy.js`, reusing the polar projection already in
  `theoryfig.js` (`createHourAngle` draws this geometry).
- Goes in the **theory tab**, in the Longitude section, as a `fig` block.
- Drive the three panels off the current latitude so it stays consistent.
- No new core maths.

**Done when** the three sextant readings render identical to the tenth of a
minute and the only thing that differs between panels is magenta.

---

## Phase 2 — Chronometer *rate*, not just error

*Small, and conceptually central: the Longitude Act was about rate stability,
never about a clock being right on the day it sailed.*

`clockErrorSec` is currently a fixed offset. A real chronometer has a **rate**
— seconds gained or lost per day — and the error at sea is

```
error(day) = errorAtDeparture + rate × daysSinceDeparture
```

- State: add `clockRateSecPerDay` and `departureDate`; derive the effective
  error instead of reading the slider directly.
- Rail: a second slider, and a readout in the H4 idiom ("losing 0.3 s/day").
- Theory: one line in the Longitude section — half a degree over a six-week
  passage is three seconds a day.
- Scenarios: the Jamaica preset becomes *rate* 0.06 s/day over 81 days rather
  than a flat five seconds.

**Done when** moving the rate slider with a departure date set moves the
longitude and leaves the latitude alone, and `npm test` pins the accumulation.

---

## Phase 3 — Voyage mode

*The biggest remaining piece, and the one that makes the argument visceral.*

Sail a passage. Each day the ship runs a course at a speed; dead reckoning
accumulates error from current and steering; each noon the navigator takes a
sight. Latitude snaps back to truth every single day. Longitude does not,
unless the chronometer holds.

Then run the same passage twice — with a chronometer and without — and lay both
tracks over the truth.

- New core: `src/core/voyage.js`, pure and testable.
  ```
  simulateVoyage({ start, days, courseDeg, speedKts, set, drift,
                   steeringBiasDeg, clock }) -> { truth[], dr[], fixes[] }
  ```
  Truth = rhumb-line run plus current. DR = what the log and compass claim.
  Fixes = `reduceLog` applied to each day's noon sights.
- New view: `src/views/chart.js` — a plate-carrée chart with three tracks
  (truth, DR, fixes), a destination, and the daily error as a sparkline.
- New tab, or a third mode on the simulation tab.
- Makes **latitude sailing** playable: switch the chronometer off and the only
  way to make landfall is to find the destination's parallel and run down it.

Build order: core + tests first, then the chart, then the controls. Do not
start the chart before `simulateVoyage` is green.

**Done when** the no-chronometer track makes landfall in the wrong place, the
latitude column is right every day, and a test asserts both.

---

## Phase 4 — The intercept method and a running fix

*The core is already written and tested but unused: `intercept()`,
`destination()`, `initialBearing()` in `fix.js`.*

One sight gives a circle. Marcq St Hilaire compares it against an assumed
position and steps toward or away from the sun. Two sights hours apart, with
the run between them advanced along the course, give a **running fix** — a
point rather than a line, from the sun alone.

- Needs the DR run between sights, so it follows Phase 3 naturally.
- Plot the intercept and both position lines on the existing globe view; the
  machinery to draw them (`lineOfPosition`, great-circle tracks) is there.
- Theory: a short section on why a single sight can never be a fix.

**Done when** two sun sights four hours apart, advanced along the course,
recover the ship to within a mile.

---

## Phase 5 — The first-person sextant

*Specified in the original design, never built. The sky panel has the geometry
view; it was always meant to have a second one for the feel.*

A realistic horizon: sea, sky, the sun, and a split-mirror overlay in which you
bring the sun's lower limb down to the horizon by dragging the index arm, then
read the vernier. **Take a sight** becomes a physical act rather than a button,
and the reading error stops being a slider and becomes yours.

- New: `src/views/sextant.js`, a tab within the sky panel.
- The altitude you set feeds the log directly, replacing `jitterMin` for
  hand-taken sights (keep the synthetic jitter for the quick button).
- Rolling-deck mode — a slow sinusoid on the horizon — is what makes a sight at
  sea hard, and is three lines once the view exists.

**Done when** a user can take a noon sight by hand and land within two
arcminutes on a steady deck.

---

## Phase 6 — Guided lessons

*In the original file layout as `lessons/`; never built. This is what turns a
sandbox into something a newcomer can learn from.*

Scripted sequences that set the controls, open the right panels, and narrate.
Four to start, matching the four things the app knows how to show:

1. Latitude at noon — the equinox on the equator, then anywhere.
2. The degeneracy — why the sky cannot tell you the longitude.
3. Longitude by equal altitudes — take the sights yourself.
4. What a wrong clock costs — the rate slider, and the Longitude Act.

- `src/lessons/*.js` as data: `{ title, steps: [{ text, state, panel }] }`,
  bilingual like `theory.js`.
- A step applies a state patch and highlights one panel.
- Deliberately after Phases 1–5, so there is something worth scripting.

**Done when** someone who has never heard of declination can finish lesson 1
unaided.

---

## Phase 7 — Lunar distances

*Stretch. Genuinely hard, and honest about why.*

The moon moves half a degree an hour against the stars, so it is a clock in the
sky — the one way to get Greenwich time without carrying it. It is also why
lunars had to be computed to arcseconds to be worth anything, and why they lost
to Harrison.

The obstacle is the ephemeris: the sun's low-precision series is thirty lines,
the moon's is not. Expect to need a real lunar theory (ELP truncation) or to
accept degraded accuracy and say so on screen. `corrections.js` already has
`parallaxInAltitude` with a horizontal-parallax argument, written for this.

**Done when** a lunar distance gives GMT to within a minute and the page says
plainly how much arithmetic that cost.

---

## Ongoing, not phased

- **Accessibility.** The app is sliders and drag. The globes need a keyboard
  path, the log table needs proper row semantics, and the SVG figures need
  better labels than one `aria-label` each.
- **CI.** Once there is a repository: `npm test` on push, nothing more.
- **A printable almanac page.** The core can already produce one; it would make
  a good offline exercise and costs almost nothing.

---

## Suggested order

Phases 0 → 1 → 2 first: together they are perhaps a day's work and they close
the gap between what the original design promised and what exists. Phase 3 is
the next real investment and the one with the most teaching value left in it.
Phases 5 and 6 are what would make this usable by someone learning alone.

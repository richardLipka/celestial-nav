# Roadmap

What is built, what is not, and the order worth building it in.

## Where the project stands

Working and tested: the computational core, all four tabs, the sight log and
its two reductions, the first-person sextant, lunar distances, five guided
lessons, Czech/English throughout, ten Czech towns and twelve world positions,
seven scenarios, three passages. 229 tests, 12 200 lines, no build step.

The application demonstrates the thesis within one day, over a passage, through
the instrument itself, and against the one method that could have beaten the
chronometer and did not. **Every phase on this list is done.** What remains is
under "Ongoing, not phased".

---

## Phase 0 — Put it under version control — done

`git init`, a `.gitignore` for `node_modules`, and one initial commit of 37
files. Everything after this assumes a repository exists.

---

## Phase 1 — The degeneracy panel — done

The one piece of the original design that never got built, and the clearest
single statement of why longitude is impossible.

Three views of the Earth from above the pole, side by side: observers at 0°,
30 W and 60 W, each at its own local apparent noon. All three read
`Ho 51° 45.7′` — the same altitude off the same instrument — at 12:11:24,
14:11:24 and 16:11:24 UTC. The panels differ in exactly one thing, where
Greenwich is drawn, and Greenwich is the one line on Earth none of them can
see. *Cover the magenta and these are the same picture.*

Built as `src/views/degeneracy.js`, in the theory tab's Longitude section.
The declination is held still across the panels, which isolates the rotation;
the note beside the figure says what the real drift would do — a minute of arc
an hour, far too little and far too ambiguous to serve as a clock — and why
that made the moon worth the trouble.

Two things turned up while building it:

- `fLat`/`fLon` gave zero a hemisphere, so the prime meridian read
  `000° 00.0′ E`. Zero belongs to neither; the suffix is now suppressed.
- `.body` had `align-items: flex-start`, so once it became a column at narrow
  widths its children sized to content instead of the container and a wide
  figure dragged the whole page sideways. Pre-existing, found by this figure.

---

## Phase 2 — Chronometer *rate*, not just error — done

A chronometer is not judged by whether it is right. It is judged by whether its
rate is constant: you have it rated ashore, you apply that known rate at sea,
and what is left to hurt you is only the part of the rate nobody knew about.

```
error(t) = errorAtDeparture + rate × (t − departure)
```

`chronometerError()` in `core/time.js`; the store derives `errorAt(instant)`
and uses it **per instant**, so every logged sight carries the error the watch
actually had when that sight was taken. A linear rate is well behaved under
equal altitudes — the midpoint of two readings picks up the error at the
midpoint — so nothing else had to change.

The rail gains a rate slider (cubic, because the interesting range is below a
second a day), a "set and rated on" date, and a running total: *62 days out —
the watch is now 5s fast*.

Two scenarios carry it:

- **Jamaica 1762** is now a rate of 0.081 s/day accumulating from Portsmouth
  over the 62-day passage, reaching the five seconds H4 actually lost, instead
  of a flat five seconds appearing from nowhere.
- **The Longitude Act's demand** is new: six weeks out at 2.857 s/day, which is
  120 s, which is half a degree. It lands on 30.0 nm — the prize threshold, to
  the tenth of a mile.

Acceptance, measured in the browser on one log at Jamaica:

| rate | accumulated | latitude | longitude error |
|---|---|---|---|
| 0.081 s/day (H4) | 5 s | 18° 00.2′ N | 1.87 nm |
| 2.92 s/day | 3m 03s | 18° 00.2′ N | 44.2 nm |

Latitude does not move. That is the whole point.

---

## Phase 3 — Voyage mode — done

Sail a passage. Each day the ship runs a course at a speed, the current sets it
off, and each noon the navigator takes a sight. Three positions are tracked and
they are not the same thing: where the ship **is**, where the log and compass
**say** it is, and what the navigator actually **writes in the book** — the
latitude from today's sight, and the longitude from either the chronometer or,
failing that, the dead reckoning.

The navigator resets to that estimate every noon, as real practice did. With a
chronometer the error is wiped once a day and never accumulates. Without one,
only the latitude is wiped and the longitude compounds for the whole passage.

`core/voyage.js`, `views/voyage.js`, `routes.js`, third tab. Two decisions
shaped it:

- **The course is laid off from where the navigator believes the ship is.**
  Steering a fixed course made the current, not the clock, the deciding
  variable, which buried the lesson. Re-steering daily from the estimate is
  also what a navigator actually does.
- **Rhumb lines, and a Mercator chart.** A ship holds one compass course, which
  traces a rhumb line, and on Mercator that is a straight line — which is what
  Mercator was for. `rhumb()` does Mercator sailing; the great-circle bearing
  the first draft used never arrives.

Las Palmas to Bridgetown, 2 630 nm, 0.6 kn of current setting west:

| clock | days | worst latitude | longitude error at the end | outcome |
|---|---|---|---|---|
| perfect | 25 | 0.46 nm | 0.0 nm | landfall, 17.5 nm off |
| H4's rate, 0.081 s/day | 25 | 0.46 nm | 0.5 nm | landfall, 17.6 nm off |
| the Act's 2.86 s/day | 25 | 0.46 nm | 17.4 nm | landfall, 23.5 nm off |
| **none carried** | 36 | 0.46 nm | **568 nm** | never found it, 539 nm away |

On the chart, a good chronometer puts the two tracks 0.1 px apart. Without one
they diverge by 110. The latitude is 0.46 nm in every single row.

The Bergen–Reykjavík route in December is the counter-case: 18 of 21 days with
the sun below five degrees, no usable sight at all, and the latitude ends 78 nm
out. The verdict says so rather than repeating the usual line — the latitude is
only free when the sun will oblige.

---

## Phase 4 — The intercept method and a running fix — done

A noon sight is a generous special case: it hands you a latitude directly and
asks nothing of the clock. The general method asks a different question. Guess
where you are, work out what the altitude *would* be there, and the difference

```
p = Ho − Hc
```

is the intercept — how far the ship lies toward the sun from your guess, along
its bearing. The line of position runs at right angles to that bearing, which
is the rule from the very first section arrived at a second time.

Measure east and north from the assumed position in nautical miles and a line
of position is just `x sin Zn + y cos Zn = p`, so crossing two of them is a
two-by-two solve whose determinant is `sin(Zn1 − Zn2)`. Sights on the same
bearing give zero and no fix at all — a poor cut, which the panel says rather
than drawing a point.

`crossSights()` and `runningFix()` in `core/sights.js`, plotted on the globe
and worked in the noon panel. An entry may carry its own assumed position,
which is what makes it a *running* fix: reduce each sight from the dead
reckoning at its own moment and the run between them cancels out of the
algebra.

Three sights at Jamaica, three hours either side of noon, from an assumed
position at the round degree 18° N 077° W:

| | |
|---|---|
| 14:18:35, bearing 129° | 7.5 nm toward |
| 20:18:35, bearing 231° | 7.8 nm away |
| cut | 102° |
| fix | 18° 00.2′ N 076° 49.7′ W |

1.6 nm from the ship, from two sights and no noon at all — and still carrying
the scenario's five-second clock error in the longitude, because changing the
method never changes the arithmetic of the Earth.

One honest limit: the intercept works in the tangent plane, so it is exact only
for a short intercept. From a round-degree assumed position that is fine; from
300 nm away it degrades, and a second pass from the first answer recovers it.
Both are pinned by tests.

---

## Phase 5 — The first-person sextant — done

A second view in the sky panel: the telescope field, with sea and sky through
the clear half of the horizon glass and the sun brought down into it off the
index mirror. Swing the arc until the sun swims into the field, then drag
inside it to work the drum until the lower limb sits on the horizon. The number
on the arc is the sextant altitude.

`views/sextant.js`. Three decisions:

- **The error it logs is yours.** `addSight(at, byHand)` takes the difference
  between the angle you set and the angle that was there, in arcminutes, and
  puts it in the log as that sight's reading error. The synthetic-noise switch
  leaves hand-taken sights alone: your mistake is not a draw from a model.
- **The error is reported only after the sight.** Shown live it could simply be
  zeroed, and there would be nothing left to learn. The hints say *above* or
  *below* the horizon, which is what you can see anyway, and no more.
- **The arc is coarse and the drum is fine**, as on the instrument: a tenth of
  a degree on the slider is six minutes of arc, so the last arcminutes have to
  come from the drum. That is the workflow, not an accident.

Acceptance: swinging the arc until the sun appeared at 51°, then working the
drum by drag, settled at 51° 33.5′ — *within a minute of arc*, against a target
of two.

Rolling-deck mode oscillates the horizon by about a tenth of a degree over a
seven-second period. Align to the rolling horizon at the wrong moment and the
error is exactly the roll at that instant, which falls out of the geometry with
nothing special added. The animation runs only while the sextant view is on
screen and stops when it is not.

---

## Phase 6 — Guided lessons — done

`src/lessons.js` is the script and `src/views/lessonbar.js` drives it: a strip
under the masthead that narrates, and a picker at the top of the rail. Four
lessons, 5 / 3 / 4 / 4 steps, bilingual.

1. Latitude at noon — the equinox on the equator, and an hour of clock error.
2. Why the sky hides the longitude — the degeneracy, on the theory tab.
3. Longitude by equal altitudes — take the sights, watch one down.
4. What a wrong clock costs — the rate, and then the passage twice.

A step is data: `{ state, tab, view, panel, act, text }`. `state` is patched
into the store, `panel` lights one panel, and `act` is an escape hatch for the
things a patch cannot express — filling the log, or pinning the route.

Two things the build turned up, both of which had shipped:

- **A step must stand on its own.** A reader can walk past the step that asked
  them to take a sight, and the next step then narrates an empty panel. `act`
  exists for that, and a test walks every lesson checking that no step points
  at a log it has not filled. A step that is *asking* for the sight is marked
  `asks: true` and exempt.
- **Prose that quotes a number has to be checked against the number.** Two
  sentences were quietly wrong — see the note below.

**Done when** someone who has never heard of declination can finish lesson 1
unaided. They can.

---

## Phase 7 — Lunar distances — done

The obstacle was the ephemeris, as expected, and it took three things rather
than one:

- `core/moon.js` — ELP-2000/82 truncated to Meeus's 60 + 60 terms. Worst error
  over 1700–2060 is 40 arcseconds in longitude, 8 in latitude.
- `solarPrecise()` in `sun.js` — the readable `solar()` is half an arcminute,
  which is seventy seconds of Greenwich time on its own and therefore not good
  enough. The two functions sitting side by side are themselves part of the
  explanation.
- **Delta T**, which was not on the list and should have been. The series runs
  on dynamical time and the ship on solar time; today they are seventy seconds
  apart, which is forty arcseconds of moon. Ignoring it is silent and is
  exactly the size of error the whole method cannot afford.

Then `core/lunars.js`: the geocentric distance, the clearing, the inversion of
the almanac, and the error budget. Plus a fourth tab and a fifth lesson.

**Done when** a lunar distance gives GMT to within a minute and the page says
plainly how much arithmetic that cost. Measured, not asserted: one sight has a
median error of 19 seconds, a round of five 9 seconds, and every round of five
in the test lands inside the minute. The cost panel gives the thirty-to-one and
names what the simulation is not modelling.

### What Phase 7 turned up

- **Parallax is two functions.** From the geocentric altitude down to what is
  observed is `tan p = sin(HP) sin z / (1 − sin(HP) cos z)`; from the observed
  altitude back up is `sin p = sin(HP) cos h'`. They are exact inverses, and
  using either in both directions leaks 0.7 arcminutes at 45° — twenty miles
  through a lunar. The first round-trip test failed by 57 seconds of GMT, which
  is how this was found.
- **Refraction has to be inverted too**, because Bennett's formula is written
  against the altitude you see, not the one the body is really at.
- **The simulation flatters lunars** and has to say so: the almanac that reduces
  the sight is the one that placed the moon, so the table's own error cancels.
  Mayer's tables were good to half an arcminute — two minutes of Greenwich time
  — and a real lunar could not escape that.

---

## Ongoing, not phased

- **Accessibility.** Every control now carries a real `<label for>` and every
  figure an `aria-label`. What is left: the globes are drag-only and need a
  keyboard path, the log table wants proper row semantics, and the figures
  deserve better descriptions than one line each.
- **CI.** Once there is a repository: `npm test` on push, nothing more.
- **A printable almanac page.** The core can already produce one; it would make
  a good offline exercise and costs almost nothing.

---

## What the review of phases 0-3 turned up

Run after Phase 3, over the whole codebase:

- **`useEoT` never reached the voyage.** It was hardcoded on inside
  `simulateVoyage`, so switching the almanac off changed the simulation tab and
  left the passage alone. Sailing early November, that switch is worth 167 nm.
  Fixed and pinned by a test.
- **Thirteen controls had no programmatic label** — visible captions built as
  `<span>` rather than `<label for>`, so a screen reader announced each as an
  unnamed slider. Both helpers now wire them; clicking a caption focuses its
  control as a bonus.
- **`0.25` nm per second of clock error was a magic number in two files.** Now
  `NM_PER_CLOCK_SECOND` in `core/horizon.js`.
- **Six dead exports removed**, and one README figure was stale in the good
  direction: equal altitudes now gives 0.4 nm where the text claimed 0.6.
- **The README quoted figures from a one-off session with random noise**, which
  no reader could reproduce. Replaced with the deterministic pair.
- Physics re-checked independently: rhumb sailing against a separate Mercator
  implementation, the Mercator inverse used by the chart grid, the noon
  reduction at six latitudes across four seasons (worst 0.0002 nm), and the
  nm-per-second exchange rate. All exact.
- 35 combinations of scenario, place, route, tab and language swept in the
  browser: no NaN, no undefined, no unsubstituted placeholder, no stray
  horizontal scroll, no console errors.

## What the lessons turned up

Writing the lessons meant writing sentences that quote figures the simulation
produces, and three of them did not survive being checked:

- *"Look at the latitude. It has not moved."* — after an hour of clock error it
  moves 1.4 nm, because declination is looked up at the chronometer's instant.
  The truthful version is better: longitude 900 nm, latitude 1.4 nm, a ratio of
  six hundred to one.
- *"about thirty miles out, which is exactly half a degree"* — the passage
  takes three weeks, not the six the rate was scaled for, so it arrives at
  0.30°, not 0.50°. The scenario note claimed the same thing and was also fixed.
- *"The longitude error is 0 times the latitude error."* — `wu.noteRatio`
  assumed longitude was the worse of the two. When equal altitudes works
  properly it is not, the ratio falls below one, and a success printed as a
  broken sentence. There is now a `wu.noteEven` for it.

All three are now pinned by tests. The lesson here is the one already in
CLAUDE.md under the README entry, and it keeps recurring: **a number in prose
is a claim, and claims need tests.**

## Suggested order

Nothing left to order: phases 0 to 7 are done. Anything further belongs under
"Ongoing, not phased" above.

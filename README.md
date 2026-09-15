# Sun, Sextant, Chronometer

An interactive demonstration of why a ship can find its latitude with a brass
arc and a clear horizon, and why it cannot find its longitude without a clock
that has kept Greenwich time across an ocean.

Two tabs: **Theory**, which derives both reductions from the navigational
triangle with the equations typeset by MathJax, and **Simulation**, where you
take and log sights yourself and watch them feed the equations.

Bilingual: **čeština / English**, switched with the CZ/EN buttons at the top
right. The choice is remembered between visits.

```bash
npm install
npm start      # http://localhost:5173
npm test       # the core, checked against an independent ephemeris
```

`npm install` pulls two dev dependencies and nothing else. There is **no build
step** — `index.html` loads ES modules straight from `src/`. The only runtime
dependency is MathJax, loaded from a CDN for the theory tab; if it fails to
arrive the page still reads, it just shows the equations as TeX.

## The idea

At any instant the sun is directly overhead at exactly one place on Earth: the
**geographical position**, or GP. Measure the sun's true altitude `Ho` and your
angular distance from the GP is `z = 90° − Ho`. One sight puts you somewhere on
a circle drawn around the GP, and the whole of celestial navigation is working
out where that circle is.

The almanac gives the GP in two independent halves:

| | depends on | drifts at |
|---|---|---|
| GP latitude = the sun's **declination** | the **date** | ≤ 1′ per hour |
| GP longitude = set by the Earth's rotation | the **time** | 15° per hour |

Latitude comes out of the half that depends on the calendar. Longitude comes
out of the half that depends on the clock. Four seconds of clock error is a
nautical mile at the equator; an hour of clock error costs latitude nothing at
all.

The rule that unifies both is one derivative, computed in `core/horizon.js`:

```
dH/dLHA = cos(lat) · sin(Az)
```

On the meridian `sin Az = 0` and the sight ignores the clock entirely — that is
the noon latitude. On the prime vertical `|sin Az| = 1` and the sight is
nothing but the clock. The gauge beside the timeline shows this swinging from
one pole to the other as you scrub through the day.

## Theory

Five sections, each with its equations typeset and then shown again *with your
own figures* substituted from whatever sight is currently on the timeline:

1. **One measurement, one circle** — `z = 90° − Ho`, and why one sight buys a
   circle rather than a point.
2. **The navigational triangle** — the PZX triangle, live on a draggable
   celestial sphere and again as the flat textbook figure. The spherical cosine
   rule for sides turns into `sin H = sin φ sin δ + cos φ cos δ cos t`, and
   everything afterwards is that one equation solved for a different unknown.
3. **Latitude** — set `t = 0` and it collapses to `cos(φ − δ)`. The triangle
   degenerates into a straight line along your meridian and spherical
   trigonometry becomes addition. No `t` appears, so no clock does either.
4. **Longitude** — `t = GHA + λ`, and at noon `λ = 15°/h (12ʰ − UT_LAN) − E`.
   Two things in that line must be told to you and neither is in the sky.
   Includes the equation of equal altitudes, which needs the latitude — which
   is why a navigator works the noon latitude out first.
5. **Why one is free and the other is not** — `∂H/∂t = cos φ sin Zₙ`.

## The panels

- **Sky** — an azimuthal projection with the zenith at the centre. Because the
  vertical circle through the sun is a straight radial line here, `H` and `z`
  appear as the two pieces that line is cut into, and `H + z = 90°` is
  something you can see. The elevated pole is marked: its altitude *is* the
  latitude, which is the same fact arriving by a second route.
- **Earth** — the same instant from outside. The GP and its parallel of
  declination, the great-circle arc labelled `z`, the circle of equal altitude,
  and the local hour angle as a wedge between two meridians. Drag to turn it.
- **Meridian section** — the proof that latitude is a subtraction. The arcs for
  `δ` and `z` stack end to end and make `φ`. No clock appears in the figure.
- **Sight log** — where you actually work. Move along the day, take sights, and
  they are stamped with the chronometer reading and the altitude you read off
  the arc. Any morning sight can be clamped and watched back down to the same
  altitude in the afternoon, which is the real equal-altitudes method.
- **The noon work-up** — both reductions, worked from your log and the almanac
  and nothing else, with bars showing what each one cost.

Every angle keeps one colour across every panel: **φ** azure, **δ** amber,
**H** green, **z** violet, and magenta for everything the sky cannot tell you —
the prime meridian, the chronometer, the hour angle.

## Taking sights

Nothing outside the simulation itself knows where the ship is. `observe()` has
the truth and returns only what an instrument could show — a chronometer time,
a sextant altitude, a bearing. `reduceLog()` sees the log and the almanac and
has to work the position out of them. The two halves sit in `core/sights.js`
with that boundary written down, because if the reduction ever peeks at the
true position the demonstration stops being one.

Each sight carries a reading error of a few tenths of a minute of arc, drawn
once and kept with it (switchable in the rail). This matters more than it
sounds: with *perfect* readings a parabola finds the vertex of a flat curve
exactly, and the central problem of the noon sight disappears. With half a
minute of noise it comes straight back. From the twelve-sight day at Jamaica
in `sights.test.js`, which fixes the noise so the figures reproduce:

| | error |
|---|---|
| latitude, from the fitted peak | 0.28′ |
| longitude, from the time of the highest sight | **14.2 nm** |
| longitude, by equal altitudes | 0.4 nm |

Same sextant, same sun, same chronometer — only a better way of asking when
noon was. Both numbers are on screen at once, as two bars.

The other half of it is *how* you get the afternoon crossing. If it has to be
interpolated between two logged sights, the gap between them sets the accuracy,
and an hour of gap is worth the best part of a minute of time. If you clamp the
sextant on a morning altitude and watch the sun come back down to it — the
**watch it down** button, which is the actual historical method — the crossing
is observed rather than guessed. On one Jamaica log:

| afternoon crossing | noon found | longitude error |
|---|---|---|
| interpolated between sights | 17:18:02 | 7.93 nm |
| observed on the mark | 17:18:40 | 0.92 nm |

True noon was 17:18:36. The latitude was 0.42 nm out in both. The reduction
says which kind of crossing it used, and the log nudges you toward the better
one.

## Language

Every string lives in `src/i18n.js`, as one flat dictionary per language; the
scenario and place names sit next to their own data as `{ en, cs }` pairs. The
whole UI is rebuilt when the language changes — the state is in the store, so
rebuilding costs nothing and no label can drift out of sync.

Three Czech conventions the code honours, because getting them wrong is what
makes a translated app feel translated:

- the decimal separator is a comma, so Prague reads `50° 04,5′` and not `50° 04.5′`
- the compass rose is **S V J Z** (sever, východ, jih, západ)
- coordinates take **s.š. / j.š.** and **v.d. / z.d.**, never a bare letter — in
  Czech `S` means *north*, and a bilingual reader would read it as *south*

`npm test` checks that the two dictionaries have identical key sets, that no
string is blank, and that the `{placeholders}` match across languages, so a
missing translation fails the build rather than showing up as English in a
Czech panel.

## Places

`src/places.js` holds ten Czech towns — Praha, Plzeň, Brno, Ostrava, Olomouc,
České Budějovice, Hradec Králové, Karlovy Vary, Liberec, Ústí nad Labem — and
twelve positions around the world chosen to exercise the geometry: Greenwich
itself, the Isles of Scilly and the two Harrison trial landfalls, the equator
at Quito, the Arctic at Nordkapp, and the southern hemisphere from Cape Town to
Ushuaia.

The Czech towns are the best demonstration in the app of what longitude
actually *is*. They sit within half a degree of latitude of each other, so the
noon altitude barely moves between them — but Prague's sun culminates at
11:13:34 UTC and Plzeň's at 11:17:49, four minutes and fifteen seconds later,
which is exactly the 1°04′ of longitude between them at four minutes per
degree. Latitude cannot tell the two cities apart. The clock can.

Moving either position slider drops the picker back to *custom position*.

## Layout

```
index.html         the shell: fonts, MathJax, one <div id="root">
server.js          a dependency-free static server, because ES modules need one
src/app.js         tabs, the language switch, and the one subscribe()
src/svg.js         a small SVG helper: paths, arcs, angle marks, visibility runs

src/core/          pure functions, no DOM, no language, fully tested
  angles.js        degrees everywhere, DMS formatting, nautical units
  time.js          UTC <-> Julian Day, hour-angle wrapping
  sun.js           declination, RA, GHA, equation of time, the GP
  horizon.js       altitude, azimuth, culmination, and dH/dLHA
  corrections.js   dip, refraction, semi-diameter, parallax, index error
  fix.js           the two reductions, circles and lines of position, intercept
  sights.js        observing and reducing a log, kept strictly apart

src/state/store.js one state object, one derive step, one notification
src/theory.js      the theory tab as data, bilingual, with live substitutions
src/i18n.js        every user-visible string, Czech and English
src/places.js      Czech towns and a spread of world positions
src/scenarios.js   the presets, with their names and notes in both languages

src/views/
  skydome.js       the sky as the navigator sees it
  globe.js         the same instant from outside, orthographic
  meridian.js      the phi = delta + z figure, live
  sightlog.js      the log book and its actions
  workup.js        both reductions, worked from the log
  timeline.js      the day scrubber and the sensitivity gauge
  theory.js        the theory tab renderer and MathJax handling
  theoryfig.js     the 3D triangle, the flat triangle, the hour-angle wedge

src/ui/rail.js     the controls, which are the state and nothing else
src/ui/format.js   the formatters that need to know the language
```

## Conventions

North-positive latitude and **east-positive longitude everywhere inside the
core**; the conversion to N/S/E/W happens only in the formatters. Hour angles
are wrapped to `(−180°, +180°]` so that culmination reads as a sign change
rather than a discontinuity.

The three altitudes are kept as three separate values, never one mutable
number:

```
Hs  sextant altitude    the number on the arc
Ha  apparent altitude   after index error and dip
Ho  observed altitude   after refraction, semi-diameter and parallax
```

## Sights that cannot be taken

At Nordkapp in January the sun never rises, and a reduction of an altitude of
−1°28′ is arithmetic rather than navigation. The work-up says so instead of
quietly returning a position, and warns separately below 5°, where the
refraction model stops meaning anything.

## Accuracy

The solar position is the standard low-precision series, good to about 0.01°,
which is 0.6′ — better than a sextant at sea and short enough to read in one
sitting. `npm test` checks it against
[`astronomy-engine`](https://github.com/cosinekitty/astronomy) over 10 000
random sights and requires agreement within 0.02°, and pins the equation of
time extremes, the standard dip and refraction figures, and the two reductions
themselves. Sights below 5° are flagged, because down there the refraction
model stops meaning anything.

## Not built

See [ROADMAP.md](ROADMAP.md) for what remains and in what order. In short:
voyage mode, a two-body fix (the core already has `intercept()`), the
first-person sextant view, the degeneracy panel, guided lessons, and lunar
distances.

## Contributing

[CLAUDE.md](CLAUDE.md) is the working document: architecture, the rule that
keeps the simulation honest, the conventions, and the traps already hit.

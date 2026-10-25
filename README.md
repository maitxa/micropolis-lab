Micropolis Policy Lab
=====================

**A modified version of [micropolisJS](https://github.com/graememcc/micropolisJS)** by Graeme McCutcheon, which is a JavaScript port of
Micropolis, the open-source release of the original 1989 SimCity by Will Wright (Maxis / Electronic Arts). This is **not** the
original game, and it is not affiliated with Electronic Arts, Maxis, or the micropolisJS author.

## What the Policy Lab adds

Before play, a setup screen separates two kinds of choices:

- **World model**: assumptions about cause and effect, fixed for the whole game. Does poverty (cheap land) drive crime? Does
  density? How effective are police? Do social services reduce crime? Do high taxes slow growth? Does regulation slow industry?
  Do business incentives attract business?
- **Laws**: structural policies, fixed for the whole game: nuclear power allowed or banned; environmental rules on industry;
  housing density cap; transportation priority (roads vs. transit costs); business incentives (cheaper zones, tax breaks);
  park subsidies.
- **Budget timing**: change the budget any time (original) or only in election years (every 4 years).

During play: numbers have thousands separators; hovering over a message explains why it happened and what to do;
an **Undo** button (Ctrl+Z / Cmd+Z) reverses the last click or drag with a refund; number keys pick tools (press **?**
for the list); and **Shift+click** draws a straight road, rail or power line from the last tile built.

A **City data** window (button under the tools, or press **I**) shows occupancy and demand for residential,
commercial and industrial zones, jobs per resident, neighbourhood averages, power, services and money. The
**Evaluation** window adds "Your policies at work": a plain-language report on how the world model and each law are
affecting the city (e.g. what is driving crime, where pollution comes from, what tax breaks cost).

Two new buildings (drawn in the original style, in tile slots 956-973 that micropolisJS reserved but never used):
**Train depot** ($1,000, key **T**): must touch a rail line; zones within ~16 tiles can commute twice as far and put
half as much traffic on the roads. **Water treatment plant** ($2,000, key **U**): needs power; treats the sewage of
zones within ~24 tiles. A new world-model question, "Does untreated sewage pollute rivers?", makes untreated zones send
their sewage to the nearest water, polluting it and its banks (the map has no direction of flow, so "nearest water"
stands in for "downstream").

European-inspired options (step D): a **zoning principle** law (separate uses, as in U.S. zoning and the original, or
mixed use, where apartment blocks get ground-floor shops: after Hirt's "exclusivity vs. predominance" contrast);
world-model questions on **walkable shops**, on **what makes people move** (jobs driven by industry, as in the
original, or quality of life, with jobs following people), and on **hospital access**; a **car-free downtown** law and
a **green belt** law (both drawn on the map); a **social housing** budget line that keeps lower-value neighbourhoods
from emptying out; and a **Hospital** tool (key **M**; hospitals the city builds are never removed automatically and
cost $150 a year).

**Presets** (setup screen): Original 1989 rules, Progressive (Sanders-style) and Conservative-populist (MAGA-style).
A preset fills in the laws and the starting budget only, never the world model, so no preset can "win" because the
rules were written to agree with it. Each preset lists the sources its settings are based on (see `src/presets.js`),
and notes where a setting is an inference rather than a stated position.

Interface: the tool panel is a grouped legend (zones, getting around, power and water, services, landmarks, change and
inspect) with original icons; the setup screen is a two-column sheet whose choices are buttons ("chips"), with the
original 1989 setting tagged. Interface text uses Public Sans.

Graphics: the map can be zoomed from 100% to 300% (the − / + buttons, or the **−** and **+** keys), and on high-density
("Retina") screens it is drawn at full resolution. Sharper tile and sprite sheets (`images/hd/`, at 2×, 3×, 4× and 6×)
were made from the original art with the xBRZ pixel-art scaler (`xbrz-js`, GPL) and load only when needed.

City advisor: a **To do** card under the tool panel lists the three most useful things to build or fix, updated every
game month (click an item for why and what to do; "Show on map" jumps to the spot). It checks the game's own rules:
zones without power, zones with no road touching them, trips that can't reach a destination, missing workers or jobs,
growth caps (stadium, seaport, airport), demand compared with empty zones, and money running out. Every three months,
or at once when something urgent and new comes up, the top item also appears in the message bar. The original "More
... zones needed" messages (which only compare zone counts) are skipped when the advisor says zones of that kind are
still empty. See `src/advisor.js`.

Hints on the map: "Show me on the map" (or clicking advice in the message bar) outlines every spot the advice is
about: zones without power, zones without a road (with a dashed ring showing exactly where a road would count), zones
whose trips failed, empty zones, or a circle where to build (e.g. "Zone homes inside this circle"). A bar at the top
steps through the spots (Previous / Next) and Hide (or Esc) clears them; when the problem is solved the bar says
"Done". Drawn on a layer above the map (`GameCanvas._paintHighlights`).

Panels: the city box, buttons, R/C/I bars, tool legend and To do card can be moved (drag the dotted strip at the top)
and resized (drag the bottom-right corner; the To do card also has A− / A+ for text size). The layout is remembered in
this browser; "Reset layout" is in the keyboard help (`src/panels.js`).

Funds are shown large in the city box, with the estimated yearly balance (taxes minus running costs) in green or red.

Trips: as in the 1989 original (`s_traf.c`), a trip from a home may end at any shop, factory or other large building;
from a shop, at any home, shop or factory; from a factory, at homes. micropolisJS had narrowed these to homes -> shops
and shops -> factories, which (with the restored rule that shops only grow if their trip succeeds) left shops empty
whenever factories were far away.

Languages: the **EN | ES** switch in the header changes the whole interface between English and Spanish (U.S.) at any
time, even mid-game, and remembers the choice (a browser set to Spanish starts in Spanish). Short interface texts are
in `src/i18n-es.js`; the message help, presets and reports keep their Spanish next to the English in `src/help.js`,
`src/presets.js` and `src/report.js`; word lists whose Spanish depends on context are in `src/text.js`. The header and
footer now use Alfa Slab One (SIL Open Font License, in `css/`), because the original ChunkFive font has no accented
letters.

The Budget window has new **Social services** and **Social housing** lines. Its effect on crime depends on the chosen world model.

With every setting at its "(original)" default, the simulation rules match the original game.

### Bug fix

In upstream micropolisJS the crime calculation never ran (it read `mapWidth`/`mapHeight`, which `BlockMap` doesn't define), so
crime was always zero. This version fixes it, restoring the original crime behaviour.

In upstream micropolisJS, traffic was also broken: a 2018 refactor left `tryDrive` building an invalid position (so no
car ever moved, and cities had no traffic, traffic pollution or traffic helicopter) and referencing an undefined variable
(which would have frozen the simulation once the first bug was fixed). Both are fixed, and the original 1989 rule that a
commercial zone only grows if its trip reaches a destination (dropped in micropolisJS) is restored.

All changes in the source are marked with comments beginning `POLICY LAB`. New settings live in `src/policy.js`.

## Building

```
npm install
npm run build      # output in dist/
```

---

*Original micropolisJS README follows.*

micropolisJS
============

https://www.graememcc.co.uk/micropolisJS

A port of Micropolis to JS/HTML5. The code is licensed under the GPLv3, with some additional terms - please be mindful of these. Likewise, be aware that the code is additionally governed by the Micropolis Public Name License as detailed in the next paragraph; this too must be complied with.

## [Micropolis Public Name License](MicropolisPublicNameLicense.md) ##
The name/term "MICROPOLIS" is a registered trademark of [Micropolis](https://www.micropolis.com) GmbH (Micropolis Corporation, the "licensor") and is licensed here to the authors/publishers of the "Micropolis" city simulation game and its source code (the project or "licensee(s)") as a courtesy of the owner.

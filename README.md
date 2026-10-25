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

During play, the Budget window has a new **Social services** line. Its effect on crime depends on the chosen world model.

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

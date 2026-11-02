Micropolis Policy Lab
=====================

**A modified version of [micropolisJS](https://github.com/graememcc/micropolisJS)** by Graeme McCutcheon, which is a JavaScript port of
Micropolis, the open-source release of the original 1989 SimCity by Will Wright (Maxis / Electronic Arts). This is **not** the
original game, and it is not affiliated with Electronic Arts, Maxis, or the micropolisJS author.

## What the Policy Lab adds

Before play, the setup screen (v29) asks for **five policy choices**, or a preset that fills them in:

- **Taxes and social programs**: high (9%, social services and social housing fully funded), medium (7%, none: the
  original), low (5%, social services at 25%) or minimal (3%, none).
- **Business incentives**: none (original) or strong (free commercial and industrial zones, 20% tax break).
- **Energy and environment**: strict rules and no nuclear, standard rules (original), relaxed rules, or no rules (the
  last three allow nuclear). Rules scale industrial pollution (x0.5, x1, x1.25, x1.5) and industrial growth.
- **Housing and zoning**: mixed use with no density limit, separate uses with no limit (original), or separate uses with
  medium density at most.
- **Transportation**: transit first (cheap rail, pricey roads), balanced (original) or roads first.

**How the world works is fixed, the same for every preset** (a short note on the setup screen says how): crime rises on
cheap land and in crowded places and falls near police, funded social services and parks; taxes above 7% slow growth;
people pay more to live near clean water, shops they can walk to and a hospital; untreated sewage pollutes rivers; each
neighbourhood pays tax on its own land value; trips can go 90 road tiles. Cities saved before v29 keep their policy choices but play in
this world; settings that no longer exist (car-free downtown, green belt, fixed bridges, election-year budgets, park
subsidies, moderate incentives, single houses only, and the old world-model switches) are dropped. The budget can be
changed any time.

During play: numbers have thousands separators; hovering over a message explains why it happened and what to do;
an **Undo** button (Ctrl+Z / Cmd+Z) reverses the last click or drag with a refund; number keys pick tools (press **?**
for the list); and **Shift+click** draws a straight road, rail or power line from the last tile built.

A **City data** window (button under the tools, or press **I**) shows occupancy and demand for residential,
commercial and industrial zones, jobs per resident, neighbourhood averages, power, services and money. The report
**What I did wrong and what to do** ends with "How your policies are working": a plain-language account of how each
policy is affecting the city (what is driving crime, where pollution comes from, what tax breaks cost). Until v28 this
was in the Evaluation window.

Two new buildings (drawn in the original style, in tile slots 956-973 that micropolisJS reserved but never used):
**Train depot** ($1,000, key **T**): must touch a rail line that goes somewhere: to another depot, or (since v28)
round a loop and back, so the train can turn around (a circuit of at least 16 rail tiles, back to the depot or a turning
loop further along the line); a depot with a stub of track does nothing; zones within 16 tiles (a true circle, measured in 2×2 blocks) can
commute twice as far and put half as much traffic on the roads. The water plant, hospital and shop coverage also use
2×2 blocks now, instead of the coarse 8×8 blocks of the first versions. **Water treatment plant** ($2,000, key **U**): needs power; treats the sewage of
zones within ~24 tiles. Untreated zones send their sewage to the nearest water, polluting it and its banks (the map has no direction of flow, so "nearest water"
stands in for "downstream").

European-inspired options (step D): **mixed use** zoning (apartment blocks get ground-floor shops: after Hirt's
"exclusivity vs. predominance" contrast); **walkable shops** and **hospital access** raise land value; a **social
housing** budget line that keeps lower-value neighbourhoods
from emptying out; and a **Hospital** tool (key **M**; hospitals the city builds are never removed automatically and
cost $150 a year).

**Presets** (setup screen): 1989 baseline (a neutral starting point), Progressive (Sanders-style),
Conservative-populist (MAGA-style) and Libertarian. A preset fills in the five choices only, never how the world works,
so no preset can "win" because the rules were written to agree with it. Each preset lists the sources its settings are
based on (see `src/presets.js`), and notes where a setting is an inference rather than a stated position.

Interface: the tool panel is a grouped legend (zones, getting around, power and water, services, landmarks, change and
inspect) with original icons; the setup screen is a two-column sheet whose choices are buttons ("chips"), with the
original 1989 setting tagged. Interface text uses Public Sans.

Graphics: the map can be zoomed from 25% (the whole map) to 300% (25, 50, 100, 200, 300%) (the − / + buttons, or the **−** and **+** keys), and on high-density
("Retina") screens it is drawn at full resolution. Sharper tile and sprite sheets (`images/hd/`, at 2×, 3×, 4× and 6×)
were made from the original art with the xBRZ pixel-art scaler (`xbrz-js`, GPL) and load only when needed.

City advisor: a **To do** card under the tool panel lists the three most useful things to build or fix (click an item
for why and what to do). It checks the game's own rules: zones without power, zones with no road touching them, trips
that can't reach a destination, missing workers or jobs, growth caps (stadium, seaport, airport), demand compared with
empty zones, money running out, and train depots not linked by rail to another depot (`src/advisor.js`). The list stays
put: an item keeps its place until it is fixed or you press **Got it**, which hides it for 3 minutes of play (paused
time doesn't count); only something very urgent and new can take the place of the least important item.

Status bubbles (top of the To do card): **Pollution, Crime, Traffic, Power, Jobs, Taxes**, each red (urgent, "!!"),
orange (watch, "!") or green (good, "✓"); the symbol and a word go with the colour. Click one for its figures, a year-ago
comparison, what drives it, what to do, and a map layer (pollution, crime, traffic, power, or workers nearby). These
conditions are no longer posted as messages. The 1989 model has no real crime or pollution rates: each 2×2
neighbourhood gets a score from 0 to 250. So the bubbles show the **share of residents** living where the score is
high (the Query tool's "Heavy" pollution or "Moderate" crime and worse), and the average score where people live on a
0-100 scale. (The game's own "average pollution" only averages neighbourhoods with some pollution, which makes one
smokestack in a clean city look bad.) Traffic is the share of road tiles with heavy traffic; Jobs is the game's own
rough comparison of residents and jobs. Thresholds: urgent at 25% of residents (10% for watch); power urgent below 70%
(the original blackout alert); taxes urgent above 12%. See `src/status.js`.

Zoning need (lower left; replaces the original R / C / I demand bars): one bar each for homes, shops and factories.
Since v29 **the bar is the game's own demand**. **Above the line: zone more** of that kind, even if some zones are still
empty: zones fill a little at a time, by chance, so 5 empty homes next to 20 full ones are just filling. **Below the
line: not needed now.** A bar can also say that growth is stopped until you build a stadium, airport or seaport. Under
each name a small line counts the empty zones: **stuck** (no power, no road, or, for homes, a spot where a home can't
grow at today's demand because land value minus pollution is too low) or **filling**. Point at (or tab to) a bar for
the details and the game's raw demand. The original "More ... zones needed" messages are not shown (`zoningNeed` in
`src/advisor.js`, drawn by `src/needChart.js`).

Shops that can't reach customers: a shop whose trips failed in at least 2 of the last 3 months (and whose reach isn't
clearly fine) gets a red frame on the map all the time, with a key in the To do card. In the 1989 rules these shops can't grow. Homes and factories are not flagged: being far
from shops, jobs or workers doesn't stop them growing (they only need a road and power). This only describes the city: zones still grow according to the game's original demand.

Shipping channel: the big river has a hidden channel down its middle (drawn with the same picture as ordinary water),
which ships follow. A road bridge across it becomes a drawbridge (rail bridges and power lines never open). The channel
is shown as dashed water while the Road tool is selected and on the Dead ends layer, and building a road bridge across
it says "Drawbridge: this bridge crosses the shipping channel...". Under the Fixed high bridges law none of this
applies, so the channel isn't shown.

Message bar: messages stay until you press **Got it**; newer ones wait in a queue ("+2 more") instead of replacing the
one you are reading, and disasters go to the front. After Got it, the same message can't come back for 3 minutes of
play.

Trips (as in 1989, `s_zone.c`): every occupied zone now and then sends a car along the roads, but only SHOPS need
that trip to succeed in order to grow (EvalRes and EvalInd only penalise "no road at all"; DoCommercial grows only if
TrfGood). Homes and factories just need a road touching one side and power; their trips only make traffic. So the
advisor's "can't reach" hints are for shops only, listed if a shop failed in at least 2 of the last 3 months and its
reach is not clearly fine (a home, shop or factory within 10 road tiles, no dead end or open drawbridge within 10).
If rail runs right beside the road, the hint says so: every such tile is an extra junction for the car.

Reach: for a "can't reach" hint, and for any zone or road you click with the Query tool, the map shows how far a car
can get along the roads (darker within 15 tiles, lighter up to 30), the places it could reach (green frames), and dead
ends (orange). This is the best case: the car turns at random, so far destinations are still missed some of the time
(`src/reach.js`). For homes and factories it is information about traffic, not a condition for growth.

Query tool: inspecting a home, shop or factory adds a **Connections** section to the info window (road touching a
side, power, whether it can reach what it needs within 30 road tiles, dead ends and drawbridges on its routes, and a
one-line verdict); inspecting a road or rail tile says where it leads (homes, shops and factories within 30 tiles,
whether it links homes and jobs, whether this tile is a dead end or a drawbridge). The reach stays on the map after the
window closes.

Bridges law (setup screen): **Drawbridges** (original: road bridges over the shipping channel open for ships, and at
random about a third of the time with no ship near, cutting the road while open) or **Fixed high bridges** (never open;
ships pass underneath). Drawbridges are labelled in the reach view. Note that when roads are underfunded, bridges can
also collapse into water (original rule).

Hints on the map: "Show me on the map" in the To do card outlines every spot the advice is about: zones without
power, zones without a road (with a dashed ring showing exactly where a road would count), zones whose trips failed
(with their reach), empty zones, or a circle where to build. The spots are frozen when you open the hint, so nothing
moves until you choose; Previous / Next step through them, and "Hide from map" (the same button, or Esc) clears them.
All of this is shown inside the To do card.

Panels: the city box, buttons, R/C/I bars, tool legend and To do card can be moved (drag the dotted strip at the top)
and resized (drag the bottom-right corner; the To do card also has A− / A+ for text size). The layout is remembered in
this browser; "Reset layout" is in the keyboard help (`src/panels.js`).

Map layers (buttons in the To do card, one at a time, stay on until clicked again): **Pollution** (the game's pollution
map in its levels: moderate, heavy, very heavy), **Dead ends** (every dead-end road or rail tile, and drawbridges) and
**Where to zone** (v29; open land and home zones coloured by how a home would do there at today's demand, using the
game's own rule: green, homes grow and stay; yellow, they may grow and may empty again; red, they can't grow now; and
shops whose trips keep failing framed in red). Keys are shown in the card (`src/layers.js`).

City history: hovering over (or clicking) the funds opens charts over the years: funds, each year's surplus or
deficit (taxes minus running costs), population and tax rate. Recorded monthly and saved with the city
(`src/historyCharts.js`).

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

The Budget window has new **Social services** and **Social housing** lines; social services reduce crime, most in the poorest neighbourhoods.

With every setting at its "(original)" value ("Reset to the original 1989 rules" on the setup screen), the simulation
rules match the original game. Since v25 the **defaults** differ from 1989 in five world-model answers (below); cities
saved before v25 keep the 1989 answers for those questions.

### v25: score, saved cities, scoreboard, going back in time, new defaults

- **How the score is worked out** (Evaluation window): the starting figure (1,000 minus the residents' seven problems:
  crime, pollution, housing costs, taxes, traffic, unemployment, fires), each penalty or bonus this year (missing
  stadium/airport/seaport -15%, collapsed demand -15%, underfunded services, population growth or decline, fires, the
  tax rate, zones without power), and the averaging with last year's score. The score is roughly the share of voters who
  approve of the mayor (500 = half, 700+ good, 800+ excellent).
- **Bug fix (score):** micropolisJS put `Math.floor` around the population-decline factor, which the 1989 C code
  (`s_eval.c`) doesn't have: any shrinkage at all made that year's figure 0 and halved the score. Fixed.
- **Saved cities:** save under a name (saving again under the same name replaces it); "Load game" on the start screen
  lists every saved city (name, year, population, score, date) with Load, Export (a `.json` file) and Delete, and
  imports a city file. Cities are kept in this browser's built-in database (IndexedDB), not the original single 5 MB
  save slot, which is copied into the list once (`src/cityStore.js`, `src/cityPanels.js`).
- **Scoreboard** (start screen, and in the Evaluation window): one row per city that has people, with its best score,
  current score, year, population and the rules it is played with; cities with the same rules are marked, since only
  those are fair to compare. Your games in this browser only.
- **Go back in time:** a copy of the city is kept every 10 game years (the last 20, so up to 200 years back). The
  "Go back in time" button lists them; the city as it is now is saved first, so you can return to it.
- **New world-model questions and defaults:** social services reduce crime ("somewhat", if funded); **parks reduce
  crime** (big parks by 40 points within 8 tiles, small park tiles by 15 right around them); **people pay more to live
  near water** (+40 land value within 3 tiles of clean water; water polluted by sewage doesn't count); **expensive
  neighbourhoods pay more tax** (the taxed land value is each zone's own, weighted by the people who live or work there,
  instead of the average over all built-up land; City data shows both); **people travel up to 90 road tiles** on a
  trip instead of 30 (180 with a linked train depot), so homes, shops and industry can be far apart (`src/amenities.js`).
  Since v29 these are simply how the world works.
- **Big park** (key **G**, $150): 3x3 lawns and trees with a fountain; it cleans the air within 8 tiles (pollution x0.6)
  and lowers crime there.
- The To do card no longer shows on the start screen (a style was overriding "hidden until the game starts").

### v26: highways and "What went wrong?" (renamed "What I did wrong and what to do" in v29)

- **Highways** (key **E**, $40 a tile: a road plus three times the road price; drag over an existing road to upgrade it
  for $30 a tile). A highway is an ordinary road tile that the city also lists as highway (saved with the city): on it a
  trip uses up only a third of a tile of its distance (so 90 road tiles become 270 on highway), each car adds half the
  congestion, upkeep is that of three road tiles, and its bridges never open, even over the shipping channel. Zones can
  use a highway as their road. Drawn as an amber band over the road. Undo and the bulldozer take the highway off the
  list again; a highway road that burns or floods is dropped from it. The reach view and the Query tool count highway
  tiles at a third (`gameTools.js`, `traffic.js`, `reach.js`, `road.js`).
- **What went wrong?** (button under the funds): a report of the planning mistakes in the city as it is now and in its
  money history, worst first: homes in heavy pollution or right next to industry, high crime with no police, too many
  empty zones of one kind, zones without power, shops that can't reach customers, dead ends, growth capped by a missing
  stadium/airport/seaport, jammed roads, depots that do nothing, drawbridges, deficit years, long stretches of high
  taxes, underfunded roads. Each says why it matters in this game's rules and what to do, with "Show on the map";
  "Copy report" copies it as text (`src/mistakes.js`).
- The button panel grows with its buttons, and the Zoning need box is placed under it (unless you have moved it).

### v27: the Query tool shows what affects a spot, and what a building does

- **Homes, shops, factories (and any road or open land): "What affects this spot".** Headline: land value (0-250) and
  class, the taxes the zone pays a year (its share of the city's yearly taxes: the game collects them for the whole city
  at once, so the share is by people, and by land value when "expensive neighbourhoods pay more tax"), residents or
  jobs, the pollution a factory puts out, and for homes the growth score (land value minus pollution). Then land value
  piece by piece (distance from the centre, unspoiled land nearby, waterfront, shops within walking distance, a hospital,
  minus pollution and very high crime), crime piece by piece (cheap land, crowding, police, social services, parks),
  the pollution here and its sources within 6 tiles, and which services reach the spot (police, fire, hospital, a
  working train depot, water treatment, parks). Worked out with the simulation's own formulas from the current maps
  (`src/influence.js`).
- **Police and fire stations, hospitals, big parks and parks, train depots, water plants, coal and nuclear plants:
  "What this building does"**, with its reach drawn on the map (police and fire: where the effect is strong and where it
  is still felt; the others: their fixed radius; coal plants: how far heavy pollution reaches), the numbers (crime points
  removed, home zones covered, funding, capacity in use) and whether it is working (no power, no rail link).
- Bug fix: since v25 the reach view's sentence about how far the closest destination is failed with an error.

### v36: traffic fades faster, and police where crime is

- **Traffic fades faster:** 50 points per simulation cycle instead of 24 (34 above 200). Each car trip adds 50 to the
  roads it uses, so under the 1989 rule about one car per cycle was enough to keep a road jammed, and in a large city
  most through-roads stayed jammed whatever the player built. Tested on a player's city of 36,000 people (average over
  12 months, 3 runs each): old rule 53% of roads jammed, highways on the jammed roads 50%, every zone near a working
  depot 51%; new rule 37%, with highways 30%, with trains 25%.
- **Crime advice:** the Crime bubble now says to put a police station inside each crowded home block, even at the
  cost of one home zone. In the same city the high-crime homes were the crowded ones out of police reach; stations
  8-10 tiles away barely helped, and replacing one home zone in each of the 3 worst blocks took Crime from 42% to 0%.
- Opening guide: numbers rerun under the new rule (cities grow bigger; with automatic budgeting none of the test
  cities went bankrupt), police advice, and traffic figures.

### v37: graduation at a glance

- **Graduation lights** in the city box: one per graduation condition (approval, bubbles, money, people), green when
  met, yellow when close (approval 55-64% since v38, only orange bubbles left, a deficit under $500, at least 75% of the
  population target), red when far. Hovering (or focusing) a light says what is still needed.
- **Graduation years:** five dots that fill each January in which all four were met; one missed year empties them.
- **Grade battery:** the grade's points (0-100) as a battery, coloured by the letter; hover for the four parts.
- **Next step:** one line with the thing to fix next (a red bubble, then a condition far from met, then an orange
  bubble, then a condition that is close), with the full advice on hover.
- The menu under the city box moves when the box grows or shrinks a line.

### v38: approval battery, graduation at 65%

- **Graduation needs 65% approval** (was 70%); the light turns yellow from 55%.
- **The battery shows approval** in the last yearly poll, not the grade's points: graduation depends on approval, not
  on points. It has its own line ("Approval: [battery] 61%"), green from 65%, yellow from 55%, red below, with a dotted
  mark at 65%. The grade's points stay as a number next to the letter.

### v35: where the money goes, who pays the taxes, and a simpler Undo

- **City box:** "Costs: $X a year", a bar coloured by where the money goes, and how long the money lasts at this rate
  ("Taxes cover them" when they do). Hovering shows the breakdown in the same colours (roads, highways, rail, police,
  fire, social services, social housing, depots, water treatment, hospitals, schools, colleges), taxes coming in and
  next year's balance. The menu under the box is slimmer, and is placed under the box unless the player moved it.
- **Taxes bubble** opens a map of who pays the taxes: each zone pays in proportion to its people (homes count 1/8, as in
  the game's tax formula) times its land value; the 5 biggest payers are labelled, with the shares of homes, shops and
  factories.
- **Undo** now simply takes back the last build: the build, its cost and the time since (and so everything that
  happened in that time), with no question, up to 10 builds and only for builds of the last 2 game years. Redo returns
  to the moment Undo was pressed. Both work without reloading the page. (Replaces the v34 choice window.)

### v34: what things cost, Undo that goes back in time, pictures and export that work

- **Hover over a tool** for a card with its price, its running cost per year (at the city's laws and difficulty), its
  effects as the game calculates them (crime, pollution, land value, traffic, jobs) and which complaints in the yearly
  poll (where approval comes from) it eases or adds to. The game has no single "happiness" figure.
- **Undo after time has passed:** the game keeps a copy of the whole city from just before each of the last 20 builds
  (while the page is open). Undoing one built more than a month ago offers to go back to that moment (date, money and
  everything since; the city as it is now is saved first under Saved cities), or just to remove it with a refund.
- **Take Picture** shows the picture with Save picture (PNG) and Print (the old link opened a new tab, which the
  published page can't do). Print uses the browser's print dialog, if the page is allowed to open it.
- **Save** window: Export to a file (saves the city and offers a .json file to import elsewhere).
- **Zoom** in steps of 25% between 50% and 200% (plus 25% and 300%). The in-between sizes are made by shrinking the
  next larger enlarged tile set, so they stay sharp.

### v33: money you can read, automatic budgeting that copes, Rail and Highways bubbles

- **Under Funds:** "Next year" (the forecast: a full year's taxes minus running costs at today's rates) and "Last year"
  (what really happened). Neither counts building. Bug fix: the forecast left out the running costs of schools and
  colleges, so it looked better than it was.
- **Short of money in January:** the Budget window no longer opens by itself (automatic budgeting stays on unless the
  player switches it off). The game raises the tax one point (up to 10%), then funds services as far as the money
  goes, and says what it did; next January it tries the player's funding levels again. **Bankrupt** (game over) now
  means that even so, roads or police would get less than half their funding. Cities saved before v33 get automatic
  budgeting back on (until v33 a shortage switched it off for good).
- **Deficit alert:** after a run of deficit years (2 in a row on fast speed, 3 on normal, 5 on slow; then every 5 more),
  a banner like a disaster's, and fast speed drops to normal.
- **Rail bubble** (working depots, share of home zones they cover; map: depot circles, homes no depot covers, depots
  that don't work) and **Highways bubble** (highway tiles with little or no traffic, which cost 3x a road's upkeep;
  road drawbridges a highway bridge would keep open).
- History charts show the last 50 years; the highway and rail tile charts are gone (the road chart stays).
- The policy report now gives road **tiles** and, separately, road **upkeep units** (a highway tile counts 3, a jammed
  road 2, a bridge 5). Until v33 it called the upkeep units "road tiles".

### v32: game over, and a To do card that is really bubbles only

- **Bankrupt:** every January the city pays its services and running costs. If the money in the bank plus that year's
  taxes can't cover them at the funding levels set in the Budget window, the game is over (the 1989 game quietly cut
  services instead). A red banner warns, once a game year, as soon as the yearly balance means January's bills can't
  be paid.
- **Voted out:** two yearly polls in a row below 20% approval (once the city has 2,000 people). A banner warns after
  the first one.
- The game-over screen offers Go back in time, the start screen, or Keep playing without a grade (the grade shows a
  dash, and the city can no longer graduate).
- The To do card now shows only the status bubbles (and the opening tips in a city with no zones yet). In v30 the old
  advice list was still there under the bubbles, mostly hidden by the card's height. The detailed advice is in
  "What I did wrong".
- Opening guide: new sections on money, highways and trains, and the grade, graduation and game over; new pictures.
- Developer tests: `npm test` runs again (the Jest config is now an ES module). 160 of 162 tests pass; the 2 failures
  are in upstream micropolisJS's `Bounds` tests, which expect debug assertions that are switched off in this build.

### v31: city rating and graduation

- **Grade (A-F)** in the city box, from 0-100 points: approval in the yearly poll (up to 30), the status bubbles (up to
  40: green counts fully, orange half, red nothing), money (up to 15: surplus 15, deficit under $500 8, otherwise 0),
  and the game's own city score (up to 15). A from 85, B from 70, C from 55, D from 40. Click the grade for the parts,
  what pulls it down most, and the average of the last 10 years (a grade is recorded every January).
- **Graduation:** a city graduates when, in five Januaries in a row, approval is 65% or more (70% before v38), every bubble is green,
  last year had no deficit, and the population reaches the target. Targets: 1989 baseline 50,000 and libertarian
  50,000, conservative-populist 45,000, progressive 25,000 (in proportion to how big the test cities grew under each
  preset, never above the baseline); custom policies use the preset they started from. Medium difficulty: 80% of that,
  hard: 60%. A graduation screen appears once; you can keep playing.
- "What I did wrong" and its downloaded report include the grade, the 10-year average and the graduation checklist.
- The Policy Lab Opening Guide's numbers were measured again under the v30 traffic rule.

### v30: easier to read, more to build, and cars that turn back

Built on v29.3, merged with a side version of the Policy Lab made in October 2026 (its ideas are credited in the code).

- **Traffic (new rule):** a car never drives the same tile twice, and at a dead end or an open drawbridge it turns back
  to the last junction and tries another way. Backing up uses the trip four times as fast as driving forward (the 1989
  penalty), so long dead ends and many side stubs still make trips run out. In 1989 a car that hit a dead end gave up.
  Traffic is counted only on the route that reached its destination. All texts (Query, advice, report, map layers,
  "How the world works") say this now.
- **Ships** pass under highway bridges, rail bridges and power lines across the shipping channel, and stop or turn
  back where the way is blocked, instead of being wrecked there. (A ship is still wrecked if something is built on the
  water it is on, or a plane crashes into it.)
- **Undo and Redo:** undo works for roads, power lines and rail even after traffic or power changed their look; Redo
  (Ctrl+Y / Cmd+Shift+Z) builds again what was undone, if the tiles are still as the undo left them.
- **To do is bubbles only**, with new **Roads**, **Water**, **Schools** and (with disasters on) **Fire** bubbles.
  Clicking a bubble shows its map; Close hides it.
- **Zoning need:** each bar shows how many zones of its kind are in use, and how many are filling or stuck. Clicking a
  bar shows where that kind would grow and steps through the stuck zones, each with its reason on the map. Underneath:
  road per zone, jammed roads, rail and highway per 1,000 people.
- **Placement preview:** while placing a police or fire station the map shades the 8x8 squares its effect reaches (as
  the game spreads it); hospitals, water treatment plants, train depots, schools, colleges and big parks show their
  radius.
- **Schools ($1,500) and colleges ($5,000):** 3x3 buildings that need power. They serve homes within 16 and 32 tiles;
  over a few years schooling lowers crime (up to 20 points) and college brings more business (up to 13%). This is a
  game simplification, not a research estimate.
- **Bulldozer sizes** 1x1, 3x3 and 5x5 (one undo step).
- **City box:** power capacity in use, the city size with an icon and its population, and the next size up.
- **History charts:** approval on the population chart, and charts of road, highway and rail tiles.
- **Disasters:** a banner with what happened and a "Show me" button, and a large red frame on the map.

### v29.3: gentler traffic, and road that leads nowhere

- A road counts (and is drawn) as **heavy traffic** only from a traffic density of 224, not 192 as in 1989. Heavy
  traffic pollutes more and costs double upkeep. In a test city this cut jammed roads from about a third to about a
  tenth. The Traffic bubble turns orange at 15% jammed roads and red at 30% (was 5% and 15%); the report lists traffic
  from 25%.
- "What I did wrong" no longer lists every dead end. A dead end beside zones is fine. It now lists **road that leads to
  no zone** (stretches of dead-end road no building touches) and warns when a city has far more road than zones
  (more than 8 road tiles per zone, with over 80 road tiles).
- Trips can still go 90 road tiles. Tests of 30, 45, 60 and 90 were too noisy to show a clear gain from shortening them.

### v29.2: opening tips, report download, and a fix to "empty" homes

- A home zone with a few small houses on it was counted as empty (it still has the empty-zone marker in the middle).
  The Zoning need bars, "What I did wrong" and the "Where to zone" checks now count it as filling up, not empty.
- In a new city the To do card starts with opening tips for the chosen policies (power plant, 4-6 homes, 1-2 shops,
  2-3 factories, built compact), taken from the Policy Lab Opening Guide.
- "What I did wrong and what to do" has a **Download report** button (a .txt file, e.g. to hand in).

### Bug fix

v29: the 10-year and 120-year history counts read an undeclared `budget` (in the browser, the Budget window's page
element, so the money history was recorded as "not a number"; nothing displays it yet). They now read the city's budget.

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

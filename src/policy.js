/* Policy Lab additions to micropolisJS (2026).
 *
 * This code is released under the GNU GPL v3, with some additional terms, like the rest of micropolisJS.
 * Modified version: NOT the original micropolisJS / Micropolis.
 *
 * One place that holds:
 *   - THE WORLD (v29): how the world works in this game. Fixed, the same for every city and every preset (constants
 *     below; until v28 these were choices on the setup screen).
 *   - THE FIVE POLICY CHOICES made on the setup screen (laws, fixed for the whole game). The starting tax rate and
 *     social funding are set in the budget (see splashScreen.js); the player can change those during play.
 */

// ---- The world (v29: fixed) ----
// Crime: cheap land and crowding push it up; police, funded social services and parks push it down (blockMapUtils.js).
// Most crime points fully funded social services remove, on the cheapest land (half of it on mid-value land)
var SOCIAL_CRIME = 30;
// How far (in road tiles) people will travel on a trip; a linked train depot doubles it; highway tiles count a third.
// (30 in 1989.)
var TRIP_LIMIT = 90;
// Other parts of the world, all always on: taxes above 7% slow growth (valves.js); environmental rules change
// industrial growth and incentives attract business (valves.js); untreated sewage pollutes rivers (utilities.js);
// shops within walking distance, clean water and a hospital nearby raise land value (blockMapUtils.js); hospital
// access matters; each neighbourhood pays tax on its own land value (budget.js, amenities.js).

// ---- The five policy choices (v29) ----
var DEFAULTS = {
  // Energy and environment
  nuclearAllowed: true,
  // 'none' | 'relaxed' | 'standard' (original) | 'strict'
  regulation: 'standard',
  // Housing and zoning: highest residential density, 40 = no limit (original), 24 = medium at most
  densityCap: 40,
  // 'exclusive' (original, US-style: one use per zone) or 'mixed' (European-style: apartment blocks get ground-floor
  // shops)
  zoning: 'exclusive',
  // Transportation: 'roads' | 'balanced' (original) | 'transit'
  transport: 'balanced',
  // Business incentives: 'none' (original) | 'strong'
  incentives: 'none'
};

// How much industrial pollution is multiplied by under each regulation level
var REGULATION_POLLUTION = {none: 1.5, relaxed: 1.25, standard: 1, strict: 0.5};
// How much industrial growth is nudged under each regulation level.
// For scale: the original tax table moves growth by about 10-50 points per 1% of tax.
var REGULATION_GROWTH = {none: 40, relaxed: 20, standard: 0, strict: -80};

// Building and yearly maintenance costs (per tile) under each transportation priority. 'balanced' = original.
var TRANSPORT = {
  roads:    {road: 5,  rail: 30, roadMaintenance: 1, railMaintenance: 3},
  balanced: {road: 10, rail: 20, roadMaintenance: 1, railMaintenance: 2},
  transit:  {road: 15, rail: 10, roadMaintenance: 2, railMaintenance: 1}
};
// Business incentives: cost of a commercial/industrial zone, share of tax revenue the city keeps, and growth nudge.
var INCENTIVES = {
  none:   {zoneCost: 100, taxShare: 1,   growth: 0},
  strong: {zoneCost: 0,   taxShare: 0.8, growth: 60}
};

var Policy = Object.assign({}, DEFAULTS);
Policy.SOCIAL_CRIME = SOCIAL_CRIME;
Policy.TRIP_LIMIT = TRIP_LIMIT;
Policy.PARK_COST = 10;
Policy.BIG_PARK_COST = 150;
// Hospitals the player built (so the simulation never removes them), as "x,y" keys
Policy.builtHospitals = {};
// POLICY LAB v25: big parks the player built (their fountain in the middle), as "x,y" keys
Policy.bigParks = {};
// POLICY LAB v26: highway tiles, as "x,y" keys. A highway is an ordinary road tile on the map that is also listed here:
// trips go three times as far on it, it builds up half the congestion, costs 3x road upkeep, and its bridges never open.
Policy.highways = {};
// changes whenever the list changes (so the map redraws the highways)
Policy.highwaysVersion = 0;
// POLICY LAB v25: an identifier for the city (saved cities, the scoreboard and rewind snapshots belong to it)
Policy.cityId = null;
// Which preset the city's policies started from (for the report)
Policy.presetName = '1989 baseline';
// The city's history for the charts under Funds: monthly funds, population and tax rate, and each year's surplus or
// deficit (saved with the city)
Policy.history = {months: [], years: []};

Policy.DEFAULTS = DEFAULTS;

Policy.set = function(values) {
  Object.keys(DEFAULTS).forEach(function(key) {
    if (values && values[key] !== undefined)
      Policy[key] = values[key];
    else
      Policy[key] = DEFAULTS[key];
  });
  // v29: choices that no longer exist, in cities saved earlier
  if (!INCENTIVES[Policy.incentives])
    Policy.incentives = Policy.incentives === 'moderate' ? 'strong' : 'none';
  if (!REGULATION_POLLUTION[Policy.regulation])
    Policy.regulation = 'standard';
  if (!TRANSPORT[Policy.transport])
    Policy.transport = 'balanced';
  Policy.densityCap = Policy.densityCap >= 40 ? 40 : 24;
  if (Policy.zoning !== 'mixed')
    Policy.zoning = 'exclusive';
};

Policy.save = function(saveData) {
  var copy = {};
  Object.keys(DEFAULTS).forEach(function(key) { copy[key] = Policy[key]; });
  copy.builtHospitals = Policy.builtHospitals;
  copy.bigParks = Policy.bigParks;
  copy.highways = Policy.highways;
  copy.cityId = Policy.cityId;
  copy.presetName = Policy.presetName;
  copy.history = Policy.history;
  saveData.policyLab = copy;
};

Policy.load = function(saveData) {
  // v29: every city plays in the same world; older saves keep their policy choices (games saved before the Policy
  // Lab existed get the original ones). Settings that no longer exist are dropped.
  var extra = saveData.policyLab || {};
  Policy.set(extra);
  Policy.builtHospitals = extra.builtHospitals || {};
  Policy.bigParks = extra.bigParks || {};
  Policy.highways = extra.highways || {};
  Policy.highwaysVersion++;
  Policy.cityId = extra.cityId || null;
  Policy.presetName = extra.presetName || '1989 baseline';
  Policy.history = extra.history && extra.history.months ? extra.history : {months: [], years: []};
};

Policy.industrialPollutionFactor = function() {
  return REGULATION_POLLUTION[Policy.regulation] || 1;
};

Policy.industrialGrowthNudge = function() {
  return REGULATION_GROWTH[Policy.regulation] || 0;
};

Policy.transportCosts = function() {
  return TRANSPORT[Policy.transport] || TRANSPORT.balanced;
};

Policy.businessZoneCost = function() {
  return (INCENTIVES[Policy.incentives] || INCENTIVES.none).zoneCost;
};

Policy.taxShare = function() {
  return (INCENTIVES[Policy.incentives] || INCENTIVES.none).taxShare;
};

Policy.businessGrowthNudge = function() {
  return (INCENTIVES[Policy.incentives] || INCENTIVES.none).growth;
};

// POLICY LAB v26: highways
Policy.isHighway = function(x, y) {
  return Policy.highways[x + ',' + y] === true;
};

// What a highway costs on top of a road, per tile ($30 under the balanced transport law: $40 a tile in all)
Policy.highwayExtra = function() {
  return 3 * Policy.transportCosts().road;
};

Policy.setHighway = function(x, y, on) {
  var k = x + ',' + y;
  if (on)
    Policy.highways[k] = true;
  else
    delete Policy.highways[k];
  Policy.highwaysVersion++;
};


export { Policy };

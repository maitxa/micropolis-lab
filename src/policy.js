/* Policy Lab additions to micropolisJS (2026).
 *
 * This code is released under the GNU GPL v3, with some additional terms, like the rest of micropolisJS.
 * Modified version: NOT the original micropolisJS / Micropolis.
 *
 * One place that holds the choices made on the setup screen:
 *   - WORLD MODEL: assumptions about cause and effect (how the world works). Fixed for the whole game.
 *   - LAWS: structural policies chosen at the start. Fixed for the whole game.
 *   - BUDGET TIMING: whether the budget can be changed any time, or only in election years.
 *
 * The defaults reproduce the original 1989 SimCity rules exactly ("SimCity 1989" world, standard laws).
 */

var DEFAULTS = {
  // ---- World model ----
  // How strongly low land value ("poverty") pushes crime up. 1 = original, 0.5 = weakly, 0 = not at all.
  povertyCrime: 1,
  // Whether crowded neighbourhoods attract crime. 1 = yes (original), 0 = no.
  densityCrime: 1,
  // Multiplier on how much nearby police stations suppress crime. 1 = original.
  policeStrength: 1,
  // Maximum crime points removed by fully funded social services in the poorest areas.
  // 0 = social services do nothing (original game has none), 30 = somewhat, 60 = strongly.
  socialCrime: 0,
  // How strongly taxes above/below the default 7% slow/speed growth. 1 = original, 0.5 = weakly, 0 = not at all.
  taxGrowth: 1,
  // Whether environmental regulation changes industrial growth. 1 = yes, 0 = no.
  regulationGrowth: 1,
  // Whether business incentives attract commercial and industrial growth. 1 = yes, 0 = no.
  incentiveGrowth: 1,
  // Whether untreated sewage pollutes rivers (and the land along them). 0 = no (original game), 1 = yes.
  sewagePollution: 0,
  // Whether residents value having shops within walking distance (raises land value). 0 = no (original), 1 = yes.
  walkability: 0,
  // What drives residential growth: 'industry' (original: jobs, ultimately exports) or 'quality' (quality of life).
  growthModel: 'industry',
  // Whether access to a hospital affects where people want to live. 0 = no (original), 1 = yes.
  healthAffects: 0,

  // ---- Laws ----
  nuclearAllowed: true,
  // 'none' | 'standard' (original) | 'strict'
  regulation: 'standard',
  // Highest residential density allowed: 40 = no limit (original), 24 = medium, 8 = single houses only
  densityCap: 40,
  // 'roads' | 'balanced' (original) | 'transit'
  transport: 'balanced',
  // 'none' (original) | 'moderate' | 'strong'
  incentives: 'none',
  // 'standard' (original) | 'subsidized' | 'free'
  parks: 'standard',
  // Zoning principle: 'exclusive' (original, US-style: one use per zone) or 'mixed' (European-style "predominance":
  // apartment blocks get ground-floor shops)
  zoning: 'exclusive',
  // Car-free downtown: radius in tiles around the city centre (0 = none, original)
  pedestrian: 0,
  // Green belt: a protected ring of land around the city where nothing may be built. 0 = none (original), 1 = yes
  greenBelt: 0,

  // ---- Budget timing ----
  // 0 = change the budget any time (original). 4 = only in election years (every 4 years).
  electionCycle: 0
};

// How much industrial pollution is multiplied by under each regulation level
var REGULATION_POLLUTION = {none: 1.5, standard: 1, strict: 0.5};
// How much industrial growth is nudged under each regulation level (only if the world model says regulation matters).
// For scale: the original tax table moves growth by about 10-50 points per 1% of tax.
var REGULATION_GROWTH = {none: 40, standard: 0, strict: -80};

// Building and yearly maintenance costs (per tile) under each transportation priority. 'balanced' = original.
var TRANSPORT = {
  roads:    {road: 5,  rail: 30, roadMaintenance: 1, railMaintenance: 3},
  balanced: {road: 10, rail: 20, roadMaintenance: 1, railMaintenance: 2},
  transit:  {road: 15, rail: 10, roadMaintenance: 2, railMaintenance: 1}
};
// Business incentives: cost of a commercial/industrial zone, share of tax revenue the city keeps, and growth nudge
// (the nudge only applies if the world model says incentives attract business). 'none' = original.
var INCENTIVES = {
  none:     {zoneCost: 100, taxShare: 1,   growth: 0},
  moderate: {zoneCost: 50,  taxShare: 0.9, growth: 30},
  strong:   {zoneCost: 0,   taxShare: 0.8, growth: 60}
};
var PARK_COST = {standard: 10, subsidized: 5, free: 0};

// Green belt ring, in tiles from its centre (the centre of the map, where the city starts)
var GREEN_BELT_INNER = 28;
var GREEN_BELT_OUTER = 34;

var Policy = Object.assign({}, DEFAULTS);
Policy.GREEN_BELT_INNER = GREEN_BELT_INNER;
Policy.GREEN_BELT_OUTER = GREEN_BELT_OUTER;
// Centre of the green belt (set when a game starts; saved with the city)
Policy.greenBeltCentre = {x: 60, y: 50};
// Hospitals the player built (so the simulation never removes them), as "x,y" keys
Policy.builtHospitals = {};

Policy.DEFAULTS = DEFAULTS;

Policy.set = function(values) {
  Object.keys(DEFAULTS).forEach(function(key) {
    if (values && values[key] !== undefined)
      Policy[key] = values[key];
    else
      Policy[key] = DEFAULTS[key];
  });
};

Policy.save = function(saveData) {
  var copy = {};
  Object.keys(DEFAULTS).forEach(function(key) { copy[key] = Policy[key]; });
  copy.greenBeltCentre = Policy.greenBeltCentre;
  copy.builtHospitals = Policy.builtHospitals;
  saveData.policyLab = copy;
};

Policy.load = function(saveData) {
  // Games saved before the Policy Lab existed simply get the original rules
  Policy.set(saveData.policyLab);
  var extra = saveData.policyLab || {};
  Policy.greenBeltCentre = extra.greenBeltCentre || {x: 60, y: 50};
  Policy.builtHospitals = extra.builtHospitals || {};
};

// Is (x, y) inside the car-free downtown?
Policy.isCarFree = function(map, x, y) {
  if (!Policy.pedestrian)
    return false;
  var dx = x - map.cityCentreX, dy = y - map.cityCentreY;
  return dx * dx + dy * dy <= Policy.pedestrian * Policy.pedestrian;
};

// Is (x, y) inside the protected green belt?
Policy.inGreenBelt = function(x, y) {
  if (!Policy.greenBelt)
    return false;
  var dx = x - Policy.greenBeltCentre.x, dy = y - Policy.greenBeltCentre.y;
  var d2 = dx * dx + dy * dy;
  return d2 >= GREEN_BELT_INNER * GREEN_BELT_INNER && d2 <= GREEN_BELT_OUTER * GREEN_BELT_OUTER;
};

Policy.industrialPollutionFactor = function() {
  return REGULATION_POLLUTION[Policy.regulation] || 1;
};

Policy.industrialGrowthNudge = function() {
  return (REGULATION_GROWTH[Policy.regulation] || 0) * Policy.regulationGrowth;
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
  return (INCENTIVES[Policy.incentives] || INCENTIVES.none).growth * Policy.incentiveGrowth;
};

Policy.parkCost = function() {
  var c = PARK_COST[Policy.parks];
  return c === undefined ? 10 : c;
};

// Is this an election year (i.e. may the player change the budget)?
Policy.isBudgetYear = function(year) {
  if (!Policy.electionCycle)
    return true;
  return (year - 1900) % Policy.electionCycle === 0;
};

Policy.nextBudgetYear = function(year) {
  if (!Policy.electionCycle)
    return year;
  var y = year;
  while (!Policy.isBudgetYear(y))
    y++;
  return y;
};


export { Policy };

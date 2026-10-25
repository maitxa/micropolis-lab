/* Policy Lab additions to micropolisJS (2026).
 *
 * This code is released under the GNU GPL v3, with some additional terms, like the rest of micropolisJS.
 * Modified version: NOT the original micropolisJS / Micropolis.
 *
 * Help shown when hovering over a message in the message bar: why it happens (according to the simulation's
 * actual rules) and what the player can do about it.
 */

import * as Messages from './messages.ts';

var help = {};

var add = function(subject, why, fixes) {
  help[subject] = {why: why, fixes: fixes};
};

// ---- Demand and growth ----
add(Messages.NEED_MORE_RESIDENTIAL,
    'There are more jobs (commercial + industrial) than residents, so people want to move in.',
    ['Zone more Residential land, connected by road and powered.',
     'Put homes near water, trees or parks and away from pollution: they grow faster on valuable land.']);
add(Messages.NEED_MORE_COMMERCIAL,
    'Shops want to serve your population, and there is labour available.',
    ['Zone more Commercial land, preferably near the city centre (shops score higher there).',
     'Shops must be able to drive to customers: connect them by road to homes and industry.']);
add(Messages.NEED_MORE_INDUSTRIAL,
    'The outside market wants more of what your city produces, and there are workers available.',
    ['Zone more Industrial land, away from homes (factories pollute).',
     'Connect industry to residential areas by road or rail so workers can reach it.']);
add(Messages.NEED_MORE_ROADS,
    'Many zones have no road access. Zones without a road on their edge cannot grow and will shrink.',
    ['Run a road along at least one edge of every zone.',
     'Tip: click a starting tile, then Shift+click the end to draw a straight road.']);
add(Messages.NEED_MORE_RAILS,
    'Your city is large but has little rail.',
    ['Add rail lines between residential and job areas to share the load with roads.',
     'Under the "Transit" transportation law, rail is cheaper to build and maintain.']);
add(Messages.NEED_ELECTRICITY,
    'Zones grow only when they have power.',
    ['Build a Coal or Nuclear power plant (if nuclear is allowed by your laws).',
     'Connect it to zones with power lines (Wire tool). Zones touching each other pass power along.']);
add(Messages.NOT_ENOUGH_POWER,
    'Your power plants cannot supply all the zones connected to them, so some go dark and stop growing.',
    ['Build another power plant and connect it to the grid.',
     'Check for zones connected by a single long wire: a break anywhere cuts everything after it.']);
add(Messages.BLACKOUTS_REPORTED,
    'Demand for electricity is higher than your plants can produce.',
    ['Build another power plant.',
     'A coal plant pollutes; nuclear does not, but risks a meltdown.']);

// ---- Services ----
add(Messages.NEED_POLICE_STATION,
    'Your population is large enough that residents expect police coverage.',
    ['Build a Police station near dense or low-value neighbourhoods, where crime is highest.',
     'Fund police at 100% in the Budget window.']);
add(Messages.NEED_FIRE_STATION,
    'Your population is large enough that residents expect fire protection.',
    ['Build a Fire station; its coverage fades with distance, so spread them out.',
     'Fund fire at 100% in the Budget window.']);
add(Messages.POLICE_NEEDS_FUNDING,
    'Police are funded below 100%, so their stations suppress less crime.',
    ['Raise police funding in the Budget window (if the budget is open this year).']);
add(Messages.FIRE_STATION_NEEDS_FUNDING,
    'Fire departments are funded below 100%, so fires spread further before being put out.',
    ['Raise fire funding in the Budget window (if the budget is open this year).']);
add(Messages.ROAD_NEEDS_FUNDING,
    'Roads are funded below 100%, so some road tiles crumble each year.',
    ['Raise road funding in the Budget window.',
     'Fewer, better-planned roads cost less to maintain.']);
add(Messages.NEED_STADIUM,
    'Residential growth is capped until you build a stadium (population over 500).',
    ['Build a Stadium near residential areas. Until then, residential demand cannot rise above zero.']);
add(Messages.NEED_SEAPORT,
    'Industrial growth is capped until you build a seaport.',
    ['Build a Seaport on the shoreline, connected by road and power.']);
add(Messages.NEED_AIRPORT,
    'Commercial growth is capped until you build an airport.',
    ['Build an Airport (it needs a large flat area) connected by road and power.']);

// ---- Problems ----
add(Messages.HIGH_POLLUTION,
    'Pollution comes from industry, coal power plants, heavy traffic, fires and radiation. It lowers land value and drives residents away.',
    ['Keep industry and coal plants away from homes; leave trees or parks in between.',
     'Reduce traffic: more rail, better road layouts, homes closer to jobs.',
     'Policy Lab: strict environmental rules halve industrial pollution (at a cost to industrial growth, if the world model says so).',
     'Replace coal with nuclear power, if your laws allow it.']);
add(Messages.HIGH_CRIME,
    'Crime in this game rises on cheap land and in crowded areas, and falls near funded police stations (and, if the world model says so, with social services).',
    ['Build police stations in the worst areas and fund them fully.',
     'Raise land value: parks, trees and water nearby, less pollution.',
     'Policy Lab: fund Social services in the Budget window, if your world model says they work.']);
add(Messages.HEAVY_TRAFFIC,
    'Some roads are carrying a lot of traffic. Heavy traffic pollutes nearby land.',
    ['Add parallel roads or rail lines to spread the traffic.',
     'Put homes, shops and jobs closer together so trips are shorter.']);
add(Messages.TRAFFIC_JAMS,
    'Many roads are congested. Traffic pollution lowers land value along them.',
    ['Build rail between residential and job areas.',
     'Avoid funnelling the whole city through one road.']);
add(Messages.TAX_TOO_HIGH,
    'Taxes above 12% upset residents, and (in the original world model) higher taxes slow every kind of growth.',
    ['Lower the tax rate in the Budget window.',
     'Cut costs instead: fewer roads to maintain, services sized to need.']);
add(Messages.NO_MONEY,
    'Your city has spent all its money.',
    ['Lower spending in the Budget window (the game will ask you to revise it).',
     'Raise taxes a little, or let the city grow its tax base before building more.']);

// ---- Disasters ----
add(Messages.FIRE_REPORTED,
    'A fire has started. Without fire coverage it can spread.',
    ['Click the message to jump to the fire.',
     'Bulldoze a gap around it to stop it spreading; build fire stations to prevent future fires.']);
add(Messages.FLOODING_REPORTED,
    'Water has flooded land near the shore. Floods recede on their own after a while.',
    ['Wait it out, then rebuild. Avoid building right on the waterline.']);
add(Messages.TORNADO_SIGHTED,
    'A tornado is destroying buildings along its path. It will disappear on its own.',
    ['Rebuild afterwards. You can switch random disasters off in Settings.']);
add(Messages.MONSTER_SIGHTED,
    'A monster appears only when pollution is high, and goes for the most polluted areas.',
    ['Reduce pollution to stop it coming back. You can switch random disasters off in Settings.']);
add(Messages.EARTHQUAKE,
    'An earthquake has damaged the city.',
    ['Rebuild damaged areas and put out fires.']);
add(Messages.EXPLOSION_REPORTED,
    'Something exploded (often a crash or a fire).',
    ['Click to jump there, clear the rubble and rebuild.']);
add(Messages.NUCLEAR_MELTDOWN,
    'A nuclear plant melted down, leaving radioactive land that cannot be used for a very long time.',
    ['Build elsewhere. Policy Lab: you can ban nuclear power at setup if you would rather not take the risk.']);
add(Messages.PLANE_CRASHED, 'A plane crashed near the airport.', ['Clear the wreckage and rebuild.']);
add(Messages.SHIP_CRASHED, 'A ship was wrecked.', ['Nothing to do but clear up.']);
add(Messages.TRAIN_CRASHED, 'A train crashed.', ['Clear the wreckage and repair the rail.']);
add(Messages.HELICOPTER_CRASHED, 'A traffic helicopter crashed.', ['Clear the wreckage and rebuild.']);

// ---- Good news ----
var milestone = ['Well done! Bigger cities bring new demands (stadium, seaport, airport) and bigger problems.',
                 'Check the Evaluation window to see what residents worry about most.'];
add(Messages.REACHED_TOWN, 'Your population passed 2,000.', milestone);
add(Messages.REACHED_CITY, 'Your population passed 10,000.', milestone);
add(Messages.REACHED_CAPITAL, 'Your population passed 50,000.', milestone);
add(Messages.REACHED_METROPOLIS, 'Your population passed 100,000.', milestone);
add(Messages.REACHED_MEGALOPOLIS, 'Your population passed 500,000.', milestone);
add(Messages.WELCOME,
    'Start with a power plant, a few Residential, Commercial and Industrial zones, roads along their edges and power lines.',
    ['Watch the R/C/I bars (bottom left): they show what the city wants next.',
     'Keyboard: number keys pick tools, Shift+click draws straight lines, Ctrl+Z (Cmd+Z) undoes. Press ? for the list.']);


var Help = {
  forMessage: function(subject) {
    return help[subject] || null;
  }
};


export { Help };

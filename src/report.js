/* Policy Lab additions to micropolisJS (2026).
 *
 * This code is released under the GNU GPL v3, with some additional terms, like the rest of micropolisJS.
 * Modified version: NOT the original micropolisJS / Micropolis.
 *
 * Builds the "City data" window (indicators) and the "Your policies at work" section of the Evaluation window.
 * Everything here only READS the simulation; nothing changes the game.
 */

import { MiscUtils } from './miscUtils.js';
import { Policy } from './policy.js';
import { Text } from './text.js';

var fmt = MiscUtils.formatNumber;
var money = MiscUtils.formatMoney;

var esc = function(s) {
  return String(s).replace(/[&<>"]/g, function(c) {
    return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c];
  });
};

var pct = function(part, whole) {
  return whole > 0 ? Math.round(100 * part / whole) : 0;
};

// A small horizontal bar, 0-100%
var bar = function(percent, colour) {
  percent = MiscUtils.clamp(percent, 0, 100);
  return '<span class="dataBar"><span style="width:' + percent + '%;background:' + colour + '"></span></span>';
};

// Scores in the range 0-250 (land value, crime, pollution) use the game's own 4-step labels
var level = function(value, labels) {
  return labels[MiscUtils.clamp(Math.floor(value / 64), 0, 3)];
};

var demandLabel = function(valve, range) {
  var d = valve / range;
  if (d > 0.5) return 'Strong demand';
  if (d > 0.15) return 'Demand';
  if (d > -0.15) return 'Balanced';
  if (d > -0.5) return 'Surplus';
  return 'Large surplus';
};

var censusOf = function(sim) {
  return sim.lastCensus || sim._census.snapshot();
};


// ---------------------------------------------------------------------------------------------------------------
// City data window
// ---------------------------------------------------------------------------------------------------------------

var cityData = function(sim) {
  var c = censusOf(sim);
  var live = sim._census;
  var v = sim._valves;
  var b = sim.budget;
  var html = '';

  // Population units used by the original game: 1 residential unit = 20 people; 1 commercial or industrial unit =
  // 160 jobs (the game's own population formula: (res + (com + ind) * 8) * 20).
  var residents = c.resPop * 20;
  var comJobs = c.comPop * 160;
  var indJobs = c.indPop * 160;
  var resCap = c.resZonePop * Math.min(40, Policy.densityCap) * 20;
  var comCap = c.comZonePop * 5 * 160;
  var indCap = c.indZonePop * 4 * 160;

  html += '<h3>Zones</h3><table class="dataTable"><tr><th></th><th>Zones</th><th>Now</th><th>Room for</th>' +
          '<th>Occupancy</th><th>Demand</th></tr>';
  var row = function(name, colour, zones, now, cap, unit, demand) {
    var occ = pct(now, cap);
    return '<tr><td><span class="swatch" style="background:' + colour + '"></span>' + name + '</td><td>' + fmt(zones) +
           '</td><td>' + fmt(now) + ' ' + unit + '</td><td>' + fmt(cap) + '</td><td>' + bar(occ, colour) + ' ' + occ +
           '%</td><td>' + demand + '</td></tr>';
  };
  html += row('Residential', '#2ecc40', c.resZonePop, residents, resCap, 'people', demandLabel(v.resValve, 2000));
  html += row('Commercial', '#0074d9', c.comZonePop, comJobs, comCap, 'jobs', demandLabel(v.comValve, 1500));
  html += row('Industrial', '#e6c700', c.indZonePop, indJobs, indCap, 'jobs', demandLabel(v.indValve, 1500));
  html += '</table>';
  if (Policy.densityCap < 40)
    html += '<p class="dataNote">"Room for" reflects your housing density law (' +
            (Policy.densityCap === 8 ? 'single houses only' : 'medium density at most') + ').</p>';

  // Jobs and workers
  var jobs = comJobs + indJobs;
  html += '<h3>Jobs and workers</h3>';
  if (residents === 0) {
    html += '<p>No residents yet.</p>';
  } else {
    var ratio = jobs / residents;
    var verdict = ratio > 1.1 ? 'More jobs than residents: people will want to move in.' :
                  ratio < 0.9 ? 'More residents than jobs: unemployment, and people may leave.' :
                  'Jobs and residents are roughly in balance.';
    html += '<p><b>' + ratio.toFixed(2) + '</b> jobs per resident (' + fmt(jobs) + ' jobs, ' + fmt(residents) +
            ' residents). ' + verdict + '</p>';
  }

  // Quality of the city
  html += '<h3>Neighbourhoods (city averages)</h3><table class="dataTable">';
  var q = function(name, value, labels, colour, goodHigh) {
    return '<tr><td>' + name + '</td><td>' + bar(value / 2.5, colour) + '</td><td>' + esc(level(value, labels)) +
           '</td><td class="dataNote">' + (goodHigh ? 'higher is better' : 'lower is better') + '</td></tr>';
  };
  html += q('Land value', live.landValueAverage, Text.landValueStrings, '#8e6c3a', true);
  html += q('Crime', live.crimeAverage, Text.crimeStrings, '#c0392b', false);
  html += q('Pollution', live.pollutionAverage, Text.pollutionStrings, '#7f8c8d', false);
  var traffic = live.trafficAverage || 0;
  html += '<tr><td>Traffic</td><td>' + bar(traffic / 2.4, '#e67e22') + '</td><td>' +
          (traffic < 60 ? 'Light' : traffic < 120 ? 'Moderate' : traffic < 180 ? 'Heavy' : 'Jammed') +
          '</td><td class="dataNote">lower is better</td></tr>';
  html += '</table>';

  // Power and services
  var zones = c.poweredZoneCount + c.unpoweredZoneCount;
  html += '<h3>Power and services</h3><ul class="dataList">';
  html += '<li>Zones with power: <b>' + fmt(c.poweredZoneCount) + ' of ' + fmt(zones) + '</b> (' +
          pct(c.poweredZoneCount, zones) + '%)' + ' &middot; plants: ' + fmt(c.coalPowerPop) + ' coal, ' +
          fmt(c.nuclearPowerPop) + ' nuclear</li>';
  html += '<li>Police stations: <b>' + fmt(c.policeStationPop) + '</b> &middot; Fire stations: <b>' +
          fmt(c.fireStationPop) + '</b> &middot; Hospitals: ' + fmt(c.hospitalPop) + '</li>';
  html += '<li>Stadium: ' + (c.stadiumPop ? 'yes' : 'no') + ' &middot; Seaport: ' + (c.seaportPop ? 'yes' : 'no') +
          ' &middot; Airport: ' + (c.airportPop ? 'yes' : 'no') + '</li>';
  html += '<li>Road tiles: ' + fmt(c.roadTotal) + ' &middot; Rail tiles: ' + fmt(c.railTotal) + '</li>';
  html += '</ul>';

  // Money
  html += '<h3>Money (last tax year)</h3><ul class="dataList">';
  html += '<li>Funds: <b>' + money(b.totalFunds) + '</b> &middot; Taxes collected: ' + money(b.taxFund) +
          ' at ' + b.cityTax + '%</li>';
  html += '<li>Spending: roads ' + money(b.roadSpend) + ', police ' + money(b.policeSpend) + ', fire ' +
          money(b.fireSpend) + ', social services ' + money(b.socialSpend || 0) + '</li>';
  html += '</ul>';

  return html;
};


// ---------------------------------------------------------------------------------------------------------------
// "Your policies at work" (Evaluation window)
// ---------------------------------------------------------------------------------------------------------------

// Plain-language description of the world model, listing only what differs from the 1989 original
var worldModelSummary = function() {
  var d = Policy.DEFAULTS, out = [];
  var words = {0: 'not at all', 0.5: 'weakly', 1: 'strongly'};
  if (Policy.povertyCrime !== d.povertyCrime) out.push('poverty drives crime ' + words[Policy.povertyCrime]);
  if (Policy.densityCrime !== d.densityCrime) out.push('density does not drive crime');
  if (Policy.policeStrength !== d.policeStrength)
    out.push('police are ' + (Policy.policeStrength > 1 ? 'more' : 'less') + ' effective than in the original');
  if (Policy.socialCrime !== d.socialCrime)
    out.push('social services reduce crime ' + (Policy.socialCrime >= 60 ? 'strongly' : 'somewhat'));
  if (Policy.taxGrowth !== d.taxGrowth) out.push('high taxes slow growth ' + words[Policy.taxGrowth]);
  if (Policy.regulationGrowth !== d.regulationGrowth) out.push('regulation does not affect industry');
  if (Policy.incentiveGrowth !== d.incentiveGrowth) out.push('business incentives do not attract business');
  return out;
};

var policyReport = function(sim) {
  var c = censusOf(sim);
  var live = sim._census;
  var b = sim.budget;
  var v = sim._valves;
  var items = [];
  var add = function(title, text) {
    items.push('<li><b>' + esc(title) + '.</b> ' + text + '</li>');
  };

  // World model
  var wm = worldModelSummary();
  add('Your world', wm.length === 0 ? 'The original SimCity 1989 rules.' :
      'Original 1989 rules, except: ' + esc(wm.join('; ')) + '.');

  // Crime
  var p = live.crimeParts;
  if (p && (c.resZonePop + c.comZonePop + c.indZonePop) > 0) {
    var crimeText = 'Average crime is <b>' + esc(level(live.crimeAverage, Text.crimeStrings)) + '</b> (' +
                    fmt(live.crimeAverage) + ' of 250). In a typical neighbourhood: ';
    var parts = [];
    parts.push((p.poverty >= 0 ? 'cheap land adds ' : 'valuable land removes ') + fmt(Math.abs(p.poverty)));
    if (Policy.densityCrime) parts.push('crowding adds ' + fmt(p.density));
    parts.push('police remove ' + fmt(p.police));
    if (Policy.socialCrime) parts.push('social services remove ' + fmt(p.social));
    crimeText += esc(parts.join(', ')) + ' points.';
    if (live.crimeAverage < 64) {
      crimeText += ' Crime is not a problem yet.';
    } else {
      var levers = [];
      if (c.policeStationPop === 0)
        levers.push('build a police station (you have none)');
      else if (p.police < Math.max(p.poverty, p.density))
        levers.push('add police stations where crime is highest, and fund them fully');
      if (p.poverty >= p.density || !Policy.densityCrime)
        levers.push('raise land value: parks, trees and water nearby, less pollution');
      else
        levers.push('ease crowding (the housing density law can cap it)');
      if (Policy.socialCrime > 0)
        levers.push('fund social services');
      crimeText += ' What would help most: ' + esc(levers.join('; ')) + '.';
    }
    add('Crime', crimeText);
  }

  // Taxes
  if (v.lastTaxEffect !== undefined) {
    var diff = v.lastTaxEffect - v.lastDefaultTaxEffect;
    var taxText = 'Tax rate ' + b.cityTax + '%. ';
    if (Policy.taxGrowth === 0)
      taxText += 'In your world model taxes do not change growth, so a higher rate is pure extra revenue.';
    else if (b.cityTax === 7)
      taxText += 'That is the neutral rate: it neither speeds up nor slows down growth.';
    else
      taxText += 'Compared with 7%, it is ' + (diff < 0 ? '<b>slowing</b>' : '<b>speeding up</b>') + ' growth of all zones' +
                 (Math.abs(diff) >= 100 ? ' a lot' : Math.abs(diff) >= 30 ? ' noticeably' : ' a little') + '.';
    if (b.cityTax > 12)
      taxText += ' Above 12% residents complain.';
    add('Taxes', taxText);
  }

  // Business incentives
  if (Policy.incentives !== 'none') {
    add('Business incentives', 'Commercial and industrial zones cost ' + money(Policy.businessZoneCost()) +
        ', and tax breaks cost the city <b>' + money(b.taxBreakCost || 0) + '</b> in revenue last year. ' +
        (Policy.incentiveGrowth ? 'In your world model they do attract business (extra commercial and industrial demand).'
                                : 'In your world model they do <b>not</b> attract business: they only cost money.'));
  }

  // Social services
  var socialPct = Math.round((b.socialPercent || 0) * 100);
  if (socialPct > 0 || Policy.socialCrime > 0) {
    add('Social services', 'Funded at ' + socialPct + '% (' + money(b.socialSpend || 0) + ' last year). ' +
        (b.socialMaintenanceBudget === 0 ? 'There is no population to serve yet.' :
         Policy.socialCrime > 0 ? (socialPct > 0 ? 'They are reducing crime, mostly in the poorest neighbourhoods.'
                                                 : 'Your world model says they would reduce crime, but they are not funded.')
                                : 'In your world model they do not affect crime, so this money buys nothing measurable in the game.'));
  }

  // Pollution and environmental rules
  var src = live.pollutionSources;
  if (src) {
    var total = src.traffic + src.industry + src.power + src.other;
    if (total > 0) {
      var polText = 'Average pollution is <b>' + esc(level(live.pollutionAverage, Text.pollutionStrings)) +
                    '</b>. Sources: industry ' + pct(src.industry, total) + '%, power plants ' + pct(src.power, total) +
                    '%, traffic ' + pct(src.traffic, total) + '%, other ' + pct(src.other, total) + '%. ';
      if (Policy.regulation === 'strict')
        polText += 'Your strict environmental rules halve industrial pollution' +
                   (Policy.regulationGrowth ? ', at the cost of slower industrial growth.' : '.');
      else if (Policy.regulation === 'none')
        polText += 'With no environmental rules, industry pollutes 50% more' +
                   (Policy.regulationGrowth ? ' (in exchange for faster industrial growth).' : '.');
      else
        polText += 'Standard environmental rules (as in the original).';
      add('Pollution', polText);
    }
  }

  // Transportation
  var tc = Policy.transportCosts();
  add('Transportation', 'Law: ' + esc(Policy.transport) + ' (road ' + money(tc.road) + ', rail ' + money(tc.rail) +
      ' per tile). You have ' + fmt(c.roadTotal) + ' road and ' + fmt(c.railTotal) + ' rail tiles, costing ' +
      money(b.roadMaintenanceBudget) + ' a year to maintain fully.');

  // Housing density
  if (Policy.densityCap < 40)
    add('Housing density', 'Your law caps housing at ' + (Policy.densityCap === 8 ? 'single houses' : 'medium density') +
        '. Residential zones have room for ' + fmt(c.resZonePop * Policy.densityCap * 20) + ' people; ' +
        'denser housing is not allowed, which also keeps crowding-related crime lower' +
        (Policy.densityCrime ? '.' : ' (though in your world model density does not cause crime).'));

  // Power
  add('Energy', 'Nuclear power is ' + (Policy.nuclearAllowed ? 'allowed' : '<b>banned</b>') + '. You have ' +
      fmt(c.coalPowerPop) + ' coal and ' + fmt(c.nuclearPowerPop) + ' nuclear plant(s)' +
      (c.coalPowerPop > 0 ? '; coal plants are a major source of pollution.' : '.'));

  // Parks
  if (Policy.parks !== 'standard')
    add('Parks', 'Parks cost ' + money(Policy.parkCost()) + ' each under your law. Trees and parks near homes raise land value.');

  // Budget timing
  if (Policy.electionCycle) {
    var year = sim.getDate().year;
    add('Budget timing', Policy.isBudgetYear(year) ? 'This is an election year: the budget is open.'
                                                   : 'The budget is locked until the next election in ' +
                                                     Policy.nextBudgetYear(year) + '.');
  }

  return '<ul class="policyReport">' + items.join('') + '</ul>';
};


var Report = {
  cityData: cityData,
  policyReport: policyReport
};


export { Report };

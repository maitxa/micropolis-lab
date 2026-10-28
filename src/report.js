/* Policy Lab additions to micropolisJS (2026).
 *
 * This code is released under the GNU GPL v3, with some additional terms, like the rest of micropolisJS.
 * Modified version: NOT the original micropolisJS / Micropolis.
 *
 * Builds the "City data" window (indicators) and the "Your policies at work" section of the Evaluation window.
 * Everything here only READS the simulation; nothing changes the game.
 *
 * Each sentence is written in English and Spanish (U.S.) side by side: P('English {0}', 'Español {0}', value).
 */

import { I18n } from './i18n.js';
import { MiscUtils } from './miscUtils.js';
import { Policy } from './policy.js';
import { Text } from './text.js';
import { Utilities } from './utilities.js';

var fmt = MiscUtils.formatNumber;
var money = MiscUtils.formatMoney;
var P = I18n.p;

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
  if (d > 0.5) return P('Strong demand', 'Mucha demanda');
  if (d > 0.15) return P('Demand', 'Demanda');
  if (d > -0.15) return P('Balanced', 'Equilibrio');
  if (d > -0.5) return P('Surplus', 'Exceso');
  return P('Large surplus', 'Gran exceso');
};

var censusOf = function(sim) {
  return sim.lastCensus || sim._census.snapshot();
};

var yesNo = function(x) {
  return x ? P('yes', 'sí') : P('no', 'no');
};

// The name of the preset the city started from (stored in English in saved games)
var presetLabel = function(name) {
  name = name || 'Original 1989 rules';
  var m = /^Custom \(starting from (.*)\)$/.exec(name);
  if (m)
    return I18n.t('Custom (starting from {0})', I18n.t(m[1]));
  return I18n.t(name);
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
  var comCap = c.comZonePop * 5 * 160 + (c.mixedZones || 0) * 160;  // ground-floor shops count as commercial space
  var indCap = c.indZonePop * 4 * 160;

  html += '<h3>' + P('Zones', 'Zonas') + '</h3><table class="dataTable"><tr><th></th><th>' + P('Zones', 'Zonas') +
          '</th><th>' + P('Now', 'Ahora') + '</th><th>' + P('Room for', 'Capacidad') + '</th><th>' +
          P('Occupancy', 'Ocupación') + '</th><th>' + P('Demand', 'Demanda') + '</th></tr>';
  var row = function(name, colour, zones, now, cap, unit, demand) {
    var occ = pct(now, cap);
    return '<tr><td><span class="swatch" style="background:' + colour + '"></span>' + name + '</td><td>' + fmt(zones) +
           '</td><td>' + fmt(now) + ' ' + unit + '</td><td>' + fmt(cap) + '</td><td>' + bar(occ, colour) + ' ' + occ +
           '%</td><td>' + demand + '</td></tr>';
  };
  html += row(P('Residential', 'Residencial'), '#2ecc40', c.resZonePop, residents, resCap, P('people', 'personas'),
              demandLabel(v.resValve, 2000));
  html += row(P('Commercial', 'Comercial'), '#0074d9', c.comZonePop, comJobs, comCap, P('jobs', 'empleos'),
              demandLabel(v.comValve, 1500));
  if (c.mixedZones)
    html += '<tr><td colspan="6" class="dataNote">' +
            P('Commercial jobs include {0} in ground-floor shops of {1} mixed-use apartment block(s).',
              'Los empleos comerciales incluyen {0} en tiendas de planta baja de {1} edificio(s) de uso mixto.',
              fmt(c.mixedZones * 160), fmt(c.mixedZones)) + '</td></tr>';
  html += row(P('Industrial', 'Industrial'), '#e6c700', c.indZonePop, indJobs, indCap, P('jobs', 'empleos'),
              demandLabel(v.indValve, 1500));
  html += '</table>';
  if (Policy.densityCap < 40)
    html += '<p class="dataNote">' +
            P('"Room for" reflects your housing density law ({0}).', 'La "capacidad" refleja tu ley de densidad de vivienda ({0}).',
              Policy.densityCap === 8 ? P('single houses only', 'solo casas unifamiliares')
                                      : P('medium density at most', 'densidad media como máximo')) + '</p>';

  // Jobs and workers
  var jobs = comJobs + indJobs;
  html += '<h3>' + P('Jobs and workers', 'Empleo y trabajadores') + '</h3>';
  if (residents === 0) {
    html += '<p>' + P('No residents yet.', 'Todavía no hay residentes.') + '</p>';
  } else {
    var ratio = jobs / residents;
    var verdict = ratio > 1.1 ? P('More jobs than residents: people will want to move in.',
                                  'Más empleos que residentes: la gente va a querer mudarse aquí.') :
                  ratio < 0.9 ? P('More residents than jobs: unemployment, and people may leave.',
                                  'Más residentes que empleos: hay desempleo y la gente puede irse.') :
                  P('Jobs and residents are roughly in balance.', 'Empleos y residentes están más o menos en equilibrio.');
    html += '<p>' + P('<b>{0}</b> jobs per resident ({1} jobs, {2} residents).',
                      '<b>{0}</b> empleos por residente ({1} empleos, {2} residentes).',
                      ratio.toFixed(2), fmt(jobs), fmt(residents)) + ' ' + verdict + '</p>';
  }

  // Quality of the city
  html += '<h3>' + P('Neighbourhoods (city averages)', 'Vecindarios (promedios de la ciudad)') + '</h3><table class="dataTable">';
  var better = function(goodHigh) {
    return goodHigh ? P('higher is better', 'más es mejor') : P('lower is better', 'menos es mejor');
  };
  var q = function(name, value, labels, colour, goodHigh) {
    return '<tr><td>' + name + '</td><td>' + bar(value / 2.5, colour) + '</td><td>' + esc(level(value, labels)) +
           '</td><td class="dataNote">' + better(goodHigh) + '</td></tr>';
  };
  html += q(P('Land value', 'Valor del suelo'), live.landValueAverage, Text.L('landValueStrings'), '#8e6c3a', true);
  // POLICY LAB v25: the land value the city taxes, when each neighbourhood pays on its own value
  if (Policy.taxByValue && live.taxLandValue !== undefined)
    html += '<tr><td>' + P('Taxed land value', 'Valor del suelo gravado') + '</td><td>' + bar(live.taxLandValue / 2.5, '#8e6c3a') +
            '</td><td>' + fmt(live.taxLandValue) + ' / 250</td><td class="dataNote">' +
            P('weighted by where people live and work (city-wide average: {0})', 'ponderado según dónde vive y trabaja la gente (promedio de la ciudad: {0})',
              fmt(live.landValueAverage)) + '</td></tr>';
  html += q(P('Crime', 'Delincuencia'), live.crimeAverage, Text.L('crimeStrings'), '#c0392b', false);
  html += q(P('Pollution', 'Contaminación'), live.pollutionAverage, Text.L('pollutionStrings'), '#7f8c8d', false);
  var traffic = live.trafficAverage || 0;
  html += '<tr><td>' + P('Traffic', 'Tráfico') + '</td><td>' + bar(traffic / 2.4, '#e67e22') + '</td><td>' +
          (traffic < 60 ? P('Light', 'Ligero') : traffic < 120 ? P('Moderate', 'Moderado') :
           traffic < 180 ? P('Heavy', 'Intenso') : P('Jammed', 'Embotellado')) +
          '</td><td class="dataNote">' + better(false) + '</td></tr>';
  html += '</table>';

  // Power and services
  var zones = c.poweredZoneCount + c.unpoweredZoneCount;
  html += '<h3>' + P('Power and services', 'Electricidad y servicios') + '</h3><ul class="dataList">';
  html += '<li>' + P('Zones with power: <b>{0} of {1}</b> ({2}%) &middot; plants: {3} coal, {4} nuclear',
                     'Zonas con electricidad: <b>{0} de {1}</b> ({2}%) &middot; plantas: {3} de carbón, {4} nucleares',
                     fmt(c.poweredZoneCount), fmt(zones), pct(c.poweredZoneCount, zones), fmt(c.coalPowerPop),
                     fmt(c.nuclearPowerPop)) + '</li>';
  var healthCov = c.resZonePop > 0 ? Math.round(100 * (c.healthCoveredZones || 0) / c.resZonePop) : 0;
  html += '<li>' + P('Police stations: <b>{0}</b> &middot; Fire stations: <b>{1}</b> &middot; Hospitals: {2} (homes within reach: {3}%)',
                     'Estaciones de policía: <b>{0}</b> &middot; Estaciones de bomberos: <b>{1}</b> &middot; Hospitales: {2} (viviendas con acceso: {3}%)',
                     fmt(c.policeStationPop), fmt(c.fireStationPop), fmt(c.hospitalPop), healthCov) + '</li>';
  html += '<li>' + P('Stadium: {0} &middot; Seaport: {1} &middot; Airport: {2}', 'Estadio: {0} &middot; Puerto: {1} &middot; Aeropuerto: {2}',
                     yesNo(c.stadiumPop), yesNo(c.seaportPop), yesNo(c.airportPop)) + '</li>';
  html += '<li>' + P('Road tiles: {0} &middot; Rail tiles: {1} &middot; Train depots: {2}',
                     'Casillas de calle: {0} &middot; Casillas de vía férrea: {1} &middot; Estaciones de tren: {2}',
                     fmt(c.roadTotal), fmt(c.railTotal), fmt(c.depotPop || 0)) +
          (c.depotUnconnected ? ' ' + P('({0} not touching rail)', '({0} sin tocar la vía)', fmt(c.depotUnconnected)) : '') +
          (c.depotUnlinked ? ' ' + P('({0} with a line that goes nowhere)', '({0} con una vía que no lleva a ninguna parte)', fmt(c.depotUnlinked)) : '') +
          '</li>';
  var treated = live.sewageTreatedZones || 0, untreated = live.sewageUntreatedZones || 0;
  html += '<li>' + P('Water treatment plants: {0}', 'Plantas de tratamiento de aguas: {0}', fmt(c.waterPlantPop || 0)) +
          (c.waterPlantUnpowered ? ' ' + P('({0} without power)', '({0} sin electricidad)', fmt(c.waterPlantUnpowered)) : '') +
          ' &middot; ' + P('zones with treated sewage: <b>{0} of {1}</b>', 'zonas con aguas residuales tratadas: <b>{0} de {1}</b>',
                           fmt(treated), fmt(treated + untreated)) + '</li>';
  html += '</ul>';

  // Money
  html += '<h3>' + P('Money (last tax year)', 'Dinero (último año fiscal)') + '</h3><ul class="dataList">';
  html += '<li>' + P('Funds: <b>{0}</b> &middot; Taxes collected: {1} at {2}%',
                     'Fondos: <b>{0}</b> &middot; Impuestos recaudados: {1} al {2}%',
                     money(b.totalFunds), money(b.taxFund), b.cityTax) + '</li>';
  html += '<li>' + P('Spending: roads {0}, police {1}, fire {2}, social services {3}, social housing {4}, depots, water plants and city hospitals {5}',
                     'Gastos: calles {0}, policía {1}, bomberos {2}, servicios sociales {3}, vivienda social {4}, estaciones de tren, plantas de agua y hospitales municipales {5}',
                     money(b.roadSpend), money(b.policeSpend), money(b.fireSpend), money(b.socialSpend || 0),
                     money(b.housingSpend || 0), money(b.utilityCost || 0)) + '</li>';
  html += '</ul>';

  return html;
};


// ---------------------------------------------------------------------------------------------------------------
// "Your policies at work" (Evaluation window)
// ---------------------------------------------------------------------------------------------------------------

// Plain-language description of the world model, listing only what differs from the 1989 original
var worldModelSummary = function() {
  var d = Policy.ORIGINAL, out = [];
  var words = {0: P('not at all', 'nada'), 0.5: P('weakly', 'poco'), 1: P('strongly', 'mucho')};
  if (Policy.povertyCrime !== d.povertyCrime)
    out.push(P('poverty drives crime {0}', 'la pobreza genera delincuencia: {0}', words[Policy.povertyCrime]));
  if (Policy.densityCrime !== d.densityCrime)
    out.push(P('density does not drive crime', 'la densidad no genera delincuencia'));
  if (Policy.policeStrength !== d.policeStrength)
    out.push(Policy.policeStrength > 1 ? P('police are more effective than in the original', 'la policía es más eficaz que en el original')
                                       : P('police are less effective than in the original', 'la policía es menos eficaz que en el original'));
  if (Policy.socialCrime !== d.socialCrime)
    out.push(Policy.socialCrime >= 60 ? P('social services reduce crime strongly', 'los servicios sociales reducen mucho la delincuencia')
                                      : P('social services reduce crime somewhat', 'los servicios sociales reducen algo la delincuencia'));
  if (Policy.taxGrowth !== d.taxGrowth)
    out.push(P('high taxes slow growth {0}', 'los impuestos altos frenan el crecimiento: {0}', words[Policy.taxGrowth]));
  if (Policy.regulationGrowth !== d.regulationGrowth)
    out.push(P('regulation does not affect industry', 'la regulación no afecta a la industria'));
  if (Policy.incentiveGrowth !== d.incentiveGrowth)
    out.push(P('business incentives do not attract business', 'los incentivos a las empresas no atraen empresas'));
  if (Policy.sewagePollution !== d.sewagePollution)
    out.push(P('untreated sewage pollutes rivers', 'las aguas residuales sin tratar contaminan los ríos'));
  if (Policy.growthModel !== d.growthModel)
    out.push(P('people move for quality of life, and jobs follow people',
               'la gente se muda por la calidad de vida, y el empleo sigue a la gente'));
  if (Policy.walkability !== d.walkability)
    out.push(P('residents value shops within walking distance', 'los residentes valoran tener tiendas a poca distancia a pie'));
  if (Policy.healthAffects !== d.healthAffects)
    out.push(P('access to a hospital affects where people live', 'el acceso a un hospital influye en dónde vive la gente'));
  if (Policy.parksCrime !== d.parksCrime)
    out.push(P('parks reduce crime nearby', 'los parques reducen la delincuencia cercana'));
  if (Policy.waterfront !== d.waterfront)
    out.push(P('people pay more to live near water', 'la gente paga más por vivir cerca del agua'));
  if (Policy.taxByValue !== d.taxByValue)
    out.push(P('each neighbourhood pays tax on its own land value', 'cada barrio paga impuestos según el valor de su propio suelo'));
  if (Policy.commute !== d.commute)
    out.push(P('people travel up to {0} road tiles (the original: 30)', 'la gente viaja hasta {0} casillas de calle (el original: 30)', Policy.commute));
  return out;
};

var transportName = function(law) {
  return {roads: P('roads', 'calles'), balanced: P('balanced', 'equilibrada'), transit: P('transit', 'transporte público')}[law] || law;
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
  add(P('Your world', 'Tu mundo'), wm.length === 0 ? P('The original SimCity 1989 rules.', 'Las reglas originales de SimCity de 1989.') :
      P('Original 1989 rules, except: {0}.', 'Reglas originales de 1989, salvo que: {0}.', esc(wm.join('; '))));
  add(P('Starting policies', 'Políticas iniciales'),
      P('This city began with the policies of: <b>{0}</b>. (The world works the same way for every preset.)',
        'Esta ciudad empezó con las políticas de: <b>{0}</b>. (El mundo funciona igual para todos los perfiles).',
        esc(presetLabel(Policy.presetName))));

  // Crime
  var p = live.crimeParts;
  if (p && (c.resZonePop + c.comZonePop + c.indZonePop) > 0) {
    var crimeText = P('Average crime is <b>{0}</b> ({1} of 250). In a typical neighbourhood: ',
                      'La delincuencia promedio es <b>{0}</b> ({1} de 250). En un vecindario típico: ',
                      esc(level(live.crimeAverage, Text.L('crimeStrings'))), fmt(live.crimeAverage));
    var parts = [];
    parts.push(p.poverty >= 0 ? P('cheap land adds {0}', 'el suelo barato suma {0}', fmt(p.poverty))
                              : P('valuable land removes {0}', 'el suelo valioso resta {0}', fmt(-p.poverty)));
    if (Policy.densityCrime) parts.push(P('crowding adds {0}', 'el hacinamiento suma {0}', fmt(p.density)));
    parts.push(P('police remove {0}', 'la policía resta {0}', fmt(p.police)));
    if (Policy.socialCrime) parts.push(P('social services remove {0}', 'los servicios sociales restan {0}', fmt(p.social)));
    if (Policy.parksCrime) parts.push(P('parks remove {0}', 'los parques restan {0}', fmt(p.parks || 0)));
    crimeText += esc(parts.join(', ')) + ' ' + P('points.', 'puntos.');
    if (live.crimeAverage < 64) {
      crimeText += ' ' + P('Crime is not a problem yet.', 'La delincuencia todavía no es un problema.');
    } else {
      var levers = [];
      if (c.policeStationPop === 0)
        levers.push(P('build a police station (you have none)', 'construir una estación de policía (no tienes ninguna)'));
      else if (p.police < Math.max(p.poverty, p.density))
        levers.push(P('add police stations where crime is highest, and fund them fully',
                      'añadir estaciones de policía donde hay más delincuencia y financiarlas al 100%'));
      if (p.poverty >= p.density || !Policy.densityCrime)
        levers.push(P('raise land value: parks, trees and water nearby, less pollution',
                      'subir el valor del suelo: parques, árboles y agua cerca, menos contaminación'));
      else
        levers.push(P('ease crowding (the housing density law can cap it)',
                      'reducir el hacinamiento (la ley de densidad de vivienda puede limitarlo)'));
      if (Policy.socialCrime > 0)
        levers.push(P('fund social services', 'financiar los servicios sociales'));
      if (Policy.parksCrime)
        levers.push(P('build big parks (key G) in the worst neighbourhoods', 'construir parques grandes (tecla G) en los peores barrios'));
      crimeText += ' ' + P('What would help most: {0}.', 'Lo que más ayudaría: {0}.', esc(levers.join('; ')));
    }
    add(P('Crime', 'Delincuencia'), crimeText);
  }

  // Taxes
  if (v.lastTaxEffect !== undefined) {
    var diff = v.lastTaxEffect - v.lastDefaultTaxEffect;
    var taxText = P('Tax rate {0}%. ', 'Tasa de impuestos: {0}%. ', b.cityTax);
    if (Policy.taxGrowth === 0) {
      taxText += P('In your world model taxes do not change growth, so a higher rate is pure extra revenue.',
                   'En tu modelo del mundo los impuestos no cambian el crecimiento, así que una tasa más alta es solo más ingreso.');
    } else if (b.cityTax === 7) {
      taxText += P('That is the neutral rate: it neither speeds up nor slows down growth.',
                   'Es la tasa neutral: ni acelera ni frena el crecimiento.');
    } else {
      var amount = Math.abs(diff) >= 100 ? P(' a lot', ' mucho') : Math.abs(diff) >= 30 ? P(' noticeably', ' bastante')
                                                                                         : P(' a little', ' un poco');
      taxText += diff < 0 ? P('Compared with 7%, it is <b>slowing</b> growth of all zones{0}.',
                              'Comparada con el 7%, está <b>frenando</b>{0} el crecimiento de todas las zonas.', amount)
                          : P('Compared with 7%, it is <b>speeding up</b> growth of all zones{0}.',
                              'Comparada con el 7%, está <b>acelerando</b>{0} el crecimiento de todas las zonas.', amount);
    }
    if (b.cityTax > 12)
      taxText += ' ' + P('Above 12% residents complain.', 'Por encima del 12%, los residentes se quejan.');
    add(P('Taxes', 'Impuestos'), taxText);
  }

  // Business incentives
  if (Policy.incentives !== 'none') {
    add(P('Business incentives', 'Incentivos a las empresas'),
        P('Commercial and industrial zones cost {0}, and tax breaks cost the city <b>{1}</b> in revenue last year. ',
          'Las zonas comerciales e industriales cuestan {0}, y las exenciones fiscales le costaron a la ciudad <b>{1}</b> en ingresos el año pasado. ',
          money(Policy.businessZoneCost()), money(b.taxBreakCost || 0)) +
        (Policy.incentiveGrowth ? P('In your world model they do attract business (extra commercial and industrial demand).',
                                    'En tu modelo del mundo sí atraen empresas (más demanda comercial e industrial).')
                                : P('In your world model they do <b>not</b> attract business: they only cost money.',
                                    'En tu modelo del mundo <b>no</b> atraen empresas: solo cuestan dinero.')));
  }

  // Social services
  var socialPct = Math.round((b.socialPercent || 0) * 100);
  if (socialPct > 0 || Policy.socialCrime > 0) {
    add(P('Social services', 'Servicios sociales'),
        P('Funded at {0}% ({1} last year). ', 'Financiados al {0}% ({1} el año pasado). ', socialPct, money(b.socialSpend || 0)) +
        (b.socialMaintenanceBudget === 0 ? P('There is no population to serve yet.', 'Todavía no hay población a la que atender.') :
         Policy.socialCrime > 0 ? (socialPct > 0 ? P('They are reducing crime, mostly in the poorest neighbourhoods.',
                                                     'Están reduciendo la delincuencia, sobre todo en los vecindarios más pobres.')
                                                 : P('Your world model says they would reduce crime, but they are not funded.',
                                                     'Tu modelo del mundo dice que reducirían la delincuencia, pero no tienen fondos.'))
                                : P('In your world model they do not affect crime, so this money buys nothing measurable in the game.',
                                    'En tu modelo del mundo no afectan a la delincuencia, así que este dinero no compra nada medible en el juego.')));
  }

  // Pollution and environmental rules
  var src = live.pollutionSources;
  if (src) {
    var total = src.traffic + src.industry + src.power + (src.sewage || 0) + src.other;
    if (total > 0) {
      var polText = P('Average pollution is <b>{0}</b>. Sources: industry {1}%, power plants {2}%, traffic {3}%, ',
                      'La contaminación promedio es <b>{0}</b>. Fuentes: industria {1}%, plantas eléctricas {2}%, tráfico {3}%, ',
                      esc(level(live.pollutionAverage, Text.L('pollutionStrings'))), pct(src.industry, total),
                      pct(src.power, total), pct(src.traffic, total)) +
                    (Policy.sewagePollution ? P('sewage in rivers {0}%, ', 'aguas residuales en los ríos {0}%, ',
                                                pct(src.sewage || 0, total)) : '') +
                    P('other {0}%. ', 'otras {0}%. ', pct(src.other, total));
      if (Policy.regulation === 'strict')
        polText += Policy.regulationGrowth ? P('Your strict environmental rules halve industrial pollution, at the cost of slower industrial growth.',
                                               'Tus normas ambientales estrictas reducen a la mitad la contaminación industrial, a cambio de un crecimiento industrial más lento.')
                                           : P('Your strict environmental rules halve industrial pollution.',
                                               'Tus normas ambientales estrictas reducen a la mitad la contaminación industrial.');
      else if (Policy.regulation === 'none')
        polText += Policy.regulationGrowth ? P('With no environmental rules, industry pollutes 50% more (in exchange for faster industrial growth).',
                                               'Sin normas ambientales, la industria contamina un 50% más (a cambio de un crecimiento industrial más rápido).')
                                           : P('With no environmental rules, industry pollutes 50% more.',
                                               'Sin normas ambientales, la industria contamina un 50% más.');
      else if (Policy.regulation === 'relaxed')
        polText += P('Your relaxed environmental rules let industry pollute 25% more, in exchange for slightly faster industrial growth.',
                     'Tus normas ambientales relajadas dejan que la industria contamine un 25% más, a cambio de un crecimiento industrial algo más rápido.');
      else
        polText += P('Standard environmental rules (as in the original).', 'Normas ambientales estándar (como en el original).');
      add(P('Pollution', 'Contaminación'), polText);
    }
  }

  // Transportation
  var tc = Policy.transportCosts();
  add(P('Transportation', 'Transporte'),
      P('Law: {0} (road {1}, rail {2} per tile). You have {3} road and {4} rail tiles, costing {5} a year to maintain fully.',
        'Ley: {0} (calle {1}, vía férrea {2} por casilla). Tienes {3} casillas de calle y {4} de vía férrea, que cuestan {5} al año para mantenerlas al 100%.',
        esc(transportName(Policy.transport)), money(tc.road), money(tc.rail), fmt(c.roadTotal), fmt(c.railTotal),
        money(b.roadMaintenanceBudget)));

  // Zoning and walkability
  if (Policy.zoning === 'mixed')
    add(P('Zoning', 'Zonificación'),
        P('Mixed use (European-style). {0} apartment block(s) have ground-floor shops: each adds some jobs, and half the time their residents walk to the shops instead of driving.',
          'Uso mixto (al estilo europeo). {0} edificio(s) de apartamentos tienen tiendas en la planta baja: cada uno suma algunos empleos, y la mitad de las veces sus residentes van a las tiendas a pie en vez de en carro.',
          fmt(c.mixedZones || 0)));
  if (Policy.walkability)
    add(P('Walkability', 'Caminabilidad'),
        P('In your world model, neighbourhoods within walking distance of shops gain land value. ',
          'En tu modelo del mundo, los vecindarios con tiendas a poca distancia a pie ganan valor del suelo. ') +
        (Policy.zoning === 'mixed' ? P('Mixed-use blocks count as shops for their immediate surroundings.',
                                       'Los edificios de uso mixto cuentan como tiendas para sus alrededores inmediatos.')
                                   : P('With separate-use zoning, only commercial zones provide this.',
                                       'Con zonificación de usos separados, solo las zonas comerciales dan este beneficio.')));

  // Social housing
  var housingPct = Math.round((b.housingPercent || 0) * 100);
  if (housingPct > 0)
    add(P('Social housing', 'Vivienda social'),
        P('Funded at {0}% ({1} last year). It keeps lower-value neighbourhoods from emptying out: {2} decline(s) prevented in the last scan of the city.',
          'Financiada al {0}% ({1} el año pasado). Evita que se vacíen los vecindarios de menor valor: {2} deterioro(s) evitado(s) en la última revisión de la ciudad.',
          housingPct, money(b.housingSpend || 0), fmt(c.housingSaves || 0)));

  // Hospitals
  if (c.hospitalPop || Policy.healthAffects) {
    var cov = c.resZonePop > 0 ? Math.round(100 * (c.healthCoveredZones || 0) / c.resZonePop) : 0;
    var builtH = c.builtHospitalPop || 0, autoH = (c.hospitalPop || 0) - builtH;
    var hParts = [];
    if (builtH)
      hParts.push(P('{0} built by the city at {1} a year each', '{0} construido(s) por la ciudad, a {1} al año cada uno',
                    fmt(builtH), money(Utilities.HOSPITAL_MAINTENANCE)));
    if (autoH)
      hParts.push(P('{0} that appeared on their own, as in the original game', '{0} que surgieron por sí solos, como en el juego original',
                    fmt(autoH)));
    add(P('Healthcare', 'Salud'),
        P('Hospitals: {0}', 'Hospitales: {0}', fmt(c.hospitalPop || 0)) + (hParts.length ? ' (' + hParts.join('; ') + ')' : '') + '. ' +
        P('{0}% of residential zones are within reach of a powered hospital. ',
          'El {0}% de las zonas residenciales tiene acceso a un hospital con electricidad. ', cov) +
        (Policy.healthAffects ? (Policy.growthModel === 'quality'
                                  ? P('In your world model this raises land value nearby and makes the city more attractive.',
                                      'En tu modelo del mundo esto sube el valor del suelo cercano y hace la ciudad más atractiva.')
                                  : P('In your world model this raises land value nearby.',
                                      'En tu modelo del mundo esto sube el valor del suelo cercano.'))
                              : P('In the original world model hospitals do not affect growth.',
                                  'En el modelo del mundo original, los hospitales no afectan al crecimiento.')));
  }

  // Car-free downtown and green belt
  if (Policy.pedestrian)
    add(P('Car-free downtown', 'Centro sin carros'),
        P('Within {0} tiles of the city centre (orange circle on the map; it moves as the city grows), three quarters of trips are on foot or by public transport and produce no road traffic or traffic pollution. Cars cannot drive through it, so connect the centre by rail and train depots.',
          'A menos de {0} casillas del centro (el círculo naranja del mapa, que se mueve a medida que crece la ciudad), tres de cada cuatro viajes son a pie o en transporte público y no generan tráfico ni contaminación por tráfico. Los carros no pueden cruzarlo, así que conecta el centro con vías férreas y estaciones de tren.',
          Policy.pedestrian));
  if (Policy.greenBelt)
    add(P('Green belt', 'Cinturón verde'),
        P('Nothing can be built, and no trees cleared, in the protected ring (green on the map). Roads, rail and power lines may cross it. The woods keep land value up nearby and stop the city sprawling outward.',
          'En el anillo protegido (verde en el mapa) no se puede construir nada ni talar árboles. Las calles, las vías férreas y los cables eléctricos sí pueden cruzarlo. El bosque mantiene alto el valor del suelo cercano y frena la expansión de la ciudad hacia afuera.'));

  // Growth model
  if (v.lastLivability !== undefined) {
    var L = v.lastLivability;
    var lText = P('Livability index: <b>{0}</b> (from -1 to +1; based on land value, crime and pollution{1}). ',
                  'Índice de habitabilidad: <b>{0}</b> (de -1 a +1; según el valor del suelo, la delincuencia y la contaminación{1}). ',
                  (L >= 0 ? '+' : '') + L.toFixed(2),
                  Policy.healthAffects ? P(', and hospital access', ', y el acceso a hospitales') : '');
    if (Policy.growthModel === 'quality')
      lText += P('In your world model this drives 60% of migration (jobs the other 40%): ',
                 'En tu modelo del mundo esto explica el 60% de la migración (el empleo, el otro 40%): ') +
               (L > 0.1 ? P('the city is attracting people.', 'la ciudad está atrayendo gente.') :
                L < -0.1 ? P('the city is putting people off.', 'la ciudad está ahuyentando a la gente.') :
                P('roughly neutral.', 'más o menos neutral.')) +
               ' ' + P('(The 60/40 split is a Policy Lab assumption.)', '(La proporción 60/40 es un supuesto del Laboratorio de Políticas).');
    else
      lText += P('In the original world model it does not affect migration: only jobs do.',
                 'En el modelo del mundo original no afecta a la migración: solo el empleo la afecta.');
    add(P('What brings people here', 'Qué atrae a la gente'), lText);
  }

  // Train depots
  if (c.depotPop) {
    add(P('Trains', 'Trenes'),
        P('You have {0} train depot(s)', 'Tienes {0} estación(es) de tren', fmt(c.depotPop)) +
        (c.depotUnconnected ? P(', of which {0} do not touch a rail line and so do nothing',
                                ', de las cuales {0} no tocan una vía férrea y por eso no sirven de nada', fmt(c.depotUnconnected)) : '') +
        (c.depotUnlinked ? P('; {0} have a line that goes nowhere (no other depot, no loop back), so their trains have no route',
                             '; {0} tienen una vía que no lleva a ninguna parte (ni otra estación ni un circuito de vuelta), así que sus trenes no tienen ruta', fmt(c.depotUnlinked)) : '') +
        P('. A depot works when its rail reaches another depot, or loops back so the train can turn around (at least 16 rail tiles). Zones within 16 tiles of a working depot can commute twice as far, and only half of their traffic goes on the roads. Running cost: {0} per depot per year.',
          '. Una estación funciona cuando su vía llega a otra estación, o da la vuelta para que el tren pueda regresar (al menos 16 casillas de vía). Las zonas a menos de 16 casillas de una estación que funcione pueden viajar el doble de lejos, y solo la mitad de su tráfico va por las calles. Costo de funcionamiento: {0} por estación al año.',
          money(50)));
  }

  // Water and sewage
  var tr = live.sewageTreatedZones || 0, un = live.sewageUntreatedZones || 0;
  if (Policy.sewagePollution || c.waterPlantPop) {
    var wText = P('{0} of {1} zones have their sewage treated ({2} treatment plant(s)',
                  '{0} de {1} zonas tienen sus aguas residuales tratadas ({2} planta(s) de tratamiento',
                  fmt(tr), fmt(tr + un), fmt(c.waterPlantPop || 0)) +
                (c.waterPlantUnpowered ? P(', {0} without power', ', {0} sin electricidad', fmt(c.waterPlantUnpowered)) : '') + '). ';
    if (Policy.sewagePollution)
      wText += (live.sewageToRiverZones ? P('<b>{0} zones send raw sewage into the nearest water</b>, polluting it and the banks around it (and spoiling the view for nearby homes). ',
                                            '<b>{0} zonas echan aguas residuales sin tratar al agua más cercana</b>, contaminándola junto con sus orillas (y arruinando la vista de las viviendas cercanas). ',
                                            fmt(live.sewageToRiverZones))
                                        : P('No raw sewage is reaching the water. ', 'No llegan aguas residuales sin tratar al agua. ')) +
               P('Each treatment plant needs power and serves zones within about 24 tiles.',
                 'Cada planta de tratamiento necesita electricidad y atiende a las zonas a unas 24 casillas.');
    else
      wText += P('In your world model untreated sewage does not pollute rivers, so treatment plants only cost money.',
                 'En tu modelo del mundo las aguas residuales sin tratar no contaminan los ríos, así que las plantas de tratamiento solo cuestan dinero.');
    add(P('Water and sewage', 'Agua y aguas residuales'), wText);
  }

  // Housing density
  if (Policy.densityCap < 40)
    add(P('Housing density', 'Densidad de vivienda'),
        P('Your law caps housing at {0}. Residential zones have room for {1} people; denser housing is not allowed, which also keeps crowding-related crime lower',
          'Tu ley limita la vivienda a {0}. Las zonas residenciales tienen capacidad para {1} personas; no se permite vivienda más densa, lo que también mantiene más baja la delincuencia por hacinamiento',
          Policy.densityCap === 8 ? P('single houses', 'casas unifamiliares') : P('medium density', 'densidad media'),
          fmt(c.resZonePop * Policy.densityCap * 20)) +
        (Policy.densityCrime ? '.' : P(' (though in your world model density does not cause crime).',
                                       ' (aunque en tu modelo del mundo la densidad no causa delincuencia).')));

  // Power
  add(P('Energy', 'Energía'),
      (Policy.nuclearAllowed ? P('Nuclear power is allowed. ', 'La energía nuclear está permitida. ')
                             : P('Nuclear power is <b>banned</b>. ', 'La energía nuclear está <b>prohibida</b>. ')) +
      P('You have {0} coal and {1} nuclear plant(s)', 'Tienes {0} planta(s) de carbón y {1} nuclear(es)',
        fmt(c.coalPowerPop), fmt(c.nuclearPowerPop)) +
      (c.coalPowerPop > 0 ? P('; coal plants are a major source of pollution.', '; las plantas de carbón son una fuente importante de contaminación.')
                          : '.'));

  // Bridges
  if (Policy.bridges === 'fixed')
    add(P('Bridges', 'Puentes'),
        P('Fixed high bridges: road bridges over the shipping channel never open, so traffic is never cut off and ships pass underneath. (In the original, drawbridges open for ships and sometimes at random, and while open the road is a dead end.)',
          'Puentes altos fijos: los puentes sobre el canal de navegación nunca se abren, así que el tráfico nunca se corta y los barcos pasan por debajo. (En el original, los puentes levadizos se abren para los barcos y a veces al azar, y mientras están abiertos la calle es un callejón sin salida.)'));

  // Parks
  if (Policy.parks !== 'standard')
    add(P('Parks', 'Parques'),
        P('Parks cost {0} each under your law. Trees and parks near homes raise land value.',
          'Con tu ley, cada parque cuesta {0}. Los árboles y los parques cerca de las viviendas suben el valor del suelo.',
          money(Policy.parkCost())));

  // Budget timing
  if (Policy.electionCycle) {
    var year = sim.getDate().year;
    add(P('Budget timing', 'Calendario del presupuesto'),
        Policy.isBudgetYear(year) ? P('This is an election year: the budget is open.', 'Este es un año electoral: el presupuesto está abierto.')
                                  : P('The budget is locked until the next election in {0}.',
                                      'El presupuesto está bloqueado hasta las próximas elecciones, en {0}.', Policy.nextBudgetYear(year)));
  }

  return '<ul class="policyReport">' + items.join('') + '</ul>';
};


var Report = {
  cityData: cityData,
  policyReport: policyReport,
  presetLabel: presetLabel
};


export { Report };

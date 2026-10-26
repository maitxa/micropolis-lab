/* Policy Lab additions to micropolisJS (2026).
 *
 * This code is released under the GNU GPL v3, with some additional terms, like the rest of micropolisJS.
 * Modified version: NOT the original micropolisJS / Micropolis.
 *
 * City status bubbles (top of the To do card): Pollution, Crime, Traffic, Power, Jobs and Taxes, each marked
 * urgent (red), watch (orange) or good (green).
 *
 * A note on "rates": the 1989 model has no crimes per 1,000 residents or pollution in micrograms. It gives every 2x2
 * neighbourhood a score from 0 to 250 for crime and for pollution. So the figures here are:
 *  - the share of residents who live in neighbourhoods where the score is high (the same "Heavy" / "Moderate" and
 *    worse levels the Query tool shows), which is the closest the model gets to a rate, and
 *  - the average score where people live, on a 0-100 scale.
 * The game's own "average pollution" only averages neighbourhoods that have some pollution, so a single smokestack in
 * a clean city reads as high; counting residents avoids that.
 *
 * Only READS the simulation.
 */

import { I18n } from './i18n.js';
import { MiscUtils } from './miscUtils.js';
import { Residential } from './residential.js';
import { TileUtils } from './tileUtils.js';
import * as TileValues from './tileValues.ts';

var P = I18n.p;
var fmt = MiscUtils.formatNumber;

var HIGH = 128;  // score at which the Query tool says "Heavy" pollution or "Moderate" crime (levels 2 and 3 of 0-3)
var MID = 64;    // "Moderate" pollution / "Light" crime

var pct = function(x) {
  if (x > 0 && x < 0.01)
    return '<1%';
  return Math.round(x * 100) + '%';
};
var score100 = function(v) { return Math.round(v / 2.5); };  // 0-250 -> 0-100

// Everything the bubbles need, from the map and the census
var measure = function(sim) {
  var map = sim._map, bm = sim.blockMaps;
  var c = sim.lastCensus || sim._census.snapshot();
  var live = sim._census;
  var m = {residents: 0, polHigh: 0, polMid: 0, polSum: 0, crimeHigh: 0, crimeSum: 0,
           roads: 0, light: 0, heavy: 0};
  for (var x = 0; x < map.width; x++) {
    for (var y = 0; y < map.height; y++) {
      var tile = map.getTile(x, y);
      var v = tile.getValue();
      if (v >= TileValues.ROADBASE && v <= TileValues.LASTROAD && TileUtils.isRoad(v)) {
        m.roads++;
        if (v >= TileValues.HTRFBASE) m.heavy++;
        else if (v >= TileValues.LTRFBASE) m.light++;
        continue;
      }
      if (!tile.isZone() || !TileUtils.isResidential(v))
        continue;
      var pop = Residential.getZonePopulation(map, x, y, v);
      if (!pop)
        continue;
      var pol = bm.pollutionDensityMap.worldGet(x, y), cr = bm.crimeRateMap.worldGet(x, y);
      m.residents += pop;
      m.polSum += pol * pop;
      m.crimeSum += cr * pop;
      if (pol >= HIGH) m.polHigh += pop;
      if (pol >= MID) m.polMid += pop;
      if (cr >= HIGH) m.crimeHigh += pop;
    }
  }
  var r = m.residents || 1;
  var jobs = (c.comPop + c.indPop) * 8;   // the game's own comparison (evaluation.js, getUnemployment)
  var ratio = jobs > 0 ? c.resPop / jobs : null;
  var zones = (c.poweredZoneCount || 0) + (c.unpoweredZoneCount || 0);
  return {
    people: m.residents * 20,  // the game shows population as zone population x 20
    hasHomes: m.residents > 0,
    polHigh: m.polHigh / r, polMid: m.polMid / r, polAvg: m.polSum / r,
    crimeHigh: m.crimeHigh / r, crimeAvg: m.crimeSum / r,
    roads: m.roads, heavy: m.roads ? m.heavy / m.roads : 0, light: m.roads ? m.light / m.roads : 0,
    trafficAverage: live.trafficAverage || 0,
    zones: zones, powered: zones ? (c.poweredZoneCount || 0) / zones : 1,
    plants: (c.coalPowerPop || 0) + (c.nuclearPowerPop || 0),
    resPop: c.resPop, jobs: jobs, ratio: ratio,
    unemployed: ratio !== null && ratio > 1 ? 1 - 1 / ratio : 0,
    unfilled: ratio !== null && ratio < 1 ? 1 - ratio : 0,
    tax: sim.budget.cityTax,
    policeStations: c.policeStationPop || 0
  };
};

// The number kept in the city's history for each bubble, to show the trend
var keyFigures = function(m) {
  return {pollution: m.polHigh, crime: m.crimeHigh, traffic: m.heavy, power: m.powered, jobs: m.unemployed, tax: m.tax};
};

// Find the record from about a year ago that has these figures
var yearAgo = function(history) {
  var months = (history && history.months) || [];
  if (months.length < 13)
    return null;
  var last = months[months.length - 1];
  for (var i = months.length - 2; i >= 0; i--) {
    var q = months[i];
    if ((last.y - q.y) * 12 + (last.m - q.m) >= 12)
      return q.st ? q : null;
  }
  return null;
};

var trendLine = function(id, now, before, asPct) {
  if (!before || before.st[id] === undefined)
    return null;
  var b = before.st[id];
  var show = asPct ? pct : function(x) { return x + '%'; };
  var same = asPct ? Math.abs(now - b) < 0.02 : now === b;
  var arrow = same ? '→' : now > b ? '↑' : '↓';
  return P('A year ago: {0} {1} now {2}', 'Hace un año: {0} {1} ahora {2}', show(b), arrow, show(now));
};

var level = function(urgent, watch) { return urgent ? 'urgent' : watch ? 'watch' : 'good'; };

var compute = function(sim, history) {
  var m = measure(sim);
  var before = yearAgo(history);
  var out = [];
  var push = function(s) { out.push(s); };

  // ---- Pollution
  if (!m.hasHomes) {
    push({id: 'pollution', name: P('Pollution', 'Contaminación'), level: 'good', value: '',
          summary: P('No one lives in the city yet.', 'Todavía no vive nadie en la ciudad.'), lines: [], layer: 'pollution'});
  } else {
    push({id: 'pollution', name: P('Pollution', 'Contaminación'), level: level(m.polHigh >= 0.25, m.polHigh >= 0.10 || m.polMid >= 0.5),
          value: pct(m.polHigh),
          summary: P('{0} of residents live in heavy pollution', '{0} de los residentes viven con contaminación fuerte', pct(m.polHigh)),
          lines: [P('Residents in heavy or very heavy pollution: {0}', 'Residentes con contaminación fuerte o muy fuerte: {0}', pct(m.polHigh)),
                  P('In moderate pollution or worse: {0}', 'Con contaminación moderada o peor: {0}', pct(m.polMid)),
                  P('Average where people live: {0} out of 100', 'Promedio donde vive la gente: {0} de 100', score100(m.polAvg)),
                  trendLine('pollution', m.polHigh, before, true)],
          why: P('Pollution comes from factories, coal plants, airports, seaports and busy roads, and spreads to the neighbourhoods around them. It lowers land value, and homes in very heavy pollution stop growing.',
                 'La contaminación viene de las fábricas, plantas de carbón, aeropuertos, puertos y calles con mucho tráfico, y se extiende a los barrios de alrededor. Baja el valor del suelo, y las viviendas con contaminación muy fuerte dejan de crecer.'),
          fixes: [P('Keep factories and coal plants away from homes; leave parks or trees in between.',
                    'Mantén las fábricas y las plantas de carbón lejos de las viviendas; deja parques o árboles entre medio.'),
                  P('Ease traffic near homes with rail and train depots.', 'Alivia el tráfico cerca de las viviendas con vías y estaciones de tren.')],
          layer: 'pollution'});
  }

  // ---- Crime
  if (!m.hasHomes) {
    push({id: 'crime', name: P('Crime', 'Delincuencia'), level: 'good', value: '',
          summary: P('No one lives in the city yet.', 'Todavía no vive nadie en la ciudad.'), lines: [], layer: 'crime'});
  } else {
    var crimeFixes = [P('Build police stations where it is worst, and fund them fully.',
                        'Construye estaciones de policía donde es peor, y dales todos los fondos.'),
                      P('Raise land value with parks, and keep pollution away from homes.',
                        'Sube el valor del suelo con parques, y mantén la contaminación lejos de las viviendas.')];
    push({id: 'crime', name: P('Crime', 'Delincuencia'), level: level(m.crimeHigh >= 0.25, m.crimeHigh >= 0.10),
          value: pct(m.crimeHigh),
          summary: P('{0} of residents live where crime is moderate or worse', '{0} de los residentes viven donde la delincuencia es moderada o peor', pct(m.crimeHigh)),
          lines: [P('Residents where crime is moderate or dangerous: {0}', 'Residentes donde la delincuencia es moderada o peligrosa: {0}', pct(m.crimeHigh)),
                  P('Average where people live: {0} out of 100', 'Promedio donde vive la gente: {0} de 100', score100(m.crimeAvg)),
                  P('Police stations: {0}', 'Estaciones de policía: {0}', fmt(m.policeStations)),
                  trendLine('crime', m.crimeHigh, before, true)],
          why: P('In this game crime is a score for each neighbourhood, not a count of crimes. It rises on cheap land and in crowded areas and falls near funded police (how much depends on the world model you chose).',
                 'En este juego la delincuencia es una puntuación de cada barrio, no un conteo de delitos. Sube en suelo barato y en zonas abarrotadas y baja cerca de policía con fondos (cuánto depende del modelo del mundo que elegiste).'),
          fixes: crimeFixes, layer: 'crime'});
  }

  // ---- Traffic
  var trafficUrgent = m.trafficAverage > 60 || m.heavy >= 0.15;   // 60: the original game's "Traffic jams" alert
  push({id: 'traffic', name: P('Traffic', 'Tráfico'), level: m.roads ? level(trafficUrgent, m.heavy >= 0.05) : 'good',
        value: m.roads ? pct(m.heavy) : '',
        summary: m.roads ? P('{0} of road tiles have heavy traffic', '{0} de las casillas de calle tienen tráfico intenso', pct(m.heavy))
                         : P('No roads yet.', 'Todavía no hay calles.'),
        lines: m.roads ? [P('Road tiles with heavy traffic: {0}', 'Casillas de calle con tráfico intenso: {0}', pct(m.heavy)),
                          P('With light traffic: {0}', 'Con tráfico ligero: {0}', pct(m.light)),
                          trendLine('traffic', m.heavy, before, true)] : [],
        why: P('Every zone sends cars along the roads. Busy roads add pollution and lower land value around them.',
               'Cada zona envía carros por las calles. Las calles con mucho tráfico añaden contaminación y bajan el valor del suelo a su alrededor.'),
        fixes: [P('Add rail and train depots (two or more, linked by rail).', 'Añade vías y estaciones de tren (dos o más, unidas por vías).'),
                P('Build a parallel road, or put jobs closer to homes.', 'Construye una calle paralela, o pon los empleos más cerca de las viviendas.')],
        layer: 'traffic'});

  // ---- Power
  var noPlant = m.zones > 0 && m.plants === 0;
  push({id: 'power', name: P('Power', 'Electricidad'), level: m.zones ? level(noPlant || m.powered < 0.7, m.powered < 1) : 'good',
        value: m.zones ? pct(m.powered) : '',
        summary: noPlant ? P('There is no power plant.', 'No hay ninguna planta eléctrica.')
                         : m.zones ? P('{0} of zones have power', '{0} de las zonas tienen electricidad', pct(m.powered))
                                   : P('No zones yet.', 'Todavía no hay zonas.'),
        lines: m.zones ? [P('Zones with power: {0}', 'Zonas con electricidad: {0}', pct(m.powered)),
                          P('Power plants: {0}', 'Plantas eléctricas: {0}', fmt(m.plants)),
                          trendLine('power', m.powered, before, true)] : [],
        why: P('Zones only grow with power. Below 70% the original game reports blackouts.',
               'Las zonas solo crecen con electricidad. Por debajo del 70% el juego original informa de apagones.'),
        fixes: [P('Connect zones to a power plant with power lines (zones touching each other pass power along).',
                  'Conecta las zonas a una planta con cables (las zonas que se tocan se pasan la electricidad).'),
                P('If every zone is wired but some still have none, build another plant: this one is at capacity.',
                  'Si todas las zonas están conectadas y algunas siguen sin electricidad, construye otra planta: esta está al límite.')],
        layer: 'power'});

  // ---- Jobs
  var jobsSummary, jobsLines = [], jobsLevel = 'good', jobsValue = '';
  if (m.ratio === null || !m.resPop) {
    jobsSummary = P('Not enough people or jobs yet to compare.', 'Todavía no hay suficientes personas o empleos para comparar.');
  } else if (m.unemployed > 0) {
    jobsLevel = level(m.unemployed >= 0.25, m.unemployed >= 0.10);
    jobsValue = pct(m.unemployed);
    jobsSummary = P('About {0} of residents have no job', 'Aproximadamente el {0} de los residentes no tiene empleo', pct(m.unemployed));
    jobsLines = [jobsSummary, trendLine('jobs', m.unemployed, before, true)];
  } else {
    jobsLevel = level(false, m.unfilled >= 0.5);
    jobsValue = pct(0);
    jobsSummary = m.unfilled >= 0.5 ? P('Everyone has a job, but about {0} of jobs have no worker', 'Todos tienen empleo, pero aproximadamente el {0} de los empleos no tiene trabajador', pct(m.unfilled))
                                     : P('Everyone who wants a job has one', 'Todos los que buscan empleo lo tienen');
    jobsLines = [jobsSummary];
  }
  push({id: 'jobs', name: P('Jobs', 'Empleo'), level: jobsLevel, value: jobsValue, summary: jobsSummary, lines: jobsLines,
        why: P('This is the game\'s own rough estimate: it compares the residential population with the jobs that shops and factories offer.',
               'Es la estimación aproximada del propio juego: compara la población residencial con los empleos que ofrecen las tiendas y fábricas.'),
        fixes: m.unemployed > 0 ? [P('Zone more commercial and industrial land, with roads and power.', 'Zonifica más terreno comercial e industrial, con calles y electricidad.')]
                                : m.unfilled >= 0.5 ? [P('Zone more residential land near the jobs.', 'Zonifica más terreno residencial cerca de los empleos.')] : [],
        layer: 'workers'});

  // ---- Taxes
  push({id: 'tax', name: P('Taxes', 'Impuestos'), level: level(m.tax > 12, m.tax >= 10), value: m.tax + '%',
        summary: P('The tax rate is {0}%', 'La tasa de impuestos es del {0}%', m.tax),
        lines: [P('Tax rate: {0}%', 'Tasa de impuestos: {0}%', m.tax), trendLine('tax', m.tax, before, false)],
        why: P('Higher taxes slow growth of every kind; above 12% the original game warns that residents are upset.',
               'Los impuestos altos frenan todo tipo de crecimiento; por encima del 12% el juego original avisa de que los residentes están molestos.'),
        fixes: m.tax >= 10 ? [P('Lower it in the Budget window and cut costs instead.', 'Bájala en la ventana de Presupuesto y recorta gastos en su lugar.')] : [],
        layer: null});

  out.forEach(function(s) {
    s.lines = (s.lines || []).filter(function(l) { return !!l; });
    s.fixes = s.fixes || [];
    s.word = s.level === 'urgent' ? P('Urgent', 'Urgente') : s.level === 'watch' ? P('Watch', 'Atención') : P('Good', 'Bien');
  });
  return {list: out, figures: keyFigures(m)};
};


var Status = {
  compute: compute,
  measure: measure
};


export { Status };

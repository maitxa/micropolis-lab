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

import { Education } from './education.js';
import { I18n } from './i18n.js';
import { MiscUtils } from './miscUtils.js';
import { Policy } from './policy.js';
import { Reach } from './reach.js';
import { Residential } from './residential.js';
import { TileUtils } from './tileUtils.js';
import * as TileValues from './tileValues.ts';
import { Utilities } from './utilities.js';

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
  var c = sim.lastCensus || sim._census.snapshot(), live = sim._census;
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
    // v36: in a big city crime is mostly crowding in dense home blocks out of police reach. A police station counts
    // most in its own 8x8 square, so it has to be INSIDE the crowded block (tested on a player's city: stations on free
    // land 8-10 tiles away barely helped; replacing one home zone in each of the 3 worst blocks took the Crime bubble
    // from 42% to 0%).
    var crimeFixes = [P('Put a police station inside each crowded home block where crime is high, even if it means bulldozing one home zone: a station works most in its own 8-tile square, and much less a few squares away. Fund police fully and give the station power.',
                        'Pon una estación de policía dentro de cada manzana de viviendas abarrotada con mucha delincuencia, aunque tengas que demoler una zona de viviendas: una estación actúa sobre todo en su propio cuadro de 8 casillas, y mucho menos a unos cuadros de distancia. Da a la policía todos los fondos y electricidad a la estación.'),
                      P('Raise land value with parks, and keep pollution away from homes.',
                        'Sube el valor del suelo con parques, y mantén la contaminación lejos de las viviendas.')];
    push({id: 'crime', name: P('Crime', 'Delincuencia'), level: level(m.crimeHigh >= 0.25, m.crimeHigh >= 0.10),
          value: pct(m.crimeHigh),
          summary: P('{0} of residents live where crime is moderate or worse', '{0} de los residentes viven donde la delincuencia es moderada o peor', pct(m.crimeHigh)),
          lines: [P('Residents where crime is moderate or dangerous: {0}', 'Residentes donde la delincuencia es moderada o peligrosa: {0}', pct(m.crimeHigh)),
                  P('Average where people live: {0} out of 100', 'Promedio donde vive la gente: {0} de 100', score100(m.crimeAvg)),
                  P('Police stations: {0}', 'Estaciones de policía: {0}', fmt(m.policeStations)),
                  trendLine('crime', m.crimeHigh, before, true)],
          why: P('In this game crime is a score for each neighbourhood, not a count of crimes. It rises on cheap land and in crowded areas and falls near funded police, parks and funded social services.',
                 'En este juego la delincuencia es una puntuación de cada barrio, no un conteo de delitos. Sube en suelo barato y en zonas abarrotadas y baja cerca de policía con fondos, de los parques y de los servicios sociales con fondos.'),
          fixes: crimeFixes, layer: 'crime'});
  }

  // ---- Traffic
  // v29: more lenient: urgent when 30% of road tiles are jammed (was 15%, or the original's average traffic over 60), watch from 15%
  var trafficUrgent = m.heavy >= 0.30;
  push({id: 'traffic', name: P('Traffic', 'Tráfico'), level: m.roads ? level(trafficUrgent, m.heavy >= 0.15) : 'good',
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

  // ---- Roads (v30): road per zone, and road that leads to no zone
  var rs = Reach.roadSurvey(sim._map);
  var zoneN = m.zones || 0;
  var perZone = zoneN ? rs.roads / zoneN : 0;
  var roadsUrgent = rs.roads > 80 && perZone > 8, roadsWatch = (rs.roads > 40 && perZone > 6) || rs.stubs.length >= 6;
  push({id: 'roads', name: P('Roads', 'Calles'), level: rs.roads ? level(roadsUrgent, roadsWatch) : 'good',
        value: zoneN && rs.roads ? perZone.toFixed(1) : '',
        summary: rs.roads ? P('{0} road tiles per zone; {1} tiles lead to no zone', '{0} casillas de calle por zona; {1} casillas no llevan a ninguna zona', perZone.toFixed(1), fmt(rs.stubs.length))
                          : P('No roads yet.', 'Todavía no hay calles.'),
        lines: rs.roads ? [P('Road tiles: {0} for {1} zones ({2} per zone; compact: 3-4)', 'Casillas de calle: {0} para {1} zonas ({2} por zona; compacto: 3-4)', fmt(rs.roads), fmt(zoneN), perZone.toFixed(1)),
                           P('Road that leads to no zone: {0} tiles', 'Calle que no lleva a ninguna zona: {0} casillas', fmt(rs.stubs.length)),
                           P('Dead ends: {0} (fine beside zones)', 'Calles sin salida: {0} (bien junto a zonas)', fmt(rs.deadEnds.length))] : [],
        why: P('Every road tile costs upkeep every year. Road that leads to no zone earns nothing back.',
               'Cada casilla de calle cuesta mantenimiento todos los años. Una calle que no lleva a ninguna zona no devuelve nada.'),
        fixes: [P('Bulldoze the red stretches on the map, or zone along them.', 'Demuele los tramos rojos del mapa, o zonifica a lo largo de ellos.'),
                P('Build new road only where you are about to zone.', 'Construye calles nuevas solo donde vayas a zonificar.')],
        layer: 'roads'});

  // ---- Rail (v33): working depots and the share of homes they cover
  var depotsOk = (c.depotList || []).length, depotsBad = (c.depotUnconnectedList || []).length + (c.depotUnlinkedList || []).length;
  var homesN = 0, homesRail = 0;
  if (depotsOk) {
    var mp = sim._map, dm = sim.blockMaps.depotMap;
    for (var rx = 0; rx < mp.width; rx++)
      for (var ry = 0; ry < mp.height; ry++) {
        var rt = mp.getTile(rx, ry), rv = rt.getValue();
        if (!rt.isZone() || !TileUtils.isResidential(rv) || (rv >= TileValues.HOSPITALBASE && rv < TileValues.COMBASE))
          continue;
        homesN++;
        if (dm && dm.worldGet(rx, ry) > 0) homesRail++;
      }
  }
  var railShare = homesN ? homesRail / homesN : 0;
  var jammed = m.roads ? m.heavy >= 0.15 : false;
  push({id: 'rail', name: P('Rail', 'Tren'), level: level(depotsBad > 0, depotsOk > 0 && jammed && railShare < 0.5),
        value: depotsOk ? pct(railShare) : '',
        summary: depotsOk ? P('{0} working depots cover {1} of home zones', '{0} estaciones que funcionan cubren el {1} de las zonas de vivienda', fmt(depotsOk), pct(railShare))
                          : depotsBad ? P('No depot works yet', 'Todavía no funciona ninguna estación') : P('No train depots', 'Sin estaciones de tren'),
        lines: [P('Rail tiles: {0}', 'Casillas de vía: {0}', fmt(c.railTotal || 0)),
                P('Working depots: {0}; not working: {1}', 'Estaciones que funcionan: {0}; que no funcionan: {1}', fmt(depotsOk), fmt(depotsBad)),
                depotsOk ? P('Home zones within reach of a depot: {0} of {1}', 'Zonas de vivienda al alcance de una estación: {0} de {1}', fmt(homesRail), fmt(homesN)) : null],
        why: P('Zones near a working depot travel twice as far and put only half as much traffic on the roads. A depot works only when rail touches it and the line reaches another depot or loops back.',
               'Las zonas cerca de una estación que funciona viajan el doble de lejos y ponen solo la mitad de tráfico en las calles. Una estación funciona solo si una vía la toca y la línea llega a otra estación o vuelve sobre sí misma.'),
        fixes: depotsBad ? [P('Join the marked depots to the rail line, and run the line to another depot or round a loop.', 'Une las estaciones marcadas a la vía, y lleva la línea a otra estación o haz un circuito.')]
                         : jammed ? [P('If roads are jammed, put a depot in the middle of the busiest homes (it reaches {0} tiles) and one near the jobs, joined by rail.', 'Si las calles están atascadas, pon una estación en medio de las viviendas más concurridas (alcanza {0} casillas) y otra cerca de los empleos, unidas por vía.', Utilities.DEPOT_RADIUS)] : [],
        layer: 'rail'});

  // ---- Highways (v33): highway tiles nobody drives on, and road drawbridges a highway would keep open
  var hwTotal = 0, hwIdle = 0, mpH = sim._map;
  Object.keys(Policy.highways || {}).forEach(function(k) {
    var xy = k.split(','), hx = +xy[0], hy = +xy[1];
    if (!mpH.testBounds(hx, hy)) return;
    var hv = mpH.getTileValue(hx, hy);
    if (!TileUtils.isRoad(hv)) return;
    hwTotal++;
    if (hv < TileValues.LTRFBASE) hwIdle++;
  });
  var idleShare = hwTotal ? hwIdle / hwTotal : 0;
  var drawN = rs.drawbridges.length;
  push({id: 'highways', name: P('Highways', 'Autopistas'), level: level(hwTotal >= 20 && idleShare >= 0.6, (hwTotal >= 10 && idleShare >= 0.4) || drawN > 0),
        value: hwTotal ? fmt(hwTotal) : '',
        summary: hwTotal ? P('{0} highway tiles; {1} carry little or no traffic', '{0} casillas de autopista; {1} con poco o ningún tráfico', fmt(hwTotal), pct(idleShare))
                         : drawN ? P('No highways; {0} road drawbridges', 'Sin autopistas; {0} puentes levadizos de calle', fmt(drawN)) : P('No highways', 'Sin autopistas'),
        lines: [P('Highway tiles: {0}; with little or no traffic: {1}', 'Casillas de autopista: {0}; con poco o ningún tráfico: {1}', fmt(hwTotal), fmt(hwIdle)),
                P('Upkeep: each highway tile costs as much as 3 road tiles', 'Mantenimiento: cada casilla de autopista cuesta como 3 de calle'),
                drawN ? P('Road drawbridges over the channel: {0} (they cut the road while open)', 'Puentes levadizos de calle sobre el canal: {0} (cortan la calle mientras están abiertos)', fmt(drawN)) : null],
        why: P('A highway tile uses a third of a trip and builds up half the congestion, but costs three times a road\'s upkeep. It pays where many trips pass and between districts far apart; a highway nobody drives on only costs money.',
               'Una casilla de autopista gasta un tercio del viaje y se congestiona la mitad, pero cuesta tres veces el mantenimiento de una calle. Compensa donde pasan muchos viajes y entre barrios alejados; una autopista por la que no pasa nadie solo cuesta dinero.'),
        fixes: [hwIdle ? P('Bulldoze or downgrade the marked highway with little or no traffic (build ordinary road there instead).', 'Demuele la autopista marcada con poco o ningún tráfico (o pon calle normal en su lugar).') : null,
                drawN ? P('Rebuild road bridges over the shipping channel as highway: they never open.', 'Reconstruye como autopista los puentes de calle sobre el canal: nunca se abren.') : null,
                P('Put new highway where the roads are red (Traffic bubble), not around empty land.', 'Pon autopista nueva donde las calles están rojas (burbuja de Tráfico), no alrededor de terreno vacío.')].filter(function(f) { return !!f; }),
        layer: 'highways'});

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
        layer: m.unemployed > 0 ? 'zoning_ind' : 'zoning_res'});

  // ---- Water (v30): zones sending raw sewage into the water
  var toWater = live.sewageToRiverZones || 0, treatedZ = live.sewageTreatedZones || 0;
  var wz = toWater + treatedZ;
  push({id: 'water', name: P('Water', 'Agua'), level: wz ? level(toWater >= 5 && toWater / wz >= 0.25, toWater > 0 || (c.waterPlantUnpowered || 0) > 0) : 'good',
        value: toWater ? fmt(toWater) : '',
        summary: toWater ? P('{0} zones send raw sewage into the water', '{0} zonas echan aguas residuales sin tratar al agua', fmt(toWater))
                         : P('No raw sewage is reaching the water.', 'No llegan aguas residuales sin tratar al agua.'),
        lines: [P('Zones with treated sewage: {0}', 'Zonas con aguas residuales tratadas: {0}', fmt(treatedZ)),
                P('Zones sending raw sewage into the water: {0}', 'Zonas que echan aguas sin tratar al agua: {0}', fmt(toWater)),
                P('Water treatment plants: {0}{1}', 'Plantas de tratamiento: {0}{1}', fmt(c.waterPlantPop || 0),
                  c.waterPlantUnpowered ? P(' ({0} without power)', ' ({0} sin electricidad)', fmt(c.waterPlantUnpowered)) : '')],
        why: P('Sewage from zones within {0} tiles of water pollutes it and its banks, and spoils the waterfront for nearby homes.',
               'Las aguas residuales de las zonas a menos de {0} casillas del agua la contaminan junto con sus orillas, y arruinan la vista de las viviendas cercanas.', Utilities.SEWAGE_SEARCH_RADIUS),
        fixes: [P('Build a water treatment plant (key U) within {0} tiles of these zones, touching a power line.', 'Construye una planta de tratamiento (tecla U) a menos de {0} casillas de estas zonas, tocando un cable.', Utilities.WATER_RADIUS)],
        layer: 'water'});

  // ---- Fire (v30): only when fires can happen (disasters on) or have happened
  var disastersOn = sim.disasterManager && sim.disasterManager.disastersEnabled;
  if (disastersOn || (live.firePop || 0) > 0 || (c.firePop || 0) > 0) {
    var fireNone = (c.fireStationPop || 0) === 0 && m.people > 2000;
    var burning = (c.firePop || live.firePop || 0) > 0;
    push({id: 'fire', name: P('Fire', 'Incendios'), level: level(burning || fireNone, (c.fireStationPop || 0) === 0 && m.hasHomes),
          value: burning ? fmt(c.firePop || live.firePop) : '',
          summary: burning ? P('Fires are burning ({0} tiles)', 'Hay incendios ({0} casillas)', fmt(c.firePop || live.firePop))
                           : (c.fireStationPop || 0) ? P('{0} fire stations', '{0} estaciones de bomberos', fmt(c.fireStationPop))
                                                     : P('No fire station yet.', 'Todavía no hay estación de bomberos.'),
          lines: [P('Fire stations: {0}', 'Estaciones de bomberos: {0}', fmt(c.fireStationPop || 0)),
                  P('Tiles on fire: {0}', 'Casillas en llamas: {0}', fmt(c.firePop || live.firePop || 0))],
          why: P('Fires spread freely where no fire station covers. They start from disasters, crashes, shipwrecks and meltdowns.',
                 'Los incendios se extienden sin control donde no llega ninguna estación de bomberos. Empiezan por desastres, accidentes, naufragios y fusiones nucleares.'),
          fixes: [P('Build a fire station (key 9) among the homes and fund it fully.', 'Construye una estación de bomberos (tecla 9) entre las viviendas y dale todos los fondos.')],
          layer: 'fire'});
  }

  // ---- Education (v30): once the city has 2,000 people or a school
  if (m.people > 2000 || (c.schoolPop || 0) + (c.collegePop || 0) > 0) {
    var ecov = Education.coverage(sim._map, c), est = Education.state();
    var served = ecov.homes ? ecov.school / ecov.homes : 0;
    push({id: 'education', name: P('Schools', 'Escuelas'),
          level: level(m.people > 20000 && served < 0.3, served < 0.7),
          value: ecov.homes ? pct(served) : '',
          summary: (c.schoolPop || 0) ? P('{0} of homes have a school nearby', 'El {0} de las viviendas tiene una escuela cerca', pct(served))
                                      : P('No school yet.', 'Todavía no hay escuelas.'),
          lines: [P('Homes a school serves: {0} of {1}', 'Viviendas que atiende una escuela: {0} de {1}', fmt(ecov.school), fmt(ecov.homes)),
                  P('Homes a college serves: {0}', 'Viviendas que atiende una universidad: {0}', fmt(ecov.college)),
                  P('City schooling {0}%, college education {1}% (they change slowly)', 'Escolarización {0}%, estudios universitarios {1}% (cambian despacio)', Math.round(est.school * 100), Math.round(est.college * 100)),
                  (c.educationUnpoweredList || []).length ? P('Without power (closed): {0}', 'Sin electricidad (cerradas): {0}', fmt(c.educationUnpoweredList.length)) : ''],
          why: P('Schooling lowers crime in every neighbourhood (up to {0} points); college education brings shops and factories more business. Both build up over a few years.',
                 'La escolarización baja la delincuencia en todos los barrios (hasta {0} puntos); los estudios universitarios traen más negocio a tiendas y fábricas. Ambos crecen a lo largo de unos años.', Education.CRIME_MAX),
          fixes: [P('Build a school (key L) among the homes with no school, touching a power line.', 'Construye una escuela (tecla L) entre las viviendas sin escuela, tocando un cable.'),
                  P('A college (key O) serves a wide area: one in the middle of the city.', 'Una universidad (tecla O) atiende una zona amplia: una en el centro de la ciudad.')],
          layer: 'education'});
  }

  // ---- Taxes
  push({id: 'tax', name: P('Taxes', 'Impuestos'), level: level(m.tax > 12, m.tax >= 10), value: m.tax + '%',
        summary: P('The tax rate is {0}%', 'La tasa de impuestos es del {0}%', m.tax),
        lines: [P('Tax rate: {0}%', 'Tasa de impuestos: {0}%', m.tax), trendLine('tax', m.tax, before, false)],
        why: P('Higher taxes slow growth of every kind; above 12% the original game warns that residents are upset.',
               'Los impuestos altos frenan todo tipo de crecimiento; por encima del 12% el juego original avisa de que los residentes están molestos.'),
        fixes: m.tax >= 10 ? [P('Lower it in the Budget window and cut costs instead.', 'Bájala en la ventana de Presupuesto y recorta gastos en su lugar.')] : [],
        layer: 'taxes'});   // v35: the map of who pays the taxes

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

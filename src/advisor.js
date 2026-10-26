/* Policy Lab additions to micropolisJS (2026).
 *
 * This code is released under the GNU GPL v3, with some additional terms, like the rest of micropolisJS.
 * Modified version: NOT the original micropolisJS / Micropolis.
 *
 * The city advisor. Once a game month it looks at the city using the game's own rules and lists the most useful
 * things to build or fix, most important first. Unlike the original messages (which mostly compare how many zones of
 * each kind exist), it checks WHY zones are empty: no power, no road touching them, trips that can't reach a
 * destination, missing workers or jobs, a demand cap (stadium, seaport, airport), or money running out.
 *
 * It only READS the simulation; it never changes the game.
 */

import { I18n } from './i18n.js';
import { MiscUtils } from './miscUtils.js';
import { Policy } from './policy.js';
import { Reach } from './reach.js';
import { TileUtils } from './tileUtils.js';
import * as TileValues from './tileValues.ts';

var P = I18n.p;
var fmt = MiscUtils.formatNumber;
var money = MiscUtils.formatMoney;

// The 12 tiles along the four sides of a 3x3 zone (not the corners): the same places the traffic code looks for a road
var perimX = [-1, 0, 1, 2, 2, 2, 1, 0, -1, -2, -2, -2];
var perimY = [-2, -2, -2, -1, 0, 1, 2, 2, 2, 1, 0, -1];

var hasRoad = function(map, x, y) {
  for (var i = 0; i < 12; i++) {
    var xx = x + perimX[i], yy = y + perimY[i];
    if (map.testBounds(xx, yy) && TileUtils.isDriveable(map.getTileValue(xx, yy)))
      return true;
  }
  return false;
};

var EMPTY = {res: TileValues.FREEZ, com: TileValues.COMCLR, ind: TileValues.INDCLR};

// Look at every residential, commercial and industrial zone on the map
var scanZones = function(map) {
  var kind = function() { return {n: 0, empty: 0, emptyNoPower: 0, emptyNoRoad: 0, list: [], emptyList: []}; };
  var out = {res: kind(), com: kind(), ind: kind(),
             noRoad: 0, noRoadPos: null, noRoadList: [], noPower: 0, noPowerPos: null, noPowerList: [], emptyPos: {}};
  var MAX = 60;  // at most this many spots of each kind are highlighted
  for (var x = 0; x < map.width; x++) {
    for (var y = 0; y < map.height; y++) {
      var tile = map.getTile(x, y);
      if (!tile.isZone())
        continue;
      var v = tile.getValue();
      var type = TileUtils.isResidential(v) ? 'res' : TileUtils.isCommercial(v) ? 'com' :
                 TileUtils.isIndustrial(v) ? 'ind' : null;
      if (type === null)
        continue;
      out[type].n += 1;
      out[type].list.push({x: x, y: y});
      var road = hasRoad(map, x, y);
      if (v === EMPTY[type]) {
        out[type].empty += 1;
        if (!tile.isPowered()) out[type].emptyNoPower += 1;
        if (!road) out[type].emptyNoRoad += 1;
        if (!out.emptyPos[type])
          out.emptyPos[type] = {x: x, y: y};
        if (out[type].emptyList.length < MAX)
          out[type].emptyList.push({x: x, y: y});
      }
      if (!road) {
        out.noRoad += 1;
        if (!out.noRoadPos)
          out.noRoadPos = {x: x, y: y};
        if (out.noRoadList.length < MAX)
          out.noRoadList.push({x: x, y: y});
      }
      if (!tile.isPowered()) {
        out.noPower += 1;
        if (!out.noPowerPos)
          out.noPowerPos = {x: x, y: y};
        if (out.noPowerList.length < MAX)
          out.noPowerList.push({x: x, y: y});
      }
    }
  }
  return out;
};

// Singular or plural, in the current language: N(n, 'one en', 'many en', 'one es', 'many es'), with {0} = the number
var N = function(n, oneEn, manyEn, oneEs, manyEs) {
  return n === 1 ? P(oneEn, oneEs, fmt(n)) : P(manyEn, manyEs, fmt(n));
};

var typeName = function(type, plural) {
  var names = {
    res: plural ? P('residential', 'residenciales') : P('residential', 'residencial'),
    com: plural ? P('commercial', 'comerciales') : P('commercial', 'comercial'),
    ind: plural ? P('industrial', 'industriales') : P('industrial', 'industrial')
  };
  return names[type];
};


// POLICY LAB v22: "zoning need" for each kind of zone, shown by the bars in the lower left and used by the To do card.
// Above zero: zone more (the zones you have are full, or nearly, and the game's demand is positive).
// Below zero: don't (several zones of that kind are empty, or the game's demand is negative).
// It only describes the city: growth itself still follows the game's original demand.
var zoningNeed = function(z, v) {
  var demand = {res: v.resValve / 2000, com: v.comValve / 1500, ind: v.indValve / 1500};
  var capped = {res: v.resCap, com: v.comCap, ind: v.indCap};
  var out = {};
  ['res', 'com', 'ind'].forEach(function(t) {
    var zt = z[t], d = demand[t];
    var allowance = Math.max(1, Math.floor(zt.n * 0.1));   // "several empty" = more than this
    var r = {n: zt.n, empty: zt.empty, emptyNoPower: zt.emptyNoPower, emptyNoRoad: zt.emptyNoRoad, demand: d,
             emptyPos: zt.emptyPos, allowance: allowance};
    if (zt.empty > allowance) {
      r.state = 'empty';
      r.value = -Math.min(1, Math.max(0.2, zt.empty / zt.n));
    } else if (capped[t]) {
      r.state = 'capped';
      r.value = 0;
    } else if (d > 0.1) {
      r.state = 'more';
      r.value = Math.min(1, Math.max(0.15, d));
    } else {
      r.state = d < -0.1 ? 'noNeed' : 'enough';
      r.value = Math.max(-1, Math.min(0, d));
    }
    out[t] = r;
  });
  return out;
};


// Build the list of advice. Each item: {id, priority (0-100), text, why, fixes: [...], pos: {x, y} or null, tone}
var advise = function(sim, newMonth) {
  var map = sim._map;
  var live = sim._census;
  var c = sim.lastCensus || live.snapshot();
  var v = sim._valves;
  var b = sim.budget;
  var z = scanZones(map);
  var items = [];
  var add = function(id, priority, text, why, fixes, pos, tone) {
    items.push({id: id, priority: priority, text: text, why: why, fixes: fixes || [], pos: pos || null, tone: tone || 'bad'});
  };

  var zoneCount = z.res.n + z.com.n + z.ind.n;
  var plants = c.coalPowerPop + c.nuclearPowerPop;

  // ---- Money ----
  var est = b.estimateYear(sim._gameLevel, {
    totalPop: live.totalPop || 0, landValueAverage: live.landValueAverage || 0, roadTotal: c.roadTotal,
    railTotal: c.railTotal, policeStationPop: c.policeStationPop, fireStationPop: c.fireStationPop,
    depotPop: c.depotPop || 0, waterPlantPop: c.waterPlantPop || 0, builtHospitalPop: c.builtHospitalPop || 0});
  var moneyWhy = P('In a year the city collects about {0} in taxes and spends about {1} on upkeep (roads and rail {2}, police {3}, fire {4}, other {5}).',
                   'En un año la ciudad recauda unos {0} en impuestos y gasta unos {1} en mantenimiento (calles y vías {2}, policía {3}, bomberos {4}, otros {5}).',
                   money(est.taxes), money(est.totalCosts), money(est.costs.road), money(est.costs.police),
                   money(est.costs.fire), money(est.costs.social + est.costs.housing + est.costs.utilities));
  var moneyFixes = [P('Grow the population: more residents and businesses pay more taxes.',
                      'Haz crecer la población: más residentes y empresas pagan más impuestos.'),
                    P('Avoid building roads, rail and zones before they are needed: everything has upkeep.',
                      'No construyas calles, vías ni zonas antes de necesitarlas: todo tiene mantenimiento.'),
                    P('In the Budget window, lower funding a little or raise taxes a point or two.',
                      'En la ventana de Presupuesto, baja un poco los fondos o sube los impuestos uno o dos puntos.')];
  if (est.balance < 0) {
    var years = b.totalFunds / -est.balance;
    if (years < 3)
      add('money', 98, N(Math.max(1, Math.round(years)), 'Money runs out in about {0} year', 'Money runs out in about {0} years',
                         'El dinero se acaba en {0} año aproximadamente', 'El dinero se acaba en {0} años aproximadamente'),
          moneyWhy, moneyFixes, null);
    else
      add('money', 42, P('The city loses about {0} a year', 'La ciudad pierde unos {0} al año', money(-est.balance)),
          moneyWhy, moneyFixes, null);
  }

  // ---- Power ----
  if (zoneCount > 0 && plants === 0) {
    add('noPlant', 96, P('Build a power plant: zones only grow with power', 'Construye una planta eléctrica: las zonas solo crecen con electricidad'),
        P('No zone in the city has electricity.', 'Ninguna zona de la ciudad tiene electricidad.'),
        [Policy.nuclearAllowed ? P('Coal (cheaper, pollutes) or nuclear (clean, risk of meltdown).',
                                   'De carbón (más barata, contamina) o nuclear (limpia, con riesgo de fusión).')
                               : P('Nuclear power is banned by your laws, so build a coal plant.',
                                   'Tus leyes prohíben la energía nuclear, así que construye una de carbón.'),
         P('Then connect it to the zones with power lines (key 6).', 'Luego conéctala a las zonas con cables eléctricos (tecla 6).')]);
  } else if (z.noPower > 0) {
    add('noPower', 92, N(z.noPower, '{0} zone has no power', '{0} zones have no power',
                         '{0} zona no tiene electricidad', '{0} zonas no tienen electricidad'),
        P('Zones without electricity cannot grow, and slowly empty.', 'Las zonas sin electricidad no pueden crecer y se van vaciando.'),
        [P('Run a power line (key 6) from a powered zone or plant to them. Zones that touch pass power along.',
           'Lleva un cable eléctrico (tecla 6) desde una zona con electricidad o una planta. Las zonas que se tocan se pasan la electricidad.'),
         P('If they are already connected, your plants are at full capacity: build another one.',
           'Si ya están conectadas, tus plantas están al máximo: construye otra.')],
        z.noPowerPos);
  }

  // ---- Roads ----
  if (z.noRoad > 0)
    add('noRoad', 90, N(z.noRoad, '{0} zone has no road touching it', '{0} zones have no road touching them',
                        '{0} zona no tiene una calle que la toque', '{0} zonas no tienen una calle que las toque'),
        P('A zone needs a road or rail tile right against one of its sides (corners and gaps of one tile do not count). Without it, it cannot grow.',
          'Una zona necesita una casilla de calle o vía justo pegada a uno de sus lados (las esquinas y los huecos de una casilla no cuentan). Sin eso no puede crecer.'),
        [P('Build a road along one side of the zone (key 4).', 'Construye una calle a lo largo de uno de sus lados (tecla 4).')],
        z.noRoadPos);

  // ---- Workers and jobs ----
  var hasJobs = z.com.n + z.ind.n > 0;
  if (hasJobs && z.res.n === 0)
    add('needHomes', 88, P('Zone residential land: shops and factories need workers', 'Zonifica terreno residencial: las tiendas y fábricas necesitan trabajadores'),
        P('Businesses grow only as far as there are people to work in them: the game\'s demand for shops and factories counts the workers available.',
          'Las empresas solo crecen hasta donde hay gente para trabajar en ellas: la demanda de tiendas y fábricas del juego cuenta los trabajadores disponibles.'),
        [P('Zone residential land within about 20 tiles of your shops and factories, connected by road (key 1).',
           'Zonifica terreno residencial a menos de unas 20 casillas de tus tiendas y fábricas, conectado por calle (tecla 1).')]);
  if (z.res.n > 0 && !hasJobs)
    add('needJobs', 87, P('Zone commercial and industrial land: residents need jobs', 'Zonifica terreno comercial e industrial: los residentes necesitan empleo'),
        P('People move in for jobs: with no shops or factories, few people want to live here.',
          'La gente llega por el empleo: sin tiendas ni fábricas, poca gente quiere vivir aquí.'),
        [P('Zone some commercial (key 2) and industrial (key 3) land within about 20 tiles, connected by road.',
           'Zonifica algo de terreno comercial (tecla 2) e industrial (tecla 3) a menos de unas 20 casillas, conectado por calle.'),
         P('Keep factories a little apart from homes: they pollute.', 'Deja algo de distancia entre las fábricas y las viviendas: contaminan.')]);

  // ---- Trips that can't reach a destination ----
  // The game only tests a sample of trips, and each car turns at random, so a single failure is often bad luck. A zone
  // is listed only if (1) its trips failed in at least 2 of the last 3 months, and (2) its reach does not show that it is
  // clearly fine (what it needs within 10 road tiles, with no dead end or open drawbridge within 10 tiles).
  var hist = sim._tripHistory = sim._tripHistory || {};
  var failedNow = {};
  (c.tripFailList || []).forEach(function(q) { failedNow[q.x + ',' + q.y] = q; });
  if (newMonth) {
    Object.keys(hist).forEach(function(k) {
      hist[k].runs.push(!!failedNow[k]);
      if (hist[k].runs.length > 3)
        hist[k].runs.shift();
      if (!hist[k].runs.some(Boolean))
        delete hist[k];
    });
    Object.keys(failedNow).forEach(function(k) {
      if (!hist[k])
        hist[k] = {q: failedNow[k], runs: [true]};
    });
  }
  var depots = sim.blockMaps && sim.blockMaps.depotMap;
  var tripZones = [];
  Object.keys(hist).forEach(function(k) {
    var h = hist[k];
    if (h.runs.filter(Boolean).length < 2)
      return;
    var zone = Reach.zoneAt(map, h.q.x, h.q.y);
    if (!zone)
      return;
    var r = Reach.compute(map, zone.x, zone.y, zone.type, !!depots && depots.worldGet(zone.x, zone.y) > 0);
    var clearlyFine = r.dests.length && r.dests[0].d <= 10 &&
                      !r.dead.some(function(d) { return d[2] <= 10; }) &&
                      !r.bridges.some(function(b2) { return b2.open; });
    // only shops need their trips to succeed to grow (as in 1989)
    if (!clearlyFine && zone.type === 'com')
      tripZones.push({x: zone.x, y: zone.y, type: zone.type, rail: r.railBeside >= 3});
  });
  var fails = {res: 0, com: 0, ind: 0};
  tripZones.forEach(function(t) { fails[t.type]++; });
  var worst = ['res', 'com', 'ind'].sort(function(a, b2) { return fails[b2] - fails[a]; })[0];
  var railNote = tripZones.some(function(t) { return t.rail; });
  if (fails[worst] > 0) {
    var tripText = P('Some shops keep failing to reach a home, shop or factory within 30 tiles of road',
                     'Algunas tiendas no logran llegar a una vivienda, tienda o fábrica a menos de 30 casillas de calle');
    var tripWhy = P('Every so often each occupied shop sends a car along the roads. It turns at random at each junction, never turns back, and gives up at a dead end or after 30 tiles. If it passes no home, shop or factory, the trip fails, and a shop whose trip fails cannot grow (as in 1989; homes and factories only need a road and power). Only shops that failed in at least 2 of the last 3 months are listed.',
                    'Cada cierto tiempo, cada tienda ocupada envía un carro por las calles. Gira al azar en cada cruce, nunca da la vuelta y se rinde en una calle sin salida o después de 30 casillas. Si no pasa junto a ninguna vivienda, tienda o fábrica, el viaje falla, y una tienda cuyo viaje falla no puede crecer (como en 1989; las viviendas y fábricas solo necesitan calle y electricidad). Solo se listan las tiendas que fallaron en al menos 2 de los últimos 3 meses.');
    var tripFixes = [P('Click "Show me on the map": the shaded roads show how far the car can get, green frames show places it can reach, and orange marks show dead ends.',
                       'Haz clic en "Muéstrame en el mapa": las calles sombreadas muestran hasta dónde llega el carro, los marcos verdes los lugares a los que puede llegar y las marcas naranjas las calles sin salida.'),
                     P('Put what the zone needs closer (within about 15 road tiles), along the same roads.',
                       'Pon lo que la zona necesita más cerca (a unas 15 casillas de calle), junto a las mismas calles.'),
                     P('Remove dead ends or connect them, so the car can keep going.', 'Quita las calles sin salida o conéctalas, para que el carro pueda seguir.')];
    if (railNote)
      tripFixes.push(P('Rail runs right beside the road here: every tile becomes a junction where the car can wander off onto the rail, away from shops. Keep rail and road apart, crossing only at right angles.',
                       'Aquí la vía férrea corre justo al lado de la calle: cada casilla se vuelve un cruce donde el carro puede desviarse a la vía, lejos de las tiendas. Separa la vía de la calle y crúzalas solo en ángulo recto.'));
    tripFixes.push(P('A train depot lets nearby zones travel twice as far.', 'Una estación de tren permite a las zonas cercanas viajar el doble de lejos.'));
    add('trips', 80, tripText, tripWhy, tripFixes, null);
  }

  // ---- Growth caps ----
  if (c.resPop > 500 && c.stadiumPop === 0)
    add('stadium', 85, P('Build a stadium: residential growth has stopped until you do', 'Construye un estadio: el crecimiento residencial se detuvo hasta que lo hagas'),
        P('Residents demand a stadium once the city is this big; until then residential demand can\'t rise above zero.',
          'Con una ciudad de este tamaño, los residentes exigen un estadio; hasta entonces la demanda residencial no puede subir de cero.'),
        [P('Place it near homes, connected by road and power.', 'Ponlo cerca de las viviendas, conectado por calle y con electricidad.')]);
  if (c.indPop > 70 && c.seaportPop === 0)
    add('seaport', 84, P('Build a seaport: industrial growth has stopped until you do', 'Construye un puerto: el crecimiento industrial se detuvo hasta que lo hagas'),
        P('Industry this big needs a seaport to ship its goods.', 'Una industria de este tamaño necesita un puerto para enviar sus productos.'),
        [P('Place it on the shore, connected by road and power.', 'Ponlo en la costa, conectado por calle y con electricidad.')]);
  if (c.comPop > 100 && c.airportPop === 0)
    add('airport', 83, P('Build an airport: commercial growth has stopped until you do', 'Construye un aeropuerto: el crecimiento comercial se detuvo hasta que lo hagas'),
        P('Commerce this big needs an airport.', 'Un comercio de este tamaño necesita un aeropuerto.'),
        [P('It needs a large flat area, connected by road and power.', 'Necesita un área grande y plana, conectada por calle y con electricidad.')]);

  // ---- Demand compared with empty zones ----
  // POLICY LAB v23: shown only by the zoning-need bars in the lower left (no "Zone more" / "Don't zone" items here)
  var need = zoningNeed(z, v);

  // ---- Services ----
  if (live.totalPop > 60 && c.policeStationPop === 0)
    add('police', 55, P('Build a police station', 'Construye una estación de policía'),
        P('The city is big enough that residents expect police, and crime grows without it.', 'La ciudad ya es lo bastante grande como para que los residentes esperen policía, y sin ella crece la delincuencia.'),
        [P('Place it in dense or low-value neighbourhoods (key 8).', 'Ponla en vecindarios densos o de poco valor (tecla 8).')]);
  if (live.totalPop > 60 && c.fireStationPop === 0)
    add('fire', 54, P('Build a fire station', 'Construye una estación de bomberos'),
        P('Without fire stations, fires spread freely.', 'Sin estaciones de bomberos, los incendios se extienden sin control.'),
        [P('Spread them out: their reach fades with distance (key 9).', 'Repártelas: su alcance disminuye con la distancia (tecla 9).')]);
  // (The tax rate is shown in the Taxes bubble at the top of the card: POLICY LAB v21.)
  if (c.roadTotal > 30 && b.roadPercent < 0.9)
    add('roadFunds', 45, P('Roads are underfunded and will crumble', 'Las calles tienen pocos fondos y se van a deteriorar'),
        P('Road funding is at {0}%.', 'Los fondos para calles están al {0}%.', Math.round(b.roadPercent * 100)),
        [P('Raise road funding in the Budget window, or build fewer roads.', 'Sube los fondos de las calles en la ventana de Presupuesto, o construye menos calles.')]);

  // ---- Problems ----
  // Pollution, crime and traffic are shown as status bubbles at the top of the card (src/status.js), not as items.

  // ---- Policy Lab buildings ----
  if (c.depotUnconnected)
    add('depot', 68, N(c.depotUnconnected, '{0} train depot doesn\'t touch a rail line', '{0} train depots don\'t touch a rail line',
                       '{0} estación de tren no toca una vía férrea', '{0} estaciones de tren no tocan una vía férrea'),
        P('A depot only works with rail right next to it.', 'Una estación solo funciona con una vía justo al lado.'),
        [P('Run rail (key 5) up to the depot.', 'Lleva una vía férrea (tecla 5) hasta la estación.')]);
  if (c.depotUnlinked)
    add('depotLink', 66, N(c.depotUnlinked, '{0} train depot isn\'t linked by rail to another depot', '{0} train depots aren\'t linked by rail to another depot',
                           '{0} estación de tren no está unida por vía férrea a otra estación', '{0} estaciones de tren no están unidas por vía férrea a otra estación'),
        P('A train needs somewhere to go: a depot only works when its rail line reaches at least one other depot.',
          'Un tren necesita adónde ir: una estación solo funciona cuando su vía llega al menos a otra estación.'),
        [P('Build a second depot (key T) in another neighbourhood and join the two with rail (key 5).',
           'Construye una segunda estación (tecla T) en otro vecindario y une las dos con vía férrea (tecla 5).'),
         P('Keep the rail clear of roads, crossing them only at right angles.', 'Mantén la vía separada de las calles, cruzándolas solo en ángulo recto.')]);
  if (c.waterPlantUnpowered)
    add('water', 68, N(c.waterPlantUnpowered, '{0} water plant has no power', '{0} water plants have no power',
                       '{0} planta de agua no tiene electricidad', '{0} plantas de agua no tienen electricidad'),
        P('Water treatment plants need electricity.', 'Las plantas de tratamiento de aguas necesitan electricidad.'),
        [P('Connect them with a power line (key 6).', 'Conéctalas con un cable eléctrico (tecla 6).')]);
  if (Policy.sewagePollution && live.sewageToRiverZones > 0)
    add('sewage', 48, N(live.sewageToRiverZones, '{0} zone sends raw sewage into the water', '{0} zones send raw sewage into the water',
                        '{0} zona echa aguas residuales sin tratar al agua', '{0} zonas echan aguas residuales sin tratar al agua'),
        P('In your world model untreated sewage pollutes rivers and their banks.', 'En tu modelo del mundo las aguas residuales sin tratar contaminan los ríos y sus orillas.'),
        [P('Build a water treatment plant (key U) within about 24 tiles, with power.', 'Construye una planta de tratamiento (tecla U) a unas 24 casillas, con electricidad.')]);

  if (items.length === 0) {
    if (zoneCount === 0)
      add('start', 10, P('Start with a power plant, a few zones of each kind and roads', 'Empieza con una planta eléctrica, algunas zonas de cada tipo y calles'),
          P('Zones need power and a road touching one side to grow.', 'Las zonas necesitan electricidad y una calle que toque uno de sus lados para crecer.'),
          [P('Keep homes, shops and factories within about 20 tiles of each other.', 'Mantén viviendas, tiendas y fábricas a unas 20 casillas unas de otras.')], null, 'neutral');
    else
      add('ok', 0, P('Nothing urgent: let the city grow', 'Nada urgente: deja que la ciudad crezca'),
          P('Zones are powered and connected. Watch the R/C/I bars to see what the city wants next.',
            'Las zonas tienen electricidad y están conectadas. Mira las barras R/C/I para ver qué quiere la ciudad.'),
          [], null, 'good');
  }

  // ---- What to highlight on the map for each piece of advice ----
  var frames = function(list, label, ring) {
    return (list || []).map(function(q) {
      return {kind: 'zone', x: q.x, y: q.y, label: typeof label === 'function' ? label(q) : label, ring: !!ring, type: q.type};
    });
  };
  var circleAround = function(list, r, label) {
    if (!list || !list.length)
      return [];
    var sx = 0, sy = 0;
    list.forEach(function(q) { sx += q.x; sy += q.y; });
    return [{kind: 'circle', x: Math.round(sx / list.length), y: Math.round(sy / list.length), r: r, label: label}];
  };
  var targets = {
    noPower: frames(z.noPowerList, P('No power', 'Sin electricidad')),
    noRoad: frames(z.noRoadList, P('Needs a road along one side', 'Necesita una calle en un lado'), true),
    trips: frames(tripZones, function(q) {
      if (q.rail)
        return {
          res: P('Homes here keep failing (rail beside the road)', 'Estas viviendas siguen fallando (vía junto a la calle)'),
          com: P('Shops here keep failing (rail beside the road)', 'Estas tiendas siguen fallando (vía junto a la calle)'),
          ind: P('Factories here keep failing (rail beside the road)', 'Estas fábricas siguen fallando (vía junto a la calle)')
        }[q.type];
      return {
        res: P('Homes here need a shop or factory within 30 road tiles', 'Estas viviendas necesitan una tienda o fábrica a menos de 30 casillas de calle'),
        com: P('Shops here need a home, shop or factory within 30 road tiles', 'Estas tiendas necesitan una vivienda, tienda o fábrica a menos de 30 casillas de calle'),
        ind: P('Factories need homes (workers) within 30 road tiles', 'Las fábricas necesitan viviendas (trabajadores) a menos de 30 casillas de calle')
      }[q.type];
    }),
    needHomes: circleAround(z.com.list.concat(z.ind.list), 20, P('Zone homes inside this circle', 'Zonifica viviendas dentro de este círculo')),
    needJobs: circleAround(z.res.list, 20, P('Zone shops and factories inside this circle', 'Zonifica tiendas y fábricas dentro de este círculo')),
    stadium: circleAround(z.res.list, 10, P('Build the stadium near here', 'Construye el estadio cerca de aquí')),
    depot: frames(c.depotUnconnectedList, P('Needs rail right next to it', 'Necesita una vía justo al lado')),
    depotLink: frames(c.depotUnlinkedList, P('Not linked by rail to another depot', 'Sin vía hasta otra estación')),
    water: frames(c.waterPlantUnpoweredList, P('No power', 'Sin electricidad')),
    pollution: [{kind: 'circle', x: map.pollutionMaxX, y: map.pollutionMaxY, r: 8,
                 label: P('Most polluted area', 'Zona más contaminada')}]
  };
  ['res', 'com', 'ind'].forEach(function(t) {
    targets['more_' + t] = circleAround(z[t].list, 12, P('Zone more near here', 'Zonifica más cerca de aquí'));
    targets['wait_' + t] = frames(z[t].emptyList, P('Still empty', 'Sigue vacía'));
  });
  items.forEach(function(item) {
    item.targets = targets[item.id] || [];
    if (item.targets.length)
      item.pos = {x: item.targets[0].x, y: item.targets[0].y};
  });

  items.sort(function(a, b2) { return b2.priority - a.priority; });
  // POLICY LAB v23: shops whose trips keep failing are outlined on the map all the time
  return {items: items, estimate: est, need: need,
          stuckShops: tripZones.filter(function(t) { return t.type === 'com'; }).map(function(t) { return {x: t.x, y: t.y}; })};
};


var Advisor = {
  advise: advise
};


export { Advisor };

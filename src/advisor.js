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
  var out = {res: {n: 0, empty: 0, list: [], emptyList: []}, com: {n: 0, empty: 0, list: [], emptyList: []},
             ind: {n: 0, empty: 0, list: [], emptyList: []},
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
      if (v === EMPTY[type]) {
        out[type].empty += 1;
        if (!out.emptyPos[type])
          out.emptyPos[type] = {x: x, y: y};
        if (out[type].emptyList.length < MAX)
          out[type].emptyList.push({x: x, y: y});
      }
      if (!hasRoad(map, x, y)) {
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


// Build the list of advice. Each item: {id, priority (0-100), text, why, fixes: [...], pos: {x, y} or null, tone}
var advise = function(sim) {
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
        P('Factories only grow if their trips reach homes, and businesses grow only as far as there are people to work in them.',
          'Las fábricas solo crecen si sus viajes llegan a viviendas, y las empresas solo crecen hasta donde hay gente para trabajar en ellas.'),
        [P('Zone residential land within about 20 tiles of your shops and factories, connected by road (key 1).',
           'Zonifica terreno residencial a menos de unas 20 casillas de tus tiendas y fábricas, conectado por calle (tecla 1).')]);
  if (z.res.n > 0 && !hasJobs)
    add('needJobs', 87, P('Zone commercial and industrial land: residents need jobs', 'Zonifica terreno comercial e industrial: los residentes necesitan empleo'),
        P('Homes only grow if their trips reach a shop, factory or other big building, and people move in for jobs.',
          'Las viviendas solo crecen si sus viajes llegan a una tienda, fábrica u otro edificio grande, y la gente llega por el empleo.'),
        [P('Zone some commercial (key 2) and industrial (key 3) land within about 20 tiles, connected by road.',
           'Zonifica algo de terreno comercial (tecla 2) e industrial (tecla 3) a menos de unas 20 casillas, conectado por calle.'),
         P('Keep factories a little apart from homes: they pollute.', 'Deja algo de distancia entre las fábricas y las viviendas: contaminan.')]);

  // ---- Trips that can't reach a destination ----
  var fails = {res: c.tripFailRes || 0, com: c.tripFailCom || 0, ind: c.tripFailInd || 0};
  var worst = ['res', 'com', 'ind'].sort(function(a, b2) { return fails[b2] - fails[a]; })[0];
  if (fails[worst] > 0) {
    var tripText = {
      res: P('Some homes can\'t reach a shop or factory within 30 tiles of road', 'Algunas viviendas no llegan a una tienda o fábrica a menos de 30 casillas de calle'),
      com: P('Some shops can\'t reach a home, shop or factory within 30 tiles of road', 'Algunas tiendas no llegan a una vivienda, tienda o fábrica a menos de 30 casillas de calle'),
      ind: P('Some factories can\'t reach homes (workers) within 30 tiles of road', 'Algunas fábricas no llegan a viviendas (trabajadores) a menos de 30 casillas de calle')
    }[worst];
    add('trips', 80, tripText,
        P('Every so often each occupied zone sends a trip along the roads. If it finds no destination within 30 tiles, the zone cannot grow.',
          'Cada cierto tiempo, cada zona ocupada envía un viaje por las calles. Si no encuentra destino a menos de 30 casillas, la zona no puede crecer.'),
        [P('Put homes, shops and factories closer together (within about 20 tiles), joined by roads.',
           'Pon viviendas, tiendas y fábricas más cerca unas de otras (a unas 20 casillas), unidas por calles.'),
         P('Check that the roads really connect: a missing tile breaks the route.', 'Comprueba que las calles de verdad conecten: una casilla que falte corta la ruta.'),
         P('A train depot lets nearby zones travel twice as far.', 'Una estación de tren permite a las zonas cercanas viajar el doble de lejos.')],
        c.tripFailPos);
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
  var valves = {res: v.resValve / 2000, com: v.comValve / 1500, ind: v.indValve / 1500};
  var keys = {res: '1', com: '2', ind: '3'};
  ['res', 'com', 'ind'].forEach(function(t) {
    var d = valves[t], zt = z[t];
    if (d > 0.3 && zt.n > 0 && zt.empty === 0)
      add('more_' + t, 70, P('Zone more {0} land: demand is high and your {1} zones are full', 'Zonifica más terreno {0}: la demanda es alta y tus zonas {1} están llenas',
                             typeName(t), typeName(t, true)),
          P('The {0} demand bar is high and every {1} zone already has buildings.', 'La barra de demanda {0} está alta y todas las zonas {1} ya tienen edificios.',
            typeName(t), typeName(t, true)),
          [P('Zone new land next to a road, with power (key {0}).', 'Zonifica terreno nuevo junto a una calle, con electricidad (tecla {0}).', keys[t])], null, 'neutral');
    else if (d < 0 && zt.empty >= 3) {
      var why = t === 'res' ? P('Few people want to move in right now. Common reasons: not enough jobs, high taxes, pollution or crime.',
                                'Ahora poca gente quiere mudarse. Razones comunes: falta de empleo, impuestos altos, contaminación o delincuencia.')
                            : P('Businesses grow with workers and customers: with few residents, there is little demand.',
                                'Las empresas crecen con trabajadores y clientes: con pocos residentes, hay poca demanda.');
      add('wait_' + t, 62, P('Don\'t zone more {0} for now: {1} {2} zones are still empty', 'No zonifiques más terreno {0} por ahora: {1} zonas {2} siguen vacías',
                             typeName(t), fmt(zt.empty), typeName(t, true)),
          why, [t === 'res' ? P('Add jobs (shops and factories) and keep homes away from pollution.',
                                'Añade empleo (tiendas y fábricas) y mantén las viviendas lejos de la contaminación.')
                            : P('Build homes nearby: they bring workers and customers.', 'Construye viviendas cerca: traen trabajadores y clientes.'),
                P('New zones cost money and upkeep, so fill the empty ones first.', 'Las zonas nuevas cuestan dinero, así que llena primero las vacías.')],
          zt.emptyPos || z.emptyPos[t], 'neutral');
    }
  });

  // ---- Services ----
  if (live.totalPop > 60 && c.policeStationPop === 0)
    add('police', 55, P('Build a police station', 'Construye una estación de policía'),
        P('The city is big enough that residents expect police, and crime grows without it.', 'La ciudad ya es lo bastante grande como para que los residentes esperen policía, y sin ella crece la delincuencia.'),
        [P('Place it in dense or low-value neighbourhoods (key 8).', 'Ponla en vecindarios densos o de poco valor (tecla 8).')]);
  if (live.totalPop > 60 && c.fireStationPop === 0)
    add('fire', 54, P('Build a fire station', 'Construye una estación de bomberos'),
        P('Without fire stations, fires spread freely.', 'Sin estaciones de bomberos, los incendios se extienden sin control.'),
        [P('Spread them out: their reach fades with distance (key 9).', 'Repártelas: su alcance disminuye con la distancia (tecla 9).')]);
  if (b.cityTax > 12)
    add('tax', 65, P('Lower taxes: above 12% residents get upset', 'Baja los impuestos: por encima del 12% los residentes se molestan'),
        P('The tax rate is {0}%.', 'La tasa de impuestos es del {0}%.', b.cityTax),
        [P('Lower it in the Budget window and cut costs instead.', 'Bájala en la ventana de Presupuesto y recorta gastos en su lugar.')]);
  if (c.roadTotal > 30 && b.roadPercent < 0.9)
    add('roadFunds', 45, P('Roads are underfunded and will crumble', 'Las calles tienen pocos fondos y se van a deteriorar'),
        P('Road funding is at {0}%.', 'Los fondos para calles están al {0}%.', Math.round(b.roadPercent * 100)),
        [P('Raise road funding in the Budget window, or build fewer roads.', 'Sube los fondos de las calles en la ventana de Presupuesto, o construye menos calles.')]);

  // ---- Problems ----
  if (live.pollutionAverage > 60)
    add('pollution', 50, P('Pollution is high', 'La contaminación es alta'),
        P('Pollution lowers land value and drives residents away.', 'La contaminación baja el valor del suelo y aleja a los residentes.'),
        [P('Keep industry and coal plants away from homes; leave parks or trees in between.',
           'Mantén la industria y las plantas de carbón lejos de las viviendas; deja parques o árboles entre medio.')],
        {x: map.pollutionMaxX, y: map.pollutionMaxY});
  if (live.crimeAverage > 100)
    add('crime', 50, P('Crime is high', 'La delincuencia es alta'),
        P('Crime grows on cheap land and in crowded areas, and falls near funded police.', 'La delincuencia crece en suelo barato y en zonas abarrotadas, y baja cerca de policía con fondos.'),
        [P('Add police stations where it is worst, and raise land value with parks.', 'Añade estaciones de policía donde es peor, y sube el valor del suelo con parques.')]);
  if (live.trafficAverage > 60)
    add('traffic', 45, P('Traffic is heavy', 'El tráfico es intenso'),
        P('Congested roads pollute and lower land value.', 'Las calles congestionadas contaminan y bajan el valor del suelo.'),
        [P('Add rail and train depots, or parallel roads.', 'Añade vías férreas y estaciones de tren, o calles paralelas.')]);

  // ---- Policy Lab buildings ----
  if (c.depotUnconnected)
    add('depot', 68, N(c.depotUnconnected, '{0} train depot doesn\'t touch a rail line', '{0} train depots don\'t touch a rail line',
                       '{0} estación de tren no toca una vía férrea', '{0} estaciones de tren no tocan una vía férrea'),
        P('A depot only works with rail right next to it.', 'Una estación solo funciona con una vía justo al lado.'),
        [P('Run rail (key 5) up to the depot.', 'Lleva una vía férrea (tecla 5) hasta la estación.')]);
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
    return (list || []).map(function(q) { return {kind: 'zone', x: q.x, y: q.y, label: label, ring: !!ring}; });
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
    trips: frames(c.tripFailList, P('Its trip found no destination', 'Su viaje no encontró destino')),
    needHomes: circleAround(z.com.list.concat(z.ind.list), 20, P('Zone homes inside this circle', 'Zonifica viviendas dentro de este círculo')),
    needJobs: circleAround(z.res.list, 20, P('Zone shops and factories inside this circle', 'Zonifica tiendas y fábricas dentro de este círculo')),
    stadium: circleAround(z.res.list, 10, P('Build the stadium near here', 'Construye el estadio cerca de aquí')),
    depot: frames(c.depotUnconnectedList, P('Needs rail right next to it', 'Necesita una vía justo al lado')),
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
  return {items: items, estimate: est};
};


var Advisor = {
  advise: advise
};


export { Advisor };

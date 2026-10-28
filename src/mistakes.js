/* Policy Lab additions to micropolisJS (2026).
 *
 * This code is released under the GNU GPL v3, with some additional terms, like the rest of micropolisJS.
 * Modified version: NOT the original micropolisJS / Micropolis.
 *
 * "What went wrong" (v26): a report of the planning mistakes in the city as it is now, and in its history, each with
 * what happened, why it matters in this game's rules, what to do, and the spots on the map. It checks the city against
 * the game's own rules (the same ones the advisor and the status bubbles use); it is not a judgement of the policies
 * chosen on the setup screen.
 *
 * Only READS the simulation.
 */

import { Advisor } from './advisor.js';
import { I18n } from './i18n.js';
import { MiscUtils } from './miscUtils.js';
import { Policy } from './policy.js';
import { Reach } from './reach.js';
import { Status } from './status.js';
import { TileUtils } from './tileUtils.js';
import * as TileValues from './tileValues.ts';

var P = I18n.p;
var fmt = MiscUtils.formatNumber;
var money = MiscUtils.formatMoney;

var HEAVY = 128;          // the Query tool's "Heavy" pollution and "Moderate" crime
var NEXT_TO = 4;          // tiles: a home this close to a factory or power plant is "right next to" it
var MAX_SPOTS = 40;

var EMPTY = {res: TileValues.FREEZ, com: TileValues.COMCLR, ind: TileValues.INDCLR};

var isPlant = function(v) {
  return v === TileValues.POWERPLANT || v === TileValues.NUCLEAR;
};

// Every zone and every polluter, with what the maps say about its neighbourhood
var survey = function(sim) {
  var map = sim._map, bm = sim.blockMaps;
  var out = {homes: [], shops: [], factories: [], plants: [], deadEnds: [], drawbridges: 0, noPower: [], noRoad: []};
  for (var x = 0; x < map.width; x++) {
    for (var y = 0; y < map.height; y++) {
      var tile = map.getTile(x, y), v = tile.getValue();
      if (Reach.isDrivable(map, x, y)) {
        if (Reach.isDrawbridge(map, x, y))
          out.drawbridges++;
        else if (TileUtils.isRoad(v) && Reach.countLinks(map, x, y) <= 1 && !Reach.nextToOpenBridge(map, x, y))
          out.deadEnds.push({x: x, y: y});
        continue;
      }
      if (!tile.isZone())
        continue;
      if (isPlant(v)) {
        out.plants.push({x: x, y: y, nuclear: v === TileValues.NUCLEAR});
        continue;
      }
      var type = TileUtils.isResidential(v) && v < TileValues.HOSPITALBASE ? 'res' : TileUtils.isCommercial(v) ? 'com' :
                 TileUtils.isIndustrial(v) ? 'ind' : null;
      if (!type)
        continue;
      var z = {x: x, y: y, type: type, empty: Advisor.isEmptyZone(map, x, y, v, type), pollution: bm.pollutionDensityMap.worldGet(x, y),
               crime: bm.crimeRateMap.worldGet(x, y), police: bm.policeStationEffectMap.worldGet(x, y)};
      (type === 'res' ? out.homes : type === 'com' ? out.shops : out.factories).push(z);
      if (!tile.isPowered())
        out.noPower.push(z);
    }
  }
  return out;
};

var near = function(a, list, d) {
  for (var i = 0; i < list.length; i++)
    if (Math.abs(list[i].x - a.x) <= d && Math.abs(list[i].y - a.y) <= d)
      return list[i];
  return null;
};

var frames = function(list, label) {
  return list.slice(0, MAX_SPOTS).map(function(q) { return {kind: 'zone', x: q.x, y: q.y, label: label}; });
};

// The report. game is the running Game (for the advisor's findings and the city's name); returns
// {city, year, findings: [{id, weight, title, why, fix, targets}], good: [...]}
var report = function(game) {
  var sim = game.simulation, map = sim._map;
  var s = survey(sim);
  var c = sim.lastCensus || sim._census.snapshot();
  var b = sim.budget, v = sim._valves;
  var findings = [], good = [];
  var add = function(id, weight, title, why, fix, targets) {
    findings.push({id: id, weight: weight, title: title, why: why, fix: fix, targets: targets || []});
  };

  // ---- Homes and industry
  var industry = s.factories.filter(function(f) { return !f.empty; }).concat(s.plants.filter(function(p) { return !p.nuclear; }));
  var besideIndustry = s.homes.filter(function(h) { return near(h, industry, NEXT_TO); });
  var inSmog = s.homes.filter(function(h) { return h.pollution >= HEAVY; });
  if (inSmog.length) {
    var byIndustry = inSmog.filter(function(h) { return near(h, industry, NEXT_TO + 4); }).length;
    add('smog', 90 + inSmog.length,
        P('{0} home zones sit in heavy pollution', '{0} zonas residenciales están en contaminación fuerte', fmt(inSmog.length)),
        P('Pollution lowers land value, and homes in very heavy pollution stop growing (in this game a home\'s chance to grow is its land value minus the pollution). {0} of them are within about 8 tiles of a factory or a coal plant.',
          'La contaminación baja el valor del suelo, y las viviendas con contaminación muy fuerte dejan de crecer (en este juego, la probabilidad de que una vivienda crezca es el valor de su suelo menos la contaminación). {0} de ellas están a unas 8 casillas de una fábrica o una planta de carbón.', fmt(byIndustry)),
        P('Move industry and coal plants away from homes (factories don\'t need to be near homes to grow), or put a big park (key G) between them: it cleans the air within 8 tiles.',
          'Aleja la industria y las plantas de carbón de las viviendas (las fábricas no necesitan estar cerca de las viviendas para crecer), o pon un parque grande (tecla G) entre ellas: limpia el aire a menos de 8 casillas.'),
        frames(inSmog, P('Heavy pollution', 'Contaminación fuerte')));
  } else if (besideIndustry.length) {
    add('besideIndustry', 40 + besideIndustry.length,
        P('{0} home zones are right next to industry or a power plant', '{0} zonas residenciales están justo al lado de la industria o de una planta eléctrica', fmt(besideIndustry.length)),
        P('The air there isn\'t heavy yet, but pollution spreads a few tiles and grows as the factories fill up.',
          'El aire allí todavía no está muy contaminado, pero la contaminación se extiende unas casillas y crece a medida que las fábricas se llenan.'),
        P('Keep a gap of parks or trees between homes and industry, or zone new homes further away.',
          'Deja un espacio con parques o árboles entre las viviendas y la industria, o zonifica las viviendas nuevas más lejos.'),
        frames(besideIndustry, P('Next to industry', 'Junto a la industria')));
  } else if (s.homes.length && industry.length) {
    good.push(P('Homes are kept away from industry.', 'Las viviendas están lejos de la industria.'));
  }

  // ---- Crime without police
  var unsafe = s.homes.filter(function(h) { return h.crime >= HEAVY && h.police === 0; });
  if (unsafe.length)
    add('crimeNoPolice', 70 + unsafe.length,
        P('{0} home zones have high crime and no police nearby', '{0} zonas residenciales tienen mucha delincuencia y ninguna policía cerca', fmt(unsafe.length)),
        P('In this game crime rises on cheap land and in crowded areas, and falls near funded police stations and parks.',
          'En este juego la delincuencia sube en suelo barato y en zonas abarrotadas, y baja cerca de estaciones de policía con fondos y de los parques.'),
        P('Build a police station (key 8) among these homes and fund it fully; a big park helps too.', 'Construye una estación de policía (tecla 8) entre estas viviendas y dale todos los fondos; un parque grande también ayuda.'),
        frames(unsafe, P('High crime, no police', 'Mucha delincuencia, sin policía')));

  // ---- Empty zones (v29): a problem only when they are stuck, or when many stand empty while the city wants no more
  var need = game._need || {};
  var names = {res: P('home', 'residenciales'), com: P('shop', 'comerciales'), ind: P('factory', 'industriales')};
  ['res', 'com', 'ind'].forEach(function(t) {
    var nd = need[t];
    if (!nd || !nd.empty)
      return;
    var list = (t === 'res' ? s.homes : t === 'com' ? s.shops : s.factories).filter(function(z) { return z.empty; });
    if (nd.badSpot)
      add('badSpot_' + t, 35 + nd.badSpot * 3,
          P('{0} empty home zones are in spots where homes can\'t grow', '{0} zonas residenciales vacías están en lugares donde no pueden crecer viviendas', fmt(nd.badSpot)),
          P('A home grows only where land value minus pollution is high enough for the current demand. These spots are too polluted or too cheap.',
            'Una vivienda solo crece donde el valor del suelo menos la contaminación es suficiente para la demanda actual. Estos lugares están demasiado contaminados o son demasiado baratos.'),
          P('Move factories and busy roads away, add a park or a police station nearby, or zone homes where the "Where to zone" layer is green.',
            'Aleja las fábricas y las calles con mucho tráfico, añade un parque o una estación de policía cerca, o zonifica viviendas donde la capa "Dónde zonificar" está en verde.'),
          frames(list, P('Empty', 'Vacía')));
    var tooMany = nd.demand <= 0 && nd.filling > Math.max(2, Math.floor(nd.n * 0.3));
    if (tooMany)
      add('empty_' + t, 30 + nd.filling * 2,
          P('{0} of your {1} {2} zones stand empty and the city wants no more', '{0} de tus {1} zonas {2} están vacías y la ciudad no quiere más', fmt(nd.filling), fmt(nd.n), names[t]),
          P('More was zoned than the city wanted. Every zone cost money to build, and its roads cost upkeep every year.',
            'Se zonificó más de lo que la ciudad quería. Cada zona costó dinero, y sus calles cuestan mantenimiento todos los años.'),
          P('Wait for the Zoning need bar to rise above the line before zoning more of this kind. If homes are the ones empty, the city needs jobs: zone shops or factories.',
            'Espera a que la barra de Necesidad de zonas suba por encima de la línea antes de zonificar más de este tipo. Si las vacías son viviendas, la ciudad necesita empleos: zonifica comercios o fábricas.'),
          frames(list, P('Empty', 'Vacía')));
  });

  // ---- Zones without power or road
  if (s.noPower.length)
    add('noPower', 80 + s.noPower.length,
        P('{0} zones have no power', '{0} zonas no tienen electricidad', fmt(s.noPower.length)),
        P('Zones without power don\'t grow, and the score is cut in proportion.', 'Las zonas sin electricidad no crecen, y la puntuación baja en proporción.'),
        P('Connect them with power lines (zones that touch pass power along), or build another plant if the one you have is full.',
          'Conéctalas con cables (las zonas que se tocan se pasan la electricidad), o construye otra planta si la que tienes está llena.'),
        frames(s.noPower, P('No power', 'Sin electricidad')));

  // ---- Shops that can't reach customers (the advisor's red frames)
  var stuck = game._stuckShops || [];
  if (stuck.length)
    add('stuckShops', 75 + stuck.length,
        P('{0} shops can\'t reach customers, so they can\'t grow', '{0} tiendas no llegan a sus clientes, así que no pueden crecer', fmt(stuck.length)),
        P('A shop sends a car along the roads now and then; if it reaches no home, shop or factory within {0} road tiles, the shop can\'t grow (1989 rule). Dead ends and drawbridges stop the car.',
          'Una tienda envía de vez en cuando un carro por las calles; si no llega a ninguna vivienda, tienda o fábrica a menos de {0} casillas, la tienda no puede crecer (regla de 1989). Las calles sin salida y los puentes levadizos detienen el carro.', Reach.maxDist()),
        P('Connect their roads to the rest of the city, remove dead ends, or use a highway (trips go three times as far on it).',
          'Conecta sus calles con el resto de la ciudad, quita las calles sin salida, o usa una autopista (los viajes llegan tres veces más lejos).'),
        frames(stuck, P('Can\'t reach customers', 'No llega a sus clientes')));

  // ---- Road that serves nothing (v29: replaces "N dead-end roads"). A dead end beside zones is fine: those zones
  // need that road, and in this game only shops need their car trips to succeed (they get their own finding above).
  // What wastes money is a stub: a dead-end stretch of road that no building touches, and a city with far more road
  // than zones.
  var touchesBuilding = function(x, y) {
    for (var k = 0; k < 4; k++) {
      var nx = x + [1, -1, 0, 0][k], ny = y + [0, 0, 1, -1][k];
      if (map.testBounds(nx, ny) && map.getTileValue(nx, ny) >= TileValues.RESBASE)
        return true;
    }
    return false;
  };
  var stubTiles = [], seen = {};
  s.deadEnds.forEach(function(d) {
    var path = [], x = d.x, y = d.y, px = -1, py = -1, ok = true;
    for (var steps = 0; steps < 200; steps++) {
      var key = x + ',' + y;
      if (seen[key] || touchesBuilding(x, y)) { ok = !touchesBuilding(x, y) && ok; break; }
      if (Reach.countLinks(map, x, y) >= 3) break;   // a junction: the stub ends here
      path.push({x: x, y: y});
      var next = null;
      for (var k = 0; k < 4; k++) {
        var nx = x + [1, -1, 0, 0][k], ny = y + [0, 0, 1, -1][k];
        if ((nx !== px || ny !== py) && Reach.isDrivable(map, nx, ny)) { next = [nx, ny]; break; }
      }
      if (!next) break;
      px = x; py = y; x = next[0]; y = next[1];
    }
    path.forEach(function(q) { seen[q.x + ',' + q.y] = true; stubTiles.push(q); });
  });
  var zones = s.homes.length + s.shops.length + s.factories.length;
  var roadsAll = Status.measure(sim).roads;
  var perTile = roadsAll ? (sim.budget.roadMaintenanceBudget || 0) / roadsAll : 0;
  var tooMuch = roadsAll > 80 && roadsAll > 8 * Math.max(1, zones);
  if (stubTiles.length >= 6 || tooMuch)
    add('roadWaste', 25 + Math.min(40, stubTiles.length) + (tooMuch ? 20 : 0),
        tooMuch ? P('Too much road: {0} road tiles for {1} zones', 'Demasiadas calles: {0} casillas de calle para {1} zonas', fmt(roadsAll), fmt(zones))
                : P('{0} road tiles lead to no zone', '{0} casillas de calle no llevan a ninguna zona', fmt(stubTiles.length)),
        P('Every road tile costs upkeep every year (about {0} for the {1} that lead to no zone). A compact city needs about 3-4 road tiles per zone. Dead ends beside zones are fine: those zones need the road.',
          'Cada casilla de calle cuesta mantenimiento todos los años (unos {0} por las {1} que no llevan a ninguna zona). Una ciudad compacta necesita unas 3-4 casillas de calle por zona. Las calles sin salida junto a zonas están bien: esas zonas necesitan la calle.',
          MiscUtils.formatMoney(Math.round(perTile * stubTiles.length)), fmt(stubTiles.length)),
        P('Bulldoze the marked stretches, or zone along them so they earn their upkeep. Build new road only when you zone next to it.',
          'Demuele los tramos marcados, o zonifica a lo largo de ellos para que paguen su mantenimiento. Construye calles nuevas solo cuando vayas a zonificar a su lado.'),
        stubTiles.slice(0, MAX_SPOTS).map(function(q) { return {kind: 'dead', x: q.x, y: q.y, label: ''}; }));

  // ---- Growth stopped by a missing landmark
  [['resCap', 'stadium', P('a stadium', 'un estadio'), P('residential', 'residencial')],
   ['comCap', 'airport', P('an airport', 'un aeropuerto'), P('commercial', 'comercial')],
   ['indCap', 'seaport', P('a seaport', 'un puerto'), P('industrial', 'industrial')]].forEach(function(q) {
    if (v[q[0]])
      add('cap_' + q[1], 85,
          P('Growth is capped: the city needs {0}', 'El crecimiento está limitado: la ciudad necesita {0}', q[2]),
          P('Until it is built, {0} demand can\'t rise above zero, and the score loses 15% every year.',
            'Hasta que se construya, la demanda {0} no puede subir de cero, y la puntuación pierde un 15% cada año.', q[3]),
          P('Build {0}, connected by road and power.', 'Construye {0}, conectado por calle y con electricidad.', q[2]), []);
  });

  // ---- Traffic
  var m = Status.measure(sim);
  if (m.roads && m.heavy >= 0.25)   // v29: more lenient (was 15%)
    add('traffic', 50 + Math.round(m.heavy * 100),
        P('{0} of the roads are jammed', '{0} de las calles están congestionadas', Math.round(m.heavy * 100) + '%'),
        P('Congested roads pollute and lower land value around them.', 'Las calles congestionadas contaminan y bajan el valor del suelo a su alrededor.'),
        P('Add a highway (key E) or rail with two linked train depots, or put jobs closer to homes.',
          'Añade una autopista (tecla E) o vías con dos estaciones de tren unidas, o pon los empleos más cerca de las viviendas.'), []);

  // ---- Depots
  if (c.depotUnconnected || c.depotUnlinked)
    add('depots', 60,
        P('{0} train depots do nothing', '{0} estaciones de tren no hacen nada', fmt((c.depotUnconnected || 0) + (c.depotUnlinked || 0))),
        P('A depot only works with rail touching it that leads to another depot, or loops back so the train can turn around. You still pay its upkeep.',
          'Una estación solo funciona con una vía que la toque y lleve a otra estación, o que dé la vuelta para que el tren pueda regresar. Aun así pagas su mantenimiento.'),
        P('Run its rail round a loop of at least 16 tiles and back, or to a second depot.', 'Haz que su vía dé una vuelta de al menos 16 casillas y regrese, o llévala a una segunda estación.'),
        frames((c.depotUnconnectedList || []).concat(c.depotUnlinkedList || []), P('Not working', 'No funciona')));

  // ---- Drawbridges
  if (s.drawbridges)
    add('drawbridges', 25,
        P('{0} road bridges are drawbridges', '{0} puentes de calle son levadizos', fmt(s.drawbridges)),
        P('They cross the shipping channel, so they open for ships (and sometimes at random), cutting the road while open.',
          'Cruzan el canal de navegación, así que se abren para los barcos (y a veces al azar), cortando la calle mientras están abiertos.'),
        P('Upgrade them to highway (its bridges never open), cross with rail, or build a second bridge.',
          'Mejóralos a autopista (sus puentes nunca se abren), cruza con vías, o construye un segundo puente.'), []);

  // ---- Money: deficit years, high taxes, underfunding
  var years = (Policy.history && Policy.history.years) || [];
  var deficits = years.filter(function(y) { return y.v < 0; });
  if (deficits.length) {
    var worst = deficits.reduce(function(a, y) { return y.v < a.v ? y : a; });
    add('deficits', 35 + deficits.length * 5,
        P('The city ran a deficit in {0} of its {1} years', 'La ciudad tuvo déficit en {0} de sus {1} años', fmt(deficits.length), fmt(years.length)),
        P('The worst was {0}: {1}. Upkeep (roads, rail, police, fire, services) grows with everything you build; taxes grow with population and land value.',
          'El peor fue {0}: {1}. El mantenimiento (calles, vías, policía, bomberos, servicios) crece con todo lo que construyes; los impuestos crecen con la población y el valor del suelo.',
          worst.y, '−' + money(-worst.v)),
        P('Build roads and services when they are needed, not ahead of time, and let the population grow into them. The charts under Funds show each year.',
          'Construye calles y servicios cuando hagan falta, no antes, y deja que la población crezca. Los gráficos bajo Fondos muestran cada año.'), []);
  } else if (years.length >= 3) {
    good.push(P('No deficit years so far.', 'Ningún año con déficit hasta ahora.'));
  }
  var months = (Policy.history && Policy.history.months) || [];
  var highTax = months.filter(function(q) { return q.tax > 12; }).length;
  if (highTax >= 12)
    add('tax', 45,
        P('Taxes were above 12% for {0} months', 'Los impuestos estuvieron por encima del 12% durante {0} meses', fmt(highTax)),
        P('High taxes slow every kind of growth, and the tax rate is subtracted from the score.', 'Los impuestos altos frenan todo tipo de crecimiento, y la tasa se resta de la puntuación.'),
        P('Keep taxes at 7-9% and cut upkeep instead.', 'Mantén los impuestos entre el 7 y el 9% y recorta el mantenimiento.'), []);
  if (c.roadTotal > 30 && b.roadPercent < 0.9)
    add('roadFunds', 55,
        P('Roads are underfunded ({0}%)', 'Las calles tienen pocos fondos ({0}%)', Math.round(b.roadPercent * 100)),
        P('Underfunded roads crumble (and bridges fall into the water), and the score is cut.',
          'Las calles con pocos fondos se deterioran (y los puentes se caen al agua), y la puntuación baja.'),
        P('Raise road funding in the Budget window, or build less road.', 'Sube los fondos de las calles en la ventana de Presupuesto, o construye menos calles.'), []);

  // ---- The score's history
  var ev = sim.evaluation;
  findings.sort(function(a, c2) { return c2.weight - a.weight; });
  return {city: game.name, year: sim.getDate().year, score: ev.cityScore, findings: findings, good: good};
};

// The report as plain text (for Copy)
var asText = function(r) {
  var lines = [P('{0}, {1}: what I did wrong and what to do (score {2})', '{0}, {1}: qué hice mal y qué hacer (puntuación {2})', r.city, r.year, r.score), ''];
  if (!r.findings.length)
    lines.push(P('No planning mistakes found right now.', 'Ahora mismo no se encontraron errores de planificación.'));
  r.findings.forEach(function(f, i) {
    lines.push((i + 1) + '. ' + f.title);
    lines.push('   ' + P('Why: {0}', 'Por qué: {0}', f.why));
    lines.push('   ' + P('What to do: {0}', 'Qué hacer: {0}', f.fix));
    lines.push('');
  });
  if (r.good.length)
    lines.push(P('Going well: {0}', 'Va bien: {0}', r.good.join(' ')));
  return lines.join('\n');
};


var Mistakes = {
  report: report,
  asText: asText
};


export { Mistakes };

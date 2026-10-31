/* Policy Lab additions to micropolisJS (2026).
 *
 * This code is released under the GNU GPL v3, with some additional terms, like the rest of micropolisJS.
 * Modified version: NOT the original micropolisJS / Micropolis.
 *
 * Map layers: colour the whole map to answer one question at a time.
 *  - Pollution: where the air is bad (the game's own pollution map, in its four levels: none, moderate, heavy, very
 *    heavy - the same words the Query tool uses).
 *  - Dead ends: every road or rail tile a car can only enter from one side (and drawbridges, which cut the road while
 *    open).
 *  - Where to zone (v29): open land and home zones coloured by how well a home would grow there (the game's own rule:
 *    land value minus pollution), and shops framed by whether their trips succeed. Factories grow anywhere with a road
 *    and power, so they are not coloured.
 *
 * Only READS the simulation.
 */

import { Advisor } from './advisor.js';
import { I18n } from './i18n.js';
import { Influence } from './influence.js';
import { MiscUtils } from './miscUtils.js';
import { Policy } from './policy.js';
import { Reach } from './reach.js';
import { TileUtils } from './tileUtils.js';
import * as TileValues from './tileValues.ts';
import { Utilities } from './utilities.js';

var P = I18n.p;
var fmt = MiscUtils.formatNumber;

var pollution = function(sim) {
  var bm = sim.blockMaps.pollutionDensityMap;
  var cells = [], counts = [0, 0, 0, 0];
  for (var bx = 0; bx < bm.width; bx++) {
    for (var by = 0; by < bm.height; by++) {
      var level = MiscUtils.clamp(Math.floor(bm.get(bx, by) / 64), 0, 3);
      counts[level]++;
      if (level > 0)
        cells.push([bx * bm.blockSize, by * bm.blockSize, level]);
    }
  }
  return {
    shapes: [{kind: 'blocks', size: bm.blockSize, cells: cells}],
    legend: [
      {swatch: 'pol1', text: P('Moderate', 'Moderada')},
      {swatch: 'pol2', text: P('Heavy', 'Fuerte')},
      {swatch: 'pol3', text: P('Very heavy: homes stop growing', 'Muy fuerte: las viviendas dejan de crecer')}
    ],
    note: P('No colour = clean air. Same levels as the Query tool.', 'Sin color = aire limpio. Los mismos niveles que la herramienta Consultar.')
  };
};

// v30 "Roads": dead ends (orange), road that leads to no zone (red), drawbridges, and the shipping channel
var roads = function(sim) {
  var map = sim._map, shapes = [];
  var rs = Reach.roadSurvey(map);
  var stubKey = {};
  rs.stubs.forEach(function(q) { stubKey[q.x + ',' + q.y] = true; shapes.push({kind: 'stub', x: q.x, y: q.y}); });
  var dead = 0;
  rs.deadEnds.forEach(function(q) {
    if (!stubKey[q.x + ',' + q.y]) { shapes.push({kind: 'dead', x: q.x, y: q.y, label: ''}); dead++; }
  });
  var open = 0;
  for (var x = 0; x < map.width; x++)
    for (var y = 0; y < map.height; y++)
      if (Reach.isDrivable(map, x, y) && Reach.countLinks(map, x, y) <= 1 && Reach.nextToOpenBridge(map, x, y)) {
        shapes.push({kind: 'bridge', x: x, y: y, open: true, label: ''});
        open++;
      }
  rs.drawbridges.forEach(function(q) { shapes.push({kind: 'bridge', x: q.x, y: q.y, open: false, label: ''}); });
  return {
    shapes: shapes,
    legend: [
      {swatch: 'stub', text: P('Road that leads to no zone (only costs upkeep): {0} tiles', 'Calle que no lleva a ninguna zona (solo cuesta mantenimiento): {0} casillas', fmt(rs.stubs.length))},
      {swatch: 'dead', text: P('Dead end beside zones (fine): {0}', 'Calle sin salida junto a zonas (está bien): {0}', fmt(dead))},
      {swatch: 'bridge', text: P('Drawbridge: {0}', 'Puente levadizo: {0}', fmt(rs.drawbridges.length + open))}
    ].concat(Reach.channelTiles(map).length
      ? [{swatch: 'channel', text: P('Shipping channel (dashed water): a road bridge across it is a drawbridge; ships pass under highway and rail bridges and power lines',
                                     'Canal de navegación (agua con guiones): un puente de calle que lo cruce es levadizo; los barcos pasan bajo los puentes de autopista y de tren y bajo los cables')}]
      : []),
    note: P('A car that drives into a dead end gives up its trip. Only shops need their trips to succeed, so a dead end beside homes or factories is fine; a dead end no zone touches only costs upkeep.', 'Un carro que entra en una calle sin salida abandona su viaje. Solo las tiendas necesitan que sus viajes tengan éxito, así que una calle sin salida junto a viviendas o fábricas está bien; una que no toca ninguna zona solo cuesta mantenimiento.')
  };
};

// v30: empty zones of one kind that can't fill now, each with the reason (shown on the "Where to zone" layers)
var stuckZones = function(sim, type) {
  var map = sim._map, bm = sim.blockMaps, out = [];
  var valve = sim._valves ? sim._valves.resValve : 0;
  for (var x = 0; x < map.width; x++) {
    for (var y = 0; y < map.height; y++) {
      var tile = map.getTile(x, y);
      if (!tile.isZone())
        continue;
      var v = tile.getValue();
      if (!Advisor.isEmptyZone(map, x, y, v, type))
        continue;
      var why = null;
      if (!Advisor.hasRoad(map, x, y)) why = P('No road', 'Sin calle');
      else if (!tile.isPowered()) why = P('No power', 'Sin electricidad');
      else if (type === 'res') {
        var pol = bm.pollutionDensityMap.worldGet(x, y), lv = bm.landValueMap.worldGet(x, y);
        var score = Math.min(6000, Math.max(0, lv - pol) * 32) - 3000 + valve;
        if (pol > 128) why = P('Too polluted', 'Demasiado contaminada');
        else if (score <= -350) why = pol >= 64 ? P('Too polluted', 'Demasiado contaminada')
                                                : valve < 0 ? P('No demand for homes', 'No hay demanda de viviendas')
                                                            : P('Land too cheap', 'Suelo demasiado barato');
      }
      if (why)
        out.push({kind: 'zone', x: x, y: y, tone: 'bad', label: why});
    }
  }
  return out;
};

var stuckLegend = function(n) {
  return {swatch: 'bad', text: P('Empty and stuck (the reason is on the map): {0}', 'Vacías y atascadas (el motivo está en el mapa): {0}', fmt(n))};
};

// v29: how would a home do on this 2x2 block, at today's demand? The game's rule (residential.js): the zone's score is
// the demand for homes plus (land value - pollution) x 32, capped at 6000, minus 3000. Above -350 an empty zone can grow;
// at 350 or more it never shrinks back; at -350 or less it cannot grow at all. Open land has no land value yet, so it is estimated the way the game will
// work it out once something is built there (the same parts the Query tool lists).
var homeScore = function(sim, x, y) {
  var bm = sim.blockMaps;
  var lv = bm.landValueMap.worldGet(x, y);
  if (!lv) {
    lv = 0;
    Influence.landValueParts(sim, x, y).forEach(function(r) { lv += r.value; });
    lv = MiscUtils.clamp(lv, 1, 250);
  }
  return Math.max(0, lv - bm.pollutionDensityMap.worldGet(x, y));
};

var openOrHome = function(v) {
  return v === TileValues.DIRT || (v >= TileValues.WOODS_LOW && v <= TileValues.WOODS_HIGH) ||
         (TileUtils.isResidential(v) && v !== TileValues.HOSPITAL);
};

var zoningRes = function(sim, game) {
  var map = sim._map, bm = sim.blockMaps.landValueMap, size = bm.blockSize;
  var cells = [], counts = [0, 0, 0, 0];
  var valve = sim._valves ? sim._valves.resValve : 0;
  for (var bx = 0; bx < bm.width; bx++) {
    for (var by = 0; by < bm.height; by++) {
      var x = bx * size, y = by * size;
      var ok = false;
      for (var dx = 0; dx < size && !ok; dx++)
        for (var dy = 0; dy < size && !ok; dy++)
          if (map.testBounds(x + dx, y + dy) && openOrHome(map.getTileValue(x + dx, y + dy)))
            ok = true;
      if (!ok)
        continue;
      var score = Math.min(6000, homeScore(sim, x, y) * 32) - 3000 + valve;
      var level = score >= 350 ? 1 : score > -350 ? 2 : 3;
      counts[level]++;
      cells.push([x, y, level]);
    }
  }
  var stuckList = stuckZones(sim, 'res');
  var shapes = [{kind: 'blocks', size: size, cells: cells, cls: 'wz'}].concat(stuckList);
  return {
    shapes: shapes,
    legend: [
      {swatch: 'wz1', text: P('Homes grow and stay', 'Las viviendas crecen y se quedan')},
      {swatch: 'wz2', text: P('Homes may grow, and may empty again', 'Las viviendas pueden crecer, y vaciarse otra vez')},
      {swatch: 'wz3', text: P('Homes can\'t grow now (too polluted, too cheap, or no demand)', 'Ahora las viviendas no pueden crecer (demasiado contaminado, barato, o sin demanda)')},
      stuckLegend(stuckList.length)
    ],
    note: P('Today\'s demand for homes plus land value minus pollution: the game\'s own rule. It changes as demand changes.',
            'La demanda de viviendas de hoy más el valor del suelo menos la contaminación: la regla del propio juego. Cambia cuando cambia la demanda.')
  };
};


// v30: where shops would grow. A shop's score is the demand for shops plus how close it is to the city centre, and it
// grows only if its car trips reach a home, shop or factory along the roads.
var zoningCom = function(sim, game) {
  var map = sim._map, bm = sim.blockMaps, cc = bm.cityCentreDistScoreMap, size = 2;
  var cells = [];
  for (var x = 0; x < map.width; x += size) {
    for (var y = 0; y < map.height; y += size) {
      var v = map.getTileValue(x, y);
      if (!openOrBuilt(v, TileUtils.isCommercial))
        continue;
      var c = cc.worldGet(x, y);
      cells.push([x, y, c >= 32 ? 1 : c >= 0 ? 2 : 3]);
    }
  }
  var stuck = ((game && game._stuckShops) || []).map(function(q) { return {kind: 'zone', x: q.x, y: q.y, tone: 'bad', label: P('Trips fail', 'Viajes fallan')}; });
  var stuckList = stuckZones(sim, 'com').concat(stuck);
  return {
    shapes: [{kind: 'blocks', size: size, cells: cells, cls: 'wz'}].concat(stuckList),
    legend: [
      {swatch: 'wz1', text: P('Near the city centre: shops do best', 'Cerca del centro: las tiendas van mejor')},
      {swatch: 'wz2', text: P('Middle distance', 'Distancia media')},
      {swatch: 'wz3', text: P('Far from the centre', 'Lejos del centro')},
      stuckLegend(stuckList.length)
    ],
    note: P('Shops grow with the city\'s demand for shops, a little better near the centre, and only if their car can reach a home, shop or factory along the roads (no dead end in the way).',
            'Las tiendas crecen con la demanda de tiendas, algo mejor cerca del centro, y solo si su carro llega a una vivienda, tienda o fábrica por las calles (sin calle sin salida en el camino).')
  };
};

// v30: where factories would do least harm: they grow anywhere with power and a road, but their pollution spreads to
// homes within about 10 tiles
var zoningInd = function(sim) {
  var map = sim._map, size = 2, homes = [];
  for (var x = 0; x < map.width; x++)
    for (var y = 0; y < map.height; y++) {
      var t = map.getTile(x, y);
      if (t.isZone() && TileUtils.isResidential(t.getValue()) && t.getValue() < TileValues.HOSPITALBASE)
        homes.push([x, y]);
    }
  var cells = [];
  for (x = 0; x < map.width; x += size) {
    for (y = 0; y < map.height; y += size) {
      if (!openOrBuilt(map.getTileValue(x, y), TileUtils.isIndustrial))
        continue;
      var d = 999;
      for (var i = 0; i < homes.length; i++) {
        var dx = homes[i][0] - x, dy = homes[i][1] - y, dd = Math.sqrt(dx * dx + dy * dy);
        if (dd < d) d = dd;
      }
      cells.push([x, y, d >= 12 ? 1 : d >= 7 ? 2 : 3]);
    }
  }
  var stuckList = stuckZones(sim, 'ind');
  return {
    shapes: [{kind: 'blocks', size: size, cells: cells, cls: 'wz'}].concat(stuckList),
    legend: [
      {swatch: 'wz1', text: P('12+ tiles from homes: good for factories', 'A 12 casillas o más de viviendas: bien para fábricas')},
      {swatch: 'wz2', text: P('7-12 tiles from homes: their smoke may reach', 'A 7-12 casillas de viviendas: su humo puede llegar')},
      {swatch: 'wz3', text: P('Within 7 tiles of homes: avoid', 'A menos de 7 casillas de viviendas: evítalo')},
      stuckLegend(stuckList.length)
    ],
    note: P('Factories grow anywhere with power and a road, with the city\'s demand for industry. Keep them away from homes: their pollution spreads several tiles.',
            'Las fábricas crecen en cualquier lugar con electricidad y calle, según la demanda de industria. Mantenlas lejos de las viviendas: su contaminación se extiende varias casillas.')
  };
};

var openOrBuilt = function(v, own) {
  return v === TileValues.DIRT || (v >= TileValues.WOODS_LOW && v <= TileValues.WOODS_HIGH) || own(v);
};

// v30: Water: which zones have their sewage treated, and which send it into the water
var water = function(sim) {
  var map = sim._map, bm = sim.blockMaps, shapes = [], treated = 0, toWater = 0, away = 0;
  for (var x = 0; x < map.width; x++)
    for (var y = 0; y < map.height; y++) {
      var t = map.getTile(x, y), v = t.getValue();
      if (!t.isZone() || !(TileUtils.isResidential(v) || TileUtils.isCommercial(v) || TileUtils.isIndustrial(v)) || v >= TileValues.HOSPITALBASE && v < TileValues.COMBASE)
        continue;
      if (bm.waterMap.worldGet(x, y) > 0) { treated++; shapes.push({kind: 'zone', x: x, y: y, tone: 'good', label: ''}); }
      else if (Utilities.nearestWater(map, x, y)) { toWater++; shapes.push({kind: 'zone', x: x, y: y, tone: 'bad', label: ''}); }
      else away++;
    }
  return {
    shapes: shapes,
    legend: [
      {swatch: 'good', text: P('Sewage treated: {0} zones', 'Aguas residuales tratadas: {0} zonas', fmt(treated))},
      {swatch: 'bad', text: P('Raw sewage into the water: {0} zones', 'Aguas residuales sin tratar al agua: {0} zonas', fmt(toWater))}
    ],
    note: P('Zones within {0} tiles of water send their sewage into it unless a powered water treatment plant within {1} tiles serves them. {2} zones are too far from water to matter.',
            'Las zonas a menos de {0} casillas del agua echan en ella sus aguas residuales, salvo que una planta de tratamiento con electricidad a menos de {1} casillas las atienda. {2} zonas están demasiado lejos del agua para importar.',
            Utilities.SEWAGE_SEARCH_RADIUS, Utilities.WATER_RADIUS, fmt(away))
  };
};

// v30: Fire: fire-station cover (the game's fire map, in three levels) and the homes outside it
var fire = function(sim) {
  var map = sim._map, bm = sim.blockMaps, fe = bm.fireStationEffectMap, cells = [], out = 0;
  for (var bx = 0; bx < fe.width; bx++)
    for (var by = 0; by < fe.height; by++) {
      var fv = fe.get(bx, by);
      if (fv > 0)
        cells.push([bx * fe.blockSize, by * fe.blockSize, fv >= 100 ? 2 : 1]);
    }
  var shapes = [{kind: 'blocks', size: fe.blockSize, cells: cells, cls: 'fir'}];
  for (var x = 0; x < map.width; x++)
    for (var y = 0; y < map.height; y++) {
      var t = map.getTile(x, y);
      if (t.isZone() && TileUtils.isResidential(t.getValue()) && t.getValue() < TileValues.HOSPITALBASE &&
          bm.fireStationEffectMap.worldGet(x, y) === 0) {
        out++;
        shapes.push({kind: 'zone', x: x, y: y, tone: 'bad', label: ''});
      }
    }
  return {
    shapes: shapes,
    legend: [
      {swatch: 'fir1', text: P('Light cover', 'Cobertura ligera')},
      {swatch: 'fir2', text: P('Good cover', 'Buena cobertura')},
      {swatch: 'bad', text: P('Homes with no fire cover: {0}', 'Viviendas sin cobertura de bomberos: {0}', fmt(out))}
    ],
    note: P('Fire stations stop fires spreading. Fires start from disasters (when they are on), crashes, shipwrecks and meltdowns.',
            'Las estaciones de bomberos impiden que los incendios se extiendan. Los incendios empiezan por desastres (si están activados), accidentes, naufragios y fusiones nucleares.')
  };
};


// POLICY LAB v21: crime, traffic and power layers (opened from the status bubbles)
var levelBlocks = function(bm, cls) {
  var cells = [];
  for (var bx = 0; bx < bm.width; bx++)
    for (var by = 0; by < bm.height; by++) {
      var level = MiscUtils.clamp(Math.floor(bm.get(bx, by) / 64), 0, 3);
      if (level > 0)
        cells.push([bx * bm.blockSize, by * bm.blockSize, level]);
    }
  return {kind: 'blocks', size: bm.blockSize, cells: cells, cls: cls};
};

var crime = function(sim) {
  return {
    shapes: [levelBlocks(sim.blockMaps.crimeRateMap, 'cri')],
    legend: [
      {swatch: 'cri1', text: P('Light', 'Leve')},
      {swatch: 'cri2', text: P('Moderate', 'Moderada')},
      {swatch: 'cri3', text: P('Dangerous', 'Peligrosa')}
    ],
    note: P('No colour = safe. Same levels as the Query tool. Only built-up land has a crime score.',
            'Sin color = segura. Los mismos niveles que la herramienta Consultar. Solo el suelo construido tiene puntuación de delincuencia.')
  };
};

var traffic = function(sim) {
  return {
    shapes: [levelBlocks(sim.blockMaps.trafficDensityMap, 'tra')],
    legend: [
      {swatch: 'tra1', text: P('Light', 'Ligero')},
      {swatch: 'tra2', text: P('Heavy', 'Intenso')},
      {swatch: 'tra3', text: P('Very heavy', 'Muy intenso')}
    ],
    note: P('Where cars have been driving lately (the game\'s traffic map).', 'Por dónde han circulado los carros últimamente (el mapa de tráfico del juego).')
  };
};

var power = function(sim) {
  var map = sim._map, shapes = [], on = 0, off = 0;
  for (var x = 0; x < map.width; x++) {
    for (var y = 0; y < map.height; y++) {
      var tile = map.getTile(x, y);
      if (!tile.isZone())
        continue;
      var v = tile.getValue();
      if (!TileUtils.isResidential(v) && !TileUtils.isCommercial(v) && !TileUtils.isIndustrial(v))
        continue;
      var ok = tile.isPowered();
      if (ok) on++; else off++;
      shapes.push({kind: 'zone', x: x, y: y, tone: ok ? 'good' : 'bad', label: ''});
    }
  }
  return {
    shapes: shapes,
    legend: [
      {swatch: 'good', text: P('Zones with power: {0}', 'Zonas con electricidad: {0}', fmt(on))},
      {swatch: 'bad', text: P('Zones without power: {0}', 'Zonas sin electricidad: {0}', fmt(off))}
    ],
    note: P('Zones only grow with power.', 'Las zonas solo crecen con electricidad.')
  };
};


var Layers = {
  pollution: pollution,
  roads: roads,
  dead: roads,
  zoning_res: zoningRes,
  zoning_com: zoningCom,
  zoning_ind: zoningInd,
  zoning: zoningRes,
  water: water,
  fire: fire,
  crime: crime,
  traffic: traffic,
  power: power
};


export { Layers };

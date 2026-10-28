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

import { I18n } from './i18n.js';
import { Influence } from './influence.js';
import { MiscUtils } from './miscUtils.js';
import { Policy } from './policy.js';
import { Reach } from './reach.js';
import { TileUtils } from './tileUtils.js';
import * as TileValues from './tileValues.ts';

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

var deadEnds = function(sim) {
  var map = sim._map, shapes = [], dead = 0, bridges = 0;
  for (var x = 0; x < map.width; x++) {
    for (var y = 0; y < map.height; y++) {
      if (!Reach.isDrivable(map, x, y))
        continue;
      if (Reach.isDrawbridge(map, x, y)) {
        shapes.push({kind: 'bridge', x: x, y: y, open: false, label: ''});
        bridges++;
      } else if (Reach.countLinks(map, x, y) <= 1) {
        var open = Reach.nextToOpenBridge(map, x, y);
        shapes.push(open ? {kind: 'bridge', x: x, y: y, open: true, label: ''} : {kind: 'dead', x: x, y: y, label: ''});
        if (open) bridges++; else dead++;
      }
    }
  }
  return {
    shapes: shapes,
    legend: [
      {swatch: 'dead', text: P('Dead end: {0}', 'Calle sin salida: {0}', fmt(dead))},
      {swatch: 'bridge', text: P('Drawbridge: {0}', 'Puente levadizo: {0}', fmt(bridges))}
    ].concat(Reach.channelTiles(map).length
      ? [{swatch: 'channel', text: P('Shipping channel (dashed water): a road bridge across it is a drawbridge; rail bridges never open',
                                     'Canal de navegación (agua con guiones): un puente de calle que lo cruce es levadizo; los puentes de tren nunca se abren')}]
      : []),
    note: P('A car that drives into a dead end gives up its trip.', 'Un carro que entra en una calle sin salida abandona su viaje.')
  };
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

var zoning = function(sim, game) {
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
  var shapes = [{kind: 'blocks', size: size, cells: cells, cls: 'wz'}];
  var stuck = (game && game._stuckShops) || [];
  stuck.forEach(function(q) { shapes.push({kind: 'zone', x: q.x, y: q.y, tone: 'bad', label: ''}); });
  return {
    shapes: shapes,
    legend: [
      {swatch: 'wz1', text: P('Homes grow and stay', 'Las viviendas crecen y se quedan')},
      {swatch: 'wz2', text: P('Homes may grow, and may empty again', 'Las viviendas pueden crecer, y vaciarse otra vez')},
      {swatch: 'wz3', text: P('Homes can\'t grow now (too polluted, too cheap, or no demand)', 'Ahora las viviendas no pueden crecer (demasiado contaminado, barato, o sin demanda)')},
      {swatch: 'bad', text: P('Shops whose trips fail: {0} (they can\'t grow)', 'Tiendas cuyos viajes fallan: {0} (no pueden crecer)', fmt(stuck.length))}
    ],
    note: P('Homes: today\'s demand for homes plus land value minus pollution, the game\'s own rule; it changes as demand changes. Shops grow near the city centre and need a road trip that reaches other zones. Factories grow anywhere with a road and power: put them where their pollution won\'t reach homes.',
            'Viviendas: la demanda de viviendas de hoy más el valor del suelo menos la contaminación, la regla del propio juego; cambia cuando cambia la demanda. Las tiendas crecen cerca del centro y necesitan un viaje por calle que llegue a otras zonas. Las fábricas crecen en cualquier lugar con calle y electricidad: ponlas donde su contaminación no llegue a las viviendas.')
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
  dead: deadEnds,
  zoning: zoning,
  crime: crime,
  traffic: traffic,
  power: power
};


export { Layers };

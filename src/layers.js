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
 *  - Workers nearby: for every shop and factory, how far away (along the roads) the nearest built homes are.
 *    This shows commuting distance and where traffic comes from; in this game it does not stop factories growing
 *    (only shops need their trips to succeed).
 *
 * Only READS the simulation.
 */

import { I18n } from './i18n.js';
import { MiscUtils } from './miscUtils.js';
import { Policy } from './policy.js';
import { Reach } from './reach.js';
import { TileUtils } from './tileUtils.js';

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
    ].concat(Policy.bridges !== 'fixed' && Reach.channelTiles(map).length
      ? [{swatch: 'channel', text: P('Shipping channel (dashed water): a road bridge across it is a drawbridge; rail bridges never open',
                                     'Canal de navegación (agua con guiones): un puente de calle que lo cruce es levadizo; los puentes de tren nunca se abren')}]
      : []),
    note: P('A car that drives into a dead end gives up its trip.', 'Un carro que entra en una calle sin salida abandona su viaje.')
  };
};

var workers = function(sim) {
  var map = sim._map, shapes = [], counts = {good: 0, warn: 0, bad: 0};
  var depots = sim.blockMaps && sim.blockMaps.depotMap;
  for (var x = 0; x < map.width; x++) {
    for (var y = 0; y < map.height; y++) {
      var tile = map.getTile(x, y);
      if (!tile.isZone())
        continue;
      var v = tile.getValue();
      if (!TileUtils.isCommercial(v) && !TileUtils.isIndustrial(v))
        continue;
      // where are the nearest built homes along the roads? (same search as the reach view, looking for homes)
      var r = Reach.compute(map, x, y, 'ind', !!depots && depots.worldGet(x, y) > 0);
      var tone = !r.dests.length ? 'bad' : r.dests[0].d <= 15 ? 'good' : 'warn';
      counts[tone]++;
      shapes.push({kind: 'zone', x: x, y: y, tone: tone, label: ''});
    }
  }
  return {
    shapes: shapes,
    legend: [
      {swatch: 'good', text: P('Homes within 15 road tiles: {0}', 'Viviendas a menos de 15 casillas: {0}', fmt(counts.good))},
      {swatch: 'warn', text: P('Homes 15 to 30 road tiles away: {0}', 'Viviendas a 15-30 casillas: {0}', fmt(counts.warn))},
      {swatch: 'bad', text: P('No homes within 30 road tiles: {0}', 'Ninguna vivienda a menos de 30 casillas: {0}', fmt(counts.bad))}
    ],
    note: P('Shops and factories, by how far their workers live. Long commutes mean more traffic; only shops need their trips to succeed to grow.',
            'Tiendas y fábricas, según lo lejos que viven sus trabajadores. Los trayectos largos generan más tráfico; solo las tiendas necesitan que sus viajes tengan éxito para crecer.')
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
  workers: workers,
  crime: crime,
  traffic: traffic,
  power: power
};


export { Layers };

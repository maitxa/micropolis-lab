/* Policy Lab additions to micropolisJS (2026).
 *
 * This code is released under the GNU GPL v3, with some additional terms, like the rest of micropolisJS.
 * Modified version: NOT the original micropolisJS / Micropolis.
 *
 * "Reach" of a zone: which roads its trip car can get to within the 30-tile limit, which destinations it could find
 * there, and which dead ends could stop it. This is the BEST case: the game's car turns at random at every junction
 * and gives up at a dead end (as in 1989), so a destination that is far away or behind many junctions will still be
 * missed some of the time.
 *
 * Only READS the map.
 */

import { I18n } from './i18n.js';
import { MiscUtils } from './miscUtils.js';
import { Policy } from './policy.js';
import { TileUtils } from './tileUtils.js';

var P = I18n.p;
var fmt = MiscUtils.formatNumber;

var MAX_DISTANCE = 30;
var NEAR = 15;

var perimX = [-1, 0, 1, 2, 2, 2, 1, 0, -1, -2, -2, -2];
var perimY = [-2, -2, -2, -1, 0, 1, 2, 2, 2, 1, 0, -1];
var DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];

var DEST = {
  res: TileUtils.isResidentialTripEnd,
  com: TileUtils.isCommercialTripEnd,
  ind: TileUtils.isIndustrialTripEnd
};

var zoneType = function(v) {
  return TileUtils.isResidential(v) ? 'res' : TileUtils.isCommercial(v) ? 'com' : TileUtils.isIndustrial(v) ? 'ind' : null;
};

// The residential, commercial or industrial zone that a tile belongs to (its centre), or null
var zoneAt = function(map, x, y) {
  for (var dx = -1; dx <= 1; dx++) {
    for (var dy = -1; dy <= 1; dy++) {
      if (!map.testBounds(x + dx, y + dy))
        continue;
      var t = map.getTile(x + dx, y + dy);
      if (t.isZone()) {
        var type = zoneType(t.getValue());
        if (type)
          return {x: x + dx, y: y + dy, type: type};
      }
    }
  }
  return null;
};

// Where a destination tile's building is centred (so it can be framed), searching a little around it
var buildingCentre = function(map, x, y) {
  for (var r = 0; r <= 2; r++) {
    for (var dx = -r; dx <= r; dx++) {
      for (var dy = -r; dy <= r; dy++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r || !map.testBounds(x + dx, y + dy))
          continue;
        if (map.getTile(x + dx, y + dy).isZone())
          return {x: x + dx, y: y + dy};
      }
    }
  }
  return {x: x, y: y};
};

var drivable = function(map, x, y) {
  if (!map.testBounds(x, y))
    return false;
  var v = map.getTileValue(x, y);
  if (!TileUtils.isDriveable(v))
    return false;
  // cars can't use roads inside a car-free downtown
  return !(TileUtils.isRoad(v) && Policy.isCarFree(map, x, y));
};

var compute = function(map, zx, zy, type, longReach) {
  var max = longReach ? MAX_DISTANCE * 2 : MAX_DISTANCE;
  var dist = {};
  var queue = [];
  var key = function(x, y) { return x + ',' + y; };
  for (var i = 0; i < 12; i++) {
    var sx = zx + perimX[i], sy = zy + perimY[i];
    if (drivable(map, sx, sy) && dist[key(sx, sy)] === undefined) {
      dist[key(sx, sy)] = 1;
      queue.push([sx, sy]);
    }
  }
  var hasRoad = queue.length > 0;

  for (var q = 0; q < queue.length; q++) {
    var cx = queue[q][0], cy = queue[q][1], d = dist[key(cx, cy)];
    if (d >= max)
      continue;
    for (var k = 0; k < 4; k++) {
      var nx = cx + DIRS[k][0], ny = cy + DIRS[k][1];
      if (dist[key(nx, ny)] === undefined && drivable(map, nx, ny)) {
        dist[key(nx, ny)] = d + 1;
        queue.push([nx, ny]);
      }
    }
  }

  var near = [], far = [], dead = [], dests = {};
  var isDest = DEST[type];
  var insideOrigin = function(x, y) { return Math.abs(x - zx) <= 1 && Math.abs(y - zy) <= 1; };
  queue.forEach(function(pos) {
    var x = pos[0], y = pos[1], d = dist[key(x, y)];
    (d <= NEAR ? near : far).push([x, y]);
    var links = 0;
    for (var k = 0; k < 4; k++) {
      var nx = x + DIRS[k][0], ny = y + DIRS[k][1];
      if (drivable(map, nx, ny))
        links++;
      if (map.testBounds(nx, ny) && !insideOrigin(nx, ny) && isDest(map.getTileValue(nx, ny))) {
        var c = buildingCentre(map, nx, ny);
        var ck = key(c.x, c.y);
        if (!insideOrigin(c.x, c.y) && (dests[ck] === undefined || dests[ck].d > d))
          dests[ck] = {x: c.x, y: c.y, d: d};
      }
    }
    // a dead end the car could drive into (not one right at the zone, where the car only starts)
    if (links <= 1 && d > 1)
      dead.push([x, y]);
  });

  var destList = Object.keys(dests).map(function(k2) { return dests[k2]; });
  destList.sort(function(a, b) { return a.d - b.d; });
  return {type: type, hasRoad: hasRoad, max: max, near: near, far: far, dead: dead, dests: destList};
};

// Shapes for the map layer (see GameCanvas.setHighlights)
var shapes = function(r) {
  var out = [{kind: 'reach', near: r.near, far: r.far}];
  r.dests.forEach(function(d) {
    out.push({kind: 'zone', x: d.x, y: d.y, tone: 'ok', label: ''});
  });
  r.dead.forEach(function(d, i) {
    out.push({kind: 'dead', x: d[0], y: d[1], label: i === 0 ? P('Dead end', 'Calle sin salida') : ''});
  });
  return out;
};

var what = function(type) {
  return {
    res: P('shops, factories or big buildings', 'tiendas, fábricas o edificios grandes'),
    com: P('homes, shops or factories', 'viviendas, tiendas o fábricas'),
    ind: P('homes, for workers', 'viviendas, para trabajadores')
  }[type];
};

var noun = function(type) {
  return {res: P('home', 'vivienda'), com: P('shop', 'tienda'), ind: P('factory', 'fábrica')}[type];
};

// One or two sentences describing the reach
var verdict = function(r) {
  if (!r.hasRoad)
    return P('No road touches this zone, so its trips can\'t start. Build a road along one side.',
             'Ninguna calle toca esta zona, así que sus viajes no pueden empezar. Construye una calle en uno de sus lados.');
  var n = r.dests.length;
  var text;
  if (n === 0) {
    text = P('No {0} within {1} road tiles. Zone some along the shaded roads.',
             'No hay {0} a menos de {1} casillas de calle. Zonifica algunas junto a las calles sombreadas.', what(r.type), r.max);
  } else {
    var closest = r.dests[0].d;
    text = P('Places it needs ({0}) within reach: {1}. The closest is {2} road tiles away.',
             'Lugares que necesita ({0}) a su alcance: {1}. El más cercano está a {2} casillas de calle.',
             what(r.type), fmt(n), closest);
    if (closest > NEAR)
      text += ' ' + P('That is far: the car turns at random, so many trips will still fail. Closer is better.',
                      'Eso está lejos: el carro gira al azar, así que muchos viajes seguirán fallando. Más cerca es mejor.');
  }
  if (r.dead.length)
    text += ' ' + (r.dead.length === 1 ? P('1 dead end nearby can stop the car.', '1 calle sin salida cercana puede detener el carro.')
                                       : P('{0} dead ends nearby can stop the car.', '{0} calles sin salida cercanas pueden detener el carro.',
                                           fmt(r.dead.length)));
  return text;
};


var Reach = {
  zoneAt: zoneAt,
  compute: compute,
  shapes: shapes,
  verdict: verdict,
  noun: noun
};


export { Reach };

/* Policy Lab additions to micropolisJS (2026).
 *
 * This code is released under the GNU GPL v3, with some additional terms, like the rest of micropolisJS.
 * Modified version: NOT the original micropolisJS / Micropolis.
 *
 * "Reach" of a zone: which roads its trip car can get to within the trip limit (30 road tiles in 1989; see Policy.commute), which destinations it could find
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
import * as TileValues from './tileValues.ts';

var P = I18n.p;
var fmt = MiscUtils.formatNumber;

// POLICY LAB v25: how far a trip can go is a world-model setting (30 in 1989); "near" is half of it
var maxDist = function() { return Policy.commute || 30; };
var nearDist = function() { return Math.round(maxDist() / 2); };

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

// The raised halves of an open drawbridge
var isRaisedBridge = function(v) {
  return (v >= TileValues.HBRDG0 && v <= TileValues.HBRDG3) || (v >= TileValues.VBRDG0 && v <= TileValues.VBRDG3);
};

// A closed road bridge over the shipping channel, which can open (the same test the game uses, in road.js)
var isDrawbridge = function(map, x, y) {
  if (Policy.bridges === 'fixed' || Policy.isHighway(x, y))
    return false;
  var v = TileUtils.normalizeRoad(map.getTileValue(x, y));
  if (v === TileValues.HBRIDGE)
    return y > 0 && map.getTileValue(x, y - 1) === TileValues.CHANNEL;
  if (v === TileValues.VBRIDGE)
    return x < map.width - 1 && map.getTileValue(x + 1, y) === TileValues.CHANNEL;
  return false;
};

// POLICY LAB v22: every tile of the shipping channel (a hidden line down the middle of the big river, drawn with the
// same picture as ordinary water). A road bridge across it becomes a drawbridge.
var channelTiles = function(map) {
  var out = [];
  for (var x = 0; x < map.width; x++)
    for (var y = 0; y < map.height; y++)
      if (map.getTileValue(x, y) === TileValues.CHANNEL)
        out.push([x, y]);
  return out;
};

// Is the road at (x, y) cut off by an open drawbridge right next to it?
var nextToOpenBridge = function(map, x, y) {
  for (var k = 0; k < 4; k++) {
    var nx = x + DIRS[k][0], ny = y + DIRS[k][1];
    if (map.testBounds(nx, ny) && isRaisedBridge(map.getTileValue(nx, ny)))
      return true;
  }
  return false;
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

var key = function(x, y) { return x + ',' + y; };

// Breadth-first search along drivable tiles from the given start tiles, up to max tiles
// Shortest distances along the roads from the start tiles, up to max. POLICY LAB v26: a highway tile counts a third of
// a tile, so distances are worked out in thirds (road 3, highway 1) and reported in tiles.
var spread = function(map, starts, max) {
  var cost = {}, done = {}, buckets = [], order = [];
  var maxT = max * 3;
  starts.forEach(function(s) {
    var k0 = key(s[0], s[1]);
    if (cost[k0] === undefined) {
      cost[k0] = 3;
      (buckets[3] = buckets[3] || []).push([s[0], s[1]]);
    }
  });
  for (var b = 0; b < buckets.length; b++) {
    var list = buckets[b];
    if (!list)
      continue;
    for (var i = 0; i < list.length; i++) {
      var cx = list[i][0], cy = list[i][1], ck = key(cx, cy);
      if (done[ck] || cost[ck] !== b)
        continue;
      done[ck] = true;
      order.push([cx, cy]);
      if (b >= maxT)
        continue;
      for (var k = 0; k < 4; k++) {
        var nx = cx + DIRS[k][0], ny = cy + DIRS[k][1], nk = key(nx, ny);
        if (done[nk] || !drivable(map, nx, ny))
          continue;
        var nc = b + (Policy.isHighway(nx, ny) ? 1 : 3);
        if (nc > maxT)
          continue;
        if (cost[nk] === undefined || nc < cost[nk]) {
          cost[nk] = nc;
          (buckets[nc] = buckets[nc] || []).push([nx, ny]);
        }
      }
    }
  }
  var dist = {};
  order.forEach(function(p) { var k2 = key(p[0], p[1]); dist[k2] = Math.round(cost[k2] / 3 * 10) / 10; });
  return {dist: dist, tiles: order};
};

var countLinks = function(map, x, y) {
  var links = 0;
  for (var k = 0; k < 4; k++)
    if (drivable(map, x + DIRS[k][0], y + DIRS[k][1]))
      links++;
  return links;
};

var compute = function(map, zx, zy, type, longReach) {
  var max = longReach ? maxDist() * 2 : maxDist();
  var NEAR = nearDist();
  var starts = [];
  for (var i = 0; i < 12; i++) {
    var sx = zx + perimX[i], sy = zy + perimY[i];
    if (drivable(map, sx, sy))
      starts.push([sx, sy]);
  }
  var hasRoad = starts.length > 0;
  var found = spread(map, starts, max);
  var dist = found.dist, queue = found.tiles;

  var near = [], far = [], dead = [], dests = {}, bridges = [], railBeside = 0;
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
    // drawbridges on its routes: closed ones that can open, and open ones that cut the road right now
    if (isDrawbridge(map, x, y))
      bridges.push({x: x, y: y, open: false});
    else if (links <= 1 && nextToOpenBridge(map, x, y))
      bridges.push({x: x, y: y, open: true});
    // a dead end the car could drive into (not one right at the zone, where the car only starts)
    else if (links <= 1 && d > 1)
      dead.push([x, y, d]);
    // a road with rail running right beside it (not a level crossing): every such tile is an extra junction where
    // the car can wander off onto the rail
    if (d <= 10 && TileUtils.isRoad(map.getTileValue(x, y))) {
      for (var kk = 0; kk < 4; kk++) {
        var rx = x + DIRS[kk][0], ry = y + DIRS[kk][1];
        if (map.testBounds(rx, ry) && drivable(map, rx, ry) && !TileUtils.isRoad(map.getTileValue(rx, ry))) {
          railBeside++;
          break;
        }
      }
    }
  });

  var destList = Object.keys(dests).map(function(k2) { return dests[k2]; });
  destList.sort(function(a, b) { return a.d - b.d; });
  return {type: type, hasRoad: hasRoad, max: max, near: near, far: far, dead: dead, dests: destList, bridges: bridges,
          railBeside: railBeside};
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
  (r.bridges || []).forEach(function(b) {
    out.push({kind: 'bridge', x: b.x, y: b.y, open: b.open,
              label: b.open ? P('Drawbridge open: road cut', 'Puente levadizo abierto: calle cortada')
                            : P('Drawbridge: opens for ships', 'Puente levadizo: se abre para los barcos')});
  });
  return out;
};

var what = function(type) {
  return {
    res: P('shops, factories or big buildings', 'tiendas, fábricas o edificios grandes'),
    com: P('homes, shops or factories', 'viviendas, tiendas o fábricas'),
    ind: P('homes for its workers', 'viviendas para sus trabajadores')
  }[type];
};

var noun = function(type) {
  return {res: P('home', 'vivienda'), com: P('shop', 'tienda'), ind: P('factory', 'fábrica')}[type];
};

// One or two sentences describing the reach
var verdict = function(r) {
  if (!r.hasRoad)
    return P('No road touches this zone, so it can\'t grow. Build a road along one side.',
             'Ninguna calle toca esta zona, así que no puede crecer. Construye una calle en uno de sus lados.');
  var n = r.dests.length;
  var text;
  if (r.type !== 'com') {
    // homes and factories: information only (their trips don't affect growth)
    text = n ? P('Within reach of its cars: {0} ({1}); closest {2} road tiles away.',
                 'Al alcance de sus carros: {0} ({1}); el más cercano a {2} casillas de calle.', what(r.type), fmt(n), r.dests[0].d)
             : P('No {0} within {1} road tiles.', 'No hay {0} a menos de {1} casillas de calle.', what(r.type), r.max);
    return text + ' ' + P('This only affects traffic: homes and factories grow with a road and power.',
                          'Esto solo afecta al tráfico: las viviendas y fábricas crecen con calle y electricidad.');
  }
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
  var open = (r.bridges || []).filter(function(b) { return b.open; }).length;
  var closed = (r.bridges || []).length - open;
  if (open)
    text += ' ' + P('A drawbridge on its routes is open right now: cars stop there until it closes.',
                    'Un puente levadizo en sus rutas está abierto ahora: los carros se detienen allí hasta que se cierre.');
  else if (closed)
    text += ' ' + P('A drawbridge on its routes opens for ships (and sometimes at random), cutting the road while open.',
                    'Un puente levadizo en sus rutas se abre para los barcos (y a veces al azar), y corta la calle mientras está abierto.');
  if (r.dead.length)
    text += ' ' + (r.dead.length === 1 ? P('1 dead end nearby can stop the car.', '1 calle sin salida cercana puede detener el carro.')
                                       : P('{0} dead ends nearby can stop the car.', '{0} calles sin salida cercanas pueden detener el carro.',
                                           fmt(r.dead.length)));
  return text;
};


// ---------------------------------------------------------------------------------------------------------------
// Connection reports for the Query window. Each line: {mark: 'ok' | 'no' | 'warn', text}
// ---------------------------------------------------------------------------------------------------------------

var EMPTY_CENTRE = {res: TileValues.FREEZ, com: TileValues.COMCLR, ind: TileValues.INDCLR};

// Has a zone got buildings? (homes start as single houses around an empty centre)
var isBuilt = function(map, zone) {
  if (zone.type !== 'res')
    return map.getTileValue(zone.x, zone.y) !== EMPTY_CENTRE[zone.type];
  for (var dx = -1; dx <= 1; dx++)
    for (var dy = -1; dy <= 1; dy++)
      if (map.testBounds(zone.x + dx, zone.y + dy) && map.getTileValue(zone.x + dx, zone.y + dy) >= TileValues.LHTHR)
        return true;
  return false;
};

var bridgeLines = function(r, lines) {
  var open = r.bridges.filter(function(b) { return b.open; }).length;
  var closed = r.bridges.length - open;
  if (open)
    lines.push({mark: 'warn', text: P('A drawbridge on these roads is open now: the road is cut until it closes.',
                                      'Un puente levadizo en estas calles está abierto ahora: la calle está cortada hasta que se cierre.')});
  else if (closed)
    lines.push({mark: 'warn', text: P('A drawbridge on these roads opens for ships (and sometimes at random).',
                                      'Un puente levadizo en estas calles se abre para los barcos (y a veces al azar).')});
  if (r.dead.length)
    lines.push({mark: 'warn', text: r.dead.length === 1 ? P('1 dead end within reach: a car that gets there gives up.',
                                                            '1 calle sin salida a su alcance: el carro que llega allí se rinde.')
                                                        : P('{0} dead ends within reach: a car that gets there gives up.',
                                                            '{0} calles sin salida a su alcance: el carro que llega allí se rinde.', fmt(r.dead.length))});
};

// A residential, commercial or industrial zone
var zoneReport = function(map, zone, longReach) {
  var r = compute(map, zone.x, zone.y, zone.type, longReach);
  var lines = [];
  var powered = map.getTile(zone.x, zone.y).isPowered();
  lines.push(r.hasRoad ? {mark: 'ok', text: P('Road touching one side', 'Una calle toca uno de sus lados')}
                       : {mark: 'no', text: P('No road touching any side (corners don\'t count)', 'Ninguna calle toca sus lados (las esquinas no cuentan)')});
  lines.push(powered ? {mark: 'ok', text: P('Has power', 'Tiene electricidad')}
                     : {mark: 'no', text: P('No power', 'Sin electricidad')});
  var closest = r.dests.length ? r.dests[0].d : null;
  var NEAR = nearDist();
  // As in 1989, only SHOPS need their trips to succeed in order to grow. For homes and factories a failed trip changes
  // nothing for growth (it only means fewer cars on the road), so their reach is shown as information.
  var tripsMatter = zone.type === 'com';
  if (r.hasRoad) {
    if (r.dests.length)
      lines.push({mark: !tripsMatter ? 'info' : (closest > NEAR ? 'warn' : 'ok'),
                  text: P('Can reach {0} ({1}); closest {2} road tiles away', 'Llega a {0} ({1}); el más cercano a {2} casillas de calle',
                          what(r.type), fmt(r.dests.length), Math.round(closest))});
    else
      lines.push({mark: tripsMatter ? 'no' : 'info', text: P('No {0} within {1} road tiles', 'No hay {0} a menos de {1} casillas de calle', what(r.type), r.max)});
    if (!tripsMatter)
      lines.push({mark: 'info', text: P('In this game that doesn\'t affect whether it grows (only shops need their trips to succeed); it affects how much traffic it makes.',
                                        'En este juego eso no afecta a su crecimiento (solo las tiendas necesitan que sus viajes tengan éxito); afecta al tráfico que genera.')});
    if (tripsMatter)
      bridgeLines(r, lines);
  }
  if (!isBuilt(map, zone))
    lines.push({mark: 'info', text: P('Still empty: its trips start once it has buildings.', 'Todavía vacía: sus viajes empiezan cuando tenga edificios.')});

  var verdict;
  if (!r.hasRoad)
    verdict = {mark: 'no', text: P('Not connected: build a road along one side.', 'No está conectada: construye una calle en uno de sus lados.')};
  else if (!powered)
    verdict = {mark: 'no', text: P('Not connected to power: run a power line to it.', 'Sin conexión eléctrica: llévale un cable eléctrico.')};
  else if (!tripsMatter)
    verdict = {mark: 'ok', text: P('Connected: this {0} has a road and power, which is all it needs to grow.',
                                   'Conectada: esta {0} tiene calle y electricidad, que es todo lo que necesita para crecer.', noun(r.type))};
  else if (!r.dests.length)
    verdict = {mark: 'no', text: P('Not connected to what it needs: put {0} along the shaded roads.',
                                   'No está conectada a lo que necesita: pon {0} junto a las calles sombreadas.', what(r.type))};
  else if (closest > NEAR || r.dead.length || r.bridges.length)
    verdict = {mark: 'warn', text: P('Connected, but trips will sometimes fail (far away, dead ends or a drawbridge).',
                                     'Conectada, pero a veces los viajes fallarán (lejos, calles sin salida o un puente levadizo).')};
  else
    verdict = {mark: 'ok', text: P('Connected: this {0} has what it needs to grow.', 'Conectada: esta {0} tiene lo que necesita para crecer.', noun(r.type))};
  return {reach: r, lines: lines, verdict: verdict,
          note: P('Growth also depends on demand, land value and pollution.', 'El crecimiento también depende de la demanda, el valor del suelo y la contaminación.')};
};

// A road or rail tile: where does it lead?
var roadReport = function(map, x, y) {
  var MAX = maxDist(), NEAR = nearDist();
  var found = spread(map, [[x, y]], MAX);
  var zones = {}, near = [], far = [], dead = [], bridges = [], dests = [];
  var counts = {res: 0, com: 0, ind: 0, empty: 0};
  found.tiles.forEach(function(pos) {
    var tx = pos[0], ty = pos[1], d = found.dist[key(tx, ty)];
    (d <= NEAR ? near : far).push([tx, ty]);
    var links = countLinks(map, tx, ty);
    if (isDrawbridge(map, tx, ty))
      bridges.push({x: tx, y: ty, open: false});
    else if (links <= 1 && nextToOpenBridge(map, tx, ty))
      bridges.push({x: tx, y: ty, open: true});
    else if (links <= 1)
      dead.push([tx, ty]);
    for (var k = 0; k < 4; k++) {
      var nx = tx + DIRS[k][0], ny = ty + DIRS[k][1];
      if (!map.testBounds(nx, ny) || TileUtils.isDriveable(map.getTileValue(nx, ny)))
        continue;
      var z = zoneAt(map, nx, ny);
      if (z && !zones[key(z.x, z.y)]) {
        zones[key(z.x, z.y)] = true;
        if (isBuilt(map, z)) {
          counts[z.type] += 1;
          dests.push({x: z.x, y: z.y, d: d});
        } else {
          counts.empty += 1;
        }
      }
    }
  });
  var r = {type: null, hasRoad: true, max: MAX, near: near, far: far, dead: dead, dests: dests, bridges: bridges};

  var lines = [];
  var here = TileUtils.normalizeRoad(map.getTileValue(x, y));
  // POLICY LAB v26
  if (Policy.isHighway(x, y))
    lines.push({mark: 'info', text: P('This is a highway: trips go three times as far on it, it builds up half the congestion, and its bridges never open.',
                                      'Esta es una autopista: los viajes llegan tres veces más lejos por ella, se congestiona la mitad y sus puentes nunca se abren.')});
  if (isDrawbridge(map, x, y))
    lines.push({mark: 'warn', text: P('This is a drawbridge: it opens for ships (and sometimes at random), cutting the road.',
                                      'Este es un puente levadizo: se abre para los barcos (y a veces al azar) y corta la calle.')});
  else if (countLinks(map, x, y) <= 1)
    lines.push({mark: 'warn', text: nextToOpenBridge(map, x, y)
                  ? P('The drawbridge here is open: the road is cut until it closes.', 'El puente levadizo aquí está abierto: la calle está cortada hasta que se cierre.')
                  : P('This tile is a dead end: a car that gets here gives up.', 'Esta casilla es una calle sin salida: el carro que llega aquí se rinde.')});
  lines.push({mark: 'info', text: P('Within {4} road tiles: homes {0}, shops {1}, factories {2}{3}.',
                                    'A menos de {4} casillas de calle: viviendas {0}, tiendas {1}, fábricas {2}{3}.',
                                    fmt(counts.res), fmt(counts.com), fmt(counts.ind),
                                    counts.empty ? P(' (empty zones: {0})', ' (zonas vacías: {0})', fmt(counts.empty)) : '', MAX)});
  bridgeLines(r, lines);
  var jobs = counts.com + counts.ind;
  var verdict;
  if (counts.res && jobs)
    verdict = {mark: 'ok', text: P('Links homes and jobs.', 'Une viviendas y empleos.')};
  else if (counts.res)
    verdict = {mark: 'no', text: P('Only homes reachable: no shops or factories within {0} road tiles.', 'Solo hay viviendas a su alcance: no hay tiendas ni fábricas a menos de {0} casillas.', MAX)};
  else if (jobs)
    verdict = {mark: 'no', text: P('No homes reachable: the shops and factories here have no workers within {0} road tiles.',
                                   'No hay viviendas a su alcance: las tiendas y fábricas de aquí no tienen trabajadores a menos de {0} casillas.', MAX)};
  else
    verdict = {mark: 'no', text: P('Not connected to any built zone.', 'No está conectada a ninguna zona construida.')};
  // a hint that the rail/road tile itself is what we started from
  return {reach: r, lines: lines, verdict: verdict, isRail: !TileUtils.isRoad(here), note: ''};
};


var Reach = {
  maxDist: maxDist,
  nearDist: nearDist,
  channelTiles: channelTiles,
  zoneAt: zoneAt,
  zoneReport: zoneReport,
  roadReport: roadReport,
  isDrivable: drivable,
  countLinks: countLinks,
  isDrawbridge: isDrawbridge,
  nextToOpenBridge: nextToOpenBridge,
  isBuilt: isBuilt,
  compute: compute,
  shapes: shapes,
  verdict: verdict,
  noun: noun
};


export { Reach };

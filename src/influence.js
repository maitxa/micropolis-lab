/* Policy Lab additions to micropolisJS (2026).
 *
 * This code is released under the GNU GPL v3, with some additional terms, like the rest of micropolisJS.
 * Modified version: NOT the original micropolisJS / Micropolis.
 *
 * The Query tool's "What affects this spot" and "What this building does" (v27).
 *
 *  - spot(): for a home, shop or factory (or any other tile), the headline (land value and class, the taxes it pays,
 *    residents or jobs, the pollution a factory puts out), then land value and crime piece by piece, the pollution here
 *    and where it comes from, and which services reach it. The pieces are worked out with the same formulas as the
 *    simulation (blockMapUtils.js), from the current maps, so they can differ by a few points from the figure the game
 *    last stored (the maps are refreshed every few game weeks).
 *  - building(): for a police or fire station, hospital, park, big park, train depot, water plant or power plant, its
 *    reach (shapes for the map) and what it does, in numbers.
 *
 * Only READS the simulation.
 */

import { BlockMapUtils } from './blockMapUtils.js';
import { Commercial } from './commercial.js';
import { I18n } from './i18n.js';
import { Industrial } from './industrial.js';
import { MiscUtils } from './miscUtils.js';
import { Policy } from './policy.js';
import { Residential } from './residential.js';
import { Text } from './text.js';
import { TileUtils } from './tileUtils.js';
import { Utilities } from './utilities.js';
import * as TileValues from './tileValues.ts';

var P = I18n.p;
var fmt = MiscUtils.formatNumber;
var money = MiscUtils.formatMoney;

var POLLUTION_LOOK = 6;   // tiles around a spot searched for pollution sources

var classOf = function(lv) {
  var i = lv >= 150 ? 3 : lv >= 80 ? 2 : lv >= 30 ? 1 : 0;
  return Text.L('landValueStrings')[i];
};
var levelWord = function(v, list) {
  return Text.L(list)[MiscUtils.clamp(v >> 6, 0, 3)];
};
var signed = function(v) {
  v = Math.round(v);
  return (v > 0 ? '+' : v < 0 ? '−' : '') + fmt(Math.abs(v));
};

var zoneKind = function(v) {
  if (TileUtils.isResidential(v) && v < TileValues.HOSPITALBASE) return 'res';
  if (TileUtils.isCommercial(v)) return 'com';
  if (TileUtils.isIndustrial(v)) return 'ind';
  return null;
};

// The zone's weight in the game's population count (residents count 1/8; shops and factories 1)
var zoneWeight = function(map, x, y, v, kind) {
  if (kind === 'res') return Residential.getZonePopulation(map, x, y, v) / 8;
  if (kind === 'com') return Commercial.getZonePopulation(map, x, y, v);
  if (kind === 'ind') return Industrial.getZonePopulation(map, x, y, v);
  return 0;
};

// This zone's share of the city's yearly taxes (the game collects them for the whole city at once)
var taxShare = function(sim, zx, zy, totalTaxes) {
  var map = sim._map, lv = sim.blockMaps.landValueMap;
  var mine = 0, all = 0;
  for (var x = 0; x < map.width; x++) {
    for (var y = 0; y < map.height; y++) {
      var tile = map.getTile(x, y);
      if (!tile.isZone())
        continue;
      var v = tile.getValue(), kind = zoneKind(v);
      if (!kind)
        continue;
      var w = zoneWeight(map, x, y, v, kind);
      var s = w * lv.worldGet(x, y);
      all += s;
      if (x === zx && y === zy)
        mine = s;
    }
  }
  return all > 0 ? Math.round(totalTaxes * mine / all) : 0;
};

// Land value, piece by piece (blockMapUtils.pollutionTerrainLandValueScan)
var landValueParts = function(sim, x, y) {
  var map = sim._map, bm = sim.blockMaps;
  var rows = [];
  var dist = BlockMapUtils.getCityCentreDistance(map, x & ~1, y & ~1);
  var base = (34 - Math.floor(dist / 2)) << 2;
  rows.push({label: P('Distance from the city centre ({0} tiles)', 'Distancia al centro de la ciudad ({0} casillas)', dist), value: base});
  var terrain = bm.terrainDensityMap.worldGet(x, y);
  if (terrain)
    rows.push({label: P('Unspoiled land nearby (trees, water, parks)', 'Terreno sin construir cerca (árboles, agua, parques)'), value: terrain});
  if (bm.waterfrontMap && bm.waterfrontMap.worldGet(x, y) > 0)
    rows.push({label: P('Waterfront', 'Junto al agua'), value: 40});
  if (bm.shopMap && bm.shopMap.worldGet(x, y) > 0)
    rows.push({label: P('Shops within walking distance', 'Tiendas a poca distancia a pie'), value: 20});
  if (bm.healthMap && bm.healthMap.worldGet(x, y) > 0)
    rows.push({label: P('A hospital nearby', 'Un hospital cerca'), value: 15});
  var pollution = bm.pollutionDensityMap.worldGet(x, y);
  if (pollution)
    rows.push({label: P('Pollution', 'Contaminación'), value: -pollution});
  if (bm.crimeRateMap.worldGet(x, y) > 190)
    rows.push({label: P('Very high crime', 'Delincuencia muy alta'), value: -20});
  return rows;
};

// Crime, piece by piece (blockMapUtils.crimeScan)
var crimeParts = function(sim, x, y) {
  var bm = sim.blockMaps;
  var lv = bm.landValueMap.worldGet(x, y);
  var rows = [];
  var poverty = 128 - lv;
  rows.push({label: poverty >= 0 ? P('Cheap land', 'Suelo barato') : P('Valuable land', 'Suelo valioso'), value: poverty});
  var density = bm.populationDensityMap.worldGet(x, y);
  if (density)
    rows.push({label: P('Crowding', 'Hacinamiento'), value: density});
  var police = bm.policeStationEffectMap.worldGet(x, y);
  rows.push({label: P('Police (all stations nearby)', 'Policía (todas las estaciones cercanas)'), value: -police});
  var social = Policy.SOCIAL_CRIME * (sim.budget.socialEffect || 0) * 2 * (250 - lv) / 250;
  rows.push({label: P('Social services ({0}% funded)', 'Servicios sociales (con un {0}% de fondos)', Math.round((sim.budget.socialPercent || 0) * 100)), value: -social});
  if (bm.parkEffectMap) {
    var park = bm.parkEffectMap.worldGet(x, y);
    if (park)
      rows.push({label: park === 2 ? P('A big park nearby', 'Un parque grande cerca') : P('A park right here', 'Un parque justo aquí'), value: park === 2 ? -40 : -15});
  }
  return rows;
};

// Where the pollution here comes from: polluting tiles within POLLUTION_LOOK tiles, grouped
var pollutionSources = function(sim, x, y) {
  var map = sim._map;
  var count = {industry: 0, power: 0, traffic: 0, other: 0};
  var factories = {}, plants = {};
  for (var dx = -POLLUTION_LOOK; dx <= POLLUTION_LOOK; dx++) {
    for (var dy = -POLLUTION_LOOK; dy <= POLLUTION_LOOK; dy++) {
      var xx = x + dx, yy = y + dy;
      if (!map.testBounds(xx, yy))
        continue;
      var v = map.getTileValue(xx, yy);
      var p = BlockMapUtils.getPollutionValue(v);
      if (!p)
        continue;
      var src = BlockMapUtils.pollutionSourceOf(v);
      count[src] += p;
      if (src === 'industry' || src === 'power') {
        var t = map.getTile(xx, yy);
        if (t.isZone())
          (src === 'industry' ? factories : plants)[xx + ',' + yy] = true;
      }
    }
  }
  return {count: count, factories: Object.keys(factories).length, plants: Object.keys(plants).length};
};


// ---- A home, shop, factory or any other spot
var spot = function(game, x, y, zone) {
  var sim = game.simulation, map = sim._map, bm = sim.blockMaps;
  var cx = zone ? zone.x : x, cy = zone ? zone.y : y;
  var out = {headline: [], sections: []};
  var lv = bm.landValueMap.worldGet(cx, cy);

  // Headline
  if (zone) {
    var v = map.getTileValue(cx, cy);
    var kind = zone.type;
    var w = zoneWeight(map, cx, cy, v, kind);
    var totalTaxes = game._estimate ? game._estimate.taxes : 0;
    var taxes = taxShare(sim, cx, cy, totalTaxes);
    out.headline.push(lv > 0 ? P('Land value {0} of 250 ({1})', 'Valor del suelo: {0} de 250 ({1})', fmt(lv), classOf(lv))
                             : P('Land value: not built up yet', 'Valor del suelo: todavía sin construir'));
    out.headline.push(w > 0 ? P('Pays about {0} a year in taxes (its share of the city\'s {1})', 'Paga unos {0} al año en impuestos (su parte de los {1} de la ciudad)', money(taxes), money(totalTaxes))
                            : P('Pays no taxes yet: it is empty', 'Todavía no paga impuestos: está vacía'));
    if (kind === 'res' && w > 0)
      out.headline.push(P('About {0} residents', 'Unos {0} residentes', fmt(Math.round(w * 8 * 20))));
    if ((kind === 'com' || kind === 'ind') && w > 0)
      out.headline.push(P('About {0} jobs', 'Unos {0} empleos', fmt(Math.round(w * 8 * 20))));
    if (kind === 'ind' && w > 0) {
      var per = BlockMapUtils.getPollutionValue(v);
      out.headline.push(P('Puts out pollution: {0} per tile, {1} for the zone (a neighbourhood counts as heavy at 128); it spreads a few tiles around',
                          'Emite contaminación: {0} por casilla, {1} en total (un barrio cuenta como contaminación fuerte desde 128); se extiende unas casillas',
                          per, per * 9));
    }
    if (kind === 'res') {
      var growth = Math.max(0, lv - bm.pollutionDensityMap.worldGet(cx, cy));
      out.headline.push(P('Growth score here: land value minus pollution = {0} (higher grows denser and richer; 0 makes homes decline)',
                          'Puntuación de crecimiento aquí: valor del suelo menos contaminación = {0} (más alto crece más denso y rico; 0 hace que las viviendas decaigan)', fmt(growth)));
    }
  } else if (lv > 0) {
    out.headline.push(P('Land value {0} of 250 ({1})', 'Valor del suelo: {0} de 250 ({1})', fmt(lv), classOf(lv)));
  }

  // Land value
  if (lv > 0)
    out.sections.push({title: P('Land value {0}: what raises and lowers it', 'Valor del suelo {0}: qué lo sube y qué lo baja', fmt(lv)),
                       rows: landValueParts(sim, cx, cy), total: lv, max: 250, goodHigh: true,
                       note: P('Limited to 1-250. Worked out from the current maps; the game refreshes them every few weeks.',
                               'Limitado a 1-250. Calculado con los mapas actuales; el juego los actualiza cada pocas semanas.')});

  // Crime
  var crime = bm.crimeRateMap.worldGet(cx, cy);
  if (lv > 0)
    out.sections.push({title: P('Crime {0} ({1}): what pushes it up and down', 'Delincuencia {0} ({1}): qué la sube y qué la baja', fmt(crime), levelWord(crime, 'crimeStrings')),
                       rows: crimeParts(sim, cx, cy), total: crime, max: 250,
                       note: P('Limited to 0-250.{0}', 'Limitada a 0-250.{0}',
                               !(sim.budget.socialPercent > 0) ? P(' Social services would help if funded (Budget window).', ' Los servicios sociales ayudarían si tuvieran fondos (ventana de Presupuesto).') : '')});

  // Pollution
  var pol = bm.pollutionDensityMap.worldGet(cx, cy);
  var src = pollutionSources(sim, cx, cy);
  var prow = [];
  if (src.factories)
    prow.push({label: P('{0} factories within {1} tiles', '{0} fábricas a menos de {1} casillas', src.factories, POLLUTION_LOOK), value: src.count.industry, raw: true});
  if (src.plants)
    prow.push({label: P('A coal plant within {0} tiles', 'Una planta de carbón a menos de {0} casillas', POLLUTION_LOOK), value: src.count.power, raw: true});
  if (src.count.traffic)
    prow.push({label: P('Busy roads within {0} tiles', 'Calles con tráfico a menos de {0} casillas', POLLUTION_LOOK), value: src.count.traffic, raw: true});
  if (src.count.other)
    prow.push({label: P('Fires or radiation', 'Incendios o radiación'), value: src.count.other, raw: true});
  if (bm.parkEffectMap && bm.parkEffectMap.worldGet(cx, cy) === 2)
    prow.push({label: P('A big park nearby cleans the air', 'Un parque grande cercano limpia el aire'), text: '−40%'});
  out.sections.push({title: P('Pollution {0} ({1})', 'Contaminación {0} ({1})', fmt(pol), levelWord(pol, 'pollutionStrings')),
                     rows: prow, total: null,
                     note: prow.length ? P('The numbers are what each source puts out; it spreads and averages over the neighbourhood.',
                                           'Los números son lo que emite cada fuente; se extiende y se promedia en el vecindario.')
                                       : P('Nothing pollutes within {0} tiles.', 'Nada contamina a menos de {0} casillas.', POLLUTION_LOOK)});

  // Services that reach this spot
  var cov = [];
  var police = bm.policeStationEffectMap.worldGet(cx, cy), fire = bm.fireStationEffectMap.worldGet(cx, cy);
  cov.push({label: P('Police', 'Policía'), text: police > 0 ? P('yes: removes about {0} crime points here', 'sí: resta unos {0} puntos de delincuencia aquí', fmt(Math.round(police))) : P('no', 'no'), good: police > 0});
  cov.push({label: P('Fire stations', 'Bomberos'), text: fire > 0 ? P('yes (strength {0})', 'sí (fuerza {0})', fmt(fire)) : P('no: fires spread freely here', 'no: aquí los incendios se extienden sin control'), good: fire > 0});
  if (bm.healthMap)
    cov.push({label: P('Hospital within {0} tiles', 'Hospital a menos de {0} casillas', Utilities.HEALTH_RADIUS), text: bm.healthMap.worldGet(cx, cy) > 0 ? P('yes', 'sí') : P('no', 'no'), good: bm.healthMap.worldGet(cx, cy) > 0});
  if (bm.depotMap)
    cov.push({label: P('A working train depot', 'Una estación de tren que funciona'), text: bm.depotMap.worldGet(cx, cy) > 0 ? P('yes: trips go twice as far, half the traffic', 'sí: los viajes llegan el doble de lejos, la mitad de tráfico') : P('no', 'no'), good: bm.depotMap.worldGet(cx, cy) > 0});
  if (bm.waterMap)
    cov.push({label: P('Water treatment', 'Tratamiento de aguas'), text: bm.waterMap.worldGet(cx, cy) > 0 ? P('yes', 'sí') : P('no: its sewage goes to the river', 'no: sus aguas residuales van al río'), good: bm.waterMap.worldGet(cx, cy) > 0});
  if (bm.parkEffectMap && bm.parkEffectMap.worldGet(cx, cy) > 0)
    cov.push({label: P('Parks', 'Parques'), text: bm.parkEffectMap.worldGet(cx, cy) === 2 ? P('a big park nearby', 'un parque grande cerca') : P('a park right here', 'un parque justo aquí'), good: true});
  out.sections.push({title: P('Services that reach this spot', 'Servicios que llegan a este lugar'), rows: cov, total: null, list: true});
  return out;
};


// ---- A service, park or power plant: its reach and what it does
var homesWithin = function(map, x, y, r) {
  var n = 0;
  for (var xx = Math.max(0, x - r); xx <= Math.min(map.width - 1, x + r); xx++)
    for (var yy = Math.max(0, y - r); yy <= Math.min(map.height - 1, y + r); yy++) {
      if ((xx - x) * (xx - x) + (yy - y) * (yy - y) > r * r)
        continue;
      var t = map.getTile(xx, yy);
      if (t.isZone() && zoneKind(t.getValue()) === 'res')
        n++;
    }
  return n;
};

// How far a station's (smoothed) effect reaches: the farthest block-8 cell within 40 tiles where it is at least `share`
// of the value at the station
var effectRadius = function(bm, x, y, share) {
  var peak = bm.worldGet(x, y);
  if (!peak)
    return 0;
  var best = 0, size = bm.blockSize;
  for (var dx = -40; dx <= 40; dx += size) {
    for (var dy = -40; dy <= 40; dy += size) {
      var xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= bm.gameMapWidth || yy >= bm.gameMapHeight)
        continue;
      if (bm.worldGet(xx, yy) >= peak * share)
        best = Math.max(best, Math.sqrt(dx * dx + dy * dy));
    }
  }
  return Math.round(best + size / 2);
};

var building = function(game, x, y) {
  var sim = game.simulation, map = sim._map, bm = sim.blockMaps, b = sim.budget;
  // a big park: its fountain is within one tile of any of its tiles
  for (var bx = -1; bx <= 1; bx++)
    for (var by = -1; by <= 1; by++)
      if (Policy.bigParks && Policy.bigParks[(x + bx) + ',' + (y + by)] && map.getTileValue(x + bx, y + by) === TileValues.FOUNTAIN) {
        x += bx;
        y += by;
        bx = by = 2;
      }
  // the building's centre: the zone tile within 2 tiles (parks have none)
  var cx = x, cy = y, found = false;
  for (var r = 0; r <= 2 && !found; r++)
    for (var dx = -r; dx <= r && !found; dx++)
      for (var dy = -r; dy <= r && !found; dy++)
        if (map.testBounds(x + dx, y + dy) && map.getTile(x + dx, y + dy).isZone()) {
          cx = x + dx; cy = y + dy; found = true;
        }
  var v = found ? map.getTileValue(cx, cy) : map.getTileValue(x, y);
  var t = found ? map.getTile(cx, cy) : null;
  var powered = t ? t.isPowered() : true;
  var lines = [], shapes = [], title = '';
  var circle = function(r, label) { shapes.push({kind: 'circle', x: cx, y: cy, r: r, label: label}); };
  var notPowered = P('It has no power: it works at half strength.', 'No tiene electricidad: funciona a media potencia.');

  if (found && (v === TileValues.POLICESTATION || v === TileValues.FIRESTATION)) {
    var police = v === TileValues.POLICESTATION;
    var eff = police ? bm.policeStationEffectMap : bm.fireStationEffectMap;
    var pct = Math.round((police ? b.policePercent : b.firePercent) * 100);
    title = police ? P('Police station', 'Estación de policía') : P('Fire station', 'Estación de bomberos');
    var strong = effectRadius(eff, cx, cy, 0.5), weak = effectRadius(eff, cx, cy, 0.1);
    if (police) {
      lines.push(P('Removes about {0} crime points next to it, fading with distance (all stations add up).',
                   'Resta unos {0} puntos de delincuencia a su lado, y menos con la distancia (todas las estaciones se suman).',
                   fmt(Math.round(eff.worldGet(cx, cy)))));
      lines.push(P('Strong within about {0} tiles, still felt to about {1}: {2} home zones.', 'Fuerte a unas {0} casillas, todavía se nota hasta unas {1}: {2} zonas residenciales.',
                   strong, weak, homesWithin(map, cx, cy, weak)));
    } else {
      lines.push(P('Fire protection is strong within about {0} tiles and still felt to about {1}: {2} home zones.',
                   'La protección contra incendios es fuerte a unas {0} casillas y todavía se nota hasta unas {1}: {2} zonas residenciales.',
                   strong, weak, homesWithin(map, cx, cy, weak)));
    }
    lines.push(P('Funding: {0}% (less funding, less effect).', 'Fondos: {0}% (menos fondos, menos efecto).', pct));
    if (!powered) lines.push(notPowered);
    if (weak) circle(weak, P('Still felt', 'Todavía se nota'));
    if (strong) circle(strong, P('Strong', 'Fuerte'));
  } else if (found && v === TileValues.HOSPITAL) {
    title = P('Hospital', 'Hospital');
    var hr = Utilities.HEALTH_RADIUS;
    lines.push(P('Serves homes within {0} tiles: {1} home zones.', 'Atiende a las viviendas a menos de {0} casillas: {1} zonas residenciales.', hr, homesWithin(map, cx, cy, hr)));
    lines.push(P('Homes it serves are worth more (+15 land value).', 'Las viviendas que atiende valen más (+15 de valor del suelo).'));
    if (!powered) lines.push(P('It has no power, so it serves no one.', 'No tiene electricidad, así que no atiende a nadie.'));
    circle(hr, P('Serves homes here', 'Atiende a las viviendas de aquí'));
  } else if (found && v === TileValues.DEPOT) {
    title = P('Train depot', 'Estación de tren');
    var working = bm.depotMap && bm.depotMap.worldGet(cx, cy) > 0;
    lines.push(P('Zones within 16 tiles can travel twice as far, and put half as much traffic on the roads: {0} home zones.',
                 'Las zonas a menos de 16 casillas pueden viajar el doble de lejos, y ponen la mitad de tráfico en las calles: {0} zonas residenciales.', homesWithin(map, cx, cy, 16)));
    if (!working) lines.push(P('Not working: it needs rail touching it that leads to another depot, or loops back (16+ rail tiles).', 'No funciona: necesita una vía que la toque y lleve a otra estación, o que dé la vuelta y regrese (16 casillas o más).'));
    circle(16, working ? P('Covered by the depot', 'Cubierto por la estación') : P('Would be covered', 'Quedaría cubierto'));
  } else if (found && v === TileValues.WATERPLANT) {
    title = P('Water treatment plant', 'Planta de tratamiento de aguas');
    lines.push(P('Treats the sewage of zones within 24 tiles: {0} home zones.', 'Trata las aguas residuales de las zonas a menos de 24 casillas: {0} zonas residenciales.', homesWithin(map, cx, cy, 24)));
    lines.push(P('Untreated sewage pollutes the river and its banks.', 'Las aguas residuales sin tratar contaminan el río y sus orillas.'));
    if (!powered) lines.push(P('It has no power, so it treats nothing.', 'No tiene electricidad, así que no trata nada.'));
    circle(24, P('Treated here', 'Tratadas aquí'));
  } else if (found && (v === TileValues.POWERPLANT || v === TileValues.NUCLEAR)) {
    var coal = v === TileValues.POWERPLANT;
    title = coal ? P('Coal power plant', 'Planta de carbón') : P('Nuclear power plant', 'Planta nuclear');
    var use = sim._powerManager && sim._powerManager.lastUse;
    lines.push(P('Powers up to {0} tiles of zones and wires.', 'Da electricidad a hasta {0} casillas de zonas y cables.', fmt(coal ? 700 : 2000)));
    if (use && use.max)
      lines.push(P('All your plants together: {0} of {1} in use ({2}%).', 'Todas tus plantas juntas: {0} de {1} en uso ({2}%).', fmt(use.used), fmt(use.max), Math.round(use.used / use.max * 100)));
    if (coal) {
      lines.push(P('Each of its 16 tiles puts out 100 pollution (a neighbourhood counts as heavy at 128); it spreads several tiles.',
                   'Cada una de sus 16 casillas emite 100 de contaminación (un barrio cuenta como contaminación fuerte desde 128); se extiende varias casillas.'));
      var r2 = 0;
      for (var ddx = -16; ddx <= 16; ddx += 2)
        for (var ddy = -16; ddy <= 16; ddy += 2)
          if (map.testBounds(cx + ddx, cy + ddy) && bm.pollutionDensityMap.worldGet(cx + ddx, cy + ddy) >= 128)
            r2 = Math.max(r2, Math.round(Math.sqrt(ddx * ddx + ddy * ddy)));
      if (r2) {
        circle(r2, P('Heavy pollution', 'Contaminación fuerte'));
        lines.push(P('Heavy pollution reaches about {0} tiles from it (from it and other sources): {1} home zones.', 'La contaminación fuerte llega a unas {0} casillas (suya y de otras fuentes): {1} zonas residenciales.', r2, homesWithin(map, cx, cy, r2)));
      }
    } else {
      lines.push(P('No air pollution, but it can melt down if disasters are on.', 'No contamina el aire, pero puede fundirse si los desastres están activados.'));
    }
  } else if (v === TileValues.FOUNTAIN && Policy.bigParks && Policy.bigParks[cx + ',' + cy]) {
    title = P('Big park', 'Parque grande');
    lines.push(P('Within 8 tiles: pollution {0}40%{1}.', 'A menos de 8 casillas: contaminación {0}40%{1}.', '−',
                 P(', and crime −40 points', ', y delincuencia −40 puntos')));
    lines.push(P('{0} home zones are within its reach. Overlapping big parks don\'t add up.', '{0} zonas residenciales están a su alcance. Los parques grandes superpuestos no se suman.', homesWithin(map, cx, cy, 8)));
    circle(8, P('Big park reach', 'Alcance del parque grande'));
  } else {
    var pv = map.getTileValue(x, y);
    if ((pv >= TileValues.WOODS2 && pv <= TileValues.WOODS5) || pv === TileValues.FOUNTAIN) {
      cx = x; cy = y;
      title = P('Park', 'Parque');
      lines.push(P('Crime −15 points within 2 tiles, and it raises land value nearby (unspoiled land).', 'Delincuencia −15 puntos a menos de 2 casillas, y sube el valor del suelo cercano (terreno sin construir).'));
      circle(2, P('Park reach', 'Alcance del parque'));
    } else {
      return null;
    }
  }
  return {title: title, lines: lines, shapes: shapes, x: cx, y: cy};
};


var Influence = {
  spot: spot,
  building: building,
  landValueParts: landValueParts
};


export { Influence };

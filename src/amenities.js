/* Policy Lab additions to micropolisJS (2026).
 *
 * This code is released under the GNU GPL v3, with some additional terms, like the rest of micropolisJS.
 * Modified version: NOT the original micropolisJS / Micropolis.
 *
 * Things near a neighbourhood that change its land value, pollution or crime (v25), and the land value the city
 * taxes:
 *  - waterfrontMap: 1 where clean water is within WATERFRONT tiles (world model: "Do people pay more to live near
 *    water?"). Water polluted by sewage doesn't count.
 *  - parkEffectMap: 2 within BIG_PARK_RADIUS tiles of a big park (a 3x3 park with a fountain, see gameTools.js),
 *    1 within SMALL_PARK_RADIUS tiles of an ordinary park tile. Big parks clean the air (always) and, like small
 *    parks, reduce crime if the world model says parks do ("Do parks reduce crime?").
 *  - taxLandValue: the land value the city taxes. In 1989 it is the average over all built-up land, so a crowded,
 *    expensive neighbourhood counts no more than an empty lot of the same size. With "Do expensive neighbourhoods pay
 *    more tax?" it is the average of each zone's own land value, weighted by how many people live or work there.
 *
 * Only READS the map (and writes these block maps).
 */

import { Commercial } from './commercial.js';
import { Industrial } from './industrial.js';
import { Policy } from './policy.js';
import { Residential } from './residential.js';
import { TileUtils } from './tileUtils.js';
import * as TileValues from './tileValues.ts';

var WATERFRONT = 3;
var BIG_PARK_RADIUS = 8;
var SMALL_PARK_RADIUS = 2;

var isWater = function(v) { return v >= TileValues.WATER_LOW && v <= TileValues.WATER_HIGH; };
var isSmallPark = function(v) { return (v >= TileValues.WOODS2 && v <= TileValues.WOODS5) || v === TileValues.FOUNTAIN; };

// Mark every 2x2 block whose centre is within r tiles of (x, y)
var markCircle = function(bm, x, y, r, value) {
  var size = bm.blockSize, half = size / 2;
  var bx0 = Math.max(0, Math.floor((x - r) / size)), bx1 = Math.min(bm.width - 1, Math.floor((x + r) / size));
  var by0 = Math.max(0, Math.floor((y - r) / size)), by1 = Math.min(bm.height - 1, Math.floor((y + r) / size));
  for (var bx = bx0; bx <= bx1; bx++) {
    for (var by = by0; by <= by1; by++) {
      var dx = bx * size + half - (x + 0.5), dy = by * size + half - (y + 0.5);
      if (dx * dx + dy * dy <= r * r && bm.get(bx, by) < value)
        bm.set(bx, by, value);
    }
  }
};

// Big parks the player built: {"x,y": true} (their fountain in the middle). Ones that were bulldozed are dropped.
var bigParkCentres = function(map) {
  var out = [];
  var parks = Policy.bigParks || {};
  Object.keys(parks).forEach(function(k) {
    var p = k.split(',').map(Number);
    if (map.testBounds(p[0], p[1]) && map.getTileValue(p[0], p[1]) === TileValues.FOUNTAIN)
      out.push(p);
    else
      delete parks[k];
  });
  return out;
};

// POLICY LAB v26: forget highway tiles whose road is gone (burnt, flooded, crumbled)
var tidyHighways = function(map) {
  Object.keys(Policy.highways || {}).forEach(function(k) {
    var p = k.split(',').map(Number);
    if (!map.testBounds(p[0], p[1]) || !TileUtils.isDriveable(map.getTileValue(p[0], p[1])))
      Policy.setHighway(p[0], p[1], false);
  });
};

var scan = function(map, blockMaps) {
  tidyHighways(map);
  var water = blockMaps.waterfrontMap, parks = blockMaps.parkEffectMap;
  water.clear();
  parks.clear();
  var sewage = Policy.sewagePollution && blockMaps.sewageMap;
  var big = bigParkCentres(map);
  var bigSet = {};
  big.forEach(function(p) { bigSet[p[0] + ',' + p[1]] = true; });

  for (var x = 0; x < map.width; x++) {
    for (var y = 0; y < map.height; y++) {
      var v = map.getTileValue(x, y);
      if (isWater(v)) {
        if (sewage && sewage.worldGet(x, y) >= 40)
          continue;
        // only the shore matters: water with land next to it
        if ((x > 0 && !isWater(map.getTileValue(x - 1, y))) || (x < map.width - 1 && !isWater(map.getTileValue(x + 1, y))) ||
            (y > 0 && !isWater(map.getTileValue(x, y - 1))) || (y < map.height - 1 && !isWater(map.getTileValue(x, y + 1))))
          markCircle(water, x, y, WATERFRONT + 1, 1);   // +1: coverage is measured from the middle of 2x2 blocks
      } else if (isSmallPark(v) && !bigSet[x + ',' + y]) {
        markCircle(parks, x, y, SMALL_PARK_RADIUS, 1);
      }
    }
  }
  big.forEach(function(p) { markCircle(parks, p[0], p[1], BIG_PARK_RADIUS, 2); });
};

// The land value the city taxes (see the note at the top)
var taxLandValue = function(map, blockMaps, fallback) {
  var lv = blockMaps.landValueMap;
  var total = 0, weight = 0;
  for (var x = 0; x < map.width; x++) {
    for (var y = 0; y < map.height; y++) {
      var tile = map.getTile(x, y);
      if (!tile.isZone())
        continue;
      var v = tile.getValue(), w = 0;
      // the same weights as the game's population count: residents count 1/8, shops and factories 1
      if (TileUtils.isResidential(v) && v !== TileValues.HOSPITAL)
        w = Residential.getZonePopulation(map, x, y, v) / 8;
      else if (TileUtils.isCommercial(v))
        w = Commercial.getZonePopulation(map, x, y, v);
      else if (TileUtils.isIndustrial(v))
        w = Industrial.getZonePopulation(map, x, y, v);
      if (w > 0) {
        total += w * lv.worldGet(x, y);
        weight += w;
      }
    }
  }
  return weight > 0 ? Math.round(total / weight) : fallback;
};


var Amenities = {
  WATERFRONT: WATERFRONT,
  BIG_PARK_RADIUS: BIG_PARK_RADIUS,
  WATERFRONT_BONUS: 40,
  BIG_PARK_CRIME: 40,
  SMALL_PARK_CRIME: 15,
  BIG_PARK_AIR: 0.6,
  scan: scan,
  taxLandValue: taxLandValue
};


export { Amenities };

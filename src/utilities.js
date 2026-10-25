/* Policy Lab additions to micropolisJS (2026).
 *
 * This code is released under the GNU GPL v3, with some additional terms, like the rest of micropolisJS.
 * Modified version: NOT the original micropolisJS / Micropolis.
 *
 * Two new buildings:
 *
 *  TRAIN DEPOT (3x3). Works if there is rail next to it. Zones within about 16 tiles can commute by train: their trips
 *  may travel twice as far (60 tiles instead of 30), and half as much of their traffic ends up on the roads.
 *
 *  WATER TREATMENT PLANT (3x3). Needs power. Treats the sewage of every zone within about 24 tiles.
 *  If the world model says sewage pollutes rivers, zones that are NOT served send their sewage to the nearest water,
 *  which becomes polluted (lowering land value along the banks and spoiling the "nice view" bonus for nearby homes).
 *  Simplification: the map has no direction of flow, so sewage goes to the nearest water and spreads from there.
 */

import { Policy } from './policy.js';
import { TileUtils } from './tileUtils.js';
import * as TileValues from "./tileValues.ts";

// Coverage radii, in tiles
var DEPOT_RADIUS = 16;
var WATER_RADIUS = 24;
// How far untreated sewage travels looking for water, in tiles
var SEWAGE_SEARCH_RADIUS = 20;
// Yearly running costs
var DEPOT_MAINTENANCE = 50;
var WATER_PLANT_MAINTENANCE = 100;
// Yearly running cost of each hospital the player builds (hospitals that appear by themselves are free, as originally)
var HOSPITAL_MAINTENANCE = 150;
// Hospital reach, in tiles
var HEALTH_RADIUS = 20;


var isWater = function(tileValue) {
  return tileValue >= TileValues.RIVER && tileValue <= TileValues.LASTRIVEDGE;
};

var isRail = function(tileValue) {
  return (tileValue >= TileValues.RAILBASE && tileValue <= TileValues.LASTRAIL) ||
         tileValue === TileValues.RAILHPOWERV || tileValue === TileValues.RAILVPOWERH ||
         tileValue === TileValues.HRAILROAD || tileValue === TileValues.VRAILROAD;
};

// Mark every block of a coverage map within `radius` tiles of (x, y)
var markCoverage = function(blockMap, x, y, radius) {
  var size = blockMap.blockSize;
  for (var wx = x - radius; wx <= x + radius; wx += size) {
    for (var wy = y - radius; wy <= y + radius; wy += size) {
      if (wx < 0 || wy < 0 || wx >= blockMap.gameMapWidth || wy >= blockMap.gameMapHeight)
        continue;
      var dx = wx - x, dy = wy - y;
      if (dx * dx + dy * dy <= radius * radius)
        blockMap.worldSet(wx, wy, 1);
    }
  }
};


// Called by the map scanner when it finds the centre tile of a train depot
var depotFound = function(map, x, y, simData) {
  simData.census.depotPop += 1;

  // The depot only works if a rail line touches it (any tile in the ring just outside the 3x3 building)
  var connected = false;
  for (var dx = -2; dx <= 2 && !connected; dx++) {
    for (var dy = -2; dy <= 2 && !connected; dy++) {
      if (Math.abs(dx) < 2 && Math.abs(dy) < 2)
        continue;
      if (map.testBounds(x + dx, y + dy) && isRail(map.getTileValue(x + dx, y + dy)))
        connected = true;
    }
  }

  if (!connected) {
    simData.census.depotUnconnected += 1;
    (simData.census.depotUnconnectedList = simData.census.depotUnconnectedList || []).push({x: x, y: y});
    return;
  }

  markCoverage(simData.blockMaps.depotMapNext, x, y, DEPOT_RADIUS);
};


// Called by the map scanner when it finds the centre tile of a water treatment plant
var waterPlantFound = function(map, x, y, simData) {
  simData.census.waterPlantPop += 1;

  if (!map.getTile(x, y).isPowered()) {
    simData.census.waterPlantUnpowered += 1;
    (simData.census.waterPlantUnpoweredList = simData.census.waterPlantUnpoweredList || []).push({x: x, y: y});
    return;
  }

  markCoverage(simData.blockMaps.waterMapNext, x, y, WATER_RADIUS);
};


// Find the nearest water tile, searching outwards in squares
var nearestWater = function(map, x, y) {
  for (var r = 2; r <= SEWAGE_SEARCH_RADIUS; r++) {
    for (var i = -r; i <= r; i++) {
      var candidates = [[x + i, y - r], [x + i, y + r], [x - r, y + i], [x + r, y + i]];
      for (var c = 0; c < 4; c++) {
        var cx = candidates[c][0], cy = candidates[c][1];
        if (map.testBounds(cx, cy) && isWater(map.getTileValue(cx, cy)))
          return {x: cx, y: cy};
      }
    }
  }
  return null;
};


// Work out where every zone's sewage goes. Fills blockMaps.sewageMap (0-255) and census counts.
var sewageScan = function(map, census, blockMaps) {
  var sewageMap = blockMaps.sewageMap;
  var waterMap = blockMaps.waterMap;
  sewageMap.clear();

  var treated = 0, untreated = 0, toRiver = 0;

  for (var x = 0; x < map.width; x++) {
    for (var y = 0; y < map.height; y++) {
      var tile = map.getTile(x, y);
      var amount = 0;
      if (TileUtils.isResidentialZone(tile)) amount = 20;
      else if (TileUtils.isCommercialZone(tile)) amount = 15;
      else if (TileUtils.isIndustrialZone(tile)) amount = 30;  // industrial wastewater is heavier
      if (amount === 0)
        continue;

      if (waterMap.worldGet(x, y) > 0) {
        treated++;
        continue;
      }

      untreated++;
      if (!Policy.sewagePollution)
        continue;

      var w = nearestWater(map, x, y);
      if (w === null)
        continue;  // no water nearby: it soaks away (not modelled)

      toRiver++;
      sewageMap.worldSet(w.x, w.y, Math.min(255, sewageMap.worldGet(w.x, w.y) + amount));
    }
  }

  // Let the sewage spread out a little from where it reaches the water
  for (var pass = 0; pass < 2; pass++) {
    var copy = [];
    for (var bx = 0; bx < sewageMap.width; bx++) {
      copy[bx] = [];
      for (var by = 0; by < sewageMap.height; by++)
        copy[bx][by] = sewageMap.get(bx, by);
    }
    for (bx = 0; bx < sewageMap.width; bx++) {
      for (by = 0; by < sewageMap.height; by++) {
        var total = copy[bx][by] * 2, n = 2;
        if (bx > 0) { total += copy[bx - 1][by]; n++; }
        if (by > 0) { total += copy[bx][by - 1]; n++; }
        if (bx < sewageMap.width - 1) { total += copy[bx + 1][by]; n++; }
        if (by < sewageMap.height - 1) { total += copy[bx][by + 1]; n++; }
        sewageMap.set(bx, by, Math.min(255, Math.round(total / n * 1.3)));
      }
    }
  }

  census.sewageTreatedZones = treated;
  census.sewageUntreatedZones = untreated;
  census.sewageToRiverZones = toRiver;
};


var Utilities = {
  markCoverage: markCoverage,
  DEPOT_MAINTENANCE: DEPOT_MAINTENANCE,
  WATER_PLANT_MAINTENANCE: WATER_PLANT_MAINTENANCE,
  HOSPITAL_MAINTENANCE: HOSPITAL_MAINTENANCE,
  HEALTH_RADIUS: HEALTH_RADIUS,
  isWater: isWater,
  registerHandlers: function(mapScanner, repairManager) {
    mapScanner.addAction(TileValues.DEPOT, depotFound);
    mapScanner.addAction(TileValues.WATERPLANT, waterPlantFound);
    repairManager.addAction(TileValues.DEPOT, 15, 3);
    repairManager.addAction(TileValues.WATERPLANT, 15, 3);
  },
  sewageScan: sewageScan
};


export { Utilities };

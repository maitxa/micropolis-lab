/* micropolisJS. Adapted by Graeme McCutcheon from Micropolis.
 *
 * This code is released under the GNU GPL v3, with some additional terms.
 * Please see the files LICENSE and COPYING for details. Alternatively,
 * consult http://micropolisjs.graememcc.co.uk/LICENSE and
 * http://micropolisjs.graememcc.co.uk/COPYING
 *
 * The name/term "MICROPOLIS" is a registered trademark of Micropolis (https://www.micropolis.com) GmbH
 * (Micropolis Corporation, the "licensor") and is licensed here to the authors/publishers of the "Micropolis"
 * city simulation game and its source code (the project or "licensee(s)") as a courtesy of the owner.
 *
 */

import { Random } from './random.ts';
import { Tile } from './tile.ts';
import { ANIMBIT, BULLBIT } from "./tileFlags.ts";
import * as TileValues from "./tileValues.ts";

var unwrapTile = function(f) {
  return function(tile) {
    if (tile instanceof Tile)
      tile = tile.getValue();
    return f.call(null, tile);
  };
};


var canBulldoze = unwrapTile(function(tileValue) {
  return (tileValue >= TileValues.FIRSTRIVEDGE  && tileValue <= TileValues.LASTRUBBLE) ||
         (tileValue >= TileValues.POWERBASE + 2 && tileValue <= TileValues.POWERBASE + 12) ||
         (tileValue >= TileValues.TINYEXP       && tileValue <= TileValues.LASTTINYEXP + 2);
});


var isCommercial = unwrapTile(function(tile) {
  return tile >= TileValues.COMBASE && tile < TileValues.INDBASE;
});


// POLICY LAB: where each zone's trips may end, exactly as in the 1989 original (s_traf.c, DriveDone:
// TARGL = {COMBASE, LHTHR, LHTHR}, TARGH = {NUCLEAR, PORT, COMBASE}). micropolisJS had narrowed these to
// homes -> shops only, shops -> factories only.
var isResidentialTripEnd = unwrapTile(function(tile) {
  // homes: any shop, factory or other big building (seaport, airport, power plants, stations, stadium)
  return tile >= TileValues.COMBASE && tile <= TileValues.NUCLEAR;
});

var isCommercialTripEnd = unwrapTile(function(tile) {
  // shops: any home, hospital, church, shop, factory or the seaport
  return tile >= TileValues.LHTHR && tile <= TileValues.PORT;
});

var isIndustrialTripEnd = unwrapTile(function(tile) {
  // factories: any home (workers), hospital or church
  return tile >= TileValues.LHTHR && tile <= TileValues.COMBASE;
});


var isCommercialZone = function(tile) {
  return tile.isZone() && isCommercial(tile);
};


var isDriveable = unwrapTile(function(tile) {
  return (tile >= TileValues.ROADBASE && tile <= TileValues.LASTROAD) ||
         (tile >= TileValues.RAILHPOWERV && tile <= TileValues.LASTRAIL);
});


var isFire = unwrapTile(function(tile) {
  return tile >= TileValues.FIREBASE && tile < TileValues.ROADBASE;
});


var isFlood = unwrapTile(function(tile) {
  return tile >= TileValues.FLOOD && tile < TileValues.LASTFLOOD;
});


var isIndustrial = unwrapTile(function(tile) {
  return tile >= TileValues.INDBASE && tile < TileValues.PORTBASE;
});


var isIndustrialZone = function(tile) {
  return tile.isZone() && isIndustrial(tile);
};


var isManualExplosion = unwrapTile(function(tile) {
  return tile >= TileValues.TINYEXP && tile <= TileValues.LASTTINYEXP;
});


var isRail = unwrapTile(function(tile) {
  return tile >= TileValues.RAILBASE && tile < TileValues.RESBASE;
});


var isResidential = unwrapTile(function(tile) {
  return tile >= TileValues.RESBASE && tile < TileValues.HOSPITALBASE;
});


var isResidentialZone = function(tile) {
  return tile.isZone() && isResidential(tile);
};


var isRoad = unwrapTile(function(tile) {
  return tile >= TileValues.ROADBASE && tile < TileValues.POWERBASE;
});


var normalizeRoad = unwrapTile(function(tile) {
  return (tile >= TileValues.ROADBASE && tile <= TileValues.LASTROAD + 1) ? (tile & 15) + 64 : tile;
});


var randomFire = function() {
  return new Tile(TileValues.FIRE + (Random.getRandom16() & 3), ANIMBIT);
};


var randomRubble = function() {
  return new Tile(TileValues.RUBBLE + (Random.getRandom16() & 3), BULLBIT);
};


var TileUtils = {
  canBulldoze: canBulldoze,
  isCommercial: isCommercial,
  isResidentialTripEnd: isResidentialTripEnd,
  isCommercialTripEnd: isCommercialTripEnd,
  isIndustrialTripEnd: isIndustrialTripEnd,
  isCommercialZone: isCommercialZone,
  isDriveable: isDriveable,
  isFire: isFire,
  isFlood: isFlood,
  isIndustrial: isIndustrial,
  isIndustrialZone: isIndustrialZone,
  isManualExplosion: isManualExplosion,
  isRail: isRail,
  isResidential: isResidential,
  isResidentialZone: isResidentialZone,
  isRoad: isRoad,
  normalizeRoad: normalizeRoad,
  randomFire: randomFire,
  randomRubble: randomRubble
};


export { TileUtils };

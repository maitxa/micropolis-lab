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

import { BaseSprite } from './baseSprite.js';
import { SHIP_CRASHED, SOUND_HONKHONK } from './messages.ts';
import { MiscUtils } from './miscUtils.js';
import { Policy } from './policy.js';
import { Random } from './random.ts';
import { SPRITE_SHIP } from './spriteConstants.ts';
import { SpriteUtils } from './spriteUtils.js';
import { TileUtils } from './tileUtils.js';
import * as TileValues from "./tileValues.ts";

function BoatSprite(map, spriteManager, x, y) {
  this.init(SPRITE_SHIP, map, spriteManager, x, y);
  this.width = 48;
  this.height = 48;
  this.xOffset = -24;
  this.yOffset = -24;

  if (x < SpriteUtils.worldToPix(4))
    this.frame = 3;
  else if (x >= SpriteUtils.worldToPix(map.width - 4))
    this.frame = 7;
  else if (y < SpriteUtils.worldToPix(4))
    this.frame = 5;
  else if (y >= SpriteUtils.worldToPix(map.height - 4))
    this.frame = 1;
  else
    this.frame = 3;

  this.newDir = this.frame;
  this.dir = 10;
  this.count = 1;
}


BaseSprite(BoatSprite);


// This is an odd little function. It returns true if
// oldDir is 180° from newDir and tileValue is underwater
// rail or wire, and returns false otherwise
var oppositeAndUnderwater = function(tileValue, oldDir, newDir) {
  var opposite = oldDir + 4;

  if (opposite > 8)
    opposite -= 8;

  if (newDir != opposite)
    return false;

  if (tileValue == TileValues.POWERBASE || tileValue == TileValues.POWERBASE + 1 ||
      tileValue == TileValues.RAILBASE || tileValue == TileValues.RAILBASE + 1)
    return true;

  return false;
};


// POLICY LAB v30: a crossing high enough for ships to sail under: rail or a power line over the water, or a highway
// bridge (highway bridges never open)
// (only where it lies across the channel: channel on both sides, so ships don't sail along the crossing itself)
var isChannel = function(map, x, y) {
  if (!map.testBounds(x, y))
    return true;   // the channel runs off the edge of the map
  var v = map.getTileValue(x, y);
  return v === TileValues.CHANNEL || v === TileValues.BRWH || v === TileValues.BRWV;
};

var highCrossing = function(map, x, y, tileValue) {
  var high = tileValue === TileValues.HPOWER || tileValue === TileValues.VPOWER ||
             tileValue === TileValues.HRAIL || tileValue === TileValues.VRAIL;
  if (!high) {
    var r = TileUtils.normalizeRoad(tileValue);
    high = (r === TileValues.HBRIDGE || r === TileValues.VBRIDGE) && Policy.isHighway(x, y);
  }
  return high && ((isChannel(map, x, y - 1) && isChannel(map, x, y + 1)) || (isChannel(map, x - 1, y) && isChannel(map, x + 1, y)));
};


var tileDeltaX = [0,  0,  1,  1,  1,  0, -1, -1, -1];
var tileDeltaY = [0, -1, -1,  0,  1,  1,  1,  0, -1];
var xDelta = [0,  0,  2,  2,  2,  0, -2, -2, -2];
var yDelta = [0, -2, -2,  0,  2,  2,  2,  0, -2];
var tileWhiteList = [TileValues.RIVER, TileValues.CHANNEL, TileValues.POWERBASE,
                TileValues.POWERBASE + 1, TileValues.RAILBASE,
                TileValues.RAILBASE + 1, TileValues.BRWH, TileValues.BRWV];

var CANTMOVE = 10;

// These tiles are open water or crossings through which the ship sprite can
// safely pass. The existing routing rules further restrict its choices.
// POLICY LAB v30: ships also pass under high crossings (rail, power lines, highway bridges across the channel)
var isShipWater = function(map, x, y) {
  var tile = map.getTileValue(x, y);
  return tileWhiteList.indexOf(tile) !== -1 || highCrossing(map, x, y, tile);
};

var isDirectionNavigable = function(map, x, y, oldDir, frame) {
  var nextX = x + tileDeltaX[frame];
  var nextY = y + tileDeltaY[frame];
  if (!map.testBounds(nextX, nextY))
    return false;
  var next = map.getTileValue(nextX, nextY);
  return next === TileValues.CHANNEL || next === TileValues.BRWH ||
         next === TileValues.BRWV || highCrossing(map, nextX, nextY, next) || oppositeAndUnderwater(next, oldDir, frame);
};

BoatSprite.prototype.move = function(spriteCycle, disasterManager, blockMaps) {
  var tile = TileValues.RIVER;
  var frame, x, y;

  if (this.soundCount > 0)
    this.soundCount--;

  if (this.soundCount === 0) {
    if ((Random.getRandom16() & 3) === 1) {
      // TODO Scenarios
      // TODO Sound
      this._emitEvent(SOUND_HONKHONK);
    }

    this.soundCount = 200;
  }

  if (this.count > 0)
      this.count--;


  if (this.count === 0) {
    // Ships turn slowly: only 45° every 9 cycles
    this.count = 9;

    // If already executing a turn, continue to do so
    if (this.frame !== this.newDir) {
      this.frame = SpriteUtils.turnTo(this.frame, this.newDir);
      return;
    }

    // Otherwise pick a new direction
    // Choose a random starting direction to search from
    // 0 = N, 1 = NE, ... 7 = NW
    var startDir = Random.getRandom16() & 7;

    for (var dir = startDir; dir < (startDir + 8); dir++) {
      frame = (dir & 7) + 1;

      if (frame === this.dir)
        continue;

      // Prevent diagonal corner-cutting across land or other obstacles.
      x = this.worldX + tileDeltaX[frame];
      y = this.worldY + tileDeltaY[frame];
      var diagonal = tileDeltaX[frame] !== 0 && tileDeltaY[frame] !== 0;
      var clearCorner = !diagonal ||
        (this.map.testBounds(x, this.worldY) &&
         this.map.testBounds(this.worldX, y) &&
         isShipWater(this.map, x, this.worldY) &&
         isShipWater(this.map, this.worldX, y));

      if (clearCorner && isDirectionNavigable(this.map, this.worldX, this.worldY, this.dir, frame)) {
          this.newDir = frame;
          this.frame = SpriteUtils.turnTo(this.frame, this.newDir);
          this.dir = frame + 4;

          if (this.dir > 8)
            this.dir -= 8;
          break;
      }
    }

    if (dir === (startDir + 8)) {
      // At a dead end, turn around if the return channel is usable.
      // 'dir' is the direction we arrived from, normally skipped above.
      var reverse = this.dir;
      if (reverse >= 1 && reverse <= 8 &&
          isDirectionNavigable(this.map, this.worldX, this.worldY, CANTMOVE, reverse)) {
        this.newDir = reverse;
        this.frame = SpriteUtils.turnTo(this.frame, reverse);
        this.dir = reverse + 4;
        if (this.dir > 8) this.dir -= 8;
      } else {
        this.dir = CANTMOVE;
        // Keep the ship stationary rather than assigning a random landward bearing.
        this.newDir = this.frame;
      }
    }
  } else {
    frame = this.frame;

    if (frame === this.newDir)  {
      var nextPixX = this.x + xDelta[frame];
      var nextPixY = this.y + yDelta[frame];
      var nextTileX = nextPixX >> 4;
      var nextTileY = nextPixY >> 4;
      if (!this.map.testBounds(nextTileX, nextTileY)) {
        this.frame = 0; // Ship has sailed off the map.
        return;
      }
      if (!isShipWater(this.map, nextTileX, nextTileY)) {
        // A bridge may have closed or the channel may have changed since
        // the last course decision. Never sail through that obstruction.
        this.count = 1;
        this.dir = CANTMOVE;
        this.newDir = this.frame;
      } else {
        this.x = nextPixX;
        this.y = nextPixY;
      }
    }
  }

  if (this.spriteNotInBounds()) {
    this.frame = 0;
    return;
  }

  // Validate the tile the ship actually occupies, not the last neighbour
  // inspected during its random direction search. The old code could wreck
  // a ship on a valid channel when its final examined neighbour was land.
  var shipX = this.worldX;
  var shipY = this.worldY;
  if (!this.map.testBounds(shipX, shipY))
    return;
  if (!isShipWater(this.map, shipX, shipY)) {
    this.explodeSprite();
    SpriteUtils.destroyMapTile(this.spriteManager, this.map, blockMaps, this.x, this.y);
  }
};


BoatSprite.prototype.explodeSprite = function() {
  this.frame = 0;
  this.spriteManager.makeExplosionAt(this.x, this.y);
  this._emitEvent(SHIP_CRASHED, {showable: true, x: this.worldX, y: this.worldY});
};


// Metadata for image loading
Object.defineProperties(BoatSprite,
  {ID: MiscUtils.makeConstantDescriptor(4),
   width: MiscUtils.makeConstantDescriptor(48),
   frames: MiscUtils.makeConstantDescriptor(8)});


export { BoatSprite };

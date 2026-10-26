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

import $ from "jquery";

import { AnimationManager } from './animationManager.js';
import { GameMap } from './gameMap.js';
import { MiscUtils } from './miscUtils.js';
import { MouseBox } from './mouseBox.js';
import { Position } from './position.ts';
import { TileSet } from './tileSet.js';
import { TILE_INVALID } from "./tileValues.ts";
import { Policy } from './policy.js';
import { HDTiles } from './hdTiles.js';

function GameCanvas(id, parentNode) {
  if (!(this instanceof GameCanvas))
    return new GameCanvas(id, parentNode, width, height);

  if (arguments.length < 1)
    throw new Error('Attempt to construct a GameCanvas with no parameters');

  // Argument shuffling
  if (parentNode === undefined) {
    // No ID supplied
    parentNode = id;
    id = GameCanvas.DEFAULT_ID;
  }

  if (typeof(parentNode) === 'string') {
    var orig = parentNode;
    parentNode = $(MiscUtils.normaliseDOMid(parentNode));
    parentNode = parentNode.length === 0 ? null : parentNode[0];
    if (parentNode === null)
      throw new Error('Node ' + orig + ' not found');
  }

  this._canvas = document.createElement('canvas');
  this._canvas.id = id;

  // The canvas is assumed to fill its container on-screen
  var rect = parentNode.getBoundingClientRect();
  this._canvas.width = rect.width;
  this._canvas.height = rect.height;
  this._canvas.style.margin = '0';
  this._canvas.style.padding = '0';

  // POLICY LAB: sharper graphics. On high-resolution screens the main map is drawn at the screen's real pixel density
  // (2 device pixels per CSS pixel); the monster TV keeps the original resolution. All internal sizes are in device
  // pixels. Zoom levels 1-3 multiply the tile size.
  this._dpr = (id === GameCanvas.DEFAULT_ID && (window.devicePixelRatio || 1) >= 1.5) ? 2 : 1;
  this._canvas.setAttribute('data-dpr', this._dpr);
  this._zoom = 1;
  this._spriteScale = 1;
  this._pendingSpriteSheet = null;
  this._pendingCentre = null;
  this._season = 'normal';

  this._pendingTileSet = null;

  // Remove any existing element with the same id
  var current = document.getElementById(id);
  if (current !== null) {
    if  (current.parentNode === parentNode)
      parentNode.replaceChild(this._canvas, current);
    else
      throw new Error('ID ' + id + ' already exists in document!');
  } else
    parentNode.appendChild(this._canvas);

  this.ready = false;
}


GameCanvas.prototype.init = function(map, tileSet, spriteSheet, animationManager) {
  animationManager = animationManager || new AnimationManager(map);

  if (arguments.length < 3)
    throw new Error('GameCanvas constructor called with too few arguments ' + [].toString.apply(arguments));

  if (!tileSet.isValid)
    throw new Error('TileSet not ready!');

  this._spriteSheet = spriteSheet;
  this._tileSet = tileSet;
  var w = this._tileSet.tileWidth;
  this._map = map;
  this.animationManager = new AnimationManager(map);

  if (this._canvas.width < w || this._canvas.height < w)
    throw new Error('Canvas too small!');

  // Whether to allow off-map scrolling
  this._allowScrolling = true;

  // An array indexed by tile offset containing the tileValue last painted there
  this._lastPaintedTiles = null;
  this._currentPaintedTiles = []; // for future use

  // Last time we painted, the canvas was this many tiles wide and tall
  this._lastPaintedWidth = -1;
  this._lastPaintedHeight = -1;

  // Last time we painted, the canvas was this wide and tall in pixels (determines whether we
  // can safely call putImageData)
  this._lastCanvasWidth = -1;
  this._lastCanvasHeight = -1;

  // After painting tiles, we store the image data here before painting sprites and mousebox
  this._lastCanvasData = null;

  this._calculateDimensions();

  // Have the dimensions changed since the last paint?
  this._pendingDimensionChange = false;
  var onResize = function(e) {
    this._pendingDimensionChange = true;
  }.bind(this);

  // Recompute canvas dimensions on resize
  window.addEventListener('resize', onResize, false);

  // Order is important here. ready must be set before the call to centreOn below
  this.ready = true;
  this.centreOn(Math.floor(this._map.width / 2), Math.floor(this._map.height / 2));

  this.paint(null, null);
};


GameCanvas.prototype._calculateDimensions = function(force) {
  force = force || false;

  // The canvas is assumed to fill its container on-screen
  // POLICY LAB: measured in device pixels (CSS pixels x pixel density)
  var cssWidth = this._canvas.parentNode.clientWidth, cssHeight = this._canvas.parentNode.clientHeight;
  var canvasWidth = this.canvasWidth = cssWidth * this._dpr;
  var canvasHeight = this.canvasHeight = cssHeight * this._dpr;

  if (canvasHeight === this._lastCanvasHeight && canvasWidth === this._lastCanvasWidth && !force)
    return;

  this._canvas.width = canvasWidth;
  this._canvas.height = canvasHeight;
  this._canvas.style.width = cssWidth + 'px';
  this._canvas.style.height = cssHeight + 'px';

  var w = this._tileSet.tileWidth;

  // How many tiles fit?
  this._wholeTilesInViewX = Math.floor(canvasWidth / w);
  this._wholeTilesInViewY = Math.floor(canvasHeight / w);
  this._totalTilesInViewX = Math.ceil(canvasWidth / w);
  this._totalTilesInViewY = Math.ceil(canvasHeight / w);

  if (this._allowScrolling) {
    // The min/max properties denote how far we will let the canvas' origin move: the map
    // should be visible in at least half the canvas
    this.minX = 0 - Math.ceil(Math.floor(canvasWidth/w) / 2);
    this.maxX = (this._map.width - 1) - Math.ceil(Math.floor(canvasWidth/w) / 2);
    this.minY = 0 - Math.ceil(Math.floor(canvasHeight/w) / 2);
    this.maxY = (this._map.height - 1) - Math.ceil(Math.floor(canvasHeight/w) / 2);
    this._totalTilesInViewY = Math.ceil(canvasHeight / w);
  } else {
    this.minX = 0;
    this.minY = 0;
    this.maxX = this._map.width - this._totalTilesInViewX;
    this.maxY = this._map.height - this._totalTilesInViewY;
  }

  this._pendingDimensionChange = true;
};


// NOTE: Canvas must be visible when this is called
GameCanvas.prototype.disallowOffMap = function() {
  this._allowScrolling = false;
  this._lastPaintedTiles = null;
  this._calculateDimensions(true);
};


GameCanvas.prototype.moveNorth = function() {
  if (!this.ready)
    throw new Error('Not ready!');

  if (this._originY > this.minY)
    this._originY--;
};


GameCanvas.prototype.moveEast = function() {
  if (!this.ready)
    throw new Error('Not ready!');

  if (this._originX < this.maxX)
    this._originX++;
};


GameCanvas.prototype.moveSouth = function() {
  if (!this.ready)
    throw new Error('Not ready!');

  if (this._originY < this.maxY)
    this._originY++;
};


GameCanvas.prototype.moveWest = function() {
  if (!this.ready)
    throw new Error('Not ready!');

  if (this._originX > this.minX)
    this._originX--;
};


GameCanvas.prototype.moveTo = function(x, y) {
  if (arguments.length < 1)
    throw new Error('GameCanvas moveTo called with no arguments');

  if (!this.ready)
    throw new Error('Not ready!');

  if (x < this.minX || x > this.maxX ||
      y < this.minY || y > this.maxY)
    throw new Error('Coordinates out of bounds');

  this._originX = x;
  this._originY = y;
};


GameCanvas.prototype.centreOn = function(x, y) {
  if (arguments.length < 1)
    throw new Error('GameCanvas centreOn called with no arguments');

  if (!this.ready)
    throw new Error('Not ready!');

  if (y === undefined) {
    y = x.y;
    x = x.x;
  }

  // XXX Need to fix so that centres on best point if bounds fall outside
  // XXX min/max
  var originX = Math.floor(x) - Math.ceil(this._wholeTilesInViewX / 2);
  var originY = Math.floor(y) - Math.ceil(this._wholeTilesInViewY / 2);

  if (originX > this.maxX)
    originX = this.maxX;
  if (originX < this.minX)
    originX = this.minX;
  if (originY > this.maxY)
    originY = this.maxY;
  if (originY < this.minY)
    originY = this.minY;

  this._originX = originX;
  this._originY = originY;
};


GameCanvas.prototype.getTileOrigin = function() {
  var e = new Error('Not ready!');

  if (!this.ready)
    throw e;

  return {x: this._originX, y: this._originY};
};


GameCanvas.prototype.getMaxTile = function() {
  var e = new Error('Not ready!');

  if (!this.ready)
    throw e;

  return {x: this._originX + this._totalTilesInViewX - 1, y: this._originY + this._totalTilesInViewY - 1};
};


GameCanvas.prototype.canvasCoordinateToTileOffset = function(x, y) {
  if (arguments.length < 2)
    throw new Error('GameCanvas canvasCoordinateToTileOffset called with too few arguments ' + [].toString.apply(arguments));

  if (!this.ready)
    throw new Error('Not ready!');

  return {x: Math.floor(x / this._tileSet.tileWidth),
          y: Math.floor(y / this._tileSet.tileWidth)};
};


GameCanvas.prototype.canvasCoordinateToTileCoordinate = function(x, y) {
  if (arguments.length < 2)
    throw new Error('GameCanvas canvasCoordinateToTileCoordinate called with too few arguments ' + [].toString.apply(arguments));

  if (!this.ready)
    throw new Error('Not ready!');

  if (x >= this.canvasWidth || y >= this.canvasHeight)
    return null;

  return {x: this._originX + Math.floor(x/this._tileSet.tileWidth),
          y: this._originY + Math.floor(y/this._tileSet.tileWidth)};
};


GameCanvas.prototype.canvasCoordinateToPosition = function(x, y) {
  if (arguments.length < 2)
    throw new Error('GameCanvas canvasCoordinateToPosition called with too few arguments ' + [].toString.apply(arguments));

  if (!this.ready)
    throw new Error('Not ready!');

  if (x >= this.canvasWidth || y >= this.canvasHeight)
    return null;

  x = this._originX + Math.floor(x / this._tileSet.tileWidth);
  y = this._originY + Math.floor(y / this._tileSet.tileWidth);


  if (x < 0 || x >= this._map.width || y < 0 || y >= this._map.height)
    return null;

  return new Position(x, y);
};



GameCanvas.prototype.positionToCanvasCoordinate = function(p) {
  if (arguments.length < 1)
    throw new Error('GameCanvas positionToCanvasCoordinate called with too few arguments ' + [].toString.apply(arguments));

  return this.tileToCanvasCoordinate(p);
};



GameCanvas.prototype.tileToCanvasCoordinate = function(x, y) {
  if (arguments.length < 1)
    throw new Error('GameCanvas tileToCanvasCoordinate  called with too few arguments ' + [].toString.apply(arguments));

  if (!this.ready)
    throw new Error('Not ready!');

  if (y === undefined) {
    y = x.y;
    x = x.x;
  }

  if (x === undefined || y === undefined || x < this.minX || y < this.minY ||
      x > (this.maxX + this._totalTilesInViewX - 1) ||
      y > (this.maxY + this._totalTilesInViewY - 1))
    throw e;

  if (x < this._originX || x >= this._originX + this._totalTilesInViewX ||
      y < this._originY || y >= this._originY + this._totalTilesInViewY)
    return null;

  return {x: (x - this._originX) * this._tileSet.tileWidth,
          y: (y - this._originY) * this._tileSet.tileWidth};
};



GameCanvas.prototype.changeTileSet = function(tileSet) {
  if (!this.ready)
    throw new Error('Not ready!');

  if (!tileSet.isValid)
    throw new Error('new tileset not loaded');

  this._pendingTileSet = tileSet;
};



GameCanvas.prototype._screenshot = function(onlyVisible) {
  if (onlyVisible)
    return this._canvas.toDataURL();

  var tempCanvas = document.createElement('canvas');
  tempCanvas.width = this._map.width * this._tileSet.tileWidth;
  tempCanvas.height = this._map.height * this._tileSet.tileWidth;
  var ctx = tempCanvas.getContext('2d');

  for (var x = 0; x < this._map.width; x++) {
    for (var y = 0; y < this._map.height; y++) {
      this._paintOne(ctx, this._map.getTileValue(x, y), x, y);
    }
  }
  return tempCanvas.toDataURL();
};


GameCanvas.prototype.screenshotMap = function() {
  return this._screenshot(false);
};


GameCanvas.prototype.screenshotVisible = function() {
  return this._screenshot(true);
};


GameCanvas.prototype.shoogle = function() {
  // TODO Earthquakes
};


GameCanvas.prototype._processSprites = function(ctx, spriteList) {
  var spriteDamage = [];
  // POLICY LAB: sprite positions are in original 16-pixels-per-tile units; scale them to the current tile size, and
  // read from the enlarged sprite sheet if one is loaded (spriteScale)
  var scale = this._tileSet.tileWidth / 16;
  var ss = this._spriteScale || 1;

  for (var i = 0, l = spriteList.length; i < l; i++) {
    var sprite = spriteList[i];
    try {
      ctx.drawImage(this._spriteSheet,
                    (sprite.frame - 1) * 48 * ss,
                    (sprite.type - 1) * 48 * ss,
                    sprite.width * ss,
                    sprite.width * ss,
                    (sprite.x + sprite.xOffset - this._originX * 16) * scale,
                    (sprite.y + sprite.yOffset - this._originY * 16) * scale,
                    sprite.width * scale,
                    sprite.width * scale);
    } catch (e) {
      throw new Error('Failed to draw sprite ' + sprite.type + ' frame ' + sprite.frame + ' at ' + sprite.x +  ', ' + sprite.y);
    }

    // sprite values are in (16-per-tile) pixels
    spriteDamage.push({x: Math.floor((sprite.x + sprite.xOffset - this._originX * 16) / 16),
                       xBound: Math.ceil((sprite.x + sprite.xOffset + sprite.width - this._originX * 16) / 16),
                       y: Math.floor((sprite.y + sprite.yOffset - this._originY * 16) / 16),
                       yBound: Math.ceil((sprite.y + sprite.yOffset + sprite.height - this._originY * 16) / 16)});
  }

  return spriteDamage;
};


// Draws a mouse outline around the selected tiles. The mouse object is assumed to contain x and y properties which
// express the coordinate of the top-left of the box in terms of the number of tiles from the top left. It should
// also contain a width and height that are again expressed in terms of the number of tiles. The colour property
// naturally defines the colour of the painted box.
GameCanvas.prototype._processMouse = (function() {
  var damage = {x: 0, xBound: 0, y: 0, yBound: 0};

  return function(mouse) {
    if (mouse.width === 0 || mouse.height === 0)
      return;

    // For outlines bigger than 2x2 (in either dimension) assume the mouse is offset by
    // one tile
    var mouseX = mouse.x;
    var mouseY = mouse.y;
    var mouseWidth = mouse.width;
    var mouseHeight = mouse.height;
    var options = {colour: mouse.colour, outline: true};

    if (mouseWidth > 2)
      mouseX -= 1;
    if (mouseHeight > 2)
      mouseY -= 1;

    var offMap = (this._originX + mouseX < 0 && this._originX + mouseX + mouseWidth <= 0) ||
                 (this._originY + mouseY < 0 && this._originY + mouseY + mouseHeight <= 0) ||
                 this._originX + mouseX >= this._map.width || this._originY + mouseY >= this._map.height;

    if (offMap) {
      damage.x = damage.xBound = mouseX;
      damage.y = damage.yBound = mouseY;
      return damage;
    }

    var pos = {x: mouseX * this._tileSet.tileWidth, y: mouseY * this._tileSet.tileWidth};
    var width = mouseWidth * this._tileSet.tileWidth;
    var height = mouseHeight * this._tileSet.tileWidth;
    MouseBox.draw(this._canvas, pos, width, height, options);

    // Return an object representing tiles that were damaged that will need redrawn
    // Note that we must take an extra tile either side to account for the outline
    damage.x = mouseX - 1;
    damage.xBound = mouseX + mouseWidth + 2;
    damage.y = mouseY - 1;
    damage.yBound = mouseY + mouseWidth + 2;
    return damage;
  };
})();


GameCanvas.prototype._paintVoid = function(ctx, x, y) {
  var w = this._tileSet.tileWidth;
  ctx.fillStyle = 'black';
  ctx.fillRect(x * w, y * w, w, w);
};


GameCanvas.prototype._paintOne = function(ctx, tileVal, x, y) {
  if (tileVal === TILE_INVALID) {
    this._paintVoid(ctx, x, y);
    return;
  }

  var src = this._tileSet[tileVal];
  try {
    ctx.drawImage(src, x * this._tileSet.tileWidth, y * this._tileSet.tileWidth);
  } catch (e) {
    var mapX = this._originX + x;
    var mapY = this._originY + y;
    throw new Error('Failed to draw tile ' + tileVal + ' at ' + x + ', ' + y + ' (map ' + mapX + ', ' + mapY + ' tile ' + (this._map.testBounds(mapX, mapY) ? this._map.getTileValue(mapX, mapY) : '?? (Out of bounds)') + ')');
  }
};


GameCanvas.prototype._paintTiles = function(ctx, paintData) {
  var x, y, row, index;
  var lastPaintedTiles = this._lastPaintedTiles;

  var width = this._totalTilesInViewX;
  var height = this._totalTilesInViewY;

  if (lastPaintedTiles !== null) {
    // We have painted the canvas before. There are 3 possibilities:
    //  - The canvas is exactly the same size as last time we painted
    //  - The canvas has grown
    //  - The canvas has shrunk
    //
    // In any case, we want to find the minimal area that was onscreen last paint
    // and this paint, and iterate over those tiles, repainting where necessary
    var xBound = Math.min(this._lastPaintedWidth, width);
    var yBound = Math.min(this._lastPaintedHeight, height);

    // Loop over the common area that we painted last time. Compare the current value against what was there last time
    for (y = 0; y < yBound; y++) {
      for (x = 0; x < xBound; x++) {
        index  = y * xBound + x;
        if (lastPaintedTiles[index] === paintData[index])
          continue;

        // Tile is different: repaint
        this._paintOne(ctx, paintData[index], x, y);
      }
    }

    // Do we have more tiles than before? Paint the extra width and/or the extra height
    if (width > this._lastPaintedWidth) {
      for (y = 0; y < height; y++) {
        for (x = this._lastPaintedWidth; x < width; x++) {
          index  = y * width + x;
          this._paintOne(ctx, paintData[index], x, y);
        }
      }
    }

    if (height > this._lastPaintedHeight) {
      for (y = this._lastPaintedHeight; y < height; y++) {
        for (x = 0; x < width; x++) {
          index  = y * width + x;
          this._paintOne(ctx, paintData[index], x, y);
        }
      }
    }
  } else {
    // Full paint
    for (y = 0; y < height; y++) {
      for (x = 0; x < width; x++) {
        index = y * width + x;
        this._paintOne(ctx, paintData[index], x, y);
      }
    }
  }

  // Stash data
  this._lastPaintedWidth = width;
  this._lastPaintedHeight = height;

  // Rotate tile data
  var temp = this._lastPaintedTiles;
  this._lastPaintedTiles = paintData;
  this._currentPaintedTiles = temp;
};


GameCanvas.prototype.paint = function(mouse, sprites, isPaused) {
  var i, l, x, y, row, damaged, xBound, yBound, index;

  if (!this.ready)
    throw new Error('Not ready!');

  var ctx = this._canvas.getContext('2d');
  var lastPaintedTiles = this._lastPaintedTiles;

  // Recompute our dimensions if there has been a resize since last paint
  if (this._pendingDimensionChange || this._pendingTileSet) {
    // POLICY LAB: switch tile set (and sprite sheet) BEFORE measuring, since tile sizes can now differ (zoom)
    var tileSizeChanged = false;
    if (this._pendingTileSet !== null) {
      tileSizeChanged = this._pendingTileSet.tileWidth !== this._tileSet.tileWidth;
      this._tileSet = this._pendingTileSet;
    }
    if (this._pendingSpriteSheet !== null) {
      this._spriteSheet = this._pendingSpriteSheet;
      this._spriteScale = this._pendingSpriteScale || 1;
      this._pendingSpriteSheet = null;
    }

    this._calculateDimensions(tileSizeChanged);
    this._pendingDimensionChange = false;

    if (tileSizeChanged) {
      lastPaintedTiles = this._lastPaintedTiles = null;
      if (this._pendingCentre)
        this.centreOn(this._pendingCentre.x, this._pendingCentre.y);
      this._pendingCentre = null;
      this._lastOverlayKey = null;
    }

    // If the dimensions or tileset has changed, set each entry in lastPaintedTiles to a bogus value to force a
    // repaint. Note: we use -2 as our bogus value; -1 would paint the black void
    if (this._pendingTileSet || this.canvasWidth !== this._lastCanvasWidth || this.canvasHeight !== this._lastCanvasHeight) {
      ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);

      for (y = 0, l = (lastPaintedTiles !== null ? lastPaintedTiles.length : 0); y < l; y++)
        lastPaintedTiles[y] = -2;
    }

    this._pendingTileSet = null;
  }

  var paintWidth = this._totalTilesInViewX;
  var paintHeight = this._totalTilesInViewY;

  // Fill an array with the values we need to paint
  var tileValues = this._map.getTileValuesForPainting(this._originX, this._originY, paintWidth, paintHeight, this._currentPaintedTiles);

  // Adjust for animations
  this.animationManager.getTiles(tileValues, this._originX, this._originY, paintWidth, paintHeight, isPaused);

  this._paintTiles(ctx, tileValues);
  // The _paintTiles call updates this._lastPaintedTiles. Update our cached copy
  lastPaintedTiles = this._lastPaintedTiles;

  // Stash various values for next paint
  this._lastCanvasWidth = this.canvasWidth;
  this._lastCanvasHeight = this.canvasHeight;

  // POLICY LAB: outlines of the car-free downtown and the green belt
  this._paintPolicyOverlay();
  // POLICY LAB: map layers (pollution, dead ends, workers nearby), then highlights for the advisor's hints on top
  this._paintLayer();
  this._paintHighlights();

  if (!mouse && !sprites) {
    return;
  }

  if (mouse) {
    damaged = this._processMouse(mouse);

    for (y = Math.max(0, damaged.y), yBound = Math.min(paintHeight, damaged.yBound); y < yBound; y++) {
      for (x = Math.max(0, damaged.x), xBound = Math.min(paintWidth, damaged.xBound); x < xBound; x++) {
        index = [y * paintWidth + x];
        // Note: we can't use TILE_INVALID (-1) as that in some sense is a valid tile for the void!
        lastPaintedTiles[index] = -2;
      }
    }
  }

  if (sprites) {
    damaged = this._processSprites(ctx, sprites);
    for (i = 0, l = damaged.length; i < l; i++) {
      var damagedArea = damaged[i];
      for (y = Math.max(0, damagedArea.y), yBound = Math.min(damagedArea.yBound, paintHeight); y < yBound; y++) {
        for (x = Math.max(0, damagedArea.x), xBound = Math.min(damagedArea.xBound, paintWidth); x < xBound; x++) {
          index = [y * paintWidth + x];
          this._lastPaintedTiles[index] = -2;
        }
      }
    }
  }
};


// POLICY LAB: draw the car-free downtown (orange dashed circle) and the green belt (green ring) on a transparent SVG
// layer above the map. The map canvas only repaints tiles that change, so drawing on it directly would leave fragments.
// The layer is only redrawn when something it depends on changes.
GameCanvas.prototype._paintPolicyOverlay = function() {
  // Only on the main map (the monster TV window reuses this class)
  if (this._canvas.id !== GameCanvas.DEFAULT_ID)
    return;

  var svg = this._policyOverlay;
  var hasOverlay = Policy.pedestrian || Policy.greenBelt;

  if (!hasOverlay) {
    if (svg)
      svg.style.display = 'none';
    return;
  }

  if (!svg) {
    svg = this._policyOverlay = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('id', 'policyOverlay');
    svg.style.position = 'absolute';
    svg.style.pointerEvents = 'none';
    this._canvas.parentNode.insertBefore(svg, this._canvas.nextSibling);
  }

  var tw = this._tileSet.tileWidth;
  var key = [this._originX, this._originY, tw, this.canvasWidth, this.canvasHeight, this._map.cityCentreX,
             this._map.cityCentreY, Policy.pedestrian, Policy.greenBelt].join(',');
  if (key === this._lastOverlayKey)
    return;
  this._lastOverlayKey = key;

  svg.style.display = '';
  svg.style.left = this._canvas.offsetLeft + 'px';
  svg.style.top = this._canvas.offsetTop + 'px';
  // Drawn in device pixels, displayed at CSS size
  svg.setAttribute('width', this.canvasWidth / this._dpr);
  svg.setAttribute('height', this.canvasHeight / this._dpr);
  svg.setAttribute('viewBox', '0 0 ' + this.canvasWidth + ' ' + this.canvasHeight);

  var originX = this._originX, originY = this._originY;
  var toPx = function(wx, wy) {
    return {x: (wx - originX) * tw + tw / 2, y: (wy - originY) * tw + tw / 2};
  };

  var parts = [];
  if (Policy.greenBelt) {
    var c = toPx(Policy.greenBeltCentre.x, Policy.greenBeltCentre.y);
    var ro = Policy.GREEN_BELT_OUTER * tw, ri = Policy.GREEN_BELT_INNER * tw;
    // A ring: outer circle minus inner circle (even-odd fill)
    var ring = 'M ' + (c.x - ro) + ' ' + c.y + ' a ' + ro + ' ' + ro + ' 0 1 0 ' + (2 * ro) + ' 0 a ' + ro + ' ' + ro +
               ' 0 1 0 ' + (-2 * ro) + ' 0 Z M ' + (c.x - ri) + ' ' + c.y + ' a ' + ri + ' ' + ri + ' 0 1 0 ' + (2 * ri) +
               ' 0 a ' + ri + ' ' + ri + ' 0 1 0 ' + (-2 * ri) + ' 0 Z';
    parts.push('<path d="' + ring + '" fill="rgba(0,120,0,0.18)" fill-rule="evenodd" stroke="rgba(0,90,0,0.7)" ' +
               'stroke-width="2" stroke-dasharray="6 4"/>');
  }
  if (Policy.pedestrian) {
    var p = toPx(this._map.cityCentreX, this._map.cityCentreY);
    parts.push('<circle cx="' + p.x + '" cy="' + p.y + '" r="' + (Policy.pedestrian * tw) + '" fill="rgba(255,165,0,0.08)" ' +
               'stroke="rgba(230,120,0,0.9)" stroke-width="2" stroke-dasharray="8 5"/>');
  }
  svg.innerHTML = parts.join('');
};


// POLICY LAB: highlights for the advisor's hints --------------------------------------------------------------------
// shapes: [{kind: 'zone', x, y, label, ring} | {kind: 'circle', x, y, r, label}] in map tiles; focus: index of the
// shape to pulse (the spot the player is looking at). Pass null to clear.
GameCanvas.prototype.setHighlights = function(shapes, focus) {
  this._hlVersion = (this._hlVersion || 0) + 1;
  this._highlights = shapes && shapes.length ? {shapes: shapes, focus: focus || 0, version: this._hlVersion} : null;
  this._lastHighlightKey = null;
};

var escapeSVG = function(s) {
  return String(s).replace(/[&<>"]/g, function(c) {
    return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c];
  });
};

GameCanvas.prototype._paintHighlights = function() {
  if (this._canvas.id !== GameCanvas.DEFAULT_ID)
    return;

  var svg = this._hintOverlay;
  var h = this._highlights;
  if (!h) {
    if (svg && svg.style.display !== 'none')
      svg.style.display = 'none';
    return;
  }

  if (!svg) {
    svg = this._hintOverlay = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('id', 'hintOverlay');
    svg.style.position = 'absolute';
    svg.style.pointerEvents = 'none';
    // always above the map layer
    this._canvas.parentNode.insertBefore(svg, this._layerOverlay ? this._layerOverlay.nextSibling : this._canvas.nextSibling);
  }

  var tw = this._tileSet.tileWidth;
  var key = [this._originX, this._originY, tw, this.canvasWidth, this.canvasHeight, h.focus, h.version].join(',');
  if (key === this._lastHighlightKey)
    return;
  this._lastHighlightKey = key;

  svg.style.display = '';
  svg.style.left = this._canvas.offsetLeft + 'px';
  svg.style.top = this._canvas.offsetTop + 'px';
  svg.setAttribute('width', this.canvasWidth / this._dpr);
  svg.setAttribute('height', this.canvasHeight / this._dpr);
  svg.setAttribute('viewBox', '0 0 ' + this.canvasWidth + ' ' + this.canvasHeight);

  var ox = this._originX, oy = this._originY, dpr = this._dpr;
  var px = function(wx) { return (wx - ox) * tw; };
  var py = function(wy) { return (wy - oy) * tw; };
  var line = Math.max(3, Math.round(tw / 6));
  var font = Math.round(13 * dpr);

  var label = function(x, y, text) {
    return '<text x="' + x + '" y="' + y + '" class="hlLabel" font-size="' + font + '" stroke-width="' +
           Math.round(4 * dpr) + '">' + escapeSVG(text) + '</text>';
  };

  var under = [], out = [], focusParts = [];
  h.shapes.forEach(function(s, i) {
    var parts = [];
    var focused = i === h.focus;
    if (s.kind === 'reach') {
      // roads the trip car can get to: darker for the first 15 tiles, lighter up to the limit
      var cells = function(list, cls) {
        return list.map(function(c) {
          return '<rect x="' + px(c[0]) + '" y="' + py(c[1]) + '" width="' + tw + '" height="' + tw + '" class="' + cls + '"/>';
        }).join('');
      };
      under.push('<g class="hlReach">' + cells(s.far, 'hlFar') + cells(s.near, 'hlNear') + '</g>');
      return;
    }
    if (s.kind === 'dead') {
      var dx0 = px(s.x), dy0 = py(s.y);
      parts.push('<rect x="' + (dx0 + line / 2) + '" y="' + (dy0 + line / 2) + '" width="' + (tw - line) + '" height="' + (tw - line) +
                 '" class="hlDead" stroke-width="' + line + '"/>');
      if (s.label)
        parts.push(label(dx0 + tw + line, dy0 + tw / 2, s.label));
      out.push('<g class="hlOther">' + parts.join('') + '</g>');
      return;
    }
    if (s.kind === 'bridge') {
      var bx = px(s.x), by = py(s.y);
      parts.push('<rect x="' + (bx + line / 2) + '" y="' + (by + line / 2) + '" width="' + (tw - line) + '" height="' + (tw - line) +
                 '" class="' + (s.open ? 'hlBridgeOpen' : 'hlBridge') + '" stroke-width="' + line + '"/>');
      parts.push(label(bx + tw + line, by + tw / 2, s.label));
      out.push('<g class="hlOther">' + parts.join('') + '</g>');
      return;
    }
    if (s.kind === 'tile') {
      var tx0 = px(s.x), ty0 = py(s.y);
      parts.push('<rect x="' + (tx0 - line / 2) + '" y="' + (ty0 - line / 2) + '" width="' + (tw + line) + '" height="' + (tw + line) +
                 '" class="hlZone" stroke-width="' + line + '"/>');
      if (focused)
        parts.push(label(tx0, ty0 - line, s.label));
      focusParts.push('<g class="hlFocus">' + parts.join('') + '</g>');
      return;
    }
    if (s.kind === 'zone' && s.tone === 'ok') {
      out.push('<g class="hlOk"><rect x="' + px(s.x - 1) + '" y="' + py(s.y - 1) + '" width="' + (3 * tw) + '" height="' + (3 * tw) +
               '" class="hlZoneOk" stroke-width="' + line + '" rx="' + Math.round(tw / 5) + '"/></g>');
      return;
    }
    if (s.kind === 'zone') {
      var x0 = px(s.x - 1), y0 = py(s.y - 1), w = 3 * tw;
      if (s.ring) {
        // the 12 tiles where a road would count: one tile out along each side (not the corners)
        var r = px(s.x - 2), t = py(s.y - 2);
        var ringPath = 'M ' + (r + tw) + ' ' + t + ' h ' + (3 * tw) + ' v ' + tw + ' h ' + tw + ' v ' + (3 * tw) + ' h ' + (-tw) +
                       ' v ' + tw + ' h ' + (-3 * tw) + ' v ' + (-tw) + ' h ' + (-tw) + ' v ' + (-3 * tw) + ' h ' + tw + ' Z';
        parts.push('<path d="' + ringPath + '" class="hlRing" stroke-width="' + Math.max(2, Math.round(line / 2)) +
                   '" stroke-dasharray="' + (2 * line) + ' ' + line + '"/>');
      }
      parts.push('<rect x="' + x0 + '" y="' + y0 + '" width="' + w + '" height="' + w + '" class="hlZone" stroke-width="' +
                 line + '" rx="' + Math.round(tw / 5) + '"/>');
      if (focused)
        parts.push(label(x0, y0 - (s.ring ? tw + line : line), s.label));
    } else if (s.kind === 'circle') {
      var cx = px(s.x) + tw / 2, cy = py(s.y) + tw / 2, rr = s.r * tw;
      parts.push('<circle cx="' + cx + '" cy="' + cy + '" r="' + rr + '" class="hlCircle" stroke-width="' + line +
                 '" stroke-dasharray="' + (3 * line) + ' ' + (2 * line) + '"/>');
      parts.push('<circle cx="' + cx + '" cy="' + cy + '" r="' + (line * 1.5) + '" class="hlDot"/>');
      if (focused)
        parts.push(label(cx - rr * 0.7, cy - rr - line, s.label));
    }
    var g = '<g class="' + (focused ? 'hlFocus' : 'hlOther') + '">' + parts.join('') + '</g>';
    if (focused)
      focusParts.push(g);
    else
      out.push(g);
  });
  // the spot being looked at is drawn last, on top
  svg.innerHTML = under.join('') + out.join('') + focusParts.join('');
};


// POLICY LAB: map layers ----------------------------------------------------------------------------------------
// shapes: [{kind: 'blocks', size, cells: [[x, y, level 1-3]]} | {kind: 'dead' | 'bridge', x, y, open} |
//          {kind: 'zone', x, y, tone: 'good' | 'warn' | 'bad'}] in map tiles. Pass null to clear.
GameCanvas.prototype.setLayer = function(shapes) {
  this._layerVersion = (this._layerVersion || 0) + 1;
  this._layer = shapes && shapes.length ? shapes : null;
  this._lastLayerKey = null;
};

// POLICY LAB v22: the shipping channel (where road bridges become drawbridges), shown while the road tool is selected
// or the Dead ends layer is on. cells: [[x, y]] in map tiles, or null.
GameCanvas.prototype.setChannel = function(cells) {
  var shapes = cells && cells.length ? cells.map(function(c) { return {kind: 'channel', x: c[0], y: c[1]}; }) : null;
  var key = shapes ? cells.map(function(c) { return c[0] + ':' + c[1]; }).join(',') : '';
  if (key === this._channelKey)
    return;
  this._channelKey = key;
  this._channel = shapes;
  this._layerVersion = (this._layerVersion || 0) + 1;
  this._lastLayerKey = null;
};

// POLICY LAB v23: permanent red frames on shops that can't reach customers. list: [{x, y}] zone centres, or null.
GameCanvas.prototype.setOutlines = function(list) {
  var key = list && list.length ? list.map(function(z) { return z.x + ':' + z.y; }).join(',') : '';
  if (key === this._outlinesKey)
    return;
  this._outlinesKey = key;
  this._outlines = key ? list.map(function(z) { return {kind: 'stuck', x: z.x, y: z.y}; }) : null;
  this._layerVersion = (this._layerVersion || 0) + 1;
  this._lastLayerKey = null;
};

GameCanvas.prototype._paintLayer = function() {
  if (this._canvas.id !== GameCanvas.DEFAULT_ID)
    return;
  var svg = this._layerOverlay;
  var allShapes = (this._channel || []).concat(this._layer || [], this._outlines || []);
  if (!allShapes.length) {
    if (svg && svg.style.display !== 'none')
      svg.style.display = 'none';
    return;
  }
  if (!svg) {
    svg = this._layerOverlay = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('id', 'layerOverlay');
    svg.style.position = 'absolute';
    svg.style.pointerEvents = 'none';
    // always under the hint highlights
    this._canvas.parentNode.insertBefore(svg, this._hintOverlay || this._canvas.nextSibling);
  }
  var tw = this._tileSet.tileWidth;
  var key = [this._originX, this._originY, tw, this.canvasWidth, this.canvasHeight, this._layerVersion].join(',');
  if (key === this._lastLayerKey)
    return;
  this._lastLayerKey = key;

  svg.style.display = '';
  svg.style.left = this._canvas.offsetLeft + 'px';
  svg.style.top = this._canvas.offsetTop + 'px';
  svg.setAttribute('width', this.canvasWidth / this._dpr);
  svg.setAttribute('height', this.canvasHeight / this._dpr);
  svg.setAttribute('viewBox', '0 0 ' + this.canvasWidth + ' ' + this.canvasHeight);

  var ox = this._originX, oy = this._originY;
  var viewW = this._totalTilesInViewX + 2, viewH = this._totalTilesInViewY + 2;
  var visible = function(x, y, size) {
    return x + size >= ox && y + size >= oy && x <= ox + viewW && y <= oy + viewH;
  };
  var line = Math.max(2, Math.round(tw / 7));
  var parts = [];
  allShapes.forEach(function(s) {
    if (s.kind === 'stuck') {
      if (visible(s.x - 1, s.y - 1, 3))
        parts.push('<rect x="' + ((s.x - 1 - ox) * tw + line / 2) + '" y="' + ((s.y - 1 - oy) * tw + line / 2) + '" width="' +
                   (3 * tw - line) + '" height="' + (3 * tw - line) + '" rx="' + Math.round(tw / 5) + '" stroke-width="' +
                   Math.round(line * 1.3) + '" class="lyStuck"/>');
    } else if (s.kind === 'channel') {
      if (visible(s.x, s.y, 1))
        parts.push('<rect x="' + ((s.x - ox) * tw + line / 2) + '" y="' + ((s.y - oy) * tw + line / 2) + '" width="' + (tw - line) +
                   '" height="' + (tw - line) + '" stroke-width="' + Math.max(1.5, line / 1.5) + '" stroke-dasharray="' +
                   Math.round(tw / 4) + ' ' + Math.round(tw / 6) + '" class="lyChannel"/>');
    } else if (s.kind === 'blocks') {
      s.cells.forEach(function(c) {
        if (visible(c[0], c[1], s.size))
          parts.push('<rect x="' + (c[0] - ox) * tw + '" y="' + (c[1] - oy) * tw + '" width="' + s.size * tw + '" height="' +
                     s.size * tw + '" class="' + (s.cls || 'pol') + c[2] + '"/>');
      });
    } else if (s.kind === 'dead' || s.kind === 'bridge') {
      if (visible(s.x, s.y, 1))
        parts.push('<rect x="' + ((s.x - ox) * tw + line / 2) + '" y="' + ((s.y - oy) * tw + line / 2) + '" width="' + (tw - line) +
                   '" height="' + (tw - line) + '" stroke-width="' + line + '" class="' +
                   (s.kind === 'dead' ? 'lyDead' : s.open ? 'lyBridgeOpen' : 'lyBridge') + '"/>');
    } else if (s.kind === 'zone') {
      if (visible(s.x - 1, s.y - 1, 3))
        parts.push('<rect x="' + ((s.x - 1 - ox) * tw + line / 2) + '" y="' + ((s.y - 1 - oy) * tw + line / 2) + '" width="' +
                   (3 * tw - line) + '" height="' + (3 * tw - line) + '" rx="' + Math.round(tw / 5) + '" stroke-width="' + line +
                   '" class="ly-' + s.tone + '"/>');
    }
  });
  svg.innerHTML = parts.join('');
};


// POLICY LAB: zoom and sharper graphics ---------------------------------------------------------------------------

// The original 16-pixel graphics, from which the right enlarged set is chosen
GameCanvas.prototype.setBaseGraphics = function(normalTiles, snowTiles, sprites) {
  this._baseGraphics = {normal: normalTiles, snow: snowTiles, sprites: sprites};
  this._requestScale();
};

// How many device pixels one original pixel takes up right now
GameCanvas.prototype.getScale = function() {
  return this._tileSet.tileWidth / 16;
};

GameCanvas.prototype.getZoom = function() {
  return this._zoom;
};

GameCanvas.prototype.setZoom = function(zoom) {
  zoom = Math.max(1, Math.min(3, zoom));
  if (zoom === this._zoom)
    return;
  this._zoom = zoom;
  this._requestScale();
};

GameCanvas.prototype.setSeason = function(season) {
  this._season = season;
  this._requestScale();
};

GameCanvas.prototype._requestScale = function() {
  if (!this._baseGraphics)
    return;
  var want = this._zoom * this._dpr;
  var self = this;
  HDTiles.get(this._baseGraphics, this._season, want, function(tiles, sprites, got) {
    // Keep the same spot in the middle of the screen
    if (self.ready && self._tileSet)
      self._pendingCentre = {x: self._originX + Math.floor(self._wholeTilesInViewX / 2),
                             y: self._originY + Math.floor(self._wholeTilesInViewY / 2)};
    self._pendingTileSet = tiles;
    self._pendingSpriteSheet = sprites;
    self._pendingSpriteScale = got;
  });
};


GameCanvas.DEFAULT_ID = 'MicropolisCanvas';


export { GameCanvas };

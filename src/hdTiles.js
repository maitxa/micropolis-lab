/* Policy Lab additions to micropolisJS (2026).
 *
 * This code is released under the GNU GPL v3, with some additional terms, like the rest of micropolisJS.
 * Modified version: NOT the original micropolisJS / Micropolis.
 *
 * Sharper graphics. The original tiles are 16x16 pixels. For zooming in, and for high-resolution ("Retina") screens,
 * we use copies of the tile and sprite sheets that were enlarged once, ahead of time, with the xBRZ pixel-art scaler
 * (images/hd/tiles-Nx.png etc.). They are only downloaded when first needed.
 */

import { TileSet } from './tileSet.js';
import { TILE_COUNT } from './tileValues.ts';

// Scales for which enlarged sheets exist
var SCALES = [2, 3, 4, 6];

var cache = {};

var loadImage = function(src, onLoad, onError) {
  var img = new Image();
  img.onload = function() { onLoad(img); };
  img.onerror = onError;
  img.src = src;
};

// Get the tile set (and matching sprite sheet) for a season ('normal' or 'snow') at a given scale.
// base = {normal: TileSet, snow: TileSet, sprites: Image} holds the original 16-pixel versions (scale 1).
// callback(tileSet, spriteSheet) is called when ready; if anything fails, the original 16-pixel graphics are used.
// A smaller copy of a 16-pixel tile set (for zooming out): each tile is redrawn at 16 x scale pixels, smoothed so
// that small details average out instead of flickering
var shrink = function(tileSet, scale) {
  var w = Math.round(16 * scale);
  var out = Object.create(TileSet.prototype);
  out.tileWidth = w;
  for (var t = 0; t < TILE_COUNT; t++) {
    var c = document.createElement('canvas');
    c.width = c.height = w;
    var cx = c.getContext('2d');
    cx.imageSmoothingEnabled = true;
    cx.imageSmoothingQuality = 'high';
    if (tileSet[t])
      cx.drawImage(tileSet[t], 0, 0, 16, 16, 0, 0, w, w);
    out[t] = c;
  }
  out.isValid = true;
  return out;
};

var get = function(base, season, scale, callback) {
  // POLICY LAB: zooming out (scale below 1): shrink the original tiles once and keep them
  if (scale < 1) {
    var small = 'small:' + season + '@' + scale;
    if (!cache[small])
      cache[small] = shrink(base[season] || base.normal, scale);
    callback(cache[small], base.sprites, 1);
    return;
  }
  if (scale === 1 || SCALES.indexOf(scale) === -1) {
    callback(base[season] || base.normal, base.sprites, 1);
    return;
  }

  var key = season + '@' + scale;
  if (cache[key]) {
    callback(cache[key].tiles, cache[key].sprites, scale);
    return;
  }

  var fallback = function() {
    callback(base[season] || base.normal, base.sprites, 1);
  };

  var tileFile = 'images/hd/' + (season === 'snow' ? 'tilessnow' : 'tiles') + '-' + scale + 'x.png';
  var spriteFile = 'images/hd/sprites-' + scale + 'x.png';

  loadImage(tileFile, function(tileImage) {
    loadImage(spriteFile, function(spriteImage) {
      var tiles = new TileSet(tileImage, function() {
        cache[key] = {tiles: tiles, sprites: spriteImage};
        callback(tiles, spriteImage, scale);
      }, fallback);
    }, fallback);
  }, fallback);
};


var HDTiles = {
  SCALES: SCALES,
  get: get
};


export { HDTiles };

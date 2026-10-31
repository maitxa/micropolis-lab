/* Policy Lab additions to micropolisJS (2026).
 *
 * This code is released under the GNU GPL v3, with some additional terms, like the rest of micropolisJS.
 * Modified version: NOT the original micropolisJS / Micropolis.
 *
 * v30: PLACEMENT PREVIEW. While a service building is being placed, the map shows what it would do from the spot under
 * the mouse:
 *  - police and fire stations: the 8x8-tile squares their effect reaches, shaded by strength. The game marks the
 *    station's square and spreads it three times to the neighbours (blockMapUtils.js), so the strength here is that
 *    same spread: full in the station's square, about half next to it, a fifth one square further on the diagonal,
 *    a tenth two squares away in a straight line.
 *  - hospital, water treatment plant, train depot, school, college and big park: a circle with the radius the game uses.
 *
 * Only READS the map.
 */

import { Amenities } from './amenities.js';
import { Education } from './education.js';
import { I18n } from './i18n.js';
import { Utilities } from './utilities.js';

var P = I18n.p;

// The spread of one station after the game's three smoothing passes (station square = 218), in 8x8 squares
var KERNEL = (function() {
  var N = 9, c = 4, g = [], i, x, y;
  for (x = 0; x < N; x++) { g.push([]); for (y = 0; y < N; y++) g[x].push(x === c && y === c ? 1000 : 0); }
  for (i = 0; i < 3; i++) {
    var d = [];
    for (x = 0; x < N; x++) {
      d.push([]);
      for (y = 0; y < N; y++) {
        var e = (x > 0 ? g[x - 1][y] : 0) + (x < N - 1 ? g[x + 1][y] : 0) + (y > 0 ? g[x][y - 1] : 0) + (y < N - 1 ? g[x][y + 1] : 0);
        d[x].push(Math.floor((g[x][y] + Math.floor(e / 4)) / 2));
      }
    }
    g = d;
  }
  var out = [];
  for (x = 0; x < N; x++)
    for (y = 0; y < N; y++)
      if (g[x][y] >= 20)
        out.push([x - c, y - c, g[x][y] >= 150 ? 3 : g[x][y] >= 40 ? 2 : 1]);
  return out;
})();

var stationShapes = function(map, x, y, label) {
  var bx = Math.floor(x / 8), by = Math.floor(y / 8), cells = [];
  KERNEL.forEach(function(k) {
    var cx = (bx + k[0]) * 8, cy = (by + k[1]) * 8;
    if (cx >= 0 && cy >= 0 && cx < map.width && cy < map.height)
      cells.push([cx, cy, k[2]]);
  });
  return [{kind: 'pdelta', size: 8, cells: cells}, {kind: 'ptext', x: x, y: y - 2, label: label}];
};

var circle = function(x, y, r, label, cls) {
  return [{kind: 'pcircle', x: x, y: y, r: r, cls: cls || '', label: label}];
};

var TOOLS = {
  police: function(map, x, y) {
    return stationShapes(map, x, y, P('Police: less crime in the green squares (most in the darkest)',
                                      'Policía: menos delincuencia en los cuadros verdes (más en los oscuros)'));
  },
  fire: function(map, x, y) {
    return stationShapes(map, x, y, P('Fire station: fires put out faster in the green squares',
                                      'Bomberos: los incendios se apagan antes en los cuadros verdes'));
  },
  hospital: function(map, x, y) {
    return circle(x, y, Utilities.HEALTH_RADIUS, P('Hospital: homes within {0} tiles', 'Hospital: viviendas a menos de {0} casillas', Utilities.HEALTH_RADIUS));
  },
  water: function(map, x, y) {
    return circle(x, y, Utilities.WATER_RADIUS, P('Water treatment: zones within {0} tiles', 'Tratamiento de agua: zonas a menos de {0} casillas', Utilities.WATER_RADIUS));
  },
  depot: function(map, x, y) {
    return circle(x, y, Utilities.DEPOT_RADIUS, P('Train depot: zones within {0} tiles travel twice as far', 'Estación: las zonas a menos de {0} casillas viajan el doble', Utilities.DEPOT_RADIUS));
  },
  school: function(map, x, y) {
    return circle(x, y, Education.SCHOOL_RADIUS, P('School: homes within {0} tiles', 'Escuela: viviendas a menos de {0} casillas', Education.SCHOOL_RADIUS), 'pcSchool');
  },
  college: function(map, x, y) {
    return circle(x, y, Education.COLLEGE_RADIUS, P('College: homes within {0} tiles', 'Universidad: viviendas a menos de {0} casillas', Education.COLLEGE_RADIUS), 'pcCollege');
  },
  bigpark: function(map, x, y) {
    return circle(x, y, Amenities.BIG_PARK_RADIUS, P('Big park: cleaner air and less crime within {0} tiles', 'Parque grande: aire más limpio y menos delincuencia a menos de {0} casillas', Amenities.BIG_PARK_RADIUS), 'strong');
  }
};

// Shapes for the tool `name` placed with its centre at (x, y) on the map, or null if the tool has no preview
var shapesFor = function(name, map, x, y) {
  var f = TOOLS[name];
  if (!f || !map.testBounds(x, y))
    return null;
  return f(map, x, y);
};

var Preview = {shapesFor: shapesFor, has: function(name) { return !!TOOLS[name]; }};

export { Preview };

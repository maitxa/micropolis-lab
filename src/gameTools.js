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

import { ANIMBIT, BULLBIT, BURNBIT } from './tileFlags.ts';
import { BuildingTool } from './buildingTool.js';
import { BulldozerTool } from './bulldozerTool.js';
import { EventEmitter } from './eventEmitter.js';
import { QUERY_WINDOW_NEEDED } from './messages.ts';
import { MiscUtils } from './miscUtils.js';
import { ParkTool } from './parkTool.js';
import { RailTool } from './railTool.js';
import { RoadTool } from './roadTool.js';
import { QueryTool } from './queryTool.js';
import * as TileValues from "./tileValues.ts";
import { WireTool } from './wireTool.js';
import { Policy } from './policy.js';

function GameTools(map) {
  var tools = EventEmitter({
    airport: new BuildingTool(10000, TileValues.AIRPORT, map, 6, false),
    bulldozer: new BulldozerTool(map),
    coal: new BuildingTool(3000, TileValues.POWERPLANT, map, 4, false),
    commercial: new BuildingTool(100, TileValues.COMCLR, map, 3, false),
    fire: new BuildingTool(500, TileValues.FIRESTATION, map, 3, false),
    industrial: new BuildingTool(100, TileValues.INDCLR, map, 3, false),
    nuclear: new BuildingTool(5000, TileValues.NUCLEAR, map, 4, true),
    park: new ParkTool(map),
    police: new BuildingTool(500, TileValues.POLICESTATION, map, 3, false),
    port: new BuildingTool(3000, TileValues.PORT, map, 4, false),
    rail: new RailTool(map),
    residential: new BuildingTool(100, TileValues.FREEZ, map, 3, false),
    road: new RoadTool(map),
    query: new QueryTool(map),
    stadium: new BuildingTool(5000, TileValues.STADIUM, map, 4, false),
    wire: new WireTool(map),
    // POLICY LAB
    depot: new BuildingTool(1000, TileValues.DEPOT, map, 3, false),
    water: new BuildingTool(2000, TileValues.WATERPLANT, map, 3, false),
    hospital: new BuildingTool(3000, TileValues.HOSPITAL, map, 3, false),
    // POLICY LAB v25: a big park (3x3 trees and lawns with a fountain in the middle)
    bigpark: new BuildingTool(150, TileValues.FOUNTAIN, map, 3, false),
  });

  // POLICY LAB v25: the big park is built from the ordinary park tiles, not from a building's tile set
  tools.bigpark.getCost = Policy.bigParkCost;
  tools.bigpark.checkBorder = function() {};
  tools.bigpark.putBuilding = function(leftX, topY) {
    var lawns = [TileValues.WOODS2, TileValues.WOODS3, TileValues.WOODS4, TileValues.WOODS5];
    for (var dy = 0; dy < 3; dy++) {
      for (var dx = 0; dx < 3; dx++) {
        if (dx === 1 && dy === 1)
          this._worldEffects.setTile(leftX + 1, topY + 1, TileValues.FOUNTAIN, ANIMBIT | BURNBIT | BULLBIT);
        else
          this._worldEffects.setTile(leftX + dx, topY + dy, lawns[(dx + 2 * dy) % 4], BURNBIT | BULLBIT);
      }
    }
  };

  // POLICY LAB: business incentives change the price of commercial and industrial zones
  tools.commercial.getCost = Policy.businessZoneCost;
  tools.industrial.getCost = Policy.businessZoneCost;

  tools.query.addEventListener(QUERY_WINDOW_NEEDED, MiscUtils.reflectEvent.bind(tools, QUERY_WINDOW_NEEDED));

  return tools;
}


export { GameTools };

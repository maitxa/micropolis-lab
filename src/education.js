/* Policy Lab additions to micropolisJS (2026).
 *
 * This code is released under the GNU GPL v3, with some additional terms, like the rest of micropolisJS.
 * Modified version: NOT the original micropolisJS / Micropolis.
 *
 * v30: SCHOOLS AND COLLEGES (3x3 buildings, both need power).
 *
 *  A school serves the homes within 16 tiles, a college the homes within 32 tiles. Each year, the city's "schooling" and
 *  "college education" (0-100%) move part of the way towards the share of lived-in home zones that are served: a
 *  quarter of the way for schools, less for colleges, so the effects build up over a few years and fade slowly if the
 *  schools close.
 *
 *  Effects (a game simplification, not an estimate from research):
 *   - crime: up to 20 points less in every neighbourhood (schooling counts 70%, college 30%);
 *   - jobs: shops and factories plan for up to 13% more business (college 10%, schooling 3%).
 *  Running costs: $120 a year for a school, $360 for a college.
 *
 * Idea and first version: the side version of the Policy Lab (October 2026), rebuilt here as map buildings.
 */

import { Advisor } from './advisor.js';
import { Policy } from './policy.js';
import { TileUtils } from './tileUtils.js';
import * as TileValues from './tileValues.ts';

var SCHOOL_RADIUS = 16;
var COLLEGE_RADIUS = 32;
var SCHOOL_MAINTENANCE = 120;
var COLLEGE_MAINTENANCE = 360;
var SCHOOL_RATE = 0.25;
var COLLEGE_RATE = 0.15;
var CRIME_MAX = 20;
var SCHOOL_DEMAND = 0.03;
var COLLEGE_DEMAND = 0.10;

var schoolFound = function(map, x, y, simData) {
  var c = simData.census;
  c.schoolPop += 1;
  if (map.getTile(x, y).isPowered())
    c.schoolList.push({x: x, y: y});
  else
    c.educationUnpoweredList.push({x: x, y: y, kind: 'school'});
};

var collegeFound = function(map, x, y, simData) {
  var c = simData.census;
  c.collegePop += 1;
  if (map.getTile(x, y).isPowered())
    c.collegeList.push({x: x, y: y});
  else
    c.educationUnpoweredList.push({x: x, y: y, kind: 'college'});
};

var near = function(list, x, y, r) {
  for (var i = 0; i < list.length; i++) {
    var dx = list[i].x - x, dy = list[i].y - y;
    if (dx * dx + dy * dy <= r * r)
      return true;
  }
  return false;
};

// Lived-in home zones, and how many of them a powered school / college serves. `census` is a snapshot with schoolList and
// collegeList (the last complete map scan).
var coverage = function(map, census) {
  var schools = (census && census.schoolList) || [], colleges = (census && census.collegeList) || [];
  var out = {homes: 0, school: 0, college: 0, unserved: []};
  for (var x = 0; x < map.width; x++) {
    for (var y = 0; y < map.height; y++) {
      var tile = map.getTile(x, y);
      if (!TileUtils.isResidentialZone(tile))
        continue;
      var v = tile.getValue();
      if (v === TileValues.HOSPITAL || Advisor.isEmptyZone(map, x, y, v, 'res'))
        continue;
      out.homes++;
      var s = near(schools, x, y, SCHOOL_RADIUS), c = near(colleges, x, y, COLLEGE_RADIUS);
      if (s) out.school++;
      if (c) out.college++;
      if (!s && out.unserved.length < 60)
        out.unserved.push({x: x, y: y});
    }
  }
  return out;
};

var state = function() {
  if (!Policy.education)
    Policy.education = {school: 0, college: 0};
  return Policy.education;
};

// Once a year
var yearlyUpdate = function(map, census) {
  var e = state();
  var cov = coverage(map, census);
  if (cov.homes > 0) {
    e.school += (cov.school / cov.homes - e.school) * SCHOOL_RATE;
    e.college += (cov.college / cov.homes - e.college) * COLLEGE_RATE;
  }
  e.lastCoverage = {homes: cov.homes, school: cov.school, college: cov.college};
  return cov;
};

var crimeReduction = function() {
  var e = state();
  return CRIME_MAX * (0.7 * e.school + 0.3 * e.college);
};

var demandFactor = function() {
  var e = state();
  return 1 + SCHOOL_DEMAND * e.school + COLLEGE_DEMAND * e.college;
};

var maintenance = function(census) {
  return (census.schoolPop || 0) * SCHOOL_MAINTENANCE + (census.collegePop || 0) * COLLEGE_MAINTENANCE;
};

var Education = {
  SCHOOL_RADIUS: SCHOOL_RADIUS,
  COLLEGE_RADIUS: COLLEGE_RADIUS,
  SCHOOL_MAINTENANCE: SCHOOL_MAINTENANCE,
  COLLEGE_MAINTENANCE: COLLEGE_MAINTENANCE,
  CRIME_MAX: CRIME_MAX,
  coverage: coverage,
  yearlyUpdate: yearlyUpdate,
  crimeReduction: crimeReduction,
  demandFactor: demandFactor,
  maintenance: maintenance,
  state: state,
  registerHandlers: function(mapScanner, repairManager) {
    mapScanner.addAction(TileValues.SCHOOL, schoolFound);
    mapScanner.addAction(TileValues.COLLEGE, collegeFound);
    repairManager.addAction(TileValues.SCHOOL, 15, 3);
    repairManager.addAction(TileValues.COLLEGE, 15, 3);
  }
};

export { Education };

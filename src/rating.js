/* Policy Lab additions to micropolisJS (2026).
 *
 * This code is released under the GNU GPL v3, with some additional terms, like the rest of micropolisJS.
 * Modified version: NOT the original micropolisJS / Micropolis.
 *
 * v31: CITY RATING AND GRADUATION.
 *
 * The rating (0-100 points, shown as a letter grade A-F) adds up four parts, all from figures the game already shows:
 *   - approval in the yearly poll: up to 30 points (70% approval = 21);
 *   - the status bubbles: up to 40 points (each green bubble counts fully, an orange one half, a red one nothing);
 *   - money: up to 15 points (a surplus last year: 15; a small deficit, under $500: 8; a bigger one or debt: 0);
 *   - the game's own city score (0-1000): up to 15 points.
 * Grades: A from 85, B from 70, C from 55, D from 40, F below. A grade is recorded every January, and the
 * 10-year average is the average of the last ten.
 *
 * Graduation: the city graduates when it has met all four conditions in five Januaries in a row: approval 70% or more,
 * every bubble green, no deficit last year, and at least the population target. The target depends on the preset
 * (harder presets get a lower one, in proportion to how big the test cities grew under each preset) and on the
 * difficulty (medium 80%, hard 60%).
 *
 * Only READS the simulation; the yearly records live in Policy.history (saved with the city).
 */

import { I18n } from './i18n.js';
import { MiscUtils } from './miscUtils.js';
import { Policy } from './policy.js';

var P = I18n.p;
var fmt = MiscUtils.formatNumber;

var GRADES = [[85, 'A'], [70, 'B'], [55, 'C'], [40, 'D'], [0, 'F']];
var gradeOf = function(points) {
  for (var i = 0; i < GRADES.length; i++)
    if (points >= GRADES[i][0])
      return GRADES[i][1];
  return 'F';
};

var YEARS_NEEDED = 5;
var APPROVAL_NEEDED = 70;
// Population targets. 1989 baseline: 50,000 (the size at which the 1989 game calls a city a capital). The others in
// proportion to the test cities after 20 years (v30 tests: baseline 21,100, conservative-populist 19,600, libertarian
// 24,700, progressive 10,900), never above the baseline, rounded to 5,000.
var TARGETS = {
  '1989 baseline': 50000,
  'Conservative-populist (MAGA-style)': 45000,
  'Libertarian': 50000,
  'Progressive (Sanders-style)': 25000
};
var LEVEL_FACTOR = [1, 0.8, 0.6];   // easy, medium, hard

var populationTarget = function(sim) {
  var name = Policy.presetName || '1989 baseline';
  var base = TARGETS[name];
  if (base === undefined) {
    // "Custom (starting from X)"
    var m = /starting from (.*)\)$/.exec(name);
    base = (m && TARGETS[m[1]]) || TARGETS['1989 baseline'];
  }
  var level = sim && sim._gameLevel ? sim._gameLevel : 0;
  return Math.round(base * (LEVEL_FACTOR[level] || 1) / 1000) * 1000;
};

var lastYear = function(history) {
  var ys = (history && history.years) || [];
  return ys.length ? ys[ys.length - 1] : null;
};

// The rating now. statusList: the bubbles (Status.compute(...).list)
var compute = function(sim, statusList, history) {
  var c = sim.lastCensus || sim._census;
  if (!c || !(c.resPop > 0))
    return null;
  var parts = [];
  var yes = sim.evaluation.cityYes || 0;
  parts.push({id: 'approval', name: P('Approval', 'Aprobación'), max: 30, points: 30 * Math.max(0, Math.min(100, yes)) / 100,
              text: P('{0}% in the last poll', '{0}% en la última encuesta', yes)});
  var list = statusList || [];
  var val = {good: 1, watch: 0.5, urgent: 0};
  var share = list.length ? list.reduce(function(a, s) { return a + (val[s.level] || 0); }, 0) / list.length : 1;
  var notGood = list.filter(function(s) { return s.level !== 'good'; }).map(function(s) { return s.name; });
  parts.push({id: 'bubbles', name: P('City services', 'Servicios de la ciudad'), max: 40, points: 40 * share,
              text: notGood.length ? P('Not green: {0}', 'No están en verde: {0}', notGood.join(', '))
                                   : P('All bubbles green', 'Todas las burbujas en verde')});
  var ly = lastYear(history), funds = sim.budget.totalFunds;
  var money = funds < 0 ? 0 : !ly || ly.v >= 0 ? 15 : ly.v > -500 ? 8 : 0;
  parts.push({id: 'money', name: P('Money', 'Dinero'), max: 15, points: money,
              text: !ly ? P('No full year yet', 'Todavía no hay un año completo')
                        : ly.v >= 0 ? P('Surplus last year: {0}', 'Superávit el año pasado: {0}', MiscUtils.formatMoney(ly.v))
                                    : P('Deficit last year: {0}', 'Déficit el año pasado: {0}', MiscUtils.formatMoney(-ly.v))});
  var score = sim.evaluation.cityScore || 0;
  parts.push({id: 'score', name: P('City score', 'Puntuación'), max: 15, points: 15 * Math.max(0, Math.min(1000, score)) / 1000,
              text: P('{0} of 1,000', '{0} de 1,000', fmt(score))});
  var total = parts.reduce(function(a, p) { return a + p.points; }, 0);
  var weakest = parts.slice().sort(function(a, b) { return (a.points / a.max) - (b.points / b.max); })[0];
  return {points: Math.round(total), grade: gradeOf(total), parts: parts, weakest: weakest};
};

// The 10-year average of the grades recorded each January
var average = function(history) {
  var ys = ((history && history.years) || []).filter(function(y) { return typeof y.rating === 'number'; }).slice(-10);
  if (!ys.length)
    return null;
  var avg = ys.reduce(function(a, y) { return a + y.rating; }, 0) / ys.length;
  return {points: Math.round(avg), grade: gradeOf(avg), years: ys.length};
};

// The graduation conditions now: [{id, ok, text}]
var conditions = function(sim, statusList, history) {
  var target = populationTarget(sim);
  var pop = sim.evaluation.cityPop || 0, yes = sim.evaluation.cityYes || 0;
  var list = statusList || [];
  var notGood = list.filter(function(s) { return s.level !== 'good'; }).length;
  var ly = lastYear(history);
  return [
    {id: 'approval', ok: yes >= APPROVAL_NEEDED, text: P('Approval {0}% or more (now {1}%)', 'Aprobación del {0}% o más (ahora {1}%)', APPROVAL_NEEDED, yes)},
    {id: 'bubbles', ok: list.length > 0 && notGood === 0, text: notGood ? P('Every bubble green ({0} not green)', 'Todas las burbujas en verde ({0} no lo están)', notGood)
                                                                          : P('Every bubble green', 'Todas las burbujas en verde')},
    {id: 'money', ok: !!ly && ly.v >= 0 && sim.budget.totalFunds >= 0, text: P('No deficit last year', 'Sin déficit el año pasado')},
    {id: 'pop', ok: pop >= target, text: P('At least {0} people (now {1})', 'Al menos {0} habitantes (ahora {1})', fmt(target), fmt(pop))}
  ];
};

// Called every January, after the year's record was added to history.years: stores the rating and moves the
// graduation count on. Returns true the first time the city graduates.
var yearly = function(sim, statusList, history) {
  var ly = lastYear(history);
  if (!ly || ly.rated)
    return false;
  ly.rated = true;
  var r = compute(sim, statusList, history);
  if (r)
    ly.rating = r.points;
  var met = conditions(sim, statusList, history).every(function(k) { return k.ok; });
  history.gradStreak = met ? (history.gradStreak || 0) + 1 : 0;
  if (history.gradStreak >= YEARS_NEEDED && !history.graduated) {
    history.graduated = ly.y + 1;
    return true;
  }
  return false;
};

var Rating = {
  compute: compute,
  average: average,
  conditions: conditions,
  yearly: yearly,
  gradeOf: gradeOf,
  populationTarget: populationTarget,
  YEARS_NEEDED: YEARS_NEEDED
};

export { Rating };

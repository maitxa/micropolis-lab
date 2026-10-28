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

import { ModalWindow } from './modalWindow.js';
import { EVAL_WINDOW_CLOSED } from './messages.ts';
import { Text } from './text.js';
import { MiscUtils } from './miscUtils.js';
import { I18n } from './i18n.js';

var EvaluationWindow = ModalWindow(function() {
  $(evaluationFormID).on('submit', submit.bind(this));
});


var evaluationFormID = '#evalButtons';
var evaluationOKID = '#evalOK';


EvaluationWindow.prototype.close = function() {
  this._emitEvent(EVAL_WINDOW_CLOSED);
  this._toggleDisplay();
};


var submit = function(e) {
  e.preventDefault();
  this.close();
};


EvaluationWindow.prototype._populateWindow = function(evaluation) {
  $('#evalYes').text(evaluation.cityYes);
  $('#evalNo').text(100 - evaluation.cityYes);
  for (var i = 0; i < 4; i++) {
    var problemNo = evaluation.getProblemNumber(i);
    if (problemNo !== null) {
      var text = Text.L('problems')[problemNo];
      $('#evalProb' + (i + 1)).text(text);
      $('#evalProb' + (i + 1)).show();
    } else {
      $('#evalProb' + (i + 1)).hide();
    }
  }

  $('#evalPopulation').text(MiscUtils.formatNumber(evaluation.cityPop));
  $('#evalMigration').text(MiscUtils.formatNumber(evaluation.cityPopDelta));
  $('#evalValue').text(MiscUtils.formatMoney(evaluation.cityAssessedValue));
  $('#evalLevel').text(Text.L('gameLevel')[evaluation.gameLevel]);
  $('#evalClass').text(Text.cityClass[evaluation.cityClass]);
  $('#evalScore').text(evaluation.cityScore);
  $('#evalScoreDelta').text(evaluation.cityScoreDelta);
  // POLICY LAB v25
  $('#scoreHowContent').html(scoreHow(evaluation));
};


// POLICY LAB v25: how the score was worked out this year (see Evaluation.getScore)
var esc = function(s) {
  return String(s).replace(/[&<>"]/g, function(c) { return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]; });
};
var STEP_TEXT = {
  capRes: ['Residents want a stadium (growth capped): -15%', 'Los residentes quieren un estadio (crecimiento limitado): -15%'],
  capCom: ['Commerce wants an airport (growth capped): -15%', 'El comercio quiere un aeropuerto (crecimiento limitado): -15%'],
  capInd: ['Industry wants a seaport (growth capped): -15%', 'La industria quiere un puerto (crecimiento limitado): -15%'],
  roads: ['Roads underfunded', 'Calles con pocos fondos'],
  police: ['Police underfunded (up to -10%)', 'Policía con pocos fondos (hasta -10%)'],
  fire: ['Fire stations underfunded (up to -10%)', 'Bomberos con pocos fondos (hasta -10%)'],
  collapseRes: ['Far too many homes for the demand: -15%', 'Demasiadas viviendas para la demanda: -15%'],
  collapseCom: ['Far too many shops for the demand: -15%', 'Demasiadas tiendas para la demanda: -15%'],
  collapseInd: ['Far too much industry for the demand: -15%', 'Demasiada industria para la demanda: -15%'],
  growth: ['Population grew {0}% this year (bonus)', 'La población creció un {0}% este año (bonificación)'],
  shrink: ['Population shrank (penalty)', 'La población disminuyó (penalización)'],
  fires: ['Fires burning', 'Incendios activos'],
  tax: ['Tax rate ({0}%)', 'Tasa de impuestos ({0}%)'],
  unpowered: ['{0} zones without power', '{0} zonas sin electricidad'],
  limits: ['Kept between 0 and 1,000', 'Limitada entre 0 y 1,000']
};

var scoreHow = function(evaluation) {
  var b = evaluation.scoreBreakdown;
  var P = I18n.p, fmt = MiscUtils.formatNumber;
  var intro = '<p class="scoreIntro">' + esc(P('The score (0 to 1,000) is roughly the share of voters who approve of you: 500 means half, 700 or more is good, 800 or more is excellent. It is worked out once a year:',
                                               'La puntuación (de 0 a 1,000) es más o menos la proporción de votantes que te aprueban: 500 es la mitad, 700 o más es buena, 800 o más es excelente. Se calcula una vez al año:')) + '</p>';
  if (!b)
    return intro + '<p>' + esc(P('The breakdown appears after the next yearly evaluation.', 'El desglose aparece después de la próxima evaluación anual.')) + '</p>';
  var names = Text.L('problems');
  var probs = b.problems.map(function(v, i) { return {name: names[i], v: v}; })
                .filter(function(p) { return p.v > 0; })
                .sort(function(a, c) { return c.v - a.v; });
  var rows = [];
  var row = function(label, change, cls) {
    rows.push('<tr class="' + (cls || '') + '"><td>' + esc(label) + '</td><td class="num">' +
              (change === null ? '' : esc((change > 0 ? '+' : change < 0 ? '−' : '') + fmt(Math.abs(change)))) + '</td></tr>');
  };
  row(P('Start: 1,000 minus the residents\' problems', 'Inicio: 1,000 menos los problemas de los residentes') +
      (probs.length ? ' (' + probs.map(function(p) { return p.name.toLowerCase() + ' ' + p.v; }).join(', ') + ')' : ''), null, 'sh');
  row(P('= starting score', '= puntuación inicial'), b.base, 'base');
  b.steps.forEach(function(st) {
    var t = STEP_TEXT[st.key];
    if (t)
      row(P(t[0], t[1], st.info), st.change);
  });
  rows.push('<tr class="sum"><td>' + esc(P('This year\'s figure', 'Cifra de este año')) + '</td><td class="num">' + fmt(b.thisYear) + '</td></tr>');
  rows.push('<tr class="sum"><td>' + esc(P('Averaged with last year\'s score ({0}) = your score', 'Promediada con la puntuación del año pasado ({0}) = tu puntuación', fmt(b.lastYear))) +
            '</td><td class="num"><b>' + fmt(b.final) + '</b></td></tr>');
  var note = '<p class="scoreNote">' + esc(P('Each problem is scored 0 to 255 (housing costs rise with land value, so a pricier city complains more). Because each year is averaged with the last, the score moves gradually; a year of fast growth lifts it, and shrinking pulls it down.',
                                            'Cada problema se puntúa de 0 a 255 (el costo de la vivienda sube con el valor del suelo, así que una ciudad más cara se queja más). Como cada año se promedia con el anterior, la puntuación cambia poco a poco; un año de crecimiento rápido la sube, y perder población la baja.')) + '</p>';
  return intro + '<table class="scoreTable">' + rows.join('') + '</table>' + note;
};


EvaluationWindow.prototype.open = function(evaluation, simulation) {
  this._evaluation = evaluation;
  this._simulation = simulation;
  this._populateWindow(evaluation);
  this._toggleDisplay();
};


// POLICY LAB: redraw the open window (after a language change)
EvaluationWindow.prototype.refresh = function() {
  if (!this._evaluation)
    return;
  this._populateWindow(this._evaluation);
};


export { EvaluationWindow };

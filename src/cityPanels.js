/* Policy Lab additions to micropolisJS (2026).
 *
 * This code is released under the GNU GPL v3, with some additional terms, like the rest of micropolisJS.
 * Modified version: NOT the original micropolisJS / Micropolis.
 *
 * Windows for saved cities (start screen), the scoreboard and rewind (v25). The data lives in cityStore.js.
 */

import $ from "jquery";

import { CityStore } from './cityStore.js';
import { I18n } from './i18n.js';
import { MiscUtils } from './miscUtils.js';
import { Mistakes } from './mistakes.js';
import { Policy } from './policy.js';
import { Rating } from './rating.js';
import { Report } from './report.js';
import { Text } from './text.js';

var P = I18n.p;
var fmt = MiscUtils.formatNumber;

var esc = function(s) {
  return String(s === undefined || s === null ? '' : s).replace(/[&<>"]/g, function(c) {
    return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c];
  });
};

var when = function(t) {
  if (!t)
    return '';
  var d = new Date(t);
  return d.toLocaleDateString(I18n.lang() === 'es' ? 'es-US' : 'en-US', {month: 'short', day: 'numeric'}) + ' ' +
         d.toLocaleTimeString(I18n.lang() === 'es' ? 'es-US' : 'en-US', {hour: 'numeric', minute: '2-digit'});
};

// A simple window over everything. Returns {body, close}.
var overlay = function(title, onClose) {
  $('#plOverlay').remove();
  var wrap = $('<div id="plOverlay" role="dialog" aria-modal="true"></div>');
  var box = $('<div class="plPanel"></div>');
  var head = $('<div class="plPanelHead"></div>');
  head.append($('<h2></h2>').text(title));
  var x = $('<button type="button" class="plPanelClose"></button>').text(P('Close', 'Cerrar'));
  head.append(x);
  var body = $('<div class="plPanelBody"></div>');
  box.append(head, body);
  wrap.append(box);
  $('body').append(wrap);
  var close = function() {
    wrap.remove();
    $(document).off('keydown.plOverlay');
    if (onClose)
      onClose();
  };
  x.on('click', function(e) { e.preventDefault(); close(); });
  $(document).on('keydown.plOverlay', function(e) { if (e.keyCode === 27) { e.stopPropagation(); close(); } });
  x.trigger('focus');
  return {body: body, close: close};
};

var noStorage = function(body) {
  body.append($('<p class="plNote"></p>').text(P('This browser isn\'t letting the game store cities (for example in a private window), so saving, the scoreboard and rewind are not available here.',
                                                 'Este navegador no deja que el juego guarde ciudades (por ejemplo, en una ventana privada), así que guardar, la tabla de puntuaciones y retroceder no están disponibles aquí.')));
};

// ---- Saved cities (start screen)
var openSavedCities = function() {
  var o = overlay(P('Saved cities', 'Ciudades guardadas'));
  var body = o.body;
  var render = function() {
    body.empty().append($('<p class="plNote"></p>').text(P('Loading…', 'Cargando…')));
    CityStore.listCities().then(function(list) {
      body.empty();
      body.append($('<p class="plNote"></p>').text(P('Saved in this browser only. To move a city to another computer, export it to a file and import it there.',
                                                     'Guardadas solo en este navegador. Para llevar una ciudad a otra computadora, expórtala a un archivo e impórtala allí.')));
      if (!list.length)
        body.append($('<p></p>').text(P('No saved cities yet. Use Save during a game.', 'Todavía no hay ciudades guardadas. Usa Guardar durante una partida.')));
      var table = $('<table class="plTable"><thead><tr></tr></thead><tbody></tbody></table>');
      [P('Name', 'Nombre'), P('Year', 'Año'), P('Population', 'Población'), P('Score', 'Puntuación'), P('Saved', 'Guardada'), '']
        .forEach(function(h) { table.find('thead tr').append($('<th></th>').text(h)); });
      list.forEach(function(c) {
        var tr = $('<tr></tr>');
        tr.append($('<td class="notranslate"></td>').text(c.name));
        tr.append($('<td class="num"></td>').text(c.year || ''));
        tr.append($('<td class="num"></td>').text(c.pop !== undefined ? fmt(c.pop) : ''));
        tr.append($('<td class="num"></td>').text(c.score !== undefined ? c.score : ''));
        tr.append($('<td></td>').text(when(c.savedAt)));
        var act = $('<td class="plActions"></td>');
        var load = $('<button type="button" class="plPrimary"></button>').text(P('Load', 'Cargar'));
        load.on('click', function() { CityStore.resume('cities', c.id); });
        var exp = $('<button type="button"></button>').text(P('Export', 'Exportar'));
        exp.on('click', function() {
          CityStore.exportCity(c.id).catch(function(err) {
            if (!err || err.code !== 'declined')
              exp.text(P('Couldn\'t export', 'No se pudo exportar'));
          });
        });
        var delBtn = $('<button type="button" class="plDanger"></button>').text(P('Delete', 'Borrar'));
        delBtn.on('click', function() {
          if (!delBtn.hasClass('confirm')) {
            delBtn.addClass('confirm').text(P('Really delete?', '¿Borrar de verdad?'));
            return;
          }
          CityStore.deleteCity(c.id).then(render);
        });
        act.append(load, exp, delBtn);
        tr.append(act);
        table.find('tbody').append(tr);
      });
      if (list.length)
        body.append(table);
      var imp = $('<label class="plImport"></label>');
      imp.append($('<span></span>').text(P('Import a city file (.json): ', 'Importar un archivo de ciudad (.json): ')));
      var input = $('<input type="file" accept=".json,application/json">');
      imp.append(input);
      var msg = $('<span class="plImportMsg" aria-live="polite"></span>');
      input.on('change', function() {
        var f = input[0].files && input[0].files[0];
        if (!f)
          return;
        var reader = new FileReader();
        reader.onload = function() {
          try {
            CityStore.importCity(String(reader.result)).then(render, function() {
              msg.text(P('That file could not be imported.', 'No se pudo importar ese archivo.'));
            });
          } catch (e) {
            msg.text(P('That isn\'t a Policy Lab city file.', 'Ese no es un archivo de ciudad de Policy Lab.'));
          }
        };
        reader.readAsText(f);
      });
      body.append(imp, msg);
    }, function() {
      body.empty();
      noStorage(body);
    });
  };
  render();
};

// ---- Scoreboard
var rulesText = function(r) {
  if (!r)
    return '';
  return [I18n.t(r.preset || ''), r.level].filter(Boolean).join(' · ');
};

var openScoreboard = function(currentCityId, currentRulesKey, onClose) {
  var o = overlay(P('Scoreboard', 'Tabla de puntuaciones'), onClose);
  var body = o.body;
  var render = function() {
    CityStore.listScores().then(function(list) {
      body.empty();
      body.append($('<p class="plNote"></p>').text(P('Your cities in this browser, best score first. Updated every game year. Scores are only fair to compare between cities played with the same rules (marked "same rules").',
                                                     'Tus ciudades en este navegador, con la mejor puntuación primero. Se actualiza cada año del juego. Solo es justo comparar puntuaciones de ciudades jugadas con las mismas reglas (marcadas "mismas reglas").')));
      if (!list.length) {
        body.append($('<p></p>').text(P('No cities yet: a city appears here after its first game year.', 'Todavía no hay ciudades: una ciudad aparece aquí después de su primer año de juego.')));
        return;
      }
      var table = $('<table class="plTable"><thead><tr></tr></thead><tbody></tbody></table>');
      ['#', P('City', 'Ciudad'), P('Best score', 'Mejor puntuación'), P('Now', 'Ahora'), P('Year', 'Año'), P('Population', 'Población'), P('Rules', 'Reglas'), '']
        .forEach(function(h) { table.find('thead tr').append($('<th></th>').text(h)); });
      list.forEach(function(s, i) {
        var tr = $('<tr></tr>').toggleClass('current', s.cityId === currentCityId);
        tr.append($('<td class="num"></td>').text(i + 1));
        var name = $('<td class="notranslate"></td>').text(s.cityName || '');
        if (s.cityId === currentCityId)
          name.append($('<span class="plTag"></span>').text(P('this city', 'esta ciudad')));
        else if (currentRulesKey && s.rulesKey === currentRulesKey)
          name.append($('<span class="plTag same"></span>').text(P('same rules', 'mismas reglas')));
        tr.append(name);
        tr.append($('<td class="num"></td>').html('<b>' + esc(s.best) + '</b>' + (s.bestYear ? ' <span class="plSub">(' + esc(s.bestYear) + ')</span>' : '')));
        tr.append($('<td class="num"></td>').text(s.score));
        tr.append($('<td class="num"></td>').text(s.year));
        tr.append($('<td class="num"></td>').text(fmt(s.pop || 0)));
        tr.append($('<td class="plRules"></td>').text(rulesText(s.rules)));
        var del = $('<button type="button" class="plDanger"></button>').text(P('Remove', 'Quitar'));
        del.on('click', function() {
          if (!del.hasClass('confirm')) {
            del.addClass('confirm').text(P('Really remove?', '¿Quitar de verdad?'));
            return;
          }
          CityStore.deleteScore(s.cityId).then(render);
        });
        tr.append($('<td class="plActions"></td>').append(del));
        table.find('tbody').append(tr);
      });
      body.append(table);
    }, function() {
      body.empty();
      noStorage(body);
    });
  };
  render();
};

// ---- Rewind (during a game). game provides cityId, saveCurrent(name) -> Promise, and the current year.
var openRewind = function(game, onClose) {
  var o = overlay(P('Go back in time', 'Volver atrás en el tiempo'), onClose);
  var body = o.body;
  CityStore.listSnapshots(game.cityId()).then(function(list) {
    body.empty();
    body.append($('<p class="plNote"></p>').text(P('The game keeps a copy of your city every {0} game years (the last {1}, so up to {2} years back). Pick a year to go back to. Your city as it is now is saved first, under Saved cities, so you can return to it.',
                                                   'El juego guarda una copia de tu ciudad cada {0} años de juego (las últimas {1}, es decir, hasta {2} años atrás). Elige un año al que volver. Tu ciudad tal como está ahora se guarda primero, en Ciudades guardadas, para que puedas regresar a ella.',
                                                   CityStore.SNAPSHOT_YEARS, CityStore.MAX_SNAPSHOTS, CityStore.SNAPSHOT_YEARS * CityStore.MAX_SNAPSHOTS)));
    if (!list.length) {
      body.append($('<p></p>').text(P('No copies yet: the first one is made in the next year ending in 0.', 'Todavía no hay copias: la primera se hace en el próximo año que termine en 0.')));
      return;
    }
    var ul = $('<ul class="plRewindList"></ul>');
    list.forEach(function(s) {
      var li = $('<li></li>');
      li.append($('<span class="plYear"></span>').text(s.year));
      li.append($('<span class="plSub"></span>').text(P('population {0} · score {1}', 'población {0} · puntuación {1}', fmt(s.pop || 0), s.score)));
      var go = $('<button type="button" class="plPrimary"></button>').text(P('Go back to {0}', 'Volver a {0}', s.year));
      go.on('click', function() {
        go.prop('disabled', true).text(P('Saving your city first…', 'Guardando primero tu ciudad…'));
        game.saveCurrent(P('{0} (before going back, {1})', '{0} (antes de volver atrás, {1})', game.name, game.currentYear()))
          .then(function() { CityStore.resume('snapshots', s.id); },
                function() { go.prop('disabled', false).text(P('Couldn\'t save first: try again', 'No se pudo guardar primero: inténtalo de nuevo')); });
      });
      li.append(go);
      ul.append(li);
    });
    body.append(ul);
  }, function() {
    body.empty();
    noStorage(body);
  });
};


// ---- What went wrong (during a game). onShow(finding) highlights a finding's spots on the map.
var openMistakes = function(game, onClose, onShow) {
  var o = overlay(P('What I did wrong and what to do', 'Qué hice mal y qué hacer'), onClose);
  var body = o.body;
  var r;
  try {
    r = Mistakes.report(game);
  } catch (e) {
    body.append($('<p></p>').text(P('The report could not be made right now.', 'No se pudo hacer el informe ahora.')));
    return;
  }
  // v29: "How your policies are working" (until v28 in the Evaluation window) goes at the end of this report
  var policyHTML = '';
  try { policyHTML = Report.policyReport(game.simulation); } catch (e) { policyHTML = ''; }
  var policyTitle = P('How your policies are working', 'Cómo están funcionando tus políticas');
  var policyText = $('<div></div>').html(policyHTML).find('li').map(function() { return '- ' + $(this).text(); }).get().join('\n');
  // v31: the city rating and graduation progress
  var gradeText = '';
  try {
    var hh = Policy.history || {years: []}, rr = Rating.compute(game.simulation, game._status, hh), aa = Rating.average(hh);
    var gl = [P('City rating', 'Calificación de la ciudad')];
    gl.push(rr ? P('- Grade now: {0} ({1}/100). Pulling it down most: {2}.', '- Nota actual: {0} ({1}/100). Lo que más la baja: {2}.', rr.grade, rr.points, rr.weakest.name.toLowerCase())
               : P('- No grade yet (no one lives in the city).', '- Todavía sin nota (no vive nadie en la ciudad).'));
    if (aa)
      gl.push(P('- Average of the last {0} years: {1} ({2}/100).', '- Media de los últimos {0} años: {1} ({2}/100).', aa.years, aa.grade, aa.points));
    gl.push(hh.graduated ? P('- Graduated in {0}.', '- Se graduó en {0}.', hh.graduated)
                         : P('- Graduation: {0} of {1} years in a row so far.', '- Graduación: {0} de {1} años seguidos por ahora.', hh.gradStreak || 0, Rating.YEARS_NEEDED));
    Rating.conditions(game.simulation, game._status, hh).forEach(function(k) { gl.push('  ' + (k.ok ? '[x] ' : '[ ] ') + k.text); });
    gradeText = gl.join('\n');
  } catch (e) { gradeText = ''; }
  var text = Mistakes.asText(r) + (gradeText ? '\n\n' + gradeText : '') + (policyText ? '\n\n' + policyTitle + '\n' + policyText : '');
  var head = $('<div class="plReportHead"></div>');
  head.append($('<p class="plNote"></p>').text(P('{0} in {1}, score {2}. The planning mistakes in the city as it is now (and in its money history), the worst first, each checked against this game\'s rules.',
                                                 '{0} en {1}, puntuación {2}. Los errores de planificación de la ciudad tal como está ahora (y en su historial de dinero), los peores primero, cada uno comprobado con las reglas de este juego.',
                                                 r.city, r.year, r.score)));
  var copy = $('<button type="button" class="plPrimary"></button>').text(P('Copy report', 'Copiar informe'));
  var copied = $('<span class="plCopied" aria-live="polite"></span>');
  var area = $('<textarea class="plCopyArea" readonly></textarea>').val(text).hide();
  copy.on('click', function() {
    var fallback = function() {
      area.show().trigger('focus').trigger('select');
      copied.text(P('Press Ctrl+C (Cmd+C on a Mac) to copy.', 'Pulsa Ctrl+C (Cmd+C en Mac) para copiar.'));
    };
    if (navigator.clipboard && navigator.clipboard.writeText)
      navigator.clipboard.writeText(text).then(function() { copied.text(P('Copied.', 'Copiado.')); }, fallback);
    else
      fallback();
  });
  // v29: save the report as a text file (to hand in)
  var save = $('<button type="button"></button>').text(P('Download report', 'Descargar informe'));
  save.on('click', function() {
    var safe = (String(r.city || 'city') + '-' + r.year).replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') || 'city';
    CityStore.downloadText(safe + '-report.txt', text).then(function(res) {
      copied.text(res && res.status === 'cancelled' ? '' : P('Saved.', 'Guardado.'));
    }, function() {
      copied.text(P('Could not save the file here: use Copy report instead.', 'No se pudo guardar el archivo aquí: usa Copiar informe.'));
    });
  });
  head.append($('<div class="plReportActions"></div>').append(copy, save, copied));
  body.append(head, area);
  if (!r.findings.length)
    body.append($('<p></p>').text(P('No planning mistakes found right now.', 'Ahora mismo no se encontraron errores de planificación.')));
  var ol = $('<ol class="plFindings"></ol>');
  r.findings.forEach(function(f) {
    var li = $('<li></li>');
    li.append($('<div class="plFindTitle"></div>').text(f.title));
    li.append($('<p></p>').append($('<b></b>').text(P('Why: ', 'Por qué: ')), document.createTextNode(f.why)));
    li.append($('<p></p>').append($('<b></b>').text(P('What to do: ', 'Qué hacer: ')), document.createTextNode(f.fix)));
    if (f.targets.length && onShow) {
      var show = $('<button type="button"></button>').text(P('Show on the map', 'Mostrar en el mapa'));
      show.on('click', function() { o.close(); onShow(f); });
      li.append(show);
    }
    ol.append(li);
  });
  body.append(ol);
  if (r.good.length)
    body.append($('<p class="plGood"></p>').append($('<b></b>').text(P('Going well: ', 'Va bien: ')), document.createTextNode(r.good.join(' '))));
  if (policyHTML)
    body.append($('<h3 class="plPolicyTitle"></h3>').text(policyTitle), $(policyHTML));
};


// v31: the graduation screen (the city met every condition for five Januaries in a row)
var openGraduation = function(game, onClose) {
  var sim = game.simulation, h = Policy.history || {years: []};
  var o = overlay(P('{0} graduated!', '¡{0} se graduó!', game.name || P('Your city', 'Tu ciudad')), onClose);
  var r = Rating.compute(sim, game._status, h), avg = Rating.average(h);
  var body = o.body.addClass('plGraduation');
  body.append($('<p class="plGradLead"></p>').text(P('For {0} years in a row the city kept approval at {2}% or more, every bubble green, no deficit, and at least {1} people.',
                                                     'Durante {0} años seguidos la ciudad mantuvo una aprobación del {2}% o más, todas las burbujas en verde, sin déficit y al menos {1} habitantes.',
                                                     Rating.YEARS_NEEDED, fmt(Rating.populationTarget(sim)), Rating.APPROVAL_NEEDED)));
  var dl = $('<dl class="plGradFacts"></dl>');
  var fact = function(k, v) { dl.append($('<dt></dt>').text(k), $('<dd></dd>').text(v)); };
  fact(P('Year', 'Año'), h.graduated);
  fact(P('Policies', 'Políticas'), Report.presetLabel ? Report.presetLabel(Policy.presetName) : Policy.presetName);
  fact(P('People', 'Habitantes'), fmt(sim.evaluation.cityPop || 0));
  fact(P('Approval', 'Aprobación'), (sim.evaluation.cityYes || 0) + '%');
  if (r)
    fact(P('Grade now', 'Nota actual'), r.grade + ' (' + r.points + ')');
  if (avg)
    fact(P('Average of the last {0} years', 'Media de los últimos {0} años', avg.years), avg.grade + ' (' + avg.points + ')');
  body.append(dl);
  body.append($('<p></p>').text(P('You can keep playing: the grade goes on being recorded every January. To hand in a report, open "What I did wrong" and press Download report.',
                                  'Puedes seguir jugando: la nota se sigue registrando cada enero. Para entregar un informe, abre "Qué hice mal" y pulsa Descargar informe.')));
  var keep = $('<button type="button" class="plGradKeep"></button>').text(P('Keep playing', 'Seguir jugando'));
  keep.on('click', function(e) { e.preventDefault(); o.close(); });
  body.append(keep);
};

// v32: game over. reason: 'bankrupt' (data: need, have, funds, taxes) or 'votedOut' (data: yes)
var openGameOver = function(game, reason, data, onClose) {
  var money = MiscUtils.formatMoney;
  var o = overlay(reason === 'bankrupt' ? P('Game over: the city went bankrupt', 'Fin del juego: la ciudad quebró')
                                        : P('Game over: the mayor was voted out', 'Fin del juego: el alcalde perdió el cargo'), onClose);
  var body = o.body.addClass('plGameOver');
  if (reason === 'bankrupt') {
    body.append($('<p class="plGradLead"></p>').text(P('In January the city owed {0} for its services and running costs, but had only {1} ({2} in the bank and {3} in taxes, at a tax of {4}%).',
                                                       'En enero la ciudad debía {0} por sus servicios y gastos de funcionamiento, pero solo tenía {1} ({2} en el banco y {3} en impuestos, con un impuesto del {4}%).',
                                                       money(data.need || 0), money(Math.max(0, data.have || 0)), money(data.funds || 0), money(data.taxes || 0),
                                                       game.simulation.budget.cityTax)));
    if (data.road !== undefined)
      body.append($('<p></p>').text(P('That would have paid for only {0}% of the roads\' upkeep and {1}% of the police: below half, the city can no longer run.',
                                      'Eso solo habría pagado el {0}% del mantenimiento de las calles y el {1}% de la policía: por debajo de la mitad, la ciudad ya no puede funcionar.',
                                      Math.round(100 * data.road), Math.round(100 * (data.police === undefined ? 1 : data.police)))));
    body.append($('<p></p>').text(P('Common causes: more road and services than the taxes can pay for, a tax rate too low for the city\'s size, or many expensive buildings (hospitals, colleges, water plants) in a small city.',
                                    'Causas frecuentes: más calles y servicios de los que pagan los impuestos, una tasa demasiado baja para el tamaño de la ciudad, o muchos edificios caros (hospitales, universidades, plantas de agua) en una ciudad pequeña.')));
  } else {
    body.append($('<p class="plGradLead"></p>').text(P('For two years in a row fewer than {0}% of residents approved of the mayor (last poll: {1}%).',
                                                       'Durante dos años seguidos menos del {0}% de los residentes aprobó al alcalde (última encuesta: {1}%).',
                                                       Rating.VOTED_OUT_BELOW, data.yes)));
    body.append($('<p></p>').text(P('Residents judge the mayor mostly on crime, pollution, housing costs, taxes, traffic and jobs: the red bubbles.',
                                    'Los residentes juzgan al alcalde sobre todo por la delincuencia, la contaminación, el costo de la vivienda, los impuestos, el tráfico y el empleo: las burbujas rojas.')));
  }
  body.append($('<p></p>').text(P('What now?', '¿Y ahora?')));
  var actions = $('<div class="plGameOverActions"></div>');
  var back = $('<button type="button" class="plPrimary"></button>').text(P('Go back in time', 'Volver atrás en el tiempo'));
  back.on('click', function(e) {
    e.preventDefault();
    o.close();
    game.openPanel(function(done) { openRewind(game, done); });
  });
  var start = $('<button type="button"></button>').text(P('Start screen (load a saved city or start a new one)', 'Pantalla de inicio (cargar una ciudad guardada o empezar una nueva)'));
  start.on('click', function(e) { e.preventDefault(); window.location.reload(); });
  var keep = $('<button type="button"></button>').text(P('Keep playing without a grade', 'Seguir jugando sin nota'));
  keep.on('click', function(e) { e.preventDefault(); o.close(); });
  actions.append(back, start, keep);
  body.append(actions);
  body.append($('<p class="plNote"></p>').text(P('Going back in time saves this city first, under Saved cities. The start screen does not: press Keep playing and then Save if you want to keep it.',
                                                 'Volver atrás guarda primero esta ciudad, en Ciudades guardadas. La pantalla de inicio no: pulsa Seguir jugando y luego Guardar si quieres conservarla.')));
};

var CityPanels = {
  openGameOver: openGameOver,
  openGraduation: openGraduation,
  openMistakes: openMistakes,
  openSavedCities: openSavedCities,
  openScoreboard: openScoreboard,
  openRewind: openRewind
};


export { CityPanels };

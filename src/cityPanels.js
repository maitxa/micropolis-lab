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
  var world = {original: P('1989 world model', 'modelo del mundo de 1989'), defaults: P('Policy Lab world model', 'modelo del mundo de Policy Lab'),
               custom: P('custom world model', 'modelo del mundo personalizado')}[r.world] || '';
  return [I18n.t(r.preset || ''), world, r.level].filter(Boolean).join(' · ');
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


var CityPanels = {
  openSavedCities: openSavedCities,
  openScoreboard: openScoreboard,
  openRewind: openRewind
};


export { CityPanels };

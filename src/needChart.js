/* Policy Lab additions to micropolisJS (2026).
 *
 * This code is released under the GNU GPL v3, with some additional terms, like the rest of micropolisJS.
 * Modified version: NOT the original micropolisJS / Micropolis.
 *
 * "Zoning need": replaces the original R / C / I demand bars in the lower left. One bar each for homes, shops and
 * factories. Above the line: zone more of that kind. Below: several zones of that kind are standing empty, or the city
 * doesn't want more. Each bar says why when you point at it (or tab to it). The rule is in advisor.js (zoningNeed), and
 * the To do card uses the same rule, so the two never disagree. This only describes the city: growth itself still
 * follows the game's original demand.
 */

import { I18n } from './i18n.js';
import { MiscUtils } from './miscUtils.js';

var P = I18n.p;
var fmt = MiscUtils.formatNumber;
var SVGNS = 'http://www.w3.org/2000/svg';
var BAR_H = 34;   // px from the line to the end of a full bar
var SVG_H = 2 * BAR_H + 8;

var names = function(t) {
  return {res: P('Homes', 'Viviendas'), com: P('Shops', 'Tiendas'), ind: P('Factories', 'Fábricas')}[t];
};
var capName = function(t) {
  return {res: P('a stadium', 'un estadio'), com: P('an airport', 'un aeropuerto'), ind: P('a seaport', 'un puerto')}[t];
};

var status = function(t, r) {
  switch (r.state) {
    case 'more': return P('Zone more', 'Zonifica más');
    case 'empty': return P('{0} empty', '{0} vacías', fmt(r.empty));
    case 'capped': return {res: P('Needs stadium', 'Falta estadio'), com: P('Needs airport', 'Falta aeropuerto'),
                           ind: P('Needs seaport', 'Falta puerto')}[t];
    case 'noNeed': return P('Not needed', 'No hace falta');
    default: return P('Enough', 'Suficiente');
  }
};

var reason = function(t, r) {
  var name = names(t);
  var text;
  switch (r.state) {
    case 'more':
      text = r.n ? P('{0}: the city wants more, and your {1} zones are full or nearly full. Zone more, next to a road, with power.',
                     '{0}: la ciudad quiere más, y tus {1} zonas están llenas o casi. Zonifica más, junto a una calle, con electricidad.', name, fmt(r.n))
                 : P('{0}: the city wants some and has none yet.', '{0}: la ciudad quiere y todavía no tiene ninguna.', name);
      break;
    case 'empty':
      var blocked = [];
      if (r.emptyNoPower)
        blocked.push(P('{0} without power', '{0} sin electricidad', fmt(r.emptyNoPower)));
      if (r.emptyNoRoad)
        blocked.push(P('{0} without a road', '{0} sin calle', fmt(r.emptyNoRoad)));
      text = P('{0}: {1} of {2} zones are empty', '{0}: {1} de {2} zonas están vacías', name, fmt(r.empty), fmt(r.n)) +
             (blocked.length ? ' (' + blocked.join(', ') + ')' : '') + '. ' +
             (blocked.length ? P('Fix those before zoning more.', 'Arregla eso antes de zonificar más.')
                             : P('Wait for them to fill before zoning more.', 'Espera a que se llenen antes de zonificar más.'));
      break;
    case 'capped':
      text = P('{0}: growth has stopped until you build {1}.', '{0}: el crecimiento se detuvo hasta que construyas {1}.', name, capName(t));
      break;
    case 'noNeed':
      text = P('{0}: the city doesn\'t want more right now.', '{0}: la ciudad no quiere más por ahora.', name);
      break;
    default:
      text = P('{0}: about right for now.', '{0}: más o menos lo justo por ahora.', name);
  }
  var d = Math.round(r.demand * 100);
  return text + ' ' + P('(Game\'s raw demand: {0}%.)', '(Demanda del juego: {0}%.)', (d > 0 ? '+' : '') + d);
};

var bar = function(r, t) {
  var svg = document.createElementNS(SVGNS, 'svg');
  svg.setAttribute('viewBox', '0 0 40 ' + SVG_H);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'needSvg');
  var zero = SVG_H / 2;
  var h = Math.round(Math.abs(r.value) * BAR_H);
  if (h > 0) {
    var rect = document.createElementNS(SVGNS, 'rect');
    rect.setAttribute('x', 9);
    rect.setAttribute('width', 22);
    rect.setAttribute('y', r.value > 0 ? zero - h : zero);
    rect.setAttribute('height', h);
    rect.setAttribute('class', 'needBar need-' + t + (r.value < 0 ? ' neg' : ''));
    svg.appendChild(rect);
  }
  var line = document.createElementNS(SVGNS, 'line');
  line.setAttribute('x1', 0);
  line.setAttribute('x2', 40);
  line.setAttribute('y1', zero);
  line.setAttribute('y2', zero);
  line.setAttribute('class', 'needZero');
  svg.appendChild(line);
  return svg;
};

var defaultNote = function() {
  return P('Above the line: zone more. Below: zones standing empty, or not needed. Point at a bar for why.',
           'Arriba de la línea: zonifica más. Abajo: zonas vacías, o no hace falta. Señala una barra para ver por qué.');
};

var pinned = null;   // the bar the player clicked: its reason stays shown

var render = function(container, need) {
  if (!container || !need)
    return;
  container.innerHTML = '';
  var title = document.createElement('div');
  title.className = 'needTitle';
  title.textContent = P('Zoning need', 'Necesidad de zonas');
  container.appendChild(title);
  var up = document.createElement('div');
  up.className = 'needAxis';
  up.textContent = P('↑ zone more', '↑ zonifica más');
  container.appendChild(up);

  var cols = document.createElement('div');
  cols.className = 'needCols';
  var note = document.createElement('p');
  note.className = 'needNote';
  note.setAttribute('aria-live', 'polite');
  var show = function(t) { note.textContent = t ? reason(t, need[t]) : (pinned ? reason(pinned, need[pinned]) : defaultNote()); };

  var labels = document.createElement('div');
  labels.className = 'needCols needLabels';
  var buttons = [];
  var setPinned = function() {
    buttons.forEach(function(b, i) { b.classList.toggle('pinned', ['res', 'com', 'ind'][i] === pinned); });
  };
  ['res', 'com', 'ind'].forEach(function(t) {
    var r = need[t];
    var col = document.createElement('button');
    col.type = 'button';
    col.className = 'needCol st-' + r.state + (pinned === t ? ' pinned' : '');
    col.setAttribute('aria-label', names(t) + ': ' + status(t, r) + '. ' + reason(t, r));
    col.appendChild(bar(r, t));
    var cell = document.createElement('div');
    cell.className = 'needCell st-' + r.state;
    var nm = document.createElement('span');
    nm.className = 'needName';
    nm.textContent = names(t);
    var st = document.createElement('span');
    st.className = 'needStatus';
    st.textContent = status(t, r);
    cell.appendChild(nm);
    cell.appendChild(st);
    [col, cell].forEach(function(el) {
      el.addEventListener('mouseenter', function() { show(t); });
      el.addEventListener('mouseleave', function() { show(null); });
      el.addEventListener('click', function(e) {
        e.preventDefault();
        pinned = pinned === t ? null : t;
        setPinned();
        show(pinned);
      });
    });
    col.addEventListener('focus', function() { show(t); });
    col.addEventListener('blur', function() { show(null); });
    buttons.push(col);
    cols.appendChild(col);
    labels.appendChild(cell);
  });
  container.appendChild(cols);
  var down = document.createElement('div');
  down.className = 'needAxis needAxisDown';
  down.textContent = P('↓ empty or not needed', '↓ vacías o no hace falta');
  container.appendChild(down);
  container.appendChild(labels);
  show(null);
  container.appendChild(note);
};


var NeedChart = {
  render: render
};


export { NeedChart };

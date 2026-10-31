/* Policy Lab additions to micropolisJS (2026).
 *
 * This code is released under the GNU GPL v3, with some additional terms, like the rest of micropolisJS.
 * Modified version: NOT the original micropolisJS / Micropolis.
 *
 * "Zoning need": replaces the original R / C / I demand bars in the lower left. One bar each for homes, shops and
 * factories. The bar is the game's demand (v29). Above the line: zone more of that kind, even if some zones are still
 * filling. Below: the city doesn't want more. Empty zones are listed apart: stuck (with the reason) or filling. Each bar says why when you point at it (or tab to it). The rule is in advisor.js (zoningNeed), and
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
    case 'capped': return {res: P('Needs stadium', 'Falta estadio'), com: P('Needs airport', 'Falta aeropuerto'),
                           ind: P('Needs seaport', 'Falta puerto')}[t];
    case 'noNeed': return P('Not needed', 'No hace falta');
    default: return P('Enough', 'Suficiente');
  }
};

// The small line under the status: empty zones, stuck or filling (v29)
var sub = function(r) {
  if (r.stuck)
    return {text: P('{0} stuck', '{0} atascadas', fmt(r.stuck)), cls: 'stuck'};
  if (r.filling)
    return {text: P('{0} filling', '{0} llenándose', fmt(r.filling)), cls: 'filling'};
  return null;
};

var emptyText = function(r) {
  if (!r.empty)
    return '';
  var why = [];
  if (r.emptyNoPower) why.push(P('{0} without power', '{0} sin electricidad', fmt(r.emptyNoPower)));
  if (r.emptyNoRoad) why.push(P('{0} without a road', '{0} sin calle', fmt(r.emptyNoRoad)));
  if (r.badSpot) why.push(P('{0} in a spot too polluted or too cheap for homes to grow', '{0} en un lugar demasiado contaminado o barato para que crezcan viviendas', fmt(r.badSpot)));
  var text = ' ' + P('{0} of your {1} zones are empty.', '{0} de tus {1} zonas están vacías.', fmt(r.empty), fmt(r.n));
  if (why.length)
    text += ' ' + P('Stuck: {0}.', 'Atascadas: {0}.', why.join(', '));
  if (r.filling)
    text += ' ' + P('{0} are filling: zones fill a little at a time, by chance, so more zones fill the city faster.',
                    '{0} se están llenando: las zonas se llenan poco a poco, al azar, así que más zonas llenan la ciudad más rápido.', fmt(r.filling));
  return text;
};

var reason = function(t, r) {
  var name = names(t);
  var text;
  switch (r.state) {
    case 'more':
      text = P('{0}: the city wants more. Zone more, next to a road, with power.', '{0}: la ciudad quiere más. Zonifica más, junto a una calle, con electricidad.', name);
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
  text += emptyText(r);
  if (r.stuck)
    text += ' ' + P('Click the bar to see them on the map, each with the reason.', 'Haz clic en la barra para verlas en el mapa, cada una con el motivo.');
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
  return P('The city\'s demand. Above the line: zone more. Below: not needed now. Click a bar to see where that kind would grow.',
           'La demanda de la ciudad. Arriba de la línea: zonifica más. Abajo: no hace falta ahora. Haz clic en una barra para ver dónde crecería ese tipo.');
};

var pinned = null;   // the bar the player clicked: its reason stays shown

var render = function(container, need, gauge) {
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
    // v30: how many zones of this kind are in use (have any buildings)
    if (r.n) {
      var oc = document.createElement('span');
      oc.className = 'needOcc';
      var used = r.n - r.empty;
      oc.textContent = P('{0}/{1} in use ({2}%)', '{0}/{1} en uso ({2}%)', fmt(used), fmt(r.n), Math.round(100 * used / r.n));
      cell.appendChild(oc);
    }
    var sb = sub(r);
    if (sb) {
      var sp = document.createElement('span');
      sp.className = 'needSub ' + sb.cls;
      sp.textContent = sb.text;
      cell.appendChild(sp);
    }
    [col, cell].forEach(function(el) {
      el.addEventListener('mouseenter', function() { show(t); });
      el.addEventListener('mouseleave', function() { show(null); });
      el.addEventListener('click', function(e) {
        e.preventDefault();
        pinned = pinned === t ? null : t;
        setPinned();
        show(pinned);
        // v30: clicking a bar shows where that kind would grow, and its stuck zones with the reason
        if (NeedChart.onPick)
          NeedChart.onPick(pinned);
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
  down.textContent = P('↓ not needed', '↓ no hace falta');
  container.appendChild(down);
  container.appendChild(labels);
  show(null);
  container.appendChild(note);
  if (gauge)
    container.appendChild(trafficGauge(gauge));
};

// v30: road, rail and highway for the size of the city, to keep traffic in check
var trafficGauge = function(g) {
  var box = document.createElement('div');
  box.className = 'needGauge';
  var head = document.createElement('div');
  head.className = 'needGaugeTitle';
  head.textContent = P('Roads and traffic', 'Calles y tráfico');
  box.appendChild(head);
  var per = g.zones ? g.roads / g.zones : 0;
  var k = g.people > 0 ? 1000 / g.people : 0;
  var rows = [
    [P('Road per zone', 'Calle por zona'), g.zones ? per.toFixed(1) : '–', per > 8 ? 'bad' : per > 6 ? 'warn' : 'ok',
     P('Compact: 3-4 road tiles per zone. More costs upkeep and spreads traffic.', 'Compacto: 3-4 casillas de calle por zona. Más cuesta mantenimiento y reparte el tráfico.')],
    [P('Jammed roads', 'Calles congestionadas'), g.roads ? Math.round(g.heavy * 100) + '%' : '–', g.heavy >= 0.30 ? 'bad' : g.heavy >= 0.15 ? 'warn' : 'ok',
     P('Share of road tiles with heavy traffic.', 'Parte de las casillas de calle con tráfico intenso.')],
    [P('Rail per 1,000 people', 'Tren por cada 1.000 personas'), g.people ? (g.rail * k).toFixed(1) : '–', 'info',
     P('Rail tiles. With linked train depots, trips go twice as far and put half the traffic on the roads.', 'Casillas de vía. Con estaciones unidas, los viajes llegan el doble de lejos y ponen la mitad del tráfico en las calles.')],
    [P('Highway per 1,000 people', 'Autopista por cada 1.000 personas'), g.people ? (g.highway * k).toFixed(1) : '–', 'info',
     P('Highway tiles: trips go three times as far on them, with half the congestion.', 'Casillas de autopista: los viajes llegan tres veces más lejos, con la mitad de congestión.')]
  ];
  rows.forEach(function(r) {
    var row = document.createElement('div');
    row.className = 'needGaugeRow g-' + r[2];
    row.title = r[3];
    var a = document.createElement('span');
    a.textContent = r[0];
    var b = document.createElement('b');
    b.textContent = r[1];
    row.appendChild(a);
    row.appendChild(b);
    box.appendChild(row);
  });
  return box;
};


var NeedChart = {
  render: render
};


export { NeedChart };

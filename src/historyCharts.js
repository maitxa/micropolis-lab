/* Policy Lab additions to micropolisJS (2026).
 *
 * This code is released under the GNU GPL v3, with some additional terms, like the rest of micropolisJS.
 * Modified version: NOT the original micropolisJS / Micropolis.
 *
 * Small history charts shown when hovering over Funds: funds, each year's surplus or deficit, population and tax rate.
 * One measure per chart (each with its own axis), drawn as plain SVG. Hovering a chart shows the value at that point.
 */

import { I18n } from './i18n.js';
import { MiscUtils } from './miscUtils.js';
import { Text } from './text.js';

var P = I18n.p;
var SVGNS = 'http://www.w3.org/2000/svg';

var W = 300, H = 92;                  // chart size in px
var PAD = {l: 52, r: 10, t: 8, b: 18}; // room for the axis labels

var el = function(name, attrs) {
  var e = document.createElementNS(SVGNS, name);
  Object.keys(attrs || {}).forEach(function(k) { e.setAttribute(k, attrs[k]); });
  return e;
};

var monthLabel = function(p) {
  return Text.L('months')[p.m] + ' ' + p.y;
};

// Round axis limits outward to "nice" numbers
var niceRange = function(min, max) {
  if (min === max) {
    var pad = Math.abs(min) * 0.1 || 1;
    min -= pad;
    max += pad;
  }
  var span = max - min;
  var step = Math.pow(10, Math.floor(Math.log10(span)));
  if (span / step < 3)
    step /= 2;
  return {min: Math.floor(min / step) * step, max: Math.ceil(max / step) * step};
};

var axisFrame = function(svg, range, fmt) {
  var plotH = H - PAD.t - PAD.b;
  [range.min, range.max].forEach(function(v, i) {
    var y = PAD.t + (i === 0 ? plotH : 0);
    svg.appendChild(el('line', {x1: PAD.l, x2: W - PAD.r, y1: y, y2: y, class: 'hcGrid'}));
    var t = el('text', {x: PAD.l - 6, y: y + 4, class: 'hcAxis', 'text-anchor': 'end'});
    t.textContent = fmt(v);
    svg.appendChild(t);
  });
};

var timeLabels = function(svg, first, last) {
  var t1 = el('text', {x: PAD.l, y: H - 4, class: 'hcAxis', 'text-anchor': 'start'});
  t1.textContent = first;
  svg.appendChild(t1);
  if (last !== first) {
    var t2 = el('text', {x: W - PAD.r, y: H - 4, class: 'hcAxis', 'text-anchor': 'end'});
    t2.textContent = last;
    svg.appendChild(t2);
  }
};

// The readout under the chart title, updated on hover
var setReadout = function(box, text) {
  box.querySelector('.hcReadout').textContent = text;
};

// A line chart of monthly values: points [{y, m, v}]
var lineChart = function(box, points, fmt, latestText, readFmt) {
  readFmt = readFmt || fmt;
  var svg = el('svg', {width: W, height: H, viewBox: '0 0 ' + W + ' ' + H, role: 'img'});
  var vals = points.map(function(p) { return p.v; });
  var range = niceRange(Math.min.apply(null, vals), Math.max.apply(null, vals));
  var plotW = W - PAD.l - PAD.r, plotH = H - PAD.t - PAD.b;
  var sx = function(i) { return PAD.l + (points.length > 1 ? i / (points.length - 1) : 0.5) * plotW; };
  var sy = function(v) { return PAD.t + plotH - (v - range.min) / (range.max - range.min) * plotH; };
  axisFrame(svg, range, fmt);
  timeLabels(svg, String(points[0].y), String(points[points.length - 1].y));
  var d = points.map(function(p, i) { return (i ? 'L' : 'M') + sx(i).toFixed(1) + ' ' + sy(p.v).toFixed(1); }).join(' ');
  svg.appendChild(el('path', {d: d, class: 'hcLine'}));
  var last = points.length - 1;
  svg.appendChild(el('circle', {cx: sx(last), cy: sy(points[last].v), r: 4, class: 'hcDot'}));
  // hover: a hairline that snaps to the nearest month, and a marker on the line
  var hair = el('line', {y1: PAD.t, y2: PAD.t + plotH, class: 'hcHair', visibility: 'hidden'});
  var mark = el('circle', {r: 4, class: 'hcDot', visibility: 'hidden'});
  svg.appendChild(hair);
  svg.appendChild(mark);
  var hit = el('rect', {x: PAD.l, y: 0, width: plotW, height: H, fill: 'transparent'});
  svg.appendChild(hit);
  svg.setAttribute('aria-label', latestText);
  hit.addEventListener('pointermove', function(e) {
    var r = svg.getBoundingClientRect();
    var i = Math.round((e.clientX - r.left - PAD.l) / plotW * (points.length - 1));
    i = MiscUtils.clamp(i, 0, last);
    hair.setAttribute('x1', sx(i)); hair.setAttribute('x2', sx(i)); hair.setAttribute('visibility', 'visible');
    mark.setAttribute('cx', sx(i)); mark.setAttribute('cy', sy(points[i].v)); mark.setAttribute('visibility', 'visible');
    setReadout(box, monthLabel(points[i]) + ': ' + readFmt(points[i].v));
  });
  hit.addEventListener('pointerleave', function() {
    hair.setAttribute('visibility', 'hidden');
    mark.setAttribute('visibility', 'hidden');
    setReadout(box, latestText);
  });
  return svg;
};

// Bars of yearly surplus (above zero) or deficit (below zero): years [{y, v}]
var barChart = function(box, years, fmt, latestText) {
  var svg = el('svg', {width: W, height: H, viewBox: '0 0 ' + W + ' ' + H, role: 'img'});
  var vals = years.map(function(p) { return p.v; }).concat([0]);
  var range = niceRange(Math.min.apply(null, vals), Math.max.apply(null, vals));
  var plotW = W - PAD.l - PAD.r, plotH = H - PAD.t - PAD.b;
  var sy = function(v) { return PAD.t + plotH - (v - range.min) / (range.max - range.min) * plotH; };
  axisFrame(svg, range, fmt);
  var zero = sy(0);
  svg.appendChild(el('line', {x1: PAD.l, x2: W - PAD.r, y1: zero, y2: zero, class: 'hcZero'}));
  timeLabels(svg, String(years[0].y), String(years[years.length - 1].y));
  var slot = plotW / years.length;
  var bw = Math.max(2, Math.min(24, slot - 2));
  years.forEach(function(p, i) {
    var x = PAD.l + i * slot + (slot - bw) / 2;
    var y = sy(p.v);
    var h = Math.abs(y - zero);
    var rr = Math.min(4, bw / 2, h);
    // rounded at the data end, square at the zero line
    var d = p.v >= 0
      ? 'M' + x + ' ' + zero + ' V' + (y + rr) + ' Q' + x + ' ' + y + ' ' + (x + rr) + ' ' + y + ' H' + (x + bw - rr) +
        ' Q' + (x + bw) + ' ' + y + ' ' + (x + bw) + ' ' + (y + rr) + ' V' + zero + ' Z'
      : 'M' + x + ' ' + zero + ' V' + (y - rr) + ' Q' + x + ' ' + y + ' ' + (x + rr) + ' ' + y + ' H' + (x + bw - rr) +
        ' Q' + (x + bw) + ' ' + y + ' ' + (x + bw) + ' ' + (y - rr) + ' V' + zero + ' Z';
    var bar = el('path', {d: d, class: p.v >= 0 ? 'hcPos' : 'hcNeg'});
    svg.appendChild(bar);
    // the whole slot is the hover target, so thin bars are easy to hit
    var hit = el('rect', {x: PAD.l + i * slot, y: 0, width: slot, height: H, fill: 'transparent'});
    hit.addEventListener('pointerenter', function() {
      bar.classList.add('hcHot');
      setReadout(box, P('Tax year {0}: {1}', 'Año fiscal {0}: {1}', p.y, fmt(p.v, true)));
    });
    hit.addEventListener('pointerleave', function() {
      bar.classList.remove('hcHot');
      setReadout(box, latestText);
    });
    svg.appendChild(hit);
  });
  svg.setAttribute('aria-label', latestText);
  return svg;
};

var money = function(v, signed) {
  var s = MiscUtils.formatMoney(Math.abs(v));
  return v < 0 ? '−' + s : (signed && v > 0 ? '+' + s : s);
};
var shortMoney = function(v) {
  var a = Math.abs(v);
  var s = a >= 1e6 ? '$' + (a / 1e6).toFixed(1) + 'M' : a >= 1e4 ? '$' + Math.round(a / 1e3) + 'k' : MiscUtils.formatMoney(a);
  return v < 0 ? '−' + s : s;
};
var shortNumber = function(v) {
  return v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : v >= 1e4 ? Math.round(v / 1e3) + 'k' : MiscUtils.formatNumber(v);
};

var block = function(container, title) {
  var box = document.createElement('div');
  box.className = 'hcBlock';
  var head = document.createElement('div');
  head.className = 'hcHead';
  var t = document.createElement('span');
  t.className = 'hcTitle';
  t.textContent = title;
  var r = document.createElement('span');
  r.className = 'hcReadout';
  head.appendChild(t);
  head.appendChild(r);
  box.appendChild(head);
  container.appendChild(box);
  return box;
};

var render = function(container, history) {
  container.innerHTML = '';
  var months = history.months || [], years = history.years || [];
  if (months.length < 2) {
    var p = document.createElement('p');
    p.className = 'hcEmpty';
    p.textContent = P('The city\'s history starts now: the charts fill in month by month.',
                      'La historia de la ciudad empieza ahora: los gráficos se llenan mes a mes.');
    container.appendChild(p);
    return;
  }
  var last = months[months.length - 1];

  var b1 = block(container, P('Funds', 'Fondos'));
  var t1 = P('Now: {0}', 'Ahora: {0}', money(last.funds));
  setReadout(b1, t1);
  b1.appendChild(lineChart(b1, months.map(function(q) { return {y: q.y, m: q.m, v: q.funds}; }),
                           function(v) { return shortMoney(v); }, t1, function(v) { return money(v); }));

  var b2 = block(container, P('Surplus or deficit each year', 'Superávit o déficit de cada año'));
  if (years.length) {
    var ly = years[years.length - 1];
    var t2 = P('Last year: {0}', 'El año pasado: {0}', money(ly.v, true));
    setReadout(b2, t2);
    b2.appendChild(barChart(b2, years, function(v, full) { return full ? money(v, true) : shortMoney(v); }, t2));
    var key = document.createElement('div');
    key.className = 'hcKey';
    key.innerHTML = '<span class="hcSw hcPos"></span>' + P('surplus', 'superávit') +
                    ' <span class="hcSw hcNeg"></span>' + P('deficit', 'déficit') +
                    ' <span class="hcKeyNote">' + P('(taxes minus running costs)', '(impuestos menos gastos de mantenimiento)') + '</span>';
    b2.appendChild(key);
  } else {
    setReadout(b2, P('After the first tax year', 'Después del primer año fiscal'));
  }

  var b3 = block(container, P('Population', 'Población'));
  var t3 = P('Now: {0}', 'Ahora: {0}', MiscUtils.formatNumber(last.pop));
  setReadout(b3, t3);
  b3.appendChild(lineChart(b3, months.map(function(q) { return {y: q.y, m: q.m, v: q.pop}; }), shortNumber, t3,
                           function(v) { return MiscUtils.formatNumber(v); }));

  var b4 = block(container, P('Tax rate', 'Tasa de impuestos'));
  var t4 = P('Now: {0}%', 'Ahora: {0}%', last.tax);
  setReadout(b4, t4);
  b4.appendChild(lineChart(b4, months.map(function(q) { return {y: q.y, m: q.m, v: q.tax}; }),
                           function(v) { return Math.round(v) + '%'; }, t4));
};


var HistoryCharts = {
  render: render
};


export { HistoryCharts };

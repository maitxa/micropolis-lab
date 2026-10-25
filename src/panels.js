/* Policy Lab additions to micropolisJS (2026).
 *
 * This code is released under the GNU GPL v3, with some additional terms, like the rest of micropolisJS.
 * Modified version: NOT the original micropolisJS / Micropolis.
 *
 * Movable, resizable panels. Each panel gets a dotted strip at the top (drag it to move the panel) and a grip in the
 * bottom-right corner (drag it to resize). The "To do" card changes width and height; the other panels, whose
 * contents have fixed sizes, scale up or down as a whole. The arrangement is remembered in this browser only
 * (localStorage); "Reset layout" (in the keyboard help) puts everything back.
 */

import $ from "jquery";

var STORAGE_KEY = 'policyLabLayout';

// kind: 'scale' (the whole panel grows or shrinks) or 'size' (width and height change; content reflows)
var PANELS = [
  {id: 'infobar', kind: 'scale'},
  {id: 'miscButtons', kind: 'scale'},
  {id: 'RCIContainer', kind: 'scale'},
  {id: 'controls', kind: 'scale'},
  {id: 'advisor', kind: 'size'}
];

var MIN_SCALE = 0.75, MAX_SCALE = 2;
var FONT_MIN = 12, FONT_MAX = 22, FONT_DEFAULT = 14;

var layout = {};
var listeners = [];

var load = function() {
  try {
    var saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}');
    layout = saved && typeof saved === 'object' ? saved : {};
  } catch (e) {
    layout = {};
  }
};

var save = function() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch (e) {
    // not saved: the layout still works for this visit
  }
};

var container = function() {
  return $('#canvasContainer');
};

// Keep at least part of a panel inside the map area, so it can always be grabbed again
var clampPosition = function(el, left, top) {
  var c = container();
  var w = el.offsetWidth * (parseFloat(el.getAttribute('data-scale')) || 1);
  var maxLeft = c.width() - 60, maxTop = c.height() - 30;
  return {left: Math.round(Math.min(Math.max(left, 60 - w), maxLeft)), top: Math.round(Math.min(Math.max(top, 0), maxTop))};
};

var applyOne = function(p) {
  var el = document.getElementById(p.id);
  var s = layout[p.id];
  if (!el)
    return;
  if (!s) {
    el.style.left = el.style.top = el.style.right = el.style.width = el.style.height = el.style.transform = '';
    el.removeAttribute('data-scale');
    el.classList.remove('userPlaced', 'userSized');
    return;
  }
  if (s.scale && p.kind === 'scale') {
    el.style.transform = 'scale(' + s.scale + ')';
    el.setAttribute('data-scale', s.scale);
  }
  if (s.w && p.kind === 'size') {
    el.style.width = s.w + 'px';
    el.style.height = s.h + 'px';
    el.classList.add('userSized');
  }
  if (s.left !== undefined) {
    var pos = clampPosition(el, s.left, s.top);
    el.style.left = pos.left + 'px';
    el.style.top = pos.top + 'px';
    el.style.right = 'auto';
    el.classList.add('userPlaced');
  }
  if (p.id === 'advisor')
    el.style.setProperty('--advice-size', (s.font || FONT_DEFAULT) + 'px');
};

var applyAll = function() {
  PANELS.forEach(applyOne);
  listeners.forEach(function(cb) { cb(); });
};

var bringToFront = function(el) {
  PANELS.forEach(function(p) {
    var other = document.getElementById(p.id);
    if (other)
      other.classList.remove('panelFront');
  });
  el.classList.add('panelFront');
};

// Follow a pointer drag; onMove gets the distance moved since the start
var trackDrag = function(e, onMove, onEnd) {
  e.preventDefault();
  e.stopPropagation();
  var startX = e.clientX, startY = e.clientY;
  var target = e.currentTarget;
  if (target.setPointerCapture && e.pointerId !== undefined)
    target.setPointerCapture(e.pointerId);
  var move = function(ev) {
    ev.preventDefault();
    onMove(ev.clientX - startX, ev.clientY - startY);
  };
  var up = function() {
    target.removeEventListener('pointermove', move);
    target.removeEventListener('pointerup', up);
    target.removeEventListener('pointercancel', up);
    onEnd();
  };
  target.addEventListener('pointermove', move);
  target.addEventListener('pointerup', up);
  target.addEventListener('pointercancel', up);
};

var setUp = function(p) {
  var el = document.getElementById(p.id);
  if (!el || el.querySelector('.dragStrip'))
    return;

  var strip = document.createElement('div');
  strip.className = 'dragStrip';
  strip.setAttribute('title', 'Drag to move');
  el.insertBefore(strip, el.firstChild);

  var grip = document.createElement('div');
  grip.className = 'resizeGrip';
  grip.setAttribute('title', 'Drag to resize');
  el.appendChild(grip);

  strip.addEventListener('pointerdown', function(e) {
    bringToFront(el);
    var startLeft = el.offsetLeft, startTop = el.offsetTop;
    trackDrag(e, function(dx, dy) {
      var pos = clampPosition(el, startLeft + dx, startTop + dy);
      el.style.left = pos.left + 'px';
      el.style.top = pos.top + 'px';
      el.style.right = 'auto';
      el.classList.add('userPlaced');
    }, function() {
      var s = layout[p.id] = layout[p.id] || {};
      s.left = el.offsetLeft;
      s.top = el.offsetTop;
      save();
      listeners.forEach(function(cb) { cb(); });
    });
  });

  grip.addEventListener('pointerdown', function(e) {
    bringToFront(el);
    var s = layout[p.id] = layout[p.id] || {};
    // Pin the panel where it is, so it grows from its top-left corner
    if (s.left === undefined) {
      s.left = el.offsetLeft;
      s.top = el.offsetTop;
      el.style.left = s.left + 'px';
      el.style.top = s.top + 'px';
      el.style.right = 'auto';
      el.classList.add('userPlaced');
    }
    if (p.kind === 'scale') {
      var startScale = s.scale || 1, baseW = el.offsetWidth;
      trackDrag(e, function(dx) {
        var scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, (baseW * startScale + dx) / baseW));
        s.scale = Math.round(scale * 100) / 100;
        el.style.transform = 'scale(' + s.scale + ')';
        el.setAttribute('data-scale', s.scale);
      }, function() {
        save();
      });
    } else {
      var startW = el.offsetWidth, startH = el.offsetHeight;
      var c = container();
      trackDrag(e, function(dx, dy) {
        s.w = Math.round(Math.min(c.width() - el.offsetLeft - 10, Math.max(240, startW + dx)));
        s.h = Math.round(Math.min(c.height() - el.offsetTop - 10, Math.max(120, startH + dy)));
        el.style.width = s.w + 'px';
        el.style.height = s.h + 'px';
        el.classList.add('userSized');
      }, function() {
        save();
        listeners.forEach(function(cb) { cb(); });
      });
    }
  });
};


var Panels = {
  // Call once the panels are visible
  init: function() {
    load();
    PANELS.forEach(setUp);
    applyAll();
    $(window).on('resize', applyAll);

    // Text size buttons on the "To do" card
    $('#advisorSmaller, #advisorLarger').on('click', function(e) {
      e.preventDefault();
      var s = layout.advisor = layout.advisor || {};
      var size = (s.font || FONT_DEFAULT) + (this.id === 'advisorLarger' ? 2 : -2);
      s.font = Math.min(FONT_MAX, Math.max(FONT_MIN, size));
      document.getElementById('advisor').style.setProperty('--advice-size', s.font + 'px');
      save();
    });

    $('#resetLayout').on('click', function(e) {
      e.preventDefault();
      layout = {};
      save();
      applyAll();
    });
  },

  // Has the player moved or resized this panel?
  isPlaced: function(id) {
    return !!(layout[id] && layout[id].left !== undefined);
  },

  isSized: function(id) {
    return !!(layout[id] && layout[id].w);
  },

  onChange: function(cb) {
    listeners.push(cb);
  }
};


export { Panels };

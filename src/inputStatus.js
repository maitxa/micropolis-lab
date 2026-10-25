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

import { EventEmitter } from './eventEmitter.js';
import { GameCanvas } from './gameCanvas.js';
import { GameTools } from './gameTools.js';
import * as Messages from './messages.ts';
import { MiscUtils } from './miscUtils.js';

var InputStatus = EventEmitter(function(map, tileWidth) {
  this.gameTools = new GameTools(map);

  this.gameTools.addEventListener(Messages.QUERY_WINDOW_NEEDED, MiscUtils.reflectEvent.bind(this, Messages.QUERY_WINDOW_NEEDED));

  this.canvasID = MiscUtils.normaliseDOMid(canvasID);

  this._tileWidth = tileWidth;

  // Keyboard Movement
  this.up = false;
  this.down = false;
  this.left = false;
  this.right = false;
  this.escape = false;

  // Mouse movement
  this.mouseX = -1;
  this.mouseY = -1;

  // Mouse drags
  this._dragging = false;
  this._lastdragX = -1;
  this._lastdragY = -1;

  // POLICY LAB: each click or drag is one "stroke" (so a whole dragged road is undone in one step)
  this.strokeId = 0;

  // Tool buttons
  this.toolName = null;
  this.currentTool = null;
  this.toolWidth = 0;
  this.toolColour = '';

  // Add the listeners
  $(document).keydown(keyDownHandler.bind(this));
  $(document).keyup(keyUpHandler.bind(this));

  this.getRelativeCoordinates = getRelativeCoordinates.bind(this);
  $(this.canvasID).on('mouseenter', mouseEnterHandler.bind(this));
  $(this.canvasID).on('mouseleave', mouseLeaveHandler.bind(this));

  this.mouseDownHandler = mouseDownHandler.bind(this);
  this.mouseMoveHandler = mouseMoveHandler.bind(this);
  this.mouseUpHandler = mouseUpHandler.bind(this);
  this.canvasClickHandler = canvasClickHandler.bind(this);

  $('.toolButton').click(toolButtonHandler.bind(this));
  $('#budgetRequest').click(budgetHandler.bind(this));
  $('#evalRequest').click(evalHandler.bind(this));
  $('#disasterRequest').click(disasterHandler.bind(this));
  $('#pauseRequest').click(this.speedChangeHandler.bind(this));
  $('#screenshotRequest').click(screenshotHandler.bind(this));
  $('#settingsRequest').click(settingsHandler.bind(this));
  $('#saveRequest').click(saveHandler.bind(this));
  $('#debugRequest').click(debugHandler.bind(this));
  // POLICY LAB
  $('#undoRequest').click(makeHandler('UNDO_REQUESTED').bind(this));
  $('#keysRequest').click(makeHandler('KEYS_HELP_REQUESTED').bind(this));
  $('#cityDataRequest').click(makeHandler('CITY_DATA_REQUESTED').bind(this));
});


var canvasID = '#' + GameCanvas.DEFAULT_ID;
var toolOutputID = '#toolOutput';


// POLICY LAB: keyboard shortcuts for tools. Number keys and a few letters (W/A/S/D and the arrows still scroll).
var toolKeys = {
  49: 'residentialButton', 50: 'commercialButton', 51: 'industrialButton', 52: 'roadButton', 53: 'railButton',
  54: 'wireButton', 55: 'parkButton', 56: 'policeButton', 57: 'fireButton', 48: 'queryButton',
  66: 'bulldozerButton',  // B
  84: 'depotButton',      // T (train depot)
  85: 'waterButton',      // U (water treatment plant)
  77: 'hospitalButton'    // M (medical)
};
// Numeric keypad
for (var k = 0; k <= 9; k++)
  toolKeys[96 + k] = toolKeys[48 + k];

var isTyping = function(e) {
  var t = e.target;
  return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
};

var keyDownHandler = function(e) {
  var handled = false;

  if (!isTyping(e) && !$('.modal:visible').length) {
    // Undo: Ctrl+Z (Windows) or Cmd+Z (Mac)
    if ((e.ctrlKey || e.metaKey) && e.keyCode === 90 && !e.shiftKey) {
      this._emitEvent(Messages.UNDO_REQUESTED);
      e.preventDefault();
      return;
    }

    if (!e.ctrlKey && !e.metaKey && !e.altKey) {
      // I: City data (indicators)
      if (e.keyCode === 73) {
        this._emitEvent(Messages.CITY_DATA_REQUESTED);
        e.preventDefault();
        return;
      }

      // "?" (Shift + /) or H: keyboard help
      if (e.keyCode === 191 || e.keyCode === 72) {
        this._emitEvent(Messages.KEYS_HELP_REQUESTED);
        e.preventDefault();
        return;
      }

      if (toolKeys[e.keyCode] !== undefined) {
        this.selectToolByButton(toolKeys[e.keyCode]);
        e.preventDefault();
        return;
      }
    }
  }

  switch (e.keyCode) {
    case 38:
    case 87:
      this.up = true;
      handled = true;
      break;

    case 40:
    case 83:
      this.down = true;
      handled = true;
      break;

    case 39:
    case 68:
      this.right = true;
      handled = true;
      break;

    case 37:
    case 65:
      this.left = true;
      handled = true;
      break;

    case 27:
      this.escape = true;
      handled = true;
  }

  if (handled)
    e.preventDefault();
};


var keyUpHandler = function(e) {
  switch (e.keyCode) {
    case 38:
    case 87:
      this.up = false;
      break;

    case 40:
    case 83:
      this.down = false;
      break;

    case 39:
    case 68:
      this.right = false;
      break;

    case 37:
    case 65:
      this.left = false;
      break;

    case 27:
      this.escape = false;
  }
};


var getRelativeCoordinates = function(e) {
  var cRect = document.querySelector(this.canvasID).getBoundingClientRect();
  return {x: e.clientX - cRect.left, y: e.clientY - cRect.top};
};


var mouseEnterHandler = function(e) {
  this._mouseInside = true;  // POLICY LAB: so keyboard tool selection can hook up the canvas
  if (this.currentTool === null)
    return;

  $(this.canvasID).on('mousemove', this.mouseMoveHandler);

  if (this.currentTool.isDraggable)
    $(this.canvasID).on('mousedown', this.mouseDownHandler);
  else
    $(this.canvasID).on('click', this.canvasClickHandler);
};


var mouseDownHandler = function(e) {
  // POLICY LAB: Shift+click draws a straight line from the last tile you built on
  if (e.which === 1 && e.shiftKey && !e.altKey && !e.ctrlKey && !e.metaKey) {
    var c = this.getRelativeCoordinates(e);
    this.strokeId += 1;
    this._emitEvent(Messages.TOOL_LINE, {x: c.x, y: c.y});
    e.preventDefault();
    return;
  }

  if (e.which !== 1 || e.shiftKey || e.altKey || e.ctrlKey || e.metaKey)
    return;

  this.strokeId += 1;

  var coords = this.getRelativeCoordinates(e);
  this.mouseX = coords.x;
  this.mouseY = coords.y;

  this._dragging = true;
  this._emitEvent(Messages.TOOL_CLICKED, {x: this.mouseX, y: this.mouseY});

  this._lastDragX = Math.floor(this.mouseX / this._tileWidth);
  this._lastDragY = Math.floor(this.mouseY / this._tileWidth);

  $(this.canvasID).on('mouseup', this.mouseUpHandler);
  e.preventDefault();
};


var mouseUpHandler = function(e) {
  this._dragging = false;
  this._lastDragX = -1;
  this._lastDragY = -1;
  $(this.canvasID).off('mouseup');
  e.preventDefault();
};


var mouseLeaveHandler = function(e) {
  this._mouseInside = false;
  $(this.canvasID).off('mousedown');
  $(this.canvasID).off('mousemove');
  $(this.canvasID).off('mouseup');

  // Watch out: we might have been mid-drag
  if (this._dragging) {
    this._dragging = false;
    this._lastDragX = -1;
    this._lastDragY = -1;
  }

  $(this.canvasID).off('click');

  this.mouseX = -1;
  this.mouseY = -1;
};


var mouseMoveHandler = function(e) {
  var coords = this.getRelativeCoordinates(e);
  this.mouseX = coords.x;
  this.mouseY = coords.y;

  if (this._dragging) {
    // XXX Work up how to patch up the path for fast mouse moves. My first attempt was too slow, and ended up missing
    // mouseUp events
    var x = Math.floor(this.mouseX / this._tileWidth);
    var y = Math.floor(this.mouseY / this._tileWidth);

    var lastX = this._lastDragX;
    var lastY = this._lastDragY;
    if (x !== lastX || y !== lastY) {
      this._emitEvent(Messages.TOOL_CLICKED, {x: this.mouseX, y: this.mouseY});
      this._lastDragX = x;
      this._lastDragY = y;
    }
  }
};


var canvasClickHandler = function(e) {
  if (e.which !== 1 || e.shiftKey || e.altKey || e.ctrlKey || e.metaKey || this.mouseX === -1 ||
     this._mouseY === -1 || this._dragging)
    return;

  this.strokeId += 1;
  this._emitEvent(Messages.TOOL_CLICKED, {x: this.mouseX, y: this.mouseY});
  e.preventDefault();
};


var toolButtonHandler = function(e) {
  // POLICY LAB: buttons now contain an icon and labels; always use the button itself, not the inner element clicked
  e = {target: e.currentTarget || e.target, preventDefault: e.preventDefault.bind(e)};

  // Remove highlight from last tool button
  $('.selected').each(function() {
    $(this).removeClass('selected');
    $(this).addClass('unselected');
  });

  // Add highlight
  $(e.target).removeClass('unselected');
  $(e.target).addClass('selected');

  this.toolName = $(e.target).attr('data-tool');
  this.toolWidth = $(e.target).attr('data-size');
  this.currentTool = this.gameTools[this.toolName];
  this.toolColour = $(e.target).attr('data-colour');
  $(toolOutputID).html('Tools');

  if (this.toolName !== 'query') {
    $(this.canvasID).removeClass('helpPointer');
    $(this.canvasID).addClass('pointer');
  } else {
    $(this.canvasID).removeClass('pointer');
    $(this.canvasID).addClass('helpPointer');
  }

  e.preventDefault();
};


// POLICY LAB: choose a tool from the keyboard, and make sure the canvas listens for the right kind of input
// (click for buildings, press-and-drag for roads, rail, wires...)
InputStatus.prototype.selectToolByButton = function(buttonID) {
  var button = $('#' + buttonID);
  if (!button.length || button.prop('disabled'))
    return;

  button.trigger('click');

  if (this._mouseInside && this.currentTool !== null) {
    $(this.canvasID).off('mousemove');
    $(this.canvasID).off('mousedown');
    $(this.canvasID).off('click');
    $(this.canvasID).on('mousemove', this.mouseMoveHandler);
    if (this.currentTool.isDraggable)
      $(this.canvasID).on('mousedown', this.mouseDownHandler);
    else
      $(this.canvasID).on('click', this.canvasClickHandler);
  }
};


InputStatus.prototype.speedChangeHandler = function(e) {
  var requestedSpeed = $('#pauseRequest').text();
  var newRequest = requestedSpeed === 'Pause' ? 'Play' : 'Pause';
  $('#pauseRequest').text(newRequest);
  this._emitEvent(Messages.SPEED_CHANGE, requestedSpeed);
};


InputStatus.prototype.clearTool = function() {
  if (this.toolName === 'query') {
    $(this.canvasID).removeClass('helpPointer');
    $(this.canvasID).addClass('pointer');
  }

  this.currentTool = null;
  this.toolWidth = 0;
  this.toolColour = '';
  $('.selected').removeClass('selected');
};


var makeHandler = function(message) {
  var m = Messages[message];

  return function(e) {
    this._emitEvent(m);
  };
};


var budgetHandler = makeHandler('BUDGET_REQUESTED');
var debugHandler = makeHandler('DEBUG_WINDOW_REQUESTED');
var disasterHandler = makeHandler('DISASTER_REQUESTED');
var evalHandler = makeHandler('EVAL_REQUESTED');
var screenshotHandler = makeHandler('SCREENSHOT_WINDOW_REQUESTED');
var settingsHandler = makeHandler('SETTINGS_WINDOW_REQUESTED');
var saveHandler = makeHandler('SAVE_REQUESTED');


export { InputStatus };

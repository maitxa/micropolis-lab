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

import { MiscUtils } from './miscUtils.js';
import { Text } from './text.js';
import { Help } from './help.js';
import { I18n } from './i18n.js';
import * as Messages from './messages.ts';

var TIMEOUT_SECS = 30;


function Notification(element, map, initialText) {
  element = MiscUtils.normaliseDOMid(element);

  this._map = map;
  this._element = $(element);
  this._timeout = null;

  this._handleClick = handleClick.bind(this);

  // The position to centre on when the link is clicked
  this._x = -1;
  this._y = -1;

  this._element.click(this._handleClick);

  // POLICY LAB: hover help ("why is this happening, and what can I do?")
  this._subject = Messages.WELCOME;
  this._help = $('#messageHelp');
  this._element.on('mouseenter', showHelp.bind(this));
  this._element.on('mouseleave', hideHelp.bind(this));
  this.close = close.bind(this);
  if (this._element.is(':visible'))
    this._element.toggle();
}


var close = function(e) {
  if (e)
    e.preventDefault();

  if (this._element.is(':visible'))
    this._element.toggle();
};


Notification.prototype._displayLink = function(text, x, y) {
  if (this._timeout !== null) {
    window.clearTimeout(this._timeout);
    this._timeout = null;
  }

  this._element.text(text);

  this._x = x;
  this._y = y;

  this._element.addClass('pointer');

  if (!this._element.is(':visible'))
    this._element.toggle();

  this._timeout = window.setTimeout(function() {this._timeout = null; this.close();}.bind(this), TIMEOUT_SECS * 1000);
};


Notification.prototype._displayText = function(text, x, y) {
  if (this._timeout !== null) {
    window.clearTimeout(this._timeout);
    this._timeout = null;
  }

  this._element.removeClass('pointer');
  this._element.text(text);
  this._x = -1;
  this._y = -1;

  if (!this._element.is(':visible'))
    this._element.toggle();

  this._timeout = window.setTimeout(function() {this._timeout = null; this.close();}.bind(this), TIMEOUT_SECS * 1000);
};


var handleClick = function(e) {
  e.preventDefault();

  if (this._x === -1 || this._y === -1)
    return;

  this._map.centreOn(this._x, this._y);
};


// POLICY LAB: build and show the help box for the current message
var escapeHTML = function(s) {
  return String(s).replace(/[&<>"]/g, function(c) {
    return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c];
  });
};

var showHelp = function() {
  var h = Help.forMessage(this._subject);
  if (h === null || !this._element.is(':visible'))
    return;

  var html = '<div class="helpTitle">' + escapeHTML(I18n.t(Text.messageText[this._subject] || '')) + '</div>' +
             '<div class="helpWhy">' + escapeHTML(h.why) + '</div>' +
             '<div class="helpFixLabel">' + I18n.t('What you can do:') + '</div><ul>' +
             h.fixes.map(function(f) { return '<li>' + escapeHTML(f) + '</li>'; }).join('') + '</ul>';
  if (this._x !== -1)
    html += '<div class="helpHint">' + I18n.t('Click the message to jump to the spot.') + '</div>';

  this._help.html(html).show();
};

var hideHelp = function() {
  this._help.hide();
};


Notification.prototype.createMessage = function(message) {
  // POLICY LAB: remember which message this is, for the hover help
  this._subject = message.subject;
  this._element.toggleClass('hasHelp', Help.forMessage(message.subject) !== null);

  if (message.hasOwnProperty('data') && message.data !== undefined && message.data.hasOwnProperty('x') && message.data.hasOwnProperty('y')) {
    this._displayLink(Text.messageText[message.subject], message.data.x, message.data.y);
    return;
  }

  this._displayText(Text.messageText[message.subject]);
};


Notification.prototype.badNews = function(message) {
  this._element.removeClass('neutral');
  this._element.removeClass('good');
  this._element.addClass('bad');
  this.createMessage(message);
};


Notification.prototype.goodNews = function(message) {
  this._element.removeClass('neutral');
  this._element.removeClass('bad');
  this._element.addClass('good');
  this.createMessage(message);
};


Notification.prototype.news = function(message) {
  this._element.removeClass('good');
  this._element.removeClass('bad');
  this._element.addClass('neutral');
  this.createMessage(message);
};


export { Notification };

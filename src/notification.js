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

// POLICY LAB v21: messages no longer disappear after 30 seconds or get pushed off by the next one. Each stays until the
// player presses "Got it"; later messages wait in a queue ("+2 more"). Disasters and crashes go to the front. After
// "Got it", the same kind of message can't come back for 3 minutes of play (time while paused doesn't count).
var SNOOZE_SECS = 180;
var MAX_QUEUE = 12;

var isUrgent = function(subject) {
  return Messages.DISASTER_MESSAGES.indexOf(subject) !== -1 || Messages.CRASHES.indexOf(subject) !== -1;
};


function Notification(element, map, initialText, playClock, stillTrue) {
  element = MiscUtils.normaliseDOMid(element);

  this._map = map;
  this._element = $(element);
  this._clock = playClock || function() { return Date.now() / 1000; };
  // asked again when a queued message comes to the front, so stale advice is dropped
  this._stillTrue = stillTrue || function() { return true; };
  this._queue = [];
  this._current = null;
  this._snoozed = {};

  this._handleClick = handleClick.bind(this);

  // The position to centre on when the link is clicked
  this._x = -1;
  this._y = -1;

  // text, "+N more" and the button
  this._element.empty();
  this._text = $('<span class="msgText"></span>');
  this._more = $('<span class="msgMore notranslate"></span>');
  this._gotIt = $('<button type="button" class="msgGotIt">Got it</button>');
  this._element.append(this._text, this._more, this._gotIt);
  this._gotIt.on('click', (function(e) {
    e.preventDefault();
    e.stopPropagation();
    this.dismiss();
  }).bind(this));
  this._text.click(this._handleClick);

  // POLICY LAB: hover help ("why is this happening, and what can I do?")
  this._subject = Messages.WELCOME;
  this._help = $('#messageHelp');
  this._text.on('mouseenter', showHelp.bind(this));
  this._text.on('mouseleave', hideHelp.bind(this));
  this.close = close.bind(this);
  I18n.onChange(this._showCount.bind(this));
  if (this._element.is(':visible'))
    this._element.toggle();
}


var close = function(e) {
  if (e)
    e.preventDefault();

  if (this._element.is(':visible'))
    this._element.toggle();
};


Notification.prototype._showCount = function() {
  var n = this._queue.length;
  this._more.text(n ? I18n.p('+{0} more', '+{0} más', n) : '').toggle(n > 0);
  this._gotIt.text(I18n.p('Got it', 'Entendido'));
};


// Put a message on screen (or in the queue)
Notification.prototype._post = function(message, tone) {
  var subject = message.subject;
  var urgent = isUrgent(subject);
  if (!urgent && this._snoozed[subject] && this._snoozed[subject] > this._clock())
    return;
  var entry = {message: message, tone: tone};
  // The same message again: just update where it points
  if (this._current && this._current.message.subject === subject) {
    this._current = entry;
    this._render();
    return;
  }
  for (var i = 0; i < this._queue.length; i++) {
    if (this._queue[i].message.subject === subject) {
      this._queue[i] = entry;
      return;
    }
  }
  if (this._current === null) {
    this._current = entry;
  } else if (urgent && !isUrgent(this._current.message.subject)) {
    this._queue.unshift(this._current);
    this._current = entry;
  } else {
    this._queue.push(entry);
    if (this._queue.length > MAX_QUEUE)
      this._queue.shift();
  }
  this._render();
};


// "Got it": hide this one, keep it away for 3 minutes of play, and show the next
Notification.prototype.dismiss = function() {
  if (this._current && !isUrgent(this._current.message.subject))
    this._snoozed[this._current.message.subject] = this._clock() + SNOOZE_SECS;
  this._current = null;
  var now = this._clock();
  while (this._queue.length) {
    var next = this._queue.shift();
    var subj = next.message.subject;
    if (isUrgent(subj) || (!(this._snoozed[subj] > now) && this._stillTrue(subj))) {
      this._current = next;
      break;
    }
  }
  hideHelp.call(this);
  if (this._current)
    this._render();
  else
    this.close();
};


// Drop messages that are no longer true (asked once a game month). Only the zone-count advice can go stale like this.
Notification.prototype.recheck = function() {
  var self = this;
  this._queue = this._queue.filter(function(e) { return self._stillTrue(e.message.subject); });
  if (this._current && !this._stillTrue(this._current.message.subject)) {
    this._current = null;
    this.dismiss();
  } else {
    this._showCount();
  }
};


Notification.prototype._render = function() {
  var entry = this._current;
  if (!entry)
    return;
  var message = entry.message;
  this._element.removeClass('neutral good bad').addClass(entry.tone);

  // remember which message this is, for the hover help
  this._subject = message.subject;
  this._element.toggleClass('hasHelp', Help.forMessage(message.subject) !== null);

  var text = Text.messageText[message.subject];
  if (message.hasOwnProperty('data') && message.data !== undefined && message.data.hasOwnProperty('x') && message.data.hasOwnProperty('y')) {
    this._x = message.data.x;
    this._y = message.data.y;
    this._element.addClass('pointer');
  } else {
    this._x = -1;
    this._y = -1;
    this._element.removeClass('pointer');
  }
  this._text.text(text);
  this._showCount();

  if (!this._element.is(':visible'))
    this._element.toggle();
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
  this._post(message, 'neutral');
};


Notification.prototype.badNews = function(message) {
  this._post(message, 'bad');
};


Notification.prototype.goodNews = function(message) {
  this._post(message, 'good');
};


Notification.prototype.news = function(message) {
  this._post(message, 'neutral');
};


export { Notification };

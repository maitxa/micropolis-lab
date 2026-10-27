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

import { SAVE_WINDOW_CLOSED } from './messages.ts';
import { ModalWindow } from './modalWindow.js';

var SaveWindow = ModalWindow(function() {
  $(saveFormID).on('submit', submit.bind(this));
});


var saveFormID = '#saveForm';
var saveOKID = '#saveOK';


var submit = function(e) {
  e.preventDefault();
  this.close();
};


SaveWindow.prototype.close = function() {
  this._toggleDisplay();
  this._emitEvent(SAVE_WINDOW_CLOSED);
};


// POLICY LAB v25: save under a name. onSave(name) returns a Promise that resolves with a status text.
SaveWindow.prototype.open = function(defaultName, onSave) {
  this._toggleDisplay();
  $('#saveName').val(defaultName || '');
  $('#saveStatus').text('');
  $('#saveDo').prop('disabled', false).off('click').on('click', function(e) {
    e.preventDefault();
    var name = $.trim($('#saveName').val()) || defaultName;
    $('#saveDo').prop('disabled', true);
    onSave(name).then(function(text) {
      $('#saveStatus').removeClass('err').text(text);
      $('#saveDo').prop('disabled', false);
      $(saveOKID).focus();
    }, function(text) {
      $('#saveStatus').addClass('err').text(text);
      $('#saveDo').prop('disabled', false);
    });
  });
  $('#saveName').off('keydown.save').on('keydown.save', function(e) {
    if (e.keyCode === 13) {
      e.preventDefault();
      $('#saveDo').click();
    }
  });
  $('#saveName').focus().select();
};


export { SaveWindow };

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

import { SCREENSHOT_LINK_CLOSED } from './messages.ts';
import { ModalWindow } from './modalWindow.js';
import { MiscUtils } from './miscUtils.js';
import { CityStore } from './cityStore.js';
import { I18n } from './i18n.js';

var ScreenshotLinkWindow = ModalWindow(function() {
  $(screenshotLinkFormID).on('submit', submit.bind(this));
});


var screenshotLinkFormID = '#screenshotLinkForm';
var screenshotLinkOKID = '#screenshotLinkOK';
var screenshotLinkID = '#screenshotLink';


ScreenshotLinkWindow.prototype.close = function() {
  this._toggleDisplay();
  this._emitEvent(SCREENSHOT_LINK_CLOSED);
};


var cancel = function(e) {
  e.preventDefault();
  this.close();
};


var submit = function(e) {
  e.preventDefault();
  this.close();
};


// POLICY LAB v34: show the picture, and save it as a PNG file or print it. fileName: e.g. "Springfield-1950.png"
ScreenshotLinkWindow.prototype.open = function(screenshotLink, fileName) {
  $('#screenshotPreview').attr('src', screenshotLink);
  $('#screenshotStatus').text('');
  var P = I18n.p;
  $('#screenshotSave').off('click').on('click', function(e) {
    e.preventDefault();
    var bin = window.atob(screenshotLink.split(',')[1]), bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++)
      bytes[i] = bin.charCodeAt(i);
    CityStore.downloadBlob(fileName || 'city.png', new Blob([bytes], {type: 'image/png'})).then(function(res) {
      $('#screenshotStatus').text(res && res.status === 'saved' ? P('Saved.', 'Guardada.') : '');
    }, function(err) {
      $('#screenshotStatus').text(err && err.code === 'declined' ? '' : P('Could not save the picture here.', 'No se pudo guardar la imagen aquí.'));
    });
  });
  $('#screenshotPrint').off('click').on('click', function(e) {
    e.preventDefault();
    var area = $('#printArea');
    if (!area.parent().is('body'))
      area.appendTo('body');   // the print rules show only the body's own child #printArea
    area.empty().append($('<img alt="">').attr('src', screenshotLink));
    $('body').addClass('plPrinting');
    var done = function() { $('body').removeClass('plPrinting'); area.empty(); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    try {
      window.print();
    } catch (err) {
      done();
      $('#screenshotStatus').text(P('Printing isn\'t allowed here: save the picture and print the file.', 'Aquí no se puede imprimir: guarda la imagen e imprime el archivo.'));
    }
    window.setTimeout(done, 60000);
  });
  this._toggleDisplay();
};


export { ScreenshotLinkWindow };

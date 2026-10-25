/* Policy Lab additions to micropolisJS (2026).
 *
 * This code is released under the GNU GPL v3, with some additional terms, like the rest of micropolisJS.
 * Modified version: NOT the original micropolisJS / Micropolis.
 *
 * The "City data" window: indicators for the three zone types, jobs, neighbourhood quality, power and money.
 */

import $ from "jquery";

import { CITY_DATA_WINDOW_CLOSED } from './messages.ts';
import { ModalWindow } from './modalWindow.js';
import { Report } from './report.js';

var CityDataWindow = ModalWindow(function() {
  $('#cityDataButtons').on('submit', submit.bind(this));
});


CityDataWindow.prototype.close = function() {
  this._emitEvent(CITY_DATA_WINDOW_CLOSED);
  this._toggleDisplay();
};


var submit = function(e) {
  e.preventDefault();
  this.close();
};


CityDataWindow.prototype.open = function(simulation) {
  $('#cityDataContent').html(Report.cityData(simulation));
  this._toggleDisplay();
};


export { CityDataWindow };

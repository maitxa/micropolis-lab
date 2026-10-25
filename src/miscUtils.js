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

var clamp = function(value, min, max) {
  if (value < min)
    return min;
  if (value > max)
    return max;

  return value;
};


var makeConstantDescriptor = function(value) {
  return {configurable: false, enumerable: false,
          writeable: false, value: value};
};


var normaliseDOMid = function(id) {
  return (id[0] !== '#' ? '#' : '') + id;
};


var reflectEvent = function(message, value) {
  this._emitEvent(message, value);
};


// POLICY LAB: format numbers with thousands separators, e.g. 200000 -> "200,000"
var formatNumber = function(n) {
  if (typeof n !== 'number')
    n = Number(n);
  if (!isFinite(n))
    return String(n);
  return Math.round(n).toLocaleString('en-US');
};

// ... and money: -1500 -> "-$1,500"
var formatMoney = function(n) {
  n = Number(n);
  return (n < 0 ? '-$' : '$') + formatNumber(Math.abs(n));
};


var MiscUtils = {
  clamp: clamp,
  formatMoney: formatMoney,
  formatNumber: formatNumber,
  makeConstantDescriptor: makeConstantDescriptor,
  normaliseDOMid: normaliseDOMid,
  reflectEvent: reflectEvent
};


export { MiscUtils };

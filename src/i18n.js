/* Policy Lab additions to micropolisJS (2026).
 *
 * This code is released under the GNU GPL v3, with some additional terms, like the rest of micropolisJS.
 * Modified version: NOT the original micropolisJS / Micropolis.
 *
 * English / Spanish (U.S.) interface.
 *
 * How it works:
 *  - The game is written in English. src/i18n-es.js maps each English text to its Spanish version.
 *  - When Spanish is on, any piece of text on the page that exactly matches an English entry (ignoring extra spaces)
 *    is replaced by its Spanish version. A watcher (MutationObserver) does the same for text the game changes while
 *    it runs (messages, labels, windows), so most of the game's code did not need to change.
 *  - Text that is built from pieces (for example "Undone: $100 refunded") is translated where it is built, with
 *    I18n.t('Undone: {0} refunded', amount) or with both versions side by side: I18n.p('English {0}', 'Español {0}', x).
 *  - Anything inside an element with class "notranslate" (such as the city's name) is left alone.
 *  - Switching back to English reverses the replacement.
 */

import { ES } from './i18n-es.js';

var STORAGE_KEY = 'policyLabLanguage';
var LANGS = ['en', 'es'];

var lang = 'en';
var listeners = [];

// English -> Spanish, with keys normalised. Setup options tagged " (original)" also get an untagged entry, because the
// setup screen shows the tag as a separate "1989" badge.
var toES = {};
var toEN = {};

var norm = function(s) {
  return String(s).replace(/\s+/g, ' ').trim();
};

Object.keys(ES).forEach(function(en) {
  var k = norm(en), v = ES[en];
  toES[k] = v;
  var m = /^(.*) \(original\)$/.exec(k);
  var mv = /^(.*) \(original\)$/.exec(v);
  if (m && mv && toES[m[1]] === undefined)
    toES[m[1]] = mv[1];
});
Object.keys(toES).forEach(function(en) {
  var es = norm(toES[en]);
  if (toEN[es] === undefined && es !== en)
    toEN[es] = en;
});


var fill = function(s, args) {
  return s.replace(/\{(\d+)\}/g, function(all, n) {
    return args[n] !== undefined ? args[n] : all;
  });
};

// Translate an English text (looked up in the dictionary), filling in {0}, {1}... with the extra arguments
var t = function(en) {
  var args = Array.prototype.slice.call(arguments, 1);
  var s = en;
  if (lang === 'es') {
    var es = toES[norm(en)];
    if (es !== undefined)
      s = es;
  }
  return fill(s, args);
};

// Pick between an English and a Spanish text given side by side
var p = function(en, es) {
  var args = Array.prototype.slice.call(arguments, 2);
  return fill(lang === 'es' ? es : en, args);
};


// ---- Translating the page ----

var ATTRIBUTES = ['title', 'aria-label', 'placeholder', 'alt'];
var lastSet = new WeakMap();  // node -> language and text this module last wrote into it (so we don't loop)

var skip = function(node) {
  var el = node.nodeType === 1 ? node : node.parentNode;
  while (el && el.nodeType === 1) {
    var tag = el.tagName;
    if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TEXTAREA' || (el.classList && el.classList.contains('notranslate')))
      return true;
    el = el.parentNode;
  }
  return false;
};

// Return the translation of a text for the current language, keeping its surrounding spaces, or null if none
var convert = function(raw) {
  var key = norm(raw);
  if (!key)
    return null;
  var table = lang === 'es' ? toES : toEN;
  var out = table[key];
  if (out === undefined)
    return null;
  var lead = /^\s*/.exec(raw)[0], trail = /\s*$/.exec(raw)[0];
  return lead + out + trail;
};

var translateText = function(node) {
  // Skip text this module itself just wrote in the current language
  if (lastSet.get(node) === lang + '|' + node.nodeValue)
    return;
  var out = convert(node.nodeValue);
  if (out !== null && out !== node.nodeValue) {
    node.nodeValue = out;
    lastSet.set(node, lang + '|' + out);
  }
};

var translateAttributes = function(el) {
  ATTRIBUTES.forEach(function(a) {
    if (!el.hasAttribute(a))
      return;
    var out = convert(el.getAttribute(a));
    if (out !== null && out !== el.getAttribute(a))
      el.setAttribute(a, out);
  });
  if (el.tagName === 'INPUT' && (el.type === 'submit' || el.type === 'button')) {
    var v = convert(el.value);
    if (v !== null && v !== el.value)
      el.value = v;
  }
};

// An element can carry its own Spanish text in a data-es attribute, for words whose translation depends on where they
// appear (e.g. the "Fire" tool is "Bomberos", but the "Fire" disaster is "Incendio").
var translateOwn = function(el) {
  if (!el.hasAttribute('data-en'))
    el.setAttribute('data-en', el.textContent);
  var want = lang === 'es' ? el.getAttribute('data-es') : el.getAttribute('data-en');
  if (el.textContent !== want)
    el.textContent = want;
};

var translateTree = function(root) {
  if (!root || skip(root))
    return;
  if (root.nodeType === 3) {
    if (root.parentNode && root.parentNode.nodeType === 1 && root.parentNode.hasAttribute('data-es'))
      translateOwn(root.parentNode);
    else
      translateText(root);
    return;
  }
  if (root.nodeType !== 1)
    return;
  translateAttributes(root);
  if (root.hasAttribute('data-es')) {
    translateOwn(root);
    return;
  }
  var walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode: function(n) {
      if (n.nodeType === 1) {
        var tag = n.tagName;
        if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TEXTAREA' || n.classList.contains('notranslate'))
          return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  var n;
  while ((n = walker.nextNode())) {
    if (n.nodeType === 3) {
      if (!n.parentNode.hasAttribute('data-es'))
        translateText(n);
    } else {
      translateAttributes(n);
      if (n.hasAttribute('data-es'))
        translateOwn(n);
    }
  }
};

var observer = null;

var startObserver = function() {
  if (observer || typeof MutationObserver === 'undefined')
    return;
  observer = new MutationObserver(function(records) {
    records.forEach(function(r) {
      if (r.type === 'childList') {
        for (var i = 0; i < r.addedNodes.length; i++)
          translateTree(r.addedNodes[i]);
      } else if (r.type === 'characterData') {
        translateTree(r.target);
      } else if (r.type === 'attributes') {
        if (!skip(r.target))
          translateAttributes(r.target);
      }
    });
  });
  observer.observe(document.body, {childList: true, subtree: true, characterData: true, attributes: true,
                                   attributeFilter: ATTRIBUTES.concat(['value'])});
};


// ---- Choosing the language ----

var readSaved = function() {
  try {
    var v = window.localStorage.getItem(STORAGE_KEY);
    if (LANGS.indexOf(v) !== -1)
      return v;
  } catch (e) {
    // storage unavailable: fall through
  }
  var nav = (navigator.language || 'en').toLowerCase();
  return nav.indexOf('es') === 0 ? 'es' : 'en';
};

var updateSwitch = function() {
  var buttons = document.querySelectorAll('#langSwitch button[data-lang]');
  for (var i = 0; i < buttons.length; i++)
    buttons[i].setAttribute('aria-pressed', buttons[i].getAttribute('data-lang') === lang ? 'true' : 'false');
};

var setLang = function(newLang) {
  if (LANGS.indexOf(newLang) === -1)
    return;
  var changed = newLang !== lang;
  lang = newLang;
  try {
    window.localStorage.setItem(STORAGE_KEY, lang);
  } catch (e) {
    // not saved: fine
  }
  document.documentElement.lang = lang === 'es' ? 'es-US' : 'en';
  document.title = t('Micropolis Policy Lab');
  translateTree(document.body);
  updateSwitch();
  if (changed)
    listeners.forEach(function(cb) { cb(lang); });
};

var init = function() {
  startObserver();
  var buttons = document.querySelectorAll('#langSwitch button[data-lang]');
  for (var i = 0; i < buttons.length; i++) {
    buttons[i].addEventListener('click', function(e) {
      e.preventDefault();
      setLang(this.getAttribute('data-lang'));
    });
  }
  setLang(readSaved());
};


var I18n = {
  t: t,
  p: p,
  init: init,
  setLang: setLang,
  lang: function() { return lang; },
  onChange: function(cb) { listeners.push(cb); },
  has: function(en) { return toES[norm(en)] !== undefined; },
  // For tests: every dictionary entry
  entries: function() { return toES; }
};


export { I18n };

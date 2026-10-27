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

import { Config } from './config.js';
import { Game } from './game.js';
import { I18n } from './i18n.js';
import { MapGenerator } from './mapGenerator.js';
import { Policy } from './policy.js';
import { Presets } from './presets.js';
import { Simulation } from './simulation.js';
import { SplashCanvas } from './splashCanvas.js';
import { Storage } from './storage.js';
import { CityStore } from './cityStore.js';
import { CityPanels } from './cityPanels.js';

/*
 *
 * The SplashScreen is the first screen the player will see on launch. It is responsible for map generation,
 * placing UI on screen to allow the player to select a map or load a game, and finally launching the game.
 * This should not be called until the tiles and sprites have been loaded.
 *
 */

var onresize = null;


// If the window is initially too small, try and relaunch if it gets bigger
var makeResizeListener = function(tileSet, spriteSheet) {
  return function(tileSet, spriteSheet, e) {
    $(window).off('resize');
    var s = new SplashScreen(tileSet, spriteSheet);
  }.bind(null, tileSet, spriteSheet);
};


function SplashScreen(tileSet, snowTileSet, spriteSheet) {
  // We don't launch the game if the screen is too small, however, we should retain the right to do so
  // should the situation change...
  if ($('#tooSmall').is(':visible')) {
    onresize = makeResizeListener(tileSet, spriteSheet);
    $(window).on('resize', onresize);
    return;
  }

  this.tileSet = tileSet;
  this.snowTileSet = snowTileSet;
  this.spriteSheet = spriteSheet;
  this.map = MapGenerator();

  // Set up listeners on buttons. When play is clicked, we will move on to get the player's desired
  // difficulty level and city name before launching the game properly
  $('#splashGenerate').click(regenerateMap.bind(this));
  $('#splashPlay').click(acquireNameAndDifficulty.bind(this));
  $('#splashLoad').click(handleLoad.bind(this));
  // POLICY LAB v25: the scoreboard
  $('#splashScoreboard').click(function(e) { e.preventDefault(); CityPanels.openScoreboard(null, null); });

  // Conditionally enable load/save buttons
  // POLICY LAB v25: cities are saved in the browser's database (cityStore.js); the old single save slot is copied there
  // once, and "Load game" lists every saved city
  $('#saveRequest').prop('disabled', false);
  $('#splashLoad').prop('disabled', true);
  var self = this;
  CityStore.available().then(function(ok) {
    if (!ok) {
      $('#saveRequest').prop('disabled', true);
      return;
    }
    migrateOldSave().then(function() { return CityStore.listCities(); }).then(function(list) {
      $('#splashLoad').prop('disabled', list.length === 0);
    });
    // A city chosen in Saved cities or Go back in time: open it straight away
    CityStore.takeResume().then(function(rec) {
      if (rec && rec.data)
        launchSaved.call(self, Storage.parse(rec.data));
    });
  });

  // Paint the minimap
  this.splashCanvas = new SplashCanvas('splashContainer', tileSet);
  this.splashCanvas.paint(this.map);

  // Let's get some bits on screen!
  $('.awaitGeneration').toggle();
  $('#splashPlay').focus();
}


// Generate a new map at the user's request, and paint it
var regenerateMap = function(e) {
  e.preventDefault();

  this.map = MapGenerator();
  this.splashCanvas.paint(this.map);
};


// POLICY LAB v25: copy the original single save slot (localStorage) into the saved cities, once
var migrateOldSave = function() {
  var flag = 'policyLabMigratedSave';
  var old = null;
  try {
    if (window.localStorage.getItem(flag))
      return Promise.resolve();
    old = window.localStorage.getItem(Storage.KEY);
  } catch (e) {
    return Promise.resolve();
  }
  if (!old)
    return Promise.resolve();
  var game;
  try {
    game = Storage.parse(old);
  } catch (e) {
    return Promise.resolve();
  }
  var cityId = (game.policyLab && game.policyLab.cityId) || CityStore.newId();
  var year = Math.floor((game._cityTime || 0) / 48) + 1900;
  return CityStore.saveCity({cityId: cityId, name: (game.name || 'City') + ' (saved before v25)', cityName: game.name,
                             year: year, score: game.cityScore}, old).then(function() {
    try { window.localStorage.setItem(flag, '1'); } catch (e) {}
  }, function() {});
};


// POLICY LAB v25: "Load game" now opens the list of saved cities; choosing one reloads the page and opens it
var handleLoad = function(e) {
  e.preventDefault();
  CityPanels.openSavedCities();
};


// Launches a saved game. We won't return from here
var launchSaved = function(savedGame) {
  // Remove installed event listeners
  $('#splashLoad').off('click');
  $('#splashGenerate').off('click');
  $('#splashPlay').off('click');

  // Hide the splashscreen UI
  $('#splash').toggle();

  // Launch
  var g = new Game(savedGame, this.tileSet, this.snowTileSet, this.spriteSheet, Simulation.LEVEL_EASY, name);
};


// After a map has been selected, call this function to display a form asking the user for
// a city name and difficulty level.
var acquireNameAndDifficulty = function(e) {
  e.preventDefault();

  // Remove the initial event listeners
  $('#splashLoad').off('click');
  $('#splashGenerate').off('click');
  $('#splashPlay').off('click');

  // Get rid of the initial splash screen
  $('#splash').toggle();

  // As a convenience, the city name is not mandatory in debug mode
  if (Config.debug)
    $('#nameForm').removeAttr('required');

  // When the form is submitted, we'll be ready to launch the game
  $('#playForm').submit(play.bind(this));

  // POLICY LAB: "Reset to original rules" button, and presets
  $('#pl_reset').click(resetPolicyForm);
  $('#pl_defaults').click({rules: Policy.DEFAULTS}, resetPolicyForm);
  $('#pl_preset').on('change', applyPreset);
  Presets.fields.forEach(function(f) {
    $('#pl_' + f).on('change', markCustom);
  });
  showPresetNote('original');
  buildChips();
  // POLICY LAB: redraw the preset description when the language changes
  I18n.onChange(function() {
    if ($('#start').is(':visible'))
      showPresetNote($('#pl_preset').val());
  });

  // Display the name and difficulty form
  $('#start').toggle();
  $('#nameForm').focus();
};


// This function should be called after the name/difficulty form has been submitted. The game will now be launched
// with the map selected earlier.
var play = function(e) {
  e.preventDefault();

  // As usual, uninstall event listeners, and hide the UI
  $('#playForm').off('submit');
  $('#start').toggle();

  // What values did the player specify?
  var difficulty = $('.difficulty:checked').val() - 0;
  var name = $('#nameForm').val();

  // POLICY LAB: read the setup screen before the simulation starts
  var choices = readPolicyForm();
  Policy.set(choices.policy);
  Policy.presetName = currentPresetLabel();
  // The green belt is centred on the middle of the map, where the city starts
  Policy.greenBeltCentre = {x: Math.floor(this.map.width / 2), y: Math.floor(this.map.height / 2)};
  Policy.builtHospitals = {};
  Policy.bigParks = {};
  Policy.cityId = CityStore.newId();
  Policy.history = {months: [], years: []};

  // Launch a new game
  var g = new Game(this.map, this.tileSet, this.snowTileSet, this.spriteSheet, difficulty, name);

  // POLICY LAB: starting social services funding
  g.simulation.budget.socialPercent = choices.socialStart / 100;
  g.simulation.budget.housingPercent = choices.housingStart / 100;
  g.simulation.budget.setTax(choices.taxStart);
  g.simulation.budget.updateFundEffects();
};


// POLICY LAB: helpers for the setup screen
var numberFields = ['povertyCrime', 'densityCrime', 'policeStrength', 'socialCrime', 'taxGrowth',
                    'regulationGrowth', 'incentiveGrowth', 'sewagePollution', 'walkability', 'densityCap', 'electionCycle',
                    'pedestrian', 'greenBelt', 'healthAffects', 'parksCrime', 'waterfront', 'taxByValue', 'commute'];
var textFields = ['regulation', 'transport', 'incentives', 'parks', 'zoning', 'growthModel', 'bridges'];

var readPolicyForm = function() {
  var policy = {};
  numberFields.forEach(function(key) {
    policy[key] = parseFloat($('#pl_' + key).val());
  });
  policy.nuclearAllowed = $('#pl_nuclearAllowed').val() === 'true';
  textFields.forEach(function(key) {
    policy[key] = $('#pl_' + key).val();
  });
  return {policy: policy, socialStart: parseFloat($('#pl_socialStart').val()) || 0,
          housingStart: parseFloat($('#pl_housingStart').val()) || 0,
          taxStart: parseInt($('#pl_taxStart').val(), 10) || 7};
};


// POLICY LAB: presets fill in laws and the starting budget (never the world model)
var basedOn = null;  // the preset the current settings started from

var escapeHTML = function(s) {
  return String(s).replace(/[&<>"]/g, function(c) {
    return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c];
  });
};

var showPresetNote = function(name) {
  var p = Presets.all[name];
  if (!p) {
    $('#presetNote').html('<p>' + (basedOn ? I18n.t('Custom settings, starting from {0}.',
                                                    '<b>' + escapeHTML(I18n.t(Presets.all[basedOn].label)) + '</b>')
                                         : I18n.t('Custom settings') + '.') + '</p>');
    return;
  }
  var html = '<p>' + escapeHTML(I18n.p(p.note, p.noteEs || p.note)) + '</p>';
  if (p.sources.length)
    html += '<p class="presetSources">' + I18n.t('Based on:') + ' ' + p.sources.map(function(s) {
      return '<a href="' + s[1] + '" target="_blank" rel="noopener">' + escapeHTML(s[0]) + '</a>';
    }).join(' &middot; ') + '</p>';
  if (name !== 'original')
    html += '<p class="presetCaveat">' + escapeHTML(I18n.p(Presets.commonNote, Presets.commonNoteEs)) + '</p>';
  $('#presetNote').html(html);
};

var applyPreset = function() {
  var name = $('#pl_preset').val();
  var p = Presets.all[name];
  if (!p) {
    showPresetNote(name);
    return;
  }
  basedOn = name;
  Object.keys(p.values).forEach(function(f) {
    $('#pl_' + f).val(p.values[f]);
  });
  showPresetNote(name);
  refreshChips();
};

var markCustom = function() {
  if ($('#pl_preset').val() !== 'custom') {
    basedOn = $('#pl_preset').val();
    $('#pl_preset').val('custom');
    showPresetNote('custom');
    refreshChips();
  }
};


// POLICY LAB: show each setup question's options as clickable chips. The <select> stays in the page (hidden) and remains
// the single source of truth, so presets, Reset and the game's logic keep working unchanged.
var chipsBuilt = false;

var buildChips = function() {
  if (chipsBuilt)
    return;
  chipsBuilt = true;

  $('#policySetup select').each(function() {
    var select = $(this);
    var box = $('<div class="chips" role="group"></div>');
    box.attr('aria-label', select.closest('label').find('span').first().text());

    select.find('option').each(function() {
      var option = $(this);
      var text = option.text();
      var isOriginal = /\(original\)/.test(text);
      text = text.replace(/\s*\(original\)/, '');
      var chip = $('<button type="button" class="chip"></button>');
      chip.attr('data-value', option.val());
      chip.append(document.createTextNode(text));
      if (isOriginal)
        chip.append('<span class="orig" title="The setting used by the original 1989 game">1989</span>');
      chip.on('click', function(e) {
        e.preventDefault();
        select.val(option.val()).trigger('change');
        refreshChips();
      });
      box.append(chip);
    });

    select.addClass('chipped').attr('tabindex', '-1').after(box);
  });

  refreshChips();
};

var refreshChips = function() {
  $('#policySetup select.chipped').each(function() {
    var value = $(this).val();
    $(this).next('.chips').find('.chip').each(function() {
      $(this).attr('aria-pressed', $(this).attr('data-value') === value ? 'true' : 'false');
    });
  });
};

var currentPresetLabel = function() {
  var name = $('#pl_preset').val();
  if (Presets.all[name])
    return Presets.all[name].label;
  return 'Custom' + (basedOn && Presets.all[basedOn] ? ' (starting from ' + Presets.all[basedOn].label + ')' : '');
};


var resetPolicyForm = function(e) {
  if (e)
    e.preventDefault();
  // POLICY LAB v25: "Reset to the original rules" means the 1989 rules (the defaults now differ in a few questions);
  // the "Policy Lab defaults" button passes the defaults instead
  var rules = (e && e.data && e.data.rules) || Policy.ORIGINAL;
  numberFields.forEach(function(key) {
    $('#pl_' + key).val(String(rules[key]));
  });
  $('#pl_nuclearAllowed').val('true');
  textFields.forEach(function(key) {
    $('#pl_' + key).val(rules[key]);
  });
  $('#pl_socialStart').val('0');
  $('#pl_housingStart').val('0');
  $('#pl_taxStart').val('7');
  $('#pl_preset').val('original');
  showPresetNote('original');
  refreshChips();
};


export { SplashScreen };

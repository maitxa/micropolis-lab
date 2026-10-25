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

import { BaseTool } from './baseTool.js';
import { BudgetWindow } from './budgetWindow.js';
import { Config } from './config.js';
import { CongratsWindow } from './congratsWindow.js';
import { DebugWindow } from './debugWindow.js';
import { DisasterWindow } from './disasterWindow.js';
import { EvaluationWindow } from './evaluationWindow.js';
import { GameCanvas } from './gameCanvas.js';
import { GameMap } from './gameMap.js';
import { InfoBar } from './infoBar.js';
import { InputStatus } from './inputStatus.js';
import * as Messages from './messages.ts';
import { MonsterTV } from './monsterTV.js';
import { NagWindow } from './nagWindow.js';
import { Policy } from './policy.js';
import { Notification } from './notification.js';
import { QueryWindow } from './queryWindow.js';
import { Random } from './random.ts';
import { RCI } from './rci.js';
import { SaveWindow } from './saveWindow.js';
import { ScreenshotLinkWindow } from './screenshotLinkWindow.js';
import { ScreenshotWindow } from './screenshotWindow.js';
import { SettingsWindow } from './settingsWindow.js';
import { Simulation } from './simulation.js';
import { Storage } from './storage.js';
import { Text } from './text.js';
import { TouchWarnWindow } from './touchWarnWindow.js';
import { MiscUtils } from './miscUtils.js';
import * as TileValues from './tileValues.ts';
import { CityDataWindow } from './cityDataWindow.js';
import { I18n } from './i18n.js';
import { Advisor } from './advisor.js';
import { Panels } from './panels.js';
import { Reach } from './reach.js';

var disasterTimeout = 20 * 1000;


function Game(gameMap, tileSet, snowTileSet, spriteSheet, difficulty, name) {
  difficulty = difficulty || 0;
  var savedGame;

  if (!gameMap.isSavedGame) {
    this.gameMap = gameMap;
    savedGame = null;
  } else {
    this.gameMap = new GameMap(120, 100);
    savedGame = gameMap;
  }

  this.tileSet = tileSet;
  this.snowTileSet = snowTileSet;
  this.defaultSpeed = Simulation.SPEED_MED;
  this.simulation = new Simulation(this.gameMap, difficulty, this.defaultSpeed, savedGame);

  this.name = name || 'MyTown';
  this.everClicked = false;

  if (savedGame)
    this.load(savedGame);

  this.rci = new RCI('RCIContainer', this.simulation);

  // Note: must init canvas before inputStatus
  this.gameCanvas = new GameCanvas('canvasContainer');
  this.gameCanvas.init(this.gameMap, this.tileSet, spriteSheet);
  // POLICY LAB: sharper graphics on high-resolution screens, and zoom
  this.gameCanvas.setBaseGraphics(this.tileSet, this.snowTileSet, spriteSheet);
  this.inputStatus = new InputStatus(this.gameMap, tileSet.tileWidth);

  this.dialogOpen = false;
  this._openWindow = null;
  this.mouse = null;
  this.lastCoord = null;
  this.simNeededBudget = false;
  this.isPaused = false;
  this.lastBadMessageTime = null;

  var self = this;
  if (!this.everClicked) {
    this.nagger = window.setTimeout(function() {
      self.dialogOpen = true;
      self._openWindow = 'nagWindow';
      self.nagWindow.open();
    }, 30 * 60 * 1000);

    $('.nag').each(function() {
      $(this).click(function(e) {
        if (self.nagger !== null) {
          window.clearTimeout(self.nagger);
        self.nagger = null;
        self.everClicked = true;
      }

      return true;
      });
    });
  }

  // Initialise monsterTV
  this.monsterTV = new MonsterTV(this.gameMap, tileSet, spriteSheet, this.gameCanvas.animationManager);

  var opacityLayerID = 'opaque';

  this.genericDialogClosure = genericDialogClosure.bind(this);

  // Hook up listeners to open/close evaluation window
  this.handleEvalRequest = makeWindowOpenHandler('eval', function() {
    // POLICY LAB: the simulation is passed too, for the "Your policies at work" report
    return [this.simulation.evaluation, this.simulation];
  }.bind(this));

  // POLICY LAB: City data window
  this.handleCityDataRequest = makeWindowOpenHandler('cityData', function() {
    return [this.simulation];
  }.bind(this));
  this.cityDataWindow = new CityDataWindow(opacityLayerID, 'cityDataWindow');
  this.cityDataWindow.addEventListener(Messages.CITY_DATA_WINDOW_CLOSED, this.genericDialogClosure);
  this.inputStatus.addEventListener(Messages.CITY_DATA_REQUESTED, this.handleCityDataRequest.bind(this));

  this.evalWindow = new EvaluationWindow(opacityLayerID, 'evalWindow');
  this.evalWindow.addEventListener(Messages.EVAL_WINDOW_CLOSED, this.genericDialogClosure);

  // POLICY LAB: when the language changes, redraw the open report window and the election notice
  I18n.onChange((function() {
    if (this.dialogOpen && (this._openWindow === 'cityDataWindow' || this._openWindow === 'evalWindow'))
      this[this._openWindow].refresh();
    this.updateElectionInfo(this.simulation.getDate());
  }).bind(this));
  this.inputStatus.addEventListener(Messages.EVAL_REQUESTED, this.handleEvalRequest.bind(this));

  // ... and similarly for the budget window
  this.handleBudgetRequest = makeWindowOpenHandler('budget', function() {
    var budgetData = {
      roadMaintenanceBudget: this.simulation.budget.roadMaintenanceBudget,
      roadRate: Math.floor(this.simulation.budget.roadPercent * 100),
      fireMaintenanceBudget: this.simulation.budget.fireMaintenanceBudget,
      fireRate: Math.floor(this.simulation.budget.firePercent * 100),
      policeMaintenanceBudget: this.simulation.budget.policeMaintenanceBudget,
      policeRate: Math.floor(this.simulation.budget.policePercent * 100),
      // POLICY LAB: social services, and whether this is an election year
      socialMaintenanceBudget: this.simulation.budget.socialMaintenanceBudget,
      socialRate: Math.round(this.simulation.budget.socialPercent * 100),
      housingMaintenanceBudget: this.simulation.budget.housingMaintenanceBudget,
      housingRate: Math.round(this.simulation.budget.housingPercent * 100),
      utilityCost: this.simulation.budget.utilityCost || 0,
      locked: !this.simNeededBudget && !Policy.isBudgetYear(this.simulation.getDate().year),
      nextBudgetYear: Policy.nextBudgetYear(this.simulation.getDate().year),
      emergency: this.simNeededBudget && !Policy.isBudgetYear(this.simulation.getDate().year),
      taxRate: this.simulation.budget.cityTax,
      totalFunds: this.simulation.budget.totalFunds,
      taxesCollected: this.simulation.budget.taxFund
    };

    return [budgetData];
  }.bind(this));

  this.budgetWindow = new BudgetWindow(opacityLayerID, 'budget');
  this.budgetWindow.addEventListener(Messages.BUDGET_WINDOW_CLOSED, this.handleBudgetWindowClosure.bind(this));
  this.inputStatus.addEventListener(Messages.BUDGET_REQUESTED, this.handleBudgetRequest.bind(this));

  // ... and also the disaster window
  this.disasterWindow = new DisasterWindow(opacityLayerID, 'disasterWindow');
  this.disasterWindow.addEventListener(Messages.DISASTER_WINDOW_CLOSED, this.handleDisasterWindowClosure.bind(this));
  this.inputStatus.addEventListener(Messages.DISASTER_REQUESTED, this.handleDisasterRequest.bind(this));

  // ... the debug window
  this.debugWindow = new DebugWindow(opacityLayerID, 'debugWindow');
  this.debugWindow.addEventListener(Messages.DEBUG_WINDOW_CLOSED, this.handleDebugWindowClosure.bind(this));
  this.inputStatus.addEventListener(Messages.DEBUG_WINDOW_REQUESTED, this.handleDebugRequest.bind(this));

  // ... the settings window
  this.handleSettingsRequest = makeWindowOpenHandler('settings', function() {
    return [{autoBudget: this.simulation.budget.autoBudget, autoBulldoze: BaseTool.getAutoBulldoze(),
             speed: this.defaultSpeed, disasters: this.simulation.disasterManager.disastersEnabled}];
  }.bind(this));
  this.settingsWindow = new SettingsWindow(opacityLayerID, 'settingsWindow');
  this.settingsWindow.addEventListener(Messages.SETTINGS_WINDOW_CLOSED, this.handleSettingsWindowClosure.bind(this));
  this.inputStatus.addEventListener(Messages.SETTINGS_WINDOW_REQUESTED, this.handleSettingsRequest.bind(this));

  // ... the screenshot window
  this.screenshotWindow = new ScreenshotWindow(opacityLayerID, 'screenshotWindow');
  this.screenshotWindow.addEventListener(Messages.SCREENSHOT_WINDOW_CLOSED, this.handleScreenshotWindowClosure.bind(this));
  this.inputStatus.addEventListener(Messages.SCREENSHOT_WINDOW_REQUESTED, this.handleScreenshotRequest.bind(this));

  // ... the screenshot link window
  this.screenshotLinkWindow = new ScreenshotLinkWindow(opacityLayerID, 'screenshotLinkWindow');
  this.screenshotLinkWindow.addEventListener(Messages.SCREENSHOT_LINK_CLOSED, this.genericDialogClosure);

  // ... the save confirmation window
  this.saveWindow = new SaveWindow(opacityLayerID, 'saveWindow');
  this.saveWindow.addEventListener(Messages.SAVE_WINDOW_CLOSED, this.genericDialogClosure);

  // ... the nag confirmation window
  this.nagWindow = new NagWindow(opacityLayerID, 'nagWindow');
  this.nagWindow.addEventListener(Messages.NAG_WINDOW_CLOSED, this.genericDialogClosure);

  // ... the touch warn window
  this.touchWindow = new TouchWarnWindow(opacityLayerID, 'touchWarnWindow');
  this.touchWindow.addEventListener(Messages.TOUCH_WINDOW_CLOSED, this.genericDialogClosure);

  // ... and finally the query window
  this.queryWindow = new QueryWindow(opacityLayerID, 'queryWindow');
  this.queryWindow.addEventListener(Messages.QUERY_WINDOW_CLOSED, this.genericDialogClosure);
  this.inputStatus.addEventListener(Messages.QUERY_WINDOW_NEEDED, this.handleQueryRequest.bind(this));

  // Listen for clicks on the save button
  this.inputStatus.addEventListener(Messages.SAVE_REQUESTED, this.handleSave.bind(this));

  // Listen for front end messages
  this.simulation.addEventListener(Messages.FRONT_END_MESSAGE, this.processFrontEndMessage.bind(this));

  // Listen for budget messages
  this.simulation.addEventListener(Messages.BUDGET_NEEDED, this.handleMandatoryBudget.bind(this));

  // Listen for tool clicks
  this.inputStatus.addEventListener(Messages.TOOL_CLICKED, this.handleTool.bind(this));

  // POLICY LAB: straight lines, undo and keyboard help
  this.inputStatus.addEventListener(Messages.TOOL_LINE, this.handleToolLine.bind(this));
  this.inputStatus.addEventListener(Messages.UNDO_REQUESTED, this.handleUndo.bind(this));
  this.inputStatus.addEventListener(Messages.KEYS_HELP_REQUESTED, this.toggleKeysHelp.bind(this));
  this.inputStatus._tileWidthFn = function() { return this.gameCanvas._tileSet.tileWidth; }.bind(this);
  this.inputStatus.addEventListener(Messages.ZOOM_REQUESTED, function(step) {
    if (this.dialogOpen)
      return;
    this.gameCanvas.setZoom(this.gameCanvas.getZoom() + step);
    var z = this.gameCanvas.getZoom();
    $('#zoomLevel').text(z === 1 ? '100%' : (z * 100) + '%');
    $('#zoomOut').prop('disabled', z <= 1);
    $('#zoomIn').prop('disabled', z >= 3);
  }.bind(this));
  $('#zoomOut').prop('disabled', true);
  $('#keysHelpClose').click(function(e) { e.preventDefault(); $('#keysHelp').hide(); });
  $('#undoRequest').prop('disabled', true);

  // And pauses
  this.inputStatus.addEventListener(Messages.SPEED_CHANGE, this.handlePause.bind(this));

  // And date changes
  // XXX Not yet activated
  //this.simulation.addEventListener(Messages.DATE_UPDATED, this.onDateChange.bind(this));

  this.infoBar = InfoBar('cclass', 'population', 'score', 'funds', 'date', 'name');
  var initialValues = {
    classification: this.simulation.evaluation.cityClass,
    population: this.simulation.evaluation.cityPop,
    score: this.simulation.evaluation.cityScore,
    funds: this.simulation.budget.totalFunds,
    date: this.simulation.getDate(),
    name: this.name
  };
  this.infoBar(this.simulation, initialValues);

  // POLICY LAB: apply the laws to the interface, and show election information
  this.applyPolicyToInterface();
  this.updateElectionInfo(this.simulation.getDate());
  this.simulation.addEventListener(Messages.DATE_UPDATED, this.updateElectionInfo.bind(this));

  this._notificationBar = new Notification('#notifications', this.gameCanvas, Text.messageText[Messages.WELCOME]);

  // POLICY LAB: the city advisor runs once a game month
  this._advice = [];
  this._advisorMonths = 0;
  this._lastAdviceShown = null;
  $('#advisorToggle').on('click', function(e) {
    e.preventDefault();
    var open = $('#advisor').toggleClass('collapsed').hasClass('collapsed') === false;
    $('#advisorToggle').attr('aria-expanded', open ? 'true' : 'false');
  });
  this.simulation.addEventListener(Messages.DATE_UPDATED, (function() { this.runAdvisor(true); }).bind(this));
  // Hints on the map
  this._hint = null;
  $('#hintPrev').on('click', (function(e) { e.preventDefault(); this.stepHint(-1); }).bind(this));
  $('#hintNext').on('click', (function(e) { e.preventDefault(); this.stepHint(1); }).bind(this));
  $('#hintHide').on('click', (function(e) { e.preventDefault(); this.hideHint(); }).bind(this));
  $(document).on('keydown', (function(e) {
    if (e.keyCode === 27 && this._hint && !this.dialogOpen)
      this.hideHint();
  }).bind(this));
  this._notificationBar.onAdviceClick = this.showHint.bind(this);
  I18n.onChange((function() { this.runAdvisor(false); this.layoutAdvisor(); }).bind(this));
  this.runAdvisor(false);

  // Track when various milestones are first reached
  this._reachedTown = this._reachedCity = this._reachedCapital = this._reachedMetropolis = this._reacedMegalopolis = false;
  this.congratsWindow = new CongratsWindow(opacityLayerID, 'congratsWindow');
  this.congratsWindow.addEventListener(Messages.CONGRATS_WINDOW_CLOSED, this.genericDialogClosure);

  // Listen for touches, so we can warn tablet users
  this.touchListener = touchListener.bind(this);
  window.addEventListener('touchstart', this.touchListener, false);

  // Unhide controls
  this.revealControls();

  // Run the sim
  this.tick = tick.bind(this);
  this.tick();

  // Paint the map
  var debug = Config.debug || Config.gameDebug;
  if (debug) {
    $('#debug').toggle();
    this.frameCount = 0;
    this.animStart = new Date();
    this.lastElapsed = -1;
  }

  this.commonAnimate = commonAnimate.bind(this);
  this.animate = (debug ? debugAnimate : this.commonAnimate).bind(this);
  this.animate();
}


Game.prototype.save = function() {
  var saveData = {name: this.name, everClicked: this.everClicked};
  BaseTool.save(saveData);
  this.simulation.save(saveData);

  Storage.saveGame(saveData);
};


Game.prototype.load = function(saveData) {
  this.name = saveData.name;
  this.everClicked = saveData.everClicked;
  BaseTool.load(saveData);
  this.simulation.load(saveData);
};


var nextFrame =
  window.requestAnimationFrame ||
  window.mozRequestAnimationFrame ||
  window.webkitRequestAnimationFrame;


Game.prototype.revealControls = function() {
 $('.initialHidden').each(function(e) {
   $(this).removeClass('initialHidden');
 });

 // POLICY LAB: place the advisor's card under the tool panel, now and whenever the window changes size; then let
 // the player move and resize the panels
 this.layoutAdvisor();
 $(window).on('resize', this.layoutAdvisor.bind(this));
 Panels.init();
 Panels.onChange(this.layoutAdvisor.bind(this));
 this.layoutAdvisor();

 this._notificationBar.news({subject: Messages.WELCOME});
 this.rci.update({residential: 750, commercial: 750, industrial: 750});
};


var genericDialogClosure = function() {
  this.dialogOpen = false;
  this._openWindow = null;
};


Game.prototype.onDateChange = function(date) {
  if (date.month === 10 && Random.getChance(10))
    this.gameCanvas.changeTileSet(this.snowTileSet);
  else if (date.month === 1)
    this.gameCanvas.changeTileSet(this.tileSet);
};


Game.prototype.handleDisasterWindowClosure = function(request) {
  this.dialogOpen = false;

  if (request === DisasterWindow.DISASTER_NONE)
    return;

  switch (request) {
    case DisasterWindow.DISASTER_MONSTER:
      this.simulation.spriteManager.makeMonster();
      break;

    case DisasterWindow.DISASTER_FIRE:
      this.simulation.disasterManager.makeFire();
      break;

    case DisasterWindow.DISASTER_FLOOD:
      this.simulation.disasterManager.makeFlood();
      break;

    case DisasterWindow.DISASTER_CRASH:
      this.simulation.disasterManager.makeCrash();
      break;

    case DisasterWindow.DISASTER_MELTDOWN:
      this.simulation.disasterManager.makeMeltdown();
      break;

    case DisasterWindow.DISASTER_TORNADO:
      this.simulation.spriteManager.makeTornado();
  }
};


Game.prototype.handleSettingsWindowClosure = function(actions) {
  this.dialogOpen = false;

  for (var i = 0, l = actions.length; i < l; i++) {
    var a = actions[i];

    switch (a.action) {
      case SettingsWindow.AUTOBUDGET:
        this.simulation.budget.setAutoBudget(a.data);
        break;

      case SettingsWindow.AUTOBULLDOZE:
        BaseTool.setAutoBulldoze(a.data);
        break;

      case SettingsWindow.SPEED:
        this.defaultSpeed = a.data;
        this.simulation.setSpeed(this.defaultSpeed);
        break;

      case SettingsWindow.DISASTERS_CHANGED:
        this.simulation.disasterManager.disastersEnabled = a.data;
        break;

      default:
        console.warn('Unexpected action', a);
    }
  }
};


Game.prototype.handleDebugWindowClosure = function(actions) {
  this.dialogOpen = false;

  for (var i = 0, l = actions.length; i < l; i++) {
    var a = actions[i];

    switch (a.action) {
      case DebugWindow.ADD_FUNDS:
        this.simulation.budget.spend(-20000);
        break;

      default:
        console.warn('Unexpected action', a);
    }
  }
};


Game.prototype.handleScreenshotWindowClosure = function(action) {
  this.dialogOpen = false;

  if (action === null)
    return;

  var dataURI;
  if (action === ScreenshotWindow.SCREENSHOT_VISIBLE)
    dataURI = this.gameCanvas.screenshotVisible();
  else if (action === ScreenshotWindow.SCREENSHOT_ALL)
    dataURI = this.gameCanvas.screenshotMap();

  this.dialogOpen = true;
  this._openWindow = 'screenshotLinkWindow';
  this.screenshotLinkWindow.open(dataURI);
};


// POLICY LAB: laws that change what the player can build
Game.prototype.applyPolicyToInterface = function() {
  if (!Policy.nuclearAllowed) {
    $('#nuclearButton').prop('disabled', true).addClass('bannedTool').attr('title', 'Nuclear power is banned by law');
    $('#nuclearButton .price').text('banned');
  }

  // Prices that depend on the laws
  var transport = Policy.transportCosts();
  $('#roadButton .price').text(MiscUtils.formatMoney(transport.road));
  $('#railButton .price').text(MiscUtils.formatMoney(transport.rail));
  $('#commercialButton .price').text(MiscUtils.formatMoney(Policy.businessZoneCost()));
  $('#industrialButton .price').text(MiscUtils.formatMoney(Policy.businessZoneCost()));
  $('#parkButton .price').text(MiscUtils.formatMoney(Policy.parkCost()));
};


// POLICY LAB: the city advisor. Fills the "To do" list, updates the yearly balance under Funds, and every three game
// months (or straight away when something urgent and new comes up) shows the top item in the message bar.
var ADVICE_SHOWN = 3;

Game.prototype.runAdvisor = function(newMonth) {
  var result;
  try {
    result = Advisor.advise(this.simulation, newMonth);
  } catch (e) {
    console.warn('Advisor failed', e);
    return;
  }
  this._advice = result.items;

  // Yearly balance under Funds
  var bal = result.estimate.balance;
  $('#balance').text((bal > 0 ? '+' : bal < 0 ? '\u2212' : '') + MiscUtils.formatMoney(Math.abs(bal)))
               .toggleClass('neg', bal < 0).toggleClass('pos', bal > 0);

  // The list
  var list = $('#advisorList').empty();
  var self = this;
  var opened = this._adviceOpen = this._adviceOpen || {};  // items the player has opened stay open after a refresh
  result.items.slice(0, ADVICE_SHOWN).forEach(function(item) {
    var li = $('<li class="advice"></li>').addClass('tone-' + item.tone).data('adviceId', item.id);
    var head = $('<button type="button" class="adviceText" aria-expanded="false"></button>').text(item.text);
    var details = $('<div class="adviceDetails"></div>').toggle(!!opened[item.id]);
    head.attr('aria-expanded', opened[item.id] ? 'true' : 'false');
    details.append($('<p class="adviceWhy"></p>').text(item.why));
    if (item.fixes.length) {
      var ul = $('<ul></ul>');
      item.fixes.forEach(function(f) { ul.append($('<li></li>').text(f)); });
      details.append(ul);
    }
    head.on('click', function(e) {
      e.preventDefault();
      var open = !details.is(':visible');
      details.toggle(open);
      head.attr('aria-expanded', open ? 'true' : 'false');
      opened[item.id] = open;
    });
    li.append(head);
    if (item.targets && item.targets.length) {
      var show = $('<button type="button" class="adviceShow"></button>').text(I18n.t('Show me on the map'));
      show.on('click', function(e) {
        e.preventDefault();
        if (self._hint && self._hint.item.id === item.id)
          self.hideHint();
        else
          self.showHint(item);
      });
      li.append(show);
    }
    if (self._hint && self._hint.item.id === item.id) {
      li.addClass('showing');
      li.find('.adviceShow').text(I18n.t('Hide from map'));
    }
    li.append(details);
    list.append(li);
  });

  // Keep a highlighted hint up to date (its spots may have changed), or say it's done
  this.refreshHint(result.items);

  if (!newMonth) {
    // After a language change, redo the advice in the message bar (if it is showing some)
    this._notificationBar.refreshAdvice(result.items);
    return;
  }

  // (The advice stays in the To do list only: the message bar is left to the game's original alerts.)
};


// POLICY LAB: highlight a hint's spots on the map, with a bar to step through them
Game.prototype.showHint = function(item) {
  if (!item.targets || !item.targets.length)
    return;
  // Take a copy of the spots: they stay exactly as they are until the player hides them (no jumping around when the
  // advisor runs again next month)
  var frozen = {id: item.id, text: item.text, targets: item.targets.map(function(t) { return Object.assign({}, t); })};
  this._hint = {item: frozen, index: 0};
  this.renderHint(true);
  this.markShowing();
};

// The "Show me on the map" buttons say "Hide from map" for the piece of advice being shown
Game.prototype.markShowing = function() {
  var id = this._hint ? this._hint.item.id : null;
  $('#advisorList > li').each(function() {
    var mine = $(this).data('adviceId') === id;
    $(this).toggleClass('showing', mine);
    $(this).find('.adviceShow').text(mine ? I18n.t('Hide from map') : I18n.t('Show me on the map'));
  });
};

Game.prototype.renderHint = function(centre) {
  var h = this._hint;
  if (!h)
    return;
  var n = h.item.targets.length;
  h.index = Math.min(h.index, n - 1);
  var spot = h.item.targets[h.index];
  var shapes = h.item.targets;
  var verdict = '';
  // A zone whose trips matter: also show how far its car can get along the roads, and what it could reach. (Recomputed
  // for the same spot, so new roads show up, but the spot itself never changes by itself.)
  if (spot.type) {
    var r = Reach.compute(this.simulation._map, spot.x, spot.y, spot.type, this.depotCovers(spot.x, spot.y));
    shapes = shapes.concat(Reach.shapes(r));
    verdict = Reach.verdict(r);
  } else if (spot.road) {
    var rr = Reach.roadReport(this.simulation._map, spot.x, spot.y);
    shapes = shapes.concat(Reach.shapes(rr.reach));
    verdict = rr.verdict.text;
  }
  this.gameCanvas.setHighlights(shapes, h.index);
  if (centre)
    this.gameCanvas.centreOn(spot.x, spot.y);
  // A reach view is worded when drawn, so it follows language changes
  if (h.item.id === 'reach') {
    h.item.text = spot.road ? I18n.t('Where this road leads (30 tiles)') : I18n.t('How far this {0}\'s trips can go', Reach.noun(spot.type));
    spot.label = spot.road ? I18n.t('You are here') : I18n.t('Trips start here');
  }
  // Everything about it is shown in the To do card (the card opens if it was folded)
  $('#hintText').text(h.item.text);
  $('#hintVerdict').text(verdict).toggle(verdict !== '');
  $('#hintCount').text(n > 1 ? I18n.t('{0} of {1}', h.index + 1, n) : '');
  $('#hintPrev, #hintNext').toggle(n > 1);
  $('#hintBar').show();
  if ($('#advisor').hasClass('collapsed')) {
    $('#advisor').removeClass('collapsed');
    $('#advisorToggle').attr('aria-expanded', 'true');
  }
};

Game.prototype.stepHint = function(delta) {
  var h = this._hint;
  if (!h)
    return;
  var n = h.item.targets.length;
  h.index = (h.index + delta + n) % n;
  this.renderHint(true);
};

Game.prototype.hideHint = function() {
  this._hint = null;
  this.gameCanvas.setHighlights(null);
  $('#hintBar').hide();
  this.markShowing();
};

// Called whenever the advisor runs. The highlighted spots never change by themselves; only the reach shading is redrawn
// (roads may have changed) and, after a language change, the wording.
Game.prototype.refreshHint = function(items) {
  var h = this._hint;
  if (!h)
    return;
  if (h.item.id !== 'reach') {
    var fresh = items.filter(function(i) { return i.id === h.item.id; })[0];
    if (fresh) {
      h.item.text = fresh.text;
      if (fresh.targets.length)
        h.item.targets.forEach(function(t) { t.label = fresh.targets[0].label; });
    }
  }
  this.renderHint(false);
  this.markShowing();
};


// POLICY LAB: put the "To do" card just under the tool panel, and keep it clear of the zoom buttons
Game.prototype.layoutAdvisor = function() {
  var controls = $('#controls');
  if (!controls.length || !controls.is(':visible'))
    return;
  var advisor = $('#advisor');
  // If the player has moved or resized the card, leave it where they put it
  if (!Panels.isPlaced('advisor')) {
    var scale = parseFloat(controls.attr('data-scale')) || 1;
    var top = controls.position().top + controls.outerHeight() * scale + 10;
    advisor.css({top: top + 'px'});
  }
  // Keep the whole card clear of the zoom buttons; its list scrolls if needed
  $('#advisorList').css({maxHeight: ''});
  if (Panels.isSized('advisor')) {
    advisor.css({maxHeight: ''});
  } else {
    var room = $('#canvasContainer').height() - advisor.position().top - 110;
    advisor.css({maxHeight: Math.max(140, room) + 'px'});
  }
};


// POLICY LAB: is the advisor currently saying not to zone more of this kind? (Then the original "more ... zones
// needed" message, which only compares zone counts, would contradict it.)
Game.prototype.adviceSays = function(id) {
  return this._advice.some(function(item) { return item.id === id; });
};


// POLICY LAB: in election-cycle mode, tell the player when the budget can next be changed
Game.prototype.updateElectionInfo = function(date) {
  var elem = $('#electionInfo');
  if (!Policy.electionCycle) {
    elem.hide();
    return;
  }

  elem.show();
  if (Policy.isBudgetYear(date.year))
    elem.text(I18n.t('Election year: budget open'));
  else
    elem.text(I18n.t('Next budget vote: {0}', Policy.nextBudgetYear(date.year)));
};


Game.prototype.handleBudgetWindowClosure = function(data) {
  this.dialogOpen = false;

  if (!data.cancelled) {
    this.simulation.budget.roadPercent = data.roadPercent / 100;
    this.simulation.budget.firePercent = data.firePercent / 100;
    this.simulation.budget.policePercent = data.policePercent / 100;
    // POLICY LAB
    this.simulation.budget.socialPercent = data.socialPercent / 100;
    this.simulation.budget.housingPercent = data.housingPercent / 100;
    this.simulation.budget.setTax(data.taxPercent - 0);
    if (this.simNeededBudget) {
      this.simulation.budget.doBudgetWindow();
      this.simNeededBudget = false;
    } else {
      this.simulation.budget.updateFundEffects();
    }
  }
};


var makeWindowOpenHandler = function(winName, customFn) {
  customFn = customFn || null;

  return function() {
    if (this.dialogOpen) {
      console.warn('Request made to open ' + winName + ' window. There is a dialog open!');
      return;
    }

    this.dialogOpen = true;
    this._openWindow = winName + 'Window';
    var win = winName + 'Window';
    var data = [];

    if (customFn)
      data = customFn();

    this[win].open.apply(this[win], data);
  };
};


Game.prototype.handleDebugRequest = makeWindowOpenHandler('debug');
Game.prototype.handleDisasterRequest = makeWindowOpenHandler('disaster');
var openQueryWindow = makeWindowOpenHandler('query');

// POLICY LAB: inspecting a home, shop or factory (or a piece of road or rail) also says whether it is connected to
// what it needs (in the Query window) and shows its reach on the map
Game.prototype.handleQueryRequest = function(where) {
  openQueryWindow.call(this);
  $('#queryConnections').hide();
  if (!where)
    return;
  var map = this.simulation._map;
  var zone = Reach.zoneAt(map, where.x, where.y);
  var target, report;
  if (zone) {
    report = Reach.zoneReport(map, zone, this.depotCovers(zone.x, zone.y));
    target = {kind: 'zone', x: zone.x, y: zone.y, type: zone.type, label: ''};
  } else if (Reach.isDrivable(map, where.x, where.y)) {
    report = Reach.roadReport(map, where.x, where.y);
    target = {kind: 'tile', x: where.x, y: where.y, road: true, label: ''};
  } else {
    return;
  }
  this.showConnections(report);
  window.clearTimeout(this._hintDoneTimer);
  this._hint = {index: 0, item: {id: 'reach', text: '', targets: [target]}};
  this.renderHint(false);
};

Game.prototype.depotCovers = function(x, y) {
  var depots = this.simulation.blockMaps && this.simulation.blockMaps.depotMap;
  return !!depots && depots.worldGet(x, y) > 0;
};

// Fill the "Connections" section of the Query window
var MARKS = {ok: '\u2713', no: '\u2717', warn: '!', info: '\u2022'};
Game.prototype.showConnections = function(report) {
  var list = $('#queryConnList').empty();
  report.lines.forEach(function(line) {
    var li = $('<li></li>').addClass('conn-' + line.mark);
    li.append($('<span class="connMark" aria-hidden="true"></span>').text(MARKS[line.mark]));
    li.append($('<span></span>').text(line.text));
    list.append(li);
  });
  $('#queryConnVerdict').removeClass('conn-ok conn-no conn-warn').addClass('conn-' + report.verdict.mark)
                        .text(report.verdict.text);
  $('#queryConnNote').text(report.note || '').toggle(!!report.note);
  $('#queryConnections').show();
};


Game.prototype.handleScreenshotRequest = makeWindowOpenHandler('screenshot');


Game.prototype.handleMandatoryBudget = function() {
  this.simNeededBudget = true;
  this.handleBudgetRequest();
};


Game.prototype.handleTool = function(data) {
  var x = data.x;
  var y = data.y;

  // Were was the tool clicked?
  var tileCoords = this.gameCanvas.canvasCoordinateToTileCoordinate(x, y);

  if (tileCoords === null)
    return;

  this.applyToolAt(tileCoords.x, tileCoords.y);
};


// POLICY LAB: apply the current tool to one tile, recording the change so it can be undone.
// (This was the second half of handleTool.)
Game.prototype.applyToolAt = function(tileX, tileY) {
  var tool = this.inputStatus.currentTool;
  if (tool === null)
    return;

  var budget = this.simulation.budget;

  // do it!
  tool.lastUndo = null;
  tool.doTool(tileX, tileY, this.simulation.blockMaps);

  var built = tool.modifyIfEnoughFunding(budget);
  // POLICY LAB: remember hospitals the player built, so the simulation never removes them
  if (built && this.inputStatus.toolName === 'hospital')
    Policy.builtHospitals[tileX + ',' + tileY] = true;

  if (built && tool.lastUndo && this.inputStatus.toolName !== 'query') {
    this.recordUndo(tool.lastUndo, this.inputStatus.strokeId);
    this._lastToolTile = {x: tileX, y: tileY, tool: this.inputStatus.toolName};
  }

  // POLICY LAB: explain refusals caused by the laws
  if (tool.blockedBy === 'greenbelt') {
    $('#toolOutput').text('Protected green belt: no building here');
    return;
  }

  switch (tool.result) {
    case tool.TOOLRESULT_NEEDS_BULLDOZE:
      $('#toolOutput').text(Text.toolMessages.needsDoze);
      break;

    case tool.TOOLRESULT_NO_MONEY:
      $('#toolOutput').text(Text.toolMessages.noMoney);
      break;

    default:
      $('#toolOutput').html('Tools');
  }
};


// POLICY LAB: Shift+click draws a straight line (or an L shape) from the last tile built with the same tool
Game.prototype.handleToolLine = function(data) {
  var end = this.gameCanvas.canvasCoordinateToTileCoordinate(data.x, data.y);
  if (end === null)
    return;

  var tool = this.inputStatus.currentTool;
  var start = this._lastToolTile;
  if (tool === null || !tool.isDraggable || !start || start.tool !== this.inputStatus.toolName) {
    // Nothing to draw from yet: behave like a normal click
    this.applyToolAt(end.x, end.y);
    return;
  }

  // Go along the longer direction first, then turn the corner if needed
  var x = start.x, y = start.y;
  var stepX = end.x > x ? 1 : -1, stepY = end.y > y ? 1 : -1;
  var path = [];
  if (Math.abs(end.x - x) >= Math.abs(end.y - y)) {
    while (x !== end.x) { x += stepX; path.push([x, y]); }
    while (y !== end.y) { y += stepY; path.push([x, y]); }
  } else {
    while (y !== end.y) { y += stepY; path.push([x, y]); }
    while (x !== end.x) { x += stepX; path.push([x, y]); }
  }

  for (var i = 0; i < path.length; i++) {
    this.applyToolAt(path[i][0], path[i][1]);
    if (tool.result === tool.TOOLRESULT_NO_MONEY)
      break;
  }
};


// POLICY LAB: undo history. One entry per click or drag ("stroke"), newest last.
var MAX_UNDO = 30;

Game.prototype.recordUndo = function(change, strokeId) {
  this._undoStack = this._undoStack || [];
  var top = this._undoStack[this._undoStack.length - 1];

  if (top && top.strokeId === strokeId) {
    // Same drag: merge, keeping each tile's ORIGINAL value from before the stroke began
    change.tiles.forEach(function(t) {
      var existing = top.tiles.find(function(u) { return u.x === t.x && u.y === t.y; });
      if (existing)
        existing.newValue = t.newValue;
      else
        top.tiles.push(t);
    });
    top.cost += change.cost;
  } else {
    this._undoStack.push({strokeId: strokeId, tiles: change.tiles.slice(), cost: change.cost});
    if (this._undoStack.length > MAX_UNDO)
      this._undoStack.shift();
  }

  $('#undoRequest').prop('disabled', false);
};


var isExplosion = function(v) {
  return (v >= TileValues.TINYEXP && v <= TileValues.TINYEXPLAST) ||
         (v >= TileValues.RUBBLE && v <= TileValues.LASTRUBBLE) || v === TileValues.DIRT;
};

Game.prototype.handleUndo = function() {
  if (this.dialogOpen)
    return;

  var stack = this._undoStack || [];
  var entry = stack[stack.length - 1];
  if (!entry) {
    $('#toolOutput').text('Nothing to undo');
    return;
  }

  // Only undo if the city hasn't changed those tiles since (e.g. a zone that has already started to grow)
  var map = this.simulation._map;
  var unchanged = entry.tiles.every(function(t) {
    var now = map.getTileValue(t.x, t.y);
    if (now === t.newValue)
      return true;
    // Bulldozing leaves an explosion that turns into rubble or clear land: that still counts as unchanged
    return t.newValue >= TileValues.TINYEXP && t.newValue <= TileValues.TINYEXPLAST && isExplosion(now);
  });

  stack.pop();
  $('#undoRequest').prop('disabled', stack.length === 0);

  if (!unchanged) {
    $('#toolOutput').text("Can't undo: the city has already changed there");
    return;
  }

  for (var i = entry.tiles.length - 1; i >= 0; i--) {
    var t = entry.tiles[i];
    map.setTile(t.x, t.y, t.oldValue, t.oldFlags);
  }

  this.simulation.budget.spend(-entry.cost);
  $('#toolOutput').text(entry.cost > 0 ? I18n.t('Undone: {0} refunded', MiscUtils.formatMoney(entry.cost)) : I18n.t('Undone'));
};


// POLICY LAB: keyboard shortcuts help panel
Game.prototype.toggleKeysHelp = function() {
  $('#keysHelp').toggle();
};


Game.prototype.handleSave = function() {
  this.save();
  this.dialogOpen = true;
  this._openWindow = 'saveWindow';
  this.saveWindow.open();
};


Game.prototype.handlePause = function() {
  // XXX Currently only offer pause and run to the user
  // No real difference among the speeds until we optimise
  // the sim
  this.isPaused = !this.isPaused;

  if (this.isPaused)
    this.simulation.setSpeed(Simulation.SPEED_PAUSED);
  else
    this.simulation.setSpeed(this.defaultSpeed);
};


Game.prototype.handleInput = function() {
  if (!this.dialogOpen) {
    // Handle keyboard movement

    if (this.inputStatus.left)
      this.gameCanvas.moveWest();
    else if (this.inputStatus.up)
      this.gameCanvas.moveNorth();
    else if (this.inputStatus.right)
      this.gameCanvas.moveEast();
    else if (this.inputStatus.down)
      this.gameCanvas.moveSouth();
  }

  if (this.inputStatus.escape) {
    // We need to handle escape, as InputStatus won't know what dialogs are showing
    if (this.dialogOpen) {
      this.dialogOpen = false;
      this[this._openWindow].close();
      this._openWindow = null;
    } else
      this.inputStatus.clearTool();
  }
};


// Will be bound on construction
var touchListener = function(e) {
  window.removeEventListener('touchstart', this.touchListener, false);
  this._openWindow = 'touchWindow';
  this.dialogOpen = true;
  this.touchWindow.open();
};


Game.prototype.processFrontEndMessage = function(message) {
  var subject = message.subject;
  var d = new Date();

  // POLICY LAB: skip the original zone-count messages when the advisor says there are already empty zones of that kind
  if ((subject === Messages.NEED_MORE_RESIDENTIAL && this.adviceSays('wait_res')) ||
      (subject === Messages.NEED_MORE_COMMERCIAL && this.adviceSays('wait_com')) ||
      (subject === Messages.NEED_MORE_INDUSTRIAL && this.adviceSays('wait_ind')))
    return;

  if (Text.goodMessages[subject] !== undefined) {
    var cMessage = this.name + ' is now a ';
    var cMessageES = null;  // POLICY LAB: Spanish version

    switch (subject) {
      case Messages.REACHED_CAPITAL:
        if (!this._reachedCapital) {
          this._reachedCapital = true;
          cMessage += 'capital!';
          cMessageES = '¡{0} ahora es una capital!';
        }
        break;

      case Messages.REACHED_CITY:
        if (!this._reachedCity) {
          this._reachedCity = true;
          cMessage += 'city!';
          cMessageES = '¡{0} ahora es una ciudad!';
        }
        break;

      case Messages.REACHED_MEGALOPOLIS:
        if (!this._reachedMegalopolis) {
          this._reachedMegalopolis = true;
          cMessage += 'megalopolis!';
          cMessageES = '¡{0} ahora es una megalópolis!';
        }
        break;

      case Messages.REACHED_METROPOLIS:
        if (!this._reachedMetropolis) {
          this._reachedMetropolis = true;
          cMessage += 'metropolis!';
          cMessageES = '¡{0} ahora es una metrópolis!';
        }
        break;

      case Messages.REACHED_TOWN:
        if (!this._reachedTown) {
          this._reachedTown = true;
          cMessage += 'town!';
          cMessageES = '¡{0} ahora es un pueblo!';
        }
        break;
    }

    if (this.lastBadMessageTime === null || d - this.lastBadMessageTime > disasterTimeout) {
      this.lastBadMessageTime = null;
      this._notificationBar.goodNews(message);
    }

    if (cMessage !== (this.name + ' is now a ')) {
      this.dialogOpen = true;
      this._openWindow = 'congratsWindow';
      this.congratsWindow.open(cMessageES ? I18n.p(cMessage, cMessageES.replace('{0}', this.name)) : cMessage);
    }

    return;
  }

  // Show disaster if applicable
  if (message.data) {
    if (message.data.showable)
    this.monsterTV.show(message.data.x, message.data.y);
    else if (message.data.trackable)
    this.monsterTV.track(message.data.x, message.data.y, message.data.sprite);
  }

  if (Text.badMessages[subject] !== undefined) {
    this._notificationBar.badNews(message);
    if (Messages.DISASTER_MESSAGES.indexOf(message.subject) !== -1)
      this.lastBadMessageTime = d;
    return;
  }

  if (Text.neutralMessages[subject] !== undefined) {
    if (this.lastBadMessageTime === null || d - this.lastBadMessageTime > disasterTimeout) {
      this.lastBadMessageTime = null;
      this._notificationBar.news(message);
    }
    return;
  }

  console.warn('Unexpected message: ', subject);
};


Game.prototype.calculateMouseForPaint = function() {
  // Determine whether we need to draw a tool outline in the
  // canvas
  var mouse = null;

  if (this.inputStatus.mouseX !== -1 && this.inputStatus.toolWidth > 0) {
    var tileCoords = this.gameCanvas.canvasCoordinateToTileOffset(this.inputStatus.mouseX, this.inputStatus.mouseY);
    if (tileCoords !== null) {
      mouse = {};

      mouse.x = tileCoords.x;
      mouse.y = tileCoords.y;

      // The inputStatus fields came from DOM attributes, so will be strings.
      // Coerce back to numbers.
      mouse.width = this.inputStatus.toolWidth - 0;
      mouse.height = this.inputStatus.toolWidth - 0;
      mouse.colour = this.inputStatus.toolColour || 'yellow';
    }
  }

  return mouse;
};


Game.prototype.calculateSpritesForPaint = function(canvas) {
  var origin = canvas.getTileOrigin();
  // POLICY LAB: sprites are positioned in original (16-per-tile) pixels; convert the view size accordingly
  var scale = canvas.getScale ? canvas.getScale() : 1;
  var spriteList = this.simulation.spriteManager.getSpritesInView(origin.x, origin.y, canvas.canvasWidth / scale,
                                                                   canvas.canvasHeight / scale);

  if (spriteList.length === 0)
    return null;

  return spriteList;
};


var tick = function() {
  this.handleInput();

  if (this.dialogOpen) {
    window.setTimeout(this.tick, 0);
    return;
  }

  if (!this.simulation.isPaused() && !$('#tooSmall').is(':visible')) {
    // Run the sim
    this.simulation.simTick();
  }

  // Run this even when paused: you can still build when paused
  this.mouse = this.calculateMouseForPaint();

  window.setTimeout(this.tick, 0);
};


var commonAnimate = function() {
  if (this.dialogShowing) {
    nextFrame(this.animate);
    return;
  }

  if (!this.isPaused)
    this.simulation.spriteManager.moveObjects(this.simulation._constructSimData());

  var sprites = this.calculateSpritesForPaint(this.gameCanvas);
  this.gameCanvas.paint(this.mouse, sprites, this.isPaused);

  sprites = this.calculateSpritesForPaint(this.monsterTV.canvas);
  this.monsterTV.paint(sprites, this.isPaused);

  nextFrame(this.animate);
};


var debugAnimate = function() {
  var date = new Date();
  var elapsed = Math.floor((date - this.animStart) / 1000);

  if (elapsed > this.lastElapsed && this.frameCount > 0) {
    $('#fpsValue').text(Math.floor(this.frameCount/elapsed));
    this.lastElapsed = elapsed;
  }

  this.frameCount++;
  this.commonAnimate();
};


export { Game };

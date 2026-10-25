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

import { EventEmitter } from './eventEmitter.js';
import * as Messages from './messages.ts';
import { MiscUtils } from './miscUtils.js';
import { Policy } from './policy.js';
import { Utilities } from './utilities.js';

// POLICY LAB: cost of fully funding social services, per unit of city population (census.totalPop)
var socialMaintenanceCostPerPop = 1;
// POLICY LAB: cost of fully funding social housing, per unit of city population
var housingMaintenanceCostPerPop = 1;

// Cost of maintaining 1 police station
var policeMaintenanceCost = 100;

// Cost of maintaining 1 fire station
var fireMaintenanceCost = 100;

// Cost of maintaining 1 road tile
var roadMaintenanceCost = 1;

// Cost of maintaining 1 rail tile
var railMaintenanceCost = 2;


var Budget = EventEmitter(function() {
  Object.defineProperties(this,
   {MAX_ROAD_EFFECT: MiscUtils.makeConstantDescriptor(32),
    MAX_POLICESTATION_EFFECT: MiscUtils.makeConstantDescriptor(1000),
    MAX_FIRESTATION_EFFECT:  MiscUtils.makeConstantDescriptor(1000)});

  this.roadEffect = this.MAX_ROAD_EFFECT;
  this.policeEffect = this.MAX_POLICESTATION_EFFECT;
  this.fireEffect = this.MAX_FIRESTATION_EFFECT;
  this.totalFunds = 0;
  this.cityTax = 7;
  this.cashFlow = 0;
  this.taxFund = 0;

  // These values denote how much money is required to fully maintain the relevant services
  this.roadMaintenanceBudget = 0;
  this.fireMaintenanceBudget = 0;
  this.policeMaintenanceBudget = 0;
  // POLICY LAB: social services (new). Starts at 0% funding so the default game plays like the original.
  this.socialMaintenanceBudget = 0;
  // POLICY LAB: social housing (new), also starting at 0%
  this.housingMaintenanceBudget = 0;

  // Percentage of budget used
  this.roadPercent = 1;
  this.firePercent = 1;
  this.policePercent = 1;
  this.socialPercent = 0;
  this.housingPercent = 0;

  // Cash value of spending. Should equal Math.round(_MaintenanceBudget * _Percent)
  this.roadSpend = 0;
  this.fireSpend = 0;
  this.policeSpend = 0;
  this.socialSpend = 0;
  // Fraction (0-1) of full social services funding actually spent; read by the crime scan
  this.socialEffect = 0;
  this.housingSpend = 0;
  this.housingEffect = 0;
  // POLICY LAB: the current city year, set by the simulation before taxes are collected
  this.currentYear = 1900;
  // POLICY LAB: yearly running costs of depots and water plants
  this.utilityCost = 0;

  this.awaitingValues = false;
  this.autoBudget = true;
});


var saveProps = ['autoBudget', 'totalFunds', 'policePercent', 'roadPercent', 'firePercent', 'roadSpend',
                 'policeSpend', 'fireSpend', 'roadMaintenanceBudget', 'policeMaintenanceBudget',
                 'fireMaintenanceBudget', 'cityTax', 'roadEffect', 'policeEffect', 'fireEffect',
                 // POLICY LAB
                 'socialPercent', 'socialSpend', 'socialMaintenanceBudget', 'socialEffect', 'currentYear',
                 'utilityCost', 'housingPercent', 'housingSpend', 'housingMaintenanceBudget', 'housingEffect'];

Budget.prototype.save = function(saveData) {
  for (var i = 0, l = saveProps.length; i < l; i++)
    saveData[saveProps[i]] = this[saveProps[i]];
};


Budget.prototype.load = function(saveData) {
  for (var i = 0, l = saveProps.length; i < l; i++) {
    // POLICY LAB: older saves don't have the social services values; keep the defaults for those
    if (saveData[saveProps[i]] !== undefined)
      this[saveProps[i]] = saveData[saveProps[i]];
  }

  this._emitEvent(Messages.AUTOBUDGET_CHANGED, this.autoBudget);
  this._emitEvent(Messages.FUNDS_CHANGED, this.totalFunds);
};


Budget.prototype.setAutoBudget = function(value) {
  this.autoBudget = value;
  this._emitEvent(Messages.AUTOBUDGET_CHANGED, this.autoBudget);
};


var RLevels = [0.7, 0.9, 1.2];
var FLevels = [1.4, 1.2, 0.8];

// Calculates the best possible outcome in terms of funding the various services
// given the player's current funds and tax yield. On entry, roadPercent etc. are
// assumed to contain the desired percentage level, and taxFunds should contain the
// most recent tax collected. On exit, the *Percent members will be updated with what
// we can actually afford to spend. Returns an object containing the amount of cash
// that would be spent on each service.
Budget.prototype._calculateBestPercentages = function() {
  // How much would we be spending based on current percentages?
  // Note: the *Budget items are updated every January by collectTax
  this.roadSpend = Math.round(this.roadMaintenanceBudget * this.roadPercent);
  this.fireSpend = Math.round(this.fireMaintenanceBudget * this.firePercent);
  this.policeSpend = Math.round(this.policeMaintenanceBudget * this.policePercent);
  this.socialSpend = Math.round(this.socialMaintenanceBudget * this.socialPercent);
  this.housingSpend = Math.round(this.housingMaintenanceBudget * this.housingPercent);
  var total = this.roadSpend + this.fireSpend + this.policeSpend + this.socialSpend + this.housingSpend;

  // If we don't have any services on the map, we can bail early
  // POLICY LAB: the player's chosen social services percentage is kept
  if (total === 0) {
    this.roadPercent = 1;
    this.firePercent = 1;
    this.policePercent = 1;
    return {road: 1, fire: 1, police: 1, social: 0, housing: 0};
  }

  // How much are we actually going to spend?
  var roadCost = 0;
  var fireCost = 0;
  var policeCost = 0;
  var socialCost = 0;
  var housingCost = 0;

  var cashRemaining = this.totalFunds + this.taxFund - (this.utilityCost || 0);

  // Spending priorities: road, fire, police
  if (cashRemaining >= this.roadSpend)
    roadCost = this.roadSpend;
  else
    roadCost = cashRemaining;
  cashRemaining -= roadCost;

  if (cashRemaining >= this.fireSpend)
    fireCost = this.fireSpend;
  else
    fireCost = cashRemaining;
  cashRemaining -= fireCost;

  if (cashRemaining >= this.policeSpend)
    policeCost = this.policeSpend;
  else
    policeCost = cashRemaining;
  cashRemaining -= policeCost;

  // POLICY LAB: social services come last in the spending priorities
  if (cashRemaining >= this.socialSpend)
    socialCost = this.socialSpend;
  else
    socialCost = cashRemaining;
  cashRemaining -= socialCost;

  // POLICY LAB: social housing after social services
  if (cashRemaining >= this.housingSpend)
    housingCost = this.housingSpend;
  else
    housingCost = Math.max(0, cashRemaining);
  cashRemaining -= housingCost;

  if (this.roadMaintenanceBudget > 0)
    this.roadPercent = (roadCost / this.roadMaintenanceBudget).toPrecision(2) - 0;
  else
    this.roadPercent = 1;

  if (this.fireMaintenanceBudget > 0)
    this.firePercent = (fireCost / this.fireMaintenanceBudget).toPrecision(2) - 0;
  else
    this.firePercent = 1;

  if (this.policeMaintenanceBudget > 0)
    this.policePercent = (policeCost / this.policeMaintenanceBudget).toPrecision(2) - 0;
  else
    this.policePercent = 1;

  // POLICY LAB: only lower the social services percentage if the city genuinely couldn't afford it (otherwise rounding
  // on small budgets would quietly change the player's chosen percentage)
  if (this.socialMaintenanceBudget > 0 && socialCost < this.socialSpend)
    this.socialPercent = (socialCost / this.socialMaintenanceBudget).toPrecision(2) - 0;

  if (this.housingMaintenanceBudget > 0 && housingCost < this.housingSpend)
    this.housingPercent = (housingCost / this.housingMaintenanceBudget).toPrecision(2) - 0;

  return {road: roadCost, police: policeCost, fire: fireCost, social: socialCost, housing: housingCost};
};


// User initiated budget
Budget.prototype.doBudgetWindow = function() {
  return this.doBudgetNow(true);
};


Budget.prototype.doBudgetNow = function(fromWindow) {
  var costs = this._calculateBestPercentages();

  // POLICY LAB: outside election years the player can't revise the budget, so the city keeps last year's
  // percentages automatically (unless it can't afford them: see below).
  var locked = !fromWindow && !Policy.isBudgetYear(this.currentYear);

  if (!this.autoBudget && !fromWindow && !locked) {
    this.autoBudget = false;
    this.awaitingValues = true;
    this._emitEvent(Messages.BUDGET_NEEDED);
    return;
  }

  var roadCost = costs.road;
  var policeCost = costs.police;
  var fireCost = costs.fire;
  var socialCost = costs.social;
  var housingCost = costs.housing || 0;
  var totalCost = roadCost + policeCost + fireCost + socialCost + housingCost + (this.utilityCost || 0);
  var cashRemaining = this.totalFunds + this.taxFund - totalCost;

  // Autobudget
  if ((cashRemaining > 0 && (this.autoBudget || locked)) || fromWindow) {
    // Either we were able to fully fund services, or we have just normalised user input. Go ahead and spend.
    this.awaitingValues = false;
    this.doBudgetSpend(roadCost, fireCost, policeCost, socialCost, housingCost);
    return;
  }

  // Uh-oh. Not enough money. Make this the user's problem.
  // They don't know it yet, but they're about to get a budget window.
  this.setAutoBudget(false);
  this.awaitingValues = true;
  this._emitEvent(Messages.BUDGET_NEEDED);
  this._emitEvent(Messages.NO_MONEY);
};


Budget.prototype.doBudgetSpend = function(roadValue, fireValue, policeValue, socialValue, housingValue) {
  this.roadSpend = roadValue;
  this.fireSpend = fireValue;
  this.policeSpend = policeValue;
  this.socialSpend = socialValue || 0;
  this.housingSpend = housingValue || 0;
  var total = this.roadSpend + this.fireSpend + this.policeSpend + this.socialSpend + this.housingSpend +
              (this.utilityCost || 0);

  this.spend(-(this.taxFund - total));
  this.updateFundEffects();
};


Budget.prototype.updateFundEffects = function() {
  // The caller is assumed to have correctly set the percentage spend
  this.roadSpend = Math.round(this.roadMaintenanceBudget * this.roadPercent);
  this.fireSpend = Math.round(this.fireMaintenanceBudget * this.firePercent);
  this.policeSpend = Math.round(this.policeMaintenanceBudget * this.policePercent);
  this.socialSpend = Math.round(this.socialMaintenanceBudget * this.socialPercent);

  // POLICY LAB: how much of full social services funding is being spent (0-1). Before the first tax year
  // there's no cost estimate yet, so use the chosen percentage directly.
  // (Capped at the chosen percentage, so rounding a tiny budget up to a whole dollar can't overstate the effect.)
  if (this.socialMaintenanceBudget > 0)
    this.socialEffect = Math.min(this.socialPercent, this.socialSpend / this.socialMaintenanceBudget);
  else
    this.socialEffect = this.socialPercent;

  // POLICY LAB: same for social housing
  this.housingSpend = Math.round(this.housingMaintenanceBudget * this.housingPercent);
  if (this.housingMaintenanceBudget > 0)
    this.housingEffect = Math.min(this.housingPercent, this.housingSpend / this.housingMaintenanceBudget);
  else
    this.housingEffect = this.housingPercent;

  // Update the effect this level of spending will have on infrastructure deterioration
  this.roadEffect = this.MAX_ROAD_EFFECT;
  this.policeEffect = this.MAX_POLICESTATION_EFFECT;
  this.fireEffect = this.MAX_FIRESTATION_EFFECT;

  if (this.roadMaintenanceBudget > 0)
    this.roadEffect = Math.floor(this.roadEffect * this.roadSpend / this.roadMaintenanceBudget);

  if (this.fireMaintenanceBudget > 0)
    this.fireEffect = Math.floor(this.fireEffect * this.fireSpend / this.fireMaintenanceBudget);

  if (this.policeMaintenanceBudget > 0)
    this.policeEffect = Math.floor(this.policeEffect * this.policeSpend / this.policeMaintenanceBudget);
};


// POLICY LAB: estimate a full year's money at the current rates, without changing anything: taxes the city would
// collect, minus the running costs it would pay at the current funding percentages (same formulas as collectTax).
// Used for the "a year" balance under Funds and by the city advisor.
Budget.prototype.estimateYear = function(gameLevel, census) {
  var taxes = Math.floor(Math.floor(census.totalPop * census.landValueAverage / 120) * this.cityTax * FLevels[gameLevel]);
  taxes = Math.floor(taxes * Policy.taxShare());
  var road = Math.floor((census.roadTotal * Policy.transportCosts().roadMaintenance +
                         census.railTotal * Policy.transportCosts().railMaintenance) * RLevels[gameLevel]);
  var costs = {
    road: Math.round(road * this.roadPercent),
    police: Math.round(census.policeStationPop * policeMaintenanceCost * this.policePercent),
    fire: Math.round(census.fireStationPop * fireMaintenanceCost * this.firePercent),
    social: Math.round(Math.floor(census.totalPop * socialMaintenanceCostPerPop) * (this.socialPercent || 0)),
    housing: Math.round(Math.floor(census.totalPop * housingMaintenanceCostPerPop) * (this.housingPercent || 0)),
    utilities: census.depotPop * Utilities.DEPOT_MAINTENANCE + census.waterPlantPop * Utilities.WATER_PLANT_MAINTENANCE +
               (census.builtHospitalPop || 0) * Utilities.HOSPITAL_MAINTENANCE
  };
  var total = costs.road + costs.police + costs.fire + costs.social + costs.housing + costs.utilities;
  return {taxes: taxes, costs: costs, totalCosts: total, balance: taxes - total};
};


Budget.prototype.collectTax = function(gameLevel, census) {
  this.cashFlow = 0;

  // How much would it cost to fully fund every service?
  this.policeMaintenanceBudget = census.policeStationPop * policeMaintenanceCost;
  this.fireMaintenanceBudget = census.fireStationPop * fireMaintenanceCost;
  // POLICY LAB: social services scale with population
  this.socialMaintenanceBudget = Math.floor(census.totalPop * socialMaintenanceCostPerPop);
  this.housingMaintenanceBudget = Math.floor(census.totalPop * housingMaintenanceCostPerPop);
  // POLICY LAB: fixed yearly running costs of train depots and water treatment plants (always paid first)
  this.utilityCost = census.depotPop * Utilities.DEPOT_MAINTENANCE +
                     census.waterPlantPop * Utilities.WATER_PLANT_MAINTENANCE +
                     (census.builtHospitalPop || 0) * Utilities.HOSPITAL_MAINTENANCE;

  // POLICY LAB: maintenance costs depend on the transportation priority law (original: road 1, rail 2)
  var roadCost = census.roadTotal * Policy.transportCosts().roadMaintenance;
  var railCost = census.railTotal * Policy.transportCosts().railMaintenance;
  this.roadMaintenanceBudget = Math.floor((roadCost + railCost) * RLevels[gameLevel]);

  this.taxFund = Math.floor(Math.floor(census.totalPop * census.landValueAverage / 120) * this.cityTax * FLevels[gameLevel]);
  // POLICY LAB: business incentives (tax breaks) reduce the share of taxes the city collects (original: all of it)
  var fullTaxFund = this.taxFund;
  this.taxFund = Math.floor(this.taxFund * Policy.taxShare());
  // POLICY LAB: how much tax revenue the business incentives cost this year
  this.taxBreakCost = fullTaxFund - this.taxFund;

  if (census.totalPop > 0) {
    this.cashFlow = this.taxFund - (this.policeMaintenanceBudget + this.fireMaintenanceBudget + this.roadMaintenanceBudget +
                                    Math.round(this.socialMaintenanceBudget * this.socialPercent) +
                                    Math.round(this.housingMaintenanceBudget * this.housingPercent) + this.utilityCost);
    this.doBudgetNow(false);
  } else {
    // We don't want roads etc deteriorating when population hasn't yet been established
    // (particularly early game)
    this.roadEffect   = this.MAX_ROAD_EFFECT;
    this.policeEffect = this.MAX_POLICESTATION_EFFECT;
    this.fireEffect   = this.MAX_FIRESTATION_EFFECT;
  }
};


Budget.prototype.setTax = function(amount) {
  if (amount === this.cityTax)
    return;

  this.cityTax = amount;
};


Budget.prototype.setFunds = function(amount) {
  if (amount === this.totalFunds)
    return;

  this.totalFunds = Math.max(0, amount);

  this._emitEvent(Messages.FUNDS_CHANGED, this.totalFunds);
  if (this.totalFunds === 0)
    this._emitEvent(Messages.NO_MONEY);
};


Budget.prototype.spend = function(amount) {
  this.setFunds(this.totalFunds - amount);
};


Budget.prototype.shouldDegradeRoad = function() {
  return this.roadEffect < Math.floor(15 * this.MAX_ROAD_EFFECT / 16);
};


export { Budget };

/* Policy Lab additions to micropolisJS (2026).
 *
 * This code is released under the GNU GPL v3, with some additional terms, like the rest of micropolisJS.
 * Modified version: NOT the original micropolisJS / Micropolis.
 *
 * v34: WHAT A BUILDING COSTS AND DOES, shown in a card while the mouse is over its button in the tool panel.
 *
 * Every number comes from the game's own rules (budget.js, utilities.js, education.js, amenities.js,
 * blockMapUtils.js, powerManager.js, simulation.js), at the city's current laws and difficulty:
 *   - the price to build, and the running cost per year at full funding;
 *   - its effects on crime, pollution, land value, traffic and jobs;
 *   - which of the residents' complaints in the yearly poll it eases or adds to. The game has no single "happiness"
 *     figure: approval comes from that poll, on crime, pollution, housing costs (high land value), taxes, traffic,
 *     unemployment and fires.
 */

import { Amenities } from './amenities.js';
import { Education } from './education.js';
import { I18n } from './i18n.js';
import { MiscUtils } from './miscUtils.js';
import { Policy } from './policy.js';
import { Utilities } from './utilities.js';

var P = I18n.p;
var money = MiscUtils.formatMoney;

// Running costs per year at full funding (budget.js)
var POLICE_YEAR = 100, FIRE_YEAR = 100;
// Road and rail upkeep is multiplied by the difficulty (budget.js RLevels: easy, medium, hard)
var R_LEVELS = [0.7, 0.9, 1.2];
// One station's effect after the game's three smoothing passes (see preview.js): own 8x8 square, next square,
// diagonal square, two squares away
var STATION = [218, 111, 46, 23];

var perTile = function(v) {
  return '$' + (Math.round(v * 100) / 100).toFixed(2);
};

// {build, year, good: [], bad: [], poll: {eases: [], adds: []}, note}
var info = function(tool, sim) {
  var lvl = sim ? (sim._gameLevel || 0) : 0, rl = R_LEVELS[lvl] || 0.7;
  var tc = Policy.transportCosts();
  var road = tc.roadMaintenance * rl, rail = tc.railMaintenance * rl;
  var C = P('crime', 'delincuencia'), POL = P('pollution', 'contaminación'), HOU = P('housing costs', 'costo de la vivienda'),
      TRA = P('traffic', 'tráfico'), JOB = P('unemployment', 'desempleo'), FIR = P('fires', 'incendios');
  var zoneCost = Policy.businessZoneCost();
  var d = {
    residential: {build: 100, year: 0,
      good: [P('Homes: people who pay taxes and work in shops and factories', 'Viviendas: gente que paga impuestos y trabaja en tiendas y fábricas')],
      bad: [P('More people bring more trips (traffic) and, where it gets crowded, more crime', 'Más gente trae más viajes (tráfico) y, donde se llena, más delincuencia')],
      poll: {eases: [JOB], adds: [C, TRA]}},
    commercial: {build: zoneCost, year: 0,
      good: [P('Jobs and taxes; homes within walking distance gain 20 points of land value', 'Empleos e impuestos; las viviendas a poca distancia ganan 20 puntos de valor del suelo')],
      bad: [P('Needs its car trips to reach homes, shops or factories to grow', 'Necesita que sus viajes en carro lleguen a viviendas, tiendas o fábricas para crecer')],
      poll: {eases: [JOB], adds: [TRA]}},
    industrial: {build: zoneCost, year: 0,
      good: [P('Jobs (factories drive the growth of the whole city) and taxes', 'Empleos (las fábricas impulsan el crecimiento de toda la ciudad) e impuestos')],
      bad: [P('Pollution {0} per tile under your environmental rules (a coal plant: 100)', 'Contaminación {0} por casilla con tus normas ambientales (una planta de carbón: 100)', Math.round(50 * Policy.industrialPollutionFactor()))],
      poll: {eases: [JOB], adds: [POL, TRA]}},
    road: {build: tc.road, year: road, perTile: true,
      good: [P('Connects zones; homes and factories need only a road and power to grow', 'Conecta zonas; viviendas y fábricas solo necesitan calle y electricidad para crecer')],
      bad: [P('Busy road pollutes (50 per tile, 75 when jammed) and a jammed road costs double upkeep', 'Una calle concurrida contamina (50 por casilla, 75 atascada) y una atascada cuesta el doble de mantenimiento')],
      poll: {eases: [], adds: [TRA, POL]}},
    highway: {build: tc.road + Policy.highwayExtra(), year: 3 * road, perTile: true,
      good: [P('Trips go three times as far on it; half the congestion; its bridges never open', 'Los viajes llegan tres veces más lejos; la mitad de congestión; sus puentes nunca se abren')],
      bad: [P('Three times a road\'s upkeep, even where nobody drives', 'Tres veces el mantenimiento de una calle, aunque nadie pase')],
      poll: {eases: [TRA], adds: []}},
    rail: {build: tc.rail, year: rail, perTile: true,
      good: [P('Cars can use it on their trips and it never jams; needed by train depots', 'Los carros pueden usarla en sus viajes y nunca se atasca; la necesitan las estaciones')],
      bad: [P('Beside a road, every tile becomes a junction where cars wander off: cross at right angles', 'Junto a una calle, cada casilla es un cruce donde los carros se desvían: crúzalas en ángulo recto')],
      poll: {eases: [TRA], adds: []}},
    depot: {build: 1000, year: Utilities.DEPOT_MAINTENANCE,
      good: [P('Zones within {0} tiles travel twice as far and put half their traffic on the roads', 'Las zonas a menos de {0} casillas viajan el doble y ponen la mitad de su tráfico en las calles', Utilities.DEPOT_RADIUS)],
      bad: [P('Works only if rail touches it and reaches another depot or loops back', 'Solo funciona si una vía la toca y llega a otra estación o vuelve sobre sí misma')],
      poll: {eases: [TRA, POL], adds: []}},
    wire: {build: 5, year: 0,
      good: [P('Carries power to zones (zones that touch pass it on)', 'Lleva electricidad a las zonas (las que se tocan se la pasan)')], bad: [], poll: {eases: [], adds: []}},
    coal: {build: 3000, year: 0,
      good: [P('Power for 700 units (each zone or power-line tile uses one)', 'Electricidad para 700 unidades (cada zona o casilla de cable usa una)')],
      bad: [P('Pollution 100 per tile, the heaviest source; lowers land value around it', 'Contaminación 100 por casilla, la fuente más fuerte; baja el valor del suelo alrededor')],
      poll: {eases: [JOB], adds: [POL]}},
    nuclear: {build: 5000, year: 0,
      good: [P('Power for 2,000 units and no pollution', 'Electricidad para 2,000 unidades y sin contaminación')],
      bad: [P('With disasters on, it can melt down and leave radiation', 'Con los desastres activados puede fundirse y dejar radiación')],
      poll: {eases: [JOB], adds: []}},
    water: {build: 2000, year: Utilities.WATER_PLANT_MAINTENANCE,
      good: [P('Treats the sewage of zones within {0} tiles: rivers and banks stay clean (land value along them)', 'Trata las aguas residuales de las zonas a menos de {0} casillas: ríos y orillas limpios (valor del suelo junto a ellos)', Utilities.WATER_RADIUS)],
      bad: [P('Needs power', 'Necesita electricidad')], poll: {eases: [POL], adds: [HOU]}},
    police: {build: 500, year: POLICE_YEAR,
      good: [P('Less crime: up to {0} points in its own 8-tile square, about {1} in the next squares, {2} on the diagonal, {3} two squares away (at full funding)',
               'Menos delincuencia: hasta {0} puntos en su propio cuadro de 8 casillas, unos {1} en los cuadros vecinos, {2} en diagonal, {3} a dos cuadros (con fondos completos)',
               STATION[0], STATION[1], STATION[2], STATION[3])],
      bad: [P('Its effect falls with its funding in the Budget window', 'Su efecto baja con sus fondos en la ventana de Presupuesto')], poll: {eases: [C], adds: []}},
    fire: {build: 500, year: FIRE_YEAR,
      good: [P('Fires spread less and go out sooner, strongest in its own 8-tile square', 'Los incendios se extienden menos y se apagan antes, sobre todo en su propio cuadro de 8 casillas')],
      bad: [P('Fires only start from disasters, crashes and meltdowns', 'Los incendios solo empiezan por desastres, accidentes y fusiones')], poll: {eases: [FIR], adds: []}},
    hospital: {build: 3000, year: Utilities.HOSPITAL_MAINTENANCE,
      good: [P('Homes within {0} tiles gain 15 points of land value (more taxes)', 'Las viviendas a menos de {0} casillas ganan 15 puntos de valor del suelo (más impuestos)', Utilities.HEALTH_RADIUS)],
      bad: [P('Needs power; higher land value also means residents complain more about housing costs', 'Necesita electricidad; un suelo más caro también hace que los residentes se quejen más del costo de la vivienda')],
      poll: {eases: [], adds: [HOU]}},
    school: {build: 1500, year: Education.SCHOOL_MAINTENANCE,
      good: [P('Serves homes within {0} tiles; over a few years crime falls everywhere, by up to 14 points when schools serve every home (20 with colleges too)', 'Atiende viviendas a menos de {0} casillas; en unos años baja la delincuencia en toda la ciudad, hasta 14 puntos si las escuelas atienden todas las viviendas (20 con universidades también)', Education.SCHOOL_RADIUS)],
      bad: [P('Needs power; the effect builds up slowly and fades slowly', 'Necesita electricidad; el efecto llega y se va despacio')], poll: {eases: [C], adds: []}},
    college: {build: 5000, year: Education.COLLEGE_MAINTENANCE,
      good: [P('Serves homes within {0} tiles; shops and factories plan for up to 10% more business', 'Atiende viviendas a menos de {0} casillas; tiendas y fábricas esperan hasta un 10% más de negocio', Education.COLLEGE_RADIUS)],
      bad: [P('Needs power; the dearest running cost of any building', 'Necesita electricidad; el mantenimiento más caro de todos los edificios')], poll: {eases: [JOB, C], adds: []}},
    park: {build: Policy.PARK_COST, year: 0,
      good: [P('{0} points less crime within {1} tiles; raises land value a little', '{0} puntos menos de delincuencia a menos de {1} casillas; sube un poco el valor del suelo', Amenities.SMALL_PARK_CRIME, 2)],
      bad: [], poll: {eases: [C], adds: []}},
    bigpark: {build: Policy.BIG_PARK_COST, year: 0,
      good: [P('{0} points less crime and {1}% less air pollution within {2} tiles', '{0} puntos menos de delincuencia y un {1}% menos de contaminación del aire a menos de {2} casillas', Amenities.BIG_PARK_CRIME, Math.round(100 * (1 - Amenities.BIG_PARK_AIR)), Amenities.BIG_PARK_RADIUS)],
      bad: [], poll: {eases: [C, POL], adds: []}},
    stadium: {build: 5000, year: 0,
      good: [P('Without one, homes stop growing once about 10,000 people live in them', 'Sin estadio, las viviendas dejan de crecer cuando viven en ellas unas 10,000 personas')], bad: [], poll: {eases: [], adds: []}},
    port: {build: 3000, year: 0,
      good: [P('Without one, factories stop growing once they employ about 11,000 people; ships use the channel', 'Sin puerto, las fábricas dejan de crecer cuando emplean a unas 11,000 personas; los barcos usan el canal')],
      bad: [P('Build it on the shore; road bridges over the channel open for its ships', 'Constrúyelo en la orilla; los puentes de calle sobre el canal se abren para sus barcos')], poll: {eases: [JOB], adds: []}},
    airport: {build: 10000, year: 0,
      good: [P('Without one, shops stop growing once they employ about 16,000 people', 'Sin aeropuerto, las tiendas dejan de crecer cuando emplean a unas 16,000 personas')],
      bad: [P('Planes can crash (with disasters on)', 'Los aviones pueden estrellarse (con los desastres activados)')], poll: {eases: [JOB], adds: []}}
  };
  return d[tool] || null;
};

// Fills the card element for a tool; returns false if the tool has no card
var render = function(el, tool, label, sim) {
  var d = info(tool, sim);
  if (!d)
    return false;
  el.innerHTML = '';
  var add = function(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    el.appendChild(e);
    return e;
  };
  add('div', 'tiTitle', label);
  var costs = add('div', 'tiCosts');
  costs.textContent = P('Build: {0}{1}', 'Construir: {0}{1}', money(d.build), d.perTile ? P(' a tile', ' por casilla') : '') + '  ·  ' +
    (d.year ? P('Running cost: {0} a year{1}', 'Mantenimiento: {0} al año{1}', d.perTile ? perTile(d.year) : money(d.year), d.perTile ? P(' a tile', ' por casilla') : '')
            : P('No yearly running cost', 'Sin mantenimiento anual'));
  var list = function(items, cls, sign) {
    if (!items.length) return;
    var ul = add('ul', cls);
    items.forEach(function(t) { var li = document.createElement('li'); li.textContent = sign + ' ' + t; ul.appendChild(li); });
  };
  list(d.good, 'tiGood', '+');
  list(d.bad, 'tiBad', '−');
  if (d.poll.eases.length || d.poll.adds.length) {
    var poll = add('div', 'tiPoll');
    var parts = [];
    if (d.poll.eases.length) parts.push(P('eases complaints about {0}', 'reduce las quejas por {0}', d.poll.eases.join(', ')));
    if (d.poll.adds.length) parts.push(P('can add complaints about {0}', 'puede sumar quejas por {0}', d.poll.adds.join(', ')));
    poll.textContent = P('Approval (the yearly poll): {0}.', 'Aprobación (la encuesta anual): {0}.', parts.join(P('; ', '; ')));
  }
  return true;
};

var ToolInfo = {info: info, render: render};

export { ToolInfo };

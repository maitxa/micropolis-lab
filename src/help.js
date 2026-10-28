/* Policy Lab additions to micropolisJS (2026).
 *
 * This code is released under the GNU GPL v3, with some additional terms, like the rest of micropolisJS.
 * Modified version: NOT the original micropolisJS / Micropolis.
 *
 * Help shown when hovering over a message in the message bar: why it happens (according to the simulation's
 * actual rules) and what the player can do about it.
 */

import { I18n } from './i18n.js';
import * as Messages from './messages.ts';

var help = {};

var add = function(subject, why, fixes) {
  help[subject] = {why: why, fixes: fixes};
};

// ---- Demand and growth ----
add(Messages.NEED_MORE_RESIDENTIAL,
    'There are more jobs (commercial + industrial) than residents, so people want to move in.',
    ['Zone more Residential land, connected by road and powered.',
     'Put homes near water, trees or parks and away from pollution: they grow faster on valuable land.']);
add(Messages.NEED_MORE_COMMERCIAL,
    'Shops want to serve your population, and there is labour available.',
    ['Zone more Commercial land, preferably near the city centre (shops score higher there).',
     'Shops must be able to drive to customers: connect them by road to homes and industry.']);
add(Messages.NEED_MORE_INDUSTRIAL,
    'The outside market wants more of what your city produces, and there are workers available.',
    ['Zone more Industrial land, away from homes (factories pollute).',
     'Keep industry within reach of homes by road or rail: workers commute, and long commutes add traffic.']);
add(Messages.NEED_MORE_ROADS,
    'Many zones have no road access. Zones without a road on their edge cannot grow and will shrink.',
    ['Run a road along at least one edge of every zone.',
     'Tip: click a starting tile, then Shift+click the end to draw a straight road.']);
add(Messages.NEED_MORE_RAILS,
    'Your city is large but has little rail.',
    ['Add rail lines between residential and job areas to share the load with roads.',
     'Under the "Transit" transportation law, rail is cheaper to build and maintain.']);
add(Messages.NEED_ELECTRICITY,
    'Zones grow only when they have power.',
    ['Build a Coal or Nuclear power plant (if nuclear is allowed by your laws).',
     'Connect it to zones with power lines (Wire tool). Zones touching each other pass power along.']);
add(Messages.NOT_ENOUGH_POWER,
    'Your power plants cannot supply all the zones connected to them, so some go dark and stop growing.',
    ['Build another power plant and connect it to the grid.',
     'Check for zones connected by a single long wire: a break anywhere cuts everything after it.']);
add(Messages.BLACKOUTS_REPORTED,
    'Demand for electricity is higher than your plants can produce.',
    ['Build another power plant.',
     'A coal plant pollutes; nuclear does not, but risks a meltdown.']);

// ---- Services ----
add(Messages.NEED_POLICE_STATION,
    'Your population is large enough that residents expect police coverage.',
    ['Build a Police station near dense or low-value neighbourhoods, where crime is highest.',
     'Fund police at 100% in the Budget window.']);
add(Messages.NEED_FIRE_STATION,
    'Your population is large enough that residents expect fire protection.',
    ['Build a Fire station; its coverage fades with distance, so spread them out.',
     'Fund fire at 100% in the Budget window.']);
add(Messages.POLICE_NEEDS_FUNDING,
    'Police are funded below 100%, so their stations suppress less crime.',
    ['Raise police funding in the Budget window (if the budget is open this year).']);
add(Messages.FIRE_STATION_NEEDS_FUNDING,
    'Fire departments are funded below 100%, so fires spread further before being put out.',
    ['Raise fire funding in the Budget window (if the budget is open this year).']);
add(Messages.ROAD_NEEDS_FUNDING,
    'Roads are funded below 100%, so some road tiles crumble each year.',
    ['Raise road funding in the Budget window.',
     'Fewer, better-planned roads cost less to maintain.']);
add(Messages.NEED_STADIUM,
    'Residential growth is capped until you build a stadium (population over 500).',
    ['Build a Stadium near residential areas. Until then, residential demand cannot rise above zero.']);
add(Messages.NEED_SEAPORT,
    'Industrial growth is capped until you build a seaport.',
    ['Build a Seaport on the shoreline, connected by road and power.']);
add(Messages.NEED_AIRPORT,
    'Commercial growth is capped until you build an airport.',
    ['Build an Airport (it needs a large flat area) connected by road and power.']);

// ---- Problems ----
add(Messages.HIGH_POLLUTION,
    'Pollution comes from industry, coal power plants, heavy traffic, fires and radiation. It lowers land value and drives residents away.',
    ['Keep industry and coal plants away from homes; leave trees or parks in between.',
     'Reduce traffic: more rail, better road layouts, homes closer to jobs.',
     'Policy Lab: strict environmental rules halve industrial pollution (at a cost to industrial growth).',
     'Replace coal with nuclear power, if your laws allow it.']);
add(Messages.HIGH_CRIME,
    'Crime in this game rises on cheap land and in crowded areas, and falls near funded police stations, parks and funded social services.',
    ['Build police stations in the worst areas and fund them fully.',
     'Raise land value: parks, trees and water nearby, less pollution.',
     'Policy Lab: fund Social services in the Budget window; they help most in the poorest areas.']);
add(Messages.HEAVY_TRAFFIC,
    'Some roads are carrying a lot of traffic. Heavy traffic pollutes nearby land.',
    ['Add parallel roads or rail lines to spread the traffic.',
     'Put homes, shops and jobs closer together so trips are shorter.']);
add(Messages.TRAFFIC_JAMS,
    'Many roads are congested. Traffic pollution lowers land value along them.',
    ['Build rail between residential and job areas.',
     'Avoid funnelling the whole city through one road.']);
add(Messages.TAX_TOO_HIGH,
    'Taxes above 12% upset residents, and higher taxes slow every kind of growth.',
    ['Lower the tax rate in the Budget window.',
     'Cut costs instead: fewer roads to maintain, services sized to need.']);
add(Messages.NO_MONEY,
    'Your city has spent all its money.',
    ['Lower spending in the Budget window (the game will ask you to revise it).',
     'Raise taxes a little, or let the city grow its tax base before building more.']);

// ---- Disasters ----
add(Messages.FIRE_REPORTED,
    'A fire has started. Without fire coverage it can spread.',
    ['Click the message to jump to the fire.',
     'Bulldoze a gap around it to stop it spreading; build fire stations to prevent future fires.']);
add(Messages.FLOODING_REPORTED,
    'Water has flooded land near the shore. Floods recede on their own after a while.',
    ['Wait it out, then rebuild. Avoid building right on the waterline.']);
add(Messages.TORNADO_SIGHTED,
    'A tornado is destroying buildings along its path. It will disappear on its own.',
    ['Rebuild afterwards. You can switch random disasters off in Settings.']);
add(Messages.MONSTER_SIGHTED,
    'A monster appears only when pollution is high, and goes for the most polluted areas.',
    ['Reduce pollution to stop it coming back. You can switch random disasters off in Settings.']);
add(Messages.EARTHQUAKE,
    'An earthquake has damaged the city.',
    ['Rebuild damaged areas and put out fires.']);
add(Messages.EXPLOSION_REPORTED,
    'Something exploded (often a crash or a fire).',
    ['Click to jump there, clear the rubble and rebuild.']);
add(Messages.NUCLEAR_MELTDOWN,
    'A nuclear plant melted down, leaving radioactive land that cannot be used for a very long time.',
    ['Build elsewhere. Policy Lab: you can ban nuclear power at setup if you would rather not take the risk.']);
add(Messages.PLANE_CRASHED, 'A plane crashed near the airport.', ['Clear the wreckage and rebuild.']);
add(Messages.SHIP_CRASHED, 'A ship was wrecked.', ['Nothing to do but clear up.']);
add(Messages.TRAIN_CRASHED, 'A train crashed.', ['Clear the wreckage and repair the rail.']);
add(Messages.HELICOPTER_CRASHED, 'A traffic helicopter crashed.', ['Clear the wreckage and rebuild.']);

// ---- Good news ----
var milestone = ['Well done! Bigger cities bring new demands (stadium, seaport, airport) and bigger problems.',
                 'Check the Evaluation window to see what residents worry about most.'];
add(Messages.REACHED_TOWN, 'Your population passed 2,000.', milestone);
add(Messages.REACHED_CITY, 'Your population passed 10,000.', milestone);
add(Messages.REACHED_CAPITAL, 'Your population passed 50,000.', milestone);
add(Messages.REACHED_METROPOLIS, 'Your population passed 100,000.', milestone);
add(Messages.REACHED_MEGALOPOLIS, 'Your population passed 500,000.', milestone);
add(Messages.WELCOME,
    'Start with a power plant, a few Residential, Commercial and Industrial zones, roads along their edges and power lines.',
    ['Watch the Zoning need bars (bottom left): above the line, zone more of that kind; below it, don\'t.',
     'Keyboard: number keys pick tools, Shift+click draws straight lines, Ctrl+Z (Cmd+Z) undoes. Press ? for the list.']);


// ---- Spanish (U.S.) ----
var es = {};
var addES = function(subject, why, fixes) {
  es[subject] = {why: why, fixes: fixes};
};

addES(Messages.NEED_MORE_RESIDENTIAL,
      'Hay más empleos (comerciales + industriales) que residentes, así que la gente quiere mudarse aquí.',
      ['Zonifica más terreno residencial, conectado por calle y con electricidad.', 'Pon las viviendas cerca del agua, los árboles o los parques y lejos de la contaminación: crecen más rápido en suelo valioso.']);
addES(Messages.NEED_MORE_COMMERCIAL,
      'Las tiendas quieren atender a tu población, y hay mano de obra disponible.',
      ['Zonifica más terreno comercial, mejor cerca del centro (allí las tiendas puntúan más).', 'Las tiendas tienen que poder llegar en carro a sus clientes: conéctalas por calle con las viviendas y la industria.']);
addES(Messages.NEED_MORE_INDUSTRIAL,
      'El mercado exterior quiere más de lo que produce tu ciudad, y hay trabajadores disponibles.',
      ['Zonifica más terreno industrial, lejos de las viviendas (las fábricas contaminan).', 'Mantén la industria al alcance de las viviendas por calle o vía férrea: los trabajadores van y vienen, y los trayectos largos generan tráfico.']);
addES(Messages.NEED_MORE_ROADS,
      'Muchas zonas no tienen acceso por calle. Las zonas sin una calle en su borde no pueden crecer y se reducen.',
      ['Pon una calle a lo largo de al menos un borde de cada zona.', 'Consejo: haz clic en una casilla de inicio y luego Shift+clic en el final para trazar una calle recta.']);
addES(Messages.NEED_MORE_RAILS,
      'Tu ciudad es grande pero tiene poca vía férrea.',
      ['Añade vías férreas entre las zonas residenciales y las de empleo para repartir la carga con las calles.', 'Con la ley de transporte "Transporte público", la vía férrea es más barata de construir y mantener.']);
addES(Messages.NEED_ELECTRICITY,
      'Las zonas solo crecen si tienen electricidad.',
      ['Construye una planta de carbón o nuclear (si tus leyes permiten la energía nuclear).', 'Conéctala a las zonas con cables eléctricos (herramienta Cable). Las zonas que se tocan se pasan la electricidad.']);
addES(Messages.NOT_ENOUGH_POWER,
      'Tus plantas eléctricas no alcanzan para todas las zonas conectadas, así que algunas se quedan a oscuras y dejan de crecer.',
      ['Construye otra planta eléctrica y conéctala a la red.', 'Revisa las zonas conectadas por un solo cable largo: un corte en cualquier punto deja sin luz todo lo que sigue.']);
addES(Messages.BLACKOUTS_REPORTED,
      'La demanda de electricidad es mayor que lo que producen tus plantas.',
      ['Construye otra planta eléctrica.', 'Una planta de carbón contamina; una nuclear no, pero tiene riesgo de fusión.']);
addES(Messages.NEED_POLICE_STATION,
      'Tu población ya es lo bastante grande como para que los residentes esperen tener policía.',
      ['Construye una estación de policía cerca de los vecindarios densos o de poco valor, donde hay más delincuencia.', 'Financia la policía al 100% en la ventana de Presupuesto.']);
addES(Messages.NEED_FIRE_STATION,
      'Tu población ya es lo bastante grande como para que los residentes esperen protección contra incendios.',
      ['Construye una estación de bomberos; su cobertura disminuye con la distancia, así que repártelas.', 'Financia a los bomberos al 100% en la ventana de Presupuesto.']);
addES(Messages.POLICE_NEEDS_FUNDING,
      'La policía tiene menos del 100% de sus fondos, así que sus estaciones frenan menos la delincuencia.',
      ['Sube los fondos de la policía en la ventana de Presupuesto (si el presupuesto está abierto este año).']);
addES(Messages.FIRE_STATION_NEEDS_FUNDING,
      'Los bomberos tienen menos del 100% de sus fondos, así que los incendios se extienden más antes de apagarse.',
      ['Sube los fondos de los bomberos en la ventana de Presupuesto (si el presupuesto está abierto este año).']);
addES(Messages.ROAD_NEEDS_FUNDING,
      'Las calles tienen menos del 100% de sus fondos, así que algunas casillas de calle se deterioran cada año.',
      ['Sube los fondos de las calles en la ventana de Presupuesto.', 'Menos calles, mejor planificadas, cuestan menos de mantener.']);
addES(Messages.NEED_STADIUM,
      'El crecimiento residencial está limitado hasta que construyas un estadio (población de más de 500).',
      ['Construye un estadio cerca de las zonas residenciales. Hasta entonces, la demanda residencial no puede subir de cero.']);
addES(Messages.NEED_SEAPORT,
      'El crecimiento industrial está limitado hasta que construyas un puerto.',
      ['Construye un puerto en la costa, conectado por calle y con electricidad.']);
addES(Messages.NEED_AIRPORT,
      'El crecimiento comercial está limitado hasta que construyas un aeropuerto.',
      ['Construye un aeropuerto (necesita un área grande y plana) conectado por calle y con electricidad.']);
addES(Messages.HIGH_POLLUTION,
      'La contaminación viene de la industria, las plantas de carbón, el tráfico intenso, los incendios y la radiación. Baja el valor del suelo y aleja a los residentes.',
      ['Mantén la industria y las plantas de carbón lejos de las viviendas; deja árboles o parques entre medio.', 'Reduce el tráfico: más vías férreas, mejores trazados de calles, viviendas más cerca del empleo.', 'Laboratorio de Políticas: las normas ambientales estrictas reducen a la mitad la contaminación industrial (a costa del crecimiento industrial).', 'Cambia el carbón por energía nuclear, si tus leyes lo permiten.']);
addES(Messages.HIGH_CRIME,
      'En este juego, la delincuencia sube en el suelo barato y en las zonas abarrotadas, y baja cerca de estaciones de policía con fondos, de los parques y de los servicios sociales con fondos.',
      ['Construye estaciones de policía en las peores zonas y financia el 100%.', 'Sube el valor del suelo: parques, árboles y agua cerca, menos contaminación.', 'Laboratorio de Políticas: financia los servicios sociales en la ventana de Presupuesto; ayudan sobre todo en las zonas más pobres.']);
addES(Messages.HEAVY_TRAFFIC,
      'Algunas calles llevan mucho tráfico. El tráfico intenso contamina el terreno cercano.',
      ['Añade calles paralelas o vías férreas para repartir el tráfico.', 'Pon viviendas, tiendas y empleos más cerca unos de otros para que los viajes sean más cortos.']);
addES(Messages.TRAFFIC_JAMS,
      'Muchas calles están congestionadas. La contaminación del tráfico baja el valor del suelo a su alrededor.',
      ['Construye vías férreas entre las zonas residenciales y las de empleo.', 'Evita que toda la ciudad tenga que pasar por una sola calle.']);
addES(Messages.TAX_TOO_HIGH,
      'Los impuestos por encima del 12% molestan a los residentes, y los impuestos más altos frenan todo tipo de crecimiento.',
      ['Baja la tasa de impuestos en la ventana de Presupuesto.', 'Recorta gastos en su lugar: menos calles que mantener, servicios a la medida de lo que se necesita.']);
addES(Messages.NO_MONEY,
      'Tu ciudad gastó todo su dinero.',
      ['Baja los gastos en la ventana de Presupuesto (el juego te pedirá que lo revises).', 'Sube un poco los impuestos, o deja que la ciudad amplíe su base fiscal antes de construir más.']);
addES(Messages.FIRE_REPORTED,
      'Empezó un incendio. Sin cobertura de bomberos, puede extenderse.',
      ['Haz clic en el mensaje para ir al incendio.', 'Demuele un espacio alrededor para que no se extienda; construye estaciones de bomberos para prevenir incendios.']);
addES(Messages.FLOODING_REPORTED,
      'El agua inundó terreno cerca de la costa. Las inundaciones bajan solas después de un tiempo.',
      ['Espera a que pase y luego reconstruye. Evita construir justo en la orilla.']);
addES(Messages.TORNADO_SIGHTED,
      'Un tornado está destruyendo edificios a su paso. Desaparecerá solo.',
      ['Reconstruye después. Puedes desactivar los desastres aleatorios en Configuración.']);
addES(Messages.MONSTER_SIGHTED,
      'Un monstruo solo aparece cuando la contaminación es alta, y va hacia las zonas más contaminadas.',
      ['Reduce la contaminación para que no vuelva. Puedes desactivar los desastres aleatorios en Configuración.']);
addES(Messages.EARTHQUAKE,
      'Un terremoto dañó la ciudad.',
      ['Reconstruye las zonas dañadas y apaga los incendios.']);
addES(Messages.EXPLOSION_REPORTED,
      'Algo explotó (a menudo por un accidente o un incendio).',
      ['Haz clic para ir allí, retira los escombros y reconstruye.']);
addES(Messages.NUCLEAR_MELTDOWN,
      'Una planta nuclear sufrió una fusión y dejó terreno radiactivo que no se podrá usar en mucho tiempo.',
      ['Construye en otro lugar. Laboratorio de Políticas: puedes prohibir la energía nuclear al configurar la partida si prefieres no correr el riesgo.']);
addES(Messages.PLANE_CRASHED,
      'Se estrelló un avión cerca del aeropuerto.',
      ['Retira los restos y reconstruye.']);
addES(Messages.SHIP_CRASHED,
      'Naufragó un barco.',
      ['Solo queda limpiar.']);
addES(Messages.TRAIN_CRASHED,
      'Se estrelló un tren.',
      ['Retira los restos y repara la vía.']);
addES(Messages.HELICOPTER_CRASHED,
      'Se estrelló un helicóptero de tráfico.',
      ['Retira los restos y reconstruye.']);
addES(Messages.WELCOME,
      'Empieza con una planta eléctrica, algunas zonas residenciales, comerciales e industriales, calles en sus bordes y cables eléctricos.',
      ['Mira las barras de Necesidad de zonas (abajo a la izquierda): arriba de la línea, zonifica más de ese tipo; abajo, no.', 'Teclado: los números eligen herramientas, Shift+clic traza líneas rectas, Ctrl+Z (Cmd+Z) deshace. Pulsa ? para ver la lista.']);
var milestoneES = ['¡Bien hecho! Las ciudades más grandes traen nuevas demandas (estadio, puerto, aeropuerto) y problemas más grandes.',
                    'Revisa la ventana de Evaluación para ver lo que más preocupa a los residentes.'];
addES(Messages.REACHED_TOWN, 'Tu población superó los 2,000 habitantes.', milestoneES);
addES(Messages.REACHED_CITY, 'Tu población superó los 10,000 habitantes.', milestoneES);
addES(Messages.REACHED_CAPITAL, 'Tu población superó los 50,000 habitantes.', milestoneES);
addES(Messages.REACHED_METROPOLIS, 'Tu población superó los 100,000 habitantes.', milestoneES);
addES(Messages.REACHED_MEGALOPOLIS, 'Tu población superó los 500,000 habitantes.', milestoneES);


var Help = {
  // The help for a message, in the current language
  forMessage: function(subject) {
    if (I18n.lang() === 'es' && es[subject])
      return es[subject];
    return help[subject] || null;
  }
};


export { Help };

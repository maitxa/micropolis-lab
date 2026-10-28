/* Policy Lab additions to micropolisJS (2026).
 *
 * This code is released under the GNU GPL v3, with some additional terms, like the rest of micropolisJS.
 * Modified version: NOT the original micropolisJS / Micropolis.
 *
 * Policy presets (v29): each fills in the five choices on the setup screen. The world model (how the world works) is fixed
 * and the same for every preset, so no preset can "win" just because the rules were written to agree with it.
 *
 * Each preset is a translation of NATIONAL platforms into a CITY game, so it is an analogy throughout. Positions were
 * taken from what each movement says itself (sources below), reviewed for fairness by the course instructor.
 */

var PRESETS = {
  original: {
    label: '1989 baseline',
    values: {taxes: 'medium', business: 'none', energy: 'standard', housing: 'separate', transport: 'balanced'},
    note: 'The policies of the original 1989 game: a neutral starting point to compare the others with.',
    noteEs: 'Las políticas del juego original de 1989: un punto de partida neutral para comparar los demás.',
    sources: []
  },

  progressive: {
    label: 'Progressive (Sanders-style)',
    values: {taxes: 'high', business: 'none', energy: 'strict', housing: 'mixed', transport: 'transit'},
    note: 'Higher taxes funding social services and social housing in full; no corporate tax breaks; strict environmental ' +
          'rules and no new nuclear power; transit and rail over roads; no limit on housing density (against "exclusionary ' +
          'zoning"). Mixed use is an INFERENCE from that opposition, not a stated position.',
    noteEs: 'Impuestos más altos que financian por completo los servicios sociales y la vivienda social; sin exenciones fiscales para ' +
            'las corporaciones; normas ambientales estrictas y nada de energía nuclear nueva; transporte público y trenes antes que ' +
            'calles; sin límite de densidad de vivienda (en contra de la "zonificación excluyente"). El uso mixto es una INFERENCIA a ' +
            'partir de esa oposición, no una postura declarada.',
    sources: [
      ['NLIHC: Bernie Sanders Releases Affordable Housing Plan', 'https://nlihc.org/resource/bernie-sanders-releases-affordable-housing-plan'],
      ['MIT Technology Review: Sanders’s climate plan', 'https://www.technologyreview.com/2020/02/28/905621/bernie-sanders-has-an-audaciousand-hugely-expensiveclimate-plan/'],
      ['The New Republic: Sanders’s nuclear phaseout plan', 'https://newrepublic.com/article/132217/bernie-sanderss-nuclear-phaseout-plan-hippie-pipe-dream-smart-policy'],
      ['Jacobin: Welfare, But for CEOs (Sanders on corporate welfare)', 'https://jacobin.com/2018/08/bernie-sanders-jeff-bezos-corporate-welfare-inequality']
    ]
  },

  populist: {
    label: 'Conservative-populist (MAGA-style)',
    values: {taxes: 'low', business: 'strong', energy: 'relaxed', housing: 'suburban', transport: 'roads'},
    note: 'Low taxes; strong incentives for businesses that produce at home; environmental rules relaxed (in 2026 the EPA ' +
          'repealed the 2009 greenhouse-gas "endangerment finding"; "Relaxed", not "None": the platform calls for cutting ' +
          '"burdensome" rules, not abolishing them) and nuclear power expanded; roads over rail and transit; social services ' +
          'reduced through work requirements (25%), no social housing. Medium density at most is an INFERENCE from the 2020 ' +
          '"protect the suburbs" stance; the 2026 housing orders cut other barriers to building and do not mention zoning.',
    noteEs: 'Impuestos bajos; incentivos fuertes para las empresas que producen en el país; normas ambientales relajadas (en 2026 la ' +
            'EPA derogó el "hallazgo de peligro" de 2009 sobre gases de efecto invernadero; "Relajadas", no "Ninguna": la plataforma ' +
            'pide recortar las normas "onerosas", no abolirlas) y más energía nuclear; calles antes que trenes y transporte público; ' +
            'servicios sociales reducidos mediante requisitos de trabajo (25%), sin vivienda social. La densidad media como máximo es una ' +
            'INFERENCIA a partir de la postura de 2020 de "proteger los suburbios"; las órdenes de vivienda de 2026 recortan otras ' +
            'barreras a la construcción y no mencionan la zonificación.',
    sources: [
      ['NBC: The Republican party’s 2024 platform', 'https://www.nbcwashington.com/news/national-international/the-republican-partys-2024-platform-reflects-a-trump-centric-shift-in-policies/3661801/'],
      ['E&E News: EPA repeals endangerment finding (2026)', 'https://www.eenews.net/articles/epa-repeals-endangerment-finding/'],
      ['Fox 5 NY: Trump on suburbs and low-income housing (2020)', 'https://www.fox5ny.com/news/trump-tells-voters-who-live-in-suburbs-they-will-no-longer-be-bothered-by-low-income-housing'],
      ['Sabin Center: 2026 order on barriers to home construction', 'https://climate.law.columbia.edu/content/president-trump-issues-executive-order-directing-removal-regulatory-barriers-affordable'],
      ['Planetizen: Trump budget cuts passenger rail funding 82%', 'https://www.planetizen.com/news/2026/04/137380-trump-budget-slashes-passenger-rail-funding-82'],
      ['Introl: Trump nuclear executive orders target 400 GW by 2050', 'https://introl.com/blog/trump-400-gw-nuclear-executive-orders-2050-target'],
      ['Health Affairs: 2025 reconciliation bill coverage provisions', 'https://www.healthaffairs.org/content/forefront/house-republicans-pass-budget-reconciliation-legislation-s-new-coverage-provisions']
    ]
  },

  libertarian: {
    label: 'Libertarian',
    values: {taxes: 'minimal', business: 'none', energy: 'none', housing: 'mixed', transport: 'balanced'},
    note: 'Taxes as low as the game allows ("eventual repeal of all taxation"); no social programs (help for the poor through ' +
          '"voluntary efforts of private groups"); no business subsidies ("all forms"); no environmental regulation: pollution ' +
          'is to be handled through property rights and "restitution" in court, which this game cannot model, so here it simply ' +
          'goes unchecked; nuclear allowed (no government control of energy production). Mixed use with no density limit is ' +
          'an INFERENCE ("free property owners from government restrictions"): the platform does not mention zoning. ' +
          'Transportation: no stated position, so balanced.',
    noteEs: 'Impuestos tan bajos como permite el juego ("derogación final de todos los impuestos"); sin programas sociales (la ayuda a ' +
            'los pobres, mediante "esfuerzos voluntarios de grupos privados"); sin subsidios a las empresas ("de ninguna forma"); sin ' +
            'regulación ambiental: la contaminación se resolvería con derechos de propiedad y "restitución" en los tribunales, algo que ' +
            'este juego no puede modelar, así que aquí simplemente no se controla; energía nuclear permitida (sin control del gobierno ' +
            'sobre la producción de energía). El uso mixto sin límite de densidad es una INFERENCIA ("liberar a los propietarios de las ' +
            'restricciones del gobierno"): la plataforma no menciona la zonificación. Transporte: sin postura declarada, así que equilibrado.',
    sources: [
      ['Libertarian Party Platform (2022)', 'https://lpne.org/wp-content/uploads/2025/11/2022_LP_Platform.pdf'],
      ['Acton Institute: What to know about the Libertarian Party platform', 'https://blog.acton.org/?p=88488']
    ]
  }
};

var COMMON_NOTE = 'National platforms are translated into a city game, so this is an analogy. The world works the same way ' +
                  'for every preset. The game has a single flat city tax, so it cannot show "who" is taxed. You can change ' +
                  'any choice before playing, and taxes and funding during play.';


var COMMON_NOTE_ES = 'Las plataformas nacionales se trasladan a un juego de ciudades, así que esto es una analogía. El mundo funciona ' +
                     'igual para todos los perfiles. El juego tiene un único impuesto municipal fijo, así que no puede mostrar "a quién" ' +
                     'se le cobra. Puedes cambiar cualquier opción antes de jugar, y los impuestos y fondos durante el juego.';


var Presets = {
  all: PRESETS,
  commonNote: COMMON_NOTE,
  commonNoteEs: COMMON_NOTE_ES,
  // Names of the setup-screen fields a preset controls (without the "pl_" prefix)
  fields: ['taxes', 'business', 'energy', 'housing', 'transport'],
  // POLICY LAB v29: what each of the five choices sets
  choices: {
    taxes: {high: {taxStart: 9, socialStart: 100, housingStart: 100}, medium: {taxStart: 7, socialStart: 0, housingStart: 0},
            low: {taxStart: 5, socialStart: 25, housingStart: 0}, minimal: {taxStart: 3, socialStart: 0, housingStart: 0}},
    business: {none: {incentives: 'none'}, strong: {incentives: 'strong'}},
    energy: {strict: {regulation: 'strict', nuclearAllowed: false}, standard: {regulation: 'standard', nuclearAllowed: true},
             relaxed: {regulation: 'relaxed', nuclearAllowed: true}, none: {regulation: 'none', nuclearAllowed: true}},
    housing: {mixed: {zoning: 'mixed', densityCap: 40}, separate: {zoning: 'exclusive', densityCap: 40},
              suburban: {zoning: 'exclusive', densityCap: 24}},
    transport: {transit: {transport: 'transit'}, balanced: {transport: 'balanced'}, roads: {transport: 'roads'}}
  }
};


export { Presets };

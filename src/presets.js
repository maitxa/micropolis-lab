/* Policy Lab additions to micropolisJS (2026).
 *
 * This code is released under the GNU GPL v3, with some additional terms, like the rest of micropolisJS.
 * Modified version: NOT the original micropolisJS / Micropolis.
 *
 * Policy presets. A preset fills in the LAWS and the STARTING BUDGET only. It never touches the world model
 * (how the world works), so no preset can "win" just because the rules were written to agree with it.
 *
 * Each preset is a translation of NATIONAL platforms into a CITY game, so it is an analogy throughout. Positions were
 * taken from what each movement says itself (sources below), reviewed for fairness by the course instructor.
 */

var PRESETS = {
  original: {
    label: 'Original 1989 rules',
    values: {regulation: 'standard', nuclearAllowed: 'true', densityCap: '40', transport: 'balanced', incentives: 'none',
             parks: 'standard', zoning: 'exclusive', pedestrian: '0', greenBelt: '0', electionCycle: '0',
             taxStart: '7', socialStart: '0', housingStart: '0'},
    note: 'The laws and budget of the original game.',
    sources: []
  },

  progressive: {
    label: 'Progressive (Sanders-style)',
    values: {regulation: 'strict', nuclearAllowed: 'false', densityCap: '40', transport: 'transit', incentives: 'none',
             parks: 'standard', zoning: 'mixed', pedestrian: '0', greenBelt: '0', electionCycle: '0',
             taxStart: '9', socialStart: '100', housingStart: '100'},
    note: 'Higher taxes funding large public programs; strict environmental rules; no new nuclear power; transit and ' +
          'high-speed rail over roads; no corporate tax breaks; social housing and services fully funded; no limit on ' +
          'housing density (against "exclusionary zoning"). Police funded at 100%: Sanders rejected abolishing police and ' +
          'wants them "well-trained, well-paid". Mixed-use zoning is an INFERENCE from his opposition to exclusionary ' +
          'zoning, not a stated position. Parks, car-free downtown and green belt: no stated position, so original settings.',
    sources: [
      ['NLIHC: Bernie Sanders Releases Affordable Housing Plan', 'https://nlihc.org/resource/bernie-sanders-releases-affordable-housing-plan'],
      ['MIT Technology Review: Sanders’s climate plan', 'https://www.technologyreview.com/2020/02/28/905621/bernie-sanders-has-an-audaciousand-hugely-expensiveclimate-plan/'],
      ['Axios: Sanders pushes back on abolishing police departments', 'https://www.axios.com/2020/06/09/bernie-sanders-defund-police'],
      ['Jacobin: Welfare, But for CEOs (Sanders on corporate welfare)', 'https://jacobin.com/2018/08/bernie-sanders-jeff-bezos-corporate-welfare-inequality']
    ]
  },

  populist: {
    label: 'Conservative-populist (MAGA-style)',
    values: {regulation: 'standard', nuclearAllowed: 'true', densityCap: '24', transport: 'roads', incentives: 'strong',
             parks: 'standard', zoning: 'exclusive', pedestrian: '0', greenBelt: '0', electionCycle: '0',
             taxStart: '5', socialStart: '25', housingStart: '0'},
    note: 'Low taxes ("large tax cuts"); strong incentives for businesses that produce at home (15% corporate rate); ' +
          'nuclear power expanded; roads over rail and transit (transit and passenger-rail cuts); single-use suburbs ' +
          'protected from low-income housing (medium density at most); social services reduced through work requirements ' +
          '(25%, not zero: supporters frame it as restoring work, not ending programs); no social housing. Police funded at ' +
          '100% ("lock up violent offenders"). Environmental rules set to Standard, not None: the platform calls for cutting ' +
          '"costly and burdensome regulations", not abolishing them. Parks, car-free downtown and green belt: no stated ' +
          'position, so original settings.',
    sources: [
      ['NBC: The Republican party’s 2024 platform', 'https://www.nbcwashington.com/news/national-international/the-republican-partys-2024-platform-reflects-a-trump-centric-shift-in-policies/3661801/'],
      ['Fox 5 NY: Trump on suburbs and low-income housing (2020)', 'https://www.fox5ny.com/news/trump-tells-voters-who-live-in-suburbs-they-will-no-longer-be-bothered-by-low-income-housing'],
      ['Planetizen: Trump budget cuts passenger rail funding 82%', 'https://www.planetizen.com/news/2026/04/137380-trump-budget-slashes-passenger-rail-funding-82'],
      ['Introl: Trump nuclear executive orders target 400 GW by 2050', 'https://introl.com/blog/trump-400-gw-nuclear-executive-orders-2050-target'],
      ['CNN/ABC17: Trump on helping US businesses through tariffs and taxes', 'https://abc17news.com/politics/national-politics/cnn-us-politics/2024/09/24/heres-how-trump-says-hell-help-us-businesses-through-tariffs-and-taxes/'],
      ['Health Affairs: 2025 reconciliation bill coverage provisions', 'https://www.healthaffairs.org/content/forefront/house-republicans-pass-budget-reconciliation-legislation-s-new-coverage-provisions']
    ]
  }
};

var COMMON_NOTE = 'Presets set laws and the starting budget only, never the world model. National platforms are ' +
                  'translated into a city game, so this is an analogy. The game has a single flat city tax, so it cannot ' +
                  'show "who" is taxed. You can change any setting afterwards.';


var Presets = {
  all: PRESETS,
  commonNote: COMMON_NOTE,
  // Names of the setup-screen fields a preset controls (without the "pl_" prefix)
  fields: ['regulation', 'nuclearAllowed', 'densityCap', 'transport', 'incentives', 'parks', 'zoning', 'pedestrian',
           'greenBelt', 'electionCycle', 'taxStart', 'socialStart', 'housingStart']
};


export { Presets };

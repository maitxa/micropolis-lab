/* Policy Lab additions to micropolisJS (2026).
 *
 * This code is released under the GNU GPL v3, with some additional terms, like the rest of micropolisJS.
 * Modified version: NOT the original micropolisJS / Micropolis.
 *
 * Saved cities, rewind snapshots and the scoreboard (v25). Everything stays in THIS browser, in its built-in database
 * (IndexedDB), which holds far more than the 5 MB the original single save slot (localStorage) allowed.
 *
 *  - cities:    {id, cityId, name, cityName, year, pop, score, savedAt, data}  (data = the saved game, as text)
 *  - snapshots: {id, cityId, year, pop, score, savedAt, data}  taken every SNAPSHOT_YEARS game years, the last
 *               MAX_SNAPSHOTS kept per city
 *  - scores:    {cityId, cityName, year, pop, score, best, bestYear, rules, rulesKey, updatedAt}  one row per city
 *
 * A city is loaded by reloading the page with a note saying which record to open (see resume / takeResume), so the
 * game always starts from a clean page.
 */

var DB_NAME = 'policyLab';
var DB_VERSION = 1;
var SNAPSHOT_YEARS = 10;
var MAX_SNAPSHOTS = 20;
var RESUME_KEY = 'policyLabResume';

var dbPromise = null;

var open = function() {
  if (dbPromise)
    return dbPromise;
  dbPromise = new Promise(function(resolve, reject) {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('no IndexedDB'));
      return;
    }
    var req;
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (e) {
      reject(e);
      return;
    }
    req.onupgradeneeded = function() {
      var db = req.result;
      if (!db.objectStoreNames.contains('cities'))
        db.createObjectStore('cities', {keyPath: 'id'});
      if (!db.objectStoreNames.contains('snapshots')) {
        var snaps = db.createObjectStore('snapshots', {keyPath: 'id'});
        snaps.createIndex('cityId', 'cityId', {unique: false});
      }
      if (!db.objectStoreNames.contains('scores'))
        db.createObjectStore('scores', {keyPath: 'cityId'});
    };
    req.onsuccess = function() { resolve(req.result); };
    req.onerror = function() { reject(req.error); };
    req.onblocked = function() { reject(new Error('blocked')); };
  });
  dbPromise.catch(function() { dbPromise = null; });
  return dbPromise;
};

var run = function(store, mode, fn) {
  return open().then(function(db) {
    return new Promise(function(resolve, reject) {
      var tx = db.transaction(store, mode);
      var result;
      tx.oncomplete = function() { resolve(result); };
      tx.onerror = function() { reject(tx.error); };
      tx.onabort = function() { reject(tx.error); };
      var req = fn(tx.objectStore(store));
      if (req)
        req.onsuccess = function() { result = req.result; };
    });
  });
};

var put = function(store, rec) { return run(store, 'readwrite', function(s) { return s.put(rec); }); };
var get = function(store, key) { return run(store, 'readonly', function(s) { return s.get(key); }); };
var del = function(store, key) { return run(store, 'readwrite', function(s) { return s.delete(key); }); };
var all = function(store) { return run(store, 'readonly', function(s) { return s.getAll(); }); };

// Small descriptions (no game data) for lists
var summary = function(rec) {
  var out = {};
  Object.keys(rec).forEach(function(k) { if (k !== 'data') out[k] = rec[k]; });
  return out;
};

var newId = function() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
};


// ---- Saved cities
var saveCity = function(info, data) {
  // One save per city and name: saving again under the same name replaces it
  var rec = Object.assign({}, info, {id: info.cityId + '|' + info.name, savedAt: Date.now(), data: data});
  return put('cities', rec).then(function() { return summary(rec); });
};

var listCities = function() {
  return all('cities').then(function(list) {
    return list.map(summary).sort(function(a, b) { return b.savedAt - a.savedAt; });
  });
};


// ---- Rewind snapshots
var saveSnapshot = function(info, data) {
  var rec = Object.assign({}, info, {id: info.cityId + ':' + info.year, savedAt: Date.now(), data: data});
  return put('snapshots', rec).then(function() {
    return listSnapshots(info.cityId);
  }).then(function(list) {
    // keep the most recent MAX_SNAPSHOTS
    var extra = list.slice(MAX_SNAPSHOTS);
    return Promise.all(extra.map(function(s) { return del('snapshots', s.id); }));
  });
};

var listSnapshots = function(cityId) {
  return run('snapshots', 'readonly', function(s) { return s.index('cityId').getAll(cityId); }).then(function(list) {
    return (list || []).map(summary).sort(function(a, b) { return b.year - a.year; });
  });
};


// ---- Scoreboard
var updateScore = function(info) {
  return get('scores', info.cityId).then(function(old) {
    var rec = Object.assign({}, old || {}, info, {updatedAt: Date.now()});
    if (!old || info.score > (old.best || 0)) {
      rec.best = info.score;
      rec.bestYear = info.year;
    }
    return put('scores', rec);
  });
};

var listScores = function() {
  return all('scores').then(function(list) {
    return list.sort(function(a, b) { return (b.best || 0) - (a.best || 0); });
  });
};


// ---- Opening a city: note what to open, then reload the page (the start screen picks it up)
var resume = function(store, id) {
  try {
    window.localStorage.setItem(RESUME_KEY, JSON.stringify({store: store, id: id, at: Date.now()}));
  } catch (e) {
    return false;
  }
  window.location.reload();
  return true;
};

// The record to open now, if any (a note older than a minute is ignored)
var takeResume = function() {
  var note = null;
  try {
    note = JSON.parse(window.localStorage.getItem(RESUME_KEY) || 'null');
    window.localStorage.removeItem(RESUME_KEY);
  } catch (e) {
    return Promise.resolve(null);
  }
  if (!note || !note.id || Date.now() - note.at > 60000)
    return Promise.resolve(null);
  return get(note.store, note.id);
};


// ---- Files: a saved city can be exported to a .json file and imported again (e.g. on another computer)
var download = function(filename, text, mime) {
  var viaClaude = window.claude && window.claude.use ? window.claude.use('downloads') : Promise.resolve(null);
  return viaClaude.then(function(dl) {
    if (dl)
      return dl.save({filename: filename, data: text});
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], {type: mime || 'application/json'}));
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function() { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    return {status: 'saved'};
  });
};

var exportCity = function(id) {
  return get('cities', id).then(function(rec) {
    if (!rec)
      throw new Error('not found');
    var file = JSON.stringify({policyLabCity: 1, name: rec.name, cityName: rec.cityName, year: rec.year, pop: rec.pop,
                               score: rec.score, data: rec.data});
    var safe = (rec.name || 'city').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') || 'city';
    return download(safe + '.json', file);
  });
};

var importCity = function(text) {
  var f = JSON.parse(text);
  if (!f || !f.policyLabCity || typeof f.data !== 'string')
    throw new Error('not a Policy Lab city file');
  var game = JSON.parse(f.data);
  var cityId = (game.policyLab && game.policyLab.cityId) || newId();
  return saveCity({cityId: cityId, name: (f.name || 'Imported city') + ' (imported)', cityName: f.cityName || game.name,
                   year: f.year, pop: f.pop, score: f.score}, f.data);
};


var CityStore = {
  SNAPSHOT_YEARS: SNAPSHOT_YEARS,
  MAX_SNAPSHOTS: MAX_SNAPSHOTS,
  available: function() { return open().then(function() { return true; }, function() { return false; }); },
  newId: newId,
  saveCity: saveCity,
  listCities: listCities,
  getCity: function(id) { return get('cities', id); },
  deleteCity: function(id) { return del('cities', id); },
  saveSnapshot: saveSnapshot,
  listSnapshots: listSnapshots,
  getSnapshot: function(id) { return get('snapshots', id); },
  updateScore: updateScore,
  listScores: listScores,
  deleteScore: function(cityId) { return del('scores', cityId); },
  resume: resume,
  takeResume: takeResume,
  exportCity: exportCity,
  // v29: any text file (e.g. the "What I did wrong" report, for students to hand in)
  downloadText: function(filename, text) { return download(filename, text, 'text/plain;charset=utf-8'); },
  importCity: importCity
};


export { CityStore };

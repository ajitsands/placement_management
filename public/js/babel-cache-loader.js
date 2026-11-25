/**
 * Fast Parallel + IndexedDB-Cached JSX Loader
 * - Cache hit: skips downloading @babel/standalone (2.8MB) and skips CPU transpilation completely.
 * - Cache miss / version bump: fetches uncached JSX files + @babel/standalone in parallel,
 *   transpiles with fast React preset, caches in IndexedDB keyed by full versioned URL, and executes in order.
 */
(function (window, document) {
  'use strict';

  var DB_NAME = 'sands_jsx_cache_v2';
  var STORE_NAME = 'scripts';
  var BABEL_CDN = 'https://unpkg.com/@babel/standalone/babel.min.js';

  function openDB() {
    return new Promise(function (resolve) {
      if (!window.indexedDB) return resolve(null);
      try {
        var req = window.indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = function (e) {
          var db = e.target.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME);
          }
        };
        req.onsuccess = function (e) { resolve(e.target.result); };
        req.onerror = function () { resolve(null); };
      } catch (err) {
        resolve(null);
      }
    });
  }

  function idbGetAll(db, keys) {
    if (!db) return Promise.resolve({});
    return new Promise(function (resolve) {
      var result = {};
      var pending = keys.length;
      if (pending === 0) return resolve(result);
      try {
        var tx = db.transaction(STORE_NAME, 'readonly');
        var store = tx.objectStore(STORE_NAME);
        keys.forEach(function (key) {
          var req = store.get(key);
          req.onsuccess = function () {
            if (typeof req.result === 'string') {
              result[key] = req.result;
            }
            if (--pending === 0) resolve(result);
          };
          req.onerror = function () {
            if (--pending === 0) resolve(result);
          };
        });
      } catch (e) {
        resolve({});
      }
    });
  }

  function idbPutBatch(db, entries) {
    if (!db || !entries.length) return Promise.resolve();
    return new Promise(function (resolve) {
      try {
        var tx = db.transaction(STORE_NAME, 'readwrite');
        var store = tx.objectStore(STORE_NAME);
        entries.forEach(function (item) {
          store.put(item.code, item.key);
        });
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { resolve(); };
      } catch (e) {
        resolve();
      }
    });
  }

  function loadScriptOnce(src) {
    return new Promise(function (resolve, reject) {
      if (window.Babel) return resolve(window.Babel);
      var s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = function () { resolve(window.Babel); };
      s.onerror = function () { reject(new Error('Failed to load ' + src)); };
      document.head.appendChild(s);
    });
  }

  function execCompiledScript(code, url) {
    var s = document.createElement('script');
    s.type = 'text/javascript';
    s.text = code + '\n//# sourceURL=' + url;
    document.head.appendChild(s);
  }

  window.loadAppJSXScripts = async function (urls) {
    var db = await openDB();
    var cachedMap = await idbGetAll(db, urls);
    var missingUrls = urls.filter(function (u) { return !cachedMap[u]; });

    if (missingUrls.length > 0) {
      // Load Babel Standalone and fetch all missing/updated JSX files in parallel
      var babelPromise = loadScriptOnce(BABEL_CDN);
      var fetchPromises = missingUrls.map(function (url) {
        return fetch(url).then(function (res) {
          if (!res.ok) throw new Error('HTTP ' + res.status + ' loading ' + url);
          return res.text();
        }).then(function (source) {
          return { url: url, source: source };
        });
      });

      var results = await Promise.all([babelPromise].concat(fetchPromises));
      var Babel = results[0];
      var fetchedFiles = results.slice(1);
      var toCache = [];

      for (var i = 0; i < fetchedFiles.length; i++) {
        var item = fetchedFiles[i];
        var compiled = Babel.transform(item.source, {
          presets: [['react', { runtime: 'classic' }]],
          filename: item.url
        }).code;
        cachedMap[item.url] = compiled;
        toCache.push({ key: item.url, code: compiled });
      }

      // Persist compiled JS in IndexedDB asynchronously (don't block UI mount)
      idbPutBatch(db, toCache);
    }

    // Execute all scripts synchronously in exact dependency order
    for (var j = 0; j < urls.length; j++) {
      var u = urls[j];
      execCompiledScript(cachedMap[u], u);
    }
  };
})(window, document);

/* Seerah Lens service worker: the whole app and every surah is cached on first visit, so it works offline. */
var VERSION = "{{VERSION}}";
var CORE = "sl-core-" + VERSION;
var FONTS = "sl-fonts-v1";
var ASSETS = {{ASSETS}};

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CORE).then(function (c) { return c.addAll(ASSETS); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CORE && k !== FONTS; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);

  // Google Fonts: serve from cache, refresh in the background.
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(caches.open(FONTS).then(function (c) {
      return c.match(req).then(function (hit) {
        var net = fetch(req).then(function (res) { if (res.ok || res.type === "opaque") c.put(req, res.clone()); return res; }).catch(function () { return hit; });
        return hit || net;
      });
    }));
    return;
  }
  if (url.origin !== location.origin) return;

  // Pages: network first so updates show, cache when offline.
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).then(function (res) {
      var copy = res.clone(); caches.open(CORE).then(function (c) { c.put(req, copy); }); return res;
    }).catch(function () {
      return caches.match(req, { ignoreSearch: true }).then(function (hit) { return hit || caches.match("./"); });
    }));
    return;
  }

  // App files and Quran data: cache first.
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(function (hit) {
    return hit || fetch(req).then(function (res) {
      if (res.ok) { var copy = res.clone(); caches.open(CORE).then(function (c) { c.put(req, copy); }); }
      return res;
    });
  }));
});

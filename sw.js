/* Seerah Lens service worker: the whole app and every surah is cached on first visit, so it works offline. */
var VERSION = "f5d3b34a33";
var CORE = "sl-core-" + VERSION;
var FONTS = "sl-fonts-v1";
var ASSETS = ["./","index.html","app.css","app.js","manifest.webmanifest","data/content.json","data/surahs.json","icons/icon.svg","icons/icon-192.png","icons/icon-512.png","icons/maskable-512.png","icons/apple-touch-icon.png","data/quran/1.json","data/quran/100.json","data/quran/101.json","data/quran/102.json","data/quran/103.json","data/quran/104.json","data/quran/105.json","data/quran/106.json","data/quran/107.json","data/quran/108.json","data/quran/109.json","data/quran/110.json","data/quran/111.json","data/quran/112.json","data/quran/113.json","data/quran/114.json","data/quran/18.json","data/quran/36.json","data/quran/78.json","data/quran/79.json","data/quran/80.json","data/quran/81.json","data/quran/82.json","data/quran/83.json","data/quran/84.json","data/quran/85.json","data/quran/86.json","data/quran/87.json","data/quran/88.json","data/quran/89.json","data/quran/90.json","data/quran/91.json","data/quran/92.json","data/quran/93.json","data/quran/94.json","data/quran/95.json","data/quran/96.json","data/quran/97.json","data/quran/98.json","data/quran/99.json"];

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

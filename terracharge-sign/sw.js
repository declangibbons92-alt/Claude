/*
 * Offline support. Every file the app needs is cached on first load, so
 * signing and PDF creation work with no signal.
 * Bump CACHE_VERSION whenever you change any file (e.g. the agreement text).
 */
const CACHE_VERSION = "tc-sign-v7";
const ASSETS = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "css/app.css",
  "js/app.js",
  "js/agreement.js",
  "js/signature-pad.js",
  "js/pdf-builder.js",
  "js/signature-store.js",
  "js/util.js",
  "vendor/jspdf.umd.min.js",
  "vendor/pdf.min.js",
  "vendor/pdf.worker.min.js",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
  "icons/apple-touch-icon.png",
  "icons/unit.jpg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: "reload" }))))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Cache-first: the app never needs the network once installed.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      if (req.mode === "navigate") return caches.match("index.html");
      return fetch(req);
    })
  );
});

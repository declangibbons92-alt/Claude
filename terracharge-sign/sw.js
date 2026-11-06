/*
 * Offline support.
 * - Every file the app needs is cached on install, so signing and PDF
 *   creation work with no signal.
 * - When online, files are fetched fresh first (short timeout) and the cache
 *   is refreshed, so updates apply straight away and old/new files never mix.
 * - If the network is slow, offline, or the Cloudflare Access login has
 *   expired (a redirect), the cached copy is used instead.
 * Bump CACHE_VERSION whenever you change any file (e.g. the agreement text).
 */
const CACHE_VERSION = "tc-sign-v8";
const NETWORK_TIMEOUT_MS = 3500;
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
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function cacheKey(req) {
  const url = new URL(req.url);
  if (req.mode === "navigate" || url.pathname.endsWith("/")) return new URL("index.html", self.registration.scope).href;
  url.search = "";
  return url.href;
}

// Usable only if it's a normal, successful response from this site
// (not an Access login redirect or an error page).
function usable(res) {
  return res && res.ok && res.type === "basic" && !res.redirected;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  const key = cacheKey(req);

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_VERSION);
    const network = fetch(req.mode === "navigate" ? key : req, { cache: "no-cache" })
      .then(async (res) => {
        if (usable(res)) {
          await cache.put(key, res.clone());
          return res;
        }
        throw new Error("unusable response");
      });
    network.catch(() => {}); // a late failure after falling back to the cache is fine
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), NETWORK_TIMEOUT_MS));
    try {
      return await Promise.race([network, timeout]);
    } catch {
      const hit = await cache.match(key);
      if (hit) return hit;
      return network; // nothing cached: wait for the network (or fail)
    }
  })());
});

// Snowline service worker: keeps the app, today's forecast and run data usable with no signal on the lift.
//  - App shell and Next static assets: cache-first (static assets are content-hashed).
//  - /api/resorts/*: network-first, falling back to the last saved copy (marked with X-Snowline-Offline).
//  - Map style, sprites, fonts and tiles: stale-while-revalidate, capped.
const VERSION = "v1";
const SHELL = `snowline-shell-${VERSION}`;
const DATA = `snowline-data-${VERSION}`;
const MAP = `snowline-map-${VERSION}`;
const MAP_MAX_ENTRIES = 600;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((c) => c.addAll(["/", "/manifest.webmanifest", "/icons/192", "/icons/512"]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => ![SHELL, DATA, MAP].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(request);
    if (!hit) throw err;
    const headers = new Headers(hit.headers);
    headers.set("X-Snowline-Offline", "1");
    return new Response(await hit.blob(), { status: hit.status, headers });
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) cache.put(request, res.clone());
  return res;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  const update = fetch(request)
    .then(async (res) => {
      if (res.ok || res.type === "opaque") {
        await cache.put(request, res.clone());
        const keys = await cache.keys();
        for (const k of keys.slice(0, Math.max(0, keys.length - MAP_MAX_ENTRIES))) await cache.delete(k);
      }
      return res;
    })
    .catch(() => hit);
  return hit ?? update;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    if (url.pathname.startsWith("/api/resorts")) return event.respondWith(networkFirst(req, DATA));
    if (url.pathname.startsWith("/api/")) return;
    if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/maplibre/") || url.pathname.startsWith("/icons/")) {
      return event.respondWith(cacheFirst(req, SHELL));
    }
    // Pages: network-first so deploys show up, cached shell when offline.
    if (req.mode === "navigate") return event.respondWith(networkFirst(req, SHELL).catch(() => caches.match("/")));
    return event.respondWith(networkFirst(req, SHELL));
  }

  if (url.hostname === "tiles.openfreemap.org") return event.respondWith(staleWhileRevalidate(req, MAP));
});

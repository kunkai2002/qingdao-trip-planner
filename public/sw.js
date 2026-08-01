/* ============================================================
   Service worker
   ------------------------------------------------------------
   Two reasons this exists, in order of importance:

   1. Chrome will not offer "install to home screen" on Android without a
      service worker that handles fetch. No worker, no install prompt, no app.
   2. Once it exists, the app shell can open without the network. The trip data
      is in localStorage and needs no network anyway, so an installed copy is
      genuinely usable offline apart from the map tiles themselves.

   What it deliberately does NOT do: cache AutoNavi tiles. They are a
   third-party raster set that would balloon the cache without bound, and a
   half-cached basemap is more confusing than an obviously missing one.
   ============================================================ */

const VERSION = 'v3'
const SHELL = `shell-${VERSION}`
const ASSETS = `assets-${VERSION}`

// Resolved against the worker's own scope, so this works unchanged on a
// GitHub Pages subpath.
const SHELL_URLS = ['./', './index.html', './manifest.webmanifest', './icon-192.png']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((c) => c.addAll(SHELL_URLS.map((u) => new Request(u, { cache: 'reload' }))))
      // A failed precache must not wedge the worker permanently.
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== SHELL && k !== ASSETS).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  // Third-party (map tiles): straight to the network, never cached.
  if (url.origin !== self.location.origin) return

  // Navigations: prefer the network so a deploy is picked up immediately,
  // fall back to the cached shell when offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone()
          caches.open(SHELL).then((c) => c.put('./index.html', copy)).catch(() => {})
          return res
        })
        .catch(() =>
          caches.match('./index.html').then((r) => r || caches.match('./')),
        ),
    )
    return
  }

  /* Everything else same-origin is content-hashed by Vite, so a cache hit can
     be served immediately and refreshed in the background without risking a
     stale build. */
  event.respondWith(
    caches.match(request).then((hit) => {
      const net = fetch(request)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone()
            caches.open(ASSETS).then((c) => c.put(request, copy)).catch(() => {})
          }
          return res
        })
        .catch(() => hit)
      return hit || net
    }),
  )
})

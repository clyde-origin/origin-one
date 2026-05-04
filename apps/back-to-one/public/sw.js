// apps/back-to-one/public/sw.js
//
// BT1 service worker — handles push notifications, click-to-open routing,
// and an offline shell (static cache-first, HTML network-first, API never-cached).

const CACHE_VERSION = 'b21-v1'
const STATIC_CACHE = `${CACHE_VERSION}-static`
const HTML_CACHE = `${CACHE_VERSION}-html`

self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(
        keys
          .filter((key) => !key.startsWith(CACHE_VERSION))
          .map((key) => caches.delete(key)),
      )
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('push', (event) => {
  if (!event.data) return
  let payload
  try {
    payload = event.data.json()
  } catch (e) {
    payload = { title: 'Back to One', body: event.data.text(), url: '/' }
  }
  const { title = 'Back to One', body = '', url = '/' } = payload
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url },
      tag: payload.tag,
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url ?? '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin)) {
          client.focus()
          if ('navigate' in client) return client.navigate(url)
          return
        }
      }
      return self.clients.openWindow(url)
    }),
  )
})

// ───────────────────────────────────────────────────────────────────────
// Offline shell — fetch handler
//
// Strategies:
//   • Static assets (/_next/static/*, icons, manifest, fonts) → cache-first
//   • HTML navigations                                        → network-first
//   • /api/*                                                  → network-only
//   • Cross-origin (Supabase, etc.)                           → passthrough
// ───────────────────────────────────────────────────────────────────────

const STATIC_PATH_RE = /^\/(_next\/static\/|icon-|apple-touch-icon\.png|manifest\.(json|webmanifest)|fonts\/)/
const STATIC_EXT_RE = /\.(?:woff2?|ttf|otf|eot|svg|png|jpe?g|gif|webp|avif|ico|css|js)$/i

function isStaticAsset(url) {
  if (STATIC_PATH_RE.test(url.pathname)) return true
  // catch hashed Next assets that fall outside _next/static (rare) or font files served at root
  if (STATIC_EXT_RE.test(url.pathname) && url.pathname.startsWith('/_next/')) return true
  return false
}

async function safeCachePut(cacheName, request, response) {
  if (!response || response.status !== 200) return
  try {
    const cache = await caches.open(cacheName)
    await cache.put(request, response)
  } catch (e) {
    // quota errors, opaque-response edge cases — never let cache writes break the response
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request)
  if (cached) return cached
  try {
    const response = await fetch(request)
    if (response && response.status === 200) {
      // clone before passing to cache; the original goes to the page
      safeCachePut(STATIC_CACHE, request, response.clone())
    }
    return response
  } catch (e) {
    const fallback = await caches.match(request)
    if (fallback) return fallback
    throw e
  }
}

async function networkFirstHTML(request) {
  try {
    const response = await fetch(request)
    if (response && response.status === 200) {
      safeCachePut(HTML_CACHE, request, response.clone())
    }
    return response
  } catch (e) {
    const cached = await caches.match(request)
    if (cached) return cached
    return new Response(
      '<!doctype html><meta charset="utf-8"><title>Offline</title><h1>Offline</h1><p>You are offline. Reconnect to load this page.</p>',
      { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    )
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event

  // Only GET; never intercept POST/PATCH/DELETE/PUT.
  if (request.method !== 'GET') return

  let url
  try {
    url = new URL(request.url)
  } catch {
    return
  }

  // Cross-origin → let the network handle it (Supabase Storage, external CDNs, etc.)
  if (url.origin !== self.location.origin) return

  // /api/* → network-only, never cache. Stale Supabase data is worse than no data.
  if (url.pathname.startsWith('/api/')) return

  // Static assets → cache-first then network
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request))
    return
  }

  // HTML navigations → network-first then cache, with offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstHTML(request))
    return
  }

  // Anything else (same-origin XHR, etc.) → passthrough
})

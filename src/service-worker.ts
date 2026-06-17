/// <reference types="@sveltejs/kit" />
/// <reference lib="esnext" />
/// <reference lib="webworker" />

// Offline-first service worker. The app is a static SPA that generates puzzles client-side
// (with a baked fallback bundle), so once the shell + assets are cached it works fully offline.
//
// Strategy: precache this build's app shell, hashed assets, static files (incl.
// puzzles.bundle.json), and prerendered pages; serve them cache-first. For anything else,
// go to the network and fall back to cache; for a navigation that misses (an offline deep
// link to a client-rendered route like /play/sudoku) serve the cached app shell so the SPA
// router can take over. We do NOT skipWaiting — a new build activates on next cold start, so a
// running session never has its hashed chunks swapped underneath it.

import { build, files, prerendered, version } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;

const CACHE = `ml-cache-${version}`;
const PRECACHE = [...build, ...files, ...prerendered];

sw.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)));
});

sw.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key !== CACHE) await caches.delete(key);
      }
      await sw.clients.claim();
    })()
  );
});

// A new build installs but waits (we never auto-skipWaiting). The client shows an "update
// available" prompt and, only if the user accepts, asks this waiting worker to take over now.
sw.addEventListener('message', (event) => {
  if ((event.data as { type?: string } | null)?.type === 'SKIP_WAITING') sw.skipWaiting();
});

sw.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return; // never touch cross-origin requests

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);

      // Build/static/prerendered assets are versioned per build — serve them cache-first.
      if (PRECACHE.includes(url.pathname)) {
        const hit = await cache.match(url.pathname);
        if (hit) return hit;
      }

      try {
        const response = await fetch(event.request);
        // Runtime-cache non-navigation assets only (e.g. the lazily-loaded generator worker
        // chunk), so an HTML page is never served stale and the cache can't grow per visited
        // route. Best-effort — a full quota must not reject the response.
        if (response.status === 200 && event.request.mode !== 'navigate') {
          cache.put(event.request, response.clone()).catch(() => {});
        }
        return response;
      } catch {
        const hit = await cache.match(event.request);
        if (hit) return hit;
        // Offline deep link to a client-rendered route → serve the cached app shell (`/` is
        // prerendered + precached); the SPA router then renders the requested route.
        if (event.request.mode === 'navigate') {
          const shell = await cache.match('/');
          if (shell) return shell;
        }
        throw new Error('offline and not in cache');
      }
    })()
  );
});

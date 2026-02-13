// MyChoir Service Worker v3
// Provides offline support by caching app shell and static resources

const CACHE_NAME = 'mychoir-v3';
const OFFLINE_URL = '/offline';

// Files to cache on install (app shell)
const PRECACHE_URLS = [
    '/',
    '/offline',
    '/manifest.json',
    '/favicon.png',
    '/icon-192.png',
    '/icon-512.png',
];

// Safe cache put - won't throw when offline
async function safeCachePut(cache, request, response) {
    try {
        await cache.put(request, response);
    } catch (err) {
        // Silently fail - this happens when offline or quota exceeded
        console.log('[SW] Cache put skipped:', err.message);
    }
}

// Install event - precache essential files
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[SW] Precaching app shell');
            return cache.addAll(PRECACHE_URLS);
        }).then(() => {
            return self.skipWaiting();
        }).catch((err) => {
            console.error('[SW] Precache failed:', err);
        })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[SW] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            return self.clients.claim();
        })
    );
});

// Helper: Get offline fallback response
async function getOfflineFallback() {
    const cached = await caches.match(OFFLINE_URL);
    if (cached) return cached;
    // Ultimate fallback - return a simple HTML response
    return new Response(
        '<html><body><h1>Offline</h1><p>Please check your internet connection.</p></body></html>',
        { headers: { 'Content-Type': 'text/html' }, status: 503 }
    );
}

// Fetch event handler
self.addEventListener('fetch', (event) => {
    const request = event.request;

    // Skip non-GET requests - let them pass through
    if (request.method !== 'GET') return;

    // Skip Chrome extensions and other non-http requests
    if (!request.url.startsWith('http')) return;

    // Skip API requests (except cacheable ones)
    if (request.url.includes('/api/') && !request.url.includes('/api/search-index')) {
        return;
    }

    // Skip cross-origin requests that might cause CORS issues
    if (request.url.includes('firestore.googleapis.com') ||
        request.url.includes('identitytoolkit.googleapis.com') ||
        request.url.includes('google.com/images/cleardot.gif') ||
        request.url.includes('googleapis.com/v1alpha')) {
        return;
    }

    // For navigation requests (HTML pages)
    if (request.mode === 'navigate') {
        event.respondWith(
            (async () => {
                try {
                    const response = await fetch(request);
                    if (response && response.ok) {
                        const cache = await caches.open(CACHE_NAME);
                        await safeCachePut(cache, request, response.clone());
                    }
                    return response;
                } catch (error) {
                    // Network failed - try cache
                    const cached = await caches.match(request);
                    if (cached) return cached;
                    // Fall back to offline page
                    return getOfflineFallback();
                }
            })()
        );
        return;
    }

    // For static assets (JS, CSS, fonts, images) - stale-while-revalidate
    if (
        request.url.includes('/_next/static/') ||
        request.url.match(/\.(js|css|woff2?|png|jpg|jpeg|gif|svg|ico)$/)
    ) {
        event.respondWith(
            (async () => {
                const cached = await caches.match(request);

                // Start fetch in background (fire and forget)
                const fetchPromise = fetch(request).then(async (response) => {
                    if (response && response.status === 200) {
                        const cache = await caches.open(CACHE_NAME);
                        await safeCachePut(cache, request, response.clone());
                    }
                    return response;
                }).catch(() => null);

                // Return cached immediately if available
                if (cached) {
                    // Revalidate in background (don't await)
                    fetchPromise;
                    return cached;
                }

                // Wait for network
                const networkResponse = await fetchPromise;
                if (networkResponse) return networkResponse;

                // No cache, no network - return empty response or 404
                // For JS chunks, return a special script that might help debug
                if (request.url.endsWith('.js')) {
                    console.warn('[SW] Offline chunk request failed:', request.url);
                    return new Response('console.error("Offline: Chunk failed to load");', {
                        headers: { 'Content-Type': 'application/javascript' }
                    });
                }

                return new Response('', { status: 404 });
            })()
        );
        return;
    }

    // For R2 PDFs - cache first (they don't change)
    if (request.url.includes('.r2.cloudflarestorage.com') || request.url.includes('.r2.dev')) {
        event.respondWith(
            (async () => {
                const cached = await caches.match(request);
                if (cached) return cached;

                try {
                    const response = await fetch(request);
                    if (response && response.status === 200) {
                        const cache = await caches.open(CACHE_NAME);
                        await safeCachePut(cache, request, response.clone());
                    }
                    return response;
                } catch (error) {
                    // PDF not available offline
                    return new Response('PDF not available offline', {
                        status: 503,
                        headers: { 'Content-Type': 'text/plain' }
                    });
                }
            })()
        );
        return;
    }

    // Default: network first, cache fallback
    event.respondWith(
        (async () => {
            try {
                const response = await fetch(request);
                if (response && response.status === 200) {
                    const cache = await caches.open(CACHE_NAME);
                    await safeCachePut(cache, request, response.clone());
                }
                return response;
            } catch (error) {
                const cached = await caches.match(request);
                if (cached) return cached;
                // Fallback empty response
                return new Response('', { status: 503 });
            }
        })()
    );
});

// Handle messages from the app
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

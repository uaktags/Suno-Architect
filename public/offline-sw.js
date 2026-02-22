const ASSET_CACHE = 'suno-architect-assets-v1';
const CACHEABLE_EXTENSIONS = ['.mp3', '.wav', '.png', '.jpg', '.jpeg'];

const isCacheableAsset = (url) => {
    const lower = url.pathname.toLowerCase();
    return CACHEABLE_EXTENSIONS.some((ext) => lower.endsWith(ext));
};

self.addEventListener('install', () => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
    const msg = event.data;
    if (!msg || msg.type !== 'CACHE_ASSETS' || !Array.isArray(msg.urls)) return;

    const { urls, requestId } = msg;
    event.waitUntil(cacheAssets(urls, requestId));
});

self.addEventListener('fetch', (event) => {
    const request = event.request;
    if (request.method !== 'GET') return;

    let url;
    try {
        url = new URL(request.url);
    } catch {
        return;
    }

    if (!isCacheableAsset(url)) return;

    event.respondWith(
        caches.open(ASSET_CACHE).then(async (cache) => {
            const cached = await cache.match(request, { ignoreVary: true });
            if (cached) return cached;

            try {
                const networkResponse = await fetch(request);
                if (networkResponse.ok) {
                    cache.put(request, networkResponse.clone()).catch(() => undefined);
                }
                return networkResponse;
            } catch {
                return new Response('Offline asset unavailable', { status: 503 });
            }
        })
    );
});

async function cacheAssets(urls, requestId) {
    const cache = await caches.open(ASSET_CACHE);
    let completed = 0;
    const total = urls.length;

    for (const assetUrl of urls) {
        try {
            const request = new Request(assetUrl, { method: 'GET', mode: 'cors' });
            const existing = await cache.match(request, { ignoreVary: true });
            if (!existing) {
                const response = await fetch(request);
                if (response.ok) {
                    await cache.put(request, response.clone());
                }
            }
        } catch {
            // Continue on partial failures.
        } finally {
            completed += 1;
            postProgress({ requestId, completed, total });
        }
    }

    postProgress({ requestId, completed: total, total, done: true });
}

async function postProgress(payload) {
    const clients = await self.clients.matchAll({ type: 'window' });
    for (const client of clients) {
        client.postMessage({ type: 'CACHE_PROGRESS', ...payload });
    }
}


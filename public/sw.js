const CACHE_NAME = 'retrack-share-v1';

self.addEventListener('install', () => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Web-Share-Target POST abfangen und Bild lokal für die App bereitstellen
    if (event.request.method === 'POST' && url.pathname === '/share-target') {
        event.respondWith((async () => {
            try {
                const formData = await event.request.formData();
                const file = formData.get('shared_image');
                const sharedText = formData.get('text') || formData.get('title') || '';

                const cache = await caches.open(CACHE_NAME);
                if (file) {
                    await cache.put('/shared-image', new Response(file, {
                        headers: { 'Content-Type': file.type || 'image/png' }
                    }));
                }
                if (sharedText) {
                    await cache.put('/shared-text', new Response(sharedText, {
                        headers: { 'Content-Type': 'text/plain' }
                    }));
                }
                return Response.redirect('/?shared=1', 303);
            } catch (err) {
                return Response.redirect('/', 303);
            }
        })());
    }
});

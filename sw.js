const CACHE = "gpaytrack-free-v3";
const STATIC = ["/", "/index.html", "/manifest.json"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(STATIC)));
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);

  if (url.pathname === "/share-target" && e.request.method === "POST") {
    e.respondWith((async () => {
      try {
        const fd = await e.request.formData();
        const file = fd.get("image");
        if (file) {
          const ab = await file.arrayBuffer();
          const bytes = new Uint8Array(ab);
          let binary = "";
          const chunkSize = 8192;
          for (let i = 0; i < bytes.byteLength; i += chunkSize) {
            binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
          }
          const b64 = btoa(binary);
          const payload = JSON.stringify({ b64, type: file.type || "image/jpeg", ts: Date.now() });

          // Method 1: postMessage to any open clients
          const clients = await self.clients.matchAll({ includeUncontrolled: true, type: "window" });
          for (const client of clients) {
            client.postMessage({ type: "SHARED_IMAGE", payload: JSON.parse(payload) });
          }

          // Method 2: Cache as fallback
          const cache = await caches.open(CACHE);
          await cache.put("/__shared_image__", new Response(payload, {
            headers: { "Content-Type": "application/json" }
          }));
        }
      } catch(err) {
        console.error("Share target error:", err);
      }
      return Response.redirect("/?shared=1", 303);
    })());
    return;
  }

  if (url.pathname === "/share-target" && e.request.method === "GET") {
    e.respondWith(Response.redirect("/", 302));
    return;
  }

  if (e.request.mode === "navigate") {
    e.respondWith(caches.match("/index.html").then(r => r || fetch(e.request)));
    return;
  }

  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});

// Service worker mínimo — solo existe para que el navegador considere el
// cuaderno "instalable" como PWA. No cachea nada a propósito (para no
// repetir el problema de contenido viejo servido desde caché); todo el
// tráfico pasa directo a la red.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // sin respondWith(): el navegador maneja la petición normalmente.
});

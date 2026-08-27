/* Service worker de VetDiario.

   El intento anterior de cachear dejaba contenido viejo servido para
   siempre, asi que se desactivo el cache por completo. El problema no era
   cachear: era cachear SIN version y SIN limpieza. Aqui se arregla con tres
   reglas que, juntas, hacen imposible que se quede colgada una version
   vieja:

   1. El nombre del cache lleva version. Al cambiar VERSION, el navegador
      instala un cache nuevo desde cero: nunca se mezcla con el anterior.
   2. En "activate" se borra TODO cache que no sea el actual. Lo viejo no se
      acumula, se elimina solo.
   3. En "fetch" el app shell va a la RED PRIMERO. El cache es solo la red
      de seguridad para cuando no hay conexion, no la fuente principal. Aun
      si algo fallara en los pasos 1 y 2, estando en linea siempre veras el
      codigo mas reciente.

   IMPORTANTE: sube VERSION en cada despliegue. Es la unica linea que hay
   que tocar aqui. */
const VERSION = "68";

const CACHE_SHELL = "vetdiario-shell-v" + VERSION;

/* El SDK de Firebase va en su propio cache y NO lleva version, porque la
   URL ya la lleva (.../10.7.1/...): son archivos inmutables. Si compartiera
   el cache del shell, cada despliegue volveria a descargar ~400 KB de SDK
   sin ninguna razon. */
const CACHE_LIBS = "vetdiario-libs-v1";

const CACHES_VIGENTES = [CACHE_SHELL, CACHE_LIBS];

/* Rutas relativas a proposito: en GitHub Pages la app cuelga de un subpath
   (/Cuaderno/), no de la raiz del dominio. Con rutas absolutas el cache
   apuntaria a un sitio que no existe.

   firebase-config.js parece prescindible y no lo es: app.js lo importa en su
   primera linea. Si falta, el modulo entero no arranca y sin conexion no se
   veria ni la interfaz. */
const APP_SHELL = [
  "./",
  "./index.html",
  "./app.js",
  "./semilla-formulario.js",
  "./styles.css",
  "./firebase-config.js",
  "./manifest.json",
  "./icon.svg"
];

const ORIGEN_LIBS = "https://www.gstatic.com/firebasejs/";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_SHELL)
      .then((cache) => cache.addAll(APP_SHELL))
      // skipWaiting va DESPUES del addAll: si se activara antes de terminar
      // de cachear, una recarga sin conexion en ese hueco encontraria el
      // cache a medias.
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((nombres) =>
        Promise.all(
          nombres
            .filter((nombre) => !CACHES_VIGENTES.includes(nombre))
            .map((nombre) => caches.delete(nombre))
        )
      )
      .then(() => self.clients.claim())
  );
});

/* Red primero con limite de tiempo. Sin el limite, una conexion pesima (con
   señal pero sin datos) deja la peticion colgada hasta que el navegador se
   rinde solo, y la app se queda en blanco teniendo la copia cacheada al
   lado. */
const TIMEOUT_RED = 4000;

async function redPrimero(request) {
  const cache = await caches.open(CACHE_SHELL);
  try {
    const respuesta = await new Promise((resolve, reject) => {
      const id = setTimeout(() => reject(new Error("timeout")), TIMEOUT_RED);
      fetch(request).then(
        (r) => {
          clearTimeout(id);
          resolve(r);
        },
        (e) => {
          clearTimeout(id);
          reject(e);
        }
      );
    });
    // Solo se guarda lo que respondio bien: cachear un 404 o un 500 seria
    // servir ese error luego sin conexion.
    if (respuesta && respuesta.ok) cache.put(request, respuesta.clone());
    return respuesta;
  } catch (err) {
    const cacheada = await cache.match(request);
    if (cacheada) return cacheada;
    // Una navegacion a "/Cuaderno/?algo" no coincide literal con lo
    // cacheado; index.html es la respuesta correcta para cualquier
    // navegacion de esta app.
    if (request.mode === "navigate") {
      const indice = await cache.match("./index.html");
      if (indice) return indice;
    }
    throw err;
  }
}

async function cachePrimero(request) {
  const cache = await caches.open(CACHE_LIBS);
  const cacheada = await cache.match(request);
  if (cacheada) return cacheada;
  const respuesta = await fetch(request);
  if (respuesta && respuesta.ok) cache.put(request, respuesta.clone());
  return respuesta;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;

  // Nunca tocar nada que no sea una lectura simple: los escritos a Firestore
  // y las subidas a Storage van por POST y deben pasar intactos.
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // El SDK de Firebase es de otro origen pero hace falta para arrancar:
  // app.js lo importa en sus primeras lineas. Sin el en cache, abrir la app
  // sin conexion falla antes de dibujar nada. Como la URL lleva la version
  // (10.7.1), cache primero es seguro: ese archivo no cambia jamas.
  if (url.href.startsWith(ORIGEN_LIBS)) {
    event.respondWith(cachePrimero(request));
    return;
  }

  // Todo lo demas de fuera (Firestore, Storage, la red del propio Firebase)
  // pasa directo, sin respondWith(). Firestore ya tiene su propia
  // persistencia offline con IndexedDB y no debe pasar por este cache.
  if (url.origin !== self.location.origin) return;

  const esNavegacion = request.mode === "navigate";
  const ruta = url.pathname.split("/").pop();
  const esDelShell =
    esNavegacion ||
    ["", "index.html", "app.js", "semilla-formulario.js", "styles.css", "firebase-config.js", "manifest.json", "icon.svg"].includes(ruta);

  if (!esDelShell) return;

  event.respondWith(redPrimero(request));
});

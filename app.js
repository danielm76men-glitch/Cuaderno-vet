import { firebaseConfig } from "./firebase-config.js";
import { SEMILLA_FORMULARIO } from "./semilla-formulario.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  query,
  orderBy,
  where,
  arrayUnion,
  deleteField,
  serverTimestamp,
  enableIndexedDbPersistence
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  getStorage,
  ref as storageRef,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === "failed-precondition") {
    console.warn("Persistencia offline no disponible: hay otra pestaña de VetDiario abierta.");
  } else if (err.code === "unimplemented") {
    console.warn("Este navegador no soporta persistencia offline.");
  }
});

const SPECIES_OPTIONS = ["Bovino", "Equino", "Porcino", "Aves", "Canino", "Felino", "Ovino", "Caprino", "Exótico", "Otro"];
const AREA_OPTIONS = ["Cirugía", "Medicina interna", "Reproducción", "Emergencia", "Seguimiento", "Otro"];

const els = {
  app: document.getElementById("app"),
  sidebar: document.getElementById("sidebar"),
  // Todos los botones de navegación del sidebar, estén dentro de #pageNav o
  // no: el de Configuración vive en .sidebar-foot, fuera de ese contenedor.
  // Con el selector anterior ("#pageNav .nav-item") quedaba excluido, así que
  // nunca recibía el listener de clic ni el resaltado de sección activa.
  // El filtro por [data-page] evita recoger botones que no navegan.
  pageNav: Array.prototype.slice.call(document.querySelectorAll(".app-sidebar .nav-item[data-page]")),
  countPatients: document.getElementById("countPatients"),
  countFarmacos: document.getElementById("countFarmacos"),
  countStudy: document.getElementById("countStudy"),
  search: document.getElementById("search"),
  content: document.getElementById("content"),
  toggleSidebar: document.getElementById("toggleSidebar"),
  connPill: document.getElementById("connPill"),
  connText: document.getElementById("connText"),
  themeToggle: document.getElementById("themeToggle"),
  bootGate: document.getElementById("bootGate"),
  bootMsg: document.getElementById("bootMsg"),
  authGate: document.getElementById("authGate"),
  authEmail: document.getElementById("authEmail"),
  authSendBtn: document.getElementById("authSendBtn"),
  authMsg: document.getElementById("authMsg"),
  authUser: document.getElementById("authUser"),
  sidebarIdentity: document.getElementById("sidebarIdentity"),
  sidName: document.getElementById("sidName"),
  sidTitle: document.getElementById("sidTitle"),
  signOutBtn: document.getElementById("signOutBtn")
};

const PAGE_LABELS = {
  dashboard: "Inicio",
  patients: "Pacientes",
  farmacos: "Fármacos",
  study: "Estudio",
  settings: "Configuración"
};

const TITULO_POR_DEFECTO = "Médico Veterinario";

const state = {
  entries: [],
  formulario: [],
  profile: null,
  page: "dashboard",
  studyTab: "materias",
  areaFilter: "",
  especieFilter: "",
  formularioEspecieFilter: "",
  activeId: null,
  query: "",
  ready: false
};

let currentUid = null;

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(iso) {
  if (!iso) return "";
  const parts = iso.split("-");
  if (parts.length !== 3) return iso;
  const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const m = parseInt(parts[1], 10) - 1;
  return parts[2] + " " + months[m] + " " + parts[0];
}

function roundNice(n) {
  if (!isFinite(n)) return "";
  return String(Math.round(n * 100) / 100);
}

function entriesForSection(section) {
  return state.entries.filter((e) => e.section === section);
}

// Normaliza para buscar: minusculas y SIN tildes ni diereses, en los dos
// lados de la comparacion. Sin esto, escribir "area" no encontraba "Area"
// con tilde ni "diagnostico" encontraba "diagnostico" acentuado, que es
// justo como se escriben los terminos clinicos.
function normalizarBusqueda(texto) {
  return String(texto == null ? "" : texto)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function incluyeNormalizado(campo, q) {
  return normalizarBusqueda(campo).includes(q);
}

function matchesQuery(entry, q) {
  if (!q) return true;
  q = normalizarBusqueda(q);
  return (
    incluyeNormalizado(entry.title, q) ||
    incluyeNormalizado(entry.meta, q) ||
    incluyeNormalizado(entry.especie, q) ||
    incluyeNormalizado(entry.area, q) ||
    incluyeNormalizado(entry.tutorNombre, q) ||
    incluyeNormalizado(entry.body, q)
  );
}

// Bitácora de fármacos: no es una colección propia, se arma "al vuelo"
// aplanando el array `farmacos` de cada caso clínico. Así nunca se
// desincroniza de lo que realmente registraste en cada caso.
function getMedUsageList() {
  const list = [];
  entriesForSection("casos").forEach((entry) => {
    (entry.farmacos || []).forEach((med, i) => {
      if (!med || !med.nombre) return;
      list.push({
        id: entry.id + "::" + i,
        entryId: entry.id,
        nombre: med.nombre,
        concentracion: med.concentracion || "",
        dosis: med.dosis || "",
        dosisAdministrada: med.dosisAdministrada || "",
        frecuencia: med.frecuencia || "",
        date: entry.date,
        paciente: entry.meta,
        especie: entry.especie,
        caseTitle: entry.title,
        _sortKey: entry._sortKey || 0
      });
    });
  });
  return list;
}

function matchesMedQuery(item, q) {
  if (!q) return true;
  q = normalizarBusqueda(q);
  return (
    incluyeNormalizado(item.nombre, q) ||
    incluyeNormalizado(item.concentracion, q) ||
    incluyeNormalizado(item.paciente, q) ||
    incluyeNormalizado(item.caseTitle, q) ||
    incluyeNormalizado(item.especie, q)
  );
}

/* Busca sobre la forma NORMALIZADA, asi el mismo buscador sirve para los
   documentos del esquema viejo y del nuevo. Ademas de nombre y via, ahora
   cubre familia e indicacion, que es lo que pide la vista del formulario. */
function matchesFormularioQuery(item, q) {
  if (!q) return true;
  q = normalizarBusqueda(q);
  const f = farmacoNormalizado(item);
  return (
    incluyeNormalizado(f.nombreGenerico, q) ||
    incluyeNormalizado(f.familia, q) ||
    f.dosis.some((d) => incluyeNormalizado(d.via, q) || incluyeNormalizado(d.indicacion, q)) ||
    especiesDe(f).some((e) => incluyeNormalizado(e, q))
  );
}

function setConn(state_, text) {
  els.connPill.setAttribute("data-state", state_);
  els.connText.textContent = text;
}

let toastEl = null;
let toastTimer = null;
function showToast(text) {
  if (!toastEl) {
    toastEl = document.createElement("div");
    toastEl.className = "toast";
    document.body.appendChild(toastEl);
  }
  toastEl.textContent = text;
  toastEl.classList.remove("show");
  void toastEl.offsetWidth;
  toastEl.classList.add("show");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 1500);
}

// Un timer de debounce POR CAMPO (no uno global), para que editar un campo
// nunca cancele el guardado pendiente de otro. Clave: "<coleccion>:<entryId>:<campo>".
// La colección se pasa explícita porque "entries" y "formulario" son dos
// colecciones de Firestore separadas (no dos "section" dentro de la misma).
const saveTimers = new Map();

// Traduce el error de Firestore a algo accionable. Antes TODO fallo decía
// "Sin conexión — se guardará al reconectar", que es falso para los errores
// que no se reintentan solos: con persistencia offline activada, estar sin
// red NO lanza excepción (el escritura queda en cola), así que si llegamos
// al catch casi siempre es permiso o documento inexistente.
function mensajeDeErrorAlGuardar(err) {
  const code = err && err.code ? err.code : "";
  if (code === "permission-denied") return "Sin permiso para guardar — falta publicar las reglas";
  if (code === "not-found") return "No se encontró el documento para guardar";
  if (code === "unavailable") return "Sin conexión — se guardará al reconectar";
  return "No se pudo guardar";
}

/* opciones.createIfMissing → escribe con setDoc(merge) en vez de updateDoc.
   updateDoc falla si el documento todavía no existe; para el perfil eso es
   un problema, porque se crea solo la primera vez que entras y si esa
   creación falló, cada tecleo fallaba en silencio. Para casos y materias en
   cambio SÍ conviene updateDoc: si el documento fue borrado, no queremos
   revivirlo desde un editor abierto. El debounce por campo no cambia. */
function scheduleSave(collectionName, entryId, patch, statusEl, opciones) {
  const opts = opciones || {};
  const field = Object.keys(patch)[0] || "default";
  const key = collectionName + ":" + entryId + ":" + field;

  const existing = saveTimers.get(key);
  if (existing) clearTimeout(existing);

  if (statusEl) {
    statusEl.parentElement.setAttribute("data-state", "pending");
    statusEl.textContent = "Escribiendo…";
  }

  const timer = setTimeout(async () => {
    saveTimers.delete(key);
    try {
      // doc() va DENTRO del try: si entryId es null (por ejemplo si la
      // sesión se cerró con la pantalla de Configuración abierta) lanza, y
      // fuera del try quedaba como promesa rechazada sin capturar: el
      // estado se congelaba en "Escribiendo…" sin avisar nunca del fallo.
      const ref = doc(db, collectionName, entryId);
      const datos = { ...patch, updatedAt: serverTimestamp() };
      if (opts.createIfMissing) {
        await setDoc(ref, { uid: currentUid, ...datos }, { merge: true });
      } else {
        await updateDoc(ref, datos);
      }
      if (statusEl) {
        statusEl.parentElement.setAttribute("data-state", "ok");
        statusEl.textContent = "Sincronizado";
      }
      showToast("Guardado");
    } catch (err) {
      console.error("Fallo al guardar en " + collectionName + ":", err);
      if (statusEl) {
        statusEl.parentElement.setAttribute("data-state", "error");
        statusEl.textContent = mensajeDeErrorAlGuardar(err);
      }
    }
  }, 450);

  saveTimers.set(key, timer);
}

function buildSpeciesCheckboxes(selected, onChange) {
  const wrap = document.createElement("div");
  wrap.className = "checkbox-group";
  const values = new Set(Array.isArray(selected) ? selected : []);
  SPECIES_OPTIONS.forEach((opt) => {
    const label = document.createElement("label");
    label.className = "checkbox-item";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = opt;
    input.checked = values.has(opt);
    input.addEventListener("change", () => {
      if (input.checked) values.add(opt);
      else values.delete(opt);
      onChange(Array.from(values));
    });
    const span = document.createElement("span");
    span.textContent = opt;
    label.appendChild(input);
    label.appendChild(span);
    wrap.appendChild(label);
  });
  return wrap;
}

// Redimensiona/comprime en el navegador antes de subir (canvas nativo,
// sin librerías): limita el lado más largo a maxDim y reexporta como
// JPEG a la calidad indicada. Si el archivo no es una imagen decodificable
// (o algo falla), se resuelve con el archivo original sin tocarlo.
function compressImage(file, maxDim, quality) {
  return new Promise((resolve) => {
    if (!file.type || !file.type.startsWith("image/")) {
      resolve(file);
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        if (width >= height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => resolve(blob || file), "image/jpeg", quality);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });
}

function attachVoiceInput(button, targetEl) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const label = button.querySelector(".label");

  if (!SpeechRecognition) {
    button.style.display = "none";
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = "es-419";
  recognition.continuous = true;
  recognition.interimResults = false;

  let listening = false;

  function setListening(value) {
    listening = value;
    button.setAttribute("data-listening", value ? "true" : "false");
    label.textContent = value ? "Escuchando… (clic para detener)" : "Dictar por voz";
  }

  recognition.addEventListener("result", (event) => {
    let chunk = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      if (event.results[i].isFinal) {
        chunk += event.results[i][0].transcript;
      }
    }
    chunk = chunk.trim();
    if (!chunk) return;
    const current = targetEl.value;
    const needsSpace = current && !/\s$/.test(current);
    targetEl.value = current + (needsSpace ? " " : "") + chunk;
    targetEl.dispatchEvent(new Event("input", { bubbles: true }));
  });

  recognition.addEventListener("end", () => setListening(false));

  recognition.addEventListener("error", (event) => {
    setListening(false);
    if (event.error !== "no-speech" && event.error !== "aborted") {
      alert("No se pudo usar el micrófono (" + event.error + "). Revisa los permisos del navegador.");
    }
  });

  button.addEventListener("click", () => {
    if (listening) {
      recognition.stop();
      return;
    }
    try {
      recognition.start();
      setListening(true);
    } catch (err) {
      /* recognition already active; ignore */
    }
  });
}

/* ---------- Cola de fotos pendientes ----------
   Firestore ya guarda el TEXTO sin conexion por su cuenta (IndexedDB), pero
   Storage no: una foto que falla al subir se perdia y solo quedaba un
   alert(). Aqui se guarda el archivo en IndexedDB junto con la entrada a la
   que pertenece, y se reintenta solo al volver la conexion.

   IndexedDB y no localStorage porque localStorage solo guarda texto: meter
   una foto ahi obligaria a convertirla a base64 (un tercio mas de peso) y
   se toparia con el limite de ~5 MB. IndexedDB guarda el Blob tal cual.

   Base propia, separada de la de Firestore: asi una limpieza de la cache de
   Firestore no se lleva por delante fotos que todavia no se han subido. */
const FOTOS_DB = "vetdiario-fotos-pendientes";
const FOTOS_STORE = "pendientes";
let fotosDbPromesa = null;

function abrirColaFotos() {
  if (fotosDbPromesa) return fotosDbPromesa;
  fotosDbPromesa = new Promise((resolve, reject) => {
    const req = indexedDB.open(FOTOS_DB, 1);
    req.onupgradeneeded = () => {
      const db_ = req.result;
      if (!db_.objectStoreNames.contains(FOTOS_STORE)) {
        const store = db_.createObjectStore(FOTOS_STORE, { keyPath: "id", autoIncrement: true });
        // Indice por entrada: la ficha abierta necesita SUS pendientes, no
        // los de todas las fichas.
        store.createIndex("entryId", "entryId", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }).catch((err) => {
    // Si IndexedDB no esta disponible (modo privado en algunos navegadores)
    // la app sigue funcionando: simplemente no hay cola.
    console.warn("No se pudo abrir la cola de fotos:", err);
    fotosDbPromesa = null;
    throw err;
  });
  return fotosDbPromesa;
}

function operacionCola(modo, fn) {
  return abrirColaFotos().then(
    (db_) =>
      new Promise((resolve, reject) => {
        const tx = db_.transaction(FOTOS_STORE, modo);
        const req = fn(tx.objectStore(FOTOS_STORE));
        tx.onerror = () => reject(tx.error);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      })
  );
}

function encolarFoto(registro) {
  return operacionCola("readwrite", (store) => store.add(registro));
}

function quitarFotoPendiente(id) {
  return operacionCola("readwrite", (store) => store.delete(id));
}

function fotosPendientesDeEntrada(entryId) {
  return operacionCola("readonly", (store) => store.index("entryId").getAll(entryId)).catch(() => []);
}

function todasLasFotosPendientes() {
  return operacionCola("readonly", (store) => store.getAll()).catch(() => []);
}

/* Solo se encola lo que puede arreglarse solo al volver la red. Un fallo de
   permisos o de cuota se repetiria indefinidamente en cada reconexion sin
   llegar nunca a subir, asi que esos siguen avisando al momento. */
function esFalloDeConexion(err) {
  if (!navigator.onLine) return true;
  const code = err && err.code ? err.code : "";
  if (code === "storage/retry-limit-exceeded") return true;
  // "sin-progreso" lo lanza el vigilante de uploadPhoto: la subida arranco
  // pero dejo de transferir bytes, que es exactamente perder la señal.
  return !!(err && err.message === "sin-progreso");
}

/* La ficha abierta se apunta aqui para que la cola pueda refrescar su
   cuadricula al terminar una subida. Solo puede haber una ficha abierta a
   la vez, asi que basta un hueco; render() lo limpia. */
let seccionFotosMontada = null;

/* Un objectURL por foto pendiente, reutilizado entre renders. Creando uno
   nuevo cada vez que se redibuja la ficha, el blob anterior se queda en
   memoria hasta recargar: con fotos de 1 MB eso se nota. */
const urlsPendientes = new Map();

function urlDePendiente(registro) {
  if (!urlsPendientes.has(registro.id)) {
    urlsPendientes.set(registro.id, URL.createObjectURL(registro.blob));
  }
  return urlsPendientes.get(registro.id);
}

function olvidarUrlPendiente(colaId) {
  const url = urlsPendientes.get(colaId);
  if (url) {
    URL.revokeObjectURL(url);
    urlsPendientes.delete(colaId);
  }
}

let colaEnCurso = false;

async function procesarColaFotos() {
  if (colaEnCurso || !currentUid || !navigator.onLine) return;
  colaEnCurso = true;
  try {
    const pendientes = (await todasLasFotosPendientes())
      .filter((p) => p.uid === currentUid)
      .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    if (!pendientes.length) return;

    let subidas = 0;
    for (const reg of pendientes) {
      // Si la red se cae a media cola, se para: lo que queda sigue guardado
      // y se retomara en la proxima reconexion.
      if (!navigator.onLine) break;
      try {
        const url = await uploadPhoto(reg.path, reg.blob, () => {});
        const foto = { url, path: reg.path, name: reg.name };
        // arrayUnion en vez de reescribir el array entero: si mientras tanto
        // agregaste otra foto desde el celular, no se pierde.
        await updateDoc(doc(db, "entries", reg.entryId), {
          fotos: arrayUnion(foto),
          updatedAt: serverTimestamp()
        });
        await quitarFotoPendiente(reg.id);
        subidas++;
        if (seccionFotosMontada && seccionFotosMontada.entryId === reg.entryId) {
          seccionFotosMontada.alSubir(reg.id, foto);
        }
      } catch (err) {
        if (esFalloDeConexion(err)) break; // se reintenta en la proxima
        // La entrada ya no existe (la borraste) o Storage la rechaza: esta
        // foto no va a subir nunca, se saca de la cola para no atascarla.
        console.warn("Foto pendiente descartada:", err);
        await quitarFotoPendiente(reg.id);
      }
    }
    if (subidas) showToast(subidas === 1 ? "Foto pendiente subida" : subidas + " fotos pendientes subidas");
  } finally {
    colaEnCurso = false;
  }
}

/* Sube un archivo a Storage informando el avance real. Antes se usaba
   uploadBytes(), que no da progreso: si la subida se quedaba colgada (sin
   red, Storage no habilitado, reglas que no responden) la promesa nunca se
   resolvía ni fallaba y la foto se quedaba en "Subiendo…" para siempre.
   Con uploadBytesResumable sí hay eventos de avance, y un vigilante corta
   la subida si pasa un minuto sin transferir un solo byte. */
function uploadPhoto(path, blob, onProgress) {
  return new Promise((resolve, reject) => {
    const task = uploadBytesResumable(storageRef(storage, path), blob, { contentType: "image/jpeg" });
    let lastBytes = -1;
    let lastMovedAt = Date.now();

    const watchdog = setInterval(() => {
      if (Date.now() - lastMovedAt > 60000) {
        clearInterval(watchdog);
        try {
          task.cancel();
        } catch (e) {
          /* ya terminó o ya estaba cancelada */
        }
        reject(new Error("sin-progreso"));
      }
    }, 5000);

    task.on(
      "state_changed",
      (snap) => {
        if (snap.bytesTransferred !== lastBytes) {
          lastBytes = snap.bytesTransferred;
          lastMovedAt = Date.now();
        }
        if (snap.totalBytes > 0) {
          onProgress(Math.min(99, Math.round((snap.bytesTransferred / snap.totalBytes) * 100)));
        }
      },
      (err) => {
        clearInterval(watchdog);
        reject(err);
      },
      async () => {
        clearInterval(watchdog);
        try {
          resolve(await getDownloadURL(task.snapshot.ref));
        } catch (err) {
          reject(err);
        }
      }
    );
  });
}

function buildPhotosSection(entry, statusText) {
  const wrap = document.createElement("div");
  wrap.className = "photos";

  const head = document.createElement("div");
  head.className = "subcard-head";
  const label = document.createElement("span");
  label.textContent = "Fotos (radiografías, ecografías, paciente)";
  head.appendChild(label);
  wrap.appendChild(head);

  const grid = document.createElement("div");
  grid.className = "photos-grid";
  wrap.appendChild(grid);

  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "image/*";
  fileInput.multiple = true;
  fileInput.style.display = "none";
  wrap.appendChild(fileInput);

  /* Al leer se descartan los marcadores de "subiendo": son temporales, su
     `url` es un blob: local que muere al recargar la página. Si alguno
     quedó guardado en Firestore por una subida interrumpida, se ve como
     una foto eternamente "Subiendo…" que nunca carga; al filtrarlos aquí
     desaparecen y el siguiente commit() limpia el documento. */
  const photos = (Array.isArray(entry.fotos) ? entry.fotos : []).filter(
    (p) => p && p.url && !p.uploading && !String(p.url).startsWith("blob:")
  );

  // Nunca se persiste un marcador en curso ni uno pendiente: solo fotos ya
  // subidas a Storage, que son las que tienen una URL definitiva. Las
  // pendientes viven en IndexedDB, no en Firestore — su `url` es un blob:
  // local que no significaria nada en otro dispositivo.
  function commit() {
    const persistible = photos.filter(
      (p) => p && p.url && !p.uploading && !p.pendiente && !String(p.url).startsWith("blob:")
    );
    scheduleSave("entries", entry.id, { fotos: persistible }, statusText);
  }

  /* Fotos que quedaron en la cola de una sesion anterior. Se leen de
     IndexedDB y se vuelven a mostrar como pendientes: el objectURL del
     intento original murio al recargar, asi que se crea uno nuevo desde el
     blob guardado. Sin esto, al recargar sin conexion parecerian perdidas. */
  fotosPendientesDeEntrada(entry.id).then((pendientes) => {
    const nuevas = pendientes.filter((p) => !photos.some((f) => f.colaId === p.id));
    if (!nuevas.length) return;
    nuevas.forEach((p) => {
      photos.push({ url: urlDePendiente(p), name: p.name, pendiente: true, colaId: p.id });
    });
    renderGrid();
  });

  // La cola avisa por aqui cuando logra subir una de estas fotos, para que
  // la cuadricula cambie el rotulo "Pendiente" por la foto real sin tener
  // que cerrar la ficha (mientras esta abierta, los snapshots no redibujan).
  seccionFotosMontada = {
    entryId: entry.id,
    alSubir(colaId, foto) {
      olvidarUrlPendiente(colaId);
      const idx = photos.findIndex((p) => p.colaId === colaId);
      if (idx > -1) photos[idx] = foto;
      else photos.push(foto);
      renderGrid();
    }
  };

  function renderGrid() {
    grid.innerHTML = "";

    photos.forEach((photo, i) => {
      const tile = document.createElement("div");
      tile.className = "photo-tile";

      const img = document.createElement("img");
      img.src = photo.url;
      img.alt = photo.name || "Foto";
      img.loading = "lazy";
      tile.appendChild(img);

      if (photo.uploading) {
        const spin = document.createElement("div");
        spin.className = "photo-uploading";
        spin.textContent = photo.progress != null ? "Subiendo… " + photo.progress + "%" : "Subiendo…";
        tile.appendChild(spin);
      } else if (photo.pendiente) {
        const aviso = document.createElement("div");
        aviso.className = "photo-uploading photo-pendiente";
        aviso.textContent = "Pendiente de subir";
        tile.appendChild(aviso);

        // Tambien se puede descartar una pendiente: si no, una foto que no
        // quieres se queda reintentandose en cada reconexion sin manera de
        // sacarla.
        const del = document.createElement("button");
        del.type = "button";
        del.className = "photo-remove";
        del.textContent = "×";
        del.setAttribute("aria-label", "Descartar foto pendiente");
        del.addEventListener("click", async () => {
          const ok = await askConfirm({
            title: "¿Descartar esta foto?",
            message: "Todavía no se ha subido. Si la descartas, se pierde.",
            confirmLabel: "Descartar"
          });
          if (!ok) return;
          await quitarFotoPendiente(photo.colaId).catch(() => {});
          olvidarUrlPendiente(photo.colaId);
          const idx = photos.indexOf(photo);
          if (idx > -1) photos.splice(idx, 1);
          renderGrid();
        });
        tile.appendChild(del);
      } else {
        const del = document.createElement("button");
        del.type = "button";
        del.className = "photo-remove";
        del.textContent = "×";
        del.setAttribute("aria-label", "Eliminar foto");
        del.addEventListener("click", async () => {
          const ok = await askConfirm({
            title: "¿Eliminar esta foto?",
            message: "Se borra también del almacenamiento y no se puede deshacer.",
            confirmLabel: "Eliminar"
          });
          if (!ok) return;
          tile.style.opacity = "0.4";
          try {
            if (photo.path) await deleteObject(storageRef(storage, photo.path));
          } catch (err) {
            /* si ya no existe en Storage, igual la quitamos de la lista */
          }
          const idx = photos.indexOf(photo);
          if (idx > -1) photos.splice(idx, 1);
          renderGrid();
          commit();
        });
        tile.appendChild(del);
      }

      grid.appendChild(tile);
    });

    const addTile = document.createElement("button");
    addTile.type = "button";
    addTile.className = "photo-add";
    addTile.textContent = "+";
    addTile.setAttribute("aria-label", "Agregar foto");
    addTile.addEventListener("click", () => fileInput.click());
    grid.appendChild(addTile);
  }

  fileInput.addEventListener("change", async () => {
    const files = Array.from(fileInput.files || []);
    fileInput.value = "";
    for (const file of files) {
      const objectUrl = URL.createObjectURL(file);
      const placeholder = { url: objectUrl, name: file.name, uploading: true, progress: 0 };
      photos.push(placeholder);
      renderGrid();
      const path = "photos/" + currentUid + "/" + entry.id + "/" + Date.now() + "_" + file.name;
      // Fuera del try para poder reusarlo en el catch: lo que se encola es
      // la version comprimida, no el original de varios MB.
      let comprimida = null;
      try {
        comprimida = await compressImage(file, 1600, 0.82);
        const url = await uploadPhoto(path, comprimida, (pct) => {
          placeholder.progress = pct;
          renderGrid();
        });
        const idx = photos.indexOf(placeholder);
        if (idx > -1) photos[idx] = { url, path, name: file.name };
        URL.revokeObjectURL(objectUrl);
        renderGrid();
        commit();
      } catch (err) {
        const idx = photos.indexOf(placeholder);

        if (esFalloDeConexion(err)) {
          // Sin red: la foto NO se pierde. Se guarda en IndexedDB y el
          // marcador pasa de "Subiendo…" a "Pendiente de subir". El
          // objectURL se conserva (no se revoca) porque es lo que sigue
          // mostrando la miniatura hasta que suba.
          try {
            const colaId = await encolarFoto({
              uid: currentUid,
              entryId: entry.id,
              path,
              name: file.name,
              blob: comprimida || file,
              createdAt: Date.now()
            });
            // Se reaprovecha el objectURL que ya estaba mostrando la
            // miniatura, en vez de crear otro al volver a dibujar la ficha.
            urlsPendientes.set(colaId, objectUrl);
            if (idx > -1) photos[idx] = { url: objectUrl, name: file.name, pendiente: true, colaId };
            renderGrid();
            showToast("Sin conexión — la foto se subirá al reconectar");
            continue;
          } catch (errCola) {
            console.warn("No se pudo encolar la foto:", errCola);
            // Si ni la cola funciona, se cae al aviso de siempre.
          }
        }

        if (idx > -1) photos.splice(idx, 1);
        URL.revokeObjectURL(objectUrl);
        renderGrid();
        alert(
          err && err.message === "sin-progreso"
            ? "La subida de " + file.name + " se quedó sin avanzar y se canceló. Revisa tu conexión o si Storage está activado en el proyecto de Firebase."
            : "No se pudo subir " + file.name + ". Revisa tu conexión (o si Storage sigue sin activarse en el proyecto)."
        );
      }
    }
  });

  renderGrid();
  return wrap;
}

function buildMedsSection(entry, statusText) {
  const wrap = document.createElement("div");
  wrap.className = "meds";

  const head = document.createElement("div");
  head.className = "subcard-head";
  const toggleBtn = document.createElement("button");
  toggleBtn.type = "button";
  toggleBtn.className = "toggle-btn";
  const consultBtn = document.createElement("button");
  consultBtn.type = "button";
  consultBtn.className = "link-btn";
  consultBtn.textContent = "Consultar formulario";
  consultBtn.addEventListener("click", () => openCalculatorOverlay({ caseEntry: entry }));
  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "link-btn";
  addBtn.textContent = "+ Agregar fármaco";
  const headActions = document.createElement("div");
  headActions.className = "subcard-actions";
  headActions.appendChild(consultBtn);
  headActions.appendChild(addBtn);
  head.appendChild(toggleBtn);
  head.appendChild(headActions);
  wrap.appendChild(head);

  const tableWrap = document.createElement("div");
  tableWrap.className = "meds-table-wrap";
  const table = document.createElement("div");
  table.className = "meds-table";
  tableWrap.appendChild(table);
  wrap.appendChild(tableWrap);

  const meds = Array.isArray(entry.farmacos) ? entry.farmacos.map((m) => ({ ...m })) : [];

  // Colapsado por defecto: la lista de fármacos solo se despliega cuando
  // el usuario lo pide, en vez de ocupar espacio en la pantalla siempre.
  let expanded = false;

  function updateToggle() {
    toggleBtn.textContent = (expanded ? "▾ " : "▸ ") + "Fármacos" + (meds.length ? " (" + meds.length + ")" : "");
    tableWrap.hidden = !expanded;
  }

  toggleBtn.addEventListener("click", () => {
    expanded = !expanded;
    updateToggle();
  });

  function commit() {
    scheduleSave("entries", entry.id, { farmacos: meds }, statusText);
  }

  function renderRows() {
    table.innerHTML = "";

    if (meds.length === 0) {
      const empty = document.createElement("div");
      empty.className = "meds-empty";
      empty.textContent = "Sin fármacos registrados.";
      table.appendChild(empty);
      return;
    }

    const headerRow = document.createElement("div");
    headerRow.className = "meds-row meds-row-head";
    ["Nombre", "Concentración", "Dosis", "Dosis administrada", "Frecuencia", ""].forEach((t) => {
      const s = document.createElement("span");
      s.textContent = t;
      headerRow.appendChild(s);
    });
    table.appendChild(headerRow);

    function medField(labelText, inputEl) {
      const field = document.createElement("div");
      field.className = "meds-field";
      const lbl = document.createElement("span");
      lbl.className = "meds-field-label";
      lbl.textContent = labelText;
      field.appendChild(lbl);
      field.appendChild(inputEl);
      return field;
    }

    meds.forEach((med, i) => {
      const row = document.createElement("div");
      row.className = "meds-row";

      const nameInput = document.createElement("input");
      nameInput.placeholder = "Ej. Amoxicilina";
      nameInput.value = med.nombre || "";
      nameInput.addEventListener("input", () => {
        meds[i].nombre = nameInput.value;
        commit();
      });

      const concInput = document.createElement("input");
      concInput.placeholder = "Ej. 50 mg/mL";
      concInput.value = med.concentracion || "";
      concInput.addEventListener("input", () => {
        meds[i].concentracion = concInput.value;
        commit();
      });

      const doseInput = document.createElement("input");
      doseInput.placeholder = "Ej. 20 mg/kg";
      doseInput.value = med.dosis || "";
      doseInput.addEventListener("input", () => {
        meds[i].dosis = doseInput.value;
        commit();
      });

      const doseGivenInput = document.createElement("input");
      doseGivenInput.placeholder = "Ej. 500 mg";
      doseGivenInput.value = med.dosisAdministrada || "";
      doseGivenInput.addEventListener("input", () => {
        meds[i].dosisAdministrada = doseGivenInput.value;
        commit();
      });

      const freqInput = document.createElement("input");
      freqInput.placeholder = "Ej. c/12h";
      freqInput.value = med.frecuencia || "";
      freqInput.addEventListener("input", () => {
        meds[i].frecuencia = freqInput.value;
        commit();
      });

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "meds-remove";
      removeBtn.textContent = "×";
      removeBtn.setAttribute("aria-label", "Quitar fármaco");
      removeBtn.addEventListener("click", () => {
        meds.splice(i, 1);
        renderRows();
        updateToggle();
        commit();
      });

      row.appendChild(medField("Nombre", nameInput));
      row.appendChild(medField("Concentración", concInput));
      row.appendChild(medField("Dosis", doseInput));
      row.appendChild(medField("Dosis administrada", doseGivenInput));
      row.appendChild(medField("Frecuencia", freqInput));
      row.appendChild(removeBtn);
      table.appendChild(row);
    });
  }

  renderRows();
  updateToggle();

  addBtn.addEventListener("click", () => {
    meds.push({ nombre: "", concentracion: "", dosis: "", dosisAdministrada: "", frecuencia: "" });
    renderRows();
    commit();
    expanded = true;
    updateToggle();
    const inputs = table.querySelectorAll(".meds-row:last-child input");
    if (inputs[0]) inputs[0].focus();
  });

  return wrap;
}

// Agrega una entrada nueva al array `evoluciones` de un caso directamente
// en Firestore (escritura inmediata, no debounced: se usa para acciones
// puntuales de un clic — "+ Agregar evolución" y "Agregar a las notas del caso" desde
// la calculadora — no para campos que el usuario escribe letra por letra).
/* Devuelve la versión más reciente de una entrada. Mientras una ficha está
   abierta ya no se redibuja con cada snapshot, así que el objeto `entry`
   que capturaron los manejadores puede haber quedado viejo; state.entries
   en cambio sí se actualiza siempre. Importa sobre todo antes de escribir
   un array completo (evoluciones), porque partir de una copia vieja
   borraría lo que se haya agregado desde que se abrió la ficha. */
function currentEntry(entry) {
  if (!entry || !entry.id) return entry;
  return state.entries.find((e) => e.id === entry.id) || entry;
}

async function addEvolutionToCase(caseEntry, texto) {
  const fresh = currentEntry(caseEntry);
  const current = Array.isArray(fresh.evoluciones) ? fresh.evoluciones.slice() : [];
  current.push({ date: todayISO(), texto });
  await updateDoc(doc(db, "entries", caseEntry.id), { evoluciones: current, updatedAt: serverTimestamp() });
}

function buildEvolucionesSection(entry, statusText) {
  const wrap = document.createElement("div");
  wrap.className = "evols";

  const head = document.createElement("div");
  head.className = "subcard-head";
  const label = document.createElement("span");
  label.textContent = "Evoluciones";
  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "link-btn";
  addBtn.textContent = "+ Agregar evolución";
  head.appendChild(label);
  head.appendChild(addBtn);
  wrap.appendChild(head);

  const list = document.createElement("div");
  list.className = "evols-list";
  wrap.appendChild(list);

  const evols = Array.isArray(entry.evoluciones) ? entry.evoluciones.map((e) => ({ ...e })) : [];

  function commit() {
    scheduleSave("entries", entry.id, { evoluciones: evols }, statusText);
  }

  function renderItems() {
    list.innerHTML = "";

    if (evols.length === 0) {
      const empty = document.createElement("div");
      empty.className = "meds-empty";
      empty.textContent = "Sin evoluciones registradas.";
      list.appendChild(empty);
      return;
    }

    // El array se guarda en orden de creación; para mostrarlo de más
    // reciente a más antigua se calcula un orden de visualización aparte,
    // sin reordenar el array real.
    const order = evols
      .map((_, i) => i)
      .sort((a, b) => (evols[b].date || "").localeCompare(evols[a].date || "") || b - a);

    order.forEach((i) => {
      const evo = evols[i];
      const item = document.createElement("div");
      item.className = "evol-item";

      const itemHead = document.createElement("div");
      itemHead.className = "evol-item-head";

      const dateInput = document.createElement("input");
      dateInput.type = "date";
      dateInput.value = evo.date || "";
      dateInput.addEventListener("change", () => {
        evols[i].date = dateInput.value;
        commit();
        renderItems();
      });

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "meds-remove";
      removeBtn.textContent = "×";
      removeBtn.setAttribute("aria-label", "Quitar evolución");
      removeBtn.addEventListener("click", () => {
        evols.splice(i, 1);
        renderItems();
        commit();
      });

      itemHead.appendChild(dateInput);
      itemHead.appendChild(removeBtn);

      const textArea = document.createElement("textarea");
      textArea.className = "evol-text";
      textArea.placeholder = "Evolución, controles, seguimiento…";
      textArea.value = evo.texto || "";
      textArea.addEventListener("input", () => {
        evols[i].texto = textArea.value;
        commit();
      });

      item.appendChild(itemHead);
      item.appendChild(textArea);
      list.appendChild(item);
    });
  }

  renderItems();

  addBtn.addEventListener("click", () => {
    evols.push({ date: todayISO(), texto: "" });
    renderItems();
    commit();
    const areas = list.querySelectorAll(".evol-text");
    if (areas[0]) areas[0].focus();
  });

  return wrap;
}

/* ================= Calculadora de dosis (overlay) =================
   Puede abrirse SIN contexto de caso (desde Estudio o Inicio, solo
   consulta) o CON contexto de caso (desde la sección de fármacos de un
   caso abierto). Solo cuando hay contexto de caso se muestra el botón
   "Agregar a las notas del caso", que agrega el resultado como una nueva evolución
   del caso — nunca escribe en la tabla de fármacos ni en "Dosis
   administrada". Esto fue una decisión explícita del usuario. */
function buildDoseCalculator(context) {
  const ctx = context || {};
  const wrap = document.createElement("div");
  wrap.className = "calc";

  const farmacos = farmacosNormalizados();

  const nameField = document.createElement("div");
  nameField.className = "calc-field";
  const nameLabel = document.createElement("label");
  nameLabel.textContent = "Fármaco";
  const nameInput = document.createElement("input");
  nameInput.setAttribute("list", "calcFarmacoList");
  nameInput.placeholder = "Escribe el nombre…";
  const datalist = document.createElement("datalist");
  datalist.id = "calcFarmacoList";
  farmacos.forEach((f) => {
    if (!f.nombreGenerico) return;
    const opt = document.createElement("option");
    opt.value = f.nombreGenerico;
    datalist.appendChild(opt);
  });
  nameField.appendChild(nameLabel);
  nameField.appendChild(nameInput);
  nameField.appendChild(datalist);

  const speciesField = document.createElement("div");
  speciesField.className = "calc-field";
  speciesField.hidden = true;
  const speciesLabel = document.createElement("label");
  speciesLabel.textContent = "Especie";
  const speciesSelect = document.createElement("select");
  speciesField.appendChild(speciesLabel);
  speciesField.appendChild(speciesSelect);

  // Indicacion: un mismo farmaco y especie pueden tener varias pautas (dosis
  // de carga y mantenimiento, por ejemplo), y elegir la equivocada cambia el
  // resultado por completo.
  const indicacionField = document.createElement("div");
  indicacionField.className = "calc-field";
  indicacionField.hidden = true;
  const indicacionLabel = document.createElement("label");
  indicacionLabel.textContent = "Indicación / pauta";
  const indicacionSelect = document.createElement("select");
  indicacionField.appendChild(indicacionLabel);
  indicacionField.appendChild(indicacionSelect);

  const weightField = document.createElement("div");
  weightField.className = "calc-field";
  const weightLabel = document.createElement("label");
  weightLabel.textContent = "Peso del paciente (kg)";
  const weightInput = document.createElement("input");
  weightInput.type = "number";
  weightInput.step = "any";
  weightInput.min = "0";
  weightInput.placeholder = "Ej. 12.5";
  const ctxCase = ctx.caseEntry ? currentEntry(ctx.caseEntry) : null;
  if (ctxCase && ctxCase.peso) {
    const parsedPeso = parseFloat(String(ctxCase.peso).replace(",", "."));
    if (isFinite(parsedPeso)) weightInput.value = parsedPeso;
  }
  weightField.appendChild(weightLabel);
  weightField.appendChild(weightInput);

  // Presentacion: de aqui sale la concentracion del frasco, que es lo que
  // convierte los mg en mL.
  const presField = document.createElement("div");
  presField.className = "calc-field";
  presField.hidden = true;
  const presLabel = document.createElement("label");
  presLabel.textContent = "Presentación";
  const presSelect = document.createElement("select");
  presField.appendChild(presLabel);
  presField.appendChild(presSelect);

  const result = document.createElement("div");
  result.className = "calc-result";

  let selectedDrug = null;
  let lastSummaryLine = "";
  let lastTotalLine = "";

  function findDrug(name) {
    const n = normalizarBusqueda(name).trim();
    if (!n) return null;
    return farmacos.find((f) => normalizarBusqueda(f.nombreGenerico).trim() === n) || null;
  }

  // Solo entran al calculo las pautas CON fuente: una dosis sin fuente no es
  // verificable, y la regla del modulo es que un dato asi no se usa.
  function dosisUtilizables(farmaco, especie) {
    if (!farmaco) return [];
    return farmaco.dosis.filter(
      (d) =>
        String(d.fuente || "").trim() &&
        d.dosisMin != null &&
        isFinite(d.dosisMin) &&
        (!especie || String(d.especie || "").toLowerCase() === especie)
    );
  }

  function updateSpeciesField() {
    speciesSelect.innerHTML = "";
    if (!selectedDrug) {
      speciesField.hidden = true;
      return;
    }
    const especies = Array.from(
      new Set(dosisUtilizables(selectedDrug, "").map((d) => String(d.especie || "").toLowerCase()).filter(Boolean))
    );
    if (!especies.length) {
      speciesField.hidden = true;
      return;
    }
    speciesField.hidden = false;
    especies.forEach((e) => {
      const o = document.createElement("option");
      o.value = e;
      o.textContent = e;
      speciesSelect.appendChild(o);
    });
  }

  function updateIndicacionField() {
    indicacionSelect.innerHTML = "";
    const pautas = dosisUtilizables(selectedDrug, speciesSelect.value);
    if (pautas.length <= 1) {
      indicacionField.hidden = true;
      return;
    }
    indicacionField.hidden = false;
    pautas.forEach((d, i) => {
      const o = document.createElement("option");
      o.value = String(i);
      o.textContent =
        (d.indicacion || "Pauta " + (i + 1)) + " — " + d.dosisMin + (d.dosisMax !== d.dosisMin ? "–" + d.dosisMax : "") + " " + d.unidad;
      indicacionSelect.appendChild(o);
    });
  }

  function updatePresField() {
    presSelect.innerHTML = "";
    const pres = selectedDrug ? selectedDrug.presentaciones.filter((p) => p.concentracion > 0) : [];
    if (!pres.length) {
      presField.hidden = true;
      return;
    }
    presField.hidden = false;
    pres.forEach((p, i) => {
      const o = document.createElement("option");
      o.value = String(i);
      o.textContent =
        (p.nombreComercialLocal || "Presentación " + (i + 1)) + " — " + p.concentracion + " " + (p.unidadConc || "");
      presSelect.appendChild(o);
    });
  }

  function presentacionElegida() {
    const pres = selectedDrug ? selectedDrug.presentaciones.filter((p) => p.concentracion > 0) : [];
    if (!pres.length) return null;
    return pres[Number(presSelect.value) || 0] || pres[0];
  }

  function showEmpty(text) {
    result.innerHTML = "";
    const empty = document.createElement("div");
    empty.className = "calc-empty";
    empty.textContent = text;
    result.appendChild(empty);
  }

  function addLine(text, cls) {
    const line = document.createElement("div");
    line.className = cls || "calc-line";
    line.textContent = text;
    result.appendChild(line);
  }

  let addBtn = null;
  let addedMsg = null;

  function updateAddButton(enabled) {
    if (!addBtn) return;
    addBtn.disabled = !enabled;
    if (addedMsg) addedMsg.remove();
    addedMsg = null;
  }

  function renderResult() {
    result.innerHTML = "";
    lastSummaryLine = "";
    lastTotalLine = "";
    updateAddButton(false);

    if (!selectedDrug) {
      showEmpty("Escribe el nombre de un fármaco del formulario para calcular.");
      if (addBtn) result.appendChild(addBtn);
      return;
    }

    /* Bloqueo por alerta. Va ANTES que cualquier otra comprobacion: si el
       farmaco tiene una contraindicacion absoluta para esta especie, no se
       calcula nada. Un numero en pantalla, aunque lleve una advertencia al
       lado, invita a usarlo. */
    const alerta = alertaQueBloquea(selectedDrug, speciesSelect.value);
    if (alerta) {
      const bloque = document.createElement("div");
      bloque.className = "calc-bloqueo";
      const titulo = document.createElement("div");
      titulo.className = "calc-bloqueo-titulo";
      titulo.textContent = "⚠ Cálculo bloqueado — contraindicación absoluta";
      const texto = document.createElement("div");
      texto.textContent = alerta;
      bloque.appendChild(titulo);
      bloque.appendChild(texto);
      result.appendChild(bloque);
      if (addBtn) result.appendChild(addBtn);
      return;
    }

    const pautas = dosisUtilizables(selectedDrug, speciesSelect.value);
    if (!pautas.length) {
      const conFuente = selectedDrug.dosis.filter((d) => String(d.fuente || "").trim()).length;
      showEmpty(
        selectedDrug.dosis.length && !conFuente
          ? "Este fármaco tiene dosis cargadas pero ninguna con fuente. Sin fuente no se calcula."
          : "Este fármaco no tiene una dosis numérica cargada para esa especie."
      );
      if (addBtn) result.appendChild(addBtn);
      return;
    }

    const pauta = pautas[Number(indicacionSelect.value) || 0] || pautas[0];

    const weight = parseFloat(weightInput.value);
    if (!weight || weight <= 0) {
      showEmpty("Ingresa el peso del paciente para calcular la dosis.");
      if (addBtn) result.appendChild(addBtn);
      return;
    }

    const unidad = pauta.unidad || "mg/kg";
    const massUnit = unidad.includes("/") ? unidad.split("/")[0].trim() : unidad;
    const dosisMin = Number(pauta.dosisMin);
    const dosisMax = pauta.dosisMax != null && isFinite(pauta.dosisMax) ? Number(pauta.dosisMax) : dosisMin;

    // Se calcula sobre el punto medio del rango; los extremos se muestran
    // debajo para que se vea el margen con el que se esta trabajando.
    const dosisUsada = (dosisMin + dosisMax) / 2;
    const totalDose = weight * dosisUsada;
    const totalMin = weight * dosisMin;
    const totalMax = weight * dosisMax;

    const especieNota = speciesSelect.value ? " (" + speciesSelect.value + ")" : "";
    addLine(
      "Dosis" +
        especieNota +
        " = " +
        weight +
        " kg × " +
        roundNice(dosisUsada) +
        " " +
        unidad +
        (dosisMin !== dosisMax ? " (rango " + dosisMin + "–" + dosisMax + ")" : "")
    );

    const totalText = roundNice(totalDose) + " " + massUnit;
    addLine("= " + totalText, "calc-total");
    if (dosisMin !== dosisMax) {
      addLine("Rango total: " + roundNice(totalMin) + " – " + roundNice(totalMax) + " " + massUnit, "calc-line-suave");
    }

    lastSummaryLine =
      selectedDrug.nombreGenerico + ": " + weight + " kg × " + roundNice(dosisUsada) + " " + unidad + especieNota;
    lastTotalLine = "Dosis total = " + totalText;

    /* El volumen en mL es el resultado que importa: el error clinico real
       ocurre al convertir los mg a la concentracion del frasco. */
    const pres = presentacionElegida();
    if (pres) {
      const concUnidad = pres.unidadConc || "";
      const volUnit = concUnidad.includes("/") ? concUnidad.split("/")[1].trim() : "";
      const volume = totalDose / Number(pres.concentracion);
      const volText = roundNice(volume) + " " + volUnit;
      addLine("Volumen = " + totalText + " ÷ " + pres.concentracion + " " + concUnidad);
      addLine("= " + volText, "calc-total");
      if (dosisMin !== dosisMax) {
        addLine(
          "Rango: " +
            roundNice(totalMin / Number(pres.concentracion)) +
            " – " +
            roundNice(totalMax / Number(pres.concentracion)) +
            " " +
            volUnit,
          "calc-line-suave"
        );
      }
      lastTotalLine += " · Volumen a administrar = " + volText;
    } else {
      addLine(
        "Sin presentación cargada: no se puede convertir a mL. Agrega la concentración del frasco en la ficha del fármaco.",
        "calc-line-suave"
      );
    }

    /* Aviso de rango. El resultado NO se oculta: esconderlo empuja a
       recalcular a mano, que es peor que verlo con la advertencia al lado. */
    const dosisEfectiva = totalDose / weight;
    if (dosisEfectiva < dosisMin || dosisEfectiva > dosisMax) {
      const aviso = document.createElement("div");
      aviso.className = "calc-aviso";
      aviso.textContent =
        "⚠ La dosis usada (" +
        roundNice(dosisEfectiva) +
        " " +
        unidad +
        ") queda fuera del rango cargado (" +
        dosisMin +
        "–" +
        dosisMax +
        " " +
        unidad +
        ").";
      result.appendChild(aviso);
    }

    if (pauta.esExtralabel) {
      const extra = document.createElement("div");
      extra.className = "calc-aviso";
      extra.textContent = "⚠ Uso extraetiqueta: esta pauta no está en la etiqueta autorizada del producto.";
      result.appendChild(extra);
    }

    if (pauta.frecuenciaH) {
      addLine("Frecuencia: cada " + pauta.frecuenciaH + " h", "calc-line-suave");
    }
    if (pauta.duracionMaxDias) {
      addLine("Duración máxima: " + pauta.duracionMaxDias + " día(s)", "calc-line-suave");
    }

    // La fuente de la dosis usada, siempre visible junto al resultado.
    const fuente = document.createElement("div");
    fuente.className = "calc-fuente";
    fuente.textContent = "Fuente: " + pauta.fuente;
    result.appendChild(fuente);

    if (verificacionVencida(selectedDrug.verificadoEl)) {
      const viejo = document.createElement("div");
      viejo.className = "calc-aviso";
      viejo.textContent =
        "⚠ Ficha desactualizada: verificada el " + fechaCorta(selectedDrug.verificadoEl) + ". Revisa la fuente antes de usarla.";
      result.appendChild(viejo);
    }

    if (addBtn) {
      result.appendChild(addBtn);
      updateAddButton(true);
    }
  }

  nameInput.addEventListener("input", () => {
    selectedDrug = findDrug(nameInput.value);
    updateSpeciesField();
    updateIndicacionField();
    updatePresField();
    renderResult();
  });
  speciesSelect.addEventListener("change", () => {
    updateIndicacionField();
    renderResult();
  });
  indicacionSelect.addEventListener("change", renderResult);
  presSelect.addEventListener("change", renderResult);
  weightInput.addEventListener("input", renderResult);

  wrap.appendChild(nameField);
  wrap.appendChild(speciesField);
  wrap.appendChild(indicacionField);
  wrap.appendChild(weightField);
  wrap.appendChild(presField);
  wrap.appendChild(result);

  // "Agregar a las notas del caso": solo existe cuando la calculadora se abrió desde
  // un caso clínico específico. Escribe el resultado como una nueva
  // evolución del caso — es lo único que este botón hace.
  if (ctx.caseEntry) {
    addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "calc-add-btn";
    addBtn.textContent = "Agregar a las notas del caso";
    addBtn.disabled = true;
    addBtn.addEventListener("click", async () => {
      if (!lastSummaryLine) return;
      addBtn.disabled = true;
      addBtn.textContent = "Agregando…";
      try {
        await addEvolutionToCase(ctx.caseEntry, "Cálculo de dosis — " + lastSummaryLine + ". " + lastTotalLine + ".");
        addBtn.textContent = "Agregar a las notas del caso";
        if (addedMsg) addedMsg.remove();
        addedMsg = document.createElement("div");
        addedMsg.className = "calc-added-msg";
        addedMsg.textContent = "✓ Agregado a las notas del caso";
        result.appendChild(addedMsg);
      } catch (err) {
        addBtn.textContent = "Agregar a las notas del caso";
        alert("No se pudo agregar a las notas del caso. Revisa tu conexión e intenta de nuevo.");
      } finally {
        addBtn.disabled = false;
      }
    });
  }

  renderResult();

  return wrap;
}

/* ================= Modal de confirmación =================
   Reemplaza al confirm() nativo, que se dibuja con el estilo del navegador
   y rompe la identidad visual de la app. Devuelve una promesa que resuelve
   true/false, así que en el código se usa igual que antes pero con await:
       if (!(await askConfirm({...}))) return;
   Soporta además callback (onConfirm) para los casos que solo quieren
   ejecutar algo al aceptar. */
let confirmOverlayEl = null;
let confirmEscHandler = null;

function closeConfirm() {
  if (confirmOverlayEl) {
    confirmOverlayEl.remove();
    confirmOverlayEl = null;
  }
  if (confirmEscHandler) {
    document.removeEventListener("keydown", confirmEscHandler);
    confirmEscHandler = null;
  }
}

function askConfirm(options) {
  const opts = options || {};
  const titulo = opts.title || "¿Confirmar?";
  const mensaje = opts.message || "";
  const etiquetaOk = opts.confirmLabel || "Aceptar";
  const etiquetaCancelar = opts.cancelLabel || "Cancelar";
  const peligroso = opts.danger !== false;

  closeConfirm();

  return new Promise((resolve) => {
    let resuelto = false;
    function terminar(valor) {
      if (resuelto) return;
      resuelto = true;
      closeConfirm();
      if (valor && typeof opts.onConfirm === "function") opts.onConfirm();
      resolve(valor);
    }

    const backdrop = document.createElement("div");
    backdrop.className = "overlay-backdrop";
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) terminar(false);
    });

    const card = document.createElement("div");
    card.className = "overlay-card confirm-card";
    card.setAttribute("role", "alertdialog");
    card.setAttribute("aria-modal", "true");

    const h2 = document.createElement("h2");
    h2.className = "confirm-title";
    h2.textContent = titulo;
    card.appendChild(h2);

    if (mensaje) {
      const p = document.createElement("p");
      p.className = "confirm-msg";
      p.textContent = mensaje;
      card.appendChild(p);
    }

    const acciones = document.createElement("div");
    acciones.className = "confirm-actions";

    const btnCancelar = document.createElement("button");
    btnCancelar.type = "button";
    btnCancelar.className = "btn-secondary";
    btnCancelar.textContent = etiquetaCancelar;
    btnCancelar.addEventListener("click", () => terminar(false));

    const btnOk = document.createElement("button");
    btnOk.type = "button";
    btnOk.className = peligroso ? "btn-primary btn-danger" : "btn-primary";
    btnOk.textContent = etiquetaOk;
    btnOk.addEventListener("click", () => terminar(true));

    acciones.appendChild(btnCancelar);
    acciones.appendChild(btnOk);
    card.appendChild(acciones);

    backdrop.appendChild(card);
    document.body.appendChild(backdrop);
    confirmOverlayEl = backdrop;

    confirmEscHandler = (e) => {
      if (e.key === "Escape") terminar(false);
      if (e.key === "Enter" && document.activeElement === btnOk) terminar(true);
    };
    document.addEventListener("keydown", confirmEscHandler);

    // El foco arranca en Cancelar: si alguien viene tecleando Enter, la
    // acción destructiva no se dispara sola.
    setTimeout(() => btnCancelar.focus(), 0);
  });
}

let calcOverlayEl = null;
let calcOverlayEscHandler = null;

function closeCalculatorOverlay() {
  if (calcOverlayEl) {
    calcOverlayEl.remove();
    calcOverlayEl = null;
  }
  if (calcOverlayEscHandler) {
    document.removeEventListener("keydown", calcOverlayEscHandler);
    calcOverlayEscHandler = null;
  }
}

// El overlay no toca state.page/state.activeId ni llama a render(): al
// cerrarlo, la página de abajo (p. ej. un caso clínico en edición) queda
// exactamente como estaba, porque nunca se volvió a dibujar.
function openCalculatorOverlay(context) {
  closeCalculatorOverlay();

  const backdrop = document.createElement("div");
  backdrop.className = "overlay-backdrop";
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) closeCalculatorOverlay();
  });

  const card = document.createElement("div");
  card.className = "overlay-card";

  const head = document.createElement("div");
  head.className = "overlay-head";
  const h2 = document.createElement("h2");
  h2.textContent = "Formulario y calculadora de dosis";
  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "overlay-close";
  closeBtn.textContent = "×";
  closeBtn.setAttribute("aria-label", "Cerrar");
  closeBtn.addEventListener("click", closeCalculatorOverlay);
  head.appendChild(h2);
  head.appendChild(closeBtn);

  card.appendChild(head);

  if (context && context.caseEntry) {
    const note = document.createElement("p");
    note.className = "overlay-note";
    const fresh = currentEntry(context.caseEntry);
    note.textContent = "Caso: " + (fresh.meta || fresh.title || "(sin nombre)");
    card.appendChild(note);
  }

  card.appendChild(buildDoseCalculator(context));
  backdrop.appendChild(card);
  document.body.appendChild(backdrop);
  calcOverlayEl = backdrop;

  calcOverlayEscHandler = (e) => {
    if (e.key === "Escape") closeCalculatorOverlay();
  };
  document.addEventListener("keydown", calcOverlayEscHandler);
}

/* ================= Navegación / render principal ================= */

function updateNavCounts() {
  if (els.countPatients) els.countPatients.textContent = entriesForSection("casos").length;
  if (els.countFarmacos) els.countFarmacos.textContent = getMedUsageList().length;
  if (els.countStudy) els.countStudy.textContent = entriesForSection("materias").length + state.formulario.length;
}

function setActiveNav() {
  els.pageNav.forEach((btn) => {
    btn.setAttribute("aria-current", btn.getAttribute("data-page") === state.page ? "true" : "false");
  });
  updateNavCounts();
}

function goToPage(page) {
  state.page = page;
  state.activeId = null;
  state.query = "";
  state.areaFilter = "";
  state.especieFilter = "";
  state.formularioEspecieFilter = "";
  if (els.search) els.search.value = "";
  els.sidebar.classList.remove("open");
  render();
}

function pageHead(title, subtitle) {
  const head = document.createElement("div");
  head.className = "page-head";
  const left = document.createElement("div");
  const h1 = document.createElement("h1");
  h1.textContent = title;
  left.appendChild(h1);
  if (subtitle) {
    const p = document.createElement("p");
    p.textContent = subtitle;
    left.appendChild(p);
  }
  head.appendChild(left);
  return head;
}

function backLink(label, onClick) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "back-link";
  btn.textContent = "← " + label;
  btn.addEventListener("click", onClick);
  return btn;
}

function emptyState(glyph, title, body, extra) {
  const wrap = document.createElement("div");
  wrap.className = "page-empty";
  const g = document.createElement("div");
  g.className = "glyph";
  g.textContent = glyph;
  const h2 = document.createElement("h2");
  h2.textContent = title;
  const p = document.createElement("p");
  p.textContent = body;
  wrap.appendChild(g);
  wrap.appendChild(h2);
  wrap.appendChild(p);
  if (extra) wrap.appendChild(extra);
  return wrap;
}

/* Ficha de edición actualmente montada en pantalla (caso, materia o
   fármaco del formulario). Cada guardado dispara dos snapshots de
   Firestore — uno local inmediato por serverTimestamp() y otro cuando el
   servidor confirma — y antes cada snapshot llamaba a render(), que borra
   y reconstruye todo el contenido. Eso destruía el <input> que estabas
   escribiendo (se perdía el foco y saltaba el cursor) y reiniciaba el
   estado local de la ficha (la tabla de fármacos se volvía a cerrar sola).
   Con esta bandera, mientras una ficha esté abierta los snapshots
   actualizan los datos en memoria pero NO la redibujan. */
let mountedDetailId = null;

function detailIsBeingEdited() {
  return mountedDetailId !== null && mountedDetailId === state.activeId;
}

// ¿El cursor está dentro de un campo del área de contenido? Se usa para no
// redibujar por debajo de alguien que está escribiendo.
function isTypingInContent() {
  const el = document.activeElement;
  if (!el || !els.content.contains(el)) return false;
  return el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT";
}

/* Un snapshot que llega mientras escribes NO puede redibujar: render() vacía
   els.content y vuelve a crear los campos, así que el input que tenías bajo
   el cursor deja de existir — se pierde el foco, el texto seleccionado y el
   menú de sugerencias. Eso es el "guardado brusco": tu propio guardado
   vuelve como eco 450 ms después y te tumba el campo.

   detailIsBeingEdited() ya cubría las fichas abiertas, pero no las páginas
   de lista ni Configuración, que también tienen campos. Aquí se cubren
   todas: si hay alguien escribiendo, el render queda pendiente y se ejecuta
   en cuanto el cursor sale del campo. */
let renderPendiente = false;

function renderDesdeSnapshot() {
  if (detailIsBeingEdited() || isTypingInContent()) {
    renderPendiente = true;
    updateNavCounts();
    return;
  }
  render();
}

/* Al salir de un campo se recupera lo que se dejó pendiente. El setTimeout
   es para dar tiempo a que el foco aterrice: al saltar de un input a otro
   con Tab, focusout dispara ANTES de que el siguiente reciba el foco, y sin
   la espera redibujaríamos justo en medio del salto. Las fichas abiertas
   siguen bajo su propia regla: ahí no se redibuja hasta cerrarlas. */
document.addEventListener("focusout", () => {
  if (!renderPendiente) return;
  setTimeout(() => {
    if (!renderPendiente) return;
    if (detailIsBeingEdited() || isTypingInContent()) return;
    render();
  }, 200);
});

function render() {
  renderPendiente = false;
  mountedDetailId = null;
  // La cuadricula de fotos que estuviera montada deja de existir tras el
  // innerHTML = "": si la cola le hablara despues, escribiria sobre nodos
  // huerfanos.
  seccionFotosMontada = null;
  setActiveNav();
  els.content.innerHTML = "";

  const inner = document.createElement("div");
  inner.className = "content-inner";
  els.content.appendChild(inner);

  if (!state.ready) {
    inner.appendChild(emptyState("⏳", "Conectando con VetDiario…", "Un momento, esto solo pasa la primera vez."));
    return;
  }

  if (state.page === "patients") renderPatientsPage(inner);
  else if (state.page === "farmacos") renderFarmacosPage(inner);
  else if (state.page === "study") renderStudyPage(inner);
  else if (state.page === "settings") renderSettingsPage(inner);
  else renderDashboardPage(inner);
}

/* ---------- Inicio ---------- */

function renderDashboardPage(root) {
  root.appendChild(pageHead("Inicio", "Tus últimos casos y las herramientas de consulta."));

  const stats = document.createElement("div");
  stats.className = "stat-grid";
  const statDefs = [
    ["Casos activos", entriesForSection("casos").length],
    ["Materias", entriesForSection("materias").length],
    ["Fármacos usados", getMedUsageList().length],
    ["Formulario", state.formulario.length]
  ];
  statDefs.forEach(([l, n]) => {
    const c = document.createElement("div");
    c.className = "stat-card";
    c.innerHTML = '<span class="n">' + n + '</span><span class="l">' + l + "</span>";
    stats.appendChild(c);
  });
  root.appendChild(stats);

  const overviewCard = document.createElement("div");
  overviewCard.className = "card";
  const overviewHead = document.createElement("div");
  overviewHead.className = "card-head";
  const overviewTitle = document.createElement("h2");
  overviewTitle.textContent = "Pacientes y casos clínicos";
  const newCaseBtn = document.createElement("button");
  newCaseBtn.type = "button";
  newCaseBtn.className = "btn-primary";
  newCaseBtn.textContent = "+ Nuevo caso";
  newCaseBtn.addEventListener("click", () => createCase());
  overviewHead.appendChild(overviewTitle);
  overviewHead.appendChild(newCaseBtn);
  overviewCard.appendChild(overviewHead);

  const casos = entriesForSection("casos").sort((a, b) => (b._sortKey || 0) - (a._sortKey || 0)).slice(0, 6);
  overviewCard.appendChild(buildPatientsTable(casos, true));
  root.appendChild(overviewCard);

  const toolsRow = document.createElement("div");
  toolsRow.className = "detail-grid";
  toolsRow.style.marginTop = "18px";

  const drugCard = document.createElement("div");
  drugCard.className = "card";
  const drugHead = document.createElement("div");
  drugHead.className = "card-head";
  const drugTitle = document.createElement("h2");
  drugTitle.textContent = "Tabla de referencia de fármacos";
  drugHead.appendChild(drugTitle);
  drugCard.appendChild(drugHead);
  const drugList = state.formulario.slice().sort((a, b) => (a.nombre || "").localeCompare(b.nombre || "")).slice(0, 5);
  const drugTablePad = document.createElement("div");
  drugTablePad.className = "card-pad";
  drugTablePad.appendChild(buildFormularioTable(drugList, false));
  drugCard.appendChild(drugTablePad);

  const calcCard = document.createElement("div");
  calcCard.className = "card card-pad";
  const calcHead = document.createElement("h2");
  calcHead.textContent = "Calculadora de dosis";
  calcHead.style.margin = "0 0 10px";
  calcHead.style.fontSize = "0.95rem";
  const calcBody = document.createElement("p");
  calcBody.style.color = "var(--muted)";
  calcBody.style.fontSize = "0.85rem";
  calcBody.style.margin = "0 0 14px";
  calcBody.textContent = "Calcula la dosis de un fármaco del formulario por el peso del paciente.";
  const calcOpenBtn = document.createElement("button");
  calcOpenBtn.type = "button";
  calcOpenBtn.className = "btn-primary";
  calcOpenBtn.textContent = "🧮 Abrir calculadora";
  calcOpenBtn.addEventListener("click", () => openCalculatorOverlay());
  calcCard.appendChild(calcHead);
  calcCard.appendChild(calcBody);
  calcCard.appendChild(calcOpenBtn);

  toolsRow.appendChild(drugCard);
  toolsRow.appendChild(calcCard);
  root.appendChild(toolsRow);
}

/* ---------- Pacientes (casos clínicos) ---------- */

async function createCase() {
  try {
    const ref = await addDoc(collection(db, "entries"), {
      uid: currentUid,
      section: "casos",
      title: "",
      meta: "",
      date: todayISO(),
      body: "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    state.page = "patients";
    state.activeId = ref.id;
    render();
  } catch (err) {
    alert("No se pudo crear el caso. Revisa tu conexión e intenta de nuevo.");
  }
}

function evolutionSummary(entry) {
  const evols = Array.isArray(entry.evoluciones) ? entry.evoluciones : [];
  if (evols.length === 0) return { text: "Sin evoluciones", cls: "neutral" };
  const latest = evols.slice().sort((a, b) => (b.date || "").localeCompare(a.date || ""))[0];
  return { text: evols.length + " registro" + (evols.length === 1 ? "" : "s") + " · " + formatDate(latest.date), cls: "ok" };
}

/* Nombre del grupo al que pertenece un caso en la vista agrupada. Las
   especies se guardan en singular ("Canino"); aquí se muestran en plural
   porque titulan un conjunto de pacientes. */
const ESPECIE_PLURAL = {
  Bovino: "Bovinos",
  Equino: "Equinos",
  Porcino: "Porcinos",
  Aves: "Aves",
  Canino: "Caninos",
  Felino: "Felinos",
  Ovino: "Ovinos",
  Caprino: "Caprinos",
  "Exótico": "Exóticos",
  Otro: "Otros"
};
const SIN_ESPECIE = "Sin especificar";

/* Qué grupos de especie están desplegados. Vive fuera de buildPatientsTable
   porque render() reconstruye la tabla entera: si el estado viviera en el
   closure, cualquier redibujado volvería a cerrar todos los grupos. */
const gruposExpandidos = new Set();

function grupoDeEspecie(entry) {
  const especie = (entry.especie || "").trim();
  if (!especie) return SIN_ESPECIE;
  return ESPECIE_PLURAL[especie] || especie;
}

function buildPatientsTable(list, compact, grouped) {
  const wrap = document.createElement("div");
  wrap.className = "table-wrap";

  if (list.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-table";
    empty.textContent = "Aún no hay casos clínicos.";
    wrap.appendChild(empty);
    return wrap;
  }

  const table = document.createElement("table");
  table.className = "data-table";
  const thead = document.createElement("thead");
  const cols = compact
    ? ["Paciente", "Especie", "Área", "Ingreso", "Evoluciones"]
    : ["Paciente", "Especie / Raza", "Fecha de ingreso", "Área", "Tutor", "Evoluciones"];
  thead.innerHTML = "<tr>" + cols.map((c) => "<th>" + c + "</th>").join("") + "</tr>";
  table.appendChild(thead);

  const tbody = document.createElement("tbody");

  if (grouped) {
    // Se agrupa respetando el orden en que aparecen las especies en la lista
    // ya ordenada, de modo que el orden interno de cada grupo sigue siendo el
    // de fecha de ingreso que traía la lista. "Sin especificar" va al final.
    const grupos = new Map();
    list.forEach((entry) => {
      const g = grupoDeEspecie(entry);
      if (!grupos.has(g)) grupos.set(g, []);
      grupos.get(g).push(entry);
    });

    const nombres = Array.from(grupos.keys()).sort((a, b) => {
      if (a === SIN_ESPECIE) return 1;
      if (b === SIN_ESPECIE) return -1;
      return a.localeCompare(b, "es");
    });

    // Si hay una búsqueda o un filtro de especie activo, todos los grupos que
    // sobrevivieron al filtro se abren solos: colapsarlos escondería
    // justamente lo que el usuario está buscando.
    const abrirTodo = !!state.query || !!state.especieFilter;

    nombres.forEach((nombre) => {
      const filas = grupos.get(nombre);
      const expandido = abrirTodo || gruposExpandidos.has(nombre);

      const headTr = document.createElement("tr");
      headTr.className = "group-row";
      const headTd = document.createElement("td");
      headTd.colSpan = cols.length;
      headTd.setAttribute("role", "button");
      headTd.tabIndex = 0;
      headTd.setAttribute("aria-expanded", expandido ? "true" : "false");
      headTd.innerHTML =
        '<span class="group-caret"></span><span class="group-name"></span>' +
        '<span class="group-sep">·</span><span class="group-count"></span>';
      headTd.querySelector(".group-caret").textContent = expandido ? "▾" : "▸";
      headTd.querySelector(".group-name").textContent = nombre;
      headTd.querySelector(".group-count").textContent =
        filas.length + (filas.length === 1 ? " paciente" : " pacientes");
      headTr.appendChild(headTd);
      tbody.appendChild(headTr);

      const filasTr = filas.map((entry) => {
        const tr = buildPatientRow(entry, compact);
        tr.hidden = !expandido;
        tbody.appendChild(tr);
        return tr;
      });

      function alternar() {
        // Con búsqueda/filtro activo los grupos están abiertos a la fuerza;
        // igual se permite cerrarlos manualmente, así que el estado se guarda
        // siempre en el mismo sitio.
        const abiertoAhora = headTd.getAttribute("aria-expanded") === "true";
        const nuevo = !abiertoAhora;
        if (nuevo) gruposExpandidos.add(nombre);
        else gruposExpandidos.delete(nombre);
        headTd.setAttribute("aria-expanded", nuevo ? "true" : "false");
        headTd.querySelector(".group-caret").textContent = nuevo ? "▾" : "▸";
        filasTr.forEach((tr) => {
          tr.hidden = !nuevo;
        });
      }

      headTr.addEventListener("click", alternar);
      headTd.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          alternar();
        }
      });
    });

    table.appendChild(tbody);
    wrap.appendChild(table);
    return wrap;
  }

  list.forEach((entry) => tbody.appendChild(buildPatientRow(entry, compact)));
  table.appendChild(tbody);
  wrap.appendChild(table);
  return wrap;
}

function buildPatientRow(entry, compact) {
  {
    const tr = document.createElement("tr");
    tr.addEventListener("click", () => {
      state.page = "patients";
      state.activeId = entry.id;
      render();
    });

    const nameTd = document.createElement("td");
    const nameStrong = document.createElement("div");
    nameStrong.className = "cell-title";
    nameStrong.textContent = entry.meta || "(sin nombre)";
    nameTd.appendChild(nameStrong);
    // Bajo el nombre del paciente va el tutor, no el motivo de consulta:
    // en la lista sirve mas para identificar de quien es el animal. Si no
    // hay tutor cargado, no se dibuja la linea (mejor vacio que un guion).
    const tutor = (entry.tutorNombre || "").trim();
    if (tutor) {
      const sub = document.createElement("div");
      sub.className = "cell-muted";
      sub.style.fontSize = "0.78rem";
      sub.textContent = tutor;
      nameTd.appendChild(sub);
    }
    tr.appendChild(nameTd);

    const speciesTd = document.createElement("td");
    speciesTd.className = "cell-muted";
    speciesTd.textContent = [entry.especie, entry.raza].filter(Boolean).join(" · ") || "—";
    tr.appendChild(speciesTd);

    if (!compact) {
      const dateTd = document.createElement("td");
      dateTd.className = "cell-muted";
      dateTd.textContent = formatDate(entry.date);
      tr.appendChild(dateTd);
    }

    const areaTd = document.createElement("td");
    areaTd.textContent = entry.area || "—";
    tr.appendChild(areaTd);

    if (compact) {
      const dateTd = document.createElement("td");
      dateTd.className = "cell-muted";
      dateTd.textContent = formatDate(entry.date);
      tr.appendChild(dateTd);
    } else {
      const ownerTd = document.createElement("td");
      ownerTd.className = "cell-muted";
      ownerTd.textContent = [entry.tutorNombre, entry.tutorTelefono].filter(Boolean).join(" · ") || "—";
      tr.appendChild(ownerTd);
    }

    const evoTd = document.createElement("td");
    const summary = evolutionSummary(entry);
    const badge = document.createElement("span");
    badge.className = "badge " + summary.cls;
    badge.textContent = summary.text;
    evoTd.appendChild(badge);
    tr.appendChild(evoTd);

    return tr;
  }
}

function renderPatientsPage(root) {
  const active = state.activeId ? state.entries.find((e) => e.id === state.activeId && e.section === "casos") : null;
  if (active) {
    renderPatientDetail(root, active);
    return;
  }

  const head = pageHead("Pacientes", "Casos clínicos registrados.");
  const newBtn = document.createElement("button");
  newBtn.type = "button";
  newBtn.className = "btn-primary";
  newBtn.textContent = "+ Nuevo caso";
  newBtn.addEventListener("click", () => createCase());
  head.appendChild(newBtn);
  root.appendChild(head);

  const filterRow = document.createElement("div");
  filterRow.style.display = "flex";
  filterRow.style.gap = "10px";
  filterRow.style.marginBottom = "14px";
  const areaSelect = document.createElement("select");
  areaSelect.className = "btn-secondary";
  const blankOpt = document.createElement("option");
  blankOpt.value = "";
  blankOpt.textContent = "Todas las áreas";
  areaSelect.appendChild(blankOpt);
  AREA_OPTIONS.forEach((opt) => {
    const o = document.createElement("option");
    o.value = opt;
    o.textContent = opt;
    areaSelect.appendChild(o);
  });
  areaSelect.value = state.areaFilter;
  areaSelect.addEventListener("change", () => {
    state.areaFilter = areaSelect.value;
    render();
  });
  filterRow.appendChild(areaSelect);

  const especieSelect = document.createElement("select");
  especieSelect.className = "btn-secondary";
  const blankEspOpt = document.createElement("option");
  blankEspOpt.value = "";
  blankEspOpt.textContent = "Todas las especies";
  especieSelect.appendChild(blankEspOpt);
  SPECIES_OPTIONS.forEach((opt) => {
    const o = document.createElement("option");
    o.value = opt;
    o.textContent = opt;
    especieSelect.appendChild(o);
  });
  // Opción extra para aislar los casos a los que todavía no se les cargó
  // especie, que en la vista agrupada forman su propio grupo.
  const sinEspOpt = document.createElement("option");
  sinEspOpt.value = "__sin__";
  sinEspOpt.textContent = SIN_ESPECIE;
  especieSelect.appendChild(sinEspOpt);
  especieSelect.value = state.especieFilter;
  especieSelect.addEventListener("change", () => {
    state.especieFilter = especieSelect.value;
    render();
  });
  filterRow.appendChild(especieSelect);
  root.appendChild(filterRow);

  const list = entriesForSection("casos")
    .filter((e) => matchesQuery(e, state.query))
    .filter((e) => !state.areaFilter || e.area === state.areaFilter)
    .filter((e) => {
      if (!state.especieFilter) return true;
      if (state.especieFilter === "__sin__") return !(e.especie || "").trim();
      return e.especie === state.especieFilter;
    })
    .sort((a, b) => (b._sortKey || 0) - (a._sortKey || 0));

  const card = document.createElement("div");
  card.className = "card";
  card.appendChild(buildPatientsTable(list, false, true));
  root.appendChild(card);
}

/* ================= Exportar un caso a PDF =================
   Usa la impresión nativa del navegador (window.print → "Guardar como PDF"),
   sin librerías extra. En vez de intentar imprimir la ficha de edición, se
   arma un bloque aparte con el caso en texto plano y @media print muestra
   solo ese bloque. El motivo es concreto: la ficha está hecha de <input> y
   <textarea>, y un textarea al imprimirse NO crece hasta su contenido —
   recorta el texto a la altura de la caja, así que las notas clínicas y las
   evoluciones largas saldrían cortadas. */
function campoImpreso(etiqueta, valor) {
  const fila = document.createElement("div");
  fila.className = "print-field";
  const l = document.createElement("span");
  l.className = "print-label";
  l.textContent = etiqueta;
  const v = document.createElement("span");
  v.className = "print-value";
  v.textContent = valor && String(valor).trim() ? valor : "—";
  fila.appendChild(l);
  fila.appendChild(v);
  return fila;
}

function bloqueImpreso(titulo) {
  const sec = document.createElement("section");
  sec.className = "print-block";
  const h = document.createElement("h2");
  h.textContent = titulo;
  sec.appendChild(h);
  return sec;
}

function buildPrintableCase(entry) {
  const caso = currentEntry(entry);
  const root = document.createElement("div");
  root.id = "printArea";

  // Encabezado: nombre y título del perfil si están cargados.
  const head = document.createElement("header");
  head.className = "print-head";
  const h1 = document.createElement("h1");
  h1.textContent = caso.meta || "(paciente sin nombre)";
  head.appendChild(h1);
  const firma = [];
  if (state.profile && state.profile.nombre) firma.push(state.profile.nombre);
  if (state.profile && state.profile.titulo) firma.push(state.profile.titulo);
  const meta = document.createElement("p");
  meta.className = "print-head-meta";
  meta.textContent =
    (firma.length ? firma.join(" · ") + " — " : "") + "Emitido el " + formatDate(todayISO());
  head.appendChild(meta);
  root.appendChild(head);

  const datos = bloqueImpreso("Datos del paciente");
  datos.appendChild(campoImpreso("Especie / Raza", [caso.especie, caso.raza].filter(Boolean).join(" · ")));
  datos.appendChild(campoImpreso("Edad", caso.edad));
  datos.appendChild(campoImpreso("Peso", caso.peso));
  datos.appendChild(campoImpreso("Fecha de ingreso", formatDate(caso.date)));
  datos.appendChild(campoImpreso("Área", caso.area));
  root.appendChild(datos);

  const tutor = bloqueImpreso("Datos del tutor");
  tutor.appendChild(campoImpreso("Nombres y apellidos", caso.tutorNombre));
  tutor.appendChild(campoImpreso("Teléfono", caso.tutorTelefono));
  tutor.appendChild(campoImpreso("Correo electrónico", caso.tutorCorreo));
  root.appendChild(tutor);

  const consulta = bloqueImpreso("Motivo de consulta");
  const motivo = document.createElement("p");
  motivo.className = "print-text";
  motivo.textContent = caso.title && caso.title.trim() ? caso.title : "—";
  consulta.appendChild(motivo);
  root.appendChild(consulta);

  if (caso.body && caso.body.trim()) {
    const notas = bloqueImpreso("Anamnesis, examen físico, diagnóstico, tratamiento");
    const p = document.createElement("p");
    p.className = "print-text";
    p.textContent = caso.body;
    notas.appendChild(p);
    root.appendChild(notas);
  }

  const meds = (Array.isArray(caso.farmacos) ? caso.farmacos : []).filter((m) => m && m.nombre);
  if (meds.length) {
    const sec = bloqueImpreso("Fármacos");
    const tabla = document.createElement("table");
    tabla.className = "print-table";
    tabla.innerHTML =
      "<thead><tr><th>Fármaco</th><th>Concentración</th><th>Dosis</th><th>Dosis administrada</th><th>Frecuencia</th></tr></thead>";
    const tb = document.createElement("tbody");
    meds.forEach((m) => {
      const tr = document.createElement("tr");
      [m.nombre, m.concentracion, m.dosis, m.dosisAdministrada, m.frecuencia].forEach((v) => {
        const td = document.createElement("td");
        td.textContent = v && String(v).trim() ? v : "—";
        tr.appendChild(td);
      });
      tb.appendChild(tr);
    });
    tabla.appendChild(tb);
    sec.appendChild(tabla);
    root.appendChild(sec);
  }

  const evols = (Array.isArray(caso.evoluciones) ? caso.evoluciones : []).filter((e) => e && (e.texto || e.date));
  if (evols.length) {
    const sec = bloqueImpreso("Evoluciones");
    evols
      .slice()
      .sort((a, b) => (a.date || "").localeCompare(b.date || ""))
      .forEach((e) => {
        const item = document.createElement("div");
        item.className = "print-evol";
        const fecha = document.createElement("div");
        fecha.className = "print-evol-date";
        fecha.textContent = formatDate(e.date);
        const texto = document.createElement("p");
        texto.className = "print-text";
        texto.textContent = e.texto || "—";
        item.appendChild(fecha);
        item.appendChild(texto);
        sec.appendChild(item);
      });
    root.appendChild(sec);
  }

  return root;
}

function imprimirCaso(entry) {
  const previo = document.getElementById("printArea");
  if (previo) previo.remove();

  const area = buildPrintableCase(entry);
  document.body.appendChild(area);

  function limpiar() {
    const el = document.getElementById("printArea");
    if (el) el.remove();
    window.removeEventListener("afterprint", limpiar);
  }
  window.addEventListener("afterprint", limpiar);

  window.print();
  // Respaldo: algunos navegadores no disparan afterprint de forma fiable.
  setTimeout(limpiar, 3000);
}

function renderPatientDetail(root, entry) {
  mountedDetailId = entry.id;
  root.appendChild(
    backLink("Pacientes", () => {
      state.activeId = null;
      render();
    })
  );

  const status = document.createElement("div");
  status.className = "status";
  status.setAttribute("data-state", "ok");
  status.innerHTML = '<span class="dot"></span><span class="statusText">Sincronizado</span>';
  const statusText = status.querySelector(".statusText");

  function save(field, value) {
    scheduleSave("entries", entry.id, { [field]: value }, statusText);
  }

  const head = document.createElement("div");
  head.className = "patient-head";

  const avatar = document.createElement("div");
  avatar.className = "patient-avatar";
  avatar.textContent = (entry.meta || "?").trim().charAt(0).toUpperCase() || "?";

  const info = document.createElement("div");
  info.className = "patient-head-info";
  const nameRow = document.createElement("div");
  nameRow.className = "name-row";
  const nameInput = document.createElement("input");
  nameInput.className = "field-title";
  nameInput.placeholder = "Nombre del paciente";
  nameInput.value = entry.meta || "";
  nameInput.addEventListener("input", () => {
    avatar.textContent = (nameInput.value || "?").trim().charAt(0).toUpperCase() || "?";
    save("meta", nameInput.value);
  });
  const tag = document.createElement("span");
  tag.className = "section-tag casos";
  tag.textContent = "Caso clínico";
  nameRow.appendChild(nameInput);
  nameRow.appendChild(tag);

  const sub = document.createElement("div");
  sub.className = "sub";
  // Se arma desde los inputs vivos, no desde el objeto entry, que ya no se
  // refresca mientras la ficha está abierta.
  function refreshSub() {
    sub.textContent =
      [speciesSelect.value, razaInput.value, pesoInput.value].filter(Boolean).join(" · ") ||
      "Especie, raza y peso sin especificar";
  }
  sub.textContent = [entry.especie, entry.raza, entry.peso].filter(Boolean).join(" · ") || "Especie, raza y peso sin especificar";

  info.appendChild(nameRow);
  info.appendChild(sub);

  const actions = document.createElement("div");
  actions.className = "patient-head-actions";
  const calcBtn = document.createElement("button");
  calcBtn.type = "button";
  calcBtn.className = "btn-secondary";
  calcBtn.textContent = "🧮 Calcular dosis";
  calcBtn.addEventListener("click", () => openCalculatorOverlay({ caseEntry: entry }));
  const pdfBtn = document.createElement("button");
  pdfBtn.type = "button";
  pdfBtn.className = "btn-secondary";
  pdfBtn.textContent = "📄 Descargar PDF";
  pdfBtn.addEventListener("click", () => imprimirCaso(entry));
  actions.appendChild(calcBtn);
  actions.appendChild(pdfBtn);

  head.appendChild(avatar);
  head.appendChild(info);
  head.appendChild(actions);
  root.appendChild(head);

  const titleGroup = document.createElement("div");
  titleGroup.className = "field-group";
  titleGroup.style.marginBottom = "16px";
  const titleLabel = document.createElement("label");
  titleLabel.textContent = "Motivo de consulta";
  const titleInput = document.createElement("input");
  titleInput.placeholder = "Ej. Fractura de fémur";
  titleInput.value = entry.title || "";
  titleInput.addEventListener("input", () => save("title", titleInput.value));
  titleGroup.appendChild(titleLabel);
  titleGroup.appendChild(titleInput);
  root.appendChild(titleGroup);

  const grid = document.createElement("div");
  grid.className = "detail-grid";

  /* --- columna izquierda: datos clínicos base --- */
  const leftCol = document.createElement("div");
  leftCol.className = "detail-col";

  const baseCard = document.createElement("div");
  baseCard.className = "card card-pad";

  const row1 = document.createElement("div");
  row1.className = "field-row";

  const areaGroup = document.createElement("div");
  areaGroup.className = "field-group";
  const areaLabel = document.createElement("label");
  areaLabel.textContent = "Área";
  const areaSelect = document.createElement("select");
  const blankAreaOpt = document.createElement("option");
  blankAreaOpt.value = "";
  blankAreaOpt.textContent = "— Sin especificar —";
  areaSelect.appendChild(blankAreaOpt);
  AREA_OPTIONS.forEach((opt) => {
    const o = document.createElement("option");
    o.value = opt;
    o.textContent = opt;
    areaSelect.appendChild(o);
  });
  areaSelect.value = entry.area || "";
  areaSelect.addEventListener("change", () => save("area", areaSelect.value));
  areaGroup.appendChild(areaLabel);
  areaGroup.appendChild(areaSelect);

  const speciesGroup = document.createElement("div");
  speciesGroup.className = "field-group";
  const speciesLabel = document.createElement("label");
  speciesLabel.textContent = "Especie";
  const speciesSelect = document.createElement("select");
  const blankSpOpt = document.createElement("option");
  blankSpOpt.value = "";
  blankSpOpt.textContent = "— Sin especificar —";
  speciesSelect.appendChild(blankSpOpt);
  SPECIES_OPTIONS.forEach((opt) => {
    const o = document.createElement("option");
    o.value = opt;
    o.textContent = opt;
    speciesSelect.appendChild(o);
  });
  speciesSelect.value = entry.especie || "";
  speciesSelect.addEventListener("change", () => {
    save("especie", speciesSelect.value);
    refreshSub();
  });
  speciesGroup.appendChild(speciesLabel);
  speciesGroup.appendChild(speciesSelect);

  row1.appendChild(areaGroup);
  row1.appendChild(speciesGroup);

  const row2 = document.createElement("div");
  row2.className = "field-row";
  const dateGroup = document.createElement("div");
  dateGroup.className = "field-group";
  const dateLabel = document.createElement("label");
  dateLabel.textContent = "Fecha de ingreso";
  const dateInput = document.createElement("input");
  dateInput.type = "date";
  dateInput.value = entry.date || todayISO();
  dateInput.addEventListener("input", () => save("date", dateInput.value));
  dateGroup.appendChild(dateLabel);
  dateGroup.appendChild(dateInput);
  row2.appendChild(dateGroup);

  const row3 = document.createElement("div");
  row3.className = "field-row";
  const razaGroup = document.createElement("div");
  razaGroup.className = "field-group";
  const razaLabel = document.createElement("label");
  razaLabel.textContent = "Raza";
  const razaInput = document.createElement("input");
  razaInput.placeholder = "Ej. Golden Retriever";
  razaInput.value = entry.raza || "";
  razaInput.addEventListener("input", () => {
    save("raza", razaInput.value);
    refreshSub();
  });
  razaGroup.appendChild(razaLabel);
  razaGroup.appendChild(razaInput);

  const edadGroup = document.createElement("div");
  edadGroup.className = "field-group";
  const edadLabel = document.createElement("label");
  edadLabel.textContent = "Edad";
  const edadInput = document.createElement("input");
  edadInput.placeholder = "Ej. 4 años";
  edadInput.value = entry.edad || "";
  edadInput.addEventListener("input", () => save("edad", edadInput.value));
  edadGroup.appendChild(edadLabel);
  edadGroup.appendChild(edadInput);

  const pesoGroup = document.createElement("div");
  pesoGroup.className = "field-group";
  const pesoLabel = document.createElement("label");
  pesoLabel.textContent = "Peso";
  const pesoInput = document.createElement("input");
  pesoInput.placeholder = "Ej. 25 kg";
  pesoInput.value = entry.peso || "";
  pesoInput.addEventListener("input", () => {
    save("peso", pesoInput.value);
    refreshSub();
  });
  pesoGroup.appendChild(pesoLabel);
  pesoGroup.appendChild(pesoInput);

  row3.appendChild(razaGroup);
  row3.appendChild(edadGroup);
  row3.appendChild(pesoGroup);

  baseCard.appendChild(row1);
  baseCard.appendChild(row2);
  baseCard.appendChild(row3);
  leftCol.appendChild(baseCard);

  /* --- tutor: solo nombres, teléfono y correo. Sin cédula ni ningún
     otro identificador nacional — decisión explícita, no agregar sin
     preguntar primero. --- */
  const tutorCard = document.createElement("div");
  tutorCard.className = "card card-pad";
  const tutorLabel = document.createElement("label");
  tutorLabel.className = "checkbox-group-label";
  tutorLabel.style.margin = "0 0 8px";
  tutorLabel.textContent = "Datos del tutor";
  const tutorRow = document.createElement("div");
  tutorRow.className = "tutor-row";

  const tutorNombreGroup = document.createElement("div");
  tutorNombreGroup.className = "field-group";
  const tutorNombreLabel = document.createElement("label");
  tutorNombreLabel.textContent = "Nombres y apellidos";
  const tutorNombreInput = document.createElement("input");
  tutorNombreInput.placeholder = "Ej. María Pérez";
  tutorNombreInput.value = entry.tutorNombre || "";
  tutorNombreInput.addEventListener("input", () => save("tutorNombre", tutorNombreInput.value));
  tutorNombreGroup.appendChild(tutorNombreLabel);
  tutorNombreGroup.appendChild(tutorNombreInput);

  const tutorTelefonoGroup = document.createElement("div");
  tutorTelefonoGroup.className = "field-group";
  const tutorTelefonoLabel = document.createElement("label");
  tutorTelefonoLabel.textContent = "Teléfono";
  const tutorTelefonoInput = document.createElement("input");
  tutorTelefonoInput.type = "tel";
  tutorTelefonoInput.placeholder = "Ej. 099 999 9999";
  tutorTelefonoInput.value = entry.tutorTelefono || "";
  tutorTelefonoInput.addEventListener("input", () => save("tutorTelefono", tutorTelefonoInput.value));
  tutorTelefonoGroup.appendChild(tutorTelefonoLabel);
  tutorTelefonoGroup.appendChild(tutorTelefonoInput);

  tutorRow.appendChild(tutorNombreGroup);
  tutorRow.appendChild(tutorTelefonoGroup);

  const tutorRow2 = document.createElement("div");
  tutorRow2.className = "tutor-row";
  const tutorCorreoGroup = document.createElement("div");
  tutorCorreoGroup.className = "field-group";
  const tutorCorreoLabel = document.createElement("label");
  tutorCorreoLabel.textContent = "Correo electrónico";
  const tutorCorreoInput = document.createElement("input");
  tutorCorreoInput.type = "email";
  tutorCorreoInput.placeholder = "Ej. correo@ejemplo.com";
  tutorCorreoInput.value = entry.tutorCorreo || "";
  tutorCorreoInput.addEventListener("input", () => save("tutorCorreo", tutorCorreoInput.value));
  tutorCorreoGroup.appendChild(tutorCorreoLabel);
  tutorCorreoGroup.appendChild(tutorCorreoInput);
  tutorRow2.appendChild(tutorCorreoGroup);

  tutorCard.appendChild(tutorLabel);
  tutorCard.appendChild(tutorRow);
  tutorCard.appendChild(tutorRow2);
  leftCol.appendChild(tutorCard);

  const photosCard = document.createElement("div");
  photosCard.className = "card card-pad";
  photosCard.appendChild(buildPhotosSection(entry, statusText));
  leftCol.appendChild(photosCard);

  const medsCard = document.createElement("div");
  medsCard.className = "card card-pad";
  medsCard.appendChild(buildMedsSection(entry, statusText));
  leftCol.appendChild(medsCard);

  /* --- columna derecha: notas clínicas + evoluciones --- */
  const rightCol = document.createElement("div");
  rightCol.className = "detail-col";

  const notesCard = document.createElement("div");
  notesCard.className = "card card-pad";
  const notesLabel = document.createElement("label");
  notesLabel.className = "checkbox-group-label";
  notesLabel.style.margin = "0 0 8px";
  notesLabel.textContent = "Anamnesis, examen físico, diagnóstico, tratamiento";

  const bodyToolbar = document.createElement("div");
  bodyToolbar.className = "body-toolbar";
  const voiceBtn = document.createElement("button");
  voiceBtn.type = "button";
  voiceBtn.className = "voice-btn";
  voiceBtn.setAttribute("data-listening", "false");
  voiceBtn.innerHTML = '<span class="rec-dot"></span><span class="label">🎤 Dictar por voz</span>';
  bodyToolbar.appendChild(voiceBtn);

  const body = document.createElement("textarea");
  body.className = "field-body";
  body.placeholder = "Anamnesis, examen físico, diagnóstico, tratamiento…";
  body.value = entry.body || "";
  body.addEventListener("input", () => save("body", body.value));
  attachVoiceInput(voiceBtn, body);

  notesCard.appendChild(notesLabel);
  notesCard.appendChild(bodyToolbar);
  notesCard.appendChild(body);
  rightCol.appendChild(notesCard);

  const evolCard = document.createElement("div");
  evolCard.className = "card card-pad";
  evolCard.appendChild(buildEvolucionesSection(entry, statusText));
  rightCol.appendChild(evolCard);

  grid.appendChild(leftCol);
  grid.appendChild(rightCol);
  root.appendChild(grid);

  const foot = document.createElement("div");
  foot.className = "editor-foot";
  const del = document.createElement("button");
  del.className = "btn-delete";
  del.type = "button";
  del.textContent = "Eliminar caso";
  del.addEventListener("click", async () => {
    const ok = await askConfirm({
      title: "¿Eliminar este caso clínico?",
      message: "Se borrará el caso de " + (entry.meta || "este paciente") + " con sus fármacos, fotos y evoluciones. No se puede deshacer.",
      confirmLabel: "Eliminar caso"
    });
    if (!ok) return;
    state.activeId = null;
    render();
    try {
      await deleteDoc(doc(db, "entries", entry.id));
    } catch (err) {
      alert("No se pudo eliminar (sin conexión). Se reintentará cuando vuelvas a estar en línea.");
    }
  });
  foot.appendChild(status);
  foot.appendChild(del);
  root.appendChild(foot);

  if (!entry.meta) {
    setTimeout(() => nameInput.focus(), 0);
  }
}

/* ---------- Fármacos (historial derivado) ---------- */

function renderFarmacosPage(root) {
  const list = getMedUsageList();
  const active = state.activeId ? list.find((m) => m.id === state.activeId) : null;
  if (active) {
    renderFarmacoDetail(root, active);
    return;
  }

  root.appendChild(pageHead("Fármacos", "Historial de fármacos usados en tus casos clínicos."));

  const filtered = list.filter((m) => matchesMedQuery(m, state.query)).sort((a, b) => (b._sortKey || 0) - (a._sortKey || 0));

  const wrap = document.createElement("div");
  wrap.className = "table-wrap";
  if (filtered.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-table";
    empty.textContent = "Aún no hay fármacos registrados. Se llenan automáticamente al agregarlos en un caso clínico.";
    wrap.appendChild(empty);
  } else {
    const table = document.createElement("table");
    table.className = "data-table";
    table.innerHTML = "<thead><tr><th>Fármaco</th><th>Paciente</th><th>Dosis</th><th>Concentración</th><th>Frecuencia</th><th>Fecha</th></tr></thead>";
    const tbody = document.createElement("tbody");
    filtered.forEach((item) => {
      const tr = document.createElement("tr");
      tr.addEventListener("click", () => {
        state.activeId = item.id;
        render();
      });
      tr.innerHTML =
        '<td class="cell-title">' + escapeHtml(item.nombre) + "</td>" +
        '<td class="cell-muted">' + escapeHtml(item.paciente || item.caseTitle || "(sin título)") + "</td>" +
        '<td>' + escapeHtml(item.dosis || "—") + "</td>" +
        '<td class="cell-muted">' + escapeHtml(item.concentracion || "—") + "</td>" +
        '<td class="cell-muted">' + escapeHtml(item.frecuencia || "—") + "</td>" +
        '<td class="cell-muted">' + formatDate(item.date) + "</td>";
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
  }

  const card = document.createElement("div");
  card.className = "card";
  card.appendChild(wrap);
  root.appendChild(card);
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

function renderFarmacoDetail(root, item) {
  root.appendChild(
    backLink("Fármacos", () => {
      state.activeId = null;
      render();
    })
  );

  const tag = document.createElement("span");
  tag.className = "section-tag farmacos";
  tag.textContent = "Fármaco";

  const title = document.createElement("h1");
  title.style.margin = "10px 0 16px";
  title.textContent = item.nombre;

  const fields = [
    ["Concentración", item.concentracion],
    ["Dosis", item.dosis],
    ["Dosis administrada", item.dosisAdministrada],
    ["Frecuencia", item.frecuencia],
    ["Fecha", formatDate(item.date)],
    ["Especie", item.especie],
    ["Paciente", item.paciente]
  ];

  const card = document.createElement("div");
  card.className = "card card-pad";
  const fieldRow = document.createElement("div");
  fieldRow.className = "field-row";
  fields.forEach(([labelText, value]) => {
    if (!value) return;
    const group = document.createElement("div");
    group.className = "field-group";
    const lbl = document.createElement("label");
    lbl.textContent = labelText;
    const val = document.createElement("div");
    val.className = "field-static";
    val.textContent = value;
    group.appendChild(lbl);
    group.appendChild(val);
    fieldRow.appendChild(group);
  });
  card.appendChild(fieldRow);

  const goBtn = document.createElement("button");
  goBtn.type = "button";
  goBtn.className = "btn-secondary";
  goBtn.style.marginTop = "16px";
  goBtn.textContent = "Ver caso clínico: " + (item.caseTitle || item.paciente || "(sin título)") + " →";
  goBtn.addEventListener("click", () => {
    state.page = "patients";
    state.activeId = item.entryId;
    render();
  });
  card.appendChild(goBtn);

  root.appendChild(tag);
  root.appendChild(title);
  root.appendChild(card);
}

/* ---------- Estudio (Materias + Formulario) ---------- */

function renderStudyPage(root) {
  const active = state.activeId
    ? state.studyTab === "materias"
      ? entriesForSection("materias").find((e) => e.id === state.activeId)
      : state.formulario.find((f) => f.id === state.activeId)
    : null;

  if (active) {
    if (state.studyTab === "materias") renderMateriaDetail(root, active);
    else renderFormularioDetail(root, active);
    return;
  }

  root.appendChild(pageHead("Centro de estudio", "Material de referencia y datos farmacológicos."));

  const subtabs = document.createElement("div");
  subtabs.className = "subtabs";
  const tabMaterias = document.createElement("button");
  tabMaterias.type = "button";
  tabMaterias.className = "subtab";
  tabMaterias.textContent = "Biblioteca de Materias";
  tabMaterias.setAttribute("aria-selected", state.studyTab === "materias" ? "true" : "false");
  tabMaterias.addEventListener("click", () => {
    state.studyTab = "materias";
    state.query = "";
    if (els.search) els.search.value = "";
    render();
  });
  const tabFormulario = document.createElement("button");
  tabFormulario.type = "button";
  tabFormulario.className = "subtab";
  tabFormulario.textContent = "Formulario de Fármacos";
  tabFormulario.setAttribute("aria-selected", state.studyTab === "formulario" ? "true" : "false");
  tabFormulario.addEventListener("click", () => {
    state.studyTab = "formulario";
    state.query = "";
    if (els.search) els.search.value = "";
    render();
  });
  subtabs.appendChild(tabMaterias);
  subtabs.appendChild(tabFormulario);
  root.appendChild(subtabs);

  if (state.studyTab === "materias") renderMateriasTab(root);
  else renderFormularioTab(root);
}

async function createMateria() {
  try {
    const ref = await addDoc(collection(db, "entries"), {
      uid: currentUid,
      section: "materias",
      title: "",
      meta: "",
      date: todayISO(),
      body: "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    state.studyTab = "materias";
    state.activeId = ref.id;
    render();
  } catch (err) {
    alert("No se pudo crear la materia. Revisa tu conexión e intenta de nuevo.");
  }
}

function renderMateriasTab(root) {
  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "btn-primary";
  addBtn.textContent = "+ Nueva materia";
  addBtn.style.marginBottom = "14px";
  addBtn.addEventListener("click", () => createMateria());
  root.appendChild(addBtn);

  const list = entriesForSection("materias")
    .filter((e) => matchesQuery(e, state.query))
    .sort((a, b) => (b._sortKey || 0) - (a._sortKey || 0));

  if (list.length === 0) {
    root.appendChild(emptyState("§", "Aún no hay apuntes de materias", "Crea una entrada para empezar a registrar tus clases."));
    return;
  }

  const grid = document.createElement("div");
  grid.className = "subject-grid";
  list.forEach((entry) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "subject-card";
    const ico = document.createElement("div");
    ico.className = "ico";
    ico.textContent = "📘";
    const h3 = document.createElement("h3");
    h3.textContent = entry.title || "(sin título)";
    const p = document.createElement("p");
    p.textContent = (entry.body || "Sin contenido todavía.").slice(0, 90);
    const link = document.createElement("span");
    link.className = "link";
    link.textContent = "ABRIR →";
    card.appendChild(ico);
    card.appendChild(h3);
    card.appendChild(p);
    card.appendChild(link);
    card.addEventListener("click", () => {
      state.activeId = entry.id;
      render();
    });
    grid.appendChild(card);
  });
  root.appendChild(grid);
}

function renderMateriaDetail(root, entry) {
  mountedDetailId = entry.id;
  root.appendChild(
    backLink("Centro de estudio", () => {
      state.activeId = null;
      render();
    })
  );

  const status = document.createElement("div");
  status.className = "status";
  status.setAttribute("data-state", "ok");
  status.innerHTML = '<span class="dot"></span><span class="statusText">Sincronizado</span>';
  const statusText = status.querySelector(".statusText");

  const tag = document.createElement("span");
  tag.className = "section-tag materias";
  tag.textContent = "Materia";
  tag.style.marginBottom = "10px";
  tag.style.display = "inline-flex";

  const titleInput = document.createElement("input");
  titleInput.className = "field-title";
  titleInput.placeholder = "Título del apunte";
  titleInput.value = entry.title || "";
  titleInput.style.margin = "10px 0 16px";
  titleInput.addEventListener("input", () => scheduleSave("entries", entry.id, { title: titleInput.value }, statusText));

  const card = document.createElement("div");
  card.className = "card card-pad";
  const body = document.createElement("textarea");
  body.className = "field-body";
  body.style.minHeight = "50vh";
  body.placeholder = "Escribe tus apuntes de clase…";
  body.value = entry.body || "";
  body.addEventListener("input", () => scheduleSave("entries", entry.id, { body: body.value }, statusText));
  card.appendChild(body);

  const foot = document.createElement("div");
  foot.className = "editor-foot";
  const del = document.createElement("button");
  del.className = "btn-delete";
  del.type = "button";
  del.textContent = "Eliminar entrada";
  del.addEventListener("click", async () => {
    const ok = await askConfirm({
      title: "¿Eliminar esta entrada?",
      message: "Se borrará “" + (entry.title || "esta entrada") + "” con todos sus apuntes. No se puede deshacer.",
      confirmLabel: "Eliminar"
    });
    if (!ok) return;
    state.activeId = null;
    render();
    try {
      await deleteDoc(doc(db, "entries", entry.id));
    } catch (err) {
      alert("No se pudo eliminar (sin conexión). Se reintentará cuando vuelvas a estar en línea.");
    }
  });
  foot.appendChild(status);
  foot.appendChild(del);

  root.appendChild(tag);
  root.appendChild(titleInput);
  root.appendChild(card);
  root.appendChild(foot);

  if (!entry.title) setTimeout(() => titleInput.focus(), 0);
}

/* ================= FORMULARIO: esquema enriquecido =================

   La coleccion "formulario" nacio con un esquema plano (nombre, dosisValor,
   dosisUnidad, via, frecuencia, concentracionValor…), que solo admitia UNA
   dosis por farmaco y ninguna trazabilidad. El esquema nuevo guarda arrays:
   varias presentaciones, varias dosis por especie e indicacion, tiempos de
   retiro, contraindicaciones y alertas.

   La pieza central es farmacoNormalizado(): TODA lectura pasa por ahi y
   devuelve siempre la forma enriquecida, venga el documento del esquema
   viejo o del nuevo. Por eso la app funciona igual antes y despues de
   migrar, y por eso la migracion se puede revertir sin romper nada: no hay
   ninguna pantalla que dependa de que la migracion se haya ejecutado. */

const ESPECIES_FORMULARIO = ["canino", "felino", "bovino", "porcino", "equino", "ovino"];
const VIAS_FORMULARIO = ["IV", "IM", "SC", "VO", "IU", "tópica"];
const MESES_VIGENCIA_FORMULARIO = 24;

// "c/12h" -> 12. El esquema viejo guardaba la frecuencia como texto libre.
function horasDesdeTexto(texto) {
  const m = /(\d+(?:[.,]\d+)?)\s*h/i.exec(String(texto == null ? "" : texto));
  return m ? Number(m[1].replace(",", ".")) : null;
}

function fechaDeVerificacion(valor) {
  if (!valor) return null;
  // Firestore devuelve Timestamp; la semilla y el <input type="date">
  // devuelven texto "AAAA-MM-DD".
  if (typeof valor.toDate === "function") return valor.toDate();
  const d = new Date(valor);
  return isFinite(d.getTime()) ? d : null;
}

function verificacionVencida(valor) {
  const d = fechaDeVerificacion(valor);
  if (!d) return false;
  const limite = new Date(d);
  limite.setMonth(limite.getMonth() + MESES_VIGENCIA_FORMULARIO);
  return new Date() > limite;
}

function fechaCorta(valor) {
  const d = fechaDeVerificacion(valor);
  if (!d) return "";
  return d.toLocaleDateString("es-EC", { year: "numeric", month: "long", day: "numeric" });
}

function paraInputFecha(valor) {
  const d = fechaDeVerificacion(valor);
  if (!d) return "";
  return d.toISOString().slice(0, 10);
}

/* Adaptador de lectura. Un documento del esquema viejo se ve por aqui como
   uno del nuevo, sin escribir nada en Firestore. */
function farmacoNormalizado(f) {
  if (!f) return null;

  const yaEnriquecido = Array.isArray(f.dosis);
  const base = {
    id: f.id,
    uid: f.uid,
    nombreGenerico: f.nombreGenerico || f.nombre || "",
    familia: f.familia || "",
    presentaciones: Array.isArray(f.presentaciones) ? f.presentaciones : [],
    dosis: [],
    retiro: Array.isArray(f.retiro) ? f.retiro : [],
    contraindicaciones: Array.isArray(f.contraindicaciones) ? f.contraindicaciones : [],
    alertas: Array.isArray(f.alertas) ? f.alertas : [],
    verificadoEl: f.verificadoEl || null,
    createdAt: f.createdAt,
    updatedAt: f.updatedAt,
    _pending: f._pending,
    _migrado: yaEnriquecido
  };

  if (yaEnriquecido) {
    base.dosis = f.dosis;
    return base;
  }

  /* Esquema plano -> enriquecido. Las especies viejas venian capitalizadas
     ("Canino") y ademas incluian opciones que el esquema nuevo no lista
     (Aves, Caprino, Exotico…). Se pasan a minusculas pero NO se descartan:
     tirar una especie seria perder un dato que tu cargaste. */
  const especies = (Array.isArray(f.especies) ? f.especies : []).map((e) => String(e).toLowerCase());

  if (f.dosisValor != null && isFinite(f.dosisValor)) {
    const plantilla = {
      indicacion: "",
      dosisMin: Number(f.dosisValor),
      dosisMax: Number(f.dosisValor),
      unidad: f.dosisUnidad || "mg/kg",
      via: f.via || "",
      frecuenciaH: horasDesdeTexto(f.frecuencia),
      duracionMaxDias: null,
      fuente: f.fuente || "",
      esExtralabel: false
    };
    base.dosis = especies.length
      ? especies.map((especie) => ({ especie, ...plantilla }))
      : [{ especie: "", ...plantilla }];
  }

  if (f.concentracionValor != null && isFinite(f.concentracionValor)) {
    base.presentaciones = [
      {
        concentracion: Number(f.concentracionValor),
        unidadConc: f.concentracionUnidad || "mg/mL",
        via: f.via || "",
        nombreComercialLocal: ""
      }
    ];
  }

  return base;
}

function farmacosNormalizados() {
  return state.formulario.map(farmacoNormalizado).filter(Boolean);
}

// Especies presentes en los datos ademas de las seis canonicas, para que el
// filtro no esconda farmacos cargados con el esquema viejo.
function especiesDelFormulario() {
  const vistas = new Set(ESPECIES_FORMULARIO);
  farmacosNormalizados().forEach((f) => {
    f.dosis.forEach((d) => {
      if (d.especie) vistas.add(String(d.especie).toLowerCase());
    });
  });
  return Array.from(vistas);
}

function especiesDe(farmaco) {
  const set = new Set();
  farmaco.dosis.forEach((d) => {
    if (d.especie) set.add(String(d.especie).toLowerCase());
  });
  return Array.from(set);
}

/* Una alerta bloquea el calculo si NOMBRA la especie elegida. Es una
   coincidencia de texto: las alertas son prosa libre, no un campo
   estructurado, asi que no hay forma mas fiable de cruzarlas con la
   especie sin obligarte a llenar un campo mas por cada alerta. */
function alertaQueBloquea(farmaco, especie) {
  if (!especie) return null;
  const e = normalizarBusqueda(especie);
  return (farmaco.alertas || []).find((a) => normalizarBusqueda(a).includes(e)) || null;
}

function retiroEsOrientativo(entrada) {
  return !normalizarBusqueda(entrada && entrada.fuente).includes("agrocalidad");
}

/* ---------- Migracion del esquema plano al enriquecido ----------
   Escribe los campos nuevos y NO borra los viejos. Esa es toda la
   estrategia de reversion: los datos originales siguen ahi intactos, asi
   que revertir es quitar los campos nuevos y ya. */
async function migrarFormulario(opciones) {
  const opts = opciones || {};
  const pendientes = state.formulario.filter((f) => !Array.isArray(f.dosis));
  if (opts.soloSimular) return { total: state.formulario.length, pendientes: pendientes.length };

  let migrados = 0;
  const fallos = [];
  for (const crudo of pendientes) {
    try {
      const n = farmacoNormalizado(crudo);
      await updateDoc(doc(db, "formulario", crudo.id), {
        nombreGenerico: n.nombreGenerico,
        familia: n.familia,
        presentaciones: n.presentaciones,
        dosis: n.dosis,
        retiro: n.retiro,
        contraindicaciones: n.contraindicaciones,
        alertas: n.alertas,
        verificadoEl: n.verificadoEl,
        esquemaFormulario: 2,
        updatedAt: serverTimestamp()
      });
      migrados++;
    } catch (err) {
      console.error("No se pudo migrar " + crudo.id + ":", err);
      fallos.push((crudo.nombre || crudo.id) + ": " + ((err && err.code) || "error"));
    }
  }
  return { total: state.formulario.length, pendientes: pendientes.length, migrados, fallos };
}

/* Deshace la migracion quitando SOLO los campos que ella agrego. Los del
   esquema viejo nunca se tocaron, asi que el documento queda exactamente
   como estaba. */
async function revertirMigracionFormulario() {
  const migrados = state.formulario.filter((f) => Array.isArray(f.dosis));
  let revertidos = 0;
  const fallos = [];
  for (const crudo of migrados) {
    try {
      await updateDoc(doc(db, "formulario", crudo.id), {
        nombreGenerico: deleteField(),
        familia: deleteField(),
        presentaciones: deleteField(),
        dosis: deleteField(),
        retiro: deleteField(),
        contraindicaciones: deleteField(),
        alertas: deleteField(),
        verificadoEl: deleteField(),
        esquemaFormulario: deleteField(),
        updatedAt: serverTimestamp()
      });
      revertidos++;
    } catch (err) {
      console.error("No se pudo revertir " + crudo.id + ":", err);
      fallos.push((crudo.nombreGenerico || crudo.nombre || crudo.id) + ": " + ((err && err.code) || "error"));
    }
  }
  return { revertidos, fallos };
}

/* ---------- Carga de la semilla ----------
   Id determinista a partir del slug: volver a pulsar el boton reescribe el
   mismo documento en vez de crear copias. merge:true conserva createdAt. */
async function cargarSemillaFormulario() {
  let cargados = 0;
  const fallos = [];
  for (const receta of SEMILLA_FORMULARIO) {
    if (!receta || !receta.slug) {
      fallos.push("Una entrada de la semilla no tiene slug y se omitio");
      continue;
    }
    try {
      await setDoc(
        doc(db, "formulario", "semilla_" + receta.slug),
        {
          uid: currentUid,
          nombreGenerico: receta.nombreGenerico || "",
          familia: receta.familia || "",
          presentaciones: receta.presentaciones || [],
          dosis: receta.dosis || [],
          retiro: receta.retiro || [],
          contraindicaciones: receta.contraindicaciones || [],
          alertas: receta.alertas || [],
          verificadoEl: receta.verificadoEl ? new Date(receta.verificadoEl) : null,
          esquemaFormulario: 2,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );
      cargados++;
    } catch (err) {
      console.error("No se pudo cargar " + receta.slug + ":", err);
      fallos.push(receta.slug + ": " + ((err && err.code) || "error"));
    }
  }
  return { cargados, fallos };
}

/* ---------- Campos reutilizables del modulo ---------- */

function campoFormulario(labelText, control) {
  const group = document.createElement("div");
  group.className = "field-group";
  const lbl = document.createElement("label");
  lbl.textContent = labelText;
  group.appendChild(lbl);
  group.appendChild(control);
  return group;
}

function inputTexto(valor, placeholder) {
  const input = document.createElement("input");
  input.placeholder = placeholder || "";
  input.value = valor == null ? "" : valor;
  return input;
}

function inputNumero(valor, placeholder) {
  const input = document.createElement("input");
  input.type = "number";
  input.step = "any";
  input.placeholder = placeholder || "";
  input.value = valor == null ? "" : valor;
  return input;
}

function selectDe(opciones, valor, textoVacio) {
  const sel = document.createElement("select");
  if (textoVacio != null) {
    const o = document.createElement("option");
    o.value = "";
    o.textContent = textoVacio;
    sel.appendChild(o);
  }
  opciones.forEach((op) => {
    const o = document.createElement("option");
    o.value = op;
    o.textContent = op;
    sel.appendChild(o);
  });
  sel.value = valor || "";
  return sel;
}

function subtituloModulo(texto, extraClase) {
  const h = document.createElement("div");
  h.className = "form-subtitulo" + (extraClase ? " " + extraClase : "");
  h.textContent = texto;
  return h;
}

function botonQuitar(etiqueta, onClick) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "icon-btn danger";
  b.textContent = "🗑";
  b.setAttribute("aria-label", etiqueta);
  b.addEventListener("click", onClick);
  return b;
}

/* ---------- Tabla del formulario ---------- */

function buildFormularioTable(list, withActions) {
  const wrap = document.createElement("div");
  wrap.className = "table-wrap";
  if (list.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-table";
    empty.textContent = "Aún no hay fármacos en el formulario.";
    wrap.appendChild(empty);
    return wrap;
  }
  const table = document.createElement("table");
  table.className = "data-table";
  const cols = withActions
    ? ["Fármaco", "Familia", "Dosis", "Especies", "Acción"]
    : ["Fármaco", "Familia", "Especies"];
  table.innerHTML = "<thead><tr>" + cols.map((c) => "<th>" + c + "</th>").join("") + "</tr></thead>";
  const tbody = document.createElement("tbody");

  list.forEach((crudo) => {
    const far = farmacoNormalizado(crudo);
    const tr = document.createElement("tr");
    if (!withActions) tr.style.cursor = "default";
    else {
      tr.addEventListener("click", (e) => {
        if (e.target.closest(".row-actions")) return;
        state.studyTab = "formulario";
        state.activeId = far.id;
        render();
      });
    }

    const nameTd = document.createElement("td");
    nameTd.className = "cell-title";
    nameTd.textContent = far.nombreGenerico || "(sin nombre)";
    // Una alerta absoluta tiene que verse ya en la lista, no solo al abrir.
    if (far.alertas.length) {
      const chip = document.createElement("span");
      chip.className = "form-chip-alerta";
      chip.textContent = "⚠";
      chip.title = far.alertas.length + " alerta(s)";
      nameTd.appendChild(chip);
    }
    tr.appendChild(nameTd);

    const famTd = document.createElement("td");
    famTd.className = "cell-muted";
    famTd.textContent = far.familia || "—";
    tr.appendChild(famTd);

    if (withActions) {
      const doseTd = document.createElement("td");
      doseTd.className = "cell-muted";
      doseTd.textContent = far.dosis.length ? far.dosis.length + " pauta(s)" : "—";
      tr.appendChild(doseTd);
    }

    const specTd = document.createElement("td");
    specTd.className = "cell-muted";
    const esp = especiesDe(far);
    specTd.textContent = esp.length ? esp.join(", ") : "—";
    tr.appendChild(specTd);

    if (withActions) {
      const actTd = document.createElement("td");
      actTd.className = "row-actions";
      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "icon-btn";
      editBtn.textContent = "✎";
      editBtn.setAttribute("aria-label", "Editar");
      editBtn.addEventListener("click", () => {
        state.studyTab = "formulario";
        state.activeId = far.id;
        render();
      });
      const delBtn = botonQuitar("Eliminar", async () => {
        const ok = await askConfirm({
          title: "¿Eliminar del formulario?",
          message: "Se quitará “" + (far.nombreGenerico || "este fármaco") + "” del formulario de referencia.",
          confirmLabel: "Eliminar"
        });
        if (!ok) return;
        try {
          await deleteDoc(doc(db, "formulario", far.id));
        } catch (err) {
          alert("No se pudo eliminar (sin conexión).");
        }
      });
      actTd.appendChild(editBtn);
      actTd.appendChild(delBtn);
      tr.appendChild(actTd);
    }

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  wrap.appendChild(table);
  return wrap;
}

async function createFormularioEntry() {
  try {
    const ref = await addDoc(collection(db, "formulario"), {
      uid: currentUid,
      nombreGenerico: "",
      familia: "",
      presentaciones: [],
      dosis: [],
      retiro: [],
      contraindicaciones: [],
      alertas: [],
      verificadoEl: null,
      esquemaFormulario: 2,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    state.studyTab = "formulario";
    state.activeId = ref.id;
    render();
  } catch (err) {
    alert("No se pudo crear la entrada. Revisa tu conexión e intenta de nuevo.");
  }
}

/* ---------- Pestaña Formulario ---------- */

function renderFormularioTab(root) {
  const card = document.createElement("div");
  card.className = "card";
  const cardHead = document.createElement("div");
  cardHead.className = "card-head";
  const cardTitle = document.createElement("h2");
  cardTitle.textContent = "Formulario de Fármacos";
  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "btn-primary";
  addBtn.textContent = "+ Agregar fármaco";
  addBtn.addEventListener("click", () => createFormularioEntry());
  cardHead.appendChild(cardTitle);
  cardHead.appendChild(addBtn);
  card.appendChild(cardHead);

  const filterRow = document.createElement("div");
  filterRow.className = "form-filtros";

  const especieSelect = selectDe(especiesDelFormulario(), state.formularioEspecieFilter, "Todas las especies");
  especieSelect.className = "btn-secondary";
  especieSelect.addEventListener("change", () => {
    state.formularioEspecieFilter = especieSelect.value;
    render();
  });
  filterRow.appendChild(especieSelect);

  // El buscador global de la barra superior ya filtra por nombre y familia
  // (matchesFormularioQuery). Esta pista lo explica en vez de duplicar un
  // segundo campo de busqueda que haria lo mismo.
  const pista = document.createElement("span");
  pista.className = "form-pista";
  pista.textContent = state.query
    ? 'Filtrando por “' + state.query + '” (nombre genérico, familia, vía o indicación).'
    : "Usa el buscador de arriba para filtrar por nombre genérico, familia, vía o indicación.";
  filterRow.appendChild(pista);
  card.appendChild(filterRow);

  const listWrap = document.createElement("div");
  listWrap.style.padding = "14px 0 4px";
  const filtro = state.formularioEspecieFilter;
  const list = state.formulario
    .filter((f) => matchesFormularioQuery(f, state.query))
    .filter((f) => !filtro || especiesDe(farmacoNormalizado(f)).includes(filtro))
    .sort((a, b) =>
      (farmacoNormalizado(a).nombreGenerico || "").localeCompare(farmacoNormalizado(b).nombreGenerico || "")
    );
  listWrap.appendChild(buildFormularioTable(list, true));
  card.appendChild(listWrap);
  root.appendChild(card);

  root.appendChild(buildMantenimientoFormulario());
}

/* Mantenimiento: migracion y semilla. Vive dentro de la pestaña Formulario
   porque es lo unico que administra, y asi no hay que tocar Configuracion
   ni la navegacion. */
function buildMantenimientoFormulario() {
  const card = document.createElement("div");
  card.className = "card card-pad form-mantenimiento";

  const titulo = document.createElement("h2");
  titulo.className = "form-mant-titulo";
  titulo.textContent = "Mantenimiento del formulario";
  card.appendChild(titulo);

  const sinMigrar = state.formulario.filter((f) => !Array.isArray(f.dosis)).length;
  const migrados = state.formulario.length - sinMigrar;

  const estado = document.createElement("p");
  estado.className = "form-mant-desc";
  estado.textContent =
    state.formulario.length === 0
      ? "El formulario está vacío."
      : migrados + " de " + state.formulario.length + " fármacos usan el esquema nuevo.";
  card.appendChild(estado);

  const salida = document.createElement("p");
  salida.className = "form-mant-salida";
  salida.hidden = true;

  function informar(texto, esError) {
    salida.hidden = false;
    salida.textContent = texto;
    salida.classList.toggle("error", !!esError);
  }

  const acciones = document.createElement("div");
  acciones.className = "form-mant-acciones";

  const btnMigrar = document.createElement("button");
  btnMigrar.type = "button";
  btnMigrar.className = "btn-primary";
  btnMigrar.textContent = sinMigrar ? "Migrar " + sinMigrar + " fármaco(s)" : "Nada que migrar";
  btnMigrar.disabled = !sinMigrar;
  btnMigrar.addEventListener("click", async () => {
    const ok = await askConfirm({
      title: "¿Migrar el formulario?",
      message:
        "Se agregan los campos del esquema nuevo a " +
        sinMigrar +
        " fármaco(s). Los campos viejos NO se borran, así que la migración se puede revertir.",
      confirmLabel: "Migrar"
    });
    if (!ok) return;
    btnMigrar.disabled = true;
    btnMigrar.textContent = "Migrando…";
    const r = await migrarFormulario();
    informar(
      "Migrados " + r.migrados + " de " + r.pendientes + (r.fallos.length ? ". Fallaron: " + r.fallos.join("; ") : "."),
      r.fallos.length > 0
    );
    render();
  });
  acciones.appendChild(btnMigrar);

  const btnRevertir = document.createElement("button");
  btnRevertir.type = "button";
  btnRevertir.className = "btn-secondary";
  btnRevertir.textContent = "Revertir migración";
  btnRevertir.disabled = migrados === 0;
  btnRevertir.addEventListener("click", async () => {
    const ok = await askConfirm({
      title: "¿Revertir la migración?",
      message:
        "Se quitan los campos del esquema nuevo de " +
        migrados +
        " fármaco(s). Lo que hayas escrito SOLO en los campos nuevos (presentaciones, alertas, retiro…) se pierde. Los datos del esquema viejo quedan intactos.",
      confirmLabel: "Revertir"
    });
    if (!ok) return;
    btnRevertir.disabled = true;
    btnRevertir.textContent = "Revirtiendo…";
    const r = await revertirMigracionFormulario();
    informar(
      "Revertidos " + r.revertidos + (r.fallos.length ? ". Fallaron: " + r.fallos.join("; ") : "."),
      r.fallos.length > 0
    );
    render();
  });
  acciones.appendChild(btnRevertir);

  const btnSemilla = document.createElement("button");
  btnSemilla.type = "button";
  btnSemilla.className = "btn-secondary";
  btnSemilla.textContent = "Cargar semilla (" + SEMILLA_FORMULARIO.length + ")";
  btnSemilla.addEventListener("click", async () => {
    const ok = await askConfirm({
      title: "¿Cargar la semilla?",
      message:
        "Se crean o reescriben " +
        SEMILLA_FORMULARIO.length +
        " fármaco(s) desde semilla-formulario.js. Volver a pulsarlo no duplica: reescribe los mismos.",
      confirmLabel: "Cargar"
    });
    if (!ok) return;
    btnSemilla.disabled = true;
    btnSemilla.textContent = "Cargando…";
    const r = await cargarSemillaFormulario();
    informar("Cargados " + r.cargados + (r.fallos.length ? ". Fallaron: " + r.fallos.join("; ") : "."), r.fallos.length > 0);
    render();
  });
  acciones.appendChild(btnSemilla);

  card.appendChild(acciones);
  card.appendChild(salida);

  const nota = document.createElement("p");
  nota.className = "form-mant-desc";
  nota.textContent =
    "Los fármacos del esquema viejo se leen y se calculan igual sin migrar: la migración solo habilita los campos nuevos (varias dosis por especie, retiro, alertas).";
  card.appendChild(nota);

  return card;
}

/* ---------- Ficha del fármaco ----------
   Orden fijo: alertas, presentaciones, dosis por especie, retiro,
   contraindicaciones, y por ultimo verificacion. */

function renderFormularioDetail(root, item) {
  mountedDetailId = item.id;
  const far = farmacoNormalizado(item);

  root.appendChild(
    backLink("Centro de estudio", () => {
      state.activeId = null;
      render();
    })
  );

  const status = document.createElement("div");
  status.className = "status";
  status.setAttribute("data-state", "ok");
  status.innerHTML = '<span class="dot"></span><span class="statusText">Sincronizado</span>';
  const statusText = status.querySelector(".statusText");

  function save(campo, valor) {
    scheduleSave("formulario", far.id, { [campo]: valor }, statusText);
  }

  // Guardar un array implica reescribirlo entero, asi que la copia local es
  // la fuente de verdad mientras la ficha esta abierta (los snapshots no
  // redibujan una ficha montada).
  function guardarLista(campo, lista) {
    far[campo] = lista;
    save(campo, lista);
  }

  function marcarError(texto) {
    status.setAttribute("data-state", "error");
    statusText.textContent = texto;
  }

  const tag = document.createElement("span");
  tag.className = "section-tag formulario";
  tag.textContent = "Fármaco de referencia";
  tag.style.margin = "10px 0";
  tag.style.display = "inline-flex";

  const titleInput = document.createElement("input");
  titleInput.className = "field-title";
  titleInput.placeholder = "Nombre genérico";
  titleInput.value = far.nombreGenerico;
  titleInput.style.margin = "10px 0 8px";
  titleInput.addEventListener("input", () => save("nombreGenerico", titleInput.value));

  root.appendChild(tag);
  root.appendChild(titleInput);

  const familiaRow = document.createElement("div");
  familiaRow.className = "field-row";
  const familiaInput = inputTexto(far.familia, "Ej. AINE, aminoglucósido, fluoroquinolona");
  familiaInput.addEventListener("input", () => save("familia", familiaInput.value));
  familiaRow.appendChild(campoFormulario("Familia", familiaInput));
  root.appendChild(familiaRow);

  /* --- 1. Alertas (primero y en rojo, antes que cualquier dosis) --- */
  const alertasCard = document.createElement("div");
  alertasCard.className = "card card-pad form-alertas";
  alertasCard.appendChild(subtituloModulo("Alertas — contraindicaciones absolutas"));

  const alertasLista = document.createElement("div");
  alertasCard.appendChild(alertasLista);

  function pintarAlertas() {
    alertasLista.innerHTML = "";
    if (!far.alertas.length) {
      const vacio = document.createElement("p");
      vacio.className = "form-vacio";
      vacio.textContent = "Sin alertas registradas.";
      alertasLista.appendChild(vacio);
    }
    far.alertas.forEach((texto, i) => {
      const fila = document.createElement("div");
      fila.className = "form-fila form-fila-alerta";
      const input = inputTexto(texto, "Ej. Felinos: no usar en pautas repetidas");
      input.addEventListener("input", () => {
        const copia = far.alertas.slice();
        copia[i] = input.value;
        guardarLista("alertas", copia);
      });
      fila.appendChild(input);
      fila.appendChild(
        botonQuitar("Quitar alerta", () => {
          guardarLista("alertas", far.alertas.filter((_, j) => j !== i));
          pintarAlertas();
        })
      );
      alertasLista.appendChild(fila);
    });
  }
  pintarAlertas();

  const addAlerta = document.createElement("button");
  addAlerta.type = "button";
  addAlerta.className = "btn-secondary";
  addAlerta.textContent = "+ Agregar alerta";
  addAlerta.addEventListener("click", () => {
    guardarLista("alertas", far.alertas.concat(""));
    pintarAlertas();
  });
  alertasCard.appendChild(addAlerta);
  root.appendChild(alertasCard);

  /* --- 2. Presentaciones --- */
  const presCard = document.createElement("div");
  presCard.className = "card card-pad";
  presCard.appendChild(subtituloModulo("Presentaciones"));
  const presLista = document.createElement("div");
  presCard.appendChild(presLista);

  function pintarPresentaciones() {
    presLista.innerHTML = "";
    if (!far.presentaciones.length) {
      const vacio = document.createElement("p");
      vacio.className = "form-vacio";
      vacio.textContent = "Sin presentaciones. La calculadora necesita al menos una para dar el volumen en mL.";
      presLista.appendChild(vacio);
    }
    far.presentaciones.forEach((p, i) => {
      const fila = document.createElement("div");
      fila.className = "form-fila-bloque";
      const campos = document.createElement("div");
      campos.className = "field-row";

      function editar(campo, valor) {
        const copia = far.presentaciones.map((x, j) => (j === i ? { ...x, [campo]: valor } : x));
        guardarLista("presentaciones", copia);
      }

      const conc = inputNumero(p.concentracion, "Ej. 50");
      conc.addEventListener("input", () => editar("concentracion", conc.value === "" ? null : Number(conc.value)));
      campos.appendChild(campoFormulario("Concentración", conc));

      const unidad = inputTexto(p.unidadConc, "mg/mL, mg/tableta");
      unidad.addEventListener("input", () => editar("unidadConc", unidad.value));
      campos.appendChild(campoFormulario("Unidad", unidad));

      const via = selectDe(VIAS_FORMULARIO, p.via, "—");
      via.addEventListener("change", () => editar("via", via.value));
      campos.appendChild(campoFormulario("Vía", via));

      const comercial = inputTexto(p.nombreComercialLocal, "Nombre comercial local");
      comercial.addEventListener("input", () => editar("nombreComercialLocal", comercial.value));
      campos.appendChild(campoFormulario("Producto local", comercial));

      fila.appendChild(campos);
      fila.appendChild(
        botonQuitar("Quitar presentación", () => {
          guardarLista("presentaciones", far.presentaciones.filter((_, j) => j !== i));
          pintarPresentaciones();
        })
      );
      presLista.appendChild(fila);
    });
  }
  pintarPresentaciones();

  const addPres = document.createElement("button");
  addPres.type = "button";
  addPres.className = "btn-secondary";
  addPres.textContent = "+ Agregar presentación";
  addPres.addEventListener("click", () => {
    guardarLista(
      "presentaciones",
      far.presentaciones.concat({ concentracion: null, unidadConc: "mg/mL", via: "", nombreComercialLocal: "" })
    );
    pintarPresentaciones();
  });
  presCard.appendChild(addPres);
  root.appendChild(presCard);

  /* --- 3. Dosis agrupadas por especie --- */
  const dosisCard = document.createElement("div");
  dosisCard.className = "card card-pad";
  dosisCard.appendChild(subtituloModulo("Dosis"));
  const dosisLista = document.createElement("div");
  dosisCard.appendChild(dosisLista);

  function filaDosis(d, i) {
    const bloque = document.createElement("div");
    bloque.className = "form-fila-bloque";

    function editar(campo, valor) {
      const copia = far.dosis.map((x, j) => (j === i ? { ...x, [campo]: valor } : x));
      guardarLista("dosis", copia);
    }

    const fila1 = document.createElement("div");
    fila1.className = "field-row";

    const ind = inputTexto(d.indicacion, "Ej. Infección de piel y tejidos blandos");
    ind.addEventListener("input", () => editar("indicacion", ind.value));
    fila1.appendChild(campoFormulario("Indicación", ind));

    const via = selectDe(VIAS_FORMULARIO, d.via, "—");
    via.addEventListener("change", () => editar("via", via.value));
    fila1.appendChild(campoFormulario("Vía", via));

    const fila2 = document.createElement("div");
    fila2.className = "field-row";

    const dmin = inputNumero(d.dosisMin, "Mín.");
    dmin.addEventListener("input", () => editar("dosisMin", dmin.value === "" ? null : Number(dmin.value)));
    fila2.appendChild(campoFormulario("Dosis mín.", dmin));

    const dmax = inputNumero(d.dosisMax, "Máx.");
    dmax.addEventListener("input", () => editar("dosisMax", dmax.value === "" ? null : Number(dmax.value)));
    fila2.appendChild(campoFormulario("Dosis máx.", dmax));

    const uni = inputTexto(d.unidad, "mg/kg, UI/kg");
    uni.addEventListener("input", () => editar("unidad", uni.value));
    fila2.appendChild(campoFormulario("Unidad", uni));

    const frec = inputNumero(d.frecuenciaH, "Ej. 12");
    frec.addEventListener("input", () => editar("frecuenciaH", frec.value === "" ? null : Number(frec.value)));
    fila2.appendChild(campoFormulario("Cada (h)", frec));

    const dur = inputNumero(d.duracionMaxDias, "Sin límite");
    dur.addEventListener("input", () => editar("duracionMaxDias", dur.value === "" ? null : Number(dur.value)));
    fila2.appendChild(campoFormulario("Duración máx. (días)", dur));

    const fila3 = document.createElement("div");
    fila3.className = "field-row";

    /* La fuente es el unico campo que se niega a guardarse vacio. Sin
       fuente el dato no es verificable, y un vademecum sin trazabilidad es
       justo lo que este esquema vino a evitar. */
    const fuente = inputTexto(d.fuente, "Obligatorio: etiqueta, NADA, EMA, FARAD…");
    fuente.addEventListener("input", () => {
      const vacia = !fuente.value.trim();
      fuente.classList.toggle("campo-invalido", vacia);
      if (vacia) {
        marcarError("Sin fuente no se guarda esta dosis");
        return;
      }
      editar("fuente", fuente.value);
    });
    if (!String(d.fuente || "").trim()) fuente.classList.add("campo-invalido");
    fila3.appendChild(campoFormulario("Fuente (obligatoria)", fuente));

    const extraWrap = document.createElement("label");
    extraWrap.className = "form-check";
    const extra = document.createElement("input");
    extra.type = "checkbox";
    extra.checked = !!d.esExtralabel;
    extra.addEventListener("change", () => editar("esExtralabel", extra.checked));
    extraWrap.appendChild(extra);
    extraWrap.appendChild(document.createTextNode(" Uso extraetiqueta"));
    fila3.appendChild(extraWrap);

    bloque.appendChild(fila1);
    bloque.appendChild(fila2);
    bloque.appendChild(fila3);

    if (!String(d.fuente || "").trim()) {
      const aviso = document.createElement("p");
      aviso.className = "form-aviso-error";
      aviso.textContent = "Esta pauta no tiene fuente: no se usa en la calculadora hasta que la completes.";
      bloque.appendChild(aviso);
    }

    bloque.appendChild(
      botonQuitar("Quitar dosis", () => {
        guardarLista("dosis", far.dosis.filter((_, j) => j !== i));
        pintarDosis();
      })
    );
    return bloque;
  }

  function pintarDosis() {
    dosisLista.innerHTML = "";
    if (!far.dosis.length) {
      const vacio = document.createElement("p");
      vacio.className = "form-vacio";
      vacio.textContent = "Sin dosis cargadas.";
      dosisLista.appendChild(vacio);
      return;
    }
    // Agrupadas por especie, como pide la ficha.
    const grupos = new Map();
    far.dosis.forEach((d, i) => {
      const clave = d.especie || "(sin especie)";
      if (!grupos.has(clave)) grupos.set(clave, []);
      grupos.get(clave).push({ d, i });
    });
    grupos.forEach((filas, especie) => {
      dosisLista.appendChild(subtituloModulo(especie, "form-subtitulo-especie"));
      filas.forEach(({ d, i }) => dosisLista.appendChild(filaDosis(d, i)));
    });
  }
  pintarDosis();

  /* Alta de dosis: aqui SI hay validacion previa. La ficha se guarda sola
     campo a campo, asi que la unica forma de que "no deje guardar" sea real
     es que la pauta no entre a la lista sin fuente. */
  const altaDosis = document.createElement("div");
  altaDosis.className = "form-alta";
  altaDosis.appendChild(subtituloModulo("Agregar dosis"));

  const altaFila = document.createElement("div");
  altaFila.className = "field-row";
  const altaEspecie = selectDe(ESPECIES_FORMULARIO, "", "Especie…");
  altaFila.appendChild(campoFormulario("Especie", altaEspecie));
  const altaMin = inputNumero(null, "Mín.");
  altaFila.appendChild(campoFormulario("Dosis mín.", altaMin));
  const altaMax = inputNumero(null, "Máx.");
  altaFila.appendChild(campoFormulario("Dosis máx.", altaMax));
  const altaUnidad = inputTexto("mg/kg", "mg/kg");
  altaFila.appendChild(campoFormulario("Unidad", altaUnidad));
  const altaVia = selectDe(VIAS_FORMULARIO, "", "Vía…");
  altaFila.appendChild(campoFormulario("Vía", altaVia));
  altaDosis.appendChild(altaFila);

  const altaFila2 = document.createElement("div");
  altaFila2.className = "field-row";
  const altaFuente = inputTexto("", "Obligatorio: etiqueta, NADA, EMA, FARAD…");
  altaFila2.appendChild(campoFormulario("Fuente (obligatoria)", altaFuente));
  altaDosis.appendChild(altaFila2);

  const altaError = document.createElement("p");
  altaError.className = "form-aviso-error";
  altaError.hidden = true;
  altaDosis.appendChild(altaError);

  const altaBtn = document.createElement("button");
  altaBtn.type = "button";
  altaBtn.className = "btn-primary";
  altaBtn.textContent = "Agregar dosis";
  altaBtn.addEventListener("click", () => {
    const faltan = [];
    if (!altaEspecie.value) faltan.push("especie");
    if (altaMin.value === "") faltan.push("dosis mínima");
    if (!altaUnidad.value.trim()) faltan.push("unidad");
    if (!altaVia.value) faltan.push("vía");
    if (!altaFuente.value.trim()) faltan.push("fuente");

    altaFuente.classList.toggle("campo-invalido", !altaFuente.value.trim());
    if (faltan.length) {
      altaError.hidden = false;
      altaError.textContent = "Falta: " + faltan.join(", ") + ". Sin fuente no se guarda ninguna dosis.";
      return;
    }
    altaError.hidden = true;

    const max = altaMax.value === "" ? Number(altaMin.value) : Number(altaMax.value);
    guardarLista(
      "dosis",
      far.dosis.concat({
        especie: altaEspecie.value,
        indicacion: "",
        dosisMin: Number(altaMin.value),
        dosisMax: max,
        unidad: altaUnidad.value.trim(),
        via: altaVia.value,
        frecuenciaH: null,
        duracionMaxDias: null,
        fuente: altaFuente.value.trim(),
        esExtralabel: false
      })
    );
    altaEspecie.value = "";
    altaMin.value = "";
    altaMax.value = "";
    altaVia.value = "";
    altaFuente.value = "";
    altaFuente.classList.remove("campo-invalido");
    pintarDosis();
  });
  altaDosis.appendChild(altaBtn);
  dosisCard.appendChild(altaDosis);
  root.appendChild(dosisCard);

  /* --- 4. Tiempos de retiro --- */
  const retiroCard = document.createElement("div");
  retiroCard.className = "card card-pad";
  retiroCard.appendChild(subtituloModulo("Tiempos de retiro"));
  const retiroLista = document.createElement("div");
  retiroCard.appendChild(retiroLista);

  function pintarRetiro() {
    retiroLista.innerHTML = "";
    if (!far.retiro.length) {
      const vacio = document.createElement("p");
      vacio.className = "form-vacio";
      vacio.textContent = "Sin tiempos de retiro registrados.";
      retiroLista.appendChild(vacio);
    }
    far.retiro.forEach((r, i) => {
      const bloque = document.createElement("div");
      bloque.className = "form-fila-bloque";

      function editar(campo, valor) {
        const copia = far.retiro.map((x, j) => (j === i ? { ...x, [campo]: valor } : x));
        guardarLista("retiro", copia);
      }

      const f1 = document.createElement("div");
      f1.className = "field-row";
      const esp = selectDe(ESPECIES_FORMULARIO, r.especie, "Especie…");
      esp.addEventListener("change", () => editar("especie", esp.value));
      f1.appendChild(campoFormulario("Especie", esp));
      const prod = inputTexto(r.producto, "Producto registrado");
      prod.addEventListener("input", () => editar("producto", prod.value));
      f1.appendChild(campoFormulario("Producto", prod));

      const f2 = document.createElement("div");
      f2.className = "field-row";
      const carne = inputNumero(r.carneDias, "Días");
      carne.addEventListener("input", () => editar("carneDias", carne.value === "" ? null : Number(carne.value)));
      f2.appendChild(campoFormulario("Carne (días)", carne));
      const leche = inputNumero(r.lecheHoras, "Horas");
      leche.addEventListener("input", () => editar("lecheHoras", leche.value === "" ? null : Number(leche.value)));
      f2.appendChild(campoFormulario("Leche (horas)", leche));
      const fue = inputTexto(r.fuente, "AGROCALIDAD, FDA, EMA…");
      fue.addEventListener("input", () => editar("fuente", fue.value));
      f2.appendChild(campoFormulario("Fuente", fue));

      bloque.appendChild(f1);
      bloque.appendChild(f2);

      // El aviso legal: fuera de AGROCALIDAD el dato no es vinculante aqui.
      if (retiroEsOrientativo(r)) {
        const aviso = document.createElement("p");
        aviso.className = "form-aviso-legal";
        aviso.textContent =
          "Dato orientativo: la fuente no es AGROCALIDAD. En Ecuador el tiempo de retiro vinculante es el de la etiqueta del producto registrado localmente.";
        bloque.appendChild(aviso);
      }

      bloque.appendChild(
        botonQuitar("Quitar retiro", () => {
          guardarLista("retiro", far.retiro.filter((_, j) => j !== i));
          pintarRetiro();
        })
      );
      retiroLista.appendChild(bloque);
    });
  }
  pintarRetiro();

  const addRetiro = document.createElement("button");
  addRetiro.type = "button";
  addRetiro.className = "btn-secondary";
  addRetiro.textContent = "+ Agregar tiempo de retiro";
  addRetiro.addEventListener("click", () => {
    guardarLista(
      "retiro",
      far.retiro.concat({ especie: "", producto: "", carneDias: null, lecheHoras: null, fuente: "" })
    );
    pintarRetiro();
  });
  retiroCard.appendChild(addRetiro);
  root.appendChild(retiroCard);

  /* --- 5. Contraindicaciones --- */
  const contraCard = document.createElement("div");
  contraCard.className = "card card-pad";
  contraCard.appendChild(subtituloModulo("Contraindicaciones"));
  const contraLista = document.createElement("div");
  contraCard.appendChild(contraLista);

  function pintarContra() {
    contraLista.innerHTML = "";
    if (!far.contraindicaciones.length) {
      const vacio = document.createElement("p");
      vacio.className = "form-vacio";
      vacio.textContent = "Sin contraindicaciones registradas.";
      contraLista.appendChild(vacio);
    }
    far.contraindicaciones.forEach((texto, i) => {
      const fila = document.createElement("div");
      fila.className = "form-fila";
      const input = inputTexto(texto, "Ej. Insuficiencia renal");
      input.addEventListener("input", () => {
        const copia = far.contraindicaciones.slice();
        copia[i] = input.value;
        guardarLista("contraindicaciones", copia);
      });
      fila.appendChild(input);
      fila.appendChild(
        botonQuitar("Quitar contraindicación", () => {
          guardarLista("contraindicaciones", far.contraindicaciones.filter((_, j) => j !== i));
          pintarContra();
        })
      );
      contraLista.appendChild(fila);
    });
  }
  pintarContra();

  const addContra = document.createElement("button");
  addContra.type = "button";
  addContra.className = "btn-secondary";
  addContra.textContent = "+ Agregar contraindicación";
  addContra.addEventListener("click", () => {
    guardarLista("contraindicaciones", far.contraindicaciones.concat(""));
    pintarContra();
  });
  contraCard.appendChild(addContra);
  root.appendChild(contraCard);

  /* --- 6. Verificacion --- */
  const verifCard = document.createElement("div");
  verifCard.className = "card card-pad";
  verifCard.appendChild(subtituloModulo("Verificación"));

  const verifRow = document.createElement("div");
  verifRow.className = "field-row";
  const verifInput = document.createElement("input");
  verifInput.type = "date";
  verifInput.value = paraInputFecha(far.verificadoEl);
  verifInput.addEventListener("change", () => {
    const valor = verifInput.value ? new Date(verifInput.value) : null;
    far.verificadoEl = valor;
    save("verificadoEl", valor);
    pintarEstadoVerif();
  });
  verifRow.appendChild(campoFormulario("Verificado el", verifInput));
  verifCard.appendChild(verifRow);

  const estadoVerif = document.createElement("p");
  verifCard.appendChild(estadoVerif);

  function pintarEstadoVerif() {
    if (!far.verificadoEl) {
      estadoVerif.className = "form-aviso-error";
      estadoVerif.textContent = "Sin fecha de verificación.";
      return;
    }
    if (verificacionVencida(far.verificadoEl)) {
      estadoVerif.className = "form-aviso-error";
      estadoVerif.textContent =
        "Desactualizado: verificado el " + fechaCorta(far.verificadoEl) + ", hace más de " + MESES_VIGENCIA_FORMULARIO + " meses.";
      return;
    }
    estadoVerif.className = "form-vacio";
    estadoVerif.textContent = "Verificado el " + fechaCorta(far.verificadoEl) + ".";
  }
  pintarEstadoVerif();
  root.appendChild(verifCard);

  const foot = document.createElement("div");
  foot.className = "editor-foot";
  const del = document.createElement("button");
  del.className = "btn-delete";
  del.type = "button";
  del.textContent = "Eliminar entrada";
  del.addEventListener("click", async () => {
    const ok = await askConfirm({
      title: "¿Eliminar del formulario?",
      message: "Se borrará “" + (far.nombreGenerico || "este fármaco") + "” del formulario de referencia. No se puede deshacer.",
      confirmLabel: "Eliminar"
    });
    if (!ok) return;
    state.activeId = null;
    render();
    try {
      await deleteDoc(doc(db, "formulario", far.id));
    } catch (err) {
      alert("No se pudo eliminar (sin conexión). Se reintentará cuando vuelvas a estar en línea.");
    }
  });
  foot.appendChild(status);
  foot.appendChild(del);
  root.appendChild(foot);

  if (!far.nombreGenerico) setTimeout(() => titleInput.focus(), 0);
}

/* ---------- Configuración ---------- */

function renderSettingsPage(root) {
  root.appendChild(pageHead("Configuración"));

  const list = document.createElement("div");
  list.className = "settings-list";

  // Tema
  const themeRow = document.createElement("div");
  themeRow.className = "settings-row";
  themeRow.innerHTML = '<div><div class="lbl">Tema</div><div class="desc">Claro u oscuro para toda la app.</div></div>';
  const themeBtn = document.createElement("button");
  themeBtn.type = "button";
  themeBtn.className = "btn-secondary";
  themeBtn.textContent = currentTheme === "dark" ? "☀️ Modo claro" : "🌙 Modo oscuro";
  themeBtn.addEventListener("click", () => {
    toggleTheme();
    themeBtn.textContent = currentTheme === "dark" ? "☀️ Modo claro" : "🌙 Modo oscuro";
  });
  themeRow.appendChild(themeBtn);
  list.appendChild(themeRow);

  // Perfil: se guarda con el mismo debounce por campo del resto de la app,
  // sobre el documento de perfil dentro de "entries".
  const perfilRow = document.createElement("div");
  perfilRow.className = "settings-row";
  perfilRow.style.flexDirection = "column";
  perfilRow.style.alignItems = "stretch";

  const perfilLbl = document.createElement("div");
  perfilLbl.className = "lbl";
  perfilLbl.textContent = "Perfil";
  const perfilDesc = document.createElement("div");
  perfilDesc.className = "desc";
  perfilDesc.style.marginBottom = "10px";
  perfilDesc.textContent = "Tu nombre y título, como aparecen en la barra lateral.";

  // El perfil ya no se "prepara" al entrar: el documento nace con la primera
  // tecla (createIfMissing). Por eso, no tenerlo todavía NO es un error ni
  // una carga pendiente — es simplemente que aún no has escrito nada.
  const perfilStatus = document.createElement("div");
  perfilStatus.className = "status";
  perfilStatus.style.marginTop = "10px";
  perfilStatus.innerHTML = '<span class="dot"></span><span class="statusText"></span>';
  const perfilStatusText = perfilStatus.querySelector(".statusText");
  if (!state.ready) {
    perfilStatus.setAttribute("data-state", "pending");
    perfilStatusText.textContent = "Cargando…";
  } else if (state.profile) {
    perfilStatus.setAttribute("data-state", "ok");
    perfilStatusText.textContent = "Sincronizado";
  } else {
    perfilStatus.setAttribute("data-state", "pending");
    perfilStatusText.textContent = "Sin guardar todavía";
  }

  const perfilFields = document.createElement("div");
  perfilFields.className = "field-row";

  function perfilField(labelText, value, placeholder, campo) {
    const group = document.createElement("div");
    group.className = "field-group";
    const lbl = document.createElement("label");
    lbl.textContent = labelText;
    const input = document.createElement("input");
    input.placeholder = placeholder;
    input.value = value || "";
    input.addEventListener("input", () => {
      // createIfMissing: el documento del perfil se crea al vuelo si todavía
      // no existe, en vez de fallar con "not-found".
      scheduleSave(
        "entries",
        profileDocId(),
        { [campo]: input.value, section: "profile" },
        perfilStatusText,
        { createIfMissing: true }
      );
    });
    group.appendChild(lbl);
    group.appendChild(input);
    return group;
  }

  const perfil = state.profile || {};
  perfilFields.appendChild(perfilField("Nombre completo", perfil.nombre, "Ej. Daniel Mendoza", "nombre"));
  perfilFields.appendChild(
    perfilField("Título profesional", perfil.titulo != null ? perfil.titulo : TITULO_POR_DEFECTO, TITULO_POR_DEFECTO, "titulo")
  );

  perfilRow.appendChild(perfilLbl);
  perfilRow.appendChild(perfilDesc);
  perfilRow.appendChild(perfilFields);
  perfilRow.appendChild(perfilStatus);
  list.appendChild(perfilRow);

  // Cuenta
  const accountRow = document.createElement("div");
  accountRow.className = "settings-row";
  accountRow.innerHTML =
    '<div><div class="lbl">Cuenta</div><div class="desc">' + (auth.currentUser ? escapeHtml(auth.currentUser.email || "") : "") + "</div></div>";
  const signOutBtn2 = document.createElement("button");
  signOutBtn2.type = "button";
  signOutBtn2.className = "btn-secondary";
  signOutBtn2.textContent = "Cerrar sesión";
  signOutBtn2.addEventListener("click", () => {
    askConfirm({
      title: "¿Cerrar sesión?",
      message: "Se cerrará la sesión en este dispositivo. Tus datos siguen guardados en la nube.",
      confirmLabel: "Cerrar sesión",
      onConfirm: () => signOut(auth)
    });
  });
  accountRow.appendChild(signOutBtn2);
  list.appendChild(accountRow);

  // Backup
  const backupCard = document.createElement("div");
  backupCard.className = "settings-row";
  backupCard.style.flexDirection = "column";
  backupCard.style.alignItems = "stretch";
  const backupLbl = document.createElement("div");
  backupLbl.className = "lbl";
  backupLbl.textContent = "Copia de respaldo";
  const backupDesc = document.createElement("div");
  backupDesc.className = "desc";
  backupDesc.style.marginBottom = "10px";
  backupDesc.textContent = "Descarga o importa un respaldo manual de Materias y Casos clínicos.";
  const backupBtns = document.createElement("div");
  backupBtns.style.display = "flex";
  backupBtns.style.gap = "8px";
  const exportBtn = document.createElement("button");
  exportBtn.type = "button";
  exportBtn.className = "btn-secondary";
  exportBtn.textContent = "↓ Descargar copia";
  const importBtn = document.createElement("button");
  importBtn.type = "button";
  importBtn.className = "btn-secondary";
  importBtn.textContent = "↑ Importar copia antigua";
  const importFile = document.createElement("input");
  importFile.type = "file";
  importFile.accept = "application/json,.json";
  importFile.style.display = "none";
  const backupMsg = document.createElement("div");
  backupMsg.className = "settings-msg";

  function showBackupMsg(text, isError) {
    backupMsg.textContent = text;
    backupMsg.classList.toggle("error", !!isError);
  }

  exportBtn.addEventListener("click", () => {
    const payload = JSON.stringify({ entries: state.entries, exportedAt: new Date().toISOString() }, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "vetdiario-" + todayISO() + ".json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showBackupMsg("Copia descargada.");
  });

  importBtn.addEventListener("click", () => {
    importFile.value = "";
    importFile.click();
  });

  importFile.addEventListener("change", () => {
    const file = importFile.files && importFile.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      let incoming;
      try {
        const parsed = JSON.parse(String(reader.result));
        incoming = Array.isArray(parsed) ? parsed : parsed.entries;
      } catch (e) {
        showBackupMsg("Ese archivo no es una copia válida.", true);
        return;
      }
      if (!Array.isArray(incoming) || incoming.length === 0) {
        showBackupMsg("Ese archivo no tiene entradas para importar.", true);
        return;
      }
      const confirmado = await askConfirm({
        title: "¿Importar esta copia?",
        message: "Se agregarán " + incoming.length + " entrada(s) al cuaderno. Las que ya existan se omiten.",
        confirmLabel: "Importar",
        danger: false
      });
      if (!confirmado) return;
      showBackupMsg("Importando…");

      const validSections = { materias: true, casos: true };
      const dupKey = (e) => (e.section || "") + "␟" + (e.title || "") + "␟" + (e.date || "");
      const seenIds = new Set(state.entries.map((e) => e.id).filter(Boolean));
      const seenKeys = new Set(state.entries.map(dupKey));

      let ok = 0;
      let skipped = 0;
      for (const inc of incoming) {
        if (!inc || !inc.section || !validSections[inc.section]) continue;
        const isDup = (inc.id && seenIds.has(inc.id)) || seenKeys.has(dupKey(inc));
        if (isDup) {
          skipped++;
          continue;
        }
        try {
          await addDoc(collection(db, "entries"), {
            uid: currentUid,
            section: inc.section,
            title: inc.title || "",
            meta: inc.meta || "",
            date: inc.date || todayISO(),
            body: inc.body || "",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
          seenKeys.add(dupKey(inc));
          if (inc.id) seenIds.add(inc.id);
          ok++;
        } catch (err) {
          break;
        }
      }
      showBackupMsg("Se importaron " + ok + " de " + incoming.length + " entrada(s)." + (skipped ? " " + skipped + " omitida(s) por ya existir." : ""));
    };
    reader.onerror = () => showBackupMsg("No se pudo leer el archivo.", true);
    reader.readAsText(file);
  });

  backupBtns.appendChild(exportBtn);
  backupBtns.appendChild(importBtn);
  backupCard.appendChild(backupLbl);
  backupCard.appendChild(backupDesc);
  backupCard.appendChild(backupBtns);
  backupCard.appendChild(importFile);
  backupCard.appendChild(backupMsg);
  list.appendChild(backupCard);

  root.appendChild(list);
}

/* ================= Barra superior / navegación lateral ================= */

els.pageNav.forEach((btn) => {
  btn.addEventListener("click", () => goToPage(btn.getAttribute("data-page")));
});

els.search.addEventListener("input", () => {
  state.query = els.search.value;
  render();
});

els.toggleSidebar.addEventListener("click", () => {
  els.sidebar.classList.toggle("open");
});

/* ---------- Tema claro / oscuro ---------- */

const THEME_KEY = "vetcuaderno.theme.v1";

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  els.themeToggle.textContent = theme === "dark" ? "☀️" : "🌙";
  els.themeToggle.setAttribute("aria-label", theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro");

  // La franja del borde superior no la dibuja la página: es el navegador
  // coloreando su propia barra con theme-color. Como la app tiene su propio
  // interruptor de tema, el valor se actualiza aquí para que la barra
  // acompañe al fondo en vez de quedarse en un color fijo que no cuadra.
  const meta = document.getElementById("themeColorMeta");
  if (meta) {
    const fondo = getComputedStyle(document.documentElement).getPropertyValue("--paper").trim();
    if (fondo) meta.setAttribute("content", fondo);
  }
}

let currentTheme = localStorage.getItem(THEME_KEY) || "light";
applyTheme(currentTheme);

function toggleTheme() {
  currentTheme = currentTheme === "dark" ? "light" : "dark";
  localStorage.setItem(THEME_KEY, currentTheme);
  applyTheme(currentTheme);
}

els.themeToggle.addEventListener("click", toggleTheme);

/* ---------- Conexión ---------- */

window.addEventListener("online", () => {
  if (state.ready) setConn("online", "En línea");
  // Volvio la red: se vacia la cola de fotos que no pudieron subir.
  procesarColaFotos();
});
window.addEventListener("offline", () => {
  setConn("offline", "Sin conexión — se guardará al reconectar");
});

/* ---------- Acceso: enlace de correo (sin contraseña) ----------
   Con esto el mismo uid viaja contigo entre dispositivos: inicias sesión
   con el mismo correo en la laptop y en el cel, y ambos ven el mismo
   cuaderno — a la vez que las reglas de Firestore pueden exigir que
   uid == dueño de la entrada. */

const EMAIL_KEY = "vetcuaderno.authEmail.v1";

function setAuthMsg(text, kind) {
  els.authMsg.textContent = text;
  els.authMsg.classList.remove("error", "ok");
  if (kind) els.authMsg.classList.add(kind);
}

function actionCodeSettings() {
  return {
    url: window.location.origin + window.location.pathname,
    handleCodeInApp: true
  };
}

els.authSendBtn.addEventListener("click", async () => {
  const email = els.authEmail.value.trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    setAuthMsg("Escribe un correo válido.", "error");
    return;
  }
  els.authSendBtn.disabled = true;
  setAuthMsg("Enviando…");
  try {
    await sendSignInLinkToEmail(auth, email, actionCodeSettings());
    localStorage.setItem(EMAIL_KEY, email);
    setAuthMsg("Listo. Revisa " + email + " y abre el enlace para entrar (en cualquier dispositivo).", "ok");
  } catch (err) {
    setAuthMsg("No se pudo enviar el enlace. Revisa el correo o tu conexión.", "error");
  } finally {
    els.authSendBtn.disabled = false;
  }
});

els.authEmail.addEventListener("keydown", (event) => {
  if (event.key === "Enter") els.authSendBtn.click();
});

if (els.signOutBtn) {
  els.signOutBtn.addEventListener("click", () => {
    askConfirm({
      title: "¿Cerrar sesión?",
      message: "Se cerrará la sesión en este dispositivo. Tus datos siguen guardados en la nube.",
      confirmLabel: "Cerrar sesión",
      onConfirm: () => signOut(auth)
    });
  });
}

/* Se llama cuando el enlace del correo no llega a dar sesion. Sin esto, la
   pantalla de arranque se quedaria en "Completando acceso…" para siempre.
   No se puede resolver con un .finally() sobre completeSignInIfNeeded():
   cuando NO hay enlace esa funcion retorna al instante, antes de que auth
   haya respondido, y soltaria el login justo en el hueco que este cambio
   pretende tapar. */
function soltarArranqueSinSesion() {
  if (authResuelto) return;
  logAuth("el enlace no dio sesion: muestro el login");
  mostrarPantalla("login");
  authResuelto = true;
}

async function completeSignInIfNeeded() {
  if (!isSignInWithEmailLink(auth, window.location.href)) return;
  let email = localStorage.getItem(EMAIL_KEY);
  if (!email) {
    email = window.prompt("Confirma el correo con el que solicitaste el enlace, para completar el acceso:");
  }
  if (!email) {
    soltarArranqueSinSesion();
    return;
  }
  try {
    await signInWithEmailLink(auth, email, window.location.href);
    localStorage.removeItem(EMAIL_KEY);
    // No se suelta la pantalla aqui: onAuthStateChanged va a disparar con
    // el usuario y mostrara la app. Soltarla ahora enseñaria el login un
    // instante justo antes de entrar.
  } catch (err) {
    logAuth("fallo el canje del enlace: " + ((err && err.code) || err));
    setAuthMsg("El enlace no es válido o ya expiró. Solicita uno nuevo.", "error");
    soltarArranqueSinSesion();
  } finally {
    history.replaceState({}, document.title, window.location.pathname);
  }
}

/* ---------- Migración única: adoptar entradas viejas sin uid ----------
   Solo encuentra algo la primera vez que alguien inicia sesión, mientras
   las reglas de Firestore todavía sean abiertas. IMPORTANTE: aplica las
   reglas nuevas (restrictivas) DESPUÉS de que esto corra al menos una
   vez, si no la entrada vieja queda huérfana e ilegible para siempre. */

async function adoptOrphanEntries() {
  try {
    const snap = await getDocs(collection(db, "entries"));
    const orphans = snap.docs.filter((d) => !d.data().uid);
    for (const d of orphans) {
      await updateDoc(doc(db, "entries", d.id), { uid: currentUid });
    }
    if (orphans.length) {
      console.info("Migradas " + orphans.length + " entrada(s) vieja(s) a tu cuenta.");
    }
  } catch (err) {
    console.warn("No se pudieron migrar entradas antiguas sin uid:", err);
  }
}

/* ---------- Firestore: sincronización en tiempo real ---------- */

let unsubscribe = null;

function subscribeEntries() {
  if (unsubscribe) return;
  const q = query(
    collection(db, "entries"),
    where("uid", "==", currentUid),
    orderBy("updatedAt", "desc")
  );
  unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      state.entries = snapshot.docs.map((d) => {
        const data = d.data({ serverTimestamps: "estimate" });
        const ts = data.updatedAt;
        return {
          id: d.id,
          ...data,
          _pending: d.metadata.hasPendingWrites,
          _sortKey: ts && typeof ts.toMillis === "function" ? ts.toMillis() : 0
        };
      });
      state.ready = true;
      actualizarPerfilDesdeEntries();
      setConn(navigator.onLine ? "online" : "offline", navigator.onLine ? "En línea" : "Sin conexión — se guardará al reconectar");
      renderDesdeSnapshot();
    },
    (err) => {
      setConn("error", "Error de conexión con el cuaderno");
      console.error(err);
    }
  );
}

// "formulario" es una colección propia (no una "section" dentro de
// "entries"), así que tiene su propia suscripción en tiempo real. No
// necesita pasar por adoptOrphanEntries: es una colección nueva, nunca
// tuvo documentos huérfanos de una versión anterior de la app.
let unsubscribeFormulario = null;

function subscribeFormulario() {
  if (unsubscribeFormulario) return;
  const q = query(collection(db, "formulario"), where("uid", "==", currentUid));
  unsubscribeFormulario = onSnapshot(
    q,
    (snapshot) => {
      state.formulario = snapshot.docs.map((d) => {
        const data = d.data({ serverTimestamps: "estimate" });
        return { id: d.id, ...data, _pending: d.metadata.hasPendingWrites };
      });
      renderDesdeSnapshot();
    },
    (err) => {
      console.error(err);
    }
  );
}

/* ---------- Perfil del veterinario ----------
   El perfil vive como un documento mas dentro de "entries", con
   section: "profile" y un id determinista ("profile_<uid>"), asi que lo
   cubren las mismas reglas de seguridad que ya estan publicadas y no puede
   duplicarse. Como las listas se arman con entriesForSection("casos" |
   "materias"), este documento nunca aparece entre los casos ni las materias.

   NO se crea al iniciar sesion. Antes habia un ensureProfile() que en cada
   arranque escribia el documento con setDoc(merge) y nombre: "" — y merge
   NO ignora los campos que le pasas: los sobrescribe. Resultado: cada vez
   que recargabas la pagina, el nombre guardado se borraba solo. Ahora el
   documento nace con la primera tecla que escribes en Configuracion, via
   scheduleSave(..., { createIfMissing: true }), que solo escribe el campo
   que tocaste. */
function profileDocId() {
  return "profile_" + currentUid;
}

// Se llama desde el snapshot de "entries": el perfil llega por la misma
// suscripcion que todo lo demas, sin listener aparte.
function actualizarPerfilDesdeEntries() {
  const doc_ = state.entries.find((e) => e.section === "profile");
  state.profile = doc_ || null;
  renderSidebarIdentity();
}

// Pie del sidebar: nombre y título si el perfil ya está lleno, con el correo
// como línea secundaria. Si no ha llenado nada, se ve solo el correo, igual
// que antes — no se le obliga a completar el perfil.
function renderSidebarIdentity() {
  if (!els.sidebarIdentity) return;
  const nombre = state.profile && state.profile.nombre ? String(state.profile.nombre).trim() : "";
  const titulo = state.profile && state.profile.titulo ? String(state.profile.titulo).trim() : "";

  // La condicion es tener NOMBRE, no titulo: el campo de titulo arranca con
  // "Medico Veterinario" precargado, asi que si bastara el titulo el bloque
  // apareceria sin haber llenado nada. Sin nombre se deja el pie como
  // estaba: solo el correo.
  if (!nombre) {
    els.sidebarIdentity.hidden = true;
    els.sidName.textContent = "";
    els.sidTitle.textContent = "";
    els.authUser.classList.remove("as-secondary");
    return;
  }

  els.sidebarIdentity.hidden = false;
  els.sidName.textContent = "Mv. " + nombre;
  els.sidName.hidden = false;

  // El titulo solo se muestra aparte cuando aporta algo: si quedo en el valor
  // por defecto, "Mv." ya lo dice y repetirlo debajo seria ruido.
  const tituloAporta = titulo && titulo !== TITULO_POR_DEFECTO;
  els.sidTitle.textContent = tituloAporta ? titulo : "";
  els.sidTitle.hidden = !tituloAporta;

  els.authUser.classList.add("as-secondary");
}

/* ---------- Arranque: tres pantallas, no dos ----------
   Antes el HTML mostraba el login por defecto y onAuthStateChanged lo
   escondia despues. Como esa primera respuesta no es instantanea, sin
   conexion se alcanzaba a ver "ingresa tu correo" aunque la sesion
   estuviera guardada: parecia que se habia cerrado sola.

   Ahora arranca una tercera pantalla neutra ("Cargando…") y solo cuando
   auth responde por PRIMERA VEZ se decide entre login y app. El login no
   aparece nunca sin haber confirmado antes que no hay sesion. */
function mostrarPantalla(cual) {
  els.bootGate.hidden = cual !== "cargando";
  els.authGate.hidden = cual !== "login";
  els.app.hidden = cual !== "app";
}

let authResuelto = false;

/* Entrar por el enlace del correo es el otro caso donde el login parpadea:
   auth responde null primero y la sesion se crea un instante despues, al
   canjear el enlace. Si venimos de un enlace, se sigue esperando. */
const entrandoPorEnlace = isSignInWithEmailLink(auth, window.location.href);

/* Diagnostico de arranque. Los tiempos son desde que empezo a ejecutarse
   este modulo, para poder medir cuanto tarda auth en resolver sin red. */
const tModulo = performance.now();

function logAuth(texto) {
  console.log("[auth +" + Math.round(performance.now() - tModulo) + "ms] " + new Date().toISOString() + " — " + texto);
}

logAuth(
  "registrando onAuthStateChanged (online=" + navigator.onLine + ", por enlace de correo=" + entrandoPorEnlace + ")"
);

onAuthStateChanged(auth, (user) => {
  logAuth(
    (authResuelto ? "cambio de sesion" : "PRIMERA respuesta") + ": user=" + (user ? user.email || user.uid : "null")
  );

  if (user) {
    currentUid = user.uid;
    mostrarPantalla("app");
    authResuelto = true;
    if (els.authUser) {
      els.authUser.hidden = false;
      els.authUser.textContent = user.email || "Sesión activa";
    }
    setConn("offline", "Conectando…");
    render();
    adoptOrphanEntries().then(subscribeEntries);
    subscribeFormulario();
    // Al entrar tambien se intenta vaciar la cola: si cerraste la app sin
    // señal, el evento "online" ya paso y nadie lo escucho.
    procesarColaFotos();
  } else {
    currentUid = null;
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
    if (unsubscribeFormulario) {
      unsubscribeFormulario();
      unsubscribeFormulario = null;
    }
    state.entries = [];
    state.formulario = [];
    state.profile = null;
    state.ready = false;

    // Venimos del enlace del correo y auth todavia no lo ha canjeado: no es
    // "no hay sesion", es "aun no la hay". Se queda en la pantalla de
    // arranque hasta que completeSignInIfNeeded() resuelva.
    if (!authResuelto && entrandoPorEnlace) {
      els.bootMsg.textContent = "Completando acceso…";
      logAuth("null pero hay enlace de correo: sigo esperando");
    } else {
      mostrarPantalla("login");
      authResuelto = true;
    }

    if (els.authUser) els.authUser.hidden = true;
    renderSidebarIdentity();
  }
});

completeSignInIfNeeded();

/* ---------- PWA: registrar service worker (requisito para instalar) ---------- */

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {
      /* si falla el registro, el cuaderno sigue funcionando igual en el navegador */
    });
  });
}

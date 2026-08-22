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

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

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
    f.dosis.some((d) => viasDe(d.via).some((v) => incluyeNormalizado(v, q)) || incluyeNormalizado(d.indicacion, q)) ||
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
/* Diagnostico de fotos. Igual que el de arranque: etapa + milisegundos,
   para poder ver EN QUE PASO se queda una subida en vez de adivinar. */
function logFoto(texto) {
  console.log("[foto " + new Date().toISOString().slice(11, 23) + "] " + texto);
}

/* Si la compresion no termina en este tiempo, se sube el original. Mas vale
   subir 4 MB que no subir nada. */
const TIMEOUT_COMPRESION = 15000;

/* ATENCION — este era el bug de "Subiendo… para siempre".

   La version anterior tenia onload y onerror, y aun asi podia dejar la
   promesa sin resolver NUNCA:

     - getContext("2d") devuelve null cuando el navegador se queda sin
       memoria de canvas (habitual en el celular con fotos de 12 MP). La
       linea siguiente, ctx.drawImage(...), lanza TypeError DENTRO del
       onload. Ese throw no lo recoge nadie: la promesa se queda colgada.
     - drawImage y canvas.width tambien lanzan con imagenes muy grandes.
     - toBlob puede no llamar jamas a su callback en algunos WebView de
       Android.

   Y como compressImage corre ANTES de guardar, no habia ningun vigilante
   posterior que pudiera cortar el cuelgue. La
   foto se quedaba en "Subiendo…" indefinidamente, sin error, sin alerta y
   sin forma de saber por que.

   Ahora la promesa se resuelve SIEMPRE, por una de cuatro vias: exito,
   error de decodificacion, excepcion, o tiempo agotado. En los tres
   ultimos casos devuelve el archivo original, que se sube igual. */
function compressImage(file, maxDim, quality) {
  return new Promise((resolve) => {
    if (!file.type || !file.type.startsWith("image/")) {
      logFoto("no es imagen decodificable, se sube tal cual: " + file.type);
      resolve(file);
      return;
    }

    const url = URL.createObjectURL(file);
    const img = new Image();
    let resuelto = false;

    function terminar(resultado, motivo) {
      if (resuelto) return;
      resuelto = true;
      clearTimeout(temporizador);
      URL.revokeObjectURL(url);
      img.onload = null;
      img.onerror = null;
      logFoto("compresión: " + motivo);
      resolve(resultado);
    }

    // El backstop. Cubre cualquier cuelgue futuro que no hayamos previsto.
    const temporizador = setTimeout(
      () => terminar(file, "se agotó el tiempo (" + TIMEOUT_COMPRESION / 1000 + "s), se sube el original"),
      TIMEOUT_COMPRESION
    );

    img.onload = () => {
      try {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;
        if (!width || !height) {
          terminar(file, "el navegador no dio dimensiones, se sube el original");
          return;
        }
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
        if (!ctx) {
          // Sin memoria de canvas. Antes esto reventaba en la linea de abajo.
          terminar(file, "sin contexto de canvas (memoria), se sube el original");
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => terminar(blob || file, blob ? "ok, " + Math.round(blob.size / 1024) + " KB" : "toBlob vacío, original"),
          "image/jpeg",
          quality
        );
      } catch (err) {
        terminar(file, "excepción (" + (err && err.name) + "), se sube el original");
      }
    };

    img.onerror = () => terminar(file, "el navegador no pudo decodificar el formato, se sube el original");
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

/* ---------- Fotos en Firestore ----------

   Storage quedo descartado: Firebase ya no lo ofrece en el plan gratuito, y
   en Ecuador exige un prepago de USD 30. El bucket nunca llego a existir —
   por eso las subidas se quedaban en "Subiendo…" sin dar error: el SDK
   reintentaba contra un bucket inexistente hasta que saltaba el vigilante.

   Ahora la foto vive dentro de un documento de Firestore, en base64. Eso
   impone el limite de la casa: un documento no pasa de 1 MB, y base64 infla
   un 33%, asi que el JPEG no puede pasar de ~716 KB. Con 1600 px de lado
   mayor y calidad 0.82 la media ronda los 477 KB, que entra con holgura.

   Dos cosas salen gratis de este cambio y conviene no rehacerlas:

   1. La cola de reintentos ya no hace falta. Firestore tiene persistencia
      offline activada, asi que una escritura sin conexion se guarda local y
      se sincroniza sola al volver. La foto aparece al instante, marcada
      como pendiente de sincronizar, y no hay nada que vigilar.
   2. Las fotos NO viajan en el listener global de "entries". Van en su
      propia coleccion y se piden solo al abrir un caso, para que la cache
      del telefono no cargue con las fotos de todos los casos a la vez. */

const LIMITE_BASE64 = 1000000; // margen bajo el 1 MB real del documento
const MAX_LADO_FOTO = 1600;
const CALIDAD_FOTO = 0.82;

/* Un solo campo para filtrar. Con uid y entryId por separado Firestore
   pediria un indice compuesto; concatenados es una igualdad simple que
   funciona sin configurar nada en la consola. */
function claveFotos(entryId) {
  return currentUid + "__" + entryId;
}

function blobADataURL(blob) {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => resolve(lector.result);
    lector.onerror = () => reject(lector.error || new Error("no se pudo leer el archivo"));
    lector.readAsDataURL(blob);
  });
}

/* Comprime y, si aun asi no entra en el documento, baja la calidad por
   pasos. Sin esto una foto especialmente detallada reventaria el limite y
   Firestore la rechazaria con un error que no dice nada util. */
async function prepararFotoParaFirestore(file) {
  let calidad = CALIDAD_FOTO;
  let lado = MAX_LADO_FOTO;

  for (let intento = 0; intento < 5; intento++) {
    const blob = await compressImage(file, lado, calidad);
    const dataUrl = await blobADataURL(blob);
    if (dataUrl.length <= LIMITE_BASE64) {
      logFoto("foto lista: " + Math.round(dataUrl.length / 1024) + " KB en base64 (calidad " + calidad + ", " + lado + " px)");
      return dataUrl;
    }
    logFoto("no entra (" + Math.round(dataUrl.length / 1024) + " KB), bajando calidad");
    calidad = Math.max(0.5, calidad - 0.12);
    lado = Math.max(900, Math.round(lado * 0.85));
  }
  throw new Error("foto-demasiado-grande");
}

// Las fotos de un caso, ordenadas por antiguedad.
/* OJO con el filtro por uid: parece redundante porque "uidEntrada" ya lleva
   el uid dentro, y no lo es.

   Las reglas de seguridad de Firestore NO son filtros. En una consulta de
   lista, Firestore exige que la propia consulta demuestre que solo puede
   devolver documentos permitidos; no evalua la regla documento a documento.
   La regla dice "uid == request.auth.uid", asi que la consulta tiene que
   restringir el campo "uid" explicitamente. Filtrando solo por uidEntrada,
   Firestore no puede demostrarlo y rechaza la consulta entera con
   permission-denied — que es lo que hacia aparecer "Falta publicar las
   reglas" aunque las reglas estuvieran publicadas y correctas.

   Dos filtros de igualdad no necesitan indice compuesto: Firestore los
   resuelve combinando los indices de campo unico. */
function fotosDeEntrada(entryId) {
  return getDocs(
    query(
      collection(db, "fotos"),
      where("uid", "==", currentUid),
      where("uidEntrada", "==", claveFotos(entryId))
    )
  ).then((snap) =>
    snap.docs
      .map((d) => ({ id: d.id, ...d.data({ serverTimestamps: "estimate" }), _pending: d.metadata.hasPendingWrites }))
      .sort((a, b) => (a.orden || 0) - (b.orden || 0))
  );
}

async function guardarFoto(entryId, file) {
  const datos = await prepararFotoParaFirestore(file);
  const ref = await addDoc(collection(db, "fotos"), {
    uid: currentUid,
    entryId,
    uidEntrada: claveFotos(entryId),
    nombre: file.name || "foto.jpg",
    datos,
    orden: Date.now(),
    createdAt: serverTimestamp()
  });
  return { id: ref.id, nombre: file.name || "foto.jpg", datos };
}

/* Rescate de la cola vieja. Las fotos que quedaron atrapadas intentando
   subir a Storage siguen guardadas en IndexedDB con su blob intacto: se
   pasan a Firestore y se sacan de la cola. Se ejecuta una vez al entrar y
   despues la base se borra sola, porque ya no la usa nadie. */
const FOTOS_DB_VIEJA = "vetdiario-fotos-pendientes";

async function rescatarFotosAtrapadas() {
  if (!currentUid) return;
  let registros = [];
  try {
    registros = await new Promise((resolve, reject) => {
      const req = indexedDB.open(FOTOS_DB_VIEJA);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const db_ = req.result;
        if (!db_.objectStoreNames.contains("pendientes")) {
          db_.close();
          resolve([]);
          return;
        }
        const tx = db_.transaction("pendientes", "readonly");
        const todo = tx.objectStore("pendientes").getAll();
        todo.onsuccess = () => {
          db_.close();
          resolve(todo.result || []);
        };
        todo.onerror = () => {
          db_.close();
          reject(todo.error);
        };
      };
    });
  } catch (err) {
    return; // la base no existe: no habia nada atrapado
  }

  const mias = registros.filter((r) => r.uid === currentUid && r.blob);
  if (!mias.length) {
    indexedDB.deleteDatabase(FOTOS_DB_VIEJA);
    return;
  }

  logFoto("rescatando " + mias.length + " foto(s) que se quedaron sin subir");
  let rescatadas = 0;
  for (const reg of mias) {
    try {
      await guardarFoto(reg.entryId, new File([reg.blob], reg.name || "foto.jpg", { type: reg.blob.type || "image/jpeg" }));
      rescatadas++;
    } catch (err) {
      logFoto("no se pudo rescatar " + reg.name + ": " + ((err && err.message) || err));
    }
  }
  if (rescatadas) {
    showToast(rescatadas === 1 ? "Se recuperó 1 foto pendiente" : "Se recuperaron " + rescatadas + " fotos pendientes");
    render();
  }
  // Solo se borra la cola si TODAS se salvaron; si alguna fallo, se
  // conserva para reintentar en el proximo arranque.
  if (rescatadas === mias.length) indexedDB.deleteDatabase(FOTOS_DB_VIEJA);
}

/* ---------- Visor de fotos con zoom ----------

   Una radiografia mirada en un mosaico de 90 px no sirve para nada. Al tocar
   una foto se abre a pantalla completa y desde ahi se puede acercar.

   Va con Pointer Events y no con eventos de raton y de tactil por separado:
   el navegador los unifica, asi que arrastrar con el dedo y arrastrar con el
   raton son el mismo codigo. El pellizco necesita dos punteros a la vez, y
   para eso se guardan en un Map.

   El zoom se aplica con transform sobre el <img>. Se hace en un solo paso
   (translate + scale) y no anidando elementos, porque encadenar transforms
   acumula errores de redondeo al arrastrar. */

const ZOOM_MIN = 1;
const ZOOM_MAX = 8;

let visorFotoEl = null;
let visorFotoEsc = null;

function cerrarVisorFoto() {
  if (visorFotoEl) {
    visorFotoEl.remove();
    visorFotoEl = null;
  }
  if (visorFotoEsc) {
    document.removeEventListener("keydown", visorFotoEsc);
    visorFotoEsc = null;
  }
}

function abrirVisorFoto(lista, indiceInicial) {
  cerrarVisorFoto();

  let indice = indiceInicial;
  let escala = 1;
  let despX = 0;
  let despY = 0;

  const backdrop = document.createElement("div");
  backdrop.className = "overlay-backdrop visor-foto";
  // Cerrar tocando el fondo, pero solo si no estabas arrastrando: si no, al
  // soltar el dedo fuera de la imagen se cerraria el visor cada vez.
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop && !huboArrastre) cerrarVisorFoto();
  });

  const marco = document.createElement("div");
  marco.className = "visor-marco";

  const img = document.createElement("img");
  img.className = "visor-img";
  img.alt = "";
  img.draggable = false;
  marco.appendChild(img);

  function aplicarTransform() {
    img.style.transform = "translate(" + despX + "px, " + despY + "px) scale(" + escala + ")";
    img.style.cursor = escala > 1 ? "grab" : "zoom-in";
    marco.classList.toggle("con-zoom", escala > 1);
    if (btnMenos) btnMenos.disabled = escala <= ZOOM_MIN;
    if (btnMas) btnMas.disabled = escala >= ZOOM_MAX;
    if (nivel) nivel.textContent = Math.round(escala * 100) + "%";
  }

  /* Limita el desplazamiento para que la imagen no se pueda arrastrar fuera
     de la pantalla y desaparecer. El margen disponible es lo que sobresale
     del marco al estar ampliada. */
  function limitarDesplazamiento() {
    const r = marco.getBoundingClientRect();
    const anchoSobra = Math.max(0, (img.clientWidth * escala - r.width) / 2);
    const altoSobra = Math.max(0, (img.clientHeight * escala - r.height) / 2);
    despX = Math.max(-anchoSobra, Math.min(anchoSobra, despX));
    despY = Math.max(-altoSobra, Math.min(altoSobra, despY));
  }

  // Acerca manteniendo fijo el punto que estas señalando, que es lo que
  // espera la mano: si haces zoom sobre una lesion, la lesion no se escapa.
  function zoomEn(nuevaEscala, puntoX, puntoY) {
    const previa = escala;
    escala = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, nuevaEscala));
    if (escala === previa) return;

    const r = marco.getBoundingClientRect();
    const cx = puntoX - r.left - r.width / 2;
    const cy = puntoY - r.top - r.height / 2;
    const factor = escala / previa;
    despX = cx - (cx - despX) * factor;
    despY = cy - (cy - despY) * factor;

    if (escala === 1) {
      despX = 0;
      despY = 0;
    }
    limitarDesplazamiento();
    aplicarTransform();
  }

  function reiniciarZoom() {
    escala = 1;
    despX = 0;
    despY = 0;
    aplicarTransform();
  }

  function mostrar(i) {
    indice = (i + lista.length) % lista.length;
    const foto = lista[indice];
    img.src = foto.datos;
    img.alt = foto.nombre || "Foto";
    reiniciarZoom();
    if (contador) contador.textContent = lista.length > 1 ? indice + 1 + " / " + lista.length : "";
    if (titulo) titulo.textContent = foto.nombre || "";
  }

  /* ---- Punteros: arrastrar con uno, pellizcar con dos ---- */
  const punteros = new Map();
  let distanciaInicial = 0;
  let escalaInicial = 1;
  let huboArrastre = false;

  marco.addEventListener("pointerdown", (e) => {
    punteros.set(e.pointerId, { x: e.clientX, y: e.clientY });
    huboArrastre = false;
    if (punteros.size === 2) {
      const [a, b] = Array.from(punteros.values());
      distanciaInicial = Math.hypot(a.x - b.x, a.y - b.y);
      escalaInicial = escala;
    }
    marco.setPointerCapture(e.pointerId);
  });

  marco.addEventListener("pointermove", (e) => {
    if (!punteros.has(e.pointerId)) return;
    const previo = punteros.get(e.pointerId);
    punteros.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (punteros.size === 2) {
      const [a, b] = Array.from(punteros.values());
      const distancia = Math.hypot(a.x - b.x, a.y - b.y);
      if (distanciaInicial > 0) {
        huboArrastre = true;
        zoomEn(escalaInicial * (distancia / distanciaInicial), (a.x + b.x) / 2, (a.y + b.y) / 2);
      }
      return;
    }

    // Arrastrar solo tiene sentido con la imagen ampliada.
    if (escala <= 1) return;
    const dx = e.clientX - previo.x;
    const dy = e.clientY - previo.y;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) huboArrastre = true;
    despX += dx;
    despY += dy;
    limitarDesplazamiento();
    aplicarTransform();
  });

  function soltarPuntero(e) {
    punteros.delete(e.pointerId);
    if (punteros.size < 2) distanciaInicial = 0;
  }
  marco.addEventListener("pointerup", soltarPuntero);
  marco.addEventListener("pointercancel", soltarPuntero);

  // Rueda del raton: acercar y alejar sobre el cursor.
  marco.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      zoomEn(escala * (e.deltaY < 0 ? 1.18 : 1 / 1.18), e.clientX, e.clientY);
    },
    { passive: false }
  );

  // Doble toque o doble clic: alternar entre ajustada y 3x, que es el gesto
  // que todo el mundo intenta primero.
  marco.addEventListener("dblclick", (e) => {
    e.preventDefault();
    if (escala > 1) reiniciarZoom();
    else zoomEn(3, e.clientX, e.clientY);
  });

  // Un clic simple sobre la imagen sin zoom tambien acerca: en el celular
  // el doble toque es incomodo con una mano.
  img.addEventListener("click", (e) => {
    if (huboArrastre) return;
    if (escala === 1) zoomEn(2.5, e.clientX, e.clientY);
  });

  /* ---- Barra de controles ---- */
  const barra = document.createElement("div");
  barra.className = "visor-barra";

  const titulo = document.createElement("span");
  titulo.className = "visor-titulo";

  const contador = document.createElement("span");
  contador.className = "visor-contador";

  function botonVisor(texto, etiqueta, alPulsar) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "visor-btn";
    b.textContent = texto;
    b.setAttribute("aria-label", etiqueta);
    b.addEventListener("click", alPulsar);
    return b;
  }

  const centro = () => {
    const r = marco.getBoundingClientRect();
    return [r.left + r.width / 2, r.top + r.height / 2];
  };

  const btnMenos = botonVisor("−", "Alejar", () => zoomEn(escala / 1.4, ...centro()));
  const nivel = document.createElement("span");
  nivel.className = "visor-nivel";
  const btnMas = botonVisor("+", "Acercar", () => zoomEn(escala * 1.4, ...centro()));
  const btnReset = botonVisor("⟲", "Restablecer zoom", reiniciarZoom);

  const cerrar = document.createElement("button");
  cerrar.type = "button";
  cerrar.className = "visor-btn visor-cerrar";
  cerrar.textContent = "×";
  cerrar.setAttribute("aria-label", "Cerrar");
  cerrar.addEventListener("click", cerrarVisorFoto);

  barra.appendChild(titulo);
  barra.appendChild(contador);
  barra.appendChild(btnMenos);
  barra.appendChild(nivel);
  barra.appendChild(btnMas);
  barra.appendChild(btnReset);
  barra.appendChild(cerrar);

  // Flechas solo si hay mas de una foto.
  if (lista.length > 1) {
    const anterior = botonVisor("‹", "Foto anterior", () => mostrar(indice - 1));
    anterior.classList.add("visor-nav", "visor-nav-izq");
    const siguiente = botonVisor("›", "Foto siguiente", () => mostrar(indice + 1));
    siguiente.classList.add("visor-nav", "visor-nav-der");
    backdrop.appendChild(anterior);
    backdrop.appendChild(siguiente);
  }

  backdrop.appendChild(barra);
  backdrop.appendChild(marco);
  document.body.appendChild(backdrop);
  visorFotoEl = backdrop;

  visorFotoEsc = (e) => {
    if (e.key === "Escape") cerrarVisorFoto();
    else if (e.key === "ArrowLeft" && lista.length > 1) mostrar(indice - 1);
    else if (e.key === "ArrowRight" && lista.length > 1) mostrar(indice + 1);
    else if (e.key === "+" || e.key === "=") zoomEn(escala * 1.4, ...centro());
    else if (e.key === "-") zoomEn(escala / 1.4, ...centro());
    else if (e.key === "0") reiniciarZoom();
  };
  document.addEventListener("keydown", visorFotoEsc);

  mostrar(indice);
  cerrar.focus();
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

  // Copia local: la ficha abierta no se redibuja con los snapshots, asi que
  // esta lista es la fuente de verdad mientras este montada.
  let fotos = [];
  let cargando = true;

  function renderGrid() {
    grid.innerHTML = "";

    if (cargando) {
      const esperando = document.createElement("div");
      esperando.className = "photos-cargando";
      esperando.textContent = "Cargando fotos…";
      grid.appendChild(esperando);
      return;
    }

    fotos.forEach((foto) => {
      const tile = document.createElement("div");
      tile.className = "photo-tile";

      const img = document.createElement("img");
      img.src = foto.datos;
      img.alt = foto.nombre || "Foto";
      img.loading = "lazy";
      // Abrir el visor a pantalla completa. Solo las fotos ya guardadas: una
      // que todavia se esta subiendo no tiene nada que ampliar.
      if (!foto.subiendo) {
        img.style.cursor = "zoom-in";
        img.addEventListener("click", () => {
          const verEstas = fotos.filter((f) => !f.subiendo);
          abrirVisorFoto(verEstas, verEstas.indexOf(foto));
        });
      }
      tile.appendChild(img);

      if (foto.subiendo) {
        const spin = document.createElement("div");
        spin.className = "photo-uploading";
        spin.textContent = "Guardando…";
        tile.appendChild(spin);
      } else {
        if (foto._pending) {
          // Firestore la tiene en local y la subira sola. No es un error ni
          // requiere nada del usuario: es informacion, no una alarma.
          const marca = document.createElement("div");
          marca.className = "photo-sinsync";
          marca.textContent = "Sin sincronizar";
          tile.appendChild(marca);
        }
        const del = document.createElement("button");
        del.type = "button";
        del.className = "photo-remove";
        del.textContent = "×";
        del.setAttribute("aria-label", "Eliminar foto");
        del.addEventListener("click", async () => {
          const ok = await askConfirm({
            title: "¿Eliminar esta foto?",
            message: "Se borra definitivamente y no se puede deshacer.",
            confirmLabel: "Eliminar"
          });
          if (!ok) return;
          tile.style.opacity = "0.4";
          fotos = fotos.filter((f) => f !== foto);
          renderGrid();
          try {
            await deleteDoc(doc(db, "fotos", foto.id));
          } catch (err) {
            logFoto("no se pudo borrar la foto: " + ((err && err.code) || err));
          }
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

  renderGrid();

  fotosDeEntrada(entry.id)
    .then((lista) => {
      cargando = false;
      // Puede haber llegado una foto nueva mientras cargaba: no se pisan.
      const nuevas = fotos.filter((f) => !lista.some((l) => l.id === f.id));
      fotos = lista.concat(nuevas);
      renderGrid();
    })
    .catch((err) => {
      cargando = false;
      logFoto("no se pudieron cargar las fotos: " + ((err && err.code) || err));
      renderGrid();
      if (statusText) {
        statusText.parentElement.setAttribute("data-state", "error");
        statusText.textContent =
          err && err.code === "permission-denied"
            ? "Falta publicar las reglas de la colección fotos"
            : "No se pudieron cargar las fotos";
      }
    });

  fileInput.addEventListener("change", async () => {
    const archivos = Array.from(fileInput.files || []);
    fileInput.value = "";

    for (const file of archivos) {
      logFoto("archivo: " + file.name + " · " + file.type + " · " + Math.round(file.size / 1024) + " KB");
      const provisional = { id: "tmp-" + Date.now(), nombre: file.name, datos: URL.createObjectURL(file), subiendo: true };
      fotos.push(provisional);
      renderGrid();

      try {
        const guardada = await guardarFoto(entry.id, file);
        URL.revokeObjectURL(provisional.datos);
        const i = fotos.indexOf(provisional);
        // _pending: sin conexion, Firestore la guarda local y la sincroniza
        // despues; con conexion ya esta arriba.
        const registro = { ...guardada, _pending: !navigator.onLine };
        if (i > -1) fotos[i] = registro;
        else fotos.push(registro);
        renderGrid();
      } catch (err) {
        URL.revokeObjectURL(provisional.datos);
        fotos = fotos.filter((f) => f !== provisional);
        renderGrid();
        logFoto("falló al guardar: " + ((err && err.code) || (err && err.message) || err));
        alert(
          err && err.message === "foto-demasiado-grande"
            ? "“" + file.name + "” es demasiado grande incluso comprimida. Prueba con una captura de menor resolución."
            : "No se pudo guardar “" + file.name + "”. " + ((err && err.code) === "permission-denied"
                ? "Faltan las reglas de la colección “fotos” en Firestore."
                : "Intenta de nuevo.")
        );
      }
    }
  });

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

  /* Dosis a usar. Antes la calculadora imponía el punto medio del rango, y
     eso volvía inútil el aviso de "fuera de rango": el punto medio de un
     rango válido SIEMPRE cae dentro. El aviso solo podía saltar con datos
     corruptos, que es justo lo contrario de para lo que estaba.

     Ahora se propone el punto medio pero se puede cambiar, que es como se
     trabaja de verdad: la etiqueta da un rango y tú eliges dentro de él
     según el caso. Y si te sales, el aviso por fin significa algo. */
  const dosisField = document.createElement("div");
  dosisField.className = "calc-field";
  dosisField.hidden = true;
  const dosisLabel = document.createElement("label");
  dosisLabel.textContent = "Dosis a usar";
  const dosisInput = document.createElement("input");
  dosisInput.type = "number";
  dosisInput.step = "any";
  dosisInput.min = "0";
  const dosisPista = document.createElement("div");
  dosisPista.className = "calc-pista";
  dosisField.appendChild(dosisLabel);
  dosisField.appendChild(dosisInput);
  dosisField.appendChild(dosisPista);

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
    /* Si vienes filtrando por una especie, la calculadora arranca en ella.
       Si no, se quedaría en la primera de la lista y tendrías que volver a
       elegirla — justo lo que acabas de decirle a la app. */
    const filtrada = especieActiva();
    if (filtrada && especies.includes(filtrada)) speciesSelect.value = filtrada;
  }

  function updateIndicacionField() {
    indicacionSelect.innerHTML = "";
    const pautas = dosisUtilizables(selectedDrug, speciesSelect.value);
    /* Antes esto se escondía cuando el fármaco tenía una sola pauta, y con
       ello desaparecía la indicación: veías una dosis suelta sin saber PARA
       QUÉ es. Ahora se muestra siempre que haya algo que mostrar; con una
       sola pauta el desplegable simplemente no se despliega, pero la
       indicación queda a la vista. */
    if (!pautas.length) {
      indicacionField.hidden = true;
      return;
    }
    indicacionField.hidden = false;
    indicacionLabel.textContent = pautas.length > 1 ? "Indicación / pauta" : "Indicación";
    pautas.forEach((d, i) => {
      const o = document.createElement("option");
      o.value = String(i);
      const via = viaTexto(d.via);
      o.textContent =
        (d.indicacion || "Pauta " + (i + 1)) +
        " — " +
        d.dosisMin +
        (d.dosisMax !== d.dosisMin ? "–" + d.dosisMax : "") +
        " " +
        d.unidad +
        (via ? " (" + via + ")" : "");
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
      const via = viaTexto(p.via);
      o.textContent =
        (p.nombreComercialLocal || "Presentación " + (i + 1)) +
        " — " +
        p.concentracion +
        " " +
        (p.unidadConc || "") +
        (via ? " · " + via : "");
      presSelect.appendChild(o);
    });
  }

  /* Se repropone al cambiar de pauta: la dosis que elegiste para una
     indicación no tiene por qué valer para otra. */
  function actualizarCampoDosis() {
    const pautas = dosisUtilizables(selectedDrug, speciesSelect.value);
    const pauta = pautas[Number(indicacionSelect.value) || 0] || pautas[0];
    if (!pauta) {
      dosisField.hidden = true;
      return;
    }
    const min = Number(pauta.dosisMin);
    const max = pauta.dosisMax != null && isFinite(pauta.dosisMax) ? Number(pauta.dosisMax) : min;
    dosisField.hidden = false;
    dosisLabel.textContent = "Dosis a usar (" + (pauta.unidad || "mg/kg") + ")";
    dosisInput.value = roundNice((min + max) / 2);
    dosisPista.textContent =
      min === max
        ? "La etiqueta indica " + min + " " + (pauta.unidad || "") + "."
        : "Rango de etiqueta: " + Math.min(min, max) + " – " + Math.max(min, max) + " " + (pauta.unidad || "") + ".";
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
    /* Un rango al revés (mínimo mayor que máximo) no es un caso raro: basta
       un dedazo al teclear en la ficha. Antes se calculaba igual con un
       punto medio sin sentido y se avisaba de "fuera de rango", que apunta
       al sitio equivocado: el problema no es la dosis, son los datos. */
    if (dosisMax < dosisMin) {
      const bloque = document.createElement("div");
      bloque.className = "calc-aviso";
      bloque.textContent =
        "⚠ El rango de esta pauta está invertido: el mínimo (" +
        dosisMin +
        ") es mayor que el máximo (" +
        dosisMax +
        " " +
        unidad +
        "). Corrígelo en la ficha del fármaco antes de calcular.";
      result.appendChild(bloque);
      if (addBtn) result.appendChild(addBtn);
      return;
    }

    const escrita = parseFloat(dosisInput.value);
    const dosisUsada = isFinite(escrita) && escrita > 0 ? escrita : (dosisMin + dosisMax) / 2;
    const especieCalc = speciesSelect.value;
    const tipoUnidad = tipoDeUnidad(unidad);
    const totalDose = totalSegunUnidad(dosisUsada, unidad, weight, especieCalc);
    const totalMin = totalSegunUnidad(dosisMin, unidad, weight, especieCalc);
    const totalMax = totalSegunUnidad(dosisMax, unidad, weight, especieCalc);

    const especieNota = especieCalc ? " (" + especieCalc + ")" : "";
    const rangoNota = dosisMin !== dosisMax ? " (rango " + dosisMin + "–" + dosisMax + ")" : "";
    if (tipoUnidad === "fija") {
      // Sin "peso ×": esta pauta no depende del peso y decir lo contrario
      // invitaria a recalcular a mano.
      addLine("Dosis fija" + especieNota + " = " + roundNice(dosisUsada) + " " + unidad + rangoNota);
      addLine("El peso no interviene: la etiqueta pauta por animal.", "calc-line-suave");
    } else if (tipoUnidad === "superficie") {
      const sc = superficieCorporal(weight, especieCalc);
      addLine("Superficie corporal = " + roundNice(sc) + " m² (para " + weight + " kg)");
      addLine("Dosis" + especieNota + " = " + roundNice(sc) + " m² × " + roundNice(dosisUsada) + " " + unidad + rangoNota);
    } else {
      addLine("Dosis" + especieNota + " = " + weight + " kg × " + roundNice(dosisUsada) + " " + unidad + rangoNota);
    }

    const totalText = roundNice(totalDose) + " " + massUnit;
    addLine("= " + totalText, "calc-total");
    if (dosisMin !== dosisMax) {
      addLine("Rango total: " + roundNice(totalMin) + " – " + roundNice(totalMax) + " " + massUnit, "calc-line-suave");
    }

    lastSummaryLine =
      selectedDrug.nombreGenerico +
      (pauta.indicacion ? " (" + pauta.indicacion + ")" : "") +
      ": " + weight + " kg × " + roundNice(dosisUsada) + " " + unidad + especieNota;
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
    const dosisEfectiva = dosisUsada;
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

    if (pauta.indicacion) addLine("Indicación: " + pauta.indicacion, "calc-line-suave");
    const viasPauta = viaTexto(pauta.via);
    if (viasPauta) addLine("Vía: " + viasPauta, "calc-line-suave");
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
    actualizarCampoDosis();
    renderResult();
  });
  speciesSelect.addEventListener("change", () => {
    updateIndicacionField();
    actualizarCampoDosis();
    renderResult();
  });
  indicacionSelect.addEventListener("change", () => {
    actualizarCampoDosis();
    renderResult();
  });
  dosisInput.addEventListener("input", renderResult);
  presSelect.addEventListener("change", renderResult);
  weightInput.addEventListener("input", renderResult);

  wrap.appendChild(nameField);
  wrap.appendChild(speciesField);
  wrap.appendChild(indicacionField);
  wrap.appendChild(dosisField);
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

/* ================= Calculadora de fluidos =================

   Segunda pestaña del mismo overlay que la calculadora de dosis. Las
   cifras salen de los apuntes de Clínica y Cirugía de Pequeñas Especies I
   (UTE), Unidad III — Terapia de fluidos 2024, que a su vez recogen las
   tablas de valoración y dosificación de Silverstein & Hopper.

   Las tres etapas de la diapositiva son independientes y se suman en un
   plan único:

     Reanimación   bolo rápido, solo si hay signos de shock  (15-30 min)
     Rehidratación deficit = peso x % deshidratacion         (12-24 h)
     Mantenimiento lo que el animal gasta al día             (24 h)

   El deficit es aritmética pura y no depende de la especie. El bolo y el
   mantenimiento SÍ, y las diapositivas solo dan cifras de perro y gato:
   por eso la especie aquí se limita a esas dos. */

const FLUIDOS_BOLO = {
  canino: { min: 15, max: 20 },
  felino: { min: 5, max: 10 }
};
const FLUIDOS_BOLO_MIN_MIN = 15;
const FLUIDOS_BOLO_MAX_MIN = 30;

/* Los tramos de deshidratación son los de la exploración física: no se
   mide, se estima mirando al paciente. Se propone el punto medio del
   tramo y se puede corregir a mano — igual que en la calculadora de
   dosis, y por la misma razón: si el número lo impone la app, los avisos
   de "esto es mucho" no pueden saltar nunca. */
const FLUIDOS_GRADOS = [
  { pct: 0, texto: "Menos del 5% — no se aprecia nada en la exploración" },
  { pct: 5.5, texto: "5–6% — el pliegue cutáneo tarda un poco en volver" },
  { pct: 7, texto: "6–8% — pliegue claramente lento, mucosas secas" },
  { pct: 9, texto: "8–10% — pliegue muy lento, globos oculares hundidos" },
  { pct: 11, texto: "10–12% — el pliegue no vuelve, córnea apagada, ya hay signos de hipovolemia" },
  { pct: 12, texto: "Más del 12% — shock hipovolémico" }
];

/* Las tres fórmulas de mantenimiento de la diapositiva. Dan resultados
   MUY distintos entre sí (en un perro de 10 kg: 600, 742 y 370 mL/día),
   así que se muestran las tres a la vez y se elige cuál entra en el plan.
   Esconder dos de ellas daría una falsa sensación de precisión.

   Ojo con la tercera: la diapositiva la rotula "mL/kg/day", pero eso no
   puede ser. En un perro de 10 kg saldrían 370 mL/kg/día = 3,7 litros al
   día. La fórmula (30 x peso) + 70 devuelve mL/día, no mL/kg/día. */
const FLUIDOS_MANTENIMIENTO = [
  {
    id: "lineal",
    etiqueta: "Lineal — mL/kg/día",
    detalle: function (esp) { return (esp === "felino" ? "40" : "60") + " mL/kg/día × peso"; },
    calc: function (p, esp) { return (esp === "felino" ? 40 : 60) * p; }
  },
  {
    id: "alometrica",
    etiqueta: "Alométrica — peso elevado a 0,75",
    detalle: function (esp) { return (esp === "felino" ? "80" : "132") + " × peso^0,75"; },
    calc: function (p, esp) { return (esp === "felino" ? 80 : 132) * Math.pow(p, 0.75); }
  },
  {
    id: "lineal70",
    etiqueta: "(30 × peso) + 70",
    detalle: function () { return "(30 × peso) + 70 mL/día"; },
    calc: function (p) { return 30 * p + 70; }
  }
];

// Pediátrico: la diapositiva multiplica el mantenimiento del adulto.
const FLUIDOS_PEDIATRICO = { canino: 3, felino: 2.5 };

// Equipos de goteo por gravedad. El microgotero es el que se usa en
// gatos y cachorros, donde 1 mL de más importa.
const FLUIDOS_EQUIPOS = [
  { gtt: 20, etiqueta: "Macrogotero — 20 gotas/mL" },
  { gtt: 15, etiqueta: "Macrogotero — 15 gotas/mL" },
  { gtt: 60, etiqueta: "Microgotero — 60 gotas/mL" }
];

const FLUIDOS_FUENTE =
  "Clínica y Cirugía de Pequeñas Especies I (UTE), Unidad III — Terapia de fluidos 2024.";

function buildFluidCalculator(context) {
  const ctx = context || {};
  const wrap = document.createElement("div");
  wrap.className = "calc";

  function campo(etiqueta, control, pista) {
    const d = document.createElement("div");
    d.className = "calc-field";
    const l = document.createElement("label");
    l.textContent = etiqueta;
    d.appendChild(l);
    d.appendChild(control);
    if (pista) {
      const p = document.createElement("div");
      p.className = "calc-pista";
      p.textContent = pista;
      d.appendChild(p);
    }
    return d;
  }

  /* --- Especie --- */
  const especieSelect = document.createElement("select");
  ["canino", "felino"].forEach(function (e) {
    const o = document.createElement("option");
    o.value = e;
    o.textContent = e;
    especieSelect.appendChild(o);
  });
  // Si vienes filtrando por perro o gato, arranca en esa. Con cualquier
  // otra especie no se cambia nada: las cifras no le sirven.
  const espFiltro = especieActiva();
  if (espFiltro === "canino" || espFiltro === "felino") especieSelect.value = espFiltro;

  /* --- Peso --- */
  const pesoInput = document.createElement("input");
  pesoInput.type = "number";
  pesoInput.step = "any";
  pesoInput.min = "0";
  pesoInput.placeholder = "Ej. 12.5";
  const ctxCase = ctx.caseEntry ? currentEntry(ctx.caseEntry) : null;
  if (ctxCase && ctxCase.peso) {
    const p = parseFloat(String(ctxCase.peso).replace(",", "."));
    if (isFinite(p)) pesoInput.value = p;
  }

  /* --- Grado de deshidratación --- */
  const gradoSelect = document.createElement("select");
  FLUIDOS_GRADOS.forEach(function (g, i) {
    const o = document.createElement("option");
    o.value = String(i);
    o.textContent = g.texto;
    gradoSelect.appendChild(o);
  });

  const pctInput = document.createElement("input");
  pctInput.type = "number";
  pctInput.step = "any";
  pctInput.min = "0";
  pctInput.max = "20";
  pctInput.value = "0";

  /* --- Shock --- */
  const shockLabel = document.createElement("label");
  shockLabel.className = "calc-check";
  const shockInput = document.createElement("input");
  shockInput.type = "checkbox";
  shockLabel.appendChild(shockInput);
  shockLabel.appendChild(
    document.createTextNode(" Hay signos de shock: incluir bolo de reanimación")
  );

  /* --- Horas de rehidratación --- */
  const horasInput = document.createElement("input");
  horasInput.type = "number";
  horasInput.step = "1";
  horasInput.min = "1";
  horasInput.value = "24";

  /* --- Fórmula de mantenimiento --- */
  const mantSelect = document.createElement("select");
  FLUIDOS_MANTENIMIENTO.forEach(function (m) {
    const o = document.createElement("option");
    o.value = m.id;
    o.textContent = m.etiqueta;
    mantSelect.appendChild(o);
  });

  /* --- Pediátrico --- */
  const pedLabel = document.createElement("label");
  pedLabel.className = "calc-check";
  const pedInput = document.createElement("input");
  pedInput.type = "checkbox";
  pedLabel.appendChild(pedInput);
  pedLabel.appendChild(document.createTextNode(" Paciente pediátrico"));

  /* --- Pérdidas continuas --- */
  const perdidasInput = document.createElement("input");
  perdidasInput.type = "number";
  perdidasInput.step = "any";
  perdidasInput.min = "0";
  perdidasInput.placeholder = "0";

  /* --- Equipo de goteo --- */
  const equipoSelect = document.createElement("select");
  FLUIDOS_EQUIPOS.forEach(function (e) {
    const o = document.createElement("option");
    o.value = String(e.gtt);
    o.textContent = e.etiqueta;
    equipoSelect.appendChild(o);
  });

  const result = document.createElement("div");
  result.className = "calc-result";

  let resumenPlan = "";
  let fluidAddBtn = null;
  let fluidAddMsg = null;

  function aplicarGrado() {
    const g = FLUIDOS_GRADOS[Number(gradoSelect.value) || 0];
    if (g) pctInput.value = String(g.pct);
    // Un déficit de más del 12% ES shock por definición: la diapositiva
    // lo pauta con bolo antes de rehidratar. Se marca solo, pero se
    // puede desmarcar: la decisión sigue siendo del clínico.
    if (g && g.pct >= 12) shockInput.checked = true;
  }

  function render() {
    result.innerHTML = "";
    if (fluidAddMsg) fluidAddMsg = null;

    function linea(texto, cls) {
      const d = document.createElement("div");
      d.className = cls || "calc-line";
      d.textContent = texto;
      result.appendChild(d);
      return d;
    }
    function titulo(texto) {
      const d = document.createElement("div");
      d.className = "calc-sub";
      d.textContent = texto;
      result.appendChild(d);
    }
    function aviso(texto) {
      const d = document.createElement("div");
      d.className = "calc-aviso";
      d.textContent = texto;
      result.appendChild(d);
    }

    const peso = parseFloat(String(pesoInput.value).replace(",", "."));
    const pct = parseFloat(String(pctInput.value).replace(",", "."));
    const horas = parseFloat(String(horasInput.value).replace(",", "."));
    const perdidas = parseFloat(String(perdidasInput.value).replace(",", ".")) || 0;
    const especie = especieSelect.value;
    const gtt = Number(equipoSelect.value) || 20;

    resumenPlan = "";
    if (fluidAddBtn) fluidAddBtn.disabled = true;

    if (!isFinite(peso) || peso <= 0) {
      const v = document.createElement("div");
      v.className = "calc-empty";
      v.textContent = "Escribe el peso del paciente para calcular el plan.";
      result.appendChild(v);
      return;
    }

    const partes = [];

    /* --- 1. Bolo de reanimación --- */
    let boloMin = 0;
    let boloMax = 0;
    if (shockInput.checked) {
      const b = FLUIDOS_BOLO[especie];
      boloMin = b.min * peso;
      boloMax = b.max * peso;
      titulo("1 · Reanimación (bolo)");
      linea(
        b.min + "–" + b.max + " mL/kg × " + roundNice(peso) + " kg",
        "calc-line"
      );
      linea(
        "= " + roundNice(boloMin) + " – " + roundNice(boloMax) + " mL en " +
          FLUIDOS_BOLO_MIN_MIN + "–" + FLUIDOS_BOLO_MAX_MIN + " min",
        "calc-total"
      );
      linea(
        "Cristaloide isotónico tamponado. Pasado en " + FLUIDOS_BOLO_MIN_MIN + " min son " +
          roundNice((boloMin / FLUIDOS_BOLO_MIN_MIN) * 60) + " – " +
          roundNice((boloMax / FLUIDOS_BOLO_MIN_MIN) * 60) + " mL/h (" +
          roundNice(((boloMin / FLUIDOS_BOLO_MIN_MIN) * 60 * gtt) / 60) + " – " +
          roundNice(((boloMax / FLUIDOS_BOLO_MIN_MIN) * 60 * gtt) / 60) + " gotas/min).",
        "calc-line-suave"
      );
      const gotasBolo = ((boloMax / FLUIDOS_BOLO_MIN_MIN) * 60 * gtt) / 60;
      if (gotasBolo > 100) {
        linea(
          "A ese ritmo no se cuentan gotas: llave abierta, jeringa o bolsa de presión.",
          "calc-line-suave"
        );
      }
      linea(
        "Reevalúa la perfusión al terminar el bolo. Se puede repetir si sigue mal.",
        "calc-line-suave"
      );
      partes.push("bolo " + roundNice(boloMin) + "–" + roundNice(boloMax) + " mL");
    }

    /* --- 2. Déficit de rehidratación --- */
    let deficit = 0;
    if (isFinite(pct) && pct > 0) {
      deficit = peso * (pct / 100) * 1000; // L -> mL
      titulo("2 · Rehidratación (déficit)");
      linea(roundNice(peso) + " kg × " + roundNice(pct) + " % = " + roundNice(deficit / 1000) + " L", "calc-line");
      linea("= " + roundNice(deficit) + " mL a reponer en " + roundNice(horas) + " h", "calc-total");
      partes.push("déficit " + roundNice(deficit) + " mL");
    }

    /* --- 3. Mantenimiento --- */
    const factorPed = pedInput.checked ? FLUIDOS_PEDIATRICO[especie] : 1;
    titulo("3 · Mantenimiento (24 h)");
    let mantElegido = 0;
    FLUIDOS_MANTENIMIENTO.forEach(function (m) {
      const bruto = m.calc(peso, especie);
      const total = bruto * factorPed;
      const elegido = m.id === mantSelect.value;
      if (elegido) mantElegido = total;
      const d = document.createElement("div");
      d.className = elegido ? "calc-mant calc-mant-activa" : "calc-mant";
      const nombre = document.createElement("span");
      nombre.textContent = (elegido ? "▸ " : "   ") + m.detalle(especie);
      const valor = document.createElement("strong");
      valor.textContent = roundNice(total) + " mL/día";
      d.appendChild(nombre);
      d.appendChild(valor);
      result.appendChild(d);
    });
    if (factorPed !== 1) {
      linea(
        "Pediátrico: las tres cifras ya llevan el × " + String(factorPed).replace(".", ",") +
          " de la diapositiva.",
        "calc-line-suave"
      );
    }
    partes.push("mantenimiento " + roundNice(mantElegido) + " mL/día");

    if (perdidas > 0) {
      titulo("4 · Pérdidas continuas");
      linea("+ " + roundNice(perdidas) + " mL/día estimados (vómito, diarrea, poliuria)", "calc-line");
      partes.push("pérdidas " + roundNice(perdidas) + " mL/día");
    }

    /* --- Plan de infusión --- */
    const horasValidas = isFinite(horas) && horas > 0;
    const porHoraDeficit = horasValidas && deficit > 0 ? deficit / horas : 0;
    const porHoraMant = (mantElegido + perdidas) / 24;
    const mlPorHora = porHoraDeficit + porHoraMant;

    titulo("Velocidad de infusión");
    if (deficit > 0 && horasValidas) {
      linea(
        "Déficit " + roundNice(deficit) + " mL ÷ " + roundNice(horas) + " h = " +
          roundNice(porHoraDeficit) + " mL/h",
        "calc-line"
      );
    }
    linea(
      "Mantenimiento" + (perdidas > 0 ? " + pérdidas" : "") + " ÷ 24 h = " +
        roundNice(porHoraMant) + " mL/h",
      "calc-line"
    );
    const gotasMin = (mlPorHora * gtt) / 60;
    linea("= " + roundNice(mlPorHora) + " mL/h", "calc-total");
    linea("= " + roundNice(gotasMin) + " gotas/min con equipo de " + gtt + " gotas/mL", "calc-total");
    linea(
      (gotasMin > 0 ? "Una gota cada " + roundNice(60 / gotasMin) + " s. " : "") +
        "Son " + roundNice(mlPorHora / peso) + " mL/kg/h. Volumen de las primeras " +
        (horasValidas ? roundNice(horas) : "24") + " h: " +
        roundNice(mlPorHora * (horasValidas ? horas : 24)) + " mL.",
      "calc-line-suave"
    );

    if (deficit > 0 && horasValidas) {
      linea(
        "Al terminar la rehidratación, baja a " + roundNice(porHoraMant) + " mL/h (" +
          roundNice((porHoraMant * gtt) / 60) + " gotas/min) para seguir solo con mantenimiento.",
        "calc-line-suave"
      );
    }

    /* --- Avisos que sí pueden saltar --- */
    if (isFinite(pct) && pct >= 12 && !shockInput.checked) {
      aviso(
        "Un déficit del " + roundNice(pct) + " % es shock hipovolémico. La pauta es bolo primero " +
          "y rehidratación después, no rehidratación sola."
      );
    }
    if (horasValidas && (horas < 12 || horas > 24)) {
      aviso(
        "Has puesto " + roundNice(horas) + " h y la pauta de rehidratación es 12–24 h. " +
          "Fuera de esa ventana, comprueba que sea a propósito."
      );
    }
    if (isFinite(pct) && pct > 12) {
      aviso(
        "Más del 12 % de deshidratación no se estima por exploración: a partir de ahí " +
          "el cuadro ya es shock y muerte. Revisa el número."
      );
    }
    // El bolo es la velocidad más alta que contempla la diapositiva. Si el
    // plan de rehidratación la supera, hay un dato mal escrito.
    const limite = (FLUIDOS_BOLO[especie].max / FLUIDOS_BOLO_MIN_MIN) * 60; // mL/kg/h
    if (mlPorHora / peso > limite) {
      aviso(
        "Esta velocidad (" + roundNice(mlPorHora / peso) + " mL/kg/h) supera la del bolo de " +
          "reanimación (" + roundNice(limite) + " mL/kg/h). Revisa el peso, el % y las horas."
      );
    }

    const nota = document.createElement("div");
    nota.className = "calc-fuente";
    nota.textContent =
      "Cifras de: " + FLUIDOS_FUENTE +
      " No contemplan cardiopatía, nefropatía oligúrica ni hipoproteinemia, donde el volumen " +
      "se reduce. Reevalúa peso, mucosas y producción de orina durante la fluidoterapia.";
    result.appendChild(nota);

    resumenPlan =
      "Fluidos — " + especie + " " + roundNice(peso) + " kg: " + partes.join(", ") +
      ". Infusión " + roundNice(mlPorHora) + " mL/h (" + roundNice(gotasMin) + " gotas/min con " +
      gtt + " gotas/mL)";
    if (fluidAddBtn) fluidAddBtn.disabled = false;
  }

  gradoSelect.addEventListener("change", function () {
    aplicarGrado();
    render();
  });
  [pctInput, pesoInput, horasInput, perdidasInput].forEach(function (i) {
    i.addEventListener("input", render);
  });
  [especieSelect, mantSelect, equipoSelect].forEach(function (s) {
    s.addEventListener("change", render);
  });
  [shockInput, pedInput].forEach(function (c) {
    c.addEventListener("change", render);
  });

  wrap.appendChild(campo("Especie", especieSelect));
  wrap.appendChild(campo("Peso del paciente (kg)", pesoInput));
  wrap.appendChild(campo("Deshidratación estimada en la exploración", gradoSelect));
  wrap.appendChild(
    campo("% de deshidratación a usar", pctInput, "Se propone el centro del tramo. Cámbialo si tu exploración dice otra cosa.")
  );
  const shockCampo = document.createElement("div");
  shockCampo.className = "calc-field";
  shockCampo.appendChild(shockLabel);
  wrap.appendChild(shockCampo);
  wrap.appendChild(campo("Horas para rehidratar", horasInput, "La pauta es 12–24 h."));
  wrap.appendChild(campo("Fórmula de mantenimiento", mantSelect, "Las tres se muestran en el resultado; esta es la que entra en el plan."));
  const pedCampo = document.createElement("div");
  pedCampo.className = "calc-field";
  pedCampo.appendChild(pedLabel);
  wrap.appendChild(pedCampo);
  wrap.appendChild(campo("Pérdidas continuas (mL/día)", perdidasInput, "Vómito, diarrea o poliuria estimados. Opcional."));
  wrap.appendChild(campo("Equipo de goteo", equipoSelect));
  wrap.appendChild(result);

  // Igual que en la calculadora de dosis: el plan se puede dejar escrito en
  // las notas del caso, y eso es TODO lo que hace el botón. No escribe en
  // ninguna tabla ni rellena ningún campo de lo administrado.
  if (ctx.caseEntry) {
    fluidAddBtn = document.createElement("button");
    fluidAddBtn.type = "button";
    fluidAddBtn.className = "calc-add-btn";
    fluidAddBtn.textContent = "Agregar a las notas del caso";
    fluidAddBtn.disabled = true;
    fluidAddBtn.addEventListener("click", async function () {
      if (!resumenPlan) return;
      fluidAddBtn.disabled = true;
      fluidAddBtn.textContent = "Agregando…";
      try {
        await addEvolutionToCase(ctx.caseEntry, resumenPlan + ".");
        fluidAddBtn.textContent = "Agregar a las notas del caso";
        if (fluidAddMsg) fluidAddMsg.remove();
        fluidAddMsg = document.createElement("div");
        fluidAddMsg.className = "calc-added-msg";
        fluidAddMsg.textContent = "✓ Agregado a las notas del caso";
        result.appendChild(fluidAddMsg);
      } catch (err) {
        fluidAddBtn.textContent = "Agregar a las notas del caso";
        alert("No se pudo agregar a las notas del caso. Revisa tu conexión e intenta de nuevo.");
      } finally {
        fluidAddBtn.disabled = false;
      }
    });
    wrap.appendChild(fluidAddBtn);
  }

  aplicarGrado();
  render();

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
  h2.textContent = "Calculadoras";
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

  /* Dos calculadoras en el mismo overlay. Se construyen las dos al abrir y
     se esconde la que no toca, en vez de reconstruir al cambiar de pestaña:
     asi lo que ya escribiste en una sigue ahi al volver. */
  const tabs = document.createElement("div");
  tabs.className = "subtabs calc-tabs";
  tabs.setAttribute("role", "tablist");

  const panelDosis = buildDoseCalculator(context);
  const panelFluidos = buildFluidCalculator(context);
  panelFluidos.hidden = true;

  const pestanas = [
    { id: "dosis", etiqueta: "💊 Dosis", panel: panelDosis },
    { id: "fluidos", etiqueta: "💧 Fluidos", panel: panelFluidos }
  ];
  const botones = [];

  function activarPestana(id) {
    pestanas.forEach(function (p, i) {
      const activa = p.id === id;
      p.panel.hidden = !activa;
      botones[i].setAttribute("aria-selected", activa ? "true" : "false");
    });
  }

  pestanas.forEach(function (p) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "subtab";
    b.setAttribute("role", "tab");
    b.textContent = p.etiqueta;
    b.addEventListener("click", function () { activarPestana(p.id); });
    botones.push(b);
    tabs.appendChild(b);
  });

  card.appendChild(tabs);
  card.appendChild(panelDosis);
  card.appendChild(panelFluidos);
  activarPestana(context && context.tab === "fluidos" ? "fluidos" : "dosis");
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

/* El triangulo de plegar/desplegar. Se gira por CSS en vez de cambiar
   el caracter: el giro cuenta que la fila se esta abriendo, el cambio
   de caracter solo aparece ya cambiado. */
function ponerCaret(nodo, abierto) {
  if (!nodo) return;
  nodo.textContent = "\u25b8";
  nodo.classList.toggle("abierto", !!abierto);
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

/* Que vista se dibujo la ultima vez. Sirve para animar la entrada solo
   cuando cambias de pagina, de pestana o abres una ficha, y NO cuando
   render() se repite por un snapshot de Firestore: eso ocurre muchas
   veces seguidas y animarlo seria un parpadeo. */
let ultimaVista = null;

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
  // El visor apunta a nodos que este render va a destruir.
  cerrarVisorFoto();
  mountedDetailId = null;
  setActiveNav();
  els.content.innerHTML = "";

  const vistaActual =
    state.page + "/" + (state.studyTab || "") + "/" + (state.activeId || "");
  const cambioDeVista = vistaActual !== ultimaVista;
  ultimaVista = vistaActual;

  const inner = document.createElement("div");
  inner.className = cambioDeVista ? "content-inner entra" : "content-inner";
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
  /* Cada tarjeta lleva a donde están las cosas que cuenta. Antes eran
     números muertos: leías "61 Formulario" y tenías que ir a buscarlo al
     menú, cuando el sitio obvio para pulsar era el número.

     Las dos de Estudio además dejan abierta la pestaña correcta, porque
     "Materias" y "Formulario" viven en la misma página. */
  const statDefs = [
    ["Casos activos", entriesForSection("casos").length, "patients", null],
    ["Materias", entriesForSection("materias").length, "study", "materias"],
    ["Fármacos usados", getMedUsageList().length, "farmacos", null],
    ["Formulario", state.formulario.length, "formulario_tab", "formulario"]
  ];
  statDefs.forEach(([l, n, destino, pestana]) => {
    // Botón y no div: se enfoca con el teclado y se activa con Enter sin
    // tener que reimplementar nada de eso a mano.
    const c = document.createElement("button");
    c.type = "button";
    c.className = "stat-card";
    c.innerHTML = '<span class="n">' + n + '</span><span class="l">' + l + "</span>";
    c.setAttribute("aria-label", l + ": " + n + ". Ver.");
    c.addEventListener("click", () => {
      // goToPage limpia búsqueda y filtros, así que la pestaña se fija
      // después: si no, la borraría al pasar.
      goToPage(destino === "formulario_tab" ? "study" : destino);
      if (pestana) {
        state.studyTab = pestana;
        render();
      }
    });
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
      ponerCaret(headTd.querySelector(".group-caret"), expandido);
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
        ponerCaret(headTd.querySelector(".group-caret"), nuevo);
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

function buildPrintableCase(entry, fotos) {
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

  /* Fotos. Van al final a proposito: son lo que mas ocupa, y si fueran
     antes empujarian el texto del caso a la segunda pagina. Se imprimen
     porque van en base64 dentro del documento — no dependen de que el
     navegador pueda descargar nada al generar el PDF. */
  if (fotos && fotos.length) {
    const sec = document.createElement("div");
    sec.className = "print-block";
    const h = document.createElement("h2");
    h.textContent = fotos.length === 1 ? "Imagen" : "Imágenes (" + fotos.length + ")";
    sec.appendChild(h);

    const rejilla = document.createElement("div");
    rejilla.className = "print-fotos";
    fotos.forEach((f) => {
      const fig = document.createElement("figure");
      fig.className = "print-foto";
      const im = document.createElement("img");
      im.src = f.datos;
      im.alt = f.nombre || "";
      fig.appendChild(im);
      if (f.nombre) {
        const cap = document.createElement("figcaption");
        cap.textContent = f.nombre;
        fig.appendChild(cap);
      }
      rejilla.appendChild(fig);
    });
    sec.appendChild(rejilla);
    root.appendChild(sec);
  }

  return root;
}

async function imprimirCaso(entry, boton) {
  const previo = document.getElementById("printArea");
  if (previo) previo.remove();

  /* Las fotos ya no viven dentro del caso: hay que pedirlas. Por eso esto
     es async y por eso el boton avisa — con varias fotos en base64 la
     consulta tarda lo justo para que un clic sin respuesta despiste. */
  let fotos = [];
  const textoPrevio = boton ? boton.textContent : null;
  if (boton) {
    boton.disabled = true;
    boton.textContent = "Preparando…";
  }
  try {
    fotos = await fotosDeEntrada(entry.id);
  } catch (err) {
    // Sin fotos se imprime igual: mejor un PDF sin imagenes que ninguno.
    logFoto("no se pudieron traer las fotos para el PDF: " + ((err && err.code) || err));
  } finally {
    if (boton) {
      boton.disabled = false;
      boton.textContent = textoPrevio;
    }
  }

  const area = buildPrintableCase(entry, fotos);
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
  pdfBtn.addEventListener("click", () => imprimirCaso(entry, pdfBtn));
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

/* Una misma pauta puede ir por varias vias: casi toda etiqueta dice cosas
   como "IM o SC", o "IV lenta / IM". Antes solo cabia una y habia que
   duplicar la dosis entera para reflejarlo, con el riesgo de que las dos
   copias se desincronizaran al corregir una.

   Ahora "via" es un array. Los documentos viejos la tienen como texto, asi
   que TODA lectura pasa por viasDe(): acepta las dos formas y siempre
   devuelve lista. No hace falta migrar nada. */
/* Como se multiplica una dosis depende de su unidad, y no todas van por
   kilo. Si se tratan todas igual, una dosis fija de 62,5 mg en un gato de
   4 kg sale como 250 mg: cuatro veces la dosis. Esto no es un detalle
   cosmetico, es la diferencia entre una dosis correcta y una sobredosis.

     mg/kg     -> se multiplica por el peso
     mg/animal -> dosis FIJA, el peso no interviene
     mg/m2     -> se multiplica por la superficie corporal */
function tipoDeUnidad(unidad) {
  const u = String(unidad || "").toLowerCase();
  if (u.includes("/m2") || u.includes("/m²")) return "superficie";
  if (u.includes("/animal") || u.includes("/cabeza")) return "fija";
  return "peso";
}

/* Superficie corporal por la formula estandar: BSA(m2) = K * P(g)^(2/3) /
   10000, con K = 10.1 en perro y 10.0 en gato. Para las demas especies se
   usa 10.1, que es lo habitual a falta de constante propia. */
function superficieCorporal(pesoKg, especie) {
  const K = String(especie || "").toLowerCase() === "felino" ? 10.0 : 10.1;
  return (K * Math.pow(pesoKg * 1000, 2 / 3)) / 10000;
}

function totalSegunUnidad(dosis, unidad, pesoKg, especie) {
  const tipo = tipoDeUnidad(unidad);
  if (tipo === "fija") return dosis;
  if (tipo === "superficie") return dosis * superficieCorporal(pesoKg, especie);
  return dosis * pesoKg;
}

function viasDe(via) {
  if (Array.isArray(via)) return via.filter(Boolean);
  const t = String(via == null ? "" : via).trim();
  if (!t) return [];
  // Un texto viejo puede traer ya varias escritas a mano ("IM o SC").
  // Sin expresion regular a proposito: se reduce todo a un separador
  // unico y se parte por el, que se lee mejor y basta para estos casos.
  const unificado = t
    .split(",").join("|")
    .split("/").join("|")
    .split(" o ").join("|")
    .split(" y ").join("|");
  return unificado
    .split("|")
    .map((x) => x.trim())
    .filter(Boolean);
}

function viaTexto(via) {
  const lista = viasDe(via);
  if (!lista.length) return "";
  if (lista.length === 1) return lista[0];
  return lista.slice(0, -1).join(", ") + " o " + lista[lista.length - 1];
}

function buildViasCheckboxes(seleccionadas, onChange) {
  const wrap = document.createElement("div");
  wrap.className = "checkbox-group checkbox-group-vias";
  const values = new Set(viasDe(seleccionadas));
  VIAS_FORMULARIO.forEach((opt) => {
    const label = document.createElement("label");
    label.className = "checkbox-item";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = opt;
    input.checked = values.has(opt);
    input.addEventListener("change", () => {
      if (input.checked) values.add(opt);
      else values.delete(opt);
      // Se conserva el orden de VIAS_FORMULARIO y no el de marcado, para
      // que "IM o SC" no salga a veces como "SC o IM".
      onChange(VIAS_FORMULARIO.filter((v) => values.has(v)));
    });
    const span = document.createElement("span");
    span.textContent = opt;
    label.appendChild(input);
    label.appendChild(span);
    wrap.appendChild(label);
  });
  return wrap;
}
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

/* Fecha en horario LOCAL, no en UTC.

   toISOString() convierte a UTC antes de recortar, y en Ecuador (UTC-5)
   cualquier hora a partir de las 19:00 ya cae en el dia siguiente. El
   campo mostraba manana mientras el texto de al lado mostraba hoy. En el
   unico campo cuyo sentido es "que dia exacto revisaste esto", un dia de
   desfase lo invalida. */
function paraInputFecha(valor) {
  const d = fechaDeVerificacion(valor);
  if (!d) return "";
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return d.getFullYear() + "-" + mes + "-" + dia;
}

/* El camino inverso tiene el mismo problema al reves: new Date("2026-08-21")
   se interpreta como medianoche UTC, que en Ecuador es el dia 20 a las
   19:00. Construyendo la fecha por partes se queda en el dia que elegiste. */
function desdeInputFecha(texto) {
  if (!texto) return null;
  const p = texto.split("-").map(Number);
  if (p.length !== 3 || p.some((n) => !isFinite(n))) return null;
  return new Date(p[0], p[1] - 1, p[2]);
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
      via: viasDe(f.via),
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
        via: viasDe(f.via),
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

/* La especie por la que se está mirando el formulario, venga del
   desplegable o de haberla escrito en el buscador.

   Escribir "canino" es lo que sale natural, y hasta ahora solo servía para
   dejar fuera los fármacos sin uso canino: la fila seguía diciendo "3
   pautas" y "canino, felino, bovino". Eso obliga a abrir la ficha para
   averiguar qué parte de esos datos te sirve. Si has dicho canino, la vista
   debería hablarte de canino. */
function especieActiva() {
  if (state.formularioEspecieFilter) return state.formularioEspecieFilter;
  const q = normalizarBusqueda(state.query).trim();
  if (!q) return "";
  return especiesDelFormulario().find((e) => normalizarBusqueda(e) === q) || "";
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
          verificadoEl: desdeInputFecha(receta.verificadoEl),
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

/* ---------- Agrupado por familia ----------

   "familia" es deliberadamente fina ("Betalactámico — aminopenicilina")
   porque al abrir una ficha esa precisión es la que orienta. Pero como
   encabezado de grupo sería inútil: saldrían treinta y cinco grupos de uno
   o dos fármacos, que es peor que no agrupar.

   Asi que la lista se agrupa por CATEGORÍA amplia, deducida de la familia.
   Cada fármaco sigue mostrando su familia completa en su fila. */
const GRUPOS_FARMACO = [
  ["Antibióticos", ["betalactámico", "cefalosporina", "penicilina", "fluoroquinolona", "quinolona", "aminoglucósido", "tetraciclina", "macrólido", "sulfonamida", "anfenicol", "nitroimidazol", "lincosamida"]],
  ["AINEs", ["aine"]],
  ["Corticoides", ["corticoide", "glucocorticoide"]],
  ["Analgésicos opioides", ["opioide"]],
  ["Anestésicos y sedantes", ["anestésico", "inductor", "alfa-2", "benzodiazepina", "fenotiazina", "disociativo", "anticolinérgico"]],
  ["Antiparasitarios", ["lactona macrocíclica", "benzimidazol", "isoxazolina", "cestodicida", "tetrahidropirimidina", "triazinona", "anticoccidial", "antiparasitario", "avermectina"]],
  ["Fluidos y electrolitos", ["electrolito", "fluido", "alcalinizante"]],
  ["Otros", []]
];

const SIN_GRUPO = "Otros";

function grupoDeFarmaco(farmaco) {
  const f = normalizarBusqueda(farmaco && farmaco.familia);
  if (!f) return SIN_GRUPO;
  for (const [nombre, claves] of GRUPOS_FARMACO) {
    if (claves.some((c) => f.includes(normalizarBusqueda(c)))) return nombre;
  }
  return SIN_GRUPO;
}

/* Subclase dentro de la categoría. La "familia" es más fina todavía
   ("Betalactámico — aminopenicilina"), así que agrupar por ella daría
   subgrupos de un solo fármaco. Aquí se normaliza al nombre de la clase
   farmacológica, en plural, que es como se estudian. */
const SUBCLASES_FARMACO = [
  [/betalact/i, "Betalactámicos"],
  [/cefalospor/i, "Cefalosporinas"],
  [/quinolona/i, "Fluoroquinolonas"],
  [/aminogluc/i, "Aminoglucósidos"],
  [/tetraciclina/i, "Tetraciclinas"],
  [/macrólido|macrolido/i, "Macrólidos"],
  [/sulfonamida/i, "Sulfonamidas potenciadas"],
  [/anfenicol/i, "Anfenicoles"],
  [/nitroimidazol/i, "Nitroimidazoles"],
  [/coxib/i, "Coxibs"],
  [/propiónico|propionico/i, "Derivados propiónicos"],
  [/oxicam/i, "Oxicams"],
  [/pirazolona/i, "Pirazolonas"],
  [/fenamato/i, "Fenamatos"],
  [/agonista mu/i, "Agonistas mu puros"],
  [/agonista parcial/i, "Agonistas parciales"],
  [/kappa/i, "Agonistas kappa"],
  [/atípico|atipico|acción central|accion central/i, "Opioides atípicos"],
  [/inhalatorio/i, "Inhalatorios"],
  [/inductor/i, "Inductores intravenosos"],
  [/disociativo/i, "Disociativos"],
  [/alfa-2/i, "Agonistas alfa-2"],
  [/benzodiazepina/i, "Benzodiazepinas"],
  [/fenotiazina/i, "Fenotiazinas"],
  [/anestésico local|anestesico local/i, "Anestésicos locales"],
  [/anticolinérgico|anticolinergico/i, "Anticolinérgicos"],
  [/avermectina|lactona macroc/i, "Lactonas macrocíclicas"],
  [/benzimidazol/i, "Benzimidazoles"],
  [/isoxazolina/i, "Isoxazolinas"],
  [/cestodicida/i, "Cestodicidas"],
  [/tetrahidropirimidina/i, "Tetrahidropirimidinas"],
  [/triazinona|anticoccidial|tiamina/i, "Anticoccidiales"],
  [/glucocorticoide|corticoide/i, "Glucocorticoides"],
  [/diurético|diuretico/i, "Diuréticos"],
  [/alcalinizante/i, "Alcalinizantes"],
  [/electrolito/i, "Electrolitos"],
  [/fluido/i, "Fluidos"]
];

function subclaseDeFarmaco(farmaco) {
  const f = (farmaco && farmaco.familia) || "";
  for (const [patron, nombre] of SUBCLASES_FARMACO) {
    if (patron.test(f)) return nombre;
  }
  // Sin regla propia: se usa el primer tramo de la familia tal cual.
  const primero = f.split("—")[0].trim();
  return primero || "Sin clasificar";
}

// Igual que en pacientes: fuera del closure, si no cada redibujado
// volveria a cerrar todos los grupos que hubieras abierto.
const gruposFarmacoExpandidos = new Set();

/* Todo nace cerrado, en los dos niveles: con 61 fármacos, abrir una
   categoría y volcar sus nueve subclases con todos sus fármacos es la misma
   pared de texto que había antes de agrupar. Se anota lo que ABRES. */
const subclasesExpandidas = new Set();

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

  const especie = especieActiva();

  function filaDeFarmaco(crudo) {
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
      // Con una especie elegida se cuentan solo SUS pautas, no todas.
      const pautas = especie
        ? far.dosis.filter((d) => String(d.especie || "").toLowerCase() === especie)
        : far.dosis;
      doseTd.textContent = pautas.length ? pautas.length + " pauta(s)" : "—";
      tr.appendChild(doseTd);
    }

    const specTd = document.createElement("td");
    specTd.className = "cell-muted";
    const esp = especiesDe(far);
    if (especie) {
      // Se muestra la especie elegida y, si el fármaco sirve para más, un
      // "+N" que avisa de que hay más datos sin esconderlos del todo.
      const otras = esp.filter((e) => e !== especie).length;
      specTd.textContent = especie + (otras ? " +" + otras : "");
      if (otras) specTd.title = "También: " + esp.filter((e) => e !== especie).join(", ");
    } else {
      specTd.textContent = esp.length ? esp.join(", ") : "—";
    }
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

    return tr;
  }

  /* Agrupado por categoría, con el mismo comportamiento que la lista de
     pacientes: encabezado plegable, contador, y todo abierto cuando hay
     una búsqueda o un filtro activo — colapsar entonces escondería justo
     lo que estás buscando. */
  const grupos = new Map();
  list.forEach((crudo) => {
    const g = grupoDeFarmaco(farmacoNormalizado(crudo));
    if (!grupos.has(g)) grupos.set(g, []);
    grupos.get(g).push(crudo);
  });

  // Se respeta el orden de GRUPOS_FARMACO (antibióticos primero, "Otros"
  // al final) en vez del alfabético: agrupa por afinidad de uso.
  const ordenGrupos = GRUPOS_FARMACO.map((g) => g[0]);
  const nombres = Array.from(grupos.keys()).sort(
    (a, b) => ordenGrupos.indexOf(a) - ordenGrupos.indexOf(b)
  );

  const abrirTodo = !!state.query || !!state.formularioEspecieFilter;

  nombres.forEach((nombre) => {
    const filas = grupos.get(nombre);
    const expandido = abrirTodo || gruposFarmacoExpandidos.has(nombre);

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
    ponerCaret(headTd.querySelector(".group-caret"), expandido);
    headTd.querySelector(".group-name").textContent = nombre;
    headTd.querySelector(".group-count").textContent =
      filas.length + (filas.length === 1 ? " fármaco" : " fármacos");
    headTr.appendChild(headTd);
    tbody.appendChild(headTr);

    /* Segundo nivel: subclases dentro de la categoría. Cada una tiene su
       propio plegado, y el de la categoría manda sobre todos: si la
       categoría está cerrada no se ve nada suyo, esté como esté cada
       subclase. */
    const subgrupos = new Map();
    filas.forEach((crudo) => {
      const sc = subclaseDeFarmaco(farmacoNormalizado(crudo));
      if (!subgrupos.has(sc)) subgrupos.set(sc, []);
      subgrupos.get(sc).push(crudo);
    });

    const nombresSub = Array.from(subgrupos.keys()).sort((a, b) => a.localeCompare(b, "es"));
    const controlados = [];

    nombresSub.forEach((sub) => {
      const clave = nombre + "/" + sub;
      const subAbierto = abrirTodo || subclasesExpandidas.has(clave);
      const deLaSub = subgrupos.get(sub);

      // Con una sola subclase el encabezado sobra: repetiría lo que ya dice
      // la categoría y añadiría un clic para nada.
      let subTr = null;
      let subTd = null;
      if (nombresSub.length > 1) {
        subTr = document.createElement("tr");
        subTr.className = "subgroup-row";
        subTd = document.createElement("td");
        subTd.colSpan = cols.length;
        subTd.setAttribute("role", "button");
        subTd.tabIndex = 0;
        subTd.setAttribute("aria-expanded", subAbierto ? "true" : "false");
        subTd.innerHTML =
          '<span class="subgroup-caret"></span><span class="subgroup-name"></span>' +
          '<span class="subgroup-count"></span>';
        ponerCaret(subTd.querySelector(".subgroup-caret"), subAbierto);
        subTd.querySelector(".subgroup-name").textContent = sub;
        subTd.querySelector(".subgroup-count").textContent = deLaSub.length;
        subTr.appendChild(subTd);
        subTr.hidden = !expandido;
        tbody.appendChild(subTr);
      }

      // Sin encabezado propio (subclase única) no hay dónde pulsar, así que
      // esas filas dependen solo de la categoría.
      const visible = subTr ? expandido && subAbierto : expandido;
      const filasSub = deLaSub.map((crudo) => {
        const tr = filaDeFarmaco(crudo);
        tr.hidden = !visible;
        tbody.appendChild(tr);
        return tr;
      });

      function alternarSub() {
        const abierto = subTd.getAttribute("aria-expanded") === "true";
        const ahora = !abierto;
        if (ahora) subclasesExpandidas.add(clave);
        else subclasesExpandidas.delete(clave);
        subTd.setAttribute("aria-expanded", ahora ? "true" : "false");
        ponerCaret(subTd.querySelector(".subgroup-caret"), ahora);
        filasSub.forEach((tr) => {
          tr.hidden = !ahora;
        });
      }

      if (subTr) {
        subTr.addEventListener("click", (e) => {
          if (e.target.closest(".row-actions")) return;
          alternarSub();
        });
        subTd.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            alternarSub();
          }
        });
      }

      controlados.push({ subTr, subTd, filasSub });
    });

    function alternar() {
      const abiertoAhora = headTd.getAttribute("aria-expanded") === "true";
      const nuevoEstado = !abiertoAhora;
      if (nuevoEstado) gruposFarmacoExpandidos.add(nombre);
      else gruposFarmacoExpandidos.delete(nombre);
      headTd.setAttribute("aria-expanded", nuevoEstado ? "true" : "false");
      ponerCaret(headTd.querySelector(".group-caret"), nuevoEstado);

      controlados.forEach(({ subTr, subTd, filasSub }) => {
        if (subTr) subTr.hidden = !nuevoEstado;
        // Al reabrir la categoría se respeta el estado que dejaste en cada
        // subclase, en vez de abrirlas todas de golpe.
        const subAbierto = !subTd || subTd.getAttribute("aria-expanded") === "true";
        filasSub.forEach((tr) => {
          tr.hidden = !(nuevoEstado && subAbierto);
        });
      });
    }

    headTr.addEventListener("click", (e) => {
      if (e.target.closest(".row-actions")) return;
      alternar();
    });
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
  const espPista = especieActiva();
  pista.textContent = espPista
    ? "Mostrando solo lo de " + espPista + ": las dosis y especies de cada fila son las de esa especie."
    : state.query
      ? 'Filtrando por “' + state.query + '” (nombre genérico, familia, vía o indicación).'
      : "Usa el buscador de arriba para filtrar por nombre genérico, familia, vía o indicación.";
  if (espPista) pista.classList.add("form-pista-activa");
  filterRow.appendChild(pista);
  card.appendChild(filterRow);

  const listWrap = document.createElement("div");
  listWrap.style.padding = "14px 0 4px";
  // Si escribiste una especie, filtra como si la hubieras elegido en el
  // desplegable: es lo que esperas al escribir "canino".
  const filtro = especieActiva();
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

      const via = buildViasCheckboxes(p.via, (lista) => editar("via", lista));
      campos.appendChild(campoFormulario("Vía(s)", via));

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
      far.presentaciones.concat({ concentracion: null, unidadConc: "mg/mL", via: [], nombreComercialLocal: "" })
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

    // Varias vias por pauta: la etiqueta dice "IM o SC" y antes obligaba a
    // duplicar la dosis entera para poder reflejarlo.
    const via = buildViasCheckboxes(d.via, (lista) => editar("via", lista));
    fila1.appendChild(campoFormulario("Vía(s)", via));

    const fila2 = document.createElement("div");
    fila2.className = "field-row";

    const dmin = inputNumero(d.dosisMin, "Mín.");
    const dmax = inputNumero(d.dosisMax, "Máx.");

    /* Un rango invertido se guardaba sin decir nada, y luego la calculadora
       daba un resultado raro sin explicar de dónde venía. Se avisa aquí,
       donde se puede corregir, y no tres pantallas después. */
    const avisoRango = document.createElement("p");
    avisoRango.className = "form-aviso-error";
    avisoRango.hidden = true;

    function revisarRango() {
      const a = parseFloat(dmin.value);
      const b = parseFloat(dmax.value);
      const invertido = isFinite(a) && isFinite(b) && b < a;
      avisoRango.hidden = !invertido;
      if (invertido) {
        avisoRango.textContent =
          "El mínimo (" + a + ") es mayor que el máximo (" + b + "). Revisa: la calculadora no podrá usar esta pauta.";
      }
      dmin.classList.toggle("campo-invalido", invertido);
      dmax.classList.toggle("campo-invalido", invertido);
    }

    dmin.addEventListener("input", () => {
      editar("dosisMin", dmin.value === "" ? null : Number(dmin.value));
      revisarRango();
    });
    fila2.appendChild(campoFormulario("Dosis mín.", dmin));

    dmax.addEventListener("input", () => {
      editar("dosisMax", dmax.value === "" ? null : Number(dmax.value));
      revisarRango();
    });
    fila2.appendChild(campoFormulario("Dosis máx.", dmax));
    revisarRango();

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
    bloque.appendChild(avisoRango);
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
  let altaVias = [];
  const altaVia = buildViasCheckboxes([], (lista) => {
    altaVias = lista;
    altaVia.classList.remove("campo-invalido");
  });
  altaFila.appendChild(campoFormulario("Vía(s)", altaVia));
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
    if (!altaVias.length) faltan.push("vía");
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
        via: altaVias,
        frecuenciaH: null,
        duracionMaxDias: null,
        fuente: altaFuente.value.trim(),
        esExtralabel: false
      })
    );
    altaEspecie.value = "";
    altaMin.value = "";
    altaMax.value = "";
    altaVias = [];
    altaVia.querySelectorAll("input").forEach((c) => {
      c.checked = false;
    });
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
    const valor = desdeInputFecha(verifInput.value);
    far.verificadoEl = valor;
    save("verificadoEl", valor);
    pintarEstadoVerif();
  });
  verifRow.appendChild(campoFormulario("Verificado el", verifInput));

  /* Botón de un toque. Existe porque la alternativa honesta tiene que ser
     tan cómoda como la deshonesta: si sellar la fecha cuesta abrir un
     selector y buscar el día, la tentación es poner la fecha a todo de
     golpe sin mirar nada — y ahí el campo deja de significar algo. */
  const marcarHoy = document.createElement("button");
  marcarHoy.type = "button";
  marcarHoy.className = "btn-secondary";
  marcarHoy.textContent = "Lo verifiqué hoy";
  marcarHoy.style.alignSelf = "flex-end";
  marcarHoy.addEventListener("click", async () => {
    const ok = await askConfirm({
      title: "¿Confirmas que lo verificaste?",
      message:
        "Esto deja constancia de que comparaste las dosis, vías y concentraciones de “" +
        (far.nombreGenerico || "este fármaco") +
        "” con la etiqueta del producto.\n\n" +
        "No lo marques si no lo has hecho: es lo único que distingue un dato revisado de uno que nadie miró.",
      confirmLabel: "Sí, lo verifiqué"
    });
    if (!ok) return;
    const hoy = new Date();
    far.verificadoEl = hoy;
    verifInput.value = paraInputFecha(hoy);
    save("verificadoEl", hoy);
    pintarEstadoVerif();
    showToast("Verificado hoy");
  });
  verifRow.appendChild(marcarHoy);
  verifCard.appendChild(verifRow);

  const estadoVerif = document.createElement("p");
  verifCard.appendChild(estadoVerif);

  function pintarEstadoVerif() {
    if (!far.verificadoEl) {
      estadoVerif.className = "form-aviso-error";
      estadoVerif.textContent =
        "Sin verificar: nadie ha comparado estos datos con la etiqueta del producto todavía.";
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
  // Firestore sincroniza sus escrituras pendientes por su cuenta; las
  // fotos ya no necesitan una cola aparte.
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
  // Le dice al vigilante de index.html que el modulo arranco bien, para que
  // no ofrezca limpiar la cache cuando no hace falta.
  window.__vetdiarioArrancado = true;
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
    // Rescata las fotos que quedaron atrapadas en la cola vieja cuando las
    // subidas iban a Storage. Se ejecuta una vez y despues no encuentra nada.
    rescatarFotosAtrapadas();
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

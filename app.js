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

/* El icono de la ficha era la inicial del nombre, que no dice nada: en una
   lista de casos todas las "M" se parecen. Con la especie delante se
   reconoce el paciente de un vistazo. "Otro" y los que no esten aqui caen
   en la inicial de siempre. */
const ICONO_ESPECIE = {
  bovino: "🐄",
  equino: "🐴",
  porcino: "🐖",
  aves: "🐔",
  canino: "🐕",
  felino: "🐈",
  ovino: "🐑",
  caprino: "🐐",
  exotico: "🦎"
};

/* En produccion casi nunca se atiende a UN animal: se atiende un hato, un
   lote o una parvada, y el caso necesita saber de que finca es, cuantos
   animales hay y cuantos estan afectados. Las aves entran aunque no sean
   "hato" en sentido estricto: el problema es el mismo. */
const ESPECIES_HATO = ["bovino", "porcino", "ovino", "caprino", "equino", "aves"];

function esEspecieDeHato(especie) {
  return ESPECIES_HATO.indexOf(normalizarBusqueda(especie).trim()) >= 0;
}

function iconoDeEspecie(especie, nombre) {
  const clave = normalizarBusqueda(especie).trim();
  return ICONO_ESPECIE[clave] || (String(nombre || "?").trim().charAt(0).toUpperCase() || "?");
}

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
    incluyeNormalizado(textoDelCaso(entry), q)
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

/* ================= Apuntes con imágenes intercaladas =================

   El apunte de una materia era un <textarea>: solo texto. Ahora es un
   contenteditable donde las imágenes viven DENTRO del texto, como en un
   documento de Word: escribes, pegas una radiografía, sigues escribiendo
   debajo.

   Dónde vive cada cosa, que es lo que hace que esto no reviente:

     entries/{id}.bodyHtml   el texto con formato y <img data-foto="ID">
     entries/{id}.body       el mismo texto en plano
     fotos/{ID}.datos        la imagen en base64

   Las imágenes NO se guardan dentro del apunte. Un documento de Firestore
   no puede pasar de 1 MB y una sola foto comprimida ya ronda el medio
   mega: con dos imágenes el apunte entero dejaría de poder guardarse y se
   perdería también el texto. Por eso en bodyHtml solo queda la referencia
   y el src se rellena al abrir.

   Y se sigue escribiendo "body" en plano ademas de "bodyHtml" porque el
   buscador y el resto de la app leen "body": si solo guardara el HTML,
   buscar un apunte por su contenido dejaria de funcionar. */

/* Adaptador de lectura: los apuntes viejos solo tienen "body" en texto
   plano. En vez de migrarlos, se convierten al vuelo. Asi nada se rompe
   mientras existan los dos formatos. */
/* ---------- La historia clínica, por apartados ----------

   Antes era UN cuadro de texto con todo dentro. Un caso escrito así no se
   puede releer: para saber qué se le encontró en el examen físico hay que
   leerlo entero. Ahora son cuatro apartados, con los exámenes en medio,
   que es el orden en que ocurre la consulta.

   Los casos viejos NO se migran: su texto sigue en "body" y se muestra en
   Anamnesis, que es donde casi siempre estaba. En cuanto se escribe algo
   en los apartados nuevos, "body" deja de leerse — pero no se borra, así
   que el texto original sigue ahí pase lo que pase. */
const CASO_APARTADOS = [
  {
    clave: "anamnesis",
    etiqueta: "Anamnesis",
    marcador: "Motivo de consulta, desde cuándo, antecedentes, alimentación, vacunas, desparasitación, qué cuenta el tutor…"
  },
  {
    clave: "examenFisico",
    etiqueta: "Examen físico",
    marcador: "Actitud, condición corporal, mucosas, linfonodos, auscultación, palpación abdominal, hallazgos por sistema…"
  },
  {
    clave: "diagnostico",
    etiqueta: "Diagnóstico",
    marcador: "Presuntivo, diferenciales, definitivo y en qué te basas…"
  },
  {
    clave: "tratamiento",
    etiqueta: "Tratamiento",
    marcador: "Qué se aplicó en consulta, qué se envió a casa, indicaciones al tutor, cuándo controlar…"
  }
];

function apartadosVacios(entry) {
  return CASO_APARTADOS.every(function (a) {
    return !String(entry[a.clave] || "").trim();
  });
}

/* Lo que se muestra en un apartado al abrir la ficha. Solo Anamnesis
   hereda el texto antiguo, y solo mientras no se haya escrito nada nuevo. */
function textoDeApartado(entry, clave) {
  const propio = entry[clave];
  if (propio != null && String(propio).length) return String(propio);
  if (clave === "anamnesis" && apartadosVacios(entry)) return String(entry.body || "");
  return "";
}

/* El caso entero como texto plano. Lo usan el buscador y el PDF: si cada
   uno decidiera por su cuenta qué leer, uno encontraría casos que el otro
   no imprime. */
function textoDelCaso(entry) {
  if (apartadosVacios(entry)) return String(entry.body || "");
  return CASO_APARTADOS
    .map(function (a) {
      const t = String(entry[a.clave] || "").trim();
      return t ? a.etiqueta + ": " + t : "";
    })
    .filter(Boolean)
    .join("\n");
}

function apunteComoHtml(entry) {
  if (entry.bodyHtml && String(entry.bodyHtml).trim()) return limpiarHtmlApunte(entry.bodyHtml);
  const plano = String(entry.body || "");
  if (!plano.trim()) return "";
  const div = document.createElement("div");
  div.textContent = plano;
  return div.innerHTML.split("\n").join("<br>");
}

/* El HTML vuelve de Firestore y se inyecta con innerHTML. Aunque solo
   pueden escribir dos correos, un innerHTML sin filtrar es una puerta que
   no hace falta dejar abierta: fuera scripts, marcos y cualquier atributo
   que ejecute algo. */
const APUNTE_ETIQUETAS_FUERA = ["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "LINK", "META", "FORM"];

function limpiarHtmlApunte(html) {
  const caja = document.createElement("div");
  caja.innerHTML = String(html);
  APUNTE_ETIQUETAS_FUERA.forEach(function (tag) {
    Array.from(caja.getElementsByTagName(tag)).forEach(function (n) { n.remove(); });
  });
  Array.from(caja.querySelectorAll("*")).forEach(function (n) {
    Array.from(n.attributes).forEach(function (a) {
      const nombre = a.name.toLowerCase();
      const valor = String(a.value || "").replace(/\s/g, "").toLowerCase();
      if (nombre.indexOf("on") === 0) n.removeAttribute(a.name);
      else if ((nombre === "href" || nombre === "src") && valor.indexOf("javascript:") === 0) n.removeAttribute(a.name);
    });
  });
  return caja.innerHTML;
}

/* Lo que se guarda NO es lo que se ve: a las imágenes se les quita el src
   antes de escribir. Con el src puesto, cada guardado subiría medio mega
   de base64 dentro del apunte y Firestore lo rechazaría. */
/* El ancho vive en data-ancho ademas de en el style. El style es lo
   primero que se pierde cuando el HTML pasa por las manos de alguien
   mas (el saneado, o el propio navegador al re-crear un nodo), y
   perderlo significa que la imagen vuelve a salir enorme. Con el
   atributo se puede reponer siempre. */
/* Una imagen con titulo es un <figure> con la imagen y un
   <figcaption> debajo, como en un documento. El figcaption es editable
   solo porque esta dentro del contenteditable: no lleva atributo
   propio, asi no hay nada que limpiar al guardar.

   Todo lo que manipula la imagen —mover, cambiar de tamano— actua
   sobre el ENVOLTORIO, no sobre el <img>: si moviera solo la imagen,
   el titulo se quedaria atras. Las imagenes de los apuntes antiguos no
   tienen figure y siguen funcionando: envoltorioDeImagen devuelve la
   propia imagen y todo se comporta como antes. */
function envoltorioDeImagen(img) {
  const fig = img && img.closest ? img.closest("figure.apunte-fig") : null;
  return fig || img;
}

function crearFiguraDeImagen(img) {
  const fig = document.createElement("figure");
  fig.className = "apunte-fig";
  const pie = document.createElement("figcaption");
  pie.className = "apunte-pie";
  pie.setAttribute("data-vacio", "Escribe un título…");
  fig.appendChild(img);
  fig.appendChild(pie);
  return fig;
}

function aplicarAnchosGuardados(editor) {
  Array.from(editor.querySelectorAll("[data-ancho]")).forEach(function (el) {
    const v = parseFloat(el.getAttribute("data-ancho"));
    if (isFinite(v) && v > 0) el.style.width = v + "%";
  });
  /* El marcador del pie se repone al abrir: es de pantalla, no del
     apunte, y guardarlo lo convertiria en el texto del titulo. */
  Array.from(editor.querySelectorAll("figure.apunte-fig > figcaption")).forEach(function (pie) {
    pie.classList.add("apunte-pie");
    pie.setAttribute("data-vacio", "Escribe un título…");
  });
}

/* Una imagen del apunte es un BLOQUE del apunte: vive al primer nivel,
   nunca dentro de un parrafo, de una lista o del pie de otra imagen.

   No es mania de orden, es lo que arregla "al moverla se vuelve grande".
   El ancho se guarda en tanto por ciento y un tanto por ciento es siempre
   del CONTENEDOR: medido, la misma imagen al 25 % ocupaba 30 px metida en
   una lista estrecha y 219 px al soltarla en el texto de fuera, sin que
   cambiara ni el estilo ni el ancho guardado. Con todas las piezas al
   primer nivel el contenedor es siempre el apunte, y el 25 % vale siempre
   lo mismo se mueva donde se mueva.

   Se hace al ABRIR y no migrando nada (invariante 18): los apuntes viejos
   se acomodan solos la primera vez que se editan. */
const APUNTE_POS_ANTIGUAS = {
  "apunte-img-izq": "izq",
  "apunte-img-der": "der",
  "apunte-img-centro": "centro"
};

function normalizarPiezasDelApunte(editor) {
  Array.from(editor.querySelectorAll("img")).forEach(function (img) {
    const pieza = envoltorioDeImagen(img);
    /* Las clases de flotado de los apuntes antiguos hacen lo mismo que la
       posicion nueva, asi que se traducen en vez de convivir con ella. */
    Object.keys(APUNTE_POS_ANTIGUAS).forEach(function (clase) {
      if (!pieza.classList.contains(clase)) return;
      pieza.setAttribute("data-pos", APUNTE_POS_ANTIGUAS[clase]);
      pieza.classList.remove(clase);
    });
    if (!pieza.getAttribute("data-pos")) pieza.setAttribute("data-pos", "izq");
    if (pieza.parentNode === editor) return;
    /* Sube hasta el hijo directo del apunte y se coloca justo detras: la
       imagen sale del parrafo pero se queda donde estaba leyendo. */
    let ancla = pieza;
    while (ancla.parentNode && ancla.parentNode !== editor) ancla = ancla.parentNode;
    if (ancla.parentNode !== editor) return;
    editor.insertBefore(pieza, ancla.nextSibling);
  });
}

function apunteParaGuardar(editor) {
  const copia = editor.cloneNode(true);
  Array.from(copia.querySelectorAll("img")).forEach(function (img) {
    if (img.getAttribute("data-foto")) img.removeAttribute("src");
    else img.remove(); // una imagen sin ficha no se puede recuperar luego
    /* La marca de "esta seleccionada" es estado de la pantalla, no del
       apunte: guardada, la imagen quedaria con el recuadro verde puesto
       para siempre al volver a abrir. */
    /* Estas tres son estado de PANTALLA, no del apunte. Las dos ultimas
       llevan width:100 % en la hoja: guardadas, la imagen volvia a abrirse
       ocupando el apunte entero y ya no habia forma de recuperar su
       tamano. */
    img.classList.remove("apunte-img-sel");
    img.classList.remove("apunte-img-cargando");
    img.classList.remove("apunte-img-rota");
    if (!img.getAttribute("class")) img.removeAttribute("class");
  });
  Array.from(copia.querySelectorAll("figcaption")).forEach(function (pie) {
    pie.removeAttribute("data-vacio");
  });
  return copia.innerHTML;
}

/* Guarda la imagen y devuelve su id SIN esperar al servidor. doc() sobre
   una coleccion genera el identificador en local, asi que la imagen se ve
   en el apunte al instante y la escritura viaja por detras. Esperar al
   servidor dejaria el apunte bloqueado cada vez que se pega una foto sin
   cobertura, que es justo cuando mas se usa. */
async function guardarImagenDeApunte(entryId, file) {
  const datos = await prepararFotoParaFirestore(file);
  const ref = doc(collection(db, "fotos"));
  setDoc(ref, {
    uid: currentUid,
    entryId: entryId,
    uidEntrada: claveFotos(entryId),
    nombre: file.name || "imagen.jpg",
    datos: datos,
    enApunte: true,
    orden: Date.now(),
    createdAt: serverTimestamp()
  }).catch(function (err) {
    logFoto("no se pudo guardar la imagen del apunte: " + (err && err.code ? err.code : err));
  });
  return { id: ref.id, datos: datos };
}

/* Una imagen recien insertada ocupaba el ancho entero del apunte: una
   foto del movil llenaba la pantalla y habia que hacer scroll para
   seguir leyendo. Entra al 60 % y desde ahi se ajusta. */
const APUNTE_ANCHO_INICIAL = 60;
/* El minimo y el maximo los aplica el arrastre de las esquinas. Entre
   ellos el tamano es continuo: lo decide la mano, no una lista. */
const APUNTE_ANCHO_MIN = 10;
const APUNTE_ANCHO_MAX = 100;

function buildApunteEditor(entry, statusText) {
  const wrap = document.createElement("div");
  wrap.className = "apunte";

  const barra = document.createElement("div");
  barra.className = "apunte-barra";

  const editor = document.createElement("div");
  editor.className = "field-body apunte-editor";
  editor.contentEditable = "true";
  editor.setAttribute("role", "textbox");
  editor.setAttribute("aria-multiline", "true");
  editor.setAttribute("aria-label", "Apuntes de clase");
  editor.dataset.vacio = "Escribe tus apuntes de clase…";
  editor.innerHTML = apunteComoHtml(entry);
  aplicarAnchosGuardados(editor);
  normalizarPiezasDelApunte(editor);

  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "image/*";
  fileInput.multiple = true;
  fileInput.style.display = "none";

  const estado = document.createElement("span");
  estado.className = "apunte-estado";

  function marcarVacio() {
    // El placeholder es CSS y necesita saber si hay algo dentro. innerText
    // no basta: un apunte que solo tiene una imagen no tiene texto.
    const vacio = !editor.textContent.trim() && !editor.querySelector("img");
    editor.dataset.estaVacio = vacio ? "si" : "no";
  }

  function guardar() {
    scheduleSave(
      "entries",
      entry.id,
      { bodyHtml: apunteParaGuardar(editor), body: editor.innerText },
      statusText
    );
    marcarVacio();
  }

  /* Botones de formato. execCommand esta marcado como obsoleto pero es lo
     unico que funciona igual en todos los navegadores sin traerse una
     libreria, y aqui no hay paso de compilacion. */
  function botonFormato(etiqueta, titulo, comando) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "apunte-btn";
    b.title = titulo;
    b.innerHTML = etiqueta;
    // mousedown y no click: al pulsar con click el editor ya perdio la
    // seleccion y el formato se aplicaria a la nada.
    b.addEventListener("mousedown", function (e) {
      e.preventDefault();
      editor.focus();
      document.execCommand(comando, false, null);
      guardar();
    });
    return b;
  }

  barra.appendChild(botonFormato("<b>N</b>", "Negrita", "bold"));
  barra.appendChild(botonFormato("<i>C</i>", "Cursiva", "italic"));
  barra.appendChild(botonFormato("<u>S</u>", "Subrayado", "underline"));
  const sep = document.createElement("span");
  sep.className = "apunte-sep";
  barra.appendChild(sep);
  barra.appendChild(botonFormato("• —", "Lista con viñetas", "insertUnorderedList"));
  barra.appendChild(botonFormato("1. —", "Lista numerada", "insertOrderedList"));
  const sep2 = document.createElement("span");
  sep2.className = "apunte-sep";
  barra.appendChild(sep2);

  const btnImagen = document.createElement("button");
  btnImagen.type = "button";
  btnImagen.className = "apunte-btn apunte-btn-imagen";
  btnImagen.textContent = "🖼 Imagen";
  btnImagen.title = "Insertar una imagen aquí";
  btnImagen.addEventListener("click", function () { fileInput.click(); });
  barra.appendChild(btnImagen);
  barra.appendChild(estado);

  /* Insertar en el punto del cursor. Si el cursor no esta dentro del
     editor (por ejemplo si vienes de pulsar el boton), va al final. */
  function insertarNodo(nodo) {
    editor.focus();
    const sel = window.getSelection();
    if (sel && sel.rangeCount && editor.contains(sel.anchorNode)) {
      const rango = sel.getRangeAt(0);
      rango.deleteContents();
      rango.insertNode(nodo);
      rango.setStartAfter(nodo);
      rango.collapse(true);
      sel.removeAllRanges();
      sel.addRange(rango);
    } else {
      editor.appendChild(nodo);
    }
  }

  let subiendo = 0;
  function pintarEstado() {
    estado.textContent = subiendo ? "Preparando " + subiendo + " imagen(es)…" : "";
  }

  async function agregarImagenes(archivos) {
    const lista = Array.from(archivos || []).filter(function (f) { return f && f.type && f.type.indexOf("image/") === 0; });
    if (!lista.length) return;
    for (const file of lista) {
      subiendo++;
      pintarEstado();
      try {
        const guardada = await guardarImagenDeApunte(entry.id, file);
        const img = document.createElement("img");
        img.src = guardada.datos;
        img.setAttribute("data-foto", guardada.id);
        img.alt = file.name || "Imagen del apunte";
        img.setAttribute("draggable", "false");
        const figura = crearFiguraDeImagen(img);
        figura.style.width = APUNTE_ANCHO_INICIAL + "%";
        figura.setAttribute("data-ancho", APUNTE_ANCHO_INICIAL);
        figura.setAttribute("data-pos", "centro");
        insertarPieza(figura);
        guardar();
      } catch (err) {
        alert(
          err && err.message === "foto-demasiado-grande"
            ? "Esa imagen es demasiado grande incluso comprimida. Prueba con una captura más pequeña."
            : "No se pudo preparar la imagen. Inténtalo de nuevo."
        );
      } finally {
        subiendo--;
        pintarEstado();
      }
    }
  }

  fileInput.addEventListener("change", function () {
    agregarImagenes(fileInput.files);
    fileInput.value = "";
  });

  /* Pegar. Si en el portapapeles hay una imagen (una captura de pantalla,
     lo mas habitual copiando de una diapositiva) se inserta; si hay texto,
     se pega en PLANO a proposito: copiar de una web arrastra su hoja de
     estilos entera y el apunte queda con tipografias y colores ajenos. */
  editor.addEventListener("paste", function (e) {
    const datos = e.clipboardData;
    if (!datos) return;
    const imagenes = Array.from(datos.items || [])
      .filter(function (i) { return i.kind === "file" && i.type.indexOf("image/") === 0; })
      .map(function (i) { return i.getAsFile(); })
      .filter(Boolean);
    if (imagenes.length) {
      e.preventDefault();
      agregarImagenes(imagenes);
      return;
    }
    e.preventDefault();
    const texto = datos.getData("text/plain");
    if (texto) document.execCommand("insertText", false, texto);
  });

  /* ---------- Manipular la imagen como en Word ----------

     Sin botones: se agarra la imagen y se arrastra donde quieras, y se
     agarra una esquina para cambiarle el tamano. La version anterior tenia
     una barra de botones y estaba mal pensada — cambiar de tamano a saltos
     de 10 % no es decidir el tamano, es elegir entre diez.

     Todo el andamiaje (marco y esquinas) vive FUERA del contenteditable:
     dentro seria contenido del apunte, se borraria con la tecla de
     retroceso y acabaria guardado en el HTML.

     El fallo de "la imagen se reinicia al moverla": arrastrar una imagen
     dentro de un contenteditable es un drag-and-drop del navegador, y para
     que un soltar sea valido hay que cancelar el dragover. El dragover de
     aqui solo lo cancelaba cuando venian ARCHIVOS de fuera, asi que al
     mover una imagen ya puesta el navegador daba el arrastre por invalido
     y la devolvia a su sitio. Ahora se cancela siempre y el movimiento se
     hace a mano, colocando la imagen en el punto exacto del cursor. */
  const marco = document.createElement("div");
  marco.className = "apunte-marco";
  marco.hidden = true;
  const ESQUINAS = ["ni", "nd", "si", "sd"];
  const manijas = ESQUINAS.map(function (pos) {
    const m = document.createElement("span");
    m.className = "apunte-manija apunte-manija-" + pos;
    m.dataset.esquina = pos;
    marco.appendChild(m);
    return m;
  });

  let imgSel = null;

  function anchoUtilEditor() {
    const cs = getComputedStyle(editor);
    return editor.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  }

  function colocarMarco() {
    if (!imgSel || !editor.contains(imgSel)) { ocultarMarco(); return; }
    const caja = imgSel.getBoundingClientRect();
    const ref = editor.getBoundingClientRect();
    marco.style.left = caja.left - ref.left + "px";
    marco.style.top = caja.top - ref.top + "px";
    marco.style.width = caja.width + "px";
    marco.style.height = caja.height + "px";
  }

  function ocultarMarco() {
    if (imgSel) imgSel.classList.remove("apunte-img-sel");
    imgSel = null;
    marco.hidden = true;
  }

  function seleccionarImagen(img) {
    if (imgSel && imgSel !== img) imgSel.classList.remove("apunte-img-sel");
    imgSel = img;
    img.classList.add("apunte-img-sel");
    marco.hidden = false;
    colocarMarco();
  }

  /* --- Cambiar el tamano arrastrando una esquina ---
     Pointer Events y no mouse: el mismo codigo sirve con el dedo, y la
     captura del puntero hace que el arrastre siga funcionando aunque se
     salga de la manija. */
  manijas.forEach(function (manija) {
    manija.addEventListener("pointerdown", function (e) {
      if (!imgSel) return;
      e.preventDefault();
      e.stopPropagation();
      manija.setPointerCapture(e.pointerId);

      const esquina = manija.dataset.esquina;
      const objetivo = envoltorioDeImagen(imgSel);
      const inicioX = e.clientX;
      const anchoInicial = objetivo.getBoundingClientRect().width;
      const util = anchoUtilEditor();
      // Las esquinas de la izquierda crecen al arrastrar hacia fuera.
      const signo = esquina === "ni" || esquina === "si" ? -1 : 1;
      marco.classList.add("apunte-marco-activo");

      function mover(ev) {
        const nuevoPx = anchoInicial + (ev.clientX - inicioX) * signo;
        const pct = Math.min(APUNTE_ANCHO_MAX, Math.max(APUNTE_ANCHO_MIN, (nuevoPx / util) * 100));
        const ancho = Math.round(pct * 10) / 10;
        objetivo.style.width = ancho + "%";
        objetivo.setAttribute("data-ancho", ancho);
        colocarMarco();
      }
      function soltar() {
        manija.removeEventListener("pointermove", mover);
        manija.removeEventListener("pointerup", soltar);
        manija.removeEventListener("pointercancel", soltar);
        marco.classList.remove("apunte-marco-activo");
        guardar();
      }
      manija.addEventListener("pointermove", mover);
      manija.addEventListener("pointerup", soltar);
      manija.addEventListener("pointercancel", soltar);
    });
  });

  /* --- Moverla arrastrandola ---

     La version anterior usaba el arrastre nativo del navegador (dragstart,
     dragover, drop). Dentro de un contenteditable ese arrastre NO es solo
     un arrastre: es una operacion de edicion de Chrome, que decide por su
     cuenta si mueve el nodo, si lo vuelve a crear a partir de su HTML o si
     deshace todo. De ahi los dos fallos que reporto Daniel: la imagen se
     iba a donde ella queria, y volvia a salir grande porque el navegador
     la reconstruia perdiendo el ancho.

     Aqui el arrastre lo hacemos nosotros con Pointer Events, igual que el
     de las esquinas: el nodo es SIEMPRE el mismo, se mueve una sola vez al
     soltar y el navegador no participa. El arrastre nativo queda apagado
     con draggable=false. */
  const guia = document.createElement("span");
  guia.className = "apunte-guia";
  guia.hidden = true;

  function apagarArrastreNativo(raiz) {
    Array.from(raiz.querySelectorAll("img")).forEach(function (img) {
      img.setAttribute("draggable", "false");
    });
  }
  apagarArrastreNativo(editor);

  /* --- Donde cae la imagen ---

     Como la imagen es un bloque, no se coloca en un punto del texto sino
     ENTRE dos lineas. La guia deja de ser un cursor vertical y pasa a ser
     una raya horizontal en el hueco donde va a caer, con un punto que
     ademas indica a que lado quedara. */

  function bloqueDeNivelSuperior(nodo) {
    let n = nodo;
    while (n && n.parentNode && n.parentNode !== editor) n = n.parentNode;
    return n && n.parentNode === editor ? n : null;
  }

  /* Un hijo del apunte puede ser texto suelto, y el texto no tiene caja
     propia: hay que pedirsela a un rango. */
  function cajaDeNodo(nodo) {
    if (nodo.nodeType === 1) return nodo.getBoundingClientRect();
    const r = document.createRange();
    r.selectNodeContents(nodo);
    return r.getBoundingClientRect();
  }

  /* { ref, antes }: junto a que bloque cae y de que lado. Se elige el
     bloque mas cercano en vertical, no el que esta debajo del dedo: si
     sueltas en el margen o en un hueco, la imagen tiene que ir a algun
     sitio razonable igualmente. */
  function puntoDeSoltar(y) {
    const hijos = Array.from(editor.childNodes).filter(function (n) {
      return n.nodeType === 1 || (n.nodeType === 3 && n.textContent.trim());
    });
    let mejor = null;
    let mejorDist = Infinity;
    hijos.forEach(function (n) {
      const c = cajaDeNodo(n);
      if (!c || (!c.height && !c.width)) return;
      const dist = y < c.top ? c.top - y : y > c.bottom ? y - c.bottom : 0;
      if (dist < mejorDist) {
        mejorDist = dist;
        mejor = { ref: n, antes: y < c.top + c.height / 2 };
      }
    });
    return mejor;
  }

  /* Donde sueltas en horizontal decide el lado. Un bloque sin esto queda
     siempre pegado a la izquierda, y entonces "la muevo donde quiero" solo
     seria verdad hacia arriba y hacia abajo. */
  function posicionPorX(x) {
    const ref = editor.getBoundingClientRect();
    const rel = (x - ref.left) / (ref.width || 1);
    return rel < 0.34 ? "izq" : rel < 0.67 ? "centro" : "der";
  }

  function colocarPieza(pieza, punto, pos) {
    pieza.setAttribute("data-pos", pos);
    if (!punto) { editor.appendChild(pieza); return; }
    if (punto.ref === pieza || pieza.contains(punto.ref)) return;
    editor.insertBefore(pieza, punto.antes ? punto.ref : punto.ref.nextSibling);
  }

  function pintarGuia(punto, x) {
    if (!punto) { guia.hidden = true; return; }
    const c = cajaDeNodo(punto.ref);
    const ref = editor.getBoundingClientRect();
    if (!c || (!c.height && !c.width)) { guia.hidden = true; return; }
    guia.hidden = false;
    guia.classList.add("apunte-guia-bloque");
    guia.dataset.pos = posicionPorX(x);
    guia.style.left = "0px";
    guia.style.width = editor.clientWidth + "px";
    guia.style.height = "3px";
    guia.style.top = (punto.antes ? c.top : c.bottom) - ref.top + "px";
  }

  /* Una imagen entra debajo de la linea donde esta el cursor y deja una
     linea vacia detras, para poder seguir escribiendo sin buscar sitio. */
  function insertarPieza(pieza) {
    const sel = window.getSelection();
    const ancla = sel && sel.rangeCount && editor.contains(sel.anchorNode)
      ? bloqueDeNivelSuperior(sel.anchorNode)
      : null;
    if (ancla) editor.insertBefore(pieza, ancla.nextSibling);
    else editor.appendChild(pieza);
    const linea = document.createElement("div");
    linea.appendChild(document.createElement("br"));
    editor.insertBefore(linea, pieza.nextSibling);
    editor.focus();
    const r = document.createRange();
    r.setStart(linea, 0);
    r.collapse(true);
    const s = window.getSelection();
    s.removeAllRanges();
    s.addRange(r);
  }

  const ARRASTRE_MINIMO = 4; // px antes de considerar que es un arrastre y no un clic

  editor.addEventListener("pointerdown", function (e) {
    const img = e.target && e.target.tagName === "IMG" ? e.target : null;
    if (!img || e.button !== 0) return;
    // Sin esto Chrome empieza su propia seleccion/arrastre de edicion.
    e.preventDefault();
    seleccionarImagen(img);

    const inicioX = e.clientX;
    const inicioY = e.clientY;
    let moviendo = false;
    editor.setPointerCapture(e.pointerId);

    function mover(ev) {
      if (!moviendo) {
        if (Math.abs(ev.clientX - inicioX) + Math.abs(ev.clientY - inicioY) < ARRASTRE_MINIMO) return;
        moviendo = true;
        img.classList.add("apunte-img-moviendo");
        marco.hidden = true;
      }
      pintarGuia(puntoDeSoltar(ev.clientY), ev.clientX);
    }

    function soltar(ev) {
      editor.removeEventListener("pointermove", mover);
      editor.removeEventListener("pointerup", soltar);
      editor.removeEventListener("pointercancel", soltar);
      guia.hidden = true;
      img.classList.remove("apunte-img-moviendo");
      if (!moviendo) { colocarMarco(); return; } // era un clic: solo seleccionar
      /* Se mueve el envoltorio: con la figura suelta, el titulo se
         quedaria donde estaba y la imagen se iria sola. */
      const pieza = envoltorioDeImagen(img);
      colocarPieza(pieza, puntoDeSoltar(ev.clientY), posicionPorX(ev.clientX));
      guia.classList.remove("apunte-guia-bloque");
      marco.hidden = false;
      colocarMarco();
      guardar();
    }

    editor.addEventListener("pointermove", mover);
    editor.addEventListener("pointerup", soltar);
    editor.addEventListener("pointercancel", soltar);
  });

  /* Del arrastre nativo solo queda lo que viene de FUERA: soltar archivos
     de imagen encima del apunte. */
  editor.addEventListener("dragstart", function (e) {
    if (e.target && e.target.tagName === "IMG") e.preventDefault();
  });

  editor.addEventListener("dragover", function (e) {
    const traeArchivos = e.dataTransfer && Array.from(e.dataTransfer.types || []).includes("Files");
    if (!traeArchivos) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    editor.classList.add("apunte-soltar");
  });

  editor.addEventListener("dragleave", function () { editor.classList.remove("apunte-soltar"); });

  editor.addEventListener("drop", function (e) {
    const archivos = e.dataTransfer && e.dataTransfer.files;
    if (!archivos || !archivos.length) return;
    e.preventDefault();
    editor.classList.remove("apunte-soltar");
    agregarImagenes(archivos);
  });

  editor.addEventListener("input", guardar);

  /* Un clic selecciona (y saca el marco con sus esquinas). Doble clic abre
     el visor a pantalla completa: al primer toque impedia ajustarla. */
  editor.addEventListener("click", function (e) {
    const img = e.target && e.target.tagName === "IMG" ? e.target : null;
    if (img) seleccionarImagen(img);
    else ocultarMarco();
  });
  editor.addEventListener("dblclick", function (e) {
    const img = e.target && e.target.tagName === "IMG" ? e.target : null;
    if (!img || !img.getAttribute("src")) return;
    abrirVisorFoto([{ datos: img.getAttribute("src"), nombre: img.alt || "Imagen del apunte" }], 0);
  });
  editor.addEventListener("scroll", colocarMarco);
  window.addEventListener("resize", colocarMarco);
  // Si la imagen se borra escribiendo, el marco se queda huerfano.
  editor.addEventListener("input", function () {
    if (imgSel && !editor.contains(imgSel)) ocultarMarco();
    else colocarMarco();
  });

  wrap.appendChild(barra);
  const zonaEditor = document.createElement("div");
  zonaEditor.className = "apunte-zona";
  zonaEditor.appendChild(editor);
  zonaEditor.appendChild(marco);
  zonaEditor.appendChild(guia);
  wrap.appendChild(zonaEditor);
  wrap.appendChild(fileInput);
  marcarVacio();

  /* Rellenar los src. En bodyHtml las imagenes van sin src (ver arriba),
     asi que hasta que llega esta consulta se ven como huecos. Una sola
     consulta para todas: son la misma coleccion y el mismo uidEntrada. */
  const pendientes = Array.from(editor.querySelectorAll("img[data-foto]"));
  if (pendientes.length) {
    pendientes.forEach(function (img) { img.classList.add("apunte-img-cargando"); });
    fotosDeEntrada(entry.id)
      .then(function (fotos) {
        const porId = {};
        fotos.forEach(function (f) { porId[f.id] = f; });
        pendientes.forEach(function (img) {
          const f = porId[img.getAttribute("data-foto")];
          img.classList.remove("apunte-img-cargando");
          if (f && f.datos) img.src = f.datos;
          else img.classList.add("apunte-img-rota");
        });
      })
      .catch(function () {
        pendientes.forEach(function (img) {
          img.classList.remove("apunte-img-cargando");
          img.classList.add("apunte-img-rota");
        });
      });
  }

  return wrap;
}

/* =====================================================================
   EXAMENES DE LABORATORIO Y GABINETE
   =====================================================================

   Un examen tiene DOS partes y se guardan por separado a proposito:

   1. La hoja escaneada o fotografiada, que es la prueba y no se discute.
   2. Los valores que importan, escritos a mano. Esos si se pueden leer,
      comparar entre consultas y marcar como altos o bajos.

   Por que todo vive en la coleccion "fotos" y no en una nueva: las reglas
   de Firestore ya la cubren, la consulta por caso ya existe y no hace
   falta ningun indice nuevo. "fotos" es en realidad "adjuntos de una
   entrada"; el campo "clase" dice de que tipo es cada uno:

     sin clase   foto suelta del caso (las de siempre)
     "examen"    la ficha del examen: tipo, fecha, laboratorio, valores
     "pagina"    una hoja de un examen, con examenId apuntando a su ficha

   Con una coleccion aparte habria que publicar reglas nuevas, y hasta que
   se publicaran la app daria permission-denied sin explicar por que. Asi
   funciona en cuanto se sube el archivo. */

const EXAMEN_TIPOS = [
  "Hemograma",
  "Química sanguínea",
  "Urianálisis",
  "Coproparasitario",
  "Radiografía",
  "Ecografía",
  "Citología",
  "Prueba rápida / serología",
  "Otro"
];

/* Sugerencias de analitos con su unidad habitual. NO traen rango de
   referencia, y es deliberado: el rango depende del equipo con el que se
   corrio la muestra, y el laboratorio lo imprime en su propia hoja. Un
   rango inventado aqui marcaria en rojo un resultado normal, o al reves.
   Los dos campos de rango se rellenan copiando los de la hoja. */
const EXAMEN_ANALITOS = {
  "Hemograma": [
    ["Hematocrito", "%"], ["Hemoglobina", "g/dL"], ["Eritrocitos", "10⁶/µL"],
    ["Leucocitos", "/µL"], ["Neutrófilos", "/µL"], ["Linfocitos", "/µL"],
    ["Monocitos", "/µL"], ["Eosinófilos", "/µL"], ["Plaquetas", "/µL"]
  ],
  "Química sanguínea": [
    ["Creatinina", "mg/dL"], ["BUN", "mg/dL"], ["ALT", "U/L"], ["AST", "U/L"],
    ["Fosfatasa alcalina", "U/L"], ["Glucosa", "mg/dL"], ["Proteínas totales", "g/dL"],
    ["Albúmina", "g/dL"], ["Fósforo", "mg/dL"], ["Calcio", "mg/dL"]
  ],
  "Urianálisis": [
    ["Densidad", ""], ["pH", ""], ["Proteína", "mg/dL"], ["Glucosa", "mg/dL"],
    ["Relación proteína/creatinina", ""]
  ],
  "Coproparasitario": [["Huevos por gramo", "hpg"]],
  "Prueba rápida / serología": [["Título", ""]]
};

/* El modo escaner arruina una radiografia: la pasa a blanco y negro
   duro y se pierde justo lo que hay que ver. Estos tipos son imagen
   medica, no papel, y entran sin tocar. El interruptor de la ficha
   manda sobre esto: es solo el valor por defecto. */
const EXAMEN_TIPOS_IMAGEN = ["Radiografía", "Ecografía", "Citología"];

function escanearPorDefecto(tipo) {
  return EXAMEN_TIPOS_IMAGEN.indexOf(tipo) < 0;
}

function analitosDeTipo(tipo) {
  return EXAMEN_ANALITOS[tipo] || [];
}

/* Los adjuntos de un caso ya vienen todos en una consulta; aqui solo se
   reparten. Filtrar en el cliente y no en la consulta evita tener que
   crear un indice compuesto nuevo. */
function repartirAdjuntos(lista) {
  const examenes = [];
  const paginas = {};
  const fotos = [];
  (lista || []).forEach(function (d) {
    if (d.clase === "examen") examenes.push(d);
    else if (d.clase === "pagina") {
      const k = d.examenId || "";
      (paginas[k] = paginas[k] || []).push(d);
    } else if (!d.enApunte) fotos.push(d);
  });
  return { examenes: examenes, paginas: paginas, fotos: fotos };
}

/* --- Modo escaner ---
   Una foto de una hoja impresa sale gris y con sombra, y al comprimirla
   para que quepa, el texto pequeno se vuelve ilegible. Esto la pasa a
   escala de grises y estira los niveles entre el percentil 5 y el 95: el
   papel sale blanco y la letra negra. Percentiles y no minimo/maximo
   porque un solo pixel oscuro —una sombra, el borde de la mesa— arruinaria
   el estirado entero. */
function procesarComoEscaneo(file) {
  return new Promise(function (resolve) {
    if (!file.type || file.type.indexOf("image/") !== 0) { resolve(file); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    let hecho = false;
    function salir(res, motivo) {
      if (hecho) return;
      hecho = true;
      clearTimeout(temporizador);
      URL.revokeObjectURL(url);
      logFoto("escaneo: " + motivo);
      resolve(res);
    }
    const temporizador = setTimeout(function () { salir(file, "tardó demasiado, se usa la original"); }, 15000);
    img.onerror = function () { salir(file, "no se pudo decodificar"); };
    img.onload = function () {
      try {
        // Mas resolucion que una foto normal: la letra de un laboratorio
        // a 1600 px se lee a duras penas.
        const lado = 2000;
        let w = img.naturalWidth || img.width;
        let h = img.naturalHeight || img.height;
        if (!w || !h) { salir(file, "sin dimensiones"); return; }
        if (w > lado || h > lado) {
          if (w >= h) { h = Math.round((h * lado) / w); w = lado; }
          else { w = Math.round((w * lado) / h); h = lado; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) { salir(file, "sin contexto de canvas"); return; }
        ctx.drawImage(img, 0, 0, w, h);
        const datos = ctx.getImageData(0, 0, w, h);
        const px = datos.data;

        /* Division por el fondo local.

           El primer intento estiraba los niveles entre el percentil 5 y el
           95 y no hacia practicamente nada: en una hoja escrita la tinta
           es menos del 5 % de los pixeles, asi que los dos percentiles
           caen DENTRO del papel y el estirado se anula solo. Medido: una
           hoja de 105–200 salia 95–214, o sea igual.

           Lo que si funciona es estimar cuanta luz le llega a cada zona
           del papel y dividir por ella. La estimacion es la propia imagen
           reducida a un pu~nado de pixeles y vuelta a estirar: a esa
           escala la letra desaparece y solo queda la iluminacion, sombra
           de la mano incluida. Cada pixel se compara entonces con SU
           fondo, no con el de la hoja entera. */
        const lienzoFondo = document.createElement("canvas");
        const anchoFondo = Math.max(8, Math.round(w / 24));
        lienzoFondo.width = anchoFondo;
        lienzoFondo.height = Math.max(8, Math.round((h * anchoFondo) / w));
        const ctxFondo = lienzoFondo.getContext("2d");
        ctxFondo.imageSmoothingEnabled = true;
        ctxFondo.drawImage(canvas, 0, 0, lienzoFondo.width, lienzoFondo.height);

        const lienzoEstirado = document.createElement("canvas");
        lienzoEstirado.width = w;
        lienzoEstirado.height = h;
        const ctxEstirado = lienzoEstirado.getContext("2d");
        ctxEstirado.imageSmoothingEnabled = true;
        ctxEstirado.drawImage(lienzoFondo, 0, 0, w, h);
        const fondo = ctxEstirado.getImageData(0, 0, w, h).data;

        /* El papel queda en 1 y la tinta por debajo. Todo lo que llegue a
           SUELO_TINTA o menos se va a negro y de PISO_PAPEL para arriba a
           blanco; en medio se reparte. Con el suelo mas alto la letra fina
           se rompe, con el mas bajo la hoja sale gris. */
        const SUELO_TINTA = 0.62;
        const PISO_PAPEL = 0.94;
        const rango = PISO_PAPEL - SUELO_TINTA;
        for (let i = 0; i < px.length; i += 4) {
          const g = (px[i] * 299 + px[i + 1] * 587 + px[i + 2] * 114) / 1000;
          const f = (fondo[i] * 299 + fondo[i + 1] * 587 + fondo[i + 2] * 114) / 1000;
          const r = f > 8 ? g / f : 1;
          let v = ((r - SUELO_TINTA) / rango) * 255;
          v = v < 0 ? 0 : v > 255 ? 255 : v;
          px[i] = px[i + 1] = px[i + 2] = v;
        }
        ctx.putImageData(datos, 0, 0);
        canvas.toBlob(function (blob) {
          if (!blob) { salir(file, "toBlob vacío, se usa la original"); return; }
          salir(blob, "hoja lista, " + w + "×" + h + ", " + Math.round(blob.size / 1024) + " KB");
        }, "image/jpeg", 0.9);
      } catch (err) {
        salir(file, "falló: " + (err && err.message));
      }
    };
    img.src = url;
  });
}

function fechaDeSubida(pagina) {
  /* createdAt lo pone el servidor y tarda en volver; orden es Date.now()
     escrito en el momento. Mientras la escritura viaja, orden es lo
     unico que hay, y sin el la hoja recien subida saldria sin fecha. */
  const t = pagina && pagina.createdAt && typeof pagina.createdAt.toDate === "function"
    ? pagina.createdAt.toDate()
    : pagina && pagina.orden ? new Date(pagina.orden) : null;
  if (!t || isNaN(t.getTime())) return "";
  // Un "orden" que no era una marca de tiempo daria 1969: mejor sin fecha
  // que con una que no significa nada.
  if (t.getFullYear() < 2000) return "";
  return t.toLocaleDateString("es-EC", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

async function crearExamen(entryId) {
  const base = {
    clase: "examen",
    uid: currentUid,
    entryId: entryId,
    uidEntrada: claveFotos(entryId),
    tipo: EXAMEN_TIPOS[0],
    fecha: todayISO(),
    laboratorio: "",
    notas: "",
    valores: [],
    orden: Date.now(),
    createdAt: serverTimestamp()
  };
  const ref = await addDoc(collection(db, "fotos"), base);
  return { ...base, id: ref.id, createdAt: null };
}

async function guardarPaginaDeExamen(entryId, examenId, file, comoEscaneo) {
  const fuente = comoEscaneo ? await procesarComoEscaneo(file) : file;
  const datos = await prepararFotoParaFirestore(fuente);
  const nombre = file.name || "página.jpg";
  const ref = await addDoc(collection(db, "fotos"), {
    clase: "pagina",
    examenId: examenId,
    uid: currentUid,
    entryId: entryId,
    uidEntrada: claveFotos(entryId),
    nombre: nombre,
    datos: datos,
    orden: Date.now(),
    createdAt: serverTimestamp()
  });
  return { id: ref.id, clase: "pagina", examenId: examenId, nombre: nombre, datos: datos };
}

/* Alto o bajo respecto al rango que se copio de la hoja. Devuelve null si
   falta el dato o el rango: sin rango no se opina. */
function estadoDeValor(valor, min, max) {
  const v = parseFloat(String(valor == null ? "" : valor).replace(",", "."));
  if (!isFinite(v)) return null;
  const lo = parseFloat(String(min == null ? "" : min).replace(",", "."));
  const hi = parseFloat(String(max == null ? "" : max).replace(",", "."));
  if (!isFinite(lo) && !isFinite(hi)) return null;
  if (isFinite(hi) && v > hi) return "alto";
  if (isFinite(lo) && v < lo) return "bajo";
  return "ok";
}

/* La seccion entera. Recibe los adjuntos ya cargados por la seccion de
   fotos para no repetir la consulta: es la misma. */
function buildExamenesSection(entry, statusText, cargarAdjuntos) {
  const wrap = document.createElement("div");
  wrap.className = "examenes";

  const head = document.createElement("div");
  head.className = "subcard-head";
  const titulo = document.createElement("span");
  titulo.textContent = "Exámenes (laboratorio, imagen)";
  head.appendChild(titulo);
  const btnNuevo = document.createElement("button");
  btnNuevo.type = "button";
  btnNuevo.className = "btn-mini";
  btnNuevo.textContent = "+ Examen";
  head.appendChild(btnNuevo);
  wrap.appendChild(head);

  const lista = document.createElement("div");
  lista.className = "examen-lista";
  wrap.appendChild(lista);

  const vacio = document.createElement("p");
  vacio.className = "examenes-vacio";
  vacio.textContent = "Cargando exámenes…";
  wrap.appendChild(vacio);

  let examenes = [];
  let paginas = {};

  function guardarCampo(examen, campo, valor) {
    examen[campo] = valor;
    scheduleSave("fotos", examen.id, { [campo]: valor }, statusText);
  }

  /* Una fila de valor. Se construye UNA vez y despues solo se muta el
     objeto: si se redibujara la lista en cada tecla, el campo que estas
     escribiendo dejaria de existir bajo el cursor. */
  function filaDeValor(examen, valor, alBorrar) {
    const fila = document.createElement("div");
    fila.className = "examen-valor";

    function campo(clase, marcador, clave, ancho) {
      const i = document.createElement("input");
      i.className = "examen-campo " + clase;
      i.placeholder = marcador;
      i.value = valor[clave] == null ? "" : valor[clave];
      if (ancho) i.inputMode = ancho;
      i.addEventListener("input", function () {
        valor[clave] = i.value;
        pintarEstado();
        guardarCampo(examen, "valores", examen.valores);
      });
      return i;
    }

    const nombre = campo("examen-campo-nombre", "Analito", "nombre");
    // Lista de sugerencias segun el tipo de examen, sin impedir escribir
    // cualquier otra cosa.
    const listaId = "analitos-" + examen.id;
    nombre.setAttribute("list", listaId);
    fila.appendChild(nombre);

    fila.appendChild(campo("examen-campo-valor", "Valor", "valor", "decimal"));
    fila.appendChild(campo("examen-campo-unidad", "Unidad", "unidad"));

    const ref = document.createElement("div");
    ref.className = "examen-ref";
    const min = campo("examen-campo-lim", "mín", "min", "decimal");
    const guionRef = document.createElement("span");
    guionRef.textContent = "–";
    const max = campo("examen-campo-lim", "máx", "max", "decimal");
    ref.appendChild(min);
    ref.appendChild(guionRef);
    ref.appendChild(max);
    fila.appendChild(ref);

    const marca = document.createElement("span");
    marca.className = "examen-marca";
    fila.appendChild(marca);

    function pintarEstado() {
      const est = estadoDeValor(valor.valor, valor.min, valor.max);
      marca.dataset.estado = est || "";
      marca.textContent = est === "alto" ? "↑ alto" : est === "bajo" ? "↓ bajo" : est === "ok" ? "✓" : "";
    }
    pintarEstado();

    // Al elegir un analito de la lista se rellena su unidad habitual.
    nombre.addEventListener("change", function () {
      if (valor.unidad) return;
      const encontrado = analitosDeTipo(examen.tipo).find(function (a) { return a[0] === nombre.value; });
      if (!encontrado || !encontrado[1]) return;
      valor.unidad = encontrado[1];
      fila.querySelector(".examen-campo-unidad").value = encontrado[1];
      guardarCampo(examen, "valores", examen.valores);
    });

    const quitar = document.createElement("button");
    quitar.type = "button";
    quitar.className = "examen-quitar";
    quitar.textContent = "×";
    quitar.setAttribute("aria-label", "Quitar este valor");
    quitar.addEventListener("click", function () { alBorrar(); });
    fila.appendChild(quitar);

    return fila;
  }

  function tarjetaDeExamen(examen) {
    const card = document.createElement("div");
    card.className = "examen";

    /* --- cabecera: tipo, fecha, laboratorio --- */
    const filaTop = document.createElement("div");
    filaTop.className = "examen-top";

    const tipoSel = document.createElement("select");
    tipoSel.className = "examen-tipo";
    EXAMEN_TIPOS.forEach(function (t) {
      const o = document.createElement("option");
      o.value = t;
      o.textContent = t;
      tipoSel.appendChild(o);
    });
    tipoSel.value = examen.tipo || EXAMEN_TIPOS[0];
    filaTop.appendChild(tipoSel);

    const fecha = document.createElement("input");
    fecha.type = "date";
    fecha.className = "examen-fecha";
    fecha.value = examen.fecha || "";
    fecha.addEventListener("input", function () { guardarCampo(examen, "fecha", fecha.value); });
    filaTop.appendChild(fecha);

    const lab = document.createElement("input");
    lab.className = "examen-lab";
    lab.placeholder = "Laboratorio";
    lab.value = examen.laboratorio || "";
    lab.addEventListener("input", function () { guardarCampo(examen, "laboratorio", lab.value); });
    filaTop.appendChild(lab);

    /* Se guarda como campo propio y no se deduce cada vez: si el tipo
       cambia despues, lo que decidio Daniel para este examen manda. */
    const escLabel = document.createElement("label");
    escLabel.className = "examen-escaner";
    const escCheck = document.createElement("input");
    escCheck.type = "checkbox";
    escCheck.checked = examen.escaner == null ? escanearPorDefecto(examen.tipo) : !!examen.escaner;
    escCheck.addEventListener("change", function () {
      guardarCampo(examen, "escaner", escCheck.checked);
    });
    escLabel.appendChild(escCheck);
    const escTexto = document.createElement("span");
    escTexto.textContent = "Modo escáner";
    escLabel.title = "Realza el texto de una hoja impresa. Desactívalo para radiografías y ecografías.";
    escLabel.appendChild(escTexto);
    filaTop.appendChild(escLabel);

    const borrar = document.createElement("button");
    borrar.type = "button";
    borrar.className = "examen-borrar";
    borrar.textContent = "Eliminar";
    filaTop.appendChild(borrar);
    card.appendChild(filaTop);

    /* --- paginas --- */
    const tira = document.createElement("div");
    tira.className = "examen-paginas";
    card.appendChild(tira);

    /* Dos entradas distintas y no una: con capture el movil abre la camara
       directamente, que es lo que quieres con la hoja en la mano. Sin
       capture abre la galeria o los archivos, que es lo que quieres cuando
       el examen ya te llego por mensaje. */
    const entradaCamara = document.createElement("input");
    entradaCamara.type = "file";
    entradaCamara.accept = "image/*";
    entradaCamara.setAttribute("capture", "environment");
    entradaCamara.style.display = "none";
    card.appendChild(entradaCamara);

    const entradaArchivo = document.createElement("input");
    entradaArchivo.type = "file";
    entradaArchivo.accept = "image/*";
    entradaArchivo.multiple = true;
    entradaArchivo.style.display = "none";
    card.appendChild(entradaArchivo);

    function pintarPaginas() {
      tira.innerHTML = "";
      const mias = (paginas[examen.id] || []).slice().sort(function (a, b) { return (a.orden || 0) - (b.orden || 0); });
      mias.forEach(function (pag, i) {
        const caja = document.createElement("div");
        caja.className = "examen-pagina-caja";
        const tile = document.createElement("div");
        tile.className = "photo-tile examen-pagina";
        const img = document.createElement("img");
        img.src = pag.datos;
        img.alt = pag.nombre || "Página del examen";
        img.loading = "lazy";
        if (!pag.subiendo) {
          img.style.cursor = "zoom-in";
          img.addEventListener("click", function () {
            const verEstas = mias.filter(function (p) { return !p.subiendo; });
            abrirVisorFoto(verEstas, verEstas.indexOf(pag));
          });
        }
        tile.appendChild(img);

        const num = document.createElement("span");
        num.className = "examen-pagina-num";
        num.textContent = i + 1;
        tile.appendChild(num);

        if (pag.subiendo) {
          const spin = document.createElement("div");
          spin.className = "photo-uploading";
          spin.textContent = "Guardando…";
          tile.appendChild(spin);
        } else {
          const quitar = document.createElement("button");
          quitar.type = "button";
          quitar.className = "photo-remove";
          quitar.textContent = "×";
          quitar.setAttribute("aria-label", "Eliminar esta página");
          quitar.addEventListener("click", async function () {
            const ok = await askConfirm({
              title: "¿Eliminar esta página?",
              message: "Se borra definitivamente y no se puede deshacer.",
              confirmLabel: "Eliminar"
            });
            if (!ok) return;
            paginas[examen.id] = (paginas[examen.id] || []).filter(function (p) { return p !== pag; });
            pintarPaginas();
            try { await deleteDoc(doc(db, "fotos", pag.id)); }
            catch (err) { logFoto("no se pudo borrar la página: " + ((err && err.code) || err)); }
          });
          tile.appendChild(quitar);
        }
        caja.appendChild(tile);
        const cuando = document.createElement("span");
        cuando.className = "examen-pagina-fecha";
        cuando.textContent = pag.subiendo ? "subiendo…" : fechaDeSubida(pag);
        cuando.title = "Fecha en que se subió esta hoja";
        caja.appendChild(cuando);
        tira.appendChild(caja);
      });

      const btnCam = document.createElement("button");
      btnCam.type = "button";
      btnCam.className = "photo-add examen-add";
      btnCam.innerHTML = "<span>📷</span><small>Escanear</small>";
      btnCam.title = "Fotografiar la hoja con la cámara";
      btnCam.addEventListener("click", function () { entradaCamara.click(); });
      tira.appendChild(btnCam);

      const btnArch = document.createElement("button");
      btnArch.type = "button";
      btnArch.className = "photo-add examen-add";
      btnArch.innerHTML = "<span>📎</span><small>Archivo</small>";
      btnArch.title = "Subir una imagen que ya tienes";
      btnArch.addEventListener("click", function () { entradaArchivo.click(); });
      tira.appendChild(btnArch);
    }

    async function subirPaginas(archivos, comoEscaneo) {
      for (const file of Array.from(archivos || [])) {
        if (!file.type || file.type.indexOf("image/") !== 0) continue;
        const provisional = {
          id: "tmp-" + Date.now() + Math.random(),
          examenId: examen.id,
          nombre: file.name,
          datos: URL.createObjectURL(file),
          orden: Date.now(),
          subiendo: true
        };
        paginas[examen.id] = (paginas[examen.id] || []).concat([provisional]);
        pintarPaginas();
        try {
          const guardada = await guardarPaginaDeExamen(entry.id, examen.id, file, comoEscaneo);
          URL.revokeObjectURL(provisional.datos);
          paginas[examen.id] = paginas[examen.id].map(function (p) {
            return p === provisional ? { ...guardada, orden: provisional.orden, _pending: !navigator.onLine } : p;
          });
        } catch (err) {
          URL.revokeObjectURL(provisional.datos);
          paginas[examen.id] = paginas[examen.id].filter(function (p) { return p !== provisional; });
          logFoto("falló la página: " + ((err && err.code) || (err && err.message) || err));
          alert(
            err && err.message === "foto-demasiado-grande"
              ? "Esa hoja es demasiado grande incluso comprimida. Prueba a fotografiarla más de cerca, o por partes."
              : "No se pudo guardar la página. Inténtalo de nuevo."
          );
        }
        pintarPaginas();
      }
    }

    entradaCamara.addEventListener("change", function () {
      const f = entradaCamara.files;
      entradaCamara.value = "";
      subirPaginas(f, escCheck.checked); // la cámara respeta el interruptor
    });
    entradaArchivo.addEventListener("change", function () {
      const f = entradaArchivo.files;
      entradaArchivo.value = "";
      subirPaginas(f, escCheck.checked); // una foto reenviada está igual de gris
    });

    pintarPaginas();

    /* --- valores --- */
    const datalist = document.createElement("datalist");
    datalist.id = "analitos-" + examen.id;
    card.appendChild(datalist);

    function pintarSugerencias() {
      datalist.innerHTML = "";
      analitosDeTipo(examen.tipo).forEach(function (a) {
        const o = document.createElement("option");
        o.value = a[0];
        datalist.appendChild(o);
      });
    }
    pintarSugerencias();

    tipoSel.addEventListener("change", function () {
      guardarCampo(examen, "tipo", tipoSel.value);
      pintarSugerencias();
      if (examen.escaner == null) {
        escCheck.checked = escanearPorDefecto(tipoSel.value);
      }
    });

    const valores = document.createElement("div");
    valores.className = "examen-valores";
    card.appendChild(valores);

    function pintarValores() {
      valores.innerHTML = "";
      examen.valores = examen.valores || [];
      if (!examen.valores.length) {
        const nota = document.createElement("p");
        nota.className = "examen-sin-valores";
        nota.textContent = "Sin valores anotados. Copia de la hoja los que importen para el caso.";
        valores.appendChild(nota);
      }
      examen.valores.forEach(function (v) {
        valores.appendChild(filaDeValor(examen, v, function () {
          examen.valores = examen.valores.filter(function (x) { return x !== v; });
          guardarCampo(examen, "valores", examen.valores);
          pintarValores();
        }));
      });
      const add = document.createElement("button");
      add.type = "button";
      add.className = "btn-mini examen-add-valor";
      add.textContent = "+ Valor";
      add.addEventListener("click", function () {
        examen.valores = (examen.valores || []).concat([{ nombre: "", valor: "", unidad: "", min: "", max: "" }]);
        guardarCampo(examen, "valores", examen.valores);
        pintarValores();
        const ultimo = valores.querySelectorAll(".examen-campo-nombre");
        if (ultimo.length) ultimo[ultimo.length - 1].focus();
      });
      valores.appendChild(add);
    }
    pintarValores();

    /* --- notas del examen --- */
    const notas = document.createElement("textarea");
    notas.className = "examen-notas";
    notas.rows = 2;
    notas.placeholder = "Interpretación, hallazgos, qué se decidió a partir de este examen…";
    notas.value = examen.notas || "";
    notas.addEventListener("input", function () { guardarCampo(examen, "notas", notas.value); });
    card.appendChild(notas);

    borrar.addEventListener("click", async function () {
      const cuantas = (paginas[examen.id] || []).length;
      const ok = await askConfirm({
        title: "¿Eliminar este examen?",
        message: cuantas
          ? "Se borran también sus " + cuantas + " página(s). No se puede deshacer."
          : "Se borra definitivamente y no se puede deshacer.",
        confirmLabel: "Eliminar"
      });
      if (!ok) return;
      const mias = (paginas[examen.id] || []).slice();
      examenes = examenes.filter(function (e) { return e !== examen; });
      delete paginas[examen.id];
      pintarLista();
      try {
        await Promise.all(mias.filter(function (p) { return !p.subiendo; })
          .map(function (p) { return deleteDoc(doc(db, "fotos", p.id)); }));
        await deleteDoc(doc(db, "fotos", examen.id));
      } catch (err) {
        logFoto("no se pudo borrar el examen: " + ((err && err.code) || err));
      }
    });

    return card;
  }

  function pintarLista() {
    lista.innerHTML = "";
    vacio.hidden = examenes.length > 0;
    if (!examenes.length) vacio.textContent = "Aún no hay exámenes. Escanea la hoja del laboratorio o sube el archivo.";
    examenes
      .slice()
      .sort(function (a, b) { return String(b.fecha || "").localeCompare(String(a.fecha || "")); })
      .forEach(function (ex) { lista.appendChild(tarjetaDeExamen(ex)); });
  }

  btnNuevo.addEventListener("click", async function () {
    btnNuevo.disabled = true;
    try {
      const nuevo = await crearExamen(entry.id);
      examenes = examenes.concat([nuevo]);
      pintarLista();
    } catch (err) {
      logFoto("no se pudo crear el examen: " + ((err && err.code) || err));
      alert("No se pudo crear el examen. Inténtalo de nuevo.");
    } finally {
      btnNuevo.disabled = false;
    }
  });

  cargarAdjuntos
    .then(function (repartido) {
      examenes = repartido.examenes;
      paginas = repartido.paginas;
      pintarLista();
    })
    .catch(function () {
      vacio.textContent = "No se pudieron cargar los exámenes.";
      vacio.hidden = false;
    });

  return wrap;
}

function buildPhotosSection(entry, statusText, etiqueta) {
  const wrap = document.createElement("div");
  wrap.className = "photos";

  const head = document.createElement("div");
  head.className = "subcard-head";
  const label = document.createElement("span");
  label.textContent = etiqueta || "Fotos (radiografías, ecografías, paciente)";
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
      const sueltas = repartirAdjuntos(lista).fotos;
      const nuevas = fotos.filter((f) => !sueltas.some((l) => l.id === f.id));
      fotos = sueltas.concat(nuevas);
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

   Sigue el esquema de "Terapia de líquidos en perros y gatos" (Clínica y
   Cirugía de Pequeñas Especies I, UTE; fórmulas de Aldridge & O'Dwyer,
   Practical Emergency and Critical Care Veterinary Nursing, Wiley 2013):

     Mantenimiento   peso x 40 o x 60 mL/kg/día según el corte de 14 kg
     Rehidratación   peso x % deshidratación x 10
     Pérdidas        peso x 4 mL/kg x número de episodios
                     -------------------------------------
                     todo se suma y se reparte en 24 h

   El plan del día se puede repartir en dos fases (por ejemplo el 40 % en
   8 h y el resto en las 16 siguientes), que es como se pauta cuando hace
   falta corregir rápido al principio sin llegar a un bolo. */

/* El tamaño ya no se elige a mano: sale del peso. Un desplegable de
   grande/mediano/pequeño obligaba a decidir algo que el número ya dice, y
   se prestaba a elegir mal la banda con el paciente delante. */
const FLUIDOS_CORTE_KG = 14;
const FLUIDOS_ML_KG_SOBRE_CORTE = 40;
const FLUIDOS_ML_KG_BAJO_CORTE = 60;

function mlKgMantenimiento(pesoKg) {
  return pesoKg > FLUIDOS_CORTE_KG ? FLUIDOS_ML_KG_SOBRE_CORTE : FLUIDOS_ML_KG_BAJO_CORTE;
}

/* Por debajo de 3 kg el macrogotero no sirve: un gatito de 2 kg solo de
   mantenimiento va a 5 mL/h, que con 15 gotas/mL es UNA GOTA CADA 48
   SEGUNDOS. Eso no se ajusta ni se vigila. Con microgotero son 5 gotas
   por minuto, que sí. */
const FLUIDOS_CORTE_MICRO_KG = 3;

// Pérdidas sensibles: cada vómito o cada deposición diarreica.
const FLUIDOS_ML_KG_EPISODIO = 4;

// Pediátrico: multiplica SOLO el mantenimiento. El déficit y las pérdidas
// ya salen del peso y del estado del animal que tienes delante.
const FLUIDOS_PEDIATRICO = { canino: 3, felino: 2.5 };

/* Los tramos de deshidratación son de exploración física: no se miden, se
   estiman mirando al paciente. Rellenan el campo del % y ese campo queda
   editable, que es lo que hace que el aviso de "esto es mucho" pueda
   saltar de verdad. */
const FLUIDOS_GRADOS = [
  { pct: 0, texto: "Menos del 5% — no se aprecia nada" },
  { pct: 5.5, texto: "5–6% — el pliegue tarda un poco en volver" },
  { pct: 7, texto: "6–8% — pliegue lento, mucosas secas" },
  { pct: 9, texto: "8–10% — pliegue muy lento, ojos hundidos" },
  { pct: 11, texto: "10–12% — el pliegue no vuelve, córnea apagada" },
  { pct: 12, texto: "Más del 12% — shock hipovolémico" }
];

// Bolo de reanimación. No sale de esta diapositiva sino de la unidad de
// terapia de fluidos: esa habla del plan del día y no cubre el shock.
const FLUIDOS_BOLO = {
  canino: { min: 15, max: 20 },
  felino: { min: 5, max: 10 }
};
const FLUIDOS_BOLO_MINUTOS = 15;

const FLUIDOS_EQUIPOS = [
  { gtt: 15, etiqueta: "Macrogotero — 15 gotas/mL" },
  { gtt: 20, etiqueta: "Macrogotero — 20 gotas/mL" },
  { gtt: 60, etiqueta: "Microgotero — 60 gotas/mL" }
];

const FLUIDOS_FUENTE =
  "Terapia de líquidos en perros y gatos — Clínica y Cirugía de Pequeñas Especies I (UTE). " +
  "Fórmulas de Aldridge & O'Dwyer, Practical Emergency and Critical Care Veterinary Nursing (Wiley, 2013).";

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
    if (pista) d.appendChild(pista);
    return d;
  }
  function pistaEl(texto) {
    const p = document.createElement("div");
    p.className = "calc-pista";
    p.textContent = texto || "";
    return p;
  }
  function casilla(texto) {
    const l = document.createElement("label");
    l.className = "calc-check";
    const i = document.createElement("input");
    i.type = "checkbox";
    l.appendChild(i);
    l.appendChild(document.createTextNode(" " + texto));
    const campo = document.createElement("div");
    campo.className = "calc-field";
    campo.appendChild(l);
    return { campo: campo, input: i };
  }

  const especieSelect = document.createElement("select");
  [["canino", "Perro"], ["felino", "Gato"]].forEach(function (e) {
    const o = document.createElement("option");
    o.value = e[0];
    o.textContent = e[1];
    especieSelect.appendChild(o);
  });
  if (especieActiva() === "felino") especieSelect.value = "felino";

  const pesoInput = document.createElement("input");
  pesoInput.type = "number";
  pesoInput.step = "any";
  pesoInput.min = "0";
  pesoInput.placeholder = "Ej. 35";
  const ctxCase = ctx.caseEntry ? currentEntry(ctx.caseEntry) : null;
  if (ctxCase && ctxCase.peso) {
    const p = parseFloat(String(ctxCase.peso).replace(",", "."));
    if (isFinite(p)) pesoInput.value = p;
  }
  const pesoPista = pistaEl("");

  const ped = casilla("Paciente pediátrico");

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
  pctInput.value = "0";

  const episodiosInput = document.createElement("input");
  episodiosInput.type = "number";
  episodiosInput.step = "1";
  episodiosInput.min = "0";
  episodiosInput.value = "0";

  /* Reparto en dos fases. Nace de la práctica de pasar una parte más
     rápido al principio: "el 40 % en 8 h y el resto en las siguientes".
     Los dos campos solo aparecen si se activa, para no dejar dos números
     en pantalla que la mayoría de las veces no se usan. */
  const fases = casilla("Repartir el plan en dos fases");

  const faseCaja = document.createElement("div");
  faseCaja.className = "calc-fases";
  faseCaja.hidden = true;

  const fasePctInput = document.createElement("input");
  fasePctInput.type = "number";
  fasePctInput.step = "any";
  fasePctInput.min = "0";
  fasePctInput.max = "100";
  fasePctInput.value = "40";

  const faseHorasInput = document.createElement("input");
  faseHorasInput.type = "number";
  faseHorasInput.step = "any";
  faseHorasInput.min = "0";
  faseHorasInput.value = "8";

  faseCaja.appendChild(campo("% del volumen en la primera fase", fasePctInput));
  faseCaja.appendChild(campo("Horas de la primera fase", faseHorasInput, pistaEl("El resto del volumen se pasa en las horas que queden hasta 24.")));

  const equipoSelect = document.createElement("select");
  FLUIDOS_EQUIPOS.forEach(function (e) {
    const o = document.createElement("option");
    o.value = String(e.gtt);
    o.textContent = e.etiqueta;
    equipoSelect.appendChild(o);
  });

  const equipoPista = pistaEl("");

  /* El equipo se propone solo, pero deja de hacerlo en cuanto lo tocas.
     Una sugerencia que te pisa la elección cada vez que corriges el peso
     no es una ayuda, es una pelea. */
  let equipoAMano = false;

  const shock = casilla("Hay shock: añadir bolo de reanimación");

  const result = document.createElement("div");
  result.className = "calc-result";

  let resumenPlan = "";
  let fluidAddBtn = null;
  let fluidAddMsg = null;

  function aplicarGrado() {
    const g = FLUIDOS_GRADOS[Number(gradoSelect.value) || 0];
    if (g) pctInput.value = String(g.pct);
    if (g && g.pct >= 12) shock.input.checked = true;
  }

  function render() {
    result.innerHTML = "";
    fluidAddMsg = null;
    faseCaja.hidden = !fases.input.checked;

    function linea(texto, cls) {
      const d = document.createElement("div");
      d.className = cls || "calc-line";
      d.textContent = texto;
      result.appendChild(d);
    }
    function subtitulo(texto) {
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
    const pct = parseFloat(String(pctInput.value).replace(",", ".")) || 0;
    const episodios = parseFloat(String(episodiosInput.value).replace(",", ".")) || 0;
    if (!equipoAMano && isFinite(peso) && peso > 0) {
      // Asignar .value no dispara "change", así que esto no se realimenta.
      const sugerido = peso < FLUIDOS_CORTE_MICRO_KG ? "60" : "15";
      if (equipoSelect.value !== sugerido) equipoSelect.value = sugerido;
    }
    const gtt = Number(equipoSelect.value) || 15;
    equipoPista.textContent = equipoAMano
      ? "Lo elegiste tú; ya no se cambia solo."
      : "Se pone solo: por debajo de " + FLUIDOS_CORTE_MICRO_KG + " kg, microgotero.";
    const especie = especieSelect.value;

    resumenPlan = "";
    if (fluidAddBtn) fluidAddBtn.disabled = true;

    if (!isFinite(peso) || peso <= 0) {
      pesoPista.textContent = "El mantenimiento sale solo del peso: hasta " + FLUIDOS_CORTE_KG +
        " kg son " + FLUIDOS_ML_KG_BAJO_CORTE + " mL/kg/día; por encima, " +
        FLUIDOS_ML_KG_SOBRE_CORTE + ".";
      const v = document.createElement("div");
      v.className = "calc-empty";
      v.textContent = "Escribe el peso del paciente para calcular el plan.";
      result.appendChild(v);
      return;
    }

    const mlKg = mlKgMantenimiento(peso);
    pesoPista.textContent =
      (peso > FLUIDOS_CORTE_KG ? "Más de " : "Hasta ") + FLUIDOS_CORTE_KG + " kg → " +
      mlKg + " mL/kg/día.";

    /* --- Las tres partidas --- */
    const factorPed = ped.input.checked ? FLUIDOS_PEDIATRICO[especie] : 1;
    const mantenimiento = peso * mlKg * factorPed;
    const rehidratacion = peso * pct * 10;
    const perdidas = peso * FLUIDOS_ML_KG_EPISODIO * episodios;
    const total = mantenimiento + rehidratacion + perdidas;

    function partida(formula, valor) {
      const d = document.createElement("div");
      d.className = "calc-partida";
      const f = document.createElement("span");
      f.textContent = formula;
      const v = document.createElement("strong");
      v.textContent = roundNice(valor) + " mL";
      d.appendChild(f);
      d.appendChild(v);
      result.appendChild(d);
    }

    partida(
      roundNice(peso) + " kg × " + mlKg + " mL/kg/día" +
        (factorPed !== 1 ? " × " + String(factorPed).replace(".", ",") + " (pediátrico)" : ""),
      mantenimiento
    );
    if (pct > 0) partida(roundNice(peso) + " kg × " + roundNice(pct) + " % × 10", rehidratacion);
    if (episodios > 0) {
      partida(
        roundNice(peso) + " kg × " + FLUIDOS_ML_KG_EPISODIO + " mL/kg × " + roundNice(episodios) + " episodios",
        perdidas
      );
    }

    const suma = document.createElement("div");
    suma.className = "calc-partida calc-partida-total";
    const et = document.createElement("span");
    et.textContent = "Total";
    const vt = document.createElement("strong");
    vt.textContent = roundNice(total) + " mL/día";
    suma.appendChild(et);
    suma.appendChild(vt);
    result.appendChild(suma);

    function goteo(volumen, horas, etiqueta) {
      if (!(horas > 0)) return null;
      const mlHora = volumen / horas;
      const gotasMin = (mlHora / 60) * gtt;
      if (etiqueta) subtitulo(etiqueta);
      linea(roundNice(volumen) + " mL ÷ " + roundNice(horas) + " h", "calc-line");
      linea("= " + roundNice(mlHora) + " mL/h", "calc-total");
      linea("= " + roundNice(gotasMin) + " gotas/min", "calc-total");
      if (gotasMin > 0) {
        linea("= 1 gota cada " + roundNice(60 / gotasMin) + " s", "calc-total");
      }
      linea("Con equipo de " + gtt + " gotas/mL.", "calc-line-suave");
      return { mlHora: mlHora, gotasMin: gotasMin };
    }

    let picoMlKgH = 0;

    if (fases.input.checked) {
      const fPct = parseFloat(String(fasePctInput.value).replace(",", ".")) || 0;
      const fHoras = parseFloat(String(faseHorasInput.value).replace(",", ".")) || 0;
      const horas2 = 24 - fHoras;
      const vol1 = (total * fPct) / 100;
      const vol2 = total - vol1;

      const g1 = goteo(vol1, fHoras, "Fase 1 · " + roundNice(fPct) + " % en " + roundNice(fHoras) + " h");
      if (g1) picoMlKgH = Math.max(picoMlKgH, g1.mlHora / peso);

      const g2 = goteo(vol2, horas2, "Fase 2 · el " + roundNice(100 - fPct) + " % restante en " + roundNice(horas2) + " h");
      if (g2) picoMlKgH = Math.max(picoMlKgH, g2.mlHora / peso);

      if (g1 && g2) {
        resumenPlan =
          "Fluidos — " + roundNice(peso) + " kg: " + roundNice(total) + " mL/día en dos fases. " +
          "Fase 1 " + roundNice(vol1) + " mL en " + roundNice(fHoras) + " h (" + roundNice(g1.mlHora) +
          " mL/h, " + roundNice(g1.gotasMin) + " gotas/min); fase 2 " + roundNice(vol2) + " mL en " +
          roundNice(horas2) + " h (" + roundNice(g2.mlHora) + " mL/h, " + roundNice(g2.gotasMin) + " gotas/min)";
      }

      if (!(fHoras > 0)) {
        aviso("La primera fase necesita al menos una hora.");
      } else if (horas2 <= 0) {
        aviso(
          "Con " + roundNice(fHoras) + " h en la primera fase no queda tiempo para la segunda. " +
            "Ponle menos de 24 h."
        );
      }
      if (fPct <= 0 || fPct >= 100) {
        aviso("El porcentaje de la primera fase tiene que estar entre 1 y 99. Si no, no hay dos fases.");
      }
    } else {
      const g = goteo(total, 24, null);
      if (g) {
        picoMlKgH = g.mlHora / peso;
        resumenPlan =
          "Fluidos — " + roundNice(peso) + " kg: mantenimiento " + roundNice(mantenimiento) +
          " + rehidratación " + roundNice(rehidratacion) + " + pérdidas " + roundNice(perdidas) +
          " = " + roundNice(total) + " mL/día. " + roundNice(g.mlHora) + " mL/h, " +
          roundNice(g.gotasMin) + " gotas/min con equipo de " + gtt + " gotas/mL";
      }
    }

    /* --- Bolo, aparte del plan del día --- */
    if (shock.input.checked) {
      const b = FLUIDOS_BOLO[especie];
      subtitulo("Antes del plan · bolo de reanimación");
      linea(b.min + "–" + b.max + " mL/kg × " + roundNice(peso) + " kg", "calc-line");
      linea("= " + roundNice(b.min * peso) + " – " + roundNice(b.max * peso) + " mL en " + FLUIDOS_BOLO_MINUTOS + " min", "calc-total");
      linea("Cristaloide isotónico, llave abierta. Reevalúa la perfusión al terminar; se puede repetir.", "calc-line-suave");
    }

    /* --- Avisos --- */
    /* El corte de 14 kg es un escalón: 14 kg da 840 mL/día y 14,1 kg da
       564. Cerca del borde conviene ver los dos números antes de fiarse
       de la báscula. */
    if (peso >= FLUIDOS_CORTE_KG - 2 && peso <= FLUIDOS_CORTE_KG + 3) {
      const otro = mlKg === FLUIDOS_ML_KG_SOBRE_CORTE ? FLUIDOS_ML_KG_BAJO_CORTE : FLUIDOS_ML_KG_SOBRE_CORTE;
      aviso(
        "Estás pegado al corte de " + FLUIDOS_CORTE_KG + " kg. Al otro lado el mantenimiento sería " +
          roundNice(peso * otro * factorPed) + " mL/día en vez de " + roundNice(mantenimiento) + "."
      );
    }
    if (pct >= 12 && !shock.input.checked) {
      aviso("Un " + roundNice(pct) + " % de deshidratación es shock hipovolémico: primero el bolo, y este plan después.");
    }
    if (pct > 12) {
      aviso("Por encima del 12 % ya no se estima por exploración. Revisa el número.");
    }
    // El bolo es lo más rápido que se pauta. Si alguna fase lo supera, hay
    // un dato mal escrito.
    const limite = (FLUIDOS_BOLO[especie].max / FLUIDOS_BOLO_MINUTOS) * 60;
    if (picoMlKgH > limite) {
      aviso(
        "La velocidad más alta del plan (" + roundNice(picoMlKgH) + " mL/kg/h) supera la del bolo de " +
          "reanimación (" + roundNice(limite) + " mL/kg/h). Revisa el peso, el % y las horas."
      );
    }

    const nota = document.createElement("div");
    nota.className = "calc-fuente";
    nota.textContent =
      FLUIDOS_FUENTE +
      " No contempla cardiopatía, nefropatía oligúrica ni hipoproteinemia, donde el volumen se reduce.";
    result.appendChild(nota);

    if (fluidAddBtn) fluidAddBtn.disabled = !resumenPlan;
  }

  gradoSelect.addEventListener("change", function () {
    aplicarGrado();
    render();
  });
  [pesoInput, pctInput, episodiosInput, fasePctInput, faseHorasInput].forEach(function (i) {
    i.addEventListener("input", render);
  });
  especieSelect.addEventListener("change", render);
  equipoSelect.addEventListener("change", function () {
    equipoAMano = true;
    render();
  });
  [ped.input, fases.input, shock.input].forEach(function (c) {
    c.addEventListener("change", render);
  });

  wrap.appendChild(campo("Especie", especieSelect));
  wrap.appendChild(campo("Peso (kg)", pesoInput, pesoPista));
  wrap.appendChild(ped.campo);
  wrap.appendChild(campo("Deshidratación estimada", gradoSelect));
  wrap.appendChild(campo("% a usar", pctInput, pistaEl("Se propone el centro del tramo. Cámbialo si tu exploración dice otra cosa.")));
  wrap.appendChild(campo("Vómitos o diarreas", episodiosInput, pistaEl("Número de episodios. Cada uno cuenta como " + FLUIDOS_ML_KG_EPISODIO + " mL/kg.")));
  wrap.appendChild(fases.campo);
  wrap.appendChild(faseCaja);
  wrap.appendChild(campo("Equipo de goteo", equipoSelect, equipoPista));
  wrap.appendChild(shock.campo);
  wrap.appendChild(result);

  // Igual que en la calculadora de dosis: deja el plan escrito como una
  // evolución del caso y nada más. No rellena ningún campo de la ficha.
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

/* ================= Constantes fisiológicas =================

   Base: Merck Veterinary Manual. Donde hay evidencia reciente que lo
   contradice o lo precisa, manda la evidencia y se dice en la nota.

   Lo que cambio tras revisarlo (agosto 2026):

   - FC del perro. Es creencia extendida que el perro pequeno late mas
     rapido, y de ahi salen las tablas por tamano (100-140 en pequenos,
     60-100 en grandes). Ferasin et al. (J Small Anim Pract 2010;51:412-8,
     doi 10.1111/j.1748-5827.2010.00954.x) lo midieron en 243 ECG y 153
     exploraciones y NO encontraron correlacion con el peso. Lo que si
     encontraron: los menores de 1 ano laten significativamente mas, y el
     caracter del animal (relajado vs nervioso) influye. Por eso aqui la
     banda cambia con la EDAD y no con el tamano.

   - Temperatura del perro. Rostami et al. (Am J Vet Res 2026,
     doi 10.2460/ajvr.26.04.0160) calcularon el intervalo de referencia en
     78 perros sanos: 37,5-39,7 C, mas ancho por arriba que el 39,2 de
     Merck. Se mantiene 39,2 como umbral de aviso, que es el conservador,
     y el dato nuevo va en la nota: entre 39,2 y 39,7 hay que mirar al
     paciente antes de llamarlo fiebre.

   - FC del gato. Donat Almagro et al. (J Feline Med Surg 2024;26:3,
     doi 10.1177/1098612X241233116) midieron 171,5 +- 28,6 lpm sin estres
     y 213,4 +- 37,5 con estres. Confirma la banda de consulta 150-220 y
     explica por que la de reposo (120-140) no sirve aqui.

   Para bovino, equino, porcino, ovino y caprino sigue mandando Merck: no
   se encontro evidencia reciente que lo corrija.

     Temperatura  merckvetmanual.com/reference-values-and-conversion-tables/
                  reference-guides/normal-rectal-temperature-ranges
     Frec. card.  .../reference-guides/resting-heart-rates
     Frec. resp.  .../special-subjects/reference-guides/resting-respiratory-rates
     Triaje       .../multimedia/table/parameters-to-evaluate-during-triage
     Caprino FR   pubs.ext.vt.edu/APSC/APSC-169/APSC-169.html

   Estas direcciones NO se muestran en pantalla: sirven para volver a
   comprobar una cifra que chirríe, no para leerlas en cada consulta.
   Recuerda que un valor dentro del rango no descarta enfermedad y que uno
   fuera puede ser solo el estrés de la consulta.

   Por que UNA sola fuente y no la mejor cifra de cada sitio: los rangos
   varian bastante entre autores (en porcino, Merck da 32-58 rpm y
   Virginia Tech 8-18). Mezclarlos produce una tabla que no se puede
   rastrear ni discutir. Con una fuente principal, cualquier cifra rara se
   puede ir a comprobar a su tabla.

   La frecuencia cardiaca de perro y gato sale de la tabla de TRIAJE y no
   de la de reposo a proposito: la de reposo da 120-140 en gato, y con ese
   techo casi todo gato explorado en consulta saldria taquicardico. El
   aviso dejaria de significar nada. */

const CONSTANTES_REFERENCIA = {
  canino: {
    temp: { min: 37.5, max: 39.2, nota: "hasta 39,7 en perros sanos (RI 2026)" },
    fc: { min: 60, max: 120, nota: "no depende del tamaño; sí de la edad" },
    fcJoven: { min: 120, max: 160, nota: "cachorro menor de 1 año" },
    fr: { min: 18, max: 34 }
  },
  felino: {
    temp: { min: 38.1, max: 39.2 },
    fc: { min: 150, max: 220, nota: "en consulta; relajado en casa 120–140" },
    fr: { min: 16, max: 40 }
  },
  bovino: {
    temp: { min: 38.0, max: 39.3, nota: "vaca de leche · de carne 36,7–39,1" },
    fc: { min: 48, max: 84, nota: "vaca de leche · buey 36–60" },
    fr: { min: 26, max: 50, nota: "vaca de leche" }
  },
  equino: {
    temp: { min: 37.2, max: 38.2, nota: "yegua 37,3–38,2 · semental 37,2–38,1" },
    fc: { min: 28, max: 40 },
    fr: { min: 10, max: 14 }
  },
  porcino: {
    temp: { min: 38.7, max: 39.8 },
    fc: { min: 70, max: 120 },
    fr: { min: 32, max: 58 }
  },
  ovino: {
    temp: { min: 38.3, max: 39.9 },
    fc: { min: 70, max: 80 },
    fr: { min: 16, max: 34 }
  },
  caprino: {
    temp: { min: 38.5, max: 39.7 },
    fc: { min: 70, max: 80 },
    fr: { min: 12, max: 20, nota: "no está en Merck · Virginia Tech APSC-169" }
  }
};

// El tiempo de llenado capilar no cambia con la especie: es una medida de
// perfusion, no un valor de especie.
const CONSTANTES_TLLC = { min: 1, max: 2 };

const CONSTANTES_MUCOSAS = [
  { valor: "rosadas", texto: "Rosadas", normal: true },
  { valor: "palidas", texto: "Pálidas" },
  { valor: "congestivas", texto: "Congestivas / rojas" },
  { valor: "ictericas", texto: "Ictéricas" },
  { valor: "cianoticas", texto: "Cianóticas" },
  { valor: "grisaceas", texto: "Grisáceas / porcelana" }
];


/* La especie del caso se guarda capitalizada ("Canino") y la tabla usa
   minusculas. Aves, Exotico y Otro no tienen rango: en vez de inventarlos
   se dice que no hay, que es informacion correcta. */
function referenciaDeEspecie(especie, esJoven) {
  const clave = normalizarBusqueda(especie).trim();
  const base = CONSTANTES_REFERENCIA[clave] || null;
  if (!base) return null;
  /* La banda de cachorro sustituye a la de adulto solo donde existe. En
     las demas especies no hay dato propio y se deja la de adulto: mejor
     un rango de adulto declarado que uno de cachorro inventado. */
  if (esJoven && base.fcJoven) return { temp: base.temp, fc: base.fcJoven, fr: base.fr };
  return base;
}

/* Devuelve "" (dentro), "bajo" o "alto". Separar los dos lados no es
   cosmetico: una bradicardia y una taquicardia se manejan al reves. */
function estadoDeConstante(valor, rango) {
  if (!rango) return "";
  const n = parseFloat(String(valor).replace(",", "."));
  if (!isFinite(n)) return "";
  if (n < rango.min) return "bajo";
  if (n > rango.max) return "alto";
  return "";
}

function textoDeRango(rango, unidad) {
  if (!rango) return "";
  const min = String(rango.min).replace(".", ",");
  const max = String(rango.max).replace(".", ",");
  return min + " – " + max + " " + unidad;
}

function buildConstantesSection(entry, save) {
  const wrap = document.createElement("div");

  const label = document.createElement("label");
  label.className = "checkbox-group-label";
  label.style.margin = "0 0 8px";
  label.textContent = "Constantes fisiológicas";
  wrap.appendChild(label);

  /* La edad cambia la frecuencia cardiaca del perro y es lo unico que la
     evidencia sostiene (el tamano no). Se pregunta con una casilla en vez
     de leer el campo "edad" del caso porque ahi se escribe libre — "6
     meses", "2 anos", "cachorro" — y adivinarlo mal cambiaria el rango sin
     que se note. */
  const joven = document.createElement("label");
  joven.className = "calc-check const-joven";
  const jovenInput = document.createElement("input");
  jovenInput.type = "checkbox";
  jovenInput.checked = !!entry.constJoven;
  joven.appendChild(jovenInput);
  joven.appendChild(document.createTextNode(" Menor de 1 año"));
  wrap.appendChild(joven);

  const aviso = document.createElement("p");
  aviso.className = "const-aviso-especie";
  wrap.appendChild(aviso);

  const tabla = document.createElement("div");
  tabla.className = "const-tabla";

  /* Las filas se construyen UNA vez y luego solo se les cambia el rango.
     Antes la tarjeta entera se armaba con la especie que hubiera al abrir
     la ficha y no volvía a mirarla: cambiabas de bovino a caprino en la
     columna de al lado y los rangos seguían siendo los de la vaca hasta
     recargar la página.

     Se actualiza en vez de reconstruir a propósito: reconstruir perdería
     lo que estés tecleando y el foco del campo. */
  const filas = [
    { campo: "constTemp", clave: "temp", etiqueta: "Temperatura", unidad: "°C", paso: "0.1" },
    { campo: "constFc", clave: "fc", etiqueta: "Frec. cardíaca", unidad: "lpm", paso: "1" },
    { campo: "constFr", clave: "fr", etiqueta: "Frec. respiratoria", unidad: "rpm", paso: "1" },
    { campo: "constTllc", clave: "tllc", etiqueta: "Llenado capilar", unidad: "s", paso: "0.5" }
  ];

  filas.forEach(function (f) {
    const fila = document.createElement("div");
    fila.className = "const-fila";

    const nombre = document.createElement("label");
    nombre.className = "const-nombre";
    nombre.textContent = f.etiqueta;

    const input = document.createElement("input");
    input.type = "number";
    input.step = f.paso;
    input.min = "0";
    input.className = "const-input";
    input.value = entry[f.campo] == null ? "" : entry[f.campo];
    input.setAttribute("aria-label", f.etiqueta + " en " + f.unidad);

    const unidad = document.createElement("span");
    unidad.className = "const-unidad";
    unidad.textContent = f.unidad;

    /* El rango y su matiz van en la MISMA celda, uno encima del otro. La
       nota aclara el rango, no el nombre de la constante. */
    const refBox = document.createElement("div");
    refBox.className = "const-refbox";
    const referencia = document.createElement("span");
    referencia.className = "const-ref";
    const nota = document.createElement("span");
    nota.className = "const-nota";
    nota.hidden = true;
    refBox.appendChild(referencia);
    refBox.appendChild(nota);

    const marca = document.createElement("span");
    marca.className = "const-marca";

    function pintar() {
      const estado = estadoDeConstante(input.value, f.rango);
      fila.setAttribute("data-estado", estado);
      marca.textContent = estado === "alto" ? "↑ alto" : estado === "bajo" ? "↓ bajo" : "";
    }

    input.addEventListener("input", function () {
      pintar();
      // Vacio se guarda como null y no como "": asi la ficha distingue
      // "no lo medi" de un cero.
      save(f.campo, input.value === "" ? null : Number(input.value));
    });

    fila.appendChild(nombre);
    fila.appendChild(input);
    fila.appendChild(unidad);
    fila.appendChild(refBox);
    fila.appendChild(marca);
    tabla.appendChild(fila);

    f.aplicarRango = function (rango) {
      f.rango = rango || null;
      referencia.textContent = f.rango ? textoDeRango(f.rango, f.unidad) : "sin referencia";
      const hayNota = !!(f.rango && f.rango.nota);
      nota.hidden = !hayNota;
      nota.textContent = hayNota ? f.rango.nota : "";
      pintar();
    };
  });

  /* Mucosas: no es un numero, pero se comporta igual — hay un valor normal
     y el resto son hallazgos. Va en la misma rejilla para que se lea como
     una fila mas de la exploracion. No depende de la especie. */
  const filaMuc = document.createElement("div");
  filaMuc.className = "const-fila";
  const mucNombre = document.createElement("label");
  mucNombre.className = "const-nombre";
  mucNombre.textContent = "Mucosas";
  const mucSelect = document.createElement("select");
  mucSelect.className = "const-input const-input-ancho";
  const vacio = document.createElement("option");
  vacio.value = "";
  vacio.textContent = "— sin valorar —";
  mucSelect.appendChild(vacio);
  CONSTANTES_MUCOSAS.forEach(function (m) {
    const o = document.createElement("option");
    o.value = m.valor;
    o.textContent = m.texto;
    mucSelect.appendChild(o);
  });
  mucSelect.value = entry.constMucosas || "";
  const mucRefBox = document.createElement("div");
  mucRefBox.className = "const-refbox";
  const mucRef = document.createElement("span");
  mucRef.className = "const-ref";
  mucRef.textContent = "rosadas";
  mucRefBox.appendChild(mucRef);
  const mucMarca = document.createElement("span");
  mucMarca.className = "const-marca";

  function pintarMucosas() {
    const elegida = CONSTANTES_MUCOSAS.find(function (m) { return m.valor === mucSelect.value; });
    const alterada = !!(elegida && !elegida.normal);
    filaMuc.setAttribute("data-estado", alterada ? "alto" : "");
    mucMarca.textContent = alterada ? "⚠ alterado" : "";
  }
  mucSelect.addEventListener("change", function () {
    pintarMucosas();
    save("constMucosas", mucSelect.value || null);
  });
  pintarMucosas();

  filaMuc.appendChild(mucNombre);
  filaMuc.appendChild(mucSelect);
  // Sin span de relleno: el select ya ocupa las pistas 2 y 3 (const-input-ancho).
  // Con el, la caja del rango caia una pista mas a la derecha y esta fila
  // se desalineaba con las otras cuatro.
  filaMuc.appendChild(mucRefBox);
  filaMuc.appendChild(mucMarca);
  tabla.appendChild(filaMuc);

  wrap.appendChild(tabla);

  /* Se cuelga del nodo para que quien lo monte pueda avisarle del cambio de
     especie sin tener que volver a construirlo. */
  let especieActual = entry.especie || "";

  wrap.setEspecie = function (especie) {
    especieActual = especie;
    const ref = referenciaDeEspecie(especie, jovenInput.checked);
    // La casilla solo sirve donde hay una banda propia para cachorros.
    const base = CONSTANTES_REFERENCIA[normalizarBusqueda(especie).trim()];
    joven.hidden = !(base && base.fcJoven);
    if (!especie) {
      aviso.hidden = false;
      aviso.textContent = "Elige la especie del paciente para ver los rangos de referencia.";
    } else if (!ref) {
      aviso.hidden = false;
      aviso.textContent =
        "No hay rangos cargados para " + String(especie).toLowerCase() +
        ": las cifras varían demasiado entre especies para dar uno solo. Puedes anotar los valores igual.";
    } else {
      aviso.hidden = true;
      aviso.textContent = "";
    }
    filas.forEach(function (f) {
      // El llenado capilar mide perfusion, no especie: su rango no cambia.
      f.aplicarRango(f.clave === "tllc" ? CONSTANTES_TLLC : ref && ref[f.clave]);
    });
  };

  jovenInput.addEventListener("change", function () {
    save("constJoven", jovenInput.checked ? true : null);
    wrap.setEspecie(especieActual);
  });

  wrap.setEspecie(entry.especie);

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

/* La flecha va en su propio <span> y no dentro del texto. Asi puede
   tener su propio circulo y desplazarse sola al pasar por encima, que
   es lo que hace que el boton se lea como un control de volver y no
   como una linea de texto mas. El <span> del rotulo permite ademas
   recortarlo con puntos suspensivos en pantallas estrechas, en vez de
   partir el nombre del destino en dos lineas. */
function backLink(label, onClick) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "back-link";

  const flecha = document.createElement("span");
  flecha.className = "back-flecha";
  flecha.setAttribute("aria-hidden", "true");
  flecha.textContent = "←";

  const texto = document.createElement("span");
  texto.className = "back-texto";
  texto.textContent = label;

  btn.appendChild(flecha);
  btn.appendChild(texto);
  // El rotulo visible dice solo el destino; en voz alta conviene el verbo.
  btn.setAttribute("aria-label", "Volver a " + label);
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
  // isContentEditable ademas de los tres campos clasicos: el apunte de
  // una materia es un contenteditable y no es ninguno de ellos. Sin esta
  // linea, el eco del propio guardado lo borraria bajo el cursor.
  if (el.isContentEditable) return true;
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

  /* Rejilla propia y NO .detail-grid: aquella es 320px + resto, pensada
     para una barra lateral estrecha junto al contenido. Aqui los papeles
     estan al reves — la tabla es el contenido y la calculadora es una
     tarjeta con un boton — asi que reutilizarla dejaba la tabla apretada
     en 320 px y media pantalla vacia al lado. */
  const toolsRow = document.createElement("div");
  toolsRow.className = "tools-grid";
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

  /* Las constantes tambien se imprimen: es lo primero que mira quien
     recibe el caso, y sin ellas el PDF no sirve para derivar. */
  const constantesImpresas = [
    ["Temperatura", caso.constTemp, "°C"],
    ["Frec. cardíaca", caso.constFc, "lpm"],
    ["Frec. respiratoria", caso.constFr, "rpm"],
    ["Llenado capilar", caso.constTllc, "s"]
  ].filter(function (c) { return c[1] != null && c[1] !== ""; });
  const mucosaImpresa = CONSTANTES_MUCOSAS.find(function (m) { return m.valor === caso.constMucosas; });

  if (constantesImpresas.length || mucosaImpresa) {
    const refCaso = referenciaDeEspecie(caso.especie, caso.constJoven);
    const sec = bloqueImpreso("Constantes fisiológicas");
    const tabla = document.createElement("table");
    tabla.className = "print-table";
    tabla.innerHTML = "<thead><tr><th>Constante</th><th>Valor</th><th>Referencia</th></tr></thead>";
    const tb = document.createElement("tbody");
    const clavesRango = { "Temperatura": "temp", "Frec. cardíaca": "fc", "Frec. respiratoria": "fr" };
    constantesImpresas.forEach(function (c) {
      const rango = c[0] === "Llenado capilar" ? CONSTANTES_TLLC : (refCaso && refCaso[clavesRango[c[0]]]);
      const estado = estadoDeConstante(c[1], rango);
      const tr = document.createElement("tr");
      [c[0],
       String(c[1]).replace(".", ",") + " " + c[2] + (estado ? " (" + estado + ")" : ""),
       rango ? textoDeRango(rango, c[2]) : "—"
      ].forEach(function (v) {
        const td = document.createElement("td");
        td.textContent = v;
        tr.appendChild(td);
      });
      tb.appendChild(tr);
    });
    if (mucosaImpresa) {
      const tr = document.createElement("tr");
      ["Mucosas", mucosaImpresa.texto + (mucosaImpresa.normal ? "" : " (alterado)"), "rosadas"].forEach(function (v) {
        const td = document.createElement("td");
        td.textContent = v;
        tr.appendChild(td);
      });
      tb.appendChild(tr);
    }
    tabla.appendChild(tb);
    sec.appendChild(tabla);
    root.appendChild(sec);
  }

  /* Un bloque por apartado, y solo los que tienen algo escrito: una
     ficha impresa con cuatro titulos vacios se lee peor que sin ellos. */
  if (apartadosVacios(caso)) {
    if (caso.body && caso.body.trim()) {
      const notas = bloqueImpreso("Historia clínica");
      const p = document.createElement("p");
      p.className = "print-text";
      p.textContent = caso.body;
      notas.appendChild(p);
      root.appendChild(notas);
    }
  } else {
    CASO_APARTADOS.forEach(function (ap) {
      const t = String(caso[ap.clave] || "").trim();
      if (!t) return;
      const bloque = bloqueImpreso(ap.etiqueta);
      const p = document.createElement("p");
      p.className = "print-text";
      p.textContent = t;
      bloque.appendChild(p);
      root.appendChild(bloque);
    });
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

  /* La tarjeta de constantes se construye más abajo, pero el selector de
     especie está más arriba: hace falta el hueco declarado antes para que
     el listener pueda avisarle. */
  let constantesNodo = null;

  const head = document.createElement("div");
  head.className = "patient-head";

  const avatar = document.createElement("div");
  avatar.className = "patient-avatar";
  function pintarAvatar(especie, nombre) {
    const icono = iconoDeEspecie(especie, nombre);
    avatar.textContent = icono;
    // El emoji necesita mas cuerpo que una letra para ocupar el mismo circulo.
    avatar.classList.toggle("patient-avatar-icono", icono.length > 1 || /\p{Emoji}/u.test(icono));
  }
  pintarAvatar(entry.especie, entry.meta);

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
    // El icono cambia con la especie en el momento, sin recargar.
    pintarAvatar(speciesSelect.value, nameInput.value);
    if (typeof actualizarHato === "function") actualizarHato(speciesSelect.value);
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
    // Los rangos de referencia dependen de la especie y tienen que
    // cambiar aquí mismo, no en la siguiente recarga.
    if (constantesNodo) constantesNodo.setEspecie(speciesSelect.value);
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

  /* --- Datos de hato: solo en especies de produccion ---
     Aparece y desaparece al cambiar la especie, sin recargar. Los campos
     se guardan siempre: si te equivocas de especie y la corriges, lo que
     habias escrito sigue ahi al volver. */
  const hatoCard = document.createElement("div");
  hatoCard.className = "card card-pad";
  const hatoLabel = document.createElement("label");
  hatoLabel.className = "checkbox-group-label";
  hatoLabel.style.margin = "0 0 10px";
  hatoLabel.textContent = "Datos de hato / explotación";
  hatoCard.appendChild(hatoLabel);

  function campoHato(etiqueta, campo, marcador, tipo) {
    const g = document.createElement("div");
    g.className = "field-group";
    const l = document.createElement("label");
    l.textContent = etiqueta;
    const i = document.createElement("input");
    if (tipo === "numero") {
      i.type = "number";
      i.min = "0";
      i.step = "1";
    }
    i.placeholder = marcador;
    i.value = entry[campo] == null ? "" : entry[campo];
    i.addEventListener("input", function () {
      const v = i.value;
      save(campo, v === "" ? null : (tipo === "numero" ? Number(v) : v));
      if (campo === "hatoAfectados" || campo === "hatoTamano") pintarPrevalencia();
    });
    g.appendChild(l);
    g.appendChild(i);
    return { grupo: g, input: i };
  }

  const hatoFila1 = document.createElement("div");
  hatoFila1.className = "field-row";
  hatoFila1.appendChild(campoHato("Finca, hacienda o quinta", "hatoFinca", "Ej. Hacienda La Esperanza").grupo);
  hatoCard.appendChild(hatoFila1);

  const hatoFila2 = document.createElement("div");
  hatoFila2.className = "field-row";
  /* El numero o arete identifica al animal cuando no tiene nombre, que es
     lo habitual en produccion. El nombre sigue arriba para los que si lo
     tienen: en muchas fincas la vaca lechera tiene los dos. */
  hatoFila2.appendChild(campoHato("N.º o arete del animal", "hatoNumero", "Ej. 1042").grupo);
  hatoCard.appendChild(hatoFila2);

  const hatoFila3 = document.createElement("div");
  hatoFila3.className = "field-row";
  const campoTamano = campoHato("Tamaño del hato", "hatoTamano", "Ej. 120", "numero");
  hatoFila3.appendChild(campoTamano.grupo);
  const campoAfectados = campoHato("Animales afectados", "hatoAfectados", "Ej. 8", "numero");
  hatoFila3.appendChild(campoAfectados.grupo);
  hatoCard.appendChild(hatoFila3);

  /* La prevalencia se calcula sola: es el numero que se usa para decidir
     si esto es un caso aislado o un brote, y hacerla a mano con el animal
     delante es justo cuando no se hace. */
  const prevalencia = document.createElement("p");
  prevalencia.className = "hato-prevalencia";
  hatoCard.appendChild(prevalencia);

  function pintarPrevalencia() {
    const total = parseFloat(String(campoTamano.input.value).replace(",", "."));
    const afect = parseFloat(String(campoAfectados.input.value).replace(",", "."));
    if (!isFinite(total) || total <= 0 || !isFinite(afect) || afect < 0) {
      prevalencia.hidden = true;
      return;
    }
    prevalencia.hidden = false;
    if (afect > total) {
      prevalencia.className = "hato-prevalencia hato-prevalencia-error";
      prevalencia.textContent = "Hay más afectados (" + afect + ") que animales en el hato (" + total + ").";
      return;
    }
    prevalencia.className = "hato-prevalencia";
    prevalencia.textContent =
      "Prevalencia: " + roundNice((afect / total) * 100) + " % (" + afect + " de " + total + ").";
  }
  pintarPrevalencia();

  function actualizarHato(especie) {
    hatoCard.hidden = !esEspecieDeHato(especie);
  }
  actualizarHato(entry.especie);
  leftCol.appendChild(hatoCard);

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

  /* --- columna derecha: constantes + notas clínicas + evoluciones --- */
  const rightCol = document.createElement("div");
  rightCol.className = "detail-col";

  /* Las constantes van ARRIBA de las notas y no dentro: son lo primero
     que se toma en la consulta, y con la especie ya elegida en la
     columna de al lado los rangos ya salen bien al abrir la ficha. */
  const constCard = document.createElement("div");
  constCard.className = "card card-pad";
  constantesNodo = buildConstantesSection(entry, save);
  constCard.appendChild(constantesNodo);
  rightCol.appendChild(constCard);

  /* --- Historia clínica por apartados, con los exámenes en medio --- */
  const notesCard = document.createElement("div");
  notesCard.className = "card card-pad";
  const notesLabel = document.createElement("label");
  notesLabel.className = "checkbox-group-label";
  notesLabel.style.margin = "0 0 8px";
  notesLabel.textContent = "Historia clínica";
  notesCard.appendChild(notesLabel);

  /* El aviso solo sale en los casos escritos con el cuadro único: no hay
     que explicarle nada a quien nunca vio el formato viejo. */
  if (apartadosVacios(entry) && String(entry.body || "").trim()) {
    const aviso = document.createElement("p");
    aviso.className = "apartado-legado";
    aviso.textContent =
      "Este caso se escribió antes de los apartados: todo su texto está en Anamnesis. Repártelo cuando quieras; nada se pierde.";
    notesCard.appendChild(aviso);
  }

  CASO_APARTADOS.forEach(function (ap) {
    const bloque = document.createElement("div");
    bloque.className = "apartado";

    const cabeza = document.createElement("div");
    cabeza.className = "apartado-head";
    const nombre = document.createElement("span");
    nombre.textContent = ap.etiqueta;
    cabeza.appendChild(nombre);

    /* Un micrófono por apartado y no uno para todo: dictando en la
       consulta no vas a ir cambiando de cuadro con la mano ocupada. */
    const voiceBtn = document.createElement("button");
    voiceBtn.type = "button";
    voiceBtn.className = "voice-btn voice-btn-mini";
    voiceBtn.setAttribute("data-listening", "false");
    voiceBtn.innerHTML = '<span class="rec-dot"></span><span class="label">🎤 Dictar</span>';
    cabeza.appendChild(voiceBtn);
    bloque.appendChild(cabeza);

    const caja = document.createElement("textarea");
    caja.className = "field-body apartado-caja";
    caja.placeholder = ap.marcador;
    caja.value = textoDeApartado(entry, ap.clave);
    caja.addEventListener("input", function () { save(ap.clave, caja.value); });
    attachVoiceInput(voiceBtn, caja);
    bloque.appendChild(caja);

    notesCard.appendChild(bloque);

    /* Los exámenes van DESPUÉS del examen físico: es cuando se piden, y
       el diagnóstico de abajo se escribe mirándolos. */
    if (ap.clave === "examenFisico") {
      const bloqueEx = document.createElement("div");
      bloqueEx.className = "apartado apartado-examenes";
      bloqueEx.appendChild(
        buildExamenesSection(entry, statusText, fotosDeEntrada(entry.id).then(repartirAdjuntos))
      );
      notesCard.appendChild(bloqueEx);
    }
  });

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
  card.appendChild(buildApunteEditor(entry, statusText));

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


/* ---------- Tarjeta plegable ----------
   Es un <button> y no un <div> con listener: asi funciona con Tab, Enter y
   Espacio sin reimplementar nada, y los lectores de pantalla saben decir si
   esta abierta o cerrada. */
function tarjetaPlegable(titulo, opciones) {
  const opts = opciones || {};
  const card = document.createElement("div");
  card.className = "card card-pad plegable" + (opts.clase ? " " + opts.clase : "");

  const cab = document.createElement("button");
  cab.type = "button";
  cab.className = "plegable-cab";

  const flecha = document.createElement("span");
  flecha.className = "plegable-flecha";
  flecha.textContent = "›";
  const texto = document.createElement("span");
  texto.className = "plegable-titulo";
  texto.textContent = titulo;
  const contador = document.createElement("span");
  contador.className = "plegable-contador";

  cab.appendChild(flecha);
  cab.appendChild(texto);
  cab.appendChild(contador);

  const cuerpo = document.createElement("div");
  cuerpo.className = "plegable-cuerpo";

  function aplicar(abierta) {
    cuerpo.hidden = !abierta;
    cab.setAttribute("aria-expanded", abierta ? "true" : "false");
  }
  aplicar(!!opts.abierta);

  cab.addEventListener("click", function () {
    const abrir = cuerpo.hidden;
    aplicar(abrir);
    if (typeof opts.onToggle === "function") opts.onToggle(abrir);
  });

  card.appendChild(cab);
  card.appendChild(cuerpo);

  return {
    card: card,
    cuerpo: cuerpo,
    setContador: function (t) { contador.textContent = t || ""; }
  };
}

/* Las especies de produccion son las unicas donde el tiempo de retiro
   significa algo: en un perro no hay carne ni leche que retirar. */
const ESPECIES_PRODUCCION = ["bovino", "porcino", "ovino", "caprino", "equino"];

function esEspecieDeProduccion(especie) {
  return ESPECIES_PRODUCCION.indexOf(normalizarBusqueda(especie).trim()) >= 0;
}

/* El retiro paso a vivir DENTRO de cada dosis, pero los farmacos cargados
   antes lo tienen en el array "retiro" aparte. Se lee de los dos sitios:
   primero el de la dosis, y si no hay, el del array antiguo que coincida en
   especie. Asi no hay que migrar nada y lo viejo se sigue viendo. */
function retiroDeDosis(farmaco, dosis) {
  if (dosis.retiroCarneDias != null || dosis.retiroLecheHoras != null || dosis.retiroFuente) {
    return {
      carneDias: dosis.retiroCarneDias == null ? null : dosis.retiroCarneDias,
      lecheHoras: dosis.retiroLecheHoras == null ? null : dosis.retiroLecheHoras,
      fuente: dosis.retiroFuente || ""
    };
  }
  const e = normalizarBusqueda(dosis.especie).trim();
  const viejo = (farmaco.retiro || []).find(function (r) {
    return normalizarBusqueda(r.especie).trim() === e;
  });
  if (!viejo) return { carneDias: null, lecheHoras: null, fuente: "" };
  return {
    carneDias: viejo.carneDias == null ? null : viejo.carneDias,
    lecheHoras: viejo.lecheHoras == null ? null : viejo.lecheHoras,
    fuente: viejo.fuente || ""
  };
}

/* Una sola lista de contraindicaciones. Antes habia dos — "alertas
   (contraindicaciones absolutas)" arriba en rojo y "contraindicaciones"
   abajo — y la division no ayudaba: al escribir una habia que decidir en
   cual iba, y la misma frase acababa en sitios distintos segun el dia.

   El almacen es "alertas" porque es el campo que consulta la calculadora
   para bloquear un calculo cuando el texto nombra la especie elegida.
   Guardar en el otro campo habria perdido ese bloqueo en silencio, que es
   la peor forma de perder una comprobacion de seguridad.

   Los textos del campo viejo se muestran igual y se pasan a "alertas" la
   primera vez que se edita la lista. Hasta entonces no se escribe nada. */
function contraindicacionesDe(farmaco) {
  return (farmaco.alertas || []).concat(farmaco.contraindicaciones || []);
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
   Orden: foto del producto, presentaciones (plegadas), dosis plegadas
   por especie con su tiempo de retiro dentro, verificacion y, al final,
   las contraindicaciones en rojo. */

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
  titleInput.className = "field-title field-title-farmaco";
  titleInput.placeholder = "Nombre genérico";
  titleInput.value = far.nombreGenerico;
  titleInput.style.margin = "10px 0 8px";
  titleInput.addEventListener("input", () => save("nombreGenerico", titleInput.value));

  root.appendChild(tag);
  root.appendChild(titleInput);

  const familiaRow = document.createElement("div");
  familiaRow.className = "field-row field-row-familia";
  const familiaInput = inputTexto(far.familia, "Ej. AINE, aminoglucósido, fluoroquinolona");
  familiaInput.className += " input-familia";
  familiaInput.addEventListener("input", () => save("familia", familiaInput.value));
  familiaRow.appendChild(campoFormulario("Familia", familiaInput));
  root.appendChild(familiaRow);

  /* --- 1. Presentaciones, con la foto del producto al lado ---

     La foto va DENTRO de esta tarjeta y no en una suya: la foto del
     frasco y lo que dice su etiqueta son el mismo dato mirado de dos
     maneras, y separarlas obligaba a subir y bajar para cruzarlas.

     La seccion de fotos se reutiliza tal cual de los casos clinicos:
     solo necesitaba un id, y la coleccion "fotos" guarda
     uidEntrada = uid + id, sirva ese id para un caso o para un farmaco.
     Lo unico que cambia es la etiqueta, porque aqui no se guardan
     radiografias sino la caja del producto.

     Plegada de entrada: la mayoria de las veces se abre la ficha para
     mirar una dosis, no la concentracion del frasco. */
  const presPlegable = tarjetaPlegable("Presentaciones", { abierta: false });
  const presCard = presPlegable.card;

  const presFila = document.createElement("div");
  presFila.className = "pres-fila";

  const fotoCol = document.createElement("div");
  fotoCol.className = "pres-foto";
  fotoCol.appendChild(buildPhotosSection(far, statusText, "Foto del producto"));
  presFila.appendChild(fotoCol);

  const presCol = document.createElement("div");
  presCol.className = "pres-datos";
  presFila.appendChild(presCol);
  presPlegable.cuerpo.appendChild(presFila);

  const presLista = document.createElement("div");
  presCol.appendChild(presLista);

  function pintarPresentaciones() {
    presLista.innerHTML = "";
    presPlegable.setContador(
      far.presentaciones.length
        ? far.presentaciones.length + (far.presentaciones.length === 1 ? " presentación" : " presentaciones")
        : "ninguna"
    );
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
  presCol.appendChild(addPres);
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

    /* El tiempo de retiro va aqui dentro y solo en especies de
       produccion. Estaba en una tarjeta aparte al final, y eso obligaba a
       cruzar a mano dos listas para saber cuantos dias de retiro tiene la
       pauta que estas mirando. En un perro no aparece porque no hay carne
       ni leche que retirar. */
    if (esEspecieDeProduccion(d.especie)) {
      const ret = retiroDeDosis(far, d);
      const fila4 = document.createElement("div");
      fila4.className = "field-row field-row-retiro";

      const carne = inputNumero(ret.carneDias, "Días");
      carne.addEventListener("input", () => editar("retiroCarneDias", carne.value === "" ? null : Number(carne.value)));
      fila4.appendChild(campoFormulario("Retiro carne (días)", carne));

      const leche = inputNumero(ret.lecheHoras, "Horas");
      leche.addEventListener("input", () => editar("retiroLecheHoras", leche.value === "" ? null : Number(leche.value)));
      fila4.appendChild(campoFormulario("Retiro leche (horas)", leche));

      const fuenteRet = inputTexto(ret.fuente, "AGROCALIDAD, FDA, EMA…");
      fuenteRet.addEventListener("input", () => editar("retiroFuente", fuenteRet.value));
      fila4.appendChild(campoFormulario("Fuente del retiro", fuenteRet));

      bloque.appendChild(fila4);

      // Fuera de AGROCALIDAD el dato no es vinculante en Ecuador.
      if ((ret.carneDias != null || ret.lecheHoras != null) && retiroEsOrientativo(ret)) {
        const avisoRet = document.createElement("p");
        avisoRet.className = "form-aviso-legal";
        avisoRet.textContent =
          "Retiro orientativo: la fuente no es AGROCALIDAD. En Ecuador el vinculante es el de la etiqueta del producto registrado localmente.";
        bloque.appendChild(avisoRet);
      }
    }

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

  /* Que especies dejaste abiertas. Vive fuera de pintarDosis para que
     quitar una pauta no vuelva a cerrarlo todo. */
  const dosisEspeciesAbiertas = new Set();

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
      /* Una tarjeta plegable por especie, cerrada de entrada. Con seis
         especies y varias pautas cada una, la ficha abierta entera eran
         tres pantallas de campos entre las que buscar la tuya. */
      const pleg = tarjetaPlegable(especie, {
        clase: "form-especie",
        abierta: dosisEspeciesAbiertas.has(especie),
        onToggle: (abierta) => {
          if (abierta) dosisEspeciesAbiertas.add(especie);
          else dosisEspeciesAbiertas.delete(especie);
        }
      });
      const conRetiro = filas.filter(({ d }) => {
        const r = retiroDeDosis(far, d);
        return r.carneDias != null || r.lecheHoras != null;
      }).length;
      pleg.setContador(
        filas.length + (filas.length === 1 ? " pauta" : " pautas") +
          (conRetiro ? " · " + conRetiro + " con retiro" : "")
      );
      filas.forEach(({ d, i }) => pleg.cuerpo.appendChild(filaDosis(d, i)));
      dosisLista.appendChild(pleg.card);
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

  /* --- 4. Verificación --- */
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

  /* --- Contraindicaciones (al final, en rojo y en UNA sola lista) ---

     Antes habia dos listas: "Alertas — contraindicaciones absolutas"
     arriba del todo y "Contraindicaciones" abajo. La division obligaba a
     decidir en cual iba cada frase, y la misma acababa en un sitio u otro
     segun el dia. Ahora es una.

     Se guardan en "alertas" porque ese es el campo que mira la calculadora
     para BLOQUEAR un calculo cuando el texto nombra la especie elegida.
     Guardarlas en el otro campo habria quitado ese bloqueo sin que se
     notara, que es la peor forma de perder una comprobacion de seguridad.

     Lo que ya estaba en "contraindicaciones" se muestra igual (ver
     contraindicacionesDe) y se pasa a "alertas" la primera vez que tocas
     la lista. Hasta entonces no se escribe nada: abrir la ficha para mirar
     no cambia los datos. */
  const contraWrap = document.createElement("div");
  contraWrap.className = "form-contra";
  const contraTitulo = document.createElement("div");
  contraTitulo.className = "form-contra-titulo";
  contraTitulo.textContent = "⚠ Contraindicaciones y advertencias";
  contraWrap.appendChild(contraTitulo);
  const contraLista = document.createElement("div");
  contraWrap.appendChild(contraLista);

  // Copia de trabajo: mezcla los dos campos y a partir de aqui es la unica
  // fuente de verdad mientras la ficha esta abierta.
  let contras = contraindicacionesDe(far);

  function guardarContras(lista) {
    contras = lista;
    far.alertas = lista;
    save("alertas", lista);
    // Solo se vacia el campo viejo si de verdad tenia algo: si no, seria
    // una escritura inutil en cada tecla.
    if ((far.contraindicaciones || []).length) {
      far.contraindicaciones = [];
      save("contraindicaciones", []);
    }
  }

  function pintarContra() {
    contraLista.innerHTML = "";
    if (!contras.length) {
      const vacio = document.createElement("p");
      vacio.className = "form-vacio";
      vacio.textContent = "Sin contraindicaciones registradas.";
      contraLista.appendChild(vacio);
    }
    contras.forEach((texto, i) => {
      const fila = document.createElement("div");
      fila.className = "form-fila form-fila-contra";
      const input = inputTexto(texto, "Ej. Insuficiencia renal · Felinos: no usar");
      input.addEventListener("input", () => {
        const copia = contras.slice();
        copia[i] = input.value;
        guardarContras(copia);
      });
      fila.appendChild(input);
      fila.appendChild(
        botonQuitar("Quitar contraindicación", () => {
          guardarContras(contras.filter((_, j) => j !== i));
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
    guardarContras(contras.concat(""));
    pintarContra();
  });
  contraWrap.appendChild(addContra);

  const contraNota = document.createElement("p");
  contraNota.className = "form-contra-nota";
  contraNota.textContent =
    "Si el texto nombra una especie (p. ej. “felinos”), la calculadora bloquea el cálculo para esa especie.";
  contraWrap.appendChild(contraNota);
  root.appendChild(contraWrap);


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

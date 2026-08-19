import { firebaseConfig } from "./firebase-config.js";
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
  updateDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  query,
  orderBy,
  where,
  serverTimestamp,
  enableIndexedDbPersistence
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === "failed-precondition") {
    console.warn("Persistencia offline no disponible: hay otra pestaña del cuaderno abierta.");
  } else if (err.code === "unimplemented") {
    console.warn("Este navegador no soporta persistencia offline.");
  }
});

const SPECIES_OPTIONS = ["Bovino", "Equino", "Porcino", "Aves", "Canino", "Felino", "Ovino", "Caprino", "Exótico", "Otro"];
const AREA_OPTIONS = ["Cirugía", "Medicina interna", "Reproducción", "Emergencia", "Seguimiento", "Otro"];

const els = {
  app: document.getElementById("app"),
  sidebar: document.getElementById("sidebar"),
  pageNav: Array.prototype.slice.call(document.querySelectorAll("#pageNav .nav-item")),
  countPatients: document.getElementById("countPatients"),
  countFarmacos: document.getElementById("countFarmacos"),
  countStudy: document.getElementById("countStudy"),
  search: document.getElementById("search"),
  content: document.getElementById("content"),
  toggleSidebar: document.getElementById("toggleSidebar"),
  connPill: document.getElementById("connPill"),
  connText: document.getElementById("connText"),
  themeToggle: document.getElementById("themeToggle"),
  authGate: document.getElementById("authGate"),
  authEmail: document.getElementById("authEmail"),
  authSendBtn: document.getElementById("authSendBtn"),
  authMsg: document.getElementById("authMsg"),
  authUser: document.getElementById("authUser"),
  signOutBtn: document.getElementById("signOutBtn")
};

const PAGE_LABELS = {
  dashboard: "Dashboard",
  patients: "Patients",
  farmacos: "Fármacos",
  study: "Study",
  calendar: "Calendar",
  reports: "Reports",
  settings: "Settings"
};

const state = {
  entries: [],
  formulario: [],
  page: "dashboard",
  studyTab: "materias",
  areaFilter: "",
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

function matchesQuery(entry, q) {
  if (!q) return true;
  q = q.toLowerCase();
  return (
    (entry.title || "").toLowerCase().includes(q) ||
    (entry.meta || "").toLowerCase().includes(q) ||
    (entry.especie || "").toLowerCase().includes(q) ||
    (entry.area || "").toLowerCase().includes(q) ||
    (entry.tutorNombre || "").toLowerCase().includes(q) ||
    (entry.body || "").toLowerCase().includes(q)
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
  q = q.toLowerCase();
  return (
    (item.nombre || "").toLowerCase().includes(q) ||
    (item.concentracion || "").toLowerCase().includes(q) ||
    (item.paciente || "").toLowerCase().includes(q) ||
    (item.caseTitle || "").toLowerCase().includes(q) ||
    (item.especie || "").toLowerCase().includes(q)
  );
}

function matchesFormularioQuery(item, q) {
  if (!q) return true;
  q = q.toLowerCase();
  return (
    (item.nombre || "").toLowerCase().includes(q) ||
    (item.via || "").toLowerCase().includes(q) ||
    (Array.isArray(item.especies) ? item.especies : []).some((e) => (e || "").toLowerCase().includes(q))
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

function scheduleSave(collectionName, entryId, patch, statusEl) {
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
      await updateDoc(doc(db, collectionName, entryId), { ...patch, updatedAt: serverTimestamp() });
      if (statusEl) {
        statusEl.parentElement.setAttribute("data-state", "ok");
        statusEl.textContent = "Sincronizado";
      }
      showToast("Guardado");
    } catch (err) {
      if (statusEl) {
        statusEl.parentElement.setAttribute("data-state", "error");
        statusEl.textContent = "Sin conexión — se guardará al reconectar";
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

  const photos = Array.isArray(entry.fotos) ? entry.fotos.slice() : [];

  function commit() {
    scheduleSave("entries", entry.id, { fotos: photos }, statusText);
  }

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
        spin.textContent = "Subiendo…";
        tile.appendChild(spin);
      } else {
        const del = document.createElement("button");
        del.type = "button";
        del.className = "photo-remove";
        del.textContent = "×";
        del.setAttribute("aria-label", "Eliminar foto");
        del.addEventListener("click", async () => {
          if (!confirm("¿Eliminar esta foto?")) return;
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
      const placeholder = { url: URL.createObjectURL(file), name: file.name, uploading: true };
      photos.push(placeholder);
      renderGrid();
      const path = "photos/" + currentUid + "/" + entry.id + "/" + Date.now() + "_" + file.name;
      try {
        const compressed = await compressImage(file, 1600, 0.82);
        const ref_ = storageRef(storage, path);
        await uploadBytes(ref_, compressed, { contentType: "image/jpeg" });
        const url = await getDownloadURL(ref_);
        const idx = photos.indexOf(placeholder);
        if (idx > -1) photos[idx] = { url, path, name: file.name };
        renderGrid();
        commit();
      } catch (err) {
        const idx = photos.indexOf(placeholder);
        if (idx > -1) photos.splice(idx, 1);
        renderGrid();
        alert("No se pudo subir " + file.name + ". Revisa tu conexión (o si Storage sigue sin activarse en el proyecto).");
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
// puntuales de un clic — "+ Agregar evolución" y "Add to Case Notes" desde
// la calculadora — no para campos que el usuario escribe letra por letra).
async function addEvolutionToCase(caseEntry, texto) {
  const current = Array.isArray(caseEntry.evoluciones) ? caseEntry.evoluciones.slice() : [];
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
   Puede abrirse SIN contexto de caso (desde Study o Dashboard, solo
   consulta) o CON contexto de caso (desde la sección de fármacos de un
   caso abierto). Solo cuando hay contexto de caso se muestra el botón
   "Add to Case Notes", que agrega el resultado como una nueva evolución
   del caso — nunca escribe en la tabla de fármacos ni en "Dosis
   administrada". Esto fue una decisión explícita del usuario. */
function buildDoseCalculator(context) {
  const ctx = context || {};
  const wrap = document.createElement("div");
  wrap.className = "calc";

  const nameField = document.createElement("div");
  nameField.className = "calc-field";
  const nameLabel = document.createElement("label");
  nameLabel.textContent = "Fármaco";
  const nameInput = document.createElement("input");
  nameInput.setAttribute("list", "calcFarmacoList");
  nameInput.placeholder = "Escribe el nombre…";
  const datalist = document.createElement("datalist");
  datalist.id = "calcFarmacoList";
  state.formulario.forEach((f) => {
    if (!f.nombre) return;
    const opt = document.createElement("option");
    opt.value = f.nombre;
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

  const weightField = document.createElement("div");
  weightField.className = "calc-field";
  const weightLabel = document.createElement("label");
  weightLabel.textContent = "Peso del paciente (kg)";
  const weightInput = document.createElement("input");
  weightInput.type = "number";
  weightInput.step = "any";
  weightInput.min = "0";
  weightInput.placeholder = "Ej. 12.5";
  if (ctx.caseEntry && ctx.caseEntry.peso) {
    const parsedPeso = parseFloat(String(ctx.caseEntry.peso).replace(",", "."));
    if (isFinite(parsedPeso)) weightInput.value = parsedPeso;
  }
  weightField.appendChild(weightLabel);
  weightField.appendChild(weightInput);

  const result = document.createElement("div");
  result.className = "calc-result";

  let selectedDrug = null;
  let lastSummaryLine = "";
  let lastTotalLine = "";

  function findDrug(name) {
    const n = (name || "").trim().toLowerCase();
    if (!n) return null;
    return state.formulario.find((f) => (f.nombre || "").trim().toLowerCase() === n) || null;
  }

  function updateSpeciesField() {
    speciesSelect.innerHTML = "";
    const especies = selectedDrug && Array.isArray(selectedDrug.especies) ? selectedDrug.especies : [];
    if (!selectedDrug || especies.length <= 1) {
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
    if (selectedDrug.dosisValor == null || !isFinite(selectedDrug.dosisValor)) {
      showEmpty("Este fármaco no tiene una dosis numérica cargada en el formulario.");
      if (addBtn) result.appendChild(addBtn);
      return;
    }

    const weight = parseFloat(weightInput.value);
    if (!weight || weight <= 0) {
      showEmpty("Ingresa el peso del paciente para calcular la dosis.");
      if (addBtn) result.appendChild(addBtn);
      return;
    }

    const dosisUnidad = selectedDrug.dosisUnidad || "";
    const massUnit = dosisUnidad.includes("/") ? dosisUnidad.split("/")[0].trim() : dosisUnidad;
    const totalDose = weight * selectedDrug.dosisValor;
    const especieNote = speciesSelect.value ? " (" + speciesSelect.value + ")" : "";

    const formulaLine =
      "Dosis total" + especieNote + " = peso × dosis = " + weight + " kg × " + selectedDrug.dosisValor + " " + dosisUnidad;
    addLine(formulaLine);
    const totalText = roundNice(totalDose) + " " + massUnit;
    addLine("= " + totalText, "calc-total");

    lastSummaryLine = selectedDrug.nombre + ": " + weight + " kg × " + selectedDrug.dosisValor + " " + dosisUnidad + especieNote;
    lastTotalLine = "Dosis total = " + totalText;

    if (selectedDrug.concentracionValor && isFinite(selectedDrug.concentracionValor) && selectedDrug.concentracionValor > 0) {
      const concUnidad = selectedDrug.concentracionUnidad || "";
      const volUnit = concUnidad.includes("/") ? concUnidad.split("/")[1].trim() : "";
      const volume = totalDose / selectedDrug.concentracionValor;
      const volText = roundNice(volume) + " " + volUnit;

      addLine(
        "Volumen = dosis total ÷ concentración = " + totalText + " ÷ " + selectedDrug.concentracionValor + " " + concUnidad
      );
      addLine("= " + volText, "calc-total");
      lastTotalLine += " · Volumen a administrar = " + volText;
    }

    if (addBtn) {
      result.appendChild(addBtn);
      updateAddButton(true);
    }
  }

  nameInput.addEventListener("input", () => {
    selectedDrug = findDrug(nameInput.value);
    updateSpeciesField();
    renderResult();
  });
  speciesSelect.addEventListener("change", renderResult);
  weightInput.addEventListener("input", renderResult);

  wrap.appendChild(nameField);
  wrap.appendChild(speciesField);
  wrap.appendChild(weightField);
  wrap.appendChild(result);

  // "Add to Case Notes": solo existe cuando la calculadora se abrió desde
  // un caso clínico específico. Escribe el resultado como una nueva
  // evolución del caso — es lo único que este botón hace.
  if (ctx.caseEntry) {
    addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "calc-add-btn";
    addBtn.textContent = "Add to Case Notes";
    addBtn.disabled = true;
    addBtn.addEventListener("click", async () => {
      if (!lastSummaryLine) return;
      addBtn.disabled = true;
      addBtn.textContent = "Agregando…";
      try {
        await addEvolutionToCase(ctx.caseEntry, "Cálculo de dosis — " + lastSummaryLine + ". " + lastTotalLine + ".");
        addBtn.textContent = "Add to Case Notes";
        if (addedMsg) addedMsg.remove();
        addedMsg = document.createElement("div");
        addedMsg.className = "calc-added-msg";
        addedMsg.textContent = "✓ Agregado a Case Notes";
        result.appendChild(addedMsg);
      } catch (err) {
        addBtn.textContent = "Add to Case Notes";
        alert("No se pudo agregar a las notas del caso. Revisa tu conexión e intenta de nuevo.");
      } finally {
        addBtn.disabled = false;
      }
    });
  }

  renderResult();

  return wrap;
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
  h2.textContent = "Drug Formulary & Calculator";
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
    note.textContent = "Caso: " + (context.caseEntry.meta || context.caseEntry.title || "(sin nombre)");
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

function render() {
  setActiveNav();
  els.content.innerHTML = "";

  const inner = document.createElement("div");
  inner.className = "content-inner";
  els.content.appendChild(inner);

  if (!state.ready) {
    inner.appendChild(emptyState("⏳", "Conectando con el cuaderno…", "Un momento, esto solo pasa la primera vez."));
    return;
  }

  if (state.page === "dashboard") renderDashboardPage(inner);
  else if (state.page === "patients") renderPatientsPage(inner);
  else if (state.page === "farmacos") renderFarmacosPage(inner);
  else if (state.page === "study") renderStudyPage(inner);
  else if (state.page === "calendar") renderPlaceholderPage(inner, "📅", "Calendar", "Próximamente: agenda de citas y seguimientos.");
  else if (state.page === "reports") renderPlaceholderPage(inner, "📈", "Reports", "Próximamente: reportes y estadísticas del cuaderno.");
  else if (state.page === "settings") renderSettingsPage(inner);
}

function renderPlaceholderPage(root, glyph, title, body) {
  root.appendChild(pageHead(title));
  root.appendChild(emptyState(glyph, "Próximamente", body));
}

/* ---------- Dashboard ---------- */

function renderDashboardPage(root) {
  root.appendChild(pageHead("Dashboard", "Resumen general de pacientes y herramientas de estudio."));

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
  overviewTitle.textContent = "Patient & Clinical Cases Overview";
  const newCaseBtn = document.createElement("button");
  newCaseBtn.type = "button";
  newCaseBtn.className = "btn-primary";
  newCaseBtn.textContent = "+ New Case";
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
  drugTitle.textContent = "Drug Reference Table";
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
  calcHead.textContent = "Dose Calculator";
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

/* ---------- Patients (casos clínicos) ---------- */

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

function buildPatientsTable(list, compact) {
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
  list.forEach((entry) => {
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
    if (entry.title) {
      const sub = document.createElement("div");
      sub.className = "cell-muted";
      sub.style.fontSize = "0.78rem";
      sub.textContent = entry.title;
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

    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  wrap.appendChild(table);
  return wrap;
}

function renderPatientsPage(root) {
  const active = state.activeId ? state.entries.find((e) => e.id === state.activeId && e.section === "casos") : null;
  if (active) {
    renderPatientDetail(root, active);
    return;
  }

  const head = pageHead("Patients", "Casos clínicos registrados.");
  const newBtn = document.createElement("button");
  newBtn.type = "button";
  newBtn.className = "btn-primary";
  newBtn.textContent = "+ New Case";
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
  root.appendChild(filterRow);

  const list = entriesForSection("casos")
    .filter((e) => matchesQuery(e, state.query))
    .filter((e) => !state.areaFilter || e.area === state.areaFilter)
    .sort((a, b) => (b._sortKey || 0) - (a._sortKey || 0));

  const card = document.createElement("div");
  card.className = "card";
  card.appendChild(buildPatientsTable(list, false));
  root.appendChild(card);
}

function renderPatientDetail(root, entry) {
  root.appendChild(
    backLink("Patients", () => {
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
  sub.textContent = [entry.especie, entry.raza, entry.peso].filter(Boolean).join(" · ") || "Especie, raza y peso sin especificar";

  info.appendChild(nameRow);
  info.appendChild(sub);

  const actions = document.createElement("div");
  actions.className = "patient-head-actions";
  const calcBtn = document.createElement("button");
  calcBtn.type = "button";
  calcBtn.className = "btn-secondary";
  calcBtn.textContent = "🧮 Calculate Dosage";
  calcBtn.addEventListener("click", () => openCalculatorOverlay({ caseEntry: entry }));
  actions.appendChild(calcBtn);

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
    sub.textContent = [speciesSelect.value, entry.raza, entry.peso].filter(Boolean).join(" · ") || "Especie, raza y peso sin especificar";
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
    sub.textContent = [entry.especie, razaInput.value, entry.peso].filter(Boolean).join(" · ") || "Especie, raza y peso sin especificar";
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
    sub.textContent = [entry.especie, entry.raza, pesoInput.value].filter(Boolean).join(" · ") || "Especie, raza y peso sin especificar";
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
    if (confirm("¿Eliminar el caso de “" + (entry.meta || "este paciente") + "”? Esta acción no se puede deshacer.")) {
      state.activeId = null;
      render();
      try {
        await deleteDoc(doc(db, "entries", entry.id));
      } catch (err) {
        alert("No se pudo eliminar (sin conexión). Se reintentará cuando vuelvas a estar en línea.");
      }
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

/* ---------- Study (Materias + Formulario) ---------- */

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

  root.appendChild(pageHead("Study Center", "Reference materials and pharmacological data."));

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
  root.appendChild(
    backLink("Study Center", () => {
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
    if (confirm("¿Eliminar “" + (entry.title || "esta entrada") + "”? Esta acción no se puede deshacer.")) {
      state.activeId = null;
      render();
      try {
        await deleteDoc(doc(db, "entries", entry.id));
      } catch (err) {
        alert("No se pudo eliminar (sin conexión). Se reintentará cuando vuelvas a estar en línea.");
      }
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
  const cols = withActions ? ["Drug Name", "Dosis", "Vía", "Especies", "Acción"] : ["Drug Name", "Dosis", "Especies"];
  table.innerHTML = "<thead><tr>" + cols.map((c) => "<th>" + c + "</th>").join("") + "</tr></thead>";
  const tbody = document.createElement("tbody");
  list.forEach((item) => {
    const tr = document.createElement("tr");
    if (!withActions) tr.style.cursor = "default";
    else {
      tr.addEventListener("click", (e) => {
        if (e.target.closest(".row-actions")) return;
        state.studyTab = "formulario";
        state.activeId = item.id;
        render();
      });
    }
    const nameTd = document.createElement("td");
    nameTd.className = "cell-title";
    nameTd.textContent = item.nombre || "(sin nombre)";
    const doseTd = document.createElement("td");
    doseTd.className = "cell-muted";
    doseTd.textContent = item.dosisValor != null ? item.dosisValor + " " + (item.dosisUnidad || "") : "—";
    const specTd = document.createElement("td");
    specTd.className = "cell-muted";
    specTd.textContent = Array.isArray(item.especies) && item.especies.length ? item.especies.join(", ") : "—";
    tr.appendChild(nameTd);
    tr.appendChild(doseTd);
    if (withActions) {
      const viaTd = document.createElement("td");
      viaTd.className = "cell-muted";
      viaTd.textContent = item.via || "—";
      tr.appendChild(viaTd);
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
        state.activeId = item.id;
        render();
      });
      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "icon-btn danger";
      delBtn.textContent = "🗑";
      delBtn.setAttribute("aria-label", "Eliminar");
      delBtn.addEventListener("click", async () => {
        if (!confirm("¿Eliminar “" + (item.nombre || "este fármaco") + "” del formulario?")) return;
        try {
          await deleteDoc(doc(db, "formulario", item.id));
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
      nombre: "",
      especies: [],
      dosisValor: null,
      dosisUnidad: "mg/kg",
      via: "",
      frecuencia: "",
      concentracionValor: null,
      concentracionUnidad: "",
      fuente: "",
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

function renderFormularioTab(root) {
  const subjectGrid = document.createElement("div");
  subjectGrid.className = "subject-grid";
  const subjectDefs = [
    ["📖", "Pharmacology", "Comprehensive drug interactions, pharmacokinetics, and dosing."],
    ["🩺", "Internal Medicine", "Diagnostic protocols, endocrinology, and systemic diseases."],
    ["✂️", "Surgery", "Surgical approaches, anesthesia protocols, & post-op care."],
    ["🩻", "Diagnostic Imaging", "Radiographic interpretation and diagnostic imaging notes."]
  ];
  subjectDefs.forEach(([ico, title, desc]) => {
    const card = document.createElement("div");
    card.className = "subject-card";
    card.innerHTML =
      '<div class="ico">' + ico + "</div>" +
      "<h3>" + title + "</h3>" +
      "<p>" + desc + "</p>" +
      '<span class="link">EXPLORE SUBJECT →</span>';
    subjectGrid.appendChild(card);
  });
  root.appendChild(subjectGrid);

  const card = document.createElement("div");
  card.className = "card";
  const cardHead = document.createElement("div");
  cardHead.className = "card-head";
  const cardTitle = document.createElement("h2");
  cardTitle.textContent = "Formulario de Fármacos";
  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "btn-primary";
  addBtn.textContent = "+ ADD DRUG";
  addBtn.addEventListener("click", () => createFormularioEntry());
  cardHead.appendChild(cardTitle);
  cardHead.appendChild(addBtn);
  card.appendChild(cardHead);

  const filterRow = document.createElement("div");
  filterRow.style.padding = "14px 18px 0";
  const especieSelect = document.createElement("select");
  especieSelect.className = "btn-secondary";
  const blankOpt = document.createElement("option");
  blankOpt.value = "";
  blankOpt.textContent = "Todas las especies";
  especieSelect.appendChild(blankOpt);
  SPECIES_OPTIONS.forEach((opt) => {
    const o = document.createElement("option");
    o.value = opt;
    o.textContent = opt;
    especieSelect.appendChild(o);
  });
  especieSelect.value = state.formularioEspecieFilter;
  especieSelect.addEventListener("change", () => {
    state.formularioEspecieFilter = especieSelect.value;
    render();
  });
  filterRow.appendChild(especieSelect);
  card.appendChild(filterRow);

  const listWrap = document.createElement("div");
  listWrap.style.padding = "14px 0 4px";
  const list = state.formulario
    .filter((f) => matchesFormularioQuery(f, state.query))
    .filter((f) => !state.formularioEspecieFilter || (Array.isArray(f.especies) ? f.especies : []).includes(state.formularioEspecieFilter))
    .sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));
  listWrap.appendChild(buildFormularioTable(list, true));
  card.appendChild(listWrap);

  root.appendChild(card);
}

function renderFormularioDetail(root, item) {
  root.appendChild(
    backLink("Study Center", () => {
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
    scheduleSave("formulario", item.id, { [field]: value }, statusText);
  }

  const tag = document.createElement("span");
  tag.className = "section-tag formulario";
  tag.textContent = "Fármaco de referencia";
  tag.style.margin = "10px 0";
  tag.style.display = "inline-flex";

  const titleInput = document.createElement("input");
  titleInput.className = "field-title";
  titleInput.placeholder = "Nombre del fármaco";
  titleInput.value = item.nombre || "";
  titleInput.style.margin = "10px 0 16px";
  titleInput.addEventListener("input", () => save("nombre", titleInput.value));

  const card = document.createElement("div");
  card.className = "card card-pad";

  const especiesLabel = document.createElement("label");
  especiesLabel.className = "checkbox-group-label";
  especiesLabel.textContent = "Especies aplicables";
  const especiesBox = buildSpeciesCheckboxes(item.especies, (list) => save("especies", list));

  const doseRow = document.createElement("div");
  doseRow.className = "field-row";
  doseRow.style.marginTop = "12px";

  function numberField(labelText, value, onInput, placeholder) {
    const group = document.createElement("div");
    group.className = "field-group";
    const lbl = document.createElement("label");
    lbl.textContent = labelText;
    const input = document.createElement("input");
    input.type = "number";
    input.step = "any";
    input.placeholder = placeholder;
    input.value = value != null ? value : "";
    input.addEventListener("input", () => onInput(input.value));
    group.appendChild(lbl);
    group.appendChild(input);
    return group;
  }
  function textField(labelText, value, onInput, placeholder) {
    const group = document.createElement("div");
    group.className = "field-group";
    const lbl = document.createElement("label");
    lbl.textContent = labelText;
    const input = document.createElement("input");
    input.placeholder = placeholder;
    input.value = value || "";
    input.addEventListener("input", () => onInput(input.value));
    group.appendChild(lbl);
    group.appendChild(input);
    return group;
  }

  doseRow.appendChild(numberField("Dosis", item.dosisValor, (v) => save("dosisValor", v === "" ? null : Number(v)), "Ej. 20"));
  doseRow.appendChild(textField("Unidad", item.dosisUnidad, (v) => save("dosisUnidad", v), "Ej. mg/kg"));
  doseRow.appendChild(textField("Vía", item.via, (v) => save("via", v), "Ej. Oral, IV, IM, SC…"));
  doseRow.appendChild(textField("Frecuencia", item.frecuencia, (v) => save("frecuencia", v), "Ej. c/12h"));

  const concRow = document.createElement("div");
  concRow.className = "field-row";
  concRow.appendChild(numberField("Concentración (opcional)", item.concentracionValor, (v) => save("concentracionValor", v === "" ? null : Number(v)), "Ej. 50"));
  concRow.appendChild(textField("Unidad de concentración", item.concentracionUnidad, (v) => save("concentracionUnidad", v), "Ej. mg/mL"));

  const fuenteRow = document.createElement("div");
  fuenteRow.className = "field-row";
  fuenteRow.appendChild(textField("Fuente / referencia", item.fuente, (v) => save("fuente", v), "Ej. Plumb's Veterinary Drug Handbook, 9na ed."));

  card.appendChild(especiesLabel);
  card.appendChild(especiesBox);
  card.appendChild(doseRow);
  card.appendChild(concRow);
  card.appendChild(fuenteRow);
  root.appendChild(tag);
  root.appendChild(titleInput);
  root.appendChild(card);

  const foot = document.createElement("div");
  foot.className = "editor-foot";
  const del = document.createElement("button");
  del.className = "btn-delete";
  del.type = "button";
  del.textContent = "Eliminar entrada";
  del.addEventListener("click", async () => {
    if (confirm("¿Eliminar “" + (item.nombre || "este fármaco") + "” del formulario? Esta acción no se puede deshacer.")) {
      state.activeId = null;
      render();
      try {
        await deleteDoc(doc(db, "formulario", item.id));
      } catch (err) {
        alert("No se pudo eliminar (sin conexión). Se reintentará cuando vuelvas a estar en línea.");
      }
    }
  });
  foot.appendChild(status);
  foot.appendChild(del);
  root.appendChild(foot);

  if (!item.nombre) setTimeout(() => titleInput.focus(), 0);
}

/* ---------- Settings ---------- */

function renderSettingsPage(root) {
  root.appendChild(pageHead("Settings"));

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
    if (confirm("¿Cerrar sesión en este dispositivo?")) signOut(auth);
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
    a.download = "cuaderno-vet-" + todayISO() + ".json";
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
      if (!confirm("¿Agregar " + incoming.length + " entrada(s) de esta copia al cuaderno? Se omiten las que ya existan.")) {
        return;
      }
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
    if (confirm("¿Cerrar sesión en este dispositivo?")) signOut(auth);
  });
}

async function completeSignInIfNeeded() {
  if (!isSignInWithEmailLink(auth, window.location.href)) return;
  let email = localStorage.getItem(EMAIL_KEY);
  if (!email) {
    email = window.prompt("Confirma el correo con el que solicitaste el enlace, para completar el acceso:");
  }
  if (!email) return;
  try {
    await signInWithEmailLink(auth, email, window.location.href);
    localStorage.removeItem(EMAIL_KEY);
  } catch (err) {
    setAuthMsg("El enlace no es válido o ya expiró. Solicita uno nuevo.", "error");
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
      setConn(navigator.onLine ? "online" : "offline", navigator.onLine ? "En línea" : "Sin conexión — se guardará al reconectar");
      render();
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
      render();
    },
    (err) => {
      console.error(err);
    }
  );
}

onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUid = user.uid;
    els.authGate.hidden = true;
    els.app.hidden = false;
    if (els.authUser) {
      els.authUser.hidden = false;
      els.authUser.textContent = user.email || "Sesión activa";
    }
    setConn("offline", "Conectando…");
    render();
    adoptOrphanEntries().then(subscribeEntries);
    subscribeFormulario();
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
    state.ready = false;
    els.app.hidden = true;
    els.authGate.hidden = false;
    if (els.authUser) els.authUser.hidden = true;
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

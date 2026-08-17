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

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === "failed-precondition") {
    console.warn("Persistencia offline no disponible: hay otra pestaña del cuaderno abierta.");
  } else if (err.code === "unimplemented") {
    console.warn("Este navegador no soporta persistencia offline.");
  }
});

const SECTION_META = {
  materias: {
    label: "Materia",
    metaLabel: "Materia / tema",
    metaPlaceholder: "Ej. Patología General",
    bodyPlaceholder: "Escribe tus apuntes de clase…",
    titlePlaceholder: "Título del apunte",
    emptyGlyph: "§",
    emptyTitle: "Aún no hay apuntes de materias",
    emptyBody: "Crea una entrada para empezar a registrar tus clases."
  },
  casos: {
    label: "Caso clínico",
    metaLabel: "Paciente",
    metaPlaceholder: "Ej. Nombre del paciente",
    bodyPlaceholder: "Anamnesis, examen físico, diagnóstico, tratamiento…",
    titlePlaceholder: "Motivo de consulta",
    emptyGlyph: "✚",
    emptyTitle: "Aún no hay casos clínicos",
    emptyBody: "Registra tu primer caso de prácticas o vinculación."
  }
};

const SPECIES_OPTIONS = ["Bovino", "Equino", "Porcino", "Aves", "Canino", "Felino", "Ovino", "Caprino", "Exótico", "Otro"];

const els = {
  app: document.getElementById("app"),
  sidebar: document.getElementById("sidebar"),
  tabs: Array.prototype.slice.call(document.querySelectorAll(".tab")),
  search: document.getElementById("search"),
  entryList: document.getElementById("entryList"),
  newEntry: document.getElementById("newEntry"),
  page: document.getElementById("page"),
  countMaterias: document.getElementById("countMaterias"),
  countCasos: document.getElementById("countCasos"),
  toggleSidebar: document.getElementById("toggleSidebar"),
  mobileLabel: document.getElementById("mobileLabel"),
  connPill: document.getElementById("connPill"),
  connText: document.getElementById("connText"),
  themeToggle: document.getElementById("themeToggle"),
  exportBtn: document.getElementById("exportBtn"),
  importBtn: document.getElementById("importBtn"),
  importFile: document.getElementById("importFile"),
  backupMsg: document.getElementById("backupMsg"),
  authGate: document.getElementById("authGate"),
  authEmail: document.getElementById("authEmail"),
  authSendBtn: document.getElementById("authSendBtn"),
  authMsg: document.getElementById("authMsg"),
  authUser: document.getElementById("authUser"),
  signOutBtn: document.getElementById("signOutBtn")
};

const state = {
  entries: [],
  section: "materias",
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
    (entry.body || "").toLowerCase().includes(q)
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
  // reflow para reiniciar la animación si el toast ya estaba visible
  toastEl.classList.remove("show");
  void toastEl.offsetWidth;
  toastEl.classList.add("show");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 1500);
}

function updateCounts() {
  els.countMaterias.textContent = entriesForSection("materias").length;
  els.countCasos.textContent = entriesForSection("casos").length;
}

function setActiveTab() {
  els.tabs.forEach((t) => {
    const sel = t.getAttribute("data-section") === state.section;
    t.setAttribute("aria-selected", sel ? "true" : "false");
  });
  els.app.setAttribute("data-active", state.section);
  els.mobileLabel.textContent = state.section === "materias" ? "Materias" : "Casos clínicos";
}

function renderList() {
  const list = entriesForSection(state.section)
    .filter((e) => matchesQuery(e, state.query))
    .sort((a, b) => (b._sortKey || 0) - (a._sortKey || 0));

  els.entryList.innerHTML = "";

  if (state.query) {
    const otherSection = state.section === "materias" ? "casos" : "materias";
    const otherCount = entriesForSection(otherSection).filter((e) => matchesQuery(e, state.query)).length;
    if (otherCount > 0) {
      const hint = document.createElement("button");
      hint.type = "button";
      hint.className = "search-hint";
      const otherLabel = otherSection === "materias" ? "Materias" : "Casos clínicos";
      hint.textContent = otherCount + " resultado" + (otherCount === 1 ? "" : "s") + " en " + otherLabel;
      hint.addEventListener("click", () => {
        state.section = otherSection;
        state.activeId = null;
        render();
      });
      els.entryList.appendChild(hint);
    }
  }

  if (list.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-list";
    empty.textContent = state.query
      ? "Sin resultados para “" + state.query + "”."
      : "Aún no hay entradas.";
    els.entryList.appendChild(empty);
    return;
  }

  list.forEach((entry) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "entry-item";
    btn.setAttribute("aria-current", entry.id === state.activeId ? "true" : "false");

    const row1 = document.createElement("div");
    row1.className = "row1";
    const title = document.createElement("span");
    title.className = "title";
    title.textContent = entry.title || "(sin título)";
    const date = document.createElement("span");
    date.className = "date";
    date.textContent = formatDate(entry.date);
    row1.appendChild(title);
    row1.appendChild(date);

    const meta = document.createElement("div");
    meta.className = "meta";
    const metaBits = [];
    if (entry.section === "casos" && entry.especie) metaBits.push(entry.especie);
    if (entry.meta) metaBits.push(entry.meta);
    meta.textContent = metaBits.join(" · ");

    btn.appendChild(row1);
    btn.appendChild(meta);

    if (entry._pending) {
      const tag = document.createElement("div");
      tag.className = "pending-tag";
      tag.textContent = "● pendiente de sincronizar";
      btn.appendChild(tag);
    }

    btn.addEventListener("click", () => {
      state.activeId = entry.id;
      render();
    });
    els.entryList.appendChild(btn);
  });
}

function renderEmptyPage() {
  const meta = SECTION_META[state.section];
  const total = state.entries.length;
  els.page.innerHTML = "";

  const wrap = document.createElement("div");
  wrap.className = "page-empty";

  const glyph = document.createElement("div");
  glyph.className = "glyph";
  glyph.textContent = meta.emptyGlyph;

  const h2 = document.createElement("h2");
  h2.textContent = state.ready ? meta.emptyTitle : "Conectando con el cuaderno…";

  const p = document.createElement("p");
  p.textContent = state.ready ? meta.emptyBody : "Un momento, esto solo pasa la primera vez.";

  wrap.appendChild(glyph);
  wrap.appendChild(h2);
  wrap.appendChild(p);

  if (state.ready) {
    const stats = document.createElement("div");
    stats.className = "stats";
    stats.innerHTML =
      '<div><span class="n">' + entriesForSection("materias").length + '</span><span class="l">Materias</span></div>' +
      '<div><span class="n">' + entriesForSection("casos").length + '</span><span class="l">Casos</span></div>' +
      '<div><span class="n">' + total + '</span><span class="l">Total</span></div>';
    wrap.appendChild(stats);
  }

  els.page.appendChild(wrap);
}

// Un timer de debounce POR CAMPO (no uno global), para que editar un campo
// nunca cancele el guardado pendiente de otro. Clave: "<entryId>:<campo>".
const saveTimers = new Map();

function scheduleSave(entryId, patch, statusEl) {
  const field = Object.keys(patch)[0] || "default";
  const key = entryId + ":" + field;

  const existing = saveTimers.get(key);
  if (existing) clearTimeout(existing);

  if (statusEl) {
    statusEl.parentElement.setAttribute("data-state", "pending");
    statusEl.textContent = "Escribiendo…";
  }

  const timer = setTimeout(async () => {
    saveTimers.delete(key);
    try {
      await updateDoc(doc(db, "entries", entryId), { ...patch, updatedAt: serverTimestamp() });
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

function buildMedsSection(entry, statusText) {
  const wrap = document.createElement("div");
  wrap.className = "meds";

  const head = document.createElement("div");
  head.className = "meds-head";
  const label = document.createElement("span");
  label.textContent = "Fármacos";
  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "meds-add";
  addBtn.textContent = "+ Agregar fármaco";
  head.appendChild(label);
  head.appendChild(addBtn);
  wrap.appendChild(head);

  const tableWrap = document.createElement("div");
  tableWrap.className = "meds-table-wrap";
  const table = document.createElement("div");
  table.className = "meds-table";
  tableWrap.appendChild(table);
  wrap.appendChild(tableWrap);

  const meds = Array.isArray(entry.farmacos) ? entry.farmacos.map((m) => ({ ...m })) : [];

  function commit() {
    scheduleSave(entry.id, { farmacos: meds }, statusText);
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
    ["Nombre", "Dosis", "Dosis administrada", "Frecuencia", ""].forEach((t) => {
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
        commit();
      });

      row.appendChild(medField("Nombre", nameInput));
      row.appendChild(medField("Dosis", doseInput));
      row.appendChild(medField("Dosis administrada", doseGivenInput));
      row.appendChild(medField("Frecuencia", freqInput));
      row.appendChild(removeBtn);
      table.appendChild(row);
    });
  }

  renderRows();

  addBtn.addEventListener("click", () => {
    meds.push({ nombre: "", dosis: "", frecuencia: "" });
    renderRows();
    commit();
    const inputs = table.querySelectorAll(".meds-row:last-child input");
    if (inputs[0]) inputs[0].focus();
  });

  return wrap;
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

function renderEditor(entry) {
  const meta = SECTION_META[entry.section];
  els.page.innerHTML = "";

  const tag = document.createElement("span");
  tag.className = "section-tag " + entry.section;
  tag.textContent = meta.label;

  const head = document.createElement("div");
  head.className = "editor-head";
  head.appendChild(tag);

  const titleInput = document.createElement("input");
  titleInput.className = "field-title";
  titleInput.placeholder = meta.titlePlaceholder;
  titleInput.value = entry.title || "";

  const fieldRow = document.createElement("div");
  fieldRow.className = "field-row";

  let speciesInput = null;
  if (entry.section === "casos") {
    const speciesGroup = document.createElement("div");
    speciesGroup.className = "field-group";
    speciesGroup.style.maxWidth = "170px";
    const speciesLabel = document.createElement("label");
    speciesLabel.textContent = "Especie";
    speciesInput = document.createElement("select");
    speciesInput.className = "field-select";
    const blankOpt = document.createElement("option");
    blankOpt.value = "";
    blankOpt.textContent = "— Sin especificar —";
    speciesInput.appendChild(blankOpt);
    SPECIES_OPTIONS.forEach((opt) => {
      const o = document.createElement("option");
      o.value = opt;
      o.textContent = opt;
      speciesInput.appendChild(o);
    });
    speciesInput.value = entry.especie || "";
    speciesGroup.appendChild(speciesLabel);
    speciesGroup.appendChild(speciesInput);
    fieldRow.appendChild(speciesGroup);
  }

  const metaGroup = document.createElement("div");
  metaGroup.className = "field-group";
  const metaLabel = document.createElement("label");
  metaLabel.textContent = meta.metaLabel;
  const metaInput = document.createElement("input");
  metaInput.placeholder = meta.metaPlaceholder;
  metaInput.value = entry.meta || "";
  metaGroup.appendChild(metaLabel);
  metaGroup.appendChild(metaInput);

  const dateGroup = document.createElement("div");
  dateGroup.className = "field-group";
  dateGroup.style.maxWidth = "170px";
  const dateLabel = document.createElement("label");
  dateLabel.textContent = "Fecha";
  const dateInput = document.createElement("input");
  dateInput.type = "date";
  dateInput.value = entry.date || todayISO();
  dateGroup.appendChild(dateLabel);
  dateGroup.appendChild(dateInput);

  fieldRow.appendChild(metaGroup);
  fieldRow.appendChild(dateGroup);

  let razaInput = null;
  let edadInput = null;
  let pesoInput = null;
  let detailsRow = null;
  if (entry.section === "casos") {
    detailsRow = document.createElement("div");
    detailsRow.className = "field-row";

    const razaGroup = document.createElement("div");
    razaGroup.className = "field-group";
    const razaLabel = document.createElement("label");
    razaLabel.textContent = "Raza";
    razaInput = document.createElement("input");
    razaInput.placeholder = "Ej. Golden Retriever";
    razaInput.value = entry.raza || "";
    razaGroup.appendChild(razaLabel);
    razaGroup.appendChild(razaInput);

    const edadGroup = document.createElement("div");
    edadGroup.className = "field-group";
    edadGroup.style.maxWidth = "140px";
    const edadLabel = document.createElement("label");
    edadLabel.textContent = "Edad";
    edadInput = document.createElement("input");
    edadInput.placeholder = "Ej. 4 años";
    edadInput.value = entry.edad || "";
    edadGroup.appendChild(edadLabel);
    edadGroup.appendChild(edadInput);

    const pesoGroup = document.createElement("div");
    pesoGroup.className = "field-group";
    pesoGroup.style.maxWidth = "140px";
    const pesoLabel = document.createElement("label");
    pesoLabel.textContent = "Peso";
    pesoInput = document.createElement("input");
    pesoInput.placeholder = "Ej. 25 kg";
    pesoInput.value = entry.peso || "";
    pesoGroup.appendChild(pesoLabel);
    pesoGroup.appendChild(pesoInput);

    detailsRow.appendChild(razaGroup);
    detailsRow.appendChild(edadGroup);
    detailsRow.appendChild(pesoGroup);
  }

  const status = document.createElement("div");
  status.className = "status";
  status.setAttribute("data-state", "ok");
  status.innerHTML = '<span class="dot"></span><span class="statusText">Sincronizado</span>';
  const statusText = status.querySelector(".statusText");

  const medsSection = entry.section === "casos" ? buildMedsSection(entry, statusText) : null;

  const divider = document.createElement("hr");
  divider.className = "divider";

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
  body.placeholder = meta.bodyPlaceholder;
  body.value = entry.body || "";
  attachVoiceInput(voiceBtn, body);

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

  els.page.appendChild(head);
  els.page.appendChild(titleInput);
  els.page.appendChild(fieldRow);
  if (detailsRow) els.page.appendChild(detailsRow);
  if (medsSection) els.page.appendChild(medsSection);
  els.page.appendChild(divider);
  els.page.appendChild(bodyToolbar);
  els.page.appendChild(body);
  els.page.appendChild(foot);

  titleInput.addEventListener("input", () => scheduleSave(entry.id, { title: titleInput.value }, statusText));
  metaInput.addEventListener("input", () => scheduleSave(entry.id, { meta: metaInput.value }, statusText));
  dateInput.addEventListener("input", () => scheduleSave(entry.id, { date: dateInput.value }, statusText));
  body.addEventListener("input", () => scheduleSave(entry.id, { body: body.value }, statusText));
  if (speciesInput) speciesInput.addEventListener("change", () => scheduleSave(entry.id, { especie: speciesInput.value }, statusText));
  if (razaInput) razaInput.addEventListener("input", () => scheduleSave(entry.id, { raza: razaInput.value }, statusText));
  if (edadInput) edadInput.addEventListener("input", () => scheduleSave(entry.id, { edad: edadInput.value }, statusText));
  if (pesoInput) pesoInput.addEventListener("input", () => scheduleSave(entry.id, { peso: pesoInput.value }, statusText));

  if (!entry.title) {
    setTimeout(() => titleInput.focus(), 0);
  }
}

function render() {
  setActiveTab();
  updateCounts();
  renderList();
  const active = state.entries.find((e) => e.id === state.activeId);
  if (active) {
    renderEditor(active);
  } else {
    renderEmptyPage();
  }
}

els.tabs.forEach((t) => {
  t.addEventListener("click", () => {
    state.section = t.getAttribute("data-section");
    state.activeId = null;
    render();
  });
});

els.search.addEventListener("input", () => {
  state.query = els.search.value;
  renderList();
});

els.newEntry.addEventListener("click", async () => {
  try {
    const ref = await addDoc(collection(db, "entries"), {
      uid: currentUid,
      section: state.section,
      title: "",
      meta: "",
      date: todayISO(),
      body: "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    state.activeId = ref.id;
    render();
    if (window.innerWidth <= 760) {
      els.sidebar.classList.add("collapsed");
    }
  } catch (err) {
    alert("No se pudo crear la entrada. Revisa tu conexión e intenta de nuevo.");
  }
});

els.toggleSidebar.addEventListener("click", () => {
  els.sidebar.classList.toggle("collapsed");
});

if (window.innerWidth <= 760) {
  els.sidebar.classList.add("collapsed");
}

/* ---------- Tema claro / oscuro ---------- */

const THEME_KEY = "vetcuaderno.theme.v1";

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  els.themeToggle.textContent = theme === "dark" ? "☀️" : "🌙";
  els.themeToggle.setAttribute("aria-label", theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro");
}

let currentTheme = localStorage.getItem(THEME_KEY) || "light";
applyTheme(currentTheme);

els.themeToggle.addEventListener("click", () => {
  currentTheme = currentTheme === "dark" ? "light" : "dark";
  localStorage.setItem(THEME_KEY, currentTheme);
  applyTheme(currentTheme);
});

/* ---------- Backup: export / import (respaldo manual, además del sync automático) ---------- */

function showBackupMsg(text, isError) {
  els.backupMsg.textContent = text;
  els.backupMsg.classList.toggle("error", !!isError);
}

els.exportBtn.addEventListener("click", () => {
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

els.importBtn.addEventListener("click", () => {
  els.importFile.value = "";
  els.importFile.click();
});

els.importFile.addEventListener("change", () => {
  const file = els.importFile.files && els.importFile.files[0];
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

    // Evita duplicar: por id (re-importar el mismo export) o por
    // section+título+fecha (migrar desde la versión vieja). El set se
    // actualiza también con lo que se agrega EN ESTA misma importación,
    // por si el propio archivo trae filas repetidas.
    const dupKey = (e) => (e.section || "") + "␟" + (e.title || "") + "␟" + (e.date || "");
    const seenIds = new Set(state.entries.map((e) => e.id).filter(Boolean));
    const seenKeys = new Set(state.entries.map(dupKey));

    let ok = 0;
    let skipped = 0;
    for (const inc of incoming) {
      if (!inc || !inc.section || !SECTION_META[inc.section]) continue;
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
    showBackupMsg(
      "Se importaron " + ok + " de " + incoming.length + " entrada(s)." +
      (skipped ? " " + skipped + " omitida(s) por ya existir." : "")
    );
  };
  reader.onerror = () => showBackupMsg("No se pudo leer el archivo.", true);
  reader.readAsText(file);
});

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

/* ---------- Firestore: sincronización en tiempo real (solo tus entradas) ---------- */

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
  } else {
    currentUid = null;
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
    state.entries = [];
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

// Formato portable: conserva fechas de Firestore y relaciones entre adjuntos.
export const COLECCIONES_RESPALDO = ['entries', 'formulario', 'fotos'];
const OMITIR = new Set(['id', '_pending', '_sortKey']);

export function codificar(valor) {
  if (valor == null || typeof valor !== 'object') return valor;
  if (typeof valor.toDate === 'function' && Number.isInteger(valor.seconds)) {
    return { __vetTimestamp: true, seconds: valor.seconds, nanoseconds: valor.nanoseconds || 0 };
  }
  if (valor instanceof Date) return { __vetTimestamp: true, seconds: Math.floor(valor.getTime() / 1000), nanoseconds: (valor.getTime() % 1000) * 1000000 };
  if (Array.isArray(valor)) return valor.map(codificar);
  return Object.fromEntries(Object.entries(valor).filter(([, v]) => v !== undefined).map(([k, v]) => [k, codificar(v)]));
}

export function decodificar(valor, timestamp) {
  if (valor == null || typeof valor !== 'object') return valor;
  if (valor.__vetTimestamp === true || (Number.isInteger(valor.seconds) && Number.isInteger(valor.nanoseconds) && Object.keys(valor).every(k => ['seconds', 'nanoseconds'].includes(k)))) {
    if (!Number.isInteger(valor.seconds) || !Number.isInteger(valor.nanoseconds) || valor.nanoseconds < 0 || valor.nanoseconds >= 1e9) throw new Error('Fecha inválida en el respaldo.');
    return timestamp(valor.seconds, valor.nanoseconds);
  }
  if (Array.isArray(valor)) return valor.map(v => decodificar(v, timestamp));
  return Object.fromEntries(Object.entries(valor).map(([k, v]) => [k, decodificar(v, timestamp)]));
}

export function crearRespaldo(colecciones, uid) {
  return codificar({ formato: 'VetDiario', version: 2, sourceUid: uid, exportedAt: new Date().toISOString(), ...colecciones });
}

export function leerRespaldo(texto) {
  let raw;
  try { raw = JSON.parse(texto); } catch { throw new Error('El archivo no contiene un respaldo JSON válido.'); }
  if (Array.isArray(raw)) raw = { entries: raw };
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.entries)) throw new Error('No se reconocen las entradas del respaldo.');
  if (raw.version != null && (raw.formato !== 'VetDiario' || raw.version !== 2)) throw new Error('Esta versión de respaldo no es compatible.');
  const result = { sourceUid: typeof raw.sourceUid === 'string' ? raw.sourceUid : '', legacy: raw.version !== 2 };
  for (const nombre of COLECCIONES_RESPALDO) {
    const filas = raw[nombre] ?? [];
    if (!Array.isArray(filas)) throw new Error('Colección inválida: ' + nombre);
    const ids = new Set();
    result[nombre] = filas.map((fila, i) => {
      if (!fila || typeof fila !== 'object' || Array.isArray(fila)) throw new Error('Registro inválido en ' + nombre);
      const id = fila.id || (result.legacy ? 'legacy-' + i : '');
      if (typeof id !== 'string' || !id || id.includes('/') || id.length > 1000 || id === '.' || id === '..' || /^__.*__$/.test(id) || ids.has(id)) throw new Error('Identificador inválido o repetido en ' + nombre);
      ids.add(id);
      if (nombre === 'entries' && !['casos', 'materias', 'profile'].includes(fila.section)) throw new Error('Tipo de entrada no reconocido: ' + fila.section);
      return { ...fila, id };
    });
  }
  const entries = new Set(result.entries.map(e => e.id));
  const examenes = new Set(result.fotos.filter(f => f.clase === 'examen').map(f => f.id));
  for (const foto of result.fotos) {
    if (!entries.has(foto.entryId)) throw new Error('Hay un adjunto sin su caso o apunte: ' + foto.id);
    if (foto.clase === 'pagina' && !examenes.has(foto.examenId)) throw new Error('Hay una página sin su examen: ' + foto.id);
    if (foto.clase === 'pagina' && result.fotos.find(f => f.id === foto.examenId).entryId !== foto.entryId) throw new Error('La página y su examen pertenecen a entradas distintas.');
  }
  return result;
}

async function huella(texto) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return Array.from(new Uint8Array(bytes)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function planificarRestauracion(respaldo, uid) {
  if (!uid) throw new Error('Inicia sesión antes de restaurar.');
  const mapas = Object.fromEntries(COLECCIONES_RESPALDO.map(c => [c, new Map()]));
  for (const nombre of COLECCIONES_RESPALDO) {
    for (const fila of respaldo[nombre]) {
      const origen = fila.uid || respaldo.sourceUid;
      const id = nombre === 'entries' && fila.section === 'profile' ? 'profile_' + uid
        : origen === uid ? fila.id
        : uid + '__r_' + (await huella(nombre + '|' + (origen || JSON.stringify(fila)) + '|' + fila.id)).slice(0, 40);
      mapas[nombre].set(fila.id, id);
    }
  }
  const plan = [];
  for (const nombre of COLECCIONES_RESPALDO) {
    for (const fila of respaldo[nombre]) {
      const data = Object.fromEntries(Object.entries(fila).filter(([k]) => !OMITIR.has(k)));
      data.uid = uid;
      if (nombre === 'fotos') {
        data.entryId = mapas.entries.get(fila.entryId);
        data.uidEntrada = uid + '__' + data.entryId;
        if (fila.examenId) data.examenId = mapas.fotos.get(fila.examenId);
      }
      if (nombre === 'entries') {
        for (const key of Object.keys(data)) {
          if (/html$/i.test(key) && typeof data[key] === 'string') {
            data[key] = data[key].replace(/(data-foto\s*=\s*)(["'])(.*?)\2/gi, (_, pref, quote, id) => pref + quote + (mapas.fotos.get(id) || id) + quote);
          }
        }
      }
      plan.push({ collection: nombre, id: mapas[nombre].get(fila.id), data });
    }
  }
  return plan;
}

export function valorFirestore(value) {
  if (value == null) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Número no válido en el respaldo.');
    return Number.isSafeInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (typeof value.toDate === 'function') {
    const iso = new Date(value.seconds * 1000).toISOString().replace(/\.\d{3}Z$/, '.' + String(value.nanoseconds || 0).padStart(9, '0') + 'Z');
    return { timestampValue: iso };
  }
  if (Array.isArray(value)) return { arrayValue: { values: value.map(valorFirestore) } };
  if (typeof value === 'object') return { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([k,v]) => [k,valorFirestore(v)])) } };
  throw new Error('Tipo de dato no compatible con el respaldo.');
}

// createDocument es atómico: si el ID existe, devuelve ALREADY_EXISTS.
// Usa las reglas y la sesión del usuario, sin permisos de administrador.
export async function crearSinReemplazar({ projectId, uid, item, user, fetcher = fetch }) {
  if (!user || user.uid !== uid) throw new Error('La sesión cambió.');
  if (!COLECCIONES_RESPALDO.includes(item.collection)) throw new Error('Colección no permitida.');
  const fields = valorFirestore(item.data).mapValue.fields;
  const token = await user.getIdToken();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const base = 'https://firestore.googleapis.com/v1/projects/' + encodeURIComponent(projectId) + '/databases/(default)/documents/';
    const response = await fetcher(base + item.collection + '?documentId=' + encodeURIComponent(item.id), {
      method:'POST', headers:{ Authorization: 'Bearer ' + token, 'Content-Type':'application/json' },
      body:JSON.stringify({fields}), signal:controller.signal
    });
    if (response.ok) return true;
    const error = await response.json().catch(() => ({}));
    if (response.status === 409 && error.error?.status === 'ALREADY_EXISTS') return false;
    throw new Error(response.status === 403 ? 'No hay permiso para restaurar este registro.' : 'No se pudo confirmar el registro (' + response.status + ').');
  } finally { clearTimeout(timer); }
}

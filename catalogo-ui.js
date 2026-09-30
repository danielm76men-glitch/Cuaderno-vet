import { principiosDe, resumenComposicion, termino } from './catalogo.js';

function el(tag, clase, texto) {
  const n = document.createElement(tag);
  if (clase) n.className = clase;
  if (texto != null) n.textContent = texto;
  return n;
}
function boton(texto, fn, clase = 'btn-secondary') {
  const b = el('button', clase, texto); b.type = 'button'; b.addEventListener('click', fn); return b;
}
function campo(titulo, control) {
  const label = el('label', 'field-group'); label.append(el('span', 'meds-field-label', titulo), control); return label;
}

export function renderCatalogoComercial(root, api) {
  const card = el('section', 'card card-pad');
  const cab = el('div', 'card-head');
  cab.append(el('h2', '', 'Catálogo comercial'), boton('+ Agregar producto', () => api.crear(), 'btn-primary'));
  card.append(cab, el('p', 'quiet-copy', 'Marcas, laboratorios, composición y envases. Cada producto está vinculado a una ficha del Vademécum.'));
  const buscar = el('input', 'catalog-search'); buscar.type = 'search'; buscar.placeholder = 'Buscar marca, laboratorio o principio activo…'; buscar.setAttribute('aria-label', buscar.placeholder);
  buscar.value = api.query || '';
  const verArchivados = el('input'); verArchivados.type = 'checkbox';
  const filtroArchivo = el('label', 'form-check'); filtroArchivo.append(verArchivados, document.createTextNode(' Mostrar productos archivados'));
  const lista = el('div', 'catalogo-productos');
  function pintar() {
    lista.replaceChildren();
    const q = termino(buscar.value);
    const productos = (verArchivados.checked ? api.archivados : api.productos).filter(p => {
      const f = api.farmacos.find(f => f.id === p.farmacoId);
      return termino([p.nombreComercial, p.laboratorio, p.forma, p.envase, f?.nombreGenerico, resumenComposicion(p)].join(' ')).includes(q);
    });
    if (!productos.length) lista.append(el('p', 'form-vacio', 'No hay productos que mostrar. Agrega uno y vincúlalo a su fármaco o combinación.'));
    productos.forEach(p => {
      const f = api.farmacos.find(f => f.id === p.farmacoId);
      const item = el('article', 'form-fila-bloque catalogo-producto');
      item.append(boton(p.nombreComercial || 'Producto sin nombre comercial', () => api.abrirProducto(p.id), 'catalogo-producto-nombre'));
      item.append(el('p', 'quiet-copy', [p.laboratorio, p.forma, p.envase].filter(Boolean).join(' · ') || 'Laboratorio y envase por completar'));
      item.append(el('p', 'catalogo-composicion', resumenComposicion(p)));
      const acciones = el('div', 'quick-actions');
      if (p.archivado) acciones.append(boton('Restaurar producto', () => { api.guardar({ ...p, archivado: false }); api.volver(); }));
      else if (f) acciones.append(boton('Vademécum: ' + f.nombreGenerico, () => api.abrirFarmaco(f.id)), boton('Calcular dosis', () => api.calcular(p)));
      else acciones.append(el('span', 'form-aviso-error', 'Vincula este producto a una ficha del Vademécum.'));
      item.append(acciones); lista.append(item);
    });
  }
  buscar.addEventListener('input', () => { api.cambiarQuery(buscar.value); pintar(); });
  verArchivados.addEventListener('change', pintar);
  card.append(buscar, filtroArchivo, lista); root.append(card); pintar();
}

export function renderProductoComercial(root, original, api) {
  const p = { ...original, composicion: (original.composicion || []).map(c => ({ ...c })) };
  root.append(boton('← Catálogo comercial', api.volver));
  const status = el('div', 'status'); status.dataset.state = 'ok';
  status.append(el('span', 'dot'), el('span', 'statusText', 'Sincronizado'));
  const statusText = status.querySelector('.statusText');
  function guardar() { api.guardar(p, statusText); }
  const title = el('input', 'field-title field-title-farmaco');
  title.value = p.nombreComercial || ''; title.placeholder = 'Nombre comercial del producto'; title.setAttribute('aria-label', 'Nombre comercial');
  title.addEventListener('input', () => { p.nombreComercial = title.value; guardar(); });
  root.append(el('p', 'section-tag', 'Producto comercial'), title);
  const identidad = el('section', 'card card-pad');
  const datos = el('div', 'field-row');
  for (const [key, label, hint] of [['laboratorio', 'Laboratorio / empresa', 'Empresa fabricante'], ['forma', 'Forma farmacéutica', 'Tableta, suspensión, solución…'], ['envase', 'Envase', 'Caja de 10 tabletas, frasco de 100 mL…']]) {
    const input = el('input'); input.value = p[key] || ''; input.placeholder = hint;
    input.addEventListener('input', () => { p[key] = input.value; guardar(); }); datos.append(campo(label, input));
  }
  identidad.append(datos);
  const selector = el('select');
  const vacio = el('option', '', 'Selecciona un fármaco o combinación…'); vacio.value = ''; selector.append(vacio);
  api.farmacos.slice().sort((a, b) => a.nombreGenerico.localeCompare(b.nombreGenerico)).forEach(f => {
    const opt = el('option', '', f.nombreGenerico || 'Ficha sin nombre'); opt.value = f.id; selector.append(opt);
  });
  selector.value = p.farmacoId || '';
  identidad.append(campo('Ficha del Vademécum', selector));
  const enlaces = el('div', 'quick-actions');
  function pintarEnlaces() {
    enlaces.replaceChildren();
    const f = api.farmacos.find(f => f.id === p.farmacoId);
    if (f) {
      enlaces.append(boton('Consultar dosis en el Vademécum', () => api.abrirFarmaco(f.id)));
      if (!p.archivado) enlaces.append(boton('Calcular con este producto', () => api.calcular(p), 'btn-primary'));
    }
    else enlaces.append(el('p', 'form-aviso-error', 'Selecciona una ficha para usar este producto en la calculadora.'));
  }
  identidad.append(enlaces); root.append(identidad);
  const pres = el('section', 'card card-pad pres-bloque');
  pres.append(el('h2', 'pres-bloque-titulo', 'Presentación y composición'));
  const foto = el('div', 'pres-galeria');
  foto.append(api.fotos(p, statusText)); pres.append(foto);
  const composicion = el('div', 'catalogo-composicion-editor');
  composicion.append(el('p', 'quiet-copy', 'Escribe cuánto contiene de cada principio activo por mL, tableta u otra unidad del producto.'));
  if (p.concentracionAnterior != null) composicion.append(el('p', 'form-vacio', 'Dato anterior: ' + p.concentracionAnterior + ' ' + (p.unidadAnterior || '') + '. Comprueba el desglose con la etiqueta.'));
  const filas = el('div');
  const listaNombres = el('datalist'); listaNombres.id = 'principios-producto';
  function pintarComponentes() {
    filas.replaceChildren(); listaNombres.replaceChildren();
    const f = api.farmacos.find(f => f.id === p.farmacoId);
    const nombres = new Set([...(f ? principiosDe(f) : []), ...api.farmacos.flatMap(principiosDe)]);
    nombres.forEach(n => { const opt = el('option'); opt.value = n; listaNombres.append(opt); });
    if (!p.composicion.length) filas.append(el('p', 'form-aviso-error', 'Completa los componentes para habilitar la conversión en la calculadora.'));
    p.composicion.forEach((c, i) => {
      const fila = el('div', 'field-row catalogo-componente');
      const nombre = el('input'); nombre.value = c.nombre || ''; nombre.setAttribute('list', listaNombres.id); nombre.placeholder = 'Principio activo';
      nombre.addEventListener('input', () => { c.nombre = nombre.value; guardar(); });
      const cantidad = el('input'); cantidad.type = 'number'; cantidad.step = 'any'; cantidad.min = '0'; cantidad.value = c.concentracion ?? ''; cantidad.placeholder = 'Cantidad';
      cantidad.addEventListener('input', () => { c.concentracion = cantidad.value === '' ? null : Number(cantidad.value); guardar(); });
      const unidad = el('input'); unidad.value = c.unidadConc || 'mg/mL'; unidad.placeholder = 'mg/mL, mg/tableta, UI/mL';
      unidad.addEventListener('input', () => { c.unidadConc = unidad.value; guardar(); });
      fila.append(campo('Principio activo', nombre), campo('Concentración', cantidad), campo('Unidad', unidad), boton('Quitar', () => { p.composicion.splice(i, 1); guardar(); pintarComponentes(); })); filas.append(fila);
    });
  }
  composicion.append(filas, listaNombres, boton('+ Agregar componente', () => { p.composicion.push({ nombre: '', concentracion: null, unidadConc: p.composicion[0]?.unidadConc || 'mg/mL' }); guardar(); pintarComponentes(); }));
  composicion.append(api.vias(p.via, vias => { p.via = vias; guardar(); }));
  pres.append(composicion); root.append(pres);
  selector.addEventListener('change', () => {
    p.farmacoId = selector.value;
    const f = api.farmacos.find(f => f.id === p.farmacoId);
    if (f && !p.composicion.length) p.composicion = principiosDe(f).map(nombre => ({ nombre, concentracion: null, unidadConc: p.unidadAnterior || 'mg/mL' }));
    guardar(); pintarComponentes(); pintarEnlaces();
  });
  pintarEnlaces(); pintarComponentes();
  const foot = el('div', 'editor-foot');
  foot.append(status, boton(p.archivado ? 'Restaurar producto' : 'Archivar producto', async () => {
    if (p.archivado || await api.confirmarArchivo()) { p.archivado = !p.archivado; guardar(); api.volver(); }
  }, 'btn-delete'));
  root.append(foot);
}

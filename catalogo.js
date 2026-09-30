// Modelo compartido por el catálogo y la calculadora. No contiene dosis clínicas.
export const termino = (v) => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');

export function esCombinacion(f) {
  return f.esCombinacion === true || (f.esCombinacion == null && String(f.nombreGenerico || f.nombre || '').includes('+'));
}

export function principiosDe(f) {
  if (Array.isArray(f.principiosActivos) && f.principiosActivos.length) return f.principiosActivos;
  const nombre = f.nombreGenerico || f.nombre || '';
  return (esCombinacion(f) ? nombre.split('+') : [nombre]).map(n => n.trim()).filter(Boolean);
}

export function productosDelCatalogo(farmacos, guardados) {
  const productos = new Map();
  // Adaptación sin borrar los datos originales: al editar se guarda un producto
  // independiente. La clave de origen evita duplicados incluso tras restaurar.
  const clave = (p) => p.origenFarmacoId ? p.origenFarmacoId + '/' + p.origenPresentacionId : p.id;
  for (const f of farmacos) {
    for (const [i, p] of (f.presentaciones || []).entries()) {
      const origenPresentacionId = p.id || 'pos_' + i;
      const item = {
        id: 'producto_' + f.id + '_' + origenPresentacionId,
        tipoRegistro: 'productoComercial', farmacoId: f.id,
        origenFarmacoId: f.id, origenPresentacionId,
        nombreComercial: p.nombreComercialLocal || '', laboratorio: '', forma: '', envase: '',
        via: Array.isArray(p.via) ? p.via : String(p.via || '').split(/[,/]/).map(v => v.trim()).filter(Boolean),
        composicion: esCombinacion(f) ? [] : [{ nombre: principiosDe(f)[0] || '', concentracion: p.concentracion ?? null, unidadConc: p.unidadConc || 'mg/mL' }],
        concentracionAnterior: p.concentracion ?? null, unidadAnterior: p.unidadConc || '',
        _virtual: true
      };
      productos.set(clave(item), item);
    }
  }
  for (const p of guardados) productos.set(clave(p), p);
  return [...productos.values()].filter(p => !p.archivado);
}

export function resumenComposicion(p) {
  return (p.composicion || []).map(c => c.nombre + ': ' + (c.concentracion ?? '—') + ' ' + (c.unidadConc || '')).join(' + ')
    || (p.concentracionAnterior != null ? p.concentracionAnterior + ' ' + (p.unidadAnterior || '') + ' · composición por completar' : 'Composición por completar');
}

export function concentracionParaPauta(producto, pauta, farmaco) {
  const error = (texto) => ({ error: texto });
  if (!producto || producto.farmacoId !== farmaco.id || producto.archivado) return error('El producto debe estar vinculado a esta ficha del Vademécum.');
  const componentes = producto.composicion || [];
  if (!componentes.length) return error('Completa la composición del producto en el Catálogo.');
  const combinacion = esCombinacion(farmaco);
  if (combinacion && principiosDe(farmaco).length < 2) return error('Completa los principios activos de la combinación en el Vademécum.');
  if (!combinacion && componentes.length !== 1) return error('Este producto combinado necesita su propia ficha de combinación en el Vademécum.');
  const nombres = componentes.map(c => termino(c.nombre));
  if (nombres.some(n => !n) || new Set(nombres).size !== nombres.length) return error('Revisa los nombres de los componentes: están vacíos o repetidos.');
  const esperados = principiosDe(farmaco).map(termino);
  if (esperados.length !== nombres.length || esperados.some(n => !nombres.includes(n))) return error('La composición del producto no coincide con los principios activos de esta ficha.');
  if (componentes.some(c => !Number.isFinite(Number(c.concentracion)) || Number(c.concentracion) <= 0)) return error('Cada componente necesita una concentración mayor que cero.');
  if (combinacion && !pauta.baseDosis) return error('Indica en la pauta si la dosis se refiere al total o a un componente de la combinación.');
  const base = pauta.baseDosis || ('componente:' + nombres[0]);
  let usados;
  if (base === 'total') usados = componentes;
  else if (base.startsWith('componente:')) usados = componentes.filter(c => termino(c.nombre) === base.slice(11));
  else return error('Revisa la base de la dosis en el Vademécum.');
  if (!usados.length) return error('El componente de la pauta no está en este producto.');
  const unidades = usados.map(c => termino(c.unidadConc).replace(/\s/g, '').split('/'));
  const masa = termino(String(pauta.unidad || 'mg/kg').split('/')[0]);
  if (unidades.some(u => u.length !== 2 || !u[1] || u[0] !== masa || u[1] !== unidades[0][1])) return error('Las unidades de la composición y la pauta no coinciden; no se convierten automáticamente.');
  const vias = (v) => (Array.isArray(v) ? v : [v]).map(termino);
  if (!vias(pauta.via).some(v => v && vias(producto.via).includes(v))) return error('La vía del producto no coincide con la pauta.');
  const concentracion = usados.reduce((s, c) => s + Number(c.concentracion), 0);
  if (!Number.isFinite(concentracion) || concentracion <= 0) return error('La concentración calculada no es válida. Revisa los valores.');
  return {
    concentracion,
    unidadConc: usados[0].unidadConc,
    base: base === 'total' ? 'Total de la combinación' : usados[0].nombre
  };
}

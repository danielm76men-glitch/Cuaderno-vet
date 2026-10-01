import { PRODUCTOS_FARCOVET } from './farcovet-datos.js';
import { principiosDe, termino } from './catalogo.js';

// La biblioteca se distribuye con el cuaderno. Las ediciones personales prevalecen.
// Solo se enlazan composiciones completas por nombre, sin adivinar principios activos.
export function incluirFarcovet(farmacos, guardados) {
  const clave = nombres => nombres.map(termino).sort().join('|');
  const existentes = new Map(guardados.map(p => [p.origenCatalogoId || p.id, p]));
  const incluidos = PRODUCTOS_FARCOVET.map(base => {
    const guardado = existentes.get(base.id);
    if (guardado) { existentes.delete(base.id); return guardado; }
    const nombres = base.composicion.map(c => c.nombre);
    const candidatas = nombres.length ? farmacos.filter(f => clave(principiosDe(f)) === clave(nombres)) : [];
    return { ...base, origenCatalogoId: base.id, farmacoId: candidatas.length === 1 ? candidatas[0].id : '', _biblioteca: true };
  });
  return incluidos.concat([...existentes.values()]).map(recursosPublicados);
}

export { PRODUCTOS_FARCOVET };

// Adaptación a la ubicación comprobada en danielm76men-glitch/Cuaderno-vet.
// Los 269 recursos Farcovet están publicados en la raíz del repositorio.
// Se corrigen las rutas al leer, incluidos los productos personales ya guardados.
// No se modifica la composición, los vínculos ni los documentos de Firebase.
function recursosPublicados(p) {
  const ruta = v => typeof v === 'string' && v.startsWith('assets/farcovet-2026/')
    ? './' + v.slice('assets/farcovet-2026/'.length) : v;
  if (!p.fuenteCatalogo) return p;
  return { ...p,
    fotoCatalogo: ruta(p.fotoCatalogo),
    fuenteCatalogo: { ...p.fuenteCatalogo, archivo: ruta(p.fuenteCatalogo.archivo) },
    fichasCatalogo: (p.fichasCatalogo || []).map(f => ({ ...f, foto: ruta(f.foto), ficha: ruta(f.ficha) }))
  };
}

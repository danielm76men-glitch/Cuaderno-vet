import test from 'node:test';
import assert from 'node:assert/strict';
import { productosDelCatalogo, concentracionParaPauta, principiosDe } from '../catalogo.js';
import { crearRespaldo, leerRespaldo, planificarRestauracion } from '../respaldo.js';

// Datos sintéticos: comprueban unidades y relaciones, no son pautas clínicas.
const ficha = { id: 'f1', nombreGenerico: 'Activo A + Activo B', esCombinacion: true, principiosActivos: ['Activo A', 'Activo B'] };
const producto = { id: 'p1', tipoRegistro: 'productoComercial', farmacoId: 'f1', via: ['VO'], composicion: [
  { nombre: 'Activo A', concentracion: 80, unidadConc: 'mg/tableta' },
  { nombre: 'Activo B', concentracion: 20, unidadConc: 'mg/tableta' }
] };
const pauta = { unidad: 'mg/kg', via: ['VO'], baseDosis: 'total' };

test('la dosis total y la dosis por componente usan concentraciones diferentes', () => {
  assert.equal(concentracionParaPauta(producto, pauta, ficha).concentracion, 100);
  const c = concentracionParaPauta(producto, { ...pauta, baseDosis: 'componente:activo a' }, ficha);
  assert.equal(c.concentracion, 80);
  assert.equal(200 / c.concentracion, 2.5);
});
test('una combinación sin base de dosis no genera una conversión', () => {
  assert.match(concentracionParaPauta(producto, { ...pauta, baseDosis: '' }, ficha).error, /total o a un componente/);
});
test('no se mezclan pautas de fichas diferentes ni vías incompatibles', () => {
  assert.ok(concentracionParaPauta({ ...producto, farmacoId: 'otra' }, pauta, ficha).error);
  assert.ok(concentracionParaPauta(producto, { ...pauta, via: ['IV'] }, ficha).error);
});
test('no se suman unidades distintas ni se aceptan concentraciones vacías, nulas o negativas', () => {
  for (const valor of ['', null, 0, -1, 'texto', Infinity]) {
    const p = structuredClone(producto); p.composicion[0].concentracion = valor;
    assert.ok(concentracionParaPauta(p, pauta, ficha).error);
  }
  const p = structuredClone(producto); p.composicion[1].unidadConc = 'UI/tableta';
  assert.ok(concentracionParaPauta(p, pauta, ficha).error);
  p.composicion[1].unidadConc = 'mg/mL'; assert.ok(concentracionParaPauta(p, pauta, ficha).error);
});
test('una ficha simple no acepta un producto combinado; detecta componentes ausentes o repetidos', () => {
  assert.ok(concentracionParaPauta(producto, pauta, { ...ficha, esCombinacion: false }).error);
  const p = structuredClone(producto); p.composicion[1].nombre = 'Activo A';
  assert.ok(concentracionParaPauta(p, pauta, ficha).error);
  p.composicion[1].nombre = 'Activo C'; assert.ok(concentracionParaPauta(p, pauta, ficha).error);
});
test('un producto simple conserva la conversión habitual', () => {
  const f = { id: 'simple', nombreGenerico: 'Activo A' };
  const p = { farmacoId: f.id, via: ['IM'], composicion: [{ nombre: 'Activo A', concentracion: 50, unidadConc: 'mg/mL' }] };
  const c = concentracionParaPauta(p, { unidad: 'mg/kg', via: ['IM'] }, f);
  assert.equal(c.concentracion, 50); assert.equal(100 / c.concentracion, 2);
});
test('las presentaciones existentes aparecen una vez y sus ediciones independientes prevalecen', () => {
  const f = { ...ficha, presentaciones: [{ id: 'pres1', concentracion: 100, unidadConc: 'mg/tableta', nombreComercialLocal: 'Marca' }] };
  const [viejo] = productosDelCatalogo([f], []);
  assert.equal(viejo.nombreComercial, 'Marca'); assert.equal(viejo.composicion.length, 0);
  const nuevo = { ...viejo, id: 'persistido', nombreComercial: 'Marca editada', _virtual: false };
  assert.deepEqual(productosDelCatalogo([f], [nuevo]), [nuevo]);
  assert.equal(productosDelCatalogo([f], [{ ...nuevo, archivado: true }]).length, 0);
  assert.deepEqual(principiosDe({ nombreGenerico: 'A + B' }), ['A', 'B']);
});
test('restaurar en otra cuenta conserva producto, ficha, fotos y evita duplicar presentaciones antiguas', async () => {
  const f = { ...ficha, uid: 'antes', presentaciones: [{ id: 'pres1', concentracion: 100, unidadConc: 'mg/tableta' }] };
  const p = { ...producto, uid: 'antes', origenFarmacoId: f.id, origenPresentacionId: 'pres1' };
  const foto = { id: 'foto1', uid: 'antes', entryId: f.id, uidEntrada: 'antes__' + f.id, productoId: p.id, presentacionId: 'pres1' };
  const copia = leerRespaldo(JSON.stringify(crearRespaldo({ entries: [], formulario: [f, p], fotos: [foto] }, 'antes')));
  const plan = await planificarRestauracion(copia, 'despues');
  const ff = plan.find(x => x.data.nombreGenerico), pp = plan.find(x => x.data.tipoRegistro), fotoNueva = plan.find(x => x.collection === 'fotos');
  assert.equal(pp.data.farmacoId, ff.id); assert.equal(pp.data.origenFarmacoId, ff.id);
  assert.equal(fotoNueva.data.entryId, ff.id); assert.equal(fotoNueva.data.productoId, pp.id);
  assert.equal(fotoNueva.data.uidEntrada, 'despues__' + ff.id);
  assert.equal(productosDelCatalogo([{ id: ff.id, ...ff.data }], [{ id: pp.id, ...pp.data }]).length, 1);
});
test('un respaldo acepta fotos propias de productos nuevos y fotos antiguas de productos archivados', async () => {
  const p = { ...producto, uid: 'antes', archivado: true, origenFarmacoId: 'ficha-eliminada' };
  const copia = leerRespaldo(JSON.stringify(crearRespaldo({ entries: [], formulario: [p], fotos: [
    { id: 'a', uid: 'antes', entryId: p.id, productoId: p.id },
    { id: 'b', uid: 'antes', entryId: 'ficha-eliminada', productoId: p.id }
  ] }, 'antes')));
  const plan = await planificarRestauracion(copia, 'despues');
  const nuevo = plan.find(x => x.data.tipoRegistro);
  assert.equal(plan.find(x => x.collection === 'fotos' && x.data.entryId === nuevo.id).data.productoId, nuevo.id);
  assert.ok(plan.some(x => x.collection === 'fotos' && x.data.entryId === nuevo.data.origenFarmacoId));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { incluirFarcovet, PRODUCTOS_FARCOVET } from '../farcovet-catalogo.js';
import { productosDelCatalogo, concentracionParaPauta } from '../catalogo.js';

test('todas las presentaciones Farcovet tienen fotos y fuente local accesible', () => {
  assert.equal(PRODUCTOS_FARCOVET.length, 107);
  assert.equal(new Set(PRODUCTOS_FARCOVET.map(p => p.id)).size, 107);
  for (const p of PRODUCTOS_FARCOVET) {
    assert.ok(p.envase); assert.ok(p.formulaCatalogo);
    for (const file of [p.fotoCatalogo,p.fuenteCatalogo.archivo,...p.fichasCatalogo.flatMap(f => [f.foto,f.ficha])]) {
      assert.ok(existsSync(new URL('../'+file, import.meta.url)), file);
    }
    assert.ok(p.fichasCatalogo.every(f => f.texto.length > 60));
  }
});

test('las concentraciones alternativas son productos separados', () => {
  const porNombre = name => PRODUCTOS_FARCOVET.find(p => p.nombreComercial === name);
  assert.equal(porNombre('KETONAL 50').composicion[0].concentracion,50);
  assert.equal(porNombre('KETONAL 100').composicion[0].concentracion,100);
  assert.equal(porNombre('METFORMINA GATOS 20 mg').composicion[0].concentracion,20);
  assert.equal(porNombre('METFORMINA PERROS 400 mg').composicion[0].concentracion,400);
  assert.deepEqual(porNombre('SPECTRYL 10').composicion.map(c => c.concentracion),[100,250]);
  assert.deepEqual(porNombre('SPECTRYL 20').composicion.map(c => c.concentracion),[200,500]);
});

test('se enlaza por composición completa, sin asociar productos combinados a activos aislados', () => {
  const f=[{id:'ket',nombreGenerico:'Ketamina'}, {id:'mel',nombreGenerico:'Meloxicam'}];
  const p=incluirFarcovet(f,[]);
  assert.equal(p.find(p => p.nombreComercial==='KETONAL 50').farmacoId,'ket');
  assert.equal(p.find(p => p.nombreComercial==='OXICAM B12').farmacoId,'');
  assert.equal(p.find(p => p.nombreComercial==='DETOR').farmacoId,'');
});

test('las ediciones, el archivo y los IDs restaurados prevalecen sin duplicar la biblioteca', () => {
  const base=PRODUCTOS_FARCOVET[0];
  const editado={...base,id:'restaurado',origenCatalogoId:base.id,nombreComercial:'Mi presentación',archivado:true};
  const mezclados=incluirFarcovet([], [editado]);
  assert.equal(mezclados.length,107);
  assert.equal(mezclados.filter(p => p.origenCatalogoId===base.id).length,1);
  assert.equal(productosDelCatalogo([],mezclados).length,106);
  assert.equal(incluirFarcovet([], [{...editado,archivado:false}]).find(p => p.id==='restaurado').nombreComercial,'Mi presentación');
  assert.equal(PRODUCTOS_FARCOVET[0].nombreComercial,base.nombreComercial);
});

test('las discrepancias originales no se pueden usar para convertir dosis', () => {
  for (const name of ['DETOR','OXICAM B12','ENROLAB PLUS','NOVA SKIN BARRIER SUPPORT','LABIMEC']) {
    const p=PRODUCTOS_FARCOVET.find(p => p.nombreComercial===name);
    assert.ok(p.bloqueoCalculoCatalogo, name);
    assert.match(concentracionParaPauta(p, {}, {}).error,/incompletos o discrepancias/);
  }
  const detor=PRODUCTOS_FARCOVET.find(p => p.nombreComercial==='DETOR');
  assert.ok(detor.observacionesCatalogo.some(x => x.includes('detomidina') && x.includes('medetomidina')));
});

test('las repeticiones del PDF se conservan como fuentes del mismo producto', () => {
  const ps=PRODUCTOS_FARCOVET.filter(p => p.nombreComercial==='BE PLUS FORTE');
  assert.equal(ps.length,1);
  assert.deepEqual(ps[0].fuenteCatalogo.paginas,[8,16,18,33,38]);
  const nova=PRODUCTOS_FARCOVET.find(p => p.nombreComercial==='NOVA SKIN BARRIER SUPPORT');
  assert.deepEqual(nova.fuenteCatalogo.paginas,[26,41]);
});

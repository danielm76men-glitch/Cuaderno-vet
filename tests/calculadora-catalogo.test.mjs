import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { esCombinacion, principiosDe, resumenComposicion, concentracionParaPauta, termino } from '../catalogo.js';
import { renderProductoComercial, renderCatalogoComercial } from '../catalogo-ui.js';
import { PRODUCTOS_FARCOVET } from '../farcovet-datos.js';

// DOM mínimo para ejecutar los controladores reales sin un navegador ni Firebase.
class Nodo {
  constructor(tag) { this.tagName = tag.toUpperCase(); this.children = []; this.handlers = {}; this.attrs = {}; this.dataset = {}; this.style = {}; this.hidden = false; }
  appendChild(n) { n.parentElement = this; this.children.push(n); return n; }
  append(...nodes) { nodes.forEach(n => this.appendChild(n)); }
  prepend(n) { n.parentElement = this; this.children.unshift(n); }
  replaceChildren(...nodes) { this.children = []; this.append(...nodes); }
  set innerHTML(v) { this.children = []; this._text = v; this._value = undefined; }
  set textContent(v) { this._text = String(v); this.children = []; }
  get textContent() { return (this._text || '') + this.children.map(c => c.textContent).join(' '); }
  set value(v) { this._value = String(v); }
  get value() { return this._value ?? (this.tagName === 'SELECT' ? this.children[0]?.value || '' : ''); }
  setAttribute(k, v) { this.attrs[k] = v; }
  addEventListener(k, fn) { (this.handlers[k] ||= []).push(fn); }
  async emit(k) { for (const fn of this.handlers[k] || []) await fn({ target: this }); }
  querySelector(sel) { return this.children.find(n => '.' + n.className === sel) || this.children.map(n => n.querySelector(sel)).find(Boolean); }
  remove() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(c => c !== this); }
}
const document = { createElement: t => new Nodo(t), createTextNode: t => { const n = new Nodo('text'); n.textContent = t; return n; } };

test('el catálogo Farcovet abre una ficha completa con fotos, páginas y observaciones', async () => {
  const anterior=globalThis.document; globalThis.document=document;
  try {
    let abierto;
    const p=PRODUCTOS_FARCOVET.find(p => p.nombreComercial==='DETOR');
    const api={farmacos:[],productos:[p],archivados:[],cambiarQuery(){},crear(){},guardar(){},volver(){},
      fotos:()=>new Nodo('div'),vias:()=>new Nodo('div'),abrirProducto:id=>{abierto=id;}};
    const root=new Nodo('main'); renderCatalogoComercial(root,api);
    const recorrer=n=>[n,...n.children.flatMap(recorrer)];
    await recorrer(root).find(n=>n.tagName==='BUTTON'&&n.textContent==='Ver presentación completa').emit('click');
    assert.equal(abierto,p.id);
    const fichaRoot=new Nodo('main'); renderProductoComercial(fichaRoot,p,api);
    const nodes=recorrer(fichaRoot);
    assert.ok(nodes.some(n=>n.tagName==='IMG'&&n.src===p.fotoCatalogo));
    assert.ok(nodes.some(n=>n.tagName==='A'&&n.href.endsWith('#page=12')));
    assert.ok(nodes.some(n=>n.tagName==='A'&&n.href.endsWith('#page=35')));
    assert.match(fichaRoot.textContent,/detomidina.*medetomidina/);
    assert.ok(!nodes.some(n=>n.tagName==='BUTTON'&&n.textContent==='Calcular con este producto'));
  } finally { globalThis.document=anterior; }
});
const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
function extraer(nombre) {
  const inicio = app.indexOf('function ' + nombre + '(');
  assert.ok(inicio >= 0, nombre);
  return app.slice(inicio, app.indexOf('\n}', inicio) + 2);
}
const ficha = base => ({ id: 'f1', nombreGenerico: 'Activo A + Activo B', esCombinacion: true, principiosActivos: ['Activo A','Activo B'], verificadoEl: '2026-09-01', dosis: [{ especie: 'canino', dosisMin: 10, dosisMax: 10, unidad: 'mg/kg', via: ['VO'], fuente: 'Fixture de cálculo, sin aplicación clínica', baseDosis: base }] });
const producto = { id:'p1', farmacoId:'f1', nombreComercial:'Producto sintético', via:['VO'], composicion:[{nombre:'Activo A',concentracion:80,unidadConc:'mg/tableta'},{nombre:'Activo B',concentracion:20,unidadConc:'mg/tableta'}] };
function montar(base, productoElegido = producto) {
  const f = ficha(base);
  const contexto = vm.createContext({ document, esCombinacion, principiosDe, resumenComposicion, concentracionParaPauta, termino,
    farmacosNormalizados: () => [f], catalogoActual: () => [productoElegido], normalizarBusqueda: termino,
    especieActiva: () => '', alertaQueBloquea: () => '', verificacionVencida: () => false,
    accion: (t,fn) => {const b=new Nodo('button');b.textContent=t;b.addEventListener('click',fn);return b;}
  });
  vm.runInContext(['roundNice','tipoDeUnidad','superficieCorporal','totalSegunUnidad','viasDe','viaTexto','buildDoseCalculator'].map(extraer).join('\n'), contexto);
  const vista = contexto.buildDoseCalculator({ farmacoId:'f1', productoId:'p1' });
  const control = texto => vista.children.find(c => c.children[0]?.textContent.startsWith(texto)).children[1];
  return { vista, control, resultado: () => vista.children.find(n => n.className === 'calc-result').textContent };
}
async function calcular(m) {
  const especie=m.control('Especie'); especie.value='canino'; await especie.emit('change');
  const peso=m.control('Peso'); peso.value='20'; await peso.emit('input');
  const dosis=m.control('Dosis a usar'); dosis.value='10'; await dosis.emit('input');
}
test('abrir desde el producto conserva la selección y calcula con el componente elegido', async () => {
  const m=montar('componente:activo a'); await calcular(m);
  assert.equal(m.control('Producto y presentación').value,'p1');
  assert.match(m.resultado(), /= 2.5 tableta/);
  assert.match(m.resultado(), /Dosis expresada en: Activo A/);
  assert.match(m.resultado(), /Producto: Producto sintético/);
});
test('al cambiar la base a total se usan todos los componentes', async () => {
  const m=montar('total'); await calcular(m);
  assert.match(m.resultado(), /= 2 tableta/);
  assert.match(m.resultado(), /Total de la combinación/);
});
test('no muestra cantidades de producto con una pauta ambigua o una vía incompatible', async () => {
  const m=montar(''); await calcular(m);
  assert.match(m.resultado(), /necesita indicar/); assert.doesNotMatch(m.resultado(), /= .*tableta/);
  const otra=montar('total',{...producto,via:['IV']}); await calcular(otra);
  assert.match(otra.resultado(), /vía del producto no coincide/); assert.doesNotMatch(otra.resultado(), /= .*tableta/);
});
test('cambiar el producto o el peso vuelve a calcular sin conservar un resultado anterior', async () => {
  const m=montar('total'); await calcular(m);
  const peso=m.control('Peso'); peso.value='10'; await peso.emit('input'); assert.match(m.resultado(), /= 1 tableta/);
  const pres=m.control('Producto y presentación'); pres.value=''; await pres.emit('change');
  assert.doesNotMatch(m.resultado(), /= .*tableta/); assert.match(m.resultado(), /Selecciona un producto/);
});
test('el editor comercial guarda componentes y abre la calculadora con la ficha y producto correctos', async () => {
  const anterior = globalThis.document; globalThis.document=document;
  try {
    let guardado, calculado;
    const root=new Nodo('main');
    renderProductoComercial(root,producto,{
      farmacos:[ficha('total')],volver(){},guardar:p=>{guardado=structuredClone(p);},fotos:()=>new Nodo('div'),
      vias:()=>new Nodo('div'),abrirFarmaco(){},calcular:p=>{calculado=p;},confirmarArchivo:async()=>true
    });
    const recorrer=n=>[n,...n.children.flatMap(recorrer)];
    const nombre=recorrer(root).find(n=>n.placeholder==='Nombre comercial del producto');
    nombre.value='Marca actualizada'; await nombre.emit('input'); assert.equal(guardado.nombreComercial,'Marca actualizada');
    const boton=recorrer(root).find(n=>n.tagName==='BUTTON'&&n.textContent==='Calcular con este producto'); await boton.emit('click');
    assert.equal(calculado.farmacoId,'f1'); assert.equal(calculado.id,'p1');
    assert.equal(calculado.composicion.length,2);
  } finally {globalThis.document=anterior;}
});

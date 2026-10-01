import test from 'node:test';
import assert from 'node:assert/strict';
import {marcaDeEspecie,actualizarMarcaEspecie} from '../identidad.js';
test('especies desconocidas y exóticos mantienen una marca neutra',()=>{
 for(const valor of ['',null,'Exótico','Otro','__proto__'])assert.equal(marcaDeEspecie(valor).clave,'general');
 assert.equal(marcaDeEspecie('  FELINO ').clave,'felino');
});
test('cambiar especie actualiza el dibujo sin reemplazar la ficha ni sus campos',()=>{
 const props=new Map();const root={dataset:{},style:{setProperty:(k,v)=>props.set(k,v)}};
 actualizarMarcaEspecie(root,'Canino');assert.equal(root.dataset.watermark,'canino');assert.equal(props.get('--animal-x'),'0%');
 actualizarMarcaEspecie(root,'Equino');assert.equal(root.dataset.watermark,'equino');assert.ok(parseFloat(props.get('--animal-x'))>90);assert.ok(props.get('--animal-size').includes('%'));
 actualizarMarcaEspecie(root,'Otro');assert.equal(root.dataset.watermark,'general');assert.equal(props.get('--animal-x'),'0%');
});

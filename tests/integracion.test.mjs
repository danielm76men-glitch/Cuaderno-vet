import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
const root=new URL('../',import.meta.url);
const app=readFileSync(new URL('app.js',root),'utf8');
const start=app.indexOf('function fechaDeVerificacion(');
const end=app.indexOf('function verificacionVencida(',start);
const fecha=new Function(app.slice(start,end)+';return fechaDeVerificacion;')();
test('las fechas sin hora conservan el día en Ecuador',()=>{
  const old=process.env.TZ;process.env.TZ='America/Guayaquil';
  try {const d=fecha('2026-08-21');assert.equal(d.getDate(),21);assert.equal(d.getMonth(),7);assert.equal(d.getFullYear(),2026);} finally {if(old===undefined)delete process.env.TZ;else process.env.TZ=old;}
});
test('rechaza días inexistentes y conserva Timestamp',()=>{assert.equal(fecha('2026-02-30'),null);assert.equal(fecha('texto'),null);assert.equal(fecha(null),null);const date=new Date(2026,8,24);assert.equal(fecha({toDate:()=>date}),date);});
test('los módulos y archivos del caché están presentes',()=>{
  const sw=readFileSync(new URL('sw.js',root),'utf8');
  const shell=sw.slice(sw.indexOf('const APP_SHELL'),sw.indexOf('const ORIGEN_LIBS'));
  for(const [,file] of shell.matchAll(/"\.\/([^"\n]+)"/g))assert.ok(existsSync(new URL(file,root)),file);
  for(const [,file] of app.matchAll(/from "\.\/([^"\n]+)"/g))assert.ok(existsSync(new URL(file,root)),file);
  assert.ok(shell.includes('respaldo.js'));assert.ok(shell.includes('mejoras.css'));
});
test('la versión entregable no contiene el modo de pruebas',()=>{assert.ok(!app.includes('window.__test'));assert.ok(!app.includes('Paciente de prueba'));assert.ok(!app.includes("uid:'demo'"));assert.ok(app.includes('onAuthStateChanged(auth,'));});

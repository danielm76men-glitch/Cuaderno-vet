// Vista local de verificación: Firebase se sustituye en memoria; no toca cuentas.
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const mock = `
const uid='fixture';
const pauta={especie:'canino',indicacion:'Ejemplo de cálculo',dosisMin:10,dosisMax:10,unidad:'mg/kg',via:['VO'],fuente:'Datos sintéticos para prueba de interfaz',baseDosis:'componente:activo a'};
const filas={entries:[], formulario:[
{id:'f1',uid,nombreGenerico:'Activo A + Activo B',esCombinacion:true,principiosActivos:['Activo A','Activo B'],familia:'Ejemplos',dosis:[pauta],presentaciones:[{id:'pres-anterior',concentracion:100,unidadConc:'mg/tableta',via:['VO'],nombreComercialLocal:'Presentación anterior'}]},
{id:'f2',uid,nombreGenerico:'Activo C',familia:'Ejemplos',dosis:[{...pauta,baseDosis:'',via:['IM']}],presentaciones:[]},
{id:'p1',uid,tipoRegistro:'productoComercial',farmacoId:'f1',nombreComercial:'Producto combinado de ejemplo',laboratorio:'Empresa de ejemplo',forma:'Tableta',envase:'Caja de 10 tabletas',via:['VO'],composicion:[{nombre:'Activo A',concentracion:80,unidadConc:'mg/tableta'},{nombre:'Activo B',concentracion:20,unidadConc:'mg/tableta'}]},
{id:'p2',uid,tipoRegistro:'productoComercial',farmacoId:'f2',nombreComercial:'Producto simple de ejemplo',via:['IM'],composicion:[{nombre:'Activo C',concentracion:50,unidadConc:'mg/mL'}]}
],fotos:[]};
let secuencia=0; const listeners=[];
const snapshot=q=>({docs:(filas[q.col]||[]).filter(f=>(q.filtros||[]).every(w=>!w.field||f[w.field]===w.value)).map(f=>({id:f.id,data:()=>({...f}),metadata:{hasPendingWrites:false}}))});
const avisar=()=>queueMicrotask(()=>listeners.forEach(([q,cb])=>cb(snapshot(q))));
export const initializeApp=()=>({}),getFirestore=()=>({}),enableIndexedDbPersistence=()=>Promise.resolve();
export const getAuth=()=>({currentUser:{uid,email:'vista-local@example.test'}});
export const onAuthStateChanged=(a,cb)=>queueMicrotask(()=>cb(a.currentUser));
export const isSignInWithEmailLink=()=>false,signInWithEmailLink=()=>Promise.resolve(),sendSignInLinkToEmail=()=>Promise.resolve(),signOut=()=>Promise.resolve();
export const collection=(db,col)=>({col});
export const doc=(...a)=>a.length===1?{col:a[0].col,id:'nuevo-'+(++secuencia)}:{col:a[1],id:a[2]};
export const where=(field,op,value)=>({field,value}),orderBy=()=>({}),query=(c,...filtros)=>({...c,filtros});
export const onSnapshot=(q,cb)=>{const l=[q,cb];listeners.push(l);queueMicrotask(()=>cb(snapshot(q)));return()=>listeners.splice(listeners.indexOf(l),1);};
export const getDocs=q=>Promise.resolve(snapshot(q)),getDocsFromServer=getDocs,waitForPendingWrites=()=>Promise.resolve();
export const serverTimestamp=()=>({toMillis:()=>Date.now(),toDate:()=>new Date()});
export const setDoc=(ref,data,opts)=>{const list=filas[ref.col]||(filas[ref.col]=[]);const i=list.findIndex(f=>f.id===ref.id);const val={...(opts?.merge&&i>=0?list[i]:{}),...data,id:ref.id};if(i>=0)list[i]=val;else list.push(val);avisar();return Promise.resolve();};
export const updateDoc=(ref,data)=>setDoc(ref,data,{merge:true});
export const deleteDoc=ref=>{filas[ref.col]=filas[ref.col].filter(f=>f.id!==ref.id);avisar();return Promise.resolve();};
export const addDoc=(c,data)=>{const ref=doc(c);return setDoc(ref,data).then(()=>ref);};
export const arrayUnion=(...v)=>v,deleteField=()=>null;
export class Timestamp {static now(){return serverTimestamp();}}
`;
http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/firebase-mock.js'){res.setHeader('Content-Type','text/javascript');res.end(mock);return;}
  const file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname)));
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  try{
    let content=readFileSync(file);
    if(file.endsWith('app.js'))content=content.toString().replaceAll(/https:\/\/www\.gstatic\.com\/firebasejs\/10\.7\.1\/firebase-[^"]+\.js/g,'./firebase-mock.js').replace('navigator.serviceWorker.register("sw.js")','Promise.resolve()');
    res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.png':'image/png'})[path.extname(file)]||'application/octet-stream');
    res.setHeader('Cache-Control','no-store');res.end(content);
  }catch{res.writeHead(404).end();}
}).listen(4173,'127.0.0.1',()=>console.log('Vista de verificación local: http://127.0.0.1:4173'));

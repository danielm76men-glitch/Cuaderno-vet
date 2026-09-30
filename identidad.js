// Coordenadas del atlas: cada animal ocupa una celda de una cuadrícula 3 × 3.
export const MARCAS_ESPECIE = Object.freeze({canino:[0,0],felino:[50,0],equino:[100,0],bovino:[0,50],porcino:[50,50],ovino:[100,50],caprino:[0,100],aves:[50,100]});
const RECORTES = {canino:[0,20,426,395],felino:[445,65,368,344],equino:[814,20,448,405],bovino:[5,450,421,355],porcino:[440,492,398,301],ovino:[855,470,389,337],caprino:[10,812,436,390],aves:[473,840,340,365]};
export function marcaDeEspecie(especie) {
 const clave=String(especie||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
 return Object.hasOwn(MARCAS_ESPECIE,clave) ? {clave, posicion:MARCAS_ESPECIE[clave]} : {clave:'general',posicion:[0,0]};
}
export function actualizarMarcaEspecie(root, especie) {
 const marca=marcaDeEspecie(especie);
 root.dataset.watermark=marca.clave;
 root.style.setProperty('--animal-x',marca.posicion[0]+'%');
 root.style.setProperty('--animal-y',marca.posicion[1]+'%');
 const corte=RECORTES[marca.clave];
 if(corte){const [x,y,w,h]=corte;root.style.setProperty('--animal-x',(x/(1280-w)*100)+'%');root.style.setProperty('--animal-y',(y/(1280-h)*100)+'%');root.style.setProperty('--animal-size',(1280/w*100)+'% '+(1280/h*100)+'%');root.style.setProperty('--animal-ratio',String(w/h));}
 else {root.style.setProperty('--animal-size','100% 100%');root.style.setProperty('--animal-ratio','1');}
}

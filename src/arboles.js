// Los arboles al estilo de los viejos juegos de PS1: dos o tres planos cruzados (como un asterisco visto desde arriba),
// con un dibujo de pocos pixeles pintado por codigo, igual que las plantas y los arbustos de sprites.js (a 8 pixeles por metro,
// borde recortado con alpha test, colores apagados por la paleta). Como el recorte es "todo o nada" no hay transparencia que
// ordenar: no parpadea al girar la camara. Cada zona del mundo es un solo InstancedMesh: todos los arboles se dibujan de una vez.
// El tronco y el choque no cambian: esto es solo lo que se ve (el choque sale de t.cosas, ver terrain.js).
import * as THREE from '../vendor/three.module.js';
import { crearAtlas } from './pixel.js';
import { estilo } from './material.js';

const entero = (p, a, b) => a + Math.floor(p.azar() * (b - a + 1));
const lim = (v, a, b) => Math.max(a, Math.min(b, v));

// cinco tonos por follaje, de oscuro a claro: verdes del mismo tono que el pasto (src/arte.js) y con poco salto entre tonos,
// para que los arboles no se despeguen del terreno
const HOJAS = {
  pino: ['#2f5a2e', '#376833', '#407639', '#4b843e', '#5a9246'],
  pinoAlto: ['#335c2c', '#3b6a31', '#447836', '#50873d', '#609646'],
  lenga: ['#8a4424', '#9e5228', '#b0622c', '#c07434', '#cc8840'],      // otoño: del rojo al naranja (apagado, como el pasto)
  nire: ['#8e6a26', '#a07a2c', '#b08a32', '#bf9a3c', '#caa84a'],       // otoño: amarillo (apagado)
  alamo: ['#467832', '#4f8636', '#5a933c', '#679f43', '#78ab4d'],
  eucalipto: ['#456a42', '#4f7748', '#5a844f', '#679158', '#779d63'],
  araucaria: ['#2b5530', '#336235', '#3c6f3a', '#467c40', '#538947'],
  sauce: ['#4e7a30', '#578735', '#62943b', '#6ea043', '#7dab4d'],
  seco: ['#3a2e24', '#4d3b2c', '#63503b', '#7d664b', '#9b8260'],
};
const CORTEZA = {
  pino: ['#3e2c20', '#5c4130', '#75573f'], pinoAlto: ['#3e2c20', '#5c4130', '#75573f'], lenga: ['#2e2220', '#4a3a34', '#63504a'], nire: ['#2e2220', '#4a3a34', '#63504a'],
  alamo: ['#8f8a7c', '#b9b3a2', '#d6d1c2'], eucalipto: ['#9a8d76', '#c2b59c', '#ded3bd'], araucaria: ['#463e37', '#5a5148', '#756a5e'], sauce: ['#3b2f26', '#54443a', '#6e5a4c'], seco: ['#3a2e24', '#4d3b2c', '#63503b'],
};

// un pixel del follaje: luz de 0 (sombra) a 1 (pleno sol)
const hoja = (p, tipo, x, y, luz) => p.punto(x, y, HOJAS[tipo][lim(Math.floor(luz * 5), 0, 4)]);
const troncoDe = (p, tipo, x, y0, y1, ancho = 2) => { const c = CORTEZA[tipo]; p.rect(x, y0, ancho, y1 - y0, c[1]); p.rect(x, y0, 1, y1 - y0, c[2]); p.rect(x + ancho - 1, y0, 1, y1 - y0, c[0]); };

// una masa redonda de hojas con el borde en racimos: la base de casi todas las copas.
// hueco: cuantos agujeros deja por abajo (se ve el cielo entre las ramas)
function masa(p, tipo, cx, cy, rx, ry, hueco = 0.08) {
  const f1 = p.azar() * 6.28, f2 = p.azar() * 6.28;
  for (let y = Math.floor(cy - ry - 2); y <= cy + ry + 2; y++) for (let x = Math.floor(cx - rx - 2); x <= cx + rx + 2; x++) {
    if (x < 0 || y < 0 || x >= p.w || y >= p.h) continue;
    const dx = (x - cx) / rx, dy = (y - cy) / ry, ang = Math.atan2(dy, dx);
    const d = Math.hypot(dx, dy) / (1 + 0.1 * Math.sin(ang * 3 + f1) + 0.07 * Math.sin(ang * 7 + f2)) + (p.azar() - 0.5) * 0.16;
    if (d > 1) continue;
    if (dy > 0.1 && p.azar() < hueco * (0.3 + dy)) continue;
    if (d > 0.84 && p.azar() < 0.3) continue;   // el borde "comido": hojas sueltas, no una raya lisa
    // hojas de pixel: ruido de varios tonos, con puntos brillantes y oscuros sueltos (como las texturas de PS1)
    let luz = 0.56 - dy * 0.22 + (p.azar() - 0.5) * 0.4;   // (sin sombra de costado: al cruzarse los planos se veian costuras)
    if ((x * 5 + y * 9) % 7 === 0) luz -= 0.08;   // sombra de racimo
    if (d > 0.82 && dy > 0) luz -= 0.1;
    const q = p.azar(); if (q < 0.08) luz += 0.22; else if (q > 0.93) luz -= 0.2;
    hoja(p, tipo, x, y, luz);
  }
}

// conifera: cono de pisos que se ensanchan hacia abajo
function conifera(p, tipo, pie, fino, piso) {
  const W = p.w, H = p.h, cx = (W - 1) / 2, copa = H - pie;
  for (let y = 0; y < copa; y++) {
    const t = y / copa, frac = (y % piso) / piso, hw = (W / 2) * (fino + (1 - fino) * t) * (0.6 + 0.4 * frac) + (p.azar() - 0.5) * 1.3;
    for (let x = Math.ceil(cx - hw); x <= cx + hw; x++) {
      if (x < 0 || x >= W || (y > 4 && p.azar() < 0.05 + frac * 0.1) || (Math.abs(x - cx) > hw - 1.2 && p.azar() < 0.3)) continue;
      const q = p.azar();
      hoja(p, tipo, x, y, 0.62 - frac * 0.26 + (p.azar() - 0.5) * 0.38 - (frac > 0.85 ? 0.12 : 0) + (q < 0.07 ? 0.22 : q > 0.94 ? -0.2 : 0));
    }
  }
  troncoDe(p, tipo, Math.round(cx) - 1, copa - 3, H);
}
function arbolRedondo(p, tipo, pie, rx, ry, ramas = true) {
  const W = p.w, H = p.h, cx = (W - 1) / 2, cy = ry + 1;
  troncoDe(p, tipo, Math.round(cx) - 1, cy + ry * 0.4, H);
  if (ramas) { const c = CORTEZA[tipo]; for (let i = 0; i < 4; i++) { const dir = i % 2 ? 1 : -1; p.punto(Math.round(cx) + dir * (1 + i), Math.round(cy + ry * 0.7 - i * 2), c[1]); p.punto(Math.round(cx) + dir * (2 + i), Math.round(cy + ry * 0.7 - i * 2 - 1), c[0]); } }
  masa(p, tipo, cx, cy, rx, ry);
}
// el alamo: alto, angosto y con la copa que flamea
function alamo(p) {
  const W = p.w, H = p.h, cx = (W - 1) / 2, copa = H - 12;
  troncoDe(p, 'alamo', Math.round(cx) - 1, copa - 4, H);
  masa(p, 'alamo', cx, copa * 0.52, W / 2 - 0.3, copa * 0.5, 0.05);
  for (let i = 0; i < 6; i++) hoja(p, 'alamo', entero(p, 3, W - 4), entero(p, 2, copa - 2), 0.95);   // hojas que brillan
}
// araucaria: tronco largo y un paraguas de ramas arriba
function araucaria(p) {
  const W = p.w, H = p.h, cx = (W - 1) / 2, c = CORTEZA.araucaria;
  troncoDe(p, 'araucaria', Math.round(cx) - 1, 8, H);
  for (let y = 10; y < H; y += 3) p.rect(Math.round(cx) - 1, y, 2, 1, c[0]);   // los anillos del tronco
  masa(p, 'araucaria', cx, 5, W / 2 - 1, 4, 0.25);
  masa(p, 'araucaria', cx, 10, W / 2 - 4, 3, 0.3);
  masa(p, 'araucaria', cx - 1, 2, W / 2 - 6, 2, 0.1);
}
// eucalipto: tronco claro y flaco, con manojos de hojas a distintas alturas
function eucalipto(p) {
  const W = p.w, H = p.h, cx = (W - 1) / 2, c = CORTEZA.eucalipto;
  let x = Math.round(cx);
  for (let y = H - 1; y > 8; y--) { p.rect(x, y, 2, 1, c[1]); p.punto(x, y, c[2]); if (y % 9 === 0) x = lim(x + (p.azar() < 0.5 ? -1 : 1), 6, W - 8); }
  masa(p, 'eucalipto', cx - 5, 12, 6.5, 5, 0.3);
  masa(p, 'eucalipto', cx + 4, 8, 7, 5, 0.3);
  masa(p, 'eucalipto', cx, 22, 6, 4, 0.35);
  masa(p, 'eucalipto', cx - 2, 3, 5, 3, 0.2);
}
// sauce llorón: cúpula con cortinas de hojas que cuelgan
function sauce(p) {
  const W = p.w, H = p.h, cx = (W - 1) / 2, cup = 13;
  troncoDe(p, 'sauce', Math.round(cx) - 1, 10, H);
  masa(p, 'sauce', cx, cup, W / 2 - 1, cup - 1, 0);
  for (let x = Math.ceil(cx - W / 2 + 2); x < cx + W / 2 - 2; x += 2) {
    const largo = entero(p, 8, H - cup - 6) * (1 - Math.abs(x - cx) / W * 0.8), y0 = cup + 3;
    for (let y = y0; y < y0 + largo; y++) { hoja(p, 'sauce', x, y, 0.62 - (y - y0) / largo * 0.5 + (p.azar() - 0.5) * 0.3); if (p.azar() < 0.2) hoja(p, 'sauce', x + 1, y, 0.45); }
  }
}
// arbol seco: ramas peladas que se abren de a dos
function seco(p) {
  const W = p.w, H = p.h, c = CORTEZA.seco;
  const rama = (x, y, ang, largo, grosor, nivel) => {
    for (let i = 0; i < largo; i++) {
      x += Math.cos(ang) + (p.azar() - 0.5) * 0.5; y += Math.sin(ang);
      const xi = Math.round(x), yi = Math.round(y);
      if (xi < 0 || yi < 0 || xi >= W || yi >= H) return;
      p.rect(xi, yi, grosor, 1, i % 3 ? c[1] : c[0]); if (grosor > 1) p.punto(xi, yi, c[2]);
    }
    if (nivel < 3) { rama(x, y, ang - 0.5 - p.azar() * 0.4, largo * 0.72, Math.max(1, grosor - 1), nivel + 1); rama(x, y, ang + 0.5 + p.azar() * 0.4, largo * 0.72, Math.max(1, grosor - 1), nivel + 1); }
  };
  p.rect(Math.floor(W / 2) - 1, H - 10, 2, 10, c[1]); p.rect(Math.floor(W / 2) - 1, H - 10, 1, 10, c[2]);
  rama(W / 2, H - 10, -Math.PI / 2, 9, 2, 0);
  rama(W / 2, H - 9, -Math.PI / 2 - 0.9, 7, 1, 1);
  rama(W / 2, H - 8, -Math.PI / 2 + 0.9, 7, 1, 1);
}

// la copa vista de arriba: un disco de hojas (o una estrella si es de conifera: las ramas salen del centro). Va en un plano horizontal
// a la altura de la copa, para que desde la camara alta se vea una copa redonda y no los planos de canto.
function copaDeArriba(p, tipo, estrella) {
  const W = p.w, c = (W - 1) / 2, f = p.azar() * 6.28;
  for (let y = 0; y < p.h; y++) for (let x = 0; x < W; x++) {
    const dx = (x - c) / (W / 2), dy = (y - c) / (W / 2), ang = Math.atan2(dy, dx);
    const r = estrella ? 0.72 + 0.28 * Math.abs(Math.sin(ang * 4 + f)) : 0.92 + 0.08 * Math.sin(ang * 5 + f);
    const d = Math.hypot(dx, dy) / r + (p.azar() - 0.5) * 0.18;
    if (d > 1 || (d > 0.82 && p.azar() < 0.32)) continue;
    let luz = 0.6 - d * 0.2 + (p.azar() - 0.5) * 0.4;
    const q = p.azar(); if (q < 0.09) luz += 0.3; else if (q > 0.93) luz -= 0.3;
    hoja(p, tipo, x, y, luz);
  }
}

// nombre -> [ancho, alto, como se pinta, cuantos planos]. Las medidas son de un arbol de tamano 1,2 (el del medio).
const DIBUJOS = {
  pino: [29, 50, (p) => conifera(p, 'pino', 6, 0.12, 7)],
  pinoAlto: [22, 74, (p) => conifera(p, 'pinoAlto', 8, 0.1, 9)],
  lenga: [31, 44, (p) => arbolRedondo(p, 'lenga', 0, 14.5, 13)],
  nire: [31, 44, (p) => arbolRedondo(p, 'nire', 0, 14.5, 13)],
  alamo: [16, 66, alamo],
  araucaria: [29, 62, araucaria],
  eucalipto: [24, 68, eucalipto],
  sauce: [32, 46, sauce],
  seco: [26, 40, seco],
};
// donde va el plano de la copa vista de arriba: [a que altura (0 a 1 del arbol), que tan ancho (del ancho del dibujo), conifera (estrella)]
// (ancho 0 = sin plano: el arbol seco no tiene hojas)
const COPA = { pino: [0.42, 0.9, true], pinoAlto: [0.45, 0.85, true], lenga: [0.68, 0.98, false], nire: [0.68, 0.98, false], alamo: [0.6, 1.0, false], araucaria: [0.9, 0.95, true], eucalipto: [0.66, 0.95, false], sauce: [0.74, 1.0, false], seco: [0.6, 0, false] };
const VERSIONES = 3, PX = 8;
export const TIPOS_DE_ARBOL = Object.keys(DIBUJOS);

let hecho = null;
function dibujos() {
  if (hecho) return hecho;
  const atlas = crearAtlas(512, 256), zonas = {}, arriba = {};
  for (const nombre in DIBUJOS) {
    const [w, h, pintar] = DIBUJOS[nombre];
    zonas[nombre] = [];
    for (let k = 0; k < VERSIONES; k++) zonas[nombre].push(atlas.zona(w, h, pintar, 211 + k * 23 + nombre.length * 13));
    arriba[nombre] = [];
    for (let k = 0; k < VERSIONES; k++) arriba[nombre].push(atlas.zona(20, 20, (p) => copaDeArriba(p, nombre, COPA[nombre][2]), 311 + k * 29 + nombre.length * 11));
  }
  const textura = atlas.textura();
  textura.generateMipmaps = false; textura.minFilter = THREE.NearestFilter;
  hecho = { atlas, zonas, arriba, textura };
  return hecho;
}

// (Cada plano tiene sus dos caras como triangulos aparte, todos con la normal para arriba. Con "DoubleSide" la cara de atras
// da vuelta la normal y queda a oscuras: por eso un plano se veia oscuro y el que lo cruza claro.)
// Los planos cruzados: cada uno es un cuadrado (x de -0,5 a 0,5; y de 0 a 1) girado. Con 3 planos queda un asterisco.
function formaCruzada(planos) {
  const pos = [], nor = [], uv = [], idx = [];
  for (let k = 0; k < planos; k++) {
    const a = k * Math.PI / planos, cx = Math.cos(a) * 0.5, cz = Math.sin(a) * 0.5, b = pos.length / 3;
    pos.push(-cx, 0, -cz, cx, 0, cz, cx, 1, cz, -cx, 1, -cz);
    for (let i = 0; i < 4; i++) nor.push(0, 1, 0);   // la luz es pareja: el dibujo ya trae su sombra
    uv.push(0, 0, 1, 0, 1, 1, 0, 1);
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    idx.push(b, b + 2, b + 1, b, b + 3, b + 2);   // la otra cara, con la misma normal (ver abajo)
  }
  // y el plano de la copa vista de arriba: horizontal (aTop = 1; su altura y ancho los pone el material con aForma)
  const top = new Array(pos.length / 3).fill(0), b = pos.length / 3;
  pos.push(-0.5, 0, -0.5, 0.5, 0, -0.5, 0.5, 0, 0.5, -0.5, 0, 0.5);
  for (let i = 0; i < 4; i++) { nor.push(0, 1, 0); top.push(1); }
  uv.push(0, 0, 1, 0, 1, 1, 0, 1);
  idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  idx.push(b, b + 2, b + 1, b, b + 3, b + 2);
  const g = new THREE.BufferGeometry();
  g.setAttribute('aTop', new THREE.Float32BufferAttribute(top, 1));
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

// Junta los arboles de una zona.  poner(tipo, x, y, z, vuelta, tamano, azar)   malla() devuelve un InstancedMesh (o null)
// tamano: el de siempre de los arboles (o.alto, de 0,8 a 1,7).  liviano: celular (dos planos en vez de tres).
export function crearLoteDeArboles(liviano) {
  const lista = [];
  const { atlas, zonas, arriba, textura } = dibujos();
  return {
    cuantos: () => lista.length,
    poner: (tipo, x, y, z, vuelta, tam, azar) => { lista.push([tipo, x, y, z, vuelta, tam, azar]); },
    malla: () => {
      if (!lista.length) return null;
      const planos = liviano ? 2 : 3, geo = formaCruzada(planos);
      const aUv = new Float32Array(lista.length * 4), aUv2 = new Float32Array(lista.length * 4), aForma = new Float32Array(lista.length * 2);
      const m = new THREE.InstancedMesh(geo, null, lista.length);
      const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), E = new THREE.Vector3(), ARRIBA = new THREE.Vector3(0, 1, 0);
      lista.forEach(([tipo, x, y, z, vuelta, tam, azar], i) => {
        const vs = zonas[tipo], zona = vs[Math.floor(azar * 977) % vs.length], s = tam / 1.2;
        M.compose(V.set(x, y - 0.12, z), Q.setFromAxisAngle(ARRIBA, vuelta), E.set(zona.w / PX * s, zona.h / PX * s, zona.w / PX * s));
        m.setMatrixAt(i, M);
        aUv.set([zona.x / atlas.ancho, zona.y / atlas.alto, zona.w / atlas.ancho, zona.h / atlas.alto], i * 4);
        const za = arriba[tipo][Math.floor(azar * 977) % vs.length], cp = COPA[tipo];
        aUv2.set([za.x / atlas.ancho, za.y / atlas.alto, za.w / atlas.ancho, za.h / atlas.alto], i * 4);
        aForma.set([cp[0], cp[1]], i * 2);
      });
      geo.setAttribute('aUv', new THREE.InstancedBufferAttribute(aUv, 4));
      geo.setAttribute('aUv2', new THREE.InstancedBufferAttribute(aUv2, 4));
      geo.setAttribute('aForma', new THREE.InstancedBufferAttribute(aForma, 2));
      m.material = estilo(new THREE.MeshLambertMaterial({ map: textura, alphaTest: 0.5 }), { calada: true, uvInstancia: true, clave: 'arbol' });
      m.customDepthMaterial = estilo(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: textura, alphaTest: 0.5 }), { uvInstancia: true, soloForma: true, clave: 'arbol' });
      m.castShadow = true; m.receiveShadow = false;
      m.userData.arboles = lista.length; m.userData.planos = planos;
      return m;
    },
  };
}

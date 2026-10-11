// Sprites: dibujos planos de pocos pixeles que siempre miran a la camara. Son el publico, los arbustos,
// las matas de pasto, las flores y los yuyos. Van a 8 pixeles por metro, igual que los autos.
// Los dibujos de la gente estan escritos como texto (una letra por pixel); las plantas se pintan con cuentas.
import * as THREE from '../vendor/three.module.js';
import { crearAtlas } from './pixel.js';
import { estilo } from './material.js';

const PX = 8;   // pixeles por metro
const entero = (p, a, b) => a + Math.floor(p.azar() * (b - a + 1));

// --- la gente ---
// h pelo, s piel, r ropa, R ropa en sombra, p pantalon, P pantalon en sombra, z zapatillas, g gorra, . nada
// Seis cuadros de 8 x 15: de frente (quieto, brazos arriba, saludando) y de espaldas (lo mismo).
const PIERNAS = ['..pppp..', '..pppp..', '..pPPp..', '..p..p..', '..p..p..', '..z..z..'];
const GENTE = [
  ['..hhhh..', '..hssh..', '..ssss..', '..ssss..', '.rrrrrr.', 'rrrrrrrr', 'rRrrrrRr', 'sRrrrrRs', '..rrrr..'],   // de frente, quieto
  ['s.hhhh.s', 'r.hssh.r', 'r.ssss.r', 'r.ssss.r', 'rrrrrrrr', '.rrrrrr.', '.Rrrrrr.', '.RrrrrR.', '..rrrr..'],   // de frente, brazos arriba
  ['s.hhhh..', 'r.hssh..', 'r.ssss..', 'r.ssss..', 'rrrrrrr.', '.rrrrrrr', '.RrrrrRr', '.RrrrrRs', '..rrrr..'],   // de frente, saludando
  ['..hhhh..', '..hhhh..', '..hhhh..', '..ssss..', '.rrrrrr.', 'rrrrrrrr', 'rRRRRRRr', 'sRRRRRRs', '..RRRR..'],   // de espaldas, quieto
  ['s.hhhh.s', 'r.hhhh.r', 'r.hhhh.r', 'r.ssss.r', 'rrrrrrrr', '.rrrrrr.', '.RRRRRR.', '.RRRRRR.', '..RRRR..'],   // de espaldas, brazos arriba
  ['..hhhh.s', '..hhhh.r', '..hhhh.r', '..ssss.r', '.rrrrrrr', 'rrrrrrr.', 'rRRRRRR.', 'sRRRRRR.', '..RRRR..'],   // de espaldas, saludando
].map((arriba) => arriba.concat(PIERNAS));
const ROPAS = ['#d8402f', '#2f6fd0', '#f2c200', '#f1ede2', '#3f9150', '#f07f1e', '#7b4fb0', '#49b3d6', '#1e1f23', '#e36b9a', '#8f9aa3', '#b5503a'];
const PIELES = ['#f0c8a0', '#d9a273', '#a86f48', '#f5d6b8'];
const PELOS = ['#2a1d16', '#5a3a22', '#c9a35a', '#1b1b1d', '#8a8a8a', '#7a2f1c'];
const PANTALONES = ['#34507a', '#26262b', '#6b5a45', '#4a5930'];
const oscuro = (c, k = 0.72) => '#' + [1, 3, 5].map((i) => Math.round(parseInt(c.slice(i, i + 2), 16) * k).toString(16).padStart(2, '0')).join('');

function pintarPersona(p, n) {
  const ropa = ROPAS[n % ROPAS.length], pant = PANTALONES[(n * 7 + 1) % PANTALONES.length];
  // algunos van de gorra: la primera fila del pelo toma el color de otra prenda
  const gorra = n % 3 === 0 ? ROPAS[(n * 5 + 3) % ROPAS.length] : null, pelo = PELOS[(n * 3) % PELOS.length];
  const color = { h: pelo, s: PIELES[n % PIELES.length], r: ropa, R: oscuro(ropa), p: pant, P: oscuro(pant), z: n % 2 ? '#e9e4d6' : '#3a2a22' };
  GENTE.forEach((filas, cuadro) => filas.forEach((fila, y) => {
    for (let x = 0; x < 8; x++) {
      const c = fila[x];
      if (c !== '.') p.punto(cuadro * 8 + x, y, c === 'h' && gorra && y === 0 ? gorra : color[c]);
    }
  }));
}

// --- las plantas: cada una es una funcion que pinta sobre un fondo transparente ---
// una mata: hojitas finas que salen de abajo, mas altas en el medio
function mata(p, tonos, alto) {
  for (let x = 0; x < p.w; x++) {
    const centro = 1 - Math.abs(x - (p.w - 1) / 2) / (p.w / 2), h = Math.max(1, Math.round(alto * (0.35 + 0.65 * centro) * (0.6 + 0.4 * p.azar())));
    if (p.azar() < 0.2) continue;
    const t = entero(p, 0, tonos.length - 1);
    p.rect(x, p.h - h, 1, h, tonos[t]);
    if (h > 2) p.punto(x, p.h - h, tonos[Math.min(tonos.length - 1, t + 1)]);
  }
  p.rect(1, p.h - 1, p.w - 2, 1, tonos[0]);
}
// un arbusto: una masa redonda, con racimos claros arriba y sombra abajo
function arbusto(p, tonos, flor) {
  const w = p.w, h = p.h, cx = (w - 1) / 2;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (x - cx) / (w / 2), dy = (y - h * 0.62) / (h * 0.62), d = dx * dx + dy * dy + (p.azar() - 0.5) * 0.22;
    if (d > 1 || (y === h - 1 && Math.abs(dx) > 0.7)) continue;
    const luz = (h - y) / h - dx * 0.25 + (p.azar() - 0.5) * 0.3;
    p.punto(x, y, tonos[luz > 0.78 ? 3 : luz > 0.52 ? 2 : luz > 0.28 ? 1 : 0]);
  }
  for (let i = 0; i < Math.round(w * h / 22); i++) {   // racimos de hojas
    const x = entero(p, 2, w - 4), y = entero(p, 1, Math.max(1, Math.round(h * 0.6)));
    p.rect(x, y, 2, 1, tonos[3]); p.punto(x, y + 1, tonos[1]);
  }
  if (flor) for (let i = 0; i < Math.round(w / 3); i++) p.punto(entero(p, 2, w - 3), entero(p, 1, Math.round(h * 0.6)), flor);
}
// tallos con una espiga de color arriba (lupinos, cardos) o un plumero (cortadera)
function espigas(p, verdes, flores, cuantas, largoFlor) {
  mata(p, verdes, Math.round(p.h * 0.45));
  for (let i = 0; i < cuantas; i++) {
    const x = Math.round((i + 0.5) * p.w / cuantas + (p.azar() - 0.5) * 1.5), alto = Math.round(p.h * (0.7 + 0.3 * p.azar())), lf = Math.max(2, Math.round(largoFlor * (0.7 + 0.5 * p.azar())));
    p.rect(x, p.h - alto, 1, alto, verdes[1]);
    p.rect(x, p.h - alto, 1, lf, flores[i % flores.length]);
    if (lf > 2) { p.punto(x - 1, p.h - alto + 1, flores[(i + 1) % flores.length]); p.punto(x + 1, p.h - alto + 2, flores[i % flores.length]); p.punto(x, p.h - alto, flores[flores.length - 1]); }
  }
}
// flores al ras del piso
function flores(p, verdes, colores) {
  mata(p, verdes, p.h - 2);
  for (let i = 0; i < Math.round(p.w / 2); i++) { const x = entero(p, 0, p.w - 1), y = entero(p, 0, p.h - 3); p.punto(x, y, colores[i % colores.length]); if (p.azar() < 0.4) p.punto(x, y + 1, verdes[2]); }
}
// piedra suelta
function piedra(p) {
  const t = ['#55524d', '#6c6862', '#86817a', '#a39e94'];
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
    const dx = (x - (p.w - 1) / 2) / (p.w / 2), dy = (y - p.h + 1) / p.h;
    if (dx * dx + dy * dy > 1) continue;
    p.punto(x, y, y === 0 || (x < p.w / 2 && y < p.h / 2) ? t[3] : y >= p.h - 1 ? t[0] : x > p.w * 0.65 ? t[1] : t[2]);
  }
}
// tocon: un tronco cortado
function tocon(p) {
  p.rect(1, 2, p.w - 2, p.h - 2, '#5c4130'); p.rect(1, 2, 1, p.h - 2, '#75573f'); p.rect(p.w - 2, 2, 1, p.h - 2, '#473021');
  p.rect(1, 0, p.w - 2, 2, '#c9a878'); p.rect(2, 0, p.w - 4, 1, '#dcc092'); p.punto(Math.floor(p.w / 2), 1, '#a8834f');
  p.punto(0, p.h - 1, '#473021'); p.punto(p.w - 1, p.h - 1, '#473021');
}
// la parrilla del asado, con sus brasas
function parrilla(p) {
  p.rect(1, 3, 8, 1, '#1e1f23'); p.rect(1, 2, 8, 1, '#8a3a22'); p.punto(3, 2, '#f07f1e'); p.punto(6, 2, '#ffc24a'); p.punto(4, 2, '#d8402f');
  p.rect(1, 4, 1, 3, '#2c2e33'); p.rect(8, 4, 1, 3, '#2c2e33'); p.rect(2, 1, 2, 1, '#7a4a2c'); p.rect(5, 1, 3, 1, '#9a5a36');
}
// girasol: una flor grande sobre un tallo
function girasol(p) {
  p.rect(2, 3, 1, 8, '#4a6a30'); p.rect(1, 6, 1, 1, '#5f8a3c'); p.rect(3, 8, 1, 1, '#5f8a3c'); p.rect(0, 9, 2, 1, '#4a6a30');
  p.rect(1, 0, 3, 3, '#d9b233'); p.rect(0, 1, 5, 1, '#e6c648'); p.punto(2, 1, '#6a4a2c'); p.punto(0, 0, '#b8922a'); p.punto(4, 2, '#b8922a');
}
// una vaca de perfil. manchas: [color del cuerpo, color de las manchas, color de la cara]
function vaca(p, cuerpo, manchas, cara) {
  const haciaLaDerecha = p.azar() < 0.5, X = (x, w = 1) => (haciaLaDerecha ? p.w - x - w : x);
  p.rect(X(2, 8), 2, 8, 4, cuerpo); p.rect(X(3, 6), 1, 6, 1, cuerpo);                       // cuerpo y lomo
  p.rect(X(0, 3), 2, 3, 3, cara); p.punto(X(0), 4, '#d8b0a0'); p.punto(X(1), 2, '#1b1b1d'); p.punto(X(1), 1, cuerpo);   // cabeza, hocico, ojo y oreja
  for (const x of [3, 5, 8, 9]) p.rect(X(x), 6, 1, 2, x % 2 ? cuerpo : manchas);            // patas
  p.punto(X(10), 3, cuerpo); p.punto(X(10), 4, manchas);                                    // cola
  for (let i = 0; i < 5; i++) p.rect(X(3 + Math.floor(p.azar() * 6), 2), 2 + Math.floor(p.azar() * 3), 2, 1 + Math.floor(p.azar() * 2), manchas);
  p.rect(X(6, 2), 6, 2, 1, '#e8b8b0');                                                      // ubre
}
// fogon: leños y llamas (se dibuja con luz propia, ver "brillante")
function fogata(p) {
  p.rect(1, 7, 7, 1, '#3a2418'); p.rect(0, 6, 3, 1, '#5a3a22'); p.rect(6, 6, 3, 1, '#4a2e1c');
  p.rect(2, 3, 5, 4, '#d8402f'); p.rect(3, 1, 3, 5, '#f07f1e'); p.rect(3, 4, 3, 2, '#ffc24a'); p.punto(4, 0, '#f07f1e'); p.punto(4, 3, '#fff1a8'); p.punto(4, 5, '#fff7d6');
  p.punto(2, 2, '#f07f1e'); p.punto(6, 2, '#d8402f'); p.punto(1, 5, '#d8402f'); p.punto(7, 4, '#f07f1e');
}
// bengala: una luz roja en la mano
function bengala(p) {
  p.rect(0, 1, 3, 2, '#ff5a3c'); p.rect(1, 0, 1, 4, '#ff5a3c'); p.punto(1, 1, '#ffffff'); p.punto(1, 2, '#ffe0c8');
}
// antorcha: la señal de peligro que marca las piedras del borde del camino. Un palo corto y una llama roja
// (se dibuja con luz propia, como las bengalas: se ve de dia y de noche)
function antorcha(p) {
  p.rect(2, 7, 1, 5, '#4a3a30');
  p.rect(1, 1, 3, 6, '#e0261c'); p.rect(0, 2, 5, 4, '#e0261c');
  p.rect(1, 3, 3, 3, '#ff6a2c'); p.rect(2, 0, 1, 2, '#ff4a2c'); p.rect(2, 4, 1, 2, '#ffd27a'); p.punto(2, 3, '#ff9a3c');
}
// reposera
function reposera(p, color) {
  p.rect(1, 0, 1, 6, '#9aa0a8'); p.rect(1, 0, 4, 1, color); p.rect(2, 1, 3, 3, color); p.rect(2, 4, 5, 1, oscuro(color)); p.rect(6, 4, 1, 3, '#9aa0a8'); p.rect(2, 5, 1, 2, '#9aa0a8');
}

const VERDES = {
  oscuro: ['#1c4426', '#28592e', '#356f37', '#48883f'],
  claro: ['#2f6a2a', '#458535', '#5c9c3e', '#80ba52'],
  seco: ['#6b5a2c', '#8f7a3a', '#b39c4e', '#d6c06a'],
  gris: ['#3f5a44', '#56755a', '#6f8f70', '#93ad8c'],
  otono: ['#7a2f1c', '#b5472a', '#d8702f', '#f0a33e'],
};

// Todas las plantas y cosas chicas: nombre -> [ancho, alto, como se pinta]. Hay varias versiones de cada una.
const DIBUJOS = {
  mataOscura: [7, 5, (p) => mata(p, VERDES.oscuro, 5)], mataClara: [7, 5, (p) => mata(p, VERDES.claro, 5)], mataSeca: [8, 6, (p) => mata(p, VERDES.seco, 6)],
  pastoAlto: [9, 9, (p) => mata(p, VERDES.claro, 9)], coiron: [11, 8, (p) => mata(p, VERDES.seco, 8)],
  helecho: [11, 7, (p) => mata(p, ['#1f4d2a', '#2f6b36', '#44873f', '#63a64c'], 7)],
  arbusto: [16, 11, (p) => arbusto(p, VERDES.oscuro)], arbustoClaro: [16, 11, (p) => arbusto(p, VERDES.claro)], arbustoFlor: [15, 10, (p) => arbusto(p, VERDES.claro, '#f1efe0')],
  neneo: [13, 8, (p) => arbusto(p, ['#6b6a2c', '#8a8a3a', '#a8a64a', '#c9c660'], '#f2d24a')], arbustoSeco: [14, 9, (p) => arbusto(p, VERDES.gris)],
  arbustoRojo: [15, 11, (p) => arbusto(p, VERDES.otono)],
  lupinoLila: [9, 13, (p) => espigas(p, VERDES.claro, ['#7b4fb0', '#9c6fd0', '#c9a6ee'], 3, 5)], lupinoRosa: [9, 12, (p) => espigas(p, VERDES.claro, ['#d0508a', '#e884b0', '#f7bfd1'], 3, 5)],
  lupinoBlanco: [8, 12, (p) => espigas(p, VERDES.claro, ['#d9d6e8', '#f1efe0', '#ffffff'], 2, 5)],
  cardo: [7, 12, (p) => espigas(p, VERDES.gris, ['#9c5fc0', '#c08ae0'], 2, 2)], amancay: [8, 8, (p) => espigas(p, VERDES.oscuro, ['#f07f1e', '#ffb03a'], 3, 2)],
  cortadera: [13, 19, (p) => espigas(p, ['#5c7a4a', '#7a9a5c', '#9ab874', '#b9d490'], ['#e9e2c8', '#f7f2de', '#fffdf0'], 4, 7)],
  margaritas: [9, 5, (p) => flores(p, VERDES.claro, ['#ffffff', '#f1efe0', '#f2d24a'])], amarillas: [9, 5, (p) => flores(p, VERDES.claro, ['#f2c200', '#ffe27a'])],
  violetas: [8, 5, (p) => flores(p, VERDES.oscuro, ['#9c6fd0', '#c9a6ee'])],
  piedra: [7, 4, piedra], piedraGrande: [10, 6, piedra], tocon: [7, 6, tocon], parrilla: [10, 7, parrilla],
  reposeraRoja: [7, 7, (p) => reposera(p, '#d8402f')], reposeraAzul: [7, 7, (p) => reposera(p, '#2f6fd0')],
  fogata: [9, 8, fogata], bengala: [3, 4, bengala], antorcha: [5, 12, antorcha],
  girasol: [5, 11, girasol], trigo: [8, 6, (p) => mata(p, ['#a08236', '#bfa048', '#d6ba60', '#e6d07e'], 6)],
  vacaOvera: [11, 8, (p) => vaca(p, '#e9e4d6', '#26262a', '#e9e4d6')], vacaColorada: [11, 8, (p) => vaca(p, '#8a4a2c', '#74391f', '#e9e4d6')],
};
const VERSIONES = 3, GENTES = 12;

// Pinta todos los sprites en un atlas. Devuelve donde quedo cada uno.
let hecho = null;
export function crearDibujos() {
  if (hecho) return hecho;
  const atlas = crearAtlas(256, 256), zonas = {};
  for (const nombre in DIBUJOS) {
    const [w, h, pintar] = DIBUJOS[nombre];
    zonas[nombre] = [];
    for (let k = 0; k < VERSIONES; k++) zonas[nombre].push(atlas.zona(w, h, pintar, 31 + k * 17 + nombre.length * 7));
  }
  zonas.gente = [];
  for (let n = 0; n < GENTES; n++) zonas.gente.push(atlas.zona(48, 15, (p) => pintarPersona(p, n), 1, 0.6));   // la gente, un poco mas viva que las plantas
  const textura = atlas.textura();
  textura.generateMipmaps = false; textura.minFilter = THREE.NearestFilter;
  hecho = { atlas, zonas, textura };
  return hecho;
}

// Junta muchos sprites para dibujarlos de una sola vez.
//   poner(nombre, x, y, z, { escala, azar, mueve, version })    una planta o una cosa
//   persona(n, x, y, z, rumbo, azar)                            alguien del publico; devuelve su numero en el lote
// malla(sombra, brillante) devuelve lo que hay que agregar a la escena. brillante: tiene luz propia (fuego, bengalas).
// dibujos: de donde salen los dibujos, { atlas, zonas: { nombre: [zona, ...] }, textura }. Si no se dice, son los de este archivo.
export function crearLoteDeSprites(dibujos) {
  const { atlas, zonas, textura } = dibujos || crearDibujos();
  const base = [], tam = [], uv = [], dato = [];
  function agregar(z, cuadros, x, y, zz, escala, azar, mueve, esGente, rumbo) {
    const w = z.w / cuadros;
    base.push(x, y, zz); tam.push(w / PX * escala, z.h / PX * escala);
    uv.push(z.x / atlas.ancho, z.y / atlas.alto, w / atlas.ancho, z.h / atlas.alto);
    dato.push(azar, mueve, esGente ? 1 : 0, rumbo || 0);
    return base.length / 3 - 1;
  }
  return {
    cuantos: () => base.length / 3,
    poner: (nombre, x, y, z, o = {}) => {
      const lista = zonas[nombre], azar = o.azar === undefined ? Math.random() : o.azar;
      return agregar(lista[Math.floor(azar * 977) % lista.length], 1, x, y, z, o.escala || 1, azar, o.mueve === undefined ? 0.05 : o.mueve, false, 0);
    },
    persona: (n, x, y, z, rumbo, azar, escala = 1) => agregar(zonas.gente[n % zonas.gente.length], 6, x, y, z, escala, azar, 0, true, rumbo),
    malla: (sombra = true, brillante = false) => {
      const g = new THREE.InstancedBufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0], 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
      g.setIndex([0, 1, 2, 0, 2, 3]);
      const A = (v, n) => new THREE.InstancedBufferAttribute(new Float32Array(v), n);
      g.setAttribute('aBase', A(base, 3)); g.setAttribute('aTam', A(tam, 2)); g.setAttribute('aUv', A(uv, 4)); g.setAttribute('aDato', A(dato, 4));
      g.instanceCount = base.length / 3;
      // para saber si se ve: una esfera que encierra a todos
      const caja = new THREE.Box3();
      for (let i = 0; i < base.length; i += 3) caja.expandByPoint(new THREE.Vector3(base[i], base[i + 1], base[i + 2]));
      g.boundingSphere = caja.getBoundingSphere(new THREE.Sphere());
      g.boundingSphere.radius += 3;
      const material = brillante ? new THREE.MeshBasicMaterial({ map: textura, alphaTest: 0.5, side: THREE.DoubleSide, color: new THREE.Color(2.6, 2.3, 2.0) })
        : new THREE.MeshLambertMaterial({ map: textura, alphaTest: 0.5, side: THREE.DoubleSide });
      const m = new THREE.Mesh(g, estilo(material, { sprite: true, clave: brillante ? 'luz' : '' }));
      if (brillante) return m;
      if (sombra) {
        m.castShadow = true;
        m.customDepthMaterial = estilo(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: textura, alphaTest: 0.5 }), { sprite: true, soloForma: true });
      }
      m.receiveShadow = true;
      return m;
    },
  };
}

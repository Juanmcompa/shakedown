// La camioneta: cajas con una pintura de pocos pixeles (un pixel = 12,5 cm).
// El centro (0,0,0) es su centro de masa; el frente mira a -Z.
// El dibujo sale de cinco vistas pintadas a mano (de arriba, de abajo, de costado, de frente y de atras):
// cada caja toma de cada vista los pixeles que le tocan segun donde esta.
import * as THREE from 'three';
import { CAMIONETA as C } from './config.js';
import { crearAtlas, crearLote, textura, tono } from './pixel.js';

const PX = 8;   // pixeles por metro
// El modelo entra en una caja de 16 x 13 x 36 pixeles: x de -8 a 8, y de -4 a 9, z de -18 (frente) a 18.

const N = ['#131316', '#1e1f23', '#2c2e33', '#44474e', '#676b73'];   // negros y grises, de oscuro a claro
const METAL = ['#9aa0a8', '#c9ced4'];

// --- pinturas ---
// c: cinco tonos de la carroceria, de oscuro a claro. vidrio: cinco tonos. carga: lleva equipaje. oxido: 0 a 1.
const pintura = (base, mas) => Object.assign({
  c: [tono(base, -0.5), tono(base, -0.24), base, tono(base, 0.3), tono(base, 0.6)],
  vidrio: ['#16212c', '#22364a', '#35546e', '#7fb0cf', '#d4ecf7'],
  luz: '#fff4c2', giro: '#ff9a2e', freno: '#e0322a', carga: true, oxido: 0, velo: null,
}, mas);
export const JUGADOR = pintura('#e2a21e');
// el fantasma de un rival: la misma camioneta, lavada hacia el blanco
const ESPECTRO = pintura('#e2a21e', { velo: 'rgba(226, 240, 255, 0.62)' });
// autos tirados: colores apagados, vidrios con tierra, oxido y sin equipaje
const VIEJOS = ['#6f8fa3', '#b5503a', '#d8d2c2', '#4f7a55', '#8a6f9a'];
export const chatarra = (n) => pintura(VIEJOS[n % VIEJOS.length], {
  vidrio: ['#24231f', '#34322c', '#45423a', '#6b675a', '#8f8a78'], luz: '#8f8a78', giro: '#8a5a2e', freno: '#7a2a24',
  carga: false, oxido: 0.35 + (n % 3) * 0.15, semilla: 11 + n,
});

// --- las vistas ---
function vistaDeArriba(p, q) {
  const A = (x, z, w, l, col) => p.rect(x + 8, z + 18, w, l, col), c = q.c;
  p.fondo(N[1]);
  A(-7, -18, 14, 1, N[2]); A(-4, -18, 8, 1, N[4]);                 // paragolpes y defensa
  A(-7, -17, 14, 10, c[2]); A(-7, -17, 14, 1, c[3]);                // capot
  A(-6, -16, 1, 8, c[3]); A(5, -16, 1, 8, c[3]);                    // lomos de los guardabarros
  A(-7, -15, 1, 8, N[1]); A(6, -15, 1, 8, N[1]);                    // guardabarros negros sobre las ruedas
  A(-3, -15, 6, 6, N[1]); A(-3, -15, 6, 1, N[2]);                   // panel negro antirreflejo
  A(-6, -9, 12, 1, N[2]);                                           // rejilla al pie del parabrisas
  A(-7, -7, 1, 9, c[3]); A(6, -7, 1, 9, c[3]);                      // hombros a los lados de la cabina
  A(-6, -5, 12, 7, c[2]); A(-6, -5, 12, 1, c[3]); A(-6, -5, 1, 7, c[3]); A(5, -5, 1, 7, c[3]); A(-6, 1, 12, 1, c[1]);   // techo
  A(-6, 3, 12, 13, N[1]);                                           // piso de la caja
  for (let i = 0; i < 18; i++) A(-6 + Math.floor(p.azar() * 12), 3 + Math.floor(p.azar() * 13), 1, 1, N[2]);
  A(-7, 2, 1, 15, c[3]); A(6, 2, 1, 15, c[3]); A(-6, 2, 12, 1, c[3]); A(-6, 16, 12, 1, c[3]);   // bordes de la caja
  A(-6, 17, 12, 1, N[2]);                                           // paragolpes de atras
  if (!q.carga) return;
  A(-4, -5, 8, 1, N[1]); for (const x of [-3, -2, 1, 2]) A(x, -5, 1, 1, q.luz);   // barra de luces
  A(-5, -3, 4, 4, '#f07f1e'); A(-5, -2, 4, 1, '#c25f12'); A(-5, 0, 4, 1, '#c25f12'); A(-3, -3, 1, 4, '#9a4a0e');   // planchas de rescate
  A(1, -3, 4, 4, '#56683a'); A(1, -2, 4, 1, '#2c3620'); A(1, 0, 4, 1, '#2c3620'); A(2, -3, 2, 1, '#73894d');       // bolso del techo
  A(-5, 3, 10, 1, '#b02a20'); A(-5, 3, 1, 1, METAL[0]); A(4, 3, 1, 1, METAL[0]); A(-1, 3, 2, 1, N[0]);             // crique
  // rueda de auxilio
  A(-6, 4, 6, 6, '#17171a'); A(-5, 5, 4, 4, '#2a2a2f'); A(-4, 6, 2, 2, METAL[0]); A(-4, 6, 1, 1, METAL[1]); A(-3, 7, 1, 1, N[3]);
  for (const [x, z] of [[-6, 4], [-1, 4], [-6, 9], [-1, 9]]) A(x, z, 1, 1, N[2]);
  // bidones
  A(1, 4, 4, 3, '#d23a2c'); A(2, 4, 1, 3, '#a8281e'); A(4, 4, 1, 3, '#a8281e'); A(1, 4, 1, 1, N[0]); A(3, 4, 1, 1, N[0]); A(1, 5, 4, 1, '#8f1f18');
  // cajon de madera
  A(1, 7, 5, 3, '#a9743f'); A(1, 8, 5, 1, '#7d5228'); A(1, 7, 1, 3, '#c99355'); A(5, 7, 1, 3, '#7d5228');
  // conservadora
  A(-6, 11, 5, 4, '#e9e4d6'); A(-6, 11, 5, 1, '#fbf8f0'); A(-6, 13, 5, 1, '#2f7fb8'); A(-4, 12, 1, 1, N[3]);
  // bolso
  A(0, 11, 6, 5, '#5d6f3c'); A(0, 11, 6, 1, '#7d9150'); A(1, 11, 1, 5, '#3d4a28'); A(4, 11, 1, 5, '#3d4a28'); A(0, 15, 6, 1, '#4a5930');
}

function vistaDeCostado(p, q) {
  const L = (z, y, largo, alto, col) => p.rect(z + 18, 9 - y - alto, largo, alto, col), c = q.c, v = q.vidrio;
  p.fondo(N[0]);
  L(-17, -3, 34, 1, N[2]);                                          // larguero del chasis
  L(-18, -3, 1, 3, N[2]); L(-18, 0, 1, 3, N[3]);                    // paragolpes y defensa
  L(-17, -2, 2, 5, c[2]); L(-17, 2, 2, 1, c[3]); L(-17, -2, 2, 1, c[1]); L(-17, 1, 1, 1, q.giro);   // trompa
  L(-16, -2, 1, 4, N[1]); L(-15, 2, 8, 1, N[1]); L(-7, -2, 1, 4, N[1]);   // guardabarros negro alrededor de la rueda
  L(-6, -2, 8, 5, c[2]); L(-7, 2, 9, 1, c[3]); L(-6, -2, 8, 1, c[1]);     // puerta
  L(1, -1, 1, 3, c[1]); L(-1, 1, 1, 1, N[1]);                       // junta y manija
  for (let k = 0; k < 3; k++) L(-5 + k, -1 + k, 2, 1, c[3]);        // brillo en diagonal
  L(-8, 3, 10, 5, c[2]); L(-8, 7, 10, 1, c[3]); L(1, 3, 1, 4, c[1]);   // cabina
  L(-6, 4, 6, 1, v[1]); L(-5, 5, 5, 2, v[1]);                       // ventanilla
  L(-4, 4, 2, 1, v[3]); L(-3, 5, 2, 1, v[3]); L(-2, 6, 2, 1, v[3]); L(-5, 6, 1, 1, v[4]);   // reflejo
  L(2, -2, 5, 5, c[2]); L(2, -2, 5, 1, c[1]); L(15, -2, 2, 5, c[2]); L(15, -2, 2, 1, c[1]);   // costado de la caja, abajo
  L(6, -2, 1, 4, N[1]); L(7, 2, 8, 1, N[1]); L(15, -2, 1, 4, N[1]);   // guardabarros de atras
  L(2, 3, 15, 2, c[2]); L(2, 4, 15, 1, c[3]);                       // baranda
  L(16, 0, 1, 3, q.freno);                                          // luz de atras
  L(17, -3, 1, 2, N[2]);                                            // paragolpes de atras
  // barro salpicado en la parte de abajo
  for (let i = 0; i < 14; i++) { const z = -17 + Math.floor(p.azar() * 34), y = -2 + Math.floor(p.azar() * 2.4); L(z, y, 1, 1, i % 3 ? '#6b3a22' : '#8a5a36'); }
}

function vistaDeFrente(p, q) {
  const F = (x, y, w, h, col) => p.rect(8 - x - w, 9 - y - h, w, h, col), c = q.c, v = q.vidrio;
  p.fondo(N[0]);
  F(-7, -2, 14, 5, c[2]); F(-7, 2, 14, 1, c[3]); F(-7, -2, 14, 1, c[1]);   // trompa
  F(-4, 0, 8, 2, N[1]); F(-3, 1, 6, 1, METAL[0]); F(-3, 0, 6, 1, N[3]); F(-1, 0, 2, 1, METAL[1]);   // parrilla
  for (const s of [-1, 1]) {   // faros con la luz de giro afuera
    F(s < 0 ? -7 : 6, 0, 1, 2, q.giro); F(s < 0 ? -6 : 5, 0, 1, 2, q.luz); F(s < 0 ? -6 : 5, 0, 1, 1, tono(q.luz, -0.15));
  }
  F(-4, 0, 1, 2, N[4]); F(3, 0, 1, 2, N[4]); F(-4, 2, 8, 1, N[4]);          // defensa
  F(-7, -3, 14, 3, N[2]); F(-7, -1, 14, 1, N[3]);                           // paragolpes
  F(-2, -2, 4, 1, METAL[0]); F(-1, -2, 1, 1, METAL[1]); F(0, -3, 1, 1, q.freno);   // malacate y gancho
  F(-6, -2, 1, 1, q.luz); F(5, -2, 1, 1, q.luz); F(-4, -3, 1, 1, q.freno); F(3, -3, 1, 1, q.freno);   // antinieblas y grilletes
  F(-6, 3, 12, 5, c[2]); F(-6, 7, 12, 1, c[3]);                             // marco del parabrisas
  F(-5, 3, 10, 4, v[1]); F(-5, 6, 10, 1, v[0]);                             // vidrio
  for (let k = 0; k < 4; k++) { F(-3 + k, 3 + k, 2, 1, v[3]); F(2 + k, 3 + k, 1, 1, v[2]); }   // reflejos
  F(-4, 5, 1, 1, v[4]);
  F(-4, 3, 2, 1, N[0]); F(1, 3, 2, 1, N[0]);                                // limpiaparabrisas
  if (q.carga) { F(-4, 8, 8, 1, N[1]); for (const x of [-3, -2, 1, 2]) F(x, 8, 1, 1, q.luz); }   // barra de luces
}

function vistaDeAtras(p, q) {
  const T = (x, y, w, h, col) => p.rect(x + 8, 9 - y - h, w, h, col), c = q.c, v = q.vidrio;
  p.fondo(N[0]);
  T(-1, -4, 2, 1, N[3]);                                                    // diferencial
  T(-6, 5, 12, 3, c[2]); T(-6, 7, 12, 1, c[3]);                             // espalda de la cabina
  T(-4, 5, 8, 2, v[1]); T(-2, 5, 2, 1, v[3]); T(-1, 6, 2, 1, v[3]); T(2, 6, 1, 1, v[4]);   // luneta
  T(-7, -2, 14, 7, c[2]); T(-7, 4, 14, 1, c[3]); T(-7, -2, 14, 1, c[1]);    // porton
  T(-5, 0, 10, 2, c[1]); for (const x of [-4, -2, 1, 3]) T(x, 1, 1, 1, c[4]);   // panel con la marca
  T(-1, 3, 2, 1, N[1]);                                                     // manija
  for (const x of [-7, 5]) { T(x, 0, 2, 4, q.freno); T(x, 0, 2, 1, q.giro); T(x < 0 ? -7 : 6, 3, 1, 1, tono(q.freno, 0.35)); }   // luces
  T(-6, -3, 12, 2, N[2]); T(-6, -2, 12, 1, N[3]);                           // paragolpes
  T(-2, -3, 4, 1, '#f4f0e6'); T(-1, -3, 1, 1, N[1]); T(1, -3, 1, 1, N[1]);  // patente
}

// la panza: se ve en los autos volcados y cuando la camioneta queda patas para arriba
function vistaDeAbajo(p, q) {
  const B = (x, z, w, l, col) => p.rect(8 - x - w, z + 18, w, l, col), c = q.c;
  p.fondo(N[0]);
  B(-7, -17, 1, 34, c[0]); B(6, -17, 1, 34, c[0]);                          // zocalos de la carroceria
  B(-4, -16, 1, 33, N[2]); B(3, -16, 1, 33, N[2]);                          // largueros del chasis
  for (const z of [-16, -6, 2, 9, 16]) B(-3, z, 6, 1, N[1]);                // travesaños
  B(-2, -15, 4, 3, METAL[0]); B(-2, -15, 4, 1, METAL[1]);                   // carter
  B(-1, -11, 2, 4, N[3]);                                                   // caja de cambios
  B(0, -7, 1, 17, N[4]);                                                    // cardan
  B(-6, -12, 12, 1, N[3]); B(-1, -13, 2, 3, N[4]);                          // eje de adelante y su diferencial
  B(-6, 11, 12, 1, N[3]); B(-1, 10, 2, 3, N[4]);                            // eje de atras y su diferencial
  B(-3, 3, 2, 5, N[3]); B(-3, 3, 2, 1, N[4]);                               // tanque de nafta
  B(2, -9, 1, 22, '#6b4a36'); B(1, 13, 2, 3, '#7d7a72'); B(1, 13, 2, 1, '#9a968c');   // escape y silenciador
  for (let i = 0; i < 26; i++) B(-7 + Math.floor(p.azar() * 14), -17 + Math.floor(p.azar() * 34), 1, 1, i % 3 ? '#5a3220' : '#7a4a2c');   // barro pegado
}

// --- las cajas: [x0, y0, z0, x1, y1, z1, opciones], en pixeles ---
// opciones.liso: color para todas las caras. lados: color para las cuatro de costado. caras: color para algunas.
const CAJAS = [
  [-5, -4, -16, 5, 2, 17],                                        // chasis
  [-7, -2, -17, 7, 3, -15, { caras: { pz: N[0] } }],              // trompa
  [-7, 2, -15, 7, 3, -7],                                         // capot sobre las ruedas de adelante
  [-7, -2, -7, 7, 3, 2, { caras: { nz: N[0] } }],                 // puertas
  [-6, 3, -8, 6, 8, 2, { cuña: 3 }],                              // cabina, con el parabrisas inclinado
  [-7, -2, 2, 7, 2, 7, { caras: { pz: N[0] } }],                  // costados de la caja, entre la cabina y la rueda
  [-7, -2, 15, 7, 2, 17, { caras: { nz: N[0] } }],                // cola
  [-7, 2, 2, 7, 3, 17],                                           // piso de la caja
  [-7, 3, 2, -6, 5, 17], [6, 3, 2, 7, 5, 17],                     // barandas
  [-6, 3, 2, 6, 5, 3, { caras: { pz: N[2] } }],                   // frente de la caja
  [-6, 3, 16, 6, 5, 17, { caras: { nz: N[2] } }],                 // porton
  [-7, 5, 2, -6, 9, 3, { liso: N[1] }], [6, 5, 2, 7, 9, 3, { liso: N[1] }], [-6, 8, 2, 6, 9, 3, { liso: N[1] }],   // jaula antivuelco
  [-6, -3, 17, 6, -1, 18],                                        // paragolpes de atras
  [-7, -3, -18, 7, 0, -17],                                       // paragolpes de adelante
  [-4, 0, -18, -3, 2, -17], [3, 0, -18, 4, 2, -17], [-4, 2, -18, 4, 3, -17],   // defensa
  [-8, 4, -6, -6, 5, -5, { liso: N[1] }], [6, 4, -6, 8, 5, -5, { liso: N[1] }],   // espejos
  [6, 3, -8, 7, 9, -7, { liso: N[1] }],                           // snorkel
];
const CARGA = [
  [-4, 8, -5, 4, 9, -4, { caras: { px: N[1], nx: N[1], pz: N[1] } }],   // barra de luces
  [-5, 8, -3, -1, 9, 1, { lados: '#c25f12' }],                    // planchas de rescate
  [1, 8, -3, 5, 9, 1, { lados: '#3d4a28' }],                      // bolso del techo
  [-6, 3, 4, 0, 5, 10, { lados: '#17171a' }],                     // rueda de auxilio
  [1, 3, 4, 3, 7, 7, { lados: '#b02a20' }], [3, 3, 4, 5, 7, 7, { lados: '#9c241b' }],   // bidones
  [1, 3, 7, 6, 5, 10, { lados: '#8a5a30' }],                      // cajon de madera
  [-6, 3, 11, -1, 6, 15, { lados: '#d8d2c2' }],                   // conservadora
  [0, 3, 11, 6, 5, 16, { lados: '#4a5930' }],                     // bolso
];

// Pinta las vistas y arma la forma. Se guarda: dos camionetas con la misma pintura comparten todo.
const hechos = new Map();
function modelo(q) {
  if (hechos.has(q)) return hechos.get(q);
  const atlas = crearAtlas(128, 64), s = q.semilla || 3;
  const vistas = {
    py: atlas.zona(16, 36, (p) => vistaDeArriba(p, q), s),
    ny: atlas.zona(16, 36, (p) => vistaDeAbajo(p, q), s),
    px: atlas.zona(36, 13, (p) => vistaDeCostado(p, q), s),
    nz: atlas.zona(16, 13, (p) => vistaDeFrente(p, q), s),
    pz: atlas.zona(16, 13, (p) => vistaDeAtras(p, q), s),
  };
  vistas.nx = vistas.px;
  // donde cae cada punto de la camioneta en cada vista
  const enVista = { px: (e) => [e.z + 18, 9 - e.y], py: (e) => [e.x + 8, e.z + 18], ny: (e) => [8 - e.x, e.z + 18], nz: (e) => [8 - e.x, 9 - e.y], pz: (e) => [e.x + 8, 9 - e.y] };
  enVista.nx = enVista.px;
  const lote = crearLote(), m = new THREE.Matrix4().makeScale(1 / PX, 1 / PX, 1 / PX);
  for (const b of q.carga ? CAJAS.concat(CARGA) : CAJAS) {
    const o = b[6] || {};
    lote.caja(m, b, (cara, e) => {
      const color = o.liso || (o.caras && o.caras[cara]) || (cara[1] !== 'y' && o.lados);
      if (color) { const z = atlas.liso(color); return [z.x + 0.5, z.y + 0.5]; }
      const en = enVista[cara](e);
      return [vistas[cara].x + en[0], vistas[cara].y + en[1]];
    }, o.cuña);
  }
  // el oxido y la tierra se pintan encima de todo
  if (q.oxido || q.velo) {
    const x = atlas.lienzo.getContext('2d'), r = (() => { let a = s * 7919; return () => ((a = (a * 1664525 + 1013904223) >>> 0) / 4294967296); })();
    for (const z of new Set(Object.values(vistas))) {
      for (let i = 0; i < z.w * z.h * q.oxido * 0.3; i++) {
        x.fillStyle = ['#8a4a22', '#5e3216', '#a8622c', '#6b4a36'][Math.floor(r() * 4)];
        x.fillRect(z.x + Math.floor(r() * z.w), z.y + Math.floor(r() * z.h), r() < 0.3 ? 2 : 1, 1);
      }
    }
    if (q.velo) { x.fillStyle = q.velo; x.fillRect(0, 0, atlas.ancho, atlas.alto); }
  }
  const hecho = { atlas, geo: lote.geometria(atlas), mat: new THREE.MeshLambertMaterial({ map: atlas.textura() }) };
  hechos.set(q, hecho);
  return hecho;
}

// --- ruedas: un prisma de diez lados con la llanta pintada ---
let rueda = null;
function piezasDeRueda() {
  if (rueda) return rueda;
  const cara = textura(8, 8, (p) => {
    p.fondo('#17171a');
    p.rect(2, 1, 4, 6, '#26262b'); p.rect(1, 2, 6, 4, '#26262b');
    p.rect(3, 2, 2, 4, METAL[0]); p.rect(2, 3, 4, 2, METAL[0]);
    p.rect(3, 3, 1, 1, METAL[1]); p.rect(4, 4, 1, 1, METAL[1]); p.rect(4, 3, 1, 1, N[3]); p.rect(3, 4, 1, 1, N[3]);
  });
  const banda = textura(24, 3, (p) => {
    p.fondo('#1a1a1d');
    for (let i = 0; i < 24; i += 4) { p.rect(i, 0, 2, 1, '#34343a'); p.rect(i + 2, 1, 2, 1, '#34343a'); p.rect(i, 2, 2, 1, '#34343a'); }
    p.motas('#5a3a26', 5);
  });
  const mCara = new THREE.MeshLambertMaterial({ map: cara });
  rueda = { geo: new THREE.CylinderGeometry(C.radio, C.radio, 0.375, 10).rotateZ(Math.PI / 2), mat: [new THREE.MeshLambertMaterial({ map: banda }), mCara, mCara] };
  return rueda;
}

// Arma una camioneta con la pintura pedida. La usan la del jugador, el fantasma y los autos tirados.
export function armarCamioneta(q = JUGADOR) {
  const grupo = new THREE.Group(), { geo, mat } = modelo(q), r = piezasDeRueda();
  const cuerpo = new THREE.Mesh(geo, mat);
  cuerpo.castShadow = true;
  grupo.add(cuerpo);
  // ruedas: un pivote que dobla y adentro la rueda que gira
  const ruedas = [];
  for (let i = 0; i < 4; i++) {
    const pivote = new THREE.Group(), goma = new THREE.Mesh(r.geo, r.mat);
    goma.castShadow = true;
    pivote.add(goma);
    pivote.position.set((i % 2 ? 1 : -1) * C.trocha * 1.06, C.anclaje - 0.43, (i < 2 ? -1 : 1) * C.ejes);
    grupo.add(pivote);
    ruedas.push({ pivote, rueda: goma });
  }
  return { grupo, ruedas, cuerpo };
}

export function crearDibujo(escena) {
  const { grupo, ruedas } = armarCamioneta();
  escena.add(grupo);

  function actualizar(c) {
    grupo.position.fromArray(c.pos);
    grupo.quaternion.fromArray(c.q);
    c.ruedas.forEach((r, i) => {
      ruedas[i].pivote.position.set(r.x * 1.06, C.anclaje - r.largo, r.z);
      ruedas[i].pivote.rotation.y = r.delantera ? -c.giroRuedas : 0;
      ruedas[i].rueda.rotation.x = -r.giro;
    });
  }
  return { grupo, actualizar };
}

// El fantasma del rival: la misma camioneta, translucida y sin sombra, con su nombre arriba.
export function crearEspectro(escena, T) {
  const { grupo, ruedas, cuerpo } = armarCamioneta(ESPECTRO);
  // primero se marca la silueta y despues se pinta una sola vez: asi no se ven las cajas de adentro
  const silueta = new THREE.MeshBasicMaterial({ colorWrite: false });
  const encima = { transparent: true, opacity: 0.6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 };
  const velo = new THREE.MeshBasicMaterial({ map: cuerpo.material.map, ...encima }), gomas = new THREE.MeshBasicMaterial({ color: 0xdfeaf2, ...encima });
  const capas = [];
  grupo.traverse((o) => { if (o.isMesh) capas.push(o); });
  for (const o of capas) {
    const capa = new THREE.Mesh(o.geometry, o === cuerpo ? velo : gomas);
    o.material = silueta; o.castShadow = false; o.renderOrder = 3;
    capa.renderOrder = 4;
    o.add(capa);
  }
  const lienzo = document.createElement('canvas');
  lienzo.width = 256; lienzo.height = 64;
  const tex = new THREE.CanvasTexture(lienzo);
  tex.colorSpace = THREE.SRGBColorSpace;
  const cartel = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  cartel.scale.set(7, 1.75, 1);
  cartel.position.y = 3.4;
  cartel.renderOrder = 5;
  grupo.add(cartel);
  grupo.visible = false;
  escena.add(grupo);
  const V = new THREE.Vector3(), Q = new THREE.Quaternion(), ARRIBA = new THREE.Vector3(0, 1, 0);
  return {
    nombre: (txt) => {
      const x = lienzo.getContext('2d');
      x.clearRect(0, 0, 256, 64);
      x.font = '700 34px "Barlow Condensed", "Arial Narrow", sans-serif';
      const w = Math.min(244, x.measureText(txt).width + 28);
      x.fillStyle = 'rgba(0, 0, 0, .78)';
      x.fillRect(128 - w / 2, 8, w, 48);
      x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(txt, 128, 33, 232);
      tex.needsUpdate = true;
    },
    // lo apoya sobre el terreno en la posicion y el rumbo grabados
    poner: (o) => {
      const sx = (T.altura(o.x + 1, o.z) - T.altura(o.x - 1, o.z)) / 2, sz = (T.altura(o.x, o.z + 1) - T.altura(o.x, o.z - 1)) / 2;
      V.set(-sx, 1, -sz).normalize();
      grupo.quaternion.setFromUnitVectors(ARRIBA, V).multiply(Q.setFromAxisAngle(ARRIBA, -o.rumbo));
      grupo.position.set(o.x, T.altura(o.x, o.z) + 0.8, o.z);
      for (const r of ruedas) r.pivote.rotation.y = 0;
      grupo.visible = true;
    },
    ocultar: () => { grupo.visible = false; },
  };
}

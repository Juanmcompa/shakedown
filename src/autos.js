// Los autos: cajas con una pintura de pocos pixeles (un pixel = 12,5 cm). El frente mira a -Z.
// Hay cinco modelos para correr o de adorno: la Vitarita, el Kacito, el buggy (de arena, con jaula) y el camion (de rally
// raid, con caja de lona), mas la chata (estacionada, de adorno). Los modelos grandes piden un atlas mas grande ("atlas").
// El dibujo de cada uno sale de cinco vistas pintadas a mano (de arriba, de abajo, de costado, de frente y de atras):
// cada caja toma de cada vista los pixeles que le tocan segun donde esta.
//
// Para cambiar un auto: sus colores estan en PINTURAS, su forma en "cajas" y sus dibujos en "vistas".
import * as THREE from '../vendor/three.module.js';
import { crearAtlas, crearLote, textura, tono } from './pixel.js';
import { conEstilo } from './material.js';
import { SUELO, SUELOS } from './config.js';

const PX = 8;   // pixeles por metro
const N = ['#131316', '#1e1f23', '#2c2e33', '#44474e', '#676b73'];   // negros y grises, de oscuro a claro
const METAL = ['#9aa0a8', '#c9ced4'], GOMA = '#17171a', BLANCO = '#f4f0e6', ROJO = '#d8402f';
const BARRO = ['#6b3a22', '#8a5a36', '#5a3220'];

// --- pinturas ---
// c: cinco tonos de la carroceria, de oscuro a claro.  vidrio: cinco tonos.  numero: el que lleva en las puertas y el techo.
// rally: lleva faros, numeros y barreros.  carga: (la chata) lleva equipaje.  oxido: 0 a 1.  velo: color que lo lava entero (el fantasma).
const pintura = (base, mas) => Object.assign({
  c: [tono(base, -0.5), tono(base, -0.24), base, tono(base, 0.3), tono(base, 0.6)],
  vidrio: ['#16212c', '#22364a', '#35546e', '#7fb0cf', '#d4ecf7'],
  luz: '#fff4c2', giro: '#ff9a2e', freno: '#e0322a', rally: true, carga: false, oxido: 0, velo: null, numero: '', franjas: ['#1fb5a6', '#e0409a'],
}, mas);
const PINTURAS = {
  vitarita: pintura('#f0b41c', { numero: '92' }),                        //
  kacito: pintura('#8656c8', { numero: '97', franjas: ['#f2c200', '#f4f0e6'] }),   //
  chata: pintura('#e2a21e', { carga: true }),                            //
  buggy: pintura('#c8302a', { numero: '7', franjas: ['#f4f0e6', '#1e1f23'] }),     // rojo de rally, jaula negra
  camion: pintura('#e8b81c', { numero: '3', franjas: ['#1e1f23', '#f4f0e6'] }),    // cabina amarilla, lona caqui
  carguero: pintura('#c9561f', { numero: '6', franjas: ['#1e1f23', '#f4f0e6'] }),  // cabina naranja, caja de tablas
  f1: pintura('#e01818', { numero: '1', franjas: ['#ffffff', '#000000'] }), // Nuevo auto F1
};
const VELO = 'rgba(226, 240, 255, 0.62)';
// autos del publico, estacionados: colores de calle, sin numeros ni faros de rally
const DE_CALLE = ['#6f8fa3', '#b5503a', '#d8d2c2', '#4f7a55', '#8a6f9a', '#2f4f7a', '#c9c2b0', '#7a2f2a', '#3d3f45'];
const calle = new Map();
const deCalle = (n) => calle.get(n) || calle.set(n, pintura(DE_CALLE[n % DE_CALLE.length], { rally: false, semilla: 11 + n })).get(n);

// --- herramientas para pintar una vista con las medidas del auto ---
//   A(x, z, ancho, largo, color)   de arriba        B(...)  de abajo
//   L(z, y, largo, alto, color)    de costado       F(x, y, ancho, alto, color)  de frente       T(...)  de atras
const lapices = (p, M) => ({
  A: (x, z, w, l, col) => p.rect(x + M.W / 2, z + M.L / 2, w, l, col),
  B: (x, z, w, l, col) => p.rect(M.W / 2 - x - w, z + M.L / 2, w, l, col),
  L: (z, y, largo, alto, col) => p.rect(z + M.L / 2, M.Y1 - y - alto, largo, alto, col),
  F: (x, y, w, h, col) => p.rect(M.W / 2 - x - w, M.Y1 - y - h, w, h, col),
  T: (x, y, w, h, col) => p.rect(x + M.W / 2, M.Y1 - y - h, w, h, col),
});
// numeros de 3 x 5 pixeles. "punto(columna, fila)" pinta un pixel. espejo: se escribe al reves (para el costado derecho).
const CIFRAS = { 0: '111101101101111', 1: '010110010010111', 2: '110001010100111', 3: '110001010001110', 4: '101101111001001', 5: '111100110001110', 6: '011100110101010', 7: '111001010010010', 8: '010101010101010', 9: '010101011001110' };
// los mismos, de 3 x 4, para donde no entran los otros
const CIFRAS_BAJAS = { 0: '111101101111', 1: '010110010111', 2: '110001110111', 3: '111011001111', 4: '101101111001', 5: '111110001110', 6: '100111101111', 7: '111001010010', 8: '111111101111', 9: '111101111001' };
function cifras(texto, punto, espejo, bajas) {
  const ancho = texto.length * 4 - 1, tabla = bajas ? CIFRAS_BAJAS : CIFRAS;
  [...texto].forEach((letra, k) => {
    const d = tabla[letra] || tabla[0];
    for (let i = 0; i < d.length; i++) if (d[i] === '1') { const x = k * 4 + i % 3; punto(espejo ? ancho - 1 - x : x, Math.floor(i / 3)); }
  });
}
const salpicar = (p, cuantas, donde) => { for (let i = 0; i < cuantas; i++) donde(BARRO[i % 3], p.azar(), p.azar()); };

// ================= LA VITARITA: 4x4 del 92, corta, alta y cuadrada =================
const VITARITA = {
  W: 14, L: 30, Y0: -4, Y1: 9, rueda: 0.375, frenos: [[-5, -2, 14.1, 2, 2], [5, -2, 14.1, 2, 2]],   // luces de freno: [x, y, z, ancho, alto]
  // [x0, y0, z0, x1, y1, z1, opciones]   opciones: liso (un color para todo), caras (color para algunas), cuña
  cajas: (q) => [
    [-5, -4, -13, 5, -3, 13],                                        // chasis
    [-6, -3, -13, 6, 2, 13],                                         // carroceria, hasta la cintura
    [-7, -1, -13, 7, 1, -5, { liso: N[1] }], [-7, -1, 5, 7, 1, 13, { liso: N[1] }],   // guardabarros negros
    [-6, 2, -6, 6, 8, 13, { cuña: 2 }],                              // cabina, con el parabrisas apenas inclinado
    [-6, -3, -14, 6, -1, -13], [-6, -3, 13, 6, -1, 14],              // paragolpes
    [0, -1, 13, 6, 5, 15, { caras: { px: GOMA, nx: GOMA, ny: GOMA } }],   // rueda de auxilio, en el porton
    [-8, 3, -5, -6, 4, -4, { liso: N[1] }], [6, 3, -5, 8, 4, -4, { liso: N[1] }],   // espejos
    [6, 2, -7, 7, 8, -6, { liso: N[1] }],                            // snorkel
    ...(q.rally ? [
      [-5, -1, -15, -3, 1, -14, { caras: { px: N[1], nx: N[1], py: N[2], ny: N[0] } }], [3, -1, -15, 5, 1, -14, { caras: { px: N[1], nx: N[1], py: N[2], ny: N[0] } }],   // faros de rally
      [-4, 8, -4, 4, 9, -3, { caras: { px: N[1], nx: N[1], pz: N[1] } }],   // barra de luces en el techo
      [-7, -4, 12, -5, -2, 13, { liso: ROJO }], [5, -4, 12, 7, -2, 13, { liso: ROJO }],   // barreros
    ] : []),
  ],
  vistas: {
    arriba: ({ A }, q, p) => {
      const c = q.c;
      p.fondo(N[1]);
      A(-6, -14, 12, 1, N[2]); A(-3, -14, 6, 1, N[3]);                                   // paragolpes
      A(-6, -13, 12, 7, c[2]); A(-6, -13, 12, 1, c[3]); A(-6, -12, 1, 6, c[3]); A(5, -12, 1, 6, c[1]);   // capot
      A(-3, -12, 6, 4, N[1]); A(-3, -12, 6, 1, N[2]);                                    // panel negro antirreflejo
      A(-6, -7, 12, 1, N[2]);                                                            // rejilla al pie del parabrisas
      A(-6, -4, 12, 17, c[2]); A(-6, -4, 12, 1, c[3]); A(-6, -4, 1, 17, c[3]); A(5, -4, 1, 17, c[1]); A(-6, 12, 12, 1, c[1]);   // techo
      A(0, 13, 6, 2, GOMA); A(1, 13, 1, 2, N[2]); A(3, 13, 1, 2, N[2]); A(5, 13, 1, 2, N[2]);   // rueda de auxilio
      A(-6, 13, 6, 1, N[2]);                                                             // paragolpes de atras
      if (!q.rally) { A(-4, -2, 8, 1, c[1]); A(-4, 9, 8, 1, c[1]); return; }             // de calle: dos nervios en el techo
      A(-5, -15, 2, 1, N[2]); A(3, -15, 2, 1, N[2]);                                     // faros de rally
      A(-4, -4, 8, 1, N[1]); for (const x of [-3, -2, 1, 2]) A(x, -4, 1, 1, q.luz);      // barra de luces
      A(-5, -1, 10, 9, BLANCO); A(-5, 7, 10, 1, '#d6d2c6');                              // panel blanco con el numero
      cifras(q.numero, (x, y) => A(-3 + x, 1 + y, 1, 1, N[0]));
      A(-6, 9, 12, 1, q.franjas[0]); A(-6, 10, 12, 1, q.franjas[1]);                     // franjas
    },
    abajo: ({ B }, q, p) => {
      p.fondo(N[0]);
      B(-6, -13, 1, 26, q.c[0]); B(5, -13, 1, 26, q.c[0]);                               // zocalos
      B(-4, -12, 1, 25, N[2]); B(3, -12, 1, 25, N[2]);                                   // largueros
      for (const z of [-12, -4, 3, 12]) B(-3, z, 6, 1, N[1]);                            // travesaños
      B(-3, -13, 6, 4, METAL[0]); B(-3, -13, 6, 1, METAL[1]);                            // chapon del carter
      B(0, -6, 1, 15, N[4]); B(-5, -9, 10, 1, N[3]); B(-1, -10, 2, 3, N[4]); B(-5, 9, 10, 1, N[3]); B(-1, 8, 2, 3, N[4]);   // cardan, ejes y diferenciales
      B(2, -6, 1, 18, '#6b4a36'); B(1, 11, 2, 2, '#7d7a72');                             // escape
      salpicar(p, 22, (col, a, b) => B(-6 + Math.floor(a * 12), -13 + Math.floor(b * 26), 1, 1, col));
    },
    costado: ({ L }, q, p, espejo) => {
      const c = q.c, v = q.vidrio;
      p.fondo(N[0]);
      L(-13, -4, 26, 1, N[2]);                                                           // chasis
      L(-13, -3, 26, 5, c[2]); L(-13, 1, 26, 1, c[3]); L(-13, -3, 26, 1, c[1]);          // carroceria
      L(-14, -3, 1, 2, N[2]); L(13, -3, 1, 2, N[2]);                                     // paragolpes
      L(-13, 0, 1, 1, q.giro); L(12, 0, 1, 1, q.freno);                                  // luces de las esquinas
      L(-5, -3, 1, 5, c[1]); L(4, -3, 1, 4, c[1]); L(2, 0, 1, 1, N[1]);                  // puerta y manija
      L(-6, 2, 19, 6, c[2]); L(-6, 7, 19, 1, c[3]);                                      // cabina
      L(-4, 3, 7, 4, v[1]); L(-3, 5, 2, 1, v[3]); L(-2, 4, 2, 1, v[3]); L(1, 6, 1, 1, v[4]);   // ventanilla
      L(4, 3, 7, 4, v[1]); L(5, 5, 2, 1, v[3]); L(6, 4, 2, 1, v[3]); L(9, 6, 1, 1, v[4]);      // ventana de atras
      L(13, -1, 2, 6, GOMA); L(13, 4, 2, 1, N[2]);                                       // rueda de auxilio
      if (q.rally) {
        L(5, 1, 8, 1, q.franjas[0]); L(-13, 1, 8, 1, q.franjas[1]);                      // franjas sobre los guardabarros
        L(-4, -3, 8, 5, BLANCO);                                                         // la puerta, blanca, con el numero
        cifras(q.numero, (x, y) => L(-3 + x, 1 - y, 1, 1, N[0]), espejo);
        L(-15, -1, 1, 2, N[1]); L(-4, 8, 1, 1, N[1]);                                    // faro de rally y barra de luces, de canto
      }
      L(-12, -3, 6, 2, N[0]); L(6, -3, 6, 2, N[0]);                                      // pasos de rueda
      L(-13, -1, 8, 2, N[1]); L(5, -1, 8, 2, N[1]);                                      // guardabarros
      salpicar(p, 12, (col, a, b) => { const z = -13 + Math.floor(a * 26); if (z < -4 || z > 3) L(z, -3 + Math.floor(b * 2.2), 1, 1, col); });   // barro, menos en la puerta
    },
    frente: ({ F }, q, p) => {
      const c = q.c, v = q.vidrio;
      p.fondo(N[0]);
      F(-3, -4, 6, 1, METAL[0]);                                                         // chapon
      F(-6, -3, 12, 2, N[2]); F(-6, -2, 12, 1, N[3]);                                    // paragolpes
      F(-6, -1, 12, 3, c[2]); F(-6, 1, 12, 1, c[3]);                                     // trompa
      F(-3, -1, 6, 2, N[1]); F(-2, 0, 4, 1, N[3]); F(-1, 0, 2, 1, METAL[1]);             // parrilla
      F(-6, 0, 2, 1, q.luz); F(4, 0, 2, 1, q.luz); F(-6, -1, 2, 1, q.giro); F(4, -1, 2, 1, q.giro);   // faros y luces de giro
      F(-6, 2, 12, 6, c[2]); F(-6, 7, 12, 1, c[3]);                                      // marco del parabrisas
      F(-5, 2, 10, 5, v[1]); F(-5, 6, 10, 1, v[0]);                                      // vidrio
      for (let k = 0; k < 4; k++) { F(-3 + k, 2 + k, 2, 1, v[3]); F(2 + k, 2 + k, 1, 1, v[2]); }   // reflejos
      F(-4, 2, 2, 1, N[0]); F(1, 2, 2, 1, N[0]);                                         // limpiaparabrisas
      if (!q.rally) return;
      for (const x of [-5, 3]) { F(x, -1, 2, 2, '#ffd23a'); F(x + 1, 0, 1, 1, '#fff1a8'); F(x, -1, 1, 1, '#d9a400'); }   // faros de rally, con su tapa amarilla
      F(-4, 8, 8, 1, N[1]); for (const x of [-3, -2, 1, 2]) F(x, 8, 1, 1, q.luz);        // barra de luces
    },
    atras: ({ T }, q, p) => {
      const c = q.c, v = q.vidrio;
      p.fondo(N[0]);
      T(-1, -4, 2, 1, N[3]);                                                             // diferencial
      T(-6, -3, 12, 2, N[2]); T(-6, -2, 12, 1, N[3]);                                    // paragolpes
      T(-6, -3, 2, 2, q.freno); T(4, -3, 2, 2, q.freno); T(-6, -2, 1, 1, q.giro); T(5, -2, 1, 1, q.giro);   // luces, en el paragolpes
      T(-4, -3, 3, 1, BLANCO);                                                           // patente
      T(-6, -1, 12, 9, c[2]); T(-6, 7, 12, 1, c[3]); T(-6, -1, 12, 1, c[1]);             // porton
      T(-5, 3, 10, 4, v[1]); T(-4, 5, 2, 1, v[3]); T(-3, 4, 2, 1, v[3]);                 // luneta
      T(-5, 0, 4, 2, c[1]); T(-4, 1, 2, 1, c[4]);                                        // la marca
      T(0, -1, 6, 6, GOMA); T(1, 0, 4, 4, '#26262b'); T(2, 1, 2, 2, METAL[0]); T(2, 2, 1, 1, METAL[1]);   // rueda de auxilio
      for (const [x, y] of [[0, -1], [5, -1], [0, 4], [5, 4]]) T(x, y, 1, 1, N[0]);
    },
  },
};

// ================= EL KACITO: chiquito, redondeado, con los paragolpes grises y el chapon =================
const PLASTICO = ['#26282d', '#383b42', '#4c5058'];
const KACITO = {
  W: 14, L: 30, Y0: -3, Y1: 8, rueda: 0.25, frenos: [[-5.5, 1, 13.1, 1, 2], [5.5, 1, 13.1, 1, 2]],
  cajas: (q) => [
    [-5, -3, -12, 5, -2, 13],                                        // piso
    [-6, -2, -13, 6, 2, 13],                                         // carroceria, hasta la cintura
    [-7, -2, -14, 7, 0, -7], [-7, -2, 7, 7, 0, 14],                  // paragolpes que envuelven los pasarruedas
    [-6, 2, -8, 6, 6, 12, { cuña: 4, cuñaAtras: 3 }],                // cabina: parabrisas muy tendido y porton inclinado
    [-5, 6, -4, 5, 7, 9, { cuña: 1, cuñaAtras: 1 }],                 // techo
    [-8, 3, -5, -6, 4, -4, { liso: q.c[1] }], [6, 3, -5, 8, 4, -4, { liso: q.c[1] }],   // espejos
    ...(q.rally ? [
      [-5, -3, -15, 5, -2, -12],                                     // el chapon, que asoma por delante
      [-6, 2, -13, -4, 4, -12, { caras: { px: N[1], nx: N[1], py: N[2], pz: N[0] } }], [-3, 2, -13, -1, 4, -12, { caras: { px: N[1], nx: N[1], py: N[2], pz: N[0] } }],   // cuatro faros de rally sobre el capot
      [1, 2, -13, 3, 4, -12, { caras: { px: N[1], nx: N[1], py: N[2], pz: N[0] } }], [4, 2, -13, 6, 4, -12, { caras: { px: N[1], nx: N[1], py: N[2], pz: N[0] } }],
      [-2, 7, -3, 2, 8, 0, { caras: { px: N[1], nx: N[1], py: N[2], pz: N[1], nz: N[0] } }],   // toma de aire del techo
      [-7, -3, 13, -5, -2, 14, { liso: ROJO }], [5, -3, 13, 7, -2, 14, { liso: ROJO }],   // barreros
    ] : []),
  ],
  vistas: {
    arriba: ({ A }, q, p) => {
      const c = q.c, g = PLASTICO;
      p.fondo(N[1]);
      A(-7, -14, 14, 7, g[1]); A(-7, -14, 14, 1, g[2]); A(-7, 7, 14, 7, g[1]); A(-7, 13, 14, 1, g[0]);   // paragolpes y pasarruedas
      A(-6, -13, 12, 6, c[2]); A(-6, -13, 12, 1, c[3]); A(-6, -12, 1, 5, c[3]); A(5, -12, 1, 5, c[1]);  // capot
      A(-6, -13, 3, 2, q.luz); A(3, -13, 3, 2, q.luz); A(-5, -12, 1, 1, '#ffffff'); A(4, -12, 1, 1, '#ffffff');   // faros, grandes, en las esquinas
      A(-3, -10, 6, 1, c[1]);                                                            // nervio del capot
      A(-6, -8, 12, 1, N[2]);                                                            // rejilla al pie del parabrisas
      A(-6, 12, 12, 1, c[2]);                                                            // cola
      A(-5, -3, 10, 12, c[2]); A(-5, -3, 10, 1, c[3]); A(-5, -3, 1, 12, c[3]); A(4, -3, 1, 12, c[1]); A(-5, 8, 10, 1, c[1]);   // techo
      if (!q.rally) return;
      A(-5, -15, 10, 1, METAL[0]); A(-4, -15, 1, 1, N[3]); A(3, -15, 1, 1, N[3]);        // el chapon
      for (const x of [-6, -3, 1, 4]) A(x, -13, 2, 1, N[2]);                             // faros de rally
      A(-2, -3, 4, 3, N[2]);                                                             // toma de aire
      A(-4, 1, 8, 7, BLANCO);                                                            // panel blanco con el numero
      cifras(q.numero, (x, y) => A(-3 + x, 2 + y, 1, 1, N[0]));
    },
    abajo: ({ B }, q, p) => {
      p.fondo(N[0]);
      B(-6, -13, 1, 26, q.c[0]); B(5, -13, 1, 26, q.c[0]);
      B(-5, -15, 10, 6, METAL[0]); B(-5, -15, 10, 1, METAL[1]); for (const [x, z] of [[-4, -14], [3, -14], [-4, -11], [3, -11]]) B(x, z, 1, 1, N[3]);   // el chapon, con sus bulones
      B(-5, -10, 10, 1, N[3]); B(-5, 10, 10, 1, N[3]);                                   // ejes
      B(-2, -4, 4, 12, N[1]); B(2, -8, 1, 21, '#6b4a36'); B(1, 12, 2, 2, '#7d7a72');     // tunel y escape
      salpicar(p, 20, (col, a, b) => B(-6 + Math.floor(a * 12), -9 + Math.floor(b * 22), 1, 1, col));
    },
    costado: ({ L }, q, p, espejo) => {
      const c = q.c, v = q.vidrio, g = PLASTICO;
      p.fondo(N[0]);
      L(-12, -3, 25, 1, N[2]);                                                           // piso
      L(-13, -2, 26, 4, c[2]); L(-13, 1, 26, 1, c[3]); L(-7, -2, 14, 1, c[1]);           // carroceria
      L(-14, -2, 7, 2, g[1]); L(-14, -1, 7, 1, g[2]); L(7, -2, 7, 2, g[1]); L(7, -1, 7, 1, g[2]);   // paragolpes y pasarruedas grises
      L(-12, -2, 4, 2, N[0]); L(8, -2, 4, 2, N[0]);                                      // pasos de rueda
      L(-13, 0, 2, 2, q.luz); L(-13, 1, 1, 1, '#ffffff'); L(12, 0, 1, 2, q.freno);       // faro y luz de atras
      L(-6, -2, 1, 4, c[1]); L(4, -2, 1, 4, c[1]); L(2, 0, 1, 1, N[1]);                  // puerta y manija
      L(-8, 2, 20, 4, c[2]); L(-5, 5, 14, 1, c[3]); L(-4, 6, 13, 1, c[3]);               // cabina y techo
      L(-5, 2, 7, 1, v[1]); L(-4, 3, 6, 1, v[1]); L(-3, 4, 5, 1, v[1]);                  // ventanilla (el frente sigue al parabrisas)
      L(-3, 3, 2, 1, v[3]); L(-2, 4, 2, 1, v[3]);
      L(3, 2, 8, 1, v[1]); L(3, 3, 7, 1, v[1]); L(3, 4, 6, 1, v[1]); L(4, 3, 2, 1, v[3]);   // ventana de atras, en punta
      if (q.rally) {
        L(-15, -3, 3, 1, METAL[0]);                                                      // el chapon
        L(-5, -2, 9, 4, BLANCO); L(-5, -2, 1, 1, c[2]); L(3, -2, 1, 1, c[2]); L(-5, 1, 1, 1, c[2]); L(3, 1, 1, 1, c[2]);   // redondel blanco con el numero
        cifras(q.numero, (x, y) => L(-4 + x, 1 - y, 1, 1, N[0]), espejo, true);
        L(-13, 2, 1, 2, N[1]); L(-3, 7, 3, 1, N[1]);                                     // faros de rally y toma de aire, de canto
        L(5, 1, 6, 1, q.franjas[0]);                                                     // una franja en el guardabarros de atras
      }
      salpicar(p, 10, (col, a, b) => { const z = -13 + Math.floor(a * 26); if (z < -5 || z > 3) L(z, -2 + Math.floor(b * 1.6), 1, 1, col); });
    },
    frente: ({ F }, q, p) => {
      const c = q.c, v = q.vidrio, g = PLASTICO;
      p.fondo(N[0]);
      F(-7, -2, 14, 2, g[1]); F(-7, -1, 14, 1, g[2]);                                    // paragolpes
      F(-3, -2, 6, 1, N[0]); F(-6, -1, 1, 1, q.giro); F(5, -1, 1, 1, q.giro);            // toma de aire y luces de giro
      F(-6, 0, 12, 2, c[2]); F(-6, 1, 12, 1, c[3]);                                      // trompa
      F(-6, 0, 3, 2, q.luz); F(3, 0, 3, 2, q.luz); F(-5, 1, 1, 1, '#ffffff'); F(4, 1, 1, 1, '#ffffff');   // faros
      F(-1, 0, 2, 1, '#2f5fb0');                                                         // el ovalo
      F(-6, 2, 12, 4, c[2]); F(-5, 6, 10, 1, c[3]);                                      // marco del parabrisas y techo
      F(-5, 2, 10, 4, v[1]); F(-5, 5, 10, 1, v[0]);                                      // vidrio
      for (let k = 0; k < 3; k++) { F(-3 + k, 2 + k, 2, 1, v[3]); F(2 + k, 2 + k, 1, 1, v[2]); }
      F(-4, 2, 2, 1, N[0]); F(1, 2, 2, 1, N[0]);                                         // limpiaparabrisas
      if (!q.rally) return;
      F(-5, -3, 10, 1, METAL[0]); F(-4, -3, 1, 1, N[3]); F(3, -3, 1, 1, N[3]);           // el chapon
      for (const x of [-6, -3, 1, 4]) { F(x, 2, 2, 2, '#ffd23a'); F(x + 1, 3, 1, 1, '#fff1a8'); F(x, 2, 1, 1, '#d9a400'); }   // faros de rally
      F(-2, 7, 4, 1, N[0]);                                                              // toma de aire
    },
    atras: ({ T }, q, p) => {
      const c = q.c, v = q.vidrio, g = PLASTICO;
      p.fondo(N[0]);
      T(-7, -2, 14, 2, g[1]); T(-7, -1, 14, 1, g[2]);                                    // paragolpes
      T(-2, -1, 4, 1, BLANCO); T(4, -2, 1, 1, N[4]);                                     // patente y escape
      T(-6, 0, 12, 2, c[2]); T(-6, 1, 12, 1, c[3]); T(-1, 0, 2, 1, METAL[1]);            // porton y la marca
      T(-6, 2, 12, 4, c[2]); T(-5, 6, 10, 1, c[3]);
      T(-4, 2, 8, 3, v[1]); T(-3, 4, 2, 1, v[3]); T(-2, 3, 2, 1, v[3]);                  // luneta
      for (const x of [-6, 5]) { T(x, 0, 1, 2, q.giro); T(x, 2, 1, 2, q.freno); T(x, 4, 1, 1, tono(q.freno, 0.35)); }   // luces altas, en las esquinas
    },
  },
};

// ================= LA CHATA: la camioneta del organizador y de medio publico =================
const CHATA = {
  W: 16, L: 36, Y0: -4, Y1: 9, rueda: 0.375, medidas: { radio: 0.37, trocha: 0.72, ejes: 1.45, alto: -0.43 },
  cajas: (q) => [
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
    [-6, -3, 17, 6, -1, 18],                                        // paragolpes de atras
    [-7, -3, -18, 7, 0, -17],                                       // paragolpes de adelante
    [-8, 4, -6, -6, 5, -5, { liso: N[1] }], [6, 4, -6, 8, 5, -5, { liso: N[1] }],   // espejos
    ...(q.carga ? [
      [-7, 5, 2, -6, 9, 3, { liso: N[1] }], [6, 5, 2, 7, 9, 3, { liso: N[1] }], [-6, 8, 2, 6, 9, 3, { liso: N[1] }],   // jaula antivuelco
      [-6, 3, 4, 0, 5, 10, { lados: GOMA }],                        // rueda de auxilio
      [1, 3, 7, 6, 5, 10, { lados: '#8a5a30' }],                    // cajon de madera
      [-6, 3, 11, -1, 6, 15, { lados: '#d8d2c2' }],                 // conservadora
      [0, 3, 11, 6, 5, 16, { lados: '#4a5930' }],                   // bolso
    ] : []),
  ],
  vistas: {
    arriba: ({ A }, q, p) => {
      const c = q.c;
      p.fondo(N[1]);
      A(-7, -18, 14, 1, N[2]); A(-4, -18, 8, 1, N[4]);                 // paragolpes
      A(-7, -17, 14, 10, c[2]); A(-7, -17, 14, 1, c[3]);                // capot
      A(-6, -16, 1, 8, c[3]); A(5, -16, 1, 8, c[3]);                    // lomos de los guardabarros
      A(-7, -15, 1, 8, N[1]); A(6, -15, 1, 8, N[1]);                    // guardabarros negros sobre las ruedas
      A(-6, -9, 12, 1, N[2]);                                           // rejilla al pie del parabrisas
      A(-7, -7, 1, 9, c[3]); A(6, -7, 1, 9, c[3]);                      // hombros a los lados de la cabina
      A(-6, -5, 12, 7, c[2]); A(-6, -5, 12, 1, c[3]); A(-6, -5, 1, 7, c[3]); A(5, -5, 1, 7, c[3]); A(-6, 1, 12, 1, c[1]);   // techo
      A(-6, 3, 12, 13, N[1]);                                           // piso de la caja
      for (let i = 0; i < 18; i++) A(-6 + Math.floor(p.azar() * 12), 3 + Math.floor(p.azar() * 13), 1, 1, N[2]);
      A(-7, 2, 1, 15, c[3]); A(6, 2, 1, 15, c[3]); A(-6, 2, 12, 1, c[3]); A(-6, 16, 12, 1, c[3]);   // bordes de la caja
      A(-6, 17, 12, 1, N[2]);                                           // paragolpes de atras
      if (!q.carga) return;
      A(-6, 4, 6, 6, GOMA); A(-5, 5, 4, 4, '#2a2a2f'); A(-4, 6, 2, 2, METAL[0]); A(-4, 6, 1, 1, METAL[1]);   // rueda de auxilio
      A(1, 7, 5, 3, '#a9743f'); A(1, 8, 5, 1, '#7d5228'); A(1, 7, 1, 3, '#c99355');      // cajon de madera
      A(-6, 11, 5, 4, '#e9e4d6'); A(-6, 11, 5, 1, '#fbf8f0'); A(-6, 13, 5, 1, '#2f7fb8');   // conservadora
      A(0, 11, 6, 5, '#5d6f3c'); A(0, 11, 6, 1, '#7d9150'); A(1, 11, 1, 5, '#3d4a28'); A(4, 11, 1, 5, '#3d4a28');   // bolso
    },
    abajo: ({ B }, q, p) => {
      p.fondo(N[0]);
      B(-7, -17, 1, 34, q.c[0]); B(6, -17, 1, 34, q.c[0]);
      B(-4, -16, 1, 33, N[2]); B(3, -16, 1, 33, N[2]);
      for (const z of [-16, -6, 2, 9, 16]) B(-3, z, 6, 1, N[1]);
      B(-2, -15, 4, 3, METAL[0]); B(0, -7, 1, 17, N[4]);
      B(-6, -12, 12, 1, N[3]); B(-6, 11, 12, 1, N[3]);
      salpicar(p, 26, (col, a, b) => B(-7 + Math.floor(a * 14), -17 + Math.floor(b * 34), 1, 1, col));
    },
    costado: ({ L }, q, p) => {
      const c = q.c, v = q.vidrio;
      p.fondo(N[0]);
      L(-17, -3, 34, 1, N[2]);                                          // larguero del chasis
      L(-18, -3, 1, 3, N[2]); L(-17, -2, 2, 5, c[2]); L(-17, 2, 2, 1, c[3]); L(-17, 1, 1, 1, q.giro);   // paragolpes y trompa
      L(-16, -2, 1, 4, N[1]); L(-15, 2, 8, 1, N[1]); L(-7, -2, 1, 4, N[1]);   // guardabarros negro alrededor de la rueda
      L(-6, -2, 8, 5, c[2]); L(-7, 2, 9, 1, c[3]); L(-6, -2, 8, 1, c[1]);     // puerta
      L(1, -1, 1, 3, c[1]); L(-1, 1, 1, 1, N[1]);                       // junta y manija
      L(-8, 3, 10, 5, c[2]); L(-8, 7, 10, 1, c[3]); L(1, 3, 1, 4, c[1]);   // cabina
      L(-6, 4, 6, 1, v[1]); L(-5, 5, 5, 2, v[1]); L(-4, 4, 2, 1, v[3]); L(-3, 5, 2, 1, v[3]);   // ventanilla
      L(2, -2, 5, 5, c[2]); L(2, -2, 5, 1, c[1]); L(15, -2, 2, 5, c[2]); L(15, -2, 2, 1, c[1]);   // costado de la caja
      L(6, -2, 1, 4, N[1]); L(7, 2, 8, 1, N[1]); L(15, -2, 1, 4, N[1]);   // guardabarros de atras
      L(2, 3, 15, 2, c[2]); L(2, 4, 15, 1, c[3]);                       // baranda
      L(16, 0, 1, 3, q.freno); L(17, -3, 1, 2, N[2]);                   // luz y paragolpes de atras
      salpicar(p, 14, (col, a, b) => L(-17 + Math.floor(a * 34), -2 + Math.floor(b * 2.4), 1, 1, col));
    },
    frente: ({ F }, q, p) => {
      const c = q.c, v = q.vidrio;
      p.fondo(N[0]);
      F(-7, -2, 14, 5, c[2]); F(-7, 2, 14, 1, c[3]); F(-7, -2, 14, 1, c[1]);   // trompa
      F(-4, 0, 8, 2, N[1]); F(-3, 1, 6, 1, METAL[0]); F(-3, 0, 6, 1, N[3]);    // parrilla
      for (const s of [-1, 1]) { F(s < 0 ? -7 : 6, 0, 1, 2, q.giro); F(s < 0 ? -6 : 5, 0, 1, 2, q.luz); }
      F(-7, -3, 14, 3, N[2]); F(-7, -1, 14, 1, N[3]);                          // paragolpes
      F(-6, 3, 12, 5, c[2]); F(-6, 7, 12, 1, c[3]);                            // marco del parabrisas
      F(-5, 3, 10, 4, v[1]); F(-5, 6, 10, 1, v[0]);
      for (let k = 0; k < 4; k++) { F(-3 + k, 3 + k, 2, 1, v[3]); F(2 + k, 3 + k, 1, 1, v[2]); }
    },
    atras: ({ T }, q, p) => {
      const c = q.c, v = q.vidrio;
      p.fondo(N[0]);
      T(-6, 5, 12, 3, c[2]); T(-6, 7, 12, 1, c[3]); T(-4, 5, 8, 2, v[1]); T(-2, 5, 2, 1, v[3]);   // espalda de la cabina y luneta
      T(-7, -2, 14, 7, c[2]); T(-7, 4, 14, 1, c[3]); T(-7, -2, 14, 1, c[1]);    // porton
      T(-5, 0, 10, 2, c[1]); T(-1, 3, 2, 1, N[1]);
      for (const x of [-7, 5]) { T(x, 0, 2, 4, q.freno); T(x, 0, 2, 1, q.giro); }
      T(-6, -3, 12, 2, N[2]); T(-6, -2, 12, 1, N[3]); T(-2, -3, 4, 1, BLANCO);
    },
  },
};

// ================= EL BUGGY: de arena, abierto, con jaula antivuelco de cabos, motor atras y aleron =================
const BUGGY = {
  W: 18, L: 34, Y0: -6, Y1: 10, rueda: 0.3, atlas: [256, 128], frenos: [[-2, 0.5, 13.1, 2, 1], [2, 0.5, 13.1, 2, 1]],
  cajas: (q) => {
    const tubo = { liso: N[1] }, faro = { caras: { nz: '#ffd23a', px: N[1], nx: N[1], py: N[2], ny: N[0], pz: N[1] } };
    return [
      [-4, -4, -13, 4, -3, 13, tubo],                                   // chasis tubular
      [-3, -3, -8, 3, -2, 6, { liso: N[0] }],                           // piso
      [-4, -3, -14, 4, 0, -8],                                          // trompa
      [-5, -3, -16, 5, -2, -15, tubo], [-5, -3, -16, -4, 1, -14, tubo], [4, -3, -16, 5, 1, -14, tubo],   // paragolpes de caño
      [-6, -3, -5, -3, 2, 5], [3, -3, -5, 6, 2, 5],                     // pontones rojos a los lados del piloto
      [-3, -2, -1, -1, 0, 3, { liso: N[2] }], [1, -2, -1, 3, 0, 3, { liso: N[2] }],        // asientos
      [-3, 0, 3, -1, 5, 4, { liso: N[2] }], [1, 0, 3, 3, 5, 4, { liso: N[2] }],            // respaldos
      [-3, 0, -6, 3, 2, -5, { liso: N[1] }], [-1, 1, -4, 1, 3, -3, { liso: N[0] }],        // tablero y volante
      // jaula: dos caños de techo, travesaños, patas delanteras en escalera y parantes de atras
      [-6, 9, -5, -5, 10, 6, tubo], [5, 9, -5, 6, 10, 6, tubo], [-6, 9, -5, 6, 10, -4, tubo], [-6, 9, 5, 6, 10, 6, tubo], [-1, 9, -4, 1, 10, 5, tubo],
      [-6, 2, 5, -5, 9, 6, tubo], [5, 2, 5, 6, 9, 6, tubo],
      [-6, 2, -9, -5, 4, -8, tubo], [-6, 4, -8, -5, 6, -7, tubo], [-6, 6, -7, -5, 8, -6, tubo], [-6, 8, -6, -5, 9, -5, tubo],
      [5, 2, -9, 6, 4, -8, tubo], [5, 4, -8, 6, 6, -7, tubo], [5, 6, -7, 6, 8, -6, tubo], [5, 8, -6, 6, 9, -5, tubo],
      [-6, 4, -3, -5, 5, 5, tubo], [5, 4, -3, 6, 5, 5, tubo],           // barras de puerta
      [-4, -3, 6, 4, 3, 13, { caras: { px: N[3], nx: N[3], py: N[3], ny: N[0], pz: N[3] } }],   // motor
      [-2, 3, 8, 2, 4, 13, { liso: N[1] }], [2, -3, 11, 3, -2, 15, { liso: N[4] }],        // multiple y escape
      [-8, -1, -1, -6, 0, 1, { liso: N[1] }], [6, -1, -1, 8, 0, 1, { liso: N[1] }],        // brazos de la suspension
      ...(q.rally ? [
        [-4, 0, -15, -2, 2, -14, faro], [2, 0, -15, 4, 2, -14, faro],   // faros de rally
        [-3, 3, 13, -2, 7, 14, { liso: N[1] }], [2, 3, 13, 3, 7, 14, { liso: N[1] }],     // soportes del aleron
        [-8, 7, 14, 8, 8, 17, { liso: N[0] }],                          // aleron
        [-8, 5, 14, -7, 9, 17, { liso: q.c[2] }], [7, 5, 14, 8, 9, 17, { liso: q.c[2] }],   // laterales del aleron
      ] : []),
    ];
  },
  vistas: {
    arriba: ({ A }, q, p) => {
      const c = q.c;
      p.fondo(N[1]);
      A(-4, -14, 8, 6, c[2]); A(-4, -14, 8, 1, c[3]); A(-4, -14, 1, 6, c[3]); A(3, -14, 1, 6, c[1]);   // trompa
      for (const x of [-6, 3]) { A(x, -5, 3, 10, c[2]); A(x, -5, 3, 1, c[3]); A(x, -5, 1, 10, c[3]); A(x + 2, -5, 1, 10, c[1]); }   // pontones
      A(-4, 6, 8, 7, N[3]); A(-4, 6, 8, 1, N[4]); for (const z of [8, 10, 12]) A(-3, z, 6, 1, N[2]);   // motor con aletas
      salpicar(p, 12, (col, a, b) => A(-4 + Math.floor(a * 8), 6 + Math.floor(b * 7), 1, 1, col));
      if (!q.rally) return;
      A(-4, -13, 8, 5, BLANCO); cifras(q.numero, (x, y) => A(-3 + x, -12 + y, 1, 1, N[0]), false, true);   // placa con el numero
    },
    abajo: ({ B }, q, p) => {
      p.fondo(N[0]);
      B(-4, -14, 8, 6, q.c[0]); B(-6, -5, 3, 10, q.c[0]); B(3, -5, 3, 10, q.c[0]);
      B(-1, -13, 2, 26, N[2]); B(-3, -9, 6, 1, N[3]); B(-3, 9, 6, 1, N[3]); B(2, 4, 1, 12, '#6b4a36');
      salpicar(p, 20, (col, a, b) => B(-6 + Math.floor(a * 12), -14 + Math.floor(b * 27), 1, 1, col));
    },
    costado: ({ L }, q, p, espejo) => {
      const c = q.c;
      p.fondo(N[0]);
      L(-14, -3, 6, 3, c[2]); L(-14, -1, 6, 1, c[3]); L(-14, -3, 6, 1, c[1]);               // trompa
      L(-5, -3, 10, 5, c[2]); L(-5, 1, 10, 1, c[3]); L(-5, -3, 10, 1, c[1]);                // pontón
      L(6, -3, 7, 6, N[3]); L(6, 2, 7, 1, N[4]); for (const z of [7, 9, 11]) L(z, 0, 1, 2, N[2]);   // motor con aletas
      if (q.rally) {
        L(-4, -2, 8, 4, BLANCO);
        cifras(q.numero, (x, y) => L(-3 + x, 1 - y, 1, 1, N[0]), espejo, true);
      }
      salpicar(p, 12, (col, a, b) => { const z = -14 + Math.floor(a * 27); L(z, -3 + Math.floor(b * 2.5), 1, 1, col); });
    },
    frente: ({ F }, q, p) => {
      const c = q.c;
      p.fondo(N[0]);
      F(-6, -3, 2, 5, c[1]); F(4, -3, 2, 5, c[1]);
      F(-4, -3, 8, 3, c[2]); F(-4, -1, 8, 1, c[3]); F(-2, -2, 4, 1, N[0]);                  // trompa y toma de aire
      F(-4, -3, 1, 1, q.giro); F(3, -3, 1, 1, q.giro);
    },
    atras: ({ T }, q, p) => {
      const c = q.c;
      p.fondo(N[0]);
      T(-6, -3, 2, 5, c[1]); T(4, -3, 2, 5, c[1]);
      T(-4, -3, 8, 6, N[3]); T(-4, 2, 8, 1, N[4]); T(-3, -1, 6, 1, N[1]);                   // motor
      T(-3, 0, 2, 1, q.freno); T(1, 0, 2, 1, q.freno);
    },
  },
};

// ================= EL CAMION: de rally raid, cabina amarilla y caja con lona caqui =================
const LONA = ['#7a7552', '#9a9468', '#b8b186'];
const CAMION = {
  W: 18, L: 48, Y0: -5, Y1: 12, rueda: 0.4, atlas: [256, 128], frenos: [[-6, 1, 22.1, 2, 2], [6, 1, 22.1, 2, 2]],
  cajas: (q) => {
    const faro = { caras: { nz: '#ffd23a', px: N[1], nx: N[1], py: N[2], ny: N[0], pz: N[1] } };
    return [
      [-5, -5, -20, 5, -3, 21, { liso: N[0] }],                         // chasis
      [-7, -4, -23, 7, -2, -22, { liso: N[2] }],                        // paragolpes de adelante
      [-7, -4, 22, 7, -2, 23, { liso: N[2] }],                          // paragolpes de atras
      [-7, -3, -22, 7, 3, -4],                                          // trompa y base de la cabina
      [-7, 3, -14, 7, 10, -4, { cuña: 3 }],                             // cabina, con el parabrisas tendido
      [-7, -3, -3, 7, 3, 22],                                           // chasis de la caja, negro con luces
      [-8, 3, -3, 8, 11, 21], [-6, 11, -3, 6, 12, 21],                  // caja con lona
      [-9, 2, -18, -6, 3, -10, { liso: N[1] }], [6, 2, -18, 9, 3, -10, { liso: N[1] }],    // guardabarros de adelante
      [-9, 2, 10, -6, 3, 18, { liso: N[1] }], [6, 2, 10, 9, 3, 18, { liso: N[1] }],        // guardabarros de atras
      [-9, 5, -11, -7, 6, -10, { liso: N[1] }], [7, 5, -11, 9, 6, -10, { liso: N[1] }],    // espejos
      [7, 3, -3, 8, 11, -2, { liso: N[3] }],                            // escape vertical, atras de la cabina
      ...(q.rally ? [
        [-6, -2, -24, -4, 0, -23, faro], [4, -2, -24, 6, 0, -23, faro],   // faros de rally en el paragolpes
        [-4, 10, -9, 4, 11, -8, { liso: N[1] }],                        // barra de luces del techo
      ] : []),
    ];
  },
  vistas: {
    arriba: ({ A }, q, p) => {
      const c = q.c, v = q.vidrio, l = LONA;
      p.fondo(N[1]);
      A(-7, -22, 14, 8, c[2]); A(-7, -22, 14, 1, c[3]); A(-7, -22, 1, 8, c[3]); A(6, -22, 1, 8, c[1]);   // capot
      A(-6, -14, 12, 3, v[1]); A(-5, -13, 3, 1, v[3]);                                  // parabrisas
      A(-7, -11, 14, 7, c[2]); A(-7, -11, 14, 1, c[3]); A(-7, -11, 1, 7, c[3]); A(6, -11, 1, 7, c[1]);   // techo de la cabina
      A(-8, -3, 16, 24, l[1]); A(-8, -3, 16, 1, l[2]); A(-8, -3, 2, 24, l[2]); A(6, -3, 2, 24, l[0]);   // lona
      for (const z of [2, 7, 12, 17]) A(-8, z, 16, 1, l[0]);                            // pliegues
      A(-7, 21, 14, 1, N[1]);
      salpicar(p, 14, (col, a, b) => A(-8 + Math.floor(a * 16), -3 + Math.floor(b * 24), 1, 1, col));
      if (!q.rally) return;
      A(-5, -21, 10, 6, BLANCO); cifras(q.numero, (x, y) => A(-3 + x, -20 + y, 1, 1, N[0]));   // numero en el capot
    },
    abajo: ({ B }, q, p) => {
      p.fondo(N[0]);
      B(-7, -22, 1, 44, q.c[0]); B(6, -22, 1, 44, q.c[0]);
      B(-5, -20, 1, 41, N[2]); B(4, -20, 1, 41, N[2]);                                  // largueros
      B(-6, -14, 12, 1, N[3]); B(-6, 14, 12, 1, N[3]); B(-1, -15, 2, 3, N[4]); B(-1, 13, 2, 3, N[4]);   // ejes y diferenciales
      B(0, -14, 1, 28, N[4]); for (const z of [-8, 0, 8]) B(-4, z, 8, 1, N[1]);          // cardan y travesaños
      B(2, -6, 1, 24, '#6b4a36');                                                       // escape
      salpicar(p, 30, (col, a, b) => B(-7 + Math.floor(a * 14), -22 + Math.floor(b * 44), 1, 1, col));
    },
    costado: ({ L }, q, p, espejo) => {
      const c = q.c, v = q.vidrio, l = LONA;
      p.fondo(N[0]);
      L(-20, -5, 41, 2, N[2]);                                                          // chasis
      L(-22, -3, 18, 6, c[2]); L(-22, 2, 18, 1, c[3]); L(-22, -3, 18, 1, c[1]);         // trompa
      L(-14, 3, 10, 7, c[2]); L(-12, 9, 8, 1, c[3]);                                    // cabina
      L(-12, -1, 1, 10, c[1]); L(-5, -1, 1, 10, c[1]); L(-6, 2, 1, 1, N[1]);            // puerta y manija
      L(-11, 5, 6, 4, v[1]); L(-10, 7, 2, 1, v[3]); L(-9, 6, 2, 1, v[3]);              // ventanilla
      L(-3, -3, 25, 6, N[1]);                                                           // chasis de la caja
      for (const z of [-1, 3, 7, 19]) { L(z, -1, 2, 2, '#e8b81c'); L(z, -1, 1, 1, '#f7e08a'); }   // luces de posicion
      L(-3, 3, 24, 8, l[1]); L(-3, 3, 24, 1, l[0]); L(-3, 10, 24, 1, l[2]); L(-3, 11, 24, 1, l[2]);   // lona
      for (const z of [2, 8, 14, 20]) L(z, 4, 1, 7, l[0]);                              // pliegues
      L(-23, -4, 1, 2, N[2]); L(22, -4, 1, 2, N[2]);                                    // paragolpes
      L(7, 4, 1, 7, N[4]);                                                              // escape vertical
      L(-18, -3, 10, 5, N[0]); L(9, -3, 10, 5, N[0]);                                   // pasos de rueda
      L(-22, 2, 2, 1, q.giro);
      if (q.rally) {
        L(-22, 0, 17, 1, q.franjas[0]);                                                 // franja sobre el capot
        L(2, 5, 9, 6, BLANCO); cifras(q.numero, (x, y) => L(3 + x, 9 - y, 1, 1, N[0]), espejo);   // numero en la lona
      }
      salpicar(p, 20, (col, a, b) => { const z = -22 + Math.floor(a * 44); L(z, -3 + Math.floor(b * 2.5), 1, 1, col); });
    },
    frente: ({ F }, q, p) => {
      const c = q.c, v = q.vidrio, l = LONA;
      p.fondo(N[0]);
      F(-8, 10, 16, 2, l[1]); F(-6, 11, 12, 1, l[2]);                                   // la caja asoma sobre la cabina
      F(-7, 3, 14, 7, c[2]); F(-7, 9, 14, 1, c[3]);                                     // marco del parabrisas
      F(-6, 4, 12, 5, v[1]); F(-6, 8, 12, 1, v[0]);
      for (let k = 0; k < 4; k++) { F(-4 + k, 4 + k, 2, 1, v[3]); F(2 + k, 4 + k, 1, 1, v[2]); }
      F(-4, 4, 3, 1, N[0]); F(1, 4, 3, 1, N[0]);                                        // limpiaparabrisas
      F(-7, -2, 14, 5, c[2]); F(-7, 2, 14, 1, c[3]);                                    // trompa
      F(-5, -1, 10, 3, N[1]); F(-4, 0, 8, 1, N[3]); F(-4, 1, 8, 1, N[2]);               // parrilla
      F(-7, 0, 2, 2, q.luz); F(5, 0, 2, 2, q.luz); F(-7, -1, 2, 1, q.giro); F(5, -1, 2, 1, q.giro);
      F(-4, -4, 8, 1, METAL[0]);
      if (!q.rally) return;
      for (const x of [-6, 4]) { F(x, -2, 2, 2, '#ffd23a'); F(x + 1, -1, 1, 1, '#fff1a8'); }
    },
    atras: ({ T }, q, p) => {
      const l = LONA;
      p.fondo(N[0]);
      T(-8, 3, 16, 8, l[1]); T(-6, 11, 12, 1, l[2]); T(-8, 3, 16, 1, l[0]); T(0, 4, 1, 7, l[0]); T(-8, 10, 16, 1, l[2]);   // lona
      T(-7, -3, 14, 6, N[1]); T(-7, -3, 14, 1, N[2]);                                   // chasis de la caja
      T(-7, 1, 2, 2, q.freno); T(5, 1, 2, 2, q.freno); T(-7, 0, 2, 1, q.giro); T(5, 0, 2, 1, q.giro);
      T(-2, -1, 4, 2, BLANCO);                                                          // patente
    },
  },
};

// ================= EL CARGUERO: el camion de la Montana, con la caja pelada (plataforma con barandas) para la carga =================
const MADERA = ['#6b4c2c', '#8f6a3e', '#b08a56'];
const CARGUERO = {
  W: 18, L: 48, Y0: -5, Y1: 12, rueda: 0.4, atlas: [256, 128], frenos: [[-6, 1, 22.1, 2, 2], [6, 1, 22.1, 2, 2]],
  cajas: (q) => {
    const faro = { caras: { nz: '#ffd23a', px: N[1], nx: N[1], py: N[2], ny: N[0], pz: N[1] } };
    return [
      [-5, -5, -20, 5, -3, 21, { liso: N[0] }],                         // chasis
      [-7, -4, -23, 7, -2, -22, { liso: N[2] }],                        // paragolpes de adelante
      [-7, -4, 22, 7, -2, 23, { liso: N[2] }],                          // paragolpes de atras
      [-7, -3, -22, 7, 3, -4],                                          // trompa y base de la cabina
      [-7, 3, -14, 7, 10, -4, { cuña: 3 }],                             // cabina, con el parabrisas tendido
      [-7, -3, -3, 7, 3, 22],                                           // chasis de la caja, negro con luces
      [-8, 2, -3, 8, 4, 21, { liso: N[1] }],                            // plataforma
      [-8, 4, -3, -7, 6, 21, { liso: N[2] }], [7, 4, -3, 8, 6, 21, { liso: N[2] }], [-8, 4, 20, 8, 6, 21, { liso: N[2] }],   // barandas
      [-8, 4, -3, 8, 9, -2, { liso: N[2] }],                            // defensa contra la cabina
      [-9, 2, -18, -6, 3, -10, { liso: N[1] }], [6, 2, -18, 9, 3, -10, { liso: N[1] }],    // guardabarros de adelante
      [-9, 2, 10, -6, 3, 18, { liso: N[1] }], [6, 2, 10, 9, 3, 18, { liso: N[1] }],        // guardabarros de atras
      [-9, 5, -11, -7, 6, -10, { liso: N[1] }], [7, 5, -11, 9, 6, -10, { liso: N[1] }],    // espejos
      [7, 3, -3, 8, 11, -2, { liso: N[3] }],                            // escape vertical, atras de la cabina
      ...(q.rally ? [
        [-6, -2, -24, -4, 0, -23, faro], [4, -2, -24, 6, 0, -23, faro],   // faros de rally en el paragolpes
        [-4, 10, -9, 4, 11, -8, { liso: N[1] }],                        // barra de luces del techo
      ] : []),
    ];
  },
  vistas: {
    arriba: ({ A }, q, p) => {
      const c = q.c, v = q.vidrio;
      p.fondo(N[1]);
      A(-7, -22, 14, 8, c[2]); A(-7, -22, 14, 1, c[3]); A(-7, -22, 1, 8, c[3]); A(6, -22, 1, 8, c[1]);   // capot
      A(-6, -14, 12, 3, v[1]); A(-5, -13, 3, 1, v[3]);                                  // parabrisas
      A(-7, -11, 14, 7, c[2]); A(-7, -11, 14, 1, c[3]); A(-7, -11, 1, 7, c[3]); A(6, -11, 1, 7, c[1]);   // techo de la cabina
      A(-8, -3, 16, 24, MADERA[1]); A(-8, -3, 1, 24, N[2]); A(7, -3, 1, 24, N[2]); A(-8, 20, 16, 1, N[2]);   // plataforma
      for (const z of [2, 7, 12, 17]) A(-7, z, 14, 1, MADERA[0]);                       // tablas
      A(-7, 21, 14, 1, N[1]);
      salpicar(p, 14, (col, a, b) => A(-8 + Math.floor(a * 16), -3 + Math.floor(b * 24), 1, 1, col));
      A(-5, -21, 10, 6, BLANCO); cifras(q.numero, (x, y) => A(-3 + x, -20 + y, 1, 1, N[0]));   // numero en el capot
    },
    abajo: ({ B }, q, p) => {
      p.fondo(N[0]);
      B(-7, -22, 1, 44, q.c[0]); B(6, -22, 1, 44, q.c[0]);
      B(-5, -20, 1, 41, N[2]); B(4, -20, 1, 41, N[2]);                                  // largueros
      B(-6, -14, 12, 1, N[3]); B(-6, 14, 12, 1, N[3]); B(-1, -15, 2, 3, N[4]); B(-1, 13, 2, 3, N[4]);   // ejes y diferenciales
      B(0, -14, 1, 28, N[4]); for (const z of [-8, 0, 8]) B(-4, z, 8, 1, N[1]);          // cardan y travesaños
      B(2, -6, 1, 24, '#6b4a36');                                                       // escape
      salpicar(p, 30, (col, a, b) => B(-7 + Math.floor(a * 14), -22 + Math.floor(b * 44), 1, 1, col));
    },
    costado: ({ L }, q, p, espejo) => {
      const c = q.c, v = q.vidrio;
      p.fondo(N[0]);
      L(-20, -5, 41, 2, N[2]);                                                          // chasis
      L(-22, -3, 18, 6, c[2]); L(-22, 2, 18, 1, c[3]); L(-22, -3, 18, 1, c[1]);         // trompa
      L(-14, 3, 10, 7, c[2]); L(-12, 9, 8, 1, c[3]);                                    // cabina
      L(-12, -1, 1, 10, c[1]); L(-5, -1, 1, 10, c[1]); L(-6, 2, 1, 1, N[1]);            // puerta y manija
      L(-11, 5, 6, 4, v[1]); L(-10, 7, 2, 1, v[3]); L(-9, 6, 2, 1, v[3]);              // ventanilla
      L(-3, -3, 25, 6, N[1]);                                                           // chasis de la caja
      for (const z of [-1, 3, 7, 19]) { L(z, -1, 2, 2, '#e8b81c'); L(z, -1, 1, 1, '#f7e08a'); }   // luces de posicion
      L(-3, 3, 24, 2, MADERA[1]); L(-3, 3, 24, 1, MADERA[0]); L(-3, 5, 24, 2, N[2]); L(-3, 9, 1, 3, N[2]);   // plataforma y baranda
      for (const z of [2, 8, 14, 20]) L(z, 5, 1, 2, N[1]);                              // postes
      L(-23, -4, 1, 2, N[2]); L(22, -4, 1, 2, N[2]);                                    // paragolpes
      L(7, 4, 1, 7, N[4]);                                                              // escape vertical
      L(-18, -3, 10, 5, N[0]); L(9, -3, 10, 5, N[0]);                                   // pasos de rueda
      L(-22, 2, 2, 1, q.giro);
      if (q.rally) {
        L(-22, 0, 17, 1, q.franjas[0]);                                                 // franja sobre el capot
        L(-12, 4, 4, 3, BLANCO); cifras(q.numero, (x, y) => L(-11 + x, 6 - y, 1, 1, N[0]), espejo);   // numero en la puerta
      }
      salpicar(p, 20, (col, a, b) => { const z = -22 + Math.floor(a * 44); L(z, -3 + Math.floor(b * 2.5), 1, 1, col); });
    },
    frente: ({ F }, q, p) => {
      const c = q.c, v = q.vidrio;
      p.fondo(N[0]);
      F(-8, 2, 16, 3, MADERA[1]);                                                       // la plataforma asoma a los costados
      F(-7, 3, 14, 7, c[2]); F(-7, 9, 14, 1, c[3]);                                     // marco del parabrisas
      F(-6, 4, 12, 5, v[1]); F(-6, 8, 12, 1, v[0]);
      for (let k = 0; k < 4; k++) { F(-4 + k, 4 + k, 2, 1, v[3]); F(2 + k, 4 + k, 1, 1, v[2]); }
      F(-4, 4, 3, 1, N[0]); F(1, 4, 3, 1, N[0]);                                        // limpiaparabrisas
      F(-7, -2, 14, 5, c[2]); F(-7, 2, 14, 1, c[3]);                                    // trompa
      F(-5, -1, 10, 3, N[1]); F(-4, 0, 8, 1, N[3]); F(-4, 1, 8, 1, N[2]);               // parrilla
      F(-7, 0, 2, 2, q.luz); F(5, 0, 2, 2, q.luz); F(-7, -1, 2, 1, q.giro); F(5, -1, 2, 1, q.giro);
      F(-4, -4, 8, 1, METAL[0]);
      if (!q.rally) return;
      for (const x of [-6, 4]) { F(x, -2, 2, 2, '#ffd23a'); F(x + 1, -1, 1, 1, '#fff1a8'); }
    },
    atras: ({ T }, q, p) => {
            p.fondo(N[0]);
      T(-8, 2, 16, 2, MADERA[1]); T(-8, 4, 16, 2, N[2]); T(-8, 6, 16, 1, N[1]); T(-8, 9, 16, 1, N[2]);   // plataforma, baranda y defensa
      T(-7, -3, 14, 6, N[1]); T(-7, -3, 14, 1, N[2]);                                   // chasis de la caja
      T(-7, 1, 2, 2, q.freno); T(5, 1, 2, 2, q.freno); T(-7, 0, 2, 1, q.giro); T(5, 0, 2, 1, q.giro);
      T(-2, -1, 4, 2, BLANCO);                                                          // patente
    },
  },
};


// ================= EL F1 moderno =================
const F1 = {
  W: 16, L: 42, Y0: -2, Y1: 5, rueda: 0.35, frenos: [[-4, 1, 18, 2, 1], [4, 1, 18, 2, 1]], 
  cajas: (q) => [
    [-2, -2, -21, 2, -1, -15],                 // Trompa
    [-7, -2, -20, 7, -1, -17],                 // Alerón delantero
    [-5, -2, -8, 5, 1, 10],                    // Pontones laterales (chasis)
    [-2, 1, -5, 2, 3, 5, { cuña: 2 }],         // Cockpit y protección del piloto[cite: 1]
    [-2, 1, 12, 2, 4, 19, { cuñaAtras: 2 }],   // Cubierta del motor[cite: 1]
    [-6, 2, 18, 6, 5, 20],                     // Alerón trasero
  ],
  vistas: {
    arriba: ({ A }, q, p) => {
      const c = q.c;
      p.fondo(N[1]); // Color de fondo por defecto[cite: 1]
      A(-7, -20, 14, 3, c[2]); // Alerón delantero usando el tercer tono de carrocería[cite: 1]
      A(-2, -21, 4, 13, c[1]); // Trompa
      A(-5, -8, 10, 18, c[2]); // Pontones
      // Usa las funciones de pintar píxeles para agregar detalles
    },
    abajo: ({ B }, q, p) => {
      p.fondo(N[0]); // Fondo plano aerodinámico[cite: 1]
      B(-2, -21, 4, 40, METAL[0]); // Superficie inferior metálica[cite: 1]
    },
    costado: ({ L }, q, p, espejo) => {
      const c = q.c;
      p.fondo(N[0]); //[cite: 1]
      L(-21, -2, 6, 1, c[1]); // Trompa lateral
      L(-8, -2, 18, 3, c[2]); // Pontones laterales
      L(18, 2, 2, 3, c[3]);   // Alerón trasero lateral
    },
    frente: ({ F }, q, p) => {
      const c = q.c;
      p.fondo(N[0]); //[cite: 1]
      F(-7, -2, 14, 1, c[2]); // Alerón delantero
    },
    atras: ({ T }, q, p) => {
      const c = q.c;
      p.fondo(N[0]); //[cite: 1]
      T(-6, 2, 12, 3, c[2]); // Alerón trasero
    },
  },
};
// (la lista de modelos va despues de definirlos a todos: si no, el juego no carga)
const MODELOS = { vitarita: VITARITA, kacito: KACITO, chata: CHATA, buggy: BUGGY, camion: CAMION, carguero: CARGUERO, f1: F1 };

// Pinta las vistas y arma la forma de un modelo con una pintura. Se guarda: dos autos iguales comparten todo.
const hechos = new Map();
function modelo(id, q) {
  if (hechos.has(q)) return hechos.get(q);
  const M = MODELOS[id], alto = M.Y1 - M.Y0, atlas = crearAtlas(...(M.atlas || [128, 64]), q.rally ? 0.3 : 0.75), s = q.semilla || 3;   // los de rally resaltan; los de calle se funden con el paisaje
  const zona = (w, h, vista, ...mas) => atlas.zona(w, h, (p) => vista(lapices(p, M), q, p, ...mas), s);
  const vistas = {
    py: zona(M.W, M.L, M.vistas.arriba), ny: zona(M.W, M.L, M.vistas.abajo),
    // el costado derecho se ve espejado (el frente queda a la derecha): ahi los numeros se escriben al reves
    px: zona(M.L, alto, M.vistas.costado, true), nx: zona(M.L, alto, M.vistas.costado, false),
    nz: zona(M.W, alto, M.vistas.frente), pz: zona(M.W, alto, M.vistas.atras),
  };
  // donde cae cada punto del auto en cada vista
  const mx = M.W / 2, mz = M.L / 2;
  const enVista = { px: (e) => [e.z + mz, M.Y1 - e.y], py: (e) => [e.x + mx, e.z + mz], ny: (e) => [mx - e.x, e.z + mz], nz: (e) => [mx - e.x, M.Y1 - e.y], pz: (e) => [e.x + mx, M.Y1 - e.y] };
  enVista.nx = enVista.px;
  const lote = crearLote(), m = new THREE.Matrix4().makeScale(1 / PX, 1 / PX, 1 / PX);
  for (const b of M.cajas(q)) {
    const o = b[6] || {};
    lote.caja(m, b, (cara, e) => {
      const color = o.liso || (o.caras && o.caras[cara]) || (cara[1] !== 'y' && o.lados);
      if (color) { const z = atlas.liso(color); return [z.x + 0.5, z.y + 0.5]; }
      const en = enVista[cara](e);
      return [vistas[cara].x + en[0], vistas[cara].y + en[1]];
    }, o.cuña, o.cuñaAtras);
  }
  // el oxido y el velo del fantasma se pintan encima de todo
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
  // una copia del dibujo limpio: al largar de nuevo, el auto vuelve a estar sin barro
  const limpio = document.createElement('canvas');
  limpio.width = atlas.ancho; limpio.height = atlas.alto;
  limpio.getContext('2d').drawImage(atlas.lienzo, 0, 0);
  const hecho = { atlas, geo: lote.geometria(atlas), mat: new THREE.MeshLambertMaterial({ map: atlas.textura() }), M, vistas, limpio, alto };
  hechos.set(q, hecho);
  return hecho;
}

// --- ruedas: un prisma de diez lados con la llanta pintada ---
const ruedas = new Map();
let gomas = null;
function piezasDeRueda(radio, ancho) {
  const clave = radio + 'x' + ancho;
  if (ruedas.has(clave)) return ruedas.get(clave);
  if (!gomas) {
    const cara = textura(8, 8, (p) => {
      p.fondo(GOMA);
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
    gomas = [new THREE.MeshLambertMaterial({ map: banda }), mCara, mCara];
  }
  const r = { geo: new THREE.CylinderGeometry(radio, radio, ancho, 10).rotateZ(Math.PI / 2), mat: gomas };
  ruedas.set(clave, r);
  return r;
}

// Arma un auto. C: sus medidas (de config.js; "modelo" dice cual es). q: la pintura (por defecto, la de rally de ese modelo).
export function armarAuto(C, q) {
  const id = MODELOS[C.modelo] ? C.modelo : 'vitarita';
  const grupo = new THREE.Group(), modeloHecho = modelo(id, q || PINTURAS[id]), { geo, mat, M } = modeloHecho, r = piezasDeRueda(C.radio, M.rueda);
  const cuerpo = new THREE.Mesh(geo, mat);
  cuerpo.castShadow = true;
  cuerpo.position.z = C.centro || 0;   // el modelo esta centrado entre los ejes; el centro de masa queda un poco mas adelante
  grupo.add(cuerpo);
  // ruedas: un pivote que dobla y adentro la rueda que gira
  const ruedas = [];
  for (let i = 0; i < 4; i++) {
    const pivote = new THREE.Group(), goma = new THREE.Mesh(r.geo, r.mat);
    goma.castShadow = true;
    pivote.add(goma);
    pivote.position.set((i % 2 ? 1 : -1) * C.trocha * 1.06, C.alto === undefined ? (C.anclaje || 0) - C.resorteLargo + 0.13 : C.alto, (i < 2 ? -1 : 1) * C.ejes + (C.centro || 0));
    grupo.add(pivote);
    ruedas.push({ pivote, rueda: goma });
  }
  return { grupo: conEstilo(grupo), ruedas, cuerpo, hecho: modeloHecho };
}

// Un auto del publico, estacionado: cualquiera de los tres modelos, en un color de calle. Devuelve el grupo y a que altura va su centro.
export function armarEstacionado(n) {
  const id = ['chata', 'vitarita', 'kacito', 'chata', 'kacito'][n % 5], M = MODELOS[id];
  const medidas = id === 'chata' ? { ...M.medidas, modelo: id } : id === 'vitarita' ? { modelo: id, radio: 0.37, trocha: 0.72, ejes: 1.1, alto: -0.34 } : { modelo: id, radio: 0.29, trocha: 0.7, ejes: 1.22, alto: -0.25 };
  return { grupo: armarAuto(medidas, deCalle(n)).grupo, alto: medidas.radio - medidas.alto };
}

// --- autos tirados (rotos, oxidados, abandonados en el camino) y autos de los equipos, para la Travesia ---
// Misma forma que los de rally, con otra pintura: cada uno con su propia (asi el barro del auto que se maneja no los mancha).
// El orden de estas listas es el de MEDIDAS_ROTOS y MEDIDAS_EQUIPOS en travesiaterreno.js (que guarda cuanto ocupa cada uno).
const MEDIDAS_VARIOS = {
  chata: { ...CHATA.medidas, modelo: 'chata' },
  vitarita: { modelo: 'vitarita', radio: 0.37, trocha: 0.72, ejes: 1.1, alto: -0.34 },
  kacito: { modelo: 'kacito', radio: 0.29, trocha: 0.7, ejes: 1.22, alto: -0.25 },
  buggy: { modelo: 'buggy', radio: 0.36, trocha: 0.82, ejes: 1.15, alto: -0.59 },
  camion: { modelo: 'camion', radio: 0.46, trocha: 0.86, ejes: 1.7, alto: -0.37 },
};
const ROTOS = [   // [modelo, color, como queda]
  ['chata', '#b5503a', { rally: false, oxido: 0.7, semilla: 41 }],
  ['camion', '#a99a62', { numero: '3', oxido: 0.75, semilla: 42 }],
  ['buggy', '#c8302a', { numero: '7', oxido: 0.6, semilla: 43 }],
  ['kacito', '#8656c8', { numero: '97', franjas: ['#f2c200', '#f4f0e6'], oxido: 0.55, semilla: 44 }],
  ['vitarita', '#f0b41c', { numero: '92', oxido: 0.65, semilla: 45 }],
  ['chata', '#d8d2c2', { rally: false, oxido: 0.8, semilla: 46 }],
];
const EQUIPOS = [
  ['vitarita', '#2f6fb3', { numero: '14', franjas: ['#f4f0e6', '#d8402f'], semilla: 51 }],
  ['buggy', '#f4f0e6', { numero: '21', franjas: ['#2f6fb3', '#d8402f'], semilla: 52 }],
  ['camion', '#f4f0e6', { numero: '300', franjas: ['#d8402f', '#1e1f23'], semilla: 53 }],   // el camion de asistencia
  ['kacito', '#3f9150', { numero: '8', franjas: ['#f2c200', '#f4f0e6'], semilla: 54 }],
  ['chata', '#d8402f', { rally: false, semilla: 55 }],
  ['vitarita', '#f07f1e', { numero: '33', franjas: ['#1e1f23', '#f4f0e6'], semilla: 56 }],
];
const variados = new Map();
function deLista(lista, n) {
  const k = n % lista.length, clave = lista === ROTOS ? 'r' + k : 'e' + k;
  if (!variados.has(clave)) { const [id, base, mas] = lista[k]; variados.set(clave, { id, q: pintura(base, mas) }); }
  const { id, q } = variados.get(clave), M = MEDIDAS_VARIOS[id];
  return { grupo: armarAuto(M, q).grupo, alto: M.radio - M.alto };
}
// un auto tirado y herrumbrado (el grupo y a que altura va su centro)
export const armarRoto = (n) => deLista(ROTOS, n);
// un auto o camion de un equipo, limpio, estacionado en el festival de la largada
export const armarDeEquipo = (n) => deLista(EQUIPOS, n);

// --- el barro en la carrocería: a medida que anda por lo blando o por agua, se van pintando manchas de abajo hacia arriba ---
// Se pinta sobre el mismo lienzo del auto (sin materiales ni objetos nuevos) y se avisa a la placa de video unas pocas veces por segundo.
const MANCHA = { barro: ['#5a2f1b', '#6e3a22', '#4a2616', '#7d4a2c'], tierra: ['#8a5636', '#a06a44', '#74472b'], ripio: ['#a8946e', '#bba682', '#8f7d5c'], pasto: ['#6b6a3c', '#7d7c4a', '#58572f'], agua: ['#6e5a45', '#7d6a54', '#5c4a38'] };
function ensuciador(h) {
  const x = h.atlas.lienzo.getContext('2d'), zonas = ['px', 'nx', 'nz', 'pz', 'py'].map((k) => h.vistas[k]);
  const PESO = [3, 3, 1.5, 1.5, 4], TOTAL = zonas.reduce((a, z, i) => a + z.w * z.h * 0.2 * (PESO[i] / 3), 0);   // cuantos pixeles de mancha tiene el auto totalmente sucio
  let nivel = 0, pintado = 0, sin = 0, a = 12345;
  const azar = () => ((a = (a * 1664525 + 1013904223) >>> 0) / 4294967296);
  function limpiar() {
    nivel = pintado = sin = 0;
    x.clearRect(0, 0, h.atlas.ancho, h.atlas.alto); x.drawImage(h.limpio, 0, 0);
    h.atlas.textura().needsUpdate = true;
  }
  function sumar(c, dt) {
    // cuanto se ensucia segun lo que pisa cada rueda (el barro, mucho; el agua y la tierra, menos) y la velocidad
    const vh = Math.hypot(c.vel[0], c.vel[2]), rapido = Math.min(1, vh / 8);
    let gana = 0, clase = 'barro';
    for (const r of c.ruedas) {
      if (!r.toca) continue;
      const s = SUELO[r.suelo], g = s.blando >= 0.9 ? (c.agua > 0.05 ? 0.7 : 1.4) : c.agua > 0.05 ? 0.6 : s.id === SUELOS.tierra.id ? 0.35 : s.id === SUELOS.pasto.id ? 0.12 : s.id === SUELOS.ripio.id || s.id === SUELOS.gravilla.id ? 0.15 : s.id === SUELOS.sendero.id ? 0.3 : 0;
      if (g > 0) { gana += g; clase = c.agua > 0.05 ? 'agua' : s.id === SUELOS.tierra.id || s.id === SUELOS.sendero.id ? 'tierra' : s.id === SUELOS.pasto.id ? 'pasto' : s.id === SUELOS.ripio.id || s.id === SUELOS.gravilla.id ? 'ripio' : 'barro'; }
    }
    nivel = Math.min(1, nivel + gana * rapido * dt * 0.02);
    sin += dt;
    if (sin < 0.25 || nivel * TOTAL - pintado < 1) return;   // como mucho 4 veces por segundo
    sin = 0;
    const paleta = MANCHA[clase], cuantos = Math.min(40, Math.floor(nivel * TOTAL - pintado));
    for (let n = 0; n < cuantos; n++) {
      let t = azar() * 13, i = 0;
      while (i < 4 && (t -= PESO[i]) > 0) i++;
      const z = zonas[i], arriba = i === 4;
      // de abajo hacia arriba: cuanto mas sucio, mas alto llegan; la mayoria queda cerca del piso
      const techo = arriba ? 1 : 0.18 + 0.5 * nivel, yy = arriba ? Math.floor(azar() * z.h) : z.h - 1 - Math.floor(azar() * azar() * z.h * techo);
      x.fillStyle = paleta[Math.floor(azar() * paleta.length)];
      x.fillRect(z.x + Math.floor(azar() * z.w), z.y + yy, azar() < 0.25 ? 2 : 1, 1);
    }
    pintado += cuantos;
    h.atlas.textura().needsUpdate = true;
  }
  return { sumar, limpiar };
}

const mFreno = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 0.22, 0.12) });   // tan fuerte que deja resplandor
export function crearDibujo(escena, C) {
  const { grupo, ruedas, hecho } = armarAuto(C), M = MODELOS[C.modelo] || VITARITA;
  escena.add(grupo);
  const suciedad = ensuciador(hecho);
  suciedad.limpiar();
  // las luces de freno: dos chapitas rojas en la cola, que se prenden al frenar
  const frenos = new THREE.Group();
  for (const [x, y, z, w, h] of M.frenos || []) {
    const luz = new THREE.Mesh(new THREE.PlaneGeometry(w / PX, h / PX), mFreno);
    luz.position.set(x / PX, y / PX, z / PX + (C.centro || 0));
    frenos.add(luz);
  }
  frenos.visible = false;
  grupo.add(frenos);

  function actualizar(c, dt = 0, sucia = false) {
    if (sucia) suciedad.sumar(c, dt);
    grupo.position.fromArray(c.pos);
    grupo.quaternion.fromArray(c.q);
    c.ruedas.forEach((r, i) => {
      ruedas[i].pivote.position.set(r.x * 1.06, C.anclaje - r.largo, r.z);
      ruedas[i].pivote.rotation.y = r.delantera ? -c.giroRuedas : 0;
      ruedas[i].rueda.rotation.x = -r.giro;
    });
    frenos.visible = c.frenando;
  }
  return { grupo, actualizar, limpiar: suciedad.limpiar };
}

// El fantasma del rival: su auto, translucido y sin sombra, con su nombre arriba.
const espectros = {};
export function crearEspectro(escena, T, C) {
  const id = MODELOS[C.modelo] ? C.modelo : 'vitarita';
  const q = espectros[id] || (espectros[id] = Object.assign({}, PINTURAS[id], { velo: VELO }));
  const { grupo, ruedas, cuerpo } = armarAuto(C, q);
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
  const alto = C.resorteLargo + C.radio - C.masa * 9.81 / 4 / C.resorte - C.anclaje;   // a que altura queda su centro, apoyado
  return {
    nombre: (txt) => {
      const x = lienzo.getContext('2d');
      x.clearRect(0, 0, 256, 64);
      x.font = '700 28px "Atkinson Hyperlegible", "Segoe UI", sans-serif';
      const w = Math.min(244, x.measureText(txt).width + 28);
      x.fillStyle = 'rgba(0, 0, 0, .78)';
      x.fillRect(128 - w / 2, 8, w, 48);
      x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(txt, 128, 33, 232);
      tex.needsUpdate = true;
    },
    // lo pone en la posicion, el rumbo y la altura grabados (o.alto: metros de su centro sobre el piso)
    poner: (o) => {
      const sx = (T.altura(o.x + 1, o.z) - T.altura(o.x - 1, o.z)) / 2, sz = (T.altura(o.x, o.z + 1) - T.altura(o.x, o.z - 1)) / 2;
      V.set(-sx, 1, -sz).normalize();
      grupo.quaternion.setFromUnitVectors(ARRIBA, V).multiply(Q.setFromAxisAngle(ARRIBA, -o.rumbo));
      grupo.position.set(o.x, T.altura(o.x, o.z) + Math.max(alto * 0.6, o.alto === undefined ? alto : o.alto), o.z);
      for (const r of ruedas) r.pivote.rotation.y = 0;
      grupo.visible = true;
    },
    ocultar: () => { grupo.visible = false; },
  };
}

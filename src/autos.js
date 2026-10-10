// Los autos: cajas con una pintura de pocos pixeles (un pixel = 12,5 cm). El frente mira a -Z.
// Hay tres modelos: la Vitarita y el Kacito (los que se corren) y la chata (estacionada, de adorno).
// El dibujo de cada uno sale de cinco vistas pintadas a mano (de arriba, de abajo, de costado, de frente y de atras):
// cada caja toma de cada vista los pixeles que le tocan segun donde esta.
//
// Para cambiar un auto: sus colores estan en PINTURAS, su forma en "cajas" y sus dibujos en "vistas".
import * as THREE from 'three';
import { crearAtlas, crearLote, textura, tono } from './pixel.js';
import { conEstilo } from './material.js';

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
  vitarita: pintura('#f0b41c', { numero: '92' }),                        // amarillo de rally, con las franjas noventosas
  kacito: pintura('#8656c8', { numero: '97', franjas: ['#f2c200', '#f4f0e6'] }),   // violeta, con plasticos grises
  chata: pintura('#e2a21e', { carga: true }),
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
const MODELOS = { vitarita: VITARITA, kacito: KACITO, chata: CHATA };

// Pinta las vistas y arma la forma de un modelo con una pintura. Se guarda: dos autos iguales comparten todo.
const hechos = new Map();
function modelo(id, q) {
  if (hechos.has(q)) return hechos.get(q);
  const M = MODELOS[id], alto = M.Y1 - M.Y0, atlas = crearAtlas(128, 64, q.rally ? 0.3 : 0.75), s = q.semilla || 3;   // los de rally resaltan; los de calle se funden con el paisaje
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
  const hecho = { atlas, geo: lote.geometria(atlas), mat: new THREE.MeshLambertMaterial({ map: atlas.textura() }), M };
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
  const grupo = new THREE.Group(), { geo, mat, M } = modelo(id, q || PINTURAS[id]), r = piezasDeRueda(C.radio, M.rueda);
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
  return { grupo: conEstilo(grupo), ruedas, cuerpo };
}

// Un auto del publico, estacionado: cualquiera de los tres modelos, en un color de calle. Devuelve el grupo y a que altura va su centro.
export function armarEstacionado(n) {
  const id = ['chata', 'vitarita', 'kacito', 'chata', 'kacito'][n % 5], M = MODELOS[id];
  const medidas = id === 'chata' ? { ...M.medidas, modelo: id } : id === 'vitarita' ? { modelo: id, radio: 0.37, trocha: 0.72, ejes: 1.1, alto: -0.34 } : { modelo: id, radio: 0.29, trocha: 0.7, ejes: 1.22, alto: -0.25 };
  return { grupo: armarAuto(medidas, deCalle(n)).grupo, alto: medidas.radio - medidas.alto };
}

const mFreno = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 0.22, 0.12) });   // tan fuerte que deja resplandor
export function crearDibujo(escena, C) {
  const { grupo, ruedas } = armarAuto(C), M = MODELOS[C.modelo] || VITARITA;
  escena.add(grupo);
  // las luces de freno: dos chapitas rojas en la cola, que se prenden al frenar
  const frenos = new THREE.Group();
  for (const [x, y, z, w, h] of M.frenos || []) {
    const luz = new THREE.Mesh(new THREE.PlaneGeometry(w / PX, h / PX), mFreno);
    luz.position.set(x / PX, y / PX, z / PX + (C.centro || 0));
    frenos.add(luz);
  }
  frenos.visible = false;
  grupo.add(frenos);

  function actualizar(c) {
    grupo.position.fromArray(c.pos);
    grupo.quaternion.fromArray(c.q);
    c.ruedas.forEach((r, i) => {
      ruedas[i].pivote.position.set(r.x * 1.06, C.anclaje - r.largo, r.z);
      ruedas[i].pivote.rotation.y = r.delantera ? -c.giroRuedas : 0;
      ruedas[i].rueda.rotation.x = -r.giro;
    });
    frenos.visible = c.frenando;
  }
  return { grupo, actualizar };
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
      x.font = '700 34px "Barlow Condensed", "Arial Narrow", sans-serif';
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

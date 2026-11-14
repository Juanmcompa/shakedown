// Reparto: el pueblo. Siempre el mismo (sale de una semilla fija), porque los viajes guardados tienen que volver a
// pasar por las mismas calles. Una cuadricula de 6 x 6 manzanas con una plaza, casas alrededor de cada manzana, unos
// negocios donde se entregan cosas y algunas esquinas con semaforo.
//
// No dibuja nada (eso es dibujo.js): hace de "terreno" para la fisica del auto de Shakedown, que le pregunta solo cuatro
// cosas: la altura del piso, su inclinacion, que piso es, y contra que puede chocar cerca de un punto (cosasCerca).
// Las versiones pasadas del que juega tambien se chocan: fantasmas.js las anota aca en cada cuadro (ver ponerMoviles).
import { SUELOS } from '../src/config.js';
import { azar } from '../src/noise.js';

export const PASO = 62;            // de una calle a la siguiente (metros)
export const MANZANAS = 6;         // por lado
export const TAM = PASO * MANZANAS; // el pueblo va de 0 a TAM en x y en z (las calles de los bordes, sobre 0 y TAM)
export const CALLE = 5;            // media calle: el asfalto va de -5 a +5 del eje
export const VEREDA = 8;           // y la vereda hasta 8: ahi empiezan las casas
export const BORDE = 46;           // del pueblo para afuera hay campo, y a esta distancia un paredon
export const PLAZA = [2, 3];       // la manzana que es plaza (columna, fila)
const CELDA = 8;

// los negocios: el nombre (en el cartel), un icono y el color del toldo
export const NEGOCIOS = [
  ['ALMACEN', '🥫', '#3f6a4a'], ['PANADERIA', '🥖', '#b5523a'], ['FERRETERIA', '🔩', '#35546e'], ['FARMACIA', '💊', '#3f8a55'],
  ['KIOSCO', '🍬', '#c8402f'], ['CLUB', '⚽', '#2f6fa8'], ['TALLER', '🔧', '#55585e'], ['BAR', '☕', '#6b4a36'],
  ['VERDULERIA', '🥬', '#4f7a55'], ['CORREO', '✉️', '#e0a21e'], ['CARNICERIA', '🥩', '#8a3a2a'], ['LIBRERIA', '📚', '#8a6f9a'],
];
// lo que se lleva en cada viaje (solo para contarlo)
export const CARGAS = ['📦', '🥚', '🍞', '🌵', '🎂', '🥛', '🔑', '📮', '🧀', '🍉', '📻', '💐'];

// las esquinas con semaforo: [calle en x, calle en z] y su desfase en segundos (para que no cambien todos juntos)
export const SEMAFOROS = [[1, 2, 0], [2, 4, 5], [3, 1, 11], [3, 3, 3], [4, 5, 8], [5, 2, 14]].map(([i, j, des]) => ({ i, j, x: i * PASO, z: j * PASO, des }));
export const CICLO = 18;   // segundos: 7 verde, 2 amarillo para un lado; 7 verde, 2 amarillo para el otro
// el color de un semaforo en el segundo t del viaje, para los que van de norte a sur ('ns') o de este a oeste ('eo').
// El reloj es el del viaje: en cada viaje los semaforos hacen lo mismo en el mismo segundo, igual que tus versiones pasadas.
export function colorSemaforo(s, eje, t) {
  const u = ((t + s.des) % CICLO + CICLO) % CICLO;
  if (eje === 'ns') return u < 7 ? 'verde' : u < 9 ? 'amarillo' : 'rojo';
  return u >= 9 && u < 16 ? 'verde' : u >= 16 ? 'amarillo' : 'rojo';
}

// --- el pueblo, armado una sola vez ---
export function crearMapa() {
  const r = azar(2026);
  const entre = (a, b) => a + r() * (b - a);
  const edificios = [], cosas = [], celdas = new Map();
  const clave = (i, j) => i * 4096 + j;
  // anota una cosa en todas las celdas que toca (con 3 m de mas: el auto pregunta por el centro de sus circulos de choque)
  function anotar(o, mapa = celdas) {
    const ex = (o.hx ? Math.abs(o.hx * o.ux) + Math.abs(o.hz * o.uz) : o.r) + 3, ez = (o.hx ? Math.abs(o.hx * o.uz) + Math.abs(o.hz * o.ux) : o.r) + 3;
    for (let i = Math.floor((o.x - ex) / CELDA); i <= Math.floor((o.x + ex) / CELDA); i++)
      for (let j = Math.floor((o.z - ez) / CELDA); j <= Math.floor((o.z + ez) / CELDA); j++) {
        const k = clave(i, j);
        let l = mapa.get(k);
        if (!l) mapa.set(k, (l = []));
        l.push(o);
      }
  }
  const caja = (x, z, hx, hz, clase = 'edificio') => { const o = { x, z, hx, hz, ux: 1, uz: 0, y: 0, duro: 1, clase, tipo: clase, roto: false }; cosas.push(o); anotar(o); return o; };
  const circulo = (x, z, radio, clase) => { const o = { x, z, r: radio, y: 0, duro: 1, clase, tipo: clase, roto: false }; cosas.push(o); anotar(o); return o; };

  // --- las casas: alrededor de cada manzana, de frente a la calle ---
  // lado: hacia donde mira el frente (nx, nz). Los lados norte y sur van de punta a punta; los de este y oeste, entre medio.
  for (let bi = 0; bi < MANZANAS; bi++) for (let bj = 0; bj < MANZANAS; bj++) {
    if (bi === PLAZA[0] && bj === PLAZA[1]) continue;
    const x0 = bi * PASO + VEREDA, x1 = (bi + 1) * PASO - VEREDA, z0 = bj * PASO + VEREDA, z1 = (bj + 1) * PASO - VEREDA;
    const lados = [
      { nx: 0, nz: -1, desde: x0, hasta: x1, frente: z0 },   // norte: mira a la calle de arriba
      { nx: 0, nz: 1, desde: x0, hasta: x1, frente: z1 },    // sur
      { nx: -1, nz: 0, desde: z0 + 13, hasta: z1 - 13, frente: x0 },   // oeste
      { nx: 1, nz: 0, desde: z0 + 13, hasta: z1 - 13, frente: x1 },    // este
    ];
    for (const L of lados) {
      let u = L.desde;
      while (L.hasta - u > 4) {
        let w = Math.min(L.hasta - u, entre(6, 12));
        if (L.hasta - u - w < 5) w = L.hasta - u;   // (no deja pedacitos al final)
        if (r() < 0.12 && w < 10) { u += w; continue; }   // un baldio
        const fondo = entre(8, 12.5), alto = r() < 0.3 ? entre(5.5, 6.5) : entre(2.8, 3.6), medio = u + w / 2;
        // centro de la casa y medias medidas en x y en z
        const x = L.nz ? medio : L.frente - L.nx * fondo / 2, z = L.nz ? L.frente - L.nz * fondo / 2 : medio;
        const hx = L.nz ? w / 2 : fondo / 2, hz = L.nz ? fondo / 2 : w / 2;
        const e = { x, z, hx, hz, alto, ancho: w, nx: L.nx, nz: L.nz, frenteX: L.nz ? medio : L.frente, frenteZ: L.nz ? L.frente : medio, variante: Math.floor(r() * 64), negocio: -1 };
        e.choque = caja(x, z, hx * 0.98, hz * 0.98);
        edificios.push(e);
        u += w;
      }
    }
  }

  // --- la plaza: arboles, un monumento en el medio y canteros ---
  const px0 = PLAZA[0] * PASO + VEREDA, pz0 = PLAZA[1] * PASO + VEREDA, plazaLado = PASO - 2 * VEREDA;
  const arboles = [];
  for (let a = 0; a < 5; a++) for (let b = 0; b < 5; b++) {
    if (a === 2 && b === 2) continue;
    const x = px0 + 4 + a * (plazaLado - 8) / 4 + entre(-1.2, 1.2), z = pz0 + 4 + b * (plazaLado - 8) / 4 + entre(-1.2, 1.2);
    arboles.push({ x, z, alto: entre(5, 8) });
    circulo(x, z, 0.55, 'arbol');
  }
  const monumento = { x: px0 + plazaLado / 2, z: pz0 + plazaLado / 2 };
  circulo(monumento.x, monumento.z, 2.4, 'monumento');

  // --- el paredon de afuera ---
  const lejos = TAM / 2 + BORDE;
  caja(TAM / 2, -BORDE, lejos, 1);
  caja(TAM / 2, TAM + BORDE, lejos, 1);
  caja(-BORDE, TAM / 2, 1, lejos);
  caja(TAM + BORDE, TAM / 2, 1, lejos);

  // --- los negocios: casas anchas, repartidas por todo el pueblo ---
  const candidatos = edificios.filter((e) => e.ancho >= 8 && e.alto < 4);
  for (let i = candidatos.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [candidatos[i], candidatos[j]] = [candidatos[j], candidatos[i]]; }
  const destinos = [];
  for (const e of candidatos) {
    if (destinos.length >= NEGOCIOS.length) break;
    // el lugar de entrega: sobre la calle, pegado al cordon, frente a la puerta
    const x = e.frenteX + e.nx * (VEREDA - 3.6), z = e.frenteZ + e.nz * (VEREDA - 3.6);
    if (destinos.some((d) => Math.abs(d.x - x) + Math.abs(d.z - z) < 110)) continue;
    const n = destinos.length;
    e.negocio = n;
    // estacionado ahi, con la puerta a la derecha: el rumbo del auto (0 = hacia -z, el norte) deja la casa a su derecha
    destinos.push({ n, nombre: NEGOCIOS[n][0], icono: NEGOCIOS[n][1], color: NEGOCIOS[n][2], x, z, rumbo: Math.atan2(-e.nz, -e.nx), edificio: e });
  }

  // --- el orden de los viajes: siempre el mismo. El viaje k va del destino ruta(k) al destino ruta(k + 1) ---
  const ruta = [0];
  function destinoDe(k) {
    while (ruta.length <= k) {
      const de = destinos[ruta[ruta.length - 1]], rr = azar(7919 * ruta.length + 13);
      const buenos = destinos.filter((d) => d !== de && Math.abs(d.x - de.x) + Math.abs(d.z - de.z) > 140 && Math.abs(d.x - de.x) + Math.abs(d.z - de.z) < 330);
      const lista = buenos.length ? buenos : destinos.filter((d) => d !== de);
      ruta.push(lista[Math.floor(rr() * lista.length)].n);
    }
    return destinos[ruta[k]];
  }
  // el viaje k: de donde a donde, que se lleva y cuanto tiempo hay (hasta 2 minutos)
  function viaje(k) {
    const de = destinoDe(k), a = destinoDe(k + 1), lejos = Math.abs(a.x - de.x) + Math.abs(a.z - de.z);
    return { k, de, a, carga: CARGAS[k % CARGAS.length], limite: Math.min(120, Math.round(28 + lejos / 7.5)) };
  }

  // --- el terreno, para la fisica: todo plano ---
  const cerca = (v) => { const k = Math.round(v / PASO); return k >= 0 && k <= MANZANAS ? Math.abs(v - k * PASO) : 1e9; };
  const adentro = (v, m) => v > -m && v < TAM + m;
  // que hay en un punto: 'calle', 'vereda', 'plaza', 'patio' (el fondo de las manzanas) o 'campo'
  function zona(x, z) {
    const dx = cerca(x), dz = cerca(z);
    if ((dx <= CALLE && adentro(z, CALLE)) || (dz <= CALLE && adentro(x, CALLE))) return 'calle';
    if ((dx <= VEREDA && adentro(z, VEREDA)) || (dz <= VEREDA && adentro(x, VEREDA))) return 'vereda';
    if (!adentro(x, 0) || !adentro(z, 0)) return 'campo';
    if (Math.floor(x / PASO) === PLAZA[0] && Math.floor(z / PASO) === PLAZA[1]) return 'plaza';
    return 'patio';
  }
  const PISOS = { calle: SUELOS.asfalto, vereda: SUELOS.vereda, plaza: SUELOS.pasto, patio: SUELOS.tierra, campo: SUELOS.pasto };
  let moviles = null;   // las celdas con las versiones pasadas de este cuadro (ver ponerMoviles)
  const T = {
    altura: () => 0,
    normal: (x, z, o) => { o[0] = 0; o[1] = 1; o[2] = 0; return o; },
    suelo: (x, z, o) => {
      const s = PISOS[zona(x, z)];
      o.agarre = s.agarre; o.freno = s.freno; o.pasta = s.pasta; o.id = s.id; o.agua = 0;
      return o;
    },
    cosasCerca: (x, z) => {
      const k = clave(Math.floor(x / CELDA), Math.floor(z / CELDA));
      return (moviles && moviles.get(k)) || celdas.get(k);
    },
    // Las versiones pasadas de este cuadro: una lista de cajas que se mueven. Se arma un mapa aparte con las celdas que tocan
    // (cada una con lo fijo de esa celda mas los autos que pasan), asi el auto choca contra todo sin tocar su fisica.
    ponerMoviles: (lista) => {
      if (!lista.length) { moviles = null; return; }
      const m = new Map();
      for (const o of lista) anotar(o, m);
      for (const [k, l] of m) { const fijos = celdas.get(k); if (fijos) l.push(...fijos); }
      moviles = m;
    },
    zona,
  };
  return { T, edificios, arboles, monumento, destinos, viaje, cosas };
}

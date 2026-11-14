// Reparto: el pueblo. Siempre el mismo (sale de una semilla fija), porque los viajes guardados tienen que volver a
// pasar por las mismas calles. Pocas calles, para que el lio llegue rapido: dos avenidas que se cruzan en el medio, una
// diagonal que corta el pueblo, algunas calles que no siguen, una plaza, el deposito central con sus andenes, negocios
// con lugar para estacionar en la vereda y semaforos en las esquinas de las avenidas.
//
// No dibuja nada (eso es dibujo.js): hace de "terreno" para la fisica de Shakedown, que le pregunta solo cuatro cosas: la
// altura del piso, su inclinacion, que piso es, y contra que puede chocar cerca de un punto (cosasCerca).
// Las versiones pasadas del que juega tambien se chocan: fantasmas.js las anota aca en cada cuadro (ver ponerMoviles).
//
// Tambien decide los viajes (ver "los viajes", al final): siempre los mismos, en el mismo orden.
import { SUELOS } from '../src/config.js';
import { azar } from '../src/noise.js';

export const TAM = 320;            // el pueblo va de 0 a TAM en x y en z
export const VEREDA = 3;           // ancho de la vereda
export const BORDE = 44;           // del pueblo para afuera hay campo, y a esta distancia un paredon
const CALLE = 4.5, AVENIDA = 8, DIAGONAL = 5;
// las calles: [x1, z1, x2, z2, media calle]. Las avenidas van primero (asi les tocan las casas primero).
export const CALLES = [
  [160, 0, 160, TAM, AVENIDA], [0, 160, TAM, 160, AVENIDA],
  [0, 240, 240, 0, DIAGONAL],
  [0, 0, 0, TAM, CALLE], [80, 80, 80, TAM, CALLE], [240, 0, 240, 240, CALLE], [TAM, 0, TAM, TAM, CALLE],
  [0, 0, TAM, 0, CALLE], [0, 80, TAM, 80, CALLE], [0, 240, 160, 240, CALLE], [0, TAM, TAM, TAM, CALLE],
].map(([x1, z1, x2, z2, m], i) => { const L = Math.hypot(x2 - x1, z2 - z1); return { i, x1, z1, x2, z2, m, L, ux: (x2 - x1) / L, uz: (z2 - z1) / L }; });
export const PLAZA = { x0: 80, z0: 240, x1: 160, z1: TAM };   // la manzana que es plaza
// El deposito central: un galpon con andenes (las puertas donde se carga) y un playon abierto a la calle de abajo.
// De ahi sale y ahi vuelve buena parte de los viajes: es donde mas se cruzan tus versiones pasadas.
export const DEPOSITO = { x0: 250, x1: 310, z0: 246, zAnden: 262, z1: 316 };
const ANDENES = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => 254 + i * 7.2);   // ocho portones

// Los negocios: el nombre (en el cartel), que se les lleva, el color del toldo y en que se lleva:
// 'camioneta' (lo chico: va en la caja abierta), 'furgon' o 'camion'.
export const NEGOCIOS = [
  ['PANADERIA', '🌾', '#b5523a', 'camioneta'], ['FARMACIA', '💊', '#3f8a55', 'camioneta'], ['FLORERIA', '💐', '#c8608a', 'camioneta'],
  ['HELADERIA', '🍦', '#5aa6c8', 'camioneta'], ['KIOSCO', '🍬', '#c8402f', 'camioneta'], ['VERDULERIA', '🥕', '#4f7a55', 'camioneta'],
  ['CARNICERIA', '🥩', '#8a3a2a', 'camioneta'], ['VETERINARIA', '🦴', '#6b8a3a', 'camioneta'], ['BAR', '🍺', '#6b4a36', 'camioneta'],
  ['FERRETERIA', '🔩', '#35546e', 'furgon'], ['CORREO', '📮', '#e0a21e', 'furgon'], ['LIBRERIA', '📚', '#8a6f9a', 'furgon'],
  ['CLUB', '⚽', '#2f6fa8', 'furgon'], ['TALLER', '🔧', '#55585e', 'furgon'], ['ESCUELA', '✏️', '#3f6a4a', 'furgon'],
  ['MUNICIPALIDAD', '📁', '#7d8a84', 'furgon'], ['ALMACEN', '🥫', '#a8735a', 'furgon'], ['SUPERMERCADO', '🛒', '#2f8a6f', 'camion'],
];

// los semaforos: en las esquinas de las avenidas (donde solo se cruzan calles derechas), con su desfase en segundos
export const SEMAFOROS = [[160, 160, 0], [240, 160, 6], [160, 240, 11], [240, 80, 3], [80, 240, 14]].map(([x, z, des]) => ({ x, z, des }));
export const CICLO = 18;   // segundos: 7 verde, 2 amarillo para un lado; 7 verde, 2 amarillo para el otro
// el color de un semaforo en el segundo t del viaje, para los que van de norte a sur ('ns') o de este a oeste ('eo').
// El reloj es el del viaje: en cada viaje los semaforos hacen lo mismo en el mismo segundo, igual que tus versiones pasadas.
export function colorSemaforo(s, eje, t) {
  const u = ((t + s.des) % CICLO + CICLO) % CICLO;
  if (eje === 'ns') return u < 7 ? 'verde' : u < 9 ? 'amarillo' : 'rojo';
  return u >= 9 && u < 16 ? 'verde' : u >= 16 ? 'amarillo' : 'rojo';
}

// distancia de un punto a una calle (al eje) y en que parte del largo cae (t, de 0 a L)
export function aCalle(s, x, z) {
  const t = Math.max(0, Math.min(s.L, (x - s.x1) * s.ux + (z - s.z1) * s.uz));
  return { d: Math.hypot(x - s.x1 - s.ux * t, z - s.z1 - s.uz * t), t };
}

// --- lo que hay en cada lugar, en un cuadriculado de 50 cm ---
export const Z = { campo: 0, calle: 1, vereda: 2, plaza: 3, patio: 4, casa: 5, bahia: 6 };
const RES = 0.5, X0 = -BORDE, NR = Math.round((TAM + 2 * BORDE) / RES);
const CELDA = 8;

export function crearMapa() {
  const r = azar(2026);
  const entre = (a, b) => a + r() * (b - a);

  // --- el cuadriculado: calles, veredas, plaza, patios ---
  const zona = new Uint8Array(NR * NR);
  for (let j = 0; j < NR; j++) for (let i = 0; i < NR; i++) {
    const x = X0 + (i + 0.5) * RES, z = X0 + (j + 0.5) * RES;
    let z_ = x >= 0 && x <= TAM && z >= 0 && z <= TAM ? (x > PLAZA.x0 && x < PLAZA.x1 && z > PLAZA.z0 && z < PLAZA.z1 ? Z.plaza : Z.patio) : Z.campo;
    for (const s of CALLES) {
      const d = aCalle(s, x, z).d;
      if (d <= s.m) { z_ = Z.calle; break; }
      if (d <= s.m + VEREDA) z_ = Z.vereda;
    }
    // el deposito: el galpon y el playon (que se come la vereda de abajo: se entra de la calle)
    if (x > DEPOSITO.x0 && x < DEPOSITO.x1 && z > DEPOSITO.z0 && z < DEPOSITO.z1 && z_ !== Z.calle) z_ = z < DEPOSITO.zAnden ? Z.casa : Z.bahia;
    zona[j * NR + i] = z_;
  }
  const celda = (x, z) => { const i = Math.floor((x - X0) / RES), j = Math.floor((z - X0) / RES); return i < 0 || j < 0 || i >= NR || j >= NR ? -1 : j * NR + i; };
  const zonaEn = (x, z) => { const k = celda(x, z); return k < 0 ? Z.campo : zona[k]; };

  // --- lo que se choca: en celdas de 8 m ---
  const cosas = [], celdas = new Map();
  const clave = (i, j) => i * 4096 + j;
  // anota una cosa en todas las celdas que toca (con 4 m de mas: el auto pregunta por el centro de sus circulos de choque)
  function anotar(o, mapa = celdas) {
    const ex = (o.hx ? Math.abs(o.hx * o.ux) + Math.abs(o.hz * o.uz) : o.r) + 4, ez = (o.hx ? Math.abs(o.hx * o.uz) + Math.abs(o.hz * o.ux) : o.r) + 4;
    for (let i = Math.floor((o.x - ex) / CELDA); i <= Math.floor((o.x + ex) / CELDA); i++)
      for (let j = Math.floor((o.z - ez) / CELDA); j <= Math.floor((o.z + ez) / CELDA); j++) {
        const k = clave(i, j);
        let l = mapa.get(k);
        if (!l) mapa.set(k, (l = []));
        l.push(o);
      }
  }
  // una caja: centro, medio largo a lo largo de (ux, uz) y medio ancho de costado
  const caja = (x, z, hx, hz, ux = 1, uz = 0, clase = 'edificio') => { const o = { x, z, hx, hz, ux, uz, y: 0, duro: 1, clase, tipo: clase, roto: false }; cosas.push(o); anotar(o); return o; };
  const circulo = (x, z, radio, clase) => { const o = { x, z, r: radio, y: 0, duro: 1, clase, tipo: clase, roto: false }; cosas.push(o); anotar(o); return o; };
  // recorre los puntos de un rectangulo girado (cada 50 cm)
  function cadaPunto(x, z, hx, hz, ux, uz, f) {
    for (let a = -hx + 0.25; a < hx; a += RES) for (let b = -hz + 0.25; b < hz; b += RES) if (f(x + ux * a - uz * b, z + uz * a + ux * b) === false) return false;
    return true;
  }

  // --- el deposito: el galpon se choca; el playon tiene paredes a los costados ---
  const D = DEPOSITO;
  caja((D.x0 + D.x1) / 2, (D.z0 + D.zAnden) / 2, (D.x1 - D.x0) / 2, (D.zAnden - D.z0) / 2);
  caja(D.x0 - 0.3, (D.zAnden + D.z1 - 4) / 2, 0.3, (D.z1 - 4 - D.zAnden) / 2);
  caja(D.x1 + 0.3, (D.zAnden + D.z1 - 4) / 2, 0.3, (D.z1 - 4 - D.zAnden) / 2);

  // --- las casas: a lo largo de cada calle, de los dos lados, de frente a ella ---
  const edificios = [];
  for (const s of CALLES) for (const lado of [1, -1]) {
    const nx = -s.uz * lado, nz = s.ux * lado;   // de la calle hacia las casas
    let a = 0;
    while (a < s.L - 5) {
      if (r() < 0.1) { a += entre(5, 9); continue; }   // un baldio
      let hecho = false;
      for (const [w0, f0] of [[entre(7, 12), entre(9, 13)], [entre(6, 8), entre(7, 9)]]) {
        const w = Math.min(w0, s.L - a), fondo = f0, desde = s.m + VEREDA;
        const cx = s.x1 + s.ux * (a + w / 2) + nx * (desde + fondo / 2), cz = s.z1 + s.uz * (a + w / 2) + nz * (desde + fondo / 2);
        const libre = cadaPunto(cx, cz, w / 2, fondo / 2, s.ux, s.uz, (x, z) => { const q = zonaEn(x, z); return q === Z.patio || q === Z.campo; });
        if (!libre || w < 5) continue;
        cadaPunto(cx, cz, w / 2, fondo / 2, s.ux, s.uz, (x, z) => { zona[celda(x, z)] = Z.casa; });
        const alto = r() < 0.3 ? entre(5.5, 6.5) : entre(2.8, 3.6);
        const e = { x: cx, z: cz, hx: w / 2, hz: fondo / 2, ux: s.ux, uz: s.uz, alto, ancho: w, fondo, nx: -nx, nz: -nz, calle: s, lado, a: a + w / 2,
          frenteX: cx - nx * fondo / 2, frenteZ: cz - nz * fondo / 2, variante: Math.floor(r() * 64), negocio: -1 };
        e.choque = caja(cx, cz, w / 2 * 0.98, fondo / 2 * 0.98, s.ux, s.uz);
        edificios.push(e);
        a += w + 0.3; hecho = true;
        break;
      }
      if (!hecho) a += 2;
    }
  }

  // --- la plaza: arboles (lejos de los caminitos), un monumento en el medio ---
  const arboles = [], pcx = (PLAZA.x0 + PLAZA.x1) / 2, pcz = (PLAZA.z0 + PLAZA.z1) / 2;
  for (let x = PLAZA.x0 + 6; x < PLAZA.x1 - 4; x += 8) for (let z = PLAZA.z0 + 6; z < PLAZA.z1 - 4; z += 8) {
    const ax = x + entre(-1.5, 1.5), az = z + entre(-1.5, 1.5);
    if (Math.abs(ax - pcx) < 3.5 || Math.abs(az - pcz) < 3.5 || zonaEn(ax, az) !== Z.plaza) continue;
    arboles.push({ x: ax, z: az, alto: entre(5, 8) });
    circulo(ax, az, 0.55, 'arbol');
  }
  const monumento = { x: pcx, z: pcz };
  circulo(pcx, pcz, 2.4, 'monumento');

  // --- el paredon de afuera ---
  const lejos = TAM / 2 + BORDE;
  caja(TAM / 2, -BORDE, lejos, 1); caja(TAM / 2, TAM + BORDE, lejos, 1);
  caja(-BORDE, TAM / 2, 1, lejos); caja(TAM + BORDE, TAM / 2, 1, lejos);

  // --- los destinos: los andenes del deposito y los negocios ---
  // Un anden: el vehiculo estaciona de trompa a la calle (rumbo pi: mirando hacia +z), con la cola contra la puerta.
  const destinos = ANDENES.map((x, i) => ({ n: i, anden: i, deposito: true, nombre: 'DEPOSITO', icono: '🏭', color: '#2f6fa8', tamano: 'camion',
    x, z: D.zAnden + 4.4, rumbo: Math.PI, salida: { x, z: TAM - 2 }, puerta: { x, z: D.zAnden + 0.6 } }));   // (se sale por la calle de abajo)
  // Los negocios: casas anchas, repartidas por todo el pueblo, con una bahia en la vereda para estacionar.
  const BAHIA = 4.5;   // medio largo de la bahia
  const candidatos = edificios.filter((e) => e.ancho >= 8 && e.alto < 4 && e.a > BAHIA && e.a < e.calle.L - BAHIA);
  for (let i = candidatos.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [candidatos[i], candidatos[j]] = [candidatos[j], candidatos[i]]; }
  let cual = 0;
  for (const e of candidatos) {
    if (cual >= NEGOCIOS.length) break;
    const s = e.calle, nx = -e.nx, nz = -e.nz;   // de la calle hacia la casa
    const ex = s.x1 + s.ux * e.a, ez = s.z1 + s.uz * e.a;   // el punto del eje de la calle frente a la puerta
    // la bahia: toda la vereda frente a la puerta, sin tocar otra calle (no en una esquina)
    const bx = ex + nx * (s.m + VEREDA / 2), bz = ez + nz * (s.m + VEREDA / 2);
    if (!cadaPunto(bx, bz, BAHIA, VEREDA / 2 - 0.05, s.ux, s.uz, (x, z) => zonaEn(x, z) === Z.vereda)) continue;
    if (destinos.some((d) => Math.hypot(d.x - bx, d.z - bz) < 55)) continue;
    cadaPunto(bx, bz, BAHIA, VEREDA / 2, s.ux, s.uz, (x, z) => { zona[celda(x, z)] = Z.bahia; });
    const [nombre, icono, color, tamano] = NEGOCIOS[cual++];
    e.negocio = destinos.length;
    e.alto = Math.max(e.alto, 4.4);   // (un negocio es mas alto: el cartel y el toldo van por arriba de la camioneta)
    // estacionado en la bahia, a lo largo de la calle, con la puerta a la derecha (rumbo 0 = hacia -z; la derecha es (cos, sin))
    destinos.push({ n: destinos.length, nombre, icono, color, tamano, x: bx, z: bz, rumbo: Math.atan2(nz, nx), edificio: e,
      bahia: { x: bx, z: bz, hx: BAHIA, hz: VEREDA / 2, ux: s.ux, uz: s.uz } });
  }

  // --- el terreno, para la fisica: todo plano ---
  const PISOS = [SUELOS.pasto, SUELOS.asfalto, SUELOS.vereda, SUELOS.pasto, SUELOS.tierra, SUELOS.tierra, SUELOS.asfalto];
  let moviles = null;   // las celdas con las versiones pasadas de este cuadro (ver ponerMoviles)
  const T = {
    altura: () => 0,
    normal: (x, z, o) => { o[0] = 0; o[1] = 1; o[2] = 0; return o; },
    suelo: (x, z, o) => {
      const s = PISOS[zonaEn(x, z)];
      o.agarre = s.agarre; o.freno = s.freno; o.pasta = s.pasta; o.id = s.id; o.agua = 0;
      return o;
    },
    cosasCerca: (x, z) => {
      const k = clave(Math.floor(x / CELDA), Math.floor(z / CELDA));
      return (moviles && moviles.get(k)) || celdas.get(k);
    },
    // Lo que se mueve en este cuadro (las versiones pasadas, las cajas que se cayeron): una lista de cajas y circulos.
    // Se arma un mapa aparte con las celdas que tocan (cada una con lo fijo de esa celda mas lo que se mueve), asi el auto
    // choca contra todo sin tocar su fisica.
    ponerMoviles: (lista) => {
      if (!lista.length) { moviles = null; return; }
      const m = new Map();
      for (const o of lista) anotar(o, m);
      for (const [k, l] of m) { const fijos = celdas.get(k); if (fijos) l.push(...fijos); }
      moviles = m;
    },
    zona: zonaEn,
  };
  const red = crearRed();
  return { T, edificios, arboles, monumento, destinos, cosas, red, viaje: crearViajes(destinos, red) };
}

// --- la red de calles: las esquinas (donde se cruzan o terminan) y que esquinas une cada calle ---
// La usan el dibujo (sendas peatonales, lineas de pare), los viajes (que tan lejos queda cada lugar) y el piloto de las pruebas.
function crearRed() {
  const nodos = [];
  const nodo = (x, z) => {
    let n = nodos.find((q) => Math.hypot(q.x - x, q.z - z) < 0.5);
    if (!n) nodos.push((n = { id: nodos.length, x, z, calles: new Set(), vecinos: [] }));
    return n;
  };
  for (const s of CALLES) { nodo(s.x1, s.z1).calles.add(s); nodo(s.x2, s.z2).calles.add(s); }
  for (const a of CALLES) for (const b of CALLES) {
    if (a.i >= b.i) continue;
    const den = a.ux * b.uz - a.uz * b.ux;
    if (Math.abs(den) < 1e-6) continue;
    const t = ((b.x1 - a.x1) * b.uz - (b.z1 - a.z1) * b.ux) / den, u = ((b.x1 - a.x1) * a.uz - (b.z1 - a.z1) * a.ux) / den;
    if (t < -0.01 || t > a.L + 0.01 || u < -0.01 || u > b.L + 0.01) continue;
    const n = nodo(a.x1 + a.ux * t, a.z1 + a.uz * t);
    n.calles.add(a); n.calles.add(b);
  }
  // cada calle une sus esquinas en orden
  for (const s of CALLES) {
    const en = nodos.filter((n) => aCalle(s, n.x, n.z).d < 0.5).sort((p, q) => aCalle(s, p.x, p.z).t - aCalle(s, q.x, q.z).t);
    for (const n of en) n.calles.add(s);
    for (let k = 1; k < en.length; k++) {
      const largo = Math.hypot(en[k].x - en[k - 1].x, en[k].z - en[k - 1].z);
      en[k - 1].vecinos.push({ n: en[k], largo, calle: s }); en[k].vecinos.push({ n: en[k - 1], largo, calle: s });
    }
  }
  for (const n of nodos) n.calles = [...n.calles];
  return { nodos };
}

// la calle mas cercana a un punto y las dos esquinas de esa cuadra (con lo que falta hasta cada una)
function cuadra(red, x, z) {
  let s = CALLES[0], d = 1e9;
  for (const q of CALLES) { const e = aCalle(q, x, z).d; if (e < d) { d = e; s = q; } }
  const t = aCalle(s, x, z).t;
  const en = red.nodos.filter((n) => aCalle(s, n.x, n.z).d < 0.5).map((n) => ({ n, t: aCalle(s, n.x, n.z).t })).sort((a, b) => a.t - b.t);
  let a = en[0], b = en[en.length - 1];
  for (let k = 1; k < en.length; k++) if (en[k].t >= t) { a = en[k - 1]; b = en[k]; break; }
  return { s, d, puntas: [a, b].map((p) => ({ n: p.n, d: Math.abs(p.t - t) })) };
}

// El camino mas corto por las calles: la lista de puntos (las esquinas por las que pasa y, al final, el destino), su
// largo en metros, y las cuadras que recorre (pares de esquinas, para saber cuanto se pisan dos caminos).
// (un anden del deposito se conecta con la calle por su "salida": se entra y se sale por el playon)
export function camino(red, desde, hasta) {
  const p0 = desde.salida || desde, p1 = hasta.salida || hasta, extra = (desde.salida ? Math.hypot(desde.x - p0.x, desde.z - p0.z) : 0) + (hasta.salida ? Math.hypot(hasta.x - p1.x, hasta.z - p1.z) : 0);
  const fin = hasta.salida ? [{ x: p1.x, z: p1.z }, { x: hasta.x, z: hasta.z }] : [{ x: hasta.x, z: hasta.z }];
  const inicio = desde.salida ? [{ x: p0.x, z: p0.z }] : [];
  const A = cuadra(red, p0.x, p0.z), B = cuadra(red, p1.x, p1.z);
  const N = red.nodos.length, dist = new Float64Array(N).fill(Infinity), antes = new Int32Array(N).fill(-1), hecho = new Uint8Array(N);
  for (const p of A.puntas) dist[p.n.id] = Math.min(dist[p.n.id], p.d + A.d);
  for (;;) {
    let k = -1;
    for (let q = 0; q < N; q++) if (!hecho[q] && dist[q] < Infinity && (k < 0 || dist[q] < dist[k])) k = q;
    if (k < 0) break;
    hecho[k] = 1;
    for (const v of red.nodos[k].vecinos) if (dist[k] + v.largo < dist[v.n.id]) { dist[v.n.id] = dist[k] + v.largo; antes[v.n.id] = k; }
  }
  if (A.s === B.s && A.puntas[0].n === B.puntas[0].n)   // en la misma cuadra: derecho
    return { puntos: [...inicio, ...fin], largo: Math.hypot(p1.x - p0.x, p1.z - p0.z) + extra, cuadras: [] };
  let mejor = B.puntas[0];
  for (const p of B.puntas) if (dist[p.n.id] + p.d < dist[mejor.n.id] + mejor.d) mejor = p;
  const ids = [];
  for (let k = mejor.n.id; k >= 0; k = antes[k]) ids.unshift(k);
  const cuadras = [];
  for (let k = 1; k < ids.length; k++) cuadras.push(Math.min(ids[k], ids[k - 1]) * 1000 + Math.max(ids[k], ids[k - 1]));
  return { puntos: [...inicio, ...ids.map((k) => ({ x: red.nodos[k].x, z: red.nodos[k].z })), ...fin], largo: dist[mejor.n.id] + mejor.d + B.d + extra, cuadras };
}

// --- los viajes ---
// Van en vueltas de 5. En cada vuelta (v = 0, 1, 2...):
//   1. del deposito a un negocio
//   2. de vuelta al deposito: por el mismo camino, de frente con tu viaje anterior (asi, en el segundo viaje, te cruzas
//      con tu primera version: el juego lo explica ahi)
//   3. del deposito a otro negocio
//   4. de ese negocio a otro, elegido para que el viaje siguiente pise las calles mas usadas
//   5. de vuelta al deposito, en camion (desde la entrega 15, en semi): el punto culminante. Pasa por donde mas viajes pasaron.
// En el deposito siempre se estaciona de culata: con la cola contra el porton y la trompa hacia el playon.
// Cada llegada al deposito usa un porton distinto, en rueda (1, 4, 7, 2, 5, 0, 3, 6, y de nuevo): el que llega sale despues
// por el mismo porton, y ese porton no se vuelve a usar hasta 8 llegadas mas tarde. Asi los camiones no se pisan en la puerta.
// Cada vuelta, los viajes son mas largos. Todo sale de una semilla fija: siempre los mismos viajes, en el mismo orden.
function crearViajes(destinos, red) {
  const andenes = destinos.filter((d) => d.deposito), negocios = destinos.filter((d) => !d.deposito);
  const lista = [];   // los viajes ya decididos: { de, a, camino }
  const largoEntre = new Map();
  const largo = (a, b) => { const k = a.n * 100 + b.n; if (!largoEntre.has(k)) largoEntre.set(k, camino(red, a, b).largo); return largoEntre.get(k); };
  // que tan lejos puede quedar un negocio, segun la vuelta
  const rango = (v) => [60 + 45 * v, 170 + 60 * v];
  // de los negocios que quedan a buena distancia, uno al azar (o el que mejor puntue, si se da "puntaje")
  function elegir(de, v, rr, puntaje, sacar = []) {
    const [min, max] = rango(v);
    let buenos = negocios.filter((d) => d !== de && !sacar.includes(d) && largo(de, d) >= min && largo(de, d) <= max);
    if (!buenos.length) {   // (si no hay ninguno en el rango: los mas cercanos al rango)
      const fuera = (d) => { const l = largo(de, d); return l < min ? min - l : l > max ? l - max : 0; };
      buenos = negocios.filter((d) => d !== de && !sacar.includes(d)).sort((a, b) => fuera(a) - fuera(b)).slice(0, 3);
    }
    if (!puntaje) return buenos[Math.floor(rr() * buenos.length)];
    let mejor = null, pm = -Infinity;
    for (const d of buenos) { const p = puntaje(d) + rr() * 0.5; if (p > pm) { pm = p; mejor = d; } }
    return mejor;
  }
  // cuantas cuadras de un camino ya recorrieron los viajes anteriores (contando cada viaje)
  const pisadas = (cuadras) => { let p = 0; for (const v of lista) for (const q of v.camino.cuadras) if (cuadras.includes(q)) p++; return p; };
  function decidir(k) {
    const v = Math.floor(k / 5), i = k % 5, rr = azar(7919 * k + 13);
    // el porton de la llegada de este viaje (la primera de la vuelta en el viaje 2, la segunda en el 5)
    const anden = andenes[(1 + 3 * (2 * v + (i >= 2 ? 1 : 0))) % andenes.length];
    const de = k === 0 ? andenes[0] : lista[k - 1].a;
    // (los negocios de los ultimos viajes no se repiten enseguida)
    const recientes = lista.slice(-8).flatMap((x) => [x.de, x.a]);
    const [, max] = rango(v);
    let a, tipo;
    if (i === 0 || i === 2) { a = elegir(de, v, rr, null, recientes); tipo = a.tamano; }
    else if (i === 1) { a = anden; tipo = lista[k - 1].tipo; }
    else if (i === 3) {
      // el que deja el viaje siguiente (la hora pico) por las calles mas usadas, sin que quede demasiado lejos del deposito
      a = elegir(de, v, rr, (d) => pisadas(camino(red, d, anden).cuadras) - Math.max(0, largo(d, anden) - max * 1.2) * 0.5, recientes);
      tipo = a.tamano;
    } else { a = anden; tipo = k >= 14 ? 'semi' : 'camion'; }   // (desde la hora pico de la entrega 15, en semi)
    const c = camino(red, de, a);
    lista.push({ de, a, tipo, camino: c });
  }
  // el viaje k: de donde a donde, que se lleva, en que, y cuanto tiempo hay (hasta 2 minutos)
  return function viaje(k) {
    while (lista.length <= k) decidir(lista.length);
    const { de, a, tipo, camino: c } = lista[k];
    // el tiempo: segun el largo y el vehiculo, mas lo que lleva estacionar de culata en el deposito
    const lento = { camion: 1.25, semi: 1.45 }[tipo] || 1, culata = a.deposito ? (tipo === 'semi' ? 30 : 10) : 0;
    return { k, de, a, tipo, carga: a.deposito ? '📦' : a.icono, camino: c, culmine: k % 5 === 4, limite: Math.min(120, Math.round((22 + c.largo / 7) * lento + culata)) };
  };
}

// Reparto: el pueblo. Siempre el mismo (sale de una semilla fija), porque los viajes guardados tienen que volver a
// pasar por las mismas calles. Pocas calles, para que el lio llegue rapido: dos avenidas que se cruzan en el medio, una
// diagonal que corta el pueblo, algunas calles que no siguen, una plaza, el deposito central con sus andenes, negocios
// con lugar para estacionar en la vereda y semaforos en las esquinas de las avenidas.
//
// El pueblo crece a medida que se juega (en la misma partida): tiene tres zonas, y las que todavia no se abrieron estan
// detras de unas vallas de obra (se ven, pero no se puede pasar).
//   zona 1: el pueblo de siempre (de 0 a TAM). Desde la primera entrega.
//   zona 2: al este. Calles nuevas, otra rotonda y el deposito 2. Se abre con la entrega 30.
//   zona 3: al sur. La terminal de colectivos (con paradas por todo el pueblo) y la base de radio taxi. Se abre con la 50.
//
// No dibuja nada (eso es dibujo.js): hace de "terreno" para la fisica de Shakedown, que le pregunta solo cuatro cosas: la
// altura del piso, su inclinacion, que piso es, y contra que puede chocar cerca de un punto (cosasCerca).
// Las versiones pasadas del que juega tambien se chocan: fantasmas.js las anota aca en cada cuadro (ver ponerMoviles).
//
// Tambien decide los viajes (ver "los viajes", al final): siempre los mismos, en el mismo orden.
import { SUELOS } from '../src/config.js';
import { azar } from '../src/noise.js';

export const TAM = 320;            // la zona 1 (el pueblo de siempre) va de 0 a TAM en x y en z
export const XMAX = 560, ZMAX = 480;   // el pueblo entero, con todas las zonas
export const LIMITE = 341;         // donde van las vallas de obra: al este de x = LIMITE, la zona 2; al sur de z = LIMITE, la 3
export const zonaDe = (x, z) => (z > LIMITE ? 3 : x > LIMITE ? 2 : 1);
// las entregas con las que se abre cada zona (y cambia lo que se hace: ver los viajes, al final)
export const ABRE = { 2: 30, 3: 50 }, TAXIS = 70;
export const zonasAbiertas = (k) => (k >= ABRE[3] ? 3 : k >= ABRE[2] ? 2 : 1);
export const VEREDA = 3;           // ancho de la vereda
export const BORDE = 44;           // del pueblo para afuera hay campo, y a esta distancia un paredon
const CALLE = 4.5, AVENIDA = 8, DIAGONAL = 5;
// las calles: [x1, z1, x2, z2, media calle]. Las avenidas van primero (asi les tocan las casas primero).
export const CALLES = [
  [160, 0, 160, TAM, AVENIDA], [0, 160, TAM, 160, AVENIDA],
  [TAM, 160, XMAX, 160, AVENIDA], [160, TAM, 160, ZMAX, AVENIDA],   // (las dos avenidas siguen en las zonas nuevas)
  [0, 240, 240, 0, DIAGONAL],
  [0, 0, 0, TAM, CALLE], [80, 80, 80, TAM, CALLE], [240, 0, 240, 240, CALLE], [TAM, 0, TAM, TAM, CALLE],
  [0, 0, TAM, 0, CALLE], [0, 80, TAM, 80, CALLE], [0, 240, 160, 240, CALLE], [0, TAM, TAM, TAM, CALLE],
  // zona 2 (al este)
  [TAM, 0, XMAX, 0, CALLE], [TAM, 80, XMAX, 80, CALLE], [TAM, TAM, XMAX, TAM, CALLE], [440, 0, 440, TAM, CALLE],
  [XMAX, 0, XMAX, ZMAX, CALLE], [440, 240, XMAX, 240, CALLE],
  // zona 3 (al sur)
  [0, TAM, 0, ZMAX, CALLE], [80, TAM, 80, ZMAX, CALLE], [400, TAM, 400, ZMAX, CALLE], [0, 400, XMAX, 400, CALLE], [0, ZMAX, XMAX, ZMAX, CALLE],
].map(([x1, z1, x2, z2, m], i) => { const L = Math.hypot(x2 - x1, z2 - z1); return { i, x1, z1, x2, z2, m, L, ux: (x2 - x1) / L, uz: (z2 - z1) / L }; });
export const PLAZA = { x0: 80, z0: 240, x1: 160, z1: TAM };   // la manzana que es plaza
// Las rotondas: centro, radio de la isla del medio y radio de afuera del anillo de asfalto. Se gira alrededor de la isla
// (en sentido contrario a las agujas del reloj, visto desde arriba, como en Argentina).
//   la primera esquina a la derecha saliendo del deposito (la calle de abajo y la avenida), la de la avenida con la
//   diagonal (donde tambien cruza una calle: seis bocas), y una chiquita al final de la calle sin salida, detras del deposito
//   y en la zona 2, la de la avenida con la calle del medio
export const ROTONDAS = [{ x: 160, z: TAM, ri: 7, ro: 16 }, { x: 160, z: 80, ri: 8, ro: 18 }, { x: 240, z: 240, ri: 2.5, ro: 9.5 }, { x: 440, z: 160, ri: 7, ro: 16 }];
// El deposito central: un galpon con 8 portones (darsenas) y un playon abierto a la vereda (sin muro), con dos bocas
// marcadas: la ENTRADA a la derecha (mirando el deposito desde la calle) y la SALIDA a la izquierda. Adentro se circula en un solo
// sentido, de la entrada hacia la salida: se entra, se pasa de largo el porton, se retrocede de culata, y al salir se sigue
// para el mismo lado hasta la salida. Asi nadie se cruza de frente en el playon.
// De ahi sale y ahi vuelve buena parte de los viajes: es donde mas se cruzan tus versiones pasadas.
// (x0, x1: los costados; z0: el fondo del galpon; zAnden: la pared de los portones; z1: el muro, sobre la linea de la vereda;
//  entrada y salida: de que x a que x va cada boca (la vereda ahi es una rampa); quiebre: hasta donde llegan las darsenas;
//  calle: el eje de la calle de adelante)
// El deposito 2, en la zona 2, es igual (un poco menos profundo).
export const DEPOSITOS = [
  { n: 0, x0: 250, x1: 310, z0: 246, zAnden: 262, z1: 312.5, entrada: [297, 309], salida: [251, 259], quiebre: 277, calle: TAM },
  { n: 1, x0: 470, x1: 530, z0: 174, zAnden: 190, z1: 232.5, entrada: [517, 529], salida: [471, 479], quiebre: 205, calle: 240 },
];
export const DEPOSITO = DEPOSITOS[0];
const andenesDe = (D) => [0, 1, 2, 3, 4, 5, 6, 7].map((i) => D.x0 + 4 + i * 7.2);   // ocho portones

// Los negocios: el nombre (en el cartel), que se les lleva, el color del toldo y en que se lleva:
// 'camioneta' (lo chico), 'furgon' o 'camion'. Los de la lista de siempre van en la zona 1; los de NEGOCIOS2, en las nuevas.
export const NEGOCIOS = [
  ['PANADERIA', '🌾', '#b5523a', 'camioneta'], ['FARMACIA', '💊', '#3f8a55', 'camioneta'], ['FLORERIA', '💐', '#c8608a', 'camioneta'],
  ['HELADERIA', '🍦', '#5aa6c8', 'camioneta'], ['KIOSCO', '🍬', '#c8402f', 'camioneta'], ['VERDULERIA', '🥕', '#4f7a55', 'camioneta'],
  ['CARNICERIA', '🥩', '#8a3a2a', 'camioneta'], ['VETERINARIA', '🦴', '#6b8a3a', 'camioneta'], ['BAR', '🍺', '#6b4a36', 'camioneta'],
  ['FERRETERIA', '🔩', '#35546e', 'furgon'], ['CORREO', '📮', '#e0a21e', 'furgon'], ['LIBRERIA', '📚', '#8a6f9a', 'furgon'],
  ['CLUB', '⚽', '#2f6fa8', 'furgon'], ['TALLER', '🔧', '#55585e', 'furgon'], ['ESCUELA', '✏️', '#3f6a4a', 'furgon'],
  ['MUNICIPALIDAD', '📁', '#7d8a84', 'furgon'], ['ALMACEN', '🥫', '#a8735a', 'furgon'], ['SUPERMERCADO', '🛒', '#2f8a6f', 'camion'],
];
export const NEGOCIOS2 = [
  ['PIZZERIA', '🍕', '#c8402f', 'camioneta'], ['OPTICA', '👓', '#35546e', 'camioneta'], ['JUGUETERIA', '🧸', '#e07a2e', 'furgon'],
  ['ZAPATERIA', '👟', '#6b4a36', 'furgon'], ['HOTEL', '🛏️', '#2f6fa8', 'furgon'], ['PELUQUERIA', '✂️', '#c8608a', 'camioneta'],
  ['BANCO', '💰', '#3f6a4a', 'furgon'], ['CINE', '🎬', '#8a3a2a', 'furgon'], ['CORRALON', '🏗️', '#8f9499', 'camion'],
  ['DIETETICA', '🥜', '#a8735a', 'camioneta'], ['TIENDA', '👕', '#8a6f9a', 'furgon'], ['GIMNASIO', '🏋️', '#55585e', 'furgon'],
];

// los semaforos: en las esquinas de las avenidas (donde solo se cruzan calles derechas), con su desfase en segundos
export const SEMAFOROS = [[160, 160, 0], [240, 160, 6], [160, 240, 11], [240, 80, 3], [80, 240, 14], [160, 400, 4], [560, 160, 9]].map(([x, z, des]) => ({ x, z, des }));
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
const RES = 0.5, X0 = -BORDE, NX = Math.round((XMAX + 2 * BORDE) / RES), NZ = Math.round((ZMAX + 2 * BORDE) / RES);
const CELDA = 8;

export function crearMapa() {
  const r = azar(2026);
  const entre = (a, b) => a + r() * (b - a);

  // --- el cuadriculado: calles, veredas, plaza, patios ---
  const zona = new Uint8Array(NX * NZ);
  // (para no medir la distancia a todas las calles en cada punto: la caja de cada una, con la vereda)
  const cajas = CALLES.map((s) => [Math.min(s.x1, s.x2) - s.m - VEREDA, Math.max(s.x1, s.x2) + s.m + VEREDA, Math.min(s.z1, s.z2) - s.m - VEREDA, Math.max(s.z1, s.z2) + s.m + VEREDA]);
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
    const x = X0 + (i + 0.5) * RES, z = X0 + (j + 0.5) * RES;
    let z_ = x >= 0 && x <= XMAX && z >= 0 && z <= ZMAX ? (x > PLAZA.x0 && x < PLAZA.x1 && z > PLAZA.z0 && z < PLAZA.z1 ? Z.plaza : Z.patio) : Z.campo;
    for (let c = 0; c < CALLES.length; c++) {
      const b = cajas[c];
      if (x < b[0] || x > b[1] || z < b[2] || z > b[3]) continue;
      const s = CALLES[c], d = aCalle(s, x, z).d;
      if (d <= s.m) { z_ = Z.calle; break; }
      if (d <= s.m + VEREDA) z_ = Z.vereda;
    }
    // las rotondas: la isla (pasto), el anillo de asfalto y su vereda
    for (const q of ROTONDAS) {
      const d = Math.hypot(x - q.x, z - q.z);
      if (d <= q.ri) z_ = Z.plaza; else if (d <= q.ro) z_ = Z.calle; else if (d <= q.ro + VEREDA && z_ !== Z.calle) z_ = Z.vereda;
    }
    // los depositos: el galpon y el playon (las dos bocas cruzan la vereda)
    for (const D of DEPOSITOS) {
      if (x > D.x0 && x < D.x1 && z > D.z0 && z < D.z1 && z_ !== Z.calle) z_ = z < D.zAnden ? Z.casa : Z.bahia;
      if (z >= D.z1 && z < D.z1 + VEREDA + 0.1 && z_ === Z.vereda && ((x > D.entrada[0] && x < D.entrada[1]) || (x > D.salida[0] && x < D.salida[1]))) z_ = Z.bahia;
    }
    zona[j * NX + i] = z_;
  }
  const celda = (x, z) => { const i = Math.floor((x - X0) / RES), j = Math.floor((z - X0) / RES); return i < 0 || j < 0 || i >= NX || j >= NZ ? -1 : j * NX + i; };
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

  // --- los depositos: el galpon se choca; el playon tiene paredes a los costados ---
  for (const D of DEPOSITOS) {
    caja((D.x0 + D.x1) / 2, (D.z0 + D.zAnden) / 2, (D.x1 - D.x0) / 2, (D.zAnden - D.z0) / 2);
    caja(D.x0 - 0.3, (D.zAnden + D.z1) / 2, 0.3, (D.z1 - D.zAnden) / 2);
    caja(D.x1 + 0.3, (D.zAnden + D.z1) / 2, 0.3, (D.z1 - D.zAnden) / 2);
  }

  // --- las vallas de obra: cierran las zonas que todavia no se abrieron (ver abrir, en T) ---
  // (una linea seguida: no se puede pasar ni por la calle ni por los terrenos)
  const vallas = [];
  const valla = (x, z, hx, hz, zona_) => { const o = caja(x, z, hx, hz, 1, 0, 'valla'); o.zona = zona_; vallas.push(o); return o; };
  valla(LIMITE, (LIMITE - BORDE) / 2, 0.25, (LIMITE + BORDE) / 2, 2);
  valla(XMAX / 2, LIMITE, XMAX / 2 + BORDE, 0.25, 3);
  const cercaDeValla = (x, z) => Math.abs(x - LIMITE) < 1.2 || Math.abs(z - LIMITE) < 1.2;

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
        const libre = cadaPunto(cx, cz, w / 2, fondo / 2, s.ux, s.uz, (x, z) => { const q = zonaEn(x, z); return (q === Z.patio || q === Z.campo) && !cercaDeValla(x, z); });
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
  // la isla de cada rotonda (con su cordon) se choca
  for (const q of ROTONDAS) circulo(q.x, q.z, q.ri, 'cantero');

  // --- el paredon de afuera ---
  caja(XMAX / 2, -BORDE, XMAX / 2 + BORDE, 1); caja(XMAX / 2, ZMAX + BORDE, XMAX / 2 + BORDE, 1);
  caja(-BORDE, ZMAX / 2, 1, ZMAX / 2 + BORDE); caja(XMAX + BORDE, ZMAX / 2, 1, ZMAX / 2 + BORDE);

  // --- los destinos: los andenes de los depositos, los negocios, las paradas de colectivo, la terminal y la base de taxis ---
  // Un anden: el vehiculo estaciona de trompa a la calle (rumbo pi: mirando hacia +z), con la cola contra la puerta.
  const destinos = [];
  for (const D of DEPOSITOS) andenesDe(D).forEach((x, i) => destinos.push({ n: destinos.length, anden: i, deposito: true, dep: D, zona: zonaDe(x, D.z0),
    nombre: 'DEPOSITO', icono: '🏭', color: '#2f6fa8', tamano: 'camion', x, z: D.zAnden + 4.4, rumbo: Math.PI, puerta: { x, z: D.zAnden + 0.6 },
    // se entra por la boca de la derecha y se sale por la de la izquierda (adentro: un punto del playon frente a cada boca)
    entrada: { x: (D.entrada[0] + D.entrada[1]) / 2, z: D.calle - 2.5, adentro: { x: (D.entrada[0] + D.entrada[1]) / 2, z: D.z1 - 5 } },
    salida: { x: (D.salida[0] + D.salida[1]) / 2, z: D.calle - 2.5, adentro: { x: (D.salida[0] + D.salida[1]) / 2, z: D.z1 - 5 } } }));
  // Un lugar con bahia: frente a una casa, toda la vereda de largo 2 x medio (sin tocar otra calle: no en una esquina), lejos
  // de los otros destinos. Devuelve el destino o null si no entra.
  const candidatos = edificios.filter((e) => e.ancho >= 7 && e.alto < 4);
  for (let i = candidatos.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [candidatos[i], candidatos[j]] = [candidatos[j], candidatos[i]]; }
  function conBahia(e, medio, separa, mas) {
    if (e.negocio >= 0 || e.a < medio || e.a > e.calle.L - medio) return null;
    const s = e.calle, nx = -e.nx, nz = -e.nz;   // de la calle hacia la casa
    const ex = s.x1 + s.ux * e.a, ez = s.z1 + s.uz * e.a;   // el punto del eje de la calle frente a la puerta
    const bx = ex + nx * (s.m + VEREDA / 2), bz = ez + nz * (s.m + VEREDA / 2);
    if (!cadaPunto(bx, bz, medio, VEREDA / 2 - 0.05, s.ux, s.uz, (x, z) => zonaEn(x, z) === Z.vereda && !cercaDeValla(x, z))) return null;
    if (destinos.some((d) => Math.hypot(d.x - bx, d.z - bz) < separa)) return null;
    cadaPunto(bx, bz, medio, VEREDA / 2, s.ux, s.uz, (x, z) => { zona[celda(x, z)] = Z.bahia; });
    e.negocio = destinos.length;
    e.alto = Math.max(e.alto, 4.4);   // (mas alto: el cartel y el toldo van por arriba de lo que estaciona)
    // estacionado en la bahia, a lo largo de la calle, con la puerta a la derecha (rumbo 0 = hacia -z; la derecha es (cos, sin))
    const d = { n: destinos.length, x: bx, z: bz, rumbo: Math.atan2(nz, nx), edificio: e, zona: zonaDe(bx, bz),
      bahia: { x: bx, z: bz, hx: medio, hz: VEREDA / 2, ux: s.ux, uz: s.uz }, ...mas };
    destinos.push(d);
    return d;
  }
  // la terminal de colectivos y la base de radio taxi: en la zona 3, con bahias largas
  for (const e of candidatos) if (zonaDe(e.x, e.z) === 3 && e.ancho >= 9 && conBahia(e, 9, 60, { terminal: true, nombre: 'TERMINAL', icono: '🚌', color: '#c8402f', tamano: 'colectivo' })) break;
  for (const e of candidatos) if (zonaDe(e.x, e.z) === 3 && conBahia(e, 5, 60, { base: true, nombre: 'RADIO TAXI', icono: '🚕', color: '#e0b21e', tamano: 'taxi' })) break;
  // los negocios: los de siempre en la zona 1, los nuevos en las zonas 2 y 3
  for (const [lista, enZona] of [[NEGOCIOS, (z) => z === 1], [NEGOCIOS2, (z) => z > 1]]) {
    let cual = 0;
    for (const e of candidatos) {
      if (cual >= lista.length) break;
      if (!enZona(zonaDe(e.x, e.z)) || e.ancho < 8) continue;
      const [nombre, icono, color, tamano] = lista[cual];
      if (conBahia(e, 4.5, 55, { negocio: true, nombre, icono, color, tamano })) cual++;
    }
  }
  // las paradas de colectivo: bahias largas (entra un colectivo entero) repartidas por todo el pueblo
  // (primero 8 en la zona de la terminal, para que los recorridos queden cerca; despues, hasta 18 en todo el pueblo)
  let paradas = 0;
  for (const [hasta, enZona3] of [[8, true], [18, false]]) for (const e of candidatos) {
    if (paradas >= hasta) break;
    if (e.x < 0 || e.z < 0 || e.x > XMAX || e.z > ZMAX) continue;   // (no del lado de afuera de las calles del borde)
    if (enZona3 && zonaDe(e.x, e.z) !== 3) continue;
    if (conBahia(e, 7, 40, { parada: true, nombre: 'PARADA', icono: '🚏', color: '#2f6fa8', tamano: 'colectivo' })) paradas++;
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
    // abre las vallas de las zonas hasta la n (las de mas alla quedan cerradas)
    abrir: (n) => { for (const o of vallas) o.roto = o.zona <= n; },
  };
  const red = crearRed();
  return { T, edificios, arboles, monumento, destinos, cosas, red, vallas, viaje: crearViajes(destinos, red) };
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
// (un porton del deposito se conecta con la calle por las bocas del playon: se entra por la entrada y se sale por la salida)
export function camino(red, desde, hasta) {
  const p0 = desde.salida || desde, p1 = hasta.entrada || hasta, extra = (desde.salida ? Math.hypot(desde.x - p0.x, desde.z - p0.z) : 0) + (hasta.entrada ? Math.hypot(hasta.x - p1.x, hasta.z - p1.z) : 0);
  const fin = hasta.entrada ? [{ x: p1.x, z: p1.z }, { ...hasta.entrada.adentro }, { x: hasta.x, z: hasta.z }] : [{ x: hasta.x, z: hasta.z }];
  const inicio = desde.salida ? [{ ...desde.salida.adentro }, { x: p0.x, z: p0.z }] : [];
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

// Un camino que pasa por varios puntos en orden (las paradas de un colectivo, el pasajero de un taxi): los caminos de cada
// tramo, uno detras del otro. Los puntos donde hay que parar quedan marcados (parada: true).
export function caminoPor(red, lugares) {
  const total = { puntos: [], largo: 0, cuadras: [] };
  for (let i = 1; i < lugares.length; i++) {
    const c = camino(red, lugares[i - 1], lugares[i]);
    const ps = c.puntos.map((q) => ({ ...q }));
    if (i < lugares.length - 1) ps[ps.length - 1].parada = true;
    total.puntos.push(...ps); total.largo += c.largo; total.cuadras.push(...c.cuadras);
  }
  return total;
}

// --- los viajes ---
// Todo sale de una semilla fija: siempre los mismos viajes, en el mismo orden. Hay cuatro etapas en la partida:
//   entregas 1 a 30: el deposito 1, con el pueblo de siempre (zona 1). El semi, solo en las dos ultimas vueltas.
//   entregas 31 a 50: el deposito 2 (se abre la zona 2), todo mezclado: la segunda salida de cada vuelta, en camion o en semi.
//                     El viaje 31 sale del deposito 1 y el 32 ya vuelve al 2.
//   entregas 51 a 70: colectivo (se abre la zona 3). Cada viaje sale de la terminal, para en varias paradas en orden y
//                     vuelve a la terminal. Empieza con 2 paradas y cada 6 viajes, una mas (hasta 4).
//   desde la 71: taxi. Se busca a alguien en un negocio y se lo lleva a otro.
// En las etapas de deposito, los viajes van en vueltas de 5 (v = 0, 1, 2...):
//   1. del deposito a un negocio (en el vehiculo que pida ese negocio: camioneta, furgon o camion)
//   2. de vuelta al deposito: por el mismo camino, de frente con tu viaje anterior (asi, en el segundo viaje, te cruzas
//      con tu primera version: el juego lo explica ahi)
//   3. del deposito a otro negocio, en camion (o en semi: ver arriba)
//   4. de ese negocio a otro, elegido para que el viaje siguiente pise las calles mas usadas
//   5. de vuelta al deposito: el punto culminante. Pasa por donde mas viajes pasaron.
// Desde que se sale del deposito hasta que se vuelve, el vehiculo es siempre el mismo (cambia solo en el deposito).
// En el deposito siempre se estaciona de culata: con la cola contra el porton y la trompa hacia el playon.
// Cada llegada al deposito usa un porton distinto, en rueda (1, 4, 7, 2, 5, 0, 3, 6, y de nuevo): el que llega sale despues
// por el mismo porton, y ese porton no se vuelve a usar hasta 8 llegadas mas tarde. Asi los camiones no se pisan en la puerta.
// Cada vuelta, los viajes son mas largos (hasta un tope).
function crearViajes(destinos, red) {
  const negocios = destinos.filter((d) => d.negocio), paradas = destinos.filter((d) => d.parada);
  const terminal = destinos.find((d) => d.terminal), base = destinos.find((d) => d.base);
  const andenesDe = (dep) => destinos.filter((d) => d.deposito && d.dep.n === dep);
  const lista = [];   // los viajes ya decididos: { de, a, tipo, paradas, camino }
  const largoEntre = new Map();
  const largo = (a, b) => { const k = a.n * 1000 + b.n; if (!largoEntre.has(k)) largoEntre.set(k, camino(red, a, b).largo); return largoEntre.get(k); };
  // que tan lejos puede quedar un negocio, segun la vuelta (con tope: el pueblo grande igual tiene que entrar en 2 minutos)
  const rango = (v) => { v = Math.min(v, 4); return [60 + 45 * v, 170 + 60 * v]; };
  // de los lugares que quedan a buena distancia, uno al azar (o el que mejor puntue, si se da "puntaje")
  function elegir(de, v, rr, puntaje, sacar = [], entre = negocios, [min, max] = rango(v)) {
    let buenos = entre.filter((d) => d !== de && !sacar.includes(d) && largo(de, d) >= min && largo(de, d) <= max);
    if (!buenos.length) {   // (si no hay ninguno en el rango: los mas cercanos al rango)
      const fuera = (d) => { const l = largo(de, d); return l < min ? min - l : l > max ? l - max : 0; };
      buenos = entre.filter((d) => d !== de && !sacar.includes(d)).sort((a, b) => fuera(a) - fuera(b)).slice(0, 3);
    }
    if (!puntaje) return buenos[Math.floor(rr() * buenos.length)];
    let mejor = null, pm = -Infinity;
    for (const d of buenos) { const p = puntaje(d) + rr() * 0.5; if (p > pm) { pm = p; mejor = d; } }
    return mejor;
  }
  // cuantas cuadras de un camino ya recorrieron los viajes anteriores (contando cada viaje)
  const pisadas = (cuadras) => { let p = 0; for (const v of lista) for (const q of v.camino.cuadras) if (cuadras.includes(q)) p++; return p; };

  // un viaje de deposito (etapas 1 y 2)
  function deDeposito(k, dep, abiertas) {
    const v = Math.floor(k / 5), i = k % 5, rr = azar(7919 * k + 13), andenes = andenesDe(dep);
    const enZona = negocios.filter((d) => d.zona <= abiertas);
    // el porton de la llegada de este viaje (la primera de la vuelta en el viaje 2, la segunda en el 5)
    const anden = andenes[(1 + 3 * (2 * v + (i >= 2 ? 1 : 0))) % andenes.length];
    const de = k === 0 ? andenes[0] : lista[k - 1].a;
    // (los negocios de los ultimos viajes no se repiten enseguida)
    const recientes = lista.slice(-8).flatMap((x) => [x.de, x.a]);
    const [, max] = rango(v);
    let a, tipo;
    // El vehiculo se elige al salir del deposito y es el mismo hasta volver: la primera salida de la vuelta (viajes 1 y 2),
    // el que pide el negocio; la segunda (viajes 3, 4 y 5, con la hora pico), camion o semi (en el deposito 1, semi solo en las
    // dos ultimas vueltas; en el 2, sorteado).
    if (i === 0) { a = elegir(de, v, rr, null, recientes, enZona); tipo = a.tamano; }
    else if (i === 2) {
      a = elegir(de, v, rr, null, recientes, enZona);
      const ultimas = Math.floor(ABRE[2] / 5) - 2;   // (las dos ultimas vueltas del deposito 1)
      tipo = dep === 0 ? (v >= ultimas ? 'semi' : 'camion') : rr() < 0.5 ? 'semi' : 'camion';
    }
    else if (i === 1) { a = anden; tipo = lista[k - 1].tipo; }
    else if (i === 3) {
      // el que deja el viaje siguiente (la hora pico) por las calles mas usadas, sin que quede demasiado lejos del deposito
      a = elegir(de, v, rr, (d) => pisadas(camino(red, d, anden).cuadras) - Math.max(0, largo(d, anden) - max * 1.2) * 0.5, recientes, enZona);
      tipo = lista[k - 1].tipo;
    } else { a = anden; tipo = lista[k - 1].tipo; }
    lista.push({ de, a, tipo, paradas: [], camino: camino(red, de, a) });
  }
  // un viaje de colectivo: de la terminal a la terminal, pasando por varias paradas en orden (cada tramo, de 90 a 260 m)
  // (de 2 a 4 paradas, cada tramo de 50 a 140 m, y todo el recorrido de no mas de 600 m: con un vehiculo tan largo, tiene
  // que entrar en 2 minutos)
  function deColectivo(k) {
    const j = k - ABRE[3], rr = azar(4241 * k + 7), n = Math.min(4, 2 + Math.floor(j / 6));
    const ps = [];
    let de = terminal;
    for (let q = 0; q < n; q++) { const p = elegir(de, 0, rr, null, ps, paradas, [50, 140]); ps.push(p); de = p; }
    let c = caminoPor(red, [terminal, ...ps, terminal]);
    while (c.largo > 600 && ps.length > 2) { ps.pop(); c = caminoPor(red, [terminal, ...ps, terminal]); }
    lista.push({ de: terminal, a: terminal, tipo: 'colectivo', paradas: ps, camino: c, salto: k === ABRE[3] });
  }
  // un viaje de taxi: de donde quedo el anterior (o la base) a buscar a alguien a un negocio, y de ahi a otro
  function deTaxi(k) {
    const rr = azar(6007 * k + 3), de = k === TAXIS ? base : lista[k - 1].a;
    const recientes = lista.slice(-6).flatMap((x) => [x.de, x.a]);
    const busca = elegir(de, 0, rr, null, recientes, negocios, [100, 280]);
    const a = elegir(busca, 0, rr, null, [...recientes, busca], negocios, [150, 330]);
    lista.push({ de, a, tipo: 'taxi', paradas: [busca], camino: caminoPor(red, [de, busca, a]), salto: k === TAXIS });
  }
  function decidir(k) {
    if (k < ABRE[2]) deDeposito(k, 0, 1);
    else if (k < ABRE[3]) deDeposito(k, 1, 2);
    else if (k < TAXIS) deColectivo(k);
    else deTaxi(k);
  }
  // el viaje k: de donde a donde, que se lleva, en que, por donde para, y cuanto tiempo hay
  return function viaje(k) {
    while (lista.length <= k) decidir(lista.length);
    const { de, a, tipo, paradas: ps, camino: c, salto } = lista[k];
    // el tiempo: segun el largo y el vehiculo, mas lo que lleva estacionar de culata en el deposito y frenar en cada parada
    const lento = { camion: 1.25, semi: 1.45, colectivo: 1.2, taxi: 0.9 }[tipo] || 1, culata = a.deposito ? (tipo === 'semi' ? 30 : 10) : 0;
    const carga = tipo === 'colectivo' ? '🚌' : tipo === 'taxi' ? '🙋' : a.deposito ? '📦' : a.icono;
    return { k, de, a, tipo, paradas: ps, salto: !!salto, carga, camino: c, culmine: k < ABRE[3] && k % 5 === 4,
      // (el colectivo, con sus paradas, tiene hasta 2 minutos y medio; todo lo demas, hasta 2)
      limite: Math.min(tipo === 'colectivo' ? 150 : 120, Math.round((22 + c.largo / 7) * lento + culata + ps.length * 4)) };
  };
}

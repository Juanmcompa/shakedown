// Reparto: el pueblo. Siempre el mismo (sale de una semilla fija), porque los viajes guardados tienen que volver a
// pasar por las mismas calles. Pocas calles, para que el lio llegue rapido: dos avenidas que se cruzan en el medio, una
// diagonal que corta el pueblo, algunas calles que no siguen, una plaza, negocios con lugar para estacionar en la vereda
// y semaforos en las esquinas de las avenidas.
//
// No dibuja nada (eso es dibujo.js): hace de "terreno" para la fisica de Shakedown, que le pregunta solo cuatro cosas: la
// altura del piso, su inclinacion, que piso es, y contra que puede chocar cerca de un punto (cosasCerca).
// Las versiones pasadas del que juega tambien se chocan: fantasmas.js las anota aca en cada cuadro (ver ponerMoviles).
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

// los negocios: el nombre (en el cartel), un icono y el color del toldo
export const NEGOCIOS = [
  ['ALMACEN', '🥫', '#3f6a4a'], ['PANADERIA', '🥖', '#b5523a'], ['FERRETERIA', '🔩', '#35546e'], ['FARMACIA', '💊', '#3f8a55'],
  ['KIOSCO', '🍬', '#c8402f'], ['CLUB', '⚽', '#2f6fa8'], ['TALLER', '🔧', '#55585e'], ['BAR', '☕', '#6b4a36'],
  ['VERDULERIA', '🥬', '#4f7a55'], ['CORREO', '✉️', '#e0a21e'], ['CARNICERIA', '🥩', '#8a3a2a'], ['LIBRERIA', '📚', '#8a6f9a'],
];
// lo que se lleva en cada viaje (solo para contarlo)
export const CARGAS = ['📦', '🥚', '🍞', '🌵', '🎂', '🥛', '🔑', '📮', '🧀', '🍉', '📻', '💐'];

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
    zona[j * NR + i] = z_;
  }
  const celda = (x, z) => { const i = Math.floor((x - X0) / RES), j = Math.floor((z - X0) / RES); return i < 0 || j < 0 || i >= NR || j >= NR ? -1 : j * NR + i; };
  const zonaEn = (x, z) => { const k = celda(x, z); return k < 0 ? Z.campo : zona[k]; };

  // --- lo que se choca: en celdas de 8 m ---
  const cosas = [], celdas = new Map();
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
  // una caja: centro, medio largo a lo largo de (ux, uz) y medio ancho de costado
  const caja = (x, z, hx, hz, ux = 1, uz = 0, clase = 'edificio') => { const o = { x, z, hx, hz, ux, uz, y: 0, duro: 1, clase, tipo: clase, roto: false }; cosas.push(o); anotar(o); return o; };
  const circulo = (x, z, radio, clase) => { const o = { x, z, r: radio, y: 0, duro: 1, clase, tipo: clase, roto: false }; cosas.push(o); anotar(o); return o; };
  // recorre los puntos de un rectangulo girado (cada 50 cm)
  function cadaPunto(x, z, hx, hz, ux, uz, f) {
    for (let a = -hx + 0.25; a < hx; a += RES) for (let b = -hz + 0.25; b < hz; b += RES) if (f(x + ux * a - uz * b, z + uz * a + ux * b) === false) return false;
    return true;
  }

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

  // --- los negocios: casas anchas, repartidas por todo el pueblo, con una bahia en la vereda para estacionar ---
  const BAHIA = 4.5;   // medio largo de la bahia
  const candidatos = edificios.filter((e) => e.ancho >= 8 && e.alto < 4 && e.a > BAHIA && e.a < e.calle.L - BAHIA);
  for (let i = candidatos.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [candidatos[i], candidatos[j]] = [candidatos[j], candidatos[i]]; }
  const destinos = [];
  for (const e of candidatos) {
    if (destinos.length >= 10) break;
    const s = e.calle, nx = -e.nx, nz = -e.nz;   // de la calle hacia la casa
    const ex = s.x1 + s.ux * e.a, ez = s.z1 + s.uz * e.a;   // el punto del eje de la calle frente a la puerta
    // la bahia: toda la vereda frente a la puerta, sin tocar otra calle (no en una esquina)
    const bx = ex + nx * (s.m + VEREDA / 2), bz = ez + nz * (s.m + VEREDA / 2);
    if (!cadaPunto(bx, bz, BAHIA, VEREDA / 2 - 0.05, s.ux, s.uz, (x, z) => zonaEn(x, z) === Z.vereda)) continue;
    if (destinos.some((d) => Math.hypot(d.x - bx, d.z - bz) < 85)) continue;
    cadaPunto(bx, bz, BAHIA, VEREDA / 2, s.ux, s.uz, (x, z) => { zona[celda(x, z)] = Z.bahia; });
    const n = destinos.length;
    e.negocio = n;
    e.alto = Math.max(e.alto, 4.4);   // (un negocio es mas alto: el cartel y el toldo van por arriba de la camioneta)
    // estacionado en la bahia, a lo largo de la calle, con la puerta a la derecha (rumbo 0 = hacia -z; la derecha es (cos, sin))
    destinos.push({ n, nombre: NEGOCIOS[n][0], icono: NEGOCIOS[n][1], color: NEGOCIOS[n][2], x: bx, z: bz, rumbo: Math.atan2(nz, nx), edificio: e,
      bahia: { x: bx, z: bz, hx: BAHIA, hz: VEREDA / 2, ux: s.ux, uz: s.uz } });
  }

  // --- el orden de los viajes: siempre el mismo. El viaje k va del destino ruta(k) al destino ruta(k + 1) ---
  const ruta = [0];
  function destinoDe(k) {
    while (ruta.length <= k) {
      const de = destinos[ruta[ruta.length - 1]], rr = azar(7919 * ruta.length + 13);
      const lejos = (d) => Math.hypot(d.x - de.x, d.z - de.z);
      const buenos = destinos.filter((d) => d !== de && lejos(d) > 110 && lejos(d) < 290);
      const lista = buenos.length ? buenos : destinos.filter((d) => d !== de);
      ruta.push(lista[Math.floor(rr() * lista.length)].n);
    }
    return destinos[ruta[k]];
  }
  // el viaje k: de donde a donde, que se lleva y cuanto tiempo hay (hasta 2 minutos)
  function viaje(k) {
    const de = destinoDe(k), a = destinoDe(k + 1), lejos = Math.hypot(a.x - de.x, a.z - de.z) * 1.3;
    return { k, de, a, carga: CARGAS[k % CARGAS.length], limite: Math.min(120, Math.round(25 + lejos / 7)) };
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
    // Las versiones pasadas de este cuadro: una lista de cajas que se mueven. Se arma un mapa aparte con las celdas que tocan
    // (cada una con lo fijo de esa celda mas los autos que pasan), asi el auto choca contra todo sin tocar su fisica.
    ponerMoviles: (lista) => {
      if (!lista.length) { moviles = null; return; }
      const m = new Map();
      for (const o of lista) anotar(o, m);
      for (const [k, l] of m) { const fijos = celdas.get(k); if (fijos) l.push(...fijos); }
      moviles = m;
    },
    zona: zonaEn,
  };
  return { T, edificios, arboles, monumento, destinos, viaje, cosas, red: crearRed() };
}

// --- la red de calles: las esquinas (donde se cruzan o terminan) y que esquinas une cada calle ---
// La usan el dibujo (sendas peatonales, lineas de pare) y el piloto automatico de las pruebas.
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

// La Travesia: el camino infinito. A diferencia de una pista (que se arma entera antes de largar), aca el camino, el
// terreno y las piedras se arman de a pedazos, siempre por delante del auto, y se tira lo que queda atras: asi no se
// llena la memoria del celular por mas lejos que se llegue.
//
// Este archivo no dibuja nada (eso es travesiamundo.js): solo calcula. Hace de "terreno" para la fisica del auto
// (altura, normal, suelo y cosasCerca, las mismas consultas que tiene terrain.js) y para la camara.
//
// El azar es de este archivo: cada corrida trae una semilla nueva y ni el camino ni nada se repite.
import { SUELOS, SUELO, TRAVESIA } from './config.js';
import { azar, crearRuido } from './noise.js';

const RAD = Math.PI / 180;
const suave = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const mezcla = (a, b, t) => a + (b - a) * t;
const entre = (r, a, b) => a + (b - a) * r();
const ARENA = SUELOS.arena.id, FESH = SUELOS.feshfesh.id, RIPIO = SUELOS.ripio.id, ROCA = SUELOS.roca.id, LECHO = SUELOS.lecho.id;

const LADO = TRAVESIA.lado;          // metros de lado de cada pedazo de terreno
const NV = LADO + 1;                 // vertices por lado
const BORDE = 1;                     // un vertice de mas por cada lado (solo para calcular bien las normales en las uniones)
const AN = NV + 2 * BORDE;           // ancho de la grilla con borde
const NG = LADO / 4 + 1;             // nodos de la grilla gruesa (cada 4 metros)

// --- cuanto vale la dificultad segun los km: 0 en la largada, 1 a los TRAVESIA.hasta km, y sigue subiendo despacio ---
export const dificultad = (km) => Math.min(1, km / TRAVESIA.hasta) + Math.min(0.6, Math.max(0, km - TRAVESIA.hasta) * 0.025);

// las piedras que se arman a mano o por azar usan estos radios (y no otros), asi el dibujo de cada una se prepara una sola vez
export const RADIOS_DE_PIEDRA = [0.7, 0.9, 1.1, 1.35, 1.6, 1.95, 2.4];
const radioDePiedra = (r) => RADIOS_DE_PIEDRA.reduce((m, q) => (Math.abs(q - r) < Math.abs(m - r) ? q : m), RADIOS_DE_PIEDRA[0]);
// una piedra mas ancha es tambien mas alta
export const altoDePiedra = (r) => 0.55 + r * 0.22;

// un grado de curva (del 1, la mas cerrada, al 6) segun el radio, igual que en el generador de pistas
const gradoDe = (radio) => (radio < 19 ? 1 : radio < 28 ? 2 : radio < 42 ? 3 : radio < 66 ? 4 : radio < 110 ? 5 : 6);

export function crearTerrenoTravesia(semilla = (Math.random() * 4294967295) >>> 0) {
  const r = azar(semilla), ruido = crearRuido(semilla ^ 0x5bd1e995);

  // =========================================================== el camino ===========================================================
  // Un punto por metro. Los arreglos crecen al doble cuando se llenan.
  let cap = 2048;
  const P = { n: 0, X: new Float32Array(cap), Z: new Float32Array(cap), Y: new Float32Array(cap), HX: new Float32Array(cap), HZ: new Float32Array(cap),
    W: new Float32Array(cap), G: new Float32Array(cap), HU: new Float32Array(cap), S: new Uint8Array(cap) };
  const crecer = () => {
    cap *= 2;
    for (const k of ['X', 'Z', 'Y', 'HX', 'HZ', 'W', 'G', 'HU', 'S']) { const nuevo = new P[k].constructor(cap); nuevo.set(P[k]); P[k] = nuevo; }
  };
  // donde esta cada punto, para encontrar el mas cercano a cualquier lugar sin recorrerlos todos:
  //   celdas de 16 m con todos los puntos, y "anclas" (uno cada 6 m) en celdas de 32 m para el relieve general
  const CELDA = 16, CELDA_A = 32, PASO_ANCLA = 6;
  const celdas = new Map(), anclas = new Map();
  const clave = (a, b) => (a + 60000) * 120000 + b + 60000;
  const poner = (mapa, k, i) => { const l = mapa.get(k); if (l) l.push(i); else mapa.set(k, [i]); };
  let podado = 0;

  const est = { x: 0, z: 0, rumbo: 0, y: 0, g: 0, w: 15, hu: 0 };
  function punto(suelo, ancho, pend, hundir) {
    if (P.n >= cap) crecer();
    const i = P.n++;
    est.g += (Math.tan(pend * RAD) - est.g) * 0.2;      // la pendiente cambia de a poco: no hay escalones
    est.y += est.g;
    est.w += (ancho - est.w) * 0.12;
    est.hu += (hundir - est.hu) * 0.25;
    const hx = Math.sin(est.rumbo), hz = -Math.cos(est.rumbo);
    est.x += hx; est.z += hz;
    P.X[i] = est.x; P.Z[i] = est.z; P.Y[i] = est.y; P.HX[i] = hx; P.HZ[i] = hz; P.W[i] = est.w; P.G[i] = est.g; P.HU[i] = est.hu; P.S[i] = suelo;
    poner(celdas, clave(Math.floor(est.x / CELDA), Math.floor(est.z / CELDA)), i);
    if (i % PASO_ANCLA === 0) poner(anclas, clave(Math.floor(est.x / CELDA_A), Math.floor(est.z / CELDA_A)), i);
    return i;
  }
  // un tramo: largo (m), cuanto dobla en total (grados, + = a la derecha), pendiente (grados), ancho, suelo, y cuanto se hunde el piso
  function tramo(largo, giro, pend, ancho, suelo, hundir = 0) {
    const m = Math.max(1, Math.round(largo));
    for (let j = 0; j < m; j++) { est.rumbo += giro * RAD / m; punto(suelo, ancho, pend, hundir); }
  }

  // lo que va quedando armado: notas del copiloto, piedras del camino y arroyos
  const notas = [], aguas = [];
  const rocasDeTile = new Map();                  // piedras del camino, por pedazo de terreno: se dibujan cuando se arma ese pedazo
  const cajas = new Map();                        // piedras que se pueden chocar, en celdas de 8 m (como terrain.js)
  const porIndice = [];                           // [indice del camino, piedra]: para tirarlas cuando quedan atras
  let sigNota = 0, podadoRocas = 0;

  const ubicar = (o) => {
    const e = o.r + 1.1;
    for (let cx = Math.floor((o.x - e) / 8); cx <= Math.floor((o.x + e) / 8); cx++) for (let cz = Math.floor((o.z - e) / 8); cz <= Math.floor((o.z + e) / 8); cz++) poner(cajas, clave(cx, cz), o);
  };
  const sacar = (o) => {
    const e = o.r + 1.1;
    for (let cx = Math.floor((o.x - e) / 8); cx <= Math.floor((o.x + e) / 8); cx++) for (let cz = Math.floor((o.z - e) / 8); cz <= Math.floor((o.z + e) / 8); cz++) {
      const k = clave(cx, cz), l = cajas.get(k);
      if (!l) continue;
      const q = l.indexOf(o);
      if (q >= 0) l.splice(q, 1);
      if (!l.length) cajas.delete(k);
    }
  };
  const piedra = (x, z, radio, i) => {
    const rr = radioDePiedra(radio), o = { x, z, y: NaN, r: rr, alto: altoDePiedra(rr), clase: 'piedra', duro: 1, vuelta: r() * 6.28, i };
    ubicar(o);
    if (i !== undefined) porIndice.push([i, o]);
    const k = clave(Math.floor(x / LADO), Math.floor(z / LADO));
    poner(rocasDeTile, k, o);
    return o;
  };
  // un lugar a "lado" metros a la derecha del metro i del camino
  const lugar = (i, lado) => [P.X[i] - P.HZ[i] * lado, P.Z[i] + P.HX[i] * lado];
  const nota = (i, mas) => notas.push({ i, k: sigNota++, ...mas });

  // =========================================================== las piezas ===========================================================
  // Cada una arma un pedazo de camino. "d" es la dificultad de ese lugar (0 a 1,6).
  let suelo = RIPIO, cambiaSuelo = 300, ultima = '', desdeEspecial = 0;
  const anchoBase = (d) => 15.5 - 6.2 * Math.min(1, d) + entre(r, -0.6, 0.6);
  // se puede doblar para ese lado sin pasarse de 80 grados de rumbo? (asi el camino siempre avanza hacia el norte y nunca se cruza)
  const sobra = (lado) => 80 - lado * est.rumbo / RAD;
  const suelos = (d) => (r() < 0.78 - 0.4 * Math.min(1, d) ? RIPIO : ARENA);

  function recta(d) {
    const largo = entre(r, 40, 120 - 40 * Math.min(1, d)), n = Math.max(1, Math.round(largo / 55));
    for (let k = 0; k < n; k++) tramo(largo / n, entre(r, -5, 5), entre(r, -1.2, 1.2), anchoBase(d), suelo);
    // algunas piedras sueltas al costado, para que el camino no quede pelado
    for (let k = 0; k < 3 && r() < 0.5; k++) { const i = P.n - Math.floor(r() * largo * 0.9) - 1, lado = (r() < 0.5 ? -1 : 1) * (P.W[i] / 2 + entre(r, 2.2, 9)); const [x, z] = lugar(i, lado); piedra(x, z, entre(r, 0.7, 1.6), i); }
    return 'recta';
  }
  function curva(d) {
    d = Math.min(1, d);
    let lado = r() < 0.5 ? -1 : 1;
    if (sobra(lado) < 30) lado = -lado;
    else if (sobra(-lado) > 30 && Math.abs(est.rumbo / RAD) > 45 && r() < 0.8) lado = est.rumbo > 0 ? -1 : 1;   // el camino vuelve hacia el centro
    const radio = entre(r, mezcla(62, 13, d), mezcla(135, 32, d));
    let angulo = entre(r, mezcla(30, 55, d), mezcla(65, 125, d));
    angulo = Math.min(angulo, sobra(lado));
    const largo = Math.max(14, radio * angulo * RAD), n = Math.max(1, Math.round(largo / 40)), grado = gradoDe(radio);
    nota(P.n, { tipo: 'curva', lado: lado > 0 ? 'der' : 'izq', grado, larga: angulo > 78 });
    // por dentro de la curva, alguna piedra para el que quiera cortar camino
    const i0 = P.n;
    for (let k = 0; k < n; k++) tramo(largo / n, lado * angulo / n, entre(r, -1.5, 1.5), anchoBase(d) + (radio < 30 ? 1.1 : 0), suelo);
    if (r() < 0.25 + 0.4 * d) { const i = i0 + Math.floor(largo * entre(r, 0.35, 0.65)); const [x, z] = lugar(Math.min(i, P.n - 1), lado * (P.W[Math.min(i, P.n - 1)] / 2 + entre(r, 0.8, 2))); piedra(x, z, entre(r, 0.9, 1.9), i); }
    return 'curva';
  }
  // un medano: se sube (cada vez mas empinado) y se baja del otro lado. Con la arena blanda hace falta ir con envión
  function duna(d) {
    d = Math.min(1.3, d);
    const veces = 1 + (r() < 0.3 + 0.35 * d ? 1 : 0) + (r() < 0.25 * d ? 1 : 0);
    nota(P.n, { tipo: 'duna' });
    tramo(10, entre(r, -4, 4), 0, anchoBase(d), ARENA);   // el pie
    for (let k = 0; k < veces; k++) {
      const pend = mezcla(10, 27, Math.min(1, d)) + entre(r, -1.5, 3.5), subida = mezcla(18, 36, Math.min(1, d)) * entre(r, 0.8, 1.2);
      const giro = entre(r, -8, 8);
      tramo(subida, giro, pend, anchoBase(d), ARENA);
      tramo(6, 0, pend * 0.15, anchoBase(d), ARENA);                      // la cresta
      tramo(subida * entre(r, 0.7, 1), -giro * 0.5, -pend * 0.95, anchoBase(d), ARENA);
      tramo(entre(r, 14, 26), 0, 0, anchoBase(d), ARENA);                // el valle entre dos medanos
    }
    return 'duna';
  }
  // un arroyo que se cruza por el agua (usa el agua que ya tiene el juego: ver "aguas")
  function rio(d) {
    d = Math.min(1.3, d);
    const L = entre(r, 18, 26 + 12 * d), hondo = mezcla(0.28, 0.62, Math.min(1, d)) + entre(r, 0, 0.12), medio = L / 2;
    nota(P.n, { tipo: 'vado' });
    tramo(14, 0, -5, anchoBase(d), suelo);
    const i0 = P.n;
    tramo(L, 0, 0, 12, LECHO);
    const m = i0 + (L >> 1);
    aguas.push({ i: m, x: P.X[m], z: P.Z[m], hx: P.HX[m], hz: P.HZ[m], y0: P.Y[m], nivel: P.Y[m] + hondo, cruce: medio + 16, largo: entre(r, 38, 52) + 8 * d });
    tramo(14, 0, 5.5, anchoBase(d), suelo);
    return 'rio';
  }
  // arena en polvo: casi no agarra, frena y el auto se hunde
  function feshfesh(d) {
    d = Math.min(1.3, d);
    nota(P.n, { tipo: 'fesh' });
    tramo(10, entre(r, -3, 3), 0, anchoBase(d), ARENA);
    const largo = mezcla(26, 85, Math.min(1, d)) * entre(r, 0.7, 1.3);
    tramo(largo, entre(r, -6, 6), entre(r, -1, 1), anchoBase(d) + 1, FESH, 0.17);
    tramo(10, 0, 0, anchoBase(d), ARENA);
    return 'fesh';
  }
  // el camino se llena de piedras: hay que pasar entre ellas. Las pone al azar pero siempre dejando un hueco por el que cabe el auto.
  function rocas(d) {
    d = Math.min(1.4, d);
    const largo = entre(r, 55, 80 + 70 * d), i0 = P.n, ancho = anchoBase(d) + 2;
    nota(P.n, { tipo: 'angosto' });
    tramo(largo, entre(r, -10, 10), entre(r, -1, 1), ancho, suelo);
    const hueco = mezcla(8.6, 4.6, Math.min(1, d));          // metros libres como minimo entre dos piedras
    const puestas = [], intentos = Math.round(largo * (0.5 + 1.1 * d));
    for (let k = 0; k < intentos; k++) {
      const u = 8 + r() * (largo - 12), i = i0 + Math.floor(u), medio = P.W[i] / 2;
      const lado = (r() * 2 - 1) * (medio + 0.8), radio = entre(r, 0.75, 1.5 + 0.9 * Math.min(1, d));
      const [x, z] = lugar(i, lado);
      if (puestas.some((q) => Math.hypot(q.x - x, q.z - z) < q.r + radioDePiedra(radio) + hueco)) continue;
      puestas.push(piedra(x, z, radio, i));
    }
    return 'rocas';
  }
  // el camino se cierra entre dos filas de piedras
  function angosto(d) {
    d = Math.min(1.4, d);
    const largo = entre(r, 45, 80), i0 = P.n, ancho = mezcla(7.6, 5.4, Math.min(1, d));
    nota(P.n, { tipo: 'angosto' });
    tramo(largo, entre(r, -14, 14), entre(r, -1, 1), ancho, suelo);
    for (let u = 4; u < largo - 3; u += entre(r, 5, 9)) for (const s of [-1, 1]) {
      if (r() < 0.2) continue;
      const i = i0 + Math.floor(u), radio = entre(r, 1, 1.9), [x, z] = lugar(i, s * (P.W[i] / 2 + radio * 0.55 + entre(r, 0, 0.6)));
      piedra(x, z, radio, i);
    }
    return 'angosto';
  }
  // una loma corta: a fondo, el auto vuela
  function salto(d) {
    nota(P.n, { tipo: 'salto' });
    const sube = entre(r, 7, 11);
    tramo(16, 0, sube, anchoBase(d), suelo);
    tramo(20, 0, -sube * 0.85, anchoBase(d), suelo);
    tramo(22, entre(r, -3, 3), 0, anchoBase(d), suelo);
    return 'salto';
  }

  // Elige la pieza que sigue segun los km: al principio, rectas y curvas suaves; despues, de todo y cada vez peor.
  function otraPieza() {
    const km = P.n / 1000, d = dificultad(km), dd = Math.min(1, d);
    if (cambiaSuelo <= 0) { suelo = suelos(d); cambiaSuelo = entre(r, 150, 420); }
    let pieza;
    const especial = desdeEspecial > mezcla(190, 70, dd) && km > 0.25 && r() < 0.65;
    if (especial) {
      const pesos = [['rocas', km > 0.3 ? 1.2 + 3.2 * d : 0], ['duna', km > 0.45 ? 1.4 + 3.2 * d : 0], ['rio', km > 0.9 ? 0.9 + 1.5 * d : 0], ['feshfesh', km > 0.7 ? 1 + 2.6 * d : 0],
        ['angosto', km > 1.2 ? 0.4 + 1.6 * d : 0], ['salto', 0.7 + 0.5 * d]].map(([n, p]) => [n, n === ultima ? p * 0.15 : p]);
      let t = r() * pesos.reduce((s, q) => s + q[1], 0);
      pieza = pesos[0][0];
      for (const [n, p] of pesos) { t -= p; if (t <= 0) { pieza = n; break; } }
      const hecha = { rocas, duna, rio, feshfesh, angosto, salto }[pieza](d);
      desdeEspecial = 0; ultima = hecha;
    } else {
      ultima = r() < 0.34 - 0.12 * dd ? recta(d) : curva(d);
    }
  }
  // la largada: 120 metros derechos y anchos
  tramo(8, 0, 0, 16, RIPIO);
  tramo(120, 0, 0, 16, RIPIO);
  const crecerCamino = (hasta) => {
    while (P.n < hasta) {
      const antes = P.n;
      otraPieza();
      desdeEspecial += P.n - antes;
      cambiaSuelo -= P.n - antes;
    }
  };

  // =========================================================== terreno ===========================================================
  const tiles = new Map();           // pedazos armados, por clave
  const kt = (tx, tz) => clave(tx, tz);

  // el punto del camino mas cercano a (x, z), a menos de 17 m; -1 si no hay
  function cerca(x, z) {
    const cx = Math.floor(x / CELDA), cz = Math.floor(z / CELDA);
    let mejor = -1, md = 17 * 17;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      const l = celdas.get(clave(cx + a, cz + b));
      if (!l) continue;
      for (let q = 0; q < l.length; q++) { const i = l[q], dx = x - P.X[i], dz = z - P.Z[i], dd = dx * dx + dz * dz; if (dd < md) { md = dd; mejor = i; } }
    }
    return mejor;
  }
  // El relieve general en un nodo de la grilla gruesa: el promedio (pesado por la cercania) de la altura de los puntos del camino
  // que estan a menos de 96 m, y a cuanto queda el mas cercano. Es lo que hace que las lomas del costado acompañen al camino.
  const salida = { y: 0, d: 999 };
  function gruesa(x, z) {
    const cx = Math.floor(x / CELDA_A);
    const cz = Math.floor(z / CELDA_A);
    let sw = 0, sh = 0, dm = 1e9;
    for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) {
      const l = anclas.get(clave(cx + a, cz + b));
      if (!l) continue;
      for (let q = 0; q < l.length; q++) {
        const i = l[q], dx = x - P.X[i], dz = z - P.Z[i], dd = dx * dx + dz * dz;
        if (dd > 9216) continue;                       // 96 m
        const w = 1 / ((dd + 12) * (dd + 12));
        sw += w; sh += w * P.Y[i];
        if (dd < dm) dm = dd;
      }
    }
    if (sw === 0) { salida.y = 0; salida.d = 999; } else { salida.y = sh / sw; salida.d = Math.sqrt(dm); }
    return salida;
  }
  // los medanos del costado: lomas anchas y crestas largas que el viento deja todas para el mismo lado
  const VIENTO = 0.6, CV = Math.cos(VIENTO), SV = Math.sin(VIENTO);
  function medanos(x, z) {
    const u = (x * CV + z * SV) / 85, v = (-x * SV + z * CV) / 230;
    const cresta = 1 - Math.abs(ruido.n2(u + 31, v - 7) * 2 - 1);
    return ruido.capas(x / 120, z / 120, 3) * 5.5 + (cresta - 0.45) * 6.5;
  }
  const aguaEn = (x, z, h) => {
    for (const a of aguas) {
      const ax = x - a.x, az = z - a.z;
      if (Math.abs(ax * a.hx + az * a.hz) < a.cruce && Math.abs(az * a.hx - ax * a.hz) < a.largo) return Math.max(0, a.nivel - h);
    }
    return 0;
  };
  const curvaDelArroyo = (b) => 9 * Math.sin(b / 21) * suave(5, 26, Math.abs(b));

  // la altura y el suelo de un punto. yBase y dm vienen de la grilla gruesa. Deja el resultado en "res".
  const res = { h: 0, s: ARENA };
  function puntoDe(x, z, yBase, dm) {
    let h = yBase + ruido.capas(x / 26, z / 26, 3) * 0.9 + medanos(x, z) * suave(24, 110, dm);
    let s = ARENA;
    const c = dm < 30 ? cerca(x, z) : -1;
    if (c >= 0) {
      const ax = x - P.X[c], az = z - P.Z[c], largo = ax * P.HX[c] + az * P.HZ[c], lado = az * P.HX[c] - ax * P.HZ[c];
      const d = Math.abs(lado), medio = P.W[c] / 2, sc = SUELO[P.S[c]];
      const bache = ruido.capas(x / sc.rugoso[1], z / sc.rugoso[1], 2) * sc.rugoso[0];
      const hc = P.Y[c] + P.G[c] * largo - P.HU[c] + bache;
      h = mezcla(hc, h, suave(medio, medio + 4.5, d));
      if (d < medio + 0.6) s = P.S[c];
    }
    // el arroyo: cava su cauce (como el vado de las pistas)
    for (let q = 0; q < aguas.length; q++) {
      const a = aguas[q], ax = x - a.x, az = z - a.z;
      if (Math.abs(ax * a.hx + az * a.hz) > a.cruce + 14 || Math.abs(az * a.hx - ax * a.hz) > a.largo + 2) continue;
      const pb = az * a.hx - ax * a.hz, pa = Math.abs(ax * a.hx + az * a.hz - curvaDelArroyo(pb)), medio = a.cruce - 16;
      const f = (1 - suave(medio - 1, medio + 7, pa)) * (1 - suave(a.largo - 13, a.largo - 1, Math.abs(pb)));
      const lecho = a.y0 - 0.1 + ruido.capas(x / 5, z / 5, 2) * 0.18;
      if (f > 0 && h > lecho) h = mezcla(h, lecho, f);
      if (h < a.nivel + 0.25 && s === ARENA) s = LECHO;
    }
    // afuera del camino: manchas de fesh-fesh (lagunas secas) y de roca pelada
    if (s === ARENA) {
      const lag = ruido.n2(x / 40 + 7, z / 40 - 3);
      if (lag > 0.8) { s = FESH; h -= 0.12 * suave(0.8, 0.88, lag); }
      else if (ruido.n2(x / 55 - 20, z / 55 + 13) > 0.81) s = ROCA;
    }
    res.h = h; res.s = s;
  }

  // Arma un pedazo de terreno de LADO x LADO metros (con un metro por celda). Es siempre igual para el mismo lugar del camino,
  // asi que dos pedazos vecinos se encuentran justo en el borde.
  function armarTile(tx, tz) {
    const x0 = tx * LADO, z0 = tz * LADO;
    const gy = new Float32Array(NG * NG), gd = new Float32Array(NG * NG);
    for (let j = 0; j < NG; j++) for (let i = 0; i < NG; i++) { gruesa(x0 + i * 4, z0 + j * 4); gy[j * NG + i] = salida.y; gd[j * NG + i] = salida.d; }
    const Hb = new Float32Array(AN * AN), S = new Uint8Array(NV * NV);
    for (let j = -BORDE; j < NV + BORDE; j++) for (let i = -BORDE; i < NV + BORDE; i++) {
      const x = x0 + i, z = z0 + j;
      const fi = Math.min(NG - 1.0001, Math.max(0, i / 4)), fj = Math.min(NG - 1.0001, Math.max(0, j / 4)), a = Math.floor(fi), b = Math.floor(fj), fu = fi - a, fv = fj - b, k = b * NG + a;
      const yb = mezcla(mezcla(gy[k], gy[k + 1], fu), mezcla(gy[k + NG], gy[k + NG + 1], fu), fv);
      const dm = mezcla(mezcla(gd[k], gd[k + 1], fu), mezcla(gd[k + NG], gd[k + NG + 1], fu), fv);
      puntoDe(x, z, yb, dm);
      Hb[(j + BORDE) * AN + i + BORDE] = res.h;
      if (i >= 0 && i < NV && j >= 0 && j < NV) S[j * NV + i] = res.s;
    }
    const t = { tx, tz, x0, z0, nx: NV, nz: NV, Hb, S, rocas: [], decor: [], aguas: [], viva: true };
    t.alto = (i, j) => Hb[(j + BORDE) * AN + i + BORDE];
    // las piedras del camino que caen en este pedazo, y las que se suman por azar (las del lugar)
    const delCamino = rocasDeTile.get(kt(tx, tz));
    const rr = azar((tx * 73856093) ^ (tz * 19349663) ^ (semilla & 0xffff));
    if (delCamino) for (const o of delCamino) { o.y = alturaEn(t, o.x, o.z); t.rocas.push(o); }
    const azarosas = [];
    for (let q = 0, n = 3 + Math.floor(rr() * 5); q < n; q++) {
      const x = x0 + 2 + rr() * (LADO - 4), z = z0 + 2 + rr() * (LADO - 4), radio = 0.7 + rr() * rr() * 1.7;
      const c = cerca(x, z);
      if (c >= 0) { const ax = x - P.X[c], az = z - P.Z[c], lado = Math.abs(az * P.HX[c] - ax * P.HZ[c]); if (lado < P.W[c] / 2 + 2.5 + radio) continue; }
      if (S[Math.round(z - z0) * NV + Math.round(x - x0)] === LECHO) continue;
      const o = { x, z, y: alturaEn(t, x, z), r: radioDePiedra(radio), clase: 'piedra', duro: 1, vuelta: rr() * 6.28 };
      o.alto = altoDePiedra(o.r);
      ubicar(o); azarosas.push(o); t.rocas.push(o);
    }
    t.azarosas = azarosas;
    // yuyos: matas secas, pastos de la estepa y piedritas sueltas (son dibujos planos, no se chocan)
    const NOMBRES = ['mataSeca', 'arbustoSeco', 'coiron', 'neneo', 'cardo'];
    for (let zz = z0 + 1; zz < z0 + LADO - 1; zz += TRAVESIA.mata) for (let xx = x0 + 1; xx < x0 + LADO - 1; xx += TRAVESIA.mata) {
      const px = xx + (rr() - 0.5) * TRAVESIA.mata, pz = zz + (rr() - 0.5) * TRAVESIA.mata, e = rr(), f = rr();
      const k = Math.round(pz - z0) * NV + Math.round(px - x0);
      if (S[k] !== ARENA) continue;
      const racimo = ruido.n2(px / 24 + 11, pz / 24 - 5);
      if (e > (racimo > 0.55 ? 0.5 : 0.07)) continue;
      const c = cerca(px, pz);
      if (c >= 0) { const ax = px - P.X[c], az = pz - P.Z[c], lado = Math.abs(az * P.HX[c] - ax * P.HZ[c]); if (lado < P.W[c] / 2 + 1.2) continue; }
      const nombre = f < 0.07 ? 'piedra' : f < 0.12 ? 'piedraGrande' : NOMBRES[Math.floor(rr() * NOMBRES.length)];
      t.decor.push({ nombre, x: px, y: alturaEn(t, px, pz) - 0.04, z: pz, escala: 0.8 + rr() * 0.5, azar: rr(), mueve: nombre === 'piedra' || nombre === 'piedraGrande' ? 0 : 0.03 + rr() * 0.04 });
    }
    // los arroyos que pasan por este pedazo
    for (const a of aguas) if (Math.hypot(a.x - (x0 + LADO / 2), a.z - (z0 + LADO / 2)) < LADO * 0.71 + Math.hypot(a.cruce, a.largo)) t.aguas.push(a);
    tiles.set(kt(tx, tz), t);
    estadistica.armados++;
    return t;
  }
  function soltarTile(t) {
    if (!t.viva) return;
    t.viva = false;
    for (const o of t.azarosas) sacar(o);
    tiles.delete(kt(t.tx, t.tz));
    estadistica.soltados++;
  }
  const estadistica = { armados: 0, soltados: 0, podados: 0 };

  // altura de un pedazo, en un punto de adentro
  function alturaEn(t, x, z) {
    const u = Math.min(LADO - 0.0001, Math.max(0, x - t.x0)), v = Math.min(LADO - 0.0001, Math.max(0, z - t.z0));
    const i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j;
    const a = t.alto(i, j), b = t.alto(i + 1, j), c = t.alto(i, j + 1), d = t.alto(i + 1, j + 1);
    return fu + fv <= 1 ? a + (b - a) * fu + (c - a) * fv : d + (c - d) * (1 - fu) + (b - d) * (1 - fv);
  }
  // si el auto se va a donde todavia no hay pedazo armado (no deberia pasar), se calcula el punto a mano
  function alturaDirecta(x, z) {
    const gx = Math.floor(x / 4), gz = Math.floor(z / 4), fu = x / 4 - gx, fv = z / 4 - gz;
    const n = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([a, b]) => { gruesa((gx + a) * 4, (gz + b) * 4); return [salida.y, salida.d]; });
    puntoDe(x, z, mezcla(mezcla(n[0][0], n[1][0], fu), mezcla(n[2][0], n[3][0], fu), fv), mezcla(mezcla(n[0][1], n[1][1], fu), mezcla(n[2][1], n[3][1], fu), fv));
    return res.h;
  }
  let ult = null;
  const tileEn = (x, z) => {
    const tx = Math.floor(x / LADO), tz = Math.floor(z / LADO);
    if (ult && ult.tx === tx && ult.tz === tz && ult.viva) return ult;
    const t = tiles.get(kt(tx, tz));
    if (t) ult = t;
    return t;
  };
  function altura(x, z) {
    const t = tileEn(x, z);
    return t ? alturaEn(t, x, z) : alturaDirecta(x, z);
  }
  function normal(x, z, o) {
    const e = 0.45, sx = altura(x + e, z) - altura(x - e, z), sz = altura(x, z + e) - altura(x, z - e), l = Math.hypot(sx, 2 * e, sz);
    o[0] = -sx / l; o[1] = 2 * e / l; o[2] = -sz / l;
    return o;
  }
  // las cartas cambian el agarre y el freno de cada suelo: T.ajuste(o) recibe lo que se calculo y lo modifica
  const T = { ajuste: null };
  function suelo_(x, z, o) {
    const t = tileEn(x, z);
    let id;
    if (t) {
      const u = Math.min(NV - 1.001, Math.max(0, x - t.x0)), v = Math.min(NV - 1.001, Math.max(0, z - t.z0));
      const i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j, k = j * NV + i;
      const w0 = (1 - fu) * (1 - fv), w1 = fu * (1 - fv), w2 = (1 - fu) * fv, w3 = fu * fv;
      const s0 = SUELO[t.S[k]], s1 = SUELO[t.S[k + 1]], s2 = SUELO[t.S[k + NV]], s3 = SUELO[t.S[k + NV + 1]];
      o.agarre = s0.agarre * w0 + s1.agarre * w1 + s2.agarre * w2 + s3.agarre * w3;
      o.freno = s0.freno * w0 + s1.freno * w1 + s2.freno * w2 + s3.freno * w3;
      o.pasta = s0.pasta * w0 + s1.pasta * w1 + s2.pasta * w2 + s3.pasta * w3;
      id = t.S[k + (fu > 0.5 ? 1 : 0) + (fv > 0.5 ? NV : 0)];
      o.id = id;
      o.agua = aguas.length ? aguaEn(x, z, alturaEn(t, x, z)) : 0;
    } else {
      alturaDirecta(x, z);
      const s = SUELO[res.s];
      o.agarre = s.agarre; o.freno = s.freno; o.pasta = s.pasta; o.id = res.s;
      o.agua = aguas.length ? aguaEn(x, z, res.h) : 0;
    }
    if (o.agua > 0) { const a = Math.min(1, o.agua); o.pasta += a * 170; o.agarre *= 1 - 0.2 * a; }
    if (T.ajuste) T.ajuste(o);
    return o;
  }

  // =========================================================== lo que usa el juego ===========================================================
  // punto del camino mas cercano, buscando solo alrededor del ultimo conocido: asi no "salta" a otra parte que pase cerca
  function indice(x, z, pista) {
    let mejor = pista, md = 1e9;
    for (let i = Math.max(podado, pista - 30); i < Math.min(P.n, pista + 60); i++) {
      const dx = x - P.X[i], dz = z - P.Z[i], d = dx * dx + dz * dz;
      if (d < md) { md = d; mejor = i; }
    }
    return mejor;
  }
  const pose = (i) => ({ i, x: P.X[i], y: P.Y[i], z: P.Z[i], rumbo: Math.atan2(P.HX[i], -P.HZ[i]), ancho: P.W[i] });

  // Arma camino hasta "adelante" metros por delante del metro i, y tira lo que quedo mas de "atras" metros detras.
  function asegurar(i) {
    crecerCamino(i + TRAVESIA.adelante);
  }
  function podar(i) {
    const hasta = i - 520;
    while (podado < hasta) {
      const p = podado++;
      const k = clave(Math.floor(P.X[p] / CELDA), Math.floor(P.Z[p] / CELDA)), l = celdas.get(k);
      if (l) { if (l[0] === p) l.shift(); if (!l.length) celdas.delete(k); }
      if (p % PASO_ANCLA === 0) {
        const ka = clave(Math.floor(P.X[p] / CELDA_A), Math.floor(P.Z[p] / CELDA_A)), la = anclas.get(ka);
        if (la) { if (la[0] === p) la.shift(); if (!la.length) anclas.delete(ka); }
      }
      estadistica.podados++;
    }
    while (podadoRocas < porIndice.length && porIndice[podadoRocas][0] < hasta) {
      const o = porIndice[podadoRocas++][1];
      sacar(o);
      const k = clave(Math.floor(o.x / LADO), Math.floor(o.z / LADO)), l = rocasDeTile.get(k);
      if (l) { const q = l.indexOf(o); if (q >= 0) l.splice(q, 1); if (!l.length) rocasDeTile.delete(k); }
    }
    if (podadoRocas > 400) { porIndice.splice(0, podadoRocas); podadoRocas = 0; }
    while (aguas.length && aguas[0].i < hasta) aguas.shift();
  }
  // ¿tiene sentido armar un pedazo de terreno ahi? Solo si pasa el camino cerca.
  const viable = (tx, tz) => gruesa(tx * LADO + LADO / 2, tz * LADO + LADO / 2).d < 96 + LADO * 0.6;

  Object.assign(T, {
    semilla, camino: P, tiles, estadistica, aguas, notas, LADO,
    altura, normal, suelo: suelo_, cosasCerca: (x, z) => cajas.get(clave(Math.floor(x / 8), Math.floor(z / 8))),
    indice, pose, asegurar, podar, armarTile, soltarTile, viable, tileEn, hay: (tx, tz) => T.tiles.has(kt(tx, tz)),
    largada: null,
    // cuantas piedras y celdas hay anotadas (para mirar que se liberan)
    memoria: () => ({ camino: P.n, celdas: celdas.size, anclas: anclas.size, cajas: cajas.size, piedras: porIndice.length - podadoRocas, tiles: tiles.size, aguas: aguas.length, podado }),
  });
  crecerCamino(TRAVESIA.adelante);
  T.largada = pose(8);
  return T;
}

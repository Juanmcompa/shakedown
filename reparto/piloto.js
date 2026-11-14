// Reparto: un piloto automatico. No es para el que juega: lo usan las pruebas para hacer viajes de verdad (por las calles,
// doblando en las esquinas, por la mano derecha) sin que nadie maneje. Busca el camino mas corto por las esquinas.
import { PASO, MANZANAS, CALLE } from './mapa.js';

const lim = (v, a, b) => (v < a ? a : v > b ? b : v);
const N = MANZANAS + 1;

// las dos esquinas de la cuadra donde esta un punto de la calle
function puntas(x, z) {
  const j = Math.round(z / PASO), i = Math.round(x / PASO);
  if (Math.abs(z - j * PASO) <= CALLE + 1) { const a = lim(Math.floor(x / PASO), 0, MANZANAS - 1); return [[a, j], [a + 1, j]]; }
  const b = lim(Math.floor(z / PASO), 0, MANZANAS - 1);
  return [[i, b], [i, b + 1]];
}

// el camino: una lista de puntos (las esquinas por las que pasa y, al final, el destino)
export function camino(desde, hasta) {
  const id = ([i, j]) => i * N + j, pos = (k) => [Math.floor(k / N) * PASO, (k % N) * PASO];
  const dist = new Float64Array(N * N).fill(Infinity), antes = new Int32Array(N * N).fill(-1), hecho = new Uint8Array(N * N);
  for (const p of puntas(desde.x, desde.z)) { const k = id(p), [x, z] = pos(k); dist[k] = Math.abs(x - desde.x) + Math.abs(z - desde.z); }
  const fin = new Map(puntas(hasta.x, hasta.z).map((p) => { const k = id(p), [x, z] = pos(k); return [k, Math.abs(x - hasta.x) + Math.abs(z - hasta.z)]; }));
  for (;;) {
    let k = -1;
    for (let q = 0; q < N * N; q++) if (!hecho[q] && dist[q] < Infinity && (k < 0 || dist[q] < dist[k])) k = q;
    if (k < 0) break;
    hecho[k] = 1;
    const i = Math.floor(k / N), j = k % N;
    for (const [a, b] of [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]]) {
      if (a < 0 || b < 0 || a >= N || b >= N) continue;
      const q = a * N + b;
      if (dist[k] + PASO < dist[q]) { dist[q] = dist[k] + PASO; antes[q] = k; }
    }
  }
  let mejor = -1;
  for (const [k, d] of fin) if (mejor < 0 || dist[k] + d < dist[mejor] + fin.get(mejor)) mejor = k;
  const lista = [];
  for (let k = mejor; k >= 0; k = antes[k]) { const [x, z] = pos(k); lista.unshift({ x, z }); }
  // (si el destino esta en la misma cuadra, va derecho)
  const misma = puntas(desde.x, desde.z).map(id).join() === puntas(hasta.x, hasta.z).map(id).join();
  return misma ? [{ x: hasta.x, z: hasta.z }] : [...lista, { x: hasta.x, z: hasta.z }];
}

// el piloto de un viaje. paso(c, ent, dt): llena "ent" (volante, acelerador, freno de mano) para el auto c.
export function crearPiloto(desde, hasta) {
  const puntos = camino(desde, hasta);
  let k = 0, quieto = 0, atras = 0;
  return function paso(c, ent, dt) {
    const v = c.velocidad;
    if (atras > 0) { atras -= dt; ent.y = -1; ent.x = 0; ent.mano = false; return; }
    if (Math.abs(v) < 0.6) quieto += dt; else quieto = 0;
    if (quieto > 2.5) { atras = 1.2; quieto = 0; }
    let p = puntos[k];
    while (k < puntos.length - 1 && Math.hypot(p.x - c.pos[0], p.z - c.pos[2]) < 7) p = puntos[++k];
    const ultimo = k === puntos.length - 1;
    // por la mano derecha: el punto se corre 2,5 m a la derecha de hacia donde va
    let dx = p.x - c.pos[0], dz = p.z - c.pos[2];
    const l = Math.hypot(dx, dz) || 1;
    const tx = ultimo ? p.x : p.x + (-dz / l) * 2.5, tz = ultimo ? p.z : p.z + (dx / l) * 2.5;
    dx = tx - c.pos[0]; dz = tz - c.pos[2];
    const rumbo = Math.atan2(c.adelante[0], -c.adelante[2]);
    let e = Math.atan2(dx, -dz) - rumbo;
    e = Math.atan2(Math.sin(e), Math.cos(e));
    ent.x = lim(e * 2.2, -1, 1);
    const lejos = Math.hypot(dx, dz);
    // despacio en las esquinas (si dobla) y frenando al llegar
    const quiero = ultimo ? Math.min(13, Math.max(0, (lejos - 1.5) * 0.8)) : lejos < 22 ? 7 : 13;
    ent.y = v > quiero + 1.5 ? -1 : v > quiero ? 0 : Math.abs(e) > 1.2 && v > 4 ? 0 : 1;
    if (ultimo && lejos < 2.5) ent.y = v > 0.5 ? -1 : 0;
    ent.mano = false;
  };
}

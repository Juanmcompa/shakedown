// Reparto: un piloto automatico. No es para el que juega: lo usan las pruebas para hacer viajes de verdad (por las calles,
// doblando en las esquinas, por la mano derecha) sin que nadie maneje. Busca el camino mas corto por las esquinas.
import { CALLES, aCalle } from './mapa.js';

const lim = (v, a, b) => (v < a ? a : v > b ? b : v);

// la calle mas cercana a un punto y las dos esquinas de esa cuadra
function cuadra(red, x, z) {
  let s = CALLES[0], d = 1e9;
  for (const q of CALLES) { const e = aCalle(q, x, z).d; if (e < d) { d = e; s = q; } }
  const t = aCalle(s, x, z).t;
  const en = red.nodos.filter((n) => aCalle(s, n.x, n.z).d < 0.5).map((n) => ({ n, t: aCalle(s, n.x, n.z).t })).sort((a, b) => a.t - b.t);
  let a = en[0], b = en[en.length - 1];
  for (let k = 1; k < en.length; k++) if (en[k].t >= t) { a = en[k - 1]; b = en[k]; break; }
  return { s, puntas: [a, b].map((p) => ({ n: p.n, d: Math.abs(p.t - t) })) };
}

// el camino: una lista de puntos (las esquinas por las que pasa y, al final, el destino), cada uno con el ancho de su calle
export function camino(red, desde, hasta) {
  const A = cuadra(red, desde.x, desde.z), Bq = cuadra(red, hasta.x, hasta.z);
  const N = red.nodos.length, dist = new Float64Array(N).fill(Infinity), antes = new Int32Array(N).fill(-1), hecho = new Uint8Array(N);
  for (const p of A.puntas) dist[p.n.id] = Math.min(dist[p.n.id], p.d);
  for (;;) {
    let k = -1;
    for (let q = 0; q < N; q++) if (!hecho[q] && dist[q] < Infinity && (k < 0 || dist[q] < dist[k])) k = q;
    if (k < 0) break;
    hecho[k] = 1;
    for (const v of red.nodos[k].vecinos) if (dist[k] + v.largo < dist[v.n.id]) { dist[v.n.id] = dist[k] + v.largo; antes[v.n.id] = k; }
  }
  let mejor = Bq.puntas[0];
  for (const p of Bq.puntas) if (dist[p.n.id] + p.d < dist[mejor.n.id] + mejor.d) mejor = p;
  const lista = [];
  for (let k = mejor.n.id; k >= 0; k = antes[k]) lista.unshift({ x: red.nodos[k].x, z: red.nodos[k].z });
  if (A.s === Bq.s && A.puntas[0].n === Bq.puntas[0].n) return [{ x: hasta.x, z: hasta.z }];   // en la misma cuadra: derecho
  return [...lista, { x: hasta.x, z: hasta.z }];
}

// el piloto de un viaje. paso(c, ent, dt): llena "ent" (volante, acelerador, freno de mano) para el auto c.
export function crearPiloto(red, desde, hasta) {
  const puntos = camino(red, desde, hasta);
  let k = 0, quieto = 0, atras = 0;
  return function paso(c, ent, dt) {
    const v = c.velocidad;
    if (atras > 0) { atras -= dt; ent.y = -1; ent.x = 0; ent.mano = false; return; }
    if (Math.abs(v) < 0.6) quieto += dt; else quieto = 0;
    if (quieto > 2.5) { atras = 1.2; quieto = 0; }
    let p = puntos[k];
    while (k < puntos.length - 1 && Math.hypot(p.x - c.pos[0], p.z - c.pos[2]) < 8) p = puntos[++k];
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
    // despacio en las esquinas y frenando al llegar
    const quiero = ultimo ? Math.min(13, Math.max(0, (lejos - 1) * 0.7)) : lejos < 24 ? 7 : 14;
    ent.y = v > quiero + 1.5 ? -1 : v > quiero ? 0 : Math.abs(e) > 1.2 && v > 4 ? 0 : 1;
    if (ultimo && lejos < 1.8) ent.y = v > 0.4 ? -1 : 0;
    ent.mano = false;
  };
}

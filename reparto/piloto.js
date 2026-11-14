// Reparto: un piloto automatico. No es para el que juega: lo usan las pruebas para hacer viajes de verdad (por las calles,
// doblando en las esquinas, por la mano derecha) sin que nadie maneje. Sigue el camino mas corto (ver camino, en mapa.js).
// En el deposito estaciona de culata: entra al playon, da la vuelta y retrocede hasta el porton (con el semi no le sale
// bien: el remolque marcha atras es dificil hasta para el piloto).
import { camino, DEPOSITO } from './mapa.js';

const lim = (v, a, b) => (v < a ? a : v > b ? b : v);
const rumboA = (dx, dz) => Math.atan2(dx, -dz);
const giro = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// el piloto de un viaje: de "desde" (un destino, o un punto) a "hasta". cola(): donde esta la cola del vehiculo (para
// estacionar de culata). paso(c, ent, dt) llena "ent" (volante, acelerador, freno de mano) para el auto c.
export function crearPiloto(red, desde, hasta, cola) {
  let puntos = camino(red, desde, hasta).puntos;
  const culata = !!hasta.deposito;
  if (culata) {
    // en vez de ir al porton: entra por la ENTRADA, sigue el flujo del playon (hacia la izquierda), pasa de largo el porton
    // y desde ahi retrocede de culata
    const D = DEPOSITO, zq = D.quiebre;
    puntos = puntos.slice(0, -1).concat([{ x: Math.min(hasta.x + 10, D.entrada[0] - 2), z: zq + 15 }, { x: Math.max(hasta.x - 9, D.x0 + 5), z: zq + 7 }]);
  }
  let k = 0, quieto = 0, atras = 0, marcha = false;
  return function paso(c, ent, dt) {
    const v = c.velocidad;
    ent.mano = false;
    // --- de culata, hasta el porton ---
    if (marcha) {
      const q = cola(), dx = hasta.puerta.x - c.pos[0], dz = hasta.puerta.z - c.pos[2];
      const r = rumboA(c.adelante[0], c.adelante[2]);
      const e = giro(rumboA(dx, dz) - (r + Math.PI));
      ent.x = lim(-e * 2.5, -1, 1);   // (marcha atras, el volante se da al reves)
      const falta = Math.hypot(q.x - hasta.puerta.x, q.z - hasta.puerta.z);
      ent.y = falta < 1.2 ? (v < -0.3 ? 1 : 0) : v < -2.5 ? 0 : -0.7;
      return;
    }
    if (atras > 0) { atras -= dt; ent.y = -1; ent.x = 0; return; }
    if (Math.abs(v) < 0.6) quieto += dt; else quieto = 0;
    if (quieto > 2.5) { atras = 1.4; quieto = 0; }
    let p = puntos[k];
    while (k < puntos.length - 1 && Math.hypot(p.x - c.pos[0], p.z - c.pos[2]) < 8) p = puntos[++k];
    const ultimo = k === puntos.length - 1;
    // por la mano derecha: el punto se corre 2,5 m a la derecha de hacia donde va
    let dx = p.x - c.pos[0], dz = p.z - c.pos[2];
    const l = Math.hypot(dx, dz) || 1;
    const corre = ultimo || (culata && k >= puntos.length - 4);
    const tx = corre ? p.x : p.x + (-dz / l) * 2.5, tz = corre ? p.z : p.z + (dx / l) * 2.5;
    dx = tx - c.pos[0]; dz = tz - c.pos[2];
    const e = giro(rumboA(dx, dz) - rumboA(c.adelante[0], c.adelante[2]));
    ent.x = lim(e * 2.2, -1, 1);
    const lejos = Math.hypot(dx, dz);
    if (culata && ultimo && lejos < 4) { marcha = true; ent.y = -1; return; }
    // despacio en las esquinas y frenando al llegar
    const quiero = ultimo ? Math.min(12, Math.max(culata ? 4 : 0, (lejos - 1) * 0.7)) : lejos < 24 ? 6.5 : 13;
    ent.y = v > quiero + 1.5 ? -1 : v > quiero ? 0 : Math.abs(e) > 1.2 && v > 4 ? 0 : 1;
    if (ultimo && !culata && lejos < 1.8) ent.y = v > 0.4 ? -1 : 0;
  };
}

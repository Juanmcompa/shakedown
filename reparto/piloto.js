// Reparto: un piloto automatico. No es para el que juega: lo usan las pruebas para hacer viajes de verdad (por las calles,
// doblando en las esquinas, por la mano derecha) sin que nadie maneje. Sigue el camino mas corto (ver camino, en mapa.js).
import { camino } from './mapa.js';

const lim = (v, a, b) => (v < a ? a : v > b ? b : v);

// el piloto de un viaje: de "desde" (un destino, o un punto) a "hasta". paso(c, ent, dt) llena "ent" (volante, acelerador,
// freno de mano) para el auto c.
export function crearPiloto(red, desde, hasta) {
  const puntos = camino(red, desde, hasta).puntos;
  let k = 0, quieto = 0, atras = 0;
  return function paso(c, ent, dt) {
    const v = c.velocidad;
    if (atras > 0) { atras -= dt; ent.y = -1; ent.x = 0; ent.mano = false; return; }
    if (Math.abs(v) < 0.6) quieto += dt; else quieto = 0;
    if (quieto > 2.5) { atras = 1.4; quieto = 0; }
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
    const quiero = ultimo ? Math.min(12, Math.max(0, (lejos - 1) * 0.7)) : lejos < 24 ? 6.5 : 13;
    ent.y = v > quiero + 1.5 ? -1 : v > quiero ? 0 : Math.abs(e) > 1.2 && v > 4 ? 0 : 1;
    if (ultimo && lejos < 1.8) ent.y = v > 0.4 ? -1 : 0;
    ent.mano = false;
  };
}

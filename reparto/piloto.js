// Reparto: un piloto automatico. No es para el que juega: lo usan las pruebas para hacer viajes de verdad (por las calles,
// doblando en las esquinas, por la mano derecha) sin que nadie maneje. Sigue el camino mas corto (ver camino, en mapa.js).
// En el deposito estaciona de culata: entra al playon, da la vuelta y retrocede hasta el porton (con el semi no le sale
// bien: el remolque marcha atras es dificil hasta para el piloto).
import { camino, caminoPor, ROTONDAS } from './mapa.js';

const lim = (v, a, b) => (v < a ? a : v > b ? b : v);
const rumboA = (dx, dz) => Math.atan2(dx, -dz);
const giro = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// el piloto de un viaje: de "desde" (un destino, o un punto) a "hasta". cola(): donde esta la cola del vehiculo (para
// estacionar de culata). paso(c, ent, dt) llena "ent" (volante, acelerador, freno de mano) para el auto c.
// paradas: por donde hay que pasar antes, en orden, frenando un momento en cada una (colectivos y taxis).
// largo: true para los vehiculos largos (camion, semi, colectivo): dobla antes y mas despacio.
export function crearPiloto(red, desde, hasta, cola, paradas = [], largo = false) {
  let puntos = (paradas.length ? caminoPor(red, [desde, ...paradas, hasta]) : camino(red, desde, hasta)).puntos;
  const culata = !!hasta.deposito;
  if (culata) {
    // en vez de ir al porton: entra por la ENTRADA, sigue el flujo del playon (hacia la izquierda), pasa de largo el porton
    // y desde ahi retrocede de culata
    const D = hasta.dep, zq = D.quiebre;
    puntos = puntos.slice(0, -1).concat([{ x: Math.min(hasta.x + 10, D.entrada[0] - 2), z: zq + 15 }, { x: Math.max(hasta.x - 9, D.x0 + 5), z: zq + 7 }]);
  }
  puntos = rodear(puntos, desde);
  let k = 0, quieto = 0, atras = 0, marcha = false, espera = 0, giraAtras = 0, pausa = 0;
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
    // marcha atras (trabado, o para dar la vuelta en tres movimientos): con el volante al reves
    pausa -= dt;
    if (atras > 0) { atras -= dt; ent.y = -1; ent.x = giraAtras; return; }
    if (Math.abs(v) < 0.6) quieto += dt; else quieto = 0;
    if (quieto > 2.5) { atras = 1.4; quieto = 0; giraAtras = 0; }
    let p = puntos[k];
    // en una parada: frena del todo, espera que suban y sigue
    if (p.parada && Math.hypot(p.x - c.pos[0], p.z - c.pos[2]) < 2.5) {
      ent.x = 0; ent.y = v > 0.3 ? -1 : 0;
      if (Math.abs(v) < 0.4 && (espera += dt) > 1.4) { espera = 0; k++; }
      return;
    }
    while (k < puntos.length - 1 && !p.parada && Math.hypot(p.x - c.pos[0], p.z - c.pos[2]) < (p.anillo ? 4.5 : largo ? 11 : 8)) p = puntos[++k];
    const ultimo = k === puntos.length - 1;
    // por la mano derecha: el punto se corre 2,5 m a la derecha de hacia donde va
    let dx = p.x - c.pos[0], dz = p.z - c.pos[2];
    const l = Math.hypot(dx, dz) || 1;
    const corre = ultimo || p.parada || p.anillo || (culata && k >= puntos.length - 4);
    const tx = corre ? p.x : p.x + (-dz / l) * 2.5, tz = corre ? p.z : p.z + (dx / l) * 2.5;
    dx = tx - c.pos[0]; dz = tz - c.pos[2];
    const e = giro(rumboA(dx, dz) - rumboA(c.adelante[0], c.adelante[2]));
    ent.x = lim(e * 2.2, -1, 1);
    // el punto quedo a la espalda y va despacio: en vez de una vuelta en U muy abierta, marcha atras doblando al reves
    // (una maniobra cada tanto: despues hay que dejarlo avanzar doblando)
    if (pausa <= 0 && Math.abs(e) > 2.4 && Math.abs(v) < 1.5 && !(culata && ultimo)) { atras = 1.6; pausa = 7; giraAtras = -Math.sign(e); ent.y = -1; return; }
    const lejos = Math.hypot(dx, dz);
    if (culata && ultimo && lejos < 4) { marcha = true; ent.y = -1; return; }
    // despacio en las esquinas y frenando al llegar
    const quiero = ultimo || p.parada ? Math.min(12, Math.max(culata && ultimo ? 4 : 0, (lejos - 1) * 0.7)) : p.anillo ? (largo ? 4.5 : 6) : lejos < (largo ? 30 : 24) ? (largo ? 4.2 : 6.5) : 13;
    ent.y = v > quiero + 1.5 ? -1 : v > quiero ? 0 : Math.abs(e) > 1.2 && v > 4 ? 0 : 1;
    if (ultimo && !culata && lejos < 1.8) ent.y = v > 0.4 ? -1 : 0;
  };
}

// Las rotondas: si el camino pasa por el centro de una, en vez de ir al centro se la rodea por el anillo, girando en
// sentido contrario a las agujas del reloj (visto desde arriba con el norte arriba: en el dibujo, con z hacia abajo, el
// angulo baja). Se entra doblando a la derecha y se sale por la boca que va hacia el punto siguiente.
function rodear(puntos, desde) {
  const out = [];
  for (let i = 0; i < puntos.length; i++) {
    const p = puntos[i], q = ROTONDAS.find((r) => Math.hypot(r.x - p.x, r.z - p.z) < 1);
    if (!q || i === puntos.length - 1) { out.push(p); continue; }
    const antes = i > 0 ? puntos[i - 1] : desde, despues = puntos[i + 1], rm = (q.ri + q.ro) / 2 + 0.5;
    const a0 = Math.atan2(antes.z - q.z, antes.x - q.x), a1 = Math.atan2(despues.z - q.z, despues.x - q.x);
    let vuelta = a0 - a1;
    while (vuelta <= 0.3) vuelta += 2 * Math.PI;
    while (vuelta > 2 * Math.PI + 0.3) vuelta -= 2 * Math.PI;
    for (let t = 0.45; t < vuelta - 0.3; t += 0.5) out.push({ x: q.x + Math.cos(a0 - t) * rm, z: q.z + Math.sin(a0 - t) * rm, anillo: true });
  }
  return out;
}

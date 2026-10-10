// Pilotos "humanos" recorren la etapa con las reglas del juego (nafta, daño, rescates)
// para estimar la dificultad: manejan con teclas (todo o nada), reaccionan cada tanto
// y no van perfecto por el medio.
//
// uso: node tools/humano.mjs [vueltas por piloto]
import { crearTerreno } from '../src/terrain.js';
import { crearCamioneta } from '../src/vehicle.js';
import { crearPartida } from '../src/reglas.js';
import { ETAPA } from '../src/etapa1.js';
import { JUEGO } from '../src/config.js';
import { azar } from '../src/noise.js';

const DT = JUEGO.paso;

export function humano(T, o) {
  const P = T.camino, c = crearCamioneta(T), p = crearPartida(T), rnd = azar(o.semilla || 1);
  const ent = { x: 0, y: 0, mano: false }, fallas = {};
  let t = 0, prox = 0, desvio = 0, desvioObj = 0, tDesvio = 0, quieto = 0, atras = 0, tAvance = 0, mAvance = 0, autoCerca = false;
  // pide un rescate y anota donde y por que
  const pedir = (motivo) => {
    const i = p.indice, tr = ETAPA.tramos[P.T[i]], k = (tr.nombre || tr.suelo) + ' (' + P.T[i] + '): ' + motivo;
    fallas[k] = (fallas[k] || 0) + 1;
    if (o.traza) console.log('   rescate', motivo, 'en metro', i, 'lado', ((c.pos[0] - P.X[i]) * -P.HZ[i] + (c.pos[2] - P.Z[i]) * P.HX[i]).toFixed(1), 'vel', c.velocidad.toFixed(1), 't', t.toFixed(0));
    p.rescatar(c, 'pedido');
  };
  p.empezar(c);
  while (t < 600 && p.estado !== 'llegada' && p.estado !== 'perdido') {
    const idx = p.indice, v = c.velocidad, tramo = ETAPA.tramos[P.T[idx]];
    if (t >= prox) {
      prox = t + o.reaccion * (0.7 + 0.6 * rnd());
      if (t >= tDesvio) { tDesvio = t + 1.5 + rnd() * 2; desvioObj = (rnd() * 2 - 1) * o.desvio; }
      desvio += (desvioObj - desvio) * 0.3;
      const ade = Math.min(P.n - 1, idx + Math.round(6 + 0.7 * Math.abs(v)));
      const lim = Math.max(0, P.W[ade] / 2 - 1.6);
      let dv = Math.max(-lim, Math.min(lim, desvio));
      // en el derrumbe apunta hacia arriba de la ladera, y esquiva lo que esta marcado en el tramo
      const ta = ETAPA.tramos[P.T[ade]], ua = P.U[ade];
      if (ta.derrumbe && ua > ta.derrumbe[0] - 6 && ua < ta.derrumbe[1]) dv = -lim;
      autoCerca = false;
      for (const a of ta.autos || []) if (Math.abs(a[1]) < P.W[ade] / 2 && Math.abs(ua - a[0]) < 10) { dv = a[1] > 0 ? Math.min(dv, a[1] - 2.7) : Math.max(dv, a[1] + 2.7); autoCerca = true; }
      for (const z of ta.pozos || []) if (z[4] === 'pantano' && Math.abs(ua - z[0]) < z[2] + 3) dv = z[1] > 0 ? Math.min(dv, z[1] - z[2] - 1.8) : Math.max(dv, z[1] + z[2] + 1.8);
      const tx = P.X[ade] - P.HZ[ade] * dv, tz = P.Z[ade] + P.HX[ade] * dv;
      const dx = tx - c.pos[0], dz = tz - c.pos[2], f = c.adelante;
      const e = Math.atan2(f[0] * dz - f[2] * dx, f[0] * dx + f[2] * dz);
      ent.x = e > o.umbral ? 1 : e < -o.umbral ? -1 : 0;
      // velocidad: segun la curva, el ancho y lo que pide el piloto
      const a2 = Math.min(P.n - 1, idx + 16);
      let dpsi = Math.atan2(P.HX[a2], -P.HZ[a2]) - Math.atan2(P.HX[idx], -P.HZ[idx]);
      dpsi = Math.atan2(Math.sin(dpsi), Math.cos(dpsi));
      const pend = (P.Y[a2] - P.Y[idx]) / 16;
      const envion = o.envion.includes(P.T[idx]);
      // frena en las curvas, en lo angosto, en las bajadas y al pasar junto a un auto tirado en un lugar angosto
      const vt = envion ? 14 : Math.min(o.v, Math.sqrt(o.lateral / (Math.abs(dpsi) / 16 + 1e-4)), 2.5 + 2.2 * (P.W[ade] - 4), pend < -0.15 ? 5 : 99, autoCerca && P.W[ade] < 9.5 ? o.cuidado : 99);
      // reductora: baja en lo empinado (subiendo o bajando) y en los escalones
      c.baja = !envion && (pend > 0.24 || pend < -0.15 || !!tramo.escalones);
      ent.y = v < vt ? 1 : v > vt + 2 ? -1 : 0;
      // si quedo trabado, un rato de marcha atras
      quieto = Math.abs(v) < 0.6 ? quieto + o.reaccion : 0;
      if (quieto > 2.5) { atras = t + 1.6; quieto = 0; }
      if (t < atras) { ent.y = -1; ent.x = -ent.x; }
      if (p.volcado) pedir('volcado');
    }
    c.paso(ent, DT); t += DT;
    if (Math.round(t / DT) % 2 === 0) {
      const antes = p.indice, lado = p.lejos;
      p.paso(c, ent.y, DT * 2);
      for (const ev of p.eventos.splice(0)) {
        if (ev.tipo === 'rescate' && ev.dato !== 'pedido') {
          const tr = ETAPA.tramos[P.T[antes]], k = (tr.nombre || tr.suelo) + ' (' + P.T[antes] + '): ' + ev.dato;
          fallas[k] = (fallas[k] || 0) + 1;
          if (o.traza) console.log('   rescate', ev.dato, 'en metro', antes, 'lejos del borde', lado.toFixed(1), 't', t.toFixed(0));
        }
      }
      // si en 12 segundos no avanzo 3 metros, pide rescate
      if (p.indice > mAvance + 3) { mAvance = p.indice; tAvance = t; }
      if (p.indice < mAvance - 20) { mAvance = p.indice; tAvance = t; }
      if (t - tAvance > 12) { pedir('encajado'); tAvance = t; mAvance = p.indice; }
    }
  }
  return { llego: p.estado === 'llegada', motivo: p.motivo, t: p.tiempo, nafta: p.nafta, roto: p.rotura(), usados: p.usados, m: p.indice, fallas };
}

if (process.argv[1].endsWith('humano.mjs')) {
  const T = crearTerreno(ETAPA), N = Number(process.argv[2] || 10);
  const envion = ETAPA.tramos.map((t, i) => (t.envion ? i : -1)).filter((i) => i >= 0);
  // cuidado: a que velocidad (m/s) pasa junto a un auto tirado en un lugar angosto
  const pilotos = { prolijo: { reaccion: 0.12, umbral: 0.05, desvio: 0.8, lateral: 2.8, cuidado: 2.5 }, normal: { reaccion: 0.2, umbral: 0.08, desvio: 1.4, lateral: 3.4, cuidado: 3.5 }, bruto: { reaccion: 0.3, umbral: 0.12, desvio: 2.0, lateral: 4.5, cuidado: 5 } };
  for (const [nombre, pf] of Object.entries(pilotos)) for (const v of [6, 8, 11]) {
    let llegan = 0, tt = 0, nafta = 0, roto = 0, usados = 0; const motivos = {}, suma = {};
    for (let s = 1; s <= N; s++) {
      const r = humano(T, { ...pf, v, envion, semilla: s * 31 + v });
      if (r.llego) { llegan++; tt += r.t; nafta += r.nafta; } else motivos[r.motivo + ' m' + Math.round(r.m / 50) * 50] = (motivos[r.motivo + ' m' + Math.round(r.m / 50) * 50] || 0) + 1;
      roto += r.roto; usados += r.usados;
      for (const k in r.fallas) suma[k] = (suma[k] || 0) + r.fallas[k];
    }
    console.log(nombre.padEnd(8), 'a', String(v).padStart(2), 'm/s: llegan', llegan + '/' + N, '| tiempo', llegan ? (tt / llegan).toFixed(0) + ' s' : '-', '| nafta que sobra', llegan ? (nafta / llegan).toFixed(0) : '-', '| daño', (roto / N).toFixed(0), '| rescates', (usados / N).toFixed(1), '| pierden por:', JSON.stringify(motivos));
    const orden = Object.entries(suma).sort((a, b) => b[1] - a[1]).slice(0, 5);
    if (orden.length) console.log('         rescates en: ' + orden.map((e) => e[0] + ' x' + e[1]).join(' | '));
  }
}

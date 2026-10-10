// Piloto "humano": teclas (todo o nada), reacciona cada tanto y no va perfecto por el medio.
import { crearTerreno } from '../src/terrain.js';
import { crearCamioneta } from '../src/vehicle.js';
import { ETAPA } from '../src/etapa1.js';
import { JUEGO } from '../src/config.js';
import { azar } from '../src/noise.js';

const DT = JUEGO.paso;
export function humano(T, o) {
  const P = T.camino, c = crearCamioneta(T), rnd = azar(o.semilla || 1);
  let idx = T.largada.i, t = 0, control = T.largada, quieto = 0, proximo = 0, prox = 0, desvio = 0, desvioObj = 0, tDesvio = 0;
  c.poner(control.x, control.z, control.rumbo);
  const ent = { x: 0, y: 0, mano: false }, fallas = {}, lista = [];
  let nf = 0;
  while (t < (o.limite || 400)) {
    idx = T.indice(c.pos[0], c.pos[2], idx);
    if (t >= prox) {
      prox = t + o.reaccion * (0.7 + 0.6 * rnd());
      if (t >= tDesvio) { tDesvio = t + 1.5 + rnd() * 2; desvioObj = (rnd() * 2 - 1) * o.desvio; }
      desvio += (desvioObj - desvio) * 0.3;
      const v = c.velocidad, ade = Math.min(P.n - 1, idx + Math.round(6 + 0.7 * Math.abs(v)));
      const lim = Math.max(0, P.W[ade] / 2 - 1.6), dv = Math.max(-lim, Math.min(lim, desvio));
      const tx = P.X[ade] - P.HZ[ade] * dv, tz = P.Z[ade] + P.HX[ade] * dv;
      const dx = tx - c.pos[0], dz = tz - c.pos[2], f = c.adelante;
      const e = Math.atan2(f[0] * dz - f[2] * dx, f[0] * dx + f[2] * dz);
      ent.x = e > o.umbral ? 1 : e < -o.umbral ? -1 : 0;
      const a2 = Math.min(P.n - 1, idx + 16);
      let dpsi = Math.atan2(P.HX[a2], -P.HZ[a2]) - Math.atan2(P.HX[idx], -P.HZ[idx]);
      dpsi = Math.atan2(Math.sin(dpsi), Math.cos(dpsi));
      const k = typeof o.v === 'function' ? o.v(P.T[idx], idx) : o.v;
      const vt = Math.min(k, Math.sqrt(o.lateral / (Math.abs(dpsi) / 16 + 1e-4)), o.cuida ? 2.5 + 2.2 * (P.W[ade] - 4) : 99);
      ent.y = v < vt ? 1 : v > vt + 2 ? -1 : 0;
      if (Math.abs(e) > 1.2 && Math.abs(v) < 1) ent.y = -1;   // quedo cruzado: marcha atras
    }
    c.paso(ent, DT); t += DT;
    if (proximo < T.controles.length && idx >= T.controles[proximo].i) { control = T.controles[proximo]; proximo++; }
    if (idx >= T.meta.i) break;
    const lado = Math.hypot(c.pos[0] - P.X[idx], c.pos[2] - P.Z[idx]);
    quieto = Math.abs(c.velocidad) < 0.5 ? quieto + DT : 0;
    let falla = null;
    if (c.arriba[1] < 0.3) falla = 'vuelco';
    else if (c.pos[1] < P.Y[idx] - 9) falla = 'caida';
    else if (lado > P.W[idx] / 2 + 9) falla = 'afuera';
    else if (quieto > 5) falla = 'encajado';
    if (falla) {
      const tr = P.T[idx], k = tr + ' ' + (ETAPA.tramos[tr].nombre || ETAPA.tramos[tr].suelo) + ': ' + falla;
      fallas[k] = (fallas[k] || 0) + 1; nf++; quieto = 0; lista.push(k + ' m' + idx);
      if (nf > (o.intentos || 12)) break;
      c.poner(control.x, control.z, control.rumbo); idx = control.i;
    }
  }
  return { t, llego: idx >= T.meta.i, nf, fallas, lista };
}

if (process.argv[1].endsWith('humano.mjs')) {
  const T = crearTerreno(ETAPA), N = Number(process.argv[2] || 12);
  const perfiles = { prolijo: { reaccion: 0.12, umbral: 0.05, desvio: 0.8, lateral: 2.8 }, normal: { reaccion: 0.2, umbral: 0.08, desvio: 1.4, lateral: 3.4 }, bruto: { reaccion: 0.3, umbral: 0.12, desvio: 2.0, lateral: 4.5 } };
  const ENV = (process.argv[3] || '5,6,7,21,22').split(',').map(Number);
  const envion = (v) => (tr) => (ENV.includes(tr) ? 14 : v);
  for (const [nombre, pf] of Object.entries(perfiles)) for (const v of [7, 10, 13]) {
    let llegan = 0, tt = 0, nf = 0; const suma = {};
    for (let s = 1; s <= N; s++) { const r = humano(T, { ...pf, v: envion(v), cuida: true, semilla: s * 31 + v }); if (r.llego) { llegan++; tt += r.t; } nf += r.nf; for (const k in r.fallas) suma[k] = (suma[k] || 0) + r.fallas[k]; }
    console.log(nombre.padEnd(8), 'a', String(v).padStart(2), 'm/s: llegan', llegan + '/' + N, 'tiempo medio', llegan ? (tt / llegan).toFixed(0) : '-', 's, fallas por vuelta', (nf / N).toFixed(1));
    const orden = Object.entries(suma).sort((a, b) => b[1] - a[1]).slice(0, 6);
    if (orden.length) console.log('      ' + orden.map((e) => e[0] + ' x' + e[1]).join(' | '));
  }
}

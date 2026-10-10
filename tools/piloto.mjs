// Un piloto automatico recorre la etapa para ver si se puede terminar y donde cuesta.
import { crearTerreno } from '../src/terrain.js';
import { crearCamioneta } from '../src/vehicle.js';
import { ETAPA } from '../src/etapa1.js';
import { JUEGO, SUELO } from '../src/config.js';

const DT = JUEGO.paso;
export function recorrer(T, vObj, opciones = {}) {
  const P = T.camino, c = crearCamioneta(T), log = [];
  let idx = T.largada.i, t = 0, control = T.largada, quieto = 0, caidas = 0, proximo = 0, tramo = -1, vmax = 0, nan = false;
  c.poner(control.x, control.z, control.rumbo);
  const ent = { x: 0, y: 0, mano: false };
  const eventos = [];
  while (t < (opciones.limite || 420)) {
    idx = T.indice(c.pos[0], c.pos[2], idx);
    const v = c.velocidad, ade = Math.min(P.n - 1, idx + Math.round(5 + 0.6 * Math.abs(v)));
    const dx = P.X[ade] - c.pos[0], dz = P.Z[ade] - c.pos[2];
    // error de rumbo: positivo = el objetivo esta a la derecha
    const f = c.adelante, e = Math.atan2(f[0] * dz - f[2] * dx, f[0] * dx + f[2] * dz);
    ent.x = Math.max(-1, Math.min(1, e * 2.4));
    // velocidad segun la curva que viene
    const a2 = Math.min(P.n - 1, idx + 14);
    let dpsi = Math.atan2(P.HX[a2], -P.HZ[a2]) - Math.atan2(P.HX[idx], -P.HZ[idx]);
    dpsi = Math.atan2(Math.sin(dpsi), Math.cos(dpsi));
    const curv = Math.abs(dpsi) / 14 + 1e-4;
    const k = typeof vObj === 'function' ? vObj(P.T[idx], idx) : vObj;
    const vt = Math.min(k, Math.sqrt((opciones.lateral || 3.2) / curv));
    ent.y = v < vt ? 1 : v > vt + 1.5 ? -1 : 0;
    c.paso(ent, DT); t += DT;
    if (!(c.pos[0] === c.pos[0])) { nan = true; eventos.push('NaN en ' + idx); break; }
    vmax = Math.max(vmax, Math.abs(v));
    if (P.T[idx] !== tramo) { tramo = P.T[idx]; log.push([tramo, t, v]); }
    if (proximo < T.controles.length && idx >= T.controles[proximo].i) { control = T.controles[proximo]; proximo++; }
    if (idx >= T.meta.i) break;
    // fallas
    const lado = Math.hypot(c.pos[0] - P.X[idx], c.pos[2] - P.Z[idx]);
    quieto = Math.abs(v) < 0.5 ? quieto + DT : 0;
    let falla = null;
    if (c.arriba[1] < 0.3) falla = 'vuelco';
    else if (c.pos[1] < P.Y[idx] - 9) falla = 'caida';
    else if (lado > P.W[idx] / 2 + 9) falla = 'afuera';
    else if (quieto > 5) falla = 'encajado';
    if (falla) {
      eventos.push(falla + ' en tramo ' + P.T[idx] + ' (' + (ETAPA.tramos[P.T[idx]].nombre || ETAPA.tramos[P.T[idx]].suelo) + ') m=' + idx + ' t=' + t.toFixed(0));
      caidas++; quieto = 0;
      if (caidas > (opciones.intentos || 6)) break;
      c.poner(control.x, control.z, control.rumbo); idx = control.i;
    }
  }
  return { t, llego: idx >= T.meta.i, idx, eventos, log, vmax, nan };
}

if (process.argv[1].endsWith('piloto.mjs')) {
  const T = crearTerreno(ETAPA);
  for (const v of [4, 6, 8, 10, 13]) {
    const r = recorrer(T, v);
    console.log('objetivo', v, 'm/s ->', r.llego ? 'LLEGO' : 'no llego (m=' + r.idx + ')', 'en', r.t.toFixed(1), 's, vmax', (r.vmax * 3.6).toFixed(0), 'km/h, fallas:', r.eventos.length ? '\n    ' + r.eventos.join('\n    ') : 'ninguna');
    if (process.argv[2] === 'log') console.log('   ', r.log.map((l) => l[0] + ':' + l[1].toFixed(0) + 's@' + (l[2] * 3.6).toFixed(0)).join('  '));
  }
}

// GUARDADO SIN USAR (ver el aviso de src/camion.js): el camion ya no esta en el juego.
// Piloto automatico del camion de La Montaña del Sufrimiento (circuito 'montana'): sigue el camino con entradas de teclado
// (volante todo o nada, pedal que se pisa y se suelta) y corre la pista entera con las reglas del juego, sin graficos.
// Sirve para ver que la pista se pueda terminar, cuanto dura y cuantos bultos llegan.
//
// uso: node tools/pilotocamion.mjs [piloto] [traza]      piloto: manso | normal | bruto (por defecto, todos)
import { crearTerreno } from '../src/terrain.js';
import { generarPista } from '../src/generador.js';
import { crearCamion, RECARGO_BULTO, BULTOS_TOTAL } from '../src/camion.js';
import { crearPartida } from '../src/reglas.js';
import { JUEGO, SUELOS } from '../src/config.js';

const DT = JUEGO.paso;
export const MONTANA = 16006;

// Los pilotos: cuanta velocidad se animan a llevar en cada cosa, cuanto cuidan la carga y cada cuanto corrigen.
//   barro: hasta que torque sostienen en el barro (el pedal sube hasta ahi y lo sueltan)   bajada: velocidad maxima en la bajada
//   piedras / cornisa / agua: velocidad en esos tramos (m/s)   reaccion: segundos entre una correccion y otra
export const PILOTOS_CAMION = {
  manso:  { barro: 0.6, piedras: 2.0, cornisa: 2.4, agua: 2.0, bajada: 4.2, llano: 7, reaccion: 0.14, frenada: 0.55 },
  normal: { barro: 0.6, piedras: 2.6, cornisa: 3.0, agua: 2.4, bajada: 5.5, llano: 9, reaccion: 0.12, frenada: 0.7 },
  bruto:  { barro: 0.85, piedras: 4.5, cornisa: 5.5, agua: 5.0, bajada: 9, llano: 12, reaccion: 0.1, frenada: 1 },
};

// Corre la pista. o: un piloto de PILOTOS_CAMION. Devuelve lo que paso.
export function correrCamion(T, o, { maximo = 1800, traza = false, alPaso = null } = {}) {
  const P = T.camino, c = crearCamion(T), p = crearPartida(T, T.sectores.map(() => 100));
  const ent = { x: 0, y: 0, mano: false }, problemas = [], tramos = T.etapa.tramos;
  let t = 0, prox = 0, m = { on: false, volver: 0 }, recargo = 0, perdidos = 0, vmax = 0, tFin = 0;
  const seg = [0, 0, 0, 0, 0];
  p.preparar(c); p.largar();
  while (t < maximo + 20 && p.estado !== 'llegada' && p.estado !== 'abandono') {
    if (p.estado === 'corriendo' && t >= prox) { prox = t + o.reaccion; decidir(m, t); }
    if (p.estado !== 'corriendo') { ent.x = 0; ent.y = 0; ent.mano = true; } else ent.mano = false;
    c.paso(ent, DT); t += DT;
    if (Math.abs(c.velocidad) > vmax) vmax = Math.abs(c.velocidad);
    if (alPaso) alPaso(c, p, t, ent);
    if (Math.round(t / DT) % 2 === 0) {
      const i = p.indice;
      p.paso(c, DT * 2);
      for (const ev of p.eventos.splice(0)) {
        if (ev.tipo === 'vuelta') { problemas.push(ev.dato + ' en el metro ' + i + ' (' + T.etapa.tramos[P.T[i]].suelo + ')'); m.atras = 0; }
        if (ev.tipo === 'sector') seg[ev.dato.numero] = ev.dato.tiempo;
      }
      // cada bulto perdido suma su recargo (como en el juego)
      const n = c.carga.nuevos();
      if (n) { perdidos += n; p.recargar(RECARGO_BULTO * n); problemas.push(n + ' bulto(s) perdido(s) en el metro ' + i + ' a ' + c.velocidad.toFixed(1) + ' m/s'); }
    }
  }
  return { estado: p.estado, motivo: p.motivo, t: p.tiempo, sinRecargo: p.tiempo - perdidos * RECARGO_BULTO, bultos: c.carga.quedan(), perdidos, vueltas: p.vueltas, roto: p.roto, sectores: p.sectores.map((s) => s.tiempo), vmax, problemas, metro: p.indice, c, p };

  function decidir(m, t) {
    const i = p.indice, v = c.velocidad, tr = tramos[P.T[i]];
    // el volante: hacia un punto del camino unos metros adelante (todo o nada, como con el teclado)
    const a = Math.min(P.n - 1, i + Math.round(4 + 1.2 * Math.abs(v))), f = c.adelante;
    // (apunta al medio de las rodadas, que serpentean: es lo que haria quien maneja viendo los surcos)
    const lado = tr.agua ? 0 : T.surcoCentro(a);
    const dx = P.X[a] - P.HZ[a] * lado - c.pos[0], dz = P.Z[a] + P.HX[a] * lado - c.pos[2];
    const e = Math.atan2(f[0] * dz - f[2] * dx, f[0] * dx + f[2] * dz);
    ent.x = Math.abs(e) < 0.05 ? 0 : Math.sign(e) * Math.min(1, Math.abs(e) * 2.2);
    // que velocidad quiere llevar: segun el suelo y lo que viene (frena antes de lo empinado y de las curvas)
    // (el suelo es el que pisan las ruedas, no el del tramo: en las rodadas hay barro aunque el camino sea de tierra o de roca)
    const suelo = c.enPiso ? SUELOS_POR_ID[c.suelo] : SUELOS_POR_ID[P.S[i]];
    let quiere = o.llano;
    const mira = (desde, hasta) => { for (let k = desde; k <= hasta; k += 4) { const j = Math.min(P.n - 1, i + k), r = tramos[P.T[j]]; if (r.agua) return 'agua'; if (r.suelo === 'barro') return 'barro'; if (r.escalones) return 'piedras'; } return ''; };
    let clase = '';
    if (tr.escalones && tr.suelo === 'roca') clase = 'piedras';   // (entre las piedras manda la piedra: el barro de las rodadas es de a ratos)
    else if (suelo === 'barro' || suelo === 'pantano' || suelo === 'charco') clase = 'barro';
    else if (tr.escalones) clase = 'piedras';
    else if (tr.agua) clase = 'agua';
    else if (tr.pendiente <= -8) clase = 'bajada';   // (antes que la cornisa: el camino entero es angosto)
    else if (tr.ancho < 5.2) clase = 'cornisa';
    else { const q = mira(1, 26); clase = q === 'agua' ? 'agua' : q === 'piedras' ? 'piedras' : q === 'barro' ? 'barro' : ''; }
    if (clase && clase !== 'barro') quiere = o[clase];
    // en las curvas, mas despacio
    const giro = Math.abs(P.K[Math.min(P.n - 1, i + 6)]) * 1000;
    if (giro > 6) quiere = Math.min(quiere, 3 + 14 / giro);
    // el pedal
    ent.y = 0;
    if (clase === 'barro') {
      // pluma: pisa hasta el torque que elige y suelta en cuanto lo pasa (el pedal baja de a poco: el torque queda cerca de ese valor)
      ent.y = c.gas < o.barro ? 1 : 0;
      if (c.hundido > 0.5) { ent.y = 0; m.on = false; }
    } else if (v < quiere - 0.3) ent.y = 1;
    else if (v > quiere + 1.0) ent.y = -(clase === 'bajada' ? Math.min(1, o.frenada) : 1) * (v > quiere + 3 ? 1 : 0.6);
    // enterrada en un pozo de barro: soltar el pedal, que se acomode
    if (clase !== "barro" && c.hundido > 0.9 && ent.y > 0) ent.y = 0;
    // en la bajada el freno se da de a poco (el pedal es todo o nada: se frena a ratos)
    if (clase === 'bajada' && ent.y < 0) { m.golpes = (m.golpes || 0) + 1; if (m.golpes % 3 !== 0 && v < quiere + 3) ent.y = 0; }
    // trabado en el piso: un rato de marcha atras, y si no sale, pide volver al camino
    if (p.trabado && !(t < m.atras)) { m.atras = t + 1.6; m.trabadas = (m.trabadas || 0) + 1; }
    if (m.trabadas >= 4) { m.trabadas = 0; p.volver(c, 'pedido'); }
    if (t < m.atras) { ent.y = -1; ent.x = -ent.x; }
    if (c.enPiso === 0) ent.x = 0;
  }
}
const SUELOS_POR_ID = Object.fromEntries(Object.entries(SUELOS).map(([k, s]) => [s.id, k]));

if (typeof process !== 'undefined' && process.argv[1].endsWith('pilotocamion.mjs')) {
  const quien = process.argv[2] && PILOTOS_CAMION[process.argv[2]] ? [process.argv[2]] : Object.keys(PILOTOS_CAMION), traza = process.argv.includes('traza');
  const T = crearTerreno(generarPista(MONTANA));
  const reloj = (s) => Math.floor(s / 60) + ':' + (s % 60).toFixed(1).padStart(4, '0');
  for (const nombre of quien) {
    const t0 = Date.now(), r = correrCamion(T, PILOTOS_CAMION[nombre]);
    console.log(`${nombre.padEnd(7)} ${r.estado === 'llegada' ? reloj(r.t) : 'ABANDONO ' + r.motivo + ' m' + r.metro}  (sin recargo ${reloj(r.sinRecargo)})  bultos ${r.bultos}/${BULTOS_TOTAL}  volver al camino ${r.vueltas}  daño ${r.roto.toFixed(0)}  sectores ${r.sectores.map((s) => s.toFixed(0)).join(' ')}  [${((Date.now() - t0) / 1000).toFixed(1)} s de cuentas]`);
    if (traza) for (const x of r.problemas) console.log('    ' + x);
  }
}

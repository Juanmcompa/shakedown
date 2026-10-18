// Pilotos de prueba: corren las pistas generadas con las reglas del juego, sin graficos.
// Sirven para ver que cada pista se pueda terminar, cuanto dura y como quedan los cuadraditos.
//
// uso: node tools/piloto.mjs [desde] [cuantas] [auto] [traza]
//   node tools/piloto.mjs 1 10            las pistas 1 a 10, con todos los pilotos
//   node tools/piloto.mjs 7 1 kacito t    la pista 7 con el Kacito, contando cada problema
import { crearTerreno } from '../src/terrain.js';
import { generarPista } from '../src/generador.js';
import { crearAuto } from '../src/vehicle.js';
import { crearPartida } from '../src/reglas.js';
import { crearReferencia } from '../src/referencia.js';
import { AUTOS, REFERENCIA, JUEGO, AYUDA } from '../src/config.js';
import { configDe } from '../src/partes.js';
// (un auto: 'vitarita', 'kacito' o el codigo de un auto armado, como '431')
const conf = (auto) => AUTOS[auto] || configDe(auto);
import { crearAyuda } from '../src/ayuda.js';
import { azar } from '../src/noise.js';

const DT = JUEGO.paso;
// para probar ajustes sin tocar config.js:  AJUSTE="vitarita.colaFirme=1.15,kacito.potencia=62000" node tools/piloto.mjs ...
const AMBIENTE = typeof process === 'undefined' ? {} : process.env;   // (en el navegador no hay)
for (const a of (AMBIENTE.AJUSTE || '').split(',').filter(Boolean)) {
  const [clave, valor] = a.split('='), [auto, dato] = clave.split('.');
  for (const id of auto === '*' ? Object.keys(AUTOS) : [auto]) AUTOS[id][dato] = JSON.parse(valor);
}
// y para probar la ayuda de manejo:  AYUDA="ritmo=0.72,volante=0" SOLO=ayudado,sinManos node tools/piloto.mjs ...
for (const a of (AMBIENTE.AYUDA || '').split(',').filter(Boolean)) { const [dato, valor] = a.split('='); AYUDA[dato] = JSON.parse(valor); }

// Un piloto: sigue la trazada mirando unos metros adelante y frena para llegar a cada curva a la velocidad que eligio.
//   ritmo: que parte de la velocidad de referencia se anima a usar.  reaccion: cada cuantos segundos corrige.
//   teclas: true = todo o nada, como con el teclado.  desvio: cuantos metros se aparta de la trazada.
// Lo que decide el piloto en un momento: llena "ent" (volante, pedales) mirando donde esta y que viene.
// m: su memoria entre una decision y la siguiente ({} al empezar).
export function decidir(T, ref, c, p, o, m, rnd, t, ent) {
  const P = T.camino, i = p.indice, v = c.velocidad;
  if (!(t < m.tDesvio)) { m.tDesvio = t + 1 + rnd() * 2; m.objetivo = (rnd() * 2 - 1) * o.desvio; }
  m.desvio = (m.desvio || 0) + (m.objetivo - (m.desvio || 0)) * 0.3;
  // a donde apunta: un punto de la trazada, mas lejos cuanto mas rapido va. Se aparta de la trazada lo que le sale...
  const a = Math.min(P.n - 1, i + Math.round(4 + o.mira * Math.abs(v))), libre = Math.max(0, P.W[a] / 2 - 1.5);
  let desde = Math.max(-libre, ref.desde[a]), hasta = Math.min(libre, ref.hasta[a]);
  // ...pero lo que esta metido en el camino (un auto estacionado, un volquete) lo ve de lejos, unos dos segundos antes:
  // elige por donde pasar y se va corriendo con tiempo. Y si por donde viene se lo lleva puesto, corrige con decision
  // (ahi no deja pasar errores chicos de volante como en el resto del camino).
  const ahora = (c.pos[2] - P.Z[i]) * P.HX[i] - (c.pos[0] - P.X[i]) * P.HZ[i];
  let atento = false;
  for (let k = 0; k <= 10 + 2 * Math.abs(v); k += 2) {
    const j = Math.min(P.n - 1, i + k);
    if (!ref.estorbo[j]) continue;
    desde = Math.max(desde, ref.desde[j]); hasta = Math.min(hasta, ref.hasta[j]);
    if (ahora > ref.hasta[j] + 0.2 || ahora < ref.desde[j] - 0.2) atento = true;
  }
  if (hasta < desde) desde = hasta = (desde + hasta) / 2;
  const lado = Math.max(desde, Math.min(hasta, ref.corre[a] + m.desvio));
  const dx = P.X[a] - P.HZ[a] * lado - c.pos[0], dz = P.Z[a] + P.HX[a] * lado - c.pos[2], f = c.adelante;
  const e = Math.atan2(f[0] * dz - f[2] * dx, f[0] * dx + f[2] * dz);
  const umbral = atento ? Math.min(o.umbral, 0.03) : o.umbral;
  // el volante: con teclas no hay "un poco": se aprieta un ratito mas largo o mas corto segun cuanto haya que corregir
  const pide = Math.max(-1, Math.min(1, e * o.mano));
  if (o.teclas) { m.tecla = Math.abs(pide) < umbral ? 0 : Math.sign(pide); m.hasta = t + Math.max(atento ? (o.esquiva || 0) * o.reaccion : 0, Math.abs(pide) * o.reaccion * 1.3); ent.x = m.tecla; }
  else ent.x = pide;
  // a que velocidad quiere ir: la de referencia de aca a unos metros, segun lo que tarda en frenar
  let quiere = 99;
  for (let k = 3; k <= 72; k += 3) {
    const j = Math.min(P.n - 1, i + k), vr = ref.velocidad[j] * o.ritmo;
    quiere = Math.min(quiere, Math.sqrt(vr * vr + 2 * o.frena * k));
  }
  // si viene cruzado o se fue del camino, afloja hasta acomodarse
  if (Math.abs(e) > o.susto || p.lejos > 0.5) quiere = Math.min(quiere, 7);
  ent.y = v < quiere - 0.5 ? 1 : v > quiere + 1.2 ? -1 : 0;
  if (!o.teclas && ent.y === 1) ent.y = Math.min(1, 0.35 + (quiere - v) * 0.4);
  if (o.pie) ent.y = 1;                                                  // pie de plomo: no suelta nunca el acelerador
  if (o.sinManos) ent.x = 0;                                             // sin manos: no toca el volante (lo lleva la ayuda de manejo)
  if (c.enPiso === 0) ent.x = 0;                                         // en el aire no dobla
  if (p.trabado && !(t < m.atras)) { m.atras = t + 1.4; m.trabadas = (m.trabadas || 0) + 1; }   // trabado: un rato de marcha atras
  if (m.trabadas >= 4) { m.trabadas = 0; m.volver = true; }             // y si no sale, pide volver al camino
  if (t < m.atras) { ent.y = -1; ent.x = -ent.x; }
  m.quiere = quiere;
}

// Un piloto corre la pista entera.
//   ritmo: que parte de la velocidad de referencia se anima a usar.  reaccion: cada cuantos segundos corrige.
//   teclas: true = todo o nada, como con el teclado.  desvio: cuantos metros se aparta de la trazada.
//   pie: true = no suelta nunca el acelerador.  ayuda: true = corre con la ayuda de manejo del juego.
// En un circuito de vuelta cerrada da "rondas" vueltas (tres si no se dice) y lo que cuenta es la mejor:
// el tiempo, los colores y los sectores son los de esa; las vueltas al camino y el daño, la suma de todas.
export function correr(T, par, auto, o) {
  // el piloto se guia por la referencia de SU auto; los colores salen de la referencia comun (par)
  const ref = crearReferencia(T, conf(auto));
  const P = T.camino, c = crearAuto(T, o.ayuda ? { ...conf(auto), ...AYUDA.auto } : conf(auto)), p = crearPartida(T, par.sectores), rnd = azar(o.semilla || 1);
  const pide = { x: 0, y: 0, mano: false }, ent = { x: 0, y: 0, mano: false }, problemas = [], m = {}, ayuda = o.ayuda ? crearAyuda(T) : null;
  if (ayuda) ayuda.preparar(conf(auto));
  let t = 0, prox = 0, vmax = 0, golpes = 0, cruzado = 0, fuera = 0;
  p.preparar(c); p.largar();
  const V = T.vuelta, rondas = o.rondas || 3;
  let vueltasAntes = 0, rotoAntes = 0;
  while (t < (V ? 400 * rondas : 700) && p.estado !== 'llegada' && p.estado !== 'abandono' && !(V && p.rondas.length >= rondas)) {
    if (p.estado === 'corriendo' && t >= prox) { prox = t + o.reaccion * (0.7 + 0.6 * rnd()); decidir(T, ref, c, p, o, m, rnd, t, pide); }
    if (o.teclas && t > m.hasta && !(t < m.atras)) pide.x = 0;   // solto la tecla
    if (m.volver) { m.volver = false; p.volver(c, 'pedido'); }
    ent.x = pide.x; ent.y = pide.y;
    if (ayuda && p.estado === 'corriendo') ayuda.aplicar(c, p.indice, p.lejos, ent);
    c.paso(p.estado === 'corriendo' ? ent : { x: 0, y: 0, mano: true }, DT); t += DT;
    if (Math.abs(c.velocidad) > vmax) vmax = Math.abs(c.velocidad);
    if (p.estado === 'corriendo') {
      const vs = c.vel[0] * c.derecha[0] + c.vel[2] * c.derecha[2];
      if (c.velocidad > 6 && Math.abs(vs) > 0.27 * c.velocidad) cruzado += DT;   // mas de 15 grados de costado
      if (p.lejos > 0) fuera += DT;
    }
    if (Math.round(t / DT) % 2 === 0) {
      const i = p.indice, v = c.velocidad;
      p.paso(c, DT * 2);
      for (const ev of p.eventos.splice(0)) {
        if (ev.tipo === 'ronda') { vueltasAntes += ev.dato.vueltas; rotoAntes += ev.dato.roto; }
        if (ev.tipo === 'vuelta') problemas.push(ev.dato + ' en el metro ' + (V ? i % V.largo : i) + ' (' + T.etapa.tramos[P.T[i]].suelo + ', a ' + (v * 3.6).toFixed(0) + ' km/h)');
        if (ev.tipo === 'golpe') { golpes++; if (ev.dato > 8) problemas.push('golpe de ' + ev.dato.toFixed(0) + ' en el metro ' + (V ? i % V.largo : i) + ' (a ' + (v * 3.6).toFixed(0) + ' km/h)'); }
      }
    }
  }
  if (V) {
    const mejor = p.rondas.slice().sort((a, b) => a.tiempo - b.tiempo)[0];
    return { estado: mejor ? 'llegada' : p.estado === 'abandono' ? 'abandono' : 'abandono', motivo: p.motivo || 'tiempo', t: mejor ? mejor.tiempo : 0, colores: mejor ? mejor.colores : 'nnnnn', sectores: mejor ? mejor.sectores : [],
      rondas: p.rondas.map((x) => x.tiempo), vueltas: vueltasAntes + p.vueltas, roto: rotoAntes + p.roto, m: p.indice % V.largo, vmax, golpes, cruzado, fuera, problemas };
  }
  return { estado: p.estado, motivo: p.motivo, t: p.tiempo, colores: p.colores(), sectores: p.sectores.map((s) => s.tiempo), vueltas: p.vueltas, roto: p.roto, m: p.indice, vmax, golpes, cruzado, fuera, problemas };
}

export const PILOTOS = {
  // mano: cuanto volante pone por cada radian que tiene que corregir.  umbral: debajo de esto no toca el volante.
  // mira: cuantos metros adelante apunta por cada m/s que lleva.  susto: con cuantos radianes de cruzado levanta el pie.
  // esquiva: con cuanta decision se corre cuando ve que se lleva puesto algo (0 = corrige como siempre).
  as:     { ritmo: 0.97, reaccion: 0.05, umbral: 0.02, desvio: 0.2, frena: 5.2, mano: 2.6, mira: 0.5, susto: 0.7, teclas: false },
  bueno:  { ritmo: 0.88, reaccion: 0.12, umbral: 0.1,  desvio: 0.5, frena: 4.6, mano: 2.6, mira: 0.5, susto: 0.65, teclas: true, esquiva: 0.5 },
  normal: { ritmo: 0.78, reaccion: 0.16, umbral: 0.12, desvio: 0.9, frena: 4.0, mano: 2.6, mira: 0.5, susto: 0.6, teclas: true, esquiva: 0.3 },
  manso:  { ritmo: 0.64, reaccion: 0.22, umbral: 0.14, desvio: 1.2, frena: 3.4, mano: 2.6, mira: 0.5, susto: 0.55, teclas: true },
  bruto:  { ritmo: 1.08, reaccion: 0.2,  umbral: 0.14, desvio: 1.3, frena: 4.6, mano: 3.4, mira: 0.5, susto: 0.6, teclas: true },
};
// Los que prueban la ayuda de manejo (no corren con los otros; se piden con SOLO=novato,ayudado,...):
//   novato: el que recien agarra el juego: reacciona tarde, se va de la trazada y no suelta nunca el acelerador.
//   ayudado: el mismo, con la ayuda de manejo.   mansoAyudado y normalAyudado: esos pilotos, con la ayuda.
//   sinManos: acelera a fondo y no toca el volante: muestra hasta donde la ayuda lleva el auto sola.
export const NOVATOS = {
  novato:        { ...PILOTOS.manso, pie: true, susto: 9 },
  ayudado:       { ...PILOTOS.manso, pie: true, susto: 9, ayuda: true },
  sinManos:      { ...PILOTOS.manso, pie: true, susto: 9, ayuda: true, sinManos: true },
  mansoAyudado:  { ...PILOTOS.manso, ayuda: true },
  normalAyudado: { ...PILOTOS.normal, ayuda: true },
};

if (typeof process !== 'undefined' && process.argv[1].endsWith('piloto.mjs')) {
  const desde = Number(process.argv[2] || 1), cuantas = Number(process.argv[3] || 6), soloAuto = process.argv[4], traza = process.argv[5] === 't', corto = process.argv[5] === 'r';
  const cuadro = { v: '🟩', a: '🟨', r: '🟥', n: '⬛' }, reloj = (s) => Math.floor(s / 60) + ':' + (s % 60).toFixed(1).padStart(4, '0');
  const suma = {};
  for (let n = desde; n < desde + cuantas; n++) {
    const etapa = generarPista(n), T = crearTerreno(etapa), ref = crearReferencia(T, AUTOS[REFERENCIA]);
    if (!corto) console.log(`\n#${n} ${T.bioma.emoji}${T.clima.emoji} ${etapa.caracter} ${etapa.largo} m | referencia ${reloj(ref.total)} (${ref.sectores.map((s) => s.toFixed(0)).join(' ')}) | media ${(etapa.largo / ref.total * 3.6).toFixed(0)} km/h`);
    const quienes = AMBIENTE.SOLO ? AMBIENTE.SOLO.split(',') : Object.keys(PILOTOS), todos = { ...PILOTOS, ...NOVATOS };
    for (const auto of soloAuto ? soloAuto.split(',') : Object.keys(AUTOS)) for (const nombre of quienes) {
      const pf = todos[nombre];
      if (!pf) continue;
      const r = correr(T, ref, auto, { ...pf, semilla: n * 7 + 1 });
      if (!corto) console.log(`  ${auto.padEnd(8)} ${nombre.padEnd(6)} ${r.estado === 'llegada' ? reloj(r.t) : ('ABANDONO ' + r.motivo + ' m' + r.m).padEnd(6)} ${[...r.colores].map((x) => cuadro[x]).join('')} x${(r.t / ref.total).toFixed(2)} | vueltas ${r.vueltas} | daño ${r.roto.toFixed(0)} (${r.golpes} golpes) | max ${(r.vmax * 3.6).toFixed(0)} km/h | cruzado ${r.cruzado.toFixed(1)} s, afuera ${r.fuera.toFixed(1)} s`);
      if (traza) for (const x of r.problemas) console.log('      ' + x);
      const k = auto + ' ' + nombre, q = suma[k] || (suma[k] = { n: 0, llegan: 0, veces: 0, t: 0, vueltas: 0, roto: 0, limpias: 0, v: 0, a: 0, r: 0, cruzado: 0, fuera: 0 });
      q.n++; q.vueltas += r.vueltas; q.roto += r.roto; q.cruzado += r.cruzado; q.fuera += r.fuera;
      if (r.estado === 'llegada') { q.llegan++; q.veces += r.t / ref.total; q.t += r.t; if (!r.vueltas) q.limpias++; for (const x of r.colores) q[x]++; }
    }
  }
  console.log('\nresumen de ' + cuantas + ' pistas:');
  for (const [k, q] of Object.entries(suma)) console.log('  ' + k.padEnd(16), 'llegan', (q.llegan + '/' + q.n).padEnd(6), '| sin volver al camino', String(q.limpias).padStart(2), '| tiempo', q.llegan ? reloj(q.t / q.llegan) + ' x' + (q.veces / q.llegan).toFixed(2) : '-', '| vueltas', (q.vueltas / q.n).toFixed(1), '| daño', (q.roto / q.n).toFixed(0).padStart(3), '| cruzado', (q.cruzado / q.n).toFixed(1).padStart(4), 's | afuera', (q.fuera / q.n).toFixed(1).padStart(4), 's | 🟩', q.v, '🟨', q.a, '🟥', q.r);
}

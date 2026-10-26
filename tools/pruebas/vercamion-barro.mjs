// GUARDADO SIN USAR (ver src/camion.js): esta prueba ya no corre, la Montaña se maneja con el auto (ver vermontana.mjs).
// El camion de La Montaña del Sufrimiento en el barro, con entradas como las de una persona (teclado y pedal tactil, que son
// todo o nada) y un volante que sigue las rodadas. Objetivo (v4): el barro es jabon, no pegamento. Acelerando nunca queda
// parado ni se clava; lo que frustra es el resbale: patina, la cola se cruza al acelerar a fondo o al doblar, y se va de costado.
//   a) teclado: flecha arriba mantenida 20 s -> nunca queda parado (velocidad minima > 0,2 m/s) y sigue andando (media > 0,9 m/s)
//   b) teclado con toques (0,5 s apretado y 0,5 s suelto) -> avanza bien (mas de 25 m en 20 s)
//   c) dosificando el pedal avanza a unos 3 m/s (en dos de tres lugares, entre 2,3 y 4,5 m/s)
//   d) pedal tactil mantenido (cada pedal vale por una tecla) y celular inclinado -> avanza y dobla
//   e) el volante responde: doblar cambia el rumbo (mas de 20 grados en 5 s)
//   f) resbala: la deriva (angulo entre el rumbo y por donde va) al acelerar a fondo y doblar pasa de 20 grados (en v3 era 8 a 12)
//   g) los pilotos "normal" y "manso" llegan a la meta, y la pista entera sigue costando
//   h) el camino es angosto: casi el ancho del camion
// Despues saca capturas en el navegador: out/camion-barro-v4.png y out/montana-angosto.png.
// uso: node tools/pruebas/vercamion-barro.mjs
import { abrir, largarDesdeHome } from './ver.mjs';
import { generarPista } from '../../src/generador.js';
import { crearTerreno } from '../../src/terrain.js';
import { crearCamion, CAMION_CARGA } from '../../src/camion.js';
import { JUEGO } from '../../src/config.js';
import { correrCamion, PILOTOS_CAMION, MONTANA } from '../pilotocamion.mjs';

let mal = 0;
const ver = (que, si, detalle) => { console.log((si ? '  ok  ' : '  MAL ') + que + (si || detalle === undefined ? '' : ' -> ' + JSON.stringify(detalle))); if (!si) mal++; };
const T = crearTerreno(generarPista(MONTANA)), P = T.camino, DT = JUEGO.paso;
const metro = (c, desde) => { let k = desde; while (k < P.n - 1 && (P.X[k + 1] - c.pos[0]) * P.HX[k] + (P.Z[k + 1] - c.pos[2]) * P.HZ[k] <= 0) k++; return k; };
const rumbo = (c) => Math.atan2(c.adelante[0], c.adelante[2]);
// el volante de quien maneja viendo las rodadas: apunta al medio de las rodadas unos metros adelante (todo o nada, como el teclado)
function volante(c, i, ent) {
  const a = Math.min(P.n - 1, i + Math.round(4 + 1.2 * Math.abs(c.velocidad))), f = c.adelante, lado = T.surcoCentro(a);
  const dx = P.X[a] - P.HZ[a] * lado - c.pos[0], dz = P.Z[a] + P.HX[a] * lado - c.pos[2];
  const e = Math.atan2(f[0] * dz - f[2] * dx, f[0] * dx + f[2] * dz);
  ent.x = Math.abs(e) < 0.05 ? 0 : Math.sign(e) * Math.min(1, Math.abs(e) * 2.2);
}
// corre "seg" segundos desde el metro i con el pedal f(t, ent, camion). guia: el volante sigue las rodadas (si no, lo maneja f).
// Devuelve metros avanzados, velocidad media de los ultimos 10 s, la minima despues de los 5 s, la deriva maxima y el camion.
function correr(i, seg, f, guia = true) {
  const c = crearCamion(T), ent = { x: 0, y: 0, mano: false };
  const lado = T.surcoCentro(i);   // (en el medio de las rodadas, que serpentean)
  c.poner(P.X[i] - P.HZ[i] * lado, P.Z[i] + P.HX[i] * lado, Math.atan2(P.HX[i], -P.HZ[i])); c.paso(ent, DT);
  let t = 0, k = i, suma = 0, n10 = 0, vmin = 99, deriva = 0;
  for (let n = 0; n < seg / DT; n++) {
    k = metro(c, k);
    if (guia && n % 7 === 0) volante(c, k, ent);
    f(t, ent, c); c.paso(ent, DT); t += DT;
    if (t > 5) vmin = Math.min(vmin, c.velocidad);
    if (t > seg - 10) { suma += c.velocidad; n10++; }
    const v = c.vel, fw = c.adelante, vf = v[0] * fw[0] + v[2] * fw[2], vl = -v[0] * fw[2] + v[2] * fw[0];
    if (Math.hypot(v[0], v[2]) > 0.8) deriva = Math.max(deriva, Math.atan2(Math.abs(vl), Math.abs(vf)) * 57.3);
  }
  return { c, m: metro(c, i) - i, vmed: suma / n10, vmin, deriva };
}
const INICIOS = [70, 180, 262];   // tres lugares del barro del tramo 1 (rectas de barro: del metro 64 al 134, 173 al 217 y 256 al 308)
const pedalFondo = (t, e) => { e.y = 1; };
const pedalToques = (t, e) => { e.y = (t % 1) < 0.5 ? 1 : 0; };
const pedalCuidado = (t, e, c) => { e.y = c.gas > 0.55 ? 0 : 1; };   // (pisa hasta cierto torque y suelta: como quien dosifica)

console.log('Camino');
{
  const anchos = T.etapa.tramos.filter((t) => t.surcos).map((t) => t.ancho);
  const maximo = Math.max(...anchos), camion = CAMION_CARGA.trocha * 2 + 0.6;
  ver('el camino de la Montaña mide ' + maximo + ' m, casi el ancho del camion (' + camion.toFixed(1) + ' m): entre 3 y 3,6 m', maximo >= 3 && maximo <= 3.6 && Math.min(...anchos) >= 3, anchos);
}

console.log('Barro');
const med = [];
for (const i of INICIOS) {
  const barro = T.etapa.tramos[P.T[i]].suelo === 'barro';
  const fondo = correr(i, 20, pedalFondo), toques = correr(i, 20, pedalToques), cuidado = correr(i, 20, pedalCuidado);
  med.push(cuidado.vmed);
  ver('[metro ' + i + '] es barro', barro);
  ver('[metro ' + i + '] a) a fondo 20 s: avanza ' + fondo.m + ' m, media ' + fondo.vmed.toFixed(1) + ' m/s y nunca queda parado (minima ' + fondo.vmin.toFixed(1) + ' m/s)', fondo.vmin > 0.2 && fondo.vmed > 0.9 && fondo.vmed < 5 && fondo.m >= 20, [fondo.m, fondo.vmed, fondo.vmin]);
  ver('[metro ' + i + '] b) con toques avanza ' + toques.m + ' m en 20 s', toques.m >= 25, toques.m);
  ver('[metro ' + i + '] c) dosificando el pedal: media ' + cuidado.vmed.toFixed(1) + ' m/s (minima ' + cuidado.vmin.toFixed(1) + ')', cuidado.vmed > 1 && cuidado.vmed < 5 && cuidado.vmin > 0.2, [cuidado.vmed, cuidado.vmin]);
}
med.sort((x, y) => x - y);
ver('c) dosificando, lo normal es andar a unos 3 m/s (mediana ' + med[1].toFixed(1) + ' m/s)', med[1] > 2.3 && med[1] < 4.5, med);

// d) pedal tactil: el pedal es una tecla (0/1) y el volante sale de inclinar el celular (analogico, de -1 a 1)
{
  const rect = correr(180, 20, pedalFondo, false);
  const giro = correr(180, 20, (t, e) => { e.y = 1; e.x = t > 6 ? 0.8 : 0; }, false);
  ver('d) pedal tactil mantenido 20 s avanza ' + rect.m + ' m', rect.m >= 20, rect.m);
  ver('d) y con el celular inclinado sigue avanzando (' + giro.m + ' m) y dobla (' + (Math.abs(rumbo(giro.c) - rumbo(rect.c)) * 57.3).toFixed(0) + ' grados de diferencia)', giro.m >= 8 && Math.abs(rumbo(giro.c) - rumbo(rect.c)) * 57.3 > 15, [giro.m]);
}

// e) doblar en el barro: el volante tiene que tener efecto. (Las rodadas atajan las ruedas, asi que segun el lugar dobla mas o
// menos: se mide en ocho lugares y se pide la mediana, y que en la mayoria cambie el rumbo de verdad)
for (const [nom, pedal, minimo] of [['dosificando', pedalCuidado, 20], ['con toques', pedalToques, 20], ['a fondo (patina)', pedalFondo, 10]]) {
  const ds = [];
  for (const i of [70, 100, 140, 180, 200, 262, 290, 330]) {
    let r0 = null;
    const r = correr(i, 8, (t, e, c) => { pedal(t, e, c); e.x = t >= 3 ? 1 : 0; if (t >= 3 && r0 === null) r0 = rumbo(c); }, false);
    let d = (rumbo(r.c) - r0) * 57.3; d = Math.abs(((d + 540) % 360) - 180); ds.push(d);
  }
  const orden = [...ds].sort((x, y) => x - y), mediana = (orden[3] + orden[4]) / 2;
  ver('e) ' + nom + ' y doblando: en 5 s el rumbo cambia ' + ds.map((x) => x.toFixed(0)).join(', ') + ' grados en ocho lugares (mediana ' + mediana.toFixed(0) + ', mas de ' + minimo + '; y mas de 10 en cinco)', mediana > minimo && ds.filter((x) => x > 10).length >= 5, ds);
}

// f) resbala: deriva al acelerar a fondo y doblar (en v3 daba 12, 10 y 8 grados; dosificando y doblando, 21, 20 y 20)
{
  const a = [], b = [];
  for (const i of [75, 180, 262]) {
    a.push(correr(i, 12, (t, e) => { e.y = 1; e.x = t > 5 && t < 8.5 ? 1 : 0; }, false).deriva);
    b.push(correr(i, 12, (t, e, c) => { pedalCuidado(t, e, c); e.x = t > 5 && t < 8.5 ? 1 : 0; }, false).deriva);
  }
  ver('f) a fondo y doblando la cola se cruza hasta ' + a.map((x) => x.toFixed(0)).join(', ') + ' grados (antes 12, 10 y 8; mas de 18 en los tres)', a.every((x) => x > 18), a);
  ver('f) dosificando y doblando hasta ' + b.map((x) => x.toFixed(0)).join(', ') + ' grados (antes 21, 20 y 20; en algun lugar mas de 25)', Math.max(...b) > 25, b);
}

// g) los pilotos automaticos
const reloj = (s) => Math.floor(s / 60) + ':' + (s % 60).toFixed(0).padStart(2, '0');
const tiempos = {};
for (const nombre of ['normal', 'manso']) {
  const R = correrCamion(T, PILOTOS_CAMION[nombre]);
  tiempos[nombre] = R;
  console.log('    piloto ' + nombre + ': ' + reloj(R.t) + ' (' + reloj(R.sinRecargo) + ' sin recargo), ' + R.bultos + '/6 bultos, ' + R.vueltas + ' vueltas al camino, sectores ' + R.sectores.map((s) => s.toFixed(0)).join(' '));
  ver('g) el piloto ' + nombre + ' llega a la meta', R.estado === 'llegada', R.estado + ' ' + R.motivo);
}
ver('g) la pista entera sigue costando: el piloto normal tarda ' + reloj(tiempos.normal.sinRecargo) + ' sin recargo (mas de 7 minutos) y pierde carga (' + tiempos.normal.bultos + '/6)', tiempos.normal.sinRecargo > 420 && tiempos.normal.bultos < 6, [tiempos.normal.sinRecargo, tiempos.normal.bultos]);

// el navegador: capturas
console.log('Capturas');
const a = await abrir({ ancho: 1280, alto: 720 });
if (!a.cargo) { console.log('NO CARGO\n' + a.errores.join('\n')); process.exit(1); }
const A = a.pag;
await A.waitForFunction(() => !document.documentElement.classList.contains('cargando'), null, { timeout: 90000 });
await A.waitForTimeout(1000);
await largarDesdeHome(A, 'montana');
await A.evaluate(() => window.shakedown.avanzar(3.3));
await A.evaluate(() => { const s = window.shakedown; s.ir(75); s.simular(4, 0, 1); s.simular(1.8, 1, 1); s.avanzar(0.05); });
await A.waitForTimeout(600);
await A.screenshot({ path: 'out/camion-barro-v4.png' });
await A.evaluate(() => { const s = window.shakedown; s.ir(205); s.simular(3, 0, 1); s.avanzar(0.01); });
await A.waitForTimeout(600);
await A.screenshot({ path: 'out/montana-angosto.png' });
ver('sin errores en la consola', a.errores.length === 0, [...new Set(a.errores)].slice(0, 3));
await a.cerrar();
console.log(mal ? '\n' + mal + ' cosas mal' : '\nTodo bien');
process.exit(mal ? 1 : 0);

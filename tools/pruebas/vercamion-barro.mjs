// El camion de La Montaña del Sufrimiento en el barro, con entradas como las de una persona (teclado y pedal tactil, que son
// todo o nada) y no con un pedal fino. Lo que se pide: dando acelerador con cuidado avanza lento pero seguro; a fondo patina,
// se entierra y avanza poco (pero algo); doblar responde; y el camino es angosto (casi el ancho del camion).
//   a) teclado: flecha arriba mantenida 20 s en el barro del tramo 1 -> avanza entre 12 y 40 m (patina mucho)
//   b) teclado con toques (0,5 s apretado y 0,5 s suelto) -> avanza mas que a fondo
//   c) pedal tactil mantenido (igual que el teclado: cada pedal vale por una tecla) con el volante inclinado -> avanza y dobla
//   d) doblar en el barro a baja velocidad cambia el rumbo de verdad (mas de 20 grados en 5 s), tambien frenando
//   e) el piloto automatico "normal" y "manso" llegan a la meta
//   f) no se hizo facil: a fondo patina (las ruedas giran mucho mas que lo que avanza) y en la pista entera cuesta
//   g) el camino es angosto: casi el ancho del camion
// Despues saca capturas en el navegador: out/camion-barro-v3.png y out/montana-angosto.png.
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
// corre "seg" segundos desde el metro i con la entrada f(t, ent, camion); devuelve metros avanzados y el camion
function correr(i, seg, f) {
  const c = crearCamion(T), ent = { x: 0, y: 0, mano: false };
  // (en el medio de las rodadas, que serpentean: ahi pone las ruedas quien maneja viendo los surcos)
  const lado = T.surcoCentro(i);
  c.poner(P.X[i] - P.HZ[i] * lado, P.Z[i] + P.HX[i] * lado, Math.atan2(P.HX[i], -P.HZ[i])); c.paso(ent, DT);
  let t = 0;
  for (let n = 0; n < seg / DT; n++) { f(t, ent, c); c.paso(ent, DT); t += DT; }
  return { c, m: metro(c, i) - i };
}
const INICIOS = [90, 100, 112];   // tres lugares del barro del tramo 1 (el tramo va del metro 64 al 134 y sigue)

console.log('Camino');
{
  const anchos = T.etapa.tramos.filter((t) => t.surcos).map((t) => t.ancho);
  const maximo = Math.max(...anchos), camion = CAMION_CARGA.trocha * 2 + 0.6;
  ver('el camino de la Montaña mide ' + maximo + ' m, casi el ancho del camion (' + camion.toFixed(1) + ' m): entre 3 y 3,6 m', maximo >= 3 && maximo <= 3.6 && Math.min(...anchos) >= 3, anchos);
}

console.log('Barro');
const suma = { fondo: 0, toques: 0 };
for (const i of INICIOS) {
  const barro = T.etapa.tramos[P.T[i]].suelo === 'barro';
  const fondo = correr(i, 20, (t, e) => { e.y = 1; });
  const toques = correr(i, 20, (t, e) => { e.y = (t % 1) < 0.5 ? 1 : 0; });
  const perif = Math.max(...fondo.c.ruedas.map((r) => Math.abs(r.w) * CAMION_CARGA.radio));
  ver('[metro ' + i + '] es barro', barro);
  ver('[metro ' + i + '] a) teclado mantenido 20 s: avanza ' + fondo.m + ' m (entre 12 y 40)', fondo.m >= 12 && fondo.m <= 40, fondo.m);
  suma.fondo += fondo.m; suma.toques += toques.m;
  ver('[metro ' + i + '] b) con toques avanza ' + toques.m + ' m (a fondo ' + fondo.m + ')', toques.m >= 12 && toques.m >= 0.8 * fondo.m, [toques.m, fondo.m]);
  ver('[metro ' + i + '] f) a fondo patina: las ruedas giran a ' + perif.toFixed(1) + ' m/s y el camion va a ' + Math.abs(fondo.c.velocidad).toFixed(1) + ' m/s, y se entierra', perif > 3 * Math.max(0.3, Math.abs(fondo.c.velocidad)) && fondo.c.hundido > 0.5, [perif, fondo.c.velocidad, fondo.c.hundido]);
}
ver('b) en los tres lugares, con toques avanza ' + suma.toques + ' m contra ' + suma.fondo + ' m a fondo (mas, y sin enterrarse)', suma.toques > 1.15 * suma.fondo, suma);

// c) pedal tactil: el pedal es una tecla (0/1) y el volante sale de inclinar el celular (analogico, de -1 a 1)
{
  const r = correr(90, 20, (t, e) => { e.y = 1; e.x = 0; });
  const giro = correr(90, 20, (t, e, c) => { e.y = 1; e.x = t > 6 ? 0.8 : 0; });
  ver('c) pedal tactil mantenido 20 s avanza ' + r.m + ' m', r.m >= 12, r.m);
  ver('c) y con el celular inclinado a medias sigue avanzando (' + giro.m + ' m) y dobla (' + (Math.abs(rumbo(giro.c) - rumbo(r.c)) * 57.3).toFixed(0) + ' grados de diferencia)', giro.m >= 8 && Math.abs(rumbo(giro.c) - rumbo(r.c)) * 57.3 > 10, [giro.m, giro.c.velocidad]);
}

// d) doblar en el barro
{
  const gira = (nom, f, minimo) => {
    for (const i of INICIOS) {
      let r0 = null;
      const r = correr(i, 8, (t, e, c) => { f(t, e, c); e.x = t >= 3 ? 1 : 0; if (t >= 3 && r0 === null) r0 = rumbo(c); });
      let d = (rumbo(r.c) - r0) * 57.3; d = ((d + 540) % 360) - 180;
      ver('d) ' + nom + ' (metro ' + i + '): en 5 s el rumbo cambia ' + Math.abs(d).toFixed(0) + ' grados (mas de ' + minimo + ')', Math.abs(d) > minimo, d);
    }
  };
  gira('dando acelerador con cuidado y doblando', (t, e, c) => { e.y = c.gas > 0.5 ? 0 : 1; }, 20);
  gira('con toques y doblando', (t, e) => { e.y = (t % 1) < 0.5 ? 1 : 0; }, 20);
  gira('a fondo y doblando (patina, pero algo dobla)', (t, e) => { e.y = 1; }, 8);
}

// d2) frenar y doblar: ya en marcha, se frena a fondo y se dobla. Frenando se recorre poco camino, asi que se mide cuanto
// dobla por metro recorrido (el volante a tope en este camion da unos 0,16 rad por metro): el volante tiene que tener efecto
for (const i of INICIOS) {
  let r0 = null, v0 = 0, p0 = null;
  const r = correr(i, 9, (t, e, c) => { if (t < 6) { e.y = c.gas > 0.7 ? 0 : 1; e.x = 0; } else { if (r0 === null) { r0 = rumbo(c); v0 = c.velocidad; p0 = [c.pos[0], c.pos[2]]; } e.y = -1; e.x = 1; } });
  let d = rumbo(r.c) - r0; d = ((d + 3 * Math.PI) % (2 * Math.PI)) - Math.PI;
  const recorrido = Math.hypot(r.c.pos[0] - p0[0], r.c.pos[2] - p0[1]), porMetro = Math.abs(d) / Math.max(recorrido, 0.5);
  ver('d) en marcha a ' + v0.toFixed(1) + ' m/s, frenando y doblando (metro ' + i + '): dobla ' + (Math.abs(d) * 57.3).toFixed(0) + ' grados en ' + recorrido.toFixed(1) + ' m (' + porMetro.toFixed(2) + ' rad por metro, mas de 0,06)', porMetro > 0.06 && v0 > 0.8, [d, recorrido, v0]);
}

// e) el piloto automatico
const reloj = (s) => Math.floor(s / 60) + ':' + (s % 60).toFixed(0).padStart(2, '0');
const tiempos = {};
for (const nombre of ['normal', 'manso']) {
  const R = correrCamion(T, PILOTOS_CAMION[nombre]);
  tiempos[nombre] = R;
  console.log('    piloto ' + nombre + ': ' + reloj(R.t) + ' (' + reloj(R.sinRecargo) + ' sin recargo), ' + R.bultos + '/6 bultos, ' + R.vueltas + ' vueltas al camino, sectores ' + R.sectores.map((s) => s.toFixed(0)).join(' '));
  ver('e) el piloto ' + nombre + ' llega a la meta', R.estado === 'llegada', R.estado + ' ' + R.motivo);
}
// f) en la pista entera sigue costando: el piloto normal no la hace en menos de 9 minutos ni sin perder carga
ver('f) la pista entera sigue costando: el piloto normal tarda ' + reloj(tiempos.normal.sinRecargo) + ' sin recargo (mas de 9 minutos) y pierde carga (' + tiempos.normal.bultos + '/6)', tiempos.normal.sinRecargo > 540 && tiempos.normal.bultos < 6, [tiempos.normal.sinRecargo, tiempos.normal.bultos]);

// el navegador: capturas
console.log('Capturas');
const a = await abrir({ ancho: 1280, alto: 720 });
if (!a.cargo) { console.log('NO CARGO\n' + a.errores.join('\n')); process.exit(1); }
const A = a.pag;
await A.waitForFunction(() => !document.documentElement.classList.contains('cargando'), null, { timeout: 90000 });
await A.waitForTimeout(1000);
await largarDesdeHome(A, 'montana');
await A.evaluate(() => window.shakedown.avanzar(3.3));
await A.evaluate(() => { const s = window.shakedown; s.ir(96); s.simular(5, 0, 1); s.simular(2.5, 0.4, 1); s.avanzar(0.01); });
await A.waitForTimeout(600);
await A.screenshot({ path: 'out/camion-barro-v3.png' });
await A.evaluate(() => { const s = window.shakedown; s.ir(205); s.simular(3, 0, 1); s.avanzar(0.01); });
await A.waitForTimeout(600);
await A.screenshot({ path: 'out/montana-angosto.png' });
ver('sin errores en la consola', a.errores.length === 0, [...new Set(a.errores)].slice(0, 3));
await a.cerrar();
console.log(mal ? '\n' + mal + ' cosas mal' : '\nTodo bien');
process.exit(mal ? 1 : 0);

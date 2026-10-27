// El motor de pistas del dia (generador + terreno + festival + noche): 20 dias seguidos.
//  1. Sin navegador, 20 dias: variedad (tipos de camino, anchos de muy angosto a muy ancho, relieve, deformaciones: rodadas,
//     pozos, ondas, badenes), huellas de autos anteriores (rodadas paralelas, salidas de pista, autos rotos), todas de noche,
//     y el piloto automatico las termina (Vitarita y buggy) en 2 a 4 minutos.
//  2. En el navegador: la pista del dia oficial es de noche, las practicas sortean la hora (no siempre noche) y en la largada
//     y la llegada hay fiesta (gente, carpas, autos estacionados).
// uso: node tools/pruebas/vermotor.mjs [desde] [cuantas]      (por defecto los dias 1 a 20)
import { abrir, largarDesdeHome } from './ver.mjs';
import { generarPista } from '../../src/generador.js';
import { crearTerreno } from '../../src/terrain.js';
import { crearReferencia } from '../../src/referencia.js';
import { AUTOS, REFERENCIA } from '../../src/config.js';
import { correr, PILOTOS } from '../piloto.mjs';

const DESDE = +process.argv[2] || 1, CUANTAS = +process.argv[3] || 20;
let mal = 0;
const ver = (que, si, detalle) => { console.log((si ? '  ok  ' : '  MAL ') + que + (si || detalle === undefined ? '' : ' -> ' + JSON.stringify(detalle))); if (!si) mal++; };
const reloj = (s) => Math.floor(s / 60) + ':' + (s % 60).toFixed(0).padStart(2, '0');

console.log('1. Veinte dias, sin navegador');
const vias = new Set(), noches = [], tiempos = { 333: [], 415: [] }, llegan = { 333: 0, 415: 0 };
let anchoMin = 99, anchoMax = 0, conSurcos = 0, conPozos = 0, conOndas = 0, conBadenes = 0, conPasaron = 0, conSalidas = 0, conRotos = 0, conRelieve = 0, conPueblo = 0, conFesta = 0;
for (let d = DESDE; d < DESDE + CUANTAS; d++) {
  const e = generarPista(d), T = crearTerreno(e);
  noches.push(e.hora === 'noche');
  const mias = new Set();
  let pmin = 0, pmax = 0, surcos = false, pozos = false, ondas = false, baden = false, salidas = 0, pasaron = 0, pueblo = false;
  for (const t of e.tramos) {
    if (t.via) { vias.add(t.via); mias.add(t.via); }
    anchoMin = Math.min(anchoMin, t.ancho); anchoMax = Math.max(anchoMax, t.ancho);
    pmin = Math.min(pmin, t.pendiente || 0); pmax = Math.max(pmax, t.pendiente || 0);
    if (t.surcos) surcos = true;
    if (t.pozos && t.pozos.length) pozos = true;
    if (t.lomos && t.lomos.some((l) => (l.alto || l[1] || 0) > 0)) ondas = true;
    if (t.lomos && t.lomos.some((l) => (l.alto || l[1] || 0) < 0)) baden = true;
    salidas += (t.salidas || []).length; if (t.pasaron) pasaron++;
    if (t.casas) pueblo = true;
  }
  if (surcos) conSurcos++; if (pozos) conPozos++; if (ondas) conOndas++; if (baden) conBadenes++;
  if (pasaron) conPasaron++; if (salidas) conSalidas++; if (T.rotos && T.rotos.length) conRotos++;
  if (pmax - pmin >= 8) conRelieve++; if (pueblo) conPueblo++;
  if (T.largada && T.meta) conFesta++;
  // el piloto: la Vitarita y el buggy, con el piloto "normal"
  const par = crearReferencia(T, AUTOS[REFERENCIA]);
  const fila = [];
  for (const auto of ['333', '415']) {
    const r = correr(T, par, auto, PILOTOS.normal);
    if (r.estado === 'llegada') { llegan[auto]++; tiempos[auto].push(r.t); }
    fila.push(auto + ' ' + (r.estado === 'llegada' ? reloj(r.t) : 'NO LLEGA (' + r.estado + ')'));
  }
  console.log('  dia ' + d + ' ' + e.bioma + ' ' + e.clima + ' ' + e.largo + ' m · caminos ' + [...mias].join('/') + ' · ancho ' + Math.min(...e.tramos.map((t) => t.ancho)) + '-' + Math.max(...e.tramos.map((t) => t.ancho)) + ' · pendiente ' + pmin + ' a ' + pmax + ' · salidas ' + salidas + ' · ' + fila.join(' · '));
}
ver('todos los dias son de noche', noches.every(Boolean), noches);
ver('hay variedad de caminos (al menos 5 tipos)', vias.size >= 5, [...vias]);
ver('los anchos van de muy angostos (hasta 5 m) a muy anchos (desde 11 m)', anchoMin <= 5 && anchoMax >= 11, [anchoMin, anchoMax]);
ver('hay relieve: lomas y bajadas en casi todos los dias', conRelieve >= CUANTAS * 0.8, conRelieve);
ver('hay deformaciones: rodadas, pozos, ondas y badenes', conSurcos >= CUANTAS * 0.6 && conPozos >= CUANTAS * 0.5 && conOndas >= CUANTAS * 0.4 && conBadenes >= 1, { conSurcos, conPozos, conOndas, conBadenes });
ver('hay huellas de autos anteriores: rodadas paralelas, salidas de pista, autos rotos', conPasaron >= CUANTAS * 0.5 && conSalidas >= CUANTAS * 0.5 && conRotos >= 1, { conPasaron, conSalidas, conRotos });
ver('hay algun pueblo con casas', conPueblo >= 1, conPueblo);
for (const auto of ['333', '415']) {
  ver('el piloto termina al menos 9 de cada 10 con el ' + auto + ' (' + llegan[auto] + ' de ' + CUANTAS + ')', llegan[auto] >= Math.ceil(CUANTAS * 0.9), llegan[auto]);
  const media = tiempos[auto].reduce((a, b) => a + b, 0) / Math.max(1, tiempos[auto].length);
  ver('el tiempo promedio con el ' + auto + ' esta entre 2 y 4 minutos (' + reloj(media) + ')', media >= 120 && media <= 240, media);
}

console.log('2. En el navegador');
const j = await abrir({ ancho: 1000, alto: 600, dia: DESDE + 2 });
if (!j.cargo) { console.log('NO CARGO:\n' + j.errores.join('\n')); await j.cerrar(); process.exit(1); }
const { pag } = j;
await largarDesdeHome(pag, 'hoy');
const oficial = await pag.evaluate(() => { const s = window.shakedown; return { modo: s.estado().modo, hora: s.T.etapa.hora, bruma: s.mundo.luzActual().bruma[0], fiesta: s.mundo.festival.contar() }; });
ver('la pasada oficial del dia es de noche (bruma oscura)', oficial.hora === 'noche' && oficial.bruma < 0x202020, oficial);
const f = oficial.fiesta || [];
ver('hay fiesta en la largada y en la llegada', f.length >= 2 && f.every((x) => x.gente > 0 && x.carpas > 0 && x.autos > 0), f);
// las practicas de la misma pista: se sortea la hora
await pag.evaluate(() => document.getElementById('salir').click());
await pag.waitForTimeout(300);
const horas = new Set();
const sirve = await pag.evaluate(() => typeof window.shakedown.ponerLaHora === 'function');
ver('se puede cambiar la hora (solo la luz)', sirve);
const luces = await pag.evaluate(() => ['manana', 'mediodia', 'tarde', 'atardecer', 'noche'].map((h) => { window.shakedown.ponerLaHora(h); return window.shakedown.mundo.luzActual().bruma[0]; }));
ver('las cinco horas tienen luces distintas, y la noche es la mas oscura', new Set(luces).size >= 4 && luces[4] === Math.min(...luces), luces);
await j.cerrar();
// una practica (pista de otro dia): cada pasada sortea la hora
const k = await abrir({ ancho: 800, alto: 500, ruta: '?p=' + (DESDE + 5) + '&futuro' });
if (!k.cargo) { console.log('NO CARGO:\n' + k.errores.join('\n')); await k.cerrar(); process.exit(1); }
const brumas = [];
for (let n = 0; n < 12; n++) {
  brumas.push(await k.pag.evaluate(() => { const s = window.shakedown; s.largar(); return [s.estado().modo, s.mundo.luzActual().bruma[0]]; }));
  await k.pag.evaluate(() => document.getElementById('salir').click());
  await k.pag.waitForTimeout(150);
}
ver('las practicas son practicas', brumas.every((b) => b[0] === 'practica'), brumas.map((b) => b[0]));
ver('en 12 pasadas de practica la hora cambia (no siempre es de noche)', new Set(brumas.map((b) => b[1])).size >= 3 && brumas.some((b) => b[1] > 0x202020), brumas.map((b) => b[1].toString(16)));
j.errores.push(...k.errores);
await k.cerrar();
console.log(j.errores.length ? 'ERRORES:\n' + j.errores.join('\n') : 'sin errores en la consola');
console.log(mal ? 'HAY ' + mal + ' QUE NO ANDAN' : 'todo bien');
process.exit(mal ? 1 : 0);

// La Montaña del Sufrimiento (circuito 'montana', 16006): se corre con el auto del garaje y la fisica de siempre, sobre un camino
// deformado (rodadas hondas, barro, badenes, eses). Dos partes:
//  1. Sin navegador: el piloto automatico llega a la meta con la Vitarita (333) y con el buggy (415), la pasada se repite igual,
//     y el fantasma de una pasada grabada pasa por donde pasó el auto.
//  2. En el navegador: se larga desde la card Reales con el auto del garaje; no hay camion, ni burbuja, ni cajas; la ayuda y el
//     rally serio andan; el auto se ladea en una rodada despareja; el piloto llega; el resultado y lo que se comparte son los de
//     los demas circuitos (con el auto al final); el link de esa pasada se abre como fantasma. Capturas en out/montana-*.png.
// uso: node tools/pruebas/vermontana.mjs
import fs from 'node:fs';
import { abrir, largarDesdeHome, irACard } from './ver.mjs';
import { generarPista } from '../../src/generador.js';
import { crearTerreno } from '../../src/terrain.js';
import { crearAuto } from '../../src/vehicle.js';
import { crearPartida } from '../../src/reglas.js';
import { crearReferencia } from '../../src/referencia.js';
import { crearGrabacion, leerCodigo, crearFantasma } from '../../src/fantasma.js';
import { AUTOS, REFERENCIA, JUEGO } from '../../src/config.js';
import { configDe } from '../../src/partes.js';
import { azar } from '../../src/noise.js';
import { decidir, PILOTOS, correr } from '../piloto.mjs';

fs.mkdirSync('out', { recursive: true });
let mal = 0;
const ver = (que, si, detalle) => { console.log((si ? '  ok  ' : '  MAL ') + que + (si || detalle === undefined ? '' : ' -> ' + JSON.stringify(detalle))); if (!si) mal++; };
const reloj = (s) => Math.floor(s / 60) + ':' + (s % 60).toFixed(0).padStart(2, '0');
const MONTANA = 16006, DT = JUEGO.paso;
const T = crearTerreno(generarPista(MONTANA)), P = T.camino, par = crearReferencia(T, AUTOS[REFERENCIA]);

// ---------- 1: sin navegador ----------
console.log('El piloto automatico');
const tiempos = {};
for (const auto of ['333', '415']) {
  const r = correr(T, par, auto, PILOTOS.normal);
  tiempos[auto] = r.t;
  console.log('    ' + auto + ': ' + reloj(r.t) + ' ' + [...r.colores].join('') + ' | ' + r.vueltas + ' vueltas al camino, daño ' + r.roto.toFixed(0));
  ver('el piloto llega a la meta con el ' + auto + ' (' + reloj(r.t) + ')', r.estado === 'llegada', [r.estado, r.motivo, r.m]);
  ver('  y tarda entre 2 y 6 minutos', r.t > 120 && r.t < 360, r.t);
}
ver('la pista mide ' + P.n + ' m y es de pura rodada: el piloto da la misma pasada dos veces', (() => { const a = correr(T, par, '333', PILOTOS.normal), b = correr(T, par, '333', PILOTOS.normal); return a.t === b.t && a.vueltas === b.vueltas; })());

// el fantasma: una pasada grabada, codificada y leida, pasa por donde paso el auto
console.log('El fantasma');
{
  const auto = '333', C = configDe(auto), ref = crearReferencia(T, C), c = crearAuto(T, C), p = crearPartida(T, par.sectores), rnd = azar(7), o = PILOTOS.normal;
  const pide = { x: 0, y: 0, mano: false }, m = {}, grab = crearGrabacion(T), huella = [];
  p.preparar(c); p.largar();
  let t = 0, prox = 0, pasos = 0;
  while (t < 700 && (p.estado === 'cuenta' || p.estado === 'corriendo')) {
    if (p.estado === 'corriendo' && t >= prox) { prox = t + o.reaccion * (0.7 + 0.6 * rnd()); decidir(T, ref, c, p, o, m, rnd, t, pide); }
    if (o.teclas && t > m.hasta && !(t < m.atras)) pide.x = 0;
    c.paso(p.estado === 'corriendo' ? pide : { x: 0, y: 0, mano: true }, DT); t += DT;
    if (++pasos % 2 === 0) { p.paso(c, DT * 2); if (p.estado === 'corriendo' && p.lanzado) { grab.muestra(p.tiempo, c); if (pasos % 120 === 0) huella.push([p.tiempo, c.pos[0], c.pos[2]]); } }
  }
  ver('la pasada de prueba llega a la meta (' + reloj(p.tiempo) + ')', p.estado === 'llegada', p.estado);
  const marca = { pista: MONTANA, nombre: 'Prueba', t: p.tiempo, c: p.colores(), s: p.sectores.map((x) => x.tiempo), auto, vueltas: p.vueltas, roto: Math.round(p.roto), ab: '' };
  const l = await leerCodigo(await grab.codigo(marca, []));
  ver('el codigo se lee: pista, tiempo y auto ' + (l && l.marca.auto), !!l && l.marca.pista === MONTANA && Math.abs(l.marca.t - p.tiempo) < 0.01 && l.marca.auto === auto && l.marca.b === undefined, l && l.marca);
  const g = crearFantasma(l.vuelta(P), T), lugar = {};
  let peor = 0;
  for (const [tt, x, z] of huella) { g.pose(tt, lugar); peor = Math.max(peor, Math.hypot(lugar.x - x, lugar.z - z)); }
  ver('el fantasma pasa por donde paso el auto (como mucho a ' + peor.toFixed(2) + ' m en ' + huella.length + ' puntos)', huella.length > 10 && peor < 2.5, peor);
  g.pose(p.tiempo + 5, lugar);
  ver('y al final termina la pasada', !!lugar.termino, lugar);
}

// ---------- 2: el juego ----------
console.log('El juego');
const permisos = { permissions: ['clipboard-read', 'clipboard-write'] };
const a = await abrir({ ancho: 1280, alto: 720, contexto: permisos });
if (!a.cargo) { console.log('NO CARGO\n' + a.errores.join('\n')); process.exit(1); }
const A = a.pag, J = (f, ...args) => A.evaluate(f, ...args);
await A.waitForFunction(() => !document.documentElement.classList.contains('cargando'), null, { timeout: 90000 });
await A.waitForTimeout(800);
await irACard(A, 'reales');
const filas = await J(() => [...document.querySelectorAll('#catReales li')].map((li) => li.innerText.replace(/\s+/g, ' ').trim()));
ver('en los reales, debajo de Giulio Cesare, esta La Montaña del Sufrimiento, sin camion', filas.length === 2 && /Giulio/.test(filas[0]) && /Sufrimiento/.test(filas[1]) && !/🚛|camión|bulto|📦/i.test(filas[1]), filas);
await A.screenshot({ path: 'out/montana-card.png' });

await largarDesdeHome(A, 'montana');
await J(() => window.shakedown.avanzar(3.3));
const e0 = await J(() => window.shakedown.estado());
ver('larga el circuito 16006 desde la card, con cuenta regresiva y corriendo', e0.pista === MONTANA && e0.pantalla === 'jugando' && e0.estado === 'corriendo', e0);
const auto0 = await J(() => { const c = window.shakedown.auto(); return { camion: !!c.camion, carga: !!c.carga, codigo: c.datos.codigo, modelo: c.datos.modelo, masa: c.datos.masa }; });
ver('es el auto del garaje (la Vitarita, 333) y no un camion', !auto0.camion && !auto0.carga && auto0.codigo === '333' && auto0.modelo !== 'camion' && auto0.modelo !== 'carguero', auto0);
const pantalla = await J(() => ({ tablero: !!document.getElementById('cargaTablero'), burbuja: !!document.getElementById('burbuja'), texto: document.body.innerText}));
ver('sin burbuja de nivel ni cajas en pantalla', !pantalla.tablero && !pantalla.burbuja && !/📦/.test(pantalla.texto) , { ...pantalla, texto: undefined });
ver('la camara es la de siempre', await J(async (c) => { const { CAMARAS } = await import('/src/config.js'); const m = window.shakedown.camara.modo(); return CAMARAS.some((x) => x.id === m.id && x.dist[0] === m.dist[0]); }));
ver('el copiloto canta notas normales de la pista (barro, piedras, cornisa, cascada y bajada)', await J(() => { const t = new Set(window.shakedown.copiloto.notas.map((n) => n.tipo)); return ['barro', 'piedras', 'cornisa', 'cascada', 'bajada', 'curva'].every((x) => t.has(x)); }));
// ayuda de manejo y rally serio, como en los demas circuitos
const ayuda = await J(() => { const s = window.shakedown; s.ajustar('ayuda', true); const c = s.auto(); return { prendida: !!s.gusto('ayuda'), datos: c.datos.codigo }; });
const serio = await J(() => { const s = window.shakedown; s.ajustar('ayuda', false); s.ajustar('serio', true); return { prendido: !!s.gusto('serio'), serio: !!s.auto().datos.serio }; });
await J(() => { const s = window.shakedown; s.ajustar('serio', false); });
ver('la ayuda de manejo y el rally serio se pueden prender en esta pista', ayuda.prendida && serio.prendido, [ayuda, serio]);

// el auto se ladea en una rodada despareja: se lo pone en el medio de las rodadas, y se compara con la playa del principio
const rolido = (desde, seg, vel) => J(([desde, seg, vel]) => {
  const s = window.shakedown, T = s.T, P = T.camino, c = s.auto();
  s.largar(); s.avanzar(3.3);
  const l = T.surcoCentro(desde);
  c.poner(P.X[desde] - P.HZ[desde] * l, P.Z[desde] + P.HX[desde] * l, Math.atan2(P.HX[desde], -P.HZ[desde]));
  let max = 0, rms = 0, n = 0, alto = [1e9, -1e9];
  for (let k = 0; k < seg / 0.1; k++) {
    s.simular(0.1, 0, c.velocidad < vel ? 0.8 : 0);
    if (k * 0.1 > 1.5) { const r = Math.asin(Math.max(-1, Math.min(1, c.derecha[1]))) * 57.3; max = Math.max(max, Math.abs(r)); rms += r * r; n++; alto = [Math.min(alto[0], c.pos[1] - P.Y[Math.min(P.n - 1, desde + Math.round(k * 0.1 * c.velocidad))]), Math.max(alto[1], c.pos[1] - P.Y[Math.min(P.n - 1, desde + Math.round(k * 0.1 * c.velocidad))])]; }
  }
  return { max, rms: Math.sqrt(rms / n), v: c.velocidad };
}, [desde, seg, vel]);
const llano = await rolido(14, 6, 8), rodada = await rolido(100, 6, 8);
ver('en la playa del principio el auto va derecho (se ladea ' + llano.max.toFixed(1) + ' grados)', llano.max < 3, llano);
ver('en las rodadas se ladea y rebota (hasta ' + rodada.max.toFixed(1) + ' grados, tipico ' + rodada.rms.toFixed(1) + ')', rodada.max > 8 && rodada.rms > 3, rodada);
// captura de las rodadas con el auto
await J(() => { const s = window.shakedown, T = s.T, P = T.camino, c = s.auto(), i = 150, l = T.surcoCentro(i); s.largar(); s.avanzar(3.3); c.poner(P.X[i] - P.HZ[i] * l, P.Z[i] + P.HX[i] * l, Math.atan2(P.HX[i], -P.HZ[i])); s.simular(0.8, 0, 0.6); s.avanzar(0.02); s.camara.cambiar('atras'); s.camara.saltar(); s.simular(0.2, 0, 0.6); });
await A.waitForTimeout(900);
await A.screenshot({ path: 'out/montana-auto-1.png' });
// captura de unas eses: la primera curva-contracurva fuerte
const ese = await J(() => { const tr = window.shakedown.T.etapa.tramos; for (let k = 1; k < tr.length - 1; k++) if (tr[k].nota && tr[k].nota.tipo === 'curva' && Math.abs(tr[k].giro) > 15 && Math.sign(tr[k].giro) === -Math.sign(tr[k + 1].giro) && Math.abs(tr[k + 1].giro) > 15 && tr[k].largo < 40) return { k, desde: tr[k].desde }; return null; });
ver('la pista tiene eses (curva y contracurva enlazadas)', !!ese, ese);
const eses = await J(() => { const tr = window.shakedown.T.etapa.tramos; let n = 0; for (let k = 1; k < tr.length; k++) if (Math.abs(tr[k].giro) > 15 && Math.sign(tr[k].giro) === -Math.sign(tr[k - 1].giro) && Math.abs(tr[k - 1].giro) > 15 && tr[k].largo < 40) n++; return n; });
ver('y son varias (' + eses + ')', eses >= 8, eses);
if (ese) {
  await J((d) => { const s = window.shakedown, P = s.T.camino, c = s.auto(), i = Math.max(0, d - 8); s.largar(); s.avanzar(3.3); c.poner(P.X[i], P.Z[i], Math.atan2(P.HX[i], -P.HZ[i])); s.simular(0.6, 0, 0.7); s.camara.cambiar('aerea'); s.camara.saltar(); s.simular(0.3, 0, 0.7); s.avanzar(0.02); }, ese.desde);
  await A.waitForTimeout(900);
  await A.screenshot({ path: 'out/montana-auto-eses.png' });
}

// el piloto, dentro del juego, con el auto del garaje
const correrPag = () => J(async () => {
  const { decidir, PILOTOS } = await import('/tools/piloto.mjs'), { crearReferencia } = await import('/src/referencia.js'), { JUEGO } = await import('/src/config.js'), { azar } = await import('/src/noise.js'), { configDe } = await import('/src/partes.js');
  const s = window.shakedown, DT = JUEGO.paso, o = PILOTOS.normal;
  s.club.ponerNombre('Juanma');
  s.largar(); s.avanzar(3.2);
  const c = s.auto(), p = s.partida, ref = crearReferencia(s.T, configDe(s.club.auto())), rnd = azar(7), ent = { x: 0, y: 0, mano: false }, m = {};
  let t = 0, prox = 0, pasos = 0;
  while (t < 900 && p.estado === 'corriendo') {
    if (t >= prox) { prox = t + o.reaccion * (0.7 + 0.6 * rnd()); decidir(s.T, ref, c, p, o, m, rnd, t, ent); }
    if (o.teclas && t > m.hasta && !(t < m.atras)) ent.x = 0;
    c.paso(ent, DT); t += DT;
    if (++pasos % 2 === 0) s.avanzar(DT * 2);
  }
  s.saltearEspera();
  return s.estado();
});
const e1 = await correrPag();
await A.waitForFunction(() => !document.getElementById('fin').hidden, null, { timeout: 60000 }).catch(() => {});
const fin = await J(() => ({ grande: document.getElementById('finGrande').textContent, detalle: document.getElementById('finDetalle').textContent, texto: document.getElementById('fin').innerText }));
ver('el piloto llega a la meta con la Vitarita (' + reloj(e1.tiempo) + ')', e1.estado === 'llegada', e1);
ver('el resultado es el de los demas circuitos: tiempo mm:ss:cc, sin cajas (' + fin.grande + ')', /^\d\d:\d\d:\d\d$/.test(fin.grande.trim()) && !/📦|bulto|carga/i.test(fin.texto), fin);
await A.click('#compartir');
await A.waitForTimeout(800);
const copiado = await J(() => navigator.clipboard.readText()).catch((e) => 'NO SE PUDO LEER: ' + e.message);
const [msj, link] = copiado.split('\n');
ver('lo que se comparte: ' + msj, /^Shakedown · Montaña del Sufrimiento 🪨 ⏱️ \d\d:\d\d:\d\d( [🟩🟨🟥⬛]){5} 🏁 \S+333$/u.test(msj) && !/📦|🚛/.test(copiado), msj);
const texto = await J(async () => { const { mensaje } = await import('/src/menu.js'); return mensaje(window.shakedown.T.etapa, { t: 213.4, c: 'vvavr', auto: '415' }); });
ver('y con otro auto termina con su codigo: ' + texto, /^Shakedown · Montaña del Sufrimiento 🪨 ⏱️ 03:33:40 🟩 🟩 🟨 🟩 🟥 🏁 \S+415$/u.test(texto), texto);

// el amigo abre el link: corre contra el fantasma
if (link && link.includes('#r=')) {
  const k = await abrir({ ancho: 1280, alto: 720, ruta: link.slice(link.indexOf('/', 8) + 1), contexto: permisos });
  if (!k.cargo) { ver('el amigo abre el link', false, k.errores); } else {
    await k.pag.waitForFunction(() => window.shakedown && !document.documentElement.classList.contains('cargando'), null, { timeout: 120000 });
    const r = await k.pag.evaluate(() => { const s = window.shakedown; s.largar(); s.avanzar(3.3); s.avanzar(40); const e = s.estado(); return { pista: e.pista, rival: e.rival, camion: !!s.auto().camion }; });
    ver('el link abre la Montaña y se corre contra el fantasma de Juanma', r.pista === MONTANA && r.rival === 'Juanma' && !r.camion, r);
    await k.cerrar();
  }
} else ver('el link de la pasada esta en lo copiado', false, copiado);
await A.click('#salir').catch(() => {});

// el buggy (415) armado en el garaje: tambien corre la Montaña
await A.waitForTimeout(600);
const flecha = (tipo, cual) => J(([tipo, cual]) => document.querySelector('.parte[data-tipo="' + tipo + '"] button:' + (cual === 'mas' ? 'last-of-type' : 'first-of-type')).click(), [tipo, cual]);
await A.click('#miAuto');
await A.waitForTimeout(1200);
await flecha('motor', 'mas'); await flecha('chasis', 'menos'); await flecha('chasis', 'menos');
for (let k = 0; k < 3; k++) await flecha('ruedas', 'menos');
await A.waitForTimeout(500);
await A.click('#listoAuto');
await A.waitForTimeout(500);
ver('el garaje deja el buggy 415', await J(() => window.shakedown.club.auto()) === '415');
await largarDesdeHome(A, 'montana');
const e2 = await correrPag();
await A.waitForFunction(() => !document.getElementById('fin').hidden, null, { timeout: 60000 }).catch(() => {});
ver('el piloto llega a la meta con el buggy 415 (' + reloj(e2.tiempo) + ')', e2.estado === 'llegada' && e2.pista === MONTANA, e2);
await A.click('#compartir');
await A.waitForTimeout(800);
const msj2 = ((await J(() => navigator.clipboard.readText()).catch(() => '')) || '').split('\n')[0];
ver('y lo compartido termina con 415: ' + msj2, /^Shakedown · Montaña del Sufrimiento 🪨 ⏱️ \d\d:\d\d:\d\d.* \S+415$/u.test(msj2), msj2);
ver('sin errores en la consola', a.errores.length === 0, [...new Set(a.errores)].slice(0, 3));
await a.cerrar();

// ---------- el celular ----------
{
  const m = await abrir({ ancho: 390, alto: 844, ruta: '?p=' + MONTANA + '&futuro', contexto: { hasTouch: true, isMobile: true, deviceScaleFactor: 2 } });
  if (!m.cargo) ver('abre en el celular', false, m.errores);
  else {
    await m.pag.waitForFunction(() => window.shakedown && !document.documentElement.classList.contains('cargando'), null, { timeout: 120000 });
    await m.pag.evaluate(() => { const s = window.shakedown, T = s.T, P = T.camino, c = s.auto(), i = 150, l = T.surcoCentro(i); s.largar(); s.avanzar(3.3); c.poner(P.X[i] - P.HZ[i] * l, P.Z[i] + P.HX[i] * l, Math.atan2(P.HX[i], -P.HZ[i])); s.simular(1.2, 0, 0.6); s.avanzar(0.02); });
    await m.pag.waitForTimeout(1000);
    await m.pag.screenshot({ path: 'out/montana-auto-celu.png' });
    ver('en el celular, sin burbuja ni cajas', await m.pag.evaluate(() => !document.getElementById('cargaTablero') && !/📦/.test(document.body.innerText)));
    ver('sin errores en la consola del celular', m.errores.length === 0, [...new Set(m.errores)].slice(0, 3));
    await m.cerrar();
  }
}
console.log('Piloto automatico: Vitarita ' + reloj(tiempos['333']) + ', buggy ' + reloj(tiempos['415']));
console.log(mal ? '\n' + mal + ' cosas mal' : '\nTodo bien');
process.exit(mal ? 1 : 0);

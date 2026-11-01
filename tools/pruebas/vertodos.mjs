// La tabla de todos: la oficial del dia de cada corredor queda en el servidor aunque no este en ningun club, y todos la ven.
// uso: node tools/pruebas/vertodos.mjs [http://127.0.0.1:8787]   (antes, un servidor limpio: node servidor/local.mjs 8787)
//   Tres jugadores sin club (A, B, C, cada uno en su propio navegador, de a uno) corren la oficial de hoy:
//   - sin nombre la oficial no larga y el cartel lo pide (con un nombre sugerido); con el sugerido (A) o escribiendo uno (B, C) larga;
//   - una practica (un circuito) sin nombre larga;
//   - los tres aparecen ordenados en la tabla de todos de cada uno (con su auto) y el resultado dice "Nº de 3";
//   - una segunda oficial del mismo corredor no entra; cambiar el nombre se refleja en la tabla de los otros;
//   - lo que se comparte: el primer renglon queda como siempre y el puesto entre todos va en otro;
//   - la tabla de un dia anterior se ve desde Pistas anteriores;
//   - con mas gente (se suman unos corredores de mentira): los primeros, el salto y tu puesto ("#9 de 12").
//   - las practicas: A (con su oficial) corre una practica mas rapida y en su fila figuran las dos; H, que solo practica una pista
//     anterior, aparece en "mejor" y al final en "oficial"; I, sin nombre, deja la practica en el aparato y la sube al ponerse nombre.
//   - el dibujo de las filas (la ultima parte, con unos corredores armados a mano en la pista de anteayer): el auto es solo su numero
//     (sin emoji), las marcas (casco, linea, ayuda), los dos tiempos cuando hay una practica mas rapida y uno solo cuando no, el DNF,
//     el que solo practico, los cuadraditos solo en tu fila, el orden Oficial / Con practicas, y que entre en 320, 360 y 390 de ancho.
// Capturas en out/: nombre-cartel, todos-inicio (celu), todos-resultado, todos-tabla, todos-inicio-compu, tabla-inicio-celu,
// tabla-panel-compu, tabla-panel-celu, tabla-orden-mejor, tabla-320.
import { abrir } from './ver.mjs';
import { crearTerreno } from '../../src/terrain.js';
import { generarPista, VERSION } from '../../src/generador.js';
import { crearGrabacion } from '../../src/fantasma.js';
import { hoy } from '../../src/dia.js';
const API = process.argv[2] || 'http://127.0.0.1:8787';
const permisos = { permissions: ['clipboard-read', 'clipboard-write'] };
const celular = { ...permisos, hasTouch: true, isMobile: true, deviceScaleFactor: 2 };
let mal = 0;
const ver = (que, si, detalle) => { console.log((si ? '  ok  ' : '  MAL ') + que + (si || detalle === undefined ? '' : ' -> ' + JSON.stringify(detalle))); if (!si) mal++; };
const N = hoy();

const cargada = (pag) => pag.waitForFunction(() => window.shakedown && !document.documentElement.classList.contains('cargando'), null, { timeout: 120000 });
const esperarFin = (pag) => pag.waitForFunction(() => !document.getElementById('fin').hidden, null, { timeout: 90000 });
const texto = (pag, id) => pag.evaluate((id) => { const el = document.getElementById(id); return !el || el.hidden ? '' : el.textContent.replace(/\s+/g, ' ').trim(); }, id);
const esperarTexto = (pag, id, re, ms = 25000) => pag.waitForFunction(([id, re]) => { const el = document.getElementById(id); return el && !el.hidden && new RegExp(re).test(el.textContent); }, [id, re.source], { timeout: ms }).then(() => true).catch(() => false);
const estado = (pag) => pag.evaluate(() => window.shakedown.estado());
// lo que vale la pena de la tabla: "nombre codigo-auto tiempo" por fila
const filas = (pag, sel) => pag.evaluate((sel) => [...document.querySelectorAll(sel)].map((li) => ({ puesto: li.dataset.puesto || (li.querySelector('i') || {}).textContent || '', nombre: (li.querySelector('.quien') || { firstChild: { textContent: '' } }).firstChild.textContent, auto: (li.querySelector('.codigo-auto') || {}).textContent || '', tiempo: (li.querySelector('.tiempoMarca') || {}).textContent || '', mio: li.classList.contains('mio'), hueco: li.classList.contains('hueco') })), sel);
// corre la pasada que ya esta largada (sin llamar a "largar") con el piloto automatico
const correrYa = (pag, piloto, auto) => pag.evaluate(async ([piloto, auto]) => {
  const { decidir, PILOTOS } = await import('/tools/piloto.mjs'), { crearReferencia } = await import('/src/referencia.js'), { AUTOS, JUEGO } = await import('/src/config.js'), { azar } = await import('/src/noise.js');
  const s = window.shakedown, DT = JUEGO.paso, o = PILOTOS[piloto];
  s.avanzar(3.2);
  const c = s.auto(), p = s.partida, ref = crearReferencia(s.T, AUTOS[auto]), rnd = azar(7), ent = { x: 0, y: 0, mano: false }, m = {};
  let t = 0, prox = 0, pasos = 0;
  while (t < 600 && p.estado === 'corriendo') {
    if (t >= prox) { prox = t + o.reaccion * (0.7 + 0.6 * rnd()); decidir(s.T, ref, c, p, o, m, rnd, t, ent); }
    if (o.teclas && t > m.hasta && !(t < m.atras)) ent.x = 0;
    c.paso(ent, DT); t += DT;
    if (++pasos % 2 === 0) s.avanzar(DT * 2);
  }
  s.saltearEspera();
  return s.estado();
}, [piloto, auto]);
const elegirAuto = (pag, auto) => pag.evaluate((auto) => document.querySelector('[data-auto="' + auto + '"]').click(), auto);
// lo guardado en el aparato (para volver a abrir como el mismo jugador)
const guardadoEnElAparato = (pag) => pag.evaluate(() => localStorage.getItem('shakedown'));
const comoElMismo = (datos) => (pag, ctx) => ctx.addInitScript((datos) => { try { if (!sessionStorage.getItem('__vuelta')) { localStorage.setItem('shakedown', datos); sessionStorage.setItem('__vuelta', '1'); } } catch (e) { /* sin memoria */ } }, datos);
const abrirYa = async (nombre, opciones) => {
  const j = await abrir({ ruta: '?servidor=' + encodeURIComponent(API), ...opciones });
  if (!j.cargo) { console.log(nombre + ' NO CARGO\n' + j.errores.join('\n')); process.exit(1); }
  await cargada(j.pag);
  return j;
};
const compartido = async (pag) => {
  await pag.evaluate(() => { window.__compartido = ''; navigator.share = (d) => { window.__compartido = d.text; return Promise.resolve(); }; document.getElementById('compartir').click(); });
  await pag.waitForFunction(() => window.__compartido, null, { timeout: 15000 }).catch(() => {});
  return pag.evaluate(() => window.__compartido);
};

// ---------- A: sin nombre, ni siquiera una practica se frena; la oficial pide el nombre ----------
let j = await abrirYa('A', { contexto: celular, ancho: 390, alto: 844 });
let A = j.pag;
ver('A: arranca sin nombre', await A.evaluate(() => window.shakedown.club.nombre() === ''));
await A.click('#largar');
await A.waitForFunction(() => !document.getElementById('cartelNombre').hidden, null, { timeout: 10000 });
const sugerido = await A.inputValue('#cartelNombreCampo');
ver('A: la oficial sin nombre no larga: sale el cartel con un nombre sugerido', (await estado(A)).pantalla === 'portada' && sugerido.length >= 3 && sugerido.length <= 14, [await estado(A), sugerido]);
await A.screenshot({ path: 'out/nombre-cartel.png' });
await A.click('#cartelNombreOtro');
ver('A: "Otro nombre" sortea otro', (await A.inputValue('#cartelNombreCampo')).length >= 3);
await A.fill('#cartelNombreCampo', '   ');
await A.click('#cartelNombreListo');
ver('A: con solo espacios no larga y se le propone uno', (await estado(A)).pantalla === 'portada' && (await A.inputValue('#cartelNombreCampo')).trim().length >= 3 && await A.evaluate(() => !document.getElementById('cartelNombre').hidden));
await A.click('#cartelNombreVolver');
ver('A: "Volver" cierra el cartel y no larga', await A.evaluate(() => document.getElementById('cartelNombre').hidden) && (await estado(A)).pantalla === 'portada');
await A.click('#largar');
await A.waitForFunction(() => !document.getElementById('cartelNombre').hidden);
const aceptado = await A.inputValue('#cartelNombreCampo');
await A.click('#cartelNombreListo');   // (acepta el sugerido con un toque)
await A.waitForFunction(() => window.shakedown.estado().pantalla === 'jugando', null, { timeout: 30000 });
ver('A: con el nombre sugerido larga la oficial', await A.evaluate(() => window.shakedown.club.nombre()) === aceptado && (await estado(A)).pantalla === 'jugando', [aceptado, await estado(A)]);
await elegirAuto(A, 'vitarita');
const finA = await correrYa(A, 'bueno', 'vitarita');
await esperarFin(A);
ver('A: llega', finA.estado === 'llegada', finA);
ver('A: el resultado dice su puesto entre todos ("1º de 1")', await esperarTexto(A, 'finTodos', /1º de 1/), await texto(A, 'finTodos'));
ver('A: y que quedo guardado en la tabla de todos', await esperarTexto(A, 'finGuardado', /Guardado en la tabla de todos/), await texto(A, 'finGuardado'));
// cambiar el nombre desde el resultado: la tabla de todos lo toma
await A.fill('#nombre', 'Ana Rally');
await A.press('#nombre', 'Tab');
await A.waitForFunction(() => window.shakedown.club.nombre() === 'Ana Rally');
const tiempoA = (await A.evaluate(() => window.shakedown.club.oficial())).t;
const datosA = await guardadoEnElAparato(A);
await j.cerrar();

// ---------- A (otra vez): una practica sin nombre larga; la segunda oficial no entra ----------
// Una practica: un circuito. Sin nombre larga igual (el aparato nuevo no tiene nombre).
j = await abrirYa('P', { ruta: '?c=subida&servidor=' + encodeURIComponent(API) });
const P = j.pag;
ver('P: un aparato sin nombre corre una practica (un circuito) sin que se lo pidan', await P.evaluate(() => window.shakedown.club.nombre() === ''));
await P.click('#largar');
await P.waitForFunction(() => window.shakedown.estado().pantalla === 'jugando', null, { timeout: 30000 }).catch(() => {});
ver('P: la practica larga sin nombre', (await estado(P)).pantalla === 'jugando' && await P.evaluate(() => document.getElementById('cartelNombre').hidden), await estado(P));
await j.cerrar();

// A vuelve con su misma llave, sin su oficial local: corre otra vez y el servidor no la acepta
j = await abrirYa('A2', { antes: comoElMismo(datosA.replace(/"oficial":\{[^}]*"id":"[^"]*"[^}]*\}/, '"oficial":null')) });
A = j.pag;
await A.evaluate(() => { const g = JSON.parse(localStorage.getItem('shakedown')); for (const n in g.dias) if (g.dias[n].oficial) g.dias[n].oficial = null; localStorage.setItem('shakedown', JSON.stringify(g)); });
await A.reload();
await cargada(A);
ver('A2: sin oficial guardada, puede volver a largar (el servidor es el que decide)', await A.evaluate(() => window.shakedown.club.sePuedeOficial()));
await A.click('#largar');
await A.waitForFunction(() => window.shakedown.estado().pantalla === 'jugando', null, { timeout: 30000 });
const finA2 = await correrYa(A, 'manso', 'vitarita');
await esperarFin(A);
const noEntro = await A.waitForFunction(() => { const o = window.shakedown.club.oficial(); return !!o && o.noSube === true; }, null, { timeout: 25000 }).then(() => true).catch(() => false);
ver('A2: la segunda oficial no entra (el servidor dice que ya tiene una y no se insiste)', noEntro && finA2.estado === 'llegada', finA2.estado);
await A.waitForTimeout(1500);
const todosA2 = await A.evaluate(async () => { const t = await window.shakedown.nube.todos(window.shakedown.T.etapa.numero, (await import('/src/generador.js')).VERSION); return { total: t.total, tiempos: t.tabla.map((x) => x.t), yo: t.yo && t.yo.t }; });
ver('A2: en la tabla de todos sigue la primera, una sola vez', todosA2.total === 1 && Math.abs(todosA2.yo - tiempoA) < 0.02, todosA2);
await j.cerrar();

// ---------- B y C: escriben su nombre; el resultado dice su puesto ("2º de 2" y "3º de 3") ----------
const correrNuevo = async (nombre, escribir, piloto, auto, esperado) => {
  const x = await abrirYa(nombre, { contexto: celular, ancho: 390, alto: 844 });
  const pag = x.pag;
  await elegirAuto(pag, auto);
  await pag.click('#largar');
  await pag.waitForFunction(() => !document.getElementById('cartelNombre').hidden);
  await pag.fill('#cartelNombreCampo', escribir);
  await pag.press('#cartelNombreCampo', 'Enter');
  await pag.waitForFunction(() => window.shakedown.estado().pantalla === 'jugando', null, { timeout: 30000 });
  const fin = await correrYa(pag, piloto, auto);
  await esperarFin(pag);
  ver(nombre + ': llega y el resultado dice "' + esperado + '"', fin.estado === 'llegada' && await esperarTexto(pag, 'finTodos', new RegExp(esperado)), [fin.estado, await texto(pag, 'finTodos')]);
  return x;
};
const b = await correrNuevo('B', 'Beto', 'normal', 'kacito', '2º de 2');
const msjB = (await compartido(b.pag)).split('\n');
ver('B: lo que comparte: el primer renglon es el de siempre', /^Shakedown #\d+ \S+ ⏱️ \d\d:\d\d:\d\d( [🟩🟨🟥⬛]){5} 🏁 \S+$/u.test(msjB[0]), msjB[0]);
ver('B: y el puesto entre todos va en otro renglon, antes del link', msjB[1] === '🏆 2º de 2' && /#r=/.test(msjB[2]), msjB);
await b.cerrar();
const c = await correrNuevo('C', 'Caro', 'manso', 'vitarita', '3º de 3');
const C = c.pag;
const resultadoC = await texto(C, 'finTodos');
console.log('     C: ' + resultadoC);
await C.screenshot({ path: 'out/todos-resultado.png' });

// ---------- la tabla de todos, desde el inicio y desde el panel ----------
await C.click('#salir');
await C.waitForTimeout(500);
await C.waitForFunction(() => document.querySelectorAll('#hoyTiempos li:not(.vacio)').length >= 3, null, { timeout: 20000 });
const inicio = await filas(C, '#hoyTiempos li:not(.vacio)');
ver('inicio: los tres, ordenados, con su auto (la pista se ve de a uno: sin cuadraditos de los demas)', inicio.length === 3 && inicio.map((x) => x.puesto).join() === '1,2,3' && inicio[0].nombre === 'Ana Rally' && inicio[1].nombre === 'Beto' && inicio[2].nombre === 'Vos' && inicio.every((x) => x.auto) && inicio[1].auto === '323' && inicio[0].auto === '333', inicio);
ver('inicio: el tiempo de cada uno, de menor a mayor', inicio.every((x) => /^\d\d:\d\d:\d\d$/.test(x.tiempo)) && inicio[0].tiempo < inicio[1].tiempo && inicio[1].tiempo < inicio[2].tiempo, inicio.map((x) => x.tiempo));
ver('inicio: tu puesto, "#3 de 3"', await texto(C, 'hoyPuestoTexto') === '#3 de 3', await texto(C, 'hoyPuestoTexto'));
ver('inicio: solo tu fila lleva cuadraditos', await C.evaluate(() => [...document.querySelectorAll('#hoyTiempos li:not(.vacio)')].map((li) => !!li.querySelector('.cuadros')).join()) === 'false,false,true');
const fichas = await C.evaluate(() => [...document.querySelectorAll('#hoyVista button')].map((b) => b.textContent + (b.classList.contains('elegido') ? '*' : '')));
ver('inicio: fichas Todos / Amigos (sin clubes)', fichas.join() === 'Todos*,Amigos', fichas);
await C.screenshot({ path: 'out/todos-inicio.png' });
await C.click('#hoyVista button:nth-child(2)');
const amigos = await filas(C, '#hoyTiempos li:not(.vacio)');
ver('inicio: en "Amigos" (nadie abrio links) solo estas vos', amigos.length === 1 && amigos[0].mio, amigos);
await C.click('#hoyVista button:nth-child(1)');
await C.click('#hoyVerTodos');
await C.waitForFunction(() => !document.getElementById('panelTabla').hidden);
await C.waitForTimeout(500);
const panel = await filas(C, '#tabla li');
ver('panel: la tabla de todos con los tres ordenados y tu fila destacada', panel.length === 3 && panel.map((x) => x.nombre).join() === 'Ana Rally,Beto,Caro' && panel.map((x) => x.puesto).join() === '1,2,3' && panel[2].mio && !panel[0].mio, panel);
ver('panel: cuantos corrieron y tu puesto', await texto(C, 'tablaTotal') === '3 corredores · vos, #3', await texto(C, 'tablaTotal'));
ver('panel: cada uno con su fantasma', await C.evaluate(() => [...document.querySelectorAll('#tabla li')].every((li) => !!li.querySelector('button'))));
// el fantasma de alguien que no esta en ningun club: se elige y es el rival
await C.click('#tabla li:nth-child(1) button');
await C.waitForFunction(() => { const r = window.shakedown.estado().rival; return r === 'Ana Rally'; }, null, { timeout: 25000 });
ver('panel: el fantasma de la tabla de todos se baja y queda de rival', (await estado(C)).rival === 'Ana Rally', await estado(C));
await C.screenshot({ path: 'out/todos-tabla.png' });
// el nombre cambiado en A se ve (Ana Rally) y el original ya no
ver('el cambio de nombre de A se ve en la tabla de los otros', !panel.some((x) => x.nombre === aceptado));
await C.click('#cerrarPanel');
const datosC = await guardadoEnElAparato(C);
await c.cerrar();

// ---------- un dia anterior, desde Pistas anteriores ----------
// D corre la oficial de ayer (con el reloj de la pagina atrasado un dia: dia casi 0, porque 0 no cuenta); despues C, hoy, abre Pistas anteriores y ve su tabla
const d = await abrirYa('D', { dia: 1e-9, contexto: celular, ancho: 390, alto: 844 });
const D = d.pag;
ver('D: (el reloj de la pagina marca ayer)', (await D.evaluate(() => window.shakedown.T.etapa.numero)) === N - 1, await D.evaluate(() => window.shakedown.T.etapa.numero));
await D.evaluate(() => window.shakedown.club.ponerNombre('Dani'));
await D.click('#largar');
await D.waitForFunction(() => window.shakedown.estado().pantalla === 'jugando', null, { timeout: 30000 });
await correrYa(D, 'normal', 'vitarita');
await esperarFin(D);
ver('D: la oficial de ayer queda guardada', await esperarTexto(D, 'finGuardado', /Guardado en la tabla de todos/), await texto(D, 'finGuardado'));
await d.cerrar();
const e = await abrirYa('E', { contexto: celular, ancho: 390, alto: 844, antes: comoElMismo(datosA.replace(/"oficial":\{[^}]*"id":"[^"]*"[^}]*\}/, '"oficial":null')) });
const E = e.pag;
await E.click('#homeModos [data-panel="pasadas"]');
await E.waitForSelector('#pasadas a[data-n="' + (N - 1) + '"]');
await E.click('#pasadas a[data-n="' + (N - 1) + '"]');
await E.waitForFunction((n) => window.shakedown && window.shakedown.T.etapa.numero === n && !document.documentElement.classList.contains('cargando'), N - 1, { timeout: 120000 });
await E.waitForFunction(() => window.shakedown.estado().pantalla === 'jugando', null, { timeout: 60000 }).catch(() => {});
await E.keyboard.press('Escape');   // (tocarla la larga directo, como practica; se vuelve al inicio)
await E.waitForFunction(() => window.shakedown.estado().pantalla === 'portada', null, { timeout: 30000 });
await E.waitForFunction(() => document.querySelectorAll('#hoyTiempos li:not(.vacio)').length >= 1, null, { timeout: 25000 }).catch(() => {});
const ayer = await filas(E, '#hoyTiempos li:not(.vacio)');
ver('pistas anteriores: la pista de ayer muestra la tabla de todos de ese dia', ayer.length >= 1 && ayer[0].nombre === 'Dani' && ayer[0].puesto === '1' && /Pista anterior/.test(await texto(E, 'hoyTipo')), ayer);
ver('pistas anteriores: dice cuantos corrieron ese dia', /^1 corredor$/.test(await texto(E, 'hoyPuestoTexto')), await texto(E, 'hoyPuestoTexto'));
await e.cerrar();

// ---------- con mas gente: los primeros, el salto y tu puesto ----------
// Se suman nueve corredores de mentira (mas rapidos que C) con sus pasadas armadas como las arma el juego.
const T = crearTerreno(generarPista(N));
const pasadaDe = async (nombre, t) => {
  const r = { pista: N, nombre, t, s: [t / 5, t / 5, t / 5, t / 5, t / 5], c: 'vvavv', auto: '333', ab: '', vueltas: 0, roto: 0, practica: false, ayuda: false };
  const g = crearGrabacion(T), P = T.camino, n = Math.floor(t / 0.5) + 1;
  for (let k = 0; k < n; k++) { const i = Math.min(P.n - 2, T.largada.i + Math.round(k * 7)); g.muestra(k * 0.5, { pos: [P.X[i], T.altura(P.X[i], P.Z[i]), P.Z[i]], adelante: [P.HX[i], 0, P.HZ[i]] }); }
  return g.codigo(r, []);
};
const tiemposC = await (async () => { const f = await fetch(API + '/todos', { method: 'POST', headers: { 'content-type': 'text/plain' }, body: JSON.stringify({ pista: N, version: VERSION }) }); const t = await f.json(); return t.tabla.map((x) => x.t); })();
const masLento = Math.max(...tiemposC);
for (let k = 0; k < 9; k++) {
  const t = Math.max(20, masLento - 3 - k * 0.7);
  const r = await fetch(API + '/pasadas', { method: 'POST', headers: { 'content-type': 'text/plain' }, body: JSON.stringify({ llave: 'relleno' + k + 'x'.repeat(16), codigo: await pasadaDe('Piloto ' + (200 + k), t) }) });
  if (r.status !== 200) { ver('relleno ' + k + ' entra', false, [r.status, await r.text()]); break; }
}
for (const [nombre, ancho, alto, ctx, archivo] of [['F', 390, 844, celular, 'out/todos-inicio.png'], ['F2', 1280, 900, permisos, 'out/todos-inicio-compu.png']]) {
  const f = await abrirYa(nombre, { ancho, alto, contexto: ctx, antes: comoElMismo(datosC) });
  const F = f.pag;
  await F.waitForFunction(() => document.querySelectorAll('#hoyTiempos li:not(.vacio)').length >= 6, null, { timeout: 25000 });
  const inicioF = await filas(F, '#hoyTiempos li');
  ver(nombre + ': con 12 corredores: los primeros 5, el salto y vos con tu puesto', inicioF.length === 7 && inicioF.slice(0, 5).map((x) => x.puesto).join() === '1,2,3,4,5' && inicioF[5].hueco && inicioF[6].mio && inicioF[6].puesto === '12', inicioF);
  ver(nombre + ': "#12 de 12"', await texto(F, 'hoyPuestoTexto') === '#12 de 12', await texto(F, 'hoyPuestoTexto'));
  await F.screenshot({ path: archivo });
  if (nombre === 'F') {
    await F.click('#hoyVerTodos');
    await F.waitForTimeout(500);
    const todas = await filas(F, '#tabla li');
    ver('F: el panel trae los 12 con tu fila destacada', todas.length === 12 && todas[11].mio && todas[11].puesto === '12', todas.length);
    await F.screenshot({ path: 'out/todos-tabla.png' });
  }
  await f.cerrar();
}

// ---------- las practicas en la tabla de todos: la oficial siempre, y al lado la mejor pasada (practicas incluidas) ----------
// A (que ya tiene su oficial de hoy) corre una practica mas rapida: figuran las dos, y en el orden "oficial" no se mueve.
const dosOrdenes = (pag, n) => pag.evaluate(async (n) => {
  const s = window.shakedown, v = (await import('/src/generador.js')).versionDe(n);
  const [o, m] = await Promise.all([s.nube.todos(n, v, 'oficial'), s.nube.todos(n, v, 'mejor')]);
  return { o, m };
}, n);
const resumen = (t) => t.tabla.map((x) => x.nombre + ':' + (x.oficial ? x.oficial.t : '-') + '/' + (x.mejor ? x.mejor.t : '-'));
j = await abrirYa('A3', { contexto: celular, ancho: 390, alto: 844, antes: comoElMismo(datosA) });
A = j.pag;
ver('A3: ya tiene su oficial de hoy (lo que corre ahora es una practica)', await A.evaluate(() => !window.shakedown.club.sePuedeOficial() && !!window.shakedown.club.oficial()));
await A.click('#largar');
await A.waitForFunction(() => window.shakedown.estado().pantalla === 'jugando', null, { timeout: 30000 });
const finPA = await correrYa(A, 'as', 'vitarita');
await esperarFin(A);
const practicaA = await A.waitForFunction(() => { const p = window.shakedown.club.practica(); return !!p && !!p.id; }, null, { timeout: 25000 }).then(() => A.evaluate(() => window.shakedown.club.practica())).catch(() => null);
ver('A3: la practica llega y mejora su oficial', finPA.estado === 'llegada' && practicaA && practicaA.t < tiempoA - 0.02, [finPA.estado, practicaA && practicaA.t, tiempoA]);
const dA = await dosOrdenes(A, N);
const yoO = dA.o.yo, yoM = dA.m.yo;
ver('A3: en su fila figuran las dos: la oficial y, aparte, la mejor (su practica)', yoO && Math.abs(yoO.oficial.t - tiempoA) < 0.02 && yoO.oficial.practica === false && Math.abs(yoO.mejor.t - practicaA.t) < 0.02 && yoO.mejor.practica === true && yoO.mejor.id === practicaA.id, yoO);
ver('A3: orden "oficial": la practica no mueve a nadie (Ana, Beto, Caro), y la fila plana es la oficial', dA.o.orden === 'oficial' && dA.o.tabla.filter((x) => /^(Ana Rally|Beto|Caro)$/.test(x.nombre)).map((x) => x.nombre).join() === 'Ana Rally,Beto,Caro' && Math.abs(yoO.t - tiempoA) < 0.02 && yoO.puesto === 1, resumen(dA.o));
ver('A3: orden "mejor": Ana primera con su practica, los demas con la oficial como mejor (hay 12 corredores: los de relleno van en medio)', dA.m.orden === 'mejor' && yoM.puesto === 1 && yoM.puestoOficial === 1 && dA.m.tabla.find((x) => x.nombre === 'Beto').mejor.id === dA.m.tabla.find((x) => x.nombre === 'Beto').oficial.id, resumen(dA.m));
ver('A3: el total es el mismo en los dos y no cuenta dos veces a Ana', dA.o.total === 12 && dA.m.total === 12 && dA.o.oficiales === 12, [dA.o.total, dA.m.total, dA.o.oficiales]);
ver('A3: el resultado de la practica no dice un puesto entre todos (no es la oficial)', (await texto(A, 'finTodos')) === '', await texto(A, 'finTodos'));
await j.cerrar();

// H: solo practica una pista anterior (con nombre): aparece en "mejor" y al final en "oficial"
const sinLlave = (datos, extra) => JSON.stringify({ ...JSON.parse(datos), llave: undefined, dias: {}, ...extra });
const corrioAyerCon = async (nombre, extra, piloto) => {
  const x = await abrirYa(nombre, { contexto: celular, ancho: 390, alto: 844, antes: comoElMismo(sinLlave(datosC, extra)) });
  const pag = x.pag;
  await pag.click('#homeModos [data-panel="pasadas"]');
  await pag.waitForSelector('#pasadas a[data-n="' + (N - 1) + '"]');
  await pag.click('#pasadas a[data-n="' + (N - 1) + '"]');
  await pag.waitForFunction((n) => window.shakedown && window.shakedown.T.etapa.numero === n && !document.documentElement.classList.contains('cargando'), N - 1, { timeout: 120000 });
  await pag.waitForFunction(() => window.shakedown.estado().pantalla === 'jugando', null, { timeout: 60000 });
  const fin = await correrYa(pag, piloto, 'vitarita');
  await esperarFin(pag);
  return { x, pag, fin };
};
const h = await corrioAyerCon('H', { nombre: 'Hugo' }, 'normal');
const practicaH = await h.pag.waitForFunction((n) => { const d = JSON.parse(localStorage.getItem('shakedown')).dias[n]; return !!d && !!d.practica && !!d.practica.id; }, N - 1, { timeout: 25000 }).then(() => true).catch(() => false);
ver('H: la practica de una pista anterior se sube sola', h.fin.estado === 'llegada' && practicaH, h.fin.estado);
const dH = await dosOrdenes(h.pag, N - 1);
ver('H: en "mejor" figura con su practica (y Dani con su oficial)', dH.m.tabla.map((x) => x.nombre).sort().join() === 'Dani,Hugo' && dH.m.yo.oficial === null && dH.m.yo.mejor.practica === true && dH.m.yo.mejor.t === dH.m.yo.t && dH.m.total === 2, resumen(dH.m));
ver('H: en "oficial" va al final, sin oficial, con el mejor de plano', dH.o.tabla.map((x) => x.nombre).join() === 'Dani,Hugo' && dH.o.yo.puesto === 2 && dH.o.yo.oficial === null && dH.o.yo.practica === true && dH.o.oficiales === 1, resumen(dH.o));
await h.x.cerrar();

// I: sin nombre, la practica de una pista anterior queda en el aparato; al ponerse nombre se sube sola
const ii = await corrioAyerCon('I', { nombre: '' }, 'manso');
await ii.pag.waitForTimeout(2500);
const antesI = await ii.pag.evaluate(async (n) => { const s = window.shakedown, d = s.club.practica(); const t = await s.nube.todos(n, (await import('/src/generador.js')).versionDe(n), 'mejor'); return { id: d && d.id, noSube: d && d.noSube, pendientes: s.club.sinSubir().length, nombres: t.tabla.map((x) => x.nombre).sort().join() }; }, N - 1);
ver('I: sin nombre la practica queda en el aparato, sin subir ni pedir nada', ii.fin.estado === 'llegada' && !antesI.id && !antesI.noSube && antesI.pendientes === 0 && antesI.nombres === 'Dani,Hugo', antesI);
await ii.pag.fill('#nombre', 'Ines');
await ii.pag.press('#nombre', 'Tab');
const subioI = await ii.pag.waitForFunction(() => { const p = window.shakedown.club.practica(); return !!p && !!p.id; }, null, { timeout: 25000 }).then(() => true).catch(() => false);
const dI = await dosOrdenes(ii.pag, N - 1);
ver('I: al ponerse nombre la practica se sube sola y figura con ese nombre', subioI && dI.m.tabla.map((x) => x.nombre).sort().join() === 'Dani,Hugo,Ines' && dI.m.yo && dI.m.yo.nombre === 'Ines' && dI.m.yo.oficial === null, resumen(dI.m));
await ii.x.cerrar();

// ---------- el dibujo de las filas: numero de auto, marcas, los dos tiempos, el DNF y el orden ----------
// Pista de anteayer, con corredores armados a mano (sus pasadas se arman como las arma el juego):
//   Mica: oficial en rally serio (95,00) y una practica con trazada y ayuda, mas rapida (88,00)  -> dos tiempos
//   Zoe:  solo la oficial (91,00), con casco, linea y ayuda                                       -> un tiempo con las tres marcas
//   Dino: la oficial abandonada (DNF)                                                             -> "DNF" donde va la oficial
//   Lalo: solo practico (85,00), con trazada                                                      -> un tiempo con el cono
const DIA2 = N - 2, T2 = crearTerreno(generarPista(DIA2));
const pasadaEn = async (nombre, t, extra) => {
  const r = { pista: DIA2, nombre, t, s: [t / 5, t / 5, t / 5, t / 5, t / 5], c: 'vvavv', auto: '333', ab: '', vueltas: 0, roto: 0, practica: false, ayuda: false, ...extra };
  const g = crearGrabacion(T2), P = T2.camino, n = Math.floor(t / 0.5) + 1;
  for (let k = 0; k < n; k++) { const i = Math.min(P.n - 2, T2.largada.i + Math.round(k * 7)); g.muestra(k * 0.5, { pos: [P.X[i], T2.altura(P.X[i], P.Z[i]), P.Z[i]], adelante: [P.HX[i], 0, P.HZ[i]] }); }
  return g.codigo(r, []);
};
const subirA = async (llave, nombre, t, extra) => {
  const f = await fetch(API + '/pasadas', { method: 'POST', headers: { 'content-type': 'text/plain' }, body: JSON.stringify({ llave: llave + 'x'.repeat(20), codigo: await pasadaEn(nombre, t, extra) }) });
  if (f.status !== 200) ver('armado de ' + nombre, false, [f.status, await f.text()]);
};
await subirA('mica', 'Mica', 95, { serio: true, auto: '323' });
await subirA('mica', 'Mica', 88, { practica: true, trazada: true, ayuda: true, auto: '323' });
await subirA('zoe', 'Zoe', 91, { serio: true, trazada: true, ayuda: true });
await subirA('dino', 'Dino Rally Lar', 70, { ab: 'roto', c: 'vvrnn' });
await subirA('lalo', 'Lalo', 85, { practica: true, trazada: true, auto: '323' });
// lo que se ve de cada fila: el auto, las marcas, el nombre y los tiempos (con su bandera o cono y sus marcas chicas)
const leerFilas = (pag, sel) => pag.evaluate((sel) => {
  const marcas = (el) => (el ? [...el.querySelectorAll('img')].map((i) => i.alt) : []);
  return [...document.querySelectorAll(sel)].filter((li) => li.classList.contains('renglon')).map((li) => ({
    nombre: li.querySelector('.quien').textContent, auto: li.querySelector('.codigo-auto').textContent, emoji: !!li.querySelector('.emoji'),
    marcas: marcas(li.querySelector(':scope > .marcas')), cuadros: !!li.querySelector('.cuadros'), mio: li.classList.contains('mio'),
    tiempos: [...li.querySelectorAll('.tl')].map((l) => ({ tiempo: l.querySelector('.tiempoMarca, .tiempoOf').textContent, tipo: (l.querySelector('.tipo') || {}).alt || '', marcas: marcas(l.querySelector('.marcas-chicas')) })) }));
}, sel);
// que ninguna fila se pase del ancho, que los tiempos se vean enteros y que el nombre conserve un lugar minimo (si no entra, se corta con "...")
const medidas = (pag, sel) => pag.evaluate((sel) => {
  const lis = [...document.querySelectorAll(sel)].filter((li) => li.classList.contains('renglon') && li.offsetParent), malas = [];   // (los que el inicio esconde por falta de alto no cuentan)
  let minNombre = 1e9;
  for (const li of lis) {
    const f = li.getBoundingClientRect(), t = li.querySelector('.tiempos').getBoundingClientRect(), q = li.querySelector('.quien').getBoundingClientRect();
    minNombre = Math.min(minNombre, q.width);
    if (li.scrollWidth > li.clientWidth + 1 || t.right > f.right + 0.5 || t.left < f.left || q.right > t.left + 0.5) malas.push(li.querySelector('.quien').textContent + ' (se sale)');
    for (const l of li.querySelectorAll('.tl')) if (l.scrollWidth > l.clientWidth + 1 || l.offsetHeight > 32) malas.push(li.querySelector('.quien').textContent + ' (el tiempo se parte o se corta)');
  }
  return { filas: lis.length, malas, minNombre: Math.round(minNombre), ancho: document.documentElement.scrollWidth <= window.innerWidth + 1 };
}, sel);
const jx = await abrirYa('J', { ruta: '?p=' + DIA2 + '&servidor=' + encodeURIComponent(API), contexto: celular, ancho: 390, alto: 844, antes: comoElMismo(sinLlave(datosC, { nombre: 'Juana' })) });
const J = jx.pag;
await J.waitForFunction(() => document.querySelectorAll('#hoyTiempos li.renglon').length >= 4, null, { timeout: 25000 });
ver('J: es la pista de anteayer', await J.evaluate(() => window.shakedown.T.etapa.numero) === DIA2);
let fj = await leerFilas(J, '#hoyTiempos li');
const por = (lista, nombre) => lista.find((x) => x.nombre === nombre) || {};
ver('J inicio: orden "oficial": Zoe, Mica, Dino (DNF), y al final Lalo, que solo practico', fj.slice(0, 4).map((x) => x.nombre).join() === 'Zoe,Mica,Dino Rally Lar,Lalo', fj.map((x) => x.nombre));
ver('J inicio: el auto es solo su numero, sin emoji', fj.every((x) => /^\d{3}$/.test(x.auto) && !x.emoji) && por(fj, 'Mica').auto === '323' && por(fj, 'Zoe').auto === '333', fj.map((x) => x.auto));
ver('J inicio: Mica, dos tiempos: arriba la practica (88) con su cono y abajo la oficial (95) con su bandera y su casco', JSON.stringify(por(fj, 'Mica').tiempos) === JSON.stringify([{ tiempo: '01:28:00', tipo: 'Práctica', marcas: [] }, { tiempo: '01:35:00', tipo: 'Pasada oficial', marcas: ['Rally serio'] }]), por(fj, 'Mica').tiempos);
ver('J inicio: Mica, las marcas de la de arriba (linea, ayuda), en ese orden', por(fj, 'Mica').marcas.join() === 'Con la trazada,Con ayuda de manejo', por(fj, 'Mica').marcas);
ver('J inicio: Zoe, un solo tiempo (oficial, con su bandera) y las tres marcas: casco, linea, ayuda', JSON.stringify(por(fj, 'Zoe').tiempos) === JSON.stringify([{ tiempo: '01:31:00', tipo: 'Pasada oficial', marcas: [] }]) && por(fj, 'Zoe').marcas.join() === 'Rally serio,Con la trazada,Con ayuda de manejo', [por(fj, 'Zoe').tiempos, por(fj, 'Zoe').marcas]);
ver('J inicio: Dino, "DNF" en lugar del tiempo, con su bandera y sin marcas', JSON.stringify(por(fj, 'Dino Rally Lar').tiempos) === JSON.stringify([{ tiempo: 'DNF', tipo: 'Pasada oficial', marcas: [] }]) && por(fj, 'Dino Rally Lar').marcas.length === 0, por(fj, 'Dino Rally Lar').tiempos);
ver('J inicio: Lalo, solo practico: un tiempo con el cono y su linea', JSON.stringify(por(fj, 'Lalo').tiempos) === JSON.stringify([{ tiempo: '01:25:00', tipo: 'Práctica', marcas: [] }]) && por(fj, 'Lalo').marcas.join() === 'Con la trazada', por(fj, 'Lalo'));
ver('J inicio: sin cuadraditos de los demas (la pista se corre sin saber como es)', fj.every((x) => !x.cuadros), fj.map((x) => x.cuadros));
ver('J inicio: el toggle "Oficial | Con practicas" con Oficial elegido', await J.evaluate(() => [...document.querySelectorAll('#hoyOrden button')].map((b) => b.textContent + (b.classList.contains('elegido') ? '*' : '')).join()) === 'Oficial*,Con prácticas');
await J.screenshot({ path: 'out/tabla-inicio-celu.png' });
// que entre en celus chicos, parados y acostados
const tamanos = [[320, 568], [360, 640], [390, 844], [844, 390]];
for (const [w, h] of tamanos) {
  await J.setViewportSize({ width: w, height: h });
  await J.waitForTimeout(400);
  const m = await medidas(J, '#hoyTiempos li');
  ver('J inicio ' + w + 'x' + h + ': las filas entran, los tiempos se ven enteros y el nombre conserva lugar (' + m.minNombre + ' px)', m.filas >= 2 && m.malas.length === 0 && m.ancho && m.minNombre >= 40, m);
  if (w === 320) await J.screenshot({ path: 'out/tabla-320.png' });
}
await J.setViewportSize({ width: 390, height: 844 });
await J.waitForTimeout(300);
// el orden "Con practicas": Lalo (85), Mica (88), Zoe (91) y al final Dino (DNF)
await J.click('#hoyOrden button:nth-child(2)');
await J.waitForFunction(() => { const q = document.querySelector('#hoyTiempos li.renglon .quien'); return q && q.textContent === 'Lalo'; }, null, { timeout: 25000 });
fj = await leerFilas(J, '#hoyTiempos li');
ver('J inicio: orden "Con practicas": Lalo, Mica, Zoe, Dino', fj.slice(0, 4).map((x) => x.nombre).join() === 'Lalo,Mica,Zoe,Dino Rally Lar', fj.map((x) => x.nombre));
ver('J inicio: en ese orden Mica sigue con sus dos tiempos y Zoe con uno', por(fj, 'Mica').tiempos.length === 2 && por(fj, 'Zoe').tiempos.length === 1);
await J.screenshot({ path: 'out/tabla-orden-mejor.png' });
await J.reload();
await cargada(J);
await J.waitForFunction(() => document.querySelectorAll('#hoyTiempos li.renglon').length >= 4, null, { timeout: 25000 });
ver('J inicio: la eleccion se recuerda mientras dure la sesion (despues de recargar sigue "Con practicas")', await J.evaluate(() => document.querySelector('#hoyOrden button.elegido').textContent) === 'Con prácticas' && (await leerFilas(J, '#hoyTiempos li'))[0].nombre === 'Lalo');
await J.click('#hoyOrden button:nth-child(1)');
await J.waitForFunction(() => document.querySelector('#hoyTiempos li.renglon .quien').textContent === 'Zoe', null, { timeout: 25000 });
// el panel de la tabla
await J.click('#hoyVerTodos');
await J.waitForFunction(() => !document.getElementById('panelTabla').hidden);
await J.waitForTimeout(900);
const pj = await leerFilas(J, '#tabla li');
ver('J panel: las mismas filas y el mismo orden que en el inicio', pj.map((x) => x.nombre).join() === 'Zoe,Mica,Dino Rally Lar,Lalo' && JSON.stringify(pj.map((x) => x.tiempos.map((t) => t.tiempo))) === JSON.stringify([['01:31:00'], ['01:28:00', '01:35:00'], ['DNF'], ['01:25:00']]), pj.map((x) => [x.nombre, x.tiempos.map((t) => t.tiempo)]));
ver('J panel: el toggle esta arriba de la tabla y el DNF no tiene boton de fantasma', await J.evaluate(() => !!document.querySelector('#ordenTabla button.elegido') && document.querySelectorAll('#tabla li')[2].querySelector('button') === null && document.querySelectorAll('#tabla li')[1].querySelector('button') !== null));
await J.screenshot({ path: 'out/tabla-panel-celu.png' });
for (const [w, h] of [[320, 568], [360, 640], [390, 844], [568, 320], [640, 360], [844, 390]]) {
  await J.setViewportSize({ width: w, height: h });
  await J.waitForTimeout(300);
  const m = await medidas(J, '#tabla li');
  if (w === 320) await J.screenshot({ path: 'out/tabla-320-panel.png' });
  ver('J panel ' + w + 'x' + h + ': las filas entran, los tiempos se ven enteros y el nombre conserva lugar (' + m.minNombre + ' px)', m.filas === 4 && m.malas.length === 0 && m.ancho && m.minNombre >= 40, m);
}
await J.setViewportSize({ width: 1280, height: 900 });
await J.waitForTimeout(400);
await J.screenshot({ path: 'out/tabla-panel-compu.png' });
await J.setViewportSize({ width: 390, height: 844 });
// el fantasma de la fila de Mica es el de su practica (la que se ve arriba)
await J.click('#tabla li:nth-child(2) button');
await J.waitForFunction(() => window.shakedown.estado().rival === 'Mica', null, { timeout: 25000 });
ver('J panel: el boton de la fila de Mica corre contra la pasada de arriba (su practica: la clave termina en "|p")', await J.evaluate(() => /\|p$/.test(window.shakedown.club.rival() || '')), await J.evaluate(() => window.shakedown.club.rival()));
await jx.cerrar();

console.log(mal ? 'FALLARON ' + mal : 'Todo bien');
process.exit(mal ? 1 : 0);

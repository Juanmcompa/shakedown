// La meta y el resultado: papelitos al llegar, el publico, la comparacion con los amigos debajo del tiempo (en una oficial,
// en una practica y quedando primero), y que los choques suenen (contra una cosa al lado del camino).
// uso: node tools/pruebas/vermeta.mjs [capturas]
import { abrir } from './ver.mjs';
const conFotos = process.argv.includes('capturas');
let mal = 0;
const ver = (que, si, detalle) => { console.log((si ? '  ok  ' : '  MAL ') + que + (si || detalle === undefined ? '' : ' -> ' + JSON.stringify(detalle))); if (!si) mal++; };
const texto = (pag, id) => pag.evaluate((id) => { const el = document.getElementById(id); return !el || el.hidden ? '' : el.innerText.replace(/\s+/g, ' ').trim(); }, id);
// los sonidos que se piden, anotados (el sonido de verdad sigue andando)
const espiar = (pag) => pag.evaluate(() => {
  const s = window.shakedown.sonido, pedidos = window.__sonidos = [];
  for (const k of ['toque', 'voltear', 'caida', 'meta']) { const f = s[k]; s[k] = (...a) => { if (k !== 'toque' || a[1] > 2) pedidos.push([k, ...a.map((x) => (Array.isArray(x) ? x.length : x))]); return f(...a); }; }
  s.iniciar();
});
// corre la pasada con el piloto automatico hasta la llegada (sin saltear la espera: los papelitos salen al cruzar la meta)
const correr = (pag, piloto = 'bueno', auto = 'vitarita') => pag.evaluate(async ([piloto, auto]) => {
  const { decidir, PILOTOS } = await import('/tools/piloto.mjs'), { crearReferencia } = await import('/src/referencia.js'), { AUTOS, JUEGO } = await import('/src/config.js'), { azar } = await import('/src/noise.js');
  const s = window.shakedown, DT = JUEGO.paso, o = PILOTOS[piloto];
  document.querySelector('[data-auto="' + auto + '"]').click();
  s.largar(); s.avanzar(3.2);
  const c = s.auto(), p = s.partida, ref = crearReferencia(s.T, AUTOS[auto]), rnd = azar(7), ent = { x: 0, y: 0, mano: false }, m = {};
  let t = 0, prox = 0, pasos = 0;
  while (t < 600 && p.estado === 'corriendo') {
    if (t >= prox) { prox = t + o.reaccion * (0.7 + 0.6 * rnd()); decidir(s.T, ref, c, p, o, m, rnd, t, ent); }
    if (o.teclas && t > m.hasta && !(t < m.atras)) ent.x = 0;
    c.paso(ent, DT); t += DT;
    if (++pasos % 2 === 0) s.avanzar(DT * 2);
  }
  return s.estado();
}, [piloto, auto]);
const amigos = (pag, lista) => pag.evaluate((lista) => { for (const [nombre, t] of lista) window.shakedown.club.anotarAmigo({ nombre, t, s: [t / 5, t / 5, t / 5, t / 5, t / 5], c: 'vvvvv', auto: 'kacito', ab: '', vueltas: 0, roto: 0, practica: false }); }, lista);
const fin = (pag) => pag.evaluate(() => window.shakedown.saltearEspera()).then(() => pag.waitForFunction(() => !document.getElementById('fin').hidden, null, { timeout: 60000 }));

// ---------- 1: la oficial, con dos amigos: uno mas rapido y uno mas lento ----------
// ("dia" corre el reloj dia-1 dias desde hoy: para que hoy sea la #3)
const { hoy } = await import('../../src/dia.js');
const A_LA_3 = 3 - hoy() + 1;
const a = await abrir({ ancho: 1280, alto: 720, dia: A_LA_3 });   // (los tiempos de los amigos estan pensados para la pista #3)
if (!a.cargo) { console.log('NO CARGO\n' + a.errores.join('\n')); process.exit(1); }
const A = a.pag;
await A.waitForFunction(() => !document.documentElement.classList.contains('cargando'), null, { timeout: 90000 });
await A.evaluate(() => window.shakedown.club.ponerNombre('Juanma'));
await amigos(A, [['Caro', 118], ['Beto', 120.5]]);   // (el piloto "bueno" en la pista de hoy hace 1:59:17)
await espiar(A);
const e1 = await correr(A);
ver('llega a la meta', e1.estado === 'llegada', e1);
await A.waitForTimeout(400);
ver('al cruzar la meta salen los papelitos', await A.evaluate(() => !document.getElementById('papelitos').hidden && window.shakedown.papelitos.andando()));
ver('y grita el publico', await A.evaluate(() => window.__sonidos.some((x) => x[0] === 'meta')), await A.evaluate(() => window.__sonidos));
if (conFotos) { await A.waitForTimeout(2500); await A.screenshot({ path: 'out/meta-1-papelitos.png' }); }
await fin(A);
await A.waitForTimeout(500);
const c1 = await texto(A, 'finAmigos');
console.log('     ' + e1.tiempo.toFixed(2) + ' s -> ' + c1);
ver('el resultado dice el puesto y a cuanto de cada uno', /^2º de 3 /.test(c1) && /A \d,\d\d s de Caro/.test(c1) && /Le sacás \d,\d\d s a Beto/.test(c1), c1);
ver('no es primero: no va en amarillo', await A.evaluate(() => !document.getElementById('finAmigos').classList.contains('primero')));
await A.screenshot({ path: 'out/meta-2-resultado.png' });

// ---------- 2: una practica despues de la oficial: donde habria quedado ----------
await A.click('#otra');
await A.waitForTimeout(300);
const e2 = await correr(A);
await fin(A);
await A.waitForTimeout(400);
const c2 = await texto(A, 'finAmigos');
console.log('     practica ' + e2.tiempo.toFixed(2) + ' s -> ' + c2);
ver('en una practica dice donde habria quedado', /^Habrías quedado \dº de 3/.test(c2), c2);

// ---------- 3: los choques suenan en el momento, cada uno con lo suyo ----------
await A.click('#otra');
await A.waitForTimeout(300);
const choque = await A.evaluate(async () => {
  const s = window.shakedown, T = s.T, P = T.camino, c = s.auto();
  s.avanzar(3.2);
  // una cosa dura al lado del camino (una piedra o un arbol)
  let cosa = null, en = 0;
  for (let i = 40; i < P.n - 40 && !cosa; i += 3) for (const lado of [-1, 1]) for (const d of [2, 4, 6]) {
    const x = P.X[i] - P.HZ[i] * lado * (P.W[i] / 2 + d), z = P.Z[i] + P.HX[i] * lado * (P.W[i] / 2 + d);
    for (const o of T.cosasCerca(x, z) || []) if (!cosa && (o.clase === 'piedra' || (o.clase === 'arbol' && o.tipo !== 'arbusto'))) { cosa = o; en = i; }
  }
  if (!cosa) return { cosa: null };
  const dx = cosa.x - P.X[en], dz = cosa.z - P.Z[en], l = Math.hypot(dx, dz);
  s.ir(en);
  // (cerca: con graficos por software el juego dibuja un cuadro por segundo y cada cuadro avanza a lo sumo 0,05 s)
  c.poner(cosa.x - dx / l * 3.4, cosa.z - dz / l * 3.4, Math.atan2(dx / l, -dz / l));
  c.vel[0] = dx / l * 16; c.vel[2] = dz / l * 16;
  window.__sonidos.length = 0;
  const t0 = performance.now();
  while (performance.now() - t0 < 20000 && !window.__sonidos.some((x) => x[0] === 'toque')) await new Promise((r) => setTimeout(r, 500));
  return { cosa: cosa.clase, sonidos: window.__sonidos.filter((x) => x[0] === 'toque'), roto: s.partida.roto };
});
console.log('     ' + JSON.stringify(choque));
ver('chocar contra ' + choque.cosa + ' suena a eso, con la fuerza del golpe', choque.cosa && choque.sonidos.some((x) => x[1] === choque.cosa && x[2] > 5), choque);
ver('sin errores en la consola', a.errores.length === 0, [...new Set(a.errores)].slice(0, 4));
await a.cerrar();

// ---------- 4: primero entre los amigos (en el celular) ----------
const b = await abrir({ ancho: 390, alto: 844, dia: A_LA_3, contexto: { hasTouch: true, isMobile: true, deviceScaleFactor: 2 } });
const B = b.pag;
await B.waitForFunction(() => !document.documentElement.classList.contains('cargando'), null, { timeout: 90000 });
await B.evaluate(() => window.shakedown.club.ponerNombre('Juanma'));
await amigos(B, [['Caro', 124.3], ['Beto', 131.9]]);
await espiar(B);
const e4 = await correr(B);
await fin(B);
await B.waitForTimeout(500);
const c4 = await texto(B, 'finAmigos');
console.log('     ' + e4.tiempo.toFixed(2) + ' s -> ' + c4);
ver('primero: lo dice en amarillo', /^¡1º de 3! Le sacás \d,\d\d s a Caro$/.test(c4) && await B.evaluate(() => document.getElementById('finAmigos').classList.contains('primero')), c4);
await B.waitForTimeout(600);
ver('y salen mas papelitos', await B.evaluate(() => window.shakedown.papelitos.andando()));
await B.screenshot({ path: 'out/meta-3-primero-celular.png' });
// sin amigos: no hay comparacion
await B.evaluate(() => { localStorage.clear(); });
ver('sin errores en la consola (celular)', b.errores.length === 0, [...new Set(b.errores)].slice(0, 4));
await b.cerrar();

// ---------- 5: sin amigos no se compara ----------
const c = await abrir({ ancho: 1280, alto: 720 });
const C = c.pag;
await C.waitForFunction(() => !document.documentElement.classList.contains('cargando'), null, { timeout: 90000 });
await correr(C);
await fin(C);
await C.waitForTimeout(300);
ver('sin amigos en la tabla, no hay comparacion', (await texto(C, 'finAmigos')) === '');
await c.cerrar();
console.log(mal ? 'FALLARON ' + mal : 'todo bien');
process.exit(mal ? 1 : 0);

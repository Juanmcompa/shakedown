// El juego TAL COMO QUEDA PUBLICADO: abierto desde una direccion que no es "la misma compu" (asi no tiene los ganchos de
// prueba y usa el servidor que dice config.js). Los pedidos al servidor publicado se desvian a uno de prueba: el de
// verdad no se toca. Dos jugadores: A arma un club e invita; B entra, pone su nombre; A lo ve; los dos salen.
// uso: node tools/pruebas/verpublicado.mjs      (levanta solo el servidor de prueba, en el 8789)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
const { chromium } = traer('playwright');
const RAIZ = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..'), TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.webmanifest': 'application/manifest+json' };
const PUBLICADO = (await import(RAIZ + '/src/config.js')).SERVIDOR, PUERTO = 8790, SITIO = 'http://juego.test:' + PUERTO, API = 'http://127.0.0.1:8789';
let mal = 0;
const ver = (que, si, detalle) => { console.log((si ? '  ok  ' : '  MAL ') + que + (si || detalle === undefined ? '' : ' -> ' + JSON.stringify(detalle))); if (!si) mal++; };
if (!PUBLICADO) { console.log('config.js no tiene SERVIDOR: no hay nada que probar'); process.exit(1); }

const srv = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(RAIZ, p);
  if (!f.startsWith(RAIZ) || !fs.existsSync(f)) { res.writeHead(404); res.end('no'); return; }
  res.writeHead(200, { 'content-type': TIPOS[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' }); res.end(fs.readFileSync(f));
});
await new Promise((r) => srv.listen(PUERTO, r));
const api = spawn('node', [RAIZ + '/servidor/local.mjs', '8789'], { env: { ...process.env, ORIGENES: SITIO }, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1500));

const nav = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--host-resolver-rules=MAP juego.test 127.0.0.1', '--unsafely-treat-insecure-origin-as-secure=' + SITIO] });
const pedidos = [], respuestas = [];
async function jugador(ruta, movil) {
  const ctx = await nav.newContext({ viewport: movil ? { width: 390, height: 844 } : { width: 1280, height: 720 }, permissions: ['clipboard-read', 'clipboard-write'], ...(movil ? { hasTouch: true, isMobile: true, deviceScaleFactor: 2 } : {}) });
  const pag = await ctx.newPage(), errores = [];
  pag.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
  pag.on('pageerror', (e) => errores.push('pageerror: ' + e.message));
  // el servidor publicado, desviado al de prueba (con el "origin" que mando el navegador, tal cual)
  await pag.route(PUBLICADO + '/**', async (route) => {
    const req = route.request(), u = new URL(req.url()), cabeza = req.headers();
    pedidos.push(req.method() + ' ' + u.pathname + ' desde ' + (cabeza.origin || '(sin origen)'));
    const r = await fetch(API + u.pathname + u.search, { method: req.method(), headers: { ...(cabeza.origin ? { origin: cabeza.origin } : {}), ...(cabeza['content-type'] ? { 'content-type': cabeza['content-type'] } : {}) }, body: req.postData() || undefined });
    const cuerpo = await r.text();
    respuestas.push(req.method() + ' ' + u.pathname + ' -> ' + r.status + ' ' + cuerpo.slice(0, 90));
    await route.fulfill({ status: r.status, headers: { 'content-type': r.headers.get('content-type') || 'application/json', 'access-control-allow-origin': r.headers.get('access-control-allow-origin') || '', vary: 'origin' }, body: cuerpo });
  });
  await pag.goto(SITIO + '/' + ruta, { waitUntil: 'commit' });
  const cargo = await pag.waitForFunction(() => !document.documentElement.classList.contains('cargando') && !document.getElementById('largar').disabled, null, { timeout: 180000 }).then(() => true).catch(() => false);
  return { pag, errores, cargo, ctx };
}
const texto = (pag, id) => pag.evaluate((id) => { const el = document.getElementById(id); return el.hidden ? '' : el.textContent; }, id);
const fichas = (pag) => pag.evaluate(() => [...document.querySelectorAll('#clubes button')].map((b) => b.textContent.trim() + (b.classList.contains('elegido') ? '*' : '')));

const a = await jugador('', false), A = a.pag;
ver('A: el juego carga desde una direccion "de afuera"', a.cargo, a.errores.slice(0, 3));
ver('A: sin ganchos de prueba (window.shakedown no existe)', await A.evaluate(() => typeof window.shakedown === 'undefined'));
ver('A: la direccion no acepta ?servidor= (usa el de config.js)', pedidos.every((p) => !p.includes('8787')), pedidos);
await A.click('[data-panel="tabla"]');
await A.waitForTimeout(400);
ver('A: hay clubes (el juego tiene servidor)', (await fichas(A)).join('|') === 'Armar un club', await fichas(A));
await A.click('#clubes button.mas');
await A.fill('#clubNombre', 'Publicado');
await A.click('#clubNuevo button');
await A.waitForFunction(() => document.querySelectorAll('#clubes button').length === 3, null, { timeout: 15000 }).catch(() => {});
ver('A: crea un club', (await fichas(A)).join('|') === 'Todos|Publicado*|', [await fichas(A), await texto(A, 'clubAviso')]);
ver('A: como no tiene nombre, se lo pide', await A.evaluate(() => !document.getElementById('clubApodo').hidden));
await A.fill('#clubMiNombre', 'Juanma');
await A.click('#clubApodo button');
await A.waitForTimeout(500);
await A.click('#clubInvitar');
await A.waitForTimeout(500);
// (en esta prueba la pagina no es "segura" para el navegador, asi que no hay portapapeles: el juego muestra el texto para copiar a mano)
const invitacion = (await A.evaluate(() => (navigator.clipboard ? navigator.clipboard.readText() : '')).catch(() => '')) || await texto(A, 'clubAviso');
const codigo = (/#club=([0-9A-Za-z]{8})/.exec(invitacion) || [])[1];
ver('A: la invitacion lleva la direccion publicada del juego', !!codigo && invitacion.includes(SITIO + '/#club='), invitacion);

// (Mientras uno juega, el otro se va a una pagina en blanco y despues vuelve: con graficos por software, los dos dibujando
// a la vez no dan abasto y el que carga puede tardar minutos. En un aparato de verdad cada uno tiene su placa de video.
// Lo de cada uno queda guardado en su navegador: al volver sigue en el club.)
const dormir = (P) => P.goto('about:blank');
const despertar = async (P) => { await P.goto(SITIO + '/', { waitUntil: 'commit' }); await P.waitForFunction(() => !document.documentElement.classList.contains('cargando') && !document.getElementById('largar').disabled, null, { timeout: 180000 }); };
await dormir(A);
const b = await jugador('#club=' + codigo, true), B = b.pag;
await B.waitForFunction(() => !document.getElementById('panelTabla').hidden && document.querySelectorAll('#clubes button').length === 3, null, { timeout: 60000 }).catch(() => {});
ver('B: la invitacion lo deja en el club', (await fichas(B)).join('|') === 'Todos|Publicado*|' && /Ya estás en/.test(await texto(B, 'clubAviso')), [await fichas(B), await texto(B, 'clubAviso'), await texto(B, 'queEs'), await B.evaluate(() => location.href), b.cargo, b.errores.slice(0, 3), respuestas.slice(-6)]);
await B.fill('#clubMiNombre', 'Fede <b>‮');
await B.evaluate(() => document.querySelector('#clubApodo button').click());
await B.waitForTimeout(800);
ver('B: el nombre queda limpio', (await B.evaluate(() => document.getElementById('nombre').value)) === 'Fede b', await B.evaluate(() => document.getElementById('nombre').value));
// A vuelve (al cargar pide las tablas de sus clubes) y mira la tabla de su club
await dormir(B);
await despertar(A);
await A.click('[data-panel="tabla"]');
await A.waitForTimeout(400);
await A.click('#clubes button:nth-child(2)');
await A.waitForFunction(() => /Fede/.test(document.getElementById('clubFaltan').textContent), null, { timeout: 15000 }).catch(() => {});
ver('A: ve que B esta y todavia no corrio', /Todavía no corrió Fede b\./.test(await texto(A, 'clubFaltan')) && /2 corredores/.test(await texto(A, 'clubDatos')), [await texto(A, 'clubFaltan'), await texto(A, 'clubDatos')]);
await A.screenshot({ path: 'out/publicado-a.png' });
// cada uno sale del club (de a uno: el otro espera en una pagina en blanco)
for (const [n, P, Otro] of [['B', B, A], ['A', A, B]]) {
  await dormir(Otro);
  await despertar(P);
  await P.click('[data-panel="tabla"]');
  await P.waitForTimeout(400);
  await P.click('#clubes button:nth-child(2)');
  await P.waitForTimeout(300);
  await P.evaluate(() => document.getElementById('clubSalir').click());
  await P.evaluate(() => document.getElementById('clubSalir').click());
  await P.waitForFunction(() => document.querySelectorAll('#clubes button').length === 1, null, { timeout: 15000 }).catch(() => {});
  ver(n + ': sale del club', (await fichas(P)).join('|') === 'Armar un club', await fichas(P));
}
const quedo = await fetch(API + '/clubes/' + codigo).then((r) => r.status);
ver('el club vacio se borro del servidor', quedo === 404, quedo);
ver('todos los pedidos de escritura dijeron de que pagina venian', pedidos.filter((p) => p.startsWith('POST')).every((p) => p.endsWith('desde ' + SITIO)), pedidos.filter((p) => p.startsWith('POST')).slice(0, 4));
for (const [n, j] of [['A', a], ['B', b]]) ver(n + ': sin errores en la consola', j.errores.length === 0, [...new Set(j.errores)].slice(0, 4));
console.log('pedidos al servidor:', pedidos.length, '|', [...new Set(pedidos.map((p) => p.split(' desde ')[0].replace(/\/[0-9A-Za-z]{8}\b/, '/…')))].join(', '));
await nav.close(); srv.close(); api.kill();
console.log(mal ? 'FALLARON ' + mal : 'Todo bien');
process.exit(mal ? 1 : 0);

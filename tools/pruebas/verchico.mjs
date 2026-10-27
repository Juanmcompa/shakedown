// El tablero en celulares chicos, parados y acostados (320x568, 360x640, 375x667, 390x844), y girar el celular en plena carrera.
// Revisa que el tiempo, los sectores, la nota del copiloto, la velocidad y los botones se vean enteros dentro de la pantalla,
// sin pisarse entre si y sin tapar el auto; y que al girar (vertical a horizontal y al reves, en plena carrera) no desaparezca nada
// de lo que se dibuja: se compara contra la misma escena abierta directo en esa posicion (cantidad de triangulos y de llamadas de dibujo).
// Capturas en out/: tablero-<ancho>x<alto>.png de cada tamaño, tablero-320.png, tablero-360.png, tablero-horizontal.png,
// girar-antes.png, girar-despues.png.
// uso: node tools/pruebas/verchico.mjs
import fs from 'node:fs';
import { abrir } from './ver.mjs';
fs.mkdirSync('out', { recursive: true });
let mal = 0;
const ver = (que, si, detalle) => { console.log((si ? '  ok  ' : '  MAL ') + que + (si || detalle === undefined ? '' : ' -> ' + JSON.stringify(detalle))); if (!si) mal++; };
const dedos = { hasTouch: true, isMobile: true, deviceScaleFactor: 2 };
const TAMANOS = [[320, 568], [360, 640], [375, 667], [390, 844]];

// lo que hay en pantalla del tablero: cada cosa con su rectangulo, y donde esta el auto
const leer = (pag) => pag.evaluate(async () => {
  const THREE = await import('/vendor/three.module.js');
  const s = window.shakedown;
  const ve = (el) => { if (!el || el.hidden) return false; const r = el.getBoundingClientRect(); const st = getComputedStyle(el); return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none' && Number(st.opacity) > 0.05; };
  const cosas = [];
  const sumar = (nombre, el) => { if (ve(el)) { const r = el.getBoundingClientRect(); cosas.push({ nombre, x0: r.left, y0: r.top, x1: r.right, y1: r.bottom }); } };
  sumar('tiempo', document.querySelector('.placa.tiempo')); sumar('velocidad', document.querySelector('.placa.marcha'));
  document.querySelectorAll('.nota').forEach((el, k) => sumar('nota' + k, el));
  document.querySelectorAll('#mandos .mando').forEach((el) => sumar('mando-' + el.dataset.letra, el));
  sumar('volver', document.querySelector('#mandos .volver'));
  document.querySelectorAll('.pedal').forEach((el) => sumar('pedal-' + el.dataset.tecla, el));
  sumar('mano', document.querySelector('.redondo.mano'));
  sumar('sello', document.querySelector('.sello.se-ve'));
  const c = s.auto(), v = new THREE.Vector3(c.pos[0], c.pos[1] + 0.6, c.pos[2]).project(s.camara.cam);
  const auto = { x: (v.x * 0.5 + 0.5) * innerWidth, y: (1 - (v.y * 0.5 + 0.5)) * innerHeight };
  return { cosas, auto, W: innerWidth, H: innerHeight, texto: { reloj: document.getElementById('reloj').textContent, vel: document.getElementById('vel').textContent } };
});
const choca = (a, b) => a.x0 < b.x1 - 1 && b.x0 < a.x1 - 1 && a.y0 < b.y1 - 1 && b.y0 < a.y1 - 1;
function revisar(nombre, d) {
  const malas = [];
  for (const c of d.cosas) if (c.x0 < -0.5 || c.y0 < -0.5 || c.x1 > d.W + 0.5 || c.y1 > d.H + 0.5) malas.push('se sale: ' + c.nombre);
  for (let i = 0; i < d.cosas.length; i++) for (let k = i + 1; k < d.cosas.length; k++) if (choca(d.cosas[i], d.cosas[k])) malas.push(d.cosas[i].nombre + ' pisa a ' + d.cosas[k].nombre);
  const tapa = d.cosas.filter((c) => d.auto.x > c.x0 - 14 && d.auto.x < c.x1 + 14 && d.auto.y > c.y0 - 14 && d.auto.y < c.y1 + 14).map((c) => c.nombre);
  if (tapa.length) malas.push('tapa al auto: ' + tapa.join(','));
  ver(nombre + ': el tablero entra, sin pisarse ni tapar el auto (' + d.cosas.length + ' cosas, auto en ' + Math.round(d.auto.x) + ',' + Math.round(d.auto.y) + ')', malas.length === 0, malas);
  const hay = (n) => d.cosas.some((c) => c.nombre === n || c.nombre.startsWith(n));
  ver(nombre + ': se ven el tiempo, la velocidad, la nota del copiloto y los botones', ['tiempo', 'velocidad', 'nota', 'mando-C', 'pedal-ArrowUp', 'mano'].every(hay), d.cosas.map((c) => c.nombre));
}

// ---------- 1: los cuatro tamaños, parados y acostados ----------
const a = await abrir({ ancho: 390, alto: 844, contexto: dedos, demora: 120000 });
if (!a.cargo) { console.log('NO CARGO\n' + a.errores.join('\n')); process.exit(1); }
const A = a.pag;
await A.waitForFunction(() => !document.documentElement.classList.contains('cargando'), null, { timeout: 90000 });
await A.evaluate(() => { const s = window.shakedown; s.largar(); s.ir(300); s.avanzar(3.3); s.simular(2, 0, 0.6); s.avanzar(0.05); });
for (const [w, h] of TAMANOS) {
  for (const [ancho, alto, forma] of [[w, h, 'parado'], [h, w, 'acostado']]) {
    await A.setViewportSize({ width: ancho, height: alto });
    await A.waitForTimeout(1800);
    await A.evaluate(() => { const s = window.shakedown; s.simular(0.5, 0, 0.6); s.avanzar(0.05); });
    await A.waitForTimeout(500);
    const d = await leer(A);
    const nombre = ancho + 'x' + alto;
    await A.screenshot({ path: 'out/tablero-' + nombre + '.png' });
    revisar(nombre + ' ' + forma, d);
  }
}
fs.copyFileSync('out/tablero-320x568.png', 'out/tablero-320.png');
fs.copyFileSync('out/tablero-360x640.png', 'out/tablero-360.png');
fs.copyFileSync('out/tablero-640x360.png', 'out/tablero-horizontal.png');
// la cuenta regresiva (con el cartel de la largada): tambien entra
await A.setViewportSize({ width: 320, height: 568 });
await A.evaluate(() => { const s = window.shakedown; s.salir && s.salir(); });
ver('sin errores de consola', a.errores.length === 0, a.errores);
await a.cerrar();

// ---------- 2: girar el celular en plena carrera ----------
// Se compara con la misma escena abierta directo en la posicion final: si al girar desaparece algo, esa tiene menos cosas.
async function escena(ancho, alto, girarDesde, nombre) {
  const j = await abrir({ ancho: girarDesde ? girarDesde[0] : ancho, alto: girarDesde ? girarDesde[1] : alto, contexto: dedos, demora: 120000 });
  const P = j.pag;
  await P.waitForFunction(() => !document.documentElement.classList.contains('cargando'), null, { timeout: 90000 });
  await P.evaluate(() => { const s = window.shakedown; s.render.info.autoReset = false; s.largar(); s.ir(300); s.avanzar(3.3); });
  const quieta = () => P.evaluate(async () => { const s = window.shakedown; const r = []; for (let k = 0; k < 4; k++) { const c = s.auto(); c.vel[0] = c.vel[2] = 0; s.camara.estado.listo = false; if (k === 2) { s.render.info.reset(); } await new Promise((q) => requestAnimationFrame(q)); } return { calls: s.render.info.render.calls, tris: s.render.info.render.triangles }; });
  if (girarDesde) {
    await P.waitForTimeout(1500);
    await P.screenshot({ path: 'out/girar-antes.png' });
    await P.setViewportSize({ width: ancho, height: alto });
    await P.evaluate(() => { window.dispatchEvent(new Event('resize')); window.dispatchEvent(new Event('orientationchange')); });
    await P.waitForTimeout(1500);
  }
  const n = await quieta();
  await P.waitForTimeout(1200);
  const buf = await P.screenshot({ path: girarDesde ? (nombre || 'out/girar-despues.png') : 'out/girar-control-' + ancho + '.png' });
  const tablero = await leer(P);
  await j.cerrar();
  return { ...n, buf, tablero, errores: j.errores };
}
for (const [de, a2, nombre] of [[[390, 844], [844, 390], 'out/girar-despues.png'], [[844, 390], [390, 844], 'out/girar-despues-horizontal.png']]) {
  const forma = de[0] < de[1] ? 'de vertical a horizontal' : 'de horizontal a vertical';
  const control = await escena(a2[0], a2[1], null);
  const girada = await escena(a2[0], a2[1], de, nombre);
  const razon = girada.tris / control.tris, llamadas = girada.calls / control.calls;
  ver('girar ' + forma + ': se dibuja lo mismo que abriendo directo (triangulos ' + Math.round(razon * 100) + '%, llamadas ' + Math.round(llamadas * 100) + '%)', razon > 0.85 && razon < 1.15 && llamadas > 0.85 && llamadas < 1.15, { control: [control.calls, control.tris], girada: [girada.calls, girada.tris] });
  revisar('despues de girar ' + forma, girada.tablero);
  ver('girar ' + forma + ': sin errores de consola', girada.errores.length === 0, girada.errores);
}
console.log(mal ? mal + ' MAL' : 'TODO BIEN');
process.exit(mal ? 1 : 0);

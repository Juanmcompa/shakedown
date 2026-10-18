// El cartel de la largada ("Early Access" y la firma) y la firma en lo que se comparte.
// uso: node tools/pruebas/versello.mjs [pc|cel|celh|flechas|todo] [capturas]
import { abrir } from './ver.mjs';
const cual = process.argv[2] || 'todo', conFotos = process.argv.includes('capturas') || cual !== 'todo';
let mal = 0;
const ver = (que, si, detalle) => { console.log((si ? '  ok  ' : '  MAL ') + que + (si || detalle === undefined ? '' : ' -> ' + JSON.stringify(detalle))); if (!si) mal++; };
const dedos = { hasTouch: true, isMobile: true, deviceScaleFactor: 2 };
const FORMAS = {
  pc: { ancho: 1280, alto: 720 }, grande: { ancho: 1920, alto: 1080 }, notebook: { ancho: 1024, alto: 600 },
  cel: { ancho: 390, alto: 844, contexto: dedos }, chico: { ancho: 360, alto: 640, contexto: dedos },
  celh: { ancho: 844, alto: 390, contexto: dedos }, chicoh: { ancho: 667, alto: 375, contexto: dedos }, minih: { ancho: 640, alto: 360, contexto: dedos },
  tablet: { ancho: 768, alto: 1024, contexto: dedos }, tableth: { ancho: 1024, alto: 768, contexto: dedos },
};
// lo que hay en pantalla: el cartel, y con que se pisa
const estado = (pag) => pag.evaluate(() => {
  const el = document.getElementById('sello'), caja = (x) => { const r = x.getBoundingClientRect(); return r.width && r.height ? { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) } : null; };
  const visible = (x) => { if (!x) return false; const s = getComputedStyle(x); return !x.closest('[hidden]') && s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity) > 0.05 && x.getBoundingClientRect().width > 0; };
  const pisa = (a, b) => a && b && Math.min(a.x + a.w, b.x + b.w) > Math.max(a.x, b.x) && Math.min(a.y + a.h, b.y + b.h) > Math.max(a.y, b.y);
  const mio = el && visible(el) ? caja(el) : null;
  const otros = ['.placa.tiempo', '.placa.marcha', '#notas', '#grande', '#aviso', '#mandos .fila', '#mandos .volver', '#tactil .pedal.gas', '#tactil .pedal.freno', '#tactil .pedal.izq', '#tactil .pedal.der', '#tactil .redondo.mano', '#volante']
    .map((sel) => [sel, document.querySelector(sel)]).filter(([, x]) => visible(x)).map(([sel, x]) => [sel, caja(x)]);
  return { partida: window.shakedown.partida.estado, cuenta: +window.shakedown.partida.cuenta.toFixed(2), hay: !!el, visible: !!mio, caja: mio, texto: el ? el.innerText.replace(/\s+/g, ' ').trim() : '',
    adentro: !!mio && mio.x >= 0 && mio.y >= 0 && mio.x + mio.w <= innerWidth && mio.y + mio.h <= innerHeight, pisa: otros.filter(([, c]) => pisa(mio, c)).map(([sel]) => sel), grande: document.getElementById('grande').textContent };
});

// o: { sensor: el celular tiene sensor de inclinacion (si no, aparecen las flechas), cam: cuantas veces se cambia de camara }
async function recorrer(nombre, forma, o = {}) {
  const j = await abrir({ ...forma, ruta: o.ruta || '' });
  if (!j.cargo) { console.log(nombre + ': NO CARGO\n' + j.errores.join('\n')); mal++; await j.cerrar(); return; }
  const pag = j.pag, tactil = !!(forma.contexto && forma.contexto.hasTouch);
  await pag.emulateMedia({ reducedMotion: 'reduce' });
  for (let k = 0; k < (o.cam || 0); k++) await pag.keyboard.press('KeyC');
  if (tactil) await pag.tap('#largar'); else await pag.click('#largar');
  if (o.sensor) await pag.evaluate(() => { setInterval(() => window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', { alpha: 0, beta: 20, gamma: 3 })), 100); });
  await pag.waitForTimeout(tactil ? 2600 : 500);   // (en el celular tarda un momento en saberse si hay sensor)
  if (o.cam) await pag.evaluate(async () => {
    const { CAMARAS } = await import('/src/config.js'); const e = window.shakedown.camara.estado, m = CAMARAS[e.modo];
    e.dist = m.dist[0] * e.cerca; e.alto = m.alto[0]; e.fov = Math.min(e.parada && m.fovParado ? m.fovParado : 56, 2 * Math.atan(Math.tan(m.fov * Math.PI / 360) * e.ancha) * 180 / Math.PI); e.listo = false;
  });
  await pag.evaluate(() => window.shakedown.avanzar(1.2));   // (la cuenta va por el "2")
  await pag.waitForTimeout(1500);
  let e = await estado(pag);
  const auto = await pag.evaluate(() => { const s = window.shakedown, c = s.auto(), V = s.camara.cam.position.constructor, pt = (dx, dy, dz) => { const v = new V(c.pos[0] + dx, c.pos[1] + dy, c.pos[2] + dz).project(s.camara.cam); return [Math.round((v.x + 1) / 2 * innerWidth), Math.round((1 - v.y) / 2 * innerHeight)]; };
    // (la caja del auto en pantalla: las ocho esquinas de un cajon de 1,64 x 1,6 x 3,7 m alrededor del auto)
    const a = c.adelante, l = [a[2], 0, -a[0]], puntos = [];
    for (const f of [-1.85, 1.85]) for (const g of [-0.82, 0.82]) for (const h of [-0.35, 1.25]) puntos.push(pt(a[0] * f + l[0] * g, h, a[2] * f + l[2] * g));
    return { x: Math.min(...puntos.map((p) => p[0])), y: Math.min(...puntos.map((p) => p[1])), x2: Math.max(...puntos.map((p) => p[0])), y2: Math.max(...puntos.map((p) => p[1])) }; });
  // cuanto se mete el cartel en la caja del auto, en pixeles de alto. Con la camara de atras la caja exagera para arriba
  // (las esquinas de adelante del auto quedan mas altas que el techo que se ve): ahi se tolera que la roce.
  const seMete = e.caja && Math.min(e.caja.x + e.caja.w, auto.x2) > Math.max(e.caja.x, auto.x) ? Math.max(0, Math.min(e.caja.y + e.caja.h, auto.y2) - Math.max(e.caja.y, auto.y)) : 0;
  const tapaAlAuto = seMete > (o.cam === 1 ? 32 : 0);
  console.log('     ' + nombre + ':', JSON.stringify({ caja: e.caja, auto, texto: e.texto, modo: await pag.evaluate(() => document.documentElement.className) }));
  if (conFotos) await pag.screenshot({ path: 'out/sello-' + nombre + '-cuenta.png' });
  ver(nombre + ': en la cuenta regresiva se ve el cartel, entero', e.partida === 'cuenta' && e.visible && e.adentro, e);
  ver(nombre + ': dice Early Access y en desarrollo, y no quien lo hace (eso va solo en la portada)', /early access/i.test(e.texto) && /en desarrollo/i.test(e.texto) && !/Desarrollado|Comparini/.test(e.texto), e.texto);
  ver(nombre + ': no pisa nada de lo que hay en pantalla', e.pisa.length === 0, e.pisa);
  ver(nombre + ': no tapa al auto', !tapaAlAuto, { caja: e.caja, auto });
  await pag.evaluate(() => window.shakedown.avanzar(1.9));    // ya largo
  await pag.waitForTimeout(900);
  e = await estado(pag);
  if (conFotos && o.fotoYa) await pag.screenshot({ path: 'out/sello-' + nombre + '-ya.png' });
  ver(nombre + ': al largar se va', e.partida === 'corriendo' && !e.visible, { partida: e.partida, visible: e.visible, caja: e.caja });
  ver(nombre + ': sin errores en la consola', j.errores.length === 0, [...new Set(j.errores)].slice(0, 4));
  await j.cerrar();
}

if (cual === 'antes') {
  // (para elegir donde va: como se ve hoy la cuenta regresiva en cada pantalla)
  for (const [nombre, forma, flechas] of [['pc', FORMAS.pc], ['cel', FORMAS.cel], ['celh', FORMAS.celh], ['flechas', FORMAS.cel, true], ['chico', FORMAS.chico, true]]) {
    const j = await abrir({ ...forma }), pag = j.pag, dedos = !!(forma.contexto && forma.contexto.hasTouch);
    if (flechas) await pag.evaluate(() => window.shakedown.ajustar('botones', true));
    if (dedos) await pag.tap('#largar'); else await pag.click('#largar');
    await pag.waitForTimeout(500);
    await pag.evaluate(() => window.shakedown.avanzar(1.2));
    await pag.waitForTimeout(2500);
    await pag.screenshot({ path: 'out/sello-antes-' + nombre + '.png' });
    console.log(nombre, JSON.stringify(await pag.evaluate(() => ({ estado: window.shakedown.partida.estado, auto: (() => { const s = window.shakedown, c = s.auto(), v = new (s.camara.cam.position.constructor)(c.pos[0], c.pos[1], c.pos[2]).project(s.camara.cam); return { x: Math.round((v.x + 1) / 2 * innerWidth), y: Math.round((1 - v.y) / 2 * innerHeight) }; })() }))));
    await j.cerrar();
  }
  process.exit(0);
}
const CASOS = {
  pc: [FORMAS.pc, { fotoYa: true }], grande: [FORMAS.grande], notebook: [FORMAS.notebook], 'pc-atras': [FORMAS.pc, { cam: 1 }], 'pc-arriba': [FORMAS.pc, { cam: 2 }],
  cel: [FORMAS.cel, { sensor: true, fotoYa: true }], 'cel-flechas': [FORMAS.cel], 'cel-atras': [FORMAS.cel, { cam: 1 }], 'cel-arriba': [FORMAS.cel, { cam: 2, sensor: true }],
  chico: [FORMAS.chico], 'chico-atras': [FORMAS.chico, { cam: 1, sensor: true }], 'chico-arriba': [FORMAS.chico, { cam: 2 }],
  celh: [FORMAS.celh, { sensor: true }], 'celh-flechas': [FORMAS.celh], 'celh-atras': [FORMAS.celh, { cam: 1, sensor: true }], 'celh-arriba': [FORMAS.celh, { cam: 2 }],
  chicoh: [FORMAS.chicoh, { sensor: true }], 'chicoh-flechas': [FORMAS.chicoh], 'chicoh-atras': [FORMAS.chicoh, { cam: 1 }], minih: [FORMAS.minih], 'minih-sensor': [FORMAS.minih, { sensor: true, cam: 1 }],
  tablet: [FORMAS.tablet, { sensor: true }], 'tablet-flechas': [FORMAS.tablet], tableth: [FORMAS.tableth],
};
// En la vuelta cerrada el reloj lleva un renglon mas ("Largada"): la columna de la izquierda es mas alta.
CASOS['celh-vuelta'] = [FORMAS.celh, { ruta: '?c=practica' }];
CASOS['chicoh-vuelta'] = [FORMAS.chicoh, { ruta: '?c=practica' }];
CASOS['cel-vuelta'] = [FORMAS.cel, { ruta: '?c=practica', sensor: true }];
for (const nombre in CASOS) if (cual === 'todo' || cual === nombre || (cual.endsWith('*') && nombre.startsWith(cual.slice(0, -1)))) await recorrer(nombre, ...CASOS[nombre]);
if (cual === 'todo' || cual === 'tutorial') {
  // alguien nuevo: mientras el equipo explica, el cartel no esta; aparece cuando arranca la cuenta regresiva
  const j = await abrir({ ...FORMAS.pc, nuevo: true }), pag = j.pag;
  await pag.emulateMedia({ reducedMotion: 'reduce' });
  await pag.click('#largar');
  await pag.waitForTimeout(900);
  let e = await estado(pag);
  ver('tutorial: mientras el equipo explica, el cartel no se ve', e.partida === 'previa' && !e.visible && await pag.evaluate(() => !document.getElementById('tutorial').hidden), e);
  await pag.click('#tutSaltar');
  await pag.waitForTimeout(900);
  e = await estado(pag);
  ver('tutorial: al terminar arranca la cuenta regresiva, con el cartel', e.partida === 'cuenta' && e.visible && e.adentro && e.pisa.length === 0, e);
  await j.cerrar();
  // salir de una practica en plena cuenta y volver a largar: el cartel aparece de nuevo
  const k = await abrir({ ...FORMAS.pc }), q = k.pag;
  await q.emulateMedia({ reducedMotion: 'reduce' });
  await q.evaluate(() => { const s = window.shakedown; s.largar(); s.avanzar(3.3); s.simular(2, 0, 1); s.partida.volver(s.auto(), 'pedido'); });   // (una oficial empezada...)
  await q.evaluate(() => { const s = window.shakedown; for (let i = 0; i < 400 && s.partida.estado === 'corriendo'; i++) { s.auto().impacto = 40; s.avanzar(0.3); } s.saltearEspera(); });   // (...y terminada rompiendo el auto)
  await q.waitForFunction(() => !document.getElementById('fin').hidden, null, { timeout: 30000 }).catch(() => {});
  await q.click('#otra');   // practicar
  await q.waitForTimeout(600);
  e = await estado(q);
  ver('practica: en la cuenta regresiva de una practica tambien esta', e.partida === 'cuenta' && e.visible, e);
  await q.keyboard.press('Escape');
  await q.waitForTimeout(500);
  const afuera = await q.evaluate(() => ({ portada: !document.getElementById('portada').hidden, seVe: document.getElementById('sello').classList.contains('se-ve') }));
  ver('practica: al salir en plena cuenta, el cartel queda apagado', afuera.portada && !afuera.seVe, afuera);
  await q.click('#largar');
  await q.waitForTimeout(600);
  e = await estado(q);
  ver('practica: al largar otra vez, vuelve a aparecer', e.partida === 'cuenta' && e.visible, e);
  ver('sin errores en la consola', j.errores.length === 0 && k.errores.length === 0, [...new Set([...j.errores, ...k.errores])].slice(0, 4));
  await k.cerrar();
}
console.log(mal ? '\n' + mal + ' COSAS MAL' : '\ntodo bien');
process.exit(mal ? 1 : 0);

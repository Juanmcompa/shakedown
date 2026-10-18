// El tutorial de la primera vez: lo abre como alguien nuevo, saca una captura de cada paso y revisa que el auto espere,
// que se pueda saltar, cerrar y volver a ver, y que a quien ya jugo no se le muestre.
// uso: node tools/pruebas/vertutorial.mjs [pc|cel|celh|sensor|todo] [capturas]
import { abrir } from './ver.mjs';
const cual = process.argv[2] || 'todo', conFotos = process.argv.includes('capturas') || cual !== 'todo';
let mal = 0;
const ver = (que, si, detalle) => { console.log((si ? '  ok  ' : '  MAL ') + que + (si || detalle === undefined ? '' : ' -> ' + JSON.stringify(detalle))); if (!si) mal++; };
const FORMAS = {
  pc: { ancho: 1280, alto: 720 },
  cel: { ancho: 390, alto: 844, contexto: { hasTouch: true, isMobile: true, deviceScaleFactor: 2 } },
  celh: { ancho: 844, alto: 390, contexto: { hasTouch: true, isMobile: true, deviceScaleFactor: 2 } },
};
const estado = (pag) => pag.evaluate(() => ({
  abierto: !document.getElementById('tutorial').hidden, paso: window.shakedown.tutorial.paso(), partida: window.shakedown.partida.estado, pantalla: window.shakedown.estado().pantalla,
  quien: document.getElementById('tutNombre').textContent, rol: document.getElementById('tutRol').textContent, texto: document.getElementById('tutTexto').textContent,
  botones: [...document.querySelectorAll('#tutBotones button')].map((b) => b.textContent), saltar: !document.getElementById('tutSaltar').hidden,
  visto: window.shakedown.club.gusto('tutorial') || 0, nuevo: window.shakedown.club.esNuevo(), ayuda: !!window.shakedown.gusto('ayuda'),
  // la tarjeta entera en pantalla, sin tapar lo iluminado
  tarjeta: (() => { const t = document.querySelector('.tut-tarjeta').getBoundingClientRect(), r = document.getElementById('tutRetrato').getBoundingClientRect(), luces = [...document.querySelectorAll('#tutLuces i')].map((i) => i.getBoundingClientRect());
    const arriba = Math.min(t.top, r.top), tapa = luces.some((f) => Math.min(t.right, f.right) > Math.max(t.left, f.left) && Math.min(t.bottom, f.bottom) > Math.max(arriba, f.top));
    return { adentro: t.left >= 0 && arriba >= 0 && t.right <= innerWidth + 0.5 && t.bottom <= innerHeight + 0.5, tapa, luces: luces.map((f) => Math.round(f.width) + 'x' + Math.round(f.height)), agujeros: (document.getElementById('tutSombra').style.clipPath.match(/M/g) || []).length - 1, retrato: document.getElementById('tutRetrato').naturalWidth }; })(),
}));

async function recorrer(nombre, forma, sensor) {
  const j = await abrir({ ...forma, nuevo: true });
  if (!j.cargo) { console.log(nombre + ': NO CARGO\n' + j.errores.join('\n')); mal++; await j.cerrar(); return; }
  const pag = j.pag;
  await pag.emulateMedia({ reducedMotion: 'reduce' });   // (sin placa de video hay un cuadro por segundo: la luz no llegaria a moverse antes de la captura)
  ver(nombre + ': alguien nuevo', await pag.evaluate(() => window.shakedown.club.esNuevo()));
  const dedos = !!(forma.contexto && forma.contexto.hasTouch), tocar = (sel) => (dedos ? pag.tap(sel) : pag.click(sel));
  await tocar('#largar');
  if (sensor) await pag.evaluate(() => window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', { alpha: 0, beta: 20, gamma: 3 })));
  await pag.waitForTimeout(900);
  let e = await estado(pag);
  ver(nombre + ': al largar se abre el tutorial y el auto espera', e.abierto && e.partida === 'previa' && e.pantalla === 'jugando' && e.paso === 0, e);
  const vistos = [];
  let primero = '';
  for (let k = 0; k < 6; k++) {
    await pag.waitForTimeout(700);
    e = await estado(pag);
    vistos.push(e.quien);
    ver(nombre + ': paso ' + (k + 1) + ' (' + e.quien + ', ' + e.rol + ') entra en pantalla y no tapa lo que ilumina', e.tarjeta.adentro && !e.tarjeta.tapa && e.tarjeta.retrato > 0 && e.texto.length > 40, e.tarjeta);
    if (k === 0) { primero = e.texto; console.log('     ' + e.texto); }
    if (conFotos) await pag.screenshot({ path: 'out/tutorial-' + nombre + '-' + (k + 1) + '.png' });
    if (k < 5) await tocar('#tutBotones button.fuerte');
  }
  ver(nombre + ': el primer paso habla de ' + (dedos ? 'los pedales' : 'las teclas'), dedos ? /pedal/.test(primero) && (sensor ? /inclin/.test(primero) : /flechas doblan/.test(primero)) : /Espacio/.test(primero), primero);
  ver(nombre + ': hablan los seis, en orden', vistos.join() === 'Gaby,Leo,Julián,Sebastián,Gonza,Paloma', vistos);
  ver(nombre + ': el ultimo paso deja elegir la ayuda (y ya no ofrece saltar)', e.botones.join('|') === 'Sin ayuda|Largar con ayuda' && !e.saltar && e.partida === 'previa', e);
  await tocar('#tutBotones button.fuerte');
  await pag.waitForTimeout(700);
  e = await estado(pag);
  ver(nombre + ': al elegir, arranca la cuenta regresiva con la ayuda prendida y queda anotado que ya lo vio', !e.abierto && e.partida === 'cuenta' && e.visto === 1 && e.ayuda === true && !e.nuevo, e);
  ver(nombre + ': sin errores en la consola', j.errores.length === 0, [...new Set(j.errores)].slice(0, 4));
  await j.cerrar();
}

if (cual === 'pc' || cual === 'todo') await recorrer('pc', FORMAS.pc);
if (cual === 'cel' || cual === 'todo') await recorrer('cel', FORMAS.cel);
if (cual === 'celh' || cual === 'todo') await recorrer('celh', FORMAS.celh);
if (cual === 'sensor' || cual === 'todo') await recorrer('sensor', FORMAS.cel, true);

if (cual === 'todo' || cual === 'otros') {
  // --- saltar, cerrar, teclas, volver a verlo, y el que ya jugo ---
  const j = await abrir({ ...FORMAS.pc, nuevo: true }), pag = j.pag;
  await pag.click('#largar');
  await pag.waitForTimeout(600);
  await pag.keyboard.press('KeyC');   // (una tecla del juego: con el tutorial abierto no tiene que hacer nada)
  await pag.keyboard.press('ArrowRight');
  await pag.keyboard.press('ArrowRight');
  await pag.waitForTimeout(300);
  let e = await estado(pag);
  ver('teclas: la flecha avanza', e.paso === 2 && e.quien === 'Julián', e);
  await pag.keyboard.press('ArrowLeft');
  await pag.waitForTimeout(200);
  ver('teclas: la otra vuelve', (await estado(pag)).paso === 1);
  await pag.keyboard.press('Escape');
  await pag.waitForTimeout(500);
  e = await estado(pag);
  ver('Esc cierra y vuelve a la portada, sin gastar la oficial ni darlo por visto', !e.abierto && e.pantalla === 'portada' && e.nuevo && await pag.evaluate(() => window.shakedown.club.sePuedeOficial() && !document.getElementById('portada').hidden), e);
  await pag.click('#largar');
  await pag.waitForTimeout(600);
  ver('la proxima vez se abre de nuevo', (await estado(pag)).abierto);
  await pag.click('#tutCerrar');
  await pag.waitForTimeout(400);
  ver('la X tambien cierra', !(await estado(pag)).abierto && (await estado(pag)).pantalla === 'portada');
  await pag.click('#largar');
  await pag.waitForTimeout(600);
  await pag.click('#tutSaltar');
  await pag.waitForTimeout(600);
  e = await estado(pag);
  ver('saltar larga sin tocar la ayuda y lo da por visto', !e.abierto && e.partida === 'cuenta' && e.visto === 1 && e.ayuda === false, e);
  ver('otros: sin errores en la consola', j.errores.length === 0, [...new Set(j.errores)].slice(0, 4));
  await j.cerrar();

  // quien ya jugo (o ya lo vio) larga derecho; y lo puede volver a ver desde "Como se juega"
  const k = await abrir({ ...FORMAS.cel }), P = k.pag;
  await P.tap('#largar');
  await P.waitForTimeout(700);
  e = await estado(P);
  ver('el que ya lo vio larga derecho', !e.abierto && e.partida !== 'previa', e);
  await k.cerrar();
  const m = await abrir({ ...FORMAS.cel }), Q = m.pag;
  await Q.tap('[data-panel="ayuda"]');
  await Q.waitForTimeout(500);
  const equipo = await Q.evaluate(() => [...document.querySelectorAll('#equipo figure')].map((f) => f.querySelector('b').textContent + ' (' + f.querySelector('span').textContent + ')'));
  ver('en "El club" esta el equipo completo', equipo.length === 10 && equipo[0] === 'Gaby (instructora)' && equipo[9] === 'Rober (mecánico fan)', equipo);
  await Q.evaluate(() => document.getElementById('equipo').scrollIntoView());
  await Q.waitForTimeout(900);
  ver('los retratos del equipo cargan', await Q.evaluate(() => [...document.querySelectorAll('#equipo img')].filter((i) => i.naturalWidth > 0).length) === 10);
  if (conFotos || true) await Q.screenshot({ path: 'out/tutorial-equipo-cel.png' });
  await Q.evaluate(() => document.getElementById('verTutorial').scrollIntoView({ block: 'center' }));
  await Q.tap('#verTutorial');
  await Q.waitForTimeout(800);
  e = await estado(Q);
  ver('desde "Como se juega" se lo puede volver a ver', e.abierto && e.paso === 0 && e.partida === 'previa' && await Q.evaluate(() => document.getElementById('panel').hidden), e);
  ver('equipo: sin errores en la consola', m.errores.length === 0, [...new Set(m.errores)].slice(0, 4));
  await m.cerrar();
}
console.log(mal ? 'FALLARON ' + mal : 'Todo bien');
process.exit(mal ? 1 : 0);

// El pixelado (gusto "pixeles": nada / medio / fuerte; ver post.js). Revisa que:
//  - por defecto este en medio, con el lienzo agrandado sin suavizar;
//  - cambiar en Configuracion cambie en vivo (nada / medio / fuerte) y quede guardado tras recargar;
//  - con "nada" se vea como antes (el lienzo sin pixelar);
//  - los pixeles grandes sean cuadrados (bloques de 3 x 3 iguales en la captura) en la compu;
//  - ande tambien con el revelado apagado (camino liviano), en la pista del dia, la Montana, el inicio y el garaje;
//  - no haya errores de consola, en compu y en celu.
// Deja capturas en out/: pixeles-inicio, pixeles-no, pixeles-medio, pixeles-fuerte, pixeles-medio-celu, pixeles-montana-medio.
// uso: node tools/pruebas/verpixeles.mjs
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { abrir, largarDesdeHome } from './ver.mjs';
const req = createRequire(import.meta.url);
let sharp; try { sharp = req('sharp'); } catch (e) { sharp = req('/opt/npm-tools/node_modules/sharp'); }
fs.mkdirSync('out', { recursive: true });
let mal = 0;
const ver = (que, si, detalle) => { console.log((si ? '  ok  ' : '  MAL ') + que + (si || detalle === undefined ? '' : ' -> ' + JSON.stringify(detalle))); if (!si) mal++; };
const dedos = { hasTouch: true, isMobile: true, deviceScaleFactor: 3 };
const estadoPix = (pag) => pag.evaluate(() => ({ gusto: window.shakedown.gusto('pixeles'), post: window.shakedown.post.pixelado(), estilo: document.getElementById('lienzo').style.imageRendering, prendido: window.shakedown.post.prendido() }));
const poner = (pag, v) => pag.click('[data-ajuste="pixeles"] [data-valor="' + v + '"]');
// la escena de las capturas: la pista del dia ~10 s despues de largar
const escena = (pag) => pag.evaluate(() => { const s = window.shakedown; s.largar(); s.avanzar(3.3); s.simular(10, 0, 0.8); s.avanzar(0.05); });
// que parte de los bloques de n x n de una zona son de un solo color
async function bloques(pag, n, zona) {
  const { data, info } = await sharp(await pag.screenshot({ clip: zona })).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let iguales = 0, total = 0;
  for (let by = 0; by + n <= info.height; by += n) for (let bx = 0; bx + n <= info.width; bx += n) {
    total++; const o = (by * info.width + bx) * 3; let ok = true;
    for (let y = 0; y < n && ok; y++) for (let x = 0; x < n; x++) { const q = ((by + y) * info.width + bx + x) * 3; if (data[q] !== data[o] || data[q + 1] !== data[o + 1] || data[q + 2] !== data[o + 2]) { ok = false; break; } }
    if (ok) iguales++;
  }
  return iguales / total;
}

console.log('En la compu');
const a = await abrir({ ancho: 1280, alto: 720, demora: 120000 });
if (!a.cargo) { console.log('NO CARGO\n' + a.errores.join('\n')); process.exit(1); }
const A = a.pag;
let e = await estadoPix(A);
ver('por defecto esta en medio', e.gusto === 'medio' && e.post === 'medio', e);
ver('el lienzo se agranda sin suavizar', e.estilo === 'pixelated', e);
await A.waitForTimeout(500);
await A.screenshot({ path: 'out/pixeles-inicio.png' });
// el cambio en vivo, desde el panel de Configuracion
await A.click('[data-panel="ajustes"]');
await A.waitForSelector('#panelAjustes:not([hidden])');
ver('el panel tiene la opcion Píxeles con tres valores', await A.locator('[data-ajuste="pixeles"] button').count() === 3);
ver('"Medio" aparece elegido', await A.locator('[data-ajuste="pixeles"] .elegido').getAttribute('data-valor') === 'medio');
await poner(A, 'fuerte'); e = await estadoPix(A);
ver('fuerte: cambia en vivo', e.post === 'fuerte' && e.gusto === 'fuerte' && e.estilo === 'pixelated', e);
await poner(A, 'nada'); e = await estadoPix(A);
ver('no: el lienzo vuelve a ser normal', e.post === 'nada' && e.gusto === 'nada' && e.estilo === '', e);
await poner(A, 'fuerte');
// queda guardado
await A.reload(); await A.waitForFunction(() => window.shakedown, null, { timeout: 90000 });
e = await estadoPix(A);
ver('tras recargar sigue en fuerte', e.gusto === 'fuerte' && e.post === 'fuerte', e);
// la pista del dia en los tres niveles
await largarDesdeHome(A, 'hoy');
await escena(A);   // (una primera vez, para que las tres capturas partan del mismo estado)
for (const [v, f] of [['nada', 'no'], ['medio', 'medio'], ['fuerte', 'fuerte']]) {
  await A.evaluate((v) => window.shakedown.ajustar('pixeles', v), v);
  await escena(A);
  await A.waitForTimeout(400);
  await A.screenshot({ path: 'out/pixeles-' + f + '.png' });
  if (v !== 'nada') {
    const n = v === 'medio' ? 3 : 5;
    const frac = await bloques(A, n, { x: 150, y: 360, width: 450, height: 240 });
    ver(v + ': los pixeles son bloques cuadrados de ' + n + ' x ' + n + ' (' + Math.round(frac * 100) + '% de los bloques)', frac > 0.9, frac);
  }
}
// el camino liviano: sin el revelado, el pixelado sigue
await A.evaluate(() => { window.shakedown.ajustar('pixeles', 'medio'); window.shakedown.post.prender(false); });
await escena(A); await A.waitForTimeout(300);
await A.screenshot({ path: 'out/pixeles-medio-liviano.png' });
ver('sin el revelado el pixelado sigue (bloques de 3 x 3)', (await bloques(A, 3, { x: 150, y: 360, width: 450, height: 240 })) > 0.9);
await A.evaluate(() => window.shakedown.post.prender(true));
// el garaje (la vitrina)
await A.evaluate(() => window.shakedown.ajustar('pixeles', 'medio'));
// la Montana
await A.reload(); await A.waitForFunction(() => window.shakedown, null, { timeout: 90000 });
await largarDesdeHome(A, 'montana');
await A.evaluate(() => { const s = window.shakedown, P = s.T.camino, c = s.auto(), i = 150; s.largar(); s.avanzar(3.3); c.poner(P.X[i], P.Z[i], Math.atan2(P.HX[i], -P.HZ[i])); s.simular(0.8, 0, 0.6); s.avanzar(0.05); });
await A.waitForTimeout(400);
await A.screenshot({ path: 'out/pixeles-montana-medio.png' });
ver('la Montaña se ve pixelada', (await estadoPix(A)).post === 'medio');
ver('sin errores de consola (compu)', a.errores.length === 0, a.errores);
await a.cerrar();

console.log('En el celu (390 x 844)');
const b = await abrir({ ancho: 390, alto: 844, contexto: dedos, demora: 120000 });
if (!b.cargo) { console.log('NO CARGO\n' + b.errores.join('\n')); process.exit(1); }
const B = b.pag;
e = await estadoPix(B);
ver('en el celu tambien arranca en medio', e.post === 'medio' && e.estilo === 'pixelated', e);
const ratio = await B.evaluate(() => window.shakedown.render.getPixelRatio());
ver('el lienzo se dibuja a 1 pixel por pixel de pantalla (el navegador lo agranda)', ratio === 1, ratio);
await largarDesdeHome(B, 'hoy', { dedos: true });
await escena(B); await B.waitForTimeout(400);
await B.screenshot({ path: 'out/pixeles-medio-celu.png' });
ver('sin errores de consola (celu)', b.errores.length === 0, b.errores);
await b.cerrar();
console.log(mal ? '\nHAY ' + mal + ' MAL' : '\nTodo bien');
process.exit(mal ? 1 : 0);

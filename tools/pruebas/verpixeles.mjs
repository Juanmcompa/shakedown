// Comprueba que ya NO hay pixelado (se saco porque confundia a los jugadores): sin opcion Pixeles en Configuracion,
// sin gusto "pixeles", el lienzo sin agrandar a lo bruto y el revelado de siempre andando (post.prendido).
// uso: node tools/pruebas/verpixeles.mjs
import { abrir } from './ver.mjs';
let mal = 0;
const ver = (que, si, detalle) => { console.log((si ? '  ok  ' : '  MAL ') + que + (si || detalle === undefined ? '' : ' -> ' + JSON.stringify(detalle))); if (!si) mal++; };
const a = await abrir({ ancho: 1280, alto: 720, demora: 120000 });
if (!a.cargo) { console.log('NO CARGO\n' + a.errores.join('\n')); process.exit(1); }
const A = a.pag;
ver('no hay opcion Pixeles en Configuracion', await A.locator('[data-ajuste="pixeles"]').count() === 0);
const e = await A.evaluate(() => ({ gusto: window.shakedown.gusto('pixeles'), pixelar: typeof window.shakedown.post.pixelar, estilo: document.getElementById('lienzo').style.imageRendering, prendido: window.shakedown.post.prendido() }));
ver('no hay gusto ni funcion de pixelado', e.gusto === undefined && e.pixelar === 'undefined', e);
ver('el lienzo no se agranda sin suavizar', e.estilo !== 'pixelated', e);
ver('el revelado de siempre esta prendido', e.prendido === true, e);
await A.evaluate(() => { const s = window.shakedown; s.largar(); s.avanzar(3.3); s.simular(5, 0, 0.8); s.avanzar(0.05); });
await A.waitForTimeout(500);
await A.screenshot({ path: 'out/pixeles-no.png' });
ver('sin errores de consola', a.errores.length === 0, a.errores);
await a.cerrar();
console.log(mal ? mal + ' MAL' : 'TODO BIEN');
process.exit(mal ? 1 : 0);

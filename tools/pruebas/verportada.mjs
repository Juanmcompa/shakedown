// La firma de la portada: "Desarrollado por ..." debajo de la marca, solo en la portada (no mientras carga, no en la largada).
// uso: node tools/pruebas/verportada.mjs [capturas]
import { abrir } from './ver.mjs';
const conFotos = process.argv.includes('capturas');
let mal = 0;
const ver = (que, si, detalle) => { console.log((si ? '  ok  ' : '  MAL ') + que + (si || detalle === undefined ? '' : ' -> ' + JSON.stringify(detalle))); if (!si) mal++; };
const dedos = { hasTouch: true, isMobile: true, deviceScaleFactor: 2 };
for (const [nombre, forma] of [['pc', { ancho: 1280, alto: 720 }], ['notebook', { ancho: 1366, alto: 680 }], ['cel', { ancho: 390, alto: 844, contexto: dedos }], ['chico', { ancho: 360, alto: 640, contexto: dedos }], ['celh', { ancho: 844, alto: 390, contexto: dedos }]]) {
  const j = await abrir({ ...forma, sinEsperar: true });
  const pag = j.pag;
  await pag.waitForSelector('#cargaTexto', { timeout: 15000 }).catch(() => {});
  const mientras = await pag.evaluate(() => { const f = document.getElementById('firma'); return !!f && f.getBoundingClientRect().height > 0 && document.documentElement.classList.contains('cargando'); });
  await pag.waitForFunction(() => window.shakedown && !document.documentElement.classList.contains('cargando'), null, { timeout: 90000 }).catch(() => {});
  await pag.waitForTimeout(600);
  const e = await pag.evaluate(() => {
    const f = document.getElementById('firma'), r = f.getBoundingClientRect(), m = document.querySelector('#portada .marca').getBoundingClientRect();
    return { texto: f.textContent.trim(), visible: !f.hidden && r.height > 0, adentro: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth, debajo: r.top >= m.bottom - 12 && r.top - m.bottom < 30, centrada: Math.abs((r.left + r.right) / 2 - (m.left + m.right) / 2) < 30 || Math.abs(r.left - m.left) < 30 };
  });
  if (conFotos) await pag.screenshot({ path: 'out/portada-firma-' + nombre + '.png' });
  ver(nombre + ': en la portada, debajo de la marca, entera en pantalla', e.visible && e.texto === 'Desarrollado por Juan M. Comparini' && e.adentro && e.debajo && e.centrada, e);
  ver(nombre + ': mientras carga no aparece', !mientras);
  // (con nombre: sin nombre, la oficial no larga y pide uno)
  await pag.evaluate(() => { window.shakedown.club.ponerNombre('Prueba'); window.shakedown.largar(); window.shakedown.avanzar(1.2); });
  await pag.waitForTimeout(500);
  const largando = await pag.evaluate(() => ({ firma: document.getElementById('firma').getBoundingClientRect().height > 0 && !document.getElementById('portada').hidden, sello: document.getElementById('sello').innerText }));
  ver(nombre + ': en la largada no esta (y el cartel no la dice)', !largando.firma && !/Comparini/.test(largando.sello), largando);
  ver(nombre + ': sin errores en la consola', j.errores.length === 0, [...new Set(j.errores)].slice(0, 3));
  await j.cerrar();
}
console.log(mal ? '\n' + mal + ' COSAS MAL' : '\ntodo bien');
process.exit(mal ? 1 : 0);

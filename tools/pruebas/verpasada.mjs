// Corre una pasada entera con un piloto automatico dentro del juego (en el navegador sin pantalla) y muestra
// lo que sigue: el resultado, el mensaje para compartir, la tabla, y que pasa cuando un amigo abre el link.
// uso: node tools/pruebas/verpasada.mjs [pista o "hoy"] [piloto] [auto] [tam=390x844] [movil]
import { abrir } from './ver.mjs';
const args = process.argv.slice(2).filter((a) => !a.includes('=') && a !== 'movil' && a !== 'ayuda' && a !== 'trazada'), tam = (process.argv.find((a) => a.startsWith('tam=')) || 'tam=1280x720').slice(4).split('x').map(Number);
const sale = (process.argv.find((a) => a.startsWith('sale=')) || 'sale=pasada').slice(5);   // como se llaman las capturas
const pista = args[0] || 'hoy', piloto = args[1] || 'bueno', auto = args[2] || 'vitarita';
const movil = process.argv.includes('movil');   // como un celular: pantalla tactil y el doble de pixeles
const permisos = { permissions: ['clipboard-read', 'clipboard-write'], ...(movil ? { hasTouch: true, isMobile: true, deviceScaleFactor: 2 } : {}) };

// corre la pasada dentro de la pagina; devuelve el estado final
const correr = (pag, piloto, auto, nombre) => pag.evaluate(async ([piloto, auto, nombre]) => {
  const { decidir, PILOTOS } = await import('/tools/piloto.mjs'), { crearReferencia } = await import('/src/referencia.js'), { AUTOS, JUEGO } = await import('/src/config.js'), { azar } = await import('/src/noise.js');
  const s = window.shakedown, DT = JUEGO.paso, o = PILOTOS[piloto];
  if (nombre) s.club.ponerNombre(nombre);
  document.querySelector('[data-auto="' + auto + '"]').click();
  s.largar(); s.avanzar(3.2);
  const c = s.auto(), p = s.partida, ref = crearReferencia(s.T, AUTOS[auto]), rnd = azar(7), ent = { x: 0, y: 0, mano: false }, m = {};
  let t = 0, prox = 0, pasos = 0;
  // (en una vuelta cerrada: da dos vueltas y sale)
  const V = s.T.vuelta;
  while (t < 600 && p.estado === 'corriendo' && !(V && p.rondas.length >= 2)) {
    if (t >= prox) { prox = t + o.reaccion * (0.7 + 0.6 * rnd()); decidir(s.T, ref, c, p, o, m, rnd, t, ent); }
    if (o.teclas && t > m.hasta && !(t < m.atras)) ent.x = 0;
    // (con la ayuda de manejo prendida, la ayuda corrige lo que pide el piloto, como en el juego)
    if (s.gusto('ayuda')) { const e2 = { x: ent.x, y: ent.y, mano: false }; s.ayuda.aplicar(c, p.indice, p.lejos, e2); c.paso(e2, DT); } else c.paso(ent, DT);
    t += DT;
    if (++pasos % 2 === 0) s.avanzar(DT * 2);
  }
  const antesDeSalir = V ? { rondas: p.rondas.map((x) => x.tiempo.toFixed(2) + ' ' + x.colores), indice: p.indice } : null;
  if (V) s.salir(); else s.saltearEspera();
  return { ...s.estado(), ...(antesDeSalir || {}) };
}, [piloto, auto, nombre]);

const j = await abrir({ ancho: tam[0], alto: tam[1], ruta: pista === 'hoy' ? '' : '?p=' + pista + '&futuro', contexto: permisos });
if (!j.cargo) { console.log('NO CARGO\n' + j.errores.join('\n')); await j.cerrar(); process.exit(1); }
const { pag } = j;
if (process.argv.includes('ayuda')) await pag.evaluate(() => window.shakedown.ajustar('ayuda', true));   // con la ayuda de manejo
if (process.argv.includes('trazada')) await pag.evaluate(() => window.shakedown.ajustar('trazada', true));   // con la trazada pintada
console.log('antes:', JSON.stringify(await pag.evaluate(() => window.shakedown.estado())));
console.log('final:', JSON.stringify(await correr(pag, piloto, auto, 'Juanma')));
await pag.waitForFunction(() => !document.getElementById('fin').hidden, null, { timeout: 60000 }).catch(() => console.log('NO APARECIO EL RESULTADO'));
await pag.waitForTimeout(1500);
await pag.screenshot({ path: 'out/' + sale + '-fin.png' });
await pag.click('#compartir');
await pag.waitForTimeout(800);
const copiado = await pag.evaluate(() => navigator.clipboard.readText()).catch((e) => 'NO SE PUDO LEER: ' + e.message);
const [texto, link, firma] = copiado.split('\n');
console.log('mensaje:', texto);
console.log('firma:', firma, '| renglones:', copiado.split('\n').length);
console.log('link de', (link || '').length, 'letras:', (link || '').slice(0, 90) + '...');
console.log('aviso:', await pag.textContent('#compartido'));
await pag.click('#salir');
await pag.waitForTimeout(600);
await pag.screenshot({ path: 'out/' + sale + '-portada.png' });
await pag.click('[data-panel="tabla"]'); await pag.waitForTimeout(400); await pag.screenshot({ path: 'out/' + sale + '-tabla.png' });
await pag.click('[data-panel="pasadas"]').catch(async () => { await pag.click('#cerrarPanel'); await pag.click('[data-panel="pasadas"]'); }); await pag.waitForTimeout(400); await pag.screenshot({ path: 'out/' + sale + '-pasadas.png' });
await pag.click('#cerrarPanel').catch(() => {});
await pag.click('[data-panel="ayuda"]'); await pag.waitForTimeout(400); await pag.screenshot({ path: 'out/' + sale + '-ayuda.png' });
console.log(j.errores.length ? 'ERRORES:\n' + [...new Set(j.errores)].join('\n') : 'sin errores en consola');
await j.cerrar();

// --- el amigo abre el link ---
if (link && link.includes('#r=')) {
  const k = await abrir({ ancho: tam[0], alto: tam[1], ruta: link.slice(link.indexOf('/', 8) + 1), contexto: permisos });
  if (!k.cargo) { console.log('EL AMIGO NO CARGO\n' + k.errores.join('\n')); await k.cerrar(); process.exit(1); }
  await k.pag.waitForTimeout(1200);
  console.log('amigo, al abrir:', JSON.stringify(await k.pag.evaluate(() => ({ ...window.shakedown.estado(), url: location.href.slice(0, 80), oficial: window.shakedown.club.sePuedeOficial(), tabla: window.shakedown.club.tabla().map((r) => r.nombre + ' ' + r.t.toFixed(2) + ' ' + r.c + (r.codigo ? ' (fantasma)' : '') + (r.ayuda ? ' (con ayuda)' : '')) }))));
  await k.pag.screenshot({ path: 'out/' + sale + '-amigo-portada.png' });
  // larga y corre unos segundos: tiene que verse el fantasma
  await k.pag.evaluate(() => { const s = window.shakedown; s.largar(); s.avanzar(3.2); s.simular(4, 0, 1); s.avanzar(4); });
  await k.pag.waitForTimeout(2500);
  await k.pag.screenshot({ path: 'out/' + sale + '-amigo-corriendo.png' });
  console.log('amigo, corriendo:', JSON.stringify(await k.pag.evaluate(() => window.shakedown.estado())), '| rival en pantalla:', await k.pag.textContent('#rival'));
  console.log('final del amigo:', JSON.stringify(await correr(k.pag, 'normal', 'kacito', 'Fede').catch((e) => 'ERROR ' + e.message)));
  await k.pag.waitForFunction(() => !document.getElementById('fin').hidden, null, { timeout: 60000 }).catch(() => console.log('NO APARECIO EL RESULTADO DEL AMIGO'));
  await k.pag.waitForTimeout(1500);
  await k.pag.screenshot({ path: 'out/' + sale + '-amigo-fin.png' });
  console.log(k.errores.length ? 'ERRORES DEL AMIGO:\n' + [...new Set(k.errores)].join('\n') : 'amigo sin errores en consola');
  await k.cerrar();
}

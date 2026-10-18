// La pantalla de "no se pudo cargar": provoca cada tipo de falla y revisa el codigo, el texto y el detalle que se copia.
// uso: node tools/pruebas/verfallos.mjs [caso|todo] [capturas] [movil]
//   casos: normal bloqueado falta sinred corte error error3 promesa viejo graficos lenta detalle amano
import { abrir } from './ver.mjs';
const cual = process.argv[2] || 'todo', conFotos = process.argv.includes('capturas'), movil = process.argv.includes('movil');
let mal = 0;
const ver = (que, si, detalle) => { console.log((si ? '  ok  ' : '  MAL ') + que + (si || detalle === undefined ? '' : ' -> ' + JSON.stringify(detalle))); if (!si) mal++; };
// cuantos archivos prueba la sonda: los modulos de la lista de index.html, los dos de Three.js y el estilo
const TOTAL = (await import('node:fs')).readFileSync(new URL('../../index.html', import.meta.url), 'utf8').match(/const modulos = \[([^\]]*)\]/)[1].split(',').length + 3;
const forma = movil ? { ancho: 390, alto: 844, contexto: { hasTouch: true, isMobile: true, deviceScaleFactor: 2, permissions: ['clipboard-read', 'clipboard-write'] } } : { ancho: 1280, alto: 720, contexto: { permissions: ['clipboard-read', 'clipboard-write'] } };
const leer = (pag) => pag.evaluate(() => {
  const el = (id) => document.getElementById(id), c = window.carga || {};
  return { clase: document.documentElement.className, texto: (el('cargaTexto') || {}).textContent || '', linea: el('cargaCodigo') && !el('cargaCodigo').hidden ? el('cargaCodigo').textContent : '', codigo: c.codigo || '', paso: c.paso,
    otra: !!(el('cargaOtraVez') && !el('cargaOtraVez').hidden), detalle: el('cargaDetalle') && !el('cargaDetalle').hidden ? el('cargaDetalle').textContent : '', sonda: c.sonda ? { listo: c.sonda.listo, total: c.sonda.total, mal: c.sonda.lista.filter((x) => x.antes === 'no bajó' || (x.ahora && x.ahora !== 'responde')).map((x) => x.archivo + ':' + x.antes + '/' + x.ahora) } : null,
    nota: el('cargaNota') && !el('cargaNota').hidden ? el('cargaNota').textContent : '', errores: (c.errores || []).map((e) => e.letra + e.paso + ' ' + e.donde + ' ' + e.mensaje.slice(0, 80)), pasos: (c.pasos || []).length, juego: !!window.shakedown };
});
// espera a que la pagina muestre la falla (y a que termine de buscar que archivo fue)
async function esperarFalla(pag, ms = 60000) {
  await pag.waitForFunction(() => document.documentElement.classList.contains('carga-fallo'), null, { timeout: ms }).catch(() => {});
  await pag.waitForFunction(() => !window.carga || !window.carga.sonda || window.carga.sonda.listo, null, { timeout: 15000 }).catch(() => {});
  await pag.waitForTimeout(300);
  return leer(pag);
}
const cambiar = (pag, patron, hacer) => pag.route(patron, async (r) => { const resp = await r.fetch(); await r.fulfill({ response: resp, body: hacer(await resp.text()) }); });
const CASOS = {
  // sin fallas: no aparece nada de esto
  normal: { arma: async () => {}, mira: async (pag, j) => {
    await pag.waitForFunction(() => window.shakedown && !document.documentElement.classList.contains('cargando'), null, { timeout: 90000 }).catch(() => {});
    const e = await leer(pag);
    ver('normal: carga, sin codigo ni botones', e.juego && !e.clase.includes('cargando') && !e.clase.includes('carga-fallo') && !e.clase.includes('carga-lenta') && !e.linea && !e.otra && !e.detalle && e.errores.length === 0, e);
    ver('normal: quedaron anotados los pasos de la carga (del 2 al 6)', e.pasos === 5 && e.paso === 6, e);
  } },
  // un bloqueador frena un archivo
  bloqueado: { arma: (pag) => pag.route(/src\/carteleria\.js/, (r) => r.abort('blockedbyclient')), mira: async (pag) => {
    const e = await esperarFalla(pag);
    console.log('     ' + e.texto + '\n     ' + e.linea);
    ver('bloqueado: codigo R0 y dice que archivo', e.codigo === 'R0' && /carteleria\.js \(sin respuesta\)/.test(e.linea), e);
    ver('bloqueado: el texto habla de un bloqueador, no de la conexion', /frenando/.test(e.texto) && /bloqueador/.test(e.texto), e.texto);
    ver('bloqueado: botones de probar de nuevo y del detalle', e.otra && /detalle/.test(e.detalle), e);
    ver('bloqueado: la linea dice la pagina y el navegador', /pág\. \d+ · Chrome \d+/.test(e.linea), e.linea);
    ver('bloqueado: se probaron todos los archivos y fallo solo ese', e.sonda && e.sonda.listo && e.sonda.total === TOTAL && e.sonda.mal.length === 1, e.sonda);
  } },
  // falta un archivo en el sitio (404)
  falta: { arma: (pag) => pag.route(/src\/clima\.js/, (r) => r.fulfill({ status: 404, body: 'no' })), mira: async (pag) => {
    const e = await esperarFalla(pag);
    console.log('     ' + e.texto + '\n     ' + e.linea);
    ver('falta: codigo R0, el archivo y el numero', e.codigo === 'R0' && /clima\.js \(404\)/.test(e.linea), e);
    ver('falta: el texto dice que falta una parte', /le falta una parte/.test(e.texto), e.texto);
  } },
  // se corto la conexion: no baja nada
  sinred: { arma: (pag) => pag.route(/\/(src|vendor)\/|style\.css/, (r) => r.abort('internetdisconnected')), mira: async (pag) => {
    const e = await esperarFalla(pag);
    console.log('     ' + e.texto + '\n     ' + e.linea);
    ver('sinred: codigo R0 y el texto habla de la conexion', e.codigo === 'R0' && /No hay conexión/.test(e.texto) && new RegExp('no responde ninguno de los ' + TOTAL + ' archivos').test(e.linea), e);
    ver('sinred: fallaron todos', e.sonda && e.sonda.mal.length === e.sonda.total, e.sonda && e.sonda.mal.length);
  } },
  // un archivo no bajo la primera vez, pero ahora responde
  corte: { arma: (pag) => { let n = 0; return pag.route(/src\/flora\.js/, (r) => (n++ ? r.continue() : r.abort('connectionreset'))); }, mira: async (pag) => {
    const e = await esperarFalla(pag);
    console.log('     ' + e.texto + '\n     ' + e.linea);
    ver('corte: codigo R0', e.codigo === 'R0', e);
    ver('corte: o nombra el archivo que no bajo, o dice que ahora responden', /flora\.js \(no bajó\)/.test(e.linea) || /ahora los archivos responden/.test(e.linea), e.linea);
  } },
  // el programa falla apenas arranca (un archivo tira un error al leerse)
  error: { arma: (pag) => cambiar(pag, /src\/dia\.js/, (t) => t + '\nthrow new Error("prueba de error en la carga");\n'), mira: async (pag) => {
    const e = await esperarFalla(pag);
    console.log('     ' + e.texto + '\n     ' + e.linea);
    ver('error: codigo E0 con el archivo, el renglon y el mensaje', e.codigo === 'E0' && /dia\.js:\d+(:\d+)? · .*prueba de error en la carga/.test(e.linea), e);
    ver('error: el texto no le echa la culpa a la conexion', /falló al arrancar/.test(e.texto) && !/conexión/.test(e.texto), e.texto);
    ver('error: ningun archivo figura como caido', e.sonda && e.sonda.listo && e.sonda.mal.length === 0, e.sonda);
  } },
  // el programa falla mas adelante (plantando el paisaje)
  error3: { arma: (pag) => cambiar(pag, /src\/flora\.js/, (t) => t.replace('export function crearFlora(', 'export function crearFlora() { throw new TypeError("prueba: no se pudo plantar"); }\nfunction crearFloraDeVerdad(')), mira: async (pag) => {
    const e = await esperarFalla(pag);
    console.log('     ' + e.texto + '\n     ' + e.linea);
    ver('error3: el codigo dice el paso 3 y el archivo', /^[EP]3$/.test(e.codigo) && /flora\.js:\d+/.test(e.linea) && /no se pudo plantar/.test(e.linea), e);
  } },
  // algo que el programa pidio y fallo, sin que nadie lo atajara (no impide que el juego termine de cargar)
  promesa: { arma: (pag) => cambiar(pag, /src\/noise\.js/, (t) => t + '\nPromise.reject(new TypeError("prueba de promesa"));\n'), mira: async (pag) => {
    await pag.waitForFunction(() => document.documentElement.classList.contains('carga-fallo'), null, { timeout: 60000 }).catch(() => {});
    const e = await leer(pag);
    console.log('     ' + e.texto + '\n     ' + e.linea);
    ver('promesa: codigo P (con el paso en que salto), el archivo y el mensaje', /^P\d$/.test(e.codigo) && /noise\.js:\d+/.test(e.linea) && /prueba de promesa/.test(e.linea), e);
    await pag.waitForFunction(() => !document.documentElement.classList.contains('cargando'), null, { timeout: 90000 }).catch(() => {});
    const d = await pag.evaluate(() => ({ cargando: document.documentElement.classList.contains('cargando'), seVe: getComputedStyle(document.getElementById('carga')).display, largar: !document.getElementById('largar').disabled }));
    ver('promesa: si el juego igual termina de cargar, el cartel se va y se puede jugar', !d.cargando && d.seVe === 'none' && d.largar, d);
  } },
  // un navegador que no entiende el programa
  viejo: { arma: (pag) => cambiar(pag, /src\/dia\.js/, (t) => 'export const roto = ;\n' + t), mira: async (pag) => {
    const e = await esperarFalla(pag);
    console.log('     ' + e.texto + '\n     ' + e.linea);
    ver('viejo: codigo V0 y el texto habla del navegador', e.codigo === 'V0' && /muy viejo/.test(e.texto) && /SyntaxError|Unexpected/.test(e.linea), e);
  } },
  // lo guardado en el aparato esta roto: es un error del programa (aunque el mensaje hable de "sintaxis"), no un navegador viejo
  guardado: { arma: (pag) => pag.addInitScript(() => { try { localStorage.setItem('shakedown', '{esto no es json'); } catch (e) { /* nada */ } }), mira: async (pag) => {
    await pag.waitForFunction(() => document.documentElement.classList.contains('carga-fallo') || (window.shakedown && !document.documentElement.classList.contains('cargando')), null, { timeout: 90000 }).catch(() => {});
    const e = await leer(pag);
    console.log('     ' + (e.linea || '(cargo bien: el juego aguanta lo guardado roto)') + (e.linea ? '\n     ' + e.texto : ''));
    ver('guardado roto: o el juego carga igual, o lo cuenta como error del programa (nunca como navegador viejo)', (!e.clase.includes('carga-fallo') && e.juego) || /^[EP]\d$/.test(e.codigo), e);
  } },
  // un aparato sin graficos 3D
  graficos: { arma: (pag) => pag.addInitScript(() => { const de = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (tipo, ...resto) { return /webgl/.test(tipo) ? null : de.call(this, tipo, ...resto); }; }), mira: async (pag) => {
    const e = await esperarFalla(pag);
    console.log('     ' + e.texto + '\n     ' + e.linea);
    ver('graficos: codigo G0 y el texto habla de los graficos 3D', e.codigo === 'G0' && /gráficos 3D/.test(e.texto) && /WebGL/i.test(e.linea), e);
  } },
  // tarda demasiado: se ofrece probar de nuevo, pero sigue cargando
  lenta: { arma: async (pag) => { await pag.addInitScript(() => { window.cargaEspera = 4; }); await pag.route(/src\/main\.js/, async (r) => { await new Promise((x) => setTimeout(x, 9000)); await r.continue(); }); }, mira: async (pag) => {
    await pag.waitForFunction(() => document.documentElement.classList.contains('carga-lenta'), null, { timeout: 20000 }).catch(() => {});
    const e = await leer(pag);
    console.log('     ' + e.texto + '\n     ' + e.linea);
    if (conFotos) await pag.screenshot({ path: 'out/fallo-lenta' + (movil ? '-cel' : '') + '.png' });
    ver('lenta: avisa que tarda, con codigo T0 y los botones, sin dar la carga por fallada', e.codigo === 'T0' && /Código T0/.test(e.linea) && /tardando más de lo normal/.test(e.nota) && e.otra && !e.clase.includes('carga-fallo') && /Cargando/.test(e.texto), e);
    await pag.waitForFunction(() => !document.documentElement.classList.contains('cargando'), null, { timeout: 90000 }).catch(() => {});
    const d = await pag.evaluate(() => ({ cargando: document.documentElement.classList.contains('cargando'), seVe: getComputedStyle(document.getElementById('carga')).display, largar: !document.getElementById('largar').disabled }));
    ver('lenta: cuando termina de cargar, el cartel se va', !d.cargando && d.seVe === 'none' && d.largar, d);
  } },
  // el boton copia el detalle completo
  detalle: { arma: (pag) => pag.route(/src\/carteleria\.js/, (r) => r.abort('blockedbyclient')), mira: async (pag) => {
    await esperarFalla(pag);
    await pag.click('#cargaDetalle');
    await pag.waitForTimeout(500);
    const copiado = await pag.evaluate(() => navigator.clipboard.readText()).catch((x) => 'NO SE PUDO LEER: ' + x.message), boton = await pag.textContent('#cargaDetalle');
    console.log(copiado.split('\n').map((l) => '     | ' + l).join('\n'));
    ver('detalle: se copia, y el boton lo dice', /Copiado/.test(boton), boton);
    ver('detalle: trae el codigo, el archivo, el paso, la direccion, el navegador y el aparato', /Código R0/.test(copiado) && /carteleria\.js: no bajó, ahora sin respuesta/.test(copiado) && /Paso 0/.test(copiado) && /Dirección: \//.test(copiado) && /Navegador: Mozilla/.test(copiado) && /Aparato: pantalla \d+x\d+/.test(copiado) && /gráficos 3D/.test(copiado), copiado.slice(0, 300));
    ver('detalle: no trae nada del link (ni la pasada ni el codigo de un club)', !/#r=|#club=/.test(copiado));
  } },
  // sin permiso para copiar: el detalle queda a la vista
  amano: { arma: async (pag) => { await pag.addInitScript(() => { Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true }); }); await pag.route(/src\/carteleria\.js/, (r) => r.abort('blockedbyclient')); }, mira: async (pag) => {
    await esperarFalla(pag);
    await pag.click('#cargaDetalle');
    await pag.waitForTimeout(400);
    const d = await pag.evaluate(() => { const c = document.getElementById('cargaTodo'); return { visible: !c.hidden, largo: c.value.length, marcado: c.selectionEnd - c.selectionStart, boton: document.getElementById('cargaDetalle').textContent, entra: c.getBoundingClientRect().bottom <= innerHeight + 1 || document.getElementById('portada').scrollHeight > innerHeight }; });
    if (conFotos) await pag.screenshot({ path: 'out/fallo-amano' + (movil ? '-cel' : '') + '.png' });
    ver('amano: el detalle aparece en la pantalla, ya marcado para copiar', d.visible && d.largo > 200 && d.marcado === d.largo && /Copialo/.test(d.boton), d);
  } },
};
for (const nombre in CASOS) {
  if (cual !== 'todo' && cual !== nombre) continue;
  const j = await abrir({ ...forma, sinEsperar: true, antes: (pag) => CASOS[nombre].arma(pag) });
  await j.pag.waitForSelector('#cargaTexto', { timeout: 15000 }).catch(() => {});
  await CASOS[nombre].mira(j.pag, j);
  if (conFotos && !['lenta', 'amano', 'normal'].includes(nombre)) await j.pag.screenshot({ path: 'out/fallo-' + nombre + (movil ? '-cel' : '') + '.png' });
  await j.cerrar();
}
console.log(mal ? '\n' + mal + ' COSAS MAL' : '\ntodo bien');
process.exit(mal ? 1 : 0);

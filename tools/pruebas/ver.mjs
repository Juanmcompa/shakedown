// Abre el juego en un navegador sin pantalla y saca capturas.
// uso: node tools/pruebas/ver.mjs <nombre> [acciones...]
//   p=3         que pista abrir (va primero)        tam=1280x720   tamaño de la ventana (va primero)
//   dia=6       hace de cuenta que hoy es el dia de la pista 6 (va primero)
//   portada     captura de la portada               largar         empieza la pasada y saltea la cuenta regresiva
//   ir=400      lleva el auto al metro 400          cam=1          cambia de camara (ya acomodada)
//   espera=800  espera (milisegundos)               foto           saca una captura
//   zoom=3      recorte del centro, ampliado        tecla=KeyW:1500  aprieta una tecla un rato
//   js=...      corre algo en la pagina y muestra lo que devuelve
//   vel=20      le da velocidad al auto (m/s)       rapido=20      deja la camara como si fuera a esa velocidad
//   limpio      saca los carteles del medio          auto=kacito    elige el auto (antes de largar)
//   movil       como un celular (va primero)         sensor         con sensor de inclinacion (antes de largar)
//   toca=#id    toca un elemento                     aprieta=.clase deja apretado un boton
// (el juego abre en el inicio: 'largar' larga la pista de hoy. Las ayudas largarDesdeHome e irACard, exportadas mas abajo,
//  sirven para las pruebas que van por los modos como quien juega.)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
// Playwright y sharp: los instalados en esta compu (npm i playwright sharp), o los de la maquina de Claude
function traer(nombre) {
  const req = createRequire(import.meta.url);
  try { return req(nombre); } catch (e) { return req('/opt/npm-tools/node_modules/' + nombre); }
}
const { chromium } = traer('playwright');
const sharp = traer('sharp');

const RAIZ = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..'), TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
export async function abrir(opciones = {}) {
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
    const f = path.join(RAIZ, p);
    if (!f.startsWith(RAIZ) || !fs.existsSync(f)) { res.writeHead(404); res.end('no'); return; }
    res.writeHead(200, { 'content-type': TIPOS[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' }); res.end(fs.readFileSync(f));
  });
  await new Promise((r) => srv.listen(0, r));
  const base = 'http://127.0.0.1:' + srv.address().port + '/';
  const nav = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
  const ctx = await nav.newContext({ viewport: { width: opciones.ancho || 1280, height: opciones.alto || 720 }, ...(opciones.contexto || {}) });
  // dia: hace de cuenta que hoy es el dia de esa pista (corre el reloj de la pagina)
  // Las pruebas son de alguien que ya vio el tutorial de la primera vez y la guia de la Travesia (si no, se abren y el auto no arranca).
  // Con "nuevo: true" queda como alguien que entra por primera vez.
  // (opciones.gustos: otros gustos de arranque, por ejemplo { vistaTabla: '' } para ver la tabla de amigos y no la de todos)
  if (!opciones.nuevo) await ctx.addInitScript((mas) => { try { if (!localStorage.getItem('shakedown')) localStorage.setItem('shakedown', JSON.stringify({ gustos: { tutorial: 1, travesiaGuia: 1, ...mas } })); } catch (e) { /* sin memoria */ } }, opciones.gustos || {});
  if (opciones.dia) await ctx.addInitScript((dias) => { const ahora = Date.now, corre = dias * 86400000; Date.now = () => ahora() + corre; }, opciones.dia - 1);
  const pag = await ctx.newPage();
  // (con varios navegadores a la vez y graficos por software, una captura o una recarga pueden tardar mas de 30 s)
  pag.setDefaultTimeout(opciones.demora || 90000);
  const errores = [];
  pag.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errores.push(m.type() + ': ' + m.text()); });
  pag.on('pageerror', (e) => errores.push('pageerror: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
  await pag.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  const t0 = Date.now();
  if (opciones.antes) await opciones.antes(pag, ctx);
  // Las pruebas no tocan el servidor publicado: si la ruta no dice con que servidor probar, van sin ninguno
  // ("?servidor=" vacio, que el juego acepta solo desde una copia local).
  const ruta = opciones.ruta || '', [antes, ...resto] = ruta.split('#');
  const final = /[?&]servidor=/.test(ruta) ? ruta : antes + (antes.includes('?') ? '&' : '?') + 'servidor=' + (resto.length ? '#' + resto.join('#') : '');
  await pag.goto(base + final, opciones.sinEsperar ? { waitUntil: 'commit' } : undefined);
  const cargo = opciones.sinEsperar ? false : await pag.waitForFunction(() => window.shakedown, null, { timeout: opciones.espera || 60000 }).then(() => true).catch(() => false);
  return { srv, nav, ctx, pag, errores, base, cargo, ms: Date.now() - t0, cerrar: async () => { await nav.close(); srv.close(); } };
}

// --- el inicio: la pista cargada y la fila de modos (cada modo abre un panel con su lista) ---
// El numero de pista de cada circuito, y en que modo (panel) esta cada uno.
export const PISTA_DE = { hoy: null, subida: 16001, bajada: 16002, urbano: 16003, practica: 16004, giulio: 16005, montana: 16006 };
export const CARD_DE = { hoy: 'hoy', subida: 'oficiales', bajada: 'oficiales', urbano: 'oficiales', practica: 'oficiales', giulio: 'reales', montana: 'reales', travesia: 'travesia', tutorial: 'tutorial', comunidad: 'comunidad' };
const PANEL_DE = { oficiales: 'circuitos', reales: 'reales', travesia: 'travesia', tutorial: 'tutorial', comunidad: 'comunidad', pasadas: 'pasadas' };
const BOTON_DE = { hoy: '#largar', travesia: '#largarTravesia', tutorial: '#largarTutorial' };
// Abre el panel de un modo tocando su boton de la fila (clave: hoy = cerrar lo que este abierto, oficiales, reales, travesia,
// tutorial, comunidad, pasadas). dedos: con el dedo.
export async function irACard(pag, clave, dedos) {
  const quiero = PANEL_DE[clave] || 'hoy';
  if (await pag.evaluate(() => document.getElementById('home').dataset.card) === quiero) return;
  if (quiero === 'hoy') { await (dedos ? pag.tap('#cerrarPanel') : pag.click('#cerrarPanel')); }
  else {
    if (await pag.evaluate(() => !document.getElementById('panel').hidden)) await (dedos ? pag.tap('#cerrarPanel') : pag.click('#cerrarPanel'));
    const boton = '#homeModos [data-panel="' + quiero + '"]';
    await (dedos ? pag.tap(boton) : pag.click(boton));
  }
  await pag.waitForFunction((c) => document.getElementById('home').dataset.card === c, quiero, { timeout: 15000 });
  await pag.waitForTimeout(100);
}
// Larga un modo desde el inicio, como lo haria quien juega: abre su panel y toca su boton. modo: hoy, subida, bajada, urbano,
// practica, giulio, montana, travesia o tutorial. Si hace falta cargar otra pista, el juego se recarga y arranca solo: aca se
// espera a que este corriendo (salvo travesia y tutorial: de esos se ocupa quien llama).
// Si la oficial pide el nombre (cartel con uno sugerido), lo acepta de un toque; si ya esta corriendo, no hace nada.
export async function aceptarNombre(pag, dedos) {
  await pag.waitForFunction(() => { const c = document.getElementById('cartelNombre'); return (c && !c.hidden) || (window.shakedown && window.shakedown.estado().pantalla === 'jugando'); }, null, { timeout: 120000 });
  if (await pag.evaluate(() => { const c = document.getElementById('cartelNombre'); return !!c && !c.hidden; })) await (dedos ? pag.tap('#cartelNombreListo') : pag.click('#cartelNombreListo'));
}
export async function largarDesdeHome(pag, modo, { dedos = false } = {}) {
  await irACard(pag, CARD_DE[modo], dedos);
  const boton = BOTON_DE[modo] || '[data-largar="c"][data-n="' + PISTA_DE[modo] + '"]';
  await (dedos ? pag.tap(boton) : pag.click(boton));
  if (modo === 'travesia' || modo === 'tutorial') return;
  // la oficial sin nombre pide uno en un cartel: se acepta el sugerido, como quien juega
  await pag.waitForFunction(() => { const c = document.getElementById('cartelNombre'); return (c && !c.hidden) || (window.shakedown && window.shakedown.estado().pantalla === 'jugando'); }, null, { timeout: 120000 });
  if (await pag.evaluate(() => { const c = document.getElementById('cartelNombre'); return !!c && !c.hidden; })) await (dedos ? pag.tap('#cartelNombreListo') : pag.click('#cartelNombreListo'));
  await pag.waitForFunction((n) => window.shakedown && window.shakedown.estado().pantalla === 'jugando' && (n === null || window.shakedown.estado().pista === n), PISTA_DE[modo], { timeout: 120000 });
}

if (process.argv[1].endsWith('ver.mjs')) {
  const args = process.argv.slice(2), nombre = args.shift() || 'captura';
  let W = 1280, H = 720, pista = '', dia = 0;
  for (const a of args) { if (a.startsWith('tam=')) [W, H] = a.slice(4).split('x').map(Number); if (a.startsWith('p=')) pista = a.slice(2); if (a.startsWith('dia=')) dia = Number(a.slice(4)); }
  const movil = args.includes('movil');   // como un celular: pantalla tactil y el doble de pixeles
  const j = await abrir({ ancho: W, alto: H, dia, ruta: pista ? '?p=' + pista + '&futuro' : '', contexto: movil ? { hasTouch: true, isMobile: true, deviceScaleFactor: 2 } : {} });
  const { pag, errores } = j;
  if (!j.cargo) { console.log('NO CARGO. Errores:\n' + errores.join('\n')); await j.cerrar(); process.exit(1); }
  console.log('cargo en', j.ms, 'ms');
  let n = 0;
  const foto = async () => { const f = 'out/' + nombre + (n ? '-' + n : '') + '.png'; n++; await pag.screenshot({ path: f }); console.log('captura', f); };
  for (const a of args) {
    const k = a.split('=')[0], v = a.slice(k.length + 1);
    if (k === 'tam' || k === 'p' || k === 'dia' || k === 'movil') continue;
    if (k === 'portada') { await pag.waitForTimeout(1500); await foto(); }
    else if (k === 'largar') { if (movil) await pag.tap('#largar'); else await pag.evaluate(() => window.shakedown.largar()); await pag.evaluate(() => window.shakedown.avanzar(3.2)); await pag.waitForTimeout(400); }
    else if (k === 'ir') await pag.evaluate((i) => window.shakedown.ir(i), Number(v));
    else if (k === 'vel') await pag.evaluate((v) => { const c = window.shakedown.auto(); c.vel[0] = c.adelante[0] * v; c.vel[2] = c.adelante[2] * v; }, Number(v));
    else if (k === 'cam') {
      // cambia de camara y la deja ya acomodada (sin esperar a que llegue despacio)
      for (let i = 0; i < Number(v); i++) await pag.keyboard.press('KeyC');
      await pag.evaluate(async () => {
        const { CAMARAS } = await import('/src/config.js'); const e = window.shakedown.camara.estado, m = CAMARAS[e.modo];
        e.dist = m.dist[0] * e.cerca; e.alto = m.alto[0]; e.fov = Math.min(e.parada && m.fovParado ? m.fovParado : 56, 2 * Math.atan(Math.tan(m.fov * Math.PI / 360) * e.ancha) * 180 / Math.PI); e.listo = false;
      });
      await pag.waitForTimeout(900);
    }
    else if (k === 'rapido') {
      await pag.evaluate(async (v) => {
        const { CAMARAS } = await import('/src/config.js'); const e = window.shakedown.camara.estado, m = CAMARAS[e.modo], r = Math.min(1, v / 22);
        e.dist = (m.dist[0] + (m.dist[1] - m.dist[0]) * r) * e.cerca; e.alto = m.alto[0] + (m.alto[1] - m.alto[0]) * r; e.listo = false;
      }, Number(v));
    }
    else if (k === 'zoom') {
      const z = Number(v || 3), w = Math.round(W / z), h = Math.round(H / z), f = 'out/' + nombre + '-zoom' + (n ? '-' + n : '') + '.png'; n++;
      const buf = await pag.screenshot({ clip: { x: Math.round((W - w) / 2), y: Math.round((H - h) / 2), width: w, height: h } });
      await sharp(buf).resize(w * z, h * z, { kernel: 'nearest' }).toFile(f); console.log('captura', f);
    }
    else if (k === 'tecla') { const [t, ms] = v.split(':'); for (const x of t.split('+')) await pag.keyboard.down(x); await pag.waitForTimeout(Number(ms)); for (const x of t.split('+')) await pag.keyboard.up(x); }
    else if (k === 'espera') await pag.waitForTimeout(Number(v));
    else if (k === 'limpio') await pag.addStyleTag({ content: '#grande, #aviso { display: none !important; }' });   // saca los carteles del medio (y que no vuelvan)
    else if (k === 'auto') await pag.evaluate((id) => document.querySelector('[data-auto="' + id + '"]').click(), v);
    else if (k === 'sensor') await pag.evaluate((g) => { setInterval(() => window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', { alpha: 0, beta: 40, gamma: g })), 100); }, Number(v || 6));   // hace de cuenta que el celular tiene sensor de inclinacion (va antes de largar)
    else if (k === 'toca') await pag.tap(v);          // toca un elemento (selector CSS)
    else if (k === 'aprieta') await pag.dispatchEvent(v, 'pointerdown', { pointerId: 7, pointerType: 'touch', isPrimary: true, bubbles: true });   // deja apretado un boton
    else if (k === 'sim') { const [seg, x, y, mano] = v.split(':').map(Number); await pag.evaluate(([seg, x, y, mano]) => window.shakedown.simular(seg, x || 0, y === undefined ? 1 : y, !!mano), [seg, x, y, mano]); }   // maneja "seg" segundos con volante x y pedal y (sim=3:0:1)
    else if (k === 'piloto') {   // un piloto automatico maneja "seg" segundos (piloto=6:bueno), con la camara y los efectos siguiendolo
      const [seg, nombre] = v.split(':');
      const r = await pag.evaluate(async ([seg, nombre]) => {
        const { decidir, PILOTOS } = await import('/tools/piloto.mjs'), { crearReferencia } = await import('/src/referencia.js'), { JUEGO } = await import('/src/config.js'), { azar } = await import('/src/noise.js');
        const s = window.shakedown, c = s.auto(), p = s.partida, o = PILOTOS[nombre || 'bueno'], ref = crearReferencia(s.T, c.datos), rnd = azar(7), ent = { x: 0, y: 0, mano: false }, m = {}, DT = JUEGO.paso;
        let t = 0, prox = 0, pasos = 0;
        while (t < seg && p.estado === 'corriendo') {
          if (t >= prox) { prox = t + o.reaccion * (0.7 + 0.6 * rnd()); decidir(s.T, ref, c, p, o, m, rnd, t, ent); }
          if (o.teclas && t > m.hasta && !(t < m.atras)) ent.x = 0;
          c.paso(ent, DT); t += DT;
          if (++pasos % 2 === 0) { s.avanzar(DT * 2); s.fx.actualizar(c, DT * 2); s.camara.seguir(c, DT * 2); }
        }
        return { indice: p.indice, kmh: Math.round(c.velocidad * 3.6) };
      }, [Number(seg), nombre]);
      console.log('piloto:', JSON.stringify(r));
    }
    else if (k === 'ayudado') {   // con la ayuda de manejo prendida: acelera a fondo "seg" segundos, con el volante en x (ayudado=8:0 = sin manos)
      const [seg, x] = v.split(':').map(Number);
      const r = await pag.evaluate(async ([seg, x]) => {
        const { JUEGO } = await import('/src/config.js');
        const s = window.shakedown, c = s.auto(), p = s.partida, P = s.T.camino, ent = { x: 0, y: 1, mano: false }, DT = JUEGO.paso;
        let t = 0, pasos = 0, peor = 0, afuera = 0;
        while (t < seg && p.estado === 'corriendo') {
          ent.x = x || 0; ent.y = 1;
          s.ayuda.aplicar(c, p.indice, p.lejos, ent);
          c.paso(ent, DT); t += DT;
          if (++pasos % 2 === 0) { s.avanzar(DT * 2); s.fx.actualizar(c, DT * 2); s.camara.seguir(c, DT * 2); }
          const i = p.indice, lado = (c.pos[2] - P.Z[i]) * P.HX[i] - (c.pos[0] - P.X[i]) * P.HZ[i];
          peor = Math.max(peor, Math.abs(lado - s.ref.corre[i])); if (p.lejos > 0) afuera += DT;
        }
        return { indice: p.indice, kmh: Math.round(c.velocidad * 3.6), lejosDeLaTrazada: +peor.toFixed(2), afuera: +afuera.toFixed(2), vueltas: p.vueltas, estado: p.estado };
      }, [seg, x]);
      console.log('ayudado:', JSON.stringify(r));
    }
    else if (k === 'foto') await foto();
    else if (k === 'js') console.log('js:', JSON.stringify(await pag.evaluate(v)));
  }
  if (!n) { await pag.waitForTimeout(1200); await foto(); }
  const fps = await pag.evaluate(() => new Promise((r) => { let c = 0; const t = performance.now(); const f = () => { c++; if (performance.now() - t > 2000) r(c / 2); else requestAnimationFrame(f); }; requestAnimationFrame(f); }));
  console.log('cuadros por segundo (sin placa de video):', fps.toFixed(1), '| estado', JSON.stringify(await pag.evaluate(() => window.shakedown.estado())));
  console.log(errores.length ? 'ERRORES:\n' + [...new Set(errores)].join('\n') : 'sin errores en consola');
  await j.cerrar();
}

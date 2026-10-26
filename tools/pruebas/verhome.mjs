// El inicio: las cards que se deslizan (una por modo). Revisa que al abrir se vea el inicio y no empiece la carrera; que se pase
// por las seis cards (con el dedo en el celular y con las flechas en la compu); que cada boton lleve a su modo; que "volver" al
// terminar lleve al inicio; que un link de un amigo (#r=, #t=) abra en la card que corresponde; y que la primera vez abra en la
// mision tutorial. Deja capturas en out/ (home-celu-1, home-celu-2, home-celu-travesia, home-compu).
// uso: node tools/pruebas/verhome.mjs
import { abrir, irACard, largarDesdeHome, deslizar, quieta } from './ver.mjs';
let mal = 0;
const ver = (que, si, detalle) => { console.log((si ? '  ok  ' : '  MAL ') + que + (si || detalle === undefined ? '' : ' -> ' + JSON.stringify(detalle))); if (!si) mal++; };
const ORDEN = ['hoy', 'oficiales', 'reales', 'travesia', 'tutorial', 'comunidad'];
const dedos = { hasTouch: true, isMobile: true, deviceScaleFactor: 2 };
const card = (pag) => pag.evaluate(() => document.getElementById('home').dataset.card);
const estado = (pag) => pag.evaluate(() => window.shakedown.estado());
const visible = (pag, sel) => pag.evaluate((sel) => { const e = document.querySelector(sel); if (!e || e.hidden) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; }, sel);
// la card que esta al medio, entera adentro de la pantalla en horizontal (no a medias)
const alMedio = async (pag) => { await quieta(pag); return pag.evaluate(() => { const c = document.querySelector('.card.aca').getBoundingClientRect(); return Math.abs((c.left + c.right) / 2 - innerWidth / 2) < 6 && c.top >= 0 && c.bottom <= innerHeight + 1; }); };
const esperarCard = (pag, clave) => pag.waitForFunction((c) => document.getElementById('home').dataset.card === c, clave, { timeout: 15000 }).then(() => true).catch(() => false);
// corre una pasada con el piloto automatico desde cerca de la meta (llega rapido) y espera el resultado
const llegar = async (pag) => {
  const r = await pag.evaluate(async () => {
    const { decidir, PILOTOS } = await import('/tools/piloto.mjs'), { crearReferencia } = await import('/src/referencia.js'), { JUEGO } = await import('/src/config.js'), { azar } = await import('/src/noise.js');
    const s = window.shakedown, DT = JUEGO.paso, o = PILOTOS.bueno, c = s.auto(), p = s.partida, ref = crearReferencia(s.T, c.datos), rnd = azar(7), ent = { x: 0, y: 0, mano: false }, m = {};
    s.avanzar(3.3);
    s.ir(Math.max(0, s.T.camino.n - 90));
    let t = 0, prox = 0, pasos = 0;
    while (t < 120 && p.estado === 'corriendo') {
      if (t >= prox) { prox = t + o.reaccion * (0.7 + 0.6 * rnd()); decidir(s.T, ref, c, p, o, m, rnd, t, ent); }
      if (o.teclas && t > m.hasta && !(t < m.atras)) ent.x = 0;
      c.paso(ent, DT); t += DT;
      if (++pasos % 2 === 0) s.avanzar(DT * 2);
    }
    s.saltearEspera();
    return s.estado().estado;
  });
  await pag.waitForFunction(() => !document.getElementById('fin').hidden, null, { timeout: 60000 }).catch(() => {});
  return r;
};

// ---------- 1: en la compu ----------
const a = await abrir({ ancho: 1280, alto: 720 });
if (!a.cargo) { console.log('NO CARGO\n' + a.errores.join('\n')); process.exit(1); }
const A = a.pag;
await A.waitForFunction(() => !document.documentElement.classList.contains('cargando'), null, { timeout: 90000 });
await A.waitForTimeout(1500);
let e = await estado(A);
ver('al abrir se ve el inicio, no la carrera', e.pantalla === 'portada' && e.estado === 'previa' && e.tiempo === 0 && await visible(A, '#home') && !(await visible(A, '#hud')), e);
ver('hay seis cards, en este orden: pista del dia, circuitos, reales, travesia, tutorial, comunidad', await A.evaluate((o) => [...document.querySelectorAll('.card')].map((c) => c.dataset.card).join() === o.join(), ORDEN));
ver('abre en la pista del dia, al medio', (await card(A)) === 'hoy' && await alMedio(A));
ver('la firma sigue en el inicio', await A.evaluate(() => /Desarrollado por Juan M\. Comparini/.test(document.getElementById('firma').textContent) && document.getElementById('firma').getBoundingClientRect().height > 0));
ver('arriba estan el auto y los botones de siempre (tabla, pasadas, ayuda, configuracion)', await A.evaluate(() => !!document.getElementById('miAuto').textContent.trim() && ['tabla', 'pasadas', 'ayuda', 'ajustes'].every((p) => document.querySelector('[data-panel="' + p + '"]').getBoundingClientRect().width > 0)));
await A.screenshot({ path: 'out/home-compu.png' });
// con el teclado: izquierda y derecha
const recorrido = [];
for (let k = 0; k < 5; k++) { await A.keyboard.press('ArrowRight'); await esperarCard(A, ORDEN[k + 1]); recorrido.push(await card(A)); }
ver('con la flecha derecha se pasa por las seis cards', recorrido.join() === ORDEN.slice(1).join(), recorrido);
await A.keyboard.press('ArrowRight'); await A.waitForTimeout(400);
ver('en la ultima, la flecha derecha no pasa de largo', (await card(A)) === 'comunidad' && await alMedio(A));
for (let k = 4; k >= 0; k--) { await A.keyboard.press('ArrowLeft'); await esperarCard(A, ORDEN[k]); }
ver('con la izquierda se vuelve a la primera', (await card(A)) === 'hoy');
await A.click('#homeAdelante'); await esperarCard(A, 'oficiales');
ver('los botones de los costados tambien pasan de card', (await card(A)) === 'oficiales');
await A.click('#homeAtras'); await esperarCard(A, 'hoy');
await A.click('#homePuntos [data-punto="travesia"]'); await esperarCard(A, 'travesia');
ver('los puntitos llevan a la card tocada y marcan en cual se esta', (await card(A)) === 'travesia' && await A.evaluate(() => document.querySelector('#homePuntos .punto.aca').dataset.punto === 'travesia' && document.querySelectorAll('#homePuntos .punto').length === 6));
await irACard(A, 'hoy');

// que dice cada card
await A.evaluate(() => {
  const c = window.shakedown.club;
  c.anotarAmigo({ nombre: 'Caro', t: 118, s: [23, 23, 24, 24, 24], c: 'vvvvv', auto: 'kacito', ab: '', vueltas: 0, roto: 0, practica: false });
  c.anotarAmigo({ nombre: 'Beto', t: 120.5, s: [24, 24, 24, 24, 24.5], c: 'vvavv', auto: 'vitarita', ab: '', vueltas: 0, roto: 0, practica: false });
  c.anotarAmigo({ nombre: 'Lola', t: 125, s: [25, 25, 25, 25, 25], c: 'vaavv', auto: 'vitarita', ab: '', vueltas: 0, roto: 0, practica: false });
  c.anotarAmigo({ nombre: 'Tito', t: 131, s: [26, 26, 26, 26, 26], c: 'aaavv', auto: 'vitarita', ab: '', vueltas: 0, roto: 0, practica: false });
  c.anotarAmigoTravesia({ nombre: 'Ana', km: 23.47 }); c.anotarAmigoTravesia({ nombre: 'Bruno', km: 12.1 }); c.anotarAmigoTravesia({ nombre: 'Cleo', km: 8.3 }); c.anotarAmigoTravesia({ nombre: 'Dani', km: 3.2 });
});
await A.evaluate(() => window.shakedown.ajustar('trazada', window.shakedown.gusto('trazada')));   // (repinta el inicio)
const hoyTxt = await A.evaluate(() => [...document.querySelectorAll('#hoyTiempos li')].map((li) => li.innerText.replace(/\s+/g, ' ').trim()));
ver('la pista del dia muestra los tres primeros de tus amigos (nombre, auto y tiempo) y no al cuarto', hoyTxt.length === 4 && /^1 \S+ Caro323 01:58:00/.test(hoyTxt[0]) && /^2 \S+ Beto333 02:00:50/.test(hoyTxt[1]) && /^3 \S+ Lola/.test(hoyTxt[2]) && !hoyTxt.join().includes('Tito'), hoyTxt);
ver('y, como todavia no corriste, "te falta tu pasada"', /Te falta tu pasada/.test(hoyTxt[3]), hoyTxt);
ver('con el numero, el nombre y los datos de la pista (clima, lugar, kilometros)', await A.evaluate(() => /^#\d+$/.test(document.getElementById('pistaNumero').textContent) && document.getElementById('pistaNombre').textContent.length > 3 && /km/.test(document.getElementById('pistaDatos').textContent) && document.querySelectorAll('#pistaDatos .dato').length === 4));
ver('el boton grande dice Largar', await A.evaluate(() => /Largar/.test(document.getElementById('largar').textContent) && document.getElementById('largar').getBoundingClientRect().height > 40));
await irACard(A, 'oficiales');
const ofi = await A.evaluate(() => [...document.querySelectorAll('#circuitos li')].map((li) => li.innerText.replace(/\s+/g, ' ').trim()));
ver('los circuitos oficiales: Subida, Bajada, Urbano y Practica, cada uno con su tiempo (o rayita)', ofi.length === 4 && /Subida/.test(ofi[0]) && /Bajada/.test(ofi[1]) && /Urbano/.test(ofi[2]) && /Práctica/.test(ofi[3]) && ofi.every((x) => /—|\d\d:\d\d/.test(x)), ofi);
await irACard(A, 'reales');
const rea = await A.evaluate(() => [...document.querySelectorAll('#catReales li')].map((li) => li.innerText.replace(/\s+/g, ' ').trim()));
ver('los reales: Giulio Cesare y, debajo, La Montaña del Sufrimiento', rea.length === 2 && /Giulio Cesare/.test(rea[0]) && /Montaña del Sufrimiento/.test(rea[1]), rea);
await irACard(A, 'travesia');
const tv = await A.evaluate(() => ({ record: document.getElementById('tvRecord').textContent, filas: [...document.querySelectorAll('#catAventura li')].map((li) => li.innerText.replace(/\s+/g, ' ').trim()), boton: document.getElementById('largarTravesia').textContent }));
ver('la travesia: tu record (o "sin record") y los tres primeros de tus amigos', /Sin récord/.test(tv.record) && tv.filas.length === 3 && /^1 .*Ana 23,5 km/.test(tv.filas[0]) && /Bruno/.test(tv.filas[1]) && /Cleo/.test(tv.filas[2]) && /Largar/.test(tv.boton), tv);
await irACard(A, 'tutorial');
ver('la mision tutorial: dice que es y tiene su boton (como este aparato ya la vio, "Repetir")', await A.evaluate(() => /Misión tutorial/.test(document.getElementById('tutTitulo').textContent) && /Repetir/.test(document.getElementById('largarTutorial').textContent)));
await irACard(A, 'comunidad');
ver('la comunidad: sin servidor no hay donde publicar, asi que no hay boton de crear (y dice que todavia no hay pistas)', await A.evaluate(() => document.getElementById('armarPista').hidden && !document.getElementById('comunidadVacia').hidden));
await irACard(A, 'hoy');

// ---------- 2: cada boton lleva a su modo ----------
await largarDesdeHome(A, 'hoy');
e = await estado(A);
ver('el boton de la pista del dia larga la pasada (la cuenta empieza)', e.pantalla === 'jugando', e);
ver('y el inicio se va', !(await visible(A, '#home')) && await visible(A, '#hud'));
const fin1 = await llegar(A);
ver('llega a la meta', fin1 === 'llegada', fin1);
ver('al terminar se ve el resultado', await visible(A, '#fin'));
await A.click('#salir');
await A.waitForTimeout(400);
e = await estado(A);
ver('"Volver" lleva al inicio, en la card de la pista del dia', e.pantalla === 'portada' && await visible(A, '#home') && (await card(A)) === 'hoy' && await alMedio(A), [e.pantalla, await card(A)]);
ver('y ahora el boton dice Practicar (la oficial ya esta hecha) y la card muestra tu tiempo', await A.evaluate(() => /Practicar/.test(document.getElementById('largar').textContent) && /Vos.*\d\d:\d\d/.test(document.querySelector('#hoyTiempos li.mio').innerText.replace(/\s+/g, ' '))), await A.evaluate(() => document.querySelector('#hoyTiempos').innerText));
// el link de lo que acaba de correr (un fantasma): lo usa mas abajo
await A.waitForFunction(() => { const o = window.shakedown.club.oficial(); return o && o.codigo; }, null, { timeout: 30000 });
const codigoHoy = await A.evaluate(() => window.shakedown.club.oficial().codigo);
// la mision tutorial
await largarDesdeHome(A, 'tutorial');
await A.waitForTimeout(800);
ver('el boton de la mision tutorial abre el tutorial (con el auto esperando en la largada)', await A.evaluate(() => !document.getElementById('tutorial').hidden && window.shakedown.partida.estado === 'previa' && window.shakedown.estado().pantalla === 'jugando'));
await A.click('#tutCerrar');
await A.waitForTimeout(500);
ver('y al cerrarlo se vuelve al inicio', (await estado(A)).pantalla === 'portada' && await visible(A, '#home') && (await card(A)) === 'tutorial');
// la travesia
await largarDesdeHome(A, 'travesia');
await A.waitForFunction(() => window.shakedown.travesia.estado().activa, null, { timeout: 90000 });
ver('el boton de la travesia entra a la Travesia', !(await visible(A, '#home')) && await visible(A, '#hud'));
await A.keyboard.press('Escape');
await A.waitForTimeout(800);
ver('y al salir se vuelve al inicio, en la card de la Travesia', await visible(A, '#home') && (await card(A)) === 'travesia' && await alMedio(A), await card(A));
await irACard(A, 'oficiales');
// un circuito oficial: hay que cargar esa pista; arranca sola
await largarDesdeHome(A, 'subida');
e = await estado(A);
ver('el boton de un circuito carga esa pista y larga solo (Subida: ' + e.pista + ')', e.pista === 16001 && e.pantalla === 'jugando', e);
ver('la direccion queda limpia (sin el "#largar")', await A.evaluate(() => !location.hash && /c=subida/.test(location.search)), await A.evaluate(() => location.href));
const finS = await llegar(A);
ver('Subida: llega a la meta', finS === 'llegada', finS);
await A.waitForFunction(() => { const o = window.shakedown.club.practica(); return o && o.codigo; }, null, { timeout: 30000 });
const codigoSubida = await A.evaluate(() => window.shakedown.club.practica().codigo);
await A.click('#salir');
await A.waitForTimeout(400);
ver('"Volver" desde Subida lleva al inicio, en la card de los circuitos, con tu tiempo', (await estado(A)).pantalla === 'portada' && (await card(A)) === 'oficiales' && await A.evaluate(() => /Subida.*\d\d:\d\d/.test(document.querySelector('#circuitos li').innerText.replace(/\s+/g, ' '))), [await card(A), await A.evaluate(() => document.querySelector('#circuitos li').innerText)]);
// un circuito real
await largarDesdeHome(A, 'giulio');
e = await estado(A);
ver('el boton de los reales carga Giulio Cesare y larga solo (' + e.pista + ')', e.pista === 16005 && e.pantalla === 'jugando', e);
await A.evaluate(() => window.shakedown.salir());
await A.waitForTimeout(400);
ver('y al volver, el inicio esta en la card de los reales', (await card(A)) === 'reales' && await visible(A, '#home'), await card(A));
ver('sin errores en la consola (compu)', a.errores.length === 0, [...new Set(a.errores)].slice(0, 3));
await a.cerrar();

// ---------- 3: links de un amigo ----------
// (a) la pasada de un amigo en la pista del dia
const b = await abrir({ ancho: 1280, alto: 720, ruta: '#r=' + codigoHoy });
await b.pag.waitForFunction(() => !document.documentElement.classList.contains('cargando'), null, { timeout: 90000 });
await b.pag.waitForTimeout(800);
ver('link de un amigo (#r=) en la pista del dia: abre en esa card, con el aviso de contra quien se corre', (await card(b.pag)) === 'hoy' && await visible(b.pag, '#desafio') && /^Contra .*\d\d:\d\d/.test(await b.pag.evaluate(() => document.getElementById('desafio').innerText)), [await card(b.pag), await b.pag.evaluate(() => document.getElementById('desafio').innerText)]);
await b.pag.click('#largar');
await b.pag.waitForFunction(() => window.shakedown.estado().pantalla === 'jugando', null, { timeout: 30000 });
ver('y un toque en Largar corre (la pasada del amigo es el rival)', (await estado(b.pag)).rival !== null, await estado(b.pag));
await b.cerrar();
// (b) la de un amigo en un circuito (Subida)
const c = await abrir({ ancho: 390, alto: 844, ruta: '#r=' + codigoSubida, contexto: dedos });
await c.pag.waitForFunction(() => !document.documentElement.classList.contains('cargando'), null, { timeout: 90000 });
await c.pag.waitForTimeout(800);
e = await estado(c.pag);
ver('link de un amigo en un circuito: la pista cargada es Subida y abre en la card de los circuitos, con el aviso', e.pista === 16001 && (await card(c.pag)) === 'oficiales' && await visible(c.pag, '#desafio') && await alMedio(c.pag), [e.pista, await card(c.pag)]);
await c.pag.tap('#circuitos a.aca');
await c.pag.waitForFunction(() => window.shakedown.estado().pantalla === 'jugando', null, { timeout: 30000 });
ver('un toque en Subida corre contra el fantasma', (await estado(c.pag)).rival !== null);
await c.cerrar();
// (c) el link de la Travesia de un amigo
const d = await abrir({ ancho: 390, alto: 844, ruta: '#t=Ana.2347', contexto: dedos });
await d.pag.waitForFunction(() => !document.documentElement.classList.contains('cargando'), null, { timeout: 90000 });
await d.pag.waitForTimeout(800);
ver('link de la Travesia (#t=): abre en la card de la Travesia, con el aviso y Ana en la lista', (await card(d.pag)) === 'travesia' && await visible(d.pag, '#cartelTv') && /Ana/.test(await d.pag.evaluate(() => document.getElementById('catAventura').innerText)) && await alMedio(d.pag), [await card(d.pag), await d.pag.evaluate(() => document.getElementById('cartelTvTexto').textContent)]);
await d.pag.screenshot({ path: 'out/home-celu-travesia.png' });
await d.pag.tap('#cartelTvIr');
await d.pag.waitForFunction(() => window.shakedown.travesia.estado().activa, null, { timeout: 90000 });
ver('y el aviso lleva a largar la Travesia', await visible(d.pag, '#hud'));
await d.cerrar();

// ---------- 4: en el celular, con el dedo ----------
const f = await abrir({ ancho: 390, alto: 844, contexto: dedos });
if (!f.cargo) { console.log('NO CARGO\n' + f.errores.join('\n')); process.exit(1); }
const F = f.pag;
await F.waitForFunction(() => !document.documentElement.classList.contains('cargando'), null, { timeout: 90000 });
await F.waitForTimeout(1500);
e = await estado(F);
ver('celular: al abrir se ve el inicio, no la carrera', e.pantalla === 'portada' && e.estado === 'previa' && await visible(F, '#home'), e);
ver('celular: la card del dia ocupa casi todo el ancho y la siguiente asoma', await F.evaluate(() => { const [c1, c2] = document.querySelectorAll('.card'), r1 = c1.getBoundingClientRect(), r2 = c2.getBoundingClientRect(); return r1.width > innerWidth * 0.75 && r2.left < innerWidth - 8 && r2.left > r1.right; }));
ver('celular: la firma esta y entra en pantalla', await F.evaluate(() => { const r = document.getElementById('firma').getBoundingClientRect(); return r.height > 0 && r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight; }));
await F.screenshot({ path: 'out/home-celu-1.png' });
const dedo = [];
for (let k = 0; k < 5; k++) {
  if (k === 0) {
    // a mitad del deslizamiento: el dedo apoyado, la fila a medio correr (la captura es de la segunda card llegando)
    const cdp = await F.context().newCDPSession(F);
    const y = 250, toca = (tipo, x) => cdp.send('Input.dispatchTouchEvent', { type: tipo, touchPoints: tipo === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
    await toca('touchStart', 330); for (const x of [300, 260, 220, 180]) { await toca('touchMove', x); await F.waitForTimeout(120); }
    await F.waitForTimeout(500);
    await F.screenshot({ path: 'out/home-celu-2.png' });
    for (const x of [150, 120, 90]) { await toca('touchMove', x); await F.waitForTimeout(80); }
    await toca('touchEnd', 90);
    await cdp.detach();
    await F.waitForTimeout(900);
  } else await deslizar(F, -260);
  dedo.push(await card(F));
}
ver('celular: deslizando con el dedo se pasa por las seis cards, cada una queda al medio', dedo.join() === ORDEN.slice(1).join() && await alMedio(F), dedo);
ver('celular: los puntitos marcan la ultima', await F.evaluate(() => document.querySelector('#homePuntos .punto.aca').dataset.punto === 'comunidad'));
for (let k = 0; k < 5; k++) await deslizar(F, 260);
ver('celular: deslizando para el otro lado se vuelve a la primera', (await card(F)) === 'hoy' && await alMedio(F), await card(F));
await F.tap('#largar');
await F.waitForFunction(() => window.shakedown.estado().pantalla === 'jugando', null, { timeout: 30000 });
ver('celular: el boton grande larga (con el dedo)', await visible(F, '#hud') && !(await visible(F, '#home')));
ver('sin errores en la consola (celular)', f.errores.length === 0, [...new Set(f.errores)].slice(0, 3));
await f.cerrar();

// ---------- 5: la primera vez ----------
const g = await abrir({ ancho: 1280, alto: 720, nuevo: true });
await g.pag.waitForFunction(() => !document.documentElement.classList.contains('cargando'), null, { timeout: 90000 });
await g.pag.waitForTimeout(800);
ver('la primera vez, el inicio abre en la mision tutorial', (await card(g.pag)) === 'tutorial' && await alMedio(g.pag) && /Empezar/.test(await g.pag.evaluate(() => document.getElementById('largarTutorial').textContent)), await card(g.pag));
await g.pag.click('#largarTutorial');
await g.pag.waitForTimeout(900);
ver('y su boton abre el tutorial', await g.pag.evaluate(() => !document.getElementById('tutorial').hidden));
await g.cerrar();

console.log(mal ? '\n' + mal + ' COSAS MAL' : '\ntodo bien');
process.exit(mal ? 1 : 0);

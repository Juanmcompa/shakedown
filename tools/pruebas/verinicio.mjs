// El inicio: la pista del dia protagonista (nombre, clima, km, boton grande de Largar) con la tabla de tiempos debajo, y una fila
// de modos con icono y palabra (Pistas anteriores, Circuitos, Reales, Travesia, Tutorial, Comunidad). Cada modo abre una lista simple.
// Revisa que: al abrir se vea el inicio y no empiece la carrera; "Pistas anteriores" sea obvio (visible, con ese nombre) y abra la lista
// con ayer; cada boton lleve a su modo; elegir una pista distinta de la cargada vaya directo a la largada sin mostrar el menu de nuevo
// (se ve "Cargando <pista>..." y la pasada empieza sola, tambien con el permiso del sensor de un iPhone); "Volver" lleve al inicio; que
// un link de un amigo (#r=, #t=) abra donde corresponde; y que en celulares chicos entren la pista, Largar y Pistas anteriores.
// Capturas en out/: inicio-compu, inicio-celu, inicio-320, inicio-anteriores, inicio-travesia.
// uso: node tools/pruebas/verinicio.mjs
import { abrir, irACard, largarDesdeHome, aceptarNombre } from './ver.mjs';
let mal = 0;
const ver = (que, si, detalle) => { console.log((si ? '  ok  ' : '  MAL ') + que + (si || detalle === undefined ? '' : ' -> ' + JSON.stringify(detalle))); if (!si) mal++; };
const dedos = { hasTouch: true, isMobile: true, deviceScaleFactor: 2 };
const modo = (pag) => pag.evaluate(() => document.getElementById('home').dataset.card);
const estado = (pag) => pag.evaluate(() => window.shakedown.estado());
const visible = (pag, sel) => pag.evaluate((sel) => { const e = document.querySelector(sel); if (!e || e.hidden) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; }, sel);
// el elemento entero adentro de la pantalla, sin scroll
const entero = (pag, sel) => pag.evaluate((sel) => { const e = document.querySelector(sel); if (!e) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.left >= -0.5 && r.right <= innerWidth + 0.5 && r.top >= -0.5 && r.bottom <= innerHeight + 0.5; }, sel);
const listo = (pag) => pag.waitForFunction(() => !document.documentElement.classList.contains('cargando'), null, { timeout: 90000 });
// anota, en cada cuadro y en toda recarga, si el menu del inicio se llego a ver (y que decia el cartel "Cargando <pista>")
const espiarMenu = (ctxAntes) => ctxAntes.addInitScript(() => {
  let vieneDeLargar = location.hash === '#largar';   // (solo cuenta la pagina que se abrio al elegir otra pista; la anterior, con su menu, no)
  const mirar = () => {
    try {
      const h = document.documentElement, p = document.getElementById('portada'), y = document.getElementById('yendo');
      if (h.classList.contains('jugando')) vieneDeLargar = false;   // (ya largo: lo que pase despues, como volver al inicio, no cuenta)
      if (vieneDeLargar && p && !p.hidden && getComputedStyle(p).visibility !== 'hidden' && !h.classList.contains('cargando') && !h.classList.contains('jugando') && !h.classList.contains('yendo')) sessionStorage.setItem('__menuVisto', '1');
      if (y && getComputedStyle(y).display !== 'none') sessionStorage.setItem('__yendoVisto', document.getElementById('yendoTexto').textContent);
    } catch (e) { /* sin memoria */ }
    requestAnimationFrame(mirar);
  };
  requestAnimationFrame(mirar);
});
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
const a = await abrir({ ancho: 1280, alto: 720, antes: async (pag) => { await espiarMenu(pag.context()); } });
if (!a.cargo) { console.log('NO CARGO\n' + a.errores.join('\n')); process.exit(1); }
const A = a.pag;
await listo(A);
await A.waitForTimeout(1500);
let e = await estado(A);
ver('al abrir se ve el inicio, no la carrera', e.pantalla === 'portada' && e.estado === 'previa' && e.tiempo === 0 && await visible(A, '#home') && !(await visible(A, '#hud')), e);
ver('no hay cards que se deslizan (ni fila, ni puntitos)', await A.evaluate(() => !document.querySelector('.card, #homePista, #homePuntos, .home-flecha')));
ver('la pista del dia es la protagonista: nombre grande, datos (clima, km) y el boton Largar enorme', await A.evaluate(() => {
  const n = document.getElementById('pistaNombre'), l = document.getElementById('largar'), r = l.getBoundingClientRect();
  return n.textContent.length > 3 && parseFloat(getComputedStyle(n).fontSize) >= 34 && /km/.test(document.getElementById('pistaDatos').textContent) && /Largar/.test(l.textContent) && r.height >= 54 && r.width >= 300;
}));
ver('la firma sigue en el inicio', await A.evaluate(() => /Desarrollado por Juan M\. Comparini/.test(document.getElementById('firma').textContent) && document.getElementById('firma').getBoundingClientRect().height > 0));
ver('arriba estan el auto y los botones de siempre (tabla, ayuda, configuracion)', await A.evaluate(() => !!document.getElementById('miAuto').textContent.trim() && ['tabla', 'ayuda', 'ajustes'].every((p) => document.querySelector('.solapas [data-panel="' + p + '"]').getBoundingClientRect().width > 0)));
const modos = await A.evaluate(() => [...document.querySelectorAll('#homeModos .modo')].map((b) => ({ txt: b.innerText.replace(/\s+/g, ' ').trim(), icono: !!b.querySelector('img.icono'), vis: b.getBoundingClientRect().width > 0 })));
ver('la fila de modos: icono y palabra en cada uno, en este orden', modos.map((m) => m.txt).join() === 'Pistas anteriores,Circuitos,Reales,Travesía,Tutorial,Comunidad' && modos.every((m) => m.icono && m.vis), modos);
ver('"Pistas anteriores" es obvio: boton amarillo y a la vista, con ese nombre', await A.evaluate(() => { const b = document.querySelector('#homeModos [data-panel="pasadas"]'), r = b.getBoundingClientRect(); return /Pistas anteriores/.test(b.textContent) && getComputedStyle(b).backgroundColor === 'rgb(242, 194, 0)' && r.height >= 40 && r.bottom <= innerHeight; }));
await A.screenshot({ path: 'out/inicio-compu.png' });
// los tiempos del dia: los de amigos y el tuyo
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
ver('debajo de la pista, la tabla del dia con los tiempos de tus amigos (nombre, auto y tiempo)', hoyTxt.length === 5 && /^1 \S+ Caro323 01:58:00/.test(hoyTxt[0]) && /^2 \S+ Beto333 02:00:50/.test(hoyTxt[1]) && /^3 \S+ Lola/.test(hoyTxt[2]) && /^4 \S+ Tito/.test(hoyTxt[3]), hoyTxt);
ver('y, como todavia no corriste, "te falta tu pasada"', /Te falta tu pasada/.test(hoyTxt[4]), hoyTxt);
// Pistas anteriores
await irACard(A, 'pasadas');
const pas = await A.evaluate(() => [...document.querySelectorAll('#pasadas li')].map((li) => li.innerText.replace(/\s+/g, ' ').trim()));
ver('"Pistas anteriores" abre la lista: hoy primero y despues ayer, con su nombre', pas.length >= 3 && /hoy/.test(pas[0]) && /ayer/.test(pas[1]) && !(await A.evaluate(() => document.getElementById('panelPasadas').hidden)) && /Pistas anteriores/.test(await A.evaluate(() => document.querySelector('#panelPasadas h2').textContent)), pas.slice(0, 3));
await A.screenshot({ path: 'out/inicio-anteriores.png' });
await irACard(A, 'oficiales');
const ofi = await A.evaluate(() => [...document.querySelectorAll('#circuitos li')].map((li) => li.innerText.replace(/\s+/g, ' ').trim()));
ver('Circuitos: Subida, Bajada, Urbano y Practica, cada uno con su tiempo (o rayita)', ofi.length === 4 && /Subida/.test(ofi[0]) && /Bajada/.test(ofi[1]) && /Urbano/.test(ofi[2]) && /Práctica/.test(ofi[3]) && ofi.every((x) => /—|\d\d:\d\d/.test(x)), ofi);
await irACard(A, 'reales');
const rea = await A.evaluate(() => [...document.querySelectorAll('#catReales li')].map((li) => li.innerText.replace(/\s+/g, ' ').trim()));
ver('Reales: Giulio Cesare y, debajo, La Montaña del Sufrimiento', rea.length === 2 && /Giulio Cesare/.test(rea[0]) && /Montaña del Sufrimiento/.test(rea[1]), rea);
await irACard(A, 'travesia');
const tv = await A.evaluate(() => ({ record: document.getElementById('tvRecord').textContent, filas: [...document.querySelectorAll('#catAventura li')].map((li) => li.innerText.replace(/\s+/g, ' ').trim()), boton: document.getElementById('largarTravesia').textContent }));
ver('Travesia: tu record (o "sin record") y los tres primeros de tus amigos', /Sin récord/.test(tv.record) && tv.filas.length === 3 && /^1 .*Ana 23,5 km/.test(tv.filas[0]) && /Bruno/.test(tv.filas[1]) && /Cleo/.test(tv.filas[2]) && /Largar/.test(tv.boton), tv);
await irACard(A, 'tutorial');
ver('Tutorial: dice que es y tiene su boton (como este aparato ya la vio, "Repetir")', await A.evaluate(() => /Misión tutorial/.test(document.getElementById('tutTitulo').textContent) && /Repetir/.test(document.getElementById('largarTutorial').textContent)));
await irACard(A, 'comunidad');
ver('Comunidad: sin servidor no hay donde publicar (no hay boton de crear) y dice que todavia no hay pistas', await A.evaluate(() => document.getElementById('armarPista').hidden && !document.getElementById('comunidadVacia').hidden));
await irACard(A, 'hoy');
ver('cerrar el panel devuelve al inicio', await visible(A, '#home') && (await modo(A)) === 'hoy' && !(await visible(A, '#panel')));

// ---------- 2: cada boton lleva a su modo ----------
await largarDesdeHome(A, 'hoy');
e = await estado(A);
ver('el boton grande larga la pasada (la cuenta empieza) y el inicio se va', e.pantalla === 'jugando' && !(await visible(A, '#home')) && await visible(A, '#hud'), e);
const fin1 = await llegar(A);
ver('llega a la meta y se ve el resultado', fin1 === 'llegada' && await visible(A, '#fin'), fin1);
await A.click('#salir');
await A.waitForTimeout(400);
e = await estado(A);
ver('"Volver" lleva al inicio (la pista del dia)', e.pantalla === 'portada' && await visible(A, '#home') && (await modo(A)) === 'hoy', [e.pantalla, await modo(A)]);
ver('y ahora el boton dice Practicar y la tabla muestra tu tiempo', await A.evaluate(() => /Practicar/.test(document.getElementById('largar').textContent) && /Vos.*\d\d:\d\d/.test(document.querySelector('#hoyTiempos li.mio').innerText.replace(/\s+/g, ' '))));
await A.waitForFunction(() => { const o = window.shakedown.club.oficial(); return o && o.codigo; }, null, { timeout: 30000 });
const codigoHoy = await A.evaluate(() => window.shakedown.club.oficial().codigo);
await largarDesdeHome(A, 'tutorial');
await A.waitForTimeout(800);
ver('Tutorial: abre el tutorial (con el auto esperando en la largada)', await A.evaluate(() => !document.getElementById('tutorial').hidden && window.shakedown.partida.estado === 'previa' && window.shakedown.estado().pantalla === 'jugando'));
await A.click('#tutCerrar');
await A.waitForTimeout(500);
ver('y al cerrarlo se vuelve al inicio', (await estado(A)).pantalla === 'portada' && await visible(A, '#home'));
await largarDesdeHome(A, 'travesia');
await A.waitForFunction(() => window.shakedown.travesia.estado().activa, null, { timeout: 90000 });
ver('Travesia: entra a la Travesia', !(await visible(A, '#home')) && await visible(A, '#hud'));
await A.keyboard.press('Escape');
await A.waitForTimeout(800);
ver('y al salir se vuelve al inicio', await visible(A, '#home'));
// un circuito oficial: hay que cargar esa pista. Va directo a la largada: nunca se ve el menu, se ve "Cargando Subida..." y larga solo.
await A.evaluate(() => { sessionStorage.removeItem('__menuVisto'); sessionStorage.removeItem('__yendoVisto'); });
await largarDesdeHome(A, 'subida');
e = await estado(A);
ver('Subida: carga esa pista y larga solo (' + e.pista + ')', e.pista === 16001 && e.pantalla === 'jugando', e);
const vistoSubida = await A.evaluate(() => ({ menu: sessionStorage.getItem('__menuVisto'), cartel: sessionStorage.getItem('__yendoVisto') }));
ver('en el camino no se volvio a ver el menu del inicio', vistoSubida.menu === null, vistoSubida);
ver('y mientras cargaba decia "Cargando <pista>..."', /^Cargando .+…$/.test(vistoSubida.cartel || ''), vistoSubida);
ver('la direccion queda limpia (sin el "#largar") y la pantalla de carga ya no esta', await A.evaluate(() => !location.hash && /c=subida/.test(location.search) && !document.documentElement.classList.contains('yendo')));
const finS = await llegar(A);
ver('Subida: llega a la meta', finS === 'llegada', finS);
await A.waitForFunction(() => { const o = window.shakedown.club.practica(); return o && o.codigo; }, null, { timeout: 30000 });
const codigoSubida = await A.evaluate(() => window.shakedown.club.practica().codigo);
await A.click('#salir');
await A.waitForTimeout(400);
ver('"Volver" desde Subida lleva al inicio, que muestra Subida con tu tiempo', (await estado(A)).pantalla === 'portada' && await A.evaluate(() => /Circuito/.test(document.getElementById('hoyTipo').textContent) && /Subida/.test(document.getElementById('pistaNombre').textContent) && /Vos.*\d\d:\d\d/.test(document.querySelector('#hoyTiempos li.mio').innerText.replace(/\s+/g, ' '))));
await largarDesdeHome(A, 'giulio');
e = await estado(A);
ver('Reales: carga Giulio Cesare y larga solo (' + e.pista + ')', e.pista === 16005 && e.pantalla === 'jugando', e);
await A.evaluate(() => window.shakedown.salir());
await A.waitForTimeout(400);
// una pista pasada: desde Pistas anteriores, directo tambien
await A.evaluate(() => { sessionStorage.removeItem('__menuVisto'); });
await irACard(A, 'pasadas');
const ayer = await A.evaluate(() => Number(document.querySelectorAll('#pasadas a')[1].dataset.n));
await A.evaluate(() => document.querySelectorAll('#pasadas a')[1].click());
await A.waitForFunction((n) => window.shakedown && window.shakedown.estado().pantalla === 'jugando' && window.shakedown.estado().pista === n, ayer, { timeout: 120000 });
ver('Pistas anteriores: elegir ayer (#' + ayer + ') larga directo, sin volver a ver el menu', await A.evaluate(() => sessionStorage.getItem('__menuVisto') === null));
ver('sin errores en la consola (compu)', a.errores.length === 0, [...new Set(a.errores)].slice(0, 3));
await a.cerrar();

// ---------- 3: links de un amigo ----------
const b = await abrir({ ancho: 1280, alto: 720, ruta: '#r=' + codigoHoy });
await listo(b.pag);
await b.pag.waitForTimeout(800);
ver('link de un amigo (#r=) en la pista del dia: el inicio la muestra, con el aviso de contra quien se corre', (await modo(b.pag)) === 'hoy' && await visible(b.pag, '#desafio') && /^Contra .*\d\d:\d\d/.test(await b.pag.evaluate(() => document.getElementById('desafio').innerText.trim())));
await b.pag.click('#largar'); await aceptarNombre(b.pag);
await b.pag.waitForFunction(() => window.shakedown.estado().pantalla === 'jugando', null, { timeout: 30000 });
ver('y un toque en Largar corre (la pasada del amigo es el rival)', (await estado(b.pag)).rival !== null, await estado(b.pag));
await b.cerrar();
const c = await abrir({ ancho: 390, alto: 844, ruta: '#r=' + codigoSubida, contexto: dedos });
await listo(c.pag);
await c.pag.waitForTimeout(800);
e = await estado(c.pag);
ver('link de un amigo en un circuito: la pista cargada es Subida, el inicio la muestra y trae el aviso', e.pista === 16001 && /Subida/.test(await c.pag.evaluate(() => document.getElementById('pistaNombre').textContent)) && await visible(c.pag, '#desafio'), [e.pista]);
await c.pag.tap('#largar'); await aceptarNombre(c.pag, true);
await c.pag.waitForFunction(() => window.shakedown.estado().pantalla === 'jugando', null, { timeout: 30000 });
ver('un toque en Largar corre contra el fantasma', (await estado(c.pag)).rival !== null);
await c.cerrar();
const d = await abrir({ ancho: 390, alto: 844, ruta: '#t=Ana.2347', contexto: dedos });
await listo(d.pag);
await d.pag.waitForTimeout(800);
ver('link de la Travesia (#t=): el inicio muestra el aviso de Ana con el boton para ir', await visible(d.pag, '#cartelTv') && /Ana/.test(await d.pag.evaluate(() => document.getElementById('cartelTvTexto').innerText)));
await irACard(d.pag, 'travesia', true);
ver('y en el panel de la Travesia esta Ana en la lista', /Ana/.test(await d.pag.evaluate(() => document.getElementById('catAventura').innerText)));
await irACard(d.pag, 'hoy', true);
await d.pag.screenshot({ path: 'out/inicio-travesia.png' });
await d.pag.tap('#cartelTvIr');
await d.pag.waitForFunction(() => window.shakedown.travesia.estado().activa, null, { timeout: 90000 });
ver('y el aviso lleva a largar la Travesia', await visible(d.pag, '#hud'));
await d.cerrar();

// ---------- 4: en el celular, con el dedo (y un iPhone, que pide permiso para el sensor) ----------
const f = await abrir({ ancho: 390, alto: 844, contexto: dedos, antes: async (pag) => {
  await espiarMenu(pag.context());
  // (hace de cuenta que es un iPhone: el sensor de inclinacion pide permiso, y eso solo se puede con un toque)
  await pag.context().addInitScript(() => { if (window.DeviceOrientationEvent) DeviceOrientationEvent.requestPermission = () => Promise.reject(new Error('hace falta un toque')); });
} });
if (!f.cargo) { console.log('NO CARGO\n' + f.errores.join('\n')); process.exit(1); }
const F = f.pag;
await listo(F);
await F.waitForTimeout(1500);
e = await estado(F);
ver('celular: al abrir se ve el inicio, no la carrera', e.pantalla === 'portada' && e.estado === 'previa' && await visible(F, '#home'), e);
ver('celular: la pista, Largar y "Pistas anteriores" entran enteros en pantalla', (await entero(F, '#cardHoy')) && (await entero(F, '#largar')) && (await entero(F, '#homeModos [data-panel="pasadas"]')));
ver('celular: la firma esta y entra en pantalla', await F.evaluate(() => { const r = document.getElementById('firma').getBoundingClientRect(); return r.height > 0 && r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight; }));
await F.screenshot({ path: 'out/inicio-celu.png' });
ver('celular: por defecto se dobla con flechas (sin pedir el sensor), con la trazada y sin ayuda ni rally serio', await F.evaluate(() => { const s = window.shakedown; return s.gusto('botones') === true && s.gusto('trazada') === true && !s.gusto('ayuda') && !s.gusto('serio'); }));
await F.evaluate(() => { sessionStorage.removeItem('__menuVisto'); sessionStorage.removeItem('__yendoVisto'); });
await largarDesdeHome(F, 'practica', { dedos: true });
e = await estado(F);
ver('celular tipo iPhone: elegir otro circuito larga solo, sin volver al menu (' + e.pista + ')', e.pista === 16004 && e.pantalla === 'jugando' && await F.evaluate(() => sessionStorage.getItem('__menuVisto') === null && /^Cargando/.test(sessionStorage.getItem('__yendoVisto') || '')), e);
ver('sin errores en la consola (celular)', f.errores.length === 0, [...new Set(f.errores)].slice(0, 3));
await f.cerrar();

// ---------- 5: celulares chicos: la pista, Largar y los modos entran sin tocar nada ----------
const h = await abrir({ ancho: 320, alto: 568, contexto: dedos });
await listo(h.pag);
for (const [w, al] of [[320, 568], [360, 640], [375, 667], [390, 844]]) {
  await h.pag.setViewportSize({ width: w, height: al });
  await h.pag.waitForTimeout(700);
  ver(w + 'x' + al + ': entran la pista, Largar, Pistas anteriores y los cinco modos', (await entero(h.pag, '#largar')) && (await entero(h.pag, '#homeModos [data-panel="pasadas"]')) && await h.pag.evaluate(() => [...document.querySelectorAll('#homeModos .modo:not(.destacado)')].every((b) => { const r = b.getBoundingClientRect(); return r.bottom <= innerHeight + 0.5 && r.right <= innerWidth + 0.5 && b.scrollWidth <= b.clientWidth + 1; })));
  if (w === 320) await h.pag.screenshot({ path: 'out/inicio-320.png' });
}
for (const [w, al] of [[568, 320], [640, 360], [844, 390]]) {
  await h.pag.setViewportSize({ width: w, height: al });
  await h.pag.waitForTimeout(700);
  ver(w + 'x' + al + ' (acostado): se ven Largar y Pistas anteriores', (await entero(h.pag, '#largar')) && (await entero(h.pag, '#homeModos [data-panel="pasadas"]')));
}
await h.cerrar();

// ---------- 6: la primera vez ----------
const g = await abrir({ ancho: 1280, alto: 720, nuevo: true });
await listo(g.pag);
await g.pag.waitForTimeout(800);
ver('la primera vez, el inicio abre igual (la pista del dia) y Largar abre el tutorial', (await modo(g.pag)) === 'hoy' && await visible(g.pag, '#largar'));
await g.pag.click('#largar'); await aceptarNombre(g.pag);
await g.pag.waitForTimeout(900);
ver('y Largar abre el tutorial (el equipo explica antes de largar)', await g.pag.evaluate(() => !document.getElementById('tutorial').hidden));
await g.cerrar();

console.log(mal ? '\n' + mal + ' COSAS MAL' : '\ntodo bien');
process.exit(mal ? 1 : 0);

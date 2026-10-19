// Los records de la Travesia entre amigos, el link generico y la guia de la primera vez.
// A (compu) corre la Travesia, su record se manda solo al servidor y comparte el link; B (celu) lo abre, ve el cartel, ve a A en
// la tabla (por el link y despues por el club), corre y su record aparece del lado de A. La guia aparece la primera vez y se saltea.
// Hace falta un servidor de prueba LIMPIO:  node servidor/local.mjs 8787   (y al terminar:  pkill -f 'servidor/[l]ocal.mjs')
// uso: node tools/pruebas/vertravesiaamigos.mjs
// Capturas en out/: travesia-tutorial-1.png y -2.png (compu), travesia-tutorial-celu.png, travesia-link.png, travesia-tabla.png
import { abrir } from './ver.mjs';
const SERVIDOR = 'http://127.0.0.1:8787';
let mal = 0;
const ver = (que, si, detalle) => { console.log((si ? '  ok  ' : '  MAL ') + que + (si || detalle === undefined ? '' : ' -> ' + JSON.stringify(detalle))); if (!si) mal++; };
const est = (P) => P.evaluate(() => window.shakedown.travesia.estado());
const visible = (P, id) => P.evaluate((id) => { const el = document.getElementById(id); return !!el && !el.hidden; }, id);
const guia = (P) => P.evaluate(() => ({ abierta: !document.getElementById('guiaTv').hidden, paso: window.shakedown.travesia.guia.paso(), quien: document.getElementById('guiaNombre').textContent, rol: document.getElementById('guiaRol').textContent,
  texto: document.getElementById('guiaTexto').textContent, iconos: document.querySelectorAll('#guiaIconos img').length, botones: [...document.querySelectorAll('#guiaBotones button')].map((b) => b.textContent), saltar: !document.getElementById('guiaSaltar').hidden,
  visto: window.shakedown.club.gusto('travesiaGuia') || 0,
  // la tarjeta entera en pantalla
  tarjeta: (() => { const t = document.querySelector('#guiaTv .tut-tarjeta').getBoundingClientRect(), r = document.getElementById('guiaRetrato').getBoundingClientRect(); const arriba = Math.min(t.top, r.top); return { adentro: t.left >= 0 && arriba >= 0 && t.right <= innerWidth + 0.5 && t.bottom <= innerHeight + 0.5, retrato: document.getElementById('guiaRetrato').naturalWidth }; })() }));
async function correr(P, km, motivo = 'quieto') {
  await P.evaluate(([km, motivo]) => { const s = window.shakedown.travesia; s.depuracion.invulnerable = true; s.proxima(999); s.avanzar(3.3); s.saltarA(km); s.avanzar(0.2); s.terminar(motivo); s.avanzar(3); }, [km, motivo]);
  await P.waitForFunction(() => !document.getElementById('travesiaFin').hidden, null, { timeout: 60000 });
}
const servidor = (ruta, cuerpo) => fetch(SERVIDOR + ruta, { method: 'POST', headers: { 'content-type': 'text/plain' }, body: JSON.stringify(cuerpo) }).then((r) => r.json());

// ------------------------------------------------------------------ A, en la compu
let enlace = '', codigoClub = '', kmA = 0;
{
  console.log('-- A (compu 1280x720)');
  const a = await abrir({ ancho: 1280, alto: 720, nuevo: true, ruta: '?servidor=' + SERVIDOR });
  if (!a.cargo) { console.log('NO CARGO\n' + a.errores.join('\n')); process.exit(1); }
  const P = a.pag;
  await P.emulateMedia({ reducedMotion: 'reduce' });
  ver('A es nuevo y no vio la guia', await P.evaluate(() => !window.shakedown.club.gusto('travesiaGuia')));
  // la guia aparece la primera vez que se entra, con el auto esperando
  await P.evaluate(() => window.shakedown.entrarTravesia());
  await P.waitForTimeout(900);
  let g = await guia(P);
  ver('la primera vez que se entra se abre la guia, con la cuenta regresiva esperando', g.abierta && g.paso === 0 && (await est(P)).fase === 'guia', g);
  await P.evaluate(() => window.shakedown.travesia.avanzar(5));
  ver('mientras dura la guia el juego no corre', (await est(P)).fase === 'guia');
  const vistos = [];
  for (let k = 0; k < 4; k++) {
    await P.waitForTimeout(500);
    g = await guia(P);
    vistos.push(g.quien);
    ver('guia ' + (k + 1) + ' (' + g.quien + ', ' + g.rol + '): entra en pantalla, con icono y pocas palabras', g.tarjeta.adentro && g.tarjeta.retrato > 0 && g.iconos >= 1 && g.texto.length > 20 && g.texto.length < 120, g);
    console.log('     ' + g.texto);
    if (k < 2) await P.screenshot({ path: 'out/travesia-tutorial-' + (k + 1) + '.png' });
    if (k < 3) await P.click('#guiaBotones button.fuerte');
  }
  ver('hablan Leo, Julian, Sebastian y Leo, en orden', vistos.join() === 'Leo,Julián,Sebastián,Leo', vistos);
  ver('la ultima dice "A correr" y ya no ofrece saltar', g.botones.join() === 'A correr' && !g.saltar, g);
  ver('y los cinco puntos estan: infinito, 2 km, termina, linea punteada, gana el que llega mas lejos', await P.evaluate(() => { const t = [...document.querySelectorAll('#guiaTv .tut-texto')].length; return t === 1; }));
  await P.click('#guiaBotones button.fuerte');
  g = await guia(P);
  ver('"A correr" cierra la guia y arranca la cuenta regresiva', !g.abierta && g.visto === 1 && (await est(P)).fase === 'cuenta', g);
  // volver a ver: desde "Como se juega" (el ?) y desde la Aventura
  await P.keyboard.press('Escape');
  await P.waitForFunction(() => !document.getElementById('portada').hidden);
  await P.evaluate(() => window.shakedown.entrarTravesia());
  ver('la segunda vez ya no se abre sola', !(await guia(P)).abierta && (await est(P)).fase === 'cuenta');
  await P.keyboard.press('Escape');
  await P.waitForFunction(() => !document.getElementById('portada').hidden);
  await P.evaluate(() => document.getElementById('verGuiaTravesia').click());
  g = await guia(P);
  ver('desde "Como se juega" se vuelve a ver', g.abierta && g.paso === 0 && (await est(P)).fase === 'afuera', g);
  await P.keyboard.press('Escape');
  ver('Escape la saltea', !(await guia(P)).abierta);
  await P.evaluate(() => document.getElementById('irCircuitos').click());
  await P.waitForTimeout(300);
  await P.click('.tv-guia button');
  ver('desde la Aventura tambien se vuelve a ver', (await guia(P)).abierta);
  await P.click('#guiaSaltar');
  ver('"Saltar" la cierra', !(await guia(P)).abierta);

  // el club, el nombre y a correr
  codigoClub = await P.evaluate(async () => { const s = window.shakedown; s.club.ponerNombre('Ana'); const r = await s.nube.crearClub('Los de la duna', 'Ana'); s.club.ponerClub({ codigo: r.codigo, nombre: r.nombre }); return r.codigo; });
  ver('A armo un club', /^[0-9A-Za-z]{8}$/.test(codigoClub), codigoClub);
  await P.evaluate(() => document.getElementById('cerrarPanel').click());
  await P.evaluate(() => window.shakedown.entrarTravesia());
  await correr(P, 12.34);
  {
    const e = await est(P);
    kmA = e.record;
    ver('termina con ' + e.km.toFixed(2) + ' km y es record', e.fase === 'fin' && e.km >= 12.3 && /récord/i.test(await P.evaluate(() => document.getElementById('tfRecord').textContent)), e);
  }
  await P.waitForFunction(() => window.shakedown.club.gusto('travesiaSubido') > 0, null, { timeout: 20000 }).catch(() => {});
  ver('el record se manda solo al servidor', (await P.evaluate(() => window.shakedown.club.gusto('travesiaSubido'))) === kmA, [await P.evaluate(() => window.shakedown.club.gusto('travesiaSubido')), kmA]);
  const enServidor = await servidor('/travesias', { clubes: [codigoClub] });
  ver('y esta en la tabla del club en el servidor', enServidor.clubes[codigoClub] && enServidor.clubes[codigoClub].tabla.some((x) => x.nombre === 'Ana' && x.km === kmA && /^\d{3}$/.test(x.auto)), enServidor);
  ver('sin amigos todavia, no se muestra la tabla de records', !(await visible(P, 'tfAmigos')));
  // un record peor no se manda ni pisa
  const antesSubido = await P.evaluate(() => window.shakedown.club.gusto('travesiaSubido'));
  await P.click('#tfOtra');
  await correr(P, 3.1);
  ver('un record peor no cambia lo guardado', (await P.evaluate(() => window.shakedown.club.gusto('travesiaSubido'))) === antesSubido && (await servidor('/travesias', { clubes: [codigoClub] })).clubes[codigoClub].tabla.find((x) => x.nombre === 'Ana').km === kmA);
  // compartir
  const texto = await P.evaluate(async () => {
    let dicho = '';
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (t) => { dicho = t; } }, configurable: true });
    document.getElementById('tfCompartir').click();
    await new Promise((r) => setTimeout(r, 200));
    return dicho;
  });
  enlace = texto.split('\n').pop();
  console.log('     ' + texto.split('\n').join(' | '));
  ver('el mensaje lleva el link generico: #t=Ana.<km en centesimas>', enlace.endsWith('#t=Ana.' + Math.round(kmA * 100)) && !/#r=|\?p=|\?c=/.test(enlace), enlace);
  await a.cerrar();
}

// ------------------------------------------------------------------ B, en el celu, abre el link
{
  console.log('-- B (celu 390x844) abre el link de A');
  const hash = enlace.slice(enlace.indexOf('#'));
  const b = await abrir({ ancho: 390, alto: 844, nuevo: true, contexto: { hasTouch: true, isMobile: true, deviceScaleFactor: 2 }, ruta: '?servidor=' + SERVIDOR + hash });
  if (!b.cargo) { console.log('NO CARGO\n' + b.errores.join('\n')); process.exit(1); }
  const P = b.pag;
  await P.emulateMedia({ reducedMotion: 'reduce' });
  await P.waitForTimeout(800);
  const cartel = await P.evaluate(() => ({ visible: !document.getElementById('cartelTv').hidden, texto: document.getElementById('cartelTvTexto').textContent, boton: document.getElementById('cartelTvIr').textContent, hash: location.hash,
    caja: (() => { const r = document.getElementById('cartelTv').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 0.5 && r.top >= 0 && r.height > 20; })() }));
  ver('se ve el cartelito "Ana llego a ' + (kmA).toFixed(1).replace('.', ',') + ' km en la Travesia"', cartel.visible && cartel.texto === 'Ana llegó a ' + kmA.toFixed(1).replace('.', ',') + ' km en la Travesía' && cartel.caja, cartel);
  ver('con el boton para ir a la Travesia', /Travesía/.test(cartel.boton));
  ver('y el link se saca de la direccion', cartel.hash === '', cartel.hash);
  await P.screenshot({ path: 'out/travesia-link.png' });
  // A figura en la tabla (por el link: sin servidor para el club todavia)
  let tabla = await P.evaluate(() => window.shakedown.club.travesiaTabla());
  ver('A queda como amigo en la tabla de la Travesia (por el link)', tabla.length === 1 && tabla[0].nombre === 'Ana' && Math.abs(tabla[0].km - kmA) < 0.006 && tabla[0].link === true, tabla);
  await P.evaluate(() => document.getElementById('irCircuitos').click());
  await P.waitForTimeout(400);
  const resumen = await P.evaluate(() => { const li = document.querySelector('#catAventura .tv-amigos'); return li ? li.textContent : ''; });
  ver('en Circuitos > Aventura se ve el record de A', /Ana/.test(resumen) && /12,3/.test(resumen), resumen);
  await P.screenshot({ path: 'out/travesia-aventura.png' });
  await P.evaluate(() => document.getElementById('cerrarPanel').click());
  // B se suma al club de A (como si hubiera abierto su invitacion): los km de A llegan del servidor, con su numero de corredor
  const dela = await P.evaluate(async (codigo) => { const s = window.shakedown; s.club.ponerNombre('Beto'); const r = await s.nube.entrar(codigo, 'Beto'); s.club.ponerClub({ codigo: r.codigo, nombre: r.nombre }); await s.recordesDeLosClubes(true); return s.club.travesiaTabla(); }, codigoClub);
  ver('con el club, los km de A vienen del servidor (con su numero) y no se repite', dela.length === 1 && dela[0].nombre === 'Ana' && dela[0].km === kmA && !!dela[0].j && dela[0].de && dela[0].de.length === 1, dela);
  // el cartel manda a la Travesia: la primera vez, con la guia
  await P.tap('#cartelTvIr');
  await P.waitForTimeout(900);
  let g = await guia(P);
  ver('el boton del cartel lleva a la Travesia (y como es la primera vez, a la guia)', !(await visible(P, 'cartelTv')) && (await est(P)).activa && g.abierta, g);
  await P.screenshot({ path: 'out/travesia-tutorial-celu.png' });
  ver('la guia entra entera en el celu 390x844', g.tarjeta.adentro && g.tarjeta.retrato > 0, g);
  for (let k = 0; k < 3; k++) { await P.tap('#guiaBotones button.fuerte'); await P.waitForTimeout(300); const gg = await guia(P); ver('celu: guia ' + (k + 2) + ' entra en pantalla', gg.tarjeta.adentro, gg); }
  await P.tap('#guiaSaltar').catch(() => {});   // (la ultima no ofrece saltar: se cierra con "A correr")
  if ((await guia(P)).abierta) await P.tap('#guiaBotones button.fuerte');
  ver('la guia se cierra y arranca la cuenta', !(await guia(P)).abierta && (await est(P)).fase === 'cuenta');
  // B corre menos que A
  await correr(P, 6.78);
  await P.waitForTimeout(600);
  const fin = await P.evaluate(() => ({ visible: !document.getElementById('tfAmigos').hidden, filas: [...document.querySelectorAll('#tfTabla li')].map((li) => li.textContent), mio: [...document.querySelectorAll('#tfTabla li.mio')].length, botones: document.querySelectorAll('#tfTabla button').length,
    sinNombreBloquea: document.getElementById('tfNombre').value }));
  ver('en el resultado de B hay una tabla de records con A y con B, A primero', fin.visible && fin.filas.length === 2 && /^1.*Ana.*12,3 km/.test(fin.filas[0]) && /^2.*Beto.*6,8 km/.test(fin.filas[1]) && fin.mio === 1, fin);
  ver('sin fantasma ni botones de correrle (la pista es random)', fin.botones === 0, fin);
  ver('el nombre de B ya esta en el resultado', fin.sinNombreBloquea === 'Beto', fin);
  const cajaFin = await P.evaluate(() => { const r = document.querySelector('#tfTabla').getBoundingClientRect(), f = document.getElementById('travesiaFin').getBoundingClientRect(); return { abajo: r.bottom <= innerHeight + 0.5, arriba: r.top >= 0, ancho: r.right <= innerWidth + 0.5, f: f.height }; });
  ver('la tabla entra en el celu', cajaFin.abajo && cajaFin.arriba && cajaFin.ancho, cajaFin);
  await P.screenshot({ path: 'out/travesia-tabla.png' });
  await P.waitForFunction(() => window.shakedown.club.gusto('travesiaSubido') > 0, null, { timeout: 20000 }).catch(() => {});
  const kmB = (await est(P)).record;
  const todos = await servidor('/travesias', { clubes: [codigoClub] });
  ver('el record de B tambien esta en el servidor, y A sigue primero', todos.clubes[codigoClub].tabla.map((x) => x.nombre).join() === 'Ana,Beto' && todos.clubes[codigoClub].tabla[1].km === kmB, todos.clubes[codigoClub].tabla);
  // B cambia su nombre desde el resultado: en el club figura con el nombre nuevo
  await P.fill('#tfNombre', 'Betito');
  await P.press('#tfNombre', 'Enter');
  await P.waitForTimeout(800);
  const nuevo = await servidor('/travesias', { clubes: [codigoClub] });
  ver('si cambia el nombre en el resultado, el club lo ve', nuevo.clubes[codigoClub].tabla.some((x) => x.nombre === 'Betito' && x.km === kmB), nuevo.clubes[codigoClub].tabla);
  // un link roto o con km imposibles no suma a nadie
  ver('sin errores en la consola (B)', b.errores.length === 0, b.errores.slice(0, 4));
  await b.cerrar();
}

// ------------------------------------------------------------------ C abre links rotos y sin servidor
{
  console.log('-- C (compu, sin servidor): links raros');
  for (const [hash, esperado] of [['#t=Ana.0', false], ['#t=Ana.9999999', false], ['#t=.1234', false], ['#t=Ana', false], ['#t=%E0%A4%A.123', false], ['#t=Ana.Maria.1234', true]]) {
    const c = await abrir({ ancho: 1280, alto: 720, ruta: hash.startsWith('#') ? '?servidor=' + hash : hash });
    if (!c.cargo) { console.log('NO CARGO\n' + c.errores.join('\n')); mal++; await c.cerrar(); continue; }
    await c.pag.waitForTimeout(500);
    const r = await c.pag.evaluate(() => ({ cartel: !document.getElementById('cartelTv').hidden, texto: document.getElementById('cartelTvTexto').textContent, tabla: window.shakedown.club.travesiaTabla().length }));
    ver('link ' + hash + (esperado ? ' se acepta (' + r.texto + ')' : ' se ignora'), r.cartel === esperado && r.tabla === (esperado ? 1 : 0) && c.errores.length === 0, [r, c.errores.slice(0, 3)]);
    await c.cerrar();
  }
}
console.log(mal ? mal + ' MAL' : 'todo bien');
process.exit(mal ? 1 : 0);

// Que los tiempos se guarden solos al terminar, sin compartirlos, y que un abandono figure como DNF.
// uso: node tools/pruebas/verguardado.mjs [http://127.0.0.1:8787]   (antes, un servidor limpio: node servidor/local.mjs 8787)
//   A arma un club y corre la oficial con la señal cortada justo al terminar: queda pendiente y se guarda al volver la señal.
//   B entra al club y rompe el auto en la oficial: DNF en su resultado, en lo que comparte y en la tabla del club.
//   C entra al club, larga la oficial y cierra el juego en el medio: al volver, ese DNF se sube solo (sin recorrido).
//   D no esta en ningun club ni tiene nombre: corre la oficial sin señal y cierra; al volver a abrir, se sube solo.
//      Despues corre una pista de la comunidad: se guarda en la tabla de la pista, y al ponerse nombre, figura con el nombre.
import { abrir } from './ver.mjs';
const API = process.argv[2] || 'http://127.0.0.1:8787';
const permisos = { permissions: ['clipboard-read', 'clipboard-write'] };
const celular = { ...permisos, hasTouch: true, isMobile: true, deviceScaleFactor: 2 };
let mal = 0;
const ver = (que, si, detalle) => { console.log((si ? '  ok  ' : '  MAL ') + que + (si || detalle === undefined ? '' : ' -> ' + JSON.stringify(detalle))); if (!si) mal++; };

// corre la pasada con el piloto automatico (ver tools/piloto.mjs); devuelve el estado final
const correr = (pag, piloto, auto) => pag.evaluate(async ([piloto, auto]) => {
  const { decidir, PILOTOS } = await import('/tools/piloto.mjs'), { crearReferencia } = await import('/src/referencia.js'), { AUTOS, JUEGO } = await import('/src/config.js'), { azar } = await import('/src/noise.js');
  const s = window.shakedown, DT = JUEGO.paso, o = PILOTOS[piloto];
  document.querySelector('[data-auto="' + auto + '"]').click();
  s.largar(); s.avanzar(3.2);
  const c = s.auto(), p = s.partida, ref = crearReferencia(s.T, AUTOS[auto]), rnd = azar(7), ent = { x: 0, y: 0, mano: false }, m = {};
  let t = 0, prox = 0, pasos = 0;
  while (t < 600 && p.estado === 'corriendo') {
    if (t >= prox) { prox = t + o.reaccion * (0.7 + 0.6 * rnd()); decidir(s.T, ref, c, p, o, m, rnd, t, ent); }
    if (o.teclas && t > m.hasta && !(t < m.atras)) ent.x = 0;
    c.paso(ent, DT); t += DT;
    if (++pasos % 2 === 0) s.avanzar(DT * 2);
  }
  s.saltearEspera();
  return s.estado();
}, [piloto, auto]);
// larga la oficial y rompe el auto enseguida: un golpe fuerte con el auto casi roto
const romper = (pag) => pag.evaluate(async () => {
  const s = window.shakedown;
  s.largar(); s.avanzar(3.2); s.avanzar(1.5);
  s.partida.roto = 99; s.auto().impacto = 30; s.auto().contra = 'piedra';
  for (let k = 0; k < 40 && s.partida.estado === 'corriendo'; k++) { s.auto().impacto = Math.max(s.auto().impacto, 30); s.avanzar(0.1); }
  s.saltearEspera();
  return s.estado();
});
const esperarFin = (pag) => pag.waitForFunction(() => !document.getElementById('fin').hidden, null, { timeout: 60000 });
const cargada = (pag) => pag.waitForFunction(() => window.shakedown && !document.documentElement.classList.contains('cargando'), null, { timeout: 120000 });
const texto = (pag, id) => pag.evaluate((id) => { const el = document.getElementById(id); return !el || el.hidden ? '' : el.textContent.trim(); }, id);
const guardado = (pag) => texto(pag, 'finGuardado');
const esperarGuardado = (pag, re, ms = 20000) => pag.waitForFunction((re) => { const el = document.getElementById('finGuardado'); return el && !el.hidden && new RegExp(re).test(el.textContent); }, re.source, { timeout: ms }).then(() => true).catch(() => false);
const tabla = (pag) => pag.evaluate(() => [...document.querySelectorAll('#tabla li')].map((li) => li.querySelector('.quien').firstChild.textContent + ' ' + li.querySelector('.tiempoMarca').textContent + (li.classList.contains('mio') ? ' (mio)' : '') + (li.querySelector('button') ? ' [fantasma]' : '')));
// corta (o devuelve) la señal con el servidor, solo para las pasadas
const sinSenal = async (pag, si) => { if (si) await pag.route('**/pasadas', (r) => r.abort('internetdisconnected')); else await pag.unroute('**/pasadas'); };
const dormir = (j) => j.pag.goto('about:blank');   // (para que no le quite graficos a la que se esta probando)

// ---------- A: arma el club y corre la oficial; la señal se corta justo al terminar ----------
const a = await abrir({ ruta: '?servidor=' + encodeURIComponent(API), contexto: permisos });
if (!a.cargo) { console.log('A NO CARGO\n' + a.errores.join('\n')); process.exit(1); }
const A = a.pag;
await cargada(A);
const clubA = await A.evaluate(async () => {
  const s = window.shakedown; s.club.ponerNombre('Juanma');
  const c = await s.nube.crearClub('Los Tercos', 'Juanma'); s.club.ponerClub(c); return c;
});
await sinSenal(A, true);
const finA = await correr(A, 'bueno', 'vitarita');
await esperarFin(A);
const pendienteA = await esperarGuardado(A, /Sin conexión/);
ver('A: sin señal al terminar, el resultado dice que se guarda cuando vuelva', finA.estado === 'llegada' && pendienteA, [finA.estado, await guardado(A)]);
await A.screenshot({ path: 'out/guardado-1-sin-senal.png' });
await sinSenal(A, false);
await A.evaluate(() => window.dispatchEvent(new Event('online')));
const listoA = await esperarGuardado(A, /Guardado en la tabla de «Los Tercos»/);
ver('A: al volver la señal se guarda solo, y dice en que tabla', listoA && await A.evaluate(() => !!window.shakedown.club.oficial().id), await guardado(A));
ver('A: con el tilde verde', await A.evaluate(() => { const el = document.getElementById('finGuardado'); return el.classList.contains('listo') && !!el.querySelector('img.icono'); }));
await A.screenshot({ path: 'out/guardado-2-guardado.png' });
const urlA = A.url();
await dormir(a);

// ---------- B: entra al club y rompe el auto en la oficial ----------
const b = await abrir({ ancho: 390, alto: 844, ruta: '?servidor=' + encodeURIComponent(API) + '#club=' + clubA.codigo, contexto: celular });
if (!b.cargo) { console.log('B NO CARGO\n' + b.errores.join('\n')); process.exit(1); }
const B = b.pag;
await cargada(B);
await B.waitForFunction(() => window.shakedown.club.clubes().length === 1, null, { timeout: 20000 }).catch(() => {});
await B.evaluate(() => { window.shakedown.club.ponerNombre('Beto'); document.getElementById('cerrarPanel').click(); });
const finB = await romper(B);
await esperarFin(B);
const resB = await B.evaluate(() => ({ grande: document.getElementById('finGrande').textContent, titulo: document.getElementById('finTitulo').textContent }));
ver('B: rompe el auto: el resultado dice DNF y por que', finB.estado === 'abandono' && resB.grande === 'DNF' && resB.titulo === 'Rompiste el auto', [finB.estado, resB]);
ver('B: el DNF se guarda solo en la tabla del club', await esperarGuardado(B, /Guardado en la tabla de «Los Tercos»/) && await B.evaluate(() => !!window.shakedown.club.oficial().id), await guardado(B));
await B.screenshot({ path: 'out/guardado-3-dnf-celular.png' });
await B.evaluate(() => { window.__compartido = ''; navigator.share = (d) => { window.__compartido = d.text; return Promise.resolve(); }; document.getElementById('compartir').click(); });
await B.waitForFunction(() => window.__compartido, null, { timeout: 15000 }).catch(() => {});
const msjB = (await B.evaluate(() => window.__compartido)).split('\n')[0];
ver('B: al compartirlo, el mensaje dice DNF', /^Shakedown #\d+ /.test(msjB) && msjB.includes(' 💥 DNF ') && !/abandono/.test(msjB), msjB);
console.log('     ' + msjB);
await B.click('#salir');
await B.waitForTimeout(300);
ver('B: en la portada, su oficial dice DNF', /DNF/.test(await texto(B, 'miResultado')), await texto(B, 'miResultado'));
await dormir(b);

// ---------- C: entra al club, larga la oficial y cierra el juego en el medio ----------
const c = await abrir({ ruta: '?servidor=' + encodeURIComponent(API) + '#club=' + clubA.codigo, contexto: permisos });
if (!c.cargo) { console.log('C NO CARGO\n' + c.errores.join('\n')); process.exit(1); }
const C = c.pag;
await cargada(C);
await C.waitForFunction(() => window.shakedown.club.clubes().length === 1, null, { timeout: 20000 }).catch(() => {});
await C.evaluate(() => { window.shakedown.club.ponerNombre('Caro'); document.getElementById('cerrarPanel').click(); });
await C.evaluate(() => { const s = window.shakedown; s.largar(); s.avanzar(3.2); s.avanzar(4); });
ver('C: la oficial esta corriendo', await C.evaluate(() => !!(window.shakedown.club.oficial() || {}).corriendo));
await C.reload();   // (cierra el juego en el medio y lo vuelve a abrir)
await cargada(C);
await C.waitForFunction(() => { const o = window.shakedown.club.oficial(); return o && o.id; }, null, { timeout: 20000 }).catch(() => {});
const ofC = await C.evaluate(() => window.shakedown.club.oficial());
ver('C: al volver, la oficial es un DNF y se subio sola', ofC && ofC.ab === 'cerrado' && /^[0-9A-Za-z]{7}$/.test(ofC.id || ''), ofC && { ab: ofC.ab, id: ofC.id, codigo: (ofC.codigo || '').length });
ver('C: en la portada dice DNF', /DNF/.test(await texto(C, 'miResultado')), await texto(C, 'miResultado'));
await dormir(c);

// ---------- A: la tabla del club ----------
await A.goto(urlA);
await cargada(A);
await A.evaluate(() => window.shakedown.tablasDeLosClubes(true));
await A.waitForTimeout(800);
await A.click('[data-panel="tabla"]');
await A.waitForTimeout(500);
const tA = await tabla(A);
ver('A: en la tabla del club estan los tres, y Beto y Caro con DNF (sin fantasma)', tA.length === 3 && tA[0].startsWith('Juanma') && tA.some((x) => x === 'Beto DNF') && tA.some((x) => x === 'Caro DNF'), tA);
ver('A: Caro ya no figura como que todavia no corrio', !(await texto(A, 'clubFaltan')), await texto(A, 'clubFaltan'));
await A.screenshot({ path: 'out/guardado-4-tabla.png' });
await dormir(a);

// ---------- D: sin club ni nombre; corre sin señal y cierra el juego ----------
const d = await abrir({ ancho: 390, alto: 844, ruta: '?servidor=' + encodeURIComponent(API), contexto: celular });
if (!d.cargo) { console.log('D NO CARGO\n' + d.errores.join('\n')); process.exit(1); }
const D = d.pag;
await cargada(D);
await sinSenal(D, true);
const finD = await correr(D, 'bueno', 'kacito');
await esperarFin(D);
ver('D: sin señal: dice que se guarda cuando vuelva', finD.estado === 'llegada' && await esperarGuardado(D, /Sin conexión/), await guardado(D));
await sinSenal(D, false);
await D.reload();   // (cierra el juego antes de que vuelva la señal, y lo vuelve a abrir)
await cargada(D);
await D.waitForFunction(() => { const o = window.shakedown.club.oficial(); return o && o.id; }, null, { timeout: 20000 }).catch(() => {});
ver('D: sin club, al volver a abrir el juego la oficial se sube sola', await D.evaluate(() => /^[0-9A-Za-z]{7}$/.test(window.shakedown.club.oficial().id || '')), await D.evaluate(() => window.shakedown.club.oficial()));
// una pista de la comunidad (la publica alguien por el servidor) que D corre sin haberse puesto nombre
const pista = await D.evaluate(async (api) => {
  const hoja = { v: 1, a: 'campo', c: 'sol', p: ['r2', 'd3', 'ge', 'r1', 'i4', 'sa', 'r2', 'd5', 'pu', 'i2', 'r3', 'd4', 'cn', 'r2', 'i5', 'va', 'r2'] };
  const r = await fetch(api + '/pistas', { method: 'POST', headers: { 'content-type': 'text/plain' }, body: JSON.stringify({ llave: 'LuciaLuciaLucia12345', nombre: 'Recta del Tambo', apodo: 'Lucía', club: '', hoja }) });
  return r.json();
}, API);
ver('D: hay una pista de la comunidad publicada', pista && pista.numero > 0, pista);
await D.goto(new URL(D.url()).origin + '/?servidor=' + encodeURIComponent(API) + '&pista=' + pista.numero + '-' + pista.version);
await cargada(D);
const finD2 = await correr(D, 'bueno', 'kacito');
await esperarFin(D);
ver('D: sin nombre, se guarda y le pide el nombre para la tabla', finD2.estado === 'llegada' && await esperarGuardado(D, /Poné tu nombre para que figure en la tabla/), await guardado(D));
await D.screenshot({ path: 'out/guardado-5-sin-nombre.png' });
await D.fill('#nombre', 'Dani');
await D.evaluate(() => document.getElementById('nombre').dispatchEvent(new Event('change')));
ver('D: puesto el nombre, se vuelve a guardar con el nombre', await esperarGuardado(D, /Guardado en la tabla de la pista/), await guardado(D));
const tablaPista = await D.evaluate(async ([api, n]) => (await (await fetch(api + '/pistas/' + n)).json()).tabla.map((x) => x.nombre), [API, pista.numero]);
ver('D: en la tabla de la pista figura con su nombre', tablaPista.length === 1 && tablaPista[0] === 'Dani', tablaPista);
await D.screenshot({ path: 'out/guardado-6-pista.png' });

for (const [quien, j] of [['A', a], ['B', b], ['C', c], ['D', d]]) {
  const errores = j.errores.filter((e) => !/ERR_INTERNET_DISCONNECTED|net::ERR_FAILED|Failed to load resource/.test(e));
  ver(quien + ': sin errores en la consola', !errores.length, errores.slice(0, 3));
}
for (const j of [a, b, c, d]) await j.cerrar();
console.log(mal ? 'FALLARON ' + mal : 'todo bien');
process.exit(mal ? 1 : 0);

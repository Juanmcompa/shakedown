// Prueba de punta a punta de los clubes y el link corto: dos (o tres) jugadores, cada uno con su navegador, contra un servidor de prueba.
// uso: node tools/pruebas/verclubes.mjs [http://127.0.0.1:8787]   (antes: node servidor/local.mjs 8787)
import { abrir } from './ver.mjs';
const API = process.argv[2] || 'http://127.0.0.1:8787';
const permisos = { permissions: ['clipboard-read', 'clipboard-write'] };
let mal = 0;
const ver = (que, si, detalle) => { console.log((si ? '  ok  ' : '  MAL ') + que + (si || detalle === undefined ? '' : ' -> ' + JSON.stringify(detalle))); if (!si) mal++; };

// corre la pasada dentro de la pagina con un piloto automatico; devuelve el estado final
const correr = (pag, piloto, auto, nombre) => pag.evaluate(async ([piloto, auto, nombre]) => {
  const { decidir, PILOTOS } = await import('/tools/piloto.mjs'), { crearReferencia } = await import('/src/referencia.js'), { AUTOS, JUEGO } = await import('/src/config.js'), { azar } = await import('/src/noise.js');
  const s = window.shakedown, DT = JUEGO.paso, o = PILOTOS[piloto];
  if (nombre) s.club.ponerNombre(nombre);
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
}, [piloto, auto, nombre]);
const esperarFin = (pag) => pag.waitForFunction(() => !document.getElementById('fin').hidden, null, { timeout: 60000 });
const tabla = (pag, cual = 'tabla') => pag.evaluate((cual) => [...document.querySelectorAll('#' + cual + ' li')].map((li) => li.querySelector('.quien').firstChild.textContent + ' ' + li.querySelector('.tiempoMarca').textContent + (li.classList.contains('mio') ? ' (mio)' : '') + (li.querySelector('button') ? ' [fantasma]' : '')), cual);
const fichas = (pag) => pag.evaluate(() => [...document.querySelectorAll('#clubes button')].map((b) => b.textContent.trim() + (b.classList.contains('elegido') ? '*' : '')));
const texto = (pag, id) => pag.evaluate((id) => { const el = document.getElementById(id); return el.hidden ? '' : el.textContent; }, id);

// ---------- A: arma un club, corre y comparte ----------
const a = await abrir({ ruta: '?servidor=' + encodeURIComponent(API), contexto: permisos, gustos: { vistaTabla: '' } });
if (!a.cargo) { console.log('A NO CARGO\n' + a.errores.join('\n')); process.exit(1); }
const A = a.pag;
await A.evaluate(() => window.shakedown.club.ponerNombre('Juanma'));
await A.click('[data-panel="tabla"]');
await A.waitForTimeout(300);
ver('A: sin clubes, el boton dice "Armar un club"', JSON.stringify(await fichas(A)) === JSON.stringify(['Todos', 'Amigos*', 'Armar un club']), await fichas(A));
await A.screenshot({ path: 'out/club-1-vacio.png' });
await A.click('#clubes button.mas');
await A.fill('#clubNombre', 'Los Pibes del Barro');
await A.screenshot({ path: 'out/club-2-armando.png' });
await A.click('#clubNuevo button');
await A.waitForFunction(() => window.shakedown.club.clubes().length === 1, null, { timeout: 8000 }).catch(() => {});
const clubA = await A.evaluate(() => window.shakedown.club.clubes()[0]);
ver('A: crea el club', clubA && /^[0-9A-Za-z]{8}$/.test(clubA.codigo) && clubA.nombre === 'Los Pibes del Barro', clubA);
await A.waitForTimeout(500);
ver('A: queda parado en su club', (await fichas(A)).join('|') === 'Todos|Amigos|Los Pibes del Barro*|', await fichas(A));
ver('A: como ya tiene nombre, no se lo pide', await A.evaluate(() => document.getElementById('clubApodo').hidden));
ver('A: le avisa que invite', /Invitá/.test(await texto(A, 'clubAviso')) && /vos solo/.test(await texto(A, 'clubDatos')), [await texto(A, 'clubAviso'), await texto(A, 'clubDatos')]);
await A.screenshot({ path: 'out/club-3-creado.png' });
await A.click('#clubInvitar');
await A.waitForTimeout(400);
const invitacion = await A.evaluate(() => navigator.clipboard.readText());
ver('A: la invitacion lleva el link del club', invitacion.includes('#club=' + clubA.codigo) && invitacion.includes('Los Pibes del Barro'), invitacion);
ver('A: la invitacion cierra con el aviso de Early Access, en un renglon aparte despues del link, sin quien hace el juego', invitacion.split('\n').length === 3 && invitacion.split('\n')[2] === '🚧 Early Access · App en desarrollo' && /#club=[0-9A-Za-z]+$/.test(invitacion.split('\n')[1]), invitacion);
console.log('     ' + invitacion.replace(/\n/g, ' | '));
await A.click('#cerrarPanel');
const finA = await correr(A, 'bueno', 'vitarita', 'Juanma');
await esperarFin(A);
await A.waitForFunction(() => { const o = window.shakedown.club.oficial(); return o && o.id; }, null, { timeout: 10000 }).catch(() => {});
const ofA = await A.evaluate(() => { const o = window.shakedown.club.oficial(); return { t: o.t, id: o.id, largo: (o.codigo || '').length }; });
ver('A: la oficial se subio sola y tiene codigo corto', /^[0-9A-Za-z]{7}$/.test(ofA.id || ''), ofA);
await A.click('#compartir');
await A.waitForTimeout(600);
const [mensajeA, ...restoA] = (await A.evaluate(() => navigator.clipboard.readText())).split('\n');
// (el link va solo en su renglon, el aviso de Early Access al final y, si ya se sabe, el puesto entre todos en otro renglon)
const linkA = restoA.find((x) => /#r=/.test(x)), firmaA = restoA[restoA.length - 1], sobra = restoA.filter((x) => x !== linkA && x !== firmaA && !/^🏆 \d+º de \d+$/.test(x));
ver('A: el mensaje: el primer renglon de siempre, el link solo y el ultimo es el aviso de Early Access (sin quien hace el juego)', firmaA === '🚧 Early Access · App en desarrollo' && sobra.length === 0 && /^Shakedown #\d+ /.test(mensajeA) && / 🏁 🚙333$/.test(mensajeA), [mensajeA, firmaA, sobra]);
ver('A: comparte con el link corto', linkA && linkA.endsWith('#r=' + ofA.id), linkA);
console.log('     ' + mensajeA + ' | ' + linkA + '   (antes: ' + (linkA.length - ofA.id.length + ofA.largo) + ' letras; ahora: ' + linkA.length + ')');
await A.screenshot({ path: 'out/club-4-fin-a.png' });

// ---------- B: abre la invitacion (en un celular), ve a A, le corre al fantasma ----------
const b = await abrir({ ancho: 390, alto: 844, ruta: '?servidor=' + encodeURIComponent(API) + '#club=' + clubA.codigo, contexto: { ...permisos, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }, gustos: { vistaTabla: '' } });
if (!b.cargo) { console.log('B NO CARGO\n' + b.errores.join('\n')); process.exit(1); }
const B = b.pag;
await B.waitForFunction(() => !document.getElementById('panelTabla').hidden && window.shakedown.club.clubes().length === 1, null, { timeout: 15000 }).catch(() => {});
await B.waitForTimeout(600);
ver('B: la invitacion lo deja en el club, con la tabla abierta', (await fichas(B)).join('|') === 'Todos|Amigos|Los Pibes del Barro*|' && /Ya estás en/.test(await texto(B, 'clubAviso')), [await fichas(B), await texto(B, 'clubAviso')]);
ver('B: ve el tiempo de A con su fantasma', (await tabla(B)).length === 1 && (await tabla(B))[0].startsWith('Juanma') && (await tabla(B))[0].endsWith('[fantasma]'), await tabla(B));
ver('B: la direccion queda limpia', !(await B.evaluate(() => location.hash)), await B.evaluate(() => location.hash));
await B.screenshot({ path: 'out/club-5-invitado.png' });
// B es nuevo y no tiene nombre: la tabla se lo pide, y con eso ya figura en el club aunque no haya corrido
ver('B: como no tiene nombre, la tabla se lo pide', await B.evaluate(() => !document.getElementById('clubApodo').hidden));
await B.fill('#clubMiNombre', 'Fede');
await B.evaluate(() => document.querySelector('#clubApodo button').click());
await B.waitForTimeout(800);
ver('B: puesto el nombre, deja de pedirlo', await B.evaluate(() => document.getElementById('clubApodo').hidden && window.shakedown.club.nombre() === 'Fede'), await B.evaluate(() => window.shakedown.club.nombre()));
await A.evaluate(() => window.shakedown.tablasDeLosClubes(true));
await A.waitForTimeout(600);
ver('A: ve que B esta en el club y todavia no corrio', /Todavía no corrió Fede\./.test(await A.evaluate(() => document.getElementById('clubFaltan').textContent)), await A.evaluate(() => document.getElementById('clubFaltan').textContent));
await B.tap('#tabla li button');
await B.waitForFunction(() => window.shakedown.estado().rival === 'Juanma', null, { timeout: 10000 }).catch(() => {});
ver('B: elige el fantasma de A (se baja del servidor)', (await B.evaluate(() => window.shakedown.estado().rival)) === 'Juanma', await B.evaluate(() => window.shakedown.estado()));
await B.tap('#cerrarPanel');
const finB = await correr(B, 'normal', 'kacito');
await esperarFin(B);
await B.waitForFunction(() => { const o = window.shakedown.club.oficial(); return o && o.id; }, null, { timeout: 10000 }).catch(() => {});
await B.waitForTimeout(1500);
ver('B: al terminar, en el resultado estan los dos', (await tabla(B, 'finTabla')).length === 2, await tabla(B, 'finTabla'));
await B.screenshot({ path: 'out/club-6-fin-b.png' });

// ---------- A: ve aparecer a B sin abrir ningun link ----------
await A.click('#salir');
await A.evaluate(() => window.shakedown.tablasDeLosClubes(true));
await A.waitForTimeout(500);
await A.click('[data-panel="tabla"]');
await A.waitForTimeout(500);
const tA = await tabla(A);
ver('A: en la tabla aparece B solo', tA.length === 2 && tA.some((x) => x.startsWith('Fede') && x.endsWith('[fantasma]')) && tA.some((x) => x.includes('(mio)')), tA);
await A.click('#clubes button:nth-child(3)');
await A.waitForTimeout(300);
ver('A: el club dice cuantos son', /2 corredores/.test(await texto(A, 'clubDatos')), await texto(A, 'clubDatos'));
await A.screenshot({ path: 'out/club-7-tabla-a.png' });

// ---------- C: se suma pero todavia no corre; A lo ve en "todavia no corrieron" ----------
const c = await abrir({ ruta: '?servidor=' + encodeURIComponent(API), contexto: permisos, gustos: { vistaTabla: '' } });
const C = c.pag;
await C.evaluate(() => window.shakedown.club.ponerNombre('Caro'));
// C abre el link corto de A (no la invitacion): corre contra A, y lo ve en su tabla
await C.goto(c.base + '?servidor=' + encodeURIComponent(API) + '#r=' + ofA.id);
await C.reload({ timeout: 120000 });
await C.waitForFunction(() => window.shakedown && window.shakedown.estado, null, { timeout: 60000 });
await C.waitForTimeout(800);
ver('C: abre el link corto y corre contra A', (await C.evaluate(() => window.shakedown.estado().rival)) === 'Juanma', await C.evaluate(() => window.shakedown.estado()));
await C.click('[data-panel="tabla"]');
await C.waitForTimeout(300);
ver('C: A esta en su tabla; todavia no hay clubes', (await tabla(C)).length === 1 && (await fichas(C)).join('|') === 'Todos|Amigos*|Armar un club', [await tabla(C), await fichas(C)]);
await C.click('#cerrarPanel');
// ahora si, la invitacion
await C.goto(c.base + '?servidor=' + encodeURIComponent(API) + '#club=' + clubA.codigo);
await C.reload({ timeout: 120000 });
await C.waitForFunction(() => window.shakedown && !document.getElementById('panelTabla').hidden && window.shakedown.club.clubes().length === 1, null, { timeout: 60000 }).catch(() => {});
await C.waitForTimeout(600);
ver('C: entra al club y ve a los dos', (await tabla(C)).length === 2, await tabla(C));
await A.evaluate(() => window.shakedown.tablasDeLosClubes(true));
await A.waitForTimeout(600);
ver('A: ve que C todavia no corrio', /Todavía no corrió Caro\./.test(await texto(A, 'clubFaltan')) && /3 corredores/.test(await texto(A, 'clubDatos')), [await texto(A, 'clubFaltan'), await texto(A, 'clubDatos')]);
await A.screenshot({ path: 'out/club-8-faltan.png' });

// ---------- B arma otro club: su oficial ya figura ahi; y sale del primero ----------
await B.tap('#salir');
await B.tap('[data-panel="tabla"]');
await B.tap('#clubes button.mas');
await B.fill('#clubNombre', 'Diseño 3');
await B.tap('#clubNuevo button');
await B.waitForFunction(() => window.shakedown.club.clubes().length === 2, null, { timeout: 8000 }).catch(() => {});
await B.waitForTimeout(800);
ver('B: tiene dos clubes y queda en el nuevo', (await fichas(B)).join('|') === 'Todos|Amigos|Los Pibes del Barro|Diseño 3*|', await fichas(B));
ver('B: su oficial ya figura en el club nuevo', (await tabla(B)).length === 1 && (await tabla(B))[0].includes('(mio)'), await tabla(B));
await B.screenshot({ path: 'out/club-9-dos-clubes.png' });
await B.tap('#clubes button:nth-child(3)');
await B.waitForTimeout(200);
await B.evaluate(() => document.getElementById('clubSalir').click());
ver('B: salir pide confirmacion', /Seguro/.test(await B.evaluate(() => document.getElementById('clubSalir').textContent)), await B.evaluate(() => document.getElementById('clubSalir').textContent));
await B.evaluate(() => document.getElementById('clubSalir').click());
await B.waitForFunction(() => window.shakedown.club.clubes().length === 1, null, { timeout: 8000 }).catch(() => {});
await B.waitForTimeout(400);
ver('B: salio; de "Todos" se fue la gente de ese club', (await fichas(B)).join('|') === 'Todos|Amigos*|Diseño 3|' && (await tabla(B)).length === 1, [await fichas(B), await tabla(B)]);

for (const [n, j] of [['A', a], ['B', b], ['C', c]]) ver(n + ': sin errores en la consola', j.errores.length === 0, [...new Set(j.errores)].slice(0, 4));
await a.cerrar(); await b.cerrar(); await c.cerrar();
console.log(mal ? 'FALLARON ' + mal : 'Todo bien');
process.exit(mal ? 1 : 0);

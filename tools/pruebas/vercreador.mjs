// El creador de pistas, de punta a punta, contra un servidor de prueba:
//   A (compu) arma una pista con los botones, la prueba (el borrador), la publica y comparte su link;
//   B (celular) abre el link, la corre y la ve en la tabla; despues A arma un club y le publica una pista, y B, que entra
//   al club, la ve en la lista del club.
// uso: node tools/pruebas/vercreador.mjs [http://127.0.0.1:8787] [parte]   (antes: node servidor/local.mjs 8787)
//   parte: 'mirar' saca solo las capturas del creador (compu y celular) sin publicar nada
import { abrir, irACard } from './ver.mjs';
const API = process.argv[2] || 'http://127.0.0.1:8787', PARTE = process.argv[3] || 'todo';
const permisos = { permissions: ['clipboard-read', 'clipboard-write'] };
const celular = { ...permisos, hasTouch: true, isMobile: true, deviceScaleFactor: 2 };
let mal = 0;
const ver = (que, si, detalle) => { console.log((si ? '  ok  ' : '  MAL ') + que + (si || detalle === undefined ? '' : ' -> ' + JSON.stringify(detalle))); if (!si) mal++; };
const texto = (pag, id) => pag.evaluate((id) => { const el = document.getElementById(id); return !el || el.hidden ? '' : el.textContent; }, id);
const visible = (pag, id) => pag.evaluate((id) => { const el = document.getElementById(id); if (!el) return false; const r = el.getBoundingClientRect(); return !el.closest('[hidden]') && r.width > 0 && r.height > 0; }, id);
const notas = (pag) => pag.evaluate(() => [...document.querySelectorAll('#crHoja .nota')].map((n) => n.title));
const apagadas = (pag) => pag.evaluate(() => [...document.querySelectorAll('#creador .cr-pieza.no-entra')].filter((b) => !b.hidden).map((b) => b.dataset.pieza));
const tocar = async (pag, ids) => { for (const id of ids) { await pag.evaluate((id) => document.querySelector('#creador [data-pieza="' + id + '"]').click(), id); await pag.waitForTimeout(40); } await pag.waitForTimeout(250); };
// corre la pasada dentro de la pagina con un piloto automatico; devuelve el estado final
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
const esperarFin = (pag) => pag.waitForFunction(() => !document.getElementById('fin').hidden, null, { timeout: 60000 });
const tabla = (pag, cual = 'tabla') => pag.evaluate((cual) => [...document.querySelectorAll('#' + cual + ' li')].map((li) => li.querySelector('.quien').firstChild.textContent + ' ' + li.querySelector('.tiempoMarca').textContent + (li.classList.contains('mio') ? ' (mio)' : '')), cual);
const cargada = (pag) => pag.waitForFunction(() => window.shakedown && !document.documentElement.classList.contains('cargando'), null, { timeout: 90000 });
// la pista de prueba: curvas de todo tipo, rectas, cosas del camino y del costado
const PISTA = ['r2', 'd4', 'ge', 'r1', 'i3', 'sa', 'r2', 'd5', 'pu', 'i2', 'r3', 'cn', 'd4', 'r2', 'i5', 'va', 'r2', 'pb', 'fa', 'd3', 'r1'];

// ---------- A: arma la pista ----------
const a = await abrir({ ruta: '?servidor=' + encodeURIComponent(API), contexto: permisos });
if (!a.cargo) { console.log('A NO CARGO\n' + a.errores.join('\n')); process.exit(1); }
let A = a.pag;
await cargada(A);
await A.evaluate(() => window.shakedown.club.ponerNombre('Juanma'));
await irACard(A, 'comunidad');
ver('A: en la card de la comunidad estan las pistas, todavia vacias, y el boton para armar una', await visible(A, 'armarPista') && await visible(A, 'comunidadVacia'), await texto(A, 'comunidadVacia'));
const ordenCards = await A.evaluate(() => [...document.querySelectorAll('.card')].map((c) => c.dataset.card).join(' > '));
ver('A: las cards, en orden: pista del dia, circuitos, reales, travesia, tutorial y comunidad (al final)', ordenCards === 'hoy > oficiales > reales > travesia > tutorial > comunidad', ordenCards);
ver('A: Mina Clavero esta en los reales y los oficiales no la repiten', await A.evaluate(() => /Giulio/.test(document.getElementById('catReales').textContent) && !/Giulio/.test(document.getElementById('circuitos').textContent)));
await A.screenshot({ path: 'out/creador-0-circuitos.png' });
await A.click('#armarPista');
await A.waitForTimeout(400);
ver('A: se abre el creador, con Leo', await visible(A, 'creador') && /copiloto/.test(await texto(A, 'crDice')), await texto(A, 'crDice'));
ver('A: arranca con la largada y la llegada, sin notas', JSON.stringify(await notas(A)) === JSON.stringify(['Largada', 'Llegada']), await notas(A));
ver('A: en el bosque no estan la cornisa ni las lajas', await A.evaluate(() => document.querySelector('[data-pieza="co"]').hidden && document.querySelector('[data-pieza="la"]').hidden));
await A.screenshot({ path: 'out/creador-1-vacio.png' });
await tocar(A, PISTA.slice(0, 6));
ver('A: las notas se suman en orden', (await notas(A)).length === 8 && (await notas(A))[2] === 'Derecha 4', await notas(A));
ver('A: todavia es corta: Leo dice cuanto falta', /faltan/.test(await texto(A, 'crDice')), await texto(A, 'crDice'));
await tocar(A, PISTA.slice(6));
const largo = await texto(A, 'crLargo');
ver('A: con todas las notas ya se puede correr', /se puede correr/.test(await texto(A, 'crDice')) && !(await A.evaluate(() => document.getElementById('crLargo').classList.contains('corta'))), [await texto(A, 'crDice'), largo]);
console.log('     ' + largo + ' · ' + await texto(A, 'crCuenta') + ' · apagadas: ' + (await apagadas(A)).join(' '));
await A.click('#crBorrar');
await A.waitForTimeout(200);
ver('A: "borrar la ultima" saca la ultima nota', (await notas(A)).length === PISTA.length + 1, (await notas(A)).length);
await tocar(A, ['r1']);
// una que no entra: se busca entre las apagadas
const noEntra = (await apagadas(A)).find((id) => !['ge', 'pi', 'cn', 'fa'].includes(id));
if (noEntra) {
  const antes = (await notas(A)).length;
  await tocar(A, [noEntra]);
  ver('A: una nota apagada no se suma, y Leo dice por que (' + noEntra + ')', (await notas(A)).length === antes && /no entra/.test(await texto(A, 'crDice')), await texto(A, 'crDice'));
} else console.log('     (todas las notas entran como siguiente)');
await A.click('#crAmbiente button[data-valor="montana"]');
await A.click('#crClima button[data-valor="lluvia"]');
await A.waitForTimeout(300);
ver('A: en la montaña aparecen la cornisa y las lajas, y el camino es el mismo', await A.evaluate(() => !document.querySelector('[data-pieza="co"]').hidden) && (await notas(A)).length === PISTA.length + 2, await notas(A));
await A.screenshot({ path: 'out/creador-2-armada.png', fullPage: false });
await A.evaluate(() => document.getElementById('creador').scrollTo(0, 9999));
await A.waitForTimeout(150);
await A.screenshot({ path: 'out/creador-3-abajo.png' });
if (PARTE === 'mirar') {
  // la misma, en un celular
  const m = await abrir({ ancho: 390, alto: 844, ruta: '?servidor=' + encodeURIComponent(API), contexto: celular });
  await cargada(m.pag);
  const borr = await A.evaluate(() => window.shakedown.club.borrador());
  await m.pag.evaluate((b) => { window.shakedown.club.ponerBorrador(b); window.shakedown.creador.abrir(); }, borr);
  await m.pag.waitForTimeout(500);
  await m.pag.screenshot({ path: 'out/creador-4-celular.png' });
  await m.pag.evaluate(() => document.getElementById('creador').scrollTo(0, 9999));
  await m.pag.waitForTimeout(200);
  await m.pag.screenshot({ path: 'out/creador-5-celular-abajo.png' });
  const e = [...a.errores, ...m.errores];
  console.log(e.length ? 'ERRORES:\n' + e.join('\n') : 'sin errores');
  await m.cerrar(); await a.cerrar();
  process.exit(mal ? 1 : 0);
}

// ---------- A: la prueba (el borrador) ----------
await A.click('#crProbar');
await A.waitForURL(/pista=borrador/, { timeout: 90000 });
await cargada(A);
ver('A: el borrador se abre como una pista mas: el inicio abre en la comunidad, con "Tu borrador" y el boton de seguir armando', /Tu borrador/.test(await texto(A, 'comunidad')) && await visible(A, 'editarPista') && (await A.evaluate(() => document.getElementById('home').dataset.card)) === 'comunidad', [await texto(A, 'comunidad'), await A.evaluate(() => document.getElementById('home').dataset.card)]);
ver('A: en el borrador no se comparte', !(await visible(A, 'compartirPortada')));
await A.screenshot({ path: 'out/creador-6-borrador.png' });
const finB = await correr(A, 'bueno', 'vitarita');
await esperarFin(A);
ver('A: corre el borrador y llega', finB.estado === 'llegada', finB);
ver('A: en el resultado del borrador no se comparte, y se puede seguir armando', !(await visible(A, 'social')) && /Seguir armando/.test(await A.evaluate(() => document.getElementById('irCircuitos').getAttribute('aria-label'))));
await A.waitForTimeout(800);
ver('A: lo del borrador no se sube', await A.evaluate(() => !window.shakedown.club.practica().id));
await A.screenshot({ path: 'out/creador-7-fin-borrador.png' });
await A.click('#irCircuitos');
await A.waitForTimeout(400);
ver('A: "seguir armando" vuelve al creador, con la misma pista', await visible(A, 'creador') && (await notas(A)).length === PISTA.length + 2, (await notas(A)).length);

// ---------- A: publica ----------
await A.click('#crPublicar');
await A.waitForTimeout(300);
ver('A: sin nombre de pista no publica', /nombre/.test(await texto(A, 'crDice')), await texto(A, 'crDice'));
await A.fill('#crNombre', 'La Curva del Tero');
await A.click('#crPublicar');
await A.waitForURL(/pista=\d{5}-\d+/, { timeout: 90000 });
await cargada(A);
const urlA = A.url(), [, numero, version] = /pista=(\d{5})-(\d+)/.exec(urlA);
const filaA = await A.evaluate(() => { const a = document.querySelector('#comunidad a.aca'); return a ? a.innerText.replace(/\s+/g, ' ') : ''; });
ver('A: publicada, se abre la pista (en la card de la comunidad, su fila)', /La Curva del Tero/.test(filaA) && /por vos/.test(filaA) && /quedan 14 días/.test(filaA), [filaA, urlA]);
ver('A: y avisa que esta publicada', /Publicada/.test(await texto(A, 'queEs')), await texto(A, 'queEs'));
ver('A: el borrador se borro', await A.evaluate(() => !window.shakedown.club.borrador()));
await A.screenshot({ path: 'out/creador-8-publicada.png' });
await A.click('#compartirPortada');
await A.waitForTimeout(500);
const pasaA = (await A.evaluate(() => navigator.clipboard.readText())).split('\n');
ver('A: comparte la pista firmada ("Pista «...» por Juanma"), con su link (numero y version) y Early Access', pasaA.length === 3 && pasaA[0] === 'Shakedown · Pista «La Curva del Tero» por Juanma 📝 ¿Quién la hace más rápido?' && pasaA[1].endsWith('?pista=' + numero + '-' + version) && pasaA[2] === '🚧 Early Access · App en desarrollo', pasaA);
console.log('     ' + pasaA.join(' | '));
const finA = await correr(A, 'bueno', 'kacito');
await esperarFin(A);
await A.waitForFunction(() => { const p = window.shakedown.club.practica(); return p && p.id; }, null, { timeout: 10000 }).catch(() => {});
ver('A: corre su pista y el tiempo se sube', finA.estado === 'llegada' && await A.evaluate(() => !!window.shakedown.club.practica().id), finA);
await A.click('#compartir');
await A.waitForTimeout(600);
const resA = (await A.evaluate(() => navigator.clipboard.readText())).split('\n');
ver('A: el resultado se comparte con la pista firmada y su link corto', /^Shakedown · Pista «La Curva del Tero» por Juanma 📝 ⏱️ \d\d:\d\d:\d\d .* 🏁 🚗323$/.test(resA[0]) && /#r=[0-9A-Za-z]{7}$/.test(resA[1]), resA);
console.log('     ' + resA.join(' | '));
await A.screenshot({ path: 'out/creador-9-fin-a.png' });

// ---------- B: abre el link de la pista en el celular ----------
const b = await abrir({ ancho: 390, alto: 844, ruta: '?servidor=' + encodeURIComponent(API) + '&pista=' + numero + '-' + version, contexto: celular });
if (!b.cargo) { console.log('B NO CARGO\n' + b.errores.join('\n')); process.exit(1); }
const B = b.pag;
await cargada(B);
const filaB = await B.evaluate(() => { const a = document.querySelector('#comunidad a.aca'); return a ? a.innerText.replace(/\s+/g, ' ') : ''; });
ver('B: abre la pista de A: el inicio abre en la comunidad, con quien la hizo', /La Curva del Tero/.test(filaB) && /por Juanma/.test(filaB), filaB);
await B.screenshot({ path: 'out/creador-10-celular-portada.png' });
await B.evaluate(() => window.shakedown.club.ponerNombre('Beto'));
const finB2 = await correr(B, 'bueno', 'vitarita');
await esperarFin(B);
await B.waitForFunction(() => { const p = window.shakedown.club.practica(); return p && p.id; }, null, { timeout: 10000 }).catch(() => {});
await B.evaluate(() => window.shakedown.tablasDeLosClubes(true));
await B.waitForTimeout(600);
const tb = await tabla(B, 'finTabla');
ver('B: en la tabla de la pista estan A y B', tb.length === 2 && tb.some((x) => x.startsWith('Juanma')) && tb.some((x) => x.startsWith('Beto') && x.endsWith('(mio)')), tb);
// B comparte su tiempo (en el celular se abre el menu de compartir: aca se lo reemplaza para leer el texto): la firma es de A
await B.evaluate(() => { window.__compartido = ''; navigator.share = (d) => { window.__compartido = d.text; return Promise.resolve(); }; });
await B.evaluate(() => document.getElementById('compartir').click());
await B.waitForFunction(() => window.__compartido, null, { timeout: 15000 }).catch(() => {});
const resB = (await B.evaluate(() => window.__compartido)).split('\n');
ver('B: su resultado tambien va con la firma de quien la armo (no la suya)', /^Shakedown · Pista «La Curva del Tero» por Juanma 📝 ⏱️ /.test(resB[0]) && !/Beto/.test(resB[0]) && /#r=[0-9A-Za-z]{7}$/.test(resB[1] || ''), resB);
console.log('     ' + resB.join(' | '));
await B.screenshot({ path: 'out/creador-11-celular-fin.png' });
// A abre la tabla: ve a B (y a si mismo una sola vez)
await A.click('#salir');
await A.evaluate(() => window.shakedown.tablasDeLosClubes(true));
await A.waitForTimeout(600);
await A.click('[data-panel="tabla"]');
await A.waitForTimeout(400);
const ta = await tabla(A);
ver('A: en su tabla aparece B, y el mismo una sola vez', ta.length === 2 && ta.filter((x) => x.startsWith('Juanma')).length === 1 && ta.some((x) => x.startsWith('Beto')), ta);
await A.click('#cerrarPanel');
// en la card de la comunidad de A, su pista
await irACard(A, 'comunidad');
const listaA = await A.evaluate(() => [...document.querySelectorAll('#comunidad a')].map((x) => x.textContent));
ver('A: su pista esta en la lista de la comunidad, con su tiempo', listaA.length === 1 && /La Curva del Tero/.test(listaA[0]) && /por vos/.test(listaA[0]) && /\d\d:\d\d:\d\d/.test(listaA[0]), listaA);

// ---------- A arma un club y le publica una pista; B entra al club y la ve ----------
await A.click('[data-panel="tabla"]');
await A.waitForTimeout(300);
await A.click('#clubes button.mas');
await A.fill('#clubNombre', 'Los Tercos');
await A.click('#clubNuevo button');
await A.waitForFunction(() => window.shakedown.club.clubes().length === 1, null, { timeout: 8000 }).catch(() => {});
const clubA = await A.evaluate(() => window.shakedown.club.clubes()[0]);
await A.waitForTimeout(400);
ver('A: en su club, la lista de pistas del club (vacia) y el boton para armar una', await visible(A, 'clubPistas') && await visible(A, 'clubPistasVacia') && await visible(A, 'clubArmar'));
await A.screenshot({ path: 'out/creador-12-club-vacio.png' });
await A.click('#clubArmar');
await A.waitForTimeout(400);
ver('A: el creador se abre para el club', await A.evaluate((c) => !!document.querySelector('#crPara button.elegido') && document.querySelector('#crPara button.elegido').textContent === c.nombre, clubA));
await tocar(A, ['r3', 'd3', 'r2', 'i4', 'r3', 'd5', 'r2', 'i3', 'r2', 'ge', 'd4', 'r3']);
await A.fill('#crNombre', 'Subida del Club');
const antesDePublicar = A.url();
await A.click('#crPublicar');
await A.waitForURL((u) => u.href !== antesDePublicar && /pista=\d{5}-\d+/.test(u.href), { timeout: 90000 });
await cargada(A);
const [, numeroClub] = /pista=(\d{5})-(\d+)/.exec(A.url());
ver('A: la pista del club dice de que club es', /Los Tercos/.test(await A.evaluate(() => { const a = document.querySelector('#comunidad a.aca'); return a ? a.innerText : ''; })), await texto(A, 'comunidad'));
await A.click('[data-panel="tabla"]');
await A.waitForTimeout(300);
await A.click('#clubes button:nth-child(2)');
await A.waitForTimeout(400);
const delClub = await A.evaluate(() => [...document.querySelectorAll('#clubPistasLista a')].map((x) => x.textContent));
ver('A: la pista aparece en la lista del club', delClub.length === 1 && /Subida del Club/.test(delClub[0]), delClub);
await A.screenshot({ path: 'out/creador-13-club-con-pista.png' });
await A.click('#clubInvitar');
await A.waitForTimeout(400);
const inv = (await A.evaluate(() => navigator.clipboard.readText())).split('\n')[1];
const B2 = b.pag;
await B2.goto(b.base + '?servidor=' + encodeURIComponent(API) + '#club=' + /#club=(\w+)/.exec(inv)[1]);
await cargada(B2);
await B2.waitForFunction(() => !document.getElementById('panelTabla').hidden && window.shakedown.club.clubes().length === 1, null, { timeout: 15000 }).catch(() => {});
await B2.waitForTimeout(800);
const deB = await B2.evaluate(() => [...document.querySelectorAll('#clubPistasLista a')].map((x) => x.textContent + ' -> ' + x.getAttribute('href')));
ver('B: al entrar al club ve sus pistas', deB.length === 1 && /Subida del Club/.test(deB[0]) && deB[0].includes('?pista=' + numeroClub + '-'), deB);
await B2.screenshot({ path: 'out/creador-14-celular-club.png' });
await B2.click('#cerrarPanel');
await irACard(B2, 'comunidad', true);
const listaB = await B2.evaluate(() => [...document.querySelectorAll('#comunidad a')].map((x) => (x.querySelector('.marca-club') ? '[' + x.querySelector('.marca-club').textContent + '] ' : '') + x.textContent));
ver('B: en sus circuitos estan las dos pistas: la que abrio por link y la del club (con la marca del club y quien la armo)', listaB.length === 2 && listaB.some((x) => /^\[Los Tercos\] .*Subida del Club.*por Juanma/.test(x)) && listaB.some((x) => /^📝La Curva del Tero.*por Juanma/.test(x)), listaB);
await B2.screenshot({ path: 'out/creador-15-celular-circuitos.png' });

// ---------- borrar: cada uno borra las suyas (desde la lista o desde el creador) ----------
await A.click('#cerrarPanel').catch(() => {});
await irACard(A, 'comunidad');
const tachos = await A.evaluate(() => [...document.querySelectorAll('#comunidad li')].map((li) => li.querySelector('b').textContent + (li.querySelector('button.tacho') ? ' [tacho]' : '')));
ver('A: sus dos pistas tienen el tacho', tachos.length === 2 && tachos.every((x) => x.endsWith('[tacho]')), tachos);
const tachoDe = (nombre) => A.evaluate((nombre) => [...document.querySelectorAll('#comunidad li')].find((li) => li.querySelector('b').textContent === nombre).querySelector('button.tacho').click(), nombre);
await tachoDe('La Curva del Tero');
await A.waitForTimeout(200);
ver('A: el primer toque pregunta', await A.evaluate(() => /Tocá de nuevo/.test(document.getElementById('comunidad').textContent)));
await A.screenshot({ path: 'out/creador-16-borrar.png' });
// (la captura tarda: se espera a que la pregunta se venza, y se toca dos veces seguidas)
await A.waitForTimeout(6500);
ver('A: si no se toca de nuevo, la pregunta se va sola', await A.evaluate(() => !/Tocá de nuevo/.test(document.getElementById('comunidad').textContent)));
await tachoDe('La Curva del Tero');
await A.waitForTimeout(150);
await tachoDe('La Curva del Tero');
await A.waitForFunction(() => document.querySelectorAll('#comunidad li').length === 1, null, { timeout: 15000 }).catch(() => {});
const quedanA = await A.evaluate(() => [...document.querySelectorAll('#comunidad li b')].map((b) => b.textContent));
ver('A: el segundo la borra', quedanA.length === 1 && quedanA[0] === 'Subida del Club', [quedanA, await texto(A, 'comunidad')]);
const borrada = await (await fetch(API + '/pistas/' + numero)).json();
ver('A: en el servidor ya no esta', /borró/.test(borrada.error || ''), borrada);
await A.click('#armarPista');
await A.waitForTimeout(400);
ver('A: en el creador, sus pistas publicadas: 1 de 5', /1 de 5/.test(await texto(A, 'crMiasTitulo')), await texto(A, 'crMiasTitulo'));
await A.screenshot({ path: 'out/creador-17-mias.png' });
await A.evaluate(() => document.querySelector('#crMiasLista button.tacho').click());
await A.waitForTimeout(150);
await A.evaluate(() => document.querySelector('#crMiasLista button.tacho').click());
await A.waitForURL((u) => !/pista=/.test(u.search), { timeout: 90000 });
await cargada(A);
ver('A: si borra la que estaba corriendo, vuelve a la pista de hoy', /^#\d+$/.test(await texto(A, 'pistaNumero')), [A.url(), await texto(A, 'pistaNumero')]);
await B2.evaluate(() => window.shakedown.tablasDeLosClubes(true));
await B2.waitForTimeout(800);
ver('B: la pista borrada se va de la lista del club y de sus pistas', await B2.evaluate(() => window.shakedown.club.pistas().every((p) => p.nombre !== 'Subida del Club')), await B2.evaluate(() => window.shakedown.club.pistas().map((p) => p.nombre)));

// ---------- un link de una pista que no existe ----------
await B2.goto(b.base + '?servidor=' + encodeURIComponent(API) + '&pista=' + (Number(numero) === 15999 ? 15998 : Number(numero) + 1) + '-1');
await cargada(B2);
ver('B: una pista que no existe: avisa y queda la de hoy', /no existe/.test(await texto(B2, 'queEs')) && /^#\d+$/.test(await texto(B2, 'pistaNumero')), [await texto(B2, 'queEs'), await texto(B2, 'pistaNumero')]);

const errores = [...a.errores, ...b.errores].filter((x) => !/Failed to load resource.*(404|410)/.test(x));
console.log(errores.length ? 'ERRORES:\n' + errores.join('\n') : 'sin errores en la consola');
await a.cerrar(); await b.cerrar();
console.log(mal ? 'FALLARON ' + mal : 'todo bien');
process.exit(mal ? 1 : 0);

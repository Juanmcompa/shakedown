// El garaje: armar el auto con partes, que quede guardado, que se corra con el y que el fantasma lo muestre.
// uso: node tools/pruebas/vergaraje.mjs   (sin servidor: el link lleva la pasada entera)
import { abrir } from './ver.mjs';
let mal = 0;
const ver = (que, si, detalle) => { console.log((si ? '  ok  ' : '  MAL ') + que + (si || detalle === undefined ? '' : ' -> ' + JSON.stringify(detalle))); if (!si) mal++; };
const cargada = (pag) => pag.waitForFunction(() => window.shakedown && !document.documentElement.classList.contains('cargando'), null, { timeout: 120000 });
const texto = (pag, sel) => pag.evaluate((sel) => { const el = document.querySelector(sel); return el ? el.textContent.replace(/\s+/g, ' ').trim() : ''; }, sel);
const flecha = (pag, tipo, cual) => pag.evaluate(([tipo, cual]) => document.querySelector('.parte[data-tipo="' + tipo + '"] button:' + (cual === 'mas' ? 'last-of-type' : 'first-of-type')).click(), [tipo, cual]);
// corre con el piloto automatico (la referencia del piloto es la del auto armado)
const correr = (pag) => pag.evaluate(async () => {
  const { decidir, PILOTOS } = await import('/tools/piloto.mjs'), { crearReferencia } = await import('/src/referencia.js'), { JUEGO } = await import('/src/config.js'), { azar } = await import('/src/noise.js'), { configDe } = await import('/src/partes.js');
  const s = window.shakedown, DT = JUEGO.paso, o = PILOTOS.bueno;
  s.largar(); s.avanzar(3.2);
  const c = s.auto(), p = s.partida, ref = crearReferencia(s.T, configDe(s.club.auto())), rnd = azar(7), ent = { x: 0, y: 0, mano: false }, m = {};
  let t = 0, prox = 0, pasos = 0;
  while (t < 600 && p.estado === 'corriendo') {
    if (t >= prox) { prox = t + o.reaccion * (0.7 + 0.6 * rnd()); decidir(s.T, ref, c, p, o, m, rnd, t, ent); }
    c.paso(ent, DT); t += DT;
    if (++pasos % 2 === 0) s.avanzar(DT * 2);
  }
  s.saltearEspera();
  return s.estado();
});

// ---------- A: arma su auto ----------
const a = await abrir({ ancho: 1280, alto: 720, contexto: { permissions: ['clipboard-read', 'clipboard-write'] } });
if (!a.cargo) { console.log('NO CARGO\n' + a.errores.join('\n')); process.exit(1); }
const A = a.pag;
await cargada(A);
ver('en la portada esta tu auto: la Vitarita, 333', /La Vitarita/.test(await texto(A, '#miAuto')) && /333/.test(await texto(A, '#miAuto')), await texto(A, '#miAuto'));
await A.click('#miAuto');
await A.waitForTimeout(1500);
ver('el garaje se abre con las tres partes y las cinco fichas', await A.evaluate(() => !document.getElementById('panelGaraje').hidden && document.querySelectorAll('.parte').length === 3 && document.querySelectorAll('.ficha').length === 5));
await A.screenshot({ path: 'out/garaje-1-vitarita.png' });
await flecha(A, 'motor', 'mas');
await A.waitForTimeout(400);
const g1 = await A.evaluate(() => ({ codigo: document.getElementById('codigoAuto').textContent, guardado: window.shakedown.club.auto(), enPista: window.shakedown.auto().datos.codigo, gano: document.querySelectorAll('.barra i.gano').length, perdio: document.querySelectorAll('.barra i.perdio').length }));
ver('motor siguiente: 433, en la pista y guardado, y las fichas marcan lo que cambio', g1.codigo === '433' && g1.guardado === '433' && g1.enPista === '433' && g1.gano + g1.perdio > 0, g1);
await A.screenshot({ path: 'out/garaje-2-turbo.png' });
await flecha(A, 'chasis', 'menos'); await A.waitForTimeout(200); await flecha(A, 'chasis', 'menos'); await A.waitForTimeout(200);
await flecha(A, 'ruedas', 'menos'); await A.waitForTimeout(200); await flecha(A, 'ruedas', 'menos'); await A.waitForTimeout(200); await flecha(A, 'ruedas', 'menos');
await A.waitForTimeout(600);
const g2 = await A.evaluate(() => ({ codigo: document.getElementById('codigoAuto').textContent, chasis: document.querySelector('.parte[data-tipo="chasis"] .cual b').textContent, ruedas: document.querySelector('.parte[data-tipo="ruedas"] .cual b').textContent, modelo: window.shakedown.auto().datos.modelo }));
ver('buggy con ruedas de barro (las flechas dan la vuelta): 415', g2.codigo === '415' && /Buggy/.test(g2.chasis) && /Patonas/.test(g2.ruedas) && g2.modelo === 'buggy', g2);
await A.fill('#nombreAuto', 'La Colorada');
await A.evaluate(() => document.getElementById('nombreAuto').dispatchEvent(new Event('change')));
await A.screenshot({ path: 'out/garaje-3-buggy.png' });
await A.click('#listoAuto');
await A.reload();
await cargada(A);
ver('al volver a abrir el juego sigue tu auto, con su nombre', /La Colorada/.test(await texto(A, '#miAuto')) && /415/.test(await texto(A, '#miAuto')) && await A.evaluate(() => window.shakedown.auto().datos.codigo === '415'), await texto(A, '#miAuto'));
await A.screenshot({ path: 'out/garaje-4-portada.png' });

// ---------- corre con el ----------
await A.evaluate(() => window.shakedown.club.ponerNombre('Juanma'));
const e = await correr(A);
await A.waitForFunction(() => !document.getElementById('fin').hidden, null, { timeout: 60000 });
const r = await A.evaluate(async () => { const o = window.shakedown.club.oficial(); for (let i = 0; i < 50 && !window.shakedown.club.oficial().codigo; i++) await new Promise((s) => setTimeout(s, 100)); return window.shakedown.club.oficial(); });
ver('corre con su auto: el resultado dice 415', ['llegada', 'abandono'].includes(e.estado) && r.auto === '415', [e.estado, r.auto]);
const marca = await A.evaluate(async (codigo) => (await (await import('/src/fantasma.js')).leerCodigo(codigo)).marca, r.codigo);
ver('el link lleva las partes del auto', marca.auto === '415', marca.auto);
await A.click('#compartir');
await A.waitForTimeout(600);
const msj = (await A.evaluate(() => navigator.clipboard.readText())).split('\n')[0];
ver('el mensaje termina con el auto: 🏎️415', / 🏎️415$/.test(msj), msj);
console.log('     ' + msj);
const tabla = await A.evaluate(() => [...document.querySelectorAll('#finTabla li .quien')].map((x) => x.textContent));
console.log('     ' + e.estado + ' ' + (e.tiempo || 0).toFixed(2) + ' s · ' + JSON.stringify(tabla));
const link = r.codigo;
await a.cerrar();

// ---------- B: abre el link y corre contra el fantasma del buggy ----------
const b = await abrir({ ancho: 1280, alto: 720, ruta: '#r=' + link });
if (!b.cargo) { console.log('B NO CARGO\n' + b.errores.join('\n')); process.exit(1); }
const B = b.pag;
await cargada(B);
ver('B: corre contra Juanma, que va en el buggy 415', await B.evaluate(() => { const r = window.shakedown.estado(); return r.rival === 'Juanma'; }));
const tB = await B.evaluate(() => [...document.querySelectorAll('#panelTabla .quien, #tabla .quien')].map((x) => x.textContent));
await B.evaluate(() => { const s = window.shakedown; s.largar(); s.avanzar(3.2); s.avanzar(1.2); });
await B.waitForTimeout(1500);
await B.screenshot({ path: 'out/garaje-5-fantasma.png' });
await b.cerrar();

// ---------- en el celular ----------
const m = await abrir({ ancho: 390, alto: 844, contexto: { hasTouch: true, isMobile: true, deviceScaleFactor: 2 } });
await cargada(m.pag);
await m.pag.click('#miAuto');
await m.pag.waitForTimeout(1500);
await m.pag.screenshot({ path: 'out/garaje-6-celular.png' });
const alto = await m.pag.evaluate(() => document.getElementById('panel').scrollHeight);
console.log('     alto del garaje en el celular: ' + alto + ' px (pantalla: 844)');
await m.pag.evaluate(() => document.getElementById('panel').scrollTo(0, 9999));
await m.pag.waitForTimeout(300);
await m.pag.screenshot({ path: 'out/garaje-7-celular-abajo.png' });
for (const [q, j] of [['A', a], ['B', b], ['celular', m]]) ver(q + ': sin errores en la consola', !j.errores.length, j.errores.slice(0, 3));
await m.cerrar();
console.log(mal ? 'FALLARON ' + mal : 'todo bien');
process.exit(mal ? 1 : 0);

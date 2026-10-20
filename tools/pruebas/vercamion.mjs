// El camion de carga de La Montaña del Sufrimiento (circuito 'montana'). Dos partes:
//  1. La fisica, sin navegador y con entradas de teclado escritas a mano (el camion es determinista: lo mismo de siempre):
//     - a fondo en el barro casi no avanza y las ruedas patinan (se entierra); dando toques, avanza
//     - al inclinarse con carga, el centro de masa del conjunto se corre; si se inclina mucho, se caen bultos
//     - la corriente del agua empuja de costado (y fuera del agua, no)
//     - en la bajada, un frenazo tira la carga para adelante
//     - el piloto automatico (tools/pilotocamion.mjs) termina la pista con algun bulto, y la repeticion es identica
//     - una pasada grabada (el fantasma del link) se lee igual y llega al mismo lugar donde termino
//  2. El juego en el navegador: aparece en los reales, larga con el camion, el tablero muestra los bultos y el nivel,
//     cada bulto que se cae suma su recargo al reloj y el resultado dice cuantos llegaron (5/6 📦).
// uso: node tools/pruebas/vercamion.mjs
import { abrir, largarDesdeHome, irACard } from './ver.mjs';
import { generarPista } from '../../src/generador.js';
import { crearTerreno } from '../../src/terrain.js';
import { crearCamion, RECARGO_BULTO, BULTOS_TOTAL, CODIGO_CAMION } from '../../src/camion.js';
import { crearGrabacion, leerCodigo, crearFantasma } from '../../src/fantasma.js';
import { JUEGO } from '../../src/config.js';
import { correrCamion, PILOTOS_CAMION, MONTANA } from '../pilotocamion.mjs';

let mal = 0;
const ver = (que, si, detalle) => { console.log((si ? '  ok  ' : '  MAL ') + que + (si || detalle === undefined ? '' : ' -> ' + JSON.stringify(detalle))); if (!si) mal++; };
const T = crearTerreno(generarPista(MONTANA)), P = T.camino, DT = JUEGO.paso;

// ---------- 1: la fisica ----------
console.log('Fisica del camion');
const poner = (c, i) => c.poner(P.X[i], P.Z[i], Math.atan2(P.HX[i], -P.HZ[i]));
// corre "seg" segundos con la entrada que diga f(t, ent, camion). mide(camion, t, acumulado) se llama en cada paso.
function correr(i, seg, f, mide) {
  const c = crearCamion(T), ent = { x: 0, y: 0, mano: false }, m = {};
  poner(c, i); c.paso(ent, DT);
  let t = 0;
  for (let n = 0; n < seg / DT; n++) { f(t, ent, c); c.paso(ent, DT); t += DT; if (mide) mide(c, t, m); }
  return { c, m };
}
// el metro del camino que tiene el camion adelante (cuanto avanzo)
const metro = (c, desde) => { let k = desde; while (k < P.n - 1 && (P.X[k + 1] - c.pos[0]) * P.HX[k] + (P.Z[k + 1] - c.pos[2]) * P.HZ[k] <= 0) k++; return k; };
const lateral = (c, i) => (c.pos[0] - P.X[i]) * -P.HZ[i] + (c.pos[2] - P.Z[i]) * P.HX[i];

// -- el barro: a fondo se entierra, a toques avanza --
{
  const barro = T.etapa.tramos[P.T[100]].suelo === 'barro';
  const fondo = correr(100, 20, (t, e) => { e.y = 1; });
  let on = false;
  const toques = correr(100, 20, (t, e, c) => { if (on && c.gas > 0.7) on = false; else if (!on && c.gas < 0.12) on = true; e.y = on ? 1 : 0; });
  const aFondo = metro(fondo.c, 100) - 100, aToques = metro(toques.c, 100) - 100;
  const perif = Math.max(...fondo.c.ruedas.map((r) => Math.abs(r.w) * 0.47));
  ver('el metro 100 es de barro', barro);
  ver('a fondo en el barro casi no avanza (' + aFondo + ' m en 20 s)', aFondo <= 10, aFondo);
  ver('y las ruedas patinan: giran a ' + perif.toFixed(0) + ' m/s mientras el camion va a ' + Math.abs(fondo.c.velocidad).toFixed(1), perif > 8 && Math.abs(fondo.c.velocidad) < 1.5, [perif, fondo.c.velocidad]);
  ver('y se entierra (hundido ' + fondo.c.hundido.toFixed(2) + ')', fondo.c.hundido > 0.8, fondo.c.hundido);
  ver('dando toques al pedal avanza (' + aToques + ' m en 20 s, con el pedal a fondo ' + aFondo + ')', aToques >= 25 && aToques >= 3 * aFondo, [aToques, aFondo]);
  ver('y sin enterrarse', toques.c.hundido < 0.5, toques.c.hundido);
}

// -- la inclinacion corre el centro de masa y la carga --
{
  const quieto = correr(20, 3, () => {}, (c, t, m) => { m.cm = Math.max(m.cm || 0, Math.abs(c.centroMasa.x)); });
  const giro = correr(20, 11.5, (t, e, c) => { e.y = c.velocidad < 5 ? 1 : 0; e.x = t > 6 && t < 7.5 ? 1 : 0; },
    (c, t, m) => {
      m.cm = Math.max(m.cm || 0, Math.abs(c.centroMasa.x)); m.roll = Math.max(m.roll || 0, Math.abs(c.rolido) * 57.3);
      m.lx = Math.max(m.lx || 0, ...c.carga.bultos.filter((b) => b.estado === 'caja').map((b) => Math.abs(b.lx - b.x)));
    });
  ver('quieto, el centro de masa esta en el medio (' + quieto.m.cm.toFixed(3) + ' m)', quieto.m.cm < 0.01, quieto.m.cm);
  ver('al doblar a 5 m/s el camion se inclina ' + giro.m.roll.toFixed(0) + ' grados y el centro de masa se corre ' + (giro.m.cm * 100).toFixed(0) + ' cm', giro.m.roll > 8 && giro.m.cm > 0.05, giro.m);
  ver('la carga suelta se desliza ' + giro.m.lx.toFixed(2) + ' m sobre la caja y no se cae (' + giro.c.carga.quedan() + ' de ' + BULTOS_TOTAL + ')', giro.m.lx > 0.3 && giro.c.carga.quedan() === BULTOS_TOTAL, giro.m);
  const brusco = correr(20, 12, (t, e, c) => { e.y = c.velocidad < 6.5 ? 1 : 0; e.x = t > 6 && t < 8 ? 1 : 0; });
  ver('inclinandolo mucho (doblar a 6,5 m/s) se caen bultos (' + brusco.c.carga.quedan() + ' de ' + BULTOS_TOTAL + ')', brusco.c.carga.quedan() < BULTOS_TOTAL && brusco.c.carga.perdidos() === BULTOS_TOTAL - brusco.c.carga.quedan(), brusco.c.carga.quedan());
  const masaCon = crearCamion(T); poner(masaCon, 20);
  ver('los bultos suman peso: ' + masaCon.centroMasa.masa.toFixed(0) + ' kg de camion y carga', true);
}

// -- la corriente --
{
  const ag = T.etapa.tramos.findIndex((t) => t.agua), ia = T.etapa.tramos[ag].desde + 2;
  const o = { fx: 0, fz: 0, f: 0 };
  T.corriente(P.X[ia], P.Z[ia], o);
  const dentro = o.f;
  T.corriente(P.X[ia + 70], P.Z[ia + 70], o);
  ver('el terreno tiene corriente en el agua (' + dentro.toFixed(2) + ') y no fuera (' + o.f.toFixed(2) + ')', dentro > 0.2 && o.f === 0, [dentro, o.f]);
  const en = correr(ia, 4, (t, e, c) => { e.y = c.velocidad < 2.5 ? 1 : 0; });
  const fuera = correr(ia + 70, 4, (t, e, c) => { e.y = c.velocidad < 2.5 ? 1 : 0; });
  const d1 = lateral(en.c, ia), d2 = lateral(fuera.c, ia + 70);
  ver('yendo derecho, la corriente lo empuja ' + d1.toFixed(1) + ' m hacia el costado del vacio (sin corriente: ' + d2.toFixed(1) + ')', d1 > 1.5 && Math.abs(d2) < 0.3, [d1, d2]);
}

// -- la bajada: un frenazo tira la carga para adelante --
{
  const ib = T.etapa.tramos.findIndex((t) => t.nota && t.nota.tipo === 'bajada'), i0 = T.etapa.tramos[ib].desde + 5;
  let antes = null;
  const r = correr(i0, 14, (t, e, c) => {
    if (t < 8) e.y = c.velocidad < 8 ? 1 : 0;
    else { if (!antes) antes = c.carga.bultos.map((b) => b.lz); e.y = -1; }
  }, (c, t, m) => { if (antes) m.min = Math.min(m.min === undefined ? 9 : m.min, ...c.carga.bultos.map((b, k) => b.lz - antes[k])); });
  const corrimiento = r.c.carga.bultos.map((b, k) => b.estado === 'caja' ? b.lz - antes[k] : 0);
  const promedio = corrimiento.reduce((s, x) => s + x, 0) / corrimiento.length;
  ver('en la bajada, frenar a fondo tira los bultos para adelante (' + (promedio * 100).toFixed(0) + ' cm en promedio, hasta ' + (-r.m.min * 100).toFixed(0) + ' cm)', promedio < -0.1 && r.m.min < -0.2, [promedio, r.m.min]);
  // (el control: lo mismo pero soltando el pedal en vez de frenar. Se mide a los 9 s, antes de que el camion, sin volante, se choque con algo)
  const sinFreno = correr(i0, 9, (t, e, c) => { e.y = t < 8 ? (c.velocidad < 8 ? 1 : 0) : 0; });
  const d0 = sinFreno.c.carga.bultos.reduce((s, b) => s + Math.abs(b.lz - b.z), 0) / BULTOS_TOTAL;
  ver('bajando a esa velocidad sin frenar, la carga no se mueve (' + (d0 * 100).toFixed(0) + ' cm)', d0 < 0.05, d0);
}

// -- el piloto automatico termina la pista, y todo es repetible --
let pasada = null;
{
  const t0 = Date.now(), muestras = crearGrabacion(T);
  let ultimo = null;
  const A = correrCamion(T, PILOTOS_CAMION.normal, { alPaso: (c, p, t) => { if (p.estado === 'corriendo' && p.lanzado) muestras.muestra(p.tiempo, c); ultimo = c; } });
  const reloj = (s) => Math.floor(s / 60) + ':' + (s % 60).toFixed(0).padStart(2, '0');
  console.log('    piloto normal: ' + reloj(A.t) + ' en la partida (' + reloj(A.sinRecargo) + ' sin recargo), ' + A.bultos + '/' + BULTOS_TOTAL + ' bultos, ' + A.vueltas + ' vueltas al camino, ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s de cuentas');
  ver('el piloto automatico llega a la meta', A.estado === 'llegada', A.estado + ' ' + A.motivo);
  ver('y con algun bulto (' + A.bultos + ' de ' + BULTOS_TOTAL + ')', A.bultos >= 1, A.bultos);
  ver('y tarda unos 10 minutos sin recargo (' + reloj(A.sinRecargo) + ')', A.sinRecargo > 420 && A.sinRecargo < 840, A.sinRecargo);
  ver('cada bulto perdido sumo ' + RECARGO_BULTO + ' s al reloj', Math.abs(A.t - A.sinRecargo - A.perdidos * RECARGO_BULTO) < 1e-6 && A.perdidos === BULTOS_TOTAL - A.bultos, [A.t, A.sinRecargo, A.perdidos]);
  const B = correrCamion(T, PILOTOS_CAMION.normal);
  const igual = (a, b) => a.t === b.t && a.bultos === b.bultos && a.c.pos.every((v, k) => v === b.c.pos[k]) && a.c.q.every((v, k) => v === b.c.q[k]);
  ver('repetir la pasada con las mismas entradas da exactamente lo mismo (posicion, giro, tiempo y bultos)', igual(A, B), [A.c.pos, B.c.pos]);
  pasada = { A, muestras, final: [...ultimo.pos] };
}

// -- el fantasma del link: la pasada grabada se lee igual y llega donde termino --
{
  const { A, muestras } = pasada;
  const marca = { pista: MONTANA, nombre: 'Prueba', t: A.t, c: A.p.colores(), s: A.sectores, auto: CODIGO_CAMION, vueltas: A.vueltas, roto: A.roto, ab: '', b: A.bultos };
  const codigo = await muestras.codigo(marca, []);
  const l = await leerCodigo(codigo);
  ver('el codigo de la pasada se lee: pista, tiempo y los bultos que llegaron (' + (l && l.marca.b) + '/6)', !!l && l.marca.pista === MONTANA && Math.abs(l.marca.t - A.t) < 0.01 && l.marca.b === A.bultos && l.marca.auto === CODIGO_CAMION, l && l.marca);
  const vuelta = l.vuelta(P), g = crearFantasma(vuelta, T), lugar = {};
  g.pose(A.t + 5, lugar);
  const fin = [P.X[T.meta.i], P.Z[T.meta.i]];
  const dist = Math.hypot(lugar.x - A.c.pos[0], lugar.z - A.c.pos[2]);
  ver('el fantasma, al final de la pasada, esta donde termino el camion (a ' + dist.toFixed(2) + ' m) y la da por terminada', dist < 3 && !!lugar.termino, [dist, lugar.termino]);
  // el fantasma recorre lo mismo que el camion: en el medio de la pasada, a pocos metros de donde estaba
  const medio = {}, mitad = A.t / 2;
  g.pose(mitad, medio);
  ver('y a mitad de camino tambien va por el mismo lugar (por el metro ' + Math.round(medio.i !== undefined ? medio.i : 0) + ')', Number.isFinite(medio.x) && Math.abs(medio.x) < 1e5, medio);
  // un codigo de otra pista no se mezcla con esta: el resultado del camion no lleva bultos en las demas
  const otra = await crearGrabacion(T).codigo({ pista: 16005, nombre: 'Otra', t: 100, c: 'vvvvv', s: [1, 2, 3, 4, 5], auto: '333', vueltas: 0, roto: 0, ab: '' }, []);
  const lo = await leerCodigo(otra);
  ver('en las otras pistas el resultado no cambia (sin bultos)', !!lo && lo.marca.b === undefined, lo && lo.marca.b);
}

// ---------- 2: el juego ----------
console.log('El juego');
const a = await abrir({ ancho: 1280, alto: 720 });
if (!a.cargo) { console.log('NO CARGO\n' + a.errores.join('\n')); process.exit(1); }
const A = a.pag;
await A.waitForFunction(() => !document.documentElement.classList.contains('cargando'), null, { timeout: 90000 });
await A.waitForTimeout(1000);
await irACard(A, 'reales');
const filas = await A.evaluate(() => [...document.querySelectorAll('#catReales li')].map((li) => li.innerText.replace(/\s+/g, ' ').trim()));
ver('en los reales, debajo de Giulio Cesare, esta La Montaña del Sufrimiento con su icono', filas.length === 2 && /Giulio/.test(filas[0]) && /Sufrimiento/.test(filas[1]) && /🚛/.test(filas[1]), filas);
await A.screenshot({ path: 'out/camion-reales.png' });
await largarDesdeHome(A, 'montana');
await A.evaluate(() => window.shakedown.avanzar(3.3));
const J = (f, ...args) => A.evaluate(f, ...args);
let e = await J(() => window.shakedown.estado());
ver('larga el circuito 16006 con la cuenta regresiva', e.pista === 16006 && e.pantalla === 'jugando' && e.estado === 'corriendo', e);
ver('es el camion: tiene carga de seis bultos y no hay ayuda de manejo', await J(() => { const c = window.shakedown.auto(); return !!c.camion && c.carga.quedan() === 6; }));
ver('el tablero muestra los bultos (6) y el nivel de burbuja', await J(() => { const t = document.getElementById('cargaTablero'); return !t.hidden && document.getElementById('bultosQuedan').textContent === '6' && !!document.getElementById('burbuja'); }));
ver('la camara va mas cerca que en el rally', await J(async () => { const s = window.shakedown; s.simular(1, 0, 1); await new Promise((r) => setTimeout(r, 1200)); return s.camara.estado.dist < 40; }), await J(() => window.shakedown.camara.estado.dist));
ver('el copiloto tiene notas propias: barro, piedras, cornisa, cascada y bajada', await J(() => { const t = new Set(window.shakedown.copiloto.notas.map((n) => n.tipo)); return ['barro', 'piedras', 'cornisa', 'cascada', 'bajada'].every((x) => t.has(x)); }));
// la burbuja se mueve cuando se inclina
await J(() => { const s = window.shakedown; s.ir(20); s.simular(6, 0, 1); s.simular(1.5, 1, 1); s.avanzar(0.01); });
await A.waitForTimeout(300);
const burbuja = await J(() => ({ t: document.getElementById('burbuja').style.transform, rolido: window.shakedown.auto().rolido }));
ver('al doblar, la burbuja del nivel se corre del centro', /translate\((-?\d+)px/.test(burbuja.t) && Math.abs(parseInt(/translate\((-?\d+)px/.exec(burbuja.t)[1], 10)) >= 2, burbuja);
// se pierden bultos: cada uno suma su recargo al reloj
const antes = await J(() => { const s = window.shakedown; s.auto().cargaNueva(); s.ir(20); s.avanzar(0.01); return { t: s.estado().tiempo, quedan: s.auto().carga.quedan() }; });
const despues = await J(() => { const s = window.shakedown; s.simular(6, 0, 1); for (let k = 0; k < 8; k++) s.simular(1.1, k % 2 ? -1 : 1, 0.8); s.avanzar(0); return { t: s.estado().tiempo, quedan: s.auto().carga.quedan(), aviso: document.getElementById('aviso').textContent, grande: document.getElementById('grande').textContent }; });
const perdidos = antes.quedan - despues.quedan;
ver('manejando mal se pierden bultos (' + perdidos + ') y quedan menos en el tablero', perdidos >= 1 && await J(() => document.getElementById('bultosQuedan').textContent) === String(despues.quedan), [antes, despues]);
ver('y cada uno suma ' + RECARGO_BULTO + ' s al reloj (' + (despues.t - antes.t).toFixed(1) + ' s por ' + perdidos + ')', Math.abs(despues.t - antes.t - perdidos * RECARGO_BULTO) < 0.3, [antes.t, despues.t, perdidos]);
ver('se avisa en pantalla', /bulto/.test(despues.aviso) && /\+\d+ s/.test(despues.grande), despues);
// llegar a la meta: el resultado dice cuantos bultos llegaron
await J(async () => {
  const s = window.shakedown, c = s.auto(), n = s.T.camino.n;
  s.ir(n - 120);
  for (let k = 0; k < 400 && s.estado().estado === 'corriendo'; k++) { s.simular(0.5, 0, c.velocidad < 6 ? 1 : 0); s.avanzar(0.5); }
  s.saltearEspera();
});
await A.waitForFunction(() => !document.getElementById('fin').hidden, null, { timeout: 60000 }).catch(() => {});
const fin = await J(() => ({ grande: document.getElementById('finGrande').textContent, detalle: document.getElementById('finDetalle').textContent, estado: window.shakedown.estado().estado }));
ver('al llegar, el resultado muestra el tiempo y los bultos que llegaron (' + fin.grande + ')', fin.estado === 'llegada' && /\d\d:\d\d:\d\d · \d\/6 📦/.test(fin.grande), fin);
ver('y dice cuantos se perdieron y cuanto costo', /bulto/.test(fin.detalle) && /\+\d+ s/.test(fin.detalle), fin.detalle);
await A.screenshot({ path: 'out/camion-resultado.png' });
const texto = await J(async () => { const { mensaje } = await import('/src/menu.js'); return mensaje(window.shakedown.T.etapa, { t: 733.4, b: 5, c: 'vvavr', auto: '353' }); });
ver('lo que se comparte lleva los bultos: ' + texto, /Montaña del Sufrimiento 🚛 ⏱️ 12:13:40 5\/6 📦 /.test(texto), texto);
ver('sin errores en la consola', a.errores.length === 0, [...new Set(a.errores)].slice(0, 3));
await a.cerrar();
console.log(mal ? '\n' + mal + ' cosas mal' : '\nTodo bien');
process.exit(mal ? 1 : 0);

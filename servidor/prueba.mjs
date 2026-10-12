// Pruebas del servidor: arma pasadas de verdad (con el grabador del juego), las sube y revisa lo que contesta.
//   node servidor/prueba.mjs                         prueba el programa directo, con una base en la memoria
//   node servidor/prueba.mjs http://127.0.0.1:8787   prueba un servidor que ya esta andando (el de prueba o el de Cloudflare)
import servidor, { LIMITES } from './worker.js';
import { baseLocal } from './local.mjs';
import { crearTerreno } from '../src/terrain.js';
import { generarPista, anotarPista } from '../src/generador.js';
import { armarHoja } from '../src/hoja.js';
import { COMUNIDAD } from '../src/circuitos.js';
import { crearGrabacion } from '../src/fantasma.js';
import { hoy } from '../src/dia.js';

const BASE = process.argv[2] || '', env = { DB: BASE ? null : baseLocal() };
let bien = 0, mal = 0;
const ver = (que, si, detalle) => { if (si) bien++; else { mal++; console.log('  MAL:', que, detalle === undefined ? '' : JSON.stringify(detalle)); } };

// un pedido: devuelve { estado, cosa, cabeza }
async function pedir(metodo, ruta, cuerpo, cabeza = {}) {
  // (al servidor publicado hay que decirle que el pedido viene del juego: si no, no deja escribir)
  const deDonde = BASE && !/\/\/(localhost|127\.0\.0\.1)[:/]/.test(BASE + '/') ? { origin: 'https://juanmcompa.github.io' } : {};
  const datos = { method: metodo, headers: { 'content-type': 'text/plain', ...deDonde, ...cabeza }, body: cuerpo === undefined ? undefined : typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo) };
  const r = BASE ? await fetch(BASE + ruta, datos) : await servidor.fetch(new Request('http://localhost' + ruta, datos), env, { waitUntil: (p) => p.catch(() => {}) });
  let cosa = null;
  try { cosa = await r.json(); } catch (e) { /* sin cuerpo */ }
  return { estado: r.status, cosa, cabeza: r.headers };
}

// una pasada de mentira pero bien formada: el auto va por el medio del camino a 50 km/h
async function pasada(T, m = {}) {
  const r = { pista: T.etapa.numero, nombre: 'Juanma', t: 120, s: [24, 24, 24, 24, 24], c: 'vvavv', auto: 'vitarita', ab: '', vueltas: 0, roto: 0, practica: false, ayuda: false, ...m };
  const g = crearGrabacion(T), P = T.camino, n = Math.floor((m.dura === undefined ? r.t : m.dura) / 0.5) + 1, i0 = T.vuelta ? T.vuelta.desde : T.largada.i;
  for (let k = 0; k < n; k++) {
    const i = Math.min(P.n - 2, i0 + Math.round(k * 7));
    g.muestra(k * 0.5, { pos: [P.X[i], T.altura(P.X[i], P.Z[i]), P.Z[i]], adelante: [P.HX[i], 0, P.HZ[i]] });
  }
  return g.codigo(r, m.tabla || []);
}
const llave = (letra) => letra.repeat(24);

const N = hoy(), T = crearTerreno(generarPista(N));
console.log('Pista de hoy: #' + N + (BASE ? ' · servidor ' + BASE : ' · programa directo'));
const A = llave('a'), B = llave('b'), C = llave('c'), sufijo = Math.random().toString(36).slice(2, 8);   // (para que cada corrida use corredores nuevos en un servidor que ya tiene datos)
const [LA, LB, LC] = [A, B, C].map((x) => x + sufijo);

// --- lo basico ---
let r = await pedir('GET', '/');
ver('la portada contesta', r.estado === 200 && r.cosa.juego === 'Shakedown' && r.cosa.hoy === N, r);
r = await pedir('GET', '/cualquiera');
ver('lo que no existe da 404', r.estado === 404, r);
r = await pedir('POST', '/pasadas', 'esto no es json');
ver('un pedido roto da 400', r.estado === 400, r);

// --- subir una pasada y volver a traerla ---
const codA = await pasada(T, { nombre: 'Ana', t: 131.42 });
r = await pedir('POST', '/pasadas', { llave: LA, codigo: codA });
ver('guarda una pasada y da un codigo corto', r.estado === 200 && /^[0-9A-Za-z]{7}$/.test(r.cosa.id), r);
const idA = r.cosa && r.cosa.id;
console.log('  el link pasa de', codA.length, 'letras a', String(idA).length);
r = await pedir('GET', '/pasadas/' + idA);
ver('devuelve la misma pasada, con el numero de corredor', r.estado === 200 && r.cosa.codigo === codA && /^[\w-]{16}$/.test(r.cosa.j), r.estado);
const jA = r.cosa && r.cosa.j;
r = await pedir('POST', '/pasadas', { llave: LA, codigo: codA });
ver('subirla de nuevo da el mismo codigo', r.estado === 200 && r.cosa.id === idA, r);
r = await pedir('POST', '/pasadas', { llave: LA, codigo: await pasada(T, { nombre: 'Anita', t: 131.42 }) });
ver('con otro apodo sigue siendo la misma pasada', r.estado === 200 && r.cosa.id === idA, r);
r = await pedir('POST', '/pasadas', { llave: LA, codigo: await pasada(T, { nombre: 'Ana', t: 99.5 }) });
ver('no acepta una segunda oficial distinta', r.estado === 409, r);
r = await pedir('GET', '/pasadas/zzzzzzz');
ver('una pasada que no existe da 404', r.estado === 404, r);

// --- lo que no se acepta ---
r = await pedir('POST', '/pasadas', { llave: LB, codigo: 'dAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' });
ver('basura no entra', r.estado === 400, r);
r = await pedir('POST', '/pasadas', { llave: LB, codigo: await pasada(T, { nombre: 'Tramposo', t: 60, dura: 131 }) });
ver('un tiempo que no coincide con lo grabado no entra', r.estado === 400, r);
r = await pedir('POST', '/pasadas', { llave: LB, codigo: await pasada(T, { nombre: 'Futuro', pista: N + 5 }) });
ver('una pista que todavia no empezo no entra (y avisa que es por ahora)', r.estado === 425, r);
r = await pedir('POST', '/pasadas', { llave: 'corta', codigo: codA });
ver('sin llave no entra', r.estado === 400, r);

// --- clubes ---
r = await pedir('POST', '/clubes', { llave: LA, nombre: '  Los <b>Pi\u202ebes</b>  del \u200f  barro\u0007 ', apodo: 'Anita' });
ver('crea un club con el nombre limpio', r.estado === 200 && /^[0-9A-Za-z]{8}$/.test(r.cosa.codigo) && r.cosa.nombre === 'Los bPibes/b del barro' && r.cosa.miembros === 1, r);
const club = r.cosa && r.cosa.codigo;
r = await pedir('POST', '/clubes', { llave: LA, nombre: 'x' });
ver('un club sin nombre no se crea', r.estado === 400, r);
r = await pedir('GET', '/clubes/' + club);
ver('la invitacion muestra el club', r.estado === 200 && r.cosa.miembros === 1 && r.cosa.nombre.startsWith('Los'), r);
r = await pedir('GET', '/clubes/noexiste1');
ver('un club que no existe da 404', r.estado === 404, r);
r = await pedir('POST', '/clubes/' + club + '/entrar', { llave: LB, apodo: 'Beto' });
ver('B se suma', r.estado === 200 && r.cosa.miembros === 2, r);
r = await pedir('POST', '/clubes/' + club + '/entrar', { llave: LB, apodo: 'Beto' });
ver('sumarse dos veces no duplica', r.estado === 200 && r.cosa.miembros === 2, r);
r = await pedir('POST', '/clubes/' + club + '/entrar', { llave: LC, apodo: 'Caro' });
ver('C se suma', r.estado === 200 && r.cosa.miembros === 3, r);

// B corre la oficial y dos practicas; C todavia no corrio
const codB = await pasada(T, { nombre: 'Beto', t: 125.03, auto: 'kacito', ayuda: true });
r = await pedir('POST', '/pasadas', { llave: LB, codigo: codB });
const idB = r.cosa && r.cosa.id;
ver('B sube su oficial', r.estado === 200 && idB && idB !== idA, r);
r = await pedir('POST', '/pasadas', { llave: LB, codigo: await pasada(T, { nombre: 'Beto', t: 119.2, practica: true }) });
const idP1 = r.cosa && r.cosa.id;
r = await pedir('POST', '/pasadas', { llave: LB, codigo: await pasada(T, { nombre: 'Beto', t: 117.8, practica: true }) });
const idP2 = r.cosa && r.cosa.id;
ver('las practicas son pasadas aparte', idP1 && idP2 && idP1 !== idP2 && idP1 !== idB, [idB, idP1, idP2]);

r = await pedir('POST', '/tablas', { llave: LA, pista: N, version: 1, clubes: [club, 'noexiste1'] });
const t = r.cosa && r.cosa.clubes && r.cosa.clubes[club];
ver('la tabla del club contesta', r.estado === 200 && t && t.miembros === 3 && t.soy === true, r.cosa);
if (t) {
  const of = t.tabla.filter((x) => !x.practica), pr = t.tabla.filter((x) => x.practica);
  ver('estan las dos oficiales', of.length === 2 && of.some((x) => x.nombre === 'Anita' && x.mio && x.t === 131.42 && x.id === idA && x.j === jA) && of.some((x) => x.nombre === 'Beto' && !x.mio && x.auto === 'kacito' && x.ayuda === true && x.c === 'vvavv'), of);
  ver('de las practicas, solo la mejor de cada uno', pr.length === 1 && pr[0].t === 117.8 && pr[0].id === idP2, pr);
  ver('dice quien falta correr', JSON.stringify(t.faltan) === JSON.stringify(['Caro']), t.faltan);
}
ver('un club que no existe vuelve vacio', r.cosa && r.cosa.clubes.noexiste1 === null, r.cosa && r.cosa.clubes);
// el apodo que vale es el de ahora: si alguien se lo cambia (sin volver a correr), cambia en la tabla
await pedir('POST', '/clubes/' + club + '/entrar', { llave: LB, apodo: 'Betito' });
r = await pedir('POST', '/tablas', { llave: LA, pista: N, version: 1, clubes: [club] });
ver('la tabla muestra el apodo de ahora', r.estado === 200 && r.cosa.clubes[club].miembros === 3 && r.cosa.clubes[club].tabla.filter((x) => !x.mio).length === 2 && r.cosa.clubes[club].tabla.filter((x) => !x.mio).every((x) => x.nombre === 'Betito'), r.cosa);
await pedir('POST', '/clubes/' + club + '/entrar', { llave: LB, apodo: 'Beto' });
r = await pedir('POST', '/tablas', { llave: LC, pista: N + 1, version: 1, clubes: [club] });
ver('otra pista: tabla vacia y faltan los otros dos', r.estado === 200 && r.cosa.clubes[club].tabla.length === 0 && r.cosa.clubes[club].faltan.length === 2, r.cosa);

// el tiempo de un corredor vale para todos sus clubes, tambien los que arma despues
r = await pedir('POST', '/clubes', { llave: LB, nombre: 'Diseño 3', apodo: 'Beto' });
const otro = r.cosa && r.cosa.codigo;
r = await pedir('POST', '/tablas', { llave: LB, pista: N, version: 1, clubes: [club, otro] });
ver('la oficial de B figura en sus dos clubes', r.estado === 200 && r.cosa.clubes[otro].tabla.some((x) => x.id === idB && x.mio) && r.cosa.clubes[club].tabla.some((x) => x.id === idB && x.mio), r.cosa);
ver('cada club tiene su gente', r.cosa.clubes[otro].miembros === 1 && r.cosa.clubes[club].miembros === 3, r.cosa);

// salir
r = await pedir('POST', '/clubes/' + club + '/salir', { llave: LC });
ver('C sale del club', r.estado === 200, r);
r = await pedir('GET', '/clubes/' + club);
ver('quedan dos', r.cosa && r.cosa.miembros === 2, r);
r = await pedir('POST', '/clubes/' + otro + '/salir', { llave: LB });
r = await pedir('GET', '/clubes/' + otro);
ver('un club sin nadie se borra', r.estado === 404, r);

// --- las pistas de la comunidad ---
const HOJA = { v: 1, a: 'campo', c: 'sol', p: ['r2', 'd3', 'ge', 'r1', 'i4', 'sa', 'r2', 'd5', 'pu', 'i2', 'r3', 'd4', 'cn', 'r2', 'i5', 'va', 'r2'] };
r = await pedir('POST', '/pistas', { llave: LA, nombre: 'La <Curva> del Tero', apodo: 'Anita', club: '', hoja: HOJA });
const pistaLibre = r.cosa && r.cosa.numero;
ver('publica una pista con link (sin club)', r.estado === 200 && pistaLibre >= COMUNIDAD.desde && pistaLibre <= COMUNIDAD.hasta && r.cosa.version >= 1 && r.cosa.nombre === 'La Curva del Tero' && r.cosa.autor === 'Anita' && r.cosa.vence - Date.now() / 1000 > 13.9 * 86400, r);
r = await pedir('POST', '/pistas', { llave: LA, nombre: 'Rota', apodo: 'Anita', hoja: { v: 1, a: 'marte', c: 'sol', p: ['r1'] } });
ver('una hoja que no se puede leer no entra', r.estado === 400, r);
r = await pedir('POST', '/pistas', { llave: LA, nombre: 'Petisa', apodo: 'Anita', hoja: { v: 1, a: 'campo', c: 'sol', p: ['r1', 'd3'] } });
ver('una pista demasiado corta no entra', r.estado === 400 && /corta/.test(r.cosa.error), r);
r = await pedir('POST', '/pistas', { llave: LA, nombre: 'Enroscada', apodo: 'Anita', hoja: { v: 1, a: 'campo', c: 'sol', p: ['r3', 'r3', 'dh', 'r3', 'r3'] } });
ver('una pista que se cruza no entra', r.estado === 400 && /cruza/.test(r.cosa.error), r);
r = await pedir('POST', '/pistas', { llave: LA, nombre: 'X', apodo: 'Anita', hoja: HOJA });
ver('una pista sin nombre no entra', r.estado === 400, r);
r = await pedir('POST', '/pistas', { llave: LA, nombre: 'Sin autor', apodo: '', hoja: HOJA });
ver('sin el nombre de quien la publica no entra', r.estado === 400, r);
r = await pedir('POST', '/pistas', { llave: LB, nombre: 'Pista del club', apodo: 'Beto', club, hoja: { ...HOJA, a: 'bosque', c: 'lluvia' } });
const pistaClub = r.cosa && r.cosa.numero;
ver('alguien del club publica una pista para el club', r.estado === 200 && r.cosa.club === club && pistaClub !== pistaLibre, r);
r = await pedir('POST', '/pistas', { llave: LC, nombre: 'Colada', apodo: 'Caro', club, hoja: HOJA });
ver('quien no esta en el club no puede publicarle pistas', r.estado === 403, r);
r = await pedir('POST', '/pistas', { llave: LC, nombre: 'Fantasma', apodo: 'Caro', club: 'noexiste1', hoja: HOJA });
ver('ni en un club que no existe', r.estado === 404, r);
r = await pedir('GET', '/pistas/' + pistaLibre);
const vLibre = r.cosa && r.cosa.version;
ver('trae la pista, con su hoja y su tabla vacia', r.estado === 200 && JSON.stringify(r.cosa.hoja) === JSON.stringify(HOJA) && r.cosa.nombre === 'La Curva del Tero' && r.cosa.autor === 'Anita' && r.cosa.club === '' && r.cosa.tabla.length === 0, r);
r = await pedir('GET', '/pistas/' + pistaClub);
ver('la del club dice de que club es', r.estado === 200 && r.cosa.club === club && r.cosa.clubNombre.startsWith('Los'), r);
ver('una pista que no existe da 404', (await pedir('GET', '/pistas/abc')).estado === 404 && (await pedir('GET', '/pistas/12345')).estado === 404 && (await pedir('GET', '/pistas/' + (pistaLibre === COMUNIDAD.hasta ? pistaLibre - 1 : pistaLibre + 1))).estado === 404);
// se corre: hay que armarla como la arma el juego (con su version) para grabar pasadas de verdad
const etapaLibre = armarHoja(HOJA, pistaLibre, 'La Curva del Tero').etapa;
anotarPista(etapaLibre, vLibre);
const TL = crearTerreno(etapaLibre);
r = await pedir('POST', '/pasadas', { llave: LA, codigo: await pasada(TL, { nombre: 'Anita', t: 70.5, practica: true }) });
const idL1 = r.cosa && r.cosa.id;
ver('se sube una pasada en una pista de la comunidad', r.estado === 200 && idL1, r);
r = await pedir('POST', '/pasadas', { llave: LA, codigo: await pasada(TL, { nombre: 'Anita', t: 74.25, practica: true }) });
r = await pedir('POST', '/pasadas', { llave: LC, codigo: await pasada(TL, { nombre: 'Caro', t: 66.1, practica: true }) });
ver('cualquiera con el link la puede correr', r.estado === 200, r);
r = await pedir('POST', '/pasadas', { llave: LB, codigo: await pasada(TL, { nombre: 'Beto', t: 69, practica: false }) });
ver('en una pista de la comunidad no hay oficial', r.estado === 400, r);
r = await pedir('GET', '/pistas/' + pistaLibre);
ver('la tabla de la pista: el mejor tiempo de cada uno, del mas rapido al mas lento', r.estado === 200 && r.cosa.tabla.map((x) => x.nombre + ' ' + x.t).join() === 'Caro 66.1,Anita 70.5' && r.cosa.tabla[1].id === idL1 && /^[\w-]{16}$/.test(r.cosa.tabla[0].j), r.cosa && r.cosa.tabla);
// en la tabla del club: sus pistas, y en una pista del club, los tiempos de su gente
const etapaClub = armarHoja({ ...HOJA, a: 'bosque', c: 'lluvia' }, pistaClub, 'Pista del club').etapa, vClub = (await pedir('GET', '/pistas/' + pistaClub)).cosa.version;
anotarPista(etapaClub, vClub);
r = await pedir('POST', '/pasadas', { llave: LA, codigo: await pasada(crearTerreno(etapaClub), { nombre: 'Anita', t: 80, practica: true }) });
r = await pedir('POST', '/tablas', { llave: LB, pista: pistaClub, version: vClub, clubes: [club] });
{
  const t = r.cosa && r.cosa.clubes[club];
  ver('la tabla del club trae sus pistas vigentes', t && t.pistas.length === 1 && t.pistas[0].numero === pistaClub && t.pistas[0].autor === 'Beto' && t.pistas[0].vence > Date.now() / 1000, t && t.pistas);
  ver('y en la pista del club, los tiempos de su gente (como en un circuito)', t && t.tabla.length === 1 && t.tabla[0].nombre === 'Anita' && t.tabla[0].practica && JSON.stringify(t.faltan) === JSON.stringify([]), t);
}
// borrar: solo quien la armo. Se va con sus tiempos, y su lugar queda libre.
ver('cada uno puede tener hasta cinco pistas vigentes', LIMITES.pistasPorJugador === 5, LIMITES.pistasPorJugador);
r = await pedir('POST', '/pistas/' + pistaLibre + '/borrar', { llave: LB });
ver('una pista ajena no se puede borrar', r.estado === 403, r);
r = await pedir('POST', '/pistas/' + pistaLibre + '/borrar', {});
ver('sin llave, tampoco', r.estado === 400, r);
r = await pedir('POST', '/pistas/' + pistaLibre + '/borrar', { llave: LA });
ver('quien la armo la puede borrar', r.estado === 200 && r.cosa.borrada === true, r);
r = await pedir('GET', '/pistas/' + pistaLibre);
ver('una pista borrada da 410 y dice que la borraron', r.estado === 410 && /borró/.test(r.cosa.error), r);
r = await pedir('POST', '/pasadas', { llave: LC, codigo: await pasada(TL, { nombre: 'Caro', t: 65, practica: true }) });
ver('en una pista borrada ya no se suben pasadas', r.estado === 410, r);
r = await pedir('POST', '/pistas/' + pistaLibre + '/borrar', { llave: LA });
ver('borrarla de nuevo da 404', r.estado === 404, r);
if (!BASE) ver('y sus tiempos se borraron del servidor', (await env.DB.prepare('SELECT COUNT(*) AS n FROM pasadas WHERE pista = ?1').bind(pistaLibre).first()).n === 0);
if (!BASE) {
  // vence: no se trae, no se corre y no figura en el club. Y su numero se puede volver a usar, con la version siguiente.
  await env.DB.prepare('UPDATE pistas SET vence = ?1 WHERE numero = ?2').bind(Math.floor(Date.now() / 1000) - 5, pistaClub).run();
  r = await pedir('GET', '/pistas/' + pistaClub);
  ver('una pista vencida da 410', r.estado === 410, r);
  r = await pedir('POST', '/pasadas', { llave: LA, codigo: await pasada(crearTerreno(etapaClub), { nombre: 'Anita', t: 79, practica: true }) });
  ver('en una pista vencida ya no se suben pasadas', r.estado === 410, r);
  r = await pedir('POST', '/tablas', { llave: LB, pista: N, version: 1, clubes: [club] });
  ver('y del club se va', r.cosa.clubes[club].pistas.length === 0, r.cosa.clubes[club].pistas);
  const rango = { desde: COMUNIDAD.desde, hasta: COMUNIDAD.hasta };
  COMUNIDAD.desde = COMUNIDAD.hasta = pistaClub;   // (solo queda libre ese numero)
  r = await pedir('POST', '/pistas', { llave: LB, nombre: 'La segunda', apodo: 'Beto', club, hoja: HOJA });
  ver('el numero de una pista vencida se vuelve a usar, con la version siguiente', r.estado === 200 && r.cosa.numero === pistaClub && r.cosa.version === vClub + 1, r);
  r = await pedir('GET', '/pistas/' + pistaClub);
  ver('y la pista nueva arranca con la tabla vacia (los tiempos de la vieja no se mezclan)', r.estado === 200 && r.cosa.nombre === 'La segunda' && r.cosa.tabla.length === 0, r.cosa);
  r = await pedir('POST', '/pistas', { llave: LA, nombre: 'Sin lugar', apodo: 'Anita', hoja: HOJA });
  ver('si no queda ningun numero libre, avisa', r.estado === 503, r);
  Object.assign(COMUNIDAD, rango);
  const topes = { ...LIMITES };
  LIMITES.pistasPorClub = 1;
  r = await pedir('POST', '/pistas', { llave: LA, nombre: 'Otra del club', apodo: 'Anita', club, hoja: HOJA });
  ver('un club no puede tener demasiadas pistas vigentes', r.estado === 400, r);
  LIMITES.pistasPorClub = topes.pistasPorClub;
  LIMITES.pistasPorJugador = 1;
  r = await pedir('POST', '/pistas', { llave: LB, nombre: 'Otra mas', apodo: 'Beto', hoja: HOJA });
  ver('ni un corredor (y le dice que puede borrar alguna)', r.estado === 400 && /Borrá/.test(r.cosa.error), r);
  r = await pedir('POST', '/pistas/' + pistaClub + '/borrar', { llave: LB });
  r = await pedir('POST', '/pistas', { llave: LB, nombre: 'Otra mas', apodo: 'Beto', hoja: HOJA });
  ver('pero si borra una, puede publicar otra', r.estado === 200, r);
  r = await pedir('POST', '/tablas', { llave: LB, pista: N, version: 1, clubes: [club] });
  ver('y la que borro ya no figura en el club', r.cosa.clubes[club].pistas.length === 0, r.cosa.clubes[club].pistas);
  LIMITES.pistasPorJugador = topes.pistasPorJugador;
  LIMITES.pistasPorConexion = 1;
  const publica = async (k) => (await pedir('POST', '/pistas', { llave: llave('s') + k, nombre: 'Lluvia ' + k, apodo: 'S', hoja: HOJA }, { 'cf-connecting-ip': '4.4.4.4' })).estado;
  ver('una conexion no puede publicar demasiadas por dia', [await publica(1), await publica(2)].join() === '200,429');
  LIMITES.pistasPorConexion = topes.pistasPorConexion;
}

// --- quien puede usarlo desde un navegador ---
r = await pedir('GET', '/', undefined, { origin: 'https://juanmcompa.github.io' });
ver('el juego publicado puede', r.cabeza.get('access-control-allow-origin') === 'https://juanmcompa.github.io', r.cabeza.get('access-control-allow-origin'));
r = await pedir('GET', '/', undefined, { origin: 'http://127.0.0.1:5173' });
ver('una copia local puede', r.cabeza.get('access-control-allow-origin') === 'http://127.0.0.1:5173', r.cabeza.get('access-control-allow-origin'));
r = await pedir('GET', '/', undefined, { origin: 'https://otra-pagina.example' });
ver('otra pagina no', r.cabeza.get('access-control-allow-origin') === 'https://juanmcompa.github.io', r.cabeza.get('access-control-allow-origin'));
r = await pedir('OPTIONS', '/pasadas', undefined, { origin: 'https://juanmcompa.github.io' });
ver('contesta la consulta previa del navegador', r.estado === 204, r.estado);

// --- los limites (solo con el programa directo: en un servidor de verdad no se puede cambiar el tope) ---
if (!BASE) {
  // una base recien nacida no tiene tablas: el primer pedido las crea y sigue como si nada
  const nueva = { DB: baseLocal() };
  const primero = await servidor.fetch(new Request('http://localhost/clubes/noexiste1'), nueva, {});
  ver('con la base vacia, el primer pedido crea las tablas', primero.status === 404 && (await primero.json()).error === 'Ese club no existe.', primero.status);
  const segundo = await servidor.fetch(new Request('http://localhost/pasadas', { method: 'POST', body: JSON.stringify({ llave: llave('n'), codigo: codA }) }), { DB: baseLocal() }, {});
  ver('tambien si lo primero que llega es una pasada', segundo.status === 200 && /^[0-9A-Za-z]{7}$/.test((await segundo.json()).id), segundo.status);
  // el servidor publicado solo le deja escribir al juego publicado (leer puede cualquiera)
  const publicado = async (metodo, ruta, origen, cuerpo, mas = {}) => {
    const r = await servidor.fetch(new Request('https://shakedown.ejemplo.workers.dev' + ruta, { method: metodo, headers: { ...(origen ? { origin: origen } : {}), ...mas }, body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo) }), env, {});
    return { estado: r.status, permite: r.headers.get('access-control-allow-origin'), cosa: await r.json().catch(() => null) };
  };
  const practica = { llave: llave('m'), codigo: await pasada(T, { nombre: 'Publi', t: 150, practica: true }) };
  let q = await publicado('POST', '/pasadas', 'https://juanmcompa.github.io', practica);
  ver('publicado: el juego publicado puede subir', q.estado === 200 && q.permite === 'https://juanmcompa.github.io', q);
  q = await publicado('POST', '/pasadas', 'http://localhost:5173', practica);
  ver('publicado: una copia local no puede subir', q.estado === 403 && q.permite === 'https://juanmcompa.github.io', q);
  q = await publicado('POST', '/clubes', 'https://otra-pagina.example', { llave: llave('m'), nombre: 'Colados', apodo: 'X' });
  ver('publicado: otra pagina no puede crear clubes', q.estado === 403, q);
  q = await publicado('POST', '/pasadas', '', practica);
  ver('publicado: sin decir de donde viene, tampoco', q.estado === 403, q);
  q = await publicado('GET', '/clubes/' + club, 'https://otra-pagina.example');
  ver('publicado: leer se puede, pero el navegador de otra pagina no lo muestra', q.estado === 200 && q.permite === 'https://juanmcompa.github.io', q);
  q = await publicado('POST', '/pasadas', 'https://juanmcompa.github.io', undefined, { 'content-length': '999999' });
  ver('un pedido gigante se rechaza sin leerlo', q.estado === 413, q);
  // un reloj adelantado: la pista de mañana se acepta solo un rato antes de la medianoche
  const manana = await pasada(crearTerreno(generarPista(N + 1)), { nombre: 'Apurado', t: 141, pista: N + 1, practica: true });
  const adelanto = LIMITES.adelanto;
  LIMITES.adelanto = 0;
  r = await pedir('POST', '/pasadas', { llave: llave('k'), codigo: manana });
  ver('la pista de mañana, todavia no', r.estado === 425, r);
  LIMITES.adelanto = 86400;
  r = await pedir('POST', '/pasadas', { llave: llave('k'), codigo: manana });
  ver('pero si falta poco para la medianoche, si', r.estado === 200, r);
  LIMITES.adelanto = adelanto;
  const topes = { ...LIMITES };
  const sube = async (quien, ip, k) => (await pedir('POST', '/pasadas', { llave: llave(quien) + k, codigo: await pasada(T, { nombre: 'Lluvia', t: 100 + k, practica: true }) }, { 'cf-connecting-ip': ip })).estado;
  const anotado = (ip) => env.DB.prepare("SELECT COALESCE(SUM(n), 0) AS n FROM limites WHERE clave LIKE 'p:%'").first().then((f) => f.n);
  LIMITES.pasadasPorConexion = 3;
  const antes = await anotado();
  const estados = [];
  for (let k = 0; k < 7; k++) estados.push(await sube('z', '9.9.9.9', k));
  ver('frena a la conexion que sube demasiadas', estados.join() === '200,200,200,429,429,429,429', estados);
  ver('y deja de anotar los pedidos de mas', (await anotado()) - antes === 4, (await anotado()) - antes);
  ver('pero no frena a otra conexion', (await sube('y', '8.8.8.8', 0)) === 200);
  // de una direccion IPv6 cuenta la primera mitad: cambiar la segunda no sirve para esquivar el tope
  const v6 = [];
  for (const [k, ip] of ['2800:810:5e8:1a2b::1', '2800:810:5e8:1a2b:ffff::2', '2800:0810:05e8:1A2B:1:2:3:4', '2800:810:5e8:1a2b:9:9:9:9', '2800:810:5e8:1a2c::1'].entries()) v6.push(await sube('w', ip, k));
  ver('las direcciones IPv6 de una misma casa cuentan como una', v6.join() === '200,200,200,429,200', v6);
  LIMITES.pasadasPorConexion = topes.pasadasPorConexion;
  LIMITES.pasadasPorDia = 0;
  ver('con el cupo del dia agotado no recibe mas pasadas', (await sube('v', '7.7.7.7', 0)) === 429);
  LIMITES.pasadasPorDia = topes.pasadasPorDia;
  // clubes: crear y sumarse tambien tienen tope
  const crea = async (k) => pedir('POST', '/clubes', { llave: llave('u') + k, nombre: 'Club ' + k, apodo: 'U' + k }, { 'cf-connecting-ip': '6.6.6.6' });
  LIMITES.clubesPorConexion = 2;
  const c1 = await crea(1), c2 = await crea(2), c3 = await crea(3);
  ver('frena a la conexion que crea demasiados clubes', c1.estado === 200 && c2.estado === 200 && c3.estado === 429, [c1.estado, c2.estado, c3.estado]);
  LIMITES.clubesPorConexion = topes.clubesPorConexion;
  LIMITES.entradasPorConexion = 2;
  const entra = async (k) => (await pedir('POST', '/clubes/' + c1.cosa.codigo + '/entrar', { llave: llave('t') + k, apodo: 'T' + k }, { 'cf-connecting-ip': '5.5.5.5' })).estado;
  const e = [await entra(1), await entra(2), await entra(1), await entra(3)];
  ver('y a la que suma demasiada gente (volver a entrar no cuenta)', e.join() === '200,200,200,429', e);
  LIMITES.entradasPorConexion = topes.entradasPorConexion;
  LIMITES.miembrosPorClub = 3;
  ver('un club completo no recibe mas gente', (await entra(4)) === 400);
  LIMITES.miembrosPorClub = topes.miembrosPorClub;
  LIMITES.clubesPorJugador = 1;
  r = await pedir('POST', '/clubes/' + c2.cosa.codigo + '/entrar', { llave: llave('t') + 1, apodo: 'T1' });
  ver('un corredor no puede estar en demasiados clubes', r.estado === 400, r);
  LIMITES.clubesPorJugador = topes.clubesPorJugador;
}

console.log(mal ? 'FALLARON ' + mal + ' de ' + (bien + mal) : 'Todo bien: ' + bien + ' pruebas');
process.exit(mal ? 1 : 0);

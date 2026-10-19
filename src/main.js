// SHAKEDOWN: arma el juego y corre el ciclo principal.
import * as THREE from '../vendor/three.module.js';
import { JUEGO, AUTOS, REFERENCIA, AYUDA, GUSTOS, SERVIDOR, gradosDeInclinacion } from './config.js';
import { hoy } from './dia.js';
import { generarPista, versionDe, anotarPista } from './generador.js';
import { esCircuito, circuitoDe, esDeLaComunidad, COMUNIDAD } from './circuitos.js';
import { armarHoja, huellaDeHoja } from './hoja.js';
import { crearTerreno } from './terrain.js';
import { crearReferencia } from './referencia.js';
import { crearAuto, enSerio } from './vehicle.js';
import { crearPartida } from './reglas.js';
import { crearAyuda } from './ayuda.js';
import { crearCopiloto } from './copiloto.js';
import { crearGrabacion, leerCodigo, crearFantasma, codigoSinVuelta } from './fantasma.js';
import { crearClub, guardado } from './club.js';
import { crearNube } from './nube.js';
import { crearMenu } from './menu.js';
import { crearCreador } from './creador.js';
import { crearTutorial } from './tutorial.js';
import { crearMundo } from './world.js';
import { crearPost } from './post.js';
import { crearDibujo, crearEspectro } from './autos.js';
import { crearCamara } from './camera.js';
import { ambiente } from './material.js';
import { crearEfectos } from './fx.js';
import { crearHuellas } from './huellas.js';
import { crearTrazada } from './trazada.js';
import { crearSonido } from './audio.js';
import { crearTeclas } from './input.js';
import { crearHud, tiempoFinal } from './hud.js';
import { crearPapelitos } from './papelitos.js';
import { configDe, codigoDe } from './partes.js';
import { crearModoTravesia } from './travesia.js';
import { leerEnlaceTravesia } from './travesiaenlace.js';

const $ = (id) => document.getElementById(id), raiz = document.documentElement;

// --- la pagina vieja ---
// Si el navegador tiene guardada una pagina vieja que no coincide con este codigo, la pide de nuevo con ?fresca=<hora> (una
// direccion que no esta en ningun cache) y no arma nada con la vieja: le faltarian partes. Un ?fresca= de hace mas de un
// minuto no cuenta: es el de una pestaña que quedo abierta con esa direccion y que el celular despues abre con la pagina
// que tenia guardada (asi fallo una vez: "pág. 18" con el codigo de la 20, en papelitos.js). Si se pidio hace menos de un
// minuto y sigue vieja (recien publicada, el sitio todavia reparte la anterior), no se insiste: se avisa (codigo A) y
// queda "Probar de nuevo". Con la pagina al dia, el ?fresca= se saca de la direccion.
// (Subir este numero y el de data-pagina en index.html cada vez que cambie el HTML.)
const PAGINA = '29';
const sinFresca = new URLSearchParams(location.search), fresca = Number(sinFresca.get('fresca')) || 0;
sinFresca.delete('fresca');
const direccionLimpia = location.pathname + (String(sinFresca) ? '?' + sinFresca : '');
if (raiz.dataset.pagina !== PAGINA) {
  if (Math.abs(Date.now() - fresca) > 60000) location.replace(direccionLimpia + (String(sinFresca) ? '&' : '?') + 'fresca=' + Date.now() + location.hash);
  else if (window.cargaFallo) window.cargaFallo('Hay una versión nueva del juego y todavía no llegó entera a este aparato. Probá de nuevo en un par de minutos.', 'A');
  await new Promise(() => {});   // (con la pagina vieja no se sigue: o se va a la nueva, o queda el aviso)
}
if (fresca) history.replaceState(history.state, '', direccionLimpia + location.hash);

// --- el cartel de carga ---
// Mientras se arma todo, va diciendo en que anda. Entre paso y paso se le da un respiro al navegador para que lo dibuje:
// si no, en un celular lento la pantalla queda quieta varios segundos y parece rota. (El cartel esta en index.html.)
// Cada paso lleva su numero: si la carga falla, el codigo que se muestra dice en cual estaba (ver el principio de index.html).
const respiro = (texto, paso) => {
  if (!raiz.classList.contains('carga-fallo')) $('cargaTexto').textContent = texto;
  if (window.cargaPaso) window.cargaPaso(paso, texto);
  return new Promise((sigue) => { requestAnimationFrame(() => setTimeout(sigue, 0)); setTimeout(sigue, 250); });
};
let cargando = true;

let render;
try { render = new THREE.WebGLRenderer({ canvas: $('lienzo'), antialias: true }); } catch (e) {
  window.cargaFallo('', 'G', e);   // (el cartel dice que este navegador no puede con los graficos 3D)
  throw e;
}
const liviano = window.matchMedia('(pointer: coarse)').matches;   // celular o tablet: menos pixeles y sombras mas chicas
let nitidez = Math.min(window.devicePixelRatio, liviano ? 1.5 : 2), cuadros = 0, lentos = 0;   // pixeles dibujados por cada pixel de pantalla
render.setPixelRatio(nitidez);
render.shadowMap.enabled = true;

// --- que pista se corre: la del link de un amigo, un circuito fijo (?c=subida), una pista de la comunidad (?pista=13042-1:
// numero y version), el borrador del creador (?pista=borrador), la pedida con ?p=numero, o la de hoy ---
const HOY = hoy(), consulta = new URLSearchParams(location.search), pedida = Math.floor(Number(consulta.get('p'))), fijo = circuitoDe(consulta.get('c'));
const deLaComunidad = /^(\d{5})(?:-(\d{1,2}))?$/.exec(consulta.get('pista') || ''), esBorrador = consulta.get('pista') === 'borrador';
// El servidor (ver nube.js) guarda las pasadas que se comparten y las tablas de los clubes. Sin el, todo lo demas anda igual.
// (Desde una copia del juego abierta en la misma compu se puede probar con otro: ?servidor=http://127.0.0.1:8787)
const enCasa = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
const nube = crearNube(enCasa && consulta.has('servidor') ? consulta.get('servidor') : SERVIDOR);
// (lo guardado en el aparato: hace falta antes de armar el club, para el borrador y las pistas de la comunidad conocidas)
const aca = guardado();
nube.conLlave(() => aca.llave || '');
// El link de un amigo trae su pasada. Los largos (cientos de letras) la traen entera; los cortos traen el codigo con
// el que quedo guardada en el servidor, y hay que ir a buscarla. Un link de invitacion termina en #club=...
const enlace = /[#&]r=([\w-]+)/.exec(location.hash), invitacion = /[#&]club=([0-9A-Za-z]{6,12})/.exec(location.hash);
let codigoDelLink = enlace ? enlace[1] : '', corredorDelLink = '', linkCaido = false;
if (enlace && enlace[1].length <= 12) {
  await respiro('Buscando la pasada de tu amigo…', 1);
  const p = await nube.pasada(enlace[1]);
  codigoDelLink = p ? p.codigo : ''; corredorDelLink = p ? p.j : ''; linkCaido = !p;
}
const leido = codigoDelLink ? await leerCodigo(codigoDelLink) : null;
const vale = (n) => n >= 1 && (n <= HOY || esCircuito(n) || esDeLaComunidad(n));
let numero = leido && vale(leido.marca.pista) ? leido.marca.pista : fijo ? fijo.numero
  : deLaComunidad && esDeLaComunidad(Number(deLaComunidad[1])) ? Number(deLaComunidad[1]) : esBorrador ? COMUNIDAD.borrador
  : vale(pedida) || (pedida >= 1 && consulta.has('futuro')) ? pedida : HOY;
// la direccion de una pista: la de hoy no lleva nada; un circuito, su nombre; una de la comunidad, su numero y su version;
// un dia pasado, su numero
const direccionDe = (n) => location.pathname + (esCircuito(n) ? '?c=' + circuitoDe(n).id : esDeLaComunidad(n) ? '?pista=' + n + '-' + versionDe(n)
  : n === COMUNIDAD.borrador ? '?pista=borrador' : n !== HOY ? '?p=' + n : '');
// (una copia local del juego que se esta probando con otro servidor lo sigue usando al pasar de una pista a otra)
const conServidor = (dir) => {
  if (!enCasa || !consulta.has('servidor')) return dir;
  const [d, ...h] = dir.split('#');
  return d + (d.includes('?') ? '&' : '?') + 'servidor=' + encodeURIComponent(consulta.get('servidor')) + (h.length ? '#' + h.join('#') : '');
};
const quedarseEn = (n) => history.replaceState(null, '', conServidor(direccionDe(n)));

// --- las pistas de la comunidad (las arma un jugador en el creador: ver creador.js y hoja.js) ---
// No salen de su numero: hay que traer su hoja del servidor (o, sin señal, de lo guardado en el aparato) y armarla.
// "comunidad" queda con lo que se sabe de la pista: { nombre, autor, club, clubNombre, vence, tabla }, o { borrador: true, ... }.
// Si la pista ya vencio, no existe, o el link es de la pista que antes tenia ese numero, se corre la de hoy y se avisa.
let comunidad = null, avisoDeLaPista = '', olvidar = 0;
if (esDeLaComunidad(numero)) {
  const quiere = leido && leido.marca.pista === numero ? leido.version : deLaComunidad && deLaComunidad[2] ? Number(deLaComunidad[2]) : 0;
  await respiro('Buscando la pista…', 1);
  let p = await nube.pista(numero);
  // (404: no existe; 410: vencio, o la borro quien la armo. Otro error es un problema del servidor: como no tener señal)
  const seFue = !!p && (p.estado === 404 || p.estado === 410);
  if (p && p.error && !seFue) p = null;
  const sabida = (aca.comunidad || {})[numero];
  if (!p && sabida && sabida.hoja && sabida.vence > Date.now() / 1000) p = { numero, version: sabida.v, nombre: sabida.nombre, autor: sabida.autor || '', club: sabida.club || '', clubNombre: sabida.clubNombre || '', hoja: sabida.hoja, vence: sabida.vence, tabla: null };
  const otra = !!p && !p.error && !!quiere && p.version !== quiere;   // (el link es de la pista que antes tenia ese numero)
  const armada = p && !p.error && !otra ? armarHoja(p.hoja, numero, p.nombre) : null;
  if (armada && !armada.error) { anotarPista(armada.etapa, p.version); comunidad = p; }
  else {
    avisoDeLaPista = (!p ? 'No pude traer esa pista de la comunidad: revisá la conexión y abrí el link de nuevo.'
      : p.error ? p.error.replace('Esa pista', 'Esa pista de la comunidad') : otra ? 'Esa pista de la comunidad ya no está: venció o la borraron.'
      : 'Esa pista de la comunidad no se pudo armar.') + ' Mientras, la de hoy.';
    // (si ya no esta, la direccion vuelve a ser la de hoy y se la olvida; si fue la señal, queda: recargando se prueba de nuevo)
    if (p) quedarseEn(HOY);
    if (seFue || (otra && sabida && sabida.v === quiere)) olvidar = numero;
    numero = HOY;
  }
} else if (numero === COMUNIDAD.borrador) {
  const b = aca.borrador, armada = b && b.hoja ? armarHoja(b.hoja, numero, b.nombre || 'Tu pista') : null;
  if (armada && !armada.error) { anotarPista(armada.etapa, (huellaDeHoja(b.hoja) & 63) || 1); comunidad = { borrador: true, nombre: b.nombre || '', club: b.club || '' }; }
  else { avisoDeLaPista = (b ? 'Tu borrador todavía es muy corto para correrlo: seguí armándolo en el creador.' : 'No encontré tu borrador.') + ' Mientras, la de hoy.'; quedarseEn(HOY); numero = HOY; }
}
// en lo libre (circuitos y pistas de la comunidad) no hay oficial: se corre las veces que se quiera y queda el mejor tiempo
const libre = esCircuito(numero) || !!comunidad;
// lo del borrador no se sube al servidor (es una pista que todavia no existe)
const seSube = !(comunidad && comunidad.borrador);

await respiro('Armando la pista…', 2);
const etapa = generarPista(numero), T = crearTerreno(etapa), P = T.camino, ref = crearReferencia(T, AUTOS[REFERENCIA]);
const club = crearClub(numero, HOY, versionDe), copiloto = crearCopiloto(T);
nube.conLlave(() => club.llave());
if (olvidar) club.olvidarPista(olvidar);
// la pista de la comunidad queda anotada en el aparato (asi aparece en la lista y se puede volver a correr sin señal),
// y la tabla de todos los que la corrieron se suma a la del aparato como la de un club mas (el '#')
if (comunidad && !comunidad.borrador) {
  club.conocerPista(comunidad);
  if (comunidad.tabla) club.anotarDelClub('#', comunidad.tabla, numero);
}
// Como se nombra a alguien de la tabla para elegirlo de rival: por su numero de corredor, si se lo conoce
// (lo da el servidor); si no, por el nombre. '*' es la pasada propia.
const claveDe = (r) => (r.mio ? '*' : r.j ? '@' + r.j : r.nombre);
// lo que trajo el link: el resultado del amigo (con su fantasma) y los otros que el conocia. El queda de rival.
// (Si el link es de una version anterior de la pista, ya no sirve: ese camino no existe mas.)
let linkViejo = false;
if (leido && leido.marca.pista === numero) {
  if (leido.version !== versionDe(numero)) linkViejo = true;
  else {
    const amigo = { ...leido.marca, codigo: codigoDelLink, ...(corredorDelLink ? { j: corredorDelLink, id: enlace[1] } : {}) };
    club.anotarAmigo(amigo);
    for (const o of leido.tabla) club.anotarAmigo(o);
    if (leido.tieneVuelta && leido.marca.nombre !== club.nombre()) club.elegirRival(claveDe(amigo) + (leido.marca.practica ? '|p' : ''));
  }
  quedarseEn(numero);
}

await respiro('Plantando el paisaje…', 3);
const escena = new THREE.Scene();
const huellas = crearHuellas(T, render), mundo = crearMundo(T, escena, liviano, huellas), partida = crearPartida(T, ref.sectores);
huellas.pintar();   // la raya de largada, la meta y las lineas del asfalto
const trazada = crearTrazada(T, escena, ref);   // la linea para seguir (se prende en la configuracion)
// el polvo: no hay si llueve, y se lo lleva un viento suave que cambia con la pista
const soplo = (etapa.semilla % 628) / 100, fuerzaDelViento = 0.35 + (etapa.semilla % 7) * 0.08;
const camara = crearCamara(T), fx = crearEfectos(escena, huellas, 1 - mundo.luz.mojado, [Math.sin(soplo) * fuerzaDelViento, Math.cos(soplo) * fuerzaDelViento], liviano), sonido = crearSonido(), hud = crearHud();
const post = crearPost(render, etapa.clima, liviano);
const papelitos = crearPapelitos($('papelitos'));   // (los de la meta)
// lo que cada uno eligio en la configuracion (y si nunca la toco, lo que viene de fabrica).
// La trazada, mientras nadie la toque, acompaña a la ayuda de manejo: con ayuda se ve, para entender por donde va a ir el auto.
let conEfectos = true;   // el ajuste "efectos": barro en el auto, humo de frenada, hojas, rafagas en las plantas
const gusto = (clave) => { const v = club.gusto(clave); return v !== undefined ? v : clave === 'trazada' ? !!gusto('ayuda') : GUSTOS[clave]; };

await respiro('Preparando el auto…', 4);
// --- el auto del jugador (se puede cambiar en la portada) y los fantasmas ---
// Con la ayuda de manejo, el mismo auto se cruza menos (y ademas sigue la trazada y frena solo: ver ayuda.js).
const ayuda = crearAyuda(T);
// la referencia de cada auto (donde frenar depende del auto): la usan la ayuda de manejo y los colores de la trazada.
// Se calcula recien cuando hace falta.
// (id: el codigo del auto armado: ver partes.js)
const refs = { [codigoDe(REFERENCIA)]: ref }, refDe = (id) => { id = codigoDe(id); return refs[id] || (refs[id] = crearReferencia(T, configDe(id))); };
let c = null, dibujo = null, conAyuda = !!gusto('ayuda'), ayudaDeLaPasada = false, conTrazada = !!gusto('trazada');
// el modo "rally serio" (ver SERIO en config.js): lo contrario de la ayuda. (Si alguna vez quedaron los dos, gana la ayuda.)
let conSerio = !conAyuda && !!gusto('serio'), serioDeLaPasada = false;
// El auto con el que se corre: el que armaste en el garaje (su codigo de partes, como '431'; ver partes.js).
// (Lo guardado de antes, 'vitarita' o 'kacito', pasa a ser su codigo.)
function ponerAuto(id) {
  id = codigoDe(id);
  const C = configDe(id);
  if (dibujo) escena.remove(dibujo.grupo);
  club.ponerAuto(id);
  c = crearAuto(T, conAyuda ? { ...C, ...AYUDA.auto } : conSerio ? enSerio(C) : C);
  if (conAyuda) ayuda.preparar(C, refDe(id));
  if (conTrazada) trazada.usar(refDe(id));
  dibujo = crearDibujo(escena, C);
  partida.preparar(c);
  camara.saltar();
}
ponerAuto(club.auto());
const espectros = {};
// (el fantasma de cada auto armado: con su chasis y sus ruedas)
const espectroDe = (id) => { id = codigoDe(id); return espectros[id] || (espectros[id] = crearEspectro(escena, T, configDe(id))); };

// --- contra quien se corre ---
// rival: null o { clave, nombre, t, ab, practica, auto, fantasma }. La clave es la de "claveDe": '*' si es una pasada propia.
let rival = null, turnoDeRival = 0;
function buscarRival() {
  const [clave, deLaPractica] = (club.rival() || '').split('|');
  if (clave === '-') return null;   // eligio correr solo
  const mia = (lista) => lista.find((x) => x.mio && x.codigo), tiene = (x) => x && (x.codigo || x.id);
  let r = clave ? (deLaPractica ? club.practicas() : club.tabla()).find((x) => (clave === '*' ? x.mio : !x.mio && (claveDe(x) === clave || x.nombre === clave))) : null;
  // sin rival elegido: despues de la oficial, se practica contra la mejor pasada propia
  if (!tiene(r) && !club.sePuedeOficial()) { const a = mia(club.tabla()), b = mia(club.practicas()); r = a && b ? (b.t < a.t || a.ab ? b : a) : a || b; }
  return tiene(r) ? r : null;
}
// Devuelve false si el rival elegido tiene el fantasma en el servidor y no se lo pudo traer.
async function cargarRival() {
  const r = buscarRival(), turno = ++turnoDeRival;
  let falto = false;
  // el fantasma de alguien de un club no viene con la tabla: se lo va a buscar recien cuando se lo elige
  if (r && !r.codigo) {
    const p = await nube.pasada(r.id);
    if (p) { r.codigo = p.codigo; club.ponerCodigoDe(r, p.codigo); } else falto = true;
  }
  const l = r && r.codigo ? await leerCodigo(r.codigo) : null;
  if (turno !== turnoDeRival) return true;   // mientras tanto se eligio otro: manda ese
  const vuelta = l && l.version === versionDe(numero) && l.marca.pista === numero ? l.vuelta(P) : null;
  rival = vuelta ? { clave: claveDe(r), nombre: r.mio ? 'Vos' : r.nombre, t: r.t, ab: r.ab, practica: !!r.practica, auto: r.auto, fantasma: crearFantasma(vuelta, T) } : null;
  for (const id in espectros) espectros[id].ocultar();
  if (rival) espectroDe(rival.auto).nombre(rival.nombre);
  menu.pintar();
  return !falto;
}

// --- el servidor: links cortos y clubes (ver nube.js). Si no hay servidor o no contesta, nada de esto molesta ---
// Sube una pasada propia y anota con que codigo corto quedo guardada. (Lo del borrador no se sube.)
const subir = (r, codigo, n = numero) => (seSube ? nube.subir(codigo) : Promise.resolve(null)).then((id) => { if (id !== null) club.ponerId(r, id, n); return id; });
// Lo que va despues de "#r=" al compartir: el codigo corto si la pasada esta en el servidor; si no, la pasada entera.
// (Casi siempre ya se subio al terminar de correr. Si justo esta en eso, se la espera un momento y nada mas: en el
// celular, el menu de compartir solo se abre si no pasa mucho desde que se toco el boton.)
async function acortar(r, codigo) {
  if (!codigo || !nube.hay || !seSube) return codigo || '';
  if (r.id && r.codigo === codigo) return r.id;   // ya esta guardada tal cual
  const id = await nube.subir(codigo, 900);
  if (id !== null) club.ponerId(r, id);
  return id || r.id || codigo;
}
// --- guardar las pasadas sin que haya que compartirlas ---
// Lo que cuenta se sube solo al terminar (ver "terminar"): la oficial, tambien si fue un abandono (en las tablas dice DNF),
// y el mejor tiempo de las practicas, los circuitos y las pistas de la comunidad. Si no se pudo (sin señal, o el servidor
// tardo), queda pendiente y se vuelve a probar solo: cada tanto, al volver la señal, al volver al juego y la proxima vez
// que se abra. Tambien se sube la oficial que quedo como abandono porque se cerro el juego en plena pasada: como no llego
// a grabarse, va sin recorrido (y sin fantasma). Asi en la tabla de los clubes figura DNF, y no "todavia no corrio".
// En el resultado se ve como va (ver "guardado" en menu.js): solo de lo que va a una tabla, y si hay servidor.
let mostrado = null;   // el resultado que esta en pantalla, si es de los que se cuentan: { n, r }
const elMismo = (a, b) => Math.abs(a.t - b.t) < 0.005 && !!a.practica === !!b.practica && (a.ab || '') === (b.ab || '');
function avisarGuardado(n, r, estado) {
  if (mostrado && mostrado.n === n && elMismo(mostrado.r, r)) menu.guardado(estado);
}
// Sube lo que se acaba de correr (o lo mismo con otro nombre, si se lo cambio en el resultado)
async function guardarYa(r, codigo) {
  avisarGuardado(numero, r, 'subiendo');
  const id = await subir(r, codigo);
  avisarGuardado(numero, r, id === null ? 'pendiente' : id ? 'listo' : 'no');
  if (id === null) reintentarLuego(); else tablasDeLosClubes(true);
}
// Sube lo que haya quedado pendiente, de a uno (si uno no llega, no se insiste con los demas: es que no hay señal).
// Devuelve una promesa de cuantos quedaron sin subir.
let sincronizando = null;
function sincronizar() {
  if (!nube.hay) return Promise.resolve(0);
  return sincronizando || (sincronizando = (async () => {
    for (const { numero: n, r } of club.abandonosSinCodigo()) club.ponerCodigo(r, codigoSinVuelta({ ...r, pista: n }), n);
    const lista = club.sinSubir().slice(0, 8);
    let quedan = lista.length + ((await subirTravesia()) ? 0 : 1);   // (el record de la Travesia tambien, si quedo pendiente)
    for (const { numero: n, r } of lista) {
      const id = await subir(r, r.codigo, n);
      if (id === null) break;
      quedan--;
      avisarGuardado(n, r, id ? 'listo' : 'no');
    }
    return quedan;
  })().finally(() => { sincronizando = null; }));
}
// --- la Travesia: su record de km (ver travesia.js) ---
// Se manda solo al terminar, y solo si supera el anterior (el servidor tambien lo revisa). Si no se pudo (sin señal, o todavia
// no hay nombre), queda pendiente: "travesiaSubido" son los km que el servidor ya tiene. No lleva pista ni fantasma.
const recordeSinSubir = () => { const km = Number(club.gusto('travesiaKm')) || 0; return km > 0 && km > (Number(club.gusto('travesiaSubido')) || 0) && !!club.nombre(); };
let subiendoTravesia = null;
// Devuelve una promesa de true si no queda nada pendiente, y de false si hay que volver a probar.
function subirTravesia() {
  if (!nube.hay || !recordeSinSubir()) return Promise.resolve(true);
  return subiendoTravesia || (subiendoTravesia = (async () => {
    const km = Number(club.gusto('travesiaKm')), r = await nube.travesia(club.nombre(), km, codigoDe(club.auto()));
    if (r === null || r.estado === 429 || r.estado === 425 || r.estado >= 500) return false;
    club.gusto('travesiaSubido', km);   // (llego, o el servidor no lo quiere: no se insiste)
    recordesDeLosClubes(true);
    return true;
  })().finally(() => { subiendoTravesia = null; }));
}
// Los records de la Travesia de la gente de mis clubes (quedan en el club, ver club.js)
let ultimaTravesia = -1e9;
async function recordesDeLosClubes(ya) {
  const mios = club.clubes();
  if (!nube.hay || !mios.length || (!ya && performance.now() - ultimaTravesia < 15000)) return;
  ultimaTravesia = performance.now();
  const t = await nube.travesias(mios.map((x) => x.codigo));
  if (!t) return;
  for (const { codigo } of mios) if (t[codigo]) club.anotarTravesiaDelClub(codigo, t[codigo].tabla);
  menu.pintar();
}
// Si no se pudo subir, se vuelve a probar en un rato: cada vez esperando un poco mas (de 15 segundos a 5 minutos), mientras
// quede algo pendiente y el juego este a la vista. (Al volver la señal o al volver al juego se prueba enseguida.)
let reintento = 0, demora = 15000;
function reintentarLuego() {
  clearTimeout(reintento);
  reintento = setTimeout(async () => {
    if (document.hidden) return;   // (al volver al juego se prueba: ver "visibilitychange")
    if (pantalla === 'jugando') { reintentarLuego(); return; }   // (mientras se corre, no: despues)
    const quedan = await sincronizar();
    if (quedan) { demora = Math.min(300000, demora * 2); reintentarLuego(); } else { demora = 15000; tablasDeLosClubes(true); }
  }, demora);
}
const alVolver = async () => { demora = 15000; const quedan = await sincronizar(); if (quedan) reintentarLuego(); tablasDeLosClubes(false); };
// Las tablas de mis clubes en esta pista. Lo ultimo que dijo el servidor de cada club queda en "deLosClubes"
// ({ codigo: { miembros, faltan: [apodos de los que todavia no corrieron], pistas: [las pistas del club] } }); los tiempos,
// en el club (club.js). En una pista de la comunidad se pide ademas su tabla: la de todos los que la corrieron.
const deLosClubes = {};
let ultimaTabla = -1e9;
async function tablasDeLosClubes(ya) {
  recordesDeLosClubes(ya);   // (y los records de la Travesia, que van aparte)
  const mios = club.clubes(), deLaPista = !!comunidad && !comunidad.borrador;
  if (!nube.hay || (!mios.length && !deLaPista) || (!ya && performance.now() - ultimaTabla < 15000)) return;
  ultimaTabla = performance.now();
  const [t, p] = await Promise.all([mios.length ? nube.tablas(numero, versionDe(numero), mios.map((x) => x.codigo)) : null, deLaPista ? nube.pista(numero) : null]);
  if (p && !p.error && p.version === versionDe(numero)) club.anotarDelClub('#', p.tabla, numero);
  if (t) {
    for (const { codigo } of mios) {
      const x = t[codigo];
      if (x === null) { club.sacarClub(codigo); delete deLosClubes[codigo]; continue; }   // ese club ya no existe
      if (!x) continue;
      if (!x.soy) nube.entrar(codigo, club.nombre());   // (la vez que me sume no habia llegado al servidor)
      club.ponerClub({ codigo, nombre: x.nombre });
      club.anotarDelClub(codigo, x.tabla);
      deLosClubes[codigo] = { miembros: x.miembros + (x.soy ? 0 : 1), faltan: x.faltan || [], pistas: x.pistas || [] };
      // las pistas del club quedan anotadas en el aparato (para la lista de pistas de la comunidad); las que ya no estan
      // (vencieron, o las borro quien las armo), se olvidan
      for (const q of x.pistas || []) club.conocerPista({ ...q, club: codigo, clubNombre: x.nombre });
      for (const q of club.pistas()) if (q.club === codigo && q.numero !== numero && !(x.pistas || []).some((y) => y.numero === q.numero && y.version === q.v)) club.olvidarPista(q.numero);
    }
  }
  if (t || p) menu.pintar();
}
// Crear un club, entrar a uno con el codigo de una invitacion, y salir. Devuelven { codigo, nombre } o { error }.
const sinRed = { error: 'No hay conexión con el servidor del juego. Probá más tarde.' };
async function fundarClub(nombre) {
  const r = await nube.crearClub(nombre, club.nombre());
  if (!r || r.error) return r || sinRed;
  club.ponerClub(r);
  deLosClubes[r.codigo] = { miembros: 1, faltan: [], pistas: [] };
  sincronizar().then(() => tablasDeLosClubes(true));
  return r;
}
async function entrarAlClub(codigo) {
  const r = await nube.entrar(codigo, club.nombre());
  if (!r || r.error) return r || sinRed;
  club.ponerClub(r);
  await sincronizar();
  await tablasDeLosClubes(true);
  return r;
}
async function dejarClub(codigo) {
  const r = await nube.salir(codigo);
  if (!r || r.error) return r || sinRed;
  club.sacarClub(codigo);
  delete deLosClubes[codigo];
  cargarRival();
  return r;
}

// Borrar una pista de la comunidad propia (desde la lista de pistas o desde el creador): se borra en el servidor y se la
// olvida aca. Devuelve { borrada } o { error }. Si es la que se esta corriendo, se vuelve a la pista de hoy.
async function borrarPista(n) {
  const r = await nube.borrarPista(n);
  if (!r) return sinRed;
  if (r.error && r.estado !== 404) return r;   // (404: ya no existia: igual se la olvida)
  club.olvidarPista(n);
  if (n === numero) { location.href = conServidor(location.pathname); return { borrada: true, sale: true }; }
  menu.pintar();
  return { borrada: true };
}

// --- el creador de pistas (ver creador.js): se abre desde los circuitos, desde un club o desde el borrador ---
const creador = crearCreador({
  club, nube, enElBorrador: !seSube, borrarPista,
  probar: () => { location.href = conServidor(location.pathname + '?pista=borrador'); },
  // recien publicada: se abre la pista, con su link (el aviso de "publicada" lo da la portada)
  publicada: (p) => { location.href = conServidor(location.pathname + '?pista=' + p.numero + '-' + p.version + '#publicada'); },
  renombrar: () => { if (nube.hay) for (const c of club.clubes()) nube.entrar(c.codigo, club.nombre()); },
  alCerrar: () => { if (pantalla !== 'jugando') menu.enfocar(); },
});

const menu = crearMenu({
  T, club, hoy: HOY, ref, copiloto, comunidad,
  // si la direccion pide algo (un link de un amigo, un circuito, una pista de la comunidad, un dia pasado), el inicio abre en la card de eso
  deLink: !!(enlace || fijo || deLaComunidad || esBorrador || vale(pedida)),
  // correr desde una card: la pista pedida (n). Si ya esta cargada, empieza; si no, se carga esa pista y arranca sola ("#largar").
  // dir: la direccion de la pista, si la card la conoce (las pistas de la comunidad)
  correr: (n, dir) => correr(n, dir),
  ajustes: { leer: gusto, poner: (clave, valor) => ajustar(clave, valor), probar: () => teclas.probarSensor() },
  aviso: avisoDeLaPista || (linkViejo ? 'El link que abriste es de una versión anterior de esta pista: ese tiempo ya no vale.'
    : linkCaido ? 'No pude traer la pasada de tu amigo. Revisá la conexión y abrí el link de nuevo.' : ''),
  rival: () => rival,
  claveDe,
  elegirAuto: (id) => { if (pantalla !== 'jugando') ponerAuto(id); },
  // (devuelve una promesa de false si no se pudo traer el fantasma del servidor)
  elegirRival: (clave, deLaPractica) => { club.elegirRival(clave ? clave + (deLaPractica ? '|p' : '') : '-'); return cargarRival(); },
  acortar,
  // la Travesia, desde la categoria Aventura de los circuitos
  travesia: () => { if (pantalla !== 'jugando') travesia.entrar(); },
  // la guia de la Travesia, para volver a verla (desde "Como se juega" y desde la Aventura)
  guiaTravesia: () => travesia.verGuia(),
  // los clubes (solo si hay servidor): crear, salir, y lo ultimo que se sabe de cada uno
  // (renombrar: con el nombre nuevo se figura en los clubes aunque todavia no se haya corrido)
  clubes: nube.hay ? {
    fundar: fundarClub, dejar: dejarClub, de: (codigo) => deLosClubes[codigo] || null, refrescar: () => tablasDeLosClubes(false),
    renombrar: () => { for (const c of club.clubes()) nube.entrar(c.codigo, club.nombre()); },
  } : null,
  // volver a ver el tutorial (desde "Como se juega")
  tutorial: () => largar(true),
  // el creador de pistas (codigo: el club para el que se arma, si se abre desde un club)
  armar: (codigo) => creador.abrir(codigo),
  // el link de esta pista (para compartir una pista de la comunidad)
  linkDeLaPista: () => location.origin + direccionDe(numero),
  direccion: conServidor,
  // borrar una pista propia
  borrarPista,
});

let pantalla = 'portada';   // portada (el inicio con las cards), jugando o fin
let modo = 'practica';      // oficial o practica
let antes = performance.now(), resto = 0, reloj3d = 0, tactil = false, grabacion = null, tFin = 0, avisado = '', trabado = false, paraAtras = false;
// En un circuito de vuelta cerrada: cuantas rondas se cerraron en esta salida y cual fue la mejor
// ({ r: su resultado, g: su grabacion, mejoro: si mejoro el tiempo que estaba guardado }).
let rondas = 0, mejorRonda = null, mejoroAlgo = false;
let conVoz = true, conFlechas = false, hayVolante = null;   // hayVolante: si el celular tiene sensor de inclinacion (null = todavia no se sabe)
// la camara que se eligio la ultima vez (el boton muestra cual es)
if (club.gusto('camara')) camara.cambiar(club.gusto('camara'));
hud.camara(camara.modo().id);
const lugar = { x: 0, z: 0, rumbo: 0, alto: 0 };
const ent = { x: 0, y: 0, mano: false }, QUIETO = { x: 0, y: 0, mano: true };

// En el celular: pedales en pantalla y doblar inclinando. Se prende al largar con el dedo,
// porque el permiso del sensor y la pantalla completa solo se pueden pedir desde un toque.
function mandosDeCelular() {
  tactil = true;
  raiz.classList.add('tactil');
  $('tactil').hidden = false;
  teclas.celular((inclina) => { hayVolante = inclina; pintarVolante(); });
  pintarVolante();
  if (raiz.requestFullscreen) raiz.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
  if (navigator.wakeLock) navigator.wakeLock.request('screen').catch(() => {});
}

// Correr una pista desde el inicio. Las pistas no se cambian en caliente (el terreno se arma una vez): si la que se pidio no es la
// que esta cargada, se abre su direccion con "#largar" y al terminar de cargar empieza sola, como si se hubiera tocado de nuevo.
function correr(n, dir) {
  if (pantalla === 'jugando') return;
  if (n === numero) { largar(); return; }
  location.href = dir ? dir + '#largar' : conServidor(direccionDe(n) + '#largar');
}

// conTutorial: true para que el equipo explique la pantalla antes de largar (si no se dice, lo explica igual la primera
// vez que alguien corre en este aparato). Con el tutorial, el auto espera en la largada: la cuenta regresiva arranca
// cuando termina.
function largar(conTutorial) {
  if (pantalla === 'jugando') return;
  if (!tactil && teclas.esTactil()) mandosDeCelular();
  const explicar = conTutorial === true || club.esNuevo();
  modo = club.sePuedeOficial() ? 'oficial' : 'practica';
  raiz.classList.toggle('practica', modo === 'practica');   // en las practicas aparece el boton de salir
  pantalla = 'jugando';
  tFin = 0; avisado = ''; ayudaDeLaPasada = conAyuda; serioDeLaPasada = conSerio;
  rondas = 0; mejorRonda = null; mejoroAlgo = false;
  partida.preparar(c);
  if (!explicar) partida.largar();
  grabacion = crearGrabacion(T);
  copiloto.reiniciar();
  copiloto.voz(conVoz);
  fx.cortar(); fx.limpiar(); dibujo.limpiar();
  huellas.limpiar();
  papelitos.limpiar();
  camara.saltar();
  mundo.reiniciar();
  trazada.mostrar(conTrazada);
  hud.sectores('', 0); hud.aviso(''); hud.grande(''); hud.sinRival(); hud.frenaSola(false); hud.mostrar(true);
  hud.sello(!explicar);   // (el cartel de "en desarrollo" y la firma acompaña a la cuenta regresiva: con el tutorial, espera)
  hud.ronda(T.vuelta ? 0 : -1, mejorGuardado());
  encuadrar();
  menu.cerrarFin(); mostrado = null;
  menu.portada(false);
  for (const id in espectros) espectros[id].ocultar();
  sonido.iniciar();
  if (explicar) tutorial.abrir();
}

// --- el tutorial de la primera vez (ver tutorial.js): el equipo explica lo que hay en pantalla, con el auto esperando ---
const tutorial = crearTutorial({
  dedos: () => tactil,
  flechas: () => raiz.classList.contains('sin-volante'),
  // Se termino (o se salto): queda anotado que ya se vio, y ahora si, la cuenta regresiva.
  // (ayudaElegida: lo que se eligio en el ultimo paso; si se salto, queda la ayuda como estaba)
  alTerminar: (ayudaElegida) => {
    club.gusto('tutorial', 1);
    if (ayudaElegida !== undefined && ayudaElegida !== conAyuda) ajustar('ayuda', ayudaElegida);
    ayudaDeLaPasada = conAyuda; serioDeLaPasada = conSerio;
    trazada.mostrar(conTrazada);
    partida.largar();
    hud.sello(true);
  },
  alCancelar: () => aLaPortada(),
});

// los resultados de otros que se conocen de esta pista: van en el link, para que la tabla se complete entre todos
// (Solo lo que llego por link. Lo que se sabe por un club queda en el club: no viaja en los links de sus miembros.)
const conocidos = () => (libre ? club.practicas() : club.tabla()).filter((x) => !x.mio && (x.link || !x.j));
// (vuelta cerrada) el mejor tiempo que hay guardado, o null
const mejorGuardado = () => { const g = T.vuelta && club.practica(); return g && !g.ab ? g.t : null; };

// (vuelta cerrada) Se cruzo la raya: se cerro una ronda. Si es la mejor de la salida, queda como resultado (y de fantasma).
function cerrarRonda(v) {
  rondas++;
  const r = { pista: numero, nombre: club.nombre(), t: v.tiempo, s: v.sectores, c: v.colores, auto: club.auto(), ab: '', vueltas: v.vueltas, roto: Math.round(v.roto), practica: true, ayuda: ayudaDeLaPasada, serio: serioDeLaPasada };
  const marca = mejorGuardado(), esLaMejor = !mejorRonda || v.tiempo < mejorRonda.r.t, g = grabacion;
  if (esLaMejor) {
    mejorRonda = { r, g };
    if (club.anotarPractica(r)) {
      mejoroAlgo = true;
      // la mejor vuelta pasa a ser el fantasma contra el que se corre (si no se eligio otro), y se sube al servidor
      g.codigo({ ...r, nombre: club.nombre() }, conocidos()).then((codigo) => { club.ponerCodigo(r, codigo); cargarRival(); subir(r, codigo); });
    }
  }
  const dif = marca === null ? null : v.tiempo - marca;
  if (dif !== null && dif < 0) papelitos.tirar(60, 0.8);   // (le gano a su mejor vuelta: unos papelitos)
  hud.grande(tiempoFinal(v.tiempo), 2.6, dif === null || dif < 0 ? 'verde' : dif < 2 ? 'amarillo' : 'rojo');
  hud.aviso('Vuelta ' + rondas + (dif === null ? '' : dif < 0 ? ' · ¡tu mejor vuelta! −' + (-dif).toFixed(2) : ' · +' + dif.toFixed(2) + ' contra tu mejor'), 3.2);
  grabacion = crearGrabacion(T);
  copiloto.otraVuelta();
  hud.sectores('', 0);
  hud.ronda(rondas + 1, mejorGuardado());
}

// Cierra la pasada: llegaste o abandonaste. Guarda el resultado y lo muestra.
// (En una vuelta cerrada se llega aca al salir o al romper el auto: el resultado es el de la mejor ronda.)
function terminar() {
  pantalla = 'fin';
  hud.llamar(false); trabado = false;
  const llego = partida.estado === 'llegada';
  let r = { pista: numero, nombre: club.nombre(), t: partida.tiempo, s: partida.sectores.map((x) => x.tiempo), c: partida.colores(), auto: club.auto(),
    ab: llego ? '' : partida.motivo || 'roto', vueltas: partida.vueltas, roto: Math.round(partida.roto), practica: modo === 'practica', ayuda: ayudaDeLaPasada, serio: serioDeLaPasada };
  let mejoro = false, g = grabacion;   // (en las practicas y en los circuitos queda guardada solo la mejor)
  if (T.vuelta && mejorRonda) { r = { ...mejorRonda.r, nombre: club.nombre(), rondas, seRompio: partida.estado === 'abandono' }; g = mejorRonda.g; mejoro = mejoroAlgo; }
  else if (modo === 'oficial') club.cerrarOficial(r); else mejoro = club.anotarPractica(r);
  // el link se arma con el nombre que haya en ese momento (si lo cambia, se arma de nuevo)
  // Lo que cuenta (la oficial, tambien un abandono, o un mejor tiempo) se guarda solo en el servidor, enseguida: asi el
  // tiempo aparece en las tablas sin tener que compartirlo, y el link sale corto. Una practica que no mejoro tu tiempo no
  // cambia ninguna tabla: se sube recien si se la comparte (para que el link sea corto).
  const cuenta = !r.practica || mejoro;
  // (en el resultado se dice si quedo guardado y donde: de lo que va a una tabla, que es la oficial o, en lo libre, tu mejor
  // tiempo. Las practicas de la pista del dia no van a la tabla)
  mostrado = cuenta && seSube && nube.hay && (!r.practica || libre) ? { n: numero, r } : null;
  let hecho = { nombre: null, codigo: null };
  const armarLink = async () => {
    if (hecho.nombre !== club.nombre()) {
      hecho = { nombre: club.nombre(), codigo: await g.codigo({ ...r, nombre: club.nombre() }, conocidos()) };
      club.ponerCodigo(r, hecho.codigo);
      if (cuenta) guardarYa(r, hecho.codigo);
    }
    return hecho.codigo;
  };
  armarLink().then(cargarRival);
  for (const id in espectros) espectros[id].ocultar();
  trazada.mostrar(false);
  hud.aviso(''); hud.grande(''); hud.frenaSola(false);
  hud.mostrar(false);
  // Como quedo contra los de la tabla (lo dice el resultado). Si quedo primero (y cuenta), otra tanda de papelitos.
  const contra = menu.fin(r, armarLink, mejoro);
  menu.guardado(mostrado ? 'subiendo' : '');
  if (llego && contra.puesto === 1 && contra.cuenta) setTimeout(() => papelitos.tirar(120, 1.1), 300);
}

function aLaPortada() {
  // la oficial no se deja por la mitad (pero si todavia no arranco la cuenta regresiva, por el tutorial, no empezo)
  if (pantalla === 'jugando' && modo === 'oficial' && partida.estado !== 'previa') return;
  tutorial.cerrar();
  if (pantalla === 'jugando' && T.vuelta && mejorRonda) { terminar(); return; }   // vuelta cerrada: salir es terminar, y queda la mejor ronda
  pantalla = 'portada';
  partida.preparar(c);
  fx.cortar(); camara.saltar();
  trazada.mostrar(false);
  hud.mostrar(false);
  menu.cerrarFin(); mostrado = null;
  menu.portada(true);
}

// Lo que van avisando las reglas se muestra en pantalla.
const VUELTA = { caida: 'Te fuiste al vacío', afuera: 'Te fuiste lejos del camino', vuelco: 'Volcaste', pedido: '' };
const CUENTA = ['', 'uno', 'dos', 'tres'];
function atender(e) {
  if (e.tipo === 'cuenta') { hud.grande(String(e.dato), 0.95, 'cuenta'); copiloto.hablar(CUENTA[e.dato]); }
  else if (e.tipo === 'ya') { hud.grande('¡YA!', 0.9, 'ya'); hud.sello(false); if (modo === 'oficial') club.empezarOficial(club.auto()); }
  else if (e.tipo === 'sector') {
    const n = partida.sectores.length, par = ref.sectores[e.dato.numero], dif = e.dato.tiempo - par;
    if (n) hud.sectores(partida.colores(), n);   // (en una vuelta cerrada, al cerrar el ultimo sector ya arranco la ronda siguiente)
    hud.grande((dif < 0 ? '−' : '+') + Math.abs(dif).toFixed(1), 1.8, e.dato.color === 'v' ? 'verde' : e.dato.color === 'a' ? 'amarillo' : 'rojo');
  } else if (e.tipo === 'raya') { grabacion = crearGrabacion(T); hud.ronda(1, mejorGuardado()); }   // (vuelta cerrada) arranca la primera ronda
  else if (e.tipo === 'ronda') cerrarRonda(e.dato);
  else if (e.tipo === 'golpe') camara.sacudir(e.dato);   // (el ruido del choque ya sono en el momento: ver "toque" en el cuadro)
  else if (e.tipo === 'vuelta') {
    if (e.dato === 'caida') sonido.caida('caida');   // (se cayo al vacio: el golpe contra el fondo. Un vuelco ya sono al volcar)
    fx.cortar();
    camara.saltar();
    hud.grande('+' + JUEGO.penalizacion + ' s', 1.8, 'rojo');
    hud.aviso(VUELTA[e.dato] || '', 2.5);
  } else if (e.tipo === 'llegada') { tFin = 1.7; hud.grande('', 0); papelitos.tirar(); sonido.meta(); }   // la meta: papelitos y el publico
  else if (e.tipo === 'abandono') tFin = 1.3;
}

const teclas = crearTeclas((tecla) => {
  if (travesia.activa() && travesia.tecla(tecla)) return;
  if (creador.abierto()) { if (tecla === 'Escape') creador.cerrar(); return; }   // (con el creador abierto, las teclas son del creador)
  if (tecla === 'Enter') {
    if (pantalla === 'jugando' || ['BUTTON', 'INPUT', 'A'].includes(document.activeElement.tagName)) return;
    if (pantalla === 'portada') menu.principal(); else largar();   // (en el inicio, el boton de la card del medio)
  }
  else if (tecla === 'KeyR') { if (pantalla === 'jugando') partida.volver(c, 'pedido'); }
  else if (tecla === 'Escape') aLaPortada();
  else if (tecla === 'KeyC') { const m = camara.cambiar(); club.gusto('camara', m.id); hud.camara(m.id); hud.aviso(m.nombre, 1.2); }
  else if (tecla === 'KeyM') ajustar('sonido', !gusto('sonido'));
  else if (tecla === 'KeyV') ajustar('voz', !gusto('voz'));
  else if (tecla === 'KeyT') { ajustar('trazada', !gusto('trazada')); if (pantalla === 'jugando') hud.aviso(conTrazada ? 'Trazada' : 'Sin trazada', 1.2); }
});

// --- la Travesia: un modo aparte (ver travesia.js). Usa su propia escena y su propio auto; la pista del dia no se toca ---
const travesia = crearModoTravesia({
  render, post, liviano, club, sonido, hud, teclas, raiz,
  portada: (si) => menu.portada(si),
  mandos: () => { if (!tactil && teclas.esTactil()) mandosDeCelular(); },
  voz: () => conVoz,
  camara: () => club.gusto('camara'),
  efectos: () => conEfectos,
  festejo: () => { if (conEfectos) papelitos.tirar(50, 0.75); },   // (la gente de la largada; los papelitos de la meta)
  // el record nuevo se manda solo; la tabla de los amigos se trae del servidor al terminar
  record: () => { subirTravesia().then((ok) => { if (!ok) reintentarLuego(); }); },
  amigos: () => club.travesiaTabla(),
  refrescar: async () => { await subirTravesia(); await recordesDeLosClubes(true); },
  renombrar: () => { if (!nube.hay) return; for (const c of club.clubes()) nube.entrar(c.codigo, club.nombre()); subirTravesia().then((ok) => { if (!ok) reintentarLuego(); }); },
});

// --- la configuracion: como se aplica cada cosa que se puede elegir (los valores de fabrica estan en GUSTOS, en config.js) ---
const APLICAR = {
  // (el auto se arma de nuevo, salvo que ya este corriendo: en la largada, mientras dura el tutorial, todavia se puede)
  // La ayuda y el modo serio son contrarios: prender uno apaga el otro.
  ayuda: (v) => { conAyuda = !!v; if (conAyuda && gusto('serio')) { club.gusto('serio', false); conSerio = false; } if (pantalla !== 'jugando' || partida.estado === 'previa') ponerAuto(club.auto()); APLICAR.trazada(gusto('trazada')); },
  serio: (v) => { conSerio = !!v; if (conSerio && gusto('ayuda')) { club.gusto('ayuda', false); conAyuda = false; APLICAR.trazada(gusto('trazada')); } if (pantalla !== 'jugando' || partida.estado === 'previa') ponerAuto(club.auto()); },
  trazada: (v) => { conTrazada = !!v; if (conTrazada) trazada.usar(refDe(club.auto())); trazada.mostrar(conTrazada && pantalla === 'jugando'); },
  lejos: (v) => { camara.alejar(v); travesia.alejar(v); },
  sensible: (v) => teclas.ajustar({ grados: gradosDeInclinacion(v) }),
  botones: (v) => { conFlechas = !!v; teclas.ajustar({ flechas: conFlechas }); pintarVolante(); },
  pedales: (v) => { raiz.style.setProperty('--pedales', v); encuadrar(); },
  efectos: (v) => { conEfectos = !!v; fx.prender(conEfectos); travesia.efectos(conEfectos); ambiente.rafaga.value = conEfectos ? 0.7 + fuerzaDelViento : 0; post.prender(!!v && !consulta.has('simple')); },   // (?simple en la direccion tambien los saca)
  sonido: (v) => { if (sonido.mudo() === !!v) sonido.alternar(); hud.prendido('sonido', !!v); },
  voz: (v) => { conVoz = !!v; copiloto.voz(conVoz); travesia.voz(conVoz); hud.prendido('voz', conVoz); },
};
function ajustar(clave, valor) { club.gusto(clave, valor); APLICAR[clave](valor); menu.pintar(); }
for (const clave in APLICAR) if (clave !== 'ayuda' && clave !== 'serio') APLICAR[clave](gusto(clave));   // (la ayuda y el modo serio ya se tuvieron en cuenta al armar el auto)
// En el celular, si no hay sensor de inclinacion (o se eligio doblar con flechas), aparecen las flechas.
function pintarVolante() { raiz.classList.toggle('sin-volante', tactil && (hayVolante === false || conFlechas)); encuadrar(); }

// Donde puede quedar el auto en la pantalla. En el celular, siempre bien por arriba de los botones: parado, mas arriba
// que el freno de mano; acostado, que los pedales. (A fondo, la camara mira mas adelante y el auto se va hacia abajo:
// si llega a la altura de los botones lo tapan los pulgares, y parece que se fue de la pantalla.)
// Tampoco tan al costado como para quedar detras de un boton.
function encuadrar() {
  const W = window.innerWidth, H = window.innerHeight, parado = W < H;
  let abajo = 0.16, lados = 0.2;
  if (tactil) {
    const mano = document.querySelector('.redondo.mano').getBoundingClientRect(), pedal = document.querySelector('.pedal.gas').getBoundingClientRect();
    if (mano.height) abajo = parado ? (H - mano.top) / H + 0.075 : (H - pedal.top) / H + 0.07;
    lados = parado ? 0.24 : 0.28;
  }
  camara.encuadrar(Math.min(0.42, abajo), parado ? 0.24 : 0.2, lados);
  travesia.encuadrar(Math.min(0.42, abajo), parado ? 0.24 : 0.2, lados);
}
function medir() {
  render.setSize(window.innerWidth, window.innerHeight, false);
  camara.pantalla(window.innerWidth, window.innerHeight);
  travesia.medir(window.innerWidth, window.innerHeight);
  post.medir(render.domElement.width, render.domElement.height);
  encuadrar();
}

// Si el aparato no da abasto (menos de 30 cuadros por segundo durante un rato), primero se apagan
// el desenfoque y los brillos, y si sigue sin dar se dibuja con menos pixeles: se ve menos lindo, pero se puede manejar.
function cuidarFluidez(seg) {
  if (seg > 0.5) return;   // la pestaña estuvo tapada: no cuenta
  cuadros++;
  if (seg > 1 / 30) lentos++;
  if (cuadros < 90) return;
  if (lentos > 60) {
    if (post.prendido()) post.prender(false);
    else if (nitidez > 0.6) { nitidez = Math.max(0.6, nitidez * 0.75); render.setPixelRatio(nitidez); medir(); }
  }
  cuadros = lentos = 0;
}
const HACIA = new THREE.Vector3(), AL_AUTO = new THREE.Vector3();

function cuadro(ahora) {
  requestAnimationFrame(cuadro);
  // con el creador de pistas abierto (tapa toda la pantalla) no se dibuja nada: el aparato descansa
  if (creador.abierto() && !cargando) { antes = ahora; return; }
  cuidarFluidez((ahora - antes) / 1000);
  const dt = Math.min(0.05, (ahora - antes) / 1000);
  antes = ahora;
  reloj3d += dt;
  if (travesia.activa()) { travesia.cuadro(dt, reloj3d); return; }
  const corriendo = pantalla === 'jugando' && partida.estado === 'corriendo';
  const manda = corriendo ? teclas.leer(ent) : QUIETO;
  if (corriendo && ayudaDeLaPasada) { ayuda.aplicar(c, partida.indice, partida.lejos, ent); hud.frenaSola(ayuda.frenando()); }
  resto += dt;
  while (resto >= JUEGO.paso) { c.paso(manda, JUEGO.paso); resto -= JUEGO.paso; }
  if (pantalla === 'jugando') {
    // el choque suena en el momento (cada cosa a lo suyo, y la chapa cruje mas cuanto mas roto esta el auto: ver audio.js)
    if (partida.estado === 'corriendo') sonido.toque(c.contra, c.impacto, partida.roto);
    partida.paso(c, dt);
    for (const e of partida.eventos.splice(0)) atender(e);
    if (tFin > 0 && (tFin -= dt) <= 0) terminar();
  }
  if (pantalla === 'jugando') {
    // avisos que quedan mientras dure el problema. Si el auto quedo trabado, titila el boton de volver al camino
    // y el aviso muestra su dibujo y lo que cuesta.
    const enCarrera = partida.estado === 'corriendo', quedo = enCarrera && !!partida.trabado;
    const dice = !enCarrera ? '' : quedo ? (tactil ? '' : 'R para volver al camino: ') + '+' + JUEGO.penalizacion + ' s' : partida.contramano ? 'Vas para atrás' : '';
    if (dice !== avisado) { hud.aviso(dice, 0, quedo ? 'volver' : ''); avisado = dice; }
    if (quedo !== trabado) { trabado = quedo; hud.llamar(quedo); }
    if ((c.velocidad < -0.5) !== paraAtras) { paraAtras = !paraAtras; raiz.classList.toggle('marcha-atras', paraAtras); }
    hud.actualizar(c, partida, dt);
    hud.volante(teclas.volante());
    hud.notas(copiloto.proximas(partida.indice, c.velocidad), partida.indice);
    if (partida.estado === 'corriendo') {
      copiloto.paso(partida.indice, c.velocidad);
      // la pasada se va grabando, y el fantasma del rival corre al lado
      // (en una vuelta cerrada, recien desde que se cruza la raya: cada ronda se graba aparte)
      if (partida.lanzado) grabacion.muestra(partida.tiempo, c);
      if (rival && partida.lanzado) {
        const e = espectroDe(rival.auto);
        rival.fantasma.pose(partida.tiempo, lugar);
        if (lugar.termino) e.ocultar(); else e.poner(lugar);
        hud.rival(rival.nombre, rival.fantasma.ventaja(partida.tiempo, partida.indice));
      }
    }
  }
  else menu.prueba(teclas.inclinacion());   // (en la configuracion se puede probar la sensibilidad de la inclinacion)
  dibujo.actualizar(c, dt, conEfectos);
  fx.actualizar(c, dt);
  camara.seguir(c, dt);
  if (c.rompio.length) sonido.voltear(c.rompio, Math.abs(c.velocidad));   // lo que se lleva puesto suena (y el mundo lo tira: ver world.js)
  mundo.animar(dt, reloj3d, c, partida.indice);
  trazada.actualizar(c, partida.indice);
  mundo.mirar(camara, c, render.domElement.width, render.domElement.height);
  // (el sonido del auto: un auto roto suena roto)
  sonido.actualizar(c, pantalla === 'jugando' ? partida.roto : 0, dt);
  // el foco de la imagen va en el auto: a cuantos metros esta, medido hacia donde mira la camara
  camara.cam.getWorldDirection(HACIA);
  post.dibujar(escena, camara.cam, AL_AUTO.set(c.pos[0], c.pos[1], c.pos[2]).sub(camara.cam.position).dot(HACIA));
  // con el primer cuadro dibujado, se va el cartel de carga y aparece la portada
  if (cargando) { cargando = false; raiz.classList.remove('cargando'); menu.pintar(); menu.acomodar(); menu.enfocar(); if (arrancar) { arrancar = false; largar(); } }
}

window.addEventListener('resize', medir);
// Venimos de tocar una card de otra pista ("#largar"): al aparecer el primer cuadro empieza sola la pasada. (En un iPhone el permiso del
// sensor de inclinacion solo se puede pedir con un toque: ahi se queda en el inicio, con la card de esa pista, a un toque de largar.)
let arrancar = location.hash === '#largar' && !(window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission === 'function' && teclas.esTactil());
if (location.hash === '#largar') quedarseEn(numero);
$('otra').addEventListener('click', largar);   // (los botones de correr del inicio los maneja menu.js: ver "correr")
$('salir').addEventListener('click', aLaPortada);
medir();
await cargarRival();
menu.portada(true);
await respiro('Últimos ajustes…', 5);
// los materiales se preparan antes de mostrar nada, asi el primer cuadro no se traba (si no se puede, se preparan al dibujar)
try {
  if (render.extensions.has('KHR_parallel_shader_compile')) await Promise.race([render.compileAsync(escena, camara.cam), new Promise((sigue) => setTimeout(sigue, 8000))]);
  else render.compile(escena, camara.cam);
} catch (e) { /* no pasa nada */ }
menu.listo();
if (window.cargaPaso) window.cargaPaso(6, 'El primer cuadro');
requestAnimationFrame(cuadro);

// --- lo del servidor, con el juego ya andando (nada de esto demora la carga) ---
// Si el link era una invitacion a un club, se entra y se abre su tabla. Si no: se sube lo que haya quedado sin subir
// y se piden las tablas de mis clubes.
// (Se espera a que el juego haya dibujado un par de cuadros: el primero es pesado, y con el aparato trabado los pedidos
// al servidor se cuelgan. Si la pestaña esta escondida no se dibuja nada: ahi se espera un par de segundos y listo.)
const yaAnda = new Promise((sigue) => { requestAnimationFrame(() => requestAnimationFrame(sigue)); setTimeout(sigue, 2500); });
if (invitacion) {
  quedarseEn(numero);
  if (!nube.hay) menu.decir('Ese link es una invitación a un club, pero el servidor del juego no está disponible.');
  else yaAnda.then(async () => {
    let r = await entrarAlClub(invitacion[1]);
    // (si no se pudo llegar al servidor, se prueba una vez mas: entrar dos veces no hace daño)
    if (r.error && !r.estado) { await new Promise((sigue) => setTimeout(sigue, 2500)); r = await entrarAlClub(invitacion[1]); }
    if (r.error) menu.decir('No pude sumarte al club. ' + r.error); else menu.verClub(r.codigo, 'Ya estás en «' + r.nombre + '».');
  });
} else yaAnda.then(sincronizar).then((quedan) => { if (quedan) reintentarLuego(); tablasDeLosClubes(true); });
// El link de un amigo de la Travesia ("#t=Ana.2347"): no lleva pista ni fantasma, solo quien es y cuantos km hizo. Se lo suma a
// la tabla de la Travesia y se avisa, con el boton para ir al modo.
const deLaTravesia = leerEnlaceTravesia(location.hash);
if (deLaTravesia) {
  club.anotarAmigoTravesia(deLaTravesia);
  quedarseEn(numero);
  menu.pintar();
  menu.verCard('travesia');   // (el inicio abre en la Travesia, con su aviso y el boton para largar)
  $('cartelTvTexto').textContent = deLaTravesia.nombre + ' llegó a ' + deLaTravesia.km.toFixed(1).replace('.', ',') + ' km en la Travesía';
  $('cartelTv').hidden = false;
  $('cartelTvIr').addEventListener('click', () => { $('cartelTv').hidden = true; if (pantalla !== 'jugando') travesia.entrar(); });
  $('cartelTvCerrar').addEventListener('click', () => { $('cartelTv').hidden = true; });
}
// recien publicada una pista de la comunidad: se avisa, y se ofrece compartirla
if (location.hash === '#publicada' && comunidad && !comunidad.borrador) {
  quedarseEn(numero);
  menu.decir('¡Publicada! Compartila con el botón: dura dos semanas.');
}
// Al volver al juego (por ejemplo, despues de pasar la invitacion por WhatsApp) se piden de nuevo las tablas.
// (y se sube lo que haya quedado pendiente). Lo mismo al volver la señal.
document.addEventListener('visibilitychange', () => { if (!document.hidden && pantalla !== 'jugando') alVolver(); });
window.addEventListener('online', () => { if (pantalla !== 'jugando') alVolver(); else reintentarLuego(); });

// Para probar desde la consola: shakedown.ir(400) lleva el auto al metro 400 del camino.
// Solo en una copia local del juego: en el publicado seria una trampa de una linea.
if (enCasa) window.shakedown = {
  T, ref, camara, teclas, partida, club, fx, mundo, copiloto, escena, render, post, ajustar, gusto, trazada, ayuda, nube, tablasDeLosClubes, recordesDeLosClubes, subirTravesia, tutorial, creador, comunidad, sonido, papelitos,
  auto: () => c,
  travesia: travesia.prueba, entrarTravesia: () => travesia.entrar(),
  dibujo: () => dibujo,
  estado: () => ({ pantalla, modo, nitidez, pista: numero, estado: partida.estado, tiempo: partida.tiempo, indice: partida.indice, sector: partida.sector, colores: partida.colores(), roto: partida.roto, vueltas: partida.vueltas, rival: rival && rival.nombre, ...(T.vuelta ? { rondas, mejor: mejorRonda && mejorRonda.r.t } : {}) }),
  largar,
  saltearEspera: () => { if (tFin > 0) tFin = 0.001; },   // (para las pruebas) muestra el resultado sin esperar
  // (para las pruebas) maneja unos segundos con el volante y el pedal fijos, con la camara y los efectos siguiendolo
  simular: (seg, x, y, mano = false) => { for (let i = 0; i < seg / JUEGO.paso; i++) { c.paso({ x, y, mano }, JUEGO.paso); if (i % 2) { fx.actualizar(c, JUEGO.paso * 2); dibujo.actualizar(c, JUEGO.paso * 2, conEfectos); camara.seguir(c, JUEGO.paso * 2); } } },
  avanzar: (dt) => { partida.paso(c, dt); if (partida.estado === 'corriendo' && partida.lanzado) grabacion.muestra(partida.tiempo, c); for (const e of partida.eventos.splice(0)) atender(e); },
  salir: () => aLaPortada(),
  ir: (i) => { i = Math.max(0, Math.min(P.n - 1, i)); c.poner(P.X[i], P.Z[i], Math.atan2(P.HX[i], -P.HZ[i])); partida.indice = i; fx.cortar(); camara.saltar(); },
};

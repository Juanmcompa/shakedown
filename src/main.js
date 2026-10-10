// SHAKEDOWN: arma el juego y corre el ciclo principal.
import * as THREE from 'three';
import { JUEGO, AUTOS, REFERENCIA } from './config.js';
import { hoy } from './dia.js';
import { generarPista, VERSION } from './generador.js';
import { crearTerreno } from './terrain.js';
import { crearReferencia } from './referencia.js';
import { crearAuto } from './vehicle.js';
import { crearPartida } from './reglas.js';
import { crearCopiloto } from './copiloto.js';
import { crearGrabacion, leerCodigo, crearFantasma } from './fantasma.js';
import { crearClub } from './club.js';
import { crearMenu } from './menu.js';
import { crearMundo } from './world.js';
import { crearPost } from './post.js';
import { crearDibujo, crearEspectro } from './autos.js';
import { crearCamara } from './camera.js';
import { crearEfectos } from './fx.js';
import { crearHuellas } from './huellas.js';
import { crearSonido } from './audio.js';
import { crearTeclas } from './input.js';
import { crearHud } from './hud.js';

const $ = (id) => document.getElementById(id);

// Si el navegador guardo una pagina vieja que no coincide con este codigo, la pide de nuevo.
// (Subir este numero y el de data-pagina en index.html cada vez que cambie el HTML.)
if (document.documentElement.dataset.pagina !== '7' && !location.search.includes('fresca')) location.replace(location.pathname + '?fresca=' + Date.now() + location.hash);

let render;
try { render = new THREE.WebGLRenderer({ canvas: $('lienzo'), antialias: true }); } catch (e) {
  $('largar').textContent = 'Este navegador no pudo iniciar los gráficos 3D';
  throw e;
}
const liviano = window.matchMedia('(pointer: coarse)').matches;   // celular o tablet: menos pixeles y sombras mas chicas
let nitidez = Math.min(window.devicePixelRatio, liviano ? 1.5 : 2), cuadros = 0, lentos = 0;   // pixeles dibujados por cada pixel de pantalla
render.setPixelRatio(nitidez);
render.shadowMap.enabled = true;

// --- que pista se corre: la del link de un amigo, la pedida con ?p=numero, o la de hoy ---
const HOY = hoy(), consulta = new URLSearchParams(location.search), pedida = Math.floor(Number(consulta.get('p')));
const enlace = /[#&]r=([\w-]+)/.exec(location.hash), leido = enlace ? await leerCodigo(enlace[1]) : null;
const numero = leido && leido.marca.pista <= HOY ? leido.marca.pista : pedida >= 1 && (pedida <= HOY || consulta.has('futuro')) ? pedida : HOY;

const etapa = generarPista(numero), T = crearTerreno(etapa), P = T.camino, ref = crearReferencia(T, AUTOS[REFERENCIA]);
const club = crearClub(numero, HOY, VERSION), copiloto = crearCopiloto(T);
// lo que trajo el link: el resultado del amigo (con su fantasma) y los otros que el conocia. El queda de rival.
// (Si el link es de una version anterior de la pista, ya no sirve: ese camino no existe mas.)
let linkViejo = false;
if (leido && leido.marca.pista === numero) {
  if (leido.version !== VERSION) linkViejo = true;
  else {
    club.anotarAmigo({ ...leido.marca, codigo: enlace[1] });
    for (const o of leido.tabla) club.anotarAmigo(o);
    if (leido.tieneVuelta && leido.marca.nombre !== club.nombre()) club.elegirRival(leido.marca.nombre + (leido.marca.practica ? '|p' : ''));
  }
  history.replaceState(null, '', location.pathname + (numero !== HOY ? '?p=' + numero : ''));
}

const escena = new THREE.Scene();
const huellas = crearHuellas(T, render), mundo = crearMundo(T, escena, liviano, huellas), partida = crearPartida(T, ref.sectores);
// el polvo: no hay si llueve, y se lo lleva un viento suave que cambia con la pista
const soplo = (etapa.semilla % 628) / 100, fuerzaDelViento = 0.35 + (etapa.semilla % 7) * 0.08;
const camara = crearCamara(T), fx = crearEfectos(escena, huellas, 1 - mundo.luz.mojado, [Math.sin(soplo) * fuerzaDelViento, Math.cos(soplo) * fuerzaDelViento]), sonido = crearSonido(), hud = crearHud();
const post = crearPost(render, etapa.clima, liviano);
if (consulta.has('simple')) post.prender(false);   // ?simple: sin desenfoque ni brillos

// --- el auto del jugador (se puede cambiar en la portada) y los fantasmas ---
let c = null, dibujo = null;
function ponerAuto(id) {
  if (!AUTOS[id]) id = 'vitarita';
  if (dibujo) escena.remove(dibujo.grupo);
  club.ponerAuto(id);
  c = crearAuto(T, AUTOS[id]);
  dibujo = crearDibujo(escena, AUTOS[id]);
  partida.preparar(c);
  camara.saltar();
}
ponerAuto(club.auto());
const espectros = {};
const espectroDe = (id) => espectros[id] || (espectros[id] = crearEspectro(escena, T, AUTOS[id] || AUTOS.vitarita));

// --- contra quien se corre ---
// rival: null o { clave, nombre, t, ab, practica, auto, fantasma }. La clave es el nombre del amigo, o '*' si es una pasada propia.
let rival = null;
function buscarRival() {
  const [clave, deLaPractica] = (club.rival() || '').split('|');
  if (clave === '-') return null;   // eligio correr solo
  const mia = (lista) => lista.find((x) => x.mio && x.codigo);
  let r = clave ? (deLaPractica ? club.practicas() : club.tabla()).find((x) => (clave === '*' ? x.mio : !x.mio && x.nombre === clave)) : null;
  // sin rival elegido: despues de la oficial, se practica contra la mejor pasada propia
  if (!(r && r.codigo) && !club.sePuedeOficial()) { const a = mia(club.tabla()), b = mia(club.practicas()); r = a && b ? (b.t < a.t || a.ab ? b : a) : a || b; }
  return r && r.codigo ? r : null;
}
async function cargarRival() {
  const r = buscarRival(), l = r ? await leerCodigo(r.codigo) : null;
  const vuelta = l && l.version === VERSION && l.marca.pista === numero ? l.vuelta(P) : null;
  rival = vuelta ? { clave: r.mio ? '*' : r.nombre, nombre: r.mio ? 'Vos' : r.nombre, t: r.t, ab: r.ab, practica: !!r.practica, auto: r.auto, fantasma: crearFantasma(vuelta, T) } : null;
  for (const id in espectros) espectros[id].ocultar();
  if (rival) espectroDe(rival.auto).nombre(rival.nombre);
  menu.pintar();
}

const menu = crearMenu({
  T, club, hoy: HOY, ref, copiloto,
  aviso: linkViejo ? 'El link que abriste es de una versión anterior de esta pista: ese tiempo ya no vale.' : '',
  rival: () => rival,
  elegirAuto: (id) => { if (pantalla !== 'jugando') ponerAuto(id); },
  elegirRival: (clave, deLaPractica) => { club.elegirRival(clave ? clave + (deLaPractica ? '|p' : '') : '-'); cargarRival(); },
});

let pantalla = 'portada';   // portada, jugando o fin
let modo = 'practica';      // oficial o practica
let antes = performance.now(), resto = 0, reloj3d = 0, tactil = false, grabacion = null, tFin = 0, avisado = '', trabado = false, paraAtras = false;
// lo que se eligio la ultima vez: la camara, y si van el sonido y la voz del copiloto. Los botones muestran como quedo.
let conVoz = club.gusto('voz') !== false;
if (club.gusto('camara')) camara.cambiar(club.gusto('camara'));
if (club.gusto('sonido') === false) sonido.alternar();
hud.camara(camara.modo().id); hud.prendido('sonido', !sonido.mudo()); hud.prendido('voz', conVoz);
const lugar = { x: 0, z: 0, rumbo: 0, alto: 0 };
const ent = { x: 0, y: 0, mano: false }, QUIETO = { x: 0, y: 0, mano: true };

// En el celular: pedales en pantalla y doblar inclinando. Se prende al largar con el dedo,
// porque el permiso del sensor y la pantalla completa solo se pueden pedir desde un toque.
function mandosDeCelular() {
  tactil = true;
  const raiz = document.documentElement;
  raiz.classList.add('tactil');
  $('tactil').hidden = false;
  teclas.celular((inclina) => { raiz.classList.toggle('sin-volante', !inclina); encuadrar(); });
  if (raiz.requestFullscreen) raiz.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
  if (navigator.wakeLock) navigator.wakeLock.request('screen').catch(() => {});
}

function largar() {
  if (pantalla === 'jugando') return;
  if (!tactil && teclas.esTactil()) mandosDeCelular();
  modo = club.sePuedeOficial() ? 'oficial' : 'practica';
  document.documentElement.classList.toggle('practica', modo === 'practica');   // en las practicas aparece el boton de salir
  pantalla = 'jugando';
  tFin = 0; avisado = '';
  partida.preparar(c);
  partida.largar();
  grabacion = crearGrabacion(T);
  copiloto.reiniciar();
  copiloto.voz(conVoz);
  fx.cortar(); fx.limpiar();
  huellas.limpiar();
  camara.saltar();
  mundo.reiniciar();
  hud.sectores('', 0); hud.aviso(''); hud.grande(''); hud.sinRival(); hud.mostrar(true);
  encuadrar();
  menu.cerrarFin();
  menu.portada(false);
  for (const id in espectros) espectros[id].ocultar();
  sonido.iniciar();
}

// Cierra la pasada: llegaste o abandonaste. Guarda el resultado y lo muestra.
function terminar() {
  pantalla = 'fin';
  hud.llamar(false); trabado = false;
  const llego = partida.estado === 'llegada';
  const r = { pista: numero, nombre: club.nombre(), t: partida.tiempo, s: partida.sectores.map((x) => x.tiempo), c: partida.colores(), auto: club.auto(),
    ab: llego ? '' : partida.motivo || 'roto', vueltas: partida.vueltas, roto: Math.round(partida.roto), practica: modo === 'practica' };
  if (modo === 'oficial') club.cerrarOficial(r); else club.anotarPractica(r);
  // el link se arma con el nombre que haya en ese momento (si lo cambia, se arma de nuevo)
  const g = grabacion;
  let hecho = { nombre: null, codigo: null };
  const armarLink = async () => {
    if (hecho.nombre !== club.nombre()) {
      hecho = { nombre: club.nombre(), codigo: await g.codigo({ ...r, nombre: club.nombre() }, club.tabla().filter((x) => !x.mio)) };
      club.ponerCodigo(r, hecho.codigo);
    }
    return hecho.codigo;
  };
  armarLink().then(cargarRival);
  for (const id in espectros) espectros[id].ocultar();
  hud.aviso(''); hud.grande('');
  hud.mostrar(false);
  menu.fin(r, armarLink);
}

function aLaPortada() {
  if (pantalla === 'jugando' && modo === 'oficial') return;   // la oficial no se deja por la mitad
  pantalla = 'portada';
  partida.preparar(c);
  fx.cortar(); camara.saltar();
  hud.mostrar(false);
  menu.cerrarFin();
  menu.portada(true);
}

// Lo que van avisando las reglas se muestra en pantalla.
const VUELTA = { caida: 'Te fuiste al vacío', afuera: 'Te fuiste lejos del camino', vuelco: 'Volcaste', pedido: '' };
const CUENTA = ['', 'uno', 'dos', 'tres'];
function atender(e) {
  if (e.tipo === 'cuenta') { hud.grande(String(e.dato), 0.95, 'cuenta'); copiloto.hablar(CUENTA[e.dato]); }
  else if (e.tipo === 'ya') { hud.grande('¡YA!', 0.9, 'ya'); if (modo === 'oficial') club.empezarOficial(club.auto()); }
  else if (e.tipo === 'sector') {
    const n = partida.sectores.length, par = ref.sectores[n - 1], dif = e.dato.tiempo - par;
    hud.sectores(partida.colores(), n);
    hud.grande((dif < 0 ? '−' : '+') + Math.abs(dif).toFixed(1), 1.8, e.dato.color === 'v' ? 'verde' : e.dato.color === 'a' ? 'amarillo' : 'rojo');
  } else if (e.tipo === 'golpe') camara.sacudir(e.dato);
  else if (e.tipo === 'vuelta') {
    fx.cortar();
    camara.saltar();
    hud.grande('+' + JUEGO.penalizacion + ' s', 1.8, 'rojo');
    hud.aviso(VUELTA[e.dato] || '', 2.5);
  } else if (e.tipo === 'llegada') { tFin = 1.7; hud.grande('', 0); }
  else if (e.tipo === 'abandono') tFin = 1.3;
}

const teclas = crearTeclas((tecla) => {
  if (tecla === 'Enter') { if (pantalla !== 'jugando' && !['BUTTON', 'INPUT', 'A'].includes(document.activeElement.tagName)) largar(); }
  else if (tecla === 'KeyR') { if (pantalla === 'jugando') partida.volver(c, 'pedido'); }
  else if (tecla === 'Escape') aLaPortada();
  else if (tecla === 'KeyC') { const m = camara.cambiar(); club.gusto('camara', m.id); hud.camara(m.id); hud.aviso(m.nombre, 1.2); }
  else if (tecla === 'KeyM') { const mudo = sonido.alternar(); club.gusto('sonido', !mudo); hud.prendido('sonido', !mudo); }
  else if (tecla === 'KeyV') { conVoz = !conVoz; club.gusto('voz', conVoz); copiloto.voz(conVoz); hud.prendido('voz', conVoz); }
});

// Donde puede quedar el auto en la pantalla. En el celular, nunca mas abajo que el freno de mano (parado)
// o que los pedales (acostado), ni tan al costado como para quedar detras de un boton.
function encuadrar() {
  const W = window.innerWidth, H = window.innerHeight, parado = W < H;
  let abajo = 0.16, lados = 0.2;
  if (tactil) {
    const mano = document.querySelector('.redondo.mano').getBoundingClientRect(), pedal = document.querySelector('.pedal.gas').getBoundingClientRect();
    if (mano.height) abajo = parado ? (H - mano.top - mano.height / 2) / H : (H - pedal.top + 10) / H;
    lados = parado ? 0.24 : 0.28;
  }
  camara.encuadrar(Math.min(0.4, abajo), parado ? 0.24 : 0.2, lados);
}
function medir() {
  render.setSize(window.innerWidth, window.innerHeight, false);
  camara.pantalla(window.innerWidth, window.innerHeight);
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
  cuidarFluidez((ahora - antes) / 1000);
  const dt = Math.min(0.05, (ahora - antes) / 1000);
  antes = ahora;
  reloj3d += dt;
  const corriendo = pantalla === 'jugando' && partida.estado === 'corriendo';
  const manda = corriendo ? teclas.leer(ent) : QUIETO;
  resto += dt;
  while (resto >= JUEGO.paso) { c.paso(manda, JUEGO.paso); resto -= JUEGO.paso; }
  if (pantalla === 'jugando') {
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
    if ((c.velocidad < -0.5) !== paraAtras) { paraAtras = !paraAtras; document.documentElement.classList.toggle('marcha-atras', paraAtras); }
    hud.actualizar(c, partida, dt);
    hud.volante(teclas.volante());
    hud.notas(copiloto.proximas(partida.indice, c.velocidad), partida.indice);
    if (partida.estado === 'corriendo') {
      copiloto.paso(partida.indice, c.velocidad);
      // la pasada se va grabando, y el fantasma del rival corre al lado
      grabacion.muestra(partida.tiempo, c);
      if (rival) {
        const e = espectroDe(rival.auto);
        rival.fantasma.pose(partida.tiempo, lugar);
        if (lugar.termino) e.ocultar(); else e.poner(lugar);
        hud.rival(rival.nombre, rival.fantasma.ventaja(partida.tiempo, partida.indice));
      }
    }
  }
  dibujo.actualizar(c);
  fx.actualizar(c, dt);
  camara.seguir(c, dt);
  mundo.animar(dt, reloj3d, c, partida.indice);
  mundo.mirar(camara, c, render.domElement.width, render.domElement.height);
  sonido.actualizar(c);
  // el foco de la imagen va en el auto: a cuantos metros esta, medido hacia donde mira la camara
  camara.cam.getWorldDirection(HACIA);
  post.dibujar(escena, camara.cam, AL_AUTO.set(c.pos[0], c.pos[1], c.pos[2]).sub(camara.cam.position).dot(HACIA));
}

window.addEventListener('resize', medir);
$('largar').addEventListener('click', largar);
$('otra').addEventListener('click', largar);
$('salir').addEventListener('click', aLaPortada);
medir();
await cargarRival();
menu.portada(true);
$('largar').disabled = false;
$('largar').focus({ preventScroll: true });
requestAnimationFrame(cuadro);

// para probar desde la consola: shakedown.ir(400) lleva el auto al metro 400 del camino
window.shakedown = {
  T, ref, camara, teclas, partida, club, fx, mundo, copiloto, escena, render, post,
  auto: () => c,
  estado: () => ({ pantalla, modo, nitidez, pista: numero, estado: partida.estado, tiempo: partida.tiempo, indice: partida.indice, sector: partida.sector, colores: partida.colores(), roto: partida.roto, vueltas: partida.vueltas, rival: rival && rival.nombre }),
  largar,
  saltearEspera: () => { if (tFin > 0) tFin = 0.001; },   // (para las pruebas) muestra el resultado sin esperar
  // (para las pruebas) maneja unos segundos con el volante y el pedal fijos, con la camara y los efectos siguiendolo
  simular: (seg, x, y, mano = false) => { for (let i = 0; i < seg / JUEGO.paso; i++) { c.paso({ x, y, mano }, JUEGO.paso); if (i % 2) { fx.actualizar(c, JUEGO.paso * 2); camara.seguir(c, JUEGO.paso * 2); } } },
  avanzar: (dt) => { partida.paso(c, dt); if (partida.estado === 'corriendo') grabacion.muestra(partida.tiempo, c); for (const e of partida.eventos.splice(0)) atender(e); },
  ir: (i) => { i = Math.max(0, Math.min(P.n - 1, i)); c.poner(P.X[i], P.Z[i], Math.atan2(P.HX[i], -P.HZ[i])); partida.indice = i; fx.cortar(); camara.saltar(); },
};

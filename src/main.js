// ENCAJADOS: arma el juego y corre el ciclo principal.
import * as THREE from 'three';
import { JUEGO } from './config.js';
import { ETAPA } from './etapa1.js';
import { crearTerreno } from './terrain.js';
import { crearCamioneta } from './vehicle.js';
import { crearPartida } from './reglas.js';
import { crearMundo } from './world.js';
import { crearDibujo, crearEspectro } from './truck.js';
import { crearGrabacion } from './fantasma.js';
import { crearSocial } from './social.js';
import { crearCamara } from './camera.js';
import { crearEfectos } from './fx.js';
import { crearSonido } from './audio.js';
import { crearTeclas } from './input.js';
import { crearHud, reloj } from './hud.js';

const $ = (id) => document.getElementById(id);

// Si el navegador guardo una pagina vieja que no coincide con este codigo, la pide de nuevo.
// (Subir este numero y el de data-pagina en index.html cada vez que cambie el HTML.)
if (document.documentElement.dataset.pagina !== '4' && !location.search.includes('fresca')) location.replace(location.pathname + '?fresca=' + Date.now());

let render;
try { render = new THREE.WebGLRenderer({ canvas: $('lienzo'), antialias: true }); } catch (e) {
  $('largar').textContent = 'Este navegador no pudo iniciar los gráficos 3D';
  throw e;
}
const liviano = window.matchMedia('(pointer: coarse)').matches;   // celular o tablet: menos pixeles y sombras mas chicas
render.setPixelRatio(Math.min(window.devicePixelRatio, liviano ? 1.5 : 2));
render.shadowMap.enabled = true;

const T = crearTerreno(ETAPA), P = T.camino, escena = new THREE.Scene();
const mundo = crearMundo(T, escena, liviano), c = crearCamioneta(T), dibujo = crearDibujo(escena), partida = crearPartida(T);
const camara = crearCamara(T), fx = crearEfectos(escena), sonido = crearSonido(), hud = crearHud(T);
const social = crearSocial(T), espectro = crearEspectro(escena, T);

let pantalla = 'portada';   // portada, jugando o fin
let antes = performance.now(), resto = 0, reloj3d = 0, mejor = 0, tactil = false, pegado = false, pocaNafta = false, grabacion = null;
const lugar = { x: 0, z: 0, rumbo: 0 };
try { mejor = Number(localStorage.getItem('encajados.etapa' + ETAPA.version)) || 0; } catch (e) { /* sin memoria no se guarda el record */ }
const ent = { x: 0, y: 0, mano: false }, QUIETO = { x: 0, y: 0, mano: true };

// En el celular: pedales en pantalla y doblar inclinando. Se prende al largar con el dedo,
// porque el permiso del sensor y la pantalla completa solo se pueden pedir desde un toque.
function mandosDeCelular() {
  tactil = true;
  const raiz = document.documentElement;
  raiz.classList.add('tactil');
  $('tactil').hidden = false;
  teclas.celular((inclina) => {
    raiz.classList.toggle('sin-volante', !inclina);
    hud.aviso(inclina ? 'Incliná el celu para doblar.' : 'No pude leer la inclinación del celu: doblá con las flechas.', 3.5);
  });
  if (raiz.requestFullscreen) raiz.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
  if (navigator.wakeLock) navigator.wakeLock.request('screen').catch(() => {});
}

function largar() {
  if (!tactil && teclas.esTactil()) mandosDeCelular();
  pantalla = 'jugando';
  pegado = pocaNafta = false;
  c.baja = false;
  partida.empezar(c);
  grabacion = crearGrabacion();
  fx.cortar();
  camara.saltar();
  mundo.reiniciar();
  hud.controles(0); hud.mejor(mejor); hud.aviso(''); hud.cambio(false); hud.mostrar(true);
  $('portada').hidden = true; $('fin').hidden = true;
  sonido.iniciar();
}

function cambiar() {
  if (pantalla !== 'jugando') return;
  c.baja = !c.baja;
  hud.cambio(c.baja);
  hud.aviso(c.baja ? 'Reductora en baja: más fuerza, menos velocidad.' : 'Reductora en alta: más velocidad, menos fuerza.', 2);
}

// Cierra la etapa: llegaste o perdiste.
const PERDER = {
  nafta: ['Te quedaste sin nafta', 'Patinar gasta casi el triple. En el barro conviene ir en alta y sin pisar a fondo.'],
  rota: ['Rompiste la camioneta', 'Los golpes suman. Frená antes de los autos tirados, los árboles y las piedras.'],
  rescates: ['Te quedaste sin rescates', 'Hay ' + JUEGO.rescates + ' por etapa. En la cornisa y en el derrumbe, despacio y mirando el borde.'],
};
function terminar(llego) {
  pantalla = 'fin';
  const t = partida.tiempo, m = JUEGO.medallas;
  if (llego) {
    const medalla = t <= m[0] ? 'oro' : t <= m[1] ? 'plata' : t <= m[2] ? 'bronce' : '';
    const record = !mejor || t < mejor;
    if (record) { mejor = t; try { localStorage.setItem('encajados.etapa' + ETAPA.version, String(t)); } catch (e) { /* idem */ } }
    $('finTitulo').textContent = 'Llegaste a la cumbre';
    $('finGrande').textContent = reloj(t);
    $('finMedalla').textContent = medalla ? 'Medalla de ' + medalla : 'Sin medalla esta vez';
    $('finDetalle').textContent = (record ? 'Es tu mejor tiempo. ' : 'Tu mejor tiempo es ' + reloj(mejor) + '. ')
      + 'Te sobró ' + Math.round(partida.nafta) + ' de nafta y usaste ' + partida.usados + ' de ' + JUEGO.rescates + ' rescates. '
      + 'Oro ' + reloj(m[0]) + ', plata ' + reloj(m[1]) + ', bronce ' + reloj(m[2]) + '.';
  } else {
    const nombre = ETAPA.tramos.slice(0, P.T[partida.indice] + 1).reverse().find((x) => x.nombre);
    $('finTitulo').textContent = PERDER[partida.motivo][0];
    $('finGrande').textContent = partida.indice + ' m';
    $('finMedalla').textContent = 'de ' + P.n + '. Llegaste hasta ' + (nombre ? nombre.nombre : 'la largada') + '.';
    $('finDetalle').textContent = PERDER[partida.motivo][1];
  }
  if (llego) social.llegada(grabacion, partida); else social.derrota();
  espectro.ocultar();
  $('otra').textContent = llego ? 'Correr de nuevo' : 'Probar de nuevo';
  hud.aviso('');
  hud.mostrar(false);
  $('cartel').hidden = true;
  $('fin').hidden = false;
}

// Lo que van avisando las reglas se muestra en pantalla.
const RESCATE = { caida: 'Te desbarrancaste. ', afuera: 'Te saliste del camino. ', pedido: '' };
function atender(e) {
  if (e.tipo === 'tramo') hud.cartel(e.dato);
  else if (e.tipo === 'control') { mundo.pasar(e.dato - 1); hud.controles(e.dato); hud.aviso('Control ' + e.dato + ' de ' + T.controles.length, 2); }
  else if (e.tipo === 'bidon') { mundo.juntar(e.dato); hud.aviso('Bidón: +' + JUEGO.nafta.bidon + ' de nafta.', 2); }
  else if (e.tipo === 'golpe') camara.sacudir(e.dato);
  else if (e.tipo === 'derrumbe') hud.aviso('Derrumbe: la tierra se corre hacia el borde. Apuntá cuesta arriba y no pares.', 4);
  else if (e.tipo === 'rescate') {
    fx.cortar();
    camara.saltar();
    const n = partida.rescates;
    hud.aviso(RESCATE[e.dato] + (n === 0 ? 'Era el último rescate.' : n === 1 ? 'Te queda 1 rescate.' : 'Te quedan ' + n + ' rescates.'), 3);
  } else if (e.tipo === 'llegada') terminar(true);
  else if (e.tipo === 'perdido') terminar(false);
}

const teclas = crearTeclas((tecla) => {
  if (tecla === 'Enter') { if (pantalla !== 'jugando' && !['BUTTON', 'INPUT'].includes(document.activeElement.tagName)) largar(); }
  else if (tecla === 'KeyR') { if (pantalla === 'jugando') partida.rescatar(c, 'pedido'); }
  else if (tecla === 'ShiftLeft' || tecla === 'ShiftRight' || tecla === 'KeyX') cambiar();
  else if (tecla === 'KeyC') hud.aviso('Cámara: ' + camara.cambiar().toLowerCase(), 1.5);
  else if (tecla === 'KeyM') hud.aviso(sonido.alternar() ? 'Sonido apagado' : 'Sonido prendido', 1.5);
});

function medir() {
  render.setSize(window.innerWidth, window.innerHeight, false);
  camara.pantalla(window.innerWidth, window.innerHeight);
}

function cuadro(ahora) {
  requestAnimationFrame(cuadro);
  const dt = Math.min(0.05, (ahora - antes) / 1000);
  antes = ahora;
  reloj3d += dt;
  const manda = pantalla === 'jugando' ? teclas.leer(ent) : QUIETO;
  resto += dt;
  while (resto >= JUEGO.paso) { c.paso(manda, JUEGO.paso); resto -= JUEGO.paso; }
  if (pantalla === 'jugando') {
    partida.paso(c, ent.y, dt);
    for (const e of partida.eventos.splice(0)) atender(e);
  }
  if (pantalla === 'jugando') {
    // avisos que quedan mientras dure el problema
    const volver = tactil ? 'tocá Volver al control' : 'tocá R para volver al control';
    if (partida.volcado) { hud.aviso('Volcaste: ' + volver + ' (gasta un rescate).'); pegado = true; }
    else if (partida.encajado) { hud.aviso('Te encajaste. Probá marcha atrás y entrá con más envión, o ' + volver + '.'); pegado = true; }
    else if (pegado) { hud.aviso(''); pegado = false; }
    if (partida.nafta < 20 && !pocaNafta) { pocaNafta = true; hud.aviso('Queda poca nafta.', 3); }
    if (partida.nafta > 25) pocaNafta = false;
    hud.actualizar(c, partida, dt);
    hud.volante(teclas.volante());
    // la vuelta se va grabando, y el fantasma del rival corre al lado
    if (partida.estado === 'corriendo') grabacion.muestra(partida.tiempo, c);
    const rival = social.rival();
    if (rival) {
      espectro.poner(rival.fantasma.pose(partida.tiempo, lugar));
      if (partida.estado === 'corriendo') hud.rival(rival.nombre, rival.fantasma.ventaja(partida.tiempo, partida.indice));
    }
  }
  dibujo.actualizar(c);
  fx.actualizar(c, dt);
  camara.seguir(c, dt);
  mundo.animar(dt, reloj3d);
  mundo.sombra(camara.estado.x, camara.estado.y, camara.estado.z);
  mundo.bajo(camara.estado.y);
  mundo.hueco(camara.cam, c.pos, render.domElement.width, render.domElement.height);
  sonido.actualizar(c);
  render.render(escena, camara.cam);
}

window.addEventListener('resize', medir);
$('largar').addEventListener('click', largar);
$('otra').addEventListener('click', largar);
social.alCambiarRival((r) => { if (r) espectro.nombre(r.nombre); else espectro.ocultar(); });
social.abrir();
medir();
partida.apoyar(c, T.largada);
$('largar').disabled = false;
$('largar').textContent = 'Largar';
$('largar').focus();
requestAnimationFrame(cuadro);

// para probar desde la consola: encajados.ir(400) lleva la camioneta al metro 400 del camino
window.encajados = {
  c, T, camara, teclas, partida,
  estado: () => ({ pantalla, estado: partida.estado, tiempo: partida.tiempo, indice: partida.indice, pasados: partida.pasados, nafta: partida.nafta, roto: partida.rotura(), rescates: partida.rescates, baja: c.baja }),
  simular: (seg, x, y) => { for (let i = 0; i < seg / JUEGO.paso; i++) { c.paso({ x, y, mano: false }, JUEGO.paso); if (i % 2) fx.actualizar(c, JUEGO.paso * 2); } },
  avanzar: (gas, dt) => { partida.paso(c, gas, dt); if (partida.estado === 'corriendo') grabacion.muestra(partida.tiempo, c); for (const e of partida.eventos.splice(0)) atender(e); },
  ir: (i) => { i = Math.max(0, Math.min(P.n - 1, i)); c.poner(P.X[i], P.Z[i], Math.atan2(P.HX[i], -P.HZ[i])); partida.indice = i; fx.cortar(); camara.saltar(); },
};

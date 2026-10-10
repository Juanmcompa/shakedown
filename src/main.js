// ENCAJADOS: arma el juego y corre el ciclo principal.
import * as THREE from 'three';
import { JUEGO } from './config.js';
import { ETAPA } from './etapa1.js';
import { crearTerreno } from './terrain.js';
import { crearCamioneta } from './vehicle.js';
import { crearMundo } from './world.js';
import { crearDibujo } from './truck.js';
import { crearCamara } from './camera.js';
import { crearEfectos } from './fx.js';
import { crearSonido } from './audio.js';
import { crearTeclas } from './input.js';
import { crearHud, reloj } from './hud.js';

const $ = (id) => document.getElementById(id);
let render;
try { render = new THREE.WebGLRenderer({ canvas: $('lienzo'), antialias: true }); } catch (e) {
  $('largar').textContent = 'Este navegador no pudo iniciar los gráficos 3D';
  throw e;
}
const liviano = window.matchMedia('(pointer: coarse)').matches;   // celular o tablet: menos pixeles y sombras mas chicas
render.setPixelRatio(Math.min(window.devicePixelRatio, liviano ? 1.5 : 2));
render.shadowMap.enabled = true;

const T = crearTerreno(ETAPA), P = T.camino, escena = new THREE.Scene();
const mundo = crearMundo(T, escena, liviano), c = crearCamioneta(T), dibujo = crearDibujo(escena);
const camara = crearCamara(T), fx = crearEfectos(escena), sonido = crearSonido(), hud = crearHud(T);

let estado = 'portada', tiempo = 0, corriendo = false, control = T.largada, pasados = 0, indice = T.largada.i, tramo = -1;
let vueltas = 0, quieto = 0, volcado = 0, caida = 0, pegado = false, antes = performance.now(), resto = 0, mejor = 0, tactil = false;
try { mejor = Number(localStorage.getItem('encajados.etapa1')) || 0; } catch (e) { /* sin memoria no se guarda el record */ }
const ent = { x: 0, y: 0, mano: false }, QUIETO = { x: 0, y: 0, mano: true };

function apoyar(p) {
  c.poner(p.x, p.z, p.rumbo);
  indice = p.i; quieto = volcado = caida = 0;
  fx.cortar();
  camara.saltar();
}

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
  estado = 'jugando'; tiempo = 0; corriendo = false; control = T.largada; pasados = 0; vueltas = 0; tramo = -1;
  apoyar(control);
  mundo.reiniciar();
  hud.controles(0); hud.mejor(mejor); hud.aviso(''); hud.mostrar(true);
  $('portada').hidden = true; $('llegada').hidden = true;
  sonido.iniciar();
}

function volver(motivo) {
  if (estado !== 'jugando') return;
  vueltas++;
  apoyar(control);
  hud.aviso(motivo, 2.5);
}

function llegar() {
  estado = 'llegada';
  const m = JUEGO.medallas, medalla = tiempo <= m[0] ? 'oro' : tiempo <= m[1] ? 'plata' : tiempo <= m[2] ? 'bronce' : '';
  const record = !mejor || tiempo < mejor;
  if (record) { mejor = tiempo; try { localStorage.setItem('encajados.etapa1', String(tiempo)); } catch (e) { /* idem */ } }
  $('tFinal').textContent = reloj(tiempo);
  $('medalla').textContent = medalla ? 'Medalla de ' + medalla : 'Sin medalla esta vez';
  $('detalle').textContent = (record ? 'Es tu mejor tiempo. ' : 'Tu mejor tiempo es ' + reloj(mejor) + '. ')
    + (vueltas === 0 ? 'No volviste a ningún control. ' : vueltas === 1 ? 'Volviste una vez a un control. ' : 'Volviste ' + vueltas + ' veces a un control. ')
    + 'Oro ' + reloj(m[0]) + ', plata ' + reloj(m[1]) + ', bronce ' + reloj(m[2]) + '.';
  hud.aviso('');
  $('cartel').hidden = true;
  $('llegada').hidden = false;
}

// Reglas: controles, meta y los tres problemas (encajarse, volcar, desbarrancarse).
function reglas(dt) {
  indice = T.indice(c.pos[0], c.pos[2], indice);
  if (!corriendo && ent.y !== 0) corriendo = true;
  if (corriendo) tiempo += dt;
  const lejos = Math.hypot(c.pos[0] - P.X[indice], c.pos[2] - P.Z[indice]) - P.W[indice] / 2;

  const t = P.T[indice];
  if (t !== tramo) { if (t > tramo && ETAPA.tramos[t].nombre) hud.cartel(ETAPA.tramos[t].nombre); tramo = t; }
  if (lejos < 4 && pasados < T.controles.length && indice >= T.controles[pasados].i) {
    control = T.controles[pasados];
    mundo.pasar(pasados);
    pasados++;
    hud.controles(pasados);
    hud.aviso('Control ' + pasados + ' de ' + T.controles.length, 2);
  }
  if (lejos < 4 && indice >= T.meta.i) return llegar();

  volcado = c.arriba[1] < 0.35 ? volcado + dt : 0;
  caida = c.pos[1] < P.Y[indice] - 10 || lejos > 45 ? caida + dt : 0;
  quieto = c.gas > 0.5 && Math.abs(c.velocidad) < 0.7 && c.enPiso > 1 ? quieto + dt : 0;
  if (caida > 1.2 || !(c.pos[1] === c.pos[1])) volver(lejos > 45 ? 'Te saliste del camino. Volvés al último control.' : 'Te desbarrancaste. Volvés al último control.');
  else if (volcado > 2) { hud.aviso('Volcaste. ' + (tactil ? 'Tocá Volver al control.' : 'Tocá R para volver al último control.')); pegado = true; }
  else if (quieto > 2.5) { hud.aviso('Te encajaste. Probá marcha atrás y entrá con más envión, o tocá ' + (tactil ? 'Volver al control.' : 'R.')); pegado = true; }
  else if (pegado && quieto === 0 && volcado === 0) { hud.aviso(''); pegado = false; }
}

const teclas = crearTeclas((tecla) => {
  if (tecla === 'Enter') { if (estado !== 'jugando' && document.activeElement.tagName !== 'BUTTON') largar(); }
  else if (tecla === 'KeyR') volver('Volvés al último control.');
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
  const manda = estado === 'jugando' ? teclas.leer(ent) : QUIETO;
  resto += dt;
  while (resto >= JUEGO.paso) { c.paso(manda, JUEGO.paso); resto -= JUEGO.paso; }
  if (estado === 'jugando') { reglas(dt); hud.actualizar(c, tiempo, indice, dt); hud.volante(teclas.volante()); }
  dibujo.actualizar(c);
  fx.actualizar(c, dt);
  camara.seguir(c, dt);
  mundo.sombra(camara.estado.x, camara.estado.y, camara.estado.z);
  mundo.bajo(camara.estado.y);
  mundo.hueco(camara.cam, c.pos, render.domElement.width, render.domElement.height);
  sonido.actualizar(c);
  render.render(escena, camara.cam);
}

window.addEventListener('resize', medir);
$('largar').addEventListener('click', largar);
$('otra').addEventListener('click', largar);
medir();
apoyar(T.largada);
$('largar').disabled = false;
$('largar').textContent = 'Largar';
$('largar').focus();
requestAnimationFrame(cuadro);

// para probar desde la consola: encajados.ir(400) lleva la camioneta al metro 400 del camino
window.encajados = {
  c, T, camara, teclas,
  estado: () => ({ estado, tiempo, indice, pasados, vueltas }),
  simular: (seg, x, y) => { for (let i = 0; i < seg / JUEGO.paso; i++) { c.paso({ x, y, mano: false }, JUEGO.paso); if (i % 2) fx.actualizar(c, JUEGO.paso * 2); } },
  ir: (i) => { i = Math.max(0, Math.min(P.n - 1, i)); c.poner(P.X[i], P.Z[i], Math.atan2(P.HX[i], -P.HZ[i])); indice = i; fx.cortar(); camara.saltar(); },
};

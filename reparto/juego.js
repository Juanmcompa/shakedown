// Reparto: el juego. Viajes cortos entre el deposito y los negocios: al llegar, sale el siguiente. Cada viaje queda guardado
// y, en el siguiente, todos los viajes anteriores vuelven a correr a la vez desde su largada: el trafico del pueblo sos vos.
// Si una entrega se hace tarde, se pierde: se ve cuantas entregas se hicieron y la proxima partida empieza de cero.
// La primera vez que te cruzas con una version pasada, el juego se frena y lo explica.
//
// La fisica del auto, la camara, los mandos y el sonido son los de Shakedown (src/). Lo propio esta en esta carpeta: el
// pueblo y los viajes (mapa.js), como se dibuja (dibujo.js), los vehiculos (vehiculos.js), la memoria (memoria.js) y
// las versiones pasadas (fantasmas.js).
import * as THREE from '../vendor/three.module.js';
import { JUEGO } from '../src/config.js';
import { crearAuto } from '../src/vehicle.js';
import { crearCamara } from '../src/camera.js';
import { crearTeclas } from '../src/input.js';
import { crearSonido } from '../src/audio.js';
import { ambiente } from '../src/material.js';
import { crearMapa, TAM, CALLES, SEMAFOROS, colorSemaforo } from './mapa.js';
import { TIPOS, configDeTipo, crearDibujoVehiculo } from './vehiculos.js';
import { crearDibujoPueblo } from './dibujo.js';
import { crearMemoria, crearGrabacion } from './memoria.js';
import { crearFantasmas } from './fantasmas.js';
import { crearPiloto } from './piloto.js';

const $ = (id) => document.getElementById(id);
const QUIETO = { x: 0, y: 0, mano: true };
const LLEGA = 2.8;        // metros del centro del destino para que cuente como llegado
const PARAR = 0.5;        // segundos que hay que quedarse ahi (casi parado) para entregar
const COLOR = '#f2b51c';  // la cabina del que juega
const reloj2 = (s) => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

// --- lo de una sola vez ---
const lienzo = $('lienzo');
let render;
try { render = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true }); } catch (e) { $('nocargo').hidden = false; throw e; }
const liviano = window.matchMedia('(pointer: coarse)').matches;
render.setPixelRatio(Math.min(window.devicePixelRatio, liviano ? 1.5 : 2));
render.shadowMap.enabled = true;
render.outputColorSpace = THREE.SRGBColorSpace;

const escena = new THREE.Scene();
const mapa = crearMapa(), T = mapa.T;
const pueblo = crearDibujoPueblo(escena, mapa, liviano);
const camara = crearCamara(T);
const sonido = crearSonido();
const memoria = crearMemoria();
const fantasmas = crearFantasmas(escena, T);
for (const v of memoria.viajes()) fantasmas.sumar(v);
fantasmas.preparar(memoria.entregas());

// --- el vehiculo de turno: cambia de un viaje a otro segun lo que se lleva ---
let tipo = '', c = null, dibujo = null;
function ponerVehiculo(t) {
  if (t === tipo) return;
  const antes = c;
  tipo = t;
  if (dibujo) dibujo.sacar();
  c = crearAuto(T, configDeTipo(t));
  dibujo = crearDibujoVehiculo(escena, t, COLOR);
  if (antes) c.poner(antes.pos[0], antes.pos[2], Math.atan2(antes.adelante[0], -antes.adelante[2]));
  camara.alejar(t === 'camion' ? 1.3 : 1);
}
ponerVehiculo('furgon');

// --- el estado ---
// fase: 'portada', 'cuenta' (antes de salir), 'viaje', 'explica' (frenado: la explicacion de la primera version pasada),
// 'fin' (se perdio: el resultado),
// 'entrega' (llego: un instante de festejo) o 'tarde' (no llego)
let fase = 'portada', viaje = null, reloj = 0, cuenta = 0, pausa = 0, parado = 0, resto = 0, tiempo = 0, grabacion = null, motivo = '';
let piloto = null;   // (solo las pruebas: maneja solo)
const ent = { x: 0, y: 0, mano: false };

const teclas = crearTeclas((tecla) => {
  sonido.iniciar();
  if (fase === 'explica') { if (tecla === 'Enter' || tecla === 'Space') seguir(); return; }
  if (fase === 'fin') { if (tecla === 'Enter' || tecla === 'Space') otraVez(); else if (tecla === 'Escape') { $('fin').hidden = true; portada(true); } return; }
  if (tecla === 'KeyC') camara.cambiar();
  else if (tecla === 'KeyM') { sonido.alternar(); }
  else if (tecla === 'KeyR' && fase === 'viaje') tarde('rendido');
  else if ((tecla === 'Enter' || tecla === 'Space') && fase === 'portada') salir();
  else if (tecla === 'Escape' && fase !== 'portada' && fase !== 'tarde') portada(true);
});
teclas.ajustar({ flechas: true });   // en el celular: flechas en pantalla (sin inclinar el aparato)
camara.cambiar('aerea');

// --- los viajes ---
// empieza el viaje que toca. enElLugar: el auto ya esta en la puerta (acaba de entregar): sale de donde esta
function empezar(enElLugar) {
  viaje = mapa.viaje(memoria.entregas());
  ponerVehiculo(viaje.tipo);
  dibujo.numero(viaje.k + 1);
  if (!enElLugar) { c.poner(viaje.de.x, viaje.de.z, viaje.de.rumbo); camara.saltar(); }
  else c.poner(c.pos[0], c.pos[2], Math.atan2(c.adelante[0], -c.adelante[2]));
  reloj = 0; parado = 0; resto = 0;
  fase = 'cuenta'; cuenta = enElLugar ? 1.4 : 2;
  fantasmas.preparar(viaje.k);
  fantasmas.reiniciar();
  fantasmas.mover(0, c);
  pueblo.destino(viaje.a);
  grabacion = crearGrabacion();
  pintarViaje();
  if (viaje.culmine) grande('🚚 ¡Hora pico!', 1.8, 'pico');
  else grande(TIPOS[viaje.tipo].nombre + ' · ' + viaje.carga + ' → ' + viaje.a.icono, 1.6);
}

function entregar() {
  memoria.sumar(grabacion.cerrar(viaje.k, true, tipo));
  fantasmas.sumar(memoria.viajes()[memoria.viajes().length - 1]);
  fase = 'entrega'; pausa = 1.6;
  sonido.meta && sonido.meta();
  grande('¡Entregado! ' + viaje.carga, 1.5, 'bien');
  pintarCuenta();
}
// No llego a tiempo (o se rindio): se pierde la partida. Un instante con el cartel y despues el resultado. Los viajes
// se borran: la proxima partida arranca con el pueblo vacio (el record queda).
let recordAntes = memoria.record();
function tarde(m) {
  fase = 'tarde'; pausa = 1.8; motivo = m;
  grande(m === 'rendido' ? '🏳️ Te rendiste' : '⏰ Se hizo tarde', 1.8, 'mal');
}
function mostrarFin() {
  const hechas = memoria.entregas(), record = memoria.record();
  fase = 'fin';
  $('finTitulo').textContent = motivo === 'rendido' ? '🏳️ Te rendiste' : '⏰ Se hizo tarde';
  $('finEntregas').textContent = hechas;
  $('finRecord').textContent = record;
  $('finNuevo').hidden = !(hechas > 0 && hechas > recordAntes);
  recordAntes = record;
  memoria.borrar(); fantasmas.borrar(); fantasmas.preparar(0);
  $('fin').hidden = false;
  pintarCuenta();
}
function otraVez() { $('fin').hidden = true; salir(); }
$('otraVez').addEventListener('click', otraVez);

// --- la explicacion: la primera vez que una version pasada se te cruza, todo se frena ---
let marcado = null;
const anillo = new THREE.Mesh(new THREE.RingGeometry(4.2, 4.9, 40), new THREE.MeshBasicMaterial({ color: '#ffd23a', transparent: true, opacity: 0.95, depthTest: false }));
anillo.rotation.x = -Math.PI / 2; anillo.renderOrder = 8; anillo.visible = false;
escena.add(anillo);
function explicar(f) {
  fase = 'explica'; marcado = f;
  anillo.position.set(f.x, 0.1, f.z); anillo.visible = true;
  // la camara sube y mira desde arriba a las dos: vos y tu version pasada (que no la tape una casa)
  const mx = (f.x + c.pos[0]) / 2, mz = (f.z + c.pos[2]) / 2, lejos = Math.hypot(f.x - c.pos[0], f.z - c.pos[2]);
  vistaFija = new THREE.PerspectiveCamera(45, lienzo.clientWidth / lienzo.clientHeight, 1, 3000);
  vistaFija.position.set(mx, 30 + lejos * 1.2, mz + 10 + lejos * 0.4); vistaFija.lookAt(mx, 0, mz + 4);
  $('explica').hidden = false;
}
function seguir() {
  memoria.visto(true);
  $('explica').hidden = true; anillo.visible = false; marcado = null; vistaFija = null;
  fase = 'viaje';
}
$('explicaSeguir').addEventListener('click', seguir);

// --- la pantalla ---
let tGrande = 0;
function grande(txt, seg, clase = '') { const g = $('grande'); g.textContent = txt; g.className = clase; g.hidden = false; tGrande = seg; }
function pintarCuenta() {
  $('entregas').textContent = memoria.entregas();
  $('record').textContent = memoria.record();
}
function pintarViaje() {
  $('carga').textContent = viaje.carga;
  $('destinoIcono').textContent = viaje.a.icono;
  $('destinoNombre').textContent = viaje.a.deposito ? 'DEPÓSITO ' + (viaje.a.anden + 1) : viaje.a.nombre;
  pintarCuenta();
}
function portada(si) {
  if (si) { fase = 'portada'; }
  $('portada').hidden = !si;
  document.documentElement.classList.toggle('jugando', !si);
  $('portadaRecord').textContent = memoria.record();
  $('portadaEntregas').textContent = memoria.entregas();
  $('pueblonuevo').hidden = !fantasmas.cuantos();
  $('salir').textContent = memoria.entregas() || fantasmas.cuantos() ? 'Seguir repartiendo' : 'Salir a repartir';
}
function salir() { sonido.iniciar(); portada(false); empezar(false); }
$('salir').addEventListener('click', salir);
$('pueblonuevo').addEventListener('click', () => {
  if (!confirm('¿Empezar de cero? Se borran tus entregas (el récord queda).')) return;
  memoria.borrar(); fantasmas.borrar(); portada(true);
});

// el mapita: las calles, vos, el destino y tus versiones pasadas
const mapita = $('mapita'), mg = mapita.getContext('2d');
function pintarMapita() {
  const n = mapita.width, M = TAM + 24, esc = n / M, a = (v) => (v + 12) * esc;
  mg.clearRect(0, 0, n, n);
  mg.fillStyle = 'rgba(20,22,26,.72)'; mg.fillRect(0, 0, n, n);
  mg.strokeStyle = '#6a6c72'; mg.lineCap = 'round';
  for (const s of CALLES) { mg.lineWidth = Math.max(3, 2 * s.m * esc); mg.beginPath(); mg.moveTo(a(s.x1), a(s.z1)); mg.lineTo(a(s.x2), a(s.z2)); mg.stroke(); }
  for (const s of SEMAFOROS) { mg.fillStyle = { verde: '#3fdc6a', amarillo: '#ffc21e', rojo: '#ff3b2a' }[colorSemaforo(s, 'ns', reloj)]; mg.fillRect(a(s.x) - 2, a(s.z) - 2, 4, 4); }
  for (const f of fantasmas.enLaCalle()) { mg.fillStyle = f.entrego ? '#c9d4e0' : '#e08a7a'; mg.fillRect(a(f.x) - 2, a(f.z) - 2, 4, 4); }
  if (viaje) { mg.fillStyle = '#ffd23a'; mg.beginPath(); mg.arc(a(viaje.a.x), a(viaje.a.z), 5, 0, Math.PI * 2); mg.fill(); }
  // vos: un triangulo que apunta hacia donde vas
  const r = Math.atan2(c.adelante[0], -c.adelante[2]), x = a(c.pos[0]), z = a(c.pos[2]);
  mg.fillStyle = '#ffffff'; mg.beginPath();
  mg.moveTo(x + Math.sin(r) * 6, z - Math.cos(r) * 6); mg.lineTo(x + Math.sin(r + 2.5) * 4, z - Math.cos(r + 2.5) * 4); mg.lineTo(x + Math.sin(r - 2.5) * 4, z - Math.cos(r - 2.5) * 4);
  mg.fill();
}

// --- cada cuadro: la logica (sin dibujar: las pruebas la corren sola) ---
function logica(dt) {
  tiempo += dt;
  if (fase === 'explica') return;   // (todo quieto hasta que se lee)
  if (tGrande > 0 && (tGrande -= dt) <= 0) $('grande').hidden = true;
  let manda = QUIETO;
  if (fase === 'cuenta') {
    if ((cuenta -= dt) <= 0) fase = 'viaje';
  } else if (fase === 'viaje') {
    reloj += dt;
    if (piloto) piloto(c, ent, dt); else teclas.leer(ent);
    manda = ent;
  } else if (fase === 'entrega' || fase === 'tarde') {
    if ((pausa -= dt) <= 0) { if (fase === 'entrega') empezar(true); else mostrarFin(); }
  } else if (fase === 'fin') return;
  // las versiones pasadas se mueven con el reloj del viaje (en la cuenta y en las pausas, quietas)
  if (fase === 'viaje') fantasmas.mover(reloj, c);
  resto += dt;
  while (resto >= JUEGO.paso) { c.paso(manda, JUEGO.paso); resto -= JUEGO.paso; }
  if (fase === 'viaje') {
    if (c.impacto > 2) { sonido.toque && sonido.toque(c.contra, c.impacto, 0); camara.sacudir(c.impacto); }
    c.impacto = 0;
    grabacion.muestra(reloj, c);
    // la primera vez que una version pasada anda cerca, se frena todo y se explica
    if (!memoria.visto() && !piloto) {
      const f = fantasmas.enLaCalle().find((g) => g.suelto && Math.hypot(g.x - c.pos[0], g.z - c.pos[2]) < 24);
      if (f) { explicar(f); return; }
    }
    // llego: adentro del circulo y casi parado, un ratito
    const lejos = Math.hypot(viaje.a.x - c.pos[0], viaje.a.z - c.pos[2]);
    parado = lejos < LLEGA && Math.abs(c.velocidad) < 2.5 ? parado + dt : 0;
    if (parado >= PARAR) entregar();
    else if (reloj >= viaje.limite) tarde('reloj');
  }
}

// --- y lo que se ve ---
function medir() {
  const w = lienzo.clientWidth, h = lienzo.clientHeight;
  render.setSize(w, h, false);
  camara.pantalla(w, h);
}
window.addEventListener('resize', medir);
medir();

let antes = performance.now();
function cuadro(ahora) {
  const dt = Math.min(0.05, (ahora - antes) / 1000);
  antes = ahora;
  if (fase !== 'portada') logica(dt);
  else { tiempo += dt; fantasmas.mover(tiempo % 120, c); }   // en la portada, el pueblo se mueve de fondo
  dibujar(dt);
  requestAnimationFrame(cuadro);
}
function dibujar(dt) {
  dibujo.actualizar(c, dt);
  if (fase !== 'explica') camara.seguir(c, dt);
  ambiente.tiempo.value = tiempo;
  if (viaje) pueblo.actualizar(tiempo, reloj, c, viaje.a);
  else pueblo.actualizar(tiempo, tiempo, c, mapa.destinos[0]);
  if (marcado) anillo.material.opacity = 0.6 + 0.35 * Math.sin(tiempo * 6);
  sonido.actualizar(c, 0, fase === 'explica' ? 0 : dt);
  if (viaje) {
    const queda = viaje.limite - reloj;
    $('reloj').textContent = reloj2(queda);
    $('reloj').classList.toggle('apuro', fase === 'viaje' && queda < 10);
    $('distancia').textContent = Math.round(Math.hypot(viaje.a.x - c.pos[0], viaje.a.z - c.pos[2])) + ' m';
  }
  pintarMapita();
  render.render(escena, vistaFija || camara.cam);
}
let vistaFija = null;   // (solo las pruebas: una camara quieta para mirar el pueblo de arriba)

// --- arranque ---
c.poner(mapa.destinos[2].x, mapa.destinos[2].z, mapa.destinos[2].rumbo);
portada(true);
pintarCuenta();
document.documentElement.classList.remove('cargando');
requestAnimationFrame(cuadro);

// --- para las pruebas ---
window.reparto = {
  mapa, auto: () => c, memoria, fantasmas,
  viaje: (k) => mapa.viaje(k),
  estado: () => ({ fase, k: viaje && viaje.k, tipo, reloj: +reloj.toFixed(2), entregas: memoria.entregas(), record: memoria.record(), pasados: fantasmas.cuantos(), enCalle: fantasmas.enCalle(), limite: viaje && viaje.limite, x: +c.pos[0].toFixed(1), z: +c.pos[2].toFixed(1), v: +c.velocidad.toFixed(1), motivo }),
  salir, seguir, otraVez,
  // maneja solo hasta el destino del viaje que toca (si esta en la largada, sale por donde se sale: el playon del deposito)
  pilotear: (si = true) => {
    if (!si || !viaje) { piloto = null; return; }
    const enLargada = Math.hypot(c.pos[0] - viaje.de.x, c.pos[2] - viaje.de.z) < 6;
    piloto = crearPiloto(mapa.red, enLargada ? viaje.de : { x: c.pos[0], z: c.pos[2] }, viaje.a);
  },
  // corre el juego "seg" segundos sin esperar (de a 1/30), con el piloto si esta prendido (y lo rearma en cada viaje nuevo)
  avanzar: (seg) => {
    let k = viaje && viaje.k, f = fase;
    for (let i = 0; i < seg * 30; i++) {
      logica(1 / 30);
      if (piloto && (viaje.k !== k || (f !== 'viaje' && fase === 'viaje'))) { k = viaje.k; window.reparto.pilotear(); }
      f = fase;
    }
    dibujar(1 / 30);
    return window.reparto.estado();
  },
  dibujar: () => dibujar(1 / 30),
  camara: (id) => camara.cambiar(id),
  // mira el pueblo desde (x, alto, z) hacia el punto (hx, 0, hz); sin nada, vuelve la camara de siempre
  vista: (x, alto, z, hx = x, hz = z) => {
    if (x === undefined) { vistaFija = null; return; }
    vistaFija = new THREE.PerspectiveCamera(45, lienzo.clientWidth / lienzo.clientHeight, 1, 3000);
    vistaFija.position.set(x, alto, z); vistaFija.lookAt(hx, 0, hz);
  },
};

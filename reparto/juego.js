// Reparto: el juego. Viajes cortos entre el deposito y los negocios: al llegar, sale el siguiente. Cada viaje queda guardado
// y, en el siguiente, todos los viajes anteriores vuelven a correr a la vez desde su largada: el trafico del pueblo sos vos.
// Si una entrega se hace tarde, se pierde: se ve cuantas entregas se hicieron y la proxima partida empieza de cero.
// La primera vez que te cruzas con una version pasada, el juego se frena y lo explica.
//
// La fisica del auto, la camara, los mandos y el sonido son los de Shakedown (src/). Lo propio esta en esta carpeta: el
// pueblo y los viajes (mapa.js), como se dibuja (dibujo.js), los vehiculos (vehiculos.js), la memoria (memoria.js) y
// las versiones pasadas (fantasmas.js).
import * as THREE from '../vendor/three.module.js';
import { JUEGO, FIRMA } from '../src/config.js';
import { crearAuto } from '../src/vehicle.js';
import { crearCamara } from '../src/camera.js';
import { crearTeclas } from '../src/input.js';
import { crearSonido } from '../src/audio.js';
import { ambiente } from '../src/material.js';
import { crearMapa, TAM, XMAX, ZMAX, CALLES, ROTONDAS, SEMAFOROS, ABRE, TAXIS, zonasAbiertas, colorSemaforo } from './mapa.js';
import { TIPOS, configDeTipo, crearDibujoVehiculo } from './vehiculos.js';
import { crearDibujoPueblo } from './dibujo.js';
import { crearMemoria, crearGrabacion } from './memoria.js';
import { crearFantasmas } from './fantasmas.js';
import { crearPiloto } from './piloto.js';
import { crearRemolque } from './remolque.js';

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
let tipo = '', c = null, dibujo = null, remolque = null;
// pone el vehiculo en un lugar (y el remolque, si lleva, derecho atras)
function ubicar(x, z, rumbo) { c.poner(x, z, rumbo); if (remolque) remolque.poner(c); }
function ponerVehiculo(t) {
  if (t === tipo) return;
  const antes = c;
  tipo = t;
  if (dibujo) dibujo.sacar();
  c = crearAuto(T, configDeTipo(t));
  dibujo = crearDibujoVehiculo(escena, t, COLOR);
  remolque = TIPOS[t].remolque ? crearRemolque(TIPOS[t].remolque, configDeTipo(t).centro || 0) : null;
  if (antes) ubicar(antes.pos[0], antes.pos[2], Math.atan2(antes.adelante[0], -antes.adelante[2]));
  camara.alejar({ camion: 1.3, semi: 1.7, colectivo: 1.5 }[t] || 1);
}
ponerVehiculo('furgon');

// --- el estado ---
// fase: 'portada', 'cuenta' (antes de salir), 'viaje', 'explica' (frenado: la explicacion de la primera version pasada),
// 'fin' (se perdio: el resultado),
// 'entrega' (llego: un instante de festejo) o 'tarde' (no llego)
let fase = 'portada', viaje = null, reloj = 0, cuenta = 0, pausa = 0, parado = 0, resto = 0, tiempo = 0, grabacion = null, motivo = '';
let piloto = null;   // (solo las pruebas: maneja solo)
let forzado = null;  // (solo las pruebas: el viaje que se juega, en vez del que toca)
let trabas = 0, roces = 0;   // (solo las pruebas: cuantos pasos el remolque quedo trabado o rozando)
const ent = { x: 0, y: 0, mano: false };

const teclas = crearTeclas((tecla) => {
  sonido.iniciar();
  if (pausado) { if (tecla === 'KeyP' || tecla === 'Escape' || tecla === 'Enter') pausar(false); return; }
  if (tecla === 'KeyP' && fase !== 'portada' && fase !== 'fin') { pausar(true); return; }
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
  viaje = mapa.viaje(forzado !== null ? forzado : memoria.entregas());
  hechas = 0; esperando = 0;
  abrirZonas(viaje.k);
  ponerVehiculo(viaje.tipo);
  // (en el deposito siempre se sale del porton, de trompa al playon; y al empezar con los colectivos o los taxis, se arranca
  // en la terminal o en la base)
  if (!enElLugar || viaje.de.deposito || viaje.salto) { ubicar(viaje.de.x, viaje.de.z, viaje.de.rumbo); if (!enElLugar || viaje.salto) camara.saltar(); }
  else ubicar(c.pos[0], c.pos[2], Math.atan2(c.adelante[0], -c.adelante[2]));
  reloj = 0; parado = 0; resto = 0;
  fase = 'cuenta'; cuenta = enElLugar ? 1.4 : 2;
  fantasmas.preparar(viaje.k);
  fantasmas.reiniciar();
  fantasmas.mover(0, c);
  pueblo.destino(objetivo());
  grabacion = crearGrabacion();
  pintarViaje();
  $('culata').hidden = !viaje.a.deposito;
  avisoCulata = false; $('avisoCulata').hidden = true;
  // al subir de nivel (se abre una zona, o cambia lo que se hace), un cartel grande
  if (viaje.k === ABRE[2]) grande('🏭 ¡Depósito 2! Se abrieron calles', 2.6, 'pico');
  else if (viaje.k === ABRE[3]) grande('🚌 ¡Empresa de colectivos!', 2.6, 'pico');
  else if (viaje.k === TAXIS) grande('🚕 ¡Radio taxi!', 2.6, 'pico');
  else if (viaje.tipo === 'colectivo') grande('🚌 ' + viaje.paradas.length + ' paradas y a la terminal', 1.8);
  else if (viaje.tipo === 'taxi') grande('🙋 Buscá al pasajero', 1.6);
  else if (viaje.culmine) grande(viaje.tipo === 'semi' ? '🚛 ¡Hora pico! En semi' : '🚚 ¡Hora pico!', 1.8, 'pico');
  else if (viaje.a.deposito) grande('🏭 Al depósito: de culata', 1.8);
  else grande(TIPOS[viaje.tipo].nombre + ' · ' + viaje.carga + ' → ' + viaje.a.icono, 1.6);
}

// --- que el juego esta en desarrollo y quien lo hizo (lo mismo que Shakedown: FIRMA, en src/config.js) ---
const enDesarrollo = [FIRMA.etapa, FIRMA.aviso].filter(Boolean).join(' · ').replace(/^(.)/, '🚧 $1');
for (const sello of document.querySelectorAll('.sello')) { sello.querySelector('b').textContent = FIRMA.etapa; sello.querySelector('span').textContent = FIRMA.aviso; sello.hidden = sello.hidden || !enDesarrollo; }
$('firmaAutor').textContent = FIRMA.autor;
$('firma').hidden = !FIRMA.autor;
// al largar una partida, el sello aparece un momento (como el cartel de la largada de Shakedown)
let tSello = 0;
function mostrarSello() { if (!enDesarrollo) return; $('selloLargada').hidden = false; tSello = 2.6; }

// --- las zonas y las paradas ---
// abre las vallas de las zonas que tocan para el viaje k (las demas quedan cerradas: al perder, vuelve al pueblo chico)
function abrirZonas(k) { const n = zonasAbiertas(k); mapa.T.abrir(n); pueblo.abrir(n); }
// En los colectivos y los taxis hay que parar antes de llegar: en cada parada, en orden (o a buscar al pasajero).
// hechas: cuantas paradas ya se hicieron en este viaje. objetivo(): adonde hay que ir ahora.
let hechas = 0, esperando = 0;
const objetivo = () => (viaje && hechas < viaje.paradas.length ? viaje.paradas[hechas] : viaje ? viaje.a : null);
const PARA = 0.8;   // segundos casi quieto en la parada para que suban
function revisarParada(dt) {
  const p = objetivo();
  const ahi = Math.hypot(p.x - c.pos[0], p.z - c.pos[2]) < (viaje.tipo === 'colectivo' ? 3.4 : LLEGA) && Math.abs(c.velocidad) < 1.5;
  esperando = ahi ? esperando + dt : 0;
  if (esperando < PARA) return;
  esperando = 0; hechas++;
  grande(viaje.tipo === 'taxi' ? '🙋 ¡Subió!' : '👥 ¡Subieron!', 1.2, 'bien');
  pueblo.destino(objetivo());
  pintarViaje();
}

// --- el nivel: en que etapa vas y cuanto falta para la siguiente ---
//   🏭 Depósito 1 · 13/30   🏭 Depósito 2 · 7/20   🚌 Colectivos · 3/20   🚕 Taxis · 5
function nivel(e) {
  if (e < ABRE[2]) return '🏭 Depósito 1 · ' + e + '/' + ABRE[2];
  if (e < ABRE[3]) return '🏭 Depósito 2 · ' + (e - ABRE[2]) + '/' + (ABRE[3] - ABRE[2]);
  if (e < TAXIS) return '🚌 Colectivos · ' + (e - ABRE[3]) + '/' + (TAXIS - ABRE[3]);
  return '🚕 Taxis · ' + (e - TAXIS);
}

// --- llegar ---
// La cola del vehiculo (o del remolque) y hacia donde apunta: para estacionar de culata.
function cola() {
  if (remolque) return remolque.cola();
  const f = c.adelante, l = Math.hypot(f[0], f[2]) || 1, fx = f[0] / l, fz = f[2] / l, largo = TIPOS[tipo].largo;
  return { x: c.pos[0] - fx * largo, z: c.pos[2] - fz * largo, fx, fz };
}
// En un negocio: el centro adentro del circulo de la bahia. En el deposito: de culata, con la cola contra el porton y la
// trompa hacia el playon (mirando hacia +z, con 35 grados de margen).
function llego() {
  if (hechas < viaje.paradas.length) return false;   // (falta pasar por alguna parada)
  const d = viaje.a;
  if (!d.deposito) return Math.hypot(d.x - c.pos[0], d.z - c.pos[2]) < LLEGA;
  const q = cola();
  return Math.hypot(q.x - d.puerta.x, q.z - d.puerta.z) < 2.2 && q.fz > 0.82;
}
// El aviso de "de culata": aparece cuando el vehiculo esta cerca del porton del deposito y no mira hacia el playon
// (la trompa tiene que quedar para afuera). Casi todos llegan de trompa y no entienden por que no cuenta.
let avisoCulata = false;
function avisarCulata() {
  const d = viaje.a;
  let si = false;
  if (d.deposito) {
    const q = cola(), cerca = Math.hypot(c.pos[0] - d.puerta.x, c.pos[2] - d.puerta.z) < 16 || Math.hypot(q.x - d.puerta.x, q.z - d.puerta.z) < 16;
    si = cerca && q.fz < 0.82;
  }
  if (si !== avisoCulata) { avisoCulata = si; $('avisoCulata').hidden = !si; }
}
function lejosDelDestino() {
  const d = objetivo();
  if (!d.deposito) return Math.hypot(d.x - c.pos[0], d.z - c.pos[2]);
  const q = cola();
  return Math.hypot(q.x - d.puerta.x, q.z - d.puerta.z);
}

function entregar() {
  avisoCulata = false; $('avisoCulata').hidden = true;
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
  avisoCulata = false; $('avisoCulata').hidden = true;
  fase = 'tarde'; pausa = 1.8; motivo = m;
  grande(m === 'rendido' ? '🏳️ Te rendiste' : '⏰ Se hizo tarde', 1.8, 'mal');
}
function mostrarFin() {
  const hechas = memoria.entregas(), record = memoria.record();
  fase = 'fin'; hechasFin = hechas; $('finCompartido').textContent = '';
  $('finTitulo').textContent = motivo === 'rendido' ? '🏳️ Te rendiste' : '⏰ Se hizo tarde';
  $('finEntregas').textContent = hechas;
  $('finRecord').textContent = record;
  $('finNuevo').hidden = !(hechas > 0 && hechas > recordAntes);
  recordAntes = record;
  memoria.borrar(); fantasmas.borrar(); fantasmas.preparar(0); abrirZonas(0);
  $('fin').hidden = false;
  pintarCuenta();
}
function otraVez() { $('fin').hidden = true; salir(); }

// --- compartir el resultado (como en Shakedown: en el celular abre el menu de compartir; en la compu lo copia) ---
//   Probá F for Traffic 📦 Hice 12 entregas
//   📦📦📦📦📦📦📦📦📦📦📦📦
//   https://juanmcompa.github.io/shakedown/reparto/
//   🚧 Early Access · App en desarrollo     (mientras el juego este en desarrollo: lo dice FIRMA, en src/config.js)
let hechasFin = 0;
function textoParaCompartir() {
  const n = hechasFin, cajas = '📦'.repeat(Math.min(n, 20)) + (n > 20 ? ' +' + (n - 20) : '');
  const lineas = ['Probá F for Traffic 📦 Hice ' + n + (n === 1 ? ' entrega' : ' entregas')];
  if (cajas) lineas.push(cajas);
  lineas.push(location.origin + location.pathname);
  if (enDesarrollo) lineas.push(enDesarrollo);
  return lineas.join('\n');
}
async function compartir() {
  const salida = $('finCompartido'), texto = textoParaCompartir();
  try {
    if (navigator.share && window.matchMedia('(pointer: coarse)').matches) { await navigator.share({ text: texto }); return; }
    await navigator.clipboard.writeText(texto);
    salida.textContent = 'Copiado. Pegalo en el grupo.';
  } catch (x) {
    if (x && x.name === 'AbortError') return;
    salida.textContent = 'No pude copiarlo. Copialo de acá: ' + texto.replace(/\n/g, ' ');
  }
}
$('finCompartir').addEventListener('click', compartir);
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
  $('nivel').textContent = nivel(memoria.entregas());
  $('entregas').textContent = memoria.entregas();
  $('record').textContent = memoria.record();
}
function pintarViaje() {
  const d = objetivo(), n = viaje.paradas.length, falta = hechas < n;
  $('carga').textContent = viaje.carga;
  $('destinoIcono').textContent = falta && viaje.tipo === 'taxi' ? '🙋' : d.icono;
  $('destinoNombre').textContent = d.deposito ? 'DEPÓSITO ' + (d.dep.n + 1) + ' · ' + (d.anden + 1)
    : falta && viaje.tipo === 'colectivo' ? 'PARADA ' + (hechas + 1) + '/' + n : falta ? 'BUSCAR EN ' + d.nombre : d.nombre;
  pintarCuenta();
}
function portada(si) {
  if (si) { fase = 'portada'; }
  $('portada').hidden = !si;
  document.documentElement.classList.toggle('jugando', !si);
  $('portadaRecord').textContent = memoria.record();
  $('portadaEntregas').textContent = memoria.entregas();
  $('portadaNivel').textContent = nivel(memoria.entregas());
  $('pueblonuevo').hidden = !fantasmas.cuantos();
  $('salir').textContent = memoria.entregas() || fantasmas.cuantos() ? 'Seguir repartiendo' : 'Salir a repartir';
}
function salir() { sonido.iniciar(); portada(false); empezar(false); if (memoria.entregas() === 0) mostrarSello(); }
$('salir').addEventListener('click', salir);
$('pueblonuevo').addEventListener('click', () => {
  if (!confirm('¿Empezar de cero? Se borran tus entregas (el récord queda).')) return;
  memoria.borrar(); fantasmas.borrar(); abrirZonas(0); portada(true);
});

// el mapita: las calles, vos, el destino y tus versiones pasadas
const mapita = $('mapita'), mg = mapita.getContext('2d');
// El trafico de ahora, como en los mapas del celular: cada cuadra (de esquina a esquina) se pinta segun cuantas versiones
// pasadas tiene encima en este momento, por cada 100 m: verde (libre), amarillo, naranja, rojo y rojo oscuro (trabada).
// Las rotondas, igual (por su anillo). Se recalcula unas cuantas veces por segundo.
const cuadras = [];
for (const nd of mapa.red.nodos) for (const v of nd.vecinos) if (nd.id < v.n.id) cuadras.push({ x1: nd.x, z1: nd.z, x2: v.n.x, z2: v.n.z, m: v.calle.m, largo: v.largo, hay: 0 });
const anillos = ROTONDAS.map((q) => ({ q, hay: 0 }));
const COLOR_TRAFICO = (porCien) => (porCien < 0.6 ? '#3fbf5f' : porCien < 1.5 ? '#f2c94c' : porCien < 3 ? '#f2994a' : porCien < 5 ? '#e04a3a' : '#8a1c1c');
let tTrafico = 0;
function medirTrafico() {
  for (const q of cuadras) q.hay = 0;
  for (const a of anillos) a.hay = 0;
  for (const f of fantasmas.enLaCalle()) {
    const an = anillos.find((a) => Math.hypot(f.x - a.q.x, f.z - a.q.z) < a.q.ro + 2);
    if (an) { an.hay++; continue; }
    let mejor = null, dm = 1e9;
    for (const q of cuadras) {
      const dx = q.x2 - q.x1, dz = q.z2 - q.z1, t = Math.max(0, Math.min(1, ((f.x - q.x1) * dx + (f.z - q.z1) * dz) / (dx * dx + dz * dz)));
      const d = Math.hypot(f.x - q.x1 - dx * t, f.z - q.z1 - dz * t);
      if (d < dm) { dm = d; mejor = q; }
    }
    if (mejor && dm < mejor.m + 3) mejor.hay++;   // (los que estan adentro de un deposito o estacionados en una bahia no cuentan)
  }
}

// Muestra solo la parte del pueblo que esta abierta: al principio el pueblo chico, y se agranda al abrir cada zona.
// Vos sos la flecha verde (grande, con borde: que se encuentre enseguida entre el trafico).
function pintarMapita() {
  const abiertas = zonasAbiertas(viaje ? viaje.k : memoria.entregas());
  const ancho = (abiertas >= 2 ? XMAX : TAM) + 24, alto = (abiertas >= 3 ? ZMAX : TAM) + 24;
  const n = mapita.width, esc = n / Math.max(ancho, alto);
  // (centrado: si el pueblo abierto es mas ancho que alto, queda una franja arriba y abajo)
  const ox = (n - ancho * esc) / 2, oz = (n - alto * esc) / 2, ax = (v) => ox + (v + 12) * esc, az = (v) => oz + (v + 12) * esc;
  mg.clearRect(0, 0, n, n);
  mg.fillStyle = 'rgba(20,22,26,.72)'; mg.fillRect(0, 0, n, n);
  mg.save(); mg.beginPath(); mg.rect(ox, oz, ancho * esc, alto * esc); mg.clip();
  mg.strokeStyle = '#6a6c72'; mg.lineCap = 'round';
  for (const s of CALLES) { mg.lineWidth = Math.max(3, 2 * s.m * esc); mg.beginPath(); mg.moveTo(ax(s.x1), az(s.z1)); mg.lineTo(ax(s.x2), az(s.z2)); mg.stroke(); }
  // el trafico de ahora, encima de cada calle (mas finito que la calle, como una linea de color)
  if ((tTrafico -= 1) <= 0) { medirTrafico(); tTrafico = 8; }
  mg.lineCap = 'butt';
  for (const q of cuadras) {
    mg.strokeStyle = COLOR_TRAFICO(q.hay / Math.max(q.largo, 20) * 100); mg.lineWidth = Math.max(2, q.m * esc * 1.1);
    mg.beginPath(); mg.moveTo(ax(q.x1), az(q.z1)); mg.lineTo(ax(q.x2), az(q.z2)); mg.stroke();
  }
  for (const a of anillos) {
    mg.strokeStyle = COLOR_TRAFICO(a.hay / (2 * Math.PI * (a.q.ri + a.q.ro) / 2) * 100); mg.lineWidth = Math.max(2, (a.q.ro - a.q.ri) * esc * 0.6);
    mg.beginPath(); mg.arc(ax(a.q.x), az(a.q.z), (a.q.ri + a.q.ro) / 2 * esc, 0, Math.PI * 2); mg.stroke();
  }
  mg.lineCap = 'round';
  for (const s of SEMAFOROS) { mg.fillStyle = { verde: '#3fdc6a', amarillo: '#ffc21e', rojo: '#ff3b2a' }[colorSemaforo(s, 'ns', reloj)]; mg.fillRect(ax(s.x) - 2, az(s.z) - 2, 4, 4); }
  if (viaje) { const d = objetivo(); mg.fillStyle = '#ffd23a'; mg.beginPath(); mg.arc(ax(d.x), az(d.z), 5, 0, Math.PI * 2); mg.fill(); }
  mg.restore();
  // vos: una flecha verde que apunta hacia donde vas
  const r = Math.atan2(c.adelante[0], -c.adelante[2]), x = ax(c.pos[0]), z = az(c.pos[2]), L = 14;
  const p = (ang, d) => [x + Math.sin(r + ang) * d, z - Math.cos(r + ang) * d];
  mg.beginPath();
  for (const [ang, d] of [[0, L], [2.45, L * 0.75], [Math.PI, L * 0.3], [-2.45, L * 0.75]]) { const [px, pz] = p(ang, d); mg.lineTo(px, pz); }
  mg.closePath();
  mg.fillStyle = '#3fdc6a'; mg.fill();
  mg.lineWidth = 2; mg.strokeStyle = '#0c2a14'; mg.stroke();
}

// --- la pausa: el boton del medio de los controles (o la P). Todo se queda quieto hasta seguir. ---
let pausado = false;
function pausar(si) {
  pausado = si;
  $('pausaMenu').hidden = !si;
  for (const tecla of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']) teclas.abajo.delete(tecla);   // (que no quede un pedal apretado)
}
$('botonPausa').addEventListener('click', () => { if (fase !== 'portada' && fase !== 'fin') pausar(true); });
$('seguirPausa').addEventListener('click', () => pausar(false));
$('salirPausa').addEventListener('click', () => { pausar(false); portada(true); });

// --- cada cuadro: la logica (sin dibujar: las pruebas la corren sola) ---
function logica(dt) {
  if (pausado) return;   // (en pausa, todo quieto: el reloj del viaje, las versiones pasadas y la camioneta)
  tiempo += dt;
  if (fase === 'explica') return;   // (todo quieto hasta que se lee)
  if (tGrande > 0 && (tGrande -= dt) <= 0) $('grande').hidden = true;
  if (tSello > 0 && (tSello -= dt) <= 0) $('selloLargada').hidden = true;
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
  while (resto >= JUEGO.paso) {
    // con remolque: si el remolque se mete en algo, el tractor no puede hacer ese paso
    if (remolque) remolque.guardar(c);
    c.paso(manda, JUEGO.paso);
    if (remolque) {
      remolque.seguir(c);
      const r = remolque.choca(T);
      if (r === 2) { remolque.volver(c); trabas++; }
      else if (r === 1) { roces++; c.vel[0] *= 0.996; c.vel[2] *= 0.996; }   // (rozando la pared, frena un poco)
    }
    resto -= JUEGO.paso;
  }
  if (fase === 'viaje') {
    if (c.impacto > 2) { sonido.toque && sonido.toque(c.contra, c.impacto, 0); camara.sacudir(c.impacto); }
    c.impacto = 0;
    grabacion.muestra(reloj, c, remolque ? remolque.rumbo() : undefined);
    // la primera vez que una version pasada anda cerca, se frena todo y se explica
    if (!memoria.visto() && !piloto) {
      const f = fantasmas.enLaCalle().find((g) => g.suelto && Math.hypot(g.x - c.pos[0], g.z - c.pos[2]) < 24);
      if (f) { explicar(f); return; }
    }
    // llego: adentro del circulo y casi parado, un ratito
    if (hechas < viaje.paradas.length) revisarParada(dt);
    parado = llego() && Math.abs(c.velocidad) < (viaje.a.deposito ? 1.5 : 2.5) ? parado + dt : 0;
    // en el deposito, si te acercas al porton de trompa (o de costado), un aviso grande: hay que entrar de culata
    avisarCulata();
    if (parado >= PARAR) entregar();
    else if (reloj >= viaje.limite) tarde('reloj');
  }
}

// --- y lo que se ve ---
function medir() {
  const w = lienzo.clientWidth, h = lienzo.clientHeight;
  render.setSize(w, h, false);
  camara.pantalla(w, h);
  // Con el celular parado, la camioneta va siempre en la franja de abajo (entre el 62 % y el 86 % de la pantalla, de arriba
  // hacia abajo): arriba quedan el reloj, el pedido y el mapita, abajo los controles, y en el medio se ve la calle de adelante.
  if (h > w * 1.2) camara.encuadrar(0.14, 0.62, 0.22);
  else camara.encuadrar(0.16, 0.2, 0.22);
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
  dibujo.actualizar(c, dt, remolque);
  if (fase !== 'explica') camara.seguir(c, dt);
  ambiente.tiempo.value = tiempo;
  if (viaje) pueblo.actualizar(tiempo, reloj, c, objetivo());
  else pueblo.actualizar(tiempo, tiempo, c, mapa.destinos[0]);
  if (marcado) anillo.material.opacity = 0.6 + 0.35 * Math.sin(tiempo * 6);
  sonido.actualizar(c, 0, fase === 'explica' ? 0 : dt);
  if (viaje) {
    const queda = viaje.limite - reloj;
    $('reloj').textContent = reloj2(queda);
    $('reloj').classList.toggle('apuro', fase === 'viaje' && queda < 10);
    $('distancia').textContent = Math.round(lejosDelDestino()) + ' m';
  }
  pintarMapita();
  render.render(escena, vistaFija || camara.cam);
}
let vistaFija = null;   // (solo las pruebas: una camara quieta para mirar el pueblo de arriba)

// --- arranque ---
abrirZonas(memoria.entregas());
ubicar(mapa.destinos[0].x, mapa.destinos[0].z, mapa.destinos[0].rumbo);
portada(true);
pintarCuenta();
document.documentElement.classList.remove('cargando');
requestAnimationFrame(cuadro);

// --- para las pruebas ---
window.reparto = {
  mapa, auto: () => c, memoria, fantasmas, remolque: () => remolque, ubicar, llego,
  viaje: (k) => mapa.viaje(k),
  estado: () => ({ hechas, paradas: viaje ? viaje.paradas.length : 0, nivel: nivel(memoria.entregas()), trabas, roces, avisoCulata, fase, k: viaje && viaje.k, tipo, doblado: remolque ? Math.round(remolque.doblado(c) * 180 / Math.PI) : null, reloj: +reloj.toFixed(2), entregas: memoria.entregas(), record: memoria.record(), pasados: fantasmas.cuantos(), enCalle: fantasmas.enCalle(), limite: viaje && viaje.limite, x: +c.pos[0].toFixed(1), z: +c.pos[2].toFixed(1), v: +c.velocidad.toFixed(1), motivo }),
  salir, seguir, otraVez, textoParaCompartir,
  // maneja con estos mandos (volante x, acelerador y) hasta que se apague (sin nada)
  mandar: (x, y) => { piloto = x === undefined ? null : (cc, e) => { e.x = x; e.y = y; e.mano = false; }; },
  // juega el viaje k (sin importar cuantas entregas van)
  jugarViaje: (k) => { forzado = k; $('portada').hidden = true; $('fin').hidden = true; document.documentElement.classList.add('jugando'); empezar(false); },
  // maneja solo hasta el destino del viaje que toca (si esta en la largada, sale por donde se sale: el playon del deposito)
  pilotear: (si = true) => {
    if (!si || !viaje) { piloto = null; return; }
    const enLargada = Math.hypot(c.pos[0] - viaje.de.x, c.pos[2] - viaje.de.z) < 6;
    piloto = crearPiloto(mapa.red, enLargada ? viaje.de : { x: c.pos[0], z: c.pos[2] }, viaje.a, () => cola(), viaje.paradas.slice(hechas), ['camion', 'semi', 'colectivo'].includes(tipo));
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

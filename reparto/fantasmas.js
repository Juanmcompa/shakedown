// Reparto: tus versiones pasadas. Cada viaje guardado vuelve a correr desde su largada cada vez que arranca un viaje nuevo:
// todos a la vez, con el reloj del viaje. Son solidos (el auto choca contra ellos como contra una pared que se mueve, y
// ellos no se corren: ya pasaron), pero no hacen otra cosa que frenarte.
//
// Cuando un viaje viejo termina: si entrego, el auto queda unos segundos estacionado en la puerta y desaparece; si no
// llego a tiempo, desaparece ahi nomas.
import * as THREE from '../vendor/three.module.js';
import { armarAuto, pinturaOtra } from '../src/autos.js';
import { configDe } from '../src/partes.js';
import { MUESTRA } from './memoria.js';

const COLORES = ['#6f8fa3', '#b5503a', '#4f7a55', '#8a6f9a', '#2f6fa8', '#c9c2b0', '#7a2f2a', '#3f8a55', '#d8a48c', '#55585e', '#a9c3cc', '#8a5a44'];
const QUEDA = 3;          // segundos que queda estacionado despues de entregar
const ANCHO = 0.88, LARGO = 1.95;   // medio ancho y medio largo del auto, para chocarlo

export function crearFantasmas(escena, T) {
  const C = configDe('vitarita');
  const alto = C.resorteLargo + C.radio - C.masa * 9.81 / 4 / C.resorte - C.anclaje;   // a que altura va su centro, apoyado
  const lista = [];   // uno por viaje guardado: { v, grupo, cartel, choque, suelto }
  const ARRIBA = new THREE.Vector3(0, 1, 0);

  function cartelDe(texto, fallido) {
    const lienzo = document.createElement('canvas');
    lienzo.width = 128; lienzo.height = 48;
    const x = lienzo.getContext('2d');
    x.font = '700 30px "Atkinson Hyperlegible", "Segoe UI", sans-serif';
    const w = Math.min(124, x.measureText(texto).width + 20);
    x.fillStyle = fallido ? 'rgba(90, 20, 15, .8)' : 'rgba(0, 0, 0, .7)';
    x.fillRect(64 - w / 2, 4, w, 40);
    x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(texto, 64, 25, 118);
    const tex = new THREE.CanvasTexture(lienzo);
    tex.colorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
    s.scale.set(3.2, 1.2, 1); s.position.y = 2.9; s.renderOrder = 5;
    return s;
  }

  // suma un viaje guardado (n: su numero en la lista, para el color)
  function sumar(v) {
    const n = lista.length, { grupo } = armarAuto(C, pinturaOtra(COLORES[n % COLORES.length]));
    grupo.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    const cartel = cartelDe(String(v.k + 1), !v.entrego);
    grupo.add(cartel);
    grupo.visible = false;
    escena.add(grupo);
    lista.push({ v, grupo, cartel, choque: { x: 0, z: 0, hx: ANCHO, hz: LARGO, ux: 1, uz: 0, y: 0, duro: 1, clase: 'auto', tipo: 'auto', roto: false }, suelto: false });
  }

  function borrar() {
    for (const f of lista) { escena.remove(f.grupo); f.cartel.material.map.dispose(); f.cartel.material.dispose(); }
    lista.length = 0;
  }

  // donde esta un viaje en el segundo t (curva suave entre muestras). Devuelve false si ya no esta en la calle.
  const P = { x: 0, z: 0, rumbo: 0 };
  function pose(v, t) {
    const n = v.xs.length;
    if (n < 2) return false;
    const fin = (n - 1) * MUESTRA;
    if (t > fin + (v.entrego ? QUEDA : 0)) return false;
    const f = Math.min(n - 1.0001, Math.max(0, t / MUESTRA)), k = Math.floor(f), u = f - k;
    const a = Math.max(0, k - 1), c = Math.min(n - 1, k + 1), d = Math.min(n - 1, k + 2);
    const cr = (A, i0, i1, i2, i3) => { const p0 = A[i0], p1 = A[i1], p2 = A[i2], p3 = A[i3]; return 0.5 * (2 * p1 + (p2 - p0) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (3 * p1 - p0 - 3 * p2 + p3) * u * u * u); };
    P.x = cr(v.xs, a, k, c, d); P.z = cr(v.zs, a, k, c, d);
    let g = v.rs[c] - v.rs[k];
    g = Math.atan2(Math.sin(g), Math.cos(g));
    P.rumbo = v.rs[k] + g * u;
    return true;
  }

  const activos = [];
  // Una vez por cuadro (y antes de mover el auto): pone a cada version pasada donde estaba en el segundo t de su viaje y
  // le pasa al terreno las que se pueden chocar. yo: el auto del que juega. Una version pasada no se choca hasta que se
  // separo una vez del auto (al reintentar un viaje, el intento anterior larga del mismo lugar que vos).
  function mover(t, yo) {
    activos.length = 0;
    for (const f of lista) {
      if (!pose(f.v, t)) { f.grupo.visible = false; continue; }
      f.grupo.visible = true;
      f.grupo.position.set(P.x, alto, P.z);
      f.grupo.quaternion.setFromAxisAngle(ARRIBA, -P.rumbo);
      const o = f.choque;
      o.x = P.x; o.z = P.z; o.ux = Math.cos(P.rumbo); o.uz = Math.sin(P.rumbo);
      if (!f.suelto && Math.hypot(P.x - yo.pos[0], P.z - yo.pos[2]) > 7) f.suelto = true;
      if (f.suelto) activos.push(o);
    }
    T.ponerMoviles(activos);
    return activos.length;
  }
  // al empezar un viaje, todos vuelven a su largada (y ninguno se choca hasta separarse)
  function reiniciar() { for (const f of lista) f.suelto = false; }
  // los que estan en la calle ahora (para el mapita): [{ x, z }]
  const enLaCalle = () => lista.filter((f) => f.grupo.visible).map((f) => ({ x: f.grupo.position.x, z: f.grupo.position.z, entrego: f.v.entrego }));

  return { sumar, borrar, mover, reiniciar, enLaCalle, cuantos: () => lista.length };
}

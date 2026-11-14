// Reparto: tus versiones pasadas. Cada viaje guardado vuelve a correr desde su largada cada vez que arranca un viaje nuevo:
// todos a la vez, con el reloj del viaje. Son solidos (el auto choca contra ellos como contra una pared que se mueve, y
// ellos no se corren: ya pasaron), pero no hacen otra cosa que frenarte.
//
// Son la misma camioneta, con la cabina de otro color (sin numeros ni nombres).
//
// Cuando un viaje viejo termina: si entrego, el auto queda unos segundos estacionado en la puerta y desaparece; si no
// llego a tiempo, desaparece ahi nomas.
import * as THREE from '../vendor/three.module.js';
import { armarFurgon, MEDIO_ANCHO, MEDIO_LARGO } from './furgon.js';
import { MUESTRA } from './memoria.js';

const COLORES = ['#6f8fa3', '#c8402f', '#4f7a55', '#8a6f9a', '#2f6fa8', '#e9e4d6', '#7a2f2a', '#3f8a55', '#d8a48c', '#3d3f45', '#a9c3cc', '#e07a2e'];
const QUEDA = 3;          // segundos que queda estacionado despues de entregar

export function crearFantasmas(escena, T, C) {
  const lista = [];   // uno por viaje guardado: { v, grupo, choque, suelto }
  const ARRIBA = new THREE.Vector3(0, 1, 0);
  let alto = 0;

  // suma un viaje guardado (su lugar en la lista elige el color)
  function sumar(v) {
    const f = armarFurgon(COLORES[lista.length % COLORES.length], C);
    alto = f.alto;
    f.grupo.visible = false;
    escena.add(f.grupo);
    lista.push({ v, grupo: f.grupo, choque: { x: 0, z: 0, hx: MEDIO_ANCHO, hz: MEDIO_LARGO, ux: 1, uz: 0, y: 0, duro: 1, clase: 'auto', tipo: 'auto', roto: false }, suelto: false });
  }

  function borrar() {
    for (const f of lista) escena.remove(f.grupo);
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

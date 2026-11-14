// Reparto: tus versiones pasadas. Cada viaje guardado vuelve a correr desde su largada cada vez que arranca un viaje nuevo:
// todos a la vez, con el reloj del viaje. Son solidos (el auto choca contra ellos como contra una pared que se mueve, y
// ellos no se corren: ya pasaron), pero no hacen otra cosa que frenarte.
// Van en el mismo vehiculo que usaste en ese viaje, con la cabina de otro color (sin numeros ni nombres); la camioneta,
// con la carga tapada. No llevan fisica: solo se repite su recorrido.
//
// Cuando un viaje viejo termina: si entrego, el vehiculo queda un rato estacionado (en el deposito, descargando: mas rato;
// ahi se hace fila) y desaparece; si no llego a tiempo, desaparece ahi nomas.
import * as THREE from '../vendor/three.module.js';
import { armarVehiculo, TIPOS } from './vehiculos.js';
import { MUESTRA } from './memoria.js';

const COLORES = ['#6f8fa3', '#c8402f', '#4f7a55', '#8a6f9a', '#2f6fa8', '#e9e4d6', '#7a2f2a', '#3f8a55', '#d8a48c', '#3d3f45', '#a9c3cc', '#e07a2e'];

// queda(v): cuantos segundos queda estacionado un viaje entregado, segun adonde fue
export function crearFantasmas(escena, T, queda) {
  const lista = [];   // uno por viaje guardado: { v, grupo, alto, choque, suelto, queda }
  const ARRIBA = new THREE.Vector3(0, 1, 0);

  // suma un viaje guardado (su lugar en la lista elige el color)
  function sumar(v) {
    const tipo = TIPOS[v.tipo] ? v.tipo : 'furgon', f = armarVehiculo(tipo, COLORES[lista.length % COLORES.length], true);
    f.grupo.visible = false;
    escena.add(f.grupo);
    lista.push({ v, grupo: f.grupo, alto: f.alto, suelto: false, queda: v.entrego ? queda(v) : 0,
      choque: { x: 0, z: 0, hx: TIPOS[tipo].ancho, hz: TIPOS[tipo].largo, ux: 1, uz: 0, y: 0, duro: 1, clase: 'auto', tipo: 'auto', roto: false } });
  }

  function borrar() {
    for (const f of lista) escena.remove(f.grupo);
    lista.length = 0;
  }

  // donde esta un viaje en el segundo t (curva suave entre muestras). Devuelve false si ya no esta en la calle.
  const P = { x: 0, z: 0, rumbo: 0 };
  function pose(f, t) {
    const v = f.v, n = v.xs.length;
    if (n < 2) return false;
    const fin = (n - 1) * MUESTRA;
    if (t > fin + f.queda) return false;
    const q = Math.min(n - 1.0001, Math.max(0, t / MUESTRA)), k = Math.floor(q), u = q - k;
    const a = Math.max(0, k - 1), c = Math.min(n - 1, k + 1), d = Math.min(n - 1, k + 2);
    const cr = (A) => { const p0 = A[a], p1 = A[k], p2 = A[c], p3 = A[d]; return 0.5 * (2 * p1 + (p2 - p0) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (3 * p1 - p0 - 3 * p2 + p3) * u * u * u); };
    P.x = cr(v.xs); P.z = cr(v.zs);
    let g = v.rs[c] - v.rs[k];
    g = Math.atan2(Math.sin(g), Math.cos(g));
    P.rumbo = v.rs[k] + g * u;
    return true;
  }

  const activos = [];
  // Una vez por cuadro (y antes de mover el auto): pone a cada version pasada donde estaba en el segundo t de su viaje y
  // le pasa al terreno las que se pueden chocar (mas "otras": las cajas que se cayeron). yo: el auto del que juega.
  // Una version pasada no se choca hasta que se separo una vez del auto (al reintentar un viaje, el intento anterior larga
  // del mismo lugar que vos).
  function mover(t, yo, otras = []) {
    activos.length = 0;
    for (const f of lista) {
      if (!pose(f, t)) { f.grupo.visible = false; continue; }
      f.grupo.visible = true;
      f.grupo.position.set(P.x, f.alto, P.z);
      f.grupo.quaternion.setFromAxisAngle(ARRIBA, -P.rumbo);
      const o = f.choque;
      o.x = P.x; o.z = P.z; o.ux = Math.cos(P.rumbo); o.uz = Math.sin(P.rumbo);
      if (!f.suelto && Math.hypot(P.x - yo.pos[0], P.z - yo.pos[2]) > 9) f.suelto = true;
      if (f.suelto) activos.push(o);
    }
    T.ponerMoviles(otras.length ? activos.concat(otras) : activos);
    return activos.length;
  }
  // al empezar un viaje, todos vuelven a su largada (y ninguno se choca hasta separarse)
  function reiniciar() { for (const f of lista) f.suelto = false; }
  // los que estan en la calle ahora (para el mapita y para la explicacion): [{ x, z, grupo }]
  const enLaCalle = () => lista.filter((f) => f.grupo.visible).map((f) => ({ x: f.grupo.position.x, z: f.grupo.position.z, entrego: f.v.entrego, grupo: f.grupo, suelto: f.suelto }));

  return { sumar, borrar, mover, reiniciar, enLaCalle, cuantos: () => lista.length };
}

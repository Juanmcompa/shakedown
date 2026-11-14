// Reparto: tus versiones pasadas. Cada vez que arranca un viaje, todas salen a la vez, con el reloj del viaje.
//
// Van encadenadas: la version del viaje 3, cuando llega a su destino, no se queda ahi: hace tu viaje 4 (que salio de ese
// mismo lugar), despues el 5, y asi hasta el ultimo que hiciste. O sea, en el viaje n hay una version que arranca en cada
// viaje anterior y sigue tus pasos desde ahi: el pueblo se llena rapido, y nadie desaparece a mitad de camino.
// En el techo llevan el numero de la entrega que estan haciendo en ese momento (cambia al pasar de un viaje al siguiente).
// Los intentos que no llegaron a tiempo van sueltos: hacen su recorrido y desaparecen.
//
// Son solidos (el auto choca contra ellos como contra una pared que se mueve, y ellos no se corren: ya pasaron), pero no
// hacen otra cosa que frenarte. Van en el vehiculo que usaste en cada viaje, con la cabina de otro color. No llevan fisica.
import * as THREE from '../vendor/three.module.js';
import { armarVehiculo, TIPOS } from './vehiculos.js';
import { MUESTRA } from './memoria.js';

const COLORES = ['#6f8fa3', '#c8402f', '#4f7a55', '#8a6f9a', '#2f6fa8', '#e9e4d6', '#7a2f2a', '#3f8a55', '#d8a48c', '#3d3f45', '#a9c3cc', '#e07a2e'];
const QUEDA = 3;   // segundos que la ultima de una cadena queda estacionada al terminar

export function crearFantasmas(escena, T) {
  const viajes = [];    // todos los viajes guardados, en orden
  let cadenas = [];     // las versiones de este viaje: { tramos: [{ v, desde }], fin, queda, color, vehiculo, suelto, choque }
  const sueltos = {};   // vehiculos dibujados que no se estan usando, por tipo y color (para no armarlos cada vez)
  const ARRIBA = new THREE.Vector3(0, 1, 0);
  const dura = (v) => Math.max(0, (v.xs.length - 1) * MUESTRA);

  // un vehiculo dibujado: se reusa uno guardado o se arma
  function pedir(tipo, color) {
    const clave = tipo + color, l = sueltos[clave];
    if (l && l.length) { const f = l.pop(); f.grupo.visible = false; return f; }
    const f = armarVehiculo(tipo, color);
    f.clave = clave;
    escena.add(f.grupo);
    return f;
  }
  function devolver(f) { f.grupo.visible = false; (sueltos[f.clave] || (sueltos[f.clave] = [])).push(f); }

  // suma un viaje guardado
  function sumar(v) { viajes.push(v); }
  function borrar() {
    for (const c of cadenas) if (c.vehiculo) devolver(c.vehiculo);
    cadenas = []; viajes.length = 0;
  }

  // Arma las versiones para el viaje n: una cadena que arranca en cada viaje entregado anterior y sigue con los siguientes
  // (de cada viaje, el intento que entrego), y una suelta por cada intento que no llego.
  function preparar(n) {
    for (const c of cadenas) if (c.vehiculo) devolver(c.vehiculo);
    cadenas = [];
    const entregado = [];
    for (const v of viajes) if (v.entrego && v.k < n) entregado[v.k] = v;
    let color = 0;
    const nueva = (tramos, queda) => {
      let t = 0;
      for (const p of tramos) { p.desde = t; t += dura(p.v); }
      cadenas.push({ tramos, fin: t, queda, color: COLORES[color++ % COLORES.length], vehiculo: null, suelto: false, choque: { x: 0, z: 0, hx: 1, hz: 2, ux: 1, uz: 0, y: 0, duro: 1, clase: 'auto', tipo: 'auto', roto: false } });
    };
    for (let k = 0; k < n; k++) {
      if (!entregado[k]) continue;
      const tramos = [];
      for (let j = k; j < n && entregado[j]; j++) tramos.push({ v: entregado[j] });
      nueva(tramos, QUEDA);
    }
    for (const v of viajes) if (!v.entrego && v.k <= n) nueva([{ v }], 0);
  }

  // donde esta una cadena en el segundo t: su tramo y la posicion (curva suave entre muestras). null si ya no esta.
  const P = { x: 0, z: 0, rumbo: 0, tramo: null };
  function pose(c, t) {
    if (t > c.fin + c.queda || !c.tramos.length) return null;
    let p = c.tramos[c.tramos.length - 1];
    for (const q of c.tramos) if (t < q.desde + dura(q.v)) { p = q; break; }
    const v = p.v, n = v.xs.length;
    if (n < 2) return null;
    const f = Math.min(n - 1.0001, Math.max(0, (t - p.desde) / MUESTRA)), k = Math.floor(f), u = f - k;
    const a = Math.max(0, k - 1), b = Math.min(n - 1, k + 1), d = Math.min(n - 1, k + 2);
    const cr = (A) => { const p0 = A[a], p1 = A[k], p2 = A[b], p3 = A[d]; return 0.5 * (2 * p1 + (p2 - p0) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (3 * p1 - p0 - 3 * p2 + p3) * u * u * u); };
    P.x = cr(v.xs); P.z = cr(v.zs);
    let g = v.rs[b] - v.rs[k];
    g = Math.atan2(Math.sin(g), Math.cos(g));
    P.rumbo = v.rs[k] + g * u;
    P.tramo = p;
    return P;
  }

  const activos = [];
  // Una vez por cuadro (y antes de mover el auto): pone a cada version donde estaba en el segundo t y le pasa al terreno
  // las que se pueden chocar (mas "otras", si hay). yo: el auto del que juega. Una version no se choca hasta que se separo
  // una vez del auto (al reintentar un viaje, el intento anterior larga del mismo lugar que vos).
  function mover(t, yo, otras = []) {
    activos.length = 0;
    for (const c of cadenas) {
      const p = pose(c, t);
      if (!p) { if (c.vehiculo) { devolver(c.vehiculo); c.vehiculo = null; } continue; }
      const v = p.tramo.v, tipo = TIPOS[v.tipo] ? v.tipo : 'furgon';
      // al pasar de un viaje al siguiente puede cambiar de vehiculo
      if (!c.vehiculo || c.vehiculo.tipo !== tipo) { if (c.vehiculo) devolver(c.vehiculo); c.vehiculo = pedir(tipo, c.color); }
      const f = c.vehiculo;
      f.grupo.visible = true;
      f.grupo.position.set(p.x, f.alto, p.z);
      f.grupo.quaternion.setFromAxisAngle(ARRIBA, -p.rumbo);
      f.numero(v.k + 1);
      c.numero = v.k + 1;
      const o = c.choque;
      o.x = p.x; o.z = p.z; o.ux = Math.cos(p.rumbo); o.uz = Math.sin(p.rumbo); o.hx = TIPOS[tipo].ancho; o.hz = TIPOS[tipo].largo;
      if (!c.suelto && Math.hypot(p.x - yo.pos[0], p.z - yo.pos[2]) > 9) c.suelto = true;
      if (c.suelto) activos.push(o);
    }
    T.ponerMoviles(otras.length ? activos.concat(otras) : activos);
    return activos.length;
  }
  // al empezar un viaje, ninguna se choca hasta separarse
  function reiniciar() { for (const c of cadenas) c.suelto = false; }
  // las que estan en la calle ahora (para el mapita y para la explicacion)
  const enLaCalle = () => cadenas.filter((c) => c.vehiculo && c.vehiculo.grupo.visible).map((c) => ({ x: c.choque.x, z: c.choque.z, entrego: c.queda > 0, suelto: c.suelto, numero: c.numero, arranco: c.tramos[0].v.k + 1 }));

  return { sumar, borrar, preparar, mover, reiniciar, enLaCalle, cuantos: () => viajes.length, enCalle: () => cadenas.length };
}

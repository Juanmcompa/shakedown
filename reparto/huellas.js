// F FOR TRAFFIC: las marcas de las cubiertas en el piso (frenadas, derrapes, el pasto aplastado). Un mapa de todo el pueblo,
// a 4 pixeles por metro (un dato por pixel: que tan oscura es la marca). El piso lo lee y se oscurece ahi (ver dibujo.js).
// Tiene la misma forma que src/huellas.js de Shakedown (marcar, soltar, cortar, subir, limpiar), asi los efectos de
// Shakedown (src/fx.js: humo de goma, polvo, lo que salta) lo usan sin enterarse.
import * as THREE from '../vendor/three.module.js';

const TOPE = 210;   // lo mas oscura que llega a ser una marca

// x0, z0: la esquina del mapa (en metros); ancho y alto: cuanto cubre (en metros)
export function crearHuellas(x0, z0, ancho, alto) {
  const W = Math.round(ancho * 4), H = Math.round(alto * 4);
  const datos = new Uint8Array(W * H), textura = new THREE.DataTexture(datos, W, H, THREE.RedFormat, THREE.UnsignedByteType);
  textura.unpackAlignment = 1; textura.magFilter = THREE.NearestFilter; textura.minFilter = THREE.LinearFilter; textura.needsUpdate = true;
  const ultimo = [null, null, null, null];
  let sucio = false, espera = 0;

  function punto(px, py, v, suma, ancho) {
    for (let dy = 0; dy <= (ancho ? 1 : 0); dy++) for (let dx = 0; dx <= (ancho ? 1 : 0); dx++) {
      const x = px + dx, y = py + dy;
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const k = y * W + x;
      let nuevo = v;
      if (datos[k] >= v) { if (!suma || datos[k] >= TOPE) continue; nuevo = Math.min(TOPE, datos[k] + suma); }
      datos[k] = nuevo; sucio = true;
    }
  }
  return {
    textura, x0, z0, ancho, alto,
    // marca el paso de la rueda i por el punto (x, z). fuerza: de 0 a 1. suma: cuanto oscurece cada pasada de mas.
    // ancho: la marca de dos pixeles (al derrapar)
    marcar: (i, x, z, fuerza, suma = 0, ancho = false) => {
      const px = Math.floor((x - x0) * 4), py = Math.floor((z - z0) * 4), v = Math.min(TOPE, Math.round(fuerza * 230)), u = ultimo[i];
      ultimo[i] = [px, py];
      if (v <= 0) return;
      if (!u || (u[0] === px && u[1] === py)) { punto(px, py, v, suma, ancho); return; }
      // una linea de pixeles desde el anterior, para que no queden huecos yendo rapido
      let ax = u[0], ay = u[1];
      const dx = Math.abs(px - ax), dy = Math.abs(py - ay), sx = ax < px ? 1 : -1, sy = ay < py ? 1 : -1;
      let err = dx - dy, pasos = 0;
      while ((ax !== px || ay !== py) && pasos++ < 64) {
        const e2 = 2 * err;
        if (e2 > -dy) { err -= dy; ax += sx; }
        if (e2 < dx) { err += dx; ay += sy; }
        punto(ax, ay, v, suma, ancho);
      }
    },
    soltar: (i) => { ultimo[i] = null; },
    cortar: () => { ultimo.fill(null); },
    // (se sube a la placa de video a lo sumo unas cinco veces por segundo: el mapa es grande)
    subir: (dt = 1 / 60) => { espera -= dt; if (sucio && espera <= 0) { textura.needsUpdate = true; sucio = false; espera = 0.2; } },
    limpiar: () => { datos.fill(0); ultimo.fill(null); textura.needsUpdate = true; },
  };
}

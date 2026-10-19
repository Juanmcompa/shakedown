// Las huellas de la Travesia. En la pista del dia hay un solo mapa de huellas para todo el terreno (huellas.js); aca el camino no
// tiene fin, asi que cada pedazo de terreno lleva el suyo (4 pixeles por metro, un dato por pixel, el mismo formato que lee el piso).
// Tiene la misma forma que huellas.js (marcar, soltar, cortar, subir, limpiar) para que los efectos (fx.js) lo usen sin enterarse,
// y ademas sabe pintar las huellas que dejaron "otros autos" (las que calcula travesiaterreno.js) cuando se arma cada pedazo.
// Las marcas del auto se anotan en todos los pedazos que cubren ese lugar (los pedazos vecinos comparten un metro de borde).
import * as THREE from '../vendor/three.module.js';
import { TRAVESIA } from './config.js';

const L = TRAVESIA.lado, NV = L + 1, W = NV * 4, TOPE = 200, SUAVE = 0.72;   // SUAVE: en la arena la huella no queda tan negra como en barro

export function crearHuellasDeTravesia() {
  const tiles = new Map(), ultimo = [null, null, null, null];
  const clave = (tx, tz) => tx + ',' + tz;

  // un pedazo nuevo: su mapa de huellas, con las de otros autos ya marcadas. Devuelve la textura que lee el piso.
  function registrar(t) {
    const datos = new Uint8Array(W * W), textura = new THREE.DataTexture(datos, W, W, THREE.RedFormat, THREE.UnsignedByteType);
    textura.unpackAlignment = 1; textura.needsUpdate = true;
    const e = { datos, textura, sucio: false };
    const r = t.rodadas;
    if (r) for (let k = 0; k < r.length; k += 3) {
      const px = Math.floor(r[k] * 4) - t.x0 * 4, py = Math.floor(r[k + 1] * 4) - t.z0 * 4;
      if (px < 0 || py < 0 || px >= W || py >= W) continue;
      const v = Math.round(r[k + 2] * 255);
      if (datos[py * W + px] < v) datos[py * W + px] = v;
    }
    tiles.set(clave(t.tx, t.tz), e);
    return textura;
  }
  function liberar(t) {
    const e = tiles.get(clave(t.tx, t.tz));
    if (!e) return;
    e.textura.dispose();
    tiles.delete(clave(t.tx, t.tz));
  }

  // un pixel del mundo (en cuartos de metro): se anota en el pedazo que lo tiene y, si cae en el metro de borde, tambien en el vecino
  function punto(gx, gy, v, suma) {
    const tx = Math.floor(gx / (4 * L)), tz = Math.floor(gy / (4 * L)), lx = gx - tx * 4 * L, ly = gy - tz * 4 * L;
    escribir(tx, tz, lx, ly, v, suma);
    const bx = lx < 4, bz = ly < 4;
    if (bx) escribir(tx - 1, tz, lx + 4 * L, ly, v, suma);
    if (bz) escribir(tx, tz - 1, lx, ly + 4 * L, v, suma);
    if (bx && bz) escribir(tx - 1, tz - 1, lx + 4 * L, ly + 4 * L, v, suma);
  }
  function escribir(tx, tz, lx, ly, v, suma) {
    const e = tiles.get(clave(tx, tz));
    if (!e || lx < 0 || ly < 0 || lx >= W || ly >= W) return;
    const k = ly * W + lx, d = e.datos;
    if (d[k] >= v) {
      if (!suma || d[k] === 0 || d[k] >= TOPE) return;   // (cada pasada de mas oscurece un poco)
      v = Math.min(TOPE, d[k] + suma);
    }
    d[k] = v; e.sucio = true;
  }

  return {
    registrar, liberar,
    // marca el paso de la rueda i por el punto (x, z) del mundo. fuerza: de 0 a 1. (igual que en huellas.js)
    marcar: (i, x, z, fuerza, suma = 0, ancho = false) => {
      const px = Math.floor(x * 4), py = Math.floor(z * 4), v = Math.min(250, Math.round(fuerza * SUAVE * 255)), u = ultimo[i];
      if (!u) { ultimo[i] = [px, py]; if (v > 0) punto(px, py, v, suma); return; }
      if (u[0] === px && u[1] === py) { if (v > 0) punto(px, py, v, suma); return; }
      if (v > 0) {
        // linea de pixeles desde el anterior, para que no queden huecos yendo rapido
        let ax = u[0], ay = u[1];
        const dx = Math.abs(px - ax), dy = Math.abs(py - ay), sx = ax < px ? 1 : -1, sy = ay < py ? 1 : -1;
        let err = dx - dy, pasos = 0;
        while ((ax !== px || ay !== py) && pasos++ < 64) {
          const e2 = 2 * err;
          if (e2 > -dy) { err -= dy; ax += sx; }
          if (e2 < dx) { err += dx; ay += sy; }
          punto(ax, ay, v, suma);
          if (ancho) punto(dx >= dy ? ax : ax + sx, dx >= dy ? ay + sy : ay, Math.round(v * 0.8), 0);   // surco doble al derrapar
        }
      }
      u[0] = px; u[1] = py;
    },
    soltar: (i) => { ultimo[i] = null; },
    cortar: () => { ultimo.fill(null); },
    // al largar de nuevo se arma todo de cero (los pedazos se tiran y se vuelven a armar), asi que no hay nada que borrar
    limpiar: () => { ultimo.fill(null); },
    pintar: () => {},
    // sube a la placa de video los pedazos que cambiaron. Se llama una vez por cuadro.
    subir: () => { for (const e of tiles.values()) if (e.sucio) { e.sucio = false; e.textura.needsUpdate = true; } },
    pedazos: () => tiles.size,
    // (para probar) cuantos pixeles tienen alguna marca, entre todos los pedazos
    marcados: () => { let n = 0; for (const e of tiles.values()) for (let k = 0; k < e.datos.length; k++) if (e.datos[k]) n++; return n; },
  };
}

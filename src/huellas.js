// Huellas: un mapa de todo el terreno, a 4 pixeles por metro, donde las ruedas van dejando su marca.
// El piso lo lee al dibujarse, asi cada huella es un pixel entero del mundo y queda hasta que termina la vuelta.
import * as THREE from 'three';

export function crearHuellas(T, render) {
  const W = T.nx * 4, H = T.nz * 4, X0 = T.x0 * 4, Z0 = T.z0 * 4, datos = new Uint8Array(W * H);
  // dos texturas con la misma memoria: una es la que lee el piso; la otra solo sirve de origen
  // para subirle a la placa de video el pedacito que cambio, en vez del mapa entero
  const hacer = () => { const t = new THREE.DataTexture(datos, W, H, THREE.RedFormat, THREE.UnsignedByteType); t.unpackAlignment = 1; return t; };
  const textura = hacer(), origen = hacer();
  textura.needsUpdate = true;
  const caja = new THREE.Box2(), donde = new THREE.Vector2();
  let x0 = W, y0 = H, x1 = -1, y1 = -1;                 // rectangulo que cambio desde la ultima subida
  const ultimo = [null, null, null, null];              // ultimo pixel marcado por cada rueda

  function punto(x, y, v) {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const k = y * W + x;
    if (datos[k] >= v) return;
    datos[k] = v;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }

  return {
    textura,
    // marca el paso de la rueda i por el punto (x, z) del mundo. fuerza: de 0 a 1.
    marcar: (i, x, z, fuerza) => {
      const px = Math.floor(x * 4) - X0, py = Math.floor(z * 4) - Z0, v = Math.round(fuerza * 255), u = ultimo[i];
      if (!u) { ultimo[i] = [px, py]; if (v > 0) punto(px, py, v); return; }
      if (u[0] === px && u[1] === py) { if (v > 0) punto(px, py, v); return; }
      if (v > 0) {
        // linea de pixeles desde el anterior, para que no queden huecos yendo rapido
        let ax = u[0], ay = u[1];
        const dx = Math.abs(px - ax), dy = Math.abs(py - ay), sx = ax < px ? 1 : -1, sy = ay < py ? 1 : -1;
        let err = dx - dy, pasos = 0;
        while ((ax !== px || ay !== py) && pasos++ < 64) {
          const e2 = 2 * err;
          if (e2 > -dy) { err -= dy; ax += sx; }
          if (e2 < dx) { err += dx; ay += sy; }
          punto(ax, ay, v);
        }
      }
      u[0] = px; u[1] = py;
    },
    // la rueda i quedo en el aire o la camioneta se movio de lugar: la proxima marca no se une con la anterior
    soltar: (i) => { ultimo[i] = null; },
    cortar: () => { ultimo.fill(null); },
    // borra todo (al largar de nuevo)
    limpiar: () => { datos.fill(0); ultimo.fill(null); x0 = W; y0 = H; x1 = y1 = -1; textura.needsUpdate = true; },
    // sube a la placa de video lo que cambio. Se llama una vez por cuadro.
    subir: () => {
      if (x1 < 0) return;
      caja.min.set(x0, y0); caja.max.set(x1 + 1, y1 + 1); donde.set(x0, y0);
      render.copyTextureToTexture(origen, textura, caja, donde);
      x0 = W; y0 = H; x1 = y1 = -1;
    },
    ancho: W, alto: H,
  };
}

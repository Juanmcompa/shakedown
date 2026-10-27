// Huellas: un mapa de todo el terreno, a 4 pixeles por metro, donde las ruedas van dejando su marca.
// El piso lo lee al dibujarse, asi cada huella es un pixel entero del mundo y queda hasta que termina la vuelta.
// En el mismo mapa va la pintura del piso (las lineas de la ruta, las sendas, la raya de largada y la de meta):
// son dos valores que las huellas no usan nunca, y por eso una huella no las tapa.
import * as THREE from '../vendor/three.module.js';
import { SUELOS } from './config.js';

export const PINTURA = { blanca: 255, amarilla: 254 }, HUELLA_MAXIMA = 250;

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
  const pintado = [];                                   // la pintura: [lugar en el mapa, valor], para reponerla al borrar las huellas
  const pinta = (x, z, v) => { const px = Math.floor(x * 4) - X0, py = Math.floor(z * 4) - Z0; if (px >= 0 && py >= 0 && px < W && py < H) { datos[py * W + px] = v; pintado.push(py * W + px, v); } };
  // Pinta el piso de la pista: la raya de largada, los cuadros de la meta, los lomos de burro y, en los tramos de asfalto
  // que lo piden (t.lineas: 'ruta' o 'calle'), la linea del medio, las de los bordes y las sendas de las esquinas.
  function pintar() {
    const P = T.camino;
    // de = cuantos metros a la derecha del medio; va = cuantos metros mas adelante que el metro i
    const en = (i, va, de, v) => pinta(P.X[i] + P.HX[i] * va - P.HZ[i] * de, P.Z[i] + P.HZ[i] * va + P.HX[i] * de, v);
    const s = T.salida.i, m = T.meta.i;
    if (!T.vuelta) for (let de = -P.W[s] / 2 + 0.3; de < P.W[s] / 2 - 0.3; de += 0.2) for (const va of [0, 0.25]) en(s, va, de, PINTURA.blanca);   // (en una vuelta cerrada, solo los cuadros)
    for (let de = -P.W[m] / 2 + 0.2; de < P.W[m] / 2 - 0.2; de += 0.2) for (let f = 0; f < 4; f++) if ((Math.floor(de * 2 + 100) + (f >> 1)) % 2) en(m, f * 0.25, de, PINTURA.blanca);
    // las rodadas de barro (la Montaña del Sufrimiento): el fondo queda oscuro, como si ya hubieran pasado muchos camiones.
    // Se pinta como el resto de lo fijo, asi vuelve despues de borrar las huellas.
    if (T.enSurco) for (const t of T.etapa.tramos) {
      if (!t.surcos) continue;
      for (let i = t.desde; i < t.hasta; i++) for (let f = 0; f < 4; f++) for (let de = -P.W[i] / 2 + 0.3; de < P.W[i] / 2 - 0.3; de += 0.25) {
        const x = P.X[i] + P.HX[i] * f * 0.25 - P.HZ[i] * de, z = P.Z[i] + P.HZ[i] * f * 0.25 + P.HX[i] * de, w = T.enSurco(x, z);
        if (w > 0.12) pinta(x, z, w > 0.7 ? 150 : w > 0.4 ? 100 : 60);
      }
    }
    // las huellas de otros autos que pasaron antes (t.pasaron = [{ u0, u1, lado, fuerza, culebra }]: rodadas paralelas, una por rueda)
    // y las salidas de pista (T.salidas: la rodada que se va afuera y, a veces, marcas de trompo). Solo se ven: no cambian el suelo.
    const PEGA = [SUELOS.asfalto.id, SUELOS.asfaltoViejo.id, SUELOS.adoquin.id, SUELOS.vereda.id, SUELOS.madera.id, SUELOS.roca.id];
    for (const t of T.etapa.tramos) for (const q of t.pasaron || []) {
      if (PEGA.includes(SUELOS[t.suelo].id)) continue;
      const fase = (q.lado * 7.3 + t.desde) % 6.28;
      for (let i = t.desde + Math.max(0, q.u0); i < Math.min(t.hasta, t.desde + q.u1); i++) {
        const dentro = Math.min(i - t.desde - q.u0, t.desde + q.u1 - i), v = Math.round((q.fuerza || 0.4) * 255 * Math.min(1, 0.4 + dentro / 8));
        const centro = q.lado + (q.culebra || 0.25) * Math.sin(i / 10 + fase);
        for (const rueda of [-0.72, 0.72]) for (let f = 0; f < 4; f++) {
          if (((i * 4 + f) * 2654435761 >>> 0) % 11 === 0) continue;   // (la marca se corta aca y alla)
          const de = centro + rueda;
          if (Math.abs(de) < P.W[i] / 2 - 0.2) en(i, f * 0.25, de, v);
        }
      }
    }
    for (const sa of T.salidas || []) {
      const marca = (x, z, v) => pinta(x, z, v);
      for (let k = 1; k < sa.pts.length; k++) {
        const [x1, z1] = sa.pts[k - 1], [x2, z2] = sa.pts[k], dx = x2 - x1, dz = z2 - z1, l = Math.hypot(dx, dz) || 1, nx = -dz / l, nz = dx / l;
        for (let f = 0; f < 2; f++) for (const rueda of [-0.72, 0.72]) marca(x1 + dx * f / 2 + nx * rueda, z1 + dz * f / 2 + nz * rueda, k > sa.pts.length - 4 ? 200 : 150);
      }
      if (sa.trompo) for (let a = 0; a < 6.28; a += 0.07) for (const r of [1.9, 2.6]) { const rr = r + 0.25 * Math.sin(a * 3); marca(sa.fin.x + Math.cos(a) * rr, sa.fin.z + Math.sin(a) * rr, 120); }
    }
    for (const t of T.etapa.tramos) {
      // los lomos de burro, a rayas amarillas cruzadas
      for (const l of t.lomos || []) for (let va = -l[2] / 2 + 0.25; va < l[2] / 2 - 0.25; va += 0.25) {
        const i = Math.min(P.n - 1, t.desde + Math.round(l[0]));
        for (let de = -P.W[i] / 2 + 0.3; de < P.W[i] / 2 - 0.3; de += 0.2) if (Math.floor((de + va) * 1.25 + 100) % 2 === 0) en(i, va, de, PINTURA.amarilla);
      }
      if (!t.lineas) continue;
      for (let i = t.desde; i < t.hasta; i++) for (let f = 0; f < 4; f++) {
        if (t.lineas === 'ruta') {
          if (i % 9 < 4) en(i, f * 0.25, 0, PINTURA.amarilla);
          en(i, f * 0.25, P.W[i] / 2 - 0.45, PINTURA.blanca); en(i, f * 0.25, -P.W[i] / 2 + 0.45, PINTURA.blanca);
        }
        // las sendas: cerca de las dos puntas de cada cuadra
        const u = i - t.desde, senda = t.largo > 30 && ((u >= 3 && u < 6) || (u >= t.largo - 6 && u < t.largo - 3));
        if (senda) for (let de = -P.W[i] / 2 + 0.6; de < P.W[i] / 2 - 0.6; de += 0.2) if (Math.floor(de + 100) % 2 === 0) en(i, f * 0.25, de, PINTURA.blanca);
      }
    }
    textura.needsUpdate = true;
  }

  // suma: si el pixel ya tenia una huella (otra pasada), se oscurece un poco mas, sin pasar de TOPE
  const TOPE = 200;
  function punto(x, y, v, suma = 0) {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const k = y * W + x;
    if (datos[k] >= v) {
      if (!suma || datos[k] === 0 || datos[k] >= TOPE) return;
      v = Math.min(TOPE, datos[k] + suma);
    }
    datos[k] = v;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }

  return {
    textura, pintar,
    // marca el paso de la rueda i por el punto (x, z) del mundo. fuerza: de 0 a 1.
    marcar: (i, x, z, fuerza, suma = 0, ancho = false) => {
      const px = Math.floor(x * 4) - X0, py = Math.floor(z * 4) - Z0, v = Math.min(HUELLA_MAXIMA, Math.round(fuerza * 255)), u = ultimo[i];
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
          punto(ax, ay, v, suma);
          if (ancho) punto(dx >= dy ? ax : ax + sx, dx >= dy ? ay + sy : ay, Math.round(v * 0.8));   // surco doble al derrapar
        }
      }
      u[0] = px; u[1] = py;
    },
    // la rueda i quedo en el aire o la camioneta se movio de lugar: la proxima marca no se une con la anterior
    soltar: (i) => { ultimo[i] = null; },
    cortar: () => { ultimo.fill(null); },
    // borra todo (al largar de nuevo)
    limpiar: () => { datos.fill(0); for (let k = 0; k < pintado.length; k += 2) datos[pintado[k]] = pintado[k + 1]; ultimo.fill(null); x0 = W; y0 = H; x1 = y1 = -1; textura.needsUpdate = true; },
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

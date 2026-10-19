// La trazada de la Travesia: las mismas rayitas pintadas sobre el camino que en la pista del dia (ver trazada.js), pero para
// un camino que se arma mientras se avanza. No hay referencia ni colores por velocidad: es una linea por el medio del camino
// que muestra para donde sigue. Se arma con un grupo fijo de rayitas que se van reubicando delante del auto (cada rayita
// "es" un metro multiplo de PASO; cuando el auto pasa, la de atras se muda al final), asi que no crece nunca.
import * as THREE from '../vendor/three.module.js';
import { estilo } from './material.js';

const PASO = 3, LARGO = 1.5, ANCHO = 0.46, ALTO = 0.07;   // una rayita cada tantos metros, y su tamaño
const ATRAS = 9, ADELANTE = 240;                          // metros que se pintan alrededor del auto
const CUANTAS = Math.ceil((ATRAS + ADELANTE) / PASO) + 2;

export function crearTrazadaTravesia(escena) {
  const pos = new Float32Array(CUANTAS * 6 * 3), idx = [], etiqueta = new Int32Array(CUANTAS).fill(-1);
  for (let k = 0; k < CUANTAS; k++) {
    const a = k * 6;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2, a + 2, a + 3, a + 4, a + 3, a + 5, a + 4);
  }
  const g = new THREE.BufferGeometry(), atributo = new THREE.BufferAttribute(pos, 3);
  atributo.setUsage(THREE.DynamicDrawUsage);
  g.setAttribute('position', atributo);
  g.setIndex(idx);
  const malla = new THREE.Mesh(g, estilo(new THREE.MeshBasicMaterial({ color: '#f6f1dc', transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 })));
  malla.renderOrder = -1;          // es pintura del piso: va antes que el polvo y lo demas
  malla.frustumCulled = false;     // (las rayitas se mudan de lugar y la caja de la primera vez no sirve)
  malla.visible = false;
  escena.add(malla);
  let prendida = false;

  // el metro m del camino (con decimales)
  function en(P, m) {
    const j = Math.max(0, Math.min(P.n - 2, m)), i = Math.floor(j), f = j - i;
    return [P.X[i] + (P.X[i + 1] - P.X[i]) * f, P.Z[i] + (P.Z[i + 1] - P.Z[i]) * f];
  }
  // acomoda la rayita "k" (numero de rayita desde la largada) en su lugar del camino; false si el camino todavia no llega
  function poner(T, k) {
    const P = T.camino, m = k * PASO;
    if (m + LARGO / 2 + 0.5 >= P.n - 1) return false;
    const base = (k % CUANTAS) * 18;
    for (let s = 0; s < 3; s++) {
      const u = m + (s - 1) * LARGO / 2, [x, z] = en(P, u), [xa, za] = en(P, u - 0.5), [xb, zb] = en(P, u + 0.5);
      const l = Math.hypot(xb - xa, zb - za) || 1, nx = -(zb - za) / l * ANCHO / 2, nz = (xb - xa) / l * ANCHO / 2;
      for (let lado = 0; lado < 2; lado++) {
        const o = base + (s * 2 + lado) * 3, q = lado ? 1 : -1, px = x + nx * q, pz = z + nz * q;
        pos[o] = px; pos[o + 1] = T.altura(px, pz) + ALTO; pos[o + 2] = pz;
      }
    }
    return true;
  }
  return {
    mostrar: (si) => { prendida = !!si; malla.visible = prendida; },
    visible: () => prendida,
    // una corrida nueva: el camino es otro, hay que volver a ubicar todas
    reiniciar: () => { etiqueta.fill(-1); },
    // una vez por cuadro: pinta las rayitas de alrededor del metro "indice" (solo las que cambiaron)
    actualizar: (T, indice) => {
      if (!prendida || !T) return;
      let cambio = false;
      for (let k = Math.max(0, Math.ceil((indice - ATRAS) / PASO)), fin = Math.floor((indice + ADELANTE) / PASO); k <= fin; k++) {
        const s = k % CUANTAS;
        if (etiqueta[s] === k) continue;
        if (poner(T, k)) { etiqueta[s] = k; cambio = true; }
        else break;   // el camino no llega mas lejos: las siguientes tampoco
      }
      if (cambio) atributo.needsUpdate = true;
    },
    // para las pruebas: cuantas rayitas hay puestas delante del auto
    puestas: (indice) => { let n = 0; for (let s = 0; s < CUANTAS; s++) if (etiqueta[s] * PASO >= indice - ATRAS && etiqueta[s] * PASO <= indice + ADELANTE) n++; return n; },
  };
}

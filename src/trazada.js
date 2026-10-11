// La trazada: una linea de rayitas pintada sobre el camino, que muestra por donde conviene pasar, como en los juegos
// de carrera. Es optativa: se prende en la configuracion (o con la tecla T). Es solo dibujo: no cambia nada del manejo.
// Va por donde pasaria un piloto muy bueno (la misma cuenta de referencia.js que da el tiempo de cada sector), y cada
// rayita cambia de color segun la velocidad que trae el auto comparada con la que conviene llevar ahi:
//   verde = podes acelerar      amarillo = venis justo      rojo = venis pasado: hay que frenar antes de llegar ahi
// Asi, viniendo fuerte por una recta, la curva que sigue se ve roja desde lejos, y el rojo se va acercando: cuando
// llega al auto, es el momento de frenar. Frenando, las rayitas vuelven a ponerse amarillas y verdes.
// "La que conviene" no es la del piloto de referencia (que va al limite y frena lo mas tarde que se puede), sino un
// poco menos y frenando sin apuro: el que maneja sin pisar el rojo llega sin sustos, y con un tiempo decente.
import * as THREE from '../vendor/three.module.js';
import { estilo } from './material.js';

const PASO = 3, LARGO = 1.5, ANCHO = 0.42;        // una rayita cada tantos metros, y lo que mide cada una
const ALTO = 0.07;                                // cuanto se despega del piso (para que no se meta adentro)
const ATRAS = 9, ADELANTE = 240;                  // metros de trazada que se repintan cada cuadro, alrededor del auto
// (los mismos colores que los cuadraditos de los sectores)
const color = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
const VERDE = color('#5cc070'), AMARILLO = color('#f2c200'), ROJO = color('#ff6a52');
const RITMO = 0.9, FRENADA = 4.2;                 // la velocidad que conviene: esta parte de la de referencia, frenando a tantos m/s2
const JUSTO = 0.88;                               // desde que parte de esa velocidad la rayita se pone amarilla (pasada, roja)

// ref: la referencia de la pista (de ahi sale por donde pasa la linea, que es la misma para todos los autos).
// La linea se arma recien la primera vez que se la prende: el que no la usa no la paga.
export function crearTrazada(T, escena, ref) {
  const P = T.camino, L = T.vuelta ? T.vuelta.largo : 0, n = L || P.n, base = L;   // (en una vuelta cerrada se usa la vuelta del medio)
  const cuantas = Math.floor(n / PASO);
  let malla = null, col = null, colores = null, prendida = false;

  function armar() {
    const N = cuantas * 6, pos = new Float32Array(N * 3), idx = [];
    col = new Float32Array(N * 3);
    // un punto de la linea: el metro "m" del camino (puede traer decimales), corrido lo que diga la referencia
    const en = (m) => {
      const j = Math.max(0, Math.min(P.n - 2, base + m)), i = Math.floor(j), f = j - i, lado = ref.corre[i] + (ref.corre[i + 1] - ref.corre[i]) * f;
      return [P.X[i] + (P.X[i + 1] - P.X[i]) * f - (P.HZ[i] + (P.HZ[i + 1] - P.HZ[i]) * f) * lado, P.Z[i] + (P.Z[i + 1] - P.Z[i]) * f + (P.HX[i] + (P.HX[i + 1] - P.HX[i]) * f) * lado];
    };
    for (let k = 0; k < cuantas; k++) {
      const m = k * PASO;
      // tres cortes a lo largo de la rayita (asi acompaña las lomas), cada uno con sus dos bordes apoyados en el piso
      for (let s = 0; s < 3; s++) {
        const u = m + (s - 1) * LARGO / 2, [x, z] = en(u), [xa, za] = en(u - 0.5), [xb, zb] = en(u + 0.5);
        const l = Math.hypot(xb - xa, zb - za) || 1, nx = -(zb - za) / l * ANCHO / 2, nz = (xb - xa) / l * ANCHO / 2;
        for (const lado of [-1, 1]) {
          const o = (k * 6 + s * 2 + (lado > 0 ? 1 : 0)) * 3, px = x + nx * lado, pz = z + nz * lado;
          pos[o] = px; pos[o + 1] = T.altura(px, pz) + ALTO; pos[o + 2] = pz;
          col[o] = VERDE[0]; col[o + 1] = VERDE[1]; col[o + 2] = VERDE[2];
        }
      }
      const a = k * 6;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2, a + 2, a + 3, a + 4, a + 3, a + 5, a + 4);
    }
    const g = new THREE.BufferGeometry();
    colores = new THREE.BufferAttribute(col, 3);
    colores.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', colores);
    g.setIndex(idx);
    g.computeBoundingSphere();
    malla = new THREE.Mesh(g, estilo(new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.82, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 })));
    malla.renderOrder = -1;   // es una pintura del piso: va antes que el agua, el polvo y el fantasma, que se dibujan encima
    escena.add(malla);
  }

  // la velocidad que conviene llevar en cada metro: una parte del "techo" de la referencia (lo mas rapido que se puede
  // venir y todavia llegar bien a lo que sigue), y nunca mas de lo que deja frenar con calma (se cuenta de adelante para atras)
  const conviene = new Float32Array(P.n);
  let de = ref, hecha = null;
  const calcular = () => {
    if (hecha === de) return;
    hecha = de;
    const v = de.techo;
    conviene[P.n - 1] = Math.max(1.5, v[P.n - 1] * RITMO);
    for (let i = P.n - 2; i >= 0; i--) conviene[i] = Math.max(1.5, Math.min(v[i] * RITMO, Math.sqrt(conviene[i + 1] * conviene[i + 1] + 2 * FRENADA)));
  };
  const pintar = (k, c) => { for (let q = 0; q < 6; q++) { const o = (k * 6 + q) * 3; col[o] = c[0]; col[o + 1] = c[1]; col[o + 2] = c[2]; } };
  return {
    // se ve o no se ve (solo tiene sentido mientras se maneja)
    mostrar: (si) => {
      prendida = !!si;
      if (prendida) { if (!malla) armar(); calcular(); }
      if (malla) malla.visible = prendida;
    },
    // con que auto se compara la velocidad: su referencia (cada auto frena y dobla distinto)
    usar: (refDelAuto) => { de = refDelAuto || ref; if (prendida) calcular(); },
    // Una vez por cuadro: repinta las rayitas de alrededor del auto segun la velocidad que trae.
    // c: el auto. indice: el metro del camino por el que va.
    actualizar: (c, indice) => {
      if (!prendida) return;
      const v = Math.abs(c.velocidad);
      let primera = -1, ultima = -1;
      for (let m = Math.ceil((indice - ATRAS) / PASO) * PASO; m <= indice + ADELANTE; m += PASO) {
        if (m < 0 || m >= P.n) continue;
        const parte = v / conviene[m];
        // (en una vuelta cerrada los metros dan la vuelta: la rayita es la misma en todas)
        const k = Math.round((((m - base) % n) + n) % n / PASO) % cuantas;
        pintar(k, parte > 1 ? ROJO : parte > JUSTO ? AMARILLO : VERDE);
        if (primera < 0) primera = k;
        ultima = k;
      }
      if (primera < 0) return;
      // a la placa de video solo se le manda el pedazo que cambio (o dos, si el pedazo da la vuelta)
      colores.clearUpdateRanges();
      if (ultima >= primera) colores.addUpdateRange(primera * 18, (ultima - primera + 1) * 18);
      else { colores.addUpdateRange(primera * 18, (cuantas - primera) * 18); colores.addUpdateRange(0, (ultima + 1) * 18); }
      colores.needsUpdate = true;
    },
  };
}

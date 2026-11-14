// Reparto: la camioneta de reparto. Por dentro maneja como la Vitarita de Shakedown (la misma fisica), un poco mas larga,
// mas ancha y mas pesada; por fuera es una caja de carga gris con la cabina de color. Las versiones pasadas son la misma
// camioneta con la cabina de otro color. Todo son cajas con dibujos de pocos pixeles (4 por metro), como el resto del mundo.
import * as THREE from '../vendor/three.module.js';
import { configDe } from '../src/partes.js';
import { tono } from '../src/pixel.js';

// la fisica: la de la Vitarita, agrandada a una camioneta (con el mismo empuje por kilo, para que acelere parecido)
export function configFurgon() {
  const V = configDe('vitarita'), k = 1.45;
  return {
    ...V,
    masa: V.masa * k, resorte: V.resorte * k, amortigua: V.amortigua.map((a) => a * k), potencia: V.potencia * 1.3,
    inercia: V.inercia.map((i) => i * k * 1.4),
    caja: [0.95, 2.25, V.caja[2], 1.7], choque: [0.95, 1.35], trocha: 0.84, ejes: 1.45,
  };
}
// medio ancho y medio largo (para chocar a las versiones pasadas) y las medidas del dibujo
export const MEDIO_ANCHO = 0.97, MEDIO_LARGO = 2.3;
const ANCHO = 1.9, CAJA = 3.1, CABINA = 1.5, ALTO_CAJA = 2.05, ALTO_CABINA = 1.45, PISO = 0.42;

const lienzo = (w, h, pintar) => {
  const l = document.createElement('canvas');
  l.width = w; l.height = h;
  const g = l.getContext('2d');
  pintar((x, y, ww, hh, c) => { g.fillStyle = c; g.fillRect(x, y, ww, hh); });
  const t = new THREE.CanvasTexture(l);
  t.magFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace;
  return t;
};
const mat = (t) => new THREE.MeshLambertMaterial({ map: t });

// la caja de carga: igual para todas
let caja = null;
function materialesCaja() {
  if (caja) return caja;
  const G = '#8b8784', borde = '#3a3a3c';
  const lado = mat(lienzo(13, 8, (R) => {
    R(0, 0, 13, 8, G); R(0, 0, 13, 1, tono(G, 0.25)); R(0, 7, 13, 1, tono(G, -0.35));
    R(2, 2, 9, 1, '#b3afa9'); R(2, 5, 9, 1, '#b3afa9'); R(12, 1, 1, 6, tono(G, -0.15));
  }));
  const atras = mat(lienzo(8, 8, (R) => {
    R(0, 0, 8, 8, '#c9c4bb'); for (let y = 1; y < 7; y += 2) R(1, y, 6, 1, '#a9a49a');
    R(0, 0, 8, 1, borde); R(0, 7, 8, 1, borde); R(0, 0, 1, 8, borde); R(7, 0, 1, 8, borde); R(3, 6, 2, 1, '#5a5a5c');
  }));
  const techo = mat(lienzo(8, 12, (R) => { R(0, 0, 8, 12, '#a8a39c'); for (let y = 1; y < 12; y += 3) R(0, y, 8, 1, '#94908a'); }));
  const piso = new THREE.MeshLambertMaterial({ color: '#2b2b2d' });
  // (orden de las caras de una caja: derecha, izquierda, arriba, abajo, atras (+z), adelante (-z))
  caja = [lado, lado, techo, piso, atras, lado];
  return caja;
}

// la cabina: de un color
const cabinas = new Map();
function materialesCabina(color) {
  if (cabinas.has(color)) return cabinas.get(color);
  const oscuro = tono(color, -0.3), claro = tono(color, 0.3);
  const lado = mat(lienzo(6, 6, (R) => {
    R(0, 0, 6, 6, color); R(0, 0, 6, 1, claro); R(0, 5, 6, 1, oscuro);
    R(1, 1, 4, 2, '#35546e'); R(1, 1, 2, 1, '#7fb0cf'); R(3, 4, 1, 1, oscuro);
  }));
  const frente = mat(lienzo(8, 6, (R) => {
    R(0, 0, 8, 6, color); R(1, 0, 6, 3, '#35546e'); R(1, 0, 3, 1, '#d4ecf7'); R(2, 1, 1, 1, '#7fb0cf');
    R(0, 4, 8, 1, oscuro); R(0, 4, 1, 1, '#fff4c2'); R(7, 4, 1, 1, '#fff4c2'); R(3, 5, 2, 1, '#2b2b2d');
  }));
  const techo = mat(lienzo(8, 6, (R) => { R(0, 0, 8, 6, claro); R(0, 5, 8, 1, color); }));
  const m = [lado, lado, techo, new THREE.MeshLambertMaterial({ color: '#2b2b2d' }), techo, frente];
  cabinas.set(color, m);
  return m;
}

const llanta = new THREE.MeshLambertMaterial({ color: '#202124' }), aro = new THREE.MeshLambertMaterial({ color: '#b9bec4' });
const rojo = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.25, 0.15) }), apagada = new THREE.MeshLambertMaterial({ color: '#7a2a22' });

// arma una camioneta. color: el de la cabina. C: la fisica (para poner las ruedas). Devuelve el grupo, sus ruedas y las luces de freno.
// El grupo tiene su origen en el centro de masa (como el auto de la fisica): el piso queda "alto" metros abajo.
export function armarFurgon(color, C) {
  const alto = C.resorteLargo + C.radio - C.masa * 9.81 / 4 / C.resorte - C.anclaje;
  const piso = -alto, grupo = new THREE.Group();
  // la caja atras, la cabina adelante (adelante es -z)
  const largo = CAJA + CABINA, z0 = -largo / 2 + (C.centro || 0);
  const mCaja = new THREE.Mesh(new THREE.BoxGeometry(ANCHO, ALTO_CAJA, CAJA), materialesCaja());
  mCaja.position.set(0, piso + PISO + ALTO_CAJA / 2, z0 + CABINA + CAJA / 2);
  const mCabina = new THREE.Mesh(new THREE.BoxGeometry(ANCHO * 0.97, ALTO_CABINA, CABINA), materialesCabina(color));
  mCabina.position.set(0, piso + PISO + ALTO_CABINA / 2, z0 + CABINA / 2);
  const paragolpes = new THREE.Mesh(new THREE.BoxGeometry(ANCHO, 0.22, 0.2), llanta);
  paragolpes.position.set(0, piso + PISO + 0.05, z0 - 0.05);
  for (const m of [mCaja, mCabina, paragolpes]) { m.castShadow = true; grupo.add(m); }
  // las luces de atras
  const frenos = [];
  for (const x of [-0.78, 0.78]) {
    const l = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.3), apagada);
    l.position.set(x, piso + PISO + 0.35, z0 + largo + 0.01);
    grupo.add(l); frenos.push(l);
  }
  // las ruedas: un pivote que dobla y adentro la rueda que gira
  const geo = new THREE.CylinderGeometry(C.radio, C.radio, 0.28, 10), geoAro = new THREE.CylinderGeometry(C.radio * 0.5, C.radio * 0.5, 0.3, 6);
  geo.rotateZ(Math.PI / 2); geoAro.rotateZ(Math.PI / 2);
  const ruedas = [];
  for (let i = 0; i < 4; i++) {
    const pivote = new THREE.Group(), rueda = new THREE.Group(), goma = new THREE.Mesh(geo, llanta);
    goma.castShadow = true;
    rueda.add(goma, new THREE.Mesh(geoAro, aro));
    pivote.add(rueda);
    pivote.position.set((i % 2 ? 1 : -1) * C.trocha * 1.06, piso + C.radio, (i < 2 ? -1 : 1) * C.ejes + (C.centro || 0));
    grupo.add(pivote);
    ruedas.push({ pivote, rueda });
  }
  return { grupo, ruedas, frenos, alto };
}

// la camioneta del que juega: sigue al auto de la fisica cuadro a cuadro
export function crearDibujoFurgon(escena, C, color) {
  const f = armarFurgon(color, C);
  escena.add(f.grupo);
  return {
    grupo: f.grupo,
    actualizar(c) {
      f.grupo.position.fromArray(c.pos);
      f.grupo.quaternion.fromArray(c.q);
      c.ruedas.forEach((r, i) => {
        f.ruedas[i].pivote.position.set(r.x * 1.06, C.anclaje - r.largo, r.z);
        f.ruedas[i].pivote.rotation.y = r.delantera ? -c.giroRuedas : 0;
        f.ruedas[i].rueda.rotation.x = -r.giro;
      });
      for (const l of f.frenos) l.material = c.frenando ? rojo : apagada;
    },
  };
}

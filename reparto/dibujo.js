// Reparto: dibuja el pueblo. El piso (calles, veredas, sendas, la plaza) es un solo dibujo de pocos pixeles (4 por metro,
// como el resto de Shakedown); las casas son cajas con una fachada que se repite; los semaforos cambian de color con el
// reloj del viaje; y el destino es una columna de luz con el icono del negocio.
import * as THREE from '../vendor/three.module.js';
import { tono } from '../src/pixel.js';
import { TAM, PASO, MANZANAS, CALLE, VEREDA, BORDE, PLAZA, SEMAFOROS, colorSemaforo } from './mapa.js';

const PX = 4;   // pixeles por metro en el piso
const REVOQUES = ['#e6dfcd', '#d9b36a', '#d8a48c', '#a9c3cc', '#b4cdb4', '#c9bfa8', '#e2c9a0', '#bfae9a'];
const ABERTURAS = ['#3f6a4a', '#6b4a36', '#35546e', '#8a3a2a', '#e9e4d6'];
const TECHOS = ['#8f9499', '#8a5a44', '#7d8a84', '#b5523a', '#96402c', '#cfc8b8'];
const LUZ = { verde: '#3fdc6a', amarillo: '#ffc21e', rojo: '#ff3b2a' };

const textura = (lienzo, repetir) => {
  const t = new THREE.CanvasTexture(lienzo);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  if (repetir) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
};
// un numero al azar fijo para cada punto (para salpicar el piso)
const ruido = (i, j) => { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - Math.floor(s); };

// --- el piso ---
function pintarPiso() {
  const X0 = -BORDE - 8, lado = TAM + 2 * (BORDE + 8), n = Math.round(lado * PX);
  const lienzo = document.createElement('canvas');
  lienzo.width = lienzo.height = n;
  const g = lienzo.getContext('2d');
  const R = (x, z, w, h, col) => { g.fillStyle = col; g.fillRect(Math.round((x - X0) * PX), Math.round((z - X0) * PX), Math.round(w * PX), Math.round(h * PX)); };
  // campo
  R(X0, X0, lado, lado, '#6f8f4a');
  // los fondos de las manzanas (patios con pasto y tierra) y la plaza
  for (let i = 0; i < MANZANAS; i++) for (let j = 0; j < MANZANAS; j++) {
    const plaza = i === PLAZA[0] && j === PLAZA[1];
    R(i * PASO, j * PASO, PASO, PASO, plaza ? '#5f8f3c' : '#7c8a52');
  }
  // salpicado: matitas y tierra
  const img = g.getImageData(0, 0, n, n), d = img.data;
  for (let k = 0; k < n * n; k++) {
    const v = ruido(k % n, Math.floor(k / n));
    if (v > 0.93) { d[k * 4] *= 0.85; d[k * 4 + 1] *= 0.88; d[k * 4 + 2] *= 0.85; }
    else if (v < 0.04) { d[k * 4] = Math.min(255, d[k * 4] * 1.12); d[k * 4 + 1] = Math.min(255, d[k * 4 + 1] * 1.08); }
  }
  g.putImageData(img, 0, 0);
  // los caminitos de la plaza: en cruz y en diagonal no (cruz y un cuadrado alrededor del monumento)
  const px0 = PLAZA[0] * PASO, pz0 = PLAZA[1] * PASO, mitad = PASO / 2;
  R(px0 + mitad - 1.2, pz0, 2.4, PASO, '#c9b48a'); R(px0, pz0 + mitad - 1.2, PASO, 2.4, '#c9b48a');
  R(px0 + mitad - 5, pz0 + mitad - 5, 10, 10, '#c9b48a');
  // veredas y calles (primero las veredas, despues el asfalto encima)
  for (let k = 0; k <= MANZANAS; k++) {
    const c = k * PASO;
    R(c - VEREDA, -VEREDA, 2 * VEREDA, TAM + 2 * VEREDA, '#b9b4a8');
    R(-VEREDA, c - VEREDA, TAM + 2 * VEREDA, 2 * VEREDA, '#b9b4a8');
  }
  // las baldosas de la vereda: una rayita cada metro
  g.fillStyle = 'rgba(0,0,0,.07)';
  for (let k = 0; k <= MANZANAS; k++) for (let u = -VEREDA; u < TAM + VEREDA; u += 1) {
    const c = k * PASO;
    g.fillRect(Math.round((c - VEREDA - X0) * PX), Math.round((u - X0) * PX), Math.round(2 * VEREDA * PX), 1);
    g.fillRect(Math.round((u - X0) * PX), Math.round((c - VEREDA - X0) * PX), 1, Math.round(2 * VEREDA * PX));
  }
  // el cordon
  for (let k = 0; k <= MANZANAS; k++) {
    const c = k * PASO;
    R(c - CALLE - 0.25, -CALLE, 2 * CALLE + 0.5, TAM + 2 * CALLE, '#8e8a80');
    R(-CALLE, c - CALLE - 0.25, TAM + 2 * CALLE, 2 * CALLE + 0.5, '#8e8a80');
  }
  for (let k = 0; k <= MANZANAS; k++) {
    const c = k * PASO;
    R(c - CALLE, -CALLE, 2 * CALLE, TAM + 2 * CALLE, '#4c4d52');
    R(-CALLE, c - CALLE, TAM + 2 * CALLE, 2 * CALLE, '#4c4d52');
  }
  // manchas y parches del asfalto
  for (let k = 0; k < 900; k++) {
    const a = ruido(k, 1), b = ruido(k, 2), vertical = ruido(k, 3) < 0.5, linea = Math.floor(ruido(k, 4) * (MANZANAS + 1)) * PASO;
    const u = -CALLE + a * (TAM + 2 * CALLE), w = (b - 0.5) * 2 * (CALLE - 0.6);
    const col = ruido(k, 5) < 0.5 ? '#46474c' : '#55565b';
    if (vertical) R(linea + w, u, 0.75, 0.5 + ruido(k, 6) * 1.5, col); else R(u, linea + w, 0.5 + ruido(k, 6) * 1.5, 0.75, col);
  }
  // la linea del medio (cortada) y las sendas peatonales en cada esquina
  for (let k = 0; k <= MANZANAS; k++) for (let m = 0; m < MANZANAS; m++) {
    const c = k * PASO, desde = m * PASO + VEREDA + 2.5, hasta = (m + 1) * PASO - VEREDA - 2.5;
    for (let u = desde; u < hasta - 1; u += 4) { R(c - 0.1, u, 0.2, 2, '#d8c27a'); R(u, c - 0.1, 2, 0.2, '#d8c27a'); }
  }
  for (let i = 0; i <= MANZANAS; i++) for (let j = 0; j <= MANZANAS; j++) {
    const x = i * PASO, z = j * PASO;
    for (let s = -CALLE + 0.4; s < CALLE - 0.4; s += 1) {
      // las cuatro sendas: arriba, abajo, izquierda y derecha de la esquina
      R(x + s, z - VEREDA, 0.55, 2.2, '#e9e4d6'); R(x + s, z + VEREDA - 2.2, 0.55, 2.2, '#e9e4d6');
      R(x - VEREDA, z + s, 2.2, 0.55, '#e9e4d6'); R(x + VEREDA - 2.2, z + s, 2.2, 0.55, '#e9e4d6');
    }
  }
  // las lineas de pare en las esquinas con semaforo (en la mano de cada uno: el que viene, del lado derecho)
  for (const S of SEMAFOROS) {
    R(S.x, S.z + VEREDA + 0.2, CALLE, 0.4, '#f1ede2');            // el que sube (viene del sur, por la derecha: x > eje)
    R(S.x - CALLE, S.z - VEREDA - 0.6, CALLE, 0.4, '#f1ede2');    // el que baja
    R(S.x + VEREDA + 0.2, S.z - CALLE, 0.4, CALLE, '#f1ede2');    // el que va al oeste (viene del este, por z < eje)
    R(S.x - VEREDA - 0.6, S.z, 0.4, CALLE, '#f1ede2');            // el que va al este
  }
  return { lienzo, X0, lado };
}

// --- una fachada: un piso de 4 m de ancho y 3 de alto con una ventana (o una puerta), que se repite ---
const fachadas = new Map();
function fachada(v) {
  const clave = v % 40;
  if (fachadas.has(clave)) return fachadas.get(clave);
  const pared = REVOQUES[clave % REVOQUES.length], abertura = ABERTURAS[Math.floor(clave / 8) % ABERTURAS.length];
  const l = document.createElement('canvas');
  l.width = 16; l.height = 12;
  const g = l.getContext('2d');
  const R = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  R(0, 0, 16, 12, pared);
  R(0, 11, 16, 1, tono(pared, -0.25));   // zocalo
  R(0, 0, 16, 1, tono(pared, 0.15));
  if (clave % 3) {   // ventana con postigos
    R(4, 3, 8, 6, '#f1ede2'); R(5, 4, 6, 4, '#22364a'); R(5, 4, 6, 1, '#35546e'); R(6, 5, 1, 1, '#7fb0cf');
    R(3, 3, 1, 6, abertura); R(12, 3, 1, 6, abertura);
  } else {          // puerta
    R(5, 3, 6, 8, tono(abertura, -0.1)); R(6, 4, 4, 3, abertura); R(9, 7, 1, 1, '#e0c070');
  }
  // manchas de humedad
  for (let k = 0; k < 6; k++) R(Math.floor(ruido(clave, k) * 16), Math.floor(ruido(k, clave) * 12), 1, 1, tono(pared, -0.08));
  const m = new THREE.MeshLambertMaterial({ map: textura(l, true) });
  fachadas.set(clave, m);
  return m;
}
const techos = TECHOS.map((c) => new THREE.MeshLambertMaterial({ color: c }));

// una caja con la fachada repetida cada 4 m de ancho y cada 3 m de alto
function casa(e) {
  const geo = new THREE.BoxGeometry(e.hx * 2, e.alto, e.hz * 2);
  const uv = geo.attributes.uv, W = e.hx * 2, D = e.hz * 2;
  for (let cara = 0; cara < 6; cara++) {
    if (cara === 2 || cara === 3) continue;
    const ancho = cara < 2 ? D : W;
    for (let k = 0; k < 4; k++) { const i = cara * 4 + k; uv.setXY(i, uv.getX(i) * Math.max(1, Math.round(ancho / 4)), uv.getY(i) * Math.max(1, Math.round(e.alto / 3))); }
  }
  const f = fachada(e.variante), t = techos[e.variante % techos.length];
  const m = new THREE.Mesh(geo, [f, f, t, t, f, f]);
  m.position.set(e.x, e.alto / 2, e.z);
  m.castShadow = m.receiveShadow = true;
  return m;
}

// el cartel de un negocio y su toldo, sobre la vereda
function cartel(e, d) {
  const grupo = new THREE.Group();
  const l = document.createElement('canvas');
  l.width = 160; l.height = 32;
  const g = l.getContext('2d');
  g.fillStyle = '#f1ede2'; g.fillRect(0, 0, 160, 32);
  g.fillStyle = d.color; g.fillRect(3, 3, 154, 26);
  g.fillStyle = '#f1ede2'; g.font = '700 20px "Atkinson Hyperlegible", "Segoe UI", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(d.nombre, 80, 17, 150);
  const plano = new THREE.Mesh(new THREE.PlaneGeometry(5, 1), new THREE.MeshBasicMaterial({ map: textura(l) }));
  // el frente de la casa mira a (nx, nz): el cartel va un poquito afuera, a 2,6 m de alto
  plano.position.set(e.frenteX + e.nx * 0.06, 2.6, e.frenteZ + e.nz * 0.06);
  plano.rotation.y = Math.atan2(e.nx, e.nz);
  grupo.add(plano);
  // el toldo
  const toldo = new THREE.Mesh(new THREE.BoxGeometry(e.nz ? 5 : 1.6, 0.15, e.nz ? 1.6 : 5), new THREE.MeshLambertMaterial({ color: d.color }));
  toldo.position.set(e.frenteX + e.nx * 0.8, 2.0, e.frenteZ + e.nz * 0.8);
  toldo.castShadow = true;
  grupo.add(toldo);
  // y en el techo, un cartel grande que se lee desde arriba (la camara mira de arriba)
  const arriba = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.2), new THREE.MeshBasicMaterial({ map: plano.material.map }));
  arriba.rotation.x = -Math.PI / 2;
  arriba.rotation.z = e.nz ? (e.nz > 0 ? Math.PI : 0) : (e.nx > 0 ? -Math.PI / 2 : Math.PI / 2);
  arriba.position.set(e.x, e.alto + 0.05, e.z);
  grupo.add(arriba);
  return grupo;
}

// un icono (emoji) en un dibujo, para los carteles que flotan
export function iconoTextura(txt) {
  const l = document.createElement('canvas');
  l.width = l.height = 96;
  const g = l.getContext('2d');
  g.fillStyle = 'rgba(20,22,26,.78)'; g.beginPath(); g.arc(48, 48, 44, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#ffd23a'; g.lineWidth = 5; g.stroke();
  g.font = '52px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(txt, 48, 52);
  const t = new THREE.CanvasTexture(l);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function crearDibujoPueblo(escena, mapa, liviano) {
  // --- luz: una tarde de sol ---
  escena.background = new THREE.Color('#9fc4dc');
  escena.fog = new THREE.Fog('#9fc4dc', 220, 520);
  const cielo = new THREE.HemisphereLight('#dbe9f5', '#7a6e58', 1.5);
  escena.add(cielo);
  const sol = new THREE.DirectionalLight('#fff1d6', 2.2);
  sol.castShadow = true;
  sol.shadow.mapSize.set(liviano ? 1024 : 2048, liviano ? 1024 : 2048);
  const S = sol.shadow.camera;
  S.left = -70; S.right = 70; S.top = 70; S.bottom = -70; S.near = 1; S.far = 400;
  sol.shadow.bias = -0.0008;
  escena.add(sol, sol.target);
  const haciaElSol = new THREE.Vector3(-0.5, 1, 0.35).normalize();

  // --- el piso ---
  const p = pintarPiso();
  const piso = new THREE.Mesh(new THREE.PlaneGeometry(p.lado, p.lado), new THREE.MeshLambertMaterial({ map: textura(p.lienzo) }));
  piso.rotation.x = -Math.PI / 2;
  piso.position.set(p.X0 + p.lado / 2, 0, p.X0 + p.lado / 2);
  piso.receiveShadow = true;
  escena.add(piso);

  // --- las casas y los negocios ---
  for (const e of mapa.edificios) escena.add(casa(e));
  for (const d of mapa.destinos) escena.add(cartel(d.edificio, d));

  // --- la plaza ---
  const tronco = new THREE.MeshLambertMaterial({ color: '#6b4a36' }), copas = ['#4f7a3a', '#5f8f3c', '#3f6a34'].map((c) => new THREE.MeshLambertMaterial({ color: c, flatShading: true }));
  for (const [k, a] of mapa.arboles.entries()) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.5, a.alto * 0.45, 0.5), tronco);
    t.position.set(a.x, a.alto * 0.225, a.z); t.castShadow = true;
    const c = new THREE.Mesh(new THREE.IcosahedronGeometry(a.alto * 0.36, 0), copas[k % 3]);
    c.position.set(a.x, a.alto * 0.62, a.z); c.castShadow = true;
    escena.add(t, c);
  }
  const piedra = new THREE.MeshLambertMaterial({ color: '#cfc8b8' });
  const base = new THREE.Mesh(new THREE.BoxGeometry(4, 1.2, 4), piedra), aguja = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.9, 7, 4), piedra);
  base.position.set(mapa.monumento.x, 0.6, mapa.monumento.z); aguja.position.set(mapa.monumento.x, 4.6, mapa.monumento.z);
  base.castShadow = aguja.castShadow = true;
  escena.add(base, aguja);

  // --- el paredon de afuera ---
  const ladrillo = new THREE.MeshLambertMaterial({ color: '#a8735a' });
  for (const o of mapa.cosas) if (o.clase === 'edificio' && (o.hx > 100 || o.hz > 100)) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(o.hx * 2, 2.2, o.hz * 2), ladrillo);
    m.position.set(o.x, 1.1, o.z); m.castShadow = true;
    escena.add(m);
  }

  // --- los semaforos: un poste en cada esquina, mirando al que viene por la derecha ---
  const poste = new THREE.MeshLambertMaterial({ color: '#2b2d31' });
  const luces = [];
  for (const s of SEMAFOROS) {
    const mat = { ns: new THREE.MeshBasicMaterial({ color: LUZ.verde }), eo: new THREE.MeshBasicMaterial({ color: LUZ.rojo }) };
    luces.push({ s, mat });
    // [esquina x, esquina z, eje que mira]
    for (const [sx, sz, eje] of [[1, 1, 'ns'], [-1, -1, 'ns'], [1, -1, 'eo'], [-1, 1, 'eo']]) {
      const x = s.x + sx * (CALLE + 1.2), z = s.z + sz * (CALLE + 1.2);
      const palo = new THREE.Mesh(new THREE.BoxGeometry(0.18, 4.2, 0.18), poste);
      palo.position.set(x, 2.1, z); palo.castShadow = true;
      const cabeza = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.3, 0.55), poste);
      cabeza.position.set(x, 4.5, z);
      // la luz: arriba de la cabeza (se ve desde la camara alta) y de frente
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.4, 0.7), mat[eje]);
      lamp.position.set(x, 5.35, z);
      escena.add(palo, cabeza, lamp);
    }
  }

  // --- el destino: una columna de luz, un anillo en el piso y el icono del negocio flotando ---
  const destino = new THREE.Group();
  const columna = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.6, 7, 24, 1, true), new THREE.MeshBasicMaterial({ color: '#ffd23a', transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }));
  columna.position.y = 3.5;
  const anillo = new THREE.Mesh(new THREE.RingGeometry(3.2, 3.8, 32), new THREE.MeshBasicMaterial({ color: '#ffd23a', transparent: true, opacity: 0.9, depthWrite: false }));
  anillo.rotation.x = -Math.PI / 2; anillo.position.y = 0.03;
  const icono = new THREE.Sprite(new THREE.SpriteMaterial({ depthTest: false, transparent: true }));
  icono.scale.set(3, 3, 1); icono.position.y = 9; icono.renderOrder = 6;
  destino.add(columna, anillo, icono);
  escena.add(destino);
  const iconos = new Map();

  // --- la flecha sobre el auto, que apunta al destino ---
  const flecha = new THREE.Mesh(new THREE.ConeGeometry(0.7, 2, 3), new THREE.MeshBasicMaterial({ color: '#ffd23a', depthTest: false, transparent: true, opacity: 0.95 }));
  flecha.renderOrder = 7;
  escena.add(flecha);
  const ARRIBA = new THREE.Vector3(0, 1, 0), HACIA = new THREE.Vector3();

  return {
    // pone el destino del viaje
    destino: (d) => {
      destino.position.set(d.x, 0, d.z);
      if (!iconos.has(d.n)) iconos.set(d.n, iconoTextura(d.icono));
      icono.material.map = iconos.get(d.n); icono.material.needsUpdate = true;
    },
    // una vez por cuadro: los semaforos, el destino que late, la flecha y la sombra que sigue al auto
    actualizar: (t, reloj, c, d) => {
      for (const { s, mat } of luces) { mat.ns.color.set(LUZ[colorSemaforo(s, 'ns', reloj)]); mat.eo.color.set(LUZ[colorSemaforo(s, 'eo', reloj)]); }
      columna.material.opacity = 0.16 + 0.1 * Math.sin(t * 4);
      icono.position.y = 9 + Math.sin(t * 2.5) * 0.4;
      const dx = d.x - c.pos[0], dz = d.z - c.pos[2], lejos = Math.hypot(dx, dz);
      flecha.visible = lejos > 9;
      flecha.position.set(c.pos[0] + dx / lejos * 3.2, c.pos[1] + 3.4, c.pos[2] + dz / lejos * 3.2);
      HACIA.set(dx / lejos, 0, dz / lejos);
      flecha.quaternion.setFromUnitVectors(ARRIBA, HACIA);
      sol.target.position.set(c.pos[0], 0, c.pos[2]);
      sol.position.copy(sol.target.position).addScaledVector(haciaElSol, 200);
    },
  };
}

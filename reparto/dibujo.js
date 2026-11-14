// Reparto: dibuja el pueblo. El piso (calles, veredas, sendas, bahias, la plaza) es un solo dibujo de pocos pixeles
// (4 por metro, como el resto de Shakedown); las casas son cajas con una fachada que se repite; los semaforos cambian de
// color con el reloj del viaje; y el destino es una columna de luz con el icono del negocio.
import * as THREE from '../vendor/three.module.js';
import { tono } from '../src/pixel.js';
import { TAM, VEREDA, BORDE, PLAZA, CALLES, SEMAFOROS, colorSemaforo, aCalle } from './mapa.js';

const PX = 4;   // pixeles por metro en el piso
const REVOQUES = ['#e6dfcd', '#d9b36a', '#d8a48c', '#a9c3cc', '#b4cdb4', '#c9bfa8', '#e2c9a0', '#bfae9a'];
const ABERTURAS = ['#3f6a4a', '#6b4a36', '#35546e', '#8a3a2a', '#e9e4d6'];
const TECHOS = ['#8f9499', '#8a5a44', '#7d8a84', '#b5523a', '#96402c', '#cfc8b8'];
const LUZ = { verde: '#3fdc6a', amarillo: '#ffc21e', rojo: '#ff3b2a' };
const ASFALTO = '#4c4d52', BALDOSA = '#b9b4a8';

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

// Para cada esquina y cada calle que sale de ella: hasta donde llega el cruce (de ahi para afuera va la senda peatonal).
// Se avanza por la calle hasta que sus dos bordes quedan afuera del asfalto de las otras calles de esa esquina.
function bocas(red) {
  const lista = [];
  for (const n of red.nodos) {
    if (n.calles.length < 2) continue;
    for (const v of n.vecinos) {
      const s = v.calle, ux = (v.n.x - n.x) / v.largo, uz = (v.n.z - n.z) / v.largo, px = -uz, pz = ux;
      let d = 0;
      for (; d < 20; d += 0.25) {
        let libre = true;
        for (const o of n.calles) {
          if (o === s) continue;
          for (const k of [-1, 1]) if (aCalle(o, n.x + ux * d + px * s.m * k, n.z + uz * d + pz * s.m * k).d < o.m + 0.3) libre = false;
        }
        if (libre) break;
      }
      lista.push({ n, s, ux, uz, px, pz, d });
    }
  }
  return lista;
}

// --- el piso ---
function pintarPiso(mapa) {
  const X0 = -BORDE - 8, lado = TAM + 2 * (BORDE + 8), n = Math.round(lado * PX);
  const lienzo = document.createElement('canvas');
  lienzo.width = lienzo.height = n;
  const g = lienzo.getContext('2d');
  g.setTransform(PX, 0, 0, PX, -X0 * PX, -X0 * PX);   // de aca en adelante se dibuja en metros del mundo
  g.imageSmoothingEnabled = false;
  const R = (x, z, w, h, col) => { g.fillStyle = col; g.fillRect(x, z, w, h); };
  // un rectangulo girado: centro, medio largo a lo largo de (ux, uz), medio ancho de costado
  const girado = (x, z, hx, hz, ux, uz, col) => { g.save(); g.translate(x, z); g.transform(ux, uz, -uz, ux, 0, 0); R(-hx, -hz, 2 * hx, 2 * hz, col); g.restore(); };
  const linea = (s, ancho, col, corrido = 0, raya = null) => {
    const px = -s.uz * corrido, pz = s.ux * corrido;
    g.beginPath(); g.moveTo(s.x1 + px, s.z1 + pz); g.lineTo(s.x2 + px, s.z2 + pz);
    g.lineWidth = ancho; g.strokeStyle = col; g.setLineDash(raya || []); g.lineCap = raya ? 'butt' : 'round'; g.stroke();
  };
  // campo, patios y plaza
  R(X0, X0, lado, lado, '#6f8f4a');
  R(0, 0, TAM, TAM, '#7c8a52');
  R(PLAZA.x0, PLAZA.z0, PLAZA.x1 - PLAZA.x0, PLAZA.z1 - PLAZA.z0, '#5f8f3c');
  // salpicado: matitas y tierra
  g.setTransform(1, 0, 0, 1, 0, 0);
  const img = g.getImageData(0, 0, n, n), d = img.data;
  for (let k = 0; k < n * n; k++) {
    const v = ruido(k % n, Math.floor(k / n));
    if (v > 0.93) { d[k * 4] *= 0.85; d[k * 4 + 1] *= 0.88; d[k * 4 + 2] *= 0.85; }
    else if (v < 0.04) { d[k * 4] = Math.min(255, d[k * 4] * 1.12); d[k * 4 + 1] = Math.min(255, d[k * 4 + 1] * 1.08); }
  }
  g.putImageData(img, 0, 0);
  g.setTransform(PX, 0, 0, PX, -X0 * PX, -X0 * PX);
  // los caminitos de la plaza
  const pcx = (PLAZA.x0 + PLAZA.x1) / 2, pcz = (PLAZA.z0 + PLAZA.z1) / 2;
  R(pcx - 1.2, PLAZA.z0, 2.4, PLAZA.z1 - PLAZA.z0, '#c9b48a'); R(PLAZA.x0, pcz - 1.2, PLAZA.x1 - PLAZA.x0, 2.4, '#c9b48a');
  R(pcx - 5, pcz - 5, 10, 10, '#c9b48a');
  // veredas, cordon y asfalto (en ese orden: cada uno tapa al anterior)
  for (const s of CALLES) linea(s, 2 * (s.m + VEREDA), BALDOSA);
  for (const s of CALLES) for (let u = 1; u < s.L; u += 1) {   // las juntas de las baldosas, cada metro
    for (const k of [-1, 1]) girado(s.x1 + s.ux * u - s.uz * k * (s.m + VEREDA / 2), s.z1 + s.uz * u + s.ux * k * (s.m + VEREDA / 2), 0.06, VEREDA / 2, s.ux, s.uz, 'rgba(0,0,0,.07)');
  }
  for (const s of CALLES) linea(s, 2 * s.m + 0.5, '#8e8a80');
  for (const s of CALLES) linea(s, 2 * s.m, ASFALTO);
  // manchas y parches del asfalto
  for (let k = 0; k < 700; k++) {
    const s = CALLES[Math.floor(ruido(k, 4) * CALLES.length)], u = ruido(k, 1) * s.L, w = (ruido(k, 2) - 0.5) * 2 * (s.m - 0.6);
    girado(s.x1 + s.ux * u - s.uz * w, s.z1 + s.uz * u + s.ux * w, 0.3 + ruido(k, 6) * 0.8, 0.35, s.ux, s.uz, ruido(k, 5) < 0.5 ? '#46474c' : '#55565b');
  }
  // las lineas: en las calles, una cortada amarilla al medio; en las avenidas, doble amarilla y los carriles blancos
  for (const s of CALLES) {
    if (s.m >= 7) { linea(s, 0.18, '#d8c27a', 0.25); linea(s, 0.18, '#d8c27a', -0.25); linea(s, 0.18, '#e9e4d6', s.m / 2, [2, 3]); linea(s, 0.18, '#e9e4d6', -s.m / 2, [2, 3]); }
    else linea(s, 0.2, '#d8c27a', 0, [2, 2]);
  }
  // los cruces, limpios (asfalto encima de las lineas), y las sendas peatonales de cada boca
  const B = bocas(mapa.red);
  for (const b of B) girado(b.n.x + b.ux * b.d / 2, b.n.z + b.uz * b.d / 2, b.d / 2 + 0.05, b.s.m, b.ux, b.uz, ASFALTO);
  for (const b of B) {
    if (b.d <= 0) continue;
    for (let w = -b.s.m + 0.6; w < b.s.m - 0.4; w += 1) girado(b.n.x + b.ux * (b.d + 1.2) + b.px * w, b.n.z + b.uz * (b.d + 1.2) + b.pz * w, 1.1, 0.27, b.ux, b.uz, '#e9e4d6');
  }
  // las lineas de pare en las esquinas con semaforo: del lado derecho del que llega, antes de la senda
  for (const S of SEMAFOROS) for (const b of B) {
    if (Math.hypot(b.n.x - S.x, b.n.z - S.z) > 1) continue;
    const derecha = -1;   // el que llega va hacia -u: su derecha es -p
    girado(b.n.x + b.ux * (b.d + 2.8) + b.px * derecha * b.s.m / 2, b.n.z + b.uz * (b.d + 2.8) + b.pz * derecha * b.s.m / 2, 0.22, b.s.m / 2, b.ux, b.uz, '#f1ede2');
  }
  // las bahias de los negocios: asfalto sobre la vereda, con el borde pintado y rayas amarillas de carga y descarga
  for (const dd of mapa.destinos) {
    const b = dd.bahia;
    girado(b.x, b.z, b.hx + 0.25, b.hz, b.ux, b.uz, '#8e8a80');
    girado(b.x, b.z, b.hx, b.hz, b.ux, b.uz, '#55565b');
    for (const k of [-1, 1]) girado(b.x + b.ux * k * (b.hx - 0.1), b.z + b.uz * k * (b.hx - 0.1), 0.1, b.hz, b.ux, b.uz, '#f1ede2');
    for (let u = -b.hx + 0.8; u < b.hx - 0.5; u += 1.2) girado(b.x + b.ux * u, b.z + b.uz * u, 0.18, b.hz * 0.6, b.ux, b.uz, '#d8b23a');
  }
  return { lienzo, X0, lado, bocas: B };
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
  for (let k = 0; k < 6; k++) R(Math.floor(ruido(clave, k) * 16), Math.floor(ruido(k, clave) * 12), 1, 1, tono(pared, -0.08));   // humedad
  const m = new THREE.MeshLambertMaterial({ map: textura(l, true) });
  fachadas.set(clave, m);
  return m;
}
const techos = TECHOS.map((c) => new THREE.MeshLambertMaterial({ color: c }));

// una casa: una caja girada como su calle, con la fachada repetida cada 4 m de ancho y cada 3 m de alto
function casa(e) {
  const W = e.hx * 2, D = e.hz * 2, geo = new THREE.BoxGeometry(W, e.alto, D), uv = geo.attributes.uv;
  for (let cara = 0; cara < 6; cara++) {
    if (cara === 2 || cara === 3) continue;
    const ancho = cara < 2 ? D : W;
    for (let k = 0; k < 4; k++) { const i = cara * 4 + k; uv.setXY(i, uv.getX(i) * Math.max(1, Math.round(ancho / 4)), uv.getY(i) * Math.max(1, Math.round(e.alto / 3))); }
  }
  const f = fachada(e.variante), t = techos[e.variante % techos.length];
  const m = new THREE.Mesh(geo, [f, f, t, t, f, f]);
  m.position.set(e.x, e.alto / 2, e.z);
  m.rotation.y = -Math.atan2(e.uz, e.ux);   // (el largo de la caja, su x, a lo largo de la calle)
  m.castShadow = m.receiveShadow = true;
  return m;
}

// el cartel de un negocio y su toldo, sobre la bahia
function cartel(e, d) {
  const grupo = new THREE.Group();
  const l = document.createElement('canvas');
  l.width = 160; l.height = 32;
  const g = l.getContext('2d');
  g.fillStyle = '#f1ede2'; g.fillRect(0, 0, 160, 32);
  g.fillStyle = d.color; g.fillRect(3, 3, 154, 26);
  g.fillStyle = '#f1ede2'; g.font = '700 20px "Atkinson Hyperlegible", "Segoe UI", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(d.nombre, 80, 17, 150);
  const tex = textura(l);
  const plano = new THREE.Mesh(new THREE.PlaneGeometry(5, 1), new THREE.MeshBasicMaterial({ map: tex }));
  // el frente de la casa mira a (nx, nz): el cartel va un poquito afuera, a 3,6 m de alto (arriba de la camioneta estacionada)
  plano.position.set(e.frenteX + e.nx * 0.06, 3.6, e.frenteZ + e.nz * 0.06);
  plano.rotation.y = Math.atan2(e.nx, e.nz);
  grupo.add(plano);
  const toldo = new THREE.Mesh(new THREE.BoxGeometry(5, 0.15, 1.4), new THREE.MeshLambertMaterial({ color: d.color }));
  toldo.position.set(e.frenteX + e.nx * 0.7, 2.9, e.frenteZ + e.nz * 0.7);
  toldo.rotation.y = -Math.atan2(e.uz, e.ux);
  toldo.castShadow = true;
  grupo.add(toldo);
  // y en el techo, un cartel grande que se lee desde arriba (la camara mira de arriba)
  const arriba = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.2), new THREE.MeshBasicMaterial({ map: tex }));
  arriba.rotation.set(-Math.PI / 2, 0, Math.atan2(-e.uz, e.ux), 'XYZ');
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
  escena.add(new THREE.HemisphereLight('#dbe9f5', '#7a6e58', 1.5));
  const sol = new THREE.DirectionalLight('#fff1d6', 2.2);
  sol.castShadow = true;
  sol.shadow.mapSize.set(liviano ? 1024 : 2048, liviano ? 1024 : 2048);
  const S = sol.shadow.camera;
  S.left = -70; S.right = 70; S.top = 70; S.bottom = -70; S.near = 1; S.far = 400;
  sol.shadow.bias = -0.0008;
  escena.add(sol, sol.target);
  const haciaElSol = new THREE.Vector3(-0.5, 1, 0.35).normalize();

  // --- el piso ---
  const p = pintarPiso(mapa);
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

  // --- los semaforos: en cada boca de la esquina, un poste del lado derecho del que llega ---
  const poste = new THREE.MeshLambertMaterial({ color: '#2b2d31' });
  const luces = [];
  for (const s of SEMAFOROS) {
    const mat = { ns: new THREE.MeshBasicMaterial({ color: LUZ.verde }), eo: new THREE.MeshBasicMaterial({ color: LUZ.rojo }) };
    luces.push({ s, mat });
    for (const b of p.bocas) {
      if (Math.hypot(b.n.x - s.x, b.n.z - s.z) > 1) continue;
      const eje = Math.abs(b.uz) > Math.abs(b.ux) ? 'ns' : 'eo';
      const x = b.n.x + b.ux * (b.d + 0.5) - b.px * (b.s.m + 1.2), z = b.n.z + b.uz * (b.d + 0.5) - b.pz * (b.s.m + 1.2);
      const palo = new THREE.Mesh(new THREE.BoxGeometry(0.18, 4.2, 0.18), poste);
      palo.position.set(x, 2.1, z); palo.castShadow = true;
      const cabeza = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.3, 0.55), poste);
      cabeza.position.set(x, 4.5, z);
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.4, 0.7), mat[eje]);   // la luz: arriba (se ve desde la camara alta)
      lamp.position.set(x, 5.35, z);
      escena.add(palo, cabeza, lamp);
    }
  }

  // --- el destino: una columna de luz, un rectangulo en la bahia y el icono del negocio flotando ---
  const destino = new THREE.Group();
  const columna = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 2.8, 7, 24, 1, true), new THREE.MeshBasicMaterial({ color: '#ffd23a', transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }));
  columna.position.y = 3.5;
  const marco = new THREE.Mesh(new THREE.RingGeometry(2.4, 2.9, 32), new THREE.MeshBasicMaterial({ color: '#ffd23a', transparent: true, opacity: 0.9, depthWrite: false }));
  marco.rotation.x = -Math.PI / 2; marco.position.y = 0.03;
  const icono = new THREE.Sprite(new THREE.SpriteMaterial({ depthTest: false, transparent: true }));
  icono.scale.set(3, 3, 1); icono.position.y = 9; icono.renderOrder = 6;
  destino.add(columna, marco, icono);
  escena.add(destino);
  const iconos = new Map();

  // --- la flecha sobre la camioneta, que apunta al destino ---
  const flecha = new THREE.Mesh(new THREE.ConeGeometry(0.7, 2, 3), new THREE.MeshBasicMaterial({ color: '#ffd23a', depthTest: false, transparent: true, opacity: 0.95 }));
  flecha.renderOrder = 7;
  escena.add(flecha);
  const ARRIBA = new THREE.Vector3(0, 1, 0), HACIA = new THREE.Vector3();

  return {
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
      const dx = d.x - c.pos[0], dz = d.z - c.pos[2], lejos = Math.hypot(dx, dz) || 1;
      flecha.visible = lejos > 9;
      flecha.position.set(c.pos[0] + dx / lejos * 3.4, c.pos[1] + 4.2, c.pos[2] + dz / lejos * 3.4);
      HACIA.set(dx / lejos, 0, dz / lejos);
      flecha.quaternion.setFromUnitVectors(ARRIBA, HACIA);
      sol.target.position.set(c.pos[0], 0, c.pos[2]);
      sol.position.copy(sol.target.position).addScaledVector(haciaElSol, 200);
    },
  };
}

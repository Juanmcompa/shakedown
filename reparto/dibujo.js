// Reparto: dibuja el pueblo. El piso (calles, veredas, sendas, bahias, la plaza) es un solo dibujo de pocos pixeles
// (4 por metro, como el resto de Shakedown); las casas son cajas con una fachada que se repite; los semaforos cambian de
// color con el reloj del viaje; y el destino es una columna de luz con el icono del negocio.
import * as THREE from '../vendor/three.module.js';
import { tono } from '../src/pixel.js';
import { crearPueblo } from '../src/pueblo.js';
import { crearLoteDeArboles } from '../src/arboles.js';
import { lienzoDePiso } from '../src/arte.js';
import { TAM, XMAX, ZMAX, LIMITE, ABRE, VEREDA, BORDE, PLAZA, CALLES, SEMAFOROS, DEPOSITOS, ROTONDAS, colorSemaforo, aCalle } from './mapa.js';

const rotondaEn = (n) => ROTONDAS.find((q) => Math.hypot(q.x - n.x, q.z - n.z) < 1);

const PX = 4;   // pixeles por metro en el piso: 4, como en Shakedown (un pixel = 25 cm), para que sus dibujos de piso se vean nitidos
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

// Para cada esquina y cada calle que sale de ella: hasta donde llega el cruce (de ahi para afuera va la senda peatonal).
// Se avanza por la calle hasta que sus dos bordes quedan afuera del asfalto de las otras calles de esa esquina (en una
// rotonda: hasta afuera del anillo).
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
      const q = rotondaEn(n);
      if (q) d = Math.max(d, q.ro + 0.2);
      lista.push({ n, s, ux, uz, px, pz, d, rotonda: q });
    }
  }
  return lista;
}

// --- el piso ---
function pintarPiso(mapa) {
  const X0 = -BORDE - 8, ladoX = XMAX + 2 * (BORDE + 8), ladoZ = ZMAX + 2 * (BORDE + 8), lado = Math.max(ladoX, ladoZ);
  const nx = Math.round(ladoX * PX), nz = Math.round(ladoZ * PX), n = nx;
  const lienzo = document.createElement('canvas');
  lienzo.width = nx; lienzo.height = nz;
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
  // Los pisos son los dibujos de Shakedown (64 x 64 pixeles = 16 m), repetidos: pasto, el piso de debajo de los arboles
  // (en los fondos de las manzanas), un manchon de pasto alto, baldosas de vereda y asfalto.
  const patron = (nombre, semilla) => { const t = g.createPattern(lienzoDePiso(nombre, semilla), 'repeat'); t.setTransform(new DOMMatrix().scale(16 / 64)); return t; };
  const PASTO = patron('pasto', 104), FONDO = patron('monteCampo', 121), MANCHON = patron('manchonCampo', 122), BALDOSA = patron('vereda', 109), ASFALTO = patron('asfalto', 100);
  // campo, fondos de las manzanas y plaza
  R(X0, X0, lado, lado, PASTO);
  R(0, 0, XMAX, ZMAX, FONDO);
  for (let k = 0; k < 160; k++) {   // manchones de pasto alto, para romper lo parejo
    const x = X0 + ruido(k, 11) * lado, z = X0 + ruido(k, 12) * lado, rr = 4 + ruido(k, 13) * 9;
    g.beginPath(); g.arc(x, z, rr, 0, Math.PI * 2); g.fillStyle = MANCHON; g.fill();
  }
  R(PLAZA.x0, PLAZA.z0, PLAZA.x1 - PLAZA.x0, PLAZA.z1 - PLAZA.z0, PASTO);
  // los caminitos de la plaza
  const pcx = (PLAZA.x0 + PLAZA.x1) / 2, pcz = (PLAZA.z0 + PLAZA.z1) / 2;
  R(pcx - 1.2, PLAZA.z0, 2.4, PLAZA.z1 - PLAZA.z0, '#c9b48a'); R(PLAZA.x0, pcz - 1.2, PLAZA.x1 - PLAZA.x0, 2.4, '#c9b48a');
  R(pcx - 5, pcz - 5, 10, 10, '#c9b48a');
  // veredas, cordon y asfalto (en ese orden: cada uno tapa al anterior)
  const disco = (q, radio, col) => { g.beginPath(); g.arc(q.x, q.z, radio, 0, Math.PI * 2); g.fillStyle = col; g.fill(); };
  for (const s of CALLES) linea(s, 2 * (s.m + VEREDA), BALDOSA);
  for (const q of ROTONDAS) disco(q, q.ro + VEREDA, BALDOSA);
  for (const s of CALLES) linea(s, 2 * s.m + 0.5, '#8e8a80');
  for (const q of ROTONDAS) disco(q, q.ro + 0.25, '#8e8a80');
  for (const s of CALLES) linea(s, 2 * s.m, ASFALTO);
  for (const q of ROTONDAS) disco(q, q.ro, ASFALTO);
  // las lineas: en las calles, una cortada amarilla al medio; en las avenidas, doble amarilla y los carriles blancos
  for (const s of CALLES) {
    if (s.m >= 7) { linea(s, 0.18, '#d8c27a', 0.25); linea(s, 0.18, '#d8c27a', -0.25); linea(s, 0.18, '#e9e4d6', s.m / 2, [2, 3]); linea(s, 0.18, '#e9e4d6', -s.m / 2, [2, 3]); }
    else linea(s, 0.2, '#d8c27a', 0, [2, 2]);
  }
  // los cruces, limpios (asfalto encima de las lineas), y las sendas peatonales de cada boca
  const B = bocas(mapa.red);
  for (const b of B) girado(b.n.x + b.ux * b.d / 2, b.n.z + b.uz * b.d / 2, b.d / 2 + 0.05, b.s.m, b.ux, b.uz, ASFALTO);
  // las rotondas: el anillo limpio, la isla del medio (pasto con cordon blanco) y, en cada boca, los triangulos de ceda el
  // paso del lado del que entra (el que ya gira en la rotonda tiene prioridad)
  for (const q of ROTONDAS) {
    disco(q, q.ro, ASFALTO);
    g.beginPath(); g.arc(q.x, q.z, (q.ri + q.ro) / 2 + 0.6, 0, Math.PI * 2); g.lineWidth = 0.15; g.strokeStyle = 'rgba(233,228,214,.55)'; g.setLineDash([2, 2]); g.stroke(); g.setLineDash([]);
    disco(q, q.ri + 0.35, '#e9e4d6');
    disco(q, q.ri, PASTO);
  }
  for (const b of B) {
    if (!b.rotonda) continue;
    for (let w = 0.3; w < b.s.m - 0.5; w += 1.1) {
      const x = b.n.x + b.ux * (b.d + 3.0) - b.px * w, z = b.n.z + b.uz * (b.d + 3.0) - b.pz * w;   // (despues de la senda)
      g.fillStyle = '#f1ede2'; g.beginPath();
      g.moveTo(x - b.px * 0.45, z - b.pz * 0.45); g.lineTo(x + b.px * 0.45, z + b.pz * 0.45); g.lineTo(x + b.ux * 0.9, z + b.uz * 0.9); g.fill();   // (la punta mira al que llega)
    }
  }
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
    if (!b) continue;
    girado(b.x, b.z, b.hx + 0.25, b.hz, b.ux, b.uz, '#8e8a80');
    girado(b.x, b.z, b.hx, b.hz, b.ux, b.uz, '#55565b');
    for (const k of [-1, 1]) girado(b.x + b.ux * k * (b.hx - 0.1), b.z + b.uz * k * (b.hx - 0.1), 0.1, b.hz, b.ux, b.uz, '#f1ede2');
    for (let u = -b.hx + 0.8; u < b.hx - 0.5; u += 1.2) girado(b.x + b.ux * u, b.z + b.uz * u, 0.18, b.hz * 0.6, b.ux, b.uz, '#d8b23a');
  }
  // texto pintado en el piso (en metros), girado "rot" (0: se lee desde la calle; pi: desde adentro)
  const texto = (t, x, z, alto, col, rot = 0) => {
    g.save(); g.translate(x, z); g.rotate(rot);
    g.font = '700 ' + alto + 'px "Atkinson Hyperlegible", "Segoe UI", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = col; g.fillText(t, 0, 0); g.restore();
  };
  // una flecha pintada: centro, hacia donde apunta (angulo en el dibujo: 0 = +x, -pi/2 = hacia el deposito), largo y ancho
  const flecha = (x, z, ang, largo, ancho, col) => {
    g.save(); g.translate(x, z); g.rotate(ang); g.fillStyle = col;
    g.fillRect(-largo / 2, -ancho / 4, largo - ancho, ancho / 2);
    g.beginPath(); g.moveTo(largo / 2, 0); g.lineTo(largo / 2 - ancho, -ancho / 2); g.lineTo(largo / 2 - ancho, ancho / 2); g.closePath(); g.fill();
    g.restore();
  };
  const raya = (x1, z1, x2, z2, ancho, col, guiones) => { g.beginPath(); g.moveTo(x1, z1); g.lineTo(x2, z2); g.lineWidth = ancho; g.strokeStyle = col; g.setLineDash(guiones || []); g.lineCap = 'butt'; g.stroke(); g.setLineDash([]); };
  // las paradas de colectivo: la bahia dice COLECTIVOS; la terminal y la base de taxis, su nombre
  for (const dd of mapa.destinos) {
    if (!dd.bahia || !(dd.parada || dd.terminal || dd.base)) continue;
    const b = dd.bahia;
    texto(dd.parada ? 'COLECTIVOS' : dd.terminal ? 'TERMINAL' : 'TAXIS', b.x, b.z, 1.1, '#f1ede2', Math.atan2(b.uz, b.ux));
  }
  // --- el playon de cada deposito: cemento, con todo pintado para que se entienda como se circula ---
  for (const D of DEPOSITOS) {
    const zq = D.quiebre, mitad = (D.x0 + D.x1) / 2;
    R(D.x0, D.zAnden, D.x1 - D.x0, D.z1 - D.zAnden, '#8f8c86');
    for (let x = D.x0; x < D.x1; x += 4) R(x, D.zAnden, 0.08, D.z1 - D.zAnden, 'rgba(0,0,0,.08)');
    for (let z = D.zAnden; z < D.z1; z += 4) R(D.x0, z, D.x1 - D.x0, 0.08, 'rgba(0,0,0,.08)');
    // las dos bocas: el cemento cruza la vereda hasta el cordon
    for (const [a, b] of [D.entrada, D.salida]) R(a, D.z1, b - a, VEREDA + 0.05, '#9a968f');
    // el cordon pintado de amarillo 5 m a cada lado de la entrada (que nadie estacione ahi y les cierre el giro a los camiones)
    for (const x of [D.entrada[0] - 5, D.entrada[1]]) R(x, D.z1 + VEREDA - 0.15, 5, 0.4, '#e0b21e');
    // las darsenas: una por porton, con su numero grande, hasta la linea de quiebre
    const portones = mapa.destinos.filter((dd) => dd.deposito && dd.dep === D);
    for (const dd of portones) {
      R(dd.x - 2.4, D.zAnden, 4.8, 0.5, '#d8b23a');
      texto(String(dd.anden + 1), dd.x, zq - 4, 3.2, '#f1ede2');
    }
    for (let i = 0; i <= portones.length; i++) {
      const x = i === 0 ? portones[0].x - 3.6 : i === portones.length ? portones[i - 1].x + 3.6 : (portones[i - 1].x + portones[i].x) / 2;
      R(x - 0.1, D.zAnden, 0.2, zq - D.zAnden, '#f1ede2');
    }
    // la linea de quiebre (hasta ahi llegan los camiones estacionados) y la zona de maniobra
    raya(D.x0 + 1, zq, D.x1 - 1, zq, 0.25, '#f1ede2', [1.5, 1]);
    texto('ZONA DE MANIOBRA', mitad, zq + 8, 2, 'rgba(241,237,226,.75)');
    // el flujo: de la entrada (derecha) hacia la salida (izquierda), en el medio del playon
    for (const x of [mitad - 22, mitad - 8, mitad + 6, mitad + 20]) flecha(x, zq + 14, Math.PI, 7, 2.2, '#f1ede2');
    texto('FLUJO INTERNO', mitad, zq + 18.5, 1.6, 'rgba(241,237,226,.8)');
    // cebrados amarillos en las esquinas, de la linea de quiebre hacia las bocas: ahi no se deja nada parado
    for (const x0 of [D.x0, D.x1 - 4]) {
      g.save(); g.beginPath(); g.rect(x0, zq, 4, 9); g.clip();
      R(x0, zq, 4, 9, 'rgba(224,178,30,.18)');
      for (let k = -10; k < 14; k += 1.2) raya(x0 + k, zq, x0 + k + 9, zq + 9, 0.45, '#e0b21e');
      g.restore();
      g.strokeStyle = '#e0b21e'; g.lineWidth = 0.2; g.strokeRect(x0, zq, 4, 9);
    }
    // ENTRADA: flecha grande hacia adentro, el nombre, la linea de ceda el paso antes de cruzar la vereda, y la curva guia
    // (punteada) para los que vienen del otro carril y doblan a la izquierda
    const xe = (D.entrada[0] + D.entrada[1]) / 2, xs = (D.salida[0] + D.salida[1]) / 2;
    flecha(xe, D.z1 - 5, -Math.PI / 2, 7, 3, '#f1ede2');
    texto('ENTRADA', xe, D.z1 - 11, 1.8, '#f1ede2');
    for (let x = D.entrada[0] + 0.3; x < D.entrada[1] - 0.3; x += 1.2) { g.fillStyle = '#f1ede2'; g.beginPath(); g.moveTo(x, D.z1 + VEREDA - 0.2); g.lineTo(x + 0.9, D.z1 + VEREDA - 0.2); g.lineTo(x + 0.45, D.z1 + VEREDA - 0.9); g.fill(); }
    g.beginPath(); g.moveTo(D.entrada[1] + 6, D.calle - 2.5); g.quadraticCurveTo(xe + 1, D.calle - 2, xe - 1, D.z1 - 2); g.lineWidth = 0.22; g.strokeStyle = '#e0b21e'; g.setLineDash([1, 1]); g.stroke(); g.setLineDash([]);
    // SALIDA: flecha hacia la calle, el nombre (se lee desde adentro), y la linea de PARE antes de pisar la vereda
    flecha(xs, D.z1 - 8.5, Math.PI / 2, 7, 3, '#f1ede2');
    texto('SALIDA', xs, D.z1 - 14.5, 1.8, '#f1ede2', Math.PI);
    R(D.salida[0], D.z1 - 1.6, D.salida[1] - D.salida[0], 0.5, '#f1ede2');
    texto('PARE', xs, D.z1 - 3, 1.4, '#f1ede2', Math.PI);
  }
  return { lienzo, X0, ladoX, ladoZ, bocas: B };
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

// un cartel de transito en un poste: 'pare' (octogono rojo) o 'contramano' (circulo rojo con una raya blanca).
// mira hacia +z (girado "giro").
function cartelVial(tipo, x, z, giro) {
  const l = document.createElement('canvas');
  l.width = l.height = 64;
  const g = l.getContext('2d');
  g.fillStyle = '#c8302a';
  if (tipo === 'pare') {
    g.beginPath(); for (let i = 0; i < 8; i++) { const a = Math.PI / 8 + i * Math.PI / 4; g.lineTo(32 + 30 * Math.cos(a), 32 + 30 * Math.sin(a)); } g.fill();
    g.fillStyle = '#ffffff'; g.font = '700 17px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('PARE', 32, 33);
  } else {
    g.beginPath(); g.arc(32, 32, 30, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffffff'; g.fillRect(12, 27, 40, 10);
  }
  const t = new THREE.CanvasTexture(l);
  t.colorSpace = THREE.SRGBColorSpace;
  const grupo = new THREE.Group();
  const palo = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.4, 0.1), new THREE.MeshLambertMaterial({ color: '#8a8f96' }));
  palo.position.y = 1.2; grupo.add(palo);
  const cara = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: t, transparent: true, side: THREE.DoubleSide }));
  cara.position.set(0, 2.6, 0.06); grupo.add(cara);
  grupo.position.set(x, 0, z); grupo.rotation.y = giro;
  return grupo;
}

// el galpon del deposito: paredes grises con una franja azul arriba, un porton por anden con topes amarillos (como en un
// centro de distribucion), el techo de chapa y el nombre grande arriba (se lee desde la camara alta). Mas dos muros bajos
// a los costados del playon.
function galpon(D, andenes) {
  const W = D.x1 - D.x0, F = D.zAnden - D.z0, H = 7, grupo = new THREE.Group();
  const l = document.createElement('canvas');
  l.width = W * 4; l.height = H * 4;
  const g = l.getContext('2d');
  const R = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  R(0, 0, W * 4, H * 4, '#d9d4c8'); R(0, 0, W * 4, 7, '#2f6fa8'); R(0, 7, W * 4, 1, '#25588a');
  for (let x = 0; x < W * 4; x += 3) R(x, 0, 1, 7, '#3a7bb5');
  for (const a of andenes) {
    const cx = Math.round((a.x - D.x0) * 4);
    R(cx - 9, 9, 18, 19, '#5b5e63'); R(cx - 8, 10, 16, 16, '#eef0f2');
    for (let y = 12; y < 26; y += 2) R(cx - 8, y, 16, 1, '#c9ccd0');
    R(cx - 11, 18, 2, 8, '#e0b21e'); R(cx + 9, 18, 2, 8, '#e0b21e');
    g.fillStyle = '#2b2b2d'; g.font = '700 6px sans-serif'; g.textAlign = 'center'; g.fillText(String(a.anden + 1), cx, 9);
  }
  const frente = new THREE.MeshLambertMaterial({ map: textura(l) });
  const pared = new THREE.MeshLambertMaterial({ color: '#d9d4c8' }), techo = new THREE.MeshLambertMaterial({ color: '#8fa4b8' });
  const m = new THREE.Mesh(new THREE.BoxGeometry(W, H, F), [pared, pared, techo, pared, frente, pared]);
  m.position.set((D.x0 + D.x1) / 2, H / 2, (D.z0 + D.zAnden) / 2);
  m.castShadow = m.receiveShadow = true;
  grupo.add(m);
  // el nombre en el techo
  const c = document.createElement('canvas');
  c.width = 256; c.height = 40;
  const k = c.getContext('2d');
  k.fillStyle = '#2f6fa8'; k.fillRect(0, 0, 256, 40);
  k.fillStyle = '#f1ede2'; k.font = '700 28px "Atkinson Hyperlegible", "Segoe UI", sans-serif'; k.textAlign = 'center'; k.textBaseline = 'middle';
  k.fillText(D.n ? 'DEPOSITO 2' : 'DEPOSITO', 128, 21);
  const nombre = new THREE.Mesh(new THREE.PlaneGeometry(26, 4), new THREE.MeshBasicMaterial({ map: textura(c) }));
  nombre.rotation.x = -Math.PI / 2;
  nombre.position.set((D.x0 + D.x1) / 2, H + 0.05, (D.z0 + D.zAnden) / 2);
  grupo.add(nombre);
  // los muros del playon: solo a los costados (adelante, la vereda: no se tapa la calle)
  const muro = new THREE.MeshLambertMaterial({ color: '#b9b4a8' }), reja = new THREE.MeshLambertMaterial({ color: '#4a4d52' });
  const tapia = (x, z, w, d) => {
    const mm = new THREE.Mesh(new THREE.BoxGeometry(w, 1.2, d), muro);
    mm.position.set(x, 0.6, z); mm.castShadow = true; grupo.add(mm);
    const rr = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, d), reja);   // (y arriba, una reja: la baranda)
    rr.position.set(x, 2.0, z); grupo.add(rr);
    for (let u = -w / 2; u <= w / 2 + 0.01; u += Math.max(2, w / Math.round(w / 2.5))) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.8, 0.1), reja);
      p.position.set(x + (d < w ? u : 0), 1.6, z + (d < w ? 0 : u)); grupo.add(p);
    }
  };
  for (const x of [D.x0 - 0.3, D.x1 + 0.3]) tapia(x, (D.zAnden + D.z1) / 2, 0.6, D.z1 - D.zAnden);
  // los carteles: CONTRAMANO en la salida (mirando a la calle: que nadie entre por ahi) y en la entrada (mirando adentro:
  // que nadie salga por ahi), y PARE en la salida, mirando adentro
  grupo.add(cartelVial('contramano', D.salida[1] + 0.6, D.z1 + 0.4, 0));
  grupo.add(cartelVial('contramano', D.entrada[0] - 0.6, D.z1 - 1.2, Math.PI));
  grupo.add(cartelVial('pare', D.salida[0] + 0.6, D.z1 - 1.2, Math.PI));
  return grupo;
}

// el refugio de una parada: un techo sobre dos postes y el cartel azul con el colectivo
function refugio(d) {
  const b = d.bahia, e = d.edificio, grupo = new THREE.Group();
  const gris = new THREE.MeshLambertMaterial({ color: '#8a8f96' }), techo = new THREE.MeshLambertMaterial({ color: '#2f6fa8' });
  // va sobre la linea de la casa (pegado a la pared), en el medio de la bahia, de frente a la calle
  const x = e.frenteX + e.nx * 0.9, z = e.frenteZ + e.nz * 0.9;
  for (const k of [-1.2, 1.2]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.4, 0.1), gris); p.position.set(x + b.ux * k, 1.2, z + b.uz * k); grupo.add(p); }
  const t = new THREE.Mesh(new THREE.BoxGeometry(3, 0.12, 1.4), techo);
  t.position.set(x, 2.45, z); t.rotation.y = -Math.atan2(b.uz, b.ux); t.castShadow = true;
  grupo.add(t);
  const l = document.createElement('canvas');
  l.width = l.height = 48;
  const g = l.getContext('2d');
  g.fillStyle = '#2f6fa8'; g.fillRect(0, 0, 48, 48); g.fillStyle = '#ffffff'; g.font = '30px "Segoe UI Emoji", "Noto Color Emoji", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('🚌', 24, 27);
  const tx = new THREE.CanvasTexture(l); tx.colorSpace = THREE.SRGBColorSpace;
  const c = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.7), new THREE.MeshBasicMaterial({ map: tx, side: THREE.DoubleSide }));
  c.position.set(x + b.ux * 1.9 + e.nx * 1.0, 2.6, z + b.uz * 1.9 + e.nz * 1.0); c.rotation.y = Math.atan2(e.nx, e.nz);
  const palo = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.6, 0.08), gris); palo.position.set(c.position.x, 1.3, c.position.z);
  grupo.add(c, palo);
  return grupo;
}

// un tramo de valla de obra: chapas con rayas rojas y blancas, y en cada calle que cruza un cartel "en obra" con lo que falta
// para abrirla (ver ABRE, en mapa.js)
const chapaObra = (() => {
  const l = document.createElement('canvas');
  l.width = 16; l.height = 8;
  const g = l.getContext('2d');
  g.fillStyle = '#e9e4d6'; g.fillRect(0, 0, 16, 8);
  g.fillStyle = '#c8302a'; for (let x = -8; x < 16; x += 4) { g.beginPath(); g.moveTo(x, 8); g.lineTo(x + 2, 8); g.lineTo(x + 10, 0); g.lineTo(x + 8, 0); g.fill(); }
  const t = new THREE.CanvasTexture(l); t.magFilter = THREE.NearestFilter; t.wrapS = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
})();
function vallaDeObra(o) {
  const largo = Math.max(o.hx, o.hz) * 2, aLoLargoDeX = o.hx > o.hz, grupo = new THREE.Group();
  const tex = chapaObra.clone(); tex.needsUpdate = true; tex.repeat.set(largo / 4, 1);
  const chapa = new THREE.Mesh(new THREE.BoxGeometry(aLoLargoDeX ? largo : 0.1, 1.4, aLoLargoDeX ? 0.1 : largo), new THREE.MeshLambertMaterial({ map: tex }));
  chapa.position.set(o.x, 0.9, o.z); chapa.castShadow = true;
  grupo.add(chapa);
  // los carteles, cada 40 m
  const l = document.createElement('canvas');
  l.width = 128; l.height = 64;
  const g = l.getContext('2d');
  g.fillStyle = '#e0b21e'; g.fillRect(0, 0, 128, 64); g.fillStyle = '#1e1f23'; g.fillRect(4, 4, 120, 56);
  g.fillStyle = '#e0b21e'; g.font = '700 20px "Atkinson Hyperlegible", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('🚧 EN OBRA', 64, 22, 116); g.fillText('🔒 ' + ABRE[o.zona] + ' entregas', 64, 44, 116);
  const tx = new THREE.CanvasTexture(l); tx.colorSpace = THREE.SRGBColorSpace;
  const mc = new THREE.MeshBasicMaterial({ map: tx, side: THREE.DoubleSide });
  // un cartel en cada calle que choca con la valla, en el medio de la calle (donde se ve al llegar)
  for (const q of CALLES) {
    const t = aLoLargoDeX ? (Math.abs(q.uz) < 1e-6 ? -1 : (o.z - q.z1) / q.uz) : (Math.abs(q.ux) < 1e-6 ? -1 : (o.x - q.x1) / q.ux);
    if (!(t > 0 && t < q.L)) continue;
    const x = aLoLargoDeX ? q.x1 + q.ux * t : o.x, z = aLoLargoDeX ? o.z : q.z1 + q.uz * t;
    const c = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 1.8), mc);
    c.position.set(x, 2.5, z); c.rotation.y = aLoLargoDeX ? Math.PI : -Math.PI / 2;   // (mira hacia el lado abierto: de donde se llega)
    grupo.add(c);
  }
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
  const piso = new THREE.Mesh(new THREE.PlaneGeometry(p.ladoX, p.ladoZ), new THREE.MeshLambertMaterial({ map: textura(p.lienzo) }));
  piso.rotation.x = -Math.PI / 2;
  piso.position.set(p.X0 + p.ladoX / 2, 0, p.X0 + p.ladoZ / 2);
  piso.receiveShadow = true;
  escena.add(piso);

  // --- las casas y los negocios ---
  // las casas: el dibujo de Shakedown (src/pueblo.js), con el tipo y la variante de cada lote
  crearPueblo({ casas: mapa.edificios.map((e) => ({ x: e.x, y: 0, z: e.z, rumbo: e.rumbo, tipo: e.tipo, variante: e.variante })),
    objetos: [], barandas: [], pircas: [], altura: () => 0 }, escena, null, null);
  for (const d of mapa.destinos) if (d.edificio) escena.add(cartel(d.edificio, d));
  for (const D of DEPOSITOS) escena.add(galpon(D, mapa.destinos.filter((d) => d.deposito && d.dep === D)));
  // los refugios de las paradas de colectivo: un techito con el cartel azul, sobre la vereda, al lado de la bahia
  for (const d of mapa.destinos) if (d.parada) escena.add(refugio(d));
  // --- las vallas de obra de las zonas que todavia no se abrieron (ver abrir) ---
  const vallas = { 2: new THREE.Group(), 3: new THREE.Group() };
  for (const o of mapa.vallas) vallas[o.zona].add(vallaDeObra(o));
  escena.add(vallas[2], vallas[3]);

  // --- los arboles: los de Shakedown (planos cruzados con su dibujo), en la plaza, los fondos de las manzanas, el campo y
  // las islas de las rotondas ---
  const lote = crearLoteDeArboles(liviano);
  mapa.arboles.forEach((a, k) => lote.poner(a.tipo, a.x, 0, a.z, ruido(k, 31) * 6.28, a.alto / 6, ruido(k, 32)));
  for (const [k, q] of ROTONDAS.entries()) lote.poner(q.ri > 4 ? 'ombu' : 'arbustoRedondo', q.x, 0.3, q.z, k, q.ri > 4 ? 1.3 : 0.7, ruido(k, 33));
  const arboles = lote.malla();
  if (arboles) escena.add(arboles);
  const piedra = new THREE.MeshLambertMaterial({ color: '#cfc8b8' });
  const base = new THREE.Mesh(new THREE.BoxGeometry(4, 1.2, 4), piedra), aguja = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.9, 7, 4), piedra);
  base.position.set(mapa.monumento.x, 0.6, mapa.monumento.z); aguja.position.set(mapa.monumento.x, 4.6, mapa.monumento.z);
  base.castShadow = aguja.castShadow = true;
  escena.add(base, aguja);

  // --- las islas de las rotondas: un cordon blanco, pasto, y un arbol (o, en la chiquita, unas matas) ---
  const cordon = new THREE.MeshLambertMaterial({ color: '#e9e4d6' }), pasto = new THREE.MeshLambertMaterial({ color: '#5f8f3c' });
  for (const q of ROTONDAS) {
    const c1 = new THREE.Mesh(new THREE.CylinderGeometry(q.ri + 0.3, q.ri + 0.3, 0.25, 32), cordon);
    c1.position.set(q.x, 0.125, q.z); c1.receiveShadow = true;
    const c2 = new THREE.Mesh(new THREE.CylinderGeometry(q.ri, q.ri, 0.3, 32), pasto);
    c2.position.set(q.x, 0.15, q.z); c2.receiveShadow = true;
    escena.add(c1, c2);
  }

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
    // muestra las vallas de las zonas que siguen cerradas (n: hasta que zona esta abierto)
    abrir: (n) => { vallas[2].visible = n < 2; vallas[3].visible = n < 3; },
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

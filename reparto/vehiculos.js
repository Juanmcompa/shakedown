// Reparto: los vehiculos de reparto. Segun lo que se lleva, el viaje se hace en uno de tres:
//   camioneta: chica, con la carga tapada con una lona
//   furgon:    la camioneta de reparto de siempre, caja cerrada
//   camion:    largo, pesado, lento para arrancar y para doblar
//   semi:      un tractor con un remolque enganchado (ver remolque.js): solo para los viajes largos y dificiles
// Por dentro manejan como la Vitarita de Shakedown (la misma fisica), agrandada a cada tamaño. Por fuera son cajas con
// dibujos de pocos pixeles (4 por metro), como el resto del mundo. Las versiones pasadas son el mismo vehiculo con la
// cabina de otro color. Todos llevan en el techo el numero de la entrega que estan haciendo (asi se reconocen entre todos).
import * as THREE from '../vendor/three.module.js';
import { configDe } from '../src/partes.js';
import { tono } from '../src/pixel.js';

// las medidas de cada uno. k: cuanto mas pesado que la Vitarita. ancho/largo: medio ancho y medio largo (para chocarlos).
// cabina, caja: largos (m). altoCabina, altoCaja: altos. abierta: la caja es una caja de camioneta, sin techo.
export const TIPOS = {
  camioneta: { nombre: 'Camioneta', k: 1.2, motor: 1.25, giro: 1, ancho: 0.95, largo: 2.3, choque: [0.95, 1.35], trocha: 0.8, ejes: 1.4,
    cabina: 1.95, caja: 2.5, altoCabina: 1.45, altoCaja: 0.5, anchoDibujo: 1.85, abierta: true, piso: 0.42 },
  furgon: { nombre: 'Furgón', k: 1.45, motor: 1.3, giro: 1, ancho: 0.97, largo: 2.3, choque: [0.95, 1.35], trocha: 0.84, ejes: 1.45,
    cabina: 1.5, caja: 3.1, altoCabina: 1.45, altoCaja: 2.05, anchoDibujo: 1.9, piso: 0.42 },
  camion: { nombre: 'Camión', k: 2.8, motor: 2.1, giro: 0.82, ancho: 1.18, largo: 3.6, choque: [1.15, 2.4], trocha: 0.98, ejes: 2.2,
    cabina: 2.0, caja: 5.2, altoCabina: 2.1, altoCaja: 2.75, anchoDibujo: 2.35, piso: 0.55 },
  // el semi: el tractor solo (la cabina y un chasis corto con el plato donde se engancha el remolque). remolque: largo
  // total, medio ancho, alto, del frente al perno de enganche, de la cola al eje, y a cuanto detras del centro del tractor
  // queda el plato.
  semi: { nombre: 'Semi', k: 3.4, motor: 2.5, giro: 0.86, ancho: 1.2, largo: 2.9, choque: [1.15, 1.75], trocha: 1.0, ejes: 1.6,
    cabina: 2.5, caja: 3.2, altoCabina: 2.6, altoCaja: 0.3, anchoDibujo: 2.4, piso: 0.6, tractor: true,
    remolque: { largo: 11, ancho: 1.24, alto: 3.0, perno: 1.0, eje: 2.2, plato: 1.2 } },
};

// la fisica: la de la Vitarita agrandada (el mismo resorte por kilo; el motor, un poco menos por kilo cuanto mas grande)
const configs = {};
export function configDeTipo(tipo) {
  if (configs[tipo]) return configs[tipo];
  const V = configDe('vitarita'), t = TIPOS[tipo], k = t.k;
  return (configs[tipo] = {
    ...V,
    masa: V.masa * k, resorte: V.resorte * k, amortigua: V.amortigua.map((a) => a * k), potencia: V.potencia * t.motor,
    inercia: V.inercia.map((i) => i * k * (1 + t.largo / 4)), giro: V.giro * t.giro,
    caja: [t.ancho, t.largo, V.caja[2], t.altoCaja + 0.4], choque: t.choque, trocha: t.trocha, ejes: t.ejes,
  });
}
export const altoDe = (C) => C.resorteLargo + C.radio - C.masa * 9.81 / 4 / C.resorte - C.anclaje;   // a que altura va el centro, apoyado

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
const negro = new THREE.MeshLambertMaterial({ color: '#2b2b2d' });

// la caja de carga cerrada (furgon y camion): igual para todos
const cajas = {};
function materialesCaja(tipo) {
  if (cajas[tipo]) return cajas[tipo];
  const G = tipo === 'camion' ? '#e9e4d6' : '#8b8784', borde = '#3a3a3c', raya = tipo === 'camion' ? '#2f6fa8' : '#b3afa9';
  const lado = mat(lienzo(tipo === 'camion' ? 20 : 13, 8, (R) => {
    const w = tipo === 'camion' ? 20 : 13;
    R(0, 0, w, 8, G); R(0, 0, w, 1, tono(G, 0.2)); R(0, 7, w, 1, tono(G, -0.35));
    R(2, 2, w - 4, 1, raya); R(2, 5, w - 4, 1, raya); R(w - 1, 1, 1, 6, tono(G, -0.15));
  }));
  const atras = mat(lienzo(8, 8, (R) => {
    R(0, 0, 8, 8, '#c9c4bb'); for (let y = 1; y < 7; y += 2) R(1, y, 6, 1, '#a9a49a');
    R(0, 0, 8, 1, borde); R(0, 7, 8, 1, borde); R(0, 0, 1, 8, borde); R(7, 0, 1, 8, borde); R(3, 6, 2, 1, '#5a5a5c');
  }));
  const techo = mat(lienzo(8, 12, (R) => { R(0, 0, 8, 12, tono(G, -0.05)); for (let y = 1; y < 12; y += 3) R(0, y, 8, 1, tono(G, -0.12)); }));
  // (orden de las caras de una caja: derecha, izquierda, arriba, abajo, atras (+z), adelante (-z))
  return (cajas[tipo] = [lado, lado, techo, negro, atras, lado]);
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
  const atras = mat(lienzo(8, 6, (R) => { R(0, 0, 8, 6, color); R(2, 1, 4, 2, '#35546e'); R(0, 5, 8, 1, oscuro); }));
  const m = [lado, lado, techo, negro, atras, frente];
  cabinas.set(color, m);
  return m;
}
// el remolque: blanco con una franja azul y REPARTO escrito al costado
let mRemolque = null;
function materialesRemolque() {
  if (mRemolque) return mRemolque;
  const lado = mat(lienzo(44, 12, (R) => {
    R(0, 0, 44, 12, '#eef0f2'); R(0, 0, 44, 1, '#ffffff'); R(0, 11, 44, 1, '#9aa0a6');
    R(0, 7, 44, 2, '#2f6fa8'); R(0, 9, 44, 1, '#ffd23a');
    for (let x = 0; x < 44; x += 4) R(x, 1, 1, 6, '#dde0e3');
  }));
  const atras = mat(lienzo(10, 12, (R) => { R(0, 0, 10, 12, '#d9dcdf'); R(4, 1, 2, 10, '#9aa0a6'); R(1, 4, 1, 3, '#55585e'); R(8, 4, 1, 3, '#55585e'); }));
  const techo = mat(lienzo(10, 44, (R) => { R(0, 0, 10, 44, '#e4e7ea'); for (let y = 2; y < 44; y += 4) R(0, y, 10, 1, '#d2d6da'); }));
  return (mRemolque = [lado, lado, techo, negro, atras, lado]);
}
const tabla = new THREE.MeshLambertMaterial({ color: '#7a6248' }), lona = mat(lienzo(8, 8, (R) => { R(0, 0, 8, 8, '#4f6a4a'); for (let y = 1; y < 8; y += 2) R(0, y, 8, 1, '#455e41'); }));
const llanta = new THREE.MeshLambertMaterial({ color: '#202124' }), aro = new THREE.MeshLambertMaterial({ color: '#b9bec4' });
const rojo = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.25, 0.15) }), apagada = new THREE.MeshLambertMaterial({ color: '#7a2a22' });

// el numero de una entrega, para el techo: oscuro con letras claras (o amarillo, el del que juega)
const numeros = new Map();
function materialNumero(n, propio) {
  const clave = n + (propio ? 'p' : '');
  if (numeros.has(clave)) return numeros.get(clave);
  const l = document.createElement('canvas');
  l.width = l.height = 64;
  const g = l.getContext('2d');
  g.fillStyle = propio ? '#ffd23a' : '#1e1f23'; g.fillRect(2, 2, 60, 60);
  g.strokeStyle = propio ? '#1e1f23' : '#f1ede2'; g.lineWidth = 4; g.strokeRect(4, 4, 56, 56);
  g.fillStyle = propio ? '#1e1f23' : '#f1ede2';
  g.font = '700 ' + (n > 99 ? 28 : 40) + 'px "Pixelify Sans", "Atkinson Hyperlegible", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(String(n), 32, 35);
  const t = new THREE.CanvasTexture(l);
  t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.MeshBasicMaterial({ map: t });
  numeros.set(clave, m);
  return m;
}

// Arma un vehiculo. color: el de la cabina. Devuelve el grupo (con el origen en el centro de masa, como el auto de la
// fisica: el piso queda "alto" metros abajo), sus ruedas, las luces de freno y numero(n): pone el numero del techo.
export function armarVehiculo(tipo, color, propio = false) {
  const t = TIPOS[tipo], C = configDeTipo(tipo), alto = altoDe(C);
  const piso = -alto, grupo = new THREE.Group(), W = t.anchoDibujo;
  const largo = t.caja + t.cabina, z0 = -largo / 2 + (C.centro || 0), base = piso + t.piso;
  const poner = (m) => { m.castShadow = true; grupo.add(m); return m; };
  // la cabina adelante (adelante es -z)
  poner(new THREE.Mesh(new THREE.BoxGeometry(W * 0.97, t.altoCabina, t.cabina), materialesCabina(color))).position.set(0, base + t.altoCabina / 2, z0 + t.cabina / 2);
  poner(new THREE.Mesh(new THREE.BoxGeometry(W, 0.22, 0.2), llanta)).position.set(0, base + 0.05, z0 - 0.05);
  const zc = z0 + t.cabina + t.caja / 2;
  if (t.tractor) {
    // el chasis del tractor y el plato
    poner(new THREE.Mesh(new THREE.BoxGeometry(W * 0.6, 0.3, t.caja), negro)).position.set(0, base + 0.15, zc);
    poner(new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.12, 10), new THREE.MeshLambertMaterial({ color: '#8a8f96' }))).position.set(0, base + 0.36, (C.centro || 0) + t.remolque.plato);
  } else if (!t.abierta) poner(new THREE.Mesh(new THREE.BoxGeometry(W, t.altoCaja, t.caja), materialesCaja(tipo))).position.set(0, base + t.altoCaja / 2, zc);
  else {
    // la caja de la camioneta: el piso y cuatro tablas bajas
    poner(new THREE.Mesh(new THREE.BoxGeometry(W, 0.12, t.caja), tabla)).position.set(0, base + 0.06, zc);
    for (const x of [-1, 1]) poner(new THREE.Mesh(new THREE.BoxGeometry(0.08, t.altoCaja, t.caja), tabla)).position.set(x * (W / 2 - 0.04), base + t.altoCaja / 2, zc);
    poner(new THREE.Mesh(new THREE.BoxGeometry(W, t.altoCaja, 0.08), tabla)).position.set(0, base + t.altoCaja / 2, z0 + largo - 0.04);
    poner(new THREE.Mesh(new THREE.BoxGeometry(W - 0.1, 0.75, t.caja - 0.1), lona)).position.set(0, base + 0.5, zc);
  }
  // el numero, en el techo de la caja (se lee desde arriba y desde atras: la camara va detras del vehiculo)
  const lado = Math.min(W * 0.85, 1.8), placa = new THREE.Mesh(new THREE.PlaneGeometry(lado, lado), materialNumero(0, propio));
  placa.rotation.set(-Math.PI / 2, 0, Math.PI);
  placa.position.set(0, base + (t.abierta ? 0.9 : t.tractor ? t.altoCabina : t.altoCaja) + 0.03, t.tractor ? z0 + t.cabina / 2 : zc);
  placa.visible = false;
  grupo.add(placa);
  // el remolque del semi: un grupo aparte (se mueve solo: ver remolque.js), con el origen en el piso, en el medio del remolque
  let remolque = null;
  const lucesR = [];   // (las luces de freno del remolque: se suman despues a las del tractor)
  if (t.remolque) {
    const R = t.remolque;
    remolque = new THREE.Group();
    const caja = new THREE.Mesh(new THREE.BoxGeometry(R.ancho * 2, R.alto, R.largo), materialesRemolque());
    caja.position.set(0, 1.15 + R.alto / 2, 0);
    caja.castShadow = true;
    remolque.add(caja);
    const geoR = new THREE.CylinderGeometry(0.5, 0.5, 0.35, 10);
    geoR.rotateZ(Math.PI / 2);
    for (const z of [R.largo / 2 - R.eje - 0.65, R.largo / 2 - R.eje + 0.65]) for (const x of [-1, 1]) {
      const r = new THREE.Mesh(geoR, llanta); r.position.set(x * (R.ancho - 0.2), 0.5, z); r.castShadow = true; remolque.add(r);
    }
    for (const x of [-1, 1]) { const l = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 0.3), apagada); l.position.set(x * (R.ancho - 0.2), 1.35, R.largo / 2 + 0.01); remolque.add(l); lucesR.push(l); }
    // en el semi el numero va arriba del remolque, mas grande
    const otra = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), placa.material);
    otra.rotation.set(-Math.PI / 2, 0, Math.PI); otra.position.set(0, 1.15 + R.alto + 0.03, 0); otra.visible = false;
    remolque.add(otra);
    placa.userData.otra = otra;
  }
  const numero = (n) => {
    for (const q of [placa, placa.userData.otra]) if (q) { q.visible = n > 0; if (n > 0) q.material = materialNumero(n, propio); }
  };
  // las luces de atras
  const frenos = [...lucesR];
  for (const x of [-1, 1]) {
    const l = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.3), apagada);
    l.position.set(x * (W / 2 - 0.17), base + 0.35, z0 + largo + 0.01);
    grupo.add(l); frenos.push(l);
  }
  // las ruedas: un pivote que dobla y adentro la rueda que gira
  const radio = C.radio;
  const geo = new THREE.CylinderGeometry(radio, radio, 0.3, 10), geoAro = new THREE.CylinderGeometry(radio * 0.5, radio * 0.5, 0.32, 6);
  geo.rotateZ(Math.PI / 2); geoAro.rotateZ(Math.PI / 2);
  const ruedas = [];
  for (let i = 0; i < 4; i++) {
    const pivote = new THREE.Group(), rueda = new THREE.Group(), goma = new THREE.Mesh(geo, llanta);
    goma.castShadow = true;
    rueda.add(goma, new THREE.Mesh(geoAro, aro));
    pivote.add(rueda);
    pivote.position.set((i % 2 ? 1 : -1) * C.trocha * 1.06, piso + radio, (i < 2 ? -1 : 1) * C.ejes + (C.centro || 0));
    grupo.add(pivote);
    ruedas.push({ pivote, rueda });
  }
  return { grupo, remolque, ruedas, frenos, alto, numero, C, tipo };
}

// el vehiculo del que juega: sigue al auto de la fisica cuadro a cuadro
export function crearDibujoVehiculo(escena, tipo, color) {
  const f = armarVehiculo(tipo, color, true);
  escena.add(f.grupo);
  if (f.remolque) escena.add(f.remolque);
  return {
    ...f,
    // r: el remolque (si hay), para poner su dibujo donde esta
    actualizar(c, dt, r) {
      if (r && f.remolque) r.ubicar(f.remolque);
      f.grupo.position.fromArray(c.pos);
      f.grupo.quaternion.fromArray(c.q);
      c.ruedas.forEach((r, i) => {
        f.ruedas[i].pivote.position.set(r.x * 1.06, f.C.anclaje - r.largo, r.z);
        f.ruedas[i].pivote.rotation.y = r.delantera ? -c.giroRuedas : 0;
        f.ruedas[i].rueda.rotation.x = -r.giro;
      });
      for (const l of f.frenos) l.material = c.frenando ? rojo : apagada;
    },
    sacar: () => { escena.remove(f.grupo); if (f.remolque) escena.remove(f.remolque); },
  };
}

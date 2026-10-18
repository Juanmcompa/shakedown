// La vegetacion: los arboles (hechos de bloques) y todo lo chico que crece al costado del camino
// (arbustos, matas, flores, yuyos y piedras sueltas), que son sprites.
import * as THREE from '../vendor/three.module.js';
import { crearRuido, azar } from './noise.js';
import { crearLote } from './pixel.js';
import { crearLoteDeSprites } from './sprites.js';
import { estilo } from './material.js';
import { SUELOS } from './config.js';

const ZONA = 80;   // el mundo se parte en zonas de 80 metros, para dibujar solo las que se ven
const par = (v) => Math.max(2, Math.round(v / 2) * 2);   // medida par, en pixeles

// --- la forma de cada arbol, en pixeles de 25 cm. "a" es su tamaño (de 0,8 a 1,7) ---
// Devuelve el alto del tronco (pie) y los pisos de la copa, de abajo hacia arriba: [lado, alto, corrimiento en x, corrimiento en z]
const FORMAS = {
  pino: (a) => { const w = par(a * 12), h = par(a * 4.2); return { pie: Math.round(a * 4), pisos: [[w, h, 0, 0], [par(w * 0.74), h, 0, 0], [par(w * 0.5), h, 0, 0], [par(w * 0.28), h + 2, 0, 0]] }; },
  pinoAlto: (a) => { const w = par(a * 9), h = par(a * 5); return { pie: Math.round(a * 6), pisos: [[w, h, 0, 0], [par(w * 0.82), h, 0, 0], [par(w * 0.62), h, 0, 0], [par(w * 0.42), h, 0, 0], [par(w * 0.24), h + 2, 0, 0]] }; },
  lenga: (a, r) => { const w = par(a * 13), h = par(a * 6); return { pie: Math.round(a * 9), brazo: r() < 0.6, pisos: [[w, h, 0, 0], [par(w * 0.62), par(h * 0.6), Math.round((r() - 0.5) * 3), Math.round((r() - 0.5) * 3)]] }; },
  alamo: (a, r) => { const w = par(a * 5); return { pie: Math.round(a * 4), pisos: [[w, par(a * 9), 0, 0], [w, par(a * 8), Math.round(r() * 2 - 1), Math.round(r() * 2 - 1)], [par(w * 0.6), par(a * 6), 0, 0]] }; },
  araucaria: (a) => { const w = par(a * 10); return { pie: Math.round(a * 16), pisos: [[par(w * 0.6), 2, 0, 0], [w, 3, 0, 0], [par(w * 0.66), 3, 0, 0], [par(w * 0.3), 2, 0, 0]] }; },   // un paraguas arriba de un tronco largo
  eucalipto: (a, r) => { const w = par(a * 9); return { pie: Math.round(a * 17), pisos: [[w, par(a * 5), 0, 0], [par(w * 0.74), par(a * 4), Math.round((r() - 0.5) * 5), Math.round((r() - 0.5) * 5)], [par(w * 0.5), par(a * 3), Math.round((r() - 0.5) * 4), Math.round((r() - 0.5) * 4)]] }; },
};

// --- lo que crece en cada bioma, segun cuan lejos del camino: [dibujo, cuanto abunda, crece en manchones (0 = parejo)] ---
// cerca: en la banquina, todo bajo para no tapar el borde. medio: hasta 12 metros. lejos: mas alla.
const YUYOS = {
  bosque: {
    cerca: [['mataOscura', 5, 0], ['helecho', 3, 1], ['violetas', 1.5, 2], ['amancay', 1.6, 3], ['piedra', 0.5, 0], ['lupinoLila', 1.2, 4], ['lupinoRosa', 1, 4], ['lupinoBlanco', 0.5, 4]],
    medio: [['helecho', 4, 1], ['mataOscura', 3, 0], ['arbusto', 1.6, 0], ['arbustoRojo', 1.1, 5], ['lupinoLila', 2.2, 4], ['lupinoRosa', 1.6, 4], ['lupinoBlanco', 0.8, 4], ['tocon', 0.6, 0], ['piedraGrande', 0.4, 0], ['amancay', 1, 3]],
    lejos: [['mataOscura', 3, 0], ['helecho', 3, 1], ['arbusto', 1, 0], ['arbustoRojo', 0.5, 5]],
    cuanto: [0.55, 0.42, 0.1],
  },
  campo: {
    cerca: [['mataClara', 5, 0], ['margaritas', 2, 2], ['amarillas', 2, 3], ['pastoAlto', 2, 1], ['cardo', 0.7, 4]],
    medio: [['pastoAlto', 4, 1], ['cortadera', 2, 5], ['arbustoClaro', 1, 0], ['arbustoFlor', 0.8, 2], ['cardo', 1.6, 4], ['amarillas', 2, 3], ['margaritas', 1.5, 2], ['mataClara', 3, 0]],
    lejos: [['pastoAlto', 3, 1], ['mataClara', 3, 0], ['cortadera', 0.7, 5], ['cardo', 0.6, 4]],
    cuanto: [0.5, 0.4, 0.12],
  },
  montana: {
    cerca: [['coiron', 5, 0], ['mataSeca', 3, 0], ['piedra', 1.6, 1], ['amarillas', 0.7, 3]],
    medio: [['coiron', 5, 0], ['neneo', 2.4, 2], ['arbustoSeco', 1.4, 4], ['piedraGrande', 1, 1], ['mataSeca', 2, 0], ['piedra', 1, 1]],
    lejos: [['coiron', 4, 0], ['neneo', 1.5, 2], ['arbustoSeco', 0.8, 4]],
    cuanto: [0.5, 0.4, 0.14],
  },
  // la sierra: paja brava y matas bajas, con muchos bloques de granito sueltos
  sierra: {
    cerca: [['coiron', 5, 0], ['mataSeca', 3, 0], ['piedra', 1.8, 1], ['amarillas', 0.5, 3]],
    medio: [['coiron', 5, 0], ['arbustoSeco', 1.4, 4], ['piedraGrande', 1.8, 1], ['mataSeca', 2.4, 0], ['piedra', 1.4, 1], ['neneo', 0.7, 2]],
    lejos: [['coiron', 4, 0], ['arbustoSeco', 1, 4], ['piedraGrande', 0.6, 1]],
    cuanto: [0.5, 0.4, 0.14],
  },
};

// Arma la vegetacion y la agrega a la escena. Devuelve las celdas del mapa que quedan debajo de un arbol.
export function crearFlora(T, escena, esc, liviano) {
  const { nx, nz, x0, z0, H, S } = T;
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), P4 = new THREE.Vector3(0.25, 0.25, 0.25), ARRIBA = new THREE.Vector3(0, 1, 0);
  const zonas = new Map(), zona = (x, z) => {
    const k = Math.floor(x / ZONA) * 4096 + Math.floor(z / ZONA);
    if (!zonas.has(k)) zonas.set(k, { copas: crearLote(), troncos: crearLote(), yuyos: crearLoteDeSprites() });
    return zonas.get(k);
  };
  const monte = new Uint8Array(nx * nz);

  // --- arboles y arbustos ---
  for (const o of T.cosas) {
    if (o.clase !== 'arbol') continue;
    const r = azar(Math.floor(o.x * 131 + o.z * 71) + 9), z = zona(o.x, o.z);
    if (o.tipo === 'arbusto') {   // un arbusto es un sprite; segun el bioma, uno u otro
      const donde = T.biomaEn(o.x, o.z), dibujo = donde === 'montana' ? (r() < 0.6 ? 'neneo' : 'arbustoSeco') : donde === 'sierra' ? (r() < 0.25 ? 'neneo' : 'arbustoSeco') : donde === 'campo' ? (r() < 0.6 ? 'arbustoClaro' : 'arbustoFlor') : 'arbusto';
      z.yuyos.poner(dibujo, o.x, o.y - 0.05, o.z, { escala: 1.15 + r() * 0.5, azar: r(), mueve: 0.04 });
      continue;
    }
    // las lengas, en otoño: unas rojas y otras amarillas
    const tipo = o.tipo === 'lenga' && r() < 0.34 ? 'nire' : o.tipo, f = (FORMAS[o.tipo] || FORMAS.lenga)(o.alto, r);
    const pintura = (w, h) => ({ arriba: esc.copa(tipo, w), lados: esc.follaje(tipo, h), abajo: liviano ? null : esc.debajo(tipo) });
    M.compose(V.set(o.x, o.y, o.z), Q.setFromAxisAngle(ARRIBA, o.vuelta), P4);
    let y = f.pie;
    for (const [w, h, cx, cz] of f.pisos) {
      z.copas.bloque(M, [cx - w / 2, y, cz - w / 2, cx + w / 2, y + h, cz + w / 2], pintura(w, h), r);
      y += o.tipo === 'pino' || o.tipo === 'pinoAlto' ? h - 1 : h;   // en los pinos, cada piso tapa un poco al de abajo
    }
    if (f.brazo) {   // una rama gruesa al costado
      const [w, h] = f.pisos[0], wb = par(w * 0.5), hb = par(h * 0.6), lado = r() < 0.5 ? -1 : 1, enX = r() < 0.5, corre = lado * (w / 2), yb = f.pie + (r() < 0.5 ? 0 : 1);
      z.copas.bloque(M, [(enX ? corre : 0) - wb / 2, yb, (enX ? 0 : corre) - wb / 2, (enX ? corre : 0) + wb / 2, yb + hb, (enX ? 0 : corre) + wb / 2], pintura(wb, hb), r);
    }
    z.troncos.bloque(M, [-1, -2, -1, 1, f.pie + 1, 1], { lados: esc.corteza(o.tipo), arriba: null, abajo: null }, r);
    // el piso de abajo queda como monte
    const radio = f.pisos[0][0] / 8 + 1.2, gx = Math.round(o.x - x0), gz = Math.round(o.z - z0), n = Math.ceil(radio);
    for (let j = -n; j <= n; j++) for (let i = -n; i <= n; i++) {
      if (i * i + j * j <= radio * radio && gx + i >= 0 && gx + i < nx && gz + j >= 0 && gz + j < nz) monte[(gz + j) * nx + gx + i] = 1;
    }
  }

  // --- yuyos: se siembran en una grilla, mas tupidos cerca del camino ---
  // (si la pista pasa por varios ambientes, en cada lugar crece lo del suyo)
  const listas = T.biomas.map((id) => YUYOS[id] || YUYOS.bosque), ruido = crearRuido((T.etapa.semilla || 1) + 31), r = azar((T.etapa.semilla || 1) + 5);
  const paso = liviano ? 2.6 : 1.9, pasto = SUELOS.pasto.id;
  const elegir = (opciones, x, z) => {
    let total = 0;
    const pesos = opciones.map(([, peso, manchon]) => {
      // lo que crece en manchones abunda en unos lugares y casi no aparece en otros
      const w = manchon ? peso * (ruido.n2(x / 17 + manchon * 37, z / 17 - manchon * 11) > 0.56 ? 3.2 : 0.12) : peso;
      total += w;
      return w;
    });
    let t = r() * total;
    for (let i = 0; i < opciones.length; i++) { t -= pesos[i]; if (t <= 0) return opciones[i][0]; }
    return opciones[0][0];
  };
  for (let z = z0 + 2; z < T.z1 - 2; z += paso) for (let x = x0 + 2; x < T.x1 - 2; x += paso) {
    const px = x + (r() - 0.5) * paso, pz = z + (r() - 0.5) * paso, a = r(), k = Math.round(pz - z0) * nx + Math.round(px - x0);
    const b = T.borde[k];
    if (!(b > 0.7 && b < 34) || S[k] !== pasto || T.pelado[k]) continue;
    if (T.cultivo[k]) {   // en lo sembrado crece lo sembrado
      const que = T.cultivo[k], dibujo = que === 3 ? 'girasol' : que === 1 ? 'trigo' : que === 4 ? 'mataOscura' : '';
      if (dibujo && a < (que === 3 ? 0.5 : que === 1 ? 0.3 : 0.12)) zona(px, pz).yuyos.poner(dibujo, px, T.altura(px, pz) - 0.04, pz, { escala: 0.9 + r() * 0.3, azar: r(), mueve: 0.05 });
      continue;
    }
    const banda = b < 3.5 ? 0 : b < 12 ? 1 : 2, lista = listas[T.zona ? T.zona[k] : 0];
    if (a > lista.cuanto[banda] * (monte[k] ? 0.45 : 1)) continue;
    if (T.claros.some((q) => (q.x - px) ** 2 + (q.z - pz) ** 2 < (q.r - 1) * (q.r - 1))) continue;
    const dibujo = elegir(banda === 0 ? lista.cerca : banda === 1 ? lista.medio : lista.lejos, px, pz);
    zona(px, pz).yuyos.poner(dibujo, px, T.altura(px, pz) - 0.04, pz, { escala: 0.85 + r() * 0.45, azar: r(), mueve: dibujo.startsWith('piedra') || dibujo === 'tocon' ? 0 : 0.03 + r() * 0.05 });
  }

  // --- las vacas del campo ---
  for (const v of T.vacas) zona(v.x, v.z).yuyos.poner(v.n % 3 ? 'vacaOvera' : 'vacaColorada', v.x, v.y - 0.05, v.z, { escala: 1.25, azar: v.fase, mueve: 0 });

  // --- a la escena ---
  const dibujo = esc.atlas.textura();
  const mCopa = estilo(new THREE.MeshLambertMaterial({ map: dibujo }), { calada: true }), mTronco = estilo(new THREE.MeshLambertMaterial({ map: dibujo }));
  let arboles = 0, yuyos = 0;
  for (const z of zonas.values()) {
    for (const [lote, mat] of [[z.copas, mCopa], [z.troncos, mTronco]]) {
      if (lote.vacio()) continue;
      const m = new THREE.Mesh(lote.geometria(esc.atlas), mat);
      m.castShadow = true;
      escena.add(m);
      arboles++;
    }
    if (z.yuyos.cuantos()) { escena.add(z.yuyos.malla(!liviano)); yuyos += z.yuyos.cuantos(); }
  }
  return { monte, yuyos, zonas: zonas.size };
}

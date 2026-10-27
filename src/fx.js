// Efectos: las huellas que quedan marcadas en el piso, el polvo que queda flotando sobre el camino
// y los cubitos de barro o de agua que saltan de las ruedas.
import * as THREE from '../vendor/three.module.js';
import { SUELO, SUELOS } from './config.js';
import { granito } from './arte.js';
import { crearAtlas } from './pixel.js';
import { estilo } from './material.js';

// --- el polvo: nubecitas de pixeles que nacen chicas y tupidas y se van agrandando y deshilachando ---
// Cada nube pasa por cuatro edades; en cada una mide mas y tiene menos pixeles (siempre a 8 pixeles por metro).
const EDADES = [[10, 1.1], [16, 0.82], [22, 0.55], [28, 0.3]];   // [lado en pixeles, que tan tupida]
// de que color es el polvo de cada suelo: [sombra, medio, luz]
const POLVOS = {
  ripio: ['#bfa983', '#d6c3a0', '#e8dabc'], tierra: ['#a8704a', '#c48e68', '#d9ab88'],
  gris: ['#a5a29c', '#c2bfb8', '#dbd8d1'], pasto: ['#99906a', '#b5ac84', '#cdc5a0'],
  arena: ['#c9ae7a', '#dcc592', '#ecdbb2'],   // (la Travesia: va al final para no mover los dibujos de antes en el atlas)
};
const POLVO_DE = { [SUELOS.ripio.id]: 'ripio', [SUELOS.tierra.id]: 'tierra', [SUELOS.pasto.id]: 'pasto', [SUELOS.arena.id]: 'arena', [SUELOS.feshfesh.id]: 'arena', [SUELOS.gravilla.id]: 'ripio', [SUELOS.sendero.id]: 'tierra' };   // el resto, gris
// la polvareda grande de la Travesia (opcion "grande" de crearEfectos): nubes de hasta 5 m de lado, que quedan flotando atras del auto.
// Mismo estilo (pocos pixeles, a 8 por metro) pero con edades mas grandes, y solo en los colores de la arena, la tierra y el ripio.
const EDADES_G = [[30, 1.1], [36, 0.9], [42, 0.66], [48, 0.4]];
const POLVOS_G = { arena: ['#d49a58', '#e8b574', '#f6d29c'], ripio: ['#cda06a', '#e2bb86', '#f2d6a6'], tierra: ['#b07a4c', '#cb9768', '#e0b88a'] };
const POLVO_G_DE = { [SUELOS.ripio.id]: 'ripio', [SUELOS.arena.id]: 'arena', [SUELOS.feshfesh.id]: 'arena', [SUELOS.pedregal.id]: 'tierra', [SUELOS.tierra.id]: 'tierra' };
// que tipo de huella deja cada suelo (ver huellas.js): 1 barro hondo, 2 surco de arena, 3 pasto aplastado, 4 tierra, 5 ripio
const HUELLA_DE = { [SUELOS.barro.id]: 1, [SUELOS.pantano.id]: 1, [SUELOS.charco.id]: 1, [SUELOS.arena.id]: 2, [SUELOS.feshfesh.id]: 2, [SUELOS.pasto.id]: 3, [SUELOS.tierra.id]: 4, [SUELOS.sendero.id]: 4, [SUELOS.pedregal.id]: 4, [SUELOS.ripio.id]: 5, [SUELOS.gravilla.id]: 5 };
const TRAMA = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
function nube(p, lado, tupida, tonos) {
  const c = (lado - 1) / 2;
  for (let y = 0; y < lado; y++) for (let x = 0; x < lado; x++) {
    const d = Math.hypot(x - c, y - c) / (lado / 2);
    if (d > 1) continue;
    // mas rala hacia el borde; los huecos van en trama, como se sombrea en pixel art
    const cuanto = tupida * (1.15 - d * d * 0.9) + (p.azar() - 0.5) * 0.2;
    if (cuanto * 16 <= TRAMA[(y & 3) * 4 + (x & 3)] + 0.5) continue;
    p.punto(x, y, tonos[y - x * 0.4 < lado * 0.22 ? 2 : y - x * 0.4 > lado * 0.5 ? 0 : 1]);
  }
}

// seco: de 0 (llueve: no hay polvo) a 1.  viento: hacia donde se lo lleva, en m/s [x, z].
// liviano: celular o tablet (menos hojas y menos humo).
// opciones.grande: la polvareda grande (ver arriba). Sin esa opcion no cambia nada de lo de siempre.
export function crearEfectos(escena, huellas, seco = 1, viento = [0.5, 0.3], liviano = false, opciones = {}) {
  const grande = !!opciones.grande;
  let escalaGrande = 1;   // que tan grande sale la polvareda grande (depende de la camara: de lejos, mas grande)
  // el ajuste "efectos": apagado, no hay humo de frenada, hojas, ni huellas que se oscurecen o se ensanchan
  let activo = true;
  // por rueda: si venia tocando el piso, cuanto barro lleva pegado (lo va dejando en lo que pisa despues) y cuanto falta para la proxima nube
  const rueda = [0, 1, 2, 3].map(() => ({ toca: false, barro: 0, x: 0, z: 0, falta: 0 }));
  const az = Math.random;

  // --- cubitos que saltan: barro y agua ---
  const NP = 220, NE = 9, M = new THREE.Matrix4(), tmp = new THREE.Color();
  const motas = new THREE.InstancedMesh(new THREE.BoxGeometry(0.25, 0.25, 0.25), new THREE.MeshLambertMaterial({ map: granito() }), NP);
  motas.frustumCulled = false;
  const D = new Float32Array(NP * NE);   // x, y, z, vx, vy, vz, vida, tamano, gravedad
  for (let i = 0; i < NP; i++) { motas.setMatrixAt(i, M.makeScale(0, 0, 0)); motas.setColorAt(i, tmp); }
  escena.add(motas);
  let sig = 0;
  function mota(x, y, z, vx, vy, vz, vida, tam, color, brillo, grav = 13) {
    const o = sig * NE;
    D[o] = x; D[o + 1] = y; D[o + 2] = z; D[o + 3] = vx; D[o + 4] = vy; D[o + 5] = vz; D[o + 6] = vida; D[o + 7] = tam; D[o + 8] = grav;
    motas.setColorAt(sig, tmp.setHex(color).multiplyScalar(brillo));
    motas.instanceColor.needsUpdate = true;
    sig = (sig + 1) % NP;
  }

  // --- nubes de polvo ---
  const atlas = grande ? crearAtlas(512, 256) : crearAtlas(256, 128), zonas = {}, zonasG = {};
  for (const nombre in POLVOS) zonas[nombre] = [0, 1].map((variante) => EDADES.map(([lado, tupida], k) => atlas.zona(lado, lado, (p) => nube(p, lado, tupida, POLVOS[nombre]), 5 + variante * 13 + k)));
  if (grande) for (const nombre in POLVOS_G) zonasG[nombre] = [0, 1].map((variante) => EDADES_G.map(([lado, tupida], k) => atlas.zona(lado, lado, (p) => nube(p, lado, tupida, POLVOS_G[nombre]), 105 + variante * 13 + k)));
  const textura = atlas.textura();
  textura.generateMipmaps = false; textura.minFilter = THREE.NearestFilter;
  const NN = grande ? (liviano ? 150 : 300) : 240, N = new Float32Array(NN * 9);   // x, y, z, vx, vy, vz, edad, vida, escala
  const quienes = new Array(NN).fill(null);       // de cada nube: las zonas de sus cuatro edades
  const esGrande = new Array(NN).fill(false);     // y si es de la polvareda grande
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0], 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  const dato = (n) => { const a = new THREE.InstancedBufferAttribute(new Float32Array(NN * n), n); a.setUsage(THREE.DynamicDrawUsage); return a; };
  const aBase = dato(3), aTam = dato(2), aUv = dato(4);
  g.setAttribute('aBase', aBase); g.setAttribute('aTam', aTam); g.setAttribute('aUv', aUv); g.setAttribute('aDato', dato(4));
  g.instanceCount = NN;
  const nubes = new THREE.Mesh(g, estilo(new THREE.MeshLambertMaterial({ map: textura, alphaTest: 0.5, side: THREE.DoubleSide }), { sprite: true, clave: 'polvo' }));
  nubes.frustumCulled = false;
  escena.add(nubes);
  let sigNube = 0;
  function polvo(x, y, z, vx, vz, suelo, grande) {
    const o = sigNube * 9, lista = zonas[POLVO_DE[suelo] || 'gris'];
    N[o] = x; N[o + 1] = y; N[o + 2] = z; N[o + 3] = vx; N[o + 4] = 0.5 + az() * 0.5; N[o + 5] = vz; N[o + 6] = 0; N[o + 7] = (3 + az() * 1.8) * (grande ? 1.2 : 1); N[o + 8] = 1;
    quienes[sigNube] = lista[az() < 0.5 ? 0 : 1]; esGrande[sigNube] = false;
    sigNube = (sigNube + 1) % NN;
  }
  // una nube de la polvareda grande: sube y se queda flotando varios segundos mientras el viento la corre
  function polvoGrande(x, y, z, vx, vz, suelo, fuerza) {
    const o = sigNube * 9, lista = zonasG[POLVO_G_DE[suelo] || 'tierra'];
    N[o] = x; N[o + 1] = y; N[o + 2] = z; N[o + 3] = vx; N[o + 4] = 1.8 + az() * 1.4; N[o + 5] = vz; N[o + 6] = 0;
    N[o + 7] = (5 + az() * 3.5) * (liviano ? 0.75 : 1); N[o + 8] = (0.75 + az() * 0.4) * (0.8 + 0.3 * fuerza) * escalaGrande;
    quienes[sigNube] = lista[az() < 0.5 ? 0 : 1]; esGrande[sigNube] = true;
    sigNube = (sigNube + 1) % NN;
  }

  // --- hojas y pastitos: vuelan al pasar el auto rapido por el borde del camino ---
  const HOJAS = { [SUELOS.pasto.id]: [0x6f8f45, 0x8a9a4a, 0xb0a050, 0x587a3a], [SUELOS.tierra.id]: [0x9a7a40, 0xa88b52, 0x7d6a3a], [SUELOS.ripio.id]: [0x9a7a40, 0xa88b52, 0x8a8a52] };
  let debenHojas = 0;
  function hojas(c, dt, vh) {
    const paleta = HOJAS[c.suelo];
    if (!paleta || vh < 6) return;
    debenHojas += (vh - 6) / 14 * (liviano ? 2.5 : 5) * dt;
    const d = c.derecha, f = c.adelante, p = c.ruedas[0].p;
    while (debenHojas >= 1) {
      debenHojas--;
      const lado = az() < 0.5 ? -1 : 1, cerca = 1.6 + az() * 2.2, adel = (az() - 0.5) * 5;
      mota(c.pos[0] + d[0] * lado * cerca + f[0] * adel, p[1] + 0.15, c.pos[2] + d[2] * lado * cerca + f[2] * adel,
        c.vel[0] * 0.12 + d[0] * lado * 0.8 + viento[0] * 0.7, 1.4 + az() * 1.8, c.vel[2] * 0.12 + d[2] * lado * 0.8 + viento[1] * 0.7,
        1.3 + az() * 0.7, 1, paleta[Math.floor(az() * paleta.length)], 0.85 + az() * 0.3, 1.8);
    }
  }

  function actualizar(c, dt) {
    const f = c.adelante, d = c.derecha, vh = Math.hypot(c.vel[0], c.vel[2]);
    c.ruedas.forEach((r, i) => {
      const w = rueda[i], s = SUELO[r.suelo];
      if (!r.toca) { if (w.toca) huellas.soltar(i); w.toca = false; return; }
      const vel = Math.abs(r.vl), mojado = c.agua > 0.05;
      // traba: cuanto humea la rueda por frenar fuerte o por el freno de mano (solo lo ve quien tiene los efectos prendidos)
      const traba = activo ? Math.min(1, (c.frenando && vh > 3 ? Math.min(1, (vh - 3) / 10) * c.freno * (r.delantera ? 0.75 : 1) : 0) + (c.mano && !r.delantera && vh > 3 ? Math.min(1, vh / 8) : 0)) : 0;
      const resbala = Math.min(1, Math.max(r.patina + r.cruza * 2.2, traba * 0.85));   // cuanto patina o va de costado esta rueda (0 a 1)
      // el barro se pega a la cubierta y se va soltando en los metros siguientes (en el agua se lava)
      const paso = Math.hypot(r.p[0] - w.x, r.p[2] - w.z);
      w.x = r.p[0]; w.z = r.p[2];
      if (w.toca && paso < 3) w.barro *= Math.exp(-paso / (mojado ? 1.5 : 7));
      if (s.blando >= 1) w.barro = 1;
      // huella: siempre que el piso sea blando, y bien marcada cuando la rueda resbala (hasta en el asfalto deja la goma)
      const fuerza = mojado ? 0 : Math.min(1, Math.max(s.blando * (0.7 + resbala * 0.6), w.barro * 0.5, resbala * 0.8));
      // donde el piso es blando, cada pasada de mas oscurece la marca; al derrapar el surco se ensancha
      // (con los efectos prendidos, en barro y arena el surco es doble: se hunde la rueda y la tierra se corre al costado)
      const tipoH = HUELLA_DE[r.suelo] || 0;
      huellas.marcar(i, r.p[0], r.p[2], fuerza < 0.12 ? 0 : fuerza, activo && s.blando >= 0.3 ? (tipoH === 5 ? 0 : tipoH === 4 ? 8 : Math.round(18 + s.blando * 40)) : 0, activo && ((resbala > 0.55 && s.blando > 0) || tipoH === 1 || tipoH === 2), tipoH);

      // polvo: una nube cada tantos metros, mas seguido cuanto mas rapido va y cuanto mas resbala la rueda.
      // Lo levantan sobre todo las ruedas de atras; en el asfalto solo hay humo de goma si se va muy cruzado.
      const levanta = mojado ? 0 : seco * (s.polvo * (0.4 + Math.min(1, vh / 16) * 0.6 + resbala * 1.3) + (s.blando === 0 ? Math.max(0, resbala - 0.45) * 1.6 : 0) + traba * 1.2) * (r.delantera ? 0.45 + traba * 0.4 : 1);
      // polvareda grande (solo con los efectos prendidos): la sueltan las ruedas de atras, mas espaciada y mas grande
      const enorme = grande && activo && !!POLVO_G_DE[r.suelo] && !mojado;
      if (enorme) {
        if (w.toca && paso < 3 && vh > 3 && !r.delantera) {
          w.grande = (w.grande || 0) - paso * (0.45 + Math.min(1, vh / 14) * 0.55 + resbala * 0.6) * s.polvo;
          if (w.grande <= 0) {
            w.grande = (1.8 + az() * 1.3) * (liviano ? 1.8 : 1);
            polvoGrande(r.p[0] - f[0] * 2.4 + (az() - 0.5) * 1.2, r.p[1] + 0.3, r.p[2] - f[2] * 2.4 + (az() - 0.5) * 1.2, c.vel[0] * 0.2 + d[0] * (az() - 0.5) * 7, c.vel[2] * 0.2 + d[2] * (az() - 0.5) * 7, r.suelo, Math.min(1, vh / 22 + resbala));
          }
        }
      }
      const chico = !enorme || (r.delantera && az() < 0.1);   // (con la polvareda grande, las de adelante casi no sueltan nubes chicas)
      if (chico && w.toca && paso < 3 && levanta > 0.02 && vh > 2.5) {
        w.falta -= paso * levanta;
        if (w.falta <= 0) {
          w.falta = 1.1 + az() * 0.7;
          polvo(r.p[0] + (az() - 0.5) * 0.5, r.p[1] + 0.05, r.p[2] + (az() - 0.5) * 0.5, c.vel[0] * 0.16 + d[0] * (az() - 0.5) * 1.4, c.vel[2] * 0.16 + d[2] * (az() - 0.5) * 1.4, r.suelo, resbala > 0.5);
        }
      }
      w.toca = true;

      // lo que salta: barro si patina o va rapido por lo blando, agua en el vado, y alguna piedrita cuando la rueda patina en seco
      const pesado = s.blando >= 0.9;
      const cuanto = ((pesado ? Math.max(r.patina, traba * 0.8) * 1.3 + Math.min(1, vel / 9) * 0.5 : r.patina * 0.35 * s.blando) + (mojado ? Math.min(1, vel / 5) + traba * 0.5 : 0)) * 45 * dt;
      if (az() < cuanto) {
        const tira = -c.sentido * (1.5 + r.patina * 7), sube = 2 + az() * 3.5, abre = (az() - 0.5) * 3.2;
        mota(r.p[0], r.p[1] + 0.1, r.p[2],
          c.vel[0] * 0.5 + f[0] * tira + d[0] * abre, sube * (pesado || mojado ? 1 : 0.5) + c.vel[1] * 0.5, c.vel[2] * 0.5 + f[2] * tira + d[2] * abre,
          pesado || mojado ? 0.75 : 0.45, 1 + Math.floor(az() * (pesado || mojado ? 3 : 1.5)), mojado ? 0xcfe3e6 : s.color, mojado ? 1 : 0.7 + az() * 0.3);
      }
    });
    if (activo) hojas(c, dt, vh);
    huellas.subir();

    for (let i = 0; i < NP; i++) {
      const o = i * NE;
      if (D[o + 6] <= 0) continue;
      D[o + 6] -= dt; D[o + 4] -= D[o + 8] * dt;
      if (D[o + 8] < 5) { D[o + 3] += Math.sin(D[o + 6] * 9 + i) * 3 * dt; D[o + 5] += Math.cos(D[o + 6] * 7 + i) * 3 * dt; }   // las hojas revolotean
      D[o] += D[o + 3] * dt; D[o + 1] += D[o + 4] * dt; D[o + 2] += D[o + 5] * dt;
      // el tamano va de a medio pixel (12,5 cm) y al final se achica de golpe, sin girar: son cubitos
      const t = D[o + 6] <= 0 ? 0 : D[o + 7] * (D[o + 6] < 0.12 ? 0.25 : 0.5);
      motas.setMatrixAt(i, M.makeScale(t, t, t).setPosition(D[o], D[o + 1], D[o + 2]));
    }
    motas.instanceMatrix.needsUpdate = true;

    // las nubes: frenan enseguida, suben despacio, se las lleva el viento y van pasando de edad
    const frena = Math.exp(-dt * 2.2);
    for (let i = 0; i < NN; i++) {
      const o = i * 9, q = quienes[i];
      if (!q) continue;
      N[o + 6] += dt;
      const u = N[o + 6] / N[o + 7];
      if (u >= 1) { quienes[i] = null; aTam.array[i * 2] = aTam.array[i * 2 + 1] = 0; continue; }
      N[o + 3] *= frena; N[o + 5] *= frena; N[o + 4] += ((grande ? 0.6 : 0.22) - N[o + 4]) * Math.min(1, dt * 1.5);
      N[o] += (N[o + 3] + viento[0]) * dt; N[o + 1] += N[o + 4] * dt; N[o + 2] += (N[o + 5] + viento[1]) * dt;
      const z = q[u < 0.12 ? 0 : u < 0.36 ? 1 : u < 0.68 ? 2 : 3], lado = z.w / 8 * (N[o + 8] || 1);
      aBase.array[i * 3] = N[o]; aBase.array[i * 3 + 1] = N[o + 1] - lado * 0.3; aBase.array[i * 3 + 2] = N[o + 2];
      aTam.array[i * 2] = aTam.array[i * 2 + 1] = lado;
      aUv.array[i * 4] = z.x / atlas.ancho; aUv.array[i * 4 + 1] = z.y / atlas.alto; aUv.array[i * 4 + 2] = z.w / atlas.ancho; aUv.array[i * 4 + 3] = z.h / atlas.alto;
    }
    aBase.needsUpdate = aTam.needsUpdate = aUv.needsUpdate = true;
  }

  // el auto cambio de lugar de golpe (una vuelta al camino): las huellas no se unen con las de antes
  function cortar() { rueda.forEach((w) => { w.toca = false; w.barro = 0; }); huellas.cortar(); }
  // al largar de nuevo: no queda polvo de la pasada anterior
  function limpiar() { quienes.fill(null); aTam.array.fill(0); aTam.needsUpdate = true; for (let i = 0; i < NP; i++) D[i * NE + 6] = 0; }
  return { actualizar, cortar, limpiar, prender: (v) => { activo = !!v; }, escala: (v) => { escalaGrande = v; }, nubes: () => quienes.filter(Boolean).length, nubesGrandes: () => quienes.filter((q, i) => q && esGrande[i]).length };
}

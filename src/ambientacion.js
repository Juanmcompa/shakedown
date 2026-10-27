// El ambiente de la pista: lo que pasa alrededor del camino sin cambiar nada de como se maneja.
//   hojas que caen de los arboles (bosque y campo), petalos en el campo, viento con arena en lo seco,
//   polillas y luciernagas en la luz de los faros (de noche) y animales (ovejas, vacas, caballos, perros) que se asustan y salen corriendo.
// Todo se sortea con la semilla de la pista (un generador propio: no toca el sorteo de la pista ni el del manejo) y lo ve quien
// tiene prendido el ajuste "efectos". Son dibujos planos de pocos pixeles que miran a la camara, como los del resto del juego.
// La gente con antorchas y los flashes de las fotos estan en publico.js.
import * as THREE from '../vendor/three.module.js';
import { azar } from './noise.js';
import { crearAtlas } from './pixel.js';
import { crearLoteDeSprites } from './sprites.js';
import { estilo } from './material.js';

const PX = 8;   // pixeles por metro (como los sprites)

// --- los dibujitos de las particulas: [nombre, ancho, alto, como se pinta] (varias versiones de color) ---
const COLORES = {
  hojaVerde: ['#6f8f45', '#8a9a4a', '#58783a'], hojaRoja: ['#b5472a', '#d8702f', '#8a2f1c'], hojaAmarilla: ['#dba526', '#f0c43a', '#b9801c'], hojaSeca: ['#a8834f', '#8f7040', '#c2a266'],
  petalo: ['#f4efe4', '#f2a6c0', '#f2d24a', '#ffffff'],
  arena: ['#d9bd86', '#e8d6ab', '#c9a870'],
  polilla: ['#ffe9a8', '#e6ff9a', '#fff6d0'],
};
function lienzoDeParticulas() {
  const atlas = crearAtlas(128, 64), zonas = {};
  for (const nombre in COLORES) {
    const [w, h] = nombre === 'arena' ? [6, 1] : nombre.startsWith('hoja') ? [3, 2] : nombre === 'petalo' ? [2, 2] : [2, 2];
    zonas[nombre] = COLORES[nombre].map((color, k) => {
      const z = atlas.zona(w, h, (p) => {
        p.fondo(color);
        if (nombre.startsWith('hoja')) p.punto(k % 2 ? 0 : 2, 1, COLORES[nombre][(k + 1) % 3]);   // la hoja no es un rectangulo parejo
      }, 3 + k, nombre === 'polilla' ? 0 : 1);   // (las polillas con los colores sin apagar: tienen luz propia)
      z.clase = nombre;
      return z;
    });
  }
  const textura = atlas.textura();
  textura.generateMipmaps = false; textura.minFilter = THREE.NearestFilter;
  return { atlas, zonas, textura };
}

// Un grupo de particulas: cada una es un cuadradito que mira a la camara. brillante: con luz propia (polillas, luciernagas).
function crearParticulas(NN, dibujos, brillante) {
  const { atlas, textura } = dibujos;
  const D = new Float32Array(NN * 10), zon = new Array(NN).fill(null);   // x, y, z, vx, vy, vz, edad, vida, escala, tipo de movimiento
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0], 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  const dato = (n) => { const a = new THREE.InstancedBufferAttribute(new Float32Array(NN * n), n); a.setUsage(THREE.DynamicDrawUsage); return a; };
  const aBase = dato(3), aTam = dato(2), aUv = dato(4), aDato = dato(4);
  g.setAttribute('aBase', aBase); g.setAttribute('aTam', aTam); g.setAttribute('aUv', aUv); g.setAttribute('aDato', aDato);
  g.instanceCount = NN;
  const mat = brillante ? new THREE.MeshBasicMaterial({ map: textura, alphaTest: 0.5, side: THREE.DoubleSide, color: new THREE.Color(2.8, 2.6, 1.8) })
    : new THREE.MeshLambertMaterial({ map: textura, alphaTest: 0.5, side: THREE.DoubleSide });
  const malla = new THREE.Mesh(g, estilo(mat, { sprite: true, clave: brillante ? 'luzp' : 'part' }));
  malla.frustumCulled = false; malla.visible = true;
  let sig = 0, vivas = 0;
  return {
    malla, cuantas: () => vivas, NN,
    cuantasDe: (prefijo) => zon.filter((z) => z && z.clase.startsWith(prefijo)).length,
    // mov: 0 = cae y se mece (hojas, petalos)   1 = vuela derecho (arena)   2 = revolotea (polillas)
    poner(z, x, y, zz, vx, vy, vz, vida, escala, mov) {
      for (let k = 0; k < NN; k++) {   // un lugar libre (si no hay, se pisa la mas vieja)
        const i = (sig + k) % NN;
        if (!zon[i]) { sig = i; break; }
      }
      const o = sig * 10;
      D[o] = x; D[o + 1] = y; D[o + 2] = zz; D[o + 3] = vx; D[o + 4] = vy; D[o + 5] = vz; D[o + 6] = 0; D[o + 7] = vida; D[o + 8] = escala; D[o + 9] = mov;
      if (!zon[sig]) vivas++;
      zon[sig] = z;
      sig = (sig + 1) % NN;
    },
    // dt: segundos. t: reloj. viento: [x, z] m/s. suelo(x, z): altura del piso. lejos(x, z): si ya se fue lejos del auto (se la saca)
    actualizar(dt, t, viento, suelo, lejos) {
      for (let i = 0; i < NN; i++) {
        const z = zon[i], o = i * 10;
        if (!z) { aTam.array[i * 2] = aTam.array[i * 2 + 1] = 0; continue; }
        D[o + 6] += dt;
        const edad = D[o + 6], vida = D[o + 7], mov = D[o + 9];
        if (edad >= vida || lejos(D[o], D[o + 2])) { zon[i] = null; vivas--; aTam.array[i * 2] = aTam.array[i * 2 + 1] = 0; continue; }
        if (mov === 0) {
          D[o + 3] += ((viento[0] * 2.2 + Math.sin(edad * 2.3 + i) * 0.7) - D[o + 3]) * Math.min(1, dt * 1.5);
          D[o + 5] += ((viento[1] * 2.2 + Math.cos(edad * 1.9 + i * 2) * 0.7) - D[o + 5]) * Math.min(1, dt * 1.5);
        } else if (mov === 2) {
          D[o + 3] += (Math.sin(edad * 3.1 + i * 5) * 1.2 - D[o + 3]) * Math.min(1, dt * 3); D[o + 5] += (Math.cos(edad * 2.7 + i * 3) * 1.2 - D[o + 5]) * Math.min(1, dt * 3);
          D[o + 4] += (Math.sin(edad * 2.2 + i) * 0.5 - D[o + 4]) * Math.min(1, dt * 3);
        }
        D[o] += D[o + 3] * dt; D[o + 1] += D[o + 4] * dt; D[o + 2] += D[o + 5] * dt;
        const piso = suelo(D[o], D[o + 2]);
        if (D[o + 1] < piso + 0.03 && mov !== 2) {   // llego al piso: la hoja o el petalo se queda un rato (y se va achicando)
          D[o + 1] = piso + 0.03; D[o + 3] = D[o + 4] = D[o + 5] = 0; D[o + 9] = 3; D[o + 7] = Math.min(vida, edad + 1.5);
        }
        if (mov === 2 && D[o + 1] < piso + 0.3) D[o + 4] = Math.abs(D[o + 4]);
        // se achica de a poco al final de su vida (y las polillas titilan)
        const resto = (vida - edad) / Math.min(vida, 1.2), lado = z.w / PX * D[o + 8] * Math.min(1, resto) * (brillante && Math.sin(edad * 17 + i * 3) > 0.7 ? 0.2 : 1);
        aBase.array[i * 3] = D[o]; aBase.array[i * 3 + 1] = D[o + 1] - 0.05; aBase.array[i * 3 + 2] = D[o + 2];
        aTam.array[i * 2] = lado; aTam.array[i * 2 + 1] = z.h / PX * D[o + 8] * Math.min(1, resto);
        const r = z.rect || z;
        aUv.array[i * 4] = r.x / atlas.ancho; aUv.array[i * 4 + 1] = r.y / atlas.alto; aUv.array[i * 4 + 2] = r.w / atlas.ancho; aUv.array[i * 4 + 3] = r.h / atlas.alto;
      }
      aBase.needsUpdate = aTam.needsUpdate = aUv.needsUpdate = true;
    },
    limpiar() { zon.fill(null); vivas = 0; aTam.array.fill(0); aTam.needsUpdate = true; },
  };
}

// que arboles sueltan hojas, y de que color (tipo -> [claves de COLORES])
const HOJAS_DE = { lenga: ['hojaRoja', 'hojaAmarilla'], nire: ['hojaAmarilla', 'hojaAmarilla', 'hojaRoja'], alamo: ['hojaVerde', 'hojaAmarilla'], eucalipto: ['hojaVerde', 'hojaSeca'] };
const ALTO_DE = { lenga: 5.2, nire: 5.2, alamo: 7, eucalipto: 7 };   // a que altura (por unidad de tamano) esta la copa

// los animales: [dibujo, cuantos por grupo, velocidad al correr] por ambiente
const ANIMALES = {
  campo: [['oveja', [3, 7], 6], ['vacaOvera', [2, 4], 4.2], ['vacaColorada', [2, 3], 4.2], ['caballo', [1, 3], 9.5], ['oveja', [4, 8], 6]],
  bosque: [['caballo', [1, 2], 9], ['perro', [1, 1], 8], ['oveja', [2, 4], 6]],
  montana: [['oveja', [3, 6], 6.5], ['caballo', [1, 2], 9.5], ['perro', [1, 1], 8]],
  sierra: [['oveja', [3, 6], 6.5], ['vacaColorada', [1, 3], 4.2], ['caballo', [1, 2], 9.5]],
};

// T: el terreno. opciones: { liviano, luz: () => la luz de ahora (world.js), viento: [x, z] }
export function crearAmbientacion(T, escena, { liviano = false, luz = () => ({}), viento = [0.5, 0.3] } = {}) {
  const semilla = (T.etapa.semilla || 1) >>> 0, rnd = azar(semilla * 7 + 4243), P = T.camino, az = Math.random;
  const mias = rnd;
  let activo = true;
  // lo que se sortea con la semilla: cuanto hay de cada cosa en esta pista (0 a 1)
  const fuerza = { hojas: 0.45 + mias() * 0.55, petalos: mias() < 0.65 ? 0.4 + mias() * 0.6 : 0.12, arena: mias() < 0.7 ? 0.35 + mias() * 0.65 : 0.1, polillas: 0.5 + mias() * 0.5 };
  const fase = mias() * 6.28;
  const depurar = { todo: false };   // (para las pruebas) todo al maximo y en cualquier ambiente

  const dib = lienzoDeParticulas();
  const NP = liviano ? 70 : 150, normales = crearParticulas(NP, dib, false), luces = crearParticulas(liviano ? 14 : 30, dib, true);
  escena.add(normales.malla, luces.malla);
  const suelo = (x, z) => T.altura(x, z);
  let lejosDe = [0, 0];
  const lejos = (x, z) => Math.abs(x - lejosDe[0]) > 60 || Math.abs(z - lejosDe[1]) > 60;
  const pieza = (clave) => { const l = dib.zonas[clave]; return l[Math.floor(az() * l.length)]; };

  // los arboles que sueltan hojas (los de hoja ancha), para sacarlas de la copa
  const arboles = T.cosas.filter((o) => o.clase === 'arbol' && HOJAS_DE[o.tipo]);
  let cerca = [], cercaT = 0;

  // --- los animales ---
  const lote = crearLoteDeSprites(), animales = [];
  const bichos = ANIMALES;
  const aguaMin = T.aguas && T.aguas.length ? Math.min(...T.aguas.map((a) => a.nivel)) + 0.2 : -1e9;
  {
    const ra = azar(semilla * 13 + 99);
    const libre = (x, z) => {
      if (x < T.x0 + 6 || z < T.z0 + 6 || x > T.x1 - 6 || z > T.z1 - 6) return false;
      const k = Math.round(z - T.z0) * T.nx + Math.round(x - T.x0);
      if (T.S[k] !== 4 || T.borde[k] < 3.5 || T.pelado[k] || T.cultivo[k] || T.altura(x, z) < aguaMin) return false;
      if (T.claros.some((q) => (q.x - x) ** 2 + (q.z - z) ** 2 < (q.r + 2) ** 2)) return false;
      const e = 1.2; if (Math.hypot(T.altura(x + e, z) - T.altura(x - e, z), T.altura(x, z + e) - T.altura(x, z - e)) / (2 * e) > 0.35) return false;
      return !T.cosas.length || !(T.cosasCerca && (T.cosasCerca(x, z) || []).some((o) => o.clase !== 'poste' && Math.hypot(o.x - x, o.z - z) < o.r + 0.8));
    };
    // un grupo cada tantos metros del camino; la mayoria lejos (en el campo), algunos cerca del borde
    let i = 25 + Math.floor(ra() * 40);
    while (i < P.n - 20) {
      const lado = ra() < 0.5 ? -1 : 1, cerquita = ra() < 0.16, dist = P.W[i] / 2 + (cerquita ? 4 + ra() * 5 : 10 + ra() * 24);
      const cx = P.X[i] - P.HZ[i] * lado * dist, cz = P.Z[i] + P.HX[i] * lado * dist, lista = bichos[T.biomaEn(cx, cz)] || bichos.campo;
      // en una montaña o un bosque, menos grupos
      const raro = T.biomaEn(cx, cz) === 'bosque' || T.biomaEn(cx, cz) === 'montana' ? 0.45 : 1;
      if (ra() < raro) {
        const [dibujo, [mn, mx], vel] = lista[Math.floor(ra() * lista.length)], n = mn + Math.floor(ra() * (mx - mn + 1));
        for (let k = 0; k < n; k++) {
          const x = cx + (ra() - 0.5) * 7, z = cz + (ra() - 0.5) * 7;
          if (!libre(x, z)) continue;
          const y = T.altura(x, z), esc = dibujo === 'caballo' ? 1.2 : dibujo === 'perro' ? 1 : 1.25 + ra() * 0.2, f = ra();
          animales.push({ dibujo, x, z, y, x0: x, z0: z, vx: 0, vz: 0, vel: vel * (0.8 + ra() * 0.4), n: lote.poner(dibujo, x, y - 0.05, z, { escala: esc, azar: f, mueve: 0 }), susto: 0, f, pausa: 0 });
        }
      }
      i += 55 + Math.floor(ra() * 90);
    }
  }
  const malla = lote.cuantos() ? lote.malla(true) : null;
  if (malla) { malla.frustumCulled = false; escena.add(malla); }
  const aBase = malla ? malla.geometry.getAttribute('aBase') : null;
  if (aBase) aBase.setUsage(THREE.DynamicDrawUsage);

  let t = 0, deben = { hojas: 0, petalos: 0, arena: 0, polillas: 0 };
  const seco = () => 1 - (luz().mojado || 0);
  function actualizar(c, dt, reloj) {
    if (!activo) return;
    t = reloj === undefined ? t + dt : reloj;
    lejosDe = [c.pos[0], c.pos[2]];
    const bioma = T.biomaEn(c.pos[0], c.pos[2]), L = luz(), noche = !!L.faros || T.etapa.hora === 'noche', todo = depurar.todo;
    const sec = todo ? 1 : seco() > 0.6 ? 1 : 0;

    // los arboles de al lado (se rearma una vez por segundo)
    if ((cercaT -= dt) <= 0) {
      cercaT = 1;
      cerca = arboles.filter((o) => Math.abs(o.x - c.pos[0]) < 38 && Math.abs(o.z - c.pos[2]) < 38);
    }
    // hojas: de la copa de un arbol cercano. En el otoño del bosque (lengas) caen mas.
    if (cerca.length && (todo || bioma === 'bosque' || bioma === 'campo' || bioma === 'montana')) {
      deben.hojas += (todo ? 1 : fuerza.hojas) * (bioma === 'bosque' ? 1.5 : 0.8) * (liviano ? 3.5 : 7) * dt;
      while (deben.hojas >= 1) {
        deben.hojas--;
        const o = cerca[Math.floor(az() * cerca.length)], claves = HOJAS_DE[o.tipo], alto = (o.alto / 1.2) * (ALTO_DE[o.tipo] || 5) * (0.5 + az() * 0.45);
        normales.poner(pieza(claves[Math.floor(az() * claves.length)]), o.x + (az() - 0.5) * 3, o.y + alto, o.z + (az() - 0.5) * 3, (az() - 0.5) * 0.8, -(0.7 + az() * 0.6), (az() - 0.5) * 0.8, 9, 1.5, 0);
      }
    }
    // petalos: en el campo, llevados por el viento
    if (sec && (todo || bioma === 'campo')) {
      deben.petalos += (todo ? 1 : fuerza.petalos) * (liviano ? 3 : 7) * dt;
      while (deben.petalos >= 1) {
        deben.petalos--;
        const a = az() * 6.28, d = 4 + az() * 26, x = c.pos[0] + Math.cos(a) * d, z = c.pos[2] + Math.sin(a) * d;
        if (!todo && T.biomaEn(x, z) !== 'campo') continue;
        normales.poner(pieza('petalo'), x, suelo(x, z) + 0.6 + az() * 2.2, z, viento[0] * 2, -0.25 - az() * 0.3, viento[1] * 2, 6 + az() * 5, 1.4, 0);
      }
    }
    // viento con arena: rafagas que cruzan en el sentido del viento, bajo, sobre todo en lo seco
    const seca = bioma === 'montana' || bioma === 'sierra' ? 1 : bioma === 'campo' ? 0.55 : 0;
    const rafaga = Math.pow(Math.max(0, Math.sin(t * 0.22 + fase)), 2);
    if (sec && (todo || (seca > 0 && rafaga > 0.05))) {
      deben.arena += (todo ? 1 : fuerza.arena * seca * rafaga) * (liviano ? 40 : 85) * dt;
      const vv = 8 + (todo ? 4 : rafaga * 6), ang = Math.atan2(viento[1], viento[0]), dx = Math.cos(ang), dz = Math.sin(ang);
      while (deben.arena >= 1) {
        deben.arena--;
        const ao = (az() - 0.5) * 50, bo = (az() - 0.5) * 50, x = c.pos[0] + dx * (-26 + ao * 0.2) - dz * bo, z = c.pos[2] + dz * (-26 + ao * 0.2) + dx * bo;
        normales.poner(pieza('arena'), x, suelo(x, z) + 0.2 + az() * 1.6, z, dx * vv, 0, dz * vv, 3.4 + az() * 1.6, 1.6, 1);
      }
    }
    // polillas y luciernagas en la luz de los faros (de noche, en el bosque y el campo)
    if (sec && noche && (todo || bioma === 'bosque' || bioma === 'campo')) {
      deben.polillas += (todo ? 1 : fuerza.polillas) * (liviano ? 2.5 : 5) * dt;
      const f = c.adelante;
      while (deben.polillas >= 1 && luces.cuantas() < luces.NN - 2) {
        deben.polillas--;
        const d = 3 + az() * 13, la = (az() - 0.5) * 9, x = c.pos[0] + f[0] * d - f[2] * la, z = c.pos[2] + f[2] * d + f[0] * la;
        luces.poner(pieza('polilla'), x, suelo(x, z) + 0.6 + az() * 1.8, z, 0, 0, 0, 4 + az() * 4, 1.3, 2);
      }
    }
    normales.actualizar(dt, t, viento, suelo, lejos);
    luces.actualizar(dt, t, viento, suelo, lejos);

    // animales: si el auto viene cerca, se asustan y salen corriendo hacia el lado contrario
    if (aBase) {
      const vh = Math.hypot(c.vel[0], c.vel[2]);
      for (const a of animales) {
        const dx = a.x - c.pos[0], dz = a.z - c.pos[2], d = Math.hypot(dx, dz);
        // se asustan con el auto cerca (mas lejos cuanto mas rapido viene, mas aun los caballos y los perros)
        const alerta = 11 + Math.min(1, vh / 22) * 16 + (a.dibujo === 'caballo' || a.dibujo === 'perro' ? 5 : 0);
        if (d < alerta && vh > 1.5) {
          if (a.susto <= 0) { a.f2 = (az() - 0.5) * 0.9; }
          a.susto = 3 + az() * 2;
        }
        let corre = 0;
        if (a.susto > 0) {
          a.susto -= dt;
          // hacia afuera del auto, con un poco de desvio; si esta muy cerca, mas rapido
          const ux = dx / (d || 1), uz = dz / (d || 1), s = Math.sin(a.f2 || 0), co = Math.cos(a.f2 || 0), v = a.vel * (d < 8 ? 1.25 : 1) * (1 + Math.min(1, vh / 20) * 0.6);
          const tx = (ux * co - uz * s) * v, tz = (ux * s + uz * co) * v;
          a.vx += (tx - a.vx) * Math.min(1, dt * 6); a.vz += (tz - a.vz) * Math.min(1, dt * 6);
          corre = 1;
        } else { a.vx *= Math.exp(-dt * 4); a.vz *= Math.exp(-dt * 4); }
        const nx = a.x + a.vx * dt, nz = a.z + a.vz * dt;
        if (nx > T.x0 + 4 && nx < T.x1 - 4 && nz > T.z0 + 4 && nz < T.z1 - 4) { a.x = nx; a.z = nz; }
        const salto = corre * Math.abs(Math.sin(t * (a.dibujo === 'caballo' ? 11 : 14) + a.f * 20)) * (a.dibujo === 'caballo' ? 0.25 : 0.18);
        aBase.setXYZ(a.n, a.x, T.altura(a.x, a.z) - 0.05 + salto, a.z);
      }
      aBase.needsUpdate = true;
    }
  }

  // al largar de nuevo: cada animal vuelve a su lugar y no queda nada flotando
  function limpiar() {
    normales.limpiar(); luces.limpiar(); deben = { hojas: 0, petalos: 0, arena: 0, polillas: 0 };
    for (const a of animales) { a.x = a.x0; a.z = a.z0; a.vx = a.vz = 0; a.susto = 0; if (aBase) aBase.setXYZ(a.n, a.x, T.altura(a.x, a.z) - 0.05, a.z); }
    if (aBase) aBase.needsUpdate = true;
  }
  function prender(v) {
    activo = !!v;
    normales.malla.visible = luces.malla.visible = activo;
    if (malla) malla.visible = activo;
    if (!activo) { normales.limpiar(); luces.limpiar(); }
  }
  return {
    actualizar, limpiar, prender, depurar, fuerza,
    estado: () => ({ activo, hojas: normales.cuantasDe('hoja'), petalos: normales.cuantasDe('petalo'), arena: normales.cuantasDe('arena'), polillas: luces.cuantas(), animales: animales.length, visible: !!malla && malla.visible, visibles: normales.malla.visible }),
    animales: () => animales, tipos: () => ({ normales, luces }),
  };
}

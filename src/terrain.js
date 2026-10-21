// Construye el terreno de una pista: alturas, suelos, agua, arboles, piedras, publico y carteles.
// No dibuja nada: solo calcula. Lo usan la fisica y el dibujo.
import { SUELOS, SUELO } from './config.js';
import { BIOMAS, CLIMAS } from './generador.js';
import { EDIFICIOS, OBJETOS } from './edificios.js';
import { crearRuido, azar } from './noise.js';

const RAD = Math.PI / 180;
const suave = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const mezcla = (a, b, t) => a + (b - a) * t;
// "plano" de un tramo: metros de terreno parejo a cada lado del camino. Un numero vale para los dos lados; [izquierda, derecha], uno para cada uno.
const SIN_PLANO = [0, 0];
const planoDe = (t) => !t.plano ? SIN_PLANO : typeof t.plano === 'number' ? [t.plano, t.plano] : t.plano;

// cierra: el camino es una vuelta cerrada (despues del ultimo metro viene el primero)
function promedio(v, r, cierra) {
  const n = v.length, o = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0, c = 0;
    if (cierra) for (let j = i - r; j <= i + r; j++) { s += v[(j + n) % n]; c++; }
    else for (let j = Math.max(0, i - r); j <= Math.min(n - 1, i + r); j++) { s += v[j]; c++; }
    o[i] = s / c;
  }
  return o;
}

// Recorre los tramos y devuelve un punto del camino por metro.
// Si la etapa es una vuelta cerrada (etapa.vuelta), el ultimo metro llega justo al primero: lo poco que falte para cerrar
// (en el mapa y en la altura) se reparte entre todos los metros, y no se nota.
export function crearCamino(etapa) {
  let n = 0;
  for (const t of etapa.tramos) n += Math.round(t.largo);
  const F = () => new Float32Array(n);
  const P = { n, X: F(), Z: F(), Y: F(), HX: F(), HZ: F(), RL: F(), K: F(), S: new Uint8Array(n), T: new Uint16Array(n), U: F() };
  const pend = F(), ancho = F(), peralte = F(), rug = F();
  let x = 0, z = 0, rumbo = (etapa.rumbo || 0) * RAD, i = 0;
  etapa.tramos.forEach((t, k) => {
    const m = Math.round(t.largo), s = SUELOS[t.suelo];
    t.desde = i;
    for (let j = 0; j < m; j++, i++) {
      rumbo += (t.giro || 0) * RAD / m;
      P.HX[i] = Math.sin(rumbo); P.HZ[i] = -Math.cos(rumbo);
      x += P.HX[i]; z += P.HZ[i];
      P.X[i] = x; P.Z[i] = z;
      P.K[i] = (t.giro || 0) * RAD / m;   // cuanto dobla por metro (positivo = a la derecha)
      pend[i] = Math.tan((t.pendiente || 0) * RAD);
      ancho[i] = t.ancho || 8;
      peralte[i] = Math.tan((t.peralte || 0) * RAD);
      rug[i] = t.rugoso === undefined ? s.rugoso[0] : t.rugoso; P.RL[i] = s.rugoso[1];
      P.S[i] = s.id; P.T[i] = k; P.U[i] = j;
    }
    t.hasta = i;
  });
  const cierra = !!etapa.vuelta;
  if (cierra) { const fx = -x / n, fz = -z / n; for (i = 0; i < n; i++) { P.X[i] += fx * (i + 1); P.Z[i] += fz * (i + 1); } }
  P.G = promedio(pend, 5, cierra); P.W = promedio(ancho, 4, cierra); P.B = promedio(peralte, 5, cierra); P.R = promedio(rug, 3, cierra);
  if (cierra) { let sube = 0; for (i = 0; i < n; i++) sube += P.G[i]; for (i = 0; i < n; i++) P.G[i] -= sube / n; }
  let y = 0;
  for (i = 0; i < n; i++) { y += P.G[i]; P.Y[i] = y; }
  return P;
}
// El mismo camino, varias vueltas seguidas una atras de la otra. En una vuelta cerrada el juego corre siempre "en la del
// medio": asi lo que mira para adelante o para atras (las notas, la trazada, el fantasma) nunca se encuentra con un final.
// largo: cuantos metros mide una vuelta.
export function desenrollar(P, veces) {
  const n = P.n, Q = { n: n * veces, largo: n };
  for (const k in P) {
    const a = P[k];
    if (!a || a.length !== n) continue;
    const b = new a.constructor(n * veces);
    for (let v = 0; v < veces; v++) b.set(a, v * n);
    Q[k] = b;
  }
  return Q;
}

export function crearTerreno(etapa) {
  const ruido = crearRuido(etapa.semilla || 1), rnd = azar((etapa.semilla || 1) * 977);
  const bioma = BIOMAS[etapa.bioma] || BIOMAS.bosque, clima = CLIMAS[etapa.clima] || CLIMAS.sol;
  // Una pista puede pasar por mas de un ambiente: cada tramo dice el suyo con "bioma" (si no dice, es el de la etapa).
  // De cada lugar del mapa se anota en cual esta ("zona"): de eso salen su pasto, sus arboles, sus yuyos y su relieve.
  const biomas = [etapa.bioma];
  for (const t of etapa.tramos) if (t.bioma && BIOMAS[t.bioma] && !biomas.includes(t.bioma)) biomas.push(t.bioma);
  const BIO = biomas.map((id) => BIOMAS[id] || BIOMAS.bosque), varios = BIO.length > 1;
  const zonaDeTramo = etapa.tramos.map((t) => Math.max(0, biomas.indexOf(t.bioma || etapa.bioma)));
  const P = crearCamino(etapa);
  const celda = 1, margen = 74;
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (let i = 0; i < P.n; i++) {
    x0 = Math.min(x0, P.X[i]); x1 = Math.max(x1, P.X[i]); z0 = Math.min(z0, P.Z[i]); z1 = Math.max(z1, P.Z[i]);
  }
  x0 = Math.floor(x0 - margen); z0 = Math.floor(z0 - margen);
  const nx = Math.ceil((x1 + margen - x0) / celda) + 1, nz = Math.ceil((z1 + margen - z0) / celda) + 1;
  x1 = x0 + (nx - 1) * celda; z1 = z0 + (nz - 1) * celda;
  const H = new Float32Array(nx * nz), S = new Uint8Array(nx * nz).fill(255), BORDE = new Float32Array(nx * nz);
  const ORILLA = new Uint8Array(nx * nz), CULTIVO = new Uint8Array(nx * nz);   // la banquina, y que se sembro en cada celda (solo en el campo)
  const PELADO = new Uint8Array(nx * nz);                                      // donde no crece nada: calles, veredas y lo que ocupa un edificio

  // --- 1. Relieve general: se interpola la altura del camino y de sus laderas ---
  const PLANO = etapa.tramos.map(planoDe), pts = [];
  for (let i = 0; i < P.n; i += 2) {
    const t = etapa.tramos[P.T[i]], der = t.der || [0, 1], izq = t.izq || [0, 1], plano = PLANO[P.T[i]];
    pts.push(P.X[i], P.Z[i], P.Y[i], -P.HZ[i], P.HX[i], der[0], der[1], izq[0], izq[1], P.W[i] / 2 + plano[1], P.W[i] / 2 + plano[0]);   // (la ladera arranca donde termina lo parejo)
  }
  const G = 4, gx = Math.ceil((nx - 1) * celda / G) + 2, gz = Math.ceil((nz - 1) * celda / G) + 2;
  const M = new Float32Array(gx * gz), LEJOS = new Float32Array(gx * gz);
  // (con varios ambientes) en la grilla gruesa: de que zona es el punto del camino mas cercano, y cuanto relieve toca ahi
  // (el relieve se mezcla de a poco entre un ambiente y otro, para que no quede un escalon donde cambian)
  const ZG = varios ? new Uint8Array(gx * gz) : null, RG = varios ? new Float32Array(gx * gz) : null;
  // En un camino larguisimo (un circuito de mas de 4,8 km), recorrer todos los puntos del camino para cada celda tardaria
  // minutos: se miran solo los que estan cerca (guardados en cubos de 64 m), con un borde que se va apagando de a poco para
  // que no haya saltos donde un punto entra o sale. Las pistas de siempre siguen por el camino de antes, sin tocar.
  const GRANDE = pts.length / 11 > 2400, CUBO = 64, RCERCA = 260, cubos = new Map(), claveC = (a, b) => (a + 512) * 4096 + b + 512;
  if (GRANDE) for (let k = 0; k < pts.length; k += 11) {
    const c = claveC(Math.floor((pts[k] - x0) / CUBO), Math.floor((pts[k + 1] - z0) / CUBO));
    if (!cubos.has(c)) cubos.set(c, []);
    cubos.get(c).push(k);
  }
  for (let j = 0; j < gz; j++) for (let i = 0; i < gx; i++) {
    const x = x0 + i * G, z = z0 + j * G;
    let sw = 0, sh = 0, dm = 1e9, sr = 0, cual = 0;
    if (GRANDE) {
      // 1) el punto mas cercano (se agranda la busqueda hasta que no pueda haber uno mas cerca)
      const cx = Math.floor((x - x0) / CUBO), cz = Math.floor((z - z0) / CUBO);
      for (let rad = 1; rad <= 64; rad *= 2) {
        for (let a = -rad; a <= rad; a++) for (let b = -rad; b <= rad; b++) {
          const l = cubos.get(claveC(cx + a, cz + b));
          if (l) for (const k of l) { const ax = x - pts[k], az = z - pts[k + 1], d2 = ax * ax + az * az; if (d2 < dm) { dm = d2; cual = k; } }
        }
        if (dm <= (rad * CUBO) * (rad * CUBO)) break;
        dm = 1e9;
      }
      // 2) todos los que quedan a menos de "R" (lo comun son 260 m; en un lugar bien lejos del camino, el doble de lo que lo separa)
      const R = Math.max(RCERCA, 2 * Math.sqrt(dm)), R2 = R * R, n = Math.ceil(R / CUBO);
      for (let a = -n; a <= n; a++) for (let b = -n; b <= n; b++) {
        const l = cubos.get(claveC(cx + a, cz + b));
        if (!l) continue;
        for (const k of l) {
          const ax = x - pts[k], az = z - pts[k + 1], d2 = ax * ax + az * az;
          if (d2 >= R2) continue;
          const u = 1 - d2 / R2, w = u * u / ((d2 + 12) * (d2 + 12));
          const lado = ax * pts[k + 3] + az * pts[k + 4], f = Math.max(0, Math.abs(lado) - pts[k + (lado > 0 ? 9 : 10)]);
          sw += w;
          sh += w * (pts[k + 2] + (lado > 0 ? pts[k + 5] * Math.min(1, f / pts[k + 6]) : pts[k + 7] * Math.min(1, f / pts[k + 8])));
          if (varios) sr += w * BIO[zonaDeTramo[P.T[k / 11 * 2]]].relieve;
        }
      }
    } else for (let k = 0; k < pts.length; k += 11) {
      const ax = x - pts[k], az = z - pts[k + 1], d2 = ax * ax + az * az, w = 1 / ((d2 + 12) * (d2 + 12));
      const lado = ax * pts[k + 3] + az * pts[k + 4], f = Math.max(0, Math.abs(lado) - pts[k + (lado > 0 ? 9 : 10)]);
      sw += w;
      sh += w * (pts[k + 2] + (lado > 0 ? pts[k + 5] * Math.min(1, f / pts[k + 6]) : pts[k + 7] * Math.min(1, f / pts[k + 8])));
      if (varios) sr += w * BIO[zonaDeTramo[P.T[k / 11 * 2]]].relieve;
      if (d2 < dm) { dm = d2; cual = k; }
    }
    dm = Math.sqrt(dm);
    const relieve = varios ? sr / sw : bioma.relieve;
    M[j * gx + i] = sh / sw + ruido.capas(x / 120, z / 120, 3) * relieve * suave(30, 120, dm);
    LEJOS[j * gx + i] = dm;
    if (varios) { ZG[j * gx + i] = zonaDeTramo[P.T[cual / 11 * 2]]; RG[j * gx + i] = relieve; }
  }
  const grueso = (A, x, z) => {
    const u = (x - x0) / G, v = (z - z0) / G, i = Math.min(gx - 2, Math.floor(u)), j = Math.min(gz - 2, Math.floor(v));
    const fu = u - i, fv = v - j, k = j * gx + i;
    return mezcla(mezcla(A[k], A[k + 1], fu), mezcla(A[k + gx], A[k + gx + 1], fu), fv);
  };

  // --- 2. El camino: se aplana la huella y se le pone su suelo ---
  const CAJA = 16, cajas = new Map(), clave = (a, b) => (a + 4096) * 8192 + b + 4096;
  for (let i = 0; i < P.n; i++) {
    const k = clave(Math.floor(P.X[i] / CAJA), Math.floor(P.Z[i] / CAJA));
    if (!cajas.has(k)) cajas.set(k, []);
    cajas.get(k).push(i);
  }
  function cerca(x, z) {
    const cx = Math.floor(x / CAJA), cz = Math.floor(z / CAJA);
    let mejor = -1, md = 900;
    for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) {
      const l = cajas.get(clave(cx + a, cz + b));
      if (!l) continue;
      for (const i of l) { const dx = x - P.X[i], dz = z - P.Z[i], d = dx * dx + dz * dz; if (d < md) { md = d; mejor = i; } }
    }
    return mejor;
  }
  const lomitas = bioma.relieve > 8 ? 2.2 : 0.9;
  // --- 2a. Surcos: las rodadas profundas que dejaron los camiones (solo los tramos que traen "surcos", hoy la Montaña del Sufrimiento) ---
  // t.surcos = { hondo: [izq, der], lomo, banco, cuneta, culebra, varia, alterna, charcos, ext, suelo, orilla }  (todo en metros)
  //   hondo: cuanto se hunde cada rodada.  lomo: la joroba entre las dos.  banco: el borde del camino que se levanta.
  //   cuneta: la zanja de afuera.  culebra: cuanto serpentean las rodadas (hay que pelear el volante).  varia: cuanto cambia el hondo
  //   metro a metro.  alterna: cuanto se alterna cual rodada es la mas honda (inclina el camion de costado).  charcos: parte de las
  //   rodadas con agua (su suelo, "pozas": 'charco' si no se dice).  lodo: que parte de las rodadas es barro (si no se dice, todas).  ext: rodadas viejas, mas chicas, mas afuera.  suelo: el del fondo de la rodada.  orilla: el de la zanja.
  // Todo sale del metro del camino y del ruido de la pista: la misma pista da siempre las mismas rodadas (el fantasma es fiel).
  const SEP = 0.9, ANC = 0.85, EXT = 3.7;   // (SEP: las rodadas van justo donde van las ruedas del camion, que tiene 0,88 m de trocha)
  const SU = {}, hayS = etapa.tramos.some((t) => t.surcos);
  if (hayS) {
    const crudo = {};
    for (const k of ['hL', 'hR', 'lomo', 'banco', 'cun', 'cul', 'var', 'alt', 'chr', 'ext']) crudo[k] = new Float32Array(P.n);
    for (let i = 0; i < P.n; i++) {
      const t = etapa.tramos[P.T[i]], q = t.surcos;
      if (!q || t.agua) continue;
      crudo.hL[i] = q.hondo[0]; crudo.hR[i] = q.hondo[1]; crudo.lomo[i] = q.lomo || 0; crudo.banco[i] = q.banco || 0; crudo.cun[i] = q.cuneta || 0;
      crudo.cul[i] = q.culebra || 0; crudo.var[i] = q.varia || 0; crudo.alt[i] = q.alterna || 0; crudo.chr[i] = q.charcos || 0; crudo.ext[i] = q.ext || 0;
    }
    // (se suaviza entre un tramo y el otro, para que no haya escalones)
    for (const k in crudo) SU[k] = promedio(crudo[k], 9, false);
  }
  // cuanto se corren las rodadas hacia la derecha en el metro gi (serpentean con dos ondas, a mano y sin azar)
  const serpiente = (gi, cul) => cul * (0.62 * Math.sin(gi / 21 + 0.7) + 0.38 * Math.sin(gi / 8.3 + 2.1));
  const bache = (x, a) => { if (x >= a) return 0; const c = 0.5 + 0.5 * Math.cos(Math.PI * x / a); return c * c * (3 - 2 * c); };

  // las dos rodadas en el metro c del camino, a "largo" metros mas adelante y "lado" a la derecha: donde esta cada una (ls: el lado
  // medido desde el medio de las rodadas), cuanto se hunde (dL, dR) y que tan adentro esta el punto (bL, bR: 1 = en el fondo, 0 = afuera)
  function perfilSurco(c, largo, lado) {
    const gi = c + largo, ls = lado - serpiente(gi, SU.cul[c]), m = SU.var[c];
    const al = SU.alt[c] * Math.sin(gi * 0.1209 + 1.3);   // (cada 52 m cambia cual rodada es la mas honda)
    const dL = Math.max(0.03, SU.hL[c] * (1 + al) * (1 + m * ruido.capas(gi / 8, 11.7, 2)));
    const dR = Math.max(0.03, SU.hR[c] * (1 - al) * (1 + m * ruido.capas(gi / 8, 41.3, 2)));
    // (las rodadas no van del todo paralelas: cada una se corre un poco por su cuenta)
    const oL = 0.28 * SU.cul[c] * ruido.capas(gi / 6, 5.5, 2), oR = 0.28 * SU.cul[c] * ruido.capas(gi / 6, 23.1, 2);
    return { gi, ls, dL, dR, bL: bache(Math.abs(ls + SEP - oL), ANC), bR: bache(Math.abs(ls - SEP - oR), ANC) };
  }
  // que tan adentro de una rodada esta un punto del mundo (0 a 1): el dibujo oscurece el piso con esto (ver huellas.js)
  function enSurco(x, z) {
    const c = hayS ? cerca(x, z) : -1;
    if (c < 0 || !(SU.hL[c] > 0 || SU.hR[c] > 0)) return 0;
    const ax = x - P.X[c], az = z - P.Z[c], q = perfilSurco(c, ax * P.HX[c] + az * P.HZ[c], az * P.HX[c] - ax * P.HZ[c]);
    return Math.abs(az * P.HX[c] - ax * P.HZ[c]) > P.W[c] / 2 ? 0 : Math.max(q.bL * (q.dL > 0.04 ? 1 : 0), q.bR * (q.dR > 0.04 ? 1 : 0));
  }  // la zona de cada celda: la del camino mas cercano, con el limite desparejo (como se mezclan de verdad un bosque y un campo)
  const ZONA = varios ? new Uint8Array(nx * nz) : null;
  const zonaEn = (x, z) => {
    const qx = x + (ruido.n2(x / 13 + 5.3, z / 13) - 0.5) * 22, qz = z + (ruido.n2(x / 13, z / 13 + 9.1) - 0.5) * 22;
    return ZG[Math.max(0, Math.min(gz - 1, Math.round((qz - z0) / G))) * gx + Math.max(0, Math.min(gx - 1, Math.round((qx - x0) / G)))];
  };
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const x = x0 + i * celda, z = z0 + j * celda, k = j * nx + i;
    const lejos = grueso(LEJOS, x, z);
    let h = grueso(M, x, z), borde = lejos;
    if (varios) ZONA[k] = zonaEn(x, z);
    const lomas = ruido.capas(x / 26, z / 26, 3) * (varios ? 0.9 + 1.3 * suave(6, 14, grueso(RG, x, z)) : lomitas), pozitos = ruido.capas(x / 6, z / 6, 2) * 0.3;
    const c = lejos < 36 ? cerca(x, z) : -1;
    if (c < 0) h += lomas + pozitos;
    else {
      const t = etapa.tramos[P.T[c]], ax = x - P.X[c], az = z - P.Z[c];
      const largo = ax * P.HX[c] + az * P.HZ[c], lado = az * P.HX[c] - ax * P.HZ[c];
      const fuera = !etapa.vuelta && ((c === 0 && largo < -0.6) || (c === P.n - 1 && largo > 0.6));
      const d = fuera ? Math.hypot(ax, az) : Math.abs(lado), medio = P.W[c] / 2, u = P.U[c] + largo;
      let hc = P.Y[c] + P.G[c] * largo + P.B[c] * lado + ruido.capas(x / P.RL[c], z / P.RL[c], 2) * P.R[c];
      let suelo = P.S[c];
      if (t.pozos) for (const p of t.pozos) {
        const dd = Math.hypot(u - p[0], lado - p[1]);
        if (dd < p[2]) { const f = 1 - suave(0.45 * p[2], p[2], dd); hc -= p[3] * f; if (f > 0.35) suelo = SUELOS[p[4]].id; }
      }
      // lomos de burro: una loma que cruza el camino de lado a lado. [metros desde el inicio del tramo, alto, largo]
      if (t.lomos && d < medio + 0.6) for (const l of t.lomos) {
        const dd = Math.abs(u - l[0]);
        if (dd < l[2] / 2) hc += l[1] * (0.5 + 0.5 * Math.cos(dd / l[2] * 2 * Math.PI));
      }
      // escalones: bloques de piedra desalineados sobre el camino (La Escalada de Piedras). [metros desde el inicio del tramo,
      // metros a la derecha del medio, largo, ancho, alto]. Sube de golpe en un metro (la grilla es de un metro): un escalon duro.
      let sobrePiedra = false;   // (cerca de un escalon no se pone barro: las ruedas tienen que poder trepar)
      if (t.escalones && d < medio + 0.6) for (const e of t.escalones) {
        if (Math.abs(u - e[0]) < e[2] / 2 + 1.2 && e[4] > 0.2) sobrePiedra = true;
        const fuera = Math.max(Math.abs(u - e[0]) - e[2] / 2, Math.abs(lado - e[1]) - e[3] / 2);
        if (fuera < 0.5) { hc += e[4] * (1 - suave(-0.5, 0.5, fuera)); if (fuera < 0) suelo = SUELOS.roca.id; }
      }
      // surcos: las dos rodadas hondas con su lomo en el medio, el banco del borde y la zanja de afuera
      let dSurco = 0, orillaSuelo = -1;
      if (hayS && d < medio + 5 && (SU.hL[c] > 0 || SU.hR[c] > 0)) {
        const { gi, ls, dL, dR, bL, bR } = perfilSurco(c, largo, lado), ad = Math.abs(ls);
        dSurco = -(dL * bL + dR * bR) + SU.lomo[c] * bache(ad, SEP * 0.85) + 0.55 * (SU.hL[c] + SU.hR[c]) / 2 * bache(Math.abs(ad - (SEP + ANC + 0.5)), 1.0);
        if (SU.ext[c] > 0 && medio > 4.6) dSurco -= SU.ext[c] * (bache(Math.abs(ls + EXT), 0.9) + bache(Math.abs(ls - EXT), 0.9));
        if (SU.banco[c] > 0) dSurco += SU.banco[c] * bache(Math.abs(d - Math.max(medio - 0.7, SEP + ANC + 0.3)), 1.5);
        if (SU.cun[c] > 0 && d > medio - 0.2) dSurco -= SU.cun[c] * bache(Math.abs(d - (medio + 1.5)), 1.6);
        const q = t.surcos;
        if (q) {
          // (lodo: que parte de las rodadas es barro; en el resto queda el suelo del camino, por ejemplo roca entre las piedras)
          if (Math.max(bL * (dL > 0.04 ? 1 : 0), bR * (dR > 0.04 ? 1 : 0)) > 0.3 && d < medio + 0.6 && suelo === P.S[c] && !sobrePiedra && (q.lodo === undefined || ruido.n2(gi / 9, ls > 0 ? 61.9 : 17.3) < q.lodo)) {
            suelo = SUELOS[q.suelo || 'pantano'].id;
            if (q.charcos && SU.chr[c] > 0 && ruido.n2(gi / 6, ls > 0 ? 37.7 : 3.3) > 1 - SU.chr[c] && Math.max(bL * dL, bR * dR) > 0.55 * Math.max(dL, dR)) suelo = SUELOS[q.pozas || 'charco'].id;
          }
          if (q.orilla && d >= medio + 0.6 && d < medio + 0.6 + (q.orillaAncho || 2.4)) orillaSuelo = SUELOS[q.orilla].id;
        }
      }
      // "plano": a cada lado del camino el terreno sigue parejo esos metros (para veredas, casas, playones y banquinas de cornisa)
      const plano = PLANO[P.T[c]][lado > 0 ? 1 : 0];
      if (plano && d > medio) hc = mezcla(hc, P.Y[c] + P.G[c] * largo, suave(medio, medio + 1, d));
      const f = suave(medio + plano, medio + plano + (t.hombro || 4), d);
      h = mezcla(hc, h + lomas * suave(medio + plano + 2, medio + plano + 18, d) + pozitos, f);
      h += dSurco;
      borde = d - medio;
      if (d < medio + 0.6) S[k] = suelo;
      else if (orillaSuelo >= 0) S[k] = orillaSuelo;
      else if (t.vereda && d < medio + 0.6 + t.vereda) { S[k] = SUELOS.vereda.id; PELADO[k] = 1; }
      else if (d < medio + 1.9 && !t.agua) ORILLA[k] = 1;
    }
    H[k] = h; BORDE[k] = borde;
  }

  // --- 2b. Bocacalles: pedazos de calle que salen del camino y no van a ningun lado (el pueblo sigue para los costados) ---
  // t.bocas: lista de [metros desde el inicio del tramo, angulo respecto del camino (0 = sigue derecho, 90 = a la derecha), largo, ancho]
  for (const t of etapa.tramos) for (const b of t.bocas || []) {
    const i = Math.max(0, Math.min(P.n - 1, t.desde + Math.round(b[0]))), a = Math.atan2(P.HX[i], -P.HZ[i]) + b[1] * RAD, hx = Math.sin(a), hz = -Math.cos(a);
    const largo = b[2], medio = (b[3] || 7) / 2, vereda = t.vereda || 0, suelo = SUELOS[t.suelo].id, lejos = largo + medio + 8;
    const i0 = Math.max(0, Math.floor(P.X[i] - x0 - lejos)), i1 = Math.min(nx - 1, Math.ceil(P.X[i] - x0 + lejos)), j0 = Math.max(0, Math.floor(P.Z[i] - z0 - lejos)), j1 = Math.min(nz - 1, Math.ceil(P.Z[i] - z0 + lejos));
    for (let j = j0; j <= j1; j++) for (let ii = i0; ii <= i1; ii++) {
      const k = j * nx + ii, ax = x0 + ii * celda - P.X[i], az = z0 + j * celda - P.Z[i], va = ax * hx + az * hz, de = Math.abs(az * hx - ax * hz);
      if (va < 0 || va > largo + 4 || de > medio + vereda + 5) continue;
      const f = (1 - suave(medio + vereda, medio + vereda + 5, de)) * (1 - suave(largo, largo + 4, va));
      H[k] = mezcla(H[k], P.Y[i], f);
      if (va > largo) continue;
      const libre = S[k] === 255 || S[k] === SUELOS.vereda.id;   // (no pisa el camino ni otra calle)
      if (de < medio + 0.6) { if (libre) S[k] = suelo; BORDE[k] = Math.min(BORDE[k], -0.5); PELADO[k] = 1; ORILLA[k] = 0; }
      else if (de < medio + 0.6 + vereda) { if (S[k] === 255) S[k] = SUELOS.vereda.id; BORDE[k] = Math.min(BORDE[k], 0.5); PELADO[k] = 1; ORILLA[k] = 0; }
    }
  }

  // --- 3. Agua: un arroyo cruza el camino en los tramos que tienen "agua" ---
  // Es corto: nace y termina a los costados del camino, para no cortar otras partes de la pista.
  const aguas = [];
  const curva = (b) => 9 * Math.sin(b / 21) * suave(5, 26, Math.abs(b));
  for (const t of etapa.tramos) {
    if (!t.agua) continue;
    const m = (t.desde + t.hasta) >> 1, medio = t.largo / 2;
    const a = { x: P.X[m], z: P.Z[m], hx: P.HX[m], hz: P.HZ[m], nivel: P.Y[m] + t.agua.hondo, cruce: medio + 16, largo: t.agua.largo / 2 };
    // (opcional) "entre": hasta donde llega el agua a cada lado del camino [izquierda negativa, derecha], en vez de parejo;
    // "empuje": una corriente que empuja a lo que esta adentro, hacia la derecha del camino (m/s2). Ver "corriente".
    a.entre = !!t.agua.entre; a.pb0 = a.entre ? t.agua.entre[0] : -a.largo; a.pb1 = a.entre ? t.agua.entre[1] : a.largo; a.empuje = t.agua.empuje || 0;
    aguas.push(a);
    const i0 = Math.max(0, Math.floor(a.x - x0 - a.largo - 24)), i1 = Math.min(nx - 1, Math.ceil(a.x - x0 + a.largo + 24));
    const j0 = Math.max(0, Math.floor(a.z - z0 - a.largo - 24)), j1 = Math.min(nz - 1, Math.ceil(a.z - z0 + a.largo + 24));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = x0 + i * celda, z = z0 + j * celda, k = j * nx + i, ax = x - a.x, az = z - a.z;
      const pb = az * a.hx - ax * a.hz, pa = Math.abs(ax * a.hx + az * a.hz - curva(pb));
      if ((a.entre ? (pb < a.pb0 || pb > a.pb1) : Math.abs(pb) > a.largo) || pa > medio + 9) continue;
      // el cauce se va cerrando hacia las puntas
      const f = (1 - suave(medio - 1, medio + 7, pa)) * (1 - suave(a.largo - 13, a.largo - 1, a.entre ? a.largo - Math.min(pb - a.pb0, a.pb1 - pb) : Math.abs(pb)));
      const lecho = P.Y[m] - 0.1 + ruido.capas(x / 5, z / 5, 2) * 0.18;
      if (f > 0 && H[k] > lecho) H[k] = mezcla(H[k], lecho, f);
      if (H[k] < a.nivel + 0.25 && S[k] === 255) S[k] = SUELOS.lecho.id;
    }
  }
  // Puentes: una zanja honda cruza el tramo y el camino pasa por arriba, sobre un terraplen de piedra con tablones.
  // t.puente: { alto: metros de zanja, luz: metros de largo del puente, agua: true si abajo corre un arroyo }
  const puentes = [];
  for (const t of etapa.tramos) {
    if (!t.puente) continue;
    const m = (t.desde + t.hasta) >> 1, luz = (t.puente.luz || 10) / 2, alto = t.puente.alto || 3, hx = P.HX[m], hz = P.HZ[m], medio = P.W[m] / 2 + 0.3, lejos = 48, VAIVEN = 6;
    puentes.push({ i: m, x: P.X[m], z: P.Z[m], y: P.Y[m], rumbo: Math.atan2(hx, -hz), luz: luz * 2, ancho: P.W[m], alto });
    // La zanja no es una regla: lejos del puente serpentea y se angosta (debajo del puente va derecha, para cruzarla bien).
    // lado: metros a la derecha del camino. Devuelven cuanto se corre el eje de la zanja y cuanto mide de mitad de ancho ahi.
    const serpentea = (lado) => VAIVEN * Math.sin(lado / 12 + m) * suave(medio + 3, medio + 17, Math.abs(lado));
    const mitad = (lado) => luz * (1 - 0.4 * suave(9, lejos - 8, Math.abs(lado)));
    const i0 = Math.max(0, Math.floor(P.X[m] - x0 - lejos - 4)), i1 = Math.min(nx - 1, Math.ceil(P.X[m] - x0 + lejos + 4)), j0 = Math.max(0, Math.floor(P.Z[m] - z0 - lejos - 4)), j1 = Math.min(nz - 1, Math.ceil(P.Z[m] - z0 + lejos + 4));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = x0 + i * celda, z = z0 + j * celda, k = j * nx + i, ax = x - P.X[m], az = z - P.Z[m];
      const largo = ax * hx + az * hz, lado = az * hx - ax * hz, de = Math.abs(lado);
      if (Math.abs(largo) > luz + 4 + VAIVEN || de > lejos) continue;
      if (de <= medio) { if (Math.abs(largo) < luz + 0.5 && S[k] !== 255) S[k] = SUELOS.madera.id; continue; }   // el tablero del puente
      // la zanja: de paredes empinadas junto al puente, y se va cerrando lejos del camino
      const va = Math.abs(largo - serpentea(lado)), ancho = mitad(lado);
      const f = (1 - suave(ancho - 1, ancho + 3, va)) * (1 - suave(lejos - 14, lejos, de)) * suave(medio, medio + 1, de);
      const fondo = P.Y[m] - alto + ruido.capas(x / 5, z / 5, 2) * 0.25;
      if (f > 0 && H[k] > fondo) H[k] = mezcla(H[k], fondo, f);
      if (f > 0.5) { S[k] = t.puente.agua ? SUELOS.lecho.id : SUELOS.roca.id; ORILLA[k] = 0; BORDE[k] = Math.min(BORDE[k], 0.5); }
    }
    // El arroyo: el agua llega, para cada lado, hasta donde las dos barrancas de la zanja la contienen.
    // (En una ladera, del lado de abajo la zanja se abre enseguida y el agua no puede seguir.)
    if (t.puente.agua) {
      const nivel = P.Y[m] - alto + 0.55, alturaEn = (va, de) => { const x = P.X[m] + hx * va - hz * de, z = P.Z[m] + hz * va + hx * de; return H[Math.max(0, Math.min(nz - 1, Math.round(z - z0))) * nx + Math.max(0, Math.min(nx - 1, Math.round(x - x0)))]; };
      const llega = [0, 0];
      [-1, 1].forEach((s, q) => { for (let de = medio + 1; de < lejos - 6; de += 1) { const eje = serpentea(s * de), borde = mitad(s * de) + 3.5; if (alturaEn(eje + borde, s * de) < nivel + 0.25 || alturaEn(eje - borde, s * de) < nivel + 0.25) break; llega[q] = de; } });
      const corre = (llega[1] - llega[0]) / 2, largo = (llega[1] + llega[0]) / 2;
      if (largo > 3) aguas.push({ x: P.X[m] - hz * corre, z: P.Z[m] + hx * corre, hx, hz, nivel, cruce: luz + 3 + VAIVEN, largo, entre: false, pb0: -largo, pb1: largo, empuje: 0 });
    }
  }
  function agua(x, z, h) {
    for (const a of aguas) {
      const ax = x - a.x, az = z - a.z;
      const pb = az * a.hx - ax * a.hz;
      if (Math.abs(ax * a.hx + az * a.hz) < a.cruce && pb > a.pb0 && pb < a.pb1) return Math.max(0, a.nivel - h);
    }
    return 0;
  }
  // La corriente de una cascada que cruza el camino: cuanto empuja (m/s2) hacia la derecha del camino a lo que esta en el agua.
  // La usa solo el camion de La Montaña del Sufrimiento (los autos no la miran). o: { fx, fz, f } (f: 0 a 1, cuanta agua hay)
  function corriente(x, z, o) {
    o.fx = 0; o.fz = 0; o.f = 0;
    for (const a of aguas) {
      if (!a.empuje) continue;
      const ax = x - a.x, az = z - a.z, pb = az * a.hx - ax * a.hz;
      if (Math.abs(ax * a.hx + az * a.hz) >= a.cruce || pb <= a.pb0 || pb >= a.pb1) continue;
      const f = Math.min(1, Math.max(0, a.nivel - altura(x, z)) / 0.25);
      if (f > o.f) { o.f = f; o.fx = -a.hz * a.empuje * f; o.fz = a.hx * a.empuje * f; }
    }
    return o;
  }

  // --- 4. Suelos naturales: roca donde es muy empinado, pasto en el resto ---
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i;
    if (S[k] !== 255) continue;
    const i0 = Math.max(0, i - 1), i1 = Math.min(nx - 1, i + 1), j0 = Math.max(0, j - 1), j1 = Math.min(nz - 1, j + 1);
    const p = Math.hypot(H[j * nx + i1] - H[j * nx + i0], H[j1 * nx + i] - H[j0 * nx + i]) / (2 * celda);
    S[k] = p > 0.85 ? SUELOS.roca.id : SUELOS.pasto.id;
  }

  // --- Consultas (se definen aca porque las usa lo que sigue) ---
  function altura(x, z) {
    const u = Math.min(nx - 1.001, Math.max(0, (x - x0) / celda)), v = Math.min(nz - 1.001, Math.max(0, (z - z0) / celda));
    const i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j, k = j * nx + i;
    return fu + fv <= 1 ? H[k] + (H[k + 1] - H[k]) * fu + (H[k + nx] - H[k]) * fv
      : H[k + nx + 1] + (H[k + nx] - H[k + nx + 1]) * (1 - fu) + (H[k + 1] - H[k + nx + 1]) * (1 - fv);
  }
  // un lugar al costado del camino: "en" metros desde el inicio del tramo, "lado" metros a la derecha
  const lugar = (t, en, lado) => {
    const i = Math.max(0, Math.min(P.n - 1, t.desde + Math.round(en))), x = P.X[i] - P.HZ[i] * lado, z = P.Z[i] + P.HX[i] * lado;
    return { i, x, z, y: altura(x, z), rumbo: Math.atan2(P.HX[i], -P.HZ[i]) };
  };

  // --- 5. Lo que hay al costado del camino: publico, carteles, fardos, piedras, autos tirados y mojones ---
  // Todo lo que se puede chocar es un circulo de radio r, o una caja (los edificios, los volquetes, las barandas):
  // esas llevan hx y hz (medio ancho y medio largo) y hacia donde miran (ux, uz: su eje ancho, en el mapa).
  // "duro": cuanto golpea (1 = arbol o piedra; menos = frena poco).
  // "cede": si se lo choca fuerte queda tirado y ya no molesta (postes y fardos).
  const cosas = [], cajasCosas = new Map();
  function anotar(o) {
    cosas.push(o);
    const e = (o.hx ? Math.hypot(o.hx, o.hz) : o.r) + 1.1;
    for (let cx = Math.floor((o.x - e) / 8); cx <= Math.floor((o.x + e) / 8); cx++) for (let cz = Math.floor((o.z - e) / 8); cz <= Math.floor((o.z + e) / 8); cz++) {
      const kk = clave(cx, cz);
      if (!cajasCosas.has(kk)) cajasCosas.set(kk, []);
      cajasCosas.get(kk).push(o);
    }
  }
  const publico = [], cintas = [], carteles = [], mojones = [], autos = [], fardos = [], claros = [], estacionados = [];
  const casas = [], objetos = [], barandas = [], pircas = [], estorbos = [];
  // una caja que se puede chocar, apoyada en (x, z) y girada "rumbo" (su frente mira hacia ese rumbo)
  const caja = (x, z, rumbo, hx, hz, mas) => Object.assign({ x, z, y: altura(x, z), hx, hz, ux: Math.cos(rumbo), uz: Math.sin(rumbo), rumbo, alto: 1, duro: 1 }, mas);
  // lo que queda metido en el camino se anota aparte: la trazada de referencia tiene que esquivarlo
  // (i: en que metro; lado: metros a la derecha del medio; medio: lo que ocupa a lo ancho; largo: a lo largo)
  const estorba = (i, lado, giro, hx, hz) => {
    const g = giro * RAD, ancho = Math.abs(hx * Math.cos(g)) + Math.abs(hz * Math.sin(g)), largo = Math.abs(hx * Math.sin(g)) + Math.abs(hz * Math.cos(g));
    if (Math.abs(lado) - ancho < P.W[i] / 2) estorbos.push({ i, lado, medio: ancho, largo });
  };
  // deja pelado (sin arboles ni yuyos) un rectangulo del mapa
  const pelar = (x, z, radio) => {
    for (let j = Math.max(0, Math.floor(z - z0 - radio)); j <= Math.min(nz - 1, Math.ceil(z - z0 + radio)); j++) for (let i = Math.max(0, Math.floor(x - x0 - radio)); i <= Math.min(nx - 1, Math.ceil(x - x0 + radio)); i++) PELADO[j * nx + i] = 1;
  };
  // Una pared baja que sigue el borde del camino entre dos metros de la pista (a, b), de un lado (1 = derecha).
  // corre(i): a cuantos metros del medio va en cada punto. Sale en pedazos de dos metros que acompañan la curva y la pendiente.
  // Las puntas se abren hacia afuera ("abre" metros, en los ultimos "enCuanto"): al que viene pegado al borde lo van
  // arrimando al camino, en vez de pararlo en seco.   alCamino: se apoya a la altura del camino (y no del terreno de al lado).
  const pared = (a, b, lado, corre, mas, lista, abre, enCuanto, alCamino) => {
    const n = Math.max(1, Math.round((b - a) / 2)), pts = [];
    for (let k = 0; k <= n; k++) {
      const u = a + (b - a) * k / n, i = Math.max(0, Math.min(P.n - 1, Math.round(u))), punta = Math.min(u - a, b - u);
      const d = lado * (corre(i) + abre * (1 - suave(0, enCuanto, punta)));
      pts.push([P.X[i] - P.HZ[i] * d, P.Z[i] + P.HX[i] * d, i]);
    }
    for (let k = 0; k < n; k++) {
      const [x1, z1, i] = pts[k], [x2, z2, i2] = pts[k + 1], largo = Math.hypot(x2 - x1, z2 - z1);
      if (largo < 0.3) continue;
      const o = caja((x1 + x2) / 2, (z1 + z2) / 2, Math.atan2(x2 - x1, z1 - z2), mas.hx, largo / 2 + 0.06, Object.assign({ sube: Math.atan((P.Y[i2] - P.Y[i]) / largo), n: lista.length, i, lado }, mas));
      if (alCamino) o.y = (P.Y[i] + P.Y[i2]) / 2;
      anotar(o); lista.push(o);
    }
  };
  // La pirca: un murito de piedra al borde del camino, donde hay una caida. Frena al auto en vez de dejarlo caer.
  // t.pirca: de que lado va en todo el tramo ('izq', 'der' o 'los dos'), o una lista de [lado, desde, hasta] en metros del tramo.
  // Va sobre el final de lo parejo ("plano"). Las de tramos seguidos se unen en una sola.
  for (const lado of [-1, 1]) {
    const tiras = [];
    for (const t of etapa.tramos) for (const [cual, desde, hasta] of typeof t.pirca === 'string' ? [[t.pirca, 0, t.largo]] : t.pirca || []) {
      if (cual !== 'los dos' && (cual === 'der' ? 1 : -1) !== lado) continue;
      const a = t.desde + Math.max(0, desde), b = t.desde + Math.min(t.largo, hasta), ultima = tiras[tiras.length - 1];
      if (ultima && a <= ultima[1] + 1) ultima[1] = Math.max(ultima[1], b); else tiras.push([a, b]);
    }
    for (const [a, b] of tiras) pared(a, b, lado, (i) => P.W[i] / 2 + PLANO[P.T[i]][lado > 0 ? 1 : 0] - 0.1, { clase: 'pirca', hx: 0.26, alto: 0.6 }, pircas, 0.55, 4.5);
  }
  for (const t of etapa.tramos) {
    // edificios: [metros desde el inicio del tramo, metros a la derecha (del centro del edificio), tipo, giro en grados, variante]
    // Miran hacia el camino. Se chocan como una caja.
    for (const e of t.casas || []) {
      const l = lugar(t, e[0], e[1]), E = EDIFICIOS[e[2]] || EDIFICIOS.casa, rumbo = l.rumbo + (e[1] > 0 ? -Math.PI / 2 : Math.PI / 2) + (e[3] || 0) * RAD;
      const o = caja(l.x, l.z, rumbo, E.ancho / 2, E.fondo / 2, { clase: 'edificio', tipo: e[2], variante: e[4] === undefined ? casas.length : e[4], alto: E.alto });
      // se apoya en la parte mas baja del terreno que pisa, asi no queda en el aire en las pendientes
      for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) o.y = Math.min(o.y, altura(l.x + o.ux * o.hx * sx - o.uz * o.hz * sz, l.z + o.uz * o.hx * sx + o.ux * o.hz * sz));
      anotar(o); casas.push(o);
      claros.push({ x: l.x, z: l.z, r: Math.hypot(o.hx, o.hz) + 0.8 }); pelar(l.x, l.z, Math.max(o.hx, o.hz) + 0.5);
      estorba(l.i, e[1], 90 + (e[3] || 0), o.hx, o.hz);
    }
    // cosas sueltas: [metros desde el inicio del tramo, metros a la derecha, tipo, giro en grados]
    // (giro 0: lo ancho queda atravesado al camino; 90: a lo largo)
    for (const e of t.objetos || []) {
      const l = lugar(t, e[0], e[1]), O = OBJETOS[e[2]];
      if (!O) continue;
      const rumbo = l.rumbo + (e[3] || 0) * RAD, mas = { clase: 'objeto', tipo: e[2], alto: O.alto, duro: O.duro, cede: !!O.cede, n: objetos.length, lado: e[1] };
      const o = O.hx ? caja(l.x, l.z, rumbo, O.hx, O.hz, mas) : Object.assign({ x: l.x, z: l.z, y: l.y, r: O.r, rumbo }, mas);
      anotar(o); objetos.push(o);
      if (!O.cede || O.duro >= 0.25) estorba(l.i, e[1], e[3] || 0, O.hx || O.r, O.hz || O.r);
      if (O.alto > 2) claros.push({ x: l.x, z: l.z, r: 1.2 });
    }
    // arboles plantados a proposito (los de la vereda, los de una plaza): [metros desde el inicio, metros a la derecha, tipo, tamaño]
    for (const e of t.arboles || []) {
      const l = lugar(t, e[0], e[1]);
      anotar({ x: l.x, z: l.z, y: l.y, r: 0.45, alto: e[3] || 1.1, clase: 'arbol', tipo: e[2] || 'alamo', duro: 1, vuelta: rnd() * 6.28 });
      estorba(l.i, e[1], 0, 0.45, 0.45);
    }
    // las bocacalles van cerradas: tres vallas atravesadas y, atras, los vecinos mirando
    for (const b of t.bocas || []) {
      if (b[4] === false) continue;
      const i = Math.max(0, Math.min(P.n - 1, t.desde + Math.round(b[0]))), a = Math.atan2(P.HX[i], -P.HZ[i]) + b[1] * RAD, hx = Math.sin(a), hz = -Math.cos(a), lejos = b[2] - 6;
      const O = OBJETOS.valla, ancho = b[3] || 7, cuantas = Math.max(2, Math.round((ancho - 0.6) / 2.3));
      for (let k = 0; k < cuantas; k++) {
        const de = (k - (cuantas - 1) / 2) * (ancho - 0.8) / cuantas, x = P.X[i] + hx * lejos - hz * de, z = P.Z[i] + hz * lejos + hx * de;
        const o = caja(x, z, a, O.hx, O.hz, { clase: 'objeto', tipo: 'valla', alto: O.alto, duro: O.duro, cede: true, n: objetos.length, lado: 0 });
        anotar(o); objetos.push(o);
      }
      for (let k = 0, n = 3 + Math.floor(rnd() * 5); k < n; k++) {
        const de = (rnd() - 0.5) * (ancho - 1), va = lejos + 1.3 + rnd() * 2.2, x = P.X[i] + hx * va - hz * de, z = P.Z[i] + hz * va + hx * de;
        publico.push({ x, z, y: altura(x, z), rumbo: a + Math.PI + (rnd() - 0.5) * 0.5, ropa: Math.floor(rnd() * 8), fase: rnd(), i });
      }
    }
    // las barandas de un puente: de madera, a cada lado, cubriendo toda la zanja
    if (t.puente && t.puente.baranda !== false) {
      const m = (t.desde + t.hasta) >> 1, largo = (t.puente.luz || 10) / 2 + 6;
      for (const lado of [-1, 1]) pared(m - largo, m + largo, lado, (i) => P.W[i] / 2 + 0.15, { clase: 'baranda', hx: 0.14, alto: 1.1 }, barandas, 1.5, 5, true);
    }
    // gente mirando: cada grupo se para detras de una cinta, en un claro sin arboles
    for (const g of t.publico || []) {
      const c = lugar(t, g[0], g[1]), s = Math.sign(g[1]), n = g[2], ancho = 1.6 + n * 0.55;
      const hx = Math.sin(c.rumbo), hz = -Math.cos(c.rumbo);   // a lo largo del camino
      claros.push({ x: c.x, z: c.z, r: ancho / 2 + 3.5 });
      for (let k = 0; k < n; k++) {
        const a = (k + 0.5) / n - 0.5 + (rnd() - 0.5) * 0.08, fondo = (k % 2) * 0.9 + rnd() * 0.5;
        const x = c.x + hx * a * ancho - hz * s * fondo, z = c.z + hz * a * ancho + hx * s * fondo;
        // mira hacia el camino; cada uno con su ropa y su manera de festejar
        publico.push({ x, z, y: altura(x, z), rumbo: c.rumbo - s * Math.PI / 2 + (rnd() - 0.5) * 0.5, ropa: Math.floor(rnd() * 8), fase: rnd(), i: c.i });
      }
      // detras de algunos grupos, el auto en el que vinieron
      if (n >= 4 && rnd() < 0.62) {
        const fondo = 5.2 + rnd() * 2.2, a = (rnd() - 0.5) * ancho * 0.7, x = c.x + hx * a - hz * s * fondo, z = c.z + hz * a + hx * s * fondo;
        const rumbo = c.rumbo + (rnd() < 0.5 ? 0 : Math.PI) + (rnd() - 0.5) * 0.9;
        if (grueso(LEJOS, x, z) > P.W[c.i] / 2 + 9) {   // solo si queda bien lejos de cualquier parte del camino
          estacionados.push({ x, z, y: altura(x, z), rumbo, n: Math.floor(rnd() * 90) });
          claros.push({ x, z, r: 4 });
          for (const k of [-1.1, 1.1]) { const px = x + Math.sin(rumbo) * k, pz = z - Math.cos(rumbo) * k; anotar({ x: px, z: pz, y: altura(px, pz), r: 1.05, alto: 1, clase: 'auto', duro: 1 }); }
        }
      }
      // la cinta: dos estacas a 1,6 m de la gente, del lado del camino
      const cx = c.x + hz * s * 1.7, cz = c.z - hx * s * 1.7, m = ancho / 2 + 0.9;
      const p1 = [cx - hx * m, cz - hz * m], p2 = [cx + hx * m, cz + hz * m];
      cintas.push({ x1: p1[0], z1: p1[1], y1: altura(p1[0], p1[1]), x2: p2[0], z2: p2[1], y2: altura(p2[0], p2[1]) });
    }
    for (const c of t.carteles || []) { const l = lugar(t, c[0], c[1]); carteles.push({ x: l.x, z: l.z, y: l.y, rumbo: l.rumbo, tipo: c[2] }); claros.push({ x: l.x, z: l.z, r: 1.6 }); }
    for (const p of t.piedras || []) { const l = lugar(t, p[0], p[1]); anotar({ x: l.x, z: l.z, y: l.y, r: p[2], alto: 0.75, clase: 'piedra', vuelta: rnd() * 6.28, duro: 1 }); }
    for (const f of t.fardos || []) { const l = lugar(t, f[0], f[1]), o = { x: l.x, z: l.z, y: l.y, r: 0.7, alto: 1, clase: 'fardo', vuelta: l.rumbo + (rnd() - 0.5) * 0.5, duro: 0.3, cede: true }; anotar(o); fardos.push(o); }
    // autos estacionados en la calle: [metros desde el inicio del tramo, metros a la derecha, giro en grados, cual (un numero)]
    for (const a of t.autos || []) {
      const l = lugar(t, a[0], a[1]), rumbo = l.rumbo + (a[2] || 0) * RAD;
      estacionados.push({ x: l.x, z: l.z, y: l.y, rumbo, n: a[3] === undefined ? estacionados.length * 7 + 3 : a[3] });
      anotar(caja(l.x, l.z, rumbo, 0.85, 1.9, { clase: 'auto' }));
      claros.push({ x: l.x, z: l.z, r: 2.4 });
      estorba(l.i, a[1], a[2] || 0, 0.85, 1.9);
    }
    // mojones blancos al borde de los precipicios
    for (const lado of [1, -1]) {
      const ladera = lado > 0 ? t.der : t.izq;
      if (!ladera || ladera[0] > -10) continue;
      const parejo = PLANO[P.T[t.desde]][lado > 0 ? 1 : 0];   // (si hay banquina, van al final; y donde hay pirca no hacen falta)
      for (let i = t.desde + 2; i < t.hasta; i += 5) {
        const d = lado * (P.W[i] / 2 + (parejo ? parejo - 0.3 : 0.45)), x = P.X[i] - P.HZ[i] * d, z = P.Z[i] + P.HX[i] * d;
        if (pircas.some((q) => q.lado === lado && Math.abs(q.i - i) < 3)) continue;
        mojones.push({ x, z, y: altura(x, z) });
      }
    }
  }
  // alambrado: en el campo, una fila de postes a cada lado del camino. Ceden si se los choca.
  const postes = [];
  if (BIO.some((b) => b.alambrado)) {
    for (let i = 6; i < P.n - 4; i += 7) {
      const t = etapa.tramos[P.T[i]];
      if (t.agua || t.izq || t.der || t.plano || t.puente || !BIO[zonaDeTramo[P.T[i]]].alambrado) continue;
      for (const lado of [-1, 1]) {
        const d = lado * (P.W[i] / 2 + 4.6), x = P.X[i] - P.HZ[i] * d, z = P.Z[i] + P.HX[i] * d;
        if (claros.some((c) => (c.x - x) ** 2 + (c.z - z) ** 2 < (c.r + 1.5) ** 2) || agua(x, z, altura(x, z)) > 0) continue;
        // en las curvas, el lado de adentro queda mas cerca de otra parte del camino: solo se pone si este es el punto mas cercano
        const c = cerca(x, z);
        if (c < 0 || Math.abs(c - i) > 12) continue;
        const o = { x, z, y: altura(x, z), r: 0.16, alto: 1, clase: 'poste', duro: 0.25, cede: true, vuelta: Math.atan2(P.HX[i], -P.HZ[i]), i, lado };
        anotar(o); postes.push(o);
      }
    }
  }

  // --- 6. El campo: del alambrado para afuera, lotes sembrados; entre lote y lote, a veces una cortina de alamos ---
  const vacas = [], molinos = [];
  const sorteo = (a, b) => { let t = Math.imul(a * 374761393 + b * 668265263 + (etapa.semilla | 0), 1274126177); t ^= t >>> 15; return ((t >>> 0) % 10007) / 10007; };
  const FILA = 54, COLUMNA = 80;
  // el lote de un punto: [que tiene (0 pasto, 1 trigo, 2 tierra arada, 3 girasol, 4 soja), metros hasta su borde, columna, fila, cuanto esta corrida la fila]
  const lote = (x, z) => {
    const fila = Math.floor(z / FILA), corre = (sorteo(fila, 7) - 0.5) * 60, col = Math.floor((x + corre) / COLUMNA), a = sorteo(col + fila * 57, 3);
    return [a < 0.34 ? 0 : a < 0.56 ? 1 : a < 0.7 ? 2 : a < 0.84 ? 3 : 4, Math.min(z - fila * FILA, (fila + 1) * FILA - z, x + corre - col * COLUMNA, (col + 1) * COLUMNA - x - corre), col, fila, corre];
  };
  if (BIO.some((b) => b.lotes)) {
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      if (S[k] !== SUELOS.pasto.id || BORDE[k] < 6.4 || PELADO[k] || (varios && !BIO[ZONA[k]].lotes)) continue;
      const l = lote(x0 + i * celda, z0 + j * celda);
      if (l[1] > 1.3) CULTIVO[k] = l[0];
    }
    const libre = (x, z, lejosDelCamino) => {
      if (x < x0 + 4 || x > x1 - 4 || z < z0 + 4 || z > z1 - 4) return false;
      const k = Math.round(z - z0) * nx + Math.round(x - x0);
      return BORDE[k] > lejosDelCamino && grueso(LEJOS, x, z) < 84 && S[k] === SUELOS.pasto.id && !(varios && !BIO[ZONA[k]].lotes) && !claros.some((q) => (q.x - x) ** 2 + (q.z - z) ** 2 < q.r * q.r);
    };
    for (let fila = Math.floor(z0 / FILA); fila <= Math.floor(z1 / FILA); fila++) {
      const corre = (sorteo(fila, 7) - 0.5) * 60;
      for (let col = Math.floor((x0 + corre) / COLUMNA); col <= Math.floor((x1 + corre) / COLUMNA); col++) {
        const xl = col * COLUMNA - corre, zl = fila * FILA, que = lote(xl + 4, zl + 4)[0];
        // cortina de alamos sobre el borde izquierdo del lote
        if (sorteo(col * 3 + 1, fila) < 0.42) for (let z = zl + 3; z < zl + FILA - 2; z += 5.4) {
          const x = xl + (rnd() - 0.5) * 0.5;
          if (libre(x, z, 7.5)) anotar({ x, z, y: altura(x, z), r: 0.45, alto: 1.2 + rnd() * 0.5, clase: 'arbol', tipo: 'alamo', duro: 1, vuelta: rnd() * 6.28 });
        }
        if (que !== 0) continue;
        // en algunos lotes de pasto: un molino con su tanque, o unas vacas
        const cx = xl + COLUMNA * (0.3 + rnd() * 0.4), cz = zl + FILA * (0.3 + rnd() * 0.4), a = sorteo(col, fila * 5 + 2);
        if (a < 0.3 && molinos.length < 2 && libre(cx, cz, 11) && libre(cx + 4.5, cz, 9)) {
          const m = { x: cx, z: cz, y: altura(cx, cz), vuelta: rnd() * 6.28 };
          molinos.push(m); claros.push({ x: cx + 2, z: cz, r: 6.5 });
          anotar({ x: cx, z: cz, y: m.y, r: 0.9, alto: 3, clase: 'molino', duro: 1 });
          anotar({ x: cx + 4.5, z: cz, y: altura(cx + 4.5, cz), r: 2.1, alto: 1, clase: 'tanque', duro: 1 });
        } else if (a > 0.45) for (let n = 3 + Math.floor(rnd() * 6); n > 0; n--) {
          const x = cx + (rnd() - 0.5) * 26, z = cz + (rnd() - 0.5) * 22;
          if (libre(x, z, 9.5)) vacas.push({ x, z, y: altura(x, z), n: Math.floor(rnd() * 60), fase: rnd() });
        }
      }
    }
  }

  // --- 7. Arboles y piedras sueltas ---
  // (lo que crece depende del ambiente de cada lugar)
  const VERDE = BIO.map((b) => ({ tipos: b.arboles, pesoTotal: b.arboles.reduce((s, t) => s + t[1], 0), umbral: 0.78 - b.monte * 0.78, prob: 0.4 + b.monte * 0.5, borde: b.borde, piedras: b.piedras }));
  for (let z = z0 + 6; z < z1 - 6; z += 4.4) for (let x = x0 + 6; x < x1 - 6; x += 4.4) {
    const px = x + (rnd() - 0.5) * 4, pz = z + (rnd() - 0.5) * 4, a = rnd(), b = rnd(), c = rnd();
    const k = Math.round((pz - z0) / celda) * nx + Math.round((px - x0) / celda);
    if (grueso(LEJOS, px, pz) > 86 || BORDE[k] < 1.8 || PELADO[k] || agua(px, pz, H[k]) > 0) continue;
    let o = null;
    const { tipos, pesoTotal, umbral, prob, borde: bordeDelMonte, piedras: sueltas } = VERDE[varios ? ZONA[k] : 0];
    const empinado = Math.hypot(H[k + 1] - H[k - 1], H[k + nx] - H[k - nx]) / (2 * celda) > 0.36;   // sin arboles en las laderas: se tiene que ver la caida
    if (S[k] === SUELOS.pasto.id && !empinado && BORDE[k] > bordeDelMonte && !CULTIVO[k] && ruido.n2(px / 40, pz / 40) > umbral && a < prob) {
      if (claros.some((q) => (q.x - px) ** 2 + (q.z - pz) ** 2 < q.r * q.r)) continue;
      let w = c * pesoTotal, tipo = tipos[0][0];
      for (const t of tipos) { w -= t[1]; if (w <= 0) { tipo = t[0]; break; } }
      o = { r: tipo === 'arbusto' ? 0.3 : 0.45, alto: 0.8 + b * 0.9, clase: 'arbol', tipo, duro: tipo === 'arbusto' ? 0.2 : 1 };
    } else if (S[k] === SUELOS.roca.id && a < 0.16) o = { r: 0.7 + b * 1.1, alto: 0.5 + b * 0.6, clase: 'piedra', duro: 1 };
    else if (sueltas && S[k] === SUELOS.pasto.id && BORDE[k] > 2.6 && a > 1 - sueltas && !claros.some((q) => (q.x - px) ** 2 + (q.z - pz) ** 2 < q.r * q.r)) o = { r: 0.5 + b * 0.9, alto: 0.5 + c * 0.6, clase: 'piedra', duro: 1 };   // bloques sueltos en la estepa
    if (!o) continue;
    o.x = px; o.z = pz; o.y = H[k]; o.vuelta = a * 6.28;
    anotar(o);
  }

  // --- Mas consultas que usa el juego ---
  function normal(x, z, o) {
    const e = 0.45, sx = altura(x + e, z) - altura(x - e, z), sz = altura(x, z + e) - altura(x, z - e), l = Math.hypot(sx, 2 * e, sz);
    o[0] = -sx / l; o[1] = 2 * e / l; o[2] = -sz / l;
    return o;
  }
  // el agarre de cada celda: con lluvia, la tierra y el ripio agarran menos (el asfalto y la roca, casi igual)
  const AG = new Float32Array(nx * nz), FR = new Float32Array(nx * nz), PA = new Float32Array(nx * nz);
  for (let k = 0; k < nx * nz; k++) {
    const s = SUELO[S[k]];
    AG[k] = s.agarre * (s.blando > 0 ? clima.agarre : 1 - (1 - clima.agarre) * 0.4); FR[k] = s.freno; PA[k] = s.pasta;
  }
  function suelo(x, z, o) {
    const u = Math.min(nx - 1.001, Math.max(0, (x - x0) / celda)), v = Math.min(nz - 1.001, Math.max(0, (z - z0) / celda));
    const i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j, k = j * nx + i;
    const w0 = (1 - fu) * (1 - fv), w1 = fu * (1 - fv), w2 = (1 - fu) * fv, w3 = fu * fv;
    o.agarre = AG[k] * w0 + AG[k + 1] * w1 + AG[k + nx] * w2 + AG[k + nx + 1] * w3;
    o.freno = FR[k] * w0 + FR[k + 1] * w1 + FR[k + nx] * w2 + FR[k + nx + 1] * w3;
    o.pasta = PA[k] * w0 + PA[k + 1] * w1 + PA[k + nx] * w2 + PA[k + nx + 1] * w3;
    o.id = S[k + (fu > 0.5 ? 1 : 0) + (fv > 0.5 ? nx : 0)];
    o.agua = aguas.length ? agua(x, z, altura(x, z)) : 0;
    if (o.agua > 0) { const a = Math.min(1, o.agua); o.pasta += a * 170; o.agarre *= 1 - 0.2 * a; }
    return o;
  }
  // En una vuelta cerrada, lo que usa el juego es el camino "desenrollado": tres vueltas seguidas. Se larga cerca del final
  // de la primera (unos metros antes de la raya), se corre siempre en la segunda, y la tercera esta para poder mirar adelante.
  const L = etapa.vuelta ? P.n : 0, C = L ? desenrollar(P, 3) : P;
  // punto del camino mas cercano, buscando solo alrededor del ultimo conocido:
  // asi no "salta" a otra parte de la pista que pase cerca
  function indice(x, z, pista) {
    let mejor = pista, md = 1e9;
    for (let i = Math.max(0, pista - 30); i < Math.min(C.n, pista + 60); i++) {
      const dx = x - C.X[i], dz = z - C.Z[i], d = dx * dx + dz * dz;
      if (d < md) { md = d; mejor = i; }
    }
    return mejor;
  }
  const pose = (i) => ({ i, x: C.X[i], y: C.Y[i], z: C.Z[i], rumbo: Math.atan2(C.HX[i], -C.HZ[i]), ancho: C.W[i] });
  const controles = etapa.tramos.filter((t) => t.control).map((t) => pose(L + t.hasta - 1));
  // la largada (donde se apoya el auto), la salida (la raya) y la meta. En una vuelta cerrada la raya es una sola:
  // esta donde empieza la vuelta, se larga 60 metros antes y la "meta" es la misma raya, una vuelta despues.
  const largada = L ? pose(L - 60) : pose(8), salida = L ? pose(L) : pose(15), meta = L ? pose(2 * L) : pose(P.n - 22);
  // los sectores: de la largada al primer control, de control a control, y del ultimo a la meta
  const cortes = [L ? L : largada.i, ...controles.map((c) => c.i), meta.i], sectores = [];
  for (let k = 0; k < cortes.length - 1; k++) sectores.push({ desde: cortes[k], hasta: cortes[k + 1] });

  return {
    etapa, bioma, clima, camino: C, x0, z0, x1, z1, nx, nz, celda, H, S, borde: BORDE,
    // los ambientes por los que pasa la pista (el primero es el de la etapa), en cual esta cada celda (zona: null si hay uno solo)
    // y cual toca en un lugar del mapa
    biomas, zona: ZONA, biomaEn: (x, z) => (ZONA ? biomas[ZONA[Math.max(0, Math.min(nz - 1, Math.round(z - z0))) * nx + Math.max(0, Math.min(nx - 1, Math.round(x - x0)))]] : biomas[0]), orilla: ORILLA, cultivo: CULTIVO, pelado: PELADO, claros, aguas, vacas, molinos, cosas, postes, fardos, publico, cintas, carteles, mojones, autos, estacionados,
    casas, objetos, barandas, pircas, puentes, estorbos,
    vuelta: L ? { largo: L, desde: L, hasta: 2 * L } : null,   // (solo en una vuelta cerrada) cuanto mide, y entre que metros del camino se corre
    // cuanto se corren hacia la derecha las rodadas en un metro del camino (0 si la pista no las tiene): el piloto automatico las sigue
    enSurco,
    surcoCentro: hayS ? (i) => serpiente(i, SU.cul[Math.max(0, Math.min(P.n - 1, Math.round(i)))]) : () => 0,
        altura, normal, suelo, corriente, indice, controles, sectores, largada, salida, meta,
    cosasCerca: (x, z) => cajasCosas.get(clave(Math.floor(x / 8), Math.floor(z / 8))),
  };
}

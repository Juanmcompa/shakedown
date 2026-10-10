// Construye el terreno de una pista: alturas, suelos, agua, arboles, piedras, publico y carteles.
// No dibuja nada: solo calcula. Lo usan la fisica y el dibujo.
import { SUELOS, SUELO } from './config.js';
import { BIOMAS, CLIMAS } from './generador.js';
import { crearRuido, azar } from './noise.js';

const RAD = Math.PI / 180;
const suave = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const mezcla = (a, b, t) => a + (b - a) * t;

function promedio(v, r) {
  const o = new Float32Array(v.length);
  for (let i = 0; i < v.length; i++) {
    let s = 0, c = 0;
    for (let j = Math.max(0, i - r); j <= Math.min(v.length - 1, i + r); j++) { s += v[j]; c++; }
    o[i] = s / c;
  }
  return o;
}

// Recorre los tramos y devuelve un punto del camino por metro.
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
  P.G = promedio(pend, 5); P.W = promedio(ancho, 4); P.B = promedio(peralte, 5); P.R = promedio(rug, 3);
  let y = 0;
  for (i = 0; i < n; i++) { y += P.G[i]; P.Y[i] = y; }
  return P;
}

export function crearTerreno(etapa) {
  const ruido = crearRuido(etapa.semilla || 1), rnd = azar((etapa.semilla || 1) * 977);
  const bioma = BIOMAS[etapa.bioma] || BIOMAS.bosque, clima = CLIMAS[etapa.clima] || CLIMAS.sol;
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

  // --- 1. Relieve general: se interpola la altura del camino y de sus laderas ---
  const pts = [];
  for (let i = 0; i < P.n; i += 2) {
    const t = etapa.tramos[P.T[i]], der = t.der || [0, 1], izq = t.izq || [0, 1];
    pts.push(P.X[i], P.Z[i], P.Y[i], -P.HZ[i], P.HX[i], der[0], der[1], izq[0], izq[1], P.W[i] / 2);
  }
  const G = 4, gx = Math.ceil((nx - 1) * celda / G) + 2, gz = Math.ceil((nz - 1) * celda / G) + 2;
  const M = new Float32Array(gx * gz), LEJOS = new Float32Array(gx * gz);
  for (let j = 0; j < gz; j++) for (let i = 0; i < gx; i++) {
    const x = x0 + i * G, z = z0 + j * G;
    let sw = 0, sh = 0, dm = 1e9;
    for (let k = 0; k < pts.length; k += 10) {
      const ax = x - pts[k], az = z - pts[k + 1], d2 = ax * ax + az * az, w = 1 / ((d2 + 12) * (d2 + 12));
      const lado = ax * pts[k + 3] + az * pts[k + 4], f = Math.max(0, Math.abs(lado) - pts[k + 9]);
      sw += w;
      sh += w * (pts[k + 2] + (lado > 0 ? pts[k + 5] * Math.min(1, f / pts[k + 6]) : pts[k + 7] * Math.min(1, f / pts[k + 8])));
      if (d2 < dm) dm = d2;
    }
    dm = Math.sqrt(dm);
    M[j * gx + i] = sh / sw + ruido.capas(x / 120, z / 120, 3) * bioma.relieve * suave(30, 120, dm);
    LEJOS[j * gx + i] = dm;
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
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const x = x0 + i * celda, z = z0 + j * celda, k = j * nx + i;
    const lejos = grueso(LEJOS, x, z);
    let h = grueso(M, x, z), borde = lejos;
    const lomas = ruido.capas(x / 26, z / 26, 3) * lomitas, pozitos = ruido.capas(x / 6, z / 6, 2) * 0.3;
    const c = lejos < 36 ? cerca(x, z) : -1;
    if (c < 0) h += lomas + pozitos;
    else {
      const t = etapa.tramos[P.T[c]], ax = x - P.X[c], az = z - P.Z[c];
      const largo = ax * P.HX[c] + az * P.HZ[c], lado = az * P.HX[c] - ax * P.HZ[c];
      const fuera = (c === 0 && largo < -0.6) || (c === P.n - 1 && largo > 0.6);
      const d = fuera ? Math.hypot(ax, az) : Math.abs(lado), medio = P.W[c] / 2, u = P.U[c] + largo;
      let hc = P.Y[c] + P.G[c] * largo + P.B[c] * lado + ruido.capas(x / P.RL[c], z / P.RL[c], 2) * P.R[c];
      let suelo = P.S[c];
      if (t.pozos) for (const p of t.pozos) {
        const dd = Math.hypot(u - p[0], lado - p[1]);
        if (dd < p[2]) { const f = 1 - suave(0.45 * p[2], p[2], dd); hc -= p[3] * f; if (f > 0.35) suelo = SUELOS[p[4]].id; }
      }
      const f = suave(medio, medio + (t.hombro || 4), d);
      h = mezcla(hc, h + lomas * suave(medio + 2, medio + 18, d) + pozitos, f);
      borde = d - medio;
      if (d < medio + 0.6) S[k] = suelo; else if (d < medio + 1.9 && !t.agua) ORILLA[k] = 1;
    }
    H[k] = h; BORDE[k] = borde;
  }

  // --- 3. Agua: un arroyo cruza el camino en los tramos que tienen "agua" ---
  // Es corto: nace y termina a los costados del camino, para no cortar otras partes de la pista.
  const aguas = [];
  const curva = (b) => 9 * Math.sin(b / 21) * suave(5, 26, Math.abs(b));
  for (const t of etapa.tramos) {
    if (!t.agua) continue;
    const m = (t.desde + t.hasta) >> 1, medio = t.largo / 2;
    const a = { x: P.X[m], z: P.Z[m], hx: P.HX[m], hz: P.HZ[m], nivel: P.Y[m] + t.agua.hondo, cruce: medio + 16, largo: t.agua.largo / 2 };
    aguas.push(a);
    const i0 = Math.max(0, Math.floor(a.x - x0 - a.largo - 24)), i1 = Math.min(nx - 1, Math.ceil(a.x - x0 + a.largo + 24));
    const j0 = Math.max(0, Math.floor(a.z - z0 - a.largo - 24)), j1 = Math.min(nz - 1, Math.ceil(a.z - z0 + a.largo + 24));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = x0 + i * celda, z = z0 + j * celda, k = j * nx + i, ax = x - a.x, az = z - a.z;
      const pb = az * a.hx - ax * a.hz, pa = Math.abs(ax * a.hx + az * a.hz - curva(pb));
      if (Math.abs(pb) > a.largo || pa > medio + 9) continue;
      // el cauce se va cerrando hacia las puntas
      const f = (1 - suave(medio - 1, medio + 7, pa)) * (1 - suave(a.largo - 13, a.largo - 1, Math.abs(pb)));
      const lecho = P.Y[m] - 0.1 + ruido.capas(x / 5, z / 5, 2) * 0.18;
      if (f > 0 && H[k] > lecho) H[k] = mezcla(H[k], lecho, f);
      if (H[k] < a.nivel + 0.25 && S[k] === 255) S[k] = SUELOS.lecho.id;
    }
  }
  function agua(x, z, h) {
    for (const a of aguas) {
      const ax = x - a.x, az = z - a.z;
      if (Math.abs(ax * a.hx + az * a.hz) < a.cruce && Math.abs(az * a.hx - ax * a.hz) < a.largo) return Math.max(0, a.nivel - h);
    }
    return 0;
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
  // Todo lo que se puede chocar es un circulo de radio r. "duro": cuanto golpea (1 = arbol o piedra; menos = frena poco).
  // "cede": si se lo choca fuerte queda tirado y ya no molesta (postes y fardos).
  const cosas = [], cajasCosas = new Map();
  function anotar(o) {
    cosas.push(o);
    const e = o.r + 1.1;
    for (let cx = Math.floor((o.x - e) / 8); cx <= Math.floor((o.x + e) / 8); cx++) for (let cz = Math.floor((o.z - e) / 8); cz <= Math.floor((o.z + e) / 8); cz++) {
      const kk = clave(cx, cz);
      if (!cajasCosas.has(kk)) cajasCosas.set(kk, []);
      cajasCosas.get(kk).push(o);
    }
  }
  const publico = [], cintas = [], carteles = [], mojones = [], autos = [], fardos = [], claros = [], estacionados = [];
  for (const t of etapa.tramos) {
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
    // autos tirados: [metros desde el inicio del tramo, metros a la derecha, giro en grados, estado]
    // estado 0 = abandonado, 1 = volcado de costado, 2 = hundido en el barro
    for (const a of t.autos || []) {
      const l = lugar(t, a[0], a[1]), rumbo = l.rumbo + (a[2] || 0) * RAD;
      autos.push({ x: l.x, z: l.z, y: l.y, rumbo, estado: a[3] || 0, n: autos.length });
      for (const s of [-1.15, 1.15]) {   // se choca contra dos circulos, uno por cada mitad del auto
        const x = l.x + Math.sin(rumbo) * s, z = l.z - Math.cos(rumbo) * s;
        anotar({ x, z, y: altura(x, z), r: 1.1, alto: 1, clase: 'auto', duro: 1 });
      }
    }
    // mojones blancos al borde de los precipicios
    for (const lado of [1, -1]) {
      const ladera = lado > 0 ? t.der : t.izq;
      if (!ladera || ladera[0] > -10) continue;
      for (let i = t.desde + 2; i < t.hasta; i += 5) {
        const d = lado * (P.W[i] / 2 + 0.45), x = P.X[i] - P.HZ[i] * d, z = P.Z[i] + P.HX[i] * d;
        mojones.push({ x, z, y: altura(x, z) });
      }
    }
  }
  // alambrado: en el campo, una fila de postes a cada lado del camino. Ceden si se los choca.
  const postes = [];
  if (bioma.alambrado) {
    for (let i = 6; i < P.n - 4; i += 7) {
      const t = etapa.tramos[P.T[i]];
      if (t.agua || t.izq || t.der) continue;
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
  if (bioma.lotes) {
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      if (S[k] !== SUELOS.pasto.id || BORDE[k] < 6.4) continue;
      const l = lote(x0 + i * celda, z0 + j * celda);
      if (l[1] > 1.3) CULTIVO[k] = l[0];
    }
    const libre = (x, z, lejosDelCamino) => {
      if (x < x0 + 4 || x > x1 - 4 || z < z0 + 4 || z > z1 - 4) return false;
      const k = Math.round(z - z0) * nx + Math.round(x - x0);
      return BORDE[k] > lejosDelCamino && grueso(LEJOS, x, z) < 84 && S[k] === SUELOS.pasto.id && !claros.some((q) => (q.x - x) ** 2 + (q.z - z) ** 2 < q.r * q.r);
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
  const tipos = bioma.arboles, pesoTotal = tipos.reduce((s, t) => s + t[1], 0);
  const umbral = 0.78 - bioma.monte * 0.78, prob = 0.4 + bioma.monte * 0.5;
  for (let z = z0 + 6; z < z1 - 6; z += 4.4) for (let x = x0 + 6; x < x1 - 6; x += 4.4) {
    const px = x + (rnd() - 0.5) * 4, pz = z + (rnd() - 0.5) * 4, a = rnd(), b = rnd(), c = rnd();
    const k = Math.round((pz - z0) / celda) * nx + Math.round((px - x0) / celda);
    if (grueso(LEJOS, px, pz) > 86 || BORDE[k] < 1.8 || agua(px, pz, H[k]) > 0) continue;
    let o = null;
    const empinado = Math.hypot(H[k + 1] - H[k - 1], H[k + nx] - H[k - nx]) / (2 * celda) > 0.36;   // sin arboles en las laderas: se tiene que ver la caida
    if (S[k] === SUELOS.pasto.id && !empinado && BORDE[k] > bioma.borde && !CULTIVO[k] && ruido.n2(px / 40, pz / 40) > umbral && a < prob) {
      if (claros.some((q) => (q.x - px) ** 2 + (q.z - pz) ** 2 < q.r * q.r)) continue;
      let w = c * pesoTotal, tipo = tipos[0][0];
      for (const t of tipos) { w -= t[1]; if (w <= 0) { tipo = t[0]; break; } }
      o = { r: tipo === 'arbusto' ? 0.3 : 0.45, alto: 0.8 + b * 0.9, clase: 'arbol', tipo, duro: tipo === 'arbusto' ? 0.2 : 1 };
    } else if (S[k] === SUELOS.roca.id && a < 0.16) o = { r: 0.7 + b * 1.1, alto: 0.5 + b * 0.6, clase: 'piedra', duro: 1 };
    else if (bioma.piedras && S[k] === SUELOS.pasto.id && BORDE[k] > 2.6 && a > 1 - bioma.piedras && !claros.some((q) => (q.x - px) ** 2 + (q.z - pz) ** 2 < q.r * q.r)) o = { r: 0.5 + b * 0.9, alto: 0.5 + c * 0.6, clase: 'piedra', duro: 1 };   // bloques sueltos en la estepa
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
  // punto del camino mas cercano, buscando solo alrededor del ultimo conocido:
  // asi no "salta" a otra parte de la pista que pase cerca
  function indice(x, z, pista) {
    let mejor = pista, md = 1e9;
    for (let i = Math.max(0, pista - 30); i < Math.min(P.n, pista + 60); i++) {
      const dx = x - P.X[i], dz = z - P.Z[i], d = dx * dx + dz * dz;
      if (d < md) { md = d; mejor = i; }
    }
    return mejor;
  }
  const pose = (i) => ({ i, x: P.X[i], y: P.Y[i], z: P.Z[i], rumbo: Math.atan2(P.HX[i], -P.HZ[i]), ancho: P.W[i] });
  const controles = etapa.tramos.filter((t) => t.control).map((t) => pose(t.hasta - 1));
  const largada = pose(8), meta = pose(P.n - 22);
  // los sectores: de la largada al primer control, de control a control, y del ultimo a la meta
  const cortes = [largada.i, ...controles.map((c) => c.i), meta.i], sectores = [];
  for (let k = 0; k < cortes.length - 1; k++) sectores.push({ desde: cortes[k], hasta: cortes[k + 1] });

  return {
    etapa, bioma, clima, camino: P, x0, z0, x1, z1, nx, nz, celda, H, S, borde: BORDE, orilla: ORILLA, cultivo: CULTIVO, claros, aguas, vacas, molinos, cosas, postes, fardos, publico, cintas, carteles, mojones, autos, estacionados,
    altura, normal, suelo, indice, controles, sectores, largada, salida: pose(15), meta,
    cosasCerca: (x, z) => cajasCosas.get(clave(Math.floor(x / 8), Math.floor(z / 8))),
  };
}

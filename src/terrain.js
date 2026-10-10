// Construye el terreno de una etapa: alturas, suelos, agua, arboles y piedras.
// No dibuja nada: solo calcula. Lo usan la fisica y el dibujo.
import { SUELOS, SUELO } from './config.js';
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
  const P = { n, X: F(), Z: F(), Y: F(), HX: F(), HZ: F(), RL: F(), S: new Uint8Array(n), T: new Uint16Array(n), U: F() };
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
  const P = crearCamino(etapa);
  const celda = etapa.celda || 1, margen = 80;
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (let i = 0; i < P.n; i++) {
    x0 = Math.min(x0, P.X[i]); x1 = Math.max(x1, P.X[i]); z0 = Math.min(z0, P.Z[i]); z1 = Math.max(z1, P.Z[i]);
  }
  x0 = Math.floor(x0 - margen); z0 = Math.floor(z0 - margen);
  const nx = Math.ceil((x1 + margen - x0) / celda) + 1, nz = Math.ceil((z1 + margen - z0) / celda) + 1;
  x1 = x0 + (nx - 1) * celda; z1 = z0 + (nz - 1) * celda;
  const H = new Float32Array(nx * nz), S = new Uint8Array(nx * nz).fill(255), BORDE = new Float32Array(nx * nz);

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
    M[j * gx + i] = sh / sw + ruido.capas(x / 120, z / 120, 3) * 18 * suave(30, 120, dm);
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
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const x = x0 + i * celda, z = z0 + j * celda, k = j * nx + i;
    const lejos = grueso(LEJOS, x, z);
    let h = grueso(M, x, z), borde = lejos;
    const lomas = ruido.capas(x / 26, z / 26, 3) * 2.2, pozitos = ruido.capas(x / 6, z / 6, 2) * 0.3;
    const c = lejos < 36 ? cerca(x, z) : -1;
    if (c < 0) h += lomas + pozitos;
    else {
      const t = etapa.tramos[P.T[c]], ax = x - P.X[c], az = z - P.Z[c];
      const largo = ax * P.HX[c] + az * P.HZ[c], lado = az * P.HX[c] - ax * P.HZ[c];
      const fuera = (c === 0 && largo < -0.6) || (c === P.n - 1 && largo > 0.6);
      const d = fuera ? Math.hypot(ax, az) : Math.abs(lado), medio = P.W[c] / 2, u = P.U[c] + largo;
      let hc = P.Y[c] + P.G[c] * largo + P.B[c] * lado + ruido.capas(x / P.RL[c], z / P.RL[c], 2) * P.R[c];
      let suelo = P.S[c];
      if (t.escalones) {
        const e = (u + 1.3 * Math.sin(lado * 0.8 + P.T[c])) / t.escalones[0], f = e - Math.floor(e);
        hc += t.escalones[1] * (suave(0.78, 1, f) - f + 0.4);
      }
      if (t.pozos) for (const p of t.pozos) {
        const dd = Math.hypot(u - p[0], lado - p[1]);
        if (dd < p[2]) { const f = 1 - suave(0.45 * p[2], p[2], dd); hc -= p[3] * f; if (f > 0.35) suelo = SUELOS[p[4]].id; }
      }
      const f = suave(medio, medio + (t.hombro || 4), d);
      h = mezcla(hc, h + lomas * suave(medio + 2, medio + 18, d) + pozitos, f);
      borde = d - medio;
      if (d < medio + 0.6) S[k] = suelo;
    }
    H[k] = h; BORDE[k] = borde;
  }

  // --- 3. Agua: un rio cruza el camino en los tramos que tienen "agua" ---
  const aguas = [];
  const curva = (b) => 13 * Math.sin(b / 27) * suave(4, 30, Math.abs(b));
  for (const t of etapa.tramos) {
    if (!t.agua) continue;
    const m = (t.desde + t.hasta) >> 1, medio = t.largo / 2;
    const a = { x: P.X[m], z: P.Z[m], hx: P.HX[m], hz: P.HZ[m], nivel: P.Y[m] + t.agua.hondo, cruce: medio + 22, largo: t.agua.largo / 2 };
    aguas.push(a);
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const x = x0 + i * celda, z = z0 + j * celda, k = j * nx + i, ax = x - a.x, az = z - a.z;
      const pb = az * a.hx - ax * a.hz, pa = Math.abs(ax * a.hx + az * a.hz - curva(pb));
      if (Math.abs(pb) > a.largo || pa > medio + 9) continue;
      const f = 1 - suave(medio - 1, medio + 7, pa);
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

  // --- 5. Arboles y piedras (tipo 0, 1 y 2 = arboles; 3 = piedra) ---
  const cosas = [], cajasCosas = new Map();
  for (let z = z0 + 6; z < z1 - 6; z += 4.4) for (let x = x0 + 6; x < x1 - 6; x += 4.4) {
    const px = x + (rnd() - 0.5) * 4, pz = z + (rnd() - 0.5) * 4, a = rnd(), b = rnd();
    const k = Math.round((pz - z0) / celda) * nx + Math.round((px - x0) / celda);
    if (grueso(LEJOS, px, pz) > 90 || BORDE[k] < 1.8 || agua(px, pz, H[k]) > 0) continue;
    let o = null;
    const empinado = Math.hypot(H[k + 1] - H[k - 1], H[k + nx] - H[k - nx]) / (2 * celda) > 0.36;   // sin arboles en las laderas: se tiene que ver la caida
    if (S[k] === SUELOS.pasto.id && !empinado && BORDE[k] > 4.8 && ruido.n2(px / 40, pz / 40) > 0.3 && a < 0.62) o = { r: 0.45, alto: 0.8 + b * 0.9, tipo: b > 0.97 ? 2 : (a < 0.2 ? 1 : 0) };
    else if (S[k] === SUELOS.roca.id && a < 0.16) o = { r: 0.7 + b * 1.1, alto: 0.5 + b * 0.6, tipo: 3 };
    if (!o) continue;
    o.x = px; o.z = pz; o.y = H[k]; o.vuelta = a * 6.28;
    cosas.push(o);
    const e = o.r + 1.1;
    for (let cx = Math.floor((px - e) / 8); cx <= Math.floor((px + e) / 8); cx++) for (let cz = Math.floor((pz - e) / 8); cz <= Math.floor((pz + e) / 8); cz++) {
      const kk = clave(cx, cz);
      if (!cajasCosas.has(kk)) cajasCosas.set(kk, []);
      cajasCosas.get(kk).push(o);
    }
  }

  // --- 6. Charcos (los pozos de pantano) y mojones blancos al borde de los precipicios ---
  const charcos = [], mojones = [];
  for (const t of etapa.tramos) {
    for (const p of t.pozos || []) {
      if (p[4] !== 'pantano') continue;
      const i = t.desde + Math.round(p[0]);
      charcos.push({ x: P.X[i] - P.HZ[i] * p[1], z: P.Z[i] + P.HX[i] * p[1], y: P.Y[i] - p[3] * 0.45, r: p[2] * 0.95 });
    }
    for (const lado of [1, -1]) {
      const ladera = lado > 0 ? t.der : t.izq;
      if (!ladera || ladera[0] > -10) continue;
      for (let i = t.desde + 2; i < t.hasta; i += 5) {
        const d = lado * (P.W[i] / 2 + 0.45), x = P.X[i] - P.HZ[i] * d, z = P.Z[i] + P.HX[i] * d;
        mojones.push({ x, z, y: altura(x, z) });
      }
    }
  }

  // --- Consultas que usa el juego ---
  function altura(x, z) {
    const u = Math.min(nx - 1.001, Math.max(0, (x - x0) / celda)), v = Math.min(nz - 1.001, Math.max(0, (z - z0) / celda));
    const i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j, k = j * nx + i;
    return fu + fv <= 1 ? H[k] + (H[k + 1] - H[k]) * fu + (H[k + nx] - H[k]) * fv
      : H[k + nx + 1] + (H[k + nx] - H[k + nx + 1]) * (1 - fu) + (H[k + 1] - H[k + nx + 1]) * (1 - fv);
  }
  function normal(x, z, o) {
    const e = 0.45, sx = altura(x + e, z) - altura(x - e, z), sz = altura(x, z + e) - altura(x, z - e), l = Math.hypot(sx, 2 * e, sz);
    o[0] = -sx / l; o[1] = 2 * e / l; o[2] = -sz / l;
    return o;
  }
  const AG = new Float32Array(nx * nz), FR = new Float32Array(nx * nz), PA = new Float32Array(nx * nz);
  for (let k = 0; k < nx * nz; k++) { const s = SUELO[S[k]]; AG[k] = s.agarre; FR[k] = s.freno; PA[k] = s.pasta; }
  function suelo(x, z, o) {
    const u = Math.min(nx - 1.001, Math.max(0, (x - x0) / celda)), v = Math.min(nz - 1.001, Math.max(0, (z - z0) / celda));
    const i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j, k = j * nx + i;
    const w0 = (1 - fu) * (1 - fv), w1 = fu * (1 - fv), w2 = (1 - fu) * fv, w3 = fu * fv;
    o.agarre = AG[k] * w0 + AG[k + 1] * w1 + AG[k + nx] * w2 + AG[k + nx + 1] * w3;
    o.freno = FR[k] * w0 + FR[k + 1] * w1 + FR[k + nx] * w2 + FR[k + nx + 1] * w3;
    o.pasta = PA[k] * w0 + PA[k + 1] * w1 + PA[k + nx] * w2 + PA[k + nx + 1] * w3;
    o.id = S[k + (fu > 0.5 ? 1 : 0) + (fv > 0.5 ? nx : 0)];
    o.agua = agua(x, z, altura(x, z));
    if (o.agua > 0) { const a = Math.min(1, o.agua); o.pasta += a * 170; o.agarre *= 1 - 0.2 * a; }
    return o;
  }
  // punto del camino mas cercano, buscando alrededor del ultimo conocido
  // (si quedo lejos, por ejemplo al caerse a un tramo de abajo, busca en todo lo ya recorrido)
  function indice(x, z, pista) {
    let mejor = pista, md = 1e9;
    const buscar = (a, b) => {
      for (let i = Math.max(0, a); i < Math.min(P.n, b); i++) {
        const dx = x - P.X[i], dz = z - P.Z[i], d = dx * dx + dz * dz;
        if (d < md) { md = d; mejor = i; }
      }
    };
    buscar(pista - 30, pista + 50);
    if (md > 400) buscar(0, pista - 30);
    return mejor;
  }
  const pose = (i) => ({ i, x: P.X[i], y: P.Y[i], z: P.Z[i], rumbo: Math.atan2(P.HX[i], -P.HZ[i]), ancho: P.W[i] });
  const controles = etapa.tramos.filter((t) => t.control).map((t) => pose(t.hasta - 1));

  return {
    etapa, camino: P, x0, z0, x1, z1, nx, nz, celda, H, S, aguas, cosas, charcos, mojones,
    altura, normal, suelo, indice, controles, largada: pose(8), meta: pose(P.n - 22),
    cosasCerca: (x, z) => cajasCosas.get(clave(Math.floor(x / 8), Math.floor(z / 8))),
  };
}

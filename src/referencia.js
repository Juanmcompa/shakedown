// La referencia de una pista: por donde pasaria y cuanto tardaria un piloto muy bueno con un auto dado.
// Sirve para tres cosas: el tiempo de referencia de cada sector (de ahi salen los cuadraditos de colores),
// la velocidad a la que conviene llegar a cada curva (la usan los pilotos de prueba) y saber cuanto dura la pista.
// No maneja nada: es una cuenta sobre el trazado, metro por metro.
import { JUEGO, SUELO } from './config.js';

const lim = (v, a, b) => (v < a ? a : v > b ? b : v);

// T: el terreno. C: el auto (de config.js). o.margen: metros que deja libres a cada borde. o.usa: que parte del agarre aprovecha (0 a 1).
export function crearReferencia(T, C, o = {}) {
  const P = T.camino, n = P.n, g = JUEGO.gravedad, margen = o.margen || 1.4, usa = o.usa || 0.76;
  const tramos = T.etapa.tramos;

  // --- 1. la trazada: cuanto se corre del medio en cada metro (positivo = a la derecha) ---
  // Se parte del medio del camino y se "tensa" la linea como una banda elastica, sin dejarla salir del camino:
  // asi abre las curvas por afuera y las corta por adentro, como hace un piloto.
  const lo = new Float32Array(n), hi = new Float32Array(n), corre = new Float32Array(n), estorbo = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const t = tramos[P.T[i]], libre = Math.max(0, P.W[i] / 2 - margen);
    lo[i] = -libre; hi[i] = libre;
    // en la cornisa, mas lejos del vacio
    if (t.der && t.der[0] < -6) hi[i] = Math.max(0, libre - 0.6);
    if (t.izq && t.izq[0] < -6) lo[i] = -Math.max(0, libre - 0.6);
    // la largada y la llegada, por el medio
    const punta = Math.min(1, Math.max(0, (i - T.largada.i) / 30), (n - 1 - i) / 20);
    lo[i] *= punta; hi[i] *= punta;
  }
  // lo que esta metido en el camino (un auto estacionado, un volquete): la trazada pasa por el lado que deja mas lugar
  for (const e of T.estorbos || []) {
    const largo = Math.ceil(e.largo + 7), pasa = 1.2;   // (pasa: medio auto y un poco mas)
    for (let k = Math.max(0, e.i - largo); k <= Math.min(n - 1, e.i + largo); k++) {
      if (e.lado >= 0) hi[k] = Math.min(hi[k], e.lado - e.medio - pasa); else lo[k] = Math.max(lo[k], e.lado + e.medio + pasa);
      if (hi[k] < lo[k]) hi[k] = lo[k] = (hi[k] + lo[k]) / 2;
      estorbo[k] = 1;
    }
  }
  const nx = (i) => -P.HZ[i], nz = (i) => P.HX[i];
  for (const paso of [32, 16, 8, 4, 2, 1]) {
    for (let vuelta = 0; vuelta < 60; vuelta++) {
      for (let k = paso; k < n - paso; k++) {
        const i = vuelta % 2 ? n - 1 - k : k, a = i - paso, b = i + paso;
        // el punto que dejaria derecha la linea entre el de atras y el de adelante
        const mx = (P.X[a] + nx(a) * corre[a] + P.X[b] + nx(b) * corre[b]) / 2 - P.X[i], mz = (P.Z[a] + nz(a) * corre[a] + P.Z[b] + nz(b) * corre[b]) / 2 - P.Z[i];
        const ideal = mx * nx(i) + mz * nz(i);
        corre[i] = lim(corre[i] + (ideal - corre[i]) * 0.5, lo[i], hi[i]);
      }
    }
  }
  const LX = new Float32Array(n), LZ = new Float32Array(n);
  for (let i = 0; i < n; i++) { LX[i] = P.X[i] + nx(i) * corre[i]; LZ[i] = P.Z[i] + nz(i) * corre[i]; }

  // --- 2. cuanto dobla la trazada en cada metro, y como es el piso ahi ---
  const K = new Float32Array(n), DS = new Float32Array(n), MU = new Float32Array(n), ROCE = new Float32Array(n), PASTA = new Float32Array(n);
  const s = { agarre: 1, freno: 0, pasta: 0, id: 0, agua: 0 };
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 3), b = Math.min(n - 1, i + 3);
    const ax = LX[i] - LX[a], az = LZ[i] - LZ[a], bx = LX[b] - LX[i], bz = LZ[b] - LZ[i], cx = LX[b] - LX[a], cz = LZ[b] - LZ[a];
    const la = Math.hypot(ax, az), lb = Math.hypot(bx, bz), lc = Math.hypot(cx, cz);
    K[i] = la * lb * lc > 1e-6 ? 2 * (ax * bz - az * bx) / (la * lb * lc) : 0;
    DS[i] = i < n - 1 ? Math.hypot(LX[i + 1] - LX[i], LZ[i + 1] - LZ[i]) : 1;
    T.suelo(LX[i], LZ[i], s);
    MU[i] = s.agarre * C.cubiertas[SUELO[s.id].blando >= 0.5 ? 1 : 0]; ROCE[i] = s.freno; PASTA[i] = s.pasta;
  }
  const suavizar = (v, r, minimo) => {
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      let suma = 0, c = 0, m = 1e9;
      for (let j = Math.max(0, i - r); j <= Math.min(n - 1, i + r); j++) { suma += v[j]; c++; if (v[j] < m) m = v[j]; }
      out[i] = minimo ? Math.min(suma / c, m * 1.08) : suma / c;
    }
    return out;
  };
  const curva = suavizar(K, 2), mu = suavizar(MU, 3, true), roce = suavizar(ROCE, 2), pasta = suavizar(PASTA, 2);

  // --- 3. la velocidad: lo que deja cada curva, lo que da el motor acelerando y lo que dan los frenos ---
  const largo = 2 * C.ejes, alto = 0.62;                       // distancia entre ejes y altura del centro de masa
  const [adelante, atras] = C.traccion, pesoAdelante = 0.5 + C.centro / largo;   // parte del peso que carga el eje de adelante
  const v = new Float32Array(n), tope = new Float32Array(n);
  // (un tramo puede traer su propio tope de velocidad, en m/s: las lajas, un paso entre obstaculos)
  for (let i = 0; i < n; i++) tope[i] = Math.min(60, tramos[P.T[i]].tope || 60, Math.sqrt(usa * mu[i] * g / Math.max(Math.abs(curva[i]), 1e-4)));
  // lo que frena solo: el piso, el barro, el aire y la subida (en m/s2, positivo = frena)
  const frena = (i, vel) => roce[i] * g + 4 * pasta[i] * vel / C.masa + C.aire * vel * vel / C.masa + g * P.G[i] / Math.hypot(1, P.G[i]);
  const i0 = T.largada.i;
  v[i0] = 0;
  for (let i = i0; i < n - 1; i++) {
    // acelerando se aprovecha todo el agarre (es pisar a fondo); doblando y frenando, solo la parte "usa"
    const vel = Math.max(v[i], 0.5), m = mu[i] * g, deCostado = Math.min(m, vel * vel * Math.abs(curva[i]));
    const queda = Math.sqrt(m * m - deCostado * deCostado);   // lo que sobra del agarre para acelerar
    // con traccion en un solo eje, solo empujan las ruedas de ese eje (y al acelerar el peso se va para atras)
    const sube = P.G[i] * alto / largo;   // en subida, el peso se va para atras
    const reparto = adelante > 0 && atras > 0 ? 1 : adelante > 0 ? Math.max(0.1, pesoAdelante - sube) / (1 + mu[i] * alto / largo) : (1 - pesoAdelante + sube) / (1 - mu[i] * alto / largo);
    const motor = Math.min(C.empuje * g, C.potencia / (C.masa * vel), queda * reparto);
    const a = motor - frena(i, vel);
    v[i + 1] = Math.min(tope[i + 1], Math.sqrt(Math.max(1, v[i] * v[i] + 2 * a * DS[i])));
  }
  for (let i = i0; i > 0; i--) v[i - 1] = v[i];
  for (let i = n - 2; i >= i0; i--) {
    const vel = Math.max(v[i + 1], 0.5), m = usa * mu[i] * g, deCostado = Math.min(m, vel * vel * Math.abs(curva[i]));
    const a = Math.min(C.frenos * g, Math.sqrt(m * m - deCostado * deCostado)) + frena(i, vel);
    v[i] = Math.min(v[i], Math.sqrt(v[i + 1] * v[i + 1] + 2 * Math.max(0.5, a) * DS[i]));
  }

  // --- 4. el tiempo: a que segundo pasa por cada metro, y cuanto tarda en cada sector ---
  const t = new Float32Array(n);
  for (let i = i0; i < n - 1; i++) t[i + 1] = t[i] + DS[i] / Math.max(0.5, (v[i] + v[i + 1]) / 2);
  return {
    auto: C, corre, velocidad: v, curva, tiempo: t,
    desde: lo, hasta: hi,   // entre que corrimientos se puede pasar en cada metro (por los bordes y por lo que haya en el camino)
    estorbo,                // 1 en los metros donde hay algo metido en el camino
    total: t[T.meta.i],
    sectores: T.sectores.map((x) => t[x.hasta] - t[x.desde]),
  };
}

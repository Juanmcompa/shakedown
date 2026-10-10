// Fantasmas: graba una pasada, la convierte en un texto que entra en un link, y la vuelve a pasar.
// La grabacion es fiel: guarda donde estaba el auto dos veces por segundo, con las salidas de pista,
// los trompos y los saltos tal cual pasaron. Por eso el link es largo.
// No dibuja nada.

const PASO = 0.5;          // segundos entre muestras
const ESCALA = 10;         // las posiciones se guardan cada 10 cm
const ALTO = 20;           // la altura sobre el piso, cada 5 cm
export const AUTOS_DEL_LINK = ['vitarita', 'kacito'];   // el orden no se puede cambiar: los links guardan el numero
const COLORES = 'varn';

// --- texto <-> bytes (base64 que se puede poner en un link) ---
function aTexto(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function aBytes(texto) {
  const s = atob(texto.replace(/-/g, '+').replace(/_/g, '/'));
  const b = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
  return b;
}
async function pasar(bytes, Filtro) {   // comprime o descomprime con lo que trae el navegador
  const flujo = new Blob([bytes]).stream().pipeThrough(new Filtro('deflate-raw'));
  return new Uint8Array(await new Response(flujo).arrayBuffer());
}
const limpio = (txt) => String(txt || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 14);

// Un resultado es: { pista, nombre, t (segundos), s: [segundos de cada sector], c: 'vvarv', auto, ab: '' o por que abandono,
//                    vueltas, roto, practica }
function escribirResultado(b, m, enc) {
  const u16 = (v) => { v = Math.max(0, Math.min(65535, Math.round(v))); b.push(v & 255, v >> 8); };
  const n = enc.encode(limpio(m.nombre)).slice(0, 24);
  b.push(n.length, ...n);
  b.push((m.practica ? 1 : 0) | (m.ab ? 2 : 0) | (Math.max(0, AUTOS_DEL_LINK.indexOf(m.auto)) << 2) | (m.ab === 'tiempo' ? 16 : m.ab === 'cerrado' ? 32 : 0));
  const cs = Math.round(m.t * 100);
  b.push(cs & 255, (cs >> 8) & 255, (cs >> 16) & 255);
  let colores = 0;
  for (let k = 0; k < 5; k++) { u16((m.s && m.s[k] || 0) * 100); colores |= Math.max(0, COLORES.indexOf((m.c || 'nnnnn')[k] || 'n')) << (k * 2); }
  u16(colores);
  b.push(Math.min(255, m.vueltas || 0), Math.min(255, Math.round(m.roto || 0)));
}
function leerResultado(b, i, dec, pista) {
  const u16 = () => { const v = b[i] | (b[i + 1] << 8); i += 2; return v; };
  const largo = Math.min(24, b[i++]), nombre = limpio(dec.decode(b.slice(i, i + largo))) || 'Sin nombre';
  i += largo;
  const marcas = b[i++], m = { pista, nombre, practica: !!(marcas & 1), ab: marcas & 2 ? (marcas & 16 ? 'tiempo' : marcas & 32 ? 'cerrado' : 'roto') : '', auto: AUTOS_DEL_LINK[(marcas >> 2) & 3] || AUTOS_DEL_LINK[0] };
  m.t = (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16)) / 100; i += 3;
  m.s = [];
  for (let k = 0; k < 5; k++) m.s.push(u16() / 100);
  const colores = u16();
  m.c = [0, 1, 2, 3, 4].map((k) => COLORES[(colores >> (k * 2)) & 3]).join('');
  m.vueltas = b[i++]; m.roto = b[i++];
  return [m, i];
}

// --- grabacion de una pasada ---
export function crearGrabacion(T) {
  const xs = [], zs = [], hs = [], ys = [];
  return {
    // se llama en cada cuadro; guarda una muestra cada medio segundo.
    // (cuando el reloj salta por una penalizacion, se repite la muestra: el fantasma se queda esperando esos segundos)
    muestra: (tiempo, c) => {
      while (tiempo >= xs.length * PASO && xs.length < 1900) {
        xs.push(Math.round(c.pos[0] * ESCALA)); zs.push(Math.round(c.pos[2] * ESCALA));
        hs.push(Math.round(Math.atan2(c.adelante[0], -c.adelante[2]) / (2 * Math.PI) * 256) & 255);
        ys.push(Math.max(0, Math.min(255, Math.round((c.pos[1] - T.altura(c.pos[0], c.pos[2])) * ALTO))));
      }
    },
    // arma el codigo: el resultado, la pasada entera y los otros resultados que se conocen de esa pista
    codigo: async (m, tabla) => {
      const b = [2, m.pista & 255, m.pista >> 8], enc = new TextEncoder();
      escribirResultado(b, m, enc);
      const otros = tabla.slice(0, 10);
      b.push(otros.length);
      for (const o of otros) escribirResultado(b, o, enc);
      b.push(xs.length & 255, xs.length >> 8);
      const u32 = (v) => { b.push(v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >> 24) & 255); };
      let px = 0, pz = 0;
      for (let i = 0; i < xs.length; i++) {
        const dx = xs[i] - px, dz = zs[i] - pz;
        if (i === 0 || Math.abs(dx) > 127 || Math.abs(dz) > 127) { b.push(128); u32(xs[i]); u32(zs[i]); }   // salto: posicion entera
        else b.push(dx & 255, dz & 255);
        b.push(hs[i], ys[i]);
        px = xs[i]; pz = zs[i];
      }
      const bytes = new Uint8Array(b);
      try { return 'c' + aTexto(await pasar(bytes, CompressionStream)); } catch (e) { return 'p' + aTexto(bytes); }
    },
  };
}

// --- lectura de un codigo: devuelve el resultado, los otros que traia y la pasada ---
export async function leerCodigo(codigo) {
  try {
    let b = aBytes(codigo.slice(1));
    if (codigo[0] === 'c') b = await pasar(b, DecompressionStream);
    const dec = new TextDecoder();
    if (b[0] !== 2) return null;
    const pista = b[1] | (b[2] << 8);
    let i = 3, marca;
    [marca, i] = leerResultado(b, i, dec, pista);
    const tabla = [], cuantos = Math.min(10, b[i++]);
    for (let k = 0; k < cuantos; k++) { let o; [o, i] = leerResultado(b, i, dec, pista); tabla.push(o); }
    const n = Math.min(2000, b[i] | (b[i + 1] << 8));
    i += 2;
    const xs = new Float32Array(n), zs = new Float32Array(n), hs = new Float32Array(n), ys = new Float32Array(n);
    const u32 = () => { const v = b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24); i += 4; return v; };
    let px = 0, pz = 0;
    for (let k = 0; k < n; k++) {
      if (b[i] === 128) { i++; px = u32(); pz = u32(); }
      else { px += (b[i] << 24) >> 24; pz += (b[i + 1] << 24) >> 24; i += 2; }
      xs[k] = px / ESCALA; zs[k] = pz / ESCALA; hs[k] = b[i++] / 256 * 2 * Math.PI; ys[k] = b[i++] / ALTO;
    }
    if (!(pista > 0) || !(marca.t >= 0 && marca.t < 3600) || i > b.length) return null;
    return { marca, tabla, vuelta: n > 1 ? { n, xs, zs, hs, ys } : null };
  } catch (e) { return null; }
}

// --- reproduccion: donde estaba el fantasma en cada momento ---
export function crearFantasma(vuelta, T) {
  const { n, xs, zs, hs, ys } = vuelta, P = T.camino;
  // a que segundo paso por cada metro del camino (para decir cuanto se le lleva o se le pierde)
  const paso = new Float32Array(P.n).fill(-1);
  let ind = T.largada.i;
  for (let k = 0; k < n; k++) {
    ind = T.indice(xs[k], zs[k], ind);
    if (Math.hypot(xs[k] - P.X[ind], zs[k] - P.Z[ind]) < P.W[ind] / 2 + 6 && paso[ind] < 0) paso[ind] = k * PASO;
  }
  // los metros sin dato se completan entre el anterior y el siguiente que si lo tienen
  let a = -1;
  for (let i = 0; i <= P.n; i++) {
    if (i < P.n && paso[i] < 0) continue;
    const ta = a < 0 ? 0 : paso[a], tb = i < P.n ? paso[i] : ta;
    for (let j = a + 1; j < i; j++) paso[j] = ta + (tb - ta) * (j - a) / (i - a);
    a = i;
  }
  return {
    // llena "o" con la posicion, el rumbo y la altura sobre el piso en el segundo t
    pose: (t, o) => {
      const f = Math.min(n - 1.001, Math.max(0, t / PASO)), k = Math.floor(f), u = f - k;
      const a = Math.max(0, k - 1), c = Math.min(n - 1, k + 1), d = Math.min(n - 1, k + 2);
      // curva suave entre muestras, salvo que haya un salto (una vuelta al camino)
      const salto = Math.hypot(xs[c] - xs[k], zs[c] - zs[k]) > 20;
      const cr = (p0, p1, p2, p3) => (salto ? (u < 0.5 ? p1 : p2) : 0.5 * (2 * p1 + (p2 - p0) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (3 * p1 - p0 - 3 * p2 + p3) * u * u * u));
      o.x = cr(xs[a], xs[k], xs[c], xs[d]); o.z = cr(zs[a], zs[k], zs[c], zs[d]);
      let g = hs[c] - hs[k];
      g = Math.atan2(Math.sin(g), Math.cos(g));
      o.rumbo = hs[k] + g * u;
      o.alto = ys[k] + (ys[c] - ys[k]) * u;
      o.termino = t > (n - 1) * PASO;
      return o;
    },
    // diferencia en segundos al pasar por el metro i: negativo = vas adelante del fantasma
    ventaja: (tiempo, i) => tiempo - paso[Math.max(0, Math.min(P.n - 1, i))],
    dura: (n - 1) * PASO,
  };
}

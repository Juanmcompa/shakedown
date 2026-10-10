// Fantasmas y marcas: graba una vuelta, la convierte en un texto corto que entra en un link,
// y guarda las marcas propias y las que llegan por link para armar el ranking.
// No dibuja nada.

const PASO = 0.5;          // segundos entre muestras de la vuelta
const ESCALA = 10;         // las posiciones se guardan cada 10 cm
const CLAVE = 'encajados.marcas';

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

// --- grabacion de una vuelta ---
export function crearGrabacion() {
  const xs = [], zs = [], hs = [];
  return {
    // se llama en cada cuadro; guarda una muestra cada medio segundo
    muestra: (tiempo, c) => {
      if (tiempo < xs.length * PASO || xs.length > 1500) return;
      xs.push(Math.round(c.pos[0] * ESCALA)); zs.push(Math.round(c.pos[2] * ESCALA));
      hs.push(Math.round(Math.atan2(c.adelante[0], -c.adelante[2]) / (2 * Math.PI) * 256) & 255);
    },
    // arma el codigo de la marca: nombre, tiempo, la vuelta y la tabla de tiempos que se conoce
    codigo: async (m, tabla) => {
      const b = [], enc = new TextEncoder();
      const u32 = (v) => { b.push(v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >> 24) & 255); };
      const nombre = (txt) => { const n = enc.encode(txt).slice(0, 24); b.push(n.length, ...n); };
      b.push(1, m.etapa & 255); u32(Math.round(m.tiempo * 100)); b.push(Math.round(m.nafta) & 255, m.rescates & 255);
      nombre(m.nombre);
      const otros = tabla.slice(0, 12);
      b.push(otros.length);
      for (const o of otros) { nombre(o.nombre); u32(Math.round(o.tiempo * 100)); }
      b.push(xs.length & 255, xs.length >> 8);
      let px = 0, pz = 0;
      for (let i = 0; i < xs.length; i++) {
        const dx = xs[i] - px, dz = zs[i] - pz;
        if (i === 0 || Math.abs(dx) > 127 || Math.abs(dz) > 127) { b.push(128); u32(xs[i]); u32(zs[i]); }   // salto: posicion entera
        else b.push(dx & 255, dz & 255);
        b.push(hs[i]);
        px = xs[i]; pz = zs[i];
      }
      const bytes = new Uint8Array(b);
      try { return 'c' + aTexto(await pasar(bytes, CompressionStream)); } catch (e) { return 'p' + aTexto(bytes); }
    },
  };
}

// --- lectura de un codigo: devuelve la marca, la tabla que traia y la vuelta ---
export async function leerCodigo(codigo) {
  try {
    let b = aBytes(codigo.slice(1));
    if (codigo[0] === 'c') b = await pasar(b, DecompressionStream);
    const dec = new TextDecoder();
    let i = 0;
    const u32 = () => { const v = b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24); i += 4; return v; };
    const nombre = () => { const n = Math.min(24, b[i++]); const t = dec.decode(b.slice(i, i + n)); i += n; return t.replace(/[\u0000-\u001f<>]/g, '').trim() || 'Sin nombre'; };
    if (b[i++] !== 1) return null;
    const m = { etapa: b[i++], tiempo: u32() / 100 };
    m.nafta = b[i++]; m.rescates = b[i++]; m.nombre = nombre();
    const tabla = [], cuantos = Math.min(12, b[i++]);
    for (let k = 0; k < cuantos; k++) tabla.push({ nombre: nombre(), tiempo: u32() / 100, etapa: m.etapa });
    const n = Math.min(1600, b[i] | (b[i + 1] << 8));
    i += 2;
    const xs = new Float32Array(n), zs = new Float32Array(n), hs = new Float32Array(n);
    let px = 0, pz = 0;
    for (let k = 0; k < n; k++) {
      if (b[i] === 128) { i++; px = u32(); pz = u32(); }
      else { px += (b[i] << 24) >> 24; pz += (b[i + 1] << 24) >> 24; i += 2; }
      xs[k] = px / ESCALA; zs[k] = pz / ESCALA; hs[k] = b[i++] / 256 * 2 * Math.PI;
    }
    if (!(m.tiempo > 5 && m.tiempo < 3600) || i > b.length || n < 2) return null;
    return { marca: m, tabla, vuelta: { n, xs, zs, hs } };
  } catch (e) { return null; }
}

// --- reproduccion: donde estaba el fantasma en cada momento ---
export function crearFantasma(vuelta, T) {
  const { n, xs, zs, hs } = vuelta, P = T.camino;
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
    // llena "o" con la posicion y el rumbo en el segundo t
    pose: (t, o) => {
      const f = Math.min(n - 1.001, Math.max(0, t / PASO)), k = Math.floor(f), u = f - k;
      const a = Math.max(0, k - 1), c = Math.min(n - 1, k + 1), d = Math.min(n - 1, k + 2);
      // curva suave entre muestras, salvo que haya un salto (un rescate)
      const salto = Math.hypot(xs[c] - xs[k], zs[c] - zs[k]) > 14;
      const cr = (p0, p1, p2, p3) => (salto ? (u < 0.5 ? p1 : p2) : 0.5 * (2 * p1 + (p2 - p0) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (3 * p1 - p0 - 3 * p2 + p3) * u * u * u));
      o.x = cr(xs[a], xs[k], xs[c], xs[d]); o.z = cr(zs[a], zs[k], zs[c], zs[d]);
      let g = hs[c] - hs[k];
      g = Math.atan2(Math.sin(g), Math.cos(g));
      o.rumbo = hs[k] + g * u;
      return o;
    },
    // diferencia en segundos al pasar por el metro i: negativo = vas adelante del fantasma
    ventaja: (tiempo, i) => tiempo - paso[Math.max(0, Math.min(P.n - 1, i))],
    dura: (n - 1) * PASO,
  };
}

// --- marcas guardadas en este aparato ---
export function crearMarcas(etapa) {
  let datos = { nombre: '', marcas: [] };
  try { datos = Object.assign(datos, JSON.parse(localStorage.getItem(CLAVE) || '{}')); } catch (e) { /* sin memoria: se pierde al cerrar */ }
  const guardar = () => { try { localStorage.setItem(CLAVE, JSON.stringify(datos)); } catch (e) { /* idem */ } };
  const lista = () => datos.marcas.filter((m) => m.etapa === etapa).sort((a, b) => a.tiempo - b.tiempo);
  return {
    nombre: () => datos.nombre,
    ponerNombre: (n) => { datos.nombre = n.replace(/[<>]/g, '').trim().slice(0, 14); guardar(); },
    lista,
    // anota una marca. Queda la mejor de cada nombre. Devuelve true si entro.
    anotar: (m) => {
      const vieja = datos.marcas.find((x) => x.etapa === m.etapa && x.nombre === m.nombre);
      if (vieja && vieja.tiempo <= m.tiempo) { if (m.codigo && !vieja.codigo) { vieja.codigo = m.codigo; guardar(); } return false; }
      datos.marcas = datos.marcas.filter((x) => x !== vieja);
      datos.marcas.push({ nombre: m.nombre, tiempo: m.tiempo, etapa: m.etapa, codigo: m.codigo || '', mio: !!m.mio });
      datos.marcas = datos.marcas.sort((a, b) => a.tiempo - b.tiempo).slice(0, 40);
      guardar();
      return true;
    },
  };
}

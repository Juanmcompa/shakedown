// Reparto: la memoria del juego. Cada viaje (entregado o no) se guarda en este aparato y vuelve en todos los viajes que
// siguen, como una version pasada del que juega. Se guarda donde estaba el auto cada 0,2 s (a 10 cm y en 1/10000 de vuelta),
// en numeros chicos pasados a texto: un viaje de 2 minutos ocupa unos 5 KB.
const CLAVE = 'reparto2';   // (cambia cuando cambia el pueblo: los viajes de un pueblo no sirven en otro)
export const MUESTRA = 0.2;          // segundos entre muestras
const TOPE = Math.ceil(125 / MUESTRA);

// --- bytes <-> texto ---
function aTexto(i16) {
  const b = new Uint8Array(i16.buffer, i16.byteOffset, i16.byteLength);
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
  return btoa(s);
}
function deTexto(t) {
  const s = atob(t), b = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
  return new Int16Array(b.buffer);
}
const VUELTA = 10000 / (2 * Math.PI);

// --- grabar un viaje ---
export function crearGrabacion() {
  const xs = [], zs = [], rs = [];
  let proxima = 0;
  return {
    // t: segundos desde que arranco el viaje; c: el auto
    muestra(t, c) {
      if (t < proxima || xs.length >= TOPE) return;
      proxima += MUESTRA;
      xs.push(c.pos[0]); zs.push(c.pos[2]); rs.push(Math.atan2(c.adelante[0], -c.adelante[2]));
    },
    // el viaje terminado, como se guarda (y como lo usa fantasmas.js)
    cerrar(k, entrego, tipo = 'furgon') {
      return { k, entrego, tipo, xs: Float32Array.from(xs), zs: Float32Array.from(zs), rs: Float32Array.from(rs) };
    },
    cuantas: () => xs.length,
  };
}

function empaquetar(v) {
  const n = v.xs.length, d = new Int16Array(n * 3);
  for (let i = 0; i < n; i++) {
    d[i * 3] = Math.round(v.xs[i] * 10); d[i * 3 + 1] = Math.round(v.zs[i] * 10);
    let a = v.rs[i] % (2 * Math.PI); if (a > Math.PI) a -= 2 * Math.PI; if (a < -Math.PI) a += 2 * Math.PI;
    d[i * 3 + 2] = Math.round(a * VUELTA);
  }
  return { k: v.k, e: v.entrego ? 1 : 0, t: v.tipo, d: aTexto(d) };
}
function desempaquetar(p) {
  const d = deTexto(p.d), n = d.length / 3, v = { k: p.k, entrego: !!p.e, tipo: p.t || 'furgon', xs: new Float32Array(n), zs: new Float32Array(n), rs: new Float32Array(n) };
  for (let i = 0; i < n; i++) { v.xs[i] = d[i * 3] / 10; v.zs[i] = d[i * 3 + 1] / 10; v.rs[i] = d[i * 3 + 2] / VUELTA; }
  return v;
}

// --- lo guardado: los viajes, en que viaje se va (cuantas entregas) y el record ---
export function crearMemoria() {
  let datos = { viajes: [], entregas: 0, record: 0, intentos: 0, visto: 0 };
  try {
    const x = JSON.parse(localStorage.getItem(CLAVE) || 'null');
    if (x && Array.isArray(x.viajes)) datos = Object.assign(datos, x);
  } catch (e) { /* sin memoria: se juega igual, pero se pierde al cerrar */ }
  let viajes = [];
  try { viajes = datos.viajes.map(desempaquetar); } catch (e) { viajes = []; datos.viajes = []; }
  let lleno = false;
  const guardar = () => {
    try { localStorage.setItem(CLAVE, JSON.stringify(datos)); lleno = false; }
    catch (e) { lleno = true; }   // (la memoria del navegador se lleno: el viaje queda hasta cerrar la pagina)
  };
  return {
    viajes: () => viajes,
    entregas: () => datos.entregas,
    record: () => datos.record,
    intentos: () => datos.intentos,
    lleno: () => lleno,
    // la explicacion de la primera vez que te cruzas con tu version pasada: si ya se vio
    visto: (si) => { if (si) { datos.visto = 1; guardar(); } return !!datos.visto; },
    // un viaje termino: se guarda siempre (tambien si no se llego: queda en el pueblo igual)
    sumar(v) {
      viajes.push(v);
      datos.viajes.push(empaquetar(v));
      datos.intentos++;
      if (v.entrego) { datos.entregas++; datos.record = Math.max(datos.record, datos.entregas); }
      guardar();
    },
    // pueblo nuevo: se borran los viajes (el record queda)
    borrar() {
      viajes = [];
      datos = { viajes: [], entregas: 0, record: datos.record, intentos: 0, visto: datos.visto };
      guardar();
    },
  };
}

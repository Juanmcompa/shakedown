// Fantasmas: graba una pasada, la convierte en un texto que entra en un link, y la vuelve a pasar.
// La grabacion es fiel: guarda donde estaba el auto dos veces por segundo, con las salidas de pista,
// los trompos y los saltos tal cual pasaron.
//
// Para que el link no sea eterno, la pasada no se guarda como lugares del mapa sino RESPECTO DEL CAMINO
// (que los dos aparatos conocen, porque sale de la fecha): en cada muestra, cuanto avanzo, cuanto esta corrido
// del medio y cuanto apunta distinto de hacia donde va. Esos numeros son chicos y se parecen de una muestra a la otra,
// asi que se guarda solo lo que cambia respecto de lo esperado, con un compresor que sabe que cambios son los comunes.
// Es la misma informacion, con la misma precision que antes (10 cm y 1,4 grados), en mas o menos la mitad de lugar.
// No dibuja nada.
import { versionDe } from './generador.js';

const PASO = 0.5;          // segundos entre muestras
const ESCALA = 10;         // las posiciones se guardan cada 10 cm
const ALTO = 20;           // la altura sobre el piso, cada 5 cm
const VUELTA = 256;        // el rumbo: 256 pasos por vuelta entera
export const AUTOS_DEL_LINK = ['vitarita', 'kacito'];   // el orden no se puede cambiar: los links guardan el numero (hasta 8)
const COLORES = 'varn', ABANDONOS = ['', 'roto', 'tiempo', 'cerrado'];

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
async function pasar(bytes, Filtro) {   // descomprime con lo que trae el navegador (lo usaba el formato anterior)
  const flujo = new Blob([bytes]).stream().pipeThrough(new Filtro('deflate-raw'));
  return new Uint8Array(await new Response(flujo).arrayBuffer());
}
// Un texto que escribe la gente (un nombre, el nombre de un club), limpio: sin letras de control ni las marcas invisibles
// que dan vuelta lo que tiene al lado (con una de esas, un nombre podria hacer que un tiempo se lea al reves), sin < >,
// con los espacios de a uno, y con algo que se vea. Lo usan el juego y el servidor.
const RARAS = /[\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u2028-\u202e\u2066-\u2069\ufeff<>]/g;
export function limpiarTexto(txt, largo) {
  const s = String(txt || '').replace(RARAS, '').replace(/\s+/g, ' ').trim().slice(0, largo).trim();
  return /[^\s\u200b-\u200d\u2060\ufe00-\ufe0f]/.test(s) ? s : '';
}
export const limpio = (txt) => limpiarTexto(txt, 14);

// Un resultado es: { pista, nombre, t (segundos), s: [segundos de cada sector], c: 'vvarv', auto, ab: '' o por que abandono,
//                    vueltas, roto, practica, ayuda (corrio con la ayuda de manejo) }

// --- el compresor: escribe bits sueltos, cada uno con la probabilidad que le calcula un "modelo" que va aprendiendo ---
// (Es el metodo de los compresores de archivos, en chico. Todo con numeros enteros: da lo mismo en cualquier aparato.)
// El que escribe y el que lee tienen las mismas dos funciones, asi el mismo codigo sirve para armar un link y para leerlo:
//   bit(m, k, b)    un bit con modelo (m: la lista de probabilidades; k: cual se usa). Devuelve el bit.
//   crudo(v, n)     n bits tal cual (para lo que no tiene sentido adivinar, como las letras de un nombre). Devuelve el valor.
// (Al leer, "b" y "v" no se miran: se devuelve lo leido.)
function crearEscritor(espia) {
  let bajo = 0, rango = 0xFFFFFFFF, guardado = 0, pendientes = 1;
  const salida = [];
  function correr() {
    if (bajo < 0xFF000000 || bajo > 0xFFFFFFFF) {
      const lleva = bajo > 0xFFFFFFFF ? 1 : 0;
      let t = guardado;
      do { salida.push((t + lleva) & 255); t = 255; } while (--pendientes);
      guardado = Math.floor(bajo / 16777216) & 255;
    }
    pendientes++;
    bajo = (bajo % 16777216) * 256;
  }
  return {
    bit: (m, k, b) => {
      if (espia) espia(k, b);
      const corte = (rango >>> 11) * m[k];
      if (b) { bajo += corte; rango -= corte; m[k] -= m[k] >> 5; } else { rango = corte; m[k] += (2048 - m[k]) >> 5; }
      while (rango < 16777216) { rango = (rango * 256) >>> 0; correr(); }
      return b;
    },
    crudo: (v, n) => {
      for (let k = n - 1; k >= 0; k--) {
        rango >>>= 1;
        if (Math.floor(v / 2 ** k) & 1) bajo += rango;
        while (rango < 16777216) { rango = (rango * 256) >>> 0; correr(); }
      }
      return v;
    },
    fin: () => { for (let k = 0; k < 5; k++) correr(); return new Uint8Array(salida.slice(1)); },   // (el primer byte es siempre 0)
  };
}
function crearLector(b) {
  let i = 0, rango = 0xFFFFFFFF, codigo = 0;
  const sig = () => (i < b.length ? b[i++] : (i++, 0));
  for (let k = 0; k < 4; k++) codigo = (codigo * 256 + sig()) >>> 0;
  return {
    bit: (m, k) => {
      const corte = (rango >>> 11) * m[k];
      let r = 0;
      if (codigo < corte) { rango = corte; m[k] += (2048 - m[k]) >> 5; } else { codigo -= corte; rango -= corte; m[k] -= m[k] >> 5; r = 1; }
      while (rango < 16777216) { rango = (rango * 256) >>> 0; codigo = (codigo * 256 + sig()) >>> 0; }
      return r;
    },
    crudo: (v, n) => {
      v = 0;
      for (; n > 0; n--) {
        rango >>>= 1;
        let bit = 0;
        if (codigo >= rango) { codigo -= rango; bit = 1; }
        v = v * 2 + bit;
        while (rango < 16777216) { rango = (rango * 256) >>> 0; codigo = (codigo * 256 + sig()) >>> 0; }
      }
      return v;
    },
    // true si ya se pidio mas de lo que habia: el codigo esta cortado o roto
    seAcabo: () => i > b.length + 4,
  };
}

// --- los modelos: las probabilidades de cada decision ---
// Un numero entero se escribe asi: si es cero; el signo; cuantas cifras binarias tiene; y las cifras.
// Cada dato de la pasada tiene varios juegos de probabilidades ("contextos"), y se usa uno u otro segun
// que tan grande fue el cambio anterior: despues de un cambio grande suele venir otro grande.
// Un juego ocupa TAM lugares: [es cero] [signo] [12 de "tiene mas cifras"] [11 para las cifras de los numeros de hasta 15]
const TAM = 25, AV = 0, CO = 5, RU = 10, AL = 15, JUEGOS = 18;
// Las probabilidades con las que se arranca, aprendidas de un monton de pasadas de prueba (una letra por probabilidad,
// de 1 a v: treintaidosavos). NO SE PUEDEN CAMBIAR: los links ya compartidos se leen con estas.
const PREVIAS = '6m9fni52vgggggilgkoopjfig3m7hprrgggggggimijqjjkkec4k7fottgggggggiljipmhiiog3i6dnttggggggggkjjolkiifj2g39glahuggggghjghnilghjibfegmtmgggggggkjkglmkkkil5gbgntqgggggggmjgjqjkhhjf3g7gmuugggggggiljhomijhii2h5blusggggggggkhinjlkjil1h36eqtghgggggghgimjjhlikgihgkssgggggggmjgepodkljk8kdflsugggggggllhhnlikjlh4i8dlrugggggggjjhinlkjkge2h5ajsuggggggghihinjkhihi2h47eosirggggghhhgmiihgigngutkgggggggggrmkggggggggbfdqjfggggggggpssgggggggg7a3569aeogggggggggggggggg';
function crearModelos() {
  const m = new Uint16Array(JUEGOS * TAM).fill(1024);
  for (let i = 0; i < PREVIAS.length && i < m.length; i++) m[i] = Math.max(1, parseInt(PREVIAS[i], 32) || 16) * 64;
  return m;
}
// escribe o lee un entero con signo, con el juego de probabilidades que empieza en "base". Devuelve el valor.
function entero(io, m, base, v) {
  if (!io.bit(m, base, v === 0 ? 0 : 1)) return 0;
  const negativo = io.bit(m, base + 1, v < 0 ? 1 : 0), a = Math.min(65535, Math.abs(v));
  let cifras = 0;
  while (a >> (cifras + 1)) cifras++;                       // (al leer "a" no vale nada, y el largo sale del link)
  let n = 0;
  while (n < 15 && io.bit(m, base + 2 + Math.min(n, 11), n < cifras ? 1 : 0)) n++;
  let r = 1;                                                // el numero se arma de la cifra mas alta (que siempre es 1) a la mas baja
  for (let k = n - 1; k >= 0; k--) {
    const b = (a >> k) & 1;
    r = r * 2 + (n <= 3 ? io.bit(m, base + 14 + [0, 1, 4][n - 1] + r - 1, b) : io.crudo(b, 1));
  }
  return negativo ? -r : r;
}
// que tan grande es un cambio, de 0 a 4 (o de 0 a 2, para la altura)
const tamano = (v) => { const a = Math.abs(v); return a === 0 ? 0 : a <= 1 ? 1 : a <= 3 ? 2 : a <= 7 ? 3 : 4; };
const tamano3 = (v) => { const a = Math.abs(v); return a <= 1 ? 0 : a <= 4 ? 1 : 2; };
const envolver = (v) => ((v + VUELTA / 2) & (VUELTA - 1)) - VUELTA / 2;   // un rumbo, entre -128 y 127

// --- un resultado ---
// completo: con los tiempos de cada sector (el propio); si no, lo justo para la tabla.
function pasarResultado(io, m, enc, dec, pista, completo) {
  const letras = enc ? enc.encode(limpio(m.nombre)).slice(0, 24) : null, largo = Math.min(24, io.crudo(letras ? letras.length : 0, 5)), leidas = new Uint8Array(largo);
  for (let k = 0; k < largo; k++) leidas[k] = io.crudo(letras ? letras[k] : 0, 8);
  const o = { pista, nombre: limpio(dec.decode(leidas)) || 'Sin nombre' };
  o.practica = !!io.crudo(m.practica ? 1 : 0, 1);
  o.ab = ABANDONOS[io.crudo(Math.max(0, ABANDONOS.indexOf(m.ab || '')), 2)];
  o.auto = AUTOS_DEL_LINK[io.crudo(Math.max(0, AUTOS_DEL_LINK.indexOf(m.auto)), 3)] || AUTOS_DEL_LINK[0];
  o.ayuda = !!(io.crudo(m.ayuda ? 1 : 0, 4) & 1);   // (cuatro marcas: la primera es la ayuda de manejo; las otras tres quedan libres)
  o.t = io.crudo(Math.max(0, Math.min(524287, Math.round((m.t || 0) * 100))), 19) / 100;
  o.c = '';
  for (let k = 0; k < 5; k++) o.c += COLORES[io.crudo(Math.max(0, COLORES.indexOf((m.c || 'nnnnn')[k] || 'n')), 2)];
  o.s = []; o.vueltas = 0; o.roto = 0;
  if (!completo) return o;
  for (let k = 0; k < 5; k++) o.s.push(io.crudo(Math.max(0, Math.min(32767, Math.round((m.s && m.s[k] || 0) * 100))), 15) / 100);
  o.vueltas = io.crudo(Math.min(15, m.vueltas || 0), 4); o.roto = io.crudo(Math.min(127, Math.round(m.roto || 0)), 7);
  return o;
}
// (asi se leia un resultado en el formato anterior)
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

// --- la pasada, respecto del camino ---
// Cada muestra son cuatro enteros:
//   av: cuanto avanzo por el camino, en decimas de metro        co: cuanto esta corrido hacia la derecha, en decimas de metro
//   ru: hacia donde apunta respecto del camino (256 = una vuelta entera)      al: altura sobre el piso
// El eje del camino en un avance dado: el punto del medio y hacia donde va (entre un metro y el siguiente, se reparte).
function ejeEn(P, av, o) {
  const s = av / ESCALA, i = Math.max(0, Math.min(P.n - 2, Math.floor(s))), f = s - i;
  const hx = P.HX[i] + (P.HX[i + 1] - P.HX[i]) * f, hz = P.HZ[i] + (P.HZ[i + 1] - P.HZ[i]) * f, l = Math.sqrt(hx * hx + hz * hz) || 1;
  o.x = P.X[i] + (P.X[i + 1] - P.X[i]) * f; o.z = P.Z[i] + (P.Z[i + 1] - P.Z[i]) * f; o.hx = hx / l; o.hz = hz / l;
  return o;
}
// De los lugares del mapa a los cuatro enteros de cada muestra. (Se exporta para las herramientas de prueba.)
export function enCamino(P, xs, zs, hs, ys, desde = 0) {
  const n = xs.length, S = { av: new Int32Array(n), co: new Int32Array(n), ru: new Int32Array(n), al: new Int32Array(n) }, o = {};
  let cerca = desde;
  for (let k = 0; k < n; k++) {
    const x = xs[k], z = zs[k];
    // el metro del camino mas cercano, buscando alrededor del anterior (y en todo el camino si quedo lejisimo)
    let i = cerca, md = 1e9;
    for (let j = Math.max(0, cerca - 40); j < Math.min(P.n, cerca + 80); j++) { const dx = x - P.X[j], dz = z - P.Z[j], d = dx * dx + dz * dz; if (d < md) { md = d; i = j; } }
    if (md > 1600) for (let j = 0; j < P.n; j++) { const dx = x - P.X[j], dz = z - P.Z[j], d = dx * dx + dz * dz; if (d < md) { md = d; i = j; } }
    cerca = i;
    // de los avances posibles alrededor de ese metro (de a 10 cm), el que deja el auto mas cerca de donde estaba de verdad
    let mejor = 1e9;
    for (let a = (i - 2) * ESCALA; a <= (i + 2) * ESCALA; a++) {
      ejeEn(P, a, o);
      const dx = x - o.x, dz = z - o.z, largo = dx * o.hx + dz * o.hz, lado = dz * o.hx - dx * o.hz, c = Math.round(lado * ESCALA), falla = largo * largo + (lado - c / ESCALA) ** 2;
      if (falla < mejor) { mejor = falla; S.av[k] = a; S.co[k] = c; S.ru[k] = envolver(Math.round((hs[k] - Math.atan2(o.hx, -o.hz)) / (2 * Math.PI) * VUELTA)); }
    }
    S.al[k] = ys[k];
  }
  return S;
}
// Escribe o lee las n muestras (S: los cuatro enteros de cada una). De cada dato va solo la diferencia con lo esperado:
//   el avance, que siga acelerando o frenando parecido;   el corrimiento, que se siga corriendo un poco menos;
//   la altura, que no cambie;   el rumbo, que apunte hacia donde va (y si viene cruzado, que se vaya enderezando).
// El rumbo va al final, porque para saber "hacia donde va" en una muestra hace falta conocer la siguiente.
export function recorrerVuelta(io, m, n, S) {
  const { av, co, ru, al } = S;
  let av1 = 0, vel = 0, acel = 0, co1 = 0, vco = 0, al1 = 12, cAv = 0, cCo = 0, cAl = 0;
  for (let k = 0; k < n; k++) {
    const eAv = av1 + vel + (acel >> 1), eCo = co1 + (vco >> 1);
    const dAv = entero(io, m, (AV + cAv) * TAM, av[k] - eAv), dCo = entero(io, m, (CO + cCo) * TAM, co[k] - eCo), dAl = entero(io, m, (AL + cAl) * TAM, al[k] - al1);
    av[k] = eAv + dAv; co[k] = eCo + dCo; al[k] = al1 + dAl;
    acel = av[k] - av1 - vel; vel = av[k] - av1; vco = co[k] - co1;
    av1 = av[k]; co1 = co[k]; al1 = al[k];
    cAv = tamano(dAv); cCo = tamano(dCo); cAl = tamano3(dAl);
  }
  let cruzado = 0, cRu = 0;   // cruzado: cuanto apunta distinto de hacia donde va
  for (let k = 0; k < n; k++) {
    const a = Math.max(0, k - 1), b = Math.min(n - 1, k + 1), dav = av[b] - av[a], dco = co[b] - co[a];
    const va = dav > 4 && dav < 1200 ? Math.round(Math.atan2(dco, dav) / (2 * Math.PI) * VUELTA) : 0, esperado = (cruzado * 3) >> 2;
    const d = entero(io, m, (RU + cRu) * TAM, envolver(ru[k] - va - esperado));
    cruzado = envolver(esperado + d);
    ru[k] = envolver(cruzado + va);
    cRu = tamano(d);
  }
}

// --- grabacion de una pasada ---
export function crearGrabacion(T) {
  const xs = [], zs = [], hs = [], ys = [];
  return {
    // se llama en cada cuadro; guarda una muestra cada medio segundo.
    // (cuando el reloj salta por una penalizacion, se repite la muestra: el fantasma se queda esperando esos segundos)
    muestra: (tiempo, c) => {
      while (tiempo >= xs.length * PASO && xs.length < 1900) {
        xs.push(c.pos[0]); zs.push(c.pos[2]); hs.push(Math.atan2(c.adelante[0], -c.adelante[2]));
        ys.push(Math.max(0, Math.min(255, Math.round((c.pos[1] - T.altura(c.pos[0], c.pos[2])) * ALTO))));
      }
    },
    // arma el codigo: el resultado, la pasada entera y los otros resultados que se conocen de esa pista
    // (espia: para las herramientas de prueba; recibe cada decision del compresor)
    codigo: async (m, tabla, espia) => {
      const w = crearEscritor(espia), enc = new TextEncoder(), dec = new TextDecoder();
      w.crudo(versionDe(m.pista) & 63, 6); w.crudo(m.pista & 16383, 14);
      pasarResultado(w, m, enc, dec, m.pista, true);
      const otros = tabla.slice(0, 10);
      w.crudo(otros.length, 4);
      for (const x of otros) pasarResultado(w, x, enc, dec, m.pista, false);
      w.crudo(xs.length, 11);
      recorrerVuelta(w, crearModelos(), xs.length, enCamino(T.camino, xs, zs, hs, ys, T.vuelta ? T.vuelta.desde : T.largada.i));
      return 'd' + aTexto(w.fin());
    },
  };
}

// Una pasada sin recorrido: un abandono que no llego a grabarse (se cerro el juego en plena oficial). Es un codigo como
// cualquier otro, con cero muestras: el servidor lo acepta porque es un abandono (no hay tiempo que comparar con lo
// grabado), y en las tablas figura como DNF, sin fantasma.
export function codigoSinVuelta(m) {
  const w = crearEscritor(), enc = new TextEncoder(), dec = new TextDecoder();
  w.crudo(versionDe(m.pista) & 63, 6); w.crudo(m.pista & 16383, 14);
  pasarResultado(w, m, enc, dec, m.pista, true);
  w.crudo(0, 4); w.crudo(0, 11);   // (ningun otro resultado, y ninguna muestra)
  return 'd' + aTexto(w.fin());
}

// --- lectura de un codigo ---
// Devuelve { marca: el resultado, tabla: los otros resultados que traia, version: con que version del generador se corrio,
//            tieneVuelta, muestras: cuantas trae (dos por segundo),
//            vuelta(P): la pasada, ya ubicada sobre el camino P (o null si no la trae o esta rota) }.
// Entiende el formato nuevo (empieza con "d") y el anterior ("c" o "p"), que guardaba los lugares del mapa.
// (Una pasada larguisima no pasa de 9.000 letras: lo que mida mas del tope no es una pasada, y no se intenta leer.)
const LARGO_MAXIMO = 20000;
export async function leerCodigo(codigo) {
  try {
    if (typeof codigo !== 'string' || codigo.length > LARGO_MAXIMO) return null;
    return codigo[0] === 'd' ? leerNuevo(aBytes(codigo.slice(1))) : await leerViejo(codigo);
  } catch (e) { return null; }
}
function leerNuevo(b) {
  const r = crearLector(b), dec = new TextDecoder(), vacio = {};
  const version = r.crudo(0, 6), pista = r.crudo(0, 14);
  const marca = pasarResultado(r, vacio, null, dec, pista, true), tabla = [], cuantos = Math.min(10, r.crudo(0, 4));
  for (let k = 0; k < cuantos; k++) tabla.push(pasarResultado(r, vacio, null, dec, pista, false));
  const n = Math.min(2000, r.crudo(0, 11));
  if (!(pista > 0) || r.seAcabo()) return null;
  let hecha;
  return {
    marca, tabla, version, tieneVuelta: n > 1, muestras: n,
    vuelta: (P) => {
      if (hecha !== undefined || n < 2) return hecha || null;
      hecha = null;
      const S = { av: new Int32Array(n), co: new Int32Array(n), ru: new Int32Array(n), al: new Int32Array(n) }, o = {};
      recorrerVuelta(r, crearModelos(), n, S);
      if (r.seAcabo()) return null;
      const xs = new Float32Array(n), zs = new Float32Array(n), hs = new Float32Array(n), ys = new Float32Array(n);
      for (let k = 0; k < n; k++) {
        ejeEn(P, S.av[k], o);
        const lado = S.co[k] / ESCALA;
        xs[k] = o.x - o.hz * lado; zs[k] = o.z + o.hx * lado;
        hs[k] = Math.atan2(o.hx, -o.hz) + S.ru[k] / VUELTA * 2 * Math.PI; ys[k] = Math.max(0, S.al[k]) / ALTO;
      }
      hecha = { n, xs, zs, hs, ys };
      return hecha;
    },
  };
}
async function leerViejo(codigo) {
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
  const vuelta = n > 1 ? { n, xs, zs, hs, ys } : null;
  return { marca, tabla, version: 1, tieneVuelta: !!vuelta, muestras: n, vuelta: () => vuelta };   // (el formato viejo es de la version 1 de las pistas)
}

// --- reproduccion: donde estaba el fantasma en cada momento ---
export function crearFantasma(vuelta, T) {
  const { n, xs, zs, hs, ys } = vuelta, P = T.camino;
  // a que segundo paso por cada metro del camino (para decir cuanto se le lleva o se le pierde)
  const paso = new Float32Array(P.n).fill(-1);
  let ind = T.vuelta ? T.vuelta.desde : T.largada.i;   // (en una vuelta cerrada, la pasada grabada arranca en la raya)
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

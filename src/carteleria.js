// La publicidad del rally: reparte las marcas de parodias.js por los soportes de la pista y los dibuja.
// (Este archivo se llamaba publicidad.js. Con ese nombre lo frenaban los bloqueadores de publicidad, que cortan toda
// direccion que diga "/publicidad.", y sin el el juego no cargaba. Por eso ni este ni ningun otro archivo del juego
// puede llevar en el nombre una palabra de anuncios: publicidad, sponsor, banner, ads, anuncio...)
//   velas       banderas altas y angostas a los dos lados del camino, en la largada y en la llegada
//   chapas      carteles bajos apoyados contra la cinta del publico
//   cartelones  un cartel grande al costado: del lado de afuera de las curvas o en las rectas, mirando al que viene
//   porticos    en las calles del pueblo, el mismo cartel grande colgado de lado a lado
//   tiras       una fila de chapas arriba de cada arco (largada, sectores y meta)
// Todo esto es solo dibujo: no se choca, no cambia el terreno y se sortea con su propio azar (no toca el de la pista).
// Por eso sumar, sacar o cambiar sponsors no cambia las pistas ni los tiempos.
// (Si el auto se lleva puesta una chapa o un cartelon, queda tirado: tambien eso es solo dibujo, al auto no le hace nada.)
import * as THREE from '../vendor/three.module.js';
import { azar } from './noise.js';
import { crearAtlas, crearLote, deLaPaleta, tono } from './pixel.js';
import { estilo } from './material.js';
import { escribir } from './arte.js';
import { crearLoteDeSprites } from './sprites.js';
import { SPONSORS, pintarSponsor, repartirSponsors } from './parodias.js';

// --- medidas, en pixeles de 12,5 cm ---
const CARTEL = [52, 16], CHAPA = [21, 7], VELA = [7, 25];   // lo que mide el dibujo de cada soporte
const MASTIL = 6;                                           // lo que asoma el palo de una bandera por debajo de la tela
const PIE = 7;                                              // a que altura arranca la tabla de un cartelon
const VIVO = 0.4;                                           // cuanto se apagan los colores de las marcas (el paisaje va en 1; menos = mas vivos)
// --- donde van, en metros ---
const PASO_CHAPA = (CHAPA[0] + 1) / 8;                      // de chapa a chapa
const ECHADA = { chapa: 0.42, cartel: 0.45 };               // cuanto se echan hacia atras (radianes), para que se lean desde arriba
const MAX_CARTELONES = 8;
const PORTICO = { alto: 35, palo: 54 };                     // (en pixeles) a que altura cuelga el cartel de un portico y cuanto miden sus palos

// Decide donde va cada cosa. Devuelve listas de lugares; no dibuja nada (asi se puede probar sin pantalla).
//   arcos: los arcos de la pista, como los deja utileria.js: [{ p: donde esta, alto, medio }]
// Cada lugar trae "s": el sponsor que le toco.
export function lugaresDePublicidad(T, arcos = [], sponsors = SPONSORS) {
  const vacio = { velas: [], chapas: [], cartelones: [], porticos: [], tiras: [] };
  if (!sponsors.length) return vacio;
  const P = T.camino, L = T.vuelta ? T.vuelta.largo : 0, n = L || P.n;   // n: los metros de una vuelta (o de toda la pista)
  const r = azar((((T.etapa.semilla || 1) ^ 0x51ed27) + 4242) >>> 0);
  const toca = repartirSponsors(r(), sponsors), tocaGrande = repartirSponsors(r(), sponsors), tocaArco = repartirSponsors(r(), sponsors);
  // de un metro del camino al punto que le corresponde (en una vuelta cerrada, da la vuelta; si no, se queda en las puntas)
  const en = (i) => (L ? ((Math.round(i) % L) + L) % L : Math.max(0, Math.min(n - 1, Math.round(i))));
  const alCostado = (i, d) => [P.X[i] - P.HZ[i] * d, P.Z[i] + P.HX[i] * d];
  const enMapa = (x, z) => x > T.x0 + 3 && x < T.x1 - 3 && z > T.z0 + 3 && z < T.z1 - 3;
  const borde = (x, z) => T.borde[Math.round(z - T.z0) * T.nx + Math.round(x - T.x0)];   // metros hasta el borde del camino mas cercano
  const s0 = {}, mojado = (x, z) => T.aguas.length > 0 && T.suelo(x, z, s0).agua > 0;
  // Dice si hay algo que se choca (un arbol, una piedra, una casa...) a menos de "radio" metros. ver(o): cuales cuentan
  const hay = (x, z, radio, ver) => {
    for (let a = Math.floor((x - radio - 3) / 8); a <= Math.floor((x + radio + 3) / 8); a++) for (let b = Math.floor((z - radio - 3) / 8); b <= Math.floor((z + radio + 3) / 8); b++) {
      for (const o of T.cosasCerca(a * 8 + 4, b * 8 + 4) || []) if (Math.hypot(o.x - x, o.z - z) < radio + (o.hx ? Math.hypot(o.hx, o.hz) : o.r) && ver(o)) return true;
    }
    return false;
  };
  const solido = (o) => o.clase !== 'poste', alto = (o) => o.clase === 'arbol' || o.clase === 'edificio';
  // el punto del camino mas cercano a un lugar
  const masCerca = (x, z) => {
    let mejor = 0, md = 1e9;
    for (let i = 0; i < n; i++) { const d = (P.X[i] - x) ** 2 + (P.Z[i] - z) ** 2; if (d < md) { md = d; mejor = i; } }
    return mejor;
  };

  // --- velas: una fila a cada lado, en la largada y en la llegada ---
  const velas = [];
  const fila = (desde, hasta, paso, salvo) => {
    for (let m = desde; m <= hasta + 0.01; m += paso) for (const lado of [-1, 1]) {
      const s = toca(), a = r();
      if (salvo.some((q) => Math.abs(m - q) < 1.6)) continue;   // (justo donde esta el arco, no)
      const i = en(m), [x, z] = alCostado(i, lado * (P.W[i] / 2 + 2.7)), y = T.altura(x, z);
      if (Math.abs(y - P.Y[i]) > 0.9 || mojado(x, z) || hay(x, z, 0.8, solido)) continue;
      velas.push({ x, y, z, s, azar: a });
    }
  };
  if (L) fila(T.salida.i - 38, T.salida.i + 26, 4, [T.salida.i]);
  else {
    fila(T.largada.i - 2, T.salida.i + 26, 4, [T.salida.i]);
    if (T.meta) fila(T.meta.i - 38, T.meta.i + 10, 4, [T.meta.i]);   // (sin meta: el festival de la Travesia, que solo tiene largada)
  }

  // --- chapas: contra cada cinta del publico, mirando al camino ---
  const chapas = [];
  for (const c of T.cintas) {
    const dx = c.x2 - c.x1, dz = c.z2 - c.z1, largo = Math.hypot(dx, dz);
    if (largo < 2) continue;
    const tx = dx / largo, tz = dz / largo, mx = (c.x1 + c.x2) / 2, mz = (c.z1 + c.z2) / 2, k = masCerca(mx, mz);
    let nx = -tz, nz = tx;                                       // hacia el camino
    if ((P.X[k] - mx) * nx + (P.Z[k] - mz) * nz < 0) { nx = -nx; nz = -nz; }
    const cuantas = Math.max(1, Math.round((largo + 0.5) / PASO_CHAPA)), rumbo = Math.atan2(-nx, nz), ex = Math.cos(rumbo), ez = Math.sin(rumbo);
    for (let j = 0; j < cuantas; j++) {
      // el pie queda un poco adelante de la cinta, y la chapa se echa hacia atras hasta apoyarse en ella
      const a = (j - (cuantas - 1) / 2) * PASO_CHAPA, x = mx + tx * a + nx * 0.36, z = mz + tz * a + nz * 0.36, s = toca();
      const sube = Math.atan((T.altura(x + ex * 1.3, z + ez * 1.3) - T.altura(x - ex * 1.3, z - ez * 1.3)) / 2.6);
      if (Math.abs(sube) > 0.5 || mojado(x, z)) continue;
      chapas.push({ x, y: T.altura(x, z), z, rumbo, sube, s });
    }
  }

  // --- cartelones: cada tanto, donde haya lugar ---
  const cartelones = [], medio = CARTEL[0] / 16, pata = medio - 0.6;   // (medio ancho del cartel y a cuanto del medio van las patas, en metros)
  // prueba plantar uno en el metro i, a "lejos" metros del medio del camino (positivo = a la derecha), mirando al que viene "antes" metros atras
  function plantar(i, lejos, antes) {
    const [x, z] = alCostado(i, lejos), j = en((L ? i : Math.max(antes + 2, i)) - antes);
    let nx = P.X[j] - x, nz = P.Z[j] - z;
    const l = Math.hypot(nx, nz);
    if (l < 8) return false;
    nx /= l; nz /= l;
    const rumbo = Math.atan2(-nx, nz), ex = Math.cos(rumbo), ez = Math.sin(rumbo);
    const x1 = x - ex * medio, z1 = z - ez * medio, x2 = x + ex * medio, z2 = z + ez * medio;
    if (!enMapa(x1, z1) || !enMapa(x2, z2)) return false;
    // lejos de cualquier parte del camino, sobre piso mas o menos parejo y seco, y no muy por arriba ni por abajo del camino
    if (borde(x, z) < 5 || borde(x1, z1) < 3.6 || borde(x2, z2) < 3.6) return false;
    const h1 = T.altura(x - ex * pata, z - ez * pata), h2 = T.altura(x + ex * pata, z + ez * pata), y = (h1 + h2) / 2;
    if (Math.abs(h2 - h1) > 0.9 || Math.abs(T.altura(x, z) - y) > 0.35 || Math.abs(T.altura(x + nx * 2, z + nz * 2) - T.altura(x - nx * 2, z - nz * 2)) > 1.5) return false;
    if (Math.abs(y - P.Y[i]) > 2.4 || mojado(x, z) || mojado(x1, z1) || mojado(x2, z2)) return false;
    // sin nada encima ni justo adelante que lo tape, y sin pisar el lugar de la gente, de otros carteles ni de los autos estacionados
    if (hay(x, z, medio + 1, solido) || hay(x + nx * 4.5, z + nz * 4.5, 3.4, alto) || hay(x + nx * 9, z + nz * 9, 3, alto)) return false;
    if (T.claros.some((c) => Math.hypot(c.x - x, c.z - z) < c.r + medio + 0.6)) return false;
    if ((T.vacas || []).some((v) => Math.hypot(v.x - x, v.z - z) < medio + 1.5) || cartelones.some((c) => Math.hypot(c.x - x, c.z - z) < 45)) return false;
    cartelones.push({ x, y, z, rumbo, sube: Math.atan((h2 - h1) / (2 * pata)), s: tocaGrande(), i });
    return true;
  }
  let proximo = 90 + r() * 70;
  for (const t of T.etapa.tramos) {
    if (cartelones.length >= MAX_CARTELONES) break;
    if (t.hasta < proximo || t.largo < 16 || t.hasta > n - 30) continue;
    // ni en vados, puentes o cornisas, ni en el pueblo
    if (t.agua || t.puente || t.izq || t.der || t.vereda || t.casas || t.plano) continue;
    const curva = Math.abs(t.giro || 0) >= 25, afuera = (t.giro || 0) > 0 ? -1 : 1, azarLado = r() < 0.5 ? -1 : 1, corre = r();
    let puesto = false;
    for (const lejos of [8.5, 10.5, 7]) {
      for (const f of curva ? [0.5, 0.36, 0.66] : [0.3 + corre * 0.4, 0.75, 0.2]) {
        const i = Math.max(t.desde, Math.ceil(proximo), Math.min(t.hasta - 1, t.desde + Math.round(t.largo * f)));
        if (i >= t.hasta) continue;
        for (const lado of curva ? [afuera] : [azarLado, -azarLado]) { puesto = plantar(i, lado * (P.W[i] / 2 + lejos), curva ? 20 : 28); if (puesto) break; }
        if (puesto) break;
      }
      if (puesto) break;
    }
    if (puesto) proximo = cartelones[cartelones.length - 1].i + 150 + r() * 110;
  }

  // --- porticos: en las cuadras derechas del pueblo, lejos de los arcos y de las bocacalles, donde los palos no pisen nada ---
  const porticos = [], deArco = arcos.map((a) => en(a.p.i));
  let libre = 50;
  for (const t of T.etapa.tramos) {
    if (!t.vereda || Math.abs(t.giro || 0) > 8 || t.largo < 36 || t.puente || t.agua) continue;
    for (const f of [0.5, 0.36, 0.64]) {
      const i = t.desde + Math.round(t.largo * f), u = i - t.desde, d = P.W[i] / 2 + 0.7;
      if (i < libre || i > n - 30 || d * 16 < CARTEL[0] + 4) continue;
      if (deArco.some((a) => Math.min(Math.abs(a - i), L ? L - Math.abs(a - i) : 1e9) < 34)) continue;
      if ((t.bocas || []).some((b) => Math.abs(b[0] - u) < (b[3] || 7) / 2 + 2.5)) continue;
      const [x1, z1] = alCostado(i, -d), [x2, z2] = alCostado(i, d);
      if (hay(x1, z1, 0.7, solido) || hay(x2, z2, 0.7, solido)) continue;
      porticos.push({ x: P.X[i], y: P.Y[i], z: P.Z[i], rumbo: Math.atan2(P.HX[i], -P.HZ[i]), medio: Math.round(d * 8), s: tocaGrande(), i });
      libre = i + 200;
      break;
    }
  }

  // --- tiras: sobre cada arco, tantas chapas como entren ---
  const tiras = arcos.map((a) => {
    const ancho = a.medio * 2, cuantas = Math.max(1, Math.floor(ancho / (CHAPA[0] + 2)));
    return { ...a, ancho, marcas: Array.from({ length: cuantas }, () => tocaArco()) };
  });
  return { velas, chapas, cartelones, porticos, tiras };
}

// ---------------------------------------------------------------------------------------------------------------
// El dibujo
// ---------------------------------------------------------------------------------------------------------------
const sinAcentos = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
// las letras del juego (3 x 5), agrandadas k veces
const letras = (p, texto, x, y, color, k = 1) => escribir({ punto: (a, b, c) => p.rect(x + a * k, y + b * k, k, k, c) }, texto, 0, 0, color);

// El dibujo de un sponsor en un soporte: el suyo o, si no lo tiene, su nombre escrito.
function logo(p, s, cual, o = {}) {
  if (pintarSponsor(p, s, cual, o)) return;
  const x = o.x || 0, y = o.y || 0, w = o.w || p.w - x, h = o.h || p.h - y, corto = sinAcentos(s.corto || s.nombre || s.id).replace(/\s+/g, '');
  if (cual === 'vela') {            // de arriba hacia abajo, hasta tres letras
    const t = corto.slice(0, 3);
    [...t].forEach((letra, k) => letras(p, letra, x + Math.round((w - 3) / 2), y + Math.round((h - (t.length * 7 - 2)) / 2) + k * 7, s.tinta));
  } else if (cual === 'chapa') {    // hasta cinco letras
    const t = corto.slice(0, Math.max(1, Math.floor((w - 1) / 4)));
    letras(p, t, x + Math.round((w - (t.length * 4 - 1)) / 2), y + Math.round((h - 5) / 2), s.tinta);
  } else {                          // el nombre entero: en grande si entra; si no, en dos renglones; y si tampoco, el nombre corto
    const lugar = w - 4, grande = (t) => letras(p, t, x + Math.round((w - (t.length * 4 - 1) * 2) / 2), y + Math.round((h - 10) / 2), s.tinta, 2);
    const entraGrande = (t) => (t.length * 4 - 1) * 2 <= lugar, nombre = sinAcentos(s.nombre || s.id);
    if (entraGrande(nombre)) return void grande(nombre);
    const renglones = [''];
    for (const q of nombre.split(/\s+/)) { const k = renglones.length - 1, junto = renglones[k] ? renglones[k] + ' ' + q : q; if (junto.length * 4 - 1 <= lugar || !renglones[k]) renglones[k] = junto; else renglones.push(q); }
    if ((renglones.length > 2 || renglones.some((t) => t.length * 4 - 1 > lugar)) && entraGrande(corto)) return void grande(corto);
    const usa = renglones.slice(0, 2), y0 = y + Math.round((h - (usa.length * 7 - 2)) / 2);
    usa.forEach((t, k) => { t = t.slice(0, Math.floor((lugar + 1) / 4)); letras(p, t, x + Math.round((w - (t.length * 4 - 1)) / 2), y0 + k * 7, s.tinta); });
  }
}

// arcos: los de la pista (ver utileria.js). Devuelve cuantos soportes puso de cada clase (para las pruebas).
export function crearPublicidad(T, escena, arcos = []) {
  const L = lugaresDePublicidad(T, arcos), cuantos = { velas: L.velas.length, chapas: L.chapas.length, cartelones: L.cartelones.length, porticos: L.porticos.length, tiras: L.tiras.length };
  if (!SPONSORS.length) return { cuantos, lugares: L, animar() {}, reiniciar() {}, tirados: () => 0 };
  const atlas = crearAtlas(256, SPONSORS.length > 5 ? 512 : 256, VIVO), fijos = crearLote();
  const textura = atlas.textura();
  textura.generateMipmaps = false; textura.minFilter = THREE.NearestFilter;
  // lo que no es marca (palos, dorsos) lleva los colores apagados como el resto del paisaje
  const lisos = {}, liso = (color) => lisos[color] || (lisos[color] = atlas.zona(1, 1, (p) => p.fondo(color), 1, 1));
  // donde quedo pintado cada dibujo de cada sponsor (en pixeles del atlas), por si despues llega su imagen
  const pintados = [], anotar = (s, cual, z, x, y, w, h) => pintados.push({ s, cual, x: z.x + x, y: z.y + y, w, h });

  // --- los dibujos ---
  const Z = new Map();   // sponsor -> { vela, chapa, cartel }
  for (const s of SPONSORS) {
    // la bandera: el mastil a la izquierda y la tela con las puntas redondeadas (lo demas queda transparente)
    const vela = atlas.zona(VELA[0] + 1, VELA[1] + MASTIL, (p) => {
      p.rect(0, 0, 1, VELA[1], '#e3e7ea'); p.rect(0, VELA[1], 1, MASTIL - 1, '#9aa0a8'); p.punto(0, p.h - 1, '#55585e');
      for (let y = 0; y < VELA[1]; y++) { const punta = Math.min(y, VELA[1] - 1 - y); p.rect(1, y, punta === 0 ? VELA[0] - 3 : punta === 1 ? VELA[0] - 1 : VELA[0], 1, s.fondo); }
      logo(p, s, 'vela', { x: 1, y: 0, w: VELA[0], h: VELA[1], sinFondo: true });
    });
    anotar(s, 'vela', vela, 1, 0, VELA[0], VELA[1]);
    // la chapa: el dibujo y, abajo, un liston mas oscuro que apoya en el piso
    const chapa = atlas.zona(CHAPA[0], CHAPA[1] + 1, (p) => { logo(p, s, 'chapa', { h: CHAPA[1] }); p.rect(0, CHAPA[1], p.w, 1, tono(s.fondo, -0.4)); });
    anotar(s, 'chapa', chapa, 0, 0, CHAPA[0], CHAPA[1]);
    const cartel = atlas.zona(CARTEL[0], CARTEL[1], (p) => logo(p, s, 'cartel', { marco: true }));
    anotar(s, 'cartel', cartel, 0, 0, CARTEL[0], CARTEL[1]);
    Z.set(s, { vela, chapa, cartel });
  }
  const dorsoChapa = atlas.zona(CHAPA[0], CHAPA[1] + 1, (p) => { p.fondo('#d6d2c6'); p.rect(3, 0, 1, p.h, '#a7a398'); p.rect(p.w - 4, 0, 1, p.h, '#a7a398'); p.rect(0, p.h - 1, p.w, 1, '#8f8a7e'); }, 1, 1);
  const dorsoCartel = atlas.zona(CARTEL[0], CARTEL[1], (p) => {
    p.fondo('#9aa39f'); p.marco('#737b78'); p.rect(0, 7, p.w, 1, '#737b78');
    for (const x of [5, p.w - 7]) p.rect(x, 0, 2, p.h, '#737b78');
    p.motas('#8a9390', 40, 2, 1);
  }, 7, 1);
  const madera = liso('#7d6248'), maderaClara = liso('#a08464'), canto = liso('#3a3d42'), hierro = liso('#26262a');

  // --- las formas ---
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), Q2 = new THREE.Quaternion(), Q3 = new THREE.Quaternion(), V = new THREE.Vector3();
  const ARRIBA = new THREE.Vector3(0, 1, 0), EJE_X = new THREE.Vector3(1, 0, 0), EJE_Z = new THREE.Vector3(0, 0, 1);
  const UNO = new THREE.Vector3(1, 1, 1), P8 = new THREE.Vector3(0.125, 0.125, 0.125), ACHICA = new THREE.Matrix4().makeScale(0.125, 0.125, 0.125);
  // Una tabla parada: de frente (la cara +z) lleva un dibujo y de atras otro. Medidas en pixeles.
  const tabla = (lote, m, x0, y0, x1, y1, frente, dorso, borde) => lote.caja(m, [x0, y0, -0.5, x1, y1, 0.5], (cara, e) => {
    const z = cara === 'pz' ? frente : cara === 'nz' ? dorso : borde;
    if (cara !== 'pz' && cara !== 'nz') return [z.x + 0.5, z.y + 0.5];
    return [z.x + (cara === 'pz' ? e.x - x0 : x1 - e.x) / (x1 - x0) * z.w, z.y + (y1 - e.y) / (y1 - y0) * z.h];
  });
  // algo apoyado en un lugar, mirando hacia "rumbo", que acompaña la pendiente ("sube") y se echa hacia atras ("echada")
  const apoyar = (o, echada, escala) => M.compose(V.set(o.x, o.y, o.z), Q.setFromAxisAngle(ARRIBA, -o.rumbo).multiply(Q2.setFromAxisAngle(EJE_Z, o.sube || 0)).multiply(Q3.setFromAxisAngle(EJE_X, -echada)), escala);
  const material = estilo(new THREE.MeshLambertMaterial({ map: textura }));
  // Muchas copias de una misma forma, cada una en su lugar. Se pueden tirar: de cada una se anota cual es y como esta.
  //   medio: medio ancho, en metros.   corre: a cuantos metros del pie queda el medio de la tabla (hacia atras, por lo echada)
  const tirables = [];
  const copias = (lote, lista, echada, medio, corre) => {
    if (!lista.length) return;
    const malla = new THREE.InstancedMesh(lote.geometria(atlas), material, lista.length);
    lista.forEach((o, k) => { malla.setMatrixAt(k, apoyar(o, echada, UNO)); tirables.push({ o, malla, k, parada: echada, va: echada, esta: echada, medio, corre, nx: -Math.sin(o.rumbo), nz: Math.cos(o.rumbo) }); });
    malla.castShadow = true; malla.receiveShadow = true;
    escena.add(malla);
  };

  for (const s of SPONSORS) {
    const z = Z.get(s);
    // chapas del vallado
    const lChapa = crearLote(), h = CHAPA[1], w = CHAPA[0] / 2;
    tabla(lChapa, ACHICA, -w, -1, w, h, z.chapa, dorsoChapa, canto);
    copias(lChapa, L.chapas.filter((o) => o.s === s), ECHADA.chapa, CHAPA[0] / 16, -0.18);
    // cartelones: la tabla sobre dos patas de madera
    const lCartel = crearLote(), a = CARTEL[0] / 2, pata = a - 5;
    for (const x of [-pata, pata]) lCartel.bloque(ACHICA, [x - 1, -7, -2.5, x + 1, PIE + CARTEL[1], -0.5], { lados: madera, arriba: maderaClara, abajo: null });
    tabla(lCartel, ACHICA, -a, PIE, a, PIE + CARTEL[1], z.cartel, dorsoCartel, canto);
    copias(lCartel, L.cartelones.filter((o) => o.s === s), ECHADA.cartel, CARTEL[0] / 16, -0.7);
  }

  // --- las tiras de los arcos: van con los arcos, no se mueven ---
  for (const t of L.tiras) {
    const ancho = t.ancho, n = t.marcas.length;
    // cada marca ocupa su pedazo de la tira, con su color; el dibujo va en el medio, del tamaño de una chapa
    const pedazo = (k) => { const x = Math.round(k * ancho / n), w = Math.round((k + 1) * ancho / n) - x; return [x, w, x + Math.round((w - CHAPA[0]) / 2)]; };
    const zona = atlas.zona(ancho, CHAPA[1], (p) => t.marcas.forEach((s, k) => { const [x, w, x0] = pedazo(k); p.rect(x, 0, w, p.h, s.fondo); logo(p, s, 'chapa', { x: x0, w: CHAPA[0], sinFondo: true }); }));
    t.marcas.forEach((s, k) => anotar(s, 'chapa', zona, pedazo(k)[2], 0, CHAPA[0], CHAPA[1]));
    M.compose(V.set(t.p.x, T.altura(t.p.x, t.p.z), t.p.z), Q.setFromAxisAngle(ARRIBA, -t.p.rumbo), P8);
    const y = t.alto + 9;
    tabla(fijos, M, -t.medio, y, t.medio, y + CHAPA[1], zona, zona, hierro);
    for (const lado of [-1, 1]) fijos.bloque(M, [lado * t.medio - 1, y + 1, -1, lado * t.medio + 1, y + CHAPA[1] + 1, 1], { lados: hierro, arriba: hierro, abajo: null });
  }
  // --- los porticos: dos palos, un travesaño y el cartel colgado, que se lee de los dos lados ---
  for (const o of L.porticos) {
    M.compose(V.set(o.x, o.y, o.z), Q.setFromAxisAngle(ARRIBA, -o.rumbo), P8);
    const a = CARTEL[0] / 2, z = Z.get(o.s).cartel, y = PORTICO.alto;
    for (const lado of [-1, 1]) fijos.bloque(M, [lado * o.medio - 1, -6, -1, lado * o.medio + 1, PORTICO.palo, 1], { lados: hierro, arriba: hierro, abajo: null });
    fijos.bloque(M, [-o.medio, PORTICO.palo - 3, -0.75, o.medio, PORTICO.palo - 1, 0.75], { lados: hierro, arriba: hierro, abajo: hierro });
    for (const x of [-a + 6, a - 7]) fijos.bloque(M, [x, y + CARTEL[1], -0.25, x + 1, PORTICO.palo - 3, 0.25], { lados: hierro, arriba: null, abajo: null });
    tabla(fijos, M, -a, y, a, y + CARTEL[1], z, z, canto);
  }
  if (!fijos.vacio()) { const malla = new THREE.Mesh(fijos.geometria(atlas), material); malla.castShadow = true; malla.receiveShadow = true; escena.add(malla); }

  // --- las velas: sprites, como el publico (siempre miran a la camara y se mueven con el viento) ---
  if (L.velas.length) {
    const zonas = {};
    for (const s of SPONSORS) zonas[s.id] = [Z.get(s).vela];
    const lote = crearLoteDeSprites({ atlas, zonas, textura });
    for (const v of L.velas) lote.poner(v.s.id, v.x, v.y, v.z, { azar: v.azar, mueve: 0.16 });
    escena.add(lote.malla(true));
  }

  // --- los sponsors que traen su imagen: cuando llega, reemplaza al dibujo ---
  const lienzo = atlas.lienzo.getContext('2d');
  const hex = (v) => v.toString(16).padStart(2, '0'), rgb = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
  function pegar(img, s, cual) {
    const fondo = rgb(deLaPaleta(s.fondo, VIVO));
    for (const r of pintados) {
      if (r.s !== s || r.cual !== cual) continue;
      // se achica hasta que entre (sin deformarla) y se centra; lo transparente deja ver el fondo del sponsor
      const k = Math.min(1, r.w / img.width, r.h / img.height), w = Math.max(1, Math.round(img.width * k)), h = Math.max(1, Math.round(img.height * k));
      const c = document.createElement('canvas'); c.width = r.w; c.height = r.h;
      const x = c.getContext('2d', { willReadFrequently: true }); x.imageSmoothingEnabled = false;
      x.drawImage(img, Math.round((r.w - w) / 2), Math.round((r.h - h) / 2), w, h);
      // sus colores pasan por la paleta del juego, como todo lo demas
      const d = x.getImageData(0, 0, r.w, r.h), q = d.data;
      for (let i = 0; i < q.length; i += 4) {
        const color = q[i + 3] < 128 ? fondo : rgb(deLaPaleta('#' + hex(q[i]) + hex(q[i + 1]) + hex(q[i + 2]), VIVO));
        q[i] = color[0]; q[i + 1] = color[1]; q[i + 2] = color[2]; q[i + 3] = 255;
      }
      x.putImageData(d, 0, 0);
      // se pega solo sobre lo que ya estaba pintado: las puntas redondeadas de la bandera siguen transparentes
      lienzo.save(); lienzo.globalCompositeOperation = 'source-atop'; lienzo.drawImage(c, r.x, r.y); lienzo.restore();
    }
    textura.needsUpdate = true;
  }
  for (const s of SPONSORS) for (const cual in s.imagen || {}) {
    const img = new Image();
    img.onload = () => { try { pegar(img, s, cual); } catch (e) { console.warn('Sponsor ' + s.id + ': no se pudo usar ' + s.imagen[cual], e); } };
    img.onerror = () => console.warn('Sponsor ' + s.id + ': no se encontro ' + s.imagen[cual]);
    img.src = s.imagen[cual];
  }

  // c: el auto. Si se lleva puesto algo, lo deja tirado para el lado que iba (de espaldas si le entro de frente, de cara si de atras).
  let ax = null, az = 0;   // donde estaba el auto en el cuadro anterior
  function animar(c, dt) {
    const x = c.pos[0], z = c.pos[2], fx = c.adelante[0], fz = c.adelante[2];
    if (ax === null || Math.hypot(x - ax, z - az) > 6) { ax = x; az = z; }   // (si salto de lugar, no cuenta como recorrido)
    for (const t of tirables) {
      const o = t.o, dx = x - o.x, dz = z - o.z;
      if (t.va === t.parada && Math.abs(dx) < 9 && Math.abs(dz) < 9 && Math.abs(c.pos[1] - o.y) < 2.6) {
        // donde esta el auto respecto de la tabla (a lo largo y hacia adelante de ella) y cuanto ocupa en cada sentido (mide 3,8 x 1,7)
        const largo = dx * t.nz - dz * t.nx, frente = dx * t.nx + dz * t.nz - t.corre, haciaElla = Math.abs(fx * t.nx + fz * t.nz), aLoLargo = Math.abs(fx * t.nz - fz * t.nx);
        const antes = (ax - o.x) * t.nx + (az - o.z) * t.nz - t.corre, ancho = t.medio + aLoLargo * 1.9 + haciaElla * 0.85;
        // la toca ahora, o la cruzo de un cuadro al otro (yendo rapido, o si el aparato va lento)
        const toca = Math.abs(frente) < haciaElla * 1.9 + aLoLargo * 0.85 + 0.15 && Math.abs(largo) < ancho;
        const cruzo = antes * frente < 0 && Math.abs(largo + ((ax - o.x) * t.nz - (az - o.z) * t.nx - largo) * frente / (frente - antes)) < ancho;
        if (toca || cruzo) {
          const empuja = c.vel[0] * t.nx + c.vel[2] * t.nz;
          t.va = (cruzo ? antes > 0 : Math.abs(empuja) > 0.5 ? empuja < 0 : frente > 0) ? 1.5 : -1.5;
        }
      }
      if (t.esta === t.va) continue;
      t.esta += (t.va - t.esta) * Math.min(1, dt * 12);
      if (Math.abs(t.va - t.esta) < 0.02) t.esta = t.va;
      t.malla.setMatrixAt(t.k, apoyar(o, t.esta, UNO));
      t.malla.instanceMatrix.needsUpdate = true;
    }
    ax = x; az = z;
  }
  // al largar de nuevo, todo vuelve a estar parado
  function reiniciar() {
    ax = null;
    for (const t of tirables) { if (t.esta === t.parada && t.va === t.parada) continue; t.va = t.esta = t.parada; t.malla.setMatrixAt(t.k, apoyar(t.o, t.parada, UNO)); t.malla.instanceMatrix.needsUpdate = true; }
  }
  // (para las pruebas) cuantos quedaron tirados
  return { cuantos, lugares: L, animar, reiniciar, tirados: () => tirables.filter((t) => t.va !== t.parada).length };
}

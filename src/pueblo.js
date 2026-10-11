// El pueblo: los edificios, las cosas de la calle (conos, vallas, volquetes, faroles, colectivos),
// las barandas de los puentes y las pircas de las cornisas. Todo son cajas con un dibujo de pocos pixeles, como el resto del mundo.
// Donde va cada cosa lo decide la pista (terrain.js); las medidas estan en edificios.js. Aca solo se dibuja.
import * as THREE from '../vendor/three.module.js';
import { azar } from './noise.js';
import { crearAtlas, crearLote, tono } from './pixel.js';
import { estilo } from './material.js';
import { escribir } from './arte.js';
import { EDIFICIOS } from './edificios.js';

const entero = (p, a, b) => a + Math.floor(p.azar() * (b - a + 1));
// --- colores ---
const REVOQUES = ['#e6dfcd', '#d9b36a', '#d8a48c', '#a9c3cc', '#b4cdb4', '#c9bfa8', '#e2c9a0', '#bfae9a'];   // paredes: cal, ocre, rosa viejo, celeste, verde agua, gris, crema, tierra
const ABERTURAS = ['#3f6a4a', '#6b4a36', '#35546e', '#8a3a2a', '#e9e4d6'];                                    // puertas y postigos
const CHAPAS = [['#8f9499', '#73787c', '#b0b5b8'], ['#8a5a44', '#6e4634', '#a8735a'], ['#7d8a84', '#64706a', '#9aa8a0']];   // techos de chapa: gris, oxidada, verde
const TEJAS = ['#b5523a', '#96402c', '#cf6e50'];
const VIDRIO = ['#22364a', '#35546e', '#7fb0cf'];
const CARTELES = ['ALMACEN', 'BAR', 'PANADERIA', 'FERRETERIA', 'CLUB', 'TALLER', 'FARMACIA', 'KIOSCO', 'FIAMBRES', 'GOMERIA'];
const COLECTIVOS = [['#c8402f', '#e9e4d6'], ['#2f6fa8', '#e9e4d6'], ['#3f8a55', '#f2d24a'], ['#e0a21e', '#c8402f']];
const TACHOS = ['#2f6fa8', '#c8402f', '#e0a21e', '#3f8a55', '#55585e'];

// --- pinceles de paredes y techos (el dibujo va de arriba hacia abajo: la fila 0 es el borde de arriba) ---
function ventana(p, x, y, w, h, postigo) {
  p.rect(x - 1, y - 1, w + 2, h + 2, '#f1ede2');
  p.rect(x, y, w, h, VIDRIO[0]); p.rect(x, y, w, 1, VIDRIO[1]); p.punto(x + 1, y + 1, VIDRIO[2]); if (w > 3) p.punto(x + 2, y, VIDRIO[2]);
  if (postigo) { p.rect(x - 2, y, 1, h, postigo); p.rect(x + w + 1, y, 1, h, postigo); }
  p.rect(x - 1, y + h + 1, w + 2, 1, '#8f8a7e');   // el alfeizar
}
function puerta(p, x, w, h, color) {
  const y = p.h - h;
  p.rect(x - 1, y - 1, w + 2, h + 1, '#f1ede2');
  p.rect(x, y, w, h, color); p.rect(x, y, w, 1, tono(color, -0.3)); p.rect(x + 1, y + 2, w - 2, 2, tono(color, 0.2)); p.rect(x + 1, y + 5, w - 2, Math.max(1, h - 6), tono(color, 0.12));
  p.punto(x + w - 1, y + Math.floor(h / 2), '#e0c060');
}
// una pared lisa: revoque con manchas, zocalo oscuro abajo y un filete claro arriba
function revoque(p, color, sucio = 1) {
  p.fondo(color);
  for (let i = 0; i < Math.round(p.w * p.h / 40 * sucio); i++) p.punto(entero(p, 0, p.w - 1), entero(p, 1, p.h - 1), tono(color, -0.1));
  for (let i = 0; i < Math.round(p.w * p.h / 60); i++) p.punto(entero(p, 0, p.w - 1), entero(p, 0, p.h - 3), tono(color, 0.18));
  // chorreaduras de humedad desde arriba
  for (let i = 0; i < Math.round(p.w / 9 * sucio); i++) p.rect(entero(p, 0, p.w - 1), 1, 1, entero(p, 2, Math.max(2, p.h >> 1)), tono(color, -0.14));
  p.rect(0, 0, p.w, 1, tono(color, 0.3));
  p.rect(0, p.h - 2, p.w, 2, tono(color, -0.32));
}
function chapa(p, t, aLoLargo) {   // acanalada: rayas finas en el sentido de la caida
  p.fondo(t[0]);
  if (aLoLargo) for (let y = 0; y < p.h; y += 2) p.rect(0, y, p.w, 1, t[1]); else for (let x = 0; x < p.w; x += 2) p.rect(x, 0, 1, p.h, t[1]);
  p.motas(t[2], Math.round(p.w * p.h / 30)); p.motas('#7a4a34', Math.round(p.w * p.h / 70), 2, 1);
}
function tejas(p) {
  p.fondo(TEJAS[0]);
  for (let y = 0; y < p.h; y += 2) { p.rect(0, y, p.w, 1, TEJAS[1]); for (let x = (y >> 1) % 2; x < p.w; x += 2) p.punto(x, y + 1, TEJAS[2]); }
  p.motas('#7f8a52', Math.round(p.w * p.h / 90));
}
// pirca: piedras apiladas en seco, en hiladas de dos pixeles; cada piedra con su tono, luz arriba y la junta oscura
const PIEDRAS = ['#a59d8b', '#958d7c', '#b4ab98', '#888070', '#9e9683'];
function pirca(p) {
  p.fondo('#5d584e');
  for (let y = 0; y < p.h; y += 2) {
    let x = -entero(p, 0, 2);
    while (x < p.w) {
      const w = entero(p, 2, 5), t = PIEDRAS[entero(p, 0, PIEDRAS.length - 1)];
      p.rect(x, y, w, 2, t); p.rect(x, y, w, 1, tono(t, 0.16)); p.punto(x + w - 1, y + 1, '#5d584e');
      x += w;
    }
  }
  p.motas('#7f8a52', Math.round(p.w * p.h / 70));   // musgo
}
function pircaDeArriba(p) {   // las piedras de la ultima hilada, vistas desde arriba
  p.fondo('#6b665b');
  for (let y = 0; y < p.h; ) {
    const h = entero(p, 2, 4), partida = p.azar() < 0.45 ? entero(p, 2, p.w - 2) : p.w, t = PIEDRAS[entero(p, 0, PIEDRAS.length - 1)];
    p.rect(0, y, partida, h - (p.azar() < 0.7 ? 1 : 0), tono(t, 0.2));
    if (partida < p.w) p.rect(partida + 1, y, p.w - partida - 1, h - 1, tono(PIEDRAS[entero(p, 0, PIEDRAS.length - 1)], 0.2));
    y += h;
  }
  p.motas('#c9c1ae', Math.round(p.w * p.h / 30)); p.motas('#7f8a52', Math.round(p.w * p.h / 60));
}
function azotea(p) {   // techo plano: membrana gris, con parches
  p.fondo('#8f8a80');
  for (let i = 0; i < 5; i++) p.rect(entero(p, 1, p.w - 6), entero(p, 1, p.h - 5), entero(p, 3, 6), entero(p, 2, 4), i % 2 ? '#99948a' : '#84807a');
  p.marco('#b8b3a6'); p.motas('#75716a', Math.round(p.w * p.h / 26));
}

// Dibuja el pueblo y lo agrega a la escena. clima: para pedirle los resplandores de los faroles. luz: la del clima.
export function crearPueblo(T, escena, clima, luz) {
  const nada = { tirar() {}, reiniciar() {} };
  if (!T.casas.length && !T.objetos.length && !T.barandas.length && !T.pircas.length) return nada;
  const atlas = crearAtlas(1024, 512), hechas = {};
  // un dibujo del atlas, que se pinta la primera vez que se pide. fuerza: cuanto se apagan sus colores (menos = mas vivos)
  const una = (clave, w, h, pintar, semilla, fuerza) => hechas[clave] || (hechas[clave] = atlas.zona(w, h, pintar, semilla || 1 + clave.length * 7 + (clave.charCodeAt(clave.length - 1) || 0), fuerza));
  const liso = (color) => atlas.liso(color);
  const fijos = crearLote();
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), Q2 = new THREE.Quaternion(), V = new THREE.Vector3(), E = new THREE.Vector3(), ARRIBA = new THREE.Vector3(0, 1, 0), EJE_X = new THREE.Vector3(1, 0, 0);
  const P4 = new THREE.Vector3(0.25, 0.25, 0.25), P8 = new THREE.Vector3(0.125, 0.125, 0.125);
  const en = (o, escala) => M.compose(V.set(o.x, o.y, o.z), Q.setFromAxisAngle(ARRIBA, -o.rumbo), escala);
  // un pedazo de pared (pirca o baranda): va a lo largo del camino y acompaña la pendiente
  const enPared = (o) => M.compose(V.set(o.x, o.y, o.z), Q.setFromAxisAngle(ARRIBA, -o.rumbo).multiply(Q2.setFromAxisAngle(EJE_X, o.sube || 0)), P8);

  // ================= edificios (a 4 pixeles por metro; el frente mira a -Z) =================
  // una caja con las cuatro paredes pintadas a medida y su techo
  const pared = (clave, w, h, pintar) => una(clave + w + 'x' + h, w, h, pintar);
  function edificio(o) {
    // n: cual de las ocho variantes de ese tipo de edificio es (de ahi salen sus colores, su cartel y sus detalles)
    const D = EDIFICIOS[o.tipo] || EDIFICIOS.casa, w = Math.round(D.ancho * 4), d = Math.round(D.fondo * 4), h = Math.round(D.alto * 4), n = (o.variante | 0) % 8;
    const color = REVOQUES[n], abre = ABERTURAS[(n * 3 + 1) % ABERTURAS.length], k = o.tipo + n;
    en(o, P4);
    const x0 = -w / 2, z0 = -d / 2, cuerpo = (zonas, alto = h, desde = -3) => fijos.bloque(M, [x0, desde, z0, x0 + w, alto, z0 + d], zonas);
    const lisa = (ancho, alto = h + 3) => pared('lisa' + color, ancho, alto, (p) => revoque(p, color));
    const conVentana = (ancho, alto = h + 3) => pared('vent' + color + abre, ancho, alto, (p) => { revoque(p, color); ventana(p, Math.round(ancho / 2) - 2, 3, 4, 4, abre); });
    const techoAzotea = () => una('azotea' + w + 'x' + d, w, d, azotea);
    // techo a dos aguas, en escalones. cumbrera: 'x' = paralela al frente, 'z' = hacia el fondo. material: tejas o chapa.
    const dosAguas = (cumbrera, material, alero = 1, pasos = 3, base = h) => {
      const t = CHAPAS[n % CHAPAS.length];
      for (let s = 0; s < pasos; s++) {
        const mete = Math.round(s * (cumbrera === 'x' ? d / 2 : w / 2) / pasos) - (s === 0 ? alero : 0), a = cumbrera === 'x' ? [x0 - alero, base + s * 2, z0 + mete, x0 + w + alero, base + s * 2 + 2, z0 + d - mete] : [x0 + mete, base + s * 2, z0 - alero, x0 + w - mete, base + s * 2 + 2, z0 + d + alero];
        const tw = Math.round(a[3] - a[0]), td = Math.round(a[5] - a[2]);
        const arriba = material === 'tejas' ? una('tejas' + tw + 'x' + td, tw, td, tejas) : una('chapa' + (n % CHAPAS.length) + cumbrera + tw + 'x' + td, tw, td, (p) => chapa(p, t, cumbrera === 'z'));
        fijos.bloque(M, a, { arriba, lados: liso(material === 'tejas' ? TEJAS[1] : t[1]), abajo: null });
      }
    };
    if (o.tipo === 'casa') {
      const frente = pared(k + 'f', w, h + 3, (p) => { revoque(p, color); puerta(p, 13, 4, 9, abre); ventana(p, 4, 3, 5, 4, abre); ventana(p, 23, 3, 5, 4, abre); });
      cuerpo({ nz: frente, pz: lisa(w), px: conVentana(d), nx: lisa(d), arriba: null, abajo: null });
      dosAguas('x', n % 3 === 0 ? 'chapa' : 'tejas');
      if (n % 2) fijos.bloque(M, [x0 + 5, h + 2, 2, x0 + 8, h + 9, 5], { lados: liso('#9a5a44'), arriba: liso('#3a2a22'), abajo: null });   // chimenea
    } else if (o.tipo === 'casita') {
      const frente = pared(k + 'f', w, h + 5, (p) => { revoque(p, color); p.rect(0, 0, p.w, 2, tono(color, 0.3)); puerta(p, 4, 4, 9, abre); ventana(p, 14, 5, 5, 4, abre); });
      cuerpo({ nz: frente, pz: lisa(w, h + 5), px: lisa(d, h + 5), nx: conVentana(d, h + 5), arriba: null, abajo: null }, h + 2);
      fijos.bloque(M, [x0 + 1, h, z0 + 1, x0 + w - 1, h + 1, z0 + d - 1], { arriba: techoAzotea(), lados: null, abajo: null });   // la azotea, hundida entre las cuatro paredes
      fijos.bloque(M, [x0 + w - 8, h + 1, z0 + d - 8, x0 + w - 3, h + 5, z0 + d - 3], { lados: liso('#7d8a94'), arriba: liso('#a9b6c0'), abajo: null });   // tanque de agua
    } else if (o.tipo === 'rancho') {
      const adobe = ['#b08a62', '#a67f58', '#bb956c'][n % 3];
      const frente = pared('rancho' + n % 3 + 'f', w, h + 3, (p) => { revoque(p, adobe, 2.4); puerta(p, 6, 4, 8, '#5c4130'); ventana(p, 17, 3, 4, 3, null); });
      const ciega = (ancho) => pared('rancho' + n % 3 + 'c', ancho, h + 3, (p) => revoque(p, adobe, 2.4));
      cuerpo({ nz: frente, pz: ciega(w), px: ciega(d), nx: ciega(d), arriba: null, abajo: null });
      // techo de chapa de una sola caida, que se alarga hacia adelante como galeria, sobre dos palos
      const t = CHAPAS[(n + 1) % CHAPAS.length], tw = w + 2, td = d + 7;
      fijos.bloque(M, [x0 - 1, h, z0 - 6, x0 + w + 1, h + 1, z0 + d + 1], { arriba: una('chapaRancho' + (n + 1) % CHAPAS.length + tw + 'x' + td, tw, td, (p) => chapa(p, t, true)), lados: liso(t[1]), abajo: liso('#4a3a2c') });
      for (const x of [x0 + 1, x0 + w - 2]) fijos.bloque(M, [x, -3, z0 - 6, x + 1, h, z0 - 5], { lados: liso('#5c4130'), arriba: null, abajo: null });
    } else if (o.tipo === 'almacen') {
      const texto = CARTELES[n % CARTELES.length], alto = h + 3;
      const frente = pared('alm' + n + texto, w, alto + 4, (p) => {
        revoque(p, color); p.rect(0, 0, p.w, 6, tono(color, -0.12)); p.rect(0, 6, p.w, 1, tono(color, 0.3));
        p.rect(Math.round((p.w - texto.length * 4 - 3) / 2), 0, texto.length * 4 + 3, 7, '#f1ede2'); escribir(p, texto, Math.round((p.w - texto.length * 4 + 1) / 2), 1, '#2a2622');
        puerta(p, 17, 5, 10, abre);
        for (const x of [3, 27]) { p.rect(x - 1, p.h - 11, 12, 9, '#f1ede2'); p.rect(x, p.h - 10, 10, 7, VIDRIO[0]); p.rect(x, p.h - 10, 10, 1, VIDRIO[1]); p.punto(x + 2, p.h - 8, VIDRIO[2]); p.rect(x + 5, p.h - 6, 3, 3, ['#e0a21e', '#c8402f', '#3f8a55'][(n + x) % 3]); }
      });
      // el frente es mas alto que el resto (4 pixeles): tapa el techo
      fijos.bloque(M, [x0, -3, z0, x0 + w, h + 4, z0 + 2], { nz: frente, pz: lisa(w, h + 7), px: lisa(2, h + 7), nx: lisa(2, h + 7), arriba: liso(tono(color, 0.3)), abajo: null });
      fijos.bloque(M, [x0, -3, z0 + 2, x0 + w, h, z0 + d], { nz: null, pz: lisa(w), px: lisa(d - 2), nx: conVentana(d - 2), arriba: null, abajo: null });
      const t = CHAPAS[n % CHAPAS.length];
      fijos.bloque(M, [x0, h, z0 + 2, x0 + w, h + 1, z0 + d + 1], { arriba: una('chapaAlm' + n % CHAPAS.length + w + 'x' + (d - 1), w, d - 1, (p) => chapa(p, t, true)), lados: liso(t[1]), abajo: null });
      // el toldo, a rayas
      const raya = ['#c8402f', '#3f8a55', '#2f6fa8', '#e0a21e'][n % 4];
      fijos.bloque(M, [x0 + 1, h - 3, z0 - 5, x0 + w - 1, h - 2, z0], { arriba: una('toldo' + raya + (w - 2), w - 2, 5, (p) => { for (let x = 0; x < p.w; x++) p.rect(x, 0, 1, 5, (x >> 1) % 2 ? raya : '#f1ede2'); }), lados: liso(tono(raya, -0.25)), abajo: liso(tono(raya, -0.4)) });
    } else if (o.tipo === 'galpon') {
      const t = CHAPAS[n % CHAPAS.length];
      const lado = (ancho, porton) => pared('galpon' + n % CHAPAS.length + (porton ? 'p' : ''), ancho, h + 3, (p) => {
        chapa(p, t, false); p.rect(0, p.h - 2, p.w, 2, '#5d5a55');
        if (porton) { p.rect(16, p.h - 15, 16, 13, '#3a3d42'); for (let x = 17; x < 32; x += 3) p.rect(x, p.h - 15, 1, 13, '#2c2e33'); p.rect(16, p.h - 15, 16, 1, '#5a5d63'); p.rect(23, p.h - 15, 1, 13, '#1e1f23'); }
      });
      cuerpo({ nz: lado(w, true), pz: lado(w), px: lado(d), nx: lado(d), arriba: null, abajo: null });
      dosAguas('z', 'chapa', 1, 3);
    } else if (o.tipo === 'capilla') {
      const blanca = '#ece8dc';
      const frente = pared('capillaF', w, h + 3, (p) => { revoque(p, blanca, 0.6); p.rect(10, p.h - 12, 8, 10, '#f7f4ea'); p.rect(11, p.h - 11, 6, 9, '#5c4130'); p.rect(12, p.h - 12, 4, 1, '#5c4130'); p.rect(13, p.h - 11, 1, 9, '#473021'); p.rect(12, 3, 4, 4, '#f7f4ea'); p.rect(13, 4, 2, 2, VIDRIO[1]); });
      const costado = pared('capillaC', d, h + 3, (p) => { revoque(p, blanca, 0.6); for (let x = 7; x < p.w - 6; x += 11) { p.rect(x - 1, 4, 4, 8, '#f7f4ea'); p.rect(x, 5, 2, 7, VIDRIO[0]); p.punto(x, 5, VIDRIO[2]); } });
      cuerpo({ nz: frente, pz: pared('capillaA', w, h + 3, (p) => revoque(p, blanca, 0.6)), px: costado, nx: costado, arriba: null, abajo: null });
      dosAguas('z', 'tejas', 1, 4);
      // el campanario, adelante y a un costado, con su cruz
      const tx = x0 + w - 10, lisaT = pared('torre', 10, 38, (p) => { revoque(p, blanca, 0.6); p.rect(3, 5, 4, 6, '#2a2622'); p.rect(4, 4, 2, 1, '#2a2622'); p.rect(4, 7, 2, 3, '#c9a646'); });
      fijos.bloque(M, [tx, -3, z0 - 2, tx + 10, 35, z0 + 8], { lados: lisaT, arriba: null, abajo: null });
      fijos.bloque(M, [tx - 1, 35, z0 - 3, tx + 11, 37, z0 + 9], { arriba: una('tejas12x12', 12, 12, tejas), lados: liso(TEJAS[1]), abajo: null });
      fijos.bloque(M, [tx + 2, 37, z0, tx + 8, 39, z0 + 6], { arriba: una('tejas6x6', 6, 6, tejas), lados: liso(TEJAS[1]), abajo: null });
      fijos.bloque(M, [tx + 4.5, 39, z0 + 2.5, tx + 5.5, 46, z0 + 3.5], { lados: liso('#2a2622'), arriba: liso('#2a2622'), abajo: null });
      fijos.bloque(M, [tx + 3, 43, z0 + 2.5, tx + 7, 44, z0 + 3.5], { lados: liso('#2a2622'), arriba: liso('#2a2622'), abajo: null });
    } else if (o.tipo === 'edificio') {
      const texto = n % 2 ? CARTELES[(n * 5 + 3) % CARTELES.length] : '';
      const frente = pared('edif' + n + texto, w, h + 5, (p) => {
        revoque(p, color); p.rect(0, 0, p.w, 2, tono(color, 0.3)); p.rect(0, 14, p.w, 1, tono(color, -0.2));
        for (const x of [4, 15, 26]) { ventana(p, x, 5, 5, 6, abre); p.rect(x - 2, 12, 9, 1, '#3a3d42'); p.rect(x - 2, 10, 1, 2, '#3a3d42'); p.rect(x + 6, 10, 1, 2, '#3a3d42'); }   // ventanas con balcon
        if (texto) { p.rect(1, 16, texto.length * 4 + 3, 7, '#2a2622'); escribir(p, texto, 3, 17, '#f2c200'); }
        puerta(p, 28, 5, 10, abre);
        p.rect(2, p.h - 12, 22, 10, '#f1ede2'); p.rect(3, p.h - 11, 20, 8, VIDRIO[0]); p.rect(3, p.h - 11, 20, 1, VIDRIO[1]); p.rect(13, p.h - 11, 1, 8, '#f1ede2'); p.punto(5, p.h - 9, VIDRIO[2]); p.punto(16, p.h - 9, VIDRIO[2]);
      });
      const costado = (ancho) => pared('edifC' + color + abre, ancho, h + 5, (p) => { revoque(p, color); p.rect(0, 0, p.w, 2, tono(color, 0.3)); for (let x = 6; x < p.w - 6; x += 10) ventana(p, x, 5, 4, 6, null); });
      cuerpo({ nz: frente, pz: lisa(w, h + 5), px: costado(d), nx: costado(d), arriba: null, abajo: null }, h + 2);
      fijos.bloque(M, [x0 + 1, h, z0 + 1, x0 + w - 1, h + 1, z0 + d - 1], { arriba: techoAzotea(), lados: null, abajo: null });
      fijos.bloque(M, [x0 + 4, h + 1, z0 + d - 9, x0 + 10, h + 6, z0 + d - 3], { lados: liso('#7d8a94'), arriba: liso('#a9b6c0'), abajo: null });
      fijos.bloque(M, [x0 + w - 10, h + 1, z0 + 4, x0 + w - 4, h + 4, z0 + 12], { lados: liso(tono(color, -0.1)), arriba: liso('#8f8a80'), abajo: null });   // la salida de la escalera
    } else if (o.tipo === 'tanque') {
      // cuatro patas de hierro y arriba el tanque
      const pata = liso('#6f7479');
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) fijos.bloque(M, [sx * 5 - 0.5, -3, sz * 5 - 0.5, sx * 5 + 0.5, 26, sz * 5 + 0.5], { lados: pata, arriba: null, abajo: null });
      for (const y of [8, 17]) { fijos.bloque(M, [-5, y, -5.5, 5, y + 1, -4.5], { lados: pata, arriba: pata }); fijos.bloque(M, [-5, y, 4.5, 5, y + 1, 5.5], { lados: pata, arriba: pata }); fijos.bloque(M, [-5.5, y, -5, -4.5, y + 1, 5], { lados: pata, arriba: pata }); fijos.bloque(M, [4.5, y, -5, 5.5, y + 1, 5], { lados: pata, arriba: pata }); }
      const cuba = una('cuba', 14, 10, (p) => { p.fondo('#c9ced2'); p.rect(0, 0, 14, 1, '#e3e7ea'); p.rect(0, 4, 14, 1, '#8f9499'); p.rect(0, 9, 14, 1, '#8f9499'); for (let x = 1; x < 14; x += 3) p.rect(x, 0, 1, 10, '#b0b5b8'); p.motas('#8a5a44', 8); });
      fijos.bloque(M, [-7, 26, -7, 7, 36, 7], { lados: cuba, arriba: liso('#b0b5b8'), abajo: liso('#73787c') });
      fijos.bloque(M, [-5, 36, -5, 5, 37, 5], { lados: liso('#8f9499'), arriba: liso('#c9ced2'), abajo: null });
    }
  }
  for (const o of T.casas) edificio(o);

  // ================= barandas de los puentes (a 8 pixeles por metro) =================
  const madera = liso('#9a7c5a'), maderaClara = liso('#c2a37a'), sombra = liso('#6b543c');
  for (const o of T.barandas) {
    enPared(o);
    const L = o.hz * 8;   // (un poste en cada punta: los pedazos seguidos lo comparten)
    for (const z of [-L, L]) fijos.bloque(M, [-1.25, -6, z - 1.25, 1.25, 9.5, z + 1.25], { lados: madera, arriba: maderaClara, abajo: null });
    fijos.bloque(M, [-0.75, 7, -L, 0.75, 9, L], { lados: madera, arriba: maderaClara, abajo: sombra });
    fijos.bloque(M, [-0.5, 3, -L, 0.5, 4.5, L], { lados: madera, arriba: maderaClara, abajo: sombra });
  }

  // ================= pircas: muritos de piedra al borde de las cornisas (a 8 pixeles por metro) =================
  // Cada pedazo mide dos metros. Baja bastante por debajo del piso: del lado de la caida queda como muro de contencion.
  if (T.pircas.length) {
    const caras = [0, 1, 2].map((k) => una('pirca' + k, 26, 16, pirca, 61 + k * 13)), tapas = [0, 1, 2].map((k) => una('pircaTapa' + k, 5, 26, pircaDeArriba, 83 + k * 7)), punta = una('pircaPunta', 5, 16, pirca, 97);
    for (const o of T.pircas) {
      enPared(o);
      const L = o.hz * 8, alto = 4 + (o.n * 5 % 3) * 0.75, k = o.n % 3;   // (de 50 a 70 cm: la linea de arriba queda despareja, como en una pirca de verdad)
      fijos.bloque(M, [-2.25, -9, -L, 2.25, alto, L], { px: caras[k], nx: caras[(k + 1) % 3], nz: punta, pz: punta, arriba: tapas[k], abajo: null });
    }
  }

  // ================= cosas de la calle =================
  // Las que no se mueven van con los edificios; las que se pueden tirar, aparte (una forma por tipo, repetida).
  const sueltas = {};   // tipo -> { lote, lista }
  const suelta = (tipo, armar) => { if (!sueltas[tipo]) { const lote = crearLote(); armar(lote, new THREE.Matrix4().makeScale(0.125, 0.125, 0.125)); sueltas[tipo] = { lote, lista: [] }; } return sueltas[tipo]; };
  const faroles = [];
  for (const o of T.objetos) {
    const n = o.n | 0;
    if (o.tipo === 'cono') suelta('cono', (l, m) => {
      l.bloque(m, [-1.75, 0, -1.75, 1.75, 0.75, 1.75], { lados: liso('#2a2622'), arriba: liso('#3a3632'), abajo: null });
      l.bloque(m, [-1, 0.75, -1, 1, 3.25, 1], { lados: una('cono', 2, 3, (p) => { p.fondo('#f07f1e'); p.rect(0, 1, 2, 1, '#f4f0e6'); }, 0, 0.3), arriba: null, abajo: null });
      l.bloque(m, [-0.5, 3.25, -0.5, 0.5, 5, 0.5], { lados: liso('#f07f1e'), arriba: liso('#f4a04a'), abajo: null });
    }).lista.push(o);
    else if (o.tipo === 'tacho') { const c = TACHOS[n % TACHOS.length]; suelta('tacho' + n % TACHOS.length, (l, m) => l.bloque(m, [-2.5, 0, -2.5, 2.5, 7, 2.5], { lados: una('tacho' + c, 5, 7, (p) => { p.fondo(c); p.rect(0, 2, 5, 1, tono(c, -0.3)); p.rect(0, 5, 5, 1, tono(c, -0.3)); p.rect(0, 0, 5, 1, tono(c, 0.3)); p.punto(3, 3, '#7a4a34'); }), arriba: una('tachoTapa' + c, 5, 5, (p) => { p.fondo(tono(c, -0.2)); p.marco(tono(c, 0.25)); p.punto(1, 1, '#2a2622'); }), abajo: null })).lista.push(o); }
    else if (o.tipo === 'cubiertas') suelta('cubiertas', (l, m) => l.bloque(m, [-4.5, 0, -4.5, 4.5, 6, 4.5], { lados: una('cubiertas', 9, 6, (p) => { p.fondo('#1e1f23'); p.rect(0, 1, 9, 1, '#3a3d42'); p.rect(0, 3, 9, 1, '#3a3d42'); p.rect(0, 5, 9, 1, '#131316'); for (let x = 0; x < 9; x += 2) p.punto(x, 0, '#34343a'); }), arriba: una('cubiertasTapa', 9, 9, (p) => { p.fondo('#1e1f23'); p.rect(1, 1, 7, 7, '#2c2e33'); p.rect(3, 3, 3, 3, '#0e0e10'); p.marco('#131316'); }), abajo: null })).lista.push(o);
    else if (o.tipo === 'cajones') suelta('cajones', (l, m) => {
      const tabla = una('cajon', 10, 8, (p) => { p.fondo('#a9743f'); for (let y = 0; y < 8; y += 2) p.rect(0, y + 1, 10, 1, '#7d5228'); p.rect(0, 0, 1, 8, '#c99355'); p.rect(9, 0, 1, 8, '#6b4a2c'); p.rect(0, 3, 10, 1, '#5c3f22'); }), tapa = una('cajonTapa', 10, 10, (p) => { p.fondo('#b98350'); for (let x = 0; x < 10; x += 2) p.rect(x, 0, 1, 10, '#8a5a30'); p.rect(2, 2, 3, 3, '#d8402f'); p.rect(6, 5, 2, 3, '#f2c200'); p.rect(3, 6, 2, 2, '#5f8a3c'); });
      l.bloque(m, [-5, 0, -5, 5, 8, 5], { lados: tabla, arriba: tapa, abajo: null });
    }).lista.push(o);
    else if (o.tipo === 'valla') suelta('valla', (l, m) => {
      const rayas = una('valla', 16, 3, (p) => { for (let x = 0; x < 16; x++) for (let y = 0; y < 3; y++) p.punto(x, y, ((x + y) >> 1) % 2 ? '#d8402f' : '#f4f0e6'); }, 0, 0.3);
      l.bloque(m, [-8, 5, -0.5, 8, 8, 0.5], { lados: rayas, arriba: liso('#f4f0e6'), abajo: liso('#8f8a7e') });
      l.bloque(m, [-8, 2, -0.5, 8, 3, 0.5], { lados: liso('#d8402f'), arriba: liso('#e86a5a'), abajo: null });
      for (const x of [-7, 6]) l.bloque(m, [x, 0, -1.5, x + 1, 8, 1.5], { lados: liso('#55585e'), arriba: liso('#73787c'), abajo: null });
    }).lista.push(o);
    else if (o.tipo === 'banco') suelta('banco', (l, m) => {
      const t = una('banco', 14, 2, (p) => { p.fondo('#3f6a4a'); p.rect(0, 1, 14, 1, '#2f5038'); });
      l.bloque(m, [-7, 3, -2.5, 7, 4, 2.5], { lados: liso('#2f5038'), arriba: una('bancoTapa', 14, 5, (p) => { p.fondo('#3f6a4a'); for (let y = 1; y < 5; y += 2) p.rect(0, y, 14, 1, '#2f5038'); }), abajo: liso('#2a2622') });
      l.bloque(m, [-7, 4, 1.5, 7, 7, 2.5], { lados: t, arriba: liso('#4f7a5a'), abajo: null });
      for (const x of [-6, 5]) l.bloque(m, [x, 0, -2, x + 1, 3, 2], { lados: liso('#2a2622'), arriba: null, abajo: null });
    }).lista.push(o);
    else if (o.tipo === 'volquete') {
      en(o, P4);
      const c = ['#e0a21e', '#c8402f', '#3f6fa8'][n % 3], chapon = una('volquete' + c, 14, 6, (p) => { p.fondo(c); p.rect(0, 0, 14, 1, tono(c, 0.3)); p.rect(0, 5, 14, 1, tono(c, -0.35)); for (let x = 2; x < 14; x += 4) p.rect(x, 1, 1, 4, tono(c, -0.2)); p.motas('#7a4a34', 9); p.rect(4, 2, 6, 2, '#f4f0e6'); });
      fijos.bloque(M, [-7, 0, -3.5, 7, 5.5, 3.5], { lados: chapon, arriba: una('escombro', 14, 7, (p) => { p.fondo('#6b665e'); p.motas('#8f8a80', 22, 2, 1); p.motas('#4a4640', 18); p.motas('#b5694a', 8, 2, 1); p.motas('#c9c2b0', 6); p.marco(tono(c, -0.2)); }), abajo: null }, null, 1.5, 1.5);
    } else if (o.tipo === 'cantero') {
      en(o, P4);
      fijos.bloque(M, [-4, 0, -4, 4, 2, 4], { lados: una('ladrillo', 8, 2, (p) => { p.fondo('#b5694a'); p.rect(0, 1, 8, 1, '#96553a'); for (let x = 1; x < 8; x += 3) p.punto(x, 0, '#d8a48c'); }), arriba: una('cantero' + n % 3, 8, 8, (p) => { p.fondo('#3f7a34'); p.motas('#2c5f2a', 14); p.motas('#5c9c42', 10); p.motas(['#f2c200', '#e36b9a', '#f4f0e6'][n % 3], 9); p.marco('#96553a'); }), abajo: null });
    } else if (o.tipo === 'monumento') {
      en(o, P4);
      const piedra = una('marmol', 12, 6, (p) => { p.fondo('#c9c4b8'); p.rect(0, 0, 12, 1, '#e3dfd4'); p.rect(0, 5, 12, 1, '#99948a'); p.motas('#b0ab9f', 10); });
      fijos.bloque(M, [-6, 0, -6, 6, 3, 6], { lados: piedra, arriba: liso('#d6d2c6'), abajo: null });
      fijos.bloque(M, [-3.5, 3, -3.5, 3.5, 6, 3.5], { lados: piedra, arriba: liso('#d6d2c6'), abajo: null });
      fijos.bloque(M, [-1.5, 6, -1.5, 1.5, 15, 1.5], { lados: liso('#c9c4b8'), arriba: liso('#e3dfd4'), abajo: null });
      fijos.bloque(M, [-1, 15, -1, 1, 20, 1], { lados: liso('#5a6a5a'), arriba: liso('#7a8a7a'), abajo: null });        // el procer, de bronce
      fijos.bloque(M, [-2, 17, -0.5, 2, 18, 0.5], { lados: liso('#5a6a5a'), arriba: liso('#7a8a7a'), abajo: null });
    } else if (o.tipo === 'colectivo') {
      en(o, P8);
      const [c, c2] = COLECTIVOS[n % COLECTIVOS.length];
      const costado = una('cole' + c, 72, 20, (p) => {
        p.fondo(c); p.rect(0, 0, 72, 9, c2); p.rect(0, 9, 72, 1, '#2a2622'); p.rect(0, 13, 72, 1, c2); p.rect(0, 19, 72, 1, '#2a2622');
        for (let x = 3; x < 68; x += 9) { p.rect(x, 2, 7, 6, VIDRIO[0]); p.rect(x, 2, 7, 1, VIDRIO[1]); p.punto(x + 1, 3, VIDRIO[2]); }
        p.rect(8, 15, 9, 5, '#131316'); p.rect(56, 15, 9, 5, '#131316'); p.rect(30, 14, 12, 4, c2); escribir(p, '60', 32, 14, '#2a2622');
      }, n + 1, 0.4);
      const punta = (frente) => una('cole' + c + (frente ? 'f' : 't'), 20, 20, (p) => { p.fondo(c); p.rect(0, 0, 20, 9, c2); p.rect(2, 2, 16, 6, VIDRIO[0]); p.rect(2, 2, 16, 1, VIDRIO[1]); p.rect(0, 18, 20, 2, '#2a2622'); if (frente) { p.rect(2, 14, 3, 2, '#fff4c2'); p.rect(15, 14, 3, 2, '#fff4c2'); p.rect(7, 13, 6, 4, '#3a3d42'); } else { p.rect(1, 13, 2, 3, '#e0322a'); p.rect(17, 13, 2, 3, '#e0322a'); } }, n + 2, 0.4);
      fijos.bloque(M, [-10, 3, -36, 10, 23, 36], { px: costado, nx: costado, nz: punta(true), pz: punta(false), arriba: una('coleTecho' + c2, 20, 72, (p) => { p.fondo(c2); p.marco(tono(c2, -0.2)); for (let y = 12; y < 72; y += 20) p.rect(6, y, 8, 5, tono(c2, -0.15)); }, 3, 0.4), abajo: liso('#131316') });
      for (const z of [-26, 24]) for (const x of [-10.5, 7.5]) fijos.bloque(M, [x, 0, z - 3, x + 3, 6, z + 3], { lados: liso('#17171a'), arriba: liso('#17171a'), abajo: null });
    } else if (o.tipo === 'farol') {
      en(o, P8);
      const hierro = liso('#3f4348'), s = o.lado > 0 ? -1 : 1;   // el brazo va hacia la calle
      fijos.bloque(M, [-0.5, -2, -0.5, 0.5, 44, 0.5], { lados: hierro, arriba: hierro, abajo: null });
      fijos.bloque(M, [s > 0 ? 0 : -9, 43, -0.5, s > 0 ? 9 : 0, 44, 0.5], { lados: hierro, arriba: hierro, abajo: hierro });
      fijos.bloque(M, [s * 6 - 1.5, 42, -1, s * 6 + 1.5, 43, 1], { lados: liso('#fff4c2'), arriba: hierro, abajo: liso('#fff4c2') });
      faroles.push(o);
      if (luz && luz.faros && clima) { const a = o.rumbo, cx = Math.cos(a) * s * 0.75, cz = Math.sin(a) * s * 0.75; clima.resplandor(o.x + cx, T.altura(o.x + cx, o.z + cz), o.z + cz, 7.5, 0xffc878, 0.04); }
    }
  }

  // --- a la escena ---
  const dibujo = atlas.textura();
  dibujo.generateMipmaps = false; dibujo.minFilter = THREE.NearestFilter;
  const mat = estilo(new THREE.MeshLambertMaterial({ map: dibujo }));
  if (!fijos.vacio()) { const malla = new THREE.Mesh(fijos.geometria(atlas), mat); malla.castShadow = true; malla.receiveShadow = true; escena.add(malla); }
  // los cables: de farol a farol, del mismo lado, si no quedan muy lejos
  const pares = [];
  for (let k = 1; k < faroles.length; k++) { const a = faroles[k - 1], b = faroles[k]; if ((a.lado > 0) === (b.lado > 0) && Math.hypot(a.x - b.x, a.z - b.z) < 46) pares.push([a, b]); }
  if (pares.length) {
    const cables = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), estilo(new THREE.MeshLambertMaterial({ color: 0x26262a })), pares.length * 2);
    pares.forEach(([a, b], k) => {
      for (let h = 0; h < 2; h++) {
        const alto = 5.1 - h * 0.35;
        V.set((a.x + b.x) / 2, (a.y + b.y) / 2 + alto, (a.z + b.z) / 2); E.set(b.x - a.x, b.y - a.y, b.z - a.z);
        const largo = E.length();
        cables.setMatrixAt(k * 2 + h, M.compose(V, Q.setFromUnitVectors(EJE_X, E.normalize()), E.set(largo, 0.04, 0.04)));
      }
    });
    escena.add(cables);
  }
  // las cosas que se pueden tirar: cuando se las choca quedan acostadas
  const mallas = [];
  for (const tipo in sueltas) {
    const { lote, lista } = sueltas[tipo], m = new THREE.InstancedMesh(lote.geometria(atlas), mat, lista.length);
    m.castShadow = true; m.receiveShadow = true;
    escena.add(m); mallas.push({ m, lista });
  }
  function acomodar() {
    for (const { m, lista } of mallas) {
      lista.forEach((o, k) => {
        Q.setFromAxisAngle(ARRIBA, -o.rumbo);
        if (o.roto) Q.multiply(Q2.setFromAxisAngle(EJE_X, o.n % 2 ? 1.5 : -1.5));
        m.setMatrixAt(k, M.compose(V.set(o.x, o.y + (o.roto ? 0.2 : 0), o.z), Q, E.set(1, 1, 1)));
      });
      m.instanceMatrix.needsUpdate = true;
    }
  }
  acomodar();
  return {
    // el auto se llevo puesto algo: se lo tira
    tirar: acomodar,
    // al largar de nuevo, todo vuelve a su lugar
    reiniciar: () => { for (const o of T.objetos) o.roto = false; acomodar(); },
  };
}

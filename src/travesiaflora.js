// Lo que decora el desierto de la Travesia: matas y arbustos secos, piedras negras sueltas (las acacias estan en arboles.js)
// (dibujos planos de pocos pixeles, a 8 por metro, como los de sprites.js) y las medidas de las formaciones de roca grandes
// (torres, hongos, mesas) que se ven al fondo. Los colores son de tierra: apagados, pero calidos.
import * as THREE from '../vendor/three.module.js';
import { crearAtlas } from './pixel.js';

const entero = (p, a, b) => a + Math.floor(p.azar() * (b - a + 1));

// una mata: hojitas finas que salen de abajo, mas altas en el medio (igual que en sprites.js)
function mata(p, tonos, alto) {
  for (let x = 0; x < p.w; x++) {
    const centro = 1 - Math.abs(x - (p.w - 1) / 2) / (p.w / 2), h = Math.max(1, Math.round(alto * (0.35 + 0.65 * centro) * (0.6 + 0.4 * p.azar())));
    if (p.azar() < 0.2) continue;
    const t = entero(p, 0, tonos.length - 1);
    p.rect(x, p.h - h, 1, h, tonos[t]);
    if (h > 2) p.punto(x, p.h - h, tonos[Math.min(tonos.length - 1, t + 1)]);
  }
  p.rect(1, p.h - 1, p.w - 2, 1, tonos[0]);
}
// un arbusto: masa redonda con racimos claros arriba y sombra abajo. hueco: cuanto se deshilacha (0 = entero)
function arbusto(p, tonos, hueco = 0) {
  const w = p.w, h = p.h, cx = (w - 1) / 2;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (x - cx) / (w / 2), dy = (y - h * 0.62) / (h * 0.62), d = dx * dx + dy * dy + (p.azar() - 0.5) * 0.22;
    if (d > 1 || (y === h - 1 && Math.abs(dx) > 0.7) || p.azar() < hueco) continue;
    const luz = (h - y) / h - dx * 0.25 + (p.azar() - 0.5) * 0.3;
    p.punto(x, y, tonos[luz > 0.78 ? 3 : luz > 0.52 ? 2 : luz > 0.28 ? 1 : 0]);
  }
}
// tallos secos con una espiga arriba
function cardoSeco(p) {
  for (let i = 0; i < 3; i++) {
    const x = 1 + i * 2 + (p.azar() < 0.4 ? 1 : 0), alto = Math.round(p.h * (0.6 + 0.4 * p.azar()));
    p.rect(x, p.h - alto, 1, alto, '#8a6d3a');
    p.rect(x, p.h - alto, 1, 2, '#d7b872'); if (p.azar() < 0.6) p.punto(x - 1, p.h - alto + 1, '#b8955a');
  }
  p.rect(1, p.h - 1, p.w - 2, 1, '#6d5430');
}
// piedra negra suelta (el lado de la luz, un poco mas claro)
function piedraNegra(p) {
  const t = ['#171412', '#26211e', '#383029', '#554a40'];
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
    const dx = (x - (p.w - 1) / 2) / (p.w / 2), dy = (y - p.h + 1) / p.h;
    if (dx * dx + dy * dy > 1) continue;
    p.punto(x, y, y === 0 || (x < p.w / 2 && y < p.h / 2) ? t[3] : y >= p.h - 1 ? t[0] : x > p.w * 0.65 ? t[1] : t[2]);
  }
}
// (las acacias chatas ya no son sprites: ahora son de planos cruzados, ver 'acacia' en arboles.js; la mitad de las matas tambien)

const DIBUJOS = {
  mataOcre: [8, 6, (p) => mata(p, ['#7a5a2c', '#a07a3a', '#c29a52', '#dcb870'], 6)],
  pastoOcre: [11, 8, (p) => mata(p, ['#8a6a34', '#b08a46', '#cfa95e', '#e6c982'], 8)],
  arbustoOcre: [14, 9, (p) => arbusto(p, ['#6e5430', '#8f7040', '#b09050', '#cfae68'])],
  arbustoEspina: [12, 9, (p) => arbusto(p, ['#54502f', '#726d3d', '#908a50', '#b0a96c'], 0.22)],
  cardoSeco: [7, 12, cardoSeco],
  piedraNegra: [7, 4, piedraNegra], piedraNegraGrande: [10, 6, piedraNegra],
};
const VERSIONES = 3;

// Todos los dibujos en un atlas, con la forma que pide crearLoteDeSprites (sprites.js).
let hecho = null;
export function crearDibujosDeTravesia() {
  if (hecho) return hecho;
  const atlas = crearAtlas(256, 192), zonas = {};
  for (const nombre in DIBUJOS) {
    const [w, h, pintar] = DIBUJOS[nombre];
    zonas[nombre] = [];
    for (let k = 0; k < VERSIONES; k++) zonas[nombre].push(atlas.zona(w, h, pintar, 71 + k * 19 + nombre.length * 5));
  }
  const textura = atlas.textura();
  textura.generateMipmaps = false; textura.minFilter = THREE.NearestFilter;
  hecho = { atlas, zonas, textura };
  return hecho;
}

// Las formaciones de roca: cada una es una pila de bloques. [ancho, fondo, alto, corrimiento x, corrimiento z, altura de la base], todo
// en pixeles de piedra (cada uno mide la mitad de un metro en estas, porque son enormes y se ven de lejos).
export const FORMACIONES = [
  [[30, 26, 26, 0, 0, 0], [22, 20, 30, 2, -1, 26], [28, 24, 10, -1, 1, 56]],   // torre con el techo mas ancho
  [[14, 12, 30, 0, 0, 0], [40, 34, 12, 0, 0, 30]],                           // hongo
  [[56, 40, 20, 0, 0, 0], [24, 20, 14, 6, -2, 20]],                          // mesa con un bloque encima
  [[16, 14, 50, 0, 0, 0], [12, 10, 14, 1, 0, 50]],                           // aguja
];
export const PIXEL_FORMACION = 0.5;   // metros por pixel de piedra en las formaciones

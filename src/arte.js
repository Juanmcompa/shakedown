// Los dibujos del mundo, pintados de a pixeles: los pisos, los arboles, las piedras y los carteles.
// La escenografia va a 4 pixeles por metro (un pixel = 25 cm); los objetos chicos, a 8.
import * as THREE from '../vendor/three.module.js';
import { crearAtlas, lienzoPintado, textura } from './pixel.js';
import { SUELOS } from './config.js';

export const lienzos = {};   // los dibujos sueltos, para mirarlos mientras se ajustan (el juego no los usa)

const veces = (n, f) => { for (let i = 0; i < n; i++) f(i); };
const entero = (p, a, b) => a + Math.floor(p.azar() * (b - a + 1));   // entero al azar entre a y b
const semillaDe = (txt) => { let h = 7; for (let i = 0; i < txt.length; i++) h = (h * 31 + txt.charCodeAt(i)) >>> 0; return h; };

// mancha de bordes irregulares, de unos "tam" pixeles
function mancha(p, color, tam) {
  const x = entero(p, 1, p.w - tam - 2), y = entero(p, 1, p.h - tam - 2);
  p.rect(x, y, tam, tam - 1, color); p.rect(x + 1, y - 1, tam - 2, tam + 1, color);
}
// piedrita: un pixel claro con su sombra abajo a la derecha
function piedrita(p, claro, sombra) {
  const x = entero(p, 0, p.w - 2), y = entero(p, 0, p.h - 2);
  p.punto(x + 1, y + 1, sombra); p.punto(x, y, claro);
}
// canto rodado: una piedra de 2 o 3 pixeles, con luz arriba y sombra abajo
function canto(p, tonos, sombra) {
  const x = entero(p, 0, p.w - 4), y = entero(p, 0, p.h - 3), w = entero(p, 2, 3), t = entero(p, 0, tonos.length - 2);
  p.rect(x + 1, y + 1, w, 2, sombra); p.rect(x, y, w, 2, tonos[t]); p.punto(x, y, tonos[t + 1]);
}
// grieta: una linea quebrada
function grieta(p, color, largo) {
  let x = entero(p, 4, p.w - 5), y = entero(p, 4, p.h - 5);
  const dx = p.azar() < 0.5 ? 1 : -1, dy = p.azar() < 0.5 ? 1 : -1, acostada = p.azar() < 0.5;
  for (let i = 0; i < largo && x > 0 && y > 0 && x < p.w - 1 && y < p.h - 1; i++) {
    p.punto(x, y, color);
    if ((p.azar() < 0.7) === acostada) x += dx; else y += dy;
  }
}

// --- pisos: un dibujo de 64 x 64 pixeles (16 metros de lado) por cada suelo, que se repite ---
// Cada bioma tiene su pasto, su "manchon" (lo que rompe la monotonia del pasto) y su piso debajo de los arboles.
const PISOS = {
  asfalto: (p) => {   // asfalto
    p.fondo('#46484e');
    veces(9, () => mancha(p, '#4e5158', entero(p, 5, 9)));
    veces(7, () => mancha(p, '#3e4045', entero(p, 4, 7)));
    p.motas('#5f626a', 60); p.motas('#383a3f', 46);
    veces(5, () => grieta(p, '#2b2c30', entero(p, 8, 16)));
  },
  ripio: (p) => {   // ripio
    p.fondo('#d0b88c');
    veces(14, () => mancha(p, '#dac398', entero(p, 4, 7)));
    veces(12, () => mancha(p, '#c4ab7e', entero(p, 4, 6)));
    p.motas('#b89e72', 34);
    veces(44, () => piedrita(p, '#efe0be', '#a38a62'));
    veces(16, () => canto(p, ['#aaa69a', '#c0bcb0', '#d8d4c6'], '#9c8460'));
  },
  tierra: (p) => {   // tierra
    p.fondo('#9c5f3a');
    veces(18, () => mancha(p, '#8b5232', entero(p, 4, 7)));
    veces(10, () => mancha(p, '#a96a43', entero(p, 3, 5)));
    veces(12, () => grieta(p, '#74432a', entero(p, 3, 6)));
    p.motas('#74432a', 36); p.motas('#b77a50', 30);
    veces(10, () => piedrita(p, '#cfae88', '#6b3d26'));
  },
  roca: (p) => {   // roca: lajas con un borde claro arriba y a la izquierda y uno oscuro abajo y a la derecha
    p.fondo('#9a958c');   // (clara: el camino de roca tiene que distinguirse del pedregal que lo rodea)
    veces(16, (i) => {
      const w = entero(p, 7, 15), h = entero(p, 5, 11), x = entero(p, 0, p.w - w), y = entero(p, 0, p.h - h);
      p.rect(x, y, w, h, i % 2 ? '#a6a198' : '#8e897f');
      p.rect(x, y, w, 1, '#bcb7ac'); p.rect(x, y, 1, h, '#b2ada2'); p.rect(x, y + h - 1, w, 1, '#75716a'); p.rect(x + w - 1, y, 1, h, '#7b7770');
    });
    veces(7, () => grieta(p, '#5c5953', entero(p, 6, 14)));
    p.motas('#c6c1b5', 24); p.motas('#7a766f', 30); p.motas('#8f9a58', 6, 2, 1);
  },
  pasto: (p) => {   // pasto
    p.fondo('#4e8a3a');
    veces(20, () => mancha(p, '#478136', entero(p, 4, 8)));
    veces(8, () => mancha(p, '#57953f', entero(p, 4, 6)));
    p.motas('#3c7230', 70, 1, 2); p.motas('#356a2c', 30);     // matas oscuras
    p.motas('#66a546', 60, 1, 2); p.motas('#80ba52', 18);     // briznas claras
    p.motas('#ead451', 4); p.motas('#f1efe0', 3);             // florcitas
  },
  barro: (p) => {   // barro
    p.fondo('#6e3c24');
    veces(22, () => mancha(p, '#5c311d', entero(p, 4, 8)));
    veces(9, () => mancha(p, '#7c4629', entero(p, 3, 6)));
    p.motas('#482518', 40);
    p.motas('#96603e', 26, 2, 1); p.motas('#b98558', 8);      // brillo del barro mojado
  },
  pantano: (p) => {   // pantano: barro aguado, claro, para que no se confunda con una sombra
    p.fondo('#9a8560');
    veces(12, () => mancha(p, '#a48f69', entero(p, 5, 9)));
    veces(8, () => mancha(p, '#8a7652', entero(p, 4, 6)));
    p.motas('#b9a57f', 26, 4, 1); p.motas('#cdbb96', 12, 2, 1);   // reflejos
    p.motas('#6b5a3c', 26); p.motas('#7b8a4b', 10, 2, 1);         // hojas y lama
  },
  lecho: (p) => {   // lecho del rio: cantos rodados
    p.fondo('#84806c');
    veces(170, () => canto(p, ['#6f6b5a', '#8f8b77', '#a6a28d', '#bcb8a3'], '#5c594b'));
    p.motas('#5c594b', 40);
  },
  vereda: (p) => {   // vereda: baldosas de cemento, de a 50 cm, con alguna rota
    p.fondo('#b3aea2');
    for (let y = 0; y < p.h; y += 2) p.rect(0, y, p.w, 1, '#aaa598');
    for (let x = 0; x < p.w; x += 2) p.rect(x, 0, 1, p.h, '#a8a396');
    veces(22, () => mancha(p, '#bdb8ac', entero(p, 3, 5)));
    veces(14, () => mancha(p, '#9f9a8e', entero(p, 3, 4)));
    p.motas('#8d887c', 30); p.motas('#c9c4b8', 30); veces(5, () => grieta(p, '#6e6a60', entero(p, 4, 9)));
    p.motas('#7f8f52', 8, 2, 1);   // yuyitos en las juntas
  },
  adoquin: (p) => {   // adoquines: piedras de 25 x 50 cm trabadas, cada una con su tono
    p.fondo('#5f5b55');
    const tonos = ['#77726a', '#807b72', '#6e6962', '#8a857b', '#726d66'];
    for (let y = 0; y < p.h; y++) for (let x = (y % 2) - 1; x < p.w; x += 2) {
      const t = tonos[entero(p, 0, tonos.length - 1)];
      p.rect(x, y, 2, 1, t);
      if (p.azar() < 0.3) p.punto(x, y, '#989388');
    }
    for (let y = 0; y < p.h; y += 1) if (p.azar() < 0.2) p.rect(entero(p, 0, p.w - 6), y, entero(p, 3, 6), 1, '#5a5650');
    p.motas('#4d4a45', 40); p.motas('#a39e92', 14);
  },
  madera: (p) => {   // tablones de puente, atravesados, con clavos y alguno mas nuevo
    const tonos = ['#8a6f52', '#7d6449', '#96795a', '#735b42'];
    for (let y = 0; y < p.h; y += 2) {
      const t = tonos[entero(p, 0, tonos.length - 1)];
      p.rect(0, y, p.w, 2, t); p.rect(0, y + 1, p.w, 1, '#5e4a36');
      veces(5, () => p.punto(entero(p, 0, p.w - 1), y, '#a88c6a'));
      veces(2, () => p.punto(entero(p, 0, p.w - 1), y, '#3f3226'));
    }
    p.motas('#5e4a36', 30, 3, 1);
  },
  monteCampo: (p) => {   // monte: el piso sombreado debajo de los arboles, con hojas secas
    p.fondo('#3f6f33');
    veces(18, () => mancha(p, '#376430', entero(p, 4, 8)));
    veces(8, () => mancha(p, '#467a37', entero(p, 3, 6)));
    p.motas('#2e562b', 60, 1, 2); p.motas('#538a3d', 30, 1, 2);
    p.motas('#6b5a34', 34); p.motas('#8a7240', 12, 2, 1); p.motas('#27482a', 24);
  },
  pared: (p) => {   // pared: bancos de roca apilados, cada uno con luz arriba y sombra abajo, partidos en bloques
    const tonos = ['#6f6b65', '#7b7770', '#86817a', '#918c83'];
    let y = 0, t = 0;
    while (y < p.h) {
      const alto = Math.min(p.h - y, entero(p, 3, 7));
      t = (t + entero(p, 1, 3)) % tonos.length;
      p.rect(0, y, p.w, alto, tonos[t]);
      p.rect(0, y, p.w, 1, '#a5a096');                     // canto de arriba, con luz
      if (alto > 2) p.rect(0, y + alto - 1, p.w, 1, '#55524d');   // sombra del banco de arriba
      for (let x = entero(p, 2, 9); x < p.w; x += entero(p, 5, 14)) {   // juntas verticales
        p.rect(x, y + 1, 1, Math.max(1, alto - 2), '#5d5a55');
        if (x + 1 < p.w) p.rect(x + 1, y + 1, 1, Math.max(1, alto - 2), '#99948a');
      }
      veces(3, () => p.punto(entero(p, 0, p.w - 1), y + entero(p, 1, Math.max(1, alto - 2)), '#aaa59b'));
      if (p.azar() < 0.3) p.rect(entero(p, 0, p.w - 4), y, entero(p, 2, 3), 1, '#8f9a58');   // musgo sobre el canto
      y += alto;
    }
    p.motas('#64615b', 26);
  },
  charco: (p) => {   // charco: agua turbia que refleja el cielo
    p.fondo('#6f7f86');
    veces(14, () => mancha(p, '#7c8f94', entero(p, 5, 9)));
    veces(10, () => mancha(p, '#62727a', entero(p, 4, 7)));
    p.motas('#a9bcc0', 22, 4, 1); p.motas('#cfdcdc', 9, 2, 1);   // reflejos
    p.motas('#55534a', 18); p.motas('#7d6a50', 14, 2, 1);        // barro que asoma
  },
  pinocha: (p) => {   // piso del bosque: musgo, pinocha y ramitas
    p.fondo('#4a6b34');
    veces(18, () => mancha(p, '#3f5f30', entero(p, 4, 8)));
    veces(12, () => mancha(p, '#587a3a', entero(p, 3, 6)));
    veces(9, () => mancha(p, '#6b5a34', entero(p, 3, 6)));       // manchones de pinocha
    p.motas('#33502b', 50, 1, 2); p.motas('#6f9344', 34, 1, 2);
    p.motas('#8a7240', 40, 2, 1); p.motas('#a88a52', 14, 3, 1); p.motas('#5a4426', 20, 1, 2);   // agujas y ramitas
    p.motas('#d9c8a0', 4);
  },
  pastoSeco: (p) => {   // estepa: pasto amarillento y tierra pelada
    p.fondo('#948a50');
    veces(18, () => mancha(p, '#857c46', entero(p, 4, 8)));
    veces(12, () => mancha(p, '#a3985a', entero(p, 3, 6)));
    veces(7, () => mancha(p, '#a08a66', entero(p, 3, 5)));       // tierra pelada
    p.motas('#766c38', 60, 1, 2); p.motas('#c4b869', 44, 1, 2); p.motas('#d8cd80', 12);
    veces(10, () => piedrita(p, '#cbbf9a', '#6e6440'));
  },
  manchonBosque: (p) => {   // claro de tierra y hojas secas
    p.fondo('#6f5a3a');
    veces(16, () => mancha(p, '#5f4c30', entero(p, 4, 7)));
    veces(10, () => mancha(p, '#806a45', entero(p, 3, 6)));
    p.motas('#4a3a24', 40); p.motas('#9a8255', 30, 2, 1); p.motas('#b5472a', 14); p.motas('#d8702f', 8); p.motas('#4f7038', 26, 1, 2);
  },
  manchonCampo: (p) => {   // pasto mas alto y oscuro, con flores
    p.fondo('#3f7a34');
    veces(18, () => mancha(p, '#376f30', entero(p, 4, 8)));
    veces(10, () => mancha(p, '#4a8a3a', entero(p, 3, 6)));
    p.motas('#2c5f2a', 70, 1, 2); p.motas('#5c9c42', 46, 1, 2);
    p.motas('#f2c200', 12); p.motas('#ffffff', 9); p.motas('#c08ae0', 6);
  },
  manchonMontana: (p) => {   // pedregullo
    p.fondo('#a59a82');
    veces(14, () => mancha(p, '#978c74', entero(p, 4, 7)));
    veces(40, () => canto(p, ['#8a8478', '#a39d90', '#bdb7a8'], '#6e6858'));
    p.motas('#7a705c', 40); p.motas('#c4b869', 16, 1, 2);
  },
  monteBosque: (p) => {   // debajo de los pinos: pinocha en sombra
    p.fondo('#4f4a2c');
    veces(18, () => mancha(p, '#433f26', entero(p, 4, 8)));
    veces(10, () => mancha(p, '#3a5230', entero(p, 3, 6)));
    p.motas('#6b5a34', 50, 2, 1); p.motas('#2f3a22', 40, 1, 2); p.motas('#8a7240', 14, 2, 1);
  },
  monteMontana: (p) => {   // debajo de los arboles, en lo seco
    p.fondo('#6b6438');
    veces(16, () => mancha(p, '#5c5630', entero(p, 4, 8)));
    p.motas('#4a4526', 50, 1, 2); p.motas('#857c46', 30, 1, 2); p.motas('#3f5a30', 16);
  },
  // la banquina: la franja pisada entre el camino y el pasto
  banquinaBosque: (p) => {
    p.fondo('#5d5136');
    veces(16, () => mancha(p, '#524830', entero(p, 4, 8)));
    veces(10, () => mancha(p, '#6a5c3e', entero(p, 3, 6)));
    p.motas('#3f4a2c', 40, 1, 2); p.motas('#7d6c48', 24, 2, 1); veces(8, () => piedrita(p, '#9a8c6c', '#3e3626'));
  },
  banquinaCampo: (p) => {
    p.fondo('#6f7440');
    veces(16, () => mancha(p, '#64693a', entero(p, 4, 8)));
    veces(10, () => mancha(p, '#7d7e48', entero(p, 3, 6)));
    p.motas('#4f5a30', 44, 1, 2); p.motas('#8f8a55', 22, 2, 1); veces(8, () => piedrita(p, '#a89f78', '#4a4a2c'));
  },
  banquinaMontana: (p) => {
    p.fondo('#6c644e');
    veces(16, () => mancha(p, '#615945', entero(p, 4, 8)));
    veces(10, () => mancha(p, '#787058', entero(p, 3, 6)));
    p.motas('#4f4837', 40); veces(26, () => canto(p, ['#6e695e', '#868074', '#9e988b'], '#4a4435'));
  },
  // lo sembrado, en surcos
  trigo: (p) => {
    p.fondo('#c2a654');
    for (let y = 0; y < p.h; y += 4) { p.rect(0, y, p.w, 1, '#a88c40'); p.rect(0, y + 1, p.w, 1, '#d2b866'); }
    p.motas('#dcc478', 60, 2, 1); p.motas('#9a7e36', 40, 2, 1);
  },
  arado: (p) => {
    p.fondo('#6a4a34');
    for (let y = 0; y < p.h; y += 4) { p.rect(0, y, p.w, 2, '#553a28'); p.rect(0, y + 2, p.w, 1, '#7c5a40'); }
    p.motas('#8a684a', 40, 2, 1); p.motas('#45301f', 34, 2, 1);
  },
  girasol: (p) => {
    p.fondo('#4c6a34');
    for (let y = 0; y < p.h; y += 4) p.rect(0, y, p.w, 1, '#3c5a2c');
    for (let y = 1; y < p.h; y += 4) for (let x = (y >> 2) % 2; x < p.w; x += 3) if (p.azar() < 0.8) p.punto(x, y, p.azar() < 0.8 ? '#d9b233' : '#b8922a');
  },
  soja: (p) => {
    p.fondo('#4f7038');
    for (let y = 0; y < p.h; y += 3) p.rect(0, y, p.w, 1, '#3f5f30');
    p.motas('#5e8042', 80, 2, 1); p.motas('#36522a', 30, 2, 1);
  },
  // la Travesia: arena rayada por el viento (rizos que corren de lado a lado) y fesh-fesh, arena en polvo mas clara y lisa
  arena: (p) => {
    p.fondo('#d2b783');
    veces(16, () => mancha(p, '#c9ad78', entero(p, 4, 8)));
    veces(12, () => mancha(p, '#dcc593', entero(p, 3, 6)));
    for (let y = 2; y < p.h; y += 5 + (y >> 4)) { const x = entero(p, 0, p.w - 14), l = entero(p, 8, 22); p.rect(x, y, l, 1, '#bfa36e'); p.rect(x + 2, y + 1, l - 3, 1, '#e4cfa0'); }
    p.motas('#b99d68', 36); p.motas('#e8d6ab', 40, 2, 1); p.motas('#a98f5e', 12);
  },
  feshfesh: (p) => {
    p.fondo('#e2cf9f');
    veces(14, () => mancha(p, '#d9c492', entero(p, 5, 9)));
    veces(10, () => mancha(p, '#ebdcb4', entero(p, 4, 7)));
    p.motas('#f2e6c4', 54, 2, 1); p.motas('#cdb780', 30, 3, 1); p.motas('#bca56f', 10);
  },
};
// que dibujos usa cada bioma para el pasto, el manchon, el piso de abajo de los arboles y la banquina
const NATURAL = {
  pinocha: ['pinocha', 'manchonBosque', 'monteBosque', 'banquinaBosque'],
  pasto: ['pasto', 'manchonCampo', 'monteCampo', 'banquinaCampo'],
  pastoSeco: ['pastoSeco', 'manchonMontana', 'monteMontana', 'banquinaMontana'],
};
// En que capa de la textura queda cada cosa: primero los suelos, en el orden de config.js, y despues estas.
// Los sembrados van en SEMBRADO + 1 (trigo), + 2 (tierra arada), + 3 (girasol) y + 4 (soja).
const NOMBRES_DE_SUELO = Object.keys(SUELOS), CUANTOS = NOMBRES_DE_SUELO.length;
export const MONTE = CUANTOS, PARED = CUANTOS + 1, MANCHON = CUANTOS + 2, BANQUINA = CUANTOS + 3, SEMBRADO = CUANTOS + 3;

// En que capas quedan el pasto, el manchon, el piso de abajo de los arboles y la banquina del ambiente numero k de una pista
// (el 0 es el de la etapa; los demas, si la pista pasa por varios, van al final de la textura, de a cuatro capas).
const CAPAS_BASE = CUANTOS + 8;
export const capasNaturales = (k) => (k === 0 ? { pasto: SUELOS.pasto.id, manchon: MANCHON, monte: MONTE, banquina: BANQUINA } : { pasto: CAPAS_BASE + (k - 1) * 4, manchon: CAPAS_BASE + (k - 1) * 4 + 1, monte: CAPAS_BASE + (k - 1) * 4 + 2, banquina: CAPAS_BASE + (k - 1) * 4 + 3 });

// Todos los pisos en una sola textura de varias capas. "pisos" son los pastos de los ambientes de la pista
// (pinocha, pasto o pastoSeco): uno solo, o una lista si pasa por varios.
export function texturaDePisos(pisos) {
  const lista = Array.isArray(pisos) ? pisos : [pisos], [pasto, manchon, monte, banquina] = NATURAL[lista[0]] || NATURAL.pasto;
  const capas = [...NOMBRES_DE_SUELO.map((n) => (n === 'pasto' ? pasto : n)), monte, 'pared', manchon, banquina, 'trigo', 'arado', 'girasol', 'soja'];
  for (const otro of lista.slice(1)) { const [p2, m2, mo2, b2] = NATURAL[otro] || NATURAL.pasto; capas.push(p2, m2, mo2, b2); }
  const M = 64, datos = new Uint8Array(M * M * 4 * capas.length);
  capas.forEach((nombre, i) => {
    const l = lienzoPintado(M, M, PISOS[nombre], 100 + i);
    lienzos['piso-' + nombre] = l;
    datos.set(l.getContext('2d').getImageData(0, 0, M, M).data, i * M * M * 4);
  });
  const t = new THREE.DataArrayTexture(datos, M, M, capas.length);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

// --- arboles y piedras ---
// cinco tonos por follaje, de oscuro a claro
const HOJAS = {
  pino: ['#16382a', '#1f4a33', '#2a5f3c', '#3a7848', '#559458'],
  pinoAlto: ['#1a3b24', '#24502c', '#316837', '#43823f', '#5f9d4c'],
  lenga: ['#7a2418', '#a83a1e', '#cf5a22', '#e8862c', '#f6b545'],      // otoño: del rojo al naranja
  nire: ['#8a5a14', '#b9801c', '#dba526', '#f0c43a', '#fbe06a'],       // otoño: amarillo
  alamo: ['#3d6a24', '#55872c', '#73a336', '#96bf45', '#bcd75e'],
  eucalipto: ['#33503f', '#46695a', '#5c8272', '#7a9d8a', '#a0bba8'],
  araucaria: ['#12302a', '#1a4034', '#24523f', '#33684c', '#4b825c'],
};
const CORTEZAS = { araucaria: ['#5a5148', '#463e37', '#756a5e'], pino: ['#5c4130', '#473021', '#75573f'], lenga: ['#4a3a34', '#382a26', '#63504a'], alamo: ['#b9b3a2', '#8f8a7c', '#d6d1c2'], eucalipto: ['#c2b59c', '#9a8d76', '#ded3bd'] };
const ROCA = ['#55524d', '#6c6862', '#86817a', '#9f9a90', '#b8b3a8'];

// la copa vista de arriba: racimos de hojas claras con su sombra, y el borde desparejo
function copaDeArriba(p, h) {
  const n = p.w;
  p.fondo(h[2]);
  veces(Math.round(n * n / 9), () => {
    const x = entero(p, 0, n - 3), y = entero(p, 0, n - 3), t = entero(p, 1, 2);
    p.rect(x + 1, y + 1, t, t, h[1]); p.rect(x, y, t, t, h[3]);
    if (p.azar() < 0.45) p.punto(x, y, h[4]);
  });
  p.motas(h[1], Math.round(n * n / 14));
  for (let i = 0; i < n; i++) {
    if (p.azar() < 0.5) p.punto(i, 0, h[1]);
    if (p.azar() < 0.5) p.punto(0, i, h[1]);
    if (p.azar() < 0.7) p.punto(i, n - 1, h[1]);
    if (p.azar() < 0.7) p.punto(n - 1, i, h[1]);
  }
}
// un piso de pino visto de arriba: ramas que salen del centro, mas claras hacia las puntas
function pinoDeArriba(p, h) {
  const n = p.w, c = (n - 1) / 2;
  p.fondo(h[1]);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const dx = Math.abs(x - c), dy = Math.abs(y - c), d = Math.max(dx, dy) / (n / 2), rama = Math.min(dx, dy) < 0.8 || Math.abs(dx - dy) < 0.8;
    const t = (rama ? 2 : 1) + (d > 0.55 ? 1 : 0) + (p.azar() < 0.18 ? 1 : 0) - (p.azar() < 0.2 ? 1 : 0);
    p.punto(x, y, h[Math.max(0, Math.min(4, t))]);
  }
  p.rect(Math.floor(c), Math.floor(c), n % 2 ? 1 : 2, n % 2 ? 1 : 2, h[0]);
}
// la copa vista de costado: clara arriba, donde le da la luz, y oscura abajo
function copaDeCostado(p, h) {
  const a = p.h;
  p.fondo(h[2]);
  p.rect(0, 0, p.w, 1, h[3]);
  p.rect(0, a - 2, p.w, 2, h[1]);
  veces(Math.round(p.w * a / 12), () => {
    const x = entero(p, 0, p.w - 3), y = entero(p, 1, Math.max(1, a - 4));
    p.rect(x + 1, y + 1, 2, 1, h[1]); p.rect(x, y, 2, 1, h[3]);
  });
  p.motas(h[1], Math.round(p.w * a / 16));
  for (let x = 0; x < p.w; x++) {
    if (p.azar() < 0.35) p.punto(x, 0, h[4]);
    if (p.azar() < 0.4) p.punto(x, 1, h[3]);
    if (p.azar() < 0.4) p.punto(x, a - 3, h[1]);
    if (p.azar() < 0.55) p.punto(x, a - 1, h[0]);
  }
}
// un piso de pino visto de costado: agujas que cuelgan, con el borde de abajo en flecos
function pinoDeCostado(p, h) {
  const a = p.h;
  p.fondo(h[1]);
  p.rect(0, 0, p.w, 1, h[3]);
  for (let x = 0; x < p.w; x++) {
    const largo = entero(p, 1, Math.max(1, a - 1));
    p.rect(x, 0, 1, largo, x % 3 === 0 ? h[2] : x % 3 === 1 ? h[1] : h[2]);
    if (p.azar() < 0.4) p.punto(x, 0, h[4]);
    if (p.azar() < 0.5) p.punto(x, Math.min(a - 1, largo), h[0]);
  }
  p.rect(0, a - 1, p.w, 1, h[0]);
}
function piedraDeArriba(p) {
  p.fondo(ROCA[2]);
  p.rect(0, 0, p.w, 1, ROCA[3]); p.rect(0, 0, 1, p.h, ROCA[3]); p.rect(0, p.h - 1, p.w, 1, ROCA[1]); p.rect(p.w - 1, 0, 1, p.h, ROCA[1]);
  p.punto(0, 0, ROCA[4]);
  veces(Math.max(1, Math.round(p.w * p.h / 24)), () => grieta(p, ROCA[1], entero(p, 2, 4)));
  p.motas(ROCA[3], Math.round(p.w * p.h / 12)); p.motas(ROCA[1], Math.round(p.w * p.h / 16));
  if (p.w > 5) p.motas('#8f9a58', 2);
}
function piedraDeCostado(p) {
  p.fondo(ROCA[1]);
  p.rect(0, 0, p.w, 1, ROCA[2]); p.rect(0, p.h - 1, p.w, 1, ROCA[0]);
  p.motas(ROCA[0], Math.round(p.w * p.h / 10), 3, 1); p.motas(ROCA[2], Math.round(p.w * p.h / 12), 2, 1);
}

// letras de 3 x 5 pixeles para los carteles
const LETRAS = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111', G: '011100101101011', H: '101101111101101',
  I: '111010010010111', K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '101111111111101', O: '010101101101010', R: '110101110101101',
  S: '011100010001110', T: '111010010010010', W: '101101111111101', ' ': '000000000000000',
  F: '111100110100100', J: '001001001101010', P: '110101110100100', Q: '010101101110011', U: '101101101101111', V: '101101101101010', X: '101101010101101', Y: '101101010010010', Z: '111001010100111',
  6: '011100110101010', 7: '111001010010010', 8: '010101010101010', 9: '010101011001110',
  0: '111101101101111', 1: '010110010010111', 2: '110001010100111', 3: '110001010001110', 4: '101101111001001', 5: '111100110001110', '#': '101111101111101', '!': '010010010000010',
};
export function escribir(p, texto, x, y, color) {
  for (const letra of texto) {
    const d = LETRAS[letra] || LETRAS[' '];
    for (let i = 0; i < 15; i++) if (d[i] === '1') p.punto(x + i % 3, y + Math.floor(i / 3), color);
    x += 4;
  }
}

// Un atlas con todos los dibujos de la escenografia. Cada dibujo se pinta la primera vez que se pide.
export function crearEscenografia() {
  const atlas = crearAtlas(512, 256), hechas = {};
  const una = (clave, w, h, pintar) => hechas[clave] || (hechas[clave] = atlas.zona(w, h, pintar, semillaDe(clave)));
  lienzos.escenografia = atlas.lienzo;
  const pino = (tipo) => tipo === 'pino' || tipo === 'pinoAlto' || tipo === 'araucaria';
  return {
    atlas,
    copa: (tipo, lado) => una('copa' + tipo + 'x' + lado, lado, lado, (p) => (pino(tipo) ? pinoDeArriba : copaDeArriba)(p, HOJAS[tipo])),
    follaje: (tipo, alto) => una('follaje' + tipo + 'x' + alto, 32, alto, (p) => (pino(tipo) ? pinoDeCostado : copaDeCostado)(p, HOJAS[tipo])),
    debajo: (tipo) => una('debajo' + tipo, 8, 8, (p) => { p.fondo(HOJAS[tipo][0]); p.motas(HOJAS[tipo][1], 12); }),
    corteza: (tipo) => una('corteza' + tipo, 8, 24, (p) => {
      const c = CORTEZAS[tipo] || CORTEZAS[pino(tipo) ? 'pino' : 'lenga'];
      p.fondo(c[0]);
      for (const x of [1, 4, 6]) for (let y = 0; y < p.h; y++) if (p.azar() < 0.75) p.punto(x, y, c[1]);
      p.motas(c[2], 14, 1, 2);
    }),
    piedra: (w, d) => una('piedra' + w + 'x' + d, w, d, piedraDeArriba),
    canto: (alto) => una('canto' + alto, 32, alto, piedraDeCostado),
    // mojon: poste blanco con una banda roja (a 8 pixeles por metro)
    mojon: () => una('mojon', 2, 10, (p) => { p.fondo('#efece2'); p.rect(0, 1, 2, 2, '#d23a2c'); p.rect(0, 0, 2, 1, '#fbf9f2'); p.rect(1, 3, 1, 7, '#d6d2c6'); p.rect(0, 9, 2, 1, '#a7a398'); }),
    liso: (color) => atlas.liso(color),
    // poste de alambrado: madera gastada
    poste: () => una('poste', 2, 10, (p) => { p.fondo('#8a6f52'); p.rect(1, 0, 1, 10, '#6b543c'); p.rect(0, 0, 2, 1, '#b39a78'); p.punto(0, 4, '#5a4632'); p.punto(0, 7, '#a08464'); }),
    // la cinta del publico: rayas rojas y blancas
    cinta: (largo) => una('cinta' + largo, largo, 1, (p) => { for (let x = 0; x < largo; x++) p.punto(x, 0, (x >> 1) % 2 ? '#f4f0e6' : '#d8402f'); }),
    estaca: () => una('estaca', 1, 8, (p) => { p.fondo('#e9e4d6'); p.rect(0, 0, 1, 2, '#d8402f'); p.rect(0, 4, 1, 2, '#d8402f'); }),
    // carteles de curva: flechas negras sobre amarillo (o blancas sobre rojo en las horquillas), de 16 x 8
    flecha: (lado) => una('flecha' + lado, 16, 8, (p) => {
      p.fondo('#f2c200'); p.marco('#1b1b1d');
      for (const x0 of [3, 8]) for (let k = 0; k < 3; k++) {
        const x = lado === 'der' ? x0 + k : x0 + 4 - k;
        p.rect(x, 1 + k, 2, 1, '#1b1b1d'); p.rect(x, 6 - k, 2, 1, '#1b1b1d');
      }
    }),
    // cartel de cuidado: un signo de admiracion
    ojo: () => una('ojo', 8, 8, (p) => { p.fondo('#f2c200'); p.marco('#1b1b1d'); p.rect(3, 1, 2, 4, '#1b1b1d'); p.rect(3, 6, 2, 1, '#1b1b1d'); }),
    dorso: () => una('dorso', 8, 8, (p) => { p.fondo('#8f9aa3'); p.marco('#6b757d'); p.rect(3, 0, 2, 8, '#6b757d'); }),
    // la tela de un arco: un fondo de color con algo escrito en letras de pixeles
    tela: (texto, ancho, fondo, letra, borde) => una('tela' + texto + ancho + fondo, ancho, 9, (p) => {
      p.fondo(fondo); p.rect(0, 0, ancho, 1, borde); p.rect(0, 8, ancho, 1, borde);
      escribir(p, texto, Math.round((ancho - texto.length * 4 + 1) / 2), 2, letra);
    }),
    cuadros: (ancho) => una('cuadros' + ancho, ancho, 9, (p) => { for (let x = 0; x < ancho; x++) for (let y = 0; y < 9; y++) p.punto(x, y, ((x >> 1) + ((y + 1) >> 1)) % 2 ? '#111111' : '#ffffff'); }),
    rayas: (ancho, a, b) => una('rayas' + ancho + a, ancho, 4, (p) => { for (let x = 0; x < ancho; x++) for (let y = 0; y < 4; y++) p.punto(x, y, ((x + y) >> 1) % 2 ? a : b); }),
    // banderin: un triangulo de color (lo que no es bandera queda transparente)
    banderin: (color) => una('banderin' + color, 3, 4, (p) => { p.rect(0, 0, 3, 1, color); p.rect(0, 1, 3, 1, color); p.rect(1, 2, 1, 2, color); p.punto(0, 2, color); p.punto(2, 2, color); }),
    // fardo de pasto: redondo, atado con dos hilos
    fardo: () => una('fardo', 12, 10, (p) => { p.fondo('#c9a646'); p.motas('#b08c36', 30, 2, 1); p.motas('#e2c462', 26, 2, 1); p.rect(3, 0, 1, 10, '#7a5a2a'); p.rect(8, 0, 1, 10, '#7a5a2a'); p.rect(0, 9, 12, 1, '#8f7230'); }),
    // el molino de viento: la torre de hierros cruzados, la rueda de aspas y la cola
    torre: (ancho, alto) => una('torre' + ancho + 'x' + alto, ancho, alto, (p) => {
      p.rect(0, 0, 1, alto, '#8f9499'); p.rect(ancho - 1, 0, 1, alto, '#6f7479');
      for (let y = 0; y < alto; y += ancho) { p.rect(0, y, ancho, 1, '#7d8287'); for (let k = 1; k < ancho - 1; k++) p.punto(k, y + 1 + (k % (ancho - 1)), '#9aa0a5'); }
    }),
    aspas: () => una('aspas', 27, 27, (p) => {
      for (let y = 0; y < 27; y++) for (let x = 0; x < 27; x++) {
        const dx = x - 13, dy = y - 13, d = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
        if (d > 13.4 || d < 1.2) continue;
        if (d < 3 || (d > 4 && Math.floor((a + Math.PI) / (Math.PI / 9)) % 2 === 0)) p.punto(x, y, d > 11.5 ? '#c9ced2' : (dx + dy) % 3 ? '#a9aeb3' : '#8f9499');
      }
    }),
    chapa: (alto) => una('chapa' + alto, 32, alto, (p) => { p.fondo('#8a8f93'); for (let x = 0; x < 32; x += 2) p.rect(x, 0, 1, alto, '#73787c'); p.rect(0, 0, 32, 1, '#b0b5b8'); p.motas('#7a5a40', 8); }),
    aguaQuieta: (lado) => una('aguaQuieta' + lado, lado, lado, (p) => { p.fondo('#8f9aa0'); p.rect(1, 1, lado - 2, lado - 2, '#4f7f86'); p.motas('#6f9aa0', lado, 3, 1); p.motas('#3f6a72', lado, 2, 1); }),
    tapaDeFardo: () => una('tapaDeFardo', 10, 10, (p) => { p.fondo('#d6b552'); for (let r = 1; r < 5; r += 2) p.marco('#b08c36'); p.rect(2, 2, 6, 6, '#c9a646'); p.rect(4, 4, 2, 2, '#b08c36'); p.motas('#e8cf78', 10); }),
  };
}

// cascotes y tierra que salta: un cubito con dos tonos
export const granito = () => textura(4, 4, (p) => { p.fondo('#ffffff'); p.rect(0, 3, 4, 1, '#b9b9b9'); p.rect(3, 0, 1, 4, '#cfcfcf'); p.punto(1, 1, '#dddddd'); });

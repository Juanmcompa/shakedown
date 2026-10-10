// Los dibujos del mundo, pintados de a pixeles: los pisos, los arboles, las piedras y los carteles.
// La escenografia va a 4 pixeles por metro (un pixel = 25 cm); los objetos chicos, a 8.
import * as THREE from 'three';
import { crearAtlas, lienzoPintado, textura } from './pixel.js';

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
// El orden es el de los suelos en config.js; el ultimo (monte) es el piso debajo de los arboles.
export const MONTE = 9, PARED = 10;   // PARED: la roca cuando se la ve de costado, en un paredon
const PISOS = [
  (p) => {   // asfalto
    p.fondo('#46484e');
    veces(9, () => mancha(p, '#4e5158', entero(p, 5, 9)));
    veces(7, () => mancha(p, '#3e4045', entero(p, 4, 7)));
    p.motas('#5f626a', 60); p.motas('#383a3f', 46);
    veces(5, () => grieta(p, '#2b2c30', entero(p, 8, 16)));
  },
  (p) => {   // ripio
    p.fondo('#bda57c');
    veces(14, () => mancha(p, '#c8b189', entero(p, 4, 7)));
    veces(12, () => mancha(p, '#b0976e', entero(p, 4, 6)));
    p.motas('#a58c64', 50);
    veces(70, () => piedrita(p, '#e3d4b2', '#917a57'));
    veces(22, () => canto(p, ['#9c988d', '#b5b1a5', '#cfcbbd'], '#8c7450'));
  },
  (p) => {   // tierra
    p.fondo('#9c5f3a');
    veces(18, () => mancha(p, '#8b5232', entero(p, 4, 7)));
    veces(10, () => mancha(p, '#a96a43', entero(p, 3, 5)));
    veces(12, () => grieta(p, '#74432a', entero(p, 3, 6)));
    p.motas('#74432a', 36); p.motas('#b77a50', 30);
    veces(10, () => piedrita(p, '#cfae88', '#6b3d26'));
  },
  (p) => {   // roca: lajas con un borde claro arriba y a la izquierda y uno oscuro abajo y a la derecha
    p.fondo('#87827a');
    veces(16, (i) => {
      const w = entero(p, 7, 15), h = entero(p, 5, 11), x = entero(p, 0, p.w - w), y = entero(p, 0, p.h - h);
      p.rect(x, y, w, h, i % 2 ? '#928d84' : '#7b7770');
      p.rect(x, y, w, 1, '#a9a49a'); p.rect(x, y, 1, h, '#a09b91'); p.rect(x, y + h - 1, w, 1, '#66635d'); p.rect(x + w - 1, y, 1, h, '#6c6862');
    });
    veces(7, () => grieta(p, '#514e49', entero(p, 6, 14)));
    p.motas('#b5b0a5', 24); p.motas('#6a6660', 30); p.motas('#8f9a58', 6, 2, 1);
  },
  (p) => {   // pasto
    p.fondo('#4e8a3a');
    veces(20, () => mancha(p, '#478136', entero(p, 4, 8)));
    veces(8, () => mancha(p, '#57953f', entero(p, 4, 6)));
    p.motas('#3c7230', 70, 1, 2); p.motas('#356a2c', 30);     // matas oscuras
    p.motas('#66a546', 60, 1, 2); p.motas('#80ba52', 18);     // briznas claras
    p.motas('#ead451', 4); p.motas('#f1efe0', 3);             // florcitas
  },
  (p) => {   // barro
    p.fondo('#6e3c24');
    veces(22, () => mancha(p, '#5c311d', entero(p, 4, 8)));
    veces(9, () => mancha(p, '#7c4629', entero(p, 3, 6)));
    p.motas('#482518', 40);
    p.motas('#96603e', 26, 2, 1); p.motas('#b98558', 8);      // brillo del barro mojado
  },
  (p) => {   // pantano: barro aguado, claro, para que no se confunda con una sombra
    p.fondo('#9a8560');
    veces(12, () => mancha(p, '#a48f69', entero(p, 5, 9)));
    veces(8, () => mancha(p, '#8a7652', entero(p, 4, 6)));
    p.motas('#b9a57f', 26, 4, 1); p.motas('#cdbb96', 12, 2, 1);   // reflejos
    p.motas('#6b5a3c', 26); p.motas('#7b8a4b', 10, 2, 1);         // hojas y lama
  },
  (p) => {   // lecho del rio: cantos rodados
    p.fondo('#84806c');
    veces(170, () => canto(p, ['#6f6b5a', '#8f8b77', '#a6a28d', '#bcb8a3'], '#5c594b'));
    p.motas('#5c594b', 40);
  },
  (p) => {   // derrumbe: tierra suelta con cascotes
    p.fondo('#8c6e50');
    veces(16, () => mancha(p, '#7a5e43', entero(p, 4, 7)));
    veces(12, () => mancha(p, '#9d7f5e', entero(p, 3, 6)));
    p.motas('#5e4833', 50); p.motas('#b39473', 30);
    veces(34, () => canto(p, ['#8f8a80', '#aaa59a', '#c4bfb2'], '#5e4833'));
  },
  (p) => {   // monte: el piso sombreado debajo de los arboles, con hojas secas
    p.fondo('#3f6f33');
    veces(18, () => mancha(p, '#376430', entero(p, 4, 8)));
    veces(8, () => mancha(p, '#467a37', entero(p, 3, 6)));
    p.motas('#2e562b', 60, 1, 2); p.motas('#538a3d', 30, 1, 2);
    p.motas('#6b5a34', 34); p.motas('#8a7240', 12, 2, 1); p.motas('#27482a', 24);
  },
  (p) => {   // pared: bancos de roca apilados, cada uno con luz arriba y sombra abajo, partidos en bloques
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
];

// Todos los pisos en una sola textura de varias capas.
export function texturaDePisos() {
  const M = 64, datos = new Uint8Array(M * M * 4 * PISOS.length);
  PISOS.forEach((pintar, i) => {
    const l = lienzoPintado(M, M, pintar, 100 + i);
    lienzos['piso' + i] = l;
    datos.set(l.getContext('2d').getImageData(0, 0, M, M).data, i * M * M * 4);
  });
  const t = new THREE.DataArrayTexture(datos, M, M, PISOS.length);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

// --- arboles y piedras ---
// cinco tonos por follaje, de oscuro a claro: monte oscuro, verde claro y lapacho rosado
const HOJAS = [
  ['#1c4426', '#28592e', '#356f37', '#48883f', '#5fa04a'],
  ['#2f6a2a', '#458535', '#5c9c3e', '#77b449', '#96cb5a'],
  ['#8f3d68', '#b3527f', '#d06f9a', '#e794b4', '#f7bfd1'],
];
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

// Un atlas con todos los dibujos de la escenografia. Cada dibujo se pinta la primera vez que se pide.
export function crearEscenografia() {
  const atlas = crearAtlas(256, 256), hechas = {};
  const una = (clave, w, h, pintar) => hechas[clave] || (hechas[clave] = atlas.zona(w, h, pintar, semillaDe(clave)));
  lienzos.escenografia = atlas.lienzo;
  return {
    atlas,
    copa: (tipo, lado) => una('copa' + tipo + 'x' + lado, lado, lado, (p) => copaDeArriba(p, HOJAS[tipo])),
    follaje: (tipo, alto) => una('follaje' + tipo + 'x' + alto, 32, alto, (p) => copaDeCostado(p, HOJAS[tipo])),
    debajo: (tipo) => una('debajo' + tipo, 8, 8, (p) => { p.fondo(HOJAS[tipo][0]); p.motas(HOJAS[tipo][1], 12); }),
    corteza: (tipo) => una('corteza' + tipo, 8, 24, (p) => {
      const c = tipo === 2 ? ['#4a3a34', '#382a26', '#63504a'] : ['#5c4130', '#473021', '#75573f'];
      p.fondo(c[0]);
      for (const x of [1, 4, 6]) for (let y = 0; y < p.h; y++) if (p.azar() < 0.75) p.punto(x, y, c[1]);
      p.motas(c[2], 14, 1, 2);
    }),
    piedra: (w, d) => una('piedra' + w + 'x' + d, w, d, piedraDeArriba),
    canto: (alto) => una('canto' + alto, 32, alto, piedraDeCostado),
    // mojon: poste blanco con una banda roja (a 8 pixeles por metro)
    mojon: () => una('mojon', 2, 10, (p) => { p.fondo('#efece2'); p.rect(0, 1, 2, 2, '#d23a2c'); p.rect(0, 0, 2, 1, '#fbf9f2'); p.rect(1, 3, 1, 7, '#d6d2c6'); p.rect(0, 9, 2, 1, '#a7a398'); }),
    tapaDeMojon: () => atlas.liso('#fbf9f2'),
  };
}

// --- cosas sueltas ---
// bidon de nafta: 4 x 6 x 2 pixeles (a 8 por metro)
export function dibujosDeBidon(atlas) {
  return {
    lados: atlas.zona(4, 6, (p) => {
      p.fondo('#d23a2c');
      p.rect(0, 5, 4, 1, '#8f1f18'); p.rect(3, 1, 1, 4, '#a8281e'); p.punto(0, 0, '#a8281e'); p.punto(3, 0, '#a8281e');
      p.punto(1, 2, '#a8281e'); p.punto(2, 3, '#a8281e'); p.punto(2, 2, '#f0685a'); p.punto(1, 3, '#f0685a'); p.punto(0, 1, '#f0685a');
    }),
    arriba: atlas.zona(4, 2, (p) => { p.fondo('#a8281e'); p.punto(0, 0, '#1e1f23'); p.punto(1, 0, '#f2c200'); p.rect(2, 0, 2, 1, '#d23a2c'); }),
  };
}
// la marca amarilla en el piso, debajo de cada bidon: cuatro esquinas
export const marcaDeBidon = () => textura(12, 12, (p) => {
  for (const [x, y] of [[0, 0], [8, 0], [0, 8], [8, 8]]) {
    p.rect(x, y === 0 ? 0 : 10, 4, 2, '#f2c200'); p.rect(x === 0 ? 0 : 10, y, 2, 4, '#f2c200');
  }
});
// la viga de un arco de control: rayas en diagonal, blancas y negras (el color lo pone el arco)
export const rayasDeArco = (ancho) => textura(ancho, 4, (p) => {
  for (let x = 0; x < ancho; x++) for (let y = 0; y < 4; y++) p.punto(x, y, ((x + y) >> 1) % 2 ? '#1b1b1d' : '#ffffff');
});
// la de la meta: a cuadros
export const cuadrosDeMeta = (ancho) => textura(ancho, 4, (p) => {
  for (let x = 0; x < ancho; x++) for (let y = 0; y < 4; y++) p.punto(x, y, ((x >> 1) + (y >> 1)) % 2 ? '#111111' : '#ffffff');
});
// cascotes y tierra que salta: un cubito con dos tonos
export const granito = () => textura(4, 4, (p) => { p.fondo('#ffffff'); p.rect(0, 3, 4, 1, '#b9b9b9'); p.rect(3, 0, 1, 4, '#cfcfcf'); p.punto(1, 1, '#dddddd'); });

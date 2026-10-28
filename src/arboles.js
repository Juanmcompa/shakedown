// Los arboles al estilo de los viejos juegos de PS1: dos o tres planos cruzados (como un asterisco visto desde arriba),
// con un dibujo de pocos pixeles pintado por codigo, igual que las plantas y los arbustos de sprites.js (a 8 pixeles por metro,
// borde recortado con alpha test, colores apagados por la paleta). Como el recorte es "todo o nada" no hay transparencia que
// ordenar: no parpadea al girar la camara. Cada zona del mundo es un solo InstancedMesh: todos los arboles se dibujan de una vez.
// El tronco y el choque no cambian: esto es solo lo que se ve (el choque sale de t.cosas, ver terrain.js).
import * as THREE from '../vendor/three.module.js';
import { crearAtlas } from './pixel.js';
import { estilo } from './material.js';

const entero = (p, a, b) => a + Math.floor(p.azar() * (b - a + 1));
const lim = (v, a, b) => Math.max(a, Math.min(b, v));

// cinco tonos por follaje, de oscuro a claro: verdes del mismo tono que el pasto (src/arte.js) y con poco salto entre tonos,
// para que los arboles no se despeguen del terreno
const HOJAS = {
  pino: ['#2f5a2e', '#376833', '#407639', '#4b843e', '#5a9246'],
  pinoAlto: ['#335c2c', '#3b6a31', '#447836', '#50873d', '#609646'],
  lenga: ['#8a4424', '#9e5228', '#b0622c', '#c07434', '#cc8840'],      // otoño: del rojo al naranja (apagado, como el pasto)
  nire: ['#8e6a26', '#a07a2c', '#b08a32', '#bf9a3c', '#caa84a'],       // otoño: amarillo (apagado)
  alamo: ['#467832', '#4f8636', '#5a933c', '#679f43', '#78ab4d'],
  eucalipto: ['#456a42', '#4f7748', '#5a844f', '#679158', '#779d63'],
  araucaria: ['#2b5530', '#336235', '#3c6f3a', '#467c40', '#538947'],
  sauce: ['#4e7a30', '#578735', '#62943b', '#6ea043', '#7dab4d'],
  seco: ['#3a2e24', '#4d3b2c', '#63503b', '#7d664b', '#9b8260'],
  // los nuevos: mismo criterio (apagados, de a poco entre tono y tono, nada de verdes puros ni azulados)
  roble: ['#3e6a30', '#477633', '#518337', '#5e8f3f', '#6d9b49'],
  abeto: ['#27492b', '#2e5530', '#366133', '#3f6d39', '#4a7a40'],
  abedul: ['#5b8838', '#679440', '#74a048', '#83ab53', '#93b660'],
  arbustoRedondo: ['#3a6230', '#436e33', '#4d7a38', '#59863f', '#689349'],
  arbustoOtono: ['#6c3a22', '#7f4829', '#93572e', '#a66834', '#b97c40'],
  ombu: ['#3c5f30', '#456b34', '#507838', '#5d8440', '#6b9049'],
  alamoOtono: ['#9a7824', '#ab8728', '#bb9730', '#caa63c', '#d8b54a'],   // alamo amarillo de otoño
  lengaRoja: ['#6a2a1e', '#7d3322', '#903d27', '#a24a2c', '#b35b34'],      // otoño: rojo oscuro
  lengaMarron: ['#58401f', '#6a4d25', '#7c5c2b', '#8f6c34', '#a37d40'],    // otoño: marron
  platano: ['#59782f', '#648436', '#70903d', '#7e9d47', '#8ea955'],
  palmera: ['#3e5f2c', '#4a6b32', '#577936', '#65873e', '#759646'],
  pinoViento: ['#325a2f', '#3a6733', '#43743a', '#4e813f', '#5c8f49'],
  acacia: ['#464626', '#5a5a2d', '#6f6e35', '#85823f', '#9a9650'],   // la acacia de la Travesia: verde de tierra seca
  matoSeco: ['#6e5430', '#80632f', '#97763a', '#b09050', '#c9aa66'],
  matoEspina: ['#44421f', '#54502f', '#66623a', '#7a764a', '#8e8a5a'],
};
const CORTEZA = {
  pino: ['#3e2c20', '#5c4130', '#75573f'], pinoAlto: ['#3e2c20', '#5c4130', '#75573f'], lenga: ['#2e2220', '#4a3a34', '#63504a'], nire: ['#2e2220', '#4a3a34', '#63504a'],
  alamo: ['#8f8a7c', '#b9b3a2', '#d6d1c2'], eucalipto: ['#9a8d76', '#c2b59c', '#ded3bd'], araucaria: ['#463e37', '#5a5148', '#756a5e'], sauce: ['#3b2f26', '#54443a', '#6e5a4c'], seco: ['#3a2e24', '#4d3b2c', '#63503b'],
  roble: ['#2e2218', '#4a392b', '#6a5440'], abeto: ['#33261c', '#4f3a2b', '#6b5240'], abedul: ['#7d786c', '#cfcabc', '#ece8dc'], ombu: ['#4a3d30', '#66564a', '#85735f'],
  alamoOtono: ['#8f8a7c', '#b9b3a2', '#d6d1c2'], lengaRoja: ['#2e2220', '#4a3a34', '#63504a'], lengaMarron: ['#2e2220', '#4a3a34', '#63504a'],
  platano: ['#6b6a58', '#9a9784', '#b9b59f'], palmera: ['#4a3f33', '#6e6050', '#8f7f69'], pinoViento: ['#3e2c20', '#5c4130', '#75573f'],
  acacia: ['#3b2a1c', '#4d3827', '#6b5038'], arbustoRedondo: ['#3e2c20', '#5c4130', '#75573f'], arbustoOtono: ['#3e2c20', '#5c4130', '#75573f'],
  matoSeco: ['#4a3a24', '#6b5434', '#8a7048'], matoEspina: ['#3c3820', '#575230', '#726c40'],
};

// (los que son variantes de otro dibujo comparten sus colores)
for (const [a, b] of [['robleBajo', 'roble'], ['eucaliptoAlto', 'eucalipto'], ['secoRetorcido', 'seco'], ['acaciaChica', 'acacia']]) { HOJAS[a] = HOJAS[b]; CORTEZA[a] = CORTEZA[b]; }

// un pixel del follaje: luz de 0 (sombra) a 1 (pleno sol)
const hoja = (p, tipo, x, y, luz) => p.punto(x, y, HOJAS[tipo][lim(Math.floor(luz * 5), 0, 4)]);
const troncoDe = (p, tipo, x, y0, y1, ancho = 2) => { const c = CORTEZA[tipo]; p.rect(x, y0, ancho, y1 - y0, c[1]); p.rect(x, y0, 1, y1 - y0, c[2]); p.rect(x + ancho - 1, y0, 1, y1 - y0, c[0]); };

// una masa redonda de hojas con el borde en racimos: la base de casi todas las copas.
// hueco: cuantos agujeros deja por abajo (se ve el cielo entre las ramas)
function masa(p, tipo, cx, cy, rx, ry, hueco = 0.08) {
  const f1 = p.azar() * 6.28, f2 = p.azar() * 6.28;
  for (let y = Math.floor(cy - ry - 2); y <= cy + ry + 2; y++) for (let x = Math.floor(cx - rx - 2); x <= cx + rx + 2; x++) {
    if (x < 0 || y < 0 || x >= p.w || y >= p.h) continue;
    const dx = (x - cx) / rx, dy = (y - cy) / ry, ang = Math.atan2(dy, dx);
    const d = Math.hypot(dx, dy) / (1 + 0.1 * Math.sin(ang * 3 + f1) + 0.07 * Math.sin(ang * 7 + f2)) + (p.azar() - 0.5) * 0.16;
    if (d > 1) continue;
    if (dy > 0.1 && p.azar() < hueco * (0.3 + dy)) continue;
    if (d > 0.84 && p.azar() < 0.3) continue;   // el borde "comido": hojas sueltas, no una raya lisa
    // hojas de pixel: ruido de varios tonos, con puntos brillantes y oscuros sueltos (como las texturas de PS1)
    let luz = 0.56 - dy * 0.22 + (p.azar() - 0.5) * 0.4;   // (sin sombra de costado: al cruzarse los planos se veian costuras)
    if ((x * 5 + y * 9) % 7 === 0) luz -= 0.08;   // sombra de racimo
    if (d > 0.82 && dy > 0) luz -= 0.1;
    const q = p.azar(); if (q < 0.08) luz += 0.22; else if (q > 0.93) luz -= 0.2;
    hoja(p, tipo, x, y, luz);
  }
}

// conifera: cono de pisos que se ensanchan hacia abajo
function conifera(p, tipo, pie, fino, piso) {
  const W = p.w, H = p.h, cx = (W - 1) / 2, copa = H - pie;
  for (let y = 0; y < copa; y++) {
    const t = y / copa, frac = (y % piso) / piso, hw = (W / 2) * (fino + (1 - fino) * t) * (0.6 + 0.4 * frac) + (p.azar() - 0.5) * 1.3;
    for (let x = Math.ceil(cx - hw); x <= cx + hw; x++) {
      if (x < 0 || x >= W || (y > 4 && p.azar() < 0.05 + frac * 0.1) || (Math.abs(x - cx) > hw - 1.2 && p.azar() < 0.3)) continue;
      const q = p.azar();
      hoja(p, tipo, x, y, 0.62 - frac * 0.26 + (p.azar() - 0.5) * 0.38 - (frac > 0.85 ? 0.12 : 0) + (q < 0.07 ? 0.22 : q > 0.94 ? -0.2 : 0));
    }
  }
  troncoDe(p, tipo, Math.round(cx) - 1, copa - 3, H);
}
function arbolRedondo(p, tipo, pie, rx, ry, ramas = true) {
  const W = p.w, H = p.h, cx = (W - 1) / 2, cy = ry + 1;
  troncoDe(p, tipo, Math.round(cx) - 1, cy + ry * 0.4, H);
  if (ramas) { const c = CORTEZA[tipo]; for (let i = 0; i < 4; i++) { const dir = i % 2 ? 1 : -1; p.punto(Math.round(cx) + dir * (1 + i), Math.round(cy + ry * 0.7 - i * 2), c[1]); p.punto(Math.round(cx) + dir * (2 + i), Math.round(cy + ry * 0.7 - i * 2 - 1), c[0]); } }
  masa(p, tipo, cx, cy, rx, ry);
}
// el alamo: alto, angosto y con la copa que flamea
function alamo(p, tipo = 'alamo') {
  const W = p.w, H = p.h, cx = (W - 1) / 2, copa = H - 12;
  troncoDe(p, tipo, Math.round(cx) - 1, copa - 4, H);
  masa(p, tipo, cx, copa * 0.52, W / 2 - 0.3, copa * 0.5, 0.05);
  for (let i = 0; i < 6; i++) hoja(p, tipo, entero(p, 3, W - 4), entero(p, 2, copa - 2), 0.95);   // hojas que brillan
}
// araucaria: tronco largo y un paraguas de ramas arriba
function araucaria(p) {
  const W = p.w, H = p.h, cx = (W - 1) / 2, c = CORTEZA.araucaria;
  troncoDe(p, 'araucaria', Math.round(cx) - 1, 8, H);
  for (let y = 10; y < H; y += 3) p.rect(Math.round(cx) - 1, y, 2, 1, c[0]);   // los anillos del tronco
  masa(p, 'araucaria', cx, 5, W / 2 - 1, 4, 0.25);
  masa(p, 'araucaria', cx, 10, W / 2 - 4, 3, 0.3);
  masa(p, 'araucaria', cx - 1, 2, W / 2 - 6, 2, 0.1);
}
// eucalipto: tronco claro y flaco, con manojos de hojas a distintas alturas
function eucalipto(p) {
  const W = p.w, H = p.h, cx = (W - 1) / 2, c = CORTEZA.eucalipto;
  let x = Math.round(cx);
  for (let y = H - 1; y > 8; y--) { p.rect(x, y, 2, 1, c[1]); p.punto(x, y, c[2]); if (y % 9 === 0) x = lim(x + (p.azar() < 0.5 ? -1 : 1), 6, W - 8); }
  masa(p, 'eucalipto', cx - 5, 12, 6.5, 5, 0.3);
  masa(p, 'eucalipto', cx + 4, 8, 7, 5, 0.3);
  masa(p, 'eucalipto', cx, 22, 6, 4, 0.35);
  masa(p, 'eucalipto', cx - 2, 3, 5, 3, 0.2);
}
// sauce llorón: cúpula con cortinas de hojas que cuelgan
function sauce(p) {
  const W = p.w, H = p.h, cx = (W - 1) / 2, cup = 13;
  troncoDe(p, 'sauce', Math.round(cx) - 1, 10, H);
  masa(p, 'sauce', cx, cup, W / 2 - 1, cup - 1, 0);
  for (let x = Math.ceil(cx - W / 2 + 2); x < cx + W / 2 - 2; x += 2) {
    const largo = entero(p, 8, H - cup - 6) * (1 - Math.abs(x - cx) / W * 0.8), y0 = cup + 3;
    for (let y = y0; y < y0 + largo; y++) { hoja(p, 'sauce', x, y, 0.62 - (y - y0) / largo * 0.5 + (p.azar() - 0.5) * 0.3); if (p.azar() < 0.2) hoja(p, 'sauce', x + 1, y, 0.45); }
  }
}
// arbol seco: ramas peladas que se abren de a dos
function seco(p) {
  const W = p.w, H = p.h, c = CORTEZA.seco;
  const rama = (x, y, ang, largo, grosor, nivel) => {
    for (let i = 0; i < largo; i++) {
      x += Math.cos(ang) + (p.azar() - 0.5) * 0.5; y += Math.sin(ang);
      const xi = Math.round(x), yi = Math.round(y);
      if (xi < 0 || yi < 0 || xi >= W || yi >= H) return;
      p.rect(xi, yi, grosor, 1, i % 3 ? c[1] : c[0]); if (grosor > 1) p.punto(xi, yi, c[2]);
    }
    if (nivel < 3) { rama(x, y, ang - 0.5 - p.azar() * 0.4, largo * 0.72, Math.max(1, grosor - 1), nivel + 1); rama(x, y, ang + 0.5 + p.azar() * 0.4, largo * 0.72, Math.max(1, grosor - 1), nivel + 1); }
  };
  p.rect(Math.floor(W / 2) - 1, H - 10, 2, 10, c[1]); p.rect(Math.floor(W / 2) - 1, H - 10, 1, 10, c[2]);
  rama(W / 2, H - 10, -Math.PI / 2, 9, 2, 0);
  rama(W / 2, H - 9, -Math.PI / 2 - 0.9, 7, 1, 1);
  rama(W / 2, H - 8, -Math.PI / 2 + 0.9, 7, 1, 1);
}

// ---------- los tipos nuevos (variedad por bioma) ----------
// un tronco que se tuerce: de abajo (yAbajo) a arriba (yArriba), cada tanto se corre un pixel. Devuelve la x donde termina.
function troncoTorcido(p, tipo, x, yArriba, yAbajo, ancho, deriva = 1, tira = 0) {
  const c = CORTEZA[tipo];
  for (let y = yAbajo - 1; y >= yArriba; y--) {
    p.rect(x, y, ancho, 1, c[1]); p.punto(x, y, c[2]); p.punto(x + ancho - 1, y, c[0]);
    if (p.azar() < 0.34) x = lim(x + deriva * (p.azar() < 0.5 + tira ? 1 : -1), 2, p.w - ancho - 2);
  }
  return x;
}
// una rama de pixeles que se curva: sirve para ramas pelonas y para las que sostienen una copa
function ramaCurva(p, tipo, x, y, ang, largo, curva, grosor, nivel = 0) {
  const c = CORTEZA[tipo];
  for (let i = 0; i < largo; i++) {
    x += Math.cos(ang); y += Math.sin(ang); ang += curva + (p.azar() - 0.5) * 0.16;
    const xi = Math.round(x), yi = Math.round(y);
    if (xi < 0 || yi < 0 || xi >= p.w || yi >= p.h) return;
    p.rect(xi, yi, grosor, 1, i % 3 ? c[1] : c[0]); if (grosor > 1) p.punto(xi, yi, c[2]);
    if (nivel < 2 && i === Math.floor(largo * 0.55)) ramaCurva(p, tipo, x, y, ang + (p.azar() < 0.5 ? -0.8 : 0.8), largo * 0.55, -curva, 1, nivel + 1);
  }
}
// roble / haya: copa redonda y ancha de tres lobulos, tronco grueso con las ramas madre a la vista
function roble(p, tipo = 'roble', alto = 0.4) {
  const W = p.w, H = p.h, cx = (W - 1) / 2, cy = H * alto;
  troncoDe(p, tipo, Math.round(cx) - 1, cy + 3, H, 3);
  const c = CORTEZA[tipo];
  for (let i = 0; i < 3; i++) { const d = i - 1; for (let k = 1; k <= 4; k++) p.punto(Math.round(cx) + d * k + (d ? 0 : 1), Math.round(cy + 4 - k), c[1]); }
  masa(p, tipo, cx - W * 0.22, cy + 2, W * 0.28, H * 0.25, 0.14);
  masa(p, tipo, cx + W * 0.22, cy + 1, W * 0.28, H * 0.25, 0.14);
  masa(p, tipo, cx + (p.azar() - 0.5) * 3, cy - H * 0.1, W * 0.3, H * 0.25, 0.1);
}
// roble achaparrado: bajo, retorcido y mas ancho que alto
function robleBajo(p) {
  const W = p.w, H = p.h, cx = (W - 1) / 2, cy = H * 0.4;
  troncoTorcido(p, 'roble', Math.round(cx) - 1, cy + 2, H, 3, 1);
  masa(p, 'roble', cx - W * 0.2, cy + 1, W * 0.3, H * 0.3, 0.2);
  masa(p, 'roble', cx + W * 0.22, cy, W * 0.28, H * 0.28, 0.2);
  masa(p, 'roble', cx, cy - 2, W * 0.26, H * 0.3, 0.12);
}
// abeto: cono de pisos bien marcados, cada piso cae como una pollera y deja una franja oscura abajo
function abeto(p) {
  const W = p.w, H = p.h, cx = (W - 1) / 2, copa = H - 5, pisos = 7, paso = copa / pisos;
  for (let y = 0; y < copa; y++) {
    const k = Math.floor(y / paso), frac = (y - k * paso) / paso;
    const hw = (W / 2 - 0.5) * ((k + 0.5 + 0.5 * frac) / pisos) + (p.azar() - 0.5) * 1.1;
    for (let x = Math.ceil(cx - hw); x <= cx + hw; x++) {
      if (x < 0 || x >= W || (Math.abs(x - cx) > hw - 1.1 && p.azar() < 0.35) || (frac > 0.78 && p.azar() < 0.1)) continue;
      const q = p.azar();
      hoja(p, 'abeto', x, y, 0.66 - frac * 0.4 + (p.azar() - 0.5) * 0.34 - (frac > 0.82 ? 0.12 : 0) + (q < 0.07 ? 0.2 : q > 0.94 ? -0.2 : 0));
    }
  }
  troncoDe(p, 'abeto', Math.round(cx) - 1, copa - 2, H);
}
// abedul: tronco blanco con marcas negras y una copa ovalada, clara y rala (se ve el cielo)
function abedul(p) {
  const W = p.w, H = p.h, cx = (W - 1) / 2, copa = 24;
  const x = troncoTorcido(p, 'abedul', Math.round(cx) - 1, 10, H, 2, 1);
  for (let y = 14; y < H - 2; y += 2 + Math.floor(p.azar() * 3)) { p.punto(x, y, '#3d372f'); if (p.azar() < 0.5) p.punto(x + 1, y, '#5a5348'); }
  masa(p, 'abedul', cx, copa * 0.5 + 1, W / 2 - 0.6, copa * 0.5, 0.3);
  for (let i = 0; i < 4; i++) hoja(p, 'abedul', entero(p, 3, W - 4), entero(p, 22, 28), 0.5 + p.azar() * 0.3);   // hojas colgando mas abajo
}
// arbusto redondo, bajo y tupido (de dos tipos: verde o de otoño)
function arbustoR(p, tipo) {
  const W = p.w, H = p.h, cx = (W - 1) / 2;
  masa(p, tipo, cx, H * 0.55, W / 2 - 0.6, H * 0.46, 0.04);
}
// ombu / tala: un solo arbol enorme, de copa ancha y baja, tronco grueso con la base abierta
function ombu(p) {
  const W = p.w, H = p.h, cx = (W - 1) / 2, c = CORTEZA.ombu;
  for (let y = H - 1; y >= 16; y--) {
    const ab = Math.max(0, y - (H - 9)), ancho = 4 + Math.round(ab * 0.9), x0 = Math.round(cx - ancho / 2);
    p.rect(x0, y, ancho, 1, c[1]); p.punto(x0, y, c[2]); p.punto(x0 + ancho - 1, y, c[0]);
  }
  masa(p, 'ombu', cx - W * 0.24, H * 0.32, W * 0.27, H * 0.26, 0.12);
  masa(p, 'ombu', cx + W * 0.24, H * 0.33, W * 0.27, H * 0.25, 0.12);
  masa(p, 'ombu', cx, H * 0.24, W * 0.32, H * 0.26, 0.08);
}
// eucalipto alto y viejo: tronco claro muy largo, penachos solo arriba, tiras de corteza colgando
function eucaliptoAlto(p) {
  const W = p.w, H = p.h, cx = (W - 1) / 2, c = CORTEZA.eucalipto;
  let x = Math.round(cx);
  for (let y = H - 1; y > 20; y--) { p.rect(x, y, 2, 1, c[1]); p.punto(x, y, c[2]); if (y % 11 === 0) x = lim(x + (p.azar() < 0.5 ? -1 : 1), 5, W - 7); if (p.azar() < 0.06) p.punto(x + 2, y, c[0]); }
  masa(p, 'eucalipto', x - 3, 20, 5.5, 4, 0.35);
  masa(p, 'eucalipto', x + 3, 13, 6, 4.5, 0.35);
  masa(p, 'eucalipto', x - 1, 5, 6, 4.5, 0.25);
}
// lenga de otoño (rojo oscuro o marron): copa de tres masas, distinta de la redonda de siempre
function lengaOtono(p, tipo) {
  const W = p.w, H = p.h, cx = (W - 1) / 2, cy = 15;
  troncoDe(p, tipo, Math.round(cx) - 1, cy + 5, H);
  masa(p, tipo, cx - 5, cy + 3, 10, 9, 0.12);
  masa(p, tipo, cx + 5, cy + 2, 10, 9, 0.12);
  masa(p, tipo, cx + (p.azar() - 0.5) * 4, cy - 5, 9, 8, 0.06);
}
// arbol seco retorcido: tronco que se tuerce y ramas que se curvan, sin una hoja
function secoRetorcido(p) {
  const W = p.w, H = p.h, c = CORTEZA.seco;
  const x = troncoTorcido(p, 'seco', Math.floor(W / 2) - 1, H - 22, H, 3, 1, 0.1);
  const y = H - 22;
  ramaCurva(p, 'seco', x + 1, y, -Math.PI / 2 - 0.5, 14, 0.07, 2);
  ramaCurva(p, 'seco', x + 1, y + 2, -Math.PI / 2 + 0.7, 13, -0.06, 2);
  ramaCurva(p, 'seco', x + 1, y + 6, -Math.PI / 2 - 1.3, 10, 0.1, 1);
  p.punto(x, H - 1, c[0]); p.punto(x + 2, H - 1, c[0]);
}
// pino bajo torcido por el viento: el tronco se inclina y las ramas quedan todas para un lado, como una bandera
function pinoViento(p) {
  const W = p.w, H = p.h, c = CORTEZA.pinoViento;
  let x = 7;
  for (let y = H - 1; y > 6; y--) { p.rect(Math.round(x), y, 2, 1, c[1]); p.punto(Math.round(x), y, c[2]); x += 0.5 * (1 + (H - y) / H) * 0.9; }
  const lado = [[2, 5, 4], [6, 8, 3], [11, 11, 5], [16, 9, 4], [20, 6, 3.5], [24, 4, 3], [28, 3, 3]];
  for (const [dx, y, rx] of lado) masa(p, 'pinoViento', dx + 3, y + 2, rx + 2, 3, 0.18);
  masa(p, 'pinoViento', 13, 6, 6, 4, 0.1);
}
// platano de vereda: copa ancha y alta, tronco claro manchado por la corteza que se cae
function platano(p) {
  const W = p.w, H = p.h, cx = (W - 1) / 2, c = CORTEZA.platano;
  troncoDe(p, 'platano', Math.round(cx) - 1, 16, H, 3);
  for (let i = 0; i < 18; i++) p.punto(Math.round(cx) - 1 + entero(p, 0, 2), entero(p, 18, H - 1), i % 2 ? c[0] : c[2]);
  for (let k = 1; k <= 5; k++) { p.punto(Math.round(cx) - k, 18 - k, c[1]); p.punto(Math.round(cx) + 1 + k, 18 - k, c[1]); }
  masa(p, 'platano', cx - 7, 13, 11, 10, 0.1);
  masa(p, 'platano', cx + 7, 13, 11, 10, 0.1);
  masa(p, 'platano', cx, 7, 11, 8, 0.05);
}
// palmera de plaza: tronco fino y apenas curvo con anillos, y un penacho de hojas que cuelgan
function palmera(p) {
  const W = p.w, H = p.h, c = CORTEZA.palmera, tope = 16;
  let x = 13;
  for (let y = H - 1; y > tope; y--) {
    p.rect(Math.round(x), y, 2, 1, y % 3 ? c[1] : c[0]); p.punto(Math.round(x), y, y % 3 ? c[2] : c[1]);
    x += 0.07 * Math.sin(y / 5) + (y > H - 8 ? -0.02 : 0.05);
  }
  const tx = Math.round(x) + 1;
  for (let i = 0; i < 11; i++) {
    const ang = -Math.PI + 0.12 + (i / 10) * (Math.PI - 0.24), largo = 10 + Math.floor(p.azar() * 4), cae = 0.055 + p.azar() * 0.04;
    for (let t = 1; t <= largo; t++) {
      const fx = tx + Math.cos(ang) * t, fy = tope + 1 + Math.sin(ang) * t * 0.8 + cae * t * t;
      hoja(p, 'palmera', Math.round(fx), Math.round(fy), 0.7 - t / largo * 0.4 + (p.azar() - 0.5) * 0.3);
      if (t % 2 === 0 && t > 2) { hoja(p, 'palmera', Math.round(fx), Math.round(fy) + 1, 0.4); if (p.azar() < 0.5) hoja(p, 'palmera', Math.round(fx), Math.round(fy) - 1, 0.6); }
    }
  }
  hoja(p, 'palmera', tx, tope + 1, 0.3); hoja(p, 'palmera', tx - 1, tope + 2, 0.25); hoja(p, 'palmera', tx + 1, tope + 2, 0.25);
}
// acacia de la Travesia: tronco torcido que se abre en dos y una copa plana y ancha, como un paraguas aplastado
function acacia(p) {
  const W = p.w, H = p.h, cx = (W - 1) / 2, copaAlto = Math.max(4, Math.round(H * 0.36)), c = CORTEZA.acacia;
  const x = troncoTorcido(p, 'acacia', Math.round(cx) + (p.azar() < 0.5 ? -2 : 2), copaAlto, H, 2, 1);
  for (let k = 0; k < 2; k++) { let rx = x, ry = copaAlto + 1; const dir = k ? 1 : -1; for (let s = 0; s < Math.round(W * 0.2); s++) { p.punto(rx, ry, c[1]); rx += dir; if (s % 2) ry--; if (ry < 1) break; } }
  masa(p, 'acacia', cx, copaAlto * 0.5 + 0.5, W / 2 - 0.5, copaAlto * 0.5 + 0.8, 0.28);
}
// mata seca: ramitas finas que salen de abajo en abanico (se ve como un manojo de palitos con hojas ralas)
function matoSeco(p, tipo, ramas) {
  const W = p.w, H = p.h, cx = (W - 1) / 2;
  for (let i = 0; i < ramas; i++) {
    const ang = -Math.PI / 2 + (p.azar() - 0.5) * 2.2, largo = H * (0.55 + p.azar() * 0.45);
    for (let t = 0; t < largo; t++) {
      const x = Math.round(cx + Math.cos(ang) * t * 0.9), y = Math.round(H - 1 + Math.sin(ang) * t);
      if (x < 0 || x >= W || y < 0) break;
      hoja(p, tipo, x, y, 0.25 + (t / largo) * 0.5 + (p.azar() - 0.5) * 0.25);
      if (t > largo * 0.4 && p.azar() < 0.35) hoja(p, tipo, x + (p.azar() < 0.5 ? -1 : 1), y, 0.6);
    }
  }
}

// la copa vista de arriba: un disco de hojas (o una estrella si es de conifera: las ramas salen del centro). Va en un plano horizontal
// a la altura de la copa, para que desde la camara alta se vea una copa redonda y no los planos de canto.
function copaDeArriba(p, tipo, estrella) {
  const W = p.w, c = (W - 1) / 2, f = p.azar() * 6.28;
  for (let y = 0; y < p.h; y++) for (let x = 0; x < W; x++) {
    const dx = (x - c) / (W / 2), dy = (y - c) / (W / 2), ang = Math.atan2(dy, dx);
    const r = estrella ? 0.72 + 0.28 * Math.abs(Math.sin(ang * 4 + f)) : 0.92 + 0.08 * Math.sin(ang * 5 + f);
    const d = Math.hypot(dx, dy) / r + (p.azar() - 0.5) * 0.18;
    if (d > 1 || (d > 0.82 && p.azar() < 0.32)) continue;
    let luz = 0.6 - d * 0.2 + (p.azar() - 0.5) * 0.4;
    const q = p.azar(); if (q < 0.09) luz += 0.3; else if (q > 0.93) luz -= 0.3;
    hoja(p, tipo, x, y, luz);
  }
}

// nombre -> [ancho, alto, como se pinta, cuantos planos]. Las medidas son de un arbol de tamano 1,2 (el del medio).
const DIBUJOS = {
  pino: [29, 50, (p) => conifera(p, 'pino', 6, 0.12, 7)],
  pinoAlto: [22, 74, (p) => conifera(p, 'pinoAlto', 8, 0.1, 9)],
  lenga: [31, 44, (p) => arbolRedondo(p, 'lenga', 0, 14.5, 13)],
  nire: [31, 44, (p) => arbolRedondo(p, 'nire', 0, 14.5, 13)],
  alamo: [16, 66, alamo],
  araucaria: [29, 62, araucaria],
  eucalipto: [24, 68, eucalipto],
  sauce: [32, 46, sauce],
  seco: [26, 40, seco],
  // --- nuevos ---
  roble: [36, 44, (p) => roble(p)],
  robleBajo: [34, 28, robleBajo],
  abeto: [26, 64, abeto],
  abedul: [22, 58, abedul],
  arbustoRedondo: [20, 14, (p) => arbustoR(p, 'arbustoRedondo')],
  arbustoOtono: [20, 14, (p) => arbustoR(p, 'arbustoOtono')],
  ombu: [48, 38, ombu],
  alamoOtono: [16, 66, (p) => alamo(p, 'alamoOtono')],
  eucaliptoAlto: [20, 92, eucaliptoAlto],
  lengaRoja: [31, 44, (p) => lengaOtono(p, 'lengaRoja')],
  lengaMarron: [31, 44, (p) => lengaOtono(p, 'lengaMarron')],
  secoRetorcido: [30, 46, secoRetorcido],
  pinoViento: [34, 32, pinoViento],
  platano: [36, 46, platano],
  palmera: [28, 58, palmera],
  acacia: [34, 20, acacia],
  acaciaChica: [24, 15, acacia],
  matoSeco: [14, 11, (p) => matoSeco(p, 'matoSeco', 11)],
  matoEspina: [14, 10, (p) => matoSeco(p, 'matoEspina', 9)],
};
// donde va el plano de la copa vista de arriba: [a que altura (0 a 1 del arbol), que tan ancho (del ancho del dibujo), conifera (estrella)]
// (ancho 0 = sin plano: el arbol seco no tiene hojas)
const COPA = { pino: [0.42, 0.9, true], pinoAlto: [0.45, 0.85, true], lenga: [0.68, 0.98, false], nire: [0.68, 0.98, false], alamo: [0.6, 1.0, false], araucaria: [0.9, 0.95, true], eucalipto: [0.66, 0.95, false], sauce: [0.74, 1.0, false], seco: [0.6, 0, false],
  roble: [0.62, 0.95, false], robleBajo: [0.55, 0.95, false], abeto: [0.4, 0.85, true], abedul: [0.7, 0.8, false], arbustoRedondo: [0.6, 0.95, false], arbustoOtono: [0.6, 0.95, false],
  ombu: [0.72, 1.0, false], alamoOtono: [0.6, 1.0, false], eucaliptoAlto: [0.7, 0.9, false], lengaRoja: [0.68, 0.98, false], lengaMarron: [0.68, 0.98, false],
  secoRetorcido: [0.6, 0, false], pinoViento: [0.7, 0.9, false], platano: [0.7, 1.0, false], palmera: [0.82, 0.9, true], acacia: [0.74, 1.0, false], acaciaChica: [0.74, 1.0, false],
  matoSeco: [0.55, 0.9, false], matoEspina: [0.55, 0.9, false] };
const VERSIONES = 3, PX = 8;
export const TIPOS_DE_ARBOL = Object.keys(DIBUJOS);

let hecho = null;
// (tambien lo usa la lamina de muestra de las pruebas: tools/pruebas/vervariedad.mjs)
export function dibujos() {
  if (hecho) return hecho;
  const atlas = crearAtlas(1024, 512), zonas = {}, arriba = {};
  for (const nombre in DIBUJOS) {
    const [w, h, pintar] = DIBUJOS[nombre];
    zonas[nombre] = [];
    for (let k = 0; k < VERSIONES; k++) zonas[nombre].push(atlas.zona(w, h, pintar, 211 + k * 23 + nombre.length * 13));
    arriba[nombre] = [];
    for (let k = 0; k < VERSIONES; k++) arriba[nombre].push(atlas.zona(20, 20, (p) => copaDeArriba(p, nombre, COPA[nombre][2]), 311 + k * 29 + nombre.length * 11));
  }
  const textura = atlas.textura();
  textura.generateMipmaps = false; textura.minFilter = THREE.NearestFilter;
  hecho = { atlas, zonas, arriba, textura };
  return hecho;
}

// (Cada plano tiene sus dos caras como triangulos aparte, todos con la normal para arriba. Con "DoubleSide" la cara de atras
// da vuelta la normal y queda a oscuras: por eso un plano se veia oscuro y el que lo cruza claro.)
// Los planos cruzados: cada uno es un cuadrado (x de -0,5 a 0,5; y de 0 a 1) girado. Con 3 planos queda un asterisco.
function formaCruzada(planos) {
  const pos = [], nor = [], uv = [], idx = [];
  for (let k = 0; k < planos; k++) {
    const a = k * Math.PI / planos, cx = Math.cos(a) * 0.5, cz = Math.sin(a) * 0.5, b = pos.length / 3;
    pos.push(-cx, 0, -cz, cx, 0, cz, cx, 1, cz, -cx, 1, -cz);
    for (let i = 0; i < 4; i++) nor.push(0, 1, 0);   // la luz es pareja: el dibujo ya trae su sombra
    uv.push(0, 0, 1, 0, 1, 1, 0, 1);
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    idx.push(b, b + 2, b + 1, b, b + 3, b + 2);   // la otra cara, con la misma normal (ver abajo)
  }
  // y el plano de la copa vista de arriba: horizontal (aTop = 1; su altura y ancho los pone el material con aForma)
  const top = new Array(pos.length / 3).fill(0), b = pos.length / 3;
  pos.push(-0.5, 0, -0.5, 0.5, 0, -0.5, 0.5, 0, 0.5, -0.5, 0, 0.5);
  for (let i = 0; i < 4; i++) { nor.push(0, 1, 0); top.push(1); }
  uv.push(0, 0, 1, 0, 1, 1, 0, 1);
  idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  idx.push(b, b + 2, b + 1, b, b + 3, b + 2);
  const g = new THREE.BufferGeometry();
  g.setAttribute('aTop', new THREE.Float32BufferAttribute(top, 1));
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

// Junta los arboles de una zona.  poner(tipo, x, y, z, vuelta, tamano, azar, suelto)   malla() devuelve un InstancedMesh (o null)
// tamano: el de siempre de los arboles (o.alto, de 0,8 a 1,7).  liviano: celular (dos planos en vez de tres).
export function crearLoteDeArboles(liviano) {
  const lista = [];
  let sueltos = 0;   // cuantos son solo de adorno (sin choque)
  const { atlas, zonas, arriba, textura } = dibujos();
  return {
    cuantos: () => lista.length, cuantosSueltos: () => sueltos,
    poner: (tipo, x, y, z, vuelta, tam, azar, suelto = false) => { lista.push([tipo, x, y, z, vuelta, tam, azar]); if (suelto) sueltos++; },
    malla: () => {
      if (!lista.length) return null;
      const planos = liviano ? 2 : 3, geo = formaCruzada(planos);
      const aUv = new Float32Array(lista.length * 4), aUv2 = new Float32Array(lista.length * 4), aForma = new Float32Array(lista.length * 2);
      const m = new THREE.InstancedMesh(geo, null, lista.length);
      const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), E = new THREE.Vector3(), ARRIBA = new THREE.Vector3(0, 1, 0);
      lista.forEach(([tipo, x, y, z, vuelta, tam, azar], i) => {
        const vs = zonas[tipo], zona = vs[Math.floor(azar * 977) % vs.length], s = tam / 1.2;
        M.compose(V.set(x, y - 0.12, z), Q.setFromAxisAngle(ARRIBA, vuelta), E.set(zona.w / PX * s, zona.h / PX * s, zona.w / PX * s));
        m.setMatrixAt(i, M);
        aUv.set([zona.x / atlas.ancho, zona.y / atlas.alto, zona.w / atlas.ancho, zona.h / atlas.alto], i * 4);
        const za = arriba[tipo][Math.floor(azar * 977) % vs.length], cp = COPA[tipo];
        aUv2.set([za.x / atlas.ancho, za.y / atlas.alto, za.w / atlas.ancho, za.h / atlas.alto], i * 4);
        aForma.set([cp[0], cp[1]], i * 2);
      });
      geo.setAttribute('aUv', new THREE.InstancedBufferAttribute(aUv, 4));
      geo.setAttribute('aUv2', new THREE.InstancedBufferAttribute(aUv2, 4));
      geo.setAttribute('aForma', new THREE.InstancedBufferAttribute(aForma, 2));
      m.material = estilo(new THREE.MeshLambertMaterial({ map: textura, alphaTest: 0.5 }), { calada: true, uvInstancia: true, clave: 'arbol' });
      m.customDepthMaterial = estilo(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: textura, alphaTest: 0.5 }), { uvInstancia: true, soloForma: true, clave: 'arbol' });
      m.castShadow = true; m.receiveShadow = false;
      m.userData.arboles = lista.length; m.userData.sueltos = sueltos; m.userData.planos = planos;
      return m;
    },
  };
}

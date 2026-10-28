// La vegetacion: los arboles (planos cruzados, ver arboles.js) y todo lo chico que crece al costado del camino
// (arbustos, matas, flores, yuyos y piedras sueltas), que son sprites.
import { crearRuido, azar } from './noise.js';
import { crearLoteDeArboles } from './arboles.js';
import { crearLoteDeSprites } from './sprites.js';
import { SUELOS } from './config.js';

const ZONA = 80;   // el mundo se parte en zonas de 80 metros, para dibujar solo las que se ven
const par = (v) => Math.max(2, Math.round(v / 2) * 2);   // medida par, en pixeles

// --- la forma de cada arbol, en pixeles de 25 cm. "a" es su tamaño (de 0,8 a 1,7) ---
// Devuelve el alto del tronco (pie) y los pisos de la copa, de abajo hacia arriba: [lado, alto, corrimiento en x, corrimiento en z]
const FORMAS = {
  pino: (a) => { const w = par(a * 12), h = par(a * 4.2); return { pie: Math.round(a * 4), pisos: [[w, h, 0, 0], [par(w * 0.74), h, 0, 0], [par(w * 0.5), h, 0, 0], [par(w * 0.28), h + 2, 0, 0]] }; },
  pinoAlto: (a) => { const w = par(a * 9), h = par(a * 5); return { pie: Math.round(a * 6), pisos: [[w, h, 0, 0], [par(w * 0.82), h, 0, 0], [par(w * 0.62), h, 0, 0], [par(w * 0.42), h, 0, 0], [par(w * 0.24), h + 2, 0, 0]] }; },
  lenga: (a, r) => { const w = par(a * 13), h = par(a * 6); return { pie: Math.round(a * 9), brazo: r() < 0.6, pisos: [[w, h, 0, 0], [par(w * 0.62), par(h * 0.6), Math.round((r() - 0.5) * 3), Math.round((r() - 0.5) * 3)]] }; },
  alamo: (a, r) => { const w = par(a * 5); return { pie: Math.round(a * 4), pisos: [[w, par(a * 9), 0, 0], [w, par(a * 8), Math.round(r() * 2 - 1), Math.round(r() * 2 - 1)], [par(w * 0.6), par(a * 6), 0, 0]] }; },
  araucaria: (a) => { const w = par(a * 10); return { pie: Math.round(a * 16), pisos: [[par(w * 0.6), 2, 0, 0], [w, 3, 0, 0], [par(w * 0.66), 3, 0, 0], [par(w * 0.3), 2, 0, 0]] }; },   // un paraguas arriba de un tronco largo
  eucalipto: (a, r) => { const w = par(a * 9); return { pie: Math.round(a * 17), pisos: [[w, par(a * 5), 0, 0], [par(w * 0.74), par(a * 4), Math.round((r() - 0.5) * 5), Math.round((r() - 0.5) * 5)], [par(w * 0.5), par(a * 3), Math.round((r() - 0.5) * 4), Math.round((r() - 0.5) * 4)]] }; },
};

// --- lo que crece en cada bioma, segun cuan lejos del camino: [dibujo, cuanto abunda, crece en manchones (0 = parejo)] ---
// cerca: en la banquina, todo bajo para no tapar el borde. medio: hasta 12 metros. lejos: mas alla.
const YUYOS = {
  bosque: {
    cerca: [['mataOscura', 5, 0], ['helecho', 3, 1], ['violetas', 1.5, 2], ['amancay', 1.6, 3], ['piedra', 0.5, 0], ['lupinoLila', 1.2, 4], ['lupinoRosa', 1, 4], ['lupinoBlanco', 0.5, 4]],
    medio: [['helecho', 4, 1], ['mataOscura', 3, 0], ['arbusto', 1.6, 0], ['arbustoRojo', 1.1, 5], ['lupinoLila', 2.2, 4], ['lupinoRosa', 1.6, 4], ['lupinoBlanco', 0.8, 4], ['tocon', 0.6, 0], ['piedraGrande', 0.4, 0], ['amancay', 1, 3]],
    lejos: [['mataOscura', 3, 0], ['helecho', 3, 1], ['arbusto', 1, 0], ['arbustoRojo', 0.5, 5]],
    cuanto: [0.55, 0.42, 0.1],
  },
  campo: {
    cerca: [['mataClara', 5, 0], ['margaritas', 2, 2], ['amarillas', 2, 3], ['pastoAlto', 2, 1], ['cardo', 0.7, 4]],
    medio: [['pastoAlto', 4, 1], ['cortadera', 2, 5], ['arbustoClaro', 1, 0], ['arbustoFlor', 0.8, 2], ['cardo', 1.6, 4], ['amarillas', 2, 3], ['margaritas', 1.5, 2], ['mataClara', 3, 0]],
    lejos: [['pastoAlto', 3, 1], ['mataClara', 3, 0], ['cortadera', 0.7, 5], ['cardo', 0.6, 4]],
    cuanto: [0.5, 0.4, 0.12],
  },
  montana: {
    cerca: [['coiron', 5, 0], ['mataSeca', 3, 0], ['piedra', 1.6, 1], ['amarillas', 0.7, 3]],
    medio: [['coiron', 5, 0], ['neneo', 2.4, 2], ['arbustoSeco', 1.4, 4], ['piedraGrande', 1, 1], ['mataSeca', 2, 0], ['piedra', 1, 1]],
    lejos: [['coiron', 4, 0], ['neneo', 1.5, 2], ['arbustoSeco', 0.8, 4]],
    cuanto: [0.5, 0.4, 0.14],
  },
  // la sierra: paja brava y matas bajas, con muchos bloques de granito sueltos
  sierra: {
    cerca: [['coiron', 5, 0], ['mataSeca', 3, 0], ['piedra', 1.8, 1], ['amarillas', 0.5, 3]],
    medio: [['coiron', 5, 0], ['arbustoSeco', 1.4, 4], ['piedraGrande', 1.8, 1], ['mataSeca', 2.4, 0], ['piedra', 1.4, 1], ['neneo', 0.7, 2]],
    lejos: [['coiron', 4, 0], ['arbustoSeco', 1, 4], ['piedraGrande', 0.6, 1]],
    cuanto: [0.5, 0.4, 0.14],
  },
};

// lo que se suma donde la naturaleza es mas rica (t.natura mayor que 1): flores, matas, troncos y piedritas
const EXTRAS = {
  bosque: [['tronco', 2, 0], ['piedrita', 2, 1], ['violetas', 2, 2], ['amancay', 2, 3], ['helecho', 2, 1], ['tocon', 0.6, 0]],
  campo: [['piedrita', 1.5, 1], ['margaritas', 3, 2], ['amarillas', 3, 3], ['tronco', 0.8, 0], ['cardo', 1, 4]],
  montana: [['piedrita', 4, 1], ['piedra', 2, 1], ['mataSeca', 2, 0], ['amarillas', 1, 3], ['tronco', 0.5, 0]],
  sierra: [['piedrita', 4, 1], ['piedra', 2, 1], ['mataSeca', 2, 0]],
};

// Arma la vegetacion y la agrega a la escena. Devuelve las celdas del mapa que quedan debajo de un arbol.
export function crearFlora(T, escena, esc, liviano) {
  const { nx, nz, x0, z0, H, S } = T;
  const zonas = new Map(), zona = (x, z) => {
    const k = Math.floor(x / ZONA) * 4096 + Math.floor(z / ZONA);
    if (!zonas.has(k)) zonas.set(k, { arboles: crearLoteDeArboles(liviano), yuyos: crearLoteDeSprites() });
    return zonas.get(k);
  };
  const monte = new Uint8Array(nx * nz);
  const ruido = crearRuido((T.etapa.semilla || 1) + 31), ruidoMonte = crearRuido((T.etapa.semilla || 1) + 57);
  // los arboles que chocan (para saber si uno esta solo, y para no poner uno de adorno encima de otra cosa)
  const caja = new Map(), kc = (a, b) => Math.floor(a / 8) * 4096 + Math.floor(b / 8);
  for (const o of T.cosas) { const k = kc(o.x, o.z); if (!caja.has(k)) caja.set(k, []); caja.get(k).push(o); }
  const cerca = (x, z, radio, soloArboles, salvo) => {
    for (let a = -Math.ceil(radio / 8); a <= Math.ceil(radio / 8); a++) for (let b = -Math.ceil(radio / 8); b <= Math.ceil(radio / 8); b++) {
      for (const o of caja.get(kc(x + a * 8, z + b * 8)) || []) if (o !== salvo && (!soloArboles || (o.clase === 'arbol' && o.tipo !== 'arbusto')) && (o.x - x) ** 2 + (o.z - z) ** 2 < (radio + (o.hx ? Math.hypot(o.hx, o.hz) : o.r || 0)) ** 2) return true;
    }
    return false;
  };
  // cerca de un arroyo o vado (agua baja a un costado del camino): ahi van los sauces
  const juntoAlAgua = (x, z) => T.aguas.some((a) => Math.hypot(a.x - x, a.z - z) < a.cruce + 10 && T.altura(x, z) - a.nivel < 2.2);
  const conteo = {}, contar = (donde, tipo) => { const c = conteo[donde] || (conteo[donde] = {}); c[tipo] = (c[tipo] || 0) + 1; };   // (para las pruebas: cuantos de cada tipo hay en cada ambiente)
  const sortear = (lista, q) => { let t = lista.reduce((s, e) => s + e[1], 0) * q; for (const e of lista) { t -= e[1]; if (t <= 0) return e[0]; } return lista[0][0]; };

  // --- que dibujo lleva cada arbol que choca ---
  const OTONO = ['lengaRoja', 'lenga', 'nire', 'lengaMarron'];   // rojo oscuro, naranja, amarillo y marron
  const deOtono = (g, q) => OTONO[Math.max(0, Math.min(3, Math.floor(((g - 0.5) * 2.2 + 0.5 + (q - 0.5) * 0.3) * 4)))];
  const elegirArbol = (o, donde) => {
    const rr = azar(Math.floor(o.x * 173 + o.z * 89) + 31), g = ruidoMonte.n2(o.x / 38, o.z / 38), q = rr(), q2 = rr(), t = o.tipo;
    if (o.plantado) {   // las hileras de la vereda y la plaza del pueblo
      if (t === 'lenga') return q < 0.78 ? 'platano' : q < 0.92 ? 'palmera' : 'lenga';
      if (t === 'alamo') return q < 0.5 ? 'alamo' : q < 0.88 ? 'platano' : 'alamoOtono';
      return t;
    }
    if (donde === 'bosque') {
      if (t === 'pino' || t === 'pinoAlto') return sortear([[t, 3], ['abeto', g < 0.5 ? 4 : 1.2], ['roble', g > 0.6 ? 2.5 : 0.4], ['abedul', g > 0.35 && g < 0.65 ? 2.5 : 0.3]], q);
      if (t === 'lenga') return sortear([['roble', g > 0.5 ? 3 : 1.5], ['abedul', g > 0.35 ? 2.5 : 1], ['robleBajo', 1.4], ['lenga', 1], ['nire', 0.6], ['lengaRoja', 0.5], ['abeto', g < 0.4 ? 1.5 : 0]], q);
    } else if (donde === 'campo') {
      if (t === 'eucalipto') {
        if (!cerca(o.x, o.z, 16, true, o)) return q < 0.5 ? 'ombu' : q < 0.65 ? 'robleBajo' : 'eucalipto';   // uno solo en el campo: copa ancha
        return q < 0.4 ? 'eucaliptoAlto' : q < 0.9 ? 'eucalipto' : 'robleBajo';
      }
      if (t === 'alamo') {
        if (juntoAlAgua(o.x, o.z)) return q < 0.75 ? 'sauce' : 'alamo';
        return o.fila ? (q < 0.9 ? 'alamo' : 'alamoOtono') : q < 0.8 ? 'alamo' : q < 0.9 ? 'alamoOtono' : 'sauce';
      }
    } else if (donde === 'montana') {
      if (t === 'araucaria') return q < 0.8 ? 'araucaria' : q < 0.9 ? 'secoRetorcido' : 'pinoViento';
      if (t === 'pino') return q < 0.3 ? 'pinoViento' : q < 0.45 ? 'pino' : deOtono(g, q2);
      if (t === 'lenga') return q < 0.3 ? 'secoRetorcido' : deOtono(g, q2);
    } else if (donde === 'sierra') {
      if (t === 'pino') return q < 0.55 ? 'pinoViento' : 'pino';
      if (t === 'lenga') return q < 0.3 ? 'secoRetorcido' : deOtono(g, q2);
    }
    return t;
  };

  // --- arboles y arbustos ---
  for (const o of T.cosas) {
    if (o.clase !== 'arbol') continue;
    const r = azar(Math.floor(o.x * 131 + o.z * 71) + 9), z = zona(o.x, o.z);
    if (o.tipo === 'arbusto') {   // un arbusto es un sprite; segun el bioma, uno u otro
      const donde = T.biomaEn(o.x, o.z), dibujo = donde === 'montana' ? (r() < 0.6 ? 'neneo' : 'arbustoSeco') : donde === 'sierra' ? (r() < 0.25 ? 'neneo' : 'arbustoSeco') : donde === 'campo' ? (r() < 0.6 ? 'arbustoClaro' : 'arbustoFlor') : 'arbusto';
      z.yuyos.poner(dibujo, o.x, o.y - 0.05, o.z, { escala: 1.15 + r() * 0.5, azar: r(), mueve: 0.04 });
      continue;
    }
    // Que dibujo lleva cada arbol: el choque (tronco y lugar) no cambia, solo lo que se ve. Se mezcla por ambiente, con rodales (g es un
    // ruido suave: en un lugar domina un tipo y en otro, otro) y con sorteos propios de cada arbol, asi no cambia ningun otro sorteo.
    // (la forma de bloques solo se usa para saber cuanto monte le queda debajo, igual que antes)
    const donde = T.biomaEn(o.x, o.z), f = (FORMAS[o.tipo] || FORMAS.lenga)(o.alto, r), tipo = elegirArbol(o, donde);
    z.arboles.poner(tipo, o.x, o.y, o.z, o.vuelta, o.alto, r()); contar(donde, tipo);
    // el piso de abajo queda como monte
    const radio = f.pisos[0][0] / 8 + 1.2, gx = Math.round(o.x - x0), gz = Math.round(o.z - z0), n = Math.ceil(radio);
    for (let j = -n; j <= n; j++) for (let i = -n; i <= n; i++) {
      if (i * i + j * j <= radio * radio && gx + i >= 0 && gx + i < nx && gz + j >= 0 && gz + j < nz) monte[(gz + j) * nx + gx + i] = 1;
    }
  }

  // --- arboles de adorno: no chocan (no estan en t.cosas) y van lejos del camino, para que el paisaje no sea siempre igual ---
  // Se sortean con la semilla de la pista. Hay pocos (menos de la mitad de los que chocan) y siguen siendo instancias.
  let sueltos = 0;
  {
    const rd = azar((T.etapa.semilla || 1) + 83), celda = T.celda || 1, C = T.camino, pasto = SUELOS.pasto.id;
    const tope = Math.round(T.cosas.filter((o) => o.clase === 'arbol' && o.tipo !== 'arbusto').length * 0.4) + 25;
    // un lugar donde se puede plantar: pasto, sin sembrar, sin pelar, no empinado, ni en un claro; devuelve la celda o -1
    const sitio = (x, z, desde) => {
      if (x < x0 + 5 || x > T.x1 - 5 || z < z0 + 5 || z > T.z1 - 5) return -1;
      const k = Math.round(z - z0) * nx + Math.round(x - x0), b = T.borde[k];
      if (!(b > desde && b < 80) || S[k] !== pasto || T.pelado[k] || T.cultivo[k]) return -1;
      if (Math.hypot(H[k + 1] - H[k - 1], H[k + nx] - H[k - nx]) / (2 * celda) > 0.36) return -1;
      if (T.claros.some((q) => (q.x - x) ** 2 + (q.z - z) ** 2 < q.r * q.r)) return -1;
      return k;
    };
    const poner = (tipo, x, z, tam) => {
      if (sueltos >= tope) return false;
      zona(x, z).arboles.poner(tipo, x, T.altura(x, z), z, rd() * 6.28, tam, rd(), true);
      sueltos++; contar(T.biomaEn(x, z), tipo + '*');   // (con * : de adorno)
      return true;
    };
    const PRO = { bosque: 0.26, campo: 0.05, montana: 0.2, sierra: 0.05 };
    for (let z = z0 + 8; z < T.z1 - 8; z += 7) for (let x = x0 + 8; x < T.x1 - 8; x += 7) {
      const px = x + (rd() - 0.5) * 6, pz = z + (rd() - 0.5) * 6, a = rd(), q = rd(), tam = 0.9 + rd() * 0.6, donde = T.biomaEn(px, pz), n = ruidoMonte.n2(px / 30 + 9, pz / 30);
      if (a > (PRO[donde] ?? 0)) continue;
      const k = sitio(px, pz, donde === 'campo' ? 14 : 7);
      if (k < 0 || cerca(px, pz, donde === 'campo' ? 22 : 3.2, donde === 'campo')) continue;
      let tipo;
      if (donde === 'bosque') tipo = sortear([['arbustoRedondo', n > 0.55 ? 4 : 1.5], ['abeto', n < 0.45 ? 3 : 1], ['roble', n > 0.5 ? 2.5 : 1], ['abedul', 2], ['robleBajo', 1]], q);   // bordes y claros: arbustos y hoja ancha
      else if (donde === 'campo') tipo = sortear([['ombu', 5], ['robleBajo', 3], ['eucaliptoAlto', 2]], q);   // un arbol solo, de copa ancha
      else if (donde === 'montana') tipo = sortear([[deOtono(n, q), 5], ['arbustoOtono', 3], ['secoRetorcido', 1.2], ['pinoViento', 1.2]], rd());
      else tipo = sortear([['arbustoOtono', 1], ['pinoViento', 1], ['secoRetorcido', 1]], q);
      poner(tipo, px, pz, tipo.startsWith('arbusto') ? 0.8 + rd() * 0.5 : tam);
    }
    // alamos en fila (cortina de viento) a un costado del camino de campo, afuera del alambrado
    if (C) for (let i0 = 30; i0 < C.n - 60; i0 += 110) {
      if (rd() > 0.4) continue;
      const lado = rd() < 0.5 ? -1 : 1, largo = 60 + rd() * 50, d0 = 9 + rd() * 2;
      for (let m = 0; m < largo; m += 6.2) {
        const i = Math.min(C.n - 1, Math.round(i0 + m)), d = C.W[i] / 2 + d0 + (rd() - 0.5) * 0.8;
        const px = C.X[i] - C.HZ[i] * lado * d, pz = C.Z[i] + C.HX[i] * lado * d;
        if (T.biomaEn(px, pz) !== 'campo' || sitio(px, pz, 5) < 0 || cerca(px, pz, 3.2, false)) continue;
        poner(rd() < 0.88 ? 'alamo' : 'alamoOtono', px, pz, 1.2 + rd() * 0.5);
      }
    }
    // sauces a la orilla de los arroyos y vados
    for (const ag of T.aguas) {
      let n = 0;
      for (let t = 0; t < 40 && n < 6; t++) {
        const px = ag.x + (rd() - 0.5) * 2 * (ag.cruce + 8), pz = ag.z + (rd() - 0.5) * 2 * (ag.cruce + 8), dn = T.altura(px, pz) - ag.nivel;
        if (dn < 0.2 || dn > 1.8 || T.biomaEn(px, pz) === 'montana' || T.biomaEn(px, pz) === 'sierra' || sitio(px, pz, 3) < 0 || cerca(px, pz, 3, false)) continue;
        if (poner('sauce', px, pz, 1.1 + rd() * 0.5)) n++;
      }
    }
  }

  // --- yuyos: se siembran en una grilla, mas tupidos cerca del camino ---
  // (si la pista pasa por varios ambientes, en cada lugar crece lo del suyo)
  const listas = T.biomas.map((id) => YUYOS[id] || YUYOS.bosque), r = azar((T.etapa.semilla || 1) + 5);
  const paso = liviano ? 2.6 : 1.9, pasto = SUELOS.pasto.id;
  const elegir = (opciones, x, z) => {
    let total = 0;
    const pesos = opciones.map(([, peso, manchon]) => {
      // lo que crece en manchones abunda en unos lugares y casi no aparece en otros
      const w = manchon ? peso * (ruido.n2(x / 17 + manchon * 37, z / 17 - manchon * 11) > 0.56 ? 3.2 : 0.12) : peso;
      total += w;
      return w;
    });
    let t = r() * total;
    for (let i = 0; i < opciones.length; i++) { t -= pesos[i]; if (t <= 0) return opciones[i][0]; }
    return opciones[0][0];
  };
  for (let z = z0 + 2; z < T.z1 - 2; z += paso) for (let x = x0 + 2; x < T.x1 - 2; x += paso) {
    const px = x + (r() - 0.5) * paso, pz = z + (r() - 0.5) * paso, a = r(), k = Math.round(pz - z0) * nx + Math.round(px - x0);
    const b = T.borde[k];
    if (!(b > 0.7 && b < 34) || S[k] !== pasto || T.pelado[k]) continue;
    if (T.cultivo[k]) {   // en lo sembrado crece lo sembrado
      const que = T.cultivo[k], dibujo = que === 3 ? 'girasol' : que === 1 ? 'trigo' : que === 4 ? 'mataOscura' : '';
      if (dibujo && a < (que === 3 ? 0.5 : que === 1 ? 0.3 : 0.12)) zona(px, pz).yuyos.poner(dibujo, px, T.altura(px, pz) - 0.04, pz, { escala: 0.9 + r() * 0.3, azar: r(), mueve: 0.05 });
      continue;
    }
    const banda = b < 3.5 ? 0 : b < 12 ? 1 : 2, lista = listas[T.zona ? T.zona[k] : 0];
    const nat = T.natura ? T.natura[k] / 64 : 1;   // cuanta naturaleza lleva este pedazo (t.natura de la pista: 1 = lo normal)
    if (a > lista.cuanto[banda] * (monte[k] ? 0.45 : 1) * nat) continue;
    if (T.claros.some((q) => (q.x - px) ** 2 + (q.z - pz) ** 2 < (q.r - 1) * (q.r - 1))) continue;
    // donde la naturaleza es mas rica, parte de lo que sale son flores, matas, troncos caidos y piedritas
    const extra = nat > 1.15 && banda < 2 && r() < Math.min(0.6, (nat - 1) * 0.55);
    const dibujo = extra ? elegir(EXTRAS[T.biomaEn(px, pz)] || EXTRAS.bosque, px, pz) : elegir(banda === 0 ? lista.cerca : banda === 1 ? lista.medio : lista.lejos, px, pz);
    zona(px, pz).yuyos.poner(dibujo, px, T.altura(px, pz) - 0.04, pz, { escala: 0.85 + r() * 0.45, azar: r(), mueve: dibujo.startsWith('piedra') || dibujo === 'tocon' || dibujo === 'tronco' ? 0 : 0.03 + r() * 0.05 });
  }

  // --- las vacas del campo ---
  for (const v of T.vacas) zona(v.x, v.z).yuyos.poner(v.n % 3 ? 'vacaOvera' : 'vacaColorada', v.x, v.y - 0.05, v.z, { escala: 1.25, azar: v.fase, mueve: 0 });

  // --- a la escena ---
  let arboles = 0, yuyos = 0;
  for (const z of zonas.values()) {
    const m = z.arboles.malla();
    if (m) { escena.add(m); arboles += z.arboles.cuantos(); }
    if (z.yuyos.cuantos()) { escena.add(z.yuyos.malla(!liviano)); yuyos += z.yuyos.cuantos(); }
  }
  return { monte, yuyos, arboles, sueltos, tipos: conteo, zonas: zonas.size };
}

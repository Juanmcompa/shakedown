// El garaje: los autos se arman con partes, como en el Mario Kart. Un motor, un chasis y unas ruedas.
// Cada auto tiene un codigo: el numero de cada parte, en el orden de TIPOS. "431" = el 4to motor, el 3er chasis y las
// primeras ruedas. Ninguna combinacion es la mejor para todo: lo que se gana en un lado se pierde en otro (mas motor pesa
// mas y patina mas; las ruedas de barro agarran en el barro y resbalan en el asfalto; el chasis liviano dobla rapido
// pero se rompe facil). Asi cada uno busca el auto que le sirve, y el que le sirve a cada pista.
//
// Para sumar partes el dia de mañana:
//   - una parte nueva de un tipo que ya existe: se agrega AL FINAL de su lista (el numero de cada parte es su lugar en la
//     lista: si se corre, cambian los autos ya armados). Hasta 15 por tipo (asi viajan en el link: ver fantasma.js).
//   - un tipo nuevo (por ejemplo, paragolpes): se agrega AL FINAL de TIPOS, con su lista. Los codigos viejos (de tres
//     cifras) siguen valiendo: a lo que les falta se le pone la parte NEUTRA.
// Lo que hace cada parte: "cambia" recibe la configuracion del auto (la de config.js) y la modifica. Los numeros
// que entiende el auto estan explicados en config.js, arriba de AUTOS.
//
// La Vitarita y el Kacito de siempre son dos combinaciones (ver PRESETS): su motor y sus ruedas son las del medio, que
// no cambian nada, y su chasis es el de cada uno. Por eso manejan exactamente igual que antes.
import { AUTOS } from './config.js';

export const TIPOS = ['motor', 'chasis', 'ruedas'];
export const NEUTRA = 3;   // la parte que no cambia nada (para los codigos cortos de cuando habia menos tipos)

// multiplica (o suma) algunos numeros de la configuracion
const por = (C, cambios) => { for (const k in cambios) C[k] *= cambios[k]; };
// un auto mas pesado (o mas liviano): la inercia acompaña al peso
const pesar = (C, kilos) => {
  if (!kilos) return;
  const f = (C.masa + kilos) / C.masa;
  C.masa += kilos; C.inercia = C.inercia.map((x) => x * f); C.resorte *= f; C.amortigua = C.amortigua.map((x) => x * f);
};

// Un chasis nuevo sale de uno de los autos de siempre, con lo que le cambia (su forma, su peso, su suspension).
const desde = (id, mas) => () => JSON.parse(JSON.stringify(Object.assign({}, AUTOS[id], mas)));

export const PARTES = {
  // --- motores: empuje (cuanto acelera) y potencia (velocidad final). Mas motor pesa mas y hace patinar mas ---
  motor: [
    { nombre: 'Cuatro chico', detalle: 'Liviano y dócil: no patina nunca', icono: 'motor', cambia: (C) => { por(C, { empuje: 0.84, potencia: 0.8, patinaje: 0.85, frenoMotor: 0.85 }); pesar(C, -45); } },
    { nombre: 'Dieciséis válvulas', detalle: 'Sube rápido de vueltas', icono: 'motor', cambia: (C) => { por(C, { empuje: 1.02, potencia: 0.9, patinaje: 0.93 }); pesar(C, -20); } },
    { nombre: 'El de fábrica', detalle: 'Ni mucho ni poco', icono: 'motor', cambia: () => {} },
    { nombre: 'Turbo', detalle: 'Más final, pero tarda en empujar', icono: 'motor', cambia: (C) => { por(C, { empuje: 0.95, potencia: 1.15, patinaje: 1.08 }); pesar(C, 35); } },
    { nombre: 'V8', detalle: 'Empuja como loco y patina', icono: 'motor', cambia: (C) => { por(C, { empuje: 1.18, potencia: 1.25, patinaje: 1.28, frenoMotor: 1.2 }); pesar(C, 120); } },
  ],
  // --- chasis: la forma del auto, su peso, su suspension y cuanto aguanta los golpes ---
  // (modelo: como se dibuja; ver autos.js. aguante: los golpes rompen el auto dividido por esto)
  chasis: [
    { nombre: 'Buggy', detalle: 'Liviano y ágil, pero frágil', emoji: '🏎️', icono: 'chasis', base: desde('kacito', {
      modelo: 'buggy', masa: 640, empuje: 0.62, potencia: 54000, inercia: [780, 820, 260], ejes: 1.15, trocha: 0.82, radio: 0.36, centro: -0.1,
      resorteLargo: 0.48, recorrido: 0.32, resorte: 13500, amortigua: [1500, 2200], aire: 3.0, traccion: [0.35, 0.65],
      cubiertas: [1, 1.04], giro: 0.64, lateral: 0.34, alturaLateral: 0.8, caja: [0.85, 1.7, -0.35, 0.8], choque: [0.85, 1.0],
      colaFirme: 1.03, aguante: 0.8 }) },
    { nombre: 'Rally', detalle: 'El del Kacito: chiquito y nervioso', emoji: '🚗', icono: 'chasis', base: desde('kacito', { aguante: 1 }) },
    { nombre: 'Cuatro por cuatro', detalle: 'El de la Vitarita: alto y parejo', emoji: '🚙', icono: 'chasis', base: desde('vitarita', { aguante: 1 }) },
    { nombre: 'Chata', detalle: 'Larga y pesada: firme en las rectas', emoji: '🛻', icono: 'chasis', base: desde('vitarita', {
      modelo: 'chata', masa: 1350, inercia: [2300, 2350, 640], ejes: 1.45, trocha: 0.72, radio: 0.37, anclaje: 0.05, centro: 0.15,
      resorteLargo: 0.5, recorrido: 0.3, resorte: 26000, amortigua: [3000, 4300], empuje: 0.6, potencia: 76000, aire: 3.8,
      traccion: [0.3, 0.7], cubiertas: [0.98, 1.05], giro: 0.55, lateral: 0.3, alturaLateral: 0.4, caja: [0.85, 2.2, -0.4, 1.0],
      choque: [0.85, 1.35], colaFirme: 0.97, estable: 0.36, aguante: 1.25 }) },
    { nombre: 'Camioncito', detalle: 'Pesado y lento, aguanta todo', emoji: '🚚', icono: 'chasis', base: desde('vitarita', {
      modelo: 'camion', masa: 1900, inercia: [3600, 3700, 1100], ejes: 1.7, trocha: 0.86, radio: 0.46, anclaje: 0.08, centro: 0.25,
      resorteLargo: 0.6, recorrido: 0.38, resorte: 36000, amortigua: [4300, 6200], empuje: 0.5, potencia: 92000, aire: 4.6,
      traccion: [0.5, 0.5], cubiertas: [0.96, 1.1], giro: 0.52, lateral: 0.3, alturaLateral: 0.36, caja: [1.0, 2.5, -0.45, 1.5],
      choque: [1.0, 1.55], estable: 0.42, aguante: 1.6 }) },
  ],
  // --- ruedas: cuanto agarran en piso firme y en piso blando, y su tamaño ---
  ruedas: [
    { nombre: 'Lisas', detalle: 'Pegadas al asfalto; en el barro, jabón', icono: 'ruedas', cambia: (C) => { C.cubiertas = [C.cubiertas[0] * 1.12, C.cubiertas[1] * 0.82]; por(C, { deriva: 0.85, radio: 0.95 }); C.firme = Math.min(0.9, C.firme + 0.15); } },
    { nombre: 'Mixtas', detalle: 'Mejores en firme que en blando', icono: 'ruedas', cambia: (C) => { C.cubiertas = [C.cubiertas[0] * 1.05, C.cubiertas[1] * 0.93]; por(C, { radio: 0.97 }); C.firme = Math.min(0.9, C.firme + 0.07); } },
    { nombre: 'Todo terreno', detalle: 'Las de siempre', icono: 'ruedas', cambia: () => {} },
    { nombre: 'Taco de ripio', detalle: 'Muerden el ripio; flotan en el asfalto', icono: 'ruedas', cambia: (C) => { C.cubiertas = [C.cubiertas[0] * 0.95, C.cubiertas[1] * 1.08]; por(C, { radio: 1.04, lateral: 0.95 }); C.firme = Math.max(0.2, C.firme - 0.05); } },
    { nombre: 'Patonas de barro', detalle: 'Grandes: pasan por todo, pero pesan', icono: 'ruedas', cambia: (C) => { C.cubiertas = [C.cubiertas[0] * 0.88, C.cubiertas[1] * 1.16]; por(C, { deriva: 1.15, radio: 1.1, aire: 1.05 }); C.firme = Math.max(0.2, C.firme - 0.1); pesar(C, 25); } },
  ],
};

// Los autos de siempre, ya armados (y los nombres viejos, que siguen en los links y en lo guardado)
export const PRESETS = { vitarita: { codigo: '333', nombre: 'La Vitarita' }, kacito: { codigo: '323', nombre: 'El Kacito' } };

// El codigo de un auto, sea como sea que venga: '431', 'vitarita' (de antes de los autos armados) o cualquier otra cosa
// (queda la Vitarita). Siempre con una cifra por tipo.
export function codigoDe(auto) {
  if (PRESETS[auto]) return PRESETS[auto].codigo;
  const s = String(auto || '');
  if (!/^[1-9a-f]{1,8}$/.test(s)) return PRESETS.vitarita.codigo;
  return TIPOS.map((tipo, k) => {
    const n = k < s.length ? parseInt(s[k], 16) : NEUTRA;
    return (n >= 1 && n <= PARTES[tipo].length ? n : NEUTRA).toString(16);
  }).join('');
}
// las partes de un codigo: { motor: 4, chasis: 3, ruedas: 1 }
export const partesDe = (codigo) => Object.fromEntries(TIPOS.map((tipo, k) => [tipo, parseInt(codigoDe(codigo)[k], 16)]));
export const armarCodigo = (partes) => TIPOS.map((tipo) => (partes[tipo] || NEUTRA).toString(16)).join('');
export const parte = (tipo, n) => PARTES[tipo][n - 1];

// La configuracion del auto armado (la que usan la fisica, el dibujo y el fantasma). Se arma una vez por codigo.
const armados = new Map();
export function configDe(auto) {
  const codigo = codigoDe(auto);
  if (!armados.has(codigo)) {
    const p = partesDe(codigo), C = parte('chasis', p.chasis).base();
    for (const tipo of TIPOS) if (tipo !== 'chasis') parte(tipo, p[tipo]).cambia(C);
    const preset = Object.values(PRESETS).find((x) => x.codigo === codigo);
    C.codigo = codigo;
    C.emoji = parte('chasis', p.chasis).emoji;
    C.nombre = preset ? preset.nombre : parte('chasis', p.chasis).nombre + ' ' + codigo;
    armados.set(codigo, C);
  }
  return armados.get(codigo);
}

// --- las fichas: lo que se ve en el garaje, de 1 a 10 en cada cosa ---
// (salen de los numeros del auto; el 1 y el 10 son el peor y el mejor de todas las combinaciones)
const CUENTAS = {
  velocidad: (C) => Math.cbrt(C.potencia / C.aire),
  aceleracion: (C) => C.empuje / Math.sqrt(C.patinaje),
  manejo: (C) => C.giro * Math.pow(1400 / C.inercia[1], 0.35) * (0.7 + C.alturaLateral * 0.4),
  agarre: (C) => (C.cubiertas[0] + C.cubiertas[1]) / 2 * (0.75 + C.firme * 0.5),
  aguante: (C) => C.aguante || 1,
};
export const FICHAS = [['velocidad', 'Velocidad'], ['aceleracion', 'Aceleración'], ['manejo', 'Manejo'], ['agarre', 'Agarre'], ['aguante', 'Aguante']];
let rangos = null;
export function fichas(auto) {
  if (!rangos) {
    rangos = {};
    const todos = [];
    const contar = (k, prefijo) => { if (k === TIPOS.length) { todos.push(configDe(prefijo)); return; } for (let n = 1; n <= PARTES[TIPOS[k]].length; n++) contar(k + 1, prefijo + n.toString(16)); };
    contar(0, '');
    for (const k in CUENTAS) { const v = todos.map(CUENTAS[k]); rangos[k] = [Math.min(...v), Math.max(...v)]; }
  }
  const C = configDe(auto), f = {};
  for (const k in CUENTAS) { const [a, b] = rangos[k]; f[k] = b > a ? Math.max(1, Math.min(10, Math.round(1 + 9 * (CUENTAS[k](C) - a) / (b - a)))) : 5; }
  return f;
}

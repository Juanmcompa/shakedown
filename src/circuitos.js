// Circuitos fijos: pistas escritas a mano, siempre las mismas, para seguir corriendo ademas de la del dia.
// Cada una es una lista de tramos como las que arma el generador (ver al principio de generador.js que lleva
// cada tramo), pero elegidos uno por uno. Para cambiar un circuito alcanza con tocar su lista.
import { azar } from './noise.js';
import { EDIFICIOS } from './edificios.js';

const RAD = Math.PI / 180;
// Los circuitos usan numeros de pista que los dias no van a alcanzar nunca (el link de un resultado guarda ese numero).
// version: hay que subirla cada vez que se toca el recorrido de ese circuito (o algo del terreno que lo cambie). Con eso,
// los tiempos y los fantasmas guardados de la version anterior se descartan solos: eran de otro camino.
// detalle: lo que dice la portada del circuito. breve: lo que dice su renglon en la lista de circuitos.
// real: true = esta basado en un tramo de verdad (se agrupa aparte en el panel de circuitos); no cambia la pista.
export const CIRCUITOS = [
  { id: 'subida', numero: 16001, version: 1, nombre: 'Subida a Mina Vieja', corto: 'Subida', emoji: '⛰️', bioma: 'montana', clima: 'sol', caracter: 'tecnica', lugar: '38°51′S 70°58′O',
    detalle: 'Angosta y empinada, con puentes y lajas. No hay velocidad: es pura técnica.', breve: 'Montaña angosta: pura técnica' },
  { id: 'bajada', numero: 16002, version: 1, nombre: 'Bajada del Portezuelo', corto: 'Bajada', emoji: '🦅', bioma: 'montana', clima: 'tarde', caracter: 'rapida', lugar: '38°44′S 71°02′O',
    detalle: 'Ancha, rápida y en bajada, toda de ripio suelto. Hay que llevarlo cruzado.', breve: 'Ripio en bajada: la más rápida' },
  { id: 'urbano', numero: 16003, version: 1, nombre: 'Callejero de Villa Cañada', corto: 'Urbano', emoji: '🏘️', bioma: 'campo', clima: 'sol', caracter: 'tecnica', lugar: '35°12′S 60°41′O',
    detalle: 'Entre las casas del pueblo: esquinas de 90 grados, la plaza, un pasaje angosto y cosas para esquivar.', breve: 'Esquinas de 90 entre las casas' },
  // vuelta: true = es una vuelta cerrada: no tiene llegada, se dan las vueltas que se quieran y queda la mejor.
  { id: 'practica', numero: 16004, version: 1, vuelta: true, nombre: 'Vuelta del Club', corto: 'Práctica', emoji: '🔁', bioma: 'campo', clima: 'sol', caracter: 'mixta', lugar: '37°46′S 68°12′O',
    detalle: 'Una vuelta cerrada para practicar: sale por la ruta, cruza el pueblo, se mete en el bosque, trepa al cerro y vuelve. Das las vueltas que quieras y queda la mejor.', breve: 'Vuelta cerrada: queda la mejor' },
  { id: 'giulio', numero: 16005, version: 1, real: true, maximo: 1500, nombre: 'Mina Clavero – Giulio Cesare', corto: 'Giulio Cesare', emoji: '🏔️', bioma: 'sierra', clima: 'sol', caracter: 'mixta', lugar: '31°43′S 64°58′O',
    detalle: 'Casi 20 kilómetros de la pampa de altura al pueblo: horquillas arriba, rectas rápidas con saltos, curvas entre el granito, cuestas con pirca, un arroyo y las esquinas de Mina Clavero.', breve: '19 km: de la sierra al pueblo' },
  // camion: true = se maneja siempre el camion de carga, con su fisica pesada (ver camion.js), y se cuentan los bultos entregados.
  // Es de pura fantasia: no existe, pero va con los reales (es el "Dark Souls de los camiones"). Va al final de la lista, como siempre.
  { id: 'montana', numero: 16006, version: 3, real: true, camion: true, maximo: 1800, nombre: 'La Montaña del Sufrimiento', corto: 'Montaña del Sufrimiento', emoji: '🚛', bioma: 'montana', clima: 'niebla', caracter: 'tecnica', lugar: '41°09′S 71°18′O',
    detalle: 'Un camión cargado, cuatro tramos y ninguna prisa: barro hondo con rodadas que te agarran las ruedas, una escalada de piedras, una cornisa cortada por una cascada y una bajada que no perdona. Cada bulto que se cae suma 60 segundos.', breve: 'Camión con carga: barro, piedras y precipicio' },
];
export const esCircuito = (numero) => CIRCUITOS.some((c) => c.numero === numero);
// Las pistas de la comunidad (las que arma un jugador: ver hoja.js) usan los numeros de 13000 a 15999. Duran dos semanas
// (o hasta que quien la armo la borre); despues el numero se puede volver a usar, con la version siguiente (el link de un
// resultado guarda numero y version: el de una pista vieja no se confunde con la nueva). El borrador que se esta probando
// en el creador es el 12999. Cada uno puede tener hasta cinco vigentes. (Los dias recien llegan al 13000 en el año 2062.)
export const COMUNIDAD = { desde: 13000, hasta: 15999, borrador: 12999, dias: 14, porPersona: 5 };
export const esDeLaComunidad = (numero) => numero >= COMUNIDAD.desde && numero <= COMUNIDAD.hasta;
export const circuitoDe = (clave) => CIRCUITOS.find((c) => c.id === clave || c.numero === clave) || null;

// que tan cerrada es una curva, como la canta el copiloto: del 1 (la mas cerrada) al 6, "h" la horquilla y "e" la esquina de 90
function gradoDe(radio, angulo) {
  if (angulo >= 120 && radio <= 12) return 'h';
  if (angulo >= 80 && angulo <= 100 && radio <= 10) return 'e';
  return radio <= 18 ? 1 : radio <= 27 ? 2 : radio <= 40 ? 3 : radio <= 62 ? 4 : radio <= 100 ? 5 : 6;
}

// Una ayuda para escribir trazados. Lo que se "fija" vale para todos los tramos que siguen, hasta que se cambie
// (con null se saca): ancho, suelo, pendiente, izq, der, hombro, rugoso, plano, vereda...
const BANQUINA = 1.2;   // en las laderas, metros de piso parejo entre el camino y el vacio
function trazado() {
  const tramos = [], fijo = { ancho: 7, suelo: 'ripio', pendiente: 0 };
  let vacio = null;       // en una ladera, de que lado esta la caida ('izq' o 'der')
  const pone = (largo, giro, mas) => { const t = Object.assign({ largo: Math.round(largo), giro }, fijo, mas); tramos.push(t); return t; };
  const sinLadera = { izq: undefined, der: undefined, hombro: undefined, plano: undefined };
  const T = {
    tramos,
    fijar: (o) => { for (const k in o) { if (o[k] === null) delete fijo[k]; else fijo[k] = o[k]; } return T; },
    recta: (largo, mas) => pone(largo, 0, mas),
    // (en un circuito cerrado) una recta cuyo largo se acomoda solo para que la vuelta cierre: hacen falta dos, y que no sean paralelas
    libre: (largo, mas) => pone(largo, 0, Object.assign({ libre: true }, mas)),
    // una curva de tantos metros de radio que dobla tantos grados (positivo = a la derecha)
    curva: (radio, angulo, mas) => {
      const largo = Math.max(6, Math.abs(angulo) * RAD * radio), n = Math.max(1, Math.round(largo / 50)), grado = gradoDe(radio, Math.abs(angulo));
      let primero = null;
      for (let k = 0; k < n; k++) {
        const t = pone(largo / n, angulo / n, k === 0 ? mas : null);
        if (k === 0) { primero = t; t.nota = { tipo: 'curva', lado: angulo > 0 ? 'der' : 'izq', grado, larga: typeof grado === 'number' && Math.abs(angulo) > 100 }; }
        if (vacio && (t.izq || t.der) && t.pirca === undefined) t.pirca = vacio;   // en las laderas, las curvas llevan pirca del lado del vacio
      }
      return primero;
    },
    // una horquilla: se ensancha, se aplana un poco y lleva flechas del lado de afuera
    horquilla: (angulo, mas) => {
      const lado = Math.sign(angulo), ancho = Math.max(fijo.ancho + 3.2, 8.4), t = T.curva(9.5, angulo, Object.assign({ ancho, pendiente: Math.round(fijo.pendiente * 0.4) }, sinLadera, mas));
      t.carteles = [[Math.round(t.largo * 0.5), -lado * (ancho / 2 + 2.2), lado > 0 ? 'der' : 'izq']];
      return t;
    },
    // un puente: angosto y derecho, sobre una zanja de "alto" metros (con agua o seca)
    puente: (luz, alto, agua, mas) => pone(luz + 8, 0, Object.assign({ ancho: Math.min(fijo.ancho, 4.4), pendiente: Math.max(-2, Math.min(2, fijo.pendiente)), puente: { luz, alto, agua: !!agua }, nota: { tipo: 'puente' } }, sinLadera, mas)),
    // un vado: el camino baja a un arroyo, lo cruza por el lecho y vuelve a subir (41 metros en total)
    vado: (hondo = 0.34) => {
      pone(14, 0, { pendiente: -5, nota: { tipo: 'vado' } });
      const t = pone(13, 0, { pendiente: 0, suelo: 'lecho', ancho: 9, agua: { hondo, largo: 64 } });
      pone(14, 0, { pendiente: 5.5 });
      return t;
    },
    // la ladera de la montaña: de que lado sube ("izq" o "der"). Del otro lado queda la caida, despues de una banquina angosta.
    ladera: (sube, cuanto = 12, cae = 20) => {
      vacio = sube ? (sube === 'izq' ? 'der' : 'izq') : null;
      return T.fijar(sube ? { izq: sube === 'izq' ? [cuanto, 9] : [-cae, 9], der: sube === 'der' ? [cuanto, 9] : [-cae, 9], hombro: 2.2, plano: sube === 'izq' ? [0, BANQUINA] : [BANQUINA, 0] } : { izq: null, der: null, hombro: null, plano: null });
    },
    vacio: () => vacio,
  };
  return T;
}

// piedras al borde de un tramo, cada tantos metros, de un lado o de los dos
export function piedras(t, r, cada = 9, lados = [-1, 1]) {
  t.piedras = t.piedras || [];
  for (let u = 4; u < t.largo - 3; u += cada * (0.7 + r() * 0.6)) t.piedras.push([Math.round(u), lados[Math.floor(r() * lados.length)] * (t.ancho / 2 + 0.6 + r() * 0.7), Math.round((0.5 + r() * 0.45) * 100) / 100]);
}

// ================= SUBIDA A MINA VIEJA: angosta, empinada, con puentes y lajas =================
// Trepa en zigzag hacia el norte: los tramos que van hacia el este tienen el cerro a la izquierda; los que van al oeste, a la derecha.
// Las lajas: un tramo de roca con lomos de piedra que hay que pasar despacio y eligiendo por donde (los "pozos" de hondo negativo son lomos).
// vacio: de que lado esta la caida ('izq' o 'der'). De ese lado va la pirca; del otro, al pie del cerro, piedras caidas.
function lajas(t, r, vacio) {
  const lado = vacio === 'izq' ? -1 : 1;
  t.suelo = 'roca'; t.rugoso = 0.1; t.tope = 7.5; t.nota = { tipo: 'lajas' }; t.pirca = vacio;
  t.pozos = [];
  for (let u = 5; u < t.largo - 4; u += 5 + r() * 4) t.pozos.push([Math.round(u * 2) / 2, Math.round((r() - 0.5) * (t.ancho - 2.6) * 10) / 10, Math.round((1.3 + r() * 0.7) * 10) / 10, -Math.round((0.15 + r() * 0.11) * 100) / 100, 'roca']);
  t.piedras = [];
  for (let u = 4; u < t.largo - 3; u += 8 * (0.7 + r() * 0.6)) { const radio = Math.round((0.45 + r() * 0.4) * 100) / 100; t.piedras.push([Math.round(u), -lado * (t.ancho / 2 + radio + 0.25 + r() * 0.5), radio]); }
  return t;
}
function subida() {
  const T = trazado(), r = azar(5101);
  T.fijar({ ancho: 6.6, suelo: 'ripio', pendiente: 0 });
  const largada = T.recta(64);
  largada.publico = [[20, -(largada.ancho / 2 + 7), 6], [27, largada.ancho / 2 + 7.5, 5]];
  // el camino se cierra y empieza a trepar por la quebrada
  T.fijar({ ancho: 5, pendiente: 5 });
  T.recta(28, { nota: { tipo: 'angosto' } });
  T.ladera('izq').fijar({ pendiente: 7 });
  T.curva(22, 62);
  T.curva(18, -34); T.curva(18, 34);
  T.ladera(null).puente(8, 3, true, { tope: 9 });
  T.ladera('izq').fijar({ pendiente: 8 });
  T.recta(34);
  T.horquilla(-132, { publico: [[10, 9 / 2 + 8, 5]] });
  // primeras lajas
  T.ladera('der').fijar({ pendiente: 9, ancho: 4.6 });
  lajas(T.recta(48), r, T.vacio());
  T.fijar({ ancho: 5, pendiente: 8 });
  T.curva(16, 40); T.curva(16, -40);
  T.recta(30);
  T.horquilla(135);
  T.ladera('izq');
  T.recta(16);
  T.curva(20, -30); T.curva(20, 30);
  T.ladera(null).puente(12, 5, false, { tope: 9 });
  T.ladera('izq').fijar({ pendiente: 9 });
  T.recta(30);
  T.curva(15, 44); T.curva(15, -44);
  T.recta(14);
  T.horquilla(-130);
  // la cornisa de la mina: pared de un lado, vacio del otro, y el piso de laja
  T.ladera('der', 14, 28).fijar({ pendiente: 10, ancho: 4.6 });
  lajas(T.recta(56), r, T.vacio()).nota = { tipo: 'cornisa' };
  T.fijar({ ancho: 5, pendiente: 7 });
  T.curva(26, 64);
  T.recta(18);
  T.curva(14, -52); T.curva(14, 52);
  T.ladera(null).puente(9, 4, false, { tope: 9 });
  T.ladera('der').fijar({ pendiente: 8 });
  T.curva(14, 96);
  T.ladera('izq');
  T.curva(18, -28); T.curva(18, 28);
  T.recta(14);
  T.horquilla(-140, { publico: [[12, 9 / 2 + 8, 6]] });
  T.ladera('der').fijar({ pendiente: 9, ancho: 4.6 });
  lajas(T.recta(40), r, T.vacio());
  T.fijar({ ancho: 5 });
  T.curva(18, 46); T.curva(18, -42);
  T.recta(16);
  T.horquilla(134);
  T.ladera('izq').fijar({ pendiente: 8 });
  T.recta(20);
  T.curva(16, -36); T.curva(16, 36);
  T.recta(30);
  T.horquilla(-136);
  // el ultimo esfuerzo: la picada de los mineros, mas angosta y mas parada
  T.ladera('der').fijar({ pendiente: 10, ancho: 4.6 });
  lajas(T.recta(36), r, T.vacio());
  T.fijar({ ancho: 5, pendiente: 9 });
  T.curva(14, 48); T.curva(14, -48);
  T.recta(26);
  T.horquilla(138);
  T.ladera('izq').fijar({ pendiente: 8 });
  T.recta(34);
  T.curva(20, -70);
  // la llegada, arriba, en la boca de la mina
  T.ladera(null).fijar({ pendiente: 2, ancho: 7.5 });
  const llegada = T.recta(92);
  llegada.pendiente = 0;
  llegada.publico = [[52, -(7.5 / 2 + 7), 8], [58, 7.5 / 2 + 7, 7]];
  return T.tramos;
}

// ================= BAJADA DEL PORTEZUELO: ancha, rapida, de ripio suelto y siempre para abajo =================
// Baja en zigzag hacia el norte. Cada pata del zigzag es larga, para llegar bien rapido, con curvas amplias que se toman
// con el auto cruzado; entre pata y pata, una curva cerrada donde hay que haber frenado a tiempo (en bajada cuesta mas).
function bajada() {
  const T = trazado();
  T.fijar({ ancho: 9.5, suelo: 'ripio', pendiente: 0 });
  const largada = T.recta(64);
  largada.publico = [[20, -(9.5 / 2 + 7), 7], [26, 9.5 / 2 + 7.5, 6]];
  T.fijar({ ancho: 8.6, pendiente: -5 });
  T.recta(80);
  // primera pata: hacia el noroeste, con el cerro a la derecha
  T.ladera('der', 12, 22).fijar({ pendiente: -8 });
  T.curva(70, -50);
  T.recta(150);
  T.curva(220, 14); T.curva(220, -14);
  T.recta(110);
  T.ladera(null).curva(36, 112, { ancho: 10, pendiente: -4, publico: [[38, -(10 / 2 + 8), 7]], carteles: [[32, -(10 / 2 + 2.4), 'der']] });
  // segunda pata: el salto
  T.ladera('izq', 12, 24).fijar({ pendiente: -9 });
  T.recta(120);
  T.curva(200, -16);
  T.recta(46, { nota: { tipo: 'salto' } });
  T.ladera(null);
  T.recta(14, { pendiente: 5 }); T.recta(24, { pendiente: -11 });
  T.ladera('izq', 12, 24);
  T.recta(90);
  T.curva(180, 16);
  T.ladera(null).curva(32, -118, { ancho: 10, pendiente: -4, publico: [[34, 10 / 2 + 8, 8]], carteles: [[28, 10 / 2 + 2.4, 'izq']] });
  // tercera pata: las eses rapidas
  T.ladera('der', 12, 24).fijar({ pendiente: -9 });
  T.recta(160);
  T.curva(80, 34); T.curva(80, -34);
  T.recta(130);
  T.ladera(null).curva(38, 110, { ancho: 10, pendiente: -4, carteles: [[34, -(10 / 2 + 2.4), 'der']] });
  // cuarta pata: mas eses, mas cerradas
  T.ladera('izq', 12, 24).fijar({ pendiente: -8 });
  T.recta(90);
  T.curva(60, -48); T.curva(60, 48);
  T.recta(140);
  T.ladera(null).curva(30, -112, { ancho: 10, pendiente: -4, publico: [[32, 10 / 2 + 8, 8]], carteles: [[27, 10 / 2 + 2.4, 'izq']] });
  // la ultima: la recta mas larga y dos curvas para llegar
  T.ladera('der', 10, 20).fijar({ pendiente: -9 });
  T.recta(180);
  T.curva(160, 28);
  T.curva(50, -62);
  T.recta(60);
  T.curva(46, 92);
  T.ladera(null).fijar({ pendiente: -3, ancho: 10.5 });
  const llegada = T.recta(92);
  llegada.pendiente = 0;
  llegada.publico = [[52, -(10.5 / 2 + 7), 9], [58, 10.5 / 2 + 7, 9], [78, -(10.5 / 2 + 8), 5]];
  return T.tramos;
}

// ================= CALLEJERO DE VILLA CAÑADA: entre las casas del pueblo =================
const TIPOS_DE_CASA = [['casa', 4], ['casita', 3], ['edificio', 1.5], ['almacen', 1.3], ['rancho', 0.5], ['galpon', 0.45]];
function elegir(r, lista) {
  let total = 0;
  for (const x of lista) total += x[1];
  let t = r() * total;
  for (const x of lista) { t -= x[1]; if (t <= 0) return x[0]; }
  return lista[0][0];
}
// Llena los costados de un tramo con edificios, uno al lado del otro, mirando a la calle.
// o.lados: de que lados ([-1, 1] = los dos).  o.desde / o.hasta: metros que se dejan libres en cada punta (para las esquinas).
export function casas(t, r, o = {}) {
  const hasta = t.largo - (o.hasta === undefined ? 6 : o.hasta), vereda = t.vereda || 0, lista = t.casas || (t.casas = []);
  for (const lado of o.lados || [-1, 1]) {
    let u = (o.desde === undefined ? 6 : o.desde) + r() * 1.5;
    while (u < hasta - 5.5) {
      let tipo = elegir(r, o.tipos || TIPOS_DE_CASA);
      if (u + EDIFICIOS[tipo].ancho > hasta) tipo = 'casita';
      const D = EDIFICIOS[tipo];
      if (u + D.ancho > hasta) break;
      const retiro = o.retiro !== undefined ? o.retiro : tipo === 'almacen' || tipo === 'edificio' ? 0.25 : 0.5 + r() * 2.2;
      lista.push([Math.round((u + D.ancho / 2) * 4) / 4, lado * Math.round((t.ancho / 2 + 0.6 + vereda + retiro + D.fondo / 2) * 4) / 4, tipo, 0, Math.floor(r() * 1000)]);
      u += D.ancho + (r() < 0.14 ? 5 + r() * 5 : 0.4 + r() * 1.8);
    }
  }
  return t;
}
// faroles de un lado y arboles del otro, en la vereda
export function arbolado(t, r, o = {}) {
  const borde = t.ancho / 2 + 1.25, cosas = t.objetos || (t.objetos = []), verdes = t.arboles || (t.arboles = []), ladoFarol = o.farol || (r() < 0.5 ? -1 : 1);
  for (let u = 8 + r() * 6; u < t.largo - 5; u += 26) cosas.push([Math.round(u), ladoFarol * borde, 'farol', 0]);
  if (o.arboles !== false) for (let u = 6 + r() * 5; u < t.largo - 5; u += 11 + r() * 8) verdes.push([Math.round(u), -ladoFarol * (borde + 0.3), r() < 0.7 ? 'lenga' : 'alamo', 0.75 + r() * 0.3]);
  return t;
}
// Las dos piezas con las que se arma un pueblo sobre un trazado T (r: de donde sale el azar):
//   cuadra(largo, mas, o): una recta con casas a los dos lados, faroles y arboles
//   esquina(lado, mas): una esquina de 90 grados (lado 1 = a la derecha). La calle por la que se venia sigue derecho, y la
//     que se toma tambien sigue para el otro lado: las dos van cerradas con vallas. En la esquina de enfrente, un edificio.
const CALLE = { ancho: 7, suelo: 'asfalto', pendiente: 0, plano: 17, vereda: 2.2, hombro: 6, lineas: 'calle' };
function pueblo(T, r) {
  const cuadra = (largo, mas, o) => arbolado(casas(T.recta(largo, mas), r, o), r, o);
  const esquina = (lado, mas) => {
    const t = T.curva(8, 90 * lado, mas);
    t.bocas = [[0, 0, 34, t.ancho], [t.largo, 180, 34, t.ancho]];
    t.casas = [[Math.round(t.largo / 2), -lado * (8 + t.ancho / 2 + 2.2 + 8), r() < 0.6 ? 'edificio' : 'almacen', 45 * lado, Math.floor(r() * 1000)]];
    t.objetos = [[Math.round(t.largo / 2), lado * (t.ancho / 2 + 1.4), 'farol', 0]];
    return t;
  };
  return { cuadra, esquina };
}
function urbano() {
  const T = trazado(), r = azar(7301), { cuadra, esquina } = pueblo(T, r);
  const calle = CALLE;
  const avenida = { ancho: 9.5, suelo: 'asfalto', lineas: 'ruta' }, empedrado = { suelo: 'adoquin', lineas: null }, deCalle = { ancho: 7, suelo: 'asfalto', lineas: 'calle' };

  // la largada, en la avenida de entrada al pueblo
  T.fijar(calle).fijar(avenida);
  const largada = T.recta(64, { plano: 12, vereda: null });
  largada.publico = [[20, -(9.5 / 2 + 7), 7], [27, 9.5 / 2 + 7.5, 6]];
  cuadra(58, null, { desde: 10 });
  esquina(1);
  // primeras cuadras, de asfalto. Lo primero que aparece en la calle es blando: cajones, un tacho, unas cubiertas
  T.fijar(deCalle);
  cuadra(56, { objetos: [[26, 2.5, 'cajones', 15], [28.5, 2.9, 'tacho', 0], [43, -2.6, 'cubiertas', 0]] });
  esquina(-1);
  cuadra(56, { objetos: [[30, 2.3, 'volquete', 90]] });
  esquina(-1);
  // la calle del mercado: empedrada, con cajones y tachos contra el cordon
  T.fijar(empedrado);
  cuadra(62, { nota: { tipo: 'adoquin' }, objetos: [[12, 2.7, 'cajones', 10], [14, -2.8, 'tacho', 0], [26, -2.6, 'cajones', 80], [33, 2.8, 'tacho', 0], [35, 2.7, 'tacho', 0], [47, -2.7, 'cubiertas', 0], [52, 2.6, 'cajones', 30]] }, { tipos: [['almacen', 3], ['edificio', 2], ['casita', 1]] });
  T.recta(16, { bocas: [[8, 90, 34, 7], [8, -90, 34, 7]] });   // un cruce: se sigue derecho
  cuadra(56, { autos: [[16, -2.45, 180, 23], [36, 2.45, 0, 31]] });
  esquina(1);
  // la plaza: se la rodea por la izquierda, alrededor del monumento
  T.fijar(deCalle);
  cuadra(40, { objetos: [[30, 0, 'cono', 0], [33, 0.6, 'cono', 0], [36, 1.2, 'cono', 0]] }, { hasta: 10 });
  T.curva(11, 50, { nota: { tipo: 'cuidado' }, vereda: 2.2 });
  const plaza = T.curva(15, -190, { casas: [[6, 3.5 + 2.8 + 5.5, 'capilla', 0, 1], [20, 3.5 + 2.8 + 4, 'edificio', 0, 12], [31, 3.5 + 2.8 + 4, 'almacen', 0, 4], [42, 3.5 + 2.8 + 4, 'edificio', 0, 33]] });
  plaza.objetos = [[25, -15, 'monumento', 0], [10, -8.5, 'banco', 90], [25, -8.5, 'banco', 90], [40, -8.5, 'banco', 90], [17, -10.5, 'cantero', 0], [33, -10.5, 'cantero', 0], [3, -6.2, 'farol', 0], [25, -6.2, 'farol', 0], [47, -6.2, 'farol', 0]];
  plaza.arboles = [[9, -12.5, 'lenga', 1.1], [18, -13.5, 'alamo', 1], [32, -13.5, 'lenga', 1.2], [41, -12.5, 'alamo', 1]];
  T.curva(11, 50);
  cuadra(48, null, { desde: 10 });
  esquina(-1);
  // el pasaje: angosto, empedrado, con las casas encima y un quiebre en el medio
  T.fijar(empedrado).fijar({ ancho: 4.8, vereda: 1, plano: 13 });
  cuadra(34, { nota: { tipo: 'angosto' } }, { retiro: 0.1, tipos: [['casita', 3], ['casa', 2], ['rancho', 1]], arboles: false });
  T.curva(8, 90, { ancho: 5.6 }); T.curva(8, -90, { ancho: 5.6 });
  cuadra(34, { objetos: [[14, 1.5, 'tacho', 0], [24, -1.5, 'cubiertas', 0]] }, { retiro: 0.1, tipos: [['casita', 3], ['casa', 2], ['rancho', 1]], arboles: false });
  T.fijar(deCalle).fijar({ vereda: 2.2, plano: 17 });
  esquina(1);
  // la avenida: ancha y derecha, pero con un colectivo parado, un lomo de burro y despues volquetes y conos
  T.fijar(avenida);
  cuadra(52, { autos: [[19, 3.9, 0, 8]], objetos: [[43, -3.4, 'colectivo', 0]] });
  cuadra(14, { nota: { tipo: 'lomo' }, lomos: [[7, 0.26, 3.2]] }, { desde: 1, hasta: 1, arboles: false });
  cuadra(64, { nota: { tipo: 'cuidado' }, objetos: [[16, 3.4, 'volquete', 90], [42, -3.4, 'volquete', 90], [28, 0.6, 'cono', 0], [30, 0, 'cono', 0], [53, -0.4, 'cono', 0], [55, 0.2, 'cono', 0]] });
  esquina(1);
  T.fijar(deCalle);
  cuadra(56, { autos: [[30, 2.45, 0, 17]], objetos: [[12, -2.6, 'tacho', 0], [13.5, -2.7, 'tacho', 0]] });
  esquina(-1);
  T.fijar(empedrado);
  cuadra(58, { nota: { tipo: 'adoquin' }, objetos: [[36, -2.3, 'volquete', 90]] });
  esquina(1);
  // la llegada, de vuelta en la avenida
  T.fijar(avenida);
  cuadra(40, null, { hasta: 2 });
  const llegada = T.recta(92, { plano: 12, vereda: null });
  llegada.publico = [[52, -(9.5 / 2 + 7), 9], [58, 9.5 / 2 + 7, 9], [78, -(9.5 / 2 + 8), 5]];
  return T.tramos;
}

// ================= VUELTA DEL CLUB: una vuelta cerrada por el pueblo, el bosque y el cerro, para practicar =================
// Gira en el sentido de las agujas del reloj. Arranca en la raya, en el medio de la recta de la ruta (hacia el norte),
// y cada pedazo dice en que ambiente esta ("bioma"): de eso salen el pasto, los arboles y el relieve de alrededor.
function practica() {
  const T = trazado(), r = azar(9113), { cuadra, esquina } = pueblo(T, r);
  // --- CAMPO: la ruta, de asfalto, entre los lotes ---
  T.fijar({ bioma: 'campo', ancho: 9, suelo: 'asfalto', pendiente: 0, lineas: 'ruta' });
  const salida = T.recta(70);
  salida.publico = [[10, -(9 / 2 + 7), 8], [16, 9 / 2 + 7.5, 7]];
  // --- el pueblo: una cuadra, la esquina, adoquines, un lomo de burro y unos conos ---
  T.fijar(CALLE).fijar({ ancho: 7.6 });
  cuadra(50, null, { desde: 4 });
  esquina(1);
  T.fijar({ suelo: 'adoquin', lineas: null });
  cuadra(58, { nota: { tipo: 'adoquin' }, objetos: [[20, 2.9, 'cajones', 20], [22.5, 3.2, 'tacho', 0], [41, -2.9, 'cubiertas', 0]] }, { tipos: [['almacen', 3], ['edificio', 2], ['casita', 1], ['casa', 2]] });
  T.fijar({ suelo: 'asfalto', lineas: 'calle' });
  cuadra(14, { nota: { tipo: 'lomo' }, lomos: [[7, 0.26, 3.2]] }, { desde: 1, hasta: 1, arboles: false });
  cuadra(44, { objetos: [[22, 0.9, 'cono', 0], [24, 0.3, 'cono', 0], [26, -0.3, 'cono', 0]] }, { hasta: 8 });
  // --- BOSQUE: se termina el asfalto. Huella de tierra entre los pinos, con un vado y un barrial ---
  T.fijar({ bioma: 'bosque', plano: null, vereda: null, hombro: null, lineas: null, ancho: 6.4, suelo: 'tierra', pendiente: 1 });
  T.recta(80, { nota: { tipo: 'ripio' }, ancho: 7 });
  T.curva(45, 40);
  T.curva(34, -62);
  T.recta(15, { pendiente: 0 });
  T.vado();
  T.curva(40, 67, { pendiente: 2 });
  T.recta(56, { suelo: 'barro', pendiente: 0, nota: { tipo: 'barro' } });
  T.curva(30, 45, { pendiente: 2 });
  T.recta(130, { pendiente: 2 });
  // --- MONTAÑA: la trepada, en zigzag: horquilla, cornisa de lajas con pirca, otra horquilla y un puente ---
  T.fijar({ bioma: 'montana', ancho: 5.6, suelo: 'ripio', pendiente: 6 });
  T.curva(26, 45);
  T.ladera('izq').fijar({ pendiente: 7 });
  T.recta(60);
  T.horquilla(-135, { publico: [[10, 9 / 2 + 8, 5]] });
  T.ladera('der', 13, 24).fijar({ pendiente: 8, ancho: 5 });
  lajas(T.recta(56), r, T.vacio()).nota = { tipo: 'cornisa' };
  T.fijar({ ancho: 5.6, pendiente: 7 });
  T.horquilla(140);
  T.ladera('izq');
  T.recta(40);
  T.ladera(null).puente(11, 5, false, { tope: 10 });
  T.ladera('izq').fijar({ pendiente: 3 });
  T.recta(90);
  T.curva(30, 40, { pendiente: 1 });
  // --- la bajada: ancha y rapida, con un salto ---
  T.fijar({ ancho: 8.2, pendiente: -7 });
  T.libre(90);
  T.curva(70, 32); T.curva(70, -32);
  T.recta(40, { nota: { tipo: 'salto' } });
  T.ladera(null);
  T.recta(12, { pendiente: 5 }); T.recta(22, { pendiente: -10 });
  T.fijar({ pendiente: -7 });   // (despues del salto ya no hay vacio al costado: se aterriza tranquilo)
  T.recta(30);
  // --- CAMPO de nuevo: un camino de tierra ancho, entre alambrados, que vuelve a la ruta ---
  T.ladera(null).fijar({ bioma: 'campo', ancho: 8.4, suelo: 'tierra', pendiente: -4 });
  T.curva(46, 90);
  T.fijar({ pendiente: -1 });
  T.libre(120, { fardos: [[40, 8.4 / 2 + 1.2], [42, 8.4 / 2 + 1.6], [80, -(8.4 / 2 + 1.3)]] });
  T.fijar({ pendiente: 0 });
  // la ruta otra vez: aca esta la grilla (se larga 60 metros antes de la raya)
  T.fijar({ ancho: 9, suelo: 'asfalto', lineas: 'ruta' });
  const llegada = T.recta(90, { nota: { tipo: 'asfalto' } });
  llegada.publico = [[70, -(9 / 2 + 7), 9], [76, 9 / 2 + 7, 8]];
  return cerrar(T.tramos);
}

// Cierra una vuelta: acomoda el largo de las dos rectas "libres" para que el ultimo metro llegue al primero.
// (Lo que falte despues de redondear a metros enteros, que es menos de un metro, lo reparte terrain.js.)
function cerrar(tramos) {
  const libres = tramos.filter((t) => t.libre), rumbos = new Map();
  if (libres.length !== 2) throw new Error('Una vuelta cerrada necesita dos rectas libres, y hay ' + libres.length);
  let x = 0, z = 0, rumbo = 0;
  for (const t of tramos) {
    const m = Math.round(t.largo);
    if (t.libre) rumbos.set(t, rumbo);
    for (let j = 0; j < m; j++) { rumbo += (t.giro || 0) * RAD / m; x += Math.sin(rumbo); z -= Math.cos(rumbo); }
  }
  if (Math.abs(Math.abs(rumbo) - 2 * Math.PI) > 0.01) throw new Error('La vuelta no cierra: gira ' + (rumbo / RAD).toFixed(1) + ' grados y tienen que ser 360');
  const [a, b] = libres, ra = rumbos.get(a), rb = rumbos.get(b), det = Math.sin(rb - ra);
  if (Math.abs(det) < 0.2) throw new Error('Las dos rectas libres son casi paralelas: asi no se puede cerrar la vuelta');
  a.largo = Math.round(a.largo + (x * Math.cos(rb) + z * Math.sin(rb)) / det);
  b.largo = Math.round(b.largo + (-z * Math.sin(ra) - x * Math.cos(ra)) / det);
  if (a.largo < 20 || b.largo < 20) throw new Error('Para cerrar la vuelta, una recta libre quedaria de ' + Math.min(a.largo, b.largo) + ' metros: hay que acomodar el trazado');
  for (const t of libres) delete t.libre;
  return tramos;
}

// ================= MINA CLAVERO - GIULIO CESARE: casi 20 km de la pampa de altura al pueblo =================
// Un tramo del Rally Argentina (cerro el rally varias veces y fue Power Stage): baja desde lo alto de las Sierras Grandes
// (la pampa de Achala y Giulio Cesare, granito y pastizal) hasta Mina Clavero, en el valle de Traslasierra (~915 m).
// Esta armado "a ojo": no es el recorrido real, pero tiene sus ingredientes.
// Es seis veces mas largo que los otros, y el mapa del juego es una grilla de un metro por celda: para que no crezca sin
// limite el camino baja en zigzag por la ladera: patas larguisimas (de mas de un kilometro) que van de este a oeste y vuelven,
// unidas por horquillas, y cada una un poco mas abajo (y mas al sur) que la anterior. Las patas se abren apenas en abanico:
// pegadas en la horquilla (19 metros) y bien separadas en la otra punta (unos 120). Asi nunca hay dos partes del camino
// cerca que esten a alturas muy distintas, y el mapa queda de ~1,7 millones de celdas en vez de 10.
// Cada pata cuenta una parte: el alto de Achala (la largada), la pampa (rectas rapidas, lomas, saltos, un arroyo), la quebrada
// (curvas encadenadas entre el granito), la cuesta (laderas con pirca), el valle de Traslasierra y el pueblo.
function giulio() {
  const T = trazado(), r = azar(16005), { cuadra, esquina } = pueblo(T, r);
  // por donde va el trazado (y hacia donde mira), para poder pedir "una recta hasta tal lugar del mapa"
  // (x crece hacia el este y z hacia el sur; la largada mira al norte)
  let hecho = 0, X = 0, Z = 0, mira = 0;
  const donde = () => {
    for (; hecho < T.tramos.length; hecho++) {
      const t = T.tramos[hecho], m = Math.round(t.largo);
      for (let j = 0; j < m; j++) { mira += (t.giro || 0) * RAD / m; X += Math.sin(mira); Z -= Math.cos(mira); }
    }
    return { x: X, z: Z, mira };
  };
  const rec = (largo, mas) => T.recta(largo, mas);
  const cur = (radio, angulo, mas) => T.curva(radio, angulo, mas);
  const horq = (angulo, mas) => T.horquilla(angulo, mas);
  // una recta que llega justo a tal lugar del mapa (x)
  let numPata = 1;
  const hastaX = (x, mas) => {
    const d = donde(), largo = (x - d.x) / Math.sin(d.mira);
    if (largo < 8) throw new Error('giulio: pata ' + numPata + ': falta lugar para llegar a x=' + x + ' (hay ' + largo.toFixed(0) + ', estaba en x=' + d.x.toFixed(0) + ')');
    return rec(largo, mas);
  };
  // curvas encadenadas: [radio, grados] uno atras de otro (los grados tienen que sumar cero, para seguir en el mismo rumbo)
  const cadena = (lista, mas) => {
    if (Math.abs(lista.reduce((s, c) => s + c[1], 0)) > 0.01) throw new Error('giulio: la cadena de curvas no vuelve a su rumbo');
    lista.forEach(([radio, grados], k) => cur(radio, grados, k === 0 ? mas : null));
  };
  // una "ese" que no corre el camino de lado: dobla, dobla para el otro lado el doble y vuelve a su rumbo
  const ese = (radio, angulo, mas) => cadena([[radio, angulo], [radio, -2 * angulo], [radio, angulo]], mas);
  // lomas: unas olas en el camino, de 22 metros cada ola
  const lomas = (n, base, largo = 22) => { for (let k = 0; k < n; k++) { rec(largo, { pendiente: base + 3 }); rec(largo, { pendiente: base - 3.4 }); } };
  // un salto: la loma que despega y la bajada donde se cae (como el de la Bajada del Portezuelo)
  const salto = (base, mas) => { const t = rec(40, Object.assign({ nota: { tipo: 'salto' } }, mas)); rec(14, { pendiente: base + 5 }); rec(24, { pendiente: base - 11 }); return t; };
  // un baden: el camino se hunde unos metros para que pase el agua cuando llueve (empedrado)
  const baden = (base, mas) => { const t = rec(11, Object.assign({ pendiente: base - 7, suelo: 'roca', nota: { tipo: 'baden' } }, mas)); rec(11, { pendiente: base + 7, suelo: 'roca' }); return t; };
  // las patas: la que va al este tiene el cerro a la izquierda (al norte); la que vuelve al oeste, a la derecha
  const cerro = (este, cuanto = 12, cae = 24) => T.ladera(este ? 'izq' : 'der', cuanto, cae);
  const ESTE = 1370, OESTE = 40;   // hasta donde llega cada pata (donde empieza la horquilla)
  // la horquilla del extremo: hacia la derecha en el este, hacia la izquierda en el oeste. Giran 175 grados y no 180:
  // asi la pata que vuelve se va abriendo de a poco y no se pisa con la anterior
  const punta = (este, mas) => { numPata++; return horq(este ? 175 : -175, mas); };
  const publicoEn = (este, n) => ({ publico: [[10, (este ? 1 : -1) * (9 / 2 + 8), n]] });

  // ---------- 1. EL ALTO DE ACHALA: la largada, arriba, en la pampa de altura ----------
  T.fijar({ bioma: 'sierra', ancho: 9.4, suelo: 'ripio', pendiente: -1.5 });
  const largada = rec(64);
  largada.publico = [[20, -(9.4 / 2 + 7), 7], [26, 9.4 / 2 + 7.5, 6]];
  cur(45, 90);
  rec(100);
  ese(300, 7);
  rec(150);
  lomas(3, -1.5);
  rec(100);
  ese(130, 18);
  rec(110);
  salto(-1.5).publico = [[28, 9.4 / 2 + 6, 6], [31, -(9.4 / 2 + 7), 5]];
  hastaX(ESTE);
  punta(true, publicoEn(true, 6));

  // ---------- 2. LA BAJADA DE ACHALA: la primera cuesta, angosta, con el cerro a un lado y la caida al otro ----------
  T.fijar({ ancho: 7.2, pendiente: -4.4 });
  cerro(false, 12, 28);
  rec(80, { pirca: T.vacio(), nota: { tipo: 'cornisa' } });
  ese(110, 12, { pirca: T.vacio() });
  rec(60, { pirca: T.vacio() });
  ese(80, 18);
  piedras(rec(100), r, 12, [1]);
  ese(150, 10);
  hastaX(OESTE, { pirca: T.vacio() });
  T.ladera(null);
  punta(false, publicoEn(false, 5));
  cerro(true, 12, 28);
  T.fijar({ pendiente: -4.1 });
  rec(60, { pirca: T.vacio() });
  ese(90, 16);
  rec(60, { pirca: T.vacio() });
  lajas(rec(54), r, T.vacio());
  rec(60, { pirca: T.vacio() });
  ese(120, 12);
  hastaX(ESTE, { pirca: T.vacio() });
  T.ladera(null);
  punta(true);
  // ---------- 3. LA PAMPA DE ACHALA: lo mas rapido, ancho y en bajada suave ----------
  T.fijar({ ancho: 9.8, pendiente: -1.8 });
  rec(250);
  ese(500, 5);
  rec(100);
  lomas(4, -1.8);
  rec(120);
  salto(-1.8).publico = [[24, -(9.8 / 2 + 7), 7]];
  rec(80);
  ese(140, 16);
  hastaX(OESTE);
  punta(false);
  // un arroyo de altura y un baden
  T.fijar({ ancho: 9.2, pendiente: -2 });
  rec(200);
  ese(200, 8);
  baden(-2);
  rec(160);
  T.vado(0.3);
  rec(200);
  lomas(3, -2);
  hastaX(ESTE);
  punta(true);
  // la recta larga, y dos saltos
  T.fijar({ ancho: 10, pendiente: -2.2 });
  rec(300);
  ese(700, 4);
  rec(160);
  salto(-2.2).publico = [[26, 10 / 2 + 7, 8], [30, -(10 / 2 + 7), 6]];
  rec(90);
  ese(120, 14);
  rec(40);
  salto(-2.2);
  hastaX(OESTE);
  punta(false);
  T.fijar({ ancho: 9, pendiente: -2.4 });
  rec(200);
  lomas(3, -2.4);
  rec(200);
  ese(260, 8);
  hastaX(ESTE);
  punta(true);
  // ---------- 4. LA QUEBRADA: curvas encadenadas entre el granito, un puente y un vado ----------
  T.fijar({ ancho: 7.4, pendiente: -3.2 });
  rec(60);
  ese(90, 20);
  piedras(rec(50), r, 10, [1]);
  ese(60, 25, { nota: { tipo: 'cuidado' } });
  rec(40);
  ese(100, 15);
  rec(50);
  T.ladera(null).puente(10, 4, false, { tope: 12 });
  rec(60);
  ese(75, 22);
  rec(60);
  T.vado(0.32);
  rec(60);
  ese(110, 17);
  hastaX(OESTE);
  punta(false);
  rec(80);
  ese(95, 20);
  piedras(rec(80), r, 11, [-1]);
  baden(-3.4);
  ese(70, 28, { nota: { tipo: 'cuidado' } });
  rec(100);
  ese(130, 14);
  rec(100);
  lomas(2, -3.4);
  hastaX(ESTE);
  punta(true);
  // ---------- 5. LA CUESTA: laderas con pirca, bajando fuerte ----------
  T.fijar({ ancho: 6.4, pendiente: -4.9 });
  cerro(false, 14, 30);
  rec(70, { pirca: T.vacio(), nota: { tipo: 'cornisa' } });
  ese(120, 10, { pirca: T.vacio() });
  rec(120, { pirca: T.vacio() });
  ese(85, 20);
  rec(70, { pirca: T.vacio() });
  lajas(rec(50), r, T.vacio());
  rec(90, { pirca: T.vacio() });
  ese(100, 14);
  hastaX(OESTE, { pirca: T.vacio() });
  T.ladera(null);
  punta(false, publicoEn(false, 6));
  cerro(true, 14, 30);
  rec(90, { pirca: T.vacio() });
  ese(95, 18);
  rec(100, { pirca: T.vacio() });
  ese(140, 9, { pirca: T.vacio() });
  rec(80, { pirca: T.vacio() });
  ese(70, 25);
  hastaX(ESTE, { pirca: T.vacio() });
  T.ladera(null);
  punta(true);
  // ---------- 6. LAS GAMAS: la sierra se va abriendo hacia el valle ----------
  T.fijar({ ancho: 8, pendiente: -3.7 });
  rec(100);
  ese(120, 14);
  rec(100);
  T.vado(0.3);
  rec(80);
  ese(150, 10);
  baden(-3.7);
  rec(80);
  salto(-3.7);
  hastaX(OESTE);
  punta(false);
  // ---------- 7. EL VALLE DE TRASLASIERRA ----------
  T.fijar({ bioma: 'campo', ancho: 8.4, pendiente: -2.7, suelo: 'tierra' });
  rec(200);
  ese(260, 7);
  lomas(3, -2.7);
  rec(200);
  salto(-2.7);
  hastaX(ESTE);
  punta(true);
  T.fijar({ ancho: 7.8, pendiente: -2.1, suelo: 'ripio' });
  rec(60);
  cadena([[200, -32], [200, 32]]);
  rec(60);
  T.puente(10, 3, true, { tope: 14 });
  rec(70);
  // el rio, con sus playas: el camino baja, lo cruza por el lecho y vuelve a subir
  T.fijar({ ancho: 9 });
  T.vado(0.34);
  T.fijar({ ancho: 7.8 });
  hastaX(760);
  // ---------- 8. MINA CLAVERO: el rio, la entrada al pueblo y las esquinas ----------
  // la entrada al pueblo, por la avenida
  const avenida = { ancho: 9.5, suelo: 'asfalto', lineas: 'ruta' }, empedrado = { suelo: 'adoquin', lineas: null }, deCalle = { ancho: 7, suelo: 'asfalto', lineas: 'calle' };
  T.fijar(CALLE).fijar({ pendiente: -0.9 }).fijar(avenida);
  cuadra(130, null, { desde: 8 });
  T.fijar(deCalle);
  esquina(-1);
  cuadra(56, { objetos: [[26, 2.5, 'cajones', 15], [28.5, 2.9, 'tacho', 0], [43, -2.6, 'cubiertas', 0]] });
  esquina(1);
  T.fijar(empedrado);
  cuadra(62, { nota: { tipo: 'adoquin' }, objetos: [[12, 2.7, 'cajones', 10], [14, -2.8, 'tacho', 0], [33, 2.8, 'tacho', 0], [47, -2.7, 'cubiertas', 0]] }, { tipos: [['almacen', 3], ['edificio', 2], ['casita', 1]] });
  esquina(1);
  T.fijar(deCalle);
  cuadra(56, { autos: [[20, 2.45, 0, 17]] });
  esquina(-1);
  cuadra(70, { objetos: [[30, 0, 'cono', 0], [33, 0.6, 'cono', 0], [36, 1.2, 'cono', 0]] }, { hasta: 10 });
  // la plaza: se la rodea por la izquierda
  T.curva(11, 50, { nota: { tipo: 'cuidado' }, vereda: 2.2 });
  const plaza = T.curva(15, -190, { casas: [[6, 3.5 + 2.8 + 5.5, 'capilla', 0, 1], [20, 3.5 + 2.8 + 4, 'edificio', 0, 12], [31, 3.5 + 2.8 + 4, 'almacen', 0, 4], [42, 3.5 + 2.8 + 4, 'edificio', 0, 33]] });
  plaza.objetos = [[25, -15, 'monumento', 0], [10, -8.5, 'banco', 90], [25, -8.5, 'banco', 90], [40, -8.5, 'banco', 90], [17, -10.5, 'cantero', 0], [33, -10.5, 'cantero', 0], [3, -6.2, 'farol', 0], [25, -6.2, 'farol', 0], [47, -6.2, 'farol', 0]];
  plaza.arboles = [[9, -12.5, 'lenga', 1.1], [18, -13.5, 'alamo', 1], [32, -13.5, 'lenga', 1.2], [41, -12.5, 'alamo', 1]];
  T.curva(11, 50);
  cuadra(48, null, { desde: 10 });
  esquina(1);
  // la llegada, de vuelta en la avenida
  T.fijar(avenida);
  cuadra(40, null, { hasta: 2 });
  const llegada = rec(92, { plano: 12, vereda: null, pendiente: 0 });
  llegada.publico = [[52, -(9.5 / 2 + 7), 9], [58, 9.5 / 2 + 7, 9], [78, -(9.5 / 2 + 8), 5]];
  return T.tramos;
}

// ================= LA MONTAÑA DEL SUFRIMIENTO: un camion con carga, cuatro tramos y ninguna prisa =================
// No es una pista de rally: es para el camion de camion.js (siempre se maneja ese, con su fisica pesada). Dura unos diez minutos.
//   1. La Trampa de Barro: camino ancho de barro hondo, con pozas de pantano. Acelerar a fondo entierra: hay que dar toques.
//   2. La Escalada de Piedras: subida en zigzag llena de bloques desalineados (escalones duros) con el precipicio al costado.
//   3. La Cornisa: un camino angosto al borde del vacio...
//   4. ...cortado por una cascada que cruza y empuja hacia el barranco.
//   5. La Bajada Traicionera: pendiente empinada; frenar de golpe tira la carga para adelante.
// (Los cuatro tramos del pedido son cinco sectores: la cornisa y la cascada se cuentan aparte, asi los cuadraditos del tablero
// dicen en cual de las dos se fue la carga.)
function montana() {
  const T = trazado(), r = azar(16006);
  // el camino mide casi lo que el camion (2,4 m) mas un poco: cuesta no salirse. Las dos rodadas van justo donde van las ruedas.
  const CAMINO = 3.4;
  const redondo = (x, d = 100) => Math.round(x * d) / d;
  // pozas de pantano y islas firmes sobre un tramo de barro. [metros desde el inicio, metros a la derecha, radio, hondo, suelo]
  const poceado = (t, cada, firmes) => {
    t.pozos = [];
    const medio = t.ancho / 2 - 0.8;   // (en un camino angosto las pozas son chicas: si no, taparian todo el ancho y no habria por donde pasar)
    for (let u = 10; u < t.largo - 8; u += cada * (0.7 + r() * 0.6)) {
      t.pozos.push([redondo(u, 2), redondo((r() * 2 - 1) * medio, 10), redondo(1.2 + r() * 1.1, 10), redondo(0.12 + r() * 0.12), 'pantano']);
      if (firmes && r() < 0.55) t.pozos.push([redondo(u + 4 + r() * 5, 2), redondo((r() * 2 - 1) * medio, 10), redondo(1.0 + r() * 0.5, 10), -0.1, 'tierra']);   // una isla firme
    }
    return t;
  };
  // rodadas hondas en todo un pedazo de la pista (los tramos que se crearon desde "desde"): ver "surcos" en terrain.js.
  // (el vado no las lleva: el agua las borra)
  const surcar = (desde, q) => { for (const t of T.tramos.slice(desde)) if (!t.agua) t.surcos = q; };
  // pozos sueltos que se suman a los que ya tenga el tramo. [metros, derecha, radio, hondo, suelo]
  const pocear = (t, cada, suelo, hondo, radio) => {
    t.pozos = t.pozos || [];
    for (let u = 8; u < t.largo - 6; u += cada * (0.7 + r() * 0.6)) t.pozos.push([redondo(u, 2), redondo((r() * 2 - 1) * (t.ancho / 2 - 1.2), 10), redondo(radio * (0.8 + r() * 0.5), 10), redondo(hondo * (0.7 + r() * 0.6)), suelo]);
    return t;
  };
  // piedras y raices sueltas metidas en el barro, justo donde van las ruedas: [metros, derecha, largo, ancho, alto]
  const piedritas = (t, cada, alto) => {
    t.escalones = t.escalones || [];
    for (let u = 7; u < t.largo - 5; u += cada * (0.6 + r() * 0.8)) {
      const lado = (r() < 0.5 ? -1 : 1) * (1 + (r() - 0.5) * 0.8);
      t.escalones.push([redondo(u, 2), redondo(lado, 10), redondo(0.9 + r() * 0.7, 10), redondo(0.8 + r() * 0.6, 10), redondo(alto * (0.6 + r() * 0.6))]);
    }
    return t;
  };
  // bloques de piedra desalineados: [metros, derecha, largo, ancho, alto]. Algunos cruzan todo el camino (un escalon duro).
  const escalones = (t, cada, alto) => {
    t.escalones = [];
    const medio = t.ancho / 2;
    for (let u = 9; u < t.largo - 7; u += cada * (0.75 + r() * 0.5)) {
      const q = r();
      if (q < 0.22) t.escalones.push([redondo(u, 2), 0, 1.6, t.ancho, redondo(alto * (0.55 + r() * 0.3))]);
      else {
        const ancho = redondo(2 + r() * 1.6, 10), lado = (r() < 0.5 ? -1 : 1) * (medio - ancho / 2 - 0.2 - r() * 0.9);
        t.escalones.push([redondo(u, 2), redondo(lado, 10), redondo(1.8 + r() * 1.8, 10), ancho, redondo(alto * (0.6 + r() * 0.7))]);
        if (q > 0.7) t.escalones.push([redondo(u + 3 + r() * 2, 2), redondo(-lado * 0.8, 10), redondo(2 + r() * 1.2, 10), ancho, redondo(alto * (0.5 + r() * 0.5))]);
      }
    }
    return t;
  };

  // ---------- la largada, en una playa de tierra ----------
  T.fijar({ ancho: 10, suelo: 'tierra', pendiente: 0 });
  const largada = T.recta(64);
  largada.publico = [[20, -(10 / 2 + 7), 6], [27, 10 / 2 + 7.5, 5]];

  // ---------- 1. LA TRAMPA DE BARRO ----------
  // Es un barrial con dos rodadas hondas (las de los camiones de antes) y una joroba en el medio; mas afuera, otras viejas.
  // Las ruedas caen adentro y salirse cuesta: el borde se levanta y afuera hay una zanja de pantano.
  const t1 = T.tramos.length;
  T.fijar({ ancho: CAMINO, suelo: 'barro', rugoso: 0.07 });
  piedritas(poceado(T.recta(70, { nota: { tipo: 'barro' } }), 12, true), 17, 0.16);
  T.curva(70, 32); piedritas(poceado(T.recta(44), 11, true), 17, 0.16);
  T.curva(70, -32); piedritas(poceado(T.recta(52), 11, true), 17, 0.16);
  T.curva(80, -22); piedritas(poceado(T.recta(40), 12, true), 17, 0.16);
  T.fijar({ ancho: CAMINO, suelo: 'tierra', rugoso: null });
  T.curva(60, 22);
  T.recta(26, { control: true });
  surcar(t1, { hondo: [0.14, 0.14], lomo: 0.08, banco: 0.15, cuneta: 0.45, culebra: 0.8, varia: 0.4, alterna: 0.35, charcos: 0.4, ext: 0.08, suelo: 'barro', orilla: 'pantano', orillaAncho: 5 });

  // ---------- 2. LA ESCALADA DE PIEDRAS ----------
  // (con rodadas de barro entre las piedras, charcos en los huecos y piedras sueltas justo donde van las ruedas)
  const t2 = T.tramos.length;
  T.fijar({ ancho: CAMINO, suelo: 'roca', pendiente: 8, rugoso: 0.05 });
  T.ladera('izq', 12, 24);
  pocear(piedritas(escalones(T.recta(78, { nota: { tipo: 'piedras' } }), 8.5, 0.38), 13, 0.15), 17, 'charco', 0.14, 1.4);
  T.horquilla(-170, { ancho: CAMINO });
  T.ladera('der', 12, 24);
  pocear(piedritas(escalones(T.recta(84), 7.5, 0.4), 13, 0.15), 17, 'charco', 0.14, 1.4);
  T.horquilla(170, { ancho: CAMINO });
  T.ladera('izq', 12, 24);
  pocear(piedritas(escalones(T.recta(80, { nota: { tipo: 'cuidado' } }), 7, 0.42), 13, 0.15), 17, 'charco', 0.14, 1.4);
  T.curva(26, -50); T.curva(26, 50);
  pocear(piedritas(escalones(T.recta(40), 8, 0.34), 13, 0.15), 17, 'charco', 0.14, 1.4);
  T.fijar({ pendiente: 3 });
  T.recta(24, { control: true });
  surcar(t2, { hondo: [0.09, 0.11], lomo: 0.06, banco: 0.12, cuneta: 0.3, culebra: 0.4, varia: 0.6, alterna: 0.5, charcos: 0.25, lodo: 0.85, suelo: 'barro', orilla: 'barro', orillaAncho: 4 });

  // ---------- 3. LA CORNISA: angosta, pared a la izquierda y el vacio a la derecha ----------
  // (la rodada del lado del vacio es la mas honda: el camion se inclina hacia el barranco y la carga se corre)
  const t3 = T.tramos.length;
  T.ladera('izq', 16, 32).fijar({ ancho: CAMINO, suelo: 'tierra', pendiente: 1.5, rugoso: 0.03 });
  T.recta(40, { nota: { tipo: 'cornisa' } });
  T.curva(46, 26); T.curva(46, -26);
  pocear(T.recta(36), 14, 'charco', 0.12, 1.1);
  T.curva(52, -22); T.curva(52, 22);
  T.recta(30, { control: true });

  // ---------- 4. LA CASCADA: cruza la cornisa y empuja hacia el vacio (el agua corre hacia la derecha) ----------
  const agua = T.vado(0.46);
  const llega = T.tramos[T.tramos.length - 3], vado0 = T.tramos.length - 3;
  llega.nota = { tipo: 'cascada' };
  agua.ancho = CAMINO;
  // el agua llega desde la ladera (izquierda) y se derrama por el borde (a la derecha); la corriente empuja 4,6 m/s2
  agua.agua = { hondo: 0.46, largo: 60, entre: [-30, 3.6], empuje: 3.0 };
  T.recta(26);
  T.curva(44, 24); T.curva(44, -24);
  T.recta(24, { control: true });
  surcar(t3, { hondo: [0.08, 0.17], lomo: 0.07, banco: 0.22, cuneta: 0.3, culebra: 0.3, varia: 0.3, alterna: 0.15, charcos: 0.3, lodo: 0.6, suelo: 'barro', orilla: 'pantano', orillaAncho: 3 });
  for (const t of T.tramos.slice(vado0, vado0 + 3)) t.surcos = undefined;   // (en el cruce del arroyo no hay rodadas: el agua las borro)

  // ---------- 5. LA BAJADA TRAICIONERA: empinada, de ripio, con curvas que piden frenar ----------
  // (con surcos que lavo el agua: hondos, angostos y torcidos, y una rodada mas honda que la otra por tramos)
  const t4 = T.tramos.length;
  T.ladera('izq', 14, 28).fijar({ ancho: CAMINO, suelo: 'ripio', pendiente: -12, rugoso: 0.04 });
  T.recta(86, { nota: { tipo: 'bajada' } });
  T.curva(30, -62);
  pocear(T.recta(56), 16, 'charco', 0.16, 1.3);
  T.horquilla(150, { ancho: CAMINO });
  pocear(T.recta(60, { pendiente: -13 }), 16, 'charco', 0.16, 1.3);
  T.curva(36, -46);
  T.recta(36, { pendiente: -9 });
  surcar(t4, { hondo: [0.26, 0.26], lomo: 0.14, banco: 0.2, cuneta: 0.35, culebra: 0.8, varia: 0.8, alterna: 0.6, charcos: 0.3, suelo: 'tierra', orilla: 'barro', orillaAncho: 4 });
  // la llegada, abajo
  T.ladera(null).fijar({ pendiente: 1, ancho: 9 });
  const llegada = T.recta(92);
  llegada.pendiente = 0;
  llegada.publico = [[52, -(9 / 2 + 7), 8], [58, 9 / 2 + 7, 7]];
  return T.tramos;
}

const ARMAR = { subida, bajada, urbano, practica, giulio, montana };

// Arma la etapa de un circuito (lo mismo que devuelve generarPista para un dia).
export function armarCircuito(numero) {
  const c = circuitoDe(numero);
  if (!c) throw new Error('No existe el circuito ' + numero);
  const tramos = ARMAR[c.id]();
  for (const t of tramos) for (const k in t) if (t[k] === undefined) delete t[k];
  // los cuatro controles que parten la pista en cinco sectores (un circuito puede traerlos ya puestos, en lugares que elige el)
  let total = 0, hecho = 0, sector = 1;
  for (const t of tramos) total += t.largo;
  if (!tramos.some((t) => t.control)) tramos.forEach((t, i) => {
    hecho += t.largo;
    if (sector <= 4 && i < tramos.length - 2 && hecho >= total * sector / 5 - t.largo / 2) { t.control = true; sector++; }
  });
  // (biomas: los ambientes por los que pasa, en el orden en que aparecen; casi siempre es uno solo)
  const biomas = [...new Set(tramos.map((t) => t.bioma || c.bioma))];
  return { numero, fijo: c.id, ...(c.camion ? { camion: true } : {}), vuelta: !!c.vuelta, nombre: c.nombre, lugar: c.lugar, bioma: c.bioma, biomas, clima: c.clima, caracter: c.caracter, semilla: 7700 + numero, rumbo: 0, largo: total, tramos, vueltasAtras: 0, intentos: 1, maximo: c.maximo };
}

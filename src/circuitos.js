// Circuitos fijos: pistas escritas a mano, siempre las mismas, para seguir corriendo ademas de la del dia.
// Cada una es una lista de tramos como las que arma el generador (ver al principio de generador.js que lleva
// cada tramo), pero elegidos uno por uno. Para cambiar un circuito alcanza con tocar su lista.
import { azar } from './noise.js';
import { EDIFICIOS } from './edificios.js';

const RAD = Math.PI / 180;
// Los circuitos usan numeros de pista que los dias no van a alcanzar nunca (el link de un resultado guarda ese numero).
// version: hay que subirla cada vez que se toca el recorrido de ese circuito (o algo del terreno que lo cambie). Con eso,
// los tiempos y los fantasmas guardados de la version anterior se descartan solos: eran de otro camino.
export const CIRCUITOS = [
  { id: 'subida', numero: 16001, version: 1, nombre: 'Subida a Mina Vieja', corto: 'Subida', emoji: '⛰️', bioma: 'montana', clima: 'sol', caracter: 'tecnica', lugar: '38°51′S 70°58′O',
    detalle: 'Angosta y empinada, con puentes y lajas. No hay velocidad: es pura técnica.' },
  { id: 'bajada', numero: 16002, version: 1, nombre: 'Bajada del Portezuelo', corto: 'Bajada', emoji: '🦅', bioma: 'montana', clima: 'tarde', caracter: 'rapida', lugar: '38°44′S 71°02′O',
    detalle: 'Ancha, rápida y en bajada, toda de ripio suelto. Hay que llevarlo cruzado.' },
  { id: 'urbano', numero: 16003, version: 1, nombre: 'Callejero de Villa Cañada', corto: 'Urbano', emoji: '🏘️', bioma: 'campo', clima: 'sol', caracter: 'tecnica', lugar: '35°12′S 60°41′O',
    detalle: 'Entre las casas del pueblo: esquinas de 90 grados, la plaza, un pasaje angosto y cosas para esquivar.' },
];
export const esCircuito = (numero) => CIRCUITOS.some((c) => c.numero === numero);
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
function piedras(t, r, cada = 9, lados = [-1, 1]) {
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
function casas(t, r, o = {}) {
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
function arbolado(t, r, o = {}) {
  const borde = t.ancho / 2 + 1.25, cosas = t.objetos || (t.objetos = []), verdes = t.arboles || (t.arboles = []), ladoFarol = o.farol || (r() < 0.5 ? -1 : 1);
  for (let u = 8 + r() * 6; u < t.largo - 5; u += 26) cosas.push([Math.round(u), ladoFarol * borde, 'farol', 0]);
  if (o.arboles !== false) for (let u = 6 + r() * 5; u < t.largo - 5; u += 11 + r() * 8) verdes.push([Math.round(u), -ladoFarol * (borde + 0.3), r() < 0.7 ? 'lenga' : 'alamo', 0.75 + r() * 0.3]);
  return t;
}
function urbano() {
  const T = trazado(), r = azar(7301);
  const calle = { ancho: 7, suelo: 'asfalto', pendiente: 0, plano: 17, vereda: 2.2, hombro: 6, lineas: 'calle' };
  const avenida = { ancho: 9.5, suelo: 'asfalto', lineas: 'ruta' }, empedrado = { suelo: 'adoquin', lineas: null }, deCalle = { ancho: 7, suelo: 'asfalto', lineas: 'calle' };
  // una cuadra: una recta con casas a los dos lados, faroles y arboles
  const cuadra = (largo, mas, o) => arbolado(casas(T.recta(largo, mas), r, o), r, o);
  // una esquina de 90 grados (lado 1 = a la derecha). La calle por la que se venia sigue derecho, y la que se toma
  // tambien sigue para el otro lado: las dos van cerradas con vallas. En la esquina de enfrente, un edificio.
  const esquina = (lado, mas) => {
    const t = T.curva(8, 90 * lado, mas);
    t.bocas = [[0, 0, 34, t.ancho], [t.largo, 180, 34, t.ancho]];
    t.casas = [[Math.round(t.largo / 2), -lado * (8 + t.ancho / 2 + 2.2 + 8), r() < 0.6 ? 'edificio' : 'almacen', 45 * lado, Math.floor(r() * 1000)]];
    t.objetos = [[Math.round(t.largo / 2), lado * (t.ancho / 2 + 1.4), 'farol', 0]];
    return t;
  };

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

const ARMAR = { subida, bajada, urbano };

// Arma la etapa de un circuito (lo mismo que devuelve generarPista para un dia).
export function armarCircuito(numero) {
  const c = circuitoDe(numero);
  if (!c) throw new Error('No existe el circuito ' + numero);
  const tramos = ARMAR[c.id]();
  for (const t of tramos) for (const k in t) if (t[k] === undefined) delete t[k];
  // los cuatro controles que parten la pista en cinco sectores
  let total = 0, hecho = 0, sector = 1;
  for (const t of tramos) total += t.largo;
  tramos.forEach((t, i) => {
    hecho += t.largo;
    if (sector <= 4 && i < tramos.length - 2 && hecho >= total * sector / 5 - t.largo / 2) { t.control = true; sector++; }
  });
  return { numero, fijo: c.id, nombre: c.nombre, lugar: c.lugar, bioma: c.bioma, clima: c.clima, caracter: c.caracter, semilla: 7700 + numero, rumbo: 0, largo: total, tramos, vueltasAtras: 0, intentos: 1 };
}

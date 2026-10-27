// La hoja de una pista de la comunidad: lo que arma un jugador en el creador, nota por nota (ver creador.js).
// Una hoja es { v: 1, a: ambiente, c: clima, p: [piezas] }. Con eso alcanza para armar siempre el mismo camino, en
// cualquier aparato, como las pistas del dia (que salen de un numero) y los circuitos (escritos a mano en circuitos.js).
// La guarda el servidor y dura dos semanas (ver COMUNIDAD en circuitos.js).
//
// Las piezas son las mismas que usa el generador para las pistas del dia, pero las elige el jugador, una por una:
//   curvas   'd3' = derecha 3, 'i5' = izquierda 5 (del 1, la mas cerrada, al 6, casi recta); 'dh' / 'ih' horquilla;
//            'de' / 'ie' esquina de 90
//   rectas   'r1' corta, 'r2' mediana, 'r3' larga
//   camino   'sa' salto, 'va' vado, 'pu' puente, 'ba' barro, 'an' angosto, 'lo' lomo de burro, 'pb' pueblo;
//            en la montaña, ademas, 'co' cornisa y 'la' lajas
//   objetos  'ge' publico, 'pi' piedras, 'cn' conos, 'fa' fardos. No son camino: van en la pieza de antes.
//   ajustes  cambian como son las piezas que vienen DESPUES (hasta el proximo ajuste del mismo tipo). No miden nada:
//            tipo de camino 'Th' huella de bosque, 'Tc' camino de campo, 'Tr' ripio de montaña, 'Tu' ruta vieja, 'Tb' barrial, 'Tp' pasto;
//            ancho 'A1' (una huella) a 'A5' (un playon), 'A3' es el normal;   deformacion 'Z0' (liso) a 'Z4' (muy roto);
//            relieve 'L0' (plano), 'L1' normal, 'L2' lomas fuertes, 'L3' medanos (subidas y bajadas seguidas).
//   La hoja puede traer tambien "h": la hora del dia (manana, mediodia, tarde, atardecer o noche). Es solo la luz.
// Antes de la primera pieza va la largada y despues de la ultima, la llegada: las pone esto solo.
//
// El camino no se puede cruzar con si mismo ni salirse del campo (lo mismo que cuida el generador): una pieza que no entra
// se rechaza. Asi el creador sabe enseguida si la nota que se eligio va o no.
import { BIOMAS, CLIMAS, CURVAS, VIAS, trazar, crearOcupado, semilla, elegir, entre, redondo, deformarTramo } from './generador.js';
import { piedras, casas, arbolado } from './circuitos.js';
import { azar } from './noise.js';

const RAD = Math.PI / 180;
export const VERSION_DE_HOJA = 1;
// lo que entra en una hoja
export const TOPES = { piezas: 40, objetos: 30, ajustes: 30, minimo: 700, maximo: 3200 };   // piezas de camino, objetos, metros de camino (con largada y llegada)
// De donde no se puede salir, y cuanto tienen que quedar separadas dos partes del camino. Es mas grande y un poco menos
// exigente que en el generador: el que arma una pista no ve el mapa, y con el campo del generador se encerraba enseguida.
// La pista arranca en el (0, 0) mirando al norte (z negativo), que es para donde suele ir: por eso el campo es largo.
// Lo que de verdad se limita es la superficie del terreno que hay que armar (el rectangulo que ocupa la pista, mas los
// 74 metros de margen que le agrega terrain.js): hasta casi el doble que la pista del dia mas grande. Asi tarda poco en
// cargar tambien en un celular, sea una pista larga y derecha o una corta y enroscada.
// (Probado con hojas armadas al azar, como las armaria alguien: asi casi nunca queda sin ninguna pieza que entre.)
const CAMPO = { x0: -500, x1: 500, z0: -1500, z1: 300 };
const SUPERFICIE = 1250000;   // m2
const SEPARA = 42;
const LLEGADA = 72;                 // metros de la recta de llegada
const LUGAR_PARA_LLEGAR = 72;       // despues de cada pieza tiene que quedar lugar para la llegada: asi siempre se puede terminar

// --- las piezas: para que sirve cada una y como se ve en el creador ---
// grupo: curvas, rectas, camino u objetos.  nota: la nota del copiloto que la representa (su dibujo).  icono: si no tiene nota.
// nombre: lo que dice el boton (para el que no ve el dibujo).  solo: en que ambiente se puede usar.
export const PIEZAS = {};
const GRADOS = [6, 5, 4, 3, 2, 1, 'h', 'e'];
for (const [l, lado, cual] of [['i', 'izq', 'izquierda'], ['d', 'der', 'derecha']]) {
  for (const g of GRADOS) {
    PIEZAS[l + g] = { grupo: 'curvas', nota: { tipo: 'curva', lado, grado: g },
      nombre: g === 'h' ? 'Horquilla a la ' + cual : g === 'e' ? 'Esquina de 90 a la ' + cual : cual[0].toUpperCase() + cual.slice(1) + ' ' + g };
  }
}
Object.assign(PIEZAS, {
  r1: { grupo: 'rectas', nota: { tipo: 'recta' }, largo: 50, nombre: 'Recta corta (50 m)' },
  r2: { grupo: 'rectas', nota: { tipo: 'recta' }, largo: 100, nombre: 'Recta mediana (100 m)' },
  r3: { grupo: 'rectas', nota: { tipo: 'recta' }, largo: 180, nombre: 'Recta larga (180 m)' },
  sa: { grupo: 'camino', nota: { tipo: 'salto' }, nombre: 'Salto' },
  va: { grupo: 'camino', nota: { tipo: 'vado' }, nombre: 'Vado' },
  pu: { grupo: 'camino', nota: { tipo: 'puente' }, nombre: 'Puente' },
  ba: { grupo: 'camino', nota: { tipo: 'barro' }, nombre: 'Barro' },
  an: { grupo: 'camino', nota: { tipo: 'angosto' }, nombre: 'Angosto' },
  lo: { grupo: 'camino', nota: { tipo: 'lomo' }, nombre: 'Lomo de burro' },
  pb: { grupo: 'camino', nota: { tipo: 'pueblo' }, nombre: 'Pueblo' },
  co: { grupo: 'camino', nota: { tipo: 'cornisa' }, nombre: 'Cornisa', solo: 'montana' },
  la: { grupo: 'camino', nota: { tipo: 'lajas' }, nombre: 'Lajas', solo: 'montana' },
  ge: { grupo: 'objetos', icono: 'publico', nombre: 'Público' },
  pi: { grupo: 'objetos', icono: 'piedras', nombre: 'Piedras' },
  cn: { grupo: 'objetos', icono: 'cono', nombre: 'Conos' },
  fa: { grupo: 'objetos', icono: 'fardo', nombre: 'Fardos' },
});
// los ajustes: tipo de camino, ancho, deformacion y relieve de las piezas que siguen
export const HORAS_DE_HOJA = ['manana', 'mediodia', 'tarde', 'atardecer', 'noche'];
const AJUSTE_VIA = { Th: 'huella', Tc: 'campo', Tr: 'ripio', Tu: 'ruta', Tb: 'barrial', Tp: 'pasto' };
for (const id in AJUSTE_VIA) PIEZAS[id] = { grupo: 'ajustes', ajuste: 'via', valor: AJUSTE_VIA[id], icono: 'camino-' + AJUSTE_VIA[id], nombre: VIAS[AJUSTE_VIA[id]].nombre };
['Una huella (muy angosto)', 'Angosto', 'Normal', 'Ancho', 'Playón (muy ancho)'].forEach((n, k) => { PIEZAS['A' + (k + 1)] = { grupo: 'ajustes', ajuste: 'ancho', valor: k, icono: 'ancho-' + (k + 1), nombre: 'Ancho: ' + n }; });
['Liso', 'Algo de rodada', 'Rodadas y pozos', 'Muy roto', 'Un desastre'].forEach((n, k) => { PIEZAS['Z' + k] = { grupo: 'ajustes', ajuste: 'rot', valor: k, icono: 'rotura-' + k, nombre: 'Deformación: ' + n }; });
['Plano', 'Normal', 'Lomas fuertes', 'Médanos'].forEach((n, k) => { PIEZAS['L' + k] = { grupo: 'ajustes', ajuste: 'rel', valor: k, icono: 'relieve-' + k, nombre: 'Relieve: ' + n }; });
const ROTURA = [0, 0.2, 0.45, 0.72, 1], ANCHOS = [3.9, 5.4, 0, 9.6, 14], RELIEVE = [0.35, 1, 1.8, 1];
export const esAjuste = (id) => !!PIEZAS[id] && PIEZAS[id].grupo === 'ajustes';
const esObjeto = (id) => PIEZAS[id] && PIEZAS[id].grupo === 'objetos';
export const sePuede = (id, ambiente) => !!PIEZAS[id] && (!PIEZAS[id].solo || PIEZAS[id].solo === ambiente);

// Lee una hoja que llega de afuera (del servidor, de un link o del borrador guardado): la devuelve limpia, o null si no
// sirve. Revisa la forma, no el camino (eso lo hace armarHoja). La usa tambien el servidor.
export function leerHoja(x) {
  if (!x || typeof x !== 'object' || x.v !== VERSION_DE_HOJA || !BIOMAS[x.a] || !CLIMAS[x.c] || !Array.isArray(x.p)) return null;
  const p = x.p.filter((id) => typeof id === 'string' && sePuede(id, x.a));
  if (p.length !== x.p.length) return null;
  const objetos = p.filter(esObjeto).length, ajustes = p.filter(esAjuste).length;
  if (p.length - objetos - ajustes > TOPES.piezas || objetos > TOPES.objetos || ajustes > TOPES.ajustes) return null;
  if (x.h !== undefined && !HORAS_DE_HOJA.includes(x.h)) return null;
  return x.h ? { v: VERSION_DE_HOJA, a: x.a, c: x.c, p, h: x.h } : { v: VERSION_DE_HOJA, a: x.a, c: x.c, p };
}
// la huella de una hoja: un numero que sale siempre igual de la misma hoja (es la semilla de su azar)
export function huellaDeHoja(h) {
  const texto = h.a + '|' + h.c + '|' + h.p.join(',');
  let n = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) { n ^= texto.charCodeAt(i); n = Math.imul(n, 0x01000193) >>> 0; }
  return n >>> 0;
}

// Arma el camino de una hoja. Devuelve { etapa, largo } o, si una pieza no entra, { error, cual } (cual: en que lugar de la
// lista esta la pieza que no entra). error: 'hoja' (la hoja no se puede leer), 'cruza' (por ahi el camino se cruza con lo
// anterior, o se sale del campo), 'larga' (pasa del maximo) o 'corta' (no llega al minimo: igual devuelve la etapa).
// numero: el de la pista (13000 a 15999; el borrador, 12999). nombre: el que le puso su creador.
export function armarHoja(entrada, numero = 0, nombre = '') {
  const hoja = leerHoja(entrada);
  if (!hoja) return { error: 'hoja', cual: -1 };
  const idBioma = hoja.a, idClima = hoja.c, bioma = BIOMAS[idBioma], clima = CLIMAS[idClima], huella = huellaDeHoja(hoja);
  // El azar sale del ambiente y del clima, no de toda la hoja: asi, agregar una pieza al final no cambia nada de lo que ya
  // estaba (si dependiera de la hoja entera, cambiaria todo el camino cada vez que se agrega algo).
  // Lo que mueve el camino (lo poco que se tuercen las rectas) tiene su propio azar, que no depende de nada: asi, cambiar el
  // ambiente o el clima cambia el suelo y el paisaje, pero el recorrido queda igual y todo lo que entraba sigue entrando.
  const r = azar(semilla(Object.keys(BIOMAS).indexOf(idBioma) * 8 + Object.keys(CLIMAS).indexOf(idClima), 4242)), rumbo = azar(semilla(4242, 7));
  const anchoBase = entre(r, bioma.ancho[0], bioma.ancho[1]);

  const ocupado = crearOcupado(24), piezas = [];
  let pos = { x: 0, z: 0, rumbo: 0 }, metros = 0;
  const caja = { x0: 0, x1: 0, z0: 0, z1: 0 };   // el rectangulo que ocupa lo ya trazado
  let suelo = elegir(r, bioma.suelos), cambiaSuelo = entre(r, 140, 380);
  let pend = 0, alto = 0, cornisa = 0, ladoCornisa = 1;
  // los ajustes (ver arriba): lo que siguen valiendo para las piezas que vienen. Sin ajustes, todo sale como siempre.
  const aj = { via: null, ancho: null, rot: null, rel: null };
  let anchoAhora = 0, signo = 1;
  // lo que cambia al armar una pieza, para poder deshacerla si no entra
  const foto = () => ({ suelo, cambiaSuelo, pend, alto, cornisa, anchoAhora, signo });
  const volver = (f) => ({ suelo, cambiaSuelo, pend, alto, cornisa, anchoAhora, signo } = f);

  // --- lo mismo que hace el generador para cada tramo: suelo, ancho, pendiente y, en la cornisa, la pared y el vacio ---
  function pendiente(factor = 1) {
    const [paso, maxima] = bioma.pendiente, rel = aj.rel === null ? 1 : RELIEVE[aj.rel];
    pend = pend * 0.6 + (r() * 2 - 1) * paso * rel - alto / 26;
    pend = Math.max(-maxima * Math.max(1, rel), Math.min(maxima * Math.max(1, rel), pend)) * factor;
    return redondo(pend);
  }
  function base(largo, extra) {
    const t = Object.assign({ largo: Math.round(largo), suelo, ancho: redondo(anchoBase + (r() - 0.5) * 0.8) }, extra);
    if (aj.ancho !== null) {   // el ancho elegido, con transicion (como mucho 14 cm por metro)
      const meta = aj.ancho === 2 ? anchoBase : ANCHOS[aj.ancho];
      anchoAhora = anchoAhora ? anchoAhora + Math.max(-0.14 * largo, Math.min(0.14 * largo, meta - anchoAhora)) : meta;
      if (extra === undefined || extra.ancho === undefined) t.ancho = redondo(anchoAhora);
    }
    if (aj.via) { t.via = aj.via; t.rot = ROTURA[aj.rot === null ? 1 : aj.rot]; }
    else if (aj.rot !== null) { t.via = bioma.vias[0][0]; t.rot = ROTURA[aj.rot]; }
    if (t.pendiente === undefined) t.pendiente = aj.rel === 3 && !t.agua ? (signo = -signo) * redondo(entre(r, 4, 7)) : pendiente();
    alto += Math.tan(t.pendiente * RAD) * t.largo;
    if (!aj.via) {
      cambiaSuelo -= t.largo;
      if (cambiaSuelo <= 0) { suelo = elegir(r, bioma.suelos.filter((s) => s[0] !== suelo)); cambiaSuelo = entre(r, 140, 380); }
    }
    if (cornisa > 0 && !t.agua && !t.puente && !t.vereda) {
      const pared = [redondo(entre(r, 11, 18)), 9], vacio = [-redondo(entre(r, 20, 34)), 8];
      t.izq = ladoCornisa > 0 ? pared : vacio; t.der = ladoCornisa > 0 ? vacio : pared; t.hombro = 1.5;
      t.ancho = Math.min(t.ancho, 6.4);
      if (Math.abs(t.giro || 0) > 8) t.pirca = ladoCornisa > 0 ? 'der' : 'izq';   // (en las curvas, murito del lado del vacio)
      cornisa -= t.largo;
    }
    return t;
  }

  // --- las piezas de camino ---
  function recta(largo) {
    const n = Math.max(1, Math.round(largo / 60)), tramos = [];
    for (let i = 0; i < n; i++) tramos.push(base(largo / n, { giro: redondo((rumbo() - 0.5) * 6) }));
    return tramos;
  }
  // (angulo: cuantos grados dobla. Cada grado de curva admite un rango, como en el generador: el armado elige el que entra)
  function curva(grado, lado, angulo) {
    const c = CURVAS[grado], radio = grado === 'e' ? 9 : (c[0] + c[1]) / 2;
    const largo = Math.max(10, radio * angulo * RAD), n = Math.max(1, Math.round(largo / 55)), tramos = [];
    const cerrada = grado === 'h' || grado === 'e' || grado <= 2;
    for (let i = 0; i < n; i++) {
      const t = base(largo / n, { giro: redondo(lado * angulo / n), pendiente: grado === 'h' ? pendiente(0.5) : undefined });
      if (grado === 'h') t.ancho = Math.max(t.ancho, 9.6);
      else if (cerrada) t.ancho = redondo(t.ancho + 0.8);
      if (i === 0) t.nota = { tipo: 'curva', lado: lado > 0 ? 'der' : 'izq', grado, larga: grado !== 'h' && grado !== 'e' && angulo > c[2] + (c[3] - c[2]) * 0.72 };
      tramos.push(t);
    }
    // en las cerradas, flechas del lado de afuera (si no es una cornisa: ahi esta la pirca)
    const t0 = tramos[0];
    if (cerrada && !t0.izq) t0.carteles = [[redondo(t0.largo * 0.45), redondo(-lado * (t0.ancho / 2 + 2.4)), lado > 0 ? 'der' : 'izq']];
    return tramos;
  }
  function salto() {   // una loma corta: a fondo, el auto vuela
    const sube = 7.5, tramos = [base(16, { pendiente: sube, giro: 0, nota: { tipo: 'salto' } }), base(20, { pendiente: redondo(-sube * 0.85), giro: 0 }), base(22, { pendiente: 0, giro: 0 })];
    pend = 0;
    return tramos;
  }
  function vado() {    // se baja a un arroyo, se lo cruza por el lecho y se sube
    const tramos = [base(14, { pendiente: -5, giro: 0, nota: { tipo: 'vado' } }), base(13, { pendiente: 0, giro: 0, suelo: 'lecho', ancho: 9, agua: { hondo: 0.34, largo: 64 } }), base(14, { pendiente: 5.5, giro: 0 })];
    pend = 0;
    tramos[0].carteles = [[2, redondo(tramos[0].ancho / 2 + 2.2), 'ojo']];
    return tramos;
  }
  function puente() {  // angosto y derecho, sobre una zanja con agua
    cornisa = 0;
    const t = base(18, { giro: 0, pendiente: Math.max(-2, Math.min(2, redondo(pend))), puente: { luz: 10, alto: 4, agua: true }, nota: { tipo: 'puente' } });
    t.ancho = Math.min(t.ancho, 4.4); delete t.izq; delete t.der; delete t.hombro; delete t.pirca;
    return [t];
  }
  function barro() {   // un tramo de barro con pozos de pantano para esquivar
    const t = base(48, { suelo: 'barro', giro: 0, pendiente: pendiente(0.4), nota: { tipo: 'barro' } });
    t.ancho = redondo(t.ancho + 2.2);
    t.pozos = [];
    let lado = r() < 0.5 ? -1 : 1;
    for (let u = 9; u < t.largo - 6; u += 14) { t.pozos.push([u, redondo(lado * entre(r, 1.6, 3)), redondo(entre(r, 2.6, 3.4)), 0.28, 'pantano']); lado = -lado; }
    return [t];
  }
  function angosto() { // el camino se cierra entre piedras
    const t = base(55, { giro: 0, nota: { tipo: 'angosto' } });
    t.ancho = 5;
    t.piedras = [];
    for (let u = 4, lado = 1; u < t.largo - 3; u += 9, lado = -lado) t.piedras.push([u, redondo(lado * (t.ancho / 2 + entre(r, 0.7, 1.2))), redondo(entre(r, 0.55, 0.9), 100)]);
    return [t];
  }
  function lomo() {    // un lomo de burro de lado a lado
    return [base(40, { giro: 0, pendiente: 0, nota: { tipo: 'lomo' }, lomos: [[20, 0.2, 3.6]] })];
  }
  function pueblo() {  // una cuadra: calle de asfalto con veredas, casas a los dos lados, faroles y arboles
    cornisa = 0;
    const t = base(70, { giro: 0, pendiente: 0, suelo: 'asfalto', ancho: 7, plano: 17, vereda: 2.2, hombro: 6, lineas: 'calle', nota: { tipo: 'pueblo' } });
    delete t.izq; delete t.der; delete t.pirca;
    arbolado(casas(t, r, { desde: 4, hasta: 4 }), r);
    return [t];
  }
  function lajas() {   // roca con lomos de piedra: hay que pasar despacio y eligiendo por donde
    const t = base(48, { giro: 0, nota: { tipo: 'lajas' } });
    t.suelo = 'roca'; t.rugoso = 0.1; t.tope = 7.5;
    t.pozos = [];
    for (let u = 5; u < t.largo - 4; u += 5 + r() * 4) t.pozos.push([Math.round(u * 2) / 2, Math.round((r() - 0.5) * (t.ancho - 2.6) * 10) / 10, Math.round((1.3 + r() * 0.7) * 10) / 10, -Math.round((0.15 + r() * 0.11) * 100) / 100, 'roca']);
    return [t];
  }
  function empezarCornisa() {   // de un lado la pared y del otro el vacio, por un buen rato (sigue en las piezas que vienen)
    cornisa = 170; ladoCornisa = r() < 0.5 ? -1 : 1;
    const tramos = recta(60);
    tramos[0].nota = { tipo: 'cornisa' };
    return tramos;
  }
  const ARMAR = { r1: () => recta(50), r2: () => recta(100), r3: () => recta(180), sa: salto, va: vado, pu: puente, ba: barro, an: angosto, lo: lomo, pb: pueblo, la: lajas, co: empezarCornisa };

  // --- la pieza entra si no se sale del campo ni se acerca a lo ya trazado, y si despues queda lugar para llegar ---
  function entra(tramos) {
    const t = trazar(tramos, pos), c = { ...caja };
    for (let k = 0; k < t.pts.length; k += 6) {
      const x = t.pts[k], z = t.pts[k + 1];
      if (x < CAMPO.x0 || x > CAMPO.x1 || z < CAMPO.z0 || z > CAMPO.z1) return null;
      if (ocupado.cerca(x, z, metros - 70, SEPARA) < SEPARA) return null;
      c.x0 = Math.min(c.x0, x); c.x1 = Math.max(c.x1, x); c.z0 = Math.min(c.z0, z); c.z1 = Math.max(c.z1, z);
    }
    if ((c.x1 - c.x0 + 148) * (c.z1 - c.z0 + 148) > SUPERFICIE) return null;
    const s = trazar([{ largo: LUGAR_PARA_LLEGAR }], t.fin);
    for (let k = 0; k < s.pts.length; k += 10) {
      const x = s.pts[k], z = s.pts[k + 1];
      if (x < CAMPO.x0 || x > CAMPO.x1 || z < CAMPO.z0 || z > CAMPO.z1 || ocupado.cerca(x, z, metros - 70, SEPARA) < SEPARA) return null;
    }
    return t;
  }
  function poner(tramos, t) {
    for (let k = 0; k < t.pts.length; k += 2) {
      ocupado.agregar(t.pts[k], t.pts[k + 1], metros + k / 2);
      caja.x0 = Math.min(caja.x0, t.pts[k]); caja.x1 = Math.max(caja.x1, t.pts[k]); caja.z0 = Math.min(caja.z0, t.pts[k + 1]); caja.z1 = Math.max(caja.z1, t.pts[k + 1]);
    }
    piezas.push(tramos);
    metros += t.pts.length / 2; pos = t.fin;
  }

  // --- los objetos: van en la ultima pieza de camino que se puso (en su ultimo tramo que no sea un puente ni agua) ---
  let cuantosObjetos = 0;
  function ponerObjeto(id) {
    let t = null;
    for (let k = piezas.length - 1; k >= 0 && !t; k--) for (let i = piezas[k].length - 1; i >= 0; i--) if (!piezas[k][i].puente && !piezas[k][i].agua) { t = piezas[k][i]; break; }
    if (!t) return;
    const lado = t.giro ? -Math.sign(t.giro) : (cuantosObjetos++ % 2 ? -1 : 1), medio = t.ancho / 2, u = redondo(t.largo * 0.55);
    if (id === 'ge') (t.publico || (t.publico = [])).push([u, redondo(lado * (medio + (t.vereda ? t.vereda + 1.5 : 7.5))), 6]);
    else if (id === 'pi') piedras(t, r, 7);
    else if (id === 'cn') (t.objetos || (t.objetos = [])).push([u - 3, redondo(lado * (medio - 0.7), 10), 'cono', 0], [u, redondo(lado * (medio - 1.3), 10), 'cono', 0], [u + 3, redondo(lado * (medio - 0.7), 10), 'cono', 0]);
    else if (id === 'fa') (t.fardos || (t.fardos = [])).push([u - 2, redondo(lado * (medio + 1.2), 10)], [u + 1, redondo(lado * (medio + 1.5), 10)], [u + 4, redondo(lado * (medio + 1.2), 10)]);
  }

  // --- se arma: largada, las piezas de la hoja y la llegada ---
  const largada = base(64, { giro: 0, pendiente: 0, ancho: redondo(anchoBase + 1.5) });
  largada.publico = [[20, -(largada.ancho / 2 + 7), 7], [26, largada.ancho / 2 + 7.5, 6]];
  poner([largada], trazar([largada], pos));
  let deCamino = 0;
  for (let k = 0; k < hoja.p.length; k++) {
    const id = hoja.p[k];
    if (esObjeto(id)) { ponerObjeto(id); continue; }
    if (esAjuste(id)) {   // no mide nada: cambia las piezas que siguen
      const A = PIEZAS[id];
      aj[A.ajuste] = A.valor;
      if (A.ajuste === 'via') { suelo = elegir(r, VIAS[A.valor].suelos); cambiaSuelo = 1e9; }
      continue;
    }
    deCamino++;
    const P = PIEZAS[id];
    let tramos = null, t = null;
    if (P.grupo === 'curvas') {
      // Una curva de cierto grado puede doblar mas o menos (ver CURVAS en generador.js): se prueba de la que menos dobla a la
      // que mas, y queda la primera que entra. Asi el camino no se enrosca tan facil, y la nota sigue siendo la que se eligio.
      const g = P.nota.grado, c = CURVAS[g], angulos = g === 'e' ? [90] : g === 'h' ? [c[2], c[3]] : [c[2], (c[2] + c[3]) / 2, c[3]];
      for (const angulo of angulos) {
        const antes = foto();
        tramos = curva(g, P.nota.lado === 'der' ? 1 : -1, angulo);
        t = entra(tramos);
        if (t) break;
        volver(antes);
      }
    } else { tramos = ARMAR[id](); t = entra(tramos); }
    if (!t) return { error: 'cruza', cual: k };
    poner(tramos, t);
    if (metros + LLEGADA > TOPES.maximo) return { error: 'larga', cual: k };
  }
  cornisa = 0;
  const llegada = base(LLEGADA, { giro: 0, pendiente: 0, ancho: redondo(anchoBase + 2.5) });
  const tl = entra([llegada]);
  if (!tl) return { error: 'cruza', cual: hoja.p.length };
  llegada.publico = [[36, -(llegada.ancho / 2 + 7), 9], [42, llegada.ancho / 2 + 7, 9], [60, -(llegada.ancho / 2 + 8), 5]];
  poner([llegada], tl);

  // --- pozos y charcos, como en las pistas del dia, y los cuatro controles que parten la pista en cinco sectores ---
  const tramos = [];
  for (const p of piezas) for (const t of p) tramos.push(t);
  // (los tramos con un tipo de camino elegido en el creador: sus rodadas, pozos, ondas y manchas, como en las pistas del dia)
  const rd = azar(semilla(huella, 5151));
  for (const t of tramos) if (t.via) deformarTramo(t, rd, clima, idBioma, !(t.agua || t.puente || t.vereda || t.largo < 24 || t === largada || t === llegada));
  for (const t of tramos) {
    if (t.via || t.agua || t.puente || t.vereda || t.suelo === 'barro' || t.suelo === 'roca' || t.largo < 24 || t === largada || t === llegada) continue;
    const pozos = t.pozos || [];
    if ((t.suelo === 'asfalto' || t.suelo === 'ripio') && r() < 0.3) for (let k = 0, n = 1 + Math.floor(r() * 3); k < n; k++) pozos.push([redondo(entre(r, 5, t.largo - 5)), redondo((r() - 0.5) * (t.ancho - 3.4)), redondo(entre(r, 1.1, 1.7)), redondo(entre(r, 0.16, 0.3), 100), 'tierra']);
    if (clima.charcos > 0 && r() < 0.42 * clima.charcos) for (let k = 0, n = 1 + Math.floor(r() * 2); k < n; k++) pozos.push([redondo(entre(r, 5, t.largo - 5)), redondo((r() - 0.5) * (t.ancho - 3)), redondo(entre(r, 1.5, 2.6)), 0.14, 'charco']);
    if (pozos.length) t.pozos = pozos;
  }
  for (const t of tramos) for (const k in t) if (t[k] === undefined) delete t[k];
  let total = 0, hecho = 0, sector = 1;
  for (const t of tramos) total += t.largo;
  tramos.forEach((t, i) => {
    hecho += t.largo;
    if (sector <= 4 && i < tramos.length - 2 && hecho >= total * sector / 5 - t.largo / 2) { t.control = true; sector++; }
  });
  // como es: tecnica si casi todo son curvas cerradas, rapida si son abiertas o rectas
  const curvas = hoja.p.filter((id) => PIEZAS[id].grupo === 'curvas').map((id) => PIEZAS[id].nota.grado);
  const cerradas = curvas.filter((g) => g === 'h' || g === 'e' || g <= 2).length, abiertas = curvas.filter((g) => g >= 5).length + hoja.p.filter((id) => id === 'r2' || id === 'r3').length;
  const caracter = cerradas > abiertas * 1.5 && cerradas >= 3 ? 'tecnica' : abiertas > cerradas * 2 && abiertas >= 3 ? 'rapida' : 'mixta';
  const etapa = {
    numero, comunidad: true, nombre: nombre || 'Pista sin nombre', lugar: '', bioma: idBioma, biomas: [idBioma], clima: idClima, caracter,
    semilla: semilla(huella, 77), rumbo: 0, largo: total, tramos, vueltasAtras: 0, intentos: 1,
    hora: hoja.h,   // (la hora del dia que eligio su creador: solo la luz; sin eso, la luz del clima de siempre)
  };
  return total < TOPES.minimo ? { error: 'corta', cual: -1, etapa, largo: total, piezas: deCamino } : { etapa, largo: total, piezas: deCamino };
}

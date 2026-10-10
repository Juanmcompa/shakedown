// Generador de pistas: de un numero (el dia) sale siempre la misma pista, en cualquier aparato.
// Devuelve una "etapa": la lista de tramos que terrain.js convierte en terreno.
//
// Cada tramo puede tener:
//   largo      metros
//   giro       grados que dobla en total (positivo = a la derecha)
//   pendiente  grados (positivo = sube)
//   ancho      metros de lado a lado
//   suelo      asfalto, ripio, tierra, roca, pasto, barro, pantano, lecho
//   peralte    grados de inclinacion de costado (positivo = lado derecho mas alto)
//   izq / der  ladera a cada lado: [metros que sube o baja, a que distancia]
//   hombro     metros de banquina antes de la ladera
//   pozos      lista de [metros desde el inicio del tramo, metros hacia la derecha, radio, hondo, suelo]
//   agua       un arroyo cruza el tramo: { hondo, largo }
//   piedras    piedras al borde: lista de [metros desde el inicio, metros hacia la derecha, radio]
//   fardos     fardos de pasto: lista de [metros desde el inicio, metros hacia la derecha]
//   publico    gente mirando: lista de [metros desde el inicio, metros hacia la derecha, cuantos]
//   carteles   lista de [metros desde el inicio, metros hacia la derecha, tipo]   (tipo: 'izq', 'der' o 'ojo')
//   autos      autos tirados: lista de [metros desde el inicio, metros hacia la derecha, giro en grados, estado]
//   control    true = fin de sector al final del tramo
//   nota       lo que canta el copiloto al llegar: { tipo: 'curva', lado, grado } o { tipo: 'salto' | 'vado' | 'barro' | 'angosto' | 'cornisa' }
import { azar } from './noise.js';

const RAD = Math.PI / 180;
// La version de las pistas. Hay que subirla cada vez que un cambio hace que el mismo dia de OTRA pista
// (tocar este archivo o como se arma el terreno). Con eso, los resultados y los fantasmas guardados de la version
// anterior se descartan solos (ya no coinciden con el camino) y se puede volver a correr la oficial.
export const VERSION = 1;

// --- biomas: como es el lugar ---
// suelos: [suelo, peso]. pendiente: [cuanto cambia de un tramo a otro, maxima], en grados. relieve: alto de las lomas lejos del camino.
// arboles: [tipo de arbol, peso]. monte: cuanta parte del terreno tiene arboles (0 a 1). borde: a cuantos metros del camino empiezan.
// lotes: el campo esta sembrado. piedras: cuantos bloques sueltos hay (0 a 1). alambrado, cornisas: si los tiene.
export const BIOMAS = {
  bosque: {
    nombre: 'Bosque', emoji: '🌲', ancho: [6.6, 7.8], suelos: [['ripio', 5], ['tierra', 4], ['barro', 1.4]], pendiente: [3.2, 8], relieve: 15,
    arboles: [['pino', 6], ['pinoAlto', 3], ['lenga', 2]], monte: 0.72, borde: 3.4, piso: 'pinocha',
    lugares: [['Los Coihues', 'Lago Escondido', 'Arroyo Verde', 'El Mallín', 'Los Ñires', 'Pampa Linda', 'Río Manso', 'El Hoyo', 'Lago Guillelmo', 'Ñorquinco', 'Cuesta del Ternero', 'Bahía Mansa'],
      ['Picada de', 'Sendero a', 'Camino a', 'Huella de', 'Bajada a', 'Vuelta de']],
  },
  campo: {
    nombre: 'Campo', emoji: '🌾', ancho: [7.6, 9], suelos: [['tierra', 6], ['ripio', 3], ['asfalto', 1.2], ['barro', 1]], pendiente: [1.4, 3.6], relieve: 4,
    arboles: [['eucalipto', 5], ['alamo', 2], ['arbusto', 2]], monte: 0.1, borde: 5.5, piso: 'pasto', alambrado: true, lotes: true,
    lugares: [['La Tapera', 'Puesto Viejo', 'El Guadal', 'Monte Chico', 'La Aguada', 'Bajo Hondo', 'El Trébol', 'La Tranquera', 'Paso del Medio', 'Los Tamariscos', 'La Porfía', 'El Jagüel'],
      ['Camino a', 'Calle de', 'Huella de', 'Camino real a', 'Vecinal a', 'Atajo de']],
  },
  montana: {
    nombre: 'Montaña', emoji: '⛰️', ancho: [6.2, 7.4], suelos: [['ripio', 7], ['roca', 1.5], ['tierra', 2]], pendiente: [4.6, 10.5], relieve: 30,
    arboles: [['araucaria', 5], ['pino', 2], ['arbusto', 3]], monte: 0.26, borde: 4, piso: 'pastoSeco', cornisas: true, piedras: 0.035,
    lugares: [['Paso del Zorro', 'Cañadón Hondo', 'Cerro Chato', 'Portezuelo', 'La Cuesta', 'Abra del Viento', 'Piedra Parada', 'El Volcán', 'Mina Vieja', 'Quebrada Seca', 'Los Penitentes', 'Paso del Cóndor'],
      ['Subida a', 'Cornisa de', 'Camino a', 'Cuesta de', 'Huella a', 'Bajada de']],
  },
};

// --- climas ---
// agarre: por cuanto se multiplica el agarre de los suelos de tierra. charcos: cuantos charcos aparecen. niebla: hasta donde se ve, en metros.
export const CLIMAS = {
  sol: { nombre: 'Seco', emoji: '☀️', agarre: 1, charcos: 0, niebla: 0 },
  lluvia: { nombre: 'Lluvia', emoji: '🌧️', agarre: 0.86, charcos: 1, niebla: 0 },
  niebla: { nombre: 'Niebla', emoji: '🌫️', agarre: 0.95, charcos: 0.25, niebla: 95 },
  tarde: { nombre: 'Atardecer', emoji: '🌇', agarre: 1, charcos: 0, niebla: 0 },
};

// --- curvas: del 1 (la mas cerrada) al 6 (casi recta), y la horquilla ("h") ---
// [radio minimo, radio maximo, angulo minimo, angulo maximo, velocidad tipica en m/s (para estimar cuanto dura la pista)]
const CURVAS = {
  h: [8.5, 11, 150, 180, 6.5], 1: [13, 18, 65, 125, 8.5], 2: [19, 27, 50, 110, 11], 3: [28, 40, 40, 95, 14],
  4: [42, 62, 30, 80, 18], 5: [66, 100, 22, 60, 22], 6: [110, 180, 12, 38, 26],
};
// que tan seguido sale cada curva segun el caracter de la pista
export const CARACTER = {
  tecnica: { nombre: 'Técnica', curvas: { h: 2.2, 1: 3, 2: 4, 3: 4, 4: 2.5, 5: 1.2, 6: 0.6 }, recta: [25, 90], rectas: 0.3 },
  mixta: { nombre: 'Mixta', curvas: { h: 1.1, 1: 2, 2: 3, 3: 4, 4: 4, 5: 2.5, 6: 1.5 }, recta: [35, 130], rectas: 0.36 },
  rapida: { nombre: 'Rápida', curvas: { h: 0.5, 1: 1, 2: 2, 3: 3.5, 4: 4.5, 5: 4, 6: 3 }, recta: [50, 180], rectas: 0.42 },
};

// mezcla dos numeros en una semilla
const semilla = (a, b) => (Math.imul(a + 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x165667b1, 0xc2b2ae35)) >>> 0;

function elegir(r, lista) {   // lista de [cosa, peso]
  let total = 0;
  for (const x of lista) total += x[1];
  let t = r() * total;
  for (const x of lista) { t -= x[1]; if (t <= 0) return x[0]; }
  return lista[lista.length - 1][0];
}
const entre = (r, a, b) => a + r() * (b - a);
const redondo = (v, d = 1) => Math.round(v * d) / d;

// Recorre unos tramos desde una posicion y devuelve los puntos del eje (uno por metro) y donde termina.
function trazar(tramos, desde) {
  let { x, z, rumbo } = desde;
  const pts = [];
  for (const t of tramos) {
    const m = Math.round(t.largo);
    for (let j = 0; j < m; j++) {
      rumbo += (t.giro || 0) * RAD / m;
      x += Math.sin(rumbo); z -= Math.cos(rumbo);
      pts.push(x, z);
    }
  }
  return { pts, fin: { x, z, rumbo } };
}

// El terreno ocupado: una grilla para saber rapido si un punto queda cerca de lo ya trazado.
function crearOcupado(lado) {
  const celdas = new Map(), clave = (a, b) => (a + 512) * 2048 + b + 512;
  return {
    agregar: (x, z, i) => {
      const k = clave(Math.floor(x / lado), Math.floor(z / lado));
      if (!celdas.has(k)) celdas.set(k, []);
      celdas.get(k).push(x, z, i);
    },
    // distancia al punto mas cercano de los que tienen indice menor que "hasta"
    cerca: (x, z, hasta, radio) => {
      const cx = Math.floor(x / lado), cz = Math.floor(z / lado), n = Math.ceil(radio / lado);
      let md = radio * radio;
      for (let a = -n; a <= n; a++) for (let b = -n; b <= n; b++) {
        const l = celdas.get(clave(cx + a, cz + b));
        if (!l) continue;
        for (let k = 0; k < l.length; k += 3) {
          if (l[k + 2] >= hasta) continue;
          const dx = x - l[k], dz = z - l[k + 1], d = dx * dx + dz * dz;
          if (d < md) md = d;
        }
      }
      return Math.sqrt(md);
    },
    // saca los puntos con indice "desde" o mayor (al deshacer una pieza)
    cortar: (desde) => {
      for (const [k, l] of celdas) {
        let n = 0;
        for (let i = 0; i < l.length; i += 3) if (l[i + 2] < desde) { l[n] = l[i]; l[n + 1] = l[i + 1]; l[n + 2] = l[i + 2]; n += 3; }
        l.length = n;
      }
    },
  };
}

// Lo general de un dia: donde es, que clima hace y como es la pista. Sale solo del numero, sin armar el trazado.
export function datosDelDia(numero) {
  const rd = azar(semilla(numero, 9999));
  const bioma = elegir(rd, [['bosque', 4], ['campo', 3], ['montana', 3]]);
  const clima = elegir(rd, [['sol', 4], ['lluvia', 3], ['niebla', 1.3], ['tarde', 2]]);
  const caracter = elegir(rd, bioma === 'campo' ? [['rapida', 4], ['mixta', 3], ['tecnica', 1]] : bioma === 'montana' ? [['tecnica', 4], ['mixta', 3], ['rapida', 1]] : [['mixta', 4], ['tecnica', 2.5], ['rapida', 2]]);
  const B = BIOMAS[bioma];
  const nombre = elegir(rd, B.lugares[1].map((x) => [x, 1])) + ' ' + elegir(rd, B.lugares[0].map((x) => [x, 1]));
  const duracion = entre(rd, 96, 128);            // segundos que tardaria un piloto muy bueno; uno normal, un 30 a 50 % mas
  const anchoBase = entre(rd, B.ancho[0], B.ancho[1]);
  // las coordenadas que publica el organizador: un punto del sur para el bosque, de la pampa para el campo y de la cordillera para la montaña
  const zona = { bosque: [-41.2, -71.4, 1.6, 0.5], campo: [-36.4, -61, 2.2, 2.6], montana: [-38.8, -70.9, 0.9, 0.35] }[bioma];
  const lat = zona[0] + (rd() - 0.5) * 2 * zona[2], lon = zona[1] + (rd() - 0.5) * 2 * zona[3];
  const grados = (v, a, b) => Math.floor(Math.abs(v)) + '°' + String(Math.floor((Math.abs(v) % 1) * 60)).padStart(2, '0') + '′' + (v < 0 ? a : b);
  return { numero, bioma, clima, caracter, nombre, duracion, anchoBase, lugar: grados(lat, 'S', 'N') + ' ' + grados(lon, 'O', 'E') };
}

// Intenta armar una pista entera con una semilla. Devuelve null si se encierra y no puede seguir.
function intentar(numero, vuelta) {
  const r = azar(semilla(numero, vuelta));
  // --- lo general del dia (no depende de la vuelta: si hay que reintentar, el lugar y el clima no cambian) ---
  const dia = datosDelDia(numero), { duracion, anchoBase } = dia, idBioma = dia.bioma, idClima = dia.clima, idCaracter = dia.caracter;
  const bioma = BIOMAS[idBioma], clima = CLIMAS[idClima], car = CARACTER[idCaracter];

  // --- el trazado, pieza por pieza ---
  const CAMPO = { x0: -330, x1: 330, z0: -600, z1: 70 };   // de donde no se puede salir
  const SEPARA = 46;                                        // metros minimos entre dos partes del camino
  const ocupado = crearOcupado(24), piezas = [];
  let pos = { x: 0, z: 0, rumbo: 0 }, metros = 0, tiempo = 0;
  let suelo = elegir(r, bioma.suelos), cambiaSuelo = entre(r, 140, 380);
  let pend = 0, alto = 0, ultima = '', cornisa = 0, ladoCornisa = 1, desdeEspecial = 0;

  function entra(tramos) {   // la pieza entra si no se sale del campo ni se acerca a lo ya trazado
    const t = trazar(tramos, pos);
    for (let k = 0; k < t.pts.length; k += 6) {
      const x = t.pts[k], z = t.pts[k + 1];
      if (x < CAMPO.x0 || x > CAMPO.x1 || z < CAMPO.z0 || z > CAMPO.z1) return null;
      if (ocupado.cerca(x, z, metros - 70, SEPARA) < SEPARA) return null;
    }
    // ademas tiene que quedar lugar para seguir derecho unos metros
    const s = trazar([{ largo: 55 }], t.fin);
    for (let k = 0; k < s.pts.length; k += 10) {
      const x = s.pts[k], z = s.pts[k + 1];
      if (x < CAMPO.x0 || x > CAMPO.x1 || z < CAMPO.z0 || z > CAMPO.z1 || ocupado.cerca(x, z, metros - 70, SEPARA) < SEPARA) return null;
    }
    return t;
  }
  // lo que hay que recordar para poder deshacer una pieza
  const foto = () => ({ suelo, cambiaSuelo, pend, alto, ultima, cornisa, ladoCornisa, desdeEspecial });
  function poner(tramos, t, seg, tipo, antes) {
    for (let k = 0; k < t.pts.length; k += 2) ocupado.agregar(t.pts[k], t.pts[k + 1], metros + k / 2);
    const largo = t.pts.length / 2;
    piezas.push({ tramos, largo, seg, tipo, pos, antes });
    metros += largo; tiempo += seg; pos = t.fin; ultima = tipo; desdeEspecial += largo;
  }
  function sacar() {   // deshace la ultima pieza
    const p = piezas.pop();
    metros -= p.largo; tiempo -= p.seg; pos = p.pos;
    ({ suelo, cambiaSuelo, pend, alto, ultima, cornisa, ladoCornisa, desdeEspecial } = p.antes);
    ocupado.cortar(metros);
  }
  // cuanto lugar libre hay doblando hacia un lado: se mira un punto 90 metros adelante, a 55 grados
  function lugarHacia(lado) {
    const a = pos.rumbo + lado * 55 * RAD, x = pos.x + Math.sin(a) * 90, z = pos.z - Math.cos(a) * 90;
    return Math.min(x - CAMPO.x0, CAMPO.x1 - x, z - CAMPO.z0, CAMPO.z1 - z, ocupado.cerca(x, z, metros - 70, 140));
  }

  // pendiente del proximo tramo: cambia de a poco y no deja que la pista se vaya muy arriba ni muy abajo
  function pendiente(factor = 1) {
    const [paso, maxima] = bioma.pendiente;
    pend = pend * 0.6 + (r() * 2 - 1) * paso - alto / 26;
    pend = Math.max(-maxima, Math.min(maxima, pend)) * factor;
    return redondo(pend);
  }
  // lo comun a todos los tramos de una pieza: suelo, ancho y laderas
  function base(largo, extra) {
    const t = Object.assign({ largo: Math.round(largo), suelo, ancho: redondo(anchoBase + (r() - 0.5) * 0.8) }, extra);
    if (t.pendiente === undefined) t.pendiente = pendiente();
    alto += Math.tan(t.pendiente * RAD) * t.largo;
    cambiaSuelo -= t.largo;
    if (cambiaSuelo <= 0) { suelo = elegir(r, bioma.suelos.filter((s) => s[0] !== suelo)); cambiaSuelo = entre(r, 140, 380); }
    if (cornisa > 0 && !t.agua) {   // de un lado la pared, del otro el vacio
      const pared = [redondo(entre(r, 11, 18)), 9], vacio = [-redondo(entre(r, 20, 34)), 8];
      t.izq = ladoCornisa > 0 ? pared : vacio; t.der = ladoCornisa > 0 ? vacio : pared; t.hombro = 1.5;
      t.ancho = Math.min(t.ancho, 6.4);
      cornisa -= t.largo;
    }
    return t;
  }

  // --- las piezas ---
  function recta() {
    const largo = entre(r, car.recta[0], car.recta[1]), n = Math.max(1, Math.round(largo / 60)), tramos = [];
    for (let i = 0; i < n; i++) tramos.push(base(largo / n, { giro: redondo((r() - 0.5) * 9) }));
    return { tramos, seg: largo / 25, tipo: 'recta' };
  }
  function curva(grado, lado) {
    const c = CURVAS[grado], radio = entre(r, c[0], c[1]), angulo = entre(r, c[2], c[3]);
    const largo = Math.max(10, radio * angulo * RAD), n = Math.max(1, Math.round(largo / 55)), tramos = [];
    const cerrada = grado === 'h' || grado <= 2;
    for (let i = 0; i < n; i++) {
      const t = base(largo / n, { giro: redondo(lado * angulo / n), pendiente: grado === 'h' ? pendiente(0.5) : undefined });
      if (grado === 'h') t.ancho = Math.max(t.ancho, 9.6);
      else if (cerrada) t.ancho += 0.8;
      if (i === 0) t.nota = { tipo: 'curva', lado: lado > 0 ? 'der' : 'izq', grado, larga: angulo > (grado === 'h' ? 999 : c[2] + (c[3] - c[2]) * 0.72) };
      tramos.push(t);
    }
    const t0 = tramos[0], medio = t0.ancho / 2;
    // una piedra del lado de adentro, para el que quiera cortar la curva
    if (grado !== 'h' && grado <= 4 && r() < 0.3 && !t0.izq) t0.piedras = [[redondo(t0.largo * entre(r, 0.35, 0.65)), redondo(lado * (medio + entre(r, 0.5, 1.1))), redondo(entre(r, 0.5, 0.85), 100)]];
    // en las cerradas, flechas del lado de afuera y a veces gente mirando
    if (cerrada && !t0.izq) {
      t0.carteles = [[redondo(t0.largo * 0.45), redondo(-lado * (medio + 2.4)), lado > 0 ? 'der' : 'izq']];
      if (r() < 0.55) t0.publico = [[redondo(t0.largo * entre(r, 0.5, 0.9)), redondo(-lado * (medio + entre(r, 6.5, 9))), 3 + Math.floor(r() * 6)]];
    }
    return { tramos, seg: largo / c[4], tipo: 'curva' + grado };
  }
  function salto() {   // una loma corta: a fondo, el auto vuela
    const sube = entre(r, 6.5, 9), tramos = [base(16, { pendiente: redondo(sube), giro: 0, nota: { tipo: 'salto' } }), base(20, { pendiente: redondo(-sube * 0.85), giro: 0 }), base(22, { pendiente: 0, giro: redondo((r() - 0.5) * 6) })];
    pend = 0;
    if (r() < 0.6) tramos[2].publico = [[8, redondo((r() < 0.5 ? -1 : 1) * (tramos[2].ancho / 2 + 7.5)), 4 + Math.floor(r() * 6)]];
    return { tramos, seg: 58 / 23, tipo: 'salto' };
  }
  function vado() {    // se baja a un arroyo, se lo cruza y se sube
    const tramos = [base(14, { pendiente: -5, giro: 0, nota: { tipo: 'vado' } }), base(13, { pendiente: 0, giro: 0, suelo: 'lecho', ancho: 9, agua: { hondo: redondo(entre(r, 0.28, 0.42), 100), largo: 64 } }), base(14, { pendiente: 5.5, giro: 0 })];
    pend = 0;
    tramos[0].carteles = [[2, redondo(tramos[0].ancho / 2 + 2.2), 'ojo']];
    return { tramos, seg: 41 / 15, tipo: 'vado' };
  }
  function barrial() { // un tramo de barro con pozos de pantano para esquivar
    const largo = entre(r, 34, 62), t = base(largo, { suelo: 'barro', giro: redondo((r() - 0.5) * 14), pendiente: pendiente(0.4), nota: { tipo: 'barro' } });
    t.ancho += 2.2;
    t.pozos = [];
    for (let u = 9; u < largo - 6; u += entre(r, 12, 19)) t.pozos.push([redondo(u), redondo((r() < 0.5 ? -1 : 1) * entre(r, 1.6, 3)), redondo(entre(r, 2.6, 3.6)), 0.28, 'pantano']);
    return { tramos: [t], seg: largo / 12, tipo: 'barro' };
  }
  function angosto() { // el camino se cierra entre piedras
    const largo = entre(r, 40, 75), t = base(largo, { giro: redondo((r() - 0.5) * 16), nota: { tipo: 'angosto' } });
    t.ancho = redondo(entre(r, 4.6, 5.3));
    t.piedras = [];
    for (let u = 4; u < largo - 3; u += entre(r, 7, 13)) t.piedras.push([redondo(u), redondo((r() < 0.5 ? -1 : 1) * (t.ancho / 2 + entre(r, 0.7, 1.3))), redondo(entre(r, 0.55, 0.95), 100)]);
    return { tramos: [t], seg: largo / 17, tipo: 'angosto' };
  }

  // --- se arma: largada, piezas hasta completar la duracion, y llegada ---
  const alLargar = foto(), largada = base(64, { giro: 0, pendiente: 0, ancho: redondo(anchoBase + 1.5) });
  largada.publico = [[20, -(largada.ancho / 2 + 7), 7], [26, largada.ancho / 2 + 7.5, 6]];
  poner([largada], trazar([largada], pos), 64 / 16, 'recta', alLargar);
  let fallas = 0, vueltasAtras = 0;
  while (tiempo < duracion) {
    // que pieza sigue
    let p = null;
    for (let prueba = 0; prueba < 14 && !p; prueba++) {
      const guardado = foto();
      let c;
      const especial = desdeEspecial > 210 && r() < 0.5;
      if (especial) {
        const cual = elegir(r, [['salto', ultima === 'recta' ? 3 : 0.6], ['vado', cornisa > 0 ? 0 : 1.6 + clima.charcos], ['barro', (idBioma === 'montana' ? 0.3 : 1.5) + clima.charcos * 2], ['angosto', idBioma === 'campo' ? 0.5 : 1.8], ['cornisa', bioma.cornisas && cornisa <= 0 ? 4 : 0]]);
        if (cual === 'cornisa') { cornisa = entre(r, 120, 260); ladoCornisa = r() < 0.5 ? -1 : 1; c = recta(); c.tramos[0].nota = { tipo: 'cornisa' }; }
        else c = cual === 'salto' ? salto() : cual === 'vado' ? vado() : cual === 'barro' ? barrial() : angosto();
        c.especial = true;
      } else if (ultima !== 'recta' && r() < car.rectas) c = recta();
      else {
        const grado = elegir(r, Object.entries(car.curvas).map(([g, w]) => [g === 'h' ? 'h' : Number(g), g === 'h' && (ultima === 'curvah' || cornisa > 0) ? 0 : w]));
        // hacia que lado: casi siempre el que deja mas lugar, a veces el otro
        const lado = (lugarHacia(1) > lugarHacia(-1)) === (r() < 0.72) ? 1 : -1;
        c = curva(grado, lado);
        c.espejo = true;
      }
      let t = entra(c.tramos);
      if (!t && c.espejo) {   // la misma curva, para el otro lado
        for (const x of c.tramos) {
          x.giro = -x.giro;
          if (x.nota) x.nota.lado = x.nota.lado === 'der' ? 'izq' : 'der';
          for (const lista of [x.piedras, x.carteles, x.publico]) for (const o of lista || []) { o[1] = -o[1]; if (o[2] === 'izq') o[2] = 'der'; else if (o[2] === 'der') o[2] = 'izq'; }
        }
        t = entra(c.tramos);
      }
      if (t) { p = c; poner(c.tramos, t, c.seg, c.tipo, guardado); if (c.especial) desdeEspecial = 0; }
      else ({ suelo, cambiaSuelo, pend, alto, ultima, cornisa, ladoCornisa, desdeEspecial } = guardado);
    }
    if (!p) {   // encerrado: se vuelve dos piezas atras y se prueba otra cosa
      if (++fallas > 60 || piezas.length < 3) return null;
      sacar(); if (piezas.length > 2) sacar();
      vueltasAtras++;
    }
  }
  // llegada: una recta ancha, con la meta y la gente
  cornisa = 0;
  const alLlegar = foto(), llegada = base(92, { giro: 0, pendiente: 0, ancho: redondo(anchoBase + 2.5) });
  const tl = entra([llegada]);
  if (!tl) return null;
  llegada.publico = [[52, -(llegada.ancho / 2 + 7), 9], [58, llegada.ancho / 2 + 7, 9], [78, -(llegada.ancho / 2 + 8), 5]];
  poner([llegada], tl, 92 / 22, 'recta', alLlegar);

  // --- los tramos, los pozos y charcos, y los cuatro controles que parten la pista en cinco sectores ---
  const tramos = [];
  for (const p of piezas) for (const t of p.tramos) tramos.push(t);
  for (const t of tramos) {
    if (t.agua || t.suelo === 'barro' || t.largo < 24 || t === largada || t === llegada) continue;
    const pozos = t.pozos || [];
    // pozos en el ripio y el asfalto; con lluvia, charcos en la tierra
    if ((t.suelo === 'asfalto' || t.suelo === 'ripio') && r() < 0.3) for (let k = 0, n = 1 + Math.floor(r() * 3); k < n; k++) pozos.push([redondo(entre(r, 5, t.largo - 5)), redondo((r() - 0.5) * (t.ancho - 3.4)), redondo(entre(r, 1.1, 1.7)), redondo(entre(r, 0.16, 0.3), 100), 'tierra']);
    if (clima.charcos > 0 && r() < 0.42 * clima.charcos) for (let k = 0, n = 1 + Math.floor(r() * 2); k < n; k++) pozos.push([redondo(entre(r, 5, t.largo - 5)), redondo((r() - 0.5) * (t.ancho - 3)), redondo(entre(r, 1.5, 2.6)), 0.14, 'charco']);
    if (pozos.length) t.pozos = pozos;
  }
  let total = 0, hecho = 0, sector = 1;
  for (const t of tramos) total += t.largo;
  tramos.forEach((t, i) => {
    hecho += t.largo;
    if (sector <= 4 && i < tramos.length - 2 && hecho >= total * sector / 5 - t.largo / 2) { t.control = true; sector++; }
  });

  return {
    numero, nombre: dia.nombre, lugar: dia.lugar, bioma: idBioma, clima: idClima, caracter: idCaracter,
    semilla: semilla(numero, 77), rumbo: 0, largo: total, tramos, vueltasAtras,
  };
}

// La pista de un dia. Si con una semilla no sale (se encierra), se prueba con la siguiente: siempre da la misma.
const hechas = new Map();
export function generarPista(numero) {
  if (hechas.has(numero)) return hechas.get(numero);
  for (let vuelta = 0; vuelta < 60; vuelta++) {
    const p = intentar(numero, vuelta);
    if (p && p.tramos.filter((t) => t.control).length === 4) { p.intentos = vuelta + 1; hechas.set(numero, p); return p; }
  }
  throw new Error('No se pudo armar la pista ' + numero);
}

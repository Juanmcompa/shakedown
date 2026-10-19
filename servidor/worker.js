// El servidor de Shakedown: guarda las pasadas que se comparten y arma las tablas de los clubes.
// Es chico a proposito. Corre gratis en Cloudflare Workers, con una base de datos D1 (ver servidor/LEEME.md).
// El juego no depende de el: si no contesta, se sigue jugando y compartiendo con el link largo de siempre.
//
// Lo que se le puede pedir (todo va y viene como JSON):
//   POST /pasadas                  { llave, codigo }            guarda una pasada. Devuelve { id }: lo que va en el link corto.
//   GET  /pasadas/<id>                                          devuelve { codigo, j }: la pasada entera, para correrle al fantasma,
//                                                               y el numero de corredor de quien la hizo.
//   POST /clubes                   { llave, nombre, apodo }     crea un club. Devuelve { codigo, nombre, miembros }.
//   GET  /clubes/<codigo>                                       { codigo, nombre, miembros }: para mostrar una invitacion.
//   POST /clubes/<codigo>/entrar   { llave, apodo }             suma al jugador al club (apodo: como se llama, si ya eligio).
//   POST /clubes/<codigo>/salir    { llave }                    lo saca.
//   POST /tablas                   { llave, pista, version, clubes: [codigos] }   la tabla de cada club en esa pista,
//                                                               quienes del club todavia no la corrieron, y las pistas del club.
//   POST /pistas                   { llave, nombre, apodo, club, hoja }   publica una pista de la comunidad (la arma un
//                                                               jugador en el creador: ver src/hoja.js). club: el codigo de
//                                                               uno de sus clubes, o '' (solo se comparte con link).
//                                                               Devuelve { numero, version, nombre, autor, club, vence }.
//   GET  /pistas/<numero>                                       { numero, version, nombre, autor, club, clubNombre, hoja,
//                                                               vence, tabla }: la pista y el mejor tiempo de cada uno.
//                                                               410 si ya vencio (duran dos semanas) o si la borraron.
//   POST /pistas/<numero>/borrar   { llave }                    borra una pista (solo la puede borrar quien la armo): se
//                                                               libera su lugar y se borran sus tiempos. Devuelve { borrada }.
//   POST /travesia                 { llave, nombre, km, auto }   guarda el mejor record de km de la Travesia (el modo sin fin).
//                                                               Solo cuenta si supera el que ya tenia. Devuelve { km, nuevo }.
//   POST /travesias                { llave, clubes: [codigos] }  el record de cada miembro de esos clubes, de mayor a menor.
//                                                               Sin fantasma ni pista: la Travesia sale distinta cada vez.
//
// No hay cuentas ni contraseñas. Cada aparato inventa una "llave" larga al azar y la manda cuando escribe algo; aca se
// guarda solo su huella (no la llave), que hace de numero de corredor. Nadie mas la conoce, asi que nadie puede subir
// tiempos a nombre de otro. De cada pasada se guarda lo mismo que viaja en un link largo: el apodo, el tiempo, los
// colores de los sectores, el auto, si uso ayuda, y el recorrido grabado. Nada mas.
//
// El "codigo" de una pasada es el mismo texto que antes iba entero en el link. Aca se lo lee con el mismo programa
// que usa el juego (src/fantasma.js): lo que figura en la tabla sale de la pasada grabada, no de lo que diga el que la manda.
import { leerCodigo, limpiarTexto, TOPE_MUESTRAS } from '../src/fantasma.js';
import { esCircuito, esDeLaComunidad, COMUNIDAD } from '../src/circuitos.js';
import { leerHoja, armarHoja } from '../src/hoja.js';
import { hoy } from '../src/dia.js';

// --- los limites (para que nadie pueda llenar la base ni gastar el cupo gratis) ---
export const LIMITES = {
  // Por dia y por conexion. La "conexion" es la direccion de internet desde la que llega el pedido. Un colegio entero con
  // el mismo wifi, o mucha gente de la misma compañia de celular, comparten direccion: por eso estos topes son holgados.
  pasadasPorConexion: 3000,   // pasadas que se pueden subir
  clubesPorConexion: 60,      // clubes que se pueden crear
  entradasPorConexion: 600,   // veces que alguien se suma a un club
  // Por dia, entre todos. El plan gratis de Cloudflare deja escribir 100.000 filas por dia en la base, y cada pasada
  // gasta unas 6: con este tope, lo gratis alcanza. Si se llega, hasta el otro dia se comparte con el link largo.
  pasadasPorDia: 12000,
  clubesPorJugador: 30,       // en cuantos clubes puede estar un mismo corredor
  miembrosPorClub: 100,
  clubesPorPedido: 30,        // cuantas tablas se pueden pedir de una vez
  guardaDias: 120,            // las pasadas mas viejas se borran solas
  travesiasPorConexion: 600,  // por dia: records de la Travesia que se pueden mandar desde una misma conexion
  travesiasPorDia: 20000,     // por dia, entre todos
  kmMaximo: 1000,             // un record de la Travesia mayor a esto no es creible (hoy se llega a unas decenas de km)
  largoDelCodigo: 6000,       // letras, como mucho, de una pasada (una de dos minutos lleva unas 600; la mas larga posible, 4.500)
  // las pistas de la comunidad (las que arma un jugador en el creador)
  pistasPorConexion: 40,      // por dia: cuantas se pueden publicar desde una misma conexion
  pistasPorDia: 1500,         // por dia, entre todos
  pistasPorJugador: COMUNIDAD.porPersona,   // cuantas puede tener vigentes un mismo corredor (cinco: si quiere otra, borra una)
  pistasPorClub: 30,          // cuantas puede tener vigentes un club
  largoDeLaHoja: 1500,        // letras, como mucho, de una hoja (40 piezas y 30 objetos ocupan unas 400)
  adelanto: 900,              // segundos: cuanto antes de la medianoche se acepta una pasada de la pista que viene (por los relojes adelantados)
};
const ORIGENES = 'https://juanmcompa.github.io';   // desde que paginas se puede usar (se cambia con la variable ORIGENES)

// --- la base de datos ---
// Cada pedido hace UN solo viaje a la base: una consulta, o una tanda que se cumple entera o no se cumple. La base puede
// quedar lejos de quien juega (desde Argentina, cada viaje tarda un tercio de segundo), asi que cinco consultas seguidas
// se sienten. Por eso las reglas (los topes, "una sola oficial", "hay lugar en el club") van escritas adentro de las
// mismas consultas, y despues se mira que paso.
const ESQUEMA = [
  // una pasada. "cent" es el tiempo en centesimas: con el corredor, la pista y si fue practica, dice que pasada es
  // (si se la sube de nuevo, por ejemplo despues de cambiarse el apodo, se actualiza esa misma y no se duplica).
  `CREATE TABLE IF NOT EXISTS pasadas (
    id TEXT PRIMARY KEY, pista INTEGER NOT NULL, version INTEGER NOT NULL, jugador TEXT NOT NULL, practica INTEGER NOT NULL, cent INTEGER NOT NULL,
    nombre TEXT NOT NULL, t REAL NOT NULL, c TEXT NOT NULL, auto TEXT NOT NULL, ab TEXT NOT NULL, ayuda INTEGER NOT NULL,
    codigo TEXT NOT NULL, creado INTEGER NOT NULL)`,
  'CREATE UNIQUE INDEX IF NOT EXISTS pasadas_cual ON pasadas (pista, version, jugador, practica, cent)',
  'CREATE INDEX IF NOT EXISTS pasadas_viejas ON pasadas (creado)',
  'CREATE TABLE IF NOT EXISTS clubes (codigo TEXT PRIMARY KEY, nombre TEXT NOT NULL, creador TEXT NOT NULL, creado INTEGER NOT NULL)',
  // quien esta en cada club, con el apodo que uso la ultima vez (para poder nombrar al que todavia no corrio)
  "CREATE TABLE IF NOT EXISTS miembros (club TEXT NOT NULL, jugador TEXT NOT NULL, nombre TEXT NOT NULL DEFAULT '', desde INTEGER NOT NULL, PRIMARY KEY (club, jugador))",
  'CREATE INDEX IF NOT EXISTS miembros_de ON miembros (jugador)',
  // los contadores de los limites: uno por conexion y por dia ("vence" dice cuando se puede borrar)
  'CREATE TABLE IF NOT EXISTS limites (clave TEXT PRIMARY KEY, n INTEGER NOT NULL, vence INTEGER NOT NULL)',
  // Las pistas de la comunidad: una fila por numero (13000 a 15999). Cuando una vence, su numero se puede volver a usar y
  // la fila se pisa con la pista nueva, con la version siguiente: asi los links y los tiempos de la vieja no se mezclan con
  // los de la nueva. "hoja" es lo que eligio su creador (ver src/hoja.js), "creador" su numero de corredor y "autor" su apodo.
  `CREATE TABLE IF NOT EXISTS pistas (numero INTEGER PRIMARY KEY, version INTEGER NOT NULL, nombre TEXT NOT NULL, autor TEXT NOT NULL,
    creador TEXT NOT NULL, club TEXT NOT NULL DEFAULT '', hoja TEXT NOT NULL, creado INTEGER NOT NULL, vence INTEGER NOT NULL)`,
  'CREATE INDEX IF NOT EXISTS pistas_del_club ON pistas (club, vence)',
  'CREATE INDEX IF NOT EXISTS pistas_de ON pistas (creador, vence)',
  // El record de la Travesia: una fila por corredor, con su mejor marca en km (la Travesia no tiene pista fija ni fantasma:
  // cada corrida sale distinta). Es una tabla aparte, y nueva: la base que ya esta publicada la gana sola, sin migracion.
  `CREATE TABLE IF NOT EXISTS travesias (jugador TEXT PRIMARY KEY, nombre TEXT NOT NULL, km REAL NOT NULL, auto TEXT NOT NULL DEFAULT '', creado INTEGER NOT NULL)`,
];
const crearTablas = (DB) => DB.batch(ESQUEMA.map((s) => DB.prepare(s)));
// Las tablas se crean solas: si un pedido falla porque todavia no existen (la base es nueva), se crean y se lo repite.
// (Se puede repetir sin miedo: de una tanda que falla no queda nada hecho.)
async function conTablas(DB, hacer) {
  try { return await hacer(); } catch (e) {
    if (e instanceof Aviso || !/no such table/i.test(String(e && e.message))) throw e;
    await crearTablas(DB);
    return hacer();
  }
}
const revisadas = new WeakSet();   // (las bases a las que ya se les repaso el esquema, mientras el programa siga despierto)

// --- cosas chicas ---
const LETRAS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
// un codigo al azar de n letras y numeros (sin sesgo: se descartan los bytes que sobran)
function alAzar(n) {
  let s = '';
  while (s.length < n) for (const b of crypto.getRandomValues(new Uint8Array(n * 2))) if (b < 248 && s.length < n) s += LETRAS[b % 62];
  return s;
}
// la huella de un texto: 16 letras que no dejan volver al texto original
async function huella(texto) {
  const b = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto)));
  let s = '';
  for (let i = 0; i < 12; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_');
}
const limpiar = limpiarTexto;   // (la misma limpieza que hace el juego: sin letras de control ni marcas invisibles)
const esLlave = (x) => typeof x === 'string' && /^[A-Za-z0-9_-]{16,64}$/.test(x);
const esCodigoCorto = (x) => typeof x === 'string' && /^[0-9A-Za-z]{6,12}$/.test(x);
const ahora = () => Math.floor(Date.now() / 1000);
const esRepetido = (e) => /UNIQUE|PRIMARY/i.test(String(e && e.message));

class Aviso extends Error { constructor(estado, texto) { super(texto); this.estado = estado; } }
const falla = (estado, texto) => { throw new Aviso(estado, texto); };

// De que conexion viene un pedido. De una direccion IPv6 cuenta solo la primera mitad: la otra mitad la elige cada
// aparato a su gusto, asi que todas las de una misma casa (o de un mismo vivo) son la misma conexion.
function conexionDe(ip) {
  if (!ip.includes(':') || ip.includes('.')) return ip;
  const [a, b] = ip.toLowerCase().split('::'), ini = a ? a.split(':') : [], fin = b ? b.split(':') : [];
  const grupos = b === undefined ? ini : [...ini, ...Array(Math.max(0, 8 - ini.length - fin.length)).fill('0'), ...fin];
  return grupos.slice(0, 4).map((g) => g.replace(/^0+(?=.)/, '')).join(':');
}

// Un contador del dia (por ejemplo, las pasadas que subio una conexion). Tiene tres partes, para usar en una misma tanda:
//   anotar(DB)       la consulta que suma uno. Una vez pasado el tope ya no anota nada: los pedidos de mas no gastan
//                    escrituras en la base.
//   ENTRA(clave, tope)  la condicion "todavia no se paso", para ponerle a lo que viene despues en la tanda
//   sePaso(resultado)   mirando lo que devolvio "anotar", si este pedido ya se paso
const DIA = 86400;
const SUMA = 'ON CONFLICT (clave) DO UPDATE SET n = n + 1 WHERE n <= ';
const ENTRA = (clave, tope) => `COALESCE((SELECT n FROM limites WHERE clave = ${clave}), 0) <= ${tope}`;
function contador(nombre, tope) {
  const dia = Math.floor(ahora() / DIA), clave = nombre + ':' + dia, vence = (dia + 2) * DIA;
  return {
    clave, tope, vence,
    anotar: (DB) => DB.prepare(`INSERT INTO limites (clave, n, vence) VALUES (?1, 1, ?2) ${SUMA}?3 RETURNING n`).bind(clave, vence, tope),
    sePaso: (resultado) => { const f = resultado.results[0]; return !f || f.n > tope; },
  };
}

// --- las pasadas ---
// una pista de la comunidad (numero y version) que siga vigente a esa hora (los tres van como "?n" de la consulta)
const viva = (numero, version, hora) => `EXISTS (SELECT 1 FROM pistas WHERE numero = ${numero} AND version = ${version} AND vence > ${hora})`;
async function guardarPasada(env, pedido, de) {
  const DB = env.DB;
  if (!esLlave(pedido.llave)) falla(400, 'Falta la llave.');
  const codigo = pedido.codigo;
  if (typeof codigo !== 'string' || codigo[0] !== 'd' || codigo.length < 20 || codigo.length > LIMITES.largoDelCodigo || !/^d[A-Za-z0-9_-]+$/.test(codigo)) falla(400, 'Esa pasada no se puede leer.');
  // se lee la pasada: de ahi sale todo lo que va a la tabla
  const l = await leerCodigo(codigo);
  if (!l || !l.marca) falla(400, 'Esa pasada no se puede leer.');
  const m = l.marca, pista = m.pista, version = l.version;
  if (!(pista >= 1)) falla(400, 'Esa pasada no se puede leer.');
  // La pista de mañana no se puede haber corrido hoy. (Un reloj adelantado unos minutos no es trampa: se acepta un rato
  // antes de la medianoche. Y si llega demasiado temprano, el juego la vuelve a mandar mas tarde.)
  if (!(pista <= hoy(Date.now() + LIMITES.adelanto * 1000) || esCircuito(pista) || esDeLaComunidad(pista))) falla(425, 'Esa pista todavía no empezó.');
  // (en una pista de la comunidad no hay oficial: se corre las veces que se quiera, como en un circuito)
  if (esDeLaComunidad(pista) && !m.practica) falla(400, 'En esa pista no hay pasada oficial.');
  if (!m.ab) {
    if (!(m.t >= 15 && m.t <= 3600)) falla(400, 'Ese tiempo no puede ser.');
    // el tiempo tiene que coincidir con lo grabado (hay dos muestras por segundo, hasta TOPE_MUESTRAS)
    if (l.muestras < TOPE_MUESTRAS && Math.abs((l.muestras - 1) * 0.5 - m.t) > 3) falla(400, 'El tiempo no coincide con la pasada grabada.');
  }
  const jugador = await huella(pedido.llave), practica = m.practica ? 1 : 0, cent = Math.round(m.t * 100);
  const deLaConexion = contador('p:' + de, LIMITES.pasadasPorConexion), deTodos = contador('total', LIMITES.pasadasPorDia);
  const ESTA = 'pista = ?2 AND version = ?3 AND jugador = ?4';
  for (let intento = 0; intento < 4; intento++) {
    let r;
    try {
      r = await DB.batch([
        deLaConexion.anotar(DB),
        deTodos.anotar(DB),
        // La pasada entra si no se paso ningun tope y, si es oficial, si ese corredor no tiene ya OTRA en esa pista
        // (la oficial es una sola: vale la primera que llego). Si es la misma de antes, se actualiza: cambio el apodo.
        DB.prepare(`INSERT INTO pasadas (id, pista, version, jugador, practica, cent, nombre, t, c, auto, ab, ayuda, codigo, creado)
          SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14
          WHERE ${ENTRA('?15', '?16')} AND ${ENTRA('?17', '?18')}
            AND (?5 = 1 OR NOT EXISTS (SELECT 1 FROM pasadas WHERE ${ESTA} AND practica = 0 AND cent <> ?6))
            AND (?2 < ${COMUNIDAD.desde} OR ?2 > ${COMUNIDAD.hasta} OR ${viva('?2', '?3', '?14')})
          ON CONFLICT (pista, version, jugador, practica, cent) DO UPDATE SET nombre = excluded.nombre, codigo = excluded.codigo RETURNING id`)
          .bind(alAzar(7), pista, version, jugador, practica, cent, m.nombre, m.t, m.c, m.auto, m.ab || '', m.ayuda ? 1 : 0, codigo, ahora(),
            deLaConexion.clave, deLaConexion.tope, deTodos.clave, deTodos.tope),
        // en sus clubes figura con el apodo de su ultima pasada (si es que quedo guardada)
        DB.prepare(`UPDATE miembros SET nombre = ?1 WHERE jugador = ?4 AND nombre <> ?1
          AND EXISTS (SELECT 1 FROM pasadas WHERE ${ESTA} AND practica = ?5 AND cent = ?6)`).bind(m.nombre, pista, version, jugador, practica, cent),
        // (si es de una pista de la comunidad: si sigue vigente, para poder decir por que no entro)
        DB.prepare(`SELECT ${viva('?1', '?2', '?3')} AS viva`).bind(pista, version, ahora()),
      ]);
    } catch (e) {
      if (intento < 3 && esRepetido(e)) continue;   // (justo ese codigo corto ya existia: se prueba con otro)
      throw e;
    }
    const fila = r[2].results[0];
    if (fila) return { id: fila.id };
    if (esDeLaComunidad(pista) && !r[4].results[0].viva) falla(410, 'Esa pista ya no está: venció o la borraron.');
    if (deLaConexion.sePaso(r[0])) falla(429, 'Desde esta conexión ya se subieron muchas pasadas hoy.');
    if (deTodos.sePaso(r[1])) falla(429, 'Hoy el servidor ya no recibe más pasadas.');
    falla(409, 'Ya tenés una pasada oficial en esta pista.');
  }
  return falla(500, 'No se pudo guardar.');
}
async function traerPasada(env, id) {
  if (!esCodigoCorto(id)) falla(404, 'Esa pasada no existe.');
  const fila = await env.DB.prepare('SELECT codigo, jugador FROM pasadas WHERE id = ?1').bind(id).first();
  return fila ? { codigo: fila.codigo, j: fila.jugador } : falla(404, 'Esa pasada ya no está guardada.');
}

// --- los clubes ---
const CUANTOS = '(SELECT COUNT(*) FROM miembros WHERE club = ?1)';      // cuanta gente hay en el club ?1
const MIS_CLUBES = '(SELECT COUNT(*) FROM miembros WHERE jugador = ?2)';   // en cuantos clubes esta el corredor ?2
const clubDe = async (DB, codigo) => {
  if (!esCodigoCorto(codigo)) falla(404, 'Ese club no existe.');
  const c = await DB.prepare(`SELECT codigo, nombre, ${CUANTOS} AS miembros FROM clubes WHERE codigo = ?1`).bind(codigo).first();
  return c || falla(404, 'Ese club no existe.');
};
async function crearClub(env, pedido, de) {
  const DB = env.DB, nombre = limpiar(pedido.nombre, 24);
  if (!esLlave(pedido.llave)) falla(400, 'Falta la llave.');
  if (nombre.length < 2) falla(400, 'Ponele un nombre al club.');
  const jugador = await huella(pedido.llave), creados = contador('c:' + de, LIMITES.clubesPorConexion), t = ahora();
  for (let intento = 0; intento < 3; intento++) {
    const codigo = alAzar(8);
    let r;
    try {
      r = await DB.batch([
        creados.anotar(DB),
        // el club se crea si el corredor no esta ya en demasiados y si la conexion no creo demasiados hoy
        DB.prepare(`INSERT INTO clubes (codigo, nombre, creador, creado) SELECT ?1, ?3, ?2, ?4
          WHERE ${MIS_CLUBES} < ?5 AND ${ENTRA('?6', '?7')} RETURNING codigo`).bind(codigo, jugador, nombre, t, LIMITES.clubesPorJugador, creados.clave, creados.tope),
        // y quien lo crea queda adentro (solo si de verdad se creo recien)
        DB.prepare(`INSERT INTO miembros (club, jugador, nombre, desde) SELECT ?1, ?2, ?3, ?4
          WHERE EXISTS (SELECT 1 FROM clubes WHERE codigo = ?1 AND creador = ?2 AND creado = ?4)`).bind(codigo, jugador, limpiar(pedido.apodo, 14), t),
      ]);
    } catch (e) {
      if (intento < 2 && esRepetido(e)) continue;   // (justo ese codigo ya existia: se prueba con otro)
      throw e;
    }
    if (r[1].results[0]) return { codigo, nombre, miembros: 1 };
    if (creados.sePaso(r[0])) falla(429, 'Desde esta conexión ya se crearon muchos clubes hoy. Probá mañana.');
    falla(400, 'Ya estás en muchos clubes. Salí de alguno para crear otro.');
  }
  return falla(500, 'No se pudo crear.');
}
async function entrarAlClub(env, codigo, pedido, de) {
  const DB = env.DB;
  if (!esLlave(pedido.llave)) falla(400, 'Falta la llave.');
  if (!esCodigoCorto(codigo)) falla(404, 'Ese club no existe.');
  const jugador = await huella(pedido.llave), apodo = limpiar(pedido.apodo, 14), ingresos = contador('e:' + de, LIMITES.entradasPorConexion);
  const EXISTE = 'EXISTS (SELECT 1 FROM clubes WHERE codigo = ?1)', YA_ESTOY = 'EXISTS (SELECT 1 FROM miembros WHERE club = ?1 AND jugador = ?2)';
  const HAY_LUGAR = `${EXISTE} AND NOT ${YA_ESTOY} AND ${CUANTOS} < ?3 AND ${MIS_CLUBES} < ?4`;
  const r = await DB.batch([
    // como estaba todo antes: el club, cuantos son, en cuantos clubes estoy y si ya estoy en este
    DB.prepare(`SELECT nombre, ${CUANTOS} AS miembros, ${MIS_CLUBES} AS mios, ${YA_ESTOY} AS soy FROM clubes WHERE codigo = ?1`).bind(codigo, jugador),
    // el ingreso se cuenta solo si es alguien nuevo y hay lugar (volver a entrar no cuenta)
    DB.prepare(`INSERT INTO limites (clave, n, vence) SELECT ?5, 1, ?6 WHERE ${HAY_LUGAR} ${SUMA}?7 RETURNING n`)
      .bind(codigo, jugador, LIMITES.miembrosPorClub, LIMITES.clubesPorJugador, ingresos.clave, ingresos.vence, ingresos.tope),
    // entra, si hay lugar y la conexion no sumo demasiada gente hoy
    DB.prepare(`INSERT INTO miembros (club, jugador, nombre, desde) SELECT ?1, ?2, ?5, ?6 WHERE ${HAY_LUGAR} AND ${ENTRA('?7', '?8')}`)
      .bind(codigo, jugador, LIMITES.miembrosPorClub, LIMITES.clubesPorJugador, apodo, ahora(), ingresos.clave, ingresos.tope),
    // el que ya estaba y cambio de apodo queda con el nuevo
    DB.prepare("UPDATE miembros SET nombre = ?3 WHERE club = ?1 AND jugador = ?2 AND ?3 <> '' AND nombre <> ?3").bind(codigo, jugador, apodo),
    DB.prepare(`SELECT ${YA_ESTOY} AS soy`).bind(codigo, jugador),
  ]);
  const antes = r[0].results[0];
  if (!antes) falla(404, 'Ese club no existe.');
  if (r[4].results[0].soy) return { codigo, nombre: antes.nombre, miembros: antes.miembros + (antes.soy ? 0 : 1) };
  if (antes.miembros >= LIMITES.miembrosPorClub) falla(400, 'Ese club está completo.');
  if (antes.mios >= LIMITES.clubesPorJugador) falla(400, 'Ya estás en muchos clubes. Salí de alguno para sumarte a otro.');
  return falla(429, 'Desde esta conexión ya se sumó mucha gente a clubes hoy. Probá mañana.');
}
async function salirDelClub(env, codigo, pedido) {
  const DB = env.DB;
  if (!esLlave(pedido.llave) || !esCodigoCorto(codigo)) falla(400, 'Falta la llave.');
  await DB.batch([
    DB.prepare('DELETE FROM miembros WHERE club = ?1 AND jugador = ?2').bind(codigo, await huella(pedido.llave)),
    // un club sin nadie se borra
    DB.prepare('DELETE FROM clubes WHERE codigo = ?1 AND NOT EXISTS (SELECT 1 FROM miembros WHERE club = ?1)').bind(codigo),
  ]);
  return { listo: true };
}

// --- las tablas: de cada club, lo que corrio cada miembro en esa pista ---
// De cada corredor va su oficial (si la corrio) y, aparte, su mejor practica. "mio" marca las del que pregunta.
// "faltan" son los apodos de los del club que todavia no tienen tiempo en esa pista (en un circuito, ni una practica).
async function tablas(env, pedido) {
  const DB = env.DB, pista = Math.floor(Number(pedido.pista)), version = Math.floor(Number(pedido.version));
  if (!(pista >= 1 && pista < 20000) || !(version >= 0 && version < 64)) falla(400, 'Falta la pista.');
  const codigos = [...new Set(Array.isArray(pedido.clubes) ? pedido.clubes : [])].filter(esCodigoCorto).slice(0, LIMITES.clubesPorPedido);
  const yo = esLlave(pedido.llave) ? await huella(pedido.llave) : '';
  const salida = { clubes: {} };
  if (!codigos.length) return salida;
  const pedidos = [];
  for (const codigo of codigos) {
    pedidos.push(DB.prepare(`SELECT nombre, ${CUANTOS} AS miembros, EXISTS (SELECT 1 FROM miembros WHERE club = ?1 AND jugador = ?2) AS soy FROM clubes WHERE codigo = ?1`).bind(codigo, yo));
    pedidos.push(DB.prepare(`SELECT p.id, p.jugador, p.nombre, m.nombre AS apodo, p.t, p.c, p.auto, p.ab, p.ayuda, p.practica, p.creado
      FROM miembros m JOIN pasadas p ON p.jugador = m.jugador AND p.pista = ?2 AND p.version = ?3 WHERE m.club = ?1`).bind(codigo, pista, version));
    pedidos.push(DB.prepare("SELECT jugador, nombre FROM miembros WHERE club = ?1 AND nombre <> '' ORDER BY desde LIMIT ?2").bind(codigo, LIMITES.miembrosPorClub));
    // las pistas que armo la gente del club y siguen vigentes
    pedidos.push(DB.prepare('SELECT numero, version, nombre, autor, vence FROM pistas WHERE club = ?1 AND vence > ?2 ORDER BY creado DESC LIMIT ?3').bind(codigo, ahora(), LIMITES.pistasPorClub));
  }
  const r = await DB.batch(pedidos);
  const fijo = esCircuito(pista) || esDeLaComunidad(pista);   // (en un circuito no hay oficial: cuenta la mejor practica)
  codigos.forEach((codigo, k) => {
    const b = k * 4;   // (de cada club van cuatro consultas: ver mas arriba)
    const club = r[b].results[0];
    if (!club) { salida.clubes[codigo] = null; return; }   // ese club ya no existe
    const oficial = new Map(), practica = new Map();
    for (const p of r[b + 1].results) {
      if (!p.practica) { const o = oficial.get(p.jugador); if (!o || p.creado > o.creado) oficial.set(p.jugador, p); }
      else if (!p.ab) { const o = practica.get(p.jugador); if (!o || p.t < o.t) practica.set(p.jugador, p); }
    }
    // (el nombre es el apodo de ahora: si alguien se lo cambia, cambia en la tabla aunque no vuelva a correr)
    const fila = (p) => ({ id: p.id, j: p.jugador, nombre: p.apodo || p.nombre, t: p.t, c: p.c, auto: p.auto, ab: p.ab, ayuda: !!p.ayuda, practica: !!p.practica, ...(p.jugador === yo ? { mio: true } : {}) });
    const corrieron = fijo ? practica : oficial;
    const faltan = r[b + 2].results.filter((x) => !corrieron.has(x.jugador) && x.jugador !== yo).map((x) => x.nombre);
    salida.clubes[codigo] = { nombre: club.nombre, miembros: club.miembros, soy: !!club.soy, tabla: [...oficial.values(), ...practica.values()].map(fila), faltan,
      pistas: r[b + 3].results.map((x) => ({ numero: x.numero, version: x.version, nombre: x.nombre, autor: x.autor, vence: x.vence })) };
  });
  return salida;
}

// --- la Travesia: el mejor record de km de cada uno ---
// Solo entra si supera el que ya tenia ese corredor (el nombre, en cambio, se pone al dia siempre). Los km tienen que ser
// creibles (de 0 a kmMaximo) y se guardan con dos decimales; el auto es el codigo de sus partes (como en una pasada).
async function guardarTravesia(env, pedido, de) {
  const DB = env.DB, nombre = limpiar(pedido.nombre, 14), km = Math.round(Number(pedido.km) * 100) / 100;
  if (!esLlave(pedido.llave)) falla(400, 'Falta la llave.');
  if (!nombre) falla(400, 'Poné tu nombre para guardar el récord.');
  if (typeof pedido.km !== 'number' || !Number.isFinite(km) || !(km > 0 && km <= LIMITES.kmMaximo)) falla(400, 'Esos kilómetros no pueden ser.');
  const auto = typeof pedido.auto === 'string' && /^[0-9A-Za-z]{1,12}$/.test(pedido.auto) ? pedido.auto : '';
  const jugador = await huella(pedido.llave), t = ahora();
  const deLaConexion = contador('t:' + de, LIMITES.travesiasPorConexion), deTodos = contador('travesias', LIMITES.travesiasPorDia);
  const r = await DB.batch([
    deLaConexion.anotar(DB),
    deTodos.anotar(DB),
    // entra si no se paso ningun tope; si ya tenia un record, solo lo pisa uno mayor
    DB.prepare(`INSERT INTO travesias (jugador, nombre, km, auto, creado) SELECT ?1, ?2, ?3, ?4, ?5 WHERE ${ENTRA('?6', '?7')} AND ${ENTRA('?8', '?9')}
      ON CONFLICT (jugador) DO UPDATE SET nombre = excluded.nombre, km = excluded.km, auto = excluded.auto, creado = excluded.creado WHERE excluded.km > travesias.km
      RETURNING km`).bind(jugador, nombre, km, auto, t, deLaConexion.clave, deLaConexion.tope, deTodos.clave, deTodos.tope),
    // el nombre se pone al dia aunque no haya record nuevo, y en sus clubes figura con el apodo de ahora
    DB.prepare('UPDATE travesias SET nombre = ?2 WHERE jugador = ?1 AND nombre <> ?2').bind(jugador, nombre),
    DB.prepare('SELECT km FROM travesias WHERE jugador = ?1').bind(jugador),
  ]);
  const fila = r[2].results[0], guardado = r[4].results[0];
  if (fila) return { km: fila.km, nuevo: true };
  if (deLaConexion.sePaso(r[0])) falla(429, 'Desde esta conexión ya se mandaron muchos récords hoy.');
  if (deTodos.sePaso(r[1])) falla(429, 'Hoy el servidor ya no recibe más récords.');
  return { km: guardado ? guardado.km : km, nuevo: false };   // (ya tenia uno mejor o igual)
}
// La tabla de la Travesia de cada club: el record de cada miembro. "mio" marca el del que pregunta.
async function tablasTravesia(env, pedido) {
  const DB = env.DB, codigos = [...new Set(Array.isArray(pedido.clubes) ? pedido.clubes : [])].filter(esCodigoCorto).slice(0, LIMITES.clubesPorPedido);
  const yo = esLlave(pedido.llave) ? await huella(pedido.llave) : '';
  const salida = { clubes: {} };
  if (!codigos.length) return salida;
  const pedidos = [];
  for (const codigo of codigos) {
    pedidos.push(DB.prepare(`SELECT nombre, ${CUANTOS} AS miembros FROM clubes WHERE codigo = ?1`).bind(codigo));
    pedidos.push(DB.prepare(`SELECT t.jugador, COALESCE(NULLIF(m.nombre, ''), t.nombre) AS nombre, t.km, t.auto
      FROM miembros m JOIN travesias t ON t.jugador = m.jugador WHERE m.club = ?1 ORDER BY t.km DESC LIMIT ?2`).bind(codigo, LIMITES.miembrosPorClub));
  }
  const r = await DB.batch(pedidos);
  codigos.forEach((codigo, k) => {
    const club = r[k * 2].results[0];
    salida.clubes[codigo] = club ? { nombre: club.nombre, tabla: r[k * 2 + 1].results.map((x) => ({ j: x.jugador, nombre: x.nombre, km: x.km, auto: x.auto, ...(x.jugador === yo ? { mio: true } : {}) })) } : null;   // null: el club ya no existe
  });
  return salida;
}

// --- las pistas de la comunidad ---
// Publica una pista. Su numero se elige al azar entre los libres (los que nunca se usaron o cuya pista ya vencio).
// Entra si no se paso ningun tope y, si es para un club, si el que la publica esta en ese club.
async function crearPista(env, pedido, de) {
  const DB = env.DB, nombre = limpiar(pedido.nombre, 24), autor = limpiar(pedido.apodo, 14), club = pedido.club ? String(pedido.club) : '';
  if (!esLlave(pedido.llave)) falla(400, 'Falta la llave.');
  if (nombre.length < 2) falla(400, 'Ponele un nombre a la pista.');
  if (!autor) falla(400, 'Poné tu nombre para publicar la pista.');
  if (club && !esCodigoCorto(club)) falla(404, 'Ese club no existe.');
  const hoja = leerHoja(pedido.hoja), texto = hoja ? JSON.stringify(hoja) : '';
  if (!hoja || texto.length > LIMITES.largoDeLaHoja) falla(400, 'Esa pista no se puede leer.');
  // se la arma, como la va a armar el juego: tiene que entrar entera y tener el largo que hace falta (armarla tarda un
  // milisegundo: el terreno no, ese lo arma cada uno en su aparato)
  const armada = armarHoja(hoja);
  if (armada.error === 'corta') falla(400, 'Esa pista es muy corta para correrla.');
  if (armada.error) falla(400, armada.error === 'larga' ? 'Esa pista es demasiado larga.' : 'Esa pista no se puede armar: el camino se cruza.');
  const jugador = await huella(pedido.llave), t = ahora(), vence = t + COMUNIDAD.dias * DIA;
  const deLaConexion = contador('k:' + de, LIMITES.pistasPorConexion), deTodos = contador('pistas', LIMITES.pistasPorDia);
  const MIAS = '(SELECT COUNT(*) FROM pistas WHERE creador = ?4 AND vence > ?7)', DEL_CLUB = '(SELECT COUNT(*) FROM pistas WHERE club = ?5 AND vence > ?7)';
  const SOY = 'EXISTS (SELECT 1 FROM miembros WHERE club = ?5 AND jugador = ?4)';
  for (let intento = 0; intento < 6; intento++) {
    const numero = COMUNIDAD.desde + Math.floor(Math.random() * (COMUNIDAD.hasta - COMUNIDAD.desde + 1));
    const r = await DB.batch([
      deLaConexion.anotar(DB),
      deTodos.anotar(DB),
      // entra en un numero libre (si estaba ocupado por una pista vencida, se la pisa con la version siguiente)
      DB.prepare(`INSERT INTO pistas (numero, version, nombre, autor, creador, club, hoja, creado, vence)
        SELECT ?1, 1, ?2, ?3, ?4, ?5, ?6, ?7, ?8
        WHERE ${ENTRA('?11', '?12')} AND ${ENTRA('?13', '?14')} AND ${MIAS} < ?9 AND (?5 = '' OR (${SOY} AND ${DEL_CLUB} < ?10))
        ON CONFLICT (numero) DO UPDATE SET version = (pistas.version % 63) + 1, nombre = excluded.nombre, autor = excluded.autor, creador = excluded.creador,
          club = excluded.club, hoja = excluded.hoja, creado = excluded.creado, vence = excluded.vence
          WHERE pistas.vence < ?7
        RETURNING numero, version`).bind(numero, nombre, autor, jugador, club, texto, t, vence, LIMITES.pistasPorJugador, LIMITES.pistasPorClub,
        deLaConexion.clave, deLaConexion.tope, deTodos.clave, deTodos.tope),
      // (para poder decir por que no entro)
      DB.prepare(`SELECT ${MIAS} AS mias, ${DEL_CLUB} AS delClub, ${SOY} AS soy, EXISTS (SELECT 1 FROM clubes WHERE codigo = ?5) AS hayClub`)
        .bind(null, null, null, jugador, club, null, t),
    ]);
    const fila = r[2].results[0];
    if (fila) return { numero: fila.numero, version: fila.version, nombre, autor, club, vence };
    const d = r[3].results[0];
    if (deLaConexion.sePaso(r[0])) falla(429, 'Desde esta conexión ya se publicaron muchas pistas hoy. Probá mañana.');
    if (deTodos.sePaso(r[1])) falla(429, 'Hoy ya no se pueden publicar más pistas. Probá mañana.');
    if (d.mias >= LIMITES.pistasPorJugador) falla(400, 'Ya tenés ' + d.mias + ' pistas publicadas, el máximo. Borrá alguna para publicar otra.');
    if (club && !d.hayClub) falla(404, 'Ese club no existe.');
    if (club && !d.soy) falla(403, 'Para publicar una pista en ese club tenés que estar en el club.');
    if (club && d.delClub >= LIMITES.pistasPorClub) falla(400, 'Ese club ya tiene muchas pistas. Cuando venza alguna, se puede publicar otra.');
    // (si no fue por nada de eso, el numero estaba ocupado: se prueba con otro)
  }
  return falla(503, 'No hay lugar para pistas nuevas. Probá más tarde.');
}
// Trae una pista y su tabla: el mejor tiempo (que haya llegado) de cada uno que la corrio.
async function traerPista(env, texto) {
  const DB = env.DB, numero = Number(texto);
  if (!/^\d{5}$/.test(texto) || !esDeLaComunidad(numero)) falla(404, 'Esa pista no existe.');
  const r = await DB.batch([
    DB.prepare('SELECT p.numero, p.version, p.nombre, p.autor, p.club, p.hoja, p.vence, c.nombre AS clubNombre FROM pistas p LEFT JOIN clubes c ON c.codigo = p.club WHERE p.numero = ?1').bind(numero),
    DB.prepare(`SELECT p.id, p.jugador, p.nombre, p.t, p.c, p.auto, p.ayuda FROM pasadas p
      WHERE p.pista = ?1 AND p.version = (SELECT version FROM pistas WHERE numero = ?1) AND p.practica = 1 AND p.ab = ''
        AND p.t = (SELECT MIN(q.t) FROM pasadas q WHERE q.pista = p.pista AND q.version = p.version AND q.jugador = p.jugador AND q.practica = 1 AND q.ab = '')
      ORDER BY p.t LIMIT 100`).bind(numero),
  ]);
  const p = r[0].results[0];
  if (!p) falla(404, 'Esa pista no existe.');
  if (p.vence === 0) falla(410, 'Esa pista la borró quien la armó.');
  if (p.vence <= ahora()) falla(410, 'Esa pista ya venció: duran dos semanas.');
  if (!p.hoja) falla(404, 'Esa pista no existe.');
  let hoja = null;
  try { hoja = JSON.parse(p.hoja); } catch (e) { /* no deberia pasar: se guardo leida */ }
  const vistos = new Set(), tabla = [];
  for (const x of r[1].results) if (!vistos.has(x.jugador)) { vistos.add(x.jugador); tabla.push({ id: x.id, j: x.jugador, nombre: x.nombre, t: x.t, c: x.c, auto: x.auto, ayuda: !!x.ayuda, practica: true }); }
  return { numero: p.numero, version: p.version, nombre: p.nombre, autor: p.autor, club: p.club, clubNombre: p.clubNombre || '', hoja, vence: p.vence, tabla };
}

// Borra una pista: solo quien la armo, y si sigue vigente. Se borran sus tiempos y su hoja; la fila queda, con "vence" en
// cero (asi se sabe que la borraron), y el numero se puede volver a usar enseguida, con la version siguiente.
async function borrarPista(env, texto, pedido) {
  const DB = env.DB, numero = Number(texto);
  if (!esLlave(pedido.llave)) falla(400, 'Falta la llave.');
  if (!/^\d{5}$/.test(texto) || !esDeLaComunidad(numero)) falla(404, 'Esa pista no existe.');
  const jugador = await huella(pedido.llave), t = ahora();
  const MIA = 'EXISTS (SELECT 1 FROM pistas WHERE numero = ?1 AND creador = ?2 AND vence > ?3)';
  const r = await DB.batch([
    // (como estaba: para poder decir por que no se borro)
    DB.prepare('SELECT creador = ?2 AS mia, vence > ?3 AS viva FROM pistas WHERE numero = ?1').bind(numero, jugador, t),
    DB.prepare(`DELETE FROM pasadas WHERE pista = ?1 AND version = (SELECT version FROM pistas WHERE numero = ?1) AND ${MIA}`).bind(numero, jugador, t),
    DB.prepare("UPDATE pistas SET vence = 0, hoja = '' WHERE numero = ?1 AND creador = ?2 AND vence > ?3 RETURNING numero").bind(numero, jugador, t),
  ]);
  if (r[2].results[0]) return { borrada: true, numero };
  const antes = r[0].results[0];
  if (!antes || !antes.viva) falla(404, 'Esa pista ya no existe.');
  return falla(403, 'Esa pista no es tuya: solo la puede borrar quien la armó.');
}

// de vez en cuando se borra lo viejo (las pasadas de hace meses y los contadores vencidos)
async function limpiarLoViejo(DB) {
  const t = ahora();
  await DB.batch([
    DB.prepare('DELETE FROM pasadas WHERE creado < ?1').bind(t - LIMITES.guardaDias * 86400),
    DB.prepare('DELETE FROM limites WHERE vence < ?1').bind(t),
    // de las pistas de la comunidad que vencieron hace una semana: sus pasadas, y la hoja (la fila queda, por su version)
    DB.prepare(`DELETE FROM pasadas WHERE pista BETWEEN ${COMUNIDAD.desde} AND ${COMUNIDAD.hasta}
      AND NOT EXISTS (SELECT 1 FROM pistas WHERE numero = pasadas.pista AND version = pasadas.version AND vence > ?1)`).bind(t - 7 * DIA),
    DB.prepare("UPDATE pistas SET hoja = '' WHERE vence < ?1 AND hoja <> ''").bind(t - 7 * DIA),
  ]);
}

// --- la entrada: lee el pedido, lo reparte y contesta ---
// Quien puede usarlo. El navegador dice desde que pagina viene cada pedido ("origin"): se atiende al juego publicado.
// Un servidor de prueba, corriendo en la misma compu, atiende ademas a una copia local del juego y a las pruebas (que no
// dicen de donde vienen). El publicado, no: asi una copia retocada del juego no puede subirle tiempos desde un navegador.
// (No es un candado: quien sepa programar puede mentir de donde viene. Es para que no sea facil.)
const DE_ENTRE_CASA = /^(localhost|127\.0\.0\.1)$/;
function permiso(env, pedido) {
  const origen = pedido.headers.get('origin') || '', permitidos = String(env.ORIGENES || ORIGENES).split(',').map((x) => x.trim());
  const local = DE_ENTRE_CASA.test(new URL(pedido.url).hostname) && (!origen || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origen));
  const si = permitidos.includes(origen) || local;
  return { si, cabeza: { 'access-control-allow-origin': si && origen ? origen : permitidos[0], vary: 'origin', 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type', 'access-control-max-age': '86400' } };
}
export default {
  async fetch(pedido, env, ctx) {
    const quien = permiso(env, pedido), cabeza = { ...quien.cabeza, 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
    const contestar = (estado, cosa) => new Response(JSON.stringify(cosa), { status: estado, headers: cabeza });
    if (pedido.method === 'OPTIONS') return new Response(null, { status: 204, headers: cabeza });
    try {
      const partes = new URL(pedido.url).pathname.split('/').filter(Boolean), metodo = pedido.method, donde = partes[0] || '';
      if (metodo !== 'GET' && metodo !== 'POST') falla(405, 'Eso no se puede.');
      if (!donde) return contestar(200, { juego: 'Shakedown', hoy: hoy() });
      if (metodo === 'POST' && !quien.si) falla(403, 'Desde ahí no se puede.');   // (leer puede cualquiera; escribir, solo el juego)
      const DB = env.DB, despues = (promesa) => { if (ctx && ctx.waitUntil) ctx.waitUntil(promesa.catch(() => {})); };
      if (!DB) falla(500, 'El servidor no tiene base de datos.');
      // (la primera vez que el programa se despierta repasa el esquema, sin hacer esperar a nadie: asi, si un dia se le
      // agrega una tabla o un indice, aparecen solos)
      if (!revisadas.has(DB)) { revisadas.add(DB); despues(crearTablas(DB)); }
      let cuerpo = {};
      if (metodo === 'POST') {
        const tope = LIMITES.largoDelCodigo + 2000;
        if (Number(pedido.headers.get('content-length')) > tope) falla(413, 'Demasiado largo.');   // (sin ponerse a leerlo)
        const texto = await pedido.text();
        if (texto.length > tope) falla(413, 'Demasiado largo.');
        try { cuerpo = JSON.parse(texto || '{}'); } catch (e) { falla(400, 'No se entiende el pedido.'); }
        if (!cuerpo || typeof cuerpo !== 'object') falla(400, 'No se entiende el pedido.');
      }
      // De que conexion viene (para los limites). No se guarda la direccion, ni siquiera una huella que permita
      // averiguarla: quedan tres letras de la huella, que comparten miles de direcciones distintas. Para contar alcanza.
      const de = (await huella(conexionDe(pedido.headers.get('cf-connecting-ip') || 'local') + '|' + (env.SAL || 'shakedown'))).slice(0, 3);
      let hacer;
      if (donde === 'pasadas' && metodo === 'POST' && partes.length === 1) hacer = () => guardarPasada(env, cuerpo, de);
      else if (donde === 'pasadas' && metodo === 'GET' && partes.length === 2) hacer = () => traerPasada(env, partes[1]);
      else if (donde === 'clubes' && metodo === 'POST' && partes.length === 1) hacer = () => crearClub(env, cuerpo, de);
      else if (donde === 'clubes' && metodo === 'GET' && partes.length === 2) hacer = () => clubDe(DB, partes[1]);
      else if (donde === 'clubes' && metodo === 'POST' && partes.length === 3 && partes[2] === 'entrar') hacer = () => entrarAlClub(env, partes[1], cuerpo, de);
      else if (donde === 'clubes' && metodo === 'POST' && partes.length === 3 && partes[2] === 'salir') hacer = () => salirDelClub(env, partes[1], cuerpo);
      else if (donde === 'tablas' && metodo === 'POST' && partes.length === 1) hacer = () => tablas(env, cuerpo);
      else if (donde === 'travesia' && metodo === 'POST' && partes.length === 1) hacer = () => guardarTravesia(env, cuerpo, de);
      else if (donde === 'travesias' && metodo === 'POST' && partes.length === 1) hacer = () => tablasTravesia(env, cuerpo);
      else if (donde === 'pistas' && metodo === 'POST' && partes.length === 1) hacer = () => crearPista(env, cuerpo, de);
      else if (donde === 'pistas' && metodo === 'GET' && partes.length === 2) hacer = () => traerPista(env, partes[1]);
      else if (donde === 'pistas' && metodo === 'POST' && partes.length === 3 && partes[2] === 'borrar') hacer = () => borrarPista(env, partes[1], cuerpo);
      else falla(404, 'Eso no existe.');
      const cosa = await conTablas(DB, hacer);
      if ((donde === 'pasadas' || donde === 'pistas') && metodo === 'POST' && Math.random() < 0.02) despues(limpiarLoViejo(DB));
      return contestar(200, cosa);
    } catch (e) {
      if (e instanceof Aviso) return contestar(e.estado, { error: e.message });
      console.error(e);
      return contestar(500, { error: 'Algo falló en el servidor.' });
    }
  },
};

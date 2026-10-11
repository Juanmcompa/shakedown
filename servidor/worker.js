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
//                                                               y quienes del club todavia no la corrieron.
//
// No hay cuentas ni contraseñas. Cada aparato inventa una "llave" larga al azar y la manda cuando escribe algo; aca se
// guarda solo su huella (no la llave), que hace de numero de corredor. Nadie mas la conoce, asi que nadie puede subir
// tiempos a nombre de otro. De cada pasada se guarda lo mismo que viaja en un link largo: el apodo, el tiempo, los
// colores de los sectores, el auto, si uso ayuda, y el recorrido grabado. Nada mas.
//
// El "codigo" de una pasada es el mismo texto que antes iba entero en el link. Aca se lo lee con el mismo programa
// que usa el juego (src/fantasma.js): lo que figura en la tabla sale de la pasada grabada, no de lo que diga el que la manda.
import { leerCodigo } from '../src/fantasma.js';
import { esCircuito } from '../src/circuitos.js';
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
  largoDelCodigo: 6000,       // letras, como mucho, de una pasada (una de dos minutos lleva unas 600; la mas larga posible, 4.500)
};
const ORIGENES = 'https://juanmcompa.github.io';   // desde que paginas se puede usar (se cambia con la variable ORIGENES)

// --- la base de datos: las tablas se crean solas la primera vez ---
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
  // los contadores de los limites: uno por conexion y por rato ("vence" dice cuando se puede borrar)
  'CREATE TABLE IF NOT EXISTS limites (clave TEXT PRIMARY KEY, n INTEGER NOT NULL, vence INTEGER NOT NULL)',
];
const listas = new WeakMap();   // (una vez por base, mientras el programa siga despierto)
function preparar(DB) {
  if (!listas.has(DB)) listas.set(DB, DB.batch(ESQUEMA.map((s) => DB.prepare(s))).catch((e) => { listas.delete(DB); throw e; }));
  return listas.get(DB);
}

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
const limpiar = (txt, largo) => String(txt || '').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, largo);
const esLlave = (x) => typeof x === 'string' && /^[A-Za-z0-9_-]{16,64}$/.test(x);
const esCodigoCorto = (x) => typeof x === 'string' && /^[0-9A-Za-z]{6,12}$/.test(x);
const ahora = () => Math.floor(Date.now() / 1000);

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

// Cuenta un pedido mas de esa clave en el dia y dice si se paso del tope.
// (Una vez pasado el tope ya no anota nada: los pedidos de mas no gastan escrituras en la base.)
const DIA = 86400;
async function seVaDeMambo(DB, clave, tope) {
  const dia = Math.floor(ahora() / DIA);
  const fila = await DB.prepare('INSERT INTO limites (clave, n, vence) VALUES (?1, 1, ?2) ON CONFLICT (clave) DO UPDATE SET n = n + 1 WHERE n <= ?3 RETURNING n')
    .bind(clave + ':' + dia, (dia + 2) * DIA, tope).first();
  return !fila || fila.n > tope;
}

// --- las pasadas ---
async function guardarPasada(env, pedido, de) {
  const DB = env.DB;
  if (!esLlave(pedido.llave)) falla(400, 'Falta la llave.');
  const codigo = pedido.codigo;
  if (typeof codigo !== 'string' || codigo[0] !== 'd' || codigo.length < 20 || codigo.length > LIMITES.largoDelCodigo || !/^d[A-Za-z0-9_-]+$/.test(codigo)) falla(400, 'Esa pasada no se puede leer.');
  // se lee la pasada: de ahi sale todo lo que va a la tabla
  const l = await leerCodigo(codigo);
  if (!l || !l.marca) falla(400, 'Esa pasada no se puede leer.');
  const m = l.marca, pista = m.pista, version = l.version;
  if (!(pista >= 1) || !(pista <= hoy() + 1 || esCircuito(pista))) falla(400, 'Esa pista todavía no se corrió.');
  if (!m.ab) {
    if (!(m.t >= 15 && m.t <= 3600)) falla(400, 'Ese tiempo no puede ser.');
    // el tiempo tiene que coincidir con lo grabado (hay dos muestras por segundo, hasta 1900)
    if (l.muestras < 1900 && Math.abs((l.muestras - 1) * 0.5 - m.t) > 3) falla(400, 'El tiempo no coincide con la pasada grabada.');
  }
  const jugador = await huella(pedido.llave), practica = m.practica ? 1 : 0, cent = Math.round(m.t * 100);
  // la oficial es una sola: si ya hay una de este corredor en esta pista, vale esa
  if (!practica) {
    const ya = await DB.prepare('SELECT id, cent FROM pasadas WHERE pista = ?1 AND version = ?2 AND jugador = ?3 AND practica = 0 LIMIT 1').bind(pista, version, jugador).first();
    if (ya && ya.cent !== cent) falla(409, 'Ya tenés una pasada oficial en esta pista.');
  }
  if (await seVaDeMambo(DB, 'p:' + de, LIMITES.pasadasPorConexion)) falla(429, 'Desde esta conexión ya se subieron muchas pasadas hoy.');
  if (await seVaDeMambo(DB, 'total', LIMITES.pasadasPorDia)) falla(429, 'Hoy el servidor ya no recibe más pasadas.');
  for (let intento = 0; intento < 4; intento++) {
    try {
      const fila = await DB.prepare(`INSERT INTO pasadas (id, pista, version, jugador, practica, cent, nombre, t, c, auto, ab, ayuda, codigo, creado)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)
        ON CONFLICT (pista, version, jugador, practica, cent) DO UPDATE SET nombre = excluded.nombre, codigo = excluded.codigo RETURNING id`)
        .bind(alAzar(7), pista, version, jugador, practica, cent, m.nombre, m.t, m.c, m.auto, m.ab || '', m.ayuda ? 1 : 0, codigo, ahora()).first();
      // en sus clubes figura con el apodo de su ultima pasada
      await DB.prepare('UPDATE miembros SET nombre = ?2 WHERE jugador = ?1 AND nombre <> ?2').bind(jugador, m.nombre).run();
      return { id: fila.id };
    } catch (e) {
      if (intento === 3 || !/UNIQUE|PRIMARY/i.test(String(e && e.message))) throw e;   // (justo ese codigo corto ya existia: se prueba con otro)
    }
  }
  return falla(500, 'No se pudo guardar.');
}
async function traerPasada(env, id) {
  if (!esCodigoCorto(id)) falla(404, 'Esa pasada no existe.');
  const fila = await env.DB.prepare('SELECT codigo, jugador FROM pasadas WHERE id = ?1').bind(id).first();
  return fila ? { codigo: fila.codigo, j: fila.jugador } : falla(404, 'Esa pasada ya no está guardada.');
}

// --- los clubes ---
const clubDe = async (DB, codigo) => {
  if (!esCodigoCorto(codigo)) falla(404, 'Ese club no existe.');
  const c = await DB.prepare('SELECT c.codigo, c.nombre, (SELECT COUNT(*) FROM miembros m WHERE m.club = c.codigo) AS miembros FROM clubes c WHERE c.codigo = ?1').bind(codigo).first();
  return c || falla(404, 'Ese club no existe.');
};
async function crearClub(env, pedido, de) {
  const DB = env.DB, nombre = limpiar(pedido.nombre, 24);
  if (!esLlave(pedido.llave)) falla(400, 'Falta la llave.');
  if (nombre.length < 2) falla(400, 'Ponele un nombre al club.');
  const jugador = await huella(pedido.llave);
  const mios = await DB.prepare('SELECT COUNT(*) AS n FROM miembros WHERE jugador = ?1').bind(jugador).first();
  if (mios.n >= LIMITES.clubesPorJugador) falla(400, 'Ya estás en muchos clubes. Salí de alguno para crear otro.');
  if (await seVaDeMambo(DB, 'c:' + de, LIMITES.clubesPorConexion)) falla(429, 'Desde esta conexión ya se crearon muchos clubes hoy. Probá mañana.');
  const codigo = alAzar(8), t = ahora();
  await DB.batch([
    DB.prepare('INSERT INTO clubes (codigo, nombre, creador, creado) VALUES (?1, ?2, ?3, ?4)').bind(codigo, nombre, jugador, t),
    DB.prepare('INSERT INTO miembros (club, jugador, nombre, desde) VALUES (?1, ?2, ?3, ?4)').bind(codigo, jugador, limpiar(pedido.apodo, 14), t),
  ]);
  return { codigo, nombre, miembros: 1 };
}
async function entrarAlClub(env, codigo, pedido, de) {
  const DB = env.DB;
  if (!esLlave(pedido.llave)) falla(400, 'Falta la llave.');
  const club = await clubDe(DB, codigo), jugador = await huella(pedido.llave), apodo = limpiar(pedido.apodo, 14);
  const ya = await DB.prepare('SELECT nombre FROM miembros WHERE club = ?1 AND jugador = ?2').bind(codigo, jugador).first();
  if (ya) {
    if (apodo && apodo !== ya.nombre) await DB.prepare('UPDATE miembros SET nombre = ?3 WHERE club = ?1 AND jugador = ?2').bind(codigo, jugador, apodo).run();
    return club;
  }
  if (club.miembros >= LIMITES.miembrosPorClub) falla(400, 'Ese club está completo.');
  const mios = await DB.prepare('SELECT COUNT(*) AS n FROM miembros WHERE jugador = ?1').bind(jugador).first();
  if (mios.n >= LIMITES.clubesPorJugador) falla(400, 'Ya estás en muchos clubes. Salí de alguno para sumarte a otro.');
  if (await seVaDeMambo(DB, 'e:' + de, LIMITES.entradasPorConexion)) falla(429, 'Desde esta conexión ya se sumó mucha gente a clubes hoy. Probá mañana.');
  await DB.prepare('INSERT OR IGNORE INTO miembros (club, jugador, nombre, desde) VALUES (?1, ?2, ?3, ?4)').bind(codigo, jugador, apodo, ahora()).run();
  return { ...club, miembros: club.miembros + 1 };
}
async function salirDelClub(env, codigo, pedido) {
  const DB = env.DB;
  if (!esLlave(pedido.llave) || !esCodigoCorto(codigo)) falla(400, 'Falta la llave.');
  await DB.prepare('DELETE FROM miembros WHERE club = ?1 AND jugador = ?2').bind(codigo, await huella(pedido.llave)).run();
  // un club sin nadie se borra
  await DB.prepare('DELETE FROM clubes WHERE codigo = ?1 AND NOT EXISTS (SELECT 1 FROM miembros WHERE club = ?1)').bind(codigo).run();
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
    pedidos.push(DB.prepare('SELECT c.nombre, (SELECT COUNT(*) FROM miembros m WHERE m.club = c.codigo) AS miembros, (SELECT COUNT(*) FROM miembros m WHERE m.club = c.codigo AND m.jugador = ?2) AS soy FROM clubes c WHERE c.codigo = ?1').bind(codigo, yo));
    pedidos.push(DB.prepare(`SELECT p.id, p.jugador, p.nombre, m.nombre AS apodo, p.t, p.c, p.auto, p.ab, p.ayuda, p.practica, p.creado
      FROM miembros m JOIN pasadas p ON p.jugador = m.jugador AND p.pista = ?2 AND p.version = ?3 WHERE m.club = ?1`).bind(codigo, pista, version));
    pedidos.push(DB.prepare("SELECT jugador, nombre FROM miembros WHERE club = ?1 AND nombre <> '' ORDER BY desde LIMIT ?2").bind(codigo, LIMITES.miembrosPorClub));
  }
  const r = await DB.batch(pedidos);
  const fijo = esCircuito(pista);   // (en un circuito no hay oficial: cuenta la mejor practica)
  codigos.forEach((codigo, k) => {
    const club = r[k * 3].results[0];
    if (!club) { salida.clubes[codigo] = null; return; }   // ese club ya no existe
    const oficial = new Map(), practica = new Map();
    for (const p of r[k * 3 + 1].results) {
      if (!p.practica) { const o = oficial.get(p.jugador); if (!o || p.creado > o.creado) oficial.set(p.jugador, p); }
      else if (!p.ab) { const o = practica.get(p.jugador); if (!o || p.t < o.t) practica.set(p.jugador, p); }
    }
    // (el nombre es el apodo de ahora: si alguien se lo cambia, cambia en la tabla aunque no vuelva a correr)
    const fila = (p) => ({ id: p.id, j: p.jugador, nombre: p.apodo || p.nombre, t: p.t, c: p.c, auto: p.auto, ab: p.ab, ayuda: !!p.ayuda, practica: !!p.practica, ...(p.jugador === yo ? { mio: true } : {}) });
    const corrieron = fijo ? practica : oficial;
    const faltan = r[k * 3 + 2].results.filter((x) => !corrieron.has(x.jugador) && x.jugador !== yo).map((x) => x.nombre);
    salida.clubes[codigo] = { nombre: club.nombre, miembros: club.miembros, soy: !!club.soy, tabla: [...oficial.values(), ...practica.values()].map(fila), faltan };
  });
  return salida;
}

// de vez en cuando se borra lo viejo (las pasadas de hace meses y los contadores vencidos)
async function limpiarLoViejo(DB) {
  const t = ahora();
  await DB.batch([
    DB.prepare('DELETE FROM pasadas WHERE creado < ?1').bind(t - LIMITES.guardaDias * 86400),
    DB.prepare('DELETE FROM limites WHERE vence < ?1').bind(t),
  ]);
}

// --- la entrada: lee el pedido, lo reparte y contesta ---
function permiso(env, pedido) {
  const origen = pedido.headers.get('origin') || '', permitidos = String(env.ORIGENES || ORIGENES).split(',').map((x) => x.trim());
  // (una copia del juego abierta en la misma compu tambien puede: sirve para probar)
  const si = permitidos.includes(origen) || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origen);
  return { 'access-control-allow-origin': si ? origen : permitidos[0], vary: 'origin', 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type', 'access-control-max-age': '86400' };
}
export default {
  async fetch(pedido, env, ctx) {
    const cabeza = { ...permiso(env, pedido), 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
    const contestar = (estado, cosa) => new Response(JSON.stringify(cosa), { status: estado, headers: cabeza });
    if (pedido.method === 'OPTIONS') return new Response(null, { status: 204, headers: cabeza });
    try {
      const partes = new URL(pedido.url).pathname.split('/').filter(Boolean), metodo = pedido.method, donde = partes[0] || '';
      if (metodo !== 'GET' && metodo !== 'POST') falla(405, 'Eso no se puede.');
      if (!donde) return contestar(200, { juego: 'Shakedown', hoy: hoy() });
      if (!env.DB) falla(500, 'El servidor no tiene base de datos.');
      await preparar(env.DB);
      let cuerpo = {};
      if (metodo === 'POST') {
        const texto = await pedido.text();
        if (texto.length > LIMITES.largoDelCodigo + 2000) falla(413, 'Demasiado largo.');
        try { cuerpo = JSON.parse(texto || '{}'); } catch (e) { falla(400, 'No se entiende el pedido.'); }
        if (!cuerpo || typeof cuerpo !== 'object') falla(400, 'No se entiende el pedido.');
      }
      // de que conexion viene (para los limites): se guarda su huella, no la direccion
      const de = await huella(conexionDe(pedido.headers.get('cf-connecting-ip') || 'local') + '|' + (env.SAL || 'shakedown'));
      let cosa;
      if (donde === 'pasadas' && metodo === 'POST' && partes.length === 1) {
        cosa = await guardarPasada(env, cuerpo, de);
        if (Math.random() < 0.02 && ctx && ctx.waitUntil) ctx.waitUntil(limpiarLoViejo(env.DB).catch(() => {}));
      } else if (donde === 'pasadas' && metodo === 'GET' && partes.length === 2) cosa = await traerPasada(env, partes[1]);
      else if (donde === 'clubes' && metodo === 'POST' && partes.length === 1) cosa = await crearClub(env, cuerpo, de);
      else if (donde === 'clubes' && metodo === 'GET' && partes.length === 2) cosa = await clubDe(env.DB, partes[1]);
      else if (donde === 'clubes' && metodo === 'POST' && partes.length === 3 && partes[2] === 'entrar') cosa = await entrarAlClub(env, partes[1], cuerpo, de);
      else if (donde === 'clubes' && metodo === 'POST' && partes.length === 3 && partes[2] === 'salir') cosa = await salirDelClub(env, partes[1], cuerpo);
      else if (donde === 'tablas' && metodo === 'POST' && partes.length === 1) cosa = await tablas(env, cuerpo);
      else falla(404, 'Eso no existe.');
      return contestar(200, cosa);
    } catch (e) {
      if (e instanceof Aviso) return contestar(e.estado, { error: e.message });
      console.error(e);
      return contestar(500, { error: 'Algo falló en el servidor.' });
    }
  },
};

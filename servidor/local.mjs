// El servidor, en la compu: para probarlo sin Cloudflare. Guarda todo en la memoria (o en un archivo, si se le da uno).
//   node servidor/local.mjs            escucha en http://127.0.0.1:8787
//   node servidor/local.mjs 9000 datos.db
// Para que el juego lo use, abrirlo con ?servidor=http://127.0.0.1:8787 (solo funciona desde una copia local del juego).
// Es el mismo programa que corre en Cloudflare (worker.js); aca la base de datos D1 se imita con el SQLite de Node.
import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import servidor from './worker.js';

// Una base que se usa igual que D1: prepare(sql).bind(...).first() / .all() / .run(), y batch([...]).
export function baseLocal(archivo = ':memory:') {
  const db = new DatabaseSync(archivo);
  const lee = (sql) => /^\s*(select|with)\b/i.test(sql) || /\breturning\b/i.test(sql);
  const pedido = (sql, datos = []) => ({
    bind: (...d) => pedido(sql, d),
    first: async () => { const fila = db.prepare(sql).get(...datos); return fila === undefined ? null : { ...fila }; },
    all: async () => ({ success: true, results: db.prepare(sql).all(...datos).map((f) => ({ ...f })) }),
    run: async () => { const r = db.prepare(sql).run(...datos); return { success: true, meta: { changes: Number(r.changes) } }; },
    ya: () => (lee(sql) ? { success: true, results: db.prepare(sql).all(...datos).map((f) => ({ ...f })) } : (db.prepare(sql).run(...datos), { success: true, results: [] })),
  });
  // (una tanda, igual que en D1, se cumple entera o no se cumple)
  const tanda = async (lista) => {
    db.exec('BEGIN');
    try { const r = lista.map((p) => p.ya()); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; }
  };
  return { prepare: (sql) => pedido(sql), batch: tanda, exec: async (sql) => db.exec(sql), cerrar: () => db.close() };
}

// Atiende un pedido de Node con el programa del servidor.
export function atender(env) {
  return async (req, res) => {
    const trozos = [];
    for await (const t of req) trozos.push(t);
    const cuerpo = Buffer.concat(trozos);
    const r = await servidor.fetch(new Request('http://' + (req.headers.host || 'local') + req.url, { method: req.method, headers: req.headers, body: req.method === 'GET' || req.method === 'HEAD' ? undefined : cuerpo }), env, { waitUntil: (p) => p.catch(() => {}) });
    res.writeHead(r.status, Object.fromEntries(r.headers));
    res.end(Buffer.from(await r.arrayBuffer()));
  };
}

if (process.argv[1] && process.argv[1].endsWith('local.mjs')) {
  const puerto = Number(process.argv[2] || 8787), env = { DB: baseLocal(process.argv[3] || ':memory:') };
  http.createServer(atender(env)).listen(puerto, '127.0.0.1', () => console.log('Servidor de Shakedown de prueba en http://127.0.0.1:' + puerto));
}

// La nube: lo que el juego le pide al servidor (servidor/worker.js). Guardar una pasada para que el link sea corto,
// traer la de un amigo, y los clubes con sus tablas.
// Todo es "si se puede": sin servidor configurado, sin señal o con el servidor caido, cada pedido devuelve null
// y el juego sigue como siempre, con el link largo y la tabla armada con los links que se abren.
//
// base: la direccion del servidor ('' = no hay). Devuelve:
//   hay                    true si hay servidor configurado
//   conLlave(f)            f() devuelve la llave de este aparato (ver club.js): va en todo lo que se escribe
//   subir(codigo, espera)  guarda una pasada. Promesa de: el codigo corto; '' si el servidor no la quiso; null si no se pudo (se puede reintentar)
//   pasada(id)             trae una pasada por su codigo corto. Promesa de { codigo, j } o null
//   crearClub(nombre, apodo), entrar(codigo, apodo), salir(codigo), verClub(codigo)    promesa de lo que conteste el servidor, { error } o null
//   tablas(pista, version, codigos)    promesa de { codigo: { nombre, miembros, soy, tabla, faltan } o null (el club ya no existe) } o null
export function crearNube(base) {
  base = String(base || '').replace(/\/+$/, '');
  let llave = () => '';
  const subidas = new Map(), traidas = new Map();

  // Un pedido. Devuelve lo que contesto el servidor; { error, estado } si dijo que no; null si no se pudo llegar.
  async function pedir(metodo, ruta, cuerpo, ms = 8000) {
    if (!base) return null;
    const corte = new AbortController(), reloj = setTimeout(() => corte.abort(), ms);
    try {
      // (el cuerpo va como texto comun: asi el navegador no hace una consulta previa antes de cada pedido)
      const r = await fetch(base + ruta, { method: metodo, body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo), headers: cuerpo === undefined ? undefined : { 'content-type': 'text/plain' }, signal: corte.signal, cache: 'no-store' });
      const cosa = await r.json().catch(() => null);
      return r.ok && cosa ? cosa : { error: (cosa && cosa.error) || 'El servidor no pudo.', estado: r.status };
    } catch (e) { return null; } finally { clearTimeout(reloj); }
  }
  const tarda = (promesa, ms, siNo) => Promise.race([promesa, new Promise((sigue) => setTimeout(() => sigue(siNo), ms))]);

  return {
    hay: !!base,
    conLlave: (f) => { llave = f; },
    // Guarda una pasada (su codigo: el texto del link largo). La misma pasada no se sube dos veces.
    // espera: cuanto se aguanta la respuesta ACA (el pedido sigue igual: si llega tarde, la proxima vez ya esta).
    subir: (codigo, espera = 8000) => {
      if (!base || typeof codigo !== 'string' || codigo[0] !== 'd') return Promise.resolve(null);
      if (!subidas.has(codigo)) {
        subidas.set(codigo, pedir('POST', '/pasadas', { llave: llave(), codigo }).then((r) => {
          if (r && r.id) return r.id;
          if (r && r.estado >= 400 && r.estado < 500 && r.estado !== 429) return '';   // no la quiere: no tiene sentido insistir
          subidas.delete(codigo);                                                     // no se pudo: se puede volver a probar
          return null;
        }));
      }
      return tarda(subidas.get(codigo), espera, null);
    },
    pasada: async (id) => {
      if (!base || !/^[0-9A-Za-z]{6,12}$/.test(id || '')) return null;
      if (!traidas.has(id)) { const r = await pedir('GET', '/pasadas/' + id); if (r && r.codigo) traidas.set(id, { codigo: r.codigo, j: r.j || '' }); else return null; }
      return traidas.get(id);
    },
    crearClub: (nombre, apodo) => pedir('POST', '/clubes', { llave: llave(), nombre, apodo }),
    entrar: (codigo, apodo) => pedir('POST', '/clubes/' + codigo + '/entrar', { llave: llave(), apodo }),
    salir: (codigo) => pedir('POST', '/clubes/' + codigo + '/salir', { llave: llave() }),
    verClub: (codigo) => pedir('GET', '/clubes/' + codigo),
    tablas: async (pista, version, codigos) => {
      if (!base || !codigos.length) return null;
      const r = await pedir('POST', '/tablas', { llave: llave(), pista, version, clubes: codigos });
      return r && r.clubes ? r.clubes : null;
    },
  };
}

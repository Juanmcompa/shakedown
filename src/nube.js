// La nube: lo que el juego le pide al servidor (servidor/worker.js). Guardar una pasada para que el link sea corto,
// traer la de un amigo, los clubes con sus tablas y las pistas de la comunidad.
// Todo es "si se puede": sin servidor configurado, sin señal o con el servidor caido, cada pedido devuelve null
// y el juego sigue como siempre, con el link largo y la tabla armada con los links que se abren.
//
// base: la direccion del servidor ('' = no hay). Devuelve:
//   hay                    true si hay servidor configurado
//   conLlave(f)            f() devuelve la llave de este aparato (ver club.js): va en todo lo que se escribe
//   subir(codigo, espera)  guarda una pasada. Promesa de: el codigo corto; '' si el servidor no la quiso (o es de un formato
//                          viejo, que no se sube); null si no se pudo (sin servidor o sin señal: se puede reintentar)
//   pasada(id)             trae una pasada por su codigo corto. Promesa de { codigo, j } o null
//   crearClub(nombre, apodo), entrar(codigo, apodo), salir(codigo), verClub(codigo)    promesa de lo que conteste el servidor, { error } o null
//   tablas(pista, version, codigos)    promesa de { codigo: { nombre, miembros, soy, tabla, faltan, pistas } o null (el club ya no existe) } o null
//   travesia(nombre, km, auto)   manda el record de km de la Travesia. Promesa de { km, nuevo }, { error, estado } o null
//   travesias(codigos)     los records de la Travesia de cada club: promesa de { codigo: { nombre, tabla: [{ j, nombre, km, auto, mio }] } o null } o null
//   crearPista(nombre, apodo, club, hoja)   publica una pista armada en el creador. Promesa de { numero, version, nombre, autor, club, vence },
//                          { error, estado } o null
//   borrarPista(numero)    borra una pista de la comunidad (solo la puede borrar quien la armo). Promesa de { borrada }, { error, estado } o null
//   pista(numero)          trae una pista de la comunidad: { numero, version, nombre, autor, club, clubNombre, hoja, vence, tabla }
//                          (en la tabla, lo propio va marcado con "mio"); { error, estado } si no existe (404) o ya vencio (410); o null
export function crearNube(base) {
  base = String(base || '').replace(/\/+$/, '');
  let llave = () => '';
  const subidas = new Map(), traidas = new Map();

  // Un pedido. Devuelve lo que contesto el servidor; { error, estado } si dijo que no; null si no se pudo llegar.
  // sigue: que el pedido siga aunque se cierre la pagina (al subir una pasada: si se cierra el juego apenas termina la
  // pasada, igual llega; ver "keepalive" en fetch).
  async function pedir(metodo, ruta, cuerpo, ms = 8000, sigue = false) {
    if (!base) return null;
    // Si tarda mas de "ms", se corta. Pero si el aparato estuvo trabado (armando la pista, dibujando el primer cuadro)
    // el reloj puede sonar con la respuesta ya llegada y esperando su turno: en ese caso se le da un momento mas.
    const corte = new AbortController(), t0 = performance.now();
    let reloj = 0, yapa = false;
    const cortar = () => { if (!yapa && performance.now() - t0 > ms + 1500) { yapa = true; reloj = setTimeout(cortar, 1500); } else corte.abort(); };
    reloj = setTimeout(cortar, ms);
    try {
      // (el cuerpo va como texto comun: asi el navegador no hace una consulta previa antes de cada pedido)
      const r = await fetch(base + ruta, { method: metodo, body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo), headers: cuerpo === undefined ? undefined : { 'content-type': 'text/plain' }, signal: corte.signal, cache: 'no-store', keepalive: sigue });
      const cosa = await r.json().catch(() => null);
      if (!cosa && corte.signal.aborted) return null;   // (se corto mientras llegaba la respuesta: es "no se pudo llegar")
      return r.ok && cosa ? cosa : { error: (cosa && cosa.error) || 'El servidor no pudo.', estado: r.status };
    } catch (e) { return null; } finally { clearTimeout(reloj); }
  }
  const tarda = (promesa, ms, siNo) => Promise.race([promesa, new Promise((sigue) => setTimeout(() => sigue(siNo), ms))]);
  // El numero de corredor de este aparato: la misma huella de la llave que guarda el servidor (ver "huella" en worker.js).
  // Sirve para reconocer lo propio en una tabla que se pide sin llave.
  let yo = null;
  async function miNumero() {
    const l = llave();
    if (!l) return '';
    if (!yo || yo.l !== l) {
      try {
        const b = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(l)));
        let s = '';
        for (let i = 0; i < 12; i++) s += String.fromCharCode(b[i]);
        yo = { l, j: btoa(s).replace(/\+/g, '-').replace(/\//g, '_') };
      } catch (e) { return ''; }   // (sin "crypto.subtle", en una pagina sin https: lo propio no se marca)
    }
    return yo.j;
  }

  return {
    hay: !!base,
    conLlave: (f) => { llave = f; },
    // Guarda una pasada (su codigo: el texto del link largo). La misma pasada no se sube dos veces.
    // espera: cuanto se aguanta la respuesta ACA (el pedido sigue igual: si llega tarde, la proxima vez ya esta).
    subir: (codigo, espera = 8000) => {
      if (!base) return Promise.resolve(null);
      if (typeof codigo !== 'string' || codigo[0] !== 'd') return Promise.resolve('');   // (formato viejo: el servidor no lo lee)
      if (!subidas.has(codigo)) {
        subidas.set(codigo, pedir('POST', '/pasadas', { llave: llave(), codigo }, 8000, true).then((r) => {
          if (r && r.id) return r.id;
          // no la quiere: no tiene sentido insistir (salvo que sea por ahora: muchos pedidos, o un reloj adelantado)
          if (r && r.estado >= 400 && r.estado < 500 && r.estado !== 429 && r.estado !== 425) return '';
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
    travesia: (nombre, km, auto) => pedir('POST', '/travesia', { llave: llave(), nombre, km, auto }),
    travesias: async (codigos) => {
      if (!base || !codigos.length) return null;
      const r = await pedir('POST', '/travesias', { llave: llave(), clubes: codigos });
      return r && r.clubes ? r.clubes : null;
    },
    crearPista: (nombre, apodo, club, hoja) => pedir('POST', '/pistas', { llave: llave(), nombre, apodo, club: club || '', hoja }, 12000),
    borrarPista: (numero) => pedir('POST', '/pistas/' + numero + '/borrar', { llave: llave() }),
    pista: async (numero) => {
      if (!base || !/^\d{5}$/.test(String(numero))) return null;
      const r = await pedir('GET', '/pistas/' + numero);
      if (r && Array.isArray(r.tabla)) { const j = await miNumero(); if (j) for (const x of r.tabla) if (x.j === j) x.mio = true; }
      return r;
    },
  };
}

// El club: lo que se guarda en este aparato. Tu nombre, tu auto, tu pasada oficial de cada dia, tu mejor practica,
// los resultados de tus amigos y en que clubes estas.
// Sin servidor, la tabla se arma con los links que abris. Con servidor (ver nube.js) se suma lo que corre la gente
// de tus clubes; queda guardado aca tambien, asi la tabla se ve aunque despues no haya señal.
//
// Un resultado es: { nombre, t (segundos), s: [segundos por sector], c: 'vvarv' (colores), auto, ab ('' o por que abandono),
//                    vueltas, roto, practica, ayuda, codigo (el texto del link largo, con el fantasma),
//                    id (el codigo corto con el que esta guardado en el servidor) }
// Los de los demas llevan ademas: j (su numero de corredor en el servidor), de: [los clubes tuyos en los que figura]
// y link: true si llego por un link que abriste.
import { limpio } from './fantasma.js';

const CLAVE = 'shakedown';
const GUARDA_FANTASMAS = 21;   // dias: de las pistas mas viejas se guardan los tiempos, pero no los fantasmas
const GUARDA_AMIGOS = 60;      // dias: despues, de cada pista quedan solo los tiempos propios
const GUARDA_DEL_CLUB = 14;    // dias: lo que se sabe solo por un club se guarda menos (al abrir esa pista se le pide de nuevo al servidor)
const CABEN = 80;              // de lo que llego por link, cuantos tiempos se guardan por pista (y otros tantos de practica)
const RECIENTES = 7;           // dias: los tiempos propios de estos dias se suben al servidor si todavia no estan

// una llave al azar para este aparato: 22 letras que no se muestran nunca (ver "llave", mas abajo)
function llaveNueva() {
  const b = new Uint8Array(16);
  try { crypto.getRandomValues(b); } catch (e) { for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256); }
  let s = '';
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// versionDe(numero): la version de cada pista (ver generador.js; los circuitos fijos tienen cada uno la suya).
// Lo guardado con otra version se descarta: era otro camino.
export function crearClub(pista, hoy, versionDe = () => 1) {
  let datos = { nombre: '', auto: 'vitarita', dias: {} };
  try { datos = Object.assign(datos, JSON.parse(localStorage.getItem(CLAVE) || '{}')); } catch (e) { /* sin memoria: se pierde al cerrar */ }
  const guardar = () => { try { localStorage.setItem(CLAVE, JSON.stringify(datos)); } catch (e) { /* idem */ } };
  for (const n in datos.dias) if ((datos.dias[n].v || 1) !== versionDe(Number(n))) delete datos.dias[n];
  const dia = (n) => datos.dias[n] || (datos.dias[n] = { oficial: null, practica: null, club: [], rival: '', v: versionDe(Number(n)) });
  const D = dia(pista);
  // si quedo una pasada oficial empezada y sin terminar (se cerro el juego en el medio), es un abandono
  for (const n in datos.dias) {
    const d = datos.dias[n], o = d.oficial;
    if (o && o.corriendo) d.oficial = { nombre: datos.nombre, t: 0, s: [], c: 'nnnnn', auto: o.auto, ab: 'cerrado', vueltas: 0, roto: 0 };
    if (Number(n) < hoy - GUARDA_FANTASMAS) for (const r of [d.oficial, d.practica, ...d.club]) if (r) delete r.codigo;
    if (Number(n) < hoy - GUARDA_AMIGOS) d.club = [];
    else if (Number(n) < hoy - GUARDA_DEL_CLUB) d.club = d.club.filter((x) => !x.j || x.link);
  }
  guardar();
  const mejor = (a, b) => (!!a.ab - !!b.ab) || a.t - b.t;   // primero los que llegaron, del mas rapido al mas lento
  const propios = (d) => [d.oficial, d.practica].filter((x) => x && !x.corriendo);
  const esElMismo = (x, r) => x.t === r.t && !!x.practica === !!r.practica;
  // alguien de la tabla: se lo busca por su numero de corredor; si de un lado no se lo conoce, por el nombre
  const buscar = (d, r) => {
    const p = !!r.practica;
    return (r.j && d.club.find((x) => x.j === r.j && !!x.practica === p)) || d.club.find((x) => x.nombre === r.nombre && !!x.practica === p && (!r.j || !x.j)) || null;
  };
  // lo que se queda en la tabla: lo que llego por link, y lo que figura en algun club en el que sigo estando
  const seQueda = (x) => !x.j || x.link || (x.de && x.de.length > 0);
  const deEse = (deClub) => (r) => !deClub || (r.de && r.de.includes(deClub));
  // Ordena la tabla y la recorta: de lo que llego solo por link quedan los mejores de cada clase (oficiales y practicas);
  // lo de los clubes queda todo (el servidor ya limita cuanta gente entra en un club).
  const recortar = (lista) => {
    let oficiales = 0, practicas = 0;
    return lista.sort(mejor).filter((x) => (x.de && x.de.length > 0) || (x.practica ? ++practicas : ++oficiales) <= CABEN);
  };

  return {
    pista,
    nombre: () => datos.nombre,
    ponerNombre: (n) => { datos.nombre = limpio(n); if (D.oficial && !D.oficial.corriendo) D.oficial.nombre = datos.nombre; guardar(); },
    // gustos sueltos (sonido, voz del copiloto): gusto('voz') lo lee, gusto('voz', false) lo cambia
    gusto: (clave, valor) => { if (valor !== undefined) { (datos.gustos || (datos.gustos = {}))[clave] = valor; guardar(); } return datos.gustos ? datos.gustos[clave] : undefined; },
    // Si en este aparato nunca se corrio nada ni se vio el tutorial: es la primera vez de alguien.
    esNuevo: () => !(datos.gustos && datos.gustos.tutorial) && !Object.values(datos.dias).some((d) => d.oficial || d.practica),
    auto: () => datos.auto,
    ponerAuto: (a) => { datos.auto = a; guardar(); },
    // --- la pasada oficial: una sola por dia ---
    oficial: () => D.oficial,
    sePuedeOficial: () => pista === hoy && !D.oficial,
    empezarOficial: (auto) => { D.oficial = { corriendo: true, auto }; guardar(); },
    cerrarOficial: (r) => { D.oficial = { ...r, nombre: datos.nombre }; guardar(); },
    // --- practica: queda la mejor ---
    practica: () => D.practica,
    anotarPractica: (r) => { if (r.ab || (D.practica && D.practica.t <= r.t)) return false; D.practica = { ...r, nombre: datos.nombre, practica: true }; guardar(); return true; },
    // le agrega el codigo del link (con el fantasma) a un resultado propio, cuando termina de armarse
    ponerCodigo: (r, codigo) => { for (const x of propios(D)) if (esElMismo(x, r)) x.codigo = codigo; guardar(); },

    // --- el servidor (ver nube.js) ---
    // La llave de este aparato: se inventa la primera vez que hace falta y no se muestra nunca. Es lo que le dice al
    // servidor "soy el mismo de antes" cuando se sube un tiempo o se entra a un club (no hay cuentas ni contraseñas).
    llave: () => { if (!datos.llave) { datos.llave = llaveNueva(); guardar(); } return datos.llave; },
    // Anota con que codigo corto quedo guardado en el servidor un resultado propio ('' = el servidor no lo quiso: no se insiste).
    ponerId: (r, id, numero = pista) => {
      const d = datos.dias[numero];
      if (!d) return;
      for (const x of propios(d)) if (esElMismo(x, r)) { if (id) { x.id = id; delete x.noSube; } else x.noSube = true; }
      guardar();
    },
    // Los resultados propios que todavia no estan en el servidor: los de estos dias y los de los circuitos. [{ numero, r }]
    sinSubir: () => {
      const lista = [];
      for (const n in datos.dias) {
        const numero = Number(n);
        if (numero > hoy - RECIENTES) for (const r of propios(datos.dias[n])) if (r.codigo && !r.id && !r.noSube) lista.push({ numero, r: { ...r } });
      }
      return lista;
    },
    // Los clubes en los que esta este aparato: [{ codigo, nombre }]
    clubes: () => (datos.clubes || []).map((c) => ({ ...c })),
    ponerClub: (c) => {
      const lista = datos.clubes || (datos.clubes = []), ya = lista.find((x) => x.codigo === c.codigo);
      if (ya) ya.nombre = c.nombre; else lista.push({ codigo: c.codigo, nombre: c.nombre });
      guardar();
    },
    // al salir de un club, de las tablas se va la gente que solo se conocia por ese club
    sacarClub: (codigo) => {
      datos.clubes = (datos.clubes || []).filter((x) => x.codigo !== codigo);
      for (const n in datos.dias) {
        const d = datos.dias[n];
        for (const r of d.club) if (r.de) r.de = r.de.filter((c) => c !== codigo);
        d.club = d.club.filter(seQueda);
      }
      guardar();
    },
    // La tabla de un club en una pista, como la manda el servidor: se mezcla con lo que ya habia.
    // (Si de alguien ya se tenia el fantasma de esa misma pasada, se conserva.)
    anotarDelClub: (codigo, tabla, numero = pista) => {
      const d = dia(numero);
      for (const x of d.club) if (x.de) x.de = x.de.filter((c) => c !== codigo);
      for (const r of tabla) {
        if (r.mio || !r.j) continue;   // (lo propio ya esta aca)
        let v = buscar(d, r);
        if (!v) { v = { s: [], vueltas: 0, roto: 0 }; d.club.push(v); }
        if (!(v.t !== undefined && Math.abs(v.t - r.t) < 0.02 && !!v.ab === !!r.ab)) { delete v.codigo; v.s = []; }   // es otra pasada: aquel fantasma ya no vale
        Object.assign(v, { nombre: r.nombre, t: r.t, c: r.c, auto: r.auto, ab: r.ab || '', ayuda: !!r.ayuda, practica: !!r.practica, j: r.j, id: r.id });
        v.de = [...new Set([...(v.de || []), codigo])];
      }
      d.club = recortar(d.club.filter(seQueda));
      guardar();
    },
    // le agrega el fantasma (el codigo largo) a alguien de la tabla, cuando se lo baja del servidor
    ponerCodigoDe: (r, codigo, numero = pista) => {
      const v = buscar(dia(numero), r);
      if (v && Math.abs(v.t - r.t) < 0.02) { v.codigo = codigo; guardar(); }
    },

    // --- amigos: lo que llega por link. De cada uno queda su oficial y, aparte, su mejor practica ---
    // (r.j: su numero de corredor, si el link era corto y lo trajo el servidor)
    anotarAmigo: (r, numero = pista) => {
      if (!r.nombre || (r.nombre === datos.nombre && !r.practica && numero === pista && D.oficial && Math.abs(D.oficial.t - r.t) < 0.02)) return;   // es mi propio link
      const d = dia(numero), viejo = buscar(d, r);
      // Lo que se sabe por un club viene del servidor: un tiempo suelto (de los que un link trae de yapa) no lo pisa.
      if (viejo && !r.j && !r.codigo && viejo.j && viejo.de && viejo.de.length) return;
      let nuevo = { ...r, link: true };
      if (viejo) {
        if (r.practica && viejo.t <= r.t && !r.ab) { if (r.codigo && !viejo.codigo) viejo.codigo = r.codigo; viejo.link = true; guardar(); return; }
        if (!r.codigo && viejo.codigo && Math.abs(viejo.t - r.t) < 0.02) { viejo.link = true; guardar(); return; }   // ya lo tenia, y con fantasma
        d.club.splice(d.club.indexOf(viejo), 1);
        // (si ya se lo conocia por un club, sigue figurando ahi)
        nuevo = { ...nuevo, j: r.j || viejo.j, de: viejo.de, id: r.id || (Math.abs(viejo.t - r.t) < 0.02 ? viejo.id : undefined) };
      }
      d.club.push(nuevo);
      d.club = recortar(d.club);
      guardar();
    },
    // la tabla de la pista: los oficiales (el propio marcado con "mio"), ordenados; despues las practicas.
    // deClub: el codigo de un club, para ver solo a su gente (si no, todos los que se conocen).
    tabla: (deClub) => {
      const lista = D.club.filter((r) => !r.practica).filter(deEse(deClub)).map((r) => ({ ...r }));
      if (D.oficial && !D.oficial.corriendo) lista.push({ ...D.oficial, mio: true });
      return lista.sort(mejor);
    },
    practicas: (deClub) => {
      const lista = D.club.filter((r) => r.practica).filter(deEse(deClub)).map((r) => ({ ...r }));
      if (D.practica) lista.push({ ...D.practica, mio: true });
      return lista.sort(mejor);
    },
    // --- contra quien se corre: alguien de la tabla (ver "claveDe" en main.js), '*' = contra mi propia pasada, '' = solo ---
    rival: () => D.rival,
    elegirRival: (clave) => { D.rival = clave; guardar(); },
    // --- las pistas ya corridas, para la lista de pasadas ---
    resumen: (n) => { const d = datos.dias[n]; return d ? { oficial: d.oficial && !d.oficial.corriendo ? d.oficial : null, practica: d.practica, amigos: d.club.filter((r) => !r.practica).length } : { oficial: null, practica: null, amigos: 0 }; },
  };
}

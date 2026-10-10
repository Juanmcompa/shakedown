// El club: lo que se guarda en este aparato. Tu nombre, tu auto, tu pasada oficial de cada dia,
// tu mejor practica y los resultados de tus amigos que fueron llegando por link.
// No hay servidor: la "tabla del club" se arma con los links que abris.
//
// Un resultado es: { nombre, t (segundos), s: [segundos por sector], c: 'vvarv' (colores), auto, ab ('' o por que abandono),
//                    vueltas, roto, practica, codigo (el texto del link, con el fantasma) }
const CLAVE = 'shakedown';
const GUARDA_FANTASMAS = 21;   // dias: de las pistas mas viejas se guardan los tiempos, pero no los fantasmas

export function crearClub(pista, hoy) {
  let datos = { nombre: '', auto: 'vitarita', dias: {} };
  try { datos = Object.assign(datos, JSON.parse(localStorage.getItem(CLAVE) || '{}')); } catch (e) { /* sin memoria: se pierde al cerrar */ }
  const guardar = () => { try { localStorage.setItem(CLAVE, JSON.stringify(datos)); } catch (e) { /* idem */ } };
  const dia = (n) => datos.dias[n] || (datos.dias[n] = { oficial: null, practica: null, club: [], rival: '' });
  const D = dia(pista);
  // si quedo una pasada oficial empezada y sin terminar (se cerro el juego en el medio), es un abandono
  for (const n in datos.dias) {
    const o = datos.dias[n].oficial;
    if (o && o.corriendo) datos.dias[n].oficial = { nombre: datos.nombre, t: 0, s: [], c: 'nnnnn', auto: o.auto, ab: 'cerrado', vueltas: 0, roto: 0 };
    if (Number(n) < hoy - GUARDA_FANTASMAS) for (const r of [datos.dias[n].oficial, datos.dias[n].practica, ...datos.dias[n].club]) if (r) delete r.codigo;
  }
  guardar();
  const mejor = (a, b) => (!!a.ab - !!b.ab) || a.t - b.t;   // primero los que llegaron, del mas rapido al mas lento

  return {
    pista,
    nombre: () => datos.nombre,
    ponerNombre: (n) => { datos.nombre = String(n).replace(/[<>]/g, '').trim().slice(0, 14); if (D.oficial && !D.oficial.corriendo) D.oficial.nombre = datos.nombre; guardar(); },
    // gustos sueltos (sonido, voz del copiloto): gusto('voz') lo lee, gusto('voz', false) lo cambia
    gusto: (clave, valor) => { if (valor !== undefined) { (datos.gustos || (datos.gustos = {}))[clave] = valor; guardar(); } return datos.gustos ? datos.gustos[clave] : undefined; },
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
    ponerCodigo: (r, codigo) => { for (const x of [D.oficial, D.practica]) if (x && x.t === r.t && !!x.practica === !!r.practica) x.codigo = codigo; guardar(); },
    // --- amigos: lo que llega por link. De cada uno queda su oficial y, aparte, su mejor practica ---
    anotarAmigo: (r, numero = pista) => {
      if (!r.nombre || (r.nombre === datos.nombre && !r.practica && numero === pista && D.oficial && Math.abs(D.oficial.t - r.t) < 0.02)) return;   // es mi propio link
      const d = dia(numero), viejo = d.club.find((x) => x.nombre === r.nombre && !!x.practica === !!r.practica);
      if (viejo) {
        if (r.practica && viejo.t <= r.t && !r.ab) { if (r.codigo && !viejo.codigo) viejo.codigo = r.codigo; guardar(); return; }
        if (!r.codigo && viejo.codigo && Math.abs(viejo.t - r.t) < 0.02) return;   // ya lo tenia, y con fantasma
        d.club.splice(d.club.indexOf(viejo), 1);
      }
      d.club.push(r);
      d.club = d.club.sort(mejor).slice(0, 30);
      guardar();
    },
    // la tabla de la pista: los oficiales (el propio marcado con "mio"), ordenados; despues las practicas
    tabla: () => {
      const lista = D.club.filter((r) => !r.practica).map((r) => ({ ...r }));
      if (D.oficial && !D.oficial.corriendo) lista.push({ ...D.oficial, mio: true });
      return lista.sort(mejor);
    },
    practicas: () => {
      const lista = D.club.filter((r) => r.practica).map((r) => ({ ...r }));
      if (D.practica) lista.push({ ...D.practica, mio: true });
      return lista.sort(mejor);
    },
    // --- contra quien se corre: el nombre de alguien de la tabla, '*' = contra mi propia pasada, '' = solo ---
    rival: () => D.rival,
    elegirRival: (clave) => { D.rival = clave; guardar(); },
    // --- las pistas ya corridas, para la lista de pasadas ---
    resumen: (n) => { const d = datos.dias[n]; return d ? { oficial: d.oficial && !d.oficial.corriendo ? d.oficial : null, practica: d.practica, amigos: d.club.filter((r) => !r.practica).length } : { oficial: null, practica: null, amigos: 0 }; },
  };
}

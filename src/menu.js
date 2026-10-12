// Las pantallas que no son manejar: la portada con la pista del dia (o con un circuito fijo, o una pista de la comunidad),
// la tabla del club, los circuitos y las pistas de la comunidad, las pistas pasadas, la ayuda, la configuracion y el
// resultado de cada pasada con su boton de compartir.
import { AUTOS, FIRMA } from './config.js';
import { BIOMAS, CLIMAS, CARACTER, datosDelDia } from './generador.js';
import { CIRCUITOS, circuitoDe } from './circuitos.js';
import { fechaDe } from './dia.js';
import { tiempoFinal, CLASE_DE_COLOR } from './hud.js';
import { iconoDeNota, textoDeNota, ponerIconos, rotular, icono } from './iconos.js';
import { EQUIPO, retrato } from './equipo.js';

const $ = (id) => document.getElementById(id);
const CUADRO = { v: '🟩', a: '🟨', r: '🟥', n: '⬛' };
const ABANDONO = { roto: 'Rompiste el auto', tiempo: 'Se acabó el tiempo', cerrado: 'Cerraste el juego en plena pasada' };
const crear = (etiqueta, clase, texto) => { const el = document.createElement(etiqueta); if (clase) el.className = clase; if (texto !== undefined) el.textContent = texto; return el; };

// El mensaje para compartir: Shakedown #42 🌧️🌲 ⏱️ 01:42:85 🟩 🟩 🟨 🟥 🟩 🏁
// (el de un circuito fijo lleva su nombre en vez del numero: Shakedown · Subida ⛰️ ⏱️ 01:42:85 ...; el de una pista de la
// comunidad, su nombre y el anotador: Shakedown · La Curva del Tero 📝 ⏱️ ...; quien la armo no va: solo en la portada)
export const EMOJI_COMUNIDAD = '📝';
export function mensaje(etapa, r) {
  const cuadros = [...(r.c || 'nnnnn')].map((x) => CUADRO[x]).join(' '), fijo = circuitoDe(etapa.numero);
  return (fijo ? 'Shakedown · ' + fijo.corto + ' ' + fijo.emoji : etapa.comunidad ? 'Shakedown · ' + etapa.nombre + ' ' + EMOJI_COMUNIDAD
    : 'Shakedown #' + etapa.numero + ' ' + CLIMAS[etapa.clima].emoji + BIOMAS[etapa.bioma].emoji + (r.practica ? ' 🔧 práctica' : ''))
    + (r.ab ? ' 💥 abandono ' + cuadros : ' ⏱️ ' + tiempoFinal(r.t) + ' ' + cuadros + ' 🏁');
}
// El renglon que cierra todo lo que se comparte (el resultado y la invitacion a un club), debajo del link:
//   🚧 Early Access · App en desarrollo
// (Sale de FIRMA, en config.js. El dia que el juego deje de estar en desarrollo no queda nada: el mensaje vuelve a tener
// dos renglones. Quien hace el juego no va aca: se ve solo en la portada.)
export const enDesarrollo = () => [FIRMA.etapa, FIRMA.aviso].filter(Boolean).join(' · ').replace(/^(.)/, '🚧 $1');
const conAviso = (texto) => texto + (enDesarrollo() ? '\n' + enDesarrollo() : '');
// los cuadraditos de un resultado, como elementos de la pagina
function cuadritos(colores) {
  const caja = crear('span', 'cuadros');
  for (const x of colores || 'nnnnn') caja.append(crear('i', CLASE_DE_COLOR[x]));
  return caja;
}

// cuanto le queda a una pista de la comunidad (vence: en segundos)
export const quedan = (vence) => { const d = Math.ceil((vence - Date.now() / 1000) / 86400); return d <= 1 ? 'vence hoy' : 'quedan ' + d + ' días'; };

// o: { T, club, hoy, ref, copiloto, elegirAuto(id), rival(),
//      comunidad                     null, o la pista de la comunidad que se corre: { nombre, autor, club, clubNombre, vence }
//                                    (o { borrador: true, nombre, club } si es el borrador del creador)
//      armar(codigo)                 abre el creador de pistas (codigo: el club para el que se arma)
//      linkDeLaPista()               el link de esta pista (para compartir una de la comunidad)
//      borrarPista(numero)           borra una pista propia: promesa de { borrada } o { error }
//      claveDe(r)                    como se nombra a alguien de la tabla para elegirlo de rival
//      elegirRival(clave, practica)  promesa de false si no se pudo traer su fantasma del servidor
//      acortar(r, codigo)            promesa de lo que va en el link: el codigo corto del servidor, o la pasada entera
//      clubes: null si el juego no tiene servidor; si no { fundar(nombre), dejar(codigo), de(codigo), refrescar() }
//      ajustes: { leer(clave), poner(clave, valor), probar() }   la configuracion (ver GUSTOS en config.js) }
export function crearMenu(o) {
  const { T, club, hoy, ref, copiloto, ajustes, comunidad } = o, etapa = T.etapa, numero = etapa.numero, esHoy = numero === hoy;
  const fijo = circuitoDe(numero);   // si lo que se corre es un circuito fijo, cual
  // En lo libre (un circuito o una pista de la comunidad) no hay oficial: se corre las veces que se quiera y queda el mejor
  // tiempo. El borrador es libre tambien, pero no se comparte (todavia no existe para los demas).
  const libre = !!fijo || !!comunidad, borrador = !!(comunidad && comunidad.borrador);
  // el salvavidas que marca un tiempo hecho con la ayuda de manejo
  const conAyuda = () => { const img = crear('img', 'icono con-ayuda'); img.src = icono('salvavidas'); img.alt = 'con ayuda de manejo'; img.title = 'Con ayuda de manejo'; return img; };
  let ultimo = null, linkDe = null;   // el ultimo resultado mostrado, y la funcion que arma su link
  // la tabla: de quien se ven los tiempos ('' = todos los que se conocen; si no, el codigo de un club), si esta abierto
  // el formulario para armar un club, y lo ultimo que hay para avisar ahi
  let vista = '', armando = false, aviso = '', saliendo = 0;

  // --- la portada ---
  $('inicio').href = location.pathname;
  // quien hace el juego: debajo de la marca, solo en la portada
  $('firmaAutor').textContent = FIRMA.autor;
  $('firma').hidden = !FIRMA.autor;
  // (de una pista de la comunidad: quien la armo, cuanto le queda y de que club es. Quien la armo va solo aca, en la portada:
  // ni al largar ni en lo que se comparte)
  $('pistaNumero').textContent = fijo ? fijo.emoji : comunidad ? EMOJI_COMUNIDAD : '#' + numero;
  $('pistaFecha').textContent = fijo ? 'Circuito' : borrador ? 'Borrador' : comunidad ? 'Hecha por ' + (comunidad.autor || '?') : fechaDe(numero);
  $('pistaLugar').textContent = comunidad ? (borrador ? '' : quedan(comunidad.vence)) : etapa.lugar;
  $('pistaNombre').textContent = etapa.nombre;
  const detalle = fijo ? fijo.detalle : borrador ? 'Probala las veces que quieras: los tiempos quedan solo en este aparato. Cuando esté lista, publicala desde el creador.'
    : comunidad && comunidad.club ? 'Pista del club «' + (comunidad.clubNombre || '?') + '».' : '';
  if (detalle) { $('pistaDetalle').textContent = detalle; $('pistaDetalle').hidden = false; }
  const datos = $('pistaDatos');
  // (si la pista pasa por varios ambientes, se nombran todos: 🌾🌲⛰️ Campo, bosque y montaña)
  const varios = etapa.biomas && etapa.biomas.length > 1 ? etapa.biomas.map((b) => BIOMAS[b].nombre.toLowerCase()) : null;
  const ambiente = varios ? etapa.biomas.map((b) => BIOMAS[b].emoji).join('') + ' ' + (varios.slice(0, -1).join(', ') + ' y ' + varios[varios.length - 1]).replace(/^./, (l) => l.toUpperCase()) : BIOMAS[etapa.bioma].emoji + ' ' + BIOMAS[etapa.bioma].nombre;
  for (const txt of [ambiente, CLIMAS[etapa.clima].emoji + ' ' + CLIMAS[etapa.clima].nombre, (etapa.largo / 1000).toFixed(1).replace('.', ',') + ' km', CARACTER[etapa.caracter].nombre]) datos.append(crear('span', 'dato', txt));
  // las notas del copiloto, todas en fila
  for (const n of copiloto.hoja) {
    const caja = crear('span', 'nota'), img = crear('img', 'icono');
    img.src = iconoDeNota(n); img.alt = '';
    caja.append(img, crear('b', '', textoDeNota(n)));
    $('hoja').append(caja);
  }
  // los autos
  for (const id in AUTOS) {
    const b = crear('button', 'auto');
    b.type = 'button'; b.dataset.auto = id; b.setAttribute('role', 'radio');
    b.append(crear('span', 'emoji', AUTOS[id].emoji), crear('b', '', AUTOS[id].nombre), crear('small', '', AUTOS[id].detalle));
    b.addEventListener('click', () => { o.elegirAuto(id); pintar(); });
    $('autos').append(b);
  }

  // En el celular parado, la parte de arriba de la portada se corre con el dedo si no entra (el pie queda fijo):
  // cuando queda algo por ver, el borde del pie lo avisa con una flechita (ver ".hay-mas" en style.css).
  const arriba = document.querySelector('#portada .arriba'), raiz = document.documentElement;
  raiz.style.setProperty('--mas', 'url(' + icono('abajo') + ')');
  const hayMas = () => raiz.classList.toggle('hay-mas', arriba.scrollHeight - arriba.clientHeight - arriba.scrollTop > 10);
  arriba.addEventListener('scroll', hayMas, { passive: true });
  window.addEventListener('resize', hayMas);

  function pintar() {
    // en un circuito (y en una pista de la comunidad) no hay pasada oficial: lo que cuenta es el mejor tiempo
    const oficial = libre ? club.practica() : club.oficial(), puede = club.sePuedeOficial(), rival = o.rival();
    for (const b of $('autos').children) { const si = b.dataset.auto === club.auto(); b.classList.toggle('elegido', si); b.setAttribute('aria-checked', si); }
    // contra quien
    $('desafio').hidden = !rival;
    if (rival) $('desafio').querySelector('span').textContent = 'Contra ' + rival.nombre + (rival.ab ? '' : ' · ' + tiempoFinal(rival.t));
    // mi resultado, si ya corri
    const mio = $('miResultado');
    mio.hidden = !oficial || !!oficial.corriendo;
    if (!mio.hidden) {
      mio.textContent = '';
      mio.append(crear('span', 'chico', T.vuelta ? 'Tu mejor vuelta' : libre ? 'Tu mejor tiempo' : 'Tu pasada oficial'), crear('b', 'tiempo', oficial.ab ? 'Abandono' : tiempoFinal(oficial.t)), cuadritos(oficial.c));
    }
    $('avisoAyuda').hidden = !ajustes.leer('ayuda');
    pintarAjustes();
    // la bandera a cuadros larga la pasada oficial; el cono, una practica
    rotular($('largar'), puede || libre ? 'Largar' : 'Practicar');
    $('largar').dataset.icono = puede || libre ? 'bandera' : 'cono';
    // compartir: el resultado propio (con su fantasma) o, en una pista de la comunidad que todavia no corriste, la pista
    $('compartirPortada').hidden = borrador || !((oficial && !oficial.corriendo && oficial.codigo) || (comunidad && o.clubes));
    $('editarPista').hidden = !borrador;
    $('queEs').textContent = (o.aviso ? o.aviso + ' ' : '') + (T.vuelta ? 'Vuelta cerrada: das las que quieras y queda la mejor. Para terminar, salí con la X' + (window.matchMedia('(pointer: coarse)').matches ? '.' : ' o con Esc.')
      : borrador ? 'Borrador: todavía no la ve nadie más.' : comunidad ? 'Pista de la comunidad: se corre las veces que quieras. Queda tu mejor tiempo.'
      : fijo ? 'Circuito fijo: se corre las veces que quieras. Queda tu mejor tiempo.' : puede ? 'Pasada oficial: una sola. Sin reconocimiento.' : esHoy ? 'Ya corriste la oficial. Las prácticas no cuentan para la tabla.' : 'Pista pasada: se puede practicar, pero ya no cuenta.');
    // la tabla: en lo libre, los mejores tiempos de cada uno; en una pista del dia, las oficiales y, aparte, las practicas
    pintarClubes();
    const principal = libre ? club.practicas(vista) : club.tabla(vista), practicas = libre ? [] : club.practicas(vista);
    pintarTabla($('tabla'), principal);
    pintarTabla($('practicas'), practicas);
    $('tablaVacia').hidden = principal.length > 0 || armando;
    $('tablaVacia').textContent = vista ? 'Todavía no corrió nadie de este club.' : borrador ? 'Los tiempos del borrador quedan solo en este aparato.'
      : comunidad ? 'Todavía no hay tiempos. Corrila y compartila: acá aparecen todos los que la corren.'
      : 'Todavía no hay tiempos. Corré tu pasada y compartila: los de tus amigos aparecen acá cuando abrís sus links' + (o.clubes ? ', o solos si arman un club.' : '.');
    $('practicasTitulo').hidden = libre || practicas.length === 0;
    $('tablaPista').textContent = fijo ? '· ' + fijo.corto : comunidad ? '· ' + etapa.nombre : '#' + numero;
    // (si estan abiertos los circuitos, la lista de pistas de la comunidad tambien: pueden haber llegado las de un club)
    if (!$('panelCircuitos').hidden) pintarComunidad();
    // (si se esta mostrando un resultado, su tabla tambien se pone al dia: pueden haber llegado tiempos de los clubes)
    if (ultimo) { const todos = libre ? club.practicas() : club.tabla(); $('finRanking').hidden = todos.length < 2; pintarTabla($('finTabla'), todos); }
    ponerIconos();
    hayMas();
  }

  // --- los clubes: arriba de la tabla, un boton por club (y "Todos"); el + arma uno nuevo ---
  const lista = (nombres) => (nombres.length < 2 ? nombres.join('') : nombres.slice(0, -1).join(', ') + ' y ' + nombres[nombres.length - 1]);
  function pintarClubes() {
    const caja = $('clubes'), mios = o.clubes ? club.clubes() : [];
    if (vista && !mios.some((c) => c.codigo === vista)) vista = '';
    caja.hidden = !o.clubes;
    caja.textContent = '';
    if (o.clubes) {
      const ficha = (texto, valor) => {
        const b = crear('button', vista === valor && !armando ? 'elegido' : '', texto), si = vista === valor && !armando;
        b.type = 'button'; b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', si);
        b.addEventListener('click', () => { vista = valor; armando = false; aviso = ''; saliendo = 0; pintar(); });
        caja.append(b);
      };
      if (mios.length) { ficha('Todos', ''); for (const c of mios) ficha(c.nombre, c.codigo); }
      // sin clubes, el boton lo dice con todas las letras; con clubes alcanza con el +
      const mas = crear('button', 'mas' + (armando ? ' elegido' : ''), mios.length ? undefined : ' Armar un club');
      mas.type = 'button'; mas.dataset.icono = 'mas'; mas.title = 'Armar un club'; mas.setAttribute('aria-label', 'Armar un club'); mas.setAttribute('aria-pressed', armando);
      mas.addEventListener('click', () => { armando = !armando; aviso = ''; saliendo = 0; pintar(); if (armando) $('clubNombre').focus(); });
      caja.append(mas);
    }
    const info = vista && o.clubes ? o.clubes.de(vista) : null, enClub = !!vista && !armando;
    $('clubNuevo').hidden = !armando;
    $('clubApodo').hidden = !(mios.length && !club.nombre() && !armando);   // (sin nombre, en la tabla de los demas se figura como "?")
    $('clubCabeza').hidden = !enClub;
    $('clubPie').hidden = !enClub;
    if (enClub) {
      $('clubDatos').textContent = info ? (info.miembros === 1 ? 'Por ahora estás vos solo: invitá a alguien.' : info.miembros + ' corredores') : '';
      $('clubSalir').textContent = saliendo ? '¿Seguro? Tocá de nuevo' : 'Salir del club';
    }
    const faltan = enClub && info ? info.faltan : [];
    $('clubFaltan').hidden = !faltan.length;
    if (faltan.length) $('clubFaltan').textContent = (faltan.length === 1 ? 'Todavía no corrió ' : 'Todavía no corrieron ') + lista(faltan) + '.';
    $('clubAviso').hidden = !aviso;
    $('clubAviso').textContent = aviso;
    // las pistas que armo la gente del club (cada club hace las suyas)
    $('clubPistas').hidden = !enClub;
    if (enClub) {
      const pistas = (info && info.pistas) || [];
      pintarPistas($('clubPistasLista'), pistas.map((p) => ({ ...p, club: vista })), false);
      $('clubPistasVacia').hidden = pistas.length > 0;
    }
  }
  const avisar = (texto) => { aviso = texto; pintar(); };
  $('clubNuevo').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nombre = $('clubNombre').value.trim(), boton = $('clubNuevo').querySelector('button');
    if (nombre.length < 2) { avisar('Ponele un nombre al club.'); return; }
    boton.disabled = true;
    const r = await o.clubes.fundar(nombre);
    boton.disabled = false;
    if (r.error) { avisar(r.error); return; }
    $('clubNombre').value = '';
    vista = r.codigo; armando = false;
    avisar('Listo: ya existe «' + r.nombre + '». Invitá a tus amigos con el botón.');
  });
  $('clubInvitar').addEventListener('click', () => {
    const c = club.clubes().find((x) => x.codigo === vista);
    if (c) pasar('Sumate a mi club de Shakedown «' + c.nombre + '»: una pista nueva por día, y vemos quién la hace más rápido.\n' + conAviso(location.origin + location.pathname + '#club=' + c.codigo), avisar, 'Copiado. Pegalo en el grupo: el que lo abre queda en el club.');
  });
  // salir pide confirmacion: hay que tocar dos veces
  $('clubSalir').addEventListener('click', async () => {
    if (!saliendo || performance.now() - saliendo > 8000) { saliendo = performance.now(); pintar(); return; }
    saliendo = 0;
    const r = await o.clubes.dejar(vista);
    if (r.error) avisar(r.error); else { vista = ''; avisar('Saliste del club.'); }
  });

  // --- la tabla ---
  function pintarTabla(ol, lista) {
    ol.textContent = '';
    const rival = o.rival();
    lista.forEach((r) => {
      const li = crear('li', r.mio ? 'mio' : '');
      const quien = crear('span', 'quien', r.nombre || (r.mio ? 'Vos' : '?'));
      if (r.ayuda) quien.append(conAyuda());
      li.append(crear('span', 'emoji', (AUTOS[r.auto] || AUTOS.vitarita).emoji), quien, crear('span', 'tiempoMarca', r.ab ? 'abandono' : tiempoFinal(r.t)), cuadritos(r.c));
      if (r.codigo || r.id) {
        const clave = o.claveDe(r), es = rival && rival.clave === clave && !!rival.practica === !!r.practica;
        // el fantasma: amarillo si es contra quien se corre
        const b = crear('button', 'chiquito' + (es ? ' elegido' : ''));
        b.dataset.icono = 'fantasma';
        b.title = es ? 'Es tu rival. Tocá para correr sin fantasma.' : 'Correr contra su fantasma';
        b.setAttribute('aria-label', b.title); b.setAttribute('aria-pressed', es);
        b.addEventListener('click', async () => {
          // (el fantasma de alguien de un club se baja del servidor en este momento)
          const llego = await o.elegirRival(es ? '' : clave, !!r.practica);
          aviso = llego === false ? 'No pude traer el fantasma de ' + r.nombre + ': no hay conexión con el servidor.' : '';
          pintar();
          if (ultimo) pintarTabla($('finTabla'), libre ? club.practicas() : club.tabla());
        });
        li.append(b);
      } else li.append(crear('span'));
      ol.append(li);
    });
    ponerIconos(ol);
  }

  // --- los circuitos fijos: cada uno con tu mejor tiempo; arriba de todo, la vuelta a la pista de hoy ---
  function pintarCircuitos() {
    const ol = $('circuitos');
    if (ol.children.length) return;
    const fila = (direccion, aca, emoji, nombre, detalle, res) => {
      const a = crear('a', aca ? 'aca' : '');
      a.href = direccion;
      a.append(crear('span', 'emoji', emoji), crear('b', '', nombre), crear('small', '', detalle));
      if (res) a.append(crear('span', 'tiempoMarca', res.ab ? 'abandono' : tiempoFinal(res.t)), cuadritos(res.c));
      const li = crear('li');
      li.append(a);
      ol.append(li);
    };
    const d = datosDelDia(hoy), deHoy = club.resumen(hoy);
    fila(location.pathname, esHoy, '🏁', 'La pista de hoy · #' + hoy, CLIMAS[d.clima].emoji + BIOMAS[d.bioma].emoji + ' ' + d.nombre + '. Una sola pasada oficial.', deHoy.oficial);
    for (const c of CIRCUITOS) fila(location.pathname + '?c=' + c.id, c.numero === numero, c.emoji, c.nombre, c.detalle, club.resumen(c.numero).practica);
  }

  // --- las pistas de la comunidad: una fila por pista, con lo que le queda y tu mejor tiempo ---
  // (conClub: si se dice de que club es; en la lista de un club no hace falta). Las propias llevan un tacho para borrarlas
  // (hay que tocarlo dos veces): cada uno puede tener cinco vigentes, y si quiere otra, borra una.
  // (el tacho que se toco una vez: queda preguntando unos segundos, aunque la lista se vuelva a pintar; y lo que salio mal)
  let porBorrar = { numero: 0, desde: 0, error: '' };
  const preguntando = (n) => porBorrar.numero === n && !porBorrar.error && performance.now() - porBorrar.desde < 6000;
  const repintarPistas = () => { pintarComunidad(); pintar(); };
  function pintarPistas(ol, pistas, conClub) {
    ol.textContent = '';
    const mias = new Set(club.pistas().filter((x) => x.mia).map((x) => x.numero));
    for (const p of pistas) {
      const a = crear('a', p.numero === numero ? 'aca' : ''), res = club.resumen(p.numero).practica, mia = p.mia || mias.has(p.numero), pregunta = preguntando(p.numero);
      const detalle = [conClub && p.clubNombre ? 'Club ' + p.clubNombre : '', mia ? 'la armaste vos' : '', quedan(p.vence)].filter(Boolean).join(' · ');
      a.href = (o.direccion || String)(location.pathname + '?pista=' + p.numero + '-' + (p.version || p.v));
      a.append(crear('span', 'emoji', EMOJI_COMUNIDAD), crear('b', '', p.nombre),
        crear('small', '', pregunta ? '¿Borrarla? Se van también sus tiempos. Tocá de nuevo el tacho.' : porBorrar.numero === p.numero && porBorrar.error ? porBorrar.error : detalle));
      if (res) a.append(crear('span', 'tiempoMarca', res.ab ? 'abandono' : tiempoFinal(res.t)), cuadritos(res.c));
      const li = crear('li');
      li.append(a);
      if (mia && o.borrarPista) {
        const b = crear('button', 'chiquito tacho' + (pregunta ? ' seguro' : ''));
        b.type = 'button'; b.dataset.icono = 'tacho'; b.title = 'Borrar «' + p.nombre + '»'; b.setAttribute('aria-label', b.title);
        b.addEventListener('click', async () => {
          if (!preguntando(p.numero)) {
            porBorrar = { numero: p.numero, desde: performance.now(), error: '' };
            repintarPistas();
            setTimeout(() => { if (porBorrar.numero === p.numero && !porBorrar.error) { porBorrar.numero = 0; repintarPistas(); } }, 6100);
            return;
          }
          b.disabled = true;
          porBorrar.numero = 0;
          const r = await o.borrarPista(p.numero);
          if (r.error) porBorrar = { numero: p.numero, desde: 0, error: r.error };
          if (!r.sale) repintarPistas();
        });
        li.classList.add('con-tacho');
        li.append(b);
      }
      ol.append(li);
    }
    ponerIconos(ol);
  }
  function pintarComunidad() {
    const pistas = club.pistas();
    pintarPistas($('comunidad'), pistas, true);
    $('comunidadVacia').hidden = pistas.length > 0;
    $('armarPista').hidden = !o.armar;
  }

  // --- pistas pasadas ---
  function pintarPasadas() {
    const ol = $('pasadas');
    if (ol.children.length) return;
    for (let n = hoy; n >= Math.max(1, hoy - 60); n--) {
      const d = datosDelDia(n), res = club.resumen(n), a = crear('a', n === numero ? 'aca' : '');
      a.href = n === hoy ? location.pathname : location.pathname + '?p=' + n;
      a.append(crear('b', '', '#' + n), crear('span', 'emoji', CLIMAS[d.clima].emoji + BIOMAS[d.bioma].emoji), crear('span', 'quien', d.nombre), crear('small', '', n === hoy ? 'hoy' : fechaDe(n)));
      if (res.oficial) a.append(crear('span', 'tiempoMarca', res.oficial.ab ? 'abandono' : tiempoFinal(res.oficial.t)), cuadritos(res.oficial.c));
      else a.append(crear('span', 'tiempoMarca', res.practica ? '🔧 ' + tiempoFinal(res.practica.t) : '—'), crear('span'));
      const li = crear('li');
      li.append(a);
      ol.append(li);
    }
  }

  // --- la ayuda ---
  $('historia').innerHTML = `
    <p>Un club clandestino de puristas del rally, cansados de los circuitos cerrados, busca caminos olvidados. Cada medianoche, el organizador anónimo publica en un foro cerrado las coordenadas y las notas del copiloto del desafío del día: un sendero forestal embarrado, una ruta rural castigada por la lluvia o un paso de montaña de ripio perdido entre los pinos.</p>
    <p>No hay vueltas de reconocimiento. Sos vos, tu lectura del terreno y un auto noventero guerrero contra el cronómetro: una Vitara del 92 levantada o un humilde Ka con chapón cubrecárter.</p>
    <p>Tenés una sola pasada oficial antes de que los vecinos se quejen, caigan las autoridades y clausuren el trazado para siempre. Al final del día los tiempos se comparan en la tabla del club. Mañana habrá que embarrarse en otro lado.</p>`;
  // el equipo: los personajes, cada uno con su retrato (se bajan recien cuando se abre esta parte)
  for (const p of EQUIPO) {
    const ficha = crear('figure'), img = crear('img'), pie = crear('figcaption');
    Object.assign(img, { src: retrato(p.id), loading: 'lazy', decoding: 'async', alt: '', width: 431, height: 458, draggable: false });
    pie.append(crear('b', '', p.nombre), crear('span', '', p.rol));
    ficha.append(img, pie);
    $('equipo').append(ficha);
  }
  // (el tutorial se puede volver a ver cuando se quiera: cierra el panel y arranca en la largada)
  $('verTutorial').addEventListener('click', () => { abrir(''); o.tutorial(); });
  const dib = (nombre, color) => '<span data-icono="' + nombre + '"' + (color ? ' data-color="' + color + '"' : '') + '></span>';
  $('comoSeJuega').innerHTML = `
    <dl class="teclas teclado">
      <div><dt><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> o las flechas</dt><dd>manejar</dd></div>
      <div><dt><kbd>Espacio</kbd></dt><dd>freno de mano</dd></div>
      <div><dt><kbd>R</kbd> ${dib('volver')}</dt><dd>volver al camino (suma 8 segundos)</dd></div>
      <div><dt><kbd>C</kbd> ${dib('cam-aerea')}${dib('cam-atras')}${dib('cam-arriba')}</dt><dd>cámara: aérea, de atrás o desde arriba</dd></div>
      <div><dt><kbd>M</kbd> ${dib('sonido')} <kbd>V</kbd> ${dib('voz')}</dt><dd>sonido y voz del copiloto</dd></div>
      <div><dt><kbd>T</kbd> ${dib('trazada')}</dt><dd>trazada: la línea para seguir</dd></div>
    </dl>
    <dl class="teclas dedos">
      <div><dt>Inclinar el celu</dt><dd>doblar</dd></div>
      <div><dt>${dib('arriba', '#f2c200')}</dt><dd>acelerar</dd></div>
      <div><dt>${dib('abajo')}</dt><dd>frenar y marcha atrás</dd></div>
      <div><dt>${dib('mano')}</dt><dd>freno de mano</dd></div>
      <div><dt>${dib('volver')}</dt><dd>volver al camino (suma 8 segundos)</dd></div>
      <div><dt>${dib('cam-aerea')}${dib('cam-atras')}${dib('cam-arriba')}</dt><dd>cámara: aérea, de atrás o desde arriba</dd></div>
      <div><dt>${dib('sonido')}${dib('voz')}</dt><dd>sonido y voz del copiloto</dd></div>
    </dl>
    <p>${dib('bandera')} larga la pasada oficial: una sola por día. ${dib('cono')} es práctica: no cuenta para la tabla.</p>
    <p>${dib('circuito')} Además de la pista del día hay circuitos fijos, para correr las veces que quieras: una subida y una bajada de montaña, un callejero por el pueblo y una vuelta cerrada para practicar, donde das las vueltas que quieras. Queda guardado tu mejor tiempo.</p>
    <p class="con-servidor">${dib('lapiz')} Ahí también están las pistas de la comunidad: las arma la gente en el creador, nota por nota, como las canta el copiloto. Duran dos semanas y se comparten con un link. Si la armás para un club, aparece en el club y la corren todos sus miembros.</p>
    <p>Cada pista tiene cinco sectores. Al final, cada uno queda <b class="verde">verde</b>, <b class="amarillo">amarillo</b> o <b class="rojo">rojo</b> según cuánto tardaste contra el tiempo de referencia. Si tuviste que volver al camino, ese sector es rojo.</p>
    <p>Los números de las notas van del 1 (curva muy cerrada) al 6 (casi recta). H es una horquilla y 90, una esquina.</p>
    <p>Los golpes rompen el auto. Si se rompe del todo, es abandono. Las piedras que están pegadas al camino llevan una antorcha roja.</p>
    <p>${dib('fantasma')} En la tabla, el fantasma elige contra quién corrés. Si te mandan un link, corrés contra quien te lo mandó.</p>
    <p class="con-servidor">${dib('podio')} En la tabla también se arman clubes: le ponés un nombre, invitás con un link, y el que lo abre queda adentro. La pasada oficial de cada uno aparece sola en la tabla de todos sus clubes. Para eso, tu tiempo se guarda en el servidor del juego con el nombre que elijas; no se pide ningún otro dato.</p>
    <p>${dib('ajustes')} En la configuración se cambian la distancia de la cámara y, en el celular, la sensibilidad al inclinar y el tamaño de los pedales.</p>
    <p>${dib('trazada')} Ahí también se prende la trazada: una línea pintada en el camino que muestra por dónde pasar. Está <b class="verde">verde</b> donde podés acelerar, <b class="amarillo">amarilla</b> donde venís justo y <b class="rojo">roja</b> donde venís pasado: cuando el rojo llega al auto, hay que frenar.</p>
    <p>${dib('salvavidas')} Si recién arrancás, prendé la ayuda de manejo: el auto sigue solo la trazada, frena antes de las curvas y se cruza menos. Vos acelerás y corregís con el volante. Es más lento, pero llegás.</p>`;

  for (const el of document.querySelectorAll('.con-servidor')) el.hidden = !o.clubes;   // (lo de los clubes, solo si hay servidor)

  // --- la configuracion ---
  // Cada grupo de botones y cada barra dice que gusto cambia (data-ajuste). "si" y "no" valen verdadero y falso;
  // lo demas son numeros. La barra de la camara va en porcentaje (100 = la distancia normal).
  const leerValor = (txt) => (txt === 'si' ? true : txt === 'no' ? false : Number(txt));
  const deBarra = { lejos: (v) => v / 100, sensible: (v) => v }, aBarra = { lejos: (v) => Math.round(v * 100), sensible: (v) => v };
  function pintarAjustes() {
    for (const el of document.querySelectorAll('[data-ajuste]')) {
      const clave = el.dataset.ajuste, vale = ajustes.leer(clave);
      if (el.tagName === 'INPUT') { if (document.activeElement !== el) el.value = aBarra[clave](vale); continue; }
      for (const b of el.children) { const si = leerValor(b.dataset.valor) === vale; b.classList.toggle('elegido', si); b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', si); }
    }
    // la sensibilidad no hace falta si se dobla con las flechas
    $('ajusteInclina').hidden = !!ajustes.leer('botones');
  }
  for (const el of document.querySelectorAll('[data-ajuste]')) {
    const clave = el.dataset.ajuste;
    if (el.tagName === 'INPUT') {
      el.addEventListener('input', () => ajustes.poner(clave, deBarra[clave](Number(el.value))));
      // mientras se mueve la barra de la camara, el panel se corre para que se vea como queda
      if (clave === 'lejos') {
        const mirar = (si) => { $('panel').classList.toggle('mirando', si); el.closest('.ajuste').classList.toggle('mirado', si); };
        el.addEventListener('pointerdown', () => mirar(true));
        for (const fin of ['pointerup', 'pointercancel', 'blur']) el.addEventListener(fin, () => mirar(false));
      }
    } else for (const b of el.children) b.addEventListener('click', () => ajustes.poner(clave, leerValor(b.dataset.valor)));
  }
  $('probarAyuda').addEventListener('click', () => {
    ajustes.poner('ayuda', true);
    $('finAyuda').firstElementChild.textContent = 'Listo: la próxima pasada va con ayuda de manejo.';
    $('probarAyuda').hidden = true;
  });

  // --- paneles ---
  function abrir(cual) {
    for (const [id, nombre] of [['panelTabla', 'tabla'], ['panelCircuitos', 'circuitos'], ['panelPasadas', 'pasadas'], ['panelAyuda', 'ayuda'], ['panelAjustes', 'ajustes']]) $(id).hidden = nombre !== cual;
    if (cual === 'pasadas') pintarPasadas();
    if (cual === 'circuitos') { pintarCircuitos(); pintarComunidad(); }
    // en el celular, al abrir la configuracion se prende el sensor (si lo hay) para poder probar la sensibilidad
    if (cual === 'ajustes') { pintarAjustes(); if (window.matchMedia('(pointer: coarse)').matches) ajustes.probar(); }
    // al abrir la tabla se le piden al servidor los tiempos de los clubes (si paso un rato desde la ultima vez)
    if (cual === 'tabla') { if (o.clubes) o.clubes.refrescar(); } else { armando = false; saliendo = 0; aviso = ''; }
    $('panel').hidden = !cual;
    if (cual) $('cerrarPanel').focus();
  }
  for (const b of document.querySelectorAll('[data-panel]')) b.addEventListener('click', () => abrir(b.dataset.panel));
  $('cerrarPanel').addEventListener('click', () => abrir(''));
  // desde el resultado: vuelve a la portada y abre los circuitos (en el borrador: vuelve al creador)
  $('irCircuitos').addEventListener('click', () => { $('salir').click(); if (borrador) o.armar(); else abrir('circuitos'); });
  // el creador de pistas: desde los circuitos, desde un club (la pista queda para ese club) y, en el borrador, desde la portada
  const armar = (codigo) => { abrir(''); o.armar(codigo); };
  $('armarPista').addEventListener('click', () => armar());
  $('clubArmar').addEventListener('click', () => armar(vista));
  $('editarPista').addEventListener('click', () => armar());

  // --- compartir ---
  // Pasa un texto: en el celular abre el menu de compartir; en la compu lo copia. decir(texto): donde se avisa como salio.
  // (El link va siempre solo en su renglon: lo que venga despues, como el aviso de Early Access, no se le puede pegar.)
  async function pasar(texto, decir, listo) {
    try {
      if (navigator.share && window.matchMedia('(pointer: coarse)').matches) { await navigator.share({ text: texto }); return; }
      await navigator.clipboard.writeText(texto);
      decir(listo);
    } catch (e) {
      if (e && e.name === 'AbortError') return;
      decir('No pude copiarlo. Copialo de acá: ' + texto.replace(/\n/g, ' '));
    }
  }
  // una pista de la comunidad, sin resultado: el nombre y su link (quien la armo no va: solo en la portada)
  async function compartirPista(salida) {
    await pasar('Shakedown · ' + etapa.nombre + ' ' + EMOJI_COMUNIDAD + ' ¿Quién la hace más rápido?\n' + conAviso(o.linkDeLaPista()), (texto) => { if (salida) salida.textContent = texto; }, 'Copiado. Pegalo en el grupo.');
  }
  async function compartir(r, salida) {
    if (!club.nombre()) { $('nombre').focus(); if (salida) salida.textContent = 'Poné tu nombre para compartir.'; return; }
    const codigo = r.codigo || (linkDe && await linkDe());
    // el link lleva el codigo corto con el que la pasada quedo en el servidor; si no hay servidor, la pasada entera
    const final = codigo ? await o.acortar(r, codigo) : '';
    // tres renglones: el resultado, el link y que el juego esta en desarrollo
    await pasar(mensaje(etapa, r) + '\n' + conAviso(location.origin + location.pathname + (final ? '#r=' + final : '')), (texto) => { if (salida) salida.textContent = texto; }, 'Copiado. Pegalo en el grupo.');
  }
  $('compartir').addEventListener('click', () => ultimo && compartir(ultimo, $('compartido')));
  $('compartirPortada').addEventListener('click', () => {
    const r = libre ? club.practica() : club.oficial();
    if (r && r.codigo) compartir({ ...r, nombre: club.nombre() }, $('queEs'));
    else if (comunidad && !borrador) compartirPista($('queEs'));
  });
  // El nombre se pone al terminar una pasada o, si se esta en un club, en la tabla. Al cambiarlo se arma de nuevo el
  // link de la pasada que se esta mostrando (asi sube al servidor con el nombre nuevo) y se avisa a los clubes.
  const ponerNombre = (valor) => {
    club.ponerNombre(valor);
    $('nombre').value = club.nombre(); $('compartido').textContent = '';
    if (ultimo && linkDe) linkDe();
    if (o.clubes) o.clubes.renombrar();
    pintar();
  };
  $('nombre').addEventListener('change', () => ponerNombre($('nombre').value));
  $('clubApodo').addEventListener('submit', (e) => { e.preventDefault(); ponerNombre($('clubMiNombre').value); if (!club.nombre()) $('clubMiNombre').focus(); });
  $('nombre').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('nombre').blur(); });

  return {
    pintar,
    portada: (si) => { $('portada').hidden = !si; if (!si) abrir(''); else pintar(); },
    // Muestra el resultado de una pasada. r: el resultado. armarLink: funcion que devuelve el codigo del link (con el fantasma).
    // mejoro: true si es tu mejor tiempo en esa pista (para las practicas y los circuitos).
    fin: (r, armarLink, mejoro) => {
      ultimo = r; linkDe = armarLink;
      $('finTipo').textContent = (fijo ? 'Circuito · ' : borrador ? 'Borrador · ' : comunidad ? 'Pista de la comunidad · ' : (r.practica ? 'Práctica' : 'Pasada oficial') + ' · #' + numero + ' ') + etapa.nombre + (mejoro ? (T.vuelta ? ' · ¡tu mejor vuelta!' : ' · ¡tu mejor tiempo!') : '');
      $('finTitulo').textContent = r.ab ? ABANDONO[r.ab] || 'Abandono' : '';
      $('finTitulo').hidden = !r.ab;
      $('finGrande').textContent = r.ab ? 'Abandono' : tiempoFinal(r.t);
      $('finGrande').classList.toggle('abandono', !!r.ab);
      // los cinco sectores, cada uno con su tiempo y cuanto mas (o menos) que la referencia
      const caja = $('finCuadros');
      caja.textContent = '';
      [...r.c].forEach((x, k) => {
        const s = crear('span', 'sector ' + CLASE_DE_COLOR[x]);
        s.append(crear('i'), crear('b', '', x === 'n' ? '—' : r.s[k].toFixed(1)), crear('small', '', x === 'n' ? '' : (r.s[k] >= ref.sectores[k] ? '+' : '−') + Math.abs(r.s[k] - ref.sectores[k]).toFixed(1)));
        caja.append(s);
      });
      $('finDetalle').textContent = r.ab ? '' : (r.rondas ? (r.rondas === 1 ? 'Diste una vuelta. ' : 'La mejor de ' + r.rondas + ' vueltas. ') + (r.seRompio ? 'Después rompiste el auto. ' : '') : '')
        + (r.vueltas ? (r.vueltas === 1 ? 'Volviste al camino una vez (+8 s). ' : 'Volviste al camino ' + r.vueltas + ' veces (+' + r.vueltas * 8 + ' s). ') : '') + 'Referencia ' + tiempoFinal(ref.total) + '.' + (r.ayuda ? ' Con ayuda de manejo.' : '');
      // despues de una pasada complicada sin ayuda, se la ofrece
      $('finAyuda').hidden = !!r.ayuda || !!ajustes.leer('ayuda') || !(r.ab === 'roto' || r.vueltas >= 2 || (!r.ab && r.t > ref.total * 1.6));
      $('finAyuda').firstElementChild.textContent = '¿Se complicó?';
      $('probarAyuda').hidden = false;
      $('nombre').value = club.nombre();
      $('compartido').textContent = '';
      $('social').hidden = borrador;   // (el borrador no se comparte: todavia no existe para los demas)
      const tabla = libre ? club.practicas() : club.tabla();
      $('finRanking').hidden = tabla.length < 2;
      pintarTabla($('finTabla'), tabla);
      rotular($('otra'), libre ? 'Otra vez' : 'Practicar');
      $('otra').dataset.icono = libre ? 'bandera' : 'cono';
      rotular($('irCircuitos'), borrador ? 'Seguir armando' : 'Circuitos');
      $('irCircuitos').dataset.icono = borrador ? 'lapiz' : 'circuito';
      $('fin').hidden = false;
      ponerIconos();
    },
    cerrarFin: () => { $('fin').hidden = true; ultimo = null; },
    // dice algo en la portada, abajo del boton de largar (queda hasta que se cierre el juego)
    decir: (texto) => { o.aviso = texto; pintar(); },
    // abre la tabla en un club, con un aviso (por ejemplo, al entrar por una invitacion)
    verClub: (codigo, texto) => { vista = codigo; armando = false; aviso = texto || ''; if ($('fin').hidden && !$('portada').hidden) abrir('tabla'); pintar(); },
    // (en la configuracion) muestra el volante en vivo: v es la inclinacion, de -1 a 1, o null si no hay sensor
    prueba: (v) => { if (!$('panelAjustes').hidden && v !== null) $('pruebaVolante').style.left = (50 + v * 50).toFixed(1) + '%'; },
  };
}

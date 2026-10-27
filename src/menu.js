// Las pantallas que no son manejar: el inicio (la pista protagonista y la fila de modos), la tabla del club,
// los circuitos y las pistas de la comunidad (dentro de sus cards), las pistas pasadas, la ayuda, la configuracion y el
// resultado de cada pasada con su boton de compartir.
import { FIRMA } from './config.js';
import { TIPOS, PARTES, PRESETS, FICHAS, codigoDe, partesDe, armarCodigo, parte, configDe, fichas } from './partes.js';
import { crearVitrina } from './vitrina.js';
import { BIOMAS, CLIMAS, CARACTER, datosDelDia, generarPista } from './generador.js';
import { CIRCUITOS, circuitoDe } from './circuitos.js';
import { fechaDe } from './dia.js';
import { tiempoFinal, CLASE_DE_COLOR } from './hud.js';
import { ponerIconos, rotular, icono } from './iconos.js';
import { EQUIPO, retrato } from './equipo.js';

const $ = (id) => document.getElementById(id);
const CUADRO = { v: '🟩', a: '🟨', r: '🟥', n: '⬛' };
const ABANDONO = { roto: 'Rompiste el auto', tiempo: 'Se acabó el tiempo', cerrado: 'Cerraste el juego en plena pasada' };
// El tiempo de un resultado. Un abandono dice DNF, como en las planillas de rally ("did not finish": no termino).
const DNF = 'DNF';
const marcaDe = (r) => (r.ab ? DNF : tiempoFinal(r.t));
const crear = (etiqueta, clase, texto) => { const el = document.createElement(etiqueta); if (clase) el.className = clase; if (texto !== undefined) el.textContent = texto; return el; };

// El mensaje para compartir: Shakedown #42 🌧️🌲 ⏱️ 01:42:85 🟩 🟩 🟨 🟥 🟩 🏁 🚙431
// (al final, el auto: el dibujo de su chasis y el codigo de sus partes; ver partes.js)
// (el de un circuito fijo lleva su nombre en vez del numero: Shakedown · Subida ⛰️ ⏱️ 01:42:85 ...; el de una pista de la
// comunidad, su nombre firmado por quien la armo: Shakedown · Pista «La Curva del Tero» por Juanma 📝 ⏱️ ...)
// autor: quien armo la pista de la comunidad (su firma: va en todo lo que se comparte de esa pista)
export const EMOJI_COMUNIDAD = '📝';
export const firmada = (nombre, autor) => 'Pista «' + nombre + '»' + (autor ? ' por ' + autor : '');
export function mensaje(etapa, r, autor) {
  const cuadros = [...(r.c || 'nnnnn')].map((x) => CUADRO[x]).join(' '), fijo = circuitoDe(etapa.numero);
  return (fijo ? 'Shakedown · ' + fijo.corto + ' ' + fijo.emoji : etapa.comunidad ? 'Shakedown · ' + firmada(etapa.nombre, autor) + ' ' + EMOJI_COMUNIDAD
    : 'Shakedown #' + etapa.numero + ' ' + CLIMAS[etapa.clima].emoji + BIOMAS[etapa.bioma].emoji + (r.practica ? ' 🔧 práctica' : ''))
    + (r.ab ? ' 💥 ' + DNF + ' ' + cuadros : ' ⏱️ ' + tiempoFinal(r.t) + ' ' + cuadros + ' 🏁')
    + ' ' + configDe(r.auto).emoji + codigoDe(r.auto);   // (con que auto: su chasis y el codigo de sus partes)
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
//      deLink                        true si la direccion pide algo concreto: el inicio muestra esa pista
//      correr(numero, direccion)     corre esa pista (ver "correr" en main.js)
//      travesia(), tutorial()        los botones de los paneles de la Travesia y de la mision tutorial
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
  // y el casco, uno hecho en modo "rally serio"
  const conSerio = () => { const img = crear('img', 'icono con-ayuda'); img.src = icono('casco'); img.alt = 'en modo rally serio'; img.title = 'En modo rally serio'; return img; };
  let ultimo = null, linkDe = null, ultimoMejoro = false;   // el ultimo resultado mostrado, la funcion que arma su link y si fue tu mejor tiempo
  // la tabla: de quien se ven los tiempos ('' = todos los que se conocen; si no, el codigo de un club), si esta abierto
  // el formulario para armar un club, y lo ultimo que hay para avisar ahi
  // vista: '*' = todos los que corrieron (lo trae el servidor, ver "todos" en main.js), '' = mis amigos (links y clubes juntos) o el
  // codigo de un club. Se acuerda la ultima que se eligio. En lo libre (circuitos y pistas de la comunidad) no hay "todos".
  const TODOS = '*', conTodos = !libre && !!o.clubes;
  let vista = conTodos ? (club.gusto('vistaTabla') !== undefined ? club.gusto('vistaTabla') : TODOS) : '';
  let armando = false, aviso = '', saliendo = 0;

  // --- el inicio ---
  $('inicio').href = location.pathname;
  // quien hace el juego: debajo de la marca, solo en el inicio
  $('firmaAutor').textContent = FIRMA.autor;
  $('firma').hidden = !FIRMA.autor;
  // El inicio muestra la pista cargada (la de hoy, una pasada, un circuito o una pista de la comunidad: los links de un amigo
  // abren ahi, con el aviso de quien te desafia). Los otros modos son paneles: se elige una pista y se larga.
  const MODOS = ['pasadas', 'circuitos', 'reales', 'travesia', 'tutorial', 'comunidad'];
  // hasta que el juego termina de armar todo, los botones de correr esperan
  let listo = false;

  // --- tu auto y el garaje (ver partes.js) ---
  // En la portada, tu auto: su dibujo, su nombre y su codigo. Tocandolo se abre el garaje, donde se cambia cada parte con
  // las flechas; el auto de la pista cambia en el momento, y las fichas dicen como queda (lo que mejoro en verde, lo que
  // empeoro en rojo). Queda guardado para todas las pasadas. El nombre es solo tuyo: lo que viaja es el codigo.
  const nombreDelAuto = () => club.nombreAuto() || configDe(club.auto()).nombre;
  function pintarMiAuto() {
    const codigo = codigoDe(club.auto()), C = configDe(codigo), b = $('miAuto');
    b.textContent = '';
    b.append(crear('span', 'emoji', C.emoji), crear('b', '', nombreDelAuto()), crear('span', 'codigo-auto', codigo));
    b.setAttribute('aria-label', 'Tu auto: ' + nombreDelAuto() + ', código ' + codigo + '. Abrir el garaje');
  }
  $('miAuto').addEventListener('click', () => abrir('garaje'));
  let vitrina = null, antes = null;
  const cambiarAuto = (codigo) => { antes = fichas(club.auto()); o.elegirAuto(codigo); pintarGaraje(); pintar(); };
  for (const id in PRESETS) {
    const b = crear('button', 'con-texto discreto');
    b.type = 'button'; b.dataset.auto = id;
    b.textContent = PRESETS[id].nombre + ' · ' + PRESETS[id].codigo;
    b.addEventListener('click', () => { club.ponerNombreAuto(''); cambiarAuto(PRESETS[id].codigo); });
    $('autos').append(b);
  }
  for (const tipo of TIPOS) {
    const fila = crear('div', 'parte'), menos = crear('button', 'chiquito'), mas = crear('button', 'chiquito');
    fila.dataset.tipo = tipo;
    menos.type = mas.type = 'button';
    menos.dataset.icono = 'izquierda'; mas.dataset.icono = 'derecha';
    menos.setAttribute('aria-label', 'Otro ' + tipo); mas.setAttribute('aria-label', 'Otro ' + tipo);
    const mover = (paso) => {
      const p = partesDe(club.auto()), n = PARTES[tipo].length;
      p[tipo] = ((p[tipo] - 1 + paso + n) % n) + 1;
      cambiarAuto(armarCodigo(p));
    };
    menos.addEventListener('click', () => mover(-1)); mas.addEventListener('click', () => mover(1));
    const que = crear('span', 'que'); que.dataset.icono = tipo;
    fila.append(que, menos, crear('div', 'cual'), mas);
    $('partes').append(fila);
  }
  function pintarGaraje() {
    const codigo = codigoDe(club.auto()), p = partesDe(codigo), f = fichas(codigo);
    $('codigoAuto').textContent = codigo;
    if (document.activeElement !== $('nombreAuto')) $('nombreAuto').value = nombreDelAuto();
    for (const fila of $('partes').children) {
      const tipo = fila.dataset.tipo, n = p[tipo], x = parte(tipo, n), cual = fila.querySelector('.cual');
      cual.textContent = '';
      const puntos = crear('span', 'puntos');
      for (let k = 1; k <= PARTES[tipo].length; k++) puntos.append(crear('i', k === n ? 'si' : ''));
      cual.append(crear('b', '', n + ' · ' + x.nombre), crear('small', '', x.detalle), puntos);
    }
    $('fichas').textContent = '';
    for (const [k, nombre] of FICHAS) {
      const fila = crear('div', 'ficha'), barra = crear('span', 'barra'), viejo = antes ? antes[k] : f[k];
      for (let i = 1; i <= 10; i++) barra.append(crear('i', i <= f[k] ? (i > viejo ? 'gano' : 'si') : i <= viejo ? 'perdio' : ''));
      fila.append(crear('span', '', nombre), barra);
      $('fichas').append(fila);
    }
    antes = null;
    if (vitrina) vitrina.mostrar(configDe(codigo));
    ponerIconos($('panelGaraje'));
  }
  $('nombreAuto').addEventListener('change', () => { club.ponerNombreAuto($('nombreAuto').value); $('nombreAuto').value = nombreDelAuto(); pintar(); });
  $('nombreAuto').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('nombreAuto').blur(); });
  $('listoAuto').addEventListener('click', () => abrir(''));

  function pintar() {
    pintarMiAuto();
    $('avisoAyuda').hidden = !ajustes.leer('ayuda');
    pintarAjustes();
    pintarCards();
    pintarPie();
    // la tabla: en lo libre, los mejores tiempos de cada uno; en una pista del dia, las oficiales y, aparte, las practicas
    pintarClubes();
    const deTodos = vista === TODOS, t = deTodos && o.todos ? o.todos() : null;
    const principal = deTodos ? [] : libre ? club.practicas(vista) : club.tabla(vista), practicas = libre || deTodos ? [] : club.practicas(vista);
    $('tabla').classList.toggle('todos', deTodos);
    if (deTodos) pintarTodos($('tabla'), t); else pintarTabla($('tabla'), principal);
    pintarTabla($('practicas'), practicas);
    $('tablaTotal').hidden = !deTodos || !t || !t.total;
    if (deTodos && t) $('tablaTotal').textContent = t.total + (t.total === 1 ? ' corredor' : ' corredores') + (t.yo ? ' · vos, #' + t.yo.puesto : '');
    $('tablaVacia').hidden = armando || (deTodos ? !!(t && t.total) : principal.length > 0);
    $('tablaVacia').textContent = deTodos ? (t ? 'Todavía no corrió nadie la pasada oficial. ¡Sé el primero!' : 'Buscando la tabla de todos…')
      : vista ? 'Todavía no corrió nadie de este club.' : borrador ? 'Los tiempos del borrador quedan solo en este aparato.'
      : comunidad ? 'Todavía no hay tiempos. Corrila y compartila: acá aparecen todos los que la corren.'
      : 'Todavía no hay tiempos. Corré tu pasada y compartila: los de tus amigos aparecen acá cuando abrís sus links' + (o.clubes ? ', o solos si arman un club.' : '.');
    $('practicasTitulo').hidden = libre || practicas.length === 0;
    $('tablaPista').textContent = fijo ? '· ' + fijo.corto : comunidad ? '· ' + etapa.nombre : '#' + numero;
    // (si se esta mostrando un resultado, su tabla tambien se pone al dia: pueden haber llegado tiempos de los clubes)
    if (ultimo) { const todos = libre ? club.practicas() : club.tabla(); $('finRanking').hidden = todos.length < 2; pintarTabla($('finTabla'), todos); pintarContra(ultimo, ultimoMejoro); }
    ponerIconos();
  }

  // --- los clubes: arriba de la tabla, un boton por club (y "Todos"); el + arma uno nuevo ---
  const lista = (nombres) => (nombres.length < 2 ? nombres.join('') : nombres.slice(0, -1).join(', ') + ' y ' + nombres[nombres.length - 1]);
  // Las fichas de "de quien ver los tiempos": Todos, Amigos y un boton por club (sin servidor propio de lo libre: "Todos" son los que
  // se conocen). La misma lista va en el inicio y en el panel de la tabla; el + (armar un club) solo en el panel.
  function fichasDeVista(caja, mios, conMas) {
    caja.textContent = '';
    const ficha = (texto, valor) => {
      const si = vista === valor && !armando, b = crear('button', si ? 'elegido' : '', texto);
      b.type = 'button'; b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', si);
      b.addEventListener('click', () => { vista = valor; armando = false; aviso = ''; saliendo = 0; if (conTodos) club.gusto('vistaTabla', valor); pintar(); });
      caja.append(b);
    };
    if (conTodos) { ficha('Todos', TODOS); ficha('Amigos', ''); for (const c of mios) ficha(c.nombre, c.codigo); }
    else if (mios.length) { ficha('Todos', ''); for (const c of mios) ficha(c.nombre, c.codigo); }
    if (!conMas) return;
    // sin clubes, el boton lo dice con todas las letras; con clubes alcanza con el +
    const mas = crear('button', 'mas' + (armando ? ' elegido' : ''), mios.length ? undefined : ' Armar un club');
    mas.type = 'button'; mas.dataset.icono = 'mas'; mas.title = 'Armar un club'; mas.setAttribute('aria-label', 'Armar un club'); mas.setAttribute('aria-pressed', armando);
    mas.addEventListener('click', () => { armando = !armando; aviso = ''; saliendo = 0; pintar(); if (armando) $('clubNombre').focus(); });
    caja.append(mas);
  }
  function pintarClubes() {
    const caja = $('clubes'), mios = o.clubes ? club.clubes() : [];
    if (vista === TODOS ? !conTodos : vista && !mios.some((c) => c.codigo === vista)) vista = '';
    caja.hidden = !o.clubes;
    if (o.clubes) fichasDeVista(caja, mios, true);
    $('hoyVista').hidden = !conTodos;
    if (conTodos) fichasDeVista($('hoyVista'), mios, false);
    const info = vista && vista !== TODOS && o.clubes ? o.clubes.de(vista) : null, enClub = !!vista && vista !== TODOS && !armando;
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
      if (r.puesto) li.dataset.puesto = r.puesto;   // (en la tabla de todos el puesto no es el lugar en la lista: puede faltar un tramo)
      const quien = crear('span', 'quien', r.nombre || (r.mio ? 'Vos' : '?'));
      quien.append(crear('small', 'codigo-auto', codigoDe(r.auto)));   // (con que auto corrio: el codigo de sus partes)
      if (r.ayuda) quien.append(conAyuda());
      else if (r.serio) quien.append(conSerio());
      li.append(crear('span', 'emoji', configDe(r.auto).emoji), quien, crear('span', 'tiempoMarca', marcaDe(r)), cuadritos(r.c));
      // (un DNF no tiene fantasma para correrle: no termino, y si se cerro el juego en el medio, ni siquiera quedo grabado)
      if ((r.codigo || r.id) && !r.ab) {
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

  // La tabla de todos, entera: los primeros que mando el servidor y, si vos estas mas alla, un salto y tu puesto con los de alrededor.
  function pintarTodos(ol, t) {
    ol.classList.add('todos');
    const filas = t ? [...t.tabla] : [], ultimo = filas.length ? filas[filas.length - 1].puesto : 0;
    const mas = t ? (t.cerca.length ? t.cerca : t.yo ? [t.yo] : []).filter((x) => x.puesto > ultimo) : [];
    pintarTabla(ol, filas);
    if (mas.length) {
      if (mas[0].puesto > ultimo + 1) { const hueco = crear('li', 'hueco', '⋮'); hueco.dataset.puesto = ''; ol.append(hueco); }
      const parte = crear('ol'); pintarTabla(parte, mas);
      while (parte.firstChild) ol.append(parte.firstChild);
    }
  }

  // --- las cards del inicio: una por modo. Cada una muestra algo de los tiempos (los tuyos y los de tus amigos) y tiene su boton
  // para correr. Se pintan de nuevo cada vez que cambia algo (llegan tiempos de un club, se corre, se elige otro auto...). ---
  const koma = (n) => String(Math.round(n * 10) / 10).replace('.', ',');
  const sinTiempo = () => crear('span', 'tiempoMarca sin', '—');
  // una fila de tiempos: el puesto, el auto, quien es y su tiempo
  function filaTiempo(puesto, r, quien) {
    const li = crear('li', r.mio ? 'mio' : ''), nombre = crear('span', 'quien', quien || r.nombre || '?');
    nombre.append(crear('small', 'codigo-auto', codigoDe(r.auto)));
    if (r.ayuda) nombre.append(conAyuda()); else if (r.serio) nombre.append(conSerio());
    li.append(crear('i', '', puesto), crear('span', 'emoji', configDe(r.auto).emoji), nombre, crear('b', 'tiempoMarca', marcaDe(r)));
    return li;
  }
  const vacia = (icono, texto) => { const li = crear('li', 'vacio', texto); li.dataset.icono = icono; return li; };
  // La pista protagonista: la que esta cargada. Con sus tiempos abajo: los de tus amigos y clubes (en lo libre, sus mejores
  // tiempos en esa pista) y el tuyo.
  function pintarDia() {
    const n = numero, E = etapa;
    const largo = etapa.largo || 0;
    $('hoyTipo').textContent = fijo ? (fijo.real ? 'Circuito real' : 'Circuito') : borrador ? 'Borrador' : comunidad ? 'Pista de la comunidad' : n === hoy ? 'Pista del día' : 'Pista anterior';
    $('pistaNumero').textContent = libre ? '' : '#' + n;
    $('pistaFecha').textContent = libre ? (comunidad && comunidad.autor ? 'por ' + comunidad.autor : '') : fechaDe(n);
    $('pistaNombre').textContent = E.nombre;
    // (si la pista pasa por varios ambientes, se nombran todos: 🌾🌲⛰️ Campo, bosque y montaña)
    const varios = etapa.biomas && etapa.biomas.length > 1 ? etapa.biomas.map((b) => BIOMAS[b].nombre.toLowerCase()) : null;
    const ambiente = varios ? etapa.biomas.map((b) => BIOMAS[b].emoji).join('') + ' ' + (varios.slice(0, -1).join(', ') + ' y ' + varios[varios.length - 1]).replace(/^./, (l) => l.toUpperCase()) : BIOMAS[E.bioma].emoji + ' ' + BIOMAS[E.bioma].nombre;
    const datos = $('pistaDatos');
    datos.textContent = '';
    for (const txt of [ambiente, CLIMAS[E.clima].emoji + ' ' + CLIMAS[E.clima].nombre, largo ? (largo / 1000).toFixed(1).replace('.', ',') + ' km' : '', CARACTER[E.caracter] ? CARACTER[E.caracter].nombre : '']) if (txt) datos.append(crear('span', 'dato', txt));
    // los tiempos: los primeros de todos (o de tus amigos, o de un club, segun la ficha) y, aparte, el tuyo
    const ol = $('hoyTiempos'), deTodos = vista === TODOS && conTodos, t = deTodos && o.todos ? o.todos() : null;
    const tabla = libre ? club.practicas() : club.tabla(deTodos ? '' : vista);
    const mio = libre ? club.practica() : tabla.find((r) => r.mio);
    const puede = !libre && club.sePuedeOficial(), practica = libre ? mio : club.resumen(n).practica;
    ol.textContent = '';
    if (deTodos) {
      // el puesto de cada uno es el de la tabla de todos; el tuyo, aunque estes lejos, va abajo con tu puesto.
      // (tu fila lleva tus cuadraditos; los de los demas no, para no adelantar como es la pista antes de correrla)
      const primeros = t ? t.tabla.slice(0, 5) : [], yo = t && t.yo;
      for (const r of primeros) { const li = filaTiempo(String(r.puesto), r, r.mio ? 'Vos' : ''); if (r.mio && r.c) li.append(cuadritos(r.c)); ol.append(li); }
      if (!primeros.length) ol.append(vacia('podio', t ? 'Todavía no corrió nadie. ¡Sé el primero!' : 'Buscando la tabla de todos…'));
      if (yo && !primeros.some((r) => r.mio)) {
        if (yo.puesto > primeros.length + 1) ol.append(crear('li', 'hueco', '⋮'));
        const li = filaTiempo(String(yo.puesto), yo, 'Vos'); li.append(cuadritos(yo.c)); ol.append(li);
      } else if (!yo) {
        if (mio) { const li = filaTiempo('', mio, 'Vos'); if (mio.c) li.append(cuadritos(mio.c)); ol.append(li); }
        else if (puede) ol.append(vacia('bandera', 'Te falta tu pasada'));
        else ol.append(vacia('cono', practica ? 'Práctica ' + marcaDe(practica) : 'Sin pasada'));
        ol.lastChild.classList.add('mio');
      }
      $('hoyPuesto').hidden = !t || !t.total;
      $('hoyPuestoTexto').textContent = t && t.total ? (t.yo ? '#' + t.yo.puesto + ' de ' + t.total : t.total + (t.total === 1 ? ' corredor' : ' corredores')) : '';
    } else {
      const otros = tabla.filter((r) => !r.mio && !r.ab && r.t > 0).slice(0, 5);
      otros.forEach((r, k) => ol.append(filaTiempo(String(k + 1), r)));
      if (!otros.length) ol.append(vacia('podio', 'Sin tiempos de amigos'));
      if (mio) { const li = filaTiempo('', mio, 'Vos'); if (mio.c) li.append(cuadritos(mio.c)); ol.append(li); }
      else if (puede) ol.append(vacia('bandera', 'Te falta tu pasada'));
      else ol.append(vacia('cono', practica ? 'Práctica ' + marcaDe(practica) : 'Sin pasada'));
      ol.lastChild.classList.add('mio');
      $('hoyPuesto').hidden = true;
    }
    // la bandera a cuadros larga la pasada oficial; el cono, una practica
    const largar = libre || puede;
    rotular($('largar'), largar ? 'Largar' : 'Practicar');
    $('largar').dataset.icono = largar ? 'bandera' : 'cono';
    $('largar').dataset.n = n;
  }
  // los circuitos fijos: oficiales (la lista para elegir) o reales (con su descripcion corta). Cada fila, con tu mejor tiempo.
  function pintarCircuitos(ol, real) {
    ol.textContent = '';
    for (const c of CIRCUITOS.filter((x) => !!x.real === real)) {
      const res = club.resumen(c.numero).practica, a = crear('a', c.numero === numero ? 'aca' : '');
      a.href = location.pathname + '?c=' + c.id;
      a.dataset.largar = 'c'; a.dataset.n = c.numero;
      a.append(crear('span', 'emoji', c.emoji), crear('b', '', c.corto || c.nombre));
      if (real) a.append(crear('small', '', c.breve || c.detalle));
      if (res) a.append(crear('span', 'tiempoMarca', marcaDe(res)), cuadritos(res.c)); else a.append(sinTiempo());
      const li = crear('li');
      li.append(a);
      ol.append(li);
    }
  }
  // la Travesia no es una pista: su marca son los km del record, no un tiempo. Los records de los amigos (los de tus clubes y
  // los de los links que abriste): los tres primeros, y el tuyo aparte con su puesto. Sin fantasma: el camino es distinto cada vez.
  function pintarTravesia() {
    const record = Number(club.gusto('travesiaKm')) || 0, todos = club.travesiaTabla(), ol = $('catAventura');
    $('tvRecord').textContent = record > 0 ? koma(record) + ' km' : 'Sin récord';
    ol.textContent = '';
    const fila = (x) => {
      const li = crear('li', x.mio ? 'mio' : '');
      li.append(crear('i', '', String(todos.indexOf(x) + 1)), crear('span', 'emoji', x.auto ? configDe(x.auto).emoji : ''), crear('span', 'quien', x.mio ? 'Vos' : x.nombre || '?'), crear('b', 'tiempoMarca', koma(x.km) + ' km'));
      return li;
    };
    const amigos = todos.filter((x) => !x.mio).slice(0, 3);
    amigos.forEach((x) => ol.append(fila(x)));
    if (!amigos.length) ol.append(vacia('podio', 'Sin récords de amigos'));
    const mio = todos.find((x) => x.mio);
    if (mio) { const li = fila(mio); ol.append(li); }
  }
  function pintarTutorial() {
    const hecho = !!ajustes.leer('tutorial');   // (lo anota main.js al terminar o saltar el tutorial)
    $('tutDice').textContent = hecho ? 'Ya la hiciste. Repetila cuando quieras.' : 'Aprendé a manejar con el equipo.';
    rotular($('largarTutorial'), hecho ? 'Repetir' : 'Empezar');
    $('largarTutorial').dataset.icono = hecho ? 'volver' : 'bandera';
  }
  function pintarCards() {
    pintarDia();
    pintarCircuitos($('circuitos'), false);
    pintarCircuitos($('catReales'), true);
    pintarTravesia();
    pintarTutorial();
    pintarComunidad();
    for (const b of document.querySelectorAll('[data-largar]')) b.disabled = b.tagName === 'BUTTON' && !listo;
    ponerIconos($('home')); ponerIconos($('panel'));
  }
  // lo que va debajo de las cards: contra quien se corre, compartir y lo que hay que saber de la pista cargada. Solo se
  // muestra cuando la card del medio es la de esa pista.
  function pintarPie() {
    const aca = true, rival = o.rival();
    const oficial = libre ? club.practica() : club.oficial();
    $('desafio').hidden = !rival || !aca;
    if (rival) $('desafio').querySelector('span').textContent = 'Contra ' + rival.nombre + (rival.ab ? '' : ' · ' + tiempoFinal(rival.t));
    // compartir: el resultado propio (con su fantasma) o, en una pista de la comunidad que todavia no corriste, la pista
    $('compartirPortada').hidden = !aca || borrador || !((oficial && !oficial.corriendo && oficial.codigo) || (comunidad && o.clubes));
    $('editarPista').hidden = !aca || !borrador;
    // (el aviso del juego, por ejemplo un link viejo o una pista que ya no esta, se ve siempre; lo de la pista, solo en su card)
    $('queEs').textContent = [o.aviso, aca ? (T.vuelta ? 'Vuelta cerrada: das las que quieras y queda la mejor. Para terminar, salí con la X' + (window.matchMedia('(pointer: coarse)').matches ? '.' : ' o con Esc.') : borrador ? 'Borrador: todavía no la ve nadie más.' : '') : ''].filter(Boolean).join(' ');
  }

  // --- el resultado contra los de la tabla (tus amigos: los de los links que abriste y los de tus clubes; en una pista de la
  // comunidad, todos los que la corrieron): en que puesto quedaste y a cuanto del de adelante y del de atras. Va debajo del
  // tiempo, y se pinta de nuevo si llegan tiempos nuevos de los clubes. Devuelve { puesto, de, cuenta } (puesto 0: no hay con
  // quien comparar). Una practica en la pista del dia no cuenta: dice donde habria quedado; en lo libre, una pasada que no fue
  // la mejor tuya, donde queda ese tiempo.
  // Tu puesto entre todos ("37º de 412"), si esta pasada es tu oficial y el servidor ya la tiene (si no, no se dice nada). Devuelve el texto.
  const puestoGlobal = (r) => {
    const t = o.todos ? o.todos() : null, yo = t && t.yo;
    return !libre && !r.practica && !r.ab && yo && Math.abs(yo.t - r.t) < 0.02 ? { yo, t } : null;
  };
  function pintarGlobal(r) {
    const g = $('finTodos'), x = puestoGlobal(r);
    g.hidden = !x;
    if (!x) return;
    const { yo, t } = x, filas = [...t.tabla, ...t.cerca];
    const delante = filas.find((f) => f.puesto === yo.puesto - 1 && !f.ab);
    g.textContent = '';
    g.append(crear('b', '', yo.puesto === 1 ? '¡1º de ' + t.total + '!' : yo.puesto + 'º de ' + t.total), crear('span', '', yo.puesto === 1 ? 'Sos el más rápido de todos, por ahora.' : delante ? 'A ' + (r.t - delante.t).toFixed(2).replace('.', ',') + ' s de ' + (delante.nombre || '?') : 'Entre todos los que la corrieron'));
    g.classList.toggle('primero', yo.puesto === 1);
  }
  function pintarContra(r, mejoro) {
    pintarGlobal(r);
    const el = $('finAmigos'), otros = (libre ? club.practicas() : club.tabla()).filter((x) => !x.mio && !x.ab && x.t > 0);
    el.hidden = !!r.ab || !otros.length;
    if (el.hidden) return { puesto: 0, de: 0, cuenta: false };
    const ganaron = otros.filter((x) => x.t < r.t - 0.004).sort((a, b) => b.t - a.t);   // los que te ganaron: primero el mas cercano
    const perdieron = otros.filter((x) => x.t > r.t + 0.004).sort((a, b) => a.t - b.t);   // a los que les ganaste: primero el mas cercano
    const empate = otros.find((x) => Math.abs(x.t - r.t) <= 0.004);
    const puesto = ganaron.length + 1, de = otros.length + 1, cuenta = libre ? !!mejoro : !r.practica;
    const s = (d) => d.toFixed(2).replace('.', ',') + ' s', quien = (x) => x.nombre || '?';
    const amigos = puestoGlobal(r) ? ' amigos' : '';   // (si tambien se dice el puesto entre todos, este aclara que es entre amigos)
    const titulo = (cuenta ? '' : libre ? 'Con este tiempo, ' : 'Habrías quedado ') + (puesto === 1 && cuenta ? '¡1º de ' + de + amigos + '!' : puesto + 'º de ' + de + amigos);
    const cerca = [];
    if (ganaron.length) cerca.push('A ' + s(r.t - ganaron[0].t) + ' de ' + quien(ganaron[0]));
    if (empate) cerca.push('Empatado con ' + quien(empate));
    if (perdieron.length) cerca.push('Le sacás ' + s(perdieron[0].t - r.t) + ' a ' + quien(perdieron[0]));
    el.textContent = '';
    el.append(crear('b', '', titulo), crear('span', '', cerca.join(' · ')));
    el.classList.toggle('primero', puesto === 1 && cuenta);
    return { puesto, de, cuenta };
  }

  // --- las pistas de la comunidad: una fila por pista, con el club al que pertenece (una marca con su nombre), quien la
  // armo, lo que le queda y tu mejor tiempo ---
  // (conClub: si se marca de que club es; en la lista de un club no hace falta). Las propias llevan un tacho para borrarlas
  // (hay que tocarlo dos veces): cada uno puede tener cinco vigentes, y si quiere otra, borra una.
  // (el tacho que se toco una vez: queda preguntando unos segundos, aunque la lista se vuelva a pintar; y lo que salio mal)
  let porBorrar = { numero: 0, desde: 0, error: '' };
  const preguntando = (n) => porBorrar.numero === n && !porBorrar.error && performance.now() - porBorrar.desde < 6000;
  const repintarPistas = () => { pintarComunidad(); pintar(); };
  // (correr: en el inicio, tocar una fila corre esa pista en vez de abrir su link)
  function pintarPistas(ol, pistas, conClub, correr) {
    ol.textContent = '';
    const mias = new Set(club.pistas().filter((x) => x.mia).map((x) => x.numero));
    for (const p of pistas) {
      const a = crear('a', p.numero === numero ? 'aca' : ''), res = club.resumen(p.numero).practica, mia = p.mia || mias.has(p.numero), pregunta = preguntando(p.numero);
      const ruta = location.pathname + '?pista=' + p.numero + '-' + (p.version || p.v);
      a.href = (o.direccion || String)(ruta);
      if (correr) { a.dataset.largar = 'c'; a.dataset.n = p.numero; a.dataset.dir = (o.direccion || String)(ruta); }
      const detalle = crear('small'), error = porBorrar.numero === p.numero && porBorrar.error;
      // (la pregunta del tacho y lo que salio mal van enteros, aunque ocupen mas de un renglon)
      if (pregunta || error) { detalle.className = 'pregunta'; detalle.textContent = pregunta ? '¿Borrarla? Se van también sus tiempos. Tocá de nuevo el tacho.' : error; }
      else {
        if (conClub && p.club) { const m = crear('span', 'marca-club', p.clubNombre || 'Club'); m.dataset.icono = 'podio'; m.title = 'Del club ' + (p.clubNombre || ''); detalle.append(m, ' '); }
        detalle.append([mia ? 'por vos' : p.autor ? 'por ' + p.autor : '', quedan(p.vence)].filter(Boolean).join(' · '));
      }
      a.append(crear('span', 'emoji', EMOJI_COMUNIDAD), crear('b', '', p.nombre), detalle);
      if (res) a.append(crear('span', 'tiempoMarca', marcaDe(res)), cuadritos(res.c));
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
    const pistas = club.pistas(), ol = $('comunidad');
    pintarPistas(ol, pistas, true, true);
    // el borrador del creador (se prueba desde ahi): no esta en la lista, y es lo que hay cargado
    if (borrador) {
      const a = crear('a', 'aca'), li = crear('li');
      a.href = location.pathname + '?pista=borrador'; a.dataset.largar = 'c'; a.dataset.n = numero;
      a.append(crear('span', 'emoji', EMOJI_COMUNIDAD), crear('b', '', 'Tu borrador'), crear('small', '', etapa.nombre));
      const res = club.resumen(numero).practica;
      if (res) a.append(crear('span', 'tiempoMarca', marcaDe(res)), cuadritos(res.c));
      li.append(a);
      ol.prepend(li);
      ponerIconos(ol);
    }
    $('comunidadVacia').hidden = pistas.length > 0 || borrador;
    $('armarPista').hidden = !o.armar || !o.clubes;   // (sin servidor no hay donde publicarla)
  }

  // --- pistas pasadas ---
  function pintarPasadas() {
    const ol = $('pasadas');
    ol.textContent = '';
    for (let n = hoy; n >= Math.max(1, hoy - 60); n--) {
      const d = datosDelDia(n), res = club.resumen(n), a = crear('a', n === numero ? 'aca' : '');
      a.href = n === hoy ? location.pathname : location.pathname + '?p=' + n;
      a.dataset.largar = 'c'; a.dataset.n = n;   // (tocarla la larga directo: ver los botones de correr)
      a.append(crear('b', '', '#' + n), crear('span', 'emoji', CLIMAS[d.clima].emoji + BIOMAS[d.bioma].emoji), crear('span', 'quien', d.nombre), crear('small', '', n === hoy ? 'hoy' : n === hoy - 1 ? 'ayer' : fechaDe(n)));
      if (res.oficial) a.append(crear('span', 'tiempoMarca', marcaDe(res.oficial)), cuadritos(res.oficial.c));
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
  // lo mismo con la guia de la Travesia
  $('verGuiaTravesia').addEventListener('click', () => { abrir(''); if (o.guiaTravesia) o.guiaTravesia(); });
  const dib = (nombre, color) => '<span data-icono="' + nombre + '"' + (color ? ' data-color="' + color + '"' : '') + '></span>';
  $('comoSeJuega').innerHTML = `
    <dl class="teclas teclado">
      <div><dt><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> o las flechas</dt><dd>manejar</dd></div>
      <div><dt><kbd>Espacio</kbd></dt><dd>freno de mano</dd></div>
      <div><dt><kbd>R</kbd> ${dib('volver')}</dt><dd>volver al camino (suma 8 segundos)</dd></div>
      <div><dt><kbd>C</kbd> ${dib('camara')}</dt><dd>cámara: aérea, de atrás o desde arriba</dd></div>
      <div><dt><kbd>M</kbd> ${dib('sonido')} <kbd>N</kbd> ${dib('musica')} <kbd>V</kbd> ${dib('voz')}</dt><dd>sonido, música y voz del copiloto</dd></div>
      <div><dt><kbd>T</kbd> ${dib('trazada')}</dt><dd>trazada: la línea para seguir</dd></div>
    </dl>
    <dl class="teclas dedos">
      <div><dt>Inclinar el celu</dt><dd>doblar</dd></div>
      <div><dt>${dib('arriba', '#f2c200')}</dt><dd>acelerar</dd></div>
      <div><dt>${dib('abajo')}</dt><dd>frenar y marcha atrás</dd></div>
      <div><dt>${dib('mano')}</dt><dd>freno de mano</dd></div>
      <div><dt>${dib('volver')}</dt><dd>volver al camino (suma 8 segundos)</dd></div>
      <div><dt>${dib('camara')}</dt><dd>cámara: aérea, de atrás o desde arriba</dd></div>
      <div><dt>${dib('sonido')}${dib('musica')}${dib('voz')}</dt><dd>sonido, música y voz del copiloto</dd></div>
    </dl>
    <p>${dib('bandera')} larga la pasada oficial: una sola por día. ${dib('cono')} es práctica: no cuenta para la tabla.</p>
    <p>${dib('circuito')} Además de la pista del día hay circuitos fijos, para correr las veces que quieras: una subida y una bajada de montaña, un callejero por el pueblo y una vuelta cerrada para practicar, donde das las vueltas que quieras. Queda guardado tu mejor tiempo.</p>
    <p class="con-servidor">${dib('lapiz')} Ahí también están las pistas de la comunidad: las arma la gente en el creador, nota por nota, como las canta el copiloto. Duran dos semanas y se comparten con un link. Si la armás para un club, aparece en el club y la corren todos sus miembros.</p>
    <p>Cada pista tiene cinco sectores. Al final, cada uno queda <b class="verde">verde</b>, <b class="amarillo">amarillo</b> o <b class="rojo">rojo</b> según cuánto tardaste contra el tiempo de referencia. Si tuviste que volver al camino, ese sector es rojo.</p>
    <p>Los números de las notas van del 1 (curva muy cerrada) al 6 (casi recta). H es una horquilla y 90, una esquina.</p>
    <p>${dib('motor')} Tu auto se arma en el garaje (tocalo en la portada): un motor, un chasis y unas ruedas, cinco de cada uno. Ninguna combinación es la mejor para todo: más motor patina más, el buggy dobla rápido pero se rompe fácil, las ruedas de barro resbalan en el asfalto. Su código (por ejemplo, 431: el 4to motor, el 3er chasis y las primeras ruedas) va en tus links y en la tabla, y tu fantasma es tu auto.</p>
    <p>Los golpes rompen el auto. Si se rompe del todo, abandonás: en la tabla figurás con DNF (no terminó). Lo mismo si cerrás el juego en plena pasada oficial. Las piedras que están pegadas al camino llevan una antorcha roja.</p>
    <p>${dib('fantasma')} En la tabla, el fantasma elige contra quién corrés. Si te mandan un link, corrés contra quien te lo mandó.</p>
    <p class="con-servidor">${dib('podio')} En la tabla también se arman clubes: le ponés un nombre, invitás con un link, y el que lo abre queda adentro. La pasada oficial de cada uno aparece sola en la tabla de todos sus clubes. Es que al terminar, tu tiempo se guarda solo en el servidor del juego, con el nombre que elijas (no se pide ningún otro dato): no hace falta compartirlo.</p>
    <p>${dib('ajustes')} En la configuración se cambian la distancia de la cámara y, en el celular, la sensibilidad al inclinar y el tamaño de los pedales.</p>
    <p>${dib('trazada')} Ahí también se prende la trazada: una línea pintada en el camino que muestra por dónde pasar. Está <b class="verde">verde</b> donde podés acelerar, <b class="amarillo">amarilla</b> donde venís justo y <b class="rojo">roja</b> donde venís pasado: cuando el rojo llega al auto, hay que frenar.</p>
    <p>${dib('salvavidas')} Si recién arrancás, prendé la ayuda de manejo: el auto sigue solo la trazada, frena antes de las curvas y se cruza menos. Vos acelerás y corregís con el volante. Es más lento, pero llegás.</p>`;

  for (const el of document.querySelectorAll('.con-servidor')) el.hidden = !o.clubes;   // (lo de los clubes, solo si hay servidor)

  // --- la configuracion ---
  // Cada grupo de botones y cada barra dice que gusto cambia (data-ajuste). "si" y "no" valen verdadero y falso;
  // lo demas son numeros o palabras ("Píxeles": nada, medio, fuerte). La barra de la camara va en porcentaje (100 = la distancia normal).
  const leerValor = (txt) => (txt === 'si' ? true : txt === 'no' ? false : isNaN(Number(txt)) ? txt : Number(txt));   // ("si", "no", un numero, o una palabra como "medio")
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
  // --- las ofertas del final de una pasada: el rally serio (si fue muy buena) y la ayuda de manejo (si fue muy mala) ---
  // Un cartel corto con un boton, que no se repite siempre: cada oferta se vuelve a hacer despues de ENTRE_OFERTAS pasadas,
  // y si alguien dice "No, gracias", no se le vuelve a ofrecer. Se anota en el aparato (gusto "ofertas").
  const ENTRE_OFERTAS = 5;
  const ofertas = () => club.gusto('ofertas') || { pasadas: 0 };
  const anotarOferta = (cambio) => club.gusto('ofertas', { ...ofertas(), ...cambio });
  const puedeOfrecer = (cual) => { const o = ofertas(), v = o[cual]; return !v || (!v.no && o.pasadas - v.vista >= ENTRE_OFERTAS); };
  const ofrecida = (cual) => { const o = ofertas(); anotarOferta({ [cual]: { ...(o[cual] || {}), vista: o.pasadas } }); };
  const rechazada = (cual) => { const o = ofertas(); anotarOferta({ [cual]: { vista: o.pasadas, no: true } }); };
  // "muy buena": sin salidas, todos los sectores verdes y cerca de la referencia (o mejor que ella por bastante)
  const fueMuyRapida = (r) => !r.ab && !r.vueltas && (r.t <= ref.total * 0.97 || ([...r.c].every((x) => x === 'v') && r.t <= ref.total * 1.12));
  const fueMuyLenta = (r) => r.ab === 'roto' || r.vueltas >= 2 || (!r.ab && r.t > ref.total * 1.6);
  $('probarAyuda').addEventListener('click', () => {
    ajustes.poner('ayuda', true);
    $('finAyuda').firstElementChild.textContent = 'Listo: la próxima pasada va con ayuda de manejo.';
    $('probarAyuda').hidden = $('noAyuda').hidden = true;
  });
  $('noAyuda').addEventListener('click', () => { rechazada('ayuda'); $('finAyuda').hidden = true; });
  $('probarSerio').addEventListener('click', () => {
    ajustes.poner('serio', true);   // (apaga la ayuda, si estaba)
    $('finSerio').firstElementChild.textContent = 'Listo: la próxima pasada va en modo rally serio.';
    $('probarSerio').hidden = $('noSerio').hidden = true;
  });
  $('noSerio').addEventListener('click', () => { rechazada('serio'); $('finSerio').hidden = true; });

  // --- paneles ---
  // (cada panel es el div "panel" + su nombre con la primera en mayuscula: panelTabla, panelPasadas, panelCircuitos...)
  const PANELES = ['tabla', 'pasadas', 'ayuda', 'ajustes', 'garaje', ...MODOS.filter((m) => m !== 'pasadas')];
  const idDe = (nombre) => 'panel' + nombre[0].toUpperCase() + nombre.slice(1);
  function abrir(cual) {
    for (const nombre of PANELES) $(idDe(nombre)).hidden = nombre !== cual;
    $('home').dataset.card = MODOS.includes(cual) ? cual : 'hoy';   // (cual modo esta abierto: para las pruebas y el estilo)
    // el garaje: la vitrina dibuja solo mientras esta abierto
    if (cual === 'garaje') { if (!vitrina) { vitrina = crearVitrina($('vitrina')); } pintarGaraje(); }
    if (vitrina) vitrina.prender(cual === 'garaje');
    if (cual === 'pasadas') pintarPasadas();
    // en el celular, al abrir la configuracion se prende el sensor (si lo hay) para poder probar la sensibilidad
    if (cual === 'ajustes') { pintarAjustes(); if (window.matchMedia('(pointer: coarse)').matches) ajustes.probar(); }
    // al abrir la tabla se le piden al servidor los tiempos de los clubes (si paso un rato desde la ultima vez)
    if (cual === 'tabla') { if (o.clubes) o.clubes.refrescar(); } else { armando = false; saliendo = 0; aviso = ''; }
    $('panel').hidden = !cual;
    if (cual) $('cerrarPanel').focus();
  }
  for (const b of document.querySelectorAll('[data-panel]')) b.addEventListener('click', () => abrir(b.dataset.panel));
  $('cerrarPanel').addEventListener('click', () => abrir(''));
  // desde el resultado del borrador: vuelve al inicio y abre el creador (en lo demas, "Volver" ya lleva al inicio)
  $('irCircuitos').addEventListener('click', () => { $('salir').click(); if (borrador) o.armar(); });
  // el creador de pistas: desde los circuitos, desde un club (la pista queda para ese club) y, en el borrador, desde la portada
  const armar = (codigo) => { abrir(''); o.armar(codigo); };
  $('armarPista').addEventListener('click', () => armar());
  $('clubArmar').addEventListener('click', () => armar(vista));
  $('editarPista').addEventListener('click', () => armar());

  // --- los botones de correr (el de la pista de hoy y los de las listas de los paneles) ---
  // Tocar uno corre ese modo: si la pista ya esta cargada, empieza; si no, main.js la carga y arranca sola.
  // El inicio abre siempre con la pista cargada; solo cuando llega un link de otro modo (Travesia) se abre ese panel.
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-largar]');
    if (!b || $('portada').hidden) return;
    e.preventDefault();
    if (!listo || b.disabled) return;
    const que = b.dataset.largar;
    if (que === 'travesia') o.travesia();
    else if (que === 'tutorial') o.tutorial();
    else {
      const q = b.querySelector('.quien') || b.querySelector('b:not(.tiempoMarca)') || $('pistaNombre');
      o.correr(Number(b.dataset.n), b.dataset.dir || '', q ? q.textContent.trim() : '');
    }
  });
  $('verGuiaTravesiaCard').addEventListener('click', () => o.guiaTravesia && o.guiaTravesia());

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
  // una pista de la comunidad, sin resultado: su nombre firmado por quien la armo, y su link
  //   Shakedown · Pista «La Curva del Tero» por Juanma 📝 ¿Quién la hace más rápido?
  async function compartirPista(salida) {
    await pasar('Shakedown · ' + firmada(etapa.nombre, comunidad.autor) + ' ' + EMOJI_COMUNIDAD + ' ¿Quién la hace más rápido?\n' + conAviso(o.linkDeLaPista()), (texto) => { if (salida) salida.textContent = texto; }, 'Copiado. Pegalo en el grupo.');
  }
  async function compartir(r, salida) {
    if (!club.nombre()) { $('nombre').focus(); if (salida) salida.textContent = 'Poné tu nombre para compartir.'; return; }
    const codigo = r.codigo || (linkDe && await linkDe());
    // el link lleva el codigo corto con el que la pasada quedo en el servidor; si no hay servidor, la pasada entera
    const final = codigo ? await o.acortar(r, codigo) : '';
    // tres renglones: el resultado, el link y que el juego esta en desarrollo
    // (el primer renglon es siempre el de siempre; si ya se sabe el puesto entre todos, va en otro renglon, antes del link)
    const g = puestoGlobal(r), puesto = g ? '\n🏆 ' + g.yo.puesto + 'º de ' + g.t.total : '';
    await pasar(mensaje(etapa, r, comunidad && comunidad.autor) + puesto + '\n' + conAviso(location.origin + location.pathname + (final ? '#r=' + final : '')), (texto) => { if (salida) salida.textContent = texto; }, 'Copiado. Pegalo en el grupo.');
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

  // --- el nombre antes de la pasada oficial ---
  // La oficial va a la tabla de todos, asi que no larga sin nombre. Se pide en un cartel simple con uno sugerido (de rally) que se
  // acepta de un toque; "Otro nombre" sortea otro. Las practicas, los circuitos y la Travesia no lo piden.
  const APODOS = ['Barro Rojo', 'Pata de Cabra', 'Don Ripio', 'Tero Veloz', 'Polvareda', 'Chispa', 'El Zorro', 'Cuesta Arriba', 'Doña Cuneta', 'Rueda Libre', 'Chapa y Barro', 'Pisa y Corre', 'Vizcachita', 'Mate Cocido', 'Capó Abierto', 'Freno de Mano'];
  const sugerido = () => (Math.random() < 0.4 ? 'Piloto ' + (100 + Math.floor(Math.random() * 900)) : APODOS[Math.floor(Math.random() * APODOS.length)]);
  let despuesDelNombre = null;
  const cerrarCartel = () => { $('cartelNombre').hidden = true; despuesDelNombre = null; };
  $('cartelNombreForm').addEventListener('submit', (e) => {
    e.preventDefault();
    ponerNombre($('cartelNombreCampo').value);
    if (!club.nombre()) { $('cartelNombreCampo').value = sugerido(); return; }   // (escribio solo espacios: se le propone uno)
    const seguir = despuesDelNombre;
    cerrarCartel();
    if (seguir) seguir();
  });
  $('cartelNombreOtro').addEventListener('click', () => { $('cartelNombreCampo').value = sugerido(); $('cartelNombreCampo').focus(); });
  $('cartelNombreVolver').addEventListener('click', cerrarCartel);
  $('cartelNombre').addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); cerrarCartel(); } });
  // ver la tabla de todos entera, desde el inicio
  $('hoyVerTodos').addEventListener('click', () => { vista = TODOS; abrir('tabla'); pintar(); });
  $('clubApodo').addEventListener('submit', (e) => { e.preventDefault(); ponerNombre($('clubMiNombre').value); if (!club.nombre()) $('clubMiNombre').focus(); });
  $('nombre').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('nombre').blur(); });

  return {
    pintar,
    // pide el nombre (con uno sugerido) y despues sigue con "siguiente"
    pedirNombre: (siguiente) => {
      despuesDelNombre = siguiente;
      $('cartelNombreCampo').value = sugerido();
      $('cartelNombre').hidden = false;
      ponerIconos($('cartelNombre'));
      $('cartelNombreCampo').focus(); $('cartelNombreCampo').select();
    },
    portada: (si) => { $('portada').hidden = !si; if (!si) abrir(''); else pintar(); },
    // el juego ya armo todo: se pueden apretar los botones de correr, y el inicio se muestra con la card que corresponde
    listo: () => { listo = true; pintar(); },
    // abre el panel de un modo (por ejemplo el de la Travesia, cuando llega un link de un amigo)
    verCard: (clave) => abrir(MODOS.includes(clave) ? clave : ''),
    acomodar: () => {},
    // Enter: aprieta el boton principal (el de largar de la pista cargada)
    principal: () => { const b = $('largar'); if (b && !b.disabled) b.click(); },
    enfocar: () => { const b = $('largar'); if (b && !b.hidden) b.focus({ preventScroll: true }); },
    // Muestra el resultado de una pasada. r: el resultado. armarLink: funcion que devuelve el codigo del link (con el fantasma).
    // mejoro: true si es tu mejor tiempo en esa pista (para las practicas y los circuitos).
    // Devuelve como quedaste contra los de la tabla: { puesto, de, cuenta } (ver pintarContra).
    fin: (r, armarLink, mejoro) => {
      ultimo = r; linkDe = armarLink; ultimoMejoro = !!mejoro;
      $('finTipo').textContent = (fijo ? 'Circuito · ' : borrador ? 'Borrador · ' : comunidad ? 'Pista de la comunidad · ' : (r.practica ? 'Práctica' : 'Pasada oficial') + ' · #' + numero + ' ') + etapa.nombre + (mejoro ? (T.vuelta ? ' · ¡tu mejor vuelta!' : ' · ¡tu mejor tiempo!') : '');
      $('finTitulo').textContent = r.ab ? ABANDONO[r.ab] || 'Abandono' : '';
      $('finTitulo').hidden = !r.ab;
      $('finGrande').textContent = marcaDe(r);
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
        + (r.vueltas ? (r.vueltas === 1 ? 'Volviste al camino una vez (+8 s). ' : 'Volviste al camino ' + r.vueltas + ' veces (+' + r.vueltas * 8 + ' s). ') : '') + 'Referencia ' + tiempoFinal(ref.total) + '.' + (r.ayuda ? ' Con ayuda de manejo.' : r.serio ? ' En modo rally serio.' : '');
      // Las ofertas (una sola por pasada, y no en cada una): muy buena sin el rally serio, se ofrece el rally serio; muy mala sin ayuda, la ayuda.
      // (una pasada de practica en la pista del dia tambien cuenta; el borrador no)
      const o = ofertas();
      if (!borrador) anotarOferta({ pasadas: o.pasadas + 1 });
      const sinOferta = borrador || !!r.ayuda || !!r.serio;
      const verSerio = !sinOferta && !ajustes.leer('serio') && !ajustes.leer('ayuda') && fueMuyRapida(r) && puedeOfrecer('serio');
      const verAyuda = !sinOferta && !verSerio && !ajustes.leer('ayuda') && !ajustes.leer('serio') && fueMuyLenta(r) && puedeOfrecer('ayuda');
      $('finSerio').hidden = !verSerio; $('finAyuda').hidden = !verAyuda;
      if (verSerio) { ofrecida('serio'); $('finSerio').firstElementChild.textContent = '¡Vas muy bien!'; $('probarSerio').hidden = $('noSerio').hidden = false; }
      if (verAyuda) { ofrecida('ayuda'); $('finAyuda').firstElementChild.textContent = '¿Se complicó?'; $('probarAyuda').hidden = $('noAyuda').hidden = false; }
      $('nombre').value = club.nombre();
      $('compartido').textContent = '';
      $('finGuardado').hidden = true;   // (main.js dice enseguida si se esta guardando: ver "guardado")
      $('social').hidden = borrador;   // (el borrador no se comparte: todavia no existe para los demas)
      const tabla = libre ? club.practicas() : club.tabla();
      $('finRanking').hidden = tabla.length < 2;
      pintarTabla($('finTabla'), tabla);
      rotular($('otra'), libre ? 'Otra vez' : 'Practicar');
      $('otra').dataset.icono = libre ? 'bandera' : 'cono';
      $('irCircuitos').hidden = !borrador;
      rotular($('irCircuitos'), 'Seguir armando');
      $('irCircuitos').dataset.icono = 'lapiz';
      const contra = pintarContra(r, mejoro);
      $('fin').hidden = false;
      ponerIconos();
      return contra;
    },
    cerrarFin: () => { $('fin').hidden = true; ultimo = null; },
    // Si el resultado que esta en pantalla quedo guardado en el servidor, y en que tabla se ve. estado: 'subiendo', 'listo',
    // 'pendiente' (no hubo señal: se guarda solo cuando vuelva) o '' / 'no' (no se dice nada: no va a ninguna tabla, o el
    // servidor no lo quiso). Sin club, tu tiempo queda guardado pero tus amigos lo ven si se lo compartis.
    guardado: (estado) => {
      const el = $('finGuardado');
      el.hidden = !ultimo || !estado || estado === 'no';
      if (el.hidden) return;
      const clubes = club.clubes(), sinNombre = !club.nombre();
      el.textContent = '';
      el.classList.toggle('listo', estado === 'listo');
      if (estado === 'listo') { const i = crear('span'); i.dataset.icono = 'ok'; el.append(i); }
      el.append(estado === 'subiendo' ? 'Guardando tu tiempo…'
        : estado === 'pendiente' ? 'Sin conexión: tu tiempo se guarda solo cuando vuelva.'
        : (comunidad || clubes.length) && sinNombre ? 'Guardado. Poné tu nombre para que figure en la tabla.'
        : comunidad ? 'Guardado en la tabla de la pista.'
        : conTodos && !libre && ultimo && !ultimo.practica ? 'Guardado en la tabla de todos' + (clubes.length === 1 ? ' y en la de «' + clubes[0].nombre + '».' : clubes.length ? ' y en las de tus clubes.' : '.')
        : clubes.length === 1 ? 'Guardado en la tabla de «' + clubes[0].nombre + '».'
        : clubes.length ? 'Guardado en las tablas de tus clubes.'
        : 'Guardado. Compartilo para que lo vean tus amigos.');
      ponerIconos(el);
    },
    // dice algo en la portada, abajo del boton de largar (queda hasta que se cierre el juego)
    decir: (texto) => { o.aviso = texto; pintar(); },
    // abre la tabla en un club, con un aviso (por ejemplo, al entrar por una invitacion)
    verClub: (codigo, texto) => { vista = codigo; armando = false; aviso = texto || ''; if ($('fin').hidden && !$('portada').hidden) abrir('tabla'); pintar(); },
    // (en la configuracion) muestra el volante en vivo: v es la inclinacion, de -1 a 1, o null si no hay sensor
    prueba: (v) => { if (!$('panelAjustes').hidden && v !== null) $('pruebaVolante').style.left = (50 + v * 50).toFixed(1) + '%'; },
  };
}

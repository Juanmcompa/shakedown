// El creador de pistas: se arma una pista de la comunidad nota por nota, como las cantaria el copiloto. No hay mapa: se
// eligen las notas (curvas, rectas, cosas del camino y lo que va al costado) y el camino sale solo (ver hoja.js).
// Leo, el ingeniero de pista, va diciendo que pasa: si una nota no entra, cuanto falta para poder correrla.
// Las notas que no entran como siguiente se ven apagadas (se calcula despues de cada cambio).
// Lo que se va armando queda guardado en el aparato (el borrador, ver club.js): se puede cerrar y seguir otro dia.
// "Probar" corre el borrador (?pista=borrador). "Publicar" lo sube al servidor: dura dos semanas, se comparte con un link
// y, si se eligio un club, aparece en la lista de pistas de ese club. Cada uno puede tener cinco publicadas a la vez: abajo
// estan las propias, con un tacho para borrar alguna y hacer lugar.
// (El HTML esta en index.html, en la seccion "creador".)
import { BIOMAS, CLIMAS } from './generador.js';
import { COMUNIDAD } from './circuitos.js';
import { PIEZAS, TOPES, VERSION_DE_HOJA, HORAS_DE_HOJA, armarHoja, leerHoja, sePuede, esAjuste } from './hoja.js';
import { iconoDeNota, textoDeNota, icono, ponerIconos } from './iconos.js';

const $ = (id) => document.getElementById(id);
const crear = (etiqueta, clase, texto) => { const el = document.createElement(etiqueta); if (clase) el.className = clase; if (texto !== undefined) el.textContent = texto; return el; };
const km = (m) => (m / 1000).toFixed(1).replace('.', ',') + ' km';
const metros = (m) => (m >= 1000 ? km(m) : Math.ceil(m / 10) * 10 + ' m');

// los botones de las notas, por grupo y en filas (las curvas: una fila para cada lado)
const GRUPOS = [
  { id: 'crCurvas', filas: [['i6', 'i5', 'i4', 'i3', 'i2', 'i1', 'ih', 'ie'], ['d6', 'd5', 'd4', 'd3', 'd2', 'd1', 'dh', 'de']] },
  { id: 'crCamino', filas: [['r1', 'r2', 'r3', 'sa', 'va', 'pu', 'ba', 'an', 'lo', 'pb', 'co', 'la']] },
  { id: 'crCostado', filas: [['ge', 'pi', 'cn', 'fa']] },
  // como es el camino de ahi en adelante: tipo, ancho, deformacion y relieve (una fila para cada cosa)
  { id: 'crAjustes', filas: [['Th', 'Tc', 'Tr', 'Tu', 'Tb', 'Tp'], ['A1', 'A2', 'A3', 'A4', 'A5'], ['Z0', 'Z1', 'Z2', 'Z3', 'Z4'], ['L0', 'L1', 'L2', 'L3']] },
];
// la hora del dia (solo es la luz): su emoji y su nombre
const HORA_DE = { manana: ['🌅', 'Mañana'], mediodia: ['☀️', 'Mediodía'], tarde: ['🌇', 'Tarde'], atardecer: ['🌆', 'Atardecer'], noche: ['🌙', 'Noche'] };
// lo que dice cada boton debajo del dibujo (las curvas, su numero: 6, 5... H, 90)
const ROTULO = { r1: '50', r2: '100', r3: '180', Th: 'bosque', Tc: 'campo', Tr: 'ripio', Tu: 'ruta', Tb: 'barro', Tp: 'pasto', A1: '1', A2: '2', A3: '3', A4: '4', A5: '5', Z0: '0', Z1: '1', Z2: '2', Z3: '3', Z4: '4', L0: '0', L1: '1', L2: '2', L3: '3', sa: 'salto', va: 'vado', pu: 'puente', ba: 'barro', an: 'angosto', lo: 'lomo', pb: 'pueblo', co: 'cornisa', la: 'lajas', ge: 'público', pi: 'piedras', cn: 'conos', fa: 'fardos' };
const rotuloDe = (id) => ROTULO[id] || textoDeNota(PIEZAS[id].nota);
const esAjusteId = (id) => esAjuste(id);
const dibujoDe = (id) => (PIEZAS[id].nota ? iconoDeNota(PIEZAS[id].nota) : icono(PIEZAS[id].icono));
const esObjeto = (id) => PIEZAS[id].grupo === 'objetos';
const nueva = () => ({ v: VERSION_DE_HOJA, a: 'bosque', c: 'sol', p: [] });

// o: { club, nube, enElBorrador (si lo que se esta corriendo es el borrador), probar() (corre el borrador),
//      publicada(p) (se publico: p es lo que contesto el servidor), renombrar() (se cambio el nombre del corredor),
//      borrarPista(numero) (borra una pista propia: promesa de { borrada } o { error }) }
export function crearCreador(o) {
  const { club } = o, raiz = $('creador');
  let hoja = nueva(), nombre = '', para = '';
  let armado = armarHoja(hoja);   // lo que da la hoja entera (largo, o el error)
  let dice = '';                  // lo que dice Leo, si hay algo que avisar (si no, dice lo que corresponde)
  let turno = 0, ocupado = false, alAbrir = '', borrando = 0, listo = false;
  const botones = {};

  // --- lo que se arma una sola vez: los botones del ambiente, del clima y de las notas ---
  function prepararse() {
    if (listo) return;
    listo = true;
    const opcion = (caja, texto, titulo, alTocar) => {
      const b = crear('button', '', texto);
      b.type = 'button'; b.setAttribute('role', 'radio'); b.title = titulo; b.setAttribute('aria-label', titulo);
      b.addEventListener('click', alTocar);
      caja.append(b);
      return b;
    };
    for (const id in BIOMAS) if (!BIOMAS[id].fijo) opcion($('crAmbiente'), BIOMAS[id].emoji, BIOMAS[id].nombre, () => elegirAmbiente(id)).dataset.valor = id;
    for (const id in CLIMAS) if (id !== 'noche') opcion($('crClima'), CLIMAS[id].emoji, CLIMAS[id].nombre, () => { hoja = { ...hoja, c: id }; dice = ''; cambio(); }).dataset.valor = id;
    for (const h of HORAS_DE_HOJA) opcion($('crHora'), HORA_DE[h][0], HORA_DE[h][1], () => { const { h: _, ...sin } = hoja; hoja = hoja.h === h ? sin : { ...hoja, h }; dice = ''; cambio(); }).dataset.valor = h;
    for (const g of GRUPOS) {
      const caja = $(g.id);
      for (const fila of g.filas) {
        const f = crear('div', 'cr-fila');
        for (const id of fila) {
          const b = crear('button', 'cr-pieza'), img = crear('img', 'icono');
          b.type = 'button'; b.dataset.pieza = id; b.title = PIEZAS[id].nombre; b.setAttribute('aria-label', PIEZAS[id].nombre);
          img.src = dibujoDe(id); img.alt = ''; img.draggable = false;
          b.append(img, crear('small', '', rotuloDe(id)));
          b.addEventListener('click', () => tocar(id));
          botones[id] = b;
          f.append(b);
        }
        caja.append(f);
      }
    }
    $('crBorrar').addEventListener('click', borrarUltima);
    $('crNombre').addEventListener('input', () => { nombre = $('crNombre').value; guardar(); });
    $('crApodo').addEventListener('change', () => { club.ponerNombre($('crApodo').value); $('crApodo').value = club.nombre(); if (o.renombrar) o.renombrar(); pintar(); });
    $('crProbar').addEventListener('click', probar);
    $('crPublicar').addEventListener('click', publicar);
    $('crDeCero').addEventListener('click', deCero);
    $('crCerrar').addEventListener('click', cerrar);
    for (const id of ['crNombre', 'crApodo']) $(id).addEventListener('keydown', (e) => { if (e.key === 'Enter') e.target.blur(); });
    ponerIconos(raiz);
  }

  // --- cuentas ---
  const deCamino = () => hoja.p.filter((id) => !esObjeto(id) && !esAjuste(id)).length;
  const largo = () => (armado && armado.largo) || 0;
  const sePuedeCorrer = () => armado && !armado.error;

  // Lo que dice Leo: lo ultimo que paso si hay algo que avisar; si no, como viene la pista.
  function loQueDice() {
    if (dice) return dice;
    if (!hoja.p.length) return 'Elegí las notas como te las cantaría el copiloto, de la largada a la llegada. El camino sale solo.';
    if (!sePuedeCorrer()) return 'Seguí sumando: le faltan ' + metros(TOPES.minimo - largo()) + ' para poder correrla.';
    return 'Ya se puede correr. Probala, o publicala para que la corran tus amigos.';
  }

  // --- pintar ---
  function pintar() {
    for (const b of $('crAmbiente').children) { const si = b.dataset.valor === hoja.a; b.classList.toggle('elegido', si); b.setAttribute('aria-checked', si); }
    for (const b of $('crHora').children) { const si = b.dataset.valor === (hoja.h || ''); b.classList.toggle('elegido', si); b.setAttribute('aria-checked', si); }
    for (const b of $('crClima').children) { const si = b.dataset.valor === hoja.c; b.classList.toggle('elegido', si); b.setAttribute('aria-checked', si); }
    for (const id in botones) botones[id].hidden = !sePuede(id, hoja.a);   // (la cornisa y las lajas, solo en la montaña)
    // la hoja: la largada, las notas elegidas (lo del costado, mas chico) y la llegada, que se pone sola
    const caja = $('crHoja');
    caja.textContent = '';
    const nota = (src, texto, titulo, clase) => {
      const n = crear('span', 'nota' + (clase ? ' ' + clase : '')), img = crear('img', 'icono');
      img.src = src; img.alt = ''; img.draggable = false;
      n.title = titulo;
      n.append(img, crear('b', '', texto));
      caja.append(n);
    };
    nota(icono('bandera'), '', 'Largada', 'cr-punta');
    hoja.p.forEach((id, k) => nota(dibujoDe(id), esObjeto(id) || esAjuste(id) || PIEZAS[id].grupo === 'camino' ? '' : rotuloDe(id), PIEZAS[id].nombre, (esObjeto(id) || esAjuste(id) ? 'cr-objeto' : '') + (k === hoja.p.length - 1 ? ' cr-ultima' : '')));
    nota(iconoDeNota({ tipo: 'meta' }), '', 'Llegada', 'cr-punta');
    caja.setAttribute('aria-label', 'Tu pista: ' + (hoja.p.length ? hoja.p.map((id) => PIEZAS[id].nombre).join(', ') : 'todavía sin notas'));
    caja.scrollTop = caja.scrollHeight;
    // cuanto mide y cuantas notas lleva
    $('crLargo').textContent = km(largo());
    $('crCuenta').textContent = deCamino() + ' de ' + TOPES.piezas + ' notas';
    $('crLargo').classList.toggle('corta', !sePuedeCorrer());
    $('crBorrar').disabled = !hoja.p.length || ocupado;
    $('crDice').textContent = loQueDice();
    // el nombre de la pista, el del corredor (si todavia no lo puso) y para quien es
    if (document.activeElement !== $('crNombre')) $('crNombre').value = nombre;
    $('crApodoCaja').hidden = !!club.nombre();
    const clubes = club.clubes(), cajaPara = $('crPara');
    cajaPara.textContent = '';
    $('crParaCaja').hidden = !clubes.length;
    if (clubes.length) {
      for (const c of [{ codigo: '', nombre: '🔗 Solo con link' }, ...clubes]) {
        const b = crear('button', para === c.codigo ? 'elegido' : '', c.nombre), si = para === c.codigo;
        b.type = 'button'; b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', si);
        b.addEventListener('click', () => { para = c.codigo; guardar(); pintar(); });
        cajaPara.append(b);
      }
    }
    $('crPublicar').disabled = ocupado;
    $('crProbar').disabled = ocupado;
    pintarMias();
    $('crDeCero').textContent = borrando ? '¿Seguro? Tocá de nuevo' : 'Empezar otra';
    $('crDeCero').hidden = !hoja.p.length && !nombre;
  }

  // Las pistas propias que siguen vigentes: cuantas son (hay un maximo) y un tacho para borrar cada una (tocandolo dos veces).
  let porBorrar = 0, cualBorrar = 0;
  function pintarMias() {
    const mias = club.pistas().filter((p) => p.mia), ol = $('crMiasLista');
    $('crMias').hidden = !mias.length;
    $('crMiasTitulo').textContent = 'Tus pistas publicadas: ' + mias.length + ' de ' + COMUNIDAD.porPersona;
    ol.textContent = '';
    for (const p of mias) {
      const li = crear('li'), b = crear('button', 'chiquito tacho' + (cualBorrar === p.numero ? ' seguro' : ''));
      const dias = Math.ceil((p.vence - Date.now() / 1000) / 86400);
      li.append(crear('span', 'emoji', '📝'), crear('b', '', p.nombre), crear('small', '', cualBorrar === p.numero ? '¿Borrarla? Tocá de nuevo el tacho.' : dias <= 1 ? 'vence hoy' : 'quedan ' + dias + ' días'));
      b.type = 'button'; b.dataset.icono = 'tacho'; b.title = 'Borrar «' + p.nombre + '»'; b.setAttribute('aria-label', b.title);
      b.disabled = ocupado;
      b.addEventListener('click', () => borrarMia(p));
      li.append(b);
      ol.append(li);
    }
    ponerIconos(ol);
  }
  async function borrarMia(p) {
    if (ocupado) return;
    if (cualBorrar !== p.numero || performance.now() - porBorrar > 6000) { cualBorrar = p.numero; porBorrar = performance.now(); pintar(); return; }
    cualBorrar = 0; ocupado = true;
    decir('Borrando «' + p.nombre + '»…');
    const r = await o.borrarPista(p.numero);
    ocupado = false;
    if (r.sale) return;   // (era la que se estaba corriendo: se vuelve a la pista de hoy)
    decir(r.error ? r.error : 'Listo: borré «' + p.nombre + '», con sus tiempos.');
  }

  // Despues de cada cambio: que notas entran como siguiente. Se calcula despues de pintar (lleva un momento: hay que
  // armar la pista una vez por cada nota), y si mientras tanto hubo otro cambio, se descarta.
  function calcular() {
    const mio = ++turno;
    setTimeout(() => {
      if (mio !== turno) return;
      const camino = deCamino(), objetos = hoja.p.filter(esObjeto).length, ajustes = hoja.p.filter(esAjuste).length;
      for (const id in botones) {
        const b = botones[id];
        let si = false;
        if (b.hidden) si = false;
        else if (esObjeto(id)) si = objetos < TOPES.objetos;
        else if (esAjuste(id)) si = ajustes < TOPES.ajustes;   // (un ajuste siempre vale: no mide nada)
        else if (camino < TOPES.piezas) { const x = armarHoja({ ...hoja, p: [...hoja.p, id] }); si = !x.error || x.error === 'corta'; }
        b.classList.toggle('no-entra', !si);
      }
    }, 0);
  }

  function guardar() { club.ponerBorrador({ hoja, nombre, club: para }); }
  function cambio() { borrando = 0; armado = armarHoja(hoja); guardar(); pintar(); calcular(); }
  const decir = (texto) => { dice = texto; pintar(); };

  // --- tocar una nota: va al final, si entra ---
  function tocar(id) {
    if (ocupado) return;
    const camino = deCamino(), objetos = hoja.p.filter(esObjeto).length;
    if (esAjuste(id)) {
      if (hoja.p.filter(esAjuste).length >= TOPES.ajustes) return decir('Ya cambiaste el camino ' + TOPES.ajustes + ' veces: es el máximo.');
      hoja = { ...hoja, p: [...hoja.p, id] }; dice = ''; return cambio();
    }
    if (esObjeto(id) && objetos >= TOPES.objetos) return decir('Ya pusiste ' + TOPES.objetos + ' cosas al costado: es el máximo.');
    if (!esObjeto(id) && camino >= TOPES.piezas) return decir('Llegaste al máximo: ' + TOPES.piezas + ' notas. Probala o publicala así.');
    const p = [...hoja.p, id], x = armarHoja({ ...hoja, p });
    if (x.error === 'larga') return decir('Con esa se pasa de ' + km(TOPES.maximo) + ', el máximo. Probá con una más corta, o terminala acá.');
    if (x.error && x.error !== 'corta') {
      // (si es una curva y para el otro lado entra, se lo dice)
      if (PIEZAS[id].grupo === 'curvas') {
        const otra = (id[0] === 'd' ? 'i' : 'd') + id.slice(1), y = armarHoja({ ...hoja, p: [...hoja.p, otra] });
        if (!y.error || y.error === 'corta') return decir('Para ' + (id[0] === 'd' ? 'la derecha' : 'la izquierda') + ' no entra: se cruzaría con el camino. Para el otro lado, sí.');
      }
      return decir('Esa no entra: el camino se cruzaría con lo que ya armaste, o se iría demasiado lejos. Probá con otra.');
    }
    const antes = sePuedeCorrer();
    hoja = { ...hoja, p };
    dice = !antes && !x.error ? 'Ya se puede correr. Probala, o seguí sumando notas.' : '';
    cambio();
  }
  function borrarUltima() {
    if (!hoja.p.length || ocupado) return;
    hoja = { ...hoja, p: hoja.p.slice(0, -1) };
    dice = '';
    cambio();
  }
  // empezar otra: se borra todo (hay que tocar dos veces)
  function deCero() {
    if (!borrando || performance.now() - borrando > 6000) { borrando = performance.now(); pintar(); return; }
    hoja = nueva(); nombre = ''; dice = '';
    cambio();
  }
  // El ambiente cambia el suelo y el paisaje, no el recorrido. La cornisa y las lajas son de montaña: si se sale de la
  // montaña se sacan (y si sin ellas el camino no entra, hay que sacarlas a mano).
  function elegirAmbiente(a) {
    if (a === hoja.a || ocupado) return;
    const p = hoja.p.filter((id) => sePuede(id, a));
    dice = '';
    if (p.length !== hoja.p.length) {
      const x = armarHoja({ ...hoja, a, p });
      if (x.error && x.error !== 'corta') return decir('La cornisa y las lajas son de montaña. Para cambiar de ambiente, primero sacalas.');
      dice = 'Saqué la cornisa y las lajas: son de montaña.';
    }
    hoja = { ...hoja, a, p };
    cambio();
  }

  // --- probar y publicar ---
  function probar() {
    if (ocupado) return;
    if (!sePuedeCorrer()) return decir(hoja.p.length ? 'Todavía es corta: le faltan ' + metros(TOPES.minimo - largo()) + ' para poder correrla.' : 'Primero elegí algunas notas.');
    guardar();
    o.probar();
  }
  async function publicar() {
    if (ocupado) return;
    if (!sePuedeCorrer()) return decir(hoja.p.length ? 'Todavía es corta: le faltan ' + metros(TOPES.minimo - largo()) + ' para poder publicarla.' : 'Primero elegí algunas notas.');
    nombre = $('crNombre').value.trim();
    if (nombre.length < 2) { $('crNombre').focus(); return decir('Ponele un nombre a la pista.'); }
    if (!club.nombre()) { $('crApodo').focus(); return decir('Poné tu nombre: sale en la portada de la pista.'); }
    if (!o.nube.hay) return decir('Sin el servidor del juego no se puede publicar. Mientras tanto, probala.');
    ocupado = true;
    guardar();
    decir('Publicando…');
    const r = await o.nube.crearPista(nombre, club.nombre(), para, hoja);
    ocupado = false;
    if (!r || r.error) return decir(r ? r.error : 'No hay conexión con el servidor del juego. Probá en un rato.');
    const deClub = para ? club.clubes().find((c) => c.codigo === para) : null;
    club.conocerPista({ ...r, hoja, mia: true, clubNombre: deClub ? deClub.nombre : '' });
    club.ponerBorrador(null);
    dice = '';
    o.publicada(r);
  }

  // --- abrir y cerrar ---
  // codigo: el club para el que se arma (si se abre desde un club). Si hay un borrador, se sigue con ese.
  function abrir(codigo) {
    prepararse();
    const b = club.borrador();
    hoja = (b && leerHoja(b.hoja)) || nueva();
    nombre = (b && b.nombre) || '';
    para = codigo !== undefined ? codigo : (b && b.club) || '';
    if (para && !club.clubes().some((c) => c.codigo === para)) para = '';
    armado = armarHoja(hoja);
    // (un borrador que ya no entra entero, por un cambio del juego: queda hasta donde entra)
    if (armado.error && armado.error !== 'corta' && armado.cual >= 0) { hoja = { ...hoja, p: hoja.p.slice(0, armado.cual) }; armado = armarHoja(hoja); }
    alAbrir = JSON.stringify(hoja);
    dice = ''; borrando = 0;
    if (codigo !== undefined) guardar();
    $('crApodo').value = club.nombre();
    raiz.hidden = false;
    raiz.scrollTop = 0;
    pintar();
    calcular();
    $('crCerrar').focus({ preventScroll: true });
  }
  function cerrar() {
    if (raiz.hidden || ocupado) return;
    raiz.hidden = true;
    // si se esta corriendo el borrador y se lo cambio, se vuelve a armar la pagina con el nuevo
    if (o.enElBorrador && JSON.stringify(hoja) !== alAbrir) o.probar();
    if (o.alCerrar) o.alCerrar();
  }

  return { abrir, cerrar, abierto: () => !raiz.hidden };
}

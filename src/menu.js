// Las pantallas que no son manejar: la portada con la pista del dia (o con un circuito fijo), la tabla del club,
// los circuitos, las pistas pasadas, la ayuda, la configuracion y el resultado de cada pasada con su boton de compartir.
import { AUTOS } from './config.js';
import { BIOMAS, CLIMAS, CARACTER, datosDelDia } from './generador.js';
import { CIRCUITOS, circuitoDe } from './circuitos.js';
import { fechaDe } from './dia.js';
import { tiempoFinal, CLASE_DE_COLOR } from './hud.js';
import { iconoDeNota, textoDeNota, ponerIconos, rotular, icono } from './iconos.js';

const $ = (id) => document.getElementById(id);
const CUADRO = { v: '🟩', a: '🟨', r: '🟥', n: '⬛' };
const ABANDONO = { roto: 'Rompiste el auto', tiempo: 'Se acabó el tiempo', cerrado: 'Cerraste el juego en plena pasada' };
const crear = (etiqueta, clase, texto) => { const el = document.createElement(etiqueta); if (clase) el.className = clase; if (texto !== undefined) el.textContent = texto; return el; };

// El mensaje para compartir: Shakedown #42 🌧️🌲 ⏱️ 01:42:85 🟩 🟩 🟨 🟥 🟩 🏁
// (el de un circuito fijo lleva su nombre en vez del numero: Shakedown · Subida ⛰️ ⏱️ 01:42:85 ...)
export function mensaje(etapa, r) {
  const cuadros = [...(r.c || 'nnnnn')].map((x) => CUADRO[x]).join(' '), fijo = circuitoDe(etapa.numero);
  return (fijo ? 'Shakedown · ' + fijo.corto + ' ' + fijo.emoji : 'Shakedown #' + etapa.numero + ' ' + CLIMAS[etapa.clima].emoji + BIOMAS[etapa.bioma].emoji + (r.practica ? ' 🔧 práctica' : ''))
    + (r.ab ? ' 💥 abandono ' + cuadros : ' ⏱️ ' + tiempoFinal(r.t) + ' ' + cuadros + ' 🏁');
}
// los cuadraditos de un resultado, como elementos de la pagina
function cuadritos(colores) {
  const caja = crear('span', 'cuadros');
  for (const x of colores || 'nnnnn') caja.append(crear('i', CLASE_DE_COLOR[x]));
  return caja;
}

// o: { T, club, hoy, ref, copiloto, elegirAuto(id), elegirRival(clave), rival(),
//      ajustes: { leer(clave), poner(clave, valor), probar() }   la configuracion (ver GUSTOS en config.js) }
export function crearMenu(o) {
  const { T, club, hoy, ref, copiloto, ajustes } = o, etapa = T.etapa, numero = etapa.numero, esHoy = numero === hoy;
  const fijo = circuitoDe(numero);   // si lo que se corre es un circuito fijo, cual
  // el salvavidas que marca un tiempo hecho con la ayuda de manejo
  const conAyuda = () => { const img = crear('img', 'icono con-ayuda'); img.src = icono('salvavidas'); img.alt = 'con ayuda de manejo'; img.title = 'Con ayuda de manejo'; return img; };
  let ultimo = null, linkDe = null;   // el ultimo resultado mostrado, y la funcion que arma su link

  // --- la portada ---
  $('inicio').href = location.pathname;
  $('pistaNumero').textContent = fijo ? fijo.emoji : '#' + numero;
  $('pistaFecha').textContent = fijo ? 'Circuito' : fechaDe(numero);
  $('pistaLugar').textContent = etapa.lugar;
  $('pistaNombre').textContent = etapa.nombre;
  if (fijo) { $('pistaDetalle').textContent = fijo.detalle; $('pistaDetalle').hidden = false; }
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

  function pintar() {
    // en un circuito no hay pasada oficial: lo que cuenta es el mejor tiempo
    const oficial = fijo ? club.practica() : club.oficial(), puede = club.sePuedeOficial(), rival = o.rival();
    for (const b of $('autos').children) { const si = b.dataset.auto === club.auto(); b.classList.toggle('elegido', si); b.setAttribute('aria-checked', si); }
    // contra quien
    $('desafio').hidden = !rival;
    if (rival) $('desafio').querySelector('span').textContent = 'Contra ' + rival.nombre + (rival.ab ? '' : ' · ' + tiempoFinal(rival.t));
    // mi resultado, si ya corri
    const mio = $('miResultado');
    mio.hidden = !oficial || !!oficial.corriendo;
    if (!mio.hidden) {
      mio.textContent = '';
      mio.append(crear('span', 'chico', T.vuelta ? 'Tu mejor vuelta' : fijo ? 'Tu mejor tiempo' : 'Tu pasada oficial'), crear('b', 'tiempo', oficial.ab ? 'Abandono' : tiempoFinal(oficial.t)), cuadritos(oficial.c));
    }
    $('avisoAyuda').hidden = !ajustes.leer('ayuda');
    pintarAjustes();
    // la bandera a cuadros larga la pasada oficial; el cono, una practica
    rotular($('largar'), puede || fijo ? 'Largar' : 'Practicar');
    $('largar').dataset.icono = puede || fijo ? 'bandera' : 'cono';
    $('compartirPortada').hidden = !(oficial && !oficial.corriendo && oficial.codigo);
    $('queEs').textContent = (o.aviso ? o.aviso + ' ' : '') + (T.vuelta ? 'Vuelta cerrada: das las que quieras y queda la mejor. Para terminar, salí con la X' + (window.matchMedia('(pointer: coarse)').matches ? '.' : ' o con Esc.') : fijo ? 'Circuito fijo: se corre las veces que quieras. Queda tu mejor tiempo.' : puede ? 'Pasada oficial: una sola. Sin reconocimiento.' : esHoy ? 'Ya corriste la oficial. Las prácticas no cuentan para la tabla.' : 'Pista pasada: se puede practicar, pero ya no cuenta.');
    // la tabla: en un circuito, los mejores tiempos de cada uno; en una pista del dia, las oficiales y, aparte, las practicas
    pintarTabla($('tabla'), fijo ? club.practicas() : club.tabla());
    pintarTabla($('practicas'), fijo ? [] : club.practicas());
    $('tablaVacia').hidden = (fijo ? club.practicas() : club.tabla()).length > 0;
    $('practicasTitulo').hidden = !!fijo || club.practicas().length === 0;
    $('tablaPista').textContent = fijo ? '· ' + fijo.corto : '#' + numero;
    ponerIconos();
  }

  // --- la tabla ---
  function pintarTabla(ol, lista) {
    ol.textContent = '';
    const rival = o.rival();
    lista.forEach((r) => {
      const li = crear('li', r.mio ? 'mio' : '');
      const quien = crear('span', 'quien', r.nombre || (r.mio ? 'Vos' : '?'));
      if (r.ayuda) quien.append(conAyuda());
      li.append(crear('span', 'emoji', (AUTOS[r.auto] || AUTOS.vitarita).emoji), quien, crear('span', 'tiempoMarca', r.ab ? 'abandono' : tiempoFinal(r.t)), cuadritos(r.c));
      if (r.codigo) {
        const clave = r.mio ? '*' : r.nombre, es = rival && rival.clave === clave && !!rival.practica === !!r.practica;
        // el fantasma: amarillo si es contra quien se corre
        const b = crear('button', 'chiquito' + (es ? ' elegido' : ''));
        b.dataset.icono = 'fantasma';
        b.title = es ? 'Es tu rival. Tocá para correr sin fantasma.' : 'Correr contra su fantasma';
        b.setAttribute('aria-label', b.title); b.setAttribute('aria-pressed', es);
        b.addEventListener('click', () => { o.elegirRival(es ? '' : clave, !!r.practica); pintar(); if (ultimo) pintarTabla($('finTabla'), fijo ? club.practicas() : club.tabla()); });
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
  const dib = (nombre, color) => '<span data-icono="' + nombre + '"' + (color ? ' data-color="' + color + '"' : '') + '></span>';
  $('comoSeJuega').innerHTML = `
    <dl class="teclas teclado">
      <div><dt><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> o las flechas</dt><dd>manejar</dd></div>
      <div><dt><kbd>Espacio</kbd></dt><dd>freno de mano</dd></div>
      <div><dt><kbd>R</kbd> ${dib('volver')}</dt><dd>volver al camino (suma 8 segundos)</dd></div>
      <div><dt><kbd>C</kbd> ${dib('cam-aerea')}${dib('cam-atras')}${dib('cam-arriba')}</dt><dd>cámara: aérea, de atrás o desde arriba</dd></div>
      <div><dt><kbd>M</kbd> ${dib('sonido')} <kbd>V</kbd> ${dib('voz')}</dt><dd>sonido y voz del copiloto</dd></div>
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
    <p>Cada pista tiene cinco sectores. Al final, cada uno queda <b class="verde">verde</b>, <b class="amarillo">amarillo</b> o <b class="rojo">rojo</b> según cuánto tardaste contra el tiempo de referencia. Si tuviste que volver al camino, ese sector es rojo.</p>
    <p>Los números de las notas van del 1 (curva muy cerrada) al 6 (casi recta). H es una horquilla y 90, una esquina.</p>
    <p>Los golpes rompen el auto. Si se rompe del todo, es abandono.</p>
    <p>${dib('fantasma')} En la tabla, el fantasma elige contra quién corrés. Si te mandan un link, corrés contra quien te lo mandó.</p>
    <p>${dib('ajustes')} En la configuración se cambian la distancia de la cámara y, en el celular, la sensibilidad al inclinar y el tamaño de los pedales.</p>
    <p>${dib('salvavidas')} Si recién arrancás, prendé ahí la ayuda de manejo: el auto frena solo antes de las curvas y se cruza menos. Es más lento, pero llegás.</p>`;

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
    if (cual === 'circuitos') pintarCircuitos();
    // en el celular, al abrir la configuracion se prende el sensor (si lo hay) para poder probar la sensibilidad
    if (cual === 'ajustes') { pintarAjustes(); if (window.matchMedia('(pointer: coarse)').matches) ajustes.probar(); }
    $('panel').hidden = !cual;
    if (cual) $('cerrarPanel').focus();
  }
  for (const b of document.querySelectorAll('[data-panel]')) b.addEventListener('click', () => abrir(b.dataset.panel));
  $('cerrarPanel').addEventListener('click', () => abrir(''));
  // desde el resultado: vuelve a la portada y abre los circuitos
  $('irCircuitos').addEventListener('click', () => { $('salir').click(); abrir('circuitos'); });

  // --- compartir ---
  async function compartir(r, salida) {
    if (!club.nombre()) { $('nombre').focus(); if (salida) salida.textContent = 'Poné tu nombre para compartir.'; return; }
    const codigo = r.codigo || (linkDe && await linkDe());
    const url = location.origin + location.pathname + (codigo ? '#r=' + codigo : ''), texto = mensaje(etapa, r);
    // en el celular abre el menu de compartir; en la compu copia el mensaje con el link
    try {
      if (navigator.share && window.matchMedia('(pointer: coarse)').matches) { await navigator.share({ text: texto + '\n' + url }); return; }
      await navigator.clipboard.writeText(texto + '\n' + url);
      if (salida) salida.textContent = 'Copiado. Pegalo en el grupo.';
    } catch (e) {
      if (e && e.name === 'AbortError') return;
      if (salida) salida.textContent = 'No pude copiarlo. Copialo de acá: ' + texto + ' ' + url;
    }
  }
  $('compartir').addEventListener('click', () => ultimo && compartir(ultimo, $('compartido')));
  $('compartirPortada').addEventListener('click', () => { const r = fijo ? club.practica() : club.oficial(); if (r) compartir({ ...r, nombre: club.nombre() }, $('queEs')); });
  $('nombre').addEventListener('change', () => { club.ponerNombre($('nombre').value); $('compartido').textContent = ''; pintar(); });
  $('nombre').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('nombre').blur(); });

  return {
    pintar,
    portada: (si) => { $('portada').hidden = !si; if (!si) abrir(''); else pintar(); },
    // Muestra el resultado de una pasada. r: el resultado. armarLink: funcion que devuelve el codigo del link (con el fantasma).
    // mejoro: true si es tu mejor tiempo en esa pista (para las practicas y los circuitos).
    fin: (r, armarLink, mejoro) => {
      ultimo = r; linkDe = armarLink;
      $('finTipo').textContent = (fijo ? 'Circuito · ' : (r.practica ? 'Práctica' : 'Pasada oficial') + ' · #' + numero + ' ') + etapa.nombre + (mejoro ? (T.vuelta ? ' · ¡tu mejor vuelta!' : ' · ¡tu mejor tiempo!') : '');
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
      const tabla = fijo ? club.practicas() : club.tabla();
      $('finRanking').hidden = tabla.length < 2;
      pintarTabla($('finTabla'), tabla);
      rotular($('otra'), fijo ? 'Otra vez' : 'Practicar');
      $('otra').dataset.icono = fijo ? 'bandera' : 'cono';
      $('fin').hidden = false;
      ponerIconos();
    },
    cerrarFin: () => { $('fin').hidden = true; ultimo = null; },
    // (en la configuracion) muestra el volante en vivo: v es la inclinacion, de -1 a 1, o null si no hay sensor
    prueba: (v) => { if (!$('panelAjustes').hidden && v !== null) $('pruebaVolante').style.left = (50 + v * 50).toFixed(1) + '%'; },
  };
}

// El tutorial de la primera vez. Con el auto ya en la largada y el reloj parado, el equipo explica de a una cosa lo
// que hay en pantalla: cada paso tiene quién habla, qué dice y qué parte de la pantalla ilumina.
// No sabe nada del juego: main.js le dice cómo se maneja en este aparato y qué hacer cuando termina.
import { deEquipo, retrato } from './equipo.js';

const $ = (id) => document.getElementById(id);
const tecla = (...t) => t.map((x) => '<kbd>' + x + '</kbd>').join('');

// Los pasos, en orden.
//   quien: quién habla (ver equipo.js).
//   texto(c): lo que dice. c.dedos: se maneja tocando la pantalla; c.flechas: se dobla con flechas y no inclinando.
//   foco(c): qué ilumina (selectores de lo que hay en pantalla). Sin foco, habla nomás.
//   elige: en el último paso se elige si se larga con la ayuda de manejo o sin ella.
// Para cambiar lo que dicen, alcanza con tocar los textos de acá.
export const PASOS = [
  { quien: 'gaby',
    texto: (c) => '<p>Soy Gaby, tu instructora. Antes de largar, un minuto.</p>' + (c.dedos
      ? '<p>El pedal <b class="amarillo">amarillo</b> acelera y ' + (c.flechas ? 'el de al lado frena. Las flechas doblan.' : 'el de la izquierda frena. Para doblar, inclinás el celular como un volante.') + ' El redondo es el freno de mano.</p>'
      : '<p>' + tecla('↑') + ' acelera, ' + tecla('↓') + ' frena y ' + tecla('←', '→') + ' doblan. También con ' + tecla('W', 'A', 'S', 'D') + '. ' + tecla('Espacio') + ' es el freno de mano.</p>'),
    foco: (c) => (c.dedos ? ['#tactil .pedal', '#tactil .redondo', '#volante'] : []) },
  { quien: 'leo',
    texto: () => '<p>Acá va lo que viene. La flecha dice para dónde dobla y el número, qué tan cerrada es: <b>1</b>, cerradísima; <b>6</b>, casi recta. Abajo, los metros que faltan.</p><p>Frená <b>antes</b> de la curva: en la tierra, pasado no dobla.</p>',
    foco: () => ['#notas .nota'] },
  { quien: 'julian',
    texto: () => '<p>El reloj. Los cinco cuadraditos son los sectores: <b class="verde">verde</b> si venís rápido, <b class="rojo">rojo</b> si no.</p><p>La pasada oficial es una sola por día. Yo ya hice la mía.</p>',
    foco: () => ['.placa.tiempo'] },
  { quien: 'sebastian',
    texto: () => '<p>Esa barra es el auto. Cada golpe lo rompe un poco; si se llena, abandonás.</p><p>A las piedras con antorcha roja, esquivalas.</p>',
    foco: () => ['.placa.marcha'] },
  { quien: 'gonza',
    texto: (c) => '<p>¿Te fuiste del camino o volcaste? ' + (c.dedos ? 'Tocá ese botón' : 'Apretá ' + tecla('R') + ', o ese botón,') + ' y te dejo de nuevo en la huella.</p><p>Sale 8 segundos.</p>',
    foco: () => ['#mandos .volver'] },
  { quien: 'paloma', elige: true,
    texto: () => '<p>¿Primera vez? Te doy una mano. Con la <b>ayuda de manejo</b> el auto sigue la línea pintada y frena solo antes de las curvas: vos acelerás y corregís.</p><p>Es más lento, pero llegás. Después se cambia en la configuración.</p>',
    foco: () => [] },
];

// o: { dedos(): bool, flechas(): bool,
//      alTerminar(conAyuda): se largó. conAyuda es true o false si se eligió en el último paso, y undefined si se saltó.
//      alCancelar(): se cerró sin largar }
export function crearTutorial(o) {
  const caja = $('tutorial'), sombra = $('tutSombra'), luces = $('tutLuces'), tarjeta = caja.querySelector('.tut-tarjeta'), botones = $('tutBotones'), puntos = $('tutPuntos');
  let paso = 0, abierto = false, cuadro = 0;
  const contexto = () => ({ dedos: !!o.dedos(), flechas: !!o.flechas() });

  // Lo que ilumina el paso: un rectángulo por cada grupo de cosas que nombra (las que están pegadas van juntas; las
  // que quedan lejos, como los pedales de un lado y del otro con el celular acostado, cada una con su luz).
  function grupos(selectores) {
    const aire = 8, cerca = 26, lista = [];
    for (const s of selectores) for (const el of document.querySelectorAll(s)) {
      const b = el.getBoundingClientRect();
      if (b.width >= 2 && b.height >= 2) lista.push({ x0: b.left - aire, y0: b.top - aire, x1: b.right + aire, y1: b.bottom + aire });
    }
    for (let junto = true; junto;) {
      junto = false;
      for (let a = 0; a < lista.length && !junto; a++) for (let b = a + 1; b < lista.length && !junto; b++) {
        const A = lista[a], B = lista[b];
        if (A.x0 - cerca < B.x1 && B.x0 - cerca < A.x1 && A.y0 - cerca < B.y1 && B.y0 - cerca < A.y1) {
          lista[a] = { x0: Math.min(A.x0, B.x0), y0: Math.min(A.y0, B.y0), x1: Math.max(A.x1, B.x1), y1: Math.max(A.y1, B.y1) };
          lista.splice(b, 1); junto = true;
        }
      }
    }
    return lista;
  }
  // Acomoda las luces y la tarjeta. La tarjeta va donde menos tape lo iluminado; a igual tapado, donde queda más cómoda
  // (en el celular parado, abajo, cerca del pulgar; acostado y en la compu, al medio).
  function acomodar() {
    if (!abierto) return;
    const W = window.innerWidth, H = window.innerHeight, c = contexto(), focos = grupos(PASOS[paso].foco(c)), radio = 12;
    // la sombra tapa todo menos lo iluminado: un agujero de puntas redondeadas por cada luz
    let camino = 'M0 0H' + W + 'V' + H + 'H0Z';
    luces.textContent = '';
    for (const f of focos) {
      const x = Math.round(f.x0), y = Math.round(f.y0), w = Math.round(f.x1 - f.x0), h = Math.round(f.y1 - f.y0), r = Math.min(radio, w / 2, h / 2), arco = (dx, dy) => 'a' + r + ' ' + r + ' 0 0 1 ' + dx + ' ' + dy;
      camino += 'M' + (x + r) + ' ' + y + 'h' + (w - 2 * r) + arco(r, r) + 'v' + (h - 2 * r) + arco(-r, r) + 'h' + (2 * r - w) + arco(-r, -r) + 'v' + (2 * r - h) + arco(r, -r) + 'Z';
      const luz = document.createElement('i');
      Object.assign(luz.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
      luces.append(luz);
    }
    sombra.style.clipPath = 'path(evenodd, "' + camino + '")';
    const estilo = getComputedStyle(caja), borde = (n) => parseFloat(estilo.getPropertyValue(n)) || 16;
    const mi = borde('--mi'), md = borde('--md'), ma = borde('--ma'), mb = borde('--mb');
    // (el retrato asoma por arriba de la tarjeta: "sobra" es cuánto)
    const w = tarjeta.offsetWidth, h = tarjeta.offsetHeight, sobra = Math.max(0, tarjeta.getBoundingClientRect().top - $('tutRetrato').getBoundingClientRect().top);
    const arriba = ma + sobra + 4, abajo = H - mb - h, medio = Math.max(arriba, (H - h + sobra) / 2);
    const izq = mi, der = W - md - w, centro = (W - w) / 2, parado = H > W;
    const lugares = c.dedos && parado
      ? [[centro, abajo], [centro, arriba], [centro, medio]]
      : [[centro, medio], [centro, abajo], [centro, arriba], [izq, medio], [der, medio], [izq, abajo], [der, abajo], [izq, arriba], [der, arriba]];
    let mejor = lugares[0], menos = Infinity;
    lugares.forEach(([x, y], k) => {
      let tapa = 0;
      for (const f of focos) {
        const ancho = Math.min(x + w, f.x1 + 6) - Math.max(x, f.x0 - 6), alto = Math.min(y + h, f.y1 + 6) - Math.max(y - sobra, f.y0 - 6);
        if (ancho > 0 && alto > 0) tapa += ancho * alto;
      }
      const nota = tapa * 100 + k;
      if (nota < menos) { menos = nota; mejor = [x, y]; }
    });
    tarjeta.style.left = Math.round(mejor[0]) + 'px';
    tarjeta.style.top = Math.round(mejor[1]) + 'px';
  }
  const pronto = () => { cancelAnimationFrame(cuadro); cuadro = requestAnimationFrame(acomodar); };

  function boton(texto, clase, alTocar) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = clase; b.textContent = texto;
    b.addEventListener('click', alTocar);
    botones.append(b);
    return b;
  }
  function pintar() {
    const p = PASOS[paso], quien = deEquipo(p.quien), c = contexto();
    $('tutRetrato').src = retrato(quien.id);
    $('tutNombre').textContent = quien.nombre;
    $('tutRol').textContent = quien.rol;
    $('tutTexto').innerHTML = p.texto(c);
    puntos.textContent = '';
    PASOS.forEach((x, k) => { const i = document.createElement('i'); if (k === paso) i.className = 'aca'; else if (k < paso) i.className = 'ya'; puntos.append(i); });
    botones.textContent = '';
    let principal;
    if (p.elige) {
      boton('Sin ayuda', 'con-texto discreto', () => terminar(false));
      principal = boton('Largar con ayuda', 'con-texto fuerte', () => terminar(true));
    } else principal = boton('Siguiente', 'con-texto fuerte', () => ir(paso + 1));
    $('tutSaltar').hidden = !!p.elige;
    principal.focus({ preventScroll: true });
    acomodar();
    // (el retrato tarda un instante en llegar la primera vez, y con él cambia el alto de la tarjeta)
    pronto();
  }
  function ir(n) { paso = Math.max(0, Math.min(PASOS.length - 1, n)); pintar(); }

  // Mientras está abierto, las teclas son del tutorial: las del juego (la cámara, volver al camino…) no hacen nada.
  function alTeclear(e) {
    if (!abierto) return;
    e.stopImmediatePropagation();
    if (e.type !== 'keydown' || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.code === 'Escape') { e.preventDefault(); cancelar(); }
    else if (e.code === 'ArrowRight' && !PASOS[paso].elige) { e.preventDefault(); ir(paso + 1); }
    else if (e.code === 'ArrowLeft') { e.preventDefault(); ir(paso - 1); }
    else if (['ArrowUp', 'ArrowDown', 'Space'].includes(e.code) && e.target.tagName !== 'BUTTON') e.preventDefault();   // (que no se mueva la página)
  }
  window.addEventListener('keydown', alTeclear, true);
  window.addEventListener('keyup', alTeclear, true);
  window.addEventListener('resize', pronto);
  // si en el medio cambia cómo se dobla (apareció el sensor del celular, o no lo hay), el primer paso dice otra cosa
  new MutationObserver(() => { if (abierto) pintar(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  $('tutRetrato').addEventListener('load', pronto);

  function cerrar() {
    abierto = false;
    caja.hidden = true;
    document.documentElement.classList.remove('con-tutorial');
    for (const id of ['mandos', 'tactil']) $(id).removeAttribute('inert');
  }
  function terminar(conAyuda) { cerrar(); o.alTerminar(conAyuda); }
  function cancelar() { cerrar(); o.alCancelar(); }
  $('tutSaltar').addEventListener('click', () => terminar(undefined));
  $('tutCerrar').addEventListener('click', cancelar);

  return {
    abierto: () => abierto,
    abrir: () => {
      if (abierto) return;
      abierto = true; paso = 0;
      for (const p of PASOS) new Image().src = retrato(p.quien);   // (los retratos se van bajando ya, asi no aparecen de golpe)
      for (const id of ['mandos', 'tactil']) $(id).setAttribute('inert', '');   // (los botones del juego, por ahora, de adorno)
      caja.hidden = false;
      // (la clase va al final: al cambiar, el tutorial se vuelve a pintar, y para eso ya tiene que estar a la vista)
      document.documentElement.classList.add('con-tutorial');
      pintar();
    },
    cerrar,
    // (para las pruebas)
    paso: () => paso, ir,
  };
}

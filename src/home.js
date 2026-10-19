// El inicio: una fila de cards grandes que se deslizan, una por modo de juego.
// En el celular se corre con el dedo (el navegador se encarga: scroll-snap en style.css) y la siguiente card asoma al costado.
// En la compu se pasa con las flechas del teclado (izquierda y derecha) o con los botones de los costados.
// Aca solo esta la mecanica del carrusel (cual card esta al medio, los puntitos, las flechas); lo que dice cada card lo
// pinta menu.js.
const $ = (id) => document.getElementById(id);

// o: { cards: [{ id, nombre }]   en el orden en que se ven
//      alCambiar(i)              se avisa cuando otra card pasa al medio
//      puedeTeclas()             false si hay algo encima (un panel, el creador) y las flechas no son del inicio }
export function crearHome(o) {
  const pista = $('homePista'), cards = o.cards.map((c) => $(c.id)), puntos = $('homePuntos'), nombre = $('homeNombre');
  const sinMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)');
  let actual = 0, esperando = 0;

  // los puntitos: uno por card, el de la card que esta al medio queda marcado
  const botones = o.cards.map((c, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'punto'; b.dataset.punto = c.clave; b.setAttribute('aria-label', c.nombre);
    b.addEventListener('click', () => ir(i));
    puntos.append(b);
    return b;
  });

  function marcar(i) {
    actual = i;
    botones.forEach((b, k) => { b.classList.toggle('aca', k === i); if (k === i) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current'); });
    cards.forEach((c, k) => c.classList.toggle('aca', k === i));
    nombre.textContent = o.cards[i].nombre;
    $('home').dataset.card = o.cards[i].clave;
    $('homeAtras').disabled = i === 0;
    $('homeAdelante').disabled = i === cards.length - 1;
  }
  // la card cuyo centro esta mas cerca del centro de la fila
  function masCerca() {
    const medio = pista.scrollLeft + pista.clientWidth / 2;
    let mejor = 0, dist = Infinity;
    cards.forEach((c, k) => { const d = Math.abs(c.offsetLeft + c.offsetWidth / 2 - medio); if (d < dist) { dist = d; mejor = k; } });
    return mejor;
  }
  // Pone la card al medio. suave: con animacion (salvo que la persona prefiera sin movimiento).
  function ir(i, suave = true) {
    i = Math.max(0, Math.min(cards.length - 1, i));
    const c = cards[i];
    if (pista.clientWidth) pista.scrollTo({ left: c.offsetLeft - (pista.clientWidth - c.offsetWidth) / 2, behavior: suave && !sinMovimiento.matches ? 'smooth' : 'instant' });
    if (i !== actual) { marcar(i); o.alCambiar(i); }
    else marcar(i);
  }
  // mientras se desliza se va marcando la que queda al medio (con un cuadro de espera, para no recalcular de mas)
  pista.addEventListener('scroll', () => {
    if (esperando) return;
    esperando = requestAnimationFrame(() => {
      esperando = 0;
      if (!pista.clientWidth) return;   // (escondido, por ejemplo mientras se corre o se carga: la fila vuelve a cero y no cuenta)
      const i = masCerca();
      if (i !== actual) { marcar(i); o.alCambiar(i); }
    });
  }, { passive: true });
  $('homeAtras').addEventListener('click', () => ir(actual - 1));
  $('homeAdelante').addEventListener('click', () => ir(actual + 1));
  // las flechas del teclado (no cuando se escribe en un campo, ni con algo encima)
  document.addEventListener('keydown', (e) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
    const donde = document.activeElement && document.activeElement.tagName;
    if (donde === 'INPUT' || donde === 'TEXTAREA' || donde === 'SELECT' || !o.puedeTeclas()) return;
    e.preventDefault();
    ir(actual + (e.key === 'ArrowRight' ? 1 : -1));
  });
  // si cambia el tamaño de la pantalla, la card sigue al medio
  window.addEventListener('resize', () => { if (!$('portada').hidden) ir(actual, false); });
  marcar(0);

  return {
    ir,
    actual: () => actual,
    clave: () => o.cards[actual].clave,
    // al volver a mostrarse el inicio (estaba escondido) la fila se acomoda de nuevo
    acomodar: () => ir(actual, false),
  };
}

// Mandos. En la compu: WASD o flechas y Espacio. En el celular: pedales en pantalla
// e inclinar el aparato para doblar (o flechas en pantalla si no hay sensor).
// El resto de las teclas y botones avisa con "alTocar".
export function crearTeclas(alTocar) {
  const abajo = new Set();
  const MANEJO = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.target.tagName === 'INPUT') return;   // escribiendo el nombre no se maneja
    if (MANEJO.includes(e.code)) e.preventDefault();
    if (!e.repeat) alTocar(e.code);
    abajo.add(e.code);
  });
  window.addEventListener('keyup', (e) => abajo.delete(e.code));
  window.addEventListener('blur', () => abajo.clear());

  // --- botones en pantalla: cada uno vale por una tecla (atributo data-tecla) ---
  document.querySelectorAll('[data-tecla]').forEach((b) => {
    const tecla = b.dataset.tecla;
    const soltar = () => { abajo.delete(tecla); b.classList.remove('apretado'); };
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      try { b.setPointerCapture(e.pointerId); } catch (x) { /* sin captura: igual anda */ }
      if (!abajo.has(tecla)) alTocar(tecla);
      abajo.add(tecla);
      b.classList.add('apretado');
    });
    b.addEventListener('pointerup', soltar);
    b.addEventListener('pointercancel', soltar);
    b.addEventListener('lostpointercapture', soltar);
    b.addEventListener('contextmenu', (e) => e.preventDefault());
  });

  // --- inclinacion del celular ---
  const RAD = Math.PI / 180, FONDO = Math.sin(24 * RAD);   // con 24 grados de inclinacion el volante llega a fondo
  let tactil = false, hayInclina = false, inclina = 0, toque = '', avisar = null;
  window.addEventListener('pointerdown', (e) => { toque = e.pointerType; }, true);

  function orientacion(e) {
    if (e.beta === null || e.gamma === null) return;
    // hacia donde queda "arriba" visto desde el aparato (x = su derecha, y = su borde de arriba)
    const ux = -Math.cos(e.beta * RAD) * Math.sin(e.gamma * RAD), uy = Math.sin(e.beta * RAD);
    // segun como este girada la pantalla, cuanto de ese "arriba" cae sobre su eje horizontal:
    // eso dice que lado de la pantalla esta mas bajo
    const a = (screen.orientation ? screen.orientation.angle : window.orientation) || 0, giro = ((a % 360) + 360) % 360;
    const lado = giro === 90 ? -uy : giro === 270 ? uy : giro === 180 ? -ux : ux;
    let v = -lado / FONDO;
    v = Math.abs(v) < 0.08 ? 0 : (v - Math.sign(v) * 0.08) / 0.92;   // zona muerta en el centro
    inclina = Math.max(-1, Math.min(1, v));
    if (!hayInclina) { hayInclina = true; if (avisar) avisar(true); }
  }

  return {
    abajo,
    // true si el ultimo toque fue con el dedo (o si todavia no toco nada y el aparato es tactil)
    esTactil: () => toque === 'touch' || (toque === '' && window.matchMedia('(pointer: coarse)').matches),
    // prende los mandos de celular. Hay que llamarlo desde un toque: el iPhone pide permiso para el sensor.
    // "alSaber" recibe true cuando la inclinacion empieza a funcionar, o false si al rato no llego nada
    // (entonces hay que mostrar las flechas).
    celular: (alSaber) => {
      if (tactil) return;
      tactil = true;
      avisar = alSaber;
      const D = window.DeviceOrientationEvent;
      const escuchar = () => window.addEventListener('deviceorientation', orientacion);
      if (D && D.requestPermission) D.requestPermission().then((r) => { if (r === 'granted') escuchar(); }).catch(() => {});
      else if (D) escuchar();
      setTimeout(() => { if (!hayInclina) alSaber(false); }, 1500);
    },
    // posicion del volante por inclinacion (-1 a 1), o null si no se esta usando
    volante: () => (tactil && hayInclina ? inclina : null),
    leer: (ent) => {
      const t = (a, b) => (abajo.has(a) || abajo.has(b) ? 1 : 0);
      ent.x = t('KeyD', 'ArrowRight') - t('KeyA', 'ArrowLeft');
      if (ent.x === 0 && tactil && hayInclina) ent.x = inclina;
      ent.y = t('KeyW', 'ArrowUp') - t('KeyS', 'ArrowDown');
      ent.mano = abajo.has('Space');
      return ent;
    },
  };
}

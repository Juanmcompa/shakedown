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
  // En el iPhone, dejar el dedo apoyado en un boton lo "levanta" para arrastrarlo (como a un texto o a una imagen), y el
  // navegador le saca el toque al juego: el pedal queda suelto. Se evita atajando el toque antes de que el navegador haga
  // algo con el (ademas de lo que ya pide el estilo: que no se seleccione ni se arrastre nada).
  const sinGestos = (e) => { if (e.cancelable) e.preventDefault(); };
  document.addEventListener('dragstart', sinGestos);
  // (pellizcar para agrandar la pagina, mientras se maneja, tampoco)
  document.addEventListener('gesturestart', (e) => { if (document.documentElement.classList.contains('jugando')) sinGestos(e); });
  document.querySelectorAll('[data-tecla]').forEach((b) => {
    const tecla = b.dataset.tecla;
    const soltar = () => { abajo.delete(tecla); b.classList.remove('apretado'); };
    for (const tipo of ['touchstart', 'touchmove', 'touchend']) b.addEventListener(tipo, sinGestos, { passive: false });
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
  const RAD = Math.PI / 180;
  let fondo = Math.sin(24 * RAD);   // con cuanta inclinacion el volante llega a fondo (se cambia en la configuracion)
  let conFlechas = false;           // true = se eligio doblar con las flechas en pantalla, aunque haya sensor
  let tactil = false, hayInclina = false, inclina = 0, toque = '', avisar = null, pedido = false, sabido = null;
  window.addEventListener('pointerdown', (e) => { toque = e.pointerType; }, true);

  function orientacion(e) {
    if (e.beta === null || e.gamma === null) return;
    // hacia donde queda "arriba" visto desde el aparato (x = su derecha, y = su borde de arriba)
    const ux = -Math.cos(e.beta * RAD) * Math.sin(e.gamma * RAD), uy = Math.sin(e.beta * RAD);
    // segun como este girada la pantalla, cuanto de ese "arriba" cae sobre su eje horizontal:
    // eso dice que lado de la pantalla esta mas bajo
    const a = (screen.orientation ? screen.orientation.angle : window.orientation) || 0, giro = ((a % 360) + 360) % 360;
    const lado = giro === 90 ? -uy : giro === 270 ? uy : giro === 180 ? -ux : ux;
    let v = -lado / fondo;
    v = Math.abs(v) < 0.08 ? 0 : (v - Math.sign(v) * 0.08) / 0.92;   // zona muerta en el centro
    inclina = Math.max(-1, Math.min(1, v));
    if (!hayInclina) { hayInclina = true; sabido = true; if (avisar) avisar(true); }
  }
  // Empieza a escuchar el sensor. Hay que llamarlo desde un toque: el iPhone pide permiso.
  // Si al rato no llego nada, se da por hecho que no hay sensor (y se muestran las flechas).
  function pedirSensor() {
    if (pedido) return;
    pedido = true;
    const D = window.DeviceOrientationEvent;
    const escuchar = () => window.addEventListener('deviceorientation', orientacion);
    if (D && D.requestPermission) D.requestPermission().then((r) => { if (r === 'granted') escuchar(); }).catch(() => {});
    else if (D) escuchar();
    setTimeout(() => { if (!hayInclina) { sabido = false; if (avisar) avisar(false); } }, 1500);
  }

  return {
    abajo,
    // true si el ultimo toque fue con el dedo (o si todavia no toco nada y el aparato es tactil)
    esTactil: () => toque === 'touch' || (toque === '' && window.matchMedia('(pointer: coarse)').matches),
    // prende los mandos de celular. Hay que llamarlo desde un toque: el iPhone pide permiso para el sensor.
    // "alSaber" recibe true cuando la inclinacion empieza a funcionar, o false si al rato no llego nada
    // (entonces hay que mostrar las flechas).
    celular: (alSaber) => {
      tactil = true;
      avisar = alSaber;
      if (!conFlechas) pedirSensor();   // (con las flechas en pantalla no hace falta el sensor ni su permiso)
      if (sabido !== null) alSaber(sabido);
    },
    // (para la configuracion) empieza a escuchar el sensor sin prender los mandos, para poder probar la sensibilidad
    probarSensor: pedirSensor,
    // la inclinacion ahora mismo, de -1 a 1, o null si no hay sensor (o todavia no se sabe)
    inclinacion: () => (hayInclina ? inclina : null),
    // cambia como se dobla. grados: cuanto hay que inclinar para llevar el volante a fondo. flechas: true = con las flechas en pantalla.
    ajustar: (o) => { if (o.grados) fondo = Math.sin(Math.max(6, Math.min(70, o.grados)) * RAD); if (o.flechas !== undefined) conFlechas = !!o.flechas; },
    // posicion del volante por inclinacion (-1 a 1), o null si no se esta usando
    volante: () => (tactil && hayInclina && !conFlechas ? inclina : null),
    leer: (ent) => {
      const t = (a, b) => (abajo.has(a) || abajo.has(b) ? 1 : 0);
      ent.x = t('KeyD', 'ArrowRight') - t('KeyA', 'ArrowLeft');
      if (ent.x === 0 && tactil && hayInclina && !conFlechas) ent.x = inclina;
      ent.y = t('KeyW', 'ArrowUp') - t('KeyS', 'ArrowDown');
      ent.mano = abajo.has('Space');
      return ent;
    },
  };
}

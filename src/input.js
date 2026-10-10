// Teclado: WASD o flechas para manejar, Espacio freno de mano. El resto avisa con "alTocar".
export function crearTeclas(alTocar) {
  const abajo = new Set();
  const MANEJO = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (MANEJO.includes(e.code)) e.preventDefault();
    if (!e.repeat) alTocar(e.code);
    abajo.add(e.code);
  });
  window.addEventListener('keyup', (e) => abajo.delete(e.code));
  window.addEventListener('blur', () => abajo.clear());
  const t = (a, b) => (abajo.has(a) || abajo.has(b) ? 1 : 0);
  return {
    abajo,
    leer: (ent) => {
      ent.x = t('KeyD', 'ArrowRight') - t('KeyA', 'ArrowLeft');
      ent.y = t('KeyW', 'ArrowUp') - t('KeyS', 'ArrowDown');
      ent.mano = abajo.has('Space');
      return ent;
    },
  };
}

// Papelitos: al llegar a la meta salen papelitos de colores desde las dos esquinas de abajo, como en la cancha, y caen
// sobre la pantalla (tambien sobre el resultado). Son cuadraditos de pocos pixeles, como todo el dibujo del juego: se
// pintan en un lienzo chico que se ve agrandado y sin suavizar. No tapan los toques.
// Si el aparato pide menos movimiento (una opcion de accesibilidad), no salen.
// (El lienzo esta en index.html: #papelitos.)

const COLORES = ['#f2c200', '#f2c200', '#5cc070', '#ff6a52', '#ffffff', '#49b3d6', '#f58a2a'];
const PIXEL = 3;          // cada pixel del lienzo mide 3 pixeles de pantalla
const GRAVEDAD = 260;     // en pixeles del lienzo por segundo al cuadrado

export function crearPapelitos(lienzo) {
  const g = lienzo.getContext('2d');
  let papelitos = [], andando = false, antes = 0;

  function medir() {
    const w = Math.max(1, Math.round(window.innerWidth / PIXEL)), h = Math.max(1, Math.round(window.innerHeight / PIXEL));
    if (lienzo.width !== w || lienzo.height !== h) { lienzo.width = w; lienzo.height = h; }
  }

  // cuantos: cuantos papelitos (de los dos lados). fuerza: que tan alto llegan (1 = hasta arriba de la pantalla)
  function tirar(cuantos = 160, fuerza = 1) {
    try { if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return; } catch (e) { /* sin consulta: salen */ }
    medir();
    const W = lienzo.width, H = lienzo.height, alto = Math.sqrt(2 * GRAVEDAD * H) * fuerza;
    for (let i = 0; i < cuantos; i++) {
      const lado = i % 2 ? 1 : -1;   // de la esquina de abajo a la izquierda (-1) o a la derecha (1), hacia el medio
      papelitos.push({
        x: lado < 0 ? -2 : W + 2, y: H + 2 + Math.random() * 6,
        vx: -lado * (0.12 + Math.random() * 0.42) * W, vy: -alto * (0.55 + Math.random() * 0.5),
        ancho: 2 + Math.floor(Math.random() * 3), largo: 2 + Math.floor(Math.random() * 2),
        color: COLORES[Math.floor(Math.random() * COLORES.length)],
        giro: Math.random() * 6.28, vgiro: (Math.random() - 0.5) * 18,
        vaiven: Math.random() * 6.28, demora: Math.random() * 0.35, aire: 3.6 + Math.random() * 1.8,
      });
    }
    if (!andando) { andando = true; lienzo.hidden = false; antes = performance.now(); requestAnimationFrame(paso); }
  }

  function paso(ahora) {
    const dt = Math.min(0.1, (ahora - antes) / 1000);
    antes = ahora;
    const W = lienzo.width, H = lienzo.height;
    g.clearRect(0, 0, W, H);
    for (const p of papelitos) {
      if (p.demora > 0) { p.demora -= dt; continue; }
      // suben como tirados con la mano, y al caer flotan: el aire los frena (caen despacio, cada uno a su ritmo) y los mece
      const cae = p.vy > 0;
      p.vy += (GRAVEDAD - (cae ? p.vy * p.aire : 0)) * dt;
      p.vx -= p.vx * Math.min(1, (cae ? 1.6 : 0.35) * dt);
      p.vaiven += dt * 4.5;
      p.x += (p.vx + (cae ? Math.sin(p.vaiven) * 26 : 0)) * dt;
      p.y += p.vy * dt;
      p.giro += p.vgiro * dt;
      // al girar se lo ve de canto: se angosta (como un papel que da vueltas)
      const ancho = Math.max(1, Math.round(p.ancho * Math.abs(Math.cos(p.giro))));
      g.fillStyle = p.color;
      g.fillRect(Math.round(p.x), Math.round(p.y), ancho, p.largo);
    }
    papelitos = papelitos.filter((p) => !(p.vy > 0 && p.y > H + 4) && p.x > -40 && p.x < W + 40);   // (los que ya cayeron, afuera)
    if (papelitos.length) requestAnimationFrame(paso);
    else { andando = false; g.clearRect(0, 0, W, H); lienzo.hidden = true; }
  }

  // (al salir de la pasada antes de que terminen de caer, se los saca)
  const limpiar = () => { papelitos = []; };
  return { tirar, limpiar, andando: () => andando };
}

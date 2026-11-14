// Reparto: el remolque del semi. La cabina (el tractor) es el auto de siempre, con su fisica; el remolque va enganchado
// atras, en el plato, y lo sigue como un remolque de verdad: su eje no resbala de costado, asi que el remolque siempre
// apunta hacia el plato. Andando para adelante se acomoda solo detras del tractor; marcha atras se cruza para el lado
// contrario al que se dobla, y si se lo deja ir se pliega (se lo frena a 75 grados: mas no se puede doblar).
//
// El remolque es solido: si va a meterse en una casa, en un poste o en otro vehiculo, el tractor no puede hacer ese
// movimiento (se lo vuelve atras y se frena, como contra una pared).
const lim = (v, a, b) => (v < a ? a : v > b ? b : v);
const MAXIMO = 75 * Math.PI / 180;   // lo mas que se puede doblar el remolque contra el tractor

// R: las medidas del remolque (ver TIPOS.semi en vehiculos.js). centro: el centro del tractor respecto de su medio.
export function crearRemolque(R, centro = 0) {
  const L = R.largo - R.perno - R.eje;   // del perno (en el plato) al eje
  const s = { ax: 0, az: 0, th: 0 }, g = { ax: 0, az: 0, th: 0, pos: [0, 0, 0], q: [0, 0, 0, 1] };
  const H = { x: 0, z: 0 };
  const rumboDe = (c) => Math.atan2(c.adelante[0], -c.adelante[2]);
  // el plato: detras del centro del tractor
  function plato(c) {
    const fx = c.adelante[0], fz = c.adelante[2], l = Math.hypot(fx, fz) || 1, d = R.plato + centro;
    H.x = c.pos[0] - fx / l * d; H.z = c.pos[2] - fz / l * d;
    return H;
  }
  // pone el remolque derecho detras del tractor
  function poner(c) {
    plato(c);
    s.th = rumboDe(c);
    s.ax = H.x - Math.sin(s.th) * L; s.az = H.z + Math.cos(s.th) * L;
  }
  // despues de mover el tractor: el remolque sigue al plato (el eje queda a L del perno, en la linea que los une)
  function seguir(c) {
    plato(c);
    let dx = H.x - s.ax, dz = H.z - s.az;
    const d = Math.hypot(dx, dz) || 1;
    dx /= d; dz /= d;
    let th = Math.atan2(dx, -dz);
    // no se dobla mas que el maximo contra el tractor
    let phi = rumboDe(c) - th;
    phi = Math.atan2(Math.sin(phi), Math.cos(phi));
    if (Math.abs(phi) > MAXIMO) th = rumboDe(c) - Math.sign(phi) * MAXIMO;
    s.th = th;
    s.ax = H.x - Math.sin(th) * L; s.az = H.z + Math.cos(th) * L;
  }
  // el centro del remolque y su direccion (adelante)
  function caja() {
    const fx = Math.sin(s.th), fz = -Math.cos(s.th), m = R.largo / 2 - R.perno;
    return { x: s.ax + fx * L - fx * m, z: s.az + fz * L - fz * m, fx, fz };
  }
  // si el remolque se mete en algo: se prueban puntos de su borde (cada ~1 m) contra lo que hay cerca
  function choca(T) {
    const k = caja(), px = -k.fz, pz = k.fx, hl = R.largo / 2, hw = R.ancho;
    for (let a = -hl; a <= hl + 0.01; a += hl / 5) for (const b of [-hw, hw]) if (dentro(T, k.x + k.fx * a + px * b, k.z + k.fz * a + pz * b)) return true;
    for (const a of [-hl, hl]) for (let b = -hw; b <= hw; b += hw / 2) if (dentro(T, k.x + k.fx * a + px * b, k.z + k.fz * a + pz * b)) return true;
    return false;
  }
  function dentro(T, x, z) {
    const lista = T.cosasCerca(x, z);
    if (!lista) return false;
    for (const o of lista) {
      if (o.roto || o.cede) continue;
      const dx = x - o.x, dz = z - o.z;
      if (o.hx) { const ex = dx * o.ux + dz * o.uz, ez = dz * o.ux - dx * o.uz; if (Math.abs(ex) < o.hx && Math.abs(ez) < o.hz) return true; }
      else if (dx * dx + dz * dz < o.r * o.r) return true;
    }
    return false;
  }
  // antes de cada paso de la fisica se guarda como estaba todo; si el remolque choca, se vuelve ahi
  function guardar(c) {
    g.ax = s.ax; g.az = s.az; g.th = s.th;
    for (let i = 0; i < 3; i++) g.pos[i] = c.pos[i];
    for (let i = 0; i < 4; i++) g.q[i] = c.q[i];
  }
  function volver(c) {
    s.ax = g.ax; s.az = g.az; s.th = g.th;
    for (let i = 0; i < 3; i++) c.pos[i] = g.pos[i];
    for (let i = 0; i < 4; i++) c.q[i] = g.q[i];
    const v = Math.hypot(c.vel[0], c.vel[2]);
    if (v > c.impacto) { c.impacto = v; c.contra = 'edificio'; }
    c.vel[0] *= -0.15; c.vel[2] *= -0.15; c.w[0] = c.w[1] = c.w[2] = 0;
  }
  // la cola del remolque (para estacionar de culata) y hacia donde apunta
  function cola() { const k = caja(), m = R.largo / 2; return { x: k.x - k.fx * m, z: k.z - k.fz * m, fx: k.fx, fz: k.fz }; }
  // pone un dibujo (un grupo con el origen en el medio del remolque, en el piso) donde esta el remolque
  function ubicar(grupo) { const k = caja(); grupo.position.set(k.x, 0, k.z); grupo.rotation.set(0, -s.th, 0); }
  // cuanto esta doblado contra el tractor (radianes)
  const doblado = (c) => { const p = rumboDe(c) - s.th; return Math.atan2(Math.sin(p), Math.cos(p)); };
  return { poner, seguir, choca, guardar, volver, cola, ubicar, caja, doblado, rumbo: () => s.th, L };
}

// Para las versiones pasadas (sin fisica): donde va el remolque, sabiendo donde estaba el tractor y hacia donde apuntaba
// el remolque. Devuelve el centro y la direccion, como caja().
export function remolqueDe(R, centro, x, z, rumbo, th) {
  const L = R.largo - R.perno - R.eje, d = R.plato + centro, m = R.largo / 2 - R.perno;
  const hx = x - Math.sin(rumbo) * d, hz = z + Math.cos(rumbo) * d, fx = Math.sin(th), fz = -Math.cos(th);
  return { x: hx - fx * m, z: hz - fz * m, fx, fz, th, L: lim(L, 0, 99) };
}

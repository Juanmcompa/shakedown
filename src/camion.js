// GUARDADO SIN USAR: el camion se probo en La Montaña del Sufrimiento (v1 a v4) y se volvio atras (v5: ahora se corre con el auto
// del garaje y la fisica de siempre). Ningun modulo del juego lo importa ni esta en la lista "modulos" de index.html; queda por si se lo
// quiere retomar para otra cosa. Para usarlo de nuevo hay que volver a conectarlo (main.js, hud, reglas, fantasma, menu, camara).
// El camion de carga de "La Montaña del Sufrimiento" (circuito 'montana'): fisica pesada, aparte de la del auto.
// Es un cuerpo rigido con cuatro ruedas, como vehicle.js, pero:
//  - el motor da TORQUE a las ruedas (no velocidad): cada rueda tiene su propio giro. Si el torque pasa lo que agarra el
//    piso, la rueda patina (se va de vueltas) y, en el barro, se hunde: acelerar a fondo te entierra, hay que dar toques.
//  - la suspension es muy blanda y larga: se siente el peso de cada eje y el camion se inclina.
//  - en la caja van bultos (cajones atados con cuerdas elasticas y troncos sueltos). Cada bulto es una masa que desliza
//    sobre la tabla con rozamiento: lo que empuja o carga sobre el camion se suma a sus fuerzas (asi el centro de masa del
//    conjunto se corre solo cuando la carga se desplaza), y si se pasa del borde, o la cuerda se corta, se pierde.
// No usa azar: todo sale del paso fijo (JUEGO.paso), asi el camion es determinista y el fantasma por link es fiel.
// Los demas circuitos, la pista del dia y la Travesia no pasan por aca: siguen usando vehicle.js.
import { JUEGO, SUELOS, SUELO } from './config.js';

const lim = (v, a, b) => (v < a ? a : v > b ? b : v);
const G = JUEGO.gravedad;
export const BULTOS_TOTAL = 6;
export const RECARGO_BULTO = 60;        // segundos que suma cada bulto perdido
export const CODIGO_CAMION = '353';     // con que codigo de partes figura en las tablas (el Camioncito de partes.js)
// el tiempo de referencia de La Montaña del Sufrimiento (segundos): lo que tarda un buen piloto con la carga, por sector (de ahi salen los cuadritos de colores)
export const PAR_CAMION = { sectores: [190, 345, 75, 120, 80], total: 810 };   // (v3: camino angosto; salen del piloto "normal" de tools/pilotocamion.mjs)

// --- el camion: mismos nombres que los autos de config.js, mas lo propio (torque, ruedas, cubierta de la caja) ---
export const CAMION_CARGA = {
  nombre: 'El Carguero', detalle: 'Camión de carga: pesado, blando y con la carga suelta', emoji: '🚛', modelo: 'carguero', codigo: CODIGO_CAMION,
  masa: 3300, inercia: [11000, 10800, 3300], ejes: 1.7, trocha: 0.88, radio: 0.47, anclaje: 0.1, centro: 0.25,
  // suspension muy blanda: cede unos 30 cm con la carga puesta y rebota (poco amortiguador)
  resorteLargo: 0.66, recorrido: 0.48, resorte: 31000, amortigua: [2300, 3000],
  // motor: torque maximo en las ruedas (N·m, entre las cuatro), potencia (W) y la velocidad a la que corta (m/s)
  torque: 7200, potencia: 98000, corta: 15, pedal: [0.7, 3.5, 0.55], suelta: [0.7, 3.5], giroRueda: 0, inerciaRueda: 55,
  // frenos: en "g" de todo el peso; parte que frenan las de adelante
  frenos: 0.72, frenoAdelante: 0.55, frenoMotor: 0.1, reversa: 0.5, aire: 4.6,
  giro: 0.5, giroFino: 0.2, giroVel: 1.9, lateral: 0.28, deriva: 0.15, firme: 0.5, patinaje: 0.85, alturaLateral: 0.55,
  cubiertas: [0.98, 1.1], reparto: 0.45,
  caja: [1.15, 3.0, -0.55, 1.7], choque: [1.0, 1.9], chasis: [200000, 12000, 0.5], roce: 0.35, aguante: 1.6,
};

// Como cambia cada suelo para el camion: mu (por cuanto se multiplica el agarre), res (rodar mas duro: parte del peso),
// hunde (cuanto se entierra la rueda que patina, 1 = lo normal), visc (freno que crece con la velocidad)
const NORMAL = { mu: 1, res: 0, hunde: 0, visc: 0 };
// (v4: el barro es jabon, no pegamento. lat: cuanto del agarre de costado queda (menos = se desliza), baja: cuanto tira hacia el lado
// bajo de la rodada o la ladera, gasta: cuanto agarre se come el motor (mas = la cola se cruza al acelerar), blando: lleva control de traccion)
const SUELO_CAMION = {
  [SUELOS.barro.id]: { mu: 0.42, res: 0.0, hunde: 0.3, visc: 450, lat: 0.35, baja: 2.5, gasta: 1.0, blando: true },
  [SUELOS.pantano.id]: { mu: 0.4, res: 0.02, hunde: 0.2, visc: 120, lat: 0.45, baja: 2.5, gasta: 1.0, blando: true },
  [SUELOS.charco.id]: { mu: 0.85, res: 0.06, hunde: 0.4, visc: 120, lat: 0.7, blando: true },
  [SUELOS.lecho.id]: { mu: 0.8, res: 0.03, hunde: 0, visc: 150 },
  [SUELOS.pasto.id]: { mu: 0.95, res: 0.03, hunde: 0.2, visc: 40 },
};
const TRACCION_MIN = 0.1, TRACCION_DESDE = 0.5, TRACCION_RANGO = 1.5;   // control de traccion en suelo blando (ver c.paso)
const HUNDIDO_MAX = 0.12;   // metros que baja la rueda cuando esta del todo enterrada

// --- los bultos ---
//   tipo, medidas (mitad de cada lado: x a lo ancho, y alto, z a lo largo), masa, rozamiento [quieto, deslizando],
//   x y z: donde queda sobre la tabla, y atado (si lleva cuerdas)
const TABLA = { y: 0.5, ancho: 1.0, atras: 2.875, adelante: -0.125 };   // la caja, vista desde el camion (y = alto de la tabla)
const BULTOS = [
  { tipo: 'cajon', hx: 0.4, hy: 0.4, hz: 0.4, m: 140, mu: [0.62, 0.5], x: -0.52, z: 0.42, atado: true },
  { tipo: 'cajon', hx: 0.4, hy: 0.4, hz: 0.4, m: 140, mu: [0.62, 0.5], x: 0.52, z: 0.42, atado: true },
  { tipo: 'cajon', hx: 0.4, hy: 0.4, hz: 0.4, m: 140, mu: [0.62, 0.5], x: -0.52, z: 1.28, atado: true },
  { tipo: 'cajon', hx: 0.4, hy: 0.4, hz: 0.4, m: 120, mu: [0.55, 0.45], x: 0.52, z: 1.28, atado: false },
  { tipo: 'tronco', hx: 0.95, hy: 0.25, hz: 0.25, m: 220, mu: [0.5, 0.38], x: 0, z: 1.98, atado: false },
  { tipo: 'tronco', hx: 0.95, hy: 0.25, hz: 0.25, m: 220, mu: [0.5, 0.38], x: 0, z: 2.5, atado: false },
];
// cuerdas elasticas: [rigidez N/m, amortiguacion, cuanto se estira antes de cortarse (m), cuanto menos mide que lo que hay en reposo]
const CUERDA = { k: 6800, c: 260, corte: 0.5, tension: 0.03 };
const CONTACTO = { k: 90000, c: 2300 };    // el resorte entre el bulto y la tabla (rebota un poco)
const SALTA = 2.0;                          // contra la cabina: si llega a mas de esta velocidad hacia adelante, pasa por encima

// los ejes del camion en el mundo, a partir del cuaternion q
function ejesDe(q, e) {
  const qx = q[0], qy = q[1], qz = q[2], qw = q[3];
  e.r[0] = 1 - 2 * (qy * qy + qz * qz); e.r[1] = 2 * (qx * qy + qw * qz); e.r[2] = 2 * (qx * qz - qw * qy);
  e.u[0] = 2 * (qx * qy - qw * qz); e.u[1] = 1 - 2 * (qx * qx + qz * qz); e.u[2] = 2 * (qy * qz + qw * qx);
  e.b[0] = 2 * (qx * qz + qw * qy); e.b[1] = 2 * (qy * qz - qw * qx); e.b[2] = 1 - 2 * (qx * qx + qy * qy);
  return e;
}

// La carga. Guarda el estado de cada bulto y, en cada paso, suma al camion lo que le hacen los bultos (peso, rozamiento,
// cuerdas, golpes). "acum" junta las fuerzas y los torques sobre el camion (respecto de su centro).
function crearCarga(terreno) {
  const e = { r: [1, 0, 0], u: [0, 1, 0], b: [0, 0, 1] };
  const bultos = BULTOS.map((d, id) => {
    const b = { id, ...d, p: [0, 0, 0], v: [0, 0, 0], estado: 'caja', tCae: 0, perdido: false, avisado: false,
      lx: d.x, lz: d.z, giro: [0, 0, 0], cuerdas: [], N: 0, desliza: 0, corrida: 0 };
    if (d.atado) for (const lado of [-1, 1]) b.cuerdas.push({ ancla: [lado * (TABLA.ancho + 0.02), TABLA.y + 0.02, d.z], largo: 0, rota: false, tension: 0, lado });
    return b;
  });
  const masaTotal = () => bultos.reduce((s, b) => s + (b.estado === 'caja' ? b.m : 0), 0);
  let nuevas = 0;   // bultos perdidos desde la ultima vez que se pregunto (el juego les suma el recargo)

  // deja un bulto en su lugar de la caja, quieto respecto del camion (c: el camion)
  function acomodar(b, c) {
    ejesDe(c.q, e);
    const x = b.x, y = TABLA.y + b.hy, z = b.z;
    for (let i = 0; i < 3; i++) b.p[i] = c.pos[i] + e.r[i] * x + e.u[i] * y + e.b[i] * z;
    for (let i = 0; i < 3; i++) b.v[i] = c.vel[i] + (i === 0 ? c.w[1] * (b.p[2] - c.pos[2]) - c.w[2] * (b.p[1] - c.pos[1]) : i === 1 ? c.w[2] * (b.p[0] - c.pos[0]) - c.w[0] * (b.p[2] - c.pos[2]) : c.w[0] * (b.p[1] - c.pos[1]) - c.w[1] * (b.p[0] - c.pos[0]));
    b.estado = 'caja'; b.tCae = 0; b.N = 0; b.desliza = 0; b.lx = x; b.lz = z;
    for (const k of b.cuerdas) {
      k.rota = false; k.tension = 0;
      const ax = c.pos[0] + e.r[0] * k.ancla[0] + e.u[0] * k.ancla[1] + e.b[0] * k.ancla[2], ay = c.pos[1] + e.r[1] * k.ancla[0] + e.u[1] * k.ancla[1] + e.b[1] * k.ancla[2], az = c.pos[2] + e.r[2] * k.ancla[0] + e.u[2] * k.ancla[1] + e.b[2] * k.ancla[2];
      const tx = b.p[0] + e.u[0] * b.hy, ty = b.p[1] + e.u[1] * b.hy, tz = b.p[2] + e.u[2] * b.hy;
      k.largo = Math.hypot(tx - ax, ty - ay, tz - az) - CUERDA.tension;
    }
  }
  // el camion se vuelve a apoyar en el camino: los bultos que no se perdieron vuelven a su lugar, y las cuerdas, atadas
  function reponer(c) { for (const b of bultos) if (!b.perdido) acomodar(b, c); }

  // un paso de la carga. Suma al camion (acum) lo que los bultos le hacen.
  function paso(c, dt, acum) {
    ejesDe(c.q, e);
    const { r, u, b: bk } = e, p0 = c.pos, v0 = c.vel, w0 = c.w;
    // lleva una fuerza sobre el camion, aplicada en un punto del mundo
    const sobreCamion = (fx, fy, fz, px, py, pz) => {
      const ox = px - p0[0], oy = py - p0[1], oz = pz - p0[2];
      acum.fx += fx; acum.fy += fy; acum.fz += fz;
      acum.tx += oy * fz - oz * fy; acum.ty += oz * fx - ox * fz; acum.tz += ox * fy - oy * fx;
    };
    for (const b of bultos) {
      const m = b.m, p = b.p, v = b.v;
      if (b.estado !== 'caja') {
        // perdido: cae como una piedra y rebota en el piso
        if (b.estado === 'fuera') continue;
        b.tCae += dt;
        v[1] -= G * dt;
        for (let i = 0; i < 3; i++) p[i] += v[i] * dt;
        const piso = terreno.altura(p[0], p[2]) + b.hy;
        if (p[1] < piso) {
          p[1] = piso;
          if (v[1] < 0) v[1] = -v[1] * 0.3;
          const roza = Math.exp(-2.2 * dt * 10);
          v[0] *= roza; v[2] *= roza;
          b.giro[0] *= 0.9; b.giro[1] *= 0.9; b.giro[2] *= 0.9;
          if (Math.hypot(v[0], v[1], v[2]) < 0.4 && b.tCae > 1) { b.estado = 'suelo'; v[0] = v[1] = v[2] = 0; }
        }
        if (b.estado === 'suelo' && b.tCae > 8) b.estado = 'fuera';
        continue;
      }
      // donde esta respecto del camion
      const dx = p[0] - p0[0], dy = p[1] - p0[1], dz = p[2] - p0[2];
      const lx = dx * r[0] + dy * r[1] + dz * r[2], ly = dx * u[0] + dy * u[1] + dz * u[2], lz = dx * bk[0] + dy * bk[1] + dz * bk[2];
      b.lx = lx; b.lz = lz;
      // velocidad del punto de la tabla que esta abajo del bulto
      const vbx = v0[0] + w0[1] * dz - w0[2] * dy, vby = v0[1] + w0[2] * dx - w0[0] * dz, vbz = v0[2] + w0[0] * dy - w0[1] * dx;
      // fuerzas que no son del contacto: el peso y las cuerdas
      let Fx = 0, Fy = -m * G, Fz = 0;
      for (const k of b.cuerdas) {
        k.tension = 0;
        if (k.rota) continue;
        const ax = p0[0] + r[0] * k.ancla[0] + u[0] * k.ancla[1] + bk[0] * k.ancla[2], ay = p0[1] + r[1] * k.ancla[0] + u[1] * k.ancla[1] + bk[1] * k.ancla[2], az = p0[2] + r[2] * k.ancla[0] + u[2] * k.ancla[1] + bk[2] * k.ancla[2];
        const tx = p[0] + u[0] * b.hy, ty = p[1] + u[1] * b.hy, tz = p[2] + u[2] * b.hy;
        let sx = tx - ax, sy = ty - ay, sz = tz - az;
        const largo = Math.hypot(sx, sy, sz) || 1e-6, estira = largo - k.largo;
        if (estira <= 0) continue;
        if (estira > CUERDA.corte) { k.rota = true; continue; }
        sx /= largo; sy /= largo; sz /= largo;
        // velocidad de estirarse (la del bulto menos la del ancla, en el sentido de la cuerda)
        const aox = ax - p0[0], aoy = ay - p0[1], aoz = az - p0[2];
        const vax = v0[0] + w0[1] * aoz - w0[2] * aoy, vay = v0[1] + w0[2] * aox - w0[0] * aoz, vaz = v0[2] + w0[0] * aoy - w0[1] * aox;
        const rel = (v[0] - vax) * sx + (v[1] - vay) * sy + (v[2] - vaz) * sz;
        const T = Math.max(0, CUERDA.k * estira + CUERDA.c * Math.max(0, rel));
        k.tension = T;
        Fx -= sx * T; Fy -= sy * T; Fz -= sz * T;
        sobreCamion(sx * T, sy * T, sz * T, ax, ay, az);
      }
      // el contacto con la tabla: un resorte (rebota un poco) y rozamiento
      const hundido = TABLA.y + b.hy - ly;           // cuanto se metio en la tabla (negativo = en el aire)
      let N = 0, Ftx = 0, Fty = 0, Ftz = 0;
      b.desliza = 0;
      if (hundido > -0.01) {
        const rel = (v[0] - vbx) * u[0] + (v[1] - vby) * u[1] + (v[2] - vbz) * u[2];
        N = lim(CONTACTO.k * Math.max(hundido, 0) - CONTACTO.c * rel, 0, m * G * 8);
        // lo que le haria falta al bulto para seguir a la tabla en este paso, sin contar el contacto. (No se adelanta como acelera
        // la tabla: con eso el camion y la carga se empujan uno al otro y tiemblan en cada paso.)
        let gx = m * (vbx - v[0]) / dt - Fx, gy = m * (vby - v[1]) / dt - Fy, gz = m * (vbz - v[2]) / dt - Fz;
        const gn = gx * u[0] + gy * u[1] + gz * u[2];
        gx -= gn * u[0]; gy -= gn * u[1]; gz -= gn * u[2];
        const gl = Math.hypot(gx, gy, gz);
        if (gl > 1e-6) {
          const quieto = b.mu[0] * N, desliza = b.mu[1] * N;
          if (gl <= quieto) { Ftx = gx; Fty = gy; Ftz = gz; }
          else { const f = desliza / gl; Ftx = gx * f; Fty = gy * f; Ftz = gz * f; b.desliza = Math.min(1, (gl - quieto) / (quieto + 1)); }
        }
        // sobre el camion: el apoyo (con el rozamiento aplicado abajo de la caja, y el apoyo corrido hacia atras de lo que
        // empuja: asi, si hay mucha fuerza a esa altura, el bulto "se vuelca" sobre un borde y carga mas ese lado)
        const ftr = Ftx * r[0] + Fty * r[1] + Ftz * r[2], ftb = Ftx * bk[0] + Fty * bk[1] + Ftz * bk[2];
        const cx = N > 1 ? lim(-ftr * b.hy / N, -(b.hx - 0.02), b.hx - 0.02) : 0, cz = N > 1 ? lim(-ftb * b.hy / N, -(b.hz - 0.02), b.hz - 0.02) : 0;
        b.corrida = cx;
        const px = p[0] - u[0] * b.hy + r[0] * cx + bk[0] * cz, py = p[1] - u[1] * b.hy + r[1] * cx + bk[1] * cz, pz = p[2] - u[2] * b.hy + r[2] * cx + bk[2] * cz;
        sobreCamion(-(u[0] * N + Ftx), -(u[1] * N + Fty), -(u[2] * N + Ftz), px, py, pz);
      }
      Fx += u[0] * N + Ftx; Fy += u[1] * N + Fty; Fz += u[2] * N + Ftz;
      b.N = N;
      v[0] += Fx / m * dt; v[1] += Fy / m * dt; v[2] += Fz / m * dt;
      p[0] += v[0] * dt; p[1] += v[1] * dt; p[2] += v[2] * dt;
    }
    // los bultos no se atraviesan: se empujan hasta separarse (en el plano de la tabla, entre cajas de la misma altura)
    for (let i = 0; i < bultos.length; i++) {
      const a = bultos[i];
      if (a.estado !== 'caja') continue;
      for (let j = i + 1; j < bultos.length; j++) {
        const o = bultos[j];
        if (o.estado !== 'caja') continue;
        const dx = o.p[0] - a.p[0], dy = o.p[1] - a.p[1], dz = o.p[2] - a.p[2];
        const lx = dx * r[0] + dy * r[1] + dz * r[2], lz = dx * bk[0] + dy * bk[1] + dz * bk[2];
        const px = a.hx + o.hx - Math.abs(lx), pz = a.hz + o.hz - Math.abs(lz);
        if (px <= 0 || pz <= 0) continue;
        const wa = o.m / (a.m + o.m), wo = a.m / (a.m + o.m);
        // se separan por el lado donde se metieron menos
        const sx = px < pz ? (lx < 0 ? -1 : 1) : 0, sz = px < pz ? 0 : (lz < 0 ? -1 : 1), dep = px < pz ? px : pz;
        const ex = sx * r[0] + sz * bk[0], ey = sx * r[1] + sz * bk[1], ez = sx * r[2] + sz * bk[2];
        for (let q = 0; q < 3; q++) { const ee = q === 0 ? ex : q === 1 ? ey : ez; a.p[q] -= ee * dep * wa; o.p[q] += ee * dep * wo; }
        // y se llevan lo que traian: la velocidad de acercarse se reparte
        const va = a.v[0] * ex + a.v[1] * ey + a.v[2] * ez, vo = o.v[0] * ex + o.v[1] * ey + o.v[2] * ez;
        if (va > vo) { const vm = (va * a.m + vo * o.m) / (a.m + o.m); for (let q = 0; q < 3; q++) { const ee = q === 0 ? ex : q === 1 ? ey : ez; a.v[q] += ee * (vm - va); o.v[q] += ee * (vm - vo); } }
      }
    }
    // los bordes de la caja: la cabina adelante (si llega muy fuerte la pasa por encima), el vacio por los otros tres lados
    for (const b of bultos) {
      if (b.estado !== 'caja') continue;
      const p = b.p, v = b.v;
      const dx = p[0] - p0[0], dy = p[1] - p0[1], dz = p[2] - p0[2];
      let lx = dx * r[0] + dy * r[1] + dz * r[2];
      const lz = dx * bk[0] + dy * bk[1] + dz * bk[2];
      b.lx = lx; b.lz = lz;
      let cae = Math.abs(lx) > TABLA.ancho - 0.02 || lz > TABLA.atras;
      if (!cae && lz - b.hz < TABLA.adelante) {
        const vx = v[0] - c.vel[0], vy = v[1] - c.vel[1], vz = v[2] - c.vel[2];
        const hacia = -(vx * bk[0] + vy * bk[1] + vz * bk[2]);   // velocidad hacia la cabina, respecto del camion
        if (hacia > SALTA) { cae = true; v[0] += u[0] * 2.6; v[1] += u[1] * 2.6; v[2] += u[2] * 2.6; }
        else {
          const falta = TABLA.adelante - (lz - b.hz);
          for (let q = 0; q < 3; q++) p[q] += bk[q] * falta;
          if (hacia > 0) {
            // frena de golpe contra la cabina: el golpe se lo lleva el camion
            for (let q = 0; q < 3; q++) v[q] += bk[q] * hacia;
            const J = b.m * hacia / dt;
            sobreCamion(-bk[0] * J, -bk[1] * J, -bk[2] * J, p[0], p[1] - u[1] * b.hy, p[2]);
          }
        }
      }
      if (cae) {
        b.estado = 'cae'; b.tCae = 0; b.perdido = true;
        // sale girando
        b.giro[0] = (b.id % 2 ? 1 : -1) * 2.5; b.giro[1] = (b.id % 3 - 1) * 1.7; b.giro[2] = (b.id % 2 ? -1 : 1) * 1.3;
        nuevas++;
      }
    }
  }

  return {
    bultos, paso, reponer, acomodar,
    // una pasada nueva: vuelven todos los bultos, atados de nuevo
    reiniciar: (c) => { for (const b of bultos) { b.perdido = false; b.estado = 'caja'; b.giro[0] = b.giro[1] = b.giro[2] = 0; acomodar(b, c); } nuevas = 0; },
    masa: masaTotal,
    quedan: () => bultos.filter((b) => b.estado === 'caja').length,
    perdidos: () => bultos.filter((b) => b.perdido).length,
    // cuantos bultos se perdieron desde la ultima vez que se pregunto
    nuevos: () => { const n = nuevas; nuevas = 0; return n; },
    olvidar: () => { nuevas = 0; },
  };
}

// --- el camion ---
export function crearCamion(terreno, C = CAMION_CARGA) {
  const c = {
    datos: C, camion: true,
    pos: [0, 0, 0], vel: [0, 0, 0], q: [0, 0, 0, 1], w: [0, 0, 0],
    adelante: [0, 0, -1], arriba: [0, 1, 0], derecha: [1, 0, 0],
    volante: 0, gas: 0, freno: 1, sentido: 1, frenando: false, mano: false, giroRuedas: 0,
    velocidad: 0, enPiso: 0, patina: 0, suelo: 0, agua: 0, golpe: 0, ruedas: [],
    impacto: 0, contra: '', rompio: [],
    // lo que muestra el tablero: cuanto se enterro la rueda que mas, el torque que se esta dando (0 a 1), el centro de masa
    hundido: 0, torque: 0, corriente: 0,
    centroMasa: { x: 0, z: 0, y: 0, masa: C.masa }, rolido: 0, cabeceo: 0, vuelco: 0,
  };
  const carga = crearCarga(terreno);
  c.carga = carga;
  c.cargaNueva = () => carga.reiniciar(c);
  const S = { agarre: 1, freno: 0, pasta: 0, id: 0, agua: 0 }, N = [0, 1, 0], CO = { fx: 0, fz: 0, f: 0 };
  const acum = { fx: 0, fy: 0, fz: 0, tx: 0, ty: 0, tz: 0 };
  const cubierta = SUELO.map((s) => C.cubiertas[s.blando >= 0.5 ? 1 : 0]);
  const deriva = SUELO.map((s) => C.deriva * (s.suelto || 1));
  const R = C.radio, I = C.inerciaRueda;
  for (let i = 0; i < 4; i++) {
    c.ruedas.push({ x: (i % 2 ? 1 : -1) * C.trocha, z: (i < 2 ? -1 : 1) * C.ejes + C.centro, delantera: i < 2, empuja: 1,
      largo: C.resorteLargo, toca: false, patina: 0, cruza: 0, giro: 0, suelo: 0, carga: 0, tope: 1, vl: 0, p: [0, 0, 0],
      w: 0, hundido: 0, desl: 0, blando: false });
  }
  const [ax, az, panza, techo] = C.caja;
  const puntos = [[0, panza, C.centro - C.ejes], [0, panza, C.centro + C.ejes], [0, panza, C.centro], [0, techo, C.centro + 0.2]];
  for (const x of [-ax, ax]) for (const z of [-az, az]) puntos.push([x, panza + 0.14, z + C.centro], [x * 0.9, techo, z * 0.5 + 0.2 + C.centro]);
  const [radioChoque, sepChoque] = C.choque;
  const masaCarga = BULTOS.reduce((s, b) => s + b.m, 0);

  // apoya el camion en un punto del mapa mirando hacia "rumbo" (y vuelve a poner la carga que quede, atada)
  c.poner = function (x, z, rumbo) {
    const sx = (terreno.altura(x + 1, z) - terreno.altura(x - 1, z)) / 2, sz = (terreno.altura(x, z + 1.4) - terreno.altura(x, z - 1.4)) / 2.8;
    const l = Math.hypot(sx, 1, sz), nx = -sx / l, ny = 1 / l, nz = -sz / l;
    const k = Math.hypot(nz, nx, 1 + ny), a = nz / k, b = -nx / k, d = (1 + ny) / k;
    const sy = Math.sin(-rumbo / 2), cy = Math.cos(-rumbo / 2);
    c.q[0] = a * cy - b * sy; c.q[1] = d * sy; c.q[2] = b * cy + a * sy; c.q[3] = d * cy;
    // a que altura queda el centro cuando esta apoyado, con toda la carga que le falte
    const reposo = C.resorteLargo + R - (C.masa + carga.masa() + (carga.masa() === 0 ? masaCarga * 0 : 0)) * G / 4 / C.resorte - C.anclaje + 0.03;
    c.pos[0] = x + nx * reposo; c.pos[1] = terreno.altura(x, z) + ny * reposo; c.pos[2] = z + nz * reposo;
    c.vel.fill(0); c.w.fill(0);
    c.volante = 0; c.gas = 0; c.sentido = 1; c.velocidad = 0; c.impacto = 0;
    c.adelante[0] = Math.sin(rumbo); c.adelante[1] = 0; c.adelante[2] = -Math.cos(rumbo);
    for (const r of c.ruedas) { r.largo = C.resorteLargo - 0.28; r.w = 0; r.hundido = 0; r.desl = 0; r.tope = 1; }
    carga.reponer(c);
  };

  // avanza la fisica un paso. ent: { x: volante -1..1, y: acelerador -1..1, mano: freno de mano }
  c.paso = function (ent, dt) {
    const p = c.pos, v = c.vel, w = c.w, q = c.q, m = C.masa, g = G;
    const qx = q[0], qy = q[1], qz = q[2], qw = q[3];
    const rx = 1 - 2 * (qy * qy + qz * qz), ry = 2 * (qx * qy + qw * qz), rz = 2 * (qx * qz - qw * qy);
    const ux = 2 * (qx * qy - qw * qz), uy = 1 - 2 * (qx * qx + qz * qz), uz = 2 * (qy * qz + qw * qx);
    const bx = 2 * (qx * qz + qw * qy), by = 2 * (qy * qz - qw * qx), bz = 1 - 2 * (qx * qx + qy * qy);
    const fx = -bx, fy = -by, fz = -bz;
    const vf = v[0] * fx + v[1] * fy + v[2] * fz;
    const mCarga = carga.masa(), mTotal = m + mCarga;

    // --- comandos ---
    // El pedal es progresivo: mantenerlo apretado sube el torque (rapido hasta pedal[2], despues de a poco: pedal[0] y pedal[1]
    // son los segundos que tarda en cada tramo). Soltarlo lo baja enseguida (suelta[1] por segundo) pero, con las ruedas
    // embarradas, de a poco (suelta[0]): asi un toque corto, de medio segundo, deja torque para arrancar y dar toques avanza.
    // Mantenido hasta el fondo, el torque pasa lo que agarra el barro, la rueda patina y se entierra (el control de traccion
    // de mas abajo lo deja avanzar un poco).
    let quiereGas = 0;
    c.frenando = false;
    if (ent.y > 0) { quiereGas = ent.y; c.sentido = 1; }
    else if (ent.y < 0) { if (vf > 1.2) c.frenando = true; else { quiereGas = -ent.y; c.sentido = -1; } }
    c.freno = c.frenando ? Math.min(1, -ent.y) : 1;
    let embarrada = false;
    for (const r of c.ruedas) if (r.toca && r.blando) embarrada = true;
    c.gas += lim(quiereGas - c.gas, -dt * (embarrada ? C.suelta[0] : C.suelta[1]), dt / (c.gas < C.pedal[2] ? C.pedal[0] : C.pedal[1]));
    c.mano = !!ent.mano;
    const giroMax = Math.min(C.giro, C.giroFino + 2 * C.ejes * 9 / Math.max(vf * vf, 4));
    const rapidez = C.giroVel * (Math.abs(ent.x) < Math.abs(c.volante) ? 1.7 : 1) * dt;
    c.volante += lim(ent.x - c.volante, -rapidez, rapidez);
    c.giroRuedas = lim(c.volante * giroMax, -C.giro, C.giro);

    // --- el motor: torque en las ruedas (el total se reparte entre las cuatro, algo mas a las que mas agarran) ---
    let wMedia = 0, grip = 1e-6;
    for (const r of c.ruedas) { wMedia += Math.abs(r.w) / 4; grip += r.tope; }
    const gobierna = 1 - lim((wMedia * R - C.corta) / 2, 0, 1);       // pasada la velocidad que corta, el motor suelta
    const torqueMax = Math.min(C.torque, C.potencia / Math.max(wMedia, 2)) * gobierna;
    const pedido = c.gas * c.sentido * (c.sentido < 0 ? C.reversa : 1);
    c.torque = c.gas * (torqueMax / C.torque);

    // --- fuerzas: gravedad y aire (la carga pesa a traves de la tabla: no se cuenta aca) ---
    const va = Math.hypot(v[0], v[1], v[2]);
    let Fx = -C.aire * va * v[0], Fy = -m * g - C.aire * va * v[1], Fz = -C.aire * va * v[2], Tx = 0, Ty = 0, Tz = 0;
    acum.fx = acum.fy = acum.fz = acum.tx = acum.ty = acum.tz = 0;

    // --- ruedas ---
    const total = C.resorteLargo + R, mr = (m + mCarga) / 4;
    let enPiso = 0, patina = 0, aguaMax = 0, hundidoMax = 0, corrienteMax = 0;
    for (let i = 0; i < 4; i++) {
      const r = c.ruedas[i];
      const ax_ = p[0] + rx * r.x + ux * C.anclaje + bx * r.z, ay = p[1] + ry * r.x + uy * C.anclaje + by * r.z, az_ = p[2] + rz * r.x + uz * C.anclaje + bz * r.z;
      let t = total;
      if (uy > 0.3) {
        t = (ay - terreno.altura(ax_, az_)) / uy;
        for (let k = 0; k < 2; k++) { t = lim(t, -0.5, 3); t += (ay - uy * t - terreno.altura(ax_ - ux * t, az_ - uz * t)) / uy; }
      }
      t += r.hundido * HUNDIDO_MAX;   // una rueda enterrada va mas abajo del piso que se ve
      r.toca = t < total;
      r.largo = lim(t - R, C.resorteLargo - C.recorrido - 0.08, C.resorteLargo);
      const reparto = 0.25 * (1 - C.reparto) + C.reparto * (r.tope / grip);
      // Control de traccion blando (el teclado y el pedal tactil son todo o nada): cada rueda que patina en barro o pantano recibe
      // menos torque, pero nunca del todo (TRACCION_MIN). Asi las que agarran tiran del camion y la que patina no se entierra sola.
      const traccion = r.blando ? 1 - (1 - TRACCION_MIN) * lim((Math.abs(r.desl) - TRACCION_DESDE) / TRACCION_RANGO, 0, 1) : 1;
      const Td = pedido * torqueMax * reparto * traccion;
      r.patina = 0; r.cruza = 0; r.carga = 0; r.tope = 0;
      if (!r.toca) {
        // en el aire: gira libre (y el motor la acelera)
        r.w += dt / I * (c.gas > 0.02 ? Td : -r.w * 40 * C.frenoMotor);
        r.w *= 1 - 0.6 * dt;
        r.giro += r.w * dt; r.vl = r.w * R * 0.5; r.hundido = Math.max(0, r.hundido - dt * 0.2);
        continue;
      }
      enPiso++;
      const comp = lim(total - t, 0, C.recorrido + 0.3);
      const cx = ax_ - ux * t, cy = ay - uy * t, cz = az_ - uz * t;
      terreno.normal(cx, cz, N);
      const nx = N[0], ny = N[1], nz = N[2];
      const den = Math.max(0.5, ux * nx + uy * ny + uz * nz);
      const ox = cx - p[0], oy = cy - p[1], oz = cz - p[2];
      const vx = v[0] + w[1] * oz - w[2] * oy, vy = v[1] + w[2] * ox - w[0] * oz, vz = v[2] + w[0] * oy - w[1] * ox;
      const ritmo = -(vx * nx + vy * ny + vz * nz) / den;
      let Fs = C.resorte * comp + C.amortigua[ritmo > 0 ? 0 : 1] * ritmo;
      if (comp > C.recorrido) { Fs += C.resorte * 7 * (comp - C.recorrido); if (ritmo > c.impacto) { c.impacto = ritmo; c.contra = 'piso'; } }
      const Nf = lim(Fs, 0, mTotal * g * 3) / den;
      r.carga = Nf;

      // direcciones de la rueda sobre el piso: l = hacia donde rueda, s = hacia su derecha
      const ang = r.delantera ? c.giroRuedas : 0, co = Math.cos(ang), si = Math.sin(ang);
      let lx = fx * co + rx * si, ly = fy * co + ry * si, lz = fz * co + rz * si;
      let k = lx * nx + ly * ny + lz * nz;
      lx -= nx * k; ly -= ny * k; lz -= nz * k;
      k = 1 / Math.hypot(lx, ly, lz); lx *= k; ly *= k; lz *= k;
      const sx = ly * nz - lz * ny, sy = lz * nx - lx * nz, sz = lx * ny - ly * nx;
      terreno.suelo(cx, cz, S);
      const tab = SUELO_CAMION[S.id] || NORMAL;
      r.blando = !!tab.blando;   // (barro y pantano: el charco y el pasto no llevan control de traccion)
      const vl = vx * lx + vy * ly + vz * lz, vs = vx * sx + vy * sy + vz * sz;
      r.vl = vl;
      // lo maximo que agarra la cubierta: se pierde algo cuando patina (el agarre "de arrancar" es mayor que el de patinar)
      // el pasto mojado en pendiente es una jabonosa: cuanto mas inclinado, menos agarra (afuera del camino, en las laderas)
      const muSuelo = S.id === SUELOS.pasto.id ? tab.mu * (1 - 0.45 * lim((0.985 - ny) / 0.06, 0, 1)) : tab.mu;
      const pico = S.agarre * cubierta[S.id] * muSuelo * Nf, suelta = tab.hunde > 0 ? 0.55 : 0.2;
      const tope = pico * (1 - suelta * lim((Math.abs(r.desl) - 0.6) / 2.5, 0, 1));
      r.tope = tope;

      // a lo largo: la rueda tiene su propio giro. Torque del motor, freno y la fuerza del piso (que se calcula implicita,
      // para que no se desarme con ruedas livianas contra un camion pesado)
      let wp = r.w + dt / I * Td;
      let Tb = 0;
      const bloqueada = c.mano && !r.delantera;
      if (c.frenando) Tb = C.frenos * mTotal * g * R * (r.delantera ? C.frenoAdelante : 1 - C.frenoAdelante) / 2 * c.freno;
      else if (c.gas < 0.02 && Math.abs(vf) < 0.8) Tb = C.frenos * mTotal * g * R / 4;           // quieto sin acelerar: se queda donde esta
      else if (c.gas < 0.02) Tb = C.frenoMotor * mTotal * g * R / 4;                               // soltar el pedal frena un poco (el motor)
      if (bloqueada) Tb = 9e5;
      if (Tb > 0) { const dw = dt * Tb / I; wp = Math.abs(wp) <= dw ? 0 : wp - Math.sign(wp) * dw; }
      const K = 0.2 * mr / dt;
      let Fl = K * (wp * R - vl) / (1 + K * dt * R * R / I);
      const rodar = (S.freno + tab.res * (1 + r.hundido * 1)) * Nf;
      Fl = lim(Fl, -tope, tope);
      r.w = wp - dt / I * Fl * R;
      // cuanto patina: la diferencia entre lo que gira la rueda y lo que avanza
      r.desl = r.w * R - vl;
      const patinando = lim((Math.abs(r.desl) - 0.7) / 4, 0, 1);
      if (c.gas > 0.02 && !c.frenando) r.patina = patinando;
      // resistencia a rodar, del barro y del agua
      Fl -= rodar * Math.tanh(vl / 0.4) + tab.visc * vl * (1 + r.hundido * 0.5) + S.pasta * vl * (tab.visc ? 0 : 1);
      // si patina en un suelo blando se hunde (mas rapido cuanto mas patina); rodando sin patinar, de a poco sale
      if (tab.hunde > 0) {
        const cava = patinando * (Math.abs(Td) > 1 ? 1 : 0.4) * tab.hunde * 0.55;
        r.hundido = lim(r.hundido + (cava - (patinando < 0.05 ? 0.12 + Math.min(1, Math.abs(vl) / 1.5) * 0.3 : 0)) * dt, 0, 1);
      } else r.hundido = Math.max(0, r.hundido - dt * 0.35);
      if (r.hundido > hundidoMax) hundidoMax = r.hundido;
      // de costado: lo que sobra del agarre despues de acelerar o frenar
      const gasta = bloqueada ? 0.98 : (tab.gasta || C.patinaje), lado = tab.lat || 1;
      let lat = Math.sqrt(Math.max(0.04 * tope * tope, tope * tope - gasta * gasta * Fl * Fl)) * lado;
      const cruza = Math.abs(vs) / Math.max(Math.abs(vl), 4), tarde = deriva[S.id], pronto = C.firme * C.deriva;
      const cuanto = cruza <= pronto || tarde <= C.deriva ? cruza / C.deriva : C.firme + (1 - C.firme) * (cruza - pronto) / (tarde - pronto);
      const agarra = Math.min(tope * cuanto * lado, mr / dt * C.lateral * Math.abs(vs));
      const Fq = lim((vs > 0 ? -agarra : agarra) + mr * g * sy * (tab.baja || 1) * (r.hundido < 0.9 ? 1 : 0.3), -lat, lat) - (S.pasta + tab.visc) * 0.6 * vs;

      const Ax = nx * Nf + lx * Fl, Ay = ny * Nf + ly * Fl, Az = nz * Nf + lz * Fl;
      Fx += Ax + sx * Fq; Fy += Ay + sy * Fq; Fz += Az + sz * Fq;
      Tx += oy * Az - oz * Ay; Ty += oz * Ax - ox * Az; Tz += ox * Ay - oy * Ax;
      const sube = -(ox * ux + oy * uy + oz * uz) * C.alturaLateral;
      const px = ox + ux * sube, py = oy + uy * sube, pz = oz + uz * sube;
      Tx += (py * sz - pz * sy) * Fq; Ty += (pz * sx - px * sz) * Fq; Tz += (px * sy - py * sx) * Fq;

      // la corriente de agua (la cascada): empuja de costado a las ruedas que estan adentro
      if (terreno.corriente) {
        terreno.corriente(cx, cz, CO);
        if (CO.f > 0) {
          const Cx = CO.fx * mr, Cz = CO.fz * mr;
          Fx += Cx; Fz += Cz;
          Tx += oy * Cz; Ty += oz * Cx - ox * Cz; Tz -= oy * Cx;
          if (CO.f > corrienteMax) corrienteMax = CO.f;
        }
      }

      r.giro += r.w * dt;
      r.cruza = Math.abs(vs) / Math.max(Math.abs(vl), 3);
      r.suelo = S.id; r.p[0] = cx; r.p[1] = cy; r.p[2] = cz;
      if (r.patina > patina) patina = r.patina;
      if (S.agua > aguaMax) aguaMax = S.agua;
      c.suelo = S.id;
    }

    // --- la carga: lo que hace sobre el camion ---
    carga.paso(c, dt, acum);
    Fx += acum.fx; Fy += acum.fy; Fz += acum.fz; Tx += acum.tx; Ty += acum.ty; Tz += acum.tz;

    // --- golpes del chasis contra el piso ---
    let golpe = 0;
    for (const pt of puntos) {
      const ox = rx * pt[0] + ux * pt[1] + bx * pt[2], oy = ry * pt[0] + uy * pt[1] + by * pt[2], oz = rz * pt[0] + uz * pt[1] + bz * pt[2];
      const hondo = terreno.altura(p[0] + ox, p[2] + oz) - p[1] - oy;
      if (hondo <= 0) continue;
      terreno.normal(p[0] + ox, p[2] + oz, N);
      const vx = v[0] + w[1] * oz - w[2] * oy, vy = v[1] + w[2] * ox - w[0] * oz, vz = v[2] + w[0] * oy - w[1] * ox;
      const vn = vx * N[0] + vy * N[1] + vz * N[2];
      const Fn = lim(C.chasis[0] * hondo * N[1] - C.chasis[1] * vn, 0, mTotal * g * 4);
      if (-vn > c.impacto) { c.impacto = -vn; c.contra = 'piso'; }
      const tx = vx - N[0] * vn, ty = vy - N[1] * vn, tz = vz - N[2] * vn, tv = Math.hypot(tx, ty, tz) + 1e-6;
      const Fr = -Math.min(C.chasis[2] * Fn, m / 8 / dt * 0.4 * tv) / tv;
      const Ax = N[0] * Fn + tx * Fr, Ay = N[1] * Fn + ty * Fr, Az = N[2] * Fn + tz * Fr;
      Fx += Ax; Fy += Ay; Fz += Az;
      Tx += oy * Az - oz * Ay; Ty += oz * Ax - ox * Az; Tz += ox * Ay - oy * Ax;
      if (Fn > golpe) golpe = Fn;
    }

    // --- choques contra arboles, piedras, postes y edificios (tres circulos) ---
    for (let k = -1; k <= 1; k++) {
      const lejos = k * sepChoque + C.centro, ox = bx * lejos, oy = by * lejos, oz = bz * lejos, px = p[0] + ox, pz = p[2] + oz;
      const lista = terreno.cosasCerca(px, pz);
      if (!lista) continue;
      for (const o of lista) {
        if (o.roto || p[1] + oy > o.y + 6) continue;
        let dx = px - o.x, dz = pz - o.z, mete;
        if (o.hx) {
          const ex = dx * o.ux + dz * o.uz, ez = dz * o.ux - dx * o.uz;
          let qx_ = lim(ex, -o.hx, o.hx), qz_ = lim(ez, -o.hz, o.hz);
          if (qx_ === ex && qz_ === ez) { if (o.hx - Math.abs(ex) < o.hz - Math.abs(ez)) qx_ = ex < 0 ? -o.hx : o.hx; else qz_ = ez < 0 ? -o.hz : o.hz; mete = radioChoque + Math.hypot(ex - qx_, ez - qz_); qx_ = 2 * ex - qx_; qz_ = 2 * ez - qz_; }
          else mete = radioChoque - Math.hypot(ex - qx_, ez - qz_);
          if (mete <= 0) continue;
          const lx = ex - qx_, lz = ez - qz_, l = Math.hypot(lx, lz) + 1e-6;
          dx = (lx * o.ux - lz * o.uz) / l; dz = (lx * o.uz + lz * o.ux) / l;
        } else {
          const d = Math.hypot(dx, dz) + 1e-6;
          mete = radioChoque + o.r - d;
          if (mete <= 0) continue;
          dx /= d; dz /= d;
        }
        const vcx = v[0] + w[1] * oz - w[2] * oy, vcz = v[2] + w[0] * oy - w[1] * ox, vn = vcx * dx + vcz * dz;
        const Fn = Math.max(0, 140000 * mete - 14000 * vn) * o.duro;
        const vt = vcz * dx - vcx * dz, Ft = -Math.sign(vt) * Math.min(C.roce * Fn, mTotal / dt * 0.25 * Math.abs(vt));
        const Ax = dx * Fn - dz * Ft, Az = dz * Fn + dx * Ft;
        if (-vn * o.duro > c.impacto) { c.impacto = -vn * o.duro; c.contra = o.clase === 'objeto' ? o.tipo : o.clase === 'arbol' && o.tipo === 'arbusto' ? 'arbusto' : o.clase; }
        if (o.cede && -vn > 3) { o.roto = true; c.rompio.push(o); }
        Fx += Ax; Fz += Az;
        Tx += oy * Az; Ty += oz * Ax - ox * Az; Tz -= oy * Ax;
        if (Fn > golpe) golpe = Fn;
      }
    }

    // --- se integra el movimiento ---
    const I3 = C.inercia, im = dt / m, frena = 1 - 0.25 * dt;
    v[0] += Fx * im; v[1] += Fy * im; v[2] += Fz * im;
    const a1 = (Tx * rx + Ty * ry + Tz * rz) / I3[0] * dt, a2 = (Tx * ux + Ty * uy + Tz * uz) / I3[1] * dt, a3 = (Tx * bx + Ty * by + Tz * bz) / I3[2] * dt;
    w[0] = (w[0] + rx * a1 + ux * a2 + bx * a3) * frena;
    w[1] = (w[1] + ry * a1 + uy * a2 + by * a3) * frena;
    w[2] = (w[2] + rz * a1 + uz * a2 + bz * a3) * frena;
    p[0] += v[0] * dt; p[1] += v[1] * dt; p[2] += v[2] * dt;
    const hx = w[0] * dt * 0.5, hy = w[1] * dt * 0.5, hz = w[2] * dt * 0.5;
    const nqx = qx + hx * qw + hy * qz - hz * qy, nqy = qy - hx * qz + hy * qw + hz * qx, nqz = qz + hx * qy - hy * qx + hz * qw, nqw = qw - hx * qx - hy * qy - hz * qz;
    const nl = 1 / Math.hypot(nqx, nqy, nqz, nqw);
    q[0] = nqx * nl; q[1] = nqy * nl; q[2] = nqz * nl; q[3] = nqw * nl;

    // --- datos para el resto del juego ---
    c.adelante[0] = fx; c.adelante[1] = fy; c.adelante[2] = fz;
    c.arriba[0] = ux; c.arriba[1] = uy; c.arriba[2] = uz;
    c.derecha[0] = rx; c.derecha[1] = ry; c.derecha[2] = rz;
    c.velocidad = vf; c.enPiso = enPiso; c.patina = patina; c.agua = aguaMax; c.golpe = golpe;
    c.hundido = hundidoMax; c.corriente = corrienteMax;
    // la inclinacion respecto de la vertical (como una burbuja de nivel): rolido hacia la derecha, cabeceo hacia adelante
    c.rolido = Math.atan2(ry, uy); c.cabeceo = Math.atan2(-by, uy);
    centroDeMasa();
  };

  // El centro de masa de todo el camion con lo que le queda de carga, en ejes del camion y respecto del medio entre los ejes.
  // El camion vacio tiene el suyo en el origen; cada bulto suma el suyo.
  function centroDeMasa() {
    let M = C.masa, X = 0, Y = 0, Z = 0;
    const e = ejesDe(c.q, { r: [0, 0, 0], u: [0, 0, 0], b: [0, 0, 0] });
    for (const b of carga.bultos) {
      if (b.estado !== 'caja') continue;
      const dx = b.p[0] - c.pos[0], dy = b.p[1] - c.pos[1], dz = b.p[2] - c.pos[2];
      X += b.m * (dx * e.r[0] + dy * e.r[1] + dz * e.r[2]); Y += b.m * (dx * e.u[0] + dy * e.u[1] + dz * e.u[2]); Z += b.m * (dx * e.b[0] + dy * e.b[1] + dz * e.b[2]);
      M += b.m;
    }
    c.centroMasa.x = X / M; c.centroMasa.y = Y / M; c.centroMasa.z = Z / M - C.centro; c.centroMasa.masa = M;
    // cuanto le falta para volcar (0 = lejos, 1 = en el limite): la inclinacion y el corrimiento de la carga, contra lo ancho
    // que es el camion y lo alto que lleva el peso. (Es un aviso para el tablero: la fisica no lo usa.)
    const alto = 0.9 + Math.max(0, c.centroMasa.y);
    c.vuelco = lim((Math.abs(c.centroMasa.x) + alto * Math.abs(Math.sin(c.rolido))) / (C.trocha * 1.05), 0, 1.5);
  }
  return c;
}

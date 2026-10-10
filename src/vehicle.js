// Fisica de la camioneta: un cuerpo rigido con 4 ruedas, suspension y agarre segun el suelo.
// No dibuja nada. Los numeros para ajustarla estan en config.js.
import { CAMIONETA as C, JUEGO } from './config.js';

const lim = (v, a, b) => (v < a ? a : v > b ? b : v);
const N = [0, 1, 0], S = { agarre: 1, freno: 0, pasta: 0, id: 0, agua: 0, vx: 0, vz: 0 };

export function crearCamioneta(terreno) {
  const c = {
    pos: [0, 0, 0], vel: [0, 0, 0], q: [0, 0, 0, 1], w: [0, 0, 0],
    adelante: [0, 0, -1], arriba: [0, 1, 0], derecha: [1, 0, 0],
    volante: 0, gas: 0, sentido: 1, frenando: false, mano: false, giroRuedas: 0,
    velocidad: 0, enPiso: 0, patina: 0, suelo: 0, agua: 0, golpe: 0, ruedas: [],
    baja: false,    // reductora puesta
    impacto: 0,     // golpe mas fuerte desde la ultima vez que se leyo, en m/s (lo usan las reglas para el daño)
  };
  for (let i = 0; i < 4; i++) {
    c.ruedas.push({ x: (i % 2 ? 1 : -1) * C.trocha, z: (i < 2 ? -1 : 1) * C.ejes, delantera: i < 2,
      largo: C.resorteLargo, toca: false, patina: 0, giro: 0, suelo: 0, carga: 0, tope: 1, vl: 0, p: [0, 0, 0] });
  }
  // puntos del chasis que pueden golpear contra el piso (paragolpes, panza y techo)
  const puntos = [[0, -0.44, -1.38], [0, -0.44, 1.38], [0, -0.44, 0], [0, 1.1, 0.4]];
  for (const x of [-0.9, 0.9]) for (const z of [-2.2, 2.2]) puntos.push([x, -0.3, z], [x * 0.9, 1.1, z * 0.55 + 0.3]);

  // apoya la camioneta en un punto del mapa mirando hacia "rumbo", acostada sobre la pendiente
  c.poner = function (x, z, rumbo) {
    const sx = (terreno.altura(x + 1, z) - terreno.altura(x - 1, z)) / 2, sz = (terreno.altura(x, z + 1.4) - terreno.altura(x, z - 1.4)) / 2.8;
    const l = Math.hypot(sx, 1, sz), nx = -sx / l, ny = 1 / l, nz = -sz / l;
    const k = Math.hypot(nz, nx, 1 + ny), a = nz / k, b = -nx / k, d = (1 + ny) / k;   // giro que acuesta "arriba" sobre la normal
    const sy = Math.sin(-rumbo / 2), cy = Math.cos(-rumbo / 2);
    c.q[0] = a * cy - b * sy; c.q[1] = d * sy; c.q[2] = b * cy + a * sy; c.q[3] = d * cy;
    c.pos[0] = x + nx * 0.82; c.pos[1] = terreno.altura(x, z) + ny * 0.82; c.pos[2] = z + nz * 0.82;
    c.vel.fill(0); c.w.fill(0);
    c.volante = 0; c.gas = 0; c.sentido = 1; c.velocidad = 0; c.impacto = 0;
    c.adelante[0] = Math.sin(rumbo); c.adelante[1] = 0; c.adelante[2] = -Math.cos(rumbo);
    for (const r of c.ruedas) r.tope = 1;
  };

  // avanza la fisica un paso. ent: { x: volante -1..1, y: acelerador -1..1, mano: freno de mano }
  c.paso = function (ent, dt) {
    const p = c.pos, v = c.vel, w = c.w, q = c.q, m = C.masa, g = JUEGO.gravedad;
    const qx = q[0], qy = q[1], qz = q[2], qw = q[3];
    // ejes de la camioneta en el mundo: derecha (r), arriba (u), atras (b), adelante (f)
    const rx = 1 - 2 * (qy * qy + qz * qz), ry = 2 * (qx * qy + qw * qz), rz = 2 * (qx * qz - qw * qy);
    const ux = 2 * (qx * qy - qw * qz), uy = 1 - 2 * (qx * qx + qz * qz), uz = 2 * (qy * qz + qw * qx);
    const bx = 2 * (qx * qz + qw * qy), by = 2 * (qy * qz - qw * qx), bz = 1 - 2 * (qx * qx + qy * qy);
    const fx = -bx, fy = -by, fz = -bz;
    const vf = v[0] * fx + v[1] * fy + v[2] * fz;

    // --- comandos: acelerador, freno, volante ---
    let quiereGas = 0;
    c.frenando = false;
    if (ent.y > 0) { quiereGas = ent.y; c.sentido = 1; }
    else if (ent.y < 0) { if (vf > 1.2) c.frenando = true; else { quiereGas = -ent.y; c.sentido = -1; } }
    c.gas += lim(quiereGas - c.gas, -dt * 6, dt / C.aceleraEn);
    c.mano = !!ent.mano;
    const giroMax = C.giro / (1 + (vf / C.giroRapido) * (vf / C.giroRapido));
    const rapidez = C.giroVel * (Math.abs(ent.x) < Math.abs(c.volante) ? 1.7 : 1) * dt;
    c.volante += lim(ent.x - c.volante, -rapidez, rapidez);
    c.giroRuedas = c.volante * giroMax;
    const G = c.baja ? C.baja : C.alta;   // la reductora cambia fuerza, velocidad maxima y freno motor
    let empuje = c.gas * c.sentido * Math.min(G.empuje * m * g, G.potencia / Math.max(Math.abs(vf), 1)) * lim((G.tope - Math.abs(vf)) / 1.5, 0, 1);
    if (c.sentido < 0) empuje *= vf < -9 ? 0 : C.reversa;

    // --- fuerzas: gravedad y aire ---
    const va = Math.hypot(v[0], v[1], v[2]);
    let Fx = -C.aire * va * v[0], Fy = -m * g - C.aire * va * v[1], Fz = -C.aire * va * v[2], Tx = 0, Ty = 0, Tz = 0;

    // --- ruedas ---
    const total = C.resorteLargo + C.radio, mr = m / 4;
    let enPiso = 0, patina = 0, aguaMax = 0, agarreTotal = 1e-6;
    for (const r of c.ruedas) agarreTotal += r.tope * (r.delantera ? 1 : C.traseras);   // el motor empuja mas en las ruedas que mas agarran
    for (const r of c.ruedas) {
      const ax = p[0] + rx * r.x + ux * C.anclaje + bx * r.z, ay = p[1] + ry * r.x + uy * C.anclaje + by * r.z, az = p[2] + rz * r.x + uz * C.anclaje + bz * r.z;
      // se busca el piso bajando desde el anclaje en la direccion de la suspension
      let t = total;
      if (uy > 0.3) {
        t = (ay - terreno.altura(ax, az)) / uy;
        for (let k = 0; k < 2; k++) { t = lim(t, -0.5, 3); t += (ay - uy * t - terreno.altura(ax - ux * t, az - uz * t)) / uy; }
      }
      r.toca = t < total;
      r.largo = lim(t - C.radio, C.resorteLargo - C.recorrido - 0.08, C.resorteLargo);
      const parte = r.tope * (r.delantera ? 1 : C.traseras) / agarreTotal;
      r.patina = 0; r.carga = 0; r.tope = 0;
      if (!r.toca) { r.giro += r.vl / C.radio * dt; continue; }
      enPiso++;
      const comp = lim(total - t, 0, C.recorrido + 0.3);
      const cx = ax - ux * t, cy = ay - uy * t, cz = az - uz * t;
      terreno.normal(cx, cz, N);
      const nx = N[0], ny = N[1], nz = N[2];
      const den = Math.max(0.5, ux * nx + uy * ny + uz * nz);
      const ox = cx - p[0], oy = cy - p[1], oz = cz - p[2];
      const vx = v[0] + w[1] * oz - w[2] * oy, vy = v[1] + w[2] * ox - w[0] * oz, vz = v[2] + w[0] * oy - w[1] * ox;
      const ritmo = -(vx * nx + vy * ny + vz * nz) / den;
      // suspension: resorte + amortiguador (+ tope de goma al final del recorrido)
      let Fs = C.resorte * comp + C.amortigua[ritmo > 0 ? 0 : 1] * ritmo;
      if (comp > C.recorrido) { Fs += C.resorte * 7 * (comp - C.recorrido); if (ritmo > c.impacto) c.impacto = ritmo; }
      const Nf = lim(Fs, 0, m * g * 3) / den;
      r.carga = Nf;

      // direcciones de la rueda sobre el piso: l = hacia donde rueda, s = hacia su derecha
      const ang = r.delantera ? c.giroRuedas : 0, co = Math.cos(ang), si = Math.sin(ang);
      let lx = fx * co + rx * si, ly = fy * co + ry * si, lz = fz * co + rz * si;
      let k = lx * nx + ly * ny + lz * nz;
      lx -= nx * k; ly -= ny * k; lz -= nz * k;
      k = 1 / Math.hypot(lx, ly, lz); lx *= k; ly *= k; lz *= k;
      const sx = ly * nz - lz * ny, sy = lz * nx - lx * nz, sz = lx * ny - ly * nx;
      terreno.suelo(cx, cz, S);
      const mx = vx - S.vx, mz = vz - S.vz;   // velocidad respecto del piso: en un derrumbe el piso se mueve
      const vl = mx * lx + vy * ly + mz * lz, vs = mx * sx + vy * sy + mz * sz;
      r.vl = vl;
      const tope = S.agarre * Nf;   // lo maximo que la cubierta puede agarrar
      r.tope = tope;

      // a lo largo: motor, frenos, freno de mano
      const bloqueada = c.mano && !r.delantera;
      let Fl = bloqueada ? 0 : empuje * parte;
      if (c.frenando || bloqueada || (c.gas < 0.02 && Math.abs(vl) < 0.7)) {
        const cap = C.frenos * m * g / 4;
        Fl += lim(-mr / dt * 0.5 * vl + mr * g * ly, -cap, cap);
      } else if (c.gas < 0.02) {
        const cap = G.frenoMotor * m * g / 4;
        Fl -= lim(vl * (c.baja ? 900 : 280), -cap, cap);
      }
      // en baja el motor no deja pasar de su velocidad maxima, ni siquiera cuesta abajo
      if (c.baja && Math.abs(vl) > G.tope) Fl -= Math.sign(vl) * Math.min(G.frenoMotor * m * g / 4, (Math.abs(vl) - G.tope) * 1500);
      const pide = Math.abs(Fl);
      if (pide > tope) { if (c.gas > 0.02 && !c.frenando) r.patina = 1 - tope / pide; Fl *= tope / pide; }
      // de costado: lo que sobra del agarre despues de acelerar o frenar
      let lat = Math.sqrt(Math.max(0, tope * tope - C.patinaje * C.patinaje * Fl * Fl));
      if (bloqueada) lat *= 0.55;
      const Fq = lim(-mr / dt * C.lateral * vs + mr * g * sy, -lat, lat) - S.pasta * 0.6 * vs;
      // resistencia a rodar y pasta del barro o del agua
      Fl -= S.freno * Nf * Math.tanh(vl / 0.4) + S.pasta * vl;

      const Ax = nx * Nf + lx * Fl, Ay = ny * Nf + ly * Fl, Az = nz * Nf + lz * Fl;
      Fx += Ax + sx * Fq; Fy += Ay + sy * Fq; Fz += Az + sz * Fq;
      Tx += oy * Az - oz * Ay; Ty += oz * Ax - ox * Az; Tz += ox * Ay - oy * Ax;
      // la fuerza lateral se aplica un poco mas arriba, para que no vuelque tan facil
      const sube = -(ox * ux + oy * uy + oz * uz) * C.alturaLateral;
      const px = ox + ux * sube, py = oy + uy * sube, pz = oz + uz * sube;
      Tx += (py * sz - pz * sy) * Fq; Ty += (pz * sx - px * sz) * Fq; Tz += (px * sy - py * sx) * Fq;

      r.giro += (vl / C.radio + r.patina * c.sentido * 22) * dt;
      r.suelo = S.id; r.p[0] = cx; r.p[1] = cy; r.p[2] = cz;
      if (r.patina > patina) patina = r.patina;
      if (S.agua > aguaMax) aguaMax = S.agua;
      c.suelo = S.id;
    }

    // --- golpes del chasis contra el piso ---
    let golpe = 0;
    for (const pt of puntos) {
      const ox = rx * pt[0] + ux * pt[1] + bx * pt[2], oy = ry * pt[0] + uy * pt[1] + by * pt[2], oz = rz * pt[0] + uz * pt[1] + bz * pt[2];
      const hondo = terreno.altura(p[0] + ox, p[2] + oz) - p[1] - oy;
      if (hondo <= 0) continue;
      terreno.normal(p[0] + ox, p[2] + oz, N);
      const vx = v[0] + w[1] * oz - w[2] * oy, vy = v[1] + w[2] * ox - w[0] * oz, vz = v[2] + w[0] * oy - w[1] * ox;
      const vn = vx * N[0] + vy * N[1] + vz * N[2];
      const Fn = lim(C.chasis[0] * hondo * N[1] - C.chasis[1] * vn, 0, m * g * 4);
      if (-vn > c.impacto) c.impacto = -vn;
      const tx = vx - N[0] * vn, ty = vy - N[1] * vn, tz = vz - N[2] * vn, tv = Math.hypot(tx, ty, tz) + 1e-6;
      const Fr = -Math.min(C.chasis[2] * Fn, m / 8 / dt * 0.4 * tv) / tv;
      const Ax = N[0] * Fn + tx * Fr, Ay = N[1] * Fn + ty * Fr, Az = N[2] * Fn + tz * Fr;
      Fx += Ax; Fy += Ay; Fz += Az;
      Tx += oy * Az - oz * Ay; Ty += oz * Ax - ox * Az; Tz += ox * Ay - oy * Ax;
      if (Fn > golpe) golpe = Fn;
    }

    // --- choques contra arboles y piedras ---
    for (let k = -1; k <= 1; k++) {
      const ox = bx * k * 1.45, oy = by * k * 1.45, oz = bz * k * 1.45, px = p[0] + ox, pz = p[2] + oz;
      const lista = terreno.cosasCerca(px, pz);
      if (!lista) continue;
      for (const o of lista) {
        const dx = px - o.x, dz = pz - o.z, d = Math.hypot(dx, dz) + 1e-6, mete = 1 + o.r - d;
        if (mete <= 0 || p[1] + oy > o.y + 6) continue;
        const vn = ((v[0] + w[1] * oz - w[2] * oy) * dx + (v[2] + w[0] * oy - w[1] * ox) * dz) / d;
        const Fn = Math.max(0, 140000 * mete - 9000 * vn) / d, Ax = dx * Fn, Az = dz * Fn;
        if (-vn > c.impacto) c.impacto = -vn;
        Fx += Ax; Fz += Az;
        Tx += oy * Az; Ty += oz * Ax - ox * Az; Tz -= oy * Ax;
        if (Fn * d > golpe) golpe = Fn * d;
      }
    }

    // --- se integra el movimiento ---
    const I = C.inercia, im = dt / m, frena = 1 - 0.25 * dt;
    v[0] += Fx * im; v[1] += Fy * im; v[2] += Fz * im;
    const a1 = (Tx * rx + Ty * ry + Tz * rz) / I[0] * dt, a2 = (Tx * ux + Ty * uy + Tz * uz) / I[1] * dt, a3 = (Tx * bx + Ty * by + Tz * bz) / I[2] * dt;
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
  };
  return c;
}

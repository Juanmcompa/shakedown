// Reparto: tus versiones pasadas. Cada vez que arranca un viaje, todas salen a la vez, con el reloj del viaje.
//
// Van encadenadas: la version del viaje 3, cuando llega a su destino, no se queda ahi: hace tu viaje 4 (que salio de ese
// mismo lugar), despues el 5, y asi hasta el ultimo que hiciste. O sea, en el viaje n hay una version que arranca en cada
// viaje anterior y sigue tus pasos desde ahi: el pueblo se llena rapido, y nadie desaparece a mitad de camino.
// En el techo llevan el numero de la entrega que estan haciendo en ese momento (cambia al pasar de un viaje al siguiente).
// Los intentos que no llegaron a tiempo van sueltos: hacen su recorrido y desaparecen.
//
// Son solidos y van en el vehiculo que usaste en cada viaje, con la cabina de otro color. No llevan fisica: repiten lo
// grabado. Pero se los puede chocar:
//   - El peso cuenta. Contra una copia mas pesada que vos, es como chocar una pared que se mueve; contra una mas liviana,
//     la pared es blanda (duro: el peso de ella sobre el tuyo) y la copia sale despedida.
//   - Quedan "bobas": la chocada se corre, gira y se tambalea un momento (de medio segundo a dos, segun el golpe y los
//     pesos), y mientras tanto su reloj se frena. Despues vuelve a su camino y sigue desde donde quedo, con ese atraso:
//     llega tarde a todos lados en este viaje (en el siguiente, todas vuelven a salir a horario).
//   - Efecto domino: mientras van a horario se atraviesan entre ellas (cuando manejaste, ya las esquivaste). Pero una copia
//     fuera de horario (atrasada o boba) choca con las otras, y la chocada queda boba y se atrasa tambien, con un golpe
//     mas suave en cada eslabon (gen: el numero de eslabon). La cadena siempre arranca en un choque tuyo y se apaga sola.
import * as THREE from '../vendor/three.module.js';
import { armarVehiculo, configDeTipo, bambolear, TIPOS } from './vehiculos.js';
import { remolqueDe } from './remolque.js';
import { MUESTRA } from './memoria.js';

const COLORES = ['#6f8fa3', '#c8402f', '#4f7a55', '#8a6f9a', '#2f6fa8', '#e9e4d6', '#7a2f2a', '#3f8a55', '#d8a48c', '#3d3f45', '#a9c3cc', '#e07a2e'];
const QUEDA = 3;   // segundos que la ultima de una cadena queda estacionada al terminar
const lim = (v, a, b) => (v < a ? a : v > b ? b : v);
const AMORTIGUA = 0.7;   // cuanto mas suave es cada eslabon del domino
const ESLABONES = 5;     // despues de tantos, se atraviesan de nuevo

export function crearFantasmas(escena, T) {
  const viajes = [];    // todos los viajes guardados, en orden
  let cadenas = [];     // las versiones de este viaje: { tramos: [{ v, desde }], fin, queda, color, vehiculo, suelto, choque }
  const sueltos = {};   // vehiculos dibujados que no se estan usando, por tipo y color (para no armarlos cada vez)
  const ARRIBA = new THREE.Vector3(0, 1, 0);
  const dura = (v) => Math.max(0, (v.xs.length - 1) * MUESTRA);

  // un vehiculo dibujado: se reusa uno guardado o se arma
  function pedir(tipo, color) {
    const clave = tipo + color, l = sueltos[clave];
    if (l && l.length) { const f = l.pop(); f.grupo.visible = false; return f; }
    const f = armarVehiculo(tipo, color);
    f.clave = clave;
    escena.add(f.grupo);
    if (f.remolque) escena.add(f.remolque);
    return f;
  }
  function devolver(f) { f.grupo.visible = false; if (f.remolque) f.remolque.visible = false; (sueltos[f.clave] || (sueltos[f.clave] = [])).push(f); }

  // suma un viaje guardado
  function sumar(v) { viajes.push(v); }
  function borrar() {
    for (const c of cadenas) if (c.vehiculo) devolver(c.vehiculo);
    cadenas = []; viajes.length = 0;
  }

  // Arma las versiones para el viaje n: una cadena que arranca en cada viaje entregado anterior y sigue con los siguientes
  // (de cada viaje, el intento que entrego), y una suelta por cada intento que no llego.
  function preparar(n) {
    for (const c of cadenas) if (c.vehiculo) devolver(c.vehiculo);
    cadenas = [];
    const entregado = [];
    for (const v of viajes) if (v.entrego && v.k < n) entregado[v.k] = v;
    let color = 0;
    const nueva = (tramos, queda) => {
      let t = 0;
      for (const p of tramos) { p.desde = t; t += dura(p.v); }
      const caja = () => ({ x: 0, z: 0, hx: 1, hz: 2, ux: 1, uz: 0, y: 0, duro: 1, clase: 'auto', tipo: 'auto', roto: false });
      cadenas.push({ tramos, fin: t, queda, color: COLORES[color++ % COLORES.length], vehiculo: null, suelto: false, choque: caja(), choque2: caja(),
        atraso: 0, bobo: 0, gx: 0, gz: 0, gr: 0, kx: 0, kz: 0, kr: 0, gen: 0, inmune: 0, inmuneYo: 0, vx: 0, vz: 0, bx: 0, bz: 0, px: null, pz: 0, qx: 0, qz: 0, masa: 1 });
    };
    for (let k = 0; k < n; k++) {
      if (!entregado[k]) continue;
      const tramos = [];
      for (let j = k; j < n && entregado[j]; j++) tramos.push({ v: entregado[j] });
      nueva(tramos, QUEDA);
    }
    for (const v of viajes) if (!v.entrego && v.k <= n) nueva([{ v }], 0);
    tAntes = null;
  }

  // --- los golpes ---
  let tAntes = null, masaYo = 1;
  const nuevos = [];   // los choques entre copias de este cuadro (para que suenen): { x, z, v }
  // le da un empujon (ix, iz: cuanto cambia su velocidad, en m/s; giro: en radianes por segundo) y la deja boba
  function empujar(c, ix, iz, giro, gen) {
    const s = Math.hypot(ix, iz);
    if (c.bobo <= 0) { c.kx = c.bx * 0.6; c.kz = c.bz * 0.6; }   // (venia andando: patina un poco para adelante)
    c.kx += ix; c.kz += iz; c.kr += giro;
    c.bobo = Math.max(c.bobo, lim(0.4 + s * 0.17, 0.4, 2.2));
    c.gen = gen;
    c.inmune = c.bobo + 0.5;
  }
  // un cuadro de la aturdida: mientras esta boba patina, gira y su reloj no avanza; despues vuelve sola a su camino
  function aturdir(c, dt) {
    c.inmune -= dt; c.inmuneYo -= dt;
    if (c.bobo > 0) {
      c.bobo -= dt; c.atraso += dt;
      c.gx += c.kx * dt; c.gz += c.kz * dt; c.gr += c.kr * dt;
      const f = Math.exp(-2.6 * dt); c.kx *= f; c.kz *= f; c.kr *= Math.exp(-3 * dt);
    } else if (c.gx || c.gz || c.gr) {
      const f = Math.exp(-1.8 * dt); c.gx *= f; c.gz *= f; c.gr *= f;
      if (Math.abs(c.gx) + Math.abs(c.gz) + Math.abs(c.gr) < 0.02) c.gx = c.gz = c.gr = 0;
    }
  }
  const fuera = (c) => c.bobo > 0 || c.atraso > 0.05 || Math.abs(c.gx) + Math.abs(c.gz) > 0.2;
  // los tres circulos con los que se aproxima a una copia (adelante, medio y atras), para chocarlas entre ellas
  function circulos(c, out) {
    const o = c.choque, fx = -o.uz, fz = o.ux, d = Math.max(0, o.hz - o.hx);
    out[0] = o.x + fx * d; out[1] = o.z + fz * d; out[2] = o.x; out[3] = o.z; out[4] = o.x - fx * d; out[5] = o.z - fz * d;
    return o.hx;
  }
  const ca = new Float64Array(6), cb = new Float64Array(6);
  // las copias fuera de horario contra las demas
  function domino(lista) {
    for (const a of lista) {
      if (!fuera(a)) continue;
      for (const b of lista) {
        if (b === a || (fuera(b) && b.inmune > 0 && a.inmune > 0)) continue;
        const A = a.choque, B = b.choque;
        if (Math.abs(A.x - B.x) > A.hz + B.hz + 1 || Math.abs(A.z - B.z) > A.hz + B.hz + 1) continue;
        const ra = circulos(a, ca), rb = circulos(b, cb);
        let mete = 0, nx = 0, nz = 0;
        for (let i = 0; i < 6; i += 2) for (let j = 0; j < 6; j += 2) {
          const dx = cb[j] - ca[i], dz = cb[j + 1] - ca[i + 1], d = Math.hypot(dx, dz) + 1e-6, m = ra + rb - d;
          if (m > mete) { mete = m; nx = dx / d; nz = dz / d; }
        }
        if (mete <= 0) continue;
        // n: de a hacia b. Que tan rapido se acercan
        const acerca = (a.vx - b.vx) * nx + (a.vz - b.vz) * nz, gen = Math.max(a.gen, b.gen) + 1;
        const s = acerca * Math.pow(AMORTIGUA, gen);
        if (gen > ESLABONES || s < 0.8) continue;
        const ma = a.masa, mb = b.masa, ib = s * 1.3 * ma / (ma + mb), ia = s * 1.3 * mb / (ma + mb);
        const giro = ((A.x - B.x) * (-B.uz) + (A.z - B.z) * B.ux) > 0 ? 1 : -1;
        if (ib > 0.5 && b.inmune <= 0) empujar(b, nx * ib, nz * ib, giro * ib * 0.25, gen);
        if (ia > 0.5 && a.inmune <= 0) empujar(a, -nx * ia, -nz * ia, -giro * ia * 0.25, gen);
        nuevos.push({ x: (A.x + B.x) / 2, z: (A.z + B.z) / 2, v: s });
      }
    }
  }

  // Despues de mover el auto: si el que juega toco una copia, la empuja (segun que tan rapido se acercaban y los pesos).
  // yo: el auto de la fisica; C: su configuracion. Devuelve cuantas golpeo.
  function golpear(yo, C) {
    const [radio, sep] = C.choque, f = yo.adelante, l = Math.hypot(f[0], f[2]) || 1, fx = f[0] / l, fz = f[2] / l;
    let n = 0;
    for (const c of cadenas) {
      if (!c.suelto || !c.vehiculo || !c.vehiculo.grupo.visible || c.inmuneYo > 0) continue;
      const o = c.choque;
      if (Math.hypot(o.x - yo.pos[0], o.z - yo.pos[2]) > o.hz + sep + radio + 2) continue;
      let mejor = 1e9, nx = 0, nz = 0, ex0 = 0;
      for (let k = -1; k <= 1; k++) {
        const px = yo.pos[0] + fx * (k * sep + (C.centro || 0)), pz = yo.pos[2] + fz * (k * sep + (C.centro || 0));
        const dx = px - o.x, dz = pz - o.z, ex = dx * o.ux + dz * o.uz, ez = dz * o.ux - dx * o.uz;
        const qx = lim(ex, -o.hx, o.hx), qz = lim(ez, -o.hz, o.hz), lx = ex - qx, lz = ez - qz, d = Math.hypot(lx, lz);
        let gap, ux, uz;
        if (d > 1e-4) { gap = d - radio; ux = lx / d; uz = lz / d; }
        else { gap = -radio; if (o.hx - Math.abs(ex) < o.hz - Math.abs(ez)) { ux = ex < 0 ? -1 : 1; uz = 0; } else { ux = 0; uz = ez < 0 ? -1 : 1; } }
        if (gap < mejor) { mejor = gap; nx = ux * o.ux - uz * o.uz; nz = ux * o.uz + uz * o.ux; ex0 = qz; }
      }
      if (mejor > 0.12) continue;
      // n: de la copia hacia vos. acerca: que tan rapido se juntaban
      // (solo cuenta el golpe: quedarse apoyado contra una no la deja boba para siempre). Si la que se te viene encima es
      // ella y vos estas casi quieto, te empuja y sigue (como siempre), salvo que sea mucho mas liviana que vos: ahi rebota.
      const yoVoy = -(yo.vel[0] * nx + yo.vel[2] * nz), ellaViene = Math.max(0, c.vx * nx + c.vz * nz);
      if (yoVoy < 1 && c.masa > masaYo * 0.5) continue;
      const s = Math.max(0, yoVoy) + ellaViene;
      if (s < 0.8) continue;
      const imp = s * 1.4 * masaYo / (masaYo + c.masa);
      c.inmuneYo = 0.25;
      if (imp < 1) continue;   // (una mucho mas pesada ni se inmuta)
      // gira segun donde la agarraste: de punta gira mucho, de costado en el medio casi nada
      const giro = -(ex0 / Math.max(o.hz, 1)) * (nx * o.ux + nz * o.uz) * imp * 0.5;
      empujar(c, -nx * imp, -nz * imp, giro, 0);
      n++;
    }
    return n;
  }

  // donde esta una cadena en el segundo t: su tramo y la posicion (curva suave entre muestras). null si ya no esta.
  const P = { x: 0, z: 0, rumbo: 0, tramo: null };
  function pose(c, t) {
    if (t > c.fin + c.queda || !c.tramos.length) return null;
    let p = c.tramos[c.tramos.length - 1];
    for (const q of c.tramos) if (t < q.desde + dura(q.v)) { p = q; break; }
    const v = p.v, n = v.xs.length;
    if (n < 2) return null;
    const f = Math.min(n - 1.0001, Math.max(0, (t - p.desde) / MUESTRA)), k = Math.floor(f), u = f - k;
    const a = Math.max(0, k - 1), b = Math.min(n - 1, k + 1), d = Math.min(n - 1, k + 2);
    const cr = (A) => { const p0 = A[a], p1 = A[k], p2 = A[b], p3 = A[d]; return 0.5 * (2 * p1 + (p2 - p0) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (3 * p1 - p0 - 3 * p2 + p3) * u * u * u); };
    P.x = cr(v.xs); P.z = cr(v.zs);
    let g = v.rs[b] - v.rs[k];
    g = Math.atan2(Math.sin(g), Math.cos(g));
    P.rumbo = v.rs[k] + g * u;
    if (v.ts) { let h = v.ts[b] - v.ts[k]; h = Math.atan2(Math.sin(h), Math.cos(h)); P.remolque = v.ts[k] + h * u; } else P.remolque = null;
    P.tramo = p;
    return P;
  }

  const activos = [];
  // Una vez por cuadro (y antes de mover el auto): pone a cada version donde estaba en el segundo t y le pasa al terreno
  // las que se pueden chocar (mas "otras", si hay). yo: el auto del que juega. Una version no se choca hasta que se separo
  // una vez del auto (al reintentar un viaje, el intento anterior larga del mismo lugar que vos).
  const vistas = [];
  function mover(t, yo, otras = []) {
    activos.length = 0; vistas.length = 0; nuevos.length = 0;
    // el paso desde el cuadro anterior (si el reloj volvio atras, como en la portada al dar la vuelta: todas a horario)
    const paso = tAntes === null ? 0 : t - tAntes;
    if (paso < 0) for (const c of cadenas) Object.assign(c, { atraso: 0, bobo: 0, gx: 0, gz: 0, gr: 0, kx: 0, kz: 0, kr: 0, gen: 0, px: null });
    tAntes = t;
    for (const c of cadenas) {
      if (paso > 0 && paso < 0.2) aturdir(c, paso);
      const p = pose(c, t - c.atraso);
      if (!p) { if (c.vehiculo) { devolver(c.vehiculo); c.vehiculo = null; } c.px = null; continue; }
      const v = p.tramo.v, tipo = TIPOS[v.tipo] ? v.tipo : 'furgon';
      // al pasar de un viaje al siguiente puede cambiar de vehiculo
      if (!c.vehiculo || c.vehiculo.tipo !== tipo) { if (c.vehiculo) devolver(c.vehiculo); c.vehiculo = pedir(tipo, c.color); c.antes = null; }
      const f = c.vehiculo;
      c.masa = configDeTipo(tipo).masa;
      // su velocidad: la del camino (bx, bz) y la de verdad, con el empujon (vx, vz)
      const bx0 = p.x, bz0 = p.z;
      p.x += c.gx; p.z += c.gz; p.rumbo += c.gr;
      if (c.px !== null && paso > 0.001 && paso < 0.2) {
        c.vx = lim((p.x - c.px) / paso, -40, 40); c.vz = lim((p.z - c.pz) / paso, -40, 40);   // (con tope: por si salto)
        if (c.bobo <= 0) { c.bx = (bx0 - c.qx) / paso; c.bz = (bz0 - c.qz) / paso; }
      }
      c.px = p.x; c.pz = p.z; c.qx = bx0; c.qz = bz0;
      f.grupo.visible = true;
      f.grupo.position.set(p.x, f.alto, p.z);
      f.grupo.quaternion.setFromAxisAngle(ARRIBA, -p.rumbo);
      f.numero(v.k + 1);
      // el bamboleo de su carga, con lo que se movio desde el cuadro anterior
      const a = c.antes, dt = a ? t - a.t : 0;
      if (a && dt > 0.005 && dt < 0.3) {
        const vel = Math.hypot(p.x - a.x, p.z - a.z) / dt, giro = Math.atan2(Math.sin(p.rumbo - a.rumbo), Math.cos(p.rumbo - a.rumbo)) / dt;
        // (boba: se tambalea fuerte, para los dos lados)
        const tambalea = c.bobo > 0 ? Math.sin(t * 17) * 9 * Math.min(1, c.bobo) : 0;
        bambolear(f, vel * giro + tambalea, (vel - a.vel) / dt, dt);
        c.antes = { x: p.x, z: p.z, rumbo: p.rumbo, t, vel: a.vel + (vel - a.vel) * 0.3 };
      } else c.antes = { x: p.x, z: p.z, rumbo: p.rumbo, t, vel: a ? a.vel : 0 };
      c.numero = v.k + 1;
      const o = c.choque;
      // contra vos: tan dura como pesada es comparada con vos
      o.duro = c.choque2.duro = lim(c.masa / masaYo, 0.15, 1);
      o.x = p.x; o.z = p.z; o.ux = Math.cos(p.rumbo); o.uz = Math.sin(p.rumbo); o.hx = TIPOS[tipo].ancho; o.hz = TIPOS[tipo].largo;
      // el remolque del semi: su dibujo y su caja
      let r = null;
      if (f.remolque && p.remolque !== null) {
        r = remolqueDe(TIPOS[tipo].remolque, configDeTipo(tipo).centro || 0, p.x, p.z, p.rumbo, p.remolque);
        f.remolque.visible = true;
        f.remolque.position.set(r.x, 0, r.z); f.remolque.rotation.set(0, -r.th, 0);
        const o2 = c.choque2, R = TIPOS[tipo].remolque;
        o2.x = r.x; o2.z = r.z; o2.ux = Math.cos(r.th); o2.uz = Math.sin(r.th); o2.hx = R.ancho; o2.hz = R.largo / 2;
      } else if (f.remolque) f.remolque.visible = false;
      if (!c.suelto && Math.hypot(p.x - yo.pos[0], p.z - yo.pos[2]) > 9 + (r ? 12 : 0)) c.suelto = true;
      if (c.suelto) { activos.push(o); if (r) activos.push(c.choque2); }
      vistas.push(c);
    }
    if (paso > 0 && paso < 0.2) domino(vistas);
    T.ponerMoviles(otras.length ? activos.concat(otras) : activos);
    return activos.length;
  }
  // al empezar un viaje, ninguna se choca hasta separarse
  function reiniciar() { for (const c of cadenas) c.suelto = false; }
  // las que quedaron fuera de horario (para las pruebas)
  const atrasadas = () => cadenas.filter((c) => c.atraso > 0.05).map((c) => ({ numero: c.numero, atraso: c.atraso, bobo: c.bobo, gen: c.gen }));
  // las que estan en la calle ahora (para el mapita y para la explicacion)
  const enLaCalle = () => cadenas.filter((c) => c.vehiculo && c.vehiculo.grupo.visible).map((c) => ({ x: c.choque.x, z: c.choque.z, entrego: c.queda > 0, suelto: c.suelto, numero: c.numero, arranco: c.tramos[0].v.k + 1, bobo: c.bobo > 0, atraso: c.atraso }));

  return { sumar, borrar, preparar, mover, reiniciar, enLaCalle, golpear, atrasadas, choques: () => nuevos,
    peso: (m) => { masaYo = m; }, cuantos: () => viajes.length, enCalle: () => cadenas.length,
    // (solo las pruebas: la cadena que arranco en el viaje k)
    cadena: (k) => cadenas.find((c) => c.tramos[0].v.k === k) };
}

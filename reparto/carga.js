// Reparto: la carga de la camioneta abierta. Las cajas van sueltas en la caja: si se frena, se acelera o se dobla fuerte, se
// deslizan; contra las tablas rebotan, pero si llegan rapido las pasan por arriba y se caen a la calle (y quedan ahi, como
// algo mas contra que chocar). Si se caen todas, el viaje no vale. En el furgon y el camion la carga va cerrada: no pasa nada.
// (Las versiones pasadas no llevan nada de esto: van tapadas, solo se muestra su recorrido.)
//
// Es una cuenta chica y barata: cada caja es un punto que se desliza sobre el piso de la caja, con rozamiento, empujado por
// lo que acelera la camioneta (vista desde la camioneta, la caja "se va" para el otro lado).
import * as THREE from '../vendor/three.module.js';

const G = 9.81, AGARRA = 0.72, DESLIZA = 0.55;   // rozamiento de carton sobre madera: hasta que arranca, y deslizando
const SALTA = 2.4;     // m/s contra una tabla: mas rapido que esto, la caja pasa por arriba y se cae (la de atras es mas alta: 1,4 veces)
const LADO = 0.52;     // lado de una caja (m)

let texCaja = null;
function materialCaja() {
  if (!texCaja) {
    const l = document.createElement('canvas');
    l.width = l.height = 8;
    const g = l.getContext('2d');
    g.fillStyle = '#c99a5b'; g.fillRect(0, 0, 8, 8);
    g.fillStyle = '#b5864a'; g.fillRect(0, 7, 8, 1); g.fillRect(7, 0, 1, 8);
    g.fillStyle = '#e0c48f'; g.fillRect(3, 0, 2, 8);   // la cinta
    texCaja = new THREE.CanvasTexture(l);
    texCaja.magFilter = THREE.NearestFilter; texCaja.colorSpace = THREE.SRGBColorSpace;
  }
  return new THREE.MeshLambertMaterial({ map: texCaja });
}

export function crearCarga(escena) {
  const geo = new THREE.BoxGeometry(LADO, LADO, LADO), mat = materialCaja();
  let cajas = [], cama = null, grupo = null;
  const caidas = [];   // las que estan en la calle: { malla, choque, vy }
  const vAntes = [0, 0, 0];
  let primera = true;
  const V = new THREE.Vector3();

  // carga n cajas en la caja abierta de un vehiculo (dibujo: lo que devuelve crearDibujoVehiculo). Sin caja abierta, nada.
  function cargar(dibujo, n = 4) {
    vaciar();
    cama = dibujo.cama; grupo = dibujo.grupo;
    if (!cama) return;
    const largo = cama.z1 - cama.z0;
    for (let i = 0; i < n; i++) {
      const fila = Math.floor(i / 2), col = i % 2;
      const x = (col ? 1 : -1) * (cama.x / 2), z = cama.z0 + largo * (0.25 + 0.5 * (fila % 2));
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = true;
      m.rotation.y = (i * 0.37) % 0.3 - 0.15;
      grupo.add(m);
      cajas.push({ x, z, vx: 0, vz: 0, malla: m, piso: i >= 4 ? 1 : 0 });
    }
    primera = true;
  }
  // saca todo: las cajas de la camioneta y las que quedaron en la calle
  function vaciar() {
    for (const b of cajas) b.malla.parent && b.malla.parent.remove(b.malla);
    for (const b of caidas) escena.remove(b.malla);
    cajas = []; caidas.length = 0;
  }

  // una caja se cae: pasa de la camioneta a la calle, donde cae al piso y queda como algo para chocar
  function caer(b, c) {
    V.set(b.x, cama.y + LADO / 2, b.z);
    grupo.localToWorld(V);
    grupo.remove(b.malla);
    b.malla.position.copy(V);
    escena.add(b.malla);
    // sale con la velocidad de la camioneta, un poco frenada
    caidas.push({ malla: b.malla, vx: c.vel[0] * 0.7, vz: c.vel[2] * 0.7, vy: 0.5, choque: { x: V.x, z: V.z, r: 0.38, y: 0, duro: 0.35, cede: true, clase: 'cajones', tipo: 'cajones', roto: false } });
  }

  // Cada cuadro, con la camioneta ya movida. Devuelve cuantas cajas quedan arriba (o -1 si no lleva carga suelta).
  function actualizar(c, dt) {
    // lo que acelero la camioneta en este cuadro, en sus ejes (derecha y adelante)
    const ax = (c.vel[0] - vAntes[0]) / dt, az = (c.vel[2] - vAntes[2]) / dt;
    vAntes[0] = c.vel[0]; vAntes[1] = c.vel[1]; vAntes[2] = c.vel[2];
    if (primera) { primera = false; return cama ? cajas.length : -1; }
    if (cama && cajas.length) {
      const R = c.derecha, F = c.adelante, aDer = ax * R[0] + az * R[2], aAde = ax * F[0] + az * F[2];
      // vista desde la camioneta, la caja siente lo contrario (y un golpe fuerte la sacude)
      let ex = -aDer, ez = -aAde;
      const golpe = c.golpe > 60000 ? 1 : 0;
      for (const b of cajas.slice()) {
        // en la caja, z crece hacia atras (adelante es -z): "adelante" de la camioneta es -z
        let fx = ex, fz = -ez;
        if (golpe) { fx += (Math.random() - 0.5) * 30; fz += (Math.random() - 0.5) * 30; }
        const quieta = Math.hypot(b.vx, b.vz) < 0.05;
        if (quieta && Math.hypot(fx, fz) < AGARRA * G) { b.vx = 0; b.vz = 0; }
        else {
          const v = Math.hypot(b.vx, b.vz), ux = v > 0.05 ? b.vx / v : fx / (Math.hypot(fx, fz) || 1), uz = v > 0.05 ? b.vz / v : fz / (Math.hypot(fx, fz) || 1);
          b.vx += (fx - ux * DESLIZA * G) * dt; b.vz += (fz - uz * DESLIZA * G) * dt;
          if (v > 0.05 && b.vx * ux + b.vz * uz < 0) { b.vx = 0; b.vz = 0; }   // (el rozamiento la freno del todo)
        }
        b.x += b.vx * dt; b.z += b.vz * dt;
        // las tablas: a los costados y atras se puede caer; adelante esta la cabina
        const mx = cama.x - LADO / 2, z0 = cama.z0 + LADO / 2, z1 = cama.z1 - LADO / 2;
        let cae = false;
        if (Math.abs(b.x) > mx) { if (Math.abs(b.vx) > SALTA) cae = true; else { b.x = Math.sign(b.x) * mx; b.vx *= -0.25; } }
        if (b.z > z1) { if (b.vz > SALTA * 1.4) cae = true; else { b.z = z1; b.vz *= -0.25; } }
        if (b.z < z0) { b.z = z0; b.vz *= -0.25; }
        if (cae) { cajas.splice(cajas.indexOf(b), 1); caer(b, c); continue; }
        b.malla.position.set(b.x, cama.y + LADO / 2, b.z);
      }
      // (las cajas no se atraviesan: si dos quedan encimadas, se separan)
      for (let i = 0; i < cajas.length; i++) for (let j = i + 1; j < cajas.length; j++) {
        const a = cajas[i], b = cajas[j], dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
        if (d < LADO && d > 1e-4) { const m = (LADO - d) / 2; a.x -= dx / d * m; a.z -= dz / d * m; b.x += dx / d * m; b.z += dz / d * m; }
      }
    }
    // las que se cayeron: caen al piso, ruedan un poco y quedan
    for (const b of caidas) {
      const p = b.malla.position;
      b.vy -= G * dt; p.y = Math.max(LADO / 2, p.y + b.vy * dt);
      if (p.y <= LADO / 2) { b.vy = 0; b.vx *= Math.exp(-dt * 4); b.vz *= Math.exp(-dt * 4); }
      p.x += b.vx * dt; p.z += b.vz * dt;
      b.malla.rotation.x += b.vx * dt; b.malla.rotation.z -= b.vz * dt;
      b.choque.x = p.x; b.choque.z = p.z;
      if (b.choque.roto) { b.choque.roto = false; b.vx += c.vel[0] * 0.6; b.vz += c.vel[2] * 0.6; }   // (si la pisa, la patea)
    }
    return cama ? cajas.length : -1;
  }
  return { cargar, vaciar, actualizar, caidas: () => caidas.map((b) => b.choque), quedan: () => (cama ? cajas.length : -1) };
}

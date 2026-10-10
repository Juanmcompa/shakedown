// Camara que sigue a la camioneta. Los modos estan en config.js (tecla C).
import * as THREE from 'three';
import { CAMARAS } from './config.js';

export function crearCamara(T) {
  const cam = new THREE.PerspectiveCamera(30, 1, 2, 900);
  const e = { modo: 0, rumbo: 0, dist: 70, alto: 58, fov: 30, x: 0, y: 0, z: 0, listo: false };
  const hacia = (a, b, dt, seg) => a + (b - a) * (1 - Math.exp(-dt / seg));

  function seguir(c, dt) {
    const m = CAMARAS[e.modo], v = Math.abs(c.velocidad), f = c.adelante;
    // la camara gira despacio hasta ponerse atras de la camioneta (o queda fija mirando al norte)
    const rumbo = m.sigue > 0 ? Math.atan2(f[0], -f[2]) : 0;
    let d = rumbo - e.rumbo;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    e.rumbo += d * (1 - Math.exp(-dt / (m.sigue || 0.8)));
    e.dist = hacia(e.dist, m.dist[0] + (m.dist[1] - m.dist[0]) * Math.min(1, v / 15), dt, 0.9);
    e.alto = hacia(e.alto, m.alto, dt, 0.4);
    e.fov = hacia(e.fov, m.fov, dt, 0.4);
    // mira un poco adelante de la camioneta, mas cuanto mas rapido va
    const ad = Math.min(11, m.adelante * (4 + v * 0.9)) * (c.velocidad < -1 ? -0.4 : 1);
    const tx = c.pos[0] + f[0] * ad, ty = c.pos[1], tz = c.pos[2] + f[2] * ad;
    if (!e.listo) { e.x = tx; e.y = ty; e.z = tz; e.rumbo = rumbo; e.listo = true; }
    e.x = hacia(e.x, tx, dt, 0.25); e.y = hacia(e.y, ty, dt, 0.5); e.z = hacia(e.z, tz, dt, 0.25);
    const a = e.alto * Math.PI / 180, h = Math.cos(a) * e.dist;
    cam.position.set(e.x - Math.sin(e.rumbo) * h, e.y + Math.sin(a) * e.dist, e.z + Math.cos(e.rumbo) * h);
    cam.position.y = Math.max(cam.position.y, T.altura(cam.position.x, cam.position.z) + 2.5);
    if (cam.fov !== e.fov) { cam.fov = e.fov; cam.updateProjectionMatrix(); }
    cam.lookAt(e.x, e.y, e.z);
  }
  return {
    cam, estado: e, seguir,
    cambiar: () => { e.modo = (e.modo + 1) % CAMARAS.length; return CAMARAS[e.modo].nombre; },
    saltar: () => { e.listo = false; },
  };
}

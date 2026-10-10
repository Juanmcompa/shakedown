// Camara que sigue al auto. Los modos estan en config.js (tecla C, o el boton de la camara).
import * as THREE from 'three';
import { CAMARAS } from './config.js';

export function crearCamara(T) {
  const cam = new THREE.PerspectiveCamera(30, 1, 2, 900);
  const e = { modo: 0, rumbo: 0, dist: 60, alto: 60, fov: 30, x: 0, y: 0, z: 0, listo: false, cerca: 1, ancha: 1, adelante: 1, tiembla: 0, apuro: 0 };
  const quieta = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hacia = (a, b, dt, seg) => a + (b - a) * (1 - Math.exp(-dt / seg));

  function seguir(c, dt) {
    const m = CAMARAS[e.modo], v = Math.abs(c.velocidad), f = c.adelante, rapido = Math.min(1, v / 22);
    // recien cambiada de modo, se acomoda rapido; despues se mueve con calma
    const calma = e.apuro > 0 ? 0.3 : 1;
    e.apuro = Math.max(0, e.apuro - dt);
    // la camara gira despacio hasta ponerse atras del auto
    const rumbo = Math.atan2(f[0], -f[2]);
    let d = rumbo - e.rumbo;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    e.rumbo += d * (1 - Math.exp(-dt / m.sigue));
    // mas rapido: se aleja, baja un poco y mira mas adelante, para ver venir la curva
    e.dist = hacia(e.dist, (m.dist[0] + (m.dist[1] - m.dist[0]) * rapido) * e.cerca, dt, 0.9 * calma);
    e.alto = hacia(e.alto, m.alto[0] + (m.alto[1] - m.alto[0]) * rapido, dt, 0.9 * calma);
    e.fov = hacia(e.fov, Math.min(56, 2 * Math.atan(Math.tan(m.fov * Math.PI / 360) * e.ancha) * 180 / Math.PI), dt, 0.4);
    const ad = (m.mira[0] + (m.mira[1] - m.mira[0]) * rapido) * e.adelante * (c.velocidad < -1 ? -0.4 : 1);
    const tx = c.pos[0] + f[0] * ad, ty = c.pos[1], tz = c.pos[2] + f[2] * ad;
    if (!e.listo) { e.x = tx; e.y = ty; e.z = tz; e.rumbo = rumbo; e.listo = true; }
    e.x = hacia(e.x, tx, dt, 0.25); e.y = hacia(e.y, ty, dt, 0.5); e.z = hacia(e.z, tz, dt, 0.25);
    const a = e.alto * Math.PI / 180, h = Math.cos(a) * e.dist;
    cam.position.set(e.x - Math.sin(e.rumbo) * h, e.y + Math.sin(a) * e.dist, e.z + Math.cos(e.rumbo) * h);
    if (e.tiembla > 0.01) {   // sacudon por un golpe
      cam.position.x += (Math.random() - 0.5) * e.tiembla; cam.position.z += (Math.random() - 0.5) * e.tiembla;
      e.tiembla *= Math.exp(-dt * 9);
    }
    cam.position.y = Math.max(cam.position.y, T.altura(cam.position.x, cam.position.z) + 2.5);
    if (cam.fov !== e.fov) { cam.fov = e.fov; cam.updateProjectionMatrix(); }
    cam.lookAt(e.x, e.y, e.z);
  }
  return {
    cam, estado: e, seguir,
    // se adapta a la pantalla: se acerca si es chica y abre el angulo si es angosta (celular vertical)
    pantalla: (w, h) => {
      cam.aspect = w / h;
      e.cerca = Math.min(1, Math.max(0.62, Math.min(w, h) / 700));
      e.ancha = Math.max(1, 1.25 * h / w);
      e.adelante = w < h ? 1.3 : 1;
      cam.updateProjectionMatrix();
    },
    // cual esta puesta: { id, nombre, ... } (ver CAMARAS)
    modo: () => CAMARAS[e.modo],
    // pasa a la siguiente, o a la que se pida por su id. Devuelve la que quedo.
    cambiar: (id) => {
      const k = CAMARAS.findIndex((m) => m.id === id);
      e.modo = k >= 0 ? k : id === undefined ? (e.modo + 1) % CAMARAS.length : e.modo;
      e.apuro = 1.4;
      return CAMARAS[e.modo];
    },
    saltar: () => { e.listo = false; },
    sacudir: (cuanto) => { if (!quieta) e.tiembla = Math.min(1.6, 0.3 + cuanto / 25); },
  };
}

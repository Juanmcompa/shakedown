// La vitrina del garaje: el auto que estas armando, girando despacio sobre un piso gris, en un lienzo chico.
// Tiene su propia escena y su propio dibujante (aparte de los de la pista), y dibuja solo mientras se ve.
//   mostrar(C)   pone el auto de esa configuracion (ver partes.js)
//   prender(si)  empieza o deja de dibujar
import * as THREE from '../vendor/three.module.js';
import { armarAuto } from './autos.js';

export function crearVitrina(lienzo) {
  let render = null, escena, camara, auto = null, prendida = false, angulo = -0.7, antes = 0;
  function armar() {
    render = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true, alpha: true });
    render.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    escena = new THREE.Scene();
    camara = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    camara.position.set(0, 2.6, 7.4);
    camara.lookAt(0, 0.45, 0);
    escena.add(new THREE.HemisphereLight(0xfff2dc, 0x6a6058, 1.6));
    const sol = new THREE.DirectionalLight(0xffffff, 1.9);
    sol.position.set(-4, 7, 5);
    escena.add(sol);
    const piso = new THREE.Mesh(new THREE.CircleGeometry(3.4, 40), new THREE.MeshLambertMaterial({ color: 0x5a5c60 }));
    piso.rotation.x = -Math.PI / 2;
    escena.add(piso);
  }
  function medir() {
    const w = lienzo.clientWidth || 300, h = lienzo.clientHeight || 160;
    if (lienzo.width !== Math.round(w * render.getPixelRatio()) || lienzo.height !== Math.round(h * render.getPixelRatio())) {
      render.setSize(w, h, false);
      camara.aspect = w / h;
      // (que el auto entre entero, sea un buggy o un camion)
      camara.position.set(0, 2.4 + (auto ? auto.largo * 0.18 : 0.8), (auto ? 3.2 + auto.largo * 1.05 : 7.4) / Math.min(1, camara.aspect / 1.6));
      camara.lookAt(0, 0.5, 0);
      camara.updateProjectionMatrix();
    }
  }
  function cuadro(ahora) {
    if (!prendida) return;
    const dt = Math.min(0.1, (ahora - antes) / 1000);
    antes = ahora;
    angulo += dt * 0.5;
    if (auto) auto.grupo.rotation.y = angulo;
    medir();
    render.render(escena, camara);
    requestAnimationFrame(cuadro);
  }
  return {
    mostrar(C) {
      if (!render) armar();
      if (auto) escena.remove(auto.grupo);
      const { grupo } = armarAuto(C), caja = new THREE.Box3().setFromObject(grupo);
      grupo.position.y = -caja.min.y;   // apoyado en el piso
      const largo = caja.max.z - caja.min.z;
      auto = { grupo: new THREE.Group().add(grupo), largo };
      escena.add(auto.grupo);
      lienzo.width = 0;   // (para que se vuelva a encuadrar)
    },
    prender(si) {
      if (si === prendida) return;
      prendida = si;
      if (si) { if (!render) armar(); antes = performance.now(); requestAnimationFrame(cuadro); }
    },
  };
}

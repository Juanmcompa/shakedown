// Dibuja la camioneta con cajas y cilindros. El centro (0,0,0) es su centro de masa; el frente mira a -Z.
import * as THREE from 'three';
import { CAMIONETA as C } from './config.js';

export function crearDibujo(escena) {
  const grupo = new THREE.Group(), mats = {};
  const mat = (color) => mats[color] || (mats[color] = new THREE.MeshLambertMaterial({ color, flatShading: true }));
  const caja = (padre, color, w, h, d, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
    m.position.set(x, y, z);
    m.castShadow = true;
    padre.add(m);
    return m;
  };
  const CUERPO = 0xe2a81e, NEGRO = 0x1b1b1d, BLANCO = 0xf0ece2, VIDRIO = 0x27333d;

  caja(grupo, NEGRO, 1.5, 0.16, 4.0, 0, -0.38, 0);            // chasis
  caja(grupo, CUERPO, 1.84, 0.6, 4.4, 0, 0, 0.02);             // carroceria
  caja(grupo, NEGRO, 1.1, 0.03, 1.0, 0, 0.31, -1.5);           // capot negro mate
  caja(grupo, VIDRIO, 1.7, 0.6, 2.75, 0, 0.6, 0.7);            // cabina
  caja(grupo, CUERPO, 1.74, 0.6, 0.12, 0, 0.6, 2.05);          // porton
  caja(grupo, BLANCO, 1.78, 0.08, 2.85, 0, 0.93, 0.7);         // techo
  caja(grupo, NEGRO, 1.9, 0.24, 0.24, 0, -0.2, -2.3);          // paragolpes y malacate
  caja(grupo, 0x8a8a8a, 0.5, 0.2, 0.3, 0, -0.1, -2.36);
  caja(grupo, NEGRO, 1.9, 0.22, 0.2, 0, -0.2, 2.3);
  caja(grupo, NEGRO, 0.08, 1.0, 0.08, 0.93, 0.62, -0.72);      // snorkel
  for (const x of [-0.68, 0.68]) {
    caja(grupo, 0xfff3b8, 0.3, 0.2, 0.06, x, 0.08, -2.2);      // faros
    caja(grupo, 0xc6291e, 0.22, 0.16, 0.06, x, 0.08, 2.24);    // luces traseras
    for (const z of [-C.ejes, C.ejes]) caja(grupo, NEGRO, 0.2, 0.1, 1.15, x * 1.4, 0.0, z);   // guardabarros
  }
  // portaequipajes con la carga: lo que mas se ve desde arriba
  caja(grupo, NEGRO, 1.6, 0.05, 2.5, 0, 1.0, 0.75);
  caja(grupo, 0x55613c, 1.3, 0.26, 1.35, 0, 1.15, 1.25);       // carpa de techo
  caja(grupo, 0xe8791c, 0.3, 0.06, 1.15, -0.6, 1.06, -0.1);    // planchas de rescate
  caja(grupo, 0xe8791c, 0.3, 0.06, 1.15, -0.6, 1.13, -0.1);
  caja(grupo, 0xb5362a, 0.2, 0.34, 0.46, 0.62, 1.2, 0.3);      // bidones
  caja(grupo, 0xb5362a, 0.2, 0.34, 0.46, 0.38, 1.2, 0.3);
  caja(grupo, 0xf4f0e6, 1.1, 0.09, 0.09, 0, 1.03, -0.58);      // barra de luces
  const auxilio = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.26, 14), mat(NEGRO));
  auxilio.position.set(0.3, 1.16, -0.05);
  auxilio.castShadow = true;
  grupo.add(auxilio);

  // ruedas: un pivote que dobla y adentro la rueda que gira
  const gRueda = new THREE.CylinderGeometry(C.radio, C.radio, 0.3, 14).rotateZ(Math.PI / 2);
  const gLlanta = new THREE.CylinderGeometry(0.2, 0.2, 0.32, 8).rotateZ(Math.PI / 2);
  const ruedas = [];
  for (let i = 0; i < 4; i++) {
    const pivote = new THREE.Group(), rueda = new THREE.Group();
    const goma = new THREE.Mesh(gRueda, mat(0x18181a));
    goma.castShadow = true;
    rueda.add(goma, new THREE.Mesh(gLlanta, mat(0x9b9b9b)));
    for (let k = 0; k < 4; k++) {   // tacos, para que se note cuando patina
      const taco = caja(rueda, 0x3a3a3d, 0.32, 0.07, 0.16, 0, Math.cos(k * 1.5708) * C.radio, Math.sin(k * 1.5708) * C.radio);
      taco.rotation.x = k * 1.5708;
    }
    pivote.add(rueda);
    grupo.add(pivote);
    ruedas.push({ pivote, rueda });
  }
  escena.add(grupo);

  function actualizar(c) {
    grupo.position.fromArray(c.pos);
    grupo.quaternion.fromArray(c.q);
    c.ruedas.forEach((r, i) => {
      ruedas[i].pivote.position.set(r.x * 1.06, C.anclaje - r.largo, r.z);
      ruedas[i].pivote.rotation.y = r.delantera ? -c.giroRuedas : 0;
      ruedas[i].rueda.rotation.x = -r.giro;
    });
  }
  return { grupo, actualizar };
}

// Efectos: las huellas que quedan en el piso y los cubitos de barro, agua o polvo que saltan de las ruedas.
import * as THREE from 'three';
import { SUELO } from './config.js';
import { granito } from './arte.js';

export function crearEfectos(escena, huellas) {
  // por rueda: si venia tocando el piso y cuanto barro lleva pegado (lo va dejando en lo que pisa despues)
  const rueda = [0, 1, 2, 3].map(() => ({ toca: false, barro: 0, x: 0, z: 0 }));

  // --- cubitos que saltan ---
  const NP = 260, M = new THREE.Matrix4(), tmp = new THREE.Color();
  const motas = new THREE.InstancedMesh(new THREE.BoxGeometry(0.25, 0.25, 0.25), new THREE.MeshLambertMaterial({ map: granito() }), NP);
  motas.frustumCulled = false;
  const D = new Float32Array(NP * 8);   // x, y, z, vx, vy, vz, vida, tamano
  for (let i = 0; i < NP; i++) { motas.setMatrixAt(i, M.makeScale(0, 0, 0)); motas.setColorAt(i, tmp); }
  escena.add(motas);
  let sig = 0;
  function mota(x, y, z, vx, vy, vz, vida, tam, color, brillo) {
    const o = sig * 8;
    D[o] = x; D[o + 1] = y; D[o + 2] = z; D[o + 3] = vx; D[o + 4] = vy; D[o + 5] = vz; D[o + 6] = vida; D[o + 7] = tam;
    motas.setColorAt(sig, tmp.setHex(color).multiplyScalar(brillo));
    motas.instanceColor.needsUpdate = true;
    sig = (sig + 1) % NP;
  }

  function actualizar(c, dt) {
    const f = c.adelante, d = c.derecha, az = Math.random;
    c.ruedas.forEach((r, i) => {
      const w = rueda[i], s = SUELO[r.suelo];
      if (!r.toca) { if (w.toca) huellas.soltar(i); w.toca = false; return; }
      const vel = Math.abs(r.vl), mojado = c.agua > 0.05;
      // el barro se pega a la cubierta y se va soltando en los metros siguientes (en el agua se lava)
      const paso = Math.hypot(r.p[0] - w.x, r.p[2] - w.z);
      w.x = r.p[0]; w.z = r.p[2];
      if (w.toca && paso < 3) w.barro *= Math.exp(-paso / (mojado ? 1.5 : 7));
      if (s.blando >= 1) w.barro = 1;
      // huella: mas marcada en suelo blando o patinando; en suelo duro solo queda el barro que trae la rueda
      const fuerza = mojado ? 0 : Math.min(1, Math.max(s.blando * (0.45 + r.patina * 0.55), w.barro * 0.5, r.patina * 0.6));
      huellas.marcar(i, r.p[0], r.p[2], fuerza < 0.12 ? 0 : fuerza);
      w.toca = true;
      // lo que salta: barro si patina, agua en el vado, polvo en seco
      const cuanto = (r.patina * 1.3 + s.blando * Math.min(1, vel / 9) * 0.5 + (mojado ? Math.min(1, vel / 5) : 0)) * 45 * dt;
      if (az() < cuanto) {
        const tira = -c.sentido * (1.5 + r.patina * 7), sube = 2 + az() * 3.5, abre = (az() - 0.5) * 3.2;
        const polvo = s.blando < 0.45 && !mojado;
        mota(r.p[0], r.p[1] + 0.1, r.p[2],
          c.vel[0] * 0.5 + f[0] * tira + d[0] * abre, sube * (polvo ? 0.5 : 1) + c.vel[1] * 0.5, c.vel[2] * 0.5 + f[2] * tira + d[2] * abre,
          polvo ? 0.55 : 0.75, 1 + Math.floor(az() * (polvo ? 2 : 3)), mojado ? 0xcfe3e6 : s.color, mojado ? 1 : polvo ? 1.15 : 0.7 + az() * 0.3);
      }
    });
    huellas.subir();
    for (let i = 0; i < NP; i++) {
      const o = i * 8;
      if (D[o + 6] <= 0) continue;
      D[o + 6] -= dt; D[o + 4] -= 13 * dt;
      D[o] += D[o + 3] * dt; D[o + 1] += D[o + 4] * dt; D[o + 2] += D[o + 5] * dt;
      // el tamano va de a medio pixel (12,5 cm) y al final se achica de golpe, sin girar: son cubitos
      const t = D[o + 6] <= 0 ? 0 : D[o + 7] * (D[o + 6] < 0.12 ? 0.25 : 0.5);
      motas.setMatrixAt(i, M.makeScale(t, t, t).setPosition(D[o], D[o + 1], D[o + 2]));
    }
    motas.instanceMatrix.needsUpdate = true;
  }

  // la camioneta cambio de lugar de golpe (un rescate): las huellas no se unen con las de antes
  function cortar() { rueda.forEach((w) => { w.toca = false; w.barro = 0; }); huellas.cortar(); }
  return { actualizar, cortar };
}

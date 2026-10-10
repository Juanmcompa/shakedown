// Efectos: huellas que quedan en el piso y barro, agua o polvo que salta de las ruedas.
import * as THREE from 'three';
import { SUELO } from './config.js';

export function crearEfectos(escena) {
  // --- huellas: una cinta por rueda, que se va reescribiendo ---
  const N = 420, pos = new Float32Array(4 * N * 6), col = new Float32Array(4 * N * 8), idx = [];
  for (let r = 0; r < 4; r++) for (let i = 0; i < N; i++) {
    const a = (r * N + i) * 2, b = (r * N + (i + 1) % N) * 2;
    idx.push(a, a + 1, b, a + 1, b + 1, b);
  }
  const g = new THREE.BufferGeometry(), aPos = new THREE.BufferAttribute(pos, 3), aCol = new THREE.BufferAttribute(col, 4);
  g.setAttribute('position', aPos);
  g.setAttribute('color', aCol);
  g.setIndex(idx);
  const huellas = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
  huellas.frustumCulled = false;
  escena.add(huellas);
  const cinta = [0, 1, 2, 3].map(() => ({ k: 0, toca: false, p: [0, 0, 0] }));

  function marcar(i, p, lado, alfa) {
    const w = cinta[i];
    for (let s = 0; s < 2; s++) {
      const o = (i * N + w.k) * 2 + s, d = s ? -0.15 : 0.15;
      pos[o * 3] = p[0] + lado[0] * d; pos[o * 3 + 1] = p[1] + 0.06; pos[o * 3 + 2] = p[2] + lado[2] * d;
      col[o * 4] = 0.1; col[o * 4 + 1] = 0.06; col[o * 4 + 2] = 0.04; col[o * 4 + 3] = alfa;
      // los dos pares siguientes (los mas viejos) se apagan para cortar la cinta, y el primero se trae aca
      const o1 = (i * N + (w.k + 1) % N) * 2 + s;
      pos[o1 * 3] = pos[o * 3]; pos[o1 * 3 + 1] = pos[o * 3 + 1]; pos[o1 * 3 + 2] = pos[o * 3 + 2];
      col[o1 * 4 + 3] = 0;
      col[((i * N + (w.k + 2) % N) * 2 + s) * 4 + 3] = 0;
    }
    w.k = (w.k + 1) % N;
    w.p[0] = p[0]; w.p[1] = p[1]; w.p[2] = p[2];
    aPos.needsUpdate = aCol.needsUpdate = true;
  }

  // --- particulas ---
  const NP = 260, M = new THREE.Matrix4(), tmp = new THREE.Color();
  const motas = new THREE.InstancedMesh(new THREE.TetrahedronGeometry(0.14), new THREE.MeshLambertMaterial({ flatShading: true }), NP);
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
    const f = c.adelante, u = c.arriba, d = c.derecha, az = Math.random;
    c.ruedas.forEach((r, i) => {
      const w = cinta[i], s = SUELO[r.suelo];
      if (!r.toca) { if (w.toca) marcar(i, w.p, d, 0); w.toca = false; return; }
      const vel = Math.abs(r.vl), mojado = c.agua > 0.05;
      // huella: mas marcada en suelo blando o patinando
      const alfa = Math.min(0.6, s.blando * (0.32 + r.patina * 0.4) + r.patina * 0.2);
      if (!w.toca) { marcar(i, r.p, d, 0); w.toca = true; }
      else if ((r.p[0] - w.p[0]) ** 2 + (r.p[2] - w.p[2]) ** 2 > 0.2) marcar(i, r.p, d, alfa);
      // lo que salta: barro si patina, agua en el vado, polvo en seco
      const cuanto = (r.patina * 1.3 + s.blando * Math.min(1, vel / 9) * 0.5 + (mojado ? Math.min(1, vel / 5) : 0)) * 45 * dt;
      if (az() < cuanto) {
        const tira = -c.sentido * (1.5 + r.patina * 7), sube = 2 + az() * 3.5, abre = (az() - 0.5) * 3.2;
        const polvo = s.blando < 0.45 && !mojado;
        mota(r.p[0], r.p[1] + 0.1, r.p[2],
          c.vel[0] * 0.5 + f[0] * tira + d[0] * abre, sube * (polvo ? 0.5 : 1) + c.vel[1] * 0.5, c.vel[2] * 0.5 + f[2] * tira + d[2] * abre,
          polvo ? 0.55 : 0.75, polvo ? 0.5 + az() : 0.8 + az() * 1.3, mojado ? 0xcfe3e6 : s.color, mojado ? 1 : polvo ? 1.15 : 0.7 + az() * 0.3);
      }
    });
    for (let i = 0; i < NP; i++) {
      const o = i * 8;
      if (D[o + 6] <= 0) continue;
      D[o + 6] -= dt; D[o + 4] -= 13 * dt;
      D[o] += D[o + 3] * dt; D[o + 1] += D[o + 4] * dt; D[o + 2] += D[o + 5] * dt;
      const t = D[o + 6] > 0 ? D[o + 7] * Math.min(1, D[o + 6] * 4) : 0;
      motas.setMatrixAt(i, M.makeScale(t, t, t).setPosition(D[o], D[o + 1], D[o + 2]));
    }
    motas.instanceMatrix.needsUpdate = true;
  }

  // corta las huellas (al volver a un control)
  function cortar() { cinta.forEach((w, i) => { if (w.toca) marcar(i, w.p, [0, 0, 0], 0); w.toca = false; }); }
  return { actualizar, cortar };
}

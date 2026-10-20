// Como se ve la carga del camion (La Montaña del Sufrimiento): los cajones, los troncos y las cuerdas que los atan.
// La fisica esta en camion.js; aca solo se dibuja lo que ella dice (posicion de cada bulto, cuerdas tensas o cortadas).
// Los bultos van sueltos en la escena (en coordenadas del mundo): arriba del camion giran con el, y los que se perdieron
// siguen cayendo y dando vueltas. Nada de esto cambia la fisica, asi que puede usar lo que quiera para verse mejor.
import * as THREE from '../vendor/three.module.js';
import { conEstilo } from './material.js';

const MADERA = [0x8f6a3e, 0x6b4c2c, 0xb08a56], CORTEZA = [0x5a3f27, 0x6e4e30], CUERDA = 0xd8c48a;

function cajon(hx, hy, hz) {
  const g = new THREE.Group();
  const caja = new THREE.Mesh(new THREE.BoxGeometry(hx * 2, hy * 2, hz * 2), new THREE.MeshLambertMaterial({ color: MADERA[0] }));
  g.add(caja);
  // los listones (se ven como tablas clavadas) y los cantos
  const lista = new THREE.MeshLambertMaterial({ color: MADERA[1] });
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const palo = new THREE.Mesh(new THREE.BoxGeometry(0.1, hy * 2 + 0.04, 0.1), lista);
    palo.position.set(x * (hx - 0.03), 0, z * (hz - 0.03));
    g.add(palo);
  }
  for (const y of [-1, 1]) {
    const marco = new THREE.Mesh(new THREE.BoxGeometry(hx * 2 + 0.04, 0.09, hz * 2 + 0.04), lista);
    marco.position.y = y * (hy - 0.05);
    g.add(marco);
  }
  const cruz = new THREE.Mesh(new THREE.BoxGeometry(hx * 2 + 0.05, 0.08, 0.06), new THREE.MeshLambertMaterial({ color: MADERA[2] }));
  cruz.position.set(0, 0, hz + 0.01);
  cruz.rotation.z = 0.7;
  g.add(cruz);
  return g;
}
function tronco(hx, hy) {
  const g = new THREE.Group();
  const cuerpo = new THREE.Mesh(new THREE.CylinderGeometry(hy, hy, hx * 2, 7), new THREE.MeshLambertMaterial({ color: CORTEZA[0] }));
  cuerpo.rotation.z = Math.PI / 2;
  g.add(cuerpo);
  for (const x of [-1, 1]) {   // las puntas, claras
    const tapa = new THREE.Mesh(new THREE.CylinderGeometry(hy * 0.92, hy * 0.92, 0.02, 7), new THREE.MeshLambertMaterial({ color: MADERA[2] }));
    tapa.rotation.z = Math.PI / 2; tapa.position.x = x * (hx + 0.005);
    g.add(tapa);
  }
  return g;
}

export function crearVistaCamion(escena, c) {
  const raiz = new THREE.Group();
  escena.add(raiz);
  const matCuerda = new THREE.MeshBasicMaterial({ color: CUERDA });
  const vistos = c.carga.bultos.map((b) => {
    const malla = b.tipo === 'tronco' ? tronco(b.hx, b.hy) : cajon(b.hx, b.hy, b.hz);
    malla.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
    raiz.add(malla);
    const cuerdas = b.cuerdas.map(() => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 1), matCuerda); raiz.add(m); return m; });
    return { b, malla, cuerdas, q: new THREE.Quaternion(), libre: false };
  });
  conEstilo(raiz);
  const qc = new THREE.Quaternion(), A = new THREE.Vector3(), B = new THREE.Vector3(), eje = new THREE.Vector3(), dq = new THREE.Quaternion();

  return {
    grupo: raiz,
    actualizar(c, dt = 0) {
      qc.fromArray(c.q);
      for (const v of vistos) {
        const b = v.b;
        v.malla.visible = b.estado !== 'fuera';
        if (!v.malla.visible) { for (const k of v.cuerdas) k.visible = false; continue; }
        if (b.estado === 'caja') { v.q.copy(qc); v.libre = false; }
        else {
          // un bulto perdido: gira con lo que traia al caerse
          v.libre = true;
          eje.set(b.giro[0], b.giro[1], b.giro[2]);
          const w = eje.length();
          if (w > 1e-4) { dq.setFromAxisAngle(eje.divideScalar(w), w * dt); v.q.premultiply(dq); }
        }
        v.malla.position.set(b.p[0], b.p[1], b.p[2]);
        v.malla.quaternion.copy(v.q);
        // las cuerdas: del borde de la caja a la parte de arriba del bulto (se ponen rojizas cuando tiran fuerte)
        b.cuerdas.forEach((k, i) => {
          const m = v.cuerdas[i];
          m.visible = !k.rota && b.estado === 'caja';
          if (!m.visible) return;
          // el ancla va pegada al camion
          A.set(k.ancla[0], k.ancla[1], k.ancla[2]).applyQuaternion(qc).add(B.set(c.pos[0], c.pos[1], c.pos[2]));
          B.set(0, b.hy, 0).applyQuaternion(qc).add(eje.set(b.p[0], b.p[1], b.p[2]));
          m.position.copy(A).add(B).multiplyScalar(0.5);
          m.scale.set(1, 1, Math.max(0.05, A.distanceTo(B)));
          m.lookAt(B);
          m.material = matCuerda;
        });
      }
    },
    // al volver al camino los bultos que quedan se acomodan solos: no hay nada que reiniciar mas que lo que se perdio
    reiniciar() { for (const v of vistos) { v.q.copy(qc); } },
    ocultar() { raiz.visible = false; },
    mostrar() { raiz.visible = true; },
    sacar() { escena.remove(raiz); },
  };
}

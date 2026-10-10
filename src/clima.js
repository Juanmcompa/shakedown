// El clima y las luces chicas: la lluvia que cae, los faros del auto cuando hay poca luz
// y los resplandores en el piso (fogones, bengalas). Las luces grandes (sol y cielo) estan en world.js.
import * as THREE from 'three';
import { ambiente } from './material.js';
import { lienzoPintado } from './pixel.js';

// Un resplandor: un circulo de luz apoyado en el piso, hecho de anillos (como todo, de pocos pixeles).
function texturaDeResplandor() {
  const l = lienzoPintado(16, 16, (p) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const d = Math.hypot(x - 7.5, y - 7.5) / 8, v = d > 1 ? 0 : d > 0.78 ? 0.1 : d > 0.55 ? 0.24 : d > 0.32 ? 0.48 : 0.8, n = Math.round(v * 255);
      p.punto(x, y, 'rgb(' + n + ',' + n + ',' + n + ')');
    }
  });
  const t = new THREE.CanvasTexture(l);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
  return t;
}

// luz: la del clima (de world.js). Devuelve { resplandor(x, y, z, radio, color), animar(dt, t, c) }.
export function crearClima(T, escena, luz) {
  const V = new THREE.Vector3(), M = new THREE.Matrix4(), Q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2), E = new THREE.Vector3(), tinta = new THREE.Color();

  // --- faros del auto: una luz que va adelante, un poco alta para que el camino se vea iluminado desde arriba ---
  let faros = null;
  if (luz.faros) {
    faros = new THREE.SpotLight(0xfff0c8, luz.faros, 64, 0.6, 0.8, 1);
    escena.add(faros, faros.target);
  }

  // --- resplandores en el piso ---
  const MAX = 64, donde = [];
  const pozos = new THREE.InstancedMesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: texturaDeResplandor(), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), MAX);
  pozos.count = 0; pozos.frustumCulled = false; pozos.renderOrder = 2;
  escena.add(pozos);

  // --- lluvia: rayitas que caen alrededor del auto (siempre las mismas, que dan la vuelta) ---
  let lluvia = null;
  if (luz.lluvia) {
    const N = 1100, g = new THREE.InstancedBufferGeometry(), semillas = new Float32Array(N * 3);
    for (let i = 0; i < N * 3; i++) semillas[i] = Math.random();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0], 3));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    g.setAttribute('aSemilla', new THREE.InstancedBufferAttribute(semillas, 3));
    g.instanceCount = N;
    lluvia = new THREE.Mesh(g, new THREE.ShaderMaterial({
      uniforms: { uCentro: ambiente.centro, uTiempo: ambiente.tiempo, uCamDer: ambiente.camDer, uCuanto: { value: luz.lluvia } },
      vertexShader: `
        attribute vec3 aSemilla; uniform vec3 uCentro, uCamDer; uniform float uTiempo; varying float vClaro;
        void main() {
          const vec3 CAJA = vec3(90.0, 46.0, 90.0);
          vec3 viento = normalize(vec3(0.22, -1.0, 0.1));
          vec3 p = aSemilla * CAJA;
          p += viento * uTiempo * (24.0 + aSemilla.x * 9.0);
          p = mod(p - uCentro + CAJA * 0.5, CAJA) - CAJA * 0.5 + uCentro;   // la caja de lluvia acompaña al auto
          p.y += 14.0;
          vec3 punto = p + uCamDer * (position.x * 0.07) - viento * (position.y * (0.9 + aSemilla.z * 0.7));
          vClaro = 0.55 + aSemilla.y * 0.45;
          gl_Position = projectionMatrix * viewMatrix * vec4(punto, 1.0);
        }`,
      fragmentShader: 'uniform float uCuanto; varying float vClaro; void main() { gl_FragColor = vec4(vec3(0.78, 0.86, 0.93) * vClaro, 0.42 * uCuanto); }',
      transparent: true, depthWrite: false,
    }));
    lluvia.frustumCulled = false; lluvia.renderOrder = 6;
    escena.add(lluvia);
  }

  return {
    // agrega un resplandor en el piso. Devuelve su numero (para moverlo o apagarlo con mover()).
    resplandor: (x, y, z, radio, color, titila = 0.12) => {
      if (donde.length >= MAX) return -1;
      donde.push({ x, y, z, radio, color: new THREE.Color(color), titila, fase: Math.random() * 9 });
      pozos.count = donde.length;
      return donde.length - 1;
    },
    mover: (n, x, y, z) => { const d = donde[n]; if (d) { d.x = x; d.y = y; d.z = z; } },
    animar: (dt, t, c) => {
      if (faros) {
        const f = c.adelante;
        faros.position.set(c.pos[0] + f[0] * 1.5, c.pos[1] + 4.2, c.pos[2] + f[2] * 1.5);
        faros.target.position.set(c.pos[0] + f[0] * 17, c.pos[1] - 0.5 + f[1] * 17, c.pos[2] + f[2] * 17);
      }
      donde.forEach((d, i) => {
        const s = d.radio * (1 + Math.sin(t * 9 + d.fase) * d.titila + Math.sin(t * 23 + d.fase * 3) * d.titila * 0.5);
        pozos.setMatrixAt(i, M.compose(V.set(d.x, d.y + 0.12, d.z), Q, E.set(s, s, 1)));
        pozos.setColorAt(i, tinta.copy(d.color).multiplyScalar(0.85 + Math.sin(t * 13 + d.fase) * d.titila));
      });
      if (donde.length) { pozos.instanceMatrix.needsUpdate = true; pozos.instanceColor.needsUpdate = true; }
    },
  };
}

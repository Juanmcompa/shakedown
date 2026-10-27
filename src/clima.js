// El clima y las luces chicas: la lluvia que cae, los faros del auto cuando hay poca luz
// y los resplandores en el piso (fogones, bengalas). Las luces grandes (sol y cielo) estan en world.js.
import * as THREE from '../vendor/three.module.js';
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
  // (se arma siempre y se prende o apaga segun la hora: ver poner). De noche el haz es largo y abierto, y ademas se dibuja
  // un cono de luz apenas visible (como el haz en el polvo y la humedad) y un resplandor en el piso delante del auto.
  const faros = new THREE.SpotLight(0xfff0c8, 0, 64, 0.6, 0.8, 1);
  faros.visible = false;
  escena.add(faros, faros.target);
  let pFaros = { fuerza: 0, alcance: 64, apertura: 0.6, punta: 17, haz: 0 };
  const haz = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 20, 1, true).translate(0, -0.5, 0).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
    uniforms: { uFuerza: { value: 0.3 } },
    vertexShader: 'varying float vT; varying vec3 vN; void main() { vT = position.z; vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    // se apaga hacia la punta y hacia el borde del cono (visto de costado casi no se ve; de frente, un poco mas)
    fragmentShader: 'uniform float uFuerza; varying float vT; varying vec3 vN; void main() { float borde = abs(dot(normalize(vN), vec3(0.0, 0.0, 1.0))); float a = pow(1.0 - vT, 1.5) * smoothstep(0.0, 0.2, vT) * (0.35 + 0.65 * (1.0 - borde)) * uFuerza; gl_FragColor = vec4(vec3(1.0, 0.93, 0.74) * a, a); }',
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
  }));
  haz.visible = false; haz.frustumCulled = false; haz.renderOrder = 3;
  escena.add(haz);

  // --- resplandores en el piso ---
  const MAX = 200, donde = [];
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

  // las luces del auto sobre el piso: dos delanteras (un halo chico) y dos traseras rojas (mas fuertes al frenar)
  const iDel = [], iTra = [];
  const luzDeAuto = (lista, color, radio, titila) => { for (let k = 0; k < 2; k++) { donde.push({ x: 0, y: -999, z: 0, radio, base: radio, color: new THREE.Color(color), titila, fase: k * 2, auto: true }); lista.push(donde.length - 1); } pozos.count = donde.length; };
  luzDeAuto(iDel, 0xfff0c8, 1.7, 0.02); luzDeAuto(iTra, 0xff2410, 0.8, 0.03);
  let conLuces = false;

  return {
    // prende o apaga los faros, el haz y los resplandores segun la luz de la hora (ver luzDe en world.js)
    poner: (L) => {
      const f = L.faros || 0;
      pFaros = { fuerza: f, alcance: L.farosAlcance || 64, apertura: L.farosApertura || 0.6, punta: L.farosPunta || 17, haz: L.haz || 0 };
      faros.visible = f > 0; faros.intensity = f; faros.distance = pFaros.alcance; faros.angle = pFaros.apertura;
      faros.penumbra = L.farosAlcance ? 0.85 : 0.8; faros.decay = L.farosAlcance ? 0.6 : 1;
      haz.visible = f > 0 && pFaros.haz > 0; haz.material.uniforms.uFuerza.value = 0.34 * pFaros.haz;
      conLuces = f > 0 && !!L.farosAlcance;   // las luces del auto en el piso: solo de noche
      for (const k of [...iDel, ...iTra]) if (!conLuces) donde[k].y = -999;
    },
    // agrega un resplandor en el piso. Devuelve su numero (para moverlo o apagarlo con mover()).
    resplandor: (x, y, z, radio, color, titila = 0.12) => {
      if (donde.length >= MAX) return -1;
      donde.push({ x, y, z, radio, color: new THREE.Color(color), titila, fase: Math.random() * 9 });
      pozos.count = donde.length;
      return donde.length - 1;
    },
    mover: (n, x, y, z) => { const d = donde[n]; if (d) { d.x = x; d.y = y; d.z = z; } },
    animar: (dt, t, c) => {
      if (faros.visible) {
        const f = c.adelante, p = pFaros.punta;
        faros.position.set(c.pos[0] + f[0] * 1.5, c.pos[1] + 4.2, c.pos[2] + f[2] * 1.5);
        faros.target.position.set(c.pos[0] + f[0] * p, c.pos[1] - 0.5 + f[1] * p, c.pos[2] + f[2] * p);
        if (haz.visible) {
          // el cono sale del frente del auto, un metro alto, y se abre hacia adelante y un poco hacia abajo
          const largo = Math.min(pFaros.alcance * 0.5, 42);
          haz.position.set(c.pos[0] + f[0] * 1.9, c.pos[1] + 0.85, c.pos[2] + f[2] * 1.9);
          haz.lookAt(c.pos[0] + f[0] * 20, c.pos[1] + 0.2 + f[1] * 20, c.pos[2] + f[2] * 20);
          haz.scale.set(Math.tan(pFaros.apertura * 0.8) * largo, Math.tan(pFaros.apertura * 0.8) * largo * 0.55, largo);
        }
      }
      if (conLuces) {
        const f = c.adelante, d = c.derecha || [-f[2], 0, f[0]], fre = c.frenando ? 1.7 : 1;
        for (let k = 0; k < 2; k++) {
          const s = k ? 0.62 : -0.62, a = donde[iDel[k]], b = donde[iTra[k]];
          a.x = c.pos[0] + f[0] * 2.3 + d[0] * s; a.z = c.pos[2] + f[2] * 2.3 + d[2] * s; a.y = c.pos[1] - 0.1;
          b.x = c.pos[0] - f[0] * 2.0 + d[0] * s; b.z = c.pos[2] - f[2] * 2.0 + d[2] * s; b.y = c.pos[1] - 0.1; b.radio = b.base * fre;
        }
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

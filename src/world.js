// Dibuja el mundo: terreno, agua, arboles, piedras, arcos de control y luces.
import * as THREE from 'three';
import { SUELO } from './config.js';
import { crearRuido } from './noise.js';

const AMARILLO = 0xf2c200, VERDE = 0x3f9150;

// Lo que esta mas abajo que la camioneta se ve mas oscuro y azulado: asi se nota el precipicio desde arriba.
// En el terreno ademas se dibujan curvas de nivel cada 2 m (mas marcadas cada 10 m).
const bajo = { value: 0 };
function conAltura(mat, curvas) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uBajo = bajo;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vAlto;')
      .replace('#include <begin_vertex>', [
        '#include <begin_vertex>',
        'vec4 enMundo = vec4(transformed, 1.0);',
        '#ifdef USE_INSTANCING',
        'enMundo = instanceMatrix * enMundo;',
        '#endif',
        'vAlto = (modelMatrix * enMundo).y;',
      ].join('\n'));
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vAlto;\nuniform float uBajo;')
      .replace('#include <color_fragment>', [
        '#include <color_fragment>',
        curvas ? 'float c1 = abs(fract(vAlto / 2.0 - 0.5) - 0.5) / max(fwidth(vAlto / 2.0), 0.0001);' : '',
        curvas ? 'float c2 = abs(fract(vAlto / 10.0 - 0.5) - 0.5) / max(fwidth(vAlto / 10.0), 0.0001);' : '',
        curvas ? 'diffuseColor.rgb *= 1.0 - max((1.0 - smoothstep(0.3, 1.2, c1)) * 0.2, (1.0 - smoothstep(0.6, 1.8, c2)) * 0.36);' : '',
        'diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.07, 0.12, 0.2), smoothstep(1.5, 28.0, uBajo - vAlto) * 0.68);',
      ].join('\n'));
  };
  return mat;
}

export function crearMundo(T, escena) {
  const { nx, nz, H, S, celda, x0, z0 } = T, ruido = crearRuido(99);
  const tmp = new THREE.Color(), base = SUELO.map((s) => new THREE.Color(s.color)), pastoOscuro = new THREE.Color(0x3f6f33);

  // --- terreno, en pedazos de 64 x 64 metros para dibujar solo lo que se ve ---
  const mat = conAltura(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), true);
  const TAM = 64;
  for (let cz = 0; cz < nz - 1; cz += TAM) for (let cx = 0; cx < nx - 1; cx += TAM) {
    const w = Math.min(TAM, nx - 1 - cx), h = Math.min(TAM, nz - 1 - cz);
    const pos = new Float32Array((w + 1) * (h + 1) * 3), col = new Float32Array(pos.length), idx = [];
    for (let j = 0; j <= h; j++) for (let i = 0; i <= w; i++) {
      const gx = cx + i, gz = cz + j, k = gz * nx + gx, o = (j * (w + 1) + i) * 3;
      pos[o] = x0 + gx * celda; pos[o + 1] = H[k]; pos[o + 2] = z0 + gz * celda;
      tmp.copy(base[S[k]]);
      if (S[k] === 4) tmp.lerp(pastoOscuro, ruido.n2(gx * 0.07, gz * 0.07));
      tmp.multiplyScalar(0.84 + ruido.n2(gx * 0.9 + 40, gz * 0.9) * 0.3);
      col[o] = tmp.r; col[o + 1] = tmp.g; col[o + 2] = tmp.b;
      if (i < w && j < h) { const a = j * (w + 1) + i, b = a + 1, c = a + w + 1; idx.push(a, c, b, b, c, c + 1); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat);
    m.receiveShadow = true; m.castShadow = true;
    escena.add(m);
  }

  // --- agua ---
  const matAgua = new THREE.MeshLambertMaterial({ color: 0x4f8f96, transparent: true, opacity: 0.74, depthWrite: false, side: THREE.DoubleSide });
  for (const a of T.aguas) {
    const p = [];
    for (const [u, v] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) p.push(a.x + a.hx * a.cruce * u - a.hz * a.largo * v, a.nivel, a.z + a.hz * a.cruce * u + a.hx * a.largo * v);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(p), 3));
    g.setIndex([0, 2, 1, 1, 2, 3]);
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, matAgua);
    m.receiveShadow = true;
    escena.add(m);
  }

  // --- charcos de los pantanos: barro aguado, claro, para que se distingan de una sombra ---
  const matCharco = new THREE.MeshLambertMaterial({ color: 0xb09a78, transparent: true, opacity: 0.92, depthWrite: false });
  for (const ch of T.charcos) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(ch.r, 20).rotateX(-Math.PI / 2), matCharco);
    m.position.set(ch.x, ch.y, ch.z);
    m.receiveShadow = true;
    escena.add(m);
  }

  // --- arboles y piedras, agrupados por zona ---
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), E = new THREE.Vector3(), ARRIBA = new THREE.Vector3(0, 1, 0);
  const gCopa = new THREE.IcosahedronGeometry(1, 1), gTronco = new THREE.CylinderGeometry(0.2, 0.32, 1, 6), gPiedra = new THREE.DodecahedronGeometry(1, 0);
  const mCopa = conAltura(new THREE.MeshLambertMaterial({ flatShading: true })), mTronco = conAltura(new THREE.MeshLambertMaterial({ color: 0x5a4030 })), mPiedra = conAltura(new THREE.MeshLambertMaterial({ flatShading: true }));
  const verdes = [new THREE.Color(0x2f6b34), new THREE.Color(0x5c9a3e), new THREE.Color(0xd9799b)], gris = new THREE.Color(0x8b8780);
  const zonas = new Map();
  for (const o of T.cosas) {
    const k = Math.floor(o.z / 110) * 2 + (o.tipo === 3 ? 1 : 0);
    if (!zonas.has(k)) zonas.set(k, []);
    zonas.get(k).push(o);
  }
  for (const [k, lista] of zonas) {
    if (k % 2 !== 0) {
      const piedras = new THREE.InstancedMesh(gPiedra, mPiedra, lista.length);
      lista.forEach((o, i) => {
        Q.setFromAxisAngle(ARRIBA, o.vuelta);
        M.compose(V.set(o.x, o.y + o.r * 0.25, o.z), Q, E.set(o.r, o.r * o.alto, o.r * 0.85));
        piedras.setMatrixAt(i, M);
        piedras.setColorAt(i, tmp.copy(gris).multiplyScalar(0.8 + (o.vuelta % 1) * 0.35));
      });
      piedras.castShadow = piedras.receiveShadow = true;
      escena.add(piedras);
      continue;
    }
    const copas = new THREE.InstancedMesh(gCopa, mCopa, lista.length), troncos = new THREE.InstancedMesh(gTronco, mTronco, lista.length);
    lista.forEach((o, i) => {
      const alto = 3.2 * o.alto, r = 2.1 * o.alto;
      Q.setFromAxisAngle(ARRIBA, o.vuelta);
      M.compose(V.set(o.x, o.y + alto / 2 - 0.4, o.z), Q, E.set(1, alto + 0.8, 1));
      troncos.setMatrixAt(i, M);
      M.compose(V.set(o.x, o.y + alto + r * 0.4, o.z), Q, E.set(r, r * 0.78, r));
      copas.setMatrixAt(i, M);
      copas.setColorAt(i, o.tipo === 2 ? verdes[2] : tmp.copy(verdes[o.tipo]).multiplyScalar(0.75 + (o.vuelta % 1) * 0.45));
    });
    copas.castShadow = troncos.castShadow = true;
    escena.add(copas, troncos);
  }

  // --- mojones blancos al borde del precipicio ---
  const postes = new THREE.InstancedMesh(new THREE.BoxGeometry(0.32, 1.3, 0.32), new THREE.MeshLambertMaterial({ color: 0xf4f1e8 }), T.mojones.length);
  T.mojones.forEach((o, i) => postes.setMatrixAt(i, M.makeTranslation(o.x, o.y + 0.35, o.z)));
  postes.castShadow = true;
  escena.add(postes);

  // --- arcos: uno por control y uno mas grande en la meta ---
  function arco(p, color, alto) {
    const g = new THREE.Group(), a = p.ancho / 2 + 0.9;
    const mPalo = new THREE.MeshLambertMaterial({ color: 0x26262a });
    for (const s of [-1, 1]) {
      const palo = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, alto + 3, 8), mPalo);
      palo.position.set(s * a, (alto + 3) / 2 - 3, 0);
      palo.castShadow = true;
      g.add(palo);
    }
    const viga = new THREE.Mesh(new THREE.BoxGeometry(a * 2 + 0.6, 0.55, 1.1), new THREE.MeshLambertMaterial({ color }));
    viga.position.y = alto;
    viga.castShadow = true;
    g.add(viga);
    g.position.set(p.x, T.altura(p.x, p.z), p.z);
    g.rotation.y = -p.rumbo;
    escena.add(g);
    return viga;
  }
  const arcos = T.controles.map((p) => arco(p, AMARILLO, 4.6));
  const lona = document.createElement('canvas');
  lona.width = 96; lona.height = 16;
  const cx2 = lona.getContext('2d');
  for (let i = 0; i < 12; i++) for (let j = 0; j < 2; j++) { cx2.fillStyle = (i + j) % 2 ? '#111' : '#fff'; cx2.fillRect(i * 8, j * 8, 8, 8); }
  const tex = new THREE.CanvasTexture(lona);
  tex.colorSpace = THREE.SRGBColorSpace; tex.magFilter = THREE.NearestFilter;
  const meta = arco(T.meta, 0xffffff, 5.4);
  meta.material.map = tex;

  // --- luces: cielo + sol con sombras que siguen a la camara ---
  escena.background = new THREE.Color(0xcfe2e8);
  escena.fog = new THREE.Fog(0xcfe2e8, 150, 560);
  escena.add(new THREE.HemisphereLight(0xe2eef7, 0x6e5a45, 1.15));
  const sol = new THREE.DirectionalLight(0xfff1d8, 2.5), haciaElSol = new THREE.Vector3(-0.5, 0.8, -0.2).normalize();
  sol.castShadow = true;
  sol.shadow.mapSize.set(2048, 2048);
  const sc = sol.shadow.camera, R = 90;
  sc.left = sc.bottom = -R; sc.right = sc.top = R; sc.near = 10; sc.far = 480;
  sol.shadow.bias = -0.0005; sol.shadow.normalBias = 0.5;
  escena.add(sol, sol.target);
  const ejeX = new THREE.Vector3().crossVectors(ARRIBA, haciaElSol).normalize(), ejeY = new THREE.Vector3().crossVectors(haciaElSol, ejeX);
  const paso = 2 * R / 2048;
  function sombra(x, y, z) {
    // se mueve de a un pixel de sombra para que los bordes no tiemblen
    V.set(x, y, z);
    const a = V.dot(ejeX), b = V.dot(ejeY);
    V.addScaledVector(ejeX, Math.round(a / paso) * paso - a).addScaledVector(ejeY, Math.round(b / paso) * paso - b);
    sol.target.position.copy(V);
    sol.position.copy(V).addScaledVector(haciaElSol, 230);
  }

  return {
    sombra,
    bajo: (y) => { bajo.value = y; },
    pasar: (i) => arcos[i].material.color.setHex(VERDE),
    reiniciar: () => arcos.forEach((a) => a.material.color.setHex(AMARILLO)),
  };
}

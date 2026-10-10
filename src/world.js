// Dibuja el mundo: terreno, agua, arboles, piedras, arcos de control y luces.
// Todo esta hecho de bloques y de dibujos de pocos pixeles (las herramientas estan en pixel.js y los dibujos en arte.js).
import * as THREE from 'three';
import { SUELOS } from './config.js';
import { crearRuido, azar } from './noise.js';
import { armarCamioneta, chatarra } from './truck.js';
import { crearAtlas, crearLote, glslPixel, GLSL_AZAR } from './pixel.js';
import { texturaDePisos, crearEscenografia, dibujosDeBidon, marcaDeBidon, rayasDeArco, cuadrosDeMeta, granito, MONTE, PARED } from './arte.js';

const AMARILLO = 0xf2c200, VERDE = 0x3f9150;

// --- lo que se le agrega a los materiales ---
// Para todos: lo que esta mas abajo que la camioneta se ve mas oscuro y azulado, asi se nota el precipicio desde arriba.
// "calada": a las copas de los arboles se les abre un hueco alrededor de la camioneta, para que no la tapen.
// "cabeza" y "cuerpo": codigo propio de ese material (el piso y el agua). "sombras": sombras de pixeles enteros.
const bajo = { value: 0 }, hueco = { value: new THREE.Vector3(-9999, -9999, 1) }, tiempo = { value: 0 };
const CALADA = `
  float lejosDelHueco = distance(gl_FragCoord.xy, uHueco.xy) / uHueco.z;
  vec2 trama = mod(floor(gl_FragCoord.xy), 2.0);
  if (lejosDelHueco < 1.0 && (lejosDelHueco < 0.62 ? trama.x + trama.y > 0.5 : trama.x == trama.y)) discard;`;
const SOMBRA = `
  #if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
    #if defined( SHADOWMAP_TYPE_PCF )
    float sombraDura(sampler2DShadow mapa, DirectionalLightShadow s, vec4 c) {
      c.xyz /= c.w; c.z += s.shadowBias;
      if (c.x < 0.0 || c.x > 1.0 || c.y < 0.0 || c.y > 1.0 || c.z > 1.0) return 1.0;
      return mix(1.0, step(0.5, texture(mapa, c.xyz)), s.shadowIntensity);
    }
    #else
    float sombraDura(sampler2D mapa, DirectionalLightShadow s, vec4 c) { return getShadow(mapa, s.shadowMapSize, s.shadowIntensity, s.shadowBias, s.shadowRadius, c); }
    #endif
  #endif`;
const LUCES = THREE.ShaderChunk.lights_fragment_begin.replace(
  'getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] )',
  'sombraDura( directionalShadowMap[ i ], directionalLightShadow, sombraPix )');

function estilo(mat, o = {}) {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { uBajo: bajo, uHueco: hueco, uTiempo: tiempo }, o.datos);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vMundo;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vec4 enMundo = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          enMundo = instanceMatrix * enMundo;
        #endif
        vMundo = (modelMatrix * enMundo).xyz;`);
    let f = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vMundo;\nuniform float uBajo, uTiempo;\nuniform vec3 uHueco;\n' + GLSL_AZAR + (o.cabeza || ''))
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + (o.cuerpo || 'float altoPix = vMundo.y;') + `
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.07, 0.12, 0.2), smoothstep(1.5, 28.0, uBajo - altoPix) * 0.68);` + (o.calada ? CALADA : ''));
    if (o.sombras) {
      f = f.replace('#include <shadowmap_pars_fragment>', '#include <shadowmap_pars_fragment>\n' + SOMBRA)
        .replace('#include <lights_fragment_begin>', `
          #if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
            vec4 sombraPix = EN_PIXEL(vDirectionalShadowCoord[ 0 ]);
          #endif
          ` + LUCES);
    }
    sh.fragmentShader = f;
  };
  mat.customProgramCacheKey = () => 'encajados-' + (o.clave || (o.calada ? 'calada' : 'comun'));
  return mat;
}

// El piso: cada pixel mide 25 cm y esta alineado con el mundo. El suelo de cada pixel sale de un mapa (una celda por metro).
const PISO = {
  cabeza: `
    uniform sampler2D uMapa;
    uniform sampler2DArray uPisos;
    uniform sampler2D uHuellas;   // por donde pasaron las ruedas (un dato por pixel del mundo)
    uniform vec4 uCampo;      // origen del mapa (x, z) y cantidad de celdas
    uniform vec2 uCorre[4];   // velocidad de la tierra en cada derrumbe (el 0 es "quieto")`,
  cuerpo: glslPixel(true) + `
    float altoPix = EN_PIXEL(vMundo.y);
    // la celda se sortea entre las vecinas, asi el borde entre dos suelos queda salpicado y no en escalera
    vec2 dado = vec2(azar12(pix), azar12(pix + 71.7));
    ivec2 celda = clamp(ivec2(floor(centro + (dado - 0.5) * 0.9 - uCampo.xy + 0.5)), ivec2(0), ivec2(uCampo.zw) - 1);
    vec4 dato = texelFetch(uMapa, celda, 0);
    float capa = floor(dato.r * 255.0 + 0.5);
    vec2 corrido = centro - floor(uCorre[int(dato.b * 255.0 + 0.5)] * uTiempo * 4.0) * 0.25;   // en un derrumbe, el dibujo se corre de a un pixel
    if (plano != 0) {   // en un paredon el dibujo se pega sobre la pared, y la roca muestra sus bancos
      corrido = vec2(centroPlano.x, -centroPlano.y);
      if (capa == ${SUELOS.roca.id}.0) capa = ${PARED}.0;
    }
    vec3 piso = textureGrad(uPisos, vec3(corrido / 16.0, capa), dxz / 16.0, dyz / 16.0).rgb;
    float tono = dato.g + (dado.y - 0.5) * 0.3;
    piso *= tono > 0.62 ? 1.08 : tono < 0.38 ? 0.92 : 1.0;
    // huellas: el pixel se oscurece, mas si la rueda patino o el suelo es blando
    float marca = plano != 0 ? 0.0 : texelFetch(uHuellas, clamp(ivec2(pix) - ivec2(uCampo.xy) * 4, ivec2(0), ivec2(uCampo.zw) * 4 - 1), 0).r;
    if (marca > 0.1) piso *= marca > 0.55 ? vec3(0.62, 0.57, 0.54) : vec3(0.8, 0.77, 0.75);
    // curvas de nivel cada 2 metros (mas marcadas cada 10), de un pixel de ancho
    float hx = dFdx(vMundo.y), hy = dFdy(vMundo.y);
    float salto = abs(det) > 1e-10 ? length(vec2(dyz.y * hx - dxz.y * hy, dxz.x * hy - dyz.x * hx) / det) * 0.25 : 0.0;
    if (salto > 0.012 && plano == 0) {
      if (abs(fract(altoPix / 10.0 - 0.5) - 0.5) * 10.0 < salto * 0.75) piso *= 0.6;
      else if (abs(fract(altoPix / 2.0 - 0.5) - 0.5) * 2.0 < salto * 0.5) piso *= 0.8;
    }
    if (capa == 6.0 && azar12(pix + floor(uTiempo * 3.0) * 7.0) > 0.985) piso = mix(piso, vec3(0.85, 0.8, 0.65), 0.7);   // el pantano brilla
    diffuseColor.rgb = piso;`,
};
// El agua: se dibuja solo en los pixeles donde el piso queda por debajo, con espuma en la orilla.
const AGUA = {
  cabeza: `
    uniform sampler2D uAlturas;
    uniform vec4 uCampo;
    uniform vec3 uRio, uClara, uHonda, uEspuma;   // uRio: hacia donde corre (x, z) y a que velocidad
    float alturaDelPiso(vec2 p) {
      vec2 g = p - uCampo.xy;
      ivec2 i = clamp(ivec2(floor(g)), ivec2(0), ivec2(uCampo.zw) - 2);
      vec2 f = clamp(g - vec2(i), 0.0, 1.0);
      float a = texelFetch(uAlturas, i, 0).r, b = texelFetch(uAlturas, i + ivec2(1, 0), 0).r, c = texelFetch(uAlturas, i + ivec2(0, 1), 0).r, d = texelFetch(uAlturas, i + ivec2(1, 1), 0).r;
      return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
    }`,
  cuerpo: glslPixel(false) + `
    float altoPix = vMundo.y;
    float hondo = vMundo.y - alturaDelPiso(centro);
    if (hondo <= 0.0) discard;
    // clara y transparente en la orilla, oscura en lo hondo
    vec3 agua = mix(uClara, uHonda, smoothstep(0.05, 0.7, hondo));
    float alfa = mix(0.5, 0.86, smoothstep(0.05, 0.6, hondo));
    // brillos que bajan con la corriente, de a un pixel por vez
    vec2 q = pix - floor(uRio.xy * uRio.z * uTiempo * 4.0 + 0.5);
    q = floor(q / (abs(uRio.x) > abs(uRio.y) ? vec2(3.0, 1.0) : vec2(1.0, 3.0)));
    if (azar12(q) > 0.9) agua = mix(agua, uEspuma, 0.4);
    if (hondo < 0.05) { agua = uEspuma; alfa = 0.8; }   // espuma en la orilla
    diffuseColor = vec4(agua, alfa);`,
};

export function crearMundo(T, escena, liviano, huellas) {
  const { nx, nz, H, S, celda, x0, z0 } = T;
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), Q2 = new THREE.Quaternion(), V = new THREE.Vector3(), E = new THREE.Vector3(), ARRIBA = new THREE.Vector3(0, 1, 0);
  const campo = { value: new THREE.Vector4(x0, z0, nx, nz) };
  // inclinacion del piso en un punto: gira "arriba" hasta la normal del terreno
  const NORMAL = new THREE.Vector3();
  const acostar = (x, z, q) => {
    NORMAL.set(-(T.altura(x + 1, z) - T.altura(x - 1, z)) / 2, 1, -(T.altura(x, z + 1) - T.altura(x, z - 1)) / 2).normalize();
    return q.setFromUnitVectors(ARRIBA, NORMAL);
  };

  // --- arboles, piedras y mojones: cajas juntadas por zona, todas con el mismo atlas ---
  const esc = crearEscenografia(), zonas = new Map(), fijos = crearLote();
  const par = (v) => Math.max(2, Math.round(v / 2) * 2);            // medida par, en pixeles
  const P4 = E.clone().set(0.25, 0.25, 0.25), P8 = E.clone().set(0.125, 0.125, 0.125);
  const monte = new Uint8Array(nx * nz);                             // celdas que quedan debajo de un arbol
  for (const o of T.cosas) {
    if (o.tipo > 3) continue;   // los autos tirados se dibujan aparte
    const r = azar(Math.floor(o.x * 131 + o.z * 71) + 9);
    if (o.tipo === 3) {
      // piedra: un bloque acostado sobre la ladera y otro mas chico apoyado al lado
      const w = par(o.r * 7.6), d = par(o.r * 6.4), h = Math.max(2, Math.round(o.r * o.alto * 4.6));   // tan ancha como el circulo contra el que se choca
      M.compose(V.set(o.x, o.y, o.z), acostar(o.x, o.z, Q).multiply(Q2.setFromAxisAngle(ARRIBA, o.vuelta)), P4);
      fijos.bloque(M, [-w / 2, -2, -d / 2, w / 2, h, d / 2], { arriba: esc.piedra(w, d), lados: esc.canto(h + 2) }, r);
      const w2 = par(w * 0.55), d2 = par(d * 0.6), h2 = Math.max(2, Math.round(h * 0.55)), cx = Math.round((r() < 0.5 ? -1 : 1) * w * 0.45), cz = Math.round((r() - 0.5) * d * 0.6);
      fijos.bloque(M, [cx - w2 / 2, -2, cz - d2 / 2, cx + w2 / 2, h2, cz + d2 / 2], { arriba: esc.piedra(w2, d2), lados: esc.canto(h2 + 2) }, r);
      continue;
    }
    const k = Math.floor(o.z / 110), a = o.alto, t = o.tipo;
    if (!zonas.has(k)) zonas.set(k, { copas: crearLote(), troncos: crearLote() });
    const { copas, troncos } = zonas.get(k);
    M.compose(V.set(o.x, o.y, o.z), Q.setFromAxisAngle(ARRIBA, o.vuelta), P4);
    // pisos de la copa, de abajo hacia arriba: [lado, alto, corrimiento en x, corrimiento en z]
    const pisos = [];
    let pie;   // alto del tronco, en pixeles
    if (t === 1) {        // alto y angosto: tres pisos cada vez mas chicos
      const w = par(a * 9), h = par(a * 5);
      pie = Math.round(a * 8);
      pisos.push([w, h, 0, 0], [par(w * 0.72), h, 0, 0], [par(w * 0.45), Math.max(2, h - 2), 0, 0]);
    } else if (t === 2) { // lapacho: copa ancha y chata
      const w = par(a * 15);
      pie = Math.round(a * 11);
      pisos.push([w, par(a * 3.6), 0, 0], [par(w * 0.62), par(a * 3), Math.round((r() - 0.5) * 3), Math.round((r() - 0.5) * 3)]);
    } else {              // monte: copa ancha con un copete y a veces un brazo al costado
      const w = par(a * 13), h = par(a * 6.5);
      pie = Math.round(a * 9.6);
      pisos.push([w, h, 0, 0], [par(w * 0.6), par(h * 0.6), Math.round((r() - 0.5) * 3), Math.round((r() - 0.5) * 3)]);
      if (r() < 0.55) {
        const wb = par(w * 0.5), hb = par(h * 0.6), lado = r() < 0.5 ? -1 : 1, enX = r() < 0.5, corre = lado * (w / 2), y = pie + (r() < 0.5 ? 0 : 1);
        copas.bloque(M, [(enX ? corre : 0) - wb / 2, y, (enX ? 0 : corre) - wb / 2, (enX ? corre : 0) + wb / 2, y + hb, (enX ? 0 : corre) + wb / 2], { arriba: esc.copa(t, wb), lados: esc.follaje(t, hb), abajo: esc.debajo(t) }, r);
      }
    }
    let y = pie;
    for (const [w, h, cx, cz] of pisos) {
      copas.bloque(M, [cx - w / 2, y, cz - w / 2, cx + w / 2, y + h, cz + w / 2], { arriba: esc.copa(t, w), lados: esc.follaje(t, h), abajo: esc.debajo(t) }, r);
      y += h;
    }
    troncos.bloque(M, [-1, -2, -1, 1, pie + 1, 1], { lados: esc.corteza(t) }, r);
    // el piso de abajo queda como monte
    const radio = pisos[0][0] / 8 + 1.2, gx = Math.round(o.x - x0), gz = Math.round(o.z - z0), n = Math.ceil(radio);
    for (let j = -n; j <= n; j++) for (let i = -n; i <= n; i++) {
      if (i * i + j * j <= radio * radio && gx + i >= 0 && gx + i < nx && gz + j >= 0 && gz + j < nz) monte[(gz + j) * nx + gx + i] = 1;
    }
  }
  for (const o of T.mojones) {   // mojones blancos al borde del precipicio
    M.compose(V.set(o.x, o.y, o.z), Q.identity(), P8);
    fijos.bloque(M, [-1, -2, -1, 1, 8, 1], { lados: esc.mojon(), arriba: esc.tapaDeMojon() });
  }
  const dibujo = esc.atlas.textura();
  const mCopa = estilo(new THREE.MeshLambertMaterial({ map: dibujo }), { calada: true }), mFijo = estilo(new THREE.MeshLambertMaterial({ map: dibujo }));
  const poner = (lote, mat, recibe) => {
    if (lote.vacio()) return;
    const m = new THREE.Mesh(lote.geometria(esc.atlas), mat);
    m.castShadow = true; m.receiveShadow = !!recibe;
    escena.add(m);
  };
  for (const z of zonas.values()) { poner(z.copas, mCopa); poner(z.troncos, mFijo); }
  poner(fijos, mFijo, true);

  // --- terreno, en pedazos de 64 x 64 metros para dibujar solo lo que se ve ---
  // el mapa que lee el shader: por celda, que suelo es, un tono (para que no quede todo parejo) y si es un derrumbe
  const ruido = crearRuido(99), mapa = new Uint8Array(nx * nz * 4);
  for (let gz = 0; gz < nz; gz++) for (let gx = 0; gx < nx; gx++) {
    const k = gz * nx + gx;
    let corre = 0;
    if (S[k] === SUELOS.derrumbe.id) {   // a cual de los derrumbes pertenece (el mas cercano)
      let md = 1e9;
      T.derrumbes.forEach((d, i) => { const dd = (d.x - x0 - gx * celda) ** 2 + (d.z - z0 - gz * celda) ** 2; if (dd < md && i < 3) { md = dd; corre = i + 1; } });
    }
    mapa[k * 4] = S[k] === SUELOS.pasto.id && monte[k] ? MONTE : S[k];
    mapa[k * 4 + 1] = Math.round(ruido.n2(gx * 0.045, gz * 0.045) * 255);
    mapa[k * 4 + 2] = corre;
    mapa[k * 4 + 3] = 255;
  }
  const tMapa = new THREE.DataTexture(mapa, nx, nz, THREE.RGBAFormat, THREE.UnsignedByteType);
  tMapa.needsUpdate = true;
  const corre = [new THREE.Vector2(), new THREE.Vector2(), new THREE.Vector2(), new THREE.Vector2()];
  T.derrumbes.slice(0, 3).forEach((d, i) => corre[i + 1].set(Math.cos(d.rumbo) * d.vel, Math.sin(d.rumbo) * d.vel));
  const mPiso = estilo(new THREE.MeshLambertMaterial(), { clave: 'piso', sombras: true, cabeza: PISO.cabeza, cuerpo: PISO.cuerpo, datos: { uMapa: { value: tMapa }, uPisos: { value: texturaDePisos() }, uHuellas: { value: huellas.textura }, uCampo: campo, uCorre: { value: corre } } });
  const TAM = 64, alto = (i, j) => H[Math.min(nz - 1, Math.max(0, j)) * nx + Math.min(nx - 1, Math.max(0, i))];
  for (let cz = 0; cz < nz - 1; cz += TAM) for (let cx = 0; cx < nx - 1; cx += TAM) {
    const w = Math.min(TAM, nx - 1 - cx), h = Math.min(TAM, nz - 1 - cz);
    const pos = new Float32Array((w + 1) * (h + 1) * 3), nor = new Float32Array(pos.length), idx = [];
    for (let j = 0; j <= h; j++) for (let i = 0; i <= w; i++) {
      const gx = cx + i, gz = cz + j, o = (j * (w + 1) + i) * 3;
      pos[o] = x0 + gx * celda; pos[o + 1] = H[gz * nx + gx]; pos[o + 2] = z0 + gz * celda;
      // la normal sale de las alturas vecinas, asi no se notan las uniones entre pedazos
      V.set(alto(gx - 1, gz) - alto(gx + 1, gz), 2 * celda, alto(gx, gz - 1) - alto(gx, gz + 1)).normalize();
      nor[o] = V.x; nor[o + 1] = V.y; nor[o + 2] = V.z;
      if (i < w && j < h) { const a = j * (w + 1) + i, b = a + 1, c = a + w + 1; idx.push(a, c, b, b, c, c + 1); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setIndex(idx);
    const m = new THREE.Mesh(g, mPiso);
    m.receiveShadow = true; m.castShadow = true;
    escena.add(m);
  }

  // --- agua: un plano al nivel del rio; el shader lo recorta contra el piso, pixel por pixel ---
  const tAlturas = new THREE.DataTexture(H, nx, nz, THREE.RedFormat, THREE.FloatType);
  tAlturas.needsUpdate = true;
  for (const a of T.aguas) {
    const p = [];
    for (const [u, v] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) p.push(a.x + a.hx * a.cruce * u - a.hz * a.largo * v, a.nivel, a.z + a.hz * a.cruce * u + a.hx * a.largo * v);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(p), 3));
    g.setIndex([0, 2, 1, 1, 2, 3]);
    g.computeVertexNormals();
    const mat = estilo(new THREE.MeshLambertMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide }), {
      clave: 'agua', sombras: true, cabeza: AGUA.cabeza, cuerpo: AGUA.cuerpo,
      datos: { uAlturas: { value: tAlturas }, uCampo: campo, uRio: { value: new THREE.Vector3(-a.hz, a.hx, 1.6) }, uClara: { value: new THREE.Color(0x7fc4c2) }, uHonda: { value: new THREE.Color(0x2f6f7c) }, uEspuma: { value: new THREE.Color(0xe6f3ee) } },
    });
    const m = new THREE.Mesh(g, mat);
    m.receiveShadow = true;
    escena.add(m);
  }

  // --- autos tirados: abandonados, volcados o hundidos en el barro ---
  for (const a of T.autos) {
    const g = armarCamioneta(chatarra(a.n)).grupo;
    g.traverse((o) => { for (const m of o.isMesh ? [].concat(o.material) : []) if (!m.userData.conEstilo) { estilo(m); m.userData.conEstilo = true; } });
    // se acuesta sobre la pendiente del lugar y despues se lo gira segun como quedo
    g.quaternion.copy(acostar(a.x, a.z, Q)).multiply(Q2.setFromAxisAngle(ARRIBA, -a.rumbo));
    if (a.estado === 1) g.quaternion.multiply(Q2.setFromAxisAngle(E.set(0, 0, 1), 1.45));
    if (a.estado === 2) g.quaternion.multiply(Q2.setFromAxisAngle(E.set(1, 0, 0.5).normalize(), 0.22));
    g.position.set(a.x, a.y + [0.8, 0.95, 0.3][a.estado], a.z);
    escena.add(g);
  }

  // --- bidones de nafta: giran despacio sobre una marca amarilla ---
  const chico = crearAtlas(16, 16), dBidon = dibujosDeBidon(chico), lBidon = crearLote();
  lBidon.bloque(M.makeScale(0.2, 0.2, 0.2), [-2, -3, -1, 2, 3, 1], dBidon);   // mas grande que uno de verdad, para que se vea desde arriba
  const gBidon = lBidon.geometria(chico), mBidon = new THREE.MeshLambertMaterial({ map: chico.textura() });
  const gMarca = new THREE.PlaneGeometry(2.5, 2.5).rotateX(-Math.PI / 2), mMarca = new THREE.MeshBasicMaterial({ map: marcaDeBidon(), alphaTest: 0.5 });
  const bidones = T.bidones.map((b) => {
    const g = new THREE.Group(), lata = new THREE.Mesh(gBidon, mBidon);
    lata.position.y = 1.3;
    lata.castShadow = true;
    const marca = new THREE.Mesh(gMarca, mMarca);
    marca.position.y = 0.12;
    g.add(lata, marca);
    g.position.set(b.x, b.y, b.z);
    escena.add(g);
    return { g, lata };
  });

  // --- derrumbes: cascotes que cruzan el camino con la tierra que se corre ---
  const NC = 46, cascotes = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ map: granito(), color: 0xa8927a }), NC * Math.max(1, T.derrumbes.length));
  const donde = [];   // por cascote: a lo largo, a lo ancho, tamano
  T.derrumbes.forEach(() => { for (let i = 0; i < NC; i++) donde.push(Math.random(), Math.random(), 0.25 + Math.floor(Math.random() * 3) * 0.125); });
  cascotes.count = donde.length / 3;
  cascotes.castShadow = true;
  escena.add(cascotes);
  function animar(dt, t) {
    tiempo.value = t;
    for (const b of bidones) { b.lata.rotation.y = t * 1.6; b.lata.position.y = 1.3 + Math.sin(t * 2.4) * 0.12; }
    T.derrumbes.forEach((d, k) => {
      const hx = Math.sin(d.rumbo), hz = -Math.cos(d.rumbo), ancho = d.ancho + 5;
      for (let i = 0; i < NC; i++) {
        const o = (k * NC + i) * 3;
        donde[o + 1] = (donde[o + 1] + d.vel * dt / ancho) % 1;
        const u = (donde[o] - 0.5) * (d.largo - 4), v = (donde[o + 1] - 0.5) * ancho;
        const x = d.x + hx * u - hz * v, z = d.z + hz * u + hx * v, s = donde[o + 2] * Math.min(1, donde[o + 1] * 8, (1 - donde[o + 1]) * 8);
        Q.setFromAxisAngle(ARRIBA, donde[o] * 40 + donde[o + 1] * 6);
        cascotes.setMatrixAt(k * NC + i, M.compose(V.set(x, T.altura(x, z) + s * 0.35, z), Q, E.set(s, s, s)));
      }
    });
    cascotes.instanceMatrix.needsUpdate = true;
  }

  // --- arcos: uno por control y uno mas grande en la meta. Devuelve el material de la viga, para cambiarle el color ---
  function arco(p, color, altura, dibujar) {
    const g = new THREE.Group(), a = p.ancho / 2 + 0.9, px = Math.round((a * 2 + 0.5) * 8);
    const mPalo = new THREE.MeshLambertMaterial({ color: 0x26262a }), mViga = new THREE.MeshLambertMaterial({ map: dibujar(px), color });
    for (const s of [-1, 1]) {
      const palo = new THREE.Mesh(new THREE.BoxGeometry(0.25, altura + 3, 0.25), mPalo);
      palo.position.set(s * a, (altura + 3) / 2 - 3, 0);
      palo.castShadow = true;
      g.add(palo);
    }
    const viga = new THREE.Mesh(new THREE.BoxGeometry(px / 8, 0.5, 0.75), [mPalo, mPalo, mViga, mViga, mViga, mViga]);
    viga.position.y = altura;
    viga.castShadow = true;
    g.add(viga);
    g.position.set(p.x, T.altura(p.x, p.z), p.z);
    g.rotation.y = -p.rumbo;
    escena.add(g);
    return mViga;
  }
  const arcos = T.controles.map((p) => arco(p, AMARILLO, 4.6, rayasDeArco));
  arco(T.meta, 0xffffff, 5.4, cuadrosDeMeta);

  // --- luces: cielo + sol con sombras que siguen a la camara ---
  escena.background = new THREE.Color(0xcfe2e8);
  escena.fog = new THREE.Fog(0xcfe2e8, 150, 560);
  escena.add(new THREE.HemisphereLight(0xe2eef7, 0x6e5a45, 1.15));
  const sol = new THREE.DirectionalLight(0xfff1d8, 2.5), haciaElSol = new THREE.Vector3(-0.5, 0.8, -0.2).normalize();
  sol.castShadow = true;
  const lado = liviano ? 1024 : 2048;   // tamano del mapa de sombras
  sol.shadow.mapSize.set(lado, lado);
  const sc = sol.shadow.camera, R = 90;
  sc.left = sc.bottom = -R; sc.right = sc.top = R; sc.near = 10; sc.far = 480;
  sol.shadow.bias = -0.0005; sol.shadow.normalBias = 0.5;
  escena.add(sol, sol.target);
  const ejeX = new THREE.Vector3().crossVectors(ARRIBA, haciaElSol).normalize(), ejeY = new THREE.Vector3().crossVectors(haciaElSol, ejeX);
  const paso = 2 * R / lado;
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
    // donde esta la camioneta en la pantalla (en pixeles) y que radio ocupa: ahi se calan las copas
    hueco: (cam, p, ancho, alto2) => {
      const lejos = Math.hypot(cam.position.x - p[0], cam.position.y - p[1], cam.position.z - p[2]);
      V.set(p[0], p[1] + 0.6, p[2]).project(cam);
      hueco.value.set((V.x * 0.5 + 0.5) * ancho, (V.y * 0.5 + 0.5) * alto2, 3.8 * alto2 / (2 * Math.tan(cam.fov * Math.PI / 360)) / lejos);
    },
    animar,
    pasar: (i) => arcos[i].color.setHex(VERDE),
    juntar: (i) => { bidones[i].g.visible = false; },
    reiniciar: () => { arcos.forEach((a) => a.color.setHex(AMARILLO)); bidones.forEach((b) => { b.g.visible = true; }); },
  };
}

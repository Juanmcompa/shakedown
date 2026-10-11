// Dibuja el mundo: el terreno, el agua, la luz de cada clima, y llama a los que ponen
// la vegetacion (flora.js), la utileria del rally (utileria.js) y el publico (publico.js).
// Todo esta hecho de bloques y de dibujos de pocos pixeles (las herramientas estan en pixel.js y los dibujos en arte.js).
import * as THREE from 'three';
import { SUELOS } from './config.js';
import { crearRuido } from './noise.js';
import { glslPixel } from './pixel.js';
import { texturaDePisos, capasNaturales, crearEscenografia, PARED, SEMBRADO } from './arte.js';
import { BIOMAS } from './generador.js';
import { ambiente, estilo } from './material.js';
import { crearFlora } from './flora.js';
import { crearUtileria } from './utileria.js';
import { crearPublico } from './publico.js';
import { crearPueblo } from './pueblo.js';
import { crearClima } from './clima.js';

// --- la luz de cada clima ---
// sol: color, fuerza y desde donde viene.  cielo / piso: la luz pareja que llega de arriba y la que rebota de abajo.
// bruma: color del fondo y a que distancia empieza y termina.  sombra: que tan oscuras son las sombras (0 a 1).
// mojado: cuanto se oscurece el piso.  tinte: color que toma lo que queda muy abajo (los precipicios).
// faros: fuerza de los faros del auto (0 = apagados).  lluvia: cuanto llueve (0 a 1).  fuego: el publico prende fogones y bengalas.
export const LUCES = {
  sol:    { sol: [0xffecc8, 2.5, [-0.5, 0.8, -0.2]],   cielo: [0xd6dcf4, 0x8c7a88, 1.3],  bruma: [0xead9c6, 62, 330],  sombra: 0.8,  mojado: 0 },
  tarde:  { sol: [0xffb47a, 2.4, [-0.8, 0.42, -0.28]], cielo: [0xbcb2e2, 0x80606a, 1.55], bruma: [0xecc4a8, 58, 300],  sombra: 0.74, mojado: 0, faros: 55, fuego: true },
  lluvia: { sol: [0xd4dde6, 1.1, [-0.4, 0.85, -0.2]],  cielo: [0xbcc7d2, 0x5f5c55, 1.45], bruma: [0xb1bcc2, 48, 230],  sombra: 0.45, mojado: 1, faros: 26, lluvia: 1 },
  niebla: { sol: [0xf2ead8, 1.3, [-0.5, 0.8, -0.2]],   cielo: [0xdfe3e2, 0x6e6a5c, 1.4],  bruma: [0xd9dcd6, 44, 210],  sombra: 0.4,  mojado: 0.35, faros: 30 },
};

// El piso: cada pixel mide 25 cm y esta alineado con el mundo. El suelo de cada pixel sale de un mapa (una celda por metro).
const PISO = {
  cabeza: `
    uniform sampler2D uMapa;
    uniform sampler2DArray uPisos;
    uniform sampler2D uHuellas;   // por donde pasaron las ruedas (un dato por pixel del mundo)
    uniform vec4 uCampo;          // origen del mapa (x, z) y cantidad de celdas
    uniform float uMojado;`,
  cuerpo: glslPixel(true) + `
    float altoPix = EN_PIXEL(vMundo.y);
    // la celda se sortea entre las vecinas, asi el borde entre dos suelos queda salpicado y no en escalera
    vec2 dado = vec2(azar12(pix), azar12(pix + 71.7));
    ivec2 celda = clamp(ivec2(floor(centro + (dado - 0.5) * 0.9 - uCampo.xy + 0.5)), ivec2(0), ivec2(uCampo.zw) - 1);
    vec4 dato = texelFetch(uMapa, celda, 0);
    float capa = floor(dato.r * 255.0 + 0.5);
    float tono = dato.g + (dado.y - 0.5) * 0.3;
    // el pasto se corta con manchones de otra cosa (flores, hojas secas, pedregullo, segun el lugar):
    // donde hay pasto, el mapa trae ademas en que capa esta el manchon de ese ambiente
    float otra = floor(dato.a * 255.0 + 0.5);
    if (otra > 0.5 && dato.b + (dado.x - 0.5) * 0.16 > 0.63) capa = otra;
    vec2 corrido = centro;
    if (plano != 0) {   // en un paredon el dibujo se pega sobre la pared, y la roca muestra sus bancos
      corrido = vec2(centroPlano.x, -centroPlano.y);
      if (capa == ${SUELOS.roca.id}.0) capa = ${PARED}.0;
    }
    vec3 piso = textureGrad(uPisos, vec3(corrido / 16.0, capa), dxz / 16.0, dyz / 16.0).rgb;
    piso *= tono > 0.62 ? 1.08 : tono < 0.38 ? 0.92 : 1.0;
    // mojado: todo mas oscuro, y los charcos y el pantano brillan
    piso *= 1.0 - 0.2 * uMojado;
    bool espejo = capa == ${SUELOS.charco.id}.0 || capa == ${SUELOS.pantano.id}.0;
    if (espejo && azar12(pix + floor(uTiempo * 3.0) * 7.0) > 0.975) piso = mix(piso, vec3(0.92, 0.94, 0.9), 0.75);
    // huellas: el pixel se oscurece, mas si la rueda patino o el suelo es blando
    float marca = plano != 0 ? 0.0 : texelFetch(uHuellas, clamp(ivec2(pix) - ivec2(uCampo.xy) * 4, ivec2(0), ivec2(uCampo.zw) * 4 - 1), 0).r;
    // (los dos valores mas altos no son huellas sino pintura: blanca o amarilla, un poco gastada)
    if (marca > 0.994) { if (dado.x > 0.1) piso = mix(piso, marca > 0.998 ? vec3(0.66, 0.65, 0.6) : vec3(0.64, 0.42, 0.06), 0.85); }
    else if (marca > 0.1) piso *= marca > 0.55 ? vec3(0.48, 0.43, 0.41) : marca > 0.3 ? vec3(0.6, 0.56, 0.54) : vec3(0.72, 0.69, 0.67);
    // curvas de nivel cada 2 metros (mas marcadas cada 10), de un pixel de ancho, solo donde el terreno es empinado
    float hx = dFdx(vMundo.y), hy = dFdy(vMundo.y);
    float salto = abs(det) > 1e-10 ? length(vec2(dyz.y * hx - dxz.y * hy, dxz.x * hy - dyz.x * hx) / det) * 0.25 : 0.0;
    if (salto > 0.05 && plano == 0) {
      if (abs(fract(altoPix / 10.0 - 0.5) - 0.5) * 10.0 < salto * 0.75) piso *= 0.66;
      else if (abs(fract(altoPix / 2.0 - 0.5) - 0.5) * 2.0 < salto * 0.5) piso *= 0.84;
    }
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
  const { nx, nz, H, S, celda, x0, z0 } = T, luz = LUCES[T.etapa.clima] || LUCES.sol;
  const V = new THREE.Vector3(), ARRIBA = new THREE.Vector3(0, 1, 0);
  const campo = { value: new THREE.Vector4(x0, z0, nx, nz) };

  // --- lo que hay sobre el terreno ---
  const esc = crearEscenografia();
  const clima = crearClima(T, escena, luz);
  const flora = crearFlora(T, escena, esc, liviano), utileria = crearUtileria(T, escena, esc), publico = crearPublico(T, escena, clima, luz), pueblo = crearPueblo(T, escena, clima, luz);

  // --- terreno, en pedazos de 64 x 64 metros para dibujar solo lo que se ve ---
  // el mapa que lee el shader: por celda, que suelo es, un tono (para que no quede todo parejo) y donde van los manchones
  const ruido = crearRuido(99), mapa = new Uint8Array(nx * nz * 4), naturales = T.biomas.map((id, k) => capasNaturales(k));
  for (let gz = 0; gz < nz; gz++) for (let gx = 0; gx < nx; gx++) {
    const k = gz * nx + gx, N = naturales[T.zona ? T.zona[k] : 0];
    // el pasto puede ser: lo de abajo de un arbol, la banquina, un sembrado o pasto nomas (cada cosa, la del ambiente de ese lugar)
    const pastoNomas = S[k] === SUELOS.pasto.id && !T.orilla[k] && !flora.monte[k] && !T.cultivo[k];
    mapa[k * 4] = S[k] !== SUELOS.pasto.id ? S[k] : T.orilla[k] ? N.banquina : flora.monte[k] ? N.monte : T.cultivo[k] ? SEMBRADO + T.cultivo[k] : N.pasto;
    mapa[k * 4 + 1] = Math.round(ruido.n2(gx * 0.045, gz * 0.045) * 255);
    mapa[k * 4 + 2] = Math.round(ruido.capas(gx * 0.021 + 40, gz * 0.021 - 17, 3) * 127 + 128);
    mapa[k * 4 + 3] = pastoNomas ? N.manchon : 0;   // (en que capa esta el manchon que corta ese pasto; 0 = no lleva)
  }
  const tMapa = new THREE.DataTexture(mapa, nx, nz, THREE.RGBAFormat, THREE.UnsignedByteType);
  tMapa.needsUpdate = true;
  const mPiso = estilo(new THREE.MeshLambertMaterial(), { clave: 'piso', sombras: true, cabeza: PISO.cabeza, cuerpo: PISO.cuerpo,
    datos: { uMapa: { value: tMapa }, uPisos: { value: texturaDePisos(T.biomas.map((id) => (BIOMAS[id] || BIOMAS.bosque).piso)) }, uHuellas: { value: huellas.textura }, uCampo: campo, uMojado: { value: luz.mojado } } });
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

  // --- agua: un plano al nivel del arroyo; el shader lo recorta contra el piso, pixel por pixel ---
  const tAlturas = new THREE.DataTexture(H, nx, nz, THREE.RedFormat, THREE.FloatType);
  tAlturas.needsUpdate = true;
  const gris = luz.mojado > 0.5;
  for (const a of T.aguas) {
    const p = [];
    for (const [u, v] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) p.push(a.x + a.hx * a.cruce * u - a.hz * a.largo * v, a.nivel, a.z + a.hz * a.cruce * u + a.hx * a.largo * v);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(p), 3));
    g.setIndex([0, 2, 1, 1, 2, 3]);
    g.computeVertexNormals();
    const mat = estilo(new THREE.MeshLambertMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide }), {
      clave: 'agua', sombras: true, cabeza: AGUA.cabeza, cuerpo: AGUA.cuerpo,
      datos: { uAlturas: { value: tAlturas }, uCampo: campo, uRio: { value: new THREE.Vector3(-a.hz, a.hx, 1.6) }, uClara: { value: new THREE.Color(gris ? 0x8fb0b4 : 0x7fc4c2) }, uHonda: { value: new THREE.Color(gris ? 0x44626c : 0x2f6f7c) }, uEspuma: { value: new THREE.Color(0xe6f3ee) } },
    });
    const m = new THREE.Mesh(g, mat);
    m.receiveShadow = true;
    escena.add(m);
  }

  // --- la luz del clima: cielo + sol con sombras que siguen a la camara ---
  const fondo = new THREE.Color(luz.bruma[0]);
  escena.background = fondo;
  escena.fog = new THREE.Fog(luz.bruma[0], luz.bruma[1], luz.bruma[2]);
  ambiente.niebla.value.set(fondo.r, fondo.g, fondo.b, T.clima.niebla || 0);
  escena.add(new THREE.HemisphereLight(luz.cielo[0], luz.cielo[1], luz.cielo[2]));
  const sol = new THREE.DirectionalLight(luz.sol[0], luz.sol[1]), haciaElSol = new THREE.Vector3(...luz.sol[2]).normalize();
  sol.castShadow = true;
  const lado = liviano ? 1024 : 2048;   // tamano del mapa de sombras
  sol.shadow.mapSize.set(lado, lado);
  const sc = sol.shadow.camera, R = 90;
  sc.left = sc.bottom = -R; sc.right = sc.top = R; sc.near = 10; sc.far = 520;
  sol.shadow.bias = -0.0005; sol.shadow.normalBias = 0.5; sol.shadow.intensity = luz.sombra;
  escena.add(sol, sol.target);
  const ejeX = new THREE.Vector3().crossVectors(ARRIBA, haciaElSol).normalize(), ejeY = new THREE.Vector3().crossVectors(haciaElSol, ejeX);
  const paso = 2 * R / lado, D = new THREE.Vector3();

  return {
    luz, flora, publico,
    // Una vez por cuadro: acomoda lo que depende de donde esta la camara y de donde esta el auto.
    //   las sombras siguen a la camara; lo que queda abajo del auto se oscurece; las copas se calan sobre el auto;
    //   y los sprites se dan vuelta para mirar a la camara.
    mirar: (camara, c, ancho, alto2) => {
      const cam = camara.cam, e = camara.estado;
      // la sombra se mueve de a un pixel de sombra para que los bordes no tiemblen
      V.set(e.x, e.y, e.z);
      const a = V.dot(ejeX), b = V.dot(ejeY);
      V.addScaledVector(ejeX, Math.round(a / paso) * paso - a).addScaledVector(ejeY, Math.round(b / paso) * paso - b);
      sol.target.position.copy(V);
      sol.position.copy(V).addScaledVector(haciaElSol, 250);
      ambiente.bajo.value = e.y;
      ambiente.centro.value.set(c.pos[0], c.pos[1], c.pos[2]);
      // donde esta el auto en la pantalla (en pixeles) y que radio ocupa: ahi se calan las copas
      const lejos = Math.hypot(cam.position.x - c.pos[0], cam.position.y - c.pos[1], cam.position.z - c.pos[2]);
      V.set(c.pos[0], c.pos[1] + 0.6, c.pos[2]).project(cam);
      ambiente.hueco.value.set((V.x * 0.5 + 0.5) * ancho, (V.y * 0.5 + 0.5) * alto2, 3.8 * alto2 / (2 * Math.tan(cam.fov * Math.PI / 360)) / lejos);
      // los sprites: su ancho va hacia la derecha de la camara, y se echan un poco hacia atras (la punta mas lejos
      // de la camara que el pie): asi, mirados desde arriba, se ven casi enteros y no de canto
      // (cuanto mas de arriba mira la camara, mas se acuestan: con la camara casi vertical quedan casi apoyados en el piso)
      cam.getWorldDirection(D);
      const h = Math.hypot(D.x, D.z) || 1, baja = Math.min(1, Math.max(0, -D.y)), inclina = Math.max(baja * 0.62, Math.asin(baja) - 0.51);
      ambiente.camDer.value.set(-D.z / h, 0, D.x / h);
      ambiente.camMira.value.set(D.x / h, 0, D.z / h);
      ambiente.camAlto.value.set(D.x / h * Math.sin(inclina), Math.cos(inclina), D.z / h * Math.sin(inclina));
    },
    animar: (dt, t, c, indice) => {
      ambiente.tiempo.value = t;
      publico.animar(c, indice, dt, t);
      clima.animar(dt, t, c);
      if (c.rompio.length) { c.rompio.length = 0; utileria.tirar(); pueblo.tirar(); }
      utileria.animar(t);
    },
    reiniciar: () => { utileria.reiniciar(); pueblo.reiniciar(); },
  };
}

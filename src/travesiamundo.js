// Dibuja el mundo de la Travesia: el terreno en pedazos de a 64 m que se arman delante del auto y se tiran detras (la cuenta
// la lleva travesiaterreno.js), las piedras, las matas secas, el agua de los arroyos y la luz del desierto.
// Usa las mismas herramientas que world.js (el piso de pixeles, el agua, los dibujos de piedras y de plantas).
import * as THREE from '../vendor/three.module.js';
import { TRAVESIA, SUELOS } from './config.js';
import { glslPixel } from './pixel.js';
import { crearRuido } from './noise.js';
import { texturaDePisos, crearEscenografia } from './arte.js';
import { ambiente, estilo } from './material.js';
import { crearLote } from './pixel.js';
import { crearLoteDeSprites } from './sprites.js';
import { crearLoteDeArboles } from './arboles.js';
import { LUCES, PISO, AGUA } from './world.js';
import { RADIOS_DE_PIEDRA, altoDePiedra } from './travesiaterreno.js';
import { crearDibujosDeTravesia, FORMACIONES, PIXEL_FORMACION } from './travesiaflora.js';
import { crearHuellasDeTravesia } from './travesiahuellas.js';
import { crearFiestaDeTravesia } from './travesiafiesta.js';
import { armarRoto } from './autos.js';

// la rueda y la caja de herramientas que quedan tiradas junto a un auto roto: dos formas sueltas que comparten todos
let tiradas = null;
const cosasTiradas = () => tiradas || (tiradas = (() => {
  const mat = (color) => estilo(new THREE.MeshLambertMaterial({ color }));
  const goma = mat(0x1d1d20), llanta = mat(0x8d9096), chapa = mat(0xb9442e), asa = mat(0x26262a);
  return {
    cuerpoRueda: new THREE.CylinderGeometry(0.38, 0.38, 0.26, 10), llantaRueda: new THREE.CylinderGeometry(0.2, 0.2, 0.28, 8),
    cuerpoCaja: new THREE.BoxGeometry(0.76, 0.3, 0.44), asaCaja: new THREE.BoxGeometry(0.34, 0.07, 0.07), goma, llanta, chapa, asa,
  };
})());

const lim01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const par = (v) => Math.max(2, Math.round(v / 2) * 2);   // medida par, en pixeles
// la luz del desierto: un sol bajo de atardecer (las sombras salen largas y los medanos quedan con un lado al sol y otro a oscuras),
// con una bruma calida que se va comiendo todo lo lejano
const LUZ = { ...LUCES.sol, sol: [0xffc994, 2.75, [-0.82, 0.34, -0.3]], bruma: [0xe6bb8f, 58, 250], cielo: [0xdccbc4, 0x9a7656, 1.0], sombra: 0.82 };
// el piso, igual que el de las pistas pero con un tinte mas: en la capa azul del mapa viene cuanto mira cada lugar al sol, y el piso se ve
// calido y claro de ese lado y frio y oscuro del otro (en las pistas esa capa no se usa si no hay manchones, y aca nunca los hay)
const SIN_TIPOS = new THREE.DataTexture(new Uint8Array(1), 1, 1, THREE.RedFormat, THREE.UnsignedByteType);
SIN_TIPOS.needsUpdate = true;
const PISO_T = { cabeza: PISO.cabeza, cuerpo: PISO.cuerpo.replace('diffuseColor.rgb = piso;', `
    // el ripio del camino, mas calido (con la luz baja se le va el color)
    if (capa == ${SUELOS.ripio.id}.0) piso *= vec3(1.1, 0.99, 0.82);
    else if (capa == ${SUELOS.barro.id}.0 || capa == ${SUELOS.pantano.id}.0) piso *= vec3(1.4, 1.12, 0.92);   // el barro, mas claro y rojizo (si no se confunde con el pedregal)
    float luzMed = dato.b;
    piso *= luzMed < 0.5 ? mix(vec3(0.6, 0.5, 0.52), vec3(1.0), luzMed * 2.0) : mix(vec3(1.0), vec3(1.2, 1.07, 0.86), (luzMed - 0.5) * 2.0);
    diffuseColor.rgb = piso;`) };
// las medidas (en pixeles) de los dos bloques de cada piedra, como en utileria.js
const medidas = (r) => {
  const w = par(r * 7.6), d = par(r * 6.4), h = Math.max(2, Math.round(r * altoDePiedra(r) * 4.6));
  return { w, d, h, w2: par(w * 0.55), d2: par(d * 0.6), h2: Math.max(2, Math.round(h * 0.55)) };
};
// el agua es la de world.js, pero recortada a cada pedazo de terreno (cada pedazo tiene su propio mapa de alturas)
const AGUA_T = { cabeza: AGUA.cabeza + '\nuniform vec4 uCaja;', cuerpo: 'if (vMundo.x < uCaja.x || vMundo.x > uCaja.z || vMundo.z < uCaja.y || vMundo.z > uCaja.w) discard;\n' + AGUA.cuerpo };

export function crearMundoTravesia(escena, liviano) {
  let T = null;   // el terreno de la corrida de turno (usar(T) lo cambia: el mundo se arma una sola vez)
  const L = TRAVESIA.lado, NV = L + 1, RADIO = liviano ? TRAVESIA.radio * 0.8 : TRAVESIA.radio;
  const luz = LUZ;
  const esc = crearEscenografia();
  // se preparan todos los dibujos de piedra antes de armar la textura: despues ya no se pueden sumar
  for (const r of RADIOS_DE_PIEDRA) { const m = medidas(r); esc.piedra(m.w, m.d); esc.canto(m.h + 2); esc.piedra(m.w2, m.d2); esc.canto(m.h2 + 2); }
  // las formaciones de roca grandes: se preparan igual sus dibujos (de cada parte, el techo y el costado)
  for (const parte of FORMACIONES.flat(1).filter((q) => Array.isArray(q))) esc.piedra(parte[0], parte[1]), esc.canto(parte[2] + 2);
  const pisos = texturaDePisos(['pastoSeco']);
  const dibujo = esc.atlas.textura();
  const mPiedra = estilo(new THREE.MeshLambertMaterial({ map: dibujo }));
  const mPiedraNegra = estilo(new THREE.MeshLambertMaterial({ map: dibujo, color: 0x6a5c52 }));      // la misma piedra, pero negra
  const mFormacion = estilo(new THREE.MeshLambertMaterial({ map: dibujo, color: 0xe6aa78 }));       // y la de las formaciones, ocre rojiza
  const dibujosFlora = crearDibujosDeTravesia();
  const huellas = crearHuellasDeTravesia();
  const V = new THREE.Vector3(), ARRIBA = new THREE.Vector3(0, 1, 0), M2 = new THREE.Matrix4(), Q = new THREE.Quaternion(), Q2 = new THREE.Quaternion(), NORMAL = new THREE.Vector3(), P4 = new THREE.Vector3(0.25, 0.25, 0.25), PF = new THREE.Vector3();
  const ruidoDeTono = crearRuido(99);

  // --- la luz: cielo + sol con sombras que siguen a la camara (igual que en world.js) ---
  const fondo = new THREE.Color(luz.bruma[0]);
  escena.background = fondo;
  escena.fog = new THREE.Fog(luz.bruma[0], luz.bruma[1], luz.bruma[2]);
  escena.add(new THREE.HemisphereLight(luz.cielo[0], luz.cielo[1], luz.cielo[2]));
  const sol = new THREE.DirectionalLight(luz.sol[0], luz.sol[1]), haciaElSol = new THREE.Vector3(...luz.sol[2]).normalize();
  sol.castShadow = true;
  const lado = liviano ? 1024 : 2048;
  sol.shadow.mapSize.set(lado, lado);
  const sc = sol.shadow.camera, R = 90;
  sc.left = sc.bottom = -R; sc.right = sc.top = R; sc.near = 10; sc.far = 520;
  sol.shadow.bias = -0.0005; sol.shadow.normalBias = 0.5; sol.shadow.intensity = luz.sombra;
  escena.add(sol, sol.target);
  const ejeX = new THREE.Vector3().crossVectors(ARRIBA, haciaElSol).normalize(), ejeY = new THREE.Vector3().crossVectors(haciaElSol, ejeX);
  const paso = 2 * R / lado, D = new THREE.Vector3();
  const sunN = haciaElSol.clone();   // (ya normalizado) para saber cuanto mira al sol cada lugar del piso

  // --- los pedazos ---
  const vivos = new Map(), pendientes = [];   // vivos: clave -> { t, grupo, cosas: lo que hay que liberar }; pendientes: con datos, sin dibujar
  const indice = new THREE.BufferAttribute((() => {
    const idx = new Uint16Array(L * L * 6);
    let o = 0;
    for (let j = 0; j < L; j++) for (let i = 0; i < L; i++) { const a = j * NV + i, b = a + 1, c = a + NV; idx[o++] = a; idx[o++] = c; idx[o++] = b; idx[o++] = b; idx[o++] = c; idx[o++] = c + 1; }
    return idx;
  })(), 1);
  const claveDe = (t) => t.tx + ',' + t.tz;

  function dibujar(t) {
    const grupo = new THREE.Group(), liberar = [];
    // el terreno: sus alturas y el mapa de suelos que lee el shader
    const pos = new Float32Array(NV * NV * 3), nor = new Float32Array(NV * NV * 3), mapa = new Uint8Array(NV * NV * 4), alturas = new Float32Array(NV * NV);
    for (let j = 0; j < NV; j++) for (let i = 0; i < NV; i++) {
      const k = j * NV + i, o = k * 3, h = t.alto(i, j);
      pos[o] = t.x0 + i; pos[o + 1] = h; pos[o + 2] = t.z0 + j; alturas[k] = h;
      V.set(t.alto(i - 1, j) - t.alto(i + 1, j), 2, t.alto(i, j - 1) - t.alto(i, j + 1)).normalize();
      nor[o] = V.x; nor[o + 1] = V.y; nor[o + 2] = V.z;
      mapa[k * 4] = t.S[k];
      mapa[k * 4 + 1] = Math.round(ruidoDeTono.n2((t.x0 + i) * 0.045, (t.z0 + j) * 0.045) * 255);
      // cuanto mira al sol: 0,5 = como el piso plano; mas = de frente al sol (lado claro del medano); menos = de espaldas (la sombra)
      mapa[k * 4 + 2] = Math.round(lim01(0.5 + (V.dot(sunN) - sunN.y) * 2.5) * 255);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setIndex(indice);
    g.computeBoundingSphere();
    const tMapa = new THREE.DataTexture(mapa, NV, NV, THREE.RGBAFormat, THREE.UnsignedByteType);
    tMapa.needsUpdate = true;
    const campo = { value: new THREE.Vector4(t.x0, t.z0, NV, NV) };
    const mPiso = estilo(new THREE.MeshLambertMaterial(), { clave: 'pisoT', sombras: true, cabeza: PISO_T.cabeza, cuerpo: PISO_T.cuerpo,
      datos: { uMapa: { value: tMapa }, uPisos: { value: pisos }, uHuellas: { value: huellas.registrar(t) }, uTipos: { value: SIN_TIPOS }, uRelieve: { value: 0 }, uCampo: campo, uMojado: { value: 0 } } });   // (los tipos de huella y el relieve falso son del piso de la pista del dia: aca, apagados)
    const piso = new THREE.Mesh(g, mPiso);
    piso.receiveShadow = true; piso.castShadow = true;
    grupo.add(piso);
    liberar.push(g, mPiso, tMapa);

    // las piedras: un bloque acostado sobre la ladera y otro mas chico apoyado al lado (como en utileria.js)
    if (t.rocas.length) {
      const fijos = crearLote(), negras = crearLote();
      for (const o of t.rocas) {
        const rnd = (() => { let a = Math.floor(o.x * 131 + o.z * 71) + 9; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; })();
        const m = medidas(o.r);
        NORMAL.set(-(T.altura(o.x + 1, o.z) - T.altura(o.x - 1, o.z)) / 2, 1, -(T.altura(o.x, o.z + 1) - T.altura(o.x, o.z - 1)) / 2).normalize();
        Q.setFromUnitVectors(ARRIBA, NORMAL);
        M2.compose(V.set(o.x, o.y, o.z), Q.multiply(Q2.setFromAxisAngle(ARRIBA, o.vuelta || 0)), P4);
        const lote = o.negra ? negras : fijos;
        lote.bloque(M2, [-m.w / 2, -2, -m.d / 2, m.w / 2, m.h, m.d / 2], { arriba: esc.piedra(m.w, m.d), lados: esc.canto(m.h + 2), abajo: null }, rnd);
        const cx = Math.round((rnd() < 0.5 ? -1 : 1) * m.w * 0.45), cz = Math.round((rnd() - 0.5) * m.d * 0.6);
        lote.bloque(M2, [cx - m.w2 / 2, -2, cz - m.d2 / 2, cx + m.w2 / 2, m.h2, cz + m.d2 / 2], { arriba: esc.piedra(m.w2, m.d2), lados: esc.canto(m.h2 + 2), abajo: null }, rnd);
      }
      for (const [lote, material] of [[fijos, mPiedra], [negras, mPiedraNegra]]) {
        if (lote.vacio()) continue;
        const gp = lote.geometria(esc.atlas), mesh = new THREE.Mesh(gp, material);
        mesh.castShadow = true; mesh.receiveShadow = true;
        grupo.add(mesh);
        liberar.push(gp);
      }
    }

    // los autos rotos del camino (y la rueda o la caja de herramientas que tienen tirada al lado)
    for (const o of t.restos) {
      if (o.resto === 'auto') {
        const { grupo: g, alto: sube } = armarRoto(o.n);
        NORMAL.set(-(T.altura(o.x + 1, o.z) - T.altura(o.x - 1, o.z)) / 2, 1, -(T.altura(o.x, o.z + 1) - T.altura(o.x, o.z - 1)) / 2).normalize();
        // apoyado en la ladera, mirando hacia donde quedo, y caido de un costado (una rueda hundida) y un poco de trompa
        g.quaternion.setFromUnitVectors(ARRIBA, NORMAL).multiply(Q2.setFromAxisAngle(ARRIBA, -o.rumbo)).multiply(Q.setFromEuler(new THREE.Euler(o.pitch, 0, o.roll)));
        g.position.set(o.x, o.y + sube - 0.1, o.z);
        grupo.add(g);
      } else {
        const c = cosasTiradas(), pieza = new THREE.Group();
        if (o.resto === 'rueda') {
          pieza.add(new THREE.Mesh(c.cuerpoRueda, c.goma), new THREE.Mesh(c.llantaRueda, c.llanta));
          pieza.position.set(o.x, o.y + 0.16, o.z); pieza.rotation.set((o.rumbo % 1 - 0.5) * 0.3, o.rumbo, (o.rumbo * 3 % 1 - 0.5) * 0.3);
        } else {
          const asa = new THREE.Mesh(c.asaCaja, c.asa); asa.position.y = 0.18;
          pieza.add(new THREE.Mesh(c.cuerpoCaja, c.chapa), asa);
          pieza.position.set(o.x, o.y + 0.14, o.z); pieza.rotation.y = -o.rumbo;
        }
        for (const m of pieza.children) { m.castShadow = true; m.receiveShadow = true; }
        grupo.add(pieza);
      }
    }

    // las formaciones de roca grandes del fondo: torres, hongos, mesas y agujas, hechas de bloques de piedra
    if (t.formaciones.length) {
      const lote = crearLote();
      for (const f of t.formaciones) {
        const rnd = (() => { let a = Math.floor(f.x * 131 + f.z * 71) + 5; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; })();
        const es = PIXEL_FORMACION * f.escala;
        M2.compose(V.set(f.x, f.y, f.z), Q.setFromAxisAngle(ARRIBA, f.giro), PF.set(es, es, es));
        for (const [w, d, h, dx, dz, yb] of FORMACIONES[f.tipo]) lote.bloque(M2, [dx - w / 2, yb === 0 ? -10 : yb, dz - d / 2, dx + w / 2, yb + h, dz + d / 2], { arriba: esc.piedra(w, d), lados: esc.canto(h + 2), abajo: null }, rnd);
      }
      const gf = lote.geometria(esc.atlas), malla = new THREE.Mesh(gf, mFormacion);
      malla.receiveShadow = true;
      grupo.add(malla);
      liberar.push(gf);
    }

    // las matas secas y las piedritas
    if (t.decor.length) {
      const lote = crearLoteDeSprites(dibujosFlora), verdes = crearLoteDeArboles(liviano);
      for (const d of t.decor) {
        // las acacias y la mitad de las matas espinosas y ocres son de planos cruzados (como los arboles del resto del juego);
        // el resto sigue siendo de sprites. (el sorteo ya viene hecho en d: aca no se sortea nada nuevo)
        const arbol = d.nombre === 'acacia' ? ['acacia', 1.2] : d.nombre === 'acaciaChica' ? ['acaciaChica', 1.0] : d.nombre === 'arbustoEspina' && d.azar < 0.5 ? ['matoEspina', 1.2] : d.nombre === 'arbustoOcre' && d.azar < 0.5 ? ['matoSeco', 1.2] : null;
        if (arbol) verdes.poner(arbol[0], d.x, d.y + 0.12, d.z, d.azar * 6.28 * 7 % 6.28, d.escala * arbol[1], (d.azar * 13) % 1);
        else lote.poner(d.nombre, d.x, d.y, d.z, { escala: d.escala, azar: d.azar, mueve: d.mueve });
      }
      if (lote.cuantos()) {
        const mesh = lote.malla(!liviano);
        grupo.add(mesh);
        liberar.push(mesh.geometry, mesh.material, mesh.customDepthMaterial);
      }
      const arboles = verdes.malla();
      if (arboles) { arboles.userData.travesia = true; grupo.add(arboles); liberar.push(arboles.geometry, arboles.material, arboles.customDepthMaterial); }
    }

    // el agua de los arroyos que pasan por aca, recortada a este pedazo
    if (t.aguas.length) {
      const tAlturas = new THREE.DataTexture(alturas, NV, NV, THREE.RedFormat, THREE.FloatType);
      tAlturas.needsUpdate = true;
      liberar.push(tAlturas);
      for (const a of t.aguas) {
        const p = [];
        for (const [u, v] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) p.push(a.x + a.hx * a.cruce * u - a.hz * a.largo * v, a.nivel, a.z + a.hz * a.cruce * u + a.hx * a.largo * v);
        const ga = new THREE.BufferGeometry();
        ga.setAttribute('position', new THREE.BufferAttribute(new Float32Array(p), 3));
        ga.setIndex([0, 2, 1, 1, 2, 3]);
        ga.computeVertexNormals();
        const mat = estilo(new THREE.MeshLambertMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide }), {
          clave: 'aguaT', sombras: true, cabeza: AGUA_T.cabeza, cuerpo: AGUA_T.cuerpo,
          datos: { uAlturas: { value: tAlturas }, uCampo: campo, uCaja: { value: new THREE.Vector4(t.x0, t.z0, t.x0 + L, t.z0 + L) }, uRio: { value: new THREE.Vector3(-a.hz, a.hx, 1.6) },
            uClara: { value: new THREE.Color(0x7fc4c2) }, uHonda: { value: new THREE.Color(0x2f6f7c) }, uEspuma: { value: new THREE.Color(0xe6f3ee) } },
        });
        const m = new THREE.Mesh(ga, mat);
        m.receiveShadow = true; m.frustumCulled = false;
        grupo.add(m);
        liberar.push(ga, mat);
      }
    }
    escena.add(grupo);
    vivos.set(claveDe(t), { t, grupo, liberar });
  }
  function soltar(k) {
    const v = vivos.get(k);
    escena.remove(v.grupo);
    for (const x of v.liberar) if (x && x.dispose) x.dispose();
    huellas.liberar(v.t);
    T.soltarTile(v.t);
    vivos.delete(k);
    estadistica.dibujados--;
  }
  const estadistica = { dibujados: 0 };

  // Una vez por cuadro: arma el terreno que falta cerca del auto (de a un paso por vez para no trabar) y tira el que quedo lejos.
  // ya: arma todo lo que haga falta de una vez (al largar).   Devuelve cuantos pasos hizo.
  const queda = (tx, tz, x, z) => Math.hypot((tx + 0.5) * L - x, (tz + 0.5) * L - z);
  function mantener(x, z, rumbo, ya) {
    const t0 = performance.now();
    let hechos = 0;
    // 1) los que ya tienen datos, a dibujar
    // 2) los que faltan, en orden: primero los de adelante
    const fx = Math.sin(rumbo), fz = -Math.cos(rumbo);
    const cx = Math.floor(x / L), cz = Math.floor(z / L), n = Math.ceil((RADIO + L) / L);
    const faltan = [];
    for (let tz = cz - n; tz <= cz + n; tz++) for (let tx = cx - n; tx <= cx + n; tx++) {
      const d = queda(tx, tz, x, z);
      if (d > RADIO + L * 0.5 || vivos.has(tx + ',' + tz) || T.hay(tx, tz)) continue;
      faltan.push([d - 0.35 * ((tx + 0.5) * L - x) * fx - 0.35 * ((tz + 0.5) * L - z) * fz, tx, tz]);
    }
    faltan.sort((a, b) => a[0] - b[0]);
    for (const [, tx, tz] of faltan) {
      if (!ya && hechos > 0 && performance.now() - t0 > 4) break;
      if (!T.viable(tx, tz)) continue;
      pendientes.push(T.armarTile(tx, tz));
      hechos++;
      if (!ya && hechos >= 1) break;
    }
    // dibujar lo que ya esta calculado (uno por cuadro; al largar, todo)
    while (pendientes.length && (ya || hechos < 2 || performance.now() - t0 < 6)) {
      dibujar(pendientes.shift());
      estadistica.dibujados++;
      hechos++;
      if (!ya && performance.now() - t0 > 8) break;
    }
    // 3) los que quedaron lejos, afuera
    for (const [k, v] of vivos) if (queda(v.t.tx, v.t.tz, x, z) > RADIO + L * 1.7) soltar(k);
    return hechos;
  }

  // --- las alucinaciones: piedras que no existen. Se ven como las de verdad pero no se chocan, y desaparecen al tocarlas ---
  const falsas = [];
  let geoFalsa = null;
  function ponerFalsa(x, y, z) {
    if (!geoFalsa) {
      const m = medidas(1.35), lote = crearLote();
      lote.bloque(new THREE.Matrix4().makeScale(0.25, 0.25, 0.25), [-m.w / 2, -2, -m.d / 2, m.w / 2, m.h, m.d / 2], { arriba: esc.piedra(m.w, m.d), lados: esc.canto(m.h + 2), abajo: null }, null);
      geoFalsa = lote.geometria(esc.atlas);
    }
    const m = new THREE.Mesh(geoFalsa, mPiedra);
    m.position.set(x, y, z); m.rotation.y = Math.random() * 6.28; m.castShadow = true; m.receiveShadow = true;
    escena.add(m);
    falsas.push(m);
  }
  function quitarFalsa(k) { escena.remove(falsas[k]); falsas.splice(k, 1); }   // (la forma se comparte: no se libera)

  const fiesta = crearFiestaDeTravesia(escena, liviano);
  return {
    huellas, luz, estadistica, mantener, fiesta,
    falsas: { poner: ponerFalsa, quitar: quitarFalsa, lista: falsas, vaciar: () => { while (falsas.length) quitarFalsa(0); } },
    usar: (nuevo) => { T = nuevo; },
    vivos: () => vivos.size,
    // el ambiente del juego es compartido con la pista del dia: al entrar en la Travesia se prepara, y al salir se deja como estaba
    activar: () => {
      const antes = ambiente.niebla.value.clone();
      ambiente.niebla.value.set(fondo.r, fondo.g, fondo.b, 0);
      return () => ambiente.niebla.value.copy(antes);
    },
    // Una vez por cuadro: acomoda lo que depende de donde esta la camara y de donde esta el auto (igual que mundo.mirar de world.js)
    mirar: (camara, c, ancho, alto2) => {
      const cam = camara.cam, e = camara.estado;
      V.set(e.x, e.y, e.z);
      const a = V.dot(ejeX), b = V.dot(ejeY);
      V.addScaledVector(ejeX, Math.round(a / paso) * paso - a).addScaledVector(ejeY, Math.round(b / paso) * paso - b);
      sol.target.position.copy(V);
      sol.position.copy(V).addScaledVector(haciaElSol, 250);
      ambiente.bajo.value = e.y;
      ambiente.centro.value.set(c.pos[0], c.pos[1], c.pos[2]);
      const lejos = Math.hypot(cam.position.x - c.pos[0], cam.position.y - c.pos[1], cam.position.z - c.pos[2]);
      V.set(c.pos[0], c.pos[1] + 0.6, c.pos[2]).project(cam);
      ambiente.hueco.value.set((V.x * 0.5 + 0.5) * ancho, (V.y * 0.5 + 0.5) * alto2, 3.8 * alto2 / (2 * Math.tan(cam.fov * Math.PI / 360)) / lejos);
      cam.getWorldDirection(D);
      const h = Math.hypot(D.x, D.z) || 1, baja = Math.min(1, Math.max(0, -D.y)), inclina = Math.max(baja * 0.62, Math.asin(baja) - 0.51);
      ambiente.camDer.value.set(-D.z / h, 0, D.x / h);
      ambiente.camMira.value.set(D.x / h, 0, D.z / h);
      ambiente.camAlto.value.set(D.x / h * Math.sin(inclina), Math.cos(inclina), D.z / h * Math.sin(inclina));
    },
    animar: (t) => { ambiente.tiempo.value = t; },
    // tira todo (al salir de la Travesia)
    vaciar: () => { for (const k of [...vivos.keys()]) soltar(k); pendientes.length = 0; while (falsas.length) quitarFalsa(0); fiesta.quitar(); },
  };
}

// La utileria del rally: arcos de largada, de control y de meta, banderines, cintas, carteles,
// alambrados, fardos, mojones y las piedras grandes. Casi todo son cajas con un dibujo de pocos pixeles.
import * as THREE from '../vendor/three.module.js';
import { azar } from './noise.js';
import { crearLote } from './pixel.js';
import { estilo } from './material.js';
import { armarEstacionado } from './autos.js';
import { crearLoteDeSprites } from './sprites.js';

const COLORES = ['#d8402f', '#f2c200', '#f4f0e6', '#49b3d6', '#3f9150', '#f07f1e'];
const par = (v) => Math.max(2, Math.round(v / 2) * 2);

// clima: para pedirle el resplandor de las antorchas.
export function crearUtileria(T, escena, esc, clima) {
  const P = T.camino, fijos = crearLote();
  const M = new THREE.Matrix4(), M2 = new THREE.Matrix4(), Q = new THREE.Quaternion(), Q2 = new THREE.Quaternion(), V = new THREE.Vector3(), E = new THREE.Vector3();
  const ARRIBA = new THREE.Vector3(0, 1, 0), EJE_X = new THREE.Vector3(1, 0, 0), NORMAL = new THREE.Vector3();
  const P4 = new THREE.Vector3(0.25, 0.25, 0.25), P8 = new THREE.Vector3(0.125, 0.125, 0.125);
  // inclinacion del piso en un punto: gira "arriba" hasta la normal del terreno
  const acostar = (x, z, q) => {
    NORMAL.set(-(T.altura(x + 1, z) - T.altura(x - 1, z)) / 2, 1, -(T.altura(x, z + 1) - T.altura(x, z - 1)) / 2).normalize();
    return q.setFromUnitVectors(ARRIBA, NORMAL);
  };
  // matriz de algo apoyado en (x, z) mirando hacia "rumbo", con medidas en pixeles de 12,5 cm
  const parado = (x, z, rumbo, y) => M.compose(V.set(x, y === undefined ? T.altura(x, z) : y, z), Q.setFromAxisAngle(ARRIBA, -rumbo), P8);

  // --- piedras: un bloque acostado sobre la ladera y otro mas chico apoyado al lado ---
  for (const o of T.cosas) {
    if (o.clase !== 'piedra') continue;
    const r = azar(Math.floor(o.x * 131 + o.z * 71) + 9);
    const w = par(o.r * 7.6), d = par(o.r * 6.4), h = Math.max(2, Math.round(o.r * o.alto * 4.6));   // tan ancha como el circulo contra el que se choca
    M2.compose(V.set(o.x, o.y, o.z), acostar(o.x, o.z, Q).multiply(Q2.setFromAxisAngle(ARRIBA, o.vuelta || 0)), P4);
    fijos.bloque(M2, [-w / 2, -2, -d / 2, w / 2, h, d / 2], { arriba: esc.piedra(w, d), lados: esc.canto(h + 2), abajo: null }, r);
    const w2 = par(w * 0.55), d2 = par(d * 0.6), h2 = Math.max(2, Math.round(h * 0.55)), cx = Math.round((r() < 0.5 ? -1 : 1) * w * 0.45), cz = Math.round((r() - 0.5) * d * 0.6);
    fijos.bloque(M2, [cx - w2 / 2, -2, cz - d2 / 2, cx + w2 / 2, h2, cz + d2 / 2], { arriba: esc.piedra(w2, d2), lados: esc.canto(h2 + 2), abajo: null }, r);
  }

  // --- señales de peligro: una antorcha roja sobre cada piedra que quedo al borde del camino ---
  // (Las piedras son grises sobre un piso gris o marron: de lejos no se ven, y son las que se chocan al cortar una curva.
  // Es solo una señal: no se choca ni cambia la pista. De un grupo de piedras juntas alcanza con marcar una cada tanto.)
  const antorchas = crearLoteDeSprites(), marcadas = [];
  for (const o of T.cosas) {
    if (o.clase !== 'piedra' || !(T.borde[Math.round(o.z - T.z0) * T.nx + Math.round(o.x - T.x0)] < 2 + o.r)) continue;
    if (marcadas.some((q) => (q.x - o.x) ** 2 + (q.z - o.z) ** 2 < 49)) continue;
    marcadas.push(o);
    const tope = o.y + Math.max(2, Math.round(o.r * o.alto * 4.6)) * 0.25;
    antorchas.poner('antorcha', o.x, tope - 0.2, o.z, { escala: 1.15, azar: Math.abs(o.x * 7.3 + o.z * 3.1) % 1, mueve: 0.07 });
    if (clima) clima.resplandor(o.x, o.y, o.z, 2.6, 0xff2a14, 0.3);
  }
  if (antorchas.cuantos()) { const m = antorchas.malla(false, true); m.frustumCulled = false; escena.add(m); }

  // --- mojones blancos al borde del precipicio ---
  for (const o of T.mojones) {
    M2.compose(V.set(o.x, o.y, o.z), Q.identity(), P8);
    fijos.bloque(M2, [-1, -2, -1, 1, 8, 1], { lados: esc.mojon(), arriba: esc.liso('#fbf9f2'), abajo: null });
  }

  // --- cintas del publico: dos estacas y la cinta entre ellas ---
  for (const c of T.cintas) {
    const dx = c.x2 - c.x1, dz = c.z2 - c.z1, largo = Math.hypot(dx, dz), px = Math.max(4, Math.round(largo * 8)), rumbo = Math.atan2(dx, -dz);
    for (const [x, z, y] of [[c.x1, c.z1, c.y1], [c.x2, c.z2, c.y2]]) fijos.bloque(parado(x, z, rumbo, y), [-0.5, -1, -0.5, 0.5, 8, 0.5], { lados: esc.estaca(), arriba: esc.liso('#e9e4d6'), abajo: null });
    // la cinta es una tira parada, del ancho de un pixel, que va de estaca a estaca
    const zc = esc.cinta(px), a = new THREE.Vector3(c.x1, c.y1 + 0.85, c.z1), b = new THREE.Vector3(c.x2, c.y2 + 0.85, c.z2), alto = new THREE.Vector3(0, 0.125, 0);
    const esquinas = [a.clone().add(alto), b.clone().add(alto), b, a], uv = [zc.x, zc.y, zc.x + px, zc.y, zc.x + px, zc.y + 1, zc.x, zc.y + 1];
    fijos.cara(esquinas, uv);
    fijos.cara([esquinas[1], esquinas[0], esquinas[3], esquinas[2]], uv);
  }

  // --- carteles de curva: una tabla sobre dos patas, echada hacia atras para que se lea desde arriba ---
  for (const c of T.carteles) {
    const ojo = c.tipo === 'ojo', w = ojo ? 8 : 16, frente = ojo ? esc.ojo() : esc.flecha(c.tipo);
    M2.compose(V.set(c.x, c.y, c.z), Q.setFromAxisAngle(ARRIBA, -c.rumbo).multiply(Q2.setFromAxisAngle(EJE_X, -0.5)), P8);
    for (const x of ojo ? [0] : [-5, 5]) fijos.bloque(M2, [x - 0.5, -2, -0.5, x + 0.5, 6, 0.5], { lados: esc.liso('#3a3d42'), arriba: null, abajo: null });
    // la cara que ve el que viene es la de atras de la caja (+z)
    fijos.caja(M2, [-w / 2, 6, -0.5, w / 2, 14, 0.5], (cara, e) => {
      const z = cara === 'pz' ? frente : cara === 'nz' ? esc.dorso() : esc.liso('#1b1b1d');
      if (cara !== 'pz' && cara !== 'nz') return [z.x + 0.5, z.y + 0.5];
      const u = cara === 'pz' ? (e.x + w / 2) / w : (w / 2 - e.x) / w;
      return [z.x + u * z.w, z.y + (14 - e.y) / 8 * z.h];
    });
  }

  // --- arcos: dos palos y una tela con algo escrito. Devuelve donde quedo la tela, para cambiarla despues ---
  const arcos = [];   // donde quedo cada uno: { p, alto, medio } (alto y medio ancho, en pixeles)
  function arco(p, alto, tela, color) {
    const medio = Math.round((p.ancho / 2 + 0.9) * 8), palo = { lados: esc.liso(color), arriba: esc.liso(color), abajo: null };
    arcos.push({ p, alto, medio });
    parado(p.x, p.z, p.rumbo);
    for (const s of [-1, 1]) fijos.bloque(M, [s * medio - 1, -8, -1, s * medio + 1, alto + 10, 1], palo);
    fijos.caja(M, [-medio, alto, -0.5, medio, alto + 9, 0.5], (cara, e) => {
      if (cara !== 'pz' && cara !== 'nz') { const z = esc.liso(color); return [z.x + 0.5, z.y + 0.5]; }
      const u = cara === 'pz' ? (e.x + medio) / (2 * medio) : (medio - e.x) / (2 * medio);
      return [tela.x + u * tela.w, tela.y + (alto + 9 - e.y) / 9 * tela.h];
    });
  }
  const anchoDeTela = (p) => Math.round((p.ancho / 2 + 0.9) * 16);
  // (en una vuelta cerrada hay una sola raya, con su arco a cuadros: la largada y la meta son el mismo lugar)
  if (!T.vuelta) arco(T.salida, 34, esc.tela('LARGADA', anchoDeTela(T.salida), '#d8402f', '#ffffff', '#f2c200'), '#26262a');
  T.controles.forEach((p, i) => arco(p, 30, esc.tela('SECTOR ' + (i + 2), anchoDeTela(p), '#f2c200', '#1b1b1d', '#1b1b1d'), '#26262a'));
  arco(T.meta, 36, esc.cuadros(anchoDeTela(T.meta)), '#26262a');

  // --- banderines: en la largada y en la llegada, colgados entre palos a los dos lados del camino ---
  function banderines(desde, hasta) {
    const r = azar(desde * 7 + 3);
    for (const lado of [-1, 1]) {
      let antes = null;
      for (let i = desde; i <= hasta; i += 7) {
        const d = lado * (P.W[i] / 2 + 1.5), x = P.X[i] - P.HZ[i] * d, z = P.Z[i] + P.HX[i] * d, y = T.altura(x, z), rumbo = Math.atan2(P.HX[i], -P.HZ[i]);
        fijos.bloque(parado(x, z, rumbo, y), [-0.5, -2, -0.5, 0.5, 22, 0.5], { lados: esc.liso('#e9e4d6'), arriba: esc.liso('#ffffff'), abajo: null });
        if (antes) {
          // la soga cuelga un poco; de ella cuelgan los banderines, de a uno cada 60 cm
          const n = Math.max(2, Math.round(Math.hypot(x - antes.x, z - antes.z) / 0.6));
          for (let k = 0; k < n; k++) {
            const t = (k + 0.5) / n, cuelga = 4 * t * (1 - t) * 0.45;
            const bx = antes.x + (x - antes.x) * t, bz = antes.z + (z - antes.z) * t, by = antes.y + (y - antes.y) * t + 2.7 - cuelga;
            const zb = esc.banderin(COLORES[Math.floor(r() * COLORES.length)]);
            const hx = (x - antes.x) / n * 0.3, hz = (z - antes.z) / n * 0.3;
            const esquinas = [new THREE.Vector3(bx - hx, by, bz - hz), new THREE.Vector3(bx + hx, by, bz + hz), new THREE.Vector3(bx + hx, by - 0.5, bz + hz), new THREE.Vector3(bx - hx, by - 0.5, bz - hz)];
            const uv = [zb.x, zb.y, zb.x + 3, zb.y, zb.x + 3, zb.y + 4, zb.x, zb.y + 4];
            fijos.cara(esquinas, uv);
            fijos.cara([esquinas[1], esquinas[0], esquinas[3], esquinas[2]], [uv[2], uv[3], uv[0], uv[1], uv[6], uv[7], uv[4], uv[5]]);
          }
        }
        antes = { x, y, z };
      }
    }
  }
  if (T.vuelta) banderines(T.largada.i - 4, T.salida.i + 26);
  else {
    banderines(T.largada.i - 4, Math.min(P.n - 1, T.salida.i + 26));
    banderines(Math.max(0, T.meta.i - 44), Math.min(P.n - 1, T.meta.i + 14));
  }

  // --- molinos de viento: la torre, la cola y, al lado, el tanque. La rueda va aparte porque gira ---
  const ruedas = crearLote(), ejes = [];
  for (const m of T.molinos) {
    parado(m.x, m.z, m.vuelta, m.y);
    for (const [ancho, desde, hasta] of [[5, -4, 24], [4, 24, 48], [3, 48, 70]]) fijos.bloque(M, [-ancho / 2, desde, -ancho / 2, ancho / 2, hasta, ancho / 2], { lados: esc.torre(ancho, hasta - desde), arriba: null, abajo: null });
    fijos.bloque(M, [-0.5, 67, 2, 0.5, 73, 11], { lados: esc.liso('#b5503a'), arriba: esc.liso('#c9634a'), abajo: null });   // la cola
    const tx = m.x + 4.5, tz = m.z, ty = T.altura(tx, tz);
    fijos.bloque(parado(tx, tz, 0, ty), [-17, -4, -17, 17, 9, 17], { lados: esc.chapa(13), arriba: esc.aguaQuieta(34), abajo: null });
    ejes.push(m);
  }
  const mallasDeRueda = ejes.map((m) => {
    // la rueda: un disco de aspas parado, que mira hacia donde apunta el molino
    const l = crearLote(), z = esc.aspas(), r = 1.7;
    const esquinas = [new THREE.Vector3(-r, r, 0), new THREE.Vector3(r, r, 0), new THREE.Vector3(r, -r, 0), new THREE.Vector3(-r, -r, 0)], uv = [z.x, z.y, z.x + 27, z.y, z.x + 27, z.y + 27, z.x, z.y + 27];
    l.cara(esquinas, uv); l.cara([esquinas[1], esquinas[0], esquinas[3], esquinas[2]], [uv[2], uv[3], uv[0], uv[1], uv[6], uv[7], uv[4], uv[5]]);
    return { l, m };
  });

  const dibujo = esc.atlas.textura();
  const mFijo = estilo(new THREE.MeshLambertMaterial({ map: dibujo, alphaTest: 0.5 }));
  const giran = mallasDeRueda.map(({ l, m }) => {
    const rueda = new THREE.Mesh(l.geometria(esc.atlas), mFijo), eje = new THREE.Group();
    rueda.castShadow = true;
    eje.position.set(m.x - Math.sin(m.vuelta) * 0.45, m.y + 8.75, m.z + Math.cos(m.vuelta) * 0.45);
    eje.rotation.y = -m.vuelta;
    eje.add(rueda);
    escena.add(eje);
    return rueda;
  });
  const malla = new THREE.Mesh(fijos.geometria(esc.atlas), mFijo);
  malla.castShadow = true; malla.receiveShadow = true;
  escena.add(malla);

  // --- los autos del publico, estacionados atras de la gente ---
  for (const a of T.estacionados) {
    const { grupo, alto } = armarEstacionado(a.n);
    grupo.quaternion.copy(acostar(a.x, a.z, Q)).multiply(Q2.setFromAxisAngle(ARRIBA, -a.rumbo));
    grupo.position.set(a.x, a.y + alto, a.z);
    escena.add(grupo);
  }

  // --- lo que se puede tirar: los postes del alambrado (con sus alambres) y los fardos ---
  const lPoste = crearLote(), lFardo = crearLote();
  lPoste.bloque(M2.makeScale(0.125, 0.125, 0.125), [-1, -2, -1, 1, 9, 1], { lados: esc.poste(), arriba: esc.liso('#b39a78'), abajo: null });
  lFardo.bloque(M2.makeScale(0.125, 0.125, 0.125), [-6, 0, -5, 6, 10, 5], { lados: esc.fardo(), arriba: esc.fardo(), abajo: null });
  const instancias = (lote, lista) => {
    const m = new THREE.InstancedMesh(lote.geometria(esc.atlas), mFijo, Math.max(1, lista.length));
    m.count = lista.length; m.castShadow = true; m.receiveShadow = true;
    escena.add(m);
    return m;
  };
  const postes = instancias(lPoste, T.postes), fardos = instancias(lFardo, T.fardos);
  // alambres: dos hilos entre cada par de postes vecinos del mismo lado
  const tramos = [];
  const porLugar = new Map(T.postes.map((o, k) => [o.i * 2 + (o.lado > 0 ? 1 : 0), k]));
  T.postes.forEach((o, k) => { const otro = porLugar.get((o.i + 7) * 2 + (o.lado > 0 ? 1 : 0)); if (otro !== undefined) tramos.push([k, otro]); });
  const alambres = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), estilo(new THREE.MeshLambertMaterial({ color: 0x3f3a34 })), Math.max(1, tramos.length * 2));
  alambres.count = tramos.length * 2;
  escena.add(alambres);
  const CERO = new THREE.Matrix4().makeScale(0, 0, 0);
  function acomodar() {
    T.postes.forEach((o, k) => {
      // un poste chocado queda acostado en el piso
      Q.setFromAxisAngle(ARRIBA, -o.vuelta);
      if (o.roto) Q.multiply(Q2.setFromAxisAngle(EJE_X, -1.45));
      postes.setMatrixAt(k, M.compose(V.set(o.x, o.y + (o.roto ? 0.12 : 0), o.z), Q, E.set(1, 1, 1)));
    });
    T.fardos.forEach((o, k) => {
      Q.setFromAxisAngle(ARRIBA, -o.vuelta);
      if (o.roto) Q.multiply(Q2.setFromAxisAngle(EJE_X, 0.5));
      fardos.setMatrixAt(k, M.compose(V.set(o.x, o.y, o.z), Q, E.set(1, 1, 1)));
    });
    tramos.forEach(([a, b], k) => {
      const A = T.postes[a], B = T.postes[b];
      for (let h = 0; h < 2; h++) {
        if (A.roto || B.roto) { alambres.setMatrixAt(k * 2 + h, CERO); continue; }
        const alto = 0.45 + h * 0.42;
        V.set((A.x + B.x) / 2, (A.y + B.y) / 2 + alto, (A.z + B.z) / 2);
        E.set(B.x - A.x, B.y - A.y, B.z - A.z);
        const largo = E.length();
        Q.setFromUnitVectors(EJE_X, E.normalize());
        alambres.setMatrixAt(k * 2 + h, M.compose(V, Q, E.set(largo, 0.05, 0.05)));
      }
    });
    postes.instanceMatrix.needsUpdate = fardos.instanceMatrix.needsUpdate = alambres.instanceMatrix.needsUpdate = true;
  }
  acomodar();

  return {
    arcos, antorchas: marcadas.length,
    // las ruedas de los molinos giran
    animar: (t) => { giran.forEach((r, k) => { r.rotation.z = t * (1.1 + k * 0.3); }); },
    // el auto se llevo puesto algo: se lo tira
    tirar: acomodar,
    // al largar de nuevo, todo vuelve a su lugar
    reiniciar: () => { for (const o of T.postes) o.roto = false; for (const o of T.fardos) o.roto = false; acomodar(); },
  };
}

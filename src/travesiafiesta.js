// El festival de la largada de la Travesia: arco de largada, gente detras de las cintas (que festeja y se corre si el auto se les va
// encima), banderines, carpas de los equipos, camiones de asistencia, autos estacionados y las marcas de mentira en chapas y
// banderas. Despues de unos cientos de metros se acaba y queda el desierto.
//
// Los datos (donde va cada cosa) los arma travesiaterreno.js (T.fiesta). Aca solo se dibujan, reusando lo de la pista del dia:
// el publico (publico.js), las marcas (carteleria.js), los autos (autos.js) y los dibujos de arcos y cintas (arte.js).
// Es todo un solo grupo que se arma al largar y se tira al salir; cuando el auto ya paso, se esconde.
import * as THREE from '../vendor/three.module.js';
import { crearLote } from './pixel.js';
import { estilo } from './material.js';
import { crearEscenografia } from './arte.js';
import { crearPublico } from './publico.js';
import { crearPublicidad } from './carteleria.js';
import { armarEstacionado, armarDeEquipo } from './autos.js';
import { azar } from './noise.js';
import { FIESTA_FIN } from './travesiaterreno.js';

const COLORES = ['#d8402f', '#f2c200', '#f4f0e6', '#49b3d6', '#3f9150', '#f07f1e'];

// libera lo que armo un pedazo de la fiesta (geometrias y materiales; las texturas propias solo si propias = true)
function tirar(grupo, propias) {
  grupo.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.customDepthMaterial) o.customDepthMaterial.dispose();
    for (const m of [].concat(o.material || [])) { if (propias && m.map) m.map.dispose(); m.dispose(); }
  });
  if (grupo.parent) grupo.parent.remove(grupo);
}

export function crearFiestaDeTravesia(escena, liviano) {
  let raiz = null, publico = null, publicidad = null, T = null, conEfectos = true;
  const subgrupos = [];   // [grupo, propias]
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), Q2 = new THREE.Quaternion(), V = new THREE.Vector3(), NORMAL = new THREE.Vector3();
  const ARRIBA = new THREE.Vector3(0, 1, 0), P8 = new THREE.Vector3(0.125, 0.125, 0.125);

  function quitar() {
    for (const [g, propias] of subgrupos) tirar(g, propias);
    subgrupos.length = 0;
    if (raiz) escena.remove(raiz);
    raiz = publico = publicidad = T = null;
  }

  // Arma todo el festival de este terreno. Se llama despues de armar los pedazos de terreno de alrededor (asi las alturas salen rapido).
  function poner(terreno) {
    quitar();
    T = terreno;
    const F = T.fiesta, P = T.camino, alt = (x, z) => T.altura(x, z);
    raiz = new THREE.Group();
    escena.add(raiz);
    const nuevo = (propias) => { const g = new THREE.Group(); raiz.add(g); subgrupos.push([g, propias]); return g; };
    const acostar = (x, z, q) => {
      NORMAL.set(-(alt(x + 1, z) - alt(x - 1, z)) / 2, 1, -(alt(x, z + 1) - alt(x, z - 1)) / 2).normalize();
      return q.setFromUnitVectors(ARRIBA, NORMAL);
    };

    // --- lo que tiene que ver el modulo del publico y el de las marcas: un "terreno" de pista con lo justo ---
    const gente = F.gente.filter((g, k) => !liviano || k % 3 !== 2).map((g) => ({ ...g, y: alt(g.x, g.z) }));
    const cintas = F.cintas.map((c) => ({ ...c, y1: alt(c.x1, c.z1), y2: alt(c.x2, c.z2) }));
    const falso = {
      camino: P, vuelta: null, etapa: { semilla: T.semilla, tramos: [] }, altura: alt, aguas: [], suelo: () => ({ agua: 0 }), cosasCerca: T.cosasCerca,
      cintas, publico: gente, claros: [], vacas: [], largada: { i: F.desde }, salida: { i: F.arco.i }, meta: null,
    };
    const gP = nuevo(false);
    publico = crearPublico(falso, gP, { resplandor() {} }, { fuego: false });
    publico.humo.visible = conEfectos;

    // --- el arco de largada (mismo dibujo que en la pista del dia) y, sobre el, las marcas ---
    const esc = crearEscenografia(), fijos = crearLote();
    const a = F.arco, medio = Math.round((a.ancho / 2 + 0.9) * 8), alto = 34, palo = { lados: esc.liso('#26262a'), arriba: esc.liso('#26262a'), abajo: null };
    const tela = esc.tela('LARGADA', medio * 2, '#d8402f', '#ffffff', '#f2c200');
    M.compose(V.set(a.x, alt(a.x, a.z), a.z), Q.setFromAxisAngle(ARRIBA, -a.rumbo), P8);
    for (const s of [-1, 1]) fijos.bloque(M, [s * medio - 1, -8, -1, s * medio + 1, alto + 10, 1], palo);
    fijos.caja(M, [-medio, alto, -0.5, medio, alto + 9, 0.5], (cara, e) => {
      if (cara !== 'pz' && cara !== 'nz') { const z = esc.liso('#26262a'); return [z.x + 0.5, z.y + 0.5]; }
      const u = cara === 'pz' ? (e.x + medio) / (2 * medio) : (medio - e.x) / (2 * medio);
      return [tela.x + u * tela.w, tela.y + (alto + 9 - e.y) / 9 * tela.h];
    });

    // --- cintas: dos estacas y la cinta entre ellas ---
    for (const c of cintas) {
      const dx = c.x2 - c.x1, dz = c.z2 - c.z1, largo = Math.hypot(dx, dz), px = Math.max(4, Math.round(largo * 8)), rumbo = Math.atan2(dx, -dz);
      for (const [x, z, y] of [[c.x1, c.z1, c.y1], [c.x2, c.z2, c.y2]]) {
        M.compose(V.set(x, y, z), Q.setFromAxisAngle(ARRIBA, -rumbo), P8);
        fijos.bloque(M, [-0.5, -1, -0.5, 0.5, 8, 0.5], { lados: esc.estaca(), arriba: esc.liso('#e9e4d6'), abajo: null });
      }
      const zc = esc.cinta(px), p1 = new THREE.Vector3(c.x1, c.y1 + 0.85, c.z1), p2 = new THREE.Vector3(c.x2, c.y2 + 0.85, c.z2), subo = new THREE.Vector3(0, 0.125, 0);
      const esquinas = [p1.clone().add(subo), p2.clone().add(subo), p2, p1], uv = [zc.x, zc.y, zc.x + px, zc.y, zc.x + px, zc.y + 1, zc.x, zc.y + 1];
      fijos.cara(esquinas, uv);
      fijos.cara([esquinas[1], esquinas[0], esquinas[3], esquinas[2]], uv);
    }

    // --- banderines colgados entre palos, a los dos lados, cerca del arco ---
    const r = azar((T.semilla ^ 0x3c6ef372) >>> 0);
    for (const lado of [-1, 1]) {
      let antes = null;
      for (let i = F.desde - 2; i <= F.desde + 150; i += 7) {
        const d = lado * (P.W[i] / 2 + 1.5), x = P.X[i] - P.HZ[i] * d, z = P.Z[i] + P.HX[i] * d, y = alt(x, z), rumbo = Math.atan2(P.HX[i], -P.HZ[i]);
        M.compose(V.set(x, y, z), Q.setFromAxisAngle(ARRIBA, -rumbo), P8);
        fijos.bloque(M, [-0.5, -2, -0.5, 0.5, 22, 0.5], { lados: esc.liso('#e9e4d6'), arriba: esc.liso('#ffffff'), abajo: null });
        if (antes) {
          // la soga cuelga un poco; de ella cuelgan los banderines, de a uno cada 60 cm
          const n = Math.max(2, Math.round(Math.hypot(x - antes.x, z - antes.z) / 0.6));
          for (let k = 0; k < n; k++) {
            const t = (k + 0.5) / n, cuelga = 4 * t * (1 - t) * 0.45;
            const bx = antes.x + (x - antes.x) * t, bz = antes.z + (z - antes.z) * t, by = antes.y + (y - antes.y) * t + 2.7 - cuelga;
            const zb = esc.banderin(COLORES[Math.floor(r() * COLORES.length)]), hx = (x - antes.x) / n * 0.3, hz = (z - antes.z) / n * 0.3;
            const e = [new THREE.Vector3(bx - hx, by, bz - hz), new THREE.Vector3(bx + hx, by, bz + hz), new THREE.Vector3(bx + hx, by - 0.5, bz + hz), new THREE.Vector3(bx - hx, by - 0.5, bz - hz)];
            const uv = [zb.x, zb.y, zb.x + 3, zb.y, zb.x + 3, zb.y + 4, zb.x, zb.y + 4];
            fijos.cara(e, uv);
            fijos.cara([e[1], e[0], e[3], e[2]], [uv[2], uv[3], uv[0], uv[1], uv[6], uv[7], uv[4], uv[5]]);
          }
        }
        antes = { x, y, z };
      }
    }

    // --- las carpas de los equipos: cuatro palos, un techo de color con el faldon blanco, una mesa con sus cosas y la bandera del equipo ---
    const blanco = esc.liso('#f4f0e6'), palos = esc.liso('#e9e4d6'), mesa = esc.liso('#cfc7b3'), caja = esc.liso('#b9442e'), goma = esc.liso('#1a1a1d');
    for (const q of F.carpas) {
      const techo = esc.liso(q.color), z0 = alt(q.x, q.z);
      M.compose(V.set(q.x, z0, q.z), Q.setFromAxisAngle(ARRIBA, -q.rumbo), P8);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) fijos.bloque(M, [sx * 8.5 - 0.6, -2, sz * 8.5 - 0.6, sx * 8.5 + 0.6, 22, sz * 8.5 + 0.6], { lados: palos, arriba: palos, abajo: null });
      fijos.bloque(M, [-10, 20, -10, 10, 22, 10], { lados: blanco, arriba: blanco, abajo: techo });
      fijos.bloque(M, [-10, 22, -10, 10, 24, 10], { lados: techo, arriba: techo, abajo: null });
      fijos.bloque(M, [-6, 24, -6, 6, 27, 6], { lados: techo, arriba: techo, abajo: null });
      fijos.bloque(M, [-6, -2, -2, 6, 8, 3], { lados: mesa, arriba: mesa, abajo: null });
      fijos.bloque(M, [-5, 8, -1, -1, 11, 2], { lados: caja, arriba: caja, abajo: null });
      fijos.bloque(M, [2, 8, -1, 5, 10, 2], { lados: goma, arriba: goma, abajo: null });
      fijos.bloque(M, [11, -2, 8.5, 12, 46, 9.5], { lados: palos, arriba: palos, abajo: null });
      fijos.bloque(M, [12, 36, 8.7, 24, 45, 9.3], { lados: techo, arriba: techo, abajo: techo });
    }
    const gF = nuevo(true);
    if (!fijos.vacio()) {
      const malla = new THREE.Mesh(fijos.geometria(esc.atlas), estilo(new THREE.MeshLambertMaterial({ map: esc.atlas.textura(), alphaTest: 0.5 })));
      malla.castShadow = true; malla.receiveShadow = true;
      gF.add(malla);
    }

    // --- las marcas de mentira: banderas, chapas contra las cintas y una tira sobre el arco ---
    const gM = nuevo(true);
    publicidad = crearPublicidad(falso, gM, [{ p: { x: a.x, z: a.z, rumbo: a.rumbo, ancho: a.ancho, i: a.i }, alto, medio }]);

    // --- los autos: de los equipos y de la gente (estacionados atras). Son los mismos dibujos que en la pista del dia ---
    const gA = nuevo(false);
    for (const q of F.autos) {
      const { grupo, alto: sube } = q.tipo === 'equipo' ? armarDeEquipo(q.n) : armarEstacionado(q.n % 9);
      const y = alt(q.x, q.z);
      grupo.quaternion.copy(acostar(q.x, q.z, Q)).multiply(Q2.setFromAxisAngle(ARRIBA, -q.rumbo));
      grupo.position.set(q.x, y + sube, q.z);
      gA.add(grupo);
    }
  }

  return {
    poner, quitar,
    // el ajuste "efectos": sin el, no sale humo de las parrillas
    efectos: (si) => { conEfectos = !!si; if (publico) publico.humo.visible = conEfectos; },
    // una vez por cuadro. c: el auto. indice: por que metro del camino va.
    animar: (c, indice, dt, t) => {
      if (!raiz) return;
      const cerca = indice < FIESTA_FIN + 250;   // ya paso: ni se dibuja
      raiz.visible = cerca;
      if (!cerca) return;
      publico.animar(c, indice, dt, t);
      publicidad.animar(c, dt);
    },
    hay: () => !!raiz,
    cuantos: () => (publico ? publico.cuantos : 0),
    // (para las pruebas) lo que quedo armado
    contar: () => ({ gente: publico ? publico.cuantos : 0, marcas: publicidad ? publicidad.cuantos : null, autos: T ? T.fiesta.autos.length : 0, carpas: T ? T.fiesta.carpas.length : 0 }),
  };
}

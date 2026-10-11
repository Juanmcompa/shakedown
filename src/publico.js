// El publico: gente parada detras de las cintas, que festeja cuando se acerca el auto
// y se corre si se le va encima. Son sprites (ver sprites.js). Algunos grupos hacen un asado.
import * as THREE from 'three';
import { azar } from './noise.js';
import { crearLoteDeSprites } from './sprites.js';
import { granito } from './arte.js';
import { estilo } from './material.js';

// clima: para pedirle los resplandores en el piso. luz: la del clima (luz.fuego = se prenden fogones y bengalas).
export function crearPublico(T, escena, clima, luz) {
  const P = T.camino, L = T.vuelta ? T.vuelta.largo : 0, r = azar((T.etapa.semilla || 1) + 77), lote = crearLoteDeSprites(), cosas = crearLoteDeSprites(), fuegos = crearLoteDeSprites();
  // cada persona: donde esta parada, cuanto se corrio y si festeja
  const gente = T.publico.map((g) => ({ ...g, n: lote.persona(g.ropa + Math.floor(g.fase * 12), g.x, g.y, g.z, g.rumbo, g.fase, 0.9 + (g.fase * 7 % 1) * 0.2), dx: 0, dz: 0, animo: 0 }));
  // junto a algunos grupos: reposeras y la parrilla
  const parrillas = [];
  for (const c of T.cintas) {
    const mx = (c.x1 + c.x2) / 2, mz = (c.z1 + c.z2) / 2, largo = Math.hypot(c.x2 - c.x1, c.z2 - c.z1);
    // hacia atras de la cinta (lejos del camino): es para donde esta la gente
    const cerca = gente.find((g) => Math.hypot(g.x - mx, g.z - mz) < largo);
    if (!cerca) continue;
    const ax = cerca.x - mx, az = cerca.z - mz, l = Math.hypot(ax, az) || 1, ux = ax / l, uz = az / l, tx = (c.x2 - c.x1) / largo, tz = (c.z2 - c.z1) / largo;
    const lugar = (a, f) => { const x = mx + tx * a + ux * f, z = mz + tz * a + uz * f; return [x, T.altura(x, z), z]; };
    if (r() < 0.7) cosas.poner(r() < 0.5 ? 'reposeraRoja' : 'reposeraAzul', ...lugar((r() - 0.5) * largo * 0.8, 3.6 + r()), { azar: r(), mueve: 0 });
    if (r() < 0.45) { const p = lugar((r() < 0.5 ? -1 : 1) * (largo / 2 + 1), 3.2 + r() * 1.5); cosas.poner('parrilla', ...p, { azar: r(), mueve: 0 }); parrillas.push(p); }
    // con poca luz, cada grupo prende su fogon
    if (luz.fuego) {
      const p = lugar((r() < 0.5 ? -1 : 1) * (largo / 2 + 0.4), 2.4 + r());
      fuegos.poner('fogata', p[0], p[1] - 0.05, p[2], { escala: 1.25, azar: r(), mueve: 0.1 });
      clima.resplandor(p[0], p[1], p[2], 8.5, 0xff8a34, 0.14);
      parrillas.push(p);
    }
  }
  // y algunos levantan una bengala
  if (luz.fuego) for (const g of gente) {
    if ((g.fase * 97) % 1 > 0.2) continue;
    fuegos.poner('bengala', g.x, g.y + 1.9, g.z, { escala: 1.3, azar: g.fase, mueve: 0.12 });
    clima.resplandor(g.x, g.y, g.z, 4.2, 0xff3320, 0.3);
  }
  if (fuegos.cuantos()) { const m = fuegos.malla(false, true); m.frustumCulled = false; escena.add(m); }
  const malla = lote.cuantos() ? lote.malla(true) : null;
  if (malla) { malla.frustumCulled = false; escena.add(malla); }
  if (cosas.cuantos()) escena.add(cosas.malla(true));

  // el humo de las parrillas: cubitos grises que suben y se achican
  const NH = 7, humo = new THREE.InstancedMesh(new THREE.BoxGeometry(0.25, 0.25, 0.25), estilo(new THREE.MeshLambertMaterial({ map: granito(), color: 0xd8dde0, transparent: true, opacity: 0.75 })), Math.max(1, parrillas.length * NH));
  humo.count = parrillas.length * NH; humo.frustumCulled = false;
  escena.add(humo);
  const M = new THREE.Matrix4();

  const base = malla ? malla.geometry.getAttribute('aBase') : null, dato = malla ? malla.geometry.getAttribute('aDato') : null;
  if (base) { base.setUsage(THREE.DynamicDrawUsage); dato.setUsage(THREE.DynamicDrawUsage); }

  // c: el auto. indice: por que metro del camino va. dt: segundos. t: reloj.
  function animar(c, indice, dt, t) {
    parrillas.forEach((p, k) => {
      for (let j = 0; j < NH; j++) {
        const f = (t * 0.35 + j / NH + k * 0.37) % 1, s = (1 - f) * 1.2 + 0.3;
        humo.setMatrixAt(k * NH + j, M.makeScale(s, s, s).setPosition(p[0] + Math.sin(f * 5 + k) * 0.5 * f + f * 0.8, p[1] + 0.8 + f * 4.2, p[2] + Math.cos(f * 4 + j) * 0.3 * f));
      }
    });
    if (parrillas.length) humo.instanceMatrix.needsUpdate = true;
    if (!base) return;
    let cambio = false;
    for (const g of gente) {
      // festejan cuando el auto viene llegando o acaba de pasar
      // (en una vuelta cerrada, los metros dan la vuelta: lo que falta se mide por el lado mas corto)
      let falta = g.i - indice;
      if (L) falta = ((falta % L) + L + L / 2) % L - L / 2;
      const quiere = falta < 70 && falta > -22 ? 1 : 0;
      // si el auto se les viene encima, se corren para atras
      const ax = g.x + g.dx - c.pos[0], az = g.z + g.dz - c.pos[2], d = Math.hypot(ax, az);
      let hx = 0, hz = 0;
      if (d < 7 && Math.abs(c.pos[1] - g.y) < 4) { const corre = (7 - d) / (d + 0.01); hx = ax * corre; hz = az * corre; }
      const ndx = g.dx + ((d < 7 ? g.dx + hx : 0) - g.dx) * Math.min(1, dt * (d < 7 ? 9 : 0.8)), ndz = g.dz + ((d < 7 ? g.dz + hz : 0) - g.dz) * Math.min(1, dt * (d < 7 ? 9 : 0.8));
      const animo = g.animo + (quiere - g.animo) * Math.min(1, dt * 4);
      if (Math.abs(ndx - g.dx) + Math.abs(ndz - g.dz) + Math.abs(animo - g.animo) < 1e-4) continue;
      g.dx = ndx; g.dz = ndz; g.animo = animo;
      base.setXYZ(g.n, g.x + g.dx, T.altura(g.x + g.dx, g.z + g.dz), g.z + g.dz);
      dato.setY(g.n, animo);
      cambio = true;
    }
    if (cambio) { base.needsUpdate = true; dato.needsUpdate = true; }
  }
  return { animar, cuantos: gente.length };
}

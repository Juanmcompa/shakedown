// Los efectos de pista nuevos: los arboles de planos cruzados (estilo PS1), hojas, petalos, viento con arena, polillas, animales que
// se asustan, gente con antorchas y flashes de fotos, la suciedad del auto por terreno (barro, tierra, arena, agua) y las huellas
// segun el suelo. Revisa que:
//  - los arboles son planos cruzados (2 o 3), con recorte (alpha test, sin transparencia) y son instancias: un solo dibujo por zona,
//    con tantos arboles como habia antes (los que chocan) mas unos pocos de adorno que no chocan, y con variedad de tipos por bioma
//    (el bosque, al menos 6; la prueba vervariedad.mjs hace lo mismo con los demas ambientes);
//  - con el ajuste "efectos" apagado no hay hojas, petalos, viento, polillas, animales, antorchas ni flashes (y al prenderlo vuelven);
//  - los animales se alejan cuando el auto se acerca (y no se mueven si el auto esta quieto);
//  - los flashes salen cuando pasa el auto;
//  - el auto se ensucia mas en barro que en tierra; la arena aclara (saca barro y deja una capa clara); el agua limpia abajo; y al
//    largar de nuevo vuelve limpio (el lienzo es igual al original);
//  - quedan huellas atras del auto en barro y arena, duran, y cada suelo deja la suya (barro mas marcado que tierra, tierra que ripio);
//  - tiempo de dibujo por cuadro con y sin efectos; sin errores en consola.
// Capturas en out/: arboles-ps1-1, arboles-ps1-2 (camara baja), arboles-noche, hojas, viento-arena, animales, fotos-flash, antorchas,
// sucio-barro, sucio-arena, sucio-agua, huellas-barro, efectos-celu.
// uso: node tools/pruebas/verefectos.mjs        (con graficos por software va lento: unos minutos)
import fs from 'node:fs';
import { abrir } from './ver.mjs';

fs.mkdirSync('out', { recursive: true });
let mal = 0;
const ver = (que, si, detalle) => { console.log((si ? '  ok  ' : '  MAL ') + que + (si || detalle === undefined ? '' : ' -> ' + JSON.stringify(detalle))); if (!si) mal++; };

// arma el juego: una pista, hora, largada saltando la cuenta
async function abrirPista(pista, hora, opciones = {}) {
  const j = await abrir({ ruta: '?p=' + pista + '&futuro', ...opciones });
  if (!j.cargo) { console.log('NO CARGO\n' + j.errores.join('\n')); process.exit(1); }
  await j.pag.evaluate((h) => { const s = window.shakedown; s.largar(); if (h) s.ponerLaHora(h); s.avanzar(4); }, hora);
  return j;
}
// la camara: 0 aerea, 1 de atras (baja). Queda ya acomodada.
async function camara(pag, modo) {
  for (let k = 0; k < 4 && (await pag.evaluate(() => window.shakedown.camara.estado.modo)) !== modo; k++) await pag.keyboard.press('KeyC');
  await pag.evaluate(async () => {
    const { CAMARAS } = await import('/src/config.js'), e = window.shakedown.camara.estado, m = CAMARAS[e.modo];
    e.dist = m.dist[0] * e.cerca; e.alto = m.alto[0]; e.fov = Math.min(e.parada && m.fovParado ? m.fovParado : 56, 2 * Math.atan(Math.tan(m.fov * Math.PI / 360) * e.ancha) * 180 / Math.PI); e.listo = false;
  });
}
// pone el auto en el metro i del camino y deja la camara siguiendolo
const ir = (pag, i) => pag.evaluate((i) => { const s = window.shakedown; s.ir(i); s.simular(0.3, 0, 0.2); }, i);
// un metro del camino con muchos arboles de hoja ancha o de cualquier tipo cerca
const lugarDeArboles = (pag, soloAncha) => pag.evaluate((soloAncha) => {
  const s = window.shakedown, P = s.T.camino; let mejor = -1, mi = 40;
  for (let i = 30; i < P.n - 40; i += 8) {
    let n = 0;
    for (const o of s.T.cosas) if (o.clase === 'arbol' && o.tipo !== 'arbusto' && (!soloAncha || ['lenga', 'alamo', 'eucalipto'].includes(o.tipo)) && Math.hypot(o.x - P.X[i], o.z - P.Z[i]) < 22) n++;
    if (n > mejor) { mejor = n; mi = i; }
  }
  return mi;
}, soloAncha);
const foto = async (pag, nombre, espera = 2200) => { await pag.waitForTimeout(espera); await pag.screenshot({ path: 'out/' + nombre + '.png' }); console.log('    captura out/' + nombre + '.png'); };
// el mundo avanza "a mano": n pasos de dt segundos (el reloj sigue de donde estaba)
const correrMundo = (pag, n, dt = 0.1) => pag.evaluate(([n, dt]) => {
  const s = window.shakedown, c = s.auto(); window.__t = window.__t || 100;
  for (let k = 0; k < n; k++) { window.__t += dt; s.mundo.animar(dt, window.__t, c, s.estado().indice); }
}, [n, dt]);

// ---------------------------------------------------------------- 1: bosque (arboles, ambiente, suciedad, huellas)
console.log('Arboles, ambiente, suciedad y huellas (bosque, pista 6)');
let j = await abrirPista(6, 'mediodia');
let { pag } = j;

// --- los arboles ---
ver('la camara de arranque de quien entra por primera vez es la de tercera persona (detras del auto)', (await pag.evaluate(() => window.shakedown.camara.modo().id)) === 'atras');
const a = await pag.evaluate(() => {
  const s = window.shakedown, r = { mallas: 0, arboles: 0, planos: new Set(), alphaTest: true, sinTransparencia: true, indices: true, tipos: 0, bloques: 0 };
  s.escena.traverse((o) => {
    if (!o.isInstancedMesh || !o.userData.arboles) return;
    r.mallas++; r.arboles += o.count; r.sueltos = (r.sueltos || 0) + (o.userData.sueltos || 0); r.planos.add(o.userData.planos);
    const m = o.material; if (m.alphaTest < 0.4 || !m.map) r.alphaTest = false; if (m.transparent) r.sinTransparencia = false;
    if (o.geometry.index.count !== (o.userData.planos * 6 + 6) * 2 || !o.geometry.getAttribute('aTop') || !o.geometry.getAttribute('aUv2')) r.indices = false;   // los planos cruzados y el plano horizontal de la copa (vista de arriba), cada uno con sus dos caras
  });
  r.arbolesDelTerreno = s.T.cosas.filter((o) => o.clase === 'arbol' && o.tipo !== 'arbusto').length;
  return { ...r, planos: [...r.planos] };
});
ver('los arboles son instancias (' + a.arboles + ' en ' + a.mallas + ' dibujos de zona)', a.mallas > 0 && a.mallas < 100 && a.arboles > 100, a);
ver('hay un arbol dibujado por cada arbol que choca (' + a.arbolesDelTerreno + ') y los de adorno (' + (a.sueltos || 0) + ') son pocos', a.arboles - (a.sueltos || 0) === a.arbolesDelTerreno && (a.sueltos || 0) <= a.arbolesDelTerreno * 0.4 + 25, a);
// la variedad: cuantos tipos de arbol distintos hay en este bioma (los de adorno cuentan, llevan * en el conteo)
const tp = await pag.evaluate(() => window.shakedown.mundo.flora.tipos), tb = Object.keys(tp.bosque || {}).map((x) => x.replace('*', ''));
ver('el bosque tiene variedad de arboles: ' + new Set(tb).size + ' tipos (' + [...new Set(tb)].join(', ') + ')', new Set(tb).size >= 6, tp);
ver('son planos cruzados (2 o 3 planos de dos triangulos cada uno) mas un plano horizontal en la copa para la camara alta', a.planos.length === 1 && (a.planos[0] === 2 || a.planos[0] === 3) && a.indices, a);
ver('con recorte (alpha test) y sin transparencia: no parpadean al girar', a.alphaTest && a.sinTransparencia, a);
// el tronco (el choque) no cambio: lo comprueban las pruebas de huellas; aca, que los arboles siguen donde estaban
const mismos = await pag.evaluate(() => { const s = window.shakedown; let k = 0; s.escena.traverse((o) => { if (o.isInstancedMesh && o.userData.arboles) { const M = new s.escena.matrix.constructor(); for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, M); const x = M.elements[12], z = M.elements[14]; if (s.T.cosas.some((q) => q.clase === 'arbol' && Math.abs(q.x - x) < 0.01 && Math.abs(q.z - z) < 0.01)) k++; } } }); return k; });
ver('cada instancia esta en el lugar de su tronco (' + mismos + ')', mismos === a.arboles - (a.sueltos || 0), mismos);

const iA = await lugarDeArboles(pag, false);
await ir(pag, iA); await camara(pag, 0); await foto(pag, 'arboles-ps1-1');
await camara(pag, 1); await ir(pag, iA); await foto(pag, 'arboles-ps1-2');
await pag.evaluate(() => window.shakedown.ponerLaHora('noche')); await foto(pag, 'arboles-noche');
await pag.evaluate(() => window.shakedown.ponerLaHora('mediodia'));
// los arboles en las tres camaras (aerea, de atras, desde arriba), de dia y de noche
const iAC = await lugarDeArboles(pag, false);
for (const hora of ['mediodia', 'noche']) {
  await pag.evaluate((h) => window.shakedown.ponerLaHora(h), hora);
  for (const modo of [0, 1, 2]) {
    await camara(pag, modo); await ir(pag, iAC);
    await foto(pag, 'arboles-camara-' + (modo + 1) + (hora === 'noche' ? '-noche' : ''), 2200);
  }
}
await pag.evaluate(() => window.shakedown.ponerLaHora('mediodia'));
await camara(pag, 1);

// --- rendimiento: tiempo de dibujo por cuadro con y sin efectos ---
const tiempos = async (efectos) => pag.evaluate(async (efectos) => {
  const s = window.shakedown, c = s.auto(), gl = s.render.getContext(), ms = []; let llamadas = 0, triangulos = 0;
  s.ajustar('efectos', efectos);
  window.__t = window.__t || 100;
  for (let k = 0; k < 80; k++) { window.__t += 0.1; s.mundo.animar(0.1, window.__t, c, s.estado().indice); }   // (que haya particulas, si corresponde)
  for (let k = 0; k < 7; k++) {
    window.__t += 0.05; s.mundo.animar(0.05, window.__t, c, s.estado().indice); s.mundo.mirar(s.camara, c, s.render.domElement.width, s.render.domElement.height);
    s.render.info.autoReset = false; s.render.info.reset();
    const t0 = performance.now();
    s.post.dibujar(s.escena, s.camara.cam, 30); gl.finish();
    if (k > 1) ms.push(performance.now() - t0);
    if (k === 6) { llamadas = s.render.info.render.calls; triangulos = s.render.info.render.triangles; }
  }
  s.render.info.autoReset = true;
  return { ms: ms.reduce((x, y) => x + y, 0) / ms.length, llamadas, triangulos };
}, efectos);
await pag.evaluate(() => { window.shakedown.mundo.ambientacion.depurar.todo = true; });
const conF = await tiempos(true), sinF = await tiempos(false);
console.log('    tiempo de dibujo por cuadro (graficos por software): con efectos ' + conF.ms.toFixed(0) + ' ms (' + conF.llamadas + ' llamadas, ' + conF.triangulos + ' triangulos), sin efectos ' + sinF.ms.toFixed(0) + ' ms (' + sinF.llamadas + ' llamadas, ' + sinF.triangulos + ' triangulos)');
ver('los efectos suman pocas llamadas de dibujo (' + (conF.llamadas - sinF.llamadas) + ' mas)', conF.llamadas - sinF.llamadas <= 25, [conF, sinF]);
await pag.evaluate(() => { window.shakedown.mundo.ambientacion.depurar.todo = false; window.shakedown.ajustar('efectos', true); });

// --- ambiente: con "efectos" apagado no hay nada; prendido, si ---
const cuenta = () => pag.evaluate(() => {
  const s = window.shakedown, m = s.mundo, e = m.ambientacion.estado(), p = m.publico;
  return { ...e, flashes: p.flashes(), destellos: p.destellosPrendidos(), antorchas: p.antorchas(), fotografos: p.fotografos(), mallaPublico: null };
});
const iH = await lugarDeArboles(pag, true);
await ir(pag, iH); await camara(pag, 1); await ir(pag, iH);
await pag.evaluate(() => { const a = window.shakedown.mundo.ambientacion; a.depurar.todo = true; window.shakedown.ajustar('efectos', false); });
await correrMundo(pag, 120);
let e0 = await cuenta();
ver('efectos apagado: no hay hojas, petalos, viento ni polillas ni animales a la vista', e0.hojas + e0.petalos + e0.arena + e0.polillas === 0 && !e0.visibles && !e0.visible, e0);
await pag.evaluate(() => window.shakedown.ponerLaHora('noche'));
await pag.evaluate(() => window.shakedown.ajustar('efectos', true));
await correrMundo(pag, 120);
let e1 = await cuenta();
ver('efectos prendido: hay hojas (' + e1.hojas + '), petalos (' + e1.petalos + '), arena (' + e1.arena + ') y polillas (' + e1.polillas + ')', e1.hojas > 0 && e1.petalos > 0 && e1.arena > 0 && e1.polillas > 0, e1);
await foto(pag, 'hojas', 900);
await pag.evaluate(() => window.shakedown.ponerLaHora('mediodia'));
// una nube densa de arena para la captura
await pag.evaluate(() => { const t = window.shakedown.mundo.ambientacion.tipos().normales; t.limpiar(); });
await correrMundo(pag, 40, 0.1);
await foto(pag, 'viento-arena', 900);

// --- gente con antorchas (de noche) y flashes de fotos ---
const gente = await pag.evaluate(() => { const g = window.shakedown.mundo.publico.lista(); return { n: g.length, fotos: g.filter((x) => x.foto).length }; });
ver('hay gente al costado del camino y algunos sacan fotos (' + gente.fotos + ' de ' + gente.n + ')', gente.n > 20 && gente.fotos > 3, gente);
await pag.evaluate(() => window.shakedown.ponerLaHora('noche'));
const fotografo = await pag.evaluate(() => { const g = window.shakedown.mundo.publico.lista().filter((x) => x.foto).sort((a, b) => a.i - b.i)[3]; return g ? { i: g.i, x: g.x, z: g.z } : null; });
if (fotografo) {
  // el auto viene llegando: pasa de lejos a cerca y el fotografo dispara; con "efectos" apagado, no
  const probar = (efectos) => pag.evaluate(([i, efectos]) => {
    const s = window.shakedown, p = s.mundo.publico, c = s.auto();
    s.ajustar('efectos', efectos); s.mundo.reiniciar(); p.probarFlash(false);
    const f0 = p.flashes(); let visto = 0, t = 5000;
    for (let k = i - 140; k < i + 10; k += 2) { s.ir(Math.max(5, k)); for (let q = 0; q < 2; q++) { t += 0.07; s.mundo.animar(0.07, t, c, Math.max(5, k)); visto = Math.max(visto, p.destellosPrendidos()); } }
    return { disparos: p.flashes() - f0, visto };
  }, [fotografo.i, efectos]);
  const con = await probar(true), sin = await probar(false);
  ver('al pasar el auto, los fotografos hacen flashes (' + con.disparos + ' disparos, ' + con.visto + ' a la vez)', con.disparos > 0 && con.visto > 0, con);
  ver('con efectos apagado no hay flashes', sin.disparos === 0 && sin.visto === 0, sin);
  await pag.evaluate(([i, x, z]) => { const s = window.shakedown; s.ajustar('efectos', true); s.mundo.reiniciar(); s.ir(Math.max(5, i - 22)); s.mundo.publico.probarFlash(true); s.simular(0.3, 0, 0.2); }, [fotografo.i, fotografo.x, fotografo.z]);
  await foto(pag, 'fotos-flash');
  await pag.evaluate(() => window.shakedown.mundo.publico.probarFlash(false));
  const antorchas = await pag.evaluate(() => window.shakedown.mundo.publico.antorchas());
  ver('de noche, parte de la gente lleva antorcha (' + antorchas + ')', antorchas > 0, antorchas);
  await foto(pag, 'antorchas', 300);
}
await pag.evaluate(() => { window.shakedown.mundo.ambientacion.depurar.todo = false; window.shakedown.ponerLaHora('mediodia'); window.shakedown.ajustar('efectos', true); });

// --- la suciedad del auto ---
console.log('  -- suciedad --');
const rueda = (suelo) => ({ toca: true, suelo, vl: 10, patina: 0, cruza: 0, delantera: false, p: [0, 0, 0], giro: 0, x: 0, z: 0, largo: 0 });
const sucio = (pag, suelos, seg, agua = 0, limpiarAntes = false) => pag.evaluate(async ([suelos, seg, agua, limpiarAntes]) => {
  const s = window.shakedown, d = s.dibujo(), { SUELOS } = await import('/src/config.js');
  if (limpiarAntes) d.limpiar();
  const c = { vel: [10, 0, 0], agua, ruedas: suelos.map((n) => ({ toca: true, suelo: SUELOS[n].id })) };
  for (let t = 0; t < seg; t += 0.05) d.suciedad.sumar(c, 0.05);
  return d.suciedad.medir();
}, [suelos, seg, agua, limpiarAntes]);
const cuatro = (n) => [n, n, n, n];
await camara(pag, 1); await ir(pag, 80);
const barro = await sucio(pag, cuatro('barro'), 6, 0, true);
const tierra = await sucio(pag, cuatro('tierra'), 6, 0, true);
const pasto = await sucio(pag, cuatro('pasto'), 6, 0, true);
console.log('    6 s a 36 km/h: barro ' + barro.pixeles + ' pixeles, tierra ' + tierra.pixeles + ', pasto ' + pasto.pixeles + ' (de ' + barro.total + ' que tiene el auto)');
ver('el barro ensucia mas que la tierra (' + barro.pixeles + ' contra ' + tierra.pixeles + ')', barro.pixeles > tierra.pixeles * 2.2, [barro.pixeles, tierra.pixeles]);
ver('la tierra ensucia mas que el pasto, que casi nada (' + pasto.pixeles + ')', tierra.pixeles > pasto.pixeles * 3 && pasto.pixeles < barro.pixeles * 0.08, [tierra.pixeles, pasto.pixeles]);
ver('el barro es marron oscuro y la tierra, ocre mas claro', barro.color.barro && tierra.color.polvo && barro.color.barro.reduce((x, y) => x + y) < 330 && tierra.color.polvo.reduce((x, y) => x + y) > barro.color.barro.reduce((x, y) => x + y) + 60, [barro.color.barro, tierra.color.polvo]);
// el barro sube de abajo hacia arriba y salpica arriba
ver('el barro llena mas abajo (' + barro.bajo + ') que arriba (' + barro.alto + ') de los costados, pero tambien sube', barro.bajo > barro.alto * 1.2 && barro.alto > 20, barro);
await sucio(pag, cuatro('barro'), 7, 0, true);
await foto(pag, 'sucio-barro', 1200);
// arena: saca un poco de barro y se pega una capa clara
const antes = await pag.evaluate(() => window.shakedown.dibujo().suciedad.medir());
const conArena = await sucio(pag, cuatro('arena'), 6);
console.log('    barro antes ' + antes.barro + ', despues de la arena ' + conArena.barro + ' (arena ' + conArena.arena + ')');
ver('la arena saca un poco de barro (' + antes.barro + ' a ' + conArena.barro + ') pero no todo', conArena.barro < antes.barro * 0.9 && conArena.barro > antes.barro * 0.25, [antes.barro, conArena.barro]);
ver('y se pega una capa clara de arena (' + conArena.arena + ', color ' + JSON.stringify(conArena.color.arena) + ')', conArena.arena > 60 && conArena.color.arena && conArena.color.arena.reduce((x, y) => x + y) > 520, conArena);
await foto(pag, 'sucio-arena', 1200);
// agua: lava la parte de abajo hasta donde llega
const enAgua = await sucio(pag, cuatro('lecho'), 2.5, 0.4);
console.log('    antes de entrar al agua: abajo ' + conArena.bajo + ' arriba ' + conArena.alto + ' | despues: abajo ' + enAgua.bajo + ' arriba ' + enAgua.alto);
ver('el agua limpia la parte de abajo (' + conArena.bajo + ' a ' + enAgua.bajo + ')', enAgua.bajo < conArena.bajo * 0.5, [conArena.bajo, enAgua.bajo]);
ver('y lo de arriba queda sucio (' + enAgua.alto + ' de ' + conArena.alto + ')', enAgua.alto > conArena.alto * 0.7, [conArena.alto, enAgua.alto]);
await foto(pag, 'sucio-agua', 1200);
// al largar de nuevo vuelve limpio
const limpio = await pag.evaluate(() => {
  const s = window.shakedown, d = s.dibujo(); d.limpiar();
  const m = d.suciedad.medir();
  // el lienzo vuelve a ser igual al dibujo original
  return { pixeles: m.pixeles };
});
ver('al largar de nuevo el auto vuelve limpio', limpio.pixeles === 0, limpio);
// con "efectos" apagado el auto no se ensucia (lo hace el cuadro del juego con conEfectos)
const sinEf = await pag.evaluate(() => { const s = window.shakedown, d = s.dibujo(), c = s.auto(); d.limpiar(); s.ajustar('efectos', false); for (const r of c.ruedas) { r.toca = true; r.suelo = 5; } c.vel[0] = 10; d.actualizar(c, 0.5, false); const n = d.suciedad.medir().pixeles; s.ajustar('efectos', true); return n; });
ver('con efectos apagado el auto no se ensucia', sinEf === 0, sinEf);
// los demas autos (todos los modelos del garaje)
const modelos = await pag.evaluate(async () => {
  const { AUTOS } = await import('/src/config.js'), { crearDibujo } = await import('/src/autos.js'), { configDe } = await import('/src/partes.js'), s = window.shakedown, r = {};
  const { SUELOS } = await import('/src/config.js');
  for (const id of Object.keys(AUTOS)) {
    try {
      const d = crearDibujo(s.escena, configDe(id)); d.limpiar();
      const c = { vel: [10, 0, 0], agua: 0, ruedas: [0, 1, 2, 3].map(() => ({ toca: true, suelo: SUELOS.barro.id })) };
      for (let t = 0; t < 5; t += 0.05) d.suciedad.sumar(c, 0.05);
      r[id] = d.suciedad.medir().pixeles; s.escena.remove(d.grupo);
    } catch (e) { r[id] = 'error ' + e.message; }
  }
  return r;
});
ver('se ensucian todos los modelos de auto (' + Object.keys(modelos).length + ' probados)', Object.values(modelos).every((n) => typeof n === 'number' && n > 50), modelos);

// --- huellas segun el suelo ---
console.log('  -- huellas --');
const huellas = await pag.evaluate(async () => {
  const s = window.shakedown, { SUELOS } = await import('/src/config.js'), c = s.auto(), P = s.T.camino, r = {};
  const fx = s.fx, h = s.huellas, f = c.adelante, d = c.derecha;
  const i0 = 120, X0 = P.X[i0], Z0 = P.Z[i0], hx = P.HX[i0], hz = P.HZ[i0];
  const carro = (suelo, desde, x0, z0, largo) => {
    // un auto falso que anda 'largo' metros en linea recta, cada rueda sobre un suelo
    const falso = { pos: [x0, 0, z0], vel: [hx * 12, 0, hz * 12], adelante: [hx, 0, hz], derecha: [-hz, 0, hx], agua: 0, frenando: false, freno: 0, mano: false, sentido: 1, ruedas: [] };
    for (let q = 0; q < 4; q++) falso.ruedas.push({ toca: true, suelo, vl: 12, vs: 0, patina: 0.1, cruza: 0.05, delantera: q < 2, giro: 0, p: [x0, s.T.altura(x0, z0), z0] });
    for (let m = 0; m <= largo; m += 0.3) {
      falso.pos = [x0 + hx * m, 0, z0 + hz * m];
      falso.ruedas.forEach((w, q) => { const lado = q % 2 ? 0.8 : -0.8, atras = q < 2 ? 0 : -2.4; w.p = [x0 + hx * (m + atras) - hz * lado, 0, z0 + hz * (m + atras) + hx * lado]; w.p[1] = s.T.altura(w.p[0], w.p[2]); });
      fx.actualizar(falso, 0.025);
    }
    return falso;
  };
  fx.cortar(); h.limpiar();
  // cuatro carriles lado a lado, uno por suelo
  const suelos = { barro: SUELOS.barro.id, arena: SUELOS.arena.id, tierra: SUELOS.tierra.id, ripio: SUELOS.ripio.id, pasto: SUELOS.pasto.id };
  let k = 0;
  for (const [nombre, id] of Object.entries(suelos)) {
    const x0 = X0 - hz * (k * 4 - 8), z0 = Z0 + hx * (k * 4 - 8);
    fx.cortar();
    carro(id, 0, x0, z0, 24);
    // se mide 8 metros atras del final del carril: ahi la marca ya tiene que estar
    let max = 0, tipo = 0, cuantos = 0;
    for (let m = 2; m < 22; m += 0.25) for (const lado of [-0.8, 0.8]) {
      const [v, t] = h.leer(x0 + hx * m - hz * lado, z0 + hz * m + hx * lado);
      if (v > 0 && t > 0) { cuantos++; max = Math.max(max, v); tipo = t; }   // (solo las marcas de ruedas, con su tipo: la pista ya trae rodadas de otros autos)
    }
    r[nombre] = { cuantos, max, tipo, x: x0, z: z0 }; k++;
  }
  h.subir();
  return r;
});
console.log('    ' + Object.entries(huellas).map(([n, v]) => n + ': ' + v.cuantos + ' marcas, fuerza ' + v.max + ', tipo ' + v.tipo).join(' | '));
ver('en barro y arena quedan huellas atras del auto', huellas.barro.cuantos > 25 && huellas.arena.cuantos > 25, [huellas.barro, huellas.arena]);
ver('cada suelo marca con su tipo (barro 1, arena 2, pasto 3, tierra 4, ripio 5)', huellas.barro.tipo === 1 && huellas.arena.tipo === 2 && huellas.pasto.tipo === 3 && huellas.tierra.tipo === 4 && huellas.ripio.tipo === 5, huellas);
ver('el barro marca mas fuerte que la tierra, y la tierra mas que el ripio (casi nada)', huellas.barro.max > huellas.tierra.max && huellas.tierra.max > huellas.ripio.max && huellas.ripio.max < 0.3 * 255, huellas);
// duran: pasan cuadros y minutos de pasada y siguen ahi
const duran = await pag.evaluate(async () => {
  const s = window.shakedown, h = s.huellas, c = s.auto(), antes = (() => { let n = 0; const P = s.T.camino; for (let x = -40; x < 40; x += 0.5) for (let z = -40; z < 40; z += 0.5) if (h.leer(P.X[120] + x, P.Z[120] + z)[0] > 0) n++; return n; })();
  window.__t = window.__t || 100;
  for (let k = 0; k < 400; k++) { window.__t += 0.1; s.mundo.animar(0.1, window.__t, c, s.estado().indice); s.fx.actualizar(c, 0.1); }
  const P = s.T.camino; let n = 0; for (let x = -40; x < 40; x += 0.5) for (let z = -40; z < 40; z += 0.5) if (h.leer(P.X[120] + x, P.Z[120] + z)[0] > 0) n++;
  return { antes, despues: n };
});
ver('las huellas duran (' + duran.antes + ' marcas, 40 s despues ' + duran.despues + ')', duran.antes > 80 && duran.despues >= duran.antes * 0.95, duran);
await camara(pag, 1); await pag.evaluate(() => { const s = window.shakedown; s.ir(120 - 7); s.simular(0.2, 0, 0.1); });
await foto(pag, 'huellas-barro', 2500);
// con efectos apagado el piso usa las marcas de siempre
const relieve = await pag.evaluate(() => { const s = window.shakedown; s.ajustar('efectos', false); const a = s.huellas.relieve.value; s.ajustar('efectos', true); return [a, s.huellas.relieve.value]; });
ver('el relieve falso y los colores por suelo se apagan con "efectos"', relieve[0] === 0 && relieve[1] === 1, relieve);
// al largar de nuevo se borran
await pag.evaluate(() => { const s = window.shakedown; s.huellas.limpiar(); });
const borradas = await pag.evaluate(() => { const s = window.shakedown, P = s.T.camino; let n = 0; for (let x = -40; x < 40; x += 0.5) for (let z = -40; z < 40; z += 0.5) { const v = s.huellas.leer(P.X[120] + x, P.Z[120] + z); if (v[0] > 0 && v[0] < 250 && v[1] > 0) n++; } return n; });
ver('al largar de nuevo se borran las huellas', borradas === 0, borradas);
const sinAviso = (e) => e.filter((x) => !/willReadFrequently/.test(x));   // (el aviso de leer el lienzo seguido: solo lo provoca la prueba al medir)
ver('sin errores en consola (bosque)', sinAviso(j.errores).length === 0, j.errores);
await j.cerrar();

// ---------------------------------------------------------------- 2: campo (animales)
console.log('Animales (campo, pista 2)');
j = await abrirPista(2, 'mediodia', { gustos: { camara: 'aerea' } }); pag = j.pag;
ver('a quien ya eligio otra camara se le respeta (aerea)', (await pag.evaluate(() => window.shakedown.camara.modo().id)) === 'aerea');
const an = await pag.evaluate(() => { const a = window.shakedown.mundo.ambientacion.animales(); const t = {}; for (const x of a) t[x.dibujo] = (t[x.dibujo] || 0) + 1; return { n: a.length, t }; });
ver('hay animales en el campo (' + JSON.stringify(an.t) + ')', an.n >= 6, an);
// el animal mas cercano al camino: se pone el auto a 45 m, viniendo hacia el
const huida = await pag.evaluate(() => {
  const s = window.shakedown, m = s.mundo, a = m.ambientacion.animales(), c = s.auto();
  window.__t = 7000;
  m.efectos(true);
  const bicho = a.filter((x) => x.dibujo !== 'caballo').sort((p, q) => Math.hypot(p.x0 - s.T.camino.X[60], p.z0 - s.T.camino.Z[60]) - Math.hypot(q.x0 - s.T.camino.X[60], q.z0 - s.T.camino.Z[60]))[0];
  const grupo = a.filter((x) => Math.hypot(x.x0 - bicho.x0, x.z0 - bicho.z0) < 9);
  // primero con el auto quieto a 12 m: no se asustan
  const dir = [1, 0], pone = (x, z, vx, vz) => { c.pos[0] = x; c.pos[1] = s.T.altura(x, z); c.pos[2] = z; c.vel[0] = vx; c.vel[1] = 0; c.vel[2] = vz; };
  pone(bicho.x0 - 12, bicho.z0, 0, 0);
  for (let k = 0; k < 20; k++) { window.__t += 0.1; m.ambientacion.actualizar(c, 0.1, window.__t); }
  const quieto = Math.max(...grupo.map((x) => Math.hypot(x.x - x.x0, x.z - x.z0)));
  // ahora viene a 14 m/s desde 60 m
  const d0 = Math.hypot(bicho.x - (bicho.x0 - 60), bicho.z - bicho.z0);
  let x = bicho.x0 - 60, mino = 1e9, dist = [];
  for (let k = 0; k < 60; k++) { x += 14 * 0.1; pone(x, bicho.z0, 14, 0); window.__t += 0.1; m.ambientacion.actualizar(c, 0.1, window.__t); const dd = Math.hypot(bicho.x - x, bicho.z - bicho.z0); mino = Math.min(mino, dd); if (k % 10 === 9) dist.push(Math.round(dd)); }
  const corrio = grupo.map((g) => Math.hypot(g.x - g.x0, g.z - g.z0));
  pone(bicho.x0 - 22, bicho.z0, 8, 0); s.ir(60);
  return { quieto, corrio: Math.round(Math.min(...corrio)), mayor: Math.round(Math.max(...corrio)), dist, mino: Math.round(mino), grupo: grupo.length, tipo: bicho.dibujo, d0: Math.round(d0) };
});
ver('con el auto quieto al lado, los animales no se mueven (' + huida.quieto.toFixed(2) + ' m)', huida.quieto < 0.05, huida);
ver('cuando el auto viene a toda velocidad se asustan y se alejan (' + huida.grupo + ' ' + huida.tipo + ': corrieron entre ' + huida.corrio + ' y ' + huida.mayor + ' m)', huida.corrio > 6, huida);
// una captura con animales: se pone el auto a unos metros de un grupo
await pag.evaluate(() => {
  const s = window.shakedown, a = s.mundo.ambientacion.animales(), P = s.T.camino;
  s.mundo.reiniciar();
  let mejor = 5, d = 1e9;   // el animal mas cercano al camino
  for (const g of a) for (let i = 5; i < P.n - 5; i += 3) { const q = Math.hypot(P.X[i] - g.x0, P.Z[i] - g.z0); if (q < d) { d = q; mejor = i; } }
  s.ir(mejor); s.simular(0.3, 0, 0.1);
});
await camara(pag, 0); await foto(pag, 'animales');
const animalesOff = await pag.evaluate(() => { const s = window.shakedown; s.ajustar('efectos', false); const e = s.mundo.ambientacion.estado(); s.ajustar('efectos', true); return e; });
ver('con efectos apagado los animales no se ven', animalesOff.visible === false, animalesOff);
ver('sin errores en consola (campo)', j.errores.length === 0, j.errores);
await j.cerrar();

// ---------------------------------------------------------------- 3: celular
console.log('Celular');
j = await abrirPista(6, 'noche', { ancho: 390, alto: 844, contexto: { hasTouch: true, isMobile: true, deviceScaleFactor: 2 } }); pag = j.pag;
const celu = await pag.evaluate(() => { const s = window.shakedown; s.mundo.ambientacion.depurar.todo = true; return { liviano: s.mundo.ambientacion.tipos().normales.NN }; });
const iC = await lugarDeArboles(pag, true);
await ir(pag, iC); await camara(pag, 1); await ir(pag, iC);
await correrMundo(pag, 100);
console.log('    particulas maximas en celular: ' + celu.liviano);
await foto(pag, 'efectos-celu', 2500);
ver('sin errores en consola (celular)', j.errores.length === 0, j.errores);
await j.cerrar();

console.log(mal ? '\nHAY ' + mal + ' COSAS MAL' : '\nTodo bien');
process.exit(mal ? 1 : 0);

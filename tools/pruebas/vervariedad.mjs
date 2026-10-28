// La variedad de arboles por bioma. Saca:
//  - out/variedad-muestra.png: todos los tipos de arbol en fila (3 versiones cada uno) sobre fondo liso, tal como estan en el atlas;
//  - out/variedad-bosque / campo / montana / pueblo / travesia .png: de dia, con la camara de atras y la aerea (una al lado de la otra).
// Revisa que haya mas de un tipo por bioma, que los de adorno no choquen (no estan en t.cosas) y que no haya errores en consola.
// uso: node tools/pruebas/vervariedad.mjs [muestra|travesia]     (con "muestra" solo hace la lamina; con "travesia", solo esa)
import fs from 'node:fs';
import { abrir } from './ver.mjs';
import { createRequire } from 'node:module';
const traer = (n) => { const req = createRequire(import.meta.url); try { return req(n); } catch (e) { return req('/opt/npm-tools/node_modules/' + n); } };
const sharp = traer('sharp');
fs.mkdirSync('out', { recursive: true });
let mal = 0;
const ver = (que, si, detalle) => { console.log((si ? '  ok  ' : '  MAL ') + que + (si || detalle === undefined ? '' : ' -> ' + JSON.stringify(detalle))); if (!si) mal++; };

async function abrirPista(ruta, hora) {
  const j = await abrir({ ruta });
  if (!j.cargo) { console.log('NO CARGO\n' + j.errores.join('\n')); process.exit(1); }
  await j.pag.evaluate((h) => { const s = window.shakedown; s.largar(); if (h) s.ponerLaHora(h); s.avanzar(4); }, hora);
  return j;
}
async function camara(pag, modo) {
  for (let k = 0; k < 4 && (await pag.evaluate(() => window.shakedown.camara.estado.modo)) !== modo; k++) await pag.keyboard.press('KeyC');
  await pag.evaluate(async () => {
    const { CAMARAS } = await import('/src/config.js'), e = window.shakedown.camara.estado, m = CAMARAS[e.modo];
    e.dist = m.dist[0] * e.cerca; e.alto = m.alto[0]; e.fov = Math.min(e.parada && m.fovParado ? m.fovParado : 56, 2 * Math.atan(Math.tan(m.fov * Math.PI / 360) * e.ancha) * 180 / Math.PI); e.listo = false;
  });
}
const ir = (pag, i) => pag.evaluate((i) => { const s = window.shakedown; s.ir(i); s.simular(0.3, 0, 0.2); }, i);
const captura = async (pag, nombre, espera = 2200) => { await pag.waitForTimeout(espera); const b = await pag.screenshot(); fs.writeFileSync('/tmp/' + nombre, b); return b; };
// dos capturas (atras y aerea) una al lado de la otra
async function par(pag, i, nombre) {
  await camara(pag, 1); await ir(pag, i); const a = await captura(pag, nombre + '-a.png');
  await camara(pag, 0); await ir(pag, i); const b = await captura(pag, nombre + '-b.png');
  const m = await sharp(a).metadata(), w = Math.round(m.width / 2), h = Math.round(m.height / 2);
  const A = await sharp(a).resize(w, h).toBuffer(), B = await sharp(b).resize(w, h).toBuffer();
  await sharp({ create: { width: w * 2, height: h, channels: 3, background: '#000' } }).composite([{ input: A, left: 0, top: 0 }, { input: B, left: w, top: 0 }]).png().toFile('out/' + nombre + '.png');
  console.log('    captura out/' + nombre + '.png');
}
// el metro del camino con mas variedad de dibujos de arbol (de los colocados) a menos de 40 m
const lugarVariado = (pag) => pag.evaluate(() => {
  const s = window.shakedown, P = s.T.camino, M = [];
  s.escena.traverse((o) => { if (o.isInstancedMesh && o.userData.arboles) M.push(o); });
  let mejor = -1, mi = 40; const e = new s.escena.matrix.constructor();
  const pts = []; for (const o of M) for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, e); pts.push([e.elements[12], e.elements[14], (e.elements[5] / e.elements[0]).toFixed(1)]); }
  for (let i = 30; i < P.n - 40; i += 10) {
    const q = new Set(); let n = 0;
    for (const [x, z, t] of pts) if (Math.hypot(x - P.X[i], z - P.Z[i]) < 38) { q.add(t); n++; }
    const v = q.size * 10 + Math.min(n, 60);
    if (v > mejor) { mejor = v; mi = i; }
  }
  return mi;
});
// cuantos de cada tipo hay en la pista, por ambiente (flora.js los anota; los de adorno llevan * al final)
const tiposEn = (pag) => pag.evaluate(() => window.shakedown.mundo.flora.tipos);

// ---------------- la lamina de muestra ----------------
{
  const j = await abrir({ ruta: '?p=6&futuro' });
  if (!j.cargo) { console.log('NO CARGO\n' + j.errores.join('\n')); process.exit(1); }
  const dataUrl = await j.pag.evaluate(async () => {
    const { dibujos, TIPOS_DE_ARBOL } = await import('/src/arboles.js'), d = dibujos(), E = 3, GAP = 10, FILA = 280;
    const grupos = [['Bosque', ['roble', 'robleBajo', 'abeto', 'abedul', 'arbustoRedondo', 'pino', 'pinoAlto']], ['Campo', ['alamo', 'alamoOtono', 'sauce', 'eucalipto', 'eucaliptoAlto', 'ombu']], ['Montana', ['lenga', 'lengaRoja', 'nire', 'lengaMarron', 'secoRetorcido', 'araucaria', 'pinoViento', 'arbustoOtono', 'seco']], ['Pueblo y Travesia', ['platano', 'palmera', 'acacia', 'acaciaChica', 'matoSeco', 'matoEspina']]];
    const c = document.createElement('canvas'); c.width = 2400; c.height = FILA * grupos.length + 30; const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
    x.fillStyle = '#8a8d86'; x.fillRect(0, 0, c.width, c.height);
    x.font = '14px sans-serif'; x.fillStyle = '#222';
    const faltan = TIPOS_DE_ARBOL.filter((t) => !grupos.some((g) => g[1].includes(t)));
    grupos.forEach(([nombre, tipos], gi) => {
      let px = 12; const base = gi * FILA + FILA - 26; x.fillText(nombre, 8, gi * FILA + 18);
      for (const t of tipos) {
        const x0 = px;
        for (const z of d.zonas[t]) { x.drawImage(d.atlas.lienzo, z.x, z.y, z.w, z.h, px, base - z.h * E, z.w * E, z.h * E); px += z.w * E + GAP; }
        x.fillStyle = '#222'; x.fillText(t, x0, base + 16); px += GAP;
      }
    });
    return { url: c.toDataURL('image/png'), faltan };
  });
  if (dataUrl.faltan.length) console.log('  (sin lugar en la lamina: ' + dataUrl.faltan.join(', ') + ')');
  fs.writeFileSync('out/variedad-muestra.png', Buffer.from(dataUrl.url.split(',')[1], 'base64'));
  console.log('    captura out/variedad-muestra.png');
  ver('sin errores al armar el atlas', j.errores.length === 0, j.errores);
  await j.cerrar();
}
if (process.argv[2] === 'muestra') process.exit(mal ? 1 : 0);
const SOLO = process.argv[2];

// ---------------- cada bioma, de dia ----------------
// [nombre, pista, ambiente, cuantos tipos distintos tiene que haber (con los de adorno)]
const CASOS = [['bosque', 6, 'bosque', 6], ['campo', 2, 'campo', 4], ['montana', 5, 'montana', 5], ['pueblo', 16003, 'campo', 3]];
for (const [nombre, pista, ambiente, minimo] of CASOS) {
  if (SOLO === 'travesia') break;
  console.log('Bioma: ' + nombre + ' (pista ' + pista + ')');
  const j = await abrirPista('?p=' + pista + '&futuro', 'mediodia'), { pag } = j;
  const t = await tiposEn(pag), tipos = Object.keys(t[ambiente] || {}), limpios = new Set(tipos.map((x) => x.replace('*', '')));
  ver(nombre + ': ' + limpios.size + ' tipos distintos (' + [...limpios].join(', ') + ')', limpios.size >= minimo, t);
  const r = await pag.evaluate(() => {
    const s = window.shakedown; let sueltos = 0, total = 0;
    s.escena.traverse((o) => { if (o.isInstancedMesh && o.userData.arboles) { total += o.count; sueltos += o.userData.sueltos || 0; } });
    return { total, sueltos, chocan: s.T.cosas.filter((o) => o.clase === 'arbol' && o.tipo !== 'arbusto').length, rodeados: 0 };
  });
  ver(nombre + ': los de adorno no chocan y son pocos (' + r.sueltos + ' de adorno, ' + r.chocan + ' que chocan)', r.total === r.chocan + r.sueltos && r.sueltos <= r.chocan * 0.4 + 25, r);
  await par(pag, await lugarVariado(pag), 'variedad-' + nombre);
  ver(nombre + ': sin errores en consola', j.errores.length === 0, j.errores.slice(0, 3));
  await j.cerrar();
}

// ---------------- la Travesia ----------------
{
  console.log('Travesia');
  const j = await abrir({ ruta: '?futuro' });
  if (!j.cargo) { console.log('NO CARGO\n' + j.errores.join('\n')); process.exit(1); }
  const { pag } = j;
  await pag.waitForFunction(() => !document.documentElement.classList.contains('cargando'), null, { timeout: 90000 });
  const { irACard } = await import('./ver.mjs');
  await pag.evaluate(() => { window.shakedown.ajustar('trazada', false); });
  await irACard(pag, 'travesia', false);
  await pag.click('#largarTravesia');
  await pag.waitForFunction(() => window.shakedown.travesia.estado().activa, null, { timeout: 90000 });
  await pag.evaluate(() => { const t = window.shakedown.travesia; t.avanzar(3.3); t.depuracion.invulnerable = true; t.depuracion.piloto = true; });
  // se avanza de a poco (esperando que la camara siga al auto) hasta tener una acacia cerca, para que se vea en la captura
  let cerca = -1;
  for (let k = 0; k < 40 && cerca < 0; k++) {
    await pag.evaluate(() => window.shakedown.travesia.avanzar(5, { piloto: true }));
    await pag.waitForTimeout(1600);
    cerca = await pag.evaluate(() => {
      const t = window.shakedown.travesia, M = new t.escena.matrix.constructor(), c = { x: t.auto().pos[0], z: t.auto().pos[2] }, V = new t.escena.position.constructor(); let mejor = 1e9;
      t.escena.updateMatrixWorld(true);
      t.escena.traverse((o) => { if (o.isInstancedMesh && o.userData.travesia) for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, M); if (Math.hypot(M.elements[0], M.elements[1], M.elements[2]) < 3) continue;
        V.set(M.elements[12], M.elements[13], M.elements[14]).applyMatrix4(o.matrixWorld);
        const d = Math.hypot(V.x - c.x, V.z - c.z); if (d < mejor) mejor = d;
      } });
      return mejor > 9 && mejor < 28 ? mejor : -1;
    });
  }
  console.log('    acacia a ' + Math.round(cerca) + ' m de la camara');
  const n = await pag.evaluate(() => { let acacias = 0, matos = 0, arboles = 0; window.shakedown.travesia.escena.traverse((o) => { if (o.isInstancedMesh && o.userData.travesia) { arboles++; acacias += o.count; } }); return { arboles, acacias }; });
  ver('las acacias y matas de la Travesia son planos cruzados (' + n.acacias + ' en ' + n.arboles + ' dibujos)', n.acacias > 0, n);
  await pag.waitForTimeout(1200);
  const a = await pag.screenshot();
  fs.writeFileSync('/tmp/trav-a.png', a);
  await pag.keyboard.press('KeyC'); await pag.waitForTimeout(1500);
  const b = await pag.screenshot();
  const m = await sharp(a).metadata(), w = Math.round(m.width / 2), h = Math.round(m.height / 2);
  await sharp({ create: { width: w * 2, height: h, channels: 3, background: '#000' } }).composite([{ input: await sharp(a).resize(w, h).toBuffer(), left: 0, top: 0 }, { input: await sharp(b).resize(w, h).toBuffer(), left: w, top: 0 }]).png().toFile('out/variedad-travesia.png');
  console.log('    captura out/variedad-travesia.png');
  ver('Travesia sin errores en consola', j.errores.length === 0, j.errores.slice(0, 3));
  await j.cerrar();
}
console.log(mal ? mal + ' MAL' : 'todo bien');
process.exit(mal ? 1 : 0);

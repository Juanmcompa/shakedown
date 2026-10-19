// La Travesia vista de cerca: saca las capturas del desierto (arena y dunas con la polvareda, piedras negras, acacias y rocas al
// fondo, las 3 cartas de problemas y la pantalla de un celular) y controla que haya de que sacarlas: acacias, formaciones de roca,
// piedras negras, huellas marcadas y una polvareda grande detras del auto.
// uso: node tools/pruebas/verdakar.mjs
// Deja out/dakar-1.png, out/dakar-2.png, out/dakar-3-cartas.png y out/dakar-celu.png. Una sola ventana a la vez.
import { abrir } from './ver.mjs';
let mal = 0;
const ver = (que, si, detalle) => { console.log((si ? '  ok  ' : '  MAL ') + que + (si || detalle === undefined ? '' : ' -> ' + JSON.stringify(detalle))); if (!si) mal++; };

async function entrar(ancho, alto, contexto) {
  const a = await abrir({ ancho, alto, contexto });
  if (!a.cargo) { console.log(a.errores); process.exit(1); }
  const P = a.pag;
  await P.waitForFunction(() => !document.documentElement.classList.contains('cargando'), null, { timeout: 90000 });
  await P.evaluate(() => window.shakedown.entrarTravesia());
  await P.waitForFunction(() => window.shakedown.travesia.estado().activa);
  await P.evaluate(() => window.shakedown.travesia.avanzar(3.3));   // (la cuenta regresiva)
  return a;
}
const sinTablero = (P) => P.evaluate(() => { const g = document.getElementById('grande'); if (g) g.hidden = true; });

// 1) arena y dunas con la polvareda, desde la camara de arriba
let a = await entrar(1280, 720, {});
let P = a.pag;
const uno = await P.evaluate(() => {
  const s = window.shakedown.travesia, T = s.T();
  T.asegurar(4000); s.saltarA(0.9); s.proxima(99);
  s.avanzar(9, { piloto: true, invulnerable: true, efectos: true });
  return { km: s.estado().km, v: s.c().velocidad * 3.6, suelo: s.c().suelo, nubes: s.fx.nubesGrandes(), marcados: s.mundo.huellas.marcados(), pedazos: s.mundo.huellas.pedazos() };
});
ver('el auto corre por la arena y deja una polvareda grande (' + uno.nubes + ' nubes)', uno.v > 20 && uno.nubes >= 12, uno);
ver('y sus huellas quedan marcadas en el piso (' + uno.marcados + ' pixeles)', uno.marcados > 300, uno);
await sinTablero(P); await P.waitForTimeout(700);
await P.screenshot({ path: 'out/dakar-1.png' });

// 2) lo que decora: se busca una formacion de roca adelante y se mira para atras con la camara de atras
const dos = await P.evaluate(() => {
  const s = window.shakedown.travesia, T = s.T();
  T.asegurar(6000);
  const cuenta = { acacias: 0, formaciones: 0, negras: 0 };
  for (const t of T.tiles.values()) { cuenta.formaciones += t.formaciones.length; cuenta.acacias += t.decor.filter((d) => /^acacia/.test(d.nombre)).length; cuenta.negras += t.decor.filter((d) => /^piedraNegra/.test(d.nombre)).length; }
  let hallada = null;
  for (let km = 0.3; km < 4.5 && !hallada; km += 0.1) {
    s.saltarA(km); s.proxima(99);
    const c = s.c(), Pt = T.camino, i = s.estado().indice, hx = Pt.HX[i], hz = Pt.HZ[i];
    for (const t of T.tiles.values()) for (const f of t.formaciones) {
      const dx = f.x - c.pos[0], dz = f.z - c.pos[2], d = Math.hypot(dx, dz);
      if (d > 80 && d < 180 && (dx * hx + dz * hz) / d > 0.8) { hallada = { km, tipo: f.tipo, d }; break; }
    }
  }
  s.camara.cambiar('atras');
  s.avanzar(2, { piloto: true, invulnerable: true, efectos: true });
  return { cuenta, hallada };
});
ver('hay acacias y piedras negras en el terreno (' + dos.cuenta.acacias + ' y ' + dos.cuenta.negras + ')', dos.cuenta.acacias >= 1 && dos.cuenta.negras >= 1, dos.cuenta);
ver('hay formaciones de roca en el terreno (' + dos.cuenta.formaciones + ' armadas)', dos.cuenta.formaciones >= 1 || !!dos.hallada, dos);
ver('se encontro una formacion a la vista para la captura', !!dos.hallada, dos);
await sinTablero(P); await P.waitForTimeout(700);
await P.screenshot({ path: 'out/dakar-2.png' });

// 3) las 3 cartas, todas problemas
const tres = await P.evaluate(() => {
  const s = window.shakedown.travesia; s.camara.cambiar('arriba');
  s.saltarA(1.9); s.proxima(2.0);
  s.avanzar(14, { piloto: true, invulnerable: true, efectos: true, hasta: () => s.estado().fase === 'cartas' });
  return { fase: s.estado().fase, mano: s.estado().mano };
});
await P.waitForTimeout(700);
const cartas = await P.evaluate(() => ({ visibles: [...document.querySelectorAll('#cartasMano .carta')].length, tipos: window.shakedown.travesia.estado().mano.map((id) => window.shakedown.travesia.cartas.CARTAS.find((c) => c.id === id).tipo) }));
ver('a los 2 km salen 3 cartas y todas son problemas', cartas.visibles === 3 && cartas.tipos.every((t) => t === 'mala'), { tres, cartas });
await P.screenshot({ path: 'out/dakar-3-cartas.png' });
await a.cerrar();

// 4) el celular
a = await entrar(390, 844, { hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
P = a.pag;
const celu = await P.evaluate(() => {
  const s = window.shakedown.travesia, T = s.T();
  T.asegurar(4000); s.saltarA(0.9); s.proxima(99);
  s.avanzar(9, { piloto: true, invulnerable: true, efectos: true });
  return { v: s.c().velocidad * 3.6, nubes: s.fx.nubesGrandes() };
});
ver('en el celular tambien hay polvareda (' + celu.nubes + ' nubes)', celu.v > 20 && celu.nubes >= 6, celu);
await sinTablero(P); await P.waitForTimeout(700);
await P.screenshot({ path: 'out/dakar-celu.png' });
ver('sin errores en la consola', a.errores.length === 0, a.errores.slice(0, 5));
await a.cerrar();

console.log(mal ? '\n' + mal + ' cosas mal' : '\ntodo bien');
process.exit(mal ? 1 : 0);

// La Travesia: el camino angosto, la arena suelta de afuera, los autos rotos y el festival de la largada.
// Mira que el camino sea una sola huella (y no se ensanche con los km), que afuera haya arena suelta que frena y obstaculos
// pegados al borde sin tapar el camino, que haya autos rotos (mas cuantos mas km) y que se choquen, y que la largada tenga arco,
// gente, carpas, autos estacionados y marcas de mentira, que se apague con el ajuste "efectos" y que se acabe a los ~400 m.
// uso: node tools/pruebas/vertravesiafiesta.mjs          (una pantalla de compu y un celular parado)
// Capturas: out/travesia-largada.png, travesia-angosto.png, travesia-roto.png y travesia-largada-celu.png
import { abrir } from './ver.mjs';
let mal = 0;
const ver = (que, si, detalle) => { console.log((si ? '  ok  ' : '  MAL ') + que + (si || detalle === undefined ? '' : ' -> ' + JSON.stringify(detalle))); if (!si) mal++; };

async function entrar(nombre, ancho, alto, contexto) {
  console.log('--- ' + nombre + ' (' + ancho + 'x' + alto + ') ---');
  const a = await abrir({ ancho, alto, contexto });
  if (!a.cargo) { console.log('NO CARGO\n' + a.errores.join('\n')); process.exit(1); }
  const P = a.pag;
  await P.waitForFunction(() => !document.documentElement.classList.contains('cargando'), null, { timeout: 90000 });
  await P.evaluate(() => { try { localStorage.removeItem('shakedown-x'); } catch (e) { /* nada */ } window.shakedown.club.gusto('travesiaKm', 0); });
  await P.click('[data-panel="circuitos"]');
  await P.waitForTimeout(300);
  await P.click('#catAventura a');
  await P.waitForFunction(() => window.shakedown.travesia.estado().activa, null, { timeout: 90000 });
  return { a, P };
}

// ---------------------------------------------------------------- la compu
{
  const { a, P } = await entrar('compu', 1280, 720);
  const f = await P.evaluate(() => window.shakedown.travesia.mundo.fiesta.contar());
  ver('la largada tiene gente (' + f.gente + '), carpas (' + f.carpas + '), autos (' + f.autos + ') y marcas de mentira', f.gente >= 60 && f.carpas >= 4 && f.autos >= 12 && f.marcas && f.marcas.chapas >= 10 && f.marcas.velas >= 10 && f.marcas.tiras === 1, f);
  const reparto = await P.evaluate(() => {
    const F = window.shakedown.travesia.T().fiesta, I = F.gente.map((g) => g.i), mitad = (F.fin + F.desde) / 2;
    return { cerca: I.filter((i) => i < mitad).length, lejos: I.filter((i) => i >= mitad).length, ultimo: Math.max(...I), fin: F.fin };
  });
  ver('la gente se va raleando y termina antes de que empiece el desierto (' + reparto.cerca + ' en la primera mitad, ' + reparto.lejos + ' en la segunda)', reparto.cerca > reparto.lejos * 1.4 && reparto.ultimo < reparto.fin, reparto);
  // nada de la fiesta tapa el camino
  const tapa = await P.evaluate(() => {
    const T = window.shakedown.travesia.T(), F = T.fiesta, P = T.camino;
    let peor = 99;
    for (const q of [...F.gente, ...F.carpas, ...F.autos]) { const i = Math.min(P.n - 1, q.i === undefined ? 0 : q.i); let m = 1e9; for (let k = 0; k < 420; k++) { const d = Math.hypot(q.x - P.X[k], q.z - P.Z[k]) - P.W[k] / 2; if (d < m) m = d; } if (m < peor) peor = m; }
    return peor;
  });
  ver('ni la gente, ni las carpas, ni los autos estan sobre el camino (el mas cerca queda a ' + tapa.toFixed(1) + ' m del borde)', tapa > 1.5, tapa);
  // despues de la cuenta, la gente grita y se corre
  await P.evaluate(() => { const s = window.shakedown.travesia; s.camara.cambiar('atras'); s.proxima(9999); s.avanzar(3.3); s.cuadro(0.05); s.avanzar(1.6, { piloto: true, efectos: true }); s.cuadro(0.05); });
  await P.waitForTimeout(500);
  await P.screenshot({ path: 'out/travesia-largada.png' });
  // los papelitos y el grito de la largada los pide el modo con festejo(): sin los efectos, no hay humo en las parrillas
  const efe = await P.evaluate(() => {
    const s = window.shakedown.travesia, m = s.mundo.fiesta;
    const humos = [];
    s.escena.traverse((o) => { if (o.isInstancedMesh && o.geometry.type === 'BoxGeometry' && o.material.transparent && Math.abs(o.material.opacity - 0.75) < 0.01) humos.push(o); });
    window.shakedown.ajustar('efectos', false); const apagado = humos.map((h) => h.visible);
    window.shakedown.ajustar('efectos', true); const prendido = humos.map((h) => h.visible);
    return { humos: humos.length, apagado, prendido };
  });
  ver('el ajuste "efectos" apaga y prende el humo de las parrillas (' + efe.humos + ')', efe.humos === 0 || (efe.apagado.every((v) => !v) && efe.prendido.every((v) => v)), efe);

  // el camino: angosto y cada vez menos ancho, pero siempre de una sola huella
  const ancho = await P.evaluate(() => {
    const T = window.shakedown.travesia.T(), P = T.camino; T.asegurar(15000);
    const m = (a, b) => { let s = 0, n = 0, mx = 0; for (let i = a; i < b; i++) { s += P.W[i]; n++; mx = Math.max(mx, P.W[i]); } return { medio: s / n, max: mx }; };
    return { largada: P.W[20], d1: m(500, 1500), d3: m(2500, 3500), d10: m(9500, 10500), d14: m(14000, 15000) };
  });
  ver('en la largada el camino es ancho (' + ancho.largada.toFixed(1) + ' m)', ancho.largada >= 9);
  ver('despues del festival es angosto: ' + ancho.d1.medio.toFixed(1) + ' m a 1 km, ' + ancho.d3.medio.toFixed(1) + ' a 3 y ' + ancho.d14.medio.toFixed(1) + ' a 14 (antes: 14, 13 y 8)', ancho.d1.medio < 7.2 && ancho.d3.medio < 7 && ancho.d14.medio < 4.6 && ancho.d14.medio < ancho.d1.medio && ancho.d1.max < 9, ancho);

  // afuera: arena suelta pegada al camino (se mira el piso sin mover el auto)
  const orilla = await P.evaluate(() => {
    const s = window.shakedown.travesia, T = s.T(), P = T.camino, o = {};
    let anchoFesh = 0, n = 0;
    for (let i = 700; i < 1100; i += 6) {
      let f = 0;
      for (let l = P.W[i] / 2 + 0.8; l < P.W[i] / 2 + 12; l += 0.5) { const x = P.X[i] - P.HZ[i] * l, z = P.Z[i] + P.HX[i] * l; T.suelo(x, z, o); if (o.id === 13) f += 0.5; }
      anchoFesh += f; n++;
    }
    return { arenaSuelta: anchoFesh / n };
  });
  ver('pegada al camino hay arena suelta (fesh-fesh): ' + orilla.arenaSuelta.toFixed(1) + ' m de ancho de cada lado, en promedio', orilla.arenaSuelta > 2 && orilla.arenaSuelta < 9, orilla);

  // lo que hay al borde: piedras y matas, mas cuanto mas lejos, y nada tapando el camino (se arma el terreno ahi sin mover el auto)
  const borde = await P.evaluate(() => {
    const s = window.shakedown.travesia, T = s.T(), P = T.camino, cuenta = (a, b) => {
      let n = 0, tapa = 0, minimo = 99;
      for (let i = a; i < b; i += 4) {
        s.mundo.mantener(P.X[i], P.Z[i], 0, true);
        const vistos = new Set();
        for (let l = -P.W[i] / 2 - 6; l <= P.W[i] / 2 + 6; l += 2) {
          const x = P.X[i] - P.HZ[i] * l, z = P.Z[i] + P.HX[i] * l;
          for (const o of T.cosasCerca(x, z) || []) { if (vistos.has(o) || !o.borde) continue; vistos.add(o); const ax = o.x - P.X[i], az = o.z - P.Z[i], lado = Math.abs(az * P.HX[i] - ax * P.HZ[i]) - P.W[i] / 2 - o.r; if (lado < 6) { n++; minimo = Math.min(minimo, lado); } if (lado < -0.05) tapa++; }
        }
      }
      return { n, tapa, minimo };
    };
    return { cerca: cuenta(600, 1000), lejos: cuenta(6000, 6400) };
  });
  ver('hay piedras y matas pegadas al borde (' + borde.cerca.n + ' cerca de la largada y ' + borde.lejos.n + ' a 6 km) y ninguna tapa el camino', borde.cerca.n >= 4 && borde.lejos.n > borde.cerca.n && borde.cerca.tapa === 0 && borde.lejos.tapa === 0, borde);

  // los autos rotos: de vez en cuando, mas seguido con los km (se miran todos los que arma el camino, antes de pasar por ellos)
  const rotos = await P.evaluate(() => {
    const s = window.shakedown.travesia, T = s.T(), P = T.camino;
    T.asegurar(14000);
    const l = T.restos().filter((o) => o.resto === 'auto').sort((a, b) => a.i - b.i);
    const entre = (a, b) => l.filter((o) => o.i >= a && o.i < b).length;
    // siempre queda lugar para pasar: del otro lado del auto roto, al menos 2,4 m libres
    let peor = 99;
    for (const o of l) {
      const ax = o.x - P.X[o.i], az = o.z - P.Z[o.i], centro = az * P.HX[o.i] - ax * P.HZ[o.i], giro = o.rumbo - Math.atan2(P.HX[o.i], -P.HZ[o.i]), medio = Math.abs(o.hx * Math.cos(giro)) + Math.abs(o.hz * Math.sin(giro));
      peor = Math.min(peor, centro > 0 ? centro - medio + P.W[o.i] / 2 : P.W[o.i] / 2 - (centro + medio));
    }
    const todos = T.restos();
    return { total: l.length, primeros: entre(500, 3500), ultimos: entre(10000, 13000), primero: l[0] && l[0].i, modelos: [...new Set(l.map((o) => o.n))].sort(), hay: todos.filter((o) => o.resto !== 'auto').map((o) => o.resto), peor,
      solos: l.filter((q) => !todos.some((z) => z.resto !== 'auto' && Math.abs(z.i - q.i) < 12)).map((q) => q.i), todos: l.map((q) => q.i) };
  });
  ver('hay autos rotos y no demasiado pronto: el primero a los ' + rotos.primero + ' m (' + rotos.total + ' en total)', rotos.total >= 5 && rotos.primero > 500, rotos);
  ver('con los km aparecen mas: ' + rotos.primeros + ' entre los 0,5 y los 3,5 km y ' + rotos.ultimos + ' entre los 10 y los 13', rotos.ultimos > rotos.primeros, rotos);
  ver('son de varios modelos (' + rotos.modelos.join(',') + ') y a veces tienen una rueda o una caja de herramientas al lado (' + rotos.hay.length + ')', rotos.modelos.length >= 4 && rotos.hay.includes('rueda') && rotos.hay.includes('caja'), rotos);
  ver('al lado de cada auto roto queda lugar de sobra para pasar (el que menos deja: ' + rotos.peor.toFixed(1) + ' m)', rotos.peor > 2.4, rotos.peor);

  // de aca en adelante el auto solo avanza (el camino de atras se va tirando): se choca un auto roto, se saca la captura del camino
  // angosto, la de un auto roto y se mide como frena la arena de afuera
  await P.evaluate(() => { const s = window.shakedown.travesia; s.proxima(9999); s.depuracion.invulnerable = false; s.depuracion.piloto = false; });
  // se choca: de frente a un auto roto, a velocidad, pega como en la pista del dia
  const choque = await P.evaluate((i0) => {
    const s = window.shakedown.travesia, T = s.T(), c = s.c(), e = s.e();
    const o = T.restos().find((q) => q.resto === 'auto' && q.i === i0);
    s.saltarA((o.i - 34) / 1000);
    s.avanzar(0.4, { piloto: false });   // (que baje el auto y se arme el terreno)
    const dx = o.x - c.pos[0], dz = o.z - c.pos[2], l = Math.hypot(dx, dz), ux = dx / l, uz = dz / l;
    const px = o.x - ux * 12, pz = o.z - uz * 12;
    s.mundo.mantener(px, pz, 0, true);
    c.poner(px, pz, Math.atan2(ux, -uz)); c.vel[0] = ux * 12; c.vel[2] = uz * 12;
    const roto0 = e.roto; let contra = '';
    for (let k = 0; k < 90; k++) { s.avanzar(1 / 30, { piloto: false }); if (c.contra && c.contra !== 'piso') contra = c.contra; if (s.estado().fase !== 'corriendo') break; }
    return { contra, roto: e.roto - roto0, fase: s.estado().fase };
  }, rotos.solos[0]);
  ver('al chocar un auto roto suena y pega como un auto (contra "' + choque.contra + '", +' + choque.roto.toFixed(1) + ' de daño)', choque.contra === 'auto' && choque.roto > 1, choque);

  // un lugar de camino normal (ripio o arena, sin nada raro) con arena suelta al lado: busca desde el metro "desde" hacia adelante
  const buscar = (desde, cuantos, objetos) => P.evaluate(([desde, cuantos, objetos]) => {
    const s = window.shakedown.travesia, T = s.T(), P = T.camino, o = {}, lugares = [];
    for (let i = desde; i < desde + 1800 && lugares.length < cuantos; i += 20) {
      s.mundo.mantener(P.X[i], P.Z[i], 0, true);
      let sirve = true, n = 0;
      for (let k = i - 8; k <= i + 40 && sirve; k += 3) {
        if (P.S[k] !== 1 && P.S[k] !== 12) sirve = false;
        const x = P.X[k] - P.HZ[k] * (P.W[k] / 2 + 2.5), z = P.Z[k] + P.HX[k] * (P.W[k] / 2 + 2.5);
        T.suelo(x, z, o); if (o.id !== 13) sirve = false;
        for (const q of T.cosasCerca(P.X[k], P.Z[k]) || []) { if (q.borde && Math.hypot(q.x - P.X[k], q.z - P.Z[k]) < 9) n += 1 / 15; if (Math.hypot(q.x - P.X[k], q.z - P.Z[k]) < q.r + 2.2) sirve = false; }
      }
      if (sirve && (!objetos || n > 0.3)) lugares.push(i);
    }
    return lugares;
  }, [desde, cuantos, objetos]);
  const lugarAngosto = await buscar(rotos.solos[0] + 120, 1, true);
  ver('hay camino de ripio o arena con arena suelta y obstaculos al borde para mirar', lugarAngosto.length === 1, lugarAngosto);
  // la captura del camino angosto
  await P.evaluate((i) => {
    const s = window.shakedown.travesia;
    s.depuracion.invulnerable = true; s.saltarA((i - 8) / 1000); s.avanzar(0.8, { piloto: true, efectos: true, invulnerable: true });
    for (let k = 0; k < 12; k++) s.cuadro(0.1);
  }, lugarAngosto[0]);
  await P.waitForTimeout(500);
  await P.screenshot({ path: 'out/travesia-angosto.png' });

  // la captura de un auto roto: llegando de atras
  const otroRoto = rotos.todos.find((i) => i > lugarAngosto[0] + 80);
  await P.evaluate((i) => {
    const s = window.shakedown.travesia;
    s.saltarA((i - 22) / 1000); s.avanzar(0.8, { piloto: true, efectos: true, invulnerable: true });
    for (let k = 0; k < 6; k++) s.cuadro(0.1);
  }, otroRoto);
  await P.waitForTimeout(500);
  await P.screenshot({ path: 'out/travesia-roto.png' });

  // con el pedal a fondo, la arena de afuera frena y adentro del camino se mantiene la velocidad (se miran 3 lugares)
  const lugaresFreno = await buscar(otroRoto + 60, 3, false);
  await P.keyboard.down('ArrowUp');
  const freno = await P.evaluate((lugares) => {
    const s = window.shakedown.travesia, T = s.T(), c = s.c(), P = T.camino;
    s.depuracion.invulnerable = true; s.depuracion.piloto = false;
    const medir = (i, lado) => {
      s.saltarA(i / 1000); T.asegurar(i + 600);
      const hx = P.HX[i], hz = P.HZ[i];
      c.poner(P.X[i] - hz * lado, P.Z[i] + hx * lado, Math.atan2(hx, -hz));
      c.vel[0] = hx * 16; c.vel[2] = hz * 16; s.mundo.mantener(c.pos[0], c.pos[2], 0, true);
      s.avanzar(1.5, { piloto: false, invulnerable: true });
      return c.velocidad;
    };
    const media = (a) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
    // (de a un lugar: camino y orilla; los dos van hacia adelante)
    const r = lugares.map((i) => [medir(i, 0), medir(i, P.W[i] / 2 + 2.5)]);
    return { lugares: lugares.length, camino: media(r.map((q) => q[0])), orilla: media(r.map((q) => q[1])) };
  }, lugaresFreno);
  await P.keyboard.up('ArrowUp');
  ver('con el pedal a fondo, adentro del camino se mantiene la velocidad (' + (freno.camino * 3.6).toFixed(0) + ' km/h) y afuera se frena (' + (freno.orilla * 3.6).toFixed(0) + ' km/h)', freno.lugares >= 1 && freno.camino > 13 && freno.orilla < freno.camino * 0.85, freno);

  // el piloto de prueba sigue llegando lejos con el camino angosto: sin poder romperse (como en vertravesia.mjs) llega a los 2 km, y
  // sin esa ayuda se mira cuanto aguanta (los pedregales lo pelan: es lo que tienen que hacer)
  const lejos = await P.evaluate(() => {
    const s = window.shakedown.travesia;
    const km0 = s.estado().km;
    s.proxima(9999); s.depuracion.invulnerable = true;
    s.avanzar(900, { piloto: true, invulnerable: true, hasta: () => s.estado().km >= km0 + 1.5 });
    const protegido = s.estado().km - km0, km1 = s.estado().km;
    s.depuracion.invulnerable = false;
    s.avanzar(300, { piloto: true, invulnerable: false, hasta: () => s.estado().km >= km1 + 1.5 || s.estado().fase === 'fin' || s.estado().fase === 'espera' });
    return { protegido, km: s.estado().km - km1, fase: s.estado().fase, roto: s.estado().roto, motivo: s.estado().motivo };
  });
  console.log('  (el piloto de prueba, sin invulnerabilidad, hizo ' + lejos.km.toFixed(2) + ' km mas, daño ' + Math.round(lejos.roto) + ', ' + lejos.fase + ' ' + lejos.motivo + ')');
  ver('el piloto de prueba sigue avanzando por el camino angosto (' + lejos.protegido.toFixed(2) + ' km sin poder romperse; el resto, con el auto de verdad, hace lo que puede)', lejos.protegido >= 1.4 && lejos.km >= 0.3, lejos);

  // al salir de la Travesia se tira todo (el festival tambien)
  await P.keyboard.press('Escape');
  await P.waitForTimeout(300);
  ver('al salir de la Travesia se tira todo el festival', !(await P.evaluate(() => window.shakedown.travesia.mundo.fiesta.hay())));
  ver('sin errores en la consola (compu)', a.errores.length === 0, a.errores.slice(0, 4));
  await a.cerrar();
}

// ---------------------------------------------------------------- el celular
{
  const { a, P } = await entrar('celu', 390, 844, { hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const f = await P.evaluate(() => window.shakedown.travesia.mundo.fiesta.contar());
  ver('en el celular tambien hay festival (' + f.gente + ' personas, un tercio menos que en la compu)', f.gente >= 40 && f.carpas >= 4, f);
  await P.evaluate(() => { const s = window.shakedown.travesia; s.camara.cambiar('atras'); s.proxima(9999); s.avanzar(3.3); s.cuadro(0.05); s.avanzar(1.6, { piloto: true, efectos: true }); s.cuadro(0.05); });
  await P.waitForTimeout(500);
  await P.screenshot({ path: 'out/travesia-largada-celu.png' });
  // lo que cuesta dibujar: cuantas cosas y triangulos hay en la escena mirando la largada
  const costo = await P.evaluate(() => {
    const s = window.shakedown.travesia;
    s.saltarA(0.01); s.avanzar(0.5, { piloto: false });
    let mallas = 0, tri = 0;
    s.escena.traverse((o) => { if ((o.isMesh) && o.visible) { mallas++; const g = o.geometry; tri += (g.index ? g.index.count : g.attributes.position.count) / 3 * (g.instanceCount || o.count || 1); } });
    return { mallas, tri: Math.round(tri) };
  });
  console.log('  (la escena en la largada, en el celular: ' + costo.mallas + ' objetos, ' + costo.tri + ' triangulos)');
  ver('la escena de la largada es liviana (' + costo.mallas + ' objetos)', costo.mallas < 400, costo);
  ver('sin errores en la consola (celu)', a.errores.length === 0, a.errores.slice(0, 4));
  await a.cerrar();
}
console.log(mal ? mal + ' MAL' : 'todo bien');
process.exit(mal ? 1 : 0);

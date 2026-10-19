// La Travesia: el modo infinito con cartas. Entra desde la portada, recorre varios km con el piloto automatico y mira que
// el camino se arme por delante y se tire por detras, que a los 2 km aparezcan 3 cartas y que elegir una cambie el auto,
// y que al terminar salgan los km y el record. Lo hace en una pantalla de compu (1280x720) y en un celular parado (390x844).
// uso: node tools/pruebas/vertravesia.mjs [km]      (km: cuanto recorrer en cada pantalla, por defecto 4,5)
// Dejan capturas en out/travesia-*.png. Con graficos por software todo es lento: se usa shakedown.travesia.avanzar(segundos).
import { abrir } from './ver.mjs';
const KM = Number(process.argv[2]) || 4.5;
let mal = 0;
const ver = (que, si, detalle) => { console.log((si ? '  ok  ' : '  MAL ') + que + (si || detalle === undefined ? '' : ' -> ' + JSON.stringify(detalle))); if (!si) mal++; };
const est = (pag) => pag.evaluate(() => window.shakedown.travesia.estado());
const visible = (pag, id) => pag.evaluate((id) => { const el = document.getElementById(id); return !!el && !el.hidden; }, id);

async function probar(nombre, ancho, alto, contexto) {
  console.log('--- ' + nombre + ' (' + ancho + 'x' + alto + ') ---');
  const a = await abrir({ ancho, alto, contexto });
  if (!a.cargo) { console.log('NO CARGO\n' + a.errores.join('\n')); process.exit(1); }
  const P = a.pag;
  await P.waitForFunction(() => !document.documentElement.classList.contains('cargando'), null, { timeout: 90000 });
  await P.evaluate(() => { try { localStorage.removeItem('shakedown-x'); } catch (e) { /* nada */ } window.shakedown.club.gusto('travesiaKm', 0); });
  ver('la portada tiene el boton de la Travesia, con icono y sin texto largo', await P.evaluate(() => { const b = document.getElementById('travesia'); return !!b && !b.disabled && !!b.querySelector('img') && b.innerText.trim().length < 12; }));
  await P.screenshot({ path: 'out/travesia-' + nombre + '-0-portada.png' });
  await P.click('#travesia');
  await P.waitForFunction(() => window.shakedown.travesia.estado().activa, null, { timeout: 90000 });
  let e = await est(P);
  ver('entra en la Travesia', e.activa && e.fase === 'cuenta', e);
  ver('la portada se va y aparece el tablero', !(await visible(P, 'portada')) && (await visible(P, 'hud')));
  // la cuenta regresiva
  await P.evaluate(() => window.shakedown.travesia.avanzar(3.3));
  e = await est(P);
  ver('despues de la cuenta, corre', e.fase === 'corriendo', e);
  const arma0 = e.armados, solt0 = e.soltados;
  await P.evaluate(() => window.shakedown.travesia.avanzar(25, { piloto: true }));
  await P.waitForTimeout(600);
  await P.screenshot({ path: 'out/travesia-' + nombre + '-1-corriendo.png' });
  e = await est(P);
  ver('el auto avanza solo con el piloto (' + Math.round(e.mejor - 8) + ' m)', e.mejor > 150, e);
  ver('el tablero muestra los km (no el tiempo)', await P.evaluate(() => /km$/.test(document.getElementById('reloj').textContent)), await P.evaluate(() => document.getElementById('reloj').textContent));

  // hasta los 2 km: tienen que aparecer 3 cartas
  await P.evaluate((hasta) => window.shakedown.travesia.avanzar(900, { piloto: true, invulnerable: true, hasta: () => window.shakedown.travesia.estado().fase === 'cartas' || window.shakedown.travesia.estado().km >= hasta }), 2.3);
  e = await est(P);
  ver('a los 2 km se frena y salen 3 cartas', e.fase === 'cartas' && e.mano.length === 3 && e.km >= 2 && e.km < 2.2, e);
  ver('las 3 cartas se ven, grandes y tocables', await P.evaluate(() => { const b = [...document.querySelectorAll('#cartasMano .carta')]; return b.length === 3 && b.every((x) => { const r = x.getBoundingClientRect(); return r.width > 90 && r.height > 60 && r.bottom <= innerHeight + 1 && r.top >= -1; }); }));
  ver('y cada una tiene icono, nombre y una linea', await P.evaluate(() => [...document.querySelectorAll('#cartasMano .carta')].every((x) => x.querySelector('img') && x.querySelector('b').textContent.length > 3 && x.querySelector('.carta-texto').textContent.length > 3)));
  await P.screenshot({ path: 'out/travesia-' + nombre + '-2-cartas.png' });
  // el juego esta en pausa
  const antes = await est(P);
  await P.waitForTimeout(500);
  const despues = await est(P);
  ver('mientras se elige, el juego espera', Math.abs(antes.mejor - despues.mejor) < 0.01 && antes.tSinAvance === despues.tSinAvance, [antes.mejor, despues.mejor]);
  // elegir una carta cambia el auto
  const ida = await P.evaluate(() => { const s = window.shakedown.travesia, c = s.c(), e0 = JSON.stringify(s.e(), (k, v) => v), sale = s.estado().mano[0]; return { sale, e0, ant: { potencia: c.datos.potencia, frenos: c.datos.frenos } }; });
  await P.click('#cartasMano .carta >> nth=0');
  e = await est(P);
  const cambios = await P.evaluate((ant) => { const s = window.shakedown.travesia; s.avanzar(0.5, { piloto: true, invulnerable: true }); const x = s.e(); return { cartas: x.cartas.slice(), datos: s.c().datos.potencia, frenos: s.c().datos.frenos, estado: { ...x, cartas: undefined } }; }, ida.ant);
  const antesE = JSON.parse(ida.e0);
  delete antesE.cartas;
  ver('elegir una carta la suma al auto y se sigue', e.cartas.length === 1 && e.cartas[0] === ida.sale && e.fase === 'corriendo', { e, sale: ida.sale });
  ver('y el estado del auto cambio (' + ida.sale + ')', JSON.stringify(cambios.estado) !== JSON.stringify(antesE) || cambios.datos !== ida.ant.potencia || cambios.frenos !== ida.ant.frenos, cambios);
  ver('el tablero muestra la carta junto a los iconos', await P.evaluate(() => document.querySelectorAll('#cartasActivas .icono').length === 1 && !document.getElementById('cartasActivas').hidden));
  ver('la siguiente carta es a los 4 km', (await est(P)).proxima === 4);

  // el camino se arma y se tira: tiene que haber pedazos nuevos y haberse soltado los viejos
  await P.evaluate((hasta) => window.shakedown.travesia.avanzar(1500, { piloto: true, invulnerable: true, elegir: true, hasta: () => window.shakedown.travesia.estado().km >= hasta }), KM);
  e = await est(P);
  ver('recorre ' + KM + ' km (llego a ' + e.km.toFixed(2).replace('.', ',') + ')', e.km >= KM - 0.05, e);
  ver('se armaron pedazos nuevos por delante', e.armados > arma0 + 10, [arma0, e.armados]);
  ver('y se soltaron los de atras', e.soltados > solt0 + 5, [solt0, e.soltados]);
  ver('en memoria queda un tramo acotado (no todo el recorrido)', e.dibujados < 120 && e.memoria && e.memoria.tiles < 140, [e.dibujados, e.memoria]);
  ver('cada 2 km una carta: ' + e.cartas.length + ' elegidas', e.cartas.length >= Math.floor(KM / 2), e.cartas);
  await P.waitForTimeout(500);
  await P.screenshot({ path: 'out/travesia-' + nombre + '-3-lejos.png' });

  // cartas que se ven en la pantalla: el vidrio roto
  await P.evaluate(() => window.shakedown.travesia.dar('vidrio'));
  ver('el vidrio roto tapa una parte de la pantalla', await visible(P, 'vidrio'));
  await P.evaluate(() => window.shakedown.travesia.avanzar(1, { piloto: true, invulnerable: true }));
  await P.waitForTimeout(400);
  await P.screenshot({ path: 'out/travesia-' + nombre + '-4-vidrio.png' });

  // el fin: se rompe el auto
  await P.evaluate(() => { const s = window.shakedown.travesia; s.depuracion.invulnerable = false; s.e().roto = 99.9; s.terminar('roto'); s.avanzar(3); });
  await P.waitForFunction(() => !document.getElementById('travesiaFin').hidden, null, { timeout: 30000 });
  e = await est(P);
  ver('al romperse termina', e.fase === 'fin' && e.motivo === 'roto', e);
  const fin = await P.evaluate(() => ({ km: document.getElementById('tfKm').textContent, record: document.getElementById('tfRecord').textContent, cartas: document.querySelectorAll('#tfCartas .icono').length }));
  ver('el resultado muestra los km', /^\d+,\d$/.test(fin.km) && parseFloat(fin.km.replace(',', '.')) >= KM - 0.1, fin);
  ver('y el record (el primero es nuevo)', /récord/i.test(fin.record), fin);
  ver('y las cartas que se juntaron', fin.cartas === e.cartas.length, fin);
  await P.screenshot({ path: 'out/travesia-' + nombre + '-5-fin.png' });
  ver('el record queda guardado en el aparato', (await est(P)).record >= KM - 0.1, await est(P));
  // compartir
  const texto = await P.evaluate(async () => {
    let dicho = '';
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (t) => { dicho = t; } }, configurable: true });
    document.getElementById('tfCompartir').click();
    await new Promise((r) => setTimeout(r, 200));
    return dicho;
  });
  ver('compartir arma el mensaje "Shakedown Travesía 🏜️ km 🃏n"', /^Shakedown Travesía 🏜️ \d+,\d km 🃏\d+ \S+\n/.test(texto), texto);
  console.log('    ' + texto.split('\n').slice(0, 2).join(' | '));

  // otra corrida: no tapa el record con uno peor
  await P.click('#tfOtra');
  await P.waitForFunction(() => window.shakedown.travesia.estado().fase === 'cuenta');
  e = await est(P);
  ver('"otra" empieza una corrida nueva, sin cartas ni daño', e.km === 0 && e.roto === 0 && e.cartas.length === 0 && (await visible(P, 'travesiaFin')) === false, e);
  await P.evaluate(() => window.shakedown.travesia.avanzar(3.3));
  await P.evaluate(() => { const s = window.shakedown.travesia; s.avanzar(40, { piloto: true }); s.terminar('quieto'); s.avanzar(3); });
  await P.waitForFunction(() => !document.getElementById('travesiaFin').hidden);
  ver('el record anterior se queda si esta corrida fue peor', await P.evaluate(() => document.getElementById('tfRecord').textContent.includes('Tu récord')), await P.evaluate(() => document.getElementById('tfRecord').textContent));
  // volver a la portada
  await P.click('#tfSalir');
  await P.waitForFunction(() => !document.getElementById('portada').hidden);
  ver('"Volver" lleva a la portada', !(await est(P)).activa && !(await visible(P, 'hud')));
  // la pista del dia sigue andando
  await P.evaluate(() => window.shakedown.largar());
  await P.waitForTimeout(300);
  ver('la pista del dia largada sigue funcionando', await P.evaluate(() => window.shakedown.estado().pantalla === 'jugando'));
  ver('sin errores en la consola (' + nombre + ')', a.errores.length === 0, a.errores.slice(0, 4));
  await a.cerrar();
}

await probar('compu', 1280, 720);
await probar('celu', 390, 844, { hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
console.log(mal ? mal + ' MAL' : 'todo bien');
process.exit(mal ? 1 : 0);

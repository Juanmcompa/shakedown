// La musica de fondo: no suena antes del primer toque; despues del toque suena en el inicio; al largar una carrera baja
// mucho y al volver al inicio sube; su boton (y la tecla N) la apagan y queda guardado tras recargar; con el sonido general
// apagado no suena. El volumen se mide leyendo el nivel que tiene el juego (musica.estado()), no escuchando.
// Deja out/musica-boton-home.png y out/musica-boton-carrera.png (celular 390x844).
// uso: node tools/pruebas/vermusica.mjs
import { abrir, largarDesdeHome } from './ver.mjs';
let mal = 0;
const ver = (que, si, detalle) => { console.log((si ? '  ok  ' : '  MAL ') + que + (si || detalle === undefined ? '' : ' -> ' + JSON.stringify(detalle))); if (!si) mal++; };
const est = (pag) => pag.evaluate(() => window.shakedown.musica.estado());
// espera a que el fundido llegue (el volumen real alcanza al objetivo)
// (con 1 cuadro por segundo, el juego tarda en pedirle el nivel nuevo: por eso se espera primero el objetivo que se busca; 'hacia' es el volumen final)
const asentar = async (pag, hacia) => { await pag.waitForFunction((h) => { const e = window.shakedown.musica.estado(); return (h === undefined || Math.abs(e.objetivo - h) < 0.006) && Math.abs(e.ganancia - e.objetivo) < 0.003; }, hacia, { timeout: 30000 }).catch(() => {}); return est(pag); };
const esperarSuena = (pag) => pag.waitForFunction(() => window.shakedown.musica.estado().suena, null, { timeout: 30000 }).then(() => true).catch(() => false);

// corre una pasada con el piloto automatico desde cerca de la meta (llega rapido) y espera el resultado
const llegar = async (pag) => {
  const r = await pag.evaluate(async () => {
    const { decidir, PILOTOS } = await import('/tools/piloto.mjs'), { crearReferencia } = await import('/src/referencia.js'), { JUEGO } = await import('/src/config.js'), { azar } = await import('/src/noise.js');
    const s = window.shakedown, DT = JUEGO.paso, o = PILOTOS.bueno, c = s.auto(), p = s.partida, ref = crearReferencia(s.T, c.datos), rnd = azar(7), ent = { x: 0, y: 0, mano: false }, m = {};
    s.avanzar(3.3);
    s.ir(Math.max(0, s.T.camino.n - 90));
    let t = 0, prox = 0, pasos = 0;
    while (t < 120 && p.estado === 'corriendo') {
      if (t >= prox) { prox = t + o.reaccion * (0.7 + 0.6 * rnd()); decidir(s.T, ref, c, p, o, m, rnd, t, ent); }
      if (o.teclas && t > m.hasta && !(t < m.atras)) ent.x = 0;
      c.paso(ent, DT); t += DT;
      if (++pasos % 2 === 0) s.avanzar(DT * 2);
    }
    s.saltearEspera();
    return s.estado().estado;
  });
  await pag.waitForFunction(() => !document.getElementById('fin').hidden, null, { timeout: 60000 }).catch(() => {});
  return r;
};

const a = await abrir({ ancho: 390, alto: 844, contexto: { hasTouch: true, isMobile: true, deviceScaleFactor: 2 } });
if (!a.cargo) { console.log('NO CARGO\n' + a.errores.join('\n')); process.exit(1); }
const p = a.pag;
await p.waitForFunction(() => !document.documentElement.classList.contains('cargando'), null, { timeout: 90000 });
await p.waitForTimeout(1500);
let e = await est(p);
ver('antes del primer toque no hay musica (ni se pidio el archivo)', !e.iniciada && !e.suena && !e.cargada, e);
// el primer toque: en un lugar vacio del inicio
await p.mouse.click(195, 700);
ver('despues del toque, suena en el inicio', await esperarSuena(p));
e = await asentar(p);
const inicio = e.ganancia;
const BASE = inicio, CARRERA = inicio * 0.13, FIN = inicio * 0.45;
ver('en el inicio, volumen suave (entre 0,1 y 0,5)', inicio > 0.1 && inicio < 0.5, e);
await p.screenshot({ path: 'out/musica-boton-home.png' });

// carrera: baja mucho
await largarDesdeHome(p, 'hoy', { dedos: false });
e = await asentar(p, CARRERA);
ver('al largar baja a ~13% del inicio', e.ganancia > 0 && Math.abs(e.ganancia / inicio - 0.13) < 0.03, { inicio, ahora: e.ganancia });
await p.screenshot({ path: 'out/musica-boton-carrera.png' });
// el boton de la carrera la apaga
await p.click('#mandos .musica');
e = await asentar(p, 0);
ver('el boton de la carrera la apaga', e.ganancia < 0.005 && await p.evaluate(() => window.shakedown.gusto('musica') === false), e);
await p.keyboard.press('KeyN');
e = await asentar(p, CARRERA);
ver('la tecla N la prende de nuevo', e.objetivo > 0 && await p.evaluate(() => window.shakedown.gusto('musica') === true), e);
// el resultado: a mitad de camino
await llegar(p);
e = await asentar(p, FIN);
ver('en el resultado suena a mitad de camino', Math.abs(e.ganancia / inicio - 0.45) < 0.05, { inicio, ahora: e.ganancia });
await p.click('#salir');
await p.waitForFunction(() => window.shakedown.estado().pantalla === 'portada', null, { timeout: 30000 }).catch(() => {});
await p.waitForFunction((i) => Math.abs(window.shakedown.musica.estado().objetivo - i) < 0.02, inicio, { timeout: 30000 }).catch(() => {});
e = await asentar(p, BASE);
ver('al volver al inicio sube otra vez', Math.abs(e.ganancia - inicio) < 0.02, { inicio, ahora: e.ganancia });

// el boton del inicio la apaga y queda guardado
await p.click('#botonMusica');
e = await asentar(p, 0);
ver('el boton del inicio la apaga', e.ganancia < 0.005, e);
await p.reload();
await p.waitForFunction(() => window.shakedown && !document.documentElement.classList.contains('cargando'), null, { timeout: 90000 });
await p.waitForTimeout(800);
ver('tras recargar sigue apagada (guardado como gusto)', await p.evaluate(() => window.shakedown.gusto('musica') === false && document.getElementById('botonMusica').getAttribute('aria-pressed') === 'false'));
await p.mouse.click(195, 700);
await p.waitForTimeout(1500);
e = await asentar(p);
ver('apagada y con toque, no suena', e.ganancia < 0.005 && e.objetivo === 0, e);
// aparece en la configuracion
await p.click('[data-panel="ajustes"]');
ver('esta en la configuracion', await p.evaluate(() => !!document.querySelector('[data-ajuste="musica"]') && document.querySelector('[data-ajuste="musica"] .elegido').dataset.valor === 'no'));
await p.click('[data-ajuste="musica"] [data-valor="si"]');
e = await asentar(p, BASE);
ver('desde la configuracion se prende', e.objetivo > 0, e);
// sonido general apagado: calla
await p.click('[data-ajuste="sonido"] [data-valor="no"]');
e = await asentar(p, 0);
ver('con el sonido general apagado no suena', e.ganancia < 0.005 && e.objetivo === 0, e);
await p.click('[data-ajuste="sonido"] [data-valor="si"]');
e = await asentar(p, BASE);
ver('al prender el sonido vuelve', e.objetivo > 0, e);
ver('sin errores en la consola', a.errores.filter((x) => !/Failed to load resource/.test(x)).length === 0, [...new Set(a.errores)].slice(0, 3));
await a.cerrar();
console.log(mal ? '\n' + mal + ' COSAS MAL' : '\ntodo bien');
process.exit(mal ? 1 : 0);

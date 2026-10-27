// Las ofertas del final de una pasada: si fue muy buena (todos los sectores verdes o mejor que la referencia por bastante) y se corre
// sin el rally serio, se ofrece prenderlo; si fue muy mala (se rompio el auto, volvio al camino dos veces o mas, o tardo mas de 1,6 veces
// la referencia) y se corre sin ayuda, se ofrece la ayuda de manejo. Un cartel corto con un boton y "No, gracias": no se repite en cada
// pasada (una oferta se hace de nuevo recien despues de 5 pasadas) y quien dice que no, no la vuelve a ver.
// Tambien revisa lo de fabrica de quien entra por primera vez (doblar con flechas, trazada prendida, sin ayuda ni rally serio) y que a
// quien ya eligio otra cosa se le respete lo guardado. Captura: out/oferta-serio.png.
// uso: node tools/pruebas/veroferta.mjs
import { abrir } from './ver.mjs';
let mal = 0;
const ver = (que, si, detalle) => { console.log((si ? '  ok  ' : '  MAL ') + que + (si || detalle === undefined ? '' : ' -> ' + JSON.stringify(detalle))); if (!si) mal++; };
const dedos = { hasTouch: true, isMobile: true, deviceScaleFactor: 2 };
const visible = (pag, id) => pag.evaluate((id) => { const e = document.getElementById(id); return !!e && !e.hidden && e.getBoundingClientRect().height > 0; }, id);
// muestra el resultado de una pasada inventada: { f: cuantas veces la referencia (0,8 = mucho mejor; 2,5 = muy lento), c: colores, vueltas, ab }
const pasada = (pag, r) => pag.evaluate((r) => {
  const s = window.shakedown;
  s.menu.fin({ pista: s.estado().pista, nombre: '', s: [20, 20, 20, 20, 20], auto: s.club.auto(), ab: '', vueltas: 0, roto: 0, practica: false, ayuda: false, serio: false, c: 'vvvvv', ...r, t: (r.f || 1) * s.ref.total }, () => Promise.resolve(''), false);
}, r);

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



// ---------- 1: lo de fabrica, y lo guardado se respeta ----------
const a = await abrir({ ancho: 390, alto: 844, contexto: dedos, nuevo: true });
await a.pag.waitForFunction(() => !document.documentElement.classList.contains('cargando'), null, { timeout: 90000 });
const f = await a.pag.evaluate(() => { const s = window.shakedown; return { botones: s.gusto('botones'), trazada: s.gusto('trazada'), ayuda: s.gusto('ayuda'), serio: s.gusto('serio'), ajustes: [...document.querySelectorAll('[data-ajuste="botones"] .elegido')].map((b) => b.dataset.valor) }; });
ver('de fabrica: doblar con flechas, trazada prendida, sin ayuda y sin rally serio', f.botones === true && f.trazada === true && f.ayuda === false && f.serio === false, f);
await a.cerrar();
const b = await abrir({ ancho: 390, alto: 844, contexto: dedos, antes: async (pag) => { await pag.context().addInitScript(() => { try { localStorage.setItem('shakedown', JSON.stringify({ gustos: { tutorial: 1, travesiaGuia: 1, botones: false, trazada: false, ayuda: true } })); } catch (e) { /* sin memoria */ } }); } });
await b.pag.waitForFunction(() => !document.documentElement.classList.contains('cargando'), null, { timeout: 90000 });
const g = await b.pag.evaluate(() => { const s = window.shakedown; return { botones: s.gusto('botones'), trazada: s.gusto('trazada'), ayuda: s.gusto('ayuda') }; });
ver('quien ya habia elegido (inclinar, sin trazada, con ayuda): se le respeta lo guardado', g.botones === false && g.trazada === false && g.ayuda === true, g);
await b.cerrar();

// ---------- 2: las ofertas ----------
const c = await abrir({ ancho: 390, alto: 844, contexto: dedos, demora: 120000 });
await c.pag.waitForFunction(() => !document.documentElement.classList.contains('cargando'), null, { timeout: 90000 });
const P = c.pag;
// muy buena: se ofrece el rally serio
await P.tap('#largar');
await P.waitForFunction(() => window.shakedown.estado().pantalla === 'jugando', null, { timeout: 30000 });
await llegar(P);   // (una pasada de verdad, con el piloto automatico: llega mucho mas rapido que la referencia)
await P.waitForTimeout(600);
ver('una pasada muy buena (mejor que la referencia): se ofrece el rally serio', await visible(P, 'finSerio') && !(await visible(P, 'finAyuda')));
await P.screenshot({ path: 'out/oferta-serio.png' });
await P.tap('#probarSerio');
ver('al aceptar queda prendido el rally serio y el cartel lo dice', await P.evaluate(() => window.shakedown.gusto('serio') === true && /rally serio/.test(document.getElementById('finSerio').innerText) && document.getElementById('probarSerio').hidden));
await P.tap('#salir');
await P.waitForTimeout(400);
await P.evaluate(() => window.shakedown.ajustar('serio', false));
// no se repite siempre
await pasada(P, { f: 0.8 });
ver('en la pasada siguiente no se vuelve a ofrecer (no se repite siempre)', !(await visible(P, 'finSerio')));
for (let k = 0; k < 4; k++) await pasada(P, { f: 0.8 });
ver('despues de unas cuantas pasadas, si', await visible(P, 'finSerio'));
await P.tap('#noSerio');
ver('"No, gracias" esconde el cartel', !(await visible(P, 'finSerio')));
for (let k = 0; k < 12; k++) await pasada(P, { f: 0.8 });
ver('y despues de decir que no, no se ofrece mas', !(await visible(P, 'finSerio')));
// muy mala: se ofrece la ayuda
await pasada(P, { f: 2.5, c: 'rrrrr', vueltas: 3 });
ver('una pasada muy mala (volvio al camino 3 veces): se ofrece la ayuda de manejo', await visible(P, 'finAyuda') && !(await visible(P, 'finSerio')));
await P.tap('#probarAyuda');
ver('al aceptar queda prendida la ayuda', await P.evaluate(() => window.shakedown.gusto('ayuda') === true && /ayuda/.test(document.getElementById('finAyuda').innerText)));
await pasada(P, { f: 2.5, c: 'rrrrr', vueltas: 3 });
ver('con la ayuda ya prendida no se ofrece', !(await visible(P, 'finAyuda')));
await P.evaluate(() => window.shakedown.ajustar('ayuda', false));
for (let k = 0; k < 4; k++) await pasada(P, { f: 2.5, c: 'rrrrr', vueltas: 3 });
ver('la ayuda se vuelve a ofrecer despues de unas pasadas', await visible(P, 'finAyuda'));
await P.tap('#noAyuda');
ver('y con "No, gracias" desaparece', !(await visible(P, 'finAyuda')));
// una pasada normal no ofrece nada
await P.evaluate(() => window.shakedown.ajustar('ayuda', false));
await pasada(P, { f: 1.3, c: 'vavav' });
ver('una pasada normal no ofrece nada', !(await visible(P, 'finSerio')) && !(await visible(P, 'finAyuda')));
ver('sin errores en la consola', c.errores.length === 0, [...new Set(c.errores)].slice(0, 3));
await c.cerrar();
console.log(mal ? '\n' + mal + ' COSAS MAL' : '\ntodo bien');
process.exit(mal ? 1 : 0);

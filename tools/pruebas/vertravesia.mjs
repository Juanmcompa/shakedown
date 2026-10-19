// La Travesia: el modo infinito con cartas. Entra desde la portada, recorre varios km con el piloto automatico y mira que
// el camino se arme por delante y se tire por detras, que a los 2 km aparezcan 3 cartas (las tres, problemas: se elige el menos
// malo; las de arreglo quedan guardadas fuera del sorteo para los puestos de asistencia) y que elegir una cambie el auto,
// que cada averia nueva haga lo suyo (en la pantalla grande), y que al terminar salgan los km y el record. Lo hace en una pantalla de compu (1280x720) y en un celular parado (390x844).
// uso: node tools/pruebas/vertravesia.mjs [km]      (km: cuanto recorrer en cada pantalla, por defecto 4,5)
// Dejan capturas en out/travesia-*.png. Con graficos por software todo es lento: se usa shakedown.travesia.avanzar(segundos).
import { abrir } from './ver.mjs';
const KM = Number(process.argv[2]) || 4.5;
let mal = 0;
const ver = (que, si, detalle) => { console.log((si ? '  ok  ' : '  MAL ') + que + (si || detalle === undefined ? '' : ' -> ' + JSON.stringify(detalle))); if (!si) mal++; };
const est = (pag) => pag.evaluate(() => window.shakedown.travesia.estado());
const visible = (pag, id) => pag.evaluate((id) => { const el = document.getElementById(id); return !!el && !el.hidden; }, id);

// Las cartas: el sorteo, los arreglos fuera del sorteo y cada averia nueva, de a una (con el auto ya corriendo y sin poder romperse).
async function probarCartas(P) {
  console.log('  -- las cartas --');
  const c = await P.evaluate(() => {
    const { CARTAS, PROBLEMAS, ARREGLOS, sortear, estadoInicial } = window.shakedown.travesia.cartas;
    let total = 0, malas = 0, repetidas = 0; const est = estadoInicial();
    for (let k = 0; k < 400; k++) {
      const m = sortear(est);
      total += m.length; malas += m.filter((x) => x.tipo === 'mala').length; if (new Set(m.map((x) => x.id)).size !== m.length) repetidas++;
      if (k % 5 === 0) est.cartas.push(PROBLEMAS[(k / 5) % PROBLEMAS.length].id);   // (y se van juntando: aun cuando se acaban, siguen saliendo 3)
    }
    const todas = estadoInicial(); todas.cartas = PROBLEMAS.filter((x) => !x.repetible).map((x) => x.id);
    return { total, malas, repetidas, problemas: PROBLEMAS.length, arreglos: ARREGLOS.map((x) => x.id), arreglosSueltos: ARREGLOS.every((x) => x.tipo === 'arreglo' && !PROBLEMAS.includes(x)), todasMalas: CARTAS.filter((x) => x.tipo === 'mala').length === PROBLEMAS.length, conTodas: sortear(todas).length };
  });
  ver('el sorteo da solo problemas (' + c.total + ' cartas sorteadas)', c.total >= 1200 && c.malas === c.total, c);
  ver('y nunca repite una carta dentro de la misma mano', c.repetidas === 0, c);
  ver('hay mas de 25 problemas distintos (' + c.problemas + ')', c.problemas >= 25 && c.todasMalas, c);
  ver('los arreglos (' + c.arreglos.length + ') existen, estan marcados y quedan fuera del sorteo', c.arreglos.length >= 7 && c.arreglosSueltos && ['soldadura', 'turboNuevo', 'frenosNuevos', 'paragolpes', 'repuestos', 'mecanico', 'lisos'].every((id) => c.arreglos.includes(id)), c.arreglos);
  ver('aunque ya se tengan todos los problemas, salen 3', c.conTodas === 3, c);

  // se parte de un auto sin ninguna averia (lo que se eligio antes en la corrida es al azar y no tiene que mezclarse)
  await P.evaluate(() => { const s = window.shakedown.travesia, e = s.e(), c0 = e.cartas, ini = s.cartas.estadoInicial(); for (const k of Object.keys(ini)) e[k] = ini[k]; e.cartas = c0; });
  const preparar = () => P.evaluate(() => { const s = window.shakedown.travesia; s.depuracion.invulnerable = true; s.depuracion.piloto = true; s.saltarA(s.estado().km + 0.15); s.proxima(99); s.avanzar(14, { piloto: true, invulnerable: true }); return { v: s.c().velocidad, vTope: s.vTope(), fase: s.estado().fase }; });
  const ini = await preparar();
  ver('el auto va rapido para probar las averias (' + Math.round(ini.v * 3.6) + ' km/h)', ini.fase === 'corriendo' && ini.v > 4, ini);

  // lo que se ve en la pantalla
  await P.evaluate(() => window.shakedown.travesia.dar('polvoCabina'));
  ver('tormenta de polvo: desaparece el tablero de velocidad y daño', await P.evaluate(() => document.documentElement.classList.contains('sin-tablero') && getComputedStyle(document.querySelector('.placa.marcha')).visibility === 'hidden' && getComputedStyle(document.querySelector('.placa.tiempo')).visibility !== 'hidden'));
  await P.evaluate(() => window.shakedown.travesia.dar('arenaOjos'));
  ver('arena en los ojos: los bordes de la pantalla, oscuros', await P.evaluate(() => { const el = document.getElementById('arenaOjos'), r = el.getBoundingClientRect(); return !el.hidden && r.width >= innerWidth - 1 && r.height >= innerHeight - 1 && /radial-gradient/.test(getComputedStyle(el).backgroundImage); }));
  await P.evaluate(() => window.shakedown.travesia.dar('paranoia'));
  await P.evaluate(() => window.shakedown.travesia.dar('instrumental'));
  const pantalla = await P.evaluate(() => {
    const s = window.shakedown.travesia, e = s.e(); e.roto = 20;
    const valores = new Set();
    for (let k = 0; k < 12; k++) { s.cuadro(0.2); valores.add(document.getElementById('vel').textContent); }
    return { roto: e.roto, barra: parseFloat(document.getElementById('roto').style.width), valores: [...valores] };
  });
  ver('paranoia: la barra de daño muestra mas de lo que hay (' + pantalla.barra.toFixed(0) + '% con ' + pantalla.roto + ' de verdad)', pantalla.barra > pantalla.roto + 10, pantalla);
  ver('instrumental loco: el velocimetro marca numeros distintos al azar', pantalla.valores.length >= 4 && pantalla.valores.every((x) => /^\d+$/.test(x) && Number(x) <= 180), pantalla.valores);
  await P.evaluate(() => { const s = window.shakedown.travesia; s.e().roto = 0; s.avanzar(14, { piloto: true, invulnerable: true }); });   // (que sigan las notas del camino)
  const libro = await P.evaluate(() => {
    const s = window.shakedown.travesia, co = s.copiloto();
    // una curva que viene: sin la averia se ve su flecha, con ella un "?"
    const i = s.estado().indice, curva = co.notas.find((n) => n.tipo === 'curva' && n.i > i + 6);
    if (!curva) return null;
    s.saltarA((curva.i - 25) / 1000); s.proxima(99);
    s.cuadro(0.05);
    const antes = document.querySelector('#notas .nota img')?.getAttribute('src');
    s.dar('roadbook'); s.cuadro(0.05);
    const nota = document.querySelector('#notas .nota');
    return { antes, despues: nota?.querySelector('img')?.getAttribute('src'), texto: nota?.querySelector('b')?.textContent };
  });
  ver('roadbook manchado: la flecha de la proxima curva pasa a ser un "?" (sin numero)', !libro || (libro.antes && libro.despues && libro.antes !== libro.despues && libro.texto === ''), libro);
  await P.evaluate(() => { const s = window.shakedown.travesia; s.avanzar(1, { piloto: true, invulnerable: true }); });

  // el copiloto: estatica (canta 1,5 s tarde), panico (se calla a mucha velocidad) y notas voladas (2 km sin notas)
  const voz = await P.evaluate(() => {
    const s = window.shakedown.travesia, co = s.copiloto(), orig = co.paso, v0 = s.vTope();
    let llamadas = 0, ultimo = null; co.paso = (i, v) => { llamadas++; ultimo = i; return orig(i, v); };
    s.e().estatica = false; s.cuadro(0.03); const base = { indice: s.estado().indice, ultimo };
    s.dar('estatica'); s.cuadro(0.03);
    const tarde = { indice: s.estado().indice, ultimo, v: s.c().velocidad };
    s.dar('panico');
    llamadas = 0; s.vTope(s.c().velocidad / 0.95); s.cuadro(0.03);
    const callado = llamadas; s.vTope(s.c().velocidad / 0.5); s.cuadro(0.03);
    const habla = llamadas; s.vTope(v0); co.paso = orig;
    return { base, tarde, callado, habla };
  });
  ver('intercomunicador con estatica: el copiloto canta tarde (' + (voz.tarde.indice - voz.tarde.ultimo) + ' m atras, a ' + Math.round(voz.tarde.v * 3.6) + ' km/h)', voz.base.indice - voz.base.ultimo <= 1 && voz.tarde.indice - voz.tarde.ultimo >= voz.tarde.v * 1.5 - 2, voz);
  ver('panico en cabina: a mucha velocidad no canta, y mas despacio si', voz.callado === 0 && voz.habla >= 1, voz);
  const vol = await P.evaluate(() => {
    const s = window.shakedown.travesia, co = s.copiloto(), T = s.T(), i0 = s.estado().indice;
    const hay = () => co.notas.filter((n) => n.i >= i0 && n.i < i0 + 2000).length;
    const antes = hay();
    s.dar('voladas');
    const justo = hay();
    s.avanzar(10, { piloto: true, invulnerable: true });
    T.asegurar(i0 + 2400);
    return { antes, justo, despues: hay(), sigue: co.notas.some((n) => n.i >= i0 + 2000) };
  });
  ver('notas voladas: 2 km sin notas (habia ' + vol.antes + ', ahora ' + vol.justo + ' y despues ' + vol.despues + ')', vol.antes > 0 && vol.justo <= 1 && vol.despues <= 1 /* (una ya cantada puede quedar) */, vol);
  await P.evaluate(() => { const s = window.shakedown.travesia; s.avanzar(14, { piloto: true, invulnerable: true }); });

  // la camara
  const cam = await P.evaluate(() => {
    const s = window.shakedown.travesia, orig = s.camara.vibrar; let ultima = 0; s.camara.vibrar = (x) => { ultima = x; return orig(x); };
    const medir = () => { s.cuadro(0.02); return ultima; };
    s.e().escape = false; s.e().desbalance = false; const base = medir(); s.dar("escape"); const escape = medir();
    s.e().escape = false; s.dar('desbalanceada'); const v0 = s.vTope(); s.vTope(s.c().velocidad / 0.95); const rapido = medir(); s.vTope(s.c().velocidad / 0.3); const lento = medir(); s.vTope(v0);
    s.camara.vibrar = orig;
    return { base, escape, rapido, lento };
  });
  ver('escape libre: la pantalla tiembla siempre un poco', cam.escape > cam.base + 0.01, cam);
  ver('rueda desbalanceada: tiembla mas a alta velocidad', cam.rapido > cam.lento, cam);

  // lo que el auto hace con lo que se le pide (volante, pedales)
  const ent = await P.evaluate(() => {
    const s = window.shakedown.travesia, c = s.c(), v0 = s.vTope(), e = s.e(), v = c.velocidad;
    const lleno = () => { e.sesgo = 0; };
    // direccion hidraulica muerta: a alta velocidad el volante dobla la mitad
    lleno(); s.vTope(v / 0.95); const sin = s.filtrar(1, 0, 0.01).x; s.dar('hidraulica'); const con = s.filtrar(1, 0, 0.01).x;
    // golpe de calor: la direccion se invierte de a ratos
    s.vTope(v0); s.e().direccion = false; s.dar('insolacion');
    let invertido = 0, normal = 0; for (let k = 0; k < 160; k++) { const x = s.filtrar(0.5, 0, 0.25).x; if (x < 0) invertido++; else normal++; }
    // correa floja: a mucha velocidad se apaga el motor (no acelera) un rato
    s.e().insolacion = false; s.vTope(v / 0.95); s.dar('correa');
    let apagado = 0, acelera = 0; for (let k = 0; k < 120; k++) { const y = s.filtrar(0, 1, 0.5).y; if (y === 0) apagado++; else acelera++; }
    s.e().correa = false; s.vTope(v0);
    // liquido de frenos hirviendo: la tercera frenada fuerte en 5 s no frena (y al soltar el pedal vuelve)
    s.e().hierve = false; s.avanzar(8, { piloto: true, invulnerable: true }); const vFreno = s.c().velocidad; s.dar('hierve');
    const f = (y, dt = 0.5) => s.filtrar(0, y, dt).y;
    const r1 = f(-1), s1 = f(0), r2 = f(-1), s2 = f(0), r3 = f(-1), s3 = f(0, 0.3), r4 = f(-1, 3);
    // pinchazo: dobla mal para un lado
    s.e().hierve = false; e.sesgo = 0; s.dar('pinchazo'); const torcido = s.filtrar(0, 0, 0.01).x;
    return { v, sin, con, invertido, normal, apagado, acelera, frenos: [r1, r2, r3, r4], vFreno, torcido };
  });
  ver('direccion hidraulica muerta: a alta velocidad dobla la mitad (' + ent.sin.toFixed(2) + ' -> ' + ent.con.toFixed(2) + ')', ent.sin > 0.95 && Math.abs(ent.con - ent.sin * 0.5) < 0.08, ent);
  ver('golpe de calor: de a ratos la direccion se invierte (' + ent.invertido + ' de 160 pasos)', ent.invertido >= 8 && ent.normal > ent.invertido, ent);
  ver('correa floja: a mucha velocidad a veces se apaga el motor (' + ent.apagado + ' de 120 pasos)', ent.apagado >= 2 && ent.acelera > ent.apagado, ent);
  ver('liquido de frenos hirviendo: frena la 1a y la 2a, la 3a no, y la 4a vuelve a frenar', ent.frenos[0] === -1 && ent.frenos[1] === -1 && ent.frenos[2] === 0 && ent.frenos[3] === -1 || ent.vFreno <= 7 /* (si el auto iba lento, la regla no cuenta frenadas) */, ent);
  ver('pinchazo delantero: el volante tira para un lado (' + ent.torcido.toFixed(2) + ')', Math.abs(ent.torcido) > 0.1, ent);

  // la potencia: embrague quemado (de parado, un tercio) y filtro de aire tapado (-20% en arena y fesh-fesh)
  const mot = await P.evaluate(() => {
    const s = window.shakedown.travesia, c = s.c(), e = s.e(), T = s.T(), P = T.camino;
    const lee = () => { s.avanzar(0.04, { piloto: false, invulnerable: true }); return { empuje: c.datos.empuje, potencia: c.datos.potencia, suelo: c.suelo, v: c.velocidad }; };
    e.embrague = false; e.filtro = false;
    // un tramo de arena: se busca por delante y se apoya el auto ahi, quieto
    T.asegurar(s.estado().indice + 2500);
    let i = s.estado().indice + 60; while (i < P.n - 80 && !(P.S[i] === 12 && P.S[i + 20] === 12 && P.S[i + 40] === 12 && P.S[i + 60] === 12)) i++;
    s.saltarA((i + 30) / 1000); s.proxima(99); for (let k = 0; k < 3; k++) { c.vel[0] = c.vel[1] = c.vel[2] = 0; }
    const base = lee();
    e.filtro = true; const filtro = lee(); e.filtro = false;
    e.embrague = true; const embrague = lee(); e.embrague = false;
    return { base, filtro, embrague };
  });
  ver('filtro de aire tapado: en arena, -20% de potencia (' + (mot.filtro.potencia / mot.base.potencia).toFixed(2) + ')', mot.base.suelo === 12 && Math.abs(mot.filtro.potencia / mot.base.potencia - 0.8) < 0.03, mot);
  ver('embrague quemado: de parado, el empuje es un tercio (' + (mot.embrague.empuje / mot.base.empuje).toFixed(2) + ')', mot.base.v < 3 && mot.embrague.empuje / mot.base.empuje < 0.45 && mot.embrague.empuje / mot.base.empuje > 0.3, mot);

  // las alucinaciones: piedras falsas que no se chocan y desaparecen al tocarlas
  const alu = await P.evaluate(() => {
    const s = window.shakedown.travesia, f = s.mundo.falsas;
    s.dar('alucinaciones'); let max = 0, hay = 0;
    for (let k = 0; k < 40; k++) { s.avanzar(1, { piloto: true, invulnerable: true }); max = Math.max(max, f.lista.length); if (f.lista.length) hay++; }
    const c = s.c(), antes = f.lista.length;
    f.poner(c.pos[0] + c.adelante[0] * 1.5, c.pos[1], c.pos[2] + c.adelante[2] * 1.5);
    s.avanzar(0.1, { piloto: true, invulnerable: true });
    const choca = !!s.T().cosasCerca(c.pos[0], c.pos[2]) && s.T().cosasCerca(c.pos[0], c.pos[2]).some((o) => o.falsa);
    return { max, hay, antes, despues: f.lista.length, choca };
  });
  ver('alucinaciones: aparecen piedras falsas (hasta ' + alu.max + ' a la vez)', alu.max >= 1 && alu.max <= 4 && alu.hay >= 4, alu);
  ver('y se van al tocarlas (no son de verdad: no se chocan)', alu.despues < alu.antes + 1 && !alu.choca, alu);

  // sin lubricante: a mucha velocidad el motor se daña de a poco (aca si puede dañarse)
  const aceite = await P.evaluate(() => {
    const s = window.shakedown.travesia, e = s.e(), v0 = s.vTope();
    s.avanzar(10, { piloto: true, invulnerable: true });
    s.dar('aceite'); s.depuracion.invulnerable = false; e.roto = 10;
    s.vTope(s.c().velocidad / 0.95); const antes = e.roto;
    s.avanzar(0.4, { piloto: true, invulnerable: false });   // (no alcanza para que choque con algo: es solo el desgaste)
    const rapido = e.roto - antes;
    s.vTope(s.c().velocidad / 0.3); const antes2 = e.roto; s.avanzar(0.4, { piloto: true, invulnerable: false }); const lento = e.roto - antes2;
    s.vTope(v0); s.depuracion.invulnerable = true; e.roto = 0;
    return { rapido, lento };
  });
  ver('sin lubricante: a mucha velocidad suma daño de a poco (' + aceite.rapido.toFixed(2) + ') y despacio no (' + aceite.lento.toFixed(2) + ')', aceite.rapido > 0.15 && aceite.rapido < 1.5 && aceite.lento < 0.05, aceite);

  // el ajuste "efectos": con el apagado no sale la polvareda grande
  const efectos = await P.evaluate(() => {
    const s = window.shakedown.travesia, correr = () => { s.fx.limpiar(); s.avanzar(5, { piloto: true, invulnerable: true, efectos: true }); return s.fx.nubesGrandes(); };
    const con = correr();
    window.shakedown.ajustar('efectos', false); const sin = correr();
    window.shakedown.ajustar('efectos', true); const otraVez = correr();
    return { con, sin, otraVez };
  });
  ver('polvareda grande: sale con los efectos prendidos (' + efectos.con + ' nubes), no con el ajuste "efectos" apagado (' + efectos.sin + ')', efectos.con >= 5 && efectos.sin === 0 && efectos.otraVez >= 1, efectos);

  // huellas: el auto deja marcas en el piso y el camino trae rodadas de otros autos
  const hu = await P.evaluate(() => { const s = window.shakedown.travesia, h = s.mundo.huellas; return { pedazos: h.pedazos(), marcados: h.marcados() }; });
  ver('huellas: cada pedazo de terreno trae su mapa y hay marcas (' + hu.marcados + ' pixeles en ' + hu.pedazos + ' pedazos)', hu.pedazos >= 6 && hu.marcados > 800, hu);
  // limpiar lo que quedo para seguir con el resto de la prueba
  await P.evaluate(() => { const s = window.shakedown.travesia, e = s.e(); for (const k of Object.keys(e)) { /* nada */ } s.depuracion.invulnerable = true; });
  console.log('  -- fin de las cartas --');
}

async function probar(nombre, ancho, alto, contexto) {
  console.log('--- ' + nombre + ' (' + ancho + 'x' + alto + ') ---');
  const a = await abrir({ ancho, alto, contexto });
  if (!a.cargo) { console.log('NO CARGO\n' + a.errores.join('\n')); process.exit(1); }
  const P = a.pag;
  await P.waitForFunction(() => !document.documentElement.classList.contains('cargando'), null, { timeout: 90000 });
  await P.evaluate(() => { try { localStorage.removeItem('shakedown-x'); } catch (e) { /* nada */ } window.shakedown.club.gusto('travesiaKm', 0); });
  ver('la portada ya no tiene el boton suelto de la Travesia', await P.evaluate(() => !document.getElementById('travesia')));
  // se entra desde los circuitos, en la categoria Aventura
  await P.evaluate(() => { window.shakedown.ajustar('trazada', false); window.shakedown.ajustar('serio', false); });   // (en los gustos, apagados)
  await P.click('[data-panel="circuitos"]');
  await P.waitForTimeout(300);
  ver('en los circuitos, la categoria Aventura tiene la Travesia', await P.evaluate(() => { const a = document.querySelector('#catAventura a'); return !!a && /Travesía/.test(a.textContent) && a.getBoundingClientRect().height > 20; }));
  await P.screenshot({ path: 'out/travesia-' + nombre + '-0-portada.png' });
  await P.click('#catAventura a');
  await P.waitForFunction(() => window.shakedown.travesia.estado().activa, null, { timeout: 90000 });
  let e = await est(P);
  ver('entra en la Travesia', e.activa && e.fase === 'cuenta', e);
  ver('la trazada arranca prendida (aunque en los gustos este apagada) y el gusto guardado no cambia', await P.evaluate(() => window.shakedown.travesia.trazada.visible()) && await P.evaluate(() => window.shakedown.gusto('trazada')) === false, await P.evaluate(() => window.shakedown.gusto('trazada')));
  ver('siempre en rally serio, y sin ayuda de manejo', await P.evaluate(() => window.shakedown.travesia.serio() && !window.shakedown.gusto('ayuda')), await P.evaluate(() => [window.shakedown.travesia.serio(), window.shakedown.gusto('serio')]));
  ver('la portada se va y aparece el tablero', !(await visible(P, 'portada')) && (await visible(P, 'hud')));
  // la cuenta regresiva
  await P.evaluate(() => window.shakedown.travesia.avanzar(3.3));
  e = await est(P);
  ver('despues de la cuenta, corre', e.fase === 'corriendo', e);
  await P.keyboard.press('KeyT');
  ver('la T apaga la trazada durante la corrida', !(await P.evaluate(() => window.shakedown.travesia.trazada.visible())));
  await P.keyboard.press('KeyT');
  ver('y la vuelve a prender', await P.evaluate(() => window.shakedown.travesia.trazada.visible()));
  const arma0 = e.armados, solt0 = e.soltados;
  await P.evaluate(() => window.shakedown.travesia.avanzar(25, { piloto: true }));
  await P.waitForTimeout(600);
  await P.screenshot({ path: 'out/travesia-' + nombre + '-1-corriendo.png' });
  e = await est(P);
  ver('las rayitas de la trazada se pintan por delante del camino (' + (await P.evaluate(() => window.shakedown.travesia.trazada.puestas(window.shakedown.travesia.estado().indice))) + ')', await P.evaluate(() => window.shakedown.travesia.trazada.puestas(window.shakedown.travesia.estado().indice)) > 60);
  await P.screenshot({ path: 'out/travesia-trazada.png' });
  ver('el auto avanza solo con el piloto (' + Math.round(e.mejor - 8) + ' m)', e.mejor > 150, e);
  ver('el tablero muestra los km (no el tiempo)', await P.evaluate(() => /km$/.test(document.getElementById('reloj').textContent)), await P.evaluate(() => document.getElementById('reloj').textContent));

  // hasta los 2 km: tienen que aparecer 3 cartas
  await P.evaluate((hasta) => window.shakedown.travesia.avanzar(900, { piloto: true, invulnerable: true, hasta: () => window.shakedown.travesia.estado().fase === 'cartas' || window.shakedown.travesia.estado().km >= hasta }), 2.3);
  e = await est(P);
  ver('a los 2 km se frena y salen 3 cartas', e.fase === 'cartas' && e.mano.length === 3 && e.km >= 2 && e.km < 2.2, e);
  ver('las 3 cartas se ven, grandes y tocables', await P.evaluate(() => { const b = [...document.querySelectorAll('#cartasMano .carta')]; return b.length === 3 && b.every((x) => { const r = x.getBoundingClientRect(); return r.width > 90 && r.height > 60 && r.bottom <= innerHeight + 1 && r.top >= -1; }); }));
  const tipos = await P.evaluate(() => { const s = window.shakedown.travesia; return s.estado().mano.map((id) => s.cartas.CARTAS.find((c) => c.id === id).tipo); });
  ver('las 3 cartas que salen son problemas (ninguna buena ni mezcla)', tipos.length === 3 && tipos.every((t) => t === 'mala'), tipos);
  ver('y cada una tiene icono, nombre y una linea', await P.evaluate(() => [...document.querySelectorAll('#cartasMano .carta')].every((x) => x.querySelector('img') && x.querySelector('b').textContent.length > 3 && x.querySelector('.carta-texto').textContent.length > 3)));
  await P.screenshot({ path: 'out/travesia-' + nombre + '-2-cartas.png' });
  // el juego esta en pausa
  const antes = await est(P);
  await P.waitForTimeout(500);
  const despues = await est(P);
  ver('mientras se elige, el juego espera', Math.abs(antes.mejor - despues.mejor) < 0.01 && antes.tSinAvance === despues.tSinAvance, [antes.mejor, despues.mejor]);
  // elegir una carta cambia el auto
  // (se elige una que no sea "notas voladas": esa se gasta al instante y el estado queda igual)
  const ida = await P.evaluate(() => { const s = window.shakedown.travesia, c = s.c(), e0 = JSON.stringify(s.e(), (k, v) => v), mano = s.estado().mano, k = Math.max(0, mano.findIndex((id) => id !== 'voladas')); return { k, sale: mano[k], e0, ant: { potencia: c.datos.potencia, frenos: c.datos.frenos } }; });
  await P.click('#cartasMano .carta >> nth=' + ida.k);
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

  if (nombre === 'compu') await probarCartas(P);

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
  // compartir: sin nombre no se comparte (pide el nombre); con nombre, el link lleva solo quien es y cuantos km
  await P.evaluate(async () => { Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => {} }, configurable: true }); document.getElementById('tfCompartir').click(); await new Promise((r) => setTimeout(r, 150)); });
  ver('sin nombre, compartir lo pide', /nombre/i.test(await P.evaluate(() => document.getElementById('tfCompartido').textContent)));
  await P.fill('#tfNombre', 'Ana Maria');
  await P.press('#tfNombre', 'Enter');
  ver('el nombre se puede poner en el resultado', await P.evaluate(() => window.shakedown.club.nombre()) === 'Ana Maria');
  const texto = await P.evaluate(async () => {
    let dicho = '';
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (t) => { dicho = t; } }, configurable: true });
    document.getElementById('tfCompartir').click();
    await new Promise((r) => setTimeout(r, 200));
    return dicho;
  });
  ver('compartir arma el mensaje "Shakedown Travesía 🏜️ km 🃏n"', /^Shakedown Travesía 🏜️ \d+,\d km 🃏\d+ \S+\n/.test(texto), texto);
  console.log('    ' + texto.split('\n').slice(0, 2).join(' | '));
  const km100 = Math.round((await est(P)).record * 100);
  ver('y el ultimo renglon es un link generico: solo quien y cuantos km (#t=Nombre.km), sin pista ni fantasma', texto.split('\n').pop().endsWith('#t=Ana%20Maria.' + km100) && !/#r=|\?p=|\?c=/.test(texto), texto.split('\n').pop());

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

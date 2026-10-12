// El sonido del juego, hecho con osciladores y ruido (no usa archivos de audio): el motor, el patinaje y el barro, los
// golpes (cada cosa suena distinto: una piedra, el alambrado, un arbol, un fardo, la chapa de un auto tirado...), lo que
// se lleva puesto el auto (conos, postes, fardos), las caidas, y el publico en la meta.
// El auto suena cada vez mas roto: con cada golpe la chapa cruje mas, y a medida que se rompe aparecen ruidos de cosas
// sueltas, el motor empieza a fallar y, al final, pierde vapor.
//
//   crearSonido()             el sonido del juego (ver mas abajo lo que se le puede pedir)
//   crearGolpes(ctx, salida)  los sonidos sueltos (golpes, caidas, la meta), en cualquier contexto de audio: el del juego,
//                             o uno "fuera de linea" (OfflineAudioContext), para grabarlos y escucharlos sin jugar

import { JUEGO } from './config.js';

// De que esta hecho cada cosa que se puede chocar (las clases y tipos de terrain.js y edificios.js), para saber como suena.
// "piso" es el piso mismo: un salto que se cae fuerte, una pared de la cornisa, el borde de una zanja.
export const MATERIAL = {
  piedra: 'piedra', pirca: 'piedra', monumento: 'piedra', cantero: 'piedra',
  arbol: 'madera', banco: 'madera', cajones: 'madera',
  arbusto: 'ramas',
  poste: 'alambrado',
  fardo: 'fardo',
  auto: 'metal', colectivo: 'metal', volquete: 'metal', molino: 'metal', tanque: 'metal', farol: 'metal', baranda: 'metal', valla: 'metal', tacho: 'metal',
  cono: 'plastico', cubiertas: 'goma',
  edificio: 'pared', piso: 'piso',
};
// (en los golpes contra estas, ademas, cruje la chapa del auto: contra un fardo, un arbusto o un cono, no tanto)
const ABOLLA = { piedra: 1, madera: 0.85, alambrado: 0.35, fardo: 0.15, metal: 1, plastico: 0.1, goma: 0.3, pared: 1, piso: 0.7, ramas: 0.1 };
// Lo que el auto se lleva puesto (cede: ver edificios.js y terrain.js). Esas suenan al voltearlas; un golpe contra ellas
// suena aparte solo si ademas le hizo daño al auto (y entonces solo la chapa: la cosa ya sono al caer).
const SE_VOLTEA = new Set(['poste', 'fardo', 'cono', 'tacho', 'cubiertas', 'cajones', 'valla', 'banco']);

export function crearGolpes(ctx, salida) {
  // dos segundos de ruido: de ahi salen los crujidos, los raspones, el vapor y el publico
  const largo = ctx.sampleRate * 2, ruido = ctx.createBuffer(1, largo, ctx.sampleRate), d = ruido.getChannelData(0);
  for (let i = 0; i < largo; i++) d[i] = Math.random() * 2 - 1;
  const azar = (a, b) => a + Math.random() * (b - a);
  // sube enseguida y se apaga solo
  const envolvente = (g, t, vol, ataque, dura) => {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + ataque);
    g.gain.exponentialRampToValueAtTime(0.0001, t + ataque + dura);
  };

  // el "pum": un tono grave que cae
  function pum(t, f0, f1, dura, vol) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dura);
    envolvente(g, t, vol, 0.004, dura);
    o.connect(g); g.connect(salida);
    o.start(t); o.stop(t + dura + 0.06);
  }
  // una rafaga de ruido filtrado: un crujido, un raspon, astillas
  function rafaga(t, centro, q, dura, vol, tipo = 'bandpass') {
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = ruido;
    f.type = tipo; f.frequency.value = centro; f.Q.value = q;
    envolvente(g, t, vol, 0.002, dura);
    s.connect(f); f.connect(g); g.connect(salida);
    s.start(t, azar(0, 1.5)); s.stop(t + dura + 0.06);
  }
  // metal: tonos que no son armonicos entre si (suena a fierro o a chapa, no a una nota)
  function campana(t, f, dura, vol) {
    for (const [k, m] of [[1, 1], [2.32, 0.6], [4.25, 0.4], [6.63, 0.25]]) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = f * k * azar(0.99, 1.01);
      envolvente(g, t, vol * m, 0.002, dura / Math.sqrt(k));
      o.connect(g); g.connect(salida);
      o.start(t); o.stop(t + dura + 0.06);
    }
  }
  // el alambre del alambrado: vibra y se va apagando
  function alambre(t, f, dura, vol) {
    const o = ctx.createOscillator(), lfo = ctx.createOscillator(), prof = ctx.createGain(), filtro = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(f * 1.07, t);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.09);
    lfo.frequency.value = 7.5; prof.gain.value = f * 0.03;
    lfo.connect(prof); prof.connect(o.frequency);
    filtro.type = 'lowpass';
    filtro.frequency.setValueAtTime(3200, t);
    filtro.frequency.exponentialRampToValueAtTime(500, t + dura);
    envolvente(g, t, vol, 0.003, dura);
    o.connect(filtro); filtro.connect(g); g.connect(salida);
    o.start(t); lfo.start(t); o.stop(t + dura + 0.06); lfo.stop(t + dura + 0.06);
  }
  // La chapa del auto que se abolla: crujidos cortos y un "clonc". Cuanto mas roto esta el auto, mas cruje; y desde la mitad,
  // ademas algo se suelta y rebota.
  function chapa(t, vol, roto) {
    const n = 2 + Math.round(roto / 30);
    for (let k = 0; k < n; k++) rafaga(t + azar(0, 0.09), azar(1400, 4000), 3, azar(0.05, 0.11), vol * azar(0.5, 1));
    campana(t, azar(260, 440), 0.25 + roto / 300, vol * 0.45);
    if (roto > 50) for (let k = 0; k < 3; k++) campana(t + azar(0.08, 0.35), azar(1500, 3000), 0.06, vol * 0.25);
  }
  // cada material, a una fuerza dada (de 0 a 1)
  const SUENA = {
    piedra: (t, f) => { pum(t, 75, 38, 0.28, 0.9 * f); rafaga(t, 900, 0.8, 0.14, 0.5 * f); },
    madera: (t, f) => { pum(t, 150, 85, 0.14, 0.6 * f); rafaga(t, 1300, 1.4, 0.07, 0.5 * f); campana(t, 380, 0.08, 0.12 * f); },
    ramas: (t, f) => { rafaga(t, 2600, 0.5, 0.35, 0.35 * f); rafaga(t + 0.05, 1800, 0.7, 0.25, 0.25 * f); },
    alambrado: (t, f) => { rafaga(t, 2400, 1.2, 0.05, 0.4 * f, 'highpass'); alambre(t + 0.01, 165, 0.9, 0.3 * f); alambre(t + 0.03, 247, 0.7, 0.18 * f); },
    fardo: (t, f) => { pum(t, 95, 60, 0.16, 0.55 * f); rafaga(t, 1700, 0.5, 0.22, 0.3 * f); },
    metal: (t, f) => { pum(t, 90, 50, 0.18, 0.6 * f); campana(t, 190, 0.7, 0.4 * f); rafaga(t, 3000, 2, 0.1, 0.3 * f); },
    plastico: (t, f) => { pum(t, 420, 260, 0.06, 0.45 * f); rafaga(t, 2200, 1.5, 0.04, 0.3 * f); },
    goma: (t, f) => { pum(t, 120, 70, 0.2, 0.6 * f); },
    pared: (t, f) => { pum(t, 58, 32, 0.32, 1 * f); rafaga(t, 650, 0.7, 0.2, 0.5 * f); },
    piso: (t, f) => { pum(t, 62, 34, 0.22, 0.8 * f); rafaga(t, 750, 0.6, 0.16, 0.4 * f); },
  };
  const materialDe = (contra) => MATERIAL[contra] || 'piso';

  return {
    // Un choque. contra: con que (ver MATERIAL); fuerza: de 0 a 1 (que tan fuerte suena la cosa); dano: de 0 a 1 (cuanto se
    // abolla el auto: 0 = nada); roto: como esta el auto (0 a 100). Sin "cosa", suena solo la chapa.
    golpe: (t, contra, fuerza, dano, roto, cosa = true) => {
      const m = materialDe(contra), f = Math.max(0, Math.min(1, fuerza));
      if (cosa) SUENA[m](t, 0.3 + 0.7 * f);
      if (dano > 0) chapa(t, (0.12 + 0.5 * Math.min(1, dano)) * (0.55 + roto / 220) * Math.max(ABOLLA[m], cosa ? 0 : 0.6), roto);
    },
    // algo que el auto se llevo puesto (un cono, un poste del alambrado, un fardo...); fuerza: de 0 a 1, segun lo rapido que iba
    voltear: (t, contra, fuerza = 0.5) => SUENA[MATERIAL[contra] || 'madera'](t, 0.3 + 0.7 * Math.max(0, Math.min(1, fuerza))),
    // se cayo al vacio (un golpe enorme, contra el fondo) o volco (la chapa contra el piso, rodando)
    caida: (t, motivo) => {
      if (motivo === 'vuelco') { chapa(t, 0.5, 70); rafaga(t, 500, 0.5, 0.5, 0.35, 'lowpass'); chapa(t + 0.3, 0.35, 70); return; }
      pum(t, 55, 26, 0.5, 1); rafaga(t, 400, 0.6, 0.35, 0.6); chapa(t + 0.02, 0.7, 85); rafaga(t + 0.15, 2600, 0.8, 0.4, 0.2);
    },
    // la meta: el publico grita, alguno silba y suena una corneta
    meta: (t) => {
      const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(), voces = ctx.createGain(), lfo = ctx.createOscillator(), lfo2 = ctx.createOscillator(), prof = ctx.createGain();
      s.buffer = ruido; s.loop = true;
      f.type = 'bandpass'; f.frequency.value = 1150; f.Q.value = 0.55;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.32, t + 0.35);
      g.gain.setValueAtTime(0.32, t + 1.6);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 3.2);
      // (muchas gargantas: el volumen tiembla)
      voces.gain.value = 0.7; lfo.frequency.value = 3.1; lfo2.frequency.value = 5.3; prof.gain.value = 0.3;
      lfo.connect(prof); lfo2.connect(prof); prof.connect(voces.gain);
      s.connect(f); f.connect(voces); voces.connect(g); g.connect(salida);
      s.start(t, azar(0, 1)); lfo.start(t); lfo2.start(t);
      s.stop(t + 3.3); lfo.stop(t + 3.3); lfo2.stop(t + 3.3);
      for (let k = 0; k < 3; k++) {   // silbidos
        const o = ctx.createOscillator(), gs = ctx.createGain(), t0 = t + azar(0.2, 1.4), f0 = azar(2200, 2700);
        o.type = 'sine';
        o.frequency.setValueAtTime(f0, t0);
        o.frequency.exponentialRampToValueAtTime(f0 * 1.25, t0 + 0.12);
        o.frequency.exponentialRampToValueAtTime(f0 * 0.95, t0 + 0.35);
        envolvente(gs, t0, 0.035, 0.03, 0.32);
        o.connect(gs); gs.connect(salida);
        o.start(t0); o.stop(t0 + 0.42);
      }
      for (const [t0, dura] of [[t + 0.15, 0.35], [t + 0.6, 0.7]]) {   // la corneta: dos bocinazos
        const filtro = ctx.createBiquadFilter(), gc = ctx.createGain();
        filtro.type = 'lowpass'; filtro.frequency.value = 1700;
        gc.gain.setValueAtTime(0.0001, t0);
        gc.gain.exponentialRampToValueAtTime(0.05, t0 + 0.02);
        gc.gain.setValueAtTime(0.05, t0 + dura - 0.05);
        gc.gain.exponentialRampToValueAtTime(0.0001, t0 + dura);
        filtro.connect(gc); gc.connect(salida);
        for (const fr of [370, 466]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = fr; o.connect(filtro); o.start(t0); o.stop(t0 + dura + 0.02); }
      }
    },
    // algo suelto del auto que tintinea (un auto muy golpeado, andando)
    suelto: (t) => campana(t, azar(1600, 3200), 0.05, azar(0.04, 0.09)),
    ruido,
  };
}

// --- el sonido del juego ---
//   iniciar()                    arranca (tiene que ser despues de un toque: los navegadores no dejan sonar antes)
//   actualizar(c, roto, dt)      cada cuadro: el motor, el patinaje y, segun el daño (roto: de 0 a 100), lo que suena roto
//   toque(contra, v, roto)       cada cuadro: el choque mas fuerte desde el anterior (v: en m/s; contra: con que; ver
//                                "impacto" y "contra" en vehicle.js). Suena en el momento: el daño las reglas lo cuentan un
//                                poco despues, cuando se sabe cual fue el golpe mas fuerte.
//   voltear(cosas, v)            lo que el auto se llevo puesto (los postes, conos y fardos que voltea), yendo a v m/s
//   caida(motivo)                se cayo al vacio ('caida') o volco ('vuelco')
//   meta()                       la llegada
//   alternar(), mudo()           apagar y prender
export function crearSonido() {
  let ctx = null, golpes = null, motor, grave, aspero, gAspero, filtro, volumen, fallo, volBarro, volVapor, mudo = false, marcha = 0, proximoFallo = 0;
  const TOPES = [0, 5, 10, 16, 40];   // a que velocidad (m/s) pasa cada cambio

  function iniciar() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume().catch(() => {}); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    const salida = ctx.createGain();
    salida.gain.value = 0.5;
    salida.connect(ctx.destination);
    golpes = crearGolpes(ctx, salida);
    // el motor: dos osciladores y, con el auto roto, un tercero desafinado que lo hace sonar aspero
    filtro = ctx.createBiquadFilter(); filtro.type = 'lowpass'; filtro.frequency.value = 400;
    volumen = ctx.createGain(); volumen.gain.value = 0.04;
    fallo = ctx.createGain(); fallo.gain.value = 1;   // (los tironeos de un motor que falla)
    motor = ctx.createOscillator(); motor.type = 'sawtooth';
    grave = ctx.createOscillator(); grave.type = 'square';
    aspero = ctx.createOscillator(); aspero.type = 'square';
    const g2 = ctx.createGain(); g2.gain.value = 0.5;
    gAspero = ctx.createGain(); gAspero.gain.value = 0;
    motor.connect(filtro); grave.connect(g2); g2.connect(filtro); aspero.connect(gAspero); gAspero.connect(filtro);
    filtro.connect(volumen); volumen.connect(fallo); fallo.connect(salida);
    // ruido para el patinaje
    const barro = ctx.createBufferSource(); barro.buffer = golpes.ruido; barro.loop = true;
    const banda = ctx.createBiquadFilter(); banda.type = 'bandpass'; banda.frequency.value = 700; banda.Q.value = 0.7;
    volBarro = ctx.createGain(); volBarro.gain.value = 0;
    barro.connect(banda); banda.connect(volBarro); volBarro.connect(salida);
    // el vapor que pierde un auto muy roto
    const vapor = ctx.createBufferSource(); vapor.buffer = golpes.ruido; vapor.loop = true;
    const agudo = ctx.createBiquadFilter(); agudo.type = 'highpass'; agudo.frequency.value = 3500;
    volVapor = ctx.createGain(); volVapor.gain.value = 0;
    vapor.connect(agudo); agudo.connect(volVapor); volVapor.connect(salida);
    motor.start(); grave.start(); aspero.start(); barro.start(); vapor.start(0, 0.7);
  }

  function actualizar(c, roto = 0, dt = 1 / 60) {
    if (!ctx) return;
    const v = Math.abs(c.velocidad), t = ctx.currentTime;
    if (v > TOPES[marcha + 1] && marcha < 3) marcha++;
    else if (v < TOPES[marcha] - 1.5 && marcha > 0) marcha--;
    // vueltas del motor entre 0 y 1: suben con la velocidad dentro del cambio y cuando patina
    const vueltas = Math.max(0.12, Math.min(1, 0.18 + 0.75 * (v - TOPES[marcha]) / (TOPES[marcha + 1] - TOPES[marcha]) * (0.5 + c.gas * 0.5) + c.patina * 0.55 * c.gas + c.gas * 0.12));
    motor.frequency.setTargetAtTime(42 + vueltas * 105, t, 0.06);
    grave.frequency.setTargetAtTime(21 + vueltas * 52, t, 0.06);
    aspero.frequency.setTargetAtTime((42 + vueltas * 105) * 1.47, t, 0.06);
    filtro.frequency.setTargetAtTime(260 + vueltas * 900 + c.gas * 700, t, 0.05);
    volumen.gain.setTargetAtTime(mudo ? 0 : 0.035 + c.gas * 0.075, t, 0.05);
    volBarro.gain.setTargetAtTime(mudo ? 0 : Math.min(0.09, c.patina * 0.09 + (c.agua > 0.05 ? v * 0.006 : 0)), t, 0.08);
    // --- un auto roto suena roto ---
    // desde un tercio de daño el motor se pone aspero; desde la mitad falla (tironea) cuando se acelera; desde los tres
    // cuartos pierde vapor. Y andando rapido, algo suelto tintinea (mas seguido cuanto mas roto)
    const dano = Math.max(0, Math.min(100, roto));
    gAspero.gain.setTargetAtTime(mudo ? 0 : Math.max(0, dano - 30) / 70 * 0.55, t, 0.2);
    volVapor.gain.setTargetAtTime(mudo ? 0 : Math.max(0, dano - 75) / 25 * 0.03, t, 0.3);
    if (mudo || !golpes) return;
    if (dano > 50 && c.gas > 0.3 && t > proximoFallo && Math.random() < (dano - 50) / 50 * 3 * dt) {
      fallo.gain.cancelScheduledValues(t);
      fallo.gain.setValueAtTime(1, t);
      fallo.gain.linearRampToValueAtTime(0.12, t + 0.025);
      fallo.gain.linearRampToValueAtTime(1, t + 0.14);
      proximoFallo = t + 0.25;
    }
    if (dano > 20 && v > 4 && Math.random() < (dano - 20) / 80 * Math.min(1, v / 25) * 4 * dt) golpes.suelto(t);
  }

  const puede = () => ctx && golpes && !mudo;
  // Un choque suena si pasa de cierta fuerza: el piso, desde 3 m/s (asi un camino con pozos no hace ruido todo el tiempo);
  // lo demas, desde 2. Desde 5 m/s el golpe le hace daño al auto (ver "golpes" en config.js) y cruje la chapa: mas cuanto
  // mas fuerte. Despues de sonar, un momento de silencio (un choque dura varios cuadros).
  let ultimoToque = 0;
  const toque = (contra, v, roto) => {
    if (!puede() || !(v > (contra === 'piso' ? 3 : 2)) || ctx.currentTime - ultimoToque < 0.12) return;
    const sevoltea = SE_VOLTEA.has(contra), dano = Math.max(0, (v - JUEGO.golpes.desde) * JUEGO.golpes.porMetro / 25);   // (25 puntos: un golpe grande)
    if (sevoltea && !dano) return;   // (eso suena al voltearlo)
    ultimoToque = ctx.currentTime;
    golpes.golpe(ctx.currentTime, contra, (v - 2) / 14, dano, roto, !sevoltea);
  };
  const voltear = (cosas, v = 10) => { if (puede()) cosas.slice(0, 4).forEach((o, k) => golpes.voltear(ctx.currentTime + k * 0.04, o.clase === 'objeto' ? o.tipo : o.clase, v / 20)); };
  const caida = (motivo) => { if (puede()) golpes.caida(ctx.currentTime, motivo); };
  const meta = () => { if (puede()) golpes.meta(ctx.currentTime + 0.05); };

  // alternar: prende o apaga el sonido, y devuelve si quedo apagado
  return { iniciar, actualizar, toque, voltear, caida, meta, alternar: () => { mudo = !mudo; return mudo; }, mudo: () => mudo };
}

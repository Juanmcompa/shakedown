// La Travesia: un modo aparte de la pista del dia. Un camino infinito y cada vez peor (medanos, barro, rios, fesh-fesh, piedras negras),
// con cartas: cada tantos km el auto se frena y se elige 1 de 3 problemas, el menos malo. No es justo, y cada vez que
// se larga sale algo distinto. Gana el que llega mas lejos.
//
// Este archivo es el modo: las reglas de la corrida, el ciclo de cada cuadro y las pantallas propias (las cartas, el resultado).
// Lo demas se arma en otros archivos: el camino y el terreno (travesiaterreno.js), como se dibuja (travesiamundo.js) y las
// cartas (cartas.js). El auto, la camara y los efectos son los de siempre. La pista del dia y los circuitos no cambian.
//
// Fin de la corrida: el auto se rompe (daño al maximo) o se queda parado mucho rato. No hay limite de tiempo.
// Salirse del camino: se vuelve como siempre, pero en vez de recargo de tiempo suma daño.
import * as THREE from '../vendor/three.module.js';
import { JUEGO, TRAVESIA, SUELO, SUELOS } from './config.js';
import { crearTerrenoTravesia } from './travesiaterreno.js';
import { crearMundoTravesia } from './travesiamundo.js';
import { crearAuto, enSerio } from './vehicle.js';
import { crearTrazadaTravesia } from './travesiatrazada.js';
import { crearDibujo } from './autos.js';
import { crearCamara } from './camera.js';
import { crearEfectos } from './fx.js';
import { crearCopiloto } from './copiloto.js';
import { configDe, codigoDe } from './partes.js';
import { estadoInicial, sortear, aplicar, mecanicoLoco, cartaDe, CARTAS, PROBLEMAS, ARREGLOS } from './cartas.js';
import { icono } from './iconos.js';
import { crearGuiaTravesia } from './travesiaguia.js';
import { enlaceDeTravesia } from './travesiaenlace.js';

const $ = (id) => document.getElementById(id);
const lim = (v, a, b) => (v < a ? a : v > b ? b : v);
const QUIETO = { x: 0, y: 0, mano: true };
const suave = (t) => { t = lim(t, 0, 1); return t * t * (3 - 2 * t); };
const ARENOSOS = [SUELOS.arena.id, SUELOS.feshfesh.id];
// "a mucha velocidad" y "a alta velocidad" de las cartas, como parte de la velocidad maxima del auto de turno
// (la Vitarita llega a unos 97 km/h: los 100 y 120 de otros autos serian imposibles de alcanzar)
const RAPIDO = 0.82, MUY_RAPIDO = 0.9;
const coma = (km) => km.toFixed(1).replace('.', ',');
const CLAVE_RECORD = 'travesiaKm';
const MOTIVOS = { roto: ['dano', 'El auto no aguantó más'], quieto: ['cono', 'Te quedaste parado'], bateria: ['bateria', 'Se acabó la batería'] };
const FINALES = { roto: '💥', quieto: '🛑', bateria: '🔋' };

// ------------------------------------------------------------------------------------------------------------------
// El piloto automatico. No es para el que juega: lo usan las pruebas para recorrer km sin que nadie maneje.
// Mira unos metros adelante del camino y esquiva las piedras (busca la linea con mas lugar libre), y frena en las curvas.
// ------------------------------------------------------------------------------------------------------------------
export function crearPiloto() {
  let corrida = 0, atras = 0, lado = 0;
  return function piloto(T, c, indice, ent, dt) {
    const P = T.camino, v = c.velocidad;
    // marcha atras si se quedo trabado
    if (atras > 0) { atras -= dt; ent.y = -1; ent.x = -lado; ent.mano = false; return; }
    if (Math.abs(v) < 0.8) corrida += dt; else corrida = 0;
    if (corrida > 1.6) { atras = 1.4; lado = Math.sign(ent.x) || 1; corrida = 0; }
    // la linea con mas lugar: se prueban desvios a los costados (sin salirse del camino, que es angosto) y se elige el que deja mas
    // lejos de las piedras y de los autos rotos
    const adelante = 8 + Math.max(0, v) * 1.1, medio = Math.max(0.6, P.W[indice] / 2 - 0.9);
    let mejor = 0, costoMejor = 1e9;
    for (let off = -medio; off <= medio + 0.01; off += Math.max(0.35, medio / 4)) {
      let costo = Math.abs(off) * 0.4 + Math.abs(off - lado) * 0.1;
      for (let u = 4; u <= adelante + 22; u += 4) {
        const i = Math.min(P.n - 1, indice + Math.round(u));
        const x = P.X[i] - P.HZ[i] * off, z = P.Z[i] + P.HX[i] * off, lista = T.cosasCerca(x, z);
        if (!lista) continue;
        for (const o of lista) { const d = Math.hypot(o.x - x, o.z - z) - o.r; if (d < 2.3) costo += (2.3 - d) * 9 / (1 + u * 0.06); }
      }
      if (costo < costoMejor) { costoMejor = costo; mejor = off; }
    }
    lado = lado * 0.9 + mejor * 0.1;
    const m = Math.min(P.n - 1, indice + Math.round(adelante));
    const tx = P.X[m] - P.HZ[m] * mejor, tz = P.Z[m] + P.HX[m] * mejor;
    const rumboCar = Math.atan2(c.adelante[0], -c.adelante[2]), rumboObj = Math.atan2(tx - c.pos[0], -(tz - c.pos[2]));
    let e = rumboObj - rumboCar;
    e = Math.atan2(Math.sin(e), Math.cos(e));
    ent.x = lim(e * 2.4, -1, 1);
    // la velocidad que conviene, segun cuanto dobla el camino mas adelante
    const k = Math.min(P.n - 1, indice + 34);
    let giro = Math.atan2(P.HX[k], -P.HZ[k]) - Math.atan2(P.HX[indice], -P.HZ[indice]);
    giro = Math.abs(Math.atan2(Math.sin(giro), Math.cos(giro)));
    // (en un camino angosto no hay margen: mas despacio en las curvas y cerca de lo que esquiva)
    const quiero = Math.max(8, 20 - giro * 13 - costoMejor * 0.7);
    ent.y = v > quiero + 2 ? -0.4 : v > quiero ? 0 : 1;
    ent.mano = false;
  };
}

// ------------------------------------------------------------------------------------------------------------------
// o: lo que el juego le presta al modo
//   render, post, liviano, club, sonido, hud, teclas, raiz
//   festejo(): la gente de la largada grita (el juego tira unos papelitos)
//   portada(si): muestra o esconde la portada.   mandos(): prende los mandos del celular.
//   voz(): si el copiloto habla.   camara(): el id de la camara que se eligio.
//   record(km): se hizo un record nuevo (el juego lo manda al servidor).   amigos(): los records de los amigos y el propio, de mayor a
//   menor (ver travesiaTabla en club.js).   refrescar(): promesa de traer los records de los clubes.   renombrar(): se cambio el nombre.
// ------------------------------------------------------------------------------------------------------------------
export function crearModoTravesia(o) {
  const { render, post, liviano, club, sonido, hud, teclas, raiz } = o;
  let activa = false, fase = 'afuera';   // afuera, guia (la explicacion de la primera vez), cuenta, corriendo, cartas, espera (el auto se rompio: un instante antes del resultado) y fin
  let T = null, c = null, C = null, base = null, e = null, dibujo = null, codigoDibujo = '', copiloto = null, rnd = Math.random;
  let indice = 0, mejor = 0, lejos = 0, resto = 0, reloj = 0, cuenta = 0, tEspera = 0, motivoFin = '', proximaCarta = TRAVESIA.kmPorCarta;
  let golpe = 0, contra = '', tGolpe = 0, tVolcado = 0, tFuera = 0, tSinAvance = 0, mejorAntes = 0, tFondo = 0, calor = 0, armada = false, volvio = 0, vistas = 0;
  let cola = [], gasEfectivo = 0, mano = [], restaurarNiebla = null;
  // las averias de las cartas que llevan cuenta propia
  let tApagado = 0, frenadas = [], frenando = false, sinFreno = false, invierte = 0, proxInsol = 10, tFalsa = 3, tInstr = 0, numInstr = 0, tAceite = 0, avisoParado = false;
  let callados = [];   // rangos de metros del camino sin notas del copiloto ("notas voladas")
  const ent = { x: 0, y: 0, mano: false }, manda = { x: 0, y: 0, mano: false };
  const piloto = crearPiloto(), depuracion = { piloto: false, invulnerable: false };

  // lo que no cambia de una corrida a otra: la escena, el mundo, la camara y los efectos se arman la primera vez
  const escena = new THREE.Scene();
  const mundo = crearMundoTravesia(escena, liviano);
  const trazada = crearTrazadaTravesia(escena);   // la linea pintada en el camino: en este modo arranca siempre prendida (la T la apaga)
  const camara = crearCamara({ altura: (x, z) => (T ? T.altura(x, z) : 0) });
  // (las huellas las lleva cada pedazo de terreno: ver travesiahuellas.js; y el polvo es la polvareda grande, que queda flotando)
  const fx = crearEfectos(escena, mundo.huellas, 1, [0.6, 0.3], liviano, { grande: true });

  // ---------------------------------------------------------------- el record, en este aparato
  const record = () => { try { return Number(club.gusto(CLAVE_RECORD)) || 0; } catch (x) { return 0; } };
  const guardarRecord = (km) => { try { club.gusto(CLAVE_RECORD, Math.round(km * 100) / 100); } catch (x) { /* sin memoria: no pasa nada */ } };

  // ---------------------------------------------------------------- la guia de la primera vez
  // Se abre sola al entrar la primera vez (con la corrida lista y la cuenta regresiva esperando); despues se puede volver a ver
  // desde "Como se juega" y desde la categoria Aventura (ahi no hay nada en pausa: se abre sobre los paneles).
  const CLAVE_GUIA = 'travesiaGuia';
  const vistaLaGuia = () => { try { return !!club.gusto(CLAVE_GUIA); } catch (x) { return false; } };
  const guia = crearGuiaTravesia({
    alCerrar: () => {
      try { club.gusto(CLAVE_GUIA, 1); } catch (x) { /* sin memoria: se vuelve a mostrar */ }
      if (fase === 'guia') { fase = 'cuenta'; cuenta = JUEGO.cuenta; cuentaDicha = 0; }
    },
  });

  // ---------------------------------------------------------------- las pantallas propias
  function pintarActivas() {
    const caja = $('cartasActivas');
    caja.textContent = '';
    for (const id of e ? e.cartas : []) {
      const k = cartaDe(id), img = document.createElement('img');
      img.className = 'icono'; img.alt = k.nombre; img.title = k.nombre + ': ' + k.texto; img.src = icono(k.icono, k.color);
      img.dataset.tipo = k.tipo;
      caja.append(img);
    }
    caja.hidden = !caja.childElementCount;
  }
  function pintarVidrio() {
    const v = $('vidrio');
    v.hidden = !e || e.vidrio < 0;
    if (!v.hidden) v.dataset.parte = String(e.vidrio);
    // lo que se ve en la cabina: la arena en los ojos (bordes oscuros) y la tormenta de polvo (se va el tablero)
    $('arenaOjos').hidden = !e || !e.arenaOjos;
    raiz.classList.toggle('sin-tablero', !!e && e.polvoCabina);
  }
  // el dibujo del vidrio roto: un manchon lechoso con grietas que salen de una esquina (unos pocos pixeles, ampliados)
  function dibujarVidrio() {
    const l = document.createElement('canvas');
    l.width = 40; l.height = 36;
    const g = l.getContext('2d'), r = (() => { let a = 7; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; })();
    g.fillStyle = 'rgba(232,238,244,.5)';
    g.beginPath(); g.moveTo(0, 0); g.lineTo(40, 0); g.lineTo(34, 14); g.lineTo(27, 22); g.lineTo(15, 30); g.lineTo(0, 36); g.fill();
    for (let k = 0; k < 9; k++) {
      let x = 0, y = 0, a = k * 0.19 + 0.05;
      for (let s = 0; s < 14; s++) {
        const nx = x + Math.cos(a) * 3, ny = y + Math.sin(a) * 3;
        g.fillStyle = 'rgba(255,255,255,.95)'; g.fillRect(Math.round(nx), Math.round(ny), 1, 1);
        g.fillStyle = 'rgba(30,30,34,.55)'; g.fillRect(Math.round(nx) + 1, Math.round(ny) + 1, 1, 1);
        x = nx; y = ny; a += (r() - 0.5) * 0.7;
        if (x > 40 || y > 36) break;
      }
    }
    $('vidrio').style.backgroundImage = 'url(' + l.toDataURL() + ')';
  }
  dibujarVidrio();

  function mostrarCartas() {
    const lista = sortear(e, 3, rnd);
    mano = lista;
    const caja = $('cartasMano');
    caja.textContent = '';
    lista.forEach((k, n) => {
      const b = document.createElement('button'), img = document.createElement('img'), t = document.createElement('b'), x = document.createElement('span'), num = document.createElement('i');
      b.type = 'button'; b.className = 'carta ' + k.tipo; b.dataset.id = k.id;
      b.setAttribute('aria-label', k.nombre + ': ' + k.texto);
      img.className = 'icono'; img.alt = ''; img.src = icono(k.icono, k.color);
      t.textContent = k.nombre; x.className = 'carta-texto'; x.textContent = k.texto;
      num.textContent = String(n + 1);
      b.append(img, t, x, num);
      b.addEventListener('click', () => elegir(n));
      caja.append(b);
    });
    $('cartasKm').textContent = coma(mejorKm()) + ' km';
    $('cartas').hidden = false;
    const primera = caja.firstElementChild;
    if (primera) primera.focus({ preventScroll: true });
    fase = 'cartas';
    hud.llamar(false); hud.grande(''); hud.aviso('');
  }
  // lo que hay que poner al dia cuando el auto suma una carta
  function despuesDeCarta() {
    // notas voladas: los proximos 2 km, sin notas (las que ya estaban armadas por delante se sacan)
    while (e.voladas > 0) { e.voladas--; const r = { desde: indice, hasta: indice + 2000 }; callados.push(r); copiloto.callar(r.desde, r.hasta); }
    pintarActivas(); pintarVidrio(); marearNotas();
  }
  function elegir(n) {
    if (fase !== 'cartas' || !mano[n]) return false;
    const k = mano[n];
    aplicar(e, k, rnd);
    $('cartas').hidden = true;
    despuesDeCarta();
    hud.aviso(k.nombre, 2.2, k.icono);
    mano = [];
    fase = 'corriendo';
    tSinAvance = 0; resto = 0;
    return true;
  }

  function mostrarFin() {
    fase = 'fin';
    hud.mostrar(false); hud.llamar(false); hud.aviso(''); hud.grande('');
    const km = mejorKm(), antes = record(), nuevo = km > antes && km > 0;
    if (nuevo) { guardarRecord(km); if (o.record) o.record(km); }
    const [ico, texto] = MOTIVOS[motivoFin] || MOTIVOS.roto;
    $('tfMotivo').textContent = texto;
    $('tfMotivo').dataset.icono = ico;
    $('tfMotivo').querySelector(':scope > img.icono')?.remove();
    { const img = document.createElement('img'); img.className = 'icono'; img.alt = ''; img.src = icono(ico); $('tfMotivo').prepend(img); }
    $('tfKm').textContent = coma(km);
    $('tfRecord').textContent = nuevo ? '¡Nuevo récord!' : 'Tu récord: ' + coma(Math.max(antes, km)) + ' km';
    $('tfRecord').classList.toggle('nuevo', nuevo);
    const caja = $('tfCartas');
    caja.textContent = '';
    for (const id of e.cartas) {
      const k = cartaDe(id), img = document.createElement('img');
      img.className = 'icono'; img.alt = k.nombre; img.title = k.nombre + ': ' + k.texto; img.src = icono(k.icono, k.color); img.dataset.tipo = k.tipo;
      caja.append(img);
    }
    $('tfCompartido').textContent = '';
    $('tfNombre').value = club.nombre();
    pintarAmigos();
    if (o.refrescar) Promise.resolve(o.refrescar()).then(() => { if (fase === 'fin') pintarAmigos(); }).catch(() => {});
    $('travesiaFin').hidden = false; $('cartasActivas').hidden = true;
    $('tfOtra').focus({ preventScroll: true });
  }
  // La tabla de records de los amigos (y el propio): los primeros, y el propio si queda mas abajo. Sin fantasma: cada camino es distinto.
  const MUESTRA = 6;
  function pintarAmigos() {
    const lista = o.amigos ? o.amigos() : [], ol = $('tfTabla');
    ol.textContent = '';
    $('tfAmigos').hidden = !lista.some((x) => !x.mio);
    if ($('tfAmigos').hidden) return;
    lista.forEach((r, k) => {
      if (k >= MUESTRA && !(r.mio)) return;
      const li = document.createElement('li'), puesto = document.createElement('span'), auto = document.createElement('span'), quien = document.createElement('span'), km = document.createElement('b');
      if (r.mio) li.className = 'mio';
      puesto.className = 'puesto'; puesto.textContent = String(k + 1);
      auto.className = 'emoji'; auto.textContent = configDe(r.auto).emoji;
      quien.className = 'quien'; quien.textContent = r.nombre || (r.mio ? 'Vos' : '?');
      const cod = document.createElement('small'); cod.className = 'codigo-auto'; cod.textContent = codigoDe(r.auto); quien.append(cod);
      km.textContent = coma(r.km) + ' km';
      li.append(puesto, auto, quien, km);
      ol.append(li);
    });
  }
  // Shakedown Travesía 🏜️ 23,4 km 🃏11 💥   y abajo, las cartas juntadas como emojis
  function textoParaCompartir() {
    const km = mejorKm(), fin = FINALES[motivoFin] || '💥';
    const lineas = ['Shakedown Travesía 🏜️ ' + coma(km) + ' km 🃏' + e.cartas.length + ' ' + fin];
    if (e.cartas.length) lineas.push(e.cartas.map((id) => cartaDe(id).emoji).join(''));
    // el link solo dice quien es y cuantos km: sin pista ni fantasma (el camino es distinto cada vez)
    lineas.push(location.origin + location.pathname + enlaceDeTravesia(club.nombre(), Math.max(km, record())));
    return lineas.join('\n');
  }
  async function compartir() {
    const salida = $('tfCompartido');
    if (!club.nombre()) { $('tfNombre').focus(); salida.textContent = 'Poné tu nombre para compartir.'; return; }
    const texto = textoParaCompartir();
    try {
      if (navigator.share && window.matchMedia('(pointer: coarse)').matches) { await navigator.share({ text: texto }); return; }
      await navigator.clipboard.writeText(texto);
      salida.textContent = 'Copiado. Pegalo en el grupo.';
    } catch (x) {
      if (x && x.name === 'AbortError') return;
      salida.textContent = 'No pude copiarlo. Copialo de acá: ' + texto.replace(/\n/g, ' ');
    }
  }
  $('tfOtra').addEventListener('click', () => nuevaCorrida());
  $('tfCompartir').addEventListener('click', compartir);
  // el nombre se puede poner (o cambiar) aca mismo; si ya hay un record, se manda de nuevo al servidor con el nombre
  $('tfNombre').addEventListener('change', () => {
    club.ponerNombre($('tfNombre').value);
    $('tfNombre').value = club.nombre(); $('tfCompartido').textContent = '';
    if (o.renombrar) o.renombrar();
    pintarAmigos();
  });
  $('tfNombre').addEventListener('keydown', (ev) => { ev.stopPropagation(); if (ev.key === 'Enter') $('tfNombre').blur(); });
  $('tfSalir').addEventListener('click', () => salir());

  // ---------------------------------------------------------------- una corrida
  const mejorKm = () => Math.max(0, mejor - 8) / 1000;
  // el copiloto: las notas salen del camino, a medida que se arma. Las del "copiloto mareado" van al reves, una de cada diez.
  const alReves = (n) => n.tipo === 'curva' && e && e.mareado && n.k % 10 === 4;
  function ponerLado(n) { n.lado = alReves(n) ? (n.real === 'der' ? 'izq' : 'der') : n.real; }
  function pasarNotas() {
    while (vistas < T.notas.length) {
      const n = { ...T.notas[vistas++] };
      if (callados.some((q) => n.i >= q.desde && n.i < q.hasta)) continue;
      n.real = n.lado; ponerLado(n);
      copiloto.notas.push(n);
    }
  }
  function marearNotas() { for (const n of copiloto.notas) if (n.tipo === 'curva') ponerLado(n); }

  // ajusta el auto a lo que dicen las cartas (cada cuadro: asi las cartas se suman y se sacan solas)
  function ajustarAuto() {
    const duro = SUELO[c.suelo] && SUELO[c.suelo].blando < 0.5, arenoso = ARENOSOS.includes(c.suelo), v = Math.max(0, c.velocidad);
    C.potencia = base.potencia * e.potencia * (calor > 0 ? 0.42 : 1) * (e.lisos && duro ? 1.73 : 1) * (e.filtro && arenoso ? 0.8 : 1);   // (1,2 de velocidad pide 1,73 de potencia: la velocidad sube con la raiz cubica)
    // embrague quemado: de parado, el empuje es un tercio, y se va normalizando hasta los 9 m/s
    C.empuje = base.empuje * e.empuje * (calor > 0 ? 0.55 : 1) * (e.embrague ? 0.34 + 0.66 * Math.min(1, v / 9) : 1);
    C.frenos = base.frenos * e.frenos;
    C.alturaLateral = Math.min(0.97, base.alturaLateral * e.vuelca);
  }
  // los neumaticos lisos agarran poco en lo blando: la consulta del suelo del terreno pasa por aca
  function ajusteDeSuelo(s) {
    if (!e || !e.lisos) return;
    const blando = SUELO[s.id].blando;
    if (blando >= 0.9) s.agarre *= 0.28;
    else if (blando >= 0.5) s.agarre *= 0.8;
  }
  function filtrarEntrada(dt) {
    const rel = vTope > 0 ? Math.max(0, c.velocidad) / vTope : 0;
    let x = ent.x, y = ent.y;
    // direccion hidraulica muerta: a alta velocidad el volante dobla la mitad
    if (e.direccion) x *= 1 - 0.5 * suave((rel - 0.4) / 0.4);
    // golpe de calor: de a ratos, 2 segundos con la direccion al reves
    if (e.insolacion) {
      if (invierte > 0) { invierte -= dt; x = -x; }
      else if ((proxInsol -= dt) <= 0) { invierte = 2; proxInsol = 9 + rnd() * 12; hud.aviso('Golpe de calor', 2, 'termometro'); }
    }
    x = lim(x + e.sesgo, -1, 1);   // (el eje torcido y el pinchazo)
    // bujias empastadas: el acelerador responde tarde (el freno, no)
    if (e.retrasoGas > 0) {
      cola.push([reloj, Math.max(0, ent.y)]);
      while (cola.length && cola[0][0] <= reloj - e.retrasoGas) gasEfectivo = cola.shift()[1];
      y = ent.y < 0 ? ent.y : gasEfectivo;
    } else { cola.length = 0; gasEfectivo = 0; }
    // caja trabada: pasada cierta velocidad, no acelera mas
    if (e.vmax < 1 && c.velocidad > vTope * e.vmax) y = Math.min(y, 0);
    // radiador perforado: a fondo mas de 3 segundos seguidos, pierde potencia un rato
    if (e.recalienta) {
      tFondo = y > 0.95 && c.velocidad > 1 ? tFondo + dt : Math.max(0, tFondo - dt * 2);
      if (tFondo > 3 && calor <= 0) { calor = 5; tFondo = 0; hud.aviso('Recalentado', 2, 'termometro'); }
    }
    if (calor > 0) calor -= dt;
    // correa floja: a mucha velocidad, de golpe se apaga el motor un segundo
    if (e.correa) {
      if (tApagado > 0) { tApagado -= dt; y = Math.min(y, 0); }
      else if (rel > RAPIDO - 0.1 && rnd() < dt * 0.3) { tApagado = 1; hud.aviso('Motor apagado', 1.2, 'motor'); }
    }
    // liquido de frenos hirviendo: dos frenadas fuertes en 5 s y la tercera no frena (hasta que se suelta el pedal)
    if (e.hierve) {
      if (ent.y < -0.3 && c.velocidad > 6 && !frenando) {
        frenando = true;
        frenadas = frenadas.filter((t) => reloj - t < 5);
        if (frenadas.length >= 2) { sinFreno = true; frenadas.length = 0; hud.aviso('Frenos hirviendo', 1.8, 'termometro'); } else frenadas.push(reloj);
      } else if (frenando && ent.y > -0.1) { frenando = false; sinFreno = false; }
      if (sinFreno && y < 0) y = 0;
    }
    manda.x = x; manda.y = y; manda.mano = e.mano && ent.mano;
    return manda;
  }
  let vTope = 27;

  function apoyar(i) {
    c.poner(T.camino.X[i], T.camino.Z[i], Math.atan2(T.camino.HX[i], -T.camino.HZ[i]));
    indice = i; lejos = -T.camino.W[i] / 2;
    golpe = tGolpe = tVolcado = tFuera = tSinAvance = 0;
    fx.cortar(); camara.saltar();
  }
  // volver al camino unos metros antes de donde quedo: cuesta daño (no tiempo)
  function volver(motivo) {
    if (fase !== 'corriendo') return;
    e.roto = Math.min(100, e.roto + TRAVESIA.danoAlVolver);
    apoyar(Math.max(8, indice - 6));
    c.impacto = 0;
    hud.grande('+' + TRAVESIA.danoAlVolver, 1.4, 'rojo');
    hud.aviso(motivo === 'afuera' ? 'Te fuiste lejos del camino' : motivo === 'vuelco' ? 'Volcaste' : '', 2.2);
    if (e.roto >= 100 && !depuracion.invulnerable) terminar('roto');
  }
  function terminar(motivo) {
    if (fase !== 'corriendo') return;
    fase = 'espera'; motivoFin = motivo; tEspera = 1.4;
    hud.aviso(''); hud.llamar(false);
  }

  // las reglas de la corrida, una vez por cuadro
  function reglas(dt) {
    const P = T.camino;
    indice = T.indice(c.pos[0], c.pos[2], indice);
    lejos = Math.hypot(c.pos[0] - P.X[indice], c.pos[2] - P.Z[indice]) - P.W[indice] / 2;
    mejor = Math.max(mejor, indice);
    // daño: de cada choque cuenta el golpe mas fuerte (igual que en la pista del dia)
    if (c.impacto > golpe) { golpe = c.impacto; contra = c.contra; }
    c.impacto = 0;
    if (golpe > JUEGO.golpes.desde && tGolpe === 0) tGolpe = reloj;
    if (tGolpe > 0 && reloj - tGolpe > 0.25) {
      let suma = (golpe - JUEGO.golpes.desde) * JUEGO.golpes.porMetro / ((c.datos && c.datos.aguante) || 1) * e.golpes;
      if (contra !== 'piso') suma *= e.golpeCosas;      // chasis fisurado: los choques contra piedras y arboles pegan mas
      if (!depuracion.invulnerable) e.roto = Math.min(100, e.roto + suma);
      camara.sacudir(golpe);
      const dijo = mecanicoLoco(e, golpe, rnd);
      if (dijo) { hud.aviso(dijo, 2.6, 'llave'); despuesDeCarta(); }
      golpe = tGolpe = 0;
      if (e.roto >= 100) return terminar('roto');
    } else if (tGolpe === 0) golpe = 0;
    // problemas: volcar o irse lejos (se vuelve solo, y cuesta daño)
    tVolcado = c.arriba[1] < 0.35 ? tVolcado + dt : 0;
    tFuera = lejos > JUEGO.afuera || !(c.pos[1] === c.pos[1]) ? tFuera + dt : 0;
    if (tFuera > 1.2) return volver('afuera');
    if (tVolcado > 2) return volver('vuelco');
    // parado mucho rato: se termina. Si se puede avanzar un poco mas, se sigue.
    if (mejor > mejorAntes + 1.5) { mejorAntes = mejor; tSinAvance = 0; } else tSinAvance += dt;
    if (tSinAvance > 3.5) { hud.aviso('Parado: ' + Math.max(0, Math.ceil(TRAVESIA.quieto - tSinAvance)) + ' s', 0, 'cono'); avisoParado = true; }
    else if (avisoParado) { hud.aviso(''); avisoParado = false; }   // (solo se saca el cartel de "parado": los otros avisos duran lo suyo)
    hud.llamar(tSinAvance > 3.5);
    if (tSinAvance > TRAVESIA.quieto && !depuracion.invulnerable) return terminar('quieto');
    // bateria agotada: si el auto llega a 0 km/h, se termino
    if (e.bateria) {
      if (c.velocidad > 3) armada = true;
      else if (armada && Math.abs(c.velocidad) < 0.3 && !depuracion.invulnerable) return terminar('bateria');
    }
    // sin lubricante: a mucha velocidad el motor se daña de a poco
    if (e.aceite && c.velocidad > vTope * RAPIDO && !depuracion.invulnerable) {
      e.roto = Math.min(100, e.roto + dt * 0.7);
      if ((tAceite -= dt) <= 0) { tAceite = 5; hud.aviso('Motor sin lubricante', 1.6, 'tacho'); }
      if (e.roto >= 100) return terminar('roto');
    }
    // una carta cada tantos km
    if (mejorKm() >= proximaCarta) { proximaCarta += TRAVESIA.kmPorCarta; mostrarCartas(); }
  }

  // alucinaciones: de a una, aparecen piedras falsas por delante (no se chocan) y se van al tocarlas o cuando quedan atras
  function alucinar(dt) {
    const lista = mundo.falsas.lista;
    if (e.alucina && fase === 'corriendo' && (tFalsa -= dt) <= 0 && lista.length < 4) {
      tFalsa = 2.2 + rnd() * 3;
      const P = T.camino, i = Math.min(P.n - 1, indice + 28 + Math.floor(rnd() * 32)), lado = (rnd() * 2 - 1) * (P.W[i] / 2 - 1);
      const x = P.X[i] - P.HZ[i] * lado, z = P.Z[i] + P.HX[i] * lado;
      mundo.falsas.poner(x, T.altura(x, z), z);
    }
    for (let k = lista.length - 1; k >= 0; k--) {
      const f = lista[k].position, dx = f.x - c.pos[0], dz = f.z - c.pos[2];
      if (Math.hypot(dx, dz) < 2.4 || dx * c.adelante[0] + dz * c.adelante[2] < -14) mundo.falsas.quitar(k);
    }
  }

  // todo lo que pasa en un cuadro menos dibujar (tambien lo usan las pruebas)
  function actualizar(dt) {
    if (fase === 'cartas' || fase === 'fin' || fase === 'afuera' || fase === 'guia') return;
    reloj += dt;
    if (fase === 'cuenta') {
      cuenta -= dt;
      const n = Math.ceil(cuenta);
      if (n > 0 && n !== cuentaDicha) { cuentaDicha = n; hud.grande(String(n), 0.95, 'cuenta'); }
      if (cuenta <= 0) {
        fase = 'corriendo'; c.impacto = 0; hud.grande('¡YA!', 0.9, 'ya');
        // al salir, grita la gente de la largada (y salen unos papelitos, si estan los efectos)
        sonido.meta();
        if (o.festejo) o.festejo();
      }
    }
    let m = QUIETO;
    if (fase === 'corriendo') {
      if (depuracion.piloto) piloto(T, c, indice, ent, dt); else teclas.leer(ent);
      m = filtrarEntrada(dt);
      ajustarAuto();
    }
    resto += dt;
    while (resto >= JUEGO.paso) { c.paso(m, JUEGO.paso); resto -= JUEGO.paso; }
    if (fase === 'corriendo') { sonido.toque(c.contra, c.impacto, e.roto); reglas(dt); alucinar(dt); }
    else if (fase === 'espera') { indice = T.indice(c.pos[0], c.pos[2], indice); if ((tEspera -= dt) <= 0) mostrarFin(); }
    // el camino se arma por delante y se tira lo de atras
    T.asegurar(indice);
    T.podar(indice);
    pasarNotas();
    trazada.actualizar(T, indice);
  }
  let cuentaDicha = 0;

  function nuevaCorrida() {
    const semilla = (Math.random() * 4294967295) >>> 0;
    rnd = Math.random;
    $('travesiaFin').hidden = true; $('cartas').hidden = true;
    mundo.vaciar();   // (tambien tira las piedras falsas y las huellas)
    T = crearTerrenoTravesia(semilla);
    T.ajuste = ajusteDeSuelo;
    mundo.usar(T);
    e = estadoInicial();
    // el auto que se eligio en el garaje (una copia: las cartas le cambian numeros)
    const codigo = club.auto();
    // siempre en "rally serio" (ver SERIO en config.js), sin ayuda de manejo, diga lo que diga el gusto guardado
    C = enSerio({ ...configDe(codigo) });
    base = { potencia: C.potencia, empuje: C.empuje, frenos: C.frenos, alturaLateral: C.alturaLateral, aire: C.aire };
    vTope = Math.cbrt(base.potencia / base.aire);   // (la velocidad a la que se frena la potencia contra el aire, sin cuestas)
    c = crearAuto(T, C);
    if (!dibujo || codigoDibujo !== codigo) {
      if (dibujo) escena.remove(dibujo.grupo);
      dibujo = crearDibujo(escena, configDe(codigo)); codigoDibujo = codigo;
    }
    dibujo.limpiar();
    copiloto = crearCopiloto({ vuelta: null, etapa: { tramos: [] }, meta: { i: 1e9 } });
    copiloto.notas.length = 0; copiloto.reiniciar(); vistas = 0;
    copiloto.voz(o.voz());
    indice = 0; mejor = mejorAntes = 8; resto = 0; reloj = 0; motivoFin = ''; proximaCarta = TRAVESIA.kmPorCarta;
    tGolpe = golpe = tVolcado = tFuera = tSinAvance = tFondo = calor = 0; armada = false; cola = []; gasEfectivo = 0; mano = [];
    tApagado = invierte = tInstr = tAceite = 0; frenadas = []; frenando = sinFreno = avisoParado = false; proxInsol = 8 + rnd() * 8; tFalsa = 3; callados = [];
    const g = T.largada;
    c.poner(g.x, g.z, g.rumbo);
    indice = g.i;
    trazada.reiniciar();
    T.asegurar(indice);
    pasarNotas();
    mundo.mantener(c.pos[0], c.pos[2], g.rumbo, true);   // todo el terreno de alrededor, antes de largar
    mundo.fiesta.poner(T);                               // el festival de la largada (con el terreno ya armado, las alturas salen al toque)
    mundo.fiesta.efectos(o.efectos ? o.efectos() : true);
    fx.cortar(); fx.limpiar(); dibujo.actualizar(c, 0, false);
    camara.saltar();
    pintarActivas(); pintarVidrio();
    hud.mostrar(true);
    hud.sello(false); hud.aviso(''); hud.grande(''); hud.frenaSola(false); hud.sinRival(); hud.ronda(-1);
    hud.notas([], 0);
    cuenta = JUEGO.cuenta; cuentaDicha = 0; fase = 'cuenta';
    sonido.iniciar();
  }

  // ---------------------------------------------------------------- entrar y salir
  function entrar() {
    if (activa) return;
    o.mandos();
    o.portada(false);
    activa = true;
    trazada.mostrar(true);   // arranca prendida aunque en los gustos este apagada (y sin tocar ese gusto)
    previaPractica = raiz.classList.contains('practica');
    raiz.classList.add('travesia', 'practica');
    const costo = document.querySelector('.redondo.volver .costo');
    if (costo) { textoCosto = costo.textContent; costo.textContent = '+' + TRAVESIA.danoAlVolver; }
    restaurarNiebla = mundo.activar();
    fx.prender(o.efectos ? o.efectos() : true);   // (el ajuste "efectos": sin el, no hay polvareda grande ni huellas que se oscurecen)
    { camara.cambiar(o.camara() || 'atras'); }
    nuevaCorrida();
    // la primera vez: la guia, con la cuenta regresiva esperando
    if (!vistaLaGuia()) { fase = 'guia'; guia.abrir(); }
  }
  let previaPractica = false, textoCosto = '+8';
  function salir() {
    if (!activa) return;
    activa = false; fase = 'afuera';
    trazada.mostrar(false);
    guia.cerrar();
    $('travesiaFin').hidden = true; $('cartas').hidden = true; $('vidrio').hidden = true; $('arenaOjos').hidden = true; $('cartasActivas').hidden = true;
    raiz.classList.remove('travesia', 'sin-tablero');
    camara.vibrar(0);
    raiz.classList.toggle('practica', previaPractica);
    const costo = document.querySelector('.redondo.volver .costo');
    if (costo) costo.textContent = textoCosto;
    hud.mostrar(false); hud.aviso(''); hud.grande(''); hud.llamar(false);
    document.documentElement.classList.remove('marcha-atras');
    mundo.vaciar();
    if (copiloto) copiloto.reiniciar();
    if (restaurarNiebla) { restaurarNiebla(); restaurarNiebla = null; }
    T = null;
    o.portada(true);
  }

  let paraAtras = false;
  // el cuadro completo: reglas, y despues lo que se ve. dt en segundos; t: el reloj de la animacion.
  function cuadro(dt, t) {
    actualizar(dt);
    if (!T) return;
    const P = T.camino, rumbo = Math.atan2(P.HX[indice], -P.HZ[indice]);
    mundo.mantener(c.pos[0], c.pos[2], rumbo, false);
    if ((c.velocidad < -0.5) !== paraAtras) { paraAtras = !paraAtras; raiz.classList.toggle('marcha-atras', paraAtras); }
    // el tablero: en vez del reloj, los km
    if (fase !== 'fin') {
      // paranoia: la barra de daño muestra mas de lo que hay
      hud.actualizar(c, { tiempo: 0, roto: e.paranoia ? Math.min(100, e.roto * 1.35 + 14) : e.roto }, dt);
      $('reloj').textContent = coma(mejorKm()) + ' km';
      // instrumental loco: el velocimetro marca numeros al azar
      if (e.instrumental) { if ((tInstr -= dt) <= 0) { tInstr = 0.12; numInstr = Math.floor(rnd() * 181); } $('vel').textContent = String(numInstr); }
      hud.volante(teclas.volante());
      // roadbook manchado: la flecha de la proxima curva es un "?"
      let notas = copiloto.proximas(indice, c.velocidad);
      if (e.roadbook && notas.length && notas[0].tipo === 'curva') notas = [{ ...notas[0], tipo: 'duda' }, ...notas.slice(1)];
      hud.notas(notas, indice);
      // intercomunicador con estatica: el copiloto canta 1,5 s tarde (como si el auto estuviera 1,5 s atras). Pánico: a mucha velocidad se calla.
      if (fase === 'corriendo' && !(e.panico && c.velocidad > vTope * MUY_RAPIDO)) copiloto.paso(indice - (e.estatica ? Math.round(Math.max(0, c.velocidad) * 1.5) : 0), c.velocidad);
    }
    dibujo.actualizar(c, dt, true);
    fx.actualizar(c, dt);
    // escape libre: la pantalla tiembla siempre un poco. Rueda desbalanceada: tiembla mas cuanto mas rapido se va.
    fx.escala(camara.modo().id === 'atras' ? 0.4 : camara.modo().id === 'arriba' ? 1.35 : 1.0);   // (la polvareda se hace mas grande cuanto mas lejos esta la camara)
    camara.vibrar(e && fase !== 'cartas' ? Math.max(e.escape ? 0.11 : 0, e.desbalance ? 0.42 * suave((c.velocidad / vTope - 0.5) / 0.4) : 0) : 0);
    camara.seguir(c, dt);
    if (c.rompio.length) c.rompio.length = 0;
    mundo.animar(t);
    mundo.fiesta.animar(c, indice, dt, t);   // la gente festeja y se corre; las chapas del vallado caen si se las lleva puestas
    mundo.mirar(camara, c, render.domElement.width, render.domElement.height);
    sonido.actualizar(c, fase === 'afuera' ? 0 : e.roto, dt);
    camara.cam.getWorldDirection(HACIA);
    post.dibujar(escena, camara.cam, AL_AUTO.set(c.pos[0], c.pos[1], c.pos[2]).sub(camara.cam.position).dot(HACIA));
  }
  const HACIA = new THREE.Vector3(), AL_AUTO = new THREE.Vector3();

  // una tecla (devuelve true si la atiende el modo)
  function tecla(code) {
    if (!activa) return false;
    if (fase === 'cartas') {
      const n = { Digit1: 0, Digit2: 1, Digit3: 2, Numpad1: 0, Numpad2: 1, Numpad3: 2 }[code];
      if (n !== undefined) elegir(n);
      return true;
    }
    if (code === 'Escape') { salir(); return true; }
    if (code === 'KeyR') { if (fase === 'corriendo') volver('pedido'); return true; }
    if (code === 'KeyT') { trazada.mostrar(!trazada.visible()); hud.aviso(trazada.visible() ? 'Trazada' : 'Sin trazada', 1.2); return true; }
    if (code === 'KeyC') { const m = camara.cambiar(); club.gusto('camara', m.id); hud.camara(m.id); hud.aviso(m.nombre, 1.2); return true; }
    if (code === 'Enter') { if (fase === 'fin' && !['BUTTON', 'INPUT', 'A'].includes(document.activeElement.tagName)) nuevaCorrida(); return fase === 'fin'; }
    return false;
  }

  return {
    activa: () => activa,
    entrar, salir, cuadro, tecla, nuevaCorrida,
    // la guia, para verla de nuevo (desde "Como se juega" o la Aventura)
    verGuia: () => guia.abrir(),
    // la pantalla cambio de tamaño / de zona libre / de distancia / de voz (los mismos ajustes de la camara de la pista)
    medir: (w, h) => camara.pantalla(w, h),
    encuadrar: (a, b, l) => camara.encuadrar(a, b, l),
    alejar: (v) => camara.alejar(v),
    voz: (si) => { if (copiloto) copiloto.voz(si); },
    efectos: (si) => { fx.prender(si); mundo.fiesta.efectos(si); },
    // --- para probar desde la consola (solo en una copia local, ver main.js) ---
    prueba: {
      guia, escena, auto: () => c,   // (la escena y el auto, para las pruebas de vista)
      estado: () => ({ activa, fase, km: mejorKm(), indice, mejor, roto: e && e.roto, cartas: e && e.cartas.slice(), mano: mano.map((k) => k.id), motivo: motivoFin, velocidad: c && c.velocidad, record: record(),
        memoria: T && T.memoria(), dibujados: mundo.vivos(), armados: T && T.estadistica.armados, soltados: T && T.estadistica.soltados, tSinAvance, proxima: proximaCarta }),
      avanzar: (seg, o2 = {}) => {
        if (o2.piloto !== undefined) depuracion.piloto = o2.piloto;
        if (o2.invulnerable !== undefined) depuracion.invulnerable = o2.invulnerable;
        const dt = 1 / 30;
        let sigue = 0;
        for (let s = 0; s < seg; s += dt) {
          actualizar(dt);
          if (!T) break;
          if (o2.efectos && c) { fx.escala(camara.modo().id === 'atras' ? 0.4 : camara.modo().id === 'arriba' ? 1.35 : 1.0); fx.actualizar(c, dt); camara.seguir(c, dt); }   // (con "efectos: true" tambien corren el polvo y las huellas, que sino solo andan al dibujar)
          // (para probar) si el piloto se queda trabado en un pozo y no puede morir, se lo apoya unos metros mas adelante
          if (depuracion.invulnerable && fase === 'corriendo' && tSinAvance > 6) { apoyar(Math.round(mejor) + 25); mejor += 25; mejorAntes = mejor; T.asegurar(indice); }
          if ((sigue += dt) >= 0.25) { sigue = 0; mundo.mantener(c.pos[0], c.pos[2], Math.atan2(T.camino.HX[indice], -T.camino.HZ[indice]), true); }
          if (fase === 'cartas' && o2.elegir) elegir(0);
          if (fase === 'fin' || (o2.hasta && o2.hasta())) break;
        }
        if (T) { dibujo.actualizar(c, 0, false); camara.seguir(c, 0.05); }
      },
      elegir, mostrarFin, terminar,
      // un cuadro completo (lo que se ve y el tablero), y lo que el auto manda al motor segun las cartas, para probar las averias de a una
      cuadro: (dt = 1 / 30) => cuadro(dt, reloj),
      filtrar: (x, y, dt) => { ent.x = x; ent.y = y; ent.mano = false; reloj += dt; const m = filtrarEntrada(dt); return { x: m.x, y: m.y }; },
      cartas: { CARTAS, PROBLEMAS, ARREGLOS, sortear, estadoInicial },
      proxima: (km) => { proximaCarta = km; },   // (para probar) en que km sale la proxima carta
      saltarA: (km) => {
        // (para probar) pone el auto km metros mas adelante sobre el camino
        T.asegurar(Math.round(km * 1000));
        const i = Math.round(km * 1000);
        apoyar(i); mejor = Math.max(mejor, i);
        T.asegurar(i); T.podar(i); pasarNotas();
        mundo.mantener(c.pos[0], c.pos[2], 0, true);
      },
      dar: (id) => { aplicar(e, cartaDe(id), rnd); despuesDeCarta(); },
      trazada, serio: () => !!(c && c.datos.serio), depuracion, T: () => T, c: () => c, e: () => e, mundo, camara, escena, copiloto: () => copiloto, fx,
      vTope: (v) => { if (v !== undefined) vTope = v; return vTope; },   // (para probar) la velocidad maxima de referencia: se puede cambiar para probar "a mucha velocidad"
    },
  };
}

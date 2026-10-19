// La Travesia: un modo aparte de la pista del dia. Un camino infinito y cada vez peor (medanos, rios, fesh-fesh, piedras),
// con cartas: cada tantos km el auto se frena y se elige 1 de 3, buenas, malas o de las dos. No es justo, y cada vez que
// se larga sale algo distinto. Gana el que llega mas lejos.
//
// Este archivo es el modo: las reglas de la corrida, el ciclo de cada cuadro y las pantallas propias (las cartas, el resultado).
// Lo demas se arma en otros archivos: el camino y el terreno (travesiaterreno.js), como se dibuja (travesiamundo.js) y las
// cartas (cartas.js). El auto, la camara y los efectos son los de siempre. La pista del dia y los circuitos no cambian.
//
// Fin de la corrida: el auto se rompe (daño al maximo) o se queda parado mucho rato. No hay limite de tiempo.
// Salirse del camino: se vuelve como siempre, pero en vez de recargo de tiempo suma daño.
import * as THREE from '../vendor/three.module.js';
import { JUEGO, TRAVESIA, SUELO } from './config.js';
import { crearTerrenoTravesia } from './travesiaterreno.js';
import { crearMundoTravesia } from './travesiamundo.js';
import { crearAuto, enSerio } from './vehicle.js';
import { crearTrazadaTravesia } from './travesiatrazada.js';
import { crearDibujo } from './autos.js';
import { crearCamara } from './camera.js';
import { crearEfectos } from './fx.js';
import { crearCopiloto } from './copiloto.js';
import { configDe } from './partes.js';
import { estadoInicial, sortear, aplicar, mecanicoLoco, cartaDe } from './cartas.js';
import { icono } from './iconos.js';

const $ = (id) => document.getElementById(id);
const lim = (v, a, b) => (v < a ? a : v > b ? b : v);
const QUIETO = { x: 0, y: 0, mano: true };
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
    // la linea con mas lugar: se prueban desvios a los costados y se elige el que deja mas lejos de las piedras
    const adelante = 8 + Math.max(0, v) * 1.1;
    let mejor = 0, costoMejor = 1e9;
    for (let off = -4; off <= 4; off += 1) {
      let costo = Math.abs(off) * 0.25 + Math.abs(off - lado) * 0.05;
      for (let u = 4; u <= adelante + 22; u += 4) {
        const i = Math.min(P.n - 1, indice + Math.round(u));
        const x = P.X[i] - P.HZ[i] * off, z = P.Z[i] + P.HX[i] * off, lista = T.cosasCerca(x, z);
        if (!lista) continue;
        for (const o of lista) { const d = Math.hypot(o.x - x, o.z - z) - o.r; if (d < 3.4) costo += (3.4 - d) * 9 / (1 + u * 0.06); }
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
    const quiero = Math.max(9, 24 - giro * 11 - costoMejor * 0.4);
    ent.y = v > quiero + 2 ? -0.4 : v > quiero ? 0 : 1;
    ent.mano = false;
  };
}

// ------------------------------------------------------------------------------------------------------------------
// o: lo que el juego le presta al modo
//   render, post, liviano, club, sonido, hud, teclas, raiz
//   portada(si): muestra o esconde la portada.   mandos(): prende los mandos del celular.
//   voz(): si el copiloto habla.   camara(): el id de la camara que se eligio.
// ------------------------------------------------------------------------------------------------------------------
export function crearModoTravesia(o) {
  const { render, post, liviano, club, sonido, hud, teclas, raiz } = o;
  let activa = false, fase = 'afuera';   // afuera, cuenta, corriendo, cartas, espera (el auto se rompio: un instante antes del resultado) y fin
  let T = null, c = null, C = null, base = null, e = null, dibujo = null, codigoDibujo = '', copiloto = null, rnd = Math.random;
  let indice = 0, mejor = 0, lejos = 0, resto = 0, reloj = 0, cuenta = 0, tEspera = 0, motivoFin = '', proximaCarta = TRAVESIA.kmPorCarta;
  let golpe = 0, contra = '', tGolpe = 0, tVolcado = 0, tFuera = 0, tSinAvance = 0, mejorAntes = 0, tFondo = 0, calor = 0, armada = false, volvio = 0, vistas = 0;
  let cola = [], gasEfectivo = 0, mano = [], restaurarNiebla = null;
  const ent = { x: 0, y: 0, mano: false }, manda = { x: 0, y: 0, mano: false };
  const piloto = crearPiloto(), depuracion = { piloto: false, invulnerable: false };

  // lo que no cambia de una corrida a otra: la escena, el mundo, la camara y los efectos se arman la primera vez
  const escena = new THREE.Scene();
  const mundo = crearMundoTravesia(escena, liviano);
  const trazada = crearTrazadaTravesia(escena);   // la linea pintada en el camino: en este modo arranca siempre prendida (la T la apaga)
  const camara = crearCamara({ altura: (x, z) => (T ? T.altura(x, z) : 0) });
  const huellasVacias = { marcar() {}, soltar() {}, subir() {}, cortar() {}, limpiar() {}, pintar() {} };   // (en la arena no quedan huellas)
  const fx = crearEfectos(escena, huellasVacias, 1, [0.6, 0.3], liviano);

  // ---------------------------------------------------------------- el record, en este aparato
  const record = () => { try { return Number(club.gusto(CLAVE_RECORD)) || 0; } catch (x) { return 0; } };
  const guardarRecord = (km) => { try { club.gusto(CLAVE_RECORD, Math.round(km * 100) / 100); } catch (x) { /* sin memoria: no pasa nada */ } };

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
  function elegir(n) {
    if (fase !== 'cartas' || !mano[n]) return false;
    const k = mano[n];
    aplicar(e, k, rnd);
    $('cartas').hidden = true;
    pintarActivas(); pintarVidrio(); marearNotas();
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
    if (nuevo) guardarRecord(km);
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
    $('travesiaFin').hidden = false; $('cartasActivas').hidden = true;
    $('tfOtra').focus({ preventScroll: true });
  }
  // Shakedown Travesía 🏜️ 23,4 km 🃏11 💥   y abajo, las cartas juntadas como emojis
  function textoParaCompartir() {
    const km = mejorKm(), fin = FINALES[motivoFin] || '💥';
    const lineas = ['Shakedown Travesía 🏜️ ' + coma(km) + ' km 🃏' + e.cartas.length + ' ' + fin];
    if (e.cartas.length) lineas.push(e.cartas.map((id) => cartaDe(id).emoji).join(''));
    lineas.push(location.origin + location.pathname);
    return lineas.join('\n');
  }
  async function compartir() {
    const texto = textoParaCompartir(), salida = $('tfCompartido');
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
  $('tfSalir').addEventListener('click', () => salir());

  // ---------------------------------------------------------------- una corrida
  const mejorKm = () => Math.max(0, mejor - 8) / 1000;
  // el copiloto: las notas salen del camino, a medida que se arma. Las del "copiloto mareado" van al reves, una de cada diez.
  const alReves = (n) => n.tipo === 'curva' && e && e.mareado && n.k % 10 === 4;
  function ponerLado(n) { n.lado = alReves(n) ? (n.real === 'der' ? 'izq' : 'der') : n.real; }
  function pasarNotas() {
    while (vistas < T.notas.length) {
      const n = { ...T.notas[vistas++] };
      n.real = n.lado; ponerLado(n);
      copiloto.notas.push(n);
    }
  }
  function marearNotas() { for (const n of copiloto.notas) if (n.tipo === 'curva') ponerLado(n); }

  // ajusta el auto a lo que dicen las cartas (cada cuadro: asi las cartas se suman y se sacan solas)
  function ajustarAuto() {
    const duro = SUELO[c.suelo] && SUELO[c.suelo].blando < 0.5;
    C.potencia = base.potencia * e.potencia * (calor > 0 ? 0.42 : 1) * (e.lisos && duro ? 1.73 : 1);   // (1,2 de velocidad pide 1,73 de potencia: la velocidad sube con la raiz cubica)
    C.empuje = base.empuje * e.empuje * (calor > 0 ? 0.55 : 1);
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
    const x = lim(ent.x + e.sesgo, -1, 1);
    let y = ent.y;
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
      if (dijo) { hud.aviso(dijo, 2.6, 'llave'); pintarActivas(); pintarVidrio(); marearNotas(); }
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
    if (tSinAvance > 3.5) hud.aviso('Parado: ' + Math.max(0, Math.ceil(TRAVESIA.quieto - tSinAvance)) + ' s', 0, 'cono');
    else if (tSinAvance === 0 || tSinAvance < 0.2) hud.aviso('');
    hud.llamar(tSinAvance > 3.5);
    if (tSinAvance > TRAVESIA.quieto && !depuracion.invulnerable) return terminar('quieto');
    // bateria agotada: si el auto llega a 0 km/h, se termino
    if (e.bateria) {
      if (c.velocidad > 3) armada = true;
      else if (armada && Math.abs(c.velocidad) < 0.3 && !depuracion.invulnerable) return terminar('bateria');
    }
    // una carta cada tantos km
    if (mejorKm() >= proximaCarta) { proximaCarta += TRAVESIA.kmPorCarta; mostrarCartas(); }
  }

  // todo lo que pasa en un cuadro menos dibujar (tambien lo usan las pruebas)
  function actualizar(dt) {
    if (fase === 'cartas' || fase === 'fin' || fase === 'afuera') return;
    reloj += dt;
    if (fase === 'cuenta') {
      cuenta -= dt;
      const n = Math.ceil(cuenta);
      if (n > 0 && n !== cuentaDicha) { cuentaDicha = n; hud.grande(String(n), 0.95, 'cuenta'); }
      if (cuenta <= 0) { fase = 'corriendo'; c.impacto = 0; hud.grande('¡YA!', 0.9, 'ya'); }
    }
    let m = QUIETO;
    if (fase === 'corriendo') {
      if (depuracion.piloto) piloto(T, c, indice, ent, dt); else teclas.leer(ent);
      m = filtrarEntrada(dt);
      ajustarAuto();
    }
    resto += dt;
    while (resto >= JUEGO.paso) { c.paso(m, JUEGO.paso); resto -= JUEGO.paso; }
    if (fase === 'corriendo') { sonido.toque(c.contra, c.impacto, e.roto); reglas(dt); }
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
    mundo.vaciar();
    T = crearTerrenoTravesia(semilla);
    T.ajuste = ajusteDeSuelo;
    mundo.usar(T);
    e = estadoInicial();
    // el auto que se eligio en el garaje (una copia: las cartas le cambian numeros)
    const codigo = club.auto();
    // siempre en "rally serio" (ver SERIO en config.js), sin ayuda de manejo, diga lo que diga el gusto guardado
    C = enSerio({ ...configDe(codigo) });
    base = { potencia: C.potencia, empuje: C.empuje, frenos: C.frenos, alturaLateral: C.alturaLateral };
    vTope = Math.cbrt(base.potencia / base.aire) * 1.0;
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
    const g = T.largada;
    c.poner(g.x, g.z, g.rumbo);
    indice = g.i;
    trazada.reiniciar();
    T.asegurar(indice);
    pasarNotas();
    mundo.mantener(c.pos[0], c.pos[2], g.rumbo, true);   // todo el terreno de alrededor, antes de largar
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
    { const id = o.camara(); if (id) camara.cambiar(id); }
    nuevaCorrida();
  }
  let previaPractica = false, textoCosto = '+8';
  function salir() {
    if (!activa) return;
    activa = false; fase = 'afuera';
    trazada.mostrar(false);
    $('travesiaFin').hidden = true; $('cartas').hidden = true; $('vidrio').hidden = true; $('cartasActivas').hidden = true;
    raiz.classList.remove('travesia');
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
      hud.actualizar(c, { tiempo: 0, roto: e.roto }, dt);
      $('reloj').textContent = coma(mejorKm()) + ' km';
      hud.volante(teclas.volante());
      hud.notas(copiloto.proximas(indice, c.velocidad), indice);
      if (fase === 'corriendo') copiloto.paso(indice, c.velocidad);
    }
    dibujo.actualizar(c, dt, true);
    fx.actualizar(c, dt);
    camara.seguir(c, dt);
    if (c.rompio.length) c.rompio.length = 0;
    mundo.animar(t);
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
    // la pantalla cambio de tamaño / de zona libre / de distancia / de voz (los mismos ajustes de la camara de la pista)
    medir: (w, h) => camara.pantalla(w, h),
    encuadrar: (a, b, l) => camara.encuadrar(a, b, l),
    alejar: (v) => camara.alejar(v),
    voz: (si) => { if (copiloto) copiloto.voz(si); },
    // --- para probar desde la consola (solo en una copia local, ver main.js) ---
    prueba: {
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
          // (para probar) si el piloto se queda trabado en un pozo y no puede morir, se lo apoya unos metros mas adelante
          if (depuracion.invulnerable && fase === 'corriendo' && tSinAvance > 6) { apoyar(Math.round(mejor) + 25); mejor += 25; mejorAntes = mejor; T.asegurar(indice); }
          if ((sigue += dt) >= 0.25) { sigue = 0; mundo.mantener(c.pos[0], c.pos[2], Math.atan2(T.camino.HX[indice], -T.camino.HZ[indice]), true); }
          if (fase === 'cartas' && o2.elegir) elegir(0);
          if (fase === 'fin' || (o2.hasta && o2.hasta())) break;
        }
        if (T) { dibujo.actualizar(c, 0, false); camara.seguir(c, 0.05); }
      },
      elegir, mostrarFin, terminar,
      saltarA: (km) => {
        // (para probar) pone el auto km metros mas adelante sobre el camino
        T.asegurar(Math.round(km * 1000));
        const i = Math.round(km * 1000);
        apoyar(i); mejor = Math.max(mejor, i);
        T.asegurar(i); T.podar(i); pasarNotas();
        mundo.mantener(c.pos[0], c.pos[2], 0, true);
      },
      dar: (id) => { aplicar(e, cartaDe(id), rnd); pintarActivas(); pintarVidrio(); marearNotas(); },
      trazada, serio: () => !!(c && c.datos.serio), depuracion, T: () => T, c: () => c, e: () => e, mundo, camara, escena, copiloto: () => copiloto, fx,
      vTope: () => vTope,
    },
  };
}

// Reglas del rally: la cuenta regresiva, los sectores, la meta, las penalizaciones y el abandono.
// No dibuja ni escucha teclas: recibe el auto y devuelve lo que fue pasando en "eventos".
// Por eso la pueden usar tanto el juego como las pruebas sin graficos.
import { JUEGO } from './config.js';

// El color de un sector: verde, amarillo o rojo segun cuanto se tardo contra la referencia.
// Si hubo que volver al camino, es rojo.
export function colorDeSector(tiempo, referencia, vueltas) {
  const s = JUEGO.sectores, veces = tiempo / referencia;
  return vueltas > 0 ? 'r' : veces <= s.verde ? 'v' : veces <= s.amarillo ? 'a' : 'r';
}

// T: el terreno. par: segundos de referencia de cada sector (salen de referencia.js).
export function crearPartida(T, par) {
  const P = T.camino, S = T.sectores;
  const p = {
    estado: 'previa',   // previa (en la largada, esperando), cuenta (3, 2, 1), corriendo, llegada, abandono
    tiempo: 0,          // el reloj, con las penalizaciones ya sumadas
    cuenta: 0,          // segundos que faltan para largar
    indice: 0,          // metro del camino mas cercano al auto
    lejos: 0,           // metros desde el borde del camino (negativo = adentro)
    sector: 0,          // sector que se esta corriendo (0 a 4)
    sectores: [],       // los que ya se cerraron: { tiempo, color, vueltas }
    roto: 0,            // daño, de 0 a 100
    vueltas: 0,         // veces que hubo que volver al camino
    motivo: '',         // por que se abandono: 'roto' o 'tiempo'
    volcado: false, trabado: false, contramano: false, eventos: [],
  };
  let reloj = 0, desde = 0, enSector = 0, golpe = 0, tGolpe = 0, tVolcado = 0, tCaida = 0, tQuieto = 0, tAlReves = 0, dicho = 0;
  const avisar = (tipo, dato) => p.eventos.push({ tipo, dato });

  function apoyar(c, i) {
    c.poner(P.X[i], P.Z[i], Math.atan2(P.HX[i], -P.HZ[i]));
    p.indice = i; p.lejos = -P.W[i] / 2;
    golpe = tGolpe = tVolcado = tCaida = tQuieto = tAlReves = 0;
    p.volcado = p.trabado = p.contramano = false;
  }

  // deja el auto en la largada, listo para la cuenta regresiva
  p.preparar = function (c) {
    Object.assign(p, { estado: 'previa', tiempo: 0, cuenta: 0, sector: 0, roto: 0, vueltas: 0, motivo: '' });
    p.sectores.length = 0; p.eventos.length = 0;
    reloj = desde = enSector = dicho = 0;
    apoyar(c, T.largada.i);
  };
  p.largar = function () {
    if (p.estado !== 'previa') return;
    p.estado = 'cuenta'; p.cuenta = JUEGO.cuenta; dicho = JUEGO.cuenta + 1;
  };

  function abandonar(motivo) {
    while (p.sectores.length < S.length) p.sectores.push({ tiempo: 0, color: 'n', vueltas: 0 });
    p.estado = 'abandono'; p.motivo = motivo;
    avisar('abandono', motivo);
  }

  // vuelve al camino unos metros antes de donde quedo, parado, y suma la penalizacion
  p.volver = function (c, motivo) {
    if (p.estado !== 'corriendo') return;
    p.vueltas++; enSector++;
    p.tiempo += JUEGO.penalizacion;
    apoyar(c, Math.max(T.largada.i, p.indice - 6));
    c.impacto = 0;
    avisar('vuelta', motivo);
  };

  p.paso = function (c, dt) {
    if (p.estado === 'cuenta') {
      p.cuenta -= dt;
      const n = Math.ceil(p.cuenta);
      if (n < dicho && n > 0) { dicho = n; avisar('cuenta', n); }
      if (p.cuenta <= 0) { p.estado = 'corriendo'; p.cuenta = 0; c.impacto = 0; avisar('ya'); }
      return;
    }
    if (p.estado !== 'corriendo') return;
    p.tiempo += dt; reloj += dt;
    const i = p.indice = T.indice(c.pos[0], c.pos[2], p.indice);
    p.lejos = Math.hypot(c.pos[0] - P.X[i], c.pos[2] - P.Z[i]) - P.W[i] / 2;

    // sectores y meta
    if (p.lejos < 4 && i >= S[p.sector].hasta) {
      const tiempo = p.tiempo - desde, s = { tiempo, color: colorDeSector(tiempo, par[p.sector], enSector), vueltas: enSector };
      p.sectores.push(s);
      desde = p.tiempo; enSector = 0; p.sector++;
      avisar('sector', s);
      if (p.sector === S.length) { p.sector = S.length - 1; p.estado = 'llegada'; avisar('llegada'); return; }
    }
    if (p.tiempo > JUEGO.maximo) return abandonar('tiempo');

    // daño: de cada choque cuenta el golpe mas fuerte. Los de una caida al vacio no cuentan: eso se paga volviendo al camino.
    const cae = c.pos[1] < P.Y[i] - 6;
    if (c.impacto > golpe) golpe = c.impacto;
    c.impacto = 0;
    if (cae) golpe = tGolpe = 0;
    if (golpe > JUEGO.golpes.desde && tGolpe === 0) tGolpe = reloj;
    if (tGolpe > 0 && reloj - tGolpe > 0.25) {
      const suma = (golpe - JUEGO.golpes.desde) * JUEGO.golpes.porMetro;
      p.roto = Math.min(100, p.roto + suma);
      avisar('golpe', suma);
      golpe = tGolpe = 0;
      if (p.roto >= 100) return abandonar('roto');
    } else if (tGolpe === 0) golpe = 0;

    // problemas: volcar, irse lejos o caerse (se vuelve solo al camino) y quedar trabado o a contramano (se avisa)
    const rumbo = c.adelante[0] * P.HX[i] + c.adelante[2] * P.HZ[i];
    tVolcado = c.arriba[1] < 0.35 ? tVolcado + dt : 0;
    tCaida = c.pos[1] < P.Y[i] - 10 || p.lejos > JUEGO.afuera || !(c.pos[1] === c.pos[1]) ? tCaida + dt : 0;
    tQuieto = c.gas > 0.5 && Math.abs(c.velocidad) < 0.7 && c.enPiso > 1 ? tQuieto + dt : 0;
    tAlReves = rumbo < -0.4 && c.velocidad > 3 ? tAlReves + dt : 0;
    p.volcado = tVolcado > 0.6;
    p.trabado = tQuieto > 2.5;
    p.contramano = tAlReves > 1.2;
    if (tCaida > 1.2) p.volver(c, p.lejos > JUEGO.afuera && c.pos[1] >= P.Y[i] - 10 ? 'afuera' : 'caida');
    else if (tVolcado > 2) p.volver(c, 'vuelco');
  };

  // los colores de los sectores en una sola palabra: 'vvarv' (v verde, a amarillo, r rojo, n no se corrio)
  p.colores = () => p.sectores.map((s) => s.color).join('');
  return p;
}

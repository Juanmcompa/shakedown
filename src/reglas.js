// Reglas de la travesia: controles, meta, nafta, daño, rescates y las formas de perder.
// No dibuja ni escucha teclas: recibe la camioneta y devuelve lo que fue pasando en "eventos".
// Por eso la pueden usar tanto el juego como las pruebas sin graficos.
import { JUEGO } from './config.js';

export function crearPartida(T) {
  const P = T.camino, etapa = T.etapa;
  const p = {
    estado: 'espera',   // espera (todavia no acelero), corriendo, llegada, perdido
    tiempo: 0, indice: 0, lejos: 0, pasados: 0, control: T.largada, tramo: -1,
    nafta: 100, roto: 0, rescates: JUEGO.rescates, usados: 0, bidones: [], motivo: '',
    encajado: false, volcado: false, eventos: [],
  };
  let quieto = 0, tVolcado = 0, tCaida = 0, golpe = 0, tGolpe = 0, pendiente = [], avisado = false;
  const avisar = (tipo, dato) => p.eventos.push({ tipo, dato });

  p.empezar = function (c) {
    Object.assign(p, { estado: 'espera', tiempo: 0, pasados: 0, control: T.largada, tramo: -1, nafta: 100, roto: 0, rescates: JUEGO.rescates, usados: 0, motivo: '', encajado: false, volcado: false });
    p.bidones = T.bidones.map(() => true);
    p.eventos.length = 0;
    p.apoyar(c, T.largada);
  };

  p.apoyar = function (c, lugar) {
    c.poner(lugar.x, lugar.z, lugar.rumbo);
    p.indice = lugar.i; p.lejos = 0;
    quieto = tVolcado = tCaida = golpe = tGolpe = 0;
    pendiente = [];
  };

  function perder(motivo) { p.estado = 'perdido'; p.motivo = motivo; avisar('perdido', motivo); }

  // vuelve al ultimo control gastando un rescate. Los golpes de los ultimos segundos (la caida) no cuentan.
  p.rescatar = function (c, motivo) {
    if (p.estado !== 'corriendo' && p.estado !== 'espera') return;
    if (p.rescates <= 0) return perder('rescates');
    p.rescates--; p.usados++;
    p.apoyar(c, p.control);
    avisar('rescate', motivo);
  };

  // avanza las reglas. "gas" es el acelerador que pide el jugador (para arrancar el reloj).
  p.paso = function (c, gas, dt) {
    if (p.estado === 'llegada' || p.estado === 'perdido') return;
    if (p.estado === 'espera' && gas !== 0) p.estado = 'corriendo';
    if (p.estado !== 'corriendo') return;
    p.tiempo += dt;
    p.indice = T.indice(c.pos[0], c.pos[2], p.indice);
    const i = p.indice;
    p.lejos = Math.hypot(c.pos[0] - P.X[i], c.pos[2] - P.Z[i]) - P.W[i] / 2;

    // cartel al entrar a un tramo con nombre
    const t = P.T[i];
    if (t !== p.tramo) { if (t > p.tramo && etapa.tramos[t].nombre) avisar('tramo', etapa.tramos[t].nombre); p.tramo = t; avisado = false; }
    // aviso unos metros antes de un derrumbe
    const d = etapa.tramos[t].derrumbe;
    if (d && !avisado && P.U[i] > d[0] - 20 && P.U[i] < d[0]) { avisado = true; avisar('derrumbe'); }

    // controles y meta
    if (p.lejos < 4 && p.pasados < T.controles.length && i >= T.controles[p.pasados].i) {
      p.control = T.controles[p.pasados];
      p.pasados++;
      avisar('control', p.pasados);
    }
    if (p.lejos < 4 && i >= T.meta.i) { p.estado = 'llegada'; avisar('llegada'); return; }

    // nafta: se gasta al acelerar y mucho mas patinando. Los bidones recargan.
    const n = JUEGO.nafta;
    p.nafta -= (n.ralenti + c.gas * (n.acelerando + n.patinando * c.patina) * (c.baja ? n.enBaja : 1)) * dt;
    T.bidones.forEach((b, k) => {
      if (p.bidones[k] && Math.hypot(c.pos[0] - b.x, c.pos[2] - b.z) < 2.4 && Math.abs(c.pos[1] - b.y) < 3) {
        p.bidones[k] = false;
        p.nafta = Math.min(100, p.nafta + n.bidon);
        avisar('bidon', k);
      }
    });
    if (p.nafta <= 0) { p.nafta = 0; return perder('nafta'); }

    // daño: cada golpe fuerte suma, pero recien se anota a los 2,5 segundos.
    // Asi los golpes de una caida se borran con el rescate y no rompen la camioneta.
    if (c.impacto > golpe) golpe = c.impacto;
    c.impacto = 0;
    if (golpe > JUEGO.golpes.desde && tGolpe === 0) tGolpe = p.tiempo;
    if (tGolpe > 0 && p.tiempo - tGolpe > 0.3) {
      const suma = (golpe - JUEGO.golpes.desde) * JUEGO.golpes.porMetro;
      pendiente.push([p.tiempo, suma]);
      avisar('golpe', suma);
      golpe = tGolpe = 0;
    } else if (tGolpe === 0) golpe = 0;
    while (pendiente.length && p.tiempo - pendiente[0][0] > 2.5) p.roto += pendiente.shift()[1];
    if (p.roto >= 100) { p.roto = 100; return perder('rota'); }

    // problemas: encajarse (aviso), volcar (aviso) y desbarrancarse (rescate solo)
    tVolcado = c.arriba[1] < 0.35 ? tVolcado + dt : 0;
    tCaida = c.pos[1] < P.Y[i] - 10 || p.lejos > 45 || !(c.pos[1] === c.pos[1]) ? tCaida + dt : 0;
    quieto = c.gas > 0.5 && Math.abs(c.velocidad) < 0.7 && c.enPiso > 1 ? quieto + dt : 0;
    p.volcado = tVolcado > 2;
    p.encajado = quieto > 2.5;
    if (tCaida > 1.2) p.rescatar(c, p.lejos > 45 && c.pos[1] >= P.Y[i] - 10 ? 'afuera' : 'caida');
  };

  // daño total, contando los golpes que todavia no se anotaron (para mostrarlo en el instrumento)
  p.rotura = () => Math.min(100, p.roto + pendiente.reduce((s, g) => s + g[1], 0));
  return p;
}

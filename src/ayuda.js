// La ayuda de manejo, para el que recien arranca. Hace dos cosas, las dos de a poco, sin sacarle el auto al jugador:
//   - lleva el volante hacia la trazada (la linea por donde pasaria un piloto muy bueno: la misma que se puede ver
//     pintada en el piso, ver trazada.js). Si el jugador dobla con ganas para otro lado, manda el jugador.
//   - regula los pedales para llegar bien a cada curva: en las rectas no se mete (deja acelerar a fondo); antes de la
//     curva afloja el acelerador de a poco y, si el auto viene pasado, frena lo justo.
//     (La primera version cortaba y devolvia el acelerador de golpe, mas de una vez por segundo: el motor sonaba ahogado.)
// Usa la referencia de la pista (referencia.js): de ahi salen por donde pasar y lo mas rapido que se puede venir por
// cada metro para llegar bien a lo que sigue (el "techo"). La ayuda va a una parte de eso, y frena con tiempo.
// (La otra mitad de la ayuda, que el auto se cruce menos, son los numeros de AYUDA.auto en config.js.)
import { AYUDA } from './config.js';
import { crearReferencia } from './referencia.js';

const lim = (v, a, b) => (v < a ? a : v > b ? b : v);

export function crearAyuda(T) {
  const P = T.camino;
  let ref = null, de = null, frenando = false, frenaba = false;
  return {
    // C: el auto con el que se corre (a que velocidad se puede dar cada curva depende del auto).
    // hecha: su referencia, si ya esta calculada (si no, se calcula aca).
    preparar: (C, hecha) => { if (de !== C) { ref = hecha || crearReferencia(T, C); de = C; } },
    // Corrige lo que pide el jugador. c: el auto. i: el metro del camino por el que va. lejos: metros desde el borde
    // del camino (negativo = adentro). ent: sus mandos; se le cambian el volante y el pedal.
    aplicar: (c, i, lejos, ent) => {
      frenando = false;
      const v = c.velocidad, alDerecho = c.adelante[0] * P.HX[i] + c.adelante[2] * P.HZ[i] > 0.3;
      // fuera del camino, a contramano o casi parado no se mete: ahi el jugador esta acomodando el auto
      if (!ref || v < 1.5 || lejos > 3 || !alDerecho) { frenaba = false; return ent; }

      // --- el volante: apunta a un punto de la trazada, mas lejos cuanto mas rapido va, y lleva el volante hacia ahi ---
      if (c.enPiso !== 0) {
        const a = Math.min(P.n - 1, i + Math.round(4 + AYUDA.mira * v)), lado = ref.corre[a];
        const dx = P.X[a] - P.HZ[a] * lado - c.pos[0], dz = P.Z[a] + P.HX[a] * lado - c.pos[2], f = c.adelante;
        const pide = lim(Math.atan2(f[0] * dz - f[2] * dx, f[0] * dx + f[2] * dz) * AYUDA.mano, -1, 1);
        ent.x += (pide - ent.x) * AYUDA.volante * (1 - AYUDA.cede * Math.min(1, Math.abs(ent.x)));
      }

      // --- los pedales ---
      if (v < 4 || ent.y < 0) { frenaba = false; return ent; }   // (si el jugador frena, frena el)
      // la velocidad de ahora que deja llegar bien a todo lo que viene en los proximos metros
      let puede = 99;
      for (let k = 2; k <= 80; k += 3) {
        const vr = ref.techo[Math.min(P.n - 1, i + k)] * AYUDA.ritmo;
        puede = Math.min(puede, Math.sqrt(vr * vr + 2 * AYUDA.frena * k));
      }
      const sobra = v - puede;
      // viene pasado: frena, mas cuanto mas pasado. Y una vez que freno, no suelta hasta quedar bien por debajo: si no,
      // justo en el limite el freno se prende y se apaga a cada rato (se ve en las luces del auto).
      if (sobra > 0 || (frenaba && sobra > -AYUDA.suelta)) { ent.y = -lim(sobra / AYUDA.suave, 0.03, 1); frenaba = true; frenando = sobra > 0.6; }
      else { frenaba = false; if (ent.y > 0) ent.y = Math.min(ent.y, -sobra / AYUDA.suave); }   // viene llegando: afloja el acelerador de a poco
      return ent;
    },
    // true mientras la ayuda esta frenando (para avisarlo en el tablero)
    frenando: () => frenando,
  };
}

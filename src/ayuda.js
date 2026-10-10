// La ayuda de manejo: frena sola antes de las curvas, para el que recien arranca.
// Usa la misma cuenta que los pilotos de prueba: de la referencia de la pista sale a que velocidad conviene
// llegar a cada curva, y si el auto viene mas rapido que eso, suelta el acelerador o frena.
// (La otra mitad de la ayuda, que el auto se cruce menos, son los numeros de AYUDA.auto en config.js.)
import { AYUDA } from './config.js';
import { crearReferencia } from './referencia.js';

export function crearAyuda(T) {
  const P = T.camino;
  let ref = null, de = null, frenando = false;
  return {
    // C: el auto con el que se corre (a que velocidad se puede dar cada curva depende del auto)
    preparar: (C) => { if (de !== C) { ref = crearReferencia(T, C); de = C; } },
    // Corrige lo que pide el jugador. c: el auto. i: el metro del camino por el que va. lejos: metros desde el borde
    // del camino (negativo = adentro). ent: sus mandos; se le cambia el pedal si viene pasado.
    aplicar: (c, i, lejos, ent) => {
      frenando = false;
      const alDerecho = c.adelante[0] * P.HX[i] + c.adelante[2] * P.HZ[i] > 0.3;
      if (!ref || c.velocidad < 4 || lejos > 3 || !alDerecho || ent.y < 0) return ent;
      // la velocidad de ahora que deja llegar bien a todo lo que viene en los proximos metros
      let puede = 99;
      for (let k = 2; k <= 80; k += 3) {
        const vr = ref.velocidad[Math.min(P.n - 1, i + k)] * AYUDA.ritmo;
        puede = Math.min(puede, Math.sqrt(vr * vr + 2 * AYUDA.frena * k));
      }
      const sobra = c.velocidad - puede;
      if (sobra > 1.5) { ent.y = -1; frenando = true; }                  // viene pasado: frena
      else if (sobra > 0 && ent.y > 0) { ent.y = 0; frenando = true; }   // viene justo: suelta el acelerador
      return ent;
    },
    // true mientras la ayuda esta frenando o soltando el acelerador (para avisarlo en el tablero)
    frenando: () => frenando,
  };
}

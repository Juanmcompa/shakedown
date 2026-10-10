// Maniobras de prueba: que tan facil se descontrola cada auto con volantazos de teclado.
// "deriva" es el angulo entre hacia donde apunta el auto y hacia donde va. TROMPO = termino mirando para atras.
// uso: node tools/maniobras.mjs [auto]
import { crearAuto } from '../src/vehicle.js';
import { AUTOS, JUEGO } from '../src/config.js';
import { plano, correr } from './fisica.mjs';

const DT = JUEGO.paso;
function maniobra(C, suelo, v0, agarre, volante, pedal) {
  const c = crearAuto(plano(0, 0, suelo, agarre), C); c.poner(0, 0, 0);
  correr(c, 25, (t, c) => ({ x: 0, y: c.velocidad < v0 ? 1 : 0 }));
  let pico = 0, giro = 0, ant = Math.atan2(c.adelante[0], -c.adelante[2]), calma = 0, tCalma = -1;
  const dur = 5;
  correr(c, dur, (t) => ({ x: volante(t), y: pedal(t, c) }), (t, c) => {
    const vs = c.vel[0] * c.derecha[0] + c.vel[2] * c.derecha[2], d = Math.atan2(vs, Math.abs(c.velocidad) + 0.3) * 57.3;
    if (Math.abs(d) > Math.abs(pico)) pico = d;
    const rumbo = Math.atan2(c.adelante[0], -c.adelante[2]); let k = rumbo - ant; k = Math.atan2(Math.sin(k), Math.cos(k)); giro += k; ant = rumbo;
    if (Math.abs(d) < 4 && Math.abs(c.w[1]) < 0.15) { calma += DT; if (calma > 0.4 && tCalma < 0) tCalma = t; } else { calma = 0; tCalma = -1; }
  });
  const trompo = Math.abs(giro) > 2.6 || c.velocidad < -1;
  return `deriva ${Math.abs(pico).toFixed(0).padStart(2)}° gira ${(Math.abs(giro) * 57.3).toFixed(0).padStart(3)}° ${trompo ? 'TROMPO' : tCalma < 0 ? 'no se calma' : 'calma ' + tCalma.toFixed(1) + ' s'}`.padEnd(38);
}
const fondo = () => 1, parejo = (v0) => (t, c) => (c.velocidad < v0 ? 1 : 0);
const PRUEBAS = {
  'volantazo corto, a fondo  ': [(t) => (t < 0.5 ? 1 : 0), () => fondo],
  'ida y vuelta, a fondo     ': [(t) => (t < 0.5 ? 1 : t < 1.1 ? -1 : 0), () => fondo],
  'zigzag de teclado, a fondo': [(t) => (t < 2.4 ? (Math.floor(t / 0.4) % 2 ? -1 : 1) : 0), () => fondo],
  'curva larga y soltar      ': [(t) => (t < 2 ? 1 : 0), (v0) => (t, c) => (t < 2 ? (c.velocidad < v0 ? 1 : 0) : 0)],
  'curva larga y frenar      ': [(t) => (t < 3 ? 1 : 0), (v0) => (t, c) => (t < 1.5 ? (c.velocidad < v0 ? 1 : 0) : t < 2.5 ? -1 : 0)],
  'curva larga y a fondo     ': [(t) => (t < 3 ? 1 : 0), (v0) => (t, c) => (t < 1.5 ? (c.velocidad < v0 ? 1 : 0) : 1)],
};
for (const id of process.argv[2] ? [process.argv[2]] : Object.keys(AUTOS)) {
  console.log('\n===== ' + AUTOS[id].nombre + ' =====');
  for (const [nombre, [volante, pedal]] of Object.entries(PRUEBAS)) {
    console.log(nombre);
    for (const [suelo, agarre] of [['asfalto', 1], ['ripio', 1], ['barro', 0.86]]) {
      let f = '   ' + suelo.padEnd(8);
      for (const v0 of [8, 14, 21]) f += `| ${v0} m/s: ` + maniobra(AUTOS[id], suelo, v0, agarre, volante, pedal(v0));
      console.log(f);
    }
  }
}

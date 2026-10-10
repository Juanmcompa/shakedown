// Pruebas de la fisica sin graficos: como acelera, frena y dobla cada auto en cada suelo.
// uso: node tools/fisica.mjs [auto]
import { crearAuto } from '../src/vehicle.js';
import { SUELOS, AUTOS, JUEGO } from '../src/config.js';

const DT = JUEGO.paso;
// un piso parejo e inclinado: grados hacia adelante (subida) y de costado
export function plano(gradosAdelante, gradosCostado, suelo, agarre = 1) {
  const a = Math.tan(gradosAdelante * Math.PI / 180), b = Math.tan(gradosCostado * Math.PI / 180), s = SUELOS[suelo];
  return {
    altura: (x, z) => -a * z + b * x,
    normal: (x, z, o) => { const l = Math.hypot(b, 1, a); o[0] = -b / l; o[1] = 1 / l; o[2] = a / l; return o; },
    suelo: (x, z, o) => { o.agarre = s.agarre * agarre; o.freno = s.freno; o.pasta = s.pasta; o.id = s.id; o.agua = 0; return o; },
    cosasCerca: () => null,
  };
}
export function correr(c, seg, ent, cada) {
  const n = Math.round(seg / DT);
  for (let i = 0; i < n; i++) { const e = typeof ent === 'function' ? ent(i * DT, c) : ent; c.paso(e, DT); if (cada) cada(i * DT, c); }
}
const kmh = (c) => (c.velocidad * 3.6).toFixed(0);
const nada = { x: 0, y: 0 }, gas = { x: 0, y: 1 };

if (process.argv[1].endsWith('fisica.mjs')) {
  for (const id of process.argv[2] ? [process.argv[2]] : Object.keys(AUTOS)) {
    const C = AUTOS[id];
    console.log('\n===== ' + C.nombre + ' =====');
    let c = crearAuto(plano(0, 0, 'ripio'), C); c.poner(0, 0, 0); correr(c, 4, nada);
    console.log('reposo: altura', c.pos[1].toFixed(3), '| resortes', c.ruedas.map((r) => r.largo.toFixed(3)).join(' '), '| se mueve', Math.hypot(...c.vel).toFixed(4));

    console.log('--- aceleracion y velocidad final ---');
    for (const suelo of ['asfalto', 'ripio', 'tierra', 'barro', 'pasto']) {
      c = crearAuto(plano(0, 0, suelo), C); c.poner(0, 0, 0); correr(c, 1, nada);
      let t40 = 0, t60 = 0, t80 = 0;
      correr(c, 40, gas, (t, c) => { const k = c.velocidad * 3.6; if (!t40 && k >= 40) t40 = t; if (!t60 && k >= 60) t60 = t; if (!t80 && k >= 80) t80 = t; });
      console.log(suelo.padEnd(8), '0-40:', t40.toFixed(1), ' 0-60:', t60.toFixed(1), ' 0-80:', t80 ? t80.toFixed(1) : '  - ', ' final:', kmh(c), 'km/h');
    }

    console.log('--- frenada desde 80 km/h (metros) ---');
    let fila = '';
    for (const suelo of ['asfalto', 'ripio', 'tierra', 'barro', 'pasto']) {
      c = crearAuto(plano(0, 0, suelo), C); c.poner(0, 0, 0);
      let fase = 0, zf = 0, d = 0;
      correr(c, 60, (t, c) => { if (fase === 0 && c.velocidad * 3.6 >= 80) { fase = 1; zf = c.pos[2]; } if (fase === 1 && c.velocidad < 0.1) { fase = 2; d = zf - c.pos[2]; } return fase === 0 ? gas : { x: 0, y: fase === 1 ? -1 : 0 }; });
      fila += suelo + ' ' + (d ? d.toFixed(0) : '-') + '   ';
    }
    console.log(fila);

    console.log('--- doblando a fondo a velocidad pareja: radio (m), fuerza de costado (en "g" y contra el agarre del suelo), deriva y rolido ---');
    for (const suelo of ['asfalto', 'ripio', 'tierra', 'barro']) {
      let f = suelo.padEnd(8);
      for (const v0 of [6, 10, 14, 18, 22]) {
        c = crearAuto(plano(0, 0, suelo), C); c.poner(0, 0, 0);
        correr(c, 14, (t, c) => ({ x: 0, y: c.velocidad < v0 ? 1 : 0 }));
        // radio: de cuanto gira el rumbo por metro recorrido, ya estabilizado
        let giro = 0, camino = 0, ant = null, rol = 0, deriva = 0, vm = 0, nn = 0;
        correr(c, 7, (t, c) => ({ x: 1, y: c.velocidad < v0 ? 1 : 0 }), (t, c) => {
          if (t < 3.5) return;
          const rumbo = Math.atan2(c.vel[0], -c.vel[2]);
          if (ant !== null) { let d = rumbo - ant; d = Math.atan2(Math.sin(d), Math.cos(d)); giro += d; camino += Math.hypot(c.vel[0], c.vel[2]) * DT; }
          ant = rumbo; rol = Math.max(rol, Math.abs(Math.asin(c.derecha[1]) * 57.3));
          const vs = c.vel[0] * c.derecha[0] + c.vel[2] * c.derecha[2]; deriva += Math.atan2(vs, Math.abs(c.velocidad) + 0.1) * 57.3; vm += Math.hypot(c.vel[0], c.vel[2]); nn++;
        });
        const R = camino / Math.abs(giro), v = vm / nn, g = v * v / R / 9.81;
        f += ` | ${v0} m/s: R ${R.toFixed(0).padStart(3)} ${g.toFixed(2)}g ${(g / SUELOS[suelo].agarre * 100).toFixed(0)}% der ${(deriva / nn).toFixed(0)}° rol ${rol.toFixed(0)}°${c.arriba[1] < 0.5 ? ' VUELCA' : ''}`;
      }
      console.log(f);
    }

    console.log('--- volantazo a 80 km/h en asfalto y en ripio: se da vuelta? ---');
    for (const suelo of ['asfalto', 'ripio']) {
      c = crearAuto(plano(0, 0, suelo), C); c.poner(0, 0, 0);
      correr(c, 30, (t, c) => ({ x: 0, y: c.velocidad < 22.2 ? 1 : 0 }));
      let rol = 0;
      correr(c, 5, (t) => ({ x: t < 0.6 ? 1 : t < 1.4 ? -1 : 1, y: 0.5 }), (t, c) => { rol = Math.max(rol, Math.abs(Math.asin(Math.max(-1, Math.min(1, c.derecha[1]))) * 57.3)); });
      console.log(suelo.padEnd(8), 'rolido maximo', rol.toFixed(0) + '°', c.arriba[1] < 0.5 ? 'VUELCA' : 'queda parado', '| sale a', kmh(c), 'km/h');
    }

    console.log('--- caidas: de que altura aguanta sin daño (golpe en m/s; el daño empieza en ' + JUEGO.golpes.desde + ') ---');
    fila = '';
    for (const h of [0.5, 1, 1.5, 2, 3]) {
      c = crearAuto(plano(0, 0, 'ripio'), C); c.poner(0, 0, 0); c.pos[1] += h; c.vel[2] = -15; c.impacto = 0;
      let golpe = 0; correr(c, 3, gas, (t, c) => { golpe = Math.max(golpe, c.impacto); });
      fila += `${h} m: ${golpe.toFixed(1)}   `;
    }
    console.log(fila);

    console.log('--- subidas en ripio y barro: avance en 6 s desde parado ---');
    for (const suelo of ['ripio', 'tierra', 'barro', 'pasto']) {
      fila = suelo.padEnd(8);
      for (const g of [0, 6, 10, 14, 18, 22]) {
        c = crearAuto(plano(g, 0, suelo), C); c.poner(0, 0, 0); correr(c, 1.5, nada);
        const z0 = c.pos[2]; correr(c, 6, gas);
        fila += ' ' + (g + '°: ' + ((z0 - c.pos[2]) / Math.cos(g * Math.PI / 180)).toFixed(0) + ' m').padEnd(11);
      }
      console.log(fila);
    }
  }
}

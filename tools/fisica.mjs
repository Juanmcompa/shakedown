// Pruebas de la fisica sin graficos.
import { crearCamioneta } from '../src/vehicle.js';
import { SUELOS, CAMIONETA as C, JUEGO } from '../src/config.js';

const DT = JUEGO.paso;
export function plano(gradosAdelante, gradosCostado, suelo) {
  // la camioneta mira hacia -Z: subir "adelante" = altura crece hacia -Z
  const a = Math.tan(gradosAdelante * Math.PI / 180), b = Math.tan(gradosCostado * Math.PI / 180), s = SUELOS[suelo];
  return {
    altura: (x, z) => -a * z + b * x,
    normal: (x, z, o) => { const l = Math.hypot(b, 1, a); o[0] = -b / l; o[1] = 1 / l; o[2] = a / l; return o; },
    suelo: (x, z, o) => { o.agarre = s.agarre; o.freno = s.freno; o.pasta = s.pasta; o.id = s.id; o.agua = 0; o.vx = 0; o.vz = 0; return o; },
    cosasCerca: () => null,
  };
}
export function correr(c, seg, ent, cada) {
  const n = Math.round(seg / DT);
  for (let i = 0; i < n; i++) { const e = typeof ent === 'function' ? ent(i * DT, c) : ent; c.paso(e, DT); if (cada) cada(i * DT, c); }
}
const kmh = (c) => (c.velocidad * 3.6).toFixed(1);
const ang = (c) => 'cabeceo ' + (Math.asin(c.adelante[1]) * 57.3).toFixed(1) + ' rolido ' + (Math.asin(c.derecha[1]) * 57.3).toFixed(1);
const nada = { x: 0, y: 0 }, gas = { x: 0, y: 1 };

if (process.argv[1].endsWith('fisica.mjs')) {
  let c;
  console.log('--- 1. reposo en ripio plano ---');
  c = crearCamioneta(plano(0, 0, 'ripio')); c.poner(0, 0, 0); correr(c, 4, nada);
  console.log('altura', c.pos[1].toFixed(3), 'vel', Math.hypot(...c.vel).toFixed(4), 'w', Math.hypot(...c.w).toFixed(4), 'resortes', c.ruedas.map((r) => r.largo.toFixed(3)).join(' '), 'pos', c.pos[0].toFixed(3), c.pos[2].toFixed(3));

  console.log('--- 2. aceleracion en ripio ---');
  c = crearCamioneta(plano(0, 0, 'ripio')); c.poner(0, 0, 0); correr(c, 1, nada);
  let t30 = 0, t60 = 0;
  correr(c, 25, gas, (t, c) => { if (!t30 && c.velocidad * 3.6 >= 30) t30 = t; if (!t60 && c.velocidad * 3.6 >= 60) t60 = t; });
  console.log('0-30:', t30.toFixed(2), 's  0-60:', t60.toFixed(2), 's  final:', kmh(c), 'km/h', ang(c));

  console.log('--- 3. frenada desde 60 en ripio ---');
  { const z0 = c.pos[2]; let t = 0; c = crearCamioneta(plano(0, 0, 'ripio')); c.poner(0, 0, 0); correr(c, 1, nada); correr(c, 60, (t, c) => (c.velocidad * 3.6 < 60 ? gas : null) || nada, null);
    c = crearCamioneta(plano(0, 0, 'ripio')); c.poner(0, 0, 0); let fase = 0, zf = 0, tf = 0;
    correr(c, 30, (t, c) => { if (fase === 0 && c.velocidad * 3.6 >= 60) { fase = 1; zf = c.pos[2]; tf = t; } if (fase === 1 && c.velocidad < 0.05) { fase = 2; console.log('distancia', (zf - c.pos[2]).toFixed(1), 'm en', (t - tf).toFixed(2), 's'); } return fase === 0 ? gas : { x: 0, y: fase === 1 ? -1 : 0 }; }); }

  console.log('--- 4. giro a fondo ---');
  for (const [suelo, vmax] of [['ripio', 3], ['ripio', 8], ['ripio', 14], ['asfalto', 16], ['barro', 6]]) {
    c = crearCamioneta(plano(0, 0, suelo)); c.poner(0, 0, 0);
    let xmin = 1e9, xmax = -1e9, rol = 0;
    correr(c, 22, (t, c) => ({ x: t > 4 ? 1 : 0, y: c.velocidad < vmax ? 1 : 0 }), (t, c) => { if (t > 10) { xmin = Math.min(xmin, c.pos[0]); xmax = Math.max(xmax, c.pos[0]); rol = Math.max(rol, Math.abs(Math.asin(c.derecha[1]) * 57.3)); } });
    console.log(suelo.padEnd(8), 'a', vmax, 'm/s -> diametro', (xmax - xmin).toFixed(1), 'm, rolido max', rol.toFixed(1), 'arriba.y', c.arriba[1].toFixed(2), 'vel', kmh(c));
  }

  console.log('--- 5. subidas (desde parado / con envion 8 m/s): avance en 6 s ---');
  for (const suelo of ['ripio', 'tierra', 'roca', 'pasto', 'barro', 'pantano']) {
    let fila = suelo.padEnd(8);
    for (const g of [0, 8, 12, 16, 20, 25, 30, 35]) {
      const res = [];
      for (const v0 of [0, 8]) {
        c = crearCamioneta(plano(g, 0, suelo)); c.poner(0, 0, 0); correr(c, 1.5, nada);
        const co = Math.cos(g * Math.PI / 180), si = Math.sin(g * Math.PI / 180);
        c.vel[2] = -v0 * co; c.vel[1] = v0 * si;
        const z0 = c.pos[2]; correr(c, 6, gas);
        res.push(((z0 - c.pos[2]) / co).toFixed(0));
      }
      fila += ' ' + (g + '°:' + res.join('/')).padEnd(11);
    }
    console.log(fila);
  }

  console.log('--- 6. de costado: se sostiene? (deriva lateral en 5 s: quieto / acelerando a fondo) ---');
  for (const suelo of ['ripio', 'tierra', 'pasto', 'barro']) {
    let fila = suelo.padEnd(8);
    for (const g of [8, 12, 16, 20, 25, 30]) {
      const res = [];
      for (const e of [nada, gas]) {
        c = crearCamioneta(plano(0, g, suelo)); c.poner(0, 0, 0); correr(c, 1.5, nada);
        const x0 = c.pos[0]; correr(c, 5, e);
        res.push((c.pos[0] - x0).toFixed(1) + (c.arriba[1] < 0.5 ? 'V' : ''));
      }
      fila += ' ' + (g + '°:' + res.join('/')).padEnd(14);
    }
    console.log(fila);
  }

  console.log('--- 7. caida de 2.5 m ---');
  c = crearCamioneta(plano(0, 0, 'ripio')); c.poner(0, 0, 0); c.pos[1] += 2.5; c.vel[2] = -8;
  let maxw = 0; correr(c, 4, nada, (t, c) => { maxw = Math.max(maxw, Math.hypot(...c.w)); });
  console.log('altura final', c.pos[1].toFixed(3), 'vel', Math.hypot(...c.vel).toFixed(3), 'w max', maxw.toFixed(2), ang(c));

  console.log('--- 8. barro: velocidad final a fondo, y distancia hasta frenarse en pantano entrando a 4/6/8 m/s ---');
  c = crearCamioneta(plano(0, 0, 'barro')); c.poner(0, 0, 0); correr(c, 20, gas); console.log('barro a fondo:', kmh(c), 'km/h');
  c = crearCamioneta(plano(0, 0, 'pantano')); c.poner(0, 0, 0); correr(c, 20, gas); console.log('pantano a fondo:', kmh(c), 'km/h');
  for (const v0 of [4, 6, 8]) { c = crearCamioneta(plano(0, 0, 'pantano')); c.poner(0, 0, 0); correr(c, 1, nada); c.vel[2] = -v0; const z0 = c.pos[2]; let d = 0; correr(c, 8, gas, (t, c) => { if (!d && c.velocidad < 0.8) d = z0 - c.pos[2]; }); console.log('  entra a', v0, 'm/s -> recorre', d.toFixed(1), 'm antes de quedar a paso de hombre'); }
}

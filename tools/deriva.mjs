// Mide como dobla y cuanto colea: angulo de deriva (entre hacia donde apunta y hacia donde va).
import { crearCamioneta } from '../src/vehicle.js';
import { JUEGO } from '../src/config.js';
import { plano, correr } from './fisica.mjs';
const DT = JUEGO.paso;
function prueba(suelo, v0, gasDurante, mano) {
  const c = crearCamioneta(plano(0, 0, suelo)); c.poner(0, 0, 0);
  correr(c, 12, (t, c) => ({ x: 0, y: c.velocidad < v0 ? 1 : 0 }));
  let maxDeriva = 0, t80 = 0, giroFinal = 0, rumbo0 = Math.atan2(c.adelante[0], -c.adelante[2]), vueltas = 0, ant = rumbo0, out = [];
  correr(c, 4, (t) => ({ x: 1, y: gasDurante, mano: mano && t < 0.8 }), (t, c) => {
    const f = c.adelante, r = c.derecha, vl = c.vel[0] * f[0] + c.vel[2] * f[2], vs = c.vel[0] * r[0] + c.vel[2] * r[2];
    const deriva = Math.atan2(vs, Math.abs(vl) + 0.01) * 57.3;
    if (Math.abs(deriva) > Math.abs(maxDeriva)) maxDeriva = deriva;
    const rumbo = Math.atan2(f[0], -f[2]); let d = rumbo - ant; d = Math.atan2(Math.sin(d), Math.cos(d)); vueltas += d; ant = rumbo;
    if (Math.abs(t - 1) < DT / 2 || Math.abs(t - 2) < DT / 2 || Math.abs(t - 3.99) < DT) out.push((vueltas * 57.3).toFixed(0) + '°@' + t.toFixed(0) + 's');
  });
  return suelo.padEnd(8) + ' v0=' + String(v0).padStart(2) + ' gas=' + gasDurante + (mano ? ' +mano' : '      ') + ' | deriva max ' + maxDeriva.toFixed(0).padStart(4) + '° | giro ' + out.join(' ') + ' | vel final ' + (c.velocidad * 3.6).toFixed(0) + ' km/h';
}
for (const s of ['ripio', 'tierra', 'barro', 'pasto', 'asfalto']) for (const [v, g, m] of [[6, 1, 0], [10, 1, 0], [10, 0, 0], [14, 1, 0], [10, 1, 1]]) console.log(prueba(s, v, g, m));

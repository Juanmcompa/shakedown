// El modo "rally serio" (ver SERIO en config.js), sin graficos: en una recta de ripio, cada auto hace unas maniobras
// en arcade y en serio, y se compara.
//   a) frenar fuerte y doblar: en serio el auto tiene que rotar mas (la cola se aliviana al frenar)
//   b) derrape sostenido con acelerador y contravolante: en serio tiene que durar mas
//   c) freno de mano: en serio tiene que soltar la cola (el auto rota mas)
//   d) con el modo apagado todo da como antes: una suma de control de muchas maniobras en arcade, contra la guardada
// uso: node tools/pruebas/verserio.mjs            (dice "todo bien" o lo que falla; d) compara con medidas/serio-arcade-v1.txt)
//      node tools/pruebas/verserio.mjs guardar    (guarda la suma de d: solo si se cambio el manejo de arcade a proposito)
import { crearAuto, enSerio } from '../../src/vehicle.js';
import { JUEGO } from '../../src/config.js';
import { configDe } from '../../src/partes.js';
import { plano, correr } from '../fisica.mjs';
import fs from 'node:fs';
import crypto from 'node:crypto';

const DT = JUEGO.paso, AUTOS = ['333', '323', '151', '343', '353', '545', '412'];
const ARCHIVO = new URL('./medidas/serio-arcade-v1.txt', import.meta.url);
let mal = 0;
const ver = (que, si) => { console.log((si ? '  ok  ' : '  MAL ') + que); if (!si) mal++; };
const rumbo = (c) => Math.atan2(c.adelante[0], -c.adelante[2]);
const deriva = (c) => { const vs = c.vel[0] * c.derecha[0] + c.vel[2] * c.derecha[2]; return Math.atan2(vs, Math.max(0.5, Math.abs(c.velocidad))); };
const angulo = (a) => Math.atan2(Math.sin(a), Math.cos(a));
// un auto en una recta de ripio, ya andando derecho a v0 m/s
function lanzado(C, v0, suelo = 'ripio') {
  const c = crearAuto(plano(0, 0, suelo), C); c.poner(0, 0, 0);
  correr(c, 30, (t, c) => ({ x: 0, y: c.velocidad < v0 ? 1 : 0 }));
  return c;
}
// cuanto giro el auto (en grados) haciendo "ent" un rato
function cuantoGira(c, seg, ent) {
  let antes = rumbo(c), giro = 0;
  correr(c, seg, ent, (t, c) => { const r = rumbo(c); giro += angulo(r - antes); antes = r; });
  return Math.abs(giro) * 57.3;
}

// a) entra frenando a fondo y doblando (el "trail braking"): cuanto rota en el primer segundo
const frenaYDobla = (C) => cuantoGira(lanzado(C, 20), 1, (t) => ({ x: 1, y: t < 0.7 ? -1 : 0 }));
// b) derrape sostenido: lo cruza con un amague y un tirón del freno de mano, y despues lo sostiene como un piloto: si se
//    cruza de mas, contravolante; si se endereza, volante hacia la curva y mas acelerador. Cuenta cuanto dura cruzado
//    (entre 10 y 60 grados, sin bajar de 4 m/s).
function derrape(C) {
  const c = lanzado(C, 16);
  correr(c, 0.3, { x: -1, y: 0 });
  correr(c, 0.4, { x: 1, y: 0, mano: true });
  const lado = Math.sign(deriva(c)) || 1, quiere = 0.4;
  let dura = 0, sigue = true, antes = deriva(c) * lado;
  correr(c, 6, () => {
    const b = deriva(c) * lado, cambia = (b - antes) / DT; antes = b;
    return { x: lado * Math.max(-1, Math.min(1, 0.6 * b / quiere - 1 + 3 * (b - quiere) + 0.3 * cambia)), y: Math.max(0, Math.min(1, 0.6 + 2 * (quiere - b))) };
  }, (t, c) => {
    const b = Math.abs(deriva(c));
    if (sigue && b > 0.17 && b < 1.05 && c.velocidad > 4) dura += DT; else if (t > 0.3) sigue = false;
  });
  return dura;
}
// c) freno de mano: a 15 m/s, volante a fondo y el freno de mano medio segundo. Cuanto rota y cuanto se cruza.
function deMano(C) {
  const c = lanzado(C, 15);
  let pico = 0;
  const giro = cuantoGira(c, 1.2, (t, c) => { pico = Math.max(pico, Math.abs(deriva(c))); return { x: 1, y: 0, mano: t < 0.5 }; });
  return [giro, pico * 57.3];
}

console.log('auto  | frenar y doblar (grados) | derrape sostenido (s) | freno de mano (grados, cruzado)');
const f1 = (x) => x.toFixed(1).padStart(5);
for (const id of AUTOS) {
  const A = configDe(id), S = enSerio(A);
  const a = [frenaYDobla(A), frenaYDobla(S)], b = [derrape(A), derrape(S)], m = [deMano(A), deMano(S)];
  console.log(`${id}   | arcade ${f1(a[0])} serio ${f1(a[1])} | arcade ${f1(b[0])} serio ${f1(b[1])} | arcade ${f1(m[0][0])} ${f1(m[0][1])}  serio ${f1(m[1][0])} ${f1(m[1][1])}`);
  ver(id + ' a) frenando y doblando rota mas en serio', a[1] > a[0] * 1.1);
  ver(id + ' b) el derrape dura mas en serio', b[1] > b[0] * 1.5 + 0.15);
  ver(id + ' c) el freno de mano suelta mas la cola en serio', m[1][1] > m[0][1] * 1.1);
}

// d) arcade como antes: muchas maniobras con varios autos y suelos; la suma de las posiciones y velocidades
const h = crypto.createHash('sha1');
for (const id of AUTOS) for (const suelo of ['asfalto', 'ripio', 'barro']) for (const v0 of [8, 20]) {
  const c = lanzado(configDe(id), v0, suelo);
  correr(c, 4, (t) => ({ x: t < 0.5 ? 1 : t < 1.1 ? -1 : t < 2 ? 0.4 : 0, y: t < 1.5 ? 1 : t < 2.5 ? -1 : 0.5, mano: t > 2.8 && t < 3.3 }),
    (t, c) => h.update(Float64Array.from([...c.pos, ...c.vel, ...c.q, c.patina, c.giroRuedas])));
}
const suma = h.digest('hex').slice(0, 16);
if (process.argv[2] === 'guardar') { fs.writeFileSync(ARCHIVO, suma + '\n'); console.log('guardada la suma de arcade: ' + suma); }
else ver('d) arcade maneja igual que antes (' + suma + ')', fs.existsSync(ARCHIVO) && fs.readFileSync(ARCHIVO, 'utf8').trim() === suma);

console.log(mal ? mal + ' cosas mal' : 'todo bien');
process.exitCode = mal ? 1 : 0;

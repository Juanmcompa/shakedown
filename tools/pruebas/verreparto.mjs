// Prueba Reparto (la otra pagina, en reparto/): hace 3 entregas con el piloto automatico (que no frena para explicar), recarga la pagina y mira que
// los 3 viajes vuelvan a la calle, que una version pasada frene al auto si se le cruza, y que un viaje tarde se guarde
// igual y se reintente. Deja capturas en out/reparto-*.png.
// uso: node tools/pruebas/verreparto.mjs
import { abrir } from './ver.mjs';

const j = await abrir({ ruta: 'reparto/', sinEsperar: true });
const { pag } = j;
const ok = await pag.waitForFunction(() => window.reparto, null, { timeout: 90000 }).then(() => true).catch(() => false);
if (!ok) { console.log('NO CARGO\n' + j.errores.join('\n')); await j.cerrar(); process.exit(1); }
const mal = [];
const ver = (si, txt) => { console.log((si ? 'bien: ' : 'MAL:  ') + txt); if (!si) mal.push(txt); };

await pag.evaluate(() => { localStorage.removeItem('reparto2'); });
await pag.reload();
await pag.waitForFunction(() => window.reparto);
await pag.screenshot({ path: 'out/reparto-portada.png' });

// --- 3 entregas con el piloto ---
// (la explicacion de la primera version pasada frena todo: se da por vista)
await pag.evaluate(() => { window.reparto.memoria.visto(true); window.reparto.salir(); window.reparto.avanzar(0.1); window.reparto.pilotear(); });
let e;
for (let i = 0; i < 40; i++) {
  e = await pag.evaluate(() => window.reparto.avanzar(10));
  if (e.entregas >= 3) break;
}
console.log('despues de manejar:', JSON.stringify(e));
ver(e.entregas >= 3, '3 entregas con el piloto (' + e.entregas + ')');
ver(e.pasados >= e.entregas, 'cada viaje queda como version pasada (' + e.pasados + ')');
await pag.evaluate(() => { window.reparto.pilotear(false); window.reparto.avanzar(4); });
await pag.screenshot({ path: 'out/reparto-viaje.png' });

// --- recargar: los viajes vuelven ---
await pag.reload();
await pag.waitForFunction(() => window.reparto);
e = await pag.evaluate(() => window.reparto.estado());
ver(e.pasados >= 3 && e.entregas >= 3, 'al recargar vuelven los 3 viajes (' + e.pasados + ', entregas ' + e.entregas + ')');
await pag.evaluate(() => { window.reparto.salir(); window.reparto.avanzar(2.5); });
e = await pag.evaluate(() => window.reparto.avanzar(6));
await pag.screenshot({ path: 'out/reparto-pasados.png' });

// --- una version pasada se cruza: el auto, quieto en su camino, termina empujado ---
const r = await pag.evaluate(() => {
  const R = window.reparto, v = R.memoria.viajes()[0], c = R.auto(), s = R.estado();
  // un punto del viaje 1 que pase unos 6 s despues de ahora
  const i = Math.min(v.xs.length - 1, Math.round((s.reloj + 6) / 0.2));
  c.poner(v.xs[i], v.zs[i], v.rs[i] + Math.PI / 2);
  const antes = [c.pos[0], c.pos[2]];
  R.avanzar(9);
  return { movido: Math.hypot(c.pos[0] - antes[0], c.pos[2] - antes[2]), fase: R.estado().fase };
});
ver(r.movido > 1, 'una version pasada empuja al auto (lo corrio ' + r.movido.toFixed(1) + ' m)');

// --- se hace tarde: el viaje queda y se reintenta el mismo ---
e = await pag.evaluate(() => window.reparto.estado());
const antes = e;
e = await pag.evaluate(() => window.reparto.avanzar(130));
console.log('despues de esperar:', JSON.stringify(e));
ver(e.pasados === antes.pasados + 1, 'el viaje tarde tambien queda (' + antes.pasados + ' → ' + e.pasados + ')');
ver(e.k === antes.k && e.entregas === antes.entregas, 'se reintenta el mismo viaje (' + e.k + ')');
await pag.evaluate(() => window.reparto.camara('atras'));
await pag.evaluate(() => window.reparto.avanzar(3));
await pag.screenshot({ path: 'out/reparto-atras.png' });

console.log(j.errores.length ? 'ERRORES:\n' + [...new Set(j.errores)].join('\n') : 'sin errores en consola');
console.log(mal.length ? 'FALLARON ' + mal.length : 'TODO BIEN');
await j.cerrar();
process.exit(mal.length ? 1 : 0);

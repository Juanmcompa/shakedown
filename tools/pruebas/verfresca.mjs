// La pagina vieja: que el juego no arranque nunca con un index.html viejo y el codigo nuevo (asi fallo: "pág. 18" con el
// codigo de la 20, en papelitos.js, con un ?fresca= viejo en la direccion de una pestaña restaurada).
// Se hace de cuenta que el navegador tiene guardado el index.html de la pagina 18 (de la historia del repo de trabajo).
// uso: node tools/pruebas/verfresca.mjs
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import { abrir } from './ver.mjs';
const REPO = new URL('../..', import.meta.url).pathname.replace(/\/$/, '');
const VIEJA = execSync('git -C ' + REPO + ' show a10fd93:index.html', { encoding: 'utf8' });
if (!/data-pagina="18"/.test(VIEJA)) throw new Error('no es la pagina 18');
let mal = 0;
const ver = (que, bien, dato) => { if (!bien) mal++; console.log((bien ? '  ok  ' : '  MAL ') + que + (dato !== undefined ? ' -> ' + JSON.stringify(dato) : '')); };

// vieja(fresca): si para esa direccion el "navegador" tiene la pagina vieja. Cuenta los pedidos del documento.
async function caso(nombre, ruta, vieja, esperarJuego) {
  const pedidos = [];
  const j = await abrir({
    ruta, sinEsperar: !esperarJuego,
    antes: (pag) => pag.route((u) => u.pathname === '/', (r) => {
      const f = new URL(r.request().url()).searchParams.get('fresca');
      pedidos.push(f || '-');
      if (vieja(f)) r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: VIEJA }); else r.continue();
    }),
  });
  const A = j.pag;
  if (esperarJuego) await A.waitForFunction(() => window.shakedown && !document.documentElement.classList.contains('cargando'), null, { timeout: 120000 }).catch(() => {});
  else await A.waitForFunction(() => document.documentElement.classList.contains('carga-fallo'), null, { timeout: 60000 }).catch(() => {});
  await A.waitForTimeout(3000);   // (por si se volviera a recargar)
  const r = await A.evaluate(() => ({ pagina: document.documentElement.dataset.pagina, juego: !!window.shakedown, fallo: document.documentElement.classList.contains('carga-fallo'),
    codigo: window.carga && window.carga.codigo, texto: (document.getElementById('cargaTexto') || {}).textContent, busqueda: location.search }));
  console.log(nombre + ':', JSON.stringify({ ...r, pedidos }));
  await j.cerrar();
  return { ...r, pedidos, errores: j.errores };
}

// 1. la pestaña restaurada: la direccion trae un ?fresca= de hace dias y el navegador tiene la pagina 18 para esa direccion
let r = await caso('restaurada', '?fresca=1000000000000', (f) => f === '1000000000000', true);
// (la pagina de ahora: la que dice index.html)
const AHORA = /data-pagina="(\d+)"/.exec(fs.readFileSync(REPO + '/index.html', 'utf8'))[1];
ver('pestaña restaurada con la pagina 18: se pide de nuevo y arranca con la de ahora (' + AHORA + ')', r.juego && r.pagina === AHORA && !r.fallo && r.pedidos.length === 2, r.pedidos);
ver('y la direccion queda sin ?fresca=', !/fresca/.test(r.busqueda), r.busqueda);
ver('sin errores en la consola', !r.errores.length, r.errores.slice(0, 3));
// 2. el sitio todavia reparte la vieja (recien publicado): una sola vuelta y despues el aviso, sin quedar dando vueltas
r = await caso('sitio viejo', '', () => true, false);
ver('el sitio sigue dando la vieja: se pide una sola vez mas y avisa con el codigo A', r.fallo && /^A/.test(r.codigo || '') && r.pedidos.length === 2 && !r.juego, { pedidos: r.pedidos, codigo: r.codigo });
ver('el aviso dice que hay una version nueva', /versión nueva/.test(r.texto || ''), r.texto);
// 3. ya al dia, con un ?fresca= en la direccion (de la vuelta anterior): arranca y se lo saca, dejando lo demas
r = await caso('al dia con fresca', '?c=subida&fresca=' + Date.now(), () => false, true);
ver('al dia con ?fresca=: arranca sin volver a pedir la pagina', r.juego && !r.fallo && r.pedidos.length === 1, r.pedidos);
ver('y la direccion queda limpia, con el circuito', !/fresca/.test(r.busqueda) && /c=subida/.test(r.busqueda), r.busqueda);
// 4. lo normal: la pagina al dia, sin nada
r = await caso('normal', '', () => false, true);
ver('lo normal: un solo pedido y la direccion sin tocar', r.juego && !r.fallo && r.pedidos.length === 1 && !/fresca/.test(r.busqueda), { pedidos: r.pedidos, busqueda: r.busqueda });
ver('sin errores en la consola (normal)', !r.errores.length, r.errores.slice(0, 3));
console.log(mal ? 'FALLARON ' + mal : 'todo bien');
process.exit(mal ? 1 : 0);

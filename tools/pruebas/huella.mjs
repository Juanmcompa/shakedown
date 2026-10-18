// Suma de control del terreno de varias pistas: sirve para ver si un cambio en el generador o en terrain.js
// altera las pistas que ya existen (si cambia, hay que subir VERSION).
// uso: node tools/pruebas/huella.mjs [desde] [cuantas] [archivo donde guardar o comparar]
import { crearTerreno } from '../../src/terrain.js';
import { generarPista } from '../../src/generador.js';
import { crearReferencia } from '../../src/referencia.js';
import { AUTOS, REFERENCIA } from '../../src/config.js';
import fs from 'node:fs';
import crypto from 'node:crypto';
const desde = Number(process.argv[2] || 1), cuantas = Number(process.argv[3] || 8), archivo = process.argv[4];
const suma = (...partes) => { const h = crypto.createHash('sha1'); for (const p of partes) h.update(typeof p === 'string' ? p : Buffer.from(p.buffer, p.byteOffset, p.byteLength)); return h.digest('hex').slice(0, 12); };
const lineas = [];
for (let n = desde; n < desde + cuantas; n++) {
  const e = generarPista(n), T = crearTerreno(e), P = T.camino, ref = crearReferencia(T, AUTOS[REFERENCIA]);
  const cosas = new Float32Array(T.cosas.length * 3); T.cosas.forEach((o, k) => { cosas[k * 3] = o.x; cosas[k * 3 + 1] = o.z; cosas[k * 3 + 2] = o.r; });
  lineas.push(`#${n} tramos ${suma(JSON.stringify(e.tramos.map((t) => [t.largo, t.giro, t.pendiente, t.ancho, t.suelo])))} camino ${suma(P.X, P.Z, P.Y, P.W)} alturas ${suma(T.H)} suelos ${suma(T.S)} cosas ${T.cosas.length}:${suma(cosas)} publico ${T.publico.length} ref ${ref.total.toFixed(2)}`);
}
const texto = lineas.join('\n') + '\n';
if (archivo && fs.existsSync(archivo)) {
  const antes = fs.readFileSync(archivo, 'utf8');
  console.log(antes === texto ? 'IGUAL: las pistas ' + desde + ' a ' + (desde + cuantas - 1) + ' no cambiaron' : 'CAMBIARON:\n' + texto.split('\n').map((l, k) => (l === antes.split('\n')[k] ? '  ' : '* ') + l).join('\n'));
} else { if (archivo) fs.writeFileSync(archivo, texto); process.stdout.write(texto); }

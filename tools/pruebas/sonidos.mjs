// Graba los sonidos de los golpes, las caidas y la meta (src/audio.js) en un archivo, para escucharlos sin jugar, y revisa
// que ninguno salga mudo ni roto (sin numeros raros, sin pasarse de volumen).
// uso: node tools/pruebas/sonidos.mjs [salida.wav]      (despues: ffmpeg -i salida.wav salida.m4a, para mandarlo)
import fs from 'node:fs';
import { abrir } from './ver.mjs';
const SALIDA = process.argv[2] || 'out/sonidos.wav';
// lo que suena, en orden: [segundo, que, contra, fuerza, daño, roto, cosa]
const GUION = [
  [0.3, 'golpe', 'piedra', 0.9, 0.6, 10, true],
  [1.6, 'voltear', 'poste', 0.9],
  [3.0, 'golpe', 'arbol', 0.7, 0.4, 20, true],
  [4.3, 'voltear', 'fardo', 0.7],
  [5.3, 'voltear', 'cono', 0.6],
  [6.3, 'golpe', 'auto', 0.9, 0.7, 30, true],
  [7.8, 'golpe', 'edificio', 1, 0.9, 40, true],
  [9.3, 'golpe', 'piso', 0.6, 0.3, 40, true],
  [10.6, 'golpe', 'arbusto', 0.4, 0, 40, true],
  [11.8, 'golpe', 'piedra', 0.9, 0.8, 85, true],     // la misma piedra, con el auto muy roto: cruje mas y algo se suelta
  [13.4, 'suelto'], [13.7, 'suelto'], [14.05, 'suelto'], [14.3, 'suelto'],
  [15.2, 'caida', 'caida'],
  [17.4, 'meta'],
];
const j = await abrir({ ancho: 800, alto: 600 });
if (!j.cargo) { console.log('NO CARGO\n' + j.errores.join('\n')); process.exit(1); }
const r = await j.pag.evaluate(async (guion) => {
  const { crearGolpes } = await import('/src/audio.js');
  const RATE = 44100, ctx = new OfflineAudioContext(1, RATE * 21.5, RATE), salida = ctx.createGain();
  salida.gain.value = 0.5; salida.connect(ctx.destination);   // (como en el juego)
  const g = crearGolpes(ctx, salida);
  for (const [t, que, contra, fuerza, dano, roto, cosa] of guion) {
    if (que === 'golpe') g.golpe(t, contra, fuerza, dano, roto, cosa);
    else if (que === 'voltear') g.voltear(t, contra, fuerza);
    else if (que === 'caida') g.caida(t, contra);
    else if (que === 'meta') g.meta(t);
    else if (que === 'suelto') g.suelto(t);
  }
  const buf = await ctx.startRendering(), d = buf.getChannelData(0);
  // cuanto suena cada parte (el pico), y si hay algo raro
  const partes = guion.map(([t, que, contra], k) => {
    const hasta = k + 1 < guion.length ? guion[k + 1][0] : t + 3.5;
    let pico = 0;
    for (let i = Math.floor(t * RATE); i < Math.min(d.length, Math.floor(hasta * RATE)); i++) pico = Math.max(pico, Math.abs(d[i]));
    return { que: que + (contra ? ' ' + contra : ''), pico: +pico.toFixed(3) };
  });
  let raros = 0, maximo = 0;
  for (let i = 0; i < d.length; i++) { if (!Number.isFinite(d[i])) raros++; else maximo = Math.max(maximo, Math.abs(d[i])); }
  // a 16 bits, en base64 (para pasarlo afuera)
  const pcm = new Int16Array(d.length);
  for (let i = 0; i < d.length; i++) pcm[i] = Math.max(-32767, Math.min(32767, Math.round((Number.isFinite(d[i]) ? d[i] : 0) * 32767)));
  const bytes = new Uint8Array(pcm.buffer);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return { partes, raros, maximo, rate: RATE, datos: btoa(s) };
}, GUION);
await j.cerrar();
const pcm = Buffer.from(r.datos, 'base64'), cab = Buffer.alloc(44);
cab.write('RIFF', 0); cab.writeUInt32LE(36 + pcm.length, 4); cab.write('WAVE', 8); cab.write('fmt ', 12); cab.writeUInt32LE(16, 16);
cab.writeUInt16LE(1, 20); cab.writeUInt16LE(1, 22); cab.writeUInt32LE(r.rate, 24); cab.writeUInt32LE(r.rate * 2, 28); cab.writeUInt16LE(2, 32); cab.writeUInt16LE(16, 34);
cab.write('data', 36); cab.writeUInt32LE(pcm.length, 40);
fs.writeFileSync(SALIDA, Buffer.concat([cab, pcm]));
let mal = 0;
for (const p of r.partes) { const bien = p.pico > 0.01 && p.pico < 0.99; if (!bien) mal++; console.log((bien ? '  ok  ' : '  MAL ') + p.que.padEnd(18) + ' pico ' + p.pico); }
console.log('numeros raros:', r.raros, '| pico de todo:', r.maximo.toFixed(3), '| grabado en', SALIDA);
if (r.raros || r.maximo >= 1) mal++;
console.log(mal ? 'FALLARON ' + mal : 'todo bien');
process.exit(mal ? 1 : 0);

// Que cada choque diga contra que fue (para el sonido: ver src/audio.js). Busca cosas al lado del camino en varias pistas
// (piedras, arboles, postes del alambrado, fardos, autos tirados, edificios...), tira el auto contra cada una y mira el
// aviso de golpe de las reglas (con "contra") y lo que el auto se llevo puesto.
// uso: node tools/pruebas/golpes.mjs [pistas: 1,2,3,16001,16002,16003]
import { generarPista } from '../../src/generador.js';
import { crearTerreno } from '../../src/terrain.js';
import { crearAuto } from '../../src/vehicle.js';
import { crearPartida } from '../../src/reglas.js';
import { crearReferencia } from '../../src/referencia.js';
import { AUTOS, REFERENCIA, JUEGO } from '../../src/config.js';
import { MATERIAL } from '../../src/audio.js';
const pistas = (process.argv[2] || '1,2,3,4,16001,16002,16003').split(',').map(Number);
const claseDe = (o) => (o.clase === 'objeto' ? o.tipo : o.clase === 'arbol' && o.tipo === 'arbusto' ? 'arbusto' : o.clase);
const resumen = {};   // clase -> { probadas, golpe: cuantas dieron golpe con esa clase, volteo: cuantas la voltearon, otras: {contra: n} }
for (const n of pistas) {
  const T = crearTerreno(generarPista(n)), P = T.camino, ref = crearReferencia(T, AUTOS[REFERENCIA]);
  // las cosas cerca del camino, una por clase cada tanto
  const vistas = new Set(), porClase = {};
  for (let i = 30; i < P.n - 30; i += 4) {
    for (const lado of [-1, 1]) for (const d of [2, 5, 8, 11]) {
      const x = P.X[i] - P.HZ[i] * lado * (P.W[i] / 2 + d), z = P.Z[i] + P.HX[i] * lado * (P.W[i] / 2 + d);
      for (const o of T.cosasCerca(x, z) || []) {
        if (vistas.has(o)) continue;
        vistas.add(o);
        const k = claseDe(o), l = porClase[k] || (porClase[k] = []);
        if (l.length < 3 && Math.hypot(o.x - P.X[i], o.z - P.Z[i]) < P.W[i] / 2 + 12) l.push({ o, i });
      }
    }
  }
  for (const k in porClase) for (const { o, i } of porClase[k]) {
    const c = crearAuto(T, AUTOS.vitarita), p = crearPartida(T, ref.sectores);
    p.preparar(c);
    p.estado = 'corriendo';
    // el auto, a 7 metros, apuntando al centro de la cosa y a 18 m/s
    const ox = o.x, oz = o.z, sx = P.X[i], sz = P.Z[i], dl = Math.hypot(ox - sx, oz - sz) || 1, dx = (ox - sx) / dl, dz = (oz - sz) / dl;
    const x = ox - dx * 7, z = oz - dz * 7;
    c.poner(x, z, Math.atan2(dx, -dz));
    c.vel[0] = dx * 18; c.vel[2] = dz * 18;
    p.indice = T.indice(x, z, i);
    const contras = [], volteo = [];
    for (let t = 0; t < 1.2 && p.estado === 'corriendo'; t += JUEGO.paso) {
      c.paso({ x: 0, y: 0, mano: false }, JUEGO.paso);
      p.paso(c, JUEGO.paso);
      for (const e of p.eventos.splice(0)) if (e.tipo === 'golpe') contras.push(e.contra);
      if (c.rompio.length) { volteo.push(...c.rompio.map(claseDe)); c.rompio.length = 0; }
    }
    const r = resumen[k] || (resumen[k] = { probadas: 0, golpe: 0, volteo: 0, otras: {} });
    r.probadas++;
    if (contras.includes(k)) r.golpe++;
    if (volteo.includes(k)) r.volteo++;
    for (const x of contras) if (x !== k) r.otras[x] = (r.otras[x] || 0) + 1;
  }
}
let mal = 0;
for (const k of Object.keys(resumen).sort()) {
  const r = resumen[k], material = MATERIAL[k];
  const anda = r.golpe > 0 || r.volteo > 0;
  if (!anda || !material) mal++;
  console.log((anda && material ? '  ok  ' : '  MAL ') + k.padEnd(10) + ' suena a ' + String(material).padEnd(10) + ' probadas ' + r.probadas + ' | golpe ' + r.golpe + ' | volteada ' + r.volteo + (Object.keys(r.otras).length ? ' | otros golpes: ' + JSON.stringify(r.otras) : ''));
}
console.log(mal ? 'FALLARON ' + mal : 'todo bien');
process.exit(mal ? 1 : 0);

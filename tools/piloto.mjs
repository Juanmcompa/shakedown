// Un piloto prolijo recorre la etapa a distintas velocidades para ver si se puede terminar
// y cuanta nafta sobra. Conviene correrlo despues de tocar config.js o etapa1.js.
//
// uso: node tools/piloto.mjs
import { crearTerreno } from '../src/terrain.js';
import { ETAPA } from '../src/etapa1.js';
import { humano } from './humano.mjs';

const T = crearTerreno(ETAPA);
const envion = ETAPA.tramos.map((t, i) => (t.envion ? i : -1)).filter((i) => i >= 0);
for (const v of [4, 6, 8, 10, 13]) {
  const r = humano(T, { reaccion: 0.05, umbral: 0.02, desvio: 0, lateral: 3.2, cuidado: 2.5, v, envion, semilla: 1 });
  console.log('a', String(v).padStart(2), 'm/s ->', r.llego ? 'LLEGO' : 'no llego (' + r.motivo + ', metro ' + r.m + ')', '| tiempo', r.t.toFixed(0), 's | nafta', r.nafta.toFixed(0), '| daño', r.roto.toFixed(0), '| rescates', r.usados, Object.keys(r.fallas).length ? '| ' + JSON.stringify(r.fallas) : '');
}

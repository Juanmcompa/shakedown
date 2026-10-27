// El festival de la largada y de la llegada, en TODAS las pistas (la del dia, los circuitos y las de la comunidad): gente detras de
// cintas que festeja, carpas de los equipos con su lampara, camiones de asistencia, autos de rally y de la gente estacionados.
// Se dibuja con lo mismo que el festival de la Travesia (travesiafiesta.js) pero es solo decoracion: no se choca ni cambia
// el terreno ni la pista (por eso las huellas de los circuitos no cambian). Se pone solo donde no hay arboles ni otra cosa.
// Los arcos, los banderines y la gente de la propia pista (utileria.js, publico.js) siguen donde estaban: esto se suma.
import { crearFiestaDeTravesia } from './travesiafiesta.js';
import { azar } from './noise.js';

const COLORES_CARPA = ['#d8402f', '#2f6fb3', '#f2c200', '#3f9150', '#f4f0e6', '#f07f1e'];

// Arma los datos de un festival (la forma de T.fiesta de la Travesia) entre los metros "desde" y "hasta" del camino, con su
// centro (la raya) en "centro": hay mas gente cerca de la raya. libre(x, z, radio): si ahi no hay nada.
function datosDeFiesta(T, desde, hasta, centro, carpas, rf, libre) {
  const P = T.camino, alt = (x, z) => T.altura(x, z), ent = (a, b) => a + (b - a) * rf();
  const rumboDe = (i) => Math.atan2(P.HX[i], -P.HZ[i]);
  const F = { arco: null, banderines: false, gente: [], cintas: [], carpas: [], autos: [], claros: [], desde, fin: hasta, visible: (i) => Math.abs(i - centro) < 340 };
  const lugar = (i, d) => [P.X[i] - P.HZ[i] * d, P.Z[i] + P.HX[i] * d];
  const plano = (x, z, i) => Math.abs(alt(x, z) - P.Y[i]) < 2.6;
  const span = Math.max(60, Math.max(centro - desde, hasta - centro));
  for (const lado of [-1, 1]) {
    let i = desde + ent(0, 8);
    while (i < hasta) {
      const ii = Math.max(0, Math.min(P.n - 1, Math.round(i))), u = Math.min(1, Math.abs(i - centro) / span);
      if (rf() > 0.28 + 0.5 * u) {
        const n = Math.max(2, Math.round((11 - 8 * u) * ent(0.75, 1.15))), ancho = 1.6 + n * 0.55, hx = P.HX[ii], hz = P.HZ[ii], d = P.W[ii] / 2 + 4.3;
        const [cx, cz] = lugar(ii, lado * d);
        if (libre(cx, cz, ancho / 2 + 3.2) && plano(cx, cz, ii)) {
          F.claros.push({ x: cx, z: cz, r: ancho / 2 + 3.5 });
          for (let k = 0; k < n; k++) {
            const a = (k + 0.5) / n - 0.5 + (rf() - 0.5) * 0.08, fondo = (k % 2) * 0.9 + rf() * 0.5;
            F.gente.push({ x: cx + hx * a * ancho - hz * lado * fondo, z: cz + hz * a * ancho + hx * lado * fondo, rumbo: rumboDe(ii) - lado * Math.PI / 2 + (rf() - 0.5) * 0.5, ropa: Math.floor(rf() * 8), fase: rf(), i: ii });
          }
          const kx = cx + hz * lado * 1.7, kz = cz - hx * lado * 1.7, m = ancho / 2 + 0.9;
          F.cintas.push({ x1: kx - hx * m, z1: kz - hz * m, x2: kx + hx * m, z2: kz + hz * m });
          // atras de algunos grupos, el auto en el que vinieron
          if (n >= 4 && rf() < 0.55) {
            const fondoA = 6 + rf() * 2.5, a = (rf() - 0.5) * ancho * 0.6, x = cx + hx * a - hz * lado * fondoA, z = cz + hz * a + hx * lado * fondoA;
            if (libre(x, z, 3.6)) { F.autos.push({ tipo: 'publico', n: Math.floor(rf() * 9), x, z, rumbo: rumboDe(ii) + (rf() < 0.5 ? 0 : Math.PI) + (rf() - 0.5) * 0.9 }); F.claros.push({ x, z, r: 4 }); }
          }
        }
      }
      i += 11 + 0.14 * Math.abs(i - centro) + rf() * 7;
    }
  }
  // los equipos: una carpa, atras un camion de asistencia y al costado un auto de rally
  for (let k = 0, probados = 0; k < carpas && probados < carpas * 4; probados++) {
    const ii = Math.round(Math.max(1, Math.min(P.n - 2, desde + 18 + (k + probados * 0.37) * ((hasta - desde - 30) / Math.max(1, carpas)) + ent(-5, 5)))), lado = (k + probados) % 2 ? 1 : -1, rumbo = rumboDe(ii), d = P.W[ii] / 2 + 12.5 + ent(0, 2.5);
    const [x, z] = lugar(ii, lado * d);
    if (!libre(x, z, 5.2) || !plano(x, z, ii) || F.claros.some((q) => Math.hypot(q.x - x, q.z - z) < q.r + 5)) continue;
    F.carpas.push({ x, z, rumbo, color: COLORES_CARPA[k % COLORES_CARPA.length], hx: 2.2, hz: 2.2 }); F.claros.push({ x, z, r: 5 });
    const [x2, z2] = lugar(ii, lado * (d + 8.5));
    if (libre(x2, z2, 5)) { F.autos.push({ tipo: 'equipo', n: 2, x: x2, z: z2, rumbo: rumbo + ent(-0.4, 0.4) + (rf() < 0.5 ? 0 : Math.PI) }); F.claros.push({ x: x2, z: z2, r: 5.5 }); }
    const ij = Math.max(1, Math.min(P.n - 2, ii + (rf() < 0.5 ? -1 : 1) * Math.round(ent(8, 11))));
    const [x3, z3] = lugar(ij, lado * (d + 0.5));
    if (libre(x3, z3, 3.4)) F.autos.push({ tipo: 'equipo', n: [0, 1, 3, 4, 5][Math.floor(rf() * 5)], x: x3, z: z3, rumbo: rumboDe(ij) + ent(-0.5, 0.5) });
    k++;
  }
  F.autos = F.autos.filter((q) => q.tipo !== 'equipo' || q.n !== undefined);
  return F;
}

export function crearFestival(escena, liviano) {
  const partes = [];
  let conEfectos = true;
  // clima y luz: los de world.js (para que de noche la gente prenda fogones y las carpas tengan lampara)
  function poner(T, clima, luz) {
    for (const p of partes) p.quitar();
    partes.length = 0;
    const P = T.camino, rf = azar(((T.etapa.semilla || 1) ^ 0x51f7a3) >>> 0);
    // sitios que no estan ocupados: sin arboles, piedras, casas ni otra cosa que se choque, y sin agua
    const libre = (x, z, radio) => {
      for (const dx of [-8, 0, 8]) for (const dz of [-8, 0, 8]) {
        const l = T.cosasCerca(x + dx, z + dz);
        if (l) for (const o of l) if (o.clase !== 'poste' && Math.hypot(o.x - x, o.z - z) < radio + (o.hx ? Math.hypot(o.hx, o.hz) : o.r || 0.5)) return false;
      }
      if (T.aguas.length && T.suelo(x, z, {}).agua > 0) return false;
      if (T.claros.some((q) => Math.hypot(q.x - x, q.z - z) < q.r + radio * 0.4)) return false;
      return !T.pelado || T.pelado[Math.round(z - T.z0) * T.nx + Math.round(x - T.x0)] === 0;
    };
    const zonas = [];
    if (T.vuelta) zonas.push([T.salida.i - 40, T.salida.i + 240, T.salida.i, 5]);
    else zonas.push([Math.max(2, T.largada.i - 6), Math.min(P.n - 2, T.salida.i + 220), T.salida.i, 5], [Math.max(2, T.meta.i - 190), Math.min(P.n - 2, T.meta.i + 14), T.meta.i, 3]);
    for (const [d, h, c, carpas] of zonas) {
      const F = datosDeFiesta(T, d, h, c, carpas, rf, libre), f = crearFiestaDeTravesia(escena, liviano);
      f.efectos(conEfectos);
      f.poner({ ...T, semilla: (T.etapa.semilla || 1) + c, fiesta: F }, { clima, luz });
      partes.push(f);
    }
  }
  return {
    poner,
    efectos: (si) => { conEfectos = !!si; for (const p of partes) p.efectos(si); },
    animar: (c, indice, dt, t) => { for (const p of partes) p.animar(c, indice, dt, t); },
    contar: () => partes.map((p) => p.contar()),
  };
}

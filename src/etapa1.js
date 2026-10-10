// Etapa 1. El camino se arma como una lista de tramos, uno atras del otro.
//
// Cada tramo:
//   largo      metros
//   giro       grados que dobla en total (positivo = a la derecha)
//   pendiente  grados (positivo = sube)
//   ancho      metros de lado a lado
//   suelo      asfalto, ripio, tierra, roca, pasto, barro, pantano, lecho
//   peralte    grados de inclinacion de costado (positivo = lado derecho mas alto)
//   izq / der  ladera a cada lado: [metros que sube o baja, a que distancia]
//   hombro     metros de banquina antes de la ladera
//   rugoso     alto de los pozos del tramo, en metros (si no, usa el del suelo)
//   escalones  [cada cuantos metros, alto del escalon]
//   pozos      lista de [metros desde el inicio del tramo, metros hacia la derecha, radio, hondo, suelo]
//   agua       un rio cruza el tramo: { hondo, largo }
//   derrumbe   la tierra se corre hacia la derecha: [desde que metro, hasta que metro, velocidad en m/s]
//   autos      autos tirados: lista de [metros desde el inicio, metros hacia la derecha, giro en grados, estado]
//              estado 0 = abandonado, 1 = volcado, 2 = hundido en el barro
//   bidones    nafta para juntar: lista de [metros desde el inicio, metros hacia la derecha]
//   control    true = checkpoint al final del tramo
//   envion     true = tramo para tomar carrera (solo lo usan los pilotos de prueba de tools/)
//   nombre     cartel que aparece al entrar

export const ETAPA = {
  nombre: 'Etapa 1',
  lugar: 'Yungas',
  version: 2,   // subir este numero cuando cambie el camino: las marcas y fantasmas viejos dejan de valer
  semilla: 7,
  rumbo: 0,
  tramos: [
    { nombre: 'Se termina la ruta', largo: 70, suelo: 'asfalto', ancho: 9,
      pozos: [[24, 1.6, 1.7, 0.28, 'barro'], [33, -1.8, 1.9, 0.3, 'barro'], [41, 0.6, 1.6, 0.25, 'barro'],
        [50, 2.8, 2.5, 0.8, 'tierra'], [54, 3.1, 2.5, 0.9, 'tierra'], [58, 2.9, 2.4, 0.8, 'tierra'], [64, -2.2, 1.8, 0.3, 'barro']],
      autos: [[45, -2.7, 14, 0]] },
    { largo: 55, giro: -40, pendiente: -3, suelo: 'ripio', ancho: 8.4 },
    { largo: 55, giro: 65, pendiente: -4, suelo: 'ripio', ancho: 8 },
    { nombre: 'El bañado', largo: 45, giro: 10, suelo: 'barro', ancho: 12, bidones: [[30, 4.3]] },
    { largo: 52, giro: -45, suelo: 'barro', ancho: 14,
      pozos: [[9, -2.6, 4.6, 0.3, 'pantano'], [25, 2.6, 4.8, 0.3, 'pantano'], [41, -2.8, 4.6, 0.3, 'pantano']],
      autos: [[25, 3.6, 25, 2]], bidones: [[41, -3]] },
    { nombre: 'El vado', largo: 16, pendiente: -6, suelo: 'ripio', ancho: 9, envion: true },
    { largo: 22, suelo: 'lecho', ancho: 10, agua: { hondo: 0.5, largo: 700 }, autos: [[11, 2.7, -25, 0]], envion: true },
    { largo: 15, pendiente: 14, suelo: 'barro', ancho: 9, control: true, envion: true },
    { nombre: 'La subida', largo: 60, giro: 55, pendiente: 12, suelo: 'ripio', ancho: 8 },
    { largo: 36, pendiente: 17, suelo: 'roca', ancho: 8, escalones: [6, 0.5] },
    { nombre: 'El lateral', largo: 75, giro: -75, pendiente: 2, suelo: 'tierra', ancho: 8.4, peralte: -13,
      der: [-14, 20], izq: [10, 20], control: true, derrumbe: [28, 52, 1.2],
      pozos: [[17, -2.2, 3.2, 0.1, 'barro'], [61, -2.4, 3.2, 0.1, 'barro']] },
    { nombre: 'Los caracoles', largo: 40, pendiente: 13, suelo: 'ripio', ancho: 8 },
    { largo: 27, giro: 180, pendiente: 6, suelo: 'tierra', ancho: 10, autos: [[23, -3.3, 40, 1]] },
    { largo: 46, pendiente: 14, suelo: 'ripio', ancho: 8, bidones: [[24, 3.1]] },
    { largo: 27, giro: -180, pendiente: 6, suelo: 'tierra', ancho: 10 },
    { largo: 36, pendiente: 12, suelo: 'ripio', ancho: 8, control: true },
    { nombre: 'La cornisa', largo: 45, giro: 25, pendiente: 3, suelo: 'ripio', ancho: 6, izq: [16, 9], der: [-34, 8], hombro: 1.5,
      autos: [[26, -1.95, 8, 0], [20, 13, 200, 1]] },
    { largo: 26, giro: 15, pendiente: 2, suelo: 'ripio', rugoso: 0.22, ancho: 5.4, peralte: -5, izq: [18, 8], der: [-36, 7], hombro: 1.2,
      pozos: [[7, 3.4, 1.7, 1.6, 'roca'], [18, 3.5, 1.8, 1.8, 'roca']] },
    { largo: 45, giro: 25, pendiente: 4, suelo: 'ripio', ancho: 5.8, izq: [16, 9], der: [-34, 8], hombro: 1.5, control: true,
      autos: [[25, 15, 95, 2]] },
    { nombre: 'La bajada', largo: 18, pendiente: 2, suelo: 'ripio', ancho: 8 },
    { largo: 44, giro: -35, pendiente: -17, suelo: 'ripio', ancho: 9, der: [-12, 14], izq: [8, 14], autos: [[30, -2, 70, 2]],
      pozos: [[30, -1.5, 4.2, 0.15, 'barro']] },
    { largo: 30, giro: 20, pendiente: -2, suelo: 'ripio', ancho: 9, envion: true },
    { nombre: 'La trepada', largo: 14, pendiente: 19, suelo: 'barro', ancho: 9, autos: [[3, -2.9, -15, 0]], envion: true },
    { largo: 34, pendiente: 24, suelo: 'tierra', ancho: 8.4, escalones: [7, 0.35] },
    { nombre: 'La cumbre', largo: 42, suelo: 'ripio', ancho: 14 },
  ],
};

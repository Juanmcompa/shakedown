// Los sponsors: las marcas que aparecen en las banderas, el vallado, los cartelones y los arcos de las pistas.
// Son de mentira: chistes sobre marcas conocidas de aca. Para sumar, sacar o cambiar uno alcanza con tocar esta lista:
// carteleria.js los reparte solo por todos los soportes de todas las pistas (no cambia las pistas: es solo dibujo).
// (El archivo no se llama "sponsors" a proposito: los bloqueadores de publicidad frenan los archivos con nombres de
// anuncios, y un solo archivo frenado alcanza para que el juego no cargue. Ver la nota al principio de carteleria.js.)
//
// Cada sponsor lleva:
//   id       un nombre corto, sin espacios          nombre   como se llama
//   fondo    el color del cartel                    tinta    el color de las letras
//   detalle  un tercer color (opcional)             peso     cuanto aparece respecto de los demas (2 = el doble)
// y hasta tres dibujos hechos de a pixeles, uno por soporte. Cada renglon es una fila del dibujo:
//   '.' = el fondo     '#' = la tinta     '+' = el detalle
//   cartel: el logo entero, para los cartelones (hasta 48 pixeles de ancho por 12 de alto)
//   chapa:  la version corta, para el vallado y los arcos (hasta 19 por 5)
//   vela:   para las banderas, de arriba hacia abajo (5 de ancho, hasta 21 de alto)
// Un pixel de estos dibujos mide 12,5 cm en el mundo. Al soporte que le falte el dibujo se le escribe el nombre
// ("corto", si lo tiene, o el nombre) con las letras de pixeles del juego.
//
// En vez de escribir los renglones se puede dibujar un PNG chiquito (con el fondo transparente o ya pintado) y nombrarlo en
//   imagen: { cartel: 'parodias/algo-cartel.png', chapa: 'parodias/algo-chapa.png', vela: 'parodias/algo-vela.png' }
// (el camino va desde donde esta index.html). Tamaños: cartel 52 x 16, chapa 21 x 7, vela 7 x 25. Si es mas grande, se achica.
export const SPONSORS = [
  {
    id: 'fpy', nombre: 'FPY', fondo: '#1c5aa6', tinta: '#ffffff', detalle: '#8fb6e0', peso: 1.2,
    cartel: [
      '#########..#######....###....###',
      '#########..#########..###....###',
      '###........###...###...###..###.',
      '#######....###...###....######..',
      '#######....#########.....####...',
      '###........#######.......####...',
      '###........###...........####...',
      '###........###...........####...',
    ],
    chapa: [
      '#####.####..##.##',
      '##....##.##.##.##',
      '####..####...###.',
      '##....##......#..',
      '##....##......#..',
    ],
    vela: [
      '#####', '##...', '####.', '##...', '##...',
      '.....', '.....',
      '####.', '##.##', '####.', '##...', '##...',
      '.....', '.....',
      '##.##', '##.##', '.###.', '..#..', '..#..',
    ],
  },
  {
    id: 'cac', nombre: 'CAC', fondo: '#f0c21a', tinta: '#d9303a', detalle: '#f7dc74', peso: 1.2,
    cartel: [
      '..#####......###......#####..',
      '.#######....#####....#######.',
      '###...###...#####...###...###',
      '###........###.###..###......',
      '###........###.###..###......',
      '###.......###...###.###......',
      '###...###.###...###.###...###',
      '.#######.#######.###.#######.',
      '..#####..#######.###..#####..',
    ],
    chapa: [
      '.####...#....####',
      '##.....###..##...',
      '##....##.##.##...',
      '##....#####.##...',
      '.####.##.##..####',
    ],
    vela: [
      '.####', '##...', '##...', '##...', '.####',
      '.....', '.....',
      '..#..', '.###.', '##.##', '#####', '##.##',
      '.....', '.....',
      '.####', '##...', '##...', '##...', '.####',
    ],
  },
  {
    id: 'ladri', nombre: 'Mercado Ladri', corto: 'LADRI', fondo: '#ffe21f', tinta: '#2b3277', detalle: '#ffffff', peso: 1,
    cartel: [
      '....#######......#...#.###.##...##..#..##...#.',
      '..##+++++++##....##.##.#...#.#.#...#.#.#.#.#.#',
      '.#+++++++++++#...#.#.#.##..##..#...###.#.#.#.#',
      '#+++++++++++++#..#...#.#...#.#.#...#.#.#.#.#.#',
      '#+###########+#..#...#.###.#.#..##.#.#.##...#.',
      '#+##++###++##+#...............................',
      '#+###########+#..##.....###..####..####..##...',
      '#+++++++++++++#..##....##.##.##.##.##.##.##...',
      '.#+++++++++++#...##....#####.##.##.####..##...',
      '..##+++++++##....##....##.##.##.##.##.##.##...',
      '....#######......#####.##.##.####..##.##.##...',
    ],
    chapa: [
      '#....#..##..##..###',
      '#...#.#.#.#.#.#..#.',
      '#...###.#.#.##...#.',
      '#...#.#.#.#.#.#..#.',
      '###.#.#.##..#.#.###',
    ],
    vela: [
      '.###.', '#+++#', '#####', '#+#+#', '#####', '#+++#', '.###.',
      '.....', '.....',
      '#...#', '##.##', '#.#.#', '#...#', '#...#',
      '.....', '.....',
      '##...', '##...', '##...', '##...', '#####',
    ],
  },
];

// Pinta uno de los dibujos de un sponsor, centrado en la zona (o en el pedazo de la zona que se pida).
//   p: el pincel (ver pixel.js).   cual: 'cartel', 'chapa' o 'vela'.
//   o: { x, y, w, h } = el pedazo donde va (si no, toda la zona);  marco: true = con un filete de la tinta alrededor;
//      sinFondo: true = no pinta el fondo (ya esta pintado).
// Devuelve false si el sponsor no tiene ese dibujo (y entonces solo deja pintado el fondo).
export function pintarSponsor(p, s, cual, o = {}) {
  const x = o.x || 0, y = o.y || 0, w = o.w || p.w - x, h = o.h || p.h - y, filas = s[cual];
  if (!o.sinFondo) p.rect(x, y, w, h, s.fondo);
  if (o.marco) { p.rect(x, y, w, 1, s.tinta); p.rect(x, y + h - 1, w, 1, s.tinta); p.rect(x, y, 1, h, s.tinta); p.rect(x + w - 1, y, 1, h, s.tinta); }
  if (!filas) return false;
  const ancho = Math.max(...filas.map((f) => f.length)), x0 = x + Math.round((w - ancho) / 2), y0 = y + Math.round((h - filas.length) / 2);
  filas.forEach((fila, j) => { for (let i = 0; i < fila.length; i++) if (fila[i] !== '.') p.punto(x0 + i, y0 + j, fila[i] === '+' ? s.detalle || s.tinta : s.tinta); });
  return true;
}

// Reparte los sponsors: cada vez que se la llama devuelve el que sigue, alternandolos parejo y respetando el peso de cada uno
// (uno de peso 2 sale el doble de veces, bien intercalado). azar: un numero entre 0 y 1, para que no empiece siempre el mismo.
export function repartirSponsors(azar = 0, lista = SPONSORS) {
  const peso = lista.map((s) => (s.peso > 0 ? s.peso : 1)), total = peso.reduce((a, b) => a + b, 0);
  // (el que arranca se sortea; despues, siempre le toca al que mas viene debiendo)
  const debe = lista.map((s, k) => -total * (((k + Math.floor(azar * lista.length)) % lista.length) / lista.length));
  return () => {
    let cual = 0;
    for (let k = 0; k < lista.length; k++) { debe[k] += peso[k]; if (debe[k] > debe[cual]) cual = k; }
    debe[cual] -= total;
    return lista[cual];
  };
}

// ENCAJADOS - numeros para ajustar el juego.
// Todo lo que cambia "como se siente" manejar esta en este archivo.

// Suelos. agarre: cuanto se prende la cubierta (1 = firme y seco).
// freno: resistencia a rodar. pasta: frena mas cuanto mas rapido vas (barro, agua).
// rugoso: [alto de los pozos en metros, distancia entre pozos]. blando: cuanto marca huella.
export const SUELOS = {
  asfalto: { id: 0, nombre: 'Asfalto', agarre: 0.95, freno: 0.015, pasta: 0,   rugoso: [0.0, 3],    blando: 0,   color: 0x55565c },
  ripio:   { id: 1, nombre: 'Ripio',   agarre: 0.72, freno: 0.035, pasta: 0,   rugoso: [0.05, 3],   blando: 0.3, color: 0xc2ab84 },
  tierra:  { id: 2, nombre: 'Tierra',  agarre: 0.76, freno: 0.045, pasta: 0,   rugoso: [0.08, 4],   blando: 0.5, color: 0xa4572f },
  roca:    { id: 3, nombre: 'Roca',    agarre: 1.0,  freno: 0.03,  pasta: 0,   rugoso: [0.26, 2.7], blando: 0,   color: 0x8f8b85 },
  pasto:   { id: 4, nombre: 'Pasto',   agarre: 0.52, freno: 0.09,  pasta: 12,  rugoso: [0.12, 3.5], blando: 0.6, color: 0x5f8f3c },
  barro:   { id: 5, nombre: 'Barro',   agarre: 0.40, freno: 0.14,  pasta: 95,  rugoso: [0.09, 5],   blando: 1,   color: 0x7d3a20 },
  pantano: { id: 6, nombre: 'Pantano', agarre: 0.27, freno: 0.33,  pasta: 210, rugoso: [0.05, 4],   blando: 1,   color: 0x4a2414 },
  lecho:   { id: 7, nombre: 'Agua',    agarre: 0.62, freno: 0.06,  pasta: 25,  rugoso: [0.13, 2.6], blando: 0.2, color: 0x8d8a76 },
};
export const SUELO = Object.values(SUELOS); // lista ordenada por id

// La camioneta. Distancias en metros, medidas desde el centro de masa.
export const CAMIONETA = {
  masa: 1650,
  inercia: [2750, 2950, 950],   // cabeceo, giro, rolido
  ejes: 1.38,                   // del centro a cada eje
  trocha: 0.84,                 // del centro a cada rueda
  radio: 0.42,                  // radio de la rueda
  anclaje: 0.06,                // altura donde se agarra la suspension
  resorteLargo: 0.56,           // largo del resorte sin carga
  recorrido: 0.34,              // cuanto se puede comprimir
  resorte: 31000,               // dureza del resorte
  amortigua: [3300, 4800],      // amortiguador: comprimiendo, estirando
  empuje: 0.72,                 // fuerza maxima del motor, en "g"
  potencia: 80000,              // watts: define la velocidad final
  aire: 5.5,                    // freno del aire
  frenos: 0.95,                 // fuerza de frenado, en "g"
  frenoMotor: 0.14,             // cuanto frena al soltar el acelerador
  traseras: 1.3,                // cuanto mas empujan las ruedas de atras (1 = parejo; mas = colea mas)
  reversa: 0.5,                 // fraccion del empuje marcha atras
  aceleraEn: 0.45,              // segundos que tarda el acelerador en llegar a fondo
  giro: 0.62,                   // angulo maximo de las ruedas (radianes)
  giroRapido: 11,               // a esta velocidad (m/s) el giro maximo baja a la mitad
  giroVel: 2.8,                 // rapidez del volante
  lateral: 0.3,                 // rigidez lateral de la cubierta (mas = mas "sobre rieles")
  patinaje: 0.85,               // cuanto agarre lateral se pierde al patinar acelerando (0 a 1)
  alturaLateral: 0.3,           // 0 = vuelca facil, 1 = no vuelca nunca
  chasis: [150000, 9000, 0.5],  // golpes del chasis contra el piso: dureza, amortiguacion, roce
};

// Camaras (tecla C). dist: metros hasta la camioneta. alto: grados sobre el horizonte.
export const CAMARAS = [
  { nombre: 'Aerea', dist: [52, 78], alto: 58, fov: 30, sigue: 1.1, adelante: 0.7 },
  { nombre: 'Aerea fija', dist: [60, 84], alto: 64, fov: 30, sigue: 0, adelante: 0.5 },
  { nombre: 'Cerca', dist: [10, 13], alto: 22, fov: 55, sigue: 0.35, adelante: 0.3 },
];

export const JUEGO = {
  paso: 1 / 120,        // paso de la fisica
  gravedad: 9.81,
  medallas: [115, 150, 200],  // segundos para oro, plata, bronce
};

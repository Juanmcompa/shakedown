// SHAKEDOWN - numeros para ajustar el juego.
// Todo lo que cambia "como se siente" manejar esta en este archivo.

// Suelos. agarre: cuanto se prende la cubierta (1 = firme y seco).
// suelto: cuanto de costado tiene que ir el auto para que la cubierta agarre todo (1 = asfalto: agarra enseguida;
//         2 o mas = piso suelto: el auto "flota", hay que tirarlo antes a la curva y viaja cruzado).
// freno: resistencia a rodar. pasta: frena mas cuanto mas rapido vas (barro, agua).
// rugoso: [alto de los pozos en metros, distancia entre pozos]. blando: cuanto marca huella.
// polvo: cuanto polvo levanta en seco (0 = nada).
export const SUELOS = {
  asfalto: { id: 0, nombre: 'Asfalto', agarre: 0.95, suelto: 1.0, freno: 0.015, pasta: 0,  rugoso: [0.0, 3],    blando: 0,   polvo: 0.05, color: 0x55565c },
  ripio:   { id: 1, nombre: 'Ripio',   agarre: 0.72, suelto: 2.9, freno: 0.035, pasta: 0,  rugoso: [0.04, 3],   blando: 0.3, polvo: 1,    color: 0xc2ab84 },
  tierra:  { id: 2, nombre: 'Tierra',  agarre: 0.76, suelto: 2.7, freno: 0.045, pasta: 0,  rugoso: [0.05, 4],   blando: 0.5, polvo: 0.9,  color: 0xa4572f },
  roca:    { id: 3, nombre: 'Roca',    agarre: 0.86, suelto: 1.5, freno: 0.03,  pasta: 0,  rugoso: [0.09, 2.7], blando: 0,   polvo: 0.25, color: 0x8f8b85 },
  pasto:   { id: 4, nombre: 'Pasto',   agarre: 0.52, suelto: 3.2, freno: 0.09,  pasta: 12, rugoso: [0.12, 3.5], blando: 0.6, polvo: 0.12, color: 0x5f8f3c },
  barro:   { id: 5, nombre: 'Barro',   agarre: 0.46, suelto: 3.3, freno: 0.06,  pasta: 9,  rugoso: [0.06, 5],   blando: 1,   polvo: 0,    color: 0x7d3a20 },
  pantano: { id: 6, nombre: 'Pantano', agarre: 0.36, suelto: 3.4, freno: 0.1,   pasta: 60, rugoso: [0.05, 4],   blando: 1,   polvo: 0,    color: 0x4a2414 },
  lecho:   { id: 7, nombre: 'Agua',    agarre: 0.62, suelto: 2.8, freno: 0.06,  pasta: 25, rugoso: [0.08, 2.6], blando: 0.2, polvo: 0,    color: 0x8d8a76 },
  charco:  { id: 8, nombre: 'Charco',  agarre: 0.5,  suelto: 3.0, freno: 0.06,  pasta: 45, rugoso: [0.03, 4],   blando: 0.9, polvo: 0,    color: 0x7c8f94 },
};
export const SUELO = Object.values(SUELOS); // lista ordenada por id

// Los autos. Distancias en metros.
//   masa, inercia [cabeceo, giro, rolido]
//   ejes: del medio del auto a cada eje.  trocha: del medio a cada rueda.  radio: de la rueda.
//   centro: cuanto mas adelante que el medio esta el centro de masa (el motor pesa).
//   resorteLargo, recorrido, resorte, amortigua [comprimiendo, estirando]: la suspension
//   frenos: fuerza maxima de los frenos en "g".  frenoAdelante: que parte frenan las ruedas de adelante.
//   empuje: fuerza maxima del motor en "g".  potencia: watts (define la velocidad final).  aire: freno del aire.
//   traccion: cuanto empuja cada eje [adelante, atras].  frenoMotor: cuanto frena al soltar, en "g".
//   cubiertas: por cuanto se multiplica el agarre [en suelo firme, en suelo blando].
//   giro: angulo maximo de las ruedas.  giroFino: lo que doblan de mas a alta velocidad (mas = mas nervioso).
//   deriva: cuanto de costado tiene que ir la cubierta para agarrar todo en asfalto (0.11 = unos 6 grados).
//           En piso suelto se multiplica por el "suelto" del suelo: en ripio, unos 18 grados. Mas = mas "flotado".
//   firme: en piso suelto, que parte del agarre responde enseguida, como en asfalto (0.5 = la mitad). El resto llega
//          recien cuando el auto va bien cruzado. Mas = mas facil de llevar despacio; menos = derrapa siempre.
//   colaFirme: cuanto mas agarran de costado las ruedas de atras (mas de 1 = el auto tiende a seguir derecho; menos de 1 = colea).
//   alinea: cuando el auto viene de costado, cuanto se acomodan solas las ruedas de adelante hacia donde va
//           (0 = nada: hay que contravolantear todo a mano; 1 = del todo: el auto se endereza casi solo).
//   estable: resistencia a girar sobre si mismo (0 = nada).  lateral: rigidez de la cubierta casi parado.
//   patinaje: cuanto agarre de costado se pierde acelerando.
//   alturaLateral: 0 = vuelca facil, 1 = no vuelca nunca.
//   caja: [medio ancho, medio largo, panza, techo] para los golpes del chasis contra el piso.
//   choque: [radio, separacion] de los tres circulos con los que choca contra arboles y piedras.
const COMUN = {
  frenos: 0.95, frenoAdelante: 0.7, reversa: 0.5, aceleraEn: 0.3, giroVel: 3.2, patinaje: 0.7,
  deriva: 0.11, firme: 0.5, colaFirme: 1.03, alinea: 0.6, giroFino: 0.26, estable: 0.3,
  chasis: [150000, 9000, 0.5],  // golpes del chasis contra el piso: dureza, amortiguacion, roce
};
export const AUTOS = {
  vitarita: Object.assign({}, COMUN, {
    nombre: 'La Vitarita', detalle: '4x4 del 92, corta y levantada', emoji: '🚙', modelo: 'vitarita',
    masa: 1080, inercia: [1420, 1420, 490], ejes: 1.1, trocha: 0.72, radio: 0.37, anclaje: 0.05, centro: 0.05,
    resorteLargo: 0.5, recorrido: 0.3, resorte: 21000, amortigua: [2400, 3500],
    empuje: 0.6, potencia: 66000, aire: 3.4, traccion: [0.5, 0.5], frenoMotor: 0.12, cubiertas: [0.97, 1.06],
    giro: 0.58, lateral: 0.3, alturaLateral: 0.42,
    caja: [0.8, 1.8, -0.4, 1.0], choque: [0.85, 1.05],
  }),
  kacito: Object.assign({}, COMUN, {
    nombre: 'El Kacito', detalle: 'chiquito, tracción delantera y chapón', emoji: '🚗', modelo: 'kacito',
    masa: 900, inercia: [1200, 1230, 390], ejes: 1.22, trocha: 0.7, radio: 0.29, anclaje: 0.05, centro: 0.2,
    resorteLargo: 0.4, recorrido: 0.22, resorte: 20500, amortigua: [2150, 3150],
    empuje: 0.64, potencia: 64000, aire: 2.1, traccion: [1, 0], frenoMotor: 0.1, cubiertas: [1.08, 1],
    giro: 0.6, lateral: 0.34, alturaLateral: 0.68,
    caja: [0.8, 1.8, -0.3, 0.85], choque: [0.85, 1.05],
  }),
};
// con que auto se calcula el tiempo de referencia de cada pista (el mismo para todos)
export const REFERENCIA = 'vitarita';

// Camaras (tecla C, o el boton de la camara). Lo que va entre corchetes cambia con la velocidad: [despacio, rapido].
// dist: metros hasta el auto.  alto: grados sobre el horizonte (90 = justo desde arriba).
// mira: metros que mira por delante del auto.  sigue: segundos que tarda en ponerse atras del auto.
// La de arriba no es del todo vertical: asi el publico y las plantas (que son dibujos planos) se ven de cuerpo entero.
export const CAMARAS = [
  { id: 'aerea',  nombre: 'Aérea',        dist: [46, 74], alto: [60, 47], fov: 30, sigue: 0.8, mira: [3, 20] },
  { id: 'atras',  nombre: 'De atrás',     dist: [9, 14],  alto: [20, 16], fov: 58, sigue: 0.3, mira: [2, 6] },
  { id: 'arriba', nombre: 'Desde arriba', dist: [74, 104], alto: [78, 76], fov: 30, sigue: 1.0, mira: [5, 21] },
];

export const JUEGO = {
  paso: 1 / 120,        // paso de la fisica
  gravedad: 9.81,
  cuenta: 3,            // segundos de cuenta regresiva antes de largar
  penalizacion: 8,      // segundos que suma volver al camino (por salirse, volcar o pedirlo)
  afuera: 26,           // a tantos metros del borde del camino, el auto vuelve solo (con la penalizacion)
  maximo: 480,          // segundos: pasado este tiempo, la pasada se da por abandonada
  // Daño: los golpes a mas de "desde" m/s suman "porMetro" puntos por cada m/s de mas. A los 100 se rompe el auto.
  golpes: { desde: 5, porMetro: 3.3 },
  // Cuadraditos: el sector es verde si tarda hasta "verde" veces la referencia, amarillo hasta "amarillo", y si no rojo.
  // Si hubo que volver al camino en el sector, es rojo.
  sectores: { verde: 1.3, amarillo: 1.6 },
};

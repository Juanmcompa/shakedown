// Los edificios y las cosas de pueblo: sus medidas. Las usa terrain.js para saber contra que se choca
// y pueblo.js para dibujarlos. Todo en metros (de a 25 cm, que es lo que mide un pixel del mundo).
//
// Edificios: ancho (el frente, a lo largo de la calle), fondo y alto de las paredes. Se chocan como una caja.
export const EDIFICIOS = {
  casa:     { ancho: 8,   fondo: 7,  alto: 3 },      // con techo a dos aguas
  casita:   { ancho: 6,   fondo: 6,  alto: 2.75 },   // de azotea
  rancho:   { ancho: 7,   fondo: 5,  alto: 2.5 },    // de adobe, con alero
  almacen:  { ancho: 10,  fondo: 8,  alto: 3.5 },    // de ramos generales, con el frente mas alto y cartel
  galpon:   { ancho: 12,  fondo: 9,  alto: 4.5 },    // de chapa, con porton
  capilla:  { ancho: 7,   fondo: 11, alto: 4.5 },    // blanca, con torre
  edificio: { ancho: 9,   fondo: 8,  alto: 6 },      // de dos pisos, con local abajo
  tanque:   { ancho: 3.5, fondo: 3.5, alto: 9 },     // el tanque de agua del pueblo
};
// Cosas sueltas. Las redondas llevan "r" (radio); las cuadradas, "hx" y "hz" (medio ancho y medio largo).
// duro: cuanto golpea (1 = como una pared).  cede: si se la choca fuerte queda tirada y ya no molesta.
export const OBJETOS = {
  cono:      { r: 0.22, alto: 0.6, duro: 0.12, cede: true },
  tacho:     { r: 0.32, alto: 0.9, duro: 0.3, cede: true },      // tambor de 200 litros
  cubiertas: { r: 0.55, alto: 0.75, duro: 0.25, cede: true },    // pila de cubiertas
  cajones:   { hx: 0.6, hz: 0.6, alto: 1, duro: 0.3, cede: true },
  valla:     { hx: 1.0, hz: 0.15, alto: 1, duro: 0.3, cede: true },
  banco:     { hx: 0.9, hz: 0.3, alto: 0.75, duro: 0.6, cede: true },
  volquete:  { hx: 1.75, hz: 0.9, alto: 1.4, duro: 1 },
  cantero:   { hx: 1, hz: 1, alto: 0.5, duro: 1 },
  colectivo: { hx: 1.25, hz: 4.5, alto: 3, duro: 1 },
  farol:     { r: 0.14, alto: 5.5, duro: 1 },                   // poste de luz; entre faroles vecinos van los cables
  monumento: { r: 1.5, alto: 4.5, duro: 1 },
};

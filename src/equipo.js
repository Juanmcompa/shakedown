// El equipo del club: los personajes que acompañan al jugador. Los dibujó Juanma; cada retrato está en personajes/.
// De cada uno: cómo se llama y qué hace. (El orden es el de la lámina original.)
// Para sumar uno: agregarlo acá y dejar su retrato en personajes/ con el mismo nombre que su "id".
export const EQUIPO = [
  { id: 'gaby', nombre: 'Gaby', rol: 'instructora' },
  { id: 'pablo', nombre: 'Pablo', rol: 'marketing' },
  { id: 'paloma', nombre: 'Paloma', rol: 'médica' },
  { id: 'sebastian', nombre: 'Sebastián', rol: 'mecánico' },
  { id: 'juanma', nombre: 'Juanma', rol: 'tech' },
  { id: 'gonza', nombre: 'Gonza', rol: 'remolques' },
  { id: 'leo', nombre: 'Leo', rol: 'ingeniero de pista' },
  { id: 'julian', nombre: 'Julián', rol: 'el rival' },
  { id: 'moi', nombre: 'Moi', rol: 'motoquero' },
  { id: 'rober', nombre: 'Rober', rol: 'mecánico fan' },
];
export const deEquipo = (id) => EQUIPO.find((x) => x.id === id) || EQUIPO[0];
// Los retratos tienen todos la misma medida (431 x 458) y el marco en el mismo lugar; lo que se sale del marco
// (una mano, una llave, el pelo) ocupa los márgenes.
export const retrato = (id) => 'personajes/' + id + '.webp';

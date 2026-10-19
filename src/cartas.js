// Las cartas de la Travesia. Cada tantos km el auto se frena y se elige 1 de 3, y las 3 son problemas: se elige el menos malo.
// Las de arreglo (mejoras) no salen en ese sorteo: se guardan para los puestos de asistencia. Salen al azar, y cada corrida trae otras.
//
// Una carta es un objeto chico:
//   { id, nombre, icono, emoji, tipo ('mala' o 'arreglo'), texto, aplicar(estado) }
//     icono: el nombre de un icono de iconos.js (y color, si se quiere otro).   emoji: para lo que se comparte.
//     texto: una linea, lo que hace.   aplicar(estado): cambia el "estado" de la corrida (ver estadoInicial).
//     repetible: se puede juntar mas de una vez (si no, sale una sola vez por corrida).
// Para sumar una carta nueva alcanza con agregarla a CARTAS. Lo que cambia en el auto lo aplica travesia.js leyendo el estado:
// las cartas no tocan la fisica ni las pistas de siempre, solo valen en este modo.

const lim = (v, a, b) => (v < a ? a : v > b ? b : v);
export const MALA = 'mala', ARREGLO = 'arreglo';

// Todo lo que las cartas pueden cambiar. 1 = sin cambios (los numeros se multiplican, asi las cartas se suman solas).
export function estadoInicial() {
  return {
    roto: 0,                  // daño del auto, de 0 a 100 (al llegar a 100 se termina)
    vmax: 1,                  // velocidad maxima
    potencia: 1, empuje: 1,   // lo que acelera
    frenos: 1,                // cuanto frenan
    vuelca: 1,                // cuanto cuesta volcar (menos = vuelca mas facil)
    golpes: 1,                // cuanto daña cualquier golpe
    golpeCosas: 1,            // y cuanto mas daña un choque contra una piedra o un arbol
    retrasoGas: 0,            // segundos que tarda el acelerador en responder
    sesgo: 0,                 // el volante que se tuerce solo (de -1 a 1)
    mano: true,               // si hay freno de mano
    recalienta: false,        // si pierde potencia al ir a fondo mucho rato
    vidrio: -1,               // que parte de la pantalla esta tapada (0 a 3), o -1 si ninguna
    mareado: false,           // si el copiloto se equivoca de lado
    lisos: false,             // neumaticos lisos
    bateria: false,           // si al parar del todo se termina
    mecanico: false,          // si cada golpe fuerte repara algo y rompe otra cosa
    // --- las averias de la segunda tanda (todas se aplican en travesia.js) ---
    aceite: false,            // sin lubricante: a mucha velocidad el motor se daña de a poco
    embrague: false,          // arrancar desde parado tarda el triple
    filtro: false,            // filtro de aire tapado: menos potencia en arena y fesh-fesh
    correa: false,            // a mucha velocidad, a veces se apaga el motor un segundo
    escape: false,            // la pantalla tiembla un poco siempre
    direccion: false,         // sin hidraulica: a alta velocidad dobla la mitad
    hierve: false,            // liquido de frenos hirviendo: la tercera frenada fuerte seguida no frena
    desbalance: false,        // la camara vibra a alta velocidad
    polvoCabina: false,       // desaparece el tablero
    roadbook: false,          // la flecha de la proxima curva es un "?"
    arenaOjos: false,         // los bordes de la pantalla, oscuros
    instrumental: false,      // el velocimetro marca cualquier cosa
    estatica: false,          // el copiloto canta 1,5 s tarde
    panico: false,            // a mucha velocidad el copiloto se calla
    voladas: 0,               // notas voladas: cuantas veces hay que dejar 2 km sin notas (lo consume travesia.js)
    insolacion: false,        // de a ratos la direccion se invierte 2 s
    alucina: false,           // aparecen piedras falsas
    paranoia: false,          // la barra de daño muestra mas de lo que hay
    cartas: [],               // las que se fueron juntando (sus id, en orden)
  };
}

// Las cartas del sorteo son TODAS problemas: cada 2 km hay que elegir el menos malo de tres.
// Las de tipo 'arreglo' (lo que antes eran mejoras y mezclas) quedan fuera del sorteo: van a servir en los puestos de asistencia
// (uno cada 10 km, todavia sin hacer). "lado" dice de que clase eran: 'buena' (solo mejora) o 'mezcla' (mejora con un costo).
export const CARTAS = [
  // --- problemas ---
  { id: 'caja', nombre: 'Caja trabada', icono: 'ajustes', emoji: '⚙️', tipo: MALA, texto: 'Velocidad máxima −25%', aplicar: (e) => { e.vmax *= 0.75; } },
  { id: 'bujias', nombre: 'Bujías empastadas', icono: 'bujia', emoji: '🔌', tipo: MALA, texto: 'El acelerador responde tarde', aplicar: (e) => { e.retrasoGas = 0.5; } },
  { id: 'radiador', nombre: 'Radiador perforado', icono: 'termometro', emoji: '🌡️', tipo: MALA, texto: 'A fondo más de 3 s, pierde potencia', aplicar: (e) => { e.recalienta = true; } },
  { id: 'frenos', nombre: 'Frenos cristalizados', icono: 'freno', emoji: '🛑', tipo: MALA, texto: 'Frenan un 40% menos', aplicar: (e) => { e.frenos *= 0.6; } },
  { id: 'eje', nombre: 'Eje torcido', icono: 'eje', emoji: '↩️', tipo: MALA, texto: 'El auto tira para un lado', aplicar: (e, azar) => { e.sesgo = lim(e.sesgo + (azar() < 0.5 ? -1 : 1) * 0.1, -0.3, 0.3); } },
  { id: 'mano', nombre: 'Freno de mano cortado', icono: 'mano', emoji: '✋', tipo: MALA, texto: 'No hay freno de mano', aplicar: (e) => { e.mano = false; } },
  { id: 'barra', nombre: 'Barra estabilizadora rota', icono: 'chasis', color: '#ff6a52', emoji: '🎢', tipo: MALA, texto: 'Vuelca más fácil', aplicar: (e) => { e.vuelca *= 0.55; } },
  { id: 'chasis', nombre: 'Chasis fisurado', icono: 'chasis', color: '#f2c200', emoji: '🧱', tipo: MALA, texto: 'Los choques pegan el triple', aplicar: (e) => { e.golpeCosas *= 3; } },
  { id: 'vidrio', nombre: 'Vidrio roto', icono: 'vidrio', emoji: '🪟', tipo: MALA, texto: 'Una parte de la pantalla, tapada', aplicar: (e, azar) => { e.vidrio = Math.floor(azar() * 4); } },
  { id: 'copiloto', nombre: 'Copiloto mareado', icono: 'voz', emoji: '🤢', tipo: MALA, texto: '1 de cada 10 notas va al revés', aplicar: (e) => { e.mareado = true; } },
  { id: 'bateria', nombre: 'Batería agotada', icono: 'bateria', emoji: '🔋', tipo: MALA, texto: 'Si el auto se frena del todo, se acabó', aplicar: (e) => { e.bateria = true; } },
  // el motor y la transmision
  { id: 'aceite', nombre: 'Sin lubricante', icono: 'tacho', color: '#f2c200', emoji: '🛢️', tipo: MALA, texto: 'A mucha velocidad, el motor se daña de a poco', aplicar: (e) => { e.aceite = true; } },
  { id: 'embrague', nombre: 'Embrague quemado', icono: 'ajustes', color: '#ff6a52', emoji: '🦶', tipo: MALA, texto: 'Arrancar desde parado tarda el triple', aplicar: (e) => { e.embrague = true; } },
  { id: 'turbo', nombre: 'Turbo dañado', icono: 'motor', color: '#ff6a52', emoji: '🐌', tipo: MALA, texto: 'Acelera mucho más lento', aplicar: (e) => { e.empuje *= 0.72; } },
  { id: 'filtro', nombre: 'Filtro de aire tapado', icono: 'duna', color: '#ff6a52', emoji: '🌫️', tipo: MALA, texto: 'En arena y fesh-fesh, −20% de potencia', aplicar: (e) => { e.filtro = true; } },
  { id: 'correa', nombre: 'Correa floja', icono: 'eje', color: '#f2c200', emoji: '➰', tipo: MALA, texto: 'A mucha velocidad, a veces se apaga el motor 1 s', aplicar: (e) => { e.correa = true; } },
  { id: 'escape', nombre: 'Escape libre', icono: 'sonido', emoji: '📳', tipo: MALA, texto: 'La pantalla tiembla siempre un poco', aplicar: (e) => { e.escape = true; } },
  // ruedas, direccion y frenos
  { id: 'pinchazo', nombre: 'Pinchazo delantero', icono: 'ruedas', color: '#ff6a52', emoji: '🕳️', tipo: MALA, texto: 'Dobla mal para un lado', aplicar: (e, azar) => { e.sesgo = lim(e.sesgo + (azar() < 0.5 ? -1 : 1) * 0.13, -0.3, 0.3); } },
  { id: 'hidraulica', nombre: 'Dirección hidráulica muerta', icono: 'volante', emoji: '🎡', tipo: MALA, texto: 'A alta velocidad dobla la mitad', aplicar: (e) => { e.direccion = true; } },
  { id: 'hierve', nombre: 'Líquido de frenos hirviendo', icono: 'termometro', color: '#ff6a52', emoji: '♨️', tipo: MALA, texto: 'Tras dos frenadas fuertes en 5 s, la tercera no frena', aplicar: (e) => { e.hierve = true; } },
  { id: 'desbalanceada', nombre: 'Rueda desbalanceada', icono: 'ruedas', color: '#f2c200', emoji: '🌀', tipo: MALA, texto: 'A alta velocidad, la cámara vibra', aplicar: (e) => { e.desbalance = true; } },
  // lo que se ve y lo que se oye en la cabina
  { id: 'polvoCabina', nombre: 'Tormenta de polvo en cabina', icono: 'duna', emoji: '🌪️', tipo: MALA, texto: 'Desaparece el tablero', aplicar: (e) => { e.polvoCabina = true; } },
  { id: 'roadbook', nombre: 'Roadbook manchado', icono: 'carta', color: '#f2c200', emoji: '📖', tipo: MALA, texto: 'La flecha de la próxima curva es un «?»', aplicar: (e) => { e.roadbook = true; } },
  { id: 'arenaOjos', nombre: 'Arena en los ojos', icono: 'casco', emoji: '😵', tipo: MALA, texto: 'Los bordes de la pantalla, oscuros', aplicar: (e) => { e.arenaOjos = true; } },
  { id: 'instrumental', nombre: 'Instrumental loco', icono: 'reloj', color: '#ff6a52', emoji: '🎛️', tipo: MALA, texto: 'El velocímetro marca números al azar', aplicar: (e) => { e.instrumental = true; } },
  { id: 'estatica', nombre: 'Intercomunicador con estática', icono: 'voz', color: '#f2c200', emoji: '📻', tipo: MALA, texto: 'El copiloto canta 1,5 s tarde', aplicar: (e) => { e.estatica = true; } },
  { id: 'panico', nombre: 'Pánico en cabina', icono: 'voz', color: '#ff6a52', emoji: '😱', tipo: MALA, texto: 'A mucha velocidad, el copiloto se calla', aplicar: (e) => { e.panico = true; } },
  { id: 'voladas', nombre: 'Notas voladas', icono: 'carta', color: '#ff6a52', emoji: '💨', tipo: MALA, texto: '2 km sin notas', repetible: true, aplicar: (e) => { e.voladas++; } },
  // la cabeza del piloto
  { id: 'insolacion', nombre: 'Golpe de calor', icono: 'termometro', color: '#f2c200', emoji: '🥵', tipo: MALA, texto: 'De a ratos, la dirección se invierte 2 s', aplicar: (e) => { e.insolacion = true; } },
  { id: 'alucinaciones', nombre: 'Alucinaciones', icono: 'piedras', emoji: '👁️', tipo: MALA, texto: 'Aparecen piedras falsas: se van al tocarlas', aplicar: (e) => { e.alucina = true; } },
  { id: 'paranoia', nombre: 'Paranoia', icono: 'dano', color: '#f2c200', emoji: '🫣', tipo: MALA, texto: 'La barra de daño miente: muestra más', aplicar: (e) => { e.paranoia = true; } },
  // --- arreglos: para los puestos de asistencia (cada 10 km). Fuera del sorteo de cada 2 km ---
  { id: 'repuestos', nombre: 'Sobrecarga de repuestos', icono: 'llave', emoji: '🧰', tipo: ARREGLO, lado: 'mezcla', texto: 'Repara 30, pero acelera 15% menos', aplicar: (e) => { e.roto = Math.max(0, e.roto - 30); e.empuje *= 0.85; e.potencia *= 0.85; } },
  { id: 'mecanico', nombre: 'Mecánico loco', icono: 'llave', color: '#f2c200', emoji: '🔧', tipo: ARREGLO, lado: 'mezcla', texto: 'Cada golpe fuerte repara, y rompe otra cosa', aplicar: (e) => { e.mecanico = true; } },
  { id: 'lisos', nombre: 'Neumáticos lisos', icono: 'ruedas', emoji: '🛞', tipo: ARREGLO, lado: 'mezcla', texto: '+20% en tierra dura; en arena y barro, nada', aplicar: (e) => { e.lisos = true; } },
  { id: 'soldadura', nombre: 'Soldadura', icono: 'brillo', emoji: '🔥', tipo: ARREGLO, lado: 'buena', texto: 'Repara 40 de daño', repetible: true, aplicar: (e) => { e.roto = Math.max(0, e.roto - 40); } },
  { id: 'turboNuevo', nombre: 'Turbo nuevo', icono: 'motor', emoji: '🚀', tipo: ARREGLO, lado: 'buena', texto: '+10% de potencia', repetible: true, aplicar: (e) => { e.potencia *= 1.1; e.empuje *= 1.1; } },
  { id: 'frenosNuevos', nombre: 'Frenos de carrera', icono: 'freno', color: '#5cc070', emoji: '🛑', tipo: ARREGLO, lado: 'buena', texto: 'Frenan un 30% más', aplicar: (e) => { e.frenos *= 1.3; } },
  { id: 'paragolpes', nombre: 'Paragolpes de acero', icono: 'chasis', color: '#5cc070', emoji: '🛡️', tipo: ARREGLO, lado: 'buena', texto: 'Los golpes dañan un 35% menos', aplicar: (e) => { e.golpes *= 0.65; } },
];
export const PROBLEMAS = CARTAS.filter((c) => c.tipo === MALA);
export const ARREGLOS = CARTAS.filter((c) => c.tipo === ARREGLO);   // la lista para los puestos de asistencia

// Lo que una carta le hace al estado, y se la anota entre las juntadas.
export function aplicar(estado, carta, azar = Math.random) {
  carta.aplicar(estado, azar);
  estado.cartas.push(carta.id);
}
const porId = (id) => CARTAS.find((c) => c.id === id);
export const cartaDe = porId;

// Elige "cuantas" cartas distintas al azar, solo entre los problemas. No salen los que ya se juntaron (salvo los repetibles);
// si se acabaron los que faltan, se vuelve a sortear entre todos (un problema repetido no suma nada, salvo en los repetibles).
export function sortear(estado, cuantas = 3, azar = Math.random, lista = PROBLEMAS) {
  let pozo = lista.filter((c) => c.tipo === MALA && (c.repetible || !estado.cartas.includes(c.id)));
  if (pozo.length < cuantas) pozo = pozo.concat(lista.filter((c) => c.tipo === MALA && !pozo.includes(c)));
  const elegidas = [];
  while (elegidas.length < cuantas && pozo.length) elegidas.push(pozo.splice(Math.floor(azar() * pozo.length), 1)[0]);
  return elegidas;
}

// El mecanico loco: un golpe fuerte repara un poco, y a veces rompe otra cosa del auto (una averia al azar que todavia no se tenga).
// Devuelve lo que paso, para avisarlo ('' si nada).
export function mecanicoLoco(estado, fuerza, azar = Math.random) {
  if (!estado.mecanico || fuerza < 8) return '';
  estado.roto = Math.max(0, estado.roto - 7);
  const averias = PROBLEMAS.filter((c) => !c.repetible && !estado.cartas.includes(c.id));
  if (!averias.length || azar() > 0.5) return 'Mecánico loco: arregló algo';
  const rota = averias[Math.floor(azar() * averias.length)];
  aplicar(estado, rota, azar);
  return 'Mecánico loco: arregló algo y rompió ' + rota.nombre.toLowerCase();
}

// Las cartas de la Travesia. Cada tantos km el auto se frena y se elige 1 de 3. Algunas son averias (malas), otras mejoras
// (buenas) y otras, algo bueno con un costo (mezcla). NO son justas: salen al azar, y cada corrida trae otras.
//
// Una carta es un objeto chico:
//   { id, nombre, icono, emoji, tipo, texto, aplicar(estado) }
//     icono: el nombre de un icono de iconos.js (y color, si se quiere otro).   emoji: para lo que se comparte.
//     texto: una linea, lo que hace.   aplicar(estado): cambia el "estado" de la corrida (ver estadoInicial).
//     repetible: se puede juntar mas de una vez (si no, sale una sola vez por corrida).
// Para sumar una carta nueva alcanza con agregarla a CARTAS. Lo que cambia en el auto lo aplica travesia.js leyendo el estado:
// las cartas no tocan la fisica ni las pistas de siempre, solo valen en este modo.

export const MALA = 'mala', BUENA = 'buena', MEZCLA = 'mezcla';

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
    cartas: [],               // las que se fueron juntando (sus id, en orden)
  };
}

export const CARTAS = [
  // --- averias ---
  { id: 'caja', nombre: 'Caja trabada', icono: 'ajustes', emoji: '⚙️', tipo: MALA, texto: 'Velocidad máxima −25%', aplicar: (e) => { e.vmax *= 0.75; } },
  { id: 'bujias', nombre: 'Bujías empastadas', icono: 'bujia', emoji: '🔌', tipo: MALA, texto: 'El acelerador responde tarde', aplicar: (e) => { e.retrasoGas = 0.5; } },
  { id: 'radiador', nombre: 'Radiador perforado', icono: 'termometro', emoji: '🌡️', tipo: MALA, texto: 'A fondo más de 3 s, pierde potencia', aplicar: (e) => { e.recalienta = true; } },
  { id: 'frenos', nombre: 'Frenos cristalizados', icono: 'freno', emoji: '🛑', tipo: MALA, texto: 'Frenan un 40% menos', aplicar: (e) => { e.frenos *= 0.6; } },
  { id: 'eje', nombre: 'Eje torcido', icono: 'eje', emoji: '↩️', tipo: MALA, texto: 'El auto tira para un lado', aplicar: (e, azar) => { e.sesgo = (azar() < 0.5 ? -1 : 1) * 0.1; } },
  { id: 'mano', nombre: 'Freno de mano cortado', icono: 'mano', emoji: '✋', tipo: MALA, texto: 'No hay freno de mano', aplicar: (e) => { e.mano = false; } },
  { id: 'barra', nombre: 'Barra estabilizadora rota', icono: 'chasis', color: '#ff6a52', emoji: '🎢', tipo: MALA, texto: 'Vuelca más fácil', aplicar: (e) => { e.vuelca *= 0.55; } },
  { id: 'chasis', nombre: 'Chasis fisurado', icono: 'chasis', color: '#f2c200', emoji: '🧱', tipo: MALA, texto: 'Los choques pegan el triple', aplicar: (e) => { e.golpeCosas *= 3; } },
  { id: 'vidrio', nombre: 'Vidrio roto', icono: 'vidrio', emoji: '🪟', tipo: MALA, texto: 'Una parte de la pantalla, tapada', aplicar: (e, azar) => { e.vidrio = Math.floor(azar() * 4); } },
  { id: 'copiloto', nombre: 'Copiloto mareado', icono: 'voz', emoji: '🤢', tipo: MALA, texto: '1 de cada 10 notas va al revés', aplicar: (e) => { e.mareado = true; } },
  { id: 'bateria', nombre: 'Batería agotada', icono: 'bateria', emoji: '🔋', tipo: MALA, texto: 'Si el auto se frena del todo, se acabó', aplicar: (e) => { e.bateria = true; } },
  // --- algo bueno con un costo ---
  { id: 'repuestos', nombre: 'Sobrecarga de repuestos', icono: 'llave', emoji: '🧰', tipo: MEZCLA, texto: 'Repara 30, pero acelera 15% menos', aplicar: (e) => { e.roto = Math.max(0, e.roto - 30); e.empuje *= 0.85; e.potencia *= 0.85; } },
  { id: 'mecanico', nombre: 'Mecánico loco', icono: 'llave', color: '#f2c200', emoji: '🔧', tipo: MEZCLA, texto: 'Cada golpe fuerte repara, y rompe otra cosa', aplicar: (e) => { e.mecanico = true; } },
  { id: 'lisos', nombre: 'Neumáticos lisos', icono: 'ruedas', emoji: '🛞', tipo: MEZCLA, texto: '+20% en tierra dura; en arena y barro, nada', aplicar: (e) => { e.lisos = true; } },
  // --- mejoras ---
  { id: 'soldadura', nombre: 'Soldadura', icono: 'brillo', emoji: '🔥', tipo: BUENA, texto: 'Repara 40 de daño', repetible: true, aplicar: (e) => { e.roto = Math.max(0, e.roto - 40); } },
  { id: 'turbo', nombre: 'Turbo nuevo', icono: 'motor', emoji: '🚀', tipo: BUENA, texto: '+10% de potencia', repetible: true, aplicar: (e) => { e.potencia *= 1.1; e.empuje *= 1.1; } },
  { id: 'frenosNuevos', nombre: 'Frenos de carrera', icono: 'freno', color: '#5cc070', emoji: '🛑', tipo: BUENA, texto: 'Frenan un 30% más', aplicar: (e) => { e.frenos *= 1.3; } },
  { id: 'paragolpes', nombre: 'Paragolpes de acero', icono: 'chasis', color: '#5cc070', emoji: '🛡️', tipo: BUENA, texto: 'Los golpes dañan un 35% menos', aplicar: (e) => { e.golpes *= 0.65; } },
];

// Lo que una carta le hace al estado, y se la anota entre las juntadas.
export function aplicar(estado, carta, azar = Math.random) {
  carta.aplicar(estado, azar);
  estado.cartas.push(carta.id);
}
const porId = (id) => CARTAS.find((c) => c.id === id);
export const cartaDe = porId;

// Elige "cuantas" cartas distintas al azar. No salen las que ya se juntaron (salvo las repetibles). Las buenas pesan un poco mas,
// asi casi siempre hay algo para elegir, pero nada garantiza que no salgan las tres malas.
export function sortear(estado, cuantas = 3, azar = Math.random, lista = CARTAS) {
  const pozo = lista.filter((c) => c.repetible || !estado.cartas.includes(c.id));
  const elegidas = [];
  while (elegidas.length < cuantas && pozo.length) {
    const pesos = pozo.map((c) => (c.tipo === BUENA ? 1.5 : 1));
    let t = azar() * pesos.reduce((s, p) => s + p, 0), k = 0;
    for (; k < pozo.length - 1; k++) { t -= pesos[k]; if (t <= 0) break; }
    elegidas.push(pozo.splice(k, 1)[0]);
  }
  return elegidas;
}

// El mecanico loco: un golpe fuerte repara un poco, y a veces rompe otra cosa del auto (una averia al azar que todavia no se tenga).
// Devuelve lo que paso, para avisarlo ('' si nada).
export function mecanicoLoco(estado, fuerza, azar = Math.random) {
  if (!estado.mecanico || fuerza < 8) return '';
  estado.roto = Math.max(0, estado.roto - 7);
  const averias = CARTAS.filter((c) => c.tipo === MALA && !estado.cartas.includes(c.id));
  if (!averias.length || azar() > 0.5) return 'Mecánico loco: arregló algo';
  const rota = averias[Math.floor(azar() * averias.length)];
  aplicar(estado, rota, azar);
  return 'Mecánico loco: arregló algo y rompió ' + rota.nombre.toLowerCase();
}

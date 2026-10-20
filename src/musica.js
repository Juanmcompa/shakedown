// La musica de fondo (musica/rally.mp3), en loop. Va aparte del sonido del juego (audio.js): suena ya en el inicio,
// cuando todavia no hay motor, y tiene su propio boton.
//   iniciar()            arranca. Tiene que llamarse desde un toque o una tecla (los navegadores no dejan sonar antes);
//                        recien ahi se baja el archivo, asi no frena la carga del juego.
//   poner(nivel, suena)  nivel de 0 a 1 (1 = el volumen del inicio) y si tiene que sonar; el cambio es con un fundido corto
//   estado()             lo que esta pasando (para las pruebas): { iniciada, cargada, suena, nivel, objetivo, ganancia }
const ARCHIVO = 'musica/rally.mp3';
const BASE = 0.3;      // volumen del inicio: suave, para que no tape nada
const FUNDIDO = 0.35;  // segundos que tarda en acomodarse (constante de tiempo del fundido)

export function crearMusica() {
  let ctx = null, ganancia = null, fuente = null, buffer = null, pidio = false, nivel = 1, suena = true, pausada = false, objetivo = 0;

  function aplicar() {
    if (!ganancia) return;
    objetivo = suena && !pausada ? BASE * nivel : 0;
    ganancia.gain.setTargetAtTime(objetivo, ctx.currentTime, FUNDIDO);
  }
  function empezar() {
    if (!ctx || !buffer || fuente) return;
    fuente = ctx.createBufferSource();
    fuente.buffer = buffer; fuente.loop = true;   // (Web Audio: sin corte entre vuelta y vuelta)
    fuente.connect(ganancia);
    fuente.start();
  }
  async function cargar() {
    if (pidio) return;
    pidio = true;
    try {
      const r = await fetch(ARCHIVO);
      if (!r.ok) throw new Error(String(r.status));
      buffer = await ctx.decodeAudioData(await r.arrayBuffer());
      empezar();
    } catch (e) { pidio = false; }   // (sin musica no pasa nada: el juego sigue; se vuelve a probar con el proximo toque)
  }
  function iniciar() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      ganancia = ctx.createGain();
      ganancia.gain.value = 0;   // (entra con un fundido, no de golpe)
      ganancia.connect(ctx.destination);
      aplicar();
    }
    if (ctx.state === 'suspended' && !document.hidden) ctx.resume().catch(() => {});
    cargar();
  }
  // con la pestaña oculta se pausa; al volver sigue
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend().catch(() => {});
    else ctx.resume().catch(() => {});
  });
  return {
    iniciar,
    poner(n, si) {
      if (n === nivel && si === suena) return;
      nivel = n; suena = si; aplicar();
    },
    estado: () => ({ iniciada: !!ctx, cargada: !!buffer, suena: !!fuente && objetivo > 0, nivel, objetivo, ganancia: ganancia ? ganancia.gain.value : 0, contexto: ctx ? ctx.state : 'ninguno' }),
  };
}

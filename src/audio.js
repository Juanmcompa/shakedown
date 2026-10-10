// Sonido del motor y del barro, hecho con osciladores (no usa archivos de audio).
export function crearSonido() {
  let ctx = null, motor, grave, filtro, volumen, volBarro, mudo = false, marcha = 0;
  const TOPES = [0, 5, 10, 16, 40];   // a que velocidad (m/s) pasa cada cambio

  function iniciar() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    const salida = ctx.createGain();
    salida.gain.value = 0.5;
    salida.connect(ctx.destination);
    filtro = ctx.createBiquadFilter(); filtro.type = 'lowpass'; filtro.frequency.value = 400;
    volumen = ctx.createGain(); volumen.gain.value = 0.04;
    motor = ctx.createOscillator(); motor.type = 'sawtooth';
    grave = ctx.createOscillator(); grave.type = 'square';
    const g2 = ctx.createGain(); g2.gain.value = 0.5;
    motor.connect(filtro); grave.connect(g2); g2.connect(filtro);
    filtro.connect(volumen); volumen.connect(salida);
    // ruido para el patinaje
    const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const ruido = ctx.createBufferSource(); ruido.buffer = buf; ruido.loop = true;
    const banda = ctx.createBiquadFilter(); banda.type = 'bandpass'; banda.frequency.value = 700; banda.Q.value = 0.7;
    volBarro = ctx.createGain(); volBarro.gain.value = 0;
    ruido.connect(banda); banda.connect(volBarro); volBarro.connect(salida);
    motor.start(); grave.start(); ruido.start();
  }

  function actualizar(c) {
    if (!ctx) return;
    const v = Math.abs(c.velocidad), t = ctx.currentTime;
    if (v > TOPES[marcha + 1] && marcha < 3) marcha++;
    else if (v < TOPES[marcha] - 1.5 && marcha > 0) marcha--;
    // vueltas del motor entre 0 y 1: suben con la velocidad dentro del cambio y cuando patina
    const vueltas = Math.max(0.12, Math.min(1, 0.18 + 0.75 * (v - TOPES[marcha]) / (TOPES[marcha + 1] - TOPES[marcha]) * (0.5 + c.gas * 0.5) + c.patina * 0.55 * c.gas + c.gas * 0.12));
    motor.frequency.setTargetAtTime(42 + vueltas * 105, t, 0.06);
    grave.frequency.setTargetAtTime(21 + vueltas * 52, t, 0.06);
    filtro.frequency.setTargetAtTime(260 + vueltas * 900 + c.gas * 700, t, 0.05);
    volumen.gain.setTargetAtTime(mudo ? 0 : 0.035 + c.gas * 0.075, t, 0.05);
    volBarro.gain.setTargetAtTime(mudo ? 0 : Math.min(0.09, c.patina * 0.09 + (c.agua > 0.05 ? v * 0.006 : 0)), t, 0.08);
  }

  return { iniciar, actualizar, alternar: () => { mudo = !mudo; return mudo; } };
}

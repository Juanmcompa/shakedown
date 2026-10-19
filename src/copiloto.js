// El copiloto: las notas de la pista (que curva viene, que tan cerrada, si hay un salto o un vado)
// y la voz que las canta un rato antes de llegar. Las notas salen del generador (el campo "nota" de cada tramo).
// Los grados van del 1 (la mas cerrada) al 6 (casi recta); "h" es una horquilla y "e", una esquina de 90 grados.

const GRADOS = { 1: 'uno', 2: 'dos', 3: 'tres', 4: 'cuatro', 5: 'cinco', 6: 'seis' };
const DICHO = { salto: 'salto', baden: 'badén', vado: 'vado, agua', barro: 'barro', angosto: 'angosto', cornisa: 'cornisa, cuidado', meta: 'meta',
  puente: 'puente, angosto', cuidado: 'cuidado', adoquin: 'adoquines', asfalto: 'asfalto', ripio: 'ripio', lomo: 'lomo', lajas: 'lajas, despacio', pueblo: 'pueblo', duna: 'duna, con envión', fesh: 'fesh fesh', pedregal: 'piedras sueltas, despacio', surcos: 'huellas hondas', duda: '' };

// lo que diria el copiloto por una nota
export function decir(n) {
  if (n.tipo !== 'curva') return DICHO[n.tipo] || '';
  const lado = n.lado === 'izq' ? 'izquierda' : 'derecha';
  return n.grado === 'h' ? 'horquilla ' + lado : n.grado === 'e' ? lado + ' noventa' : lado + ' ' + GRADOS[n.grado] + (n.larga ? ', larga' : '');
}

export function crearCopiloto(T) {
  // todas las notas, en orden: { i: en que metro empieza, tipo, lado, grado, larga }
  // (en una vuelta cerrada el camino trae tres vueltas seguidas: las notas se repiten en cada una, y no hay meta)
  const notas = [], L = T.vuelta ? T.vuelta.largo : 0;
  for (let v = 0; v < (L ? 3 : 1); v++) for (const t of T.etapa.tramos) if (t.nota) notas.push({ i: t.desde + v * L, ...t.nota });
  if (!L) notas.push({ i: T.meta.i, tipo: 'meta' });
  const porVuelta = L ? notas.length / 3 : 0;
  let dicha = -1, voz = null, habla = false;

  function elegirVoz() {
    if (!window.speechSynthesis) return;
    const voces = speechSynthesis.getVoices().filter((v) => /^es/i.test(v.lang));
    voz = voces.find((v) => /AR|419|MX|US/i.test(v.lang)) || voces[0] || null;
  }
  function hablar(texto, apuro) {
    if (!habla || !window.speechSynthesis || !texto) return;
    const u = new SpeechSynthesisUtterance(texto);
    if (voz) u.voice = voz;
    u.lang = voz ? voz.lang : 'es-AR'; u.rate = apuro ? 1.5 : 1.25; u.volume = 1;
    if (apuro) speechSynthesis.cancel();
    speechSynthesis.speak(u);
  }

  return {
    notas,
    // las de una sola vuelta, para mostrarlas en la portada
    hoja: L ? notas.slice(0, porVuelta) : notas,
    // (vuelta cerrada) se cruzo la raya y las cuentas volvieron una vuelta atras: las notas ya cantadas tambien
    otraVuelta: () => { dicha -= porVuelta; },
    // la nota que viene y la siguiente, para mostrarlas. Devuelve [] si no hay ninguna cerca.
    proximas: (indice, velocidad) => {
      const hasta = indice + Math.max(60, velocidad * 6) + 40, lista = [];
      for (const n of notas) { if (n.i < indice - 4) continue; if (n.i > hasta || lista.length === 2) break; lista.push(n); }
      return lista;
    },
    // se llama en cada cuadro: canta la nota cuando faltan unos segundos para llegar
    paso: (indice, velocidad) => {
      for (let k = dicha + 1; k < notas.length; k++) {
        const falta = notas[k].i - indice;
        if (falta > Math.max(35, velocidad * 3.6)) break;
        dicha = k;
        if (falta > -5) hablar(decir(notas[k]), true);
      }
    },
    // (Travesia: notas voladas) saca las notas que todavia no se cantaron entre esos dos metros del camino
    callar: (desde, hasta) => { for (let k = notas.length - 1; k > dicha; k--) if (notas[k].i >= desde && notas[k].i < hasta) notas.splice(k, 1); },
    reiniciar: () => { dicha = -1; if (window.speechSynthesis) speechSynthesis.cancel(); },
    // prende o apaga la voz. Hay que llamarlo desde un toque o una tecla (los navegadores no dejan hablar antes).
    voz: (si) => {
      habla = si && !!window.speechSynthesis;
      if (habla) { elegirVoz(); if (!voz) speechSynthesis.onvoiceschanged = elegirVoz; } else if (window.speechSynthesis) speechSynthesis.cancel();
      return habla;
    },
    hablar: (texto) => hablar(texto, false),
  };
}

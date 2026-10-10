// El calendario del club: cada dia tiene su numero y de ese numero sale la pista.
// El dia cambia a la medianoche de Argentina, este donde este el aparato.
const UN_DIA = 86400000;
const EPOCA = Date.UTC(2026, 9, 10, 3);   // Shakedown #1: el 10 de octubre de 2026, a las 00:00 de Argentina (03:00 UTC)
const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'], MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

// el numero del dia de hoy (1 o mas)
export const hoy = (ahora = Date.now()) => Math.max(1, Math.floor((ahora - EPOCA) / UN_DIA) + 1);
// la fecha de un numero, escrita corta: "sáb 10 oct"
export function fechaDe(numero) {
  const d = new Date(EPOCA + (numero - 1) * UN_DIA - 3 * 3600000);   // corrida 3 horas para leerla como si fuera UTC
  return DIAS[d.getUTCDay()] + ' ' + d.getUTCDate() + ' ' + MESES[d.getUTCMonth()];
}
// cuanto falta para la proxima pista, en milisegundos
export const faltaParaLaProxima = (ahora = Date.now()) => EPOCA + hoy(ahora) * UN_DIA - ahora;

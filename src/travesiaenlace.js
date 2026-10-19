// El link que se comparte de la Travesia: solo dice quien es y cuantos km hizo (no lleva pasada, ni fantasma, ni pista:
// en la Travesia el camino sale al azar y cada corrida es distinta). Va despues del "#" de la direccion del juego:
//   #t=Ana.2347      Ana llego a 23,47 km (los km, en centesimas)
// El nombre va codificado (puede llevar espacios, tildes o puntos): el numero es lo que sigue al ultimo punto.
import { limpio } from './fantasma.js';

const MAXIMO = 1000;   // km: lo mismo que acepta el servidor

export function enlaceDeTravesia(nombre, km) {
  const n = limpio(nombre), c = Math.round(Number(km) * 100);
  return n && c > 0 && c <= MAXIMO * 100 ? '#t=' + encodeURIComponent(n) + '.' + c : '';
}

// Lee la parte de la direccion que sigue al "#". Devuelve { nombre, km } o null si no hay (o si no se puede creer).
export function leerEnlaceTravesia(hash) {
  const m = /[#&]t=([^&#]+)\.(\d{1,7})(?=[&#]|$)/.exec(String(hash || ''));
  if (!m) return null;
  let nombre = '';
  try { nombre = limpio(decodeURIComponent(m[1])); } catch (e) { return null; }
  const km = Number(m[2]) / 100;
  return nombre && km > 0 && km <= MAXIMO ? { nombre, km } : null;
}

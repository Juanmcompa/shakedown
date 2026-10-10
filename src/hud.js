// Instrumentos y carteles en pantalla (el HTML esta en index.html).
import { SUELO } from './config.js';

const $ = (id) => document.getElementById(id);
export const reloj = (s) => { const m = Math.floor(s / 60), r = s - m * 60; return m + ':' + (r < 10 ? '0' : '') + r.toFixed(1); };

export function crearHud(T) {
  const P = T.camino, ruedas = Array.from(document.querySelectorAll('.ruedas i'));
  // perfil de alturas de la etapa, con una marca por control
  let ymin = 1e9, ymax = -1e9;
  for (let i = 0; i < P.n; i++) { ymin = Math.min(ymin, P.Y[i]); ymax = Math.max(ymax, P.Y[i]); }
  const px = (i) => 5 + 310 * i / (P.n - 1), py = (i) => 43 - 34 * (P.Y[i] - ymin) / (ymax - ymin);
  let d = 'M5 48';
  for (let i = 0; i < P.n; i += 6) d += 'L' + px(i).toFixed(1) + ' ' + py(i).toFixed(1);
  $('perfilForma').setAttribute('d', d + 'L315 ' + py(P.n - 1).toFixed(1) + 'L315 48Z');
  const marcas = T.controles.map((c) => {
    const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    l.setAttribute('x1', px(c.i)); l.setAttribute('x2', px(c.i)); l.setAttribute('y1', py(c.i) - 9); l.setAttribute('y2', py(c.i) + 2);
    $('perfilControles').appendChild(l);
    return l;
  });
  $('etapa').textContent = T.etapa.nombre + ', ' + T.etapa.lugar;
  let tCartel = 0, tAviso = 0, dicho = '';

  return {
    mostrar: (si) => { $('hud').hidden = !si; },
    // cartel amarillo con el nombre del tramo
    cartel: (txt) => { $('cartel').textContent = txt; $('cartel').hidden = false; tCartel = 2.8; },
    // aviso negro: que paso y que hacer. seg = cuanto dura (0 = hasta que se saque)
    aviso: (txt, seg) => {
      if (txt !== dicho) { $('aviso').textContent = txt; dicho = txt; }
      $('aviso').hidden = !txt; tAviso = seg || 0;
    },
    controles: (n) => {
      marcas.forEach((l, i) => l.classList.toggle('pasado', i < n));
      $('control').textContent = n < marcas.length ? 'Control ' + n + ' de ' + marcas.length : 'Falta la cumbre';
    },
    mejor: (s) => { $('mejor').textContent = s ? 'Mejor ' + reloj(s) : ''; },
    actualizar: (c, tiempo, indice, dt) => {
      $('reloj').textContent = reloj(tiempo);
      $('vel').textContent = Math.round(Math.abs(c.velocidad) * 3.6);
      $('suelo').textContent = c.agua > 0.05 ? 'Agua' : SUELO[c.suelo].nombre;
      c.ruedas.forEach((r, i) => { ruedas[i].className = !r.toca ? 'aire' : r.patina > 0.5 ? 'fondo' : r.patina > 0.08 ? 'patina' : ''; });
      const cab = Math.asin(Math.max(-1, Math.min(1, c.adelante[1]))) * 57.3, rol = Math.asin(Math.max(-1, Math.min(1, c.derecha[1]))) * 57.3;
      $('figCabeceo').setAttribute('transform', 'rotate(' + (-cab).toFixed(1) + ')');
      $('figRolido').setAttribute('transform', 'rotate(' + (-rol).toFixed(1) + ')');
      $('gCabeceo').textContent = Math.round(cab);
      $('gRolido').textContent = Math.round(Math.abs(rol));
      $('dialCabeceo').classList.toggle('peligro', Math.abs(cab) > 26);
      $('dialRolido').classList.toggle('peligro', Math.abs(rol) > 22);
      $('perfilAca').setAttribute('cx', px(indice));
      $('perfilAca').setAttribute('cy', py(indice));
      if (tCartel > 0 && (tCartel -= dt) <= 0) $('cartel').hidden = true;
      if (tAviso > 0 && (tAviso -= dt) <= 0) { $('aviso').hidden = true; dicho = ''; }
    },
  };
}

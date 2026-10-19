// La guia de la Travesia: tres o cuatro pantallitas, con un personaje del equipo, iconos y pocas palabras. Se abre sola la
// primera vez que se entra al modo y se puede volver a ver desde "Como se juega" y desde la categoria Aventura.
// No sabe nada del modo: quien la abre le dice que hacer cuando se cierra (se llegue al final o se saltee).
import { deEquipo, retrato } from './equipo.js';
import { icono } from './iconos.js';

const $ = (id) => document.getElementById(id);
const tecla = (t) => '<kbd>' + t + '</kbd>';

// Las pantallas, en orden. quien: quien habla (ver equipo.js). iconos: lo que se dibuja grande. texto(c): lo que dice
// (c.dedos: se juega tocando la pantalla). Para cambiar lo que dicen, alcanza con tocar los textos de aca.
export const PANTALLAS = [
  { quien: 'leo', iconos: ['duna', 'bandera'],
    texto: () => '<p>El camino <b>no termina</b> y cada vez sale distinto.</p><p>Gana el que llega <b>más lejos</b>.</p>' },
  { quien: 'julian', iconos: ['carta', 'carta', 'carta'],
    texto: () => '<p>Cada <b>2 km</b> te tocan <b>3 problemas</b>.</p><p>Elegí el menos malo. Ninguno es bueno.</p>' },
  { quien: 'sebastian', iconos: ['dano', 'cono'],
    texto: () => '<p>Se termina si <b>rompés el auto</b> o te quedás <b>parado</b>.</p>' },
  { quien: 'leo', iconos: ['trazada'],
    texto: (c) => '<p>Seguí la <b>línea punteada</b>.</p>' + (c.dedos ? '' : '<p>La tecla ' + tecla('T') + ' la apaga.</p>') },
];

// o: { alCerrar(): se llego al final o se salteo }
export function crearGuiaTravesia(o) {
  const caja = $('guiaTv'), botones = $('guiaBotones'), puntos = $('guiaPuntos');
  let paso = 0, abierta = false;
  const dedos = () => !!window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

  function boton(texto, clase, alTocar) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = clase; b.textContent = texto;
    b.addEventListener('click', alTocar);
    botones.append(b);
    return b;
  }
  function pintar() {
    const p = PANTALLAS[paso], quien = deEquipo(p.quien), ultima = paso === PANTALLAS.length - 1;
    $('guiaRetrato').src = retrato(quien.id);
    $('guiaNombre').textContent = quien.nombre;
    $('guiaRol').textContent = quien.rol;
    $('guiaTexto').innerHTML = p.texto({ dedos: dedos() });
    const iconos = $('guiaIconos');
    iconos.textContent = '';
    for (const nombre of p.iconos) { const img = document.createElement('img'); img.className = 'icono'; img.alt = ''; img.src = icono(nombre); iconos.append(img); }
    puntos.textContent = '';
    PANTALLAS.forEach((x, k) => { const i = document.createElement('i'); if (k === paso) i.className = 'aca'; else if (k < paso) i.className = 'ya'; puntos.append(i); });
    botones.textContent = '';
    const principal = boton(ultima ? 'A correr' : 'Siguiente', 'con-texto fuerte', () => (ultima ? cerrar() : ir(paso + 1)));
    $('guiaSaltar').hidden = ultima;
    principal.focus({ preventScroll: true });
  }
  function ir(n) { paso = Math.max(0, Math.min(PANTALLAS.length - 1, n)); pintar(); }

  // Mientras esta abierta, las teclas son de la guia (las del juego no hacen nada)
  function alTeclear(e) {
    if (!abierta) return;
    e.stopImmediatePropagation();
    if (e.type !== 'keydown' || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.code === 'Escape') { e.preventDefault(); cerrar(); }
    else if (e.code === 'ArrowRight') { e.preventDefault(); if (paso < PANTALLAS.length - 1) ir(paso + 1); else cerrar(); }
    else if (e.code === 'ArrowLeft') { e.preventDefault(); ir(paso - 1); }
    else if (['ArrowUp', 'ArrowDown', 'Space'].includes(e.code) && e.target.tagName !== 'BUTTON') e.preventDefault();
  }
  window.addEventListener('keydown', alTeclear, true);
  window.addEventListener('keyup', alTeclear, true);

  function cerrar() {
    if (!abierta) return;
    abierta = false;
    caja.hidden = true;
    o.alCerrar();
  }
  $('guiaSaltar').addEventListener('click', cerrar);
  $('guiaCerrar').addEventListener('click', cerrar);

  return {
    abierta: () => abierta,
    abrir: () => {
      if (abierta) return;
      abierta = true; paso = 0;
      for (const p of PANTALLAS) new Image().src = retrato(p.quien);   // (los retratos se van bajando ya, asi no aparecen de golpe)
      caja.hidden = false;
      pintar();
    },
    cerrar,
    // (para las pruebas)
    paso: () => paso, ir,
  };
}

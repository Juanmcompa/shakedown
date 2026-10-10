// Lo que se ve en pantalla mientras se corre: el reloj, los cuadraditos de los sectores, la velocidad,
// el daño, las notas del copiloto, los avisos y el estado de los botones. (El HTML esta en index.html.)
import { CAMARAS } from './config.js';
import { iconoDeNota, textoDeNota, icono } from './iconos.js';

const $ = (id) => document.getElementById(id);
const dos = (n) => String(n).padStart(2, '0');
// el reloj mientras se corre: 1:42.8
export const reloj = (s) => { const m = Math.floor(s / 60), r = s - m * 60; return m + ':' + (r < 10 ? '0' : '') + (Math.floor(r * 10) / 10).toFixed(1); };
// un tiempo final, con centesimas: 01:42:85
export const tiempoFinal = (s) => { const cs = Math.round(s * 100); return dos(Math.floor(cs / 6000)) + ':' + dos(Math.floor(cs / 100) % 60) + ':' + dos(cs % 100); };
export const CLASE_DE_COLOR = { v: 'verde', a: 'amarillo', r: 'rojo', n: 'negro' };

export function crearHud() {
  const cuadros = Array.from($('cuadros').children), boton = (clase) => document.querySelector('#mandos .' + clase);
  let tAviso = 0, tGrande = 0, dicho = '', notasPuestas = '';
  // la camara lleva un puntito por cada modo
  const puntos = boton('camara').querySelector('.puntos');
  puntos.textContent = '';
  for (let i = 0; i < CAMARAS.length; i++) puntos.append(document.createElement('i'));

  return {
    // (los pedales del celular se ven solo mientras se corre: los esconde el estilo si no esta la clase "jugando")
    mostrar: (si) => { $('hud').hidden = !si; $('mandos').hidden = !si; document.documentElement.classList.toggle('jugando', si); },
    // --- el estado de los botones: tiene que verse de un vistazo ---
    // la camara: el auto dibujado como se lo ve con la que esta puesta, y encendido el puntito que le toca
    camara: (id) => {
      const b = boton('camara'), k = Math.max(0, CAMARAS.findIndex((m) => m.id === id));
      b.firstElementChild.src = icono('cam-' + CAMARAS[k].id);
      Array.from(puntos.children).forEach((p, i) => p.classList.toggle('aca', i === k));
      b.setAttribute('aria-label', 'Cámara: ' + CAMARAS[k].nombre + ' (' + (k + 1) + ' de ' + CAMARAS.length + '). Cambiar');
    },
    // el sonido ('sonido') y la voz del copiloto ('voz'): prendido se ve entero; apagado, tenue y tachado
    prendido: (cual, si) => {
      const b = boton(cual);
      b.firstElementChild.src = icono(cual, undefined, !si);
      b.classList.toggle('apagado', !si);
      b.setAttribute('aria-pressed', si);
    },
    // "volver al camino" titila cuando el auto quedo trabado
    llamar: (si) => boton('volver').classList.toggle('llama', si),
    // aviso chico: que paso y que hacer. seg = cuanto dura (0 = hasta que se saque). dibujo: un icono que va adelante.
    aviso: (txt, seg, dibujo) => {
      const clave = txt + '|' + (dibujo || '');
      if (clave !== dicho) {
        dicho = clave;
        $('aviso').textContent = txt;
        if (dibujo) { const img = document.createElement('img'); img.className = 'icono'; img.alt = ''; img.src = icono(dibujo); $('aviso').prepend(img); }
      }
      $('aviso').hidden = !txt && !dibujo; tAviso = seg || 0;
    },
    // cartel grande en el medio: la cuenta regresiva, una penalizacion, el tiempo de un sector
    grande: (txt, seg, clase) => { const el = $('grande'); el.textContent = txt; el.className = 'grande ' + (clase || ''); el.hidden = !txt; tGrande = seg || 0; },
    // los cuadraditos: "colores" es lo ya corrido ('va...'), y "actual" el sector en el que se esta
    sectores: (colores, actual) => cuadros.forEach((el, i) => { el.className = i < colores.length ? CLASE_DE_COLOR[colores[i]] : i === actual ? 'ahora' : ''; }),
    // cuanto se le lleva o se le pierde al fantasma: negativo = vas adelante
    rival: (nombre, seg) => {
      const el = $('rival');
      if (el.dataset.de !== nombre) {   // el fantasma, su nombre (se corta si no entra) y la diferencia
        el.dataset.de = nombre; el.textContent = '';
        const img = document.createElement('img'), quien = document.createElement('span');
        img.className = 'icono'; img.alt = 'Contra'; img.src = icono('fantasma');
        quien.className = 'quien'; quien.textContent = nombre;
        el.append(img, quien, document.createElement('b'));
      }
      el.hidden = false;
      el.lastChild.textContent = (seg < 0 ? '−' : '+') + Math.abs(seg).toFixed(1);
      el.className = seg < 0 ? 'adelante' : 'atras';
    },
    sinRival: () => { $('rival').hidden = true; },
    // las notas del copiloto: la que viene (grande, con los metros que faltan) y la siguiente
    notas: (lista, indice) => {
      const clave = lista.map((n) => n.i).join(',');
      if (clave !== notasPuestas) {
        notasPuestas = clave;
        $('notas').textContent = '';
        lista.forEach((n, k) => {
          const caja = document.createElement('span'), img = document.createElement('img'), txt = document.createElement('b'), falta = document.createElement('small');
          caja.className = 'nota' + (k ? ' despues' : '');
          img.src = iconoDeNota(n); img.alt = ''; img.className = 'icono';
          txt.textContent = textoDeNota(n);
          caja.append(img, txt, falta);
          $('notas').append(caja);
        });
      }
      lista.forEach((n, k) => { const f = $('notas').children[k].lastChild, m = Math.max(0, Math.round((n.i - indice) / 10) * 10); f.textContent = m > 0 ? m : ''; });
    },
    // punto amarillo que muestra el volante cuando se dobla inclinando el celular
    volante: (v) => { if (v !== null) $('volanteAca').style.left = (50 + v * 50).toFixed(1) + '%'; },
    actualizar: (c, p, dt) => {
      $('reloj').textContent = reloj(p.tiempo);
      $('roto').style.width = p.roto.toFixed(1) + '%';
      $('roto').parentNode.classList.toggle('alerta', p.roto > 60);
      $('vel').textContent = Math.round(Math.abs(c.velocidad) * 3.6);
      if (tAviso > 0 && (tAviso -= dt) <= 0) { $('aviso').hidden = true; dicho = ''; }
      if (tGrande > 0 && (tGrande -= dt) <= 0) $('grande').hidden = true;
    },
  };
}

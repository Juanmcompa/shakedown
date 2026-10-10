// Ranking, desafios y fantasmas en pantalla: el nombre del jugador, la tabla de tiempos,
// el boton para compartir la marca y el aviso cuando se llega desde el link de un amigo.
import { crearMarcas, leerCodigo, crearFantasma } from './fantasma.js';
import { reloj } from './hud.js';

const $ = (id) => document.getElementById(id);

export function crearSocial(T) {
  const etapa = T.etapa.version, marcas = crearMarcas(etapa);
  let rival = null;          // { nombre, tiempo, fantasma } contra quien se corre
  let ultimoLink = '', alCambiar = () => {};

  async function elegir(m) {   // pone de rival a una marca que tenga la vuelta guardada
    const leido = m && m.codigo ? await leerCodigo(m.codigo) : null;
    rival = leido && leido.marca.etapa === etapa ? { nombre: m.nombre, tiempo: m.tiempo, fantasma: crearFantasma(leido.vuelta, T) } : null;
    pintar();
    alCambiar(rival);
  }

  function pintar() {
    const lista = marcas.lista().slice(0, 8), yo = marcas.nombre();
    for (const ol of document.querySelectorAll('.tabla')) {
      ol.textContent = '';
      lista.forEach((m) => {
        const li = document.createElement('li'), quien = document.createElement('span'), t = document.createElement('span');
        quien.textContent = m.nombre + (m.mio && m.nombre === yo ? ' (vos)' : '');
        t.textContent = reloj(m.tiempo);
        t.className = 'tiempoMarca';
        li.append(quien, t);
        if (m.codigo) {
          const b = document.createElement('button'), es = rival && rival.nombre === m.nombre;
          b.textContent = es ? 'Es tu rival' : 'Correr contra';
          b.className = 'chiquito' + (es ? ' elegido' : '');
          b.addEventListener('click', () => elegir(es ? null : m));
          li.append(b);
        }
        ol.append(li);
      });
      ol.parentNode.hidden = lista.length === 0;
    }
  }

  // --- al abrir: si el link trae la marca de un amigo, se anota y queda de rival ---
  async function abrir() {
    const r = /[#&]r=([\w-]+)/.exec(location.hash);
    const leido = r ? await leerCodigo(r[1]) : null;
    if (leido) {
      for (const o of leido.tabla) marcas.anotar(o);
      if (leido.marca.etapa === etapa) {
        marcas.anotar({ ...leido.marca, codigo: r[1] });
        $('desafio').textContent = leido.marca.nombre + ' hizo ' + reloj(leido.marca.tiempo) + '. Vas a correr contra su fantasma.';
        $('desafio').hidden = false;
        await elegir({ nombre: leido.marca.nombre, tiempo: leido.marca.tiempo, codigo: r[1] });
        return;
      }
      $('desafio').textContent = 'La marca de ' + leido.marca.nombre + ' es de una versión anterior de la etapa: ya no vale.';
      $('desafio').hidden = false;
    }
    // sin desafio: el rival es la mejor marca que tenga vuelta guardada (la propia, si hay)
    const propia = marcas.lista().find((m) => m.mio && m.codigo) || marcas.lista().find((m) => m.codigo);
    await elegir(propia || null);
  }

  // --- al llegar: guarda la marca y prepara el link ---
  let pendiente = null;
  async function anotarLlegada() {
    if (!pendiente) return;
    const nombre = marcas.nombre();
    $('nombre').value = nombre;
    if (!nombre) { $('compartido').textContent = 'Poné tu nombre para entrar al ranking y compartir tu marca.'; pintar(); return; }
    const m = { nombre, tiempo: pendiente.tiempo, etapa, nafta: pendiente.nafta, rescates: pendiente.rescates };
    const tabla = marcas.lista().filter((x) => x.nombre !== nombre);
    const codigo = await pendiente.grabacion.codigo(m, tabla);
    marcas.anotar({ ...m, codigo, mio: true });
    ultimoLink = location.origin + location.pathname + '#r=' + codigo;
    $('compartido').textContent = '';
    $('compartir').disabled = false;
    pintar();
  }

  async function compartir() {
    if (!marcas.nombre()) { $('nombre').focus(); return; }
    const texto = 'Hice ' + reloj(pendiente.tiempo) + ' en Encajados. ¿Me ganás?';
    // en el celular abre el menu de compartir; en la compu copia el link
    try {
      if (navigator.share && window.matchMedia('(pointer: coarse)').matches) { await navigator.share({ title: 'Encajados', text: texto, url: ultimoLink }); return; }
      await navigator.clipboard.writeText(texto + ' ' + ultimoLink);
      $('compartido').textContent = 'Link copiado. Pegalo donde quieras.';
    } catch (e) {
      if (e && e.name === 'AbortError') return;
      $('compartido').textContent = 'No pude copiarlo. Copialo de acá: ' + ultimoLink;
    }
  }

  $('nombre').addEventListener('change', () => { marcas.ponerNombre($('nombre').value); anotarLlegada(); });
  $('nombre').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('nombre').blur(); });
  $('compartir').addEventListener('click', compartir);

  return {
    abrir,
    rival: () => rival,
    alCambiarRival: (f) => { alCambiar = f; },
    // llego: se guarda la vuelta. perdio: no hay nada que compartir.
    llegada: (grabacion, partida) => {
      pendiente = { grabacion, tiempo: partida.tiempo, nafta: partida.nafta, rescates: partida.usados };
      $('social').hidden = false;
      $('compartir').disabled = true;
      return anotarLlegada();
    },
    derrota: () => { pendiente = null; $('social').hidden = true; pintar(); },
  };
}

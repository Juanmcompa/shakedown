// Camara que sigue al auto. Los modos estan en config.js (tecla C, o el boton de la camara).
import * as THREE from '../vendor/three.module.js';
import { CAMARAS } from './config.js';

const RAD = Math.PI / 180;

export function crearCamara(T) {
  const cam = new THREE.PerspectiveCamera(30, 1, 2, 900);
  const e = { modo: 0, rumbo: 0, dist: 60, alto: 60, fov: 30, x: 0, y: 0, z: 0, listo: false, cerca: 1, chica: 0, parada: false, lejos: 1, ancha: 1, adelante: 1, baja: 0, tiembla: 0, vibra: 0, apuro: 0 };
  // La parte de la pantalla donde tiene que quedar el auto, para que no lo tapen los controles (fracciones de pantalla):
  // nunca mas abajo que "abajo", ni mas arriba que "arriba", ni mas cerca de los costados que "lados".
  const zona = { abajo: 0.16, arriba: 0.2, lados: 0.22 };
  let lista = CAMARAS;   // los modos que valen ahora (el camion de carga usa otros, mas cerca y mas bajos)
  const quieta = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hacia = (a, b, dt, seg) => a + (b - a) * (1 - Math.exp(-dt / seg));

  function seguir(c, dt) {
    const m = lista[e.modo], v = Math.abs(c.velocidad), f = c.adelante, rapido = Math.min(1, v / 22);
    // recien cambiada de modo, se acomoda rapido; despues se mueve con calma
    const calma = e.apuro > 0 ? 0.3 : 1;
    e.apuro = Math.max(0, e.apuro - dt);
    // Hacia donde mira: hacia donde VA el auto, no hacia donde apunta. Asi, cuando viene cruzado en una curva,
    // se lo ve de costado y se ve el camino que viene. Despacio o marcha atras, hacia donde apunta.
    const vh = Math.hypot(c.vel[0], c.vel[2]), va = c.velocidad > 0 ? Math.min(1, Math.max(0, (vh - 3) / 5)) : 0;
    let hx = f[0] * (1 - va) + c.vel[0] / (vh || 1) * va, hz = f[2] * (1 - va) + c.vel[2] / (vh || 1) * va;
    const hl = Math.hypot(hx, hz) || 1;
    hx /= hl; hz /= hl;
    // la camara gira despacio hasta ponerse atras
    const rumbo = Math.atan2(hx, -hz);
    let d = rumbo - e.rumbo;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    e.rumbo += d * (1 - Math.exp(-dt / m.sigue));
    // mas rapido: se aleja, baja un poco y mira mas adelante, para ver venir la curva
    // (en la pantalla de un celular, cada camara cambia su distancia a su manera: ver "celu" en CAMARAS)
    const celu = m.celu ? m.celu[e.parada ? 'parado' : 'acostado'] : null;
    e.cerca = celu ? 1 + e.chica * (celu[0] + (celu[1] - celu[0]) * rapido - 1) : 1;
    e.dist = hacia(e.dist, (m.dist[0] + (m.dist[1] - m.dist[0]) * rapido) * e.cerca * e.lejos, dt, 0.9 * calma);
    e.alto = hacia(e.alto, m.alto[0] + (m.alto[1] - m.alto[0] - e.baja) * rapido, dt, 0.9 * calma);
    e.fov = hacia(e.fov, Math.min(e.parada && m.fovParado ? m.fovParado : 56, 2 * Math.atan(Math.tan(m.fov * Math.PI / 360) * e.ancha) * 180 / Math.PI), dt, 0.4);
    const ad = (m.mira[0] + (m.mira[1] - m.mira[0]) * rapido) * e.adelante * (c.velocidad < -1 ? -0.4 : 1);
    const tx = c.pos[0] + hx * ad, ty = c.pos[1], tz = c.pos[2] + hz * ad;
    if (!e.listo) { e.x = tx; e.y = ty; e.z = tz; e.rumbo = rumbo; e.listo = true; }
    e.x = hacia(e.x, tx, dt, 0.25); e.y = hacia(e.y, ty, dt, 0.5); e.z = hacia(e.z, tz, dt, 0.25);

    // El auto tiene que quedar dentro de su zona de la pantalla. Si la mirada se adelanto o se corrio demasiado
    // (pasa en pantallas chicas y en las curvas cerradas), se la trae hasta donde haga falta.
    const a = e.alto * RAD, sa = Math.sin(a), ca = Math.cos(a), sr = Math.sin(e.rumbo), cr = Math.cos(e.rumbo);
    const tf = Math.tan(e.fov * Math.PI / 360), D = e.dist;
    const dx = c.pos[0] - e.x, dz = c.pos[2] - e.z;
    // (Si el auto esta mas alto o mas bajo que el punto mirado —en una bajada, la mirada va un poco mas arriba que el—
    // en la pantalla se lo ve corrido hacia arriba o hacia abajo: se lo cuenta como metros de mas o de menos hacia atras.)
    const sube = Math.max(-4, Math.min(4, (c.pos[1] - e.y) * ca / Math.max(0.5, sa)));
    const atras = -(dx * sr - dz * cr) - sube, lado = dx * cr + dz * sr;   // metros que el auto queda detras y a la derecha del punto mirado
    const yMin = 1 - 2 * zona.abajo, yMax = 1 - 2 * zona.arriba;    // (medidos desde el centro de la pantalla: 1 = el borde)
    const maxAtras = yMin * D * tf / (sa + yMin * ca * tf), maxAdelante = yMax * D * tf / Math.max(0.05, sa - yMax * ca * tf);
    const atras2 = Math.max(-maxAdelante, Math.min(maxAtras, atras));
    const maxLado = (1 - 2 * zona.lados) * (D - atras2 * ca) * tf * cam.aspect;
    const lado2 = Math.max(-maxLado, Math.min(maxLado, lado));
    if (atras2 !== atras || lado2 !== lado) {
      e.x = c.pos[0] - (-(atras2 + sube) * sr + lado2 * cr);
      e.z = c.pos[2] - ((atras2 + sube) * cr + lado2 * sr);
    }

    const h = ca * D;
    cam.position.set(e.x - sr * h, e.y + sa * D, e.z + cr * h);
    if (e.tiembla > 0.01) {   // sacudon por un golpe
      cam.position.x += (Math.random() - 0.5) * e.tiembla; cam.position.z += (Math.random() - 0.5) * e.tiembla;
      e.tiembla *= Math.exp(-dt * 9);
    }
    if (e.vibra > 0.005) {   // vibracion continua (la Travesia: escape libre, rueda desbalanceada), siempre un poco
      cam.position.x += (Math.random() - 0.5) * e.vibra; cam.position.y += (Math.random() - 0.5) * e.vibra * 0.6; cam.position.z += (Math.random() - 0.5) * e.vibra;
    }
    cam.position.y = Math.max(cam.position.y, T.altura(cam.position.x, cam.position.z) + 2.5);
    if (cam.fov !== e.fov) { cam.fov = e.fov; cam.updateProjectionMatrix(); }
    cam.lookAt(e.x, e.y, e.z);
  }
  return {
    cam, estado: e, seguir, zona,
    // Se adapta a la pantalla: si es chica cambia la distancia (cada camara a su manera) y si es angosta (celular parado) abre el angulo.
    // En un celular acostado hay poca altura: abre un poco el angulo y baja la camara cuando va rapido, para ver mas lejos.
    pantalla: (w, h) => {
      cam.aspect = w / h;
      const corto = Math.min(w, h), chica = corto < 520, acostada = w > h;
      e.chica = Math.max(0, Math.min(1, (700 - corto) / 300));   // 0 = pantalla grande (700 px o mas de lado corto); 1 = la de un celular (400 o menos)
      e.parada = !acostada;
      e.ancha = Math.max(chica && acostada ? 1.22 : 1, 1.25 * h / w);
      e.baja = chica && acostada ? 5 : 0;
      e.adelante = w < h ? 1.3 : 1;
      cam.updateProjectionMatrix();
    },
    // La distancia que se eligio en la configuracion: 1 = la normal, menos = mas cerca, mas = mas lejos.
    alejar: (cuanto) => { e.lejos = Math.max(0.5, Math.min(2, cuanto || 1)); e.apuro = 1; },
    // Donde tiene que quedar el auto en la pantalla (ver "zona"). Lo llama el juego segun donde estan los controles.
    encuadrar: (abajo, arriba, lados) => { zona.abajo = abajo; zona.arriba = arriba; zona.lados = lados; },
    // cual esta puesta: { id, nombre, ... } (ver CAMARAS)
    modo: () => lista[e.modo],
    // cambia el juego de camaras (null = las de siempre); mismos ids y mismo orden
    usar: (otras) => { lista = otras || CAMARAS; e.apuro = 1.4; },
    // pasa a la siguiente, o a la que se pida por su id. Devuelve la que quedo.
    cambiar: (id) => {
      const k = lista.findIndex((m) => m.id === id);
      e.modo = k >= 0 ? k : id === undefined ? (e.modo + 1) % lista.length : e.modo;
      e.apuro = 1.4;
      return lista[e.modo];
    },
    saltar: () => { e.listo = false; },
    // vibracion que dura hasta que se la apaga (0): cuanto, en metros de temblor
    vibrar: (cuanto) => { e.vibra = quieta ? 0 : cuanto; },
    sacudir: (cuanto) => { if (!quieta) e.tiembla = Math.min(1.6, 0.3 + cuanto / 25); },
  };
}

# Encajados

Juego web de manejo 4x4 visto desde arriba, en 3D. No es una carrera: es llegar a la cumbre sin quedarse en el camino.

**Jugar:** https://juanmcompa.github.io/encajados/

Versión 0.1: un prototipo para probar si manejar es divertido. Tiene una etapa de 975 metros (Yungas) con asfalto roto, bañado, vado, lateral, caracoles, cornisa, bajada y trepada.

## Cómo se juega

| Tecla | Qué hace |
| --- | --- |
| `W` `A` `S` `D` o flechas | Acelerar, doblar, frenar y marcha atrás |
| `Espacio` | Freno de mano (traba las ruedas de atrás) |
| `R` | Volver al último control |
| `C` | Cambiar la cámara: aérea, aérea fija, cerca |
| `M` | Sonido |

Lo que conviene saber:

- **El barro frena y hace patinar.** Con el acelerador a fondo las ruedas patinan y la camioneta se va de costado. A veces rinde más soltar un poco.
- **Los charcos claros son pantano.** Si entrás despacio te encajás. Esquivalos o pasalos con envión.
- **Las subidas de barro piden envión.** Si no llegás arriba, retrocedé y tomá carrera.
- **En la cornisa, despacio.** Los mojones blancos marcan el borde. Lo que se ve oscuro y azulado está muy abajo.
- **Mirá los cuatro cuadraditos** al lado del nombre del suelo: son las ruedas. Blanco agarra, amarillo patina, rojo patina mucho, hueco está en el aire.

## Qué tocar para cambiar el juego

Dos archivos concentran casi todo lo que se ajusta:

- `src/config.js`: agarre de cada suelo, motor, suspensión, cámaras y tiempos de las medallas.
- `src/etapa1.js`: el camino, escrito como una lista de tramos (largo, giro, pendiente, ancho, suelo, laderas, pozos).

## Cómo está armado

Es HTML, CSS y JavaScript sin instalación ni compilado. Subir al repo es publicar: GitHub Pages lo actualiza en un minuto.

| Archivo | Qué hace |
| --- | --- |
| `index.html`, `style.css` | La página, la portada y los instrumentos en pantalla |
| `src/main.js` | Arma todo, corre el ciclo del juego y aplica las reglas |
| `src/config.js` | Los números para ajustar |
| `src/etapa1.js` | La etapa, tramo por tramo |
| `src/terrain.js` | Convierte los tramos en terreno: alturas, suelos, río, árboles |
| `src/vehicle.js` | La física de la camioneta |
| `src/world.js`, `src/truck.js` | Dibujan el terreno y la camioneta |
| `src/camera.js`, `src/fx.js`, `src/audio.js` | Cámaras, huellas y barro que salta, sonido del motor |
| `src/hud.js`, `src/input.js`, `src/noise.js` | Instrumentos, teclado, ruido para el relieve |
| `vendor/` | Three.js, la biblioteca 3D (licencia MIT) |
| `tools/` | Pruebas de la física sin gráficos (opcionales) |

## Probarlo en tu compu

Abrir `index.html` con doble clic no funciona: el navegador no carga los módulos desde un archivo suelto. Dos formas:

- En VS Code, con la extensión Live Server: clic derecho sobre `index.html` y "Open with Live Server".
- O subir los cambios y probar en la página publicada.

## Pruebas (opcional)

Con Node instalado, desde la carpeta del repo:

- `node tools/fisica.mjs`: aceleración, frenada, subidas y laterales en cada suelo.
- `node tools/piloto.mjs`: un piloto automático recorre la etapa y avisa dónde no pasa.
- `node tools/humano.mjs`: pilotos imperfectos (con teclas) para estimar la dificultad.
- `node tools/deriva.mjs`: cuánto dobla y cuánto colea en cada suelo.

Sirven para revisar que la etapa se pueda terminar después de tocar `config.js` o `etapa1.js`.

## Plan

El plan de desarrollo está en [PLAN.md](PLAN.md).

## Créditos

Hecho con [Three.js](https://threejs.org/) (MIT). Tipografía [Barlow](https://fonts.google.com/specimen/Barlow) (OFL).

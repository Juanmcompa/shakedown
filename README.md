# Encajados

Juego web de manejo 4x4 visto desde arriba, en 3D. No es una carrera: es llegar a la cumbre sin quedarse en el camino.

**Jugar:** https://juanmcompa.github.io/encajados/

Es un prototipo. Tiene una etapa de 975 metros (Yungas) con asfalto roto, bañado, vado, un lateral con derrumbe, caracoles, cornisa, bajada y trepada. Se puede perder: por quedarse sin nafta, por romper la camioneta o por gastar los tres rescates.

## Cómo se juega

| Tecla | Qué hace |
| --- | --- |
| `W` `A` `S` `D` o flechas | Acelerar, doblar, frenar y marcha atrás |
| `Shift` | Reductora: cambia entre alta y baja |
| `Espacio` | Freno de mano (traba las ruedas de atrás) |
| `R` | Volver al último control (gasta un rescate) |
| `C` | Cambiar la cámara: aérea, aérea fija, cerca |
| `M` | Sonido |

En el celular no hay teclas:

- **Inclinar el celu** para doblar, como un volante. En iPhone pide permiso para usar el sensor.
- **Pedal derecho** para acelerar. **Pedal izquierdo** para frenar y, ya frenado, ir marcha atrás.
- Botones para la **reductora**, para volver al control y para cambiar la cámara.
- Si el sensor no responde, aparecen flechas para doblar con el dedo.
- Sirve con el celu vertical u horizontal. Vertical se ve más camino por delante.

Lo que conviene saber:

- **No es una carrera.** Gana el que llega; el tiempo solo desempata.
- **La nafta no sobra.** Se gasta al acelerar y casi el triple patinando. Hay bidones para juntar, casi siempre en lugares incómodos.
- **Reductora.** En baja hay fuerza para trepar y freno motor para bajar, pero se va lento y en el barro se patina más. En alta se va rápido, pero no se sube lo empinado.
- **Los golpes suman daño.** Con la camioneta rota se termina la etapa. Ojo con los autos tirados, los árboles y las piedras.
- **Hay tres rescates** para volver al último control. Desbarrancarse gasta uno solo.
- **En el derrumbe la tierra se corre** hacia el borde y te lleva. Hay que apuntar cuesta arriba y no parar.
- **El barro frena y hace patinar.** Con el acelerador a fondo las ruedas patinan y la camioneta se va de costado. A veces rinde más soltar un poco.
- **Los charcos claros son pantano.** Si entrás despacio te encajás. Esquivalos o pasalos con envión.
- **Las subidas de barro piden envión.** Si no llegás arriba, retrocedé y tomá carrera.
- **En la cornisa, despacio.** Los mojones blancos marcan el borde. Lo que se ve oscuro y azulado está muy abajo.
- **Mirá los cuatro cuadraditos** al lado del nombre del suelo: son las ruedas. Blanco agarra, amarillo patina, rojo patina mucho, hueco está en el aire.

## Qué tocar para cambiar el juego

Dos archivos concentran casi todo lo que se ajusta:

- `src/config.js`: agarre de cada suelo, motor y reductora, suspensión, cámaras, nafta, daño, rescates y tiempos de las medallas.
- `src/etapa1.js`: el camino, escrito como una lista de tramos (largo, giro, pendiente, ancho, suelo, laderas, pozos, autos tirados, bidones, derrumbes).

## Cómo está armado

Es HTML, CSS y JavaScript sin instalación ni compilado. Subir al repo es publicar: GitHub Pages lo actualiza en un minuto.

Mientras está en desarrollo, la página vuelve a pedir los archivos del juego en cada visita, así los cambios se ven apenas se publican. Si se suma un archivo nuevo en `src/`, hay que agregarlo a la lista que está al principio de `index.html`.

| Archivo | Qué hace |
| --- | --- |
| `index.html`, `style.css` | La página, la portada y los instrumentos en pantalla |
| `src/main.js` | Arma todo y corre el ciclo del juego |
| `src/config.js` | Los números para ajustar |
| `src/etapa1.js` | La etapa, tramo por tramo |
| `src/terrain.js` | Convierte los tramos en terreno: alturas, suelos, río, árboles |
| `src/vehicle.js` | La física de la camioneta |
| `src/reglas.js` | Las reglas: controles, meta, nafta, daño, rescates y formas de perder |
| `src/world.js`, `src/truck.js` | Dibujan el terreno y la camioneta |
| `src/camera.js`, `src/fx.js`, `src/audio.js` | Cámaras, huellas y barro que salta, sonido del motor |
| `src/hud.js`, `src/input.js`, `src/noise.js` | Instrumentos, mandos (teclado, pedales e inclinación), ruido para el relieve |
| `vendor/` | Three.js, la biblioteca 3D (licencia MIT) |
| `tools/` | Pruebas de la física sin gráficos (opcionales) |

## Probarlo en tu compu

Abrir `index.html` con doble clic no funciona: el navegador no carga los módulos desde un archivo suelto. Dos formas:

- En VS Code, con la extensión Live Server: clic derecho sobre `index.html` y "Open with Live Server".
- O subir los cambios y probar en la página publicada.

## Pruebas (opcional)

Con Node instalado, desde la carpeta del repo:

- `node tools/fisica.mjs`: aceleración, frenada, subidas y laterales en cada suelo.
- `node tools/piloto.mjs`: un piloto prolijo recorre la etapa a distintas velocidades: dice si llega y con cuánta nafta.
- `node tools/humano.mjs`: pilotos imperfectos (con teclas) para estimar la dificultad: cuántos llegan y por qué pierden.
- `node tools/deriva.mjs`: cuánto dobla y cuánto colea en cada suelo.

Sirven para revisar que la etapa se pueda terminar después de tocar `config.js` o `etapa1.js`.

## Plan

El plan de desarrollo está en [PLAN.md](PLAN.md).

## Créditos

Hecho con [Three.js](https://threejs.org/) (MIT). Tipografía [Barlow](https://fonts.google.com/specimen/Barlow) (OFL).

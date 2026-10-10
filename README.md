# Shakedown

Rally diario. Cada medianoche hay una pista nueva, la misma para todos, y una sola pasada oficial. Como el Wordle, pero con autos de rally.

**Jugar:** https://juanmcompa.github.io/shakedown/

El resultado se comparte así, con un link que lleva tu pasada:

```
Shakedown #42 🌧️🌲 ⏱️ 01:42:85 🟩 🟩 🟨 🟥 🟩 🏁
```

## La historia

Un club clandestino de puristas del rally, cansados de los circuitos cerrados, busca caminos olvidados. Cada medianoche, el organizador anónimo publica en un foro cerrado las coordenadas y las notas del copiloto del desafío del día: un sendero forestal embarrado, una ruta rural castigada por la lluvia o un paso de montaña de ripio.

No hay vueltas de reconocimiento. Sos vos, tu lectura del terreno y un auto noventero contra el cronómetro: una Vitara del 92 levantada ("La Vitarita") o un Ka con chapón cubrecárter ("El Kacito").

Hay una sola pasada oficial antes de que caigan las autoridades y clausuren el trazado. Al final del día los tiempos se comparan en la tabla del club.

## Cómo es

- **La pista sale de la fecha.** El número del día genera todo: el recorrido, el lugar (bosque, campo o montaña), el clima (seco, lluvia, niebla o atardecer) y las notas del copiloto. La #1 es la del 10 de octubre de 2026. El día cambia a la medianoche de Argentina.
- **Pasadas cortas.** Entre dos y tres minutos, en cinco sectores.
- **Una pasada oficial por día.** Después se puede practicar todo lo que se quiera, pero no cuenta para la tabla.
- **Rally puro.** No hay nafta ni rescates. Si te salís o volcás, volvés al camino con 8 segundos de recargo. Si rompés el auto, es abandono.
- **Los cuadraditos** comparan cada sector contra un tiempo de referencia: 🟩 hasta 1,3 veces la referencia, 🟨 hasta 1,6 veces, 🟥 más que eso. Si hubo que volver al camino en el sector, es 🟥.
- **Pistas pasadas.** Se pueden correr las de los últimos 60 días, como práctica.

## El club: correr contra amigos

No hay servidor. La tabla se arma en cada aparato con los links que se abren.

- Al terminar, poné tu nombre y compartí. En la compu se copia el mensaje con el link; en el celular se abre el menú de compartir.
- El link lleva tu pasada completa. Quien lo abre te ve en su tabla y **corre su pasada oficial contra tu fantasma**.
- Sin link de nadie, la oficial se corre solo. En las prácticas, el fantasma es tu mejor pasada.
- En la tabla, el botón del fantasma elige contra quién corrés.
- El link también lleva los tiempos que ya conocés, así la tabla se va completando entre todos.

## Cómo se juega

| Tecla | Qué hace |
| --- | --- |
| `W` `A` `S` `D` o flechas | Acelerar, doblar, frenar y marcha atrás |
| `Espacio` | Freno de mano |
| `R` | Volver al camino (suma 8 segundos) |
| `C` | Cámara: aérea, de atrás o desde arriba |
| `M` / `V` | Sonido / voz del copiloto |
| `Enter` | Largar |
| `Esc` | Dejar una práctica |

En el celular los botones son íconos y muestran su estado:

- **Inclinar el celu** para doblar. En iPhone pide permiso para usar el sensor. Si el sensor no responde, aparecen flechas.
- **Pedales:** el derecho acelera, el izquierdo frena y da marcha atrás (aparece una R). Pisados se llenan de color.
- **Freno de mano:** arriba del freno. Se pone amarillo mientras está apretado.
- **Cámara:** el ícono es el auto visto como lo ves, y tres puntitos marcan cuál de las tres está puesta.
- **Sonido y voz del copiloto:** apagados se ven tenues y tachados.
- **Volver al camino:** lleva el "+8" de lo que cuesta. Titila en amarillo cuando el auto quedó trabado.

Las notas del copiloto aparecen arriba y se escuchan. Los números van del 1 (curva muy cerrada) al 6 (casi recta). H es una horquilla.

## Qué tocar para cambiar el juego

| Para cambiar | Archivo |
| --- | --- |
| Cómo se maneja cada auto, los suelos, las cámaras, el recargo y los cuadraditos | `src/config.js` |
| Cómo se arman las pistas: biomas, climas, tipos de tramo, nombres de lugares | `src/generador.js` |
| Qué día es la pista #1 | `src/dia.js` |
| Los colores de todo (cuánto se apagan, el tono polvoriento) | `PALETA`, al principio de `src/pixel.js` |
| La luz y la bruma de cada clima | `LUCES` en `src/world.js` y `REVELADOS` en `src/post.js` |
| Los dibujos de los pisos, árboles y carteles | `src/arte.js` |
| Los dibujos planos: público, plantas, vacas, fogones | `src/sprites.js` |
| Los autos: forma, pintura y números | `src/autos.js` |
| Los íconos de los botones y de las notas | `src/iconos.js` |
| Los textos de la portada y la ayuda | `src/menu.js` |

El juego no usa archivos de imagen: todo se pinta con código, de a píxeles, cuando arranca. Un píxel del mundo mide 25 cm.

## Cómo está armado

Es HTML, CSS y JavaScript sin instalación ni compilado. Subir al repo es publicar: GitHub Pages lo actualiza en un minuto.

Mientras está en desarrollo, la página vuelve a pedir los archivos del juego en cada visita, así los cambios se ven apenas se publican. Si se suma un archivo nuevo en `src/`, hay que agregarlo a la lista que está al principio de `index.html`.

| Archivo | Qué hace |
| --- | --- |
| `index.html`, `style.css` | La página: portada, tablero, botones y paneles |
| `vista-previa.jpg` | La imagen que muestra WhatsApp cuando se pega el link |
| `src/main.js` | Arma todo y corre el ciclo del juego |
| `src/config.js` | Los números para ajustar |
| `src/dia.js`, `src/generador.js` | El calendario y el generador: de un número de día sale una pista |
| `src/terrain.js` | Convierte la pista en terreno: alturas, suelos, agua, árboles, público |
| `src/referencia.js` | Calcula la trazada y el tiempo de referencia de cada sector |
| `src/vehicle.js` | La física del auto |
| `src/reglas.js` | Cuenta regresiva, sectores, recargos, daño y abandono |
| `src/copiloto.js` | Las notas y la voz que las canta |
| `src/fantasma.js`, `src/club.js` | Graban la pasada y la meten en un link; lo que se guarda en el aparato (tu pasada, la tabla, tus gustos) |
| `src/menu.js`, `src/hud.js`, `src/iconos.js` | Portada, paneles y resultado; el tablero mientras se corre; los íconos |
| `src/world.js`, `src/flora.js`, `src/utileria.js`, `src/publico.js`, `src/clima.js` | Dibujan el terreno, la vegetación, los arcos y carteles, el público, la lluvia y los faros |
| `src/autos.js` | Los modelos de los autos y el fantasma |
| `src/material.js`, `src/pixel.js`, `src/arte.js`, `src/sprites.js` | El estilo: materiales, herramientas para pintar de a píxeles, y los dibujos |
| `src/post.js` | El "revelado": desenfoque de maqueta, brillos y ajuste de color. Se apaga solo si el aparato no da |
| `src/huellas.js`, `src/fx.js` | Las huellas en el piso y lo que salta de las ruedas |
| `src/camera.js`, `src/audio.js`, `src/input.js`, `src/noise.js` | Cámaras, sonido del motor, mandos y ruido para el relieve |
| `vendor/` | Three.js (la biblioteca 3D) y las tipografías |
| `tools/` | Pruebas sin gráficos (opcionales) |

## Probarlo en tu compu

Abrir `index.html` con doble clic no funciona: el navegador no carga los módulos desde un archivo suelto. Dos formas:

- En VS Code, con la extensión Live Server: clic derecho sobre `index.html` y "Open with Live Server".
- O subir los cambios y probar en la página publicada.

Direcciones útiles para probar:

- `?p=3` abre la pista #3, si ya pasó. Con `?p=6&futuro` se abre cualquiera, aunque todavía no haya llegado su día (como práctica).
- `?simple` saca el desenfoque y los brillos.

## Pruebas (opcional)

Con Node instalado, desde la carpeta del repo:

- `node tools/piloto.mjs 1 12`: cinco pilotos de distinto nivel corren las pistas 1 a 12 con cada auto. Dice si llegan, en cuánto, y dónde se salen.
- `node tools/fisica.mjs`: aceleración, frenada, curvas y subidas en cada suelo.
- `node tools/maniobras.mjs`: qué tan fácil se descontrola cada auto con volantazos.

Sirven para revisar que las pistas se puedan terminar después de tocar `config.js` o `generador.js`.

## Plan

El plan de desarrollo está en [PLAN.md](PLAN.md).

## Créditos

Hecho con [Three.js](https://threejs.org/) (licencia MIT). Tipografías [Barlow y Barlow Condensed](https://github.com/jpt/barlow) (licencia OFL), incluidas en `vendor/fuentes`.

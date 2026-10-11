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
- **Circuitos fijos.** Además de la pista del día hay cuatro recorridos que no cambian nunca, para correr las veces que se quiera. Queda guardado el mejor tiempo de cada uno y se comparte igual que el del día. Uno es una vuelta cerrada para practicar: no tiene llegada, se dan las vueltas que se quiera.
- **Ayuda de manejo, para arrancar.** Se prende en la configuración: el auto frena solo antes de las curvas y se cruza menos. Es más fácil y más lento. En la tabla, esos tiempos llevan un salvavidas. Después de una pasada complicada, el juego la ofrece.
- **Sponsors de mentira.** Las pistas llevan publicidad, como un rally de verdad: FPY, CAC y Mercado Ladri. Son solo de adorno y se cambian tocando una lista (ver "Los sponsors").

## Los circuitos

Se abren con el botón de circuitos de la portada.

| Circuito | Cómo es |
| --- | --- |
| ⛰️ **Subida a Mina Vieja** | 1,2 km de montaña, siempre para arriba. Angosta, con siete horquillas, tres puentes de madera y tramos de lajas que hay que pasar despacio. No hay velocidad: es técnica. Donde el camino se asoma al vacío hay una pirca que frena al auto en vez de dejarlo caer. |
| 🦅 **Bajada del Portezuelo** | 2,5 km de ripio suelto, ancha y siempre para abajo: 325 metros de desnivel. Es la más rápida del juego: rectas largas donde se pasan los 100 km/h, eses para llevar el auto cruzado, un salto y cuatro curvas cerradas a las que hay que llegar frenado (en bajada cuesta más). |
| 🏘️ **Callejero de Villa Cañada** | 1,1 km entre las casas de un pueblo: esquinas de 90 grados, calles de adoquines, la vuelta a la plaza, un pasaje angosto y una avenida con autos estacionados, un colectivo, volquetes, conos y un lomo de burro. |
| 🔁 **Vuelta del Club** | 1,6 km en vuelta cerrada, para practicar. Sale por la ruta, cruza un pueblo (una esquina de 90, adoquines, un lomo de burro y conos), se mete en el bosque (un vado y un barrial), trepa al cerro (dos horquillas, una cornisa de lajas con pirca y un puente) y baja rápido, con un salto, de vuelta al campo. |

Cada circuito tiene su tiempo de referencia y sus cinco cuadraditos, como la pista del día. El mensaje para compartir sale así:

```
Shakedown · Urbano 🏘️ ⏱️ 01:30:42 🟩 🟩 🟩 🟩 🟩 🏁
```

**La Vuelta del Club no tiene llegada.** Se larga unos metros antes de la raya y el reloj arranca al cruzarla. Cada vez que se la vuelve a cruzar se cierra una vuelta: aparece su tiempo, el reloj y los cuadraditos empiezan de nuevo y el auto queda arreglado. La mejor vuelta queda guardada y pasa a ser el fantasma contra el que se corre. Para terminar se sale con `Esc` (o con la X en el celular) y se ve el resultado de la mejor vuelta, que es la que se comparte.

## Los sponsors

Las pistas llevan publicidad en cinco lugares: banderas a los costados de la largada y de la llegada, chapas apoyadas en la cinta del público, cartelones al costado del camino, pórticos en las calles del pueblo y una tira de marcas arriba de cada arco.

Las marcas son un chiste: **FPY**, **CAC** y **Mercado Ladri**. El parecido con marcas de verdad es a propósito, y los nombres están cambiados también a propósito.

- **Es solo dibujo.** Nada de esto se choca ni cambia la pista. Se puede sumar, sacar o cambiar un sponsor sin tocar los tiempos de nadie y sin subir la `VERSION`. Si el auto se lleva puesta una chapa o un cartelón, queda tirado en el piso; al auto no le pasa nada.
- **Se reparten solos.** Cada pista sortea dónde van, igual para todos. Los cartelones aparecen solo donde hay lugar: lejos de los árboles, del público y del agua. Por eso en el bosque hay menos que en el campo.
- **La lista** está en `src/sponsors.js`. Cada sponsor lleva un nombre, dos colores y hasta tres dibujos de pocos píxeles: el cartel grande, la chapa y la bandera. Los dibujos se escriben renglón por renglón, con un punto para el fondo y un numeral para la tinta.
- **`peso`** dice cuánto aparece cada uno: con peso 2 sale el doble que los demás.
- **Con una imagen.** En vez de escribir los renglones se puede dibujar un PNG chiquito, guardarlo en una carpeta del juego (por ejemplo `sponsors/`) y nombrarlo en `imagen`. Medidas: cartel 52 × 16 píxeles, chapa 21 × 7 y bandera 7 × 25. Lo transparente deja ver el color de fondo. Si la imagen es más grande, se achica.
- **Sin dibujo.** Al soporte que le falte el dibujo se le escribe el nombre con las letras del juego. Para probar un sponsor nuevo alcanza con el nombre y los dos colores. En la chapa entran cinco letras y en la bandera tres: si el nombre es más largo, conviene darle un `corto`.

Un píxel de estos dibujos mide 12,5 cm, igual que los de los autos.

## El club: correr contra amigos

No hay servidor. La tabla se arma en cada aparato con los links que se abren.

- Al terminar, poné tu nombre y compartí. En la compu se copia el mensaje con el link; en el celular se abre el menú de compartir.
- El link lleva tu pasada completa (por eso es largo: unas 800 letras). Quien lo abre te ve en su tabla y **corre su pasada oficial contra tu fantasma**.
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
- **La portada entra entera en la pantalla.** Abajo quedan fijos el botón de largar y las secciones (tabla, circuitos, pistas pasadas, ayuda y configuración). Si la pista tiene mucho para mostrar, se corre con el dedo solo la parte de arriba, y una flechita avisa que hay más.
- **Las cámaras se acomodan a la pantalla.** En el celular, la aérea va más cerca, la de atrás más lejos, y el auto queda siempre por arriba de los pedales, para que no lo tapen los pulgares.
- **Mientras carga** se ve la marca con una barra y lo que está haciendo. Si no puede cargar, lo dice y ofrece probar de nuevo.

Las notas del copiloto aparecen arriba y se escuchan. Los números van del 1 (curva muy cerrada) al 6 (casi recta). H es una horquilla y 90, una esquina. También avisa los puentes, las lajas, los adoquines y los lomos de burro.

## Configuración

La tuerca de la portada abre la configuración. Lo que se elige queda guardado en el aparato.

- **Ayuda de manejo:** sí o no.
- **Distancia de la cámara:** más cerca o más lejos. Mientras se mueve la barra, el panel se corre para ver cómo queda.
- **Doblar** (celular): inclinando o con flechas en pantalla.
- **Sensibilidad al inclinar** (celular): cuánto hay que inclinar para llevar el volante a fondo. Se prueba ahí mismo: un punto amarillo muestra el volante.
- **Pedales** (celular): chicos, normales o grandes.
- **Desenfoque y brillos:** sin ellos el juego anda más liviano.
- **Sonido** y **voz del copiloto.**

## Qué tocar para cambiar el juego

| Para cambiar | Archivo |
| --- | --- |
| Cómo se maneja cada auto, los suelos, las cámaras, el recargo y los cuadraditos | `src/config.js` |
| Cuánto ayuda la ayuda de manejo (`AYUDA`) y con qué configuración arranca el juego (`GUSTOS`) | `src/config.js` |
| Cómo se arman las pistas: biomas, climas, tipos de tramo, nombres de lugares | `src/generador.js` (y subir `VERSION` ahí mismo: ver abajo) |
| El recorrido de cada circuito fijo: sus rectas, curvas, puentes, casas y cosas en la calle, y por qué ambiente pasa cada pedazo | `src/circuitos.js` (cada circuito es una lista que se lee de arriba hacia abajo; al cambiar uno hay que subirle su `version`) |
| Las medidas de los edificios y de las cosas de la calle, y cuáles se caen al chocarlas | `src/edificios.js` |
| Los dibujos de las casas, los colectivos, los faroles, las barandas y las pircas | `src/pueblo.js` |
| Los sponsors: nombres, colores, dibujos y cuánto aparece cada uno | `src/sponsors.js` |
| Dónde va la publicidad, cuánta hay y qué tan vivos son sus colores (`VIVO`) | `src/publicidad.js` |
| Qué día es la pista #1 | `src/dia.js` |
| Los colores de todo (cuánto se apagan, el tono polvoriento) | `PALETA`, al principio de `src/pixel.js` |
| La luz y la bruma de cada clima | `LUCES` en `src/world.js` y `REVELADOS` en `src/post.js` |
| Los dibujos de los pisos, árboles y carteles | `src/arte.js` |
| Los dibujos planos: público, plantas, vacas, fogones | `src/sprites.js` |
| Los autos: forma, pintura y números | `src/autos.js` |
| Los íconos de los botones y de las notas | `src/iconos.js` |
| Los textos de la portada y la ayuda | `src/menu.js` |

El juego no usa archivos de imagen: todo se pinta con código, de a píxeles, cuando arranca. Un píxel del mundo mide 25 cm. La única excepción posible son los sponsors, que pueden traer su PNG.

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
| `src/circuitos.js` | Los circuitos fijos, escritos a mano |
| `src/terrain.js` | Convierte la pista en terreno: alturas, suelos, agua, puentes, árboles, público, y dónde va cada casa, cada pirca y cada cosa de la calle |
| `src/edificios.js`, `src/pueblo.js` | Las medidas de los edificios y de las cosas de la calle, y cómo se dibujan |
| `src/referencia.js` | Calcula la trazada y el tiempo de referencia de cada sector |
| `src/vehicle.js` | La física del auto |
| `src/reglas.js` | Cuenta regresiva, sectores, recargos, daño y abandono; y las vueltas, en el circuito cerrado |
| `src/ayuda.js` | La ayuda de manejo: frena sola antes de las curvas |
| `src/copiloto.js` | Las notas y la voz que las canta |
| `src/fantasma.js`, `src/club.js` | Graban la pasada y la meten en un link; lo que se guarda en el aparato (tu pasada, la tabla, tus gustos) |
| `src/menu.js`, `src/hud.js`, `src/iconos.js` | Portada, paneles y resultado; el tablero mientras se corre; los íconos |
| `src/world.js`, `src/flora.js`, `src/utileria.js`, `src/publico.js`, `src/clima.js` | Dibujan el terreno, la vegetación, los arcos y carteles, el público, la lluvia y los faros |
| `src/sponsors.js`, `src/publicidad.js` | La lista de sponsors, y dónde va y cómo se dibuja su publicidad |
| `src/autos.js` | Los modelos de los autos y el fantasma |
| `src/material.js`, `src/pixel.js`, `src/arte.js`, `src/sprites.js` | El estilo: materiales, herramientas para pintar de a píxeles, y los dibujos |
| `src/post.js` | El "revelado": desenfoque de maqueta, brillos y ajuste de color. Se apaga solo si el aparato no da |
| `src/huellas.js`, `src/fx.js` | Las huellas en el piso y la pintura de las calles; el polvo que queda flotando y el barro y el agua que saltan de las ruedas |
| `src/camera.js`, `src/audio.js`, `src/input.js`, `src/noise.js` | Cámaras, sonido del motor, mandos y ruido para el relieve |
| `vendor/` | Three.js (la biblioteca 3D) y las tipografías |
| `tools/` | Pruebas sin gráficos (opcionales) |

Los archivos de `src/` se piden entre sí por su camino (`./config.js`, `../vendor/three.module.js`), sin nombres sueltos. Así el juego carga también en los navegadores que no entienden el mapa de importación de `index.html` (los iPhone con iOS 15 y 16). Ese mapa solo sirve para que los cambios se vean apenas se publican.

## Probarlo en tu compu

Abrir `index.html` con doble clic no funciona: el navegador no carga los módulos desde un archivo suelto. Dos formas:

- En VS Code, con la extensión Live Server: clic derecho sobre `index.html` y "Open with Live Server".
- O subir los cambios y probar en la página publicada.

Direcciones útiles para probar:

- `?p=3` abre la pista #3, si ya pasó. Con `?p=6&futuro` se abre cualquiera, aunque todavía no haya llegado su día (como práctica).
- `?c=subida`, `?c=bajada`, `?c=urbano` y `?c=practica` abren los circuitos.
- `?simple` saca el desenfoque y los brillos.

## Pruebas (opcional)

Con Node instalado, desde la carpeta del repo:

- `node tools/piloto.mjs 1 12`: cinco pilotos de distinto nivel corren las pistas 1 a 12 con cada auto. Dice si llegan, en cuánto, y dónde se salen.
- `node tools/piloto.mjs 16001 4`: lo mismo en los cuatro circuitos (sus números de pista van del 16001 al 16004). En la vuelta cerrada cada piloto da tres vueltas y cuenta la mejor.
- `SOLO=novato,ayudado node tools/piloto.mjs 1 8`: un piloto que no suelta nunca el acelerador, sin y con la ayuda de manejo. Sirve para ver cuánto ayuda.
- `node tools/fisica.mjs`: aceleración, frenada, curvas y subidas en cada suelo.
- `node tools/maniobras.mjs`: qué tan fácil se descontrola cada auto con volantazos.

Sirven para revisar que las pistas se puedan terminar después de tocar `config.js`, `generador.js` o `circuitos.js`.

**Si un cambio hace que la pista de un día sea otra** (tocar el generador o cómo se arma el terreno), hay que subir el número `VERSION` de `src/generador.js`. Con eso, lo que cada uno tenía guardado de la versión anterior se descarta solo (esos tiempos y fantasmas eran de otro camino) y la oficial del día se puede correr de nuevo. Los circuitos llevan cada uno su `version`, en `src/circuitos.js`: al cambiar el recorrido de uno se sube la suya, y lo guardado de los demás no se toca.

## Plan

El plan de desarrollo está en [PLAN.md](PLAN.md).

## Créditos

Hecho con [Three.js](https://threejs.org/) (licencia MIT). Tipografías [Barlow y Barlow Condensed](https://github.com/jpt/barlow) (licencia OFL), incluidas en `vendor/fuentes`.

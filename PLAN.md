# Plan de Encajados

## La idea

Un juego de manejo 4x4 simple y difícil. No es una carrera: es llegar. Etapas cortas de A a B por caminos imposibles, donde la gracia está en elegir por dónde pasar y cuánto envión llevar.

Se ve desde arriba, en 3D, y se maneja con cuatro teclas.

## Qué lo tiene que hacer divertido

Esto es lo que hay que lograr antes que cualquier otra cosa. Si alguno de estos puntos no se siente bien al jugar, se ajusta eso primero.

1. **El barro frena y hace patinar.** Despacio te encajás, rápido perdés el control.
2. **Las subidas piden envión y agarre.** Las bajadas, frenar a tiempo.
3. **Los laterales y las cornisas te llevan hacia el vacío.**
4. **Fallar es rápido y reintentar es inmediato.** `R` y volvés al último control.

Se parece a SnowRunner en lo que pide (pensar el agarre) y a Art of Rally en cómo se ve (desde arriba, estilizado).

Fallar cuesta, de menor a mayor:

- **Encajarse o no subir:** se pierde tiempo y nafta, pero se sale solo (marcha atrás y envión).
- **Golpear:** suma daño.
- **Volcar o desbarrancarse:** gasta uno de los tres rescates y se vuelve al último control.

Y se pierde la etapa por tres cosas: quedarse sin nafta, romper la camioneta o necesitar un rescate cuando ya no quedan.

## Decisiones tomadas

- **Vista aérea en 3D**, con tres cámaras: aérea que gira con la camioneta, aérea fija y una cercana.
- **Se juega en compu y en celular.** En el celular se dobla inclinándolo y se acelera y frena con dos pedales en pantalla.
- **Física propia y simple** en vez de un motor de física: cuatro ruedas con suspensión y agarre según el suelo. Son pocos números, todos en `src/config.js`.
- **Las etapas se escriben como una lista de tramos** (`src/etapa1.js`): largo, giro, pendiente, ancho, suelo. El terreno se arma solo alrededor.
- **Sin instalación ni compilado.** HTML y JavaScript, publicado con GitHub Pages.
- **Lenguaje visual:** bloques con dibujos de pocos píxeles, pintados con código. Un píxel del mundo mide 25 cm: el piso, las sombras, el agua y las huellas están hechos de esos píxeles. Los instrumentos son carteles viales, amarillos y negros.

## Etapas de desarrollo

### 1. Prototipo de manejo (hecho, versión 0.1)

- [x] Camioneta con suspensión, tracción en las cuatro ruedas y freno de mano
- [x] Ocho suelos con distinto agarre: asfalto, ripio, tierra, roca, pasto, barro, pantano, agua
- [x] Una etapa completa de 975 m con cuatro controles y meta
- [x] Cronómetro, medallas y mejor tiempo guardado
- [x] Instrumentos: velocidad, suelo, agarre por rueda, inclinómetro, perfil de la etapa
- [x] Huellas, barro y agua que saltan, sonido de motor
- [x] Mandos para celular: inclinar para doblar y pedales en pantalla
- [x] Travesía: nafta, reductora alta y baja, daño, tres rescates y tres formas de perder
- [x] Piezas nuevas: derrumbe que arrastra hacia el borde, autos tirados, bidones de nafta
- [x] Fantasmas y ranking por link, sin servidor: se comparte la marca y el que la abre corre contra ella
- [x] Estilo de bloques y píxeles: camioneta, autos tirados, árboles, piedras, paredones, agua y marca de la portada
- [x] Huellas que quedan marcadas en el piso durante toda la vuelta
- [ ] **Probar los mandos en celulares de verdad.** La inclinación está probada con un sensor simulado, no con un teléfono en la mano.
- [ ] **Probarlo a mano y ajustar el manejo.** Hasta ahora está calibrado con simulaciones, no manejando.

### 2. Sensación

- [ ] Ajustar agarre, potencia y cámara según cómo se sienta
- [ ] Barro que se pega a la camioneta y la va ensuciando
- [ ] Sacudón de cámara en los golpes
- [ ] Sonidos de golpe, de agua y de derrape

### 3. Contenido

- [ ] Tres a cinco etapas con temas distintos: cornisa de montaña, ripio de puna, selva, salar
- [ ] Menú para elegir etapa
- [ ] Piezas nuevas para las etapas: puentes rotos, troncos, piedras sueltas, niebla
- [ ] Poder pintar una etapa como imagen (alturas y suelos) además de escribirla por tramos

### 4. Progresión

- [ ] Vehículos desbloqueables con distinto comportamiento: liviano y ágil, pesado y con fuerza
- [ ] Mejoras: cubiertas de barro, bloqueo de diferencial, malacate
- [ ] Ranking online único para todos (necesita un servicio aparte donde guardar las marcas)

### 5. Extras

- [ ] Soporte de joystick
- [ ] Lluvia que cambia el agarre en medio de la etapa
- [ ] Modo travesía: una ruta larga con combustible y daños

## Riesgos

- **Que la física no se sienta bien.** Es el principal. Por eso la etapa 1 va primero y sola.
- **Rendimiento en compus sin placa de video y en celulares viejos.** El terreno se dibuja por pedazos y hay pocas luces. Si el juego anda a menos de 30 cuadros por segundo, baja solo la nitidez. Falta probarlo en celulares de verdad.
- **Que el alcance crezca.** El núcleo son cuatro teclas y una etapa que se disfruta. Todo lo demás se suma solo si eso funciona.

## Cómo seguir trabajando

1. Jugar y anotar qué se siente mal (muy fácil, muy difícil, resbala poco, dobla mucho).
2. Ajustar `src/config.js` o `src/etapa1.js`.
3. Correr `node tools/piloto.mjs` para ver que la etapa se siga pudiendo terminar.
4. Subir los cambios. Pages publica solo.

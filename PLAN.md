# Plan de Shakedown

## La idea

Un rally diario: como el Wordle, pero con carreras de autos. Cada medianoche hay una pista nueva, igual para todos, que se corre en dos o tres minutos. Hay una sola pasada oficial y el resultado se comparte en un mensaje con cuadraditos.

Lo social es el centro: el link que compartís lleva tu pasada, y quien lo abre corre su oficial contra tu fantasma.

## Decisiones tomadas

- **La fecha genera la pista.** No hay pistas escritas a mano: del número del día salen el recorrido, el bioma, el clima y las notas. La #1 es la del 10 de octubre de 2026 y el día cambia a la medianoche de Argentina.
- **Una pasada oficial por día.** Después, práctica libre. Las pistas pasadas se pueden practicar.
- **Rally puro.** Sin nafta ni rescates. Salirse o volcar: volver al camino con 8 segundos. Romper el auto: abandono.
- **Cinco sectores, cinco cuadraditos.** El color sale de comparar el sector con un tiempo de referencia (verde hasta 1,3 veces, amarillo hasta 1,6). Volver al camino pone el sector en rojo.
- **Tabla del club sin servidor.** Se arma con los links de WhatsApp que se abren. Con un link, la oficial se corre contra el fantasma de quien lo mandó.
- **El fantasma es fiel.** El link es largo (unas 1500 letras) porque lleva la pasada completa, con los saltos.
- **Dos autos noventosos:** La Vitarita (4x4, alta) y El Kacito (tracción delantera, bajo). Parejos en tiempo, distintos de manejar.
- **Tres cámaras:** aérea, de atrás y desde arriba (casi vertical: 78 grados, para que los dibujos planos se vean enteros).
- **Menos palabras, más íconos.** En el celular todos los botones son íconos y muestran su estado.
- **Lenguaje visual:** bloques con dibujos de pocos píxeles (un píxel = 25 cm), público y plantas como dibujos planos que miran a la cámara, colores apagados y polvorientos, y un "revelado" de maqueta (desenfoque, brillos, bruma cálida). Los instrumentos son carteles viales, amarillos y negros.
- **Sin instalación ni compilado.** HTML y JavaScript, publicado con GitHub Pages en `/shakedown`.

## Hecho

- [x] Generador de pistas por fecha: tres biomas, cuatro climas, tres caracteres (técnica, mixta, rápida)
- [x] Reglas de rally: cuenta regresiva, sectores, recargo por volver al camino, daño y abandono
- [x] Tiempo de referencia por sector, calculado con una trazada ideal
- [x] Dos autos con manejo propio, probados con pilotos automáticos de cinco niveles en las pistas 1 a 12
- [x] Notas del copiloto: en la portada, en pantalla y con voz
- [x] Pasada oficial única, prácticas, pistas pasadas
- [x] Mensaje para compartir, link con fantasma y tabla del club
- [x] Público, autos estacionados, arcos, cintas y carteles
- [x] Ambientes: bosque (el más trabajado), campo con sembrados y molinos, montaña con cornisas
- [x] Clima: lluvia, niebla, atardecer con fogones, bengalas y faros
- [x] Paleta apagada y revelado de maqueta, que se apagan solos si el aparato no da
- [x] Tres cámaras y botones con íconos que muestran su estado

## Lo que sigue

1. **Probarlo en celulares y compus de verdad.** Todo está probado en un navegador sin placa de video: falta ver cómo rinde y cómo se siente con el teléfono en la mano.
2. **Ajustar el manejo jugando.** Está calibrado con pilotos automáticos, no con las manos.
3. **Pulir campo y montaña** al nivel del bosque. Revisar la niebla y el reflejo del agua.
4. **Colores y texturas:** seguir acercándolos a las referencias (pisos calmos, bruma cálida, sombras lilas).
5. **Autos dibujados en la portada**, en vez de emojis.
6. **Sonido:** golpes, agua, derrape y público.
7. **Más piezas para las pistas:** puentes, tranqueras, postes de luz, ranchos.

## Ideas para más adelante

- Racha de días corridos y estadísticas propias, como en el Wordle
- Más autos, desbloqueables
- Tabla común para todos (necesita un servicio aparte donde guardar los tiempos)
- Soporte de joystick

## Riesgos

- **Rendimiento en celulares.** Hay más cosas en pantalla que antes (dibujos planos, revelado, lluvia). El juego baja solo la calidad si anda a menos de 30 cuadros por segundo, pero falta medirlo en aparatos reales.
- **Que una pista generada salga injusta.** El generador se prueba con pilotos automáticos, pero cada día es una pista nueva.
- **Tocar el generador cambia todas las pistas**, también la de hoy y las pasadas: los fantasmas ya guardados dejan de coincidir con el camino. Mientras se desarrolla no importa. Cuando haya gente jugando, los cambios de pistas, de terreno o de manejo tienen que entrar a la medianoche, o el generador tiene que llevar un número de versión por fecha.
- **Que el link sea demasiado largo para algún mensajero.** WhatsApp lo acepta; falta probar otros.

## Cómo seguir trabajando

1. Jugar y anotar qué se siente mal.
2. Ajustar `src/config.js` (manejo) o `src/generador.js` (pistas).
3. Correr `node tools/piloto.mjs 1 12` para ver que las pistas se sigan pudiendo terminar.
4. Subir los cambios. Pages publica solo.

# Plan de Shakedown

## La idea

Un rally diario: como el Wordle, pero con carreras de autos. Cada medianoche hay una pista nueva, igual para todos, que se corre en dos o tres minutos. Hay una sola pasada oficial y el resultado se comparte en un mensaje con cuadraditos.

Lo social es el centro: el link que compartís lleva tu pasada, y quien lo abre corre su oficial contra tu fantasma.

## Decisiones tomadas

- **La fecha genera la pista.** La del día no está escrita a mano: del número del día salen el recorrido, el bioma, el clima y las notas. La #1 es la del 10 de octubre de 2026 y el día cambia a la medianoche de Argentina.
- **Circuitos fijos, para seguir corriendo.** Aparte de la del día hay recorridos escritos a mano que no cambian: una subida de montaña (técnica), una bajada (velocidad), un callejero por un pueblo (esquinas y cosas para esquivar) y una vuelta cerrada para practicar. Se corren las veces que se quiera, queda el mejor tiempo y se comparten como la del día. No tienen pasada oficial.
- **La práctica es una vuelta cerrada y sin apuro.** Pasa por los tres ambientes y por casi todas las piezas (pueblo, vado, barro, horquillas, cornisa, puente, salto). No tiene llegada ni límite de tiempo: se dan las vueltas que se quiera, en cada una el auto arranca arreglado, y la mejor queda de fantasma. Romper el auto dentro de una vuelta sigue siendo abandono.
- **Una pista puede pasar por varios ambientes.** Cada pedazo del recorrido dice el suyo; el pasto, los árboles, los yuyos y el relieve de cada lugar salen del camino que tiene más cerca, y el límite entre uno y otro queda desparejo. Por ahora lo usa solo la vuelta de práctica.
- **En la cornisa, pirca.** Donde el camino se asoma al vacío en una curva o sobre lajas hay un murito de piedra que frena al auto, y antes del vacío queda una banquina angosta. Caerse sigue siendo posible en las rectas, pero no es lo que pasa siempre. Los puentes llevan barandas que se abren en las puntas, para que arrimen al auto en vez de pararlo en seco.
- **Rozar frena.** Pasar raspando una pared, una pirca o una piedra saca velocidad: apoyarse en un paredón no es gratis.
- **Una pasada oficial por día.** Después, práctica libre. Las pistas pasadas se pueden practicar.
- **Rally puro.** Sin nafta ni rescates. Salirse o volcar: volver al camino con 8 segundos. Romper el auto: abandono.
- **Cinco sectores, cinco cuadraditos.** El color sale de comparar el sector con un tiempo de referencia (verde hasta 1,3 veces, amarillo hasta 1,6). Volver al camino pone el sector en rojo.
- **Con un link, la oficial se corre contra el fantasma de quien lo mandó.** Y quien lo mandó queda en la tabla.
- **Clubes por invitación.** Un club es un grupo con tabla propia ("torneo" es lo mismo). Se arma con un nombre y se invita con un link, una sola vez. Un jugador puede estar en todos los que quiera, y su pasada oficial del día es una sola y vale para todos, también para los clubes a los que entra después. En la tabla se ve el nombre de cada uno con su tiempo, y quiénes faltan correr.
- **El servidor es un extra, nunca un requisito.** Guarda las pasadas (para que el link sea corto) y los clubes. Corre gratis en Cloudflare, se publica solo con cada Push y no pide cuentas a nadie: cada aparato tiene una llave al azar. Si no está o no contesta, el juego sigue con el link largo y la tabla armada con los links que se abren. Los links largos ya compartidos no se rompen nunca.
- **El link corto no pierde fidelidad.** El servidor guarda la pasada entera, la misma que antes viajaba en el link; lo único que se acorta es el link.
- **La primera vez, el equipo explica.** Seis de los diez personajes hablan en el tutorial, cada uno de lo suyo: Gaby (cómo se maneja), Leo (las notas), Julián (el reloj y la oficial), Sebastián (el daño), Gonza (volver al camino) y Paloma (la ayuda de manejo). Quedan para más adelante Pablo, Juanma, Moi y Rober.
- **El fantasma es fiel.** El link lleva la pasada completa, con los saltos y las salidas de pista. Para que no sea eterno, la pasada se guarda respecto del camino (cuánto avanzó y cuánto se corrió del medio) y comprimida: unas 800 letras, la mitad que al principio, con la misma precisión (10 cm).
- **Dos autos noventosos:** La Vitarita (4x4, alta) y El Kacito (tracción delantera, bajo). Parejos en tiempo, distintos de manejar.
- **En piso suelto el auto derrapa.** Manejando tranquilo va por donde se lo apunta; exigido, hay que llevarlo cruzado. Las ruedas de adelante se acomodan solas hacia donde va el auto, así se lo puede llevar de costado sin que se vaya en trompo. La cámara mira hacia donde va el auto, no hacia donde apunta.
- **Tres cámaras:** aérea, de atrás y desde arriba (casi vertical: 78 grados, para que los dibujos planos se vean enteros).
- **Menos palabras, más íconos.** En el celular todos los botones son íconos y muestran su estado.
- **En el celular, lo que se toca está siempre a la vista.** En la portada y en el resultado, los botones quedan fijos abajo: nadie tiene que adivinar que hay que bajar. Mientras se maneja, el auto queda por arriba de los pedales.
- **Nunca una pantalla a medio armar.** Mientras el juego carga se ve la marca, una barra y en qué anda; lo demás aparece cuando está listo. Si no puede cargar, lo dice.
- **Si no carga, dice por qué.** La pantalla de carga distingue un archivo que no bajó (y cuál), un error del programa (y dónde), un navegador viejo, un aparato sin gráficos 3D y una carga que tarda demasiado. Cada caso lleva su consejo y un código corto, para que alcance con una captura. El detalle completo se copia con un botón; no se manda solo a ningún lado.
- **Se avisa que está en desarrollo.** Mientras dure el Early Access lo dicen la largada de cada pasada (un cartel durante la cuenta regresiva), el último renglón de todo lo que se comparte y la vista previa del link. Los textos están en un solo lugar (`FIRMA`, en `src/config.js`): el día que salga la versión final se vacía el aviso.
- **Quién lo hace, solo en la portada.** "Desarrollado por Juan M. Comparini" va debajo de la marca, antes de largar. No en la largada ni en lo que se comparte.
- **Rally puro, pero con una mano para el que arranca.** La ayuda de manejo es optativa y está apagada de fábrica: lleva el auto por la trazada, frena antes de las curvas y hace que se cruce menos. El jugador acelera y corrige: si dobla con ganas para otro lado, manda él. Es más lenta que manejar bien (más o menos como un piloto del montón), así que no da ventaja; igual, esos tiempos van marcados en la tabla. Un piloto de prueba que no suelta nunca el acelerador rompe el auto en 7 de 8 pistas; con la ayuda llega en todas, incluso sin tocar el volante.
- **La ayuda no se tiene que escuchar.** En las rectas deja acelerar a fondo; antes de cada curva afloja el acelerador de a poco y frena lo justo. La primera versión cortaba y devolvía el acelerador más de una vez por segundo para no pasarse de velocidad, y el motor sonaba ahogado.
- **La trazada es optativa y no marca el tiempo.** Es una línea pintada en el camino, apagada de fábrica: por dónde pasar y, con el color, dónde frenar (verde, amarilla, roja). El rojo avisa con margen: no es la frenada de un piloto al límite, sino la de uno prolijo. No cambia el manejo, así que los tiempos hechos con trazada no llevan ninguna marca.
- **Lo que rompe el auto se tiene que ver venir.** Las piedras pegadas al camino llevan una antorcha roja. Es solo dibujo: las piedras son las mismas de siempre.
- **Lenguaje visual:** bloques con dibujos de pocos píxeles (un píxel = 25 cm), público y plantas como dibujos planos que miran a la cámara, colores apagados y polvorientos, y un "revelado" de maqueta (desenfoque, brillos, bruma cálida). Los instrumentos son carteles viales, amarillos y negros.
- **Publicidad en chiste, y solo de adorno.** Los sponsors son parodias de marcas conocidas, con el nombre cambiado (FPY, CAC, Mercado Ladri). Van en banderas, chapas contra la cinta del público, cartelones, pórticos y arcos. No se chocan ni cambian la pista: se reparten con un sorteo aparte, así se pueden cambiar sin tocar los tiempos de nadie ni subir la versión. Los soportes están pensados para que el día de mañana lleven sponsors de verdad: alcanza con cambiar la lista.
- **Pistas de la comunidad, armadas con íconos.** Cualquiera arma una pista en el creador eligiendo las notas una por una (curvas, rectas, cosas del camino y del costado), sin mapa: el camino sale solo y no se puede cruzar. Duran dos semanas, se corren como un circuito (sin oficial, queda el mejor tiempo), tienen su tabla y se comparten con un link. También se arman para un club: cada club hace sus propias pistas. Quien la armó la firma: su nombre va en la portada y en lo que se comparte (Pista «La Curva del Tero» por Juanma), no al largar. El servidor guarda solo la hoja de notas (unas 400 letras): el camino y el terreno los arma cada aparato.
- **Cinco pistas por persona.** Para ahorrar lugar, cada uno puede tener hasta cinco publicadas a la vez, y las puede borrar cuando quiera (con sus tiempos) para publicar otra.
- **El panel de circuitos, en este orden:** arriba de todo, crear una pista; después las oficiales (la de hoy y los circuitos fijos); al final, las de la comunidad, cada una con la marca de su club y quién la armó. Filas de dos renglones, para que todo entre en la pantalla del celular.
- **Sin instalación ni compilado.** HTML y JavaScript, publicado con GitHub Pages en `/shakedown`.
- **Ningún archivo se llama como un anuncio.** Los bloqueadores de publicidad frenan las direcciones con palabras como "publicidad", "sponsor" o "banner", y con un solo archivo frenado el juego no carga. Por eso los carteles de la pista están en `carteleria.js` y los sponsors en `parodias.js`.

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
- [x] Derrape en piso suelto, huellas marcadas y polvo que queda flotando sobre el camino
- [x] En el celular, el auto nunca queda tapado por los pedales
- [x] Link a la mitad de largo, y número de versión de las pistas (lo guardado de una versión anterior se descarta solo)
- [x] Configuración: ayuda de manejo, distancia de la cámara, sensibilidad al inclinar, doblar con flechas, tamaño de los pedales, efectos, sonido y voz
- [x] Tres circuitos fijos: Subida a Mina Vieja, Bajada del Portezuelo y Callejero de Villa Cañada
- [x] Vuelta del Club: circuito cerrado de práctica por campo, bosque y montaña, con vueltas, mejor vuelta y fantasma de la mejor
- [x] Piezas nuevas para armar pistas: puentes de madera con barandas, pircas, lajas, casas y edificios, veredas, calles cortadas con vallas y vecinos, faroles con cables, autos estacionados, colectivos, volquetes, conos, lomos de burro y calles pintadas
- [x] Publicidad en todas las pistas: tres sponsors en chiste en banderas, chapas, cartelones, pórticos y arcos; se cambian desde una lista y pueden traer su imagen; el auto los puede tirar
- [x] Links cortos y clubes por invitación, con un servidor chico (carpeta `servidor/`), probado en la compu con tres jugadores
- [x] Marca nueva: logo en la portada y en la carga, íconos para la pestaña y el celular, e imagen nueva para cuando se pega el link
- [x] Tutorial de la primera vez: al largar por primera vez en un aparato, el equipo (los personajes de Juanma) explica la pantalla de a una cosa, iluminándola. Se puede saltar, cerrar y volver a ver. Los diez personajes están en "El club"
- [x] Pasada de seguridad: el servidor solo le deja escribir al juego publicado y no guarda direcciones de internet; los nombres se limpian; lo que se sabe por un club no sale en los links de sus miembros; el juego publicado ya no trae los atajos de prueba; y los pedidos al servidor aguantan un aparato trabado
- [x] Servidor en línea en Cloudflare, conectado al repo: se publica solo con cada Push. Cada pedido hace un solo viaje a la base de datos (queda lejos de Argentina: un tercio de segundo por viaje)
- [x] El juego ya carga con bloqueador de publicidad: el archivo `publicidad.js` cambió de nombre (lo frenaban AdGuard y uBlock Origin en castellano, y el juego mostraba "No se pudo cargar"). Revisadas todas las direcciones del juego y todos los nombres de la página contra las listas de uBlock Origin, AdGuard, EasyList y EasyList en español
- [x] Cartel de Early Access en la largada de cada pasada, renglón de aviso en el resultado y en la invitación a un club, y título, descripción e imagen nuevos para la vista previa del link. La firma, solo en la portada
- [x] Códigos en la pantalla de "no se pudo cargar": qué falló, en qué paso y, si fue un archivo, cuál; consejo distinto para cada caso; botón para copiar el detalle; y aviso si la carga tarda más de 40 segundos
- [x] Creador de pistas de la comunidad: se arman nota por nota con íconos, sin mapa, con Leo avisando qué entra y qué no; se prueban como borrador y se publican por dos semanas, con link o para un club; tabla propia; cinco por persona, con tacho para borrar
- [x] Trazada para seguir, con prendido y apagado (en la configuración o con la T): verde, amarilla o roja según la velocidad que se trae
- [x] Ayuda de manejo que sigue la trazada y regula los pedales de a poco: ya no se escucha cortar el acelerador
- [x] Antorchas rojas en las piedras pegadas al camino
- [x] Arreglos para el celular: en el iPhone los botones ya no se "arrastran" al dejar el dedo apoyado; cartel de carga; portada y resultado con los botones fijos abajo; distancia de cada cámara pensada para la pantalla chica; carga también en iPhones con iOS 15 y 16
- [x] La meta se festeja: papelitos de colores desde las esquinas de abajo, el público y una bocina; y el resultado te compara solo con tus amigos (en qué puesto quedaste y a cuánto estás del de adelante y del de atrás; si saliste primero, más papelitos)
- [x] Los golpes suenan según contra qué: piedra, madera, ramas, alambrado, fardo, chapa, plástico, goma, pared o el piso. Cuanto más roto está el auto, más se nota: el motor tose y raspa, larga vapor y le bailan las chapas sueltas
- [x] Panel de circuitos reordenado: crear una pista arriba, después las oficiales y al final las de la comunidad con su club y quién la armó; filas compactas y, en la compu, dos columnas
- [x] Modo "rally serio" en la Configuración (casco): transferencia de peso, cubiertas con pico y caída, círculo de agarre, freno de mano que bloquea, autoblocantes según la tracción e inercia según peso y largo; sin ayudas escondidas. Contrario a la ayuda de manejo; marcado en el link y en la tabla propia. Arcade igual que antes
- [x] Tramo largo Mina Clavero – Giulio Cesare (19,2 km, 1000 m de desnivel), basado en el del Rally Argentina; los fantasmas graban hasta 30 minutos
- [x] Garaje: el auto se arma con un motor, un chasis y unas ruedas (cinco de cada uno, 125 combinaciones balanceadas con el piloto automático). Código de partes en el link, la tabla y lo que se comparte; el fantasma muestra el auto de cada uno; dos chasis nuevos dibujados (buggy y camioncito)
- [x] Para trabajar con Claude: `CLAUDE.md` con las reglas del proyecto, un subagente por área del juego (`.claude/agents/`) y las pruebas en `tools/pruebas/`
- [x] Los tiempos se guardan solos al terminar, sin compartirlos: el resultado dice si quedó guardado y en qué tabla; sin señal (o si se cierra el juego enseguida) se reintenta solo. Un abandono dice DNF en las tablas, en la portada, en el resultado y en lo que se comparte; también la oficial que quedó cortada porque se cerró el juego
- [x] Ícono nuevo para el botón de circuitos: un mapa con tres lugares marcados. El de antes (una vuelta cerrada, como una O) no se entendía: la gente no se daba cuenta de que ahí había más pistas
- [x] Efectos de manejo: humo o tierra al frenar y derrapar (del color del suelo), barro que se acumula en la carrocería (todos los modelos), huellas que se marcan más con las pasadas, ráfagas de viento en las plantas y hojas que vuelan
- [x] Travesía: modo infinito que sale distinto en cada largada, con suelos nuevos (arena y fesh-fesh), médanos y ríos. Cartas cada 2 km (18 para empezar: averías, mejoras y mezclas), fin por daño, por quedarse parado o por batería, récord en el aparato y mensaje para compartir
- [x] Circuitos en categorías: Pista del día, Oficiales, Reales (tramos de verdad), Aventura (la Travesía) y Comunidad al final. La Travesía se entra desde ahí, siempre en rally serio y con la trazada prendida
- [x] Travesía de supervivencia: solo problemas (32 averías), más barro, ríos, pedregales y médanos, y estética de desierto (arena ocre, acacias, torres de roca, sol bajo, polvareda grande, rodadas en la arena)
- [x] Travesía con amigos: link sin pista (`#t=nombre.km`), récords de clubes y links guardados en el servidor (tabla `travesias`), tabla en Aventura y al terminar, y guía de la primera vez con los personajes
- [x] Travesía más exigente: camino angosto de un solo auto, arena suelta afuera que frena, autos rotos para esquivar y largada de festival con público (prueba `vertravesiafiesta`)
- [x] Inicio con cards deslizables por modo (`src/home.js`): ya no se entra directo a la carrera, sale el panel Circuitos, "Volver" lleva al inicio y los links abren en su card
- [x] Láminas dibujadas por Juanma en las cards del inicio (`laminas/`)
- [x] Ícono nuevo para compartir: una flecha que sale de una caja, hacia arriba (el de antes parecía "volver")
- [x] Música de fondo en loop: suave en el inicio, muy bajita en las carreras; botón de nota (tecla N) y opción en Configuración. Arranca con el primer toque
- [x] La Montaña del Sufrimiento: camión de carga con física propia, 4 tramos (barro, piedras, cornisa con cascada, bajada), carga que se corre y se cae, burbuja de nivel, recargo por bulto, fantasma fiel y prueba `vercamion.mjs`
- [x] Montaña v2: barro y rodadas profundas en toda la pista (serpentean, una más honda que otra, charcos y pozos); hay que pelear el volante
- [x] Montaña v3: camino de 3,4 m (casi el ancho del camión), rodadas justo donde van las ruedas, zanja y barro afuera; arreglado el barro que no dejaba avanzar (control de tracción por rueda y pedal que se suelta de a poco en el barro)
- [x] Montaña v4: el barro resbala en vez de frenar (menos hundimiento, poco agarre de costado, la cola se cruza a fondo); acelerando nunca queda parado
- [x] Montaña v5: vuelta atrás del camión (no era divertido): se corre con cualquier auto y la física de siempre, camino de 4,6 m con 18 eses y rodadas hondas. El camino deformado queda como opción estándar `surcos` para pistas complicadas; el camión quedó guardado sin usar

## Lo que sigue

- Que la card de la pista del día pida al servidor las tablas de hoy aunque esté cargado un circuito (ahora muestra lo último guardado en el aparato).
- Que el servidor guarde la marca de "rally serio" (hoy las tablas de los clubes no muestran el casco).
- Travesía: puestos de asistencia cada 10 km para arreglar averías con las cartas buenas (ya están guardadas en `ARREGLOS`, fuera del sorteo), sonido de arena, y ajustar la dificultad probando en celulares.
- Faros y luces de freno que se noten más al atardecer y con niebla.
- El recorrido exacto de Mina Clavero – Giulio Cesare, si se consigue el trazado del mapa (OpenStreetMap estuvo bloqueado).

1. **Más variedad en la pista del día:** anchos que cambian (ruta ancha, camino vecinal, huella angosta), pedazos de asfalto entre casas, puentes; y cornisas más cortas y con pirca en las curvas.
2. **Tres autos argentinos más** (El Fitito, El Doce y El 504). Cada día se ofrecen tres, que van rotando según el día y la pista.
3. **Probarlo en celulares y compus de verdad.** Todo está probado en un navegador sin placa de video: falta ver cómo rinde y cómo se siente con el teléfono en la mano.
4. **Ajustar el manejo jugando.** Está calibrado con pilotos automáticos, no con las manos.
5. **Pulir campo y montaña** al nivel del bosque. Revisar la niebla y el reflejo del agua.
6. **Colores y texturas:** seguir acercándolos a las referencias (pisos calmos, bruma cálida, sombras lilas).
7. **Autos dibujados en la portada**, en vez de emojis.
8. **Sonido:** golpes, agua, derrape y público.

## Antes de publicar en las tiendas (Google Play, App Store)

Lo que piden las tiendas y lo que conviene tener resuelto antes. Revisado en octubre de 2026; las reglas cambian, hay que volver a mirarlas llegado el momento.

1. **Política de privacidad publicada.** Las dos tiendas la piden aunque se guarde poco, y además hay que completar la declaración de datos de cada una (en Google Play, "Data safety"; en App Store, "App Privacy"). Lo que se guarda está en [`servidor/LEEME.md`](servidor/LEEME.md).
2. **Que cada uno pueda borrar sus datos** del servidor desde el juego (hoy las pasadas se borran solas a los 120 días y las pistas de la comunidad se pueden borrar, pero los clubes quedan).
3. **Confirmar antes de entrar a un club.** Hoy el que abre una invitación entra solo; conviene que primero vea a qué club entra y diga que sí.
4. **Nombres ofensivos.** Cuando la gente ve nombres escritos por otros (apodos, clubes y pistas de la comunidad), las tiendas piden reglas de uso, una forma de denunciar y otra de bloquear.
5. **Marcas de otros.** Revisar el nombre "Shakedown" (ya hubo juegos con esa palabra) y los sponsors y autos en chiste: las tiendas no hacen excepción con las parodias. Conviene consultarlo con alguien que sepa de marcas.
6. **Código cerrado.** Pasar el repo a privado y publicar el juego compactado. No impide copiarlo, pero deja de estar servido en bandeja. Un dominio propio también ayuda.
7. **Prueba cerrada.** En Google Play, una cuenta personal nueva tiene que probar la app con 12 personas durante 14 días antes de poder publicarla.
8. **Si algún día hay un ranking público o premios:** cuentas de usuario, que el servidor reparta la pista del día y que verifique cada pasada con el motor del juego.

## Ideas para más adelante

- Que los errores de carga lleguen solos al servidor, sin que nadie tenga que mandar una captura (sería un dato más que sale del aparato: hay que decidirlo y avisarlo)
- Avisar también cuando algo falla en plena pasada, no solo mientras carga
- Que los personajes aparezcan en otros momentos: Pablo al compartir, Juanma en la configuración, Rober en el resultado, Moi con la pista del día
- Que la primera vez se pueda dar una vuelta de práctica antes de gastar la oficial
- Racha de días corridos y estadísticas propias, como en el Wordle
- Autos desbloqueables
- Más circuitos fijos, y tabla de cada uno
- Tabla común para todos (el servidor ya guarda los tiempos; faltaría revisar que cada pasada se haya manejado de verdad)
- Que un mismo jugador pueda usar dos aparatos como uno solo (hoy no hay cuentas: cada aparato es un corredor)
- Soporte de joystick
- Sponsors de verdad, y un "sponsor del día" que se lleve los mejores lugares

## Riesgos

- **Rendimiento en celulares.** Hay más cosas en pantalla que antes (dibujos planos, revelado, lluvia). El juego baja solo la calidad si anda a menos de 30 cuadros por segundo, pero falta medirlo en aparatos reales.
- **Que una pista generada salga injusta.** El generador se prueba con pilotos automáticos, pero cada día es una pista nueva.
- **Tocar el generador cambia todas las pistas**, también la de hoy y las pasadas: los fantasmas ya guardados dejan de coincidir con el camino. Por eso las pistas llevan un número de versión (`VERSION`, en `src/generador.js`): al subirlo, cada aparato descarta lo guardado de la versión anterior, los links viejos avisan que ya no valen y la oficial del día se puede correr de nuevo. Cuando haya mucha gente jugando, conviene que esos cambios entren a la medianoche.
- **Que el link sea demasiado largo para algún mensajero.** WhatsApp lo acepta; falta probar otros. Con el servidor en línea el link es corto y esto deja de importar.
- **El servidor es gratis hasta un tope** (unas 12.000 pasadas por día). Si un día se pasa, o si se cae, el juego sigue con el link largo; los tiempos nuevos tardan en llegar a las tablas de los clubes.
- **Sin cuentas, las pasadas no se pueden verificar del todo.** El servidor revisa que la pasada se pueda leer y que el tiempo coincida con lo grabado, pero alguien que sepa programar puede fabricar una. Alcanza para clubes de amigos; no para un ranking con premios.

## Cómo seguir trabajando

1. Jugar y anotar qué se siente mal.
2. Ajustar `src/config.js` (manejo) o `src/generador.js` (pistas).
3. Correr `node tools/piloto.mjs 1 12` para ver que las pistas se sigan pudiendo terminar (y `node tools/piloto.mjs 16001 4` para los circuitos).
4. Subir los cambios. Pages publica solo.

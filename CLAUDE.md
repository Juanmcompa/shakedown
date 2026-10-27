# Shakedown — instrucciones para Claude

Rally diario en el navegador ("como el Wordle, pero con autos de rally"). HTML, CSS y módulos de JavaScript sin compilar;
Three.js en `vendor/`. Publicado en GitHub Pages (https://juanmcompa.github.io/shakedown/). El servidor (clubes, links
cortos, pistas de la comunidad) está en `servidor/` y corre en Cloudflare Workers + D1; se publica solo con cada Push.

Lo hace Juanma (Juan M. Comparini), docente de diseño gráfico. No programa: sube los cambios con GitHub Desktop.

## Cómo se trabaja

- **Hablarle en castellano rioplatense**, corto y con lo importante primero. Sin jerga de programación.
- Cada pedido se resuelve en **un commit** en su carpeta; **Push lo hace él**. Mensaje de commit en castellano, que diga
  qué cambia para el que juega, y que termine con las líneas de atribución que pida la sesión.
- Commitear **solo los archivos que tocaste**: si en su carpeta hay cambios suyos sin guardar, no se tocan ni se suben
  (avisale si ves algo roto en ellos).
- Los comentarios del código van en castellano, sin tildes, explicando el porqué. El README y el PLAN se mantienen al día
  (en el PLAN, lo hecho va como `- [x]` en "Hecho").

## Subagentes (`.claude/agents/`)

Hay uno por área del juego. Para un pedido, se llama **solo** al del área que hay que cambiar; si el pedido toca dos
áreas, a los dos, cada uno con su parte. Cada subagente lee este archivo y sus propios archivos, no el juego entero.
Devuelven un resumen corto: qué cambiaron, qué pruebas corrieron y cómo salieron.

| Área | Subagente |
| --- | --- |
| Cómo se maneja, el daño, las reglas, la cámara, la ayuda y la trazada; el garaje y sus partes | `manejo` |
| Cómo se arma la pista del día y los circuitos, el paisaje, el clima y el copiloto | `pistas` |
| El creador de pistas y las pistas de la comunidad | `creador` |
| Tablas, clubes, links, guardar tiempos, fantasmas y el servidor | `social` |
| Portada, resultado, paneles, íconos, tutorial y estilo | `pantallas` |
| Sonido, papelitos, efectos visuales | `sonido` |
| La carga del juego, la pantalla de "no cargó", página vieja y bloqueadores | `carga` |

## Reglas que no se cambian sin preguntarle

- La pista sale de la fecha: una pista nueva por día y **una sola pasada oficial**. Si un cambio hace que la pista de un
  día sea otra, hay que subir `VERSION` en `src/generador.js` (o la `version` del circuito en `src/circuitos.js`).
- El fantasma del link es fiel: hace exactamente lo que hizo el otro.
- Primer renglón de lo que se comparte de la pista del día, exacto: `Shakedown #42 🌧️🌲 ⏱️ 01:42:85 🟩 🟩 🟨 🟥 🟩 🏁 🚙431`
  (al final, el auto: su chasis y el código de sus partes). Un abandono dice `💥 DNF`.
- Los autos se arman por partes (`src/partes.js`): ninguna combinación es la mejor para todo. La Vitarita (333) y el
  Kacito (323) tienen que manejar igual que siempre (las huellas lo controlan). Partes nuevas, siempre al final de su lista.
- La firma "Desarrollado por Juan M. Comparini" va solo en la portada. Quien armó una pista de la comunidad firma su
  portada y lo que se comparte ("Pista «X» por Y"), no la largada.
- Menos palabras y más íconos; colores apagados; sponsors en chiste; clubes por invitación.
- Ningún archivo, id ni clase con palabras de publicidad ("publicidad", "sponsor", "banner"...): los bloqueadores lo frenan.
- Si cambia `index.html`, se sube el número de página en dos lados: `data-pagina` en `index.html` y `PAGINA` en `src/main.js`.
- Un archivo nuevo en `src/` va también en la lista `modulos` de `index.html`.
- **Nunca** publicar pruebas en el servidor de verdad: las pruebas usan `node servidor/local.mjs 8787`.

## Pruebas (`tools/pruebas/`)

Se corren desde la raíz del repo. Abren el juego en un Chromium sin pantalla (Playwright) y dejan capturas en `out/`.
Las que usan servidor necesitan antes uno limpio: `node servidor/local.mjs 8787` (se reinicia entre una prueba y otra).

- `node tools/pruebas/huella.mjs 1 10 tools/pruebas/medidas/huella-v2.txt` (y `16001 3 …huella-circuitos-v1.txt`,
  `16004 1 …huella-practica-v1.txt`, `16005 1 …huella-giulio-v1.txt`, `16006 1 …huella-montana-v5.txt`): tienen que decir **IGUAL**. Si no, cambió cómo se maneja o cómo es la pista.
- `node servidor/prueba.mjs`: el servidor (153 pruebas).
- La Montaña (camino deformado, con el auto): `vermontana.mjs`.
- El motor de pistas: `node tools/pruebas/vermotor.mjs` (20 días seguidos: variedad, noche, festival y que el piloto llegue).
- `vertodos.mjs` y `vercreador.mjs` necesitan un servidor local limpio en cada corrida.
- Las demás `ver*.mjs` prueban cada parte; el comentario del principio de cada una dice qué y cómo.

Con gráficos por software todo anda lento (1 cuadro por segundo): las pruebas usan `shakedown.avanzar(segundos)` en vez
de esperar, y conviene no abrir dos navegadores a la vez.

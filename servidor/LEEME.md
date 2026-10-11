# El servidor de Shakedown

El juego se juega entero sin servidor. Con servidor suma dos cosas:

- **Links cortos.** La pasada (el fantasma) se guarda acá, y el link pasa de 500 a 800 letras a siete: `…/shakedown/#r=k7Qx2Mp`. El fantasma es igual de fiel: se guarda la pasada entera.
- **Clubes.** Grupos de amigos con tabla propia. La pasada oficial de cada uno aparece sola en la tabla de todos sus clubes.

Si el servidor no contesta, el juego sigue andando con el link largo de siempre.

Está publicado en `https://shakedown.juanmcomparini.workers.dev` (esa dirección es la que figura en `SERVIDOR`, en `src/config.js`). Abrirla tiene que mostrar `{"juego":"Shakedown", …}`.

## Qué hay en esta carpeta

| Archivo | Qué es |
| --- | --- |
| `worker.js` | El servidor. Un solo programa, pensado para Cloudflare Workers, con una base de datos D1 |
| `local.mjs` | El mismo servidor, en tu compu, para probar (guarda todo en la memoria) |
| `prueba.mjs` | Las pruebas: sube pasadas, arma clubes y revisa lo que contesta |

En la raíz del repo, `wrangler.jsonc` le dice a Cloudflare cómo publicarlo.

## Publicarlo en Cloudflare (una sola vez)

Ya está hecho. Queda anotado por si hay que repetirlo en otra cuenta. Hace falta una cuenta de Cloudflare; el plan gratis alcanza.

1. Entrar a [dash.cloudflare.com](https://dash.cloudflare.com) y abrir **Workers & Pages**.
2. **Create application** y, al lado de **Import a repository**, **Get started**.
3. Elegir la cuenta de GitHub (la primera vez pide permiso para ver los repos: alcanza con darle acceso a `shakedown`) y elegir el repo `shakedown`.
4. En la configuración, dejar el nombre del proyecto en `shakedown` (tiene que ser igual al `name` de `wrangler.jsonc`) y lo demás como viene: sin comando de armado, `npx wrangler deploy` para publicar y **Protect with Cloudflare Access** apagado (si se prende, el juego no puede hablar con el servidor). **Deploy**.
5. Al terminar muestra la dirección del servidor, algo como `https://shakedown.TU-NOMBRE.workers.dev`. Abrirla tiene que mostrar `{"juego":"Shakedown", …}`.
6. Copiar esa dirección en `SERVIDOR`, en `src/config.js`, sin barra al final. Hacer commit y Push.

Desde ahí, cada Push publica también el servidor, igual que el juego. La base de datos se crea sola la primera vez, y sus tablas también.

Si la publicación falla diciendo que falta la base de datos: crearla a mano en **Storage & Databases**, **D1** (**Create**, con el nombre `shakedown`), copiar su ID y agregarlo en `wrangler.jsonc`, al lado del nombre: `"database_id": "EL-ID"`. Commit, Push, y se publica de nuevo.

## Cuánto aguanta gratis

El plan gratis de Cloudflare da 100.000 pedidos por día y deja escribir 100.000 filas por día en la base. Cada pasada que se sube gasta un pedido y unas 6 filas; mirar una tabla gasta un pedido y no escribe nada. Con los topes que trae el servidor entran unas 12.000 pasadas por día, que son miles de jugadores.

La base de datos queda lejos de Argentina: cada viaje de ida y vuelta tarda un tercio de segundo. Por eso el servidor hace un solo viaje por pedido (subir una pasada, entrar a un club, pedir una tabla).

Si un día se llega al tope, no se rompe nada: hasta el día siguiente (los contadores vuelven a cero a las 21, hora argentina) los links salen largos y los tiempos nuevos tardan en aparecer en las tablas. El uso se ve en el panel de Cloudflare, en la página del Worker y en la de la base.

## Probarlo en tu compu

Con Node 22 o más nuevo, desde la carpeta del repo:

```
node servidor/prueba.mjs            las pruebas, sin levantar nada
node servidor/local.mjs             el servidor en http://127.0.0.1:8787
```

Con el servidor de prueba andando, abrir el juego local con `?servidor=http://127.0.0.1:8787` al final de la dirección. Ese truco funciona solo desde una copia local del juego.

`node servidor/prueba.mjs https://shakedown.TU-NOMBRE.workers.dev` corre las mismas pruebas contra el servidor publicado. Deja en la base un par de clubes y pasadas de prueba.

## Qué guarda

De cada pasada: el apodo, el tiempo, los colores de los sectores, el auto, si usó ayuda de manejo y el recorrido grabado. Es lo mismo que viaja en un link largo (que incluye hasta diez tiempos de otros que a ese jugador le llegaron por link; los de sus clubes, no). De cada club: su nombre, quiénes están y el apodo de cada uno (el último que usó: si se lo cambia, cambia en la tabla).

No hay cuentas, mails ni contraseñas. Cada aparato inventa una llave larga al azar; el servidor guarda solo su huella, que hace de número de corredor. Como nadie más conoce la llave, nadie puede subir tiempos a nombre de otro. La contra: el mismo jugador en dos aparatos son dos corredores.

No guarda direcciones de internet. Para los topes cuenta los pedidos de cada conexión, pero de la conexión anota solo tres letras de una huella, que comparten miles de direcciones distintas, y las borra a los dos días. (Aparte, Cloudflare lleva su propio registro de visitas, como cualquier servicio de internet.)

Las pasadas de más de 120 días se borran solas. Los clubes y quiénes están en cada uno quedan hasta que la gente sale.

## Qué revisa y qué no

Cada pasada que llega se lee con el mismo programa que usa el juego (`src/fantasma.js`), y lo que figura en la tabla sale de ahí. Se rechaza si no se puede leer, si es de una pista que todavía no empezó (se acepta desde 15 minutos antes de la medianoche, por los relojes adelantados), o si el tiempo no coincide con lo grabado. Cada corredor tiene una sola oficial por pista: la primera que llega.

Escribir (subir pasadas, crear clubes, entrar y salir) solo se puede desde el juego publicado: el navegador avisa desde qué página viene cada pedido, y el servidor rechaza los que vienen de otra. Leer puede cualquiera que tenga el código de una pasada o de un club; por eso esos códigos son largos y al azar.

Los nombres (de la gente y de los clubes) se limpian: sin letras de control ni marcas invisibles, sin `<` ni `>`, y con un largo máximo. No hay filtro de palabras: si aparece un nombre ofensivo, se borra a mano (ver más abajo).

No revisa que la pasada se haya manejado de verdad. Alguien que sepa programar puede fabricar una, o mentir desde qué página viene. Alcanza para clubes de amigos; no para un ranking con premios: para eso haría falta que el servidor repita cada pasada con el mismo motor del juego, y cuentas de usuario.

Los topes están arriba de todo en `worker.js` (`LIMITES`). Por día y desde una misma conexión: 3.000 pasadas, 60 clubes nuevos y 600 ingresos a clubes. Entre todos: 12.000 pasadas por día. Además, 30 clubes por corredor y 100 corredores por club. Los topes por conexión son holgados a propósito: un colegio con el mismo wifi, o mucha gente de la misma compañía de celular, salen a internet con la misma dirección.

## Mirar o borrar datos

En el panel de Cloudflare: **Storage & Databases**, **D1**, la base del juego (se llama `shakedown` o parecido), pestaña **Console**. Ahí se escriben consultas:

```sql
SELECT nombre, codigo, (SELECT COUNT(*) FROM miembros WHERE club = codigo) AS gente FROM clubes ORDER BY creado DESC LIMIT 50;
SELECT pista, nombre, t, auto, ayuda, practica FROM pasadas ORDER BY creado DESC LIMIT 50;
SELECT COUNT(*) FROM pasadas;
```

Para borrar un club (por ejemplo, uno con un nombre ofensivo), con su código, que es lo que va al final del link de invitación:

```sql
DELETE FROM miembros WHERE club = 'EL-CODIGO';
DELETE FROM clubes WHERE codigo = 'EL-CODIGO';
```

A quienes estaban en ese club les desaparece solo la próxima vez que abren el juego. Si se borra la base entera, se pierden los clubes y los links cortos dejan de andar; los tiempos de cada uno siguen guardados en su aparato.

## Lo que se le puede pedir

Todo va y viene como JSON.

| Pedido | Manda | Devuelve |
| --- | --- | --- |
| `POST /pasadas` | `{ llave, codigo }` | `{ id }`: lo que va en el link corto |
| `GET /pasadas/<id>` | | `{ codigo, j }`: la pasada entera y el número de corredor |
| `POST /clubes` | `{ llave, nombre, apodo }` | `{ codigo, nombre, miembros }` |
| `GET /clubes/<codigo>` | | `{ codigo, nombre, miembros }` |
| `POST /clubes/<codigo>/entrar` | `{ llave, apodo }` | lo mismo |
| `POST /clubes/<codigo>/salir` | `{ llave }` | `{ listo: true }` |
| `POST /tablas` | `{ llave, pista, version, clubes: [códigos] }` | de cada club: nombre, cuántos son, la tabla y quiénes faltan correr |

Desde un navegador solo lo puede usar el juego publicado (`ORIGENES`, en `wrangler.jsonc`). Una copia local del juego puede usar el servidor de prueba (`local.mjs`), no el publicado.

Si el juego se muda (a un dominio propio, o adentro de una app para el celular), hay que agregar su dirección nueva en `ORIGENES`, separada por una coma: si no, el servidor no lo deja escribir.

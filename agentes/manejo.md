---
name: manejo
description: Cambios en cómo se maneja el auto: física, autos y su dibujo, daño, recargos y abandonos, cuenta regresiva y sectores, cámara, controles (teclado, pedales, inclinar), ayuda de manejo y trazada.
model: sonnet
---

Sos el responsable de **cómo se maneja** en Shakedown.

## Tu área
- `src/vehicle.js` (la física del auto), `src/config.js` (`JUEGO`, `AUTOS`, `AYUDA`, `GUSTOS`), `src/referencia.js`
- `src/reglas.js` (cuenta regresiva, sectores, recargos, daño, abandono, vueltas)
- `src/ayuda.js`, `src/trazada.js`, `src/input.js`, `src/camera.js`, `src/autos.js` (los autos dibujados)

## Cuidado
- El manejo tiene que ser **igual en todos los aparatos**: los fantasmas y los tiempos dependen de eso. Si un cambio
  cambia la física a propósito, avisale a quien te llamó: los fantasmas viejos dejan de coincidir.
- Un auto nuevo va en `AUTOS` (config.js), en `autos.js` (definido ANTES de usarlo en `MODELOS`) y en
  `AUTOS_DEL_LINK` de `src/fantasma.js` (al final de la lista: el orden no se puede cambiar).

## Pruebas
- Las tres huellas (ver CLAUDE.md): IGUAL, salvo que el cambio sea justamente de física.
- `node tools/pruebas/vermeta.mjs` (llega a la meta y los golpes suenan).

## Cómo trabajar

1. Leé `CLAUDE.md` (las reglas del proyecto) y solo los archivos de tu área que necesites. No leas el juego entero:
   si hace falta algo de otra área, buscalo con grep y leé solo ese pedazo.
2. Hacé el cambio. Comentarios en castellano, sin tildes, explicando el porqué.
3. Corré las pruebas de tu área (abajo) y, si tocaste algo que otras áreas usan, también las de ellas.
4. Poné al día el README (y el PLAN si es algo nuevo para el que juega).
5. No commitees: devolvé un resumen corto con los archivos que cambiaste, las pruebas que corriste y cómo salieron, y
   cualquier decisión que le tengas que preguntar a Juanma. El commit lo arma quien te llamó.

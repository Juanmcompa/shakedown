// Lo que comparten todos los materiales del mundo: el tinte de lo que queda abajo, el hueco que se abre
// en las copas alrededor del auto, la niebla y los "sprites" (dibujos planos que siempre miran a la camara).
import * as THREE from '../vendor/three.module.js';
import { GLSL_AZAR } from './pixel.js';

// datos que cambian cuadro a cuadro y leen todos los materiales
export const ambiente = {
  bajo: { value: 0 },                                         // altura del auto: lo que esta mas abajo se oscurece
  hueco: { value: new THREE.Vector3(-9999, -9999, 1) },       // donde esta el auto en la pantalla, y que radio ocupa
  tiempo: { value: 0 },
  centro: { value: new THREE.Vector3() },                     // donde esta el auto en el mundo
  niebla: { value: new THREE.Vector4(0.8, 0.85, 0.9, 0) },    // color de la niebla y hasta donde se ve (0 = no hay)
  camDer: { value: new THREE.Vector3(1, 0, 0) },              // hacia donde queda la derecha de la camara
  camAlto: { value: new THREE.Vector3(0, 1, 0) },             // el "arriba" de los sprites (inclinado hacia la camara)
  camMira: { value: new THREE.Vector3(0, 0, -1) },            // hacia donde mira la camara, sobre el piso
  rafaga: { value: 0 },                                       // cuanto arrecia el viento en rafagas sobre las plantas (0 = solo el vaiven suave)
};

const CALADA = `
  float lejosDelHueco = distance(gl_FragCoord.xy, uHueco.xy) / uHueco.z;
  vec2 trama = mod(floor(gl_FragCoord.xy), 2.0);
  if (lejosDelHueco < 1.0 && (lejosDelHueco < 0.62 ? trama.x + trama.y > 0.5 : trama.x == trama.y)) discard;`;
const SOMBRA = `
  #if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
    #if defined( SHADOWMAP_TYPE_PCF )
    float sombraDura(sampler2DShadow mapa, DirectionalLightShadow s, vec4 c) {
      c.xyz /= c.w; c.z += s.shadowBias;
      if (c.x < 0.0 || c.x > 1.0 || c.y < 0.0 || c.y > 1.0 || c.z > 1.0) return 1.0;
      return mix(1.0, step(0.5, texture(mapa, c.xyz)), s.shadowIntensity);
    }
    #else
    float sombraDura(sampler2D mapa, DirectionalLightShadow s, vec4 c) { return getShadow(mapa, s.shadowMapSize, s.shadowIntensity, s.shadowBias, s.shadowRadius, c); }
    #endif
  #endif`;
const LUCES = THREE.ShaderChunk.lights_fragment_begin.replace(
  'getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] )',
  'sombraDura( directionalShadowMap[ i ], directionalLightShadow, sombraPix )');

// Un sprite es un cuadrado (x de -0,5 a 0,5; y de 0 a 1) repetido muchas veces. Cada copia trae:
//   aBase: donde apoya (x, y, z)        aTam: ancho y alto en metros
//   aUv:   su dibujo en el atlas (u, v, ancho, alto), con v medido desde arriba
//   aDato: x = numero al azar (0 a 1), y = cuanto se mueve (viento, o festejo en la gente), z = 1 si es una persona, w = hacia donde mira (radianes)
const SPRITE_CABEZA = `
  attribute vec3 aBase;
  attribute vec2 aTam;
  attribute vec4 aUv, aDato;
  uniform vec3 uCamDer, uCamAlto, uCamMira;
  uniform float uTiempoV, uRafaga;`;
const SPRITE_FORMA = `
  vec3 transformed = aBase + uCamDer * (position.x * aTam.x) + uCamAlto * (position.y * aTam.y);
  float cuadroSprite = 0.0;
  if (aDato.z > 0.5) {
    // gente: si la camara la ve de atras, se usa el dibujo de espaldas; festejando, salta y levanta los brazos
    float deEspaldas = step(0.0, sin(aDato.w) * uCamMira.x - cos(aDato.w) * uCamMira.z);
    float pulso = fract(uTiempoV * (2.2 + aDato.x * 1.4) + aDato.x * 7.0);
    float festeja = step(0.5, aDato.y);
    cuadroSprite = deEspaldas * 3.0 + festeja * (pulso < 0.5 ? 1.0 : 2.0);
    transformed.y += festeja * abs(sin(pulso * 6.2832)) * 0.22 * aDato.y;
  } else {
    // plantas: la punta se mueve con el viento
    // (las rafagas son una ola que cruza el campo: en un momento las plantas de un lado se doblan mas que las del otro)
    float rafaga = pow(0.5 + 0.5 * sin(uTiempoV * 0.7 + (aBase.x * 0.8 + aBase.z * 0.5) * 0.11), 3.0);
    transformed += uCamDer * (sin(uTiempoV * 1.7 + aDato.x * 40.0) * aDato.y * (1.0 + uRafaga * rafaga * 2.2) * position.y * position.y);
  }`;

// Le agrega a un material lo comun a todo el mundo. Opciones:
//   calada: a las copas se les abre un hueco alrededor del auto, para que no lo tapen
//   sombras: sombras de pixeles enteros (el piso y el agua)      sprite: dibujo plano que mira a la camara
//   cabeza / cuerpo: codigo propio de ese material               datos: sus propios datos
export function estilo(mat, o = {}) {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { uBajo: ambiente.bajo, uHueco: ambiente.hueco, uTiempo: ambiente.tiempo, uTiempoV: ambiente.tiempo, uCentro: ambiente.centro, uNiebla: ambiente.niebla,
      uCamDer: ambiente.camDer, uCamAlto: ambiente.camAlto, uCamMira: ambiente.camMira, uRafaga: ambiente.rafaga }, o.datos);
    let v = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vMundo;' + (o.sprite ? SPRITE_CABEZA : '') + (o.uvInstancia ? '\nattribute vec4 aUv, aUv2;\nattribute vec2 aForma;\nattribute float aTop;' : ''));
    if (o.sprite) {
      // (la forma se calcula al principio, donde van las coordenadas del dibujo, porque de ella sale que cuadro se muestra)
      v = v.replace('#include <uv_vertex>', SPRITE_FORMA + '\n#include <uv_vertex>\n#ifdef USE_MAP\n vMapUv = vec2(aUv.x + (uv.x + cuadroSprite) * aUv.z, 1.0 - aUv.y - (1.0 - uv.y) * aUv.w);\n#endif')
        .replace('#include <begin_vertex>', 'vMundo = transformed;')
        .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = vec3(0.0, 1.0, 0.0);');
    } else {
      // uvInstancia: cada copia usa su pedazo del atlas (aUv = u, v desde arriba, ancho, alto), como los sprites pero con la forma que se le ponga.
      // Los arboles llevan ademas un plano horizontal en la copa (aTop = 1): usa otro pedazo del atlas (aUv2, la copa vista de arriba) y se
      // acomoda con aForma (a que altura va, de 0 a 1, y que tan ancho es), asi desde la camara alta se ve una copa redonda y no rayas
      if (o.uvInstancia) v = v.replace('#include <uv_vertex>', '#include <uv_vertex>\n#ifdef USE_MAP\n vec4 ru = aTop > 0.5 ? aUv2 : aUv;\n vMapUv = vec2(ru.x + uv.x * ru.z, 1.0 - ru.y - (1.0 - uv.y) * ru.w);\n#endif');
      v = v.replace('#include <begin_vertex>', `#include <begin_vertex>
        ${o.uvInstancia ? 'if (aTop > 0.5) { transformed.xz *= aForma.y; transformed.y = aForma.x; }' : ''}
        vec4 enMundo = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          enMundo = instanceMatrix * enMundo;
        #endif
        vMundo = (modelMatrix * enMundo).xyz;`);
    }
    sh.vertexShader = v;
    if (o.soloForma) return;   // el material con el que se dibuja la sombra: no hace falta nada mas
    let f = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vMundo;\nuniform float uBajo, uTiempo;\nuniform vec3 uHueco, uCentro;\nuniform vec4 uNiebla;\n' + GLSL_AZAR + (o.cabeza || ''))
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + (o.cuerpo || 'float altoPix = vMundo.y;') + `
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.07, 0.12, 0.2), smoothstep(1.5, 28.0, uBajo - altoPix) * 0.68);` + (o.calada ? CALADA : ''))
      .replace('#include <fog_fragment>', `#include <fog_fragment>
        if (uNiebla.w > 0.0) gl_FragColor.rgb = mix(gl_FragColor.rgb, uNiebla.rgb, smoothstep(uNiebla.w * 0.3, uNiebla.w, distance(vMundo.xz, uCentro.xz)) * 0.94);`);
    if (o.sombras) {
      f = f.replace('#include <shadowmap_pars_fragment>', '#include <shadowmap_pars_fragment>\n' + SOMBRA)
        .replace('#include <lights_fragment_begin>', `
          #if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
            vec4 sombraPix = EN_PIXEL(vDirectionalShadowCoord[ 0 ]);
          #endif
          ` + LUCES);
    }
    sh.fragmentShader = f;
  };
  mat.customProgramCacheKey = () => 'shakedown-' + (o.clave || '') + (o.calada ? 'c' : '') + (o.sprite ? 's' : '') + (o.uvInstancia ? 'u' : '') + (o.soloForma ? 'f' : '') + (o.sombras ? 'p' : '');
  return mat;
}

// Le pone el estilo a todos los materiales de un modelo ya armado (un auto, un arco).
export function conEstilo(objeto) {
  objeto.traverse((x) => { for (const m of x.isMesh ? [].concat(x.material) : []) if (!m.userData.conEstilo) { estilo(m); m.userData.conEstilo = true; } });
  return objeto;
}

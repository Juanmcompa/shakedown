// El "revelado" de la imagen: lo que le da el aire de maqueta fotografiada.
// El mundo se dibuja primero en una imagen aparte y despues se le agrega:
//   - desenfoque de lo que esta mas cerca y mas lejos que el auto (el efecto maqueta)
//   - brillo alrededor de lo muy iluminado
//   - un ajuste de color (sombras frias, luces calidas) y los bordes de la pantalla un poco mas oscuros
// Si el aparato no da, se apaga solo y el mundo se dibuja directo (ver "liviano" y calidad()).
// Ademas, el "pixelado" (gusto "pixeles": nada / medio / fuerte): el mundo se dibuja en una imagen chica (el pixel mide
// ~3 o ~5 pixeles de pantalla, no depende del devicePixelRatio) y se agranda sin suavizar, con una paleta de pocos colores
// y tramado ordenado (Bayer). Es barato: se dibuja menos. Si el revelado esta apagado, el pixelado sigue por el camino liviano.
import * as THREE from '../vendor/three.module.js';

const VERTICE = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
// achicar a la mitad promediando cuatro puntos
const ACHICAR = `
  uniform sampler2D tImagen; uniform vec2 uPaso; varying vec2 vUv;
  void main() {
    vec3 c = texture2D(tImagen, vUv + uPaso * vec2(-0.5, -0.5)).rgb + texture2D(tImagen, vUv + uPaso * vec2(0.5, -0.5)).rgb + texture2D(tImagen, vUv + uPaso * vec2(-0.5, 0.5)).rgb + texture2D(tImagen, vUv + uPaso * vec2(0.5, 0.5)).rgb;
    gl_FragColor = vec4(c * 0.25, 1.0);
  }`;
// desenfocar en una direccion (se pasa dos veces: a lo ancho y a lo alto)
const BORRONEAR = `
  uniform sampler2D tImagen; uniform vec2 uPaso; varying vec2 vUv;
  void main() {
    vec3 c = texture2D(tImagen, vUv).rgb * 0.227;
    c += (texture2D(tImagen, vUv + uPaso * 1.385).rgb + texture2D(tImagen, vUv - uPaso * 1.385).rgb) * 0.316;
    c += (texture2D(tImagen, vUv + uPaso * 3.231).rgb + texture2D(tImagen, vUv - uPaso * 3.231).rgb) * 0.0703;
    gl_FragColor = vec4(c, 1.0);
  }`;
// quedarse solo con lo muy iluminado
const LO_BRILLANTE = `
  uniform sampler2D tImagen; uniform float uDesde; varying vec2 vUv;
  void main() {
    vec3 c = texture2D(tImagen, vUv).rgb;
    float l = max(c.r, max(c.g, c.b));
    gl_FragColor = vec4(c * smoothstep(uDesde, uDesde + 0.35, l), 1.0);
  }`;
const FINAL = `
  uniform sampler2D tNitida, tSuave, tBorrosa, tBrillo, tHondo;
  uniform vec4 uFoco;      // a que distancia esta el auto, cuantos metros alrededor quedan nitidos, y en cuantos metros se borronea lo cercano y lo lejano
  uniform vec2 uLente;     // lo mas cerca y lo mas lejos que ve la camara
  uniform vec4 uAjuste;    // cuanto brillo, saturacion, contraste y oscurecimiento de los bordes
  uniform vec3 uSombras, uLuces;
  uniform float uLejosMax; // lo lejano nunca se borronea del todo: hay que ver venir la curva
  uniform float uForza;    // cuanto del desenfoque se usa (con pixelado, poco: el borron sobre pixeles grandes se ve sucio)
  varying vec2 vUv;
  void main() {
    float d = texture2D(tHondo, vUv).r;
    float z = uLente.x * uLente.y / (uLente.y - d * (uLente.y - uLente.x));   // metros desde la camara
    float fuera = z < uFoco.x ? clamp((uFoco.x - z - uFoco.y) / uFoco.z, 0.0, 1.0) : clamp((z - uFoco.x - uFoco.y * 1.6) / uFoco.w, 0.0, 1.0) * uLejosMax;
    fuera *= uForza;
    vec3 c = texture2D(tNitida, vUv).rgb;
    c = mix(c, texture2D(tSuave, vUv).rgb, smoothstep(0.0, 0.45, fuera));
    c = mix(c, texture2D(tBorrosa, vUv).rgb, smoothstep(0.35, 1.0, fuera));
    c += texture2D(tBrillo, vUv).rgb * uAjuste.x;
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    c = mix(vec3(l), c, uAjuste.y);
    c = (c - 0.18) * uAjuste.z + 0.18;
    c *= mix(uSombras, uLuces, smoothstep(0.02, 0.6, l));
    c *= 1.0 - uAjuste.w * smoothstep(0.45, 1.1, length((vUv - 0.5) * vec2(1.25, 1.0)) * 1.5);
    gl_FragColor = vec4(max(c, 0.0), 1.0);
    #include <colorspace_fragment>
  }`;

// Agranda la imagen chica sin suavizar (cada pixel grande cubre uPix pixeles del lienzo, alineado desde abajo a la izquierda,
// asi el pixel es siempre cuadrado), la pasa a sRGB y le limita los colores con tramado ordenado (Bayer 4x4 o 8x8).
const PIXELAR = `
  uniform sampler2D tImagen; uniform vec2 uTam; uniform float uPix;
  uniform vec3 uPaleta;    // niveles por canal, fuerza del tramado, 0 = patron de 4x4 y 1 = de 8x8
  float b2(vec2 p) { p = mod(p, 2.0); return p.x * 2.0 + p.y * 3.0 - p.x * p.y * 4.0; }
  float b4(vec2 p) { return b2(p) * 4.0 + b2(floor(p / 2.0)); }
  void main() {
    vec2 cel = floor(gl_FragCoord.xy / uPix);
    vec3 c = texture2D(tImagen, (cel + 0.5) / uTam).rgb;
    gl_FragColor = vec4(max(c, 0.0), 1.0);
    #include <colorspace_fragment>
    float t = uPaleta.z > 0.5 ? (b4(mod(cel, 4.0)) * 4.0 + b2(floor(cel / 4.0)) + 0.5) / 64.0 : (b4(cel) + 0.5) / 16.0;
    vec3 v = clamp(gl_FragColor.rgb, 0.0, 1.0) * (uPaleta.x - 1.0);
    gl_FragColor.rgb = floor(v + 0.5 + (t - 0.5) * uPaleta.y) / (uPaleta.x - 1.0);
  }`;
// tamaño del pixel (en pixeles de pantalla), paleta y cuanto desenfoque queda, de cada nivel
const PIXELES = {
  medio:  { pix: 3, niveles: 28, tramado: 0.7, patron: 0, desenfoque: 0.45 },
  fuerte: { pix: 5, niveles: 14, tramado: 0.85, patron: 1, desenfoque: 0.3 },
};

// El ajuste de color de cada clima: [brillo, saturacion, contraste, bordes], tinte de las sombras y de las luces.
const REVELADOS = {
  sol:    { ajuste: [0.38, 1.02, 0.98, 0.26], sombras: [0.97, 0.93, 1.1], luces: [1.06, 1.01, 0.93], desde: 0.95 },
  tarde:  { ajuste: [0.75, 1.02, 1.0, 0.34], sombras: [0.95, 0.93, 1.1],  luces: [1.07, 1.0, 0.92],  desde: 0.85 },
  lluvia: { ajuste: [0.32, 0.92, 1.0, 0.34], sombras: [0.95, 1.0, 1.05],  luces: [0.99, 1.0, 1.02],  desde: 0.9 },
  niebla: { ajuste: [0.4, 0.9, 0.98, 0.28],  sombras: [0.98, 1.0, 1.03],  luces: [1.01, 1.0, 0.99],  desde: 0.95 },
};

export function crearPost(render, clima, liviano) {
  const R = REVELADOS[clima] || REVELADOS.sol;
  const imagen = (o) => new THREE.WebGLRenderTarget(4, 4, Object.assign({ type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter }, o));
  // la imagen del mundo, con su mapa de distancias
  const mundo = imagen({ depthBuffer: true, samples: liviano ? 0 : 4 });
  mundo.depthTexture = new THREE.DepthTexture(4, 4);
  const mitadA = imagen(), mitadB = imagen(), cuartoA = imagen(), cuartoB = imagen(), brilloA = imagen(), brilloB = imagen();
  const camara = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), escena = new THREE.Scene();
  const hoja = new THREE.Mesh(new THREE.BufferGeometry(), null);
  hoja.geometry.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));   // un triangulo que cubre la pantalla
  hoja.geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
  hoja.frustumCulled = false;
  escena.add(hoja);
  const material = (fragmento, datos) => new THREE.ShaderMaterial({ vertexShader: VERTICE, fragmentShader: fragmento, uniforms: datos, depthTest: false, depthWrite: false });
  const mAchicar = material(ACHICAR, { tImagen: { value: null }, uPaso: { value: new THREE.Vector2() } });
  const mBorronear = material(BORRONEAR, { tImagen: { value: null }, uPaso: { value: new THREE.Vector2() } });
  const mBrillante = material(LO_BRILLANTE, { tImagen: { value: null }, uDesde: { value: R.desde } });
  const mFinal = material(FINAL, {
    tNitida: { value: mundo.texture }, tSuave: { value: mitadA.texture }, tBorrosa: { value: cuartoA.texture }, tBrillo: { value: brilloA.texture }, tHondo: { value: mundo.depthTexture },
    uFoco: { value: new THREE.Vector4(60, 9, 26, 70) }, uLente: { value: new THREE.Vector2(2, 900) }, uAjuste: { value: new THREE.Vector4(...R.ajuste) },
    uSombras: { value: new THREE.Vector3(...R.sombras) }, uLuces: { value: new THREE.Vector3(...R.luces) }, uLejosMax: { value: 0.7 }, uForza: { value: 1 },
  });
  const chico = imagen({ minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });   // el revelado ya hecho, a tamaño de pixel grande
  const mFinalChico = new THREE.ShaderMaterial({ vertexShader: VERTICE, fragmentShader: FINAL, uniforms: mFinal.uniforms, depthTest: false, depthWrite: false });   // (mismo revelado, pero a una imagen y no a la pantalla)
  const mPixelar = material(PIXELAR, { tImagen: { value: null }, uTam: { value: new THREE.Vector2(1, 1) }, uPix: { value: 3 }, uPaleta: { value: new THREE.Vector3(28, 0.7, 0) } });
  let ancho = 0, alto = 0, prendido = true, nivel = 'nada', P = null;   // ancho y alto: el lienzo, en pixeles

  function pasar(mat, destino) {
    hoja.material = mat;
    render.setRenderTarget(destino);
    render.render(escena, camara);
  }
  function borronear(a, b, veces) {   // deja el resultado en "a"
    for (let k = 0; k < veces; k++) {
      mBorronear.uniforms.tImagen.value = a.texture; mBorronear.uniforms.uPaso.value.set(1 / a.width, 0); pasar(mBorronear, b);
      mBorronear.uniforms.tImagen.value = b.texture; mBorronear.uniforms.uPaso.value.set(0, 1 / a.height); pasar(mBorronear, a);
    }
  }

  // el mundo se dibuja del tamaño del lienzo, o (pixelado) de a un pixel grande por texel
  function medirTodo() {
    let w = ancho, h = alto;
    if (P) {
      const pix = Math.max(1, Math.round(P.pix * render.getPixelRatio()));
      w = Math.ceil(ancho / pix); h = Math.ceil(alto / pix);
      mPixelar.uniforms.uPix.value = pix; mPixelar.uniforms.uTam.value.set(w, h);
    }
    mundo.setSize(w, h); chico.setSize(w, h);
    const m = [Math.max(2, w >> 1), Math.max(2, h >> 1)], c = [Math.max(2, w >> 2), Math.max(2, h >> 2)];
    mitadA.setSize(...m); mitadB.setSize(...m); cuartoA.setSize(...c); cuartoB.setSize(...c); brilloA.setSize(...c); brilloB.setSize(...c);
    mAchicar.uniforms.uPaso.value.set(1 / w, 1 / h);
  }

  return {
    // se llama cuando cambia el tamaño de lo que se dibuja (en pixeles)
    medir: (w, h) => { ancho = w; alto = h; medirTodo(); },
    // nada / medio / fuerte
    pixelar: (cual) => { nivel = PIXELES[cual] ? cual : 'nada'; P = PIXELES[nivel] || null; if (P) { const u = mPixelar.uniforms; u.uPaleta.value.set(P.niveles, P.tramado, P.patron); mFinal.uniforms.uForza.value = P.desenfoque; } else mFinal.uniforms.uForza.value = 1; if (ancho) medirTodo(); },
    pixelado: () => nivel,
    prender: (si) => { prendido = si; },
    prendido: () => prendido,
    // Dibuja la escena. "foco" es a cuantos metros de la camara esta el auto: eso queda nitido.
    dibujar: (escenaDelJuego, cam, foco) => {
      if (!ancho || (!prendido && !P)) { render.setRenderTarget(null); render.render(escenaDelJuego, cam); return; }
      render.setRenderTarget(mundo);
      render.render(escenaDelJuego, cam);
      if (!prendido) {   // camino liviano: sin revelado, solo dibujar el mundo chico y agrandarlo
        mPixelar.uniforms.tImagen.value = mundo.texture; pasar(mPixelar, null);
        return;
      }
      const w = mundo.width, h = mundo.height;
      // dos versiones desenfocadas: una a la mitad de tamaño (suave) y otra a un cuarto (muy borrosa)
      mAchicar.uniforms.tImagen.value = mundo.texture; mAchicar.uniforms.uPaso.value.set(1 / w, 1 / h); pasar(mAchicar, mitadA);
      borronear(mitadA, mitadB, 1);
      mAchicar.uniforms.tImagen.value = mitadA.texture; mAchicar.uniforms.uPaso.value.set(1 / mitadA.width, 1 / mitadA.height); pasar(mAchicar, cuartoA);
      borronear(cuartoA, cuartoB, 2);
      // el brillo: lo muy iluminado, bien desenfocado
      mBrillante.uniforms.tImagen.value = cuartoA.texture; pasar(mBrillante, brilloA);
      borronear(brilloA, brilloB, 2);
      const u = mFinal.uniforms;
      u.uFoco.value.x = foco; u.uLente.value.set(cam.near, cam.far);
      if (P) { pasar(mFinalChico, chico); mPixelar.uniforms.tImagen.value = chico.texture; pasar(mPixelar, null); }
      else pasar(mFinal, null);
    },
    // para ajustar a mano desde la consola
    datos: mFinal.uniforms,
  };
}

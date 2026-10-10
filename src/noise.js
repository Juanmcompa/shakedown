// Ruido suave y repetible (misma semilla = mismo terreno).

export function azar(semilla) {
  let a = semilla >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function crearRuido(semilla) {
  const r = azar(semilla);
  const N = 256, tabla = new Float32Array(N * N);
  for (let i = 0; i < N * N; i++) tabla[i] = r();
  const v = (x, y) => tabla[((y & 255) << 8) | (x & 255)];
  // valor entre 0 y 1
  function n2(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    let fx = x - xi, fy = y - yi;
    fx = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
    fy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
    const a = v(xi, yi), b = v(xi + 1, yi), c = v(xi, yi + 1), d = v(xi + 1, yi + 1);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  }
  // varias capas sumadas, valor entre -1 y 1
  function capas(x, y, n) {
    let s = 0, amp = 1, tot = 0;
    for (let i = 0; i < n; i++) {
      s += (n2(x + i * 17.3, y - i * 9.1) * 2 - 1) * amp;
      tot += amp; amp *= 0.5; x *= 2.03; y *= 2.03;
    }
    return s / tot;
  }
  return { n2, capas };
}

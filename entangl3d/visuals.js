const HOT_GRADIENT_STOPS = [
    { t: 0, color: 0x0000ff },
    { t: 1, color: 0xffffff }
];

function clamp01(x) { return Math.max(0, Math.min(1, x)); }
function lerp(a, b, t) { return a + (b - a) * t; }
function lerpColorRGB(c1Hex, c2Hex, t) {
    const c1 = new THREE.Color(c1Hex);
    const c2 = new THREE.Color(c2Hex);
    const r = lerp(c1.r, c2.r, t);
    const g = lerp(c1.g, c2.g, t);
    const b = lerp(c1.b, c2.b, t);
    return new THREE.Color(r, g, b);
}
function sampleGradientRGB(stops, t) {
    if (!stops || stops.length === 0) return new THREE.Color(1, 1, 1);
    t = clamp01(t);
    const arr = stops.slice().sort((a, b) => a.t - b.t);
    if (t <= arr[0].t) return new THREE.Color(arr[0].color);
    if (t >= arr[arr.length - 1].t) return new THREE.Color(arr[arr.length - 1].color);
    for (let i = 0; i < arr.length - 1; i++) {
        const a = arr[i], b = arr[i + 1];
        if (t >= a.t && t <= b.t) {
            const lt = (t - a.t) / (b.t - a.t);
            return lerpColorRGB(a.color, b.color, lt);
        }
    }
    return new THREE.Color(arr[arr.length - 1].color);
}

function makeCircleTexture(size = 64) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    const r = size * 0.5;
    const g = ctx.createRadialGradient(r, r, r * 0.2, r, r, r);
    g.addColorStop(0.0, 'rgba(255,255,255,1)');
    g.addColorStop(1.0, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(r, r, r, 0, Math.PI * 2);
    ctx.fill();

    const tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    return tex;
}

function getNeonColor(seed) {
    function mulberry32(a) {
      return function() {
        var t = (a += 0x6D2B79F5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }
  
    const rand = mulberry32(seed);
    const h = Math.floor(rand() * 360);
    const s = 100;
    const l = 60 + rand() * 20;
    function hslToHex(h, s, l) {
      s /= 100;
      l /= 100;
  
      const k = n => (n + h / 30) % 12;
      const a = s * Math.min(l, 1 - l);
      const f = n =>
        Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))));
  
      return (
        '#' +
        [f(0), f(8), f(4)]
          .map(x => x.toString(16).padStart(2, '0'))
          .join('')
      );
    }
  
    return new THREE.Color(hslToHex(h, s, l));
  }
  
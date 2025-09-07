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
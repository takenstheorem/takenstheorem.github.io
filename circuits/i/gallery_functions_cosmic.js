function toggleGallery() {
    if (document.querySelector('#svg-fullscreen-wrapper')) return;

    const svg = document.querySelector('svg');
    if (!svg) return console.error('No SVG found on page');

    const clone = svg.cloneNode(true);
    const viewBox = clone.getAttribute('viewBox')?.split(' ').map(Number);
    if (!viewBox) {
        console.error('SVG must have a viewBox set.');
        return;
    }
    const [x0, y0, w0, h0] = viewBox;

    let zoomGroup = clone.querySelector('#zoom-group');
    if (!zoomGroup) {
        zoomGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        zoomGroup.id = 'zoom-group';
        while (clone.firstChild) zoomGroup.appendChild(clone.firstChild);
        clone.appendChild(zoomGroup);
    }

    const vectorGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    vectorGroup.id = 'vector-group';
    while (zoomGroup.firstChild) vectorGroup.appendChild(zoomGroup.firstChild);
    zoomGroup.appendChild(vectorGroup);
    const rasterImage = document.createElementNS('http://www.w3.org/2000/svg', 'image');
    rasterImage.id = 'raster-image';
    rasterImage.setAttribute('x', x0);
    rasterImage.setAttribute('y', y0);
    rasterImage.setAttribute('width', w0);
    rasterImage.setAttribute('height', h0);
    rasterImage.style.opacity = '0'; 
    zoomGroup.appendChild(rasterImage);

    (function generateRaster() {
        const RASTER_SCALE = 10; 

        const serializer = new XMLSerializer();
        const svgString = serializer.serializeToString(svg);
        const svgDataUrl = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgString)));

        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = w0 * RASTER_SCALE;
            canvas.height = h0 * RASTER_SCALE;
            const ctx = canvas.getContext('2d', {
                willReadFrequently: true, 
                alpha: true                
            }); 
            ctx.fillStyle = 'transparent';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            ctx.scale(RASTER_SCALE, RASTER_SCALE);
            ctx.drawImage(img, 0, 0);

            rasterImage.setAttributeNS('http://www.w3.org/1999/xlink', 'href', canvas.toDataURL('image/png', 1.0));
        };
        img.src = svgDataUrl;
    })();

    const wrapper = document.createElement('div');
    wrapper.id = 'svg-fullscreen-wrapper';
    Object.assign(wrapper.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        width: '100vw',
        height: '100vh',
        zIndex: '9999',
        background: '#000',
        margin: '0',
        overflow: 'hidden',
    });
    wrapper.appendChild(clone);
    document.body.appendChild(wrapper);

    Object.assign(clone.style, {
        width: '100%',
        height: '100%',
        display: 'block',
    });

    if (wrapper.requestFullscreen) wrapper.requestFullscreen().catch(() => { });

    function exit() {
        cancelAnimationFrame(animFrame);
        wrapper.remove();
        window.removeEventListener('keydown', escHandler);
        document.removeEventListener('fullscreenchange', fullscreenHandler);
        if (document.fullscreenElement) document.exitFullscreen().catch(() => { });
    }
    const escHandler = (e) => {
        if (e.key === 'Escape') exit();
    };
    const fullscreenHandler = () => {
        if (!document.fullscreenElement) exit();
    };
    window.addEventListener('keydown', escHandler);
    document.addEventListener('fullscreenchange', fullscreenHandler);

    let t = Math.PI/2;
    let animFrame;
    let lastUpdate = 0;

    function draw(timestamp) {
        const ms_target = 1000 / document.getElementById('fps').value;
        if (timestamp - lastUpdate < ms_target) {
            t += Number(document.getElementById('speed').value);
            animFrame = requestAnimationFrame(draw);
            return;
        };
        const fac = 200*Math.sin(t)+201.75;
        const scale = fac; 
        const cx = x0 + w0 / 2;
        const cy = y0 + h0 / 2;

        const tx = cx - cx * scale - 100*(scale-1.75)*Math.cos((t-1.75)/2);
        const ty = cy - cy * scale;
        zoomGroup.setAttribute('transform', `translate(${tx},${ty}) scale(${scale})`);

        if (scale < 20) {
            rasterImage.style.opacity = '1';
            vectorGroup.style.opacity = '0';
        } else {
            rasterImage.style.opacity = '0';
            vectorGroup.style.opacity = '1';
        }
        lastUpdate = timestamp;

        t += Number(document.getElementById('speed').value);
        animFrame = requestAnimationFrame(draw);
    }

    draw();
}

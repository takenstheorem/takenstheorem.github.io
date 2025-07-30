let animationActive = false;
let isFullscreen = false;
let originalStyle = {};
let originalParent = null;
let fullscreenContainer = null;

let currentSvg = null;
let activeSvg = null;
let animationTransition = false;

let galleryOptionsVisible = false;
function toggleGalleryOptions() {
    galleryOptionsVisible = !galleryOptionsVisible;
    document.getElementById('options').style.display = galleryOptionsVisible ? 'block' : 'none';
}

document.getElementById('gallery_options').innerHTML = `
    Full screen mode<sup>beta</sup> <span style="cursor: pointer;" onclick="toggleGalleryOptions()">...</span>
    <div id='options' style="display: none; padding: 10px; background-color: #555; border-radius: 6px;">
    <b>v0.1 7/19/25</b><br />
    Click 'go' to enter. Type 'x' to exit. This mode uses the SVG, raw data, displayed in transitions. SVG is large, it may help to tune these parameters for your system. Note: Tested in Brave, render may be slightly different in other browsers.<br />

    <input type="checkbox" id="fadeIn" checked>fade in <br />    

    <label for="fps">frames per second:</label><br />    
    <input type="range" id="fps" min="1" max="120" step="1" value="30">
    <span id="fpsVal">30</span>
    <br />

    <label for="transitionTime">transition time (ms):</label><br />    
    <input type="range" id="transitionTime" min="5000" max="120000" step="100" value="10000">
    <span id="transitionTimeVal">10000</span>
    <br />

    <label for="speed">drift speed:</label><br />
    <span id="speedVal">0.00010</span>
    <input type="range" id="speed" min="0.00001" max=".0005" step="0.00001" value="0.0001">
    <br />

    <label for="zoomRange">zoom range:</label><br />
    closest <input type="range" id="zoomRangeMin" min="0.0001" max=".05" step="0.0001" value="0.025"> <span id="zoomRangeMinVal">0.0250</span><br />
    farthest <input type="range" id="zoomRangeMax" min="0.05" max=".3" step="0.0001" value="0.2"> <span id="zoomRangeMaxVal">0.2000</span><br />
    <button onclick="animationActive = true; toggleFullscreen();">go</button>
    </div>
`;

function updateValue(id, formatter = v => v) {
    const slider = document.getElementById(id);
    const span = document.getElementById(id + 'Val');
    slider.addEventListener('input', () => {
        span.textContent = formatter(slider.value);
    });
}

updateValue('transitionTime');
updateValue('speed', v => parseFloat(v).toFixed(5));
updateValue('zoomRangeMin', v => parseFloat(v).toFixed(4));
updateValue('zoomRangeMax', v => parseFloat(v).toFixed(4));
updateValue('fps', v => parseFloat(v).toFixed(0));

async function zoomToAnchors() {
    if (!animationActive || animationTransition) return;
    animationTransition = true;

    console.log('zooming');

    const newSvg = currentSvg.cloneNode(true);
    Object.keys(originalStyle).forEach(prop => {
        newSvg.style[prop] = originalStyle[prop];
    });
    fullscreenContainer.appendChild(newSvg);
    newSvg.style.width = '100%';
    newSvg.style.height = '100%';
    newSvg.style.position = 'absolute';
    newSvg.style.display = 'block';
    newSvg.style.top = '0';
    newSvg.style.left = '0';
    newSvg.style.opacity = '0';
    newSvg.style.willChange = 'transform, opacity';
    if (document.getElementById('fadeIn').checked) {
        newSvg.style.transition = 'opacity 3s';
        requestAnimationFrame(() => {
            newSvg.style.opacity = '1';
        });
    } else {
        newSvg.style.opacity = '1';
    }

    const [minX, minY, width, height] = originalViewBox.split(' ').map(Number);
    const marginX = width * 0.2;
    const marginY = height * 0.2;
    const safeMinX = minX + marginX;
    const safeMaxX = minX + width - marginX;
    const safeMinY = minY + marginY;
    const safeMaxY = minY + height - marginY;
    const randomCenterX = Math.random() * (safeMaxX - safeMinX) + safeMinX;
    const randomCenterY = Math.random() * (safeMaxY - safeMinY) + safeMinY;
    const minv = Number(document.getElementById('zoomRangeMin').value);
    const maxv = Number(document.getElementById('zoomRangeMax').value);
    const initialZoom = width * (Math.random() * (maxv - minv) + minv);
    const endZoom = Math.random() < .5 ? initialZoom * 5 : initialZoom * 0.05;
    const startX = randomCenterX - initialZoom / 2;
    const startY = randomCenterY - initialZoom / 2;
    newSvg.setAttribute('viewBox', `${startX} ${startY} ${initialZoom} ${initialZoom}`);

    if (activeSvg) {
        activeSvg.style.opacity = '0';
        // remove first svg child
        setTimeout(() => {
            fullscreenContainer.removeChild(fullscreenContainer.children[0]);
        }, 4000);
    }
    console.log(newSvg.style.opacity);
    activeSvg = newSvg;

    // if (fullscreenContainer) {
    //     console.log('Container children:', fullscreenContainer.children.length);
    //     console.log('Container children details:', Array.from(fullscreenContainer.children).map(c => ({
    //         tagName: c.tagName,
    //         id: c.id,
    //         class: c.className
    //     })));
    // }

    let progress = 0;
    const step = Number(document.getElementById('speed').value);
    const fps = Number(document.getElementById('fps').value);
    const targetCenterX = minX + width / 2;
    const targetCenterY = minY + height / 2;
    let lastFrameTime = Date.now();
    let elapsed = 0;

    function animate() {
        const now = Date.now();
        if (now - lastFrameTime < 1000 / fps || !animationActive) {
            requestAnimationFrame(animate);
            return;
        }

        elapsed += now - lastFrameTime;
        lastFrameTime = now;
        progress += step;

        const currentCenterX = randomCenterX + (targetCenterX - randomCenterX) * progress;
        const currentCenterY = randomCenterY + (targetCenterY - randomCenterY) * progress;
        const currentZoom = initialZoom + (endZoom - initialZoom) * progress * 2;
        const viewBoxX = currentCenterX - currentZoom / 2;
        const viewBoxY = currentCenterY - currentZoom / 2;
        newSvg.setAttribute('viewBox', `${viewBoxX} ${viewBoxY} ${currentZoom} ${currentZoom}`);

        if (elapsed < Number(document.getElementById('transitionTime').value) && animationActive) {
            requestAnimationFrame(animate);
        } else {
            newSvg.style.opacity = '0';
            animationTransition = false;
            zoomToAnchors(); // loop
        }
    }
    requestAnimationFrame(animate);
}

async function toggleFullscreen() {

    if (isFullscreen) {
        try {
            if (document.exitFullscreen) {
                await document.exitFullscreen();
            } else if (document.webkitExitFullscreen) { /* Safari */
                await document.webkitExitFullscreen();
            } else if (document.msExitFullscreen) { /* IE11 */
                await document.msExitFullscreen();
            }
        } catch (e) {
            console.log('Could not exit fullscreen:', e);
        }
        
        await new Promise(resolve => setTimeout(resolve, 500));

        if (fullscreenContainer) {
            animationActive = false;
            fullscreenContainer.remove();
            originalParent.appendChild(currentSvg);

            Object.keys(originalStyle).forEach(prop => {
                currentSvg.style[prop] = originalStyle[prop];
            });

            currentSvg.setAttribute('viewBox', originalViewBox);

            currentSvg.style.display = 'block';
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        activeSvg = null;
        currentSvg = null;
        originalParent = null;
        fullscreenContaier = null;

    } else {
        currentSvg = document.querySelector('svg');
        originalStyle = {
            position: currentSvg.style.position,
            top: currentSvg.style.top,
            left: currentSvg.style.left,
            width: currentSvg.style.width,
            height: currentSvg.style.height,
            margin: currentSvg.style.margin,
            padding: currentSvg.style.padding,
            backgroundColor: currentSvg.style.backgroundColor
        };
        originalParent = currentSvg.parentNode;

        currentSvg.style.display = 'none';
        await new Promise(resolve => setTimeout(resolve, 500));

        fullscreenContainer = document.createElement('div');
        fullscreenContainer.className = 'fullscreen';
        document.body.appendChild(fullscreenContainer);
        fullscreenContainer.appendChild(currentSvg);

        if (fullscreenContainer.requestFullscreen) {
            await fullscreenContainer.requestFullscreen();
        } else if (fullscreenContainer.webkitRequestFullscreen) { /* Safari */
            await fullscreenContainer.webkitRequestFullscreen();
        } else if (fullscreenContainer.msRequestFullscreen) { /* IE11 */
            await fullscreenContainer.msRequestFullscreen();
        }

        zoomToAnchors();
    }

    isFullscreen = !isFullscreen;
}

document.addEventListener('keydown', (event) => {
    if (event.key === 'x' && isFullscreen) {
        animationActive = false;
        toggleFullscreen();
    }
});

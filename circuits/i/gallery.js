let zoomInterval = null;
let curZoom = 301;
let randomAnchor = null;
let x = null;
let y = null;
let isPanning = false;
let isFirstZoom = true;

// Smoothly transition SVG viewBox using d3
function transitionViewBox(svg, newViewBox, duration = 6000) {
    const currentViewBox = svg.getAttribute('viewBox');
    // Interrupt any ongoing transitions on this SVG
    d3.select(svg).interrupt();
    d3.select(svg)
        .transition()
        .duration(duration)
        .attrTween('viewBox', () => {
            const interp = d3.interpolateString(currentViewBox, newViewBox);
            return t => interp(t);
        });
}

function zoomToAnchors() {
    const svg = document.querySelector('svg');
    const anchors = Array.from(document.querySelectorAll('#output a'));
    if (anchors.length === 0) return;

    const [minX, minY, width, height] = originalViewBox.split(' ').map(Number);
    const maxX = minX + width;
    const maxY = minY + height;
    const marginX = width * 0.1;
    const marginY = height * 0.1;
    const safeMinX = minX + marginX;
    const safeMaxX = maxX - marginX;
    const safeMinY = minY + marginY;
    const safeMaxY = maxY - marginY;

    if (curZoom > 300) {
        randomAnchor = anchors[Math.floor(Math.random() * anchors.length)];
        x = parseFloat(randomAnchor.style.left);
        y = parseFloat(randomAnchor.style.top);
        x = Math.max(safeMinX, Math.min(x, safeMaxX));
        y = Math.max(safeMinY, Math.min(y, safeMaxY));
    }

    // Update zoom level
    curZoom = curZoom > 300 ? 2 : curZoom * 2;
    let randomZoom = curZoom;

    if (isPanning) {
        // select a random anchor but make sure it's nearby to the current anchor using euclidean distance between cur_x,cur_y and the selected x and y
        let minDistance = Number.MAX_VALUE;
        let selectedAnchor = null;
        
        distances = [];
        for (let i = 0; i < anchors.length; i++) {
            // if (anchors[i] === randomAnchor) continue;
            let anchor = anchors[i];
            let anchorX = parseFloat(anchor.style.left);
            let anchorY = parseFloat(anchor.style.top);
            let distance = Math.sqrt(Math.pow(anchorX - x, 2) + Math.pow(anchorY - y, 2));
            distances.push(distance);
        }
        // select from shortest 10 distances randomly
        let sortedDistances = distances.sort((a, b) => a - b);
        let selectedDistance = sortedDistances[Math.floor(Math.random() * 10)];
        selectedAnchor = anchors[distances.indexOf(selectedDistance)];                
        randomAnchor = selectedAnchor;

        x = parseFloat(randomAnchor.style.left);
        y = parseFloat(randomAnchor.style.top);
        x = Math.max(safeMinX, Math.min(x, safeMaxX));
        y = Math.max(safeMinY, Math.min(y, safeMaxY));
        randomZoom = Math.random() * 30 + 2;
    }

    // Calculate new viewBox
    const halfZoom = randomZoom / 2;
    let viewBoxX = x - halfZoom;
    let viewBoxY = y - halfZoom;

    // Ensure viewBox stays within bounds
    viewBoxX = Math.max(minX, Math.min(viewBoxX, maxX - randomZoom));
    viewBoxY = Math.max(minY, Math.min(viewBoxY, maxY - randomZoom));

    // Smoothly transition to the new viewBox using d3
    const newViewBox = `${viewBoxX} ${viewBoxY} ${randomZoom} ${randomZoom}`;
    const duration = isFirstZoom ? 0 : 4000;
    transitionViewBox(svg, newViewBox, duration);
    isFirstZoom = false;
}

let isFullscreen = false;
let originalStyle = {};
let originalParent = null;
let fullscreenContainer = null;

async function toggleFullscreen() {
    const svg = document.querySelector('svg');

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

        if (zoomInterval) {
            clearInterval(zoomInterval);
            zoomInterval = null;
        }

        svg.style.opacity = '0';
        await new Promise(resolve => setTimeout(resolve, 2000));

        if (fullscreenContainer && originalParent) {
            fullscreenContainer.remove();
            originalParent.appendChild(svg);

            Object.keys(originalStyle).forEach(prop => {
                svg.style[prop] = originalStyle[prop];
            });
            svg.setAttribute('viewBox', originalViewBox);
            svg.style.opacity = '1';
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    } else {
        isFirstZoom = true;
        originalStyle = {
            position: svg.style.position,
            top: svg.style.top,
            left: svg.style.left,
            width: svg.style.width,
            height: svg.style.height,
            margin: svg.style.margin,
            padding: svg.style.padding,
            backgroundColor: svg.style.backgroundColor
        };
        originalParent = svg.parentNode;

        fullscreenContainer = document.createElement('div');
        fullscreenContainer.className = 'fullscreen';
        document.body.appendChild(fullscreenContainer);
        fullscreenContainer.appendChild(svg);
        svg.style.width = '100%';
        svg.style.height = '100%';
        svg.style.display = 'block';

        if (fullscreenContainer.requestFullscreen) {
            await fullscreenContainer.requestFullscreen();
        } else if (fullscreenContainer.webkitRequestFullscreen) { /* Safari */
            await fullscreenContainer.webkitRequestFullscreen();
        } else if (fullscreenContainer.msRequestFullscreen) { /* IE11 */
            await fullscreenContainer.msRequestFullscreen();
        }

        zoomToAnchors();
        zoomInterval = setInterval(zoomToAnchors, document.getElementById('time-between-scales').value);
    }

    isFullscreen = !isFullscreen;
}

document.addEventListener('keydown', (event) => {
    if ((event.key === 'x' || event.key === 'X') && isFullscreen) {
        const svg = document.querySelector('svg');
        d3.select(svg).interrupt();                
        if (zoomInterval) {
            clearInterval(zoomInterval);
            zoomInterval = null;
        }
        curZoom = 301;
        isPanning = false;
        toggleFullscreen();
    }
});

function togglePanscreen() {
    // document.getElementById('time-between-scales').value = 30000;
    // document.getElementById('time-between-scales-value').textContent = 30000;
    isPanning = true;
    toggleFullscreen();
}

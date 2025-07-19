let currentZoomIndex = 0;
// 2 to 300 by 10
const zoomLevels = [2, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200, 210, 220, 230, 240, 250, 260, 270, 280, 290, 300];
let currentCenter = { x: 0, y: 0 };

async function zoomToAnchors() {
  const svg = document.querySelector('svg');
  const anchors = Array.from(document.querySelectorAll('#output a'));

  if (anchors.length === 0) return;

  // Only pick a new random anchor if we're starting a new cycle
  if (currentZoomIndex === 0) {
    const [minX, minY, width, height] = originalViewBox.split(' ').map(Number);
    const maxX = minX + width;
    const maxY = minY + height;

    const marginX = width * 0.2;
    const marginY = height * 0.2;
    const safeMinX = minX + marginX;
    const safeMaxX = maxX - marginX;
    const safeMinY = minY + marginY;
    const safeMaxY = maxY - marginY;

    const randomAnchor = anchors[Math.floor(Math.random() * anchors.length)];
    currentCenter.x = Math.max(safeMinX, Math.min(parseFloat(randomAnchor.style.left), safeMaxX));
    currentCenter.y = Math.max(safeMinY, Math.min(parseFloat(randomAnchor.style.top), safeMaxY));
  }

  // Get current zoom level and calculate viewBox
  const zoom = zoomLevels[currentZoomIndex];
  const halfZoom = zoom / 2;
  const viewBoxX = currentCenter.x - halfZoom;
  const viewBoxY = currentCenter.y - halfZoom;

  // Apply the viewBox instantly
  svg.style.transition = 'none';
  svg.setAttribute('viewBox', `${viewBoxX} ${viewBoxY} ${zoom} ${zoom}`);

  // Stay at this zoom level for a moment
  const delay = currentZoomIndex < zoomLevels.length / 2 ? 3500 : 2000;
  await new Promise(resolve => setTimeout(resolve, delay));

  // Move to next zoom level, or reset if at the end
  currentZoomIndex = (currentZoomIndex + 1) % zoomLevels.length;
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

    svg.style.opacity = '0.2';
    await new Promise(resolve => setTimeout(resolve, 500));

    if (fullscreenContainer && originalParent) {
      fullscreenContainer.remove();
      originalParent.appendChild(svg);

      Object.keys(originalStyle).forEach(prop => {
        svg.style[prop] = originalStyle[prop];
      });

      svg.setAttribute('viewBox', originalViewBox);

      svg.style.opacity = '1';
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  } else {
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
    console.log(originalStyle);
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
    zoomInterval = setInterval(zoomToAnchors, 5000);
  }

  isFullscreen = !isFullscreen;
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'g' || event.key === 'G') {
    toggleFullscreen();
  }
});

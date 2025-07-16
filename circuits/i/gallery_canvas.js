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
    if (!window.svgViewBox) return;
    
    const state = getCanvasState();
    const { x: minX, y: minY, w: width, h: height } = window.svgViewBox;
    const maxX = minX + width;
    const maxY = minY + height;
    
    // Track if this is the first zoom
    if (typeof window.isFirstZoom === 'undefined') {
        window.isFirstZoom = true;
    }
    
    // Calculate the 80% centered rectangle
    const marginX = width * 0.1;
    const marginY = height * 0.1;
    const centerX = minX + width / 2;
    const centerY = minY + height / 2;
    
    // Calculate a random point within the 80% centered rectangle
    const randomX = centerX + (Math.random() - 0.5) * (width * 0.8);
    const randomY = centerY + (Math.random() - 0.5) * (height * 0.8);
    
    // Calculate zoom level - start zoomed out, then zoom in
    let targetZoom;
    if (window.curZoom > 300) {
        // First zoom - start zoomed out
        targetZoom = Math.max(width, height) * 0.8; // Show 80% of the larger dimension
        window.curZoom = 1; // Reset zoom counter
    } else {
        // Subsequent zooms - gradually zoom in
        targetZoom = 10 + Math.random() * 20; // Random zoom between 10-30
        window.curZoom = (window.curZoom || 0) + 1;
    }
    
    // Ensure we stay within bounds
    const halfZoom = targetZoom / 2;
    let viewBoxX = randomX - halfZoom;
    let viewBoxY = randomY - halfZoom;
    
    // Clamp to bounds
    viewBoxX = Math.max(minX, Math.min(viewBoxX, maxX - targetZoom));
    viewBoxY = Math.max(minY, Math.min(viewBoxY, maxY - targetZoom));
    
    // For canvas animation
    if (state.canvas && state.baseLayer) {
        const duration = window.isFirstZoom ? 0 : 4000;
        animateCanvasToViewBox(viewBoxX, viewBoxY, targetZoom, duration);
        window.isFirstZoom = false;
    }
    
    // For SVG fallback
    const svg = document.querySelector('svg');
    if (svg) {
        const newViewBox = `${viewBoxX} ${viewBoxY} ${targetZoom} ${targetZoom}`;
        const duration = window.isFirstZoom ? 0 : 4000;
        transitionViewBox(svg, newViewBox, duration);
    }
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
        disableCanvasMode();
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

        // Switch to efficient canvas rendering
        await enableCanvasMode(fullscreenContainer);

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
        disableCanvasMode();
        }
        curZoom = 301;
        isPanning = false;
        toggleFullscreen();
    }
});

function togglePanscreen() {
    // Canvas pan mode unavailable; fallback to SVG pan.
    // TODO: integrate canvas pan if desired.
    
    // document.getElementById('time-between-scales').value = 30000;
    // document.getElementById('time-between-scales-value').textContent = 30000;
    isPanning = true;
    toggleFullscreen();
}

/**********************
 * Canvas Mode Section
 * High-DPI bitmap copy of the SVG with buttery-smooth pan/zoom
 **********************/
// Use an object to keep our canvas state together and ensure it's globally accessible
window.canvasState = window.canvasState || {
    canvas: null,
    ctx: null,
    baseLayer: null,
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
    activePointerId: null
};

// Increase the resolution scale for better quality
const RESOLUTION_SCALE = 2;

// Helper function to get canvas state with null checks
function getCanvasState() {
    return window.canvasState || {};
}

function enableCanvasMode(parentEl = document.body) {
    // Initialize or reset canvas state
    window.canvasState = {
        canvas: document.createElement('canvas'),
        ctx: null,
        baseLayer: document.createElement('canvas'),
        scale: 1,
        offsetX: 0,
        offsetY: 0,
        isDragging: false,
        dragStartX: 0,
        dragStartY: 0,
        activePointerId: null
    };
    
    const state = window.canvasState;
    
    // Get the SVG element
    const svg = document.querySelector('svg');
    if (!svg) return;
    
    // Set up the canvas element
    state.canvas.id = 'svgCanvas';
    state.canvas.style.pointerEvents = 'auto';
    state.canvas.style.touchAction = 'none';
    state.canvas.style.position = 'fixed';
    state.canvas.style.top = '0';
    state.canvas.style.left = '0';
    state.canvas.style.width = '100%';
    state.canvas.style.height = '100%';
    state.canvas.style.zIndex = '999';
    
    // Get 2D context
    state.ctx = state.canvas.getContext('2d');
    if (!state.ctx) {
        console.error('Could not get 2D context');
        return;
    }
    
    // Add canvas to DOM
    parentEl.appendChild(state.canvas);
    
    // Store original viewBox for reference
    const viewBox = svg.getAttribute('viewBox');
    const [x, y, w, h] = viewBox ? viewBox.split(' ').map(Number) : [0, 0, 921, 921];
    
    // Store original dimensions for calculations
    window.svgViewBox = { x, y, w, h };
    
    // Hide the SVG but keep it in the DOM for accessibility / export
    svg.style.display = 'none';

    // Dump SVG into an <img> and then into an OffscreenCanvas
    const svgText = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([svgText], { type: 'image/svg+xml' });
    const url  = URL.createObjectURL(blob);
    const img  = new Image();
    
    // High-DPI sizing
    resizeCanvas();

    img.onload = () => {
        // Use viewBox if image natural size is 0
        let imgW = img.naturalWidth || 0;
        let imgH = img.naturalHeight || 0;
        
        if (imgW === 0 || imgH === 0) {
            const vb = (svg.getAttribute('viewBox') || '0 0 921 921').split(/\s+/).map(Number);
            imgW = vb[2];
            imgH = vb[3];
        }
        
        // Create high-resolution base layer
        state.baseLayer.width = w * RESOLUTION_SCALE;
        state.baseLayer.height = h * RESOLUTION_SCALE;
        const bctx = state.baseLayer.getContext('2d');
        
        // Scale up the context for high-res rendering
        bctx.scale(RESOLUTION_SCALE, RESOLUTION_SCALE);
        
        // Draw the SVG onto our high-res base layer
        bctx.drawImage(img, -x, -y, w, h);
        
        // Set initial scale to fit canvas
        const scale = Math.min(
            window.innerWidth / w,
            window.innerHeight / h
        ) * 0.9; // 90% of container to add some padding
        
        // Update canvas state
        state.scale = scale / RESOLUTION_SCALE;
        state.offsetX = (window.innerWidth - w * scale) / 2; // Center horizontally
        state.offsetY = (window.innerHeight - h * scale) / 2; // Center vertically
        URL.revokeObjectURL(url);
        
        // Now that baseLayer is ready, we can start the animation
        if (state.canvas && state.baseLayer && state.ctx) {
            // Add event listeners now that canvas is ready
            state.canvas.addEventListener('wheel', handleWheel, { passive: false });
            state.canvas.addEventListener('pointerdown', handlePointerDown);
            window.addEventListener('resize', resizeCanvas);
            
            // Initial draw
            redrawCanvas();
        }
    };
    
    img.onerror = (e) => {
        console.error('Failed to load SVG image:', e);
    };
    
    img.src = url;
}

function resizeCanvas() {
    const state = getCanvasState();
    if (!state.canvas || !state.ctx) return;
    
    const dpr = window.devicePixelRatio || 1;
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    // Set canvas size in device pixels
    state.canvas.width = width * dpr;
    state.canvas.height = height * dpr;
    
    // Set canvas display size in CSS pixels
    state.canvas.style.width = width + 'px';
    state.canvas.style.height = height + 'px';
    
    // Scale the context to handle high DPI
    state.ctx.setTransform(1, 0, 0, 1, 0, 0);
    state.ctx.scale(dpr, dpr);
    
    redrawCanvas();
}

function animateCanvasToViewBox(targetX, targetY, targetScale, duration = 2000) {
    const state = getCanvasState();
    if (!state || !state.canvas) return;
    
    // Stop any ongoing animation
    if (window.animationFrameId) {
        cancelAnimationFrame(window.animationFrameId);
    }
    
    const startTime = performance.now();
    const startScale = state.scale || 1;
    const startX = state.offsetX || 0;
    const startY = state.offsetY || 0;
    
    function step(timestamp) {
        const elapsed = timestamp - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Simple ease-out function
        const easeOut = t => 1 - Math.pow(1 - t, 3);
        const t = easeOut(progress);
        
        // Update state
        state.scale = startScale + (targetScale - startScale) * t;
        state.offsetX = startX + (targetX - startX) * t;
        state.offsetY = startY + (targetY - startY) * t;
        
        redrawCanvas();
        
        if (progress < 1) {
            window.animationFrameId = requestAnimationFrame(step);
        } else {
            window.animationFrameId = null;
        }
    }
    
    window.animationFrameId = requestAnimationFrame(step);
}

function redrawCanvas() {
    const state = getCanvasState();
    const { canvas, ctx, baseLayer } = state;
    
    if (!canvas || !ctx || !baseLayer) {
        console.log('redrawCanvas: Required components not available', { canvas: !!canvas, ctx: !!ctx, baseLayer: !!baseLayer });
        return;
    }
    
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;
    
    // Clear the canvas
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    
    // Calculate scale to fit the base layer
    const scaleX = width / baseLayer.width * dpr;
    const scaleY = height / baseLayer.height * dpr;
    const scale = Math.min(scaleX, scaleY) * 0.9; // 90% of container
    
    // Calculate position to center the content
    const offsetX = (width - baseLayer.width * scale) / 2;
    const offsetY = (height - baseLayer.height * scale) / 2;
    
    // Apply transformations
    ctx.save();
    
    // Apply high-DPI scaling
    ctx.scale(dpr, dpr);
    
    // Apply the calculated scale and position
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);
    
    // Draw the base layer
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(baseLayer, 0, 0);
    
    ctx.restore();
    
    // Update the state with the current scale and offset
    if (state) {
        state.scale = scale;
        state.offsetX = 0;
        state.offsetY = 0;
    }
}

/**************
 * Interaction
 **************/
function handleWheel(e) {
    const state = getCanvasState();
    if (!state || !state.canvas) return;
    
    e.preventDefault();
    
    const zoomFactor = 0.001;
    const currentScale = state.scale || 1;
    const dpr = window.devicePixelRatio || 1;
    
    // Get mouse position relative to canvas
    const rect = state.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Calculate new scale with zoom toward cursor
    const zoom = 1 - e.deltaY * zoomFactor;
    const newScale = Math.max(0.1, Math.min(currentScale * zoom, 100));
    
    // Calculate the mouse position in canvas coordinates
    const canvasX = (mouseX - state.offsetX) / currentScale;
    const canvasY = (mouseY - state.offsetY) / currentScale;
    
    // Calculate the new offset to zoom toward cursor
    state.offsetX = mouseX - canvasX * newScale;
    state.offsetY = mouseY - canvasY * newScale;
    state.scale = newScale;
    
    redrawCanvas();
}

function handlePointerDown(e) {
    const state = getCanvasState();
    if (!state || !state.canvas) return;
        
    e.preventDefault();
    state.isDragging = true;
    state.dragStartX = e.clientX - (state.offsetX || 0);
    state.dragStartY = e.clientY - (state.offsetY || 0);
    state.activePointerId = e.pointerId;
        
    const canvas = state.canvas;
    canvas.setPointerCapture(state.activePointerId);
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerup', handlePointerUp);
    canvas.addEventListener('pointercancel', handlePointerUp);
}

function handlePointerUp(e) {
    const state = getCanvasState();
    if (!state || !state.isDragging) return;
        
    e.preventDefault();
        
    // Reset dragging state
    state.isDragging = false;
        
    // Clean up event listeners
    const canvas = state.canvas;
    if (canvas && state.activePointerId !== undefined) {
        canvas.releasePointerCapture(state.activePointerId);
    }
    canvas.removeEventListener('pointermove', handlePointerMove);
    canvas.removeEventListener('pointerup', handlePointerUp);
    canvas.removeEventListener('pointercancel', handlePointerUp);
        
    // Clear active pointer ID
    state.activePointerId = undefined;
}

function handlePointerMove(e) {
    const state = getCanvasState();
    if (!state || !state.isDragging) return;
        
    e.preventDefault();
    
    // Update the offset based on drag movement
    state.offsetX = e.clientX - state.dragStartX;
    state.offsetY = e.clientY - state.dragStartY;
    
    // Redraw with the new position
    redrawCanvas();
    redrawCanvas();
}

function handlePointerUp () {
    isDragging = false;
    if (activePointerId !== null && canvas.releasePointerCapture) {
        try { canvas.releasePointerCapture(activePointerId); } catch (err) {}
    }
    activePointerId = null;
    canvas.removeEventListener('pointermove', handlePointerMove);
    canvas.removeEventListener('pointerup', handlePointerUp);
    canvas.removeEventListener('pointercancel', handlePointerUp);
}

// Utility so external callers can tear down the canvas and restore the SVG
function disableCanvasMode() {
    // Set flag to indicate we're in the process of disabling
    window.isDisablingCanvas = true;
    
    // Stop any ongoing zoom intervals
    if (zoomInterval) {
        clearInterval(zoomInterval);
        zoomInterval = null;
    }
    
    // Cancel any ongoing animation frames
    const cancelAllFrames = () => {
        if (window.animationFrameId) {
            cancelAnimationFrame(window.animationFrameId);
            window.animationFrameId = null;
        }
        if (window.currentAnimationFrame) {
            cancelAnimationFrame(window.currentAnimationFrame);
            window.currentAnimationFrame = null;
        }
    };
    
    // Cancel all animation frames
    cancelAllFrames();
    
    // Show the original SVG
    const svg = document.querySelector('svg');
    if (svg) {
        svg.style.display = '';
        // Reset any transforms on the SVG
        d3.select(svg).interrupt().selectAll('*').interrupt();
    }
    
    // Clean up canvas and its event listeners
    if (window.canvasState) {
        const { canvas } = window.canvasState;
        
        // Remove all event listeners
        if (canvas) {
            // Remove event listeners first
            canvas.removeEventListener('wheel', handleWheel);
            canvas.removeEventListener('pointerdown', handlePointerDown);
            
            // Clone and replace to ensure all event listeners are removed
            const newCanvas = canvas.cloneNode(false);
            if (canvas.parentNode) {
                canvas.parentNode.replaceChild(newCanvas, canvas);
                newCanvas.remove();
            }
            
            // Remove global event listeners
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
            window.removeEventListener('pointercancel', handlePointerUp);
            window.removeEventListener('resize', resizeCanvas);
        }
        
        // Clear the canvas state
        window.canvasState = null;
    }
    
    // Reset the disabling flag
    window.isDisablingCanvas = false;
    
    // Force garbage collection if available
    if (window.gc) {
        window.gc();
    }
}


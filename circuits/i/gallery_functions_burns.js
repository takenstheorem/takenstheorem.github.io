    async function zoomToAnchors() {
      const svg = document.querySelector('svg');
      const anchors = Array.from(document.querySelectorAll('#output a'));
      
      if (anchors.length === 0) return;
      
      svg.style.transition = 'opacity 1s ease-out';
      svg.style.opacity = '0';
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
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
      let x = parseFloat(randomAnchor.style.left);
      let y = parseFloat(randomAnchor.style.top);
      
      x = Math.max(safeMinX, Math.min(x, safeMaxX));
      y = Math.max(safeMinY, Math.min(y, safeMaxY));
      
      const randomZoom = Math.pow(10, Math.random() * 2 + 0.7).toFixed(1);
      
      const halfZoom = randomZoom / 2;
      let viewBoxX = x - halfZoom;
      let viewBoxY = y - halfZoom;
      
      if (viewBoxX < minX) viewBoxX = minX;
      if (viewBoxY < minY) viewBoxY = minY;
      if (viewBoxX + randomZoom > maxX) viewBoxX = maxX - randomZoom;
      if (viewBoxY + randomZoom > maxY) viewBoxY = maxY - randomZoom;
      
      // Set the viewBox first to ensure proper dimensions
      svg.setAttribute('viewBox', `${viewBoxX} ${viewBoxY} ${randomZoom} ${randomZoom}`);
      
      // Rasterize if zoom level is too small
      if (randomZoom < 10) {
        const clone = svg.cloneNode(true);
        const serializer = new XMLSerializer();
        const svgString = serializer.serializeToString(clone);
        const svgDataUrl = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgString)));
        
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const scale = 4; // Higher scale for better quality
          canvas.width = randomZoom * scale;
          canvas.height = randomZoom * scale;
          const ctx = canvas.getContext('2d', {
            willReadFrequently: true,
            alpha: true
          });
          
          ctx.fillStyle = 'transparent';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.scale(scale, scale);
          ctx.drawImage(img, 0, 0);
          
          // Replace SVG content with the rasterized version
          while (svg.firstChild) {
            svg.removeChild(svg.firstChild);
          }
          
          const rasterImage = document.createElementNS('http://www.w3.org/2000/svg', 'image');
          rasterImage.setAttribute('x', viewBoxX);
          rasterImage.setAttribute('y', viewBoxY);
          rasterImage.setAttribute('width', randomZoom);
          rasterImage.setAttribute('height', randomZoom);
          rasterImage.setAttributeNS('http://www.w3.org/1999/xlink', 'href', canvas.toDataURL('image/png', 1.0));
          svg.appendChild(rasterImage);
        };
        img.src = svgDataUrl;
      }
      
      await new Promise(resolve => requestAnimationFrame(resolve));
      
      svg.getBoundingClientRect();
      
      await new Promise(resolve => requestAnimationFrame(resolve));
      
      svg.style.transition = 'opacity 1.5s ease-in';
      svg.style.opacity = '1';
      
      // Add drifting animation
      const driftAmount = randomZoom * 0.2; // Very subtle drift
      const driftX = (Math.random() - 0.5) * driftAmount;
      const driftY = (Math.random() - 0.5) * driftAmount;
      const zoomDirection = Math.random() > 0.5 ? 1 : -1;
      const zoomAmount = 1 + (zoomDirection * 0.1); // Very subtle zoom
      
      svg.style.transition = 'transform 30s linear';
      svg.style.transformOrigin = 'center';
      svg.style.transform = `scale(${zoomAmount}) translate(${driftX}px, ${driftY}px)`;
      
      await new Promise(resolve => setTimeout(resolve, 3000));
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
        zoomInterval = setInterval(zoomToAnchors, 15000);
      }
      
      isFullscreen = !isFullscreen;
    }
    
    document.addEventListener('keydown', (event) => {
      if (event.key === 'g' || event.key === 'G') {
        toggleFullscreen();
      }
    });
                
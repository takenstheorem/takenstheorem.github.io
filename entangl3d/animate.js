function initScene() {
    const canvas = document.getElementById('canvas');
    const scene = new THREE.Scene();
    window.scene = scene;

    const renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        antialias: false,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: false
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1));
    renderer.autoClear = true;
    renderer.setClearColor(0x000000, 1);
    window.renderer = renderer;

    const aspect = window.innerWidth / window.innerHeight;
    const camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 20000);
    window.camera = camera;

    const MAX_COORD = 500;
    const fov = camera.fov * (Math.PI / 180);
    const distance = Math.abs(MAX_COORD / Math.sin(fov / 2));
    camera.position.set(0, 0, distance);
    camera.lookAt(0, 0, 0);

    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.enablePan = true;
    controls.enableZoom = false;
    controls.minDistance = Z_STEP * 0.2;
    controls.maxDistance = Z_STEP * 20;
    window.controls = controls;
    controls.addEventListener('start', () => { isUserOrbiting = true; });
    controls.addEventListener('change', () => {
        if (window.camera && window.controls) {
            orbitOffset = window.camera.position.clone().sub(window.controls.target);
        }
    });
    controls.addEventListener('end', () => {
        isUserOrbiting = false;
        if (window.camera && window.controls) {
            orbitOffset = window.camera.position.clone().sub(window.controls.target);
        }
    });

    scene.fog = new THREE.FogExp2(0x000000, 0.0004);

    const span = document.getElementById('currentPage');
    if (span) span.style.display = 'none';

    {
        const base = Math.floor(currentZ);
        const worldZ = -currentZ * Z_STEP;
        const PASS = Z_STEP * 0.05;
        const offset = 0;
        const lookZ = worldZ - Z_STEP * 0.5;
        const target = new THREE.Vector3(0, 0, lookZ);
        const angleRad = THREE.MathUtils.degToRad(-40);
        const baseOffset = new THREE.Vector3(0, 0, CAMERA_BACK);
        const rotatedOffset = baseOffset.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), angleRad);
        window.camera.position.copy(target.clone().add(rotatedOffset));
        window.camera.lookAt(target);
        if (window.controls) {
            window.controls.target.copy(target);
            window.controls.update();
        }
        if (window.camera && window.controls) {
            orbitOffset = rotatedOffset.clone();
        }
        updateScene();
    }

    animate();

    const dom = renderer.domElement;
    dom.style.touchAction = 'none';
    function updateMouseFromEvent(event) {
        const rect = dom.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        mouseNDC.set(x, y);
    }

    function handlePointerMove(event) {
        updateMouseFromEvent(event);

        if (!window.camera || !window.scene) return;
        raycaster.setFromCamera(mouseNDC, window.camera);
        hoveredLabel = null;
        hoveredPoint = null;

        const labelHits = raycaster.intersectObjects(renderedLabels, false);
        if (labelHits.length > 0) {
            hoveredLabel = labelHits[0].object;
        } else if (clickablePoints.length > 0) {
            const pointHits = raycaster.intersectObjects(clickablePoints, false);
            if (pointHits.length > 0) {
                hoveredPoint = { object: pointHits[0].object, index: pointHits[0].index };
            }
        }
        // document.body.style.cursor = (hoveredLabel || hoveredPoint) ? 'pointer' : 'default';
        // console.log('hoveredPoint', hoveredPoint, document.body.style.cursor);

        const tip = document.getElementById('tooltip');
        if (hoveredPoint) {
            const geom = hoveredPoint.object.geometry;
            const idx = hoveredPoint.index;
            const addresses = geom && geom.userData && geom.userData.addresses;
            const blk = geom && geom.userData && geom.userData.blockNumber;
            const addr = addresses && addresses[idx];
            if (addr && Number.isFinite(blk)) {
                const stats = getAddressStats(blk, addr);
                const funcs = stats.funcs.size > 0 ? Array.from(stats.funcs).slice(0, 8).join(', ') : '—';
                tip.innerHTML = `
                    <div class="row"><span class="muted">Block</span>: ${blk}</div>
                    <div class="row"><span class="muted">Address</span>: ${addr}</div>
                    <div class="row"><span class="muted">Funcs</span>: ${funcs}</div>
                    <div class="row"><span class="muted">Value sent</span>: ${Math.round(stats.valueSent * 100) / 100}</div>
                    <div class="row"><span class="muted">Value received</span>: ${Math.round(stats.valueReceived * 100) / 100}</div>
                    <div class="row"><span class="muted">Total value (involving)</span>: ${Math.round(stats.valueTotal * 100) / 100}</div>
                `;
                if (stats.feesSpent > 0) {
                    tip.innerHTML += `<div class="row"><span class="muted">Fees (involving)</span>: ${Math.round(stats.feesSpent * 100) / 100}</div>`;
                }
                tip.style.display = 'block';
                const pad = 16;
                const vw = window.innerWidth, vh = window.innerHeight;
                tip.style.left = event.clientX + 'px';
                tip.style.top = event.clientY + 'px';
                const rect = tip.getBoundingClientRect();
                let left = event.clientX + 12;
                let top = event.clientY + 12;
                if (left + rect.width + pad > vw) left = Math.max(pad, vw - rect.width - pad);
                if (top + rect.height + pad > vh) top = Math.max(pad, vh - rect.height - pad);
                tip.style.left = left + 'px';
                tip.style.top = top + 'px';
            } else {
                tip.style.display = 'none';
            }
        } else {
            tip.style.display = 'none';
        }
    }

    function handleClick(event) {

        if (galleryInterval) {
            clearInterval(galleryInterval);
            galleryInterval = null;
        }

        if (event.target.closest('.ui-avoid,#sparkline')) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        isScrolling = false;
        console.log('clicked');

        updateMouseFromEvent(event);
        if (!window.camera || (isDragging && performance.now() - dragStartTime > 200)) {
            return;
        }

        raycaster.setFromCamera(mouseNDC, window.camera);

        const labelHits = raycaster.intersectObjects(renderedLabels, false);
        if (labelHits.length > 0) {
            const obj = labelHits[0].object;
            const blk = obj.userData && obj.userData.blockNumber;
            if (blk !== undefined && blk !== null) {
                const url = `https://etherscan.io/block/${blk}`;
                window.open(url, '_blank');
                return;
            }
        }

        const pointHits = raycaster.intersectObjects(clickablePoints, false);
        for (const hit of pointHits) {
            const geom = hit.object.geometry;
            const idx = hit.index;

            if (geom.userData && geom.userData.type === 'contract_creation') {
                const positions = geom.attributes.position.array;
                const clickPoint = hit.point;
                let closestDistSq = Infinity;
                let closestTx = null;

                for (let i = 0; i < positions.length; i += 3) {
                    const point = new THREE.Vector3(positions[i], positions[i + 1], positions[i + 2]);
                    const distSq = point.distanceToSquared(clickPoint);
                    if (distSq < closestDistSq) {
                        closestDistSq = distSq;
                        closestTx = geom.userData.transactions[i / 3];
                    }
                }

                if (closestTx) {
                    const url = `https://etherscan.io/tx/0x${closestTx.hash}`;
                    window.open(url, '_blank');
                    return;
                }
            }

            const addresses = geom && geom.userData && geom.userData.addresses;
            if (addresses && addresses[idx]) {
                const url = `https://etherscan.io/address/${addresses[idx]}`;
                window.open(url, '_blank');
                return;
            }
        }

        if (clickablePoints.length > 0) {
            for (const hit of pointHits) {                
                const obj = hit.object;
                if (obj.userData && obj.userData.type === 'transactions' && obj.userData.transactions) {
                    const position = obj.geometry.attributes.position;
                    const segments = obj.userData.segments || [];
                    const point = hit.point.clone().sub(obj.position);

                    let closestDist = Infinity;
                    let closestTx = null;

                    for (const segment of segments) {
                        const start = new THREE.Vector3().fromBufferAttribute(position, segment.start);
                        const end = new THREE.Vector3().fromBufferAttribute(position, segment.end);
                        const line = new THREE.Line3(start, end);
                        const closestPoint = new THREE.Vector3();
                        line.closestPointToPoint(point, true, closestPoint);
                        const dist = point.distanceTo(closestPoint);

                        if (dist < closestDist) {
                            closestDist = dist;
                            closestTx = obj.userData.transactions.find(tx => tx.hash === segment.hash);
                        }
                    }
                    if (closestTx && closestDist < 100 && closestTx.hash.length > 10) {
                        const url = `https://etherscan.io/tx/0x${closestTx.hash}`;
                        const newWindow = window.open(url, '_blank');
                        if (newWindow) {
                            newWindow.focus();
                        } else {
                            console.warn('Popup was blocked. Please allow popups for this site.');
                        }
                        return;
                    }
                }
            }
        }
    }
    console.log('initScene called, canvas exists:', !!document.getElementById('canvas'));

    dom.removeEventListener('pointermove', handlePointerMove, { capture: true });
    dom.removeEventListener('click', handleClick, { capture: true });
    window.removeEventListener('pointermove', handlePointerMove, { passive: true });
    window.removeEventListener('click', handleClick, { passive: true });
    dom.removeEventListener('pointerdown', mousedDown, false);

    dom.addEventListener('pointermove', handlePointerMove, { capture: true });
    dom.addEventListener('click', handleClick, { capture: false });
    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('click', handleClick, { passive: true, capture: false });
    dom.addEventListener('pointerdown', mousedDown, false);
}

function mousedDown(event) {

    event.preventDefault();
    if (galleryInterval) {
        clearInterval(galleryInterval);
        galleryInterval = null;
    }
    isScrolling = false;
    console.log('mousedDown');
}

function updateScene() {
    clearRenderedLines();
    clearRenderedLabels();
    clickablePoints = [];
    const tip = document.getElementById('tooltip');
    // if (tip) tip.style.display = 'none';

    const radius = 10;
    const start = Math.max(minBlock, Math.floor(currentZ - radius));
    const end = Math.min(maxBlock, Math.ceil(currentZ + radius));

    for (let blockNum = start; blockNum <= end; blockNum++) {
        const d = Math.abs(blockNum - currentZ);
        const t = Math.max(0, 1 - d / radius);
        const opacity = Math.pow(t, 4);
        if (opacity <= 0.05) continue;

        const objs = drawBlock(blockNum, opacity);
        renderedLines.push(...objs);

        if (blockNum > minBlock) {
            const objs = drawBlockLinkages(blockNum, opacity);
            renderedLines.push(...objs);
        }

        const sprite = getOrCreateLabel(blockNum);
        sprite.position.set(0, LABEL_Y, -blockNum * Z_STEP);
        if (!sprite.userData) sprite.userData = {};
        sprite.userData.blockNumber = blockNum;
        if (sprite.material) sprite.material.opacity = opacity;
        if (!sprite.parent) window.scene.add(sprite);
        renderedLabels.push(sprite);
    }

    const span = document.getElementById('currentPage');
    if (span) span.innerHTML = String(Math.round(currentZ));
}

function animate() {
    requestAnimationFrame(animate);
    // const diff = (targetPage - currentZ) * 0.02;    

    if (isScrolling) {
        const diff = (targetPage - currentZ) * 0.02;
        if (Math.abs(diff) > 0.0001) {
            currentZ = Math.max(minBlock, Math.min(maxBlock, currentZ + diff));
        } else {
            // currentZ = targetPage;
            isScrolling = false; // stop animating drift
            return;
        }
    }

    const base = Math.floor(currentZ);
    const frac = currentZ - base; // [0,1)
    const worldZ = -currentZ * Z_STEP; // continuous across boundaries
    const PASS = Z_STEP * 0.05; // subtle pass amount
    const offset = PASS * Math.sin(2 * Math.PI * frac);
    const camZ = worldZ + offset + CAMERA_BACK;
    const lookZ = worldZ - Z_STEP * 0.5; // look slightly ahead of current position

    if (!isUserOrbiting) {
        if (isDragging) {
            setTimeout(() => {
                isDragging = false;
            }, 100);
        }
        if (window.controls) window.controls.target.set(0, 0, lookZ);
        if (orbitOffset) {
            const desired = new THREE.Vector3(0, 0, lookZ).add(orbitOffset);
            window.camera.position.copy(desired);
        } else {
            window.camera.position.z = camZ;
        }
        window.camera.lookAt(0, 0, lookZ);
    } else {
        if (!isDragging) {
            dragStartTime = performance.now();
        }
        isDragging = true;
    }
    updateScene();

    if (window.controls) window.controls.update();
    window.renderer.render(window.scene, window.camera);
}
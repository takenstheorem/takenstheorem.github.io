function drawBlock(blockNumber, opacity = 1) {
    const blockTxs = blocksData[blockNumber] || [];
    if (blockTxs.length === 0) return [];

    const geometry = new THREE.BufferGeometry();
    const positions = [];
    const contract_creates = [];
    const contractCreateData = [];
    const colors = [];
    const total_activity = {};
    const addressCoords = {};
    const currentPoints = new Map();
    const txSegments = [];
    const txData = [];
    const personsLabels = [];

    blockTxs.forEach(tx => {
        if (tx.fromx !== undefined && tx.fromy !== undefined &&
            tx.tox !== undefined && tx.toy !== undefined) {
            total_activity[tx.from] = (total_activity[tx.from] || 0) + 1;
            total_activity[tx.to] = (total_activity[tx.to] || 0) + 1;
            if (!addressCoords[tx.from]) addressCoords[tx.from] = { x: tx.fromx, y: tx.fromy };
            if (!addressCoords[tx.to]) addressCoords[tx.to] = { x: tx.tox, y: tx.toy };
        }
    });

    let hashCounts = [];
    blockTxs.forEach(tx => {
        if (tx.fromx !== undefined && tx.fromy !== undefined &&
            tx.tox !== undefined && tx.toy !== undefined) {
            let txBump = 0;
            if (hashCounts[tx.hash] === undefined) hashCounts[tx.hash] = 0;
            hashCounts[tx.hash]++;
            if (tx.hash.length < 10 || total_activity[tx.from] < 10 || total_activity[tx.to] < 10) {
                txBump = 0;
            } else {
                txBump = ((Number('0x' + tx.hash.substr(0, 3)) + hashCounts[tx.hash]) % 128) / 20;
            }

            if (tx.tox == tx.fromx && tx.toy == tx.fromy && (tx.func == "60606040" || tx.func == "60806040")) {
                contract_creates.push(tx.fromx + 10, tx.fromy + 10, 0);
                contractCreateData.push({
                    x: tx.fromx,
                    y: tx.fromy,
                    hash: tx.hash
                });
            }


            if (source_file.split('_')[1] == 'circ.json.gz') {
                positions.push(
                    tx.fromx, tx.fromy, 0,
                    tx.tox, tx.toy, 0
                );
            } else {
                if (Math.round(tx.fromx + tx.tox) % 2 == 0) {
                    positions.push(
                        tx.fromx, tx.fromy + txBump, 0,
                        tx.tox, tx.fromy + txBump, 0,
                        tx.tox, tx.fromy + txBump, 0,
                        tx.tox, tx.toy, 0
                    );
                } else {
                    positions.push(
                        tx.fromx + txBump, tx.fromy, 0,
                        tx.fromx + txBump, tx.toy, 0,
                        tx.fromx + txBump, tx.toy, 0,
                        tx.tox, tx.toy, 0
                    );
                }
            }
            const col = new THREE.Color(tx.fail == 1 ? 0xff0000 : 0x00ff00);
            colors.push(col.r, col.g, col.b,
                col.r, col.g, col.b,
                col.r, col.g, col.b,
                col.r, col.g, col.b);

            const toPerson = personsMap.get(tx.to.toLowerCase());
            const fromPerson = personsMap.get(tx.from.toLowerCase());

            if (toPerson) {
                personsLabels.push({
                    address: tx.to,
                    x: tx.tox,
                    y: tx.toy,
                    name: toPerson.name
                });
            }

            if (fromPerson && !personsLabels.some(l => l.address.toLowerCase() === tx.from.toLowerCase())) {
                personsLabels.push({
                    address: tx.from,
                    x: tx.fromx,
                    y: tx.fromy,
                    name: fromPerson.name
                });
            }
        }
    });

    if (showPersons) {
        personsLabels.forEach(label => {
            const sprite = createTextSprite(label.name, {
                font: 'normal 24px Courier New',
                fillStyle: '#ffffff',
                padding: 8,
                bg: 'rgba(0, 0, 0, 0)'
            });
            renderedLabels.push(sprite);
            sprite.position.set(label.x, label.y + 10, -blockNumber * Z_STEP);
            window.scene.add(sprite);
            clickablePoints.push(sprite);
        });
    }

    if (contract_creates.length > 0) {
        const contract_geometry = new THREE.BufferGeometry();
        contract_geometry.setAttribute('position', new THREE.Float32BufferAttribute(contract_creates, 3));
        const contract_material = new THREE.PointsMaterial({
            size: 20,
            sizeAttenuation: true,
            color: 0x00ff00,
            transparent: true,
            opacity: 1,
            depthWrite: false
        });
        const contract_points = new THREE.Points(contract_geometry, contract_material);
        contract_points.position.z = (-blockNumber * Z_STEP);
        contract_geometry.userData = {
            type: 'contract_creation',
            blockNumber: blockNumber,
            transactions: contractCreateData
        };
        window.scene.add(contract_points);
        clickablePoints.push(contract_points);
    }

    if (positions.length === 0) return [];

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const material = new THREE.LineBasicMaterial({
        opacity: opacity,
        transparent: true,
        depthWrite: false,
        vertexColors: true
    });
    if (opacity < 1) {
        material.blending = THREE.AdditiveBlending;
    }

    const isCircular = source_file.split('_')[1] === 'circ.json.gz';

    blockTxs.forEach((tx, txIndex) => {
        if (tx.fromx !== undefined && tx.fromy !== undefined &&
            tx.tox !== undefined && tx.toy !== undefined && tx.hash) {

            const startIndex = isCircular ? txIndex * 2 : txIndex * 4;
            const endIndex = isCircular ? startIndex + 1 : startIndex + 3;

            txSegments.push({
                start: startIndex,
                end: endIndex,
                hash: tx.hash
            });

            txData.push({
                hash: tx.hash,
                from: tx.from,
                to: tx.to,
                value: tx.value,
                fail: tx.fail
            });
        }
    });

    const line = new THREE.LineSegments(geometry, material);
    line.position.z = -blockNumber * Z_STEP;
    line.userData = {
        type: 'transactions',
        blockNumber,
        segments: txSegments,
        transactions: txData
    };
    window.scene.add(line);

    clickablePoints.push(line);

    const HOT_THRESHOLD = 4;
    const LARGE_THRESHOLD = 10;
    const EXTRA_LARGE_THRESHOLD = 20;
    const smallPositions = [];
    const smallColors = [];
    const smallAddresses = [];
    const largePositions = [];
    const largeColors = [];
    const largeAddresses = [];
    const extraLargePositions = [];
    const extraLargeColors = [];
    const extraLargeAddresses = [];

    Object.keys(total_activity).forEach(addr => {
        const count = total_activity[addr];
        if (count >= HOT_THRESHOLD) {
            const coord = addressCoords[addr];
            if (!coord) return;
            const t = Math.min(1, (count - EXTRA_LARGE_THRESHOLD) / EXTRA_LARGE_THRESHOLD);
            const color = sampleGradientRGB(HOT_GRADIENT_STOPS, t);
            if (count >= LARGE_THRESHOLD && count < EXTRA_LARGE_THRESHOLD) {
                largePositions.push(coord.x, coord.y, 0);
                largeColors.push(color.r, color.g, color.b);
                largeAddresses.push(addr);
            } else if (count >= EXTRA_LARGE_THRESHOLD) {
                extraLargePositions.push(coord.x, coord.y, 0);
                extraLargeColors.push(color.r, color.g, color.b);
                extraLargeAddresses.push(addr);
            } else {
                smallPositions.push(coord.x, coord.y, 0);
                smallColors.push(color.r, color.g, color.b);
                smallAddresses.push(addr);
            }
        }
    });

    let pointsSmall = null;
    let pointsLarge = null;
    let pointsExtraLarge = null;
    if (smallPositions.length > 0) {
        const pgSmall = new THREE.BufferGeometry();
        pgSmall.setAttribute('position', new THREE.Float32BufferAttribute(smallPositions, 3));
        pgSmall.setAttribute('color', new THREE.Float32BufferAttribute(smallColors, 3));
        if (!window.circlePointTex) window.circlePointTex = makeCircleTexture(64);
        const pmSmall = new THREE.PointsMaterial({ size: 30, sizeAttenuation: true, transparent: true, opacity: Math.min(1, opacity + 0.2), vertexColors: true, depthWrite: false, map: window.circlePointTex, alphaTest: 0.5 });
        pointsSmall = new THREE.Points(pgSmall, pmSmall);
        pointsSmall.position.z = (-blockNumber * Z_STEP);
        pgSmall.userData = { addresses: smallAddresses, blockNumber: blockNumber };
        window.scene.add(pointsSmall);
        clickablePoints.push(pointsSmall);
    }
    if (largePositions.length > 0) {
        const pgLarge = new THREE.BufferGeometry();
        pgLarge.setAttribute('position', new THREE.Float32BufferAttribute(largePositions, 3));
        pgLarge.setAttribute('color', new THREE.Float32BufferAttribute(largeColors, 3));
        if (!window.circlePointTex) window.circlePointTex = makeCircleTexture(64);
        const pmLarge = new THREE.PointsMaterial({ size: 60, sizeAttenuation: true, transparent: true, opacity: Math.min(1, opacity + 0.2), vertexColors: true, depthWrite: false, map: window.circlePointTex, alphaTest: 0.5 });
        pointsLarge = new THREE.Points(pgLarge, pmLarge);
        pointsLarge.position.z = (-blockNumber * Z_STEP);
        pgLarge.userData = { addresses: largeAddresses, blockNumber: blockNumber };
        window.scene.add(pointsLarge);
        clickablePoints.push(pointsLarge);
    }
    if (extraLargePositions.length > 0) {
        const pgExtraLarge = new THREE.BufferGeometry();
        pgExtraLarge.setAttribute('position', new THREE.Float32BufferAttribute(extraLargePositions, 3));
        pgExtraLarge.setAttribute('color', new THREE.Float32BufferAttribute(extraLargeColors, 3));
        if (!window.circlePointTex) window.circlePointTex = makeCircleTexture(64);
        const pmExtraLarge = new THREE.PointsMaterial({ size: 90, sizeAttenuation: true, transparent: true, opacity: Math.min(1, opacity + 0.2), vertexColors: true, depthWrite: false, map: window.circlePointTex, alphaTest: 0.5 });
        pointsExtraLarge = new THREE.Points(pgExtraLarge, pmExtraLarge);
        pointsExtraLarge.position.z = (-blockNumber * Z_STEP);
        pgExtraLarge.userData = { addresses: extraLargeAddresses, blockNumber: blockNumber };
        window.scene.add(pointsExtraLarge);
        clickablePoints.push(pointsExtraLarge);
    }

    clickablePoints.push(line);

    if (pointsSmall && pointsLarge && pointsExtraLarge) return [line, pointsSmall, pointsLarge, pointsExtraLarge];
    if (pointsSmall && pointsLarge) return [line, pointsSmall, pointsLarge];
    if (pointsSmall) return [line, pointsSmall];
    if (pointsLarge) return [line, pointsLarge];
    return [line];
}

function drawBlockLinkages(blockNumber, opacity) {
    const blockTxsNow = blocksData[blockNumber] || [];
    const blockTxsPrev = blocksData[blockNumber - 1] || [];
    if (blockTxsNow.length === 0 || blockTxsPrev.length === 0) return [];

    const geometry = new THREE.BufferGeometry();
    const positions = [];
    const colors = [];
    const total_activity = {};
    const addressCoords = {};
    const currentPoints = new Map();
    z_now = -blockNumber * Z_STEP;
    z_prev = -(blockNumber - 1) * Z_STEP;
    const alreadyPlotted = [];

    const allPrevAddressesFrom = blockTxsPrev.map(tx => tx.from);
    const allPrevAddressesTo = blockTxsPrev.map(tx => tx.to);

    blockTxsNow.forEach(tx => {
        if (allPrevAddressesFrom.includes(tx.from) && tx.fromx !== undefined && tx.fromy !== undefined && alreadyPlotted.indexOf(tx.from) == -1) {
            positions.push(
                tx.fromx, tx.fromy, 0,
                tx.fromx, tx.fromy, Z_STEP
            );
            colors.push(.5, .5, .5, .5, .5, .5);
            alreadyPlotted.push(tx.from);
        }
        if (allPrevAddressesTo.includes(tx.to) && tx.tox !== undefined && tx.toy !== undefined && alreadyPlotted.indexOf(tx.to) == -1) {
            positions.push(
                tx.tox, tx.toy, 0,
                tx.tox, tx.toy, Z_STEP
            );
            colors.push(.5, .5, .5, .5, .5, .5);
            alreadyPlotted.push(tx.to);
        }
    });

    if (positions.length === 0) return [];

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const material = new THREE.LineBasicMaterial({
        opacity: 1,
        transparent: true,
        depthWrite: false,
        vertexColors: true
    });
    if (opacity < 1) {
        material.blending = THREE.AdditiveBlending;
    }

    const line = new THREE.LineSegments(geometry, material);
    line.position.z = -blockNumber * Z_STEP;
    window.scene.add(line);
    return [line];

}

function createTextSprite(text, options = {}) {
    const {
        font = 'bold 36px Courier New',
        fillStyle = '#ffffff',
        padding = 12,
        bg = 'rgba(0,0,0,0)'
    } = options;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    ctx.font = font;
    const metrics = ctx.measureText(text);
    const textW = Math.ceil(metrics.width);
    const textH = 46;
    canvas.width = textW + padding * 2;
    canvas.height = textH + padding * 2;

    ctx.font = font;
    ctx.textBaseline = 'top';

    if (bg) {
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    ctx.fillStyle = fillStyle;
    ctx.fillText(text, padding, padding);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;

    const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: true,
        depthWrite: false,
        opacity: 1
    });
    const sprite = new THREE.Sprite(material);
    const scale = 1.0;
    sprite.scale.set(canvas.width * scale, canvas.height * scale, 1);
    sprite.renderOrder = 1000;
    return sprite;
}

function getOrCreateLabel(blockNumber) {
    if (labelCache.has(blockNumber)) return labelCache.get(blockNumber);
    const sprite = createTextSprite(String(blockNumber));
    labelCache.set(blockNumber, sprite);
    return sprite;
}

function clearRenderedLabels() {
    renderedLabels.forEach(s => {
        if (s.parent) s.parent.remove(s);
    });
    renderedLabels = [];
    hoveredLabel = null;
    document.body.style.cursor = 'default';
}

function clearRenderedLines() {
    window.scene.children = window.scene.children.filter(child => {
        return !(child instanceof THREE.Points ||
            child instanceof THREE.PointsMaterial ||
            child instanceof THREE.BufferGeometry);
    });
    renderedLines.forEach(obj => {
        if (obj.parent) {
            obj.parent.remove(obj);
        }
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) obj.material.dispose();
    });
    renderedLines = [];
}

function positionCameraForCurrentZ() {
    const worldZ = -currentZ * Z_STEP;
    const offset = 0;
    const camZ = worldZ + offset + CAMERA_BACK;
    const lookZ = worldZ - Z_STEP * 0.5;
    if (window.controls) window.controls.target.set(0, 0, lookZ);
    if (!isUserOrbiting) {
        if (orbitOffset) {
            const desired = new THREE.Vector3(0, 0, lookZ).add(orbitOffset);
            window.camera.position.copy(desired);
        } else {
            window.camera.position.z = camZ;
        }
        window.camera.lookAt(0, 0, lookZ);
    }
}
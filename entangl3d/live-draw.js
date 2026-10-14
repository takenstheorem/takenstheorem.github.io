/*
  entangl3d live renderer patch

  Transaction colour:
    - Failed receipt: red
    - No calldata/function selector: green
    - Contract call: first six selector characters become #RRGGBB

  Examples:
    a9059cbb -> #a9059c
    095ea7b3 -> #095ea7
    23b872dd -> #23b872

  Transaction clicking:
    - Uses the exact visible transaction geometry.
    - Correctly maps both segments of the L-shaped line to one transaction.
    - Does not rely on guessed diagonal geometry.
    - Uses an enlarged line hit threshold.
*/

const LIVE_FAILED_COLOR = 0xff1710;
const LIVE_ETH_TRANSFER_COLOR = 0x00ff14;

let renderedTransactionLines = [];
let liveTxClickInstalled = false;
let livePointerStart = null;
let livePointerMoved = false;

/*
  The existing code has Points threshold only.

  This makes thin transaction lines practical to click. The value is in
  world-coordinate units, not pixels. Raise it to 20 if you want easier
  picking; lower it to 8 if dense scenes select neighbouring lines too often.
*/
raycaster.params.Line.threshold = 14;

function liveTransactionColor(tx) {
  /*
    Failed receipt status always overrides all function colouring.
  */
  if (Number(tx.fail) === 1) {
    return new THREE.Color(LIVE_FAILED_COLOR);
  }

  const selector = String(tx.func || "")
    .replace(/^0x/i, "")
    .replace(/[^0-9a-f]/gi, "")
    .toLowerCase();

  /*
    Empty calldata: ordinary native ETH transfer.
  */
  if (selector.length < 6) {
    return new THREE.Color(LIVE_ETH_TRANSFER_COLOR);
  }

  /*
    Use the first 6 hex digits as RGB.

    a9059cbb -> #a9059c
  */
  return new THREE.Color(`#${selector.slice(0, 6)}`);
}

function liveFormatEth(value) {
  const number = Number(value);

  if (!Number.isFinite(number) || number === 0) {
    return "0";
  }

  if (Math.abs(number) < 0.000001) {
    return number.toExponential(4);
  }

  return number.toLocaleString(undefined, {
    maximumFractionDigits: 8
  });
}

/*
  Replaces the original drawBlock().

  Important structural change:
  `segmentTransactions` is built as geometry vertices are appended.

  It does NOT calculate segment position from txIndex. Therefore transactions
  with missing coordinates, contract creates, or alternate line shapes cannot
  offset click mapping for every subsequent transaction.
*/
drawBlock = function drawLiveBlock(blockNumber, opacity = 1) {
  const blockTxs = blocksData[blockNumber] || [];

  if (blockTxs.length === 0) {
    return [];
  }

  const geometry = new THREE.BufferGeometry();
  const positions = [];
  const colors = [];

  const contractCreates = [];
  const contractCreateData = [];

  const totalActivity = {};
  const addressCoords = {};
  const personsLabels = [];

  /*
    Every visible line segment maps directly to its source transaction.

    For a regular rectangular route, one transaction creates two entries:
      start vertex 0 -> tx
      start vertex 2 -> tx

    For a circular/direct route, it creates one entry.
  */
  const segmentTransactions = Object.create(null);

  const seenPersonAddresses = new Set();

  for (const tx of blockTxs) {
    if (
      tx.fromx === undefined ||
      tx.fromy === undefined ||
      tx.tox === undefined ||
      tx.toy === undefined
    ) {
      continue;
    }

    totalActivity[tx.from] = (totalActivity[tx.from] || 0) + 1;
    totalActivity[tx.to] = (totalActivity[tx.to] || 0) + 1;

    if (!addressCoords[tx.from]) {
      addressCoords[tx.from] = {
        x: tx.fromx,
        y: tx.fromy
      };
    }

    if (!addressCoords[tx.to]) {
      addressCoords[tx.to] = {
        x: tx.tox,
        y: tx.toy
      };
    }

    if (
      tx.to &&
      !seenPersonAddresses.has(tx.to.toLowerCase())
    ) {
      const person = personsMap.get(tx.to.toLowerCase());

      if (person) {
        personsLabels.push({
          address: tx.to,
          x: tx.tox,
          y: tx.toy,
          name: person.name
        });

        seenPersonAddresses.add(tx.to.toLowerCase());
      }
    }

    if (
      tx.from &&
      !seenPersonAddresses.has(tx.from.toLowerCase())
    ) {
      const person = personsMap.get(tx.from.toLowerCase());

      if (person) {
        personsLabels.push({
          address: tx.from,
          x: tx.fromx,
          y: tx.fromy,
          name: person.name
        });

        seenPersonAddresses.add(tx.from.toLowerCase());
      }
    }
  }

  const hashCounts = Object.create(null);

  const circularGeometry =
    source_file.split("_")[1] === "circ.json.gz";

  for (const tx of blockTxs) {
    if (
      tx.fromx === undefined ||
      tx.fromy === undefined ||
      tx.tox === undefined ||
      tx.toy === undefined
    ) {
      continue;
    }

    const hash = String(tx.hash || "");
    const hashKey = hash.toLowerCase();

    hashCounts[hashKey] = (hashCounts[hashKey] || 0) + 1;

    let txBump = 0;

    if (
      hash.length >= 10 &&
      totalActivity[tx.from] >= 10 &&
      totalActivity[tx.to] >= 10
    ) {
      txBump = (
        (
          Number(`0x${hash.slice(0, 3)}`) +
          hashCounts[hashKey]
        ) % 128
      ) / 20;
    }

    /*
      Existing visual marker for known contract-creation bytecode patterns.
    */
    if (
      tx.tox === tx.fromx &&
      tx.toy === tx.fromy &&
      (
        tx.func === "60606040" ||
        tx.func === "60806040" ||
        tx.func === "5b620186"
      )
    ) {
      contractCreates.push(
        tx.fromx + 10,
        tx.fromy + 10,
        0
      );

      contractCreateData.push({
        x: tx.fromx,
        y: tx.fromy,
        hash: tx.hash
      });
    }

    const vertexStart = positions.length / 3;
    const color = liveTransactionColor(tx);

    if (circularGeometry) {
      /*
        One visible segment.
      */
      positions.push(
        tx.fromx, tx.fromy, 0,
        tx.tox, tx.toy, 0
      );

      colors.push(
        color.r, color.g, color.b,
        color.r, color.g, color.b
      );

      segmentTransactions[vertexStart] = tx;
    } else {
      /*
        Two visible segments forming the existing right-angle route.

        Horizontal-first or vertical-first is preserved exactly from draw.js.
      */
      if (Math.round(tx.fromx + tx.tox) % 2 === 0) {
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

      for (let i = 0; i < 4; i++) {
        colors.push(color.r, color.g, color.b);
      }

      /*
        The transaction owns both separate LineSegments:
          vertices vertexStart to vertexStart + 1
          vertices vertexStart + 2 to vertexStart + 3
      */
      segmentTransactions[vertexStart] = tx;
      segmentTransactions[vertexStart + 2] = tx;
    }
  }

  /*
    Preserve optional person labels.
  */
  if (showPersons) {
    for (const label of personsLabels) {
      const sprite = createTextSprite(label.name, {
        font: "normal 24px Courier New",
        fillStyle: "#ffffff",
        padding: 8,
        bg: "rgba(0, 0, 0, 0)"
      });

      renderedLabels.push(sprite);

      sprite.position.set(
        label.x,
        label.y + 15,
        -blockNumber * Z_STEP
      );

      sprite.userData = {
        type: "person",
        address: label.address,
        url: `https://etherscan.io/address/${label.address}`
      };

      window.scene.add(sprite);
      clickablePoints.push(sprite);
    }
  }

  /*
    Preserve contract-create point markers.
  */
  if (contractCreates.length > 0) {
    const contractGeometry = new THREE.BufferGeometry();

    contractGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(contractCreates, 3)
    );

    const contractMaterial = new THREE.PointsMaterial({
      size: 20,
      sizeAttenuation: true,
      color: LIVE_ETH_TRANSFER_COLOR,
      transparent: true,
      opacity: 1,
      depthWrite: false
    });

    const contractPoints = new THREE.Points(
      contractGeometry,
      contractMaterial
    );

    contractPoints.position.z = -blockNumber * Z_STEP;

    contractGeometry.userData = {
      type: "contract_creation",
      blockNumber,
      transactions: contractCreateData
    };

    window.scene.add(contractPoints);
    clickablePoints.push(contractPoints);
  }

  if (positions.length === 0) {
    return [];
  }

  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3)
  );

  geometry.setAttribute(
    "color",
    new THREE.Float32BufferAttribute(colors, 3)
  );

  const material = new THREE.LineBasicMaterial({
    opacity,
    transparent: true,
    depthWrite: false,
    vertexColors: true
  });

  if (opacity < 1) {
    material.blending = THREE.AdditiveBlending;
  }

  const line = new THREE.LineSegments(geometry, material);

  line.position.z = -blockNumber * Z_STEP;

  line.userData = {
    type: "transactions",
    blockNumber,

    /*
      Exact mapping between a rendered LineSegments vertex index and tx data.
    */
    segmentTransactions
  };

  window.scene.add(line);

  /*
    Transaction lines are deliberately NOT added to clickablePoints.

    Address circles, labels, and contract points can continue using the
    existing `clickablePoints` system. Transaction lines get a dedicated,
    precise picking pass in installLiveTransactionClickHandler().
  */
  renderedTransactionLines.push(line);

  /*
    Major-address points: original behavior preserved.
  */
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

  for (const address of Object.keys(totalActivity)) {
    const count = totalActivity[address];

    if (count < HOT_THRESHOLD) {
      continue;
    }

    const coordinate = addressCoords[address];

    if (!coordinate) {
      continue;
    }

    const t = Math.min(
      1,
      (count - EXTRA_LARGE_THRESHOLD) /
      EXTRA_LARGE_THRESHOLD
    );

    const color = sampleGradientRGB(HOT_GRADIENT_STOPS, t);

    if (count >= EXTRA_LARGE_THRESHOLD) {
      extraLargePositions.push(
        coordinate.x,
        coordinate.y,
        0
      );

      extraLargeColors.push(color.r, color.g, color.b);
      extraLargeAddresses.push(address);
    } else if (count >= LARGE_THRESHOLD) {
      largePositions.push(
        coordinate.x,
        coordinate.y,
        0
      );

      largeColors.push(color.r, color.g, color.b);
      largeAddresses.push(address);
    } else {
      smallPositions.push(
        coordinate.x,
        coordinate.y,
        0
      );

      smallColors.push(color.r, color.g, color.b);
      smallAddresses.push(address);
    }
  }

  const rendered = [line];

  function addAddressPoints(
    pointPositions,
    pointColors,
    addresses,
    size
  ) {
    if (pointPositions.length === 0) {
      return;
    }

    const pointGeometry = new THREE.BufferGeometry();

    pointGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(pointPositions, 3)
    );

    pointGeometry.setAttribute(
      "color",
      new THREE.Float32BufferAttribute(pointColors, 3)
    );

    if (!window.circlePointTex) {
      window.circlePointTex = makeCircleTexture(64);
    }

    const pointMaterial = new THREE.PointsMaterial({
      size,
      sizeAttenuation: true,
      transparent: true,
      opacity: Math.min(1, opacity + 0.2),
      vertexColors: true,
      depthWrite: false,
      map: window.circlePointTex,
      alphaTest: 0.5
    });

    const points = new THREE.Points(
      pointGeometry,
      pointMaterial
    );

    points.position.z = -blockNumber * Z_STEP;

    pointGeometry.userData = {
      addresses,
      blockNumber
    };

    window.scene.add(points);
    clickablePoints.push(points);
    rendered.push(points);
  }

  addAddressPoints(
    smallPositions,
    smallColors,
    smallAddresses,
    30
  );

  addAddressPoints(
    largePositions,
    largeColors,
    largeAddresses,
    60
  );

  addAddressPoints(
    extraLargePositions,
    extraLargeColors,
    extraLargeAddresses,
    90
  );

  return rendered;
};

/*
  updateScene() clears/rebuilds the visible window repeatedly, so reset the
  transaction-line registry before each rebuild.
*/
const originalUpdateScene = updateScene;

updateScene = function updateLiveScene() {
  renderedTransactionLines = [];
  originalUpdateScene();
};

/*
  Extract source transaction directly from Three.js's line-raycast hit.

  In Three.js LineSegments, `hit.index` identifies the first geometry vertex
  of the hit segment. That is precisely the key saved in segmentTransactions.
*/
function transactionFromLineHit(hit) {
  const mapping = hit.object?.userData?.segmentTransactions;

  if (!mapping) {
    return null;
  }

  const direct = mapping[hit.index];

  if (direct) {
    return direct;
  }

  /*
    Defensive fallback for older Three.js versions whose line-raycaster index
    can vary. Find the nearest actual line segment in object-local space.
  */
  const positions = hit.object.geometry?.attributes?.position;

  if (!positions) {
    return null;
  }

  const localPoint = hit.object.worldToLocal(
    hit.point.clone()
  );

  let closestDistance = Infinity;
  let closestTx = null;

  for (let start = 0; start < positions.count - 1; start += 2) {
    const from = new THREE.Vector3().fromBufferAttribute(
      positions,
      start
    );

    const to = new THREE.Vector3().fromBufferAttribute(
      positions,
      start + 1
    );

    const segment = new THREE.Line3(from, to);
    const closestPoint = new THREE.Vector3();

    segment.closestPointToPoint(
      localPoint,
      true,
      closestPoint
    );

    const distance = localPoint.distanceTo(closestPoint);

    if (distance < closestDistance) {
      closestDistance = distance;
      closestTx = mapping[start] || null;
    }
  }

  return closestTx;
}

function showLiveTransactionTooltip(tx, event) {
  const tooltip = document.getElementById("tooltip");

  if (!tooltip) {
    return;
  }

  const failed = Number(tx.fail) === 1;
  const selector = tx.func ? `0x${tx.func}` : "—";
  const txColor = liveTransactionColor(tx).getStyle();

  tooltip.innerHTML = `
    <div class="row"><span class="muted">Block</span>: ${tx.block}</div>
    <div class="row"><span class="muted">Transaction</span>: 0x${tx.hash}</div>
    <div class="row"><span class="muted">From</span>: ${tx.from}</div>
    <div class="row"><span class="muted">To</span>: ${tx.to}</div>
    <div class="row"><span class="muted">Value</span>: ${liveFormatEth(tx.value)} ETH</div>
    <div class="row"><span class="muted">Fee</span>: ${liveFormatEth(tx.fee_eth)} ETH</div>
    <div class="row"><span class="muted">Func</span>: ${selector}</div>
    <div class="row"><span class="muted">Colour</span>: ${txColor}</div>
    <div class="row"><span class="muted">Status</span>: ${failed ? "FAILED" : "SUCCESS"}</div>
    <br>
    <div class="row muted">Click again to open Etherscan.</div>
  `;

  tooltip.style.display = "block";

  const margin = 16;

  tooltip.style.left = `${event.clientX + 12}px`;
  tooltip.style.top = `${event.clientY + 12}px`;

  const tooltipBounds = tooltip.getBoundingClientRect();

  let left = event.clientX + 12;
  let top = event.clientY + 12;

  if (left + tooltipBounds.width + margin > window.innerWidth) {
    left = Math.max(
      margin,
      window.innerWidth - tooltipBounds.width - margin
    );
  }

  if (top + tooltipBounds.height + margin > window.innerHeight) {
    top = Math.max(
      margin,
      window.innerHeight - tooltipBounds.height - margin
    );
  }

  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
}

function pointToScreenSegmentDistance(
  px,
  py,
  ax,
  ay,
  bx,
  by
) {
  const abx = bx - ax;
  const aby = by - ay;

  const apx = px - ax;
  const apy = py - ay;

  const lengthSquared = abx * abx + aby * aby;

  if (lengthSquared === 0) {
    return Math.hypot(px - ax, py - ay);
  }

  const t = Math.max(
    0,
    Math.min(
      1,
      (apx * abx + apy * aby) / lengthSquared
    )
  );

  const closestX = ax + abx * t;
  const closestY = ay + aby * t;

  return Math.hypot(px - closestX, py - closestY);
}

/*
  Screen-space transaction picker.

  This deliberately does NOT use THREE.Raycaster for transaction lines.
  Raycaster's Line.threshold is world-space, causing wrong selections in
  perspective views with many stacked block layers.
*/
function findTransactionAtScreenPosition(clientX, clientY) {
  if (
    !window.camera ||
    !window.renderer ||
    !renderedTransactionLines.length
  ) {
    return null;
  }

  const canvas = window.renderer.domElement;
  const rect = canvas.getBoundingClientRect();

  const mouseX = clientX - rect.left;
  const mouseY = clientY - rect.top;

  /*
    This is a CSS-pixel threshold, so it remains visually accurate at all
    camera zoom/depth levels.
  */
  const hitThresholdPixels = 9;

  let bestMatch = null;

  window.camera.updateMatrixWorld();
  window.camera.updateProjectionMatrix();

  for (const line of renderedTransactionLines) {
    if (
      !line.visible ||
      !line.geometry ||
      !line.geometry.attributes.position
    ) {
      continue;
    }

    /*
      Ignore nearly invisible depth-faded block layers.
    */
    if (line.material && line.material.opacity < 0.08) {
      continue;
    }

    const positions = line.geometry.attributes.position;
    const transactionMap = line.userData.segmentTransactions;

    if (!transactionMap) {
      continue;
    }

    line.updateMatrixWorld();

    /*
      THREE.LineSegments has independent pairs:
        0–1, 2–3, 4–5, ...
    */
    for (let start = 0; start < positions.count - 1; start += 2) {
      const tx = transactionMap[start];

      if (!tx) {
        continue;
      }

      const startWorld = new THREE.Vector3()
        .fromBufferAttribute(positions, start)
        .applyMatrix4(line.matrixWorld);

      const endWorld = new THREE.Vector3()
        .fromBufferAttribute(positions, start + 1)
        .applyMatrix4(line.matrixWorld);

      const startNdc = startWorld.clone().project(window.camera);
      const endNdc = endWorld.clone().project(window.camera);

      /*
        Ignore segments completely outside the camera depth range.
      */
      if (
        (startNdc.z < -1 && endNdc.z < -1) ||
        (startNdc.z > 1 && endNdc.z > 1)
      ) {
        continue;
      }

      const startX = (startNdc.x * 0.5 + 0.5) * rect.width;
      const startY = (-startNdc.y * 0.5 + 0.5) * rect.height;

      const endX = (endNdc.x * 0.5 + 0.5) * rect.width;
      const endY = (-endNdc.y * 0.5 + 0.5) * rect.height;

      const pixelDistance = pointToScreenSegmentDistance(
        mouseX,
        mouseY,
        startX,
        startY,
        endX,
        endY
      );

      if (pixelDistance > hitThresholdPixels) {
        continue;
      }

      /*
        If lines overlap onscreen, prefer the nearest one to the camera.
      */
      const midpoint = startWorld.clone()
        .add(endWorld)
        .multiplyScalar(0.5);

      const cameraDistance = midpoint.distanceTo(
        window.camera.position
      );

      if (
        !bestMatch ||
        pixelDistance < bestMatch.pixelDistance - 0.5 ||
        (
          Math.abs(pixelDistance - bestMatch.pixelDistance) <= 0.5 &&
          cameraDistance < bestMatch.cameraDistance
        )
      ) {
        bestMatch = {
          tx,
          pixelDistance,
          cameraDistance
        };
      }
    }
  }

  return bestMatch;
}

function installLiveTransactionClickHandler() {
  if (liveTxClickInstalled) {
    return;
  }

  const canvas = document.getElementById("canvas");

  if (!canvas) {
    return;
  }

  liveTxClickInstalled = true;

  canvas.addEventListener("pointerdown", event => {
    livePointerStart = {
      x: event.clientX,
      y: event.clientY
    };

    livePointerMoved = false;
  }, true);

  canvas.addEventListener("pointermove", event => {
    if (!livePointerStart) {
      return;
    }

    const travel = Math.hypot(
      event.clientX - livePointerStart.x,
      event.clientY - livePointerStart.y
    );

    if (travel > 7) {
      livePointerMoved = true;
    }
  }, true);

  canvas.addEventListener("pointerup", () => {
    window.setTimeout(() => {
      livePointerStart = null;
    }, 0);
  }, true);

  let selectedHash = null;
  let selectedAt = 0;

  /*
    Capture phase ensures the accurate transaction handler runs before the
    original draw.js click handler.
  */
  canvas.addEventListener("click", event => {
    if (livePointerMoved) {
      return;
    }

    if (
      event.target.closest(
        ".ui-avoid,#sparkline,#png-screenshot-btn,#svg-screenshot-btn,#gearBtn,#homeBtn"
      )
    ) {
      return;
    }

    const match = findTransactionAtScreenPosition(
      event.clientX,
      event.clientY
    );

    /*
      No transaction line under cursor:
      allow original address-dot / label handling to continue normally.
    */
    if (!match) {
      return;
    }

    const tx = match.tx;

    /*
      Prevent the original diagonal line-selection code from opening an
      incorrect transaction.
    */
    event.preventDefault();
    event.stopImmediatePropagation();

    const now = Date.now();

    /*
      First click: inspect transaction.
      Second click on the same line within 1.5 seconds: open Etherscan.
    */
    if (
      selectedHash === tx.hash &&
      now - selectedAt < 1500
    ) {
      window.open(
        `https://etherscan.io/tx/0x${tx.hash}`,
        "_blank",
        "noopener"
      );

      selectedHash = null;
      selectedAt = 0;
      return;
    }

    selectedHash = tx.hash;
    selectedAt = now;

    showLiveTransactionTooltip(tx, event);

    console.log("Selected transaction:", {
      hash: `0x${tx.hash}`,
      block: tx.block,
      func: tx.func ? `0x${tx.func}` : null,
      fail: tx.fail,
      valueEth: tx.value,
      distancePixels: match.pixelDistance
    });
  }, true);

  console.info(
    "[entangl3d] screen-space transaction picker installed"
  );
}

/*
  initScene() has already loaded by the time this patch file runs, but is
  called later by the live loader. Wrap it so the precise click handler is
  installed immediately after the original scene setup.
*/
const originalInitScene = initScene;

initScene = function initLiveScene() {
  originalInitScene();
  installLiveTransactionClickHandler();
};

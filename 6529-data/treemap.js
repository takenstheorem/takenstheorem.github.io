function initializeTreemap(data) {
    // Set initial size based on container
    const chartContainer = d3.select('#chart');
    let width = Math.min(928, chartContainer.node().getBoundingClientRect().width - 40);
    let height = width;

    // Get all unique token_ids and sort them numerically
    const tokenIds = [...new Set(d3.merge(data.children.map(d => Object.keys(d.values))))]
        .map(Number)
        .sort((a, b) => a - b);

    // Create a color scale
    const color = d3.scaleOrdinal(d3.schemeCategory10);

    // Create a container for the visualization
    const visContainer = chartContainer
        .append("div")
        .style("position", "relative");

    // Create container for the SVG
    const chartDiv = d3.select("#chart")
        .append("div")
        .attr("class", "chart-svg-container");

    // Create the SVG container with responsive attributes
    const svg = chartDiv.append("svg")
        .attr("preserveAspectRatio", "xMidYMid meet")
        .attr("viewBox", `0 -20 ${width} ${height + 60}`)
        .style("width", "100%")
        .style("height", "auto")
        .style("display", "block")
        .style("font", "10px sans-serif");

    // Add a group for the treemap content
    const g = svg.append("g");

    // Add controls container at the top of the page
    const controls = d3.select("#controls")
        .append("div")
        .attr("class", "controls");

    // Add view mode toggle
    const controlGroup1 = controls.append("div").attr("class", "control-group");
    controlGroup1.append("span").text("View Mode: ");

    const toggleGroup = controlGroup1.append("div").attr("class", "toggle-group");

    let viewMode = 'single'; // 'single' or 'cumulative'
    let showLabels = true; // Track label visibility
    let useGrayscale = false; // Track color mode
    let animationSpeed = 1000; // Default animation speed in ms

    const toggleOptions = ['Single Token', 'Cumulative'];
    toggleGroup.selectAll('.toggle-option')
        .data(toggleOptions)
        .enter()
        .append('div')
        .attr('class', (d, i) => `toggle-option toggle-option-view ${i === 0 ? 'active' : ''}`)
        .text(d => d)
        .on('click', function (event, d) {
            const clickedOption = d3.select(this);
            const index = toggleOptions.indexOf(clickedOption.text());
            viewMode = index === 0 ? 'single' : 'cumulative';
            d3.selectAll('.toggle-option-view').classed('active', function() {
                return d3.select(this).text() === clickedOption.text();
            });

            // Update the display when switching modes
            const currentTokenIndex = +d3.select(".slider").property("value");
            updateTreemap(tokenIds[currentTokenIndex]);
        });

    // Add label toggle control
    const labelToggleGroup = controls.append("div").attr("class", "control-group");
    labelToggleGroup.append("span").text("Labels: ");

    const labelToggle = labelToggleGroup.append("div").attr("class", "toggle-group");

    labelToggle.selectAll('.toggle-option')
        .data(['Show', 'Hide'])
        .enter()
        .append('div')
        .attr('class', (d, i) => `toggle-option toggle-option-label ${i === 0 ? 'active' : ''}`)
        .text(d => d)
        .on('click', function () {
            showLabels = d3.select(this).text() === 'Show';
            const clickedText = d3.select(this).text();
            d3.selectAll('.toggle-option-label').classed('active', function() {
                return d3.select(this).text() === clickedText;
            });
            // Toggle label visibility
            d3.selectAll('.tile-text')
                .style('visibility', showLabels ? 'visible' : 'hidden');
        });

    // Add grayscale toggle control
    const grayscaleToggleGroup = controls.append("div").attr("class", "control-group");
    grayscaleToggleGroup.append("span").text("Color Mode: ");

    const grayscaleToggle = grayscaleToggleGroup.append("div").attr("class", "toggle-group");

    grayscaleToggle.selectAll('.toggle-option')
        .data(['Color', 'Grayscale'])
        .enter()
        .append('div')
        .attr('class', (d, i) => `toggle-option toggle-option-grayscale ${i === 0 ? 'active' : ''}`)
        .text(d => d)
        .on('click', function () {
            useGrayscale = d3.select(this).text() === 'Grayscale';
            const clickedText = d3.select(this).text();
            d3.selectAll('.toggle-option-grayscale').classed('active', function() {
                return d3.select(this).text() === clickedText;
            });

            // Update colors
            updateTreemapColors();
        });

    // Add token ID display and slider group
    const controlGroup2 = controls.append("div").attr("class", "control-group");

    controlGroup2.append("div")
        .attr("class", "token-display");

    // Add slider for token selection
    controlGroup2.append("input")
        .attr("type", "range")
        .attr("min", 0)
        .attr("max", tokenIds.length - 1)
        .attr("value", 0)
        .attr("step", 1)
        .attr("class", "slider")
        .on("input", function () {
            const index = +this.value; // Convert to number
            updateTreemap(tokenIds[index]);
        });

    // Add animation speed control
    const speedControlGroup = controls.append("div").attr("class", "control-group");
    speedControlGroup.append("span").text("Speed: ");

    const speedControl = speedControlGroup.append("div").style("flex-grow", "1");

    speedControl.append("input")
        .attr("type", "range")
        .attr("min", "100")
        .attr("max", "3000")
        .attr("step", "100")
        .attr("value", animationSpeed)
        .style("width", "100%")
        .on("input", function () {
            animationSpeed = 3100 - this.value; // Invert so right side is faster
            if (animationInterval) {
                clearInterval(animationInterval);
                startAnimation();
            }
        });

    // Add play/pause button
    let isPlaying = false;
    let animationInterval;

    function startAnimation() {
        if (isPlaying) {
            animationInterval = setInterval(() => {
                const currentIndex = +d3.select(".slider").property("value");
                const nextIndex = (currentIndex + 1) % tokenIds.length;
                d3.select(".slider").property("value", nextIndex).dispatch("input");
            }, animationSpeed);
        }
    }

    controls.append("button")
        .attr("id", "playPause")
        .text("Play")
        .on("click", function () {
            isPlaying = !isPlaying;
            d3.select(this).text(isPlaying ? "Pause" : "Play");

            if (isPlaying) {
                startAnimation();
            } else {
                clearInterval(animationInterval);
            }
        });

    // Store the original data for cumulative calculations
    const originalData = JSON.parse(JSON.stringify(data));

    // Function to update rectangle colors based on current mode
    function updateTreemapColors() {
        d3.selectAll('.tile')
            .transition()
            .duration(200)
            .attr('fill', d => {
                if (useGrayscale) {
                    // Convert to grayscale using luminance-preserving conversion
                    const c = d3.color(color(d.data.name));
                    const y = c.rgb().r * 0.3 + c.rgb().g * 0.59 + c.rgb().b * 0.11;
                    return d3.rgb(y, y, y);
                }
                return color(d.data.name);
            });
    }

    // Function to update the treemap visualization
    function updateTreemap(currentTokenId) {
        // Process data based on current view mode
        const filteredData = {
            name: "root",
            children: data.children.map(d => {
                if (viewMode === 'single') {
                    // Single token view
                    return {
                        name: d.name,
                        value: d.values[currentTokenId] || 0
                    };
                } else {
                    // Cumulative view - sum all tokens up to currentTokenId
                    let sum = 0;
                    const currentIndex = tokenIds.indexOf(currentTokenId);
                    for (let i = 0; i <= currentIndex; i++) {
                        const token = tokenIds[i];
                        sum += d.values[token] || 0;
                    }
                    return {
                        name: d.name,
                        value: sum,
                        originalValue: d.values[currentTokenId] || 0
                    };
                }
            }).filter(d => d.value > 0) // Only include non-zero balances
        };

        // Create hierarchy and compute layout
        const root = d3.hierarchy(filteredData)
            .sum(d => d.value)
            .sort((a, b) => b.value - a.value);

        // Create treemap with no padding and enable rounding to whole pixels
        const treemap = d3.treemap()
            .tile(d3.treemapSquarify)
            .size([width, height])
            .padding(0)
            .paddingOuter(0)
            .paddingInner(0)
            .round(true)(root);

        // Join data with DOM elements
        const leaf = g.selectAll("g")
            .data(treemap.leaves(), d => d.data.name);

        // Enter + update
        const leafEnter = leaf.enter()
            .append("g")
            .attr("transform", d => `translate(${Math.floor(d.x0)},${Math.floor(d.y0)})`);

        // Add rectangles with exact pixel dimensions
        leafEnter.append("rect")
            .attr("class", "tile")
            .attr("fill", d => {
                if (useGrayscale) {
                    const c = d3.color(color(d.data.name));
                    const y = c.rgb().r * 0.3 + c.rgb().g * 0.59 + c.rgb().b * 0.11;
                    return d3.rgb(y, y, y);
                }
                return color(d.data.name);
            })
            .attr("width", d => Math.ceil(d.x1 - d.x0))
            .attr("height", d => Math.ceil(d.y1 - d.y0))
            .style("stroke", "none")  // Explicitly remove any stroke
            .style("vector-effect", "non-scaling-stroke")
            .append("title")
            .text(d => `${d.data.name}\nBalance: ${d.data.value}`);

        // Add text labels
        leafEnter.append("text")
            .attr("class", "tile-text")
            .attr("x", 1)
            .attr("y", "1em")
            .style('visibility', showLabels ? 'visible' : 'hidden')
            .text(d => d.data.name);

        leafEnter.on("click", function (d) {
            nm = d.target.children[0].__data__.data.name;
            //console.log(d.target.children[0].__data__)
            window.open(`https://6529.io/${nm}`, '_blank');
        });

        // Update existing elements
        leaf.merge(leafEnter)
            .transition()
            .duration(500)
            .attr("transform", d => `translate(${d.x0},${d.y0})`);

        leaf.select("rect")
            .transition()
            .duration(500)
            .attr("width", d => d.x1 - d.x0)
            .attr("height", d => d.y1 - d.y0);

        // Remove old elements
        leaf.exit().remove();

        // Update token ID display
        const displayTokenId = typeof currentTokenId === 'string' ? parseFloat(currentTokenId) : currentTokenId;
        let displayText = `<strong>Token ID:</strong> ${displayTokenId}`;

        if (viewMode === 'cumulative') {
            const currentIndex = tokenIds.indexOf(currentTokenId);
            displayText += ` (Cumulative: ${currentIndex + 1} of ${tokenIds.length})`;
        }

        d3.select(".token-display").html(displayText);
    }

    // Handle window resize
    function handleResize() {
        const container = chartContainer.node().getBoundingClientRect();
        const newWidth = Math.min(928, container.width - 40);
        const newHeight = Math.max(400, container.height - 100); // Ensure minimum height

        // Always update on resize for responsive behavior
        width = newWidth;
        height = newHeight;

        // Update the viewBox and trigger a redraw
        svg.attr("viewBox", `0 0 ${width} ${height}`);

        // Redraw with current token
        const currentTokenIndex = +d3.select(".slider").property("value");
        if (currentTokenIndex >= 0) {
            updateTreemap(tokenIds[currentTokenIndex]);
        }
    }

    // Initial render
    updateTreemap(tokenIds[0]);

    // Initial resize to set correct dimensions
    handleResize();

    // Handle window resize with debounce
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(handleResize, 100);
    });

    // Also handle container resize for flex layouts
    const resizeObserver = new ResizeObserver(entries => {
        if (!entries.length) return;
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(handleResize, 100);
    });

    // Start observing the chart container
    resizeObserver.observe(chartContainer.node());
}

// Make the function available globally
window.initializeTreemap = initializeTreemap;

const margin = { top: 60, right: 100, bottom: 0, left: 0 };

const cellSize = Math.min(window.innerHeight, window.innerWidth) / 1000;

let width, height;

const svg = d3.select("#heatmap")
    .append("svg")
    .attr("width", "100%")
    .attr("height", "100%");

const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

const subtitle = svg.append("text")
    .attr("x", "50%")
    .attr("y", 50)
    .style("text-anchor", "middle")
    .style("font-size", "12px")
    .style("fill", "#aaa")
    .text("Color intensity shows relative balance within each holder (red = higher, blue = lower)");

const tooltip = d3.select("#tooltip");

const colorScale = d3.scaleSequential()
    .interpolator(d3.interpolateRgbBasis(["#1a237e", "#0d47a1", "#1976d2", "#0288d1", "#0097a7", "#00796b", "#388e3c", "#689f38", "#afb42b", "#fbc02d", "#ffa000", "#f57c00", "#e64a19", "#d32f2f", "#b71c1c"]));

let allData = [];
let filteredData = [];

function processData(data) {
    const validData = data.filter(d => +d.balance > 0 && d.token_id && d.id);
    
    const holderBalances = d3.rollup(
        validData,
        v => d3.sum(v, d => +d.balance),  
        d => d.id
    );
    
    const topHolders = Array.from(holderBalances.entries())
        .sort((a, b) => b[1] - a[1])  
        .slice(0, 250)                
        .map(d => d[0]);              
    
    const filteredByHolders = validData.filter(d => topHolders.includes(d.id));
    
    const filtered = filteredByHolders;
    const allTokens = [...new Set(filtered.map(d => d.token_id))];
    
    const holders = [...new Set(filtered.map(d => d.id))];
    const tokens = [...allTokens].sort((a, b) => +a - +b);
    
    const holderTokenMap = new Map();
    
    holders.forEach(holder => {
        const holderData = filtered.filter(d => d.id === holder);
        const tokenMap = new Map();
        
        const totalBalance = d3.sum(holderData, d => +d.balance);
        
        tokens.forEach(token => {
            const tokenData = holderData.find(d => d.token_id === token);
            const balance = tokenData ? +tokenData.balance : 0;
            tokenMap.set(token, totalBalance > 0 ? balance / totalBalance : 0);
        });
        
        holderTokenMap.set(holder, tokenMap);
    });
    
    return {
        tokens,
        holders,
        data: holderTokenMap
    };
}

function drawHeatmap(processedData) {
    const { tokens: allTokens, holders: allHolders, data } = processedData;
    
    window.tokens = allTokens;
    window.holders = allHolders;
    
    const dims = updateDimensions();
    width = dims.width;
    height = dims.height;
    
    g.selectAll("*").remove();
    
    const x = d3.scaleBand()
        .domain(allHolders)
        .range([0, Math.max(width, allHolders.length * cellSize)])
        .padding(0.1);
    
    const y = d3.scaleBand()
        .domain(allTokens)
        .range([0, Math.max(height, allTokens.length * cellSize)])
        .padding(0.1);
    
    data.forEach(tokenMap => {
        const maxForHolder = d3.max(Array.from(tokenMap.values()));
        // store this maxForHolder as part of data
        tokenMap.set("max", maxForHolder);
    });
    
    colorScale.domain([0, d3.max(Array.from(data.values(), d => d.get("max")))]);
    
    const cell = g.selectAll(".cell")
        .data(d3.cross(allHolders, allTokens))
        .enter()
        .append("rect")
        .attr("class", "cell")
        .attr("x", d => x(d[0]))
        .attr("y", d => y(d[1]))
        .attr("width", x.bandwidth())
        .attr("height", y.bandwidth())
        .style("fill", d => {
            const holderData = data.get(d[0]);
            const value = holderData ? holderData.get(d[1]) || 0 : 0;
            // rescale by squaring then renorming
            const rescaled = Math.sqrt(value) / Math.sqrt(d3.max(Array.from(data.values(), d => d.get("max"))));
            return value > 0 ? colorScale(rescaled) : "#111";            
        })
        .on("mouseover", function(event, d) {
            const holderData = data.get(d[0]);
            const maxForHolder = holderData.get("max");
            const value = holderData ? holderData.get(d[1]) || 0 : 0;
            const rescaled = Math.sqrt(value) / Math.sqrt(d3.max(Array.from(data.values(), d => d.get("max"))));
            
            d3.select(this).attr("stroke", "#fff").attr("stroke-width", "0px");
            
            tooltip
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 28) + "px")
                .style("opacity", 1)
                .html(`
                    <strong>Token ID:</strong> ${d[1]}<br>
                    <strong>Holder:</strong> ${d[0]}<br>
                    <strong>Relative Balance:</strong> ${(value * 100).toFixed(2)}%<br>
                    <strong>Max Balance:</strong> ${(maxForHolder * 100).toFixed(2)}%
                `);
        })        
        .on("click", function(event, d) { // click to go to 6529.io for token ID
            console.log(d);
            window.open(`https://6529.io/the-memes/${d[1]}`);
        })
        .on("mouseout", function() {
            d3.select(this).attr("stroke", "#333").attr("stroke-width", "0px");
            tooltip.style("opacity", 0);
        });
    
    const xAxis = d3.axisTop(x)
        .tickSize(0)
        .tickFormat("");
    
    g.append("g")
        .attr("class", "x axis")
        .call(xAxis);
    
    const yAxis = d3.axisLeft(y)
        .tickSize(0)
        .tickFormat("");
    
    g.append("g")
        .attr("class", "y axis")
        .call(yAxis);
    
    const legendWidth = 200;
    const legendHeight = 20;
    const legend = g.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${width - legendWidth - 20}, ${-40})`);
    
}

function updateDimensions() {
    const container = d3.select("#heatmap");
    const containerWidth = container.node().getBoundingClientRect().width;
    const containerHeight = container.node().getBoundingClientRect().height;
    
    const requiredWidth = Math.max(containerWidth, holders.length * cellSize + margin.left + margin.right);
    const requiredHeight = Math.max(containerHeight, tokens.length * cellSize + margin.top + margin.bottom + 60);
    
    svg.attr("width", requiredWidth)
       .attr("height", requiredHeight);
    
    width = requiredWidth - margin.left - margin.right;
    height = requiredHeight - margin.top - margin.bottom - 60; 
    
    return { width, height };
}

d3.csv("raw.csv").then(function(data) {
    allData = data;
    const processedData = processData(allData);
    
    drawHeatmap(processedData);
    updateDimensions();
    
    window.addEventListener('resize', updateDimensions);
});
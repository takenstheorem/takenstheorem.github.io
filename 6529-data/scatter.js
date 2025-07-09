szn = 1;

// Set dimensions and margins
const margin = { top: 60, right: 80, bottom: 80, left: 80 };
const width = Math.min(1200, window.innerWidth - 40) - margin.left - margin.right;
const height = Math.min(800, window.innerHeight - 200) - margin.top - margin.bottom;

// Create SVG element
const svg = d3.select("#chart")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

// Add title
svg.append("text")
    .attr("class", "title")
    .attr("x", width / 2)
    .attr("y", -20)
    .text("TDH vs Token Balance");

// Create scales
const x = d3.scaleLog()
    .range([0, width]);

const y = d3.scaleLog()
    .range([height, 0]);

// Create tick values for log scale
const tickValues = [1, 10, 100, 1000, 10000, 100000, 1000000, 10000000];

// Create axes with explicit tick values
const xAxis = d3.axisBottom(x)
    .tickValues(tickValues)
    .tickFormat(d3.format(".0s"));

const yAxis = d3.axisLeft(y)
    .tickValues(tickValues)
    .tickFormat(d3.format(".0s"));

// Add x-axis
svg.append("g")
    .attr("class", "x axis")
    .attr("transform", `translate(0,${height})`);

// Add y-axis
svg.append("g")
    .attr("class", "y axis");

// Add axis labels
svg.append("text")
    .attr("class", "axis-label")
    .attr("x", width / 2)
    .attr("y", height + 50)
    .text("TDH (log scale)");

svg.append("text")
    .attr("class", "axis-label")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", -50)
    .text("Token Balance (log scale)");

// Create tooltip
const tooltip = d3.select("body").append("div")
    .attr("class", "tooltip")
    .style("opacity", 0);

// Store the full dataset and filtered data
let fullData = [];
let filteredData = [];

// Function to filter data by season
function filterDataBySeason(season) {
    return fullData.filter(d => 
        +d.tdh > 0 && 
        +d.balance > 0 && 
        !isNaN(+d.tdh) && 
        !isNaN(+d.balance) && 
        (season === 'all' || +d.szn === +season)
    );
}

// Function to update the chart
function updateChart(season) {
    // Filter data based on selected season
    filteredData = season ? filterDataBySeason(season) : filterDataBySeason('all');
    
    // Update domains to align with tick values
    const maxX = d3.max(filteredData, d => +d.tdh);
    const maxY = d3.max(filteredData, d => +d.balance);
    
    // Find the next highest power of 10 for the domain
    const nextPowerOf10 = (n) => Math.pow(10, Math.ceil(Math.log10(n)));
    
    x.domain([1, nextPowerOf10(maxX) || 10]);
    y.domain([1, nextPowerOf10(maxY) || 10]);

    // Update axes
    svg.select(".x.axis")
        .transition()
        .duration(500)
        .call(xAxis);

    svg.select(".y.axis")
        .transition()
        .duration(500)
        .call(yAxis);

    // Update dots
    const dots = svg.selectAll(".dot")
        .data(filteredData, d => d.id);

    // Remove old dots
    dots.exit().remove();

    // Add new dots and update existing ones
    dots.enter()
        .append("circle")
        .attr("class", "dot")
        .attr("r", 0)
        .attr("cx", d => x(+d.tdh))
        .attr("cy", d => y(+d.balance))
        .on("mouseover", function(event, d) {
            d3.select(this)
                .transition()
                .duration(200)
                .attr("r", 6);
                
            tooltip.transition()
                .duration(200)
                .style("opacity", .9);
                
            tooltip.html(`Token ID: ${d.token_id}<br/>Holder: ${d.id}<br/>Balance: ${d.balance}<br/>TDH: ${d.tdh}<br/>Season: ${d.szn}`)
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function() {
            d3.select(this)
                .transition()
                .duration(200)
                .attr("r", 4);
                
            tooltip.transition()
                .duration(500)
                .style("opacity", 0);
        })
        .on("click", function(event, d) {
            window.open(`https://6529.io/${d.id}`);
        })
        .merge(dots)
        .transition()
        .duration(500)
        .attr("cx", d => x(+d.tdh))
        .attr("cy", d => y(+d.balance))
        .attr("r", 4);
}

// Load and process data
d3.csv("raw.csv").then(function(data) {
    // Store the full dataset
    fullData = data;
    
    // Add event listener for season selector
    d3.select("#season").on("change", function() {
        const selectedSeason = this.value;
        updateChart(selectedSeason);
    });
    
    // Set the season selector to Season 1
    d3.select("#season").property("value", "1");
    
    // Initial chart render with Season 1 data
    updateChart('1');

    // Add zoom behavior
    const zoom = d3.zoom()
        .scaleExtent([0.5, 10])
        .on("zoom", (event) => {
            const newX = event.transform.rescaleX(x);
            const newY = event.transform.rescaleY(y);

            svg.selectAll(".dot")
                .attr("cx", d => newX(+d.tdh))
                .attr("cy", d => newY(+d.balance));

            svg.select(".x.axis").call(xAxis.scale(newX));
            svg.select(".y.axis").call(yAxis.scale(newY));
        });

    svg.call(zoom);
});

// Handle window resize
window.addEventListener('resize', function () {
    const newWidth = Math.min(1200, window.innerWidth - 40) - margin.left - margin.right;
    const newHeight = Math.min(800, window.innerHeight - 200) - margin.top - margin.bottom;

    d3.select("#chart svg")
        .attr("width", newWidth + margin.left + margin.right)
        .attr("height", newHeight + margin.top + margin.bottom);

    // Update scales and redraw
    x.range([0, newWidth]);
    y.range([newHeight, 0]);

    // Update axes
    svg.select(".x.axis")
        .attr("transform", `translate(0,${newHeight})`)
        .call(xAxis);

    svg.select(".y.axis")
        .call(yAxis);

    // Update points
    svg.selectAll(".dot")
        .attr("cx", d => x(+d.tdh))
        .attr("cy", d => y(+d.balance));

    // Update axis labels
    svg.select(".x.axis-label")
        .attr("x", newWidth / 2)
        .attr("y", newHeight + 50);

    svg.select(".y.axis-label")
        .attr("x", -newHeight / 2);
});
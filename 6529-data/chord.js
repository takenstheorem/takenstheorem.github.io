var szn = "1";

document.getElementById("season").addEventListener("change", function () {
  szn = this.value;
  updateChart();
});

document.addEventListener('DOMContentLoaded', updateChart);

function updateChart() {

  try {
    d3.select("#chart").selectAll("*").remove();
    window.chartUpdate = null;
    const container = d3.select("#chart");
    const containerWidth = container.node().getBoundingClientRect().width;

    const getChartDimensions = (width) => {
      const size = width * 0.9;
      return {
        width: size,
        height: size,
        size,
        innerRadius: size * 0.4,
        outerRadius: size * 0.42
      };
    };

    const svg = container.append("svg")
      .style("width", "100%")
      .style("height", "auto")
      .style("display", "block");

    let dimensions = getChartDimensions(containerWidth);

    const chartGroup = svg.append("g");

    const updateChartSize = () => {
      const newWidth = container.node().getBoundingClientRect().width;
      dimensions = getChartDimensions(newWidth);

      svg.attr("viewBox", `0 0 ${dimensions.width} ${dimensions.height}`)
        .attr("width", "100%")
        .attr("height", null);

      chartGroup.attr("transform", `translate(${dimensions.width / 2}, ${dimensions.height / 2})`);
      chartGroup.attr("transform", `translate(${dimensions.width / 2}, ${dimensions.height / 2})`);

      return dimensions;
    };

    updateChartSize();

    loadAndProcessData(svg, dimensions, updateChartSize)
      .catch(error => {
        console.error("Error in visualization:", error);
        d3.select("#chart")
          .append("div")
          .style("color", "red")
          .style("padding", "20px")
          .style("white-space", "pre")
          .html(`Error loading visualization:\n${error.message}`);
      });

    let resizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        updateChartSize();
        if (typeof window.chartUpdate === 'function') {
          window.chartUpdate();
        }
      }, 250);
    });

  } catch (error) {
    console.error("Initialization error:", error);
    d3.select("#chart")
      .append("div")
      .style("color", "red")
      .style("padding", "20px")
      .html(`Initialization error: ${error.message}<br>Check console for details.`);
  }
}

function loadAndProcessData(svg, { width, height, size, innerRadius, outerRadius }, onUpdate) {
  if (!svg || !width || !height) {
    throw new Error("Invalid parameters for loadAndProcessData");
  }

  const padding = 0.01;
  const chartGroup = svg.select("g");

  return d3.csv("raw.csv")
    .then(data => {
      console.log(data);
      if (data.length === 0) {
        throw new Error('CSV file is empty');
      }

      const filteredData = data
        .filter(d => {
          const rowSzn = d.szn; // Convert string to number          
          return rowSzn === szn;
        })
        .map(d => ({
          ...d,
          balance: +d.balance || 0,
          szn: d.szn,
          token_id: d.token_id.toString()
        }));

      console.log(filteredData);

      const top = [...filteredData]
        .sort((a, b) => b.balance - a.balance)
        .slice(0, 250);

      const ids = [...new Set(top.map(d => d.id).filter(Boolean))];
      const tokenIds = [...new Set(top.map(d => d.token_id).filter(Boolean))];

      if (ids.length === 0 || tokenIds.length === 0) {
        throw new Error(`No valid data found for szn=${szn}`);
      }

      const idIndex = new Map(ids.map((id, i) => [id, i]));
      const tokenIndex = new Map(tokenIds.map((id, i) => [id, i + ids.length])); // Offset index for token_ids

      const nodes = [...ids, ...tokenIds];

      const links = top.map(d => ({
        source: idIndex.get(d.id),
        target: tokenIndex.get(d.token_id),
        value: d.balance
      }));

      const chord = d3.chordDirected()
        .padAngle(padding)
        .sortSubgroups(d3.descending);

      const matrix = Array(nodes.length).fill().map(() => Array(nodes.length).fill(0));
      links.forEach(link => {
        matrix[link.source][link.target] = link.value;
      });

      const chords = chord(matrix);

      const color = d3.scaleOrdinal()
        .domain(d3.range(nodes.length))
        .range(d3.quantize(t => d3.interpolateRainbow(t * 0.9), nodes.length));

      const chordGroup = chartGroup.append("g");

      const scaleFactor = Math.min(1, (size * 0.9) / (outerRadius * 2));

      const updateChart = () => {
        const containerWidth = d3.select("#chart").node().getBoundingClientRect().width;
        const newSize = containerWidth * 0.9;
        const newScaleFactor = Math.min(1, (newSize * 0.9) / (outerRadius * 2));

        chordGroup.attr("transform", `scale(${newScaleFactor})`);

        if (typeof onUpdate === 'function') {
          onUpdate();
        }
      };

      updateChart();

      window.chartUpdate = updateChart;

      chordGroup.append("g")
        .selectAll("path")
        .data(chords)
        .join("path")
        .attr("d", d3.ribbon()
          .radius(innerRadius - 1)
          .padAngle(padding / 2)
        )
        .style("fill", d => d3.color(color(d.source.index)).copy({ opacity: .8 }))
        .style("stroke", d => d3.color(color(d.source.index)).darker(0.5))
        .style("stroke-width", "0.5px")
        .on("mouseover", (event, d) => {
          d3.select(event.currentTarget)
            .style("stroke-width", "1.5px")
            .style("fill", d => d3.color(color(d.source.index)).copy({ opacity: 1 }));

          const sourceLabel = d.source.index < ids.length ?
            `ID: ${nodes[d.source.index]}` :
            `Token: ${nodes[d.source.index]}`;
          const targetLabel = d.target.index < ids.length ?
            `ID: ${nodes[d.target.index]}` :
            `Token: ${nodes[d.target.index]}`;

          d3.select(".chord-tooltip")
            .style("opacity", 0.95)
            .html(`${sourceLabel} → ${targetLabel}<br>balance: ${d.source.value.toLocaleString()}`);
        })
        .on("mousemove", (event) => {
          d3.select(".chord-tooltip")
            .style("left", (event.pageX + 15) + "px")
            .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", (event) => {
          d3.select(event.currentTarget)
            .style("stroke-width", "0.5px");
          d3.select(".chord-tooltip").style("opacity", 0);
          d3.select(event.currentTarget)
            .style("fill", d => d3.color(color(d.source.index)).copy({ opacity: .8 }));
        });

      const arc = d3.arc()
        .innerRadius(innerRadius)
        .outerRadius(outerRadius);

      const group = chordGroup.append("g")
        .selectAll("g")
        .data(chords.groups)
        .join("g")
        .attr("class", "arc-group");

      group.append("path")
        .attr("d", arc)
        .attr("fill", d => color(d.index))
        .attr("stroke", "#fff")
        .on("mouseover", (event, d) => {
          d3.select(event.currentTarget)
            .style("stroke", "#000");
        })
        .on("mouseout", (event, d) => {
          d3.select(event.currentTarget)
            .style("stroke", "#fff");
        })
        .on("click", (event, d) => {
          if (d.index < ids.length) {
            window.open(`https://6529.io/${nodes[d.index]}`, '_blank');
          } else {
            window.open(`https://6529.io/the-memes/${nodes[d.index]}`, '_blank');
          }
        });

      group.on("mouseover", (event, d) => {
        const label = d.index < ids.length ?
          `ID: ${nodes[d.index]}` :
          `Token: ${nodes[d.index]}`;

        d3.select(".chord-tooltip")
          .style("opacity", 1)
          .style("left", (event.pageX + 15) + "px")
          .style("top", (event.pageY - 28) + "px")
          .html(label);
      })
        .on("mouseout", () => {
          d3.select(".chord-tooltip").style("opacity", 0);
        });

      function wrap(text, width) {
        text.each(function () {
          const text = d3.select(this);
          const words = text.text().split(/\s+/).reverse();
          let word;
          let line = [];
          let lineNumber = 0;
          const lineHeight = 1.1;
          const y = text.attr("y");
          const dy = parseFloat(text.attr("dy"));
          let tspan = text.text(null).append("tspan")
            .attr("x", 0)
            .attr("y", y)
            .attr("dy", dy + "em");

          while (word = words.pop()) {
            line.push(word);
            tspan.text(line.join(" "));
            if (tspan.node().getComputedTextLength() > width) {
              line.pop();
              tspan.text(line.join(" "));
              line = [word];
              tspan = text.append("tspan")
                .attr("x", 0)
                .attr("y", y)
                .attr("dy", ++lineNumber * lineHeight + dy + "em")
                .text(word);
            }
          }
        });
      }

      return svg.node();

    });
} 

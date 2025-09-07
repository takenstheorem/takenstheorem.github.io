const spark_canvas = document.getElementById('sparkline');
const spark_ctx = spark_canvas.getContext('2d');
const spark_WIDTH = spark_canvas.width;
const spark_HEIGHT = spark_canvas.height;
let dv = [];
let dv_name = 'transaction_count';

function setSpark(new_dv = 'transaction_count') {
    dv_name = new_dv;
    drawSparkline();
}

function drawSparkline(selectedIndex = -1) {
    dv = Object.values(blockSummaries).map(d => d[dv_name]);
    if (document.getElementById('sparklineLog').checked) {
        dv = dv.map(d => Math.log(d+1));
    }

    const minVal = Math.min(...dv);
    const maxVal = Math.max(...dv);
    const normalize = val => spark_HEIGHT - ((val - minVal) / (maxVal - minVal)) * (spark_HEIGHT - 10);

    spark_ctx.clearRect(0, 0, spark_WIDTH, spark_HEIGHT);
    spark_ctx.beginPath();
    spark_ctx.strokeStyle = '#00ff8888';
    spark_ctx.lineWidth = 0.5;

    dv.forEach((val, i) => {
        const x = i * (spark_WIDTH / (dv.length - 1));
        const y = normalize(val);
        if (i === 0) spark_ctx.moveTo(x, y);
        else spark_ctx.lineTo(x, y);
    });
    spark_ctx.stroke();

    if (selectedIndex >= 0) {
        const x = selectedIndex * (spark_WIDTH / (dv.length - 1));
        const y = normalize(dv[selectedIndex]);
        spark_ctx.beginPath();
        spark_ctx.arc(x, y-2, 2, 0, 2 * Math.PI);
        // spark_ctx.lineTo(x, 0);
        // spark_ctx.lineTo(x, y);
        // spark_ctx.strokeStyle = '#ffffff';
        // spark_ctx.lineWidth = 2;
        // spark_ctx.stroke();
        spark_ctx.fillStyle = '#00ff88ff';
        spark_ctx.fill();
    }

}

spark_canvas.addEventListener('click', (e) => {
    const rect = spark_canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const index = Math.round(x / (spark_WIDTH / (dv.length - 1)));
    selectIndex(index);
}, { passive: false });

function selectIndex(index) {
    index = Math.max(0, Math.min(dv.length - 1, index));
    window.selectedTransactionIndex = index;
    drawSparkline(index);
    const blockNum = blockSummaries[minBlock+index].id;
    setPageInstant(blockNum);
}

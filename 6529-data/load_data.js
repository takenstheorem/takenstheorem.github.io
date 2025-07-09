// Load and process the CSV data
d3.csv('raw.csv').then(function(rawData){
    // sort by sum(balnce of id)
    const sortedData = rawData.sort((a, b) => {
        const aBalance = a.balance;
        const bBalance = b.balance;
        return bBalance - aBalance;
    });
    console.log(sortedData);
    
    // get top 25
    const top25 = sortedData.slice(0, 25);
    console.log(top25);
    
    // create a matrix
    const matrix = top25.map(d => {
        return d.balance;
    });
    console.log(matrix);

    // set column names to source,targe,value for id,token_id,balance
    const columnNames = ['source', 'target', 'value'];
    const matrixData = matrix.map((row, i) => {
        return columnNames.map((name, j) => {
            return {
                name: name,
                value: row[j]
            };
        });
    });
    console.log(matrixData);
});
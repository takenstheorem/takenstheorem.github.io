// Load and process the CSV data
d3.csv('raw.csv').then(function(rawData) {
    console.log('Raw data loaded:', rawData);
    
    // Clean the data by removing the first column (empty string key)
    const cleanData = rawData.map(row => {
        const { '': _, ...rest } = row;
        return rest;
    });
    
    console.log('Cleaned data:', cleanData);
    
    // Group data by id and sum balances for each token_id
    const groupedData = d3.rollup(
        cleanData,
        v => {
            const balances = {};
            v.forEach(d => {
                const token = d.token_id;
                const balance = parseFloat(d.balance);
                if (isNaN(balance)) {
                    console.warn('Invalid balance value:', d.balance, 'for token', token);
                    return;
                }
                balances[token] = (balances[token] || 0) + balance;
            });
            
            if (!v[0] || !v[0].id) {
                console.error('Missing id in data:', v[0]);
                return { values: {}, name: 'unknown' };
            }
            
            return {
                values: balances,
                name: v[0].id
            };
        },
        d => d.id // Group by id
    );

    // Convert to array format expected by d3.hierarchy
    const result = {
        name: "root",
        children: Array.from(groupedData, ([key, value]) => ({
            name: value.name,
            values: value.values
        })).filter(d => Object.keys(d.values).length > 0) // Only include entries with balances
    };
    
    console.log('Processed data structure:', result);
    
    // Initialize the treemap with the processed data
    if (typeof initializeTreemap === 'function') {
        initializeTreemap(result);
    } else {
        console.error('initializeTreemap function not found');
    }
}).catch(error => {
    console.error('Error loading or processing data:', error);
});

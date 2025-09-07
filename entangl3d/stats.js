function getAddressStats(blockNumber, address) {
    const txs = blocksData[blockNumber] || [];
    let valueSent = 0;
    let valueReceived = 0;
    let feesSpent = 0;
    const funcs = new Set();
    for (const tx of txs) {
        if (tx.func) {
            if (tx.from === address || tx.to === address) {
                funcs.add(tx.func);
            }
        }
        if (tx.from === address) {
            valueSent += Number(tx.val) / 1e18 || 0;
            feesSpent += Number(tx.fee) / 1e18 || 0;
        }
        if (tx.to === address) {
            valueReceived += Number(tx.val) / 1e18 || 0;
            feesSpent += Number(tx.fee) / 1e18 || 0;
        }
    }
    return {
        valueSent,
        valueReceived,
        valueTotal: valueSent + valueReceived,
        feesSpent,
        funcs
    };
}

function formatWei(wei) {
    if (!Number.isFinite(wei)) return '—';
    const eth = wei / 1e18;
    if (Math.abs(eth) >= 1) return eth.toFixed(4) + ' ETH';
    if (Math.abs(eth) >= 1e-6) return eth.toFixed(6) + ' ETH';
    return eth.toExponential(2) + ' ETH';
}


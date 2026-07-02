let defaultMarketData = {
    indexPrice: 46752,
    etfPrice: 306.75,
    etf631LPrice: 245.50
};

function calculateAll() {
    const indexPrice = parseFloat(document.getElementById('indexPrice').value) || 0;
    const equity = parseFloat(document.getElementById('equity').value) || 0;
    const miniQty = parseFloat(document.getElementById('miniQty').value) || 0;
    const microQty = parseFloat(document.getElementById('microQty').value) || 0;
    const otherMargin = parseFloat(document.getElementById('otherMargin').value) || 0;
    const etfPrice = parseFloat(document.getElementById('etfPrice').value) || 0;
    const etf631LPrice = parseFloat(document.getElementById('etf631LPrice').value) || 0;

    const totalMultiplier = (miniQty * 50) + (microQty * 10);
    const totalContractVal = totalMultiplier * indexPrice;
    const adjEquity = equity - otherMargin;
    const currentLeverage = adjEquity > 0 ? (totalContractVal / adjEquity) : 0;

    document.getElementById('totalContractVal').innerText = totalContractVal.toLocaleString() + " 元";
    document.getElementById('adjEquity').innerText = adjEquity.toLocaleString() + " 元";
    document.getElementById('currentLeverage').innerText = currentLeverage.toFixed(2) + " 倍";

    function getRecStr(targetLev) {
        if (adjEquity <= 0 || totalMultiplier === 0) return "N/A";
        const diffMicro = (totalContractVal - (targetLev * adjEquity)) / (10 * indexPrice);
        if (diffMicro > 0.05) return `需減 ${diffMicro.toFixed(1)} 口微台`;
        if (diffMicro < -0.05) return `可加 ${Math.abs(diffMicro).toFixed(1)} 口微台`;
        return "保持現狀";
    }
    document.getElementById('rec25').innerText = getRecStr(2.5);
    document.getElementById('rec30').innerText = getRecStr(3.0);

    if (etfPrice > 0) {
        document.getElementById('etfShares').innerText = (equity / (etfPrice * 1000)).toFixed(2) + " 張";
    }
    if (etf631LPrice > 0) {
        document.getElementById('etf631LShares').innerText = (equity / (etf631LPrice * 1000)).toFixed(2) + " 張";
    }
    
    const etfExposure = equity * 2;
    document.getElementById('etfExposure').innerText = etfExposure.toLocaleString() + " 元";

    drawRiskMatrix(indexPrice, currentLeverage);
}

function drawRiskMatrix(currentIdx, currentLev) {
    const canvas = document.getElementById('riskMatrixCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    
    const padL = 60, padR = 40, padT = 30, padB = 50;
    const graphW = w - padL - padR;
    const graphH = h - padT - padB;
    const minPct = -30, maxPct = 10;
    const minLev = 1.0, maxLev = 5.0;

    function getX(pct) { return padL + ((pct - minPct) / (maxPct - minPct)) * graphW; }
    function getY(lev) { return padT + (1 - (lev - minLev) / (maxLev - minLev)) * graphH; }

    ctx.fillStyle = 'rgba(42, 157, 143, 0.15)';
    ctx.fillRect(padL, getY(2.5), graphW, getY(1.0) - getY(2.5));
    ctx.fillStyle = 'rgba(244, 162, 97, 0.15)';
    ctx.fillRect(padL, getY(3.5), graphW, getY(2.5) - getY(3.5));
    ctx.fillStyle = 'rgba(230, 57, 70, 0.15)';
    ctx.fillRect(padL, padT, graphW, getY(3.5) - padT);

    ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 1;
    ctx.fillStyle = '#64748b'; ctx.font = '11px sans-serif'; ctx.textAlign = 'center';
    for (let p = minPct; p <= maxPct; p += 10) {
        let x = getX(p);
        ctx.beginPath(); ctx.moveTo(x, padT); ctx.lineTo(x, h - padB); ctx.stroke();
        ctx.fillText((p >= 0 ? '+' : '') + p + '%', x, h - padB + 18);
    }
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (let l = minLev; l <= maxLev; l += 0.5) {
        let y = getY(l);
        ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
        ctx.fillText(l.toFixed(1) + 'x', padL - 8, y);
    }

    ctx.fillStyle = '#334155'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('← 大盤下跌 (預估風險)  |  大盤上漲 →', padL + graphW/2, h - 12);
    
    ctx.save(); ctx.translate(15, padT + graphH/2); ctx.rotate(-Math.PI/2);
    ctx.fillText('帳戶實質槓桿倍數', 0, 0); ctx.restore();

    if (currentLev >= minLev && currentLev <= maxLev) {
        let curX = getX(0); let curY = getY(currentLev);
        ctx.strokeStyle = '#475569'; ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.moveTo(curX, padT); ctx.lineTo(curX, h - padB); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(padL, curY); ctx.lineTo(w - padR, curY); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#1d3557'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(curX, curY, 7, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#1d3557'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'left';
        ctx.fillText(' 當前現狀 (' + currentLev.toFixed(2) + 'x)', curX + 8, curY - 4);
    }
}

function resetToDefault() {
    document.getElementById('indexPrice').value = defaultMarketData.indexPrice;
    document.getElementById('etfPrice').value = defaultMarketData.etfPrice;
    document.getElementById('etf631LPrice').value = defaultMarketData.etf631LPrice;
    calculateAll();
}

document.addEventListener('DOMContentLoaded', () => {
    const inputs = ['indexPrice', 'equity', 'miniQty', 'microQty', 'otherMargin', 'etfPrice', 'etf631LPrice'];
    inputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', calculateAll);
    });

    document.getElementById('btnReset').addEventListener('click', resetToDefault);

    fetch('data.json')
        .then(response => response.json())
        .then(data => {
            defaultMarketData.indexPrice = data.indexPrice;
            defaultMarketData.etfPrice = data.etfPrice;
            defaultMarketData.etf631LPrice = data.etf631LPrice;

            document.getElementById('indexPrice').value = data.indexPrice;
            document.getElementById('etfPrice').value = data.etfPrice;
            document.getElementById('etf631LPrice').value = data.etf631LPrice;
            
            document.getElementById('lblLastUpdated').innerText = data.lastUpdated || "未取得";
            document.getElementById('lblSource').innerText = data.source || "Yahoo Finance";
            calculateAll();
        })
        .catch(err => {
            console.log("讀取自動化資料失敗，改用預設值", err);
            document.getElementById('lblLastUpdated').innerText = "使用網頁預設值";
            document.getElementById('lblSource').innerText = "區域靜態資料";
            calculateAll();
        });
});

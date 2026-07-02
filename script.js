const DEFAULT_SNAPSHOT = {
    indexPrice: 22815, spotPrice: 22840.15, equity: 2211000, miniQty: 0, microQty: 15, otherMargin: 0, etf50Price: 185.00, etf631lPrice: 240.50, etf685lPrice: 306.75
};

document.addEventListener('DOMContentLoaded', () => {
    initEvents();
    loadCloudData();
});

function initEvents() {
    const inputs = ['indexPrice', 'spotPrice', 'equity', 'miniQty', 'microQty', 'otherMargin', 'etf50Price', 'etf631lPrice', 'etf685lPrice'];
    inputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', renderDashboard);
    });

    ['chkBase', 'chkFutureLong', 'chk0050', 'chk00631l', 'chk00685l', 'chkCustom'].forEach(id => {
        document.getElementById(id).addEventListener('change', renderDashboard);
    });

    document.getElementById('btnReset').addEventListener('click', () => {
        Object.keys(DEFAULT_SNAPSHOT).forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = DEFAULT_SNAPSHOT[id];
        });
        renderDashboard();
    });
}

function loadCloudData() {
    fetch('data.json')
        .then(res => res.json())
        .then(data => {
            document.getElementById('indexPrice').value = data.indexPrice;
            document.getElementById('spotPrice').value = data.spotPrice;
            document.getElementById('etf50Price').value = data.etf50Price || 185.00;
            document.getElementById('etf631lPrice').value = data.etf631lPrice || 240.50;
            document.getElementById('etf685lPrice').value = data.etf685lPrice;
            document.getElementById('lblLastUpdated').innerText = data.lastUpdated;
            document.getElementById('lblSource').innerText = data.source;

            renderHistoryTable(data.history);
            renderDashboard();
        })
        .catch(() => renderDashboard());
}

function renderHistoryTable(history) {
    const tbody = document.getElementById('historyTableBody');
    if (!tbody || !history) return;
    tbody.innerHTML = history.map(row => `
        <tr onclick="loadHistoryPrice(${row.future}, ${row.spot})">
            <td style="color: var(--primary);">${row.date}</td>
            <td>${row.spot.toFixed(1)}<br><span style="color:var(--text-muted); font-size:0.9em;">${row.future.toFixed(1)}</span></td>
            <td style="color: ${row.diff < 0 ? 'var(--danger)' : 'var(--success)'};">
                ${row.diff > 0 ? '+' : ''}${row.diff.toFixed(1)}<br>
                <span style="font-size:0.9em;">(${row.diffPct > 0 ? '+' : ''}${row.diffPct}%)</span>
            </td>
        </tr>
    `).join('');
}

function loadHistoryPrice(fPrice, sPrice) {
    document.getElementById('indexPrice').value = fPrice;
    document.getElementById('spotPrice').value = sPrice;
    renderDashboard();
}

function renderDashboard() {
    const idxPrice = parseFloat(document.getElementById('indexPrice').value) || 22815;
    const equity = parseFloat(document.getElementById('equity').value) || 0;
    const otherMargin = parseFloat(document.getElementById('otherMargin').value) || 0;

    render2DMatrix(idxPrice, equity, otherMargin);
    drawStrategyCurves();
}

function render2DMatrix(basePrice, totalEquity, otherMargin) {
    const container = document.getElementById('matrixTable');
    if (!container) return;

    const currentMiniQty = parseFloat(document.getElementById('miniQty').value) || 0;
    const currentMicroQty = parseFloat(document.getElementById('microQty').value) || 0;
    const centerMicroEquivalent = (currentMiniQty * 5) + currentMicroQty;

    const pctTicks = [];
    for (let p = -20; p <= 20; p += 2.5) pctTicks.push(p);
    const rowOffsets = [5, 4, 3, 2, 1, 0, -1, -2, -3, -4, -5];

    let html = `<thead><tr><th>調整口數 (微台)</th>`;
    pctTicks.forEach(p => html += `<th>${p > 0 ? '+' : ''}${p}%</th>`);
    html += `</tr></thead><tbody>`;

    const adjEquityBase = totalEquity - otherMargin;

    rowOffsets.forEach(offset => {
        const simulatedTotalMicro = centerMicroEquivalent + offset;
        if (simulatedTotalMicro < 0) return;

        const isCenterRow = (offset === 0);
        const rowStyle = isCenterRow ? `style="background: #1c2533; box-shadow: inset 0 0 0 1px var(--primary);"` : '';
        const rowLabel = isCenterRow ? `🎯 當前部位` : `${offset > 0 ? '+' : ''}${offset} 口`;

        html += `<tr ${rowStyle}>`;
        html += `<td style="font-weight:bold; color: ${isCenterRow ? 'var(--primary)' : 'var(--text-main)'};">${rowLabel}</td>`;
        
        pctTicks.forEach(p => {
            const targetPrice = basePrice * (1 + p / 100);
            const priceDiff = targetPrice - basePrice;
            const simulatedEquity = adjEquityBase + (priceDiff * simulatedTotalMicro * 10);
            const totalRequiredMaintenance = simulatedTotalMicro * 8200; // 微台維持保證金基準

            let ratio = totalRequiredMaintenance > 0 ? (simulatedEquity / totalRequiredMaintenance) * 100 : (simulatedEquity > 0 ? 9999 : 0);

            if (simulatedTotalMicro === 0) {
                html += `<td class="m-safe" style="color: var(--text-muted);">空倉</td>`;
            } else if (ratio <= 47 || simulatedEquity <= 0) {
                html += `<td class="m-danger">斷頭</td>`;
            } else if (ratio < 130) {
                html += `<td class="m-warn">${Math.round(ratio)}%</td>`;
            } else {
                html += `<td class="m-safe">${Math.round(ratio)}%</td>`;
            }
        });
        html += `</tr>`;
    });

    container.innerHTML = html + `</tbody>`;
}

function drawStrategyCurves() {
    const canvas = document.getElementById('strategyCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const padL = 50, padR = 30, padT = 20, padB = 40;
    const gW = w - padL - padR, gH = h - padT - padB;

    ctx.strokeStyle = '#30363d'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(padL, padT); ctx.lineTo(padL, h - padB); ctx.lineTo(w - padR, h - padB); ctx.stroke();

    function plot(id, color, formula) {
        const el = document.getElementById(id);
        if (!el || !el.checked) return;
        ctx.strokeStyle = color; ctx.lineWidth = 2;
        ctx.beginPath();
        for (let x = 0; x <= 100; x++) {
            let pct = (x - 50) / 2.5;
            let yVal = formula(pct); 
            let canvasX = padL + (x / 100) * gW;
            let canvasY = padT + gH - ((yVal - 40) / 140) * gH; 
            if (x === 0) ctx.moveTo(canvasX, canvasY); else ctx.lineTo(canvasX, canvasY);
        }
        ctx.stroke();
    }

    plot('chkBase', '#ff7b72', (p) => 100 + p);
    plot('chkFutureLong', '#58a6ff', (p) => 100 + p * 1.08 + 4);
    plot('chk0050', '#34d058', (p) => 100 + p * 0.96);
    plot('chk00631l', '#ffea7f', (p) => 100 + p * 1.95 + (p > 0 ? p*p*0.03 : -p*p*0.04));
    plot('chk00685l', '#ff944d', (p) => 100 + p * 1.98 + (p > 0 ? p*p*0.03 : -p*p*0.05));
    plot('chkCustom', '#bc85ff', (p) => 100 + p * 2.8);
}

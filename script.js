// 預設初始快照 (供重置使用)
const DEFAULT_SNAPSHOT = {
    indexPrice: 22815, equity: 2211000, miniQty: 0, microQty: 15, otherMargin: 0, etf631lPrice: 240.50, etf685lPrice: 306.75
};

document.addEventListener('DOMContentLoaded', () => {
    initEvents();
    loadCloudData();
});

function initEvents() {
    const inputs = ['indexPrice', 'equity', 'miniQty', 'microQty', 'otherMargin', 'etf631lPrice', 'etf685lPrice'];
    inputs.forEach(id => {
        document.getElementById(id).addEventListener('input', renderDashboard);
    });

    // 註冊勾選方塊事件
    ['chkBase', 'chkFutureLong', 'chk0050', 'chk00631l', 'chk00685l', 'chkCustom'].forEach(id => {
        document.getElementById(id).addEventListener('change', renderDashboard);
    });

    // 重置按鈕
    document.getElementById('btnReset').addEventListener('click', () => {
        Object.keys(DEFAULT_SNAPSHOT).forEach(id => {
            document.getElementById(id).value = DEFAULT_SNAPSHOT[id];
        });
        renderDashboard();
    });
}

function loadCloudData() {
    fetch('data.json')
        .then(res => res.json())
        .then(data => {
            document.getElementById('indexPrice').value = data.indexPrice;
            document.getElementById('etf685lPrice').value = data.etf685lPrice;
            document.getElementById('etf631lPrice').value = data.etf631lPrice || 240.50;
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
            <td style="color: #58a6ff;">${row.date}</td>
            <td>${row.spot.toFixed(1)}<br><span style="color:#8b949e; font-size:0.9em;">${row.future.toFixed(1)}</span></td>
            <td style="color: ${row.diff < 0 ? '#ff7b72' : '#56d364'};">
                ${row.diff > 0 ? '+' : ''}${row.diff.toFixed(2)}<br>
                <span style="font-size:0.9em;">(${row.diffPct > 0 ? '+' : ''}${row.diffPct}%)</span>
            </td>
        </tr>
    `).join('');
}

function loadHistoryPrice(fPrice, sPrice) {
    document.getElementById('indexPrice').value = fPrice;
    renderDashboard();
}

function renderDashboard() {
    const idxPrice = parseFloat(document.getElementById('indexPrice').value) || 22815;
    const equity = parseFloat(document.getElementById('equity').value) || 0;
    const miniQty = parseFloat(document.getElementById('miniQty').value) || 0;
    const microQty = parseFloat(document.getElementById('microQty').value) || 0;
    const otherMargin = parseFloat(document.getElementById('otherMargin').value) || 0;

    render2DMatrix(idxPrice, equity, otherMargin);
    drawStrategyCurves(idxPrice);
}

// 繪製橫軸每 2.5% 一格的風險矩陣
function render2DMatrix(basePrice, totalEquity, otherMargin) {
    const container = document.getElementById('matrixTable');
    if (!container) return;

    // 橫軸每 2.5% 一格 (-20% ~ +20%)
    const pctTicks = [];
    for (let p = -20; p <= 20; p += 2.5) pctTicks.push(p);

    // 縱軸持倉口數組合
    const rows = [1, 2, 3, 4, 5, 6, 8, 10];

    // 建立表頭
    let html = `<thead><tr><th>持倉口數</th>`;
    pctTicks.forEach(p => html += `<th>${p > 0 ? '+' : ''}${p}%</th>`);
    html += `</tr></thead><tbody>`;

    // 假設小台維持保證金 41,000 元，微台 8,200 元 (實務上隨期交所變動)
    const adjEquityBase = totalEquity - otherMargin;

    rows.forEach(qty => {
        // 以當前輸入的小台微台比例當基準，或是這裡我們統一簡化成換算後的「總微台口數」來做2D矩陣多維對照
        // 為了完美重現圖片邏輯：縱軸代表「不同合約口數下的維持率變化」
        html += `<tr><td style="font-weight:bold;">${qty} 口</td>`;
        
        pctTicks.forEach(p => {
            const targetPrice = basePrice * (1 + p / 100);
            const priceDiff = targetPrice - basePrice;
            
            // 每點合約價值 (以每口150元乘數試算)
            const roundMultiplier = (miniQty * 50 + microQty * 10) * (qty / (miniQty + microQty / 5 || 1));
            const totalRequiredMaintenance = (qty * 41000); // 基準維持保證金估算

            const simulatedEquity = adjEquityBase + (priceDiff * (qty * 50)); // 假設以小台規模模擬
            const ratio = (simulatedEquity / totalRequiredMaintenance) * 100;

            if (ratio <= 47 || simulatedEquity <= 0) {
                html += `<td class="m-danger">⚠️ 斷頭</td>`;
            } else if (ratio < 130) {
                html += `<td class="m-warn">${Math.round(ratio)}%</td>`;
            } else {
                html += `<td class="m-safe">${Math.round(ratio)}%</td>`;
            }
        });
        html += `</tr>`;
    });

    html += `</tbody>`;
    container.innerHTML = html;
}

// 多維度策略路徑 Canvas 模擬曲線
function drawStrategyCurves(currentPrice) {
    const canvas = document.getElementById('strategyCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const padL = 50, padR = 30, padT = 20, padB = 40;
    const gW = w - padL - padR, gH = h - padT - padB;

    // 模擬橫軸：未來的時間/波段波幅 (0 ~ 100 區間點)
    // 繪製座標軸
    ctx.strokeStyle = '#30363d'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(padL, padT); ctx.lineTo(padL, h - padB); ctx.lineTo(w - padR, h - padB); ctx.stroke();

    // 模擬複合公式：複利與震盪損耗方程式
    function plot(id, color, formula) {
        if (!document.getElementById(id).checked) return;
        ctx.strokeStyle = color; ctx.lineWidth = 2;
        ctx.beginPath();
        for (let x = 0; x <= 100; x++) {
            let pct = (x - 50) / 2.5; // 模擬波動
            let yVal = formula(pct); 
            // 映射到畫布
            let canvasX = padL + (x / 100) * gW;
            let canvasY = padT + gH - ((yVal - 50) / 150) * gH; // 淨值波幅上下限映射
            if (x === 0) ctx.moveTo(canvasX, canvasY); else ctx.lineTo(canvasX, canvasY);
        }
        ctx.stroke();
    }

    // 🔴 基準線
    plot('chkBase', '#f85149', (p) => 100 + p);
    // 🔵 期指長投策略 (自帶微幅正價差/轉倉紅利趨勢)
    plot('chkFutureLong', '#58a6ff', (p) => 100 + p * 1.1 + 5);
    // 🟢 0050
    plot('chk0050', '#34d058', (p) => 100 + p * 0.95);
    // 🟡 00631L (2倍槓桿 + 每日平衡複利效果)
    plot('chk00631l', '#ffea7f', (p) => 100 + p * 2.0 + (p > 0 ? p*p*0.05 : -p*p*0.05));
    // 🟠 00685L
    plot('chk00685l', '#ff944d', (p) => 100 + p * 2.05 + (p > 0 ? p*p*0.04 : -p*p*0.06));
    // 🟣 自訂期貨部位曲線
    plot('chkCustom', '#bc85ff', (p) => 100 + p * 3.0);
}

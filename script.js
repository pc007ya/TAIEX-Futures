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

// 繪製 Y 軸以當前部位為中心，上下各調整 5 口微台的動態風險矩陣
function render2DMatrix(basePrice, totalEquity, otherMargin) {
    const container = document.getElementById('matrixTable');
    if (!container) return;

    // 1. 讀取當前使用者輸入的口數，並換算成「總微台點數規模」作為基準中心
    const currentMiniQty = parseFloat(document.getElementById('miniQty').value) || 0;
    const currentMicroQty = parseFloat(document.getElementById('microQty').value) || 0;
    
    // 將當前總部位換算成「微台口數」：1口小台 = 5口微台
    const centerMicroEquivalent = (currentMiniQty * 5) + currentMicroQty;

    // 2. 橫軸（X軸）：每 2.5% 一格 (-20% ~ +20%)
    const pctTicks = [];
    for (let p = -20; p <= 20; p += 2.5) pctTicks.push(p);

    // 3. 縱軸（Y軸）：以中心點上下各推 5 口微台
    const rowOffsets = [5, 4, 3, 2, 1, 0, -1, -2, -3, -4, -5]; // 由多到少排序，符合視覺習慣

    // 建立表頭
    let html = `<thead><tr><th>調整口數 (微台)</th>`;
    pctTicks.forEach(p => html += `<th>${p > 0 ? '+' : ''}${p}%</th>`);
    html += `</tr></thead><tbody>`;

    const adjEquityBase = totalEquity - otherMargin;

    // 4. 動態橫向與縱向交叉計算
    rowOffsets.forEach(offset => {
        // 計算該列對應的虛擬總微台口數
        const simulatedTotalMicro = centerMicroEquivalent + offset;
        
        // 房外防護：如果減倉減到小於 0 口，則不呈現或顯示空倉
        if (simulatedTotalMicro < 0) return;

        // 標記目前現狀那一列
        const isCenterRow = (offset === 0);
        const rowStyle = isCenterRow ? `style="background: #1f293d; border: 2px solid #58a6ff;"` : '';
        const rowLabel = isCenterRow ? `當前部位` : `${offset > 0 ? '+' : ''}${offset} 口`;

        html += `<tr ${rowStyle}>`;
        html += `<td style="font-weight:bold; color: ${isCenterRow ? '#58a6ff' : 'var(--text-main)'};">${rowLabel}</td>`;
        
        // 遍歷 X 軸漲跌幅
        pctTicks.forEach(p => {
            const targetPrice = basePrice * (1 + p / 100);
            const priceDiff = targetPrice - basePrice;
            
            // 計算該部位在該跌幅下的權益變動 (每 1 口微台點值為 10 元)
            const simulatedEquity = adjEquityBase + (priceDiff * simulatedTotalMicro * 10);
            
            // 台灣期交所微台維持保證金目前約為 8,200 元 (此處以此作為矩陣分母基準)
            const totalRequiredMaintenance = simulatedTotalMicro * 8200;

            // 計算預估維持率
            let ratio = 0;
            if (totalRequiredMaintenance > 0) {
                ratio = (simulatedEquity / totalRequiredMaintenance) * 100;
            } else {
                ratio = simulatedEquity > 0 ? 9999 : 0; // 空倉狀態
            }

            // 判斷風險燈號
            if (simulatedTotalMicro === 0) {
                html += `<td class="m-safe" style="color: #8b949e;">無曝險</td>`;
            } else if (ratio <= 47 || simulatedEquity <= 0) {
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

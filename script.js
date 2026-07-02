/**
 * 📊 期貨部位曝險與 2D 風險評估矩陣看板 - 核心邏輯
 * * 功能整合：
 * 1. 2.5% 精細化風險矩陣（Y軸以當前部位為中心上下各5口微台跳動）
 * 2. 歷史折溢價對照表點擊連動
 * 3. 讀取滾動式 JSON 資料庫，將過去 30 天真實市場價格進行「歸一化 (100%) 走勢對照」
 * 4. 一鍵重置快照
 */

// 預設初始快照資料 (供一鍵重置使用)
const DEFAULT_SNAPSHOT = {
    indexPrice: 22815, 
    spotPrice: 22840.15, 
    equity: 2352660, 
    miniQty: 2, 
    microQty: 5, 
    otherMargin: 49613, 
    etf50Price: 185.00, 
    etf631lPrice: 240.50, 
    etf685lPrice: 306.75
};

// 全域變數：用來暫存從 data.json 讀取到的近一個月歷史陣列
let globalHistoryData = [];

// 網頁初始化載入
document.addEventListener('DOMContentLoaded', () => {
    initEvents();
    loadCloudData();
});

/**
 * 1. 註冊所有前端 UI 監聽事件
 */
function initEvents() {
    // 綁定所有輸入框的輸入事件
    const inputs = ['indexPrice', 'spotPrice', 'equity', 'miniQty', 'microQty', 'otherMargin', 'etf50Price', 'etf631lPrice', 'etf685lPrice'];
    inputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', renderDashboard);
    });

    // 綁定多維度策略對照曲線的勾選方塊
    const checkboxes = ['chkBase', 'chkFutureLong', 'chk0050', 'chk00631l', 'chk00685l', 'chkCustom'];
    checkboxes.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', renderDashboard);
    });

    // 註冊重置按鈕功能
    const resetBtn = document.getElementById('btnReset');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            Object.keys(DEFAULT_SNAPSHOT).forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = DEFAULT_SNAPSHOT[id];
            });
            renderDashboard();
        });
    }
}

/**
 * 2. 從 GitHub 伺服器載入 Actions 自動更新的滾動資料庫
 */
function loadCloudData() {
    fetch('data.json')
        .then(res => res.json())
        .then(data => {
            // 自動將最新的收盤數據填入對應的輸入框中
            document.getElementById('indexPrice').value = data.indexPrice;
            document.getElementById('spotPrice').value = data.spotPrice;
            document.getElementById('etf50Price').value = data.etf50Price || 185.00;
            document.getElementById('etf631lPrice').value = data.etf631lPrice || 240.50;
            document.getElementById('etf685lPrice').value = data.etf685lPrice;
            
            // 渲染資料來源與時間戳記
            document.getElementById('lblLastUpdated').innerText = data.lastUpdated;
            document.getElementById('lblSource').innerText = data.source;

            // 將近 1 個月的滾動數據存入全域變數
            globalHistoryData = data.history || [];

            // 渲染左下角的歷史折溢價表格
            renderHistoryTable(globalHistoryData);
            
            // 執行第一次看板大渲染
            renderDashboard();
        })
        .catch(err => {
            console.error("讀取自動化資料庫失敗，改用預設快照進行本地計算", err);
            document.getElementById('lblLastUpdated').innerText = "使用網頁預設值";
            document.getElementById('lblSource').innerText = "區域靜態快照資料";
            renderDashboard();
        });
}

/**
 * 3. 渲染歷史收盤與價差對照表
 */
function renderHistoryTable(history) {
    const tbody = document.getElementById('historyTableBody');
    if (!tbody || !history || history.length === 0) return;
    
    tbody.innerHTML = history.map(row => `
        <tr onclick="loadHistoryPrice(${row.future}, ${row.spot})">
            <td style="color: var(--primary); font-weight: 500;">${row.date}</td>
            <td>${row.spot.toFixed(1)}<br><span style="color:var(--text-muted); font-size:0.9em;">${row.future.toFixed(1)}</span></td>
            <td style="color: ${row.diff < 0 ? 'var(--danger)' : 'var(--success)'}; font-weight: 500;">
                ${row.diff > 0 ? '+' : ''}${row.diff.toFixed(1)}<br>
                <span style="font-size:0.9em;">(${row.diffPct > 0 ? '+' : ''}${row.diffPct}%)</span>
            </td>
        </tr>
    `).join('');
}

/**
 * 4. 點擊歷史紀錄列時，動態將當時的期現貨價格同步回左側輸入框
 */
function loadHistoryPrice(fPrice, sPrice) {
    document.getElementById('indexPrice').value = fPrice;
    document.getElementById('spotPrice').value = sPrice;
    renderDashboard();
}

/**
 * 5. 看板核心調度器 (渲染矩陣與 Canvas 線條)
 */
function renderDashboard() {
    const idxPrice = parseFloat(document.getElementById('indexPrice').value) || 22815;
    const equity = parseFloat(document.getElementById('equity').value) || 0;
    const otherMargin = parseFloat(document.getElementById('otherMargin').value) || 0;

    // 重新繪製 2D 矩陣
    render2DMatrix(idxPrice, equity, otherMargin);
    
    // 重新繪製真實歷史歷史曲線走勢
    drawStrategyCurves();
}

/**
 * 6. 核心演算法：生成以當前持倉為中心，上下各調 5 口微台的 2.5% 風險評估矩陣
 */
function render2DMatrix(basePrice, totalEquity, otherMargin) {
    const container = document.getElementById('matrixTable');
    if (!container) return;

    // 讀取目前的合約配置並換算成總微台口數基準
    const currentMiniQty = parseFloat(document.getElementById('miniQty').value) || 0;
    const currentMicroQty = parseFloat(document.getElementById('microQty').value) || 0;
    const centerMicroEquivalent = (currentMiniQty * 5) + currentMicroQty;

    // 橫軸（X軸）跌幅區間：每 2.5% 一格 (-20% ~ +20%)
    const pctTicks = [];
    for (let p = -20; p <= 20; p += 2.5) pctTicks.push(p);
    
    // 縱軸（Y軸）口數偏移：以當前為中心上下調 5 口
    const rowOffsets = [5, 4, 3, 2, 1, 0, -1, -2, -3, -4, -5];

    // 生成表頭 HTML
    let html = `<thead><tr><th>調整口數 (微台)</th>`;
    pctTicks.forEach(p => html += `<th>${p > 0 ? '+' : ''}${p}%</th>`);
    html += `</tr></thead><tbody>`;

    const adjEquityBase = totalEquity - otherMargin;

    // 橫縱交叉計算預估維持率
    rowOffsets.forEach(offset => {
        const simulatedTotalMicro = centerMicroEquivalent + offset;
        if (simulatedTotalMicro < 0) return; // 防呆：總口數不能為負數

        const isCenterRow = (offset === 0);
        const rowStyle = isCenterRow ? `style="background: #1c2533; box-shadow: inset 0 0 0 1px var(--primary);"` : '';
        const rowLabel = isCenterRow ? `🎯 當前部位` : `${offset > 0 ? '+' : ''}${offset} 口`;

        html += `<tr ${rowStyle}>`;
        html += `<td style="font-weight:bold; color: ${isCenterRow ? 'var(--primary)' : 'var(--text-main)'};">${rowLabel}</td>`;
        
        pctTicks.forEach(p => {
            const targetPrice = basePrice * (1 + p / 100);
            const priceDiff = targetPrice - basePrice;
            
            // 計算在該漲跌幅下，該虛擬口數所產生的帳戶淨值 (微台每點點值10元)
            const simulatedEquity = adjEquityBase + (priceDiff * simulatedTotalMicro * 10);
            
            // 微台指維持保證金基準 (每口約 8,200 元)
            const totalRequiredMaintenance = simulatedTotalMicro * 8200;

            let ratio = totalRequiredMaintenance > 0 ? (simulatedEquity / totalRequiredMaintenance) * 100 : (simulatedEquity > 0 ? 9999 : 0);

            if (simulatedTotalMicro === 0) {
                html += `<td class="m-safe" style="color: var(--text-muted); font-size: 0.9em;">空倉</td>`;
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

/**
 * 7. 數據實體化：拉取近一個月真實收盤價，進行歸一化 (100%) 走勢渲染
 */
function drawStrategyCurves() {
    const canvas = document.getElementById('strategyCanvas');
    if (!canvas || globalHistoryData.length < 2) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const padL = 55, padR = 35, padT = 35, padB = 45;
    const gW = w - padL - padR, gH = h - padT - padB;

    // 將資料順序反轉（歷史資料原本最新在首位，反轉後左側代表最舊起點，右側代表最新今日）
    const timeline = [...globalHistoryData].reverse();
    const totalDays = timeline.length;

    // 繪製基礎座標軸
    ctx.strokeStyle = '#30363d'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(padL, padT); ctx.lineTo(padL, h - padB); ctx.lineTo(w - padR, h - padB); ctx.stroke();

    // 讀取 30 天前的價格作為歸一化基數（分母）
    const baseSpot = timeline[0].spot;
    const baseFuture = timeline[0].future;
    const base50 = timeline[0].p50 || (baseSpot / 122); // 若歷史節點無資料時的極端安全防護
    const base631l = timeline[0].p631l || 240.50;
    const base685l = timeline[0].p685l || 306.75;

    // 讀取當前的期貨合約規模與原始總本金
    const currentMiniQty = parseFloat(document.getElementById('miniQty').value) || 0;
    const currentMicroQty = parseFloat(document.getElementById('microQty').value) || 0;
    const totalMicroPoints = (currentMiniQty * 5) + currentMicroQty;
    const initialEquity = parseFloat(document.getElementById('equity').value) || 2352660;

    // 繪製各條「實時歷史走勢線」
    defDrawLine('chkBase', '#ff7b72', (day) => (day.spot / baseSpot) * 100);
    defDrawLine('chkFutureLong', '#58a6ff', (day) => (day.future / baseFuture) * 100);
    defDrawLine('chk0050', '#34d058', (day) => ((day.p50 || base50) / base50) * 100);
    defDrawLine('chk00631l', '#ffea7f', (day) => ((day.p631l || base631l) / base631l) * 100);
    defDrawLine('chk00685l', '#ff944d', (day) => ((day.p685l || base685l) / base685l) * 100);
    
    // 紫色線：以你的總本金為分母，反映該口數規模在過去一個月真實承受過的淨值波動與報酬率
    defDrawLine('chkCustom', '#bc85ff', (day) => {
        const priceChange = day.future - baseFuture;
        const simulatedProfit = priceChange * totalMicroPoints * 10; 
        return ((initialEquity + simulatedProfit) / initialEquity) * 100;
    });

    // 歷史軌跡線繪圖工具
    function defDrawLine(id, color, valueExtractor) {
        const el = document.getElementById(id);
        if (!el || !el.checked) return;
        
        ctx.strokeStyle = color; ctx.lineWidth = 2.5;
        ctx.beginPath();

        for (let i = 0; i < totalDays; i++) {
            const yPercentage = valueExtractor(timeline[i]); // 取得百分比數值 (中心點為 100)
            const canvasX = padL + (i / (totalDays - 1)) * gW;
            
            // 縱軸邊界動態對齊：畫面上下限可容納 70% ~ 140% 的歷史資產波動
            const canvasY = padT + gH - ((yPercentage - 70) / 70) * gH;

            if (i === 0) ctx.moveTo(canvasX, canvasY); else ctx.lineTo(canvasX, canvasY);
        }
        ctx.stroke();
    }

    // 繪製日期與圖表軸標籤
    ctx.fillStyle = '#8b949e'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(timeline[0].date, padL, h - padB + 16);
    ctx.fillText(timeline[totalDays - 1].date, w - padR, h - padB + 16);
    ctx.fillText("📈 近 1 個月真實歷史資產淨值走勢對照 (起點歸一化為 100%)", w / 2, padT - 12);
}

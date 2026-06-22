document.addEventListener('DOMContentLoaded', () => {
    // 綁定輸入事件監聽器
    const inputs = ['indexPrice', 'equity', 'miniQty', 'microQty', 'otherMargin', 'etfPrice'];
    inputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', calculateAll);
    });

    // 讀取自動更新的 json 檔案
    fetch('data.json')
        .then(response => response.json())
        .then(data => {
            // 自動將爬蟲抓到的數值塞進輸入框
            document.getElementById('indexPrice').value = data.indexPrice;
            document.getElementById('etfPrice').value = data.etfPrice;
            
            // 寫入最下方的更新時間與來源註記
            document.getElementById('lblLastUpdated').innerText = data.lastUpdated || "未取得";
            document.getElementById('lblSource').innerText = data.source || "Yahoo Finance";
            
            // 執行計算
            calculateAll();
        })
        .catch(err => {
            console.log("讀取自動化資料失敗，改用預設值", err);
            document.getElementById('lblLastUpdated').innerText = "讀取失敗，使用網頁預設值";
            document.getElementById('lblSource').innerText = "區域靜態資料";
            calculateAll();
        });
});
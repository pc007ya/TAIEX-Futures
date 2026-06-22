// 網頁開啟時，自動向後端/JSON 檔案索取最新價格
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
            
            // 在畫面上加一小行提示字，顯示最新更新時間
            const titleEl = document.querySelector('h1');
            if (titleEl) {
                const timeTip = document.createElement('p');
                timeTip.style.fontSize = '0.4em';
                timeTip.style.color = '#64748b';
                timeTip.innerText = `📊 行情自動更新時間 (台股收盤): ${data.lastUpdated}`;
                titleEl.appendChild(timeTip);
            }
            
            // 執行第一次計算
            calculateAll();
        })
        .catch(err => {
            console.log("讀取自動化資料失敗，改用預設值", err);
            calculateAll();
        });
});
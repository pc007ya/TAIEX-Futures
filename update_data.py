import json
import time
from datetime import datetime
import yfinance as yf

def fetch_latest_data():
    try:
        # 1. 抓取大盤加權指數基準
        twii = yf.Ticker("^TWII")
        todays_data = twii.history(period="1d")
        index_price = round(todays_data['Close'].iloc[-1], 2)

        # 2. 抓取 00685L 市價
        etf = yf.Ticker("00685L.TW")
        etf_data = etf.history(period="1d")
        etf_price = round(etf_data['Close'].iloc[-1], 2)

        # 3. 封裝 JSON 數據結構
        current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        updated_data = {
            "indexPrice": index_price,
            "etfPrice": etf_price,
            "lastUpdated": current_time,
            "source": "Yahoo Finance (延遲 20 分鐘或收盤價)"
        }

        # 4. 覆寫更新 data.json
        with open("data.json", "w", encoding="utf-8") as f:
            json.dump(updated_data, f, ensure_ascii=False, indent=2)
            
        print(f"數據更新成功：{current_time}")

    except Exception as e:
        print(f"自動抓取數據失敗: {e}")

if __name__ == "__main__":
    fetch_latest_data()
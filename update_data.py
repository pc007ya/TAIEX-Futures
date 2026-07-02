import json
import time
from datetime import datetime
import yfinance as yf

def fetch_latest_data():
    try:
        index_price = 46752
        etf_price = 306.75
        etf_631l_price = 245.50
        
        try:
            twii = yf.Ticker("^TWII")
            todays_data = twii.history(period="2d")
            if not todays_data.empty:
                index_price = round(todays_data['Close'].iloc[-1], 2)
        except Exception as e:
            print(f"大盤數據抓取異常: {e}")

        try:
            etf = yf.Ticker("00685L.TW")
            etf_data = etf.history(period="2d")
            if not etf_data.empty:
                etf_price = round(etf_data['Close'].iloc[-1], 2)
        except Exception as e:
            print(f"00685L 數據抓取異常: {e}")

        try:
            etf_631l = yf.Ticker("00631L.TW")
            etf_631l_data = etf_631l.history(period="2d")
            if not etf_631l_data.empty:
                etf_631l_price = round(etf_631l_data['Close'].iloc[-1], 2)
        except Exception as e:
            print(f"00631L 數據抓取異常: {e}")

        current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        updated_data = {
            "indexPrice": index_price,
            "etfPrice": etf_price,
            "etf631LPrice": etf_631l_price,
            "lastUpdated": current_time,
            "source": "Yahoo Finance (自動防護機制)"
        }

        with open("data.json", "w", encoding="utf-8") as f:
            json.dump(updated_data, f, ensure_ascii=False, indent=2)
            
        print(f"數據更新成功：{current_time}")

    except Exception as e:
        print(f"嚴重錯誤: {e}")

if __name__ == "__main__":
    fetch_latest_data()

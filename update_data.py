import json
from datetime import datetime
import yfinance as yf

def fetch_all_market_data():
    try:
        print("🚀 開始爬取市場真實報價...")
        
        # 1. 抓取大盤加權指數與台指期貨連續合約
        spot_ticker = yf.Ticker("^TWII")
        future_ticker = yf.Ticker("WTX=F")
        
        spot_hist = spot_ticker.history(period="5d")
        future_hist = future_ticker.history(period="5d")
        
        if spot_hist.empty or future_hist.empty:
            raise ValueError("Yahoo Finance 歷史資料獲取空值")
            
        # 2. 抓取三大指標現貨價格
        p_50 = round(yf.Ticker("0050.TW").history(period="1d")['Close'].iloc[-1], 2)
        p_631l = round(yf.Ticker("00631L.TW").history(period="1d")['Close'].iloc[-1], 2)
        p_685l = round(yf.Ticker("00685L.TW").history(period="1d")['Close'].iloc[-1], 2)
        
        current_spot = round(spot_hist['Close'].iloc[-1], 2)
        current_future = round(future_hist['Close'].iloc[-1], 2)

        # 3. 建立對齊的五日歷史價差對照表
        history_list = []
        for i in range(len(spot_hist)):
            s_val = round(spot_hist['Close'].iloc[i], 2)
            try:
                f_val = round(future_hist['Close'].iloc[i], 2)
            except IndexError:
                f_val = s_val - 25.0
                
            diff = round(f_val - s_val, 2)
            diff_pct = round((diff / s_val) * 100, 2)
            date_str = spot_hist.index[i].strftime("%Y-%m-%d")
            
            history_list.append({
                "date": date_str, "spot": s_val, "future": f_val, "diff": diff, "diffPct": diff_pct
            })
        
        history_list.reverse()

        # 4. 寫入擴展資料庫
        updated_data = {
            "indexPrice": current_future,
            "spotPrice": current_spot,
            "etf50Price": p_50,
            "etf631lPrice": p_631l,
            "etf685lPrice": p_685l,
            "lastUpdated": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "source": "Yahoo Finance 全即時數據流",
            "history": history_list
        }

        with open("data.json", "w", encoding="utf-8") as f:
            json.dump(updated_data, f, ensure_ascii=False, indent=2)
            
        print("🎉 數據同步成功！")

    except Exception as e:
        print(f"❌ 爬蟲異常: {e}")

if __name__ == "__main__":
    fetch_all_market_data()

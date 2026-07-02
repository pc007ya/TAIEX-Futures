import json
import os
from datetime import datetime
import yfinance as yf

def fetch_rolling_market_data():
    try:
        print("🚀 開始抓取今日收盤數據並更新歷史庫...")
        
        # 1. 抓取當日最新數據
        spot_val = round(yf.Ticker("^TWII").history(period="1d")['Close'].iloc[-1], 2)
        future_val = round(yf.Ticker("WTX=F").history(period="1d")['Close'].iloc[-1], 2)
        p_50 = round(yf.Ticker("0050.TW").history(period="1d")['Close'].iloc[-1], 2)
        p_631l = round(yf.Ticker("00631L.TW").history(period="1d")['Close'].iloc[-1], 2)
        p_685l = round(yf.Ticker("00685L.TW").history(period="1d")['Close'].iloc[-1], 2)
        
        date_str = datetime.now().strftime("%Y-%m-%d")
        diff = round(future_val - spot_val, 2)
        diff_pct = round((diff / spot_val) * 100, 2)

        # 新的一天數據節點
        new_entry = {
            "date": date_str,
            "spot": spot_val,
            "future": future_val,
            "diff": diff,
            "diffPct": diff_pct,
            "p50": p_50,
            "p631l": p_631l,
            "p685l": p_685l
        }

        # 2. 讀取現有的歷史紀錄
        history_list = []
        if os.path.exists("data.json"):
            try:
                with open("data.json", "r", encoding="utf-8") as f:
                    old_data = json.load(f)
                    history_list = old_data.get("history", [])
            except Exception:
                pass

        # 3. 避免同一個交易日重複寫入
        if history_list and history_list[0]["date"] == date_str:
            history_list[0] = new_entry  # 如果日期相同就更新
        else:
            history_list.insert(0, new_entry)  # 如果是新的一天就插在最前面

        # 🔥 核心控制：只保留最近 30 筆交易日資料 (約近1個月)
        if len(history_list) > 30:
            history_list = history_list[:30]

        # 4. 包裝並覆寫回 data.json
        updated_data = {
            "indexPrice": future_val,
            "spotPrice": spot_val,
            "etf50Price": p_50,
            "etf631lPrice": p_631l,
            "etf685lPrice": p_685l,
            "lastUpdated": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "source": "Yahoo Finance (近1個月真實滾動數據庫)",
            "history": history_list
        }

        with open("data.json", "w", encoding="utf-8") as f:
            json.dump(updated_data, f, ensure_ascii=False, indent=2)
            
        print(f"🎉 歷史庫更新成功！目前已累積 {len(history_list)} 天真實數據。")

    except Exception as e:
        print(f"❌ 滾動更新異常: {e}")

if __name__ == "__main__":
    fetch_rolling_market_data()


import sys
import os
import pandas as pd
import numpy as np

sys.path.append(os.path.join(os.getcwd(), 'backend'))

from indicators import Indicators
# We don't need DataLoader for simple indicators if we mock the price data

def debug_simple():
    print("--- DEBUG STANDARD INDICATORS ---")
    
    # 1. Mock Data (100 days of price)
    dates = pd.date_range(end=pd.Timestamp.now(), periods=100, freq='D')
    df = pd.DataFrame({
        'time': dates.astype('int64') // 10**9,
        'close': np.linspace(100, 200, 100) + np.sin(np.linspace(0, 10, 100))*10,
        'open': np.linspace(95, 195, 100),
        'high': np.linspace(105, 205, 100),
        'low': np.linspace(90, 190, 100)
    }, index=dates)
    
    # Ensure TZ-naive to match potential server env
    df.index = df.index.tz_localize(None)
    
    print(f"Mock Data Created: {len(df)} rows.")
    
    indicators = Indicators(loader=None) # Loader not needed for SMA
    
    # 2. Test SMA
    print("\n[Testing SMA]")
    try:
        res_sma = indicators.apply_indicator(df.copy(), 'SMA', length=20)
        print("Columns:", res_sma.columns.tolist())
        if 'value' in res_sma.columns:
            vals = res_sma['value'].dropna()
            print(f"SMA 'value' count: {len(vals)}")
            print(f"SMA Sample: {vals.tail().tolist()}")
        else:
            print("ERROR: 'value' column MISSING in SMA result.")
    except Exception as e:
        print(f"SMA Exception: {e}")
        
    # 3. Test RSI
    print("\n[Testing RSI]")
    try:
        res_rsi = indicators.apply_indicator(df.copy(), 'RSI', length=14)
        print("Columns:", res_rsi.columns.tolist())
        if 'value' in res_rsi.columns:
            vals = res_rsi['value'].dropna()
            print(f"RSI 'value' count: {len(vals)}")
            print(f"RSI Sample: {vals.tail().tolist()}")
        else:
            print("ERROR: 'value' column MISSING in RSI result.")
    except Exception as e:
        print(f"RSI Exception: {e}")

    # 4. Test EMA (New)
    print("\n[Testing EMA]")
    try:
        res_ema = indicators.apply_indicator(df.copy(), 'EMA', length=20)
        print("Columns:", res_ema.columns.tolist())
        if 'value' in res_ema.columns:
            vals = res_ema['value'].dropna()
            print(f"EMA 'value' count: {len(vals)}")
        else:
             print("ERROR: 'value' column MISSING in EMA result.")
    except Exception as e:
        print(f"EMA Exception: {e}")

if __name__ == "__main__":
    debug_simple()

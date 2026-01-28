
import sys
import os
import pandas as pd
import numpy as np

sys.path.append(os.path.join(os.getcwd(), 'backend'))

from data_loader import DataLoader
from indicators import Indicators

def deep_debug():
    print("--- DEEP LOGIC REVIEW ---")
    loader = DataLoader()
    
    # 1. Simulate Server Fetching BTC
    print("1. Fetching BTC/USDT (CCXT/TV)...")
    # Using 'auto' to mimic server
    df_btc = loader.fetch_data('BTC/USDT', '1d', limit=1000)
    
    if df_btc.empty:
        print("CRITICAL: BTC fetch failed. Creating mock BTC data for alignment test.")
        dates = pd.date_range(end=pd.Timestamp.now(), periods=1000, freq='D')
        df_btc = pd.DataFrame({'close': 50000}, index=dates)
    else:
        print(f"BTC Loaded: {len(df_btc)} rows.")
        print(f"BTC Index Type: {df_btc.index.dtype}")
        print(f"BTC Index TZ: {df_btc.index.tz}")
        print(f"BTC Sample Index: {df_btc.index[0]} to {df_btc.index[-1]}")

    # 2. Simulate Indicator Logic internals
    print("\n2. Fetching WALCL (Macro)...")
    walcl_df = loader.fetch_macro_data('WALCL')
    
    if walcl_df.empty:
        print("CRITICAL: WALCL fetch failed (even synthetic).")
        return
        
    print(f"WALCL Loaded: {len(walcl_df)} rows.")
    print(f"WALCL Index Type: {walcl_df.index.dtype}")
    print(f"WALCL Index TZ: {walcl_df.index.tz}")
    print(f"WALCL Sample: {walcl_df.iloc[0]['close']} ... {walcl_df.iloc[-1]['close']}")
    
    # 3. Simulate Alignment (THE CRITICAL STEP)
    print("\n3. Testing Alignment (Reindex)...")
    try:
        # Exact line from indicators.py
        walcl_aligned = walcl_df['close'].reindex(df_btc.index, method='ffill')
        
        print(f"Aligned Count: {len(walcl_aligned)}")
        print(f"Aligned Non-NaN: {walcl_aligned.count()}")
        print(f"Aligned Sample: {walcl_aligned.head()}")
        
        if walcl_aligned.isna().all():
            print("FAILURE: Aligned data is ALL NaN! Index mismatch suspected.")
            
            # DIAGNOSE MISMATCH
            print("\n--- DIAGNOSTICS ---")
            print("BTC Index Example:", df_btc.index[0])
            print("WALCL Index Example:", walcl_df.index[0])
            
            # Check if one is TZ-aware
            if df_btc.index.tz is not None and walcl_df.index.tz is None:
                print("MISMATCH DETECTED: BTC is TZ-aware, WALCL is Naive.")
            elif df_btc.index.tz is None and walcl_df.index.tz is not None:
                print("MISMATCH DETECTED: BTC is Naive, WALCL is TZ-aware.")
                
        else:
            print("SUCCESS: Alignment contains data.")
            
            # 4. Check ROC
            roc = walcl_aligned.pct_change(periods=28)
            print(f"ROC Non-NaN: {roc.count()}")
            print(f"ROC Sample: {roc.dropna().tail()}")
            
    except Exception as e:
        print(f"Exception during alignment: {e}")

if __name__ == "__main__":
    deep_debug()

from indicators import Indicators
from data_loader import DataLoader
import pandas as pd
import numpy as np

loader = DataLoader()
ind = Indicators()

print("Fetching BTC Data...")
df_btc = loader.fetch_data('BTC/USDT', '1d', source='ccxt')

print("Fetching Global M2...")
df_m2 = loader.fetch_global_m2()

print("Merging...")
df = loader.merge_with_macro(df_btc, df_m2)

print("\nCalculating BTC_GM2 (Market Cap Formula)...")
df = ind.ind_BTC_GM2(df)

print("\n--- Verification Report ---")
if 'BTC_GM2' in df.columns:
    last_val = df['BTC_GM2'].iloc[-1]
    last_close = df['close'].iloc[-1]
    last_m2 = df['global_m2'].iloc[-1]
    last_supply = df['btc_supply'].iloc[-1]
    last_mcap = df['btc_market_cap'].iloc[-1]
    
    print(f"Date: {df.index[-1]}")
    print(f"BTC Price: ${last_close:,.2f}")
    print(f"BTC Supply (Est): {last_supply:,.0f}")
    print(f"BTC Market Cap: ${last_mcap:,.0f}")
    print(f"Global M2: ${last_m2:,.0f}")
    print(f"GM2 Ratio: {last_val:.4f}%")
    
    # Check if reasonable (between 0.01% and 5%)
    if 0.01 < last_val < 5.0:
        print("PASS: GM2 Ratio is within reasonable range (0.01% - 5%).")
    else:
        print("FAIL: GM2 Ratio is out of expected range!")
else:
    print("FAIL: BTC_GM2 column missing.")

from data_loader import DataLoader
import pandas as pd

loader = DataLoader()

# Manually run the component logic to debug
components = [
    ('US', 'M2SL', None, 'none'),
    ('EU', 'MYAGM2EZM196N', 'EURUSD=X', 'multiply'),
    ('CN', 'MYAGM2CNM189N', 'CNY=X', 'divide'),
    ('JP', 'MYAGM2JPM189S', 'JPY=X', 'divide'),
    ('UK', 'MABMM201GBM189S', 'GBPUSD=X', 'multiply'),
    ('CA', 'MAM2A2CAM189N', 'CAD=X', 'divide'),
    ('RU', 'MYAGM2RUM189N', 'RUB=X', 'divide'),
    ('CH', 'MANM2ICHM189S', 'CHF=X', 'divide')
]

print("--- Debugging Components ---")
for name, m2_ticker, fx_ticker, op in components:
    print(f"\nProcessing {name} ({m2_ticker})...")
    m2_df = loader.fetch_macro_data(m2_ticker)
    
    if m2_df.empty:
        print(f"  M2 DF Empty")
        continue

    # Unit Fix
    if m2_ticker == 'M2SL':
         m2_df['close'] = m2_df['close'] * 1e9

    print(f"  M2 Units: {m2_df['close'].iloc[-1]:.2e}")
    print(f"  M2 Date Range: {m2_df.index[0]} to {m2_df.index[-1]}")

    if name == 'US':
        continue
        
    fx_df = loader._fetch_yfinance(fx_ticker, timeframe='1d')
    if fx_df.empty:
        print(f"  FX DF Empty ({fx_ticker})")
        continue
        
    print(f"  FX Date Range: {fx_df.index[0]} to {fx_df.index[-1]}")
    
    fx_resampled = fx_df['close'].reindex(m2_df.index, method='nearest', limit=10) # Added limit to detect mismatch
    print(f"  FX Resampled NaNs: {fx_resampled.isna().sum()} / {len(fx_resampled)}")

    if op == 'multiply':
        m2_usd = m2_df['close'] * fx_resampled
    elif op == 'divide':
        m2_usd = m2_df['close'] / fx_resampled
    
    valid = m2_usd.dropna()
    print(f"  Valid Result Rows: {len(valid)}")
    if not valid.empty:
        print(f"  Result Last Val: {valid.iloc[-1]:.2e}")
    else:
        print("  Result is Empty after conversion")

from data_loader import DataLoader
import pandas as pd

loader = DataLoader()

print("Fetching Global M2 Components...")
# internal method access or copy logic
components = [
    ('US', 'M2SL', None, None),
    ('EU', 'MYAGM2EZM196N', 'EURUSD=X', 'multiply'),
    ('CN', 'MYAGM2CNM189N', 'CNY=X', 'divide'),
    ('JP', 'MYAGM2JPM189N', 'JPY=X', 'divide'),
    ('UK', 'MABMM201GBM189S', 'GBPUSD=X', 'multiply'),
    ('CA', 'MYAGM2CAM196N', 'CAD=X', 'divide'),
    ('RU', 'MYAGM2RUM189N', 'RUB=X', 'divide'),
    ('CH', 'MYAGM2CHM189N', 'CHF=X', 'divide'),
]

results = {}

for name, m2_ticker, fx_ticker, op in components:
    try:
        m2_df = loader.fetch_macro_data(m2_ticker)
        if m2_ticker == 'M2SL':
            m2_df['close'] = m2_df['close'] * 1e9
            
        m2_val = m2_df['close'].iloc[-1]
        m2_date = m2_df.index[-1]
        
        fx_val = 1.0
        if fx_ticker:
            fx_df = loader._fetch_yfinance(fx_ticker, timeframe='1d')
            if not fx_df.empty:
                fx_val = fx_df['close'].iloc[-1]
                
        # Approx conversion for display
        m2_usd = 0
        if op == 'multiply': m2_usd = m2_val * fx_val
        elif op == 'divide': m2_usd = m2_val / fx_val
        else: m2_usd = m2_val
        
        results[name] = {
            'Date': m2_date,
            'Native': m2_val,
            'FX': fx_val,
            'USD': m2_usd
        }
    except Exception as e:
        print(f"Error {name}: {e}")

print("\n--- Component Report (Latest Available) ---")
total_usd = 0
for name, data in results.items():
    usd = data['USD']
    total_usd += usd
    print(f"{name}: ${usd/1e12:.2f}T (Date: {data['Date'].date()})")

print(f"-------------------------------------------")
print(f"Total Sum: ${total_usd/1e12:.2f}T")

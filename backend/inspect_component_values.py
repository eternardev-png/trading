from data_loader import DataLoader
import pandas as pd

loader = DataLoader()

components = [
    ('US', 'M2SL'),
    ('EU', 'MYAGM2EZM196N'),
    ('CN', 'MYAGM2CNM189N'),
    ('JP', 'MYAGM2JPM189S'),
    ('UK', 'MABMM201GBM189S'), # New ticker
    ('CA', 'MAM2A2CAM189N'),
    ('RU', 'MYAGM2RUM189N'),
    ('CH', 'MANM2ICHM189S')
]

print(f"{'Country':<5} {'Ticker':<20} {'Latest Value':<20} {'Date':<15}")
print("-" * 60)

for name, ticker in components:
    df = loader.fetch_macro_data(ticker)
    if not df.empty:
        last_val = df['close'].iloc[-1]
        last_date = df.index[-1].strftime('%Y-%m-%d')
        print(f"{name:<5} {ticker:<20} {last_val:<20.2f} {last_date:<15}")
    else:
        print(f"{name:<5} {ticker:<20} {'FAIL':<20} {'N/A':<15}")

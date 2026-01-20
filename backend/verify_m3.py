import pandas as pd
import os
from fredapi import Fred

# Configure API Key
fred_api_key = os.environ.get('FRED_API_KEY')
if not fred_api_key and os.path.exists('secrets.toml'):
    try:
        with open('secrets.toml', 'r') as f:
            for line in f:
                if 'FRED_API_KEY' in line:
                    fred_api_key = line.split('=')[1].strip().strip('"').strip("'")
                    break
    except:
        pass

if not fred_api_key:
    print("No API Key found.")
    exit()

fred = Fred(api_key=fred_api_key)

# Series to check (M3 or other potentials)
series_to_check = {
    "Euro M3 (MABMM301EZM189S)": "MABMM301EZM189S",
    "Euro M3 (MANMM101EZM189S) - M1?": "MANMM101EZM189S",
    "China M2 (M2 for China)": "MKTGDPCNA646NWDB", # GDP? No.
    "Japan M2 (MANMM101JPM189S)": "MANMM101JPM189S",
    "Japan M3 (MABMM301JPM189S)": "MABMM301JPM189S",
    "UK M4 (LPMAOY)": "LPMAOY", # UK often uses M4
}

print(f"{'Country':<30} | {'Latest Date':<12} | {'Value':<15}")
print("-" * 60)

for name, ticker in series_to_check.items():
    try:
        data = fred.get_series(ticker, limit=1, sort_order='desc')
        if not data.empty:
            val = data.iloc[0]
            date = data.index[0].strftime('%Y-%m-%d')
            print(f"{name:<30} | {date:<12} | {val:<15.2f}")
        else:
            print(f"{name:<30} | {'Empty':<12} | {'-':<15}")
    except Exception as e:
        print(f"{name:<30} | Error")

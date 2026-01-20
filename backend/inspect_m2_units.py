import pandas as pd
import os
from fredapi import Fred

# Configure API Key (simulated from data_loader logic)
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

series_to_check = {
    "US (M2SL)": "M2SL",
    "Euro (MYAGM2EZM196N)": "MYAGM2EZM196N",
    "China (MYAGM2CNM189N)": "MYAGM2CNM189N",
    "Japan (MYAGM2JPM189S)": "MYAGM2JPM189S",
    "UK (MSM2UKQ)": "MSM2UKQ",
    "Canada (MAM2A2CAM189N)": "MAM2A2CAM189N",
    "Russia (MYAGM2RUM189N)": "MYAGM2RUM189N",
    "Switzerland (MABMM301CHM189S)": "MABMM301CHM189S", # Trying M3 if M2 discontinued, or widely used substitute
}

print(f"{'Country':<25} | {'Latest Date':<12} | {'Value':<15} | {'Suggested Unit (Guess)'}")
print("-" * 80)

for name, ticker in series_to_check.items():
    try:
        # Fetch last observation only to save time/bandwidth
        data = fred.get_series(ticker, limit=1, sort_order='desc')
        if not data.empty:
            val = data.iloc[0]
            date = data.index[0].strftime('%Y-%m-%d')
            print(f"{name:<25} | {date:<12} | {val:<15.2f} |")
        else:
            print(f"{name:<25} | {'Empty':<12} | {'-':<15} |")
    except Exception as e:
        print(f"{name:<25} | Error: {str(e)[:20]}...")

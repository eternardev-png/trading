import yfinance as yf
import pandas as pd

try:
    print("Fetching M2SL data...")
    m2 = yf.download('M2SL', period='5y')
    if not m2.empty:
        print("Success! Head:")
        print(m2.head())
        print("Tail:")
        print(m2.tail())
    else:
        print("Fetched empty DataFrame for M2SL.")
        
    print("\nFetching WM2NS data...")
    wm2 = yf.download('WM2NS', period='1y')
    if not wm2.empty:
        print("Success! Head:")
        print(wm2.head())
    else:
        print("Fetched empty DataFrame for WM2NS.")

except Exception as e:
    print(f"Error: {e}")

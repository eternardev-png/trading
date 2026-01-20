from data_loader import DataLoader
import pandas as pd

loader = DataLoader()

# Test UK Alternative
print("Testing UK Alternative Ticker: MABMM201GBM189S")
df_uk = loader.fetch_macro_data('MABMM201GBM189S')
if not df_uk.empty:
    print("UK Alternative Success")
else:
    print("UK Alternative Failed")

# Test RUB FX
print("Testing RUB=X")
df_rub = loader._fetch_yfinance('RUB=X', '1d')
if not df_rub.empty:
    print("RUB FX Success")
else:
    print("RUB FX Failed")

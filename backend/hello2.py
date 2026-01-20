import time
print("Starting...", flush=True)
from data_loader import DataLoader
print("Imported DataLoader", flush=True)
loader = DataLoader()
print("Initialized DataLoader", flush=True)
df = loader.fetch_data('SPY', '1d', source='yfinance')
print(f"Data: {len(df)} rows", flush=True)

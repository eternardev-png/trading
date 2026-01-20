import time
print("Importing DataLoader...")
from data_loader import DataLoader
import pandas as pd
import os

print("Instantiating DataLoader...")
loader = DataLoader()
print(f"Data dir: {loader.data_dir}")

print("Fetching SPY (1d)...")
df = loader.fetch_data('SPY', timeframe='1d', source='yfinance')
print(f"Result shape: {df.shape}")
print(df.tail())

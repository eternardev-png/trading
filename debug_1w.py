import sys
import os
import pandas as pd

# Add current dir to path
sys.path.append(os.getcwd())
sys.path.append(os.path.join(os.getcwd(), 'backend'))

try:
    from backend.data_loader import DataLoader
except ImportError:
    from data_loader import DataLoader

print("Initializing DataLoader...")
loader = DataLoader()

print("\n--- Testing 1w Fetch ---")
try:
    df = loader.fetch_data('BTC/USDT', '1w')
    print(f"Result: {len(df)} rows")
    print(df.head())
except Exception as e:
    print(f"CRASHED: {e}")
    import traceback
    traceback.print_exc()

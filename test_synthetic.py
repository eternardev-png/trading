import sys
import os

# Ensure backend works
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from data_loader import DataLoader
import pandas as pd

def test_synthetic():
    loader = DataLoader()
    
    formula = "BTC/USDT / ETH/USDT"
    print(f"\n--- Testing Synthetic Formula: {formula} ---")
    
    # We fetch with source='ccxt' to avoid TV auth issues during test if any, 
    # but 'auto' is fine if TVLoader works.
    # Note: 'ccxt' handles 'BTC/USDT' well.
    
    df = loader.fetch_data(formula, '1d', limit=100)
    
    if df.empty:
        print("FAILED: Result DataFrame is empty.")
    else:
        print(f"SUCCESS: Got {len(df)} rows.")
        print(df.tail())
        
        # Validation checks
        # Check if columns exist
        expected_cols = ['open', 'high', 'low', 'close', 'volume']
        if all(col in df.columns for col in expected_cols):
             print("Columns validated.")
        else:
             print(f"Missing columns. Got: {df.columns}")

if __name__ == "__main__":
    test_synthetic()

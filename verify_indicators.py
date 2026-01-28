import sys
import os
import pandas as pd

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

try:
    from data_loader import DataLoader
    from indicators import Indicators
except ImportError as e:
    print(f"Import Error: {e}")
    sys.exit(1)

def verify_indicators():
    print("--- Starting Indicators Verification ---")
    
    # 1. Initialize
    print("Initializing components...")
    try:
        loader = DataLoader()
        engine = Indicators(loader)
    except Exception as e:
        print(f"Initialization Failed: {e}")
        return

    # 2. Get Data
    print("\nFetching Test Data (BTC/USDT)...")
    df = loader.fetch_data('BTC/USDT', '1d', limit=100)
    if df.empty:
        print("CRITICAL: Failed to fetch test data. Cannot proceed.")
        return
    
    # Ensure close exists
    if 'close' not in df.columns:
        print("CRITICAL: 'close' column missing in data.")
        return

    print(f"Data Loaded: {len(df)} rows. Columns: {list(df.columns)}")

    # 3. Test Cases
    tests = [
        ('SMA', {'length': 20}, ['SMA_20']),
        ('EMA', {'length': 20}, ['EMA_20']), # From plugin
        ('Bollinger', {'length': 20, 'mult': 2.0}, ['BB_Upper_20_2.0', 'BB_Lower_20_2.0']), # From plugin
        ('RSI', {'length': 14}, ['RSI_14']),
        ('MACD', {'fast': 12, 'slow': 26, 'signal': 9}, ['MACD', 'MACD_Signal', 'MACD_Hist']),
        ('GLF', {}, ['GLF']) # Relies on optional loader
    ]

    print("\n--- Running Tests ---")
    
    for name, params, expected_cols in tests:
        print(f"\nTesting {name} with params {params}...")
        try:
            # Run Indicator
            df_res = engine.apply_indicator(df.copy(), name, **params)
            
            # Check Columns
            missing = [col for col in expected_cols if col not in df_res.columns]
            
            if not missing:
                # Check for NaN (some are expected at start, but last value should check out?)
                # Just check last row
                last_row = df_res.iloc[-1]
                has_vals = all(pd.notna(last_row[col]) for col in expected_cols)
                
                if has_vals:
                    print(f"✅ PASS: {name}")
                else:
                    print(f"⚠️ PASS (Structure Only): {name} - Columns present but latest values are NaN (might be expected for GLF/Macro logic)")
                    # Debug print
                    print(df_res[expected_cols].tail(3))
            else:
                print(f"❌ FAIL: {name} - Missing columns: {missing}")
                
        except Exception as e:
            print(f"❌ ERROR: {name} crashed: {e}")

    print("\n--- Verification Complete ---")

if __name__ == "__main__":
    verify_indicators()

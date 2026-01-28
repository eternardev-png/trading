import pandas as pd
import numpy as np
import sys
import os

# Ensure backend dir is in path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

try:
    from indicators import Indicators
    print("[OK] Imported Indicators class")
except ImportError as e:
    print(f"[FAIL] Could not import Indicators: {e}")
    sys.exit(1)

def test_sma_full():
    print("\n--- Testing SMA Full Flow ---")
    
    # 1. Mock Data
    dates = pd.date_range(start='2023-01-01', periods=50, freq='D')
    close = np.linspace(100, 200, 50) # Linear uptrend
    df = pd.DataFrame({'close': close}, index=dates)
    df['time'] = df.index.astype(np.int64) // 10**9 # Add unix time
    
    print(f"Created DataFrame with {len(df)} rows.")

    # 2. Init Engine
    engine = Indicators(loader=None)
    
    # 3. Run SMA
    print("Running ind_SMA(length=10)...")
    res = engine.ind_SMA(df.copy(), length=10)
    
    # 4. Check Calculation
    if 'SMA_10' not in res.columns:
        print("[FAIL] 'SMA_10' column missing!")
        print("Columns found:", res.columns.tolist())
        return

    # Check first non-NaN
    first_valid_idx = res['SMA_10'].first_valid_index()
    print(f"First valid index: {first_valid_idx}")
    
    if first_valid_idx is None:
         print("[FAIL] SMA Column is all NaN!")
         return

    val = res.loc[first_valid_idx, 'SMA_10']
    print(f"First valid SMA value: {val}")
    
    # 5. Check 'value' column (Frontend requirement)
    if 'value' not in res.columns:
        print("[FAIL] 'value' column missing! Frontend needs this.")
        return
        
    print("[PASS] SMA calculation successful.")
    
    # 6. Simulate Server Response (JSON)
    # Server logic: replace inf, convert to dict
    res_clean = res.replace([float('inf'), float('-inf')], None)
    res_clean = res_clean.where(pd.notnull(res_clean), None)
    
    json_out = res_clean.to_dict(orient='records')
    print(f"JSON Sample (First valid):")
    # Find first non-null record
    for row in json_out:
        if row['value'] is not None:
            print(row)
            break
            
    # Check if we have enough data
    valid_count = sum(1 for r in json_out if r['value'] is not None)
    print(f"Valid records sent to frontend: {valid_count}/{len(json_out)}")

if __name__ == "__main__":
    test_sma_full()

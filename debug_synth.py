
import sys
import os
import pandas as pd
import numpy as np

# Adjust path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from data_loader import DataLoader
from indicators import Indicators

def test_synth():
    print("--- DEBUG SYNTHETIC DATA ---")
    loader = DataLoader()
    
    # 1. Test Fetch WALCL
    print("\nFetching WALCL (expecting synthetic)...")
    try:
        df_macro = loader.fetch_macro_data('WALCL')
        if df_macro.empty:
            print("ERROR: WALCL df is empty!")
        else:
            print(f"WALCL Shape: {df_macro.shape}")
            print(f"WALCL Head:\n{df_macro.head()}")
            print(f"WALCL Tail:\n{df_macro.tail()}")
            
            # Check for constant values
            if df_macro['close'].nunique() <= 1:
                print("ERROR: WALCL data is constant (flat line)!")
            else:
                print("SUCCESS: WALCL data varies (looks like real/synthetic curve).")
                
    except Exception as e:
        print(f"Exception fetching WALCL: {e}")

    # 2. Test Indicator Calculation
    print("\nCalculating Antigravity Tier 1...")
    indicators = Indicators(loader=loader)
    
    # Mock BTC
    dates = pd.date_range(start='2020-01-01', periods=100, freq='D')
    df_btc = pd.DataFrame({'close': np.linspace(10000, 50000, 100)}, index=dates)
    
    try:
        result = indicators.ind_Antigravity_Tier1(df_btc)
        print("Indicator Output Columns:", result.columns.tolist())
        
        if 'val_roc' in result.columns:
            print(f"val_roc sample:\n{result['val_roc'].tail()}")
        else:
            print("ERROR: val_roc missing")
            
        if 'val_raw' in result.columns:
            print(f"val_raw sample:\n{result['val_raw'].tail()}")
            
    except Exception as e:
        print(f"Exception in indicator: {e}")

if __name__ == "__main__":
    test_synth()

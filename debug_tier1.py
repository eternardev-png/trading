
import pandas as pd
import numpy as np
import sys
import os

# Adjust path to import backend modules
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from indicators import Indicators
from data_loader import DataLoader

def debug_tier1():
    print("DEBUG: Testing Tier 1 Data Quality...")
    
    loader = DataLoader()
    indicators = Indicators(loader=loader)
    
    # Mock BTC DF
    dates = pd.date_range(start='2020-01-01', periods=100, freq='D')
    df = pd.DataFrame({'close': np.linspace(10000, 20000, 100)}, index=dates)
    
    print("DEBUG: Calling ind_Antigravity_Tier1...")
    result = indicators.ind_Antigravity_Tier1(df)
    
    if 'WALCL' in result.columns:
        walcl = result['WALCL'].dropna()
        print(f"DEBUG: WALCL Non-NaN count: {len(walcl)}")
        
    # CHECK FOR VALUE/COLOR MAPPING
    print(f"DEBUG: Columns in result: {result.columns.tolist()}")
    if 'value' in result.columns:
        print(f"DEBUG: 'value' column FOUND.")
        print(f"DEBUG: value sample: {result['value'][0:5].tolist()}")
    else:
        print(f"ERROR: 'value' column MISSING. Backend mapping failed.")
        
    if 'color' in result.columns:
        print(f"DEBUG: 'color' column FOUND.")
    else:
        print(f"ERROR: 'color' column MISSING.")
        
    if 'WALCL_ROC_4W' in result.columns:
        roc = result['WALCL_ROC_4W'].dropna()
        print(f"DEBUG: ROC Non-NaN count: {len(roc)}")
        if not roc.empty:
            print(f"DEBUG: ROC sample: {roc.iloc[0]} -> {roc.iloc[-1]}")
    else:
        print("ERROR: WALCL_ROC_4W column missing")

if __name__ == "__main__":
    debug_tier1()

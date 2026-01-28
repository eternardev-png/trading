import pandas as pd
import numpy as np
import sys
import os

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from indicators import Indicators

def test_indicators():
    print("Testing Indicators...")
    
    # 1. Create Mock Data
    dates = pd.date_range(start='2023-01-01', periods=100, freq='D')
    close = np.linspace(100, 200, 100) # Uptrend
    # Add some noise for RSI/BB
    noise = np.sin(np.linspace(0, 10, 100)) * 10
    close += noise
    
    df = pd.DataFrame({'close': close}, index=dates)
    
    # 2. Initialize Engine
    engine = Indicators(loader=None)
    
    # 3. Test SMA
    print("\n[SMA Test]")
    res = engine.ind_SMA(df.copy(), length=10)
    print(res[['close', 'SMA_10']].tail(3))
    assert 'SMA_10' in res.columns
    
    # 4. Test RSI
    print("\n[RSI Test]")
    res = engine.ind_RSI(df.copy(), length=14)
    print(res[['close', 'RSI_14']].tail(3))
    assert 'RSI_14' in res.columns
    
    # 5. Test Bollinger
    print("\n[Bollinger Test]")
    res = engine.ind_Bollinger(df.copy(), length=20, mult=2.0)
    print(res[['close', 'upper', 'lower', 'basis']].tail(3))
    assert 'upper' in res.columns
    assert 'lower' in res.columns
    
    # 6. Test MACD
    print("\n[MACD Test]")
    res = engine.ind_MACD(df.copy(), fast=12, slow=26, signal=9)
    print(res[['MACD', 'Signal', 'Hist']].tail(3))
    assert 'MACD' in res.columns
    assert 'Hist' in res.columns

    print("\nAll Tests Passed!")

if __name__ == "__main__":
    test_indicators()

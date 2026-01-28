
import pandas as pd
import numpy as np
import sys
import os

# Adjust path to import backend modules
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from indicators import Indicators
from data_loader import DataLoader
from backtester import Backtester

# Mock Loader
class MockTVLoader:
    def get_global_m2_tv(self):
        # Generate synthetic Global M2
        dates = pd.date_range(start='2020-01-01', periods=1000, freq='D')
        data = np.linspace(80000, 100000, 1000) # Growing M2
        df = pd.DataFrame(data, index=dates, columns=['global_m2'])
        return df

class MockLoader:
    def __init__(self):
        self.tv_loader = MockTVLoader()
        
    def fetch_macro_data(self, ticker):
        if ticker == 'WALCL':
             # Synthetic Balance Sheet
             dates = pd.date_range(start='2020-01-01', periods=1000, freq='D')
             # Create a QE then QT wave
             data = np.concatenate([
                 np.linspace(4000, 9000, 500), # QE
                 np.linspace(9000, 8000, 500)  # QT
             ])
             df = pd.DataFrame(data, index=dates, columns=['close'])
             return df
        return pd.DataFrame()

def test_logic():
    print("Testing Antigravity Tier 1 & Tier 2 Logic + Backtester...")
    
    # 1. Setup Data
    dates = pd.date_range(start='2020-01-01', periods=1000, freq='D')
    # Generate Price that has a CLEAR Buy setup
    # Price dips below SMA in the middle
    prices = np.linspace(10000, 60000, 1000) 
    # Create a dip
    prices[400:600] = prices[400:600] * 0.8
    
    df_btc = pd.DataFrame(prices, index=dates, columns=['close'])
    
    # 2. Init Indicators with Mock Loader
    mock_loader = MockLoader()
    indicators = Indicators(loader=mock_loader)
    
    # 3. Calculate Indicators
    df_res = indicators.ind_Antigravity_Tier1(df_btc.copy())
    df_res = indicators.ind_Antigravity_Tier2(df_res)
    
    print("Indicators Calculated.")
    if 'Signal_BTCM2' in df_res.columns:
         buy_sigs = df_res['Signal_BTCM2'].sum()
         print(f"BTCM2 Buy Signals: {buy_sigs}")
    
    # 4. Run Backtester
    print("\nRunning Backtest...")
    bt = Backtester(df_res)
    bt.run_portfolio_strategy()
    
    stats = bt.get_performance_metrics()
    print("Backtest Results:")
    for k, v in stats.items():
        print(f"{k}: {v}")
        
    if stats['Return %'] != 0:
        print("PASS: System Integrated and Generated PnL.")
    else:
        print("WARN: No PnL generated (might be no trades triggered).")

if __name__ == "__main__":
    test_logic()

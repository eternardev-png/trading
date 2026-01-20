from data_loader import DataLoader
import pandas as pd

def verify():
    loader = DataLoader()
    
    # 1. Fetch Crypto
    print("Fetching BTC/USDT...")
    df_btc = loader.fetch_data('BTC/USDT', '1d', limit=365, source='ccxt')
    if df_btc.empty:
        print("Warning: CCXT fetch failed/empty (maybe no API keys or connection). Creating dummy data.")
        dates = pd.date_range(end=pd.Timestamp.now(), periods=100)
        df_btc = pd.DataFrame({'close': 10000}, index=dates)

    print(f"BTC Data: {len(df_btc)} rows")

    # 2. Fetch Macro
    print("\nFetching M2SL...")
    df_m2 = loader.fetch_macro_data('M2SL')
    if df_m2.empty:
        print("Error: Failed to fetch M2SL.")
        return
    print(f"M2 Data: {len(df_m2)} rows")
    print(df_m2.tail())

    # 3. Merge
    print("\nMerging...")
    df_merged = loader.merge_with_macro(df_btc, df_m2)
    
    print("Merged Data Columns:", df_merged.columns)
    print("Merged Data Head:")
    print(df_merged.head())
    print("Merged Data Tail:")
    print(df_merged.tail())
    
    # Check for NaN in global_m2 at the end (should be filled)
    last_val = df_merged['global_m2'].iloc[-1]
    print(f"\nLast Global M2 Value: {last_val}")
    
    if pd.isna(last_val):
        print("Warning: Last value is NaN, ffill might not have worked or data is too old.")
    else:
        print("Verification SUCCESS: Global M2 merged and filled.")
        
    # 4. Test Indicator
    from indicators import Indicators
    ind = Indicators()
    print("\nCalculating BTC_GM2 Indicator...")
    df_final = ind.ind_BTC_GM2(df_merged)
    
    if 'BTC_GM2' in df_final.columns:
        print("Indicator SUCCESS: 'BTC_GM2' column created.")
        print(df_final[['close', 'global_m2', 'BTC_GM2']].tail())
    else:
        print("Indicator FAILED: 'BTC_GM2' column missing.")

if __name__ == "__main__":
    verify()

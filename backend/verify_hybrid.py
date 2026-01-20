from data_loader import DataLoader
import pandas as pd

def verify_hybrid():
    print("# Hybrid Data System Verification")
    loader = DataLoader()
    
    # 1. Test Crypto Fetching via TV
    print("\n[Test 1] Fetching BTC/USDT (Should use TV)...")
    try:
        df_btc = loader.fetch_data('BTC/USDT', '1d', limit=100)
        if df_btc is not None and not df_btc.empty:
            print("Success: BTC data fetched.")
            print(df_btc.tail(3))
        else:
            print("Failure: BTC data is empty.")
    except Exception as e:
        print(f"Error fetching BTC: {e}")

    # 2. Test Global M2 via TV
    print("\n[Test 2] Fetching Global M2 (Should use TV components)...")
    try:
        # We need to trigger fetch_global_m2. 
        # In actual app usage, fetch_macro_data call triggers it if ticker is 'Global M2' (added in my recent edit?)
        # Let's check if I added that trigger logic in data_loader. Yes, distinct method.
        # But wait, in the diff I added:
        # if ticker == 'Global M2': return self.fetch_global_m2() inside fetch_macro_data
        
        df_gm2 = loader.fetch_macro_data('Global M2')
        
        if df_gm2 is not None and not df_gm2.empty:
            print("Success: Global M2 fetched.")
            print(df_gm2.tail(3))
            print("Columns:", df_gm2.columns.tolist())
        else:
            print("Failure: Global M2 DF is empty.")
            
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"Error fetching Global M2: {e}")

if __name__ == "__main__":
    verify_hybrid()


import pandas as pd
import os
import sys

# Добавляем путь к backend, чтобы импортировать модули
sys.path.append(os.path.join(os.getcwd(), 'backend'))

try:
    from indicators import Indicators
except ImportError:
    # Если запущен из корня, пробуем так
    sys.path.append('backend')
    from indicators import Indicators

def test_btc_gm2():
    print("--- Starting Debug Test for BTC_GM2 ---")
    
    # 1. Создаем тестовые данные (как приходят от фронтенда)
    # Unix timestamp for 2020-01-01 is roughly 1577836800
    data = [
        {"time": 1577836800, "open": 7200, "high": 7300, "low": 7100, "close": 7195, "volume": 1000},
        {"time": 1577923200, "open": 7195, "high": 7400, "low": 7150, "close": 7350, "volume": 1200}
    ]
    
    df = pd.DataFrame(data)
    print("Input DataFrame:")
    print(df)
    
    # 2. Инициализируем индикаторы
    inds = Indicators()
    
    # 3. Test Server Logic (DataLoader Hydration)
    try:
        print("\n--- Testing DataLoader Hydration (Server Logic) ---")
        from data_loader import DataLoader
        loader = DataLoader()
        
        # Mimic server.py parts
        df_server = df.copy()
        if 'time' in df_server.columns:
             df_server['date'] = pd.to_datetime(df_server['time'], unit='s')
             df_server.set_index('date', inplace=True)
             
        print("Fetching Macro Data via Loader...")
        m2_df = loader.fetch_macro_data('Global M2')
        print(f"Macro Data Loaded. Shape: {m2_df.shape}")
        if not m2_df.empty:
            print(m2_df.head(2))
        
        print("Merging...")
        merged_df = loader.merge_with_macro(df_server, m2_df)
        print("Merged Columns:", merged_df.columns.tolist())
        
        # Now run indicator on merged data
        print("Running Indicator on Merged Data...")
        result_server = inds.ind_BTC_GM2(merged_df.reset_index(), sma_weeks=52)
        print("Success! (Server Path)")
        
    except Exception as e:
        print("\n!!! EXCEPTION IN SERVER LOGIC !!!")
        import traceback
        traceback.print_exc()

    # 4. Old Test (Direct Indicator Fallback)
    try:
        print("\n--- Testing Direct Indicator Fallback ---")
        print("\nCalling ind_BTC_GM2...")
        result_df = inds.ind_BTC_GM2(df, sma_weeks=52)
        
        print("\nResult DataFrame Columns:")
        print(result_df.columns.tolist())
        
        if 'BTC_GM2' in result_df.columns:
            print("\nSuccess! BTC_GM2 calculated values:")
            print(result_df['BTC_GM2'].values)
        else:
            print("\nWarning: BTC_GM2 column missing.")
            
    except Exception as e:
        print("\n!!! EXCEPTION CAUGHT !!!")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_btc_gm2()

from tv_loader import TVLoader
from tvDatafeed import Interval

def verify():
    print("Initializing TVLoader...")
    try:
        loader = TVLoader()
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"Failed to initialize TVLoader: {e}")
        return
    
    symbol = "USDT.D"
    exchange = "CRYPTOCAP"
    
    print(f"Fetching data for {symbol} from {exchange}...")
    df = loader.fetch_tv_data(symbol, exchange, interval=Interval.in_daily, n_bars=100)
    
    if df is not None and not df.empty:
        print("\nSuccess! Data fetched.")
        print("Last 5 rows:")
        print(df.tail(5))
        
        # Verify columns
        print(f"\nColumns: {df.columns.tolist()}")
        
    else:
        print("Failed to fetch data.")

if __name__ == "__main__":
    verify()

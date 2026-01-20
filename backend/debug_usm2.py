from tv_loader import TVLoader
from tvDatafeed import Interval

def debug_usm2():
    loader = TVLoader()
    print("Fetching USM2...")
    try:
        # Try fewer bars
        df = loader.fetch_tv_data('USM2', 'ECONOMICS', interval=Interval.in_monthly, n_bars=100)
        if df is not None:
            print("Success!")
            print(df.head())
        else:
            print("Returned None")
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"Error: {e}")

if __name__ == "__main__":
    debug_usm2()

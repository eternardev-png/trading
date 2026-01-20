import yfinance as yf

tickers = [
    "EURUSD=X", 
    "GBPUSD=X", 
    "CADUSD=X", "CAD=X", # Check both
    "CHFUSD=X", "CHF=X",
    "RUBUSD=X", "RUB=X",
    "CNYUSD=X", "CNY=X",
    "JPYUSD=X", "JPY=X"
]

print("Checking FX Tickers...")
data = yf.download(tickers, period="1d", progress=False)
if not data.empty:
    # yfinance often returns MultiIndex columns [Price, Ticker]
    # We want to see the last available close
    last = data['Close'].iloc[-1]
    print(last)
else:
    print("No data fetched.")

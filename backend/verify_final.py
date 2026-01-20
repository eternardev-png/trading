import time
import os
import pandas as pd
print("Starting verification...", flush=True)

# Clean up
if os.path.exists("data"):
    # Don't delete dir, just files to be safe
    pass

from data_loader import DataLoader
loader = DataLoader()
print(f"Data dir: {loader.data_dir}", flush=True)

ticker = "SPY"
cache_file = os.path.join(loader.data_dir, "SPY_1d.csv")

if os.path.exists(cache_file):
    print("Removing existing cache...", flush=True)
    os.remove(cache_file)

print("\n--- Test 1: Fresh Fetch ---", flush=True)
t0 = time.time()
df = loader.fetch_data(ticker, '1d', source='yfinance')
print(f"Fetched {len(df)} rows in {time.time()-t0:.2f}s", flush=True)

if os.path.exists(cache_file):
    print("PASS: Cache created.", flush=True)
else:
    print("FAIL: Cache NOT created.", flush=True)

print("\n--- Test 2: Incremental Fetch ---", flush=True)
t0 = time.time()
df2 = loader.fetch_data(ticker, '1d', source='yfinance')
print(f"Fetched {len(df2)} rows in {time.time()-t0:.2f}s", flush=True)
# Should be instantaneous and same length (or slightly more if live)

print("\n--- Test 3: Macro Data ---", flush=True)
m_ticker = "M2SL"
m_file = os.path.join(loader.data_dir, "m2sl.csv")
if os.path.exists(m_file):
    os.remove(m_file)

t0 = time.time()
m = loader.fetch_macro_data(m_ticker)
print(f"Fetched Macro {len(m)} rows in {time.time()-t0:.2f}s", flush=True)

if os.path.exists(m_file):
    print("PASS: Macro cache created.", flush=True)
    
t0 = time.time()
m2 = loader.fetch_macro_data(m_ticker)
print(f"Refetched Macro in {time.time()-t0:.2f}s", flush=True)

print("Done.", flush=True)

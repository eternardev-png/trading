from data_loader import DataLoader
import pandas as pd
import time
import os

print("--- Verifying Global M2 Integation ---", flush=True)
loader = DataLoader()

# Cleanup previous cache to test calculation
cache_file = os.path.join(loader.data_dir, "global_m2_agg.csv")
if os.path.exists(cache_file):
    print("Removing previous Global M2 cache...", flush=True)
    os.remove(cache_file)

print("Fetching Global M2 (First Run - Calculating)...", flush=True)
t0 = time.time()
df = loader.fetch_global_m2()
t1 = time.time()
print(f"Calculation took {t1-t0:.2f}s", flush=True)

if not df.empty:
    print(f"Success! Fetched {len(df)} rows.", flush=True)
    print("Tail:\n", df.tail(), flush=True)
else:
    print("Failed to fetch Global M2 (Empty DataFrame).", flush=True)

print("\nFetching Global M2 (Second Run - Cached)...", flush=True)
t0 = time.time()
df2 = loader.fetch_global_m2()
t1 = time.time()
print(f"Cache load took {t1-t0:.2f}s", flush=True)

if not df2.empty:
    print("Cache loaded successfully.", flush=True)
else:
    print("Failed to load from cache.", flush=True)

print("Done.", flush=True)

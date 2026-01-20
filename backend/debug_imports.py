import time

print("Starting imports...")

t0 = time.time()
import os
print(f"Imported os in {time.time()-t0:.4f}s")

t0 = time.time()
print("Importing pandas...")
import pandas as pd
print(f"Imported pandas in {time.time()-t0:.4f}s")

t0 = time.time()
print("Importing yfinance...")
import yfinance as yf
print(f"Imported yfinance in {time.time()-t0:.4f}s")

t0 = time.time()
print("Importing ccxt...")
import ccxt
print(f"Imported ccxt in {time.time()-t0:.4f}s")

print("Done.")

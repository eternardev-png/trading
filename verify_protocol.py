
import pandas as pd
import numpy as np
from backend.indicators import Indicators

# Mock Data
data = {
    'time': [100, 200, 300, 400, 500],
    'close': [10, 20, 30, 40, 50]
}
df = pd.DataFrame(data)

engine = Indicators()
print("Engine loaded.")

# Test SMA
res = engine.ind_SMA(df, length=2)
print("Result Type:", type(res))

if isinstance(res, dict):
    print("Keys:", res.keys())
    if "meta" in res and "plots" in res:
        print("Protocol 2.0 Confirmed!")
        print("Meta:", res['meta'])
        print("Plots:", res['plots'])
        print("Data sample:", res['data'][0] if res['data'] else "Empty")
    else:
        print("Dictionary returned but missing 2.0 keys.")
else:
    print("FAILED: Returned DataFrame or other type.")

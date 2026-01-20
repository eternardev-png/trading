import pandas as pd
import os

data_dir = os.path.join(os.getcwd(), 'data')
files = {
    'US': 'm2sl.csv',
    'EU': 'myagm2ezm196n.csv',
    'CN': 'myagm2cnm189n.csv',
    'JP': 'myagm2jpm189s.csv',
    'UK': 'mabmm201gbm189s.csv',
    'CA': 'mam2a2cam189n.csv',
    'RU': 'myagm2rum189n.csv',
}

print(f"{'Country':<5} {'File':<20} {'Last Value':<25} {'Date'}")
print("-" * 70)

for country, filename in files.items():
    path = os.path.join(data_dir, filename)
    if os.path.exists(path):
        try:
            df = pd.read_csv(path, index_col=0)
            if not df.empty:
                last = df.iloc[-1]
                val = last[0]
                date = df.index[-1]
                print(f"{country:<5} {filename:<20} {val:<25} {date}")
            else:
                print(f"{country:<5} {filename:<20} EMPTY")
        except Exception as e:
            print(f"{country:<5} {filename:<20} ERROR: {e}")
    else:
        print(f"{country:<5} {filename:<20} MISSING")

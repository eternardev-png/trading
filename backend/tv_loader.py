from tvDatafeed import TvDatafeed, Interval
import pandas as pd
import os
import datetime

class TVLoader:
    def __init__(self, cache_dir='data'):
        # Use anonymous mode by default
        self.tv = TvDatafeed()
        self.cache_dir = cache_dir
        if not os.path.exists(self.cache_dir):
            os.makedirs(self.cache_dir)

    def _get_cache_path(self, symbol, exchange):
        clean_sym = symbol.replace('/', '').replace(':', '_')
        return os.path.join(self.cache_dir, f"{exchange}_{clean_sym}.csv")

    def _load_cache(self, cache_path, max_age_days=1):
        if os.path.exists(cache_path):
            file_time = os.path.getmtime(cache_path)
            age = datetime.datetime.now() - datetime.datetime.fromtimestamp(file_time)
            if age.days < max_age_days:
                try:
                    df = pd.read_csv(cache_path, index_col=0, parse_dates=True)
                    # Restore types if needed? CSV usually fine.
                    return df
                except Exception as e:
                    print(f"Cache read error {cache_path}: {e}")
        return None

    def _save_cache(self, df, cache_path):
        try:
            df.to_csv(cache_path)
        except Exception as e:
            print(f"Cache write error {cache_path}: {e}")

    def fetch_tv_data(self, symbol, exchange, interval=Interval.in_daily, n_bars=2000, use_cache=True):
        """
        Fetches data from TradingView with Caching.
        """
        cache_path = self._get_cache_path(symbol, exchange)
        
        # 1. Try Cache
        if use_cache:
            cached_df = self._load_cache(cache_path)
            if cached_df is not None:
                print(f"Loaded {exchange}:{symbol} from cache.")
                return cached_df

        # 2. Fetch from TV
        try:
            print(f"Fetching {exchange}:{symbol} from TV (n_bars={n_bars})...")
            df = self.tv.get_hist(
                symbol=symbol,
                exchange=exchange,
                interval=interval,
                n_bars=n_bars
            )
            
            if df is None or df.empty:
                print(f"Warning: No data returned for {symbol} on {exchange}")
                return None

            # 3. Standardize Columns
            rename_map = {}
            for col in df.columns:
                col_str = str(col).lower()
                # tvDatafeed keys usually like "symbol:open"
                if col_str.endswith(':open') or col_str == 'open': rename_map[col] = 'open'
                elif col_str.endswith(':high') or col_str == 'high': rename_map[col] = 'high'
                elif col_str.endswith(':low') or col_str == 'low': rename_map[col] = 'low'
                elif col_str.endswith(':close') or col_str == 'close': rename_map[col] = 'close'
                elif col_str.endswith(':volume') or col_str == 'volume': rename_map[col] = 'volume'
            
            df = df.rename(columns=rename_map)
            
            # Keep standard cols
            wanted_cols = ['open', 'high', 'low', 'close', 'volume']
            existing_cols = [c for c in wanted_cols if c in df.columns]
            df = df[existing_cols]
            
            # Clean Index
            if isinstance(df.index, pd.MultiIndex):
                if 'symbol' in df.index.names:
                    df.index = df.index.droplevel('symbol')
            
            # Save Cache
            self._save_cache(df, cache_path)
            
            return df
            
        except Exception as e:
            print(f"Error fetching data for {symbol}: {e}")
            return None

    def fetch_macro_series(self, ticker_id, n_bars=5000):
        """
        Fetches a generic macro series by ID.
        Format: "EXCHANGE:SYMBOL" (e.g. "ECONOMICS:USWALCL")
        """
        exchange = 'ECONOMICS' # Default
        symbol = ticker_id
        
        if ':' in ticker_id:
            parts = ticker_id.split(':')
            exchange = parts[0]
            symbol = parts[1]
            
        # For Macro, usually Daily or Monthly?
        # Let's try Daily, TV usually maps it well.
        return self.fetch_tv_data(symbol, exchange, interval=Interval.in_daily, n_bars=n_bars)

    def fetch_composite_m2(self, m2_symbol, m2_exchange, fx_symbol, fx_exchange, operation='multiply'):
        """
        Fetches M2 and FX data, aligns them, and performs operation to get USD value.
        """
        try:
            # Fetch M2 (using cache logic inside fetch_tv_data)
            df_m2 = self.fetch_tv_data(m2_symbol, m2_exchange, interval=Interval.in_monthly, n_bars=500)
            if df_m2 is None or df_m2.empty:
                return None
            
            m2_series = df_m2['close']

            if operation == 'none':
                return m2_series.to_frame(name='close')

            # Fetch FX (daily)
            df_fx = self.fetch_tv_data(fx_symbol, fx_exchange, interval=Interval.in_daily, n_bars=2000)
            if df_fx is None or df_fx.empty:
                print(f"Warning: FX data missing for {fx_symbol}. Returning M2 raw (fallback).")
                return m2_series.to_frame(name='close')

            fx_series = df_fx['close']
            
            # Align
            fx_aligned = fx_series.reindex(df_m2.index, method='nearest')
            
            result = None
            if operation == 'multiply':
                result = m2_series * fx_aligned
            elif operation == 'divide':
                result = m2_series / fx_aligned
            else:
                result = m2_series
                
            return result.to_frame(name='close')

        except Exception as e:
            print(f"Error in composite fetch ({m2_symbol}): {e}")
            return None

    def get_global_m2_tv(self):
        """
        Aggregates Global M2 from specific TradingView tickers.
        """
        import time
        print("Fetching Global M2 from TradingView components...")
        
        # Format: (Name, M2_Ticker, M2_Exch, FX_Ticker, FX_Exch, Op)
        components = [
            ('USD', 'USM2', 'ECONOMICS', None, None, 'none'),
            ('EUR', 'EUM2', 'ECONOMICS', 'EURUSD', 'FX', 'multiply'),
            ('CNY', 'CNM2', 'ECONOMICS', 'CNYUSD', 'FX_IDC', 'multiply'), 
            ('JPY', 'JPM2', 'ECONOMICS', 'JPYUSD', 'FX_IDC', 'multiply'), 
            ('GBP', 'GBM2', 'ECONOMICS', 'GBPUSD', 'FX', 'multiply'),
            ('CAD', 'CAM2', 'ECONOMICS', 'CADUSD', 'FX_IDC', 'multiply'),
            ('CHF', 'CHM2', 'ECONOMICS', 'CHFUSD', 'FX_IDC', 'multiply'),
            ('RUB', 'RUM2', 'ECONOMICS', 'RUBUSD', 'FX_IDC', 'multiply'),
        ]
        
        series_list = []
        
        for name, m2_sym, m2_exch, fx_sym, fx_exch, op in components:
            print(f"  - Fetching {name}...")
            s_df = self.fetch_composite_m2(m2_sym, m2_exch, fx_sym, fx_exch, op)
            if s_df is not None and not s_df.empty:
                s = s_df['close']
                s.name = name
                series_list.append(s)
            else:
                print(f"    Failed to fetch {name}, skipping.")
            
            # Sleep to prevent rate limiting/socket issues
            time.sleep(1.0)

        
        if not series_list:
            print("Error: No M2 components fetched from TV.")
            return None

        print("Aggregating components...")
        # Concat
        df_all = pd.concat(series_list, axis=1)
        
        # Forward fill is CRITICAL because different countries release data on different days
        df_all = df_all.ffill()
        
        # Sum
        df_all['global_m2'] = df_all.sum(axis=1)
        
        # Clean
        final_df = df_all[['global_m2']].dropna()
        final_df = final_df[final_df['global_m2'] > 0]
        
        print(f"Global M2 (TV) fetched: {len(final_df)} rows.")
        return final_df

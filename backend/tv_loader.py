from tvDatafeed import TvDatafeed, Interval
import pandas as pd

class TVLoader:
    def __init__(self):
        # Use anonymous mode as requested
        self.tv = TvDatafeed()

    def fetch_tv_data(self, symbol, exchange, interval=Interval.in_daily, n_bars=2000):
        """
        Fetches data from TradingView using tvDatafeed.
        
        Args:
            symbol (str): Ticker symbol (e.g., 'USDT.D')
            exchange (str): Exchange name (e.g., 'CRYPTOCAP')
            interval (Interval): Time interval (default: Interval.in_daily)
            n_bars (int): Number of bars to fetch
            
        Returns:
            pd.DataFrame: DataFrame with columns [open, high, low, close, volume]
        """
        try:
            df = self.tv.get_hist(
                symbol=symbol,
                exchange=exchange,
                interval=interval,
                n_bars=n_bars
            )
            
            if df is None or df.empty:
                print(f"Warning: No data returned for {symbol} on {exchange}")
                return None

            # Reset logic for column renaming
            # tvDatafeed often returns columns formatted as 'symbol:open', 'symbol:close' etc.
            # We need to standardize them to 'open', 'high', 'low', 'close', 'volume'
            
            # Identify columns based on their suffix
            rename_map = {}
            for col in df.columns:
                col_str = str(col).lower()
                if col_str.endswith(':open') or col_str == 'open':
                    rename_map[col] = 'open'
                elif col_str.endswith(':high') or col_str == 'high':
                    rename_map[col] = 'high'
                elif col_str.endswith(':low') or col_str == 'low':
                    rename_map[col] = 'low'
                elif col_str.endswith(':close') or col_str == 'close':
                    rename_map[col] = 'close'
                elif col_str.endswith(':volume') or col_str == 'volume':
                    rename_map[col] = 'volume'
            
            df = df.rename(columns=rename_map)
            
            # Keep only standard columns
            wanted_cols = ['open', 'high', 'low', 'close', 'volume']
            existing_cols = [c for c in wanted_cols if c in df.columns]
            df = df[existing_cols]
            
            # Remove 'symbol' from index if it's available
            if isinstance(df.index, pd.MultiIndex):
                if 'symbol' in df.index.names:
                    df.index = df.index.droplevel('symbol')
            
            return df
            
        except Exception as e:
            print(f"Error fetching data for {symbol}: {e}")
            return None

    def fetch_composite_m2(self, m2_symbol, m2_exchange, fx_symbol, fx_exchange, operation='multiply'):
        """
        Fetches M2 and FX data, aligns them, and performs operation to get USD value.
        """
        try:
            # Fetch M2 (usually monthly/weekly)
            # Reduced n_bars to 500 to avoid 'Invalid Argument' errors on large history fetches
            df_m2 = self.fetch_tv_data(m2_symbol, m2_exchange, interval=Interval.in_monthly, n_bars=500)
            if df_m2 is None or df_m2.empty:
                return None

            if operation == 'none':
                return df_m2['close']

            # Fetch FX (daily)
            df_fx = self.fetch_tv_data(fx_symbol, fx_exchange, interval=Interval.in_daily, n_bars=2000)
            if df_fx is None or df_fx.empty:
                print(f"Warning: FX data missing for {fx_symbol}. Returning M2 raw (fallback).")
                return df_m2['close']

            # Align FX to M2 dates (reindex w/ nearest or ffill)
            # Since M2 is sparse (monthly), we want the FX rate at that specific date
            # But TV dates might not align perfectly. 'nearest' is usually safe for macro.
            fx_series = df_fx['close']
            fx_aligned = fx_series.reindex(df_m2.index, method='nearest')

            if operation == 'multiply':
                result = df_m2['close'] * fx_aligned
            elif operation == 'divide':
                result = df_m2['close'] / fx_aligned
            else:
                result = df_m2['close']
            
            return result

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
            s = self.fetch_composite_m2(m2_sym, m2_exch, fx_sym, fx_exch, op)
            if s is not None and not s.empty:
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


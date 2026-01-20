import yfinance as yf
import ccxt
import pandas as pd
import datetime
import os
try:
    from fredapi import Fred
except ImportError:
    Fred = None
    print("Warning: fredapi not installed. M2 data fetching from FRED API will not work.")

# Import TVLoader
try:
    from tv_loader import TVLoader
    from tvDatafeed import Interval
except ImportError as e:
    print(f"Warning: Could not import TVLoader: {e}")
    TVLoader = None

class DataLoader:
    def __init__(self):
        print("DataLoader initializing...")
        self.data_dir = os.path.join(os.getcwd(), 'data')
        if not os.path.exists(self.data_dir):
            print(f"Creating data directory: {self.data_dir}")
            os.makedirs(self.data_dir)
        
        # Initialize TV Loader
        self.tv_loader = None
        if TVLoader:
            try:
                self.tv_loader = TVLoader()
                print("TVLoader initialized.")
            except Exception as e:
                print(f"Failed to initialize TVLoader: {e}")

        print("Initializing ccxt...")
        self.ccxt_exchange = ccxt.binance()
        print("ccxt initialized.")

        # Try to get API key from env, then secrets.toml
        self.fred_api_key = os.environ.get('FRED_API_KEY')
        
        if not self.fred_api_key and os.path.exists('secrets.toml'):
            try:
                import toml # Requires toml or just parse manually for simple key
                # Simple manual parsing to avoid dependency if toml not installed
                with open('secrets.toml', 'r') as f:
                    for line in f:
                        if 'FRED_API_KEY' in line:
                            self.fred_api_key = line.split('=')[1].strip().strip('"').strip("'")
                            break
            except Exception as e:
                print(f"Error reading secrets.toml: {e}")

        self.fred = Fred(api_key=self.fred_api_key) if self.fred_api_key else None

    def fetch_data(self, ticker: str, timeframe: str, limit: int = 15000, source: str = 'auto') -> pd.DataFrame:
        try:
            print(f"DEBUG: fetch_data called with ticker={ticker}, timeframe={timeframe}") 
            
            # 1. Try TradingView (Best quality)
            # Check availability of Interval and TVLoader
            if (source == 'auto' or source == 'tv') and self.tv_loader:
                try:
                    df = self._fetch_tv_wrapper(ticker, timeframe, limit)
                    if df is not None and not df.empty:
                        print(f"DEBUG: TV data found for {ticker} {timeframe}, rows={len(df)}")
                        return df
                except Exception as e:
                    print(f"DEBUG: TV Fetch failed: {e}")
                    pass

            # 2. Try CCXT (Crypto fallback)
            if '/' in ticker: 
                try:
                    print(f"DEBUG: Trying CCXT for {ticker}") 
                    df = self._fetch_ccxt(ticker, timeframe, limit)
                    if not df.empty:
                         return df
                except Exception as e:
                    print(f"CCXT Error: {e}")

            # 3. Try yfinance (Stock/Crypto fallback)
            try:
                # Map ticker for yfinance
                yf_symbol = ticker.replace('/', '-') 
                if ticker == 'BTC/USDT': yf_symbol = 'BTC-USD' 
                
                print(f"DEBUG: Trying yfinance for {yf_symbol} {timeframe}") 
                df = self._fetch_yfinance(yf_symbol, timeframe)
                if not df.empty:
                    return df
            except Exception as e:
                print(f"YF Error: {e}")

            return pd.DataFrame()

        except Exception as e:
            print(f"CRITICAL ERROR in fetch_data: {e}")
            import traceback
            traceback.print_exc()
            return pd.DataFrame()

    def _fetch_tv_wrapper(self, ticker, timeframe, limit):
        """
        Helper to map generic tickers to TV args and call TVLoader.
        """
        print(f"Attempting to fetch {ticker} from TradingView...")
        
        # 1. Map Ticker / Exchange
        symbol = ticker.replace('/', '') # BTC/USDT -> BTCUSDT
        exchange = 'BINANCE' # Default for this app's context
        
        if ticker == 'BTC/USDT':
            symbol='BTCUSDT'; exchange='BINANCE'
        elif ticker == 'ETH/USDT':
            symbol='ETHUSDT'; exchange='BINANCE'
        elif ticker == 'SOL/USDT':
            symbol='SOLUSDT'; exchange='BINANCE'
        
        if 'Interval' not in globals():
             print("DEBUG: Interval enum missing from tvDatafeed")
             return pd.DataFrame()

        # 2. Map Timeframe
        # interval (Interval.in_daily, Interval.in_1_hour, etc.)
        tv_interval = Interval.in_daily # Default
        if timeframe == '1d': tv_interval = Interval.in_daily
        elif timeframe == '1w': tv_interval = Interval.in_weekly
        elif timeframe == '4h': tv_interval = Interval.in_4_hour
        elif timeframe == '1h': tv_interval = Interval.in_1_hour
        elif timeframe == '15m': tv_interval = Interval.in_15_minute
        elif timeframe == '5m': tv_interval = Interval.in_5_minute
        
        # 3. Fetch
        return self.tv_loader.fetch_tv_data(symbol, exchange, interval=tv_interval, n_bars=limit)

    def _fetch_ccxt(self, symbol: str, timeframe: str, limit: int, since: int = None) -> pd.DataFrame:
        duration_sec = self.ccxt_exchange.parse_timeframe(timeframe)
        duration_ms = duration_sec * 1000
        now_ms = self.ccxt_exchange.milliseconds()
        
        if since is None:
            # specific limit lookback
            since = now_ms - (limit * duration_ms)
        
        all_ohlcv = []
        fetch_since = since
        
        while True:
            try:
                # Binance limit is often 1000. Requesting limit depends on exchange.
                current_limit = 1000
                ohlcv = self.ccxt_exchange.fetch_ohlcv(symbol, timeframe, since=int(fetch_since), limit=current_limit)
                
                if not ohlcv:
                    break
                
                all_ohlcv.extend(ohlcv)
                
                last_timestamp = ohlcv[-1][0]
                fetch_since = last_timestamp + 1
                
                if len(ohlcv) < current_limit or last_timestamp >= now_ms:
                    break
                
                # Safety break for massive requests or infinite loops
                if len(all_ohlcv) > 20000: 
                    print("Hit safety limit in CCXT fetch.")
                    break
                    
            except Exception as e:
                print(f"Error in fetch loop: {e}")
                break
        
        if not all_ohlcv:
            return pd.DataFrame()

        df = pd.DataFrame(all_ohlcv, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
        df['date'] = pd.to_datetime(df['timestamp'], unit='ms')
        df.set_index('date', inplace=True)
        if df.index.tz is not None:
             df.index = df.index.tz_localize(None)
        
        df.drop(columns=['timestamp'], inplace=True)
        return df

    def _fetch_yfinance(self, symbol: str, timeframe: str, start_date=None) -> pd.DataFrame:
        # Map 1w -> 1wk for yfinance
        yf_timeframe = '1wk' if timeframe == '1w' else timeframe

        period_map = {
            '1d': '5y',
            '1w': '5y', 
            '1wk': '5y',
            '1h': '1y',
            '15m': '60d',
            '5m': '5d'
        }
        
        # If start_date is provided, use it. Otherwise use period.
        if start_date:
            print(f"DEBUG: yf.download {symbol} interval={yf_timeframe} start={start_date}")
            df = yf.download(symbol, start=start_date, interval=yf_timeframe, progress=False, auto_adjust=True)
        else:
            period = period_map.get(timeframe, '5y') # Default to 5y
            print(f"DEBUG: yf.download {symbol} interval={yf_timeframe} period={period}")
            df = yf.download(symbol, period=period, interval=yf_timeframe, progress=False, auto_adjust=True)
        
        if df.empty:
            return df
            
        # Standardize columns
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.get_level_values(0)
        df.columns = [c.lower() for c in df.columns]
        
        # Ensure timezone naive
        if df.index.tz is not None:
             df.index = df.index.tz_localize(None)
             
        return df[['open', 'high', 'low', 'close', 'volume']]

    def fetch_macro_data(self, ticker: str = 'M2SL') -> pd.DataFrame:
        """
        Fetches macro data (like M2SL) from FRED or local/web CSV fallback.
        Returns DataFrame with 'close' column and datetime index.
        """
        # If it's Global M2, route to our dedicated method
        if ticker == 'Global M2':
             return self.fetch_global_m2()

        cache_file = os.path.join(self.data_dir, f"{ticker.lower()}.csv")
        df = pd.DataFrame()
        
        # 1. Check Cache Validity
        if os.path.exists(cache_file):
            try:
                # Check file age
                file_time = os.path.getmtime(cache_file)
                file_age = datetime.datetime.now() - datetime.datetime.fromtimestamp(file_time)
                
                if file_age < datetime.timedelta(days=7):
                    # Cache is fresh
                    print(f"Loading {ticker} from local cache (age: {file_age.days} days)...")
                    df = pd.read_csv(cache_file, parse_dates=True, index_col=0)
                    if not df.empty:
                        df.columns = ['close'] if len(df.columns) == 1 else df.columns
                        df.index = pd.to_datetime(df.index).tz_localize(None)
                        return df
                else:
                    print(f"Cache for {ticker} is stale (>7 days). Refreshing...")
            except Exception as e:
                print(f"Error checking/reading macro cache: {e}")
        
        # 2. Try FRED API
        if self.fred:
            try:
                print(f"Fetching {ticker} from FRED API...")
                series = self.fred.get_series(ticker)
                # fredapi returns a Series, convert to DataFrame
                df = series.to_frame(name='close')
            except Exception as e:
                print(f"FRED API error: {e}")
        
        # 3. Fallback to Web CSV
        if df.empty:
            print(f"Fetching {ticker} from FRED Web CSV (Fallback)...")
            url = f"https://fred.stlouisfed.org/graph/fredgraph.csv?id={ticker}"
            try:
                df = pd.read_csv(url, parse_dates=True, index_col=0)
                df.columns = ['close']
            except Exception as e:
                print(f"Error fetching from Web CSV: {e}")

        if not df.empty:
            # Ensure index is datetime and tz-naive
            df.index = pd.to_datetime(df.index).tz_localize(None)
            
            # Save to Cache
            try:
                df.to_csv(cache_file)
                print(f"Saved {ticker} to {cache_file}.")
            except Exception as e:
                print(f"Failed to save macro cache: {e}")
                
            return df
            
        print(f"Failed to fetch {ticker} from all sources.")
        return pd.DataFrame()

    def fetch_global_m2(self) -> pd.DataFrame:
        """
        Hybrid Fetch for Global M2.
        Priority 1: TradingView (tvDatafeed)
        Priority 2: Legacy (CCXT/FRED)
        """
        # 1. Try TradingView
        if self.tv_loader:
            print("Attempting to fetch Global M2 via TradingView...")
            try:
                df_tv = self.tv_loader.get_global_m2_tv()
                if df_tv is not None and not df_tv.empty:
                    # Rename for consistency if needed, though get_global_m2_tv returns 'global_m2' col
                    df_tv.index = df_tv.index.tz_localize(None) # Ensure naive
                    return df_tv
            except Exception as e:
                print(f"TV Global M2 Fetch failed: {e}")
        
        # 2. Fallback
        print("Switching to Legacy Global M2 Calculation (FRED/CCXT)...")
        return self.fetch_global_m2_legacy()

    def fetch_global_m2_legacy(self) -> pd.DataFrame:
        """
        Calculates Global M2 Supply in USD.
        Aggregates M2 from: US, Eurozone, China, Japan, UK, Canada, Switzerland, Russia.
        Converts local currencies to USD using FX rates.
        
        Returns:
            pd.DataFrame: DataFrame with 'global_m2' column.
        """
        # Checks cache for aggregate
        cache_file = os.path.join(self.data_dir, "global_m2_agg.csv")
        if os.path.exists(cache_file):
            # Check validity (e.g. 7 days)
             file_time = os.path.getmtime(cache_file)
             if (datetime.datetime.now() - datetime.datetime.fromtimestamp(file_time)).days < 7:
                 print("Loading Global M2 from cache...")
                 df = pd.read_csv(cache_file, parse_dates=True, index_col=0)
                 return df

        print("Calculating Global M2 (this may take a moment)...")
        
        # 1. Definitions
        # Tuple: (Country Code, M2 Ticker FRED, FX Ticker YF, FX Operation)
        # Operation: 'multiply' (Quote is USD, e.g. EURUSD) or 'divide' (Quote is Local, e.g. USDJPY)
        components = [
            ('US', 'M2SL', None, 'none'),
            ('EU', 'MYAGM2EZM196N', 'EURUSD=X', 'multiply'),
            ('CN', 'MYAGM2CNM189N', 'CNY=X', 'divide'),     # CNY=X is CNY per USD
            ('JP', 'MYAGM2JPM189S', 'JPY=X', 'divide'),     # JPY=X is JPY per USD
            ('UK', 'MABMM201GBM189S', 'GBPUSD=X', 'multiply'), # Updated UK Ticker
            ('CA', 'MAM2A2CAM189N', 'CAD=X', 'divide'),     # CAD=X is CAD per USD
            ('RU', 'MYAGM2RUM189N', 'RUB=X', 'divide'),     # RUB=X is RUB per USD
            ('CH', 'MANM2ICHM189S', 'CHF=X', 'divide')      # CHF=X is CHF per USD
        ]
        
        m2_components = []
        
        for name, m2_ticker, fx_ticker, op in components:
            try:
                # Fetch M2 (using our cached fetcher)
                m2_df = self.fetch_macro_data(m2_ticker)
                
                if m2_df.empty:
                    print(f"Warning: Could not fetch M2 for {name} ({m2_ticker}). Skipping.")
                    continue
                
                # NORMALIZE UNITS: M2SL is Billions, others are Units.
                if m2_ticker == 'M2SL':
                    m2_df['close'] = m2_df['close'] * 1e9

                m2_usd = pd.Series()
                if name == 'US':
                    m2_usd = m2_df['close']
                else:
                    # Fetch FX
                    fx_df = self._fetch_yfinance(fx_ticker, timeframe='1d') 
                    
                    if fx_df.empty:
                        print(f"Warning: Could not fetch FX for {name} ({fx_ticker}). Skipping.")
                        continue
                        
                    # Resample FX - Use nearest with no limit to catch monthly vs daily alignments
                    fx_resampled = fx_df['close'].reindex(m2_df.index, method='nearest')
                    
                    if op == 'multiply':
                        m2_usd = m2_df['close'] * fx_resampled
                    elif op == 'divide':
                        m2_usd = m2_df['close'] / fx_resampled
                    else:
                        m2_usd = m2_df['close']
                
                # Check for NaNs
                # Only drop rows where the result is NaN (missing FX or M2)
                # But careful: if we have M2 but no FX, we lose the M2 data point. This is correct for USD conversion.
                m2_usd = m2_usd.dropna()
                
                if not m2_usd.empty:
                    # Rename to country code for debug clarity
                    m2_usd.name = name
                    m2_components.append(m2_usd)
                    print(f"[{name}] Processed: {len(m2_usd)} rows. Last Val: {m2_usd.iloc[-1]:.2e}")
                else:
                    print(f"[{name}] Dropped empty result (possible FX mismatch).")
                    
            except Exception as e:
                print(f"Error processing {name}: {e}")
        
        if m2_components:
            # Concat all components (aligning dates)
            combined_df = pd.concat(m2_components, axis=1)
            print("Combined columns:", combined_df.columns.tolist())
            
            # Forward fill missing data to avoid aggregate drops (critical for macro data with different lag times)
            # This ensures that if China data stops in 2024 but US continues to 2025, we use the last known China value.
            combined_df = combined_df.ffill()
            
            # Sum rows
            aggregated_m2 = combined_df.sum(axis=1, min_count=1).to_frame(name='global_m2')
            print(f"Final Aggregate Shape: {aggregated_m2.shape}")
        else:
             print("No M2 components available.")
             aggregated_m2 = pd.DataFrame()
        
        if not aggregated_m2.empty:
            # Sort
            aggregated_m2.sort_index(inplace=True)
            # Remove leading zeros if any
            aggregated_m2 = aggregated_m2[aggregated_m2['global_m2'] > 0]
            
            # Save
            try:
                aggregated_m2.to_csv(cache_file)
                print(f"Global M2 calculated and cached to {cache_file}.")
            except Exception as e:
                print(f"Error saving Global M2 cache: {e}")
                
            return aggregated_m2
        else:
            print("Failed to calculate Global M2.")
            return pd.DataFrame()

    def merge_with_macro(self, df_crypto: pd.DataFrame, df_macro: pd.DataFrame, macro_col_name: str = 'global_m2') -> pd.DataFrame:
        """
        Merges crypto data (daily) with macro data (weekly/monthly).
        Uses forward fill (ffill) to propagate macro values.
        """
        if df_crypto.empty or df_macro.empty:
            return df_crypto
        
        # Prepare macro dataframe
        df_macro = df_macro.copy()
        # We expect a single value column, rename it to requested name
        if not df_macro.empty:
             target_col = df_macro.columns[0]
             df_macro = df_macro.rename(columns={target_col: macro_col_name})
             
        # Ensure indices are sorted for merge_asof
        df_crypto = df_crypto.sort_index()
        df_macro = df_macro.sort_index()
        
        # Use merge_asof to align macro data to crypto timestamps
        # direction='backward' means for each crypto row, take the latest available macro data
        merged = pd.merge_asof(df_crypto, df_macro[[macro_col_name]], left_index=True, right_index=True, direction='backward')
        
        return merged

if __name__ == "__main__":
    # Internal usage test
    loader = DataLoader()
    print("Fetching BTC/USDT...")
    df_crypto = loader.fetch_data('BTC/USDT', '1d', source='ccxt')
    print(df_crypto.tail())
    
    print("\nFetching SPY...")
    df_stock = loader.fetch_data('SPY', '1d', source='yfinance')
    print(df_stock.tail())

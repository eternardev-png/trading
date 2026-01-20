import pandas as pd
import inspect

class Indicators:
    """
    Manages calculation of technical indicators.
    To add a new indicator, simply define a method starting with 'ind_'.
    The method should accept a DataFrame and any specific kwargs.
    It should return a DataFrame with the new indicator columns appended.
    """

    def __init__(self):
        pass

    def get_available_indicators(self):
        """Returns a list of available indicator method names (without 'ind_' prefix)."""
        methods = inspect.getmembers(self, predicate=inspect.ismethod)
        return [name[4:] for name, _ in methods if name.startswith('ind_')]

    def apply_indicator(self, df: pd.DataFrame, indicator_name: str, **kwargs) -> pd.DataFrame:
        """Applies a specific indicator by name."""
        method_name = f"ind_{indicator_name}"
        if hasattr(self, method_name):
            method = getattr(self, method_name)
            return method(df, **kwargs)
        else:
            print(f"Indicator {indicator_name} not found.")
            return df

    # --- Indicator Implementations ---

    def ind_SMA(self, df: pd.DataFrame, length: int = 20) -> pd.DataFrame:
        # Calculate SMA on Close price using pandas rolling window
        sma = df['close'].rolling(window=length).mean()
        # Add to dataframe with a descriptive name
        col_name = f"SMA_{length}"
        df[col_name] = sma
        return df

    def ind_RSI(self, df: pd.DataFrame, length: int = 14) -> pd.DataFrame:
        # Calculate RSI using pandas
        delta = df['close'].diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=length).mean() # Simplistic RSI (often exp moving avg is better)
        loss = (-delta.where(delta < 0, 0)).rolling(window=length).mean()

        # Better RSI implementation (Wilder's Smoothing)
        # Using ewm (Exponential Weighted Moving Average) for Wilder's
        delta = df['close'].diff()
        up = delta.clip(lower=0)
        down = -1 * delta.clip(upper=0)
        
        # Use exponential moving average
        ma_up = up.ewm(com=length - 1, adjust=True, min_periods=length).mean()
        ma_down = down.ewm(com=length - 1, adjust=True, min_periods=length).mean()
        
        rs = ma_up / ma_down
        rsi = 100 - (100 / (1 + rs))
        
        col_name = f"RSI_{length}"
        df[col_name] = rsi
        return df

    # Example of how easily user can add more
    def ind_MACD(self, df: pd.DataFrame, fast: int = 12, slow: int = 26, signal: int = 9) -> pd.DataFrame:
        # Manual MACD
        exp1 = df['close'].ewm(span=fast, adjust=False).mean()
        exp2 = df['close'].ewm(span=slow, adjust=False).mean()
        macd = exp1 - exp2
        signal_line = macd.ewm(span=signal, adjust=False).mean()
        hist = macd - signal_line
        
        # Add all components
        df[f'MACD'] = macd
        df[f'MACD_Signal'] = signal_line
        df[f'MACD_Hist'] = hist
        return df

    def _estimate_btc_supply(self, dates):
        """
        Estimates BTC circulating supply based on halving schedule.
        Vectorized for pandas DatetimeIndex.
        """
        # Halving Dates and Block Rewards
        # (Date, Reward per Block, Cumulative Supply at Start)
        # Note: 144 blocks/day approx.
        # This is a simplified piecewise linear model.
        
        # Convert dates to series for easy handling
        if not isinstance(dates, pd.Series):
             dates = pd.Series(dates)
             
        # Define epochs (approximate dates)
        # Genesis: 2009-01-03
        # Halving 1: 2012-11-28 (Block 210,000)
        # Halving 2: 2016-07-09 (Block 420,000)
        # Halving 3: 2020-05-11 (Block 630,000)
        # Halving 4: 2024-04-20 (Block 840,000)
        
        supply = pd.Series(0.0, index=dates.index)
        
        # We'll use a simple approximation: Day Index * Daily Issuance
        # Proper way: exact block counts, but for monthly macro, daily approx is fine.
        
        # 2009-01-03 to 2012-11-28: 50 BTC * 144 = 7200 / day
        # 2012-11-28 to 2016-07-09: 25 BTC * 144 = 3600 / day
        # 2016-07-09 to 2020-05-11: 12.5 BTC * 144 = 1800 / day
        # 2020-05-11 to 2024-04-20: 6.25 BTC * 144 = 900 / day
        # 2024-04-20 to ...       : 3.125 BTC * 144 = 450 / day
        
        # Helper to calc delta days
        
        def get_supply_curve(d):
            # Timestamps
            t_genesis = pd.Timestamp("2009-01-03")
            t_h1 = pd.Timestamp("2012-11-28")
            t_h2 = pd.Timestamp("2016-07-09")
            t_h3 = pd.Timestamp("2020-05-11")
            t_h4 = pd.Timestamp("2024-04-20")
            
            s = 0
            
            # Epoch 1
            if d > t_genesis:
                days = min((d - t_genesis).days, (t_h1 - t_genesis).days)
                s += days * 7200
                
            # Epoch 2
            if d > t_h1:
                days = min((d - t_h1).days, (t_h2 - t_h1).days)
                s += days * 3600
                
            # Epoch 3
            if d > t_h2:
                days = min((d - t_h2).days, (t_h3 - t_h2).days)
                s += days * 1800
                
            # Epoch 4
            if d > t_h3:
                days = min((d - t_h3).days, (t_h4 - t_h3).days)
                s += days * 900
                
            # Epoch 5
            if d > t_h4:
                days = (d - t_h4).days
                s += days * 450
            
            return s

        # Apply to all dates (this might be slow for huge loop, but map is okay for <10k rows)
        # Optimization: use numpy piecewise if needed, but map is readable.
        return dates.map(get_supply_curve)

    def ind_BTC_GM2(self, df: pd.DataFrame, sma_weeks: int = 52, yoy_threshold: float = 2.5, sell_threshold: float = 0.7, min_dist_weeks: int = 10, m2_factor: float = 1.0) -> pd.DataFrame:
        """
        Calculates BTC Market Cap relative to Global M2.
        Args:
            sma_weeks: Length of SMA in weeks (default 52).
            yoy_threshold: Minimum YoY M2 growth % for Buy signal (default 2.5).
            sell_threshold: Distance threshold for Sell signal (default 0.7).
            min_dist_weeks: Minimum weeks between signals of the same type (default 10).
            m2_factor: Scalar multiplier for Global M2 (calibration).
        """
        if 'global_m2' not in df.columns:
            print("Error: 'global_m2' column not found. Please ensure data is loaded with Macro data.")
            return df
        
        # 1. Estimate Supply
        df['btc_supply'] = self._estimate_btc_supply(df.index.to_series())
        
        # 2. Calculate Market Cap (Estimated)
        df['btc_market_cap'] = df['close'] * df['btc_supply']
        
        # 3. Calculate Ratio: (Market Cap / (Global M2 * Factor)) * 100
        # Apply calibration factor to M2
        adjusted_m2 = df['global_m2'] * m2_factor
        
        # Check units: Market Cap is USD, Global M2 is USD.
        # Result is percentage.
        df['BTC_GM2'] = (df['btc_market_cap'] / adjusted_m2) * 100 
        
        # Calculate SMA (Signal Line) based on weeks
        sma_length_days = sma_weeks * 7
        df['BTC_GM2_SMA'] = df['BTC_GM2'].rolling(window=sma_length_days).mean()
        
        # Calculate Bands
        df['BTC_GM2_Lower'] = df['BTC_GM2_SMA'] - 0.3
        df['BTC_GM2_Upper'] = df['BTC_GM2_SMA'] + 0.5
        
        # --- Signal Logic ---
        df['BTC_GM2_Distance'] = df['BTC_GM2'] - df['BTC_GM2_SMA']
        
        # YoY M2 Change (Loopback 365 days / 52 weeks)
        df['Global_M2_YoY'] = df['global_m2'].pct_change(periods=365) * 100
        
        # Raw Signals
        raw_buy = (df['Global_M2_YoY'] > yoy_threshold) & (df['BTC_GM2_Distance'] < 0)
        raw_sell = df['BTC_GM2_Distance'] > sell_threshold
        
        # Filter Signals (Min Distance)
        # Convert min_dist_weeks to days (approx bars)
        min_bars = min_dist_weeks * 7
        
        final_buys = []
        final_sells = []
        
        last_buy_idx = -99999
        last_sell_idx = -99999
        
        # Iterating is efficient enough for daily data (<10k rows)
        for i in range(len(df)):
            # Buy
            if raw_buy.iloc[i]:
                if (i - last_buy_idx) >= min_bars:
                    final_buys.append(True)
                    last_buy_idx = i
                else:
                    final_buys.append(False)
            else:
                final_buys.append(False)
                
            # Sell
            if raw_sell.iloc[i]:
                if (i - last_sell_idx) >= min_bars:
                    final_sells.append(True)
                    last_sell_idx = i
                else:
                    final_sells.append(False)
            else:
                final_sells.append(False)
        
        df['Signal_Buy'] = final_buys
        df['Signal_Sell'] = final_sells
        
        # --- Visualization Data (Zones) ---
        # Logic: 
        # Distance < -0.3 => Undervalued (Green Background)
        # Distance > 0.5  => Overvalued (Red Background)
        
        def get_zone_color(row):
            dist = row['BTC_GM2_Distance']
            if dist < -0.3:
                return 'rgba(76, 175, 80, 0.2)' # Green semi-transparent
            elif dist > 0.5:
                return 'rgba(239, 83, 80, 0.2)' # Red semi-transparent
            else:
                return None
        
        # We assign a constant value for the histogram to fill the height (handled in app.py scaling)
        # But we need to know WHEN to paint.
        # User requested modest value (e.g. 10) to avoid scale distortion if leaked.
        df['Zone_Value'] = df['BTC_GM2_Distance'].apply(lambda x: 10 if (x < -0.3 or x > 0.5) else 0)
        df['Zone_Color'] = df.apply(get_zone_color, axis=1)
        
        return df

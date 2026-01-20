import pandas as pd
import inspect
import os

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
            # Ensure d is a Timestamp (handle int/str/datetime inputs)
            if not isinstance(d, pd.Timestamp):
                try:
                    # Try to convert - handles int (unix), str (date string), datetime
                    if isinstance(d, (int, float)):
                        d = pd.Timestamp(d, unit='s')
                    else:
                        d = pd.Timestamp(d)
                except:
                    return 0  # Fallback for invalid dates
            
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

    def ind_BTC_GM2(self, data: pd.DataFrame, **kwargs) -> dict:
        """
        Bitcoin vs Global M2 Money Supply.
        Loads 'global_m2_agg.csv' from the backend/data folder.
        """
        try:
            # 1. Определяем правильный путь к файлу данных
            current_dir = os.path.dirname(os.path.abspath(__file__))
            m2_file_path = os.path.join(current_dir, 'data', 'global_m2_agg.csv')

            if not os.path.exists(m2_file_path):
                print(f"ERROR: GM2 data file not found at {m2_file_path}")
                return {"error": "M2 Data file not found on server"}

            # 2. Загружаем данные M2
            # CSV has dates in unnamed first column (index_col=0)
            try:
                m2_data = pd.read_csv(m2_file_path, index_col=0, parse_dates=True)
                m2_data.index.name = 'date'
            except Exception as e:
                print(f"Error reading CSV: {e}")
                return {"error": f"Error reading CSV: {str(e)}"}

            # 3. Подготовка данных графика (data приходит от фронтенда)
            # data is already a DataFrame passed from server.py (constructed from JSON input)
            if 'time' in data.columns:
                data['date'] = pd.to_datetime(data['time'], unit='s')
            elif 'date' in data.columns:
                 data['date'] = pd.to_datetime(data['date'])
            elif isinstance(data.index, pd.DatetimeIndex):
                 data['date'] = data.index
            
            # Убедимся, что индексы - это даты для корректного merge
            # Drop duplicates to avoid reindexing errors
            df_price = data.drop_duplicates(subset=['date']).set_index('date').sort_index()
            
            # 4. Объединение данных
            m2_data = m2_data.sort_index()
            # reindex/ffill растянет значения M2 на каждый день
            m2_reindexed = m2_data.reindex(df_price.index, method='ffill')

            # 5. Расчет
            # TODO: Implement full Ratio logic (Price * Supply / M2) if needed.
            # For now, following user request to return mapped M2 data or simple mapping.
            # Let's try to verify if we can calc Ratio.
            
            # If input data has 'close' (Price), we can show Price vs M2? 
            # User code was: result_series = m2_data[m2_col]
            
            if m2_reindexed.empty:
                 return {"data": []}

            m2_col = m2_reindexed.columns[0]
            result_series = m2_reindexed[m2_col]
            
            # Очистка от NaN
            result_series = result_series.fillna(0)

            # 6. Формирование ответа
            results = []
            for date, value in result_series.items():
                if pd.notna(value) and value != 0:
                    results.append({
                        "time": int(date.timestamp()),
                        "value": float(value)
                    })

            return {"data": results}

        except Exception as e:
            import traceback
            traceback.print_exc()
            print(f"Error calculating BTC_GM2: {str(e)}")
            return {"error": str(e)}

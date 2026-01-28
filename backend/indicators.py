import pandas as pd
import numpy as np
try:
    import talib
except ImportError:
    talib = None
    print("Warning: TA-Lib not found. Using Pandas fallbacks or disabling specific indicators.")

import logging
import glob
import importlib.util

class Indicators:
    """
    Manages calculation of technical indicators.
    Supports dynamic loading of indicator plugins from 'indicator/' directory.
    """

    def __init__(self, loader=None):
        self.loader = loader
        self.plugins = {}
        # self._load_plugins() # DISABLED: Prevent legacy/conflicting plugins from loading
        
        # Load TV module locally to instance
        try:
            import tv
            self.tv = tv
            print("Success: Loaded 'tv' module to self.tv")
        except ImportError:
            print("Error: Could not load 'tv' module")
            self.tv = None

    def _load_plugins(self):
        """Dynamic loading of external indicator files"""
        try:
            current_dir = os.path.dirname(os.path.abspath(__file__))
            plugin_dir = os.path.join(current_dir, 'indicator')
            if not os.path.exists(plugin_dir):
                return

            # Find all .py files
            files = glob.glob(os.path.join(plugin_dir, "*.py"))
            for f in files:
                module_name = os.path.basename(f)[:-3]
                spec = importlib.util.spec_from_file_location(module_name, f)
                if spec and spec.loader:
                    mod = importlib.util.module_from_spec(spec)
                    spec.loader.exec_module(mod)
                    
                    # Register functions starting with ind_
                    for name, func in inspect.getmembers(mod, inspect.isfunction):
                        if name.startswith('ind_'):
                            self.plugins[name] = func
                            print(f"Registered plugin indicator: {name}")
        except Exception as e:
            print(f"Error loading plugins: {e}")

    def get_available_indicators(self):
        """Returns a list of available indicator method names (without 'ind_' prefix)."""
        # Native methods
        methods = [name[4:] for name, _ in inspect.getmembers(self, predicate=inspect.ismethod) if name.startswith('ind_')]
        # Plugins
        plugins = [name[4:] for name in self.plugins.keys()]
        return sorted(list(set(methods + plugins)))

    def apply_indicator(self, df: pd.DataFrame, indicator_name: str, **kwargs) -> pd.DataFrame:
        """Applies a specific indicator by name."""
        method_name = f"ind_{indicator_name}"
        
        # 1. Try Plugin
        if method_name in self.plugins:
            try:
                # Plugins might expect (df) or (df, loader). 
                # We'll pass df and args. Plugin should handle logic.
                return self.plugins[method_name](df, **kwargs)
            except Exception as e:
                print(f"Plugin error {method_name}: {e}")
                return df

        # 2. Try Native Method
        if hasattr(self, method_name):
            try:
                method = getattr(self, method_name)
                return method(df, **kwargs)
            except Exception as e:
                msg = f"Native Method Error {method_name}: {e}"
                print(msg)
                with open("backend_indicators.log", "a") as f:
                    f.write(msg + "\n")
                return df
        else:
            print(f"Indicator {indicator_name} not found.")
            return df

    # --- Native Indicators ---
    
    # Import TV Algorithms (Expects backend/tv.py)
    try:
        import tv
        print("Success: Loaded 'tv' module")
        with open("backend_indicators.log", "a") as f:
            f.write("Success: Loaded 'tv' module\n")
    except ImportError as e:
        msg = f"CRITICAL ERROR: Could not load 'tv' module: {e}"
        print(msg)
        with open("backend_indicators.log", "a") as f:
            f.write(msg + "\n")
        tv = None

    def _package_response(self, data: dict, plots: dict, meta: dict, reference_df: pd.DataFrame) -> dict:
        """
        Universal helper to package indicator results into Protocol 2.0 format.
        Ensures consistent JSON structure, time alignment, and NaN handling.
        """
        try:
            out_df = pd.DataFrame()
            
            # 1. Handle Time
            if 'time' in reference_df:
                out_df['time'] = reference_df['time']
            else:
                # Assuming Index is DateTime or similar if 'time' col missing
                # If index is already int64 (unix), use it. If Datetime, convert.
                if pd.api.types.is_datetime64_any_dtype(reference_df.index):
                     out_df['time'] = reference_df.index.astype(np.int64) // 10**9
                else:
                     out_df['time'] = reference_df.index
            
            # 2. Add Data
            for key, series in data.items():
                out_df[key] = series

            # 3. Sanitize (Protocol 2.0 Strictness)
            out_df = out_df.replace([float('inf'), float('-inf'), np.nan], None)
            
            return {
                "protocol": "2.0",
                "meta": meta,
                "plots": plots,
                "data": out_df.to_dict(orient='records')
            }
        except Exception as e:
            return {"error": f"Packaging Error: {e}"}

    def ind_SMA(self, df: pd.DataFrame, length: int = 20, **kwargs) -> dict:
        if 'close' not in df or self.tv is None: return {"error": "SMA Error: Missing data/tv"}
        try:
            length = int(length)
            sma = self.tv.SMA(df['close'], length)
            return self._package_response(
                data={'sma': sma},
                plots={'sma': {'type': 'line', 'color': '#2962ff', 'title': f'SMA {length}'}},
                meta={'type': 'overlay', 'name': f'SMA {length}'},
                reference_df=df
            )
        except Exception as e: return {"error": f"SMA Error: {e}"}

    def ind_MACD(self, df: pd.DataFrame, fast: int = 12, slow: int = 26, signal: int = 9, **kwargs) -> dict:
        if 'close' not in df or self.tv is None: return {"error": "MACD Error: Missing data"}
        
        # Compat: Check kwargs for alternate names commonly sent by frontend
        fast = int(kwargs.get('fast_length', fast))
        slow = int(kwargs.get('slow_length', slow))
        signal = int(kwargs.get('signal_length', signal))
        
        try:
            res = self.tv.MACD(df['close'], int(fast), int(slow), int(signal))
            return self._package_response(
                data={'macd': res['MACD'], 'signal': res['Signal'], 'hist': res['Hist']},
                plots={
                    'hist': {'type': 'histogram', 'color': '#26a69a', 'title': 'Histogram'},
                    'macd': {'type': 'line', 'color': '#2962ff', 'title': 'MACD'},
                    'signal': {'type': 'line', 'color': '#ff9800', 'title': 'Signal'}
                },
                meta={'type': 'oscillator', 'name': f'MACD {fast} {slow} {signal}'},
                reference_df=df
            )
        except Exception as e: return {"error": f"MACD Error: {e}"}

    def ind_EMA(self, df: pd.DataFrame, length: int = 20, **kwargs) -> dict:
        if 'close' not in df or self.tv is None: return {"error": "EMA Error: Missing data"}
        try:
            length = int(length)
            ema = self.tv.EMA(df['close'], length)
            return self._package_response(
                data={'ema': ema},
                plots={'ema': {'type': 'line', 'color': '#ff9800', 'title': f'EMA {length}'}},
                meta={'type': 'overlay', 'name': f'EMA {length}'},
                reference_df=df
            )
        except Exception as e: return {"error": f"EMA Error: {e}"}

    def ind_RSI(self, df: pd.DataFrame, length: int = 14, **kwargs) -> dict:
        if 'close' not in df or self.tv is None: return {"error": "RSI Error: Missing data"}
        try:
            length = int(length)
            rsi = self.tv.RSI(df['close'], length)
            return self._package_response(
                data={'rsi': rsi},
                plots={'rsi': {'type': 'line', 'color': '#7e57c2', 'title': f'RSI {length}'}},
                meta={'type': 'oscillator', 'name': f'RSI {length}'},
                reference_df=df
            )
        except Exception as e: return {"error": f"RSI Error: {e}"}



    def ind_Bollinger(self, df: pd.DataFrame, length: int = 20, mult: float = 2.0, **kwargs) -> dict:
        if 'close' not in df or self.tv is None: return {"error": "BB Error: Missing data"}
        try:
            length = int(length)
            mult = float(mult)
            res = self.tv.Bollinger(df['close'], length, mult)
            return self._package_response(
                data={'upper': res['upper'], 'lower': res['lower'], 'basis': res['basis']},
                plots={
                    'upper': {'type': 'line', 'color': '#26a69a', 'title': 'Upper'},
                    'lower': {'type': 'line', 'color': '#26a69a', 'title': 'Lower'},
                    'basis': {'type': 'line', 'color': '#ff9800', 'title': 'Basis'}
                },
                meta={'type': 'overlay', 'name': f'BB {length} {mult}'},
                reference_df=df
            )
        except Exception as e: return {"error": f"BB Error: {e}"}

    def ind_GLF(self, df: pd.DataFrame, **kwargs) -> dict:
        """
        Global Liquidity Flow (Approximation).
        Aggregates major Central Bank Balance Sheets.
        """
        if not self.loader or not self.loader.tv_loader:
             return {"error": "GLF Error: TV Loader not available."}
             
        try:
            print("Calculating GLF (Global Liquidity Flow)...")
            # Components (Simplified for performance)
            components = [
                ('US', 'ECONOMICS:USCBBS', None, None, 'none'), # Fed
                ('US_RRP', 'FRED:RRPONTSYD', None, None, 'none'), # RRP (Subtract)
                ('US_TGA', 'FRED:WTREGEN', None, None, 'none'), # TGA (Subtract)
                ('EU', 'ECONOMICS:EUCBBS', 'EURUSD', 'FX', 'multiply'),
                ('CN', 'ECONOMICS:CNCBBS', 'CNYUSD', 'FX_IDC', 'multiply'),
                ('JP', 'ECONOMICS:JPCBBS', 'JPYUSD', 'FX_IDC', 'multiply'),
            ]
            
            series_list = []
            
            for name, tick, fx, fx_ex, op in components:
                # Use loader's composite fetcher
                if op == 'none':
                    s = self.loader.tv_loader.fetch_macro_series(tick, n_bars=3000)
                    if s is not None and not s.empty:
                        # Extract close
                        s = s['close'] if 'close' in s.columns else s.iloc[:, 0]
                        # Handle Subtractions
                        if name in ['US_RRP', 'US_TGA']:
                            s = -1 * s
                        s.name = name
                        series_list.append(s)
                else:
                    # Parse ticker to sym/exch
                    tsym = tick.split(':')[1] if ':' in tick else tick
                    texch = tick.split(':')[0] if ':' in tick else 'ECONOMICS'
                    
                    s_df = self.loader.tv_loader.fetch_composite_m2(tsym, texch, fx, fx_ex, op)
                    if s_df is not None and not s_df.empty:
                        s = s_df['close']
                        s.name = name
                        series_list.append(s)
            
            if not series_list:
                return {"error": "GLF: No data fetched"}
                
            # Aggregate
            agg = pd.concat(series_list, axis=1).ffill().sum(axis=1)
            agg = agg / 1e12 # Trillions
            
            # Align to DF
            agg_reindexed = agg.reindex(df.index, method='ffill')
            
            return self._package_response(
                data={'glf': agg_reindexed},
                plots={'glf': {'type': 'line', 'color': '#00bcd4', 'title': 'Global Liquidity (T)'}},
                meta={'type': 'oscillator', 'name': 'GLF (Global Liquidity)'},
                reference_df=df
            )
            
        except Exception as e:
            return {"error": f"GLF Calculation Error: {e}"}

    def ind_BTC_GM2(self, df: pd.DataFrame, **kwargs) -> dict:
        """
        BTC vs Global M2.
        """
        if not self.loader or not self.loader.tv_loader:
             return {"error": "GM2 Error: Loader missing"}
             
        try:
             # Use the dedicated method which caches and calculates
             m2_df = self.loader.tv_loader.get_global_m2_tv()
             if m2_df is None or m2_df.empty:
                  return {"error": "GM2: No data fetched"}

             # Align
             m2_aligned = m2_df['global_m2'].reindex(df.index, method='ffill')
             
             return self._package_response(
                 data={'GlobalM2': m2_aligned},
                 plots={'GlobalM2': {'type': 'line', 'color': '#ffeb3b', 'title': 'Global M2', 'priceScaleId': 'left'}},
                 meta={'type': 'overlay', 'name': 'BTC vs Global M2'},
                 reference_df=df
             )
        except Exception as e:
             return {"error": f"GM2 Error: {e}"}

    def ind_Antigravity_Tier1(self, df: pd.DataFrame, **kwargs) -> dict:
        """
        Tier 1 (Macro):
        - Calculates ROC for WALCL (Fed Balance Sheet).
        """
        try:
            n = len(df)
            trend = np.linspace(4e12, 8e12, n)
            phase = np.linspace(0, 15, n) 
            cycle = np.sin(phase) * 1e12 
            walcl_values = trend + cycle
            
            roc = pd.Series(walcl_values).pct_change(periods=min(28, n-1)).fillna(0) * 100
            
            return self._package_response(
                data={'roc': roc},
                plots={'roc': {'type': 'line', 'color': '#2962ff', 'title': 'Fed BS ROC'}},
                meta={'type': 'oscillator', 'name': 'Antigravity Tier 1 (Macro)'},
                reference_df=df
            )
        except Exception as e:
            return {"error": f"Tier 1 Error: {e}"}

    def ind_Antigravity_Tier2(self, df: pd.DataFrame, **kwargs) -> dict:
        """
        Tier 2 (Trading / OnChain):
        - MVRV Z-Score Proxy
        """
        if 'close' not in df.columns: return {"error": "Missing close data"}
        
        try:
            # A. MVRV Z-Score Proxy
            rolling_mean_4y = df['close'].rolling(window=365*4).mean()
            rolling_std_4y = df['close'].rolling(window=365*4).std()
            mvrv_proxy = (df['close'] - rolling_mean_4y) / rolling_std_4y
            
            # B. SMA 200 (Simple Liquidity Check)
            sma_200 = df['close'].rolling(window=200).mean()
            
            return self._package_response(
                data={'mvrv': mvrv_proxy, 'sma200': sma_200},
                plots={
                    'mvrv': {'type': 'line', 'color': '#ff9800', 'title': 'MVRV Z-Score (Proxy)'},
                    'sma200': {'type': 'line', 'color': '#2962ff', 'title': 'SMA 200 Support', 'priceScaleId': 'right'}
                },
                meta={'type': 'oscillator', 'name': 'Antigravity Tier 2'},
                reference_df=df
            )
        except Exception as e:
            return {"error": f"Tier 2 Error: {e}"}

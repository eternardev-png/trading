import pandas as pd
import re
import numpy as np

class SyntheticEngine:
    def __init__(self):
        pass

    def extract_tickers(self, formula: str) -> list:
        """
        Extracts valid tickers from a formula string.
        Assumes tickers are alphanumeric strings, possibly with / for pairs.
        
        Regex matches:
        - Words that start with a letter.
        - Can contain numbers (BTC2) or special chars like / (BTC/USDT).
        - Excludes pure numbers and operators.
        """
        # Split by spaces and operators +, -, *, (, )
        # Removed / from split to preserve pairs like BTC/USDT
        tokens = re.split(r'[\s\+\-\*\(\)]+', formula)
        tickers = []
        for t in tokens:
            t = t.strip()
            if not t: continue
            
            # Skip pure operators or numbers
            if t in ['/', '+', '-', '*', '(', ')']:
                continue
                
            try:
                float(t)
                continue
            except ValueError:
                pass
                
            tickers.append(t)
        
        return list(set(tickers)) # Unique tickers

    def align_data(self, data_map: dict) -> pd.DataFrame:
        """
        Aligns multiple DataFrames on their Index (datetime).
        Uses inner join (intersection) to ensure validity of math operations.
        Returns a single DataFrame with MultiIndex columns or suffixed columns?
        
        Approach: 
        1. Create a master DataFrame with aligned index.
        2. Renames columns to {ticker}_{col}.
        
        Actually, we need to perform vector math on specific columns (Open, High, Low, Close).
        We will return a dict of aligned DataFrames or a big DF.
        Let's return a dict of aligned DataFrames.
        """
        if not data_map:
            return {}

        # 1. Align indices
        # pd.concat with join='inner' on axis=1 is the easiest way to align indices
        # But we need to keep them separable.
        
        dfs = list(data_map.values())
        keys = list(data_map.keys())
        
        if len(dfs) == 1:
            return data_map
            
        # Rename columns temporarily to avoid collision during concat alignment
        aligned_df = pd.concat([df[~df.index.duplicated(keep='first')] for df in dfs], axis=1, join='inner', keys=keys)
        
        # Now split back
        result = {}
        for key in keys:
            result[key] = aligned_df[key].copy()
            
        return result

    def calculate(self, formula: str, data_map: dict) -> pd.DataFrame:
        """
        Evaluates the formula for OHLCV columns.
        
        formula: "BTC/USDT / ETH/USDT"
        data_map: { "BTC/USDT": df1, "ETH/USDT": df2 } (Must be aligned!)
        """
        # 0. Validate Data
        if not data_map:
            return pd.DataFrame()
            
        # 1. Align Data (Crucial Step)
        aligned_map = self.align_data(data_map)
        
        if not aligned_map: # Intersection empty
            return pd.DataFrame()
            
        # 2. Get the index from the first aligned df
        first_key = list(aligned_map.keys())[0]
        idx = aligned_map[first_key].index
        
        # 3. Prepare result DataFrame
        result = pd.DataFrame(index=idx)
        
        # 4. Calculate for each column type
        # Strategy: Reconstruct the formula replacing Ticker with "aligned_map['Ticker']['col']"
        # and use pd.eval or eval() with specific locals.
        
        cols_to_calc = ['open', 'high', 'low', 'close', 'volume']
        
        for col in cols_to_calc:
            # Prepare eval context
            eval_context = {}
            safe_formula = formula
            
            for ticker, df in aligned_map.items():
                if col in df.columns:
                    # Create a valid python variable name for this ticker data
                    # e.g. "VAR_0", "VAR_1"
                    # We map Ticker string in formula to this VAR name
                    
                    # We need a robust string replacement that doesn't replace substrings incorrectly
                    # e.g. replacing "ETH" in "ETHBTC" if we aren't careful.
                    # Use unique placeholders.
                    pass
            
            # Better approach for eval parsing:
            # 1. Sort tickers by length descending to avoid substring collision (e.g. ETHW vs ETH)
            sorted_tickers = sorted(aligned_map.keys(), key=len, reverse=True)
            
            # 2. Create a mapping ticker -> series
            # But we can't just pass dict to eval for complex keys like "BTC/USDT".
            # We must replace keys in formula with safe variable names.
            
            var_map = {}
            processed_formula = formula
            
            for i, ticker in enumerate(sorted_tickers):
                if col not in aligned_map[ticker].columns:
                    # Fill missing col with 0 or NaN?
                    # If volume missing, 0. If price, NaN?
                    val = 0 if col == 'volume' else np.nan
                    series = pd.Series(val, index=idx)
                else:
                    series = aligned_map[ticker][col]
                
                var_name = f"__VAR_{i}__"
                var_map[var_name] = series
                
                # Replace in formula
                # Use regex to ensure we replace exact words if possible, 
                # but tickers can contain symbols.
                # Since we sorted by length, direct replace is generally safe 
                # provided we escape regex chars in ticker if needed.
                
                escaped_ticker = re.escape(ticker)
                # Ensure we don't replace inside other vars (vars use underscores, tickers might not)
                # But we are replacing FROM the original formula string incrementally? No, that breaks.
                # Must tokenize? 
                
                # Simpler: Use a tokenizer that respects the boundaries logic from extract_tickers
                # Or just simple replace if we assume user spaces?
                # Let's try simple replace for MVP, assuming standard formatting.
                # Ideally, we tokenized earlier.
                
                processed_formula = processed_formula.replace(ticker, var_name)
            
            try:
                # 5. Evaluate
                # We use pd.eval or native eval? 
                # pd.eval is dangerous? native eval on Series works well for vector math.
                # Limit globals to safe math functions if needed.
                res_series = eval(processed_formula, {"__builtins__": None}, var_map)
                result[col] = res_series
            except Exception as e:
                print(f"Error calculating {col} for {formula}: {e}")
                # If calc fails (e.g. div by zero), result[col] remains empty/NaN
                result[col] = np.nan

        # 5. Clean up
        result.dropna(how='all', inplace=True)
        return result

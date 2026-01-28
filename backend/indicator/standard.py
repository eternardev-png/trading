import pandas as pd

def ind_EMA(df: pd.DataFrame, length: int = 20) -> pd.DataFrame:
    """Exponential Moving Average"""
    if 'close' not in df: return df
    df[f"EMA_{length}"] = df['close'].ewm(span=length, adjust=False).mean()
    return df

def ind_Bollinger(df: pd.DataFrame, length: int = 20, mult: float = 2.0) -> pd.DataFrame:
    """Bollinger Bands"""
    if 'close' not in df: return df
    
    sma = df['close'].rolling(window=length).mean()
    std = df['close'].rolling(window=length).std()
    
    upper = sma + (std * mult)
    lower = sma - (std * mult)
    
    df[f"BB_Upper_{length}_{mult}"] = upper
    df[f"BB_Lower_{length}_{mult}"] = lower
    # Also return basis? Usually main line is SMA.
    # Frontend likely expects specific keys.
    # If the frontend expects a 'band' object, we might need adjustments.
    # But usually LineSeries overlay is fine.
    return df

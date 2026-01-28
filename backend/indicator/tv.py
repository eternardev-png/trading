import pandas as pd
import numpy as np

def SMA(source: pd.Series, length: int) -> pd.Series:
    """Simple Moving Average"""
    return source.rolling(window=length).mean()

def EMA(source: pd.Series, length: int) -> pd.Series:
    """Exponential Moving Average"""
    return source.ewm(span=length, adjust=False).mean()

def RMA(source: pd.Series, length: int) -> pd.Series:
    """
    Running Moving Average (Wilder's Smoothing).
    Used for RSI. Equivalent to EMA with alpha = 1 / length.
    """
    return source.ewm(alpha=1/length, adjust=False).mean()

def RSI(source: pd.Series, length: int) -> pd.Series:
    """Relative Strength Index"""
    # 1. Change
    delta = source.diff()
    
    # 2. Up/Down
    up = delta.clip(lower=0)
    down = -1 * delta.clip(upper=0)
    
    # 3. Smoothed Avg (Wilder's)
    ma_up = RMA(up, length)
    ma_down = RMA(down, length)
    
    # 4. RS & RSI
    rs = ma_up / ma_down
    rsi = 100 - (100 / (1 + rs))
    return rsi

def MACD(source: pd.Series, fast: int, slow: int, signal: int) -> dict:
    """Moving Average Convergence Divergence"""
    fast_ma = EMA(source, fast)
    slow_ma = EMA(source, slow)
    macd_line = fast_ma - slow_ma
    signal_line = EMA(macd_line, signal)
    hist = macd_line - signal_line
    
    return {
        "MACD": macd_line,
        "Signal": signal_line,
        "Hist": hist
    }

def Bollinger(source: pd.Series, length: int, mult: float) -> dict:
    """Bollinger Bands"""
    basis = SMA(source, length)
    dev = source.rolling(window=length).std()
    upper = basis + (mult * dev)
    lower = basis - (mult * dev)
    
    return {
        "upper": upper,
        "lower": lower,
        "basis": basis
    }

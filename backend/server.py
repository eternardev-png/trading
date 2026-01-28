from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import pandas as pd
import numpy as np
import json
from typing import List, Optional, Dict, Any

from data_loader import DataLoader
from indicators import Indicators

app = FastAPI(title="AlgoResearch Lab API", description="Python Backend for React UI")

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow all origins for development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize engines
loader = DataLoader()
indicator_engine = Indicators(loader)

class DataRequest(BaseModel):
    ticker: str
    timeframe: str
    source: str = 'auto'

class IndicatorRequest(BaseModel):
    data: List[Dict[str, Any]] # Passed as JSON records
    indicator: str
    params: Dict[str, Any] = {}

@app.get("/")
def health_check():
    return {"status": "ok", "service": "AlgoResearch Lab Backend"}

@app.get("/api/v1/data")
def get_data(ticker: str, timeframe: str, source: str = 'auto', limit: int = 50000, to_timestamp: Optional[int] = None):
    """
    Fetch OHLC data for a ticker.
    """
    try:
        print(f"Fetching data for {ticker} {timeframe} from {source} limit={limit} to={to_timestamp}")
        df = loader.fetch_data(ticker, timeframe, source=source, limit=limit, to_timestamp=to_timestamp)
        
        if df.empty:
            raise HTTPException(status_code=404, detail="No data found")
        
        # Reset index to make date/datetime a column
        df_reset = df.reset_index()
        
        # Standardize date column to 'time' (unix timestamp)
        if 'date' in df_reset.columns:
            df_reset.rename(columns={'date': 'time'}, inplace=True)
        elif 'datetime' in df_reset.columns:
            df_reset.rename(columns={'datetime': 'time'}, inplace=True)
            
        # Convert timestamp to int (seconds)
        if not df_reset.empty and 'time' in df_reset.columns:
             # Check if it's already numeric or needs conversion
            if pd.api.types.is_datetime64_any_dtype(df_reset['time']):
                df_reset['time'] = df_reset['time'].astype('int64') // 10**9
        
        # Convert to records
        data_json = df_reset.to_dict(orient='records')
        return {"ticker": ticker, "timeframe": timeframe, "count": len(data_json), "data": data_json}
        
    except Exception as e:
        print(f"Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/macro")
def get_macro_data(ticker: str, limit: int = 5000):
    """
    Fetch macro-economic data (e.g. Fed Balance Sheet, M2).
    Supported Tickers: ECONOMICS:USWALCL, FRED:M2SL, ECONOMICS:USINTR, etc.
    """
    if not loader.tv_loader:
        raise HTTPException(status_code=503, detail="TradingView Loader not available")
        
    try:
        print(f"Fetching macro data for {ticker}...")
        df = loader.tv_loader.fetch_macro_series(ticker, n_bars=limit)
        
        if df is None or df.empty:
             raise HTTPException(status_code=404, detail=f"No data found for {ticker}")
             
        # Format for frontend (LineSeries)
        # DF has OHLCV, we use 'close' as the value
        data = []
        # Ensure 'close' exists
        if 'close' not in df.columns:
             # Fallback if single column
             col = df.columns[0]
             df['close'] = df[col]

        for date, row in df.iterrows():
            val = row['close']
            if pd.notna(val):
                data.append({
                    "time": int(date.timestamp()),
                    "value": float(val)
                })
                
        return {
            "ticker": ticker,
            "count": len(data),
            "data": data
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Macro fetch error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/indicators")
def calculate_indicator(req: IndicatorRequest):
    """
    Apply an indicator to the provided data.
    """
    try:
        # Reconstruct DataFrame
        df = pd.DataFrame(req.data)
        
        # Explicitly enforce numeric types to prevent calc errors
        numeric_cols = ['open', 'high', 'low', 'close', 'volume']
        for col in numeric_cols:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors='coerce')
        
        if 'time' in df.columns:
             # Use time as index if needed, or just keep it
             # Indicators engine expects numeric or datetime index? 
             # Let's check indicators.py logic implicitly. Usually it acts on columns.
             pass

        if df.empty:
             raise HTTPException(status_code=400, detail="Empty data provided")
             
        # Debug: Check types
        print(f"DF Types: {df.dtypes}")

        # Apply indicator
        # Note: The Indicators class modifies the DF in place or returns it.
        # We need to see how apply_indicator works. Assuming it returns DF with new columns.
        
        # Convert 'time' back to datetime if indicators need it (usually they work on Close/Open/etc matching numerical index or just array)
        # But let's assume standard pandas logic.
        
        # Parse params
        params = req.params

        if req.indicator == 'BTC_GM2' and 'global_m2' not in df.columns:
            # Hydration disabled to prevent corruption
            pass
        # ----------------------------------------------------
        # HYDRATION DISABLED:
        # Prevent automatic merging of M2 data for standard indicators.
        # Indicators like GLF/BTC_GM2 fetch their own data internally.
        # This avoids potential merge/timezone issues destroying the main price DF.
        # ----------------------------------------------------
        # ----------------------------------------------------

        
        # Call engine
        # We need to know specific arguments for each indicator logic if they are positional, 
        # but apply_indicator usually takes **kwargs
        
        df_result = indicator_engine.apply_indicator(df, req.indicator, **params)
        

        
        # PROTOCOL 2.0 CHECK
        if isinstance(df_result, dict):
            if "error" in df_result:
                 raise Exception(df_result["error"])
            
            # Protocol 2.0 Structure
            if "meta" in df_result and "plots" in df_result:
                print(f"Protocol 2.0 Response for {req.indicator}. Plots: {list(df_result['plots'].keys())}", flush=True)
                return {
                     "indicator": req.indicator,
                     "protocol": "2.0",
                     "meta": df_result["meta"],
                     "plots": df_result["plots"],
                     "data": df_result["data"]
                }
            
            # Legacy Dict Fallback
            return {
                "indicator": req.indicator,
                "data": df_result.get("data", [])
            }
        
        # Legacy DataFrame Fallback (for non-migrated indicators)
        print(f"Legacy DataFrame Response for {req.indicator}", flush=True)
        
        # SANITIZE
        df_clean = df_result.astype(object)
        df_clean = df_clean.replace([float('inf'), float('-inf'), np.nan], None)
        
        # Restore time if needed
        if 'time' not in df_clean.columns:
            if isinstance(df_clean.index, pd.DatetimeIndex):
                df_clean['time'] = df_clean.index.astype(np.int64) // 10**9
                 
        result_json = df_clean.to_dict(orient='records')
        return {"indicator": req.indicator, "data": result_json}


    except Exception as e:
        import traceback
        error_msg = traceback.format_exc()
        print(f"Error calculating {req.indicator}: {e}")
        # Log to file for debugging
        with open("backend_error.log", "a") as f:
            f.write(f"\n--- Error calculating {req.indicator} ---\n")
            f.write(error_msg)
            f.write("Params: " + str(req.params) + "\n")
        
        raise HTTPException(status_code=500, detail=str(e))

from backtester import Backtester

# ... existing code ...

class BacktestRequest(BaseModel):
    ticker: str
    timeframe: str
    length: int = 20
    initial_balance: float = 10000.0

@app.post("/api/v1/backtest")
def run_backtest(req: BacktestRequest):
    """
    Run a simple SMA crossover backtest.
    """
    try:
        # 1. Fetch Data
        df = loader.fetch_data(req.ticker, req.timeframe)
        if df.empty:
             raise HTTPException(status_code=404, detail="No data found for backtest")
             
        # 2. Add Indicator (SMA)
        # Using the engine to add the column
        df = indicator_engine.ind_SMA(df, length=req.length)
        
        # 3. Run Backtest
        bt = Backtester(df, initial_balance=req.initial_balance)
        sma_col = f"SMA_{req.length}"
        bt.run(sma_col_name=sma_col)
        
        return {
            "metrics": bt.get_performance_metrics(),
            "trades": bt.trades,
            "equity": bt.equity_curve
        }
        
    except Exception as e:
        print(f"Backtest error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)

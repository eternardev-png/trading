from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import pandas as pd
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
indicator_engine = Indicators()

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

@app.post("/api/v1/indicators")
def calculate_indicator(req: IndicatorRequest):
    """
    Apply an indicator to the provided data.
    """
    try:
        # Reconstruct DataFrame
        df = pd.DataFrame(req.data)
        if 'time' in df.columns:
             # Use time as index if needed, or just keep it
             # Indicators engine expects numeric or datetime index? 
             # Let's check indicators.py logic implicitly. Usually it acts on columns.
             pass

        if df.empty:
             raise HTTPException(status_code=400, detail="Empty data provided")

        # Apply indicator
        # Note: The Indicators class modifies the DF in place or returns it.
        # We need to see how apply_indicator works. Assuming it returns DF with new columns.
        
        # Convert 'time' back to datetime if indicators need it (usually they work on Close/Open/etc matching numerical index or just array)
        # But let's assume standard pandas logic.
        
        # Parse params
        params = req.params

        # --- SPECIAL HANDLING: Hydrate Macro Data for GM2 ---
        if req.indicator == 'BTC_GM2' and 'global_m2' not in df.columns:
            try:
                print("Hydrating dataframe with Global M2 data...")
                # 1. Prepare Crypto DF (Indices must be Datetime)
                df_temp = df.copy()
                if 'time' in df_temp.columns:
                    df_temp['date'] = pd.to_datetime(df_temp['time'], unit='s')
                    df_temp.set_index('date', inplace=True)
                
                # 2. Fetch Macro
                # 'Global M2' will trigger the logic in DataLoader
                m2_df = loader.fetch_macro_data('Global M2')
                
                if not m2_df.empty:
                    # 3. Merge
                    # merge_with_macro expects both to have DatetimeIndex
                    merged_df = loader.merge_with_macro(df_temp, m2_df)
                    
                    # 4. Restore original structure (columns 'global_m2' should now exist)
                    # We dropped 'time' if we set it as index? No, set_index keeps it unless drop=True (default True).
                    # Let's restore 'time' from index or just keep 'global_m2' column back to original df?
                    # Easiest is to use the merged_df, reset index to get 'date', then convert back to 'time' or just ensure 'time' exists.
                    
                    # merged_df has DatetimeIndex.
                    # It has 'global_m2'.
                    # It might have missing rows if merge failed? No, left join.
                    
                    # Reset index to get date column back
                    merged_df.reset_index(inplace=True)
                    
                    # Ensure 'time' column is present and correct
                    if 'time' not in merged_df.columns:
                        merged_df['time'] = merged_df['date'].astype('int64') // 10**9
                        
                    # Update our main df
                    df = merged_df
                    print("Hydration successful. Columns:", df.columns.tolist())
                else:
                    print("Warning: Global M2 fetch returned empty.")
            except Exception as ex:
                print(f"Error hydrating M2: {ex}")
        # ----------------------------------------------------

        
        # Call engine
        # We need to know specific arguments for each indicator logic if they are positional, 
        # but apply_indicator usually takes **kwargs
        
        df_result = indicator_engine.apply_indicator(df, req.indicator, **params)
        
        # Handle Dictionary result (e.g. BTC_GM2 new implementation)
        if isinstance(df_result, dict):
            if 'error' in df_result:
                 raise Exception(df_result['error'])
            return {
                "indicator": req.indicator,
                "data": df_result.get("data", [])
            }
        
        # Handle DataFrame result (Legacy/Other indicators)
        result_json = df_result.to_dict(orient='records')
        return {"indicator": req.indicator, "data": result_json}

    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"Error calculating {req.indicator}: {e}")
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

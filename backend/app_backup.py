import streamlit as st
import pandas as pd
from data_loader import DataLoader
from indicators import Indicators
from backtester import Backtester
from streamlit_lightweight_charts_ntf import renderLightweightCharts

st.set_page_config(layout="wide", page_title="AlgoResearch Lab")

st.title("AlgoResearch Lab 🧪")

# --- Sidebar ---
st.sidebar.header("Data Settings")

# Smart Ticker Selector
ticker_options = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'Custom']
selected_ticker = st.sidebar.selectbox("Ticker", options=ticker_options, index=0)

if selected_ticker == 'Custom':
    ticker = st.sidebar.text_input("Enter Ticker", value="BTC/USDT")
else:
    ticker = selected_ticker

timeframe = st.sidebar.selectbox("Timeframe", options=["1d", "4h", "1h", "15m", "5m"], index=0)

st.sidebar.header("Indicators")
indicator_engine = Indicators()
available_inds = indicator_engine.get_available_indicators()
selected_inds = []
for ind in available_inds:
    if st.sidebar.checkbox(ind, value=(ind=='SMA')): # Default SMA checked
        selected_inds.append(ind)

# BTC_GM2 Visualization Settings
btc_gm2_mode = "Separate Panel"
# Default values from TradingView screenshot
gm2_params = {
    'min_dist_weeks': 10,
    'yoy_threshold': 2.5,
    'sell_threshold': 0.7,
    'sma_weeks': 52,
    'm2_factor': 1.4
}

if 'BTC_GM2' in selected_inds:
    st.sidebar.markdown("---")
    st.sidebar.subheader("BTC_GM2 Settings")
    btc_gm2_mode = st.sidebar.radio("Display Mode", ["Separate Panel", "Overlay (Left Axis)"], index=0)
    
    with st.sidebar.expander("Parameters", expanded=True):
        gm2_params['min_dist_weeks'] = st.number_input("Min Distance (Weeks)", min_value=1, value=10)
        gm2_params['yoy_threshold']  = st.number_input("Min YoY M2 Growth (%)", value=2.5, step=0.1)
        gm2_params['sell_threshold'] = st.number_input("Sell Distance Threshold", value=0.7, step=0.05)
        gm2_params['sma_weeks']      = st.number_input("SMA Length (Weeks)", min_value=1, value=52)
        
        st.markdown("---")
        gm2_params['m2_factor'] = st.slider("Global M2 Multiplier", 0.5, 2.5, 1.40, 0.05, help="Calibration factor")

# --- Backtest Controls (Moved to Sidebar) ---
st.sidebar.markdown("---")
st.sidebar.header("Strategy")
run_backtest = st.sidebar.button("Run Backtest (Golden Cross)")

# --- Data Loading ---
loader = DataLoader()
with st.spinner(f"Fetching data for {ticker}..."):
    df = loader.fetch_data(ticker, timeframe, source='auto')
    
    # Load Macro Data if needed (optimization: only if macro indicators are selected, 
    # but for now we load it generally or check if BTC_GM2 is selected)
    # The user specifically wants BTC_GM2, so let's load it.
    if any('GM2' in ind for ind in selected_inds): # Simple check if GM2 is relevant
        with st.spinner("Fetching Macro Data (M2SL)..."):
            df_m2 = loader.fetch_macro_data('M2SL')
            df = loader.merge_with_macro(df, df_m2, macro_col_name='global_m2')

if df.empty:
    st.error(f"No data found for {ticker}")
else:
    # --- Indicator Calculation ---
    for ind in selected_inds:
        # Simple parameter handling for MVP
        if ind == 'SMA':
            df = indicator_engine.apply_indicator(df, ind, length=20)
        elif ind == 'RSI':
            df = indicator_engine.apply_indicator(df, ind, length=14)
        elif ind == 'BTC_GM2':
            df = indicator_engine.apply_indicator(
                df, ind, 
                sma_weeks=gm2_params['sma_weeks'],
                yoy_threshold=gm2_params['yoy_threshold'],
                sell_threshold=gm2_params['sell_threshold'],
                min_dist_weeks=gm2_params['min_dist_weeks'],
                m2_factor=gm2_params['m2_factor']
            )
        else:
            df = indicator_engine.apply_indicator(df, ind)

    # --- Header Metrics (Dashboard) ---
    st.markdown("### Market Overview")
    
    last_row = df.iloc[-1]
    prev_row = df.iloc[-2] if len(df) > 1 else last_row
    
    col1, col2, col3, col4 = st.columns(4)
    
    # 1. Price & Change
    price = last_row['close']
    price_change = price - prev_row['close']
    price_pct = (price_change / prev_row['close']) * 100
    col1.metric("Current Price", f"${price:,.2f}", f"{price_pct:.2f}%")
    
    # 2. RSI
    if 'RSI_14' in df.columns:
        rsi_val = last_row['RSI_14']
        col2.metric("RSI (14)", f"{rsi_val:.2f}")
    else:
        col2.metric("RSI (14)", "N/A")

    # 3. SMA
    if 'SMA_20' in df.columns:
        sma_val = last_row['SMA_20']
        col3.metric("SMA (20)", f"${sma_val:,.2f}")
        
        # 4. Market Regime
        if price > sma_val:
            col4.metric("Market Regime", "Bullish 🐂", delta="Long Trend")
        else:
            col4.metric("Market Regime", "Bearish 🐻", delta="-Short Trend")
    else:
        col3.metric("SMA (20)", "N/A")
        col4.metric("Market Regime", "Neutral")


    # --- Chart Preparation ---
    # Convert index to 'time' for lightweight-charts
    df_chart = df.reset_index()
    if 'date' in df_chart.columns:
        df_chart.rename(columns={'date': 'time'}, inplace=True)
    elif 'datetime' in df_chart.columns:
        df_chart.rename(columns={'datetime': 'time'}, inplace=True)
    
    # Convert to unix timestamp
    df_chart['time'] = df_chart['time'].astype('int64') // 10**9

    candlestick_series = [
        {
            "time": row['time'],
            "open": row['open'],
            "high": row['high'],
            "low": row['low'],
            "close": row['close']
        }
        for index, row in df_chart.iterrows()
    ]

    series_data = [
        {
            "type": "Candlestick",
            "data": candlestick_series,
            "options": {
                "upColor": "#26a69a",
                "downColor": "#ef5350",
                "borderVisible": False,
                "wickUpColor": "#26a69a",
                "wickDownColor": "#ef5350"
            }
        }
    ]

    # SMA Overlay
    if 'SMA_20' in df.columns and 'SMA' in selected_inds:
        sma_data = [{"time": row['time'], "value": row['SMA_20']} for _, row in df_chart.iterrows() if not pd.isna(row['SMA_20'])]
        series_data.append({
            "type": "Line",
            "data": sma_data,
            "options": {
                "color": "#eb4d4b",
                "lineWidth": 2,
            }
        })
    
    # BTC_GM2 Preparation
    btc_gm2_series_list = []
    if 'BTC_GM2' in df.columns and 'BTC_GM2' in selected_inds:
        # 0. Background Zones (Histogram) - Must be first to stay in background
        if 'Zone_Value' in df.columns:
            zone_data = [
                {"time": row['time'], "value": row['Zone_Value'], "color": row['Zone_Color']} 
                for _, row in df_chart.iterrows() 
                if row['Zone_Value'] > 0 and row['Zone_Color']
            ]
            if zone_data:
                btc_gm2_series_list.append({
                    "type": "Histogram",
                    "data": zone_data,
                    "options": {
                         "priceScaleId": "zone_scale", # Separate scale
                         "priceFormat": {"type": "volume"}, # Hide values conceptually
                    }
                })

        # 1. Main Ratio Line
        gm2_vals = [{"time": row['time'], "value": row['BTC_GM2']} for _, row in df_chart.iterrows() if not pd.isna(row['BTC_GM2'])]
        scale_id = "left" if "Overlay" in btc_gm2_mode else "right"
        
        btc_gm2_series_list.append({
            "type": "Line",
            "data": gm2_vals,
            "options": {
                "color": "#FFD700", # Gold
                "lineWidth": 2,
                "priceScaleId": scale_id,
                "title": "BTC/GM2 Ratio"
            }
        })
        
        # 2. SMA Line
        if 'BTC_GM2_SMA' in df.columns:
            sma_vals = [{"time": row['time'], "value": row['BTC_GM2_SMA']} for _, row in df_chart.iterrows() if not pd.isna(row['BTC_GM2_SMA'])]
            btc_gm2_series_list.append({
                "type": "Line",
                "data": sma_vals,
                "options": {
                    "color": "#FFA500", # Orange
                    "lineWidth": 1,
                    "priceScaleId": scale_id,
                    "title": "SMA (365)"
                }
            })
            
        # 3. Upper Band
        if 'BTC_GM2_Upper' in df.columns:
            upper_vals = [{"time": row['time'], "value": row['BTC_GM2_Upper']} for _, row in df_chart.iterrows() if not pd.isna(row['BTC_GM2_Upper'])]
            btc_gm2_series_list.append({
                "type": "Line",
                "data": upper_vals,
                "options": {
                    "color": "rgba(76, 175, 80, 0.5)", # Greenish semi-transparent
                    "lineWidth": 1,
                    "lineStyle": 2, # Dashed
                    "priceScaleId": scale_id,
                    "title": "Overvalued Zone"
                }
            })
            
        # 4. Lower Band
        if 'BTC_GM2_Lower' in df.columns:
            lower_vals = [{"time": row['time'], "value": row['BTC_GM2_Lower']} for _, row in df_chart.iterrows() if not pd.isna(row['BTC_GM2_Lower'])]
            btc_gm2_series_list.append({
                "type": "Line",
                "data": lower_vals,
                "options": {
                    "color": "rgba(239, 83, 80, 0.5)", # Reddish semi-transparent
                    "lineWidth": 1,
                    "lineStyle": 2, # Dashed
                    "priceScaleId": scale_id,
                    "title": "Undervalued Zone"
                }
            })
            
        # 5. Signals (Markers)
        markers = []
        if 'Signal_Buy' in df.columns and 'Signal_Sell' in df.columns:
            # We assume Signal_Buy/Sell are already filtered in indicators.py based on min_dist
            
            # Extract signal columns as list/array for speed
            buy_signals = df['Signal_Buy'].values
            sell_signals = df['Signal_Sell'].values
            
            for i, row in df_chart.iterrows():
                # Buy Signal
                if buy_signals[i]:
                     markers.append({
                        "time": row['time'],
                        "position": "belowBar",
                        "color": "#4CAF50", # Green
                        "shape": "arrowUp",
                        "text": "BUY"
                    })
                        
                # Sell Signal
                if sell_signals[i]:
                    markers.append({
                        "time": row['time'],
                        "position": "aboveBar",
                        "color": "#EF5350", # Red
                        "shape": "arrowDown",
                        "text": "SELL"
                    })
        
        # Determine where to attach markers.
        # If Overlay, attach to Main Candle Series (item 0 in series_data).
        # If Separate, attach to Ratio Line (item 0 in btc_gm2_series_list).
        
        target_series_for_markers = None
        if "Overlay" in btc_gm2_mode and series_data:
             # Assume series_data[0] is the main candlestick chart
             target_series_for_markers = series_data[0]
        elif btc_gm2_series_list:
             target_series_for_markers = btc_gm2_series_list[0]
             
        if target_series_for_markers and markers:
            # markers must be sorted by time
            # existing markers (if any) + new ones
            if "markers" not in target_series_for_markers:
                target_series_for_markers["markers"] = []
            target_series_for_markers["markers"].extend(markers)

    # Add BTC_GM2 series to main chart if Overlay
    if btc_gm2_series_list and "Overlay" in btc_gm2_mode:
        series_data.extend(btc_gm2_series_list)
    
    # Render Main Chart
    renderLightweightCharts([
        {
            "series": series_data,
            "chart": {
                "height": 500,
                "layout": {
                    "background": {"type": "solid", "color": "#1E1E1E"},
                    "textColor": "#d1d4dc"
                },
                "grid": {
                    "vertLines": {"color": "rgba(42, 46, 57, 0.5)"},
                    "horzLines": {"color": "rgba(42, 46, 57, 0.5)"}
                },
                "leftPriceScale": {
                    "visible": True if (btc_gm2_series_list and "Overlay" in btc_gm2_mode) else False,
                    "borderColor": "rgba(197, 203, 206, 0.5)"
                },
                "rightPriceScale": {
                    "visible": True,
                    "borderColor": "rgba(197, 203, 206, 0.5)"
                },
                "zone_scale": {  # Hidden scale for background zones
                    "visible": False,
                    "autoScale": False, # Manual scale needed? Or Auto is fine if 0-1 matches data
                    "scaleMargins": {
                        "top": 0,
                        "bottom": 0,
                    }
                }
            }
        }
    ], key="main_chart")

    # RSI Pane
    has_rsi = 'RSI_14' in df.columns and 'RSI' in selected_inds
    if has_rsi:
        st.subheader("RSI Momentum")
        rsi_vals = [{"time": row['time'], "value": row['RSI_14']} for _, row in df_chart.iterrows() if not pd.isna(row['RSI_14'])]
        rsi_series = [{
            "type": "Line",
            "data": rsi_vals,
            "options": {
                "color": "#2962FF",
                "lineWidth": 2
            }
        }]
        
        renderLightweightCharts([
            {
                "series": rsi_series,
                "chart": {
                    "height": 200,
                    "layout": {
                        "background": {"type": "solid", "color": "#1E1E1E"},
                        "textColor": "#d1d4dc"
                    },
                    "grid": {
                        "vertLines": {"color": "rgba(42, 46, 57, 0.5)"},
                        "horzLines": {"color": "rgba(42, 46, 57, 0.5)"}
                    }
                }
            }
        ], key="rsi_chart")

    # BTC_GM2 Separate Pane
    if btc_gm2_series_list and btc_gm2_mode == "Separate Panel":
        st.subheader("BTC / Global M2 Ratio")
        
        # Ensure correct scaling for separate chart (default right)
        for s in btc_gm2_series_list:
            if s['type'] != 'Histogram':
                s['options']['priceScaleId'] = 'right'
        
        renderLightweightCharts([
            {
                "series": btc_gm2_series_list,
                "chart": {
                    "height": 500, # Increased from 250
                    "layout": {
                        "background": {"type": "solid", "color": "#1E1E1E"},
                        "textColor": "#d1d4dc"
                    },
                    "grid": {
                        "vertLines": {"color": "rgba(42, 46, 57, 0.5)"},
                        "horzLines": {"color": "rgba(42, 46, 57, 0.5)"}
                    },
                    "zone_scale": {
                        "visible": False,
                        "autoScale": False,
                        "scaleMargins": {
                            "top": 0,
                            "bottom": 0,
                        }
                    }
                }
            }
        ], key="gm2_chart")


    # --- Backtest Logic & Display ---
    
    # Initialize session state for backtest if needed
    if 'backtest_results' not in st.session_state:
        st.session_state.backtest_results = None

    if run_backtest:
        if 'SMA_20' not in df.columns:
            st.error("⚠️ Please enable SMA indicator for the Golden Cross strategy.")
        else:
            with st.spinner("Simulating Trades..."):
                tester = Backtester(df)
                tester.run(sma_col_name='SMA_20')
                
                # Save to session
                st.session_state.backtest_results = {
                    'metrics': tester.get_performance_metrics(),
                    'equity': tester.equity_curve
                }

    # Render Backtest Results if available
    if st.session_state.backtest_results:
        with st.expander("📊 Backtest Results", expanded=True):
            res = st.session_state.backtest_results
            metrics = res['metrics']
            equity = res['equity']
            
            # Metrics Columns
            b_col1, b_col2, b_col3 = st.columns(3)
            
            # Total Return
            ret_pct = metrics['Return %']
            b_col1.metric("Total Return", f"{ret_pct:.2f}%", delta=f"{ret_pct:.2f}%")
            
            # Win Rate
            b_col2.metric("Win Rate", f"{metrics['Win Rate']:.2f}%")
            
            # Final Balance
            b_col3.metric("Final Balance", f"${metrics['Final Balance']:,.2f}")
            
            # Equity Curve (using lightweight-charts instead of st.line_chart to avoid Altair compatibility issues)
            st.markdown("#### Equity Curve")
            if equity:
                # Format for lightweight-charts: list of dicts {'time': ..., 'value': ...}
                # 'equity' is already in this format from backtester.py
                
                renderLightweightCharts([
                    {
                        "series": [
                            {
                                "type": 'Area',
                                "data": equity,
                                "options": {
                                    "lineColor": '#2962FF',
                                    "topColor": 'rgba(41, 98, 255, 0.3)',
                                    "bottomColor": 'rgba(41, 98, 255, 0)',
                                }
                            }
                        ],
                        "chart": {
                            "height": 300,
                            "layout": {
                                "background": {"type": "solid", "color": "#1E1E1E"},
                                "textColor": "#d1d4dc"
                            },
                            "grid": {
                                "vertLines": {"color": "rgba(42, 46, 57, 0.5)"},
                                "horzLines": {"color": "rgba(42, 46, 57, 0.5)"}
                            },
                             "timeScale": {
                                "timeVisible": True,
                                "secondsVisible": False,
                            }
                        }
                    }
                ], key="equity_chart")
            else:
                st.write("No trades generated.")

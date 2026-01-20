import pandas as pd

class Backtester:
    def __init__(self, df: pd.DataFrame, initial_balance: float = 10000.0):
        self.df = df
        self.initial_balance = initial_balance
        self.balance = initial_balance
        self.position = None # None or 'long'
        self.entry_price = 0.0
        self.qty = 0.0
        
        self.trades = []
        self.equity_curve = [] # List of dicts: {'time': ..., 'value': ...}

    def run(self, sma_col_name='SMA_20'):
        """
        Runs the backtest simulation.
        Assumes 'SMA_20' (or other provided name) exists in df.
        """
        if sma_col_name not in self.df.columns:
            print(f"Error: {sma_col_name} not found in DataFrame.")
            return

        # Iterate through the DataFrame
        # Using itertuples for better performance than iterrows, but still standard loop
        # We need index (date/time) access
        
        # Reset index to access time column easily if it's the index
        if 'time' not in self.df.columns and 'date' not in self.df.columns:
             # Assuming index is the datetime
             data = self.df.reset_index()
             # Rename index col to 'time' if needed or just use it
             time_col = data.columns[0] # infer
        else:
             data = self.df.copy()
             time_col = 'time' if 'time' in data.columns else 'date'

        for row in data.itertuples():
            # Current price and indicator
            price = row.close
            
            # Dynamically get SMA value 
            # getattr(row, sma_col_name) might fail if column name has special chars not valid in python identifiers
            # Safer to access via direct attribute if name is clean, or use index lookup if needed.
            # Our indicators.py creates 'SMA_20', 'RSI_14'. These are valid attributes.
            try:
                sma = getattr(row, sma_col_name)
            except AttributeError:
                # Fallback if column name is complex
                continue

            if pd.isna(sma):
                continue

            # Record Equity (Cash + Unrealized PnL)
            current_equity = self.balance
            if self.position == 'long':
                unrealized_pnl = (price - self.entry_price) * self.qty
                current_equity += unrealized_pnl
            
            # Handle Time format for charts (Unix timestamp seconds)
            time_val = getattr(row, time_col)
            # Ensure it's timestamp
            if isinstance(time_val, pd.Timestamp):
                 ts = int(time_val.timestamp())
            else:
                 # Assume it might be string or int already?
                 # If string, naive parse or just pass
                 ts = time_val

            self.equity_curve.append({'time': ts, 'value': current_equity})

            # Strategy Logic: Golden Cross / Death Cross logic simplified to Price vs SMA
            # "Buy when Close crosses SMA from below" -> Close > SMA
            # "Sell when Close crosses SMA from above" -> Close < SMA
            
            # Simple condition check
            if self.position is None:
                if price > sma:
                    # Buy Signal
                    self.position = 'long'
                    self.entry_price = price
                    # Buy max possible qty
                    self.qty = self.balance / price
                    self.balance = 0 # All in
                    
                    self.trades.append({
                        'type': 'buy',
                        'entry_time': ts,
                        'entry_price': price
                    })
            
            elif self.position == 'long':
                if price < sma:
                    # Sell Signal
                    self.position = None
                    exit_price = price
                    # Cash out
                    cash_returned = self.qty * exit_price
                    pnl = cash_returned - (self.qty * self.entry_price)
                    self.balance = cash_returned
                    self.qty = 0
                    
                    # Update last trade with exit info
                    self.trades[-1]['exit_time'] = ts
                    self.trades[-1]['exit_price'] = exit_price
                    self.trades[-1]['pnl'] = pnl
                    self.trades[-1]['return_pct'] = (exit_price - self.entry_price) / self.entry_price * 100

        # Close open position at end
        if self.position == 'long':
             last_row = data.iloc[-1]
             exit_price = last_row.close
             cash_returned = self.qty * exit_price
             pnl = cash_returned - (self.qty * self.entry_price)
             self.balance = cash_returned
             
             self.trades[-1]['exit_time'] = getattr(last_row, time_col) if not isinstance(getattr(last_row, time_col), pd.Timestamp) else int(getattr(last_row, time_col).timestamp())
             self.trades[-1]['exit_price'] = exit_price
             self.trades[-1]['pnl'] = pnl
             self.trades[-1]['return_pct'] = (exit_price - self.entry_price) / self.entry_price * 100
             self.position = None

    def get_performance_metrics(self):
        total_pnl = self.balance - self.initial_balance
        return_pct = (total_pnl / self.initial_balance) * 100
        
        completed_trades = [t for t in self.trades if 'pnl' in t]
        win_trades = [t for t in completed_trades if t['pnl'] > 0]
        
        win_rate = (len(win_trades) / len(completed_trades) * 100) if completed_trades else 0.0
        
        return {
            'Initial Balance': self.initial_balance,
            'Final Balance': self.balance,
            'Total PnL': total_pnl,
            'Return %': return_pct,
            'Win Rate': win_rate,
            'Total Trades': len(completed_trades)
        }

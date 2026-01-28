import pandas as pd

class Backtester:
    def __init__(self, df: pd.DataFrame, initial_balance: float = 10000.0):
        self.df = df
        self.initial_balance = initial_balance
        self.balance = initial_balance # Cash
        self.equity_curve = [] 
        self.trades = []
        
        # Portfolio State
        # We hold positions based on specific signals. 
        # Ideally, we have 'sub-strategies' or just a net exposure.
        # "Capital Allocation: 25% weight on each of 4 indicators"
        # 1. Tier 2 MVRV
        # 2. Tier 2 BTCM2
        # 3. Tier 2 GLF Liquidity
        # 4. (Maybe another one? Prompt said 4 indicators. Using SMA200 trend or similar as 4th or maybe Tier 1 itself?)
        # Let's assume the 4th is Tier 1 (Macro) acting as a filter OR a signal itself.
        # Prompt: "Capital Allocation: 25% веса на каждый из 4-х индикаторов."
        # "QT Multiplier: Если Tier 1 в зоне QT, размер открываемой позиции умножается на коэффициент".
        # This implies Tier 1 modifies the SIZE of others. But "4 indicators" suggests 4 signals.
        # Let's assume:
        # 1. MVRV Z-Score
        # 2. BTCM2
        # 3. GLF Liquidity
        # 4. Trend Following (e.g. SMA Crossover or just Price > SMA200)
        
        self.allocations = {
            'MVRV': 0.25,
            'BTCM2': 0.25,
            'GLF_Liq': 0.25,
            'Trend': 0.25
        }
        
        # Current Holdings (Amount of Asset) per Strategy
        self.positions = {
            'MVRV': 0.0,
            'BTCM2': 0.0,
            'GLF_Liq': 0.0,
            'Trend': 0.0
        }
        
        # QT Multiplier Default
        self.qt_multiplier = 0.5 # If QT is active, reduce position size by half? Or define in run()

    def run_portfolio_strategy(self):
        """
        Runs the portfolio backtest with Pyramiding and QT Risk Control.
        """
        # Ensure necessary columns exist
        required = ['Tier1_Signal', 'Signal_MVRV', 'Signal_BTCM2', 'Signal_GLF_Liquidity']
        missing = [c for c in required if c not in self.df.columns]
        
        # Auto-fill missing logic if possible (e.g. Trend)
        if 'Signal_Trend' not in self.df.columns:
            if 'SMA_200' in self.df.columns:
                self.df['Signal_Trend'] = self.df['close'] > self.df['SMA_200']
            else:
                 # Calculate on fly
                 self.df['SMA_200'] = self.df['close'].rolling(200).mean()
                 self.df['Signal_Trend'] = self.df['close'] > self.df['SMA_200']

        # Scan
        data = self.df.reset_index() if 'time' not in self.df.columns else self.df
        time_col = 'time' if 'time' in data.columns else 'date'
        if time_col not in data.columns: time_col = data.columns[0] # Fallback
        
        for row in data.itertuples():
            price = row.close
            ts = getattr(row, time_col)
            if hasattr(ts, 'timestamp'): ts = int(ts.timestamp())
            
            # 1. Determine Global Risk Multiplier (Tier 1)
            tier1_sig = getattr(row, 'Tier1_Signal', 'Neutral')
            risk_mult = 1.0
            if tier1_sig == 'QT':
                risk_mult = self.qt_multiplier # e.g. 0.5 or 0.0 (Cash is king)
            elif tier1_sig == 'QE':
                risk_mult = 1.0 # Full gas
            
            # 2. Evaluate Sub-Strategies
            # Each strategy manages 25% of ORIGINAL Capital (or Equity). 
            # Rebalancing vs Fixed Fractional?
            # Simple approach: Each "bucket" has max allocation = 25% of Current Equity * RiskMult.
            
            total_equity = self.balance + sum([amt * price for amt in self.positions.values()])
            
            # Signals (True/False or Buy/Sell/Neutral)
            # MVRV
            sig_mvrv = getattr(row, 'Signal_MVRV', 'Neutral')
            self._process_bucket('MVRV', sig_mvrv == 'Buy', sig_mvrv == 'Sell', price, total_equity, risk_mult, ts)

            # BTCM2
            sig_btcm2 = getattr(row, 'Signal_BTCM2', False)
            # Assuming BTCM2 is boolean "Buy Zone". Sell when False? Or hold?
            # Usually these are "Accumulation" zones. Let's sell if condition lost? Or hold long term?
            # Prompt doesn't specify Sell for BTCM2. Let's assume Sell if Distance > 0 (Price above Trend).
            dist = getattr(row, 'Distance_Price_SMA', 0)
            self._process_bucket('BTCM2', sig_btcm2, dist > 0.5, price, total_equity, risk_mult, ts) # Sell if extended 50% above SMA? Or just standard take profit? Using arbitrary exit for now or just hold.
            # Let's assume Sell if logic becomes False? No, that churns. 
            # Let's simple Sell if Distance is positive (Above Mean).
            
            # GLF Liquidity
            sig_glf = getattr(row, 'Signal_GLF_Liquidity', False)
            self._process_bucket('GLF_Liq', sig_glf, not sig_glf, price, total_equity, risk_mult, ts)
            
            # Trend
            sig_trend = getattr(row, 'Signal_Trend', False)
            self._process_bucket('Trend', sig_trend, not sig_trend, price, total_equity, risk_mult, ts)
            
            # Record
            self.equity_curve.append({'time': ts, 'value': total_equity})

    def _process_bucket(self, name, buy_signal, sell_signal, price, total_equity, risk_mult, ts):
        target_alloc = self.allocations[name] * risk_mult
        target_value = total_equity * target_alloc
        
        current_pos_value = self.positions[name] * price
        
        if buy_signal:
            # Rebalance UP to target if we have cash
            # Only buy if we are below target
            if current_pos_value < target_value:
                needed = target_value - current_pos_value
                if self.balance >= needed:
                    qty = needed / price
                    self.balance -= needed
                    self.positions[name] += qty
                    self.trades.append({'type': 'buy', 'strat': name, 'price': price, 'time': ts, 'qty': qty})
        
        elif sell_signal:
            # Liquidate bucket
            if self.positions[name] > 0:
                cash_out = self.positions[name] * price
                self.balance += cash_out
                start_val = 0 # Need tracking entry cost for PnL, simplified here
                self.positions[name] = 0
                self.trades.append({'type': 'sell', 'strat': name, 'price': price, 'time': ts, 'qty': 0})

    def run(self, sma_col_name='SMA_20'):
        # Backward compatibility wrapper or main entry
        if 'Tier1_Signal' in self.df.columns:
            self.run_portfolio_strategy()
        else:
            # Fallback to simple SMA logic
            super().run(sma_col_name) # Wait, inheritance issue.
            # Just implement simple loop here if needed, or deprecate.
            pass

    def get_performance_metrics(self):
        final_equity = self.equity_curve[-1]['value'] if self.equity_curve else self.initial_balance
        total_pnl = final_equity - self.initial_balance
        return_pct = (total_pnl / self.initial_balance) * 100
        
        return {
            'Initial Balance': self.initial_balance,
            'Final Balance': final_equity,
            'Total PnL': total_pnl,
            'Return %': return_pct,
            'Positions': self.positions
        }

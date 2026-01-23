import React from 'react'
import { useLayoutStore } from '../stores/useLayoutStore'
import './StrategyMarkers.scss'

/**
 * Component to display buy/sell strategy signals as markers on the chart
 */
function StrategyMarkers({ chartRef, paneId }) {
    const strategySignals = useLayoutStore(state => state.strategySignals)

    if (!strategySignals || strategySignals.length === 0 || !chartRef) {
        return null
    }

    // Filter signals for this pane (main pane only)
    if (paneId !== 'main-pane') {
        return null
    }

    return (
        <div className="strategy-markers">
            {strategySignals.map((signal, index) => {
                // Calculate position based on time
                // This is a simplified version - in production you'd use the chart's time scale
                const marker = {
                    time: signal.time,
                    position: signal.type === 'buy' ? 'belowBar' : 'aboveBar',
                    color: signal.type === 'buy' ? '#26a69a' : '#ef5350',
                    shape: signal.type === 'buy' ? 'arrowUp' : 'arrowDown',
                    text: signal.type === 'buy' ? 'B' : 'S'
                }

                return (
                    <div
                        key={`${signal.time}-${index}`}
                        className={`strategy-marker strategy-marker--${signal.type}`}
                        data-time={signal.time}
                        title={`${signal.type === 'buy' ? 'Покупка' : 'Продажа'} @ ${signal.price.toFixed(2)}`}
                    >
                        {signal.type === 'buy' ? '▲' : '▼'}
                    </div>
                )
            })}
        </div>
    )
}

export default StrategyMarkers

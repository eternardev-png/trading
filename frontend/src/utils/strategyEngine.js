// Strategy Backtesting Engine
// Evaluates strategy conditions against historical data and calculates performance metrics

/**
 * Evaluates a condition against current candle data
 * @param {Object} condition - The condition to evaluate
 * @param {Object} candle - Current candle data
 * @param {Object} indicators - Calculated indicators for current candle
 * @returns {boolean} - Whether condition is met
 */
function evaluateCondition(condition, candle, indicators) {
    const { pair, operator, compareType, compareIndicator, compareValue, comparePair } = condition

    // Get left side value (current price)
    const leftValue = candle.close

    // Get right side value based on compareType
    let rightValue
    if (compareType === 'indicator') {
        rightValue = indicators[compareIndicator]
    } else if (compareType === 'value') {
        rightValue = compareValue
    } else if (compareType === 'pair') {
        // For simplicity, we'll use the same candle data
        // In a real implementation, you'd fetch data for the other pair
        rightValue = candle.close
    }

    if (rightValue === undefined || rightValue === null) {
        return false
    }

    // Evaluate operator
    switch (operator) {
        case '>': return leftValue > rightValue
        case '<': return leftValue < rightValue
        case '>=': return leftValue >= rightValue
        case '<=': return leftValue <= rightValue
        case '=': return Math.abs(leftValue - rightValue) < 0.0001
        default: return false
    }
}

/**
 * Calculate indicators for a given data point
 * @param {Array} data - Historical candle data
 * @param {number} index - Current index
 * @param {Object} indicatorConfig - Indicator configuration
 * @returns {Object} - Calculated indicator values
 */
function calculateIndicators(data, index, indicatorConfig) {
    const indicators = {}

    // Simple Moving Average (SMA)
    if (indicatorConfig.SMA) {
        const period = indicatorConfig.SMA.period || 20
        if (index >= period - 1) {
            let sum = 0
            for (let i = 0; i < period; i++) {
                sum += data[index - i].close
            }
            indicators.SMA = sum / period
        }
    }

    // Exponential Moving Average (EMA)
    if (indicatorConfig.EMA) {
        const period = indicatorConfig.EMA.period || 20
        const multiplier = 2 / (period + 1)

        if (index === period - 1) {
            // First EMA is SMA
            let sum = 0
            for (let i = 0; i < period; i++) {
                sum += data[index - i].close
            }
            indicators.EMA = sum / period
        } else if (index > period - 1 && indicatorConfig.EMA.previousEMA) {
            indicators.EMA = (data[index].close - indicatorConfig.EMA.previousEMA) * multiplier + indicatorConfig.EMA.previousEMA
        }
    }

    // RSI
    if (indicatorConfig.RSI) {
        const period = indicatorConfig.RSI.period || 14
        if (index >= period) {
            let gains = 0
            let losses = 0

            for (let i = 1; i <= period; i++) {
                const change = data[index - period + i].close - data[index - period + i - 1].close
                if (change > 0) gains += change
                else losses += Math.abs(change)
            }

            const avgGain = gains / period
            const avgLoss = losses / period
            const rs = avgGain / (avgLoss || 0.0001)
            indicators.RSI = 100 - (100 / (1 + rs))
        }
    }

    return indicators
}

/**
 * Run backtest on strategy
 * @param {Object} strategy - Strategy configuration
 * @param {Array} historicalData - Historical candle data
 * @returns {Object} - Backtest results with statistics
 */
export function runBacktest(strategy, historicalData) {
    const { settings, buyConditions, sellConditions } = strategy

    if (!historicalData || historicalData.length === 0) {
        return {
            error: 'No historical data available',
            stats: null
        }
    }

    // Initialize state
    let capital = settings.initialCapital
    let position = null // { entryPrice, size, entryTime, entryIndex }
    const trades = []
    const signals = [] // For chart display
    const equity = [] // Equity curve

    // Collect all indicators needed
    const neededIndicators = {}
        ;[...buyConditions, ...sellConditions].forEach(cond => {
            if (cond.compareType === 'indicator') {
                neededIndicators[cond.compareIndicator] = cond.compareParams || {}
            }
        })

    // Process each candle
    for (let i = 0; i < historicalData.length; i++) {
        const candle = historicalData[i]

        // Calculate indicators
        const indicators = calculateIndicators(historicalData, i, neededIndicators)

        // Store previous EMA for next iteration
        if (indicators.EMA !== undefined) {
            neededIndicators.EMA.previousEMA = indicators.EMA
        }

        // Check buy conditions
        if (!position && buyConditions.length > 0) {
            const buySignal = buyConditions.every(cond =>
                evaluateCondition(cond, candle, indicators)
            )

            if (buySignal) {
                // Calculate position size
                const firstCondition = buyConditions[0]
                let positionSize
                if (firstCondition.positionSizeType === 'percent') {
                    positionSize = capital * (firstCondition.positionSize / 100)
                } else {
                    positionSize = firstCondition.positionSize
                }

                // Apply commission
                const commission = positionSize * (settings.commission / 100)
                positionSize -= commission

                position = {
                    entryPrice: candle.close,
                    size: positionSize,
                    entryTime: candle.time,
                    entryIndex: i,
                    commission
                }

                signals.push({
                    time: candle.time,
                    type: 'buy',
                    price: candle.close,
                    size: positionSize
                })
            }
        }

        // Check sell conditions
        if (position && sellConditions.length > 0) {
            const sellSignal = sellConditions.every(cond =>
                evaluateCondition(cond, candle, indicators)
            )

            if (sellSignal) {
                // Close position
                const exitValue = position.size * (candle.close / position.entryPrice)
                const exitCommission = exitValue * (settings.commission / 100)
                const profit = exitValue - position.size - exitCommission - position.commission

                capital += exitValue - exitCommission

                trades.push({
                    entryTime: position.entryTime,
                    exitTime: candle.time,
                    entryPrice: position.entryPrice,
                    exitPrice: candle.close,
                    size: position.size,
                    profit,
                    profitPercent: (profit / position.size) * 100,
                    duration: i - position.entryIndex
                })

                signals.push({
                    time: candle.time,
                    type: 'sell',
                    price: candle.close,
                    profit
                })

                position = null
            }
        }

        // Calculate current equity
        let currentEquity = capital
        if (position) {
            currentEquity += position.size * (candle.close / position.entryPrice)
        }
        equity.push({
            time: candle.time,
            value: currentEquity
        })
    }

    // Calculate statistics
    const stats = calculateStatistics(trades, settings.initialCapital, capital, equity)

    return {
        stats,
        trades,
        signals,
        equity
    }
}

/**
 * Calculate performance statistics
 */
function calculateStatistics(trades, initialCapital, finalCapital, equity) {
    if (trades.length === 0) {
        return {
            netProfit: 0,
            netProfitPercent: 0,
            totalTrades: 0,
            winningTrades: 0,
            losingTrades: 0,
            winRate: 0,
            averageWin: 0,
            averageLoss: 0,
            profitFactor: 0,
            maxDrawdown: 0,
            maxDrawdownPercent: 0
        }
    }

    const netProfit = finalCapital - initialCapital
    const netProfitPercent = (netProfit / initialCapital) * 100

    const winningTrades = trades.filter(t => t.profit > 0)
    const losingTrades = trades.filter(t => t.profit <= 0)

    const totalWins = winningTrades.reduce((sum, t) => sum + t.profit, 0)
    const totalLosses = Math.abs(losingTrades.reduce((sum, t) => sum + t.profit, 0))

    const averageWin = winningTrades.length > 0 ? totalWins / winningTrades.length : 0
    const averageLoss = losingTrades.length > 0 ? totalLosses / losingTrades.length : 0

    const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0

    // Calculate max drawdown
    let maxEquity = initialCapital
    let maxDrawdown = 0
    let maxDrawdownPercent = 0

    equity.forEach(point => {
        if (point.value > maxEquity) {
            maxEquity = point.value
        }
        const drawdown = maxEquity - point.value
        const drawdownPercent = (drawdown / maxEquity) * 100

        if (drawdown > maxDrawdown) {
            maxDrawdown = drawdown
            maxDrawdownPercent = drawdownPercent
        }
    })

    return {
        netProfit: netProfit.toFixed(2),
        netProfitPercent: netProfitPercent.toFixed(2),
        totalTrades: trades.length,
        winningTrades: winningTrades.length,
        losingTrades: losingTrades.length,
        winRate: ((winningTrades.length / trades.length) * 100).toFixed(2),
        averageWin: averageWin.toFixed(2),
        averageLoss: averageLoss.toFixed(2),
        profitFactor: profitFactor === Infinity ? '∞' : profitFactor.toFixed(2),
        maxDrawdown: maxDrawdown.toFixed(2),
        maxDrawdownPercent: maxDrawdownPercent.toFixed(2)
    }
}

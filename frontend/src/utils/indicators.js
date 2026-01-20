/**
 * Simple Technical Indicators Calculation
 */

export const calculateIndicator = (type, data, params = {}) => {
    if (!data || data.length === 0) return []

    // Ensure data is sorted
    // Assuming data has { time, value (or close) }
    const values = data.map(d => d.value !== undefined ? d.value : d.close)
    const times = data.map(d => d.time)

    let resultValues = []

    switch (type.toUpperCase()) {
        case 'RSI':
            resultValues = calcRSI(values, params.period || 14)
            break
        case 'SMA':
            resultValues = calcSMA(values, params.period || 14) // SMA matches Moving Average
            break
        case 'EMA':
            resultValues = calcEMA(values, params.period || 14)
            break
        default:
            return []
    }

    // Map back to { time, value }
    return resultValues.map((val, i) => {
        // RSI/SMA usually start after period. Padded with null/NaN?
        // We should align with original times. 
        // If result is shorter, it aligns from end? No, usually from start with nulls.
        if (val === null || val === undefined) return null
        return {
            time: times[i],
            value: val
        }
    }).filter(d => d !== null)
}

const calcSMA = (data, period) => {
    const results = new Array(data.length).fill(null)
    for (let i = period - 1; i < data.length; i++) {
        let sum = 0
        for (let j = 0; j < period; j++) {
            sum += data[i - j]
        }
        results[i] = sum / period
    }
    return results
}

const calcEMA = (data, period) => {
    const results = new Array(data.length).fill(null)
    const k = 2 / (period + 1)

    // First EMA is SMA
    let sum = 0
    for (let i = 0; i < period; i++) {
        sum += data[i]
    }
    results[period - 1] = sum / period

    for (let i = period; i < data.length; i++) {
        results[i] = (data[i] - results[i - 1]) * k + results[i - 1]
    }
    return results
}

const calcRSI = (data, period) => {
    const results = new Array(data.length).fill(null)
    let gains = 0
    let losses = 0

    // First period
    for (let i = 1; i <= period; i++) {
        const change = data[i] - data[i - 1]
        if (change > 0) gains += change
        else losses += Math.abs(change)
    }

    let avgGain = gains / period
    let avgLoss = losses / period

    // First RSI
    let rs = avgGain / avgLoss
    results[period] = 100 - (100 / (1 + rs))

    // Subsequent
    for (let i = period + 1; i < data.length; i++) {
        const change = data[i] - data[i - 1]
        let gain = change > 0 ? change : 0
        let loss = change < 0 ? Math.abs(change) : 0

        avgGain = (avgGain * (period - 1) + gain) / period
        avgLoss = (avgLoss * (period - 1) + loss) / period

        if (avgLoss === 0) {
            results[i] = 100
        } else {
            rs = avgGain / avgLoss
            results[i] = 100 - (100 / (1 + rs))
        }
    }
    return results
}

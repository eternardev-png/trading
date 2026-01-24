const API_BASE = 'http://127.0.0.1:8000/api/v1'

const OPERATORS_REGEX = /[\+\-\*\/\(\)]/

/**
 * Validates if a string is a standard ticker (not a math expression)
 * This is a heuristic.
 */
function isStandardTicker(ticker) {
    // If it's a known format like "BTC/USDT", we treat it as standard first.
    // If it contains spaces or multiple operators or parenthesis, it's likely math.
    if (ticker.includes(' ') || ticker.includes('(') || ticker.includes(')')) return false
    return true
}

/**
 * Fetches data for a single ticker from the API.
 */
async function fetchRawData(ticker, timeframe, toTimestamp) {
    try {
        let url = `${API_BASE}/data?ticker=${encodeURIComponent(ticker)}&timeframe=${timeframe}`
        if (toTimestamp) {
            url += `&to_timestamp=${toTimestamp}`
        }
        const res = await fetch(url)
        if (!res.ok) return null
        const json = await res.json()
        if (json.data && json.data.length > 0) {
            // Sort just in case
            return json.data.sort((a, b) => a.time - b.time)
        }
        return null
    } catch (e) {
        console.warn(`Fetch failed for ${ticker}`, e)
        return null
    }
}

/**
 * Aligns multiple data series to a common timeline (intersection).
 * Basic alignment: intersection of times.
 */
function alignData(seriesMap) {
    const keys = Object.keys(seriesMap)
    if (keys.length === 0) return []

    // Find intersection of times
    // 1. Get all unique times from all series? Or intersection?
    // Math usually requires values for all operands. So intersection.

    // Start with times of the first series
    let commonTimes = new Set(seriesMap[keys[0]].map(d => d.time))

    for (let i = 1; i < keys.length; i++) {
        const sTimes = new Set(seriesMap[keys[i]].map(d => d.time))
        // Intersect
        commonTimes = new Set([...commonTimes].filter(x => sTimes.has(x)))
    }

    const sortedTimes = Array.from(commonTimes).sort((a, b) => a - b)

    // Map back to value structure
    // We only support Close price math for now? Or OHLC?
    // OHLC math is complex (e.g. High = Max(H1, H2)? No, High of (A/B) is tricky).
    // Simplification: Calculate on Close, set O=H=L=Close.
    // Or better: Calculate on Open, High, Low, Close separately if possible.
    // But division of High/High might not be the true High of the ratio.
    // Standard approach: Apply op to Close. Set others to Close.

    return sortedTimes.map(time => {
        const point = { time }
        keys.forEach(k => {
            const p = seriesMap[k].find(d => d.time === time)
            point[k] = p
        })
        return point
    })
}

/**
 * Main function to get data for a ticker string (simple or math).
 */
/**
 * Main function to get data for a ticker string (simple or math).
 * Delegates entirely to the Backend Synthetic Engine.
 */
export async function resolveTickerData(expression, timeframe, toTimestamp) {
    // 1. Try fetching from backend (which covers both standard tickers and formulas)
    const data = await fetchRawData(expression, timeframe, toTimestamp)

    if (data && data.length > 0) {
        return data
    }

    console.warn(`Backend returned no data for: ${expression}`)
    return []
}

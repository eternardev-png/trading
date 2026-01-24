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
async function fetchRawData(ticker, timeframe) {
    try {
        const url = `${API_BASE}/data?ticker=${encodeURIComponent(ticker)}&timeframe=${timeframe}`
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
export async function resolveTickerData(expression, timeframe) {
    // 1. Try fetching as-is
    const rawArgs = await fetchRawData(expression, timeframe)
    if (rawArgs) return rawArgs

    // 2. If failed, try parsing as math
    // Extract logical tokens (tickers)
    // Split by operators
    const tokens = expression.split(/[\+\-\*\/\(\)\s]+/).filter(t => t && !/^\d+(\.\d+)?$/.test(t))

    if (tokens.length === 0) return [] // No tickers? maybe just "2+2"? Not supported or return constant?

    // Fetch Unique Tickers
    const uniqueTickers = [...new Set(tokens)]
    const dataMap = {}

    for (const t of uniqueTickers) {
        let d = await fetchRawData(t, timeframe)

        // Fallback: Try appending /USDT or USDT if raw ticker fails
        if (!d || d.length === 0) {
            // Try "T/USDT"
            d = await fetchRawData(`${t}/USDT`, timeframe)
        }
        if (!d || d.length === 0) {
            // Try "TUSDT"
            d = await fetchRawData(`${t}USDT`, timeframe)
        }

        if (!d || d.length === 0) {
            console.warn(`Could not resolve component ticker: ${t}`)
            return [] // Fail if any component missing
        }
        dataMap[t] = d
    }

    // Align
    const alignedRows = alignData(dataMap)

    // Compute result for each row
    const resultSeries = alignedRows.map(row => {
        // Create an evaluation context
        // Replace tickers in expression with actual values from 'row'
        // We need to robustly replace.
        // Sort tokens by length desc to avoid substring replacement of subsets
        // e.g. "ETH" and "ETHUSDT" -> replace "ETHUSDT" first
        const sortedTokens = [...uniqueTickers].sort((a, b) => b.length - a.length)

        // We will calc OHLC separately? Or just Close?
        // Let's do Close only for now to be safe.
        // Construct code for eval?
        // Safety: ensure expression contains only valid chars.

        let expr = expression

        // Replace tickers with values
        // We can't simple replace string because "BTC" matches "BTCUSDT".
        // Regex with boundaries? Tickes might contain / or - so \b is tricky.
        // Better: iterate tokens relative to parsed positions?
        // Or simple replace if we trust specific unique tickers.

        // Safe Eval: new Function with args.
        // Generate function with args matching tickers.
        // func(BTC, ETH) { return BTC / ETH }

        const args = sortedTokens
        const funcBody = "return " + expression;
        // Wait, expression "BTC/ETH" -> variable names "BTC/ETH" is invalid JS.
        // We must map tickers to valid var names 'var0', 'var1'.

    })

    // ... Revisiting Eval Strategy ...

    // Token extraction provided us uniqueTickers.
    // Map each ticker to a varName 'v0', 'v1', etc.
    const varMap = {}
    uniqueTickers.forEach((t, i) => { varMap[t] = `v${i}` })

    // Reconstruct expression with varNames
    // We need to tokenize expression preserving operators, then map tokens.
    // Regex split with capture groups includes separators.
    const parts = expression.split(/([\+\-\*\/\(\)\s]+)/)
    const newExprParts = parts.map(p => {
        if (!p.trim()) return p
        if (/^[\+\-\*\/\(\)]+$/.test(p)) return p
        if (/^\d+(\.\d+)?$/.test(p)) return p
        // It's a ticker
        if (varMap[p] !== undefined) return varMap[p]
        return p // Should catch known ones, else weird
    })
    const newExpr = newExprParts.join('')

    // Create function
    let calcFunc
    try {
        calcFunc = new Function(...Object.values(varMap), `return ${newExpr}`)
    } catch (e) {
        console.error("Invalid math expression", e)
        return []
    }

    // Map rows
    return alignedRows.map(row => {
        const argValues = uniqueTickers.map(t => row[t].close) // Use Close price
        let val
        try {
            val = calcFunc(...argValues)
        } catch (e) { val = 0 }

        return {
            time: row.time,
            open: val,
            high: val,
            low: val,
            close: val,
            volume: 0
        }
    })
}

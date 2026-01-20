import { create, all } from 'mathjs'

// Create mathjs instance with all functions
const math = create(all)

/**
 * Parse a formula string and extract ticker symbols
 * Example: "BTCUSD / ETHUSD" -> ["BTCUSD", "ETHUSD"]
 */
export function extractTickers(formula) {
    // Match ticker patterns (letters, numbers, /, :, -)
    const tickerPattern = /[A-Z][A-Z0-9\/\:\-]+/gi
    const matches = formula.match(tickerPattern) || []

    // Filter out operators and duplicates
    const operators = ['AND', 'OR', 'NOT']
    const tickers = [...new Set(
        matches.filter(m => !operators.includes(m.toUpperCase()))
    )]

    return tickers
}

/**
 * Normalize data arrays by timestamp
 * Returns merged dataset with aligned timestamps
 */
export function normalizeByTimestamp(datasets) {
    // datasets = { "BTC/USDT": [...], "ETH/USDT": [...] }

    // Collect all unique timestamps
    const allTimestamps = new Set()
    Object.values(datasets).forEach(data => {
        data.forEach(candle => allTimestamps.add(candle.time))
    })

    // Sort timestamps
    const sortedTimestamps = [...allTimestamps].sort((a, b) => a - b)

    // Create lookup maps for each dataset
    const lookups = {}
    Object.entries(datasets).forEach(([ticker, data]) => {
        lookups[ticker] = new Map(data.map(d => [d.time, d]))
    })

    // Merge: only keep timestamps where ALL tickers have data
    const merged = []
    sortedTimestamps.forEach(time => {
        const hasAll = Object.keys(datasets).every(ticker => lookups[ticker].has(time))
        if (hasAll) {
            const entry = { time }
            Object.keys(datasets).forEach(ticker => {
                entry[ticker] = lookups[ticker].get(time)
            })
            merged.push(entry)
        }
    })

    return merged
}

/**
 * Calculate synthetic OHLC from formula
 * Example: "BTC/USDT / ETH/USDT" with merged data
 */
export function calculateSynthetic(formula, mergedData) {
    // Replace ticker names with placeholder variables
    const tickers = extractTickers(formula)

    // Build sanitized formula (replace / in ticker names with _)
    let safeFormula = formula
    const tickerMap = {}
    tickers.forEach((ticker, i) => {
        const varName = `ticker_${i}`
        tickerMap[ticker] = varName
        // Escape special chars in ticker for regex
        const escaped = ticker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        safeFormula = safeFormula.replace(new RegExp(escaped, 'g'), varName)
    })

    // Compile the formula
    let compiled
    try {
        compiled = math.compile(safeFormula)
    } catch (e) {
        console.error('Failed to compile formula:', e)
        return []
    }

    // Calculate for each timestamp
    const result = mergedData.map(entry => {
        const scope = {}

        // Use close prices for calculation
        tickers.forEach(ticker => {
            scope[tickerMap[ticker]] = entry[ticker]?.close || 0
        })

        try {
            const value = compiled.evaluate(scope)

            // For full OHLC, calculate with each price component
            const scopeOpen = { ...scope }
            const scopeHigh = { ...scope }
            const scopeLow = { ...scope }

            tickers.forEach(ticker => {
                scopeOpen[tickerMap[ticker]] = entry[ticker]?.open || 0
                scopeHigh[tickerMap[ticker]] = entry[ticker]?.high || 0
                scopeLow[tickerMap[ticker]] = entry[ticker]?.low || 0
            })

            return {
                time: entry.time,
                open: compiled.evaluate(scopeOpen),
                high: compiled.evaluate(scopeHigh),
                low: compiled.evaluate(scopeLow),
                close: value
            }
        } catch (e) {
            return null
        }
    }).filter(Boolean)

    return result
}

/**
 * Check if a string is a formula (contains operators with spaces or multiple operators)
 * "BTC/USDT" -> false (just a ticker)
 * "BTC/USDT / ETH/USDT" -> true (formula with spaces around operator)
 * "BTC/USDT * 2" -> true (formula)
 */
export function isFormula(input) {
    // Check for operators with spaces around them (formula pattern)
    if (/\s[\+\-\*\/]\s/.test(input)) return true

    // Check for math operators followed by numbers
    if (/[\+\-\*]\s*\d/.test(input)) return true

    // Check for parentheses (always formula)
    if (/[\(\)]/.test(input)) return true

    // Check if there are multiple "ticker-like" patterns separated by operators
    // e.g., BTCUSD / ETHUSD (no slash in ticker names)
    const tickerCount = (input.match(/[A-Z]{3,}/gi) || []).length
    const operatorCount = (input.match(/\s[\+\-\*\/]\s/g) || []).length
    if (tickerCount > 1 && operatorCount > 0) return true

    return false
}

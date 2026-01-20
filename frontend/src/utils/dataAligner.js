/**
 * Aligns slaveData to match the timeline of masterData.
 * Adds empty/whitespace bars to slaveData for timestamps present in masterData
 * but missing in slaveData (specifically before the start of slaveData).
 * 
 * @param {Array} masterData - The main series data (e.g. BTC) [{time, open, ...}, ...]
 * @param {Array} slaveData - The secondary series data (e.g. Altcoin) [{time, value/open, ...}, ...]
 * @returns {Array} - New array for slaveData with padding
 */
export const alignSeriesData = (masterData, slaveData) => {
    if (!masterData || masterData.length === 0) return slaveData || []
    if (!slaveData || slaveData.length === 0) return []

    const masterStartTime = masterData[0].time
    const slaveStartTime = slaveData[0].time

    // If slave starts after master, we need to pad
    if (slaveStartTime > masterStartTime) {
        const padding = []

        // Find all master times before slave starts
        for (let i = 0; i < masterData.length; i++) {
            const time = masterData[i].time
            if (time >= slaveStartTime) break

            // Add empty bar. 
            // For Candle/Bar series: { time, open: NaN, ... } or just { time } ?
            // Lightweight charts handles { time } as whitespace if no value?
            // Or explicit whitespace: { time, whitespace: true } (not standard API, usually treated as gap if missing)
            // But if we want to maintain Index alignment, we MUST have a data point.
            // Using { time, value: undefined } might work for Line/Histogram.
            // For Candles: { time, open: undefined ... } ?
            // Safest: { time } might be skipped. 
            // Better: { time, value: NaN } or { time: ... } and hope chart treats as empty.
            // Actually, for alignment logic in logical index, we just need the item in the array.

            // Let's use a generic empty object with time.
            padding.push({ time })
        }

        return [...padding, ...slaveData]
    }

    // If slave starts before master? (Rare for crypto vs BTC, but possible)
    // We might want to slice slave? Or pad master?
    // Usually Master determines the range. 
    // Let's assume Master is the reference.

    return slaveData
}


/**
 * Utility functions for coordinate conversions in Lightweight Charts
 * Handles off-screen coordinates by using manual Data Index lookup since timeToLogical is not exposed.
 */

// Helper to find logical index (data index) for a given time
// Essential for Measure tool (counting bars) and off-screen coordinates
export const getLogicalIndex = (time, chart, data = []) => {
    if (!chart) return null
    const timeScale = chart.timeScale()

    // 1. Try to get coordinate first
    const coordinate = timeScale.timeToCoordinate(time)
    if (coordinate !== null) {
        const logical = timeScale.coordinateToLogical(coordinate)
        if (logical !== null) return logical
    }

    // 2. Fallback: Find in data (Exact match)
    if (data.length > 0) {
        // Optimized search could be better, but findIndex is ok for small data
        // For larger datasets, binary search recommended.

        // Try exact match
        const index = data.findIndex(d => d.time === time)
        if (index !== -1) return index

        // 3. Extrapolation (for Future/Past times not in data)
        // If we are here, timeToCoordinate failed (likely off screen or no match) 
        // AND exact match failed.
        // We need to estimate logical index based on time difference.
        if (data.length > 1 && typeof time === 'number') {
            const lastIdx = data.length - 1
            const lastTime = data[lastIdx].time
            const firstTime = data[0].time

            // Calculate step from last 2 candles (assuming roughly uniform)
            const t2 = data[lastIdx].time
            const t1 = data[lastIdx - 1].time
            let step = t2 - t1
            if (step <= 0) step = 60 // Fallback

            if (time > lastTime) {
                // Future
                const diffTime = time - lastTime
                const diffIdx = diffTime / step
                return lastIdx + diffIdx // Return float index
            } else if (time < firstTime) {
                // Past
                const diffTime = time - firstTime
                const diffIdx = diffTime / step
                return diffIdx // Negative float index
            } else {
                // In between data range but missing (gaps)?
                // Try to interpolate
                // Find nearest?
                // For now return null or try to binary search nearest.
                // Let's rely on standard assumption: if in range, exact match usually found or chart handles it.
                // But for robust dragging, let's extrapolate from start?
                const diffTime = time - firstTime
                const diffIdx = diffTime / step
                return diffIdx
            }
        }
    }
    return null
}

// Convert { time, price } to { x, y }
// Added 'data' argument to find index for off-screen points
export const pointToCoordinates = (point, chart, series, data = []) => {
    if (!chart || !series || !point) return null

    const timeScale = chart.timeScale()

    // 1. Time -> X
    // Try standard API First (works if visible)
    let x = timeScale.timeToCoordinate(point.time)

    // If null (off-screen), try to find logical index from Data
    if (x === null) {
        // Reuse helper
        const logical = getLogicalIndex(point.time, chart, data)
        if (logical !== null) {
            x = timeScale.logicalToCoordinate(logical)
        }
    }

    // If x is still null, but we calculated it above, it should be fine.
    // If x is null here, it means we couldn't map time to space.
    if (x === null || x === undefined) return null

    // 2. Price -> Y
    const y = series.priceToCoordinate(point.price)

    if (y === null) return null

    return { x, y }
}

// Convert { x, y } to { time, price }
// UPDATED: Now accepts 'data' for extrapolation
export const coordinatesToPoint = (coords, chart, series, data = []) => {
    if (!chart || !series || !coords) return null

    const timeScale = chart.timeScale()

    // 1. X -> Time
    let time = timeScale.coordinateToTime(coords.x)

    // If standard API returns null (out of bounds), use logical index + data extrapolation
    if (time === null) {
        const logical = timeScale.coordinateToLogical(coords.x)
        if (logical !== null && data.length > 1) {
            // We have logical index.
            const idx = Math.round(logical)
            if (data[idx]) {
                time = data[idx].time
            } else {
                // Extrapolate
                const lastIdx = data.length - 1
                const t2 = data[lastIdx].time
                const t1 = data[lastIdx - 1].time
                // Ensure numeric timestamps
                if (typeof t2 === 'number' && typeof t1 === 'number') {
                    const step = t2 - t1
                    const diff = logical - lastIdx
                    time = t2 + diff * step
                } else if (idx < 0 && typeof data[0].time === 'number') {
                    // Past extrapolation
                    const tStart = data[0].time
                    const tNext = data[1].time
                    const step = tNext - tStart
                    time = tStart + (logical) * step // logical is negative
                }
            }
        }
    }

    if (time === null) return null

    // 2. Y -> Price
    const price = series.coordinateToPrice(coords.y)

    if (price === null) {
        // Fallback: manual calculation if we knew scale bounds. 
        return null
    }

    return { time, price }
}

export const getMainSeries = (seriesConfigs, seriesMap) => {
    if (!seriesConfigs || seriesConfigs.length === 0 || !seriesMap || !seriesMap.current) return null
    // Prioritize 'candle' (Main) series, then any main, then first
    const mainConfig = seriesConfigs.find(s => s.chartType === 'candle') || seriesConfigs.find(s => s.isMain) || seriesConfigs[0]
    return seriesMap.current[mainConfig.id]
}

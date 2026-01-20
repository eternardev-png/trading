
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

    // 2. Fallback: Find in data
    if (data.length > 0) {
        const index = data.findIndex(d => d.time === time)
        if (index !== -1) return index
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

    // If still null/undefined (time not in data?), we can't draw it.
    if (x === null || x === undefined) return null

    // 2. Price -> Y
    const y = series.priceToCoordinate(point.price)

    if (y === null) return null

    return { x, y }
}

// Convert { x, y } to { time, price }
export const coordinatesToPoint = (coords, chart, series) => {
    if (!chart || !series || !coords) return null

    const timeScale = chart.timeScale()

    // 1. X -> Time
    // coordinateToTime works for screen coords
    const time = timeScale.coordinateToTime(coords.x)
    if (time === null) return null

    // 2. Y -> Price
    const price = series.coordinateToPrice(coords.y)
    if (price === null) return null

    return { time, price }
}

export const getMainSeries = (seriesConfigs, seriesMap) => {
    if (!seriesConfigs || seriesConfigs.length === 0 || !seriesMap || !seriesMap.current) return null
    // Prioritize 'candle' (Main) series, then any main, then first
    const mainConfig = seriesConfigs.find(s => s.chartType === 'candle') || seriesConfigs.find(s => s.isMain) || seriesConfigs[0]
    return seriesMap.current[mainConfig.id]
}

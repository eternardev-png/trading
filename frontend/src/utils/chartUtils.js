/**
 * Safely merges two arrays of chart data (e.g. historical and current).
 * - Deduplicates by 'time' property.
 * - Filters out invalid data (missing time, null prices).
 * - Sorts by time ascending.
 * 
 * @param {Array} data1 - First array (e.g. new history)
 * @param {Array} data2 - Second array (e.g. current data)
 * @returns {Array} - Cleaned, sorted, unique array.
 */
export function mergeAndSortData(data1, data2) {
    const uniqueData = new Map();

    // Helper to add valid items
    const add = (item) => {
        if (!item) return;

        // 1. Validate Time
        if (item.time === undefined || item.time === null) return;

        // 2. Validate Values (Candle or Line inputs)
        // If it's a candle, check OHLC. If line, check value.
        // We permit 0 but reject null/undefined/NaN.

        // Check for Candle props
        if ('open' in item) {
            if (item.open == null || item.high == null || item.low == null || item.close == null) return;
            if (isNaN(Number(item.open)) || isNaN(Number(item.close))) return;
        }
        // Check for Line/Histogram 'value'
        else if ('value' in item) {
            if (item.value == null || isNaN(Number(item.value))) return;
        }

        // Use time as key to deduplicate.
        // If time is object (business day), normalize to string key for Map.
        const key = typeof item.time === 'object'
            ? `${item.time.year}-${item.time.month}-${item.time.day}`
            : item.time;

        uniqueData.set(key, item);
    };

    if (Array.isArray(data1)) data1.forEach(add);
    if (Array.isArray(data2)) data2.forEach(add);

    return Array.from(uniqueData.values())
        .sort((a, b) => {
            const timeA = typeof a.time === 'object'
                ? (a.time.year * 10000 + a.time.month * 100 + a.time.day)
                : a.time;
            const timeB = typeof b.time === 'object'
                ? (b.time.year * 10000 + b.time.month * 100 + b.time.day)
                : b.time;
            return timeA - timeB;
        });
}

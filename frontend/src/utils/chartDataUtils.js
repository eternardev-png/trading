/**
 * Safely merges two arrays of chart data (e.g. historical and current).
 * - Deduplicates by 'time' property.
 * - Filters out invalid data (missing time, null prices).
 * - Sorts by time ascending.
 * 
 * @param {Array} currentData - The existing data array (priority)
 * @param {Array} newData - The new data array (e.g. history)
 * @returns {Array} - Cleaned, sorted, unique array.
 */
export function mergeAndSortData(currentData, newData) {
    if (!currentData) currentData = [];
    if (!newData) newData = [];

    const dataMap = new Map();

    // Helper for validation
    const isValid = (item) => {
        if (!item) return false;

        // Time is mandatory
        if (item.time === undefined || item.time === null) return false;

        // If it's a Candle (has 'open'), validate OHLC
        if (item.open !== undefined) {
            return (
                item.open != null &&
                item.high != null &&
                item.low != null &&
                item.close != null &&
                !isNaN(Number(item.open)) &&
                !isNaN(Number(item.high)) &&
                !isNaN(Number(item.low)) &&
                !isNaN(Number(item.close))
            );
        }

        // If it's a Line/Histogram (has 'value'), validate value
        if (item.value !== undefined) {
            return item.value != null && !isNaN(Number(item.value));
        }

        // If it's a Volume-only point (custom logic often puts volume in main data)
        if (item.volume !== undefined) {
            return !isNaN(Number(item.volume));
        }

        // AUTO-DETECT FAILED: No recognizable value fields (open/value/volume).
        // Treat as invalid to prevent renderer crashes.
        return false;
    };

    // 1. Add NEW data (History)
    // We iterate history first.
    if (Array.isArray(newData)) {
        newData.forEach(item => {
            if (isValid(item)) {
                // Normalize time key if needed (object vs int), but usually consistent from one source
                const key = typeof item.time === 'object'
                    ? `${item.time.year}-${item.time.month}-${item.time.day}`
                    : item.time;
                dataMap.set(key, item);
            }
        });
    }

    // 2. Add CURRENT data (Existing)
    // This overwrites history if keys match, ensuring live updates/edits persist.
    if (Array.isArray(currentData)) {
        currentData.forEach(item => {
            if (isValid(item)) {
                const key = typeof item.time === 'object'
                    ? `${item.time.year}-${item.time.month}-${item.time.day}`
                    : item.time;
                dataMap.set(key, item);
            }
        });
    }

    // 3. Sort
    return Array.from(dataMap.values())
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

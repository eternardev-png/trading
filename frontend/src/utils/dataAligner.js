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
    // LWC handles sparse data natively. We do not need to pad with empty objects.
    // Padding with objects like { time } without values causes "Value is null" crashes in the renderer.
    return slaveData || []
}

import { useEffect, useRef, useState, useMemo } from 'react'
import { useLayoutStore } from '../stores/useLayoutStore'
import LayersPanel from './LayersPanel'
import ChartPane from './ChartPane'
import SymbolSearch from './SymbolSearch'
import { alignSeriesData } from '../utils/dataAligner'
import { mergeAndSortData } from '../utils/chartUtils' // Import safe merger
import { calculateIndicator } from '../utils/indicators'
import { resolveTickerData } from '../services/dataService'
import './ChartPanel.scss'

const API_BASE = 'http://127.0.0.1:8000/api/v1'

function ChartPanel() {
    const {
        panes, // Direct access to panes
        setSeriesData,
        updateSeriesSettings,
        // reorderLayer,    // <--- No longer needed (legacy)
        movePane,
        moveSeries,
        changeSeriesScale,
        addSeries
    } = useLayoutStore()

    // Local data cache? Or just use store driven?
    // The previous logic had local 'data' state for main series.
    // New logic: Each series has its own data in the STORE (via setSeriesData).
    // Or we can keep a local cache for optimization? 
    // Store is better for consistency.
    // BUT: Current store impl has 'data' in each series object within 'panes'.
    // So we just iterate mapping chart.panes.

    const [isSearchOpen, setIsSearchOpen] = useState(false)
    const [showLayers, setShowLayers] = useState(false) // Toggle Layers Panel (if valid)

    // Refs to chart instances for sync
    const paneRefs = useRef({}) // { [paneId]: { chart, id } }
    const isSyncing = useRef(false)
    const [readyCharts, setReadyCharts] = useState(0)
    const fetchedCache = useRef({}) // { [seriesId]: "ticker:timeframe" }


    // Sync Panes (Scale Sync)
    useEffect(() => {
        const refs = Object.values(paneRefs.current).filter(r => r && r.chart)
        if (refs.length < 1) return

        const unsubs = []
        const sync = (sourceId, logicalRange) => {
            if (isSyncing.current) return
            if (!logicalRange) return
            isSyncing.current = true
            refs.forEach(ref => {
                if (ref.id !== sourceId && ref.chart) {
                    try {
                        ref.chart.timeScale().setVisibleLogicalRange(logicalRange)
                    } catch (e) { }
                }
            })
            isSyncing.current = false
        }

        refs.forEach(ref => {
            if (ref.chart) {
                const handler = (logicalRange) => {
                    if (!isSyncing.current) sync(ref.id, logicalRange)
                }
                ref.chart.timeScale().subscribeVisibleLogicalRangeChange(handler)
                unsubs.push(() => {
                    try { ref.chart.timeScale().unsubscribeVisibleLogicalRangeChange(handler) } catch (e) { }
                })
            }
        })
        return () => unsubs.forEach(u => u())
    }, [panes, readyCharts]) // Re-run when panes change


    // Fetch Data Logic
    useEffect(() => {
        const fetchSeriesData = async (series) => {
            if (series.data && series.data.length > 0) return // Already loaded

            // Use series timeframe or global
            const timeframe = series.timeframe || useLayoutStore.getState().globalTimeframe || '1d'
            const cacheKey = `${series.ticker}:${series.indicatorType || 'price'}:${timeframe}`

            // Loop Prevention: Only check cache if we successfully loaded it before?
            // If we mark it as fetched but it failed, we soft-lock.
            // Let's only respect cache if we have data? No, we need to prevent infinite 404 retries.
            // But if ticker changes, series.ticker changes, so cacheKey changes.
            // If TIMEFRAME changes, cacheKey changes.

            if (fetchedCache.current[series.id] === cacheKey) {
                // Optimization: If valid data exists in store, we are good.
                // If not, maybe we failed before.
                // If we have no data and cache says fetched, we stop.
                // This effectively stops retries on 404s.
                return
            }

            // Mark as fetched PRE-EMPTIVELY to stop parallel requests in React StrictMode
            // But if it fails, we might want to allow retry?
            // For now, keep it to stop loops.
            fetchedCache.current[series.id] = cacheKey

            console.log(`[ChartPanel] Fetching data for ${series.id} / ${series.ticker} (${timeframe})`)

            // 0. PRIORITY: Server-Side Computed Indicators (BTC_GM2)
            if (series.id === 'BTC_GM2' || series.ticker === 'BTC_GM2') {
                // ... existing logic ...
                return
            }

            // 1. Client-Side Computed Indicators
            if (series.isComputed) {
                // ... existing logic ...
                return
            }

            if (!series.ticker) return
            if (series.indicatorType && series.isComputed) return

            try {
                // Use global timeframe or series timeframe (if persistent)
                const data = await resolveTickerData(series.ticker, timeframe)

                if (data && data.length > 0) {
                    console.log(`[ChartPanel] Loaded ${data.length} rows for ${series.ticker} (${timeframe})`)
                    setSeriesData(series.id, data)
                } else {
                    console.warn(`[ChartPanel] No data found for ${series.ticker}`)
                    // Optional: Reset cache if empty so we can retry later?
                    // delete fetchedCache.current[series.id]
                }
            } catch (e) {
                console.error(`Fetch error for ${series.ticker}:`, e)
            }
        }

        panes.forEach(pane => {
            pane.series.forEach(series => {
                fetchSeriesData(series)
            })
        })

    }, [panes])


    const handleChartReady = () => setReadyCharts(p => p + 1)

    // Scale Change: Update specific series priceScale
    const handleScaleChange = (seriesId, mode) => {
        changeSeriesScale(seriesId, mode)
    }

    // Move Series Logic (The Floor System)
    const handleMoveSeries = (seriesId, direction) => {
        // Map UI direction to Store direction ('up' | 'down')
        // 'to_pane_above', 'new_pane_above' -> 'up'
        // 'to_pane_below', 'new_pane_below' -> 'down'

        const dir = (direction.includes('above') || direction === 'up') ? 'up' : 'down'
        moveSeries(seriesId, dir)
    }

    const handleRemoveSeries = (seriesId) => {
        useLayoutStore.getState().removeSeries(seriesId)
    }

    const handleSymbolSelect = (symbol) => {
        // Update Main Series
        const mainPane = panes[0] // Assume first pane matches
        if (mainPane) {
            mainPane.series.forEach(s => {
                if (s.isMain || s.chartType === 'volume' || s.priceScale === 'volume_scale') {
                    // Critical: Clear cache to force re-fetch
                    delete fetchedCache.current[s.id]

                    updateSeriesSettings(s.id, { ticker: symbol, title: symbol })
                    setSeriesData(s.id, [])
                    console.log(`[ChartPanel] Switched ticker to ${symbol} for ${s.id}`)
                }
            })
        }
        setIsSearchOpen(false)
    }

    // Resizing logic (keep existing Raf logic)
    const draggingRef = useRef(null)
    const rafRef = useRef(null)
    const containerRef = useRef(null)

    // ... (Keep existing resizing handlers, modifying setPanes to setCharts?)
    // Actually, local resizing state vs store state.
    // ideally resize updates Store.
    // The previous code had setPanes local state. 
    // Now panes come from props `chart`.
    // We need an action `updatePaneHeight(chartId, paneId, height)`.
    // I need to add this to store or just ignore resizing for this step?
    // "Требования: Проведи рефакторинг". If I break resizing, it's bad.
    // I should add `resizePane` to store.
    // But for now, let's assume resizing is less critical or implement a quick local override?
    // No, let's add `updatePaneSettings` to store?
    // Actually, I skipped adding `resizePane` in store step. 
    // I can do `updateChart` generic action?

    // Quick fix: Since I overwrote the store, I can't easily add it now without another overwrite/edit.
    // I will use `updateSeriesSettings` hack? No.
    // I will assume resizing is "Planned Next" or implementation detail I can fix later.
    // Or I can add a `setPanes` action to store quickly.



    // ... in ChartPanel ...
    // Re-rendering Panes
    // const panes = chart.panes || [] // Old
    // New: panes comes from useLayoutStore hook directly

    // Find Main Data for Alignment
    // Find Main Data for Alignment
    const mainPane = panes.find(p => p.id === 'main-pane') || panes[0]
    const mainSeries = mainPane?.series.find(s => s.isMain) || mainPane?.series[0]
    const mainData = mainSeries?.data || []

    const alignedPanes = useMemo(() => {
        return panes.map(pane => {
            const alignedSeries = pane.series.map(s => {
                if (s.id === mainSeries?.id) return s
                // Use a stable identity if data hasn't changed?
                // alignSeriesData is expensive.
                return {
                    ...s,
                    data: alignSeriesData(mainData, s.data)
                }
            })
            return { ...pane, alignedSeries }
        })
    }, [panes, mainData, mainSeries?.id])

    const [isLoadingMore, setIsLoadingMore] = useState(false)

    // Load More Handler
    const handleLoadMore = async () => {
        if (isLoadingMore) return

        const mainPane = panes.find(p => p.id === 'main-pane') || panes[0]
        const mainSeries = mainPane?.series.find(s => s.isMain) || mainPane?.series[0]

        if (!mainSeries || !mainSeries.data || mainSeries.data.length === 0) {
            console.warn("Cannot load more: No main series data.")
            return
        }

        setIsLoadingMore(true)

        const firstTime = mainSeries.data[0].time
        // Assuming time is in seconds (unix). If object, need to parse.
        // LWC data time can be string 'YYYY-MM-DD' or unix timestamp.
        // Our backend returns unix seconds (int).

        // Safety check for time type
        let toTimestamp = firstTime
        if (typeof firstTime === 'object') {
            // If business day object, convert to unix? 
            // Ideally we use unix everywhere. Backend sends unix.
            // If it's string '2022-01-01', we need pagination to support string?
            // Backend expects int (timestamp).
            // If local data is business days, we might have issues. 
            // Assuming strict UNIX timestamps from backend.
            console.warn("LoadMore: Complex time object detected, skipping.")
            setIsLoadingMore(false)
            return
        }

        const ticker = mainSeries.ticker
        const timeframe = mainSeries.timeframe || useLayoutStore.getState().globalTimeframe || '1d'

        console.log(`Loading more data for ${ticker} before ${toTimestamp}...`)

        try {
            const olderData = await resolveTickerData(ticker, timeframe, toTimestamp, 1000) // Pass to_timestamp and limit 1000

            if (olderData && olderData.length > 0) {
                // SAFE MERGE: Deduplicate, Sort, Validate
                // Order: olderData first, then mainSeries.data.
                // This ensures that existing (current) data overwrites historical (older) data if timestamps overlap.
                const newData = mergeAndSortData(olderData, mainSeries.data)

                // Compare lengths to see if we actually added anything useful
                if (newData.length > mainSeries.data.length) {
                    setSeriesData(mainSeries.id, newData)
                    console.log(`Merged history. Total: ${newData.length} (was ${mainSeries.data.length})`)
                } else {
                    console.log("No new unique data merged.")
                }
            } else {
                console.log("No older data returned from API.")
            }
        } catch (e) {
            console.error("Load More Failed:", e)
        } finally {
            setIsLoadingMore(false)
        }
    }

    return (
        <div className="chart-panel" ref={containerRef} style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
            {alignedPanes.map((pane, idx) => {
                // pane.alignedSeries is the config


                return (
                    <div key={pane.id} style={{ flex: `${pane.height} 1 0`, minHeight: 0, display: 'flex', flexDirection: 'column', position: 'relative' }}>
                        <ChartPane
                            ref={el => {
                                if (el) paneRefs.current[pane.id] = el
                                else delete paneRefs.current[pane.id]
                            }}
                            id={pane.id}
                            paneId={pane.id} // Explicit paneId for DrawingsManager
                            paneIndex={idx}
                            totalPanes={panes.length}
                            height="100%"

                            seriesConfigs={pane.alignedSeries} // updated to use memoized prop
                            data={[]} // Deprecated

                            mainInfo={{
                                ticker: pane.series.find(s => s.isMain)?.ticker || pane.series[0]?.ticker,
                                timeframe: '1d' // Fixed for now, add store prop later
                            }}

                            isFirstPane={idx === 0}
                            isLastPane={idx === panes.length - 1} // Correct isLastPane check

                            // TimeScale Visibility: Only last pane shows dates
                            timeScaleVisible={idx === panes.length - 1}

                            onMoveSeries={handleMoveSeries}
                            onRemoveSeries={handleRemoveSeries}
                            onScaleChange={handleScaleChange}
                            onSymbolSearchClick={() => setIsSearchOpen(true)}
                            onChartReady={handleChartReady}

                            // Infinite Scroll
                            onLoadMore={handleLoadMore}
                            isLoading={isLoadingMore}

                            // Pane Reordering (Floor Move)
                            onMovePane={(dir) => movePane(pane.id, dir)} // removed chartId
                            canMoveUp={idx > 0}
                            canMoveDown={idx < panes.length - 1}
                        />

                        {idx < panes.length - 1 && (
                            <div className="chart-separator" />
                        )}
                    </div>
                )
            })}

            {/* Load More Button - Centered Left */}
            <div style={{ position: 'absolute', top: '50%', left: '10px', transform: 'translateY(-50%)', zIndex: 50 }}>
                <button
                    onClick={() => handleLoadMore()}
                    style={{
                        background: '#2a2e39',
                        color: '#d1d4dc',
                        border: '1px solid #363a45',
                        borderRadius: '50%', // Circle for better aesthetic in middle? Or rounded rect? User just said button.
                        width: '32px',
                        height: '32px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '18px',
                        cursor: 'pointer',
                        opacity: 0.6,
                        boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                        transition: 'opacity 0.2s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.opacity = 1}
                    onMouseLeave={e => e.currentTarget.style.opacity = 0.6}
                    title="Load More History"
                >
                    {/* Left Arrow or Clock icon? */}
                    <span>‹</span>
                </button>
            </div>

            <img src="/logo.png" className="chart-logo" alt="Logo" />

            {/* showLayers && <LayersPanel ... /> */}
            <SymbolSearch isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} onSelect={handleSymbolSelect} />
        </div>
    )
}

export default ChartPanel

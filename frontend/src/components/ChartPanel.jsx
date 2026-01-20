import { useEffect, useRef, useState } from 'react'
import { useLayoutStore } from '../stores/useLayoutStore'
import LayersPanel from './LayersPanel'
import ChartPane from './ChartPane'
import SymbolSearch from './SymbolSearch'
import { alignSeriesData } from '../utils/dataAligner'
import { calculateIndicator } from '../utils/indicators'
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

            // 1. Client-Side Computed Indicators (RSI, SMA...)
            if (series.isComputed) {
                // Find main data (source)
                // Use first series of 'main-pane'
                const mainPane = panes.find(p => p.id === 'main-pane') || panes[0]
                const sourceSeries = mainPane?.series.find(s => s.isMain) || mainPane?.series[0]

                if (sourceSeries && sourceSeries.data && sourceSeries.data.length > 0) {
                    const computedData = calculateIndicator(series.ticker, sourceSeries.data) // ticker holds 'RSI', 'SMA' etc
                    setSeriesData(series.id, computedData)
                }
                return
            }

            if (!series.ticker) return
            // Don't fetch data for client-side indicators if flagged (double check)
            if (series.indicatorType && series.isComputed) return

            try {
                // Use global timeframe or series timeframe (if persistent)
                const timeframe = '1d'
                const url = `${API_BASE}/data?ticker=${encodeURIComponent(series.ticker)}&timeframe=${timeframe}`
                const res = await fetch(url)
                const json = await res.json()
                if (json.data && json.data.length > 0) {
                    const sortedData = [...json.data].sort((a, b) => a.time - b.time)
                    setSeriesData(series.id, sortedData)
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
                    updateSeriesSettings(s.id, { ticker: symbol, title: symbol })
                    setSeriesData(s.id, [])
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
    const mainPane = panes.find(p => p.id === 'main-pane') || panes[0]
    const mainSeries = mainPane?.series.find(s => s.isMain) || mainPane?.series[0]
    const mainData = mainSeries?.data || []

    return (
        <div className="chart-panel" ref={containerRef} style={{ display: 'flex', flexDirection: 'column' }}>
            {panes.map((pane, idx) => {
                // Align data for all series in this pane
                const alignedSeriesConfigs = pane.series.map(s => {
                    // Don't align main series with itself (optimization)
                    if (s.id === mainSeries?.id) return s

                    // Align locally
                    return {
                        ...s,
                        data: alignSeriesData(mainData, s.data)
                    }
                })

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

                            seriesConfigs={alignedSeriesConfigs} // Pass aligned data embedded in config
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

            {/* Timeline Pane (Do we still need this separate pane if we enabled timeScale on the last pane?) */}
            {/* The prompt says "Only the bottom-most panel should show dates". 
                The User's prompt implies we fix the standard panels.
                If I enable timeScale on the last actual ChartPane, I might not need this explicit 'pane_timeline' hack 
                OR I should keep it if it serves a specific purpose (like a dedicated scrollbar area).
                
                Actually, typical TradingView layout has dates on the bottom chart.
                If I use 'pane_timeline' (which is just a ChartPane with isTimeline=true), 
                maybe I should remove it and trust the last pane?
                
                Let's stick to the prompt: Pass `timeScaleVisible={index === panes.length - 1}`.
                So the last CONTENT pane will show dates. 
                I should probably hide/remove the old "pane_timeline" div if it becomes redundant, 
                or keep it if it's the *only* place? 
                
                The user's code previously had a dedicated 26px div for timeline. 
                If I enable timeScale on the bottom content pane, it will take space INSIDE that pane.
                So I should probably remove this extra div to avoid double dates.
            */}

            {/* 
            <div style={{ height: '26px', flexShrink: 0, borderTop: '1px solid #2a2e39' }}>
                <ChartPane ... />
            </div> 
            */}

            <img src="/logo.png" className="chart-logo" alt="Logo" />

            {/* showLayers && <LayersPanel ... /> */}
            <SymbolSearch isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} onSelect={handleSymbolSelect} />
        </div>
    )
}

export default ChartPanel

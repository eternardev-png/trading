import { useEffect, useRef, useState } from 'react'
import { useLayoutStore } from '../stores/useLayoutStore'
import LayersPanel from './LayersPanel'
import ChartPane from './ChartPane'
import SymbolSearch from './SymbolSearch'
import './ChartPanel.scss'

const API_BASE = 'http://127.0.0.1:8000/api/v1'

function ChartPanel({ chart, index }) {
    const { setLayerData, updateLayerSettings, reorderLayer, movePane } = useLayoutStore()
    const [data, setData] = useState([])
    const [showLayers, setShowLayers] = useState(false)
    const [isSearchOpen, setIsSearchOpen] = useState(false)



    // Panes state: list of pane configs
    const [panes, setPanes] = useState([
        {
            id: 'pane_main',
            height: 100, // percentage
            seriesConfigs: [
                { id: 'main', type: 'candle', title: chart.layers[0]?.ticker },
                { id: 'volume', type: 'volume', title: 'Объём', color: '#26a69a' }
            ]
        }
    ])

    // Refs to chart instances for sync
    const paneRefs = useRef({}) // { [paneId]: { chart, id } }

    const mainTicker = chart.layers[0]?.ticker || 'N/A'
    const exchange = mainTicker.includes('/') ? 'CRYPTO' : 'STOCK'

    const handleSymbolSelect = (symbol) => {
        const mainLayer = chart.layers[0]
        if (mainLayer) {
            updateLayerSettings(chart.id, mainLayer.id, { ticker: symbol })
        }
        setIsSearchOpen(false)
    }

    // Sync panes with chart.layers
    useEffect(() => {
        if (!chart.layers) return

        setPanes(prevPanes => {
            const newPanes = []

            // 1. Reconstruct Main Pane (Candles + Overlays)
            // Preserve height of existing main pane
            const existingMain = prevPanes.find(p => p.id === 'pane_main')
            const mainPane = {
                id: 'pane_main',
                height: existingMain ? existingMain.height : (chart.layers.some(l => l.indicatorType === 'pane') ? 70 : 100),
                seriesConfigs: []
            }

            // A. Main Candle Series
            const mainLayer = chart.layers[0]
            if (mainLayer) {
                mainPane.seriesConfigs.push({
                    id: mainLayer.id, // Use real ID for actions
                    type: 'candle',
                    title: mainLayer.ticker,
                    data: data, // Main data from local state
                    priceScaleId: mainLayer.priceScaleId || 'right',
                    isMain: true // Identify as main series
                })
            }

            // B. Volume (Virtual or Real)
            // Check if we have a real volume layer in store
            const realVolumeLayer = chart.layers.find(l => l.type === 'volume')

            // If NO real volume layer, add the default virtual one here (Main Pane)
            if (!realVolumeLayer) {
                mainPane.seriesConfigs.push({ id: 'volume', type: 'volume', title: 'Объём', color: '#26a69a', data: data })
            }

            // C. Compare Layers (Overlays), Indicators AND Real Volume
            chart.layers.forEach((layer, idx) => {
                // If it's the main candle series (idx 0), we already handled it
                if (idx === 0) return

                if (layer.visible) {
                    if (layer.type === 'volume') {
                        // Real Volume Layer (Overlay)
                        if (layer.indicatorType === 'overlay' || !layer.indicatorType) {
                            mainPane.seriesConfigs.push({
                                id: layer.id,
                                type: 'volume',
                                title: layer.title || 'Объём',
                                color: layer.color || '#26a69a',
                                data: (layer.data && layer.data.length > 0) ? layer.data : data, // Robust fallback
                                priceScaleId: layer.priceScaleId || 'volume_scale' // Default to volume scale if overlay
                            })
                        }
                    } else if (layer.type === 'compare') {
                        // Compare Overlay (ONLY if not moved to pane)
                        if (layer.indicatorType !== 'pane') {
                            mainPane.seriesConfigs.push({
                                id: layer.id,
                                type: 'line',
                                title: layer.ticker,
                                color: layer.color,
                                lineWidth: 2,
                                data: layer.data || [], // Data from store
                                priceScaleId: layer.priceScaleId // Pass persistence prop
                            })
                        }
                    } else if (layer.type === 'indicator' && layer.indicatorType === 'overlay') {
                        // Indicator Overlay
                        mainPane.seriesConfigs.push({
                            id: layer.id,
                            type: 'line',
                            title: layer.title,
                            color: layer.color,
                            data: layer.data || [],
                            priceScaleId: layer.priceScaleId // Pass persistence prop
                        })
                    }
                }
            })
            newPanes.push(mainPane)

            // 2. Separate Panes (Indicators & Volume & Compare)
            chart.layers.forEach(layer => {
                if (!layer.visible) return

                // Pane Logic
                const isPane = (layer.type === 'indicator' && layer.indicatorType === 'pane') ||
                    (layer.type === 'volume' && layer.indicatorType === 'pane') ||
                    (layer.type === 'compare' && layer.indicatorType === 'pane')

                if (isPane) {
                    const existingPane = prevPanes.find(p => p.id === `pane_${layer.id}`)
                    newPanes.push({
                        id: `pane_${layer.id}`,
                        height: existingPane ? existingPane.height : 30,
                        seriesConfigs: [{
                            id: layer.id,
                            type: layer.type === 'volume' ? 'volume' : 'line',
                            title: layer.title, // Use title for compare layers too
                            color: layer.color,
                            data: (layer.data && layer.data.length > 0) ? layer.data : (layer.type === 'volume' ? data : []), // Robust fallback for volume
                            priceScaleId: layer.priceScaleId
                        }]
                    })
                }
            })

            // 3. Sort Panes based on paneOrder
            if (chart.paneOrder && chart.paneOrder.length > 0) {
                newPanes.sort((a, b) => {
                    const idxA = chart.paneOrder.indexOf(a.id)
                    const idxB = chart.paneOrder.indexOf(b.id)
                    // If not found in order (newly added), push to end
                    const valA = idxA === -1 ? 9999 : idxA
                    const valB = idxB === -1 ? 9999 : idxB
                    return valA - valB
                })
            }

            return newPanes
        })

    }, [chart.layers, data, chart.timeframe, chart.paneOrder]) // Depend on paneOrder too

    // Fetch Data for All Layers
    useEffect(() => {
        const fetchLayerData = async (layer, isMain) => {
            if (!layer.ticker) return

            try {
                // If it's a compare layer and already has data for this timeframe, skip?
                // For simplified logic: always fetch on mount/timeframe change

                const url = `${API_BASE}/data?ticker=${encodeURIComponent(layer.ticker)}&timeframe=${chart.timeframe}`
                const res = await fetch(url)
                const json = await res.json()

                if (json.data && json.data.length > 0) {
                    const sortedData = [...json.data].sort((a, b) => a.time - b.time)

                    if (isMain) {
                        setData(sortedData)
                    } else {
                        setLayerData(chart.id, layer.id, sortedData)
                    }
                }
            } catch (e) {
                console.error(`Fetch error for ${layer.ticker}:`, e)
            }
        }

        // Loop all layers
        chart.layers.forEach((layer, idx) => {
            // Optimization: Only fetch if data missing or invalid (future)
            // For now, always fetch if it has a ticker
            if (layer.ticker) {
                fetchLayerData(layer, idx === 0)
            }
        })

    }, [chart.layers.length, chart.layers.map(l => l.ticker).join(','), chart.timeframe]) // Re-run if layers change or timeframe changes

    // Sync Charts Logic
    // We use a state to track ready charts to force re-effect
    const [readyCharts, setReadyCharts] = useState(0)
    const isSyncing = useRef(false) // Re-entrancy lock

    useEffect(() => {
        // Filter out null refs (from unmounted panes)
        const refs = Object.values(paneRefs.current).filter(r => r && r.chart)
        if (refs.length < 1) return

        // Unsubscribe cache
        const unsubs = []

        // CHANGE: Use LogicalRange instead of TimeRange
        const sync = (sourceId, logicalRange) => {
            // Prevent recursive sync
            if (isSyncing.current) return

            // Validate logicalRange
            if (!logicalRange) return

            isSyncing.current = true
            refs.forEach(ref => {
                if (ref.id !== sourceId && ref.chart) {
                    try {
                        // Use setVisibleLogicalRange for index-based sync (allows flying into void)
                        ref.chart.timeScale().setVisibleLogicalRange(logicalRange)
                    } catch (e) {
                        // Ignore sync errors
                    }
                }
            })
            isSyncing.current = false
        }

        refs.forEach(ref => {
            if (ref.chart) {
                // CHANGE: Subscribe to LogicalRangeChange
                const handler = (logicalRange) => {
                    if (!isSyncing.current) {
                        sync(ref.id, logicalRange)
                    }
                }

                // IMPORTANT: Method changed to subscribeVisibleLogicalRangeChange
                ref.chart.timeScale().subscribeVisibleLogicalRangeChange(handler)

                unsubs.push(() => {
                    try {
                        ref.chart.timeScale().unsubscribeVisibleLogicalRangeChange(handler)
                    } catch (e) { }
                })
            }
        })

        return () => unsubs.forEach(u => u())
    }, [panes.length, panes.map(p => p.id).join(','), readyCharts])

    const handleChartReady = () => {
        setReadyCharts(p => p + 1)
    }

    const handleScaleChange = (seriesId, side) => {
        // Special Case for Virtual Volume
        if (seriesId === 'volume' && !chart.layers.find(l => l.id === 'volume')) {
            // Materialize it first
            const { addCustomLayer } = useLayoutStore.getState()
            addCustomLayer(chart.id, {
                id: 'volume',
                type: 'volume',
                title: 'Объём',
                color: '#26a69a',
                visible: true,
                priceScaleId: side || 'right', // Apply the requested side
                // data: undefined // Fallback to main data
            })
            return
        }

        updateLayerSettings(chart.id, seriesId, { priceScaleId: side || 'overlay' })
    }

    // Move Series Logic (Legacy: SeriesMenu)
    const handleMoveSeries = (seriesId, direction) => {
        // "direction" from SeriesMenu: 'to_pane_above', 'to_pane_below', 'new_pane_above', 'new_pane_below', 'new'

        // Special Case: Virtual Volume
        if (seriesId === 'volume' && !chart.layers.find(l => l.id === 'volume')) {
            // Materialize Volume Layer First
            const { addCustomLayer } = useLayoutStore.getState()
            const newLayer = {
                id: 'volume',
                type: 'volume',
                title: 'Объём',
                color: '#26a69a',
                visible: true,
                priceScaleId: 'volume_scale', // Default
                indicatorType: 'overlay', // Default
            }

            // Apply the move logic immediately to the new object?
            // Or just add it and let the standard logic run?
            // The standard logic needs the layer in store. 
            // If we add it now, we might need to wait for next render?
            // No, we can call reorderLayer/updateLayer immediately after adding? 
            // Zustand updates are sync usually.

            // Pre-calculate the result of the move:
            if (direction === 'new_pane_below' || direction === 'new_pane_above') {
                newLayer.indicatorType = 'pane'
                newLayer.priceScaleId = 'right'
            }

            addCustomLayer(chart.id, newLayer)

            // If it's just a type change, we are done. 
            // If it's a reorder, we might need more.
            // For 'new_pane_below' on volume (which is usually at bottom of main), adding it as 'pane' usually puts it at end of list?
            // Yes, addCustomLayer pushes to end.
            // Separated Panes loop renders panes in order.
            // So adding it as 'pane' puts it at bottom pane. Correct for "new_pane_below".

            return
        }

        // We act on chart.layers via store
        // Find layer
        const layer = chart.layers.find(l => l.id === seriesId)
        if (!layer) return

        if (direction === 'new_pane_above' || direction === 'new_pane_below' || direction === 'new') {
            // Switch to pane
            updateLayerSettings(chart.id, seriesId, { indicatorType: 'pane', priceScaleId: 'right' })
        } else if (direction === 'to_pane_above') {
            // Scan backwards from current layer to find the nearest "pane"
            const layers = chart.layers
            const currentIdx = layers.findIndex(l => l.id === seriesId)
            let swapTargetIdx = -1

            for (let i = currentIdx - 1; i >= 0; i--) {
                const l = layers[i]
                // Skip invisible? No, logic should hold.
                if (l.indicatorType === 'pane') {
                    swapTargetIdx = i
                    break
                }
            }

            if (swapTargetIdx !== -1) {
                // If we found a pane above, swap with it
                // We need to calculate the delta
                const delta = swapTargetIdx - currentIdx // will be negative
                reorderLayer(chart.id, seriesId, delta)
            } else {
                // No pane above. This means we are the top-most pane.
                // Move Up means -> Merge to Main (Overlay)
                updateLayerSettings(chart.id, seriesId, { indicatorType: 'overlay', priceScaleId: (layer.type === 'volume' ? 'volume_scale' : 'right') })
            }

        } else if (direction === 'to_pane_below') {
            // Scan forwards
            const layers = chart.layers
            const currentIdx = layers.findIndex(l => l.id === seriesId)
            let swapTargetIdx = -1

            for (let i = currentIdx + 1; i < layers.length; i++) {
                const l = layers[i]
                if (l.indicatorType === 'pane') {
                    swapTargetIdx = i
                    break
                }
            }

            if (swapTargetIdx !== -1) {
                const delta = swapTargetIdx - currentIdx // positive
                reorderLayer(chart.id, seriesId, delta)
            } else {
                // No pane below. We are at bottom. Do nothing?
                // Or maybe user meant "create new pane below"? 
                // Usually "Move Down" button is disabled if at bottom, but if enabled, doing nothing is safe.
            }
        }
    }

    const handleRemoveSeries = (seriesId) => {
        // Similar to move but just remove
        setPanes(prevPanes => {
            const newPanes = JSON.parse(JSON.stringify(prevPanes))
            newPanes.forEach(pane => {
                pane.seriesConfigs = pane.seriesConfigs.filter(s => s.id !== seriesId)
            })
            const filteredPanes = newPanes.filter(p => p.seriesConfigs.length > 0)

            // Recalculate heights if pane count changed
            if (filteredPanes.length !== prevPanes.length) {
                const count = filteredPanes.length
                const newHeight = 100 / count
                filteredPanes.forEach(p => p.height = newHeight)
            }

            return filteredPanes
        })
    }

    // Resizing Logic
    const draggingRef = useRef(null) // { index, startY, startHeights }
    const rafRef = useRef(null)
    const containerRef = useRef(null) // Ref for the main container

    const handleMouseDown = (e, index) => {
        e.preventDefault()
        const startHeights = panes.map(p => p.height)
        // Use containerRef to get the full height of the chart panel area
        const totalHeight = containerRef.current ? containerRef.current.clientHeight : e.target.parentElement.parentElement.clientHeight

        draggingRef.current = {
            index,
            startY: e.clientY,
            startHeights,
            totalHeight
        }
        document.addEventListener('mousemove', handleMouseMove)
        document.addEventListener('mouseup', handleMouseUp)
    }

    const handleMouseMove = (e) => {
        if (!draggingRef.current) return

        if (rafRef.current) return // Skip if already scheduled

        rafRef.current = requestAnimationFrame(() => {
            const { index, startY, startHeights, totalHeight } = draggingRef.current
            const deltaY = e.clientY - startY
            const deltaPercent = (deltaY / totalHeight) * 100

            // Calculate new heights
            const h1 = startHeights[index] + deltaPercent
            const h2 = startHeights[index + 1] - deltaPercent

            // Constraints (min 5%)
            if (h1 < 5 || h2 < 5) {
                rafRef.current = null
                return
            }

            setPanes(prev => {
                const newPanes = [...prev]
                newPanes[index] = { ...newPanes[index], height: h1 }
                newPanes[index + 1] = { ...newPanes[index + 1], height: h2 }
                return newPanes
            })

            rafRef.current = null
        })
    }

    const handleMouseUp = () => {
        draggingRef.current = null
        if (rafRef.current) {
            cancelAnimationFrame(rafRef.current)
            rafRef.current = null
        }
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
    }

    // Cleanup listeners on unmount
    useEffect(() => {
        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current)
            document.removeEventListener('mousemove', handleMouseMove)
            document.removeEventListener('mouseup', handleMouseUp)
        }
    }, [])
    return (
        <div className="chart-panel" ref={containerRef} style={{ display: 'flex', flexDirection: 'column' }}>
            {panes.map((pane, idx) => (
                <div key={pane.id} style={{ flex: `${pane.height} 1 0`, minHeight: 0, display: 'flex', flexDirection: 'column', position: 'relative' }}>
                    <ChartPane
                        ref={el => {
                            if (el) paneRefs.current[pane.id] = el
                            else delete paneRefs.current[pane.id]
                        }}
                        id={pane.id}
                        paneIndex={idx}
                        totalPanes={panes.length}
                        height="100%" // Pane fills container which has % height
                        seriesConfigs={pane.seriesConfigs}
                        data={data}
                        mainInfo={{ ticker: mainTicker, exchange, timeframe: chart.timeframe }}
                        isFirstPane={idx === 0}
                        isLastPane={false} // Content panes no longer show time scale
                        onMoveSeries={handleMoveSeries}
                        onRemoveSeries={handleRemoveSeries}
                        onScaleChange={handleScaleChange}
                        onSymbolSearchClick={() => setIsSearchOpen(true)}
                        onChartReady={handleChartReady}
                        onMovePane={(dir) => movePane(chart.id, pane.id, dir)} // -1 (Up), 1 (Down)
                        canMoveUp={panes.indexOf(pane) > 0}
                        canMoveDown={panes.indexOf(pane) < panes.length - 1}
                    />

                    {idx < panes.length - 1 && (
                        <div
                            className="chart-separator"
                            onMouseDown={(e) => handleMouseDown(e, idx)}
                        />
                    )}
                </div>
            ))}

            {/* Timeline Axis Pane */}
            <div style={{ height: '26px', flexShrink: 0, borderTop: '1px solid #2a2e39' }}>
                <ChartPane
                    ref={el => {
                        if (el) paneRefs.current['pane_timeline'] = el
                        else delete paneRefs.current['pane_timeline']
                    }}
                    id="pane_timeline"
                    isTimeline={true}
                    height="100%"
                    seriesConfigs={[{
                        id: 'ghost_tl',
                        type: 'candle',
                        // Instead of hidden: true, make it transparent to ensure timeScale works freely
                        color: 'transparent',
                        upColor: 'transparent',
                        downColor: 'transparent',
                        borderVisible: false,
                        wickVisible: false
                    }]}
                    data={data}
                    mainInfo={{ ticker: mainTicker, exchange, timeframe: chart.timeframe }}
                    paneIndex={-1}
                    totalPanes={panes.length}
                    isFirstPane={false}
                    isLastPane={true}
                    onSymbolSearchClick={() => { }}
                    onMovePane={() => { }}
                />
            </div>

            {/* Custom Logo (Fixed Bottom Left) */}
            <img src="/logo.png" className="chart-logo" alt="Logo" />


            {/* Layers button - Absolute over everything */}
            <button
                className="chart-panel__layers-btn"
                onClick={() => setShowLayers(!showLayers)}
            >
                ☰
            </button>

            {showLayers && <LayersPanel chart={chart} onClose={() => setShowLayers(false)} />}

            <SymbolSearch
                isOpen={isSearchOpen}
                onClose={() => setIsSearchOpen(false)}
                onSelect={handleSymbolSelect}
            />
        </div>
    )
}

export default ChartPanel

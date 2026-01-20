import { create } from 'zustand'

// Layout modes
export const LAYOUTS = {
    SINGLE: '1',
    VERTICAL_2: '2v',
    HORIZONTAL_2: '2h',
    GRID_4: '4'
}

// Default layer/series template
const createSeries = (ticker, id, overrides = {}) => ({
    id: id || crypto.randomUUID(),
    ticker,
    visible: true,
    color: overrides.color || '#2962ff',
    lineWidth: 2,
    chartType: overrides.chartType || 'candle', // 'candle' | 'line' | 'area' | 'volume'
    priceScale: overrides.priceScale || 'right', // 'left' | 'right' | 'volume_scale'
    data: [],
    title: overrides.title || ticker,
    ...overrides
})

// Default chart template with Panes Structure
const createChart = (id) => ({
    id: id || crypto.randomUUID(),
    timeframe: '1d',
    // Floor System: Panes are explicit containers
    panes: [
        {
            id: 'pane_main',
            height: 100, // Flex basis
            series: [
                createSeries('BTC/USDT', 'main_series', { isMain: true }),
                // Add Volume by default
                createSeries('BTC/USDT', 'volume_series', { chartType: 'volume', priceScale: 'volume_scale', color: '#26a69a', title: 'Volume' })
            ]
        }
    ]
})

export const useLayoutStore = create((set, get) => ({
    // Layout state
    layoutMode: LAYOUTS.SINGLE,
    charts: [createChart('chart-1')],

    // Sync options
    syncCrosshair: true,
    syncTimeRange: true,

    // Shared crosshair state (for sync)
    sharedCrosshairTime: null,
    setSharedCrosshairTime: (time) => set({ sharedCrosshairTime: time }),

    // Actions
    setLayoutMode: (mode) => {
        const { charts } = get()
        let newCharts = [...charts]
        const requiredCount = mode === LAYOUTS.GRID_4 ? 4 : mode === LAYOUTS.SINGLE ? 1 : 2
        while (newCharts.length < requiredCount) {
            newCharts.push(createChart())
        }
        newCharts = newCharts.slice(0, requiredCount)
        set({ layoutMode: mode, charts: newCharts })
    },

    setSyncCrosshair: (enabled) => set({ syncCrosshair: enabled }),
    setSyncTimeRange: (enabled) => set({ syncTimeRange: enabled }),

    // Right Panel
    showRightPanel: false,
    toggleRightPanel: () => set(state => ({ showRightPanel: !state.showRightPanel })),

    // Drawing Tools
    activeTool: 'cursor',
    setActiveTool: (toolId) => set({ activeTool: toolId }),

    zoomRequest: null,
    setZoomRequest: (range) => set({ zoomRequest: { range, timestamp: Date.now() } }),

    // --- Pane/Series Actions ---

    // Generic set for chart properties
    setChartTimeframe: (chartId, timeframe) => {
        set(state => ({
            charts: state.charts.map(c => c.id === chartId ? { ...c, timeframe } : c)
        }))
    },

    // Add a new series (indicator or compare)
    addSeries: (chartId, seriesObj, targetPaneId = null) => {
        set(state => ({
            charts: state.charts.map(chart => {
                if (chart.id !== chartId) return chart

                const newPanes = [...chart.panes]
                // If targetPaneId provided, add there. Else add to main, or create new?
                // Default behavior: Indicators -> New Pane, Overlays -> Main Pane.

                const isOverlay = seriesObj.indicatorType === 'overlay'

                if (isOverlay) {
                    // Find main pane
                    // Assuming index 0 is always main or we search by ID 'pane_main'
                    const mainPane = newPanes.find(p => p.id === 'pane_main') || newPanes[0]
                    if (mainPane) {
                        mainPane.series.push(seriesObj)
                    }
                } else {
                    // New Pane
                    const newPaneId = `pane_${seriesObj.id}`
                    newPanes.push({
                        id: newPaneId,
                        height: 30, // Default height for new pane
                        series: [seriesObj]
                    })
                }

                // Recalculate heights if needed (basic normalization logic is usually in Component, but helpful here too)

                return { ...chart, panes: newPanes }
            })
        }))
    },

    // Helper: Add standard indicator (wrapper for addSeries)
    addIndicator: (chartId, indicator) => {
        const seriesObj = createSeries(indicator.name, null, {
            type: 'indicator', // internal type tag
            chartType: 'line',
            indicator: indicator.id,
            indicatorType: indicator.type, // 'pane' or 'overlay'
            params: indicator.defaultParams || {},
            color: '#' + Math.floor(Math.random() * 16777215).toString(16),
            title: indicator.name
        })
        get().addSeries(chartId, seriesObj)
    },

    addCompareLayer: (chartId, ticker) => {
        const seriesObj = createSeries(ticker, null, {
            type: 'compare',
            chartType: 'line',
            indicatorType: 'overlay', // Compare usually overlay
            title: ticker,
            color: '#' + Math.floor(Math.random() * 16777215).toString(16)
        })
        get().addSeries(chartId, seriesObj)
    },

    removeSeries: (chartId, seriesId) => {
        set(state => ({
            charts: state.charts.map(chart => {
                if (chart.id !== chartId) return chart

                const newPanes = chart.panes.map(pane => ({
                    ...pane,
                    series: pane.series.filter(s => s.id !== seriesId)
                })).filter(pane => pane.series.length > 0 || pane.id === 'pane_main') // Don't delete main pane even if empty

                // If a pane was removed, we might want to redistribute heights, but CSS flex handles simple cases.

                return { ...chart, panes: newPanes }
            })
        }))
    },

    // Toggle visibility
    toggleSeriesVisibility: (chartId, seriesId) => {
        set(state => ({
            charts: state.charts.map(chart => {
                if (chart.id !== chartId) return chart
                const newPanes = chart.panes.map(pane => ({
                    ...pane,
                    series: pane.series.map(s => s.id === seriesId ? { ...s, visible: !s.visible } : s)
                }))
                return { ...chart, panes: newPanes }
            })
        }))
    },

    // Update settings
    updateSeriesSettings: (chartId, seriesId, settings) => {
        set(state => ({
            charts: state.charts.map(chart => {
                if (chart.id !== chartId) return chart
                const newPanes = chart.panes.map(pane => ({
                    ...pane,
                    series: pane.series.map(s => s.id === seriesId ? { ...s, ...settings } : s)
                }))
                return { ...chart, panes: newPanes }
            })
        }))
    },

    // set data
    setSeriesData: (chartId, seriesId, data) => {
        set(state => ({
            charts: state.charts.map(chart => {
                if (chart.id !== chartId) return chart
                const newPanes = chart.panes.map(pane => ({
                    ...pane,
                    series: pane.series.map(s => s.id === seriesId ? { ...s, data } : s)
                }))
                return { ...chart, panes: newPanes }
            })
        }))
    },

    // --- REORDERING LOGIC (The Core Task) ---

    // Move Pane Up/Down (Swap floors)
    movePane: (chartId, paneId, direction) => {
        set(state => ({
            charts: state.charts.map(chart => {
                if (chart.id !== chartId) return chart

                const panes = [...chart.panes]
                const idx = panes.findIndex(p => p.id === paneId)
                if (idx === -1) return chart

                const newIdx = idx + direction
                if (newIdx < 0 || newIdx >= panes.length) return chart

                // Swap
                const temp = panes[idx]
                panes[idx] = panes[newIdx]
                panes[newIdx] = temp

                return { ...chart, panes }
            })
        }))
    },

    // Move Series between panes (The Floor Logic)
    moveSeries: (chartId, seriesId, direction) => {
        set(state => ({
            charts: state.charts.map(chart => {
                if (chart.id !== chartId) return chart

                // 1. Locate Series
                let sourcePaneIdx = -1
                let seriesIdx = -1
                let seriesObj = null

                chart.panes.forEach((pane, pIdx) => {
                    const sIdx = pane.series.findIndex(s => s.id === seriesId)
                    if (sIdx !== -1) {
                        sourcePaneIdx = pIdx
                        seriesIdx = sIdx
                        seriesObj = pane.series[sIdx]
                    }
                })

                if (!seriesObj) return chart // Not found

                const newPanes = [...chart.panes]

                // 2. Remove from source
                newPanes[sourcePaneIdx] = {
                    ...newPanes[sourcePaneIdx],
                    series: newPanes[sourcePaneIdx].series.filter(s => s.id !== seriesId)
                }

                // 3. Determine Target
                // direction: -1 (Up), 1 (Down)
                /*
                 Logic:
                 - Move Up: 
                    If prev pane exists -> Merge.
                    Else -> Create New Pane at top? Or merge to main? 
                    Prompt says: "If no pane exists below, create new". "Same for Up".
                */

                const targetPaneIdx = sourcePaneIdx + direction

                if (targetPaneIdx >= 0 && targetPaneIdx < newPanes.length) {
                    // Target Pane Exists -> Merge
                    // Important: If we are moving TO a Main Pane, ensure settings (priceScale) are correct?
                    // But for now, just push.
                    const targetPane = { ...newPanes[targetPaneIdx] }
                    targetPane.series = [...targetPane.series, seriesObj]
                    newPanes[targetPaneIdx] = targetPane
                } else {
                    // Target does not exist (New Floor)
                    const newPane = {
                        id: `pane_${crypto.randomUUID()}`,
                        height: 30, // Default height
                        series: [seriesObj]
                    }

                    if (direction === 1) {
                        // Append to bottom
                        newPanes.push(newPane)
                    } else {
                        // Prepend to top (before main? or becomes new main?)
                        // Typically index 0 is main. If we insert at 0, that becomes index 0.
                        newPanes.unshift(newPane)
                    }
                }

                // 4. Cleanup Empty Source Pane
                // Never delete pane_main?? The prompt says "If old pane empty -> delete". 
                // But usually we want at least one pane. 
                // Let's protect 'pane_main' ID from deletion IF it was the source? 
                // The new structure allows any pane to be main really.
                // But let's stick to safe logic: filter empty panes.
                const finalPanes = newPanes.filter(p => p.series.length > 0)

                // Safety: If all deleted, restore empty main
                if (finalPanes.length === 0) {
                    finalPanes.push({ id: 'pane_main', height: 100, series: [] })
                }

                return { ...chart, panes: finalPanes }
            })
        }))
    },

    // Alias for compatibility if needed, but moveSeries handles both create/merge logic
    // The prompt asked for "moveSeriesToPane" but generic move logic is covered above.
    // Let's implement moveSeriesToPane specifically if specific target needed.
    moveSeriesToNewPane: (chartId, seriesId) => {
        set(state => ({
            charts: state.charts.map(chart => {
                if (chart.id !== chartId) return chart

                // Locate
                let sourcePaneIdx = -1
                let seriesObj = null
                chart.panes.forEach((p, idx) => {
                    const s = p.series.find(s => s.id === seriesId)
                    if (s) { sourcePaneIdx = idx; seriesObj = s; }
                })
                if (!seriesObj) return chart

                const newPanes = [...chart.panes]
                // Remove
                newPanes[sourcePaneIdx] = { ...newPanes[sourcePaneIdx], series: newPanes[sourcePaneIdx].series.filter(s => s.id !== seriesId) }

                // Create New Below
                const newPane = { id: `pane_${crypto.randomUUID()}`, height: 30, series: [seriesObj] }
                newPanes.splice(sourcePaneIdx + 1, 0, newPane)

                return { ...chart, panes: newPanes.filter(p => p.series.length > 0) }
            })
        }))
    }
}))

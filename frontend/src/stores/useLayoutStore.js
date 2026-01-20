import { create } from 'zustand'

// Layout modes
export const LAYOUTS = {
    SINGLE: '1',
    VERTICAL_2: '2v',
    HORIZONTAL_2: '2h',
    GRID_4: '4'
}

// Default layer template
const createLayer = (ticker, id) => ({
    id: id || crypto.randomUUID(),
    ticker,
    visible: true,
    color: '#2962ff',
    lineWidth: 2,
    chartType: 'candle', // 'candle' | 'line' | 'area'
    priceScale: 'right', // 'left' | 'right'
    data: []
})

// Default chart template
const createChart = (id) => ({
    id: id || crypto.randomUUID(),
    layers: [createLayer('BTC/USDT')],
    timeframe: '1d'
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

        // Add charts if needed
        const requiredCount = mode === LAYOUTS.GRID_4 ? 4 : mode === LAYOUTS.SINGLE ? 1 : 2
        while (newCharts.length < requiredCount) {
            newCharts.push(createChart())
        }
        // Trim if too many
        newCharts = newCharts.slice(0, requiredCount)

        set({ layoutMode: mode, charts: newCharts })
    },

    setSyncCrosshair: (enabled) => set({ syncCrosshair: enabled }),
    setSyncTimeRange: (enabled) => set({ syncTimeRange: enabled }),

    // Right Panel
    showRightPanel: false, // Default hidden
    toggleRightPanel: () => set(state => ({ showRightPanel: !state.showRightPanel })),

    // Drawing Tools
    activeTool: 'cursor', // 'cursor', 'crosshair', 'line', etc.
    setActiveTool: (toolId) => set({ activeTool: toolId }),

    // Zoom action (command)
    zoomRequest: null, // { range: '1M', timestamp: number }
    setZoomRequest: (range) => set({ zoomRequest: { range, timestamp: Date.now() } }),

    // Layer actions
    addLayer: (chartId, ticker) => {
        const { charts } = get()
        set({
            charts: charts.map(chart =>
                chart.id === chartId
                    ? { ...chart, layers: [...chart.layers, createLayer(ticker)] }
                    : chart
            )
        })
    },

    addCustomLayer: (chartId, layerObj) => {
        const { charts } = get()
        set({
            charts: charts.map(chart =>
                chart.id === chartId
                    ? { ...chart, layers: [...chart.layers, layerObj] }
                    : chart
            )
        })
    },

    removeLayer: (chartId, layerId) => {
        const { charts } = get()
        set({
            charts: charts.map(chart =>
                chart.id === chartId
                    ? { ...chart, layers: chart.layers.filter(l => l.id !== layerId) }
                    : chart
            )
        })
    },

    toggleLayerVisibility: (chartId, layerId) => {
        const { charts } = get()
        set({
            charts: charts.map(chart =>
                chart.id === chartId
                    ? {
                        ...chart,
                        layers: chart.layers.map(l =>
                            l.id === layerId ? { ...l, visible: !l.visible } : l
                        )
                    }
                    : chart
            )
        })
    },

    updateLayerSettings: (chartId, layerId, settings) => {
        const { charts } = get()
        set({
            charts: charts.map(chart =>
                chart.id === chartId
                    ? {
                        ...chart,
                        layers: chart.layers.map(l =>
                            l.id === layerId ? { ...l, ...settings } : l
                        )
                    }
                    : chart
            )
        })
    },

    setLayerData: (chartId, layerId, data) => {
        const { charts } = get()
        set({
            charts: charts.map(chart =>
                chart.id === chartId
                    ? {
                        ...chart,
                        layers: chart.layers.map(l =>
                            l.id === layerId ? { ...l, data } : l
                        )
                    }
                    : chart
            )
        })
    },

    setChartTimeframe: (chartId, timeframe) => {
        const { charts } = get()
        set({
            charts: charts.map(chart =>
                chart.id === chartId ? { ...chart, timeframe } : chart
            )
        })
    },

    addIndicator: (chartId, indicator) => {
        const { charts } = get()
        set({
            charts: charts.map(chart =>
                chart.id === chartId
                    ? {
                        ...chart,
                        layers: [...chart.layers, {
                            id: crypto.randomUUID(),
                            type: 'indicator',
                            title: indicator.name,
                            indicator: indicator.id, // e.g. 'SMA', 'RSI'
                            indicatorType: indicator.type, // 'overlay' | 'pane'
                            params: indicator.defaultParams || {},
                            visible: true,
                            color: '#' + Math.floor(Math.random() * 16777215).toString(16) // Random color
                        }]
                    }
                    : chart
            )
        })
    },

    addCompareLayer: (chartId, ticker) => {
        const { charts } = get()
        set({
            charts: charts.map(chart =>
                chart.id === chartId
                    ? {
                        ...chart,
                        layers: [...chart.layers, {
                            id: crypto.randomUUID(),
                            type: 'compare',
                            ticker: ticker,
                            title: ticker,
                            visible: true,
                            color: '#' + Math.floor(Math.random() * 16777215).toString(16) // Random color
                        }]
                    }
                    : chart
            )
        })
    },

    reorderLayer: (chartId, layerId, direction) => {
        const { charts } = get()
        set({
            charts: charts.map(chart => {
                if (chart.id !== chartId) return chart

                const layers = [...chart.layers]
                const idx = layers.findIndex(l => l.id === layerId)
                if (idx === -1) return chart

                const newIdx = idx + direction
                if (newIdx <= 0 || newIdx >= layers.length) return chart // Protect index 0 (main)

                // Swap
                const temp = layers[idx]
                layers[idx] = layers[newIdx]
                layers[newIdx] = temp

                return { ...chart, layers }
            })
        })
    }
}))

import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'

// Helper to find pane and series indices
const findSeriesLocation = (panes, seriesId) => {
    for (let pIdx = 0; pIdx < panes.length; pIdx++) {
        const sIdx = panes[pIdx].series.findIndex((s) => s.id === seriesId)
        if (sIdx !== -1) {
            return { paneIndex: pIdx, seriesIndex: sIdx, pane: panes[pIdx], series: panes[pIdx].series[sIdx] }
        }
    }
    return null
}

export const useLayoutStore = create((set, get) => ({
    // --- STATE ---
    panes: [
        {
            id: 'main-pane',
            height: 400,
            series: [
                {
                    id: 'main-series',
                    ticker: 'BTC/USDT',
                    visible: true,
                    chartType: 'candle', // candle, line, area
                    priceScale: 'right',
                    title: 'BTC/USDT',
                    isMain: true,
                    data: [],

                    // Default 'Late' Config Series Style
                    upColor: 'transparent',
                    downColor: '#FFFFFF',
                    borderVisible: true,
                    borderUpColor: '#FFFFFF',
                    borderDownColor: '#FFFFFF',
                    wickVisible: true,
                    wickUpColor: '#FFFFFF',
                    wickDownColor: '#FFFFFF',
                    bodyVisible: true,
                    color: '#26a69a' // fallback
                },
                {
                    id: 'volume-series',
                    ticker: 'BTC/USDT',
                    visible: true,
                    chartType: 'volume',
                    priceScale: 'volume_scale',
                    color: '#26a69a',
                    title: 'Volume',
                    data: []
                }
            ]
        }
    ],
    drawings: {}, // { [paneId]: [ {id, type, points...} ] }

    // Legacy/UI State (Preserved)
    activeTool: 'cursor',
    setActiveTool: (toolId) => set({ activeTool: toolId }),

    syncCrosshair: true,
    setSyncCrosshair: (enabled) => set({ syncCrosshair: enabled }),

    syncTimeRange: true,
    setSyncTimeRange: (enabled) => set({ syncTimeRange: enabled }),

    layoutMode: '1', // LAYOUTS.SINGLE
    setLayoutMode: (mode) => set({ layoutMode: mode }),

    showRightPanel: false,
    toggleRightPanel: () => set(state => ({ showRightPanel: !state.showRightPanel })),

    // --- TIMEFRAME STATE ---
    globalTimeframe: '1d',
    setGlobalTimeframe: (tf) => set({ globalTimeframe: tf }),

    // --- CHART CONTROLS STATE ---
    magnetMode: false, // Magnet disabled by default
    setMagnetMode: (enabled) => set({ magnetMode: enabled }),
    drawingsVisible: true,
    setDrawingsVisible: (visible) => set({ drawingsVisible: visible }),

    // --- CHART APPEARANCE STATE ---
    chartAppearance: {
        backgroundType: 'gradient',
        backgroundColor1: '#000000', // Late Default
        backgroundColor2: '#010101', // Late Default
        gridLines: 'all',
        gridColor: '#2a2e39',
        crosshair: 'dashed',
        watermark: true,
        scaleText: 12,
        scaleLines: true,
        marginTop: 10,
        marginBottom: 8,
        marginRight: 10,
        timezone: 'UTC+3' // Late Default
    },
    setChartAppearance: (updates) => set((state) => ({
        chartAppearance: { ...state.chartAppearance, ...updates }
    })),

    // --- STRATEGY STATE ---
    strategies: [],
    activeStrategy: null,
    strategySignals: [], // Buy/sell signals for chart markers
    strategyEquity: [], // Equity curve data

    addStrategy: (strategy) => set((state) => ({
        strategies: [...state.strategies, strategy],
        activeStrategy: strategy.id
    })),

    updateStrategy: (id, updates) => set((state) => ({
        strategies: state.strategies.map(s => s.id === id ? { ...s, ...updates } : s)
    })),

    removeStrategy: (id) => set((state) => ({
        strategies: state.strategies.filter(s => s.id !== id),
        activeStrategy: state.activeStrategy === id ? null : state.activeStrategy
    })),

    setActiveStrategy: (id) => set({ activeStrategy: id }),

    setStrategyResults: (signals, equity) => set({
        strategySignals: signals || [],
        strategyEquity: equity || []
    }),

    // --- DRAWINGS STATE ---
    drawings: {}, // { paneId: [ { id, type, p1, p2, p3, ... }, ... ] }
    activeTool: 'cursor', // Current drawing tool
    selectedDrawingId: null,
    setSelectedDrawingId: (id) => set({ selectedDrawingId: id }),

    setActiveTool: (tool) => set({ activeTool: tool }),

    addDrawing: (paneId, drawing) => set((state) => {
        const newDrawing = { ...drawing, id: drawing.id || `drawing_${Date.now()}` }
        const paneDrawings = state.drawings[paneId] || []
        return {
            drawings: {
                ...state.drawings,
                [paneId]: [...paneDrawings, newDrawing]
            }
        }
    }),

    updateDrawing: (paneId, id, updates) => set((state) => {
        const paneDrawings = state.drawings[paneId] || []
        return {
            drawings: {
                ...state.drawings,
                [paneId]: paneDrawings.map(d => d.id === id ? { ...d, ...updates } : d)
            }
        }
    }),

    removeDrawing: (paneId, id) => set((state) => {
        const paneDrawings = state.drawings[paneId] || []
        return {
            drawings: {
                ...state.drawings,
                [paneId]: paneDrawings.filter(d => d.id !== id)
            }
        }
    }),

    clearAllDrawings: () => set({ drawings: {} }),

    // --- ACTIONS ---

    setPanes: (panes) => set({ panes }),

    setSeriesData: (seriesId, data) => set((state) => {
        const newPanes = state.panes.map(pane => ({
            ...pane,
            series: pane.series.map(s => s.id === seriesId ? { ...s, data } : s)
        }))
        return { panes: newPanes }
    }),

    updateSeriesSettings: (seriesId, settings) => set((state) => {
        const newPanes = state.panes.map(pane => ({
            ...pane,
            series: pane.series.map(s => s.id === seriesId ? { ...s, ...settings } : s)
        }))
        return { panes: newPanes }
    }),

    // Helpers for Toolbar compatibility
    setChartTimeframe: (tf) => {
        // No-op or store global timeframe? 
        // Assuming existing components handle timeframe state or we add it here.
        // Let's add it for compatibility
    },

    // Добавление новой серии (индикатора или графика)
    addSeries: (seriesData, targetPaneId = null) => set((state) => {
        const newPanes = [...state.panes]
        const newSeries = {
            ...seriesData,
            id: seriesData.id || uuidv4(),
            data: seriesData.data || []
        }

        if (targetPaneId) {
            // Добавляем в конкретную панель (Overlay)
            const pane = newPanes.find(p => p.id === targetPaneId)
            if (pane) {
                // Ensure unique scale ID if requested
                if (newSeries.priceScaleId === 'new-right' || newSeries.priceScaleId === 'new-left') {
                    newSeries.priceScaleId = `scale_${uuidv4().slice(0, 8)}`
                }
                pane.series.push(newSeries)
            }
        } else {
            // Создаем новый "этаж" внизу (например, для RSI, Volume)
            if (newSeries.priceScaleId === 'new-right' || newSeries.priceScaleId === 'new-left') {
                // For new pane, usually 'right' is fine unless explicitly requested custom?
                // But let's support unique if they wanted 'new-right'.
                // Actually, standard pane usually uses 'right' as main scale.
                newSeries.priceScaleId = 'right'
            }

            newPanes.push({
                id: uuidv4(),
                height: 200, // Высота по умолчанию для индикаторов
                series: [newSeries]
            })
        }
        return { panes: newPanes }
    }),

    // --- Scale Management ---
    changeSeriesScale: (seriesId, mode, targetScaleId) => {
        set((state) => {
            const newPanes = state.panes.map(pane => {
                const seriesIndex = pane.series.findIndex(s => s.id === seriesId)
                if (seriesIndex === -1) return pane

                const series = pane.series[seriesIndex]
                const currentScaleId = series.priceScaleId || 'right'

                // Guard Clause: If target is already set, do nothing
                if (mode === 'assign' && targetScaleId === currentScaleId) return pane
                if (mode === 'right' && currentScaleId === 'right') return pane
                if (mode === 'left' && currentScaleId === 'left') return pane

                let newScaleId = currentScaleId

                if (mode === 'new-right') {
                    newScaleId = `scale_right_${uuidv4().slice(0, 8)}`
                } else if (mode === 'new-left') {
                    newScaleId = `scale_left_${uuidv4().slice(0, 8)}`
                } else if (mode === 'merge-right' || mode === 'right') {
                    newScaleId = 'right'
                } else if (mode === 'merge-left' || mode === 'left') {
                    newScaleId = 'left'
                } else if (mode === 'assign') {
                    newScaleId = targetScaleId
                }

                if (newScaleId === currentScaleId) return pane

                const newSeries = { ...series, priceScaleId: newScaleId }
                const newSeriesList = [...pane.series]
                newSeriesList[seriesIndex] = newSeries

                return { ...pane, series: newSeriesList }
            })

            return { panes: newPanes }
        })
    },

    // Wrapper for Add Indicator
    addIndicator: (indicator) => {
        // Map common names/IDs to codes
        // Use ID as primary code if available (e.g. 'BTC_GM2', 'RSI', 'MACD')
        let code = indicator.id || indicator.name

        // Legacy name mapping (if ID is not standard)
        if (indicator.name.includes('RSI') || indicator.name.includes('Relative Strength')) code = 'RSI'
        if (indicator.name.includes('SMA') || indicator.name.includes('Simple Moving')) code = 'SMA'
        if (indicator.name.includes('EMA') || indicator.name.includes('Exponential')) code = 'EMA'
        // For BTC_GM2, the ID is already 'BTC_GM2', so code is correct.

        const seriesObj = {
            id: uuidv4(),
            ticker: code, // Used for calculation type
            chartType: 'line',
            title: code,
            indicatorType: indicator.type,
            isComputed: true, // Flag for Client-Side Calc
            color: '#' + Math.floor(Math.random() * 16777215).toString(16),
            visible: true
        }
        // logic to decide target pane?
        const target = indicator.type === 'overlay' ? 'main-pane' : null
        get().addSeries(seriesObj, target)
    },

    addCompareLayer: (ticker) => {
        const panes = get().panes
        const mainPane = panes.find(p => p.id === 'main-pane') || panes[0]
        if (!mainPane) return

        const newSeries = {
            id: uuidv4(),
            ticker: ticker,
            title: ticker,
            chartType: 'line',
            color: '#ff9800',
            indicatorType: 'overlay',
            visible: true,
            priceScaleId: 'new-right' // Default to new scale? Or right?
        }

        get().addSeries(newSeries, mainPane.id)
    },

    removeSeries: (seriesId) => set((state) => {
        let newPanes = [...state.panes]

        // Удаляем серию
        newPanes.forEach(pane => {
            pane.series = pane.series.filter(s => s.id !== seriesId)
        })

        // Удаляем пустые панели (кроме, возможно, главной, если нужно)
        // Но обычно в TV если удалить всё, панель исчезает. Оставим защиту для главной, если она пустая?
        // Пока удаляем только пустые дополнительные панели.
        newPanes = newPanes.filter(p => p.series.length > 0 || p.id === 'main-pane')

        return { panes: newPanes }
    }),

    // Самая важная функция: Система Этажей
    moveSeries: (seriesId, direction) => set((state) => {
        const loc = findSeriesLocation(state.panes, seriesId)
        if (!loc) return state

        const { paneIndex, series } = loc
        const newPanes = [...state.panes]

        // 1. Удаляем из текущего места
        newPanes[paneIndex].series.splice(loc.seriesIndex, 1)

        // Определяем целевую панель
        const targetPaneIndex = paneIndex + (direction === 'up' ? -1 : 1)

        // Логика слияния или создания
        if (targetPaneIndex >= 0 && targetPaneIndex < newPanes.length) {
            // Панель существует -> Слияние (Merge)
            newPanes[targetPaneIndex].series.push(series)
        } else {
            // Reset scale ID to 'right' when moving to a new context (Floor)
            // This ensures the series becomes the "Main" series of the new pane,
            // using the standard visible Right Axis.
            series.priceScaleId = 'right'

            // Панели нет -> Создание нового этажа (Create Floor)
            const newPane = {
                id: uuidv4(),
                height: 200, // Высота новой панели
                series: [series]
            }

            if (direction === 'up') {
                newPanes.unshift(newPane) // В самый верх (редкий кейс, обычно 0 это цена)
            } else {
                newPanes.push(newPane) // В самый низ
            }
        }

        // 2. Очистка: Если старая панель стала пустой, удаляем её
        if (newPanes[paneIndex].series.length === 0) {
            // Обычно главную панель не удаляют, но если мы вынесли цену... 
            // Для безопасности удаляем только если это не единственная панель или по спец. флагу
            if (newPanes.length > 1) { // Basic safety
                newPanes.splice(paneIndex, 1)
            }
        }

        return { panes: newPanes }
    }),

    // --- DRAWINGS ACTIONS ---

    addDrawing: (paneId, drawing) => set((state) => ({
        drawings: {
            ...state.drawings,
            [paneId]: [...(state.drawings[paneId] || []), { ...drawing, id: drawing.id || uuidv4() }]
        }
    })),

    removeDrawing: (paneId, drawingId) => set((state) => ({
        drawings: {
            ...state.drawings,
            [paneId]: state.drawings[paneId]?.filter(d => d.id !== drawingId) || []
        }
    })),

    // Для изменения координат рисунка при перетаскивании
    updateDrawing: (paneId, drawingId, newProps) => set((state) => ({
        drawings: {
            ...state.drawings,
            [paneId]: state.drawings[paneId]?.map(d =>
                d.id === drawingId ? { ...d, ...newProps } : d
            ) || []
        }
    })),

    // Очистить все рисунки со всех панелей
    clearAllDrawings: () => set({ drawings: {} })
}))

export const LAYOUTS = {
    SINGLE: '1',
    VERTICAL_2: '2v',
    HORIZONTAL_2: '2h',
    GRID_4: '4'
}

// export default useLayoutStore // Removed to fix SyntaxError

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
                    color: '#26a69a',
                    title: 'BTC/USDT',
                    isMain: true,
                    data: []
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
            if (pane) pane.series.push(newSeries)
        } else {
            // Создаем новый "этаж" внизу (например, для RSI, Volume)
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
                let newScaleId = series.priceScaleId || 'right'

                if (mode === 'new-right' || mode === 'new-left') {
                    // Generate new ID (Scale A, B, C...)
                    // Find existing custom scales
                    const usedParticularScales = pane.series
                        .map(s => s.priceScaleId)
                        .filter(id => id && id.startsWith('scale_'))

                    // Simple generator: scale_A, scale_B ...
                    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
                    let nextChar = 'A'
                    for (let char of alphabet) {
                        if (!usedParticularScales.includes(`scale_${char}`)) {
                            nextChar = char
                            break
                        }
                    }
                    newScaleId = `scale_${nextChar}`
                } else if (mode === 'assign') {
                    newScaleId = targetScaleId
                } else if (mode === 'left') {
                    newScaleId = 'left'
                } else if (mode === 'right') {
                    newScaleId = 'right'
                } else if (mode === 'overlay') {
                    // Overlay usually means 'no scale' or sharing main scale without affecting it?
                    // In lightweight-charts, overlay often means overlaying on an existing scale (right) 
                    // but not affecting autoScale, OR using a "Screen Scale".
                    // Let's assume 'right' but with specific overlay logic elsewhere, 
                    // OR just 'overlay' ID if chart supports it. 
                    // Actually, for now let's just use 'right' as default or targetScaleId.
                    newScaleId = targetScaleId || 'right'
                }

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
        const seriesObj = {
            id: uuidv4(),
            ticker: indicator.name, // Placeholder
            chartType: 'line',
            title: indicator.name,
            indicatorType: indicator.type,
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
    }))
}))

export const LAYOUTS = {
    SINGLE: '1',
    VERTICAL_2: '2v',
    HORIZONTAL_2: '2h',
    GRID_4: '4'
}

// export default useLayoutStore // Removed to fix SyntaxError

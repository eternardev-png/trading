import { useEffect, useRef, useState, useImperativeHandle, forwardRef, memo, useMemo } from 'react'
import { createChart, ColorType } from 'lightweight-charts'
import { useLayoutStore } from '../stores/useLayoutStore'
import SeriesMenu from './SeriesMenu'
import DrawingsManager from './DrawingsManager'
import { mergeAndSortData } from '../utils/chartDataUtils' // Safe Utils
import './ChartPanel.scss' // Reusing existing styles

// Helper to format volume
const formatVolume = (vol) => {
    if (!vol) return '0'
    if (vol >= 1e9) return (vol / 1e9).toFixed(2) + 'B'
    if (vol >= 1e6) return (vol / 1e6).toFixed(2) + 'M'
    if (vol >= 1e3) return (vol / 1e3).toFixed(1) + 'K'
    return vol.toFixed(0)
}

const sanitizeColor = (c) => {
    if (!c || typeof c !== 'string') return undefined
    if (c === 'transparent') return 'rgba(0, 0, 0, 0)'
    return c
}


const ChartPane = forwardRef(({
    id,
    height,
    seriesConfigs = [],
    data,
    mainInfo,
    isTimeline = false,
    paneIndex,
    totalPanes,
    isFirstPane,
    isLastPane,
    onMoveSeries,
    onRemoveSeries,
    onSync,
    onScaleChange,
    onSymbolSearchClick,
    onChartReady,
    onMovePane,
    canMoveUp,
    canMoveDown,
    timeScaleVisible = true, // Default to true
    onLoadMore, // Infinite Scroll Callback
    isLoading = false, // Infinite Scroll Loading State
    onOpenSettings // Callback for Settings Modal
}, ref) => {
    const containerRef = useRef(null)
    const paneRef = useRef(null)
    const chartRef = useRef(null)
    const seriesMap = useRef({})
    const isFirstLoad = useRef(true)
    const lastDataCount = useRef(0) // Track data count for scroll preservation
    const isLoadingRef = useRef(isLoading) // Ref to access latest loading state in listeners
    const onLoadMoreRef = useRef(onLoadMore) // Ref for callback to avoid stale closure

    useEffect(() => { isLoadingRef.current = isLoading }, [isLoading])
    useEffect(() => { onLoadMoreRef.current = onLoadMore }, [onLoadMore])

    const strategySignals = useLayoutStore(state => state.strategySignals)
    const magnetMode = useLayoutStore(state => state.magnetMode)
    const drawingsVisible = useLayoutStore(state => state.drawingsVisible)
    const chartAppearance = useLayoutStore(state => state.chartAppearance)

    const [ohlc, setOhlc] = useState({})
    const [seriesVisible, setSeriesVisible] = useState({})
    const [showTimeframeMenu, setShowTimeframeMenu] = useState(false)

    // Initialize visibility state based on configs
    useEffect(() => {
        if (isTimeline) return

        const initialVis = {}
        seriesConfigs.forEach(s => {
            if (seriesVisible[s.id] === undefined) {
                initialVis[s.id] = true
            }
        })
        if (Object.keys(initialVis).length > 0) {
            setSeriesVisible(prev => ({ ...prev, ...initialVis }))
        }
    }, [seriesConfigs, isTimeline])

    // Close timeframe menu when clicking outside
    useEffect(() => {
        if (!showTimeframeMenu) return

        const handleClickOutside = (e) => {
            if (!e.target.closest('.timeframe-selector')) {
                setShowTimeframeMenu(false)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [showTimeframeMenu])


    // Scale modes state
    const [scaleModes, setScaleModes] = useState({
        left: { autoScale: true, log: false },
        right: { autoScale: true, log: false }
    })
    const [hoveredScale, setHoveredScale] = useState(null)

    // Chart Init
    useEffect(() => {
        if (!containerRef.current) return

        const lwChart = createChart(containerRef.current, {
            width: containerRef.current.clientWidth,
            height: containerRef.current.clientHeight,
            attributionLogo: false,
            layout: {
                background: {
                    type: chartAppearance.backgroundType === 'solid' ? ColorType.Solid : ColorType.VerticalGradient,
                    color: chartAppearance.backgroundColor1,
                    topColor: chartAppearance.backgroundColor1,
                    bottomColor: chartAppearance.backgroundColor2
                },
                textColor: '#787b86',
            },
            grid: {
                vertLines: {
                    color: chartAppearance.gridColor,
                    visible: !isTimeline && (chartAppearance.gridLines === 'all' || chartAppearance.gridLines === 'vert')
                },
                horzLines: {
                    color: chartAppearance.gridColor,
                    visible: !isTimeline && (chartAppearance.gridLines === 'all' || chartAppearance.gridLines === 'horz')
                },
            },
            rightPriceScale: {
                visible: true,
                borderVisible: false,
                scaleMargins: { top: 0.05, bottom: 0.12 },
                autoScale: true,
                mode: 0, // Normal (0)
            },
            leftPriceScale: {
                visible: !isTimeline,
                borderVisible: false,
                scaleMargins: { top: 0.05, bottom: 0.12 },
                autoScale: true,
                mode: 0, // Normal (0)
            },
            timeScale: {
                visible: timeScaleVisible,
                timeVisible: true,
                secondsVisible: false,
                borderVisible: false,
                fixLeftEdge: false,
                fixRightEdge: false,
                minBarSpacing: 0.01,
                shiftVisibleRangeOnNewBar: false, // Prevent auto-shift/zoom on new data or edge
                rightOffset: 10, // Buffer
            },
            watermark: {
                visible: chartAppearance.watermark && !isTimeline,
                fontSize: 64,
                horzAlign: 'center',
                vertAlign: 'center',
                color: 'rgba(255, 255, 255, 0.03)',
                text: mainInfo?.ticker || '',
            },
            crosshair: {
                mode: 0, // Normal crosshair mode (0 = Normal, 1 = Magnet)
                vertLine: {
                    width: 1,
                    color: 'rgba(120, 123, 134, 0.6)',
                    labelVisible: true,
                },
                horzLine: {
                    width: 1,
                    color: 'rgba(120, 123, 134, 0.6)',
                    labelVisible: true,
                },
            },
            handleScale: {
                axisPressedMouseMove: true,
                mouseWheel: false, // Disabled - we handle zoom manually
                pinch: false,
            },
            kineticScroll: {
                touch: true,
                mouse: true,
            },
            handleScroll: {
                mouseWheel: false, // Disable Scrolling (Zoom instead)
                pressedMouseMove: true,
                horzTouchDrag: true,
                vertTouchDrag: true,
            },
        })

        chartRef.current = lwChart

        // Force enforce options just in case
        lwChart.timeScale().applyOptions({
            // ... (keep existing)
            fixLeftEdge: false,
            fixRightEdge: false, // Allow scrolling into future
            shiftVisibleRangeOnNewBar: false,
        })

        const resizeObserver = new ResizeObserver(entries => {
            const { width, height } = entries[0].contentRect
            if (width > 0 && height > 0) {
                lwChart.applyOptions({ width, height })
            }
        })
        resizeObserver.observe(containerRef.current)

        if (onChartReady) {
            onChartReady(lwChart)
        }

        // Helper to sync React state with Chart internal state
        const syncScaleModes = () => {
            if (!chartRef.current) return

            // We use generic functional update to avoid closure staleness
            setScaleModes(prev => {
                const newModes = { ...prev }
                let changed = false
                const scales = ['right', 'left']

                scales.forEach(sid => {
                    try {
                        const s = lwChart.priceScale(sid)
                        if (s) {
                            const o = s.options()
                            // Extra safety check for returns
                            if (!o) return

                            const current = newModes[sid] || { autoScale: true, log: false }

                            if (current.autoScale !== o.autoScale || current.log !== (o.mode === 1)) {
                                newModes[sid] = {
                                    autoScale: o.autoScale,
                                    log: o.mode === 1
                                }
                                changed = true
                            }
                        }
                    } catch (e) {
                        // Ignore LWC internal errors e.g. "Value is null" during init
                    }
                })
                return changed ? newModes : prev
            })
        }

        // 1. Initial Sync
        syncScaleModes()

        // 2. Crosshair handler (Keep existing)
        lwChart.subscribeCrosshairMove(param => {
            if (param.time) {
                const newOhlc = {}
                seriesConfigs.forEach(config => {
                    const series = seriesMap.current[config.id]
                    if (series) {
                        const d = param.seriesData.get(series)
                        if (d) {
                            let change = 0
                            if (config.chartType === 'candle') {
                                const open = d.open
                                if (open) {
                                    change = ((d.close - open) / open * 100)
                                }
                            }

                            newOhlc[config.id] = {
                                ...d,
                                change,
                                value: d.value
                            }
                        }
                    }
                })
                setOhlc(prev => ({ ...prev, ...newOhlc }))
            }
        })

        // 3. LISTEN TO INTERACTIONS to Sync AutoScale

        lwChart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
            syncScaleModes()

            // Infinite Scroll Trigger
            // Trigger when user scrolls near the requested history edge (left side)
            if (onLoadMoreRef.current && range && range.from < 10) {
                // Throttle requests using ref
                if (!isLoadingRef.current) {
                    onLoadMoreRef.current()
                }
            }
        })

        const container = containerRef.current
        const handleInteraction = () => {
            // Small timeout to let LWC update internal state
            setTimeout(syncScaleModes, 50)
        }

        container.addEventListener('mouseup', handleInteraction)
        container.addEventListener('wheel', handleInteraction)
        container.addEventListener('mouseleave', handleInteraction) // safety

        return () => {
            container.removeEventListener('mouseup', handleInteraction)
            container.removeEventListener('wheel', handleInteraction)
            container.removeEventListener('mouseleave', handleInteraction)

            resizeObserver.disconnect()
            lwChart.remove()
            chartRef.current = null
            seriesMap.current = {}
        }
    }, [isTimeline, isFirstPane, timeScaleVisible]) // Dependency on scaleModes? No, we read current inside sync function? 
    // Wait, syncScaleModes closes over 'scaleModes' state variable if defined inside useEffect?
    // YES. We need to use functional update setScaleModes logic inside syncScaleModes or ref.
    // FIX: Define syncScaleModes to NOT depend on 'scaleModes' closure.
    // See revised logic below.

    // Update TimeScale visibility if prop changes
    useEffect(() => {
        if (chartRef.current) {
            chartRef.current.applyOptions({
                timeScale: { visible: timeScaleVisible }
            })
        }
    }, [timeScaleVisible])

    // React to Appearance Changes
    useEffect(() => {
        if (!chartRef.current) return
        chartRef.current.applyOptions({
            layout: {
                background: {
                    type: chartAppearance.backgroundType === 'solid' ? ColorType.Solid : ColorType.VerticalGradient,
                    color: chartAppearance.backgroundColor1,
                    topColor: chartAppearance.backgroundColor1,
                    bottomColor: chartAppearance.backgroundColor2
                }
            },
            grid: {
                vertLines: {
                    color: chartAppearance.gridColor,
                    visible: !isTimeline && (chartAppearance.gridLines === 'all' || chartAppearance.gridLines === 'vert')
                },
                horzLines: {
                    color: chartAppearance.gridColor,
                    visible: !isTimeline && (chartAppearance.gridLines === 'all' || chartAppearance.gridLines === 'horz')
                }
            },
            watermark: {
                visible: chartAppearance.watermark && !isTimeline,
                text: mainInfo?.ticker || '',
                color: 'rgba(255, 255, 255, 0.03)', // Ensure color persists
            }
        })
    }, [chartAppearance, isTimeline, mainInfo?.ticker, isFirstPane])

    // Track widths for hover detection
    const scaleWidths = useRef({})

    // Update Custom Scales & Measure Widths
    useEffect(() => {
        if (!chartRef.current) return

        const used = new Set()
        // if (!isTimeline) used.add('left') // Removed unconditional left

        seriesConfigs.forEach(s => {
            // Default to 'right' if not specified
            const sid = s.priceScaleId || 'right'
            used.add(sid)
        })

        // Explicitly hide default scales if they are NOT used
        // LWC enables 'right' by default, so we must disable it if we are using a custom scale only.
        if (!used.has('right')) {
            try { chartRef.current.priceScale('right').applyOptions({ visible: false }) } catch (e) { }
        }
        if (!used.has('left')) {
            try { chartRef.current.priceScale('left').applyOptions({ visible: false }) } catch (e) { }
        }

        used.forEach(scaleId => {
            // Treat defaults and custom IDs similarly
            const position = scaleId.includes('left') || scaleId === 'left' ? 'left' : 'right'
            try {
                const scale = chartRef.current.priceScale(scaleId)
                scale.applyOptions({
                    visible: true,
                    autoScale: true,
                    position: position,
                    scaleMargins: { top: 0.1, bottom: 0.1 }, // Reset margins to safe defaults
                    ticksVisible: true,
                    borderVisible: false
                })
            } catch (e) { }
        })

    }, [seriesConfigs, isTimeline])

    // ...



    // ... 

    {/* Dynamic Scale Controls */ }
    {/* We render a list of controls for active scales? */ }
    {/* For now, just keep Left/Right generic controls that toggle the "Main" left/right scales.
        Implementing full multi-scale controls overlay is complex without exact coords.
        But we can at least make sure the 'left' button works for Volume.
    */}

    // Update Series
    useEffect(() => {
        if (!chartRef.current) return

        // 1. Capture current range to prevent snap-back on data update
        const prevRange = chartRef.current.timeScale().getVisibleLogicalRange()

        const isOverlay = seriesConfigs.some(s => s.chartType === 'candle') // Rename type -> chartType to match Store

        seriesConfigs.forEach(config => {
            let series = seriesMap.current[config.id]
            const seriesData = config.data || data

            // PROTOCOL 2.0 RENDERER
            if (config.protocol === '2.0' && config.plots) {
                Object.entries(config.plots).forEach(([plotKey, plotDef]) => {
                    const subId = `${config.id}#${plotKey}`
                    let subSeries = seriesMap.current[subId]

                    // Create
                    if (!subSeries) {
                        const opts = {
                            color: plotDef.color || config.color || '#2962ff',
                            priceScaleId: config.priceScaleId || (config.meta?.type === 'overlay' ? 'right' : 'right'), // Use 'right' as default for overlay/subplot
                            // Check if overlay or separate pane? 
                            // ChartPane handles separate panes by being instantiated separately. 
                            // So 'right' is always the pane's main scale.
                            title: plotDef.title
                        }

                        if (plotDef.type === 'histogram') {
                            subSeries = chartRef.current.addHistogramSeries({
                                ...opts,
                                lineWidth: plotDef.lineWidth || 1
                            })
                        } else {
                            // Default Line
                            subSeries = chartRef.current.addLineSeries({
                                ...opts,
                                lineWidth: plotDef.lineWidth || 2,
                                lineStyle: plotDef.style === 'dashed' ? 2 : 0
                            })
                        }
                        seriesMap.current[subId] = subSeries
                    }

                    // Update Options (Visibility / Color)
                    // We assume store updates 'plots' config if user changes settings? 
                    // Or styles are stored separately? 
                    // useLayoutStore has 'styles' map? 
                    // Current store implementation puts settings into 'seriesConfig'. 
                    // So we read from `plotDef` (which should come from store state).

                    // Allow overriding visibility via `plotDef.visible`
                    // BUT respect parent config.visible (Master Switch) - AND Local Override (seriesVisible)
                    const localParentVisible = seriesVisible[config.id] !== undefined ? seriesVisible[config.id] : (config.visible !== false)
                    const isParentVisible = localParentVisible
                    const isChildVisible = plotDef.visible !== false
                    const isPlotVisible = isParentVisible && isChildVisible

                    subSeries.applyOptions({
                        visible: isPlotVisible,
                        color: plotDef.color
                    })

                    // Set Data
                    if (seriesData && seriesData.length > 0) {
                        const mappedData = seriesData.map(d => ({
                            time: d.time,
                            value: (d[plotKey] !== undefined && d[plotKey] !== null) ? Number(d[plotKey]) : NaN,
                            color: plotDef.type === 'histogram' ? (d[plotKey] >= 0 ? '#26a69a' : '#ef5350') : undefined
                        })).filter(d => !Number.isNaN(d.value))

                        // DEBUG: Check if we have data
                        if (mappedData.length > 0) {
                            console.log(`[ChartPane] Setting ${mappedData.length} pts for ${subId}. Type: ${plotDef.type} Color: ${plotDef.color}. Last:`, mappedData[mappedData.length - 1])
                        } else {
                            console.warn(`[ChartPane] Series ${subId} mappedData is EMPTY! Keys in data:`, Object.keys(seriesData[0]), `Looking for: ${plotKey}`)
                        }

                        subSeries.setData(mappedData)
                    }
                })
                return // Skip legacy logic
            }

            // Create series if needed (LEGACY)
            if (!series) {
                if (config.chartType === 'candle') {
                    series = chartRef.current.addCandlestickSeries({
                        upColor: '#26a69a',
                        downColor: '#ef5350',
                        borderVisible: false,
                        wickUpColor: '#26a69a',
                        wickDownColor: '#ef5350',
                        priceScaleId: config.priceScaleId || 'right', // Apply immediately
                    })
                } else if (config.chartType === 'line' || config.chartType === 'area') {
                    // Support area if needed, default to line
                    series = chartRef.current.addLineSeries({
                        color: config.color || '#2962ff',
                        lineWidth: config.lineWidth || 2,
                        priceScaleId: config.priceScaleId || 'right', // Apply immediately
                    })
                } else if (config.chartType === 'volume' || config.type === 'volume') { // Handle legacy 'type'
                    const isOverlayVolume = isOverlay // Logic: if pane has candles, vol is overlay
                    // Or follow explicit overlay props? 
                    // Store sets priceScaleId to 'volume_scale'.
                    const volScaleId = config.priceScaleId || config.priceScale || 'right'

                    series = chartRef.current.addHistogramSeries({
                        color: config.color || '#26a69a',
                        priceFormat: { type: 'volume' },
                        priceScaleId: volScaleId,
                    })

                    if (volScaleId === 'volume_scale') {
                        chartRef.current.priceScale(volScaleId).applyOptions({
                            scaleMargins: { top: 0.8, bottom: 0 },
                            visible: false
                        })
                    }
                }
                seriesMap.current[config.id] = series
            }

            // Set Data
            // Note: setData() resets the time scale by default. We counter this by restoring prevRange below.
            if (seriesData && seriesData.length > 0) {
                // Determine series type for validation context (optional, util handles general cases)
                // We use the shared reliable utility to sanitize EVERYTHING just before render.
                // This is the final firewall against crashing the renderer.

                if (config.chartType === 'candle') {
                    // 1. Cast & Clean (Strip garbage properties, ensure Numbers)
                    const cleanData = seriesData.map(d => ({
                        time: d.time,
                        open: d.open != null ? Number(d.open) : NaN,
                        high: d.high != null ? Number(d.high) : NaN,
                        low: d.low != null ? Number(d.low) : NaN,
                        close: d.close != null ? Number(d.close) : NaN
                    }))

                    // 2. Dedupe/Sort & Validate
                    // STRICT VALIDATION: Exclude any candle with NaN/-Inf/Inf values OR NULL TIME
                    const validData = mergeAndSortData([], cleanData).filter(d =>
                        d.time !== null && d.time !== undefined &&
                        Number.isFinite(d.open) &&
                        Number.isFinite(d.high) &&
                        Number.isFinite(d.low) &&
                        Number.isFinite(d.close)
                    )

                    if (cleanData.length !== validData.length) {
                        console.warn(`[ChartPane] Filtered ${cleanData.length - validData.length} invalid candles for ${config.id}`)
                    }

                    series.setData(validData)

                    const last = validData[validData.length - 1]
                    if (last && config.isMain) {
                        setOhlc(prev => ({
                            ...prev,
                            [config.id]: {
                                open: last.open,
                                high: last.high,
                                low: last.low,
                                close: last.close,
                                change: ((last.close - last.open) / last.open * 100)
                            }
                        }))
                    }
                } else if (config.chartType === 'line') {

                    // MULTI-LINE SUPPORT (e.g. Antigravity)
                    if (config.lines && Array.isArray(config.lines)) {
                        config.lines.forEach(lineConfig => {
                            const lineId = config.id + '_' + lineConfig.key
                            let subSeries = seriesMap.current[lineId]

                            // create if not exists
                            if (!subSeries) {
                                subSeries = chartRef.current.addLineSeries({
                                    color: lineConfig.color || config.color || '#2962ff',
                                    lineWidth: lineConfig.lineWidth || 2,
                                    lineStyle: lineConfig.lineStyle || 0, // 0=Solid, 2=Dashed
                                    priceScaleId: lineConfig.priceScaleId || 'right', // 'right' is default pane scale
                                    visible: lineConfig.visible !== false // default true
                                })
                                seriesMap.current[lineId] = subSeries
                            }

                            // Map Data
                            const subData = seriesData.map(d => ({
                                time: d.time,
                                value: (d[lineConfig.key] !== undefined && d[lineConfig.key] !== null) ? Number(d[lineConfig.key]) : NaN,
                            }))

                            // Filter valid
                            const validSubData = mergeAndSortData([], subData).filter(d => !Number.isNaN(d.value))
                            subSeries.setData(validSubData)
                        })

                        // We don't use the "main" series variable for data if lines are defined, 
                        // but we might need to update OHLC context?
                        // Just use the first line's value for OHLC display if needed.
                        const guideLine = config.lines[0]
                        const lastPoint = seriesData[seriesData.length - 1]
                        if (lastPoint && guideLine) {
                            setOhlc(prev => ({
                                ...prev,
                                [config.id]: { value: lastPoint[guideLine.key] }
                            }))
                        }

                    } else {
                        // STANDARD SINGLE LINE
                        // 1. Cast & Clean (Map close -> value, ensure Numbers)
                        const cleanData = seriesData.map(d => ({
                            time: d.time,
                            // Fix: If value is missing, default to NaN so validator catches it
                            value: (d.value !== undefined && d.value !== null) ? Number(d.value) : NaN,
                            color: d.color // Pass color directly if available
                        }))

                        // 2. Dedupe/Sort & Validate
                        const validData = mergeAndSortData([], cleanData).filter(d => !Number.isNaN(d.value))


                        // Debug log for ALL indicators


                        series.setData(validData)

                        const last = validData[validData.length - 1]
                        if (last) {
                            setOhlc(prev => ({
                                ...prev,
                                [config.id]: { value: last.value }
                            }))
                        }
                    }
                } else if (config.chartType === 'volume' || config.type === 'volume') {
                    // 1. Cast & Clean (Map volume -> value, ensure Numbers)
                    const cleanData = seriesData.map(d => {
                        const open = Number(d.open)
                        const close = Number(d.close)
                        const rawVal = d.value !== undefined ? d.value : d.volume
                        return {
                            time: d.time,
                            value: (rawVal !== undefined && rawVal !== null) ? Number(rawVal) : NaN,
                            color: d.color || ((close >= open) ? 'rgba(38, 166, 154, 0.5)' : 'rgba(239, 83, 80, 0.5)')
                        }
                    })

                    // 2. Dedupe/Sort & Validate
                    const validData = mergeAndSortData([], cleanData).filter(d => !Number.isNaN(d.value))

                    series.setData(validData)

                    const last = validData[validData.length - 1]
                    if (last) {
                        setOhlc(prev => ({
                            ...prev,
                            [config.id]: { value: last.value, volume: last.value }
                        }))
                    }
                } else if (config.id === 'BTC_GM2' && seriesData.length > 0) {

                    // HANDLING COMPLEX BTC_GM2 INDICATOR
                    // 1. Main Line (BTC_GM2)
                    const lineData = seriesData
                        .map(d => ({ time: d.time, value: d.BTC_GM2 }))
                        .filter(d => d.value !== undefined && d.value !== null && !Number.isNaN(Number(d.value)))
                    series.setData(lineData)

                    // 2. SMA Line (Orange)
                    const smaId = config.id + '_sma'
                    let smaSeries = seriesMap.current[smaId]
                    if (!smaSeries) {
                        smaSeries = chartRef.current.addLineSeries({
                            color: '#ff9800',
                            lineWidth: 1,
                            priceScaleId: config.priceScaleId || 'right'
                        })
                        seriesMap.current[smaId] = smaSeries
                    }
                    const smaData = seriesData
                        .map(d => ({ time: d.time, value: d.BTC_GM2_SMA }))
                        .filter(d => d.value !== undefined && d.value !== null && !Number.isNaN(Number(d.value)))
                    smaSeries.setData(smaData)

                    // 3. Background Zones (Histogram)
                    const zoneId = config.id + '_zone'
                    let zoneSeries = seriesMap.current[zoneId]
                    if (!zoneSeries) {
                        zoneSeries = chartRef.current.addHistogramSeries({
                            priceScaleId: 'overlay', // Custom scale
                            priceFormat: { type: 'custom', formatter: () => '' }
                        })
                        // Configure overlay scale to full height
                        chartRef.current.priceScale('overlay').applyOptions({
                            visible: false,
                            scaleMargins: { top: 0, bottom: 0 }
                        })
                        seriesMap.current[zoneId] = zoneSeries
                    }
                    const zoneData = seriesData.map(d => ({
                        time: d.time,
                        value: 1, // Full height relative to scale
                        color: d.Zone_Color || 'rgba(0,0,0,0)'
                    }))
                    zoneSeries.setData(zoneData)
                    // Move to back? LWC doesn't support z-index nicely, mostly distinct by creation order. 
                    // We created it AFTER main series, so it might cover?
                    // Histogram usually draws behind lines if rendered first? No control here.
                    // But opacity is low, so it should be fine.

                    // 4. Markers
                    const markers = []
                    seriesData.forEach(d => {
                        if (d.Signal_Buy) {
                            markers.push({ time: d.time, position: 'belowBar', color: '#00E676', shape: 'arrowUp', text: 'BUY' })
                        } else if (d.Signal_Sell) {
                            markers.push({ time: d.time, position: 'aboveBar', color: '#FF5252', shape: 'arrowDown', text: 'SELL' })
                        }
                    })
                    series.setMarkers(markers)
                }
                // Generic Fallback (if not caught by specific types above)
                else if (!config.chartType) {
                    // Fallback for generic line?
                    // Existing logic might have done it inside 'line' block assuming chartType is set.
                }
            }

            // Visibility
            if (isTimeline) {
                series.applyOptions({ visible: false })
            } else {
                const isVisible = seriesVisible[config.id] !== undefined ? seriesVisible[config.id] : true
                const opts = {
                    visible: isVisible,
                    color: config.color,
                    lineWidth: config.lineWidth,
                }
                if (config.chartType === 'candle') {
                    // Safe Defaults with aggressive fallback
                    const safeUp = sanitizeColor(config.upColor) || '#26a69a'
                    const safeDown = sanitizeColor(config.downColor) || '#ef5350'

                    opts.upColor = safeUp
                    opts.downColor = safeDown

                    // Borders
                    opts.borderVisible = config.borderVisible !== false
                    opts.borderUpColor = sanitizeColor(config.borderUpColor) || safeUp
                    opts.borderDownColor = sanitizeColor(config.borderDownColor) || safeDown

                    // Wicks
                    opts.wickVisible = config.wickVisible !== false
                    opts.wickUpColor = sanitizeColor(config.wickUpColor) || safeUp
                    opts.wickDownColor = sanitizeColor(config.wickDownColor) || safeDown

                    // Body Override (Transparent)
                    if (config.bodyVisible === false) {
                        opts.upColor = 'rgba(0, 0, 0, 0)'
                        opts.downColor = 'rgba(0, 0, 0, 0)'
                    }
                }
                if (config.priceScaleId) opts.priceScaleId = config.priceScaleId
                series.applyOptions(opts)
            }
        })

        // Cleanup old series
        Object.keys(seriesMap.current).forEach(id => {
            const isUsed = seriesConfigs.some(s => {
                if (s.id === id) return true
                if (id.startsWith(s.id + '#')) return true // Sub-series match
                return false
            })

            if (!isUsed) {
                if (seriesMap.current[id]) {
                    chartRef.current.removeSeries(seriesMap.current[id])
                    delete seriesMap.current[id]
                }
            }
        })

        // 2. Restore range & Scroll Preservation
        // Calculate total data points (Driver: Main Series or first available)
        // Assume all series are aligned
        const currentDataLength = seriesConfigs[0]?.data?.length || data?.length || 0
        const addedCount = currentDataLength - lastDataCount.current

        // Update Ref for next render
        lastDataCount.current = currentDataLength

        if (prevRange) {
            // Check if we loaded history (added data while at the start)
            // If we added data (>0) and we were near the left edge (< -5 or small positive)
            // Shift range to maintain visual position
            if (addedCount > 0 && prevRange.from < 20) {
                const newRange = {
                    from: prevRange.from + addedCount,
                    to: prevRange.to + addedCount
                }
                // Verify validity?
                chartRef.current.timeScale().setVisibleLogicalRange(newRange)
            } else {
                // Normal restore (e.g. data update, resize)
                chartRef.current.timeScale().setVisibleLogicalRange(prevRange)
            }
        } else {
            chartRef.current.timeScale().fitContent()

            // START AUTO, THEN LOCK MANUAL
            // Check if ANY series has data
            const hasData = seriesConfigs.some(s => s.data && s.data.length > 0) || (data && data.length > 0)

            if (isFirstLoad.current && hasData) {
                // Ensure default autoScale remains ON. No manual override.
                isFirstLoad.current = false
            }
        }

    }, [data, seriesConfigs, seriesVisible])

    // Apply strategy markers AND Antigravity Tier 2 markers
    useEffect(() => {
        if (!chartRef.current || id !== 'main-pane') return

        // Find main candlestick series
        const mainConfig = seriesConfigs.find(c => c.chartType === 'candle' && c.isMain)
        if (!mainConfig) return
        const mainSeries = seriesMap.current[mainConfig.id]
        if (!mainSeries) return

        let allMarkers = []

        // 1. Strategy Signals (from Store)
        const isStrategyVisible = seriesVisible['strategy-signals'] !== false
        const strategyConfig = seriesConfigs.find(c => c.id === 'strategy-signals')

        if (isStrategyVisible && strategyConfig && strategySignals && strategySignals.length > 0) {
            const strategyMarkers = strategySignals.map(signal => ({
                time: signal.time,
                position: signal.type === 'buy' ? 'belowBar' : 'aboveBar',
                color: signal.type === 'buy' ? '#26a69a' : '#ef5350',
                shape: signal.type === 'buy' ? 'arrowUp' : 'arrowDown',
                text: signal.type === 'buy' ? 'B' : 'S'
            }))
            allMarkers = [...allMarkers, ...strategyMarkers]
        }

        // 2. Antigravity Tier 2 (from Series Configs)
        const tier2Config = seriesConfigs.find(c => c.id === 'Antigravity_Tier2')
        const isTier2Visible = seriesVisible['Antigravity_Tier2'] !== false

        if (tier2Config && isTier2Visible && tier2Config.data && tier2Config.data.length > 0) {
            const tier2Markers = []
            tier2Config.data.forEach(d => {
                // MVRV Signals
                if (d.Signal_MVRV === 'Buy') {
                    tier2Markers.push({ time: d.time, position: 'belowBar', color: '#00E676', shape: 'arrowUp', text: 'MVRV Buy' })
                } else if (d.Signal_MVRV === 'Sell') {
                    tier2Markers.push({ time: d.time, position: 'aboveBar', color: '#FF5252', shape: 'arrowDown', text: 'MVRV Sell' })
                }

                // BTCM2 Signals
                if (d.Signal_BTCM2) {
                    // Check if duplicate time? LWC handles multiple markers on same time OK usually (stacks them?).
                    // If conflicts, maybe specific text?
                    tier2Markers.push({ time: d.time, position: 'belowBar', color: '#FFC400', shape: 'arrowUp', text: 'BTCM2' })
                }
            })
            allMarkers = [...allMarkers, ...tier2Markers]
        }

        // Apply all
        // Sort by time just in case
        allMarkers.sort((a, b) => a.time - b.time)
        mainSeries.setMarkers(allMarkers)

    }, [id, seriesConfigs, strategySignals, seriesVisible])

    // Update crosshair mode when magnetMode changes
    useEffect(() => {
        if (!chartRef.current) return

        chartRef.current.applyOptions({
            crosshair: {
                mode: magnetMode ? 1 : 0, // 1 = Magnet, 0 = Normal
            }
        })
    }, [magnetMode])

    // Scale Controls Handlers
    const toggleAuto = (scaleId) => {
        if (!chartRef.current) return
        const scale = chartRef.current.priceScale(scaleId)
        const opts = scale.options()
        scale.applyOptions({ autoScale: !opts.autoScale })

        setScaleModes(prev => {
            const current = prev[scaleId] || { autoScale: true, log: false }
            return {
                ...prev,
                [scaleId]: { ...current, autoScale: !opts.autoScale }
            }
        })
    }

    const toggleLog = (scaleId) => {
        if (!chartRef.current) return
        const scale = chartRef.current.priceScale(scaleId)
        const opts = scale.options()
        // 0 = Normal, 1 = Log
        const newMode = opts.mode === 1 ? 0 : 1
        scale.applyOptions({ mode: newMode })

        setScaleModes(prev => {
            const current = prev[scaleId] || { autoScale: true, log: false }
            return {
                ...prev,
                [scaleId]: { ...current, log: newMode === 1 }
            }
        })
    }

    // ... (handleMouseMove is unchanged, skipping in replacement if possible, but simpler to replace whole block if contiguous)
    // Actually toggle functions are 405-438.
    // list logic is 461-463.
    // I will do 2 chunks or 1 big chunk? They are separated by handleMouseMove.
    // I will do 2 chunks.
    // CHUNK 1: Toggles


    const handleMouseMove = (e) => {
        if (!paneRef.current || !chartRef.current) return
        const rect = paneRef.current.getBoundingClientRect()
        const x = e.clientX - rect.left
        const width = rect.width

        let scaleWidth = 80
        try {
            const timeWidth = chartRef.current.timeScale().width()
            const calc = width - timeWidth
            if (calc > 0) scaleWidth = calc
        } catch (err) { }

        const hitBuffer = 5

        if (x > width - (scaleWidth + hitBuffer)) setHoveredScale('right')
        else if (x < (50 + hitBuffer)) setHoveredScale('left')
        else setHoveredScale(null)
    }

    // Ref to track hovered scale for event listener access
    const hoveredScaleRef = useRef(null)
    useEffect(() => { hoveredScaleRef.current = hoveredScale }, [hoveredScale])

    // UNIFIED WHEEL HANDLER
    useEffect(() => {
        const container = paneRef.current
        if (!container || !chartRef.current) return

        const onWheel = (e) => {
            const rect = container.getBoundingClientRect()
            const x = e.clientX - rect.left
            const width = rect.width

            // Correct Hit Testing using PriceScale width
            let rightScaleWidth = 0
            let leftScaleWidth = 0
            try {
                // Get Left/Right prices scale widths directly
                const r = chartRef.current.priceScale('right')
                if (r) rightScaleWidth = r.width()

                const l = chartRef.current.priceScale('left')
                if (l) leftScaleWidth = l.width()
            } catch (e) { }

            // Fallback / Widen
            if (!rightScaleWidth || rightScaleWidth < 50) rightScaleWidth = 100
            const hitBuffer = 20

            let targetScale = null
            // Check Right
            if (x > width - (rightScaleWidth + hitBuffer)) targetScale = 'right'
            // Check Left
            else if (x < (leftScaleWidth + hitBuffer)) targetScale = 'left'

            // --- 1. PRICE SCALE ZOOM (Vertical) ---
            if (targetScale) {
                e.preventDefault()
                e.stopPropagation()

                const scale = chartRef.current.priceScale(targetScale)

                // Disable AutoScale when manually zooming
                const opts = scale.options()
                if (opts.autoScale) {
                    scale.applyOptions({ autoScale: false })
                    setScaleModes(prev => ({
                        ...prev,
                        [targetScale]: { ...prev[targetScale], autoScale: false }
                    }))
                }

                // Умный зум: нелинейное масштабирование для большего диапазона
                const currentMargins = opts.scaleMargins || { top: 0.1, bottom: 0.1 }

                // Текущий зум-уровень (0 = максимальный зум, 0.98 = максимальное отдаление)
                const currentSum = currentMargins.top + currentMargins.bottom

                // Направление зума
                const isZoomIn = e.deltaY < 0

                // Нелинейная функция зума - быстрее в середине, медленнее на краях
                let delta
                if (isZoomIn) {
                    // Приближение: чем ближе к 0, тем медленнее
                    delta = -0.02 * (1 + currentSum * 2)
                } else {
                    // Отдаление: чем ближе к 1, тем медленнее
                    delta = 0.02 * (2 - currentSum)
                }

                let newSum = currentSum + delta

                // Строгие ограничения API
                newSum = Math.max(0.01, Math.min(0.98, newSum))

                // Распределяем поровну между top и bottom
                const newTop = newSum / 2
                const newBottom = newSum / 2

                scale.applyOptions({
                    scaleMargins: {
                        top: newTop,
                        bottom: newBottom,
                    },
                })





                // --- 2. TIME SCALE ZOOM (Chart Area) ---
            } else {
                e.preventDefault()
                e.stopPropagation()

                const ts = chartRef.current.timeScale()
                const range = ts.getVisibleLogicalRange()
                if (!range) return

                const span = range.to - range.from
                const factor = (span * 0.1) * Math.sign(e.deltaY)

                const newFrom = range.from - factor

                ts.setVisibleLogicalRange({
                    from: newFrom,
                    to: range.to
                })
            }
        }

        // Use Capture Phase to ensure we get event before LWC
        container.addEventListener('wheel', onWheel, { passive: false, capture: true })
        return () => container.removeEventListener('wheel', onWheel, { capture: true })
    }, [])

    const handleMouseLeave = () => setHoveredScale(null)
    const toggleVisibility = (sId) => {
        const newVal = !seriesVisible[sId]
        setSeriesVisible(prev => ({ ...prev, [sId]: newVal }))
    }
    const hideSeries = (sId) => {
        setSeriesVisible(prev => ({ ...prev, [sId]: false }))
    }


    useImperativeHandle(ref, () => ({
        chart: chartRef.current,
        id
    }))

    // Prepare Scale Lists for Rendering
    const leftScales = []
    const rightScales = []
    const usedIds = new Set()

    // Always include defaults if enabled (or checked for usage)
    // Left scale only if explicitly used
    // usedIds.add('right') // REMOVED UNCONDITIONAL ADD

    seriesConfigs.forEach(s => {
        const sid = s.priceScaleId || 'right'
        usedIds.add(sid)
    })

    usedIds.forEach(id => {
        // Treat defaults and custom IDs similarly
        const pos = id.includes('left') || id === 'left' ? 'left' : 'right'
        if (pos === 'left') leftScales.push(id)
        else rightScales.push(id)
    })

    return (
        <div
            ref={paneRef}
            className="chart-pane"
            style={{ height: height, position: 'relative', width: '100%' }}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
        >
            {/* Scale Controls overlays */}
            {!isTimeline && (
                <>
                    <div
                        className="scale-controls scale-controls--left"
                        style={{
                            opacity: hoveredScale === 'left' ? 1 : 0,
                            pointerEvents: hoveredScale === 'left' ? 'auto' : 'none',
                            zIndex: 50,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px'
                        }}
                    >
                        {leftScales.map(sid => (
                            <div key={sid} className="scale-group" style={{ display: 'flex', gap: '2px' }}>
                                <button className={`scale-btn ${scaleModes[sid]?.autoScale ? 'active' : ''}`} onClick={() => toggleAuto(sid)}>A</button>
                                <button className={`scale-btn ${scaleModes[sid]?.log ? 'active' : ''}`} onClick={() => toggleLog(sid)}>L</button>
                            </div>
                        ))}
                    </div>
                    <div
                        className="scale-controls scale-controls--right"
                        style={{
                            opacity: hoveredScale === 'right' ? 1 : 0,
                            pointerEvents: hoveredScale === 'right' ? 'auto' : 'none',
                            zIndex: 50,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px'
                        }}
                    >
                        {rightScales.map(sid => (
                            <div key={sid} className="scale-group" style={{ display: 'flex', gap: '2px' }}>
                                <button className={`scale-btn ${scaleModes[sid]?.autoScale ? 'active' : ''}`} onClick={() => toggleAuto(sid)}>A</button>
                                <button className={`scale-btn ${scaleModes[sid]?.log ? 'active' : ''}`} onClick={() => toggleLog(sid)}>L</button>
                            </div>
                        ))}
                    </div>
                </>
            )}

            {/* Render Headers for each series */}
            {!isTimeline && (
                <div className="chart-panel__header-wrapper">
                    {seriesConfigs.map(config => {
                        const sOhlc = ohlc[config.id] || {}
                        const isVisible = seriesVisible[config.id] !== false

                        if (config.chartType === 'candle') { // Check chartType
                            const priceColor = (sOhlc.change || 0) >= 0 ? '#26a69a' : '#ef5350'
                            return (
                                <div className="chart-panel__ticker-row" key={config.id}>
                                    <div className="ticker-info">
                                        <span
                                            className="ticker-text"
                                            style={{ fontWeight: 'bold', marginRight: '8px', cursor: 'pointer' }}
                                            onClick={onSymbolSearchClick}
                                        >
                                            {mainInfo?.ticker}
                                        </span>
                                        <span className="timeframe-text" style={{ color: '#787b86' }}>{mainInfo?.timeframe || '1d'}</span>
                                        <span className="exchange">{mainInfo?.exchange || 'CRYPTO'}</span>
                                        <SeriesMenu
                                            name={mainInfo?.ticker}
                                            color="#26a69a"
                                            priceScale="right"
                                            hoverOnly
                                            paneIndex={paneIndex}
                                            totalPanes={totalPanes}
                                            paneSeriesCount={seriesConfigs.length}
                                            onMoveToPane={(dir) => onMoveSeries?.(config.id, dir)}
                                            onScaleChange={() => { }}
                                            onHide={() => hideSeries(config.id)}
                                        />
                                        <div className="move-controls" style={{ display: 'inline-flex', gap: '2px', marginLeft: '6px' }}>
                                            <button
                                                className="action-btn"
                                                style={{ opacity: canMoveUp ? 1 : 0.3, cursor: canMoveUp ? 'pointer' : 'default' }}
                                                disabled={!canMoveUp}
                                                onClick={() => onMovePane?.(-1)}
                                                title="Move Pane Up"
                                            >
                                                {'\u25B2'}
                                            </button>
                                            <button
                                                className="action-btn"
                                                style={{ opacity: canMoveDown ? 1 : 0.3, cursor: canMoveDown ? 'pointer' : 'default' }}
                                                disabled={!canMoveDown}
                                                onClick={() => onMovePane?.(1)}
                                                title="Move Pane Down"
                                            >
                                                ▼
                                            </button>
                                        </div>
                                    </div>
                                    <span className="ohlc-group">
                                        <span className="ohlc-item"><span className="label">O</span><span className="value">{sOhlc.open?.toFixed(2)}</span></span>
                                        <span className="ohlc-item"><span className="label">H</span><span className="value">{sOhlc.high?.toFixed(2)}</span></span>
                                        <span className="ohlc-item"><span className="label">L</span><span className="value">{sOhlc.low?.toFixed(2)}</span></span>
                                        <span className="ohlc-item"><span className="label">C</span><span className="value">{sOhlc.close?.toFixed(2)}</span></span>
                                        <span className="change" style={{ color: priceColor }}>
                                            {(sOhlc.change || 0) >= 0 ? '+' : ''}{(sOhlc.change || 0).toFixed(2)} ({(sOhlc.change || 0).toFixed(2)}%)
                                        </span>
                                    </span>
                                </div>
                            )
                        } else {
                            // Simple render for other types
                            return (
                                <div className="chart-panel__indicators-row" key={config.id}>
                                    <div className={`indicator ${!isVisible ? 'indicator--hidden' : ''}`} style={{ color: config.color }}>
                                        <button className={`eye-btn ${!isVisible ? 'eye-btn--off' : ''}`} onClick={() => toggleVisibility(config.id)}>
                                            {isVisible ? '\u25CF' : '\u25CB'}
                                        </button>
                                        <span className="ind-name">{config.title || config.chartType || config.type}</span>
                                        <span className="ind-value">{sOhlc.value?.toFixed(2)}{sOhlc.volume ? formatVolume(sOhlc.volume) : ''}</span>
                                        <div className="action-buttons">
                                            <button
                                                className="action-btn"
                                                title="Настройки"
                                                onClick={() => onOpenSettings?.(config.id)}
                                            >
                                                {'\u2699'}
                                            </button>

                                            {/* UI for Moving Series (Floor System) */}
                                            {/* We rely on SeriesMenu for advanced moves, but can add quick up/down here? */}
                                            {/* Prompt asked for: 'Menu (or buttons) for each series: Move to New Pane Below, Move to Pane Above' */}
                                            {/* Let's replicate Pane buttons but for Series moving? */}
                                            {/* No, let's strictly follow SeriesMenu which sends 'to_pane_above', etc. */}

                                            <SeriesMenu
                                                name={config.title || 'Line'}
                                                color={config.color}
                                                priceScale={config.priceScaleId || 'right'}
                                                paneIndex={paneIndex}
                                                totalPanes={totalPanes}
                                                paneSeriesCount={seriesConfigs.length}
                                                onMoveToPane={(dir) => onMoveSeries?.(config.id, dir)}
                                                onScaleChange={(mode) => onScaleChange?.(config.id, mode)}
                                                onHide={() => hideSeries(config.id)}
                                                onRemove={() => onRemoveSeries?.(config.id)}
                                                onSettings={() => onOpenSettings?.(config.id)}
                                            />
                                            <button
                                                className="action-btn action-btn--danger"
                                                title="Удалить"
                                                onClick={() => onRemoveSeries?.(config.id)}
                                            >
                                                {'\u2715'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )
                        }
                    })}
                </div>
            )
            }



            <div ref={containerRef} className="chart-panel__chart" style={{ width: '100%', height: '100%' }} />

            {/* Watermark */}
            {
                mainInfo && (
                    <div className="chart-pane__watermark" style={{ ...watermarkStyle, display: isTimeline ? 'none' : 'flex' }}>
                        {mainInfo.ticker}
                    </div>
                )
            }

            {/* Drawings Overlay */}
            {
                !isTimeline && chartRef.current && (
                    <DrawingsManager
                        chart={chartRef.current}
                        seriesConfigs={seriesConfigs}
                        seriesMap={seriesMap}
                        width={containerRef.current?.clientWidth}
                        height={containerRef.current?.clientHeight}
                        paneId={id}
                        magnetMode={magnetMode}
                        drawingsVisible={drawingsVisible}
                    />
                )
            }
        </div>
    )
})

const watermarkStyle = {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    fontSize: '64px',
    fontWeight: 'bold',
    color: 'rgba(255, 255, 255, 0.03)',
    pointerEvents: 'none',
    zIndex: 0,
    justifyContent: 'center',
    alignItems: 'center',
    userSelect: 'none',
}

export default memo(ChartPane)



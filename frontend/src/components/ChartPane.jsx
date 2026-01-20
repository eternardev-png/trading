import { useEffect, useRef, useState, useImperativeHandle, forwardRef, memo } from 'react'
import { createChart, ColorType } from 'lightweight-charts'
import { useLayoutStore } from '../stores/useLayoutStore'
import SeriesMenu from './SeriesMenu'
import DrawingsManager from './DrawingsManager'
import './ChartPanel.scss' // Reusing existing styles

// Helper to format volume
const formatVolume = (vol) => {
    if (!vol) return '0'
    if (vol >= 1e9) return (vol / 1e9).toFixed(2) + 'B'
    if (vol >= 1e6) return (vol / 1e6).toFixed(2) + 'M'
    if (vol >= 1e3) return (vol / 1e3).toFixed(1) + 'K'
    return vol.toFixed(0)
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
    onChartReady
}, ref) => {
    const containerRef = useRef(null)
    const chartRef = useRef(null)
    const seriesMap = useRef({})

    const [ohlc, setOhlc] = useState({})
    const [seriesVisible, setSeriesVisible] = useState({})

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
                background: { type: ColorType.Solid, color: '#131722' },
                textColor: '#787b86',
            },
            grid: {
                vertLines: { color: 'rgba(42, 46, 57, 0.5)', visible: !isTimeline },
                horzLines: { color: 'rgba(42, 46, 57, 0.5)', visible: !isTimeline },
            },
            rightPriceScale: {
                visible: !isTimeline,
                borderVisible: false,
                scaleMargins: { top: 0.05, bottom: 0.12 },
            },
            leftPriceScale: {
                visible: !isTimeline,
                borderVisible: false,
                scaleMargins: { top: 0.05, bottom: 0.12 },
            },
            timeScale: {
                visible: Boolean(isTimeline),
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
                visible: isFirstPane && !isTimeline,
                fontSize: 64,
                horzAlign: 'center',
                vertAlign: 'center',
                color: 'rgba(255, 255, 255, 0.03)',
                text: mainInfo?.ticker || '',
            },
            handleScale: {
                axisPressedMouseMove: true,
                mouseWheel: true,
                pinch: false, // Disable pinch to prevent accidental zoom on trackpad/swipes
            },
            kineticScroll: {
                touch: true,
                mouse: true,
            },
            handleScroll: {
                mouseWheel: true,
                pressedMouseMove: true,
                horzTouchDrag: true,
                vertTouchDrag: true,
            },
        })

        chartRef.current = lwChart

        // Force enforce options just in case
        lwChart.timeScale().applyOptions({
            fixLeftEdge: false,
            fixRightEdge: false,
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

        // Crosshair handler
        lwChart.subscribeCrosshairMove(param => {
            if (param.time) {
                const newOhlc = {}
                seriesConfigs.forEach(config => {
                    const series = seriesMap.current[config.id]
                    if (series) {
                        const d = param.seriesData.get(series)
                        if (d) {
                            let change = 0
                            if (config.type === 'candle') {
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

        return () => {
            resizeObserver.disconnect()
            lwChart.remove()
            chartRef.current = null
            seriesMap.current = {}
        }
    }, [isTimeline, isFirstPane])

    // Update Series
    useEffect(() => {
        if (!chartRef.current) return

        // 1. Capture current range to prevent snap-back on data update
        const prevRange = chartRef.current.timeScale().getVisibleLogicalRange()

        const isOverlay = seriesConfigs.some(s => s.type === 'candle')

        seriesConfigs.forEach(config => {
            let series = seriesMap.current[config.id]
            const seriesData = config.data || data

            // Create series if needed
            if (!series) {
                if (config.type === 'candle') {
                    series = chartRef.current.addCandlestickSeries({
                        upColor: '#26a69a',
                        downColor: '#ef5350',
                        borderVisible: false,
                        wickUpColor: '#26a69a',
                        wickDownColor: '#ef5350',
                    })
                } else if (config.type === 'line') {
                    series = chartRef.current.addLineSeries({
                        color: config.color || '#2962ff',
                        lineWidth: config.lineWidth || 2,
                        priceScaleId: config.priceScaleId || 'right',
                    })
                } else if (config.type === 'volume') {
                    const isOverlayVolume = isOverlay
                    const volScaleId = isOverlayVolume ? 'volume_scale' : 'right'

                    series = chartRef.current.addHistogramSeries({
                        color: config.color || '#26a69a',
                        priceFormat: { type: 'volume' },
                        priceScaleId: volScaleId,
                    })

                    if (isOverlayVolume) {
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
                if (config.type === 'candle') {
                    series.setData(seriesData)
                    const last = seriesData[seriesData.length - 1]
                    if (last && !isTimeline && config.isMain) {
                        const isUp = last.close >= last.open
                        const color = isUp ? '#26a69a' : '#ef5350'
                        series.applyOptions({
                            priceLineVisible: true,
                            lastValueVisible: true,
                            priceLineColor: color,
                            priceLineWidth: 1,
                            priceLineStyle: 2,
                        })
                    }
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
                } else if (config.type === 'line') {
                    const lineData = seriesData.map(d => ({
                        time: d.time,
                        value: d.value !== undefined ? d.value : d.close
                    }))
                    series.setData(lineData)
                    const last = lineData[lineData.length - 1]
                    if (last) {
                        setOhlc(prev => ({
                            ...prev,
                            [config.id]: { value: last.value }
                        }))
                    }
                } else if (config.type === 'volume') {
                    const volData = seriesData.map(d => ({
                        time: d.time,
                        value: d.volume,
                        color: d.close >= d.open ? 'rgba(38, 166, 154, 0.5)' : 'rgba(239, 83, 80, 0.5)'
                    }))
                    series.setData(volData)
                    const last = seriesData[seriesData.length - 1]
                    if (last) {
                        setOhlc(prev => ({
                            ...prev,
                            [config.id]: { value: last.volume, volume: last.volume }
                        }))
                    }
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
                if (config.priceScaleId) opts.priceScaleId = config.priceScaleId
                series.applyOptions(opts)
            }
        })

        // Cleanup old series
        Object.keys(seriesMap.current).forEach(id => {
            if (!seriesConfigs.find(s => s.id === id)) {
                if (seriesMap.current[id]) {
                    chartRef.current.removeSeries(seriesMap.current[id])
                    delete seriesMap.current[id]
                }
            }
        })

        // 2. Restore range if it existed (preserves scroll position including infinite scroll)
        if (prevRange) {
            chartRef.current.timeScale().setVisibleLogicalRange(prevRange)
        } else {
            // First load: Fit content or set default range
            chartRef.current.timeScale().fitContent()
        }

    }, [data, seriesConfigs, seriesVisible])

    // Scale Controls Handlers
    const toggleAuto = (scaleId) => {
        if (!chartRef.current) return
        const scale = chartRef.current.priceScale(scaleId)
        const opts = scale.options()
        scale.applyOptions({ autoScale: !opts.autoScale })
        setScaleModes(prev => ({ ...prev, [scaleId]: { ...prev[scaleId], autoScale: !opts.autoScale } }))
    }

    const toggleLog = (scaleId) => {
        if (!chartRef.current) return
        const scale = chartRef.current.priceScale(scaleId)
        const opts = scale.options()
        const newMode = opts.mode === 1 ? 0 : 1
        scale.applyOptions({ mode: newMode })
        setScaleModes(prev => ({ ...prev, [scaleId]: { ...prev[scaleId], log: newMode === 1 } }))
    }

    const handleMouseMove = (e) => {
        if (!containerRef.current) return
        const rect = containerRef.current.getBoundingClientRect()
        const x = e.clientX - rect.left
        const y = e.clientY - rect.top
        const width = rect.width
        const height = rect.height
        const scaleWidth = 60
        const bottomAreaHeight = 100

        if (y > height - bottomAreaHeight) {
            if (x > width - scaleWidth) setHoveredScale('right')
            else if (x < scaleWidth) setHoveredScale('left')
            else setHoveredScale(null)
        } else {
            setHoveredScale(null)
        }
    }

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

    return (
        <div
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
                        style={{ opacity: hoveredScale === 'left' ? 1 : 0, pointerEvents: hoveredScale === 'left' ? 'auto' : 'none' }}
                    >
                        <button className={`scale-btn ${scaleModes.left.autoScale ? 'active' : ''}`} onClick={() => toggleAuto('left')}>A</button>
                        <button className={`scale-btn ${scaleModes.left.log ? 'active' : ''}`} onClick={() => toggleLog('left')}>L</button>
                    </div>
                    <div
                        className="scale-controls scale-controls--right"
                        style={{ opacity: hoveredScale === 'right' ? 1 : 0, pointerEvents: hoveredScale === 'right' ? 'auto' : 'none' }}
                    >
                        <button className={`scale-btn ${scaleModes.right.autoScale ? 'active' : ''}`} onClick={() => toggleAuto('right')}>A</button>
                        <button className={`scale-btn ${scaleModes.right.log ? 'active' : ''}`} onClick={() => toggleLog('right')}>L</button>
                    </div>
                </>
            )}

            {/* Render Headers for each series */}
            {!isTimeline && (
                <div className="chart-panel__header-wrapper">
                    {seriesConfigs.map(config => {
                        const sOhlc = ohlc[config.id] || {}
                        const isVisible = seriesVisible[config.id] !== false

                        if (config.type === 'candle') {
                            const priceColor = (sOhlc.change || 0) >= 0 ? '#26a69a' : '#ef5350'
                            return (
                                <div className="chart-panel__ticker-row" key={config.id}>
                                    <div className="ticker-info">
                                        <button className="symbol-search-btn" onClick={() => onSymbolSearchClick?.()}>
                                            <span className="ticker-text">{mainInfo?.ticker}</span>
                                        </button>
                                        <div className="info-separator"></div>
                                        <span className="timeframe">{mainInfo?.timeframe}</span>
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
                                            {isVisible ? '👁' : '👁‍🗨'}
                                        </button>
                                        <span className="ind-name">{config.title || config.type}</span>
                                        <span className="ind-value">{sOhlc.value?.toFixed(2)}</span>
                                        <div className="action-buttons">
                                            <button className="action-btn" title="Настройки">⚙</button>
                                            <SeriesMenu
                                                name={config.title || 'Line'}
                                                color={config.color}
                                                priceScale={config.priceScaleId || 'right'}
                                                paneIndex={paneIndex}
                                                totalPanes={totalPanes}
                                                paneSeriesCount={seriesConfigs.length}
                                                onMoveToPane={(dir) => onMoveSeries?.(config.id, dir)}
                                                onScaleChange={(side) => onScaleChange?.(config.id, side)}
                                                onHide={() => hideSeries(config.id)}
                                                onRemove={() => onRemoveSeries?.(config.id)}
                                            />
                                            <button
                                                className="action-btn action-btn--danger"
                                                title="Удалить"
                                                onClick={() => onRemoveSeries?.(config.id)}
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )
                        }
                    })}
                </div>
            )}

            <div ref={containerRef} className="chart-panel__chart" style={{ width: '100%', height: '100%' }} />
            {mainInfo && (
                <div className="chart-pane__watermark" style={{ ...watermarkStyle, display: isTimeline ? 'none' : 'flex' }}>
                    {mainInfo.ticker}
                </div>
            )}
            {/* Drawings Overlay */}
            {!isTimeline && chartRef.current && seriesMap.current[seriesConfigs[0]?.id] && (
                <DrawingsManager
                    chart={chartRef.current}
                    series={seriesMap.current[seriesConfigs[0]?.id]} // Use main series for price conversion
                    width={containerRef.current?.clientWidth}
                    height={containerRef.current?.clientHeight}
                />
            )}
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

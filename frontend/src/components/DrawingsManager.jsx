import React, { useRef, useState, useEffect, useMemo } from 'react'
import { useLayoutStore } from '../stores/useLayoutStore'
import { pointToCoordinates, coordinatesToPoint, getMainSeries, getLogicalIndex } from '../utils/coordinates'

function DrawingsManager({ chart, seriesConfigs, seriesMap, width, height, paneId }) {
    const { activeTool, setActiveTool, drawings, addDrawing, updateDrawing } = useLayoutStore()
    const paneDrawings = drawings[paneId] || []

    const POINTS_NEEDED = {
        'triangle': 3,
        'parallel-channel': 3,
        'fib-extension': 3,
        'pattern-triangle': 4,
        'pattern-abcd': 4,
        'pattern-head-shoulders': 5,
    }

    const [currentDrawing, setCurrentDrawing] = useState(null)
    const [, setTick] = useState(0)

    const mainSeries = useMemo(() => getMainSeries(seriesConfigs, seriesMap), [seriesConfigs, seriesMap])

    // Retrieve data for off-screen calc
    const mainData = useMemo(() => {
        if (!seriesConfigs) return []
        const conf = seriesConfigs.find(s => s.chartType === 'candle') || seriesConfigs.find(s => s.isMain) || seriesConfigs[0]
        return conf?.data || []
    }, [seriesConfigs])

    const getPoint = (time, price) => pointToCoordinates({ time, price }, chart, mainSeries, mainData)
    const getCoord = (x, y) => {
        if (!mainSeries) return null
        return coordinatesToPoint({ x, y }, chart, mainSeries)
    }
    const getLogical = (time) => getLogicalIndex(time, chart, mainData)

    const svgRef = useRef(null)

    // --- Geometry Helpers ---
    const getExtendedLine = (p1, p2, width, height) => {
        if (!p1 || !p2) return null
        const dx = p2.x - p1.x
        const dy = p2.y - p1.y
        if (dx === 0) return { x1: p1.x, y1: 0, x2: p1.x, y2: height } // Vertical

        const slope = dy / dx
        const yAt0 = p1.y - slope * p1.x
        const yAtWidth = p1.y + slope * (width - p1.x)

        return { x1: 0, y1: yAt0, x2: width, y2: yAtWidth }
    }

    const getRay = (p1, p2, width, height) => {
        if (!p1 || !p2) return null
        const dx = p2.x - p1.x
        const dy = p2.y - p1.y
        if (dx === 0) {
            return { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y > p1.y ? height : 0 }
        }
        const slope = dy / dx
        const targetX = p2.x > p1.x ? width : 0
        const targetY = p1.y + slope * (targetX - p1.x)
        return { x1: p1.x, y1: p1.y, x2: targetX, y2: targetY }
    }


    // --- Render Helpers ---
    const renderDrawing = (d, isPreview = false) => {
        const color = d.options?.color || '#2962ff'
        const lineWidth = d.options?.width || 2
        const style = isPreview ? { opacity: 0.8, strokeDasharray: '5,5' } : {}
        const commonProps = { stroke: color, strokeWidth: lineWidth, ...style, pointerEvents: isPreview ? 'none' : 'visibleStroke' }

        // Special Case: Brush (uses points array)
        if (d.type === 'brush') {
            const points = d.points || []
            if (points.length < 2) return null
            const pathData = points.map((pt, i) => {
                const coord = getPoint(pt.time, pt.price)
                if (!coord) return ''
                return (i === 0 ? 'M' : 'L') + coord.x + ' ' + coord.y
            }).join(' ')
            return <path d={pathData} fill="none" stroke={color} strokeWidth={lineWidth} strokeLinejoin="round" strokeLinecap="round" pointerEvents="visibleStroke" />
        }

        const p1 = getPoint(d.p1.time, d.p1.price)
        const p2 = d.p2 ? getPoint(d.p2.time, d.p2.price) : p1
        // For Triangle (3 points)
        const p3 = d.p3 ? getPoint(d.p3.time, d.p3.price) : null

        if (!p1) return null

        switch (d.type) {
            case 'trend': return p2 ? <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} {...commonProps} /> : null
            case 'ray': return p2 ? <line {...getRay(p1, p2, width, height)} {...commonProps} /> : null // Using spread
            case 'extended': return p2 ? <line {...getExtendedLine(p1, p2, width, height)} {...commonProps} /> : null
            case 'horizontal': return <line x1={0} y1={p1.y} x2={width} y2={p1.y} {...commonProps} />
            case 'vertical': return <line x1={p1.x} y1={0} x2={p1.x} y2={height} {...commonProps} />
            case 'text': return <text x={p1.x} y={p1.y} fill={color} fontSize="14" fontFamily="Arial" pointerEvents="visibleFill">{d.text || 'Text'}</text>

            case 'measure':
                if (!p2) return null
                const mx = Math.min(p1.x, p2.x), my = Math.min(p1.y, p2.y)
                const mw = Math.abs(p2.x - p1.x), mh = Math.abs(p2.y - p1.y)
                const priceDiff = d.p2.price - d.p1.price
                const percent = (priceDiff / d.p1.price) * 100
                const idx1 = getLogical(d.p1.time), idx2 = getLogical(d.p2.time)
                const bars = (idx1 !== null && idx2 !== null) ? Math.abs(idx2 - idx1) : '?'
                return (
                    <g>
                        <rect x={mx} y={my} width={mw} height={mh} fill={color} fillOpacity="0.1" stroke={color} strokeWidth="1" />
                        {!isPreview && (
                            <foreignObject x={mx} y={my - 30} width={150} height={50} style={{ overflow: 'visible' }}>
                                <div style={{ background: '#1e222d', color: '#fff', padding: '4px', borderRadius: '4px', fontSize: '11px', border: '1px solid #2a2e39', whiteSpace: 'nowrap' }}>
                                    <div>{bars} bars</div>
                                    <div>{priceDiff.toFixed(2)} ({percent.toFixed(2)}%)</div>
                                </div>
                            </foreignObject>
                        )}
                    </g>
                )

            case 'fib':
                if (!p2) return null
                const levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1]
                const dy = p2.y - p1.y
                return (
                    <g {...style}>
                        <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={color} strokeWidth={1} strokeDasharray="2,2" />
                        {levels.map(lvl => (
                            <line key={lvl} x1={p1.x} y1={p1.y + dy * lvl} x2={p2.x} y2={p1.y + dy * lvl} stroke={color} strokeWidth={1} />
                        ))}
                    </g>
                )

            case 'rectangle':
                if (!p2) return null
                const rx = Math.min(p1.x, p2.x), ry = Math.min(p1.y, p2.y)
                const rw = Math.abs(p2.x - p1.x), rh = Math.abs(p2.y - p1.y)
                return <rect x={rx} y={ry} width={rw} height={rh} stroke={color} strokeWidth={lineWidth} fill={color} fillOpacity="0.15" {...style} />

            case 'circle':
                if (!p2) return null
                const radX = Math.abs(p2.x - p1.x), radY = Math.abs(p2.y - p1.y)
                return <ellipse cx={p1.x} cy={p1.y} rx={radX} ry={radY} stroke={color} strokeWidth={lineWidth} fill={color} fillOpacity="0.15" {...style} />

            case 'arrow':
                if (!p2) return null
                const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x)
                const headLen = 15
                const h1x = p2.x - headLen * Math.cos(angle - Math.PI / 6), h1y = p2.y - headLen * Math.sin(angle - Math.PI / 6)
                const h2x = p2.x - headLen * Math.cos(angle + Math.PI / 6), h2y = p2.y - headLen * Math.sin(angle + Math.PI / 6)
                return (
                    <g {...style}>
                        <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={color} strokeWidth={lineWidth} />
                        <path d={`M ${p2.x} ${p2.y} L ${h1x} ${h1y} L ${h2x} ${h2y} Z`} fill={color} stroke={color} strokeWidth={1} />
                    </g>
                )

            case 'triangle':
                // p1, p2, (p3 or mouse for preview)
                if (!p2) return null
                // If isPreview and no p3, we are dragging p2. If p2 exists but no p3, we are dragging p3 (handled in component logic via currentDrawing state steps)
                // Actually helper logic: 
                // Step 1: p1 exists, p2 is mouse.
                // Step 2: p1, p2 fixed, p3 is mouse.
                const tp3 = p3 || p2 // Fallback if p3 not set yet
                return <polygon points={`${p1.x},${p1.y} ${p2.x},${p2.y} ${tp3.x},${tp3.y}`} stroke={color} strokeWidth={lineWidth} fill={color} fillOpacity="0.15" {...style} />

            case 'long-position':
            case 'short-position':
                if (!p2) return null
                // p1 is Entry, p2 indicates Stop Loss level.
                // Target is auto-calculated (Risk * 2).
                const isLong = d.type === 'long-position'
                const entryPrice = d.p1.price
                const stopPrice = d.p2.price
                const risk = Math.abs(entryPrice - stopPrice)
                // Default RR 1:2
                const targetPrice = isLong ? entryPrice + risk * 2 : entryPrice - risk * 2

                // Coords
                const entryY = p1.y
                const stopY = p2.y
                // Need coordinate for target price. Can use series.priceToCoordinate or just extrapolate pixels if linear? 
                // Better use priceToCoordinate via our helper
                const targetPoint = getPoint(d.p1.time, targetPrice)
                const targetY = targetPoint ? targetPoint.y : (isLong ? entryY - (stopY - entryY) * 2 : entryY + (entryY - stopY) * 2) // Fallback pixel math

                // Width: Extend to right or fixed width?
                // TradingView extends to right usually. Let's use fixed width 200px or between p1.x and p2.x + extra?
                // Let's make it cover time range from p1 to p2 + extrapolation?
                // Simple: Fixed width rectangle starting at p1.x ending at p2.x (or p1.x + 100).
                // Let's use p1.x to p2.x as width (like measure tool).
                const posW = Math.max(50, Math.abs(p2.x - p1.x))
                const posX = p1.x

                return (
                    <g {...style} opacity={0.6}>
                        {/* Stop Zone (Red) */}
                        <rect x={posX} y={Math.min(entryY, stopY)} width={posW} height={Math.abs(entryY - stopY)} fill="#ef5350" fillOpacity="0.3" stroke="none" />
                        {/* Target Zone (Green) */}
                        <rect x={posX} y={Math.min(entryY, targetY)} width={posW} height={Math.abs(entryY - targetY)} fill="#26a69a" fillOpacity="0.3" stroke="none" />
                        {/* Entry Line */}
                        <line x1={posX} y1={entryY} x2={posX + posW} y2={entryY} stroke="#787b86" strokeWidth="1" strokeDasharray="4,4" />
                    </g>
                )

            default: return null
        }
    }

    const handleMouseDown = (e) => {
        if (activeTool === 'cursor' || activeTool === 'crosshair' || !mainSeries) return

        const rect = svgRef.current.getBoundingClientRect()
        const x = e.clientX - rect.left
        const y = e.clientY - rect.top
        const point = getCoord(x, y)
        if (!point || !point.time) return

        // 1-Click Tools
        if (['text', 'horizontal', 'vertical'].includes(activeTool)) {
            if (activeTool === 'text') {
                const text = window.prompt("Enter text:", "Note")
                if (text) addDrawing(paneId, { type: 'text', p1: point, text })
                setActiveTool('cursor')
            } else {
                addDrawing(paneId, { type: activeTool, p1: point, p2: point })
                setActiveTool('cursor')
            }
            return
        }

        // 3-Click Tools (Triangle)
        if (activeTool === 'triangle') {
            if (!currentDrawing) {
                // Step 1: Start
                setCurrentDrawing({ type: 'triangle', p1: point, p2: point, p3: point, step: 1 })
            } else if (currentDrawing.step === 1) {
                // Step 2: Set p2, waiting for p3
                setCurrentDrawing({ ...currentDrawing, p2: point, p3: point, step: 2 })
            } else {
                // Step 3: Set p3, Finish
                addDrawing(paneId, { ...currentDrawing, p3: point, step: undefined })
                setCurrentDrawing(null)
                setActiveTool('cursor')
            }
            return
        }

        // 2-Click Tools (Default + Long/Short)
        // Brush handles points accumulation separately if we want, but let's keep simple click-click for consistency or implement drag?
        if (!currentDrawing) {
            const newDrawing = {
                type: activeTool === 'fib-retracement' ? 'fib' : activeTool,
                p1: point,
                p2: point,
                points: activeTool === 'brush' ? [point] : undefined,
                preview: true
            }
            setCurrentDrawing(newDrawing)
        } else {
            // Finish
            const finalDrawing = { ...currentDrawing, p2: point, preview: false }
            addDrawing(paneId, finalDrawing)
            setCurrentDrawing(null)
            setActiveTool('cursor')
        }
    }

    const handleMouseMove = (e) => {
        if (!currentDrawing) return
        const rect = svgRef.current.getBoundingClientRect()
        const x = e.clientX - rect.left
        const y = e.clientY - rect.top
        const point = getCoord(x, y)
        if (point && point.time) {
            if (currentDrawing.type === 'brush') {
                setCurrentDrawing(prev => ({
                    ...prev,
                    points: [...prev.points, point],
                    p2: point
                }))
            } else if (currentDrawing.type === 'triangle') {
                // Triangle Preview Logic
                if (currentDrawing.step === 1) {
                    // Update p2 (and p3 follows)
                    setCurrentDrawing(prev => ({ ...prev, p2: point, p3: point }))
                } else if (currentDrawing.step === 2) {
                    // Update p3 only
                    setCurrentDrawing(prev => ({ ...prev, p3: point }))
                }
            } else {
                // Standard 2-point preview
                setCurrentDrawing(prev => ({ ...prev, p2: point }))
            }
        }
    }

    // Capture scrolling
    useEffect(() => {
        if (!chart) return
        const handleChange = () => setTick(t => t + 1)
        chart.timeScale().subscribeVisibleLogicalRangeChange(handleChange)
        return () => chart.timeScale().unsubscribeVisibleLogicalRangeChange(handleChange)
    }, [chart])

    if (activeTool === 'cursor' && paneDrawings.length === 0 && !currentDrawing) {
        return <div style={{ display: 'none' }} />
    }

    return (
        <svg
            ref={svgRef}
            width={width}
            height={height}
            className="drawings-layer"
            style={{
                position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                zIndex: 20, overflow: 'visible', // Visible for Text labels extending?
                pointerEvents: (activeTool !== 'cursor' && activeTool !== 'crosshair') ? 'auto' : 'none'
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
        >
            {paneDrawings.map(d => (
                <React.Fragment key={d.id}>
                    {renderDrawing(d, false)}
                </React.Fragment>
            ))}
            {currentDrawing && renderDrawing(currentDrawing, true)}
        </svg>
    )
}

export default DrawingsManager

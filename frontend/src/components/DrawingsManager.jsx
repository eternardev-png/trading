import React, { useRef, useState, useEffect, useMemo } from 'react'
import { useLayoutStore } from '../stores/useLayoutStore'
import { pointToCoordinates, coordinatesToPoint, getMainSeries, getLogicalIndex } from '../utils/coordinates'

function DrawingsManager({ chart, seriesConfigs, seriesMap, width, height, paneId, magnetMode, drawingsVisible }) {
    const { activeTool, setActiveTool, drawings, addDrawing, updateDrawing, removeDrawing, selectedDrawingId, setSelectedDrawingId } = useLayoutStore()
    const paneDrawings = drawings[paneId] || []
    const svgRef = useRef(null)

    // Ref for active drawing state to handle high-frequency events reliably
    const drawingRef = useRef(null)
    const [previewDrawing, setPreviewDrawing] = useState(null)

    // State for dragging: { type: 'point'|'move', drawingId, pointKey, startPoint, originalDrawing }
    const [dragState, setDragState] = useState(null)

    const [, setTick] = useState(0)

    const mainSeries = useMemo(() => getMainSeries(seriesConfigs, seriesMap), [seriesConfigs, seriesMap])

    const mainData = useMemo(() => {
        if (!seriesConfigs) return []
        const conf = seriesConfigs.find(s => s.chartType === 'candle') || seriesConfigs.find(s => s.isMain) || seriesConfigs[0]
        return conf?.data || []
    }, [seriesConfigs])

    const getPoint = (time, price) => pointToCoordinates({ time, price }, chart, mainSeries, mainData)
    const getCoord = (x, y) => coordinatesToPoint({ x, y }, chart, mainSeries, width, mainData)
    const getLogical = (time) => getLogicalIndex(time, mainData)

    // --- Geometry & Hit Helpers ---
    const distToSegment = (p, v, w) => {
        const l2 = (w.x - v.x) ** 2 + (w.y - v.y) ** 2
        if (l2 === 0) return Math.sqrt((p.x - v.x) ** 2 + (p.y - v.y) ** 2)
        let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2
        t = Math.max(0, Math.min(1, t))
        return Math.sqrt((p.x - (v.x + t * (w.x - v.x))) ** 2 + (p.y - (v.y + t * (w.y - v.y))) ** 2)
    }

    const isHit = (x, y, d) => {
        const p1 = getPoint(d.p1.time, d.p1.price)
        if (!p1) return false

        if (d.type === 'text') return Math.sqrt((x - p1.x) ** 2 + (y - p1.y) ** 2) < 30
        if (d.type === 'horizontal') return Math.abs(y - p1.y) < 10
        if (d.type === 'vertical') return Math.abs(x - p1.x) < 10

        if (!d.p2) return Math.sqrt((x - p1.x) ** 2 + (y - p1.y) ** 2) < 10
        const p2 = getPoint(d.p2.time, d.p2.price)
        if (!p2) return false

        if (d.type === 'ray' || d.type === 'extended') {
            const l2 = (p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2
            if (l2 === 0) return false
            const dist = Math.abs((p2.y - p1.y) * x - (p2.x - p1.x) * y + p2.x * p1.y - p2.y * p1.x) / Math.sqrt(l2)
            if (dist > 10) return false

            if (d.type === 'ray') {
                const dot = (x - p1.x) * (p2.x - p1.x) + (y - p1.y) * (p2.y - p1.y)
                return dot >= 0
            }
            return true
        }

        if (['line', 'trend', 'arrow', 'measure'].includes(d.type)) {
            return distToSegment({ x, y }, p1, p2) < 10
        }

        if (d.type === 'rectangle' || d.type === 'date-price-range') {
            const p3 = { x: p2.x, y: p1.y }
            const p4 = { x: p1.x, y: p2.y }
            return distToSegment({ x, y }, p1, p3) < 10 || distToSegment({ x, y }, p3, p2) < 10 ||
                distToSegment({ x, y }, p2, p4) < 10 || distToSegment({ x, y }, p4, p1) < 10
        }
        if (d.type === 'circle') {
            const radius = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2)
            const dist = Math.sqrt((x - p1.x) ** 2 + (y - p1.y) ** 2)
            return Math.abs(dist - radius) < 10
        }
        if (d.type === 'triangle') {
            if (!d.p3) return distToSegment({ x, y }, p1, p2) < 10
            const p3 = getPoint(d.p3.time, d.p3.price)
            if (!p3) return distToSegment({ x, y }, p1, p2) < 10
            return distToSegment({ x, y }, p1, p2) < 10 || distToSegment({ x, y }, p2, p3) < 10 || distToSegment({ x, y }, p3, p1) < 10
        }
        if (d.type === 'parallel-channel') {
            if (distToSegment({ x, y }, p1, p2) < 10) return true
            return false
        }
        if (d.type === 'fib') {
            return distToSegment({ x, y }, p1, p2) < 10
        }
        if (d.type === 'long-position' || d.type === 'short-position') {
            const minX = Math.min(p1.x, p2.x)
            const w = Math.abs(p2.x - p1.x)
            return Math.abs(y - p1.y) < 20 && x >= p1.x && x <= p1.x + w
        }
        if (d.type === 'brush' && d.points) {
            for (let i = 0; i < d.points.length - 1; i++) {
                const pt1 = getPoint(d.points[i].time, d.points[i].price)
                const pt2 = getPoint(d.points[i + 1].time, d.points[i + 1].price)
                if (pt1 && pt2 && distToSegment({ x, y }, pt1, pt2) < 10) return true
            }
            return false
        }
        return false
    }

    const getExtendedLine = (p1, p2, width, height) => {
        if (!p1 || !p2) return null
        const dx = p2.x - p1.x
        const dy = p2.y - p1.y
        if (dx === 0 && dy === 0) return { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y }
        if (Math.abs(dx) < 0.001) return { x1: p1.x, y1: 0, x2: p1.x, y2: height }
        const slope = dy / dx
        const yIntercept = p1.y - slope * p1.x
        return { x1: 0, y1: yIntercept, x2: width, y2: slope * width + yIntercept }
    }

    const getRay = (p1, p2, width, height) => {
        if (!p1 || !p2) return null
        const dx = p2.x - p1.x
        const dy = p2.y - p1.y
        const scale = 10000
        return { x1: p1.x, y1: p1.y, x2: p1.x + dx * scale, y2: p1.y + dy * scale }
    }


    const renderDrawing = (d, isPreview = false) => {
        const p1 = getPoint(d.p1.time, d.p1.price)
        let p2 = d.p2 ? getPoint(d.p2.time, d.p2.price) : (isPreview ? null : null)
        let p3 = d.p3 ? getPoint(d.p3.time, d.p3.price) : null

        if (!p1) return null

        const style = { stroke: '#2962ff', strokeWidth: 2, ...d.style }
        const color = style.stroke
        let content = null

        // Render content based on type (same as before)
        switch (d.type) {
            case 'brush':
                const points = d.points || []
                if (points.length < 2 && !isPreview) return null
                const pathData = points.map((pt, i) => {
                    const coord = getPoint(pt.time, pt.price)
                    if (!coord) return ''
                    return (i === 0 ? 'M' : 'L') + coord.x + ' ' + coord.y
                }).join(' ')
                content = <path d={pathData} fill="none" stroke={color} strokeWidth={style.strokeWidth} strokeLinejoin="round" strokeLinecap="round" />
                break
            case 'line':
            case 'trend':
            case 'measure':
                if (p2) content = <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} {...style} />
                break
            case 'ray':
                if (p2) { const ray = getRay(p1, p2, width, height); content = <line x1={ray.x1} y1={ray.y1} x2={ray.x2} y2={ray.y2} {...style} /> }
                break
            case 'extended':
                if (p2) { const ext = getExtendedLine(p1, p2, width, height); content = <line x1={ext.x1} y1={ext.y1} x2={ext.x2} y2={ext.y2} {...style} /> }
                break
            case 'horizontal':
                content = <line x1={0} y1={p1.y} x2={width} y2={p1.y} {...style} />
                break
            case 'vertical':
                content = <line x1={p1.x} y1={0} x2={p1.x} y2={height} {...style} />
                break
            case 'arrow':
                if (p2) {
                    const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x)
                    const headLen = 15
                    const h1x = p2.x - headLen * Math.cos(angle - Math.PI / 6), h1y = p2.y - headLen * Math.sin(angle - Math.PI / 6)
                    const h2x = p2.x - headLen * Math.cos(angle + Math.PI / 6), h2y = p2.y - headLen * Math.sin(angle + Math.PI / 6)
                    content = <g {...style}><line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={color} strokeWidth={style.strokeWidth} /><path d={`M ${p2.x} ${p2.y} L ${h1x} ${h1y} L ${h2x} ${h2y} Z`} fill={color} stroke={color} strokeWidth={1} /></g>
                }
                break
            case 'rectangle':
            case 'date-price-range':
                if (p2) {
                    const rx = Math.min(p1.x, p2.x), ry = Math.min(p1.y, p2.y), rw = Math.abs(p2.x - p1.x), rh = Math.abs(p2.y - p1.y)
                    content = <rect x={rx} y={ry} width={rw} height={rh} {...style} fill={color} fillOpacity={0.1} />
                }
                break
            case 'circle':
                if (p2) {
                    const radius = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2)
                    content = <circle cx={p1.x} cy={p1.y} r={radius} {...style} fill="none" />
                }
                break
            case 'triangle':
                if (p2) {
                    const tp3 = p3 || p2
                    content = <polygon points={`${p1.x},${p1.y} ${p2.x},${p2.y} ${tp3.x},${tp3.y}`} stroke={color} strokeWidth={style.strokeWidth} fill={color} fillOpacity="0.15" {...style} />
                }
                break
            case 'text':
                content = <text x={p1.x} y={p1.y} fill={color} fontSize={16} fontFamily="Arial" dy={5}>{d.text || 'Text'}</text>
                break
            case 'long-position':
            case 'short-position':
                if (p2) {
                    const isLong = d.type === 'long-position'
                    const entryY = p1.y, stopY = p2.y
                    const risk = Math.abs(d.p1.price - d.p2.price)
                    const targetPrice = isLong ? d.p1.price + risk * 2 : d.p1.price - risk * 2
                    const targetPoint = getPoint(d.p1.time, targetPrice)
                    const targetY = targetPoint ? targetPoint.y : (isLong ? entryY - (stopY - entryY) * 2 : entryY + (entryY - stopY) * 2)
                    const posW = Math.max(50, Math.abs(p2.x - p1.x))
                    content = <g {...style} opacity={0.6}><rect x={p1.x} y={Math.min(entryY, stopY)} width={posW} height={Math.abs(entryY - stopY)} fill="#ef5350" fillOpacity="0.3" stroke="none" /><rect x={p1.x} y={Math.min(entryY, targetY)} width={posW} height={Math.abs(entryY - targetY)} fill="#26a69a" fillOpacity="0.3" stroke="none" /><line x1={p1.x} y1={entryY} x2={p1.x + posW} y2={entryY} stroke="#787b86" strokeWidth="1" strokeDasharray="4,4" /></g>
                }
                break
            case 'fib':
                if (p2) {
                    const levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1], dyL = p2.y - p1.y
                    content = <g {...style}><line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={color} strokeWidth={1} strokeDasharray="2,2" />{levels.map(lvl => <line key={lvl} x1={p1.x} y1={p1.y + dyL * lvl} x2={p2.x} y2={p1.y + dyL * lvl} stroke={color} strokeWidth={1} />)}</g>
                }
                break
            default: break
        }

        // --- Anchors & Selection ---
        if (!isPreview && selectedDrawingId === d.id) {
            const anchors = []
            const addAnchor = (pt, key) => {
                if (pt) anchors.push(
                    <circle
                        key={key} cx={pt.x} cy={pt.y} r={6}
                        fill="white" stroke="#2962ff" strokeWidth={2}
                        style={{ cursor: 'pointer', pointerEvents: 'all' }}
                        onMouseDown={(e) => {
                            e.stopPropagation()
                            e.preventDefault() // prevent canvas drag
                            const rect = svgRef.current.getBoundingClientRect()
                            setDragState({
                                type: 'point',
                                drawingId: d.id,
                                pointKey: key,
                                startX: e.clientX,
                                startY: e.clientY,
                                originalDrawing: d
                            })
                        }}
                    />
                )
            }
            if (d.type !== 'brush') {
                addAnchor(p1, 'p1')
                addAnchor(p2, 'p2')
                addAnchor(p3, 'p3')
            }
            return <g>{content}{anchors}</g>
        }
        return content
    }

    const handleMouseDown = (e) => {
        if (!mainSeries || !svgRef.current) return
        const rect = svgRef.current.getBoundingClientRect()
        const x = e.clientX - rect.left, y = e.clientY - rect.top

        if (activeTool === 'eraser') {
            const clicked = paneDrawings.find(d => isHit(x, y, d))
            if (clicked) removeDrawing(paneId, clicked.id)
            return
        }

        const point = getCoord(x, y)
        if (!point || !point.time) return

        if (activeTool !== 'cursor' && activeTool !== 'crosshair') {
            // ... Creation logic (same as before) ...
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

            if (!drawingRef.current) {
                const newD = {
                    type: activeTool === 'fib-retracement' ? 'fib' : activeTool,
                    p1: point, p2: point, p3: point, points: activeTool === 'brush' ? [point] : undefined, step: 1
                }
                drawingRef.current = newD
                setPreviewDrawing({ ...newD })
            } else {
                if (activeTool === 'brush') return
                if (activeTool === 'triangle') {
                    if (drawingRef.current.step === 1) {
                        drawingRef.current.step = 2; drawingRef.current.p2 = point; setPreviewDrawing({ ...drawingRef.current })
                    } else {
                        addDrawing(paneId, { ...drawingRef.current, p3: point, step: undefined })
                        drawingRef.current = null; setPreviewDrawing(null); setActiveTool('cursor')
                    }
                } else {
                    addDrawing(paneId, { ...drawingRef.current, p2: point })
                    drawingRef.current = null; setPreviewDrawing(null); setActiveTool('cursor')
                }
            }
            return
        }

        if (activeTool === 'cursor') {
            const clicked = paneDrawings.find(d => isHit(x, y, d))
            if (clicked) {
                setSelectedDrawingId(clicked.id)
                // Start Moving Object
                setDragState({
                    type: 'move',
                    drawingId: clicked.id,
                    startPoint: point, // Logical/Price start point
                    originalDrawing: clicked
                })
            } else {
                setSelectedDrawingId(null)
            }
        }
    }

    const handleMouseMove = (e) => {
        if (!svgRef.current) return
        const x = e.clientX - svgRef.current.getBoundingClientRect().left
        const y = e.clientY - svgRef.current.getBoundingClientRect().top
        const point = getCoord(x, y)
        if (!point) return

        if (dragState) {
            if (dragState.type === 'point') {
                updateDrawing(paneId, dragState.drawingId, { [dragState.pointKey]: point })
            } else if (dragState.type === 'move' && dragState.startPoint) {
                // Calculate logic delta: price diff and time index diff
                const priceDelta = point.price - dragState.startPoint.price
                const timeIndexDelta = getLogical(point.time) - getLogical(dragState.startPoint.time)

                // Helper to shift point
                const shift = (pt) => {
                    if (!pt || !pt.time) return pt

                    // Simple price shift
                    const newPrice = pt.price + priceDelta

                    // Time shift logic
                    // We need to find a new time that is +timeIndexDelta candles away
                    // If we can't find it (off screen), we keep original time or try to extrapolate?
                    // Safe approach: keep original time if calculation fails, to avoid crashes
                    const currentIdx = getLogical(pt.time)
                    let newTime = pt.time

                    if (currentIdx !== null && mainData.length > 0) {
                        const newIdx = Math.round(currentIdx + timeIndexDelta)
                        if (mainData[newIdx]) {
                            newTime = mainData[newIdx].time
                        } else if (newIdx < 0) {
                            newTime = mainData[0].time // Clamp start
                        } else if (newIdx >= mainData.length) {
                            newTime = mainData[mainData.length - 1].time // Clamp end
                        }
                    }

                    // Ensure newTime is valid formatted time if needed? 
                    // Usually lightweigth-charts handles format consistency if we take from mainData.

                    return { time: newTime, price: newPrice }
                }

                const d = dragState.originalDrawing
                const updates = {}
                if (d.p1) updates.p1 = shift(d.p1)
                if (d.p2) updates.p2 = shift(d.p2)
                if (d.p3) updates.p3 = shift(d.p3)
                if (d.points) updates.points = d.points.map(shift)

                updateDrawing(paneId, dragState.drawingId, updates)
            }
            return
        }

        if (drawingRef.current) {
            const d = drawingRef.current
            if (activeTool === 'brush') { d.points.push(point); d.p2 = point; setPreviewDrawing({ ...d }) }
            else if (activeTool === 'triangle') {
                if (d.step === 1) { d.p2 = point; d.p3 = point } else { d.p3 = point }
                setPreviewDrawing({ ...d })
            } else {
                d.p2 = point; setPreviewDrawing({ ...d })
            }
        }
    }

    const handleMouseUp = () => {
        if (dragState) { setDragState(null); return }
        if (drawingRef.current && activeTool === 'brush') {
            addDrawing(paneId, { ...drawingRef.current })
            drawingRef.current = null; setPreviewDrawing(null)
        }
    }

    useEffect(() => { handleMouseUp() }, [activeTool]) // Reset drag on tool change

    useEffect(() => {
        if (!chart) return
        const handleTimeScale = () => setTick(t => t + 1)
        chart.timeScale().subscribeVisibleTimeRangeChange(handleTimeScale)
        return () => chart.timeScale().unsubscribeVisibleTimeRangeChange(handleTimeScale)
    }, [chart])

    return (
        <svg
            ref={svgRef} width={width} height={height} className="drawings-layer"
            style={{
                position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                zIndex: 20, overflow: 'visible', pointerEvents: (activeTool !== 'cursor' && activeTool !== 'crosshair') ? 'auto' : 'none',
                display: drawingsVisible ? 'block' : 'none'
            }}
            onMouseDown={handleMouseDown} onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
        >
            {paneDrawings.map(d => <React.Fragment key={d.id}>{renderDrawing(d, false)}</React.Fragment>)}
            {previewDrawing && renderDrawing({ ...previewDrawing, style: { strokeDasharray: '4,4', ...previewDrawing.style } }, true)}
        </svg>
    )
}

export default DrawingsManager

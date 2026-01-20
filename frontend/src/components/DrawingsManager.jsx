import React, { useRef, useState, useEffect } from 'react'
import { useLayoutStore } from '../stores/useLayoutStore'

function DrawingsManager({ chart, series, width, height }) {
    const { activeTool, setActiveTool } = useLayoutStore()
    const [drawings, setDrawings] = useState([]) // { type: 'line', p1: { time, price }, p2: { ... }, id }
    const [currentDrawing, setCurrentDrawing] = useState(null)

    // Convert logic: Time/Price -> X/Y
    const getPoint = (time, price) => {
        if (!chart || !series) return null
        const x = chart.timeScale().timeToCoordinate(time)
        const y = series.priceToCoordinate(price)
        return { x, y }
    }

    // Reverse: X/Y -> Time/Price
    const getCoordinate = (x, y) => {
        if (!chart || !series) return null
        const time = chart.timeScale().coordinateToTime(x)
        const price = series.coordinateToPrice(y)
        return { time, price }
    }

    // Mouse Handlers
    const svgRef = useRef(null)

    const handleMouseDown = (e) => {
        if (activeTool === 'cursor' || activeTool === 'crosshair') return

        const rect = svgRef.current.getBoundingClientRect()
        const x = e.clientX - rect.left
        const y = e.clientY - rect.top

        const coord = getCoordinate(x, y)
        if (!coord) return

        if (!currentDrawing) {
            // Start drawing
            // Map tool types: 'trend' -> line
            if (activeTool === 'trend') {
                setCurrentDrawing({
                    type: 'line',
                    p1: coord,
                    p2: coord
                })
            }
            // Add other tools here (fib, etc)
        } else {
            // Finish drawing
            setDrawings(prev => [...prev, { ...currentDrawing, p2: coord, id: Date.now() }])
            setCurrentDrawing(null)
            setActiveTool('cursor') // Reset tool after draw? Or keep it? TV keeps it usually. Let's keep it.
        }
    }

    const handleMouseMove = (e) => {
        if (!currentDrawing) return

        const rect = svgRef.current.getBoundingClientRect()
        const x = e.clientX - rect.left
        const y = e.clientY - rect.top

        const coord = getCoordinate(x, y)
        if (coord) {
            setCurrentDrawing(prev => ({ ...prev, p2: coord }))
        }
    }

    // Force re-render on chart move/scale
    // We need to subscribe to chart updates to re-render SVG
    const [, setTick] = useState(0)
    useEffect(() => {
        if (!chart) return
        const handler = () => setTick(t => t + 1)
        chart.timeScale().subscribeVisibleTimeRangeChange(handler)
        // Also price scale?
        return () => {
            chart.timeScale().unsubscribeVisibleTimeRangeChange(handler)
        }
    }, [chart])

    if (activeTool === 'cursor' && drawings.length === 0) return null

    return (
        <svg
            ref={svgRef}
            className="drawings-layer"
            width={width}
            height={height}
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                pointerEvents: activeTool !== 'cursor' ? 'auto' : 'none',
                zIndex: 20
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
        >
            {/* Render Finished Drawings */}
            {drawings.map(d => {
                const p1 = getPoint(d.p1.time, d.p1.price)
                const p2 = getPoint(d.p2.time, d.p2.price)
                if (!p1 || !p2) return null
                return (
                    <line
                        key={d.id}
                        x1={p1.x} y1={p1.y}
                        x2={p2.x} y2={p2.y}
                        stroke="#2962ff"
                        strokeWidth="2"
                    />
                )
            })}

            {/* Render Current Drawing */}
            {currentDrawing && (() => {
                const p1 = getPoint(currentDrawing.p1.time, currentDrawing.p1.price)
                const p2 = getPoint(currentDrawing.p2.time, currentDrawing.p2.price)
                if (!p1 || !p2) return null
                return (
                    <line
                        x1={p1.x} y1={p1.y}
                        x2={p2.x} y2={p2.y}
                        stroke="#2962ff"
                        strokeWidth="2"
                        strokeDasharray="4"
                    />
                )
            })()}
        </svg>
    )
}

export default DrawingsManager

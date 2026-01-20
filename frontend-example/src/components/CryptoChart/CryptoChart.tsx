import React, { useMemo, useState, useEffect, useRef } from 'react'
import {
  Area,
  Bar,
  ComposedChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import {
  convertServerDateToLocal,
  getCurrentLocalTime
} from '../../common/utils/chartTimeUtils'

import { ChartDataPoint } from '../../services/api'
import { ChartPeriod, CryptoChartProps } from '../../types/chart.types'
import {
  calculateChartValues,
  formatDateForAxis,
  formatDateForTooltip,
  formatPriceForTooltip,
  formatPriceForYAxis,
  formatVolume,
  getChartColor,
  padDataWithGhostCandles,
} from '../../common/utils/chartUtils'
import { getPriceDecimals } from '../../common/utils/price'

import styles from './CryptoChart.module.scss'

const CryptoChart: React.FC<CryptoChartProps> = ({
  data,
  period,
  currentPrice,
  options = {},
  onPeriodChange,
  isLoading = false,
  error = null,
  priceDecimals = 2,
}) => {
  const {
    showVolume = true,
    color: customColor,
    showPriceAnimation = false,
    height = 280,
    margin = { top: 10, right: 5, left: 5, bottom: 5 },
    showCurrentPriceLine = false,
    showTriggerLines = false,
    triggerLines,
    yAxisFormatter,
    tooltipFormatter,
  } = options

  // -- 1. Data Prep (Ghost Candles) --
  const paddedData = useMemo(() => {
    return padDataWithGhostCandles(data, period, 50)
  }, [data, period])

  // -- 2. Viewport State (Infinite Scroll Logic) --
  // Initialize showing the last N candles (e.g. 50) or all if fewer
  const [viewState, setViewState] = useState<{ startIndex: number; endIndex: number } | null>(null)

  useEffect(() => {
    // Reset view when data completely changes (e.g. coin switch), but try to preserve if just update
    if (paddedData.length > 0) {
      setViewState((prev) => {
        // Initial load
        if (!prev) {
          const initialWindowSize = 60
          const start = Math.max(0, paddedData.length - initialWindowSize)
          return { startIndex: start, endIndex: paddedData.length }
        }
        // Data update (live price) - try to follow the right edge if we were attached to it
        const prevLen = prev.endIndex - prev.startIndex
        const isAttachedToRight = prev.endIndex >= paddedData.length - 2 // tolerance

        if (isAttachedToRight) {
          return { startIndex: Math.max(0, paddedData.length - prevLen), endIndex: paddedData.length }
        }
        // Otherwise keep bounds but clamp to new length
        return {
          startIndex: Math.min(prev.startIndex, paddedData.length - 1),
          endIndex: Math.min(prev.endIndex, paddedData.length)
        }
      })
    }
  }, [paddedData.length, data[0]?.date]) // Reset on length change or symbol change signals

  // -- 3. Interaction Handlers --
  const [isDragging, setIsDragging] = useState(false)
  const dragStartRef = useRef<{ x: number; start: number; end: number } | null>(null)

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!viewState) return
    setIsDragging(true)
    dragStartRef.current = {
      x: e.clientX,
      start: viewState.startIndex,
      end: viewState.endIndex,
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !dragStartRef.current || !viewState) return

    // Calculate delta
    // Approximate candle width in pixels (Container Width / Visible Candles)
    // We assume container width is roughly e.currentTarget.clientWidth
    const containerWidth = e.currentTarget.clientWidth
    const visibleCount = dragStartRef.current.end - dragStartRef.current.start
    const pixelsPerCandle = containerWidth / visibleCount

    const deltaX = e.clientX - dragStartRef.current.x
    const deltaCandles = Math.round(deltaX / pixelsPerCandle)

    // Invert delta because dragging left means moving into future (shifting view right) -> or wait?
    // Dragging RIGHT (deltaX > 0) should move chart RIGHT (show past) -> startIndex decreases
    // So: newStart = initialStart - delta

    let newStart = dragStartRef.current.start - deltaCandles
    let newEnd = dragStartRef.current.end - deltaCandles
    const windowSize = dragStartRef.current.end - dragStartRef.current.start

    // -- CRITICAL FIX: Window Size Lock --
    // Clamp logic that strictly preserves windowSize

    // 1. Check Left Wall
    if (newStart < 0) {
      newStart = 0
      newEnd = newStart + windowSize // Lock size
    }

    // 2. Check Right Wall
    if (newEnd > paddedData.length) {
      newEnd = paddedData.length
      newStart = newEnd - windowSize // Lock size
    }

    setViewState({ startIndex: newStart, endIndex: newEnd })
  }

  const handleMouseUp = () => {
    setIsDragging(false)
    dragStartRef.current = null
  }

  const handleWheel = (e: React.WheelEvent) => {
    // Optional: Zoom logic
    if (!viewState) return
    e.preventDefault() // might need passive listener fix in real DOM

    const ZOOM_SPEED = 0.5
    const sign = Math.sign(e.deltaY)

    // Shrink/Expand window
    const currentSize = viewState.endIndex - viewState.startIndex
    const deltaSize = Math.round(sign * currentSize * 0.1) // 10% zoom

    if (deltaSize === 0) return

    let newSize = currentSize + deltaSize
    // Limits
    newSize = Math.max(10, newSize) // min 10 candles
    newSize = Math.min(paddedData.length, newSize) // max all data

    // Zoom centered or from right? TradingView usually zooms from right if right edge is visible
    // Simple approach: Keep right edge fixed-ish usually preferred for trading

    let newEnd = viewState.endIndex
    let newStart = newEnd - newSize

    if (newStart < 0) {
      newStart = 0
      newEnd = newStart + newSize
    }

    setViewState({ startIndex: newStart, endIndex: newEnd })
  }

  // Slice data for rendering
  const visibleData = useMemo(() => {
    if (!viewState) return paddedData
    return paddedData.slice(viewState.startIndex, viewState.endIndex)
  }, [paddedData, viewState])

  // Recalculate ticks and domain based on visible slice
  const chartCalculations = useMemo(() => {
    const triggerLevels = triggerLines ? {
      upper: triggerLines.upper?.value,
      lower: triggerLines.lower?.value,
    } : undefined
    // IMPORTANT: Calculate Y domain based ONLY on visible data, enabling auto-scale during pan
    return calculateChartValues(visibleData, period, priceDecimals, triggerLevels)
  }, [visibleData, period, priceDecimals, triggerLines])

  // Determine the color of the chart
  const chartColor = customColor || chartCalculations.chartColor

  // Custom rendering of ticks to shift extreme marks
  const renderCustomTick = (props: any) => {
    const { x, y, payload, index } = props
    const ticks = chartCalculations.xAxisTicks
    const isFirst = index === 0
    const isLast = ticks && index === ticks.length - 1

    // Shift: first mark to the right by 8px, last mark to the left by 8px
    const offsetX = isFirst ? 8 : isLast ? -8 : 0

    return (
      <text
        x={x + offsetX}
        y={y}
        fill="var(--color-foreground-tertiary)"
        fontSize={10}
        textAnchor="middle"
      >
        {formatDateForAxis(payload.value, period)}
      </text>
    )
  }

  // Formatting for the Y axis
  const yAxisTickFormatter = yAxisFormatter
    ? yAxisFormatter
    : (value: number) => formatPriceForYAxis(value, priceDecimals)

  // Formatting for the price tooltip
  const priceTooltipFormatter = tooltipFormatter?.price
    ? tooltipFormatter.price
    : (value: number) => formatPriceForTooltip(value, priceDecimals)

  // Formatting for the volume tooltip
  const volumeTooltipFormatter = tooltipFormatter?.volume
    ? tooltipFormatter.volume
    : formatVolume

  // Formatting for the date tooltip
  const dateTooltipFormatter = tooltipFormatter?.date
    ? tooltipFormatter.date
    : (dateStr: string) => formatDateForTooltip(dateStr, period)

  if (isLoading) {
    return (
      <div className={styles.chartContainer} style={{ height }}>
        <div className={styles.loading}>Loading chart...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={styles.chartContainer} style={{ height }}>
        <div className={styles.error}>{error}</div>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className={styles.chartContainer} style={{ height }}>
        <div className={styles.empty}>No data to display</div>
      </div>
    )
  }

  return (
    <div
      className={styles.chartContainer}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
      style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
    >
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart
          data={visibleData}
          margin={margin}
        >
          <defs>
            <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={chartColor} stopOpacity={0.3} />
              <stop offset="100%" stopColor={chartColor} stopOpacity={0.05} />
            </linearGradient>
          </defs>

          {/* X axis */}
          <XAxis
            dataKey="date"
            axisLine={{ stroke: 'var(--color-border-separator)' }}
            tickLine={{ stroke: 'transparent' }}
            height={40}
            ticks={chartCalculations.xAxisTicks}
            interval={0}
            angle={0}
            tick={renderCustomTick}
            minTickGap={period === '1d' ? 12 : period === '30d' || period === '1y' ? 8 : 6}
          />

          {/* Y axis for price */}
          <YAxis
            yAxisId="price"
            orientation="right"
            domain={chartCalculations.yAxisDomain}
            tick={{ fill: 'var(--color-foreground-tertiary)', fontSize: 10 }}
            axisLine={{ stroke: 'transparent' }}
            tickLine={{ stroke: 'transparent' }}
            width={45}
            ticks={chartCalculations.yAxisTicks}
            allowDecimals={true}
            tickFormatter={yAxisTickFormatter}
          />

          {/* Y axis for volume (hidden) */}
          {showVolume && (
            <YAxis
              yAxisId="volume"
              orientation="left"
              hide
              domain={chartCalculations.volumeDomain}
            />
          )}

          {/* Tooltip */}
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--color-background-modal)',
              borderColor: 'var(--color-border-separator)',
              borderRadius: '8px',
              padding: '8px 12px',
            }}
            labelStyle={{
              color: 'var(--color-foreground-primary)',
              fontSize: '12px',
              marginBottom: '4px',
            }}
            itemStyle={{
              color: 'var(--color-foreground-primary)',
              fontSize: '12px',
            }}
            formatter={(value: number, name: string) => {
              if (name === 'price') {
                return [priceTooltipFormatter(value), 'Price']
              }
              if (name === 'volume') {
                return [volumeTooltipFormatter(value), 'Vol 24h']
              }
              return [value, name]
            }}
            labelFormatter={(label) => dateTooltipFormatter(label as string)}
            cursor={{ stroke: chartColor, strokeWidth: 1, strokeDasharray: '3 3' }}
          />

          {/* Price chart */}
          <Area
            yAxisId="price"
            type="monotone"
            dataKey="price"
            stroke={chartColor}
            strokeWidth={2}
            fill="url(#colorGradient)"
            dot={false}
            activeDot={{
              r: 4,
              fill: chartColor,
              strokeWidth: 2,
              stroke: 'var(--color-background-primary)'
            }}
            connectNulls={false}
          />

          {/* Volumes */}
          {showVolume && (
            <Bar
              yAxisId="volume"
              dataKey="volume"
              fill="var(--color-foreground-tertiary)"
              opacity={0.3}
              radius={[2, 2, 0, 0]}
            />
          )}

          {/* Current price line */}
          {showCurrentPriceLine && currentPrice != null && (
            <ReferenceLine
              yAxisId="price"
              y={currentPrice}
              stroke="var(--color-foreground-secondary)"
              strokeWidth={1}
              strokeDasharray="3 3"
              label={{
                value: `$${currentPrice.toFixed(priceDecimals)}`,
                position: 'right',
                fill: 'var(--color-foreground-secondary)',
                fontSize: 11,
              }}
            />
          )}

          {/* Trigger lines */}
          {showTriggerLines && triggerLines?.upper !== undefined && (
            <ReferenceLine
              yAxisId="price"
              y={triggerLines.upper.value}
              stroke={triggerLines.upper.color || 'var(--color-state-success)'}
              strokeWidth={2}
              strokeDasharray="5 5"
              label={{
                value: triggerLines.upper.label,
                position: 'left',
                fill: triggerLines.upper.color || 'var(--color-state-success)',
                fontSize: 11,
                fontWeight: 'bold',
              }}
            />
          )}

          {showTriggerLines && triggerLines?.lower !== undefined && (
            <ReferenceLine
              yAxisId="price"
              y={triggerLines.lower.value}
              stroke={triggerLines.lower.color || 'var(--color-state-destructive)'}
              strokeWidth={2}
              strokeDasharray="5 5"
              label={{
                value: triggerLines.lower.label,
                position: 'left',
                fill: triggerLines.lower.color || 'var(--color-state-destructive)',
                fontSize: 11,
                fontWeight: 'bold',
              }}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

export default CryptoChart
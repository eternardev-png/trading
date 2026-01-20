import { useState } from 'react'
import { useLayoutStore, LAYOUTS } from '../stores/useLayoutStore'
import SymbolSearch from './SymbolSearch'
import IndicatorsMenu from './IndicatorsMenu'
import './Toolbar.scss'

const TIMEFRAMES = ['15m', '1h', '4h', '1d', '1w']

const LAYOUT_ICONS = {
    [LAYOUTS.SINGLE]: '▢',
    [LAYOUTS.VERTICAL_2]: '▯▯',
    [LAYOUTS.HORIZONTAL_2]: '▭',
    [LAYOUTS.GRID_4]: '⊞'
}

function Toolbar() {
    const {
        layoutMode, setLayoutMode,
        syncCrosshair, setSyncCrosshair,
        syncTimeRange, setSyncTimeRange,
        panes, // New
        setChartTimeframe, // This might be no-op now
        updateSeriesSettings,
        addIndicator,
        addCompareLayer
    } = useLayoutStore()

    const [showLayoutMenu, setShowLayoutMenu] = useState(false)
    const [isSearchOpen, setIsSearchOpen] = useState(false)
    const [searchMode, setSearchMode] = useState('set-main') // 'set-main' | 'compare'
    const [showIndicators, setShowIndicators] = useState(false)
    const [activeTimeframe, setActiveTimeframe] = useState('1d')

    // Main Series Logic
    // Find the series marked as 'main' or fallback to first series of first pane
    const mainPane = panes.find(p => p.id === 'main-pane') || panes[0]
    const mainSeries = mainPane?.series.find(s => s.isMain) || mainPane?.series[0]
    const currentTicker = mainSeries?.ticker || 'Select Symbol'

    const handleSymbolSelect = (symbol) => {
        if (searchMode === 'compare') {
            addCompareLayer(symbol)
        } else {
            // Update All Series in Main Pane (Candles + Volume) where ticker matches
            // Actually, we usually want to update ALL series that were "linked" to main ticker.
            // But simple approach: Update Main Series and Volume.
            if (mainPane) {
                mainPane.series.forEach(s => {
                    if (s.isMain || s.chartType === 'volume' || s.priceScale === 'volume_scale') {
                        updateSeriesSettings(s.id, { ticker: symbol })
                    }
                })
            }
        }
        setIsSearchOpen(false)
        setSearchMode('set-main') // Reset mode
    }

    const handleIndicatorSelect = (indicator) => {
        addIndicator(indicator)
        setShowIndicators(false)
    }

    const handleTimeframeChange = (tf) => {
        setActiveTimeframe(tf)
        // Global timeframe? Store assumes components handle it or we set it globally.
        // setChartTimeframe(tf) // Not fully implemented in new store but kept as stub
    }

    return (
        <div className="toolbar">
            {/* Left Section: Ticker Button */}
            <div className="toolbar__section toolbar__section--left">
                <div className="toolbar__ticker-wrapper">
                    <button
                        className="toolbar__ticker-btn"
                        onClick={() => setIsSearchOpen(true)}
                        title="Поиск инструментов"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 18" width="18" height="18" fill="none">
                            <path stroke="currentColor" d="M11.85 11.93A5.5 5.5 0 1 1 3.5 3.5a5.5 5.5 0 0 1 8.35 8.43zm0 0L14.5 14.5" />
                        </svg>
                        <span className="ticker-text">{currentTicker}</span>
                    </button>

                    <button
                        className="toolbar__plus-btn"
                        onClick={() => {
                            setSearchMode('compare')
                            setIsSearchOpen(true)
                        }}
                        title="Сравнить / Добавить инструмент"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
                            <path stroke="currentColor" strokeWidth="2" d="M12 6v12M6 12h12" />
                        </svg>
                    </button>

                    {/* Add Compare / etc buttons here later */}
                </div>

                <div className="toolbar__separator"></div>

                {/* Indicators Button */}
                <button
                    className="toolbar__btn-text"
                    onClick={() => setShowIndicators(true)}
                    title="Индикаторы, показатели и стратегии"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="28" height="28" fill="none">
                        <path stroke="currentColor" strokeWidth="1.2" d="M21.5 21V12.5M16 21V9M10.5 21v-6.5M5 21V14.5" />
                    </svg>
                    <span>Индикаторы</span>
                </button>

                <div className="toolbar__separator"></div>

                {/* Timeframe Selector */}
                <div className="toolbar__timeframes">
                    {TIMEFRAMES.map(tf => (
                        <button
                            key={tf}
                            className={`toolbar__tf-btn ${activeTimeframe === tf ? 'active' : ''}`}
                            onClick={() => handleTimeframeChange(tf)}
                        >
                            {tf}
                        </button>
                    ))}
                </div>
            </div>

            {/* Right Section: Layout & Sync */}
            <div className="toolbar__section toolbar__section--right">
                {/* Sync Toggle */}
                <div className="toolbar__sync-group">
                    <button
                        className={`toolbar__sync-btn ${syncCrosshair ? 'active' : ''}`}
                        onClick={() => setSyncCrosshair(!syncCrosshair)}
                        title="Sync Crosshair"
                    >
                        ✚
                    </button>
                    <button
                        className={`toolbar__sync-btn ${syncTimeRange ? 'active' : ''}`}
                        onClick={() => setSyncTimeRange(!syncTimeRange)}
                        title="Sync Time Range"
                    >
                        ⟷
                    </button>
                </div>

                {/* Layout Selector */}
                <div className="toolbar__layout-wrapper">
                    <button
                        className="toolbar__layout-btn"
                        onClick={() => setShowLayoutMenu(!showLayoutMenu)}
                    >
                        {LAYOUT_ICONS[layoutMode]}
                    </button>

                    {showLayoutMenu && (
                        <div className="toolbar__layout-menu">
                            {Object.entries(LAYOUTS).map(([key, value]) => (
                                <button
                                    key={key}
                                    className={`toolbar__layout-option ${layoutMode === value ? 'active' : ''}`}
                                    onClick={() => {
                                        setLayoutMode(value)
                                        setShowLayoutMenu(false)
                                    }}
                                >
                                    {LAYOUT_ICONS[value]}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Right Panel Toggle */}
                <button
                    className={`toolbar__btn-icon ${useLayoutStore(s => s.showRightPanel) ? 'active' : ''}`}
                    onClick={() => useLayoutStore.getState().toggleRightPanel()}
                    title="Watchlist / Right Panel"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="28" height="28" fill="none">
                        <path stroke="currentColor" strokeWidth="1.2" d="M19 4V24M19 9H24M19 14H24M19 19H24M4 4H19V24H4V4Z" />
                    </svg>
                </button>
            </div>

            <SymbolSearch
                isOpen={isSearchOpen}
                onClose={() => {
                    setIsSearchOpen(false)
                    setSearchMode('set-main')
                }}
                onSelect={handleSymbolSelect}
                mode={searchMode}
            />

            <IndicatorsMenu
                isOpen={showIndicators}
                onClose={() => setShowIndicators(false)}
                onSelect={handleIndicatorSelect}
            />
        </div>
    )
}

export default Toolbar

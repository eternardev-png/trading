import { useEffect } from 'react'
import { useLayoutStore } from './stores/useLayoutStore'
import Toolbar from './components/Toolbar'
import LeftSidebar from './components/LeftSidebar'
import RightSidebar from './components/RightSidebar'
import BottomTimebar from './components/BottomTimebar'
import LayoutManager from './components/LayoutManager'
import ChartSettingsModal from './components/ChartSettingsModal'
import './styles/App.scss'

function App() {
    const { showRightPanel, interfaceAppearance, showSettings, setShowSettings, panes } = useLayoutStore()

    const hexToRgb = (hex) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '0, 0, 0';
    }

    // Sync Interface Appearance with CSS Variables
    useEffect(() => {
        const root = document.documentElement
        root.style.setProperty('--bg-primary', interfaceAppearance.bgPrimary)
        root.style.setProperty('--bg-primary-rgb', hexToRgb(interfaceAppearance.bgPrimary))
        root.style.setProperty('--bg-secondary', interfaceAppearance.bgSecondary)
        root.style.setProperty('--bg-secondary-rgb', hexToRgb(interfaceAppearance.bgSecondary))
        root.style.setProperty('--text-primary', interfaceAppearance.textPrimary)
        root.style.setProperty('--text-secondary', interfaceAppearance.textSecondary) // Added
        root.style.setProperty('--accent-blue', interfaceAppearance.accentColor)
        root.style.setProperty('--accent-blue-glow', interfaceAppearance.accentGlow) // Added
    }, [interfaceAppearance])

    const mainSeriesId = panes.find(p => p.id === 'main-pane')?.series.find(s => s.isMain)?.id || panes[0]?.series[0]?.id

    return (
        <div className="app">
            <Toolbar />
            <div className="app__main">
                <LeftSidebar />
                <LayoutManager />
                {showRightPanel && <RightSidebar />}
            </div>
            <BottomTimebar />

            {showSettings && (
                <ChartSettingsModal
                    onClose={() => setShowSettings(false)}
                    mainSeriesId={mainSeriesId}
                />
            )}
        </div>
    )
}

export default App

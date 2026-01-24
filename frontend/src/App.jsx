import { useEffect } from 'react'
import { useLayoutStore } from './stores/useLayoutStore'
import Toolbar from './components/Toolbar'
import LeftSidebar from './components/LeftSidebar'
import RightSidebar from './components/RightSidebar'
import BottomTimebar from './components/BottomTimebar'
import LayoutManager from './components/LayoutManager'
import './styles/App.scss'

function App() {
    const { showRightPanel, interfaceAppearance } = useLayoutStore()

    // Sync Interface Appearance with CSS Variables
    useEffect(() => {
        const root = document.documentElement
        root.style.setProperty('--bg-primary', interfaceAppearance.bgPrimary)
        root.style.setProperty('--bg-secondary', interfaceAppearance.bgSecondary)
        root.style.setProperty('--text-primary', interfaceAppearance.textPrimary)
        root.style.setProperty('--accent-blue', interfaceAppearance.accentColor)
    }, [interfaceAppearance])

    return (
        <div className="app">
            <Toolbar />
            <div className="app__main">
                <LeftSidebar />
                <LayoutManager />
                {showRightPanel && <RightSidebar />}
            </div>
            <BottomTimebar />
        </div>
    )
}

export default App

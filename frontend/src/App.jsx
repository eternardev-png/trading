import { useLayoutStore } from './stores/useLayoutStore'
import Toolbar from './components/Toolbar'
import LeftSidebar from './components/LeftSidebar'
import RightSidebar from './components/RightSidebar'
import BottomTimebar from './components/BottomTimebar'
import LayoutManager from './components/LayoutManager'
import './styles/App.scss'

function App() {
    const { showRightPanel } = useLayoutStore()

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

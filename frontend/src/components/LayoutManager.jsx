import { useLayoutStore, LAYOUTS } from '../stores/useLayoutStore'
import ChartPanel from './ChartPanel'
import './LayoutManager.scss'

function LayoutManager() {
    const { layoutMode, charts } = useLayoutStore()

    const getLayoutClass = () => {
        switch (layoutMode) {
            case LAYOUTS.VERTICAL_2: return 'layout--2v'
            case LAYOUTS.HORIZONTAL_2: return 'layout--2h'
            case LAYOUTS.GRID_4: return 'layout--4'
            default: return 'layout--1'
        }
    }

    return (
        <div className={`layout layout--1`}>
            <div className="layout__cell">
                <ChartPanel />
            </div>
        </div>
    )
}

export default LayoutManager

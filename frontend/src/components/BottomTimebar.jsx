import { useLayoutStore } from '../stores/useLayoutStore'
import './BottomTimebar.scss'

const RANGES = [
    { label: '1D', value: '1d', title: '1 день' },
    { label: '5D', value: '5d', title: '5 дней' },
    { label: '1M', value: '1m', title: '1 месяц' },
    { label: '3M', value: '3m', title: '3 месяца' },
    { label: '6M', value: '6m', title: '6 месяцев' },
    { label: 'YTD', value: 'ytd', title: 'С начала года' },
    { label: '1Y', value: '1y', title: '1 год' },
    { label: '5Y', value: '5y', title: '5 лет' },
    { label: 'All', value: 'all', title: 'Вся история' },
]

function BottomTimebar() {
    const { setZoomRequest } = useLayoutStore()
    // Optional: track active range if possible, but it's volatile

    return (
        <div className="bottom-timebar">
            <div className="bottom-timebar__ranges">
                {RANGES.map(r => (
                    <button
                        key={r.value}
                        className="bottom-timebar__btn"
                        onClick={() => setZoomRequest(r.value)}
                        title={r.title}
                    >
                        {r.label}
                    </button>
                ))}
            </div>

            <div className="bottom-timebar__spacer" />

            <div className="bottom-timebar__info">
                {/* Timezone placeholder */}
                <span className="timezone">UTC+3</span>
                {/* Log/Auto toggles could go here too if removed from chart */}
            </div>
        </div>
    )
}

export default BottomTimebar

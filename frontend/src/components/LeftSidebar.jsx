import { useLayoutStore } from '../stores/useLayoutStore'
import './LeftSidebar.scss'

// Simple SVG Icons
const Icons = {
    crosshair: (
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M14 4V24M4 14H24" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="14" cy="14" r="1.5" fill="currentColor" />
        </svg>
    ),
    trend: (
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M6 22L22 6M6 22H10M22 6V10" stroke="currentColor" strokeWidth="1.5" />
        </svg>
    ),
    fib: (
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 20H24M4 15H24M4 10H24M4 6H24M4 24H24" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 2" />
        </svg>
    ),
    brush: (
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M18 5L23 10L12 21L7 21L7 16L18 5Z" stroke="currentColor" strokeWidth="1.5" />
            <path d="M6 23H24" stroke="currentColor" strokeWidth="1.5" />
        </svg>
    ),
    text: (
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M8 8V6H20V8M14 6V22M11 22H17" stroke="currentColor" strokeWidth="1.5" />
        </svg>
    ),
    patterns: (
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M5 20L10 8L15 18L19 5L24 15" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
    ),
    measure: (
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 8V20M24 8V20M4 14H24M8 14V11M12 14V11M16 14V11M20 14V11" stroke="currentColor" strokeWidth="1.5" />
        </svg>
    ),
    delete: (
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M8 8L20 20M20 8L8 20" stroke="currentColor" strokeWidth="1.5" />
        </svg>
    )
}

const TOOLS = [
    { id: 'crosshair', icon: Icons.crosshair, title: 'Перекрестие', hasSubmenu: true },
    { id: 'trend', icon: Icons.trend, title: 'Линии тренда', hasSubmenu: true },
    { id: 'fib', icon: Icons.fib, title: 'Инструменты Ганна и Фибоначчи', hasSubmenu: true },
    { id: 'brush', icon: Icons.brush, title: 'Геометрические фигуры', hasSubmenu: true },
    { id: 'text', icon: Icons.text, title: 'Текст', hasSubmenu: true },
    { id: 'patterns', icon: Icons.patterns, title: 'Паттерны', hasSubmenu: true },
    { id: 'measure', icon: Icons.measure, title: 'Измерение', hasSubmenu: false },
]



function LeftSidebar() {
    const { activeTool, setActiveTool } = useLayoutStore()

    return (
        <div className="left-sidebar">
            {TOOLS.map(tool => (
                <div key={tool.id} className="left-sidebar__wrapper">
                    <button
                        className={`left-sidebar__tool ${activeTool === tool.id ? 'active' : ''}`}
                        title={tool.title}
                        onClick={() => setActiveTool(tool.id)}
                    >
                        {tool.icon}
                        {tool.hasSubmenu && (
                            <div className="left-sidebar__arrow">
                                <svg width="6" height="6" viewBox="0 0 6 6" fill="none">
                                    <path d="M6 6H0V0L6 6Z" fill="currentColor" opacity="0.6" />
                                </svg>
                            </div>
                        )}
                    </button>
                </div>
            ))}

            <div className="left-sidebar__spacer" />

            <button className="left-sidebar__tool" title="Удалить объекты">
                {Icons.delete}
            </button>
        </div>
    )
}

export default LeftSidebar

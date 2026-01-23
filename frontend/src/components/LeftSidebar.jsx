import React, { useState, useEffect, useRef } from 'react'
import { useLayoutStore } from '../stores/useLayoutStore'
import './LeftSidebar.scss'

// Helper to create simple Icon components or use existing ones
// For now, reusing generic icons but mapping them logically
const Icons = {
    // Trend
    trend: <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><path d="M6 22L22 6M6 22H10M22 6V10" stroke="currentColor" strokeWidth="1.5" /></svg>,
    ray: <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><path d="M6 22L22 6M22 6H18M22 6V10" stroke="currentColor" strokeWidth="1.5" /></svg>,
    info: <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><path d="M14 22V12M14 6H14.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>,
    extended: <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><path d="M4 24L24 4" stroke="currentColor" strokeWidth="1.5" /></svg>,
    horizontal: <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><path d="M4 14H24" stroke="currentColor" strokeWidth="1.5" /></svg>,
    vertical: <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><path d="M14 4V24" stroke="currentColor" strokeWidth="1.5" /></svg>,
    cross: <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><path d="M14 4V24M4 14H24" stroke="currentColor" strokeWidth="1.5" /></svg>,
    parallel: <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><path d="M6 20L18 8M10 24L22 12" stroke="currentColor" strokeWidth="1.5" /></svg>,

    // Fib
    fibRet: <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><path d="M4 20H24M4 15H24M4 10H24M4 6H24M4 24H24" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 2" /></svg>,
    fibExt: <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><path d="M4 22L12 10L24 16" stroke="currentColor" strokeWidth="1.5" /><path d="M4 14H24M4 18H24" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" /></svg>,
    pitchfork: <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><path d="M4 14L24 4M24 14L24 24M4 14L24 14" stroke="currentColor" strokeWidth="1.5" /></svg>,

    // Shapes
    brush: <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><path d="M18 5L23 10L12 21L7 21L7 16L18 5Z" stroke="currentColor" strokeWidth="1.5" /><path d="M6 23H24" stroke="currentColor" strokeWidth="1.5" /></svg>,
    rect: <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><rect x="5" y="8" width="18" height="12" stroke="currentColor" strokeWidth="1.5" /></svg>,
    circle: <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><circle cx="14" cy="14" r="9" stroke="currentColor" strokeWidth="1.5" /></svg>,
    triangle: <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><path d="M14 6L22 22H6L14 6Z" stroke="currentColor" strokeWidth="1.5" /></svg>,
    arrow: <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><path d="M6 22L21 7M21 7V13M21 7H15" stroke="currentColor" strokeWidth="1.5" /></svg>,

    // Text
    text: <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><path d="M8 8V6H20V8M14 6V22M11 22H17" stroke="currentColor" strokeWidth="1.5" /></svg>,

    // Patterns
    pattern: <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><path d="M4 20L9 8L14 18L19 5L24 15" stroke="currentColor" strokeWidth="1.5" /></svg>,

    // Prediction
    long: <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><path d="M14 4V24" stroke="currentColor" strokeWidth="1.5" /><rect x="6" y="4" width="16" height="10" fill="currentColor" fillOpacity="0.2" /></svg>,
    short: <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><path d="M14 4V24" stroke="currentColor" strokeWidth="1.5" /><rect x="6" y="14" width="16" height="10" fill="currentColor" fillOpacity="0.2" /></svg>,

    // Measure
    measure: <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><path d="M4 8V20M24 8V20M4 14H24M8 14V11M12 14V11M16 14V11M20 14V11" stroke="currentColor" strokeWidth="1.5" /></svg>,
    delete: <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><path d="M8 8L20 20M20 8L8 20" stroke="currentColor" strokeWidth="1.5" /></svg>,

    // Chart Controls
    magnet: <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><path d="M10 4H8C6 4 4 6 4 8V12H8V8H10V12H14V8H16V12H20V8C20 6 18 4 16 4H14M4 16V20C4 22 6 24 8 24H10V20H8V16H4M14 20V24H16C18 24 20 22 20 20V16H16V20H14" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.2" /></svg>,
    eye: <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><path d="M14 8C8 8 4 14 4 14S8 20 14 20S24 14 24 14S20 8 14 8Z" stroke="currentColor" strokeWidth="1.5" /><circle cx="14" cy="14" r="3" stroke="currentColor" strokeWidth="1.5" /></svg>,
    eyeOff: <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><path d="M6 6L22 22M10 10C9 11 8.5 12 8.5 14C8.5 17 11 19.5 14 19.5C16 19.5 17 19 18 18" stroke="currentColor" strokeWidth="1.5" /></svg>,
    eraser: <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><path d="M19 19L9 9M7 17L17 7C17.5 6.5 18.5 6.5 19 7L21 9C21.5 9.5 21.5 10.5 21 11L11 21C10.5 21.5 9.5 21.5 9 21L7 19C6.5 18.5 6.5 17.5 7 17Z" stroke="currentColor" strokeWidth="1.5" /><path d="M5 23H23" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
}

// Tool Definition Structure
const TOOL_GROUPS = [
    {
        id: 'cursors',
        tools: [
            { id: 'crosshair', icon: Icons.cross, title: 'Перекрестие' },
            { id: 'cursor', icon: Icons.trend, title: 'Курсор' }, // Placeholder icon
        ]
    },
    {
        id: 'lines',
        tools: [
            { id: 'trend', icon: Icons.trend, title: 'Линия тренда' },
            { id: 'ray', icon: Icons.ray, title: 'Луч' },
            { id: 'extended', icon: Icons.extended, title: 'Прямая' },
            { id: 'horizontal', icon: Icons.horizontal, title: 'Горизонтальная линия' },
            { id: 'vertical', icon: Icons.vertical, title: 'Вертикальная линия' },
            { id: 'parallel-channel', icon: Icons.parallel, title: 'Параллельный канал' },
        ]
    },
    {
        id: 'fib',
        tools: [
            { id: 'fib-retracement', icon: Icons.fibRet, title: 'Коррекция по Фибоначчи' },
            { id: 'fib-extension', icon: Icons.fibExt, title: 'Расширение Фибоначчи' },
        ]
    },
    {
        id: 'shapes',
        tools: [
            { id: 'brush', icon: Icons.brush, title: 'Кисть' },
            { id: 'rectangle', icon: Icons.rect, title: 'Прямоугольник' },
            { id: 'circle', icon: Icons.circle, title: 'Круг' },
            { id: 'triangle', icon: Icons.triangle, title: 'Треугольник' },
            { id: 'arrow', icon: Icons.arrow, title: 'Стрелка' },
        ]
    },
    {
        id: 'text',
        tools: [
            { id: 'text', icon: Icons.text, title: 'Текст' },
        ]
    },
    {
        id: 'patterns',
        tools: [
            { id: 'pattern-triangle', icon: Icons.pattern, title: 'Треугольник (Паттерн)' }, // Alias for now
            { id: 'pattern-head-shoulders', icon: Icons.pattern, title: 'Голова и Плечи' },
            { id: 'pattern-abcd', icon: Icons.pattern, title: 'ABCD Паттерн' },
        ]
    },
    {
        id: 'prediction',
        tools: [
            { id: 'long-position', icon: Icons.long, title: 'Длинная позиция' },
            { id: 'short-position', icon: Icons.short, title: 'Короткая позиция' },
            { id: 'date-price-range', icon: Icons.measure, title: 'Диапазон цен и времени' },
        ]
    },
    {
        id: 'measure_group',
        tools: [
            { id: 'measure', icon: Icons.measure, title: 'Линейка' },
        ]
    },
    {
        id: 'eraser_group',
        tools: [
            { id: 'eraser', icon: Icons.eraser, title: 'Ластик' },
        ]
    },
    {
        id: 'magnet_group',
        tools: [
            { id: 'magnet', icon: Icons.magnet, title: 'Магнит', isControl: true },
        ]
    },
    {
        id: 'hide_drawings_group',
        tools: [
            { id: 'hide-drawings', icon: Icons.eye, iconOff: Icons.eyeOff, title: 'Скрыть рисунки', isControl: true },
        ]
    }
]

function LeftSidebar() {
    const {
        activeTool,
        setActiveTool,
        clearAllDrawings,
        magnetMode,
        setMagnetMode,
        drawingsVisible,
        setDrawingsVisible
    } = useLayoutStore()

    // State to track the "Active" (last used) tool for each group
    const [groupState, setGroupState] = useState({})
    // State for currently open dropdown (by group ID)
    const [openGroup, setOpenGroup] = useState(null)
    const sidebarRef = useRef(null)

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (sidebarRef.current && !sidebarRef.current.contains(event.target)) {
                setOpenGroup(null)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const handleToolClick = (group, tool) => {
        // Handle control buttons differently
        if (tool.isControl) {
            if (tool.id === 'magnet') {
                setMagnetMode(!magnetMode)
            } else if (tool.id === 'hide-drawings') {
                setDrawingsVisible(!drawingsVisible)
            }
            setOpenGroup(null)
            return
        }

        setActiveTool(tool.id)
        setGroupState(prev => ({ ...prev, [group.id]: tool }))
        setOpenGroup(null) // Close menu
    }

    const toggleGroup = (groupId) => {
        setOpenGroup(prev => (prev === groupId ? null : groupId))
    }

    return (
        <div className="left-sidebar" ref={sidebarRef}>
            {TOOL_GROUPS.map(group => {
                // Determine current tool to show icon for
                const currentTool = groupState[group.id] || group.tools[0]

                // For control groups, check toggle states
                let isActive = false
                if (group.id === 'magnet_group') {
                    isActive = magnetMode // Active when magnet is ON
                } else if (group.id === 'hide_drawings_group') {
                    isActive = drawingsVisible // Active when drawings are VISIBLE
                } else {
                    isActive = group.tools.some(t => t.id === activeTool)
                }

                const hasSubmenu = group.tools.length > 1

                return (
                    <div key={group.id} className="left-sidebar__wrapper" style={{ position: 'relative' }}>
                        <div className="left-sidebar__group-btn-container">
                            {/* Main Button (Activates Current Tool) */}
                            <button
                                className={`left-sidebar__tool ${isActive ? 'active' : ''} ${hasSubmenu ? 'has-arrow' : ''}`}
                                title={currentTool.title}
                                onClick={() => handleToolClick(group, currentTool)}
                            >
                                {/* Show iconOff for hide-drawings when drawings are hidden */}
                                {group.id === 'hide_drawings_group' && !drawingsVisible && currentTool.iconOff
                                    ? currentTool.iconOff
                                    : currentTool.icon}
                            </button>

                            {/* Arrow Button (Opens Menu) */}
                            {hasSubmenu && (
                                <button
                                    className={`left-sidebar__arrow-btn ${openGroup === group.id ? 'open' : ''}`}
                                    onClick={(e) => { e.stopPropagation(); toggleGroup(group.id); }}
                                >
                                    <svg width="6" height="6" viewBox="0 0 6 6" fill="none">
                                        <path d="M6 6H0V0L6 6Z" fill="currentColor" opacity="0.6" />
                                    </svg>
                                </button>
                            )}
                        </div>

                        {/* Dropdown Menu */}
                        {hasSubmenu && openGroup === group.id && (
                            <div className="left-sidebar__submenu">
                                {group.tools.map(tool => (
                                    <button
                                        key={tool.id}
                                        className={`left-sidebar__submenu-item ${activeTool === tool.id ? 'active' : ''}`}
                                        onClick={() => handleToolClick(group, tool)}
                                    >
                                        <span className="submenu-icon">{tool.icon}</span>
                                        <span className="submenu-text">{tool.title}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )
            })}

            <div className="left-sidebar__spacer" />

            <button className="left-sidebar__tool" title="Удалить все объекты">
                {Icons.delete}
            </button>
        </div>
    )
}

export default LeftSidebar

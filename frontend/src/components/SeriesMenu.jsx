import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import './SeriesMenu.scss'

function SeriesMenu({ name, color, priceScale, onScaleChange, onMoveToPane, onHide, onRemove, hoverOnly = false, paneIndex = 0, totalPanes = 1, paneSeriesCount = 1 }) {
    const [isOpen, setIsOpen] = useState(false)
    const [showScaleSubmenu, setShowScaleSubmenu] = useState(false)
    const [showMoveSubmenu, setShowMoveSubmenu] = useState(false)
    const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 })
    const menuRef = useRef(null)
    const triggerRef = useRef(null)

    const isFirstPane = paneIndex === 0
    const isLastPane = paneIndex === totalPanes - 1
    const isOnlySeries = paneSeriesCount === 1

    const canMoveNewAbove = !(isOnlySeries && isFirstPane)
    const canMoveNewBelow = !(isOnlySeries && isLastPane)

    useEffect(() => {
        const handleClickOutside = (e) => {
            // Check if click is inside the trigger
            if (triggerRef.current && triggerRef.current.contains(e.target)) {
                return;
            }
            // Check if click is inside the portal menu (we need a ref for the dropdown content too if possible, but basic click outside on document usually works if we stop propagation inside)
            // However, since it's a portal, 'menuRef' won't contain it if menuRef is on the wrapper.
            // We need to attach a ref to the dropdown portal element or handle it differently.
            // Simpler: Check if target closest is .series-menu__dropdown
            if (e.target.closest('.series-menu__dropdown')) return;

            setIsOpen(false)
            setShowScaleSubmenu(false)
            setShowMoveSubmenu(false)
        }

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside)
        }
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [isOpen])

    // Update position when opening
    useEffect(() => {
        if (isOpen && triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect()
            let top = rect.bottom + window.scrollY + 4
            let left = rect.left + window.scrollX

            // Check vertical overflow (approx height 320px)
            if (rect.bottom + 320 > window.innerHeight + window.scrollY) {
                top = rect.top + window.scrollY - 4 // Position above
                // We will add a class to flip the menu if needed, or just CSS transform.
                // But since it is a portal, 'bottom' positioning is better if flipping.
                // Let's just set top to make it appear above.
                // We need to know the height of the dropdown to position it exactly "top - height".
                // Since we don't know height yet (it's not rendered), we can use 'bottom' style or render hidden.
                // Simplest: use a state for 'placement' and allow CSS to handle 'bottom: ...' vs 'top: ...'
                // Or just estimate.

                // Better approach: Measure after render? 
                // Let's blindly flip if low.
                // But if we set 'top', we need to subtract height. 
                // CSS approach: use .series-menu__dropdown--up { bottom: 100% of trigger ... } ?
                // But this is a Portal at body level. so 'bottom' refers to page bottom if position absolute.

                // Let's just shift it up by a fixed amount approx? No, that's ugly.
                // Let's try to detect size.
                // Or: Render it, then measure in useLayoutEffect?
            }
            // For now, simple flip prediction:
            const isBottom = rect.bottom > window.innerHeight * 0.7
            if (isBottom) {
                // Position above
                // We'll set a flag 'isUpwards'
                // And we need to use 'bottom' CSS property relative to screen?
                // No, top = rect.top - (height?)
                // If we don't know height, we can set 'bottom' relative to viewport? 
                // style={{ bottom: window.innerHeight - rect.top, top: 'auto' }}
                setMenuPosition({
                    top: 'auto',
                    bottom: window.innerHeight - rect.top - window.scrollY + 4,
                    left: rect.left + window.scrollX,
                    isUpwards: true
                })
            } else {
                setMenuPosition({
                    top: rect.bottom + window.scrollY + 4,
                    bottom: 'auto',
                    left: rect.left + window.scrollX,
                    isUpwards: false
                })
            }
        }
    }, [isOpen])

    const closeMenu = () => {
        setIsOpen(false)
        setShowScaleSubmenu(false)
        setShowMoveSubmenu(false)
    }

    const menuClass = `series-menu${hoverOnly ? ' series-menu--hover-only' : ''}`

    const dropdown = (
        <div
            className="series-menu__dropdown"
            style={{
                position: 'absolute',
                top: menuPosition.top,
                bottom: menuPosition.bottom,
                left: menuPosition.left,
                zIndex: 9999,
                transform: menuPosition.isUpwards ? 'translateY(0)' : 'none', // Adjust if needed
                // If upwards, usually we want it to grow up. Flex col handles it? 
                // If top is auto and bottom is set, it grows up. Correct.
            }}
        >
            {/* Header with color indicator */}
            <div className="series-menu__header">
                <span className="color-dot" style={{ background: color }} />
                <span className="name">{name}</span>
            </div>

            <div className="series-menu__divider" />

            {/* Add alert */}
            <button className="series-menu__item">
                <span className="icon">🔔</span>
                <span>Добавить оповещение</span>
            </button>

            {/* Add indicator */}
            <button className="series-menu__item">
                <span className="icon">📊</span>
                <span>Добавить индикатор</span>
                <span className="arrow">›</span>
            </button>

            <div className="series-menu__divider" />

            {/* Instrument info */}
            <button className="series-menu__item">
                <span className="icon">ⓘ</span>
                <span>Информация об инструменте</span>
            </button>

            {/* Copy price */}
            <button className="series-menu__item">
                <span className="icon">📋</span>
                <span>Копировать текущую цену</span>
            </button>

            <div className="series-menu__divider" />

            {/* Layer order */}
            {onMoveToPane && (
                <button
                    className="series-menu__item"
                    onMouseEnter={() => setShowMoveSubmenu(true)}
                    onMouseLeave={() => setShowMoveSubmenu(false)}
                >
                    <span className="icon">↕</span>
                    <span>Переместить</span>
                    <span className="arrow">›</span>

                    {showMoveSubmenu && (
                        <div className="series-menu__submenu">
                            {paneIndex > 0 && (
                                <button className="series-menu__item" onClick={() => { onMoveToPane?.('to_pane_above'); closeMenu(); }}>
                                    <span className="icon">↑</span>
                                    <span>На панель выше</span>
                                </button>
                            )}
                            {paneIndex < totalPanes - 1 && (
                                <button className="series-menu__item" onClick={() => { onMoveToPane?.('to_pane_below'); closeMenu(); }}>
                                    <span className="icon">↓</span>
                                    <span>На панель ниже</span>
                                </button>
                            )}

                            {(paneIndex > 0 || paneIndex < totalPanes - 1) && <div className="series-menu__divider" />}

                            {canMoveNewAbove && (
                                <button className="series-menu__item" onClick={() => { onMoveToPane?.('new_pane_above'); closeMenu(); }}>
                                    <span className="icon">↑</span>
                                    <span>Выше, на новую панель</span>
                                </button>
                            )}
                            {canMoveNewBelow && (
                                <button className="series-menu__item" onClick={() => { onMoveToPane?.('new_pane_below'); closeMenu(); }}>
                                    <span className="icon">↓</span>
                                    <span>Ниже, на новую панель</span>
                                </button>
                            )}
                        </div>
                    )}
                </button>
            )}

            {/* Scale binding */}
            {onScaleChange && (
                <button
                    className="series-menu__item"
                    onMouseEnter={() => setShowScaleSubmenu(true)}
                    onMouseLeave={() => setShowScaleSubmenu(false)}
                >
                    <span className="icon">⇔</span>
                    <span>Закрепить на шкале</span>
                    <span className="arrow">›</span>

                    {showScaleSubmenu && (
                        <div className="series-menu__submenu">
                            <button
                                className={`series-menu__item ${priceScale === 'right' ? 'active' : ''}`}
                                onClick={() => { onScaleChange?.('right'); closeMenu(); }}
                            >
                                {priceScale === 'right' && <span className="check">✓</span>}
                                <span>Закреплено на правой шкале</span>
                            </button>
                            <button
                                className={`series-menu__item ${priceScale === 'left' ? 'active' : ''}`}
                                onClick={() => { onScaleChange?.('left'); closeMenu(); }}
                            >
                                {priceScale === 'left' && <span className="check">✓</span>}
                                <span>Закрепить на левой шкале</span>
                            </button>
                            <button
                                className={`series-menu__item ${!priceScale ? 'active' : ''}`}
                                onClick={() => { onScaleChange?.(''); closeMenu(); }}
                            >
                                <span>Без шкалы (на весь экран)</span>
                            </button>
                        </div>
                    )}
                </button>
            )}

            <div className="series-menu__divider" />

            {/* Hide */}
            <button className="series-menu__item" onClick={() => { onHide?.(); closeMenu(); }}>
                <span className="icon">👁</span>
                <span>Скрыть</span>
            </button>

            {/* Remove */}
            {onRemove && (
                <button className="series-menu__item danger" onClick={() => { onRemove(); closeMenu(); }}>
                    <span className="icon">🗑</span>
                    <span>Удалить</span>
                </button>
            )}

            <div className="series-menu__divider" />

            {/* Settings */}
            <button className="series-menu__item">
                <span className="icon">⚙</span>
                <span>Настройки...</span>
            </button>
        </div>
    )

    return (
        <div className={menuClass} ref={menuRef}>
            <button
                ref={triggerRef}
                className={`series-menu__trigger${isOpen ? ' active' : ''}`}
                onClick={() => setIsOpen(!isOpen)}
            >
                ⋯
            </button>

            {isOpen && createPortal(dropdown, document.body)}
        </div>
    )
}


export default SeriesMenu

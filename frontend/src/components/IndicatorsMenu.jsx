import React, { useState, useEffect, useRef } from 'react'
import ReactDOM from 'react-dom'
import './IndicatorsMenu.scss'

const INDICATORS = [
    { id: 'SMA', name: 'Скользящая средняя (SMA)', category: 'Trend', type: 'overlay', defaultParams: { length: 20 } },
    { id: 'EMA', name: 'Экспоненциальная скользящая средняя (EMA)', category: 'Trend', type: 'overlay', defaultParams: { length: 20 } },
    { id: 'RSI', name: 'Индекс относительной силы (RSI)', category: 'Oscillator', type: 'pane', defaultParams: { length: 14 } },
    { id: 'MACD', name: 'Схождение/расхождение скользящих средних (MACD)', category: 'Oscillator', type: 'pane', defaultParams: { fast: 12, slow: 26, signal: 9 } },
    { id: 'Bollinger', name: 'Полосы Боллинджера (BB)', category: 'Volatility', type: 'overlay', defaultParams: { length: 20, mult: 2.0 } },
    { id: 'BTC_GM2', name: 'BTC vs Global M2 (Custom)', category: 'Custom', type: 'pane', chartType: 'line', defaultParams: { sma_weeks: 52 } }
]

const TABS = ['Все', 'Избранное', 'Встроенные', 'Скрипты', 'Мои скрипты']

const IndicatorsMenu = ({ isOpen, onClose, onSelect }) => {
    const [searchTerm, setSearchTerm] = useState('')
    const [activeTab, setActiveTab] = useState('Встроенные')
    const inputRef = useRef(null)

    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus()
            setSearchTerm('')
        }
    }, [isOpen])

    if (!isOpen) return null

    const filteredIndicators = INDICATORS.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.id.toLowerCase().includes(searchTerm.toLowerCase())
    )

    return ReactDOM.createPortal(
        <div className="indicators-menu-overlay" onClick={onClose}>
            <div className="indicators-menu-modal" onClick={e => e.stopPropagation()}>
                <div className="indicators-menu__header">
                    <div className="indicators-menu__title">Индикаторы, показатели и стратегии</div>
                    <button className="indicators-menu__close" onClick={onClose}>✕</button>
                </div>

                <div className="indicators-menu__input-wrapper">
                    <span className="search-icon">🔍</span>
                    <input
                        ref={inputRef}
                        type="text"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        placeholder="Поиск"
                        className="indicators-menu__input"
                    />
                </div>

                <div className="indicators-menu__content">
                    {/* Categories Sidebar */}
                    <div className="indicators-menu__sidebar">
                        {TABS.map(tab => (
                            <button
                                key={tab}
                                className={`sidebar-btn ${activeTab === tab ? 'active' : ''}`}
                                onClick={() => setActiveTab(tab)}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>

                    {/* List */}
                    <div className="indicators-menu__list">
                        {filteredIndicators.map((item) => (
                            <div key={item.id} className="indicator-item" onClick={() => { onSelect(item); onClose(); }}>
                                <div className="indicator-item__info">
                                    <div className="indicator-name">{item.name}</div>
                                </div>
                                <div className="indicator-item__actions">
                                    <span className="star-icon">☆</span>
                                </div>
                            </div>
                        ))}
                        {filteredIndicators.length === 0 && (
                            <div className="no-results">Ничего не найдено</div>
                        )}
                    </div>
                </div>
            </div>
        </div>,
        document.body
    )
}

export default IndicatorsMenu

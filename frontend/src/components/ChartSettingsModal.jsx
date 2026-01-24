import React, { useState } from 'react'
import { useLayoutStore } from '../stores/useLayoutStore'
import './ChartSettingsModal.scss'

const ChartSettingsModal = ({ onClose, mainSeriesId }) => {
    const [activeTab, setActiveTab] = useState('instrument')

    // --- STORE ACTIONS ---
    const updateSeriesSettings = useLayoutStore(state => state.updateSeriesSettings)
    const setChartAppearance = useLayoutStore(state => state.setChartAppearance)
    const chartAppearance = useLayoutStore(state => state.chartAppearance)
    const interfaceAppearance = useLayoutStore(state => state.interfaceAppearance)
    const setInterfaceAppearance = useLayoutStore(state => state.setInterfaceAppearance)

    // --- SERIES STATE ---
    // Retrieve the actual series object from store to reflect current state
    const series = useLayoutStore(state => {
        if (!mainSeriesId) return null
        for (const pane of state.panes) {
            const s = pane.series.find(ser => ser.id === mainSeriesId)
            if (s) return s
        }
        return null
    })

    // Helper for series updates
    const updateSeries = (key, value) => {
        if (mainSeriesId) updateSeriesSettings(mainSeriesId, { [key]: value })
    }

    // Fallback safe values
    const s = series || {}

    // "Instrument" State (Local overrides if needed, but we use store directly now)
    // We keep dataSettings local for now as they might not be in store series
    // "Instrument" State
    // dataSettings removed, reading from chartAppearance/store directly where possible
    // or we can sync local state with store on mount.
    // Let's rely on chartAppearance for timezone if we added it there.
    // For precision, we still use local or store.
    const [precision, setPrecision] = useState('default')

    // We access chartAppearance directly from store hook below

    // "Appearance" State (Local state removed, using store 'chartAppearance')
    // Placeholder to prevent crash if old 'appearance' usage remains
    // We will replace usage of 'appearance' with 'chartAppearance'
    const appearance = chartAppearance // Alias for easier refactoring below

    const [showTemplateMenu, setShowTemplateMenu] = useState(false)

    const applyTemplate = (templateName) => {
        if (templateName === 'Late') {
            // 1. Appearance: Gradient Black -> #131313
            setChartAppearance({
                backgroundType: 'gradient',
                backgroundColor1: '#000000',
                backgroundColor2: '#010101'
            })

            // 1.1 Interface Colors
            setInterfaceAppearance({
                bgPrimary: '#131313',
                bgSecondary: '#020203'
            })

            // 2. Timezone: UTC+3
            setChartAppearance({ timezone: 'UTC+3' })

            // 3. Series: Hollow, Black/White scheme
            // "wick only first body 0 0 0" -> Wick Up = Black
            // "all other 255 255 255" -> Wick Down, Borders, Bodies = White
            if (mainSeriesId) {
                updateSeriesSettings(mainSeriesId, {
                    // Hollow Style
                    upColor: 'transparent',
                    downColor: '#FFFFFF',

                    borderVisible: true,
                    borderUpColor: '#FFFFFF',
                    borderDownColor: '#FFFFFF',

                    wickVisible: true,
                    wickUpColor: '#FFFFFF',
                    wickDownColor: '#FFFFFF',

                    bodyVisible: true // Hollow implies visible body (just transparent color)
                })
            }
        }
        setShowTemplateMenu(false)
    }

    const tabs = [
        { id: 'instrument', label: 'Инструмент', icon: '\u233D' }, // Placeholder icon
        { id: 'status', label: 'Строка статуса', icon: '\u2261' },
        { id: 'scales', label: 'Шкалы и линии', icon: '\u21B3' },
        { id: 'scales', label: 'Шкалы и линии', icon: '\u21B3' },
        { id: 'appearance', label: 'Оформление', icon: '\u270E' }, // Pencilish
        { id: 'interface', label: 'Интерфейс', icon: '\uD83C\uDFA8' }, // Palette
        { id: 'trading', label: 'Торговля', icon: '\u21C4' },
        { id: 'alerts', label: 'Оповещения', icon: '\u23F0' },
        { id: 'events', label: 'События', icon: '\uD83D\uDCC5' },
    ]

    const renderInstrument = () => (
        <div className="tab-content instrument-tab">
            <div className="section">
                <h4>ПУСТЫЕ СВЕЧИ</h4> {/* Assuming translation 'Candles' */}
                <div className="form-row">
                    <span>Стиль</span>
                    <select
                        value={s.upColor === 'transparent' ? 'hollow' : 'filled'}
                        onChange={e => {
                            const type = e.target.value
                            if (type === 'hollow') {
                                // Set upColor to transparent, force borders on for visibility
                                updateSeries('upColor', 'transparent')
                                updateSeries('borderVisible', true)
                                // Ensure border color is green (or current up color if not transparent)
                                if (s.borderUpColor === 'transparent' || !s.borderUpColor) updateSeries('borderUpColor', '#26a69a')
                            } else {
                                // Restore filled color (default green if currently transparent)
                                // We need to know what the "filled" color was. 
                                // Ideally store "filledUpColor" separately, but for now fallback to standard green.
                                updateSeries('upColor', s.borderUpColor && s.borderUpColor !== 'transparent' ? s.borderUpColor : '#26a69a')
                            }
                        }}
                    >
                        <option value="filled">Японские свечи</option>
                        <option value="hollow">Пустые свечи</option>
                    </select>
                </div>
                <div className="form-row">
                    <label>
                        <input
                            type="checkbox"
                            checked={s.bodyVisible !== false}
                            onChange={e => updateSeries('bodyVisible', e.target.checked)}
                        />
                        Тело
                    </label>
                    <div className="color-pickers">
                        <input type="color" value={s.upColor || '#26a69a'} onChange={e => updateSeries('upColor', e.target.value)} />
                        <input type="color" value={s.downColor || '#ef5350'} onChange={e => updateSeries('downColor', e.target.value)} />
                    </div>
                </div>
                <div className="form-row">
                    <label>
                        <input
                            type="checkbox"
                            checked={s.borderVisible !== false}
                            onChange={e => updateSeries('borderVisible', e.target.checked)}
                        />
                        Границы
                    </label>
                    <div className="color-pickers">
                        <input type="color" value={s.borderUpColor || s.upColor || '#26a69a'} onChange={e => updateSeries('borderUpColor', e.target.value)} />
                        <input type="color" value={s.borderDownColor || s.downColor || '#ef5350'} onChange={e => updateSeries('borderDownColor', e.target.value)} />
                    </div>
                </div>
                <div className="form-row">
                    <label>
                        <input
                            type="checkbox"
                            checked={s.wickVisible !== false}
                            onChange={e => updateSeries('wickVisible', e.target.checked)}
                        />
                        Фитиль
                    </label>
                    <div className="color-pickers">
                        <input type="color" value={s.wickUpColor || s.upColor || '#26a69a'} onChange={e => updateSeries('wickUpColor', e.target.value)} />
                        <input type="color" value={s.wickDownColor || s.downColor || '#ef5350'} onChange={e => updateSeries('wickDownColor', e.target.value)} />
                    </div>
                </div>
            </div>

            <div className="section">
                <h4>НАСТРОЙКА ДАННЫХ</h4>
                <div className="form-row">
                    <span>Точность</span>
                    <select value={precision} onChange={e => setPrecision(e.target.value)}>
                        <option value="default">Не задано</option>
                        <option value="2">2 знака</option>
                    </select>
                </div>
                <div className="form-row">
                    <span>Часовой пояс</span>
                    <select
                        value={chartAppearance.timezone || 'UTC+2'}
                        onChange={e => setChartAppearance({ timezone: e.target.value })}
                    >
                        <option value="UTC">(UTC) Лондон</option>
                        <option value="UTC+2">(UTC+2) Рига</option>
                        <option value="UTC+3">(UTC+3) Москва</option>
                    </select>
                </div>
            </div>
        </div>
    )

    const renderAppearance = () => (
        <div className="tab-content appearance-tab">
            <div className="section">
                <h4>ОСНОВНОЙ СТИЛЬ ГРАФИКА</h4>
                <div className="form-row">
                    <span>Фон</span>
                    <div className="combo-input">
                        <select value={chartAppearance.backgroundType} onChange={e => setChartAppearance({ backgroundType: e.target.value })}>
                            <option value="solid">Сплошной</option>
                            <option value="gradient">Градиент</option>
                        </select>
                        <div className="color-pickers">
                            <input type="color" value={chartAppearance.backgroundColor1} onChange={e => setChartAppearance({ backgroundColor1: e.target.value })} />
                            {chartAppearance.backgroundType === 'gradient' && (
                                <input type="color" value={chartAppearance.backgroundColor2} onChange={e => setChartAppearance({ backgroundColor2: e.target.value })} />
                            )}
                        </div>
                    </div>
                </div>
                <div className="form-row">
                    <span>Линии сетки</span>
                    <div className="combo-input">
                        <select value={chartAppearance.gridLines} onChange={e => setChartAppearance({ gridLines: e.target.value })}>
                            <option value="all">Все</option>
                            <option value="vert">Вертикальные</option>
                            <option value="horz">Горизонтальные</option>
                            <option value="none">Нет</option>
                        </select>
                        <input type="color" value={chartAppearance.gridColor} onChange={e => setChartAppearance({ gridColor: e.target.value })} />
                    </div>
                </div>
                <div className="form-row">
                    <span>Перекрестие</span>
                    <div className="combo-input">
                        <input type="color" value="#787b86" disabled />
                        <select value="dashed" disabled><option>---</option></select>
                    </div>
                </div>
                <div className="form-row">
                    <span>Водяной знак</span>
                    <div className="combo-input">
                        <select disabled><option>Симуляция рынка</option></select>
                        <input type="color" value="#333333" disabled />
                    </div>
                </div>
            </div>

            <div className="section">
                <h4>ШКАЛЫ</h4>
                <div className="form-row">
                    <span>Текст</span>
                    <div className="combo-input">
                        <input type="color" value="#787b86" disabled />
                        <select value={appearance.scaleText} onChange={e => setChartAppearance({ scaleText: e.target.value })}>
                            <option value="12">12</option>
                            <option value="14">14</option>
                        </select>
                    </div>
                </div>
                <div className="form-row">
                    <span>Линии</span>
                    <input type="color" value="#2a2e39" disabled />
                </div>
            </div>

            <div className="section">
                <h4>ПОЛЯ</h4>
                <div className="form-row">
                    <span>Сверху</span>
                    <div className="input-with-unit">
                        <input type="number" value={appearance.marginTop} onChange={e => setChartAppearance({ marginTop: e.target.value })} />
                        <span>%</span>
                    </div>
                </div>
                <div className="form-row">
                    <span>Снизу</span>
                    <div className="input-with-unit">
                        <input type="number" value={appearance.marginBottom} onChange={e => setChartAppearance({ marginBottom: e.target.value })} />
                        <span>%</span>
                    </div>
                </div>
                <div className="form-row">
                    <span>Справа</span>
                    <div className="input-with-unit">
                        <input type="number" value={appearance.marginRight} onChange={e => setChartAppearance({ marginRight: e.target.value })} />
                        <span>бары</span>
                    </div>
                </div>
            </div>
        </div>
    )

    const renderInterface = () => (
        <div className="tab-content interface-tab">
            <div className="section">
                <h4>ЦВЕТА ИНТЕРФЕЙСА</h4>
                <div className="form-row">
                    <span>Основной фон</span>
                    <input type="color" value={interfaceAppearance.bgPrimary} onChange={e => setInterfaceAppearance({ bgPrimary: e.target.value })} />
                </div>
                <div className="form-row">
                    <span>Фон панелей</span>
                    <input type="color" value={interfaceAppearance.bgSecondary} onChange={e => setInterfaceAppearance({ bgSecondary: e.target.value })} />
                </div>
                <div className="form-row">
                    <span>Основной текст</span>
                    <input type="color" value={interfaceAppearance.textPrimary} onChange={e => setInterfaceAppearance({ textPrimary: e.target.value })} />
                </div>
                <div className="form-row">
                    <span>Акцентный цвет</span>
                    <input type="color" value={interfaceAppearance.accentColor} onChange={e => setInterfaceAppearance({ accentColor: e.target.value })} />
                </div>
            </div>
            <div className="section">
                <p style={{ fontSize: '12px', color: '#787b86' }}>
                    * Изменения применяются ко всему приложению мгновенно.
                </p>
            </div>
        </div>
    )

    return (
        <div className="chart-settings-modal-overlay" onClick={onClose}>
            <div className="chart-settings-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>Настройки</h3>
                    <button className="close-btn" onClick={onClose}>{'\u2715'}</button>
                </div>

                <div className="modal-body">
                    <div className="sidebar">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                className={`sidebar-tab ${activeTab === tab.id ? 'active' : ''}`}
                                onClick={() => setActiveTab(tab.id)}
                            >
                                <span className="icon">{tab.icon}</span>
                                {tab.label}
                            </button>
                        ))}
                    </div>
                    <div className="content">
                        {activeTab === 'instrument' && renderInstrument()}
                        {activeTab === 'appearance' && renderAppearance()}
                        {activeTab === 'interface' && renderInterface()}
                        {/* Placeholders for others */}
                        {['status', 'scales', 'trading', 'alerts', 'events'].includes(activeTab) && (
                            <div className="tab-content placeholder">
                                <p>Настройки раздела "{tabs.find(t => t.id === activeTab)?.label}"</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="modal-footer">
                    <div className="left" style={{ position: 'relative' }}>
                        <button className="footer-btn" onClick={() => setShowTemplateMenu(!showTemplateMenu)}>
                            Шаблон {'\u25BC'}
                        </button>
                        {showTemplateMenu && (
                            <div className="template-menu" style={{
                                position: 'absolute',
                                bottom: '100%',
                                left: 0,
                                background: '#1e222d',
                                border: '1px solid #2a2e39',
                                borderRadius: '4px',
                                padding: '4px 0',
                                zIndex: 100,
                                minWidth: '120px'
                            }}>
                                <button
                                    onClick={() => applyTemplate('Late')}
                                    style={{
                                        display: 'block',
                                        width: '100%',
                                        textAlign: 'left',
                                        background: 'none',
                                        border: 'none',
                                        color: '#d1d4dc',
                                        padding: '8px 16px',
                                        cursor: 'pointer',
                                    }}
                                    onMouseEnter={e => e.target.style.background = '#2a2e39'}
                                    onMouseLeave={e => e.target.style.background = 'none'}
                                >
                                    Late
                                </button>
                            </div>
                        )}
                    </div>
                    <div className="right">
                        <button className="footer-btn" onClick={onClose}>Отмена</button>
                        <button className="footer-btn primary" onClick={onClose}>Ок</button>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ChartSettingsModal

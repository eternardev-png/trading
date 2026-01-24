import React, { useState } from 'react'
import ReactDOM from 'react-dom'
import { useLayoutStore } from '../stores/useLayoutStore'
import ConditionBuilder from './ConditionBuilder'
import { runBacktest } from '../utils/strategyEngine'
import './StrategyBuilder.scss'

function StrategyBuilder({ isOpen, onClose }) {
    const { addStrategy, panes } = useLayoutStore()

    const [activeTab, setActiveTab] = useState('settings')
    const [strategyName, setStrategyName] = useState('My Strategy')
    const [backtestResults, setBacktestResults] = useState(null)
    const [isRunningBacktest, setIsRunningBacktest] = useState(false)

    // Settings Tab
    const [settings, setSettings] = useState({
        initialCapital: 100000,
        baseCurrency: 'USD',
        orderSize: 10,
        orderSizeType: 'percent', // 'percent' | 'fixed'
        pyramiding: 1000,
        commission: 0,
        slippage: 0,
        verifyPriceForLimitOrders: 0
    })

    // Conditions
    const [buyConditions, setBuyConditions] = useState([])
    const [sellConditions, setSellConditions] = useState([])

    // Style
    const [style, setStyle] = useState({
        buySignalColor: '#26a69a',
        sellSignalColor: '#ef5350',
        showLabels: true,
        showArrows: true
    })

    // Visibility
    const [visibility, setVisibility] = useState({
        showOnChart: true,
        showInDataWindow: true
    })

    const handleAddBuyCondition = () => {
        setBuyConditions([...buyConditions, {
            id: Date.now(),
            pair: 'BTC/USDT',
            operator: '<',
            compareType: 'indicator', // 'indicator' | 'pair' | 'value'
            compareIndicator: 'SMA',
            compareParams: { period: 20 },
            comparePair: '',
            compareValue: 0,
            positionSize: 1,
            positionSizeType: 'percent',
            enableDCA: false,
            dcaPeriod: '5d'
        }])
    }

    const handleAddSellCondition = () => {
        setSellConditions([...sellConditions, {
            id: Date.now(),
            pair: 'BTC/USDT',
            operator: '>',
            compareType: 'indicator',
            compareIndicator: 'SMA',
            compareParams: { period: 20 },
            comparePair: '',
            compareValue: 0,
            positionSize: 1,
            positionSizeType: 'percent',
            enableDCA: false,
            dcaPeriod: '5d'
        }])
    }

    const handleRemoveCondition = (type, id) => {
        if (type === 'buy') {
            setBuyConditions(buyConditions.filter(c => c.id !== id))
        } else {
            setSellConditions(sellConditions.filter(c => c.id !== id))
        }
    }

    const handleUpdateCondition = (type, id, updates) => {
        if (type === 'buy') {
            setBuyConditions(buyConditions.map(c => c.id === id ? { ...c, ...updates } : c))
        } else {
            setSellConditions(sellConditions.map(c => c.id === id ? { ...c, ...updates } : c))
        }
    }

    const handleRunBacktest = async () => {
        if (buyConditions.length === 0 && sellConditions.length === 0) {
            alert('Добавьте хотя бы одно условие покупки или продажи')
            return
        }

        setIsRunningBacktest(true)

        try {
            // Get historical data from main pane
            const mainPane = panes.find(p => p.id === 'main-pane') || panes[0]
            const mainSeries = mainPane?.series.find(s => s.isMain) || mainPane?.series[0]

            if (!mainSeries || !mainSeries.data || mainSeries.data.length === 0) {
                alert('Нет исторических данных для бэктеста')
                setIsRunningBacktest(false)
                return
            }

            const strategy = {
                settings,
                buyConditions,
                sellConditions
            }

            const results = runBacktest(strategy, mainSeries.data)
            setBacktestResults(results)

            if (results.error) {
                alert(results.error)
            } else {
                // Save signals and equity to store for chart display
                const { setStrategyResults, addSeries, panes: currentPanes } = useLayoutStore.getState()
                setStrategyResults(results.signals, results.equity)

                // Add "Strategy" indicator to main pane for controlling markers
                const mainPane = currentPanes.find(p => p.id === 'main-pane') || currentPanes[0]
                const hasStrategyIndicator = mainPane?.series.some(s => s.id === 'strategy-signals')

                if (!hasStrategyIndicator && results.signals && results.signals.length > 0) {
                    // Add invisible series just for UI control
                    addSeries({
                        id: 'strategy-signals',
                        chartType: 'line',
                        title: 'Strategy',
                        data: [], // Empty data, just for UI
                        color: '#2962ff',
                        lineWidth: 0,
                        priceScaleId: 'right',
                        visible: true
                    }, 'main-pane')
                }

                // Create equity pane if it doesn't exist
                const equityPaneExists = currentPanes.some(p => p.series.some(s => s.id === 'equity-series'))
                if (!equityPaneExists && results.equity && results.equity.length > 0) {
                    addSeries({
                        id: 'equity-series',
                        chartType: 'line',
                        title: 'Портфель',
                        data: results.equity.map(e => ({ time: e.time, value: e.value })),
                        color: '#2962ff',
                        lineWidth: 2,
                        priceScaleId: 'right',
                        isMain: true
                    }, null) // null = create new pane
                }
            }
        } catch (error) {
            console.error('Backtest error:', error)
            alert('Ошибка при выполнении бэктеста: ' + error.message)
        } finally {
            setIsRunningBacktest(false)
        }
    }

    const handleSave = () => {
        const strategy = {
            id: Date.now(),
            name: strategyName,
            settings,
            buyConditions,
            sellConditions,
            style,
            visibility
        }
        addStrategy(strategy)
        onClose()
    }

    if (!isOpen) return null

    return ReactDOM.createPortal(
        <div className="strategy-builder-overlay" onClick={onClose}>
            <div className="strategy-builder" onClick={(e) => e.stopPropagation()}>
                <div className="strategy-builder__header">
                    <input
                        type="text"
                        className="strategy-builder__title"
                        value={strategyName}
                        onChange={(e) => setStrategyName(e.target.value)}
                    />
                    <button className="strategy-builder__close" onClick={onClose}>✕</button>
                </div>

                <div className="strategy-builder__tabs">
                    <button
                        className={`tab ${activeTab === 'settings' ? 'active' : ''}`}
                        onClick={() => setActiveTab('settings')}
                    >
                        Аргументы
                    </button>
                    <button
                        className={`tab ${activeTab === 'conditions' ? 'active' : ''}`}
                        onClick={() => setActiveTab('conditions')}
                    >
                        Свойства
                    </button>
                    <button
                        className={`tab ${activeTab === 'statistics' ? 'active' : ''}`}
                        onClick={() => setActiveTab('statistics')}
                    >
                        Статистика
                    </button>
                    <button
                        className={`tab ${activeTab === 'style' ? 'active' : ''}`}
                        onClick={() => setActiveTab('style')}
                    >
                        Стиль
                    </button>
                    <button
                        className={`tab ${activeTab === 'visibility' ? 'active' : ''}`}
                        onClick={() => setActiveTab('visibility')}
                    >
                        Видимость
                    </button>
                </div>

                <div className="strategy-builder__content">
                    {activeTab === 'settings' && (
                        <div className="settings-tab">
                            <div className="form-group">
                                <label>Исходный капитал</label>
                                <input
                                    type="number"
                                    value={settings.initialCapital}
                                    onChange={(e) => setSettings({ ...settings, initialCapital: e.target.value === '' ? '' : Number(e.target.value) })}
                                />
                            </div>

                            <div className="form-group">
                                <label>Основная валюта</label>
                                <select
                                    value={settings.baseCurrency}
                                    onChange={(e) => setSettings({ ...settings, baseCurrency: e.target.value })}
                                >
                                    <option value="USD">По умолчанию</option>
                                    <option value="BTC">BTC</option>
                                    <option value="ETH">ETH</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label>Объём заявки по умолчанию</label>
                                <div className="input-group">
                                    <input
                                        type="number"
                                        value={settings.orderSize}
                                        onChange={(e) => setSettings({ ...settings, orderSize: e.target.value === '' ? '' : Number(e.target.value) })}
                                    />
                                    <select
                                        value={settings.orderSizeType}
                                        onChange={(e) => setSettings({ ...settings, orderSizeType: e.target.value })}
                                    >
                                        <option value="percent">% капитала</option>
                                        <option value="fixed">Количество</option>
                                    </select>
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Пирамидинг</label>
                                <div className="input-group">
                                    <input
                                        type="number"
                                        value={settings.pyramiding}
                                        onChange={(e) => setSettings({ ...settings, pyramiding: e.target.value === '' ? '' : Number(e.target.value) })}
                                    />
                                    <span className="input-suffix">заявки</span>
                                </div>
                            </div>

                            <h3 className="section-title">МОДЕЛИРОВАНИЕ ЗАТРАТ</h3>

                            <div className="form-group">
                                <label>Комиссия</label>
                                <div className="input-group">
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={settings.commission}
                                        onChange={(e) => setSettings({ ...settings, commission: e.target.value === '' ? '' : Number(e.target.value) })}
                                    />
                                    <select>
                                        <option value="percent">%</option>
                                    </select>
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Проскальзывание</label>
                                <div className="input-group">
                                    <input
                                        type="number"
                                        value={settings.slippage}
                                        onChange={(e) => setSettings({ ...settings, slippage: e.target.value === '' ? '' : Number(e.target.value) })}
                                    />
                                    <span className="input-suffix">тики</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'conditions' && (
                        <div className="conditions-tab">
                            <div className="condition-section">
                                <div className="condition-section__header">
                                    <h3>Условия покупки</h3>
                                    <button className="btn-add" onClick={handleAddBuyCondition}>
                                        + Условие
                                    </button>
                                </div>
                                {buyConditions.map(condition => (
                                    <ConditionBuilder
                                        key={condition.id}
                                        condition={condition}
                                        type="buy"
                                        onChange={(updates) => handleUpdateCondition('buy', condition.id, updates)}
                                        onRemove={() => handleRemoveCondition('buy', condition.id)}
                                    />
                                ))}
                                {buyConditions.length === 0 && (
                                    <p className="empty-state">Нажмите "+ Условие" чтобы добавить условие покупки</p>
                                )}
                            </div>

                            <div className="condition-section">
                                <div className="condition-section__header">
                                    <h3>Условия продажи</h3>
                                    <button className="btn-add" onClick={handleAddSellCondition}>
                                        + Условие
                                    </button>
                                </div>
                                {sellConditions.map(condition => (
                                    <ConditionBuilder
                                        key={condition.id}
                                        condition={condition}
                                        type="sell"
                                        onChange={(updates) => handleUpdateCondition('sell', condition.id, updates)}
                                        onRemove={() => handleRemoveCondition('sell', condition.id)}
                                    />
                                ))}
                                {sellConditions.length === 0 && (
                                    <p className="empty-state">Нажмите "+ Условие" чтобы добавить условие продажи</p>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'statistics' && (
                        <div className="statistics-tab">
                            <div className="stats-header">
                                <button
                                    className="btn-primary"
                                    onClick={handleRunBacktest}
                                    disabled={isRunningBacktest}
                                >
                                    {isRunningBacktest ? 'Выполняется...' : 'Запустить бэктест'}
                                </button>
                            </div>

                            {!backtestResults && (
                                <div className="stats-placeholder">
                                    <p>Нажмите "Запустить бэктест" для расчета статистики стратегии</p>
                                </div>
                            )}

                            {backtestResults && backtestResults.stats && (
                                <div className="stats-results">
                                    <h3>Результаты бэктеста</h3>

                                    <div className="stats-grid">
                                        <div className="stat-card">
                                            <div className="stat-label">Чистая прибыль</div>
                                            <div className={`stat-value ${parseFloat(backtestResults.stats.netProfit) >= 0 ? 'positive' : 'negative'}`}>
                                                ${backtestResults.stats.netProfit}
                                            </div>
                                        </div>

                                        <div className="stat-card">
                                            <div className="stat-label">Доходность</div>
                                            <div className={`stat-value ${parseFloat(backtestResults.stats.netProfitPercent) >= 0 ? 'positive' : 'negative'}`}>
                                                {backtestResults.stats.netProfitPercent}%
                                            </div>
                                        </div>

                                        <div className="stat-card">
                                            <div className="stat-label">Всего сделок</div>
                                            <div className="stat-value">{backtestResults.stats.totalTrades}</div>
                                        </div>

                                        <div className="stat-card">
                                            <div className="stat-label">Процент прибыльных</div>
                                            <div className="stat-value">{backtestResults.stats.winRate}%</div>
                                        </div>

                                        <div className="stat-card">
                                            <div className="stat-label">Прибыльных сделок</div>
                                            <div className="stat-value positive">{backtestResults.stats.winningTrades}</div>
                                        </div>

                                        <div className="stat-card">
                                            <div className="stat-label">Убыточных сделок</div>
                                            <div className="stat-value negative">{backtestResults.stats.losingTrades}</div>
                                        </div>

                                        <div className="stat-card">
                                            <div className="stat-label">Средняя прибыль</div>
                                            <div className="stat-value positive">${backtestResults.stats.averageWin}</div>
                                        </div>

                                        <div className="stat-card">
                                            <div className="stat-label">Средний убыток</div>
                                            <div className="stat-value negative">${backtestResults.stats.averageLoss}</div>
                                        </div>

                                        <div className="stat-card">
                                            <div className="stat-label">Profit Factor</div>
                                            <div className="stat-value">{backtestResults.stats.profitFactor}</div>
                                        </div>

                                        <div className="stat-card">
                                            <div className="stat-label">Макс. просадка</div>
                                            <div className="stat-value negative">${backtestResults.stats.maxDrawdown}</div>
                                        </div>

                                        <div className="stat-card">
                                            <div className="stat-label">Макс. просадка %</div>
                                            <div className="stat-value negative">{backtestResults.stats.maxDrawdownPercent}%</div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'style' && (
                        <div className="style-tab">
                            <div className="form-group">
                                <label>Цвет сигнала покупки</label>
                                <input
                                    type="color"
                                    value={style.buySignalColor}
                                    onChange={(e) => setStyle({ ...style, buySignalColor: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label>Цвет сигнала продажи</label>
                                <input
                                    type="color"
                                    value={style.sellSignalColor}
                                    onChange={(e) => setStyle({ ...style, sellSignalColor: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label>
                                    <input
                                        type="checkbox"
                                        checked={style.showLabels}
                                        onChange={(e) => setStyle({ ...style, showLabels: e.target.checked })}
                                    />
                                    Показывать метки
                                </label>
                            </div>
                            <div className="form-group">
                                <label>
                                    <input
                                        type="checkbox"
                                        checked={style.showArrows}
                                        onChange={(e) => setStyle({ ...style, showArrows: e.target.checked })}
                                    />
                                    Показывать стрелки
                                </label>
                            </div>
                        </div>
                    )}

                    {activeTab === 'visibility' && (
                        <div className="visibility-tab">
                            <div className="form-group">
                                <label>
                                    <input
                                        type="checkbox"
                                        checked={visibility.showOnChart}
                                        onChange={(e) => setVisibility({ ...visibility, showOnChart: e.target.checked })}
                                    />
                                    Показывать на графике
                                </label>
                            </div>
                            <div className="form-group">
                                <label>
                                    <input
                                        type="checkbox"
                                        checked={visibility.showInDataWindow}
                                        onChange={(e) => setVisibility({ ...visibility, showInDataWindow: e.target.checked })}
                                    />
                                    Показывать в окне данных
                                </label>
                            </div>
                        </div>
                    )}
                </div>

                <div className="strategy-builder__footer">
                    <button className="btn-secondary" onClick={onClose}>Отмена</button>
                    <button className="btn-primary" onClick={handleSave}>Ок</button>
                </div>
            </div>
        </div>,
        document.body
    )
}

export default StrategyBuilder

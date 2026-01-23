import React from 'react'

const PAIRS = ['BTC/USDT', 'BTC/ETH', 'ETH/USDT', 'BNB/USDT', 'SOL/USDT']
const INDICATORS = [
    { id: 'SMA', name: 'SMA', hasParams: true },
    { id: 'EMA', name: 'EMA', hasParams: true },
    { id: 'RSI', name: 'RSI', hasParams: true },
    { id: 'MACD', name: 'MACD', hasParams: false },
    { id: 'BB', name: 'Bollinger Bands', hasParams: true }
]
const OPERATORS = [
    { value: '>', label: '>' },
    { value: '<', label: '<' },
    { value: '>=', label: '>=' },
    { value: '<=', label: '<=' },
    { value: '=', label: '=' }
]
const DCA_PERIODS = ['1d', '3d', '5d', '7d', '14d', '30d']

function ConditionBuilder({ condition, type, onChange, onRemove }) {
    const isBuy = type === 'buy'

    return (
        <div className="condition-builder">
            <div className="condition-row">
                {/* Pair Selection */}
                <div className="condition-field">
                    <label>Пара</label>
                    <select
                        value={condition.pair}
                        onChange={(e) => onChange({ pair: e.target.value })}
                    >
                        {PAIRS.map(pair => (
                            <option key={pair} value={pair}>{pair}</option>
                        ))}
                    </select>
                </div>

                {/* Operator */}
                <div className="condition-field">
                    <label>Условие</label>
                    <select
                        value={condition.operator}
                        onChange={(e) => onChange({ operator: e.target.value })}
                    >
                        {OPERATORS.map(op => (
                            <option key={op.value} value={op.value}>{op.label}</option>
                        ))}
                    </select>
                </div>

                {/* Compare Type */}
                <div className="condition-field">
                    <label>Сравнить с</label>
                    <select
                        value={condition.compareType}
                        onChange={(e) => onChange({ compareType: e.target.value })}
                    >
                        <option value="indicator">Индикатор</option>
                        <option value="pair">Пара</option>
                        <option value="value">Значение</option>
                    </select>
                </div>

                {/* Compare Value/Indicator/Pair */}
                {condition.compareType === 'indicator' && (
                    <>
                        <div className="condition-field">
                            <label>Индикатор</label>
                            <select
                                value={condition.compareIndicator}
                                onChange={(e) => onChange({ compareIndicator: e.target.value })}
                            >
                                {INDICATORS.map(ind => (
                                    <option key={ind.id} value={ind.id}>{ind.name}</option>
                                ))}
                            </select>
                        </div>
                        {INDICATORS.find(i => i.id === condition.compareIndicator)?.hasParams && (
                            <div className="condition-field">
                                <label>Период</label>
                                <input
                                    type="number"
                                    value={condition.compareParams?.period || 20}
                                    onChange={(e) => onChange({
                                        compareParams: { ...condition.compareParams, period: e.target.value === '' ? '' : Number(e.target.value) }
                                    })}
                                />
                            </div>
                        )}
                    </>
                )}

                {condition.compareType === 'pair' && (
                    <div className="condition-field">
                        <label>Пара</label>
                        <select
                            value={condition.comparePair}
                            onChange={(e) => onChange({ comparePair: e.target.value })}
                        >
                            {PAIRS.map(pair => (
                                <option key={pair} value={pair}>{pair}</option>
                            ))}
                        </select>
                    </div>
                )}

                {condition.compareType === 'value' && (
                    <div className="condition-field">
                        <label>Значение</label>
                        <input
                            type="number"
                            value={condition.compareValue}
                            onChange={(e) => onChange({ compareValue: e.target.value === '' ? '' : Number(e.target.value) })}
                        />
                    </div>
                )}

                {/* Remove Button */}
                <button className="btn-remove" onClick={onRemove} title="Удалить условие">
                    ✕
                </button>
            </div>

            {/* Position Sizing (for both buy and sell conditions) */}
            <div className="condition-row condition-row--secondary">
                <div className="condition-field">
                    <label>Размер позиции</label>
                    <div className="input-group">
                        <input
                            type="number"
                            step="0.01"
                            value={condition.positionSize}
                            onChange={(e) => onChange({ positionSize: e.target.value === '' ? '' : Number(e.target.value) })}
                        />
                        <select
                            value={condition.positionSizeType}
                            onChange={(e) => onChange({ positionSizeType: e.target.value })}
                        >
                            <option value="percent">% капитала</option>
                            <option value="fixed">Фиксированная сумма</option>
                        </select>
                    </div>
                </div>

                <div className="condition-field">
                    <label>
                        <input
                            type="checkbox"
                            checked={condition.enableDCA}
                            onChange={(e) => onChange({ enableDCA: e.target.checked })}
                        />
                        Включить DCA
                    </label>
                </div>

                {condition.enableDCA && (
                    <div className="condition-field">
                        <label>Период DCA</label>
                        <select
                            value={condition.dcaPeriod}
                            onChange={(e) => onChange({ dcaPeriod: e.target.value })}
                        >
                            {DCA_PERIODS.map(period => (
                                <option key={period} value={period}>{period}</option>
                            ))}
                        </select>
                    </div>
                )}
            </div>
        </div>
    )
}

export default ConditionBuilder

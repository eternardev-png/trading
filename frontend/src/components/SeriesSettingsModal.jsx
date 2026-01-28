import React, { useState, useEffect } from 'react'
import { useLayoutStore } from '../stores/useLayoutStore'
import CustomSelect from './CustomSelect'
import './ChartSettingsModal.scss' // Reuse styles

const SeriesSettingsModal = ({ seriesId, onClose }) => {
    const [activeTab, setActiveTab] = useState('inputs')
    const updateSeriesSettings = useLayoutStore(state => state.updateSeriesSettings)

    // Get live series state
    const series = useLayoutStore(state => {
        for (const pane of state.panes) {
            const s = pane.series.find(ser => ser.id === seriesId)
            if (s) return s
        }
        return null
    })

    // Local state for params to allow free typing (empty strings, etc.)
    const [localParams, setLocalParams] = useState(series?.params || {})

    // Sync from store when series params change externally (or on mount/remount)
    // We only update if the series ID matches and params exist
    useEffect(() => {
        if (series?.params) {
            setLocalParams(series.params)
        }
    }, [series?.params])

    if (!series) return null

    // Handlers
    const handleParamChange = (key, value) => {
        // 1. Update Local State immediately (for UI responsiveness)
        setLocalParams(prev => ({ ...prev, [key]: value }))

        // 2. Commit to Store if valid
        // Check if original type was number (from series.params source of truth)
        const isNum = typeof series.params[key] === 'number'

        if (isNum) {
            // For numbers: Only commit if valid number and not empty
            if (value === '' || value === '-' || isNaN(Number(value))) {
                // Do not commit invalid states to store
                return
            }
            const numVal = Number(value)

            // Commit
            const newParams = { ...series.params, [key]: numVal }
            updateSeriesSettings(seriesId, {
                params: newParams,
                data: [] // Force re-fetch
            })
        } else {
            // For strings/others: Commit immediately
            const newParams = { ...series.params, [key]: value }
            updateSeriesSettings(seriesId, {
                params: newParams,
                data: [] // Force re-fetch
            })
        }
    }

    const handleStyleChange = (key, value) => {
        updateSeriesSettings(seriesId, { [key]: value })
    }

    const handlePlotVisibility = (plotKey, visible) => {
        const newPlots = {
            ...series.plots,
            [plotKey]: { ...series.plots[plotKey], visible }
        }
        updateSeriesSettings(seriesId, { plots: newPlots })
    }

    const handlePlotColor = (plotKey, color) => {
        const newPlots = {
            ...series.plots,
            [plotKey]: { ...series.plots[plotKey], color }
        }
        updateSeriesSettings(seriesId, { plots: newPlots })
    }

    // Tabs configuration
    const tabs = [
        { id: 'inputs', label: 'Аргументы', icon: '⚙' },
        { id: 'style', label: 'Стиль', icon: '🎨' },
        { id: 'visible', label: 'Видимость', icon: '👁' }
    ]

    return (
        <div className="chart-settings-modal-overlay" onClick={onClose}>
            <div className="chart-settings-modal" onClick={e => e.stopPropagation()}>
                <button className="close-btn" onClick={onClose}>{'\u2715'}</button>
                <div className="modal-header">
                    <h3>{series.title || series.name || 'Settings'}</h3>
                </div>

                <div className="modal-body">
                    <div className="sidebar">
                        <div className="sidebar-list">
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
                    </div>

                    <div className="content">
                        {activeTab === 'inputs' && (
                            <div className="tab-content">
                                <h4>ВХОДНЫЕ ДАННЫЕ</h4>
                                {series.params && Object.keys(series.params).length > 0 ? (
                                    Object.keys(series.params).map((key) => {
                                        const originalType = typeof series.params[key]
                                        const val = localParams[key] !== undefined ? localParams[key] : series.params[key] // Fallback

                                        return (
                                            <div className="form-row" key={key}>
                                                <span>{key} ({originalType})</span>
                                                <input
                                                    // Allow text input even for numbers to support empty string
                                                    // But we can hint number if valid
                                                    type={originalType === 'number' ? 'number' : 'text'}
                                                    value={val}
                                                    onChange={e => handleParamChange(key, e.target.value)}
                                                />
                                            </div>
                                        )
                                    })
                                ) : (
                                    <p>Нет параметров для настройки.</p>
                                )}
                                <div className="section">
                                    <p className="note">* Изменение параметров перезагрузит данные.</p>
                                </div>
                            </div>
                        )}

                        {activeTab === 'style' && (
                            <div className="tab-content">
                                <h4>СТИЛЬ ЛИНИЙ</h4>
                                {/* Main Series Style (if not Protocol 2.0 Plots) */}
                                {!series.plots && (
                                    <div className="form-row">
                                        <span>Цвет линии</span>
                                        <input type="color" value={series.color || '#2962ff'} onChange={e => handleStyleChange('color', e.target.value)} />
                                    </div>
                                )}

                                {/* Protocol 2.0 Plots */}
                                {series.plots && Object.entries(series.plots).map(([key, plot]) => (
                                    <div className="form-row" key={key}>
                                        <label>
                                            <input
                                                type="checkbox"
                                                checked={plot.visible !== false}
                                                onChange={e => handlePlotVisibility(key, e.target.checked)}
                                            />
                                            {plot.title || key}
                                        </label>
                                        <input
                                            type="color"
                                            value={plot.color || '#000000'}
                                            onChange={e => handlePlotColor(key, e.target.value)}
                                        />
                                    </div>
                                ))}
                            </div>
                        )}

                        {activeTab === 'visible' && (
                            <div className="tab-content">
                                <h4>ОБЩИЕ</h4>
                                <div className="form-row">
                                    <span>Прозрачность (Opacity)</span>
                                    <p>Not implemented</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="modal-footer">
                    <button className="btn-save" onClick={onClose}>OK</button>
                </div>
            </div>
        </div>
    )
}

export default SeriesSettingsModal

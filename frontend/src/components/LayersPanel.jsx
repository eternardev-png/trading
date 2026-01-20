import { useState } from 'react'
import { useLayoutStore } from '../stores/useLayoutStore'
import './LayersPanel.scss'

const CHART_TYPES = [
    { id: 'candle', icon: '📊' },
    { id: 'line', icon: '📈' },
    { id: 'area', icon: '📉' }
]

const PRESET_COLORS = [
    '#2962ff', '#26a69a', '#ef5350', '#ab47bc',
    '#ff9800', '#00bcd4', '#e91e63', '#4caf50'
]

function LayersPanel({ chart, onClose }) {
    const { toggleLayerVisibility, removeLayer, updateLayerSettings, addLayer } = useLayoutStore()
    const [newTicker, setNewTicker] = useState('')

    const handleAddLayer = () => {
        if (newTicker.trim()) {
            addLayer(chart.id, newTicker.trim().toUpperCase())
            setNewTicker('')
        }
    }

    return (
        <div className="layers-panel">
            <div className="layers-panel__header">
                <span>Layers</span>
                <button onClick={onClose}>✕</button>
            </div>

            <div className="layers-panel__list">
                {chart.layers.map((layer, idx) => (
                    <div key={layer.id} className="layer-item">
                        <div className="layer-item__main">
                            {/* Visibility Toggle */}
                            <button
                                className={`layer-item__visibility ${layer.visible ? 'visible' : ''}`}
                                onClick={() => toggleLayerVisibility(chart.id, layer.id)}
                            >
                                {layer.visible ? '👁' : '👁‍🗨'}
                            </button>

                            {/* Ticker Name */}
                            <span className="layer-item__name">{layer.ticker}</span>

                            {/* Chart Type */}
                            <div className="layer-item__type-group">
                                {CHART_TYPES.map(type => (
                                    <button
                                        key={type.id}
                                        className={layer.chartType === type.id ? 'active' : ''}
                                        onClick={() => updateLayerSettings(chart.id, layer.id, { chartType: type.id })}
                                        title={type.id}
                                    >
                                        {type.icon}
                                    </button>
                                ))}
                            </div>

                            {/* Delete (only if not the last layer) */}
                            {chart.layers.length > 1 && (
                                <button
                                    className="layer-item__delete"
                                    onClick={() => removeLayer(chart.id, layer.id)}
                                >
                                    🗑
                                </button>
                            )}
                        </div>

                        {/* Settings Row */}
                        <div className="layer-item__settings">
                            {/* Color Picker */}
                            <div className="layer-item__colors">
                                {PRESET_COLORS.map(color => (
                                    <button
                                        key={color}
                                        className={`layer-item__color ${layer.color === color ? 'active' : ''}`}
                                        style={{ backgroundColor: color }}
                                        onClick={() => updateLayerSettings(chart.id, layer.id, { color })}
                                    />
                                ))}
                            </div>

                            {/* Price Scale */}
                            <div className="layer-item__scale">
                                <button
                                    className={layer.priceScale === 'left' ? 'active' : ''}
                                    onClick={() => updateLayerSettings(chart.id, layer.id, { priceScale: 'left' })}
                                >
                                    L
                                </button>
                                <button
                                    className={layer.priceScale === 'right' ? 'active' : ''}
                                    onClick={() => updateLayerSettings(chart.id, layer.id, { priceScale: 'right' })}
                                >
                                    R
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Add Layer */}
            <div className="layers-panel__add">
                <input
                    type="text"
                    placeholder="Add ticker..."
                    value={newTicker}
                    onChange={e => setNewTicker(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddLayer()}
                />
                <button onClick={handleAddLayer}>+</button>
            </div>
        </div>
    )
}

export default LayersPanel

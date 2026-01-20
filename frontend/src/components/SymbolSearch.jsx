import React, { useState, useEffect, useRef } from 'react'
import './SymbolSearch.scss'

const MOCK_SYMBOLS = [
    { symbol: 'BTC/USDT', description: 'Bitcoin / Tether US', exchange: 'BINANCE', type: 'crypto' },
    { symbol: 'ETH/USDT', description: 'Ethereum / Tether US', exchange: 'BINANCE', type: 'crypto' },
    { symbol: 'SOL/USDT', description: 'Solana / Tether US', exchange: 'BINANCE', type: 'crypto' },
    { symbol: 'BNB/USDT', description: 'Binance Coin / Tether', exchange: 'BINANCE', type: 'crypto' },
    { symbol: 'XRP/USDT', description: 'Ripple / Tether', exchange: 'BINANCE', type: 'crypto' },
    { symbol: 'DOGE/USDT', description: 'Dogecoin / Tether', exchange: 'BINANCE', type: 'crypto' },
    { symbol: 'ADA/USDT', description: 'Cardano / Tether', exchange: 'BINANCE', type: 'crypto' },
    { symbol: 'AAPL', description: 'Apple Inc.', exchange: 'NASDAQ', type: 'stock' },
    { symbol: 'TSLA', description: 'Tesla, Inc.', exchange: 'NASDAQ', type: 'stock' },
    { symbol: 'EURUSD', description: 'Euro / U.S. Dollar', exchange: 'FOREX', type: 'forex' },
    { symbol: 'XAUUSD', description: 'Gold / U.S. Dollar', exchange: 'OANDA', type: 'cfd' },
]

const TABS = ['Все', 'Акции', 'Фонды', 'Фьючерсы', 'Форекс', 'Криптовалюты', 'Индексы']

const SymbolSearch = ({ isOpen, onClose, onSelect, mode = 'set-main' }) => {
    const [searchTerm, setSearchTerm] = useState('')
    const [activeTab, setActiveTab] = useState('Все')
    const inputRef = useRef(null)

    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus()
            setSearchTerm('')
        }
    }, [isOpen])

    if (!isOpen) return null

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && searchTerm.trim()) {
            // Allow selecting exactly what was typed
            onSelect(searchTerm.toUpperCase())
            onClose()
        }
    }

    const filteredSymbols = MOCK_SYMBOLS.filter(item => {
        const matchSearch = item.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.description.toLowerCase().includes(searchTerm.toLowerCase())

        if (activeTab === 'Все') return matchSearch
        if (activeTab === 'Криптовалюты' && item.type === 'crypto') return matchSearch
        if (activeTab === 'Акции' && item.type === 'stock') return matchSearch
        if (activeTab === 'Форекс' && item.type === 'forex') return matchSearch

        return matchSearch && false
    })

    return (
        <div className="symbol-search-overlay" onClick={onClose}>
            <div className="symbol-search-modal" onClick={e => e.stopPropagation()}>
                <div className="symbol-search__header">
                    <div className="symbol-search__title">{mode === 'compare' ? 'Сравнение инструментов' : 'Поиск инструментов'}</div>
                    <button className="symbol-search__close" onClick={onClose}>✕</button>
                </div>

                <div className="symbol-search__input-wrapper">
                    <span className="search-icon">🔍</span>
                    <input
                        ref={inputRef}
                        type="text"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Поиск (например: DOGE/USDT, AAPL)"
                        className="symbol-search__input"
                    />
                </div>

                <div className="symbol-search__tabs">
                    {TABS.map(tab => (
                        <button
                            key={tab}
                            className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
                            onClick={() => setActiveTab(tab)}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                <div className="symbol-search__list">
                    {/* Explicit "Use Custom" option if search is not empty */}
                    {searchTerm && (
                        <div className="symbol-item special-item" onClick={() => { onSelect(searchTerm.toUpperCase()); onClose(); }}>
                            <div className="symbol-item__left">
                                <div className="symbol-icon">↵</div>
                                <div className="symbol-info">
                                    <div className="symbol-name">{searchTerm.toUpperCase()}</div>
                                    <div className="symbol-desc">Найти символ...</div>
                                </div>
                            </div>
                        </div>
                    )}

                    {filteredSymbols.map((item, idx) => (
                        <div key={idx} className="symbol-item" onClick={() => { onSelect(item.symbol); onClose(); }}>
                            <div className="symbol-item__left">
                                <div className="symbol-icon">{item.symbol[0]}</div>
                                <div className="symbol-info">
                                    <div className="symbol-name">{item.symbol}</div>
                                    <div className="symbol-desc">{item.description}</div>
                                </div>
                            </div>
                            <div className="symbol-item__right">
                                <span className="symbol-type">{item.type}</span>
                                <span className="symbol-exchange">{item.exchange}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

export default SymbolSearch

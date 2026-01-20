import './RightSidebar.scss'

function RightSidebar() {
    return (
        <div className="right-sidebar">
            <div className="right-sidebar__header">
                <span className="title">Список котировок</span>
                <div className="actions">
                    <button className="add-btn">＋</button>
                    <button className="more-btn">⋯</button>
                </div>
            </div>

            <div className="right-sidebar__list">
                <div className="list-group">
                    <div className="group-header">crypto</div>
                    {['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT', 'XRP/USDT'].map(ticker => (
                        <div key={ticker} className="list-item">
                            <span className="ticker">{ticker.split('/')[0]}</span>
                            <span className="price">{(Math.random() * 50000).toFixed(2)}</span>
                            <span className={`change ${Math.random() > 0.5 ? 'up' : 'down'}`}>
                                {Math.random() > 0.5 ? '+' : '-'}{(Math.random() * 5).toFixed(2)}%
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="right-sidebar__tabs">
                <button className="tab active">Котировки</button>
                <button className="tab">Оповещения</button>
            </div>
        </div>
    )
}

export default RightSidebar

import { memo, useCallback, useRef, useState, useEffect } from 'react';

const PRICE_FLASH_DURATION_MS = 600;

const starSvgFilled = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.5">
    <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="currentColor" stroke="none" />
  </svg>
);
const starSvgOutline = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
  </svg>
);
const watchlistSvgFilled = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.5">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="3" fill="var(--bg-primary)" stroke="none" />
  </svg>
);
const watchlistSvgOutline = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const ForexTableRow = memo(({ market, onMarketClick, formatPrice, isFavorite, isWatchlist, onToggleFavorite, onToggleWatchlist, priceFlash }) => {
  const name = market.id || market.symbol;
  const type = market.marketType || 'forex';

  const handleRowClick = useCallback((e) => {
    if (e.target.closest('.favoriteBtn') || e.target.closest('.watchlistBtn') || e.target.closest('.tradeBtn') || e.target.closest('.removeListBtn')) return;
    e.preventDefault();
    e.stopPropagation();
    onMarketClick(name, type);
  }, [name, type, onMarketClick]);

  const handleFavoriteClick = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    onToggleFavorite?.(name, type);
  }, [name, type, onToggleFavorite]);

  const handleWatchlistClick = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    onToggleWatchlist?.(name, type);
  }, [name, type, onToggleWatchlist]);

  const handleTradeClick = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    onMarketClick(name, type);
  }, [name, type, onMarketClick]);

  const handleRemoveClick = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    onToggleFavorite?.(name, type);
  }, [name, type, onToggleFavorite]);

  const formatChange = (change) => {
    if (change === null || change === undefined) return '0.00';
    const formatted = change >= 0 ? `+${change.toFixed(2)}` : change.toFixed(2);
    return `${formatted}`;
  };
  
  return (
    <tr className="forexTableRow" onClick={handleRowClick}>
      <td className="forexTableCell marketCell">
        <div className="marketInfo">
          {/* <button className={`favoriteBtn ${isFavorite ? 'active' : ''}`} onClick={handleFavoriteClick} title={isFavorite ? 'Remove from favorites' : 'Add to favorites'} aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}>
            {isFavorite ? starSvgFilled : starSvgOutline}
          </button> */}
          {/* <button className={`watchlistBtn ${isWatchlist ? 'active' : ''}`} onClick={handleWatchlistClick} title={isWatchlist ? 'Remove from watchlist' : 'Add to watchlist'} aria-label={isWatchlist ? 'Remove from watchlist' : 'Add to watchlist'}>
            {isWatchlist ? watchlistSvgFilled : watchlistSvgOutline}
          </button> */}
          <div className="marketSymbol">
            <span className="symbolBase">
              {market.base}
              <span className="symbolQuote">/{market.quote}</span>
            </span>
          </div>
        </div>
      </td>
      <td className="forexTableCell priceCell">
        <div className={`priceWrapper priceWithMove ${priceFlash ? `valueFlash${priceFlash === 'up' ? 'Up' : 'Down'}` : ''}`}>
          <span className={`priceMoveIcon ${priceFlash || ''}`} aria-hidden="true">
            {priceFlash === 'up' ? '▲' : priceFlash === 'down' ? '▼' : ''}
          </span>
          <span className={`priceValue ${priceFlash ? `priceValue${priceFlash === 'up' ? 'Up' : 'Down'}` : ''}`}>{formatPrice(market.price || market.index)}</span>
        </div>
      </td>
      <td className="forexTableCell changeCell">
        <span
          className={`changeValue ${market.change24h >= 0 ? 'positive' : 'negative'}`}
          title={`24h price change: ${formatPrice(market.change24h)}`}
        >
          {formatPrice(market.change24h)}
        </span>
      </td>
      <td className="forexTableCell bidCell">
        <div className="priceWrapper">
          <span className="priceValue bidValue">{formatPrice(market.bid)}</span>
        </div>
      </td>
      <td className="forexTableCell askCell">
        <div className="priceWrapper">
          <span className="priceValue askValue">{formatPrice(market.ask)}</span>
        </div>
      </td>
      <td className="forexTableCell spreadCell">
        <span className="spreadValue">{formatPrice((market.ask || 0) - (market.bid || 0))}</span>
      </td>
      <td className="forexTableCell highCell">
        <span className="highValue">{formatPrice(market.high24h)}</span>
      </td>
      <td className="forexTableCell lowCell">
        <span className="lowValue">{formatPrice(market.low24h)}</span>
      </td>
      <td className="forexTableCell tradeCell">
        <div className="tableActionButtons">
          <button
            className="tradeBtn market_btn"
            onClick={handleTradeClick}
            title="Trade this market"
            aria-label="Trade this market"
          >
            <span>Trade</span>
          </button>
          <button
            className="removeListBtn market_btn"
            onClick={handleRemoveClick}
            title="Remove from list"
            aria-label="Remove from list"
          >
            X
          </button>
        </div>
      </td>
    </tr>
  );
});

ForexTableRow.displayName = 'ForexTableRow';

const ForexMobileCard = memo(({ market, onMarketClick, formatPrice, isFavorite, isWatchlist, onToggleFavorite, onToggleWatchlist, priceFlash }) => {
  const name = market.id || market.symbol;
  const type = market.marketType || 'forex';

  const handleCardClick = useCallback((e) => {
    if (e.target.closest('.favoriteBtn') || e.target.closest('.watchlistBtn') || e.target.closest('.tradeBtn') || e.target.closest('.removeListBtn')) return;
    e.preventDefault();
    e.stopPropagation();
    onMarketClick(name, type);
  }, [name, type, onMarketClick]);

  const handleFavoriteClick = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    onToggleFavorite?.(name, type);
  }, [name, type, onToggleFavorite]);

  const handleWatchlistClick = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    onToggleWatchlist?.(name, type);
  }, [name, type, onToggleWatchlist]);

  const handleRemoveClick = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    onToggleFavorite?.(name, type);
  }, [name, type, onToggleFavorite]);

  return (
    <div className="forexMobileCard" onClick={handleCardClick}>
      <div className="forexCardHeader">
        <div className="forexCardPair">
          {/* <button className={`favoriteBtn ${isFavorite ? 'active' : ''}`} onClick={handleFavoriteClick} title={isFavorite ? 'Remove from favorites' : 'Add to favorites'} aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}>
            {isFavorite ? starSvgFilled : starSvgOutline}
          </button>
          <button className={`watchlistBtn ${isWatchlist ? 'active' : ''}`} onClick={handleWatchlistClick} title={isWatchlist ? 'Remove from watchlist' : 'Add to watchlist'} aria-label={isWatchlist ? 'Remove from watchlist' : 'Add to watchlist'}>
            {isWatchlist ? watchlistSvgFilled : watchlistSvgOutline}
          </button> */}
          <span className="symbolBase">
            {market.base}
            <span className="symbolQuote">/{market.quote}</span>
          </span>
        </div>
        <button
          className="removeListBtn mobileRemoveListBtn"
          onClick={handleRemoveClick}
          title="Remove from list"
          aria-label="Remove from list"
        >
          Remove
        </button>
      </div>
      <div className="forexCardBody">
        <div className="forexCardRow">
          <div className="forexCardLabel">Price</div>
          <div className={`forexCardValue ${priceFlash ? `valueFlash${priceFlash === 'up' ? 'Up' : 'Down'}` : ''}`}>{formatPrice(market.price || market.index)}</div>
        </div>
        <div className="forexCardRow">
          <div className="forexCardLabel">Spread</div>
          <div className="forexCardValue">{formatPrice((market.ask || 0) - (market.bid || 0))}</div>
        </div>
        <div className="forexCardRow">
          <div className="forexCardLabel">24h Change</div>
          <div className={`forexCardValue ${market.change24h >= 0 ? 'positive' : 'negative'}`}>
            {market.change24h >= 0 ? '+' : ''}{market.change24h.toFixed(2)}%
          </div>
        </div>
        <div className="forexCardRow">
          <div className="forexCardLabel">Ask</div>
          <div className="forexCardValue askValue">{formatPrice(market.ask)}</div>
        </div>
        <div className="forexCardRow">
          <div className="forexCardLabel">Bid</div>
          <div className="forexCardValue bidValue">{formatPrice(market.bid)}</div>
        </div>
      </div>
    </div>
  );
});

ForexMobileCard.displayName = 'ForexMobileCard';

const ForexTable = ({ markets, onMarketClick, formatPrice, favoritesSet, watchlistSet, itemKey, onToggleFavorite, onToggleWatchlist }) => {
  const keyOf = (m) => itemKey(m.id || m.symbol, m.marketType || 'forex');
  const lastPriceByKeyRef = useRef(new Map());
  const [priceFlashMap, setPriceFlashMap] = useState(() => new Map());

  const flashTimeoutRef = useRef(null);

  useEffect(() => {
    if (!markets || markets.length === 0) return;
    const next = new Map();
    const prev = lastPriceByKeyRef.current;
    markets.forEach((m) => {
      const key = m.id || m.symbol;
      const price = Number(m.price ?? m.index ?? 0) || 0;
      if (!price) return;
      const last = prev.get(key);
      if (last != null && last !== price) {
        next.set(key, price > last ? 'up' : 'down');
      }
      lastPriceByKeyRef.current.set(key, price);
    });
    if (next.size > 0) {
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
      setPriceFlashMap(new Map(next));
      flashTimeoutRef.current = setTimeout(() => {
        setPriceFlashMap(new Map());
        flashTimeoutRef.current = null;
      }, PRICE_FLASH_DURATION_MS);
    }
    return () => {
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
    };
  }, [markets]);

  const getPriceFlash = useCallback((market) => {
    const key = market?.id || market?.symbol;
    return key ? priceFlashMap.get(key) : null;
  }, [priceFlashMap]);

  return (
    <>
      <div className="forexTableWrapper">
        <table className="forexTable">
          <thead className="forexTableHead">
            <tr>
              <th className="forexTableHeader marketCell">Pair</th>
              <th className="forexTableHeader priceCell">Last Price</th>
              <th className="forexTableHeader changeCell">24h Change</th>
              <th className="forexTableHeader askCell">Bid</th>
              <th className="forexTableHeader bidCell">Ask</th>
              <th className="forexTableHeader spreadCell">Spread</th>
              <th className="forexTableHeader highCell">24h High</th>
              <th className="forexTableHeader lowCell">24h Low</th>
              <th className="forexTableHeader tradeCell">Actions</th>
            </tr>
          </thead>
          <tbody className="forexTableBody">
            {markets.length > 0 ? (
              markets.map((market) => (
                <ForexTableRow
                  key={market.id || market.symbol}
                  market={market}
                  onMarketClick={onMarketClick}
                  formatPrice={formatPrice}
                  isFavorite={favoritesSet?.has(keyOf(market))}
                  isWatchlist={watchlistSet?.has(keyOf(market))}
                  onToggleFavorite={onToggleFavorite}
                  onToggleWatchlist={onToggleWatchlist}
                  priceFlash={getPriceFlash(market)}
                />
              ))
            ) : (
              <tr>
                <td colSpan="9" className="forexTableEmpty">
                  <div className="noMarkets">
                    <p>No forex markets available</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="forexMobileView">
        {markets.length > 0 ? (
          markets.map((market) => {
            return (
              <ForexMobileCard
                key={market.id || market.symbol}
                market={market}
                onMarketClick={onMarketClick}
                formatPrice={formatPrice}
                isFavorite={favoritesSet?.has(keyOf(market))}
                isWatchlist={watchlistSet?.has(keyOf(market))}
                onToggleFavorite={onToggleFavorite}
                onToggleWatchlist={onToggleWatchlist}
                priceFlash={getPriceFlash(market)}
              />
            )
          })
        ) : (
          <div className="noMarkets">
            <p>No forex markets available</p>
          </div>
        )}
      </div>
    </>
  );
};

export default ForexTable;


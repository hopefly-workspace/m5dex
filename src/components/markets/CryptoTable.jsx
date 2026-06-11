import { memo, useCallback, useEffect, useRef, useState } from 'react';

const PRICE_FLASH_DURATION_MS = 600;

// Helper function to format volume with K, M, B suffixes
const formatVolume = (volume) => {
  if (!volume && volume !== 0) return '0';
  if (volume >= 1000000000) {
    return `${(volume / 1000000000).toFixed(2)}B`;
  }
  if (volume >= 1000000) {
    return `${(volume / 1000000).toFixed(2)}M`;
  }
  if (volume >= 1000) {
    return `${(volume / 1000).toFixed(2)}K`;
  }
  return volume.toFixed(2);
};

// Helper function to format percentage change
const formatChange = (change) => {
  if (change === null || change === undefined) return '0.00';
  const formatted = change >= 0 ? `+${change.toFixed(2)}` : change.toFixed(2);
  return `${formatted}`;
};

// Helper function to calculate price change from high/low
const calculatePriceRange = (price, high24h, low24h) => {
  if (!high24h || !low24h || high24h === low24h) return 0;
  return ((price - low24h) / (high24h - low24h)) * 100;
};

const CryptoTableRow = memo(({ market, onMarketClick, formatPrice, isFavorite, isWatchlist, onToggleFavorite, onToggleWatchlist, priceFlash, movementTrail }) => {
  const name = market.id || market.symbol;
  const type = market.marketType || 'crypto';

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

  const change24h = market.change24h || 0;
  const priceRange = calculatePriceRange(market.price || market.index || 0, market.high24h || 0, market.low24h || 0);
  const [loading, setLoading] = useState(false);

  return (
    <tr className={`cryptoTableRow ${priceFlash ? `priceMove${priceFlash === 'up' ? 'Up' : 'Down'}` : ''}`} onClick={handleRowClick}>
      <td className="cryptoTableCell marketCell">
        <div className="marketInfo">
          {/* <button
            className={`favoriteBtn ${isFavorite ? 'active' : ''}`}
            onClick={handleFavoriteClick}
            title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            {isFavorite ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="currentColor" stroke="none" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
              </svg>
            )}
          </button> */}
          {/* <button
            className={`watchlistBtn ${isWatchlist ? 'active' : ''}`}
            onClick={handleWatchlistClick}
            title={isWatchlist ? 'Remove from watchlist' : 'Add to watchlist'}
            aria-label={isWatchlist ? 'Remove from watchlist' : 'Add to watchlist'}
          >
            {isWatchlist ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.5">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" fill="currentColor" stroke="none" />
                <circle cx="12" cy="12" r="3" fill="var(--bg-primary)" stroke="none" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button> */}
          <div className="marketSymbol">
            <span className="symbolBase">
              {market.base}
              <span className="symbolQuote">/{market.quote}</span>
            </span>
          </div>
        </div>
      </td>
      <td className="cryptoTableCell priceCell">
        {/* <div className={`priceWrapper priceWithMove ${priceFlash ? `valueFlash${priceFlash === 'up' ? 'Up' : 'Down'}` : ''}`}> */}
          <span className={`priceMoveIcon ${priceFlash || ''}`} aria-hidden="true">
            {priceFlash === 'up' ? '▲' : priceFlash === 'down' ? '▼' : ''}
          </span>
          <span className={`priceValue ${priceFlash ? `priceValue${priceFlash === 'up' ? 'Up' : 'Down'}` : ''}`} title={`Current price: ${formatPrice(market.price || market.index)}`}>
            {formatPrice(market.price || market.index)}
          </span>
        {/* </div> */}
      </td>
      <td className="cryptoTableCell changeCell">
        <div className="changeWrapper">
          <span
            className={`changeValue ${change24h >= 0 ? 'positive' : 'negative'}`}
            title={`24h price change: ${formatChange(change24h)}`}
          >
            {formatChange(change24h)}
          </span>
        </div>
      </td>
      <td className="cryptoTableCell volumeCell">
        <div className="volumeWrapper">
          <span className="volumeValue" title={`24h trading volume: ${formatVolume(market.volume24h || 0)}`}>
            {formatVolume(market.volume24h || 0)}
          </span>
        </div>
      </td>
      <td className="cryptoTableCell bidCell">
        <div className="priceWrapper">
          <span className="priceValue bidValue" title={`Best bid price: ${formatPrice(market.bid)}`}>
            {formatPrice(market.bid)}
          </span>
        </div>
      </td>
      <td className="cryptoTableCell askCell">
        <div className="priceWrapper">
          <span className="priceValue askValue" title={`Best ask price: ${formatPrice(market.ask)}`}>
            {formatPrice(market.ask)}
          </span>
        </div>
      </td>
      <td className="cryptoTableCell highCell">
        <div className="highLowWrapper">
          <span className="highValue" title={`24h highest price: ${formatPrice(market.high24h)}`}>
            {formatPrice(market.high24h)}
          </span>
          {/* {market.high24h && market.low24h && (
            <div className="priceRangeBar">
              <div 
                className="priceRangeFill" 
                style={{ width: `${priceRange}%` }}
                title={`Price position in 24h range: ${priceRange.toFixed(1)}%`}
              />
            </div>
          )} */}
        </div>
      </td>
      <td className="cryptoTableCell lowCell">
        <span className="lowValue" title={`24h lowest price: ${formatPrice(market.low24h)}`}>
          {formatPrice(market.low24h)}
        </span>
      </td>
      <td className="cryptoTableCell tradeCell">
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

CryptoTableRow.displayName = 'CryptoTableRow';

const CryptoMobileCard = memo(({ market, onMarketClick, formatPrice, isFavorite, isWatchlist, onToggleFavorite, onToggleWatchlist, priceFlash, movementTrail }) => {
  const name = market.id || market.symbol;
  const type = market.marketType || 'crypto';

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

  const change24h = market.change24h || 0;
  const priceRange = calculatePriceRange(market.price || market.index || 0, market.high24h || 0, market.low24h || 0);

  return (
    <div className="cryptoMobileCard" onClick={handleCardClick}>
      <div className="cryptoCardHeader">
        <div className="cryptoCardPair">
          {/* <button
            className={`favoriteBtn ${isFavorite ? 'active' : ''}`}
            onClick={handleFavoriteClick}
            title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            {isFavorite ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="currentColor" stroke="none" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
              </svg>
            )}
          </button>
          <button
            className={`watchlistBtn ${isWatchlist ? 'active' : ''}`}
            onClick={handleWatchlistClick}
            title={isWatchlist ? 'Remove from watchlist' : 'Add to watchlist'}
            aria-label={isWatchlist ? 'Remove from watchlist' : 'Add to watchlist'}
          >
            {isWatchlist ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.5">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" fill="currentColor" stroke="none" />
                <circle cx="12" cy="12" r="3" fill="var(--bg-primary)" stroke="none" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
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
      <div className="cryptoCardBody">
        <div className="cryptoCardRow">
          <div className="cryptoCardLabel">Last Price</div>
          <div className={`cryptoCardValue priceValue ${priceFlash ? `valueFlash${priceFlash === 'up' ? 'Up' : 'Down'} priceValue${priceFlash === 'up' ? 'Up' : 'Down'}` : ''}`}>
            <span className={`priceMoveIcon ${priceFlash || ''}`} aria-hidden="true">
              {priceFlash === 'up' ? '▲' : priceFlash === 'down' ? '▼' : ''}
            </span>{' '}
            {formatPrice(market.price || market.index)}
          </div>
        </div>
        <div className="cryptoCardRow">
          <div className="cryptoCardLabel">24h Change</div>
          <div className={`cryptoCardValue ${change24h >= 0 ? 'positive' : 'negative'}`}>
            {formatChange(change24h)}
          </div>
        </div>
        <div className="cryptoCardRow">
          <div className="cryptoCardLabel">Volume 24h</div>
          <div className="cryptoCardValue volumeValue">{formatVolume(market.volume24h || 0)}</div>
        </div>
        <div className="cryptoCardRow">
          <div className="cryptoCardLabel">Bid / Ask</div>
          <div className="cryptoCardValue bidAskPair">
            <span className="bidValue">{formatPrice(market.bid)}</span>
            <span className="separator"> / </span>
            <span className="askValue">{formatPrice(market.ask)}</span>
          </div>
        </div>
        <div className="cryptoCardRow">
          <div className="cryptoCardLabel">24h Range</div>
          <div className="cryptoCardValue rangeValue">
            <span className="lowValue">{formatPrice(market.low24h)}</span>
            <span className="separator"> - </span>
            <span className="highValue">{formatPrice(market.high24h)}</span>
          </div>
        </div>
        {/* {market.high24h && market.low24h && (
          <div className="cryptoCardRow">
            <div className="cryptoCardLabel">Price Position</div>
            <div className="cryptoCardValue">
              <div className="priceRangeBar">
                <div
                  className="priceRangeFill"
                  style={{ width: `${calculatePriceRange(market.price || market.index || 0, market.high24h, market.low24h)}%` }}
                />
              </div>
              <span className="rangePercentage">
                {calculatePriceRange(market.price || market.index || 0, market.high24h, market.low24h).toFixed(1)}%
              </span>
            </div>
          </div>
        )} */}
      </div>
    </div>
  );
});

CryptoMobileCard.displayName = 'CryptoMobileCard';

const CryptoTable = ({ markets, loading, onMarketClick, formatPrice, favoritesSet, watchlistSet, itemKey, onToggleFavorite, onToggleWatchlist }) => {
  const lastPriceByKeyRef = useRef(new Map());
  const flashTimeoutRef = useRef(null);
  const [priceFlashMap, setPriceFlashMap] = useState(() => new Map());
  const [movementTrailMap, setMovementTrailMap] = useState(() => new Map());
  const keyOf = (m) => itemKey(m.id || m.symbol, m.marketType || 'crypto');

  useEffect(() => {
    if (!markets || markets.length === 0) return;
    const next = new Map();
    const trailNext = new Map();
    const prev = lastPriceByKeyRef.current;
    markets.forEach((m) => {
      const key = m.id || m.symbol;
      const price = Number(m.price ?? m.index ?? 0) || 0;
      if (!price) return;
      const last = prev.get(key);
      if (last != null && last !== price) {
        const move = price > last ? 'up' : 'down';
        next.set(key, move);
        trailNext.set(key, move);
      }
      lastPriceByKeyRef.current.set(key, price);
    });
    if (trailNext.size > 0) {
      setMovementTrailMap((prevTrail) => {
        const updated = new Map(prevTrail);
        trailNext.forEach((move, key) => {
          const prevList = updated.get(key) || [];
          updated.set(key, [move, ...prevList].slice(0, 4));
        });
        return updated;
      });
    }
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
  const getMovementTrail = useCallback((market) => {
    const key = market?.id || market?.symbol;
    return key ? movementTrailMap.get(key) || [] : [];
  }, [movementTrailMap]);

  return (
    <>
      <div className="cryptoTableWrapper">
        <table className="cryptoTable">
          <thead className="cryptoTableHead">
            <tr>
              <th className="cryptoTableHeader marketCell">Market</th>
              <th className="cryptoTableHeader priceCell">Last Price</th>
              <th className="cryptoTableHeader changeCell">24h Change</th>
              <th className="cryptoTableHeader volumeCell">Volume 24h</th>
              <th className="cryptoTableHeader bidCell">Bid</th>
              <th className="cryptoTableHeader askCell">Ask</th>
              <th className="cryptoTableHeader highCell">24h High</th>
              <th className="cryptoTableHeader lowCell">24h Low</th>
              <th className="cryptoTableHeader tradeCell">Action</th>
            </tr>
          </thead>
          <tbody className="cryptoTableBody">
            {
              loading ? (
                <tr>
                  <td colSpan="9" className="cryptoTableEmpty">
                    <div className="noMarkets">
                      <p>Loading market data...</p>
                    </div>
                  </td>
                </tr>
              ) :
                markets.length > 0 ? (
                  markets.map((market) => (
                    <CryptoTableRow
                      key={market.id || market.symbol}
                      market={market}
                      onMarketClick={onMarketClick}
                      formatPrice={formatPrice}
                      isFavorite={favoritesSet?.has(keyOf(market))}
                      isWatchlist={watchlistSet?.has(keyOf(market))}
                      onToggleFavorite={onToggleFavorite}
                      onToggleWatchlist={onToggleWatchlist}
                      priceFlash={getPriceFlash(market)}
                      movementTrail={getMovementTrail(market)}
                    />
                  ))
                ) : (
                  <tr>
                    <td colSpan="9" className="cryptoTableEmpty">
                      <div className="noMarkets">
                        <p>No crypto markets available</p>
                      </div>
                    </td>
                  </tr>
                )
            }
            {/* {markets.length > 0 ? (
              markets.map((market) => (
                <CryptoTableRow
                  key={market.id || market.symbol}
                  market={market}
                  onMarketClick={onMarketClick}
                  formatPrice={formatPrice}
                  isFavorite={favoritesSet?.has(keyOf(market))}
                  isWatchlist={watchlistSet?.has(keyOf(market))}
                  onToggleFavorite={onToggleFavorite}
                  onToggleWatchlist={onToggleWatchlist}
                />
              ))
            ) : (
              <tr>
                <td colSpan="9" className="cryptoTableEmpty">
                  <div className="noMarkets">
                    <p>No crypto markets available</p>
                  </div>
                </td>
              </tr>
            )} */}
          </tbody>
        </table>
      </div>
      <div className="cryptoMobileView">
        {markets.length > 0 ? (
          markets.map((market) => (
            <CryptoMobileCard
              key={market.id || market.symbol}
              market={market}
              onMarketClick={onMarketClick}
              formatPrice={formatPrice}
              isFavorite={favoritesSet?.has(keyOf(market))}
              isWatchlist={watchlistSet?.has(keyOf(market))}
              onToggleFavorite={onToggleFavorite}
              onToggleWatchlist={onToggleWatchlist}
              priceFlash={getPriceFlash(market)}
              movementTrail={getMovementTrail(market)}
            />
          ))
        ) : (
          <div className="noMarkets">
            <p>No crypto markets available</p>
          </div>
        )}
      </div>
    </>
  );
};

export default CryptoTable;


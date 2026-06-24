import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { parseIndiaFavouriteName } from '../../services/favouritesWishlistApi';

const PRICE_FLASH_DURATION_MS = 600;

/** Stable favourite key: prefer pairSymbol + pairId (matches API `symbol_pairId` storage). */
function resolveIndiaToggleName(market) {
  const pairId = String(
    market?.pairid ?? market?.pairId ?? market?.instrument_token ?? market?.instrumentToken ?? ''
  ).trim();

  let symbol = String(market?.pairSymbol || market?.symbol || market?.id || '').trim();
  if (/^\d+$/.test(symbol) && market?.pairSymbol) {
    symbol = String(market.pairSymbol).trim();
  }

  if (symbol.includes(':')) {
    symbol = symbol.split(':').slice(1).join(':').trim();
  }

  const parsed = parseIndiaFavouriteName(symbol);
  const sym = (parsed.symbol || symbol).trim();
  const pid = pairId || parsed.pairId;
  if (pid && sym) return `${sym}_${pid}`;
  return sym || symbol;
}

const IndiaTableRow = memo(({ market, onMarketClick, formatPrice, isFavorite, isWatchlist, onToggleFavorite, onToggleWatchlist, priceFlash }) => {
  const toggleName = resolveIndiaToggleName(market);

  let name = market.symbol || market.id;
  if (/^\d+$/.test(name) && market.base) {
    name = market.base.toUpperCase().replace(/[:/\-\s_.]/g, '');
  } else if (name && name.includes(':')) {
    name = name.split(':').slice(1).join(':').trim();
  }

  let tradeName = market.symbol || market.id;
  if (/^\d+$/.test(tradeName) && market.base) {
    tradeName = market.base.toUpperCase().replace(/[:/\-\s_.]/g, '');
  } else if (tradeName && tradeName.includes(':')) {
    tradeName = tradeName.split(':').slice(1).join(':').trim();
  }

  const type = market.marketType || 'india';
  const pairId = String(market.pairid ?? market.pairId ?? market.instrument_token ?? market.instrumentToken ?? '').trim();
  const exchange = String(market.exchange || '').trim();
  const change24h = Number(market.change24h ?? 0);
  const isLoading = Boolean(market?.isLoading);

  const renderValue = useCallback((value, className = '') => {
    if (isLoading || value == null) {
      return <span className={className}>{'—'}</span>;
    }
    return <span className={className}>{formatPrice(value)}</span>;
  }, [formatPrice, isLoading]);

  const handleRowClick = useCallback((e) => {
    if (e && typeof e.isTrusted === 'boolean' && !e.isTrusted) return;
    if (e.target.closest('.favoriteBtn') || e.target.closest('.watchlistBtn') || e.target.closest('.tradeBtn') || e.target.closest('.removeListBtn')) return;
    if (!e.target.closest('.marketCell')) return;
    e.preventDefault();
    e.stopPropagation();
    onMarketClick?.(name, type, pairId, exchange);
  }, [name, type, pairId, exchange, onMarketClick]);

  const handleFavoriteClick = useCallback((e) => {
    if (e && typeof e.isTrusted === 'boolean' && !e.isTrusted) return;
    e.preventDefault();
    e.stopPropagation();
    onToggleFavorite?.(toggleName, type);
  }, [toggleName, type, onToggleFavorite]);

  const handleWatchlistClick = useCallback((e) => {
    if (e && typeof e.isTrusted === 'boolean' && !e.isTrusted) return;
    e.preventDefault();
    e.stopPropagation();
    onToggleWatchlist?.(name, type);
  }, [name, type, onToggleWatchlist]);

  const handleTradeClick = useCallback((e) => {
    if (e && typeof e.isTrusted === 'boolean' && !e.isTrusted) return;
    e.preventDefault();
    e.stopPropagation();
    onMarketClick?.(tradeName, type, pairId, exchange);
  }, [tradeName, type, pairId, exchange, onMarketClick]);

  const handleRemoveClick = useCallback((e) => {
    if (e && typeof e.isTrusted === 'boolean' && !e.isTrusted) return;
    e.preventDefault();
    e.stopPropagation();
    onToggleFavorite?.(toggleName, type);
  }, [toggleName, type, onToggleFavorite]);

  return (
    <tr
      className={`indiaTableRow ${isLoading ? 'indiaTableRowLoading' : ''} ${priceFlash ? `priceMove${priceFlash === 'up' ? 'Up' : 'Down'}` : ''}`}
      onClick={isLoading ? undefined : handleRowClick}
    >
      <td className="indiaTableCell marketCell">
        <div className="marketInfo">
          {/* <button
            type="button"
            className={`favoriteBtn ${isFavorite ? 'active' : ''}`}
            onClick={isLoading ? undefined : handleFavoriteClick}
            disabled={isLoading}
            title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            {isFavorite ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.5"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="currentColor" stroke="none" /></svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" /></svg>
            )}
          </button> */}
          <div className="marketSymbol">
            {market.exchange ? <span className="symbolQuote">{market.exchange}</span> : null}
            <span className="symbolBase">{market.base}</span>
          </div>
        </div>
      </td>
      <td className="indiaTableCell priceCell">
        <div className={`priceWrapper priceWithMove ${priceFlash ? `valueFlash${priceFlash === 'up' ? 'Up' : 'Down'}` : ''}`}>
          <span className={`priceMoveIcon ${priceFlash || ''}`} aria-hidden="true">
            {priceFlash === 'up' ? '▲' : priceFlash === 'down' ? '▼' : ''}
          </span>
          {renderValue(
            market.price ?? market.index,
            `priceValue ${priceFlash ? `priceValue${priceFlash === 'up' ? 'Up' : 'Down'}` : ''}`
          )}
        </div>
      </td>
      <td className="indiaTableCell changeCell">
        <span className={`changeValue ${change24h >= 0 ? 'positive' : 'negative'}`}>
          {isLoading ? '—' : `${change24h >= 0 ? '+' : ''}${change24h.toFixed(2)}%`}
        </span>
      </td>
      <td className="indiaTableCell bidCell">
        <div className="priceWrapper">
          {renderValue(market.bid, 'priceValue bidValue')}
        </div>
      </td>
      <td className="indiaTableCell askCell">
        <div className="priceWrapper">
          {renderValue(market.ask, 'priceValue askValue')}
        </div>
      </td>
      <td className="indiaTableCell spreadCell">
        <span className="spreadValue">
          {isLoading ? '—' : formatPrice((market.ask || 0) - (market.bid || 0))}
        </span>
      </td>
      <td className="indiaTableCell highCell">
        {renderValue(market.high24h, 'highValue')}
      </td>
      <td className="indiaTableCell lowCell">
        {renderValue(market.low24h, 'lowValue')}
      </td>
      <td className="indiaTableCell tradeCell">
        <div className="tableActionButtons">
          <button
            type="button"
            className="tradeBtn market_btn"
            onClick={isLoading ? undefined : handleTradeClick}
            disabled={isLoading}
            title="Trade this market"
            aria-label="Trade this market"
          >
            <span>Trade</span>
          </button>
          <button
            type="button"
            className="removeListBtn market_btn"
            onClick={isLoading ? undefined : handleRemoveClick}
            disabled={isLoading}
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

IndiaTableRow.displayName = 'IndiaTableRow';

const IndiaMobileCard = memo(({ market, onMarketClick, formatPrice, isFavorite, isWatchlist, onToggleFavorite, onToggleWatchlist, priceFlash }) => {
  const toggleName = resolveIndiaToggleName(market);
  const name = market.symbol || market.id;
  const tradeName = market.symbol || market.id;
  const type = market.marketType || 'india';
  const pairId = String(market.pairid ?? market.pairId ?? market.instrument_token ?? market.instrumentToken ?? '').trim();
  const exchange = String(market.exchange || '').trim();
  const change24h = Number(market.change24h ?? 0);
  const isLoading = Boolean(market?.isLoading || market?.lastUpdate === 0);

  const renderValue = useCallback((value, className = '') => {
    if (isLoading || value == null) {
      return <span className={className}>{'—'}</span>;
    }
    return <span className={className}>{formatPrice(value)}</span>;
  }, [formatPrice, isLoading]);

  const handleCardClick = useCallback((e) => {
    if (e && typeof e.isTrusted === 'boolean' && !e.isTrusted) return;
    if (e.target.closest('.favoriteBtn') || e.target.closest('.watchlistBtn') || e.target.closest('.tradeBtn') || e.target.closest('.removeListBtn')) return;
    e.preventDefault();
    e.stopPropagation();
    onMarketClick?.(name, type, pairId, exchange);
  }, [name, type, pairId, exchange, onMarketClick]);

  const handleFavoriteClick = useCallback((e) => {
    if (e && typeof e.isTrusted === 'boolean' && !e.isTrusted) return;
    e.preventDefault();
    e.stopPropagation();
    onToggleFavorite?.(toggleName, type);
  }, [toggleName, type, onToggleFavorite]);

  const handleWatchlistClick = useCallback((e) => {
    if (e && typeof e.isTrusted === 'boolean' && !e.isTrusted) return;
    e.preventDefault();
    e.stopPropagation();
    onToggleWatchlist?.(name, type);
  }, [name, type, onToggleWatchlist]);

  const handleTradeClick = useCallback((e) => {
    if (e && typeof e.isTrusted === 'boolean' && !e.isTrusted) return;
    e.preventDefault();
    e.stopPropagation();
    onMarketClick?.(tradeName, type, pairId, exchange);
  }, [tradeName, type, pairId, exchange, onMarketClick]);

  const handleRemoveClick = useCallback((e) => {
    if (e && typeof e.isTrusted === 'boolean' && !e.isTrusted) return;
    e.preventDefault();
    e.stopPropagation();
    onToggleFavorite?.(toggleName, type);
  }, [toggleName, type, onToggleFavorite]);

  return (
    <div className={`indiaMobileCard ${isLoading ? 'indiaMobileCardLoading' : ''}`} onClick={isLoading ? undefined : handleCardClick}>
      <div className="indiaCardHeader">
        <div className="indiaCardPair">
          {/* <button
            type="button"
            className={`favoriteBtn ${isFavorite ? 'active' : ''}`}
            onClick={isLoading ? undefined : handleFavoriteClick}
            disabled={isLoading}
            title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            {isFavorite ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.5"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="currentColor" stroke="none" /></svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" /></svg>
            )}
          </button> */}
          {/* <button className={`watchlistBtn ${isWatchlist ? 'active' : ''}`} onClick={handleWatchlistClick} title={isWatchlist ? 'Remove from watchlist' : 'Add to watchlist'} aria-label={isWatchlist ? 'Remove from watchlist' : 'Add to watchlist'}>
            {isWatchlist ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="3" fill="var(--bg-primary)" stroke="none" /></svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
            )}
          </button> */}
          <div className="marketSymbol">
            {market.exchange ? <span className="symbolQuote">{market.exchange}</span> : null}
            <span className="symbolBase">{market.base}</span>
            {/* <span className="symbolQuote">/{market.quote}</span> */}
          </div>
        </div>
        <button
          type="button"
          className="removeListBtn mobileRemoveListBtn"
          onClick={isLoading ? undefined : handleRemoveClick}
          disabled={isLoading}
          title="Remove from list"
          aria-label="Remove from list"
        >
          Remove
        </button>
      </div>
      <div className="indiaCardBody">
        <div className="indiaCardRow">
          <div className="indiaCardLabel">Price</div>
          <div
            className={`indiaCardValue priceWithMove ${priceFlash ? `valueFlash${priceFlash === 'up' ? 'Up' : 'Down'} priceValue${priceFlash === 'up' ? 'Up' : 'Down'}` : ''}`}
          >
            <span className={`priceMoveIcon ${priceFlash || ''}`} aria-hidden="true">
              {priceFlash === 'up' ? '▲' : priceFlash === 'down' ? '▼' : ''}
            </span>
            {renderValue(market.price ?? market.index)}
          </div>
        </div>
        <div className="indiaCardRow">
          <div className="indiaCardLabel">Spread</div>
          <div className="indiaCardValue">
            {isLoading ? '—' : formatPrice((market.ask || 0) - (market.bid || 0))}
          </div>
        </div>
        <div className="indiaCardRow">
          <div className="indiaCardLabel">24h Change</div>
          <div className={`indiaCardValue ${!isLoading ? (change24h >= 0 ? 'positive' : 'negative') : ''}`}>
            {isLoading ? '—' : <span>{change24h >= 0 ? '+' : ''}{change24h.toFixed(2)}%</span>}
          </div>
        </div>
        <div className="indiaCardRow">
          <div className="indiaCardLabel">Ask</div>
          <div className="indiaCardValue askValue">{renderValue(market.ask)}</div>
        </div>
        <div className="indiaCardRow">
          <div className="indiaCardLabel">Bid</div>
          <div className="indiaCardValue bidValue">{renderValue(market.bid)}</div>
        </div>
      </div>
    </div>
  );
});

IndiaMobileCard.displayName = 'IndiaMobileCard';

const IndiaTable = ({ markets, onMarketClick, formatPrice, favoritesSet, watchlistSet, itemKey, onToggleFavorite, onToggleWatchlist }) => {
  const lastPriceByKeyRef = useRef(new Map());
  const [priceFlashMap, setPriceFlashMap] = useState(() => new Map());
  const flashTimeoutRef = useRef(null);

  const normalizeKeyText = (value) =>
    String(value || '')
      .toUpperCase()
      .trim()
      .replace(/[:/\-\s_.:]/g, '');

  const keyOf = (m) => {
    const type = m.marketType || 'india';
    const raw = m.symbol || m.id;
    const normalized = normalizeKeyText(raw);
    return {
      rawKey: itemKey(raw, type),
      normalizedKey: itemKey(normalized, type),
    };
  };

  useEffect(() => {
    if (!markets || markets.length === 0) return;
    const next = new Map();
    const prev = lastPriceByKeyRef.current;

    markets.forEach((m) => {
      if (Boolean(m?.isLoading || m?.lastUpdate === 0)) return;
      const key = m.id || m.symbol;
      const price = Number(m.price ?? m.index ?? 0) || 0;
      if (!key || !price) return;
      const last = prev.get(key);
      if (last != null && last !== price) {
        next.set(key, price > last ? 'up' : 'down');
      }
      prev.set(key, price);
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
      <div className="indiaTableWrapper">
        <table className="indiaTable">
          <thead className="indiaTableHead">
            <tr>
              <th className="indiaTableHeader marketCell">Index</th>
              <th className="indiaTableHeader priceCell">Last Price</th>
              <th className="indiaTableHeader changeCell">24h Change</th>
              <th className="indiaTableHeader askCell">Bid</th>
              <th className="indiaTableHeader bidCell">Ask</th>
              <th className="indiaTableHeader spreadCell">Spread</th>
              <th className="indiaTableHeader highCell">24h High</th>
              <th className="indiaTableHeader lowCell">24h Low</th>
              <th className="indiaTableHeader tradeCell">Actions</th>
            </tr>
          </thead>
          <tbody className="indiaTableBody">
            {markets.length > 0 ? (
              markets.map((market) => (
                <IndiaTableRow
                  key={market.id || market.symbol}
                  market={market}
                  onMarketClick={onMarketClick}
                  formatPrice={formatPrice}
                  isFavorite={(() => {
                    const keys = keyOf(market);
                    return favoritesSet?.has(keys.rawKey) || favoritesSet?.has(keys.normalizedKey);
                  })()}
                  isWatchlist={(() => {
                    const keys = keyOf(market);
                    return watchlistSet?.has(keys.rawKey) || watchlistSet?.has(keys.normalizedKey);
                  })()}
                  onToggleFavorite={onToggleFavorite}
                  onToggleWatchlist={onToggleWatchlist}
                  priceFlash={getPriceFlash(market)}
                />
              ))
            ) : (
              <tr>
                <td colSpan="9" className="indiaTableEmpty">
                  <div className="noMarkets">
                    <p>No India market data available</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="indiaMobileView">
        {markets.length > 0 ? (
          markets.map((market) => (
            <IndiaMobileCard
              key={market.id || market.symbol}
              market={market}
              onMarketClick={onMarketClick}
              formatPrice={formatPrice}
              isFavorite={(() => {
                const keys = keyOf(market);
                return favoritesSet?.has(keys.rawKey) || favoritesSet?.has(keys.normalizedKey);
              })()}
              isWatchlist={(() => {
                const keys = keyOf(market);
                return watchlistSet?.has(keys.rawKey) || watchlistSet?.has(keys.normalizedKey);
              })()}
              onToggleFavorite={onToggleFavorite}
              onToggleWatchlist={onToggleWatchlist}
              priceFlash={getPriceFlash(market)}
            />
          ))
        ) : (
          <div className="noMarkets">
            <p>No India market data available</p>
          </div>
        )}
      </div>
    </>
  );
};

export default IndiaTable;


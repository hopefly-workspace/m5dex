import { memo, useCallback, useEffect, useRef, useState } from 'react';

const PRICE_FLASH_DURATION_MS = 600;

const MetalsTableRow = memo(({ market, onMarketClick, formatPrice, isFavorite, isWatchlist, onToggleFavorite, onToggleWatchlist, priceFlash }) => {
  const name = market.id || market.symbol;
  const type = market.marketType || 'metals';

  const handleRowClick = useCallback((e) => {
    if (e.target.closest('.favoriteBtn') || e.target.closest('.watchlistBtn') || e.target.closest('.tradeBtn')) return;
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

  return (
    <tr className="metalsTableRow" onClick={handleRowClick}>
      <td className="metalsTableCell marketCell">
        <div className="marketInfo">
          <button className={`favoriteBtn ${isFavorite ? 'active' : ''}`} onClick={handleFavoriteClick} title={isFavorite ? 'Remove from favorites' : 'Add to favorites'} aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}>
            {isFavorite ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.5"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="currentColor" stroke="none" /></svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" /></svg>
            )}
          </button>
          {/* <button className={`watchlistBtn ${isWatchlist ? 'active' : ''}`} onClick={handleWatchlistClick} title={isWatchlist ? 'Remove from watchlist' : 'Add to watchlist'} aria-label={isWatchlist ? 'Remove from watchlist' : 'Add to watchlist'}>
            {isWatchlist ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="3" fill="var(--bg-primary)" stroke="none" /></svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
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
      <td className="metalsTableCell priceCell">
        <div className={`priceWrapper  ${priceFlash ? `valueFlash${priceFlash === 'up' ? 'Up' : 'Down'}` : ''}`}>
          <span className="priceValue">{formatPrice(market.price || market.index)}</span>
        </div>
      </td>
      <td className="metalsTableCell changeCell">
        <span className={`changeValue ${market.change24h >= 0 ? 'positive' : 'negative'}`}>
          {market.change24h >= 0 ? '+' : ''}{market.change24h.toFixed(2)}
        </span>
      </td>
      <td className="metalsTableCell bidCell">
        <div className="priceWrapper">
          <span className="priceValue bidValue">{formatPrice(market.bid)}</span>
        </div>
      </td>
      <td className="metalsTableCell askCell">
        <div className="priceWrapper">
          <span className="priceValue askValue">{formatPrice(market.ask)}</span>
        </div>
      </td>
      <td className="metalsTableCell spreadCell">
        <span className="spreadValue">{formatPrice((market.ask || 0) - (market.bid || 0))}</span>
      </td>
      <td className="metalsTableCell highCell">
        <span className="highValue">{formatPrice(market.high24h)}</span>
      </td>
      <td className="metalsTableCell lowCell">
        <span className="lowValue">{formatPrice(market.low24h)}</span>
      </td>
      <td className="metalsTableCell tradeCell">
        <button
          className="tradeBtn market_btn"
          onClick={handleTradeClick}
          title="Trade this market"
          aria-label="Trade this market"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="13" viewBox="0 0 14 13" fill="none">
            <g clip-path="url(#clip0_160_780)">
              <path d="M13.3321 11.1248C13.3321 10.5635 12.8685 10.1058 12.2957 10.1058C12.0027 10.1058 11.7366 10.2273 11.5489 10.4202L9.59497 9.50974C9.60151 9.46217 9.60674 9.41266 9.60674 9.36186C9.60674 8.79863 9.14116 8.34277 8.57029 8.34277C7.99941 8.34277 7.53252 8.79863 7.53252 9.36186C7.53252 9.47374 7.55279 9.58047 7.58614 9.68141L5.62117 10.7532C5.43219 10.541 5.15426 10.4073 4.84432 10.4073C4.30548 10.4073 3.86148 10.8156 3.81308 11.3338L2.07895 11.5826C1.92332 11.2123 1.5519 10.9506 1.11965 10.9506C0.548772 10.9506 0.0831909 11.4084 0.0831909 11.9697C0.0831909 12.531 0.548772 12.9901 1.11965 12.9901C1.65716 12.9901 2.09923 12.5869 2.15089 12.0719L3.89037 11.8218C4.04796 12.189 4.41612 12.4455 4.84443 12.4455C5.41727 12.4455 5.8822 11.9877 5.8822 11.4264C5.8822 11.346 5.87043 11.267 5.85212 11.1911L7.85576 10.1C8.04148 10.2742 8.29258 10.3816 8.57049 10.3816C8.91052 10.3816 9.21328 10.2189 9.40228 9.96818L11.2973 10.8522C11.2724 10.9397 11.2587 11.0316 11.2587 11.1255C11.2587 11.6888 11.7243 12.1459 12.2952 12.1459C12.866 12.1459 13.3316 11.6881 13.3316 11.1255L13.3321 11.1248ZM1.12025 12.4963C0.825335 12.4963 0.585999 12.259 0.585999 11.9697C0.585999 11.6797 0.825335 11.4444 1.12025 11.4444C1.41516 11.4444 1.6545 11.6797 1.6545 11.9697C1.6545 12.2597 1.41516 12.4963 1.12025 12.4963ZM4.84496 11.951C4.55005 11.951 4.31071 11.7157 4.31071 11.4257C4.31071 11.1358 4.55005 10.9004 4.84496 10.9004C5.13988 10.9004 5.38052 11.1358 5.38052 11.4257C5.38052 11.7157 5.13923 11.951 4.84496 11.951ZM8.57102 9.88715C8.27611 9.88715 8.03546 9.65183 8.03546 9.36185C8.03546 9.07188 8.27676 8.83656 8.57102 8.83656C8.86593 8.83656 9.10527 9.07188 9.10527 9.36185C9.10527 9.65183 8.86593 9.88715 8.57102 9.88715ZM11.7621 11.1248C11.7621 10.8349 12.0014 10.5995 12.2963 10.5995C12.5912 10.5995 12.8306 10.8349 12.8306 11.1248C12.8306 11.4148 12.5912 11.6514 12.2963 11.6514C12.0014 11.6514 11.7621 11.4161 11.7621 11.1248Z" fill="white" />
              <path d="M12.8128 2.50353H12.5467V1.0633C12.5467 0.926996 12.4342 0.816406 12.2956 0.816406C12.157 0.816406 12.0445 0.926996 12.0445 1.0633V2.50353H11.7783C11.4586 2.50353 11.199 2.75879 11.199 3.07319V6.39148C11.199 6.7059 11.4586 6.96114 11.7783 6.96114H12.0445V8.26828C12.0445 8.40458 12.157 8.51517 12.2956 8.51517C12.4342 8.51517 12.5467 8.40458 12.5467 8.26828V6.96114H12.8128C13.1326 6.96114 13.3922 6.70588 13.3922 6.39148V3.07319C13.3922 2.75878 13.1326 2.50353 12.8128 2.50353ZM12.89 6.3915C12.89 6.43265 12.8547 6.46737 12.8128 6.46737H11.7796C11.7378 6.46737 11.7025 6.43265 11.7025 6.3915V3.07321C11.7025 3.03206 11.7378 2.99734 11.7796 2.99734H12.8128C12.8547 2.99734 12.89 3.03206 12.89 3.07321V6.3915Z" fill="white" />
              <path d="M8.5623 0C8.42367 0 8.3112 0.11059 8.3112 0.246897V1.68713H8.04506C7.72529 1.68713 7.4657 1.94239 7.4657 2.25678V5.57508C7.4657 5.88949 7.72531 6.14473 8.04506 6.14473H8.3112V7.45187C8.3112 7.58818 8.42367 7.69877 8.5623 7.69877C8.70093 7.69877 8.81341 7.58818 8.81341 7.45187V6.14473H9.07955C9.39932 6.14473 9.65891 5.88948 9.65891 5.57508V2.25678C9.65891 1.94237 9.3993 1.68713 9.07955 1.68713H8.81341V0.246897C8.81341 0.11059 8.70093 0 8.5623 0ZM9.07955 2.18092C9.1214 2.18092 9.15671 2.21564 9.15671 2.25679V5.57508C9.15671 5.61623 9.1214 5.65095 9.07955 5.65095H8.04635C8.0045 5.65095 7.96919 5.61623 7.96919 5.57508V2.25679C7.96919 2.21564 8.0045 2.18092 8.04635 2.18092H9.07955Z" fill="white" />
              <path d="M4.82988 1.2832C4.69125 1.2832 4.57878 1.39379 4.57878 1.5301V2.97033H4.31264C3.99287 2.97033 3.73328 3.22559 3.73328 3.53999V6.85828C3.73328 7.17269 3.99288 7.42794 4.31264 7.42794H4.57878V8.73507C4.57878 8.87138 4.69125 8.98197 4.82988 8.98197C4.96851 8.98197 5.08099 8.87138 5.08099 8.73507V7.42794H5.34712C5.6669 7.42794 5.92649 7.17268 5.92649 6.85828V3.53999C5.92649 3.22557 5.66688 2.97033 5.34712 2.97033H5.08099V1.5301C5.08099 1.39379 4.96851 1.2832 4.82988 1.2832ZM5.34712 3.46412C5.38898 3.46412 5.42429 3.49884 5.42429 3.53999V6.85829C5.42429 6.89944 5.38898 6.93416 5.34712 6.93416H4.31393C4.27208 6.93416 4.23677 6.89944 4.23677 6.85829V3.53999C4.23677 3.49884 4.27208 3.46412 4.31393 3.46412H5.34712Z" fill="white" />
              <path d="M0 4.12983V7.44812C0 7.76254 0.259609 8.01778 0.579365 8.01778H0.845502V9.32492C0.845502 9.46122 0.957977 9.57181 1.09661 9.57181C1.23524 9.57181 1.34771 9.46122 1.34771 9.32492V8.01778H1.61385C1.93362 8.01778 2.19321 7.76252 2.19321 7.44812V4.12983C2.19321 3.81542 1.9336 3.56017 1.61385 3.56017H1.34771V2.11994C1.34771 1.98364 1.23524 1.87305 1.09661 1.87305C0.957977 1.87305 0.845502 1.98364 0.845502 2.11994V3.56017H0.579365C0.259592 3.56017 0 3.81543 0 4.12983ZM1.61191 4.05461C1.65376 4.05461 1.68907 4.08933 1.68907 4.13048V7.44877C1.68907 7.48992 1.65376 7.52464 1.61191 7.52464H0.578712C0.536861 7.52464 0.501549 7.48992 0.501549 7.44877V4.13048C0.501549 4.08933 0.536861 4.05461 0.578712 4.05461H1.61191Z" fill="white" />
            </g>
            <defs>
              <clipPath id="clip0_160_780">
                <rect width="14" height="13" fill="white" />
              </clipPath>
            </defs>
          </svg>
          <span> Trade</span>

        </button>
      </td>
    </tr>
  );
});

MetalsTableRow.displayName = 'MetalsTableRow';

const MetalsMobileCard = memo(({ market, onMarketClick, formatPrice, isFavorite, isWatchlist, onToggleFavorite, onToggleWatchlist, priceFlash }) => {
  const name = market.id || market.symbol;
  const type = market.marketType || 'metals';

  const handleCardClick = useCallback((e) => {
    if (e.target.closest('.favoriteBtn') || e.target.closest('.watchlistBtn') || e.target.closest('.tradeBtn')) return;
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

  return (
    <div className="metalsMobileCard" onClick={handleCardClick}>
      <div className="metalsCardHeader">
        <div className="metalsCardPair">
          <button className={`favoriteBtn ${isFavorite ? 'active' : ''}`} onClick={handleFavoriteClick} title={isFavorite ? 'Remove from favorites' : 'Add to favorites'} aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}>
            {isFavorite ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.5"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="currentColor" stroke="none" /></svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" /></svg>
            )}
          </button>
          <button className={`watchlistBtn ${isWatchlist ? 'active' : ''}`} onClick={handleWatchlistClick} title={isWatchlist ? 'Remove from watchlist' : 'Add to watchlist'} aria-label={isWatchlist ? 'Remove from watchlist' : 'Add to watchlist'}>
            {isWatchlist ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="3" fill="var(--bg-primary)" stroke="none" /></svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
            )}
          </button>
          <span className="symbolBase">
            {market.base}
            <span className="symbolQuote">/{market.quote}</span>
          </span>
        </div>
      </div>
      <div className="metalsCardBody">
        <div className="metalsCardRow">
          <div className="metalsCardLabel">Price</div>
          <div className={`metalsCardValue ${priceFlash ? `valueFlash${priceFlash === 'up' ? 'Up' : 'Down'}` : ''}`}>{formatPrice(market.price || market.index)}</div>
        </div>
        <div className="metalsCardRow">
          <div className="metalsCardLabel">Spread</div>
          <div className="metalsCardValue">{formatPrice((market.ask || 0) - (market.bid || 0))}</div>
        </div>
        <div className="metalsCardRow">
          <div className="metalsCardLabel">24h Change</div>
          <div className={`metalsCardValue ${market.change24h >= 0 ? 'positive' : 'negative'}`}>
            {market.change24h >= 0 ? '+' : ''}{market.change24h.toFixed(2)}%
          </div>
        </div>
        <div className="metalsCardRow">
          <div className="metalsCardLabel">Ask</div>
          <div className="metalsCardValue askValue">{formatPrice(market.ask)}</div>
        </div>
        <div className="metalsCardRow">
          <div className="metalsCardLabel">Bid</div>
          <div className="metalsCardValue bidValue">{formatPrice(market.bid)}</div>
        </div>
      </div>
    </div>
  );
});

MetalsMobileCard.displayName = 'MetalsMobileCard';

const MetalsTable = ({ markets, onMarketClick, formatPrice, favoritesSet, watchlistSet, itemKey, onToggleFavorite, onToggleWatchlist }) => {
  const lastPriceByKeyRef = useRef(new Map());
  const flashTimeoutRef = useRef(null);
  const [priceFlashMap, setPriceFlashMap] = useState(() => new Map());
  const keyOf = (m) => itemKey(m.id || m.symbol, m.marketType || 'metals');

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
      <div className="metalsTableWrapper">
        <table className="metalsTable">
          <thead className="metalsTableHead">
            <tr>
              <th className="metalsTableHeader marketCell">Metal</th>
              <th className="metalsTableHeader priceCell">Last Price</th>
              <th className="metalsTableHeader changeCell">24h Change</th>
              <th className="metalsTableHeader askCell">Bid</th>
              <th className="metalsTableHeader bidCell">Ask</th>
              <th className="metalsTableHeader spreadCell">Spread</th>
              <th className="metalsTableHeader highCell">24h High</th>
              <th className="metalsTableHeader lowCell">24h Low</th>
              <th className="metalsTableHeader tradeCell">Trade</th>
            </tr>
          </thead>
          <tbody className="metalsTableBody">
            {markets.length > 0 ? (
              markets.map((market) => (
                <MetalsTableRow
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
                <td colSpan="9" className="metalsTableEmpty">
                  <div className="noMarkets">
                    <p>No metals markets available</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="metalsMobileView">
        {markets.length > 0 ? (
          markets.map((market) => (
            <MetalsMobileCard
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
          <div className="noMarkets">
            <p>No metals markets available</p>
          </div>
        )}
      </div>
    </>
  );
};

export default MetalsTable;


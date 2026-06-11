import { useMemo, useCallback } from 'react';
import { useAvaxTradesWebSocket } from '../../hooks/useAvaxTradesWebSocket';
import { normalizeSymbol } from '../../services/favouritesWishlistApi';
import { formatPrice as formatPriceUtil } from '../../utils/helper';
import IndicesTable from './IndicesTable';

const defaultItemKey = (name, type) =>
  `${String(name || '').trim()}|${String(type || 'crypto').trim()}`;

const IndicesMarkets = ({ 
  searchQuery, 
  favoritesSet, 
  watchlistSet,
  itemKey: itemKeyProp,
  onToggleFavorite, 
  onToggleWatchlist,
  onMarketClick,
  showFavorites = false,
  showWatchlist = false,
  sortBy = 'volume'
}) => {
  const itemKey = typeof itemKeyProp === 'function' ? itemKeyProp : defaultItemKey;
  const favKey = useCallback((m) => itemKey(m.id || m.symbol, m.marketType || 'indices'), [itemKey]);
  const indicesWsUrl = import.meta.env.VITE_WS_INDICES_URL || 'ws://206.189.120.57:5001/ws/all';
  const indicesOptions = useMemo(() => ({
    autoConnect: true,
    reconnectInterval: 1000,
    maxReconnectInterval: 30000,
    timeoutInterval: 10000,
    enableHeartbeat: false,
  }), []);

  const { tradesData: indicesTradesData, isConnected: indicesConnected, error: indicesError, connectionState: indicesState } = useAvaxTradesWebSocket(
    indicesWsUrl,
    null,
    indicesOptions
  );

  const processTradeData = useCallback((trade) => {
    if (!trade) return null;

    const rawSymbol = trade.symbol || trade.Symbol || trade.pair || trade.market || trade.instrument || trade.id || '';
    const normalizedKey = normalizeSymbol(rawSymbol);

    if (!normalizedKey) return null;

    const marketType = trade.marketType || '';
    const baseSymbol = (trade.base || normalizedKey.substring(0, 3) || '').toUpperCase();
    const symbolUpper = normalizedKey.toUpperCase();
    
    const indexPatterns = [
      'SPX', 'DJI', 'NDX', 'FTSE', 'DAX', 'NIKKEI', 'CAC', 'ASX', 'HSI', 'SSE', 
      'NIFTY', 'SENSEX', 'IBEX', 'AEX', 'OMX', 'SP500', 'DOW', 'NASDAQ', 'RUSSELL',
      'VIX', 'VIX', 'WILSHIRE', 'MSCI', 'FTSE100', 'DAX30', 'CAC40', 'N225', 'HANG',
      'SHANGHAI', 'SHENZHEN', 'BSE', 'NSE', 'KOSPI', 'TSX', 'ASX200', 'STOXX', 'EUROSTOXX'
    ];
    
    const isIndex = marketType === 'indices' ||
      symbolUpper.match(/^(SPX|DJI|NDX|FTSE|DAX|NIKKEI|CAC|ASX|HSI|SSE|NIFTY|SENSEX|IBEX|AEX|OMX|SP500|DOW|NASDAQ|RUSSELL|VIX|WILSHIRE|MSCI|FTSE100|DAX30|CAC40|N225|HANG|SHANGHAI|SHENZHEN|BSE|NSE|KOSPI|TSX|ASX200|STOXX|EUROSTOXX)/) ||
      baseSymbol.match(/^(SPX|DJI|NDX|FTSE|DAX|NIKKEI|CAC|ASX|HSI|SSE|NIFTY|SENSEX|IBEX|AEX|OMX|SP500|DOW|NASDAQ|RUSSELL|VIX|WILSHIRE|MSCI|FTSE100|DAX30|CAC40|N225|HANG|SHANGHAI|SHENZHEN|BSE|NSE|KOSPI|TSX|ASX200|STOXX|EUROSTOXX)/) ||
      (trade.base && indexPatterns.includes(trade.base.toUpperCase())) ||
      symbolUpper.includes('INDEX') || symbolUpper.includes('INDX') ||
      (rawSymbol && (rawSymbol.toUpperCase().includes('INDEX') || rawSymbol.toUpperCase().includes('INDX')));

    if (!isIndex) return null;

    const price = parseFloat(trade.price || trade.index || trade.lastPrice || trade.close || trade.p || 0);
    const ask = parseFloat(trade.ask || trade.a || price || 0);
    const bid = parseFloat(trade.bid || trade.b || price || 0);
    const volume = parseFloat(trade.volume || trade.vol || trade.volume24h || 0);
    const change = parseFloat(trade.change || trade.change24h || trade.priceChangePercent || 0);
    const high = parseFloat(trade.high || trade.high24h || trade.h || price || 0);
    const low = parseFloat(trade.low || trade.low24h || trade.l || price || 0);

    let base = trade.base || '';
    let quote = trade.quote || 'USD';

    if (!base && normalizedKey.length >= 3) {
      if (normalizedKey.includes('USD')) {
        const usdIndex = normalizedKey.indexOf('USD');
        base = normalizedKey.substring(0, usdIndex);
        quote = normalizedKey.substring(usdIndex);
      } else {
        base = normalizedKey.substring(0, 3);
        quote = normalizedKey.substring(3) || 'USD';
      }
    }

    return {
      id: normalizedKey,
      symbol: rawSymbol || normalizedKey,
      base: base || normalizedKey.substring(0, 3) || 'XXX',
      quote: quote || normalizedKey.substring(3) || 'USD',
      price: price,
      index: price,
      ask: ask,
      bid: bid,
      change24h: change,
      volume24h: volume,
      high24h: high,
      low24h: low,
      lastUpdate: trade.timestamp || trade.time || trade.T || Date.now(),
      marketType: 'indices',
    };
  }, []);

  const processedIndicesData = useMemo(() => {
    if (!indicesTradesData) {
      return [];
    }

    if (!Array.isArray(indicesTradesData) || indicesTradesData.length === 0) {
      return [];
    }

    const uniqueMap = new Map();
    const maxProcess = 500;
    const tradesToProcess = indicesTradesData.slice(-maxProcess);

    for (let i = 0; i < tradesToProcess.length; i++) {
      const trade = tradesToProcess[i];
      if (!trade || typeof trade !== 'object') continue;

      const processed = processTradeData(trade);
      if (processed) {
        const key = processed.id;
        const existing = uniqueMap.get(key);
        if (!existing || (processed.lastUpdate > (existing.lastUpdate || 0))) {
          uniqueMap.set(key, processed);
        } else if (processed.lastUpdate === existing.lastUpdate) {
          uniqueMap.set(key, {
            ...existing,
            ...processed,
            lastUpdate: existing.lastUpdate,
          });
        }
      }
    }

    const result = Array.from(uniqueMap.values());
    return result;
  }, [indicesTradesData, processTradeData]);

  const uniqueMarketsData = processedIndicesData;

  const filteredMarkets = useMemo(() => {
    let filtered = uniqueMarketsData;

    if (showFavorites) filtered = filtered.filter((m) => favoritesSet.has(favKey(m)));
    if (showWatchlist) filtered = filtered.filter((m) => watchlistSet && watchlistSet.has(favKey(m)));

    // Filter by search query
    if (searchQuery && searchQuery.trim()) {
      const lowerQuery = searchQuery.toLowerCase().trim();
      filtered = filtered.filter((market) => {
        const symbol = (market.symbol || '').toLowerCase();
        const base = (market.base || '').toLowerCase();
        const quote = (market.quote || '').toLowerCase();
        const fullSymbol = `${base}${quote}`.toLowerCase();
        const id = (market.id || '').toLowerCase();
        
        return symbol.includes(lowerQuery) || 
               base.includes(lowerQuery) || 
               quote.includes(lowerQuery) || 
               fullSymbol.includes(lowerQuery) ||
               id.includes(lowerQuery);
      });
    }

    return filtered;
  }, [uniqueMarketsData, searchQuery, showFavorites, showWatchlist, favoritesSet, watchlistSet, favKey]);

  const sortedMarkets = useMemo(() => {
    const markets = [...filteredMarkets];
    if (markets.length === 0) return markets;

    markets.sort((a, b) => {
      // Always prioritize favorites first (unless filtering by favorites/watchlist)
      if (!showFavorites && !showWatchlist) {
        const aIsFavorite = favoritesSet.has(favKey(a));
        const bIsFavorite = favoritesSet.has(favKey(b));

        if (aIsFavorite && !bIsFavorite) return -1;
        if (!aIsFavorite && bIsFavorite) return 1;
      }

      // Apply sorting based on sortBy
      switch (sortBy) {
        case 'volume':
          return (b.volume24h || 0) - (a.volume24h || 0);
        case 'price':
          return (b.price || b.index || 0) - (a.price || a.index || 0);
        case 'change':
          return (b.change24h || 0) - (a.change24h || 0);
        case 'name':
          const aName = (a.base || a.symbol || '').toUpperCase();
          const bName = (b.base || b.symbol || '').toUpperCase();
          return aName.localeCompare(bName);
        default:
          return (b.volume24h || 0) - (a.volume24h || 0);
      }
    });

    return markets;
  }, [filteredMarkets, favoritesSet, sortBy, showFavorites, showWatchlist]);

  const formatPrice = useCallback(
    (price) => formatPriceUtil(price, { marketType: 'indices' }),
    []
  );

  return (
    <div className="marketsList">
      <IndicesTable
        markets={sortedMarkets}
        onMarketClick={onMarketClick}
        formatPrice={formatPrice}
        favoritesSet={favoritesSet}
        watchlistSet={watchlistSet}
        itemKey={itemKey}
        onToggleFavorite={onToggleFavorite}
        onToggleWatchlist={onToggleWatchlist}
      />
      {indicesConnected && sortedMarkets.length === 0 && indicesTradesData && indicesTradesData.length > 0 && (
        <div className="noMarkets">
          <p>Processing indices data...</p>
        </div>
      )}
      {!indicesConnected && sortedMarkets.length === 0 && (
        <div className="noMarkets">
          <p>Waiting for Indices WebSocket connection...</p>
        </div>
      )}
      {indicesConnected && sortedMarkets.length === 0 && (!indicesTradesData || indicesTradesData.length === 0) && (
        <div className="noMarkets">
          <p>No indices data available</p>
        </div>
      )}
    </div>
  );
};

export default IndicesMarkets;


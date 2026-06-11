import { useMemo, useCallback } from 'react';
import { useAvaxTradesWebSocket } from '../../hooks/useAvaxTradesWebSocket';
import { normalizeSymbol } from '../../services/favouritesWishlistApi';
import { formatPrice as formatPriceUtil } from '../../utils/helper';
import MetalsTable from './MetalsTable';

const defaultItemKey = (name, type) =>
  `${String(name || '').trim()}|${String(type || 'crypto').trim()}`;

const MetalsMarkets = ({ 
  searchQuery, 
  favoritesSet, 
  watchlistSet,
  itemKey: itemKeyProp,
  onToggleFavorite, 
  onToggleWatchlist,
  onMarketClick,
  showFavorites = false,
  showWatchlist = false,
  sortBy = 'volume',
  allowedSymbols,
}) => {
  const itemKey = typeof itemKeyProp === 'function' ? itemKeyProp : defaultItemKey;
  const favKey = useCallback((m) => itemKey(m.id || m.symbol, m.marketType || 'metals'), [itemKey]);
  const metalsWsUrl = import.meta.env.VITE_WS_METALS_URL || 'ws://206.189.120.57:5001/ws/all';
  const metalsOptions = useMemo(() => ({
    autoConnect: true,
    reconnectInterval: 1000,
    maxReconnectInterval: 30000,
    timeoutInterval: 10000,
    enableHeartbeat: false,
  }), []);

  const { tradesData: metalsTradesData, isConnected: metalsConnected, error: metalsError, connectionState: metalsState } = useAvaxTradesWebSocket(
    metalsWsUrl,
    null,
    metalsOptions
  );

  const processTradeData = useCallback((trade) => {
    if (!trade) return null;

    const rawSymbol = trade.symbol || trade.Symbol || trade.pair || trade.market || trade.instrument || trade.id || '';
    const normalizedKey = normalizeSymbol(rawSymbol);

    if (!normalizedKey) return null;

    const marketType = trade.marketType || '';
    const baseSymbol = (trade.base || normalizedKey.substring(0, 3) || '').toUpperCase();
    const symbolUpper = normalizedKey.toUpperCase();
    
    const isMetal = marketType === 'metals' ||
      symbolUpper.match(/^(XAU|XAG|XPT|XPD|GOLD|SILVER|PLATINUM|PALLADIUM)/) ||
      baseSymbol.match(/^(XAU|XAG|XPT|XPD|GOLD|SILVER|PLATINUM|PALLADIUM)/) ||
      (trade.base && ['XAU', 'XAG', 'XPT', 'XPD', 'GOLD', 'SILVER', 'PLATINUM', 'PALLADIUM'].includes(trade.base.toUpperCase())) ||
      symbolUpper.includes('GOLD') || symbolUpper.includes('SILVER') || symbolUpper.includes('PLATINUM') || symbolUpper.includes('PALLADIUM') ||
      (rawSymbol && (rawSymbol.toUpperCase().includes('GOLD') || rawSymbol.toUpperCase().includes('SILVER') || rawSymbol.toUpperCase().includes('PLATINUM') || rawSymbol.toUpperCase().includes('PALLADIUM')));

    if (!isMetal) return null;

    const price = parseFloat(trade.index || trade.price || trade.lastPrice || trade.close || trade.p || 0);
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
      marketType: 'metals',
    };
  }, []);

  const processedMetalsData = useMemo(() => {
    if (!metalsTradesData) {
      return [];
    }

    if (!Array.isArray(metalsTradesData) || metalsTradesData.length === 0) {
      return [];
    }

    const uniqueMap = new Map();
    const maxProcess = 500;
    const tradesToProcess = metalsTradesData.slice(-maxProcess);

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
  }, [metalsTradesData, processTradeData]);

  const uniqueMarketsData = processedMetalsData;

  const allowedSymbolsSet = useMemo(() => {
    if (!Array.isArray(allowedSymbols) || allowedSymbols.length === 0) return null;
    return new Set(allowedSymbols.map((s) => normalizeSymbol(s)));
  }, [allowedSymbols]);

  const filteredMarkets = useMemo(() => {
    let filtered = uniqueMarketsData;

    if (allowedSymbolsSet) {
      filtered = filtered.filter((market) => {
        const rawSymbol = market.symbol || market.id || market.instrument || market.pair || market.market || '';
        const normalizedKey = normalizeSymbol(rawSymbol);
        return normalizedKey && allowedSymbolsSet.has(normalizedKey);
      });
    }

    // Filter by favorites
    if (showFavorites) filtered = filtered.filter((m) => favoritesSet.has(favKey(m)));
    if (showWatchlist) filtered = filtered.filter((m) => watchlistSet && watchlistSet.has(favKey(m)));

    // Filter by search query
    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      filtered = filtered.filter((market) => {
        const symbolMatch = (market.symbol || '').toLowerCase().includes(lowerQuery);
        const baseMatch = (market.base || '').toLowerCase().includes(lowerQuery);
        const quoteMatch = (market.quote || '').toLowerCase().includes(lowerQuery);
        const fullSymbol = `${market.base || ''}${market.quote || ''}`.toLowerCase();
        return symbolMatch || baseMatch || quoteMatch || fullSymbol.includes(lowerQuery);
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
  }, [filteredMarkets, favoritesSet, favKey, sortBy, showFavorites, showWatchlist]);

  const formatPrice = useCallback(
    (price) => formatPriceUtil(price, { marketType: 'metals' }),
    []
  );

  return (
    <div className="marketsList">
      <MetalsTable
        markets={sortedMarkets}
        onMarketClick={onMarketClick}
        formatPrice={formatPrice}
        favoritesSet={favoritesSet}
        watchlistSet={watchlistSet}
        itemKey={itemKey}
        onToggleFavorite={onToggleFavorite}
        onToggleWatchlist={onToggleWatchlist}
      />
      {metalsConnected && sortedMarkets.length === 0 && metalsTradesData && metalsTradesData.length > 0 && (
        <div className="noMarkets">
          <p>Processing metals data...</p>
        </div>
      )}
      {!metalsConnected && sortedMarkets.length === 0 && (
        <div className="noMarkets">
          <p>Waiting for Metals WebSocket connection...</p>
        </div>
      )}
    </div>
  );
};

export default MetalsMarkets;


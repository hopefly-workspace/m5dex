import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAvaxTradesWebSocket } from '../../hooks/useAvaxTradesWebSocket';
import { normalizeSymbol } from '../../services/favouritesWishlistApi';
import { formatPrice as formatPriceUtil } from '../../utils/helper';
import CryptoTable from './CryptoTable';

const CRYPTO_POSITION_STORAGE_KEY = 'ark_crypto_positions';
const TOP_CRYPTO_PRIORITY = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP'];

const getStablePositions = () => {
  try {
    const stored = localStorage.getItem(CRYPTO_POSITION_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
};

const saveStablePositions = (positions) => {
  try {
    localStorage.setItem(CRYPTO_POSITION_STORAGE_KEY, JSON.stringify(positions));
  } catch {
    return;
  }
};

const defaultItemKey = (name, type) =>
  `${String(name || '').trim()}|${String(type || 'crypto').trim()}`;

const CryptoMarkets = ({
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
  onConnectionStatusChange,
}) => {
  const itemKey = typeof itemKeyProp === 'function' ? itemKeyProp : defaultItemKey;
  const favKey = useCallback((m) => itemKey(m.id || m.symbol, m.marketType || 'crypto'), [itemKey]);
  const avaxTradesUrl = import.meta.env.VITE_WS_AVAX_TRADES_URL || 'ws://206.189.120.57:8000/ws/all';
  const avaxTradesOptions = useMemo(() => ({
    autoConnect: true,
    reconnectInterval: 1000,
    maxReconnectInterval: 30000,
    timeoutInterval: 10000,
    enableHeartbeat: false,
  }), []);

  const { tradesData: avaxTradesData, isConnected: avaxTradesConnected, error: avaxTradesError, connectionState: avaxTradesState } = useAvaxTradesWebSocket(
    avaxTradesUrl,
    null,
    avaxTradesOptions
  );

  useEffect(() => {
    onConnectionStatusChange?.({
      market: 'crypto',
      isConnected: Boolean(avaxTradesConnected),
      connectionState: avaxTradesState || (avaxTradesConnected ? 'CONNECTED' : 'DISCONNECTED'),
      error: avaxTradesError || null,
      label: 'Crypto Feed',
    });
  }, [onConnectionStatusChange, avaxTradesConnected, avaxTradesState, avaxTradesError]);

  const positionTrackerRef = useRef(getStablePositions());
  const nextPositionRef = useRef(Object.keys(positionTrackerRef.current).length + TOP_CRYPTO_PRIORITY.length);

  const getStablePosition = useCallback((symbol) => {
    if (!symbol) return 9999;
    const key = String(symbol).toUpperCase().trim();

    if (!positionTrackerRef.current[key]) {
      positionTrackerRef.current[key] = nextPositionRef.current++;
      if (nextPositionRef.current % 10 === 0) {
        saveStablePositions(positionTrackerRef.current);
      }
    }

    return positionTrackerRef.current[key];
  }, []);

  const processTradeData = useCallback((trade) => {
    if (!trade) return null;

    const rawSymbol = trade.symbol || trade.Symbol || trade.pair || trade.market || trade.instrument || trade.id || '';
    const normalizedKey = normalizeSymbol(rawSymbol);

    if (!normalizedKey) return null;

    const price = parseFloat(trade.index);
    const ask = parseFloat(trade.ask || trade.a || price || 0);
    const bid = parseFloat(trade.bid || trade.b || price || 0);
    const volume = parseFloat(trade.volume || trade.vol || trade.volume24h || 0);
    const change = parseFloat(trade.change || trade.change24h || trade.priceChangePercent || 0);
    const high = parseFloat(trade.high || trade.high24h || trade.h || price || 0);
    const low = parseFloat(trade.low || trade.low24h || trade.l || price || 0);

    let base = trade.base || '';
    let quote = trade.quote || 'USD';

    if (!base && normalizedKey.length >= 6) {
      if (normalizedKey.includes('USDT') || normalizedKey.includes('USD')) {
        const usdIndex = normalizedKey.indexOf('USDT') !== -1 ? normalizedKey.indexOf('USDT') : normalizedKey.indexOf('USD');
        base = normalizedKey.substring(0, usdIndex);
        quote = normalizedKey.substring(usdIndex);
      } else {
        base = normalizedKey.substring(0, 3);
        quote = normalizedKey.substring(3);
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
      marketType: 'crypto',
    };
  }, []);

  const allowedSymbolsSet = useMemo(() => {
    if (!Array.isArray(allowedSymbols)) return null;
    return new Set(allowedSymbols.map((s) => normalizeSymbol(s)));
  }, [allowedSymbols]);

  const processedAvaxTradesData = useMemo(() => {
    if (!avaxTradesData || !Array.isArray(avaxTradesData) || avaxTradesData.length === 0) {
      return [];
    }

    const uniqueMap = new Map();
    const maxProcess = 300;
    const tradesToProcess = avaxTradesData.slice(-maxProcess);

    for (let i = 0; i < tradesToProcess.length; i++) {
      const trade = tradesToProcess[i];
      let tradeData = trade;

      if (trade.data) {
        tradeData = trade.data;
      } else if (Array.isArray(trade)) {
        const maxNested = Math.min(trade.length, 10);
        for (let j = 0; j < maxNested; j++) {
          const processed = processTradeData(trade[j]);
          if (processed) {
            const key = processed.id;
            const existing = uniqueMap.get(key);
            if (!existing || (processed.lastUpdate > (existing.lastUpdate || 0))) {
              uniqueMap.set(key, processed);
            }
          }
        }
        continue;
      }

      const processed = processTradeData(tradeData);
      if (processed) {
        const key = processed.id;

        if (allowedSymbolsSet && !allowedSymbolsSet.has(key)) {
          continue;
        }

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

    return Array.from(uniqueMap.values());
  }, [avaxTradesData, processTradeData, allowedSymbolsSet]);

  const filteredMarkets = useMemo(() => {
    let filtered = processedAvaxTradesData;

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
  }, [processedAvaxTradesData, searchQuery, showFavorites, showWatchlist, favoritesSet, watchlistSet, favKey]);

  useEffect(() => {
    if (filteredMarkets.length > 0) {
      filteredMarkets.forEach((market) => {
        const symbol = market.id || market.symbol;
        if (symbol) {
          getStablePosition(symbol);
        }
      });
      saveStablePositions(positionTrackerRef.current);
    }
  }, [filteredMarkets.length, getStablePosition, filteredMarkets]);

  const sortedMarkets = useMemo(() => {
    const markets = [...filteredMarkets];
    if (markets.length === 0) return markets;

    // Apply sorting based on sortBy
    return markets.sort((a, b) => {
      switch (sortBy) {
        case 'volume':
          return (b.volume24h || 0) - (a.volume24h || 0);
        case 'price':
          return (b.price || b.index || 0) - (a.price || a.index || 0);
        case 'change':
          return (b.change24h || 0) - (a.change24h || 0);
        case 'name': {
          const aName = (a.base || a.symbol || '').toUpperCase();
          const bName = (b.base || b.symbol || '').toUpperCase();
          return aName.localeCompare(bName);
        }
        default:
          return 0;
      }
    });
  }, [filteredMarkets, sortBy]);

  const formatPrice = useCallback(
    (price) => formatPriceUtil(price, { marketType: 'crypto' }),
    []
  );

  const isLoading = !avaxTradesConnected || (avaxTradesConnected && sortedMarkets.length === 0);

  return (
    <div className="marketsList">
      <CryptoTable
        markets={sortedMarkets}
        loading={isLoading}
        onMarketClick={onMarketClick}
        formatPrice={formatPrice}
        favoritesSet={favoritesSet}
        watchlistSet={watchlistSet}
        itemKey={itemKey}
        onToggleFavorite={onToggleFavorite}
        onToggleWatchlist={onToggleWatchlist}
      />
      {!avaxTradesConnected && sortedMarkets.length === 0 && (
        <div className="noMarkets">
          <p>Waiting for AVAX Trades WebSocket connection...</p>
        </div>
      )}
    </div>
  );
};

export default CryptoMarkets;


import { useMemo, useCallback, useEffect } from 'react';
import { useMarketWebSocket } from '../../hooks/useMarketWebSocket';
import { useAvaxTradesWebSocket } from '../../hooks/useAvaxTradesWebSocket';
import { normalizeSymbol, isForexGroupType } from '../../services/favouritesWishlistApi';
import { formatPrice as formatPriceUtil } from '../../utils/helper';
import ForexTable from './ForexTable';

const defaultItemKey = (name, type) =>
  `${String(name || '').trim()}|${String(type || 'crypto').trim()}`;

const AVAX_WS_OPTIONS = {
  autoConnect: true,
  reconnectInterval: 1000,
  maxReconnectInterval: 30000,
  timeoutInterval: 10000,
  enableHeartbeat: false,
};

function mergeRow(into, row) {
  if (!into || (row.lastUpdate && row.lastUpdate > (into.lastUpdate || 0))) return { ...row, marketType: 'forex' };
  return into;
}

/** Metals + commodities from the dedicated stream → unified as forex rows. */
function processMetalsOrCommodityTrade(trade) {
  if (!trade) return null;

  const rawSymbol =
    trade.symbol || trade.Symbol || trade.pair || trade.market || trade.instrument || trade.id || '';
  const normalizedKey = normalizeSymbol(rawSymbol);
  if (!normalizedKey) return null;

  const marketType = String(trade.marketType || '').toLowerCase();
  const baseSymbol = (trade.base || normalizedKey.substring(0, 3) || '').toUpperCase();
  const symbolUpper = normalizedKey.toUpperCase();
  const rawUp = String(rawSymbol || '').toUpperCase();

  const isMetal =
    marketType === 'metals' ||
    symbolUpper.match(
      /^(XAU|XAG|XPT|XPD|GOLD|SILVER|PLATINUM|PALLADIUM)/
    ) ||
    baseSymbol.match(/^(XAU|XAG|XPT|XPD|GOLD|SILVER|PLATINUM|PALLADIUM)/) ||
    (trade.base &&
      ['XAU', 'XAG', 'XPT', 'XPD', 'GOLD', 'SILVER', 'PLATINUM', 'PALLADIUM'].includes(
        trade.base.toUpperCase()
      )) ||
    symbolUpper.includes('GOLD') ||
    symbolUpper.includes('SILVER') ||
    symbolUpper.includes('PLATINUM') ||
    symbolUpper.includes('PALLADIUM') ||
    rawUp.includes('GOLD') ||
    rawUp.includes('SILVER') ||
    rawUp.includes('PLATINUM') ||
    rawUp.includes('PALLADIUM');

  const isCommodity =
    marketType === 'commodities' ||
    /WTI|BRENT|CRUDE|OIL|NATGAS|NGAS|COPPER|ALUMINUM|ZINC|NICKEL|LEAD|GASOLINE|HEATING/i.test(
      symbolUpper + rawUp
    );

  if (!isMetal && !isCommodity) return null;

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
    price,
    index: price,
    ask,
    bid,
    change24h: change,
    volume24h: volume,
    high24h: high,
    low24h: low,
    lastUpdate: trade.timestamp || trade.time || trade.T || Date.now(),
    marketType: 'forex',
  };
}

/** Global indices stream → shown under forex. */
function processIndicesTrade(trade) {
  if (!trade) return null;

  const rawSymbol =
    trade.symbol || trade.Symbol || trade.pair || trade.market || trade.instrument || trade.id || '';
  const normalizedKey = normalizeSymbol(rawSymbol);
  if (!normalizedKey) return null;

  const marketType = String(trade.marketType || '').toLowerCase();
  const baseSymbol = (trade.base || normalizedKey.substring(0, 3) || '').toUpperCase();
  const symbolUpper = normalizedKey.toUpperCase();

  const indexPatterns = [
    'SPX',
    'DJI',
    'NDX',
    'FTSE',
    'DAX',
    'NIKKEI',
    'CAC',
    'ASX',
    'HSI',
    'SSE',
    'NIFTY',
    'SENSEX',
    'IBEX',
    'AEX',
    'OMX',
    'SP500',
    'DOW',
    'NASDAQ',
    'RUSSELL',
    'VIX',
    'WILSHIRE',
    'MSCI',
    'FTSE100',
    'DAX30',
    'CAC40',
    'N225',
    'HANG',
    'SHANGHAI',
    'SHENZHEN',
    'BSE',
    'NSE',
    'KOSPI',
    'TSX',
    'ASX200',
    'STOXX',
    'EUROSTOXX',
  ];

  const isIndex =
    marketType === 'indices' ||
    symbolUpper.match(
      /^(SPX|DJI|NDX|FTSE|DAX|NIKKEI|CAC|ASX|HSI|SSE|NIFTY|SENSEX|IBEX|AEX|OMX|SP500|DOW|NASDAQ|RUSSELL|VIX|WILSHIRE|MSCI|FTSE100|DAX30|CAC40|N225|HANG|SHANGHAI|SHENZHEN|BSE|NSE|KOSPI|TSX|ASX200|STOXX|EUROSTOXX)/
    ) ||
    baseSymbol.match(
      /^(SPX|DJI|NDX|FTSE|DAX|NIKKEI|CAC|ASX|HSI|SSE|NIFTY|SENSEX|IBEX|AEX|OMX|SP500|DOW|NASDAQ|RUSSELL|VIX|WILSHIRE|MSCI|FTSE100|DAX30|CAC40|N225|HANG|SHANGHAI|SHENZHEN|BSE|NSE|KOSPI|TSX|ASX200|STOXX|EUROSTOXX)/
    ) ||
    (trade.base && indexPatterns.includes(trade.base.toUpperCase())) ||
    symbolUpper.includes('INDEX') ||
    symbolUpper.includes('INDX') ||
    String(rawSymbol || '')
      .toUpperCase()
      .includes('INDEX') ||
    String(rawSymbol || '')
      .toUpperCase()
      .includes('INDX');

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
    price,
    index: price,
    ask,
    bid,
    change24h: change,
    volume24h: volume,
    high24h: high,
    low24h: low,
    lastUpdate: trade.timestamp || trade.time || trade.T || Date.now(),
    marketType: 'forex',
  };
}

function tradesArrayToForexRows(trades, processor) {
  if (!Array.isArray(trades) || trades.length === 0) return [];
  const uniqueMap = new Map();
  const maxProcess = 500;
  const slice = trades.slice(-maxProcess);
  for (let i = 0; i < slice.length; i++) {
    const row = processor(slice[i]);
    if (!row) continue;
    const key = row.id;
    const existing = uniqueMap.get(key);
    uniqueMap.set(key, mergeRow(existing, row));
  }
  return Array.from(uniqueMap.values());
}

const ForexMarkets = ({
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
  /** When set, legacy favourites (metals/commodities/indices) match as forex for stars / filters. */
  favouritesList = null,
  watchlistList = null,
  onConnectionStatusChange,
}) => {
  const itemKey = typeof itemKeyProp === 'function' ? itemKeyProp : defaultItemKey;
  const favKey = useCallback((m) => itemKey(m.id || m.symbol, 'forex'), [itemKey]);

  const effectiveFavoritesSet = useMemo(() => {
    if (!Array.isArray(favouritesList) || favouritesList.length === 0) return favoritesSet;
    const s = new Set(favoritesSet);
    for (const { name, type } of favouritesList) {
      if (isForexGroupType(type)) s.add(itemKey(normalizeSymbol(name), 'forex'));
    }
    return s;
  }, [favoritesSet, favouritesList, itemKey]);

  const effectiveWatchlistSet = useMemo(() => {
    if (!Array.isArray(watchlistList) || watchlistList.length === 0) return watchlistSet;
    const s = new Set(watchlistSet || []);
    for (const { name, type } of watchlistList) {
      if (isForexGroupType(type)) s.add(itemKey(normalizeSymbol(name), 'forex'));
    }
    return s;
  }, [watchlistSet, watchlistList, itemKey]);

  const wsUrl = import.meta.env.VITE_WS_URL;
  const isDirectStream = wsUrl.includes('/ws/') && wsUrl.split('/ws/').length > 1;

  const { marketData, isConnected: forexWsConnected } = useMarketWebSocket([], null, {
    autoSubscribe: !isDirectStream,
  });

  const metalsWsUrl = import.meta.env.VITE_WS_METALS_URL || 'ws://206.189.120.57:5001/ws/all';
  const indicesWsUrl = import.meta.env.VITE_WS_INDICES_URL || 'ws://206.189.120.57:5001/ws/all';

  const {
    tradesData: metalsTradesData,
    isConnected: metalsConnected,
    error: metalsError,
    connectionState: metalsState,
  } = useAvaxTradesWebSocket(
    metalsWsUrl,
    null,
    AVAX_WS_OPTIONS
  );
  const {
    tradesData: indicesTradesData,
    isConnected: indicesConnected,
    error: indicesError,
    connectionState: indicesState,
  } = useAvaxTradesWebSocket(
    indicesWsUrl,
    null,
    AVAX_WS_OPTIONS
  );

  const metalsRows = useMemo(
    () => tradesArrayToForexRows(metalsTradesData, processMetalsOrCommodityTrade),
    [metalsTradesData]
  );
  const indicesRows = useMemo(
    () => tradesArrayToForexRows(indicesTradesData, processIndicesTrade),
    [indicesTradesData]
  );

  const allowedSymbolsSet = useMemo(() => {
    if (!Array.isArray(allowedSymbols)) return null;
    return new Set(allowedSymbols.map((s) => normalizeSymbol(s)));
  }, [allowedSymbols]);

  const uniqueMarketsData = useMemo(() => {
    const uniqueMap = new Map();

    // 

    // if (allowedSymbolsSet) {
    //   for (const sym of allowedSymbolsSet) {
    //     uniqueMap.set(sym, {
    //       id: sym,
    //       symbol: sym,
    //       base: sym.length >= 6 ? sym.substring(0, 3) : sym,
    //       quote: sym.length >= 6 ? sym.substring(3) : 'USD',
    //       price: 0,
    //       index: 0,
    //       ask: 0,
    //       bid: 0,
    //       change24h: 0,
    //       volume24h: 0,
    //       high24h: 0,
    //       low24h: 0,
    //       lastUpdate: 0,
    //       marketType: 'forex',
    //     });
    //   }
    // }

    if (marketData && marketData.size > 0) {
      for (const market of marketData.values()) {
        const rawSymbol =
          market.symbol || market.Symbol || market.id || market.instrument || market.pair || market.market || '';
        const normalizedKey = normalizeSymbol(rawSymbol);
        if (!normalizedKey) continue;
        const mt = market.marketType || 'forex';
        if (mt !== 'forex') continue;
        if (allowedSymbolsSet && !allowedSymbolsSet.has(normalizedKey)) continue;

        const existing = uniqueMap.get(normalizedKey);
        const row = {
          ...market,
          id: normalizedKey,
          symbol: market.symbol || rawSymbol,
          base: market.base || normalizedKey.substring(0, 3) || 'XXX',
          quote: market.quote || normalizedKey.substring(3) || 'USD',
          price: market.price || market.index || 0,
          index: market.index || market.price || 0,
          ask: market.ask || market.price || 0,
          bid: market.bid || market.price || 0,
          change24h: market.change24h || 0,
          volume24h: market.volume24h || 0,
          high24h: market.high24h || 0,
          low24h: market.low24h || 0,
          lastUpdate: market.lastUpdate || Date.now(),
          marketType: 'forex',
        };
        uniqueMap.set(normalizedKey, mergeRow(existing, row));
      }
    }

    const mergeList = (list) => {
      for (const row of list) {
        const key = row.id;
        if (allowedSymbolsSet && !allowedSymbolsSet.has(key)) continue;
        const existing = uniqueMap.get(key);
        uniqueMap.set(key, mergeRow(existing, row));
      }
    };

    mergeList(metalsRows);
    mergeList(indicesRows);

    return Array.from(uniqueMap.values());
  }, [marketData, allowedSymbolsSet, metalsRows, indicesRows]);

  const filteredMarkets = useMemo(() => {
    let filtered = uniqueMarketsData;

    if (showFavorites) filtered = filtered.filter((m) => effectiveFavoritesSet.has(favKey(m)));
    if (showWatchlist) filtered = filtered.filter((m) => effectiveWatchlistSet && effectiveWatchlistSet.has(favKey(m)));

    const query = (searchQuery || '').trim();
    if (query) {
      const lowerQuery = query.toLowerCase();
      const normalizedQuery = lowerQuery.replace(/[\s\/\-_.]/g, '');
      filtered = filtered.filter((market) => {
        const sym = (market.symbol || market.id || '').toLowerCase();
        const base = (market.base || '').toLowerCase();
        const quote = (market.quote || '').toLowerCase();
        const fullSymbol = `${base}${quote}`;
        const symNorm = sym.replace(/[\s\/\-_.]/g, '');
        return (
          sym.includes(lowerQuery) ||
          symNorm.includes(normalizedQuery) ||
          base.includes(lowerQuery) ||
          quote.includes(lowerQuery) ||
          fullSymbol.includes(normalizedQuery) ||
          fullSymbol.includes(lowerQuery)
        );
      });
    }

    return filtered;
  }, [
    uniqueMarketsData,
    searchQuery,
    showFavorites,
    showWatchlist,
    effectiveFavoritesSet,
    effectiveWatchlistSet,
    favKey,
  ]);

  const sortedMarkets = useMemo(() => {
    const markets = [...filteredMarkets];
    if (markets.length === 0) return markets;

    markets.sort((a, b) => {
      if (!showFavorites && !showWatchlist) {
        const aIsFavorite = effectiveFavoritesSet.has(favKey(a));
        const bIsFavorite = effectiveFavoritesSet.has(favKey(b));
        if (aIsFavorite && !bIsFavorite) return -1;
        if (!aIsFavorite && bIsFavorite) return 1;
      }

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
          return (b.volume24h || 0) - (a.volume24h || 0);
      }
    });

    return markets;
  }, [filteredMarkets, effectiveFavoritesSet, sortBy, showFavorites, showWatchlist, favKey]);

  const formatPrice = useCallback((price) => formatPriceUtil(price, { marketType: 'forex' }), []);

  const anyConnected = forexWsConnected || metalsConnected || indicesConnected;

  useEffect(() => {
    const anyReconnecting =
      metalsState === 'RECONNECTING' ||
      indicesState === 'RECONNECTING';
    const anyConnecting =
      metalsState === 'CONNECTING' ||
      indicesState === 'CONNECTING';
    const derivedState = anyConnected
      ? 'CONNECTED'
      : anyReconnecting
        ? 'RECONNECTING'
        : anyConnecting
          ? 'CONNECTING'
          : 'DISCONNECTED';

    onConnectionStatusChange?.({
      market: 'forex',
      isConnected: Boolean(anyConnected),
      connectionState: derivedState,
      error: metalsError || indicesError || null,
      label: 'Forex Feed',
    });
  }, [
    onConnectionStatusChange,
    anyConnected,
    metalsState,
    indicesState,
    metalsError,
    indicesError,
  ]);

  return (
    <div className="marketsList">
      <ForexTable
        markets={sortedMarkets}
        onMarketClick={onMarketClick}
        formatPrice={formatPrice}
        favoritesSet={effectiveFavoritesSet}
        watchlistSet={effectiveWatchlistSet}
        itemKey={itemKey}
        onToggleFavorite={onToggleFavorite}
        onToggleWatchlist={onToggleWatchlist}
      />
      {!anyConnected && sortedMarkets.length === 0 && (
        <div className="noMarkets">
          <p>Waiting for Forex WebSocket connection...</p>
        </div>
      )}
    </div>
  );
};

export default ForexMarkets;

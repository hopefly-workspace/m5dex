import { useMemo, useCallback, useEffect, useRef, useState } from 'react';
import { useAvaxTradesWebSocket } from '../../hooks/useAvaxTradesWebSocket';
import { normalizeSymbol, parseIndiaFavouriteName } from '../../services/favouritesWishlistApi';
import { formatPrice as formatPriceUtil } from '../../utils/helper';
import IndiaTable from './IndiaTable';

const defaultItemKey = (name, type) =>
  `${String(name || '').trim()}|${String(type || 'crypto').trim()}`;

const normalizeMarketText = (value) =>
  String(value || '')
    .toUpperCase()
    .trim()
    .replace(/[:/\-\s_.]/g, '');

const formatIndiaDisplayName = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const noExchange = raw.includes(':') ? raw.split(':').slice(1).join(':').trim() : raw;
  if (!noExchange) return '';
  if (noExchange.includes(' ')) return noExchange;
  return noExchange
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Za-z])(\d)/g, '$1 $2')
    .replace(/(\d)([A-Za-z])/g, '$1 $2')
    .replace(/(CE|PE|FUT)$/i, ' $1')
    .replace(/\s+/g, ' ')
    .trim();
};

const normalizeIndiaSymbolVariants = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return { withExchange: '', noExchange: '' };
  const withExchange = normalizeMarketText(raw);
  let noExchange = '';
  if (raw.includes(':')) {
    const afterColon = raw.split(':').slice(1).join(':').trim();
    noExchange = normalizeMarketText(afterColon);
  }
  return { withExchange, noExchange };
};

const IndiaMarkets = ({
  searchQuery,
  stockList = [],
  favouritesList,
  watchlistList,
  favoritesSet,
  watchlistSet,
  itemKey: itemKeyProp,
  onToggleFavorite,
  onToggleWatchlist,
  onMarketClick,
  showFavorites = false,
  showWatchlist = false,
  sortBy = 'volume',
  onConnectionStatusChange,
}) => {
  const itemKey = typeof itemKeyProp === 'function' ? itemKeyProp : defaultItemKey;
  const favKey = useCallback((m) => itemKey(m.symbol || m.id, m.marketType || 'india'), [itemKey]);
  const indiaWsUrl = import.meta.env.VITE_WS_INDIA_URL;
  const indiaOptions = useMemo(
    () => ({
      autoConnect: true,
      reconnectInterval: 1000,
      maxReconnectInterval: 30000,
      timeoutInterval: 10000,
      enableHeartbeat: false,
      // India list is driven by the onUpdate callback + local map; hook state is unused here.
      maxItems: 5000,
    }),
    []
  );

  const processTradeData = useCallback((trade) => {
    if (!trade || typeof trade !== 'object') return null;

    const toNum = (v, fallback = 0) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : fallback;
    };

    // Server payloads are inconsistent (CE ticks often differ from PE ticks in field names),
    // so we extract symbol from multiple possible keys to keep favorites matching stable.
    const rawInstrument = trade.instrument;
    const instrumentStr =
      typeof rawInstrument === 'string' && String(rawInstrument).trim() !== ''
        ? String(rawInstrument).trim()
        : '';

    const rawSymbol =
      trade.symbol ||
      trade.Symbol ||
      trade.pairsymbol ||
      trade.pairSymbol ||
      trade.pairSymbolDisplay ||
      trade.tradingsymbol ||
      trade.tradingSymbol ||
      trade.trading_symbol ||
      trade.instrument_symbol ||
      trade.instrumentSymbol ||
      trade.instrument_name ||
      trade.instrumentName ||
      trade.instrumentNameDisplay ||
      trade.pair ||
      trade.market ||
      instrumentStr ||
      trade.name ||
      trade.base ||
      '';

    const idRaw = trade.id;
    const idLooksNumeric =
      idRaw != null &&
      idRaw !== '' &&
      (typeof idRaw === 'number' ||
        (typeof idRaw === 'string' && /^\d+$/.test(String(idRaw).trim())));

    const pairIdToken =
      trade.pairid ??
      trade.pairId ??
      trade.instrument_token ??
      trade.instrumentToken ??
      trade.token ??
      (idLooksNumeric ? idRaw : '') ??
      '';

    // Use extracted symbol for stable id + matching; fall back to base/name handled below.
    const normalizedKey = normalizeSymbol(rawSymbol);

    // Example: "MCX:GOLD26APR" -> exchange="MCX", pairSymbol="GOLD26APR"
    const extractExchangeAndPairSymbol = (sym) => {
      const s = String(sym || '').trim();
      if (!s) return { exchange: '', pairSymbol: '' };
      if (s.includes(':')) {
        const parts = s.split(':');
        const exchange = String(parts[0] || '').trim();
        const pairSymbol = parts.slice(1).join(':').trim();
        return { exchange, pairSymbol };
      }
      return { exchange: '', pairSymbol: s };
    };

    const exchangeFromPayload =
      String(trade.exchange || trade.Exchange || trade.exch || trade.marketExchange || '').trim();

    const { exchange: exchangeFromSymbol, pairSymbol } = extractExchangeAndPairSymbol(rawSymbol);
    const exchange = exchangeFromPayload || exchangeFromSymbol || '';

    const price = toNum(trade.ltp ?? trade.index ?? trade.price ?? trade.lastPrice ?? trade.close ?? trade.p, 0);
    // const ask = toNum(trade.ask ?? trade.a ?? price, price);
    // const bid = toNum(trade.bid ?? trade.b ?? price, price);
    // const high = toNum(trade.high ?? trade.high24h ?? trade.h, 0);
    // const low = toNum(trade.low ?? trade.low24h ?? trade.l, 0);

    const rawAsk = toNum(trade.ask ?? trade.a ?? trade.askPrice ?? trade.best_ask ?? trade.bestAsk, 0);
    const rawBid = toNum(trade.bid ?? trade.b ?? trade.bidPrice ?? trade.best_bid ?? trade.bestBid, 0);
    const ask = rawAsk > 0 ? rawAsk : price > 0 ? price : 0;
    const bid = rawBid > 0 ? rawBid : price > 0 ? price : 0;
    const volume = toNum(trade.volume ?? trade.vol ?? trade.volume24h, 0);
    const change = toNum(
      trade.change_pct ?? trade.change24h ?? trade.priceChangePercent ?? trade.change,
      0
    );
    const rawHigh = toNum(trade.high ?? trade.high24h ?? trade.h, 0);
    const rawLow = toNum(trade.low ?? trade.low24h ?? trade.l, 0);
    const high = rawHigh > 0 ? rawHigh : price > 0 ? price : 0;
    const low = rawLow > 0 ? rawLow : price > 0 ? price : 0;

    const baseCandidate =
      trade.name ||
      trade.base ||
      trade.description ||
      trade.pairSymbol ||
      trade.pairsymbol ||
      trade.tradingsymbol ||
      trade.tradingSymbol ||
      rawSymbol;
    const quoteCandidate = trade.quote || trade.currency || 'INR';

    const base = formatIndiaDisplayName(baseCandidate) || 'INDIA';
    const quote = String(quoteCandidate || 'INR').trim() || 'INR';

    const pairIdStr =
      pairIdToken !== '' && pairIdToken != null ? String(pairIdToken).trim() : '';

    const stableId =
      normalizedKey ||
      (pairSymbol ? normalizeSymbol(pairSymbol) : '') ||
      (pairIdStr ? `INDIA_${pairIdStr}` : '') ||
      normalizeSymbol(base) ||
      `${base}_${quote}`;

    const tsNum = toNum(trade.timestamp ?? trade.time ?? trade.T, 0);
    const lastUpdate = tsNum > 0 ? tsNum : Date.now();

    return {
      id: stableId,
      pairid: pairIdStr || undefined,
      pairId: pairIdStr || undefined,
      instrument_token: pairIdStr || undefined,
      symbol: rawSymbol || pairSymbol || stableId || base,
      base: base,
      quote: quote,
      // Keep a human readable description for UI.
      description:
        formatIndiaDisplayName(trade.name || trade.description || rawSymbol || pairSymbol) ||
        normalizedKey ||
        `${base}${quote}`,
      exchange,
      pairSymbol: pairSymbol || rawSymbol || base,
      price,
      index: price,
      ask,
      bid,
      change24h: change,
      volume24h: volume,
      high24h: high,
      low24h: low,
      lastUpdate,
      marketType: 'india',
    };
  }, []);

  const fullMarketsMapRef = useRef(new Map());
  const [uniqueMarketsData, setUniqueMarketsData] = useState([]);
  const rafPublishRef = useRef(null);
  const publishQueuedRef = useRef(false);

  const flushPublish = useCallback(() => {
    publishQueuedRef.current = false;
    rafPublishRef.current = null;
    setUniqueMarketsData(Array.from(fullMarketsMapRef.current.values()));
  }, []);

  const schedulePublish = useCallback(() => {
    if (publishQueuedRef.current) return;
    publishQueuedRef.current = true;
    if (typeof requestAnimationFrame === 'function') {
      rafPublishRef.current = requestAnimationFrame(flushPublish);
    } else {
      rafPublishRef.current = setTimeout(flushPublish, 16);
    }
  }, [flushPublish]);

  const handleIndiaTradesUpdate = useCallback((incoming) => {
    if (!incoming) return;

    let dataArray = incoming;
    if (!Array.isArray(incoming)) {
      if (incoming.ticks && Array.isArray(incoming.ticks)) {
        dataArray = incoming.ticks;
      } else if (incoming.data?.ticks && Array.isArray(incoming.data.ticks)) {
        dataArray = incoming.data.ticks;
      } else if (incoming.data && Array.isArray(incoming.data)) {
        dataArray = incoming.data;
      } else if (incoming.results && Array.isArray(incoming.results)) {
        dataArray = incoming.results;
      } else if (typeof incoming === 'object') {
        dataArray = [incoming];
      } else {
        return;
      }
    }

    if (!dataArray || dataArray.length === 0) return;

    const map = fullMarketsMapRef.current;
    let changed = false;

    // Keep per-message work bounded for smoother UI updates.
    const MAX_BATCH = 1200;
    const tradesToProcess = dataArray.slice(-MAX_BATCH);

    for (let i = 0; i < tradesToProcess.length; i++) {
      const trade = tradesToProcess[i];
      if (!trade || typeof trade !== 'object') continue;

      const tradeData =
        trade.data && typeof trade.data === 'object' && !Array.isArray(trade.data)
          ? { ...trade, ...trade.data }
          : trade;

      const processed = processTradeData(tradeData);
      if (!processed) continue;

      const pid = String(processed.pairid ?? processed.pairId ?? '').trim();
      const key = pid ? `pid:${pid}` : processed.id;
      const existing = map.get(key);
      if (!existing || processed.lastUpdate >= (existing.lastUpdate || 0)) {
        const merged = existing ? { ...existing, ...processed } : processed;
        if (existing) {
          if (existing.symbol && !/^\d+$/.test(existing.symbol) && /^\d+$/.test(processed.symbol)) {
            merged.symbol = existing.symbol;
          }
          if (existing.pairSymbol && !/^\d+$/.test(existing.pairSymbol) && /^\d+$/.test(processed.pairSymbol)) {
            merged.pairSymbol = existing.pairSymbol;
          }
          if (existing.exchange && !processed.exchange) {
            merged.exchange = existing.exchange;
          }
        }
        map.set(key, merged);
        changed = true;
      }
    }

    const MAX_UNIVERSE = 80000;
    if (map.size > MAX_UNIVERSE) {
      const toRemove = map.size - MAX_UNIVERSE;
      let removed = 0;
      for (const k of map.keys()) {
        map.delete(k);
        removed++;
        if (removed >= toRemove) break;
      }
      changed = true;
    }

    if (changed) schedulePublish();
  }, [processTradeData, schedulePublish]);

  const {
    isConnected: indiaConnected,
    error: indiaError,
    connectionState: indiaState,
  } = useAvaxTradesWebSocket(
    indiaWsUrl,
    handleIndiaTradesUpdate,
    indiaOptions
  );

  useEffect(() => {
    onConnectionStatusChange?.({
      market: 'india',
      isConnected: Boolean(indiaConnected),
      connectionState: indiaState || (indiaConnected ? 'CONNECTED' : 'DISCONNECTED'),
      error: indiaError || null,
      label: 'India Feed',
    });
  }, [onConnectionStatusChange, indiaConnected, indiaState, indiaError]);

  useEffect(() => {
    return () => {
      if (rafPublishRef.current != null) {
        if (typeof cancelAnimationFrame === 'function') {
          cancelAnimationFrame(rafPublishRef.current);
        } else {
          clearTimeout(rafPublishRef.current);
        }
      }
    };
  }, []);

  const favoriteSymbolsNormalized = useMemo(() => {
    const out = new Set();
    if (!favoritesSet || typeof favoritesSet.forEach !== 'function') return out;
    favoritesSet.forEach((rawKey) => {
      const key = String(rawKey || '');
      const sep = key.lastIndexOf('|');
      const rawName = sep >= 0 ? key.slice(0, sep) : key;
      const rawType = sep >= 0 ? key.slice(sep + 1) : '';
      if (rawType && rawType.trim().toLowerCase() !== 'india') return;
      const { symbol } = parseIndiaFavouriteName(rawName);
      const { withExchange, noExchange } = normalizeIndiaSymbolVariants(symbol || rawName);
      if (withExchange) out.add(withExchange);
      if (noExchange && noExchange !== withExchange) out.add(noExchange);
    });
    return out;
  }, [favoritesSet]);

  /*
  const favoriteEntries = useMemo(() => {
    const out = [];
    if (!favoritesSet || typeof favoritesSet.forEach !== 'function') return out;
    const seenNormalized = new Set();
    favoritesSet.forEach((rawKey) => {
      const key = String(rawKey || '');
      const sep = key.lastIndexOf('|');
      const rawName = (sep >= 0 ? key.slice(0, sep) : key).trim();
      const rawType = (sep >= 0 ? key.slice(sep + 1) : '').trim().toLowerCase();
      if (!rawName) return;
      if (rawType && rawType !== 'india') return;
      const parsed = parseIndiaFavouriteName(rawName);
      const { withExchange, noExchange } = normalizeIndiaSymbolVariants(parsed.symbol || rawName);
      if (!withExchange) return;
      if (seenNormalized.has(withExchange)) return;
      seenNormalized.add(withExchange);
      out.push({
        rawName: parsed.symbol || rawName,
        normalized: withExchange,
        normalizedNoExchange: noExchange,
        pairId: String(parsed.pairId || '').trim(),
      });
    });
    return out;
  }, [favoritesSet]);
  */

  const favoriteEntries = useMemo(() => {
    const out = [];
    if (!favouritesList || !Array.isArray(favouritesList)) return out;
    const seenNormalized = new Set();
    for (const item of favouritesList) {
      const rawType = String(item.type || '').trim().toLowerCase();
      if (rawType !== 'india') continue;
      const rawName = String(item.name || '').trim();
      if (!rawName) continue;
      const parsed = parseIndiaFavouriteName(rawName);
      const { withExchange, noExchange } = normalizeIndiaSymbolVariants(parsed.symbol || rawName);
      if (!withExchange) continue;
      if (seenNormalized.has(withExchange)) continue;
      seenNormalized.add(withExchange);
      out.push({
        rawName: parsed.symbol || rawName,
        normalized: withExchange,
        normalizedNoExchange: noExchange,
        pairId: String(parsed.pairId || '').trim(),
        segment: String(item.segment || '').trim(),
      });
    }
    return out;
  }, [favouritesList]);

  const marketsToDisplay = useMemo(() => {
    const q = (searchQuery || '').trim().toLowerCase();

    let list = [];
    if (showFavorites) {
      const matchedByNormalized = new Map();
      const matchedByPairId = new Map();
      uniqueMarketsData.forEach((m) => {
        const rowPid = String(m.pairid ?? m.pairId ?? m.instrument_token ?? m.instrumentToken ?? '').trim();
        if (rowPid) {
          matchedByPairId.set(rowPid, m);
        }

        const symbolVariants = normalizeIndiaSymbolVariants(m.symbol);
        const idVariants = normalizeIndiaSymbolVariants(m.id);
        const baseVariants = normalizeIndiaSymbolVariants(m.base);
        const descVariants = normalizeIndiaSymbolVariants(m.description);

        const candidates = [
          symbolVariants.withExchange,
          symbolVariants.noExchange,
          idVariants.withExchange,
          idVariants.noExchange,
          baseVariants.withExchange,
          baseVariants.noExchange,
          descVariants.withExchange,
          descVariants.noExchange,
        ].filter(Boolean);

        for (let i = 0; i < candidates.length; i++) {
          const key = candidates[i];
          if (favoriteSymbolsNormalized.has(key) && !matchedByNormalized.has(key)) {
            matchedByNormalized.set(key, m);
          }
        }
      });

      // Always show all favorites: use live row when available, otherwise placeholder.
      list = favoriteEntries.map(({ rawName, normalized, normalizedNoExchange, pairId, segment }) => {
        let liveMatch = null;

        if (pairId && matchedByPairId.has(pairId)) {
          // return matchedByPairId.get(pairId);
          liveMatch = matchedByPairId.get(pairId);
        } else {
          liveMatch = matchedByNormalized.get(normalized) ||
            (normalizedNoExchange ? matchedByNormalized.get(normalizedNoExchange) : null);
        }

        if (liveMatch) {
          return segment ? { ...liveMatch, segment } : liveMatch;
        }

        // const live =
        //   matchedByNormalized.get(normalized) ||
        //   (normalizedNoExchange ? matchedByNormalized.get(normalizedNoExchange) : null);
        // if (live) return live;
        const s = String(rawName || '');
        const exchange = s.includes(':') ? s.split(':')[0].trim() : '';
        const pairSymbol = s.includes(':') ? s.split(':').slice(1).join(':').trim() : s;
        const readableBase = formatIndiaDisplayName(pairSymbol || rawName);
        return {
          id: normalizeSymbol(rawName) || rawName,
          symbol: rawName,
          base: readableBase || rawName,
          quote: 'INR',
          description: readableBase || rawName,
          exchange,
          pairSymbol,
          pairId: pairId || undefined,
          pairid: pairId || undefined,
          price: 0,
          index: 0,
          ask: 0,
          bid: 0,
          change24h: 0,
          volume24h: 0,
          high24h: 0,
          low24h: 0,
          lastUpdate: 0,
          marketType: 'india',
          segment,
        };
      });
    } else if (showWatchlist) {
      list = uniqueMarketsData.filter((m) => watchlistSet?.has(favKey(m)));
    } else if (q) {
      list = uniqueMarketsData;
    } else {
      list = [];
    }

    if (!q) return list;

    // Search mode: filter within the current list
    return list.filter((market) => {
      const symbol = (market.symbol || '').toLowerCase();
      const base = (market.base || '').toLowerCase();
      const quote = (market.quote || '').toLowerCase();
      const fullSymbol = `${base}${quote}`.toLowerCase();
      const id = (market.id || '').toLowerCase();
      const description = (market.description || '').toLowerCase();

      return (
        symbol.includes(q) ||
        base.includes(q) ||
        quote.includes(q) ||
        fullSymbol.includes(q) ||
        id.includes(q) ||
        description.includes(q)
      );
    });
  }, [
    uniqueMarketsData,
    searchQuery,
    favKey,
    showFavorites,
    showWatchlist,
    favoritesSet,
    favoriteEntries,
    favoriteSymbolsNormalized,
    watchlistSet,
  ]);

  const sortedMarkets = useMemo(() => {
    const markets = [...marketsToDisplay];
    if (markets.length === 0) return markets;

    markets.sort((a, b) => {
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
  }, [marketsToDisplay, sortBy]);

  const formatPrice = useCallback(
    (price) => formatPriceUtil(price, { marketType: 'india' }),
    []
  );

  const handleToggleFavorite = useCallback(
    async (name, type = 'india') => {
      return onToggleFavorite?.(name, type);
    },
    [onToggleFavorite]
  );

  const handleToggleWatchlist = useCallback(
    async (name, type = 'india') => {
      return onToggleWatchlist?.(name, type);
    },
    [onToggleWatchlist]
  );

  const segmentMap = useMemo(() => {
    const map = new Map();
    if (!Array.isArray(stockList)) return map;
    for (const item of stockList) {
      if (item.pairid) map.set(String(item.pairid).trim(), item.segment || 'Unknown Segment');
      if (item.pairsymbol) map.set(normalizeSymbol(item.pairsymbol), item.segment || 'Unknown Segment');
    }
    return map;
  }, [stockList]);

  const segmentedMarkets = useMemo(() => {
    const groups = {};
    for (const m of sortedMarkets) {
      let seg = '';
      const pid = String(m.pairid ?? m.pairId ?? m.instrument_token ?? m.instrumentToken ?? '').trim();
      const sym = String(m.symbol || m.id || m.name || '').trim().toUpperCase();
      const pairSym = String(m.pairSymbol || '').trim().toUpperCase();

      seg = String(m.segment || '').trim();

      if (!seg || seg === 'Unknown Segment' || seg === 'Other') {
        if (pid && segmentMap.has(pid)) {
          seg = segmentMap.get(pid);
        } else if (sym && segmentMap.has(normalizeSymbol(sym))) {
          seg = segmentMap.get(normalizeSymbol(sym));
        } else if (pairSym && segmentMap.has(normalizeSymbol(pairSym))) {
          seg = segmentMap.get(normalizeSymbol(pairSym));
        }
      }

      if (!seg || seg === 'Unknown Segment') {
        seg = 'Other';
      }

      if (!groups[seg]) groups[seg] = [];
      groups[seg].push(m);
    }
    return groups;
  }, [sortedMarkets, segmentMap]);

  const [collapsedSegments, setCollapsedSegments] = useState({});

  const toggleSegment = (seg) => {
    setCollapsedSegments(prev => ({
      ...prev,
      [seg]: !prev[seg]
    }));
  };


  return (
    <div className="marketsList">
      {sortedMarkets.length > 0 ? (
        Object.entries(segmentedMarkets).sort(([a], [b]) => a.localeCompare(b)).map(([segment, markets]) => {
          const isCollapsed = collapsedSegments[segment];
          return (
            <div key={segment} className="marketSegmentGroup" style={{ marginBottom: '20px', background: 'var(--bg-secondary, rgba(255, 255, 255, 0.02))', borderRadius: '8px', border: '1px solid var(--border-light, rgba(255, 255, 255, 0.05))', overflow: 'hidden' }}>
              <div
                onClick={() => toggleSegment(segment)}
                style={{ margin: 0, padding: '12px 16px', background: 'color-mix(in srgb, var(--bg-primary, #000) 95%, var(--text-primary, #fff))', color: 'var(--text-primary, #f8fafc)', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none', fontWeight: 600, borderBottom: isCollapsed ? 'none' : '1px solid var(--border-light, rgba(255, 255, 255, 0.05))' }}
              >
                <svg
                  width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
                >
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
                {segment}
              </div>
              {!isCollapsed && (
                <div style={{ padding: '0 1px' }}>
                  <IndiaTable
                    markets={markets}
                    onMarketClick={onMarketClick}
                    formatPrice={formatPrice}
                    favoritesSet={favoritesSet}
                    watchlistSet={watchlistSet}
                    itemKey={itemKey}
                    onToggleFavorite={handleToggleFavorite}
                    onToggleWatchlist={handleToggleWatchlist}
                  />
                </div>
              )}
            </div>
          );
        })
        // <IndiaTable
        //   markets={sortedMarkets}
        //   onMarketClick={onMarketClick}
        //   formatPrice={formatPrice}
        //   favoritesSet={favoritesSet}
        //   watchlistSet={watchlistSet}
        //   itemKey={itemKey}
        //   onToggleFavorite={handleToggleFavorite}
        //   onToggleWatchlist={handleToggleWatchlist}
        // />
      ) : (
        <div className="noMarkets" style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
          {searchQuery && searchQuery.trim() ? (
            <p>No results for "{searchQuery.trim()}"</p>
          ) : indiaConnected ? (
            <p>Search  or add instruments to show India markets</p>
          ) : (
            <p>Waiting for India Market WebSocket connection...</p>
          )}
        </div>
      )}
    </div>
  );
};

export default IndiaMarkets;


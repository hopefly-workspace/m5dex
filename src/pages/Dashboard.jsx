import { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAvaxTradesWebSocket } from '../hooks/useAvaxTradesWebSocket';
import { useAuth } from '../hooks/useAuth';
import { useWalletData } from '../hooks/useWalletData';
import {
  normalizeSymbol,
  parseIndiaFavouriteName,
  normalizeAppMarketTypeParam,
} from '../services/favouritesWishlistApi';
// import { findIndiaPairIdInTradeList } from '../utils/indiaPairResolve';
// import { findIndiaPairIdInTradeList, findIndiaMarketTick, indiaTickPairId, indiaTickSymbolKey } from '../utils/indiaPairResolve';
import { findIndiaPairIdInTradeList, findIndiaMarketTick, indiaTickExchange, indiaTickPairId, indiaTickSymbolKey } from '../utils/indiaPairResolve';
import { useIndiaFavouritesSubscription } from '../hooks/useIndiaFavouritesSubscription';
// import { readIndiaPairIdSessionMap } from '../services/indiaTicksSubscription';
import {
  readIndiaExchangeFromSession,
  readIndiaPairIdSessionMap,
  writeIndiaExchangeToSession,
} from '../services/indiaTicksSubscription';
import { fetchIndiaStockList, findIndiaStockItemInStockList } from '../services/indiaStockList';
import { checkTradingMarket, resolveCheckMarketSessionForDashboard } from '../services/tradingApi';
import Header from '../components/Header';
import TradingBar from '../components/TradingBar';
import FavoritesSidebar from '../components/FavoritesSidebar';
import { useFavouritesList } from '../hooks/useFavouritesList';
import OrderBook from '../components/OrderBook';
import TradingPanel from '../components/TradingPanel';
import OrdersPanel from '../components/OrdersPanel';
import '../styles/pages/Dashboard.css';

const INDIA_PAIRID_NAV_STATE_KEY = 'dashboard:indiaPairIdByMarket';
const DashboardChart = lazy(() => import('../components/DashboardTradingChart'));

const DEFAULT_PAIR = 'BTCUSDT';
const DASHBOARD_DEFAULT_TYPE = 'crypto';

const WS_BASE_BY_TYPE = {
  forex: import.meta.env.VITE_WS_FOREX_URL,
  crypto: import.meta.env.VITE_WS_CRYPTO_URL,
  indices: import.meta.env.VITE_WS_INDICES_URL,
  metals: import.meta.env.VITE_WS_METALS_URL,
  india: import.meta.env.VITE_WS_INDIA_URL,
};

const WS_OPTIONS = {
  autoConnect: true,
  reconnectInterval: 600,
  maxReconnectInterval: 15000,
  reconnectDecay: 1.3,
  timeoutInterval: 5000,
  maxReconnectAttempts: Infinity,
  enableHeartbeat: false,
  heartbeatInterval: 30000,
  heartbeatTimeout: 10000,
};

/** Normalize India tick fields (ltp vs price, etc.) for merged market lists. */
const normalizeIndiaTradesList = (list) => {
  const toNum = (v, fallback = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };
  return (list || []).map((x) => {

    const sym = x?.symbol ?? x?.Symbol ?? '';
    const symLooksNumeric =
      sym != null && sym !== '' && /^\d+$/.test(String(sym).trim());
    const pairsymbol =
      x?.pairsymbol ||
      x?.pairSymbol ||
      x?.tradingsymbol ||
      x?.tradingSymbol ||
      (symLooksNumeric ? '' : sym) ||
      '';

    const price = toNum(x?.price ?? x?.ltp ?? x?.p ?? x?.index ?? x?.last ?? x?.close, 0);
    const bidRaw = toNum(x?.bid ?? x?.b ?? x?.bidPrice ?? x?.best_bid ?? x?.bestBid, 0);
    const askRaw = toNum(x?.ask ?? x?.a ?? x?.askPrice ?? x?.best_ask ?? x?.bestAsk, 0);
    const bid = bidRaw > 0 ? bidRaw : price > 0 ? price : 0;
    const ask = askRaw > 0 ? askRaw : price > 0 ? price : 0;

    const rawHigh = toNum(x?.high ?? x?.high24h ?? x?.h, 0);
    const rawLow = toNum(x?.low ?? x?.low24h ?? x?.l, 0);
    const open = toNum(x?.open ?? x?.o, 0);
    const close = toNum(x?.close ?? x?.c, price);
    return {
      ...x,
      pairsymbol: pairsymbol || x?.pairsymbol,
      pairSymbol: pairsymbol || x?.pairSymbol,
      symbol: pairsymbol || sym,
      price,
      ltp: toNum(x?.ltp, price) || price,
      index: price,
      bid,
      ask,
      open,
      close,
      high: rawHigh > 0 ? rawHigh : price > 0 ? price : 0,
      low: rawLow > 0 ? rawLow : price > 0 ? price : 0,
      high24h: rawHigh > 0 ? rawHigh : price > 0 ? price : 0,
      low24h: rawLow > 0 ? rawLow : price > 0 ? price : 0,
      change: toNum(x?.change ?? x?.change24h ?? x?.change_pct, 0),
      change24h: toNum(x?.change24h ?? x?.change_pct ?? x?.change ?? 0, 0),
      change_pct: toNum(x?.change_pct ?? x?.change24h ?? x?.change, 0),
      volume: toNum(x?.volume ?? x?.vol ?? x?.volume24h, 0),
      volume24h: toNum(x?.volume24h ?? x?.volume ?? x?.vol ?? 0, 0),
      // high24h: toNum(x?.high24h ?? x?.high ?? 0, 0),
      // low24h: toNum(x?.low24h ?? x?.low ?? 0, 0),
    };
  });
};

const appendIndiaWsToken = (url) => {
  if (!url) return url;
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  if (!token || url.includes('token=')) return url;
  return `${url}${url.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`;
};

const LOCK_ICON = (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
  </svg>
);

const getWsBase = (type) =>
  WS_BASE_BY_TYPE[String(type || 'crypto').toLowerCase().trim()] ??
  import.meta.env.VITE_WS_AVAX_TRADES_URL ??
  WS_BASE_BY_TYPE.crypto;

const buildWsUrlAll = (type) => {
  const base = (getWsBase(type) || '').replace(/\/+$/, '');
  return base.endsWith('/all') ? base : `${base}/all`;
};

const AuthCTA = ({ variant, onClose }) => {
  const navigate = useNavigate();
  const pre = variant === 'sheet' ? 'trading-bottom-sheet-auth' : 'trading-panel-auth';

  const go = (path) => {
    onClose?.();
    navigate(path);
  };

  return (
    <div className={`${pre}-content`}>
      <div className={`${pre}-icon`}>{LOCK_ICON}</div>
      <h3 className={`${pre}-title`}>Start Trading</h3>
      <p className={`${pre}-subtitle`}>
        Login or create an account to start trading on M5dex
      </p>
      <div className={`${pre}-buttons`}>
        <button className={`${pre}-btn ${pre}-btn-primary`} onClick={() => go('/login')}>
          Login
        </button>
        <button className={`${pre}-btn ${pre}-btn-secondary`} onClick={() => go('/signup')}>
          Sign Up
        </button>
      </div>
    </div>
  );
};

const Dashboard = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated } = useAuth();
  const [marketPair, setMarketPair] = useState(() => {
    const m = searchParams.get('market');
    return m != null && String(m).trim() !== '' ? String(m).trim() : DEFAULT_PAIR;
  });
  const [marketType, setMarketType] = useState(
    () => normalizeAppMarketTypeParam(searchParams.get('type')) || DASHBOARD_DEFAULT_TYPE
  );
  const [showTradingSheet, setShowTradingSheet] = useState(false);
  const [tradingSide, setTradingSide] = useState('buy');
  const [activeBottomTab, setActiveBottomTab] = useState('chart');
  const [ordersRefreshTrigger, setOrdersRefreshTrigger] = useState(0);
  const [favoritesSidebarOpen, setFavoritesSidebarOpen] = useState(false);
  const [marketSessionOpen, setMarketSessionOpen] = useState(true);
  const [marketSessionMessage, setMarketSessionMessage] = useState('');
  const { favouritesList, favouritesLoading, refreshFavourites } = useFavouritesList();
  const { walletData, refreshWallet } = useWalletData();
  const pairIdParam = searchParams.get('pairid') || searchParams.get('pairId');
  const hiddenIndiaPairId = useMemo(() => {
    const t = String(marketType || '').trim().toLowerCase();
    if (t !== 'india') return '';
    const marketRaw = searchParams.get('market');
    const marketKey = normalizeSymbol(marketRaw);
    if (!marketKey) return '';
    try {
      const rawMap = sessionStorage.getItem(INDIA_PAIRID_NAV_STATE_KEY);
      const parsedMap = rawMap && typeof rawMap === 'string' ? JSON.parse(rawMap) : {};
      if (!parsedMap || typeof parsedMap !== 'object') return '';
      const val = parsedMap[marketKey];
      return val != null ? String(val).trim() : '';
    } catch {
      return '';
    }
  }, [marketType, searchParams]);
  const showOrderBook = !['forex', 'india'].includes(marketType);
  const chartTabClass = activeBottomTab === 'chart' ? 'mobile-full-page' : 'mobile-hidden';
  const orderbookTabClass = activeBottomTab === 'orderbook' ? 'mobile-active mobile-full-page' : 'mobile-hidden';
  const ordersTabClass = activeBottomTab === 'orders' ? 'mobile-active mobile-full-page' : 'mobile-hidden';

  const normalizedSymbol = useMemo(
    () => normalizeSymbol(marketPair) || DEFAULT_PAIR,
    [marketPair]
  );

  const pairDisplay = useMemo(() => {
    const raw = String(marketPair || '').trim();
    if (!raw) return DEFAULT_PAIR;
    if (raw.includes(':')) {
      const parts = raw.split(':');
      // exchange = parts[0], pair = rest
      const pairPart = parts.slice(1).join(':').trim();
      return pairPart || raw;
    }
    return raw;
  }, [marketPair]);

  const exchangeDisplay = useMemo(() => {
    const raw = String(marketPair || '').trim();
    if (!raw) return '';
    if (raw.includes(':')) return raw.split(':')[0].trim();
    return '';
  }, [marketPair]);

  const wsUrlCrypto = useMemo(() => buildWsUrlAll('crypto'), []);
  const wsUrlForex = useMemo(() => buildWsUrlAll('forex'), []);
  const wsUrlMetals = useMemo(() => buildWsUrlAll('metals'), []);
  const wsUrlIndices = useMemo(() => buildWsUrlAll('indices'), []);

  /**
   * Always-on India broadcast stream (same base URL as IndiaMarkets) so favorites show live prices
   * for every India pair. The per-pair URL below only carries the active chart/instrument.
   */
  const wsUrlIndiaAll = useMemo(() => {
    const raw = import.meta.env.VITE_WS_INDIA_URL;
    if (!raw) return null;
    // return String(raw).replace(/\/+$/, '');
    return appendIndiaWsToken(String(raw).replace(/\/+$/, ''));
  }, []);

  const { tradesData: tradesDataCrypto } = useAvaxTradesWebSocket(wsUrlCrypto, null, WS_OPTIONS);
  const { tradesData: tradesDataForex } = useAvaxTradesWebSocket(wsUrlForex, null, WS_OPTIONS);
  const { tradesData: tradesDataMetals } = useAvaxTradesWebSocket(wsUrlMetals, null, WS_OPTIONS);
  const { tradesData: tradesDataIndices } = useAvaxTradesWebSocket(wsUrlIndices, null, WS_OPTIONS);
  const { tradesData: tradesDataIndiaAll } = useAvaxTradesWebSocket(wsUrlIndiaAll, null, WS_OPTIONS);

  const normalizedIndiaAllTradesData = useMemo(
    () => normalizeIndiaTradesList(tradesDataIndiaAll),
    [tradesDataIndiaAll]
  );

  /** Live India broadcast → pairid for symbol; then session; then URL (never stale URL alone). */
  const indiaInstrumentPairId = useMemo(() => {
    const t = String(marketType || '').trim().toLowerCase();
    if (t !== 'india') return '';
    const fromFeed = findIndiaPairIdInTradeList(
      normalizedIndiaAllTradesData,
      normalizedSymbol
    );
    return fromFeed || hiddenIndiaPairId || String(pairIdParam || '').trim();
  }, [
    marketType,
    normalizedIndiaAllTradesData,
    normalizedSymbol,
    hiddenIndiaPairId,
    pairIdParam,
  ]);

  const pairIdForOrderApis = useMemo(() => {
    const t = String(marketType || '').trim().toLowerCase();
    if (t === 'crypto' || t === 'forex') return 0;
    return indiaInstrumentPairId;
  }, [marketType, indiaInstrumentPairId]);

  const indiaExtraPairIds = useMemo(
    () => (indiaInstrumentPairId ? [indiaInstrumentPairId] : []),
    [indiaInstrumentPairId],
  );

  const { resolvedPairIdMap } = useIndiaFavouritesSubscription({
    enabled: isAuthenticated,
    favouritesList,
    extraPairIds: indiaExtraPairIds,
  });

  const indiaFavouritesPairIdMap = useMemo(() => {
    const session = readIndiaPairIdSessionMap();
    return { ...session, ...resolvedPairIdMap };
  }, [resolvedPairIdMap]);

  /** Keep URL ?pairid= in sync with resolved instrument (session / live feed). */
  useEffect(() => {
    const t = String(marketType || '').trim().toLowerCase();
    if (t !== 'india' || !normalizedSymbol) return;
    const resolved = String(indiaInstrumentPairId || '').trim();
    const urlId = String(pairIdParam || '').trim();
    if (!resolved || resolved === urlId) return;
    const params = new URLSearchParams(searchParams);
    params.set('market', normalizedSymbol);
    params.set('type', 'india');
    params.set('pairid', resolved);
    try {
      const rawMap = sessionStorage.getItem(INDIA_PAIRID_NAV_STATE_KEY);
      const parsedMap = rawMap && typeof rawMap === 'string' ? JSON.parse(rawMap) : {};
      const nextMap = parsedMap && typeof parsedMap === 'object' ? parsedMap : {};
      nextMap[normalizeSymbol(normalizedSymbol)] = resolved;
      sessionStorage.setItem(INDIA_PAIRID_NAV_STATE_KEY, JSON.stringify(nextMap));
    } catch {
      /* ignore */
    }
    navigate(`/dashboard?${params.toString()}`, { replace: true });
  }, [
    marketType,
    normalizedSymbol,
    indiaInstrumentPairId,
    pairIdParam,
    searchParams,
    navigate,
  ]);

  const wsUrl = useMemo(() => {
    const t = String(marketType || '').toLowerCase().trim();
    if (t === 'india') {
      const base = String(import.meta.env.VITE_WS_INDIA_URL || '').replace(/\/+$/, '');
      if (indiaInstrumentPairId && base) {
        return appendIndiaWsToken(`${base}/${indiaInstrumentPairId}`);
      }
      return wsUrlIndiaAll;
      // if (t === 'india' && indiaInstrumentPairId) {
      //   return `${import.meta.env.VITE_WS_INDIA_URL}/${indiaInstrumentPairId}`;
    }
    const base = (getWsBase(marketType) || '').replace(/\/+$/, '');
    return base.endsWith('/all') ? base : `${base}/all`;
  }, [marketType, indiaInstrumentPairId, wsUrlIndiaAll]);

  const { tradesData, isConnected } = useAvaxTradesWebSocket(wsUrl, null, WS_OPTIONS);

  const normalizedTradesData = useMemo(() => {
    const t = String(marketType || '').toLowerCase().trim();
    if (t !== 'india') return tradesData;
    return normalizeIndiaTradesList(tradesData);
  }, [tradesData, marketType]);

  const indiaSidebarMarketData = useMemo(() => {
    const broadcast = Array.isArray(normalizedIndiaAllTradesData) ? normalizedIndiaAllTradesData : [];
    if (String(marketType || '').toLowerCase().trim() !== 'india') return broadcast;
    const active = Array.isArray(normalizedTradesData) ? normalizedTradesData : [];
    if (!active.length) return broadcast;
    const seen = new Set(
      broadcast.map((t) => indiaTickPairId(t) || indiaTickSymbolKey(t)).filter(Boolean)
    );
    const extra = active.filter((t) => {
      const k = indiaTickPairId(t) || indiaTickSymbolKey(t);
      return k && !seen.has(k);
    });
    return extra.length ? [...broadcast, ...extra] : broadcast;
  }, [normalizedIndiaAllTradesData, normalizedTradesData, marketType]);

  const allMarketsTradesData = useMemo(() => {
    const byKey = new Map();

    const addGenericTicks = (list) => {
      // const bySymbol = new Map();
      // const addAll = (list) => {
      (list || []).forEach((t) => {
        const raw =
          t.symbol ||
          t.pairsymbol ||
          t.pairSymbol ||
          t.tradingsymbol ||
          t.tradingSymbol ||
          t.id ||
          t.Symbol ||
          t.instrument ||
          t.pair ||
          t.market ||
          '';
        // const raw = t.symbol || t.id || t.Symbol || t.instrument || t.pair || t.market || '';
        const key = normalizeSymbol(raw);
        if (!key) return;
        // const existing = bySymbol.get(key);
        const existing = byKey.get(key);
        const ts = t.lastUpdate ?? t.timestamp ?? t.time ?? t.T ?? 0;
        if (!existing || ts > (existing.lastUpdate ?? 0)) {
          byKey.set(key, { ...t, lastUpdate: ts });
        }
      });
    };

    const addIndiaTicks = (list) => {
      (list || []).forEach((t) => {
        const pid = indiaTickPairId(t);
        const sym = indiaTickSymbolKey(t);
        const key = pid ? `india:${pid}` : sym ? `india:${sym}` : '';
        if (!key) return;
        const existing = byKey.get(key);
        const ts = t.lastUpdate ?? t.timestamp ?? t.time ?? t.T ?? 0;
        if (!existing || ts > (existing.lastUpdate ?? 0)) {
          // bySymbol.set(key, { ...t, id: key, symbol: key, lastUpdate: ts });
          byKey.set(key, { ...t, lastUpdate: ts });
        }
      });
    };
    // addAll(tradesDataCrypto);
    // addAll(tradesDataForex);
    // addAll(tradesDataMetals);
    // addAll(tradesDataIndices);
    // addAll(normalizedIndiaAllTradesData);
    // addAll(normalizedTradesData);
    // return Array.from(bySymbol.values());

    addGenericTicks(tradesDataCrypto);
    addGenericTicks(tradesDataForex);
    addGenericTicks(tradesDataMetals);
    addGenericTicks(tradesDataIndices);
    addIndiaTicks(normalizedIndiaAllTradesData);
    addIndiaTicks(normalizedTradesData);
    return Array.from(byKey.values());
  }, [
    normalizedTradesData,
    normalizedIndiaAllTradesData,
    tradesDataCrypto,
    tradesDataForex,
    tradesDataMetals,
    tradesDataIndices,
  ]);

  const currentMarketData = useMemo(() => {
    const findByNormalizedSymbol = (list, symbol) => {
      if (!Array.isArray(list) || list.length === 0 || !symbol) return null;
      const key = normalizeSymbol(symbol);
      if (!key) return null;
      return (
        list.find((t) => {
          const sid = normalizeSymbol(
            t?.symbol || t?.id || t?.Symbol || t?.instrument || t?.pair || t?.market || ''
          );
          return sid && sid === key;
        }) ?? null
      );
    };

    if (String(marketType || '').toLowerCase().trim() === 'india') {
      const activeList = Array.isArray(normalizedTradesData) ? normalizedTradesData : [];
      const fallbackList = Array.isArray(normalizedIndiaAllTradesData) ? normalizedIndiaAllTradesData : [];

      // if (!activeList.length && !fallbackList.length) return null;

      // const pairIdKey = String(indiaInstrumentPairId || '').trim().toLowerCase();
      // if (pairIdKey) {
      //   const byPairId = activeList.find((t) => {
      //     const candidates = [
      //       t?.pairid,
      //       t?.pairId,
      //       t?.instrument_token,
      //       t?.instrumentToken,
      //       t?.token,
      //       t?.id,
      //     ];
      //     return candidates.some((v) => String(v ?? '').trim().toLowerCase() === pairIdKey);
      //   });
      //   if (byPairId) return byPairId;
      // }

      // const tryFindBySymbol = (list) => {
      //   if (!normalizedSymbol || !Array.isArray(list) || !list.length) return null;
      //   const symbolKey = normalizeSymbol(normalizedSymbol);
      //   return list.find((t) => {
      //     const sid = normalizeSymbol(
      //       t?.symbol || t?.id || t?.Symbol || t?.instrument || t?.pair || t?.market || ''
      //     );
      //     return sid && sid === symbolKey;
      //   }) ?? null;
      // };

      // const bySymbolActive = tryFindBySymbol(activeList);
      // if (bySymbolActive) return bySymbolActive;

      // const bySymbolFallback = tryFindBySymbol(fallbackList);
      // if (bySymbolFallback) return bySymbolFallback;

      // return activeList[0] ?? fallbackList[0] ?? null;

      const tick = findIndiaMarketTick([activeList, fallbackList], {
        symbol: normalizedSymbol,
        pairId: indiaInstrumentPairId,
      });
      return tick ?? null;
    }
    if (!normalizedSymbol) return null;

    // Prefer current market stream, then fallback to merged cross-market stream.
    const fromActiveStream = findByNormalizedSymbol(normalizedTradesData, normalizedSymbol);
    if (fromActiveStream) return fromActiveStream;

    return findByNormalizedSymbol(allMarketsTradesData, normalizedSymbol);
  }, [normalizedTradesData, normalizedIndiaAllTradesData, allMarketsTradesData, normalizedSymbol, marketType, indiaInstrumentPairId]);

  const indiaInstrumentExchange = useMemo(() => {
    const t = String(marketType || '').trim().toLowerCase();
    if (t !== 'india') return '';

    if (exchangeDisplay) return exchangeDisplay;

    const fromSession = readIndiaExchangeFromSession(normalizedSymbol);
    if (fromSession) return fromSession;

    const urlExchange = searchParams.get('exchange');
    if (urlExchange) return String(urlExchange).trim();

    const tickExchange = indiaTickExchange(currentMarketData);
    if (tickExchange) return tickExchange;

    return '';
  }, [marketType, exchangeDisplay, normalizedSymbol, searchParams, currentMarketData]);

  /**
   * Require `market` + valid `type` in the URL.
   * Missing/invalid setup sends users to the right **markets list** (crypto default), not a half-formed dashboard.
   */
  useEffect(() => {
    const params = new URLSearchParams(searchParams);

    const marketRaw = params.get('market');
    const marketTrimmed =
      marketRaw != null && String(marketRaw).trim() !== '' ? String(marketRaw).trim() : null;

    const typeRaw = params.get('type');
    const typeNorm = normalizeAppMarketTypeParam(typeRaw);

    if (typeNorm == null) {
      if (marketTrimmed) {
        params.set('market', marketTrimmed);
        params.set('type', DASHBOARD_DEFAULT_TYPE);
        params.delete('pairid');
        params.delete('pairId');
        navigate(`/dashboard?${params.toString()}`, { replace: true });
        return;
      }
      navigate('/markets/crypto', { replace: true });
      return;
    }

    if (!marketTrimmed) {
      if (typeNorm === 'crypto') {
        navigate('/markets/crypto', { replace: true });
        return;
      }
      if (typeNorm === 'india') {
        navigate('/markets/indian', { replace: true });
        return;
      }
      if (typeNorm === 'forex') {
        navigate('/markets/forex', { replace: true });
        return;
      }
      params.set('market', DEFAULT_PAIR);
      params.delete('pairid');
      params.delete('pairId');
      navigate(`/dashboard?${params.toString()}`, { replace: true });
      return;
    }

    let changed = false;
    if (params.get('type') !== typeNorm) {
      params.set('type', typeNorm);
      changed = true;
    }
    if (typeNorm !== 'india') {
      if (params.has('pairid') || params.has('pairId')) {
        params.delete('pairid');
        params.delete('pairId');
        changed = true;
      }
    }

    if (changed) {
      navigate(`/dashboard?${params.toString()}`, { replace: true });
      return;
    }

    setMarketPair(marketTrimmed);
    setMarketType(typeNorm);
  }, [searchParams, navigate]);

  const updateMarketInUrl = useCallback(
    (newSymbol, newType, fullName) => {
      if (!newSymbol) return;
      const normalized = normalizeSymbol(newSymbol);
      const type = newType || marketType || 'crypto';
      const params = new URLSearchParams(searchParams);
      params.set('market', normalized);
      params.set('type', type);
      if (type === 'india') {
        const parsed = parseIndiaFavouriteName(String(fullName || '').trim());
        const pairId = String(parsed.pairId || '').trim();
        if (pairId) {
          params.set('pairid', pairId);
          try {
            const rawMap = sessionStorage.getItem(INDIA_PAIRID_NAV_STATE_KEY);
            const parsedMap =
              rawMap && typeof rawMap === 'string' ? JSON.parse(rawMap) : {};
            const nextMap =
              parsedMap && typeof parsedMap === 'object' ? parsedMap : {};
            nextMap[normalized] = pairId;
            sessionStorage.setItem(INDIA_PAIRID_NAV_STATE_KEY, JSON.stringify(nextMap));
          } catch {
            /* ignore */
          }
        } else {
          params.delete('pairid');
          params.delete('pairId');
        }
      } else {
        params.delete('pairid');
        params.delete('pairId');
      }
      if (normalized === normalizedSymbol && type === marketType) {
        const nextQs = params.toString();
        const curQs = searchParams.toString();
        if (nextQs === curQs) return;
      }
      setMarketPair(normalized);
      setMarketType(type);
      navigate(`/dashboard?${params.toString()}`, { replace: true });
    },
    [navigate, searchParams, normalizedSymbol, marketType]
  );

  useEffect(() => {
    if (marketPair && normalizedSymbol && marketPair !== normalizedSymbol) {
      setMarketPair(normalizedSymbol);
    }
  }, [marketPair, normalizedSymbol]);

  /** GET /trading/checkmarket — gates place/close/cancel for forex & India (MCX vs cash/F&O) per API `open` flags. */
  useEffect(() => {
    if (!isAuthenticated) {
      setMarketSessionOpen(true);
      setMarketSessionMessage('');
      return;
    }
    const t = String(marketType || '').trim().toLowerCase();
    if (!t || !normalizedSymbol) return;
    let cancelled = false;
    (async () => {
      try {
        let exchange = indiaInstrumentExchange;
        let segment = '';
        if (exchange) {
          writeIndiaExchangeToSession(normalizedSymbol, exchange);
        }
        if (t === 'india' && !exchange) {
          const list = await fetchIndiaStockList();
          const stockItem = findIndiaStockItemInStockList(list, {
            symbol: normalizedSymbol,
            pairId: indiaInstrumentPairId,
          });
          exchange = String(stockItem?.exchange || '').trim();
          segment = String(stockItem?.segment || '').trim();
          if (exchange) {
            writeIndiaExchangeToSession(normalizedSymbol, exchange);
          }
        }

        const res = await checkTradingMarket({
          pair: normalizedSymbol,
          marketType: t,
          pairId: t === 'india' ? indiaInstrumentPairId : undefined,
        });
        if (cancelled) return;
        // const { sessionOpen, message } = resolveCheckMarketSessionForDashboard(res, t, marketPair);
        const { sessionOpen, message } = resolveCheckMarketSessionForDashboard(res, t, marketPair, {
          exchange,
          segment,
        });
        setMarketSessionOpen(sessionOpen);
        setMarketSessionMessage(message);
      } catch {
        if (!cancelled) {
          setMarketSessionOpen(true);
          setMarketSessionMessage('');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // }, [isAuthenticated, marketType, normalizedSymbol, indiaInstrumentPairId, marketPair]);
  }, [
    isAuthenticated,
    marketType,
    normalizedSymbol,
    indiaInstrumentPairId,
    marketPair,
    indiaInstrumentExchange,
  ]);

  const tradingSessionClosed = isAuthenticated && !marketSessionOpen;

  const handleOrderSuccess = useCallback(() => {
    setOrdersRefreshTrigger((prev) => prev + 1);
  }, []);

  const openSheet = (side) => {
    setTradingSide(side);
    setShowTradingSheet(true);
  };
  const closeSheet = () => setShowTradingSheet(false);

  return (
    <div className="dashboardPage">
      {tradingSessionClosed && (
        <div className="dashboard-announcement-bar dashboard-announcement-bar--above-nav" role="status">
          <div className="dashboard-announcement-bar__inner">
            <span className="dashboard-announcement-bar__title">Market closed</span>
            <p className="dashboard-announcement-bar__text">
              {marketSessionMessage
                ? `${marketSessionMessage} Viewing only — you cannot place, close, or cancel orders until the session opens.`
                : 'Trading is temporarily disabled for this market. Viewing only — you cannot place, close, or cancel orders until the session opens.'}
            </p>
          </div>
        </div>
      )}
      <Header />
      <TradingBar
        selectedPair={normalizedSymbol}
        pairDisplay={pairDisplay}
        exchangeLabel={exchangeDisplay}
        onPairChange={updateMarketInUrl}
        currentMarketData={currentMarketData}
        isConnecting={!isConnected}
        marketType={marketType}
        favoritesSidebarOpen={favoritesSidebarOpen}
        onFavoritesSidebarToggle={() => setFavoritesSidebarOpen((o) => !o)}
        favouritesList={favouritesList}
        favouritesLoading={favouritesLoading}
        refreshFavourites={refreshFavourites}
      />
      <div
        className={`dashboardBodyRow${favoritesSidebarOpen ? ' dashboardBodyRow--favoritesOpen' : ''}`}
      >
        <div className="dashboardFavoritesRail">
          <FavoritesSidebar
            open={favoritesSidebarOpen}
            onClose={() => setFavoritesSidebarOpen(false)}
            selectedPair={normalizedSymbol}
            selectedMarketType={marketType}
            onSelectPair={updateMarketInUrl}
            marketDataList={allMarketsTradesData}
            indiaMarketDataList={indiaSidebarMarketData}
            indiaPairIdMap={indiaFavouritesPairIdMap}
            favouritesList={favouritesList}
            favouritesLoading={favouritesLoading}
            isAuthenticated={isAuthenticated}
          />
        </div>
        <div className="dashboardMainContent">
          <div className="leftColumn">
            <div className="topRow">
              <div
                className={`chartSection ${chartTabClass}${showOrderBook ? '' : ' chartSection--solo'}`}
              >
                <Suspense
                  fallback={
                    <div className="chartSection-placeholder" aria-hidden="true">
                      <div className="chartSection-placeholder-inner" />
                    </div>
                  }
                >
                  <DashboardChart
                    marketPair={marketPair}
                    marketType={marketType}
                    marketData={currentMarketData}
                    refreshTrigger={ordersRefreshTrigger}
                    tradingSessionClosed={tradingSessionClosed}
                    tradingSessionMessage={marketSessionMessage}
                    indiaExchange={indiaInstrumentExchange}
                  />
                </Suspense>
              </div>
              {showOrderBook && (
                <div className={`orderBookSection ${orderbookTabClass}`}>
                  <OrderBook
                    data={currentMarketData}
                    activeSymbol={normalizedSymbol}
                    marketType={marketType}
                  />
                </div>
              )}
            </div>
            <div className={`ordersPanelSection ${ordersTabClass}`}>
              <OrdersPanel
                pair={marketPair}
                marketType={marketType}
                marketData={currentMarketData}
                marketDataList={allMarketsTradesData}
                refreshTrigger={ordersRefreshTrigger}
                onOrderChange={refreshWallet}
                tradingSessionClosed={tradingSessionClosed}
                tradingSessionMessage={marketSessionMessage}
              />
            </div>
          </div>
          <div className="tradingPanelSection">
            <TradingPanel
              pair={marketPair}
              marketData={currentMarketData}
              marketType={marketType}
              pairId={pairIdForOrderApis}
              indiaExchange={indiaInstrumentExchange}
              onOrderSuccess={handleOrderSuccess}
              walletData={walletData}
              tradingSessionClosed={tradingSessionClosed}
              tradingSessionMessage={marketSessionMessage}
            />
            {!isAuthenticated && (
              <div className="trading-panel-auth-overlay">
                <AuthCTA variant="panel" />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mobile-bottom-tabs">
        <button
          className={`mobile-bottom-tab ${activeBottomTab === 'chart' ? 'active' : ''}`}
          onClick={() => setActiveBottomTab('chart')}
          aria-label="Chart"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 6 13.5 14.5 8.5 9.5 2 16" />
            <polyline points="16 6 22 6 22 12" />
          </svg>
          <span>Chart</span>
        </button>
        <button
          className={`mobile-bottom-tab ${activeBottomTab === 'orders' ? 'active' : ''}`}
          onClick={() => setActiveBottomTab('orders')}
          aria-label="Orders"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <path d="M14 2v6h6" />
            <path d="M16 13H8" />
            <path d="M16 17H8" />
            <path d="M10 9H8" />
          </svg>
          <span>Orders</span>
        </button>
        <button
          className="mobile-bottom-tab trading"
          onClick={() => openSheet('buy')}
          aria-label="Buy/Long"
          disabled={tradingSessionClosed}
          title={tradingSessionClosed ? (marketSessionMessage || 'Market is closed') : undefined}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12l7-7 7 7" />
          </svg>
          <span>BUY</span>
        </button>
        <button
          className="mobile-bottom-tab trading sell"
          onClick={() => openSheet('sell')}
          aria-label="Sell/Short"
          disabled={tradingSessionClosed}
          title={tradingSessionClosed ? (marketSessionMessage || 'Market is closed') : undefined}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 19V5M5 12l7 7 7-7" />
          </svg>
          <span>SELL</span>
        </button>
      </div>

      {showTradingSheet && (
        <div
          className="trading-bottom-sheet-overlay"
          onClick={(e) => e.target === e.currentTarget && closeSheet()}
        >
          <div className="trading-bottom-sheet">
            <div className="trading-bottom-sheet-header">
              <h2 className="trading-bottom-sheet-title">
                {tradingSide === 'buy' ? 'Buy / Long' : 'Sell / Short'}
              </h2>
              <button
                className="trading-bottom-sheet-close"
                onClick={closeSheet}
                aria-label="Close trading panel"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="trading-bottom-sheet-content">
              {!isAuthenticated ? (
                <div className="trading-bottom-sheet-auth">
                  <AuthCTA variant="sheet" onClose={closeSheet} />
                </div>
              ) : (
                <TradingPanel
                  pair={marketPair}
                  defaultSide={tradingSide}
                  marketData={currentMarketData}
                  marketType={marketType}
                  pairId={pairIdForOrderApis}
                  indiaExchange={indiaInstrumentExchange}
                  onOrderSuccess={handleOrderSuccess}
                  tradingSessionClosed={tradingSessionClosed}
                  tradingSessionMessage={marketSessionMessage}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;

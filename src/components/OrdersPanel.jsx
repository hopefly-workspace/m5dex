import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import TP_SL_Modal from './TP_SL_Modal';
import {
  getOrderHistory,
  closeOrder,
  closeAllOrders,
  updateOrderTpSl,
  cancelOrder
} from '../services/tradingApi';
import {
  useOrderListWebSocket,
  ORDER_OPEN_LIST_WS_URL,
  ORDER_PENDING_LIST_WS_URL,
} from '../hooks/useOrderListWebSocket';
import { useToast } from '../contexts/ToastContext';
import { useUser } from '../contexts/UserContext';
import { normalizeSymbol } from '../services/favouritesWishlistApi';
import {
  formatPrice as formatPriceUtil,
  formatDynamic,
  formatIndianOrderPairDisplay,
  getIndianInstrumentKind,
  getIndianOrderUnderlyingForIcon,
} from '../utils/helper';
import { INDIA_INR_PER_USDT } from '../utils/tradingCalculations';
import '../styles/components/OrdersPanel.css';
import { tokenStorage } from '../utils/storage';
import { getDeviceInfo } from '../utils/clientDeviceInfo';
import { resolveOrderNo } from '../utils/orderDisplay';
import {
  computeClosedPositionPnlPercent,
  computeOpenPositionPnl,
  resolveQtyForPnl,
} from '../utils/orderPnl';
// import { findIndiaMarketTick, indiaTickPairId, indiaApiSymbolMatchesPair } from '../utils/indiaPairResolve';
import { findIndiaMarketTick, indiaTickPairId, indiaApiSymbolMatchesPair, resolveIndiaOrderExchange } from '../utils/indiaPairResolve';

const parsePositivePrice = (v) => {
  const n = v != null ? Number(v) : null;
  return n != null && !Number.isNaN(n) && n > 0 ? n : null;
};

/** Best bid / ask / last from a market feed row (Dashboard list or selected pair). */
const getQuoteFromMarketItem = (item, { strictBidAsk = false } = {}) => {
  if (!item || typeof item !== 'object') return { bid: null, ask: null, last: null };
  const last = parsePositivePrice(
    item.price ?? item.p ?? item.last ?? item.close ?? item.Last ?? item.Close ?? item.index ?? item.mark ?? item.markPrice ?? item.ltp,
  );
  // const bid = parsePositivePrice(item.bid ?? item.b ?? item.bidPrice) ?? last;
  // const ask = parsePositivePrice(item.ask ?? item.a ?? item.askPrice) ?? last;
  // return { bid, ask, last };
  const bid = parsePositivePrice(item.bid ?? item.b ?? item.bidPrice ?? item.best_bid ?? item.bestBid);
  const ask = parsePositivePrice(item.ask ?? item.a ?? item.askPrice ?? item.best_ask ?? item.bestAsk);
  if (strictBidAsk) {
    return { bid, ask, last };
  }
  return {
    bid: bid ?? last,
    ask: ask ?? last,
    last,
  };
};

const getStrictQuoteFromMarketItem = (item) => getQuoteFromMarketItem(item, { strictBidAsk: true });

/** India order rows may store instrument id on `type`, `pairid`, etc. */
function extractIndiaOrderPairId(raw) {
  if (!raw || typeof raw !== 'object') return '';
  const direct = raw.pairid ?? raw.pairId ?? raw.instrument_token ?? raw.instrumentToken;
  if (direct != null && String(direct).trim() && String(direct).trim() !== '-') {
    return String(direct).trim();
  }
  const typeField = String(raw.type ?? '').trim();
  if (/^\d+$/.test(typeField)) return typeField;
  return '';
}

const getQuoteFromOrderRaw = (raw) => {
  if (!raw || typeof raw !== 'object') return { bid: null, ask: null, last: null };
  const last = parsePositivePrice(
    // raw.liveprice ?? raw.livePrice ?? raw.currentPrice ?? raw.current_price ?? raw.markPrice ?? raw.lastPrice ?? raw.price,
    raw.liveprice ??
    raw.livePrice ??
    raw.currentPrice ??
    raw.current_price ??
    raw.markPrice ??
    raw.lastPrice ??
    raw.ltp,
  );
  const bid = parsePositivePrice(raw.bid ?? raw.b ?? raw.bidPrice);
  const ask = parsePositivePrice(raw.ask ?? raw.a ?? raw.askPrice);
  return { bid, ask, last };
};

function indiaOrderMatchesDashboardPair(orderSymbolRaw, dashboardPair) {
  const orderRaw = String(orderSymbolRaw || '').trim();
  const dashRaw = String(dashboardPair || '').trim();
  if (!orderRaw || !dashRaw) return false;
  if (normalizeSymbol(orderRaw) === normalizeSymbol(dashRaw)) return true;
  return indiaApiSymbolMatchesPair(orderRaw, dashRaw);
}

function resolveIndiaFeedQuote({ raw, symbol, pairId, marketDataList, marketData, symbolToQuoteMap }) {
  const symKey = normalizeSymbol(symbol);
  let quote = symKey ? symbolToQuoteMap.get(symKey) ?? null : null;

  if (pairId) {
    quote = symbolToQuoteMap.get(`india:${pairId}`) ?? quote;
  }

  const orderSymRaw = raw?.pairname ?? raw?.pair ?? raw?.symbol ?? symbol;
  const lists = [];
  if (Array.isArray(marketDataList)) lists.push(marketDataList);
  if (marketData) lists.push(marketData);

  if (quote?.bid == null && quote?.ask == null && lists.length > 0) {
    const tick = findIndiaMarketTick(lists, { symbol: orderSymRaw, pairId });
    if (tick) quote = getStrictQuoteFromMarketItem(tick);
  }

  return quote;
}

/** Market BUY → ask; market SELL → bid (same as TradingPanel). */
function resolveForexIndiaMarkPrice(side, bid, ask, last) {
  const isBuy = String(side).toLowerCase() === 'buy';
  if (isBuy) {
    //   if (ask != null && Number.isFinite(ask) && ask > 0) return ask;
    // } else if (bid != null && Number.isFinite(bid) && bid > 0) {
    //   return bid;
    if (bid != null && Number.isFinite(bid) && bid > 0) return bid;
  } else if (ask != null && Number.isFinite(ask) && ask > 0) {
    return ask;
  }
  return last != null && Number.isFinite(last) && last > 0 ? last : null;
}

function resolveCryptoMarkPrice(side, bid, ask, last) {
  const isBuy = String(side).toLowerCase() === 'buy';
  if (isBuy) {
    //   if (ask != null && Number.isFinite(ask) && ask > 0) return ask;
    // } else if (bid != null && Number.isFinite(bid) && bid > 0) {
    //   return bid;
    if (bid != null && Number.isFinite(bid) && bid > 0) return bid;
  } else if (ask != null && Number.isFinite(ask) && ask > 0) {
    return ask;
  }
  return last != null && Number.isFinite(last) && last > 0 ? last : null;
}

function mergeQuotes(...quotes) {
  let bid = null;
  let ask = null;
  let last = null;
  for (const q of quotes) {
    if (!q) continue;
    if (bid == null && q.bid != null) bid = q.bid;
    if (ask == null && q.ask != null) ask = q.ask;
    if (last == null && q.last != null) last = q.last;
  }
  return { bid, ask, last };
}

function resolvePositionCurrentPrice({
  side,
  orderMarketType,
  raw,
  symbolQuote,
  pairQuote,
  fromApiPrice,
  openPrice,
}) {
  const isIndia = String(orderMarketType || '').toLowerCase() === 'india';
  const rawQuote = getQuoteFromOrderRaw(raw);
  // const quote = mergeQuotes(rawQuote, symbolQuote, pairQuote);
  const quote = isIndia
    ? mergeQuotes(symbolQuote, pairQuote, rawQuote)
    : mergeQuotes(rawQuote, symbolQuote, pairQuote);
  const resolver =
    String(orderMarketType || '').toLowerCase() === 'crypto'
      ? resolveCryptoMarkPrice
      : resolveForexIndiaMarkPrice;
  const mark = resolver(side, quote.bid, quote.ask, quote.last);
  if (mark != null && mark > 0) return mark;
  // if (isIndia) {
  //   if (quote.last != null && quote.last > 0) return quote.last;
  if (isIndia || String(orderMarketType || '').toLowerCase() === 'forex') {
    const entry = parsePositivePrice(openPrice);
    return entry ?? 0;
  }
  const api = parsePositivePrice(fromApiPrice);
  if (api != null) return api;
  const entry = parsePositivePrice(openPrice);
  return entry ?? 0;
}

/** Get market segment tag from order raw (segment, marketSegment, assetType, etc.) or derive from symbol */
const getOrderMarketTag = (raw, symbol = '') => {
  const seg = raw?.segment ?? raw?.marketSegment ?? raw?.assetType ?? raw?.productType ?? raw?.market_type ?? raw?.marketType ?? '';
  const s = String(seg).trim().toLowerCase();
  if (s === 'indices' || s === 'metals' || s === 'commodities') return 'Forex';
  if (s === 'crypto' || s === 'forex' || s === 'india' || s === 'indian') {
    return s.charAt(0).toUpperCase() + s.slice(1).replace('indian', 'Indian');
  }
  const sym = String(symbol).toUpperCase();
  const exPref = sym.match(/^([A-Z0-9]{2,6}):/);
  if (exPref && /^(NFO|MCX|NSE|BSE|CDS|BCD|NCDEX)$/.test(exPref[1])) {
    return exPref[1];
  }
  if (/USDT$/i.test(sym)) return 'Crypto';
  if (/^(EUR|GBP|USD|JPY|AUD|CHF|NZD|CAD)(USD|EUR|GBP|JPY|CHF|AUD|NZD|CAD)$/.test(sym) || (sym.length === 6 && !sym.endsWith('USDT'))) return 'Forex';
  if (/^(NIFTY|BANKNIFTY|SENSEX|BSE|NSE)/i.test(sym) || sym.endsWith('INR')) return 'Indian';
  return '—';
};

const formatExpiryDate = (expireAt) => {
  if (!expireAt) return null;
  const match = String(expireAt).match(/^(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{2}):(\d{2}):(\d{2}))?/);
  if (match) {
    const [, yyyy, mm, dd, hh, min] = match;
    if (hh && min) {
      let hourNum = parseInt(hh, 10);
      const ampm = hourNum >= 12 ? 'PM' : 'AM';
      hourNum = hourNum % 12;
      hourNum = hourNum ? hourNum : 12;
      const hourStr = String(hourNum).padStart(2, '0');
      return `${dd}-${mm}-${yyyy} ${hourStr}:${min} ${ampm}`;
    }
    return `${dd}-${mm}-${yyyy}`;
  }

  let d = new Date(expireAt);
  if (Number.isNaN(d.getTime())) {
    d = new Date(String(expireAt).replace(/-/g, '/'));
  }
  if (Number.isNaN(d.getTime())) return String(expireAt);

  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  let hh = d.getHours();
  const min = String(d.getMinutes()).padStart(2, '0');
  const ampm = hh >= 12 ? 'PM' : 'AM';
  hh = hh % 12;
  hh = hh ? hh : 12;
  const hhStr = String(hh).padStart(2, '0');
  return `${dd}-${mm}-${yyyy} ${hhStr}:${min} ${ampm}`;
};

const csvEscapeCell = (v) => {
  const s = String(v ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
};

const nPos = (v) => {
  const x = Number(v);
  return Number.isFinite(x) && x > 0 ? x : 0;
};

const resolveUsdtInrRate = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : INDIA_INR_PER_USDT;
};

/** API: openbuyprice / opensellprice = entry; price = close for closed orders. */
const getHistoryEntryPrice = (raw) =>
  nPos(raw?.openbuyprice) ||
  nPos(raw?.opensellprice) ||
  nPos(raw?.open_price) ||
  nPos(raw?.openPrice) ||
  nPos(raw?.entryPrice) ||
  nPos(raw?.avgPrice) ||
  nPos(raw?.avg_open) ||
  0;

const getHistoryClosePrice = (raw) => {
  const explicit =
    nPos(raw?.closeprice) ||
    nPos(raw?.close_price) ||
    nPos(raw?.exitPrice) ||
    nPos(raw?.exit_price) ||
    nPos(raw?.closePrice);
  if (explicit) return explicit;
  const entry = getHistoryEntryPrice(raw);
  if (entry > 0 && nPos(raw?.price)) return nPos(raw?.price);
  return nPos(raw?.price) || nPos(raw?.openPrice);
};

const computeHistoryRealizedPnl = (raw, entryPx, exitPx, qty, fee) => {
  const q = Number(qty) || 0;
  const feeAbs = Math.abs(Number(fee) || 0);
  const fromApi = Number(raw?.profit ?? raw?.pnl ?? raw?.realizedPnl ?? raw?.realized_pnl);
  if (Number.isFinite(fromApi) && Math.abs(fromApi) > 1e-12) return fromApi;
  if (q <= 0 || entryPx <= 0 || exitPx <= 0) return 0;
  const ob = nPos(raw?.openbuyprice);
  const os = nPos(raw?.opensellprice);
  let gross;
  if (ob > 0 && os === 0) gross = (exitPx - entryPx) * q;
  else if (os > 0 && ob === 0) gross = (entryPx - exitPx) * q;
  else {
    const short = String(raw?.ordertype ?? raw?.side ?? raw?.mode ?? '')
      .toLowerCase()
      .includes('sell');
    gross = short ? (entryPx - exitPx) * q : (exitPx - entryPx) * q;
  }
  return gross - feeAbs;
};

const getHistoryExecTypeLabel = (raw) => {
  const v = String(raw?.markettype ?? raw?.marketType ?? '').trim().toUpperCase();
  if (v === 'MARKET') return 'Market';
  if (v === 'LIMIT') return 'Limit';
  return v || '—';
};

const formatHistoryQty = (q) => {
  const n = Number(q);
  if (!Number.isFinite(n)) return '—';
  if (Math.abs(n) >= 1) return n.toLocaleString('en-US', { maximumFractionDigits: 6 });
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 });
};

const INDIAN_INSTRUMENT_FILTER_LABELS = {
  futures: 'Futures',
  ce: 'CE',
  pe: 'PE',
  other: 'Other',
};

const getOrderMarketTypeKey = (raw, symbol = '') => {
  const candidates = [
    raw?.type,
    raw?.market,
    raw?.segment,
    raw?.marketSegment,
    raw?.assetType,
    raw?.productType,
    raw?.market_type,
    raw?.marketType,
  ];

  for (const c of candidates) {
    const key = String(c ?? '').trim().toLowerCase();
    if (!key) continue;
    if (key.includes('crypto')) return 'crypto';
    if (key.includes('forex')) return 'forex';
    if (key.includes('indice') || key.includes('index')) return 'forex';
    if (key.includes('metal') || key.includes('commodit')) return 'forex';
    if (key.includes('india') || key.includes('indian')) return 'india';
  }

  const sym = String(symbol).toUpperCase();
  if (/^(NFO|MCX|NSE|BSE|CDS|BCD|NCDEX):/i.test(sym)) return 'india';
  if (/USDT$/i.test(sym)) return 'crypto';
  if (/^(EUR|GBP|USD|JPY|AUD|CHF|NZD|CAD)(USD|EUR|GBP|JPY|CHF|AUD|NZD|CAD)$/.test(sym) || (sym.length === 6 && !sym.endsWith('USDT'))) return 'forex';
  if (/^(NIFTY|BANKNIFTY|SENSEX|BSE|NSE)/i.test(sym) || sym.endsWith('INR')) return 'india';
  return '';
};

const OrdersPanel = ({
  pair = '',
  marketType = 'crypto',
  marketData = null,
  marketDataList = null,
  refreshTrigger,
  onOrderChange,
  tradingSessionClosed = false,
  tradingSessionMessage = '',
  indiaExchange = '',
}) => {
  const { showError, showSuccess } = useToast();
  const { usdtInrRate } = useUser();
  const [activeTab, setActiveTab] = useState('open-positions');
  const [selectedPositions, setSelectedPositions] = useState([]);
  const [closingIds, setClosingIds] = useState([]);
  const [tpslModalOpen, setTpslModalOpen] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [tpslSaving, setTpslSaving] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [confirmActionLoading, setConfirmActionLoading] = useState(false);
  const [indiaPnlCurrency, setIndiaPnlCurrency] = useState('usdt');
  const [showOrderDetailsModal, setShowOrderDetailsModal] = useState(false);
  const [selectedOrderDetails, setSelectedOrderDetails] = useState(null);

  const isAuthenticate = tokenStorage.hasToken();
  const openOrderWs = useOrderListWebSocket(ORDER_OPEN_LIST_WS_URL, isAuthenticate);
  const pendingOrderWs = useOrderListWebSocket(ORDER_PENDING_LIST_WS_URL, isAuthenticate);

  const [openPositions, setOpenPositions] = useState([]);
  const [openPositionsLoading, setOpenPositionsLoading] = useState(false);
  const [openPositionsError, setOpenPositionsError] = useState(null);

  const [pendingOrders, setPendingOrders] = useState([]);
  const [pendingOrdersLoading, setPendingOrdersLoading] = useState(false);
  const [pendingOrdersError, setPendingOrdersError] = useState(null);

  const [orderHistory, setOrderHistory] = useState([]);
  const [orderHistoryLoading, setOrderHistoryLoading] = useState(false);
  const [orderHistoryError, setOrderHistoryError] = useState(null);

  const [openPositionsFilterOpen, setOpenPositionsFilterOpen] = useState(false);
  const [positionsFilterSide, setPositionsFilterSide] = useState('all');
  const [positionsFilterSymbol, setPositionsFilterSymbol] = useState('');
  const [positionsFilterIndianKind, setPositionsFilterIndianKind] = useState('all');
  const openPositionsFilterRef = useRef(null);
  /** After a successful trade from TradingPanel, Dashboard bumps refreshTrigger — clear filters & selection here. */
  const prevOrdersRefreshTriggerRef = useRef(null);

  // const liveQuoteForPair = useMemo(() => getQuoteFromMarketItem(marketData), [marketData]);
  const liveQuoteForPair = useMemo(
    () =>
      String(marketType || '').toLowerCase() === 'india'
        ? getStrictQuoteFromMarketItem(marketData)
        : getQuoteFromMarketItem(marketData),
    [marketData, marketType],
  );
  const inrPerUsdt = useMemo(() => resolveUsdtInrRate(usdtInrRate), [usdtInrRate]);
  const pairKeyNormalized = useMemo(() => normalizeSymbol(pair), [pair]);

  const selectedMarketType = useMemo(() => String(marketType || 'crypto').trim().toLowerCase(), [marketType]);
  const orderActionsBlockedMsg = useMemo(
    () =>
      String(tradingSessionMessage || '').trim() ||
      'Market is closed. You cannot close positions, edit TP/SL, or cancel orders until the session opens.',
    [tradingSessionMessage]
  );
  const usesLotSize = selectedMarketType === 'forex' || selectedMarketType === 'india';
  const positionSizeLabel = usesLotSize ? 'Lot Size' : 'Quantity';
  const getOrderLotSizeValue = useCallback((raw, fallback = 0) => {
    const lot = Number(raw?.lotsize ?? raw?.lotSize ?? raw?.lot ?? raw?.lots ?? fallback);
    return Number.isFinite(lot) ? lot : 0;
  }, []);
  const getOrderQuantityValue = useCallback((raw, fallback = 0) => {
    const qty = Number(raw?.quantity ?? raw?.qty ?? raw?.size ?? raw?.volume ?? raw?.amount ?? fallback);
    return Number.isFinite(qty) ? qty : 0;
  }, []);
  const getOrderSizeValue = useCallback((raw, fallback = 0) => {
    const lot = Number(raw?.lotsize ?? raw?.lotSize ?? raw?.lot ?? raw?.lots ?? NaN);
    if (Number.isFinite(lot) && lot > 0) return lot;
    const qty = Number(raw?.quantity ?? raw?.qty ?? raw?.size ?? raw?.volume ?? raw?.amount ?? fallback);
    return Number.isFinite(qty) ? qty : 0;
  }, []);

  const symbolToQuoteMap = useMemo(() => {
    const list = Array.isArray(marketDataList) ? marketDataList : [];
    const map = new Map();
    const setQuote = (key, quote) => {
      if (!key || !quote) return;
      if (quote.bid == null && quote.ask == null && quote.last == null) return;
      map.set(key, quote);
    };
    list.forEach((item) => {
      // const rawSymbol = item?.symbol ?? item?.id ?? item?.Symbol ?? item?.instrument ?? item?.pair ?? item?.market ?? '';
      const quote = getStrictQuoteFromMarketItem(item);
      const rawSymbol =
        item?.symbol ??
        item?.id ??
        item?.Symbol ??
        item?.instrument ??
        item?.pair ??
        item?.market ??
        item?.pairsymbol ??
        item?.pairSymbol ??
        '';
      const key = normalizeSymbol(rawSymbol);
      // if (!key) return;
      // const quote = getQuoteFromMarketItem(item);
      // if (quote.bid != null || quote.ask != null || quote.last != null) {
      //   map.set(key, quote);
      // }

      setQuote(key, quote);
      const pairSymbol = item?.pairsymbol ?? item?.pairSymbol ?? item?.tradingsymbol ?? item?.tradingSymbol;
      if (pairSymbol) {
        setQuote(normalizeSymbol(pairSymbol), quote);
      }
      const pairId = indiaTickPairId(item);
      if (pairId) setQuote(`india:${pairId}`, quote);
    });
    return map;
  }, [marketDataList]);

  const resolveCurrentPriceForOrder = useCallback(
    ({ side, symbol, orderMarketType, raw, fromApiPrice, openPrice }) => {
      const symKey = normalizeSymbol(symbol);
      // const symbolQuote = symKey ? symbolToQuoteMap.get(symKey) ?? null : null;
      // const pairQuote = symKey && symKey === pairKeyNormalized ? liveQuoteForPair : null;

      const isIndia = String(orderMarketType || '').toLowerCase() === 'india';
      const orderSymRaw = raw?.pairname ?? raw?.pair ?? raw?.symbol ?? symbol;
      const pairId = isIndia ? extractIndiaOrderPairId(raw) : '';

      let symbolQuote = null;
      let pairQuote = null;

      if (isIndia) {
        symbolQuote = resolveIndiaFeedQuote({
          raw,
          symbol,
          pairId,
          marketDataList,
          marketData,
          symbolToQuoteMap,
        });
        const onDashboard = indiaOrderMatchesDashboardPair(orderSymRaw, pair);
        if (onDashboard) {
          pairQuote = getStrictQuoteFromMarketItem(marketData) ?? liveQuoteForPair;
        }
      } else {
        symbolQuote = symKey ? symbolToQuoteMap.get(symKey) ?? null : null;
        pairQuote = symKey && symKey === pairKeyNormalized ? liveQuoteForPair : null;
      }
      return resolvePositionCurrentPrice({
        side,
        orderMarketType,
        raw,
        symbolQuote,
        pairQuote,
        // fromApiPrice,
        // fromApiPrice: isIndia ? null : fromApiPrice,
        fromApiPrice:
          isIndia || String(orderMarketType || '').toLowerCase() === 'forex'
            ? null
            : fromApiPrice,
        openPrice,
      });
    },
    [symbolToQuoteMap, liveQuoteForPair, pairKeyNormalized, marketDataList, marketData, pair],
  );

  const tabs = [
    {
      id: 'open-positions',
      label: 'Open Positions',
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width={16}
          height={16}
          viewBox="0 0 24 23"
          fill="none"
        >
          <path
            d="M22.3636 2.72227V0L21.8042 0.0142152C18.1407 0.146211 14.6521 1.60731 12 4.12141C9.34797 1.60737 5.85937 0.146261 2.19587 0.0142152L1.63643 0V2.72227H0V17.8776L0.536957 17.8847C6.66243 17.9721 9.17309 20.0678 11.6052 22.5908L12 23L12.3948 22.5908C14.8269 20.0677 17.3389 17.9718 23.463 17.8847L24 17.8776V2.72227H22.3636ZM12.5451 5.11344C14.8954 2.81161 17.984 1.40031 21.2734 1.12504V14.6597C18.0487 14.8983 14.9885 16.1635 12.5451 18.2663V5.11344ZM2.72652 1.12504C6.0156 1.4002 9.10439 2.81156 11.4548 5.11344V18.2665C9.01144 16.1637 5.9512 14.8986 2.72652 14.66V1.12504ZM22.9098 16.8143C17.082 17.0143 14.3462 19.0735 11.9999 21.4382C9.65475 19.0735 6.91786 17.0142 1.0901 16.8143V3.80442H1.63624V15.7044L2.16705 15.7186C5.73131 15.8668 9.10549 17.3554 11.6041 19.8835L11.9989 20.2927L12.3937 19.8835H12.3927C14.8923 17.3552 18.2676 15.8657 21.8329 15.7186L22.3637 15.7044V3.80442H22.9088L22.9098 16.8143Z"
            fill="currentColor"
          />
        </svg>
      ),
      badge: null
    },
    {
      id: 'pending-orders',
      label: 'Pending Orders',
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width={16}
          height={16}
          viewBox="0 0 23 23"
          fill="none"
        >
          <path
            d="M21.3095 14.3695C21.3312 14.3058 21.3444 14.2395 21.3489 14.1724V2.46334C21.3489 1.81002 21.0894 1.18346 20.6274 0.721496C20.1655 0.25953 19.5389 0 18.8856 0H2.46334C1.81002 0 1.18346 0.25953 0.721496 0.721496C0.25953 1.18346 0 1.81002 0 2.46334V18.8856C0 19.5389 0.25953 20.1655 0.721496 20.6274C1.18346 21.0894 1.81002 21.3489 2.46334 21.3489H14.1724C14.2387 21.3442 14.3041 21.331 14.367 21.3095C14.8099 21.8188 15.3527 22.2316 15.9619 22.5221C16.5711 22.8127 17.2335 22.9747 17.908 22.9983C18.5825 23.0219 19.2547 22.9064 19.8826 22.6592C20.5106 22.4119 21.081 22.038 21.5583 21.5609C22.0356 21.0837 22.4097 20.5135 22.6572 19.8856C22.9047 19.2577 23.0204 18.5856 22.9971 17.9111C22.9737 17.2366 22.8119 16.5741 22.5216 15.9648C22.2312 15.3555 21.8187 14.8125 21.3095 14.3695ZM7.11659 1.64223H14.2324V9.34591L13.2314 8.84503C13.1173 8.78795 12.9915 8.75823 12.864 8.75823C12.7364 8.75823 12.6106 8.78795 12.4965 8.84503L10.6745 9.75647L8.85242 8.84503C8.73781 8.78728 8.61126 8.7572 8.48292 8.7572C8.35458 8.7572 8.22803 8.78728 8.11342 8.84503L7.11248 9.34591L7.11659 1.64223ZM2.46334 19.7067C2.24557 19.7067 2.03671 19.6202 1.88273 19.4662C1.72874 19.3122 1.64223 19.1034 1.64223 18.8856V2.46334C1.64223 2.24557 1.72874 2.03671 1.88273 1.88273C2.03671 1.72874 2.24557 1.64223 2.46334 1.64223H5.47436V10.6745C5.4743 10.8145 5.51002 10.9521 5.57813 11.0744C5.64625 11.1967 5.7445 11.2995 5.86354 11.3732C5.98259 11.4468 6.11849 11.4888 6.25833 11.4951C6.39816 11.5015 6.5373 11.4719 6.66251 11.4094L8.48456 10.4979L10.3074 11.4094C10.4214 11.4663 10.5471 11.496 10.6745 11.496C10.8019 11.496 10.9275 11.4663 11.0415 11.4094L12.8644 10.4979L14.6864 11.4094C14.8116 11.4719 14.9508 11.5015 15.0906 11.4951C15.2305 11.4888 15.3664 11.4468 15.4854 11.3732C15.6044 11.2995 15.7027 11.1967 15.7708 11.0744C15.8389 10.9521 15.8746 10.8145 15.8746 10.6745V1.64223H18.8856C19.1034 1.64223 19.3122 1.72874 19.4662 1.88273C19.6202 2.03671 19.7067 2.24557 19.7067 2.46334V13.4252C18.8304 13.1117 17.883 13.0535 16.9749 13.2575C16.0668 13.4614 15.2353 13.9191 14.5772 14.5772C13.9191 15.2353 13.4614 16.0668 13.2575 16.9749C13.0535 17.883 13.1117 18.8304 13.4252 19.7067H2.46334ZM18.0645 21.3489C17.4149 21.3489 16.7799 21.1563 16.2397 20.7954C15.6996 20.4345 15.2786 19.9216 15.0301 19.3214C14.7815 18.7212 14.7164 18.0608 14.8431 17.4237C14.9699 16.7866 15.2827 16.2014 15.742 15.742C16.2014 15.2827 16.7866 14.9699 17.4237 14.8431C18.0608 14.7164 18.7212 14.7815 19.3214 15.0301C19.9216 15.2786 20.4345 15.6996 20.7954 16.2397C21.1563 16.7799 21.3489 17.4149 21.3489 18.0645C21.3489 18.9356 21.0029 19.771 20.3869 20.3869C19.771 21.0029 18.9356 21.3489 18.0645 21.3489Z"
            fill="currentColor"
          />
        </svg>
      ),
      badge: null
    },
    {
      id: 'order-history',
      label: 'Order History',
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width={16}
          height={16}
          viewBox="0 0 28 28"
          fill="none"
        >
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M13.7886 12.3744L8.13173 6.71751C7.7414 6.32719 7.10784 6.32719 6.71751 6.71751C6.32719 7.10784 6.32719 7.7414 6.71751 8.13173L12.3744 13.7886L7.07107 19.0919C6.68074 19.4822 6.68074 20.1158 7.07107 20.5061C7.46139 20.8964 8.09496 20.8964 8.48528 20.5061L13.7886 15.2028L19.4454 20.8596C19.8358 21.25 20.4693 21.25 20.8596 20.8596C21.25 20.4693 21.25 19.8358 20.8596 19.4454L15.2028 13.7886L20.5061 8.48528C20.8964 8.09496 20.8964 7.46139 20.5061 7.07107C20.1158 6.68074 19.4822 6.68074 19.0919 7.07107L13.7886 12.3744Z"
            fill="currentColor"
          />
        </svg>
      ),
      badge: null
    },
  ];

  const handleSelectAll = (checked, rows) => {
    const list = Array.isArray(rows) ? rows : [];
    if (checked) {
      setSelectedPositions(list.map((p) => p.id));
    } else {
      setSelectedPositions([]);
    }
  };

  const handleSelectPosition = (positionId, checked) => {
    if (checked) {
      setSelectedPositions([...selectedPositions, positionId]);
    } else {
      setSelectedPositions(selectedPositions.filter(id => id !== positionId));
    }
  };

  const handleSelectAllPendingOrders = (checked, rows) => {
    const list = Array.isArray(rows) ? rows : [];
    if (checked) {
      setSelectedPositions(list.map((p) => p.orderNo).filter(Boolean));
    } else {
      setSelectedPositions([]);
    }
  };

  const handleSelectPositionPendingOrder = (orderNo, checked) => {
    if (checked) {
      setSelectedPositions([...selectedPositions, orderNo]);
    } else {
      setSelectedPositions(selectedPositions.filter(id => id !== orderNo));
    }
  };

  useEffect(() => {
    if (!isAuthenticate) {
      setOpenPositions([]);
      setPendingOrders([]);
      setOrderHistory([]);
      setSelectedPositions([]);
      setOpenPositionsError(null);
      setPendingOrdersError(null);
      setOrderHistoryError(null);
    }
  }, [isAuthenticate, activeTab]);

  useEffect(() => {
    setSelectedPositions([]);
  }, [selectedMarketType, activeTab]);

  useEffect(() => {
    if (selectedMarketType !== 'india') {
      setPositionsFilterIndianKind('all');
    }
  }, [selectedMarketType]);

  useEffect(() => {
    const filterVisible =
      activeTab === 'open-positions' ||
      (selectedMarketType === 'india' &&
        (activeTab === 'pending-orders' || activeTab === 'order-history'));
    if (!filterVisible) {
      setOpenPositionsFilterOpen(false);
      setPositionsFilterSide('all');
      setPositionsFilterSymbol('');
      setPositionsFilterIndianKind('all');
    } else if (selectedMarketType === 'india' && activeTab !== 'open-positions') {
      setOpenPositionsFilterOpen(false);
    }
  }, [activeTab, selectedMarketType]);

  useEffect(() => {
    if (!openPositionsFilterOpen) return;
    const onDocMouseDown = (e) => {
      const el = openPositionsFilterRef.current;
      if (el && !el.contains(e.target)) setOpenPositionsFilterOpen(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [openPositionsFilterOpen]);

  const buildClosePayload = (position) => {
    const raw = position.raw ?? {};
    const orderMarketType = getOrderMarketTypeKey(raw, position?.symbol || raw?.pairname || raw?.pair || raw?.symbol || '');

    // const mode = (position.side || raw?.side || raw?.mode || 'buy').toString().toLowerCase();
    // const price = Number(position.currentPrice ?? position.openPrice ?? raw?.liveprice ?? raw?.price ?? 0);
    const side = (position.side || raw?.side || raw?.mode || 'buy').toString();
    const mode = side.toLowerCase();

    const closePrice = resolveCurrentPriceForOrder({
      side,
      symbol: position.symbol || (raw?.pairname ?? raw?.pair ?? raw?.symbol ?? ''),
      orderMarketType,
      raw,
      fromApiPrice: null,
      openPrice: Number(position.openPrice ?? raw?.price ?? 0) || 0,
    });
    const price = Number(closePrice ?? position.currentPrice ?? position.openPrice ?? raw?.liveprice ?? raw?.price ?? 0);
    const lotSizeRaw = getOrderLotSizeValue(raw, 0);
    const quantityRaw = getOrderQuantityValue(raw, Number(position.quantityForPnl ?? 0));

    const quantity = quantityRaw > 0 ? quantityRaw : Number(position.volume ?? 0);
    const pair = position.symbol || (raw?.pairname ?? raw?.pair ?? raw?.symbol ?? '');
    const marketType = raw?.markettype === "MARKET" ? 2 : raw?.markettype === "LIMIT" ? 1 : 0;
    const orderno = raw?.orderno ?? null;
    const type = raw?.market ?? null;
    const pairid = raw?.type == "-" ? "" : raw?.type ?? 0;
    const lotsize = lotSizeRaw > 0 ? lotSizeRaw : (quantity > 0 && orderMarketType === 'india' ? quantity : 0);

    // return { mode, price, quantity, pair, marketType, orderno, type, pairid, lotsize };
    const exchange =
      orderMarketType === 'india'
        ? resolveIndiaOrderExchange({
          exchange: indiaExchange,
          symbol: pair,
          pairId: pairid,
          raw,
        })
        : '';

    return { mode, price, quantity, pair, marketType, orderno, type, pairid, lotsize, exchange, raw };
  };

  const handleClosePosition = (position) => {
    if (tradingSessionClosed) {
      showError(orderActionsBlockedMsg, 5000);
      return;
    }
    if (!position?.id || closingIds.includes(position.id)) return;
    setConfirmAction({
      kind: 'close-position',
      ids: [position.id],
    });
  };

  const handleCloseSelected = () => {
    if (tradingSessionClosed) {
      showError(orderActionsBlockedMsg, 5000);
      return;
    }
    if (selectedPositions.length === 0) return;
    setConfirmAction({
      kind: 'close-position',
      ids: [...selectedPositions],
    });
  };

  const handleCloseSelectedPendingOrders = (ids) => {
    if (tradingSessionClosed) {
      showError(orderActionsBlockedMsg, 5000);
      return;
    }
    if (!ids || ids.length === 0) return;
    setConfirmAction({
      kind: 'cancel-pending',
      ids: [...ids],
    });
  };

  const handleCancelSelection = () => {
    setSelectedPositions([]);
  };

  const handleEditTPSL = (position) => {
    if (tradingSessionClosed) {
      showError(orderActionsBlockedMsg, 5000);
      return;
    }
    setSelectedPosition(position);
    setTpslModalOpen(true);
  };

  const handleCloseTPSLModal = () => {
    if (tpslSaving) return;
    setTpslModalOpen(false);
    setSelectedPosition(null);
  };

  /** Open / pending lists: websocket only — reconnect streams after mutations. */
  const reconnectOrderListWs = useCallback(() => {
    if (!isAuthenticate) return;
    openOrderWs.reconnect();
    pendingOrderWs.reconnect();
  }, [isAuthenticate, openOrderWs.reconnect, pendingOrderWs.reconnect]);

  const handleSaveTPSL = async (data) => {
    if (tradingSessionClosed) {
      showError(orderActionsBlockedMsg, 5000);
      return;
    }
    if (!selectedPosition) return;
    const position = selectedPosition;
    const raw = position.raw ?? {};

    const pair = position.symbol || (raw?.pairname ?? raw?.pair ?? raw?.symbol ?? '');
    const liveprice = Number(position.currentPrice ?? raw?.liveprice ?? raw?.price ?? position.openPrice ?? 0);
    const tradeprofit = data.tp;
    const stoploss = data.sl;
    const type = raw?.market ?? null;
    const pairid = raw?.type === "-" ? 0 : raw?.type ?? 0;
    const orderno = data.orderno;

    if (!pair) {
      showError('Invalid pair for TP/SL update');
      return;
    }
    if (!Number.isFinite(liveprice) || liveprice <= 0) {
      showError('Invalid live price for TP/SL update');
      return;
    }

    const isBuy = (position.side || raw?.side || raw?.mode || 'Buy').toString().toLowerCase() === 'buy';
    const openPrice = Number(position.openPrice ?? raw?.openPrice ?? raw?.price ?? liveprice);

    // Exchange-style TP/SL editor allows users to freely add/remove TP or SL
    // without client-side directional blocking. Backend will apply final checks.

    const payload = {
      trademode: isBuy ? 'buy' : 'sell',
      pair,
      tradeprofit,
      stoploss,
      liveprice,
      type,
      pairid,
      orderno,
      exchange: resolveIndiaOrderExchange({
        exchange: indiaExchange,
        symbol: pair,
        pairId: pairid,
        raw,
      }),
      raw,
      // orderno
    };

    setTpslSaving(true);
    try {
      await updateOrderTpSl(payload);
      showSuccess('TP/SL updated successfully');

      setOpenPositions((prev) =>
        prev.map((rawPos) => {
          const id = rawPos?.id ?? rawPos?.orderId ?? rawPos?.order_id ?? rawPos?.usertranid ?? rawPos?._id;
          if (id !== position.id) return rawPos;
          const updated = { ...rawPos };
          if (tradeprofit != null) {
            updated.tradeprofit = tradeprofit;
            updated.profitrade = tradeprofit;
            updated.tp = tradeprofit;
          } else {
            updated.tradeprofit = null;
            updated.profitrade = null;
            updated.tp = null;
          }
          if (stoploss != null) {
            updated.stoploss = stoploss;
            updated.sl = stoploss;
          } else {
            updated.stoploss = null;
            updated.sl = null;
          }
          return updated;
        }),
      );

      const updateRow = (prev) =>
        prev.map((rawPos) => {
          const id = rawPos?.id ?? rawPos?.orderId ?? rawPos?.order_id ?? rawPos?.usertranid ?? rawPos?._id;
          if (id !== selectedPosition.id) return rawPos;

          return {
            ...rawPos,
            tradeprofit, profitrade: tradeprofit, tp: tradeprofit,
            stoploss, sl: stoploss
          };
        });

      setOpenPositions?.(updateRow);
      setPendingOrders?.(updateRow);

      setTpslModalOpen(false);
      setSelectedPosition(null);

      reconnectOrderListWs()

    } catch (err) {
      const msg = err?.message || err?.data?.message || 'Failed to update TP/SL';
      showError(msg, 5000);
    } finally {
      setTpslSaving(false);
    }
  };

  const getSymbolIcon = (base) => {
    const colors = {
      BTC: '#FF9500',
      ETH: '#627EEA',
      SOL: '#14F195',
      BNB: '#F3BA2F',
    };
    return colors[base] || '#666';
  };

  const normalizedOpenPositions = useMemo(() => {
    const list = Array.isArray(openPositions) ? openPositions : [];
    return list
      .filter((raw) => {
        const symbolRaw = raw?.pairname ?? raw?.pair ?? raw?.symbol ?? raw?.pairName ?? '';
        const symbol = normalizeSymbol(symbolRaw);
        const orderMarketType = getOrderMarketTypeKey(raw, symbol);
        return selectedMarketType ? orderMarketType === selectedMarketType : true;
      })
      .map((raw, idx) => {
        const id = raw?.id ?? raw?.orderId ?? raw?.order_id ?? raw?.usertranid ?? raw?._id ?? `pos-${idx}`;
        const orderNo = raw?.orderno ?? raw?.orderNo ?? raw?.order_no ?? null;
        const symbolRaw = raw?.pairname ?? raw?.pair ?? raw?.symbol ?? raw?.pairName ?? pair ?? '';
        const symbol = normalizeSymbol(symbolRaw) || String(symbolRaw).replace(/\//g, '').toUpperCase().trim() || '-';
        const orderMarketType = getOrderMarketTypeKey(raw, symbol);
        const isIndiaOrder = orderMarketType === 'india';
        const indianInstrumentKind = isIndiaOrder ? getIndianInstrumentKind(symbolRaw) : null;
        const displaySymbol = isIndiaOrder
          ? formatIndianOrderPairDisplay(symbolRaw)
          : (symbol || '-');
        const base = isIndiaOrder
          ? (getIndianOrderUnderlyingForIcon(symbolRaw) || symbol.replace(/^[^:]+:\:?/, '').slice(0, 12) || 'NA')
          : (symbol.replace(/(USDT|USD|INR)$/i, '') || symbol || 'NA');
        const symbolTooltip = String(symbolRaw).trim() || symbol;
        const sideRaw = raw?.side ?? raw?.mode ?? raw?.positionSide ?? raw?.direction ?? raw?.ordertype ?? '';
        const side = String(sideRaw).toLowerCase() === 'sell' ? 'Sell' : 'Buy';

        const lotSizeNum = getOrderLotSizeValue(raw, 0);
        const quantityNum = getOrderQuantityValue(raw, 0);
        const qtyNum = getOrderSizeValue(raw, 0);
        const openPrice = Number(raw?.price ?? raw?.openPrice ?? raw?.entryPrice ?? raw?.avgPrice ?? raw?.avg_price ?? 0) || 0;
        const fromApiPrice = Number(
          raw?.liveprice
          ?? raw?.currentPrice
          ?? raw?.current_price
          ?? raw?.markPrice
          ?? raw?.lastPrice
          ?? raw?.livePrice
          ?? 0
        ) || null;
        const fromApiPriceValid = fromApiPrice != null && !Number.isNaN(fromApiPrice) && fromApiPrice > 0;
        const currentPrice = resolveCurrentPriceForOrder({
          side,
          symbol,
          orderMarketType,
          raw,
          fromApiPrice: fromApiPriceValid ? fromApiPrice : null,
          openPrice,
        });

        const tp = raw?.current_profitrade ?? raw?.profitrade ?? raw?.tradeprofit ?? raw?.tp ?? raw?.takeProfit ?? null;
        const sl = raw?.current_stoploss ?? raw?.stoploss ?? raw?.stopLoss ?? raw?.sl ?? null;
        const commission = Number(raw?.tranfee ?? raw?.commission ?? raw?.fee ?? 0) || 0;
        const leverage = Number(raw?.leverage ?? 0) || 0;
        const usedMargin = Number(raw?.usedmargin ?? raw?.usedMargin ?? 0) || 0;
        const totalAmt = Number(raw?.totalamt ?? raw?.totalAmt ?? 0) || 0;
        const status = String(raw?.istatus ?? raw?.status ?? '').toUpperCase() || '-';

        const marketTag = getOrderMarketTag(raw, symbol);
        const qtyForPnl = resolveQtyForPnl(orderMarketType, {
          lotSize: lotSizeNum,
          quantity: quantityNum,
          sizeFallback: qtyNum,
        });
        const rawProfit = Number(
          raw?.profit
          ?? raw?.pnl
          ?? raw?.unrealizedPnl
          ?? raw?.unrealized_pnl
          ?? 0
        ) || 0;
        const rawProfitPercent = raw?.pnlpercent ?? raw?.profitPercent ?? raw?.profitpercent ?? null;
        const { profit: pnl, profitPercent: pnlPct } = computeOpenPositionPnl({
          side,
          openPrice,
          currentPrice,
          qtyForPnl,
          usedMargin,
          leverage,
          totalAmt,
          isIndiaOrder,
          inrPerUsdt,
          orderMarketType,
          rawProfit,
          rawProfitPercent,
        });

        const openAt = raw?.ondate ?? raw?.openTime ?? raw?.open_time ?? raw?.createdAt ?? raw?.created_at ?? raw?.time ?? raw?.timestamp ?? null;
        const dateObj = openAt ? new Date(openAt) : null;
        const openTimeFull = dateObj && !Number.isNaN(dateObj.getTime()) ? dateObj.toLocaleString() : (openAt ? String(openAt) : '-');
        const openTime = dateObj && !Number.isNaN(dateObj.getTime()) ? dateObj.toLocaleTimeString() : '-';

        const expiryTimeFull = formatExpiryDate(raw?.expireddate ?? raw?.expiredDate ?? raw?.expirydate ?? raw?.expiryDate ?? null);

        const liquidityPrice = Number(raw?.soprice ?? 0) || 0;
        const type = raw?.market ?? null;

        return {
          id,
          orderNo,
          orderno: orderNo,
          base,
          symbol: symbol || '-',
          displaySymbol,
          symbolTooltip,
          side,
          volume: qtyNum,
          lotsize: lotSizeNum,
          quantity: quantityNum,
          quantityForPnl: qtyForPnl,
          openPrice,
          currentPrice,
          tp: tp ?? '-',
          sl: sl ?? '-',
          openTime,
          openTimeFull,
          expiryTimeFull,
          commission,
          leverage,
          usedMargin,
          totalAmt,
          status,
          profit: Number.isFinite(pnl) ? pnl : 0,
          profitPercent: Number.isFinite(pnlPct) ? pnlPct : 0,
          raw,
          liquidityPrice,
          marketTag,
          type,
          indianInstrumentKind,
        };
      });
  }, [openPositions, selectedMarketType, resolveCurrentPriceForOrder, inrPerUsdt, getOrderSizeValue, marketData]);

  useEffect(() => {
    if (!tpslModalOpen || !selectedPosition) return;
    const selectedId = selectedPosition.id;
    if (!selectedId) return;
    const latest = normalizedOpenPositions.find((p) => p.id === selectedId);
    if (!latest) return;
    const priceChanged = Number(latest.currentPrice ?? 0) !== Number(selectedPosition.currentPrice ?? 0);
    const qtyChanged = Number(latest.quantityForPnl ?? latest.volume ?? 0) !== Number(selectedPosition.quantityForPnl ?? selectedPosition.volume ?? 0);
    const pnlChanged = Number(latest.profit ?? 0) !== Number(selectedPosition.profit ?? 0);
    if (priceChanged || qtyChanged || pnlChanged) {
      setSelectedPosition(latest);
    }
  }, [tpslModalOpen, selectedPosition, normalizedOpenPositions]);

  const filteredOpenPositions = useMemo(() => {
    let list = normalizedOpenPositions;
    if (selectedMarketType === 'india' && positionsFilterIndianKind !== 'all') {
      list = list.filter((p) => p.indianInstrumentKind === positionsFilterIndianKind);
    }
    if (positionsFilterSide !== 'all') {
      const want = positionsFilterSide === 'buy' ? 'Buy' : 'Sell';
      list = list.filter((p) => p.side === want);
    }
    const q = positionsFilterSymbol.trim().toLowerCase();
    if (q) {
      list = list.filter((p) => {
        const hay = `${p.symbol || ''} ${p.displaySymbol || ''} ${p.symbolTooltip || ''}`.toLowerCase();
        return hay.includes(q);
      });
    }
    return list;
  }, [normalizedOpenPositions, positionsFilterSide, positionsFilterSymbol, positionsFilterIndianKind, selectedMarketType]);

  const hasOrdersPanelFilters =
    positionsFilterSide !== 'all' ||
    positionsFilterSymbol.trim() !== '' ||
    (selectedMarketType === 'india' && positionsFilterIndianKind !== 'all');

  const openPositionsTotalPnL = useMemo(() => {
    const list = filteredOpenPositions;
    const totalProfit = list.reduce((sum, p) => sum + (Number(p.profit) || 0), 0);
    const totalMargin = list.reduce((sum, p) => sum + (Number(p.usedMargin) || 0), 0);
    const totalPct = totalMargin > 0 ? (totalProfit / totalMargin) * 100 : 0;
    return {
      totalPnL: totalProfit,
      totalMargin,
      totalPnLPercent: totalPct,
      isProfit: totalProfit >= 0,
    };
  }, [filteredOpenPositions]);

  const formatPnlCurrency = useCallback((profitUsdt, marketKey = selectedMarketType) => {
    const p = Number(profitUsdt || 0);
    const isIndia = String(marketKey || '').toLowerCase() === 'india';
    if (isIndia && indiaPnlCurrency === 'inr') {
      const inrValue = p * inrPerUsdt;
      return `${inrValue >= 0 ? '+' : ''}${inrValue.toLocaleString('en-IN', { minimumFractionDigits: 4, maximumFractionDigits: 4 })} INR`;
    }
    return `${p >= 0 ? '+' : ''}${p.toFixed(4)} USDT`;
  }, [selectedMarketType, indiaPnlCurrency, inrPerUsdt]);

  const handleExportOpenPositionsCsv = useCallback(() => {
    const rows = filteredOpenPositions;
    if (rows.length === 0) {
      showError('No positions to export. Adjust filters or open a position first.');
      return;
    }
    const header = [
      'Symbol',
      'Market',
      'Side',
      'Volume',
      'Leverage',
      'Used Margin',
      'Open Price',
      'Liquidity Price',
      'Current Price',
      'TP',
      'SL',
      'Open Time',
      'Commission',
      'Profit',
      'Profit %',
    ];
    const lines = [header.map(csvEscapeCell).join(',')];
    rows.forEach((p) => {
      lines.push(
        [
          p.displaySymbol || p.symbol,
          p.marketTag,
          p.side,
          p.volume,
          p.leverage,
          p.usedMargin,
          p.openPrice,
          p.liquidityPrice,
          p.currentPrice,
          p.tp,
          p.sl,
          p.openTimeFull,
          p.commission,
          p.profit,
          p.profitPercent,
        ]
          .map(csvEscapeCell)
          .join(',')
      );
    });
    const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `open-positions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showSuccess(`Exported ${rows.length} row${rows.length === 1 ? '' : 's'} to CSV`);
  }, [filteredOpenPositions, showError, showSuccess]);

  const normalizedPendingOrders = useMemo(() => {
    const list = Array.isArray(pendingOrders) ? pendingOrders : [];
    return list
      .filter((raw) => {
        const symbolRaw = raw?.pairname ?? raw?.pair ?? raw?.symbol ?? raw?.pairName ?? '';
        const symbol = normalizeSymbol(symbolRaw);
        const orderMarketType = getOrderMarketTypeKey(raw, symbol);
        return selectedMarketType ? orderMarketType === selectedMarketType : true;
      })
      .map((raw, idx) => {
        const id = raw?.id ?? raw?.orderId ?? raw?.order_id ?? raw?.usertranid ?? raw?._id ?? `pending-${idx}`;
        const orderNo = raw?.orderno ?? raw?.orderNo ?? raw?.order_no ?? null;
        const type = raw?.market ?? null;
        const symbolRaw = raw?.pairname ?? raw?.pair ?? raw?.symbol ?? raw?.pairName ?? pair ?? '';
        const symbol = normalizeSymbol(symbolRaw) || String(symbolRaw).replace(/\//g, '').toUpperCase().trim() || '-';
        const orderMarketType = getOrderMarketTypeKey(raw, symbol);
        const isIndiaOrder = orderMarketType === 'india';
        const indianInstrumentKind = isIndiaOrder ? getIndianInstrumentKind(symbolRaw) : null;
        const displaySymbol = isIndiaOrder
          ? formatIndianOrderPairDisplay(symbolRaw)
          : (symbol || '-');
        const base = isIndiaOrder
          ? (getIndianOrderUnderlyingForIcon(symbolRaw) || symbol.replace(/^[^:]+:\:?/, '').slice(0, 12) || 'NA')
          : (symbol.replace(/(USDT|USD|INR)$/i, '') || symbol || 'NA');
        const symbolTooltip = String(symbolRaw).trim() || symbol;
        const sideRaw = raw?.side ?? raw?.mode ?? raw?.positionSide ?? raw?.direction ?? raw?.ordertype ?? '';
        const side = String(sideRaw).toLowerCase() === 'sell' ? 'Sell' : 'Buy';
        const marketTypeRaw = String(raw?.markettype ?? raw?.marketType ?? raw?.type ?? '').toUpperCase();
        const orderType = marketTypeRaw === 'MARKET' ? 'Market' : 'Limit';
        const openPrice = Number(raw?.price ?? raw?.orderPrice ?? raw?.limitPrice ?? raw?.openPrice ?? 0) || 0;
        const fromApiPrice = Number(
          raw?.liveprice
          ?? raw?.currentPrice
          ?? raw?.current_price
          ?? raw?.markPrice
          ?? raw?.lastPrice
          ?? 0
        ) || null;
        const fromApiPriceValid = fromApiPrice != null && !Number.isNaN(fromApiPrice) && fromApiPrice > 0;
        const currentPrice = resolveCurrentPriceForOrder({
          side,
          symbol,
          orderMarketType,
          raw,
          fromApiPrice: fromApiPriceValid ? fromApiPrice : null,
          openPrice,
        });
        const quantity = getOrderSizeValue(raw, 0);
        const quantityRaw = getOrderQuantityValue(raw, 0);
        const qtyForPnl = isIndiaOrder
          ? (quantityRaw > 0 ? quantityRaw : quantity)
          : quantity;
        const tp = raw?.profitrade ?? raw?.tradeprofit ?? raw?.tp ?? raw?.takeProfit ?? null;
        const sl = raw?.stoploss ?? raw?.stopLoss ?? raw?.sl ?? null;
        const fee = Number(raw?.tranfee ?? raw?.commission ?? raw?.fee ?? 0) || 0;
        const leverage = Number(raw?.leverage ?? 0) || 0;
        const totalAmt = Number(raw?.totalamt ?? raw?.totalAmt ?? 0) || 0;
        const usedMargin = Number(raw?.usedmargin ?? raw?.usedMargin ?? 0) || 0;
        const status = String(raw?.istatus ?? raw?.status ?? '').toUpperCase() || 'PENDING';
        const createdAt = raw?.ondate ?? raw?.createdAt ?? raw?.created_at ?? raw?.time ?? raw?.timestamp ?? null;
        const dateObj = createdAt ? new Date(createdAt) : null;
        const createdTimeFull = dateObj && !Number.isNaN(dateObj.getTime()) ? dateObj.toLocaleString() : (createdAt ? String(createdAt) : '-');
        const createdTime = dateObj && !Number.isNaN(dateObj.getTime()) ? dateObj.toLocaleTimeString() : '-';

        const expiryTimeFull = formatExpiryDate(raw?.expireddate ?? raw?.expiredDate ?? raw?.expirydate ?? raw?.expiryDate ?? null);

        const liquidityPrice = Number(raw?.soprice ?? 0) || 0;
        const marketTag = getOrderMarketTag(raw, symbol);

        return {
          id,
          orderNo,
          orderno: orderNo,
          type,
          base,
          symbol: symbol || '-',
          displaySymbol,
          symbolTooltip,
          side,
          orderType,
          price: openPrice,
          openPrice,
          currentPrice,
          quantity,
          tp: tp ?? '-',
          sl: sl ?? '-',
          createdTime,
          createdTimeFull,
          expiryTimeFull,
          fee,
          leverage,
          usedMargin,
          totalAmt,
          status,
          raw,
          liquidityPrice,
          marketTag,
          indianInstrumentKind,
        };
      });
  }, [pendingOrders, selectedMarketType, getOrderSizeValue, resolveCurrentPriceForOrder, marketData]);

  const normalizedOrderHistory = useMemo(() => {
    const list = Array.isArray(orderHistory) ? orderHistory : [];
    return list
      .filter((raw) => {
        const symbolRaw = raw?.pairname ?? raw?.pair ?? raw?.symbol ?? raw?.pairName ?? '';
        const symbol = normalizeSymbol(symbolRaw);
        const orderMarketType = getOrderMarketTypeKey(raw, symbol);
        return selectedMarketType ? orderMarketType === selectedMarketType : true;
      })
      .map((raw, idx) => {
        const id = raw?.id ?? raw?.orderId ?? raw?.order_id ?? raw?.usertranid ?? raw?._id ?? `history-${idx}`;
        const orderNo = raw?.orderno ?? raw?.orderNo ?? '';
        const symbolRaw = raw?.pairname ?? raw?.pair ?? raw?.symbol ?? raw?.pairName ?? pair ?? '';
        const symbol = normalizeSymbol(symbolRaw) || String(symbolRaw).replace(/\//g, '').toUpperCase().trim() || '-';
        const orderMarketType = getOrderMarketTypeKey(raw, symbol);
        const isIndiaOrder = orderMarketType === 'india';
        const indianInstrumentKind = isIndiaOrder ? getIndianInstrumentKind(symbolRaw) : null;
        const displaySymbol = isIndiaOrder
          ? formatIndianOrderPairDisplay(symbolRaw)
          : (symbol || '-');
        const base = isIndiaOrder
          ? (getIndianOrderUnderlyingForIcon(symbolRaw) || symbol.replace(/^[^:]+:\:?/, '').slice(0, 12) || 'NA')
          : (symbol.replace(/(USDT|USD|INR)$/i, '') || symbol || 'NA');
        const symbolTooltip = String(symbolRaw).trim() || symbol;
        const sideRaw = raw?.side ?? raw?.mode ?? raw?.positionSide ?? raw?.direction ?? raw?.ordertype ?? '';
        const side = String(sideRaw).toLowerCase() === 'sell' ? 'Sell' : 'Buy';
        const quantity = Number(
          raw?.quantity ?? raw?.lotsize ?? raw?.qty ?? raw?.size ?? raw?.volume ?? raw?.amount ?? 0
        ) || 0;
        const openPrice = Number(raw?.openprice ?? raw?.openPrice ?? raw?.openbuyprice ?? raw?.opensellprice ?? 0) || 0;
        const closePrice = Number(raw?.price ?? raw?.closeprice ?? raw?.closePrice ?? 0) || 0;
        const tp = raw?.profitrade ?? raw?.tradeprofit ?? raw?.tp ?? raw?.takeProfit ?? raw?.current_profitrade ?? 0;
        const sl = raw?.stoploss ?? raw?.stopLoss ?? raw?.sl ?? raw?.current_stoploss ?? 0;
        const fee = Number(raw?.tranfee ?? raw?.commission ?? raw?.fee ?? 0) || 0;
        const leverage = Number(raw?.leverage ?? 0) || 0;
        const totalAmt = Number(raw?.totalamt ?? raw?.totalAmt ?? 0) || 0;
        const usedMargin = Number(raw?.usedmargin ?? raw?.usedMargin ?? 0) || 0;
        const status = String(raw?.istatus ?? raw?.status ?? raw?.orderStatus ?? '').toUpperCase() || 'CLOSED';
        const closedAt = raw?.closedAt ?? raw?.closed_at ?? raw?.ondate ?? raw?.createdAt ?? raw?.created_at ?? raw?.time ?? raw?.timestamp ?? null;
        const dateObj = closedAt ? new Date(closedAt) : null;
        const closedTimeFull = dateObj && !Number.isNaN(dateObj.getTime()) ? dateObj.toLocaleString() : (closedAt ? String(closedAt) : '-');
        const closedTime = dateObj && !Number.isNaN(dateObj.getTime()) ? dateObj.toLocaleTimeString() : '-';

        const expiryTimeFull = formatExpiryDate(raw?.expireddate ?? raw?.expiredDate ?? raw?.expirydate ?? raw?.expiryDate ?? null);

        const profit = Number(raw?.pnlamount ?? raw?.profit ?? raw?.pnl ?? raw?.realizedPnl ?? raw?.realized_pnl ?? 0) || 0;
        const apiPct = Number(raw?.pnlpercent ?? raw?.profitPercent ?? raw?.profitpercent ?? 0) || 0;
        const profitPct =
          Math.abs(apiPct) > 1e-12
            ? apiPct
            : computeClosedPositionPnlPercent(
              profit,
              openPrice,
              quantity,
              usedMargin,
              totalAmt,
              leverage,
            );
        const marketTag = getOrderMarketTag(raw, symbol);
        const segmentKey = getOrderMarketTypeKey(raw, symbol) || 'crypto';
        const marketLabel =
          String(raw?.market ?? raw?.segment ?? '').trim() ||
          String(marketTag).replace(/—/g, '').trim() ||
          segmentKey;
        const execTypeLabel = getHistoryExecTypeLabel(raw);
        const statusLabel = String(status).toLowerCase() === 'close' || status === 'CLOSED' ? 'Closed' : status;

        return {
          id,
          orderNo,
          orderno: orderNo,
          base,
          symbol: symbol || '-',
          displaySymbol,
          symbolTooltip,
          side,
          orderType: execTypeLabel,
          openPrice,
          closePrice,
          quantity,
          tp: tp ?? '0',
          sl: sl ?? '0',
          closedTime,
          closedTimeFull,
          expiryTimeFull,
          fee,
          leverage,
          usedMargin,
          totalAmt,
          status,
          statusLabel,
          profit: Number.isFinite(profit) ? profit : 0,
          profitPct: Number.isFinite(profitPct) ? profitPct : 0,
          raw,
          marketTag,
          segmentKey,
          marketLabel,
          tpslActions: Array.isArray(raw?.tpsl_actions) ? raw.tpsl_actions : [],
          indianInstrumentKind,
        };
      });
  }, [orderHistory, pair, selectedMarketType]);

  const filteredPendingOrders = useMemo(() => {
    let list = normalizedPendingOrders;
    if (selectedMarketType === 'india' && positionsFilterIndianKind !== 'all') {
      list = list.filter((o) => o.indianInstrumentKind === positionsFilterIndianKind);
    }
    if (positionsFilterSide !== 'all') {
      const want = positionsFilterSide === 'buy' ? 'Buy' : 'Sell';
      list = list.filter((o) => o.side === want);
    }
    const q = positionsFilterSymbol.trim().toLowerCase();
    if (q) {
      list = list.filter((o) => {
        const hay = `${o.symbol || ''} ${o.displaySymbol || ''} ${o.symbolTooltip || ''}`.toLowerCase();
        return hay.includes(q);
      });
    }
    return list;
  }, [normalizedPendingOrders, positionsFilterIndianKind, positionsFilterSide, positionsFilterSymbol, selectedMarketType]);

  const filteredOrderHistory = useMemo(() => {
    let list = normalizedOrderHistory;
    if (selectedMarketType === 'india' && positionsFilterIndianKind !== 'all') {
      list = list.filter((o) => o.indianInstrumentKind === positionsFilterIndianKind);
    }
    if (positionsFilterSide !== 'all') {
      const want = positionsFilterSide === 'buy' ? 'Buy' : 'Sell';
      list = list.filter((o) => o.side === want);
    }
    const q = positionsFilterSymbol.trim().toLowerCase();
    if (q) {
      list = list.filter((o) => {
        const hay = `${o.symbol || ''} ${o.displaySymbol || ''} ${o.symbolTooltip || ''}`.toLowerCase();
        return hay.includes(q);
      });
    }
    return list;
  }, [normalizedOrderHistory, positionsFilterIndianKind, positionsFilterSide, positionsFilterSymbol, selectedMarketType]);

  const openOrderDetails = useCallback((order, sourceTab) => {
    if (!order) return;
    setSelectedOrderDetails({ ...order, _sourceTab: sourceTab });
    setShowOrderDetailsModal(true);
  }, []);

  const selectedOrderDetailsLive = useMemo(() => {
    if (!selectedOrderDetails) return null;
    const source = selectedOrderDetails._sourceTab || 'open-positions';
    const sourceList =
      source === 'open-positions'
        ? normalizedOpenPositions
        : source === 'pending-orders'
          ? normalizedPendingOrders
          : normalizedOrderHistory;

    if (!Array.isArray(sourceList) || sourceList.length === 0) return selectedOrderDetails;
    const latest = sourceList.find((row) =>
      row?.id === selectedOrderDetails.id ||
      (selectedOrderDetails.orderNo && row?.orderNo === selectedOrderDetails.orderNo)
    );
    return latest ? { ...latest, _sourceTab: source } : selectedOrderDetails;
  }, [selectedOrderDetails, normalizedOpenPositions, normalizedPendingOrders, normalizedOrderHistory]);

  const selectedDetailsOrderNo = useMemo(
    () => resolveOrderNo(selectedOrderDetailsLive),
    [selectedOrderDetailsLive]
  );

  const indianInstrumentCounts = useMemo(() => {
    if (selectedMarketType !== 'india') return null;
    let source = [];
    if (activeTab === 'open-positions') source = normalizedOpenPositions;
    else if (activeTab === 'pending-orders') source = normalizedPendingOrders;
    else if (activeTab === 'order-history') source = normalizedOrderHistory;
    const c = { futures: 0, ce: 0, pe: 0, other: 0, total: source.length };
    for (const row of source) {
      const k = row.indianInstrumentKind;
      if (k === 'futures') c.futures += 1;
      else if (k === 'ce') c.ce += 1;
      else if (k === 'pe') c.pe += 1;
      else if (k === 'other') c.other += 1;
    }
    return c;
  }, [
    selectedMarketType,
    activeTab,
    normalizedOpenPositions,
    normalizedPendingOrders,
    normalizedOrderHistory,
  ]);

  const ordersFilterVisible =
    activeTab === 'open-positions' ||
    (selectedMarketType === 'india' &&
      (activeTab === 'pending-orders' || activeTab === 'order-history'));

  const clearOrdersPanelFilters = () => {
    setPositionsFilterSide('all');
    setPositionsFilterSymbol('');
    setPositionsFilterIndianKind('all');
  };

  useEffect(() => {
    if (refreshTrigger === undefined || refreshTrigger === null) return;
    const prev = prevOrdersRefreshTriggerRef.current;
    if (prev !== null && prev !== refreshTrigger) {
      clearOrdersPanelFilters();
      setSelectedPositions([]);
      setOpenPositionsFilterOpen(false);
      if (isAuthenticate) {
        openOrderWs.reconnect();
        pendingOrderWs.reconnect();
      }
    }
    prevOrdersRefreshTriggerRef.current = refreshTrigger;
  }, [refreshTrigger, isAuthenticate, openOrderWs.reconnect, pendingOrderWs.reconnect]);

  useEffect(() => {
    setOpenPositions(openOrderWs.orders);
  }, [openOrderWs.orders]);

  useEffect(() => {
    setPendingOrders(pendingOrderWs.orders);
  }, [pendingOrderWs.orders]);

  useEffect(() => {
    if (!isAuthenticate) {
      setOpenPositionsLoading(false);
      setOpenPositionsError(null);
      return;
    }
    if (openOrderWs.hasSnapshot) {
      setOpenPositionsLoading(false);
      setOpenPositionsError(null);
      return;
    }
    if (openOrderWs.error) {
      const msg = openOrderWs.error?.message || String(openOrderWs.error);
      setOpenPositionsError(msg);
      setOpenPositionsLoading(false);
      return;
    }
    setOpenPositionsLoading(true);
    setOpenPositionsError(null);
  }, [isAuthenticate, openOrderWs.hasSnapshot, openOrderWs.error]);

  useEffect(() => {
    if (!isAuthenticate) {
      setPendingOrdersLoading(false);
      setPendingOrdersError(null);
      return;
    }
    if (pendingOrderWs.hasSnapshot) {
      setPendingOrdersLoading(false);
      setPendingOrdersError(null);
      return;
    }
    if (pendingOrderWs.error) {
      const msg = pendingOrderWs.error?.message || String(pendingOrderWs.error);
      setPendingOrdersError(msg);
      setPendingOrdersLoading(false);
      return;
    }
    setPendingOrdersLoading(true);
    setPendingOrdersError(null);
  }, [isAuthenticate, pendingOrderWs.hasSnapshot, pendingOrderWs.error]);

  useEffect(() => {
    if (!isAuthenticate) return;
    const id = setInterval(() => {
      if (!openOrderWs.isConnected) openOrderWs.reconnect();
      if (!pendingOrderWs.isConnected) pendingOrderWs.reconnect();
    }, 6000);
    return () => clearInterval(id);
  }, [isAuthenticate, openOrderWs.isConnected, pendingOrderWs.isConnected, openOrderWs.reconnect, pendingOrderWs.reconnect]);

  useEffect(() => {
    if (!isAuthenticate) return;
    const onSilent = () => reconnectOrderListWs();
    window.addEventListener('refresh-orders-silent', onSilent);
    return () => window.removeEventListener('refresh-orders-silent', onSilent);
  }, [isAuthenticate, reconnectOrderListWs]);

  useEffect(() => {
    if (activeTab !== 'order-history' || !isAuthenticate) return;
    let cancelled = false;

    const fetchOrderHistory = async (silent = false) => {
      if (!silent) setOrderHistoryLoading(true);
      setOrderHistoryError(null);
      try {
        const res = await getOrderHistory();
        const data = res?.data ?? res?.result ?? res ?? {};
        const list = Array.isArray(data)
          ? data
          : (Array.isArray(data?.data) ? data.data : null)
          ?? (Array.isArray(data?.list) ? data.list : null)
          ?? (Array.isArray(data?.orders) ? data.orders : null)
          ?? (Array.isArray(data?.history) ? data.history : null)
          ?? (Array.isArray(data?.orderHistory) ? data.orderHistory : null)
          ?? (Array.isArray(data?.order_history) ? data.order_history : null)
          ?? [];
        if (!cancelled) setOrderHistory(list);
      } catch (err) {
        const msg = err?.message || err?.data?.message || 'Failed to load order history';
        if (!cancelled) {
          setOrderHistoryError(msg);
          setOrderHistory([]);
        }
        showError(msg, 5000);
      } finally {
        if (!cancelled) setOrderHistoryLoading(false);
      }
    };

    fetchOrderHistory(false);

    const handleSilentRefresh = () => fetchOrderHistory(true);
    window.addEventListener('refresh-orders-silent', handleSilentRefresh);

    return () => {
      cancelled = true;
      window.removeEventListener('refresh-orders-silent', handleSilentRefresh);
    };
  }, [activeTab, showError, isAuthenticate, refreshTrigger]);

  const handleCancelOrder = (orderId, orderType) => {
    if (tradingSessionClosed) {
      showError(orderActionsBlockedMsg, 5000);
      return;
    }
    setConfirmAction({
      kind: 'cancel-pending',
      ids: [orderId],
      orderType,
    });
  };

  const getLivePriceForSymbol = useCallback(
    (symbol, side = 'Buy') => {
      const key = normalizeSymbol(symbol);
      if (!key) return null;
      const px = resolveCurrentPriceForOrder({
        side,
        symbol: key,
        orderMarketType: selectedMarketType,
        raw: null,
        fromApiPrice: null,
        openPrice: 0,
      });
      return px > 0 ? px : null;
    },
    [resolveCurrentPriceForOrder, selectedMarketType],
  );

  const confirmRows = useMemo(() => {
    if (!confirmAction || !Array.isArray(confirmAction.ids)) return { open: [], pending: [] };
    const idSet = new Set(confirmAction.ids);
    const open = normalizedOpenPositions.filter((p) => idSet.has(p.id));
    const pending = normalizedPendingOrders.filter((o) => idSet.has(o.orderNo) || idSet.has(o.id));
    return { open, pending };
  }, [confirmAction, normalizedOpenPositions, normalizedPendingOrders]);

  const confirmSummary = useMemo(() => {
    const openRows = confirmRows.open;
    const pendingRows = confirmRows.pending;
    if (!confirmAction) return null;

    if (confirmAction.kind === 'close-position') {
      const livePnl = openRows.reduce((s, r) => s + (Number(r.profit) || 0), 0);
      const livePnlPct = openRows.length > 0
        ? openRows.reduce((s, r) => s + (Number(r.profitPercent) || 0), 0) / openRows.length
        : 0;
      const livePx = openRows[0]?.currentPrice ?? null;
      return { livePnl, livePnlPct, livePx };
    }

    if (confirmAction.kind === 'cancel-pending') {
      let est = 0;
      pendingRows.forEach((r) => {
        const livePx = getLivePriceForSymbol(r.symbol, r.side);
        if (!Number.isFinite(livePx) || livePx <= 0) return;
        const orderPx = Number(r.price) || 0;
        const qty = Number(r.quantity) || 0;
        if (orderPx <= 0 || qty <= 0) return;
        const dir = r.side === 'Sell' ? -1 : 1;
        est += (livePx - orderPx) * qty * dir;
      });
      const livePx = pendingRows[0] ? getLivePriceForSymbol(pendingRows[0].symbol, pendingRows[0].side) : null;
      return { estimatedPnl: est, livePx };
    }

    return null;
  }, [confirmAction, confirmRows, getLivePriceForSymbol]);

  const closeConfirmModal = useCallback(() => {
    if (confirmActionLoading) return;
    setConfirmAction(null);
  }, [confirmActionLoading]);

  const handleConfirmAction = useCallback(async () => {
    if (!confirmAction || !Array.isArray(confirmAction.ids) || confirmAction.ids.length === 0) return;
    if (tradingSessionClosed) {
      showError(orderActionsBlockedMsg, 5000);
      setConfirmAction(null);
      return;
    }
    setConfirmActionLoading(true);
    try {
      if (confirmAction.kind === 'close-position') {
        const toClose = normalizedOpenPositions.filter((p) => confirmAction.ids.includes(p.id));
        if (toClose.length === 0) {
          showError('Position not found for close action');
          return;
        }
        setClosingIds((prev) => [...new Set([...prev, ...toClose.map((p) => p.id)])]);
        let successCount = 0;
        let lastError = null;

        const groups = {};
        for (const position of toClose) {
          const pData = buildClosePayload(position);
          if (!pData.pair || pData.quantity <= 0) continue;

          const raw = position.raw ?? {};
          const rawType = getOrderMarketTypeKey(raw, position?.symbol || raw?.pairname || raw?.pair || raw?.symbol || '');
          const typeMap = { 'crypto': 'CRYPTO', 'forex': 'FOREX', 'india': 'INDIAN' };
          const type = typeMap[rawType] || '';
          const mode = pData.mode || '';
          const key = `${type}_${mode}`;

          if (!groups[key]) groups[key] = { type, mode, positions: [], items: [] };

          const item = {
            price: Number(pData.price),
            quantity: Number(pData.quantity),
            orderno: pData.orderno,
            markettypeid: pData.marketType,
            mode: pData.mode,
          };
          if (type === 'INDIAN') {
            item.pairname = pData.pair;
            item.pairid = pData.pairid;
            item.lotsize = Number(pData.lotsize);
            if (pData.exchange) item.exchange = pData.exchange;
          } else if (type === 'FOREX') {
            item.pairname = pData.pair;
            item.lotsize = Number(pData.lotsize);
          } else {
            item.pairname = pData.pair;
          }
          groups[key].items.push(item);
          groups[key].positions.push(position);
        }

        for (const groupKey of Object.keys(groups)) {
          const group = groups[groupKey];

          const deviceInfo = await getDeviceInfo();

          try {
            const payload = {
              mode: group.mode,
              trademode: 'close',
              type: group.type,
              ordersjson: group.items,
              device_info: deviceInfo, // device info
            };

            if (group.type === 'INDIAN') {
              const exchanges = group.items
                .map((item) => String(item?.exchange || '').trim())
                .filter(Boolean);
              const unique = [...new Set(exchanges)];
              if (unique.length === 1) payload.exchange = unique[0];
            }
            // console.log("bulk payload-------", payload);
            await closeAllOrders(payload);
            successCount += group.items.length;

            const closedIds = group.positions.map(p => p.id);
            setOpenPositions((prev) =>
              prev.filter((p) => !closedIds.includes((p?.id ?? p?.orderId ?? p?.order_id ?? p?.usertranid ?? p?._id)))
            );
            setSelectedPositions((prev) => prev.filter((id) => !closedIds.includes(id)));
          } catch (err) {
            lastError = err?.message || err?.data?.message || String(err);
          }
        }

        if (successCount > 0) {
          showSuccess(successCount === toClose.length ? 'Position(s) closed successfully' : `Closed ${successCount} of ${toClose.length} positions`);
          if (onOrderChange) onOrderChange();
          window.dispatchEvent(new Event('refresh-wallet'));
        }
        if (lastError && successCount < toClose.length) showError(lastError, 5000);
        setClosingIds((prev) => prev.filter((id) => !confirmAction.ids.includes(id)));
      } else if (confirmAction.kind === 'cancel-pending') {
        const ids = confirmAction.ids;
        const pendingRows = confirmRows.pending;
        const pendingTypes = Array.from(
          new Set(
            pendingRows
              .map((r) => String(r?.type ?? '').trim())
              .filter(Boolean)
          )
        );
        const derivedOrderType = pendingTypes.length <= 1 ? (pendingTypes[0] || null) : pendingTypes;
        const firstPending = pendingRows[0] ?? null;
        const cancelExchangeOpts = firstPending
          ? {
            exchange: resolveIndiaOrderExchange({
              exchange: indiaExchange,
              symbol:
                firstPending?.pairname ??
                firstPending?.pair ??
                firstPending?.symbol ??
                '',
              pairId: firstPending?.type,
              raw: firstPending,
            }),
            pair:
              firstPending?.pairname ??
              firstPending?.pair ??
              firstPending?.symbol ??
              '',
            pairid: firstPending?.type,
            raw: firstPending,
          }
          : { exchange: indiaExchange };
        if (ids.length === 1) {
          // const response = await cancelOrder(ids[0], confirmAction.orderType || derivedOrderType);
          const response = await cancelOrder(
            ids[0],
            confirmAction.orderType || derivedOrderType,
            cancelExchangeOpts
          );
          if (response.status === 'true' || response.code === 200) {
            setPendingOrders((prevOrders) =>
              prevOrders.filter((rawOrder) => {
                const rawId = rawOrder?.id ?? rawOrder?.orderId ?? rawOrder?.order_id ?? rawOrder?.usertranid;
                const rawOrderNo = rawOrder?.orderno;
                return rawId !== ids[0] && rawOrderNo !== ids[0];
              })
            );
            setSelectedPositions((prev) => prev.filter((id) => id !== ids[0]));
            showSuccess('Pending order cancelled successfully');
            if (onOrderChange) onOrderChange();
            window.dispatchEvent(new Event('refresh-wallet'));
          }
        } else {
          setClosingIds((prev) => [...new Set([...prev, ...ids])]);
          const response = await cancelOrder(ids, derivedOrderType, cancelExchangeOpts);
          if (response.status === 'true' || response.code === 200) {
            setPendingOrders((prevOrders) =>
              prevOrders.filter((rawOrder) => {
                const rawOrderNo = rawOrder?.orderno;
                const rawId = rawOrder?.id ?? rawOrder?.orderId;
                return !ids.includes(rawOrderNo) && !ids.includes(rawId);
              })
            );
            setSelectedPositions([]);
            showSuccess(`${ids.length} order(s) cancelled successfully`);
            if (onOrderChange) onOrderChange();
            window.dispatchEvent(new Event('refresh-wallet'));
          }
          setClosingIds((prev) => prev.filter((id) => !ids.includes(id)));
        }
      }
      setConfirmAction(null);
    } catch (err) {
      const msg = err?.message || err?.data?.message || 'Action failed';
      showError(msg, 5000);
    } finally {
      setConfirmActionLoading(false);
    }
  }, [
    confirmAction,
    confirmRows.pending,
    normalizedOpenPositions,
    onOrderChange,
    showError,
    showSuccess,
    tradingSessionClosed,
    orderActionsBlockedMsg,
  ]);

  const renderOpenPositions = () => {
    if (openPositionsLoading) {
      return <div className="tabPlaceholder">Loading open positions…</div>;
    }

    if (openPositionsError) {
      return (
        <div className="ordersEmptyState">
          <h3 className="emptyStateTitle">Failed to load</h3>
          <p className="emptyStateMessage">{openPositionsError}</p>
        </div>
      );
    }

    if (normalizedOpenPositions.length === 0) {
      return (
        <div className="ordersEmptyState">
          <div className="emptyStateIcon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 5H7C5.89543 5 5 5.89543 5 7V19C5 20.1046 5.89543 21 7 21H17C18.1046 21 19 20.1046 19 19V7C19 5.89543 18.1046 5 17 5H15" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h3 className="emptyStateTitle">No open positions</h3>
          <p className="emptyStateMessage">You don't have any open positions at the moment</p>
        </div>
      );
    }

    if (filteredOpenPositions.length === 0) {
      return (
        <div className="ordersPanelOpenContent">
          <div className="ordersEmptyState ordersEmptyState--compact">
            <h3 className="emptyStateTitle">No matching positions</h3>
            <p className="emptyStateMessage">Try changing side, instrument type, or symbol search.</p>
            <button type="button" className="ordersPanelFilterClearBtn" onClick={clearOrdersPanelFilters}>
              Clear filters
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="ordersPanelOpenContent">
        <div className={`openPositionsTotalPnl ${openPositionsTotalPnL.isProfit ? 'openPositionsTotalPnl--profit' : 'openPositionsTotalPnl--loss'}`}>
          <span className="openPositionsTotalPnlLabel">Total P&L</span>
          <span className="openPositionsTotalPnlAmount">
            {formatPnlCurrency(openPositionsTotalPnL.totalPnL)}
            <span className="openPositionsTotalPnlPercent">
              ({openPositionsTotalPnL.totalPnLPercent >= 0 ? '+' : ''}{Number(openPositionsTotalPnL.totalPnLPercent).toFixed(2)}%)
            </span>
          </span>
        </div>
        <div className="ordersTableContainer">
          {selectedPositions.length > 0 && (
            <div className="selectionActions">
              <div className="selectionInfo">
                <span>{selectedPositions.length} position{selectedPositions.length > 1 ? 's' : ''} selected</span>
              </div>
              <div className="selectionButtons">
                <button className="selectionBtn selectionBtnCancel" onClick={handleCancelSelection}>
                  Cancel
                </button>
                <button
                  className="selectionBtn selectionBtnClose"
                  onClick={handleCloseSelected}
                  disabled={selectedPositions.length === 0 || closingIds.length > 0 || tradingSessionClosed}
                  title={tradingSessionClosed ? orderActionsBlockedMsg : undefined}
                >
                  {closingIds.length > 0 ? 'Closing…' : 'Close'}
                </button>
              </div>
            </div>
          )}
          <table className="ordersTable">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    checked={
                      selectedPositions.length === filteredOpenPositions.length &&
                      filteredOpenPositions.length > 0
                    }
                    onChange={(e) => handleSelectAll(e.target.checked, filteredOpenPositions)}
                    className="tableCheckbox"
                  />
                </th>
                <th>
                  Symbol
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="sortIcon">
                    <path d="M7 13L12 18L17 13M7 6L12 11L17 6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </th>
                <th>
                  Open Time
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="sortIcon">
                    <path d="M7 13L12 18L17 13M7 6L12 11L17 6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </th>
                <th>
                  {positionSizeLabel}
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="sortIcon">
                    <path d="M7 13L12 18L17 13M7 6L12 11L17 6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </th>
                <th>
                  Open Price
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="sortIcon">
                    <path d="M7 13L12 18L17 13M7 6L12 11L17 6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </th>
                {/* <th>
                  Liquidity Price
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="sortIcon">
                    <path d="M7 13L12 18L17 13M7 6L12 11L17 6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </th> */}
                <th>
                  Current Price
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="sortIcon">
                    <path d="M7 13L12 18L17 13M7 6L12 11L17 6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </th>
                <th>
                  TP/SL
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="sortIcon">
                    <path d="M7 13L12 18L17 13M7 6L12 11L17 6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </th>

                <th>
                  Fees
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="sortIcon">
                    <path d="M7 13L12 18L17 13M7 6L12 11L17 6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </th>
                <th>
                  P&L
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="sortIcon">
                    <path d="M7 13L12 18L17 13M7 6L12 11L17 6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredOpenPositions.map((position) => {
                return (
                  <tr key={position.id} className="ordersPanelDetailRow" onClick={() => openOrderDetails(position, 'open-positions')}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedPositions.includes(position.id)}
                        onChange={(e) => handleSelectPosition(position.id, e.target.checked)}
                        onClick={(e) => e.stopPropagation()}
                        className="tableCheckbox"
                      />
                    </td>
                    <td className="positionSymbol">
                      <div className="symbolContainer">
                        {/* <div className="symbolIcon" style={{ backgroundColor: getSymbolIcon(position.base) }}>
                          {position.base.charAt(0)}
                        </div> */}
                        <div className="symbolAndMarket">
                          <span className="symbolText" title={position.symbolTooltip}>
                            {position.displaySymbol || position.symbol}
                          </span>
                          <div className="ordersSymbolTagRow">
                            <span className="orderMarketTag" title={`Market: ${position.marketTag}`}>
                              {position.marketTag}
                            </span>
                            {position.indianInstrumentKind ? (
                              <span className="indianInstrumentTag" title="Instrument type">
                                {INDIAN_INSTRUMENT_FILTER_LABELS[position.indianInstrumentKind]}
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <span className={`positionSide positionSide-${position.side.toLowerCase()}`}>
                          {position.side}
                        </span>
                      </div>
                    </td>
                    <td className="positionTime">
                      <div className="timeContainer">
                        <span className="timeSecondary">{position.openTimeFull}</span>
                      </div>
                    </td>
                    <td className="positionVolume">
                      <div className="timeContainer">
                        <span>{position.volume}</span>
                        {/* <span>{position.volume}</span>
                        <span className="timeSecondary">{position.leverage ? `${position.leverage}x` : '-'}</span>
                        <span className="timeSecondary">{position.usedMargin ? `Margin: ${Number(position.usedMargin).toFixed(4)}` : ''}</span> */}
                      </div>
                    </td>
                    <td className="positionPrice">{formatPriceUtil(position.openPrice || 0)}</td>
                    {/* <td className="positionPrice">{Number(position.liquidityPrice || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td> */}
                    <td className="positionPrice">{formatPriceUtil(position.currentPrice || 0)}</td>
                    <td className="positionTPSL">
                      <div className="tpslContainer">
                        <span>TP: {position.tp || '0'}</span>
                        <span>SL: {position.sl || '0'}</span>
                        <button
                          type="button"
                          className="tpslEditBtn"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditTPSL(position);
                          }}
                          title={tradingSessionClosed ? orderActionsBlockedMsg : 'Edit TP/SL'}
                          disabled={tradingSessionClosed}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4C3.46957 4 2.96086 4.21071 2.58579 4.58579C2.21071 4.96086 2 5.46957 2 6V20C2 20.5304 2.21071 21.0391 2.58579 21.4142C2.96086 21.7893 3.46957 22 4 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V13" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M18.5 2.50023C18.8978 2.10243 19.4374 1.87891 20 1.87891C20.5626 1.87891 21.1022 2.10243 21.5 2.50023C21.8978 2.89804 22.1213 3.43762 22.1213 4.00023C22.1213 4.56284 21.8978 5.10243 21.5 5.50023L12 15.0002L8 16.0002L9 12.0002L18.5 2.50023Z" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                      </div>
                    </td>

                    <td className="positionCommission">{Number(position.commission || 0).toFixed(4)}</td>
                    <td className="positionProfit">
                      <div className="profitContainer">
                        {/* <span className="profitLiveLabel" title="Live P&amp;L">Live</span> */}
                        <span className={position.profit >= 0 ? 'profitPositive' : 'profitNegative'}>
                          {formatPnlCurrency(position.profit, selectedMarketType)}
                        </span>
                        <span className={`profitPercent ${position.profit >= 0 ? 'profitPositive' : 'profitNegative'}`}>
                          {position.profitPercent >= 0 ? '+' : ''}
                          <span style={{ fontSize: '10px', fontWeight: 'normal', color: position.profit >= 0 ? '#10b981' : '#ef4444', marginLeft: '2px' }}>{position.profitPercent.toFixed(2)}%</span>
                        </span>
                        <div className="positionActions">
                          <button
                            type="button"
                            className="actionIconBtn"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleClosePosition(position);
                            }}
                            disabled={closingIds.includes(position.id) || tradingSessionClosed}
                            title={
                              tradingSessionClosed
                                ? orderActionsBlockedMsg
                                : closingIds.includes(position.id)
                                  ? 'Closing…'
                                  : 'Close Position'
                            }
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M18 6L6 18M6 6L18 18" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderPendingOrders = () => {
    if (pendingOrdersLoading) {
      return <div className="tabPlaceholder">Loading pending orders…</div>;
    }

    if (pendingOrdersError) {
      return (
        <div className="ordersEmptyState">
          <h3 className="emptyStateTitle">Failed to load</h3>
          <p className="emptyStateMessage">{pendingOrdersError}</p>
        </div>
      );
    }

    if (normalizedPendingOrders.length === 0) {
      return (
        <div className="ordersEmptyState">
          <div className="emptyStateIcon">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21.3095 14.3695C21.3312 14.3058 21.3444 14.2395 21.3489 14.1724V2.46334" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M14 2v6h6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h3 className="emptyStateTitle">No pending orders</h3>
          <p className="emptyStateMessage">You don't have any pending orders at the moment</p>
        </div>
      );
    }

    if (filteredPendingOrders.length === 0) {
      return (
        <div className="ordersEmptyState ordersEmptyState--compact">
          <h3 className="emptyStateTitle">No matching orders</h3>
          <p className="emptyStateMessage">Try changing side, instrument type, or symbol search.</p>
          <button type="button" className="ordersPanelFilterClearBtn" onClick={clearOrdersPanelFilters}>
            Clear filters
          </button>
        </div>
      );
    }

    return (
      <div className="ordersTableContainer">
        {selectedPositions.length > 0 && (
          <div className="selectionActions">
            <div className="selectionInfo">
              <span>{selectedPositions.length} position{selectedPositions.length > 1 ? 's' : ''} selected</span>
            </div>
            <div className="selectionButtons">
              <button className="selectionBtn selectionBtnCancel" onClick={handleCancelSelection}>
                Cancel
              </button>
              <button
                className="selectionBtn selectionBtnClose"
                onClick={() => handleCloseSelectedPendingOrders(selectedPositions)}
                disabled={selectedPositions.length === 0 || closingIds.length > 0 || tradingSessionClosed}
                title={tradingSessionClosed ? orderActionsBlockedMsg : undefined}
              >
                {closingIds.length > 0 ? 'Closing…' : 'Close'}
              </button>
            </div>
          </div>
        )}
        <table className="ordersTable">
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  onChange={(e) => handleSelectAllPendingOrders(e.target.checked, filteredPendingOrders)}
                  checked={
                    selectedPositions.length === filteredPendingOrders.length && filteredPendingOrders.length > 0
                  }
                  className="tableCheckbox"
                />
              </th>
              <th>Symbol</th>
              <th>Created</th>
              <th>Side</th>
              {/* <th>Type</th> */}
              <th>Open Price</th>
              <th>Live Price</th>
              <th>{positionSizeLabel}</th>
              {/* <th>Liquidity Price</th> */}
              <th>TP/SL</th>
              {/* <th>Fee</th> */}
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredPendingOrders.map((order) => (
              <tr key={order.id} className="ordersPanelDetailRow" onClick={() => openOrderDetails(order, 'pending-orders')}>
                <td>
                  <input
                    type="checkbox"
                    checked={selectedPositions.includes(order.orderNo)}
                    onChange={(e) => handleSelectPositionPendingOrder(order.orderNo, e.target.checked)}
                    onClick={(e) => e.stopPropagation()}
                    className="tableCheckbox"
                  />
                </td>

                <td className="positionSymbol">
                  <div className="symbolContainer">
                    {/* <div className="symbolIcon" style={{ backgroundColor: getSymbolIcon(order.base) }}>
                      {order.base.charAt(0)}
                    </div> */}
                    <div className="symbolAndMarket">
                      <span className="symbolText" title={order.symbolTooltip}>
                        {order.displaySymbol || order.symbol}
                      </span>
                      <div className="ordersSymbolTagRow">
                        <span className="orderMarketTag" title={`Market: ${order.marketTag}`}>
                          {order.marketTag}
                        </span>
                        {order.indianInstrumentKind ? (
                          <span className="indianInstrumentTag" title="Instrument type">
                            {INDIAN_INSTRUMENT_FILTER_LABELS[order.indianInstrumentKind]}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    {/* {order.leverage > 0 && (
                      <span className="timeSecondary">{order.leverage}x</span>
                    )} */}
                  </div>
                </td>
                <td className="positionTime">
                  <div className="timeContainer">
                    <span>{order.createdTime}</span>
                    <span className="timeSecondary">{order.createdTimeFull}</span>
                  </div>
                </td>
                <td>
                  <span className={`positionSide positionSide-${order.side.toLowerCase()}`}>
                    {order.side}
                  </span>
                </td>
                {/* <td>{order.orderType}</td> */}
                <td className="positionPrice">
                  {formatPriceUtil(order.openPrice || order.price || 0)}
                </td>
                <td className="positionPrice">
                  {formatPriceUtil(order.currentPrice || order.openPrice || order.price || 0)}
                </td>
                <td className="positionVolume">{order.quantity}</td>
                {/* <td className="positionPrice">{Number(order.liquidityPrice || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td> */}
                <td className="positionTPSL">
                  <div className="tpslContainer">
                    <span>TP: {order.tp || '0'}</span>
                    <span>SL: {order.sl || '0'}</span>
                    <button
                      type="button"
                      className="tpslEditBtn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditTPSL(order);
                      }}
                      title={tradingSessionClosed ? orderActionsBlockedMsg : 'Edit TP/SL'}
                      disabled={tradingSessionClosed}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4C3.46957 4 2.96086 4.21071 2.58579 4.58579C2.21071 4.96086 2 5.46957 2 6V20C2 20.5304 2.21071 21.0391 2.58579 21.4142C2.96086 21.7893 3.46957 22 4 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V13" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M18.5 2.50023C18.8978 2.10243 19.4374 1.87891 20 1.87891C20.5626 1.87891 21.1022 2.10243 21.5 2.50023C21.8978 2.89804 22.1213 3.43762 22.1213 4.00023C22.1213 4.56284 21.8978 5.10243 21.5 5.50023L12 15.0002L8 16.0002L9 12.0002L18.5 2.50023Z" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </div>
                </td>

                {/* <td className="positionCommission">{Number(order.fee || 0).toFixed(2)}</td> */}
                <td>
                  <button
                    type="button"
                    className="actionIconBtn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCancelOrder(order.orderNo, order.type);
                    }}
                    title={tradingSessionClosed ? orderActionsBlockedMsg : 'Cancel order'}
                    disabled={tradingSessionClosed}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6L6 18M6 6L18 18" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderOrderHistory = () => {
    if (orderHistoryLoading) {
      return <div className="tabPlaceholder">Loading order history…</div>;
    }

    if (orderHistoryError) {
      return (
        <div className="ordersEmptyState">
          <h3 className="emptyStateTitle">Failed to load</h3>
          <p className="emptyStateMessage">{orderHistoryError}</p>
        </div>
      );
    }

    if (normalizedOrderHistory.length === 0) {
      return (
        <div className="ordersEmptyState">
          <div className="emptyStateIcon">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h3 className="emptyStateTitle">No order history</h3>
          <p className="emptyStateMessage">You don't have any closed orders yet</p>
        </div>
      );
    }

    if (filteredOrderHistory.length === 0) {
      return (
        <div className="ordersEmptyState ordersEmptyState--compact">
          <h3 className="emptyStateTitle">No matching history</h3>
          <p className="emptyStateMessage">Try changing side, instrument type, or symbol search.</p>
          <button type="button" className="ordersPanelFilterClearBtn" onClick={clearOrdersPanelFilters}>
            Clear filters
          </button>
        </div>
      );
    }

    return (
      <div className="ordersTableContainer ordersTableContainer--orderHistory">
        <table className="ordersTable ordersTable--orderHistory">
          <thead>
            <tr>
              <th>Pair / Order ID</th>
              <th>Side</th>
              <th>Open</th>
              <th>Close</th>
              <th>Size</th>
              {/* <th>Margin / Notional</th> */}
              <th>TP / SL</th>
              <th>Status · Time</th>
              <th>Fee</th>
              <th style={{ textAlign: 'right' }}>PnL</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrderHistory.map((order) => {
              const seg = order.segmentKey || 'crypto';
              const fmtPx = (v) =>
                formatPriceUtil(Number(v) || 0, { marketType: seg, prefix: '' });
              const fmtSmall = (v) => formatDynamic(Number(v) || 0, '0');
              const fmtTpSl = (x) => {
                if (x === '-' || x == null || x === '') return '—';
                const n = Number(x);
                if (!Number.isFinite(n) || n === 0) return '0';
                return fmtSmall(n);
              };
              const ml = String(order.marketLabel || '').trim();
              const marketDisplay =
                !ml || ml === '—' ? '—' : ml.charAt(0).toUpperCase() + ml.slice(1).toLowerCase();
              const orderIdShort =
                order.orderNo && String(order.orderNo).length > 14
                  ? `${String(order.orderNo).slice(0, 12)}…`
                  : order.orderNo || '—';

              return (
                <tr key={order.id} className="ordersPanelDetailRow" onClick={() => openOrderDetails(order, 'order-history')}>
                  <td className="orderHistoryTdPair">
                    <div className="orderHistoryPairBlock">
                      <div className="symbolContainer">
                        {/* <div className="symbolIcon" style={{ backgroundColor: getSymbolIcon(order.base) }}>
                          {order.base.charAt(0)}
                        </div> */}
                        <div className="symbolAndMarket">
                          <span className="symbolText" title={order.symbolTooltip}>
                            {order.displaySymbol || order.symbol}
                          </span>
                          <div className="ordersSymbolTagRow">
                            <span className="orderMarketTag">{order.marketTag}</span>
                            {order.indianInstrumentKind ? (
                              <span className="indianInstrumentTag" title="Instrument type">
                                {INDIAN_INSTRUMENT_FILTER_LABELS[order.indianInstrumentKind]}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                      <span className="orderHistoryOrderNo" title={order.orderNo ? `Order ${order.orderNo}` : ''}>
                        {orderIdShort}
                      </span>
                    </div>
                  </td>
                  <td className="orderHistoryTdMeta">
                    <div className="orderHistoryMetaStack">
                      {/* <span className="orderHistoryMetaBadge orderHistoryMetaBadge--market">{marketDisplay}</span> */}
                      {/* <span className="orderHistoryMetaBadge orderHistoryMetaBadge--exec">{order.orderType}</span> */}
                      <span
                        className={`positionSide positionSide-${order.side.toLowerCase()} orderHistoryMetaLine orderHistoryMetaBadge`}
                      >
                        {order.side}
                      </span>
                    </div>
                  </td>
                  <td className="orderHistoryTdNum" title="openbuyprice / entry">
                    {order.openPrice > 0 ? formatPriceUtil(order.openPrice) : '—'}
                  </td>
                  <td className="orderHistoryTdNum" title="price / close">
                    {order.closePrice > 0 ? formatPriceUtil(order.closePrice) : '—'}
                  </td>
                  <td className="orderHistoryTdCompact">
                    <span className="orderHistoryTdCompactLine">{formatHistoryQty(order.quantity)}</span>
                    {/* <span className="orderHistoryTdCompactSub">
                      {order.leverage > 0 ? `${order.leverage}×` : '—'}
                    </span> */}
                  </td>
                  {/* <td className="orderHistoryTdCompact" title="Margin (used or implied) / Notional">
                    <span className="orderHistoryTdCompactLine">
                      {order.marginDisplay > 0 ? fmtSmall(order.marginDisplay) : '—'}
                    </span>
                    <span className="orderHistoryTdCompactSub">
                      {order.notional > 0 ? fmtSmall(order.notional) : '—'}
                    </span>
                  </td> */}
                  <td className="orderHistoryTdTpSl">
                    <span>TP {fmtTpSl(order.tp)}</span>
                    <span>SL {fmtTpSl(order.sl)}</span>
                  </td>
                  <td className="orderHistoryTdCompact">
                    {/* <span className={`orderHistoryTdCompactLine orderHistoryStatusBadge ${String(order.statusLabel).toLowerCase() === 'closed' ? 'is-closed' : ''}`}>{order.statusLabel}</span> */}
                    <span className="orderHistoryTdCompactSub">{order.closedTimeFull}</span>
                  </td>
                  <td className="orderHistoryTdNum">{order.fee > 0 ? fmtSmall(order.fee) : '—'}</td>
                  <td className="orderHistoryTdPnl">
                    <div className="orderHistoryPnlStack">
                      <span className={order.profit >= 0 ? 'profitPositive' : 'profitNegative'}>
                        {formatPnlCurrency(order.profit, order.segmentKey)}
                      </span>
                      {Number.isFinite(Number(order.profitPct)) && Number(order.profitPct) !== 0 ? (
                        <span
                          className={`profitPercent ${Number(order.profitPct) >= 0 ? 'profitPositive' : 'profitNegative'}`}
                        >
                          {Number(order.profitPct) >= 0 ? '+' : ''}
                          {Number(order.profitPct).toFixed(4)}%
                        </span>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'open-positions':
        return renderOpenPositions();
      case 'pending-orders':
        return renderPendingOrders();
      case 'order-history':
        return renderOrderHistory();
      default:
        return renderOpenPositions();
    }
  };

  return (
    <div className="ordersPanel">
      <div className="ordersPanelTabs">
        <div className="tabsLeft">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`ordersTab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="tabIcon">{tab.icon}</span>
              <span className="tabLabel">{tab.label}</span>
              {tab.badge !== null && tab.badge > 0 && (
                <span className="tabBadge">{tab.badge}</span>
              )}
            </button>
          ))}
        </div>
        {ordersFilterVisible && (
          <div className="tabsRight">
            {selectedMarketType === 'india' && (
              <div className="ordersPanelPnlCurrencyToggle" role="group" aria-label="Indian market P&L currency">
                <button
                  type="button"
                  className={`ordersPanelPnlCurrencyBtn ${indiaPnlCurrency === 'usdt' ? 'active' : ''}`}
                  onClick={() => setIndiaPnlCurrency('usdt')}
                >
                  USDT
                </button>
                <button
                  type="button"
                  className={`ordersPanelPnlCurrencyBtn ${indiaPnlCurrency === 'inr' ? 'active' : ''}`}
                  onClick={() => setIndiaPnlCurrency('inr')}
                  title={`1 USDT = ${inrPerUsdt.toFixed(2)} INR`}
                >
                  INR
                </button>
              </div>
            )}
            <div className="ordersPanelFilterWrap" ref={openPositionsFilterRef}>
              <button
                type="button"
                className={`headerActionBtn${hasOrdersPanelFilters ? ' headerActionBtn--active' : ''}`}
                title="Filter orders"
                aria-expanded={openPositionsFilterOpen}
                aria-haspopup="dialog"
                aria-label="Filter orders"
                onClick={() => setOpenPositionsFilterOpen((o) => !o)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M3 6H21M7 12H17M10 18H14" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              {openPositionsFilterOpen && (
                <div
                  className={`ordersPanelFilterDropdown${selectedMarketType === 'india' ? ' ordersPanelFilterDropdown--wide' : ''}`}
                  role="dialog"
                  aria-label="Filter orders"
                >
                  {selectedMarketType === 'india' && indianInstrumentCounts && (
                    <div className="ordersPanelFilterField">
                      <span className="ordersPanelFilterLabel">Instrument type</span>
                      <div className="ordersPanelFilterSeg ordersPanelFilterSeg--instrument">
                        <button
                          type="button"
                          className={positionsFilterIndianKind === 'all' ? 'is-active' : ''}
                          onClick={() => setPositionsFilterIndianKind('all')}
                        >
                          All ({indianInstrumentCounts.total})
                        </button>
                        {['futures', 'ce', 'pe', 'other'].map((key) => (
                          <button
                            key={key}
                            type="button"
                            className={positionsFilterIndianKind === key ? 'is-active' : ''}
                            onClick={() => setPositionsFilterIndianKind(key)}
                          >
                            {INDIAN_INSTRUMENT_FILTER_LABELS[key]} ({indianInstrumentCounts[key]})
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="ordersPanelFilterField">
                    <span className="ordersPanelFilterLabel">Side</span>
                    <div className="ordersPanelFilterSeg">
                      <button
                        type="button"
                        className={positionsFilterSide === 'all' ? 'is-active' : ''}
                        onClick={() => setPositionsFilterSide('all')}
                      >
                        All
                      </button>
                      <button
                        type="button"
                        className={positionsFilterSide === 'buy' ? 'is-active' : ''}
                        onClick={() => setPositionsFilterSide('buy')}
                      >
                        Buy
                      </button>
                      <button
                        type="button"
                        className={positionsFilterSide === 'sell' ? 'is-active' : ''}
                        onClick={() => setPositionsFilterSide('sell')}
                      >
                        Sell
                      </button>
                    </div>
                  </div>
                  <div className="ordersPanelFilterField">
                    <label className="ordersPanelFilterLabel" htmlFor="orders-panel-symbol-filter">
                      Symbol contains
                    </label>
                    <input
                      id="orders-panel-symbol-filter"
                      type="search"
                      className="ordersPanelFilterInput"
                      placeholder={
                        selectedMarketType === 'india' ? 'e.g. NIFTY, BANKNIFTY' : 'e.g. BTC, ETH'
                      }
                      value={positionsFilterSymbol}
                      onChange={(e) => setPositionsFilterSymbol(e.target.value)}
                      autoComplete="off"
                    />
                  </div>
                  <button type="button" className="ordersPanelFilterClearBtn" onClick={clearOrdersPanelFilters}>
                    Clear filters
                  </button>
                </div>
              )}
            </div>
            {activeTab === 'open-positions' && (
              <button
                type="button"
                className="headerActionBtn"
                title="Download open positions as CSV"
                aria-label="Download open positions as CSV"
                onClick={handleExportOpenPositionsCsv}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M21 15V19C21 20.1046 20.1046 21 19 21H5C3.89543 21 3 20.1046 3 19V15M17 10L12 15M12 15L7 10M12 15V3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            )}
          </div>
        )}
      </div>

      <div className="ordersPanelContent">
        {renderTabContent()}
      </div>

      <TP_SL_Modal
        key={tpslModalOpen ? (selectedPosition?.id ?? selectedPosition?.orderNo ?? 'tpsl') : 'tpsl-closed'}
        isOpen={tpslModalOpen}
        position={selectedPosition}
        onClose={handleCloseTPSLModal}
        onSave={handleSaveTPSL}
        isSaving={tpslSaving}
      />

      {showOrderDetailsModal && selectedOrderDetailsLive && (
        <div className="ordersPanelDetailOverlay" onClick={() => setShowOrderDetailsModal(false)}>
          <div className="ordersPanelDetailModal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Order details">
            <div className="ordersPanelDetailHeader">
              <div className="ordersPanelDetailHeaderText">
                <h3>Order Details</h3>
                {getOrderMarketTypeKey(selectedOrderDetailsLive.raw, selectedOrderDetailsLive.symbol) === 'india' && selectedOrderDetailsLive.expiryTimeFull && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    marginTop: '6px',
                    padding: '4px 8px',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(239, 68, 68, 0.08)',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    width: 'fit-content'
                  }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                      <line x1="16" y1="2" x2="16" y2="6"></line>
                      <line x1="8" y1="2" x2="8" y2="6"></line>
                      <line x1="3" y1="10" x2="21" y2="10"></line>
                    </svg>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '500' }}>
                      Expiry: <span style={{ color: '#ef4444', fontWeight: '600' }}>{selectedOrderDetailsLive.expiryTimeFull}</span>
                    </span>
                  </div>
                )}
              </div>
              <button type="button" className="ordersPanelDetailCloseBtn" onClick={() => setShowOrderDetailsModal(false)} aria-label="Close">
                <svg style={{ margin: "auto" }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6L18 18" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
            <div className="ordersPanelDetailBody">
              <div className="ordersPanelDetailTopRow">
                <div className="ordersPanelDetailIdentity">
                  <div className="ordersPanelDetailSymbol">
                    {selectedOrderDetailsLive.displaySymbol || selectedOrderDetailsLive.symbol || '-'}
                  </div>
                  <div className="ordersPanelDetailMetaChips">
                    {selectedDetailsOrderNo ? (
                      <span className="ordersPanelDetailChip" title="Order number">
                        #{selectedDetailsOrderNo}
                      </span>
                    ) : null}
                    <span className={`ordersPanelDetailChip ordersPanelDetailChip--side ${String(selectedOrderDetailsLive.side || '').toLowerCase() === 'buy' ? 'is-buy' : 'is-sell'}`}>
                      {selectedOrderDetailsLive.side || '-'}
                    </span>
                    <span className="ordersPanelDetailChip">{selectedOrderDetailsLive.marketTag || '-'}</span>
                    <span className="ordersPanelDetailChip">{selectedOrderDetailsLive.statusLabel || selectedOrderDetailsLive.status || '-'}</span>
                  </div>
                </div>
                <div className={`ordersPanelDetailPnlCard ${Number(selectedOrderDetailsLive.profit ?? 0) >= 0 ? 'is-profit' : 'is-loss'}`}>
                  <span className="ordersPanelDetailPnlLabel">
                    {activeTab === 'order-history' ? 'Realized P&L' : 'Live P&L'}
                  </span>
                  <strong className="ordersPanelDetailPnlValue">
                    {formatPnlCurrency(selectedOrderDetailsLive.profit ?? 0, selectedOrderDetailsLive.segmentKey || selectedMarketType)}
                  </strong>
                </div>
              </div>

              <div className="ordersPanelDetailSection">
                <h4>Price & Risk</h4>
                <div className="ordersPanelDetailGrid">
                  <div><span>Entry</span><strong>{formatPriceUtil(Number(selectedOrderDetailsLive.openPrice ?? selectedOrderDetailsLive.price ?? 0))}</strong></div>
                  <div><span>Live</span><strong>{formatPriceUtil(Number(selectedOrderDetailsLive.currentPrice ?? selectedOrderDetailsLive.closePrice ?? 0))}</strong></div>
                  <div><span>TP</span><strong>{selectedOrderDetailsLive.tp ?? '-'}</strong></div>
                  <div><span>SL</span><strong>{selectedOrderDetailsLive.sl ?? '-'}</strong></div>
                </div>
              </div>

              <div className="ordersPanelDetailSection">
                <h4>Position Info</h4>
                <div className="ordersPanelDetailGrid">
                  {/* <div><span>Order No.</span><strong>{selectedDetailsOrderNo || '—'}</strong></div> */}
                  <div><span>Size</span><strong>{formatHistoryQty(selectedOrderDetailsLive.quantity ?? selectedOrderDetailsLive.volume ?? 0)}</strong></div>
                  <div><span>Fee</span><strong>{Number(selectedOrderDetailsLive.fee ?? selectedOrderDetailsLive.commission ?? 0).toFixed(4)}</strong></div>
                  <div className="ordersPanelDetailGridWide"><span>Time</span><strong>{selectedOrderDetailsLive.openTimeFull || selectedOrderDetailsLive.createdTimeFull || selectedOrderDetailsLive.closedTimeFull || '-'}</strong></div>
                </div>
              </div>

              {activeTab === 'order-history' && Array.isArray(selectedOrderDetailsLive.tpslActions) && selectedOrderDetailsLive.tpslActions.length > 0 && (
                <div className="ordersPanelDetailSection">
                  <h4>TP/SL Actions</h4>
                  <div className="ordersPanelDetailGrid">
                    {selectedOrderDetailsLive.tpslActions.map((a, i) => (
                      <div key={`tpsl-action-${i}`} className="ordersPanelDetailGridWide">
                        <span>{String(a?.action_type || 'Action')}</span>
                        <strong>
                          {String(a?.status || a?.action_status || '-')} · TP {a?.tradepofit ?? '-'} · SL {a?.stoploss ?? '-'} · {a?.action_time ?? '-'}
                        </strong>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {confirmAction && (
        <div className="ordersConfirmOverlay" role="dialog" aria-modal="true" aria-label="Confirm order action">
          <div className="ordersConfirmModal">
            <div className="ordersConfirmHeader">
              <h3>
                {confirmAction.kind === 'close-position'
                  ? `Close ${confirmRows.open.length > 1 ? `${confirmRows.open.length} Positions` : 'Position'}`
                  : `Cancel ${confirmRows.pending.length > 1 ? `${confirmRows.pending.length} Orders` : 'Order'}`}
              </h3>
              <button type="button" className="ordersConfirmCloseBtn" onClick={closeConfirmModal} disabled={confirmActionLoading} aria-label="Close">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6L18 18" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>

            <div className="ordersConfirmBody">
              {(confirmAction.kind === 'close-position' ? confirmRows.open : confirmRows.pending).slice(0, 3).map((r) => (
                <div key={r.id ?? r.orderNo} className="ordersConfirmRow">
                  <div className="ordersConfirmSymbol">{r.displaySymbol || r.symbol}</div>
                  <div className="ordersConfirmMeta">
                    <span>{r.side}</span>
                    <span>{Number(confirmAction.kind === 'close-position' ? r.volume : r.quantity).toLocaleString('en-US')}</span>
                    <span>{r.marketTag}</span>
                  </div>
                </div>
              ))}
              {(confirmAction.kind === 'close-position' ? confirmRows.open.length : confirmRows.pending.length) > 3 && (
                <div className="ordersConfirmMore">
                  +{(confirmAction.kind === 'close-position' ? confirmRows.open.length : confirmRows.pending.length) - 3} more
                </div>
              )}

              {confirmSummary?.livePx != null && (
                <div className="ordersConfirmStat">
                  <span className="ordersConfirmStatLabel">Live Price</span>
                  <span className="ordersConfirmStatValue">
                    {formatDynamic(confirmSummary.livePx)}
                  </span>
                </div>
              )}

              {confirmAction.kind === 'close-position' && (
                <div className={`ordersConfirmPnlCard ${(confirmSummary?.livePnl ?? 0) >= 0 ? 'is-profit' : 'is-loss'}`}>
                  <span className="ordersConfirmPnlLabel">Live P&amp;L</span>
                  <span className="ordersConfirmPnlValue">
                    {formatPnlCurrency(confirmSummary?.livePnl ?? 0)}
                  </span>
                  <span className="ordersConfirmPnlPct">
                    {(confirmSummary?.livePnlPct ?? 0) >= 0 ? '+' : ''}{Number(confirmSummary?.livePnlPct ?? 0).toFixed(2)}%
                  </span>
                </div>
              )}
            </div>

            <div className="ordersConfirmFooter">
              <button type="button" className="ordersConfirmBtn ordersConfirmBtn--ghost" onClick={closeConfirmModal} disabled={confirmActionLoading}>
                Keep Order
              </button>
              <button type="button" className="ordersConfirmBtn ordersConfirmBtn--danger" onClick={handleConfirmAction} disabled={confirmActionLoading}>
                {confirmActionLoading
                  ? 'Processing...'
                  : confirmAction.kind === 'close-position'
                    ? 'Confirm Close'
                    : 'Confirm Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrdersPanel;

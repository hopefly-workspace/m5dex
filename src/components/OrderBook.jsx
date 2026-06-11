import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import '../styles/components/OrderBook.css';
import { getBaseSymbol, formatPrice as formatPriceUtil } from '../utils/helper';
import { normalizeSymbol } from '../services/favouritesWishlistApi';

const DISPLAY_LIMIT = 160;
const BOTH_VIEW_LIMIT = 8;
const SINGLE_VIEW_LIMIT = 10;
const VIRTUALIZATION_THRESHOLD = 100;
const VIRTUAL_ROW_HEIGHT = 20;
const VIRTUAL_OVERSCAN = 12;
const AUTO_SCROLL_RESUME_MS = 3500;

const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const parseLevel = (level) => {
  if (Array.isArray(level)) {
    return [toNumber(level[0]), toNumber(level[1])];
  }
  return [toNumber(level?.price), toNumber(level?.quantity ?? level?.qty ?? level?.size)];
};

const formatNumber = (value, min = 2, max = 8) => {
  const n = toNumber(value);
  return n.toLocaleString('en-US', {
    minimumFractionDigits: min,
    maximumFractionDigits: max,
  });
};

const buildRows = (levels, side, maxCumulative, lastPrice, lastTradeSide, formatPrice, marketType) => {
  let cumulative = 0;
  return levels.map((level) => {
    cumulative += level.quantity;
    const widthPct = maxCumulative > 0 ? (cumulative / maxCumulative) * 100 : 0;
    const isLastTradeMatch = Math.abs(level.price - lastPrice) < 1e-10;
    return {
      ...level,
      cumulative,
      widthPct,
      side,
      priceText: formatPrice(level.price, marketType),
      quantityText: formatNumber(level.quantity, 2, 6),
      cumulativeText: formatNumber(cumulative, 2, 6),
      isLastTradeMatch,
      lastTradeSide,
    };
  });
};

const OrderRow = memo(function OrderRow({ row, flashState }) {
  const sideClass = row.side === 'ask' ? 'askRow' : 'bidRow';
  const priceClass = row.side === 'ask' ? 'askPrice' : 'bidPrice';
  const depthClass = row.side === 'ask' ? 'askDepthBar' : 'bidDepthBar';

  const flashClass =
    flashState === 'new'
      ? row.side === 'ask'
        ? 'rowFlashNewAsk'
        : 'rowFlashNewBid'
      : flashState === 'inc'
        ? row.side === 'ask'
          ? 'rowFlashIncAsk'
          : 'rowFlashIncBid'
        : flashState === 'dec'
          ? 'rowFlashDec'
          : '';

  const lastTradeClass = row.isLastTradeMatch
    ? row.lastTradeSide === 'buy'
      ? 'lastTradeBuy'
      : 'lastTradeSell'
    : '';

  return (
    <div className={`orderRow ${sideClass} ${flashClass} ${lastTradeClass}`}>
      <div className={`depthBar ${depthClass}`} style={{ width: `${row.widthPct}%` }} />
      <div className={`orderCell priceCell ${priceClass}`}>{row.priceText}</div>
      <div className="orderCell quantityCell">{row.quantityText}</div>
      <div className="orderCell totalCell">{row.cumulativeText}</div>
    </div>
  );
});

const OrderBook = ({
  data,
  /** Dashboard selected pair — drives book reset when switching symbols (avoids stale levels). */
  activeSymbol,
  bids,
  asks,
  lastPrice,
  marketType = 'crypto',
}) => {
  const [viewMode, setViewMode] = useState('both');
  const [autoScroll, setAutoScroll] = useState(true);
  const [asksScrollTop, setAsksScrollTop] = useState(0);
  const [bidsScrollTop, setBidsScrollTop] = useState(0);
  const [flashMap, setFlashMap] = useState({});

  const asksWrapRef = useRef(null);
  const bidsWrapRef = useRef(null);
  const asksMapRef = useRef(new Map());
  const bidsMapRef = useRef(new Map());
  const askChangeRankRef = useRef(new Map());
  const bidChangeRankRef = useRef(new Map());
  const changeSeqRef = useRef(0);
  const flashTimersRef = useRef({});
  const scrollResumeRef = useRef(null);
  const prevLastPriceRef = useRef(toNumber(lastPrice ?? data?.price));
  const lastTradeSideRef = useRef('buy');

  const normalizedMarketType = String(marketType || 'crypto').toLowerCase().trim();

  const bookSymbolKey = useMemo(() => {
    const fromProp =
      activeSymbol != null && String(activeSymbol).trim() !== ''
        ? normalizeSymbol(String(activeSymbol).trim())
        : '';
    if (fromProp) return fromProp;
    if (!data || typeof data !== 'object') return '';
    const raw =
      data.symbol ||
      data.Symbol ||
      data.pair ||
      data.id ||
      data.instrument ||
      data.market ||
      '';
    return normalizeSymbol(raw) || '';
  }, [activeSymbol, data]);

  const incomingAsks = asks ?? data?.orderbook?.asks ?? [];
  const incomingBids = bids ?? data?.orderbook?.bids ?? [];
  const effectiveLastPrice = toNumber(lastPrice ?? data?.price ?? data?.last ?? 0);

  const formatPrice = useCallback(
    (price, currentMarketType) => formatPriceUtil(price, { marketType: currentMarketType }),
    []
  );

  const bookSymbolKeyRef = useRef('');

  /** On pair change: drop merged book state so we never show the previous symbol's prices. */
  useEffect(() => {
    if (bookSymbolKeyRef.current === bookSymbolKey) return;
    bookSymbolKeyRef.current = bookSymbolKey;

    asksMapRef.current.clear();
    bidsMapRef.current.clear();
    askChangeRankRef.current.clear();
    bidChangeRankRef.current.clear();
    changeSeqRef.current = 0;

    Object.values(flashTimersRef.current).forEach((t) => clearTimeout(t));
    flashTimersRef.current = {};
    setFlashMap({});

    const dataSym = normalizeSymbol(data?.symbol || data?.Symbol || '') || '';
    const seed =
      bookSymbolKey && dataSym && dataSym !== bookSymbolKey
        ? 0
        : toNumber(lastPrice ?? data?.price ?? data?.last ?? data?.p ?? data?.close ?? 0);
    prevLastPriceRef.current = seed;
    lastTradeSideRef.current = 'buy';

    setAsksScrollTop(0);
    setBidsScrollTop(0);
  }, [bookSymbolKey, data, lastPrice]);

  useEffect(() => {
    const previous = prevLastPriceRef.current;
    if (effectiveLastPrice > previous) lastTradeSideRef.current = 'buy';
    else if (effectiveLastPrice < previous) lastTradeSideRef.current = 'sell';
    prevLastPriceRef.current = effectiveLastPrice;
  }, [effectiveLastPrice]);

  const registerFlash = useCallback((key, type) => {
    setFlashMap((prev) => ({ ...prev, [key]: type }));
    if (flashTimersRef.current[key]) clearTimeout(flashTimersRef.current[key]);
    flashTimersRef.current[key] = setTimeout(() => {
      setFlashMap((prev) => {
        if (!(key in prev)) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      });
      delete flashTimersRef.current[key];
    }, 380);
  }, []);

  useEffect(() => {
    const applySide = (sideMap, incoming, sideName) => {
      const changeRankMap = sideName === 'ask' ? askChangeRankRef.current : bidChangeRankRef.current;
      incoming.forEach((raw) => {
        const [price, quantity] = parseLevel(raw);
        if (price <= 0) return;
        const prevQty = sideMap.get(price);
        if (quantity <= 0) {
          if (sideMap.has(price)) {
            sideMap.delete(price);
            changeRankMap.delete(price);
          }
          return;
        }
        sideMap.set(price, quantity);
        const wasChanged = prevQty == null || quantity !== prevQty;
        if (wasChanged) {
          changeSeqRef.current += 1;
          changeRankMap.set(price, changeSeqRef.current);
        }
        const flashKey = `${sideName}:${price}`;
        if (prevQty == null) {
          registerFlash(flashKey, 'new');
        } else if (quantity > prevQty) {
          registerFlash(flashKey, 'inc');
        } else if (quantity < prevQty) {
          registerFlash(flashKey, 'dec');
        }
      });
    };

    if (!bookSymbolKey) return;
    if (Array.isArray(incomingAsks)) applySide(asksMapRef.current, incomingAsks, 'ask');
    if (Array.isArray(incomingBids)) applySide(bidsMapRef.current, incomingBids, 'bid');
  }, [bookSymbolKey, incomingAsks, incomingBids, registerFlash]);

  useEffect(() => {
    return () => {
      Object.values(flashTimersRef.current).forEach((t) => clearTimeout(t));
      if (scrollResumeRef.current) clearTimeout(scrollResumeRef.current);
    };
  }, []);

  const grouped = useMemo(() => {
    const aggregate = (sideMap, side) => {
      const sorted = Array.from(sideMap.entries())
        .map(([price, quantity]) => ({ price, quantity }))
        .sort((a, b) => (side === 'ask' ? a.price - b.price : b.price - a.price))
        .slice(0, DISPLAY_LIMIT);
      return sorted;
    };

    return {
      asks: aggregate(asksMapRef.current, 'ask'),
      bids: aggregate(bidsMapRef.current, 'bid'),
    };
  }, [incomingAsks, incomingBids, bookSymbolKey]);

  const rows = useMemo(() => {
    const askTotal = grouped.asks.reduce((acc, item) => acc + item.quantity, 0);
    const bidTotal = grouped.bids.reduce((acc, item) => acc + item.quantity, 0);
    const maxCumulative = Math.max(askTotal, bidTotal, 1);

    return {
      asks: buildRows(
        grouped.asks,
        'ask',
        maxCumulative,
        effectiveLastPrice,
        lastTradeSideRef.current,
        formatPrice,
        normalizedMarketType
      ),
      bids: buildRows(
        grouped.bids,
        'bid',
        maxCumulative,
        effectiveLastPrice,
        lastTradeSideRef.current,
        formatPrice,
        normalizedMarketType
      ),
    };
  }, [grouped, effectiveLastPrice, formatPrice, normalizedMarketType]);

  const bestAsk = rows.asks[0]?.price ?? 0;
  const bestBid = rows.bids[0]?.price ?? 0;
  const spread = bestAsk > 0 && bestBid > 0 ? bestAsk - bestBid : 0;
  const spreadPct = bestAsk > 0 ? (spread / bestAsk) * 100 : 0;

  const handleManualScroll = useCallback(() => {
    if (autoScroll) {
      setAutoScroll(false);
      if (scrollResumeRef.current) clearTimeout(scrollResumeRef.current);
      scrollResumeRef.current = setTimeout(() => setAutoScroll(true), AUTO_SCROLL_RESUME_MS);
    }
  }, [autoScroll]);

  useEffect(() => {
    if (!autoScroll) return;
    if (asksWrapRef.current) {
      asksWrapRef.current.scrollTop = asksWrapRef.current.scrollHeight;
    }
    if (bidsWrapRef.current) {
      bidsWrapRef.current.scrollTop = 0;
    }
  }, [autoScroll, rows.asks.length, rows.bids.length]);

  const virtualizeRows = useCallback((allRows, side, scrollTop) => {
    if (allRows.length <= VIRTUALIZATION_THRESHOLD) {
      return { visibleRows: allRows, topPad: 0, bottomPad: 0 };
    }
    const viewportHeight = side === 'ask' ? asksWrapRef.current?.clientHeight || 0 : bidsWrapRef.current?.clientHeight || 0;
    const start = Math.max(0, Math.floor(scrollTop / VIRTUAL_ROW_HEIGHT) - VIRTUAL_OVERSCAN);
    const visibleCount = Math.ceil(viewportHeight / VIRTUAL_ROW_HEIGHT) + VIRTUAL_OVERSCAN * 2;
    const end = Math.min(allRows.length, start + visibleCount);
    return {
      visibleRows: allRows.slice(start, end),
      topPad: start * VIRTUAL_ROW_HEIGHT,
      bottomPad: Math.max(0, (allRows.length - end) * VIRTUAL_ROW_HEIGHT),
    };
  }, []);

  const askWindow = useMemo(
    () => virtualizeRows(rows.asks, 'ask', asksScrollTop),
    [rows.asks, asksScrollTop, virtualizeRows]
  );
  const bidWindow = useMemo(
    () => virtualizeRows(rows.bids, 'bid', bidsScrollTop),
    [rows.bids, bidsScrollTop, virtualizeRows]
  );

  const visibleAsks = useMemo(() => {
    if (viewMode === 'both') {
      return [...rows.asks]
        .sort((a, b) => (askChangeRankRef.current.get(b.price) || 0) - (askChangeRankRef.current.get(a.price) || 0))
        .slice(0, BOTH_VIEW_LIMIT);
    }
    return rows.asks.slice(0, SINGLE_VIEW_LIMIT);
  }, [rows.asks, viewMode]);

  const visibleBids = useMemo(() => {
    if (viewMode === 'both') {
      return [...rows.bids]
        .sort((a, b) => (bidChangeRankRef.current.get(b.price) || 0) - (bidChangeRankRef.current.get(a.price) || 0))
        .slice(0, BOTH_VIEW_LIMIT);
    }
    return rows.bids.slice(0, SINGLE_VIEW_LIMIT);
  }, [rows.bids, viewMode]);

  const quoteSymbol = data?.quoteAsset || 'USDT';
  const pairForHeader = bookSymbolKey || normalizeSymbol(data?.symbol || data?.Symbol || '') || '';
  const baseSymbol = getBaseSymbol(pairForHeader, quoteSymbol) || '';

  return (
    <div className="orderBook">
      <div className="orderBookHeader orderBookHeaderEnhanced">
        <div className="headerLeft">
          <div className="viewModeButtons">
          <button
            type="button"
            onClick={() => setViewMode('asks')}
            className={`viewModeButton ${viewMode === 'asks' ? 'active' : ''}`}
          >
            Asks
          </button>
          <button
            type="button"
            onClick={() => setViewMode('both')}
            className={`viewModeButton ${viewMode === 'both' ? 'active' : ''}`}
          >
            Both
          </button>
          <button
            type="button"
            onClick={() => setViewMode('bids')}
            className={`viewModeButton ${viewMode === 'bids' ? 'active' : ''}`}
          >
            Bids
          </button>
        </div>
        </div>
        <div className="orderBookControls" />
      </div>

      <div className="orderBookColumns">
        <div className="columnHeader priceColumn">Price ({quoteSymbol})</div>
        <div className="columnHeader quantityColumn">Qty ({baseSymbol || '-'})</div>
        <div className="columnHeader totalColumn">Total</div>
      </div>

      {(viewMode === 'both' || viewMode === 'asks') && (
        <div
          ref={asksWrapRef}
          onScroll={(e) => setAsksScrollTop(e.currentTarget.scrollTop)}
          onWheel={handleManualScroll}
          className={`orderBookList asksList ${viewMode === 'both' || viewMode === 'asks' ? 'noScroll' : ''}`}
        >
          {viewMode === 'bids' && askWindow.topPad > 0 && <div style={{ height: askWindow.topPad }} />}
          {visibleAsks.map((row) => (
            <OrderRow key={`ask-${row.price}`} row={row} flashState={flashMap[`ask:${row.price}`]} />
          ))}
          {viewMode === 'bids' && askWindow.bottomPad > 0 && <div style={{ height: askWindow.bottomPad }} />}
        </div>
      )}

      {viewMode === 'both' && (
        <div className="spreadSection">
          <div className="spreadRow">
            <span>Best Bid: <span className="bestBidValue">{formatPrice(bestBid, normalizedMarketType)}</span></span>
            <span>Best Ask: <span className="bestAskValue">{formatPrice(bestAsk, normalizedMarketType)}</span></span>
          </div>
          <div className="spreadValue">
            Spread: {formatPrice(spread, normalizedMarketType)} ({spreadPct.toFixed(4)}%)
          </div>
        </div>
      )}

      {(viewMode === 'both' || viewMode === 'bids') && (
        <div
          ref={bidsWrapRef}
          onScroll={(e) => setBidsScrollTop(e.currentTarget.scrollTop)}
          onWheel={handleManualScroll}
          className={`orderBookList bidsList ${viewMode === 'both' || viewMode === 'bids' ? 'noScroll' : ''}`}
        >
          {viewMode === 'asks' && bidWindow.topPad > 0 && <div style={{ height: bidWindow.topPad }} />}
          {visibleBids.map((row) => (
            <OrderRow key={`bid-${row.price}`} row={row} flashState={flashMap[`bid:${row.price}`]} />
          ))}
          {viewMode === 'asks' && bidWindow.bottomPad > 0 && <div style={{ height: bidWindow.bottomPad }} />}
        </div>
      )}
    </div>
  );
};

export default memo(OrderBook);

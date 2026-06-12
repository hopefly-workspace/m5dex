import { useState, useEffect, useMemo, useCallback } from 'react';
import { formatNumber, decimalsForValue, getPriceDecimals, getBaseSymbol } from '../utils/helper';
import {
  getLiquidationPriceLong,
  getLiquidationPriceShort,
  getLiquidationPriceIsolatedLong,
  getLiquidationPriceIsolatedShort,
  getOrderCost,
  getMaxNotional,
  formatLiquidationPrice,
  getIndiaNotionalInr,
  getIndiaMarginInr,
  getIndiaMarginUsdt,
  getIndiaMaxQuantity,
  INDIA_INR_PER_USDT,
} from '../utils/tradingCalculations';
import { useUser } from '../contexts/UserContext';
import { useWalletData } from '../hooks/useWalletData';
import { getWalletKeyForMarketType, getUnitForMarketType, getEmptyWalletData } from '../services/walletApi';
import { placeOrder, normalizePair, getIndiaQuantityByPairId, getForexQuantityByPair } from '../services/tradingApi';
import { normalizeSymbol } from '../services/favouritesWishlistApi';
import {
  getIndiaDisplaySymbol,
  indiaApiSymbolMatchesPair,
  indiaTickMatchesPair,
  indiaTickPairId,
} from '../utils/indiaPairResolve';
import { validateNumber, parseDecimalInput } from '../utils/validators';
import {
  getMarketPrecisionMeta,
  sanitizeQuantityForTyping,
  validateQuantity,
  parseIndianLotCount,
} from '../utils/marketPrecisionValidator';
import { useToast } from '../contexts/ToastContext';
import TransferModal from './TransferModal';
import '../styles/components/TradingPanel.css';

const ORDER_TYPES_MAIN = [
  { id: 'limit', label: 'Limit' },
  { id: 'market', label: 'Market' },
];

const SLIDER_PERCENTS = [0, 25, 50, 75, 100];
/** Set true to show leverage pill + adjust modal (hidden for cleaner exchange-style UI). */
const SHOW_LEVERAGE_CONTROLS = false;

const MARKET_TYPE_LIMIT = 1;
const MARKET_TYPE_MARKET = 2;

const INDIA_DEFAULT_LOT = '';
const FOREX_DEFAULT_LOT = '0';
const FOREX_MAX_LOT = 100;
const CRYPTO_MAJOR_ASSETS = new Set(['BTC', 'ETH']);
const CRYPTO_STABLE_ASSETS = new Set(['USDT', 'USDC', 'BUSD', 'FDUSD', 'TUSD', 'DAI']);

const CRYPTO_QUOTE_SUFFIXES = ['USDT', 'USDC', 'BUSD', 'FDUSD', 'TUSD', 'EUR', 'TRY', 'BNB'];

/** Base asset for quantity label (e.g. BTC from BTCUSDT, ETH from ETHUSDC). */
function getCryptoBaseSymbolFromPair(pairSymbol) {
  const raw = String(pairSymbol ?? '').trim();
  const sym = raw.includes(':') ? raw.split(':').slice(1).join(':').trim() : raw;
  const n = normalizePair(sym) || String(sym).replace(/\//g, '').toUpperCase();
  for (const q of CRYPTO_QUOTE_SUFFIXES) {
    const b = getBaseSymbol(n, q);
    if (b) return b;
  }
  for (const q of CRYPTO_QUOTE_SUFFIXES) {
    if (n.endsWith(q) && n.length > q.length) return n.slice(0, -q.length);
  }
  return n || '—';
}

/**
 * Forex / Indian market: market BUY fills at ask, market SELL at bid.
 * Falls back to `last` when the chosen side has no valid quote (forex / non-strict paths).
 * Indian market orders (limit and market) are gated on full BBO in validation — do not rely on this fallback alone.
 */
function resolveForexIndiaMarketOrderPrice(orderMode, bid, ask, last) {
  const isBuy = orderMode === 'buy' || orderMode === 'long';
  if (isBuy) {
    if (ask != null && Number.isFinite(ask) && ask > 0) return ask;
  } else if (bid != null && Number.isFinite(bid) && bid > 0) {
    return bid;
  }
  return last != null && Number.isFinite(last) && last > 0 ? last : null;
}

/** Crypto market execution convention: BUY at ask, SELL at bid, fallback to last if book side is missing. */
function resolveCryptoMarketOrderPrice(orderMode, bid, ask, last) {
  const isBuy = orderMode === 'buy' || orderMode === 'long';
  if (isBuy) {
    if (ask != null && Number.isFinite(ask) && ask > 0) return ask;
  } else if (bid != null && Number.isFinite(bid) && bid > 0) {
    return bid;
  }
  return last != null && Number.isFinite(last) && last > 0 ? last : null;
}

function isValidTopOfBookLevel(p) {
  return p != null && Number.isFinite(p) && p > 0;
}

function getCryptoAssetType(baseSymbol) {
  const normalized = String(baseSymbol || '').toUpperCase();
  if (CRYPTO_MAJOR_ASSETS.has(normalized)) return 'major';
  if (CRYPTO_STABLE_ASSETS.has(normalized)) return 'stablecoin';
  return 'altcoin';
}

/**
 * Indian market — limit and market: require both best bid and best ask (retail OMS / risk style gate when
 * the book is incomplete or crossed). Last trade alone is not a substitute for a live top of book.
 */
function indiaMarketOrderBookReadyForExecution(bid, ask) {
  if (!isValidTopOfBookLevel(bid) || !isValidTopOfBookLevel(ask)) return false;
  const tol = 1e-9 * Math.max(1, Math.abs(bid), Math.abs(ask));
  if (ask + tol < bid) return false;
  return true;
}

const IndiaMarginSummaryCard = ({
  indiaSummary,
  sizeUnit,
  inrPerUsdt,
  rateFromProfile,
  currency = 'usdt',
}) => {
  if (!indiaSummary) return null;
  const showInr = currency === 'inr';
  const primaryValue = showInr ? indiaSummary.marginInr : indiaSummary.marginUsdt;
  const primaryUnit = showInr ? 'INR' : sizeUnit;
  const primaryPrefix = showInr ? '₹' : '';
  const notionalValue = showInr ? indiaSummary.notionalInr : indiaSummary.positionNotionalUsdt;
  const notionalUnit = showInr ? 'INR' : sizeUnit;
  const secondaryLabel = showInr ? 'Approx margin (USDT)' : 'Approx margin (INR)';
  const secondaryValue = showInr ? indiaSummary.marginUsdt : indiaSummary.marginInr;
  const secondaryUnit = showInr ? sizeUnit : 'INR';
  const secondaryPrefix = showInr ? '' : '₹';

  return (
    <div className="tp-india-calc tp-india-margin-card">
      <div className="tp-india-margin-card__top">
        <span className="tp-india-margin-card__title">Required margin</span>
        <span
          className={`tp-india-margin-card__pill ${rateFromProfile ? 'tp-india-margin-card__pill--live' : ''}`}
          title={rateFromProfile ? '1 USDT rate from your profile' : 'Using default rate until profile is set'}
        >
          {rateFromProfile ? 'Profile' : 'Default'}
        </span>
      </div>
      <div className="tp-india-margin-card__inr">
        {primaryPrefix}
        {formatNumber(primaryValue, showInr ? 2 : 4)}
        <span className="tp-india-margin-card__inr-unit">{primaryUnit}</span>
      </div>
      <div className="tp-india-calc-row tp-india-margin-card__row">
        <span>Notional ({notionalUnit})</span>
        <span>
          {showInr ? '₹' : ''}
          {formatNumber(notionalValue, showInr ? 2 : 4)}
        </span>
      </div>
      <div className="tp-india-calc-row tp-india-margin-card__row tp-india-margin-card__row--usdt">
        <span>{secondaryLabel}</span>
        <span>
          {secondaryPrefix}
          {formatNumber(secondaryValue, showInr ? 4 : 2)} {secondaryUnit}
        </span>
      </div>
      <p className="tp-india-margin-card__rate">
        1 USDT = ₹{formatNumber(inrPerUsdt, 2)}
        {rateFromProfile ? ' · profile' : ` · fallback (default ₹${INDIA_INR_PER_USDT})`}
      </p>
    </div>
  );
};

const TradingPanel = ({
  pair = 'BTCUSDT',
  defaultSide = 'buy',
  marketType = 'crypto',
  marketData = null,
  onOrderSuccess,
  pairId: pairIdProp = '',
  tradingSessionClosed = false,
  tradingSessionMessage = '',
}) => {
  const { walletData, isLoading: balanceLoading, refreshWallet } = useWalletData();
  const { showSuccess, showError } = useToast();
  const { usdtInrRate, cryptoLeverage: cryptoLev, cryptoLeverageIsFromProfile } = useUser();
  const inrPerUsdt = usdtInrRate != null && usdtInrRate > 0 ? usdtInrRate : INDIA_INR_PER_USDT;
  const rateFromProfile = usdtInrRate != null && usdtInrRate > 0;
  const walletKey = getWalletKeyForMarketType(marketType);
  const wallet = walletData?.[walletKey];
  const availableBalance = wallet != null ? Number(wallet.available ?? 0) : 0;
  const sizeUnit = getUnitForMarketType(marketType);

  const rawLastPrice = (marketData?.price ?? marketData?.p ?? marketData?.last ?? marketData?.close) != null
    ? Number(marketData.price ?? marketData.p ?? marketData.last ?? marketData.close)
    : null;

  const lastPrice = rawLastPrice != null
    ? Math.round(rawLastPrice * 1e8) / 1e8
    : null;

  const bidPrice =
    marketData?.bid != null && !Number.isNaN(Number(marketData.bid)) ? Number(marketData.bid) : null;
  const askPrice =
    marketData?.ask != null && !Number.isNaN(Number(marketData.ask)) ? Number(marketData.ask) : null;

  const isIndia = useMemo(
    () => ['india', 'indian'].includes(String(marketType || '').toLowerCase().trim()),
    [marketType]
  );

  const isForexOrIndia = useMemo(() => {
    const t = String(marketType || '').toLowerCase().trim();
    return t === 'forex' || t === 'india' || t === 'indian';
  }, [marketType]);

  const isCrypto = useMemo(
    () => String(marketType || '').toLowerCase().trim() === 'crypto',
    [marketType]
  );

  const isForex = useMemo(
    () => String(marketType || '').toLowerCase().trim() === 'forex',
    [marketType]
  );

  const cryptoBaseSymbol = useMemo(() => getCryptoBaseSymbolFromPair(pair), [pair]);

  const normalizedForexPair = useMemo(
    () => normalizePair(pair) || String(pair ?? '').trim(),
    [pair]
  );

  const forexPairLabel = useMemo(() => {
    const raw = String(pair ?? '').trim();
    if (!raw) return '—';
    if (raw.includes(':')) {
      const rest = raw.split(':').slice(1).join(':').trim();
      return normalizePair(rest) || rest || raw;
    }
    return normalizePair(raw) || raw;
  }, [pair]);

  const indiaDisplaySymbol = useMemo(() => getIndiaDisplaySymbol(pair), [pair]);

  const resolvedPairId = useMemo(() => {
    const fromProp = String(pairIdProp ?? '').trim();
    if (marketData && indiaTickMatchesPair(marketData, pair)) {
      const tickId = indiaTickPairId(marketData);
      if (tickId) return tickId;
    }
    return fromProp;
  }, [pairIdProp, marketData, pair]);

  const [side, setSide] = useState(defaultSide);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [leverage, setLeverage] = useState(100);
  const [openClose, setOpenClose] = useState('open');
  const [orderType, setOrderType] = useState('limit');
  const [price, setPrice] = useState('');
  const [size, setSize] = useState('');
  const [lotSize, setLotSize] = useState(INDIA_DEFAULT_LOT);
  /** Units per 1 lot from POST /trading/getquantity (Indian market only). */
  const [quantityPerLot, setQuantityPerLot] = useState(null);
  const [indiaPairSymbol, setIndiaPairSymbol] = useState('');
  const [indiaQtyPerLotLoading, setIndiaQtyPerLotLoading] = useState(false);
  /** Forex: lots input + units per lot from POST /trading/getforexquantity */
  const [forexLotSize, setForexLotSize] = useState(FOREX_DEFAULT_LOT);
  const [forexQuantityPerLot, setForexQuantityPerLot] = useState(null);
  const [forexPairSymbolFromApi, setForexPairSymbolFromApi] = useState('');
  const [forexQtyLoading, setForexQtyLoading] = useState(false);
  const [sliderPercent, setSliderPercent] = useState(0);
  const [indiaCalcCurrency, setIndiaCalcCurrency] = useState('usdt');

  useEffect(() => {
    if (!isIndia) setIndiaCalcCurrency('usdt');
  }, [isIndia]);

  useEffect(() => {
    setSide(defaultSide);
  }, [defaultSide]);

  useEffect(() => {
    const t = String(marketType || '').toLowerCase().trim();
    if (t === 'india' || t === 'indian') {
      setLotSize(INDIA_DEFAULT_LOT);
      setLeverage(100);
    }
    if (t === 'forex') {
      setForexLotSize(FOREX_DEFAULT_LOT);
    }
    setMarketFieldErrors({ crypto: null, forex: null, india: null });
  }, [marketType]);

  useEffect(() => {
    if (!isForex || !normalizedForexPair) {
      setForexQuantityPerLot(null);
      setForexPairSymbolFromApi('');
      setForexQtyLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setForexQtyLoading(true);
      try {
        const res = await getForexQuantityByPair(normalizedForexPair);
        if (cancelled) return;
        if (res != null) {
          const qPer = Number(res.quantity);
          setForexQuantityPerLot(Number.isFinite(qPer) && qPer > 0 ? qPer : null);
          setForexPairSymbolFromApi(res.pairsymbol || '');
        } else {
          setForexQuantityPerLot(null);
          setForexPairSymbolFromApi('');
        }
      } catch {
        if (!cancelled) {
          setForexQuantityPerLot(null);
          setForexPairSymbolFromApi('');
          showError('Could not load quantity per lot for this forex pair.', 4000);
        }
      } finally {
        if (!cancelled) setForexQtyLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isForex, normalizedForexPair, showError]);

  useEffect(() => {
    if (!isIndia) {
      setQuantityPerLot(null);
      setIndiaPairSymbol('');
      setIndiaQtyPerLotLoading(false);
      return;
    }
    setQuantityPerLot(null);
    setIndiaPairSymbol('');
    if (!resolvedPairId) {
      setIndiaQtyPerLotLoading(false);
      return;
    }
    const fetchPairId = resolvedPairId;
    const symbolKey = normalizeSymbol(pair);
    let cancelled = false;
    (async () => {
      setIndiaQtyPerLotLoading(true);
      try {
        const res = await getIndiaQuantityByPairId(fetchPairId);
        if (cancelled) return;
        if (res != null) {
          if (
            symbolKey &&
            res.pairsymbol &&
            !indiaApiSymbolMatchesPair(res.pairsymbol, pair)
          ) {
            setQuantityPerLot(null);
            setIndiaPairSymbol(indiaDisplaySymbol);
            showError(
              'Lot size data does not match the selected symbol. Reselect the pair from Pair List.',
              5000
            );
            return;
          }
          setQuantityPerLot(res.quantity);
          setIndiaPairSymbol(res.pairsymbol || indiaDisplaySymbol);
          setLotSize(INDIA_DEFAULT_LOT);
        } else {
          setQuantityPerLot(null);
          setIndiaPairSymbol(indiaDisplaySymbol);
        }
      } catch {
        if (!cancelled) {
          setQuantityPerLot(null);
          setIndiaPairSymbol(indiaDisplaySymbol);
          showError('Could not load quantity per lot for this instrument.', 4000);
        }
      } finally {
        if (!cancelled) setIndiaQtyPerLotLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isIndia, resolvedPairId, pair, showError, indiaDisplaySymbol]);
  const [tpSlChecked, setTpSlChecked] = useState(false);
  const [takeProfit, setTakeProfit] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [leverageModalOpen, setLeverageModalOpen] = useState(false);
  const [leverageModalValue, setLeverageModalValue] = useState(leverage);
  const [closeTooltipVisible, setCloseTooltipVisible] = useState(false);
  // const [orderSubmitLoading, setOrderSubmitLoading] = useState(false);
  const [orderSubmitSideLoading, setOrderSubmitSideLoading] = useState(null);
  const [orderValidationErrors, setOrderValidationErrors] = useState({});
  const [marketFieldErrors, setMarketFieldErrors] = useState({
    crypto: null,
    forex: null,
    india: null,
  });

  const cryptoAssetType = useMemo(() => getCryptoAssetType(cryptoBaseSymbol), [cryptoBaseSymbol]);
  const cryptoPrecisionMeta = useMemo(
    () => getMarketPrecisionMeta('crypto', { assetType: cryptoAssetType }),
    [cryptoAssetType]
  );
  const forexPrecisionMeta = useMemo(() => getMarketPrecisionMeta('forex'), []);
  const indiaPrecisionMeta = useMemo(() => getMarketPrecisionMeta('indian_fo'), []);

  /** Price for crypto quantity ↔ USDT estimates and max-qty slider (limit price if valid, else last). */
  const cryptoSliderRefPrice = useMemo(() => {
    if (!isCrypto) return null;
    if (orderType === 'limit') {
      const p = parseDecimalInput(price);
      if (!Number.isNaN(p) && p > 0) return p;
      return lastPrice != null && !Number.isNaN(lastPrice) && lastPrice > 0 ? lastPrice : null;
    }
    return lastPrice != null && !Number.isNaN(lastPrice) && lastPrice > 0 ? lastPrice : null;
  }, [isCrypto, orderType, price, lastPrice]);

  const cryptoQtyParsed = useMemo(() => {
    if (!isCrypto) return null;
    const n = parseDecimalInput(size);
    return !Number.isNaN(n) && n > 0 ? n : null;
  }, [isCrypto, size]);

  /** USDT position notional (qty × reference price). */
  const cryptoOrderValueUsdt = useMemo(() => {
    if (!isCrypto || cryptoQtyParsed == null || cryptoSliderRefPrice == null) return null;
    return cryptoQtyParsed * cryptoSliderRefPrice;
  }, [isCrypto, cryptoQtyParsed, cryptoSliderRefPrice]);

  const cryptoMaxOrderValueUsdt = useMemo(
    () => (isCrypto ? getMaxNotional(availableBalance, cryptoLev) : 0),
    [isCrypto, availableBalance, cryptoLev]
  );

  const cryptoOrderExceedsBalance = useMemo(() => {
    if (!isCrypto || cryptoOrderValueUsdt == null) return false;
    return cryptoOrderValueUsdt > cryptoMaxOrderValueUsdt + 1e-6;
  }, [isCrypto, cryptoOrderValueUsdt, cryptoMaxOrderValueUsdt]);

  /** Block place-order when crypto order value > available (matches red balance UI). */
  const cryptoSubmitDisabledForBalance = isCrypto && cryptoOrderExceedsBalance;

  /** Forex: reference price for notional / slider (limit price if valid, else last). */
  const forexSliderRefPrice = useMemo(() => {
    if (!isForex) return null;
    if (orderType === 'limit') {
      const p = parseDecimalInput(price);
      if (!Number.isNaN(p) && p > 0) return p;
      return lastPrice != null && !Number.isNaN(lastPrice) && lastPrice > 0 ? lastPrice : null;
    }
    return lastPrice != null && !Number.isNaN(lastPrice) && lastPrice > 0 ? lastPrice : null;
  }, [isForex, orderType, price, lastPrice]);

  const forexOrderQuantity = useMemo(() => {
    if (!isForex) return null;
    const uPer = Number(forexQuantityPerLot);
    if (!Number.isFinite(uPer) || uPer <= 0) return null;
    const lotParsed = parseDecimalInput(forexLotSize);
    const lot = Number.isFinite(lotParsed) && lotParsed > 0 ? lotParsed : 0;
    if (lot <= 0) return null;
    return lot * uPer;
  }, [isForex, forexLotSize, forexQuantityPerLot]);

  const forexNotionalUsdt = useMemo(() => {
    if (!isForex || forexOrderQuantity == null || forexSliderRefPrice == null) return null;
    return forexOrderQuantity * forexSliderRefPrice;
  }, [isForex, forexOrderQuantity, forexSliderRefPrice]);

  const forexMaxNotionalUsdt = useMemo(
    () => (isForex ? getMaxNotional(availableBalance, leverage || 1) : 0),
    [isForex, availableBalance, leverage]
  );

  const forexMarginUsdtLive = useMemo(() => {
    if (!isForex || forexNotionalUsdt == null) return null;
    const lev = leverage || 1;
    return lev >= 1 ? forexNotionalUsdt / lev : null;
  }, [isForex, forexNotionalUsdt, leverage]);

  /** True when required margin or notional exceeds what the wallet can support at current leverage. */
  const forexOrderExceedsBalance = useMemo(() => {
    if (!isForex) return false;
    if (
      forexMarginUsdtLive != null &&
      Number.isFinite(forexMarginUsdtLive) &&
      forexMarginUsdtLive > 0 &&
      forexMarginUsdtLive > availableBalance + 1e-8
    ) {
      return true;
    }
    if (forexNotionalUsdt != null && forexMaxNotionalUsdt > 0) {
      return forexNotionalUsdt > forexMaxNotionalUsdt + 1e-6;
    }
    return false;
  }, [
    isForex,
    forexMarginUsdtLive,
    availableBalance,
    forexNotionalUsdt,
    forexMaxNotionalUsdt,
  ]);

  const forexSubmitDisabledForBalance = isForex && forexOrderExceedsBalance;

  const LEVERAGE_MIN = 1;
  const LEVERAGE_MAX = 100;
  const LEVERAGE_MARKERS = [1, 30, 60, 80, 100];

  const leverageOptions = [1, 2, 3, 5, 10, 20, 50, 100, 125, 150];

  /** India: full BBO required for margin and order entry; market uses bid/ask by side (no last-trade fallback). */
  const effectiveEntryPrice =
    orderType === 'limit'
      ? isIndia
        ? indiaMarketOrderBookReadyForExecution(bidPrice, askPrice) && price !== ''
          ? parseDecimalInput(price)
          : null
        : price !== ''
          ? parseDecimalInput(price)
          : null
      : isIndia
        ? indiaMarketOrderBookReadyForExecution(bidPrice, askPrice)
          ? resolveForexIndiaMarketOrderPrice(side, bidPrice, askPrice, null)
          : null
        : (lastPrice ?? (price !== '' ? parseDecimalInput(price) : null));
  const entryPriceNum = effectiveEntryPrice != null && !Number.isNaN(effectiveEntryPrice) ? effectiveEntryPrice : null;

  /**
   * India: price for lot slider, margin preview, and max-lot math.
   * Uses live bid/ask when the book is valid; otherwise falls back to LTP so the UI stays usable.
   */
  const indiaRefPriceForSizing = useMemo(() => {
    if (!isIndia) return null;
    if (indiaMarketOrderBookReadyForExecution(bidPrice, askPrice)) {
      const sidePx = resolveForexIndiaMarketOrderPrice(side, bidPrice, askPrice, lastPrice);
      if (sidePx != null && sidePx > 0) return sidePx;
      return (bidPrice + askPrice) / 2;
    }
    if (lastPrice != null && lastPrice > 0) return lastPrice;
    if (askPrice != null && askPrice > 0) return askPrice;
    if (bidPrice != null && bidPrice > 0) return bidPrice;
    return null;
  }, [isIndia, bidPrice, askPrice, lastPrice, side]);

  const indiaSizingUsesLtpFallback = useMemo(
    () =>
      isIndia &&
      !indiaMarketOrderBookReadyForExecution(bidPrice, askPrice) &&
      indiaRefPriceForSizing != null &&
      lastPrice != null &&
      lastPrice > 0,
    [isIndia, bidPrice, askPrice, indiaRefPriceForSizing, lastPrice]
  );

  const indiaMarketNoExecutableBook = useMemo(
    () => isIndia && !indiaMarketOrderBookReadyForExecution(bidPrice, askPrice),
    [isIndia, bidPrice, askPrice]
  );

  /** Non-India: forex long/short uses feed-side mapping; crypto market uses ask for buy and bid for sell. */
  const entryPriceNumBuySide = useMemo(() => {
    if (orderType === 'limit') {
      const p = price !== '' ? parseDecimalInput(price) : null;
      return p != null && !Number.isNaN(p) ? p : null;
    }
    if (isCrypto) {
      const r = resolveCryptoMarketOrderPrice('buy', bidPrice, askPrice, lastPrice);
      return r != null && !Number.isNaN(r) ? r : null;
    }
    if (isIndia) {
      const r = resolveForexIndiaMarketOrderPrice('buy', bidPrice, askPrice, lastPrice);
      return r != null && !Number.isNaN(r) ? r : null;
    }
    if (isForexOrIndia) {
      const r = resolveForexIndiaMarketOrderPrice('buy', bidPrice, askPrice, lastPrice);
      return r != null && !Number.isNaN(r) ? r : null;
    }
    return lastPrice != null && !Number.isNaN(lastPrice) ? lastPrice : null;
  }, [orderType, isCrypto, isForexOrIndia, isIndia, price, bidPrice, askPrice, lastPrice]);

  const entryPriceNumSellSide = useMemo(() => {
    if (orderType === 'limit') {
      const p = price !== '' ? parseDecimalInput(price) : null;
      return p != null && !Number.isNaN(p) ? p : null;
    }
    if (isCrypto) {
      const r = resolveCryptoMarketOrderPrice('sell', bidPrice, askPrice, lastPrice);
      return r != null && !Number.isNaN(r) ? r : null;
    }
    if (isIndia) {
      const r = resolveForexIndiaMarketOrderPrice('sell', bidPrice, askPrice, lastPrice);
      return r != null && !Number.isNaN(r) ? r : null;
    }
    if (isForexOrIndia) {
      const r = resolveForexIndiaMarketOrderPrice('sell', bidPrice, askPrice, lastPrice);
      return r != null && !Number.isNaN(r) ? r : null;
    }
    return lastPrice != null && !Number.isNaN(lastPrice) ? lastPrice : null;
  }, [orderType, isCrypto, isForexOrIndia, isIndia, price, bidPrice, askPrice, lastPrice]);

  /** Total order quantity = lot size × API quantity per lot (read-only). */
  const indiaLotCount = useMemo(() => {
    if (!isIndia) return null;
    return parseIndianLotCount(lotSize);
  }, [isIndia, lotSize]);

  const indiaOrderQuantity = useMemo(() => {
    if (!isIndia) return null;
    if (quantityPerLot == null || quantityPerLot <= 0 || !Number.isFinite(quantityPerLot)) return null;
    if (indiaLotCount == null) return null;
    return indiaLotCount * quantityPerLot;
  }, [isIndia, indiaLotCount, quantityPerLot]);

  const indiaSummary = useMemo(() => {
    if (!isIndia) return null;
    const ep = indiaRefPriceForSizing;
    const lot = indiaLotCount ?? 0;
    const qty = indiaOrderQuantity ?? 0;
    const lev = leverage || 1;
    if (ep == null || ep <= 0 || !Number.isFinite(lot) || lot <= 0 || !Number.isFinite(qty) || qty <= 0) {
      return {
        marginUsdt: 0,
        notionalInr: 0,
        marginInr: 0,
        maxQty: 0,
        positionNotionalUsdt: 0,
      };
    }
    const notionalInr = getIndiaNotionalInr(lot, qty, ep);
    const marginInr = getIndiaMarginInr(lot, qty, ep, lev);
    const marginUsdt = getIndiaMarginUsdt(lot, qty, ep, lev, inrPerUsdt);
    const maxQty = getIndiaMaxQuantity(lot, ep, lev, availableBalance, inrPerUsdt);
    const positionNotionalUsdt = marginUsdt * lev;
    return { marginUsdt, notionalInr, marginInr, maxQty, positionNotionalUsdt };
  }, [isIndia, indiaRefPriceForSizing, indiaLotCount, indiaOrderQuantity, leverage, availableBalance, inrPerUsdt]);
  const indiaOrderExceedsBalance = useMemo(() => {
    if (!isIndia || !indiaSummary) return false;
    return Number(indiaSummary.marginUsdt || 0) > availableBalance + 1e-8;
  }, [isIndia, indiaSummary, availableBalance]);

  const indiaAvailableDisplay = useMemo(() => {
    if (!isIndia) return availableBalance;
    return indiaCalcCurrency === 'inr' ? availableBalance * inrPerUsdt : availableBalance;
  }, [isIndia, indiaCalcCurrency, availableBalance, inrPerUsdt]);

  const indiaDisplayUnit = isIndia && indiaCalcCurrency === 'inr' ? 'INR' : sizeUnit;
  const indiaCurrencyToggle = isIndia ? (
    <div className="tp-india-currency-toolbar">
      <span className="tp-india-currency-toolbar__label">Display</span>
      <div className="tp-india-currency-toggle" role="group" aria-label="Indian market calculation currency">
        <button
          type="button"
          className={`tp-india-currency-btn ${indiaCalcCurrency === 'usdt' ? 'active' : ''}`}
          onClick={() => setIndiaCalcCurrency('usdt')}
        >
          USDT
        </button>
        <button
          type="button"
          className={`tp-india-currency-btn ${indiaCalcCurrency === 'inr' ? 'active' : ''}`}
          onClick={() => setIndiaCalcCurrency('inr')}
          title={`1 USDT = ₹${formatNumber(inrPerUsdt, 2)}`}
        >
          INR
        </button>
      </div>
    </div>
  ) : null;

  const buySummary = useMemo(() => {
    if (isIndia && indiaSummary) {
      return {
        liqPrice: '--',
        cost: indiaSummary.marginUsdt,
        max: indiaSummary.maxQty,
        maxNotionalUsdt: getMaxNotional(availableBalance, leverage || 1),
        isIndia: true,
      };
    }
    const lev = leverage || 1;
    if (isCrypto) {
      const qty = parseDecimalInput(size);
      const q = !Number.isNaN(qty) && qty > 0 ? qty : 0;
      const ep = entryPriceNumBuySide;
      const positionNotional = ep != null && ep > 0 && q > 0 ? q * ep : 0;
      const lev = cryptoLev >= 1 ? cryptoLev : 1;
      const cost = positionNotional;
      const margin = positionNotional > 0 ? positionNotional / lev : 0;
      const maxNotional = getMaxNotional(availableBalance, cryptoLev);
      const maxBase = ep != null && ep > 0 && maxNotional > 0 ? maxNotional / ep : 0;
      const liqLong =
        ep != null && ep > 0 && positionNotional > 0
          ? getLiquidationPriceLong(ep, availableBalance, positionNotional)
          : null;
      return {
        liqPrice: formatLiquidationPrice(liqLong, (n, d) => formatNumber(n, d)),
        cost,
        margin,
        max: maxBase,
        isIndia: false,
      };
    }
    if (isForex) {
      const lotN = parseDecimalInput(forexLotSize);
      const lot = Number.isFinite(lotN) && lotN > 0 ? lotN : 0;
      const uPerLot = Number(forexQuantityPerLot);
      const q =
        lot > 0 && Number.isFinite(uPerLot) && uPerLot > 0 ? lot * uPerLot : 0;
      const ep = entryPriceNumBuySide;
      const positionNotional = ep != null && ep > 0 && q > 0 ? q * ep : 0;
      const margin = positionNotional > 0 ? positionNotional / lev : 0;
      const maxNotional = getMaxNotional(availableBalance, lev);
      const liqLong =
        ep != null && ep > 0 && positionNotional > 0
          ? getLiquidationPriceIsolatedLong(ep, lev)
          : null;
      return {
        liqPrice: formatLiquidationPrice(
          liqLong,
          (n, d) => formatNumber(n, d),
          (n) => getPriceDecimals(n, 'forex')
        ),
        cost: margin,
        notional: positionNotional,
        max: maxNotional,
        isIndia: false,
      };
    }
    const positionNotional = getOrderCost(size, lev, true);
    const cost = positionNotional;
    const max = getMaxNotional(availableBalance, lev);
    const liqLong =
      entryPriceNumBuySide != null && entryPriceNumBuySide > 0 && positionNotional > 0
        ? getLiquidationPriceLong(entryPriceNumBuySide, availableBalance, positionNotional)
        : null;
    return {
      liqPrice: formatLiquidationPrice(liqLong, (n, d) => formatNumber(n, d)),
      cost,
      max,
      isIndia: false,
    };
  }, [
    isIndia,
    indiaSummary,
    isCrypto,
    isForex,
    cryptoLev,
    entryPriceNumBuySide,
    size,
    leverage,
    availableBalance,
    forexLotSize,
    forexQuantityPerLot,
  ]);

  const sellSummary = useMemo(() => {
    if (isIndia && indiaSummary) {
      return {
        liqPrice: '--',
        cost: indiaSummary.marginUsdt,
        max: indiaSummary.maxQty,
        maxNotionalUsdt: getMaxNotional(availableBalance, leverage || 1),
        isIndia: true,
      };
    }
    const lev = leverage || 1;
    if (isCrypto) {
      const qty = parseDecimalInput(size);
      const q = !Number.isNaN(qty) && qty > 0 ? qty : 0;
      const ep = entryPriceNumSellSide;
      const positionNotional = ep != null && ep > 0 && q > 0 ? q * ep : 0;
      const lev = cryptoLev >= 1 ? cryptoLev : 1;
      const cost = positionNotional;
      const margin = positionNotional > 0 ? positionNotional / lev : 0;
      const maxNotional = getMaxNotional(availableBalance, cryptoLev);
      const maxBase = ep != null && ep > 0 && maxNotional > 0 ? maxNotional / ep : 0;
      const liqShort =
        ep != null && ep > 0 && positionNotional > 0
          ? getLiquidationPriceShort(ep, availableBalance, positionNotional)
          : null;
      return {
        liqPrice: formatLiquidationPrice(liqShort, (n, d) => formatNumber(n, d)),
        cost,
        margin,
        max: maxBase,
        isIndia: false,
      };
    }
    if (isForex) {
      const lotN = parseDecimalInput(forexLotSize);
      const lot = Number.isFinite(lotN) && lotN > 0 ? lotN : 0;
      const uPerLot = Number(forexQuantityPerLot);
      const q =
        lot > 0 && Number.isFinite(uPerLot) && uPerLot > 0 ? lot * uPerLot : 0;
      const ep = entryPriceNumSellSide;
      const positionNotional = ep != null && ep > 0 && q > 0 ? q * ep : 0;
      const margin = positionNotional > 0 ? positionNotional / lev : 0;
      const maxNotional = getMaxNotional(availableBalance, lev);
      const liqShort =
        ep != null && ep > 0 && positionNotional > 0
          ? getLiquidationPriceIsolatedShort(ep, lev)
          : null;
      return {
        liqPrice: formatLiquidationPrice(
          liqShort,
          (n, d) => formatNumber(n, d),
          (n) => getPriceDecimals(n, 'forex')
        ),
        cost: margin,
        notional: positionNotional,
        max: maxNotional,
        isIndia: false,
      };
    }
    const positionNotional = getOrderCost(size, lev, true);
    const cost = positionNotional;
    const max = getMaxNotional(availableBalance, lev);
    const liqShort =
      entryPriceNumSellSide != null && entryPriceNumSellSide > 0 && positionNotional > 0
        ? getLiquidationPriceShort(entryPriceNumSellSide, availableBalance, positionNotional)
        : null;
    return {
      liqPrice: formatLiquidationPrice(liqShort, (n, d) => formatNumber(n, d)),
      cost,
      max,
      isIndia: false,
    };
  }, [
    isIndia,
    indiaSummary,
    isCrypto,
    isForex,
    cryptoLev,
    entryPriceNumSellSide,
    size,
    leverage,
    availableBalance,
    forexLotSize,
    forexQuantityPerLot,
  ]);

  const formatCurrency = (num) => formatNumber(num, 2);

  const suggestedPrice = lastPrice != null && !Number.isNaN(lastPrice)
    ? side === 'buy' || side === 'long'
      ? lastPrice * 0.9995
      : lastPrice * 1.0005
    : null;

  const getSuggestedPriceString = () => {
    if (suggestedPrice == null || Number.isNaN(suggestedPrice)) return null;
    const decimals = getPriceDecimals(suggestedPrice, isIndia ? 'india' : marketType);
    return suggestedPrice.toFixed(decimals);
  };

  const applySuggestedPrice = () => {
    const str = getSuggestedPriceString();
    if (str != null) setPrice(str);
  };

  const handleSliderPercentChange = (pct) => {
    const value = Math.min(100, Math.max(0, Number(pct)));
    setSliderPercent(value);
    if (isIndia) {
      const refPx = indiaRefPriceForSizing;
      const lev = leverage || 1;
      const unitsPerLot = Number(quantityPerLot);
      const maxNotionalInr = availableBalance * lev * inrPerUsdt;
      const maxLots =
        refPx != null &&
          refPx > 0 &&
          maxNotionalInr > 0 &&
          Number.isFinite(unitsPerLot) &&
          unitsPerLot > 0
          ? maxNotionalInr / (unitsPerLot * refPx)
          : 0;
      if (value <= 0) {
        setLotSize('');
      } else if (maxLots > 0) {
        const lots = Math.max(1, Math.floor((maxLots * value) / 100));
        setLotSize(String(lots));
      }
      return;
    }
    if (isCrypto) {
      const refPx = cryptoSliderRefPrice;
      const maxNotional = getMaxNotional(availableBalance, cryptoLev);
      const maxBase =
        refPx != null && refPx > 0 && maxNotional > 0 ? maxNotional / refPx : 0;
      if (maxBase > 0) {
        const qty = (maxBase * value) / 100;
        const dec = decimalsForValue(qty);
        setSize(qty > 0 ? formatNumber(qty, dec) : '');
      } else {
        setSize('');
      }
      return;
    }
    if (isForex) {
      const refPx = forexSliderRefPrice;
      const lev = leverage || 1;
      const maxNotional = getMaxNotional(availableBalance, lev);
      const u = Number(forexQuantityPerLot);
      if (refPx != null && refPx > 0 && maxNotional > 0 && Number.isFinite(u) && u > 0) {
        const maxLots = maxNotional / (u * refPx);
        const lots = (maxLots * value) / 100;
        const dec = decimalsForValue(lots);
        setForexLotSize(lots > 0 ? formatNumber(lots, dec) : '');
      } else {
        setForexLotSize('');
      }
      return;
    }
    const amount = (availableBalance * value) / 100;
    setSize(amount > 0 ? formatNumber(amount) : '');
  };

  const handleSliderInputChange = (e) => {
    const value = Number(e.target.value);
    handleSliderPercentChange(value);
  };

  const handleSliderDotClick = (pct) => {
    handleSliderPercentChange(pct);
  };

  const handleSizeChange = (e) => {
    const raw = sanitizeQuantityForTyping(e.target.value, 'crypto', { assetType: cryptoAssetType });
    setSize(raw);
    setMarketFieldErrors((prev) => ({ ...prev, crypto: null }));
    if (isCrypto) {
      const refPx = cryptoSliderRefPrice;
      const maxNotional = getMaxNotional(availableBalance, cryptoLev);
      const maxBase =
        refPx != null && refPx > 0 && maxNotional > 0 ? maxNotional / refPx : 0;
      if (maxBase > 0 && raw !== '') {
        const num = parseDecimalInput(raw);
        if (!Number.isNaN(num) && num >= 0) {
          setSliderPercent(Math.min(100, (num / maxBase) * 100));
        }
      } else if (raw === '') {
        setSliderPercent(0);
      }
      return;
    }
    if (availableBalance > 0 && raw !== '') {
      const num = parseDecimalInput(raw);
      if (!Number.isNaN(num) && num >= 0) {
        const pct = Math.min(100, (num / availableBalance) * 100);
        setSliderPercent(pct);
      }
    } else if (raw === '') {
      setSliderPercent(0);
    }
  };

  const handleLotSizeChange = (e) => {
    const raw = sanitizeQuantityForTyping(e.target.value, 'indian_fo');
    setLotSize(raw);
    setMarketFieldErrors((prev) => ({ ...prev, india: null }));
    const refPx = indiaRefPriceForSizing;
    const lev = leverage || 1;
    const unitsPerLot = Number(quantityPerLot);
    const maxNotionalInr = availableBalance * lev * inrPerUsdt;
    if (
      refPx != null &&
      refPx > 0 &&
      maxNotionalInr > 0 &&
      Number.isFinite(unitsPerLot) &&
      unitsPerLot > 0 &&
      raw !== ''
    ) {
      const maxLots = maxNotionalInr / (unitsPerLot * refPx);
      const num = parseIndianLotCount(raw);
      if (num != null && maxLots > 0) {
        setSliderPercent(Math.min(100, (num / maxLots) * 100));
      }
    } else if (raw === '') {
      setSliderPercent(0);
    }
  };

  const handleForexLotChange = (e) => {
    const raw = sanitizeQuantityForTyping(e.target.value, 'forex', { maxLot: FOREX_MAX_LOT });
    setForexLotSize(raw);
    setMarketFieldErrors((prev) => ({ ...prev, forex: null }));
    const refPx = forexSliderRefPrice;
    const lev = leverage || 1;
    const maxNotional = getMaxNotional(availableBalance, lev);
    const u = Number(forexQuantityPerLot);
    if (refPx != null && refPx > 0 && maxNotional > 0 && Number.isFinite(u) && u > 0 && raw !== '') {
      const maxLots = maxNotional / (u * refPx);
      const num = parseDecimalInput(raw);
      if (!Number.isNaN(num) && num >= 0 && maxLots > 0) {
        setSliderPercent(Math.min(100, (num / maxLots) * 100));
      }
    } else if (raw === '') {
      setSliderPercent(0);
    }
  };

  const applyMarketValueByType = useCallback((type, value) => {
    if (type === 'crypto') {
      handleSizeChange({ target: { value } });
      return;
    }
    if (type === 'forex') {
      handleForexLotChange({ target: { value } });
      return;
    }
    handleLotSizeChange({ target: { value } });
  }, [handleForexLotChange, handleLotSizeChange, handleSizeChange]);

  const handleMarketFieldBlur = useCallback((type, value) => {
    const options = type === 'crypto'
      ? { assetType: cryptoAssetType, assetLabel: cryptoBaseSymbol }
      : type === 'forex'
        ? { maxLot: FOREX_MAX_LOT }
        : {};
    const result = validateQuantity(value, type, options);
    const sanitized = result.sanitizedValue;
    if (sanitized !== value) {
      applyMarketValueByType(type, sanitized);
    }
    setMarketFieldErrors((prev) => ({
      ...prev,
      [type === 'indian_fo' ? 'india' : type]: result.isValid ? null : result.errorMessage,
    }));
  }, [applyMarketValueByType, cryptoAssetType, cryptoBaseSymbol]);

  const handleMarketFieldPaste = useCallback((e, type) => {
    const pasted = e.clipboardData?.getData('text') ?? '';
    if (!pasted) return;
    e.preventDefault();
    const options = type === 'crypto'
      ? { assetType: cryptoAssetType, assetLabel: cryptoBaseSymbol }
      : type === 'forex'
        ? { maxLot: FOREX_MAX_LOT }
        : {};
    const result = validateQuantity(pasted, type, options);
    applyMarketValueByType(type, result.sanitizedValue);
    setMarketFieldErrors((prev) => ({
      ...prev,
      [type === 'indian_fo' ? 'india' : type]: result.isValid ? null : result.errorMessage,
    }));
  }, [applyMarketValueByType, cryptoAssetType, cryptoBaseSymbol]);

  const openLeverageModal = () => {
    setLeverageModalValue(clampLeverage(leverage));
    setLeverageModalOpen(true);
  };

  useEffect(() => {
    if (leverageModalOpen) setLeverageModalValue(clampLeverage(leverage));
  }, [leverageModalOpen]);

  const closeLeverageModal = () => setLeverageModalOpen(false);

  const clampLeverage = (v) => Math.min(LEVERAGE_MAX, Math.max(LEVERAGE_MIN, Number(v) || LEVERAGE_MIN));

  const setLeverageModal = (v) => setLeverageModalValue(clampLeverage(v));

  const handleLeverageConfirm = () => {
    setLeverage(leverageModalValue);
    closeLeverageModal();
  };

  /** Validate order form; returns { isValid, errors } and sets orderValidationErrors */
  const validateOrderForm = useCallback(
    (mode) => {
      const errors = {};
      const isLimit = orderType === 'limit';

      const effectivePrice = isLimit ? price : (lastPrice ?? price);
      const priceNum =
        effectivePrice !== '' && effectivePrice != null ? parseDecimalInput(effectivePrice) : null;

      if (isLimit) {
        const pr = validateNumber(price, { required: true, min: 0.00000001 });
        if (!pr.isValid) {
          errors.price = pr.error === 'This field is required' ? 'Price is required' : (pr.error || 'Price is required');
        } else if (isIndia) {
          if (!isValidTopOfBookLevel(bidPrice) || !isValidTopOfBookLevel(askPrice)) {
            errors.price =
              'Live best bid and ask are required before placing an order. Wait for the quote feed.';
          } else if (!indiaMarketOrderBookReadyForExecution(bidPrice, askPrice)) {
            errors.price =
              'Bid/ask looks crossed or stale. Wait for a fresh top of book.';
          }
        }
      } else if (isIndia) {
        if (!isValidTopOfBookLevel(bidPrice) || !isValidTopOfBookLevel(askPrice)) {
          errors.price =
            'Live best bid and ask are required for market orders. Wait for the quote feed.';
        } else if (!indiaMarketOrderBookReadyForExecution(bidPrice, askPrice)) {
          errors.price =
            'Bid/ask looks crossed or stale. Wait for a fresh top of book.';
        } else {
          const refPrice = resolveForexIndiaMarketOrderPrice(mode, bidPrice, askPrice, null);
          if (refPrice == null || Number.isNaN(refPrice) || refPrice <= 0) {
            errors.price =
              'Executable reference price could not be read from the book. Retry when quotes update.';
          }
        }
      } else {
        const refPrice = isForexOrIndia
          ? resolveForexIndiaMarketOrderPrice(mode, bidPrice, askPrice, lastPrice)
          : isCrypto
            ? resolveCryptoMarketOrderPrice(mode, bidPrice, askPrice, lastPrice)
            : lastPrice;
        if (refPrice == null || Number.isNaN(refPrice) || refPrice <= 0) {
          errors.price = isForexOrIndia
            ? 'Bid/ask is not available for this side. Wait for feed or switch to Limit.'
            : 'Market price is not available. Wait for feed or switch to Limit.';
        }
      }

      if (isIndia) {
        if (!resolvedPairId) {
          errors.pairid = 'Instrument id (pairid) is required. Pick a symbol from Indian markets.';
        }
        const lotV = validateQuantity(lotSize, 'indian_fo');
        if (!lotV.isValid || !lotSize.trim()) errors.lotsize = lotV.errorMessage || 'Lot size is required';
        if (indiaQtyPerLotLoading) {
          errors.quantity = 'Loading contract quantity for this instrument…';
        }
        if (quantityPerLot == null || quantityPerLot <= 0) {
          errors.quantity = 'Contract quantity is not loaded. Wait for instrument data.';
        }
        if (indiaOrderQuantity == null || indiaOrderQuantity <= 0) {
          errors.quantity = errors.quantity || 'Quantity must be lot size × units per lot from the exchange.';
        }

        const ep = isLimit
          ? isIndia
            ? indiaMarketOrderBookReadyForExecution(bidPrice, askPrice) &&
              priceNum != null &&
              !Number.isNaN(priceNum) &&
              priceNum > 0
              ? priceNum
              : null
            : priceNum
          : isIndia
            ? indiaMarketOrderBookReadyForExecution(bidPrice, askPrice)
              ? resolveForexIndiaMarketOrderPrice(mode, bidPrice, askPrice, null)
              : null
            : isForexOrIndia
              ? resolveForexIndiaMarketOrderPrice(mode, bidPrice, askPrice, lastPrice)
              : lastPrice;
        if (ep != null && !Number.isNaN(ep) && ep > 0) {
          const lotN = indiaLotCount;
          const qtyN = indiaOrderQuantity;
          if (lotN != null && lotN > 0 && qtyN != null && qtyN > 0) {
            const marginUsdt = getIndiaMarginUsdt(lotN, qtyN, ep, leverage || 1, inrPerUsdt);
            const marginInrErr = getIndiaMarginInr(lotN, qtyN, ep, leverage || 1);
            if (marginUsdt > availableBalance + 1e-8) {
              errors.quantity = 'Required margin exceeds available balance. Reduce lot size or add funds.';
            }
          }
        }
      } else if (isCrypto) {
        const qty = validateQuantity(size, 'crypto', {
          assetType: cryptoAssetType,
          assetLabel: cryptoBaseSymbol,
        });
        if (!qty.isValid || !size) errors.quantity = qty.errorMessage || 'Quantity is required';
        const qtyNum = parseDecimalInput(size);
        let ep = null;
        if (isLimit) {
          ep = priceNum != null && !Number.isNaN(priceNum) && priceNum > 0 ? priceNum : null;
        } else {
          ep = resolveCryptoMarketOrderPrice(mode, bidPrice, askPrice, lastPrice);
        }
        if (
          !errors.quantity &&
          !errors.price &&
          Number.isFinite(qtyNum) &&
          qtyNum > 0 &&
          (ep == null || ep <= 0)
        ) {
          errors.quantity =
            'Enter a valid limit price or wait for market price to size this order in USDT.';
        }
        if (!errors.quantity && !errors.price && Number.isFinite(qtyNum) && qtyNum > 0 && ep != null && ep > 0) {
          const notional = qtyNum * ep;
          const maxNotionalAtLev = getMaxNotional(availableBalance, cryptoLev);
          if (notional > maxNotionalAtLev + 1e-8) {
            errors.quantity = `Order value (~${formatNumber(notional, 2)} USDT) exceeds max at ${cryptoLev}× (~${formatNumber(maxNotionalAtLev, 2)} USDT notional). Margin available: ~${formatNumber(availableBalance, 2)} USDT`;
          }
        }
      } else if (isForex) {
        const lotV = validateQuantity(forexLotSize, 'forex', { maxLot: FOREX_MAX_LOT });
        if (!lotV.isValid || !forexLotSize) errors.lotsize = lotV.errorMessage || 'Lot size is required';
        if (forexQtyLoading) {
          errors.lotsize = errors.lotsize || 'Loading quantity per lot for this pair…';
        }
        if (!errors.lotsize && (forexQuantityPerLot == null || forexQuantityPerLot <= 0)) {
          errors.lotsize =
            'Units per lot are not loaded. Wait for the feed or reselect the pair (getforexquantity).';
        }
        const lotNum = parseDecimalInput(forexLotSize);
        let ep = null;
        if (isLimit) {
          ep = priceNum != null && !Number.isNaN(priceNum) && priceNum > 0 ? priceNum : null;
        } else {
          ep = resolveForexIndiaMarketOrderPrice(mode, bidPrice, askPrice, lastPrice);
        }
        if (
          !errors.lotsize &&
          !errors.price &&
          Number.isFinite(lotNum) &&
          lotNum > 0 &&
          forexQuantityPerLot != null &&
          forexQuantityPerLot > 0 &&
          (ep == null || ep <= 0)
        ) {
          errors.lotsize =
            'Enter a valid limit price or wait for bid/ask to size margin in USDT.';
        }
        if (
          !errors.lotsize &&
          !errors.price &&
          Number.isFinite(lotNum) &&
          lotNum > 0 &&
          forexQuantityPerLot != null &&
          forexQuantityPerLot > 0 &&
          ep != null &&
          ep > 0
        ) {
          const notional = lotNum * forexQuantityPerLot * ep;
          const maxN = getMaxNotional(availableBalance, leverage || 1);
          if (notional > maxN + 1e-8) {
            const estMargin = notional / (leverage || 1);
            errors.lotsize = `Required margin ~${formatNumber(estMargin, 2)} USDT exceeds available ~${formatNumber(availableBalance, 2)} USDT (max notional ~${formatNumber(maxN, 2)} USDT at ${leverage || 1}×). Reduce lots or add funds.`;
          }
        }
      } else {
        const qty = validateNumber(size, { required: true, min: 0.00000001 });
        if (!qty.isValid) errors.quantity = qty.error;

        const maxNotional = getMaxNotional(availableBalance, leverage || 1);
        const sizeNum = parseDecimalInput(size);
        if (!Number.isNaN(sizeNum) && sizeNum > 0 && maxNotional > 0 && sizeNum > maxNotional) {
          errors.quantity = `Size cannot exceed max ${formatNumber(maxNotional)} ${sizeUnit}`;
        }
      }

      const pairNormalized = normalizePair(pair);
      if (!pairNormalized) errors.pair = 'Trading pair is required';

      if (tpSlChecked) {
        const tpNum = takeProfit.trim() !== '' ? parseDecimalInput(takeProfit) : null;
        const slNum = stopLoss.trim() !== '' ? parseDecimalInput(stopLoss) : null;

        // old
        // if (takeProfit.trim() !== '') {
        //   const tp = validateNumber(takeProfit, { min: 0.00000001 });
        //   if (!tp.isValid) errors.tradeprofit = tp.error;
        // }
        // if (stopLoss.trim() !== '') {
        //   const sl = validateNumber(stopLoss, { min: 0.00000001 });
        //   if (!sl.isValid) errors.stoploss = sl.error;
        // }

        // neww
        if (takeProfit.trim() !== '') {
          const tpCheck = parseDecimalInput(takeProfit);
          if (Number.isNaN(tpCheck) || tpCheck <= 0) {
            errors.tradeprofit = 'Take Profit must be greater than 0';
          }
        }
        if (stopLoss.trim() !== '') {
          const slCheck = parseDecimalInput(stopLoss);
          if (Number.isNaN(slCheck) || slCheck <= 0) {
            errors.stoploss = 'Stop Loss must be greater than 0';
          }
        }

        // Side-aware TP/SL rules aligned with order update validations:
        // Buy: TP > entry, SL < entry. Sell: TP < entry, SL > entry.
        let validationEntryPrice = null;
        if (isLimit) {
          validationEntryPrice =
            isIndia && !indiaMarketOrderBookReadyForExecution(bidPrice, askPrice)
              ? null
              : priceNum != null && !Number.isNaN(priceNum) && priceNum > 0
                ? priceNum
                : null;
        } else if (isForexOrIndia) {
          validationEntryPrice =
            isIndia && orderType === 'market'
              ? indiaMarketOrderBookReadyForExecution(bidPrice, askPrice)
                ? resolveForexIndiaMarketOrderPrice(mode, bidPrice, askPrice, null)
                : null
              : resolveForexIndiaMarketOrderPrice(mode, bidPrice, askPrice, lastPrice);
        } else {
          validationEntryPrice = lastPrice != null && !Number.isNaN(lastPrice) && lastPrice > 0 ? lastPrice : null;
        }

        const isBuySide = mode === 'buy' || mode === 'long';
        if (
          validationEntryPrice != null &&
          Number.isFinite(validationEntryPrice) &&
          validationEntryPrice > 0
        ) {
          if (!errors.tradeprofit && tpNum != null && Number.isFinite(tpNum) && tpNum > 0) {
            if (isBuySide && tpNum <= validationEntryPrice) {
              errors.tradeprofit = `Take Profit must be above entry (${formatNumber(validationEntryPrice, 6)}).`;
            }
            if (!isBuySide && tpNum >= validationEntryPrice) {
              errors.tradeprofit = `Take Profit must be below entry (${formatNumber(validationEntryPrice, 6)}).`;
            }
          }

          if (!errors.stoploss && slNum != null && Number.isFinite(slNum) && slNum > 0) {
            if (isBuySide && slNum >= validationEntryPrice) {
              errors.stoploss = `Stop Loss must be below entry (${formatNumber(validationEntryPrice, 6)}).`;
            }
            if (!isBuySide && slNum <= validationEntryPrice) {
              errors.stoploss = `Stop Loss must be above entry (${formatNumber(validationEntryPrice, 6)}).`;
            }
          }
        }
      }

      if (isIndia) {
        const lev = validateNumber(leverage, { required: true, min: 1, max: 100, integer: true });
        if (!lev.isValid) errors.leverage = lev.error;
      } else if (!isCrypto) {
        const lev = validateNumber(leverage, { required: true, min: 1, max: 150, integer: true });
        if (!lev.isValid) errors.leverage = lev.error;
      }

      setOrderValidationErrors(errors);
      return { isValid: Object.keys(errors).length === 0, errors };
    },
    [
      orderType,
      price,
      lastPrice,
      size,
      availableBalance,
      leverage,
      pair,
      tpSlChecked,
      takeProfit,
      stopLoss,
      sizeUnit,
      isIndia,
      isForexOrIndia,
      isCrypto,
      isForex,
      bidPrice,
      askPrice,
      resolvedPairId,
      lotSize,
      indiaLotCount,
      quantityPerLot,
      indiaQtyPerLotLoading,
      indiaOrderQuantity,
      cryptoLev,
      cryptoAssetType,
      cryptoBaseSymbol,
      forexLotSize,
      forexQuantityPerLot,
      forexQtyLoading,
      indiaOrderExceedsBalance,
    ]
  );

  /** Clear size, lots, price, TP/SL, slider after a successful place (pair / order type / leverage unchanged). */
  const resetOrderFormAfterSuccess = useCallback(() => {
    setPrice('');
    setSize('');
    setLotSize(INDIA_DEFAULT_LOT);
    setForexLotSize(FOREX_DEFAULT_LOT);
    setSliderPercent(0);
    setTakeProfit('');
    setStopLoss('');
    setTpSlChecked(false);
    setOrderValidationErrors({});
  }, []);

  /** Submit order: validate then POST /trading/orders */
  const handleSubmitOrder = useCallback(async (mode) => {
    if (tradingSessionClosed) {
      showError(
        String(tradingSessionMessage || '').trim() ||
        'Market is closed. You cannot place orders until the session opens.',
        5000
      );
      return;
    }
    setSide(mode === 'buy' ? 'buy' : 'sell');
    const { isValid } = validateOrderForm(mode);
    if (!isValid) {
      showError('Please fix the form errors before placing the order.', 5000);
      return;
    }

    const isLimit = orderType === 'limit';
    const marketTypeNum = isLimit ? MARKET_TYPE_LIMIT : MARKET_TYPE_MARKET;

    const orderPriceRaw = isLimit
      ? parseDecimalInput(price)
      : isIndia
        ? resolveForexIndiaMarketOrderPrice(mode, bidPrice, askPrice, null) ?? parseDecimalInput(price)
        : isCrypto
          ? resolveCryptoMarketOrderPrice(mode, bidPrice, askPrice, lastPrice) ?? parseDecimalInput(price)
          : isForexOrIndia
            ? resolveForexIndiaMarketOrderPrice(mode, bidPrice, askPrice, lastPrice) ?? parseDecimalInput(price)
            : (lastPrice ?? parseDecimalInput(price));
    const orderPrice = Math.round(orderPriceRaw * 1e8) / 1e8;

    const livepriceRaw = isCrypto
      ? resolveCryptoMarketOrderPrice(mode, bidPrice, askPrice, lastPrice)
      : isIndia
        ? resolveForexIndiaMarketOrderPrice(mode, bidPrice, askPrice, lastPrice)
        : lastPrice;
    const liveprice = Number.isFinite(livepriceRaw) && livepriceRaw > 0 ? livepriceRaw : orderPrice;

    const lotN = isIndia ? indiaLotCount : null;
    const qtyN = indiaOrderQuantity ?? 0;
    const marginUsdtIndia =
      isIndia && lotN != null && lotN > 0 && qtyN > 0 && Number.isFinite(orderPrice)
        ? getIndiaMarginUsdt(lotN, qtyN, orderPrice, leverage || 1, inrPerUsdt)
        : 0;

    const cryptoQtySubmit = parseDecimalInput(size);
    const cryptoNotionalSubmit =
      isCrypto &&
        Number.isFinite(cryptoQtySubmit) &&
        cryptoQtySubmit > 0 &&
        Number.isFinite(orderPrice) &&
        orderPrice > 0
        ? cryptoQtySubmit * orderPrice
        : 0;
    const cryptoMarginSubmit =
      isCrypto && cryptoNotionalSubmit > 0 && cryptoLev >= 1 ? cryptoNotionalSubmit / cryptoLev : 0;

    const forexLotSubmit = parseDecimalInput(forexLotSize);
    const forexQtyTotalSubmit =
      isForex &&
        Number.isFinite(forexLotSubmit) &&
        forexLotSubmit > 0 &&
        forexQuantityPerLot != null &&
        forexQuantityPerLot > 0
        ? forexLotSubmit * forexQuantityPerLot
        : 0;
    const forexNotionalSubmit =
      isForex &&
        forexQtyTotalSubmit > 0 &&
        Number.isFinite(orderPrice) &&
        orderPrice > 0
        ? forexQtyTotalSubmit * orderPrice
        : 0;
    const forexMarginSubmit =
      isForex && forexNotionalSubmit > 0 ? forexNotionalSubmit / (leverage || 1) : 0;

    const payload = {
      mode,
      trademode: 'open',
      price: orderPrice,
      usermargin: isIndia
        ? marginUsdtIndia
        : isCrypto
          ? cryptoMarginSubmit
          : isForex
            ? forexMarginSubmit
            : parseDecimalInput(size),
      pair: normalizePair(pair) || pair,
      marketType: marketTypeNum,
      type: isIndia ? 'indian' : marketType,
      tradeprofit: tpSlChecked && takeProfit.trim() !== '' ? parseDecimalInput(takeProfit) : 0,
      stoploss: tpSlChecked && stopLoss.trim() !== '' ? parseDecimalInput(stopLoss) : 0,
      leverage: isCrypto ? Number(cryptoLev) : Number(leverage),
      liveprice,
      ...(isIndia && {
        lotsize: lotN,
        pairid: resolvedPairId,
        quantity: qtyN,
      }),
      ...(isForex &&
        !isIndia && {
        lotsize: forexLotSubmit,
        quantity: forexQtyTotalSubmit,
      }),
      ...(isCrypto &&
        !isIndia && {
        quantity: cryptoQtySubmit,
      }),
    };

    // setOrderSubmitLoading(true);
    setOrderSubmitSideLoading(mode)
    setOrderValidationErrors({});
    try {
      await placeOrder(payload);

      // const response = await placeOrder(payload);

      showSuccess(
        isIndia
          ? `Order placed (${mode === 'buy' ? 'Buy' : 'Sell'})`
          : `Order placed successfully (${mode === 'buy' ? 'Long' : 'Short'})`
      );

      // trade message
      // if (response?.tradedata?.Message) {

      //   if (response?.tradedata?.MessageCode === "Fail") {
      //     showError(response?.tradedata?.Message, 5000);
      //   } else {
      //     showSuccess(response?.tradedata?.Message, 5000);
      //   }
      // }

      // // order message
      // if (response?.orderdata?.Message) {

      //   if (response?.orderdata?.MessageCode === "Success") {
      //     showSuccess(response?.orderdata?.Message, 5000);
      //   } else {
      //     showError(response?.orderdata?.Message, 5000);
      //   }
      // }

      window.dispatchEvent(new Event('refresh-orders-silent'));

      refreshWallet?.();

      if (onOrderSuccess) {
        onOrderSuccess();
      }

      resetOrderFormAfterSuccess();
    } catch (err) {
      let customApiMsg = null;
      if (err?.data?.orderdata) {
        const od = Array.isArray(err.data.orderdata) ? err.data.orderdata[0] : err.data.orderdata;
        customApiMsg = od?.msg || od?.Message;
      }
      if (!customApiMsg && err?.data?.tradedata) {
        const td = Array.isArray(err.data.tradedata) ? err.data.tradedata[0] : err.data.tradedata;
        customApiMsg = td?.msg || td?.Message;
      }

      const message = customApiMsg || (err?.message && !err.message.startsWith('HTTP error!') ? err.message : null) || err?.data?.message || 'Failed to place order. Please try again.';
      showError(message, 5000);
      resetOrderFormAfterSuccess();
      if (err?.data?.errors && typeof err.data.errors === 'object') {
        setOrderValidationErrors(err.data.errors);
      }
    } finally {
      // setOrderSubmitLoading(false);
      setOrderSubmitSideLoading(null);
    }
  }, [
    orderType,
    price,
    lastPrice,
    bidPrice,
    askPrice,
    isForexOrIndia,
    size,
    pair,
    tpSlChecked,
    takeProfit,
    stopLoss,
    leverage,
    marketType,
    validateOrderForm,
    showError,
    showSuccess,
    refreshWallet,
    onOrderSuccess,
    isIndia,
    isCrypto,
    isForex,
    cryptoLev,
    lotSize,
    indiaLotCount,
    indiaOrderQuantity,
    resolvedPairId,
    inrPerUsdt,
    forexLotSize,
    forexQuantityPerLot,
    resetOrderFormAfterSuccess,
    tradingSessionClosed,
    tradingSessionMessage,
  ]);

  const maxPositionUsdt = (availableBalance * (leverageModalValue || 1)).toLocaleString('en-US', { maximumFractionDigits: 0 });

  const orderEstimateSection =
    !isIndia &&
    (isCrypto ? (
      <div className="tp-preview-card">
        <div className="tp-preview-card__title">Position estimate</div>
        <div className="tp-preview-grid">
          <span className="tp-preview-grid__corner" aria-hidden />
          <span className="tp-preview-grid__colhead tp-preview-grid__colhead--long">Long</span>
          <span className="tp-preview-grid__colhead tp-preview-grid__colhead--short">Short</span>

          {/* <span className="tp-preview-grid__label">Liq. price</span>
          <span className="tp-preview-grid__val">{`${buySummary.liqPrice} ${sizeUnit}`}</span>
          <span className="tp-preview-grid__val">{`${sellSummary.liqPrice} ${sizeUnit}`}</span> */}

          <span className="tp-preview-grid__label">Order value</span>
          <span
            className={`tp-preview-grid__val${cryptoOrderExceedsBalance ? ' tp-preview-grid__val--exceeds' : ''}`}
          >
            <strong>{formatCurrency(buySummary.cost)}</strong> {sizeUnit}
          </span>
          <span
            className={`tp-preview-grid__val${cryptoOrderExceedsBalance ? ' tp-preview-grid__val--exceeds' : ''}`}
          >
            <strong>{formatCurrency(sellSummary.cost)}</strong> {sizeUnit}
          </span>

          <span className="tp-preview-grid__label">Est. margin</span>
          <span
            className={`tp-preview-grid__val${cryptoOrderExceedsBalance ? ' tp-preview-grid__val--exceeds' : ''}`}
          >
            <strong>{formatCurrency(buySummary.margin ?? 0)}</strong> {sizeUnit}
          </span>
          <span
            className={`tp-preview-grid__val${cryptoOrderExceedsBalance ? ' tp-preview-grid__val--exceeds' : ''}`}
          >
            <strong>{formatCurrency(sellSummary.margin ?? 0)}</strong> {sizeUnit}
          </span>

          <span className="tp-preview-grid__label">Max size</span>
          <span className="tp-preview-grid__val">
            <strong>{formatNumber(buySummary.max, decimalsForValue(buySummary.max))}</strong> {cryptoBaseSymbol}
          </span>
          <span className="tp-preview-grid__val">
            <strong>{formatNumber(sellSummary.max, decimalsForValue(sellSummary.max))}</strong> {cryptoBaseSymbol}
          </span>
        </div>
        <p className="tp-preview-card__note">
          Leverage {cryptoLev}×{cryptoLeverageIsFromProfile ? ' from your profile' : ' (default 1× until profile sets cryptoleverage)'}
          . Est. margin = order value ÷ leverage. Indicative liq. (~0.4% maintenance, cross-style). Not financial advice.
        </p>
      </div>
    ) : isForex ? (
      <div className={`tp-forex-preview${forexOrderExceedsBalance ? ' tp-forex-preview--exceeds' : ''}`}>
        <div className="tp-forex-preview__head">
          <span className="tp-forex-preview__title">Position preview</span>
          <span className="tp-forex-preview__badge">{forexPairLabel}</span>
        </div>
        {forexOrderExceedsBalance && (
          <div className="tp-forex-preview__banner" role="status">
            Est. margin exceeds wallet balance — lower lots or deposit USDT.
          </div>
        )}
        <div className="tp-forex-preview__table" role="table" aria-label="Long and short estimates">
          <div className="tp-forex-preview__tr tp-forex-preview__tr--head" role="row">
            <span className="tp-forex-preview__td" role="columnheader" />
            <span className="tp-forex-preview__td" role="columnheader">
              Long
            </span>
            <span className="tp-forex-preview__td" role="columnheader">
              Short
            </span>
          </div>
          <div
            className={`tp-forex-preview__tr${forexOrderExceedsBalance ? ' tp-forex-preview__tr--warn' : ''}`}
            role="row"
          >
            <span className="tp-forex-preview__td tp-forex-preview__td--label" role="rowheader">
              Notional
            </span>
            <span className="tp-forex-preview__td tp-forex-preview__td--val" role="cell">
              {(buySummary.notional ?? 0) > 0 ? (
                <strong>{formatCurrency(buySummary.notional)}</strong>
              ) : (
                '—'
              )}{' '}
              {sizeUnit}
            </span>
            <span className="tp-forex-preview__td tp-forex-preview__td--val" role="cell">
              {(sellSummary.notional ?? 0) > 0 ? (
                <strong>{formatCurrency(sellSummary.notional)}</strong>
              ) : (
                '—'
              )}{' '}
              {sizeUnit}
            </span>
          </div>
          <div className="tp-forex-preview__tr" role="row">
            <span className="tp-forex-preview__td tp-forex-preview__td--label" role="rowheader">
              Est. margin
            </span>
            <span
              className={`tp-forex-preview__td tp-forex-preview__td--val${forexOrderExceedsBalance ? ' tp-forex-preview__td--danger' : ''}`}
              role="cell"
            >
              <strong>{formatCurrency(buySummary.cost)}</strong> {sizeUnit}
            </span>
            <span
              className={`tp-forex-preview__td tp-forex-preview__td--val${forexOrderExceedsBalance ? ' tp-forex-preview__td--danger' : ''}`}
              role="cell"
            >
              <strong>{formatCurrency(sellSummary.cost)}</strong> {sizeUnit}
            </span>
          </div>
          <div className="tp-forex-preview__tr" role="row">
            <span className="tp-forex-preview__td tp-forex-preview__td--label" role="rowheader">
              Liq. price
            </span>
            <span className="tp-forex-preview__td tp-forex-preview__td--val tp-forex-preview__td--mono" role="cell">
              {buySummary.liqPrice} {sizeUnit}
            </span>
            <span className="tp-forex-preview__td tp-forex-preview__td--val tp-forex-preview__td--mono" role="cell">
              {sellSummary.liqPrice} {sizeUnit}
            </span>
          </div>
          <div className="tp-forex-preview__tr" role="row">
            <span className="tp-forex-preview__td tp-forex-preview__td--label" role="rowheader">
              Max notional
            </span>
            <span
              className="tp-forex-preview__td tp-forex-preview__td--val tp-forex-preview__td--merge"
              role="cell"
            >
              <strong>{formatCurrency(buySummary.max)}</strong> {sizeUnit}{' '}
              <span className="tp-forex-preview__hint-inline">
                {SHOW_LEVERAGE_CONTROLS
                  ? `at ${leverage || 1}× · wallet`
                  : 'wallet balance · account leverage'}
              </span>
            </span>
          </div>
        </div>
        <p className="tp-forex-preview__foot">
          Isolated margin model (~0.4% maintenance). Long/short use bid vs ask when market. Indicative only.
        </p>
      </div>
    ) : (
      <div className="tp-cost-grid">
        <div className="tp-cost-col">
          <div className="tp-cost-line">Liq Price <span>{`${buySummary.liqPrice} ${sizeUnit}`}</span></div>
          <div className="tp-cost-line">
            Cost <strong>{formatCurrency(buySummary.cost)} {sizeUnit}</strong>
          </div>
          <div className="tp-cost-line">Max <strong>{`${formatCurrency(buySummary.max)} ${sizeUnit}`}</strong></div>
        </div>
        <div className="tp-cost-col">
          <div className="tp-cost-line">Liq Price <span>{`${sellSummary.liqPrice} ${sizeUnit}`}</span></div>
          <div className="tp-cost-line">
            Cost <strong>{formatCurrency(sellSummary.cost)} {sizeUnit}</strong>
          </div>
          <div className="tp-cost-line">Max <strong>{`${formatCurrency(sellSummary.max)} ${sizeUnit}`}</strong></div>
        </div>
      </div>
    ));

  const tradingSessionCloseTitle = tradingSessionClosed
    ? String(tradingSessionMessage || '').trim() || 'Market is closed — viewing only'
    : undefined;

  return (
    <div
      className={`tradingPanel tp-panel${isIndia ? ' tp-panel--india' : ''}${isCrypto ? ' tp-panel--crypto' : ''}${isForex ? ' tp-panel--forex' : ''}`}
    >
      {SHOW_LEVERAGE_CONTROLS &&
        (isCrypto ? (
          <div className="tp-top-bar">
            <div className="tp-top-left">
              <span
                className="tp-pill tp-pill--lev tp-pill--readonly"
                title={
                  cryptoLeverageIsFromProfile
                    ? 'Crypto leverage from your profile (cryptoleverage)'
                    : 'Using 1× until your profile returns cryptoleverage'
                }
              >
                Leverage: {cryptoLev}x
                <span className="tp-pill__suffix">
                  {cryptoLeverageIsFromProfile ? ' · profile' : ' · default'}
                </span>
              </span>
            </div>
          </div>
        ) : (
          <div className="tp-top-bar">
            <div className="tp-top-left">
              <button type="button" className="tp-pill tp-pill--lev" onClick={openLeverageModal}>
                Leverage: {leverage}x
              </button>
            </div>
          </div>
        ))}

      {/* Open | Close - only Open is active; Close shows "Coming soon" tooltip */}
      {/* <div className="tp-open-close">
        <button
          type="button"
          className={`tp-oc-btn tp-oc-btn--open ${openClose === 'open' ? 'tp-oc-btn--active' : ''}`}
          onClick={() => setOpenClose('open')}
        >
          Open
          <span className="tp-oc-arrow" aria-hidden />
        </button>
        <div
          className="tp-oc-close-wrap"
          onMouseEnter={() => setCloseTooltipVisible(true)}
          onMouseLeave={() => setCloseTooltipVisible(false)}
        >
          <button
            type="button"
            className="tp-oc-btn tp-oc-btn--close tp-oc-btn--coming-soon"
            onClick={(e) => {
              e.preventDefault();
              setCloseTooltipVisible(true);
              setTimeout(() => setCloseTooltipVisible(false), 2000);
            }}
            title="Coming soon – this feature"
            aria-describedby="tp-close-tooltip"
          >
            Close
          </button>
          <div
            id="tp-close-tooltip"
            className={`tp-oc-tooltip ${closeTooltipVisible ? 'tp-oc-tooltip--visible' : ''}`}
            role="tooltip"
          >
            Coming soon – this feature
          </div>
        </div>
      </div> */}

      {/* Order type tabs: Limit | Market | Stop Limit */}
      <div className="tp-order-tabs">
        {ORDER_TYPES_MAIN.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`tp-order-tab ${orderType === t.id ? 'tp-order-tab--active' : ''}`}
            onClick={() => setOrderType(t.id)}
          >
            {t.label}
            {t.hasChevron && <span className="tp-chevron-down" />}
          </button>
        ))}
      </div>

      {/* Order form – full Limit view when Limit is selected */}
      <div className="tp-form">
        {indiaCurrencyToggle}
        {orderType === 'limit' ? (
          <>
            <div
              className={`tp-row tp-row--avbl${(isForex && forexOrderExceedsBalance) || (isIndia && indiaOrderExceedsBalance) ? ' tp-row--avbl-warn' : ''}`}
            >
              <span className="tp-avbl-label">Avbl</span>
              <span className="tp-avbl-value">
                {balanceLoading ? '--' : formatNumber(indiaAvailableDisplay, isIndia && indiaCalcCurrency === 'inr' ? 2 : 4)} {indiaDisplayUnit}
              </span>
              <button
                type="button"
                className="tp-icon-btn tp-icon-transfer"
                aria-label="Transfer"
                onClick={() => setTransferModalOpen(true)}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 12h4l2-2-2-2H6M18 12h-4l-2 2 2 2h4M12 5v14" />
                </svg>
              </button>
            </div>

            <div className="tp-field">
              <div className="tp-label-row">
                <label className="tp-label">{isIndia ? 'Price (INR)' : 'Price'}</label>
                <button
                  type="button"
                  className="tp-suggest-btn"
                  onClick={applySuggestedPrice}
                  disabled={suggestedPrice == null}
                  title={lastPrice != null ? `Use suggested price (${side === 'buy' || side === 'long' ? 'slightly below' : 'slightly above'} market)` : 'Connect for live price'}
                >
                  Suggest
                </button>
              </div>
              <div className="tp-input-wrap">
                <input
                  type="text"
                  className="tp-input"
                  value={price}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (
                      value === '' ||
                      (/^\d*\.?\d*$/.test(value) && Number(value) > 0)
                    ) {
                      setPrice(value);
                    }
                  }}
                  placeholder="0"
                />
                <span className="tp-unit">{isIndia ? 'INR' : sizeUnit}</span>
              </div>
            </div>

            {isIndia ? (
              <>
                <div className={`tp-field${indiaOrderExceedsBalance ? ' tp-field--over-balance' : ''}`}>
                  <label className="tp-label">Lot size</label>
                  <div className={`tp-input-wrap${indiaOrderExceedsBalance ? ' tp-input-wrap--exceeds-balance' : ''}`}>
                    <input
                      type="text"
                      className="tp-input"
                      value={lotSize}
                      onChange={handleLotSizeChange}
                      onBlur={() => handleMarketFieldBlur('indian_fo', lotSize)}
                      onPaste={(e) => handleMarketFieldPaste(e, 'indian_fo')}
                      placeholder="1"
                      step={indiaPrecisionMeta.step}
                      inputMode={indiaPrecisionMeta.inputMode}
                      pattern={indiaPrecisionMeta.pattern}
                      min="1"
                      aria-invalid={Boolean(marketFieldErrors.india || indiaOrderExceedsBalance)}
                    />
                    <span className="tp-unit">lot</span>
                  </div>
                  {marketFieldErrors.india ? <p className="tp-field-error">{marketFieldErrors.india}</p> : null}
                </div>
                <div className="tp-field">
                  {indiaQtyPerLotLoading && (
                    <p className="tp-india-qty-hint tp-india-qty-hint--loading">Loading contract quantity…</p>
                  )}
                  {!indiaQtyPerLotLoading && quantityPerLot != null && (
                    <p className="tp-india-qty-hint">
                      <span className="tp-india-pair-sym" title="Selected instrument">
                        [{indiaDisplaySymbol || indiaPairSymbol || pair}]
                      </span>
                      {' '}
                      1 lot = <strong>{formatNumber(quantityPerLot, 4)}</strong> units · total = lot × units (read-only)
                    </p>
                  )}
                  {!indiaQtyPerLotLoading && quantityPerLot == null && resolvedPairId && (
                    <p className="tp-india-qty-hint tp-india-qty-hint--warn" role="status">
                      Lot size unavailable for <strong>{indiaDisplaySymbol || pair}</strong>. Reselect from Pair List.
                    </p>
                  )}
                </div>
                {indiaSummary &&
                  indiaLotCount != null &&
                  indiaLotCount > 0 &&
                  indiaRefPriceForSizing != null &&
                  indiaRefPriceForSizing > 0 &&
                  (indiaSummary.marginUsdt > 0 || indiaSummary.notionalInr > 0) && (
                    <p className="tp-india-qty-hint">
                      Est. margin:{' '}
                      <strong>
                        {indiaCalcCurrency === 'inr'
                          ? `₹${formatNumber(indiaSummary.marginInr, 2)} INR`
                          : `${formatNumber(indiaSummary.marginUsdt, 4)} ${sizeUnit}`}
                      </strong>
                      {' · '}
                      Notional:{' '}
                      <strong>
                        {indiaCalcCurrency === 'inr'
                          ? `₹${formatNumber(indiaSummary.notionalInr, 2)} INR`
                          : `${formatNumber(indiaSummary.positionNotionalUsdt, 4)} ${sizeUnit}`}
                      </strong>
                      {indiaSizingUsesLtpFallback ? (
                        <span className="tp-india-qty-hint__ltp"> · est. from LTP</span>
                      ) : null}
                    </p>
                  )}
                {indiaMarketNoExecutableBook && (
                  <p className="tp-india-qty-hint tp-india-qty-hint--warn" role="status">
                    Live bid and ask are required to place an order. Wait for quotes on the feed.
                  </p>
                )}
                {indiaOrderExceedsBalance && (
                  <p className="tp-crypto-order-hint tp-crypto-order-hint--exceeds" role="status">
                    Required margin exceeds available balance. Reduce lot size or add funds.
                  </p>
                )}
              </>
            ) : isCrypto ? (
              <div className={`tp-field tp-field--crypto-qty${cryptoOrderExceedsBalance ? ' tp-field--over-balance' : ''}`}>
                <label className="tp-label">Quantity ({cryptoBaseSymbol})</label>
                <div
                  className={`tp-input-wrap${cryptoOrderExceedsBalance ? ' tp-input-wrap--exceeds-balance' : ''}`}
                >
                  <input
                    type="text"
                    className="tp-input"
                    value={size}
                    onChange={handleSizeChange}
                    onBlur={() => handleMarketFieldBlur('crypto', size)}
                    onPaste={(e) => handleMarketFieldPaste(e, 'crypto')}
                    placeholder="0"
                    step={cryptoPrecisionMeta.step}
                    inputMode={cryptoPrecisionMeta.inputMode}
                    pattern={cryptoPrecisionMeta.pattern}
                    autoComplete="off"
                    min="0"
                    aria-invalid={Boolean(marketFieldErrors.crypto || cryptoOrderExceedsBalance)}
                  />
                  <span className="tp-unit">{cryptoBaseSymbol}</span>
                </div>
                {marketFieldErrors.crypto ? <p className="tp-field-error">{marketFieldErrors.crypto}</p> : null}
                <p
                  className={`tp-crypto-order-hint${cryptoOrderExceedsBalance ? ' tp-crypto-order-hint--exceeds' : ''}`}
                >
                  {cryptoOrderValueUsdt != null ? (
                    <>
                      Order value <strong>{formatNumber(cryptoOrderValueUsdt, 2)} USDT</strong>
                      <span className="tp-crypto-order-hint__meta">
                        {' '}
                        · {cryptoLev}×{cryptoLeverageIsFromProfile ? ' (profile)' : ' (default)'} · est. margin{' '}
                        <strong>{formatNumber(cryptoOrderValueUsdt / cryptoLev, 2)} USDT</strong>
                      </span>
                      {cryptoOrderExceedsBalance && (
                        <span className="tp-crypto-order-hint__alert" role="status">
                          Exceeds max at {cryptoLev}× (~{formatNumber(cryptoMaxOrderValueUsdt, 2)} USDT notional)
                        </span>
                      )}
                    </>
                  ) : (
                    'Enter quantity to see order value in USDT (limit price or last).'
                  )}
                </p>
              </div>
            ) : isForex ? (
              <div className="tp-forex-fields">
                <div className={`tp-field${forexOrderExceedsBalance ? ' tp-field--over-balance' : ''}`}>
                  <label className="tp-label">Volume ({forexPairLabel})</label>
                  <div
                    className={`tp-input-wrap${forexOrderExceedsBalance ? ' tp-input-wrap--exceeds-balance' : ''}`}
                  >
                    <input
                      type="text"
                      className="tp-input"
                      value={forexLotSize}
                      onChange={handleForexLotChange}
                      onBlur={() => handleMarketFieldBlur('forex', forexLotSize)}
                      onPaste={(e) => handleMarketFieldPaste(e, 'forex')}
                      placeholder={FOREX_DEFAULT_LOT}
                      step={forexPrecisionMeta.step}
                      inputMode={forexPrecisionMeta.inputMode}
                      pattern={forexPrecisionMeta.pattern}
                      autoComplete="off"
                      min="0.01"
                      max={String(FOREX_MAX_LOT)}
                      aria-invalid={Boolean(marketFieldErrors.forex || forexOrderExceedsBalance)}
                    />
                    <span className="tp-unit">LoTs</span>
                  </div>
                  {marketFieldErrors.forex ? <p className="tp-field-error">{marketFieldErrors.forex}</p> : null}
                </div>
                <div className={`tp-field${forexOrderExceedsBalance ? ' tp-field--over-balance' : ''}`}>
                  {/* <label className="tp-label">Total quantity</label>
                  <div
                    className={`tp-input-wrap${forexOrderExceedsBalance ? ' tp-input-wrap--exceeds-balance' : ''}`}
                  >
                    <input
                      type="text"
                      className="tp-input tp-input--readonly"
                      readOnly
                      aria-readonly="true"
                      value={
                        forexQtyLoading
                          ? ''
                          : forexOrderQuantity != null
                            ? formatNumber(forexOrderQuantity, decimalsForValue(forexOrderQuantity))
                            : '—'
                      }
                      placeholder="—"
                      disabled={forexQtyLoading}
                      aria-invalid={forexOrderExceedsBalance}
                    />
                    <span className="tp-unit">units</span>
                  </div> */}
                  {forexQtyLoading && (
                    <p className="tp-india-qty-hint tp-india-qty-hint--loading">Loading units per lot…</p>
                  )}
                  {!forexQtyLoading && forexQuantityPerLot != null && (
                    <p className="tp-india-qty-hint">
                      {forexPairSymbolFromApi ? (
                        <span className="tp-india-pair-sym" title="Symbol from API">
                          {forexPairSymbolFromApi}
                          {' · '}
                        </span>
                      ) : null}
                      1 lot = <strong>{formatNumber(forexQuantityPerLot, 4)}</strong> units · total = lots × units
                    </p>
                  )}
                  {forexNotionalUsdt != null && forexMarginUsdtLive != null && (
                    <p
                      className={`tp-crypto-order-hint${forexOrderExceedsBalance ? ' tp-crypto-order-hint--exceeds' : ''}`}
                    >
                      Notional <strong>{formatNumber(forexNotionalUsdt, 2)} USDT</strong>
                      <span className="tp-crypto-order-hint__meta">
                        {' '}
                        · Est. margin <strong>{formatNumber(forexMarginUsdtLive, 2)} USDT</strong>
                        {SHOW_LEVERAGE_CONTROLS ? (
                          <> · {leverage || 1}×</>
                        ) : null}
                      </span>
                      {forexOrderExceedsBalance && (
                        <span className="tp-crypto-order-hint__alert" role="status">
                          Est. margin {formatNumber(forexMarginUsdtLive ?? 0, 2)} USDT exceeds available{' '}
                          {formatNumber(availableBalance, 2)} USDT — reduce lots or add funds.
                        </span>
                      )}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="tp-field">
                <label className="tp-label">Size</label>
                <div className="tp-input-wrap">
                  <input
                    type="text"
                    className="tp-input"
                    value={size}
                    onChange={handleSizeChange}
                    placeholder="0"
                  />
                  <button type="button" className="tp-unit tp-unit--dropdown">
                    {sizeUnit}
                  </button>
                </div>
              </div>
            )}

            {/* Indian market: lot-size % slider hidden — enter lots manually in the field above */}
            {/* {isIndia && (
              <div className={`tp-alloc-row${indiaOrderExceedsBalance ? ' tp-alloc-row--exceeds' : ''}`}>
                <span className="tp-alloc-row__label">Lot size vs max buying power</span>
                <span className="tp-alloc-row__pct">{Math.round(sliderPercent)}%</span>
              </div>
            )} */}
            {!isIndia && isCrypto && (
              <div className={`tp-alloc-row${cryptoOrderExceedsBalance ? ' tp-alloc-row--exceeds' : ''}`}>
                <span className="tp-alloc-row__label">Size vs max (balance × {cryptoLev}×)</span>
                <span className="tp-alloc-row__pct">{Math.round(sliderPercent)}%</span>
              </div>
            )}
            {!isIndia && isForex && (
              <div className={`tp-alloc-row${forexOrderExceedsBalance ? ' tp-alloc-row--exceeds' : ''}`}>
                <span className="tp-alloc-row__label">Lots vs max buying power</span>
                <span className="tp-alloc-row__pct">{Math.round(sliderPercent)}%</span>
              </div>
            )}
            {!isIndia && (
              <div
                className={`tp-leverage-slider-wrap${isCrypto || isForex ? ' tp-leverage-slider-wrap--crypto tp-crypto-slider' : ''}${isForex && forexOrderExceedsBalance ? ' tp-crypto-slider--exceeds' : ''}`}
              >
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={sliderPercent}
                  onChange={handleSliderInputChange}
                  className={`tp-leverage-range${isCrypto || isForex ? ' tp-crypto-slider__range' : ''}`}
                  style={
                    isCrypto || isForex
                      ? {
                        background:
                          isForex && forexOrderExceedsBalance
                            ? `linear-gradient(to right, #f87171 0%, #f87171 ${sliderPercent}%, var(--bg-tertiary) ${sliderPercent}%, var(--bg-tertiary) 100%)`
                            : `linear-gradient(to right, var(--brand-primary, #ffd50077) 0%, var(--brand-primary, #ffd50077) ${sliderPercent}%, var(--bg-tertiary) ${sliderPercent}%, var(--bg-tertiary) 100%)`,
                      }
                      : undefined
                  }
                  aria-label={
                    isCrypto
                      ? 'Percentage of maximum position size'
                      : isForex
                        ? 'Lot size as percent of maximum buying power'
                        : 'Amount percentage'
                  }
                />
                <div
                  className={`tp-leverage-markers${isCrypto || isForex ? ' tp-crypto-slider__markers' : ''}`}
                >
                  {SLIDER_PERCENTS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      className={`tp-leverage-marker${isCrypto || isForex ? ' tp-crypto-slider__step' : ''}${sliderPercent >= p ? ' tp-leverage-marker--active' : ''}`}
                      onClick={() => handleSliderDotClick(p)}
                      aria-label={`${p}%`}
                    >
                      {!(isCrypto || isForex) && <span className="tp-leverage-marker-dot" />}
                      <span className="tp-leverage-marker-label">{p}%</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="tp-options-row">
              <label className="tp-checkbox">
                <input
                  type="checkbox"
                  checked={tpSlChecked}
                  onChange={(e) => setTpSlChecked(e.target.checked)}
                />
                <span className="tp-checkbox-box" />
                <span>TP/SL</span>
              </label>
            </div>

            {tpSlChecked && (
              <div className="tp-tpsl-section">
                <div className="tp-tpsl-title">Take Profit / Stop Loss</div>
                <div className="tp-tpsl-fields">
                  <div className="tp-field">
                    <label className="tp-label">Take Profit ({sizeUnit})</label>
                    <div className="tp-input-wrap">
                      <input
                        type="text"
                        className="tp-input"
                        value={takeProfit}
                        // onChange={(e) => setTakeProfit(e.target.value)}
                        onChange={(e) => {
                          let val = e.target.value.replace(/[^0-9.]/g, '');
                          const parts = val.split('.');
                          if (parts.length > 2) val = parts[0] + '.' + parts.slice(1).join('');
                          setTakeProfit(val);
                        }}
                        placeholder="0.00"
                      />
                      <span className="tp-unit">{sizeUnit}</span>
                    </div>
                  </div>
                  <div className="tp-field">
                    <label className="tp-label">Stop Loss ({sizeUnit})</label>
                    <div className="tp-input-wrap">
                      <input
                        type="text"
                        className="tp-input"
                        value={stopLoss}
                        // onChange={(e) => setStopLoss(e.target.value)}
                        onChange={(e) => {
                          let val = e.target.value.replace(/[^0-9.]/g, '');
                          const parts = val.split('.');
                          if (parts.length > 2) val = parts[0] + '.' + parts.slice(1).join('');
                          setStopLoss(val);
                        }}
                        placeholder="0.00"
                      />
                      <span className="tp-unit">{sizeUnit}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {Object.keys(orderValidationErrors).length > 0 && (
              <div className="tp-order-errors" role="alert">
                {Object.entries(orderValidationErrors).map(([key, msg]) => (
                  <div key={key} className="tp-order-error-item">{msg}</div>
                ))}
              </div>
            )}
            <div className="tp-action-btns">
              <button
                type="button"
                className="tp-btn tp-btn--long"
                onClick={() => handleSubmitOrder('buy')}
                disabled={
                  orderSubmitSideLoading !== null ||
                  indiaOrderExceedsBalance ||
                  indiaMarketNoExecutableBook ||
                  cryptoSubmitDisabledForBalance ||
                  forexSubmitDisabledForBalance ||
                  tradingSessionClosed
                }
                aria-busy={orderSubmitSideLoading === 'buy'}
                title={
                  tradingSessionCloseTitle ??
                  (indiaMarketNoExecutableBook
                    ? 'Live bid and ask are required before placing an order. Wait for quotes.'
                    : indiaOrderExceedsBalance
                      ? 'Required margin exceeds available balance'
                      : cryptoSubmitDisabledForBalance
                        ? 'Order value exceeds available balance'
                        : forexSubmitDisabledForBalance
                          ? 'Notional exceeds available margin at this leverage'
                          : undefined)
                }
              >
                {orderSubmitSideLoading === 'buy' ? 'Placing…' : isIndia ? 'Buy' : 'Open Long'}
              </button>
              <button
                type="button"
                className="tp-btn tp-btn--short"
                onClick={() => handleSubmitOrder('sell')}
                disabled={
                  orderSubmitSideLoading !== null ||
                  indiaOrderExceedsBalance ||
                  indiaMarketNoExecutableBook ||
                  cryptoSubmitDisabledForBalance ||
                  forexSubmitDisabledForBalance ||
                  tradingSessionClosed
                }
                aria-busy={orderSubmitSideLoading === 'sell'}
                title={
                  tradingSessionCloseTitle ??
                  (indiaMarketNoExecutableBook
                    ? 'Live bid and ask are required before placing an order. Wait for quotes.'
                    : indiaOrderExceedsBalance
                      ? 'Required margin exceeds available balance'
                      : cryptoSubmitDisabledForBalance
                        ? 'Order value exceeds available balance'
                        : forexSubmitDisabledForBalance
                          ? 'Notional exceeds available margin at this leverage'
                          : undefined)
                }
              >
                {orderSubmitSideLoading === 'sell' ? 'Placing…' : isIndia ? 'Sell' : 'Open Short'}
              </button>
            </div>

            {orderEstimateSection}
          </>
        ) : orderType === 'market' ? (
          /* Market order form – no Price, Size + slider, Slippage Tolerance + TP/SL, Open Long/Short, cost grid, Fee level */
          <>
            <div
              className={`tp-row tp-row--avbl${(isForex && forexOrderExceedsBalance) || (isIndia && indiaOrderExceedsBalance) ? ' tp-row--avbl-warn' : ''}`}
            >
              <span className="tp-avbl-label">Avbl</span>
              <span className="tp-avbl-value">
                {balanceLoading ? '--' : formatNumber(indiaAvailableDisplay, isIndia && indiaCalcCurrency === 'inr' ? 2 : 4)} {indiaDisplayUnit}
              </span>
              <button
                type="button"
                className="tp-icon-btn tp-icon-transfer"
                aria-label="Transfer"
                onClick={() => setTransferModalOpen(true)}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 12h4l2-2-2-2H6M18 12h-4l-2 2 2 2h4M12 5v14" />
                </svg>
              </button>
            </div>

            {/* {isIndia && lastPrice != null && !Number.isNaN(lastPrice) && (
              <div className="tp-india-market-price">
                Market price (INR): <strong>{formatNumber(lastPrice, 2)}</strong>
              </div>
            )} */}

            {isIndia ? (
              <>
                <div className={`tp-field${indiaOrderExceedsBalance ? ' tp-field--over-balance' : ''}`}>
                  <label className="tp-label">Lot size</label>
                  <div className={`tp-input-wrap${indiaOrderExceedsBalance ? ' tp-input-wrap--exceeds-balance' : ''}`}>
                    <input
                      type="text"
                      className="tp-input"
                      value={lotSize}
                      onChange={handleLotSizeChange}
                      onBlur={() => handleMarketFieldBlur('indian_fo', lotSize)}
                      onPaste={(e) => handleMarketFieldPaste(e, 'indian_fo')}
                      placeholder="1"
                      step={indiaPrecisionMeta.step}
                      inputMode={indiaPrecisionMeta.inputMode}
                      pattern={indiaPrecisionMeta.pattern}
                      min="1"
                      aria-invalid={Boolean(marketFieldErrors.india || indiaOrderExceedsBalance)}
                    />
                    <span className="tp-unit">lot</span>
                  </div>
                  {marketFieldErrors.india ? <p className="tp-field-error">{marketFieldErrors.india}</p> : null}
                </div>
                <div className="tp-field">
                  {indiaQtyPerLotLoading && (
                    <p className="tp-india-qty-hint tp-india-qty-hint--loading">Loading contract quantity…</p>
                  )}
                  {!indiaQtyPerLotLoading && quantityPerLot != null && (
                    <p className="tp-india-qty-hint">
                      <span className="tp-india-pair-sym" title="Selected instrument">
                        [{indiaDisplaySymbol || indiaPairSymbol || pair}]
                      </span>
                      {' '}
                      1 lot = <strong>{formatNumber(quantityPerLot, 4)}</strong> units · total = lot × units (read-only)
                    </p>
                  )}
                  {!indiaQtyPerLotLoading && quantityPerLot == null && resolvedPairId && (
                    <p className="tp-india-qty-hint tp-india-qty-hint--warn" role="status">
                      Lot size unavailable for <strong>{indiaDisplaySymbol || pair}</strong>. Reselect from Pair List.
                    </p>
                  )}
                </div>
                {indiaSummary &&
                  indiaLotCount != null &&
                  indiaLotCount > 0 &&
                  indiaRefPriceForSizing != null &&
                  indiaRefPriceForSizing > 0 &&
                  (indiaSummary.marginUsdt > 0 || indiaSummary.notionalInr > 0) && (
                    <p className="tp-india-qty-hint">
                      Est. margin:{' '}
                      <strong>
                        {indiaCalcCurrency === 'inr'
                          ? `₹${formatNumber(indiaSummary.marginInr, 2)} INR`
                          : `${formatNumber(indiaSummary.marginUsdt, 4)} ${sizeUnit}`}
                      </strong>
                      {' · '}
                      Notional:{' '}
                      <strong>
                        {indiaCalcCurrency === 'inr'
                          ? `₹${formatNumber(indiaSummary.notionalInr, 2)} INR`
                          : `${formatNumber(indiaSummary.positionNotionalUsdt, 4)} ${sizeUnit}`}
                      </strong>
                      {indiaSizingUsesLtpFallback ? (
                        <span className="tp-india-qty-hint__ltp"> · est. from LTP</span>
                      ) : null}
                    </p>
                  )}
                {indiaMarketNoExecutableBook && (
                  <p className="tp-india-qty-hint tp-india-qty-hint--warn" role="status">
                    Live bid and ask are required to place an order. Wait for quotes on the feed.
                  </p>
                )}
                {indiaOrderExceedsBalance && (
                  <p className="tp-crypto-order-hint tp-crypto-order-hint--exceeds" role="status">
                    Required margin exceeds available balance. Reduce lot size or add funds.
                  </p>
                )}
              </>
            ) : isCrypto ? (
              <div className={`tp-field tp-field--crypto-qty${cryptoOrderExceedsBalance ? ' tp-field--over-balance' : ''}`}>
                <label className="tp-label">Quantity ({cryptoBaseSymbol})</label>
                <div
                  className={`tp-input-wrap${cryptoOrderExceedsBalance ? ' tp-input-wrap--exceeds-balance' : ''}`}
                >
                  <input
                    type="text"
                    className="tp-input"
                    value={size}
                    onChange={handleSizeChange}
                    onBlur={() => handleMarketFieldBlur('crypto', size)}
                    onPaste={(e) => handleMarketFieldPaste(e, 'crypto')}
                    placeholder="0"
                    step={cryptoPrecisionMeta.step}
                    inputMode={cryptoPrecisionMeta.inputMode}
                    pattern={cryptoPrecisionMeta.pattern}
                    autoComplete="off"
                    min="0"
                    aria-invalid={Boolean(marketFieldErrors.crypto || cryptoOrderExceedsBalance)}
                  />
                  <span className="tp-unit">{cryptoBaseSymbol}</span>
                </div>
                {marketFieldErrors.crypto ? <p className="tp-field-error">{marketFieldErrors.crypto}</p> : null}
                <p
                  className={`tp-crypto-order-hint${cryptoOrderExceedsBalance ? ' tp-crypto-order-hint--exceeds' : ''}`}
                >
                  {cryptoOrderValueUsdt != null ? (
                    <>
                      Order value <strong>{formatNumber(cryptoOrderValueUsdt, 2)} USDT</strong>
                      <span className="tp-crypto-order-hint__meta">
                        {' '}
                        · {cryptoLev}×{cryptoLeverageIsFromProfile ? ' (profile)' : ' (default)'} · est. margin{' '}
                        <strong>{formatNumber(cryptoOrderValueUsdt / cryptoLev, 2)} USDT</strong>
                      </span>
                      {cryptoOrderExceedsBalance && (
                        <span className="tp-crypto-order-hint__alert" role="status">
                          Exceeds max at {cryptoLev}× (~{formatNumber(cryptoMaxOrderValueUsdt, 2)} USDT notional)
                        </span>
                      )}
                    </>
                  ) : (
                    'Enter quantity to see order value in USDT (last price for market).'
                  )}
                </p>
              </div>
            ) : isForex ? (
              <div className="tp-forex-fields">
                <div className={`tp-field${forexOrderExceedsBalance ? ' tp-field--over-balance' : ''}`}>
                  <label className="tp-label">Lot size ({forexPairLabel})</label>
                  <div
                    className={`tp-input-wrap${forexOrderExceedsBalance ? ' tp-input-wrap--exceeds-balance' : ''}`}
                  >
                    <input
                      type="text"
                      className="tp-input"
                      value={forexLotSize}
                      onChange={handleForexLotChange}
                      onBlur={() => handleMarketFieldBlur('forex', forexLotSize)}
                      onPaste={(e) => handleMarketFieldPaste(e, 'forex')}
                      placeholder={FOREX_DEFAULT_LOT}
                      step={forexPrecisionMeta.step}
                      inputMode={forexPrecisionMeta.inputMode}
                      pattern={forexPrecisionMeta.pattern}
                      autoComplete="off"
                      min="0.01"
                      max={String(FOREX_MAX_LOT)}
                      aria-invalid={Boolean(marketFieldErrors.forex || forexOrderExceedsBalance)}
                    />
                    <span className="tp-unit">lot</span>
                  </div>
                  {marketFieldErrors.forex ? <p className="tp-field-error">{marketFieldErrors.forex}</p> : null}
                </div>
                <div className={`tp-field${forexOrderExceedsBalance ? ' tp-field--over-balance' : ''}`}>
                  {/* <label className="tp-label">Total quantity</label>
                  <div
                    className={`tp-input-wrap${forexOrderExceedsBalance ? ' tp-input-wrap--exceeds-balance' : ''}`}
                  >
                    <input
                      type="text"
                      className="tp-input tp-input--readonly"
                      readOnly
                      aria-readonly="true"
                      value={
                        forexQtyLoading
                          ? ''
                          : forexOrderQuantity != null
                            ? formatNumber(forexOrderQuantity, decimalsForValue(forexOrderQuantity))
                            : '—'
                      }
                      placeholder="—"
                      disabled={forexQtyLoading}
                      aria-invalid={forexOrderExceedsBalance}
                    />
                    <span className="tp-unit">units</span>
                  </div> */}
                  {forexQtyLoading && (
                    <p className="tp-india-qty-hint tp-india-qty-hint--loading">Loading units per lot…</p>
                  )}
                  {!forexQtyLoading && forexQuantityPerLot != null && (
                    <p className="tp-india-qty-hint">
                      {forexPairSymbolFromApi ? (
                        <span className="tp-india-pair-sym" title="Symbol from API">
                          {forexPairSymbolFromApi}
                          {' · '}
                        </span>
                      ) : null}
                      1 lot = <strong>{formatNumber(forexQuantityPerLot, 4)}</strong> units · total = lots × units
                    </p>
                  )}
                  {forexNotionalUsdt != null && forexMarginUsdtLive != null && (
                    <p
                      className={`tp-crypto-order-hint${forexOrderExceedsBalance ? ' tp-crypto-order-hint--exceeds' : ''}`}
                    >
                      Notional <strong>{formatNumber(forexNotionalUsdt, 2)} USDT</strong>
                      <span className="tp-crypto-order-hint__meta">
                        {' '}
                        · Est. margin <strong>{formatNumber(forexMarginUsdtLive, 2)} USDT</strong>
                        {SHOW_LEVERAGE_CONTROLS ? (
                          <> · {leverage || 1}×</>
                        ) : null}
                      </span>
                      {forexOrderExceedsBalance && (
                        <span className="tp-crypto-order-hint__alert" role="status">
                          Est. margin {formatNumber(forexMarginUsdtLive ?? 0, 2)} USDT exceeds available{' '}
                          {formatNumber(availableBalance, 2)} USDT — reduce lots or add funds.
                        </span>
                      )}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="tp-field">
                <label className="tp-label">Size</label>
                <div className="tp-input-wrap">
                  <input
                    type="text"
                    className="tp-input"
                    value={size}
                    onChange={handleSizeChange}
                    placeholder="0"
                  />
                  <button type="button" className="tp-unit tp-unit--dropdown">
                    {sizeUnit}
                  </button>
                </div>
              </div>
            )}

            {/* Indian market: lot-size % slider hidden — enter lots manually in the field above */}
            {/* {isIndia && (
              <div className={`tp-alloc-row${indiaOrderExceedsBalance ? ' tp-alloc-row--exceeds' : ''}`}>
                <span className="tp-alloc-row__label">Lot size vs max buying power</span>
                <span className="tp-alloc-row__pct">{Math.round(sliderPercent)}%</span>
              </div>
            )} */}
            {!isIndia && isCrypto && (
              <div className={`tp-alloc-row${cryptoOrderExceedsBalance ? ' tp-alloc-row--exceeds' : ''}`}>
                <span className="tp-alloc-row__label">Size vs max (balance × {cryptoLev}×)</span>
                <span className="tp-alloc-row__pct">{Math.round(sliderPercent)}%</span>
              </div>
            )}
            {!isIndia && isForex && (
              <div className={`tp-alloc-row${forexOrderExceedsBalance ? ' tp-alloc-row--exceeds' : ''}`}>
                <span className="tp-alloc-row__label">Lots vs max buying power</span>
                <span className="tp-alloc-row__pct">{Math.round(sliderPercent)}%</span>
              </div>
            )}
            {!isIndia && (
              <div
                className={`tp-leverage-slider-wrap${isCrypto || isForex ? ' tp-leverage-slider-wrap--crypto tp-crypto-slider' : ''}${isForex && forexOrderExceedsBalance ? ' tp-crypto-slider--exceeds' : ''}`}
              >
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={sliderPercent}
                  onChange={handleSliderInputChange}
                  className={`tp-leverage-range${isCrypto || isForex ? ' tp-crypto-slider__range' : ''}`}
                  style={
                    isCrypto || isForex
                      ? {
                        background:
                          isForex && forexOrderExceedsBalance
                            ? `linear-gradient(to right, #f87171 0%, #f87171 ${sliderPercent}%, var(--bg-tertiary) ${sliderPercent}%, var(--bg-tertiary) 100%)`
                            : `linear-gradient(to right, var(--brand-primary, #ffd50077) 0%, var(--brand-primary, #ffd50077) ${sliderPercent}%, var(--bg-tertiary) ${sliderPercent}%, var(--bg-tertiary) 100%)`,
                      }
                      : undefined
                  }
                  aria-label={
                    isCrypto
                      ? 'Percentage of maximum position size'
                      : isForex
                        ? 'Lot size as percent of maximum buying power'
                        : 'Amount percentage'
                  }
                />
                <div
                  className={`tp-leverage-markers${isCrypto || isForex ? ' tp-crypto-slider__markers' : ''}`}
                >
                  {SLIDER_PERCENTS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      className={`tp-leverage-marker${isCrypto || isForex ? ' tp-crypto-slider__step' : ''}${sliderPercent >= p ? ' tp-leverage-marker--active' : ''}`}
                      onClick={() => handleSliderDotClick(p)}
                      aria-label={`${p}%`}
                    >
                      {!(isCrypto || isForex) && <span className="tp-leverage-marker-dot" />}
                      <span className="tp-leverage-marker-label">{p}%</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="tp-options-row">
              <label className="tp-checkbox">
                <input
                  type="checkbox"
                  checked={tpSlChecked}
                  onChange={(e) => setTpSlChecked(e.target.checked)}
                />
                <span className="tp-checkbox-box" />
                <span>TP/SL</span>
              </label>
            </div>

            {tpSlChecked && (
              <div className="tp-tpsl-section">
                <div className="tp-tpsl-title">Take Profit / Stop Loss</div>
                <div className="tp-tpsl-fields">
                  <div className="tp-field">
                    <label className="tp-label">Take Profit ({sizeUnit})</label>
                    <div className="tp-input-wrap">
                      <input
                        type="text"
                        className="tp-input"
                        value={takeProfit}
                        onChange={(e) => {
                          let val = e.target.value.replace(/[^0-9.]/g, '');
                          const parts = val.split('.');
                          if (parts.length > 2) val = parts[0] + '.' + parts.slice(1).join('');
                          setTakeProfit(val);
                        }}
                        placeholder="0.00"
                      />
                      <span className="tp-unit">{sizeUnit}</span>
                    </div>
                  </div>
                  <div className="tp-field">
                    <label className="tp-label">Stop Loss ({sizeUnit})</label>
                    <div className="tp-input-wrap">
                      <input
                        type="text"
                        className="tp-input"
                        value={stopLoss}
                        onChange={(e) => {
                          let val = e.target.value.replace(/[^0-9.]/g, '');
                          const parts = val.split('.');
                          if (parts.length > 2) val = parts[0] + '.' + parts.slice(1).join('');
                          setStopLoss(val);
                        }}
                        placeholder="0.00"
                      />
                      <span className="tp-unit">{sizeUnit}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {Object.keys(orderValidationErrors).length > 0 && (
              <div className="tp-order-errors" role="alert">
                {Object.entries(orderValidationErrors).map(([key, msg]) => (
                  <div key={key} className="tp-order-error-item">{msg}</div>
                ))}
              </div>
            )}
            <div className="tp-action-btns">
              <button
                type="button"
                className="tp-btn tp-btn--long"
                onClick={() => handleSubmitOrder('buy')}
                disabled={
                  orderSubmitSideLoading !== null ||
                  indiaOrderExceedsBalance ||
                  indiaMarketNoExecutableBook ||
                  cryptoSubmitDisabledForBalance ||
                  forexSubmitDisabledForBalance ||
                  tradingSessionClosed
                }
                aria-busy={orderSubmitSideLoading === 'buy'}
                title={
                  tradingSessionCloseTitle ??
                  (indiaMarketNoExecutableBook
                    ? 'Live bid and ask are required before placing an order. Wait for quotes.'
                    : indiaOrderExceedsBalance
                      ? 'Required margin exceeds available balance'
                      : cryptoSubmitDisabledForBalance
                        ? 'Order value exceeds available balance'
                        : forexSubmitDisabledForBalance
                          ? 'Notional exceeds available margin at this leverage'
                          : undefined)
                }
              >
                {orderSubmitSideLoading === 'buy' ? 'Placing…' : isIndia ? 'Buy' : 'Open Long'}
              </button>
              <button
                type="button"
                className="tp-btn tp-btn--short"
                onClick={() => handleSubmitOrder('sell')}
                disabled={
                  orderSubmitSideLoading !== null ||
                  indiaOrderExceedsBalance ||
                  indiaMarketNoExecutableBook ||
                  cryptoSubmitDisabledForBalance ||
                  forexSubmitDisabledForBalance ||
                  tradingSessionClosed
                }
                aria-busy={orderSubmitSideLoading === 'sell'}
                title={
                  tradingSessionCloseTitle ??
                  (indiaMarketNoExecutableBook
                    ? 'Live bid and ask are required before placing an order. Wait for quotes.'
                    : indiaOrderExceedsBalance
                      ? 'Required margin exceeds available balance'
                      : cryptoSubmitDisabledForBalance
                        ? 'Order value exceeds available balance'
                        : forexSubmitDisabledForBalance
                          ? 'Notional exceeds available margin at this leverage'
                          : undefined)
                }
              >
                {orderSubmitSideLoading === 'sell' ? 'Placing…' : isIndia ? 'Sell' : 'Open Short'}
              </button>
            </div>

            {orderEstimateSection}
          </>
        ) : (
          <div className="tp-form-placeholder">
            <p className="tp-form-placeholder-text">
              Stop Limit order – coming soon.
            </p>
            <p className="tp-form-placeholder-hint">Select <strong>Limit</strong> or <strong>Market</strong> for the order form.</p>
          </div>
        )}
      </div>

      {/* Account section */}
      {/* <div className="tp-account">
        <div className="tp-account-head">
          <span className="tp-account-title">Account</span>
          <button type="button" className="tp-switch">
            <svg className="tp-switch-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M7 17L17 7" />
              <path d="M7 7h10v10" />
            </svg>
            Switch
          </button>
        </div>
        <div className="tp-margin-ratio">
          <div className="tp-mr-title">Margin Ratio</div>
          <div className="tp-mr-list">
            <div className="tp-mr-row">
              <span className="tp-mr-dot" />
              <span>Account Margin Ratio</span>
              <span>0.00%</span>
            </div>
            <div className="tp-mr-row">
              <span>Account Maintenance Margin</span>
              <span>0.00 USD</span>
            </div>
            <div className="tp-mr-row">
              <span>Account Equity</span>
              <span>0.00 USD</span>
              <button type="button" className="tp-info-icon tp-info-icon--sm" aria-label="Info">?</button>
            </div>
            <div className="tp-mr-row">
              <span>Position Value</span>
              <span>0.00 USD</span>
            </div>
            <div className="tp-mr-row">
              <span>Actual Leverage</span>
              <span>0.0000 X</span>
            </div>
          </div>
        </div>
        <button type="button" className="tp-secondary-btn">Multi-Assets</button>
        <div className="tp-usdt-section">
          <button type="button" className="tp-currency-dropdown">
            {sizeUnit}
            <span className="tp-chevron-down" />
          </button>
          <div className="tp-usdt-rows">
            <div className="tp-usdt-row">
              <span>Balance</span>
              <span>{balanceLoading ? '--' : formatNumber(availableBalance)} {sizeUnit}</span>
            </div>
            <div className="tp-usdt-row">
              <span>Unrealized PNL</span>
              <span>0.0000 {sizeUnit}</span>
            </div>
          </div>
        </div>
        <button type="button" className="tp-secondary-btn tp-pnl-btn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          Futures PNL Analysis
        </button>
      </div> */}

      {/* Bottom actions */}
      {/* <div className="tp-bottom-actions">
        <button type="button" className="tp-bottom-btn">Transfer</button>
        <button type="button" className="tp-bottom-btn">Buy Crypto</button>
        <button type="button" className="tp-bottom-btn">Swap</button>
      </div> */}

      {/* Adjust Leverage Modal (forex / non-crypto only) */}
      {SHOW_LEVERAGE_CONTROLS && !isCrypto && leverageModalOpen && (
        <div className="tp-leverage-modal-overlay" onClick={(e) => e.target === e.currentTarget && closeLeverageModal()}>
          <div className="tp-leverage-modal" onClick={(e) => e.stopPropagation()}>
            <div className="tp-leverage-modal-header">
              <h2 className="tp-leverage-modal-title">Adjust Leverage</h2>
              <button type="button" className="tp-leverage-modal-close" onClick={closeLeverageModal} aria-label="Close">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="tp-leverage-modal-body">
              <label className="tp-leverage-label">Leverage</label>
              <div className="tp-leverage-input-wrap">
                <button type="button" className="tp-leverage-step-btn" onClick={() => setLeverageModal(leverageModalValue - 1)} aria-label="Decrease">−</button>
                <span className="tp-leverage-input-value">{leverageModalValue}x</span>
                <button type="button" className="tp-leverage-step-btn" onClick={() => setLeverageModal(leverageModalValue + 1)} aria-label="Increase">+</button>
              </div>
              <div className="tp-leverage-slider-wrap">
                <input
                  type="range"
                  min={LEVERAGE_MIN}
                  max={LEVERAGE_MAX}
                  value={leverageModalValue}
                  onChange={(e) => setLeverageModal(e.target.value)}
                  className="tp-leverage-range"
                  aria-label="Leverage"
                />
                <div className="tp-leverage-markers">
                  {LEVERAGE_MARKERS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      className="tp-leverage-marker"
                      onClick={() => setLeverageModal(m)}
                      aria-label={`${m}x`}
                    >
                      <span className="tp-leverage-marker-dot" />
                      <span className="tp-leverage-marker-label">{m}x</span>
                    </button>
                  ))}
                </div>
              </div>
              <ul className="tp-leverage-info">
                <li>Maximum position at current leverage: {maxPositionUsdt} {sizeUnit}</li>
                <li>Please note that leverage changing will also apply for open positions and open orders.</li>
                <li>Selecting higher leverage such as [10x] increases your liquidation risk. Always manage your risk levels. See our <button type="button" className="tp-leverage-link">help article</button> for more information.</li>
              </ul>
              <div className="tp-leverage-links-row">
                <button type="button" className="tp-leverage-link">Check on Leverage & Margin table</button>
                <button type="button" className="tp-leverage-link">Position Limit Enlarge</button>
              </div>
              <div className="tp-leverage-default-row">
                <span className="tp-leverage-default-label">Default Leverage & Margin Mode</span>
                <button type="button" className="tp-leverage-default-value">
                  Off
                  <span className="tp-leverage-chevron">›</span>
                </button>
              </div>
              <button type="button" className="tp-leverage-confirm" onClick={handleLeverageConfirm}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      <TransferModal
        isOpen={transferModalOpen}
        walletData={walletData ?? getEmptyWalletData()}
        onClose={() => setTransferModalOpen(false)}
        onSuccess={refreshWallet}
      />
    </div>
  );
};

export default TradingPanel;

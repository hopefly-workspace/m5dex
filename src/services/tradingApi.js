import { getDeviceInfo } from '../utils/clientDeviceInfo';
import { api } from './api';

// Default base /api use hota hai (proxy/rewrite → backend), CORS nahi aata
const TRADING_ORDERS_PATH = '/trading/orders';
const OPEN_ORDERS_PATH = '/trading/orders/open';
const PENDING_ORDERS_PATH = '/trading/orders/pending';
const ORDER_HISTORY_PATH = '/trading/orders/history';
const CLOSE_ORDERS_PATH = '/trading/closeorders';
const UPDATE_TPSL_PATH = '/trading/update';
const CANCEL_PENDING_ORDER_PATH = '/trading/cancelorders';
const GET_QUANTITY_PATH = '/trading/getquantity'; // POST body: { pairid }
const GET_FOREX_QUANTITY_PATH = '/trading/getforexquantity'; // POST body: { pair } → v1/trading/getforexquantity
const CHECK_MARKET_PATH = '/trading/checkmarket';
const CLOSE_ALL_ORDERS_PATH = '/trading/closeallorders';

export const normalizePair = (pair) => {
  if (pair == null || String(pair).trim() === '') return '';
  return String(pair).replace(/\//g, '').trim().toUpperCase();
};

/**
 * 8 fractional digits as string — used for price, usermargin, liveprice, lotsize, quantity on order APIs.
 * Backend should coerce with Number(...) / parseFloat(...) where it expects numeric types.
 */
export const ORDER_API_MONETARY_DECIMALS = 8;

export function orderApiMonetaryFixedString(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return n.toFixed(ORDER_API_MONETARY_DECIMALS);
}

export const placeOrder = async (payload) => {

  const deviceInfo = await getDeviceInfo();

  const body = {
    mode: payload.mode,
    trademode: 'open',
    price: orderApiMonetaryFixedString(payload.price),
    usermargin:
      payload.usermargin != null ? orderApiMonetaryFixedString(payload.usermargin) : undefined,
    pair: normalizePair(payload.pair) || payload.pair,
    marketType: payload.marketType,
    // 'type' tells backend which market (crypto/forex/indices/metals/indian/etc.) this trade belongs to
    type: payload.type,
    tradeprofit: payload.tradeprofit != null ? Number(payload.tradeprofit) : 0,
    stoploss: payload.stoploss != null ? Number(payload.stoploss) : 0,
    leverage: Number(payload.leverage),
    liveprice: orderApiMonetaryFixedString(payload.liveprice),

    // pass device info
    device_info: deviceInfo,
  };
  // Indian market: backend expects lotsize, pairid, quantity in addition to shared fields
  if (payload.lotsize != null && payload.lotsize !== '') {
    body.lotsize = orderApiMonetaryFixedString(payload.lotsize);
  }
  if (payload.pairid != null && String(payload.pairid).trim() !== '') {
    body.pairid = String(payload.pairid).trim();
  }
  if (payload.quantity != null && payload.quantity !== '') {
    body.quantity = orderApiMonetaryFixedString(payload.quantity);
  }
  if (body.quantity === undefined) delete body.quantity;
  if (body.lotsize === undefined || Number.isNaN(Number(body.lotsize))) delete body.lotsize;
  if (body.pairid === undefined) delete body.pairid;
  if (body.usermargin === undefined) delete body.usermargin;
  return await api.post(TRADING_ORDERS_PATH, body);
};

/**
 * Standard shape: { code: 200, status: true, data: [{ pairsymbol, quantity }] }
 */
function extractFromGetQuantityResponse(res, pairid) {
  if (res == null || typeof res !== 'object') return null;
  const arr = Array.isArray(res.data) ? res.data : Array.isArray(res.result) ? res.result : null;
  if (!arr?.length) return null;
  const id = String(pairid ?? '').trim();
  if (id) {
    const matched = arr.find((r) => {
      if (!r) return false;
      const rid = String(r.pairid ?? r.pairId ?? r.id ?? r.instrument_token ?? '').trim();
      if (rid && rid === id) return r.quantity != null || r.qty != null || r.Quantity != null;
      return false;
    });
    if (matched) {
      const qRaw = matched.quantity ?? matched.qty ?? matched.Quantity;
      const n = Number(qRaw);
      if (Number.isFinite(n) && n > 0) {
        const pairsymbol = String(
          matched.pairsymbol ?? matched.pairSymbol ?? matched.pair_symbol ?? ''
        ).trim();
        return { quantity: n, pairsymbol };
      }
    }
  }
  const row = arr.find((r) => r && (r.quantity != null || r.qty != null || r.Quantity != null));
  if (!row) return null;
  const qRaw = row.quantity ?? row.qty ?? row.Quantity;
  const n = Number(qRaw);
  if (!Number.isFinite(n) || n <= 0) return null;
  const pairsymbol = String(row.pairsymbol ?? row.pairSymbol ?? row.pair_symbol ?? '').trim();
  return { quantity: n, pairsymbol };
}

/**
 * Walk nested API JSON for objects that expose quantity + pairsymbol (not bare numbers — avoids "code": 200 → 200 qty).
 */
function extractIndiaQuantityFromResponse(root) {
  if (root == null) return null;
  const visited = new WeakSet();

  const tryObject = (obj) => {
    if (!obj || typeof obj !== 'object') return null;
    if (visited.has(obj)) return null;
    visited.add(obj);

    const qVal =
      obj.quantity ??
      obj.Quantity ??
      obj.qty ??
      obj.QTY ??
      obj.lotquantity ??
      obj.lotQuantity ??
      obj.quntity ??
      obj.Quntity ??
      obj.Qunlity;

    if (qVal !== undefined && qVal !== null && qVal !== '') {
      const n = Number(qVal);
      if (Number.isFinite(n) && n > 0) {
        const pairsymbol = String(
          obj.pairsymbol ?? obj.pairSymbol ?? obj.pair_symbol ?? obj.symbol ?? ''
        ).trim();
        return { quantity: n, pairsymbol };
      }
    }

    if (Array.isArray(obj)) {
      for (const el of obj) {
        const r = walk(el);
        if (r) return r;
      }
      return null;
    }

    for (const k of Object.keys(obj)) {
      const r = walk(obj[k]);
      if (r) return r;
    }
    return null;
  };

  function walk(v) {
    if (v == null) return null;
    // Do NOT treat bare numbers as quantity (APIs often send "code": 200).
    if (typeof v === 'string') {
      const t = v.trim();
      if (t === '' || t === 'true' || t === 'false') return null;
      if ((t.startsWith('{') || t.startsWith('[')) && t.length < 50000) {
        try {
          return walk(JSON.parse(t));
        } catch {
          return null;
        }
      }
      return null;
    }
    if (typeof v === 'object') return tryObject(v);
    return null;
  }

  return walk(root);
}

/**
 * Indian market: contract quantity per lot + symbol from API.
 * POST /trading/getquantity — body: { pairid }
 * Response example: { pairsymbol: "NFO:RELIANCE26APR1100PE", quantity: 500 }
 * @returns {Promise<{ quantity: number, pairsymbol: string }|null>}
 */
export const getIndiaQuantityByPairId = async (pairid) => {
  const id = String(pairid ?? '').trim();
  if (!id) return null;
  const res = await api.post(GET_QUANTITY_PATH, { pairid: id });
  return (
    extractFromGetQuantityResponse(res, id) ??
    extractIndiaQuantityFromResponse(res) ??
    extractIndiaQuantityFromResponse(res?.data) ??
    extractIndiaQuantityFromResponse(res?.result) ??
    extractIndiaQuantityFromResponse(res?.data?.data)
  );
};

/**
 * Forex: units per 1 standard lot for the pair.
 * POST /trading/getforexquantity — body: { pair } (normalized symbol e.g. EURUSD)
 * @returns {Promise<{ quantity: number, pairsymbol: string }|null>}
 */
export const getForexQuantityByPair = async (pair) => {
  const p = normalizePair(pair) || String(pair ?? '').trim();
  if (!p) return null;
  const res = await api.post(GET_FOREX_QUANTITY_PATH, { pair: p });
  return (
    extractFromGetQuantityResponse(res) ??
    extractIndiaQuantityFromResponse(res) ??
    extractIndiaQuantityFromResponse(res?.data) ??
    extractIndiaQuantityFromResponse(res?.result) ??
    extractIndiaQuantityFromResponse(res?.data?.data)
  );
};

export const getOpenOrders = async () => {
  // return [];
  return await api.get(OPEN_ORDERS_PATH);
};

export const getPendingOrders = async () => {
  // return [];
  return await api.get(PENDING_ORDERS_PATH);
};

export const getOrderHistory = async () => {
  return await api.get(ORDER_HISTORY_PATH);
};

/**
 * Close an open position/order.
 * POST /trading/closeorders
 * @param {Object} payload - { mode, trademode, price, quantity, pair, marketType }
 * @returns {Promise<Object>} API response
 */
export const closeOrder = async (payload) => {
  const deviceInfo = await getDeviceInfo();

  const qtyRaw =
    payload.quantity != null && payload.quantity !== '' ? payload.quantity : 0;
  const lotRaw =
    payload.lotsize != null && payload.lotsize !== '' ? payload.lotsize : 0;

  const body = {
    mode: payload.mode,
    trademode: 'close',
    price: orderApiMonetaryFixedString(payload.price),
    quantity: orderApiMonetaryFixedString(qtyRaw),
    lotsize: orderApiMonetaryFixedString(lotRaw),
    pair: normalizePair(payload.pair) || payload.pair,
    marketType: payload.marketType,
    orderno: payload.orderno,
    type: payload.type,
    pairid: payload.pairid,
    device_info: deviceInfo,
  };
  return await api.post(CLOSE_ORDERS_PATH, body);
};

export const closeAllOrders = async (payload) => {
  const deviceInfo = await getDeviceInfo();
  const body = {
    ...payload,
    device_info: deviceInfo,
  };
  return await api.post(CLOSE_ALL_ORDERS_PATH, body);
  // return await api.post('/trading/closeallorders', payload);
};

// cancel order
// export const cancelOrder = async (payload) => {
//   const body = {
//     orderno: payload.orderno,
//   };
//   return await api.post(CANCEL_PENDING_ORDER_PATH, body);
// };

export const cancelOrder = async (orderId, orderType) => {
  const deviceInfo = await getDeviceInfo();

  const orderno = Array.isArray(orderId) ? orderId.join(',') : orderId;
  const type = Array.isArray(orderType) ? orderType.join(',') : orderType;
  // const type = orderType || null;

  const body = {
    orderno: orderno,
    type: type,
    device_info: deviceInfo,
  };

  return await api.post(CANCEL_PENDING_ORDER_PATH, body);
};

/**
 * Update TP/SL for an open position/order.
 * POST /trading/update
 * @param {Object} payload - { trademode (buy/sell), pair, tradeprofit, stoploss, liveprice }
 */
export const updateOrderTpSl = async (payload) => {

  const deviceInfo = await getDeviceInfo();

  const body = {
    // Backend expects trademode = trade side (buy / sell)
    trademode: payload.trademode,
    pair: normalizePair(payload.pair) || payload.pair,
    tradeprofit: payload.tradeprofit != null ? Number(payload.tradeprofit) : 0,
    stoploss: payload.stoploss != null ? Number(payload.stoploss) : 0,
    liveprice: orderApiMonetaryFixedString(payload.liveprice),
    type: payload.type,
    pairid: payload.pairid,
    orderno: payload.orderno,
    device_info: deviceInfo,
  };

  return await api.post(UPDATE_TPSL_PATH, body);
};

/** GET /trading/cryptobalance — same-origin `/api` → Vite proxy → globaltradeapi…/v1 */
export const getCryptoBalance = () => api.get('/trading/cryptobalance');

/** GET /trading/forexbalance — same-origin `/api` → Vite proxy → globaltradeapi…/v1 */
export const getForexBalance = () => api.get('/trading/forexbalance');

/**
 * GET /trading/checkmarket — query: pair, type (backend uses `indian` for India), optional pairid.
 * @param {{ pair: string, marketType: string, pairId?: string|number }} opts
 */
export const checkTradingMarket = async ({ pair, marketType, pairId }) => {
  const p = normalizePair(pair) || String(pair ?? '').trim();
  const t = String(marketType || '').trim().toLowerCase();
  const apiType = t === 'india' || t === 'indian' ? 'indian' : t;
  const params = new URLSearchParams();
  if (p) params.set('pair', p);
  if (apiType) params.set('type', apiType);
  const id = pairId != null ? String(pairId).trim() : '';
  if (id && (t === 'india' || t === 'indian')) params.set('pairid', id);
  const qs = params.toString();
  return await api.get(qs ? `${CHECK_MARKET_PATH}?${qs}` : CHECK_MARKET_PATH);
};

/**
 * Map GET /trading/checkmarket JSON to whether the **current** dashboard market allows trading.
 * Response shape includes `indiandata`, `forexdata`, `indianMCXdata` each with `{ open, msg }`.
 * MCX instruments: `marketPairRaw` starts with `MCX:` (or contains `MCX:`) → uses `indianMCXdata`; else `indiandata`.
 * Unknown / missing blocks default to open (do not block).
 * @returns {{ sessionOpen: boolean, message: string }}
 */
export const resolveCheckMarketSessionForDashboard = (res, marketType, marketPairRaw) => {
  const root =
    res &&
      typeof res === 'object' &&
      res.data &&
      typeof res.data === 'object' &&
      !Array.isArray(res.data) &&
      (res.data.indiandata != null ||
        res.data.forexdata != null ||
        res.data.indianMCXdata != null ||
        res.data.indianmcxdata != null)
      ? res.data
      : res;
  const t = String(marketType || '').trim().toLowerCase();
  const readBlock = (block) => {
    if (block == null || typeof block !== 'object') {
      return { sessionOpen: true, message: '' };
    }
    if (!('open' in block)) {
      return { sessionOpen: true, message: String(block.msg ?? block.message ?? '').trim() };
    }
    const o = block.open;
    const sessionOpen =
      o === true ||
      o === 1 ||
      String(o).toLowerCase() === 'true' ||
      String(o).toLowerCase() === '1';
    const message = String(block.msg ?? block.message ?? '').trim();
    return { sessionOpen, message };
  };

  if (t === 'forex') {
    return readBlock(root?.forexdata);
  }
  if (t === 'india' || t === 'indian') {
    const raw = String(marketPairRaw || '').trim();
    const u = raw.toUpperCase();
    const isMcx = u.startsWith('MCX:') || u.includes('MCX:');
    const block = isMcx
      ? (root?.indianMCXdata ?? root?.indianmcxdata ?? root?.indianMcxData)
      : root?.indiandata;
    return readBlock(block);
  }
  return { sessionOpen: true, message: '' };
};

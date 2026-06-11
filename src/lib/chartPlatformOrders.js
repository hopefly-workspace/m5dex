/**

 * Map live trading API open positions → portable chart order model.

 */

import { normalizeSymbol } from '../services/favouritesWishlistApi';



/** Same rules as dashboard chart symbol (strip exchange prefix, normalize alphanumerics). */

export function normalizeChartPairSymbol(pair) {

  const raw = String(pair ?? '').trim();

  if (!raw) return '';

  let symbol = raw;

  if (raw.includes(':')) {

    const after = raw.split(':').slice(1).join(':').trim();

    symbol = after || raw;

  }

  return normalizeSymbol(symbol);

}



/** Parse GET /trading/orders/open (same shapes as OrdersPanel). */

export function parseOpenOrdersList(res) {

  const data = res?.data ?? res?.result ?? res ?? {};

  if (Array.isArray(data)) return data;

  if (Array.isArray(data?.data)) return data.data;

  if (Array.isArray(data?.list)) return data.list;

  if (Array.isArray(data?.orders)) return data.orders;

  if (Array.isArray(data?.openOrders)) return data.openOrders;

  if (Array.isArray(data?.open_positions)) return data.open_positions;

  return [];

}



function isPairIdOrOrderTypeLabel(key) {

  if (!key) return true;

  if (/^\d+$/.test(key)) return true;

  return key === 'market' || key === 'limit' || key === '-' || key === '0';

}



export function getOrderMarketTypeKey(raw, symbol = '') {

  const sym = String(symbol).toUpperCase();



  if (/^(NFO|MCX|NSE|BSE|CDS|BCD|NCDEX):/i.test(sym)) return 'india';

  if (/USDT$/i.test(sym)) return 'crypto';

  if (

    /^(EUR|GBP|USD|JPY|AUD|CHF|NZD|CAD)(USD|EUR|GBP|JPY|CHF|AUD|NZD|CAD)$/.test(sym) ||

    (sym.length === 6 && !sym.endsWith('USDT'))

  ) {

    return 'forex';

  }

  if (/^(NIFTY|BANKNIFTY|SENSEX|BSE|NSE)/i.test(sym) || sym.endsWith('INR')) return 'india';



  const candidates = [

    raw?.market,

    raw?.segment,

    raw?.marketSegment,

    raw?.assetType,

    raw?.productType,

    raw?.market_type,

    raw?.marketType,

    raw?.type,

  ];



  for (const c of candidates) {

    const key = String(c ?? '').trim().toLowerCase();

    if (!key || isPairIdOrOrderTypeLabel(key)) continue;

    if (key.includes('crypto')) return 'crypto';

    if (key.includes('forex')) return 'forex';

    if (key.includes('indice') || key.includes('index')) return 'forex';

    if (key.includes('metal') || key.includes('commodit')) return 'forex';

    if (key.includes('india') || key.includes('indian')) return 'india';

  }



  return '';

}



function parseTpSlPrice(val) {

  if (val == null || val === '' || val === '-') return null;

  const n = Number(val);

  return Number.isFinite(n) && n > 0 ? n : null;

}



function orderQtyFromRaw(raw) {

  const lot = Number(raw?.lotsize ?? raw?.lotSize ?? raw?.lot ?? NaN);

  if (Number.isFinite(lot) && lot > 0) return lot;

  const qty = Number(raw?.quantity ?? raw?.qty ?? raw?.size ?? raw?.volume ?? NaN);

  if (Number.isFinite(qty) && qty > 0) return qty;

  return 0.001;

}



function entryPriceFromRaw(raw) {

  const n = Number(

    raw?.price ??

      raw?.openbuyprice ??

      raw?.opensellprice ??

      raw?.openPrice ??

      raw?.entryPrice ??

      raw?.avgPrice ??

      raw?.avg_price ??

      raw?.open_price ??

      0,

  );

  return Number.isFinite(n) && n > 0 ? n : 0;

}



export function chartPairSymbolsMatch(orderSymbolRaw, chartSymbolRaw) {

  const a = normalizeChartPairSymbol(orderSymbolRaw);

  const b = normalizeChartPairSymbol(chartSymbolRaw);

  return Boolean(a && b && a === b);

}



/**

 * @param {object} raw Open position from API / websocket

 */

export function mapPlatformPositionToChartOrder(raw, index = 0) {

  const symbolRaw = raw?.pairname ?? raw?.pair ?? raw?.symbol ?? raw?.pairName ?? '';

  const symbol =

    normalizeChartPairSymbol(symbolRaw) ||

    String(symbolRaw).replace(/\//g, '').toUpperCase().trim();

  const orderNo = raw?.orderno ?? raw?.orderNo ?? raw?.order_no ?? null;

  const entry = entryPriceFromRaw(raw);

  const id = String(

    orderNo ??

      raw?.usertranid ??

      raw?.id ??

      raw?.orderId ??

      raw?.order_id ??

      raw?._id ??

      (entry > 0 ? `${symbol}-${entry}-${index}` : `${symbol}-${raw?.ondate ?? index}`),

  );

  const sideRaw = raw?.side ?? raw?.mode ?? raw?.positionSide ?? raw?.direction ?? 'buy';

  const side = String(sideRaw).toLowerCase() === 'sell' ? 'sell' : 'buy';

  const tp = parseTpSlPrice(

    raw?.current_profitrade ?? raw?.profitrade ?? raw?.tradeprofit ?? raw?.tp ?? raw?.takeProfit,

  );

  const sl = parseTpSlPrice(raw?.current_stoploss ?? raw?.stoploss ?? raw?.stopLoss ?? raw?.sl);



  return {

    id,

    side,

    qty: orderQtyFromRaw(raw),

    entry,

    tp,

    sl,

    committedTp: tp,

    committedSl: sl,

    platform: {

      raw,

      orderno: orderNo,

      pair: symbol,

      type: raw?.market ?? raw?.type ?? null,

      pairid: raw?.type === '-' ? 0 : raw?.type ?? 0,

    },

  };

}



export function buildPlatformTpSlPayload(chartOrder, { tp, sl }, liveprice) {

  const { platform } = chartOrder;

  const isBuy = chartOrder.side === 'buy';

  return {

    trademode: isBuy ? 'buy' : 'sell',

    pair: platform.pair,

    tradeprofit: tp != null && Number.isFinite(Number(tp)) ? Number(tp) : 0,

    stoploss: sl != null && Number.isFinite(Number(sl)) ? Number(sl) : 0,

    liveprice,

    type: platform.type,

    pairid: platform.pairid,

    orderno: platform.orderno,

  };

}



/** Stable string for chart order list — skip React/chart resync when WS payload is unchanged. */
export function chartOrdersListSignature(orders) {
  if (!Array.isArray(orders) || orders.length === 0) return '';
  return orders
    .map((o) => {
      const id = o?.id ?? '';
      const entry = o?.entry ?? '';
      const tp = o?.tp ?? '';
      const sl = o?.sl ?? '';
      const side = o?.side ?? '';
      const qty = o?.qty ?? '';
      return `${id}:${entry}:${tp}:${sl}:${side}:${qty}`;
    })
    .sort()
    .join('|');
}

export function filterPlatformOrdersForChart(orders, chartSymbol, marketType) {

  const sym = normalizeChartPairSymbol(chartSymbol);

  const mt = String(marketType || 'crypto').trim().toLowerCase();

  if (!sym || !mt) return [];



  return (Array.isArray(orders) ? orders : [])

    .filter((raw) => {

      const rawPair =

        raw?.pairname ?? raw?.pair ?? raw?.symbol ?? raw?.pairName ?? '';

      if (!chartPairSymbolsMatch(rawPair, sym)) return false;

      const rawSym = normalizeChartPairSymbol(rawPair);

      const orderMt = getOrderMarketTypeKey(raw, rawSym);

      return !orderMt || orderMt === mt;

    })

    .map((raw, index) => mapPlatformPositionToChartOrder(raw, index))

    .filter((o) => Number.isFinite(o.entry) && o.entry > 0);

}



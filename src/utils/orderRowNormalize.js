import { normalizeSymbol } from '../services/favouritesWishlistApi';
import {
    formatIndianOrderPairDisplay,
    getIndianInstrumentKind,
    getIndianOrderUnderlyingForIcon,
} from './helper';
import { extractIndiaOrderPairId } from './orderMarkPrice';
import { computeOpenPositionPnl, resolveQtyForPnl } from './orderPnl';

export function getOrderMarketTypeKey(raw, symbol = '') {
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
        if (!key || key === '-') continue;
        if (/^\d+$/.test(key)) continue;
        if (key.includes('crypto')) return 'crypto';
        if (key.includes('forex')) return 'forex';
        if (key.includes('indice') || key.includes('index')) return 'forex';
        if (key.includes('metal') || key.includes('commodit')) return 'forex';
        if (key.includes('india') || key.includes('indian')) return 'india';
    }

    const sym = String(symbol || '').toUpperCase();
    if (/^(NFO|MCX|NSE|BSE|CDS|BCD|NCDEX):/i.test(sym)) return 'india';
    if (/\d{2}(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)/i.test(sym)) return 'india';
    if (/(CE|PE|FUT)$/i.test(sym)) return 'india';
    if (/^(GOLD|SILVER|CRUDE|COPPER|NIFTY|BANKNIFTY|SENSEX)/i.test(sym)) return 'india';
    if (/USDT$/i.test(sym)) return 'crypto';
    if (
        /^(EUR|GBP|USD|JPY|AUD|CHF|NZD|CAD)(USD|EUR|GBP|JPY|CHF|AUD|NZD|CAD)$/.test(sym) ||
        (sym.length === 6 && !sym.endsWith('USDT'))
    ) {
        return 'forex';
    }
    if (/^(NIFTY|BANKNIFTY|SENSEX|BSE|NSE)/i.test(sym) || sym.endsWith('INR')) return 'india';
    return 'crypto';
}


export function getOrderLotSizeValue(raw, fallback = 0) {
    const lot = Number(raw?.lotsize ?? raw?.lotSize ?? raw?.lot ?? raw?.lots ?? fallback);
    return Number.isFinite(lot) ? lot : 0;
}

export function getOrderQuantityValue(raw, fallback = 0) {
    const qty = Number(raw?.quantity ?? raw?.qty ?? raw?.size ?? raw?.volume ?? raw?.amount ?? fallback);
    return Number.isFinite(qty) ? qty : 0;
}

export function getOrderSizeValue(raw, fallback = 0) {
    const lot = Number(raw?.lotsize ?? raw?.lotSize ?? raw?.lot ?? raw?.lots ?? NaN);
    if (Number.isFinite(lot) && lot > 0) return lot;
    const qty = Number(raw?.quantity ?? raw?.qty ?? raw?.size ?? raw?.volume ?? raw?.amount ?? fallback);
    return Number.isFinite(qty) ? qty : 0;
}

const symbolToPair = (s) => {
    const n = normalizeSymbol(s);
    if (!n) return '-';
    const base = n.replace(/(USDT|USD|INR)$/i, '') || n;
    return `${base}/USDT`;
};



export function resolveOrderDisplaySymbol(symbolRaw, symbol, orderMarketType) {
    const isIndia = String(orderMarketType || '').toLowerCase() === 'india';
    if (isIndia) return formatIndianOrderPairDisplay(symbolRaw) || String(symbolRaw || symbol || '-');
    return symbolToPair(symbolRaw || symbol);
}

export function resolveOrderBaseSymbol(symbolRaw, symbol, orderMarketType) {
    const isIndia = String(orderMarketType || '').toLowerCase() === 'india';
    if (isIndia) {
        return (
            getIndianOrderUnderlyingForIcon(symbolRaw) ||
            String(symbol || '').replace(/^[^:]+:\:?/, '').slice(0, 12) ||
            'NA'
        );
    }
    return String(symbol || '').replace(/(USDT|USD|INR)$/i, '') || symbol || 'NA';
}


export function resolveOrderSide(raw) {
    const sideRaw = String(
        raw?.side ?? raw?.mode ?? raw?.positionSide ?? raw?.direction ?? raw?.ordertype ?? '',
    ).toLowerCase();
    return sideRaw === 'sell' ? 'sell' : 'buy';
}

export function computeOrderOpenPnl({
    side,
    openPrice,
    currentPrice,
    orderMarketType,
    lotSizeNum,
    quantityNum,
    sizeNum,
    usedMargin,
    leverage,
    totalAmt,
    inrPerUsdt,
    raw,
}) {
    const isIndiaOrder = String(orderMarketType || '').toLowerCase() === 'india';
    const qtyForPnl = resolveQtyForPnl(orderMarketType, {
        lotSize: lotSizeNum,
        quantity: quantityNum,
        sizeFallback: sizeNum,
    });

    const rawProfit = Number(raw?.profit ?? raw?.pnl ?? raw?.unrealizedPnl ?? raw?.unrealized_pnl ?? 0) || 0;
    const rawProfitPercent = raw?.pnlpercent ?? raw?.profitPercent ?? raw?.profitpercent ?? null;

    return computeOpenPositionPnl({
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
}

export function resolveIndiaPairIdFromRaw(raw) {
    return extractIndiaOrderPairId(raw);
}

export function getIndianInstrumentKindForRaw(symbolRaw, orderMarketType) {
    if (String(orderMarketType || '').toLowerCase() !== 'india') return null;
    return getIndianInstrumentKind(symbolRaw);
}
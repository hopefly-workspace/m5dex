import { normalizeSymbol } from '../services/favouritesWishlistApi';
import { readIndiaPairIdSessionMap } from '../services/indiaTicksSubscription';
import { findIndiaMarketTick, findIndiaPairIdInTradeList, indiaTickPairId, indiaTickSymbolKey } from './indiaPairResolve';

export const parsePositivePrice = (v) => {
    const n = v != null ? Number(v) : null;
    return n != null && !Number.isNaN(n) && n > 0 ? n : null;
};

/** Best bid / ask / last from a market feed row. */
export function getQuoteFromMarketItem(item, { strictBidAsk = false } = {}) {
    if (!item || typeof item !== 'object') return { bid: null, ask: null, last: null };
    const last = parsePositivePrice(
        item.price ??
        item.p ??
        item.last ??
        item.close ??
        item.Last ??
        item.Close ??
        item.index ??
        item.mark ??
        item.markPrice ??
        item.ltp,
    );

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
}

export const getStrictQuoteFromMarketItem = (item) =>
    getQuoteFromMarketItem(item, { strictBidAsk: true });

/** India order rows may store instrument id on `type`, `pairid`, etc. */
export function extractIndiaOrderPairId(raw) {
    if (!raw || typeof raw !== 'object') return '';
    const direct = raw.pairid ?? raw.pairId ?? raw.instrument_token ?? raw.instrumentToken;
    if (direct != null && String(direct).trim() && String(direct).trim() !== '-') {
        return String(direct).trim();
    }
    const typeField = String(raw.type ?? '').trim();
    if (typeField && typeField !== '-') {
        if (/^\d+$/.test(typeField)) return typeField;
        const typeNum = Number(raw.type);
        if (Number.isFinite(typeNum) && typeNum > 0) {
            const asInt = Math.trunc(typeNum);
            if (asInt > 0) return String(asInt);
        }
    }
    return '';
}



/** Resolve India instrument pairid from order row, session map, or live tick lists. */
export function resolveIndiaOrderPairId(raw, { symbol = '', feedLists = [], sessionMap = null } = {}) {
    const fromRaw = extractIndiaOrderPairId(raw);
    if (fromRaw) return fromRaw;

    const map = sessionMap && typeof sessionMap === 'object' ? sessionMap : readIndiaPairIdSessionMap();
    const symCandidates = [
        symbol,
        raw?.pairname,
        raw?.pair,
        raw?.symbol,
        raw?.pairsymbol,
        raw?.pairSymbol,
    ]
        .map((s) => String(s || '').trim())
        .filter(Boolean);

    for (const sym of symCandidates) {
        const keys = [
            normalizeSymbol(sym),
            sym.replace(/[/\-\s_.:]/g, '').toUpperCase(),
        ];
        for (const k of keys) {
            const fromSession = map[k];
            if (fromSession) return String(fromSession).trim();
        }
    }

    const lists = Array.isArray(feedLists) ? feedLists : [feedLists];
    for (const sym of symCandidates) {
        const fromFeed = findIndiaPairIdInTradeList(lists, sym);
        if (fromFeed) return fromFeed;
    }

    return '';
}

/** Pairid from order row — same as OrdersPanel (`type` field holds instrument id). */
export function getIndiaPairIdFromOrderRaw(raw, { symbol = '', feedLists = [], sessionMap = null } = {}) {
    const fromExtract = extractIndiaOrderPairId(raw);
    if (fromExtract) return fromExtract;
    return resolveIndiaOrderPairId(raw, { symbol, feedLists, sessionMap });
}

/**
 * India open-order live mark: buy → bid, sell → ask (then LTP).
 * Uses per-pair WS ticks + broadcast feed only — never stale order-row liveprice.
 */

export function resolveIndiaLiveMarkPrice({
    side,
    raw,
    symbolRaw = '',
    openPrice = 0,
    feedList = [],
    ticksByPairId = {},
}) {
    const orderSymRaw = String(
        symbolRaw || raw?.pairname || raw?.pair || raw?.symbol || '',
    ).trim();
    const lists = [
        ...(Array.isArray(feedList) ? feedList : []),
        ...Object.values(ticksByPairId || {}).filter(Boolean),
    ];
    const pairId = getIndiaPairIdFromOrderRaw(raw, { symbol: orderSymRaw, feedLists: lists });
    const isBuy = String(side || '').toLowerCase() === 'buy';

    const pickMark = (quote) => {
        if (!quote) return null;
        if (isBuy) {
            return parsePositivePrice(quote.bid) ?? parsePositivePrice(quote.last);
        }
        return parsePositivePrice(quote.ask) ?? parsePositivePrice(quote.last);
    };
    if (pairId) {
        const pid = String(pairId).trim();
        const direct = ticksByPairId[pid] ?? ticksByPairId[Number(pid)];
        if (direct) {
            const mark = pickMark(getQuoteFromMarketItem(direct));
            if (mark != null) return mark;
        }
    }

    const tick = findIndiaMarketTick([lists], { symbol: orderSymRaw, pairId });
    if (tick) {
        const mark = pickMark(getQuoteFromMarketItem(tick));
        if (mark != null) return mark;
    }

    const entry = parsePositivePrice(openPrice);
    return entry ?? 0;
}

export function getQuoteFromOrderRaw(raw) {
    if (!raw || typeof raw !== 'object') return { bid: null, ask: null, last: null };
    const last = parsePositivePrice(
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

/** India mark: buy→bid / sell→ask when spread exists; else LTP so MCX-only feeds still move. */
export function resolveIndiaMarkPrice(side, bid, ask, last) {
    const isBuy = String(side).toLowerCase() === 'buy';
    const hasBid = bid != null && Number.isFinite(bid) && bid > 0;
    const hasAsk = ask != null && Number.isFinite(ask) && ask > 0;
    const hasLast = last != null && Number.isFinite(last) && last > 0;
    const hasSpread = hasBid && hasAsk && Math.abs(bid - ask) > 0;

    if (hasSpread) {
        return isBuy ? bid : ask;
    }

    if (hasLast) return last;
    if (isBuy && hasBid) return bid;
    if (!isBuy && hasAsk) return ask;
    return hasBid ? bid : hasAsk ? ask : null;
}

/** Open position mark: BUY → bid, SELL → ask (exit-side quote for P&L and close). */
export function resolveForexIndiaMarkPrice(side, bid, ask, last) {
    const isBuy = String(side).toLowerCase() === 'buy';
    if (isBuy) {
        if (bid != null && Number.isFinite(bid) && bid > 0) return bid;
    } else if (ask != null && Number.isFinite(ask) && ask > 0) {
        return ask;
    }
    return last != null && Number.isFinite(last) && last > 0 ? last : null;
}

export function resolveCryptoMarkPrice(side, bid, ask, last) {
    const isBuy = String(side).toLowerCase() === 'buy';
    if (isBuy) {
        if (bid != null && Number.isFinite(bid) && bid > 0) return bid;
    } else if (ask != null && Number.isFinite(ask) && ask > 0) {
        return ask;
    }
    return last != null && Number.isFinite(last) && last > 0 ? last : null;
}



export function resolvePositionCurrentPrice({
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
    // India: only trust WS/REST tick feeds — order-row liveprice is often stale (= entry).
    const quote = isIndia
        ? mergeQuotes(symbolQuote, pairQuote)
        : mergeQuotes(rawQuote, symbolQuote, pairQuote);
    const mark = isIndia
        ? resolveForexIndiaMarkPrice(side, quote.bid, quote.ask, quote.last)
        : String(orderMarketType || '').toLowerCase() === 'crypto'
            ? resolveCryptoMarkPrice(side, quote.bid, quote.ask, quote.last)
            : resolveForexIndiaMarkPrice(side, quote.bid, quote.ask, quote.last);
    if (mark != null && mark > 0) return mark;

    if (isIndia || String(orderMarketType || '').toLowerCase() === 'forex') {
        const entry = parsePositivePrice(openPrice);
        return entry ?? 0;
    }

    const api = parsePositivePrice(fromApiPrice);
    if (api != null) return api;

    const entry = parsePositivePrice(openPrice);
    return entry ?? 0;
}



/** Dashboard-style merged tick list (India rows keyed by pairid for live price lookup). */
export function buildAllMarketsTradesData({
    genericTicks = [],
    indiaBroadcast = [],
    indiaPairTicks = [],
    indiaTicksByPairId = {},
} = {}) {
    const byKey = new Map();

    const upsert = (key, tick) => {
        if (!key || !tick || typeof tick !== 'object') return;
        const ts = Number(tick.lastUpdate ?? tick.timestamp ?? tick.time ?? tick.T ?? 0);
        const existing = byKey.get(key);
        if (!existing || ts >= Number(existing.lastUpdate ?? 0)) {
            byKey.set(key, { ...tick, lastUpdate: ts || tick.lastUpdate || Date.now() });
        }
    };

    const addGenericTicks = (list) => {
        (Array.isArray(list) ? list : []).forEach((t) => {
            const raw =
                t?.symbol ??
                t?.pairsymbol ??
                t?.pairSymbol ??
                t?.tradingsymbol ??
                t?.tradingSymbol ??
                t?.id ??
                t?.Symbol ??
                t?.instrument ??
                t?.pair ??
                t?.market ??
                '';

            const key = normalizeSymbol(raw);
            if (key) upsert(key, t);
        });
    };

    const addIndiaTicks = (list) => {
        (Array.isArray(list) ? list : []).forEach((t) => {
            const pid = indiaTickPairId(t);
            const sym = indiaTickSymbolKey(t);
            const enriched = pid ? { ...t, pairid: pid, pairId: pid } : t;
            if (pid) upsert(`india:${pid}`, enriched);
            if (sym) upsert(`india:${sym}`, enriched);
            const pairSymbol = t?.pairsymbol ?? t?.pairSymbol ?? t?.tradingsymbol ?? t?.tradingSymbol ?? '';
            if (pairSymbol) {
                upsert(normalizeSymbol(pairSymbol), enriched);
                if (String(pairSymbol).includes(':')) {
                    const afterColon = String(pairSymbol).split(':').slice(1).join(':').trim();
                    if (afterColon) upsert(normalizeSymbol(afterColon), enriched);
                }
            }
        });
    };


    addGenericTicks(genericTicks);
    addIndiaTicks(indiaBroadcast);
    addIndiaTicks(indiaPairTicks);
    Object.entries(indiaTicksByPairId || {}).forEach(([pid, tick]) => {
        if (!tick || typeof tick !== 'object') return;
        addIndiaTicks([{ ...tick, pairid: pid, pairId: pid }]);
    });

    return Array.from(byKey.values());
}

/** OrdersPanel-style strict symbol → quote map. */
export function buildStrictSymbolToQuoteMap(list = []) {
    const map = new Map();
    const setQuote = (key, quote) => {
        if (!key || !quote) return;
        if (quote.bid == null && quote.ask == null && quote.last == null) return;
        map.set(key, quote);
    };
    (Array.isArray(list) ? list : []).forEach((item) => {
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
        setQuote(key, quote);

        const symKey = indiaTickSymbolKey(item);
        if (symKey) setQuote(symKey, quote);

        const pairSymbol = item?.pairsymbol ?? item?.pairSymbol ?? item?.tradingsymbol ?? item?.tradingSymbol;
        if (pairSymbol) {
            setQuote(normalizeSymbol(pairSymbol), quote);
            if (String(pairSymbol).includes(':')) {
                const afterColon = String(pairSymbol).split(':').slice(1).join(':').trim();
                if (afterColon) setQuote(normalizeSymbol(afterColon), quote);
            }
        }

        const pairId = indiaTickPairId(item);
        if (pairId) setQuote(`india:${pairId}`, quote);
    });

    return map;
}

export function resolveIndiaFeedQuote({
    raw,
    symbol,
    pairId,
    marketDataList,
    marketData,
    symbolToQuoteMap,
    indiaDirectTick = null,
}) {
    const orderSymRaw = String(raw?.pairname ?? raw?.pair ?? raw?.symbol ?? symbol ?? '').trim();

    if (indiaDirectTick && typeof indiaDirectTick === 'object') {
        return getQuoteFromMarketItem(indiaDirectTick);
    }

    const lists = [];
    if (Array.isArray(marketDataList)) lists.push(marketDataList);
    if (marketData) lists.push(marketData);

    if (lists.length > 0) {
        const liveTick = findIndiaMarketTick(lists, { symbol: orderSymRaw, pairId });
        if (liveTick) {
            return getQuoteFromMarketItem(liveTick);
        }
    }

    const symKey = normalizeSymbol(symbol);
    let quote = symKey ? symbolToQuoteMap.get(symKey) ?? null : null;

    if (!quote && orderSymRaw.includes(':')) {
        const afterColon = orderSymRaw.split(':').slice(1).join(':').trim();
        if (afterColon) {
            quote = symbolToQuoteMap.get(normalizeSymbol(afterColon)) ?? quote;
        }
    }

    const symFromTickKey = indiaTickSymbolKey({ pairsymbol: orderSymRaw, symbol: orderSymRaw });
    if (!quote && symFromTickKey) {
        quote = symbolToQuoteMap.get(symFromTickKey) ?? quote;
    }

    if (pairId) {
        quote = symbolToQuoteMap.get(`india:${pairId}`) ?? quote;
    }

    return quote;
}


/** Build symbol → { bid, ask, last } map from live market feed rows. */
export function buildSymbolToQuoteMap(list = []) {
    const map = new Map();
    const setQuote = (key, quote) => {
        if (!key || !quote) return;
        if (quote.bid == null && quote.ask == null && quote.last == null) return;
        map.set(key, quote);
    };

    (Array.isArray(list) ? list : []).forEach((item) => {
        const quote = getQuoteFromMarketItem(item);
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
        setQuote(key, quote);

        const symKey = indiaTickSymbolKey(item);
        if (symKey) setQuote(symKey, quote);




        const pairSymbol = item?.pairsymbol ?? item?.pairSymbol ?? item?.tradingsymbol ?? item?.tradingSymbol;
        if (pairSymbol) {
            setQuote(normalizeSymbol(pairSymbol), quote);
            if (String(pairSymbol).includes(':')) {
                const afterColon = String(pairSymbol).split(':').slice(1).join(':').trim();
                if (afterColon) setQuote(normalizeSymbol(afterColon), quote);
            }
        }

        const pairId = indiaTickPairId(item);
        if (pairId) setQuote(`india:${pairId}`, quote);
    });

    return map;
}


/**
 * Resolve display / close price for an order row.
 * Buy → bid, Sell → ask when feed quotes are available.
 */
export function resolveCurrentPriceFromFeeds({
    side,
    symbol,
    orderMarketType,
    raw,
    openPrice,
    symbolToQuoteMap,
    marketDataLists = [],
    pairQuote = null,
    fromApiPrice = null,
    indiaDirectTick = null,
    indiaTicksByPairId = null,
}) {
    const orderSymRaw = String(raw?.pairname ?? raw?.pair ?? raw?.symbol ?? symbol ?? '').trim();
    const symKey = normalizeSymbol(orderSymRaw || symbol);
    const isIndia = String(orderMarketType || '').toLowerCase() === 'india';
    const flatFeedLists = (Array.isArray(marketDataLists) ? marketDataLists : []).flat();
    const directTicks = indiaTicksByPairId && typeof indiaTicksByPairId === 'object'
        ? Object.values(indiaTicksByPairId).filter(Boolean)
        : [];
    const combinedFeeds = directTicks.length > 0 ? [...flatFeedLists, directTicks] : flatFeedLists;

    const pairId = isIndia
        ? resolveIndiaOrderPairId(raw, { symbol: orderSymRaw, feedLists: combinedFeeds })
        : '';

    const directTick =
        indiaDirectTick ??
        (pairId && indiaTicksByPairId?.[pairId] ? indiaTicksByPairId[pairId] : null);

    let symbolQuote = null;
    if (isIndia) {
        symbolQuote = resolveIndiaFeedQuote({
            raw,
            symbol: orderSymRaw || symbol,
            pairId,
            marketDataList: combinedFeeds.length > 0 ? [combinedFeeds] : marketDataLists,
            marketData: null,
            symbolToQuoteMap,
            indiaDirectTick: directTick,
        });
    } else {
        symbolQuote = symKey ? symbolToQuoteMap.get(symKey) ?? null : null;
    }

    const skipApiFallback = String(orderMarketType || '').toLowerCase() === 'forex';

    return resolvePositionCurrentPrice({ side, orderMarketType, raw, symbolQuote, pairQuote, fromApiPrice: skipApiFallback || isIndia ? null : fromApiPrice, openPrice, });
}

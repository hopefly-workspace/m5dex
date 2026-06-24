import { indiaFuzzySymbolMatch, normalizeIndiaMarketText } from '../utils/indiaPairResolve';

const normalizeMarketSymbol = (value) =>
    String(value || '').toUpperCase().trim().replace(/[/\-\s_.:]/g, '');

let cache = [];
let loaded = false;
let loadingPromise = null;

function normalizeStockItem(item) {
    if (!item || typeof item !== 'object') return null;
    const pairsymbol = String(item.pairsymbol || '').trim();
    const pairname = String(item.pairname || '').trim();
    if (!pairsymbol && !pairname) return null;
    return {
        pairid: String(item.pairid || '').trim(),
        pairsymbol,
        pairname,
        exchange: String(item.exchange || '').trim(),
        segment: String(item.segment || '').trim(),
        instrumentType: String(item.instrumentType || '').trim(),
    };
}

/** Synchronous read of cached stock list (empty until fetchIndiaStockList completes). */
export function getCachedIndiaStockList() {
    return loaded && Array.isArray(cache) ? cache : [];
}

/** Find one stock-list row by pairid and/or symbol. */
export function findIndiaStockItemInStockList(stockList, { symbol = '', pairId = '' } = {}) {
    const pairIdKey = String(pairId || '').trim();
    if (pairIdKey) {
        const byId = (stockList || []).find(
            (item) => String(item?.pairid || '').trim() === pairIdKey
        );
        if (byId) return byId;
    }

    const targets = indiaSymbolLookupTargets(symbol);
    if (!targets.length) return null;

    for (const item of stockList || []) {
        const pairSymbol = normalizeMarketSymbol(item?.pairsymbol);
        if (pairSymbol && targets.includes(pairSymbol)) return item;
    }

    for (const target of targets) {
        const targetFlat = normalizeIndiaMarketText(target);
        for (const item of stockList || []) {
            const pairSymbol = normalizeMarketSymbol(item?.pairsymbol);
            const flat = normalizeIndiaMarketText(pairSymbol);
            if (flat && indiaFuzzySymbolMatch(targetFlat, flat)) return item;
        }
    }

    return null;
}

/** Fetch /trading/stocklist once (cached). */
export async function fetchIndiaStockList({ force = false } = {}) {
    if (loaded && !force) return cache;
    if (loadingPromise && !force) return loadingPromise;

    loadingPromise = (async () => {
        try {
            const baseUrl = import.meta.env.VITE_BACKEND_URL || 'http://192.168.0.109:3000/v1';
            const url = `${baseUrl.replace(/\/+$/, '')}/trading/stocklist`;
            const res = await fetch(url);
            const json = await res.json().catch(() => null);
            const list = Array.isArray(json?.data) ? json.data : [];
            cache = list.map(normalizeStockItem).filter(Boolean);
            loaded = true;
            return cache;
        } catch {
            cache = [];
            loaded = true;
            return [];
        } finally {
            loadingPromise = null;
        }
    })();

    return loadingPromise;
}

/** Resolve symbol targets for stock-list lookup (handles MCX: prefix). */
export function indiaSymbolLookupTargets(symbol) {
    const raw = String(symbol || '').trim();
    if (!raw) return [];
    const targets = [normalizeMarketSymbol(raw)];
    if (raw.includes(':')) {
        const afterColon = raw.split(':').slice(1).join(':').trim();
        if (afterColon) targets.push(normalizeMarketSymbol(afterColon));
    }
    return Array.from(new Set(targets)).filter(Boolean);
}

/** Find pairid in stock list (exact then fuzzy F&O match). */
export function findIndiaPairIdInStockList(stockList, symbol) {
    const targets = indiaSymbolLookupTargets(symbol);
    if (!targets.length) return '';

    for (const item of stockList || []) {
        const pairSymbol = normalizeMarketSymbol(item?.pairsymbol);
        if (pairSymbol && targets.includes(pairSymbol)) {
            return String(item.pairid || '').trim();
        }
    }

    for (const target of targets) {
        const targetFlat = normalizeIndiaMarketText(target);
        for (const item of stockList || []) {
            const pairSymbol = normalizeMarketSymbol(item?.pairsymbol);
            const flat = normalizeIndiaMarketText(pairSymbol);
            if (flat && indiaFuzzySymbolMatch(targetFlat, flat)) {
                return String(item.pairid || '').trim();
            }
        }
    }
    return '';
}

/** Resolve pairid for a dashboard / favourite symbol. */
export async function resolveIndiaPairIdForSymbol(symbol) {
    const raw = String(symbol || '').trim();
    if (!raw) return '';

    let list = loaded ? cache : await fetchIndiaStockList();
    let pairId = findIndiaPairIdInStockList(list, raw);
    if (pairId) return pairId;

    if (loaded) {
        list = await fetchIndiaStockList({ force: true });
        pairId = findIndiaPairIdInStockList(list, raw);
    }
    return pairId || '';
}
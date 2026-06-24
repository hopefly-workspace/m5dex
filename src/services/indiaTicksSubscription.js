import { parseIndiaFavouriteName } from '../services/favouritesWishlistApi';
import { tokenStorage } from '../utils/storage';

const INDIA_PAIRID_NAV_STATE_KEY = 'dashboard:indiaPairIdByMarket';
const INDIA_EXCHANGE_NAV_STATE_KEY = 'dashboard:indiaExchangeByMarket';

function normalizeIndiaSessionSymbol(symbol) {
    return String(symbol || '')
        .trim()
        .replace(/[/\-\s_.:]/g, '')
        .toUpperCase();
}

/** Numeric pairid from favourite row (name `SYM_id`, fullName, or session map). */
export function extractIndiaFavouritePairId(item, sessionMap = null) {
    if (!item) return '';
    const parsed = parseIndiaFavouriteName(item.name || '');
    if (parsed.pairId) return String(parsed.pairId).trim();

    const nameOnly = String(parsed.symbol || item.name || '').trim();
    if (/^\d+$/.test(nameOnly)) return nameOnly;

    const full = String(item.fullName || '').trim();
    if (/^\d+$/.test(full)) return full;

    const sym = String(parsed.symbol || item.name || '').trim();
    if (sym && sessionMap && typeof sessionMap === 'object') {
        const fromSession = sessionMap[sym.replace(/[/\-\s_.]/g, '').toUpperCase()];
        if (fromSession) return String(fromSession).trim();
    }
    return '';
}

export function readIndiaPairIdSessionMap() {
    try {
        const raw = sessionStorage.getItem(INDIA_PAIRID_NAV_STATE_KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}

export function writeIndiaPairIdToSession(symbol, pairId) {
    const sym = normalizeIndiaSessionSymbol(symbol);
    const pid = String(pairId || '').trim();
    if (!sym || !pid) return;
    try {
        const map = readIndiaPairIdSessionMap();
        map[sym] = pid;
        sessionStorage.setItem(INDIA_PAIRID_NAV_STATE_KEY, JSON.stringify(map));
    } catch {
        /* ignore */
    }
}

export function readIndiaExchangeSessionMap() {
    try {
        const raw = sessionStorage.getItem(INDIA_EXCHANGE_NAV_STATE_KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}

export function readIndiaExchangeFromSession(symbol) {
    const sym = normalizeIndiaSessionSymbol(symbol);
    if (!sym) return '';
    const map = readIndiaExchangeSessionMap();
    return String(map[sym] || '').trim();
}

export function writeIndiaExchangeToSession(symbol, exchange) {
    const sym = normalizeIndiaSessionSymbol(symbol);
    const ex = String(exchange || '').trim();
    if (!sym || !ex) return;
    try {
        const map = readIndiaExchangeSessionMap();
        map[sym] = ex;
        sessionStorage.setItem(INDIA_EXCHANGE_NAV_STATE_KEY, JSON.stringify(map));
    } catch {
        /* ignore */
    }
}

/** Collect unique India instrument pairids from favourites (+ optional extras). */
export function collectIndiaPairIdsFromLists(lists, extraPairIds = []) {
    const sessionMap = readIndiaPairIdSessionMap();
    const out = new Set();

    const add = (id) => {
        const s = String(id || '').trim();
        if (s) out.add(s);
    };

    for (const id of extraPairIds) add(id);

    for (const list of lists) {
        if (!Array.isArray(list)) continue;
        for (const item of list) {
            if (String(item?.type || '').trim().toLowerCase() !== 'india') continue;
            add(extractIndiaFavouritePairId(item, sessionMap));
        }
    }

    return out;
}

/** Resolve ticks REST base from env (falls back to India WS host). */
export function resolveIndiaTicksBackendUrl() {
    const explicit = import.meta.env.VITE_TICKS_BACKEND_URL;
    if (explicit) return String(explicit).replace(/\/+$/, '');
    const ws = String(import.meta.env.VITE_WS_INDIA_URL || '').trim();
    if (!ws) return '';
    try {
        const normalized = ws.replace(/^wss:/i, 'https:').replace(/^ws:/i, 'http:');
        const u = new URL(normalized);
        return `${u.protocol}//${u.host}`;
    } catch {
        return '';
    }
}

/**
 * POST /subscriptions/subscribe — backend starts streaming ticks on /ws/subscribed.
 * @param {string[]|string} pairIds
 */
export async function subscribeIndiaPairIds(pairIds) {
    const symbols = (Array.isArray(pairIds) ? pairIds : [pairIds])
        .map((id) => String(id || '').trim())
        .filter(Boolean);
    const unique = Array.from(new Set(symbols));
    if (unique.length === 0) return { ok: true, subscribed: [] };

    const token = tokenStorage.getToken();
    if (!token) throw new Error('Please login to subscribe to market data.');

    const baseUrl = resolveIndiaTicksBackendUrl();
    if (!baseUrl) throw new Error('India ticks backend URL is not configured');

    const url = `${baseUrl.replace(/\/+$/, '')}/subscriptions/subscribe`;
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ symbols: unique }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || data?.status === false) {
        throw new Error(data?.message || 'Failed to subscribe India market ticks');
    }
    return { ok: true, subscribed: unique };
}

/** Append auth token to India ticks WebSocket URL when required by backend. */
export function appendIndiaWsToken(url) {
    if (!url) return url;
    const token = tokenStorage.getToken();
    if (!token || String(url).includes('token=')) return url;
    const u = String(url);
    return `${u}${u.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`;
}

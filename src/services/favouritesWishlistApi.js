/**
 * Favourites & Watchlist API
 * - GET /users/favouritelist, GET /users/wishlist
 * - POST /users/addfavourite, /users/removefavourite
 *   - india: { type: "india", ids: [{ id, name }, ...] } (single or bulk)
 *   - other: { name, type }
 * - POST /users/addwishlist, /users/removewishlist { name, type }
 *
 * Favouritelist response item shape:
 * { name, type, ondate?, isfavourite?, update_date?, ... }
 * e.g. { name: "btcusdt", type: "crypto", ondate: "...", isfavourite: true }
 */

import { api } from './api';

/** Normalize symbol to match market keys (e.g. btcusdt → BTCUSDT, BTC/USDT → BTCUSDT) */
export const normalizeSymbol = (s) => {
  if (s == null || s === '') return '';
  return String(s).toUpperCase().trim().replace(/[/\-\s_.]/g, '');
};

/**
 * India favourites can be stored as "pairSymbol_pairid".
 * Returns both parts while keeping backward compatibility with plain symbol names.
 */
export const parseIndiaFavouriteName = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return { symbol: '', pairId: '' };
  const idx = raw.lastIndexOf('_');
  if (idx <= 0 || idx >= raw.length - 1) {
    return { symbol: raw, pairId: '' };
  }
  return {
    symbol: raw.slice(0, idx).trim(),
    pairId: raw.slice(idx + 1).trim(),
  };
};

const normalizeItem = (item) => {
  if (!item || typeof item !== 'object') return null;
  if (item.isfavourite === false) return null;
  const rawName = item.name ?? item.symbol ?? item.id ?? item.pair ?? '';
  const name = String(rawName).trim();
  if (!name) return null;
  const type = item.type ?? item.marketType ?? item.market_type ?? 'crypto';
  const fullName = item.fullname ?? item.pairSymbol ?? item.pairid ?? item.pairId ?? '';
  return { name, type: String(type).trim().toLowerCase(), fullName };
};

/**
 * Normalize india favourite entries for add/remove API.
 * Accepts a single entry, an array, or legacy "SYMBOL_pairId" string.
 */
export const normalizeIndiaFavouriteIds = (entries) => {
  const list = Array.isArray(entries) ? entries : entries != null ? [entries] : [];
  const out = [];
  const seen = new Set();

  for (const entry of list) {
    if (entry == null) continue;

    let id = '';
    let name = '';

    if (typeof entry === 'string') {
      const parsed = parseIndiaFavouriteName(entry);
      id = parsed.pairId;
      name = parsed.symbol;
    } else if (typeof entry === 'object') {
      id = String(entry?.id ?? entry?.pairId ?? '').trim();
      name = String(entry?.name ?? entry?.symbol ?? '').trim();
    }

    if (!id || !name) continue;
    const key = `${id}|${normalizeSymbol(name)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ id, name });
  }

  return out;
};

export const addFavourite = async (name, type) => {
  const trimmedType = String(type || 'crypto').trim().toLowerCase();
  if (trimmedType === 'india') {
    const ids = normalizeIndiaFavouriteIds(name);
    if (!ids.length) {
      throw new Error('Invalid favourite: id and name are required for india type');
    }
    return api.post('/users/addfavourite', { type: 'india', ids });
  }
  return api.post('/users/addfavourite', {
    name: String(name).trim(),
    type: trimmedType,
  });
};

export const removeFavourite = async (name, type) => {
  const trimmedType = String(type || 'crypto').trim().toLowerCase();
  if (trimmedType === 'india') {
    const ids = normalizeIndiaFavouriteIds(name);
    if (!ids.length) {
      throw new Error('Invalid favourite: id and name are required for india type');
    }
    return api.post('/users/removefavourite', { type: 'india', ids });
  }
  return api.post('/users/removefavourite', {
    name: String(name).trim(),
    type: trimmedType,
  });
};

export const addWishlist = async (name, type) => {
  const res = await api.post('/users/addwishlist', { name: String(name).trim(), type: String(type || 'crypto').trim() });
  return res;
};

export const removeWishlist = async (name, type) => {
  const res = await api.post('/users/removewishlist', { name: String(name).trim(), type: String(type || 'crypto').trim() });
  return res;
};

/** Returns [{ name, type }, ...] from GET /users/favouritelist */
export const getFavourites = async () => {
  try {
    const res = await api.get('/users/favouritelist');
    const raw = res?.devices ?? res?.data ?? res?.list ?? (Array.isArray(res) ? res : []);
    const list = Array.isArray(raw) ? raw : [];
    return list.map(normalizeItem).filter((x) => x && x.name);
  } catch (e) {
    if (e?.status === 404 || e?.status === 204) return [];
    throw e;
  }
};

/** Returns [{ name, type }, ...] from GET /users/wishlist */
export const getWishlist = async () => {
  try {
    // const res = await api.get('/users/wishlist');
    // const raw = res?.data ?? res?.wishlist ?? res?.list ?? (Array.isArray(res) ? res : []);
    // const list = Array.isArray(raw) ? raw : [];
    // return list.map(normalizeItem).filter((x) => x && x.name);
    return []
  } catch (e) {
    if (e?.status === 404 || e?.status === 204) return [];
    throw e;
  }
};

export function itemKey(name, type) {
  return `${String(name || '').trim()}|${String(type || 'crypto').trim()}`;
}

/** API / legacy values that map to the Forex segment in the app (includes metals & commodities). */
export const FOREX_GROUP_TYPES = Object.freeze(['forex', 'metals', 'commodities', 'indices']);

export function isForexGroupType(type) {
  const t = String(type || '').toLowerCase().trim();
  return FOREX_GROUP_TYPES.includes(t);
}

/**
 * Dashboard URL `type` → crypto | forex | india (invalid → null).
 * Legacy bookmarks with type=metals|commodities|indices normalize to forex.
 */
export function normalizeAppMarketTypeParam(raw) {
  if (raw == null) return null;
  const t = String(raw).trim().toLowerCase();
  if (!t) return null;
  if (t === 'indian') return 'india';
  if (isForexGroupType(t)) return 'forex';
  if (t === 'crypto') return 'crypto';
  if (t === 'india') return 'india';
  return null;
}

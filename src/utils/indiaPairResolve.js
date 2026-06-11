import { normalizeSymbol } from '../services/favouritesWishlistApi';

/** Normalized symbol key from an India tick / market row. */
export function indiaTickSymbolKey(tick) {
  if (!tick || typeof tick !== 'object') return '';
  return normalizeSymbol(
    tick.symbol ||
      tick.pairSymbol ||
      tick.pairsymbol ||
      tick.id ||
      tick.instrument ||
      tick.market ||
      ''
  );
}

/** Numeric instrument id from tick row. */
export function indiaTickPairId(tick) {
  if (!tick || typeof tick !== 'object') return '';
  return String(
    tick.pairid ?? tick.pairId ?? tick.instrument_token ?? tick.instrumentToken ?? ''
  ).trim();
}

/** Human-readable symbol from dashboard `market` param (strips NFO: prefix). */
export function getIndiaDisplaySymbol(pair) {
  const raw = String(pair ?? '').trim();
  if (!raw) return '';
  if (raw.includes(':')) {
    const rest = raw.split(':').slice(1).join(':').trim();
    return rest || raw;
  }
  return raw;
}

/** Find pairid for a symbol in one or more trade lists (live WS snapshots). */
export function findIndiaPairIdInTradeList(lists, symbol) {
  const want = normalizeSymbol(symbol);
  if (!want) return '';
  const arrays = Array.isArray(lists) ? lists : [lists];
  for (const list of arrays) {
    if (!Array.isArray(list)) continue;
    for (const t of list) {
      if (indiaTickSymbolKey(t) === want) {
        const pid = indiaTickPairId(t);
        if (pid) return pid;
      }
    }
  }
  return '';
}

/** True when tick row belongs to the selected `pair` string. */
export function indiaTickMatchesPair(tick, pair) {
  const want = normalizeSymbol(pair);
  if (!want || !tick) return false;
  return indiaTickSymbolKey(tick) === want;
}

/** Compare API pairsymbol with selected dashboard pair (fuzzy for F&O names). */
export function indiaApiSymbolMatchesPair(pairsymbol, pair) {
  const apiKey = normalizeSymbol(
    String(pairsymbol || '').includes(':')
      ? String(pairsymbol).split(':').slice(1).join(':')
      : pairsymbol
  );
  const want = normalizeSymbol(pair);
  if (!apiKey || !want) return true;
  return apiKey === want || apiKey.includes(want) || want.includes(apiKey);
}

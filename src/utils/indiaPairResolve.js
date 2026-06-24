import { normalizeSymbol } from '../services/favouritesWishlistApi';
import { readIndiaExchangeFromSession } from '../services/indiaTicksSubscription';

/** Normalized symbol key from an India tick / market row. */
export function indiaTickSymbolKey(tick) {
  if (!tick || typeof tick !== 'object') return '';
  // return normalizeSymbol(
  //   tick.symbol ||

  const sym = tick.symbol || tick.Symbol || '';
  const symLooksNumeric =
    sym != null && sym !== '' && /^\d+$/.test(String(sym).trim());
  const raw = symLooksNumeric
    ? tick.pairsymbol ||
    tick.pairSymbol ||
    tick.tradingsymbol ||
    tick.tradingSymbol ||
    tick.instrument ||
    tick.market ||
    sym
    : sym ||
    tick.pairSymbol ||
    tick.pairsymbol ||
    tick.tradingsymbol ||
    tick.tradingSymbol ||
    tick.id ||
    tick.instrument ||
    tick.market ||
    // ''
    // );
    '';
  return normalizeSymbol(raw);
}

const KNOWN_INDIA_EXCHANGES = /^(MCX|NFO|NSE|BSE|CDS|BCD|NCDEX)$/i;

/** Resolve exchange code (MCX, NFO, NSE, …) for Indian order API payloads. */
export function resolveIndiaOrderExchange({
  exchange = '',
  symbol = '',
  pairId = '',
  raw = null,
} = {}) {
  const explicit = String(exchange || '').trim();
  if (explicit && KNOWN_INDIA_EXCHANGES.test(explicit)) return explicit.toUpperCase();

  const r = raw && typeof raw === 'object' ? raw : {};
  const fromRaw = String(
    r.exchange ?? r.Exchange ?? r.exch ?? r.marketExchange ?? r.market_exchange ?? ''
  ).trim();
  if (fromRaw && KNOWN_INDIA_EXCHANGES.test(fromRaw)) return fromRaw.toUpperCase();

  const symCandidates = [
    symbol,
    r.pairname,
    r.pair,
    r.symbol,
    r.pairsymbol,
    r.pairSymbol,
  ].filter(Boolean);

  for (const sym of symCandidates) {
    const s = String(sym).trim();
    if (s.includes(':')) {
      const prefix = s.split(':')[0].trim();
      if (KNOWN_INDIA_EXCHANGES.test(prefix)) return prefix.toUpperCase();
    }
  }

  const sessionSymbol = String(symbol || symCandidates[0] || '').trim();
  const fromSession = readIndiaExchangeFromSession(sessionSymbol);
  if (fromSession) return fromSession.toUpperCase();

  const seg = String(r.segment ?? r.marketSegment ?? '').trim().toUpperCase();
  if (seg.startsWith('MCX')) return 'MCX';
  if (seg.startsWith('NFO')) return 'NFO';

  return '';
}

export function isIndianTradingApiType(type) {
  const t = String(type || '').trim().toUpperCase();
  return t === 'INDIA' || t === 'INDIAN' || t === 'INDIAN_FO';
}

/** Exchange code from India tick / market row (MCX, NSE, NFO, …). */
export function indiaTickExchange(tick) {
  if (!tick || typeof tick !== 'object') return '';
  const fromField = String(
    tick.exchange || tick.Exchange || tick.exch || tick.marketExchange || ''
  ).trim();
  if (fromField) return fromField;
  const sym = String(
    tick.symbol || tick.Symbol || tick.pairsymbol || tick.pairSymbol || ''
  ).trim();
  if (sym.includes(':')) return sym.split(':')[0].trim();
  return '';
}

/** True when instrument belongs to MCX (commodities) session, not NSE cash/F&O. */
export function isIndiaMcxInstrument({ marketPairRaw = '', exchange = '', segment = '' } = {}) {
  const raw = String(marketPairRaw || '').trim().toUpperCase();
  if (raw.startsWith('MCX:') || raw.includes('MCX:')) return true;
  const ex = String(exchange || '').trim().toUpperCase();
  if (ex === 'MCX') return true;
  const seg = String(segment || '').trim().toUpperCase();
  if (seg.startsWith('MCX')) return true;
  return false;
}

/** Numeric instrument id from tick row. */
export function indiaTickPairId(tick) {
  if (!tick || typeof tick !== 'object') return '';
  return String(
    // tick.pairid ?? tick.pairId ?? tick.instrument_token ?? tick.instrumentToken ?? ''
    tick.pairid ?? tick.pairId ?? tick.instrument_token ?? tick.instrumentToken ?? tick.token ?? ''
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
// export function findIndiaPairIdInTradeList(lists, symbol) {
// const want = normalizeSymbol(symbol);
// if (!want) return '';
export function normalizeIndiaMarketText(value) {
  return String(value || '')
    .toUpperCase()
    .trim()
    .replace(/[:/\-\s_.]/g, '');
}

function indiaBaseAndMonth(flat) {
  const stripped = String(flat || '').replace(/^MCX/i, '');
  const base = (stripped.match(/^[A-Z]+/) || [])[0] || '';
  const month = (stripped.match(/JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC/i) || [])[0] || '';
  return { base, month: month ? month.toUpperCase() : '' };
}

export function indiaFuzzySymbolMatch(wantFlat, tickFlat) {
  if (!wantFlat || !tickFlat) return false;
  if (wantFlat === tickFlat) return true;
  if (tickFlat.includes(wantFlat) || wantFlat.includes(tickFlat)) return true;
  const a = indiaBaseAndMonth(wantFlat);
  const b = indiaBaseAndMonth(tickFlat);
  return Boolean(a.base && b.base && a.base === b.base && a.month && b.month && a.month === b.month);
}

/**
 * Find one India tick row for dashboard / sidebar / orders (pairid first, then symbol).
 * @param {Array|Array[]} lists
 * @param {{ symbol?: string, pairId?: string }} opts
 */

export function findIndiaMarketTick(lists, { symbol = '', pairId = '' } = {}) {
  const arrays = Array.isArray(lists) ? lists : [lists];
  // for (const list of arrays) {
  //   if (!Array.isArray(list)) continue;
  //   for (const t of list) {
  //     if (indiaTickSymbolKey(t) === want) {
  //       const pid = indiaTickPairId(t);
  //       if (pid) return pid;
  //     }
  //   }
  // }
  const merged = arrays.filter(Array.isArray).flat();
  if (!merged.length) return null;

  const pairIdKey = String(pairId || '').trim().toLowerCase();
  if (pairIdKey) {
    const byPairId = merged.find((t) => {
      const candidates = [
        t?.pairid,
        t?.pairId,
        t?.instrument_token,
        t?.instrumentToken,
        t?.token,
        t?.id,
      ];
      return candidates.some((v) => String(v ?? '').trim().toLowerCase() === pairIdKey);
    });
    if (byPairId) return byPairId;
  }
  // return '';

  const indiaKey = normalizeSymbol(symbol);
  const indiaFlat = normalizeIndiaMarketText(symbol);
  if (!indiaKey && !indiaFlat) return null;

  for (const t of merged) {
    if (indiaKey && indiaTickSymbolKey(t) === indiaKey) return t;

    const raw =
      t?.pairsymbol ||
      t?.pairSymbol ||
      t?.tradingsymbol ||
      t?.tradingSymbol ||
      t?.symbol ||
      t?.id ||
      t?.Symbol ||
      t?.instrument ||
      t?.pair ||
      t?.market ||
      '';

    const afterColon = String(raw).includes(':')
      ? String(raw).split(':').slice(1).join(':').trim()
      : raw;
    if (indiaKey && normalizeSymbol(afterColon) === indiaKey) return t;
    if (indiaFlat && normalizeIndiaMarketText(raw) === indiaFlat) return t;

    const labelFlat = normalizeIndiaMarketText(t?.name || t?.base || t?.description || '');
    if (labelFlat && indiaFuzzySymbolMatch(indiaFlat, labelFlat)) return t;
    if (indiaFlat && indiaFuzzySymbolMatch(indiaFlat, normalizeIndiaMarketText(afterColon))) return t;
  }

  return null;
}

/** True when tick row belongs to the selected `pair` string. */
// export function indiaTickMatchesPair(tick, pair) {
// const want = normalizeSymbol(pair);
// if (!want || !tick) return false;
// return indiaTickSymbolKey(tick) === want;

/** Find pairid for a symbol in one or more trade lists (live WS snapshots). */
export function findIndiaPairIdInTradeList(lists, symbol) {
  const tick = findIndiaMarketTick(lists, { symbol });
  return tick ? indiaTickPairId(tick) : '';
}

/** True when tick row belongs to the selected `pair` string (and optional pairid). */
export function indiaTickMatchesPair(tick, pair, pairId = '') {
  if (!tick || !pair) return false;
  const found = findIndiaMarketTick([tick], { symbol: pair, pairId });
  return found != null;

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
  // return apiKey === want || apiKey.includes(want) || want.includes(apiKey);
  if (apiKey === want || apiKey.includes(want) || want.includes(apiKey)) return true;

  const { base: baseApi, month: monthApi } = indiaBaseAndMonth(normalizeIndiaMarketText(apiKey));
  const { base: baseWant, month: monthWant } = indiaBaseAndMonth(normalizeIndiaMarketText(want));
  if (baseApi && baseWant && baseApi === baseWant && monthApi && monthWant && monthApi === monthWant) {
    return true;
  }

  return false;
}

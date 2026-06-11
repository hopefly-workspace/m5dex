export function getBaseSymbol(pair, quote = "USDT") {
  const match = pair.match(new RegExp(`^[A-Z]+(?=${quote})`));
  return match ? match[0] : null;
}

/** Format number with fixed decimal places (e.g. for display). */
export function formatNumber(num, decimals = 4) {
  const value = parseFloat(num);
  if (Number.isNaN(value)) return '';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/** Safe numeric value; returns default if invalid. */
export function getSafeNumber(value, defaultValue = 0) {
  const num = parseFloat(value);
  return Number.isNaN(num) || num == null ? defaultValue : num;
}

/** Alias for getSafeNumber with default null (for optional numbers). */
export function getNum(v, def = null) {
  if (v == null) return def;
  const n = Number(v);
  return Number.isNaN(n) ? def : n;
}

/** Decimals by magnitude: 96500 → 0–2, 1.5 → 2–4, 0.012 → 4, etc. */
export function decimalsForValue(num) {
  const v = Math.abs(parseFloat(num));
  if (Number.isNaN(v) || v === 0) return 2;
  if (v >= 10000) return 0;
  if (v >= 1) return 2;
  if (v >= 0.01) return 4;
  if (v >= 0.0001) return 6;
  if (v >= 0.000001) return 8;
  return 8;
}

/**
 * Industry-style decimal places for PRICE display by market type and price magnitude.
 * Forex: 5 decimals (pip), JPY-like (price >= 100) 2–3; Crypto: by magnitude; Indices/Metals/India: 2.
 * @param {number} price - Price value
 * @param {string} [marketType] - 'crypto' | 'forex' | 'indices' | 'metals' | 'india' | 'commodities'
 * @returns {number} Suggested number of decimal places
 */
export function getPriceDecimals(price, marketType = '') {
  const v = Math.abs(parseFloat(price));
  let type = String(marketType || '').toLowerCase().trim();
  if (type === 'indices' || type === 'metals' || type === 'commodities') type = 'forex';

  if (Number.isNaN(v)) return 2;

  switch (type) {
    case 'forex':
      if (v >= 100) return 3;
      if (v >= 10) return 4;
      return 5;
    case 'india':
      return 3;
    case 'crypto':
    default:
      if (v >= 100000) return 0;
      if (v >= 10000) return 2;
      if (v >= 100) return 3;
      if (v >= 1) return 4;
      if (v >= 0.01) return 7;
      if (v >= 0.0001) return 8;
      if (v >= 0.000001) return 9;
      return 9;
  }
}

/**
 * Format price with dynamic decimals (market-type and magnitude aware). Use everywhere prices are shown.
 * @param {number} value - Price to format
 * @param {Object} [options]
 * @param {string} [options.marketType] - 'crypto' | 'forex' | 'indices' | 'metals' | 'india'
 * @param {string} [options.prefix] - e.g. '$'
 * @param {string} [options.suffix] - e.g. ' USDT'
 * @param {string} [options.defaultValue] - When value is invalid
 * @returns {string}
 */
export function formatPrice(value, options = {}) {
  const { marketType = '', prefix = '', suffix = '', defaultValue = '0.00' } = options;
  const num = parseFloat(value);
  if (Number.isNaN(num) || value == null) return defaultValue;
  const decimals = getPriceDecimals(num, marketType);
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
  return `${prefix}${formatted}${suffix}`;
}

/** Format number with dynamic decimals (for prices/changes). Uses generic magnitude; for prices prefer formatPrice with marketType. */
export function formatDynamic(num, defaultValue = '0.00') {
  const value = parseFloat(num);
  if (Number.isNaN(value) || value == null) return defaultValue;
  const d = decimalsForValue(value);
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  }).format(value);
}

/** Format balance amount (4 decimals). Use with masked display in UI. */
export function formatBalanceAmount(amount, decimals = 4) {
  const value = parseFloat(amount);
  if (Number.isNaN(value)) return '0.0000';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export const formatLargeNumber = (num, defaultValue = '0.00') => {
  const value = parseFloat(num);
  if (Number.isNaN(value) || value == null) return defaultValue;
  if (value >= 1000000000) return `${(value / 1000000000).toFixed(2)}B`;
  if (value >= 1000000) return `${(value / 1000000).toFixed(2)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(2)}K`;
  return formatNumber(value);
};

/**
 * Badge for India NFO-style symbols (Call / Put / Future). Check FUT before CE/PE.
 * @param {string} symbol - Raw or normalized symbol (e.g. NFO:RELIANCE26APR1100PE)
 * @returns {{ code: string, variant: 'ce'|'pe'|'fut', title: string } | null}
 */
export const getIndiaInstrumentTag = (symbol) => {
  const clean = String(symbol || '')
    .replace(/^.*:/, '')
    .toUpperCase()
    .trim();
  if (!clean) return null;
  if (clean.endsWith('FUT')) {
    return { code: 'FUT', variant: 'fut', title: 'Future' };
  }
  if (clean.endsWith('CE')) {
    return { code: 'CE', variant: 'ce', title: 'Call option' };
  }
  if (clean.endsWith('PE')) {
    return { code: 'PE', variant: 'pe', title: 'Put option' };
  }
  return null;
};

/**
 * Pretty-print India option/future symbols. Pass `{ stripInstrumentSuffix: true }` when CE/PE/FUT is shown as a separate tag.
 */
export const formatOptionSymbol = (symbol, options = {}) => {
  const stripInstrumentSuffix = options?.stripInstrumentSuffix === true;
  const cleanSymbol = symbol.replace(/^.*:/, '');

  const match = cleanSymbol.match(
    /^([A-Z]+)(\d{2})([A-Z]{3})(\d+)?(CE|PE|FUT)$/
  );

  if (!match) return cleanSymbol;

  const [, stock, date, month, strike, type] = match;

  if (stripInstrumentSuffix) {
    return strike ? `${stock} ${date} ${month} ${strike}` : `${stock} ${date} ${month}`;
  }

  return strike
    ? `${stock} ${date} ${month} ${strike} ${type}`
    : `${stock} ${date} ${month} ${type}`;
};

const INDIAN_FO_MONTH_LABEL = {
  JAN: 'Jan',
  FEB: 'Feb',
  MAR: 'Mar',
  APR: 'Apr',
  MAY: 'May',
  JUN: 'Jun',
  JUL: 'Jul',
  AUG: 'Aug',
  SEP: 'Sep',
  OCT: 'Oct',
  NOV: 'Nov',
  DEC: 'Dec',
};

/**
 * Pretty label for Indian exchange order symbols (NFO:/MCX:/NSE:/BSE:…).
 * Example: NFO:TCS26APR1960CE → "TCS · 26 Apr · 1,960 CE"
 */
export function formatIndianOrderPairDisplay(raw) {
  const s = String(raw ?? '')
    .trim()
    .toUpperCase();
  if (!s) return '';
  let rest = s;
  if (s.includes(':')) {
    rest = s.slice(s.indexOf(':') + 1);
  }
  const opt = rest.match(/^(.+?)(\d{1,2})([A-Z]{3})(\d+)(CE|PE)$/);
  if (opt) {
    const [, und, d, mon, strike, typ] = opt;
    const monLabel = INDIAN_FO_MONTH_LABEL[mon] || mon;
    const sk = Number(strike);
    const strikeStr = Number.isFinite(sk) ? sk.toLocaleString('en-IN') : strike;
    return `${und} · ${d} ${monLabel} · ${strikeStr} ${typ}`;
  }
  const fut = rest.match(/^(.+?)(\d{1,2})([A-Z]{3})FUT$/);
  if (fut) {
    const [, und, d, mon] = fut;
    const monLabel = INDIAN_FO_MONTH_LABEL[mon] || mon;
    return `${und} · ${d} ${monLabel} · Fut`;
  }
  return s.replace(':', ' · ');
}

/**
 * Classify Indian F&O-style symbols: futures vs options (CE/PE) vs everything else (cash, MCX spot, etc.).
 * Uses the same patterns as formatIndianOrderPairDisplay, with loose fallbacks for weekly / variant tickers.
 */
export function getIndianInstrumentKind(raw) {
  const s = String(raw ?? '')
    .trim()
    .toUpperCase();
  if (!s) return 'other';
  let rest = s;
  if (s.includes(':')) {
    rest = s.slice(s.indexOf(':') + 1);
  }
  rest = rest.trim();
  const opt = rest.match(/^(.+?)(\d{1,2})([A-Z]{3})(\d+)(CE|PE)$/);
  if (opt) return opt[5] === 'CE' ? 'ce' : 'pe';
  const fut = rest.match(/^(.+?)(\d{1,2})([A-Z]{3})FUT$/);
  if (fut) return 'futures';
  if (/FUT$/i.test(rest)) return 'futures';
  if (/CE$/i.test(rest) && /\d/.test(rest)) return 'ce';
  if (/PE$/i.test(rest) && /\d/.test(rest)) return 'pe';
  return 'other';
}

/** Underlying name for avatar letter (e.g. TCS from NFO:TCS26APR1960CE). */
export function getIndianOrderUnderlyingForIcon(raw) {
  const s = String(raw ?? '')
    .trim()
    .toUpperCase();
  if (!s) return '';
  const rest = s.includes(':') ? s.slice(s.indexOf(':') + 1) : s;
  const m = rest.match(/^(.+?)(\d{1,2})([A-Z]{3})/);
  if (m && m[1]) return m[1];
  return rest.replace(/[^A-Z0-9]/g, '').slice(0, 12) || s.charAt(0);
}

export function isValidPrice(value) {
  if (value == null || value === '') return false;
  const n = Number(value);
  return Number.isFinite(n) && n > 0;
}

export function formatPriceUtil(value) {
  if (value === null || value === undefined) return '--';

  // Convert to string first (IMPORTANT)
  let str = String(value);

  // Handle invalid numbers
  if (!isFinite(Number(str))) return '--';

  // Prevent exponential format (e.g., 2.5e-7)
  if (str.includes('e') || str.includes('E')) {
    str = Number(str).toLocaleString('fullwide', {
      useGrouping: false,
      maximumFractionDigits: 20,
    });
  }

  // Remove unnecessary trailing zeros ONLY if decimal exists
  if (str.includes('.')) {
    str = str.replace(/\.?0+$/, '');
  }

  return String(str).includes('.') ? str : `${str}.00`;
}

export const shortenAddress = (address, start = 10, end = 10) => {
  if (!address) return "—";

  if (address.length <= start + end) {
    return address;
  }

  return `${address.slice(0, start)}......${address.slice(-end)}`;
};
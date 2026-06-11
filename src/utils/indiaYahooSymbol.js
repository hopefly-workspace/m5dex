/**
 * Map dashboard India `market` query (e.g. NSE:RELIANCE, BSE:500325) to Yahoo Finance
 * symbols expected by the historical `/candles` API (RELIANCE.NS, TATAMOTORS.BO, …).
 */
export function marketPairToYahooSymbol(marketPair) {
  const raw = String(marketPair || '').trim();
  if (!raw) return '';

  const upper = raw.toUpperCase();

  if (/\.NS$/i.test(upper) || /\.BO$/i.test(upper)) {
    return upper;
  }

  if (upper.includes(':')) {
    const colonIdx = upper.indexOf(':');
    const ex = upper.slice(0, colonIdx).trim();
    const sym = upper.slice(colonIdx + 1).trim().replace(/\s+/g, '');
    if (!sym) return '';
    if (ex === 'BSE') return `${sym}.BO`;
    if (ex === 'NSE' || ex === 'NFO' || ex === 'CDS' || ex === 'MCX') return `${sym}.NS`;
    return `${sym}.NS`;
  }

  const compact = upper.replace(/\s+/g, '');
  return `${compact}.NS`;
}

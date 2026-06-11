import axios from 'axios';

const DEFAULT_CANDLES_URL = 'http://192.168.0.17:8000/candles';

function getBaseUrl() {
  const fromEnv = import.meta.env.VITE_INDIA_CANDLES_URL;
  const s = String(fromEnv || DEFAULT_CANDLES_URL).trim();
  return s.replace(/\/+$/, '');
}

/**
 * GET historical OHLCV (Indian Yahoo-backed symbol, e.g. RELIANCE.NS).
 *
 * @param {object} p
 * @param {string} p.symbol   Yahoo symbol
 * @param {string} p.start    ISO-8601 date or datetime
 * @param {string} p.end      ISO-8601 date or datetime
 * @param {string} p.timeframe e.g. 1min, 5min, 15min, 1hour, 1day, 1week
 * @param {AbortSignal} [p.signal]
 */
export async function fetchIndiaCandles({ symbol, start, end, timeframe, signal }) {
  const base = getBaseUrl();
  const { data } = await axios.get(base, {
    params: {
      // symbol: String(symbol || '').trim(),
      symbol: 'RELIANCE.NS',
      start: String(start || '').trim(),
      end: String(end || '').trim(),
      timeframe: String(timeframe || '1day').trim(),
    },
    signal,
    timeout: 90_000,
    validateStatus: (s) => s >= 200 && s < 300,
  });

  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.candles)) return data.candles;
  if (data && Array.isArray(data.data)) return data.data;
  if (data && Array.isArray(data.results)) return data.results;
  return [];
}

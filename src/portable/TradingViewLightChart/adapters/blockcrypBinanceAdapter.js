/**
 * Default adapter: Blockcryp chart REST/WS + Binance public ticker.
 * Override bases for your deployment.
 */
import {
  blockcrypChartWsUrl,
  fetchBlockcrypKlines,
  fetchBlockcrypLatestCandle,
  setBlockcrypApiBases,
} from '../lib/blockcrypApi.js'
import {
  fetchBinanceLatestKline,
  fetchTicker24h,
  INTERVALS,
  klineWsUrl,
  normalizeSymbol,
  pollIntervalMsForKlineInterval,
} from '../lib/binanceApi.js'

const BLOCKCRYP_FETCH_MS = 8000

async function fetchBlockcrypLatestWithTimeout(symbol, interval, signal) {
  const timeout = new AbortController()
  const onAbort = () => timeout.abort()
  if (signal) {
    if (signal.aborted) throw new Error('aborted')
    signal.addEventListener('abort', onAbort)
  }
  const timer = setTimeout(() => timeout.abort(), BLOCKCRYP_FETCH_MS)
  try {
    return await fetchBlockcrypLatestCandle(symbol, interval, timeout.signal)
  } finally {
    clearTimeout(timer)
    if (signal) signal.removeEventListener('abort', onAbort)
  }
}

/**
 * @param {object} [config]
 * @param {string} [config.blockcrypRestBase] e.g. https://your-api.com/api
 * @param {string} [config.blockcrypWsBase] e.g. wss://your-api.com
 * @param {string} [config.binanceRestBase] e.g. https://api.binance.com/api/v3
 * @returns {import('./chartAdapterTypes.js').ChartDataAdapter}
 */
export function createBlockcrypBinanceAdapter(config = {}) {
  if (
    config.blockcrypRestBase != null ||
    config.blockcrypWsBase != null
  ) {
    setBlockcrypApiBases({
      rest: config.blockcrypRestBase,
      ws: config.blockcrypWsBase,
    })
  }

  const binanceRest = config.binanceRestBase

  return {
    id: 'blockcryp-binance',
    intervals: INTERVALS,
    normalizeSymbol,
    pollIntervalMsForKlineInterval,
    fetchKlines: (symbol, interval, opts) =>
      fetchBlockcrypKlines(symbol, interval, opts),
    fetchLatestCandle: async (symbol, interval, signal) => {
      try {
        return await fetchBlockcrypLatestWithTimeout(symbol, interval, signal)
      } catch {
        return fetchBinanceLatestKline(symbol, interval, signal)
      }
    },
    chartWsUrl: (symbol, interval) => blockcrypChartWsUrl(symbol, interval),
    chartWsUrlFallback: (symbol, interval) => klineWsUrl(symbol, interval),
    fetchTicker24h: (symbol) =>
      binanceRest
        ? fetchTicker24h(symbol, { restBase: binanceRest })
        : fetchTicker24h(symbol),
  }
}

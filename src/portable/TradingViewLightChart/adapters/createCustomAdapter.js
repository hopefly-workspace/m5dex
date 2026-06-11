import { INTERVALS, normalizeSymbol, pollIntervalMsForKlineInterval } from '../lib/binanceApi.js'

/**
 * Build an adapter for your own trading platform API.
 * Implement the methods to match your backend contract.
 *
 * @param {Partial<import('./chartAdapterTypes.js').ChartDataAdapter> & { id?: string }} impl
 * @returns {import('./chartAdapterTypes.js').ChartDataAdapter}
 */
export function createCustomAdapter(impl) {
  if (!impl.fetchKlines || !impl.chartWsUrl) {
    throw new Error(
      'createCustomAdapter: fetchKlines and chartWsUrl are required',
    )
  }
  return {
    id: impl.id ?? 'custom',
    intervals: impl.intervals ?? INTERVALS,
    normalizeSymbol: impl.normalizeSymbol ?? normalizeSymbol,
    pollIntervalMsForKlineInterval:
      impl.pollIntervalMsForKlineInterval ?? pollIntervalMsForKlineInterval,
    fetchKlines: impl.fetchKlines,
    fetchLatestCandle:
      impl.fetchLatestCandle ??
      (async () => {
        throw new Error('fetchLatestCandle not implemented')
      }),
    chartWsUrl: impl.chartWsUrl,
    fetchTicker24h:
      impl.fetchTicker24h ??
      (async () => null),
  }
}

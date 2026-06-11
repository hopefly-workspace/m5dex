/**
 * @typedef {{ id: string, label: string }} ChartIntervalOption
 */

/**
 * Candle object from your REST API (before conversion to chart bars).
 * @typedef {object} RawCandle
 * @property {number} [time] open time in seconds
 * @property {number} [openTime] ms or sec
 * @property {number} [T] ms open time (Binance)
 * @property {number} open
 * @property {number} high
 * @property {number} low
 * @property {number} close
 * @property {number} [volume]
 */

/**
 * Plug your exchange / platform into the chart.
 *
 * @typedef {object} ChartDataAdapter
 * @property {string} [id]
 * @property {ChartIntervalOption[]} intervals
 * @property {(raw: string) => string} normalizeSymbol
 * @property {(interval: string) => number} pollIntervalMsForKlineInterval
 * @property {(symbol: string, interval: string, opts?: { limit?: number, endTimeMs?: number }) => Promise<RawCandle[]>} fetchKlines
 * @property {(symbol: string, interval: string, signal?: AbortSignal) => Promise<RawCandle>} fetchLatestCandle
 * @property {(symbol: string, interval: string) => string} chartWsUrl WebSocket URL for live candle updates
 * @property {(symbol: string, interval: string) => string} [chartWsUrlFallback] optional fallback WS (e.g. Binance)
 * @property {(symbol: string) => Promise<object|null>} fetchTicker24h Binance-style 24h ticker (price, change, etc.)
 */

export {}

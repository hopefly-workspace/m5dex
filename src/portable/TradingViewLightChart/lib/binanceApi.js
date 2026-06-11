const REST = 'https://api.binance.com/api/v3'
const WS = 'wss://stream.binance.com:9443/ws'

/** Poll cadence for Blockcryp GET …/latest (forming candle REST snapshot). */
export function pollIntervalMsForKlineInterval(interval) {
  const m = {
    '1m': 2500,
    '3m': 4000,
    '5m': 5000,
    '15m': 8000,
    '30m': 10000,
    '1h': 15000,
    '2h': 20000,
    '4h': 25000,
    '6h': 30000,
    '8h': 35000,
    '12h': 40000,
    '1d': 60000,
    '3d': 120000,
    '1w': 300000,
    '1M': 600000,
  }
  return m[interval] ?? 10000
}

export const INTERVALS = [
  { id: '1m', label: '1m' },
  { id: '3m', label: '3m' },
  { id: '5m', label: '5m' },
  { id: '15m', label: '15m' },
  { id: '30m', label: '30m' },
  { id: '1h', label: '1h' },
  { id: '2h', label: '2h' },
  { id: '4h', label: '4h' },
  { id: '6h', label: '6h' },
  { id: '8h', label: '8h' },
  { id: '12h', label: '12h' },
  { id: '1d', label: '1d' },
  { id: '3d', label: '3d' },
  { id: '1w', label: '1w' },
  { id: '1M', label: '1M' },
]

export const DEFAULT_SYMBOLS = [
  'BTCUSDT',
  'ETHUSDT',
  'BNBUSDT',
  'SOLUSDT',
  'XRPUSDT',
  'DOGEUSDT',
  'ADAUSDT',
  'AVAXUSDT',
  'DOTUSDT',
  'LINKUSDT',
]

export function normalizeSymbol(raw) {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
}

export async function fetchKlines(symbol, interval, limit = 800) {
  const u = new URL(`${REST}/klines`)
  u.searchParams.set('symbol', symbol)
  u.searchParams.set('interval', interval)
  u.searchParams.set('limit', String(limit))
  const res = await fetch(u.toString())
  if (!res.ok) {
    const t = await res.text()
    throw new Error(t || res.statusText)
  }
  return res.json()
}

export async function fetchTicker24h(symbol, opts = {}) {
  const base = (opts.restBase ?? REST).replace(/\/$/, '')
  const u = new URL(`${base}/ticker/24hr`)
  u.searchParams.set('symbol', symbol)
  const res = await fetch(u.toString())
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export function klineWsUrl(symbol, interval) {
  const s = symbol.toLowerCase()
  return `${WS}/${s}@kline_${interval}`
}

/** Latest forming candle from Binance public klines (fallback when chart API is down). */
export async function fetchBinanceLatestKline(symbol, interval, signal) {
  const u = new URL(`${REST}/klines`)
  u.searchParams.set('symbol', normalizeSymbol(symbol))
  u.searchParams.set('interval', interval)
  u.searchParams.set('limit', '1')
  const res = await fetch(u.toString(), { signal, cache: 'no-store' })
  if (!res.ok) throw new Error(await res.text())
  const rows = await res.json()
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('Binance klines empty')
  }
  const row = rows[rows.length - 1]
  return {
    time: row[0],
    open: row[1],
    high: row[2],
    low: row[3],
    close: row[4],
    volume: row[5],
  }
}

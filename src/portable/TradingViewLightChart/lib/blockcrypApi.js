/** Historical klines REST used for initial load + infinite scroll (Binance-style pagination). */
let REST = 'https://froxchart.blockcryp.com/api'
let WS_CHART = 'wss://froxchart.blockcryp.com'

const MAX_LIMIT = 1000

/** @param {{ rest?: string, ws?: string }} bases */
export function setBlockcrypApiBases(bases = {}) {
  if (bases.rest != null) REST = String(bases.rest).replace(/\/$/, '')
  if (bases.ws != null) WS_CHART = String(bases.ws).replace(/\/$/, '')
}

/** Live chart stream (forming candle + updates), same venue as REST klines. */
export function blockcrypChartWsUrl(symbol, interval) {
  const s = encodeURIComponent(String(symbol).trim())
  const iv = encodeURIComponent(String(interval).trim())
  return `${WS_CHART}/ws/chart/${s}/${iv}`
}

/**
 * @param {string} symbol e.g. BTCUSDT
 * @param {string} interval e.g. 1h
 * @param {{ limit?: number, endTimeMs?: number }} [opts]
 * - omit endTimeMs → newest candles
 * - endTimeMs → candles strictly before this open time (ms), like Binance `endTime`
 */
export async function fetchBlockcrypKlines(symbol, interval, opts = {}) {
  const { limit = 500, endTimeMs } = opts
  const u = new URL(
    `${REST}/klines/${encodeURIComponent(symbol)}/${encodeURIComponent(interval)}`,
  )
  u.searchParams.set('limit', String(Math.min(Math.max(1, limit), MAX_LIMIT)))
  if (endTimeMs != null && Number.isFinite(endTimeMs)) {
    u.searchParams.set('endTime', String(Math.floor(endTimeMs)))
  }

  const res = await fetch(u.toString())
  if (!res.ok) {
    const t = await res.text()
    throw new Error(t || res.statusText || String(res.status))
  }

  const json = await res.json()
  const candles = json?.candles
  if (!Array.isArray(candles)) {
    throw new Error('Invalid klines response: missing candles array')
  }
  return candles
}

export function extractLatestCandlePayload(json) {
  if (!json || typeof json !== 'object') return null
  if (Array.isArray(json.candles) && json.candles.length > 0) {
    return json.candles[json.candles.length - 1]
  }
  if (json.candle && typeof json.candle === 'object') return json.candle
  if (json.latest && typeof json.latest === 'object') return json.latest
  if (json.data && typeof json.data === 'object' && !Array.isArray(json.data)) {
    return json.data
  }
  if (json.time != null && json.open != null) return json
  return null
}

/** GET /klines/{symbol}/{interval}/latest — authoritative forming candle (REST snapshot). */
export async function fetchBlockcrypLatestCandle(symbol, interval, signal) {
  return null;
  const u = new URL(
    `${REST}/klines/${encodeURIComponent(symbol)}/${encodeURIComponent(interval)}/latest`,
  )
  const res = await fetch(u.toString(), { signal, cache: 'no-store' })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(t || res.statusText || String(res.status))
  }
  const json = await res.json()
  const raw = extractLatestCandlePayload(json)
  if (!raw || (raw.time == null && raw.openTime == null && raw.T == null)) {
    throw new Error('Invalid latest candle response')
  }
  return raw
}

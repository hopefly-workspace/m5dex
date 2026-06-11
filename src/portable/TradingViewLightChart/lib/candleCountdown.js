/** Binance-compatible timeframe → one candle length (ms). `1M` uses calendar month (handled separately). */
const INTERVAL_MS = {
  '1m': 60 * 1000,
  '3m': 3 * 60 * 1000,
  '5m': 5 * 60 * 1000,
  '15m': 15 * 60 * 1000,
  '30m': 30 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '2h': 2 * 60 * 60 * 1000,
  '4h': 4 * 60 * 60 * 1000,
  '6h': 6 * 60 * 60 * 1000,
  '8h': 8 * 60 * 60 * 1000,
  '12h': 12 * 60 * 60 * 1000,
  '1d': 24 * 60 * 60 * 1000,
  '3d': 3 * 24 * 60 * 60 * 1000,
  '1w': 7 * 24 * 60 * 60 * 1000,
}

/** UTC start of calendar month after candle open (exclusive candle close instant). */
function monthlyCandleCloseMs(openSec) {
  const d = new Date(openSec * 1000)
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1, 0, 0, 0, 0)
}

/**
 * Wall-clock ms when the candle that opened at `openSec` closes.
 * @param {number} openSec bar.time (open), UTC seconds
 * @param {string} interval kline interval id
 */
export function getCandleCloseMs(openSec, interval) {
  if (!Number.isFinite(openSec)) return null
  const openMs = openSec * 1000
  if (interval === '1M') {
    return monthlyCandleCloseMs(openSec)
  }
  const dur = INTERVAL_MS[interval]
  if (dur == null) return openMs + INTERVAL_MS['1h']
  return openMs + dur
}

/**
 * Ms remaining until current candle closes; aligns if server time drifted into next periods.
 */
export function remainingMsUntilCandleClose(openSec, interval) {
  const dur = interval === '1M' ? null : INTERVAL_MS[interval] ?? INTERVAL_MS['1h']
  const now = Date.now()

  if (interval === '1M') {
    const close = monthlyCandleCloseMs(openSec)
    return Math.max(0, close - now)
  }

  if (!dur || !Number.isFinite(openSec)) return 0
  let closeMs = openSec * 1000 + dur
  while (closeMs < now) {
    closeMs += dur
  }
  return Math.max(0, closeMs - now)
}

/** Format remaining ms as MM:SS or H:MM:SS (live candle countdown). */
export function formatCandleCountdown(remainingMs) {
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) return '00:00'
  const totalSec = Math.ceil(remainingMs / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

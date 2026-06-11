const GREEN = 'rgba(14, 203, 129, 0.55)'
const RED = 'rgba(246, 70, 93, 0.55)'

/** Normalize open time: seconds (UTCTimestamp) or ms from API. */
function normalizeOpenTimeSec(c) {
  const raw = c.time ?? c.openTime ?? c.T ?? c.open_time
  const n = Number(raw)
  if (!Number.isFinite(n)) return NaN
  return n > 1e12 ? Math.floor(n / 1000) : Math.floor(n)
}

/** Blockcryp / object-shaped candle → bar with volume */
export function candleObjToBar(c) {
  const time = normalizeOpenTimeSec(c)
  return {
    time,
    open: parseFloat(c.open),
    high: parseFloat(c.high),
    low: parseFloat(c.low),
    close: parseFloat(c.close),
    volume: parseFloat(c.baseVolume ?? c.volume ?? 0),
  }
}

/**
 * Parse Blockcryp chart WS or Binance-style payloads into one bar.
 * Supports: `{ k: BinanceK }`, `{ candle }`, flat OHLCV, `{ data: ... }`.
 */
export function liveChartWsPayloadToBar(payload) {
  if (!payload || typeof payload !== 'object') return null
  if (Array.isArray(payload) && payload.length > 0) {
    return liveChartWsPayloadToBar(payload[0])
  }
  if (payload.k && typeof payload.k === 'object') {
    return wsKlineToBar(payload.k)
  }
  const nested =
    payload.data ??
    payload.candle ??
    payload.kline ??
    payload.bar ??
    payload.c
  if (nested && typeof nested === 'object' && nested !== payload) {
    const fromNested = liveChartWsPayloadToBar(
      nested.k ? { k: nested.k } : nested,
    )
    if (fromNested) return fromNested
  }
  const o = payload.open ?? payload.o
  const hi = payload.high ?? payload.h
  const lo = payload.low ?? payload.l
  const cl = payload.close ?? payload.c
  const t = normalizeOpenTimeSec(payload)
  if (Number.isFinite(t) && o != null && hi != null && lo != null && cl != null) {
    return {
      time: t,
      open: parseFloat(o),
      high: parseFloat(hi),
      low: parseFloat(lo),
      close: parseFloat(cl),
      volume: parseFloat(
        payload.volume ?? payload.v ?? payload.baseVolume ?? payload.q ?? 0,
      ),
    }
  }
  return null
}

/** Binance kline array row → bar with volume */
export function rowToBar(row) {
  return {
    time: Math.floor(row[0] / 1000),
    open: parseFloat(row[1]),
    high: parseFloat(row[2]),
    low: parseFloat(row[3]),
    close: parseFloat(row[4]),
    volume: parseFloat(row[5]),
  }
}

export function barsToVolumeHistogram(bars) {
  return bars.map((b) => ({
    time: b.time,
    value: b.volume,
    color: b.close >= b.open ? GREEN : RED,
  }))
}

export function wsKlineToBar(k) {
  return {
    time: Math.floor(k.t / 1000),
    open: parseFloat(k.o),
    high: parseFloat(k.h),
    low: parseFloat(k.l),
    close: parseFloat(k.c),
    volume: parseFloat(k.v),
  }
}

/** Level-of-detail OHLCV: keep pan/zoom smooth with huge in-memory series (exchange-style). */

export const DEFAULT_MAX_DISPLAY_POINTS = 7500

/** First index with bars[i].time >= t (seconds). */
export function lowerBoundTime(bars, t) {
  let lo = 0
  let hi = bars.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (bars[mid].time < t) lo = mid + 1
    else hi = mid
  }
  return lo
}

/** Last bar with bar.time <= t, or null. */
export function findBarAtOrBefore(bars, t) {
  if (bars.length === 0) return null
  const i = lowerBoundTime(bars, t)
  if (i >= bars.length) return bars[bars.length - 1]
  if (bars[i].time === t) return bars[i]
  return i > 0 ? bars[i - 1] : null
}

function aggregateChunk(chunk) {
  if (chunk.length === 0) return null
  let hi = -Infinity
  let lo = Infinity
  let vol = 0
  for (const b of chunk) {
    hi = Math.max(hi, b.high)
    lo = Math.min(lo, b.low)
    vol += b.volume
  }
  const first = chunk[0]
  const last = chunk[chunk.length - 1]
  return {
    time: first.time,
    open: first.open,
    high: hi,
    low: lo,
    close: last.close,
    volume: vol,
  }
}

/** Evenly merge consecutive candles down to at most targetCount buckets (OHLC correct). */
export function decimateUniform(bars, targetCount) {
  if (bars.length <= targetCount || targetCount < 2) return bars.slice()
  const n = bars.length
  const out = []
  for (let k = 0; k < targetCount; k++) {
    const from = Math.floor((k * n) / targetCount)
    const to = Math.floor(((k + 1) * n) / targetCount) - 1
    const chunk = bars.slice(from, to + 1)
    const a = aggregateChunk(chunk)
    if (a) out.push(a)
  }
  return out
}

function mergeByTimeUnique(parts) {
  const map = new Map()
  for (const arr of parts) {
    for (const b of arr) {
      map.set(b.time, b)
    }
  }
  return Array.from(map.values()).sort((a, b) => a.time - b.time)
}

/**
 * Build a ≤maxPts series spanning full history: coarse outside the viewport, fine inside.
 * `visible` is chart time scale range (UTCTimestamp seconds); null → global decimation only.
 */
export function buildLodBars(fullBars, visible, maxPts = DEFAULT_MAX_DISPLAY_POINTS) {
  if (fullBars.length === 0) return []
  if (fullBars.length <= maxPts) return fullBars

  const t0 = fullBars[0].time
  const t1 = fullBars[fullBars.length - 1].time
  const span = t1 - t0 || 1

  let vf = t0
  let vt = t1
  if (visible && visible.from != null && visible.to != null) {
    vf = Number(visible.from)
    vt = Number(visible.to)
  }

  const visSpan = Math.max(vt - vf, span * 0.001)
  const pad = visSpan * 0.14
  const lo = Math.max(t0, vf - pad)
  const hi = Math.min(t1, vt + pad)

  const iLo = lowerBoundTime(fullBars, lo)
  const iHi = lowerBoundTime(fullBars, hi + 1)

  const left = fullBars.slice(0, iLo)
  const mid = fullBars.slice(iLo, iHi)
  const right = fullBars.slice(iHi)

  const budget = maxPts
  const lTar = Math.min(left.length, Math.max(0, Math.floor(budget * 0.16)))
  const rTar = Math.min(right.length, Math.max(0, Math.floor(budget * 0.16)))
  const mTar = Math.max(2, budget - lTar - rTar)

  const leftDec = left.length <= lTar ? left : decimateUniform(left, Math.max(2, lTar))
  const rightDec = right.length <= rTar ? right : decimateUniform(right, Math.max(2, rTar))
  const midDec = mid.length <= mTar ? mid : decimateUniform(mid, mTar)

  return mergeByTimeUnique([leftDec, midDec, rightDec])
}

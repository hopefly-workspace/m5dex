/** Simple EMA; `period` >= 1. Returns array aligned with `closes` (undefined until enough samples). */
export function emaSeries(closes, period) {
  if (period < 1 || closes.length === 0) return []
  const k = 2 / (period + 1)
  const out = new Array(closes.length)
  let acc = 0
  for (let i = 0; i < closes.length; i++) {
    const c = closes[i]
    if (i < period - 1) {
      acc += c
      out[i] = undefined
    } else if (i === period - 1) {
      acc += c
      out[i] = acc / period
    } else {
      out[i] = c * k + out[i - 1] * (1 - k)
    }
  }
  return out
}

export function emaLinePoints(bars, period) {
  const closes = bars.map((b) => b.close)
  const ema = emaSeries(closes, period)
  const pts = []
  for (let i = 0; i < bars.length; i++) {
    const v = ema[i]
    if (v !== undefined) pts.push({ time: bars[i].time, value: v })
  }
  return pts
}

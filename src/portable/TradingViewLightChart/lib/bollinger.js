/**
 * Bollinger Bands (20, 2) on close — upper / middle(SMA) / lower.
 * Returns lightweight-charts line point arrays.
 */
export function bollingerBandsLines(bars, period = 20, mult = 2) {
  if (bars.length < period) {
    return { upper: [], middle: [], lower: [] }
  }
  const closes = bars.map((b) => b.close)
  const upper = []
  const middle = []
  const lower = []
  let sum = 0
  for (let i = 0; i < bars.length; i++) {
    sum += closes[i]
    if (i >= period) sum -= closes[i - period]
    if (i >= period - 1) {
      const slice = closes.slice(i - period + 1, i + 1)
      const mean = sum / period
      const variance =
        slice.reduce((acc, c) => acc + (c - mean) ** 2, 0) / period
      const std = Math.sqrt(variance)
      const t = bars[i].time
      middle.push({ time: t, value: mean })
      upper.push({ time: t, value: mean + mult * std })
      lower.push({ time: t, value: mean - mult * std })
    }
  }
  return { upper, middle, lower }
}

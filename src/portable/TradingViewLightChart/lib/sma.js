/** Simple moving average line points aligned with `bars`. */
export function smaLinePoints(bars, period) {
  if (period < 1 || bars.length < period) return []
  const closes = bars.map((b) => b.close)
  const pts = []
  let sum = 0
  for (let i = 0; i < bars.length; i++) {
    sum += closes[i]
    if (i >= period) sum -= closes[i - period]
    if (i >= period - 1) {
      pts.push({ time: bars[i].time, value: sum / period })
    }
  }
  return pts
}

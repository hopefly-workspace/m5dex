/** Fast path: update last candle via series.update() instead of full setData(). */

const GREEN = 'rgba(14, 203, 129, 0.55)'
const RED = 'rgba(246, 70, 93, 0.55)'

export function barVolumePoint(b) {
  return {
    time: b.time,
    value: b.volume,
    color: b.close >= b.open ? GREEN : RED,
  }
}

/** True when only the trailing candle changed or one new bar was appended. */
export function canIncrementalBarsUpdate(prev, next) {
  if (!prev?.length || !next?.length) return false
  if (next.length === prev.length) {
    if (next.length < 2) {
      return next[0].time === prev[0].time
    }
    const n2 = next[next.length - 2]
    const p2 = prev[prev.length - 2]
    return (
      next[next.length - 1].time === prev[prev.length - 1].time &&
      n2.time === p2.time
    )
  }
  if (next.length === prev.length + 1) {
    return next[next.length - 2].time === prev[prev.length - 1].time
  }
  return false
}

/**
 * @param {import('lightweight-charts').ISeriesApi} main
 * @param {import('lightweight-charts').ISeriesApi} vol
 * @param {{ time: number, open: number, high: number, low: number, close: number, volume: number }} bar
 * @param {'candles' | 'line' | 'area'} chartType
 */
export function applyIncrementalBarUpdate(main, vol, bar, chartType) {
  if (chartType === 'candles') {
    main.update({
      time: bar.time,
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
    })
  } else {
    main.update({ time: bar.time, value: bar.close })
  }
  vol.update(barVolumePoint(bar))
}

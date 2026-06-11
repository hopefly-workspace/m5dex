/** Persisted chart appearance / behavior (TradingView-like toggles supported by lightweight-charts). */

export const LS_CHART_PREFS = 'tv_lc_chart_prefs'

export const DEFAULT_CHART_PREFS = {
  gridVert: true,
  gridHorz: true,
  crosshairMode: 'magnet_ohlc',
  crosshairVertVisible: true,
  crosshairHorzVisible: true,
  crosshairVertLabel: true,
  crosshairHorzLabel: true,
  priceScaleMode: 'normal',
  priceAutoScale: true,
  invertScale: false,
  volumeVisible: true,
  timeScaleVisible: true,
  timeScaleBorder: true,
  lockVisibleTimeRangeOnResize: false,
  fixLeftEdge: false,
  fixRightEdge: false,
  rightBarStaysOnScroll: false,
  scrollMouseWheel: true,
  scrollPressedMouseMove: true,
  scaleMouseWheel: true,
  scalePinch: true,
  /** Library horizontal “last price” line on the series */
  seriesPriceLine: true,
  /** Label on the price scale for the last value */
  seriesLastValueOnScale: false,
  /** Custom HTML pill (price + countdown) on the right */
  floatingLastPricePill: true,
}

export function readChartPrefs() {
  try {
    const raw = localStorage.getItem(LS_CHART_PREFS)
    if (!raw) return { ...DEFAULT_CHART_PREFS }
    const parsed = JSON.parse(raw)
    return { ...DEFAULT_CHART_PREFS, ...parsed }
  } catch {
    return { ...DEFAULT_CHART_PREFS }
  }
}

export function writeChartPrefs(prefs) {
  try {
    localStorage.setItem(LS_CHART_PREFS, JSON.stringify(prefs))
  } catch {
    /* ignore */
  }
}

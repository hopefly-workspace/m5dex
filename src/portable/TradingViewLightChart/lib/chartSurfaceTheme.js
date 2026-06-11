import { ColorType } from 'lightweight-charts'

/** @typedef {'light' | 'dark'} ChartColorScheme */

/** @param {ChartColorScheme | undefined} colorScheme */
export function resolveChartColorScheme(colorScheme) {
  return colorScheme === 'light' ? 'light' : 'dark'
}

/** @param {ChartColorScheme} scheme */
export function getChartSurfaceTheme(scheme) {
  const light = scheme === 'light'
  return {
    layout: {
      background: light ? '#ffffff' : '#161a1e',
      textColor: light ? '#474d57' : '#848e9c',
    },
    grid: {
      vertLines: light ? 'rgba(0, 0, 0, 0.06)' : 'rgba(43, 49, 57, 0.55)',
      horzLines: light ? 'rgba(0, 0, 0, 0.06)' : 'rgba(43, 49, 57, 0.55)',
    },
    crosshair: {
      line: light ? 'rgba(71, 77, 87, 0.4)' : 'rgba(132, 142, 156, 0.45)',
      labelBg: light ? '#e9ecef' : '#2b3139',
    },
    border: light ? '#e4e7eb' : '#2b3139',
    candle: {
      upColor: '#0ECB81',
      downColor: '#F6465D',
      wickUpColor: '#0ECB81',
      wickDownColor: '#F6465D',
    },
    line: {
      color: light ? '#c99400' : '#F0B90B',
    },
    area: {
      lineColor: light ? '#c99400' : '#F0B90B',
      topColor: light ? 'rgba(201, 148, 0, 0.28)' : 'rgba(240, 185, 11, 0.35)',
      bottomColor: light ? 'rgba(201, 148, 0, 0.03)' : 'rgba(240, 185, 11, 0.02)',
    },
    bracketNodeBg: light ? '#ffffff' : '#161a1e',
    loadingOverlay: light ? 'rgba(255, 255, 255, 0.82)' : 'rgba(11, 14, 17, 0.72)',
    loadingText: light ? '#64748b' : '#848e9c',
  }
}

/** Apply canvas (lightweight-charts) colors. */
export function applyChartSurfaceTheme(chart, scheme) {
  if (!chart) return
  const t = getChartSurfaceTheme(resolveChartColorScheme(scheme))
  chart.applyOptions({
    layout: {
      background: { type: ColorType.Solid, color: t.layout.background },
      textColor: t.layout.textColor,
    },
    grid: {
      vertLines: { color: t.grid.vertLines },
      horzLines: { color: t.grid.horzLines },
    },
    crosshair: {
      vertLine: {
        color: t.crosshair.line,
        labelBackgroundColor: t.crosshair.labelBg,
      },
      horzLine: {
        color: t.crosshair.line,
        labelBackgroundColor: t.crosshair.labelBg,
      },
    },
    rightPriceScale: { borderColor: t.border },
    timeScale: { borderColor: t.border },
  })
}

/** Series options for current chart type + theme. */
export function getMainSeriesOptions(chartType, scheme) {
  const t = getChartSurfaceTheme(resolveChartColorScheme(scheme))
  const common = {
    lastValueVisible: false,
    priceLineVisible: true,
  }
  if (chartType === 'candles') {
    return {
      type: 'candles',
      options: { ...common, ...t.candle, borderVisible: false },
    }
  }
  if (chartType === 'line') {
    return { type: 'line', options: { ...common, color: t.line.color, lineWidth: 2 } }
  }
  return {
    type: 'area',
    options: {
      ...common,
      lineColor: t.area.lineColor,
      topColor: t.area.topColor,
      bottomColor: t.area.bottomColor,
      lineWidth: 2,
    },
  }
}

/**
 * TradingView-style lightweight chart — single import for any React project.
 *
 * @example
 * import { TradingChart, createBlockcrypBinanceAdapter } from './portable/TradingViewLightChart'
 *
 * const adapter = createBlockcrypBinanceAdapter({
 *   blockcrypRestBase: 'https://your-api.com/api',
 *   blockcrypWsBase: 'wss://your-api.com',
 * })
 *
 * export default function Page() {
 *   return <TradingChart adapter={adapter} defaultSymbol="BTCUSDT" />
 * }
 */
import './components/TradingChart.css'

export { TradingChart } from './components/TradingChart.jsx'
export { ChartSettingsModal } from './components/ChartSettingsModal.jsx'

export { createBlockcrypBinanceAdapter } from './adapters/blockcrypBinanceAdapter.js'
export { createCustomAdapter } from './adapters/createCustomAdapter.js'

export { useLiveChartBars, HISTORY_EDGE_THRESHOLD } from './hooks/useLiveChartBars.js'
export { useTicker24h, tickerLastPrice } from './hooks/useTicker24h.js'

export {
  DEFAULT_CHART_PREFS,
  readChartPrefs,
  writeChartPrefs,
} from './lib/chartPrefs.js'
export {
  DEFAULT_TRADING_PREFS,
  readTradingPrefs,
  writeTradingPrefs,
} from './lib/tradingPrefs.js'
export { INTERVALS, normalizeSymbol, DEFAULT_SYMBOLS } from './lib/binanceApi.js'
export { setBlockcrypApiBases } from './lib/blockcrypApi.js'

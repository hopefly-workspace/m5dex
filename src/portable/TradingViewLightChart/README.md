# TradingViewLightChart (portable)

Copy the **`TradingViewLightChart`** folder into any React project. Import everything from **one file**:

```jsx
import { TradingChart, createBlockcrypBinanceAdapter } from './portable/TradingViewLightChart'
```

CSS is included automatically when you import from `index.js`.

## Requirements

Install peer dependencies in your host project:

```bash
npm install react react-dom lightweight-charts
```

Add **Roboto** (used by the settings modal) in your `index.html`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;600;700&display=swap"
  rel="stylesheet"
/>
```

## Quick start

```jsx
import { TradingChart, createBlockcrypBinanceAdapter } from './portable/TradingViewLightChart'

const adapter = createBlockcrypBinanceAdapter({
  blockcrypRestBase: 'https://froxchart.blockcryp.com/api',
  blockcrypWsBase: 'wss://froxchart.blockcryp.com',
  binanceRestBase: 'https://api.binance.com/api/v3',
})

export default function ChartPage() {
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <TradingChart
        adapter={adapter}
        defaultSymbol="BTCUSDT"
        defaultInterval="1h"
      />
    </div>
  )
}
```

Give the chart a **flex parent with height** (e.g. `height: 100vh`) so the canvas fills the screen.

## Connect your real trading platform

Implement a **chart data adapter** and pass it to `TradingChart`:

```jsx
import { TradingChart, createCustomAdapter } from './portable/TradingViewLightChart'

const myPlatformAdapter = createCustomAdapter({
  id: 'my-exchange',
  intervals: [
    { id: '1m', label: '1m' },
    { id: '5m', label: '5m' },
    { id: '1h', label: '1h' },
  ],
  normalizeSymbol: (s) => s.toUpperCase().replace(/\//g, ''),
  pollIntervalMsForKlineInterval: (iv) => (iv === '1m' ? 3000 : 15000),

  /** History + scroll-back. Return array of candle objects. */
  async fetchKlines(symbol, interval, { limit = 500, endTimeMs } = {}) {
    const res = await fetch(
      `https://api.myexchange.com/v1/klines?symbol=${symbol}&interval=${interval}&limit=${limit}` +
        (endTimeMs != null ? `&endTime=${endTimeMs}` : ''),
    )
    const json = await res.json()
    return json.candles // { time, open, high, low, close, volume }
  },

  /** Forming candle snapshot (optional but recommended). */
  async fetchLatestCandle(symbol, interval, signal) {
    const res = await fetch(
      `https://api.myexchange.com/v1/klines/${symbol}/${interval}/latest`,
      { signal },
    )
    return (await res.json()).candle
  },

  /** WebSocket URL — server should push live candle updates (JSON). */
  chartWsUrl: (symbol, interval) =>
    `wss://api.myexchange.com/ws/chart/${symbol}/${interval}`,

  /** Header ticker (price / 24h change). */
  async fetchTicker24h(symbol) {
    const res = await fetch(`https://api.myexchange.com/v1/ticker/24h?symbol=${symbol}`)
    return res.json() // expects fields like lastPrice or price, priceChangePercent, etc.
  },
})

export default function Page() {
  return <TradingChart adapter={myPlatformAdapter} defaultSymbol="BTCUSDT" />
}
```

### Adapter contract

| Method | Purpose |
|--------|---------|
| `fetchKlines(symbol, interval, { limit, endTimeMs })` | Initial load + infinite scroll |
| `fetchLatestCandle(symbol, interval, signal?)` | REST poll for forming candle |
| `chartWsUrl(symbol, interval)` | Live WebSocket URL |
| `fetchTicker24h(symbol)` | 24h stats in chart header |
| `normalizeSymbol(raw)` | Clean symbol string |
| `pollIntervalMsForKlineInterval(interval)` | How often to poll `/latest` |
| `intervals` | Timeframe list for UI |

Candle objects are normalized by `lib/chartData.js` (`time` in **seconds**, OHLC numbers).

## `TradingChart` props

| Prop | Type | Description |
|------|------|-------------|
| `adapter` | `ChartDataAdapter` | Data source (default: Blockcryp + Binance ticker) |
| `defaultSymbol` | `string` | Initial symbol, e.g. `BTCUSDT` |
| `defaultInterval` | `string` | Initial timeframe, e.g. `1h` |
| `className` | `string` | Extra CSS class on root |

## Features included

- Candles / line / area, volume, EMA/SMA/Bollinger
- Right-click **Settings** (grid, crosshair, scales, trading UI)
- **Multiple paper positions** with per-order TP/SL on chart
- Infinite scroll history, live WebSocket + REST reconcile

## Folder layout

```
TradingViewLightChart/
  index.js              ← import from here only
  README.md
  adapters/
  components/
  hooks/
  lib/
```

## Vite / webpack

Import path must resolve `.jsx` files. Vite works out of the box:

```js
import { TradingChart } from '../portable/TradingViewLightChart'
```

If your bundler requires an explicit path:

```js
import { TradingChart } from '../portable/TradingViewLightChart/index.js'
```

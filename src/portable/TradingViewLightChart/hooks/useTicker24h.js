import { useState, useEffect, useLayoutEffect } from 'react'

/**
 * @param {import('../adapters/chartAdapterTypes.js').ChartDataAdapter} adapter
 * @param {string} symbol
 */
export function useTicker24h(adapter, symbol) {
  const sym = adapter.normalizeSymbol(symbol)
  const [ticker, setTicker] = useState(null)

  useLayoutEffect(() => {
    setTicker(null)
  }, [sym])

  useEffect(() => {
    if (!sym) {
      const id = requestAnimationFrame(() => setTicker(null))
      return () => cancelAnimationFrame(id)
    }
    let alive = true
    const load = () => {
      adapter
        .fetchTicker24h(sym)
        .then((t) => alive && setTicker(t))
        .catch(() => alive && setTicker(null))
    }
    load()
    const id = setInterval(load, 10_000)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [adapter, sym])

  return ticker
}

/** Binance 24h ticker uses `lastPrice`; custom adapters may use `price`. */
export function tickerLastPrice(ticker) {
  if (!ticker) return null
  const n = Number(ticker.lastPrice ?? ticker.price)
  return Number.isFinite(n) && n > 0 ? n : null
}

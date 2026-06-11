import {
  useState,
  useEffect,
  useLayoutEffect,
  useCallback,
  useRef,
  startTransition,
} from 'react'
import { candleObjToBar, liveChartWsPayloadToBar } from '../lib/chartData.js'
import { decodeChartWsMessage } from '../lib/chartWs.js'

/** Large in-memory history; chart renders LOD subset in TradingChart. */
const MAX_BARS = 400_000
const DEFAULT_INITIAL_LIMIT = 800
const HISTORY_PAGE = 500
export const HISTORY_EDGE_THRESHOLD = 18

/** LRU-ish cache so switching pairs back shows candles immediately. */
const BAR_CACHE = new Map()
const BAR_CACHE_MAX = 24

function cacheKey(sym, interval) {
  return `${sym}:${interval}`
}

function readBarCache(sym, interval) {
  return BAR_CACHE.get(cacheKey(sym, interval)) ?? null
}

function writeBarCache(sym, interval, bars) {
  if (!bars?.length) return
  const key = cacheKey(sym, interval)
  BAR_CACHE.set(key, bars)
  if (BAR_CACHE.size > BAR_CACHE_MAX) {
    const oldest = BAR_CACHE.keys().next().value
    BAR_CACHE.delete(oldest)
  }
}

const cacheWriteTimers = new Map()

function writeBarCacheDebounced(sym, interval, bars, delayMs = 600) {
  const key = cacheKey(sym, interval)
  const prev = cacheWriteTimers.get(key)
  if (prev) clearTimeout(prev)
  cacheWriteTimers.set(
    key,
    setTimeout(() => {
      cacheWriteTimers.delete(key)
      writeBarCache(sym, interval, bars)
    }, delayMs),
  )
}

const WS_RECONNECT_MAX_MS = 30_000
const WS_RECONNECT_BASE_MS = 1000

function mergeByTime(older, newer) {
  const map = new Map()
  for (const b of older) map.set(b.time, b)
  for (const b of newer) map.set(b.time, b)
  return Array.from(map.values()).sort((a, b) => a.time - b.time)
}

function barEqual(a, b) {
  return (
    a.time === b.time &&
    a.open === b.open &&
    a.high === b.high &&
    a.low === b.low &&
    a.close === b.close &&
    a.volume === b.volume
  )
}

function mergeLiveCandle(prev, candle) {
  if (prev.length === 0) return [candle]
  if (!Number.isFinite(candle.time)) return prev
  const last = prev[prev.length - 1]
  if (candle.time === last.time) {
    if (barEqual(last, candle)) return prev
    return [...prev.slice(0, -1), candle]
  }
  if (candle.time > last.time) {
    const next = [...prev, candle]
    return next.length > MAX_BARS ? next.slice(-MAX_BARS) : next
  }
  const idx = prev.findIndex((b) => b.time === candle.time)
  if (idx >= 0) {
    const copy = prev.slice()
    copy[idx] = candle
    return copy
  }
  return prev
}

/**
 * @param {import('../adapters/chartAdapterTypes.js').ChartDataAdapter} adapter
 * @param {string} symbol
 * @param {string} interval
 * @param {{ initialLimit?: number, skipRestPoll?: boolean, liveThrottleMs?: number, externalLivePrice?: number|null }} [options]
 */
export function useLiveChartBars(adapter, symbol, interval, options = {}) {
  const sym = adapter.normalizeSymbol(symbol)
  const initialLimit = Math.min(
    1000,
    Math.max(80, options.initialLimit ?? DEFAULT_INITIAL_LIMIT),
  )
  const skipRestPoll = options.skipRestPoll === true
  const liveThrottleMs = options.liveThrottleMs ?? 0
  const externalLivePrice = options.externalLivePrice ?? null
  const [bars, setBars] = useState(() => readBarCache(sym, interval) ?? [])
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(() => !readBarCache(sym, interval))

  const historyExhaustedRef = useRef(false)
  const loadingMoreRef = useRef(false)
  const barsRef = useRef(bars)

  useEffect(() => {
    barsRef.current = bars
  }, [bars])

  const pendingLiveRef = useRef(null)
  const liveRafRef = useRef(null)

  const flushLiveCandle = useCallback(() => {
    liveRafRef.current = null
    const candle = pendingLiveRef.current
    if (!candle) return
    pendingLiveRef.current = null
    setBars((prev) => {
      const merged = mergeLiveCandle(prev, candle)
      if (merged === prev) return prev
      if (merged.length) writeBarCacheDebounced(sym, interval, merged)
      return merged
    })
  }, [sym, interval])

  const onLiveCandle = useCallback(
    (candle) => {
      pendingLiveRef.current = candle
      if (liveThrottleMs <= 0) {
        flushLiveCandle()
        return
      }
      if (liveRafRef.current == null) {
        liveRafRef.current = requestAnimationFrame(flushLiveCandle)
      }
    },
    [flushLiveCandle, liveThrottleMs],
  )

  useEffect(
    () => () => {
      if (liveRafRef.current != null) {
        cancelAnimationFrame(liveRafRef.current)
      }
    },
    [],
  )

  useEffect(() => {
    historyExhaustedRef.current = false
  }, [sym, interval])

  /** Swap symbol/interval before paint so the price pill never shows the previous pair. */
  useLayoutEffect(() => {
    pendingLiveRef.current = null
    if (liveRafRef.current != null) {
      cancelAnimationFrame(liveRafRef.current)
      liveRafRef.current = null
    }
    const cached = sym ? readBarCache(sym, interval) : null
    setBars(cached ?? [])
    setLoading(sym ? !cached?.length : false)
    setError(sym ? null : 'Invalid symbol')
  }, [sym, interval])

  useEffect(() => {
    if (!sym) {
      setBars([])
      setError('Invalid symbol')
      setLoading(false)
      return undefined
    }

    let cancelled = false
    const cached = readBarCache(sym, interval)
    setError(null)
    if (cached?.length) {
      setBars(cached)
      setLoading(false)
    } else {
      setBars([])
      setLoading(true)
    }

    adapter
      .fetchKlines(sym, interval, { limit: initialLimit })
      .then((candles) => {
        if (cancelled) return
        if (candles.length < initialLimit) {
          historyExhaustedRef.current = true
        }
        const next = candles.map(candleObjToBar)
        writeBarCache(sym, interval, next)
        if (cached?.length) {
          startTransition(() => {
            setBars(next)
            setLoading(false)
          })
        } else {
          setBars(next)
          setLoading(false)
        }
        adapter
          .fetchLatestCandle(sym, interval)
          .then((raw) => {
            if (cancelled) return
            const live = candleObjToBar(raw)
            setBars((cur) => {
              const merged = mergeLiveCandle(cur, live)
              writeBarCache(sym, interval, merged)
              return merged
            })
          })
          .catch(() => {
            /* /latest optional */
          })
      })
      .catch((e) => {
        if (cancelled) return
        setError(e.message || 'Failed to load klines')
        setLoading(false)
      })

    let ws
    let reconnectTimer = null
    let stallTimer = null
    let closedByCleanup = false
    let attempt = 0
    let usingFallbackWs = false
    let gotWsMessage = false

    const primaryWsUrl = adapter.chartWsUrl(sym, interval)
    const fallbackWsUrl =
      typeof adapter.chartWsUrlFallback === 'function'
        ? adapter.chartWsUrlFallback(sym, interval)
        : ''

    const clearReconnect = () => {
      if (reconnectTimer != null) {
        clearTimeout(reconnectTimer)
        reconnectTimer = null
      }
    }

    const clearStallTimer = () => {
      if (stallTimer != null) {
        clearTimeout(stallTimer)
        stallTimer = null
      }
    }

    const armStallWatch = () => {
      clearStallTimer()
      stallTimer = setTimeout(() => {
        if (cancelled || closedByCleanup || gotWsMessage) return
        if (!usingFallbackWs && fallbackWsUrl && fallbackWsUrl !== primaryWsUrl) {
          usingFallbackWs = true
          try {
            if (ws) ws.close()
          } catch {
            /* ignore */
          }
          connect(fallbackWsUrl)
        }
      }, 12_000)
    }

    const connect = (urlOverride = '') => {
      if (cancelled || closedByCleanup) return
      clearReconnect()
      clearStallTimer()
      const target =
        String(urlOverride || '').trim() ||
        (usingFallbackWs && fallbackWsUrl ? fallbackWsUrl : primaryWsUrl)
      if (!target) return
      try {
        ws = new WebSocket(target)
        ws.binaryType = 'arraybuffer'
      } catch {
        scheduleReconnect()
        return
      }

      ws.onopen = () => {
        attempt = 0
        gotWsMessage = false
        armStallWatch()
      }

      ws.onmessage = async (ev) => {
        try {
          const text = await decodeChartWsMessage(ev.data)
          if (text == null) return
          const msg = JSON.parse(text)
          const bar = liveChartWsPayloadToBar(msg)
          if (bar && Number.isFinite(bar.time)) {
            gotWsMessage = true
            clearStallTimer()
            onLiveCandle(bar)
          }
        } catch {
          /* ignore */
        }
      }

      ws.onerror = () => {}

      ws.onclose = () => {
        clearStallTimer()
        if (cancelled || closedByCleanup) return
        if (!gotWsMessage && !usingFallbackWs && fallbackWsUrl && fallbackWsUrl !== primaryWsUrl) {
          usingFallbackWs = true
          reconnectTimer = setTimeout(() => connect(fallbackWsUrl), 400)
          return
        }
        scheduleReconnect()
      }
    }

    const scheduleReconnect = () => {
      if (cancelled || closedByCleanup) return
      clearReconnect()
      const delay = Math.min(
        WS_RECONNECT_MAX_MS,
        WS_RECONNECT_BASE_MS * Math.pow(2, attempt),
      )
      attempt += 1
      reconnectTimer = setTimeout(() => connect(), delay)
    }

    connect()

    return () => {
      cancelled = true
      closedByCleanup = true
      clearReconnect()
      clearStallTimer()
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close()
      } else if (ws && ws.readyState === WebSocket.CONNECTING) {
        ws.close()
      }
    }
  }, [adapter, sym, interval, onLiveCandle, initialLimit])

  useEffect(() => {
    if (!sym || skipRestPoll) return undefined
    let cancelled = false
    const ac = new AbortController()
    const pollMs = adapter.pollIntervalMsForKlineInterval(interval)

    const tick = async () => {
      if (cancelled || barsRef.current.length === 0) return
      try {
        const raw = await adapter.fetchLatestCandle(sym, interval, ac.signal)
        if (cancelled) return
        const candle = candleObjToBar(raw)
        setBars((prev) => {
          if (prev.length === 0) return prev
          return mergeLiveCandle(prev, candle)
        })
      } catch {
        if (ac.signal.aborted) return
      }
    }

    const timer = setInterval(tick, pollMs)
    const t0 = setTimeout(tick, 500)
    const onVis = () => {
      if (document.visibilityState === 'visible') tick()
    }
    document.addEventListener('visibilitychange', onVis)

    return () => {
      cancelled = true
      ac.abort()
      clearInterval(timer)
      clearTimeout(t0)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [adapter, sym, interval, skipRestPoll])

  /** Dashboard ticker WS: nudge forming candle when chart stream is quiet. */
  useEffect(() => {
    const px = Number(externalLivePrice)
    if (!sym || !Number.isFinite(px) || px <= 0) return
    setBars((prev) => {
      if (prev.length === 0) return prev
      const last = prev[prev.length - 1]
      if (last.close === px && last.high >= px && last.low <= px) return prev
      const patched = {
        ...last,
        close: px,
        high: Math.max(last.high, px),
        low: Math.min(last.low, px),
      }
      const merged = mergeLiveCandle(prev, patched)
      if (merged !== prev) writeBarCacheDebounced(sym, interval, merged)
      return merged
    })
  }, [externalLivePrice, sym, interval])

  const loadMoreBefore = useCallback(async () => {
    if (!sym || loadingMoreRef.current || historyExhaustedRef.current) {
      return
    }
    const prev = barsRef.current
    if (prev.length === 0) return

    loadingMoreRef.current = true
    try {
      const oldestSec = prev[0].time
      const endTimeMs = oldestSec * 1000 - 1
      const candles = await adapter.fetchKlines(sym, interval, {
        limit: HISTORY_PAGE,
        endTimeMs,
      })
      if (candles.length === 0) {
        historyExhaustedRef.current = true
        return
      }
      const older = candles.map(candleObjToBar)
      startTransition(() => {
        setBars((cur) => mergeByTime(older, cur))
      })
      if (candles.length < HISTORY_PAGE) {
        historyExhaustedRef.current = true
      }
    } catch (e) {
      setError(e?.message || 'Failed to load older candles')
    } finally {
      loadingMoreRef.current = false
    }
  }, [adapter, sym, interval])

  return {
    bars,
    error,
    loading,
    loadMoreBefore,
    symbol: sym,
  }
}

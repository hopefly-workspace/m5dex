import CustomSelect from '../../../components/CustomSelect';
import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  AreaSeries,
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  PriceScaleMode,
  createChart,
} from 'lightweight-charts'
import {
  HISTORY_EDGE_THRESHOLD,
  useLiveChartBars,
} from '../hooks/useLiveChartBars.js'
import { tickerLastPrice, useTicker24h } from '../hooks/useTicker24h.js'
import { createBlockcrypBinanceAdapter } from '../adapters/blockcrypBinanceAdapter.js'
import { emaLinePoints } from '../lib/ema'
import { smaLinePoints } from '../lib/sma'
import { bollingerBandsLines } from '../lib/bollinger'
import { barsToVolumeHistogram } from '../lib/chartData'
import { buildLodBars, DEFAULT_MAX_DISPLAY_POINTS } from '../lib/lodBars'
import {
  applyIncrementalBarUpdate,
  canIncrementalBarsUpdate,
} from '../lib/chartSeriesUpdate.js'
import {
  formatCandleCountdown,
  remainingMsUntilCandleClose,
} from '../lib/candleCountdown'
import {
  DEFAULT_CHART_PREFS,
  readChartPrefs,
  writeChartPrefs,
} from '../lib/chartPrefs'
import {
  DEFAULT_TRADING_PREFS,
  readTradingPrefs,
  writeTradingPrefs,
} from '../lib/tradingPrefs'
import {
  applyChartSurfaceTheme,
  getChartSurfaceTheme,
  getMainSeriesOptions,
  resolveChartColorScheme,
} from '../lib/chartSurfaceTheme.js'
import { ChartSettingsModal } from './ChartSettingsModal.jsx'
import {
  calcUnrealizedPnl,
  commitOrderBrackets,
  createOrder,
  discardOrderBracketEdits,
  formatBracketDisplay,
  isBracketPrice,
  orderHasPendingBracketEdits,
  positionToneFromPnl,
  readOrdersFromStorage,
  resolveBracketPrice,
  signedQtyLabel as orderSignedQtyLabel,
  shortOrderLabel,
  writeOrdersToStorage,
} from '../lib/orders.js'
import './TradingChart.css'

const LS_SYMBOL = 'tv_lc_symbol'
const LS_INTERVAL = 'tv_lc_interval'
const LS_CHART = 'tv_lc_chart'
const LS_INDICATORS = 'tv_lc_indicators'
const LS_PINNED_TF = 'tv_lc_pinned_tf'

const DEFAULT_PINNED_IDS = ['15m', '1h', '4h', '1d', '1w']
const MAX_PINNED_INTERVALS = 12

const defaultChartAdapter = createBlockcrypBinanceAdapter()

/** Binance-like labels: 1h → 1H, 1d → 1D, etc. */
function intervalDisplayLabel(id, intervals) {
  const row = intervals.find((i) => i.id === id)
  if (!row) return id
  let L = row.label
  if (/^\d+h$/i.test(L)) return L.replace(/h$/i, 'H')
  if (/^\d+d$/i.test(L)) return L.replace(/d$/i, 'D')
  if (/^\d+w$/i.test(L)) return L.replace(/w$/i, 'W')
  return L
}

function readPinnedIntervals(intervals) {
  const valid = new Set(intervals.map((i) => i.id))
  try {
    const raw = localStorage.getItem(LS_PINNED_TF)
    if (!raw) {
      return DEFAULT_PINNED_IDS.filter((id) => valid.has(id))
    }
    const arr = JSON.parse(raw).filter((id) => valid.has(id))
    return arr.length > 0 ? arr : DEFAULT_PINNED_IDS.filter((id) => valid.has(id))
  } catch {
    return DEFAULT_PINNED_IDS.filter((id) => valid.has(id))
  }
}

/** Binance-style overlay toggles (persisted). */
const DEFAULT_INDICATORS = {
  ema7: true,
  ema12: false,
  ema25: true,
  ema99: false,
  sma7: false,
  sma25: false,
  sma50: false,
  bb: false,
}

function readIndicators() {
  try {
    const raw = localStorage.getItem(LS_INDICATORS)
    if (!raw) return { ...DEFAULT_INDICATORS }
    return { ...DEFAULT_INDICATORS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_INDICATORS }
  }
}

function readLs(key, fallback) {
  try {
    const v = localStorage.getItem(key)
    return v || fallback
  } catch {
    return fallback
  }
}

function writeLs(key, value) {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* ignore */
  }
}

function crosshairModeFromPref(v) {
  switch (v) {
    case 'normal':
      return CrosshairMode.Normal
    case 'magnet':
      return CrosshairMode.Magnet
    case 'hidden':
      return CrosshairMode.Hidden
    case 'magnet_ohlc':
    default:
      return CrosshairMode.MagnetOHLC
  }
}

function priceScaleModeFromPref(v) {
  switch (v) {
    case 'logarithmic':
      return PriceScaleMode.Logarithmic
    case 'percentage':
      return PriceScaleMode.Percentage
    default:
      return PriceScaleMode.Normal
  }
}

const CHART_TYPES = [
  { id: 'candles', label: 'Candles' },
  { id: 'line', label: 'Line' },
  { id: 'area', label: 'Area' },
]

const POPOVER_GAP_PX = 6
const POPOVER_PAD_PX = 8

/** Fixed popover under anchor, right-aligned to trigger (dropdown-style). Flips above if needed. */
function computePopoverPosition(anchorEl, panelEl) {
  if (!anchorEl || !panelEl) return null
  const ar = anchorEl.getBoundingClientRect()
  const mw = panelEl.offsetWidth
  const mh = panelEl.offsetHeight
  const vw = window.innerWidth
  const vh = window.innerHeight
  let top = ar.bottom + POPOVER_GAP_PX
  let left = ar.right - mw
  if (left < POPOVER_PAD_PX) left = POPOVER_PAD_PX
  if (left + mw > vw - POPOVER_PAD_PX) left = vw - mw - POPOVER_PAD_PX
  if (top + mh > vh - POPOVER_PAD_PX) {
    top = ar.top - mh - POPOVER_GAP_PX
  }
  if (top < POPOVER_PAD_PX) top = POPOVER_PAD_PX
  if (top + mh > vh - POPOVER_PAD_PX) {
    top = Math.max(POPOVER_PAD_PX, vh - mh - POPOVER_PAD_PX)
  }
  return { top, left }
}

/** Minimum gap (px) between HTML overlays and the canvas-drawn right price scale */
const PRICE_SCALE_UI_GAP = 14

/** Pixel distance from TP/SL price line to grab for drag (chart hit-test) */
const LINE_DRAG_HIT_PX = 24

/** Dashboard: min ms between HTML overlay relayouts driven by live price ticks */
const PLATFORM_LIVE_OVERLAY_MIN_MS = 250

/** Dashboard: min ms between entry-line color refreshes (P&L), no full line rebuild */
const PLATFORM_LINE_COLOR_MIN_MS = 400

/** Dashboard: show entry chips for all positions only up to this count */
const PLATFORM_MAX_ENTRY_CHIPS = 5

const OVERLAY_DRAG_SKIP =
  '.trading-chart__line-tag, .trading-chart__position-bar, .trading-chart__entry-chip, .trading-chart__chart-hint, .trading-chart__order-row, .trading-chart__price-tag'

function isOverlayDragSkipTarget(tgt) {
  return tgt instanceof Element && Boolean(tgt.closest(OVERLAY_DRAG_SKIP))
}

const INITIAL_CHART_OVERLAY = {
  priceTagTop: null,
  orderLayouts: [],
}

function orderLineSnapshot(order, showTpSl) {
  return `${order.entry}|${order.tp ?? ''}|${order.sl ?? ''}|${order.side}|${showTpSl ? 1 : 0}`
}

function chartOverlayPayloadEqual(a, b) {
  if (!a || !b) return false
  if (Math.abs((a.priceTagTop ?? -9999) - (b.priceTagTop ?? -9999)) > 2) return false
  const la = a.orderLayouts || []
  const lb = b.orderLayouts || []
  if (la.length !== lb.length) return false
  for (let i = 0; i < la.length; i++) {
    const x = la[i]
    const y = lb[i]
    if (
      x.orderId !== y.orderId ||
      x.isSelected !== y.isSelected ||
      x.inProfit !== y.inProfit
    ) {
      return false
    }
    for (const k of [
      'positionBarTop',
      'tpTagTop',
      'slTagTop',
      'entryChipLeft',
      'entryChipTop',
    ]) {
      const dx = x[k] ?? null
      const dy = y[k] ?? null
      if (dx == null && dy == null) continue
      if (dx == null || dy == null) return false
      if (Math.abs(dx - dy) > 2) return false
    }
  }
  return true
}

/**
 * @param {object} props
 * @param {import('../adapters/chartAdapterTypes.js').ChartDataAdapter} [props.adapter] REST/WS data source for your platform
 * @param {string} [props.defaultSymbol] e.g. BTCUSDT
 * @param {string} [props.defaultInterval] e.g. 1h
 * @param {string} [props.className] extra class on root element
 * @param {boolean} [props.showOrderTicket] hide bottom order ticket when false
 * @param {boolean} [props.showPositionsOnChart] hide paper positions overlay when false
 * @param {number} [props.initialBarLimit] fewer bars = faster first paint (e.g. 200 on dashboard)
 * @param {boolean} [props.smoothMode] dashboard perf: WS-only live, incremental updates, lighter LOD
 * @param {number} [props.maxDisplayPoints] cap rendered candles (default 7500)
 * @param {Array} [props.platformOrders] live open positions (dashboard); when set, paper orders disabled
 * @param {(order: object, brackets: { tp?: number|null, sl?: number|null }) => Promise<void>} [props.onPlatformTpSlCommit]
 * @param {boolean} [props.platformOneClickTpSl] commit TP/SL to API immediately after drag/click
 * @param {boolean} [props.tradingSessionClosed] disable TP/SL edits when market closed
 * @param {number|null} [props.externalLivePrice] dashboard WS price; updates pill before chart bars catch up
 * @param {number} [props.platformOpenPositionCount] total open positions (any pair) for hint text
 * @param {'light'|'dark'} [props.colorScheme] chart surface theme (dashboard syncs with app theme)
 */
export function TradingChart({
  adapter = defaultChartAdapter,
  defaultSymbol,
  defaultInterval,
  className = '',
  showOrderTicket: showOrderTicketProp,
  showPositionsOnChart: showPositionsOnChartProp,
  initialBarLimit,
  smoothMode = false,
  maxDisplayPoints: maxDisplayPointsProp,
  platformOrders,
  onPlatformTpSlCommit,
  platformOneClickTpSl = true,
  tradingSessionClosed = false,
  externalLivePrice = null,
  platformOpenPositionCount = 0,
  colorScheme = 'dark',
} = {}) {
  const resolvedColorScheme = resolveChartColorScheme(colorScheme)
  const surfaceTheme = useMemo(
    () => getChartSurfaceTheme(resolvedColorScheme),
    [resolvedColorScheme],
  )
  const isPlatformMode = platformOrders != null
  const maxDisplayPoints =
    maxDisplayPointsProp ??
    (smoothMode ? 1400 : DEFAULT_MAX_DISPLAY_POINTS)
  const intervals = adapter.intervals
  const canvasWrapRef = useRef(null)
  const containerRef = useRef(null)
  const chartRef = useRef(null)
  const mainSeriesRef = useRef(null)
  const volumeSeriesRef = useRef(null)
  /** Dynamic overlay line series (EMA/SMA/BB) keyed by id */
  const overlaySeriesRef = useRef({})
  const fitOnceRef = useRef(false)
  const prevBarsMetaRef = useRef({ len: 0, firstTime: null })
  const loadMoreBeforeRef = useRef(() => { })
  const barCountRef = useRef(0)
  const barsRef = useRef([])
  const prevBarsSnapshotRef = useRef([])
  const redrawLodRef = useRef(() => { })
  const overlayThrottleRef = useRef(null)

  const symbol = useMemo(() => {
    const raw = defaultSymbol ?? readLs(LS_SYMBOL, 'BTCUSDT')
    return adapter.normalizeSymbol(raw) || 'BTCUSDT'
  }, [defaultSymbol, adapter])

  useEffect(() => {
    writeLs(LS_SYMBOL, symbol)
  }, [symbol])
  const [interval, setInterval] = useState(() =>
    defaultInterval ?? readLs(LS_INTERVAL, '1h'),
  )
  const [chartType, setChartType] = useState(() => readLs(LS_CHART, 'candles'))
  const [indicators, setIndicators] = useState(readIndicators)
  const [pinnedIntervals, setPinnedIntervals] = useState(() =>
    readPinnedIntervals(intervals),
  )
  const [tfModalOpen, setTfModalOpen] = useState(false)
  const [indicatorModalOpen, setIndicatorModalOpen] = useState(false)
  const [orderSide, setOrderSide] = useState('buy')
  const [orderQty, setOrderQty] = useState('0.01')
  const [tpInput, setTpInput] = useState('')
  const [slInput, setSlInput] = useState('')
  const [paperOrders, setPaperOrders] = useState(() =>
    isPlatformMode ? [] : readOrdersFromStorage(),
  )
  const [platformDrafts, setPlatformDrafts] = useState({})
  const [platformTpSlSaving, setPlatformTpSlSaving] = useState(false)

  const orders = useMemo(() => {
    if (!isPlatformMode) return paperOrders
    const base = Array.isArray(platformOrders) ? platformOrders : []
    return base.map((o) => {
      const patch = platformDrafts[o.id]
      return patch ? { ...o, ...patch } : o
    })
  }, [isPlatformMode, platformOrders, paperOrders, platformDrafts])

  const [selectedOrderId, setSelectedOrderId] = useState(() => {
    if (isPlatformMode) return null
    const stored = readOrdersFromStorage()
    return stored.length > 0 ? stored[stored.length - 1].id : null
  })
  const [armMode, setArmMode] = useState(null)
  /** Batched pixel layout for all chart HTML overlays (one update → smoother zoom/pan). */
  const [chartOverlay, setChartOverlay] = useState(INITIAL_CHART_OVERLAY)
  /** Drag TP/SL on chart: which order + line kind. */
  const [lineDrag, setLineDrag] = useState(null)
  /** Live countdown until current candle closes (same cadence as selected interval). */
  const [candleCountdown, setCandleCountdown] = useState('--:--')
  /** Committed chart preferences (applied to lightweight-charts). */
  const [chartPrefs, setChartPrefs] = useState(() => readChartPrefs())
  const [tradingPrefs, setTradingPrefs] = useState(() => readTradingPrefs())
  const showOrderTicket =
    showOrderTicketProp !== undefined
      ? showOrderTicketProp
      : tradingPrefs.showOrderTicket
  const showPositionsOnChart =
    showPositionsOnChartProp !== undefined
      ? showPositionsOnChartProp
      : tradingPrefs.showPositionsOnChart
  /** Dashboard live positions: always show overlays (ignore saved prefs that hide them). */
  const showEntryChipOnChart = isPlatformMode ? true : tradingPrefs.showEntryChip
  const showBracketTagsOnChart = isPlatformMode ? true : tradingPrefs.showBracketTags
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsTab, setSettingsTab] = useState('trading')
  const [draftChartPrefs, setDraftChartPrefs] = useState(null)
  const [draftTradingPrefs, setDraftTradingPrefs] = useState(null)
  const [draftChartType, setDraftChartType] = useState(null)

  /** @type {import('react').MutableRefObject<Map<string, { entry: unknown, tp: unknown, sl: unknown }>>} */
  const orderLineRefs = useRef(new Map())
  const tradingPrefsRef = useRef(tradingPrefs)
  const ordersRef = useRef([])
  const selectedOrderIdRef = useRef(null)
  const overlayLayoutRafRef = useRef(null)
  const orderLineSnapshotRef = useRef(new Map())
  const chartOverlayCacheRef = useRef(INITIAL_CHART_OVERLAY)
  const liveOverlayThrottleRef = useRef({ timer: null, lastAt: 0 })
  const lineColorThrottleRef = useRef({ timer: null, lastAt: 0 })
  const lineDragRef = useRef(null)
  const lastDragPriceRef = useRef(null)
  const externalLivePriceRef = useRef(externalLivePrice)
  /** Snapshot at drag start / toolbar toggle (optional diagnostics). */
  const preDragOrderRef = useRef(null)
  const tfAnchorRef = useRef(null)
  const tfModalRef = useRef(null)
  const indAnchorRef = useRef(null)
  const indModalRef = useRef(null)
  const [tfPopoverPos, setTfPopoverPos] = useState(null)
  const [indPopoverPos, setIndPopoverPos] = useState(null)

  const barsHookOptions = useMemo(
    () => ({
      initialLimit: initialBarLimit,
      /* Keep REST /latest poll so candles move if chart WS is down */
      skipRestPoll: false,
      liveThrottleMs: smoothMode ? 16 : 0,
      externalLivePrice,
    }),
    [initialBarLimit, smoothMode, externalLivePrice],
  )

  const { bars, loadMoreBefore, loading: barsLoading } = useLiveChartBars(
    adapter,
    symbol,
    interval,
    barsHookOptions,
  )

  const chartReady = bars.length > 0
  const ticker = useTicker24h(adapter, symbol)
  useEffect(() => writeLs(LS_INTERVAL, interval), [interval])
  useEffect(() => writeLs(LS_CHART, chartType), [chartType])

  useEffect(() => {
    ordersRef.current = orders
    if (!isPlatformMode) writeOrdersToStorage(orders)
  }, [orders, isPlatformMode])

  useEffect(() => {
    if (!isPlatformMode || orders.length === 0) return
    setSelectedOrderId((prev) => {
      if (prev && orders.some((o) => o.id === prev)) return prev
      return orders[orders.length - 1].id
    })
  }, [isPlatformMode, orders])

  useEffect(() => {
    selectedOrderIdRef.current = selectedOrderId
  }, [selectedOrderId])

  useEffect(() => {
    if (!selectedOrderId) return
    const o = orders.find((x) => x.id === selectedOrderId)
    if (!o) return
    setTpInput(o.tp != null ? String(o.tp) : '')
    setSlInput(o.sl != null ? String(o.sl) : '')
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync ticket when selection changes only
  }, [selectedOrderId])

  useEffect(() => {
    lineDragRef.current = lineDrag
  }, [lineDrag])

  const selectedOrder = useMemo(
    () => orders.find((o) => o.id === selectedOrderId) ?? null,
    [orders, selectedOrderId],
  )

  const commitPlatformBracketsToApi = useCallback(
    async (order, { tp, sl }) => {
      if (!onPlatformTpSlCommit || tradingSessionClosed || !order) return false
      setPlatformTpSlSaving(true)
      try {
        await onPlatformTpSlCommit(order, {
          tp: tp !== undefined ? tp : order.tp,
          sl: sl !== undefined ? sl : order.sl,
        })
        setPlatformDrafts((prev) => ({
          ...prev,
          [order.id]: {
            tp: order.tp ?? null,
            sl: order.sl ?? null,
            committedTp: order.tp ?? null,
            committedSl: order.sl ?? null,
          },
        }))
        return true
      } catch {
        return false
      } finally {
        setPlatformTpSlSaving(false)
      }
    },
    [onPlatformTpSlCommit, tradingSessionClosed],
  )

  const updateOrder = useCallback(
    (orderId, patch) => {
      if (isPlatformMode) {
        setPlatformDrafts((prev) => ({
          ...prev,
          [orderId]: { ...prev[orderId], ...patch },
        }))
      } else {
        setPaperOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, ...patch } : o)),
        )
      }
    },
    [isPlatformMode],
  )

  const selectOrder = useCallback((orderId) => {
    setSelectedOrderId(orderId)
    const o = ordersRef.current.find((x) => x.id === orderId)
    if (o) {
      setTpInput(o.tp != null ? String(o.tp) : '')
      setSlInput(o.sl != null ? String(o.sl) : '')
    }
    setArmMode(null)
    setLineDrag(null)
  }, [])

  useEffect(() => {
    tradingPrefsRef.current = tradingPrefs
  }, [tradingPrefs])

  useEffect(() => {
    try {
      localStorage.setItem(LS_INDICATORS, JSON.stringify(indicators))
    } catch {
      /* ignore */
    }
  }, [indicators])

  useEffect(() => {
    try {
      localStorage.setItem(LS_PINNED_TF, JSON.stringify(pinnedIntervals))
    } catch {
      /* ignore */
    }
  }, [pinnedIntervals])

  const updateTfPopover = useCallback(() => {
    const pos = computePopoverPosition(tfAnchorRef.current, tfModalRef.current)
    if (pos) setTfPopoverPos(pos)
  }, [])

  const updateIndPopover = useCallback(() => {
    const pos = computePopoverPosition(indAnchorRef.current, indModalRef.current)
    if (pos) setIndPopoverPos(pos)
  }, [])

  useEffect(() => {
    if (tfModalOpen) return
    queueMicrotask(() => setTfPopoverPos(null))
  }, [tfModalOpen])

  useEffect(() => {
    if (indicatorModalOpen) return
    queueMicrotask(() => setIndPopoverPos(null))
  }, [indicatorModalOpen])

  useLayoutEffect(() => {
    if (!tfModalOpen) return
    updateTfPopover()
    const raf = requestAnimationFrame(() => updateTfPopover())
    window.addEventListener('resize', updateTfPopover)
    window.addEventListener('scroll', updateTfPopover, true)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', updateTfPopover)
      window.removeEventListener('scroll', updateTfPopover, true)
    }
  }, [tfModalOpen, updateTfPopover, pinnedIntervals])

  useLayoutEffect(() => {
    if (!indicatorModalOpen) return
    updateIndPopover()
    const raf = requestAnimationFrame(() => updateIndPopover())
    window.addEventListener('resize', updateIndPopover)
    window.addEventListener('scroll', updateIndPopover, true)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', updateIndPopover)
      window.removeEventListener('scroll', updateIndPopover, true)
    }
  }, [indicatorModalOpen, updateIndPopover, indicators])

  const unpinInterval = useCallback((id) => {
    setPinnedIntervals((prev) => {
      let next = prev.filter((x) => x !== id)
      if (next.length === 0) {
        next = DEFAULT_PINNED_IDS.filter((x) => intervals.some((i) => i.id === x))
      }
      queueMicrotask(() => {
        setInterval((cur) => (cur === id ? next[0] : cur))
      })
      return next
    })
  }, [])

  const selectIntervalFromModal = useCallback((id) => {
    setInterval(id)
    setPinnedIntervals((prev) => {
      if (prev.includes(id)) return prev
      if (prev.length >= MAX_PINNED_INTERVALS) return prev
      return [...prev, id]
    })
    setTfModalOpen(false)
  }, [])

  const toggleIndicator = useCallback((key) => {
    setIndicators((prev) => ({ ...prev, [key]: !prev[key] }))
  }, [])

  const openChartSettings = useCallback((tab = 'trading') => {
    setDraftChartPrefs({ ...chartPrefs })
    setDraftTradingPrefs({ ...tradingPrefs })
    setDraftChartType(chartType)
    setSettingsTab(tab)
    setSettingsOpen(true)
    setTfModalOpen(false)
    setIndicatorModalOpen(false)
  }, [chartPrefs, tradingPrefs, chartType])

  const patchDraftChartPrefs = useCallback((patch) => {
    setDraftChartPrefs((prev) =>
      prev ? { ...DEFAULT_CHART_PREFS, ...prev, ...patch } : prev,
    )
  }, [])

  const patchDraftTradingPrefs = useCallback((patch) => {
    setDraftTradingPrefs((prev) =>
      prev ? { ...DEFAULT_TRADING_PREFS, ...prev, ...patch } : prev,
    )
  }, [])

  const commitSettings = useCallback(() => {
    if (draftChartPrefs) {
      setChartPrefs(draftChartPrefs)
      writeChartPrefs(draftChartPrefs)
    }
    if (draftTradingPrefs) {
      setTradingPrefs(draftTradingPrefs)
      writeTradingPrefs(draftTradingPrefs)
    }
    if (draftChartType != null) setChartType(draftChartType)
    setDraftChartPrefs(null)
    setDraftTradingPrefs(null)
    setDraftChartType(null)
    setSettingsOpen(false)
  }, [draftChartPrefs, draftTradingPrefs, draftChartType])

  const cancelSettings = useCallback(() => {
    setDraftChartPrefs(null)
    setDraftTradingPrefs(null)
    setDraftChartType(null)
    setSettingsOpen(false)
  }, [])

  useEffect(() => {
    if (!tfModalOpen && !indicatorModalOpen && !settingsOpen) return
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setTfModalOpen(false)
        setIndicatorModalOpen(false)
        if (settingsOpen) cancelSettings()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [tfModalOpen, indicatorModalOpen, settingsOpen, cancelSettings])

  const handleOpenIndicatorsFromSettings = useCallback(() => {
    commitSettings()
    setIndicatorModalOpen(true)
  }, [commitSettings])

  const activeIndicatorCount = useMemo(
    () => Object.values(indicators).filter(Boolean).length,
    [indicators],
  )

  useEffect(() => {
    fitOnceRef.current = false
    prevBarsMetaRef.current = { len: 0, firstTime: null }
    prevBarsSnapshotRef.current = []
  }, [symbol, interval])

  useEffect(() => {
    loadMoreBeforeRef.current = loadMoreBefore
  }, [loadMoreBefore])

  useEffect(() => {
    barCountRef.current = bars.length
  }, [bars.length])

  useEffect(() => {
    barsRef.current = bars
  }, [bars])

  useEffect(() => {
    externalLivePriceRef.current = externalLivePrice
  }, [externalLivePrice])

  const precision = useMemo(() => {
    const px =
      externalLivePrice ??
      tickerLastPrice(ticker) ??
      (bars.length ? bars[bars.length - 1].close : null)
    const p = px != null ? String(parseFloat(px)) : null
    if (!p || !p.includes('.')) return 2
    const frac = p.split('.')[1]
    return Math.min(8, Math.max(2, frac?.length ?? 2))
  }, [ticker, externalLivePrice, bars])

  const fmt = useCallback(
    (n) => {
      if (n == null || Number.isNaN(n)) return '—'
      return n.toLocaleString(undefined, {
        minimumFractionDigits: precision,
        maximumFractionDigits: precision,
      })
    },
    [precision],
  )

  const applyDragAtClientY = useCallback(
    (orderId, kind, clientY) => {
      const main = mainSeriesRef.current
      const wrap = containerRef.current
      if (!main || !wrap) return null
      const rect = wrap.getBoundingClientRect()
      const price = main.coordinateToPrice(clientY - rect.top)
      if (price == null) return null
      const lines = orderLineRefs.current.get(orderId)
      const ln = kind === 'tp' ? lines?.tp : lines?.sl
      if (ln) ln.applyOptions({ price })
      lastDragPriceRef.current = price
      return price
    },
    [],
  )

  const removeOrderLines = useCallback((main, orderId) => {
    const lines = orderLineRefs.current.get(orderId)
    if (!lines) return
    if (lines.entry) main.removePriceLine(lines.entry)
    if (lines.tp) main.removePriceLine(lines.tp)
    if (lines.sl) main.removePriceLine(lines.sl)
    orderLineRefs.current.delete(orderId)
    orderLineSnapshotRef.current.delete(orderId)
  }, [])

  const buildOrderLines = useCallback(
    (main, order, { isSel, showTpSlOnChart, markPx }) => {
      const entryPx = Number(order.entry)
      if (!Number.isFinite(entryPx) || entryPx <= 0) return null
      const tone = positionToneFromPnl(order, markPx)
      const lines = { entry: null, tp: null, sl: null }
      lines.entry = main.createPriceLine({
        price: entryPx,
        color: tone.color,
        lineWidth: isSel ? 2 : 1,
        lineStyle: 0,
        axisLabelVisible: false,
        title: `${shortOrderLabel(order)} @ ${order.entry}`,
      })
      const tpPx = resolveBracketPrice(order.tp)
      if (tpPx != null && showTpSlOnChart) {
        const tpTone = formatBracketDisplay(order, tpPx, 'money', true)
        lines.tp = main.createPriceLine({
          price: tpPx,
          color: tpTone?.up ? tone.profitColor : tone.lossColor,
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: false,
          title: `TP ${shortOrderLabel(order)}`,
        })
      }
      const slPx = resolveBracketPrice(order.sl)
      if (slPx != null && showTpSlOnChart) {
        const slTone = formatBracketDisplay(order, slPx, 'money', true)
        lines.sl = main.createPriceLine({
          price: slPx,
          color: slTone?.up ? tone.profitColor : tone.lossColor,
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: false,
          title: `SL ${shortOrderLabel(order)}`,
        })
      }
      return lines
    },
    [],
  )

  /** Incremental price lines — rebuild only added/removed/changed orders (not every tick). */
  const syncOrderLines = useCallback(() => {
    if (lineDragRef.current) return
    const main = mainSeriesRef.current
    if (!main) return
    const full = barsRef.current
    const ext = externalLivePriceRef.current
    const markPx =
      ext != null && Number.isFinite(ext) && ext > 0
        ? ext
        : full.length > 0
          ? full[full.length - 1].close
          : null
    const selId = selectedOrderIdRef.current
    const orderCount = ordersRef.current.length
    const showAllBracketsOnChart =
      !isPlatformMode || orderCount <= PLATFORM_MAX_ENTRY_CHIPS
    const nextIds = new Set(ordersRef.current.map((o) => o.id))

    for (const id of [...orderLineRefs.current.keys()]) {
      if (!nextIds.has(id)) removeOrderLines(main, id)
    }

    for (const order of ordersRef.current) {
      const entryPx = Number(order.entry)
      if (!Number.isFinite(entryPx) || entryPx <= 0) continue
      const isSel = order.id === selId
      const showTpSlOnChart = showAllBracketsOnChart || isSel
      const snap = orderLineSnapshot(order, showTpSlOnChart)
      const prevSnap = orderLineSnapshotRef.current.get(order.id)
      const prevSel = orderLineRefs.current.get(order.id)
      if (prevSnap === snap && prevSel) {
        if (prevSel.entry) {
          prevSel.entry.applyOptions({
            lineWidth: isSel ? 2 : 1,
          })
        }
        continue
      }
      if (prevSel) removeOrderLines(main, order.id)
      const lines = buildOrderLines(main, order, { isSel, showTpSlOnChart, markPx })
      if (lines) {
        orderLineRefs.current.set(order.id, lines)
        orderLineSnapshotRef.current.set(order.id, snap)
      }
    }
  }, [isPlatformMode, removeOrderLines, buildOrderLines])

  /** Update P&L colors on existing lines only (cheap — no remove/create). */
  const refreshOrderLineColors = useCallback(() => {
    if (lineDragRef.current) return
    const main = mainSeriesRef.current
    if (!main) return
    const full = barsRef.current
    const ext = externalLivePriceRef.current
    const markPx =
      ext != null && Number.isFinite(ext) && ext > 0
        ? ext
        : full.length > 0
          ? full[full.length - 1].close
          : null
    if (markPx == null) return
    const selId = selectedOrderIdRef.current
    for (const order of ordersRef.current) {
      const lines = orderLineRefs.current.get(order.id)
      if (!lines?.entry) continue
      const tone = positionToneFromPnl(order, markPx)
      const isSel = order.id === selId
      lines.entry.applyOptions({ color: tone.color, lineWidth: isSel ? 2 : 1 })
      if (lines.tp) {
        const tpPx = resolveBracketPrice(order.tp)
        const tpTone = tpPx != null ? formatBracketDisplay(order, tpPx, 'money', true) : null
        lines.tp.applyOptions({
          color: tpTone?.up ? tone.profitColor : tone.lossColor,
        })
      }
      if (lines.sl) {
        const slPx = resolveBracketPrice(order.sl)
        const slTone = slPx != null ? formatBracketDisplay(order, slPx, 'money', true) : null
        lines.sl.applyOptions({
          color: slTone?.up ? tone.profitColor : tone.lossColor,
        })
      }
    }
  }, [])

  const onCrosshairMoveRef = useRef(() => { })
  useEffect(() => {
    onCrosshairMoveRef.current = () => {}
  }, [])

  /* Create chart + volume + crosshair once */
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const chart = createChart(el, {
      width: el.clientWidth,
      height: el.clientHeight,
      layout: {
        background: { type: ColorType.Solid, color: surfaceTheme.layout.background },
        textColor: surfaceTheme.layout.textColor,
        fontFamily:
          'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
      },
      grid: {
        vertLines: { color: surfaceTheme.grid.vertLines },
        horzLines: { color: surfaceTheme.grid.horzLines },
      },
      crosshair: {
        mode: CrosshairMode.MagnetOHLC,
        vertLine: {
          color: surfaceTheme.crosshair.line,
          labelBackgroundColor: surfaceTheme.crosshair.labelBg,
        },
        horzLine: {
          color: surfaceTheme.crosshair.line,
          labelBackgroundColor: surfaceTheme.crosshair.labelBg,
        },
      },
      rightPriceScale: {
        borderColor: surfaceTheme.border,
        scaleMargins: { top: 0.08, bottom: 0.22 },
      },
      timeScale: {
        borderColor: surfaceTheme.border,
        timeVisible: true,
        secondsVisible: false,
      },
    })

    chartRef.current = chart

    const vol = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: '',
    })
    volumeSeriesRef.current = vol
    chart.priceScale('').applyOptions({
      scaleMargins: { top: 0.78, bottom: 0 },
    })

    const crosshairBridge = (param) => onCrosshairMoveRef.current(param)
    chart.subscribeCrosshairMove(crosshairBridge)

    let resizeRaf = null
    const ro = new ResizeObserver(() => {
      const apply = () => {
        const { width, height } = el.getBoundingClientRect()
        if (width > 0 && height > 0) {
          chart.applyOptions({ width, height })
        }
      }
      if (smoothMode) {
        if (resizeRaf != null) cancelAnimationFrame(resizeRaf)
        resizeRaf = requestAnimationFrame(apply)
      } else {
        apply()
      }
    })
    ro.observe(el)

    const onLogicalRange = (logicalRange) => {
      if (logicalRange == null) return
      const n = barCountRef.current
      if (n < 40) return
      /* Avoid firing when fitContent shows the entire series (from≈0 with full width). */
      if (logicalRange.to - logicalRange.from >= n - 12) return
      if (logicalRange.from < HISTORY_EDGE_THRESHOLD) {
        loadMoreBeforeRef.current()
      }
    }
    chart.timeScale().subscribeVisibleLogicalRangeChange(onLogicalRange)

    let lodDebounce = null
    const lodDelay = smoothMode ? 72 : 48
    const onVisibleTimeRange = () => {
      if (lodDebounce != null) clearTimeout(lodDebounce)
      lodDebounce = setTimeout(() => redrawLodRef.current(), lodDelay)
    }
    chart.timeScale().subscribeVisibleTimeRangeChange(onVisibleTimeRange)

    return () => {
      if (lodDebounce != null) clearTimeout(lodDebounce)
      if (resizeRaf != null) cancelAnimationFrame(resizeRaf)
      chart.timeScale().unsubscribeVisibleTimeRangeChange(onVisibleTimeRange)
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(onLogicalRange)
      chart.unsubscribeCrosshairMove(crosshairBridge)
      ro.disconnect()
      chart.remove()
      chartRef.current = null
      mainSeriesRef.current = null
      volumeSeriesRef.current = null
      overlaySeriesRef.current = {}
    }
  }, [smoothMode, surfaceTheme])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return
    applyChartSurfaceTheme(chart, resolvedColorScheme)
  }, [resolvedColorScheme])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return
    const p = chartPrefs
    chart.applyOptions({
      grid: {
        vertLines: { visible: p.gridVert },
        horzLines: { visible: p.gridHorz },
      },
      crosshair: {
        mode: crosshairModeFromPref(p.crosshairMode),
        vertLine: {
          visible: p.crosshairVertVisible,
          labelVisible: p.crosshairVertLabel,
        },
        horzLine: {
          visible: p.crosshairHorzVisible,
          labelVisible: p.crosshairHorzLabel,
        },
      },
      rightPriceScale: {
        mode: priceScaleModeFromPref(p.priceScaleMode),
        autoScale: p.priceAutoScale,
        invertScale: p.invertScale,
      },
      timeScale: {
        visible: p.timeScaleVisible,
        borderVisible: p.timeScaleBorder,
        lockVisibleTimeRangeOnResize: p.lockVisibleTimeRangeOnResize,
        fixLeftEdge: p.fixLeftEdge,
        fixRightEdge: p.fixRightEdge,
        rightBarStaysOnScroll: p.rightBarStaysOnScroll,
      },
      handleScroll: {
        mouseWheel: p.scrollMouseWheel,
        pressedMouseMove: p.scrollPressedMouseMove,
        horzTouchDrag: true,
        vertTouchDrag: true,
      },
      handleScale: {
        mouseWheel: p.scaleMouseWheel,
        pinch: p.scalePinch,
        axisPressedMouseMove: true,
        axisDoubleClickReset: true,
      },
    })
    volumeSeriesRef.current?.applyOptions({ visible: p.volumeVisible })
  }, [chartPrefs])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return
    const clickHandler = (param) => {
      if (!armMode || tradingSessionClosed) return
      const orderId = selectedOrderIdRef.current
      if (!orderId) return
      const main = mainSeriesRef.current
      if (!main || !param?.point) return
      const price = main.coordinateToPrice(param.point.y)
      if (price == null) return
      const oneClick =
        platformOneClickTpSl ||
        tradingPrefsRef.current.oneClickTrading
      const current = ordersRef.current.find((o) => o.id === orderId)
      if (!current) return

      if (armMode === 'tp') {
        setTpInput(String(price))
        const next = { ...current, tp: price }
        if (isPlatformMode) {
          updateOrder(orderId, { tp: price })
          if (oneClick) void commitPlatformBracketsToApi(next, { tp: price, sl: next.sl })
        } else {
          setPaperOrders((prev) =>
            prev.map((o) => {
              if (o.id !== orderId) return o
              const patched = { ...o, tp: price }
              return oneClick ? commitOrderBrackets(patched) : patched
            }),
          )
        }
      }
      if (armMode === 'sl') {
        setSlInput(String(price))
        const next = { ...current, sl: price }
        if (isPlatformMode) {
          updateOrder(orderId, { sl: price })
          if (oneClick) void commitPlatformBracketsToApi(next, { tp: next.tp, sl: price })
        } else {
          setPaperOrders((prev) =>
            prev.map((o) => {
              if (o.id !== orderId) return o
              const patched = { ...o, sl: price }
              return oneClick ? commitOrderBrackets(patched) : patched
            }),
          )
        }
      }
      setArmMode(null)
    }
    chart.subscribeClick(clickHandler)
    return () => {
      chart.unsubscribeClick(clickHandler)
    }
  }, [
    armMode,
    isPlatformMode,
    platformOneClickTpSl,
    tradingSessionClosed,
    updateOrder,
    commitPlatformBracketsToApi,
  ])

  useEffect(() => {
    chartRef.current?.timeScale().applyOptions({
      secondsVisible: interval === '1m' || interval === '3m',
    })
  }, [interval])

  useEffect(() => {
    chartRef.current?.applyOptions({
      localization: {
        priceFormatter: (p) =>
          p.toLocaleString(undefined, {
            minimumFractionDigits: precision,
            maximumFractionDigits: precision,
          }),
      },
    })
  }, [precision])

  /* Swap OHLC / line / area */
  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return
    const prev = mainSeriesRef.current
    if (prev) chart.removeSeries(prev)

    const seriesDef = getMainSeriesOptions(chartType, resolvedColorScheme)
    let main
    if (seriesDef.type === 'candles') {
      main = chart.addSeries(CandlestickSeries, seriesDef.options)
    } else if (seriesDef.type === 'line') {
      main = chart.addSeries(LineSeries, seriesDef.options)
    } else {
      main = chart.addSeries(AreaSeries, seriesDef.options)
    }
    mainSeriesRef.current = main
  }, [chartType, resolvedColorScheme])

  useEffect(() => {
    const main = mainSeriesRef.current
    if (!main) return
    main.applyOptions({
      priceLineVisible: chartPrefs.seriesPriceLine,
      lastValueVisible: chartPrefs.seriesLastValueOnScale,
    })
  }, [chartType, chartPrefs.seriesPriceLine, chartPrefs.seriesLastValueOnScale])

  /** Single batched layout pass: price pill + order UI. Uses live price-line prices so TP/SL tags track drags. */
  const syncChartOverlays = useCallback(() => {
    const chart = chartRef.current
    const main = mainSeriesRef.current
    const wrap = containerRef.current
    const overlayRoot = canvasWrapRef.current
    const full = barsRef.current

    if (!chart || !wrap || !overlayRoot) {
      setChartOverlay(INITIAL_CHART_OVERLAY)
      return
    }

    const scaleW = chart.priceScale('right').width()
    const gutterPx = Math.max(76, scaleW + PRICE_SCALE_UI_GAP)
    overlayRoot.style.setProperty('--tv-chart-right-gutter', `${gutterPx}px`)

    let priceTagTop = null
    if (main && full.length > 0) {
      const ext = externalLivePriceRef.current
      const price =
        ext != null && Number.isFinite(ext) && ext > 0
          ? ext
          : full[full.length - 1].close
      const y = main.priceToCoordinate(price)
      if (y != null) {
        const tagTop = Math.round(y)
        const paneH = wrap.clientHeight
        if (tagTop >= 2 && tagTop <= paneH - 2) priceTagTop = tagTop
      }
    }

    const orderLayouts = []
    const paneH = wrap.clientHeight
    const edgeClampY = (y) => {
      if (y == null || paneH < 4) return null
      const t = Math.round(y)
      return Math.min(paneH - 2, Math.max(2, t))
    }

    let sharedEntryChipLeft = null
    if (main && full.length > 0) {
      const lastBar = full[full.length - 1]
      const tCoord = chart.timeScale().timeToCoordinate(lastBar.time)
      if (tCoord != null) {
        const w = wrap.clientWidth
        const reserveRight = gutterPx + Math.min(320, Math.round(w * 0.42))
        const maxLeft = Math.max(8, w - reserveRight)
        sharedEntryChipLeft = Math.min(Math.max(8, tCoord - 6), maxLeft)
      }
    }

    const selId = selectedOrderIdRef.current
    const CHIP_MIN_GAP = 28
    const placedChipTops = []
    const ordersForLayout = [...ordersRef.current].sort(
      (a, b) => Number(a.entry) - Number(b.entry),
    )
    ordersForLayout.forEach((order) => {
      if (!main) return
      const entryPx = Number(order.entry)
      if (!Number.isFinite(entryPx) || entryPx <= 0) return
      const lines = orderLineRefs.current.get(order.id)
      const tpLine = lines?.tp
      const slLine = lines?.sl
      const tpPrice =
        tpLine && typeof tpLine.options === 'function'
          ? tpLine.options().price
          : resolveBracketPrice(order.tp)
      const slPrice =
        slLine && typeof slLine.options === 'function'
          ? slLine.options().price
          : resolveBracketPrice(order.sl)
      const entryY = edgeClampY(main.priceToCoordinate(entryPx))
      let entryChipTop = entryY
      if (entryY != null && sharedEntryChipLeft != null) {
        for (const placed of placedChipTops) {
          if (Math.abs(placed - entryY) < CHIP_MIN_GAP) {
            entryChipTop = Math.max(entryChipTop ?? entryY, placed + CHIP_MIN_GAP)
          }
        }
        if (entryChipTop != null) placedChipTops.push(entryChipTop)
      }
      const ext = externalLivePriceRef.current
      const markPx =
        ext != null && Number.isFinite(ext) && ext > 0
          ? ext
          : full.length > 0
            ? full[full.length - 1].close
            : null
      const tone = positionToneFromPnl(order, markPx)
      orderLayouts.push({
        orderId: order.id,
        isSelected: order.id === selId,
        inProfit: tone.up,
        positionBarTop: entryY,
        tpTagTop:
          isBracketPrice(tpPrice)
            ? edgeClampY(main.priceToCoordinate(Number(tpPrice)))
            : null,
        slTagTop:
          isBracketPrice(slPrice)
            ? edgeClampY(main.priceToCoordinate(Number(slPrice)))
            : null,
        entryChipLeft: sharedEntryChipLeft,
        entryChipTop:
          entryChipTop != null && sharedEntryChipLeft != null ? entryChipTop : entryY,
      })
    })

    const nextPayload = { priceTagTop, orderLayouts }
    if (!chartOverlayPayloadEqual(chartOverlayCacheRef.current, nextPayload)) {
      chartOverlayCacheRef.current = nextPayload
      setChartOverlay(nextPayload)
    }
  }, [])

  /** Coalesce overlay sync to at most once per animation frame (smooth zoom / pan). */
  const scheduleChartOverlays = useCallback(() => {
    if (overlayLayoutRafRef.current != null) return
    overlayLayoutRafRef.current = requestAnimationFrame(() => {
      overlayLayoutRafRef.current = null
      syncChartOverlays()
    })
  }, [syncChartOverlays])

  /** Live tick: relayout pill + P&L colors only — never rebuild all price lines per tick. */
  const scheduleLivePriceOverlayRefresh = useCallback(() => {
    if (!isPlatformMode) {
      scheduleChartOverlays()
      return
    }
    const now = Date.now()
    const elapsed = now - liveOverlayThrottleRef.current.lastAt
    const run = () => {
      liveOverlayThrottleRef.current.lastAt = Date.now()
      scheduleChartOverlays()
      const colorElapsed = Date.now() - lineColorThrottleRef.current.lastAt
      if (colorElapsed >= PLATFORM_LINE_COLOR_MIN_MS) {
        lineColorThrottleRef.current.lastAt = Date.now()
        refreshOrderLineColors()
      } else if (lineColorThrottleRef.current.timer == null) {
        lineColorThrottleRef.current.timer = window.setTimeout(() => {
          lineColorThrottleRef.current.timer = null
          lineColorThrottleRef.current.lastAt = Date.now()
          refreshOrderLineColors()
        }, PLATFORM_LINE_COLOR_MIN_MS - colorElapsed)
      }
    }
    if (elapsed >= PLATFORM_LIVE_OVERLAY_MIN_MS) {
      run()
    } else if (liveOverlayThrottleRef.current.timer == null) {
      liveOverlayThrottleRef.current.timer = window.setTimeout(() => {
        liveOverlayThrottleRef.current.timer = null
        run()
      }, PLATFORM_LIVE_OVERLAY_MIN_MS - elapsed)
    }
  }, [isPlatformMode, scheduleChartOverlays, refreshOrderLineColors])

  useLayoutEffect(() => {
    if (lineDragRef.current) return
    if (orders.length === 0) {
      const main = mainSeriesRef.current
      if (main) {
        for (const lines of orderLineRefs.current.values()) {
          if (lines.entry) main.removePriceLine(lines.entry)
          if (lines.tp) main.removePriceLine(lines.tp)
          if (lines.sl) main.removePriceLine(lines.sl)
        }
        orderLineRefs.current.clear()
        orderLineSnapshotRef.current.clear()
      }
      return
    }
    syncOrderLines()
    scheduleChartOverlays()
  }, [orders, chartType, syncOrderLines, scheduleChartOverlays])

  /* LOD series: full history in memory; chart draws ≤ DEFAULT_MAX_DISPLAY_POINTS for smooth UI */
  const redrawLod = useCallback(() => {
    const chart = chartRef.current
    const main = mainSeriesRef.current
    const vol = volumeSeriesRef.current
    if (!chart || !main || !vol) return

    const full = barsRef.current
    if (full.length === 0) {
      main.setData([])
      vol.setData([])
      Object.keys(overlaySeriesRef.current).forEach((key) => {
        const s = overlaySeriesRef.current[key]
        if (s) chart.removeSeries(s)
        delete overlaySeriesRef.current[key]
      })
      return
    }

    const meta = prevBarsMetaRef.current
    const prepended = meta.firstTime != null && full[0].time < meta.firstTime
    const savedVr = prepended ? chart.timeScale().getVisibleRange() : null

    const vrNow = chart.timeScale().getVisibleRange()
    const lod = buildLodBars(full, vrNow, maxDisplayPoints)
    const histVol = barsToVolumeHistogram(lod)

    if (chartType === 'candles') {
      main.setData(
        lod.map(({ time, open, high, low, close }) => ({
          time,
          open,
          high,
          low,
          close,
        })),
      )
    } else {
      main.setData(lod.map((b) => ({ time: b.time, value: b.close })))
    }
    vol.setData(histVol)

    Object.keys(overlaySeriesRef.current).forEach((key) => {
      const s = overlaySeriesRef.current[key]
      if (s) chart.removeSeries(s)
      delete overlaySeriesRef.current[key]
    })

    const addLine = (key, pts, color, lineWidth = 1) => {
      if (pts.length === 0) return
      const series = chart.addSeries(LineSeries, {
        color,
        lineWidth,
        priceLineVisible: false,
        lastValueVisible: false,
      })
      series.setData(pts)
      overlaySeriesRef.current[key] = series
    }

    const ind = indicators
    if (ind.ema7) addLine('ema7', emaLinePoints(lod, 7), 'rgba(240, 185, 11, 0.92)')
    if (ind.ema12) addLine('ema12', emaLinePoints(lod, 12), 'rgba(255, 152, 0, 0.88)')
    if (ind.ema25) addLine('ema25', emaLinePoints(lod, 25), 'rgba(168, 85, 247, 0.92)')
    if (ind.ema99) addLine('ema99', emaLinePoints(lod, 99), 'rgba(59, 130, 246, 0.9)')
    if (ind.sma7) addLine('sma7', smaLinePoints(lod, 7), 'rgba(34, 211, 238, 0.88)')
    if (ind.sma25) addLine('sma25', smaLinePoints(lod, 25), 'rgba(234, 236, 239, 0.78)')
    if (ind.sma50) addLine('sma50', smaLinePoints(lod, 50), 'rgba(236, 72, 153, 0.88)')
    if (ind.bb) {
      const bb = bollingerBandsLines(lod, 20, 2)
      addLine('bbUpper', bb.upper, 'rgba(132, 142, 156, 0.65)', 1)
      addLine('bbMiddle', bb.middle, 'rgba(132, 142, 156, 0.45)', 1)
      addLine('bbLower', bb.lower, 'rgba(132, 142, 156, 0.65)', 1)
    }

    if (savedVr) {
      chart.timeScale().setVisibleRange(savedVr)
    } else if (!fitOnceRef.current) {
      chart.timeScale().fitContent()
      fitOnceRef.current = true
    }

    prevBarsMetaRef.current = {
      len: full.length,
      firstTime: full[0]?.time ?? null,
    }

    queueMicrotask(() => scheduleChartOverlays())
  }, [chartType, indicators, scheduleChartOverlays, maxDisplayPoints])

  useEffect(() => {
    redrawLodRef.current = redrawLod
  }, [redrawLod])

  useEffect(() => {
    const full = bars
    barsRef.current = full
    barCountRef.current = full.length

    const main = mainSeriesRef.current
    const vol = volumeSeriesRef.current
    const prev = prevBarsSnapshotRef.current
    const lastBar = full.length > 0 ? full[full.length - 1] : null
    const prevLast = prev.length > 0 ? prev[prev.length - 1] : null
    const lastBarMoved =
      lastBar &&
      prevLast &&
      lastBar.time === prevLast.time &&
      (lastBar.close !== prevLast.close ||
        lastBar.high !== prevLast.high ||
        lastBar.low !== prevLast.low ||
        lastBar.open !== prevLast.open)

    if (
      main &&
      vol &&
      fitOnceRef.current &&
      lastBar &&
      (canIncrementalBarsUpdate(prev, full) || lastBarMoved)
    ) {
      applyIncrementalBarUpdate(main, vol, lastBar, chartType)
      prevBarsSnapshotRef.current = full
      if (overlayThrottleRef.current == null) {
        overlayThrottleRef.current = requestAnimationFrame(() => {
          overlayThrottleRef.current = null
          scheduleChartOverlays()
        })
      }
      return () => {
        if (overlayThrottleRef.current != null) {
          cancelAnimationFrame(overlayThrottleRef.current)
          overlayThrottleRef.current = null
        }
      }
    }

    prevBarsSnapshotRef.current = full
    const id = requestAnimationFrame(() => redrawLod())
    return () => cancelAnimationFrame(id)
  }, [bars, chartType, indicators, redrawLod, scheduleChartOverlays])

  /* Pan / zoom / resize: one coalesced overlay pass per frame */
  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return
    const bump = () => {
      scheduleChartOverlays()
    }
    chart.timeScale().subscribeVisibleLogicalRangeChange(bump)
    chart.timeScale().subscribeVisibleTimeRangeChange(bump)
    const el = containerRef.current
    const ro =
      el &&
      new ResizeObserver(() => {
        bump()
      })
    if (el && ro) ro.observe(el)
    bump()
    return () => {
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(bump)
      chart.timeScale().unsubscribeVisibleTimeRangeChange(bump)
      ro?.disconnect()
    }
  }, [scheduleChartOverlays])

  useEffect(() => {
    scheduleChartOverlays()
  }, [interval, scheduleChartOverlays])

  useEffect(() => {
    if (externalLivePrice == null) return
    scheduleLivePriceOverlayRefresh()
    return () => {
      if (liveOverlayThrottleRef.current.timer != null) {
        clearTimeout(liveOverlayThrottleRef.current.timer)
        liveOverlayThrottleRef.current.timer = null
      }
      if (lineColorThrottleRef.current.timer != null) {
        clearTimeout(lineColorThrottleRef.current.timer)
        lineColorThrottleRef.current.timer = null
      }
    }
  }, [externalLivePrice, scheduleLivePriceOverlayRefresh])

  useEffect(() => {
    if (lineDragRef.current || orders.length === 0) return
    syncOrderLines()
  }, [selectedOrderId, orders.length, syncOrderLines])

  const lastCandleOpenSec = bars.length ? bars[bars.length - 1].time : null

  useEffect(() => {
    if (lastCandleOpenSec == null) {
      queueMicrotask(() => setCandleCountdown('--:--'))
      return
    }
    const tick = () => {
      const ms = remainingMsUntilCandleClose(lastCandleOpenSec, interval)
      setCandleCountdown(formatCandleCountdown(ms))
    }
    queueMicrotask(tick)
    const id = window.setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [lastCandleOpenSec, interval])

  const last = bars.length ? bars[bars.length - 1] : null
  const displayClose =
    externalLivePrice ??
    tickerLastPrice(ticker) ??
    (last != null ? last.close : null)
  const pnl = useMemo(
    () => calcUnrealizedPnl(selectedOrder, last?.close),
    [selectedOrder, last],
  )

  const placeOrder = useCallback(() => {
    if (isPlatformMode) return
    if (!last) return
    const qty = Math.max(0, parseFloat(orderQty) || 0)
    if (qty <= 0) return
    const entry = last.close
    const tp = tpInput ? parseFloat(tpInput) : null
    const sl = slInput ? parseFloat(slInput) : null
    const nextOrder = createOrder({
      side: orderSide,
      qty,
      entry,
      tp: Number.isFinite(tp) ? tp : null,
      sl: Number.isFinite(sl) ? sl : null,
    })
    preDragOrderRef.current = { ...nextOrder }
    setPaperOrders((prev) => [...prev, nextOrder])
    setSelectedOrderId(nextOrder.id)
  }, [last, orderQty, tpInput, slInput, orderSide, isPlatformMode])

  const showConfirmDiscard = useMemo(() => {
    if (!selectedOrder || tradingPrefs.oneClickTrading) return false
    if (armMode === 'tp' || armMode === 'sl') return true
    if (lineDrag) return true
    return orderHasPendingBracketEdits(selectedOrder)
  }, [selectedOrder, armMode, lineDrag, tradingPrefs.oneClickTrading])

  useEffect(() => {
    if (!lineDrag) return

    const { orderId, kind } = lineDrag
    const getLine = () => {
      const lines = orderLineRefs.current.get(orderId)
      return kind === 'tp' ? lines?.tp : lines?.sl
    }
    const order = ordersRef.current.find((o) => o.id === orderId)
    lastDragPriceRef.current =
      getLine()?.options()?.price ??
      (kind === 'tp' ? order?.tp : order?.sl) ??
      null

    const onMove = (e) => {
      if (e.cancelable) e.preventDefault()
      const price = applyDragAtClientY(orderId, kind, e.clientY)
      if (price == null) return
      if (overlayLayoutRafRef.current == null) {
        overlayLayoutRafRef.current = requestAnimationFrame(() => {
          overlayLayoutRafRef.current = null
          syncChartOverlays()
        })
      }
    }

    const endDrag = (e) => {
      const drag = lineDragRef.current
      const p = lastDragPriceRef.current
      lineDragRef.current = null
      setLineDrag(null)
      const wrap = canvasWrapRef.current
      if (wrap && e?.pointerId != null) {
        try {
          wrap.releasePointerCapture(e.pointerId)
        } catch {
          /* ignore */
        }
      }
      if (p == null || !drag || tradingSessionClosed) return
      const { orderId: oid, kind: k } = drag
      if (oid === selectedOrderIdRef.current) {
        if (k === 'tp') setTpInput(String(p))
        else setSlInput(String(p))
      }
      const o = ordersRef.current.find((x) => x.id === oid)
      if (!o) return
      const next = k === 'tp' ? { ...o, tp: p } : { ...o, sl: p }
      const oneClick =
        platformOneClickTpSl ||
        tradingPrefsRef.current.oneClickTrading
      if (isPlatformMode) {
        updateOrder(oid, k === 'tp' ? { tp: p } : { sl: p })
        if (oneClick) {
          void commitPlatformBracketsToApi(next, {
            tp: next.tp,
            sl: next.sl,
          })
        }
      } else {
        setPaperOrders((prev) =>
          prev.map((item) => {
            if (item.id !== oid) return item
            return oneClick ? commitOrderBrackets(next) : next
          }),
        )
      }
      queueMicrotask(() => {
        syncOrderLines()
        scheduleChartOverlays()
      })
    }

    const prevCursor = document.body.style.cursor
    document.body.style.cursor = 'ns-resize'

    window.addEventListener('pointermove', onMove, { passive: false })
    window.addEventListener('pointerup', endDrag, true)
    window.addEventListener('pointercancel', endDrag, true)

    return () => {
      document.body.style.cursor = prevCursor
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', endDrag, true)
      window.removeEventListener('pointercancel', endDrag, true)
    }
  }, [
    lineDrag,
    applyDragAtClientY,
    syncChartOverlays,
    syncOrderLines,
    scheduleChartOverlays,
    isPlatformMode,
    platformOneClickTpSl,
    tradingSessionClosed,
    updateOrder,
    commitPlatformBracketsToApi,
  ])

  useEffect(() => {
    scheduleChartOverlays()
  }, [orders, selectedOrderId, scheduleChartOverlays])

  useEffect(() => {
    if (orders.length === 0 || bars.length === 0 || lineDragRef.current) return
    syncOrderLines()
    scheduleChartOverlays()
  }, [bars.length, orders, syncOrderLines, scheduleChartOverlays])

  /** Grab TP/SL by dragging the chart line (near Y) or first click after toolbar arm */
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onPointerDownCapture = (e) => {
      if (tradingSessionClosed) return
      if (e.button !== 0) return
      const tgt = e.target
      if (isOverlayDragSkipTarget(tgt)) return

      const armed = lineDragRef.current
      if (armed) {
        e.preventDefault()
        e.stopPropagation()
        applyDragAtClientY(armed.orderId, armed.kind, e.clientY)
        try {
          canvasWrapRef.current?.setPointerCapture(e.pointerId)
        } catch {
          /* ignore */
        }
        return
      }

      const main = mainSeriesRef.current
      const list = ordersRef.current
      if (!main || list.length === 0) return
      const rect = el.getBoundingClientRect()
      const y = e.clientY - rect.top
      const selId = selectedOrderIdRef.current
      const platformMulti = isPlatformMode && list.length > 1
      const ordered =
        platformMulti && selId
          ? list.filter((o) => o.id === selId)
          : platformMulti
            ? []
            : [
                ...list.filter((o) => o.id === selId),
                ...list.filter((o) => o.id !== selId),
              ]
      const beginLineDrag = (order, kind) => {
        e.preventDefault()
        e.stopPropagation()
        preDragOrderRef.current = { ...order }
        setSelectedOrderId(order.id)
        setTpInput(order.tp != null ? String(order.tp) : '')
        setSlInput(order.sl != null ? String(order.sl) : '')
        setArmMode(null)
        const dragState = { orderId: order.id, kind }
        lineDragRef.current = dragState
        setLineDrag(dragState)
        applyDragAtClientY(order.id, kind, e.clientY)
        try {
          canvasWrapRef.current?.setPointerCapture(e.pointerId)
        } catch {
          /* ignore */
        }
      }
      for (const order of ordered) {
        const lines = orderLineRefs.current.get(order.id)
        const tpLine = lines?.tp
        const slLine = lines?.sl
        if (tpLine && typeof tpLine.options === 'function') {
          const py = main.priceToCoordinate(tpLine.options().price)
          if (py != null && Math.abs(y - py) <= LINE_DRAG_HIT_PX) {
            beginLineDrag(order, 'tp')
            return
          }
        }
        if (slLine && typeof slLine.options === 'function') {
          const sy = main.priceToCoordinate(slLine.options().price)
          if (sy != null && Math.abs(y - sy) <= LINE_DRAG_HIT_PX) {
            beginLineDrag(order, 'sl')
            return
          }
        }
      }
    }
    el.addEventListener('pointerdown', onPointerDownCapture, true)
    return () => el.removeEventListener('pointerdown', onPointerDownCapture, true)
  }, [applyDragAtClientY, tradingSessionClosed, isPlatformMode])

  const handlePositionTp = useCallback(() => {
    if (!selectedOrder || tradingSessionClosed) return
    if (!isBracketPrice(selectedOrder.tp)) {
      setLineDrag(null)
      setArmMode((p) => (p === 'tp' ? null : 'tp'))
      return
    }
    setArmMode(null)
    setLineDrag((d) => {
      const on =
        d?.orderId === selectedOrder.id && d?.kind === 'tp' ? null : { orderId: selectedOrder.id, kind: 'tp' }
      lineDragRef.current = on
      if (on) preDragOrderRef.current = { ...selectedOrder }
      return on
    })
  }, [selectedOrder, tradingSessionClosed])

  const handlePositionSl = useCallback(() => {
    if (!selectedOrder || tradingSessionClosed) return
    if (!isBracketPrice(selectedOrder.sl)) {
      setLineDrag(null)
      setArmMode((p) => (p === 'sl' ? null : 'sl'))
      return
    }
    setArmMode(null)
    setLineDrag((d) => {
      const on =
        d?.orderId === selectedOrder.id && d?.kind === 'sl' ? null : { orderId: selectedOrder.id, kind: 'sl' }
      lineDragRef.current = on
      if (on) preDragOrderRef.current = { ...selectedOrder }
      return on
    })
  }, [selectedOrder, tradingSessionClosed])

  const discardOrderEdit = useCallback(() => {
    if (!selectedOrderId) return
    const o = ordersRef.current.find((x) => x.id === selectedOrderId)
    if (o) {
      const restored = discardOrderBracketEdits(o)
      updateOrder(selectedOrderId, restored)
      setTpInput(restored.tp != null ? String(restored.tp) : '')
      setSlInput(restored.sl != null ? String(restored.sl) : '')
    }
    setArmMode(null)
    setLineDrag(null)
  }, [selectedOrderId, updateOrder])

  const confirmOrderEdit = useCallback(async () => {
    if (!selectedOrderId || tradingSessionClosed) return
    const o = ordersRef.current.find((x) => x.id === selectedOrderId)
    if (!o) return
    if (isPlatformMode && onPlatformTpSlCommit) {
      const ok = await commitPlatformBracketsToApi(o, { tp: o.tp, sl: o.sl })
      if (!ok) return
    } else {
      setPaperOrders((prev) =>
        prev.map((item) =>
          item.id === selectedOrderId ? commitOrderBrackets(item) : item,
        ),
      )
    }
    const committed = commitOrderBrackets(o)
    preDragOrderRef.current = committed
    setTpInput(committed.tp != null ? String(committed.tp) : '')
    setSlInput(committed.sl != null ? String(committed.sl) : '')
    setArmMode(null)
    setLineDrag(null)
  }, [
    selectedOrderId,
    tradingSessionClosed,
    isPlatformMode,
    onPlatformTpSlCommit,
    commitPlatformBracketsToApi,
  ])

  const reversePosition = useCallback(() => {
    if (!selectedOrderId || isPlatformMode) return
    setPaperOrders((prev) =>
      prev.map((o) => {
        if (o.id !== selectedOrderId) return o
        const next = {
          ...o,
          side: o.side === 'buy' ? 'sell' : 'buy',
        }
        return commitOrderBrackets(next)
      }),
    )
  }, [selectedOrderId, isPlatformMode])

  const clearTpLine = useCallback(
    (orderId) => {
      const id = orderId ?? selectedOrderId
      if (!id) return
      if (id === selectedOrderId) setTpInput('')
      updateOrder(id, { tp: null, committedTp: null })
    },
    [selectedOrderId, updateOrder],
  )

  const clearSlLine = useCallback(
    (orderId) => {
      const id = orderId ?? selectedOrderId
      if (!id) return
      if (id === selectedOrderId) setSlInput('')
      updateOrder(id, { sl: null, committedSl: null })
    },
    [selectedOrderId, updateOrder],
  )

  const closeOrder = useCallback(
    (orderId) => {
      if (isPlatformMode) return
      setLineDrag((d) => (d?.orderId === orderId ? null : d))
      setPaperOrders((prev) => {
        const next = prev.filter((o) => o.id !== orderId)
        if (selectedOrderIdRef.current === orderId) {
          const nextId = next.length ? next[next.length - 1].id : null
          queueMicrotask(() => {
            if (nextId) selectOrder(nextId)
            else {
              setSelectedOrderId(null)
              setTpInput('')
              setSlInput('')
              setArmMode(null)
            }
          })
        }
        return next
      })
    },
    [selectOrder, isPlatformMode],
  )

  const closeAllOrders = useCallback(() => {
    if (isPlatformMode) return
    setPaperOrders([])
    setSelectedOrderId(null)
    setLineDrag(null)
    setArmMode(null)
    setTpInput('')
    setSlInput('')
    preDragOrderRef.current = null
  }, [])

  const startDragFromTag = useCallback(
    (orderId, kind, e) => {
      if (tradingSessionClosed) return
      const o = ordersRef.current.find((x) => x.id === orderId)
      if (o) {
        preDragOrderRef.current = { ...o }
        selectOrder(orderId)
      }
      setArmMode(null)
      const dragState = { orderId, kind }
      lineDragRef.current = dragState
      setLineDrag(dragState)
      if (e?.clientY != null) {
        applyDragAtClientY(orderId, kind, e.clientY)
        try {
          canvasWrapRef.current?.setPointerCapture(e.pointerId)
        } catch {
          /* ignore */
        }
      }
    },
    [selectOrder, applyDragAtClientY, tradingSessionClosed],
  )

  const applyTpSlFromTicket = useCallback(() => {
    if (!selectedOrderId) return
    const tp = tpInput ? parseFloat(tpInput) : null
    const sl = slInput ? parseFloat(slInput) : null
    const patch = {}
    if (tpInput === '') patch.tp = null
    else if (Number.isFinite(tp)) patch.tp = tp
    if (slInput === '') patch.sl = null
    else if (Number.isFinite(sl)) patch.sl = sl
    if (Object.keys(patch).length > 0) updateOrder(selectedOrderId, patch)
  }, [selectedOrderId, tpInput, slInput, updateOrder])

  const selectedQtyLabel = useMemo(
    () => orderSignedQtyLabel(selectedOrder),
    [selectedOrder],
  )

  const ordersById = useMemo(() => new Map(orders.map((o) => [o.id, o])), [orders])

  const { priceTagTop, orderLayouts } = chartOverlay

  const lineDragKind = lineDrag?.kind ?? null
  const isLineDragSelected =
    lineDrag && lineDrag.orderId === selectedOrderId

  return (
    <div
      className={[
        'trading-chart',
        className,
        chartReady ? 'trading-chart--ready' : '',
        smoothMode ? 'trading-chart--smooth' : '',
        isPlatformMode ? 'trading-chart--platform' : '',
        resolvedColorScheme === 'light'
          ? 'trading-chart--theme-light'
          : 'trading-chart--theme-dark',
      ]
        .filter(Boolean)
        .join(' ')}
      data-chart-theme={resolvedColorScheme}
      style={{
        '--tv-bracket-node-bg': surfaceTheme.bracketNodeBg,
        '--tv-loading-overlay': surfaceTheme.loadingOverlay,
        '--tv-loading-text': surfaceTheme.loadingText,
      }}
    >
      <div className="trading-chart__chartbar" aria-label="Chart controls">
        <div className="trading-chart__chartbar-tf">
          <span className="trading-chart__tf-label">Time</span>
          <div className="trading-chart__tf-pills" role="tablist" aria-label="Pinned timeframes">
            {pinnedIntervals.map((id) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={interval === id}
                className={
                  interval === id
                    ? 'trading-chart__tf-pill trading-chart__tf-pill--active'
                    : 'trading-chart__tf-pill'
                }
                onClick={() => setInterval(id)}
              >
                {intervalDisplayLabel(id, intervals)}
              </button>
            ))}
          </div>
          <button
            ref={tfAnchorRef}
            type="button"
            className="trading-chart__tf-chevron"
            aria-label="Open interval settings"
            aria-expanded={tfModalOpen}
            onClick={() => {
              setTfModalOpen(true)
              setIndicatorModalOpen(false)
            }}
          >
            <svg width="10" height="6" viewBox="0 0 10 6" aria-hidden>
              <path fill="currentColor" d="M0 0h10L5 6z" />
            </svg>
          </button>
        </div>

        <div className="trading-chart__chartbar-tools">
          <div className="trading-chart__charttype-btns" role="group" aria-label="Chart type">
            {CHART_TYPES.map((t) => (
              <button
                key={t.id}
                type="button"
                title={t.label}
                className={
                  chartType === t.id
                    ? 'trading-chart__charttype-btn trading-chart__charttype-btn--active'
                    : 'trading-chart__charttype-btn'
                }
                onClick={() => setChartType(t.id)}
              >
                {t.id === 'candles' && (
                  <svg className="trading-chart__charttype-icon" viewBox="0 0 16 16" aria-hidden>
                    <rect x="2" y="6" width="3" height="6" fill="currentColor" />
                    <rect x="6.5" y="3" width="3" height="9" fill="currentColor" />
                    <rect x="11" y="5" width="3" height="7" fill="currentColor" />
                  </svg>
                )}
                {t.id === 'line' && (
                  <svg className="trading-chart__charttype-icon" viewBox="0 0 16 16" aria-hidden>
                    <path
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      d="M1 12 L5 4 L9 8 L15 2"
                    />
                  </svg>
                )}
                {t.id === 'area' && (
                  <svg className="trading-chart__charttype-icon" viewBox="0 0 16 16" aria-hidden>
                    <path
                      fill="currentColor"
                      fillOpacity="0.35"
                      d="M1 12 L5 4 L9 8 L15 2 L15 14 L1 14 Z"
                    />
                    <path
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.2"
                      d="M1 12 L5 4 L9 8 L15 2"
                    />
                  </svg>
                )}
              </button>
            ))}
          </div>

          <button
            ref={indAnchorRef}
            type="button"
            className={
              indicatorModalOpen
                ? 'trading-chart__ind-btn trading-chart__ind-btn--open'
                : 'trading-chart__ind-btn'
            }
            aria-label="Indicators"
            aria-expanded={indicatorModalOpen}
            onClick={() => {
              setIndicatorModalOpen((o) => !o)
              setTfModalOpen(false)
            }}
          >
            <svg className="trading-chart__ind-icon" viewBox="0 0 20 20" fill="none" aria-hidden>
              <path
                d="M4 16V4M4 8c2.5-1 3.5-1 5 0M10 4v12M10 8c1.5-1 2.5-1 4 0M16 4v12"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
              />
            </svg>
            {activeIndicatorCount > 0 ? (
              <span className="trading-chart__ind-badge">{activeIndicatorCount}</span>
            ) : null}
          </button>

          <button
            type="button"
            className="trading-chart__chartbar-fit"
            onClick={() => chartRef.current?.timeScale().fitContent()}
          >
            Fit
          </button>
          <button
            type="button"
            className="trading-chart__settings-gear"
            title="Chart settings"
            aria-label="Chart settings"
            onClick={() => openChartSettings('trading')}
          >
            <svg width="20" height="20" viewBox="0 0 16 16" aria-hidden style={{ marginTop: "5px"}}>
              <path
                fill="currentColor"
                d="M8 10.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm6.43-3.94.03.22c.03.24-.12.46-.34.54l-.19.07-.94.35c-.05.17-.12.34-.2.5l.55.9c.13.22.09.5-.1.67l-.16.14c-.42.37-.9.68-1.42.92l-.2.08a.52.52 0 0 1-.61-.21l-.47-.81a5.6 5.6 0 0 1-.53 0l-.47.81a.52.52 0 0 1-.61.21l-.2-.08a6.45 6.45 0 0 1-1.42-.92l-.16-.14a.52.52 0 0 1-.1-.67l.55-.9a5.7 5.7 0 0 1-.2-.5l-.94-.35-.19-.07a.52.52 0 0 1-.34-.54l.03-.22c.06-.5.06-1 0-1.5l-.03-.22a.52.52 0 0 1 .34-.54l.19-.07.94-.35c.08-.16.15-.33.2-.5l-.55-.9a.52.52 0 0 1 .1-.67l.16-.14c.42-.37.9-.68 1.42-.92l.2-.08c.22-.08.48 0 .61.21l.47.81c.18-.02.35-.03.53-.03s.35 0 .53.03l.47-.81c.13-.22.39-.29.61-.21l.2.08c.52.24 1 .55 1.42.92l.16.14c.19.17.23.45.1.67l-.55.9c.08.16.15.33.2.5l.94.35.19.07c.22.08.37.3.34.54l-.03.22a11.1 11.1 0 0 1 0 1.5Z"
              />
            </svg>
          </button>
        </div>
      </div>

      {isPlatformMode && (
        <div className="trading-chart__platform-hint" role="status">
          {tradingSessionClosed
            ? 'Market closed — TP/SL editing disabled'
            : platformTpSlSaving
              ? 'Saving TP/SL…'
              : orders.length === 0
                ? platformOpenPositionCount > 0
                  ? `You have ${platformOpenPositionCount} open position${platformOpenPositionCount === 1 ? '' : 's'} on other pairs — switch to that symbol to see it on the chart`
                  : 'Place an order from the trading panel — it will appear on this chart'
                : orders.length > PLATFORM_MAX_ENTRY_CHIPS
                  ? `${orders.length} positions on chart — lines only; tap the highlighted entry label to select and edit TP/SL`
                  : 'Tap a position · drag TP/SL lines · or use Set TP / Set SL then click the chart'}
        </div>
      )}

      {tfModalOpen && (
        <div
          className="trading-chart__modal-root"
          role="presentation"
        >
          <button
            type="button"
            className="trading-chart__modal-scrim"
            tabIndex={-1}
            aria-label="Close"
            onClick={() => setTfModalOpen(false)}
          />
          <div
            ref={tfModalRef}
            className="trading-chart__modal trading-chart__modal--popover"
            role="dialog"
            aria-modal="true"
            aria-labelledby="trading-tf-modal-title"
            style={
              tfPopoverPos
                ? { top: tfPopoverPos.top, left: tfPopoverPos.left }
                : { visibility: 'hidden' }
            }
          >
            <div className="trading-chart__modal-header">
              <h2 id="trading-tf-modal-title" className="trading-chart__modal-title">
                Intervals
              </h2>
              <button
                type="button"
                className="trading-chart__modal-close"
                aria-label="Close"
                onClick={() => setTfModalOpen(false)}
              >
                ×
              </button>
            </div>
            <div className="trading-chart__modal-body">
              <section className="trading-chart__modal-section">
                <div className="trading-chart__modal-section-head">
                  <span className="trading-chart__modal-h">Pinned</span>
                  <span className="trading-chart__modal-hint">Toolbar strip</span>
                </div>
                <div className="trading-chart__modal-chips">
                  {pinnedIntervals.map((id) => (
                    <div key={id} className="trading-chart__chip">
                      <button
                        type="button"
                        className="trading-chart__chip-label"
                        onClick={() => {
                          setInterval(id)
                          setTfModalOpen(false)
                        }}
                      >
                        {intervalDisplayLabel(id, intervals)}
                      </button>
                      <button
                        type="button"
                        className="trading-chart__chip-remove"
                        aria-label={`Unpin ${id}`}
                        onClick={() => unpinInterval(id)}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </section>
              <section className="trading-chart__modal-section">
                <span className="trading-chart__modal-h">Available</span>
                <div className="trading-chart__modal-grid">
                  {intervals.map((iv) => (
                    <button
                      key={iv.id}
                      type="button"
                      className="trading-chart__modal-tf-cell"
                      onClick={() => selectIntervalFromModal(iv.id)}
                    >
                      {intervalDisplayLabel(iv.id, intervals)}
                    </button>
                  ))}
                </div>
                <p className="trading-chart__modal-footnote">
                  Up to {MAX_PINNED_INTERVALS} pinned on the bar. Choosing an interval applies the chart
                  and adds it to pinned when possible.
                </p>
              </section>
            </div>
          </div>
        </div>
      )}

      {indicatorModalOpen && (
        <div className="trading-chart__modal-root" role="presentation">
          <button
            type="button"
            className="trading-chart__modal-scrim"
            tabIndex={-1}
            aria-label="Close"
            onClick={() => setIndicatorModalOpen(false)}
          />
          <div
            ref={indModalRef}
            className="trading-chart__modal trading-chart__modal--ind trading-chart__modal--popover"
            role="dialog"
            aria-modal="true"
            aria-labelledby="trading-ind-modal-title"
            style={
              indPopoverPos
                ? { top: indPopoverPos.top, left: indPopoverPos.left }
                : { visibility: 'hidden' }
            }
          >
            <div className="trading-chart__modal-header">
              <h2 id="trading-ind-modal-title" className="trading-chart__modal-title">
                Indicators
              </h2>
              <button
                type="button"
                className="trading-chart__modal-close"
                aria-label="Close"
                onClick={() => setIndicatorModalOpen(false)}
              >
                ×
              </button>
            </div>
            <div className="trading-chart__modal-body trading-chart__modal-body--scroll">
              <div className="trading-chart__modal-section">
                <div className="trading-chart__modal-h">Moving Average (EMA)</div>
                <label className="trading-chart__modal-check">
                  <input
                    type="checkbox"
                    checked={indicators.ema7}
                    onChange={() => toggleIndicator('ema7')}
                  />
                  EMA (7)
                </label>
                <label className="trading-chart__modal-check">
                  <input
                    type="checkbox"
                    checked={indicators.ema12}
                    onChange={() => toggleIndicator('ema12')}
                  />
                  EMA (12)
                </label>
                <label className="trading-chart__modal-check">
                  <input
                    type="checkbox"
                    checked={indicators.ema25}
                    onChange={() => toggleIndicator('ema25')}
                  />
                  EMA (25)
                </label>
                <label className="trading-chart__modal-check">
                  <input
                    type="checkbox"
                    checked={indicators.ema99}
                    onChange={() => toggleIndicator('ema99')}
                  />
                  EMA (99)
                </label>
              </div>
              <div className="trading-chart__modal-section">
                <div className="trading-chart__modal-h">Moving Average (SMA)</div>
                <label className="trading-chart__modal-check">
                  <input
                    type="checkbox"
                    checked={indicators.sma7}
                    onChange={() => toggleIndicator('sma7')}
                  />
                  SMA (7)
                </label>
                <label className="trading-chart__modal-check">
                  <input
                    type="checkbox"
                    checked={indicators.sma25}
                    onChange={() => toggleIndicator('sma25')}
                  />
                  SMA (25)
                </label>
                <label className="trading-chart__modal-check">
                  <input
                    type="checkbox"
                    checked={indicators.sma50}
                    onChange={() => toggleIndicator('sma50')}
                  />
                  SMA (50)
                </label>
              </div>
              <div className="trading-chart__modal-section">
                <div className="trading-chart__modal-h">Volatility</div>
                <label className="trading-chart__modal-check">
                  <input
                    type="checkbox"
                    checked={indicators.bb}
                    onChange={() => toggleIndicator('bb')}
                  />
                  Bollinger Bands (20, 2)
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {showOrderTicket && (
      <div className="trading-chart__orderbar">
        <div className="trading-chart__ticket">
          <CustomSelect
            className="trading-chart__select"
            value={orderSide}
            onChange={(e) => setOrderSide(e.target.value)}
          >
            <option value="buy">Long / Buy</option>
            <option value="sell">Short / Sell</option>
          </CustomSelect>
          <input
            className="trading-chart__input"
            value={orderQty}
            onChange={(e) => setOrderQty(e.target.value)}
            placeholder="Qty"
          />
          <input
            className="trading-chart__input"
            value={tpInput}
            onChange={(e) => setTpInput(e.target.value)}
            onBlur={applyTpSlFromTicket}
            placeholder="TP price"
            disabled={!selectedOrderId}
          />
          <input
            className="trading-chart__input"
            value={slInput}
            onChange={(e) => setSlInput(e.target.value)}
            onBlur={applyTpSlFromTicket}
            placeholder="SL price"
            disabled={!selectedOrderId}
          />
          <button type="button" className="trading-chart__btn" onClick={placeOrder}>
            Place Order
          </button>
          <button
            type="button"
            className={armMode === 'tp' ? 'trading-chart__btn trading-chart__btn--active' : 'trading-chart__btn'}
            disabled={!selectedOrderId}
            onClick={() => {
              setLineDrag(null)
              setArmMode((prev) => (prev === 'tp' ? null : 'tp'))
            }}
          >
            Set TP on chart
          </button>
          <button
            type="button"
            className={armMode === 'sl' ? 'trading-chart__btn trading-chart__btn--active' : 'trading-chart__btn'}
            disabled={!selectedOrderId}
            onClick={() => {
              setLineDrag(null)
              setArmMode((prev) => (prev === 'sl' ? null : 'sl'))
            }}
          >
            Set SL on chart
          </button>
          <button
            type="button"
            className="trading-chart__btn"
            disabled={!selectedOrderId}
            onClick={() => selectedOrderId && closeOrder(selectedOrderId)}
          >
            Close selected
          </button>
          <button
            type="button"
            className="trading-chart__btn"
            disabled={orders.length === 0}
            onClick={closeAllOrders}
          >
            Close all
          </button>
        </div>
        {orders.length > 0 && (
          <div className="trading-chart__order-list" role="list" aria-label="Open positions">
            {orders.map((o) => {
              const rowPnl = calcUnrealizedPnl(o, last?.close)
              return (
                <button
                  key={o.id}
                  type="button"
                  role="listitem"
                  className={
                    o.id === selectedOrderId
                      ? 'trading-chart__order-row trading-chart__order-row--selected'
                      : 'trading-chart__order-row'
                  }
                  onClick={() => selectOrder(o.id)}
                >
                  <span className={o.side === 'buy' ? 'trading-chart__order-row__side--long' : 'trading-chart__order-row__side--short'}>
                    {shortOrderLabel(o)}
                  </span>
                  <span>@{fmt(o.entry)}</span>
                  <span>TP {o.tp != null ? fmt(o.tp) : '—'}</span>
                  <span>SL {o.sl != null ? fmt(o.sl) : '—'}</span>
                  {rowPnl && tradingPrefs.showPnL && (
                    <span className={rowPnl.up ? 'trading-chart__chg up' : 'trading-chart__chg down'}>
                      {rowPnl.value >= 0 ? '+' : ''}
                      {rowPnl.value.toFixed(2)}
                    </span>
                  )}
                  <span
                    className="trading-chart__order-row__close"
                    role="button"
                    tabIndex={0}
                    aria-label="Close position"
                    onClick={(e) => {
                      e.stopPropagation()
                      closeOrder(o.id)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        e.stopPropagation()
                        closeOrder(o.id)
                      }
                    }}
                  >
                    ×
                  </span>
                </button>
              )
            })}
          </div>
        )}
        <div className="trading-chart__order-info">
          {selectedOrder ? (
            <>
              <span className="trading-chart__order-info__label">Selected:</span>
              <span>{selectedOrder.side.toUpperCase()}</span>
              <span>Qty {selectedOrder.qty}</span>
              <span>Entry {fmt(selectedOrder.entry)}</span>
              <span>TP {selectedOrder.tp != null ? fmt(selectedOrder.tp) : '—'}</span>
              <span>SL {selectedOrder.sl != null ? fmt(selectedOrder.sl) : '—'}</span>
              {pnl && tradingPrefs.showPnL && (
                <span className={pnl.up ? 'trading-chart__chg up' : 'trading-chart__chg down'}>
                  PnL {pnl.value.toFixed(2)} ({pnl.pct.toFixed(2)}%)
                </span>
              )}
            </>
          ) : (
            <span className="trading-chart__ohlc-muted">
              {orders.length > 0
                ? 'Select a position to edit TP/SL, or place a new order.'
                : 'No open positions. Place an order — each gets its own TP/SL on the chart.'}
            </span>
          )}
        </div>
      </div>
      )}

      <div
        ref={canvasWrapRef}
        className={
          armMode || lineDragKind
            ? 'trading-chart__canvas-wrap trading-chart__canvas-wrap--chart-armed'
            : 'trading-chart__canvas-wrap'
        }
      >
        {(armMode === 'tp' || armMode === 'sl') && selectedOrder && (
          <div className="trading-chart__chart-hint" role="status">
            Click chart to set {armMode === 'tp' ? 'TP' : 'SL'} for {shortOrderLabel(selectedOrder)}
          </div>
        )}
        {lineDragKind && isLineDragSelected && (
          <div className="trading-chart__chart-hint" role="status">
            Drag to move {lineDragKind === 'tp' ? 'TP' : 'SL'} — release to confirm
          </div>
        )}
        {barsLoading && bars.length === 0 && (
          <div
            className="trading-chart__loading"
            role="status"
            aria-live="polite"
            style={{
              background: surfaceTheme.loadingOverlay,
              color: surfaceTheme.loadingText,
            }}
          >
            <div className="trading-chart__loading-spinner" aria-hidden />
            <span>Loading chart…</span>
          </div>
        )}
        <div
          ref={containerRef}
          className="trading-chart__canvas"
          onContextMenu={(e) => {
            e.preventDefault()
            openChartSettings('trading')
          }}
        />
        {showPositionsOnChart &&
          orderLayouts.map((layout) => {
            const order = ordersById.get(layout.orderId)
            if (!order) return null
            const showAllOnChart =
              !isPlatformMode || orders.length <= PLATFORM_MAX_ENTRY_CHIPS
            const dimClass =
              layout.isSelected || showAllOnChart ? '' : ' trading-chart__order-layer--dim'
            const showInteractiveOverlay = layout.isSelected || showAllOnChart
            const orderPnl = calcUnrealizedPnl(order, displayClose ?? last?.close)
            const orderQtyLabel = orderSignedQtyLabel(order)
            const barPnl = layout.isSelected ? pnl : orderPnl
            const showPositionBar =
              layout.positionBarTop != null &&
              (layout.isSelected || (isPlatformMode && showAllOnChart))
            const tpDisplay = formatBracketDisplay(
              order,
              order.tp,
              tradingPrefs.pnlBracketUnit,
              tradingPrefs.showPnL,
            )
            const slDisplay = formatBracketDisplay(
              order,
              order.sl,
              tradingPrefs.pnlBracketUnit,
              tradingPrefs.showPnL,
            )
            const nodes = [
              isBracketPrice(order.tp) && layout.tpTagTop != null
                ? { k: 'tp', y: layout.tpTagTop }
                : null,
              layout.positionBarTop != null ? { k: 'en', y: layout.positionBarTop } : null,
              isBracketPrice(order.sl) && layout.slTagTop != null
                ? { k: 'sl', y: layout.slTagTop }
                : null,
            ].filter(Boolean)
            const railColor = layout.inProfit ? '#0ECB81' : '#F6465D'
            const tpActive =
              layout.isSelected &&
              (armMode === 'tp' ||
                (lineDrag?.orderId === layout.orderId && lineDrag?.kind === 'tp'))
            const slActive =
              layout.isSelected &&
              (armMode === 'sl' ||
                (lineDrag?.orderId === layout.orderId && lineDrag?.kind === 'sl'))
            return (
              <Fragment key={layout.orderId}>
                {showInteractiveOverlay && nodes.length >= 1 && (
                  <div className={`trading-chart__order-bracket${dimClass}`} aria-hidden>
                    <div
                      className="trading-chart__order-bracket__rail"
                      style={{
                        top: Math.min(...nodes.map((n) => n.y)),
                        height: Math.max(
                          8,
                          Math.max(...nodes.map((n) => n.y)) -
                            Math.min(...nodes.map((n) => n.y)),
                        ),
                        background: railColor,
                      }}
                    />
                    {nodes.map((n) => (
                      <div
                        key={n.k}
                        className="trading-chart__order-bracket__node"
                        style={{ top: n.y, borderColor: railColor }}
                      />
                    ))}
                  </div>
                )}
                {showEntryChipOnChart &&
                  layout.entryChipLeft != null &&
                  layout.entryChipTop != null && (
                    <div
                      className={
                        (layout.inProfit
                          ? 'trading-chart__entry-chip trading-chart__entry-chip--profit'
                          : 'trading-chart__entry-chip trading-chart__entry-chip--loss') +
                        dimClass
                      }
                      style={{ left: layout.entryChipLeft, top: layout.entryChipTop }}
                      onPointerDown={(e) => {
                        e.stopPropagation()
                        selectOrder(layout.orderId)
                      }}
                    >
                      <span className="trading-chart__entry-chip__qty">
                        {orderSignedQtyLabel(order)}
                      </span>
                      <span className="trading-chart__entry-chip__at"> @ </span>
                      <span className="trading-chart__entry-chip__px">{fmt(order.entry)}</span>
                      <span className="trading-chart__entry-chip__arrow" aria-hidden>
                        {order.side === 'buy' ? '▲' : '▼'}
                      </span>
                    </div>
                  )}
                {showInteractiveOverlay &&
                  showBracketTagsOnChart &&
                  layout.tpTagTop != null &&
                  isBracketPrice(order.tp) && (
                    <div
                      className={`trading-chart__line-tag trading-chart__line-tag--tp${
                        tpDisplay?.up
                          ? ' trading-chart__line-tag--profit'
                          : ' trading-chart__line-tag--loss'
                      }${dimClass}`}
                      style={{ top: layout.tpTagTop, touchAction: 'none' }}
                      onPointerDown={(e) => {
                        if (e.button !== 0) return
                        if (e.target.closest('.trading-chart__line-tag__x')) return
                        e.stopPropagation()
                        e.preventDefault()
                        startDragFromTag(layout.orderId, 'tp', e)
                      }}
                    >
                      <span className="trading-chart__line-tag__qty">{Math.abs(order.qty)}</span>
                      <span className="trading-chart__line-tag__sep"> | </span>
                      <span
                        className={
                          tpDisplay
                            ? tpDisplay.up
                              ? 'trading-chart__line-tag__usd trading-chart__line-tag__usd--profit'
                              : 'trading-chart__line-tag__usd trading-chart__line-tag__usd--loss'
                            : 'trading-chart__line-tag__usd'
                        }
                      >
                        {tpDisplay ? tpDisplay.text : '—'}
                      </span>
                      <button
                        type="button"
                        className="trading-chart__line-tag__x"
                        aria-label="Remove take profit"
                        onClick={() => clearTpLine(layout.orderId)}
                      >
                        ×
                      </button>
                    </div>
                  )}
                {showInteractiveOverlay &&
                  showBracketTagsOnChart &&
                  layout.slTagTop != null &&
                  isBracketPrice(order.sl) && (
                    <div
                      className={`trading-chart__line-tag trading-chart__line-tag--sl${
                        slDisplay?.up
                          ? ' trading-chart__line-tag--profit'
                          : ' trading-chart__line-tag--loss'
                      }${dimClass}`}
                      style={{ top: layout.slTagTop, touchAction: 'none' }}
                      onPointerDown={(e) => {
                        if (e.button !== 0) return
                        if (e.target.closest('.trading-chart__line-tag__x')) return
                        e.stopPropagation()
                        e.preventDefault()
                        startDragFromTag(layout.orderId, 'sl', e)
                      }}
                    >
                      <span className="trading-chart__line-tag__qty">{Math.abs(order.qty)}</span>
                      <span className="trading-chart__line-tag__sep"> | </span>
                      <span
                        className={
                          slDisplay
                            ? slDisplay.up
                              ? 'trading-chart__line-tag__usd trading-chart__line-tag__usd--profit'
                              : 'trading-chart__line-tag__usd trading-chart__line-tag__usd--loss'
                            : 'trading-chart__line-tag__usd'
                        }
                      >
                        {slDisplay ? slDisplay.text : '—'}
                      </span>
                      <button
                        type="button"
                        className="trading-chart__line-tag__x"
                        aria-label="Remove stop loss"
                        onClick={() => clearSlLine(layout.orderId)}
                      >
                        ×
                      </button>
                    </div>
                  )}
                {showPositionBar && (
                  <div
                    className={
                      (layout.inProfit
                        ? 'trading-chart__position-bar trading-chart__position-bar--profit'
                        : 'trading-chart__position-bar trading-chart__position-bar--loss') +
                      (layout.isSelected
                        ? ''
                        : ' trading-chart__position-bar--compact')
                    }
                    style={{ top: layout.positionBarTop }}
                    role="toolbar"
                    aria-label={
                      layout.isSelected ? 'Selected position' : `Position ${shortOrderLabel(order)}`
                    }
                    onPointerDown={(e) => {
                      if (layout.isSelected) return
                      e.stopPropagation()
                      selectOrder(layout.orderId)
                    }}
                  >
                    {layout.isSelected && tradingPrefs.reversePositionButton && !isPlatformMode && (
                      <button
                        type="button"
                        className="trading-chart__position-bar__reverse"
                        title="Reverse position (flip long/short)"
                        aria-label="Reverse position"
                        onClick={reversePosition}
                      >
                        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
                          <path
                            fill="currentColor"
                            d="M3 4h8v2l3-3-3-3v2H3v4H1V4h2zm8 6H3V8l-3 3 3 3v-2h8V8h2v4h-2z"
                          />
                        </svg>
                      </button>
                    )}
                    {layout.isSelected && showConfirmDiscard && (
                      <>
                        <button
                          type="button"
                          className="trading-chart__position-bar__discard"
                          onClick={(e) => {
                            e.stopPropagation()
                            discardOrderEdit()
                          }}
                        >
                          Discard
                        </button>
                        <button
                          type="button"
                          className="trading-chart__position-bar__confirm"
                          onClick={(e) => {
                            e.stopPropagation()
                            confirmOrderEdit()
                          }}
                        >
                          Confirm
                        </button>
                      </>
                    )}
                    {layout.isSelected && (
                      <>
                        <button
                          type="button"
                          className={
                            tpActive
                              ? 'trading-chart__position-bar__tp trading-chart__position-bar__btn--active'
                              : 'trading-chart__position-bar__tp'
                          }
                          title={
                            !isBracketPrice(order.tp)
                              ? 'Click chart to add TP for this position'
                              : 'Toggle drag to move TP line'
                          }
                          onClick={handlePositionTp}
                        >
                          TP
                        </button>
                        <button
                          type="button"
                          className={
                            slActive
                              ? 'trading-chart__position-bar__sl trading-chart__position-bar__btn--active'
                              : 'trading-chart__position-bar__sl'
                          }
                          title={
                            !isBracketPrice(order.sl)
                              ? 'Click chart to add SL for this position'
                              : 'Toggle drag to move SL line'
                          }
                          onClick={handlePositionSl}
                        >
                          SL
                        </button>
                      </>
                    )}
                    <span
                      className={
                        layout.inProfit
                          ? 'trading-chart__position-bar__size trading-chart__position-bar__size--profit'
                          : 'trading-chart__position-bar__size trading-chart__position-bar__size--loss'
                      }
                    >
                      {layout.isSelected ? selectedQtyLabel : orderQtyLabel}
                    </span>
                    <span
                      className={
                        barPnl?.up
                          ? 'trading-chart__position-bar__usd trading-chart__position-bar__usd--profit'
                          : 'trading-chart__position-bar__usd trading-chart__position-bar__usd--loss'
                      }
                    >
                      {barPnl && tradingPrefs.showPnL ? (
                        tradingPrefs.pnlPositionUnit === 'percent' && barPnl.pct != null ? (
                          <>
                            {barPnl.pct >= 0 ? '+ ' : '− '}
                            {Math.abs(barPnl.pct).toFixed(2)}%
                          </>
                        ) : (
                          <>
                            {barPnl.value >= 0 ? '+ ' : '− '}
                            {Math.abs(barPnl.value).toFixed(2)} USD
                          </>
                        )
                      ) : (
                        '— USD'
                      )}
                    </span>
                    {layout.isSelected && (
                      <button
                        type="button"
                        className="trading-chart__position-bar__close"
                        aria-label="Close position"
                        onClick={() => closeOrder(layout.orderId)}
                      >
                        ×
                      </button>
                    )}
                  </div>
                )}
              </Fragment>
            )
          })}
                {chartPrefs.floatingLastPricePill &&
          priceTagTop != null &&
          displayClose != null && (
          <div
            className={
              displayClose >= (last?.open ?? displayClose)
                ? 'trading-chart__price-tag trading-chart__price-tag--up'
                : 'trading-chart__price-tag trading-chart__price-tag--down'
            }
            style={{ top: priceTagTop }}
          >
            <span className="trading-chart__price-tag__price">{fmt(displayClose)}</span>
              <span
                className="trading-chart__price-tag__timer"
                role="timer"
                aria-live="polite"
                aria-label={`Candle closes in ${candleCountdown}`}
              >
                {candleCountdown}
            </span>
          </div>
        )}
      </div>

      <ChartSettingsModal
        open={settingsOpen}
        activeTab={settingsTab}
        onTabChange={setSettingsTab}
        draftChartPrefs={draftChartPrefs}
        patchDraftChartPrefs={patchDraftChartPrefs}
        draftChartType={draftChartType}
        setDraftChartType={setDraftChartType}
        draftTradingPrefs={draftTradingPrefs}
        patchDraftTradingPrefs={patchDraftTradingPrefs}
        chartTypeOptions={CHART_TYPES}
        symbol={symbol}
        intervalLabel={intervalDisplayLabel(interval, intervals)}
        onOk={commitSettings}
        onCancel={cancelSettings}
        onFitChart={() => chartRef.current?.timeScale().fitContent()}
        onOpenIndicators={handleOpenIndicatorsFromSettings}
      />
    </div>
  )
}

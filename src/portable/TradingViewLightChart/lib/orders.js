/** Chart position / order model (demo paper trading). */

export const LS_ORDERS = 'tv_lc_orders'

export function createOrderId() {
  return `order-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export function createOrder({ side, qty, entry, tp = null, sl = null }) {
  return {
    id: createOrderId(),
    side,
    qty,
    entry,
    tp: tp ?? null,
    sl: sl ?? null,
    committedTp: tp ?? null,
    committedSl: sl ?? null,
  }
}

export function orderPriceLevelEqual(a, b) {
  if (a == null && b == null) return true
  if (a == null || b == null) return false
  if (typeof a !== 'number' || typeof b !== 'number') return false
  const scale = Math.max(1, Math.abs(a), Math.abs(b))
  return Math.abs(a - b) <= 1e-9 * scale
}

export function orderHasPendingBracketEdits(order) {
  if (!order) return false
  return (
    !orderPriceLevelEqual(order.tp, order.committedTp) ||
    !orderPriceLevelEqual(order.sl, order.committedSl)
  )
}

export function commitOrderBrackets(order) {
  return {
    ...order,
    committedTp: order.tp ?? null,
    committedSl: order.sl ?? null,
  }
}

export function discardOrderBracketEdits(order) {
  return {
    ...order,
    tp: order.committedTp ?? null,
    sl: order.committedSl ?? null,
  }
}

export function isBracketPrice(val) {
  const n = Number(val)
  return Number.isFinite(n) && n > 0
}

export function resolveBracketPrice(val) {
  return isBracketPrice(val) ? Number(val) : null
}

/** Green when position is in profit at mark, red when in loss. */
export function positionToneFromPnl(order, markPrice) {
  const pnl = calcUnrealizedPnl(order, markPrice)
  if (!pnl) return { up: true, color: '#0ECB81', lossColor: '#F6465D', profitColor: '#0ECB81' }
  return {
    up: pnl.up,
    color: pnl.up ? '#0ECB81' : '#F6465D',
    lossColor: '#F6465D',
    profitColor: '#0ECB81',
  }
}

export function calcUnrealizedPnl(order, markPrice) {
  if (!order || markPrice == null) return null
  const sign = order.side === 'buy' ? 1 : -1
  const diff = (markPrice - order.entry) * sign
  const value = diff * order.qty
  const pct = order.entry ? (diff / order.entry) * 100 : 0
  return { value, pct, up: value >= 0 }
}

export function formatBracketDisplay(order, targetPrice, unit, showPnL) {
  if (!order || targetPrice == null || !showPnL) return null
  const sign = order.side === 'buy' ? 1 : -1
  if (unit === 'percent') {
    if (!order.entry) return null
    const raw = ((targetPrice - order.entry) / order.entry) * 100 * sign
    return { text: `${raw >= 0 ? '+' : ''}${raw.toFixed(2)}%`, up: raw >= 0 }
  }
  const usd = (targetPrice - order.entry) * sign * order.qty
  return {
    text: `${usd >= 0 ? '+' : ''}${usd.toFixed(2)} USD`,
    up: usd >= 0,
  }
}

export function signedQtyLabel(order) {
  if (!order) return ''
  const sign = order.side === 'sell' ? '-' : ''
  return `${sign}${Math.abs(order.qty)}`
}

export function shortOrderLabel(order) {
  if (!order) return ''
  return `${order.side === 'buy' ? 'L' : 'S'} ${Math.abs(order.qty)}`
}

export function readOrdersFromStorage() {
  try {
    const raw = localStorage.getItem(LS_ORDERS)
    if (!raw) return []
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr)) return []
    return arr
      .filter((o) => o && typeof o.id === 'string')
      .map((o) => ({
        ...o,
        committedTp: o.committedTp ?? o.tp ?? null,
        committedSl: o.committedSl ?? o.sl ?? null,
      }))
  } catch {
    return []
  }
}

export function writeOrdersToStorage(orders) {
  try {
    localStorage.setItem(LS_ORDERS, JSON.stringify(orders))
  } catch {
    /* ignore */
  }
}

/** Chart trading / position UI preferences (TradingView-style where applicable). */

export const LS_TRADING_PREFS = 'tv_lc_trading_prefs'

export const DEFAULT_TRADING_PREFS = {
  /** Bottom order ticket (qty, TP/SL, place order). */
  showOrderTicket: true,
  /** After moving TP/SL, commit immediately without Confirm / Discard. */
  oneClickTrading: false,
  /** Entry chip, bracket rail, floating TP/SL tags, position toolbar on chart. */
  showPositionsOnChart: true,
  /** “Reverse” control on the floating position bar. */
  reversePositionButton: true,
  /** Entry chip at last bar (size @ price). */
  showEntryChip: true,
  /** TP/SL line tags with qty / PnL hints. */
  showBracketTags: true,
  /** PnL on position bar and in bracket tags. */
  showPnL: true,
  /** `money` | `percent` for position bar unrealized PnL. */
  pnlPositionUnit: 'money',
  /** `money` | `percent` for TP/SL tag distance display. */
  pnlBracketUnit: 'money',
}

export function readTradingPrefs() {
  try {
    const raw = localStorage.getItem(LS_TRADING_PREFS)
    if (!raw) return { ...DEFAULT_TRADING_PREFS }
    return { ...DEFAULT_TRADING_PREFS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_TRADING_PREFS }
  }
}

export function writeTradingPrefs(prefs) {
  try {
    localStorage.setItem(LS_TRADING_PREFS, JSON.stringify(prefs))
  } catch {
    /* ignore */
  }
}

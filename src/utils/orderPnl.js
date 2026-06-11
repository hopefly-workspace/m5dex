/**
 * Open / closed order P&L helpers (OrdersPanel, chart, etc.)
 */

const n = (v) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

const nPos = (v) => {
  const x = n(v);
  return x > 0 ? x : 0;
};

/** Quantity / lots used for P&L — crypto uses coin qty, forex/india prefer contract qty. */
export function resolveQtyForPnl(orderMarketType, { lotSize, quantity, sizeFallback }) {
  const mt = String(orderMarketType || '').trim().toLowerCase();
  const lot = nPos(lotSize);
  const qty = nPos(quantity);
  const fallback = nPos(sizeFallback);
  if (mt === 'india') return qty > 0 ? qty : fallback;
  if (mt === 'forex') return lot > 0 ? lot : (qty > 0 ? qty : fallback);
  return qty > 0 ? qty : fallback;
}

/**
 * Unrealized / open position P&L (USDT or quote) + ROI % on margin when available.
 */
export function computeOpenPositionPnl({
  side,
  openPrice,
  currentPrice,
  qtyForPnl,
  usedMargin = 0,
  leverage = 0,
  totalAmt = 0,
  isIndiaOrder = false,
  inrPerUsdt = 88,
  orderMarketType = 'crypto',
  rawProfit = 0,
  rawProfitPercent = null,
}) {
  const entry = nPos(openPrice);
  const mark = nPos(currentPrice);
  const margin = nPos(usedMargin);
  const lev = nPos(leverage);
  const qty = nPos(qtyForPnl);
  const isSell = String(side || '').toLowerCase() === 'sell';
  const mt = String(orderMarketType || '').trim().toLowerCase();

  const apiPnl = n(rawProfit);
  const apiPctRaw = rawProfitPercent;
  const apiPct =
    apiPctRaw != null && apiPctRaw !== '' && Number.isFinite(Number(apiPctRaw))
      ? Number(apiPctRaw)
      : null;

  let profit = 0;

  if (mt === 'crypto' && qty > 0 && entry > 0 && mark > 0) {
    profit = (isSell ? entry - mark : mark - entry) * qty;
  } else {
    const priceMovePct = entry > 0 && mark > 0 ? (mark - entry) / entry : 0;
    let fallbackNotional = qty > 0 && entry > 0 ? qty * entry : n(totalAmt);
    if (isIndiaOrder && fallbackNotional > 0) {
      const rate = nPos(inrPerUsdt) || 88;
      fallbackNotional = fallbackNotional / rate;
    }
    let notionalExposure = 0;
    if (margin > 0 && lev > 0) {
      notionalExposure = margin * lev;
    } else if (fallbackNotional > 0) {
      notionalExposure = fallbackNotional;
    } else if (margin > 0) {
      notionalExposure = margin;
    }
    if (notionalExposure > 0 && priceMovePct !== 0) {
      const directionalPct = isSell ? -priceMovePct : priceMovePct;
      profit = directionalPct * notionalExposure;
    }
  }

  if (Math.abs(profit) < 1e-12 && Math.abs(apiPnl) > 1e-12) {
    profit = apiPnl;
  }

  let profitPercent = 0;

  if (apiPct != null && Math.abs(apiPct) > 1e-12) {
    const useApiPct =
      Math.abs(apiPnl) > 1e-12 && Math.abs(profit - apiPnl) <= Math.max(1, Math.abs(apiPnl) * 0.02);
    if (useApiPct || Math.abs(profit) < 1e-12) {
      profitPercent = apiPct;
      if (Math.abs(profit) < 1e-12 && Math.abs(apiPnl) > 1e-12) profit = apiPnl;
    }
  }

  if (Math.abs(profitPercent) < 1e-12) {
    if (margin > 0) {
      profitPercent = (profit / margin) * 100;
    } else if (entry > 0 && mark > 0) {
      const move = (mark - entry) / entry;
      const directional = isSell ? -move : move;
      profitPercent = directional * (lev > 0 ? lev : 1) * 100;
    } else {
      let fallbackNotional = qty > 0 && entry > 0 ? qty * entry : n(totalAmt);
      if (isIndiaOrder && fallbackNotional > 0) {
        fallbackNotional /= nPos(inrPerUsdt) || 88;
      }
      if (fallbackNotional > 0) profitPercent = (profit / fallbackNotional) * 100;
    }
  }

  if (profit !== 0 && profitPercent !== 0 && Math.sign(profit) !== Math.sign(profitPercent)) {
    profitPercent = Math.abs(profitPercent) * Math.sign(profit);
  }

  return {
    profit: Number.isFinite(profit) ? profit : 0,
    profitPercent: Number.isFinite(profitPercent) ? profitPercent : 0,
  };
}

/** Closed trade ROI % — margin first, then implied leverage, then notional. */
export function computeClosedPositionPnlPercent(profit, entryPx, qty, usedMargin, totalAmt, leverage) {
  const pnl = n(profit);
  const margin = nPos(usedMargin);
  if (margin > 0) return (pnl / margin) * 100;
  const lev = nPos(leverage);
  const q = nPos(qty);
  const entry = nPos(entryPx);
  const notional = entry > 0 && q > 0 ? entry * q : 0;
  if (lev > 0 && notional > 0) {
    const implied = notional / lev;
    if (implied > 0) return (pnl / implied) * 100;
  }
  const ta = nPos(totalAmt);
  if (ta > 0) return (pnl / ta) * 100;
  if (notional > 0) return (pnl / notional) * 100;
  return 0;
}

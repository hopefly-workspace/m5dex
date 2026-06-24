/**
 * Crypto Futures Liquidation Calculator – PRD-aligned (price.md).
 *
 * Inputs: entryPrice (EP), margin (IM), leverage (L), positionType (LONG/SHORT).
 * Exchange: maintenanceMarginRate (MMR) = 0.004, feeRate = 0 optional.
 *
 * Step 1 – Position size (notional): positionNotional = margin * leverage
 * Step 2 – Liq price (cross margin, size-dependent):
 *   LONG:  liqPrice = EP × (1 + MMR − B/P)
 *   SHORT: liqPrice = EP × (1 − MMR + B/P)
 * Where B = wallet balance, P = position notional. Different size → different P → accurate liq.
 */

const DEFAULT_MMR = 0.004;

function parseNum(v) {
  if (v === '' || v == null) return null;
  const n = Number(v);
  return Number.isNaN(n) || n < 0 ? null : n;
}

/**
 * Position notional from margin (PRD): positionNotional = margin * leverage.
 * @param {number} margin - Invested margin (IM) in quote
 * @param {number} leverage - Leverage (L)
 * @returns {number} Position notional in quote (0 if invalid)
 */
export function getPositionNotionalFromMargin(margin, leverage) {
  const m = parseNum(margin);
  const l = parseNum(leverage);
  if (m == null || l == null || l < 1) return 0;
  return m * l;
}

/**
 * LONG liquidation price – cross margin (Binance/Bybit style).
 * LP_long = EP × (1 + MMR − B/P). B = wallet, P = position notional.
 * @param {number} entryPrice - EP
 * @param {number} walletBalance - B in quote
 * @param {number} positionNotional - P in quote (margin * leverage)
 * @param {number} [mmr] - Maintenance margin rate (default 0.004)
 * @returns {number|null}
 */
export function getLiquidationPriceLong(entryPrice, walletBalance, positionNotional, mmr = DEFAULT_MMR) {
  const ep = parseNum(entryPrice);
  const B = parseNum(walletBalance);
  const P = parseNum(positionNotional);
  if (ep == null || ep <= 0 || P == null || P <= 0) return null;
  const bal = B != null && B >= 0 ? B : 0;
  const ratio = bal / P;
  const m = mmr ?? DEFAULT_MMR;
  const factor = 1 + m - ratio;
  if (factor <= 0) return null;
  const liq = ep * factor;
  return liq > 0 ? liq : null;
}

/**
 * SHORT liquidation price – cross margin.
 * LP_short = EP × (1 − MMR + B/P).
 * @param {number} entryPrice - EP
 * @param {number} walletBalance - B in quote
 * @param {number} positionNotional - P in quote
 * @param {number} [mmr] - Maintenance margin rate (default 0.004)
 * @returns {number|null}
 */
export function getLiquidationPriceShort(entryPrice, walletBalance, positionNotional, mmr = DEFAULT_MMR) {
  const ep = parseNum(entryPrice);
  const B = parseNum(walletBalance);
  const P = parseNum(positionNotional);
  if (ep == null || ep <= 0 || P == null || P <= 0) return null;
  const bal = B != null && B >= 0 ? B : 0;
  const ratio = bal / P;
  const m = mmr ?? DEFAULT_MMR;
  const factor = 1 - m + ratio;
  if (factor <= 0) return null;
  const liq = ep * factor;
  return liq > 0 ? liq : null;
}

/**
 * Isolated margin liquidation (common retail FX/CFD style).
 * Initial margin rate = 1/L. Maintenance ≈ mmr on notional at liq.
 * Long: liq below entry — P_liq = EP × (1 − 1/L + mmr)
 * Short: liq above entry — P_liq = EP × (1 + 1/L − mmr)
 */
export function getLiquidationPriceIsolatedLong(entryPrice, leverage, mmr = DEFAULT_MMR) {
  const ep = parseNum(entryPrice);
  const L = parseNum(leverage);
  const m = mmr ?? DEFAULT_MMR;
  if (ep == null || ep <= 0 || L == null || L < 1 || m < 0 || m >= 1) return null;
  const factor = 1 - 1 / L + m;
  if (factor <= 0 || factor >= 1) return null;
  const liq = ep * factor;
  return liq > 0 && liq < ep ? liq : null;
}

export function getLiquidationPriceIsolatedShort(entryPrice, leverage, mmr = DEFAULT_MMR) {
  const ep = parseNum(entryPrice);
  const L = parseNum(leverage);
  const m = mmr ?? DEFAULT_MMR;
  if (ep == null || ep <= 0 || L == null || L < 1 || m < 0 || m >= 1) return null;
  const factor = 1 + 1 / L - m;
  if (factor <= 1) return null;
  const liq = ep * factor;
  return liq > 0 && liq > ep ? liq : null;
}

/**
 * Cost (position notional) for display.
 * When sizeIsMargin === true (PRD): cost = margin * leverage = size * leverage.
 * When sizeIsMargin === false: cost = size (size already notional).
 * @param {string|number} size - Margin (IM) or notional per sizeIsMargin
 * @param {number} leverage - Leverage
 * @param {boolean} [sizeIsMargin=true] - If true, size = margin → cost = size * leverage
 * @returns {number}
 */
export function getOrderCost(size, leverage, sizeIsMargin = true) {
  const s = parseNum(size);
  const l = parseNum(leverage);
  if (s == null) return 0;
  if (sizeIsMargin && l != null && l >= 1) return s * l;
  return s;
}

/**
 * Max position notional: availableBalance * leverage (PRD).
 * @param {number} availableBalance
 * @param {number} leverage
 * @returns {number}
 */
export function getMaxNotional(availableBalance, leverage) {
  const bal = parseNum(availableBalance);
  const l = parseNum(leverage);
  if (bal == null || bal < 0) return 0;
  const lev = l != null && l >= 1 ? l : 1;
  return bal * lev;
}

/**
 * Initial margin for an order: position notional ÷ leverage.
 * @param {number} notional - Order value in quote (USDT / INR notional as applicable)
 * @param {number} leverage
 * @returns {number}
 */
export function getOrderMargin(notional, leverage) {
  const n = parseNum(notional);
  const l = parseNum(leverage);
  if (n == null || n <= 0 || l == null || l < 1) return 0;
  return n / l;
}

/**
 * USDT-margined linear contract: liquidation when equity equals maintenance on mark.
 * Equity = walletBalance + Q×(mark−entry); maintenance ≈ MMR×Q×mark.
 * Long: solve W + Q(P−E) = MMR×Q×P → P = (Q×E − W) / (Q×(1−MMR)). Valid only if P < entry.
 * @param {number} walletBalanceUsdt - Cross wallet USDT (e.g. available balance preview).
 */
export function getLiquidationPriceLinearLong(entryPrice, quantity, walletBalanceUsdt, mmr = DEFAULT_MMR) {
  const ep = parseNum(entryPrice);
  const q = parseNum(quantity);
  const W = parseNum(walletBalanceUsdt);
  if (ep == null || ep <= 0 || q == null || q <= 0) return null;
  const bal = W != null && W >= 0 ? W : 0;
  const m = mmr ?? DEFAULT_MMR;
  if (m >= 1) return null;
  const den = q * (1 - m);
  if (den <= 0) return null;
  const num = q * ep - bal;
  if (num <= 0) return null;
  const p = num / den;
  if (!Number.isFinite(p) || p <= 0 || p >= ep) return null;
  return p;
}

/**
 * Short: W + Q×(E−P) = MMR×Q×P → P = (W + Q×E) / (Q×(1+MMR)). Valid only if P > entry.
 */
export function getLiquidationPriceLinearShort(entryPrice, quantity, walletBalanceUsdt, mmr = DEFAULT_MMR) {
  const ep = parseNum(entryPrice);
  const q = parseNum(quantity);
  const W = parseNum(walletBalanceUsdt);
  if (ep == null || ep <= 0 || q == null || q <= 0) return null;
  const bal = W != null && W >= 0 ? W : 0;
  const m = mmr ?? DEFAULT_MMR;
  const den = q * (1 + m);
  if (den <= 0) return null;
  const num = bal + q * ep;
  const p = num / den;
  if (!Number.isFinite(p) || p <= 0 || p <= ep) return null;
  return p;
}

/**
 * Format liq price for display; returns '--' when invalid.
 * @param {(n: number, decimals: number) => string} formatFn
 * @param {(n: number) => number} [getDecimals] - optional (e.g. getPriceDecimals(n, 'forex'))
 */
export function formatLiquidationPrice(liqPrice, formatFn, getDecimals) {
  if (liqPrice == null || liqPrice <= 0 || Number.isNaN(liqPrice)) return '--';
  const decimals =
    typeof getDecimals === 'function'
      ? getDecimals(liqPrice)
      : liqPrice >= 10000
        ? 0
        : liqPrice >= 1
          ? 2
          : liqPrice >= 0.01
            ? 4
            : 6;
  return formatFn(liqPrice, decimals);
}

/** Fallback INR per 1 USDT when profile `usdtvalue` is missing or invalid. */
export const INDIA_INR_PER_USDT = 85;

function resolveInrPerUsdt(inrPerUsdt) {
  const r = Number(inrPerUsdt);
  return Number.isFinite(r) && r > 0 ? r : INDIA_INR_PER_USDT;
}

/**
 * * Forex margin notional (USDT): lots × quoted price.
 * Units per lot from API apply to order `quantity` only, not margin math.
 */
// export function getIndiaNotionalInr(lotSize, quantity, priceInr) {
//   const l = Number(lotSize);
//   const q = Number(quantity);
//   const p = Number(priceInr);
// export function getForexMarginNotionalUsdt(lots, price) {
//   const l = Number(lots);
//   const p = Number(price);
//   if (!Number.isFinite(l) || l <= 0 || !Number.isFinite(p) || p <= 0) return 0;
//   return l * p;
export function getForexMarginNotionalUsdt(lots, quantityPerLot, price) {
  return getForexContractNotionalUsdt(lots, quantityPerLot, price);
}

/** Full contract exposure (USDT): lots × units-per-lot × price — informational only. */
export function getForexContractNotionalUsdt(lots, quantityPerLot, price) {
  const l = Number(lots);
  const q = Number(quantityPerLot);
  const p = Number(price);
  if (!Number.isFinite(l) || l <= 0 || !Number.isFinite(q) || q <= 0 || !Number.isFinite(p) || p <= 0) {
    return 0;
  }
  return l * q * p;
}

/**
 * Notional in INR: total quantity × price (quantity already includes lots × units-per-lot).
 */
export function getIndiaNotionalInr(_lotSize, quantity, priceInr) {
  const q = Number(quantity);
  const p = Number(priceInr);
  if (!Number.isFinite(q) || q <= 0 || !Number.isFinite(p) || p <= 0) {
    return 0;
  }
  return q * p;
}


/**
 * Required initial margin in INR: notionalINR / leverage.
 */
export function getIndiaMarginInr(lotSize, quantity, priceInr, leverage) {
  const notionalInr = getIndiaNotionalInr(lotSize, quantity, priceInr);
  const lev = Number(leverage);
  if (!Number.isFinite(lev) || lev < 1 || notionalInr <= 0) return 0;
  return notionalInr / lev;
}

/**
 * Required margin in USDT for Indian market:
 * marginINR = notional / leverage, then marginUSDT = marginINR / inrPerUsdt (profile `usdtvalue` or fallback).
 * @param {number} [inrPerUsdt] - INR per 1 USDT; defaults to {@link INDIA_INR_PER_USDT}
 */
export function getIndiaMarginUsdt(lotSize, quantity, priceInr, leverage, inrPerUsdt = INDIA_INR_PER_USDT) {
  const marginInr = getIndiaMarginInr(lotSize, quantity, priceInr, leverage);
  if (marginInr <= 0) return 0;
  const rate = resolveInrPerUsdt(inrPerUsdt);
  return marginInr / rate;
}

/** Max quantity (lots × units) for given balance (USDT), lot, price (INR), leverage. */
// export function getIndiaMaxQuantity(lotSize, priceInr, leverage, availableUsdt, inrPerUsdt = INDIA_INR_PER_USDT) {
//   const l = Number(lotSize);
/** Max total quantity (units) for given balance (USDT), price (INR), leverage. */
export function getIndiaMaxQuantity(_lotSize, priceInr, leverage, availableUsdt, inrPerUsdt = INDIA_INR_PER_USDT) {
  const p = Number(priceInr);
  const lev = Number(leverage);
  const b = Number(availableUsdt);
  // if (!Number.isFinite(l) || l <= 0 || !Number.isFinite(p) || p <= 0 || !Number.isFinite(lev) || lev < 1) {
  if (!Number.isFinite(p) || p <= 0 || !Number.isFinite(lev) || lev < 1) {
    return 0;
  }
  if (!Number.isFinite(b) || b < 0) return 0;
  const rate = resolveInrPerUsdt(inrPerUsdt);
  // return (b * lev * rate) / (l * p);
  return (b * lev * rate) / p;
}

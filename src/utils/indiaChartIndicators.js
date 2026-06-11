const INDICATOR_DEFS = [
  { id: 'sma20', label: 'SMA 20', type: 'sma', period: 20, color: '#f59e0b' },
  { id: 'sma50', label: 'SMA 50', type: 'sma', period: 50, color: '#22c55e' },
  { id: 'ema20', label: 'EMA 20', type: 'ema', period: 20, color: '#60a5fa' },
  { id: 'ema50', label: 'EMA 50', type: 'ema', period: 50, color: '#a78bfa' },
  { id: 'ema200', label: 'EMA 200', type: 'ema', period: 200, color: '#f43f5e' },
  { id: 'vwap', label: 'VWAP', type: 'vwap', color: '#14b8a6' },
];

export function getIndiaIndicatorDefs() {
  return INDICATOR_DEFS;
}

function asLinePoint(time, value) {
  if (!Number.isFinite(value)) return null;
  return { time, value };
}

function computeSma(candles, period) {
  const out = [];
  let sum = 0;
  for (let i = 0; i < candles.length; i += 1) {
    const close = Number(candles[i]?.close);
    if (!Number.isFinite(close)) continue;
    sum += close;
    if (i >= period) {
      const oldClose = Number(candles[i - period]?.close);
      if (Number.isFinite(oldClose)) sum -= oldClose;
    }
    if (i >= period - 1) {
      const p = asLinePoint(candles[i].time, sum / period);
      if (p) out.push(p);
    }
  }
  return out;
}

function computeEma(candles, period) {
  const out = [];
  const alpha = 2 / (period + 1);
  let ema = null;
  let warmupCount = 0;
  let warmupSum = 0;

  for (let i = 0; i < candles.length; i += 1) {
    const close = Number(candles[i]?.close);
    if (!Number.isFinite(close)) continue;

    if (ema == null) {
      warmupSum += close;
      warmupCount += 1;
      if (warmupCount === period) {
        ema = warmupSum / period;
      }
    } else {
      ema = close * alpha + ema * (1 - alpha);
    }

    if (ema != null) {
      const p = asLinePoint(candles[i].time, ema);
      if (p) out.push(p);
    }
  }
  return out;
}

function computeVwap(candles) {
  const out = [];
  let cumulativePv = 0;
  let cumulativeVol = 0;
  for (const c of candles) {
    const high = Number(c?.high);
    const low = Number(c?.low);
    const close = Number(c?.close);
    const volume = Number(c?.volume);
    if (![high, low, close, volume].every(Number.isFinite) || volume <= 0) continue;
    const typical = (high + low + close) / 3;
    cumulativePv += typical * volume;
    cumulativeVol += volume;
    if (cumulativeVol <= 0) continue;
    const p = asLinePoint(c.time, cumulativePv / cumulativeVol);
    if (p) out.push(p);
  }
  return out;
}

export function buildIndicatorSeries(candlesWithVolume, indicatorIds) {
  const defs = getIndiaIndicatorDefs();
  const idSet = new Set(Array.isArray(indicatorIds) ? indicatorIds : []);
  const result = new Map();

  for (const def of defs) {
    if (!idSet.has(def.id)) continue;
    if (def.type === 'sma') {
      result.set(def.id, computeSma(candlesWithVolume, def.period));
      continue;
    }
    if (def.type === 'ema') {
      result.set(def.id, computeEma(candlesWithVolume, def.period));
      continue;
    }
    if (def.type === 'vwap') {
      result.set(def.id, computeVwap(candlesWithVolume));
    }
  }

  return result;
}

const DAY_TIMEFRAMES = new Set(['1day', '1week']);

function toIstDateString(isoLike) {
  const d = new Date(isoLike);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function toUnixSeconds(isoLike) {
  const ms = Date.parse(isoLike);
  if (!Number.isFinite(ms)) return null;
  return Math.floor(ms / 1000);
}

/**
 * @param {string} isoDatetime
 * @param {string} timeframe API timeframe (1day, 1hour, …)
 * @returns {import('lightweight-charts').Time | null}
 */
export function apiDatetimeToChartTime(isoDatetime, timeframe) {
  const tf = String(timeframe || '1day').toLowerCase();
  if (DAY_TIMEFRAMES.has(tf)) {
    const day = toIstDateString(isoDatetime);
    return day || null;
  }
  const sec = toUnixSeconds(isoDatetime);
  return sec != null ? sec : null;
}

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Normalize API rows → lightweight-charts candlestick + histogram data.
 * Dedupes by `time` (last row wins), sorts ascending.
 *
 * @param {Array<{ datetime?: string, open?: number, high?: number, low?: number, close?: number, volume?: number }>} rows
 * @param {string} timeframe
 */
export function transformIndiaCandles(rows, timeframe) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { candles: [], volumes: [] };
  }

  const byTime = new Map();

  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const rawT = row.datetime ?? row.date ?? row.Date ?? row.time;
    if (rawT == null || rawT === '') continue;
    const time = apiDatetimeToChartTime(String(rawT), timeframe);
    if (time == null) continue;

    const open = num(row.open);
    const high = num(row.high);
    const low = num(row.low);
    const close = num(row.close);
    const volume = num(row.volume);

    byTime.set(time, { time, open, high, low, close, volume });
  }

  const merged = Array.from(byTime.values()).sort((a, b) => {
    const ta = typeof a.time === 'number' ? a.time : String(a.time);
    const tb = typeof b.time === 'number' ? b.time : String(b.time);
    if (ta < tb) return -1;
    if (ta > tb) return 1;
    return 0;
  });

  const candles = merged.map(({ time, open, high, low, close }) => ({
    time,
    open,
    high,
    low,
    close,
  }));

  const volumes = merged.map(({ time, open, close, volume }) => ({
    time,
    value: volume,
    color:
      close >= open ? 'rgba(38, 166, 154, 0.45)' : 'rgba(239, 83, 80, 0.45)',
  }));

  return { candles, volumes };
}

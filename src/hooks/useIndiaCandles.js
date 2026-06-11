import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchIndiaCandles } from '../services/indiaCandlesApi';
import { marketPairToYahooSymbol } from '../utils/indiaYahooSymbol';
import { transformIndiaCandles } from '../utils/indiaCandlesTransform';

const DAY_TIMEFRAMES = new Set(['1day', '1week']);

function computeRangeIso(timeframe) {
  const end = new Date();
  const start = new Date(end);
  const tf = String(timeframe || '1day').toLowerCase();

  switch (tf) {
    case '1min':
      start.setDate(start.getDate() - 5);
      break;
    case '5min':
      start.setDate(start.getDate() - 21);
      break;
    case '15min':
      start.setDate(start.getDate() - 45);
      break;
    case '1hour':
      start.setDate(start.getDate() - 120);
      break;
    case '1week':
      start.setFullYear(start.getFullYear() - 12);
      break;
    case '1day':
    default:
      start.setFullYear(start.getFullYear() - 3);
      break;
  }

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

function chunkMsForTimeframe(timeframe) {
  const tf = String(timeframe || '1day').toLowerCase();
  switch (tf) {
    case '1min':
      return 5 * 24 * 60 * 60 * 1000;
    case '5min':
      return 21 * 24 * 60 * 60 * 1000;
    case '15min':
      return 45 * 24 * 60 * 60 * 1000;
    case '1hour':
      return 120 * 24 * 60 * 60 * 1000;
    case '1week':
      return 12 * 365 * 24 * 60 * 60 * 1000;
    case '1day':
    default:
      return 3 * 365 * 24 * 60 * 60 * 1000;
  }
}

function cmpTime(a, b) {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  const sa = String(a);
  const sb = String(b);
  if (sa < sb) return -1;
  if (sa > sb) return 1;
  return 0;
}

function mergeByTime(rows) {
  const byTime = new Map();
  for (const item of rows) {
    if (!item || item.time == null) continue;
    byTime.set(item.time, item);
  }
  return Array.from(byTime.values()).sort((a, b) => cmpTime(a.time, b.time));
}

function oldestChartTimeToIso(chartTime, timeframe) {
  if (chartTime == null) return new Date().toISOString();
  const tf = String(timeframe || '1day').toLowerCase();

  if (DAY_TIMEFRAMES.has(tf)) {
    const day = String(chartTime).trim();
    const d = new Date(`${day}T00:00:00+05:30`);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }

  if (typeof chartTime === 'number' && Number.isFinite(chartTime)) {
    return new Date(chartTime * 1000).toISOString();
  }

  const d = new Date(String(chartTime));
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

/**
 * Historical candles for Indian markets (Yahoo-style symbol on your `/candles` API).
 */
export function useIndiaCandles(marketPair, timeframe) {
  const [candles, setCandles] = useState([]);
  const [volumes, setVolumes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMoreHistory, setHasMoreHistory] = useState(true);

  const yahooSymbol = useMemo(() => marketPairToYahooSymbol(marketPair), [marketPair]);

  const runFetch = useCallback(
    async (signal) => {
      if (!yahooSymbol) {
        setCandles([]);
        setVolumes([]);
        setError('Missing symbol');
        setHasMoreHistory(false);
        return;
      }

      const { start, end } = computeRangeIso(timeframe);
      setLoading(true);
      setError(null);
      setHasMoreHistory(true);

      try {
        const rows = await fetchIndiaCandles({
          symbol: yahooSymbol,
          start,
          end,
          timeframe,
          signal,
        });
        const { candles: c, volumes: v } = transformIndiaCandles(rows, timeframe);
        setCandles(c);
        setVolumes(v);
        setHasMoreHistory(c.length > 0);
      } catch (e) {
        if (signal?.aborted || e?.code === 'ERR_CANCELED') return;
        setCandles([]);
        setVolumes([]);
        setError(e?.message || 'Failed to load candles');
        setHasMoreHistory(false);
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [yahooSymbol, timeframe]
  );

  useEffect(() => {
    const ac = new AbortController();
    runFetch(ac.signal);
    return () => ac.abort();
  }, [runFetch]);

  const reload = useCallback(() => runFetch(undefined), [runFetch]);

  const loadOlder = useCallback(async () => {
    if (loading || loadingMore || !hasMoreHistory || !yahooSymbol || candles.length === 0) {
      return false;
    }

    setLoadingMore(true);
    setError(null);

    try {
      const oldest = candles[0]?.time;
      const endIso = oldestChartTimeToIso(oldest, timeframe);
      const endMs = Date.parse(endIso);
      if (!Number.isFinite(endMs)) {
        setHasMoreHistory(false);
        return false;
      }
      const startIso = new Date(endMs - chunkMsForTimeframe(timeframe)).toISOString();

      const rows = await fetchIndiaCandles({
        symbol: yahooSymbol,
        start: startIso,
        end: endIso,
        timeframe,
      });

      const { candles: olderCandles, volumes: olderVolumes } = transformIndiaCandles(rows, timeframe);
      if (olderCandles.length === 0) {
        setHasMoreHistory(false);
        return false;
      }

      const oldestCurrent = candles[0]?.time;
      const strictlyOlderCandles = olderCandles.filter((x) => cmpTime(x.time, oldestCurrent) < 0);
      const strictlyOlderVolumes = olderVolumes.filter((x) => cmpTime(x.time, oldestCurrent) < 0);

      if (strictlyOlderCandles.length === 0) {
        setHasMoreHistory(false);
        return false;
      }

      setCandles((prev) => mergeByTime([...strictlyOlderCandles, ...prev]));
      setVolumes((prev) => mergeByTime([...strictlyOlderVolumes, ...prev]));
      setHasMoreHistory(true);
      return true;
    } catch (e) {
      setError(e?.message || 'Failed to load older candles');
      return false;
    } finally {
      setLoadingMore(false);
    }
  }, [candles, hasMoreHistory, loading, loadingMore, timeframe, yahooSymbol]);

  return {
    yahooSymbol,
    candles,
    volumes,
    loading,
    loadingMore,
    hasMoreHistory,
    error,
    reload,
    loadOlder,
  };
}

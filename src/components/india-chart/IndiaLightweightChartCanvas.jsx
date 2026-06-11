import { useEffect, useLayoutEffect, useRef } from 'react';
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  CrosshairMode,
  PriceScaleMode,
} from 'lightweight-charts';
import { buildIndicatorSeries, getIndiaIndicatorDefs } from '../../utils/indiaChartIndicators';

function chartLayoutOptions(isDark) {
  return {
    background: { color: isDark ? '#0A0E17' : '#ffffff' },
    textColor: isDark ? '#d1d4dc' : '#131722',
    fontSize: 12,
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  };
}

function gridOptions(isDark) {
  const c = isDark ? 'rgba(42, 46, 57, 0.55)' : 'rgba(42, 46, 57, 0.18)';
  return {
    vertLines: { color: c },
    horzLines: { color: c },
  };
}

function candleSeriesOptions(isDark) {
  return {
    upColor: isDark ? '#26a69a' : '#089981',
    downColor: isDark ? '#ef5350' : '#f23645',
    borderVisible: false,
    wickUpColor: isDark ? '#26a69a' : '#089981',
    wickDownColor: isDark ? '#ef5350' : '#f23645',
    priceFormat: {
      type: 'price',
      precision: 2,
      minMove: 0.01,
    },
  };
}

function lineSeriesOptions(isDark) {
  return {
    color: isDark ? '#60a5fa' : '#2962ff',
    lineWidth: 2,
    crosshairMarkerVisible: false,
    priceLineVisible: false,
  };
}

function toScaleMode(mode) {
  if (mode === 'log') return PriceScaleMode.Logarithmic;
  if (mode === 'percent') return PriceScaleMode.Percentage;
  return PriceScaleMode.Normal;
}

/**
 * TradingView Lightweight Charts™ — candlesticks + volume, resize-aware, theme-aware.
 */
export default function IndiaLightweightChartCanvas({
  candles,
  volumes,
  isDark,
  onCrosshairRow,
  onNeedOlderData,
  canLoadOlder = false,
  loadingMore = false,
  chartType = 'candles',
  priceMode = 'normal',
  indicators = [],
}) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const mainSeriesRef = useRef(null);
  const mainSeriesTypeRef = useRef('candles');
  const volRef = useRef(null);
  const indicatorSeriesRef = useRef(new Map());
  const indicatorDefsRef = useRef(getIndiaIndicatorDefs());
  const crosshairCbRef = useRef(onCrosshairRow);
  const olderDataCbRef = useRef(onNeedOlderData);
  const canLoadOlderRef = useRef(canLoadOlder);
  const loadingMoreRef = useRef(loadingMore);
  const prevFirstTimeRef = useRef(null);
  const prevLengthRef = useRef(0);

  useEffect(() => {
    crosshairCbRef.current = onCrosshairRow;
  }, [onCrosshairRow]);

  useEffect(() => {
    olderDataCbRef.current = onNeedOlderData;
  }, [onNeedOlderData]);

  useEffect(() => {
    canLoadOlderRef.current = canLoadOlder;
  }, [canLoadOlder]);

  useEffect(() => {
    loadingMoreRef.current = loadingMore;
  }, [loadingMore]);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;

    const chart = createChart(el, {
      autoSize: true,
      layout: chartLayoutOptions(isDark),
      grid: gridOptions(isDark),
      crosshair: {
        mode: CrosshairMode.MagnetOHLC,
        vertLine: {
          width: 1,
          color: isDark ? 'rgba(209, 212, 220, 0.35)' : 'rgba(19, 23, 34, 0.35)',
          style: 0,
        },
        horzLine: {
          width: 1,
          color: isDark ? 'rgba(209, 212, 220, 0.35)' : 'rgba(19, 23, 34, 0.35)',
          style: 0,
        },
      },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.06, bottom: 0.22 },
      },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 4,
        barSpacing: 6,
        fixLeftEdge: false,
        fixRightEdge: false,
      },
      localization: {
        locale: 'en-IN',
        dateFormat: 'dd MMM yyyy',
      },
    });

    const mainSeries =
      chartType === 'line'
        ? chart.addSeries(LineSeries, lineSeriesOptions(isDark))
        : chart.addSeries(CandlestickSeries, candleSeriesOptions(isDark));
    const volSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: '',
      color: 'rgba(120, 123, 134, 0.5)',
    });
    volSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
    });

    chartRef.current = chart;
    mainSeriesRef.current = mainSeries;
    mainSeriesTypeRef.current = chartType === 'line' ? 'line' : 'candles';
    volRef.current = volSeries;

    const onCross = (param) => {
      const cb = crosshairCbRef.current;
      if (!cb) return;
      if (!param?.time || param.point === undefined) {
        cb(null);
        return;
      }
      const activeSeries = mainSeriesRef.current;
      if (!activeSeries) return;
      const row = param.seriesData?.get(activeSeries);
      if (!row) {
        cb(null);
        return;
      }
      const vRow = param.seriesData?.get(volSeries);
      let volume = null;
      if (vRow && typeof vRow.value === 'number' && Number.isFinite(vRow.value)) {
        volume = vRow.value;
      }
      cb({
        time: param.time,
        open: row.open ?? row.value ?? null,
        high: row.high ?? row.value ?? null,
        low: row.low ?? row.value ?? null,
        close: row.close ?? row.value ?? null,
        volume,
      });
    };
    chart.subscribeCrosshairMove(onCross);

    const onVisibleLogicalRangeChanged = (range) => {
      if (!range) return;
      if (!canLoadOlderRef.current || loadingMoreRef.current) return;

      const activeSeries = mainSeriesRef.current;
      if (!activeSeries) return;
      const barsInfo = activeSeries.barsInLogicalRange(range);
      if (!barsInfo) return;
      if (barsInfo.barsBefore == null) return;

      // Preload next history chunk before the user fully hits left edge.
      if (barsInfo.barsBefore < 30) {
        olderDataCbRef.current?.();
      }
    };
    chart.timeScale().subscribeVisibleLogicalRangeChange(onVisibleLogicalRangeChanged);

    return () => {
      chart.unsubscribeCrosshairMove(onCross);
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(onVisibleLogicalRangeChanged);
      chart.remove();
      chartRef.current = null;
      mainSeriesRef.current = null;
      volRef.current = null;
      indicatorSeriesRef.current = new Map();
    };
    // Chart is created once; `isDark` updates use `applyOptions` in the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    const mainSeries = mainSeriesRef.current;
    const volSeries = volRef.current;
    if (!chart || !mainSeries || !volSeries) return;

    chart.applyOptions({
      layout: chartLayoutOptions(isDark),
      grid: gridOptions(isDark),
      crosshair: {
        mode: CrosshairMode.MagnetOHLC,
        vertLine: {
          color: isDark ? 'rgba(209, 212, 220, 0.35)' : 'rgba(19, 23, 34, 0.35)',
        },
        horzLine: {
          color: isDark ? 'rgba(209, 212, 220, 0.35)' : 'rgba(19, 23, 34, 0.35)',
        },
      },
    });
    if (chartType === 'line') {
      mainSeries.applyOptions(lineSeriesOptions(isDark));
    } else {
      mainSeries.applyOptions(candleSeriesOptions(isDark));
    }
  }, [isDark, chartType]);

  useEffect(() => {
    const chart = chartRef.current;
    const mainSeries = mainSeriesRef.current;
    const volSeries = volRef.current;
    if (!chart || !mainSeries || !volSeries) return;

    const prevLen = prevLengthRef.current;
    const prevFirst = prevFirstTimeRef.current;
    const nextFirst = candles[0]?.time ?? null;
    const timeScale = chart.timeScale();
    const prevRange = timeScale.getVisibleLogicalRange();

    if (mainSeriesTypeRef.current !== chartType) {
      chart.removeSeries(mainSeries);
      const nextMain =
        chartType === 'line'
          ? chart.addSeries(LineSeries, lineSeriesOptions(isDark))
          : chart.addSeries(CandlestickSeries, candleSeriesOptions(isDark));
      mainSeriesRef.current = nextMain;
      mainSeriesTypeRef.current = chartType;
    }

    const activeMain = mainSeriesRef.current;
    if (!activeMain) return;

    if (chartType === 'line') {
      activeMain.setData(candles.map((c) => ({ time: c.time, value: c.close })));
    } else {
      activeMain.setData(candles);
    }
    volSeries.setData(volumes);

    const volumeByTime = new Map(volumes.map((v) => [v.time, v.value]));
    const candlesWithVolume = candles.map((c) => ({
      ...c,
      volume: Number(volumeByTime.get(c.time) ?? 0),
    }));
    const indicatorDataMap = buildIndicatorSeries(candlesWithVolume, indicators);
    const defsById = new Map(indicatorDefsRef.current.map((d) => [d.id, d]));
    const existing = indicatorSeriesRef.current;
    const selected = new Set(indicators);

    for (const [id, series] of existing.entries()) {
      if (!selected.has(id)) {
        chart.removeSeries(series);
        existing.delete(id);
      }
    }

    for (const id of selected) {
      if (!existing.has(id)) {
        const def = defsById.get(id);
        if (!def) continue;
        const s = chart.addSeries(LineSeries, {
          color: def.color,
          lineWidth: 1.5,
          lastValueVisible: false,
          priceLineVisible: false,
          crosshairMarkerVisible: false,
        });
        existing.set(id, s);
      }
      existing.get(id)?.setData(indicatorDataMap.get(id) || []);
    }

    chart.priceScale('right').applyOptions({
      mode: toScaleMode(priceMode),
    });

    // Keep viewport stable if older candles were prepended.
    const wasPrepended =
      prevLen > 0 &&
      candles.length > prevLen &&
      prevFirst != null &&
      nextFirst != null &&
      prevFirst !== nextFirst;
    if (wasPrepended && prevRange) {
      const addedBars = candles.length - prevLen;
      timeScale.setVisibleLogicalRange({
        from: prevRange.from + addedBars,
        to: prevRange.to + addedBars,
      });
    } else if (prevLen === 0 && candles.length > 0) {
      timeScale.fitContent();
    }

    prevLengthRef.current = candles.length;
    prevFirstTimeRef.current = nextFirst;
  }, [candles, volumes, chartType, indicators, isDark, priceMode]);

  return <div ref={containerRef} className="india-lw-chart-canvas" />;
}

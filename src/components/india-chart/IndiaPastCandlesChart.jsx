import { useCallback, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useIndiaCandles } from '../../hooks/useIndiaCandles';
import IndiaLightweightChartCanvas from './IndiaLightweightChartCanvas';
import IndiaChartToolbar from './IndiaChartToolbar';
import IndiaChartCrosshairLegend from './IndiaChartCrosshairLegend';
import '../../styles/components/IndiaCandlesChart.css';

/**
 * Indian equities / derivatives — historical OHLCV from your `/candles` backend
 * (Yahoo symbol) rendered with TradingView Lightweight Charts™.
 */
export default function IndiaPastCandlesChart({ marketPair }) {
  const { isDark } = useTheme();
  const [timeframe, setTimeframe] = useState('1day');
  const [chartType, setChartType] = useState('candles');
  const [priceMode, setPriceMode] = useState('normal');
  const [indicators, setIndicators] = useState(['ema20', 'ema50', 'vwap']);
  const {
    yahooSymbol,
    candles,
    volumes,
    loading,
    loadingMore,
    hasMoreHistory,
    error,
    reload,
    loadOlder,
  } = useIndiaCandles(
    marketPair,
    timeframe
  );
  const [crosshairRow, setCrosshairRow] = useState(null);
  const [manualReload, setManualReload] = useState(false);

  const onCrosshairRow = useCallback((row) => {
    setCrosshairRow(row);
  }, []);

  const handleReload = useCallback(async () => {
    setManualReload(true);
    try {
      await reload();
    } finally {
      setManualReload(false);
    }
  }, [reload]);

  return (
    <div className="india-candles-chart">
      <IndiaChartToolbar
        yahooSymbol={yahooSymbol}
        timeframe={timeframe}
        onTimeframeChange={setTimeframe}
        chartType={chartType}
        onChartTypeChange={setChartType}
        priceMode={priceMode}
        onPriceModeChange={setPriceMode}
        indicators={indicators}
        onIndicatorsChange={setIndicators}
        onReload={handleReload}
        reloading={manualReload}
      />
      {error && (
        <div className="india-candles-chart__banner" role="alert">
          {error}
        </div>
      )}
      <div className="india-candles-chart__pane">
        {loading && candles.length === 0 && (
          <div className="india-candles-chart__loading">
            <Loader2 className="india-candles-chart__spinner" size={28} aria-hidden />
            <span>Loading market history…</span>
          </div>
        )}
        <IndiaLightweightChartCanvas
          candles={candles}
          volumes={volumes}
          isDark={isDark}
          onCrosshairRow={onCrosshairRow}
          onNeedOlderData={loadOlder}
          canLoadOlder={hasMoreHistory}
          loadingMore={loadingMore}
          chartType={chartType}
          priceMode={priceMode}
          indicators={indicators}
        />
        {loadingMore && <div className="india-candles-chart__loading-more">Loading older candles…</div>}
        <IndiaChartCrosshairLegend row={crosshairRow} />
      </div>
    </div>
  );
}

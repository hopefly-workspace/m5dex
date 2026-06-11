import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, RefreshCw } from 'lucide-react';
import { INDIA_CHART_TIMEFRAMES } from '../../constants/indiaChartTimeframes';
import { getIndiaIndicatorDefs } from '../../utils/indiaChartIndicators';

export default function IndiaChartToolbar({
  yahooSymbol,
  timeframe,
  onTimeframeChange,
  chartType,
  onChartTypeChange,
  priceMode,
  onPriceModeChange,
  indicators,
  onIndicatorsChange,
  onReload,
  reloading,
}) {
  const [openMenu, setOpenMenu] = useState(null);
  const menuRootRef = useRef(null);
  const indicatorDefs = useMemo(() => getIndiaIndicatorDefs(), []);

  useEffect(() => {
    const onDocClick = (e) => {
      if (!menuRootRef.current?.contains(e.target)) setOpenMenu(null);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const tfLabel =
    INDIA_CHART_TIMEFRAMES.find((x) => x.id === timeframe)?.label ||
    timeframe;
  const chartTypeLabel = chartType === 'line' ? 'Line' : 'Candles';
  const priceModeLabel = priceMode === 'log' ? 'Log' : priceMode === 'percent' ? '%' : 'Normal';

  const toggleIndicator = (id) => {
    const set = new Set(Array.isArray(indicators) ? indicators : []);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    onIndicatorsChange(Array.from(set));
  };

  return (
    <div className="india-candles-chart__toolbar" ref={menuRootRef}>
      <div className="india-candles-chart__symbol">
        <span className="india-candles-chart__symbol-label">NSE / BSE (Yahoo)</span>
        <code className="india-candles-chart__symbol-code">{yahooSymbol || '—'}</code>
      </div>

      <div className="india-candles-chart__controls">
        <div className="india-candles-chart__menu-wrap">
          <button
            type="button"
            className="india-candles-chart__menu-trigger"
            onClick={() => setOpenMenu((p) => (p === 'tf' ? null : 'tf'))}
          >
            Interval: {tfLabel} <ChevronDown size={14} />
          </button>
          {openMenu === 'tf' && (
            <div className="india-candles-chart__menu">
              {INDIA_CHART_TIMEFRAMES.map((x) => (
                <button
                  key={x.id}
                  type="button"
                  className={`india-candles-chart__menu-item ${timeframe === x.id ? 'active' : ''}`}
                  onClick={() => {
                    onTimeframeChange(x.id);
                    setOpenMenu(null);
                  }}
                >
                  {x.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="india-candles-chart__menu-wrap">
          <button
            type="button"
            className="india-candles-chart__menu-trigger"
            onClick={() => setOpenMenu((p) => (p === 'chart' ? null : 'chart'))}
          >
            Type: {chartTypeLabel} <ChevronDown size={14} />
          </button>
          {openMenu === 'chart' && (
            <div className="india-candles-chart__menu">
              <button
                type="button"
                className={`india-candles-chart__menu-item ${chartType === 'candles' ? 'active' : ''}`}
                onClick={() => {
                  onChartTypeChange('candles');
                  setOpenMenu(null);
                }}
              >
                Candles
              </button>
              <button
                type="button"
                className={`india-candles-chart__menu-item ${chartType === 'line' ? 'active' : ''}`}
                onClick={() => {
                  onChartTypeChange('line');
                  setOpenMenu(null);
                }}
              >
                Line
              </button>
            </div>
          )}
        </div>

        <div className="india-candles-chart__menu-wrap">
          <button
            type="button"
            className="india-candles-chart__menu-trigger"
            onClick={() => setOpenMenu((p) => (p === 'price' ? null : 'price'))}
          >
            Scale: {priceModeLabel} <ChevronDown size={14} />
          </button>
          {openMenu === 'price' && (
            <div className="india-candles-chart__menu">
              <button
                type="button"
                className={`india-candles-chart__menu-item ${priceMode === 'normal' ? 'active' : ''}`}
                onClick={() => {
                  onPriceModeChange('normal');
                  setOpenMenu(null);
                }}
              >
                Normal
              </button>
              <button
                type="button"
                className={`india-candles-chart__menu-item ${priceMode === 'percent' ? 'active' : ''}`}
                onClick={() => {
                  onPriceModeChange('percent');
                  setOpenMenu(null);
                }}
              >
                Percent
              </button>
              <button
                type="button"
                className={`india-candles-chart__menu-item ${priceMode === 'log' ? 'active' : ''}`}
                onClick={() => {
                  onPriceModeChange('log');
                  setOpenMenu(null);
                }}
              >
                Log
              </button>
            </div>
          )}
        </div>

        <div className="india-candles-chart__menu-wrap">
          <button
            type="button"
            className="india-candles-chart__menu-trigger"
            onClick={() => setOpenMenu((p) => (p === 'ind' ? null : 'ind'))}
          >
            Indicators ({indicators.length}) <ChevronDown size={14} />
          </button>
          {openMenu === 'ind' && (
            <div className="india-candles-chart__menu india-candles-chart__menu--wide">
              {indicatorDefs.map((def) => {
                const checked = indicators.includes(def.id);
                return (
                  <label key={def.id} className="india-candles-chart__menu-check">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleIndicator(def.id)}
                    />
                    <span>{def.label}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      </div>
      <button
        type="button"
        className="india-candles-chart__reload"
        onClick={onReload}
        disabled={reloading}
        aria-label="Reload chart data"
      >
        <RefreshCw size={16} className={reloading ? 'india-candles-chart__spin' : ''} />
      </button>
    </div>
  );
}

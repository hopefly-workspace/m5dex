import { formatPrice } from '../../utils/helper';

function formatVol(n) {
  if (n == null || !Number.isFinite(n)) return '—';
  if (n >= 1e7) return `${(n / 1e7).toFixed(2)} Cr`;
  if (n >= 1e5) return `${(n / 1e5).toFixed(2)} L`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(2)} K`;
  return String(Math.round(n));
}

/** OHLCV readout for the bar under the crosshair (desktop-style strip). */
export default function IndiaChartCrosshairLegend({ row }) {
  if (!row) return null;
  return (
    <div className="india-candles-chart__legend">
      <span className="india-candles-chart__legend-item">O {formatPrice(row.open, { marketType: 'india' })}</span>
      <span className="india-candles-chart__legend-item">H {formatPrice(row.high, { marketType: 'india' })}</span>
      <span className="india-candles-chart__legend-item">L {formatPrice(row.low, { marketType: 'india' })}</span>
      <span className="india-candles-chart__legend-item">C {formatPrice(row.close, { marketType: 'india' })}</span>
      <span className="india-candles-chart__legend-item">Vol {formatVol(row.volume)}</span>
    </div>
  );
}

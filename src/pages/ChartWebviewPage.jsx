import { memo, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import DashboardTradingChart from '../components/DashboardTradingChart';
import { normalizeChartPairSymbol } from '../lib/chartPlatformOrders';
import { INTERVALS } from '../portable/TradingViewLightChart/lib/binanceApi';
import '../styles/pages/ChartWebviewPage.css';

const INTERVAL_IDS = new Set(INTERVALS.map((x) => x.id));
const DEFAULT_INTERVAL = '15m';

/** Decode path segment — Flutter often passes BTCUSDT; allow URL-encoded chars */
function pairFromSegment(seg) {
  if (seg == null || seg === '') return '';
  try {
    return normalizeChartPairSymbol(decodeURIComponent(seg));
  } catch {
    return normalizeChartPairSymbol(seg);
  }
}

function resolveInterval(raw) {
  if (raw == null || raw === '') return DEFAULT_INTERVAL;
  const trimmed = String(raw).trim();
  return INTERVAL_IDS.has(trimmed) ? trimmed : DEFAULT_INTERVAL;
}

/**
 * Standalone crypto chart for Flutter (or native) WebView.
 *
 * Routes:
 * - `/webview/crypto-chart?pair=BTCUSDT`
 * - `/webview/crypto-chart/BTCUSDT`
 *
 * Query `pair` (or alias `symbol`) wins over path. Optional `interval=15m` (see INTERVALS in binanceApi).
 *
 * Does not require login: candles load from the chart adapter.
 * TP/SL lines appear when the WebView shares the same auth cookies / storage as the main app (`tokenStorage.hasToken()`).
 */
function ChartWebviewPage() {
  const [searchParams] = useSearchParams();
  const { pairSymbol: pairPath } = useParams();

  const { marketPair, chartInterval } = useMemo(() => {
    const qp =
      searchParams.get('pair')?.trim() ||
      searchParams.get('symbol')?.trim() ||
      '';
    const fromPath = pairFromSegment(pairPath);
    const raw = qp ? qp : pairPath ? fromPath : '';
    const symbol = normalizeChartPairSymbol(raw) || 'BTCUSDT';
    const interval = resolveInterval(searchParams.get('interval'));
    return { marketPair: symbol, chartInterval: interval };
  }, [pairPath, searchParams]);

  return (
    <div className="chart-webview-page" data-testid="chart-webview-root">
      <DashboardTradingChart
        marketPair={marketPair}
        marketType="crypto"
        embedMode
        chartInterval={chartInterval}
      />
    </div>
  );
}

export default memo(ChartWebviewPage);

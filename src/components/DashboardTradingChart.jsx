import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AdvancedRealTimeChart } from 'react-ts-tradingview-widgets';
import { Maximize, Minimize2 } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import {
  TradingChart,
  createBlockcrypBinanceAdapter,
} from '../portable/TradingViewLightChart';
import { useChartOpenPositions } from '../hooks/useChartOpenPositions';
import {
  buildPlatformTpSlPayload,
  normalizeChartPairSymbol,
} from '../lib/chartPlatformOrders';
import { updateOrderTpSl } from '../services/tradingApi';
import IndiaPastCandlesChart from './india-chart/IndiaPastCandlesChart';
import '../styles/components/DashboardTradingChart.css';

const cryptoChartAdapter = createBlockcrypBinanceAdapter({
  blockcrypRestBase: 'https://froxchart.blockcryp.com/api',
  blockcrypWsBase: 'wss://froxchart.blockcryp.com',
  binanceRestBase: 'https://api.binance.com/api/v3',
});

const TV_WIDGET_THEME = {
  dark: {
    theme: 'dark',
    backgroundColor: '#000205',
    textColor: '#FFFFFF',
    fontColor: '#FFFFFF',
  },
  light: {
    theme: 'light',
    backgroundColor: '#FFFFFF',
    textColor: '#0F172A',
    fontColor: '#0F172A',
  },
};

function livePriceFromMarketData(marketData) {
  const n = Number(
    marketData?.price ??
      marketData?.p ??
      marketData?.last ??
      marketData?.index ??
      marketData?.ltp ??
      0,
  );
  return Number.isFinite(n) && n > 0 ? n : null;
}

function DashboardTradingChart({
  marketPair,
  marketType,
  marketData,
  refreshTrigger = 0,
  tradingSessionClosed = false,
  tradingSessionMessage = '',
  /** Hide chrome (e.g. fullscreen) when embedded in Flutter WebView or iframe */
  embedMode = false,
  /** Candle interval passed to TradingChart (crypto only), e.g. "15m" */
  chartInterval = '15m',
}) {
  const { isDark } = useTheme();
  const { showSuccess, showError } = useToast();
  const chartRef = useRef(null);
  const [isFullScreen, setIsFullScreen] = useState(false);

  const chartColorScheme = isDark ? 'dark' : 'light';
  const tvWidgetTheme = TV_WIDGET_THEME[chartColorScheme];

  const marketKind = String(marketType || '').trim().toLowerCase();
  const isIndia = marketKind === 'india';
  const isCrypto = marketKind === 'crypto';

  const chartSymbol = useMemo(
    () => normalizeChartPairSymbol(marketPair) || 'BTCUSDT',
    [marketPair],
  );

  const { chartOrders, openPositionCount, reconnect: reconnectOpenOrders } =
    useChartOpenPositions({
      chartSymbol,
      marketType: marketKind,
      refreshTrigger,
      enabled: isCrypto,
    });

  const livePrice = useMemo(
    () => livePriceFromMarketData(marketData),
    [marketData],
  );

  const handlePlatformTpSlCommit = useCallback(
    async (chartOrder, { tp, sl }) => {
      if (tradingSessionClosed) {
        showError(
          tradingSessionMessage ||
            'Market is closed. You cannot update TP/SL until the session opens.',
          5000,
        );
        throw new Error('market closed');
      }
      const price = livePrice ?? (Number(chartOrder?.entry) || 0);
      if (!Number.isFinite(price) || price <= 0) {
        showError('Live price unavailable — cannot update TP/SL');
        throw new Error('no live price');
      }
      const payload = buildPlatformTpSlPayload(chartOrder, { tp, sl }, price);
      if (!payload.pair || payload.orderno == null) {
        showError('Invalid order — missing pair or order number');
        throw new Error('invalid order');
      }
      await updateOrderTpSl(payload);
      showSuccess('TP/SL updated on chart');
      reconnectOpenOrders();
    },
    [
      livePrice,
      tradingSessionClosed,
      tradingSessionMessage,
      showError,
      showSuccess,
      reconnectOpenOrders,
    ],
  );

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullScreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      chartRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  return (
    <div
      ref={chartRef}
      className={[
        'dashboard-chart-root',
        embedMode ? 'dashboard-chart-root--embed' : '',
        isDark ? 'dashboard-chart-root--dark' : 'dashboard-chart-root--light',
      ]
        .filter(Boolean)
        .join(' ')}
      data-chart-theme={chartColorScheme}
    >
      <div className="dashboard-chart-wrapper">
        {!embedMode && (
          <button
            type="button"
            onClick={toggleFullscreen}
            className="dashboard-chart-fs-btn"
            aria-label={isFullScreen ? 'Exit fullscreen' : 'Fullscreen chart'}
          >
            {isFullScreen ? (
              <Minimize2 size={18} strokeWidth={2.5} />
            ) : (
              <Maximize size={18} strokeWidth={2.5} />
            )}
          </button>
        )}
        {isIndia ? (
          <IndiaPastCandlesChart marketPair={marketPair} />
        ) : isCrypto ? (
          <TradingChart
            key={`${chartSymbol}-${chartColorScheme}`}
            className="dashboard-trading-chart"
            adapter={cryptoChartAdapter}
            defaultSymbol={chartSymbol}
            defaultInterval={chartInterval}
            initialBarLimit={200}
            maxDisplayPoints={1400}
            smoothMode
            showOrderTicket={false}
            showPositionsOnChart
            platformOrders={chartOrders}
            onPlatformTpSlCommit={handlePlatformTpSlCommit}
            platformOneClickTpSl
            tradingSessionClosed={tradingSessionClosed}
            externalLivePrice={livePrice}
            platformOpenPositionCount={openPositionCount}
            colorScheme={chartColorScheme}
          />
        ) : (
          <AdvancedRealTimeChart
            key={`${marketPair}-${chartColorScheme}`}
            symbol={marketPair}
            interval="15"
            timezone="UTC"
            theme={tvWidgetTheme.theme}
            style="1"
            locale="en"
            autosize
            enable_publishing={false}
            allow_symbol_change={false}
            hide_side_toolbar={false}
            height="100%"
            width="100%"
            backgroundColor={tvWidgetTheme.backgroundColor}
            textColor={tvWidgetTheme.textColor}
            fontSize={12}
            fontFamily="Arial"
            fontWeight={400}
            fontColor={tvWidgetTheme.fontColor}
            save_image
          />
        )}
      </div>
    </div>
  );
}

export default memo(DashboardTradingChart);

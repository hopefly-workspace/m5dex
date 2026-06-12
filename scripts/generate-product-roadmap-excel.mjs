#!/usr/bin/env node
/**
 * Generates ARK Frontend product roadmap Excel (pending, improvements, new features).
 * Run: node scripts/generate-product-roadmap-excel.mjs
 */
import * as XLSX from 'xlsx';
import { mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT_DIR = join(ROOT, 'docs');
const OUT_FILE = join(OUT_DIR, 'ARK_Frontend_Product_Roadmap.xlsx');

const COLUMNS = [
  'ID',
  'Category',
  'Module / Area',
  'Item Title',
  'Description',
  'Priority',
  'Status',
  'User / Business Impact',
  'Effort',
  'Code / File Reference',
  'Notes & Dependencies',
];

const pending = [
  ['P-001', 'Trading', 'TradingPanel', 'Close position tab (Open/Close)', 'Close tab shows "Coming soon" tooltip; only Open is active for new trades.', 'High', 'Pending', 'Users cannot close via panel tab — must use Orders panel', 'M', 'src/components/TradingPanel.jsx (~1772)', 'Close API exists in tradingApi.closeOrder — wire UI'],
  ['P-002', 'Trading', 'TradingPanel', 'Stop Limit order type', 'Stop Limit tab visible but form shows "coming soon".', 'High', 'Pending', 'Missing advanced order type vs competitors', 'L', 'src/components/TradingPanel.jsx (~2739)', 'Needs backend support + validation rules'],
  ['P-003', 'Profile', 'ConnectedExchanges', 'Exchange sync from profile', 'handleSync has TODO — no API call implemented.', 'High', 'Pending', 'Connected exchange balances may be stale', 'M', 'src/components/profile/ConnectedExchanges.jsx:122', 'Depends on /exchanges/{id}/sync API'],
  ['P-004', 'Profile', 'ConnectedExchanges', 'Exchange disconnect with 2FA', 'handleDisconnect has TODO — disconnect flow incomplete.', 'High', 'Pending', 'Security risk if disconnect is non-functional', 'M', 'src/components/profile/ConnectedExchanges.jsx:126', 'Require 2FA modal like other security actions'],
  ['P-005', 'Profile', 'ConnectedExchanges', 'Connect exchange (actual API)', 'Connect modal has TODO — exchange not actually linked.', 'High', 'Pending', 'Onboarding exchange flow is UI-only', 'L', 'src/components/profile/ConnectedExchanges.jsx:580', 'ExchangeConnection + API config pages exist separately'],
  ['P-006', 'Chart', 'TradingChart (Crypto)', 'Close position from chart (live orders)', 'closeOrder() returns early when platformOrders set — chart close button does nothing for real positions.', 'High', 'Pending', 'Crypto traders expect one-click close on chart like Binance', 'M', 'src/portable/TradingViewLightChart/components/TradingChart.jsx:1879', 'Wire to tradingApi.closeOrder via DashboardTradingChart prop'],
  ['P-007', 'Chart', 'India Dashboard', 'Open positions + TP/SL on India chart', 'India uses IndiaPastCandlesChart (historical only); no platformOrders overlay unlike crypto.', 'High', 'Pending', 'India traders cannot manage TP/SL visually on chart', 'XL', 'src/components/DashboardTradingChart.jsx', 'Extend useChartOpenPositions for india market type'],
  ['P-008', 'Chart', 'Forex / Metals / Indices', 'Native chart with platform orders', 'Non-crypto/non-India dashboard uses TradingView widget embed — no live TP/SL lines from platform.', 'Medium', 'Pending', 'Inconsistent UX across markets', 'XL', 'src/components/DashboardTradingChart.jsx:170', 'Build forex adapter or reuse portable chart'],
  ['P-009', 'India', 'TradingPanel', 'Lot size vs max buying power slider', 'India allocation slider UI is commented/hidden; lots entered manually only.', 'Medium', 'Partial', 'Slower order entry for India users', 'S', 'src/components/TradingPanel.jsx (~2107)', 'Slider math fixed but hidden pending product sign-off'],
  ['P-010', 'Payments', 'DepositFiat', 'Real bank account details', 'Bank detail shows placeholder XXXX-XXXX-XXXX-1234.', 'High', 'Pending', 'Fiat deposit instructions not production-ready', 'S', 'src/pages/DepositFiat.jsx:1115', 'Fetch from backend / admin config'],
  ['P-011', 'P2P', 'P2PTrading', 'Real payment account numbers', 'Multiple hardcoded XXXX-XXXX-1234 account strings in P2P flow.', 'High', 'Pending', 'P2P settlement details are demo placeholders', 'M', 'src/pages/P2PTrading.jsx', 'Integrate user bank/UPI from profile or API'],
  ['P-012', 'Support', 'HelpSupport', 'Real support phone number', 'Help page shows +91 XXXXX XXXXX placeholder.', 'Low', 'Pending', 'Users cannot reach support via displayed number', 'S', 'src/pages/HelpSupport.jsx:397', 'Use CMS or env config'],
  ['P-013', 'Onboarding', 'ExchangeConnectionSuccess', 'Mock connection fallback', 'Uses mock-connection-id when navigation state missing.', 'Medium', 'Partial', 'Dev/demo leak in production edge case', 'S', 'src/pages/ExchangeConnectionSuccess.jsx:17', 'Redirect to connect flow if no valid state'],
  ['P-014', 'Profile', 'KYCVerification', 'KYC nav in profile sidebar', 'Verification menu item commented out in ProfileSidebar.', 'Medium', 'Partial', 'KYC page exists but harder to discover', 'S', 'src/components/profile/ProfileSidebar.jsx:45', 'Re-enable when KYC flow stable'],
  ['P-015', 'i18n', 'Header', 'Full multi-language support', 'Language picker saves to localStorage but app strings are English-only.', 'Medium', 'Partial', 'Global users see UI in English only', 'XL', 'src/components/Header.jsx', 'Need i18n framework + translation files'],
  ['P-016', 'DevOps', 'Repository', 'CI/CD pipeline', 'No .github/workflows — no automated build/lint/test on PR.', 'High', 'Pending', 'Regressions reach production easily', 'M', 'Project root', 'Add GitHub Actions: lint, build, test'],
  ['P-017', 'QA', 'Testing', 'Automated test coverage', 'Only marketPrecisionValidator.test.js exists; no component/E2E tests.', 'High', 'Pending', 'High regression risk on trading flows', 'XL', 'src/utils/marketPrecisionValidator.test.js', 'Add Vitest + Playwright for critical paths'],
  ['P-018', 'DevOps', 'Environment', '.env.example documentation', 'No committed .env.example; new devs must guess VITE_* variables.', 'Medium', 'Pending', 'Onboarding friction', 'S', '.env (local)', 'Document all VITE_WS_* and VITE_BACKEND_URL vars'],
  ['P-019', 'Trading', 'price.md PRD', 'Liquidation price calculator UI', 'PRD exists in price.md but no dedicated calculator component in trading UI.', 'Medium', 'Pending', 'Traders lack pre-trade liquidation visibility', 'M', 'price.md', 'TP_SL_Modal shows liquidityPrice from API only'],
  ['P-020', 'Chart', 'Crypto (Performance)', 'QA: 6+ orders on chart', 'Performance optimizations done; needs validation with 6+ positions + fullscreen.', 'Medium', 'Partial', 'Edge case lag for heavy traders', 'S', 'TradingChart.jsx', 'From recent chart perf work'],
];

const improvements = [
  ['I-001', 'Performance', 'Build', 'Code splitting / bundle size', 'Main chunk ~1.1MB; Vite warns chunks >500KB. Lazy-load heavy pages further.', 'High', 'Recommended', 'Faster first load, better mobile', 'L', 'vite build output', 'Split Orders, Wallet, Profile chunks'],
  ['I-002', 'Code Quality', 'Legacy charts', 'Remove unused chart components', 'BinanceChart and old TradingChart.jsx still in repo; Dashboard comments reference them.', 'Medium', 'Recommended', 'Less maintenance confusion', 'M', 'src/components/BinanceChart.jsx', 'Verify no imports then delete'],
  ['I-003', 'Code Quality', 'ESLint', 'Fix lint debt (~1800 issues)', 'npm run lint reports many errors including react-hooks and no-undef.', 'High', 'Recommended', 'Catch bugs pre-release', 'XL', 'eslint across src/', 'Prioritize hooks + trading paths'],
  ['I-004', 'Chart', 'Crypto', 'Incremental order line sync', 'DONE: syncOrderLines + throttled overlay refresh instead of full rebuild per tick.', 'High', 'Done', 'Smooth chart with multiple orders', '—', 'TradingChart.jsx', 'Completed — monitor in production'],
  ['I-005', 'Chart', 'Crypto', 'Stable chartOrders reference', 'DONE: chartOrdersListSignature prevents WS tick re-renders.', 'High', 'Done', 'Less React churn on order WS', '—', 'useChartOpenPositions.js', 'Completed'],
  ['I-006', 'Reliability', 'WebSocket', 'Unified WS reconnection strategy', 'Multiple WS hooks (market, orders, notifications) with different retry logic.', 'Medium', 'Recommended', 'Fewer stale data / disconnect UX issues', 'L', 'src/hooks/, websocket.js', 'Single reconnect policy + UI indicator'],
  ['I-007', 'Reliability', 'API', 'Consistent error handling', 'Mix of try/catch, console.error, toast — standardize user-facing errors.', 'Medium', 'Recommended', 'Clearer failure messages for traders', 'M', 'src/services/api.js', 'Error code to toast mapping'],
  ['I-008', 'UX', 'Dashboard', 'India tick bid/ask normalization', 'Improved for margin/slider; keep monitoring live book quality.', 'Medium', 'Partial', 'Accurate India order sizing', 'S', 'src/pages/Dashboard.jsx', 'Recent fix — validate live feed'],
  ['I-009', 'UX', 'TradingPanel', 'India integer lot validation', 'DONE: integer-only lots, parseIndianLotCount fixes.', 'High', 'Done', 'Prevents invalid lot orders', '—', 'marketPrecisionValidator.js', 'Completed'],
  ['I-010', 'UX', 'IndianMarketsPage', 'Subscriptions & favourites API', 'DONE: batch subscribe, bulk favourites with india type payload.', 'High', 'Done', 'Reliable watchlist sync', '—', 'IndianMarketsPage.jsx', 'Completed'],
  ['I-011', 'Security', 'Production', 'Remove console noise in prod', 'Many console.warn/error in chart WS paths — strip or gate in production.', 'Low', 'Recommended', 'Cleaner console; slight perf', 'S', 'TradingChart.jsx', 'Vite define or custom plugin'],
  ['I-012', 'UX', 'Accessibility', 'Chart overlay keyboard access', 'TP/SL drag is pointer-only; add keyboard alternative for a11y.', 'Low', 'Recommended', 'Compliance + power users', 'M', 'TradingChart.jsx', 'WCAG 2.1 target'],
  ['I-013', 'UX', 'Network', 'Offline / reconnect UX', 'NoInternetScreen exists; extend to WS disconnect banners on dashboard.', 'Medium', 'Recommended', 'Users know when data is stale', 'M', 'NoInternetScreen.jsx', 'Link to NetworkContext'],
  ['I-014', 'Data', 'Orders', 'Excel export consistency', 'Orders + Wallet export xlsx; ensure pending orders tab parity.', 'Low', 'Recommended', 'Reporting parity for traders', 'S', 'src/pages/Orders.jsx', 'Wallet has multi-sheet export pattern'],
  ['I-015', 'Architecture', 'Portable chart', 'Forex/India custom adapters', 'Portable TradingViewLightChart supports adapters — unify chart codebase.', 'Medium', 'Recommended', 'One chart to maintain', 'XL', 'portable/TradingViewLightChart/', 'createCustomAdapter pattern'],
  ['I-016', 'UX', 'Dashboard', 'Order book hidden for India/Forex', 'showOrderBook excludes forex and india by design — document or revisit.', 'Low', 'Recommended', 'User expectation management', 'S', 'Dashboard.jsx:165', 'Product decision: add depth or explain'],
  ['I-017', 'Security', 'Error handling', 'Global error boundary', 'No React ErrorBoundary on routes — chart crash can blank dashboard.', 'Medium', 'Recommended', 'Graceful degradation', 'S', 'src/routes/index.jsx', 'Wrap Dashboard + chart'],
  ['I-018', 'Mobile', 'ChartWebviewPage', 'Flutter WebView chart polish', 'Standalone route exists; test auth cookie sharing for TP/SL in embedded app.', 'Medium', 'Recommended', 'Mobile app chart parity', 'M', 'ChartWebviewPage.jsx', 'Document WebView auth setup'],
];

const newFeatures = [
  ['N-001', 'Trading', 'TradingPanel', 'Stop Limit + Trailing Stop', 'Advanced order types beyond Limit/Market.', 'High', 'New', 'Competitive parity with major exchanges', 'L', 'TradingPanel.jsx', 'Backend order types required'],
  ['N-002', 'Trading', 'TradingPanel', 'One-click Close from panel', 'Activate Close tab with market/limit close flow.', 'High', 'New', 'Faster exit like Binance futures', 'M', 'TradingPanel + tradingApi', 'Depends on P-001'],
  ['N-003', 'Chart', 'All markets', 'Unified chart with live positions', 'Same TP/SL drag UX for Crypto, India, Forex on dashboard.', 'High', 'New', 'Single professional trading experience', 'XL', 'DashboardTradingChart.jsx', 'Depends on P-007, P-008'],
  ['N-004', 'Chart', 'Crypto', 'Close position from chart (API)', 'Platform mode close button calls closeOrder API with confirm.', 'High', 'New', 'Exchange-standard chart trading', 'M', 'TradingChart.jsx', 'Depends on P-006'],
  ['N-005', 'Trading', 'Risk tools', 'Liquidation price calculator', 'Interactive calculator from price.md PRD before placing order.', 'Medium', 'New', 'Risk-aware trading; fewer liquidations', 'M', 'price.md', 'Show in TradingPanel or TP/SL modal'],
  ['N-006', 'Trading', 'Risk tools', 'Position size calculator', 'Margin / notional / max loss calculator by % risk.', 'Medium', 'New', 'Better risk management for retail', 'M', 'TradingPanel.jsx', 'Works with leverage + balance'],
  ['N-007', 'Analytics', 'Dashboard', 'Portfolio P&L dashboard', 'Cross-market open P&L, daily/weekly summary widget.', 'High', 'New', 'Traders see total exposure at glance', 'L', 'New page or Dashboard widget', 'Aggregate open orders WS + REST'],
  ['N-008', 'Alerts', 'Chart', 'Price alerts on chart', 'Set alert at price level; notify via WS/email/push.', 'Medium', 'New', 'Retention + engagement', 'L', 'TradingChart + notifications API', 'ChartSettings mentions server alerts (demo)'],
  ['N-009', 'Social', 'Platform', 'Copy trading / signal follow', 'Follow top traders or share signals.', 'Low', 'New', 'User acquisition & stickiness', 'XL', 'New module', 'Requires backend strategy engine'],
  ['N-010', 'Education', 'Platform', 'Demo / paper trading mode', 'Risk-free practice with virtual balance.', 'Medium', 'New', 'Onboard beginners safely', 'L', 'TradingChart paper mode exists', 'Extend to full platform mode toggle'],
  ['N-011', 'India', 'Markets', 'Option chain on chart', 'Link IndiaPastCandlesChart with option chain from IndianMarketsPage.', 'Medium', 'New', 'Derivatives traders need OI/Greeks', 'L', 'IndianMarketsPage.jsx', 'Already has chain UI — integrate chart'],
  ['N-012', 'India', 'TradingPanel', 'Re-enable lot allocation slider', 'Visual % of max buying power for lot entry.', 'Medium', 'New', 'Faster India order entry', 'S', 'TradingPanel.jsx', 'Math ready — product enable'],
  ['N-013', 'Wallet', 'Finance', 'Tax / P&L export (FY)', 'Annual trade report for tax filing (India + crypto).', 'Medium', 'New', 'Compliance value for Indian users', 'L', 'Orders.jsx xlsx pattern', 'Aggregate history API'],
  ['N-014', 'Security', 'Profile', 'Passkey-first login', 'Promote WebAuthn passkey after signup (passkeyService exists).', 'Medium', 'New', 'Stronger account security', 'M', 'passkeyService.js', 'UX prompts on Profile security'],
  ['N-015', 'Notifications', 'Platform', 'Push notifications (web/mobile)', 'Beyond in-app WS — browser push for fills, margin calls.', 'High', 'New', 'Timely alerts when app backgrounded', 'L', 'LatestNotificationContext', 'FCM / Web Push integration'],
  ['N-016', 'Orders', 'Orders panel', 'Bulk modify TP/SL', 'Select multiple open positions → set TP/SL % or price.', 'Medium', 'New', 'Power user efficiency', 'M', 'OrdersPanel.jsx', 'Batch updateOrderTpSl API'],
  ['N-017', 'Markets', 'Discovery', 'Screener / heatmap', 'Top movers, volume spike, funding rate screen for crypto.', 'Medium', 'New', 'Discovery → more trades', 'L', 'Markets pages', 'New data feeds'],
  ['N-018', 'P2P', 'Payments', 'Escrow status tracker', 'Real-time P2P order timeline with dispute flow.', 'High', 'New', 'Trust in P2P product', 'L', 'P2PTrading.jsx', 'Replace placeholder accounts first'],
  ['N-019', 'Admin', 'Ops', 'Feature flags / maintenance mode', 'Toggle markets or trading without deploy.', 'Medium', 'New', 'Safer ops during incidents', 'M', 'Backend + frontend gate', 'checkTradingMarket pattern exists'],
  ['N-020', 'Performance', 'Infrastructure', 'CDN + edge caching for static', 'Optimize m5dex latency for SPA assets.', 'Low', 'New', 'Faster load worldwide', 'M', 'Deploy config', 'Cloudflare / similar'],
];

function rowsToSheet(data) {
  return [COLUMNS, ...data];
}

function setColumnWidths(ws, widths) {
  ws['!cols'] = widths.map((w) => ({ wch: w }));
}

function buildSummarySheet() {
  const generated = new Date().toISOString().slice(0, 10);
  return {
    name: 'Summary',
    rows: [
      ['ARK Frontend — Product Roadmap & Backlog'],
      ['Generated on', generated],
      ['Project', 'm5dex (ark_front)'],
      ['Stack', 'React 19 + Vite 7 + Lightweight Charts + Tailwind 4'],
      [],
      ['Sheet', 'Description', 'Count'],
      ['1-Pending', 'Incomplete / placeholder / TODO items verified in codebase', pending.length],
      ['2-Improvements', 'Quality, performance, UX upgrades (includes recently completed)', improvements.length],
      ['3-New Features', 'New capabilities for stronger product-market fit', newFeatures.length],
      [],
      ['Priority legend', 'Critical = revenue/security blocker | High = major UX gap | Medium | Low'],
      ['Effort legend', 'S = days | M = 1-2 weeks | L = 3-6 weeks | XL = 6+ weeks'],
      ['Status legend', 'Pending = not done | Partial = started/hidden | Done = completed | Recommended = improvement'],
      [],
      ['How this was built', 'Code scan: TODO comments, Coming soon UI, mock data, missing integrations, test/CI gaps, recent sprint items'],
    ],
    colWidths: [28, 52, 12],
  };
}

function appendSheet(wb, { name, rows, colWidths }) {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  if (colWidths) setColumnWidths(ws, colWidths);
  XLSX.utils.book_append_sheet(wb, ws, name);
}

mkdirSync(OUT_DIR, { recursive: true });

const wb = XLSX.utils.book_new();
const summary = buildSummarySheet();
appendSheet(wb, summary);
appendSheet(wb, {
  name: '1-Pending',
  rows: rowsToSheet(pending),
  colWidths: [8, 14, 22, 32, 48, 10, 10, 28, 8, 36, 36],
});
appendSheet(wb, {
  name: '2-Improvements',
  rows: rowsToSheet(improvements),
  colWidths: [8, 14, 22, 32, 48, 10, 12, 28, 8, 36, 36],
});
appendSheet(wb, {
  name: '3-New Features',
  rows: rowsToSheet(newFeatures),
  colWidths: [8, 14, 22, 32, 48, 10, 8, 28, 8, 36, 36],
});

XLSX.writeFile(wb, OUT_FILE);
console.log(`Created: ${OUT_FILE}`);

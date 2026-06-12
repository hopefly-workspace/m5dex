/**
 * Shared wallet API helpers – balance normalization and market-type mapping.
 * Used by Wallet page, TradingPanel, TransferModal, useWalletData, useMarketWalletBalance.
 */

import { tokenStorage } from '../utils/storage.js';
import { buildCdrtokenValue } from '../utils/authTokens.js';

const emptyWallet = () => ({
  balance: 0,
  change24h: 0,
  changePercent: 0,
  dailyPnL: 0,
  btcEquivalent: 0,
  assets: [],
  locked: 0,
  Available: 0,
  total: 0,
});

export const getEmptyWalletData = () => ({
  spot: emptyWallet(),
  crypto: emptyWallet(),
  forex: emptyWallet(),
  indian: emptyWallet(),
  funding: emptyWallet(),
});

const WALLET_NAME_TO_TAB = {
  'Overview Wallet': 'overview',
  'Main Wallet': 'spot',
  'Crypto Wallet': 'crypto',
  'Forex Wallet': 'forex',
  'Indian Wallet': 'indian',
};

export const ASSET_COLORS = {
  BTC: '#0A62A5',
  ETH: '#22C55E',
  USDT: '#38BDF8',
  USDC: '#2775CA',
  BNB: '#00AAE1',
  Others: '#06B6D4',
};

/**
 * Normalize /wallet/balance API response into walletData keyed by type.
 */
export function normalizeWalletFromApi(raw) {
  const data = raw?.data ?? raw;
  const balances = data?.balances ?? (Array.isArray(data) ? data : []);
  if (!Array.isArray(balances) || !balances.length) return null;

  const out = getEmptyWalletData();
  const btcPrice = 42850;

  balances.forEach((w) => {
    const name = (w.wallet_name || '').trim();
    const key = WALLET_NAME_TO_TAB[name];
    if (!key) return;
    const balance = parseFloat(w.balance ?? w.total ?? 0);
    const locked = parseFloat(w.locked ?? 0);
    const total = parseFloat(w.total ?? balance) || 1;
    const available = parseFloat(w.available ?? 0);
    const color =
      ASSET_COLORS[key === 'spot' ? 'BTC' : key === 'crypto' ? 'ETH' : key === 'forex' ? 'USDT' : 'Others'] ??
      ASSET_COLORS.Others;
    let assets;
    if (locked > 0) {
      const free = balance - locked;
      const pctFree = Math.round((free / total) * 100);
      const pctLocked = 100 - pctFree;
      assets = [
        {
          symbol: 'AVAIL',
          name: 'Available',
          amount: free,
          usdValue: free,
          percentage: pctFree,
          color: ASSET_COLORS.ETH,
          border: ASSET_COLORS.ETH,
        },
        {
          symbol: 'LOCKED',
          name: 'Locked',
          amount: locked,
          usdValue: locked,
          percentage: pctLocked,
          color: ASSET_COLORS.Others,
          border: ASSET_COLORS.Others,
        },
      ];
    } else {
      assets = [
        { symbol: 'USD', name: 'Balance', amount: balance, usdValue: balance, percentage: 100, color, border: color },
      ];
    }
    out[key] = {
      balance,
      change24h: 0,
      changePercent: 0,
      dailyPnL: 0,
      btcEquivalent: balance / btcPrice,
      assets,
      walletid: w.walletid,
      locked,
      total,
      available
    };
  });

  return out;
}

export const MARKET_TYPE_TO_WALLET_KEY = {
  crypto: 'crypto',
  forex: 'forex',
  india: 'indian',
  indian: 'indian',
  indices: 'crypto',
  metals: 'forex',
  commodities: 'forex',
  spot: 'spot',
};

export const MARKET_TYPE_TO_UNIT = {
  crypto: 'USDT',
  forex: 'USDT',
  india: 'USDT',
  indian: 'USDT',
  indices: 'USDT',
  metals: 'USDT',
  commodities: 'USDT',
  spot: 'USDT',
};

export function getWalletKeyForMarketType(marketType) {
  const key = String(marketType || 'crypto').toLowerCase().trim();
  return MARKET_TYPE_TO_WALLET_KEY[key] ?? 'crypto';
}

export function getUnitForMarketType(marketType) {
  const key = String(marketType || 'crypto').toLowerCase().trim();
  return MARKET_TYPE_TO_UNIT[key] ?? 'USDT';
}

export const WALLET_TYPE_LABELS = {
  overview: 'Overview Wallet',
  spot: 'Spot Wallet',
  crypto: 'Crypto Wallet',
  forex: 'Forex Wallet',
  indian: 'Indian Market',
  funding: 'Funding',
};

export const TRANSFER_WALLET_KEYS = ['spot', 'crypto', 'forex', 'indian'];

export const TRANSFER_COINS = [{ symbol: 'USDT', name: 'TetherUS' }];

/** Base URL for m5dex balance GET APIs (override via VITE_TRADING_API_BASE). */
export const getTradingApiBase = () =>
  String(import.meta.env.VITE_TRADING_API_BASE || '').replace(
    /\/+$/,
    ''
  );

/**
 * Headers for globaltradeapi cryptobalance / forexbalance — aligned with main `api` client:
 * - Authorization: Bearer <access_token>
 * - cdrtoken: device + refresh + device_id (when present)
 * - X-Requested-With, Accept
 * - X-CSRF-Token when VITE_ENABLE_CSRF is true (if token exists in sessionStorage)
 */
export function buildTradingBalanceRequestHeaders() {
  const headers = {
    Accept: 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  };

  const token = tokenStorage.getToken();
  const trimmed = token != null ? String(token).trim() : '';
  if (trimmed) {
    headers.Authorization = `Bearer ${trimmed}`;
    // Some trading gateways read a plain `token` header in addition to Bearer
    headers.token = trimmed;
  }

  const cdrtoken = buildCdrtokenValue();
  if (cdrtoken) {
    headers.cdrtoken = cdrtoken;
  }

  if (import.meta.env.VITE_ENABLE_CSRF === 'true' && typeof sessionStorage !== 'undefined') {
    const csrf = sessionStorage.getItem('csrf_token');
    if (csrf) {
      headers['X-CSRF-Token'] = csrf;
    }
  }

  return headers;
}

/**
 * Extract array payload from cryptobalance / forexbalance style responses.
 */
export function extractTradingBalanceArray(raw) {
  if (raw == null) return [];
  const d = raw?.data ?? raw;
  if (Array.isArray(d)) return d;
  if (Array.isArray(d?.balances)) return d.balances;
  if (Array.isArray(d?.assets)) return d.assets;
  if (Array.isArray(d?.list)) return d.list;
  if (Array.isArray(d?.rows)) return d.rows;
  if (Array.isArray(d?.items)) return d.items;
  if (Array.isArray(d?.data)) return d.data;
  if (Array.isArray(d?.result)) return d.result;
  if (Array.isArray(d?.positions)) return d.positions;
  if (d && typeof d === 'object' && !Array.isArray(d)) {
    const keys = Object.keys(d);
    const numericMap =
      keys.length > 0 &&
      keys.every((k) => {
        const v = d[k];
        return typeof v === 'number' || typeof v === 'string';
      });
    if (numericMap) {
      return keys.map((k) => ({ currency: k, symbol: k, balance: d[k] }));
    }
  }
  return [];
}

/**
 * Normalize one row for Wallet UI (table + cards).
 */
export function normalizeTradingBalanceRows(raw) {
  const arr = extractTradingBalanceArray(raw);
  return arr
    .map((item, index) => {
      if (item == null || (typeof item !== 'object' && typeof item !== 'string' && typeof item !== 'number')) {
        return null;
      }
      if (typeof item === 'number' || typeof item === 'string') {
        const n = parseFloat(item);
        return {
          id: `row-${index}`,
          symbol: '—',
          name: 'Balance',
          balance: Number.isFinite(n) ? n : 0,
          available: Number.isFinite(n) ? n : 0,
          locked: 0,
          usdValue: Number.isFinite(n) ? n : 0,
        };
      }
      const symbol = String(
        item.tradeprocedure ??
        item.tradeProcedure ??
        item.symbol ??
        item.asset ??
        item.currency ??
        item.coin ??
        item.pair ??
        item.name ??
        item.ticker ??
        ''
      ).trim();
      const balance = parseFloat(item.balance ?? item.total ?? item.amount ?? item.equity ?? item.qty ?? 0);
      const locked = parseFloat(
        item.lockebalance ??
        item.lockeBalance ??
        item.lockedbalance ??
        item.lockedBalance ??
        item.locked ??
        item.freeze ??
        item.frozen ??
        item.in_trade ??
        item.used ??
        item.margin ??
        0
      );
      const available = parseFloat(
        item.available ??
        item.free ??
        item.available_balance ??
        item.availableBalance ??
        (Number.isFinite(balance) && Number.isFinite(locked) ? balance - locked : balance)
      );
      const usdValue = parseFloat(
        item.usdValue ?? item.usd_value ?? item.usdt ?? item.value_usd ?? item.valueUsd ?? balance
      );
      const balancetype = String(item.balancetype ?? item.balanceType ?? item.side ?? '').trim();
      const nameFromApi = String(item.name ?? item.fullName ?? item.fullname ?? '').trim();
      const name =
        nameFromApi ||
        (balancetype && symbol ? `${balancetype} · ${symbol}` : balancetype || symbol || 'Asset');
      const id = String(
        item.id ?? item.wallet_id ?? item.walletId ?? `${symbol || 'row'}-${balancetype || ''}-${index}`
      );
      return {
        id,
        symbol: symbol || '—',
        name: name || symbol || 'Asset',
        balance: Number.isFinite(balance) ? balance : 0,
        available: Number.isFinite(available) ? available : 0,
        locked: Number.isFinite(locked) ? locked : 0,
        usdValue: Number.isFinite(usdValue) ? usdValue : (Number.isFinite(balance) ? balance : 0),
      };
    })
    .filter(Boolean);
}

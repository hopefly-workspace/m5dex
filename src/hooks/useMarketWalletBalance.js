/**
 * Fetches /wallet/balance and returns available balance + display unit for the given market type.
 * Used by TradingPanel to show Avbl amount and size unit by market (crypto → USDT, forex → USD, etc.).
 */

import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { useAuth } from './useAuth';
import { normalizeWalletFromApi, getEmptyWalletData, getWalletKeyForMarketType, getUnitForMarketType } from '../services/walletApi';

const CACHE_MS = 30 * 1000;

export function useMarketWalletBalance(marketType) {
  const { isAuthenticated } = useAuth();
  const [walletData, setWalletData] = useState(getEmptyWalletData);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastFetched, setLastFetched] = useState(null);

  const fetchBalance = useCallback(async (forceRefresh = false) => {
    if (!isAuthenticated) {
      setWalletData(getEmptyWalletData());
      setError(null);
      setIsLoading(false);
      return;
    }

    const now = Date.now();
    if (!forceRefresh && lastFetched && now - lastFetched < CACHE_MS && Object.keys(walletData).length > 0) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await api.get('/wallet/balance');
      const normalized = normalizeWalletFromApi(response);
      if (normalized) {
        setWalletData(normalized);
        setLastFetched(now);
      }
    } catch (err) {
      const msg = err?.message || err?.data?.message || 'Failed to fetch wallet balance';
      setError(msg);
      setWalletData(getEmptyWalletData());
      if (err?.status !== 401) console.error('useMarketWalletBalance:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, lastFetched]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchBalance();
    } else {
      setWalletData(getEmptyWalletData());
      setError(null);
    }
  }, [isAuthenticated, fetchBalance]);

  const walletKey = getWalletKeyForMarketType(marketType);
  const unit = getUnitForMarketType(marketType);
  const wallet = walletData[walletKey];
  const balance = wallet != null ? Number(wallet.balance ?? 0) : 0;

  return {
    balance,
    unit,
    isLoading,
    error,
    refreshBalance: () => fetchBalance(true),
  };
}

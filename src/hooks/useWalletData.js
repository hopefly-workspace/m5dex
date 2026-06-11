/**
 * Fetches /wallet/balance and returns full walletData (all wallet types).
 * Used by TradingPanel for Avbl + TransferModal and anywhere full wallet list is needed.
 */

import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { useAuth } from './useAuth';
import { normalizeWalletFromApi, getEmptyWalletData } from '../services/walletApi';

const CACHE_MS = 30 * 1000;

export function useWalletData() {
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
      if (err?.status !== 401) console.error('useWalletData:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, lastFetched]);


  // Listen for a custom event named 'refresh-wallet'
  useEffect(() => {
    const handleRefresh = () => fetchBalance(true);
    window.addEventListener('refresh-wallet', handleRefresh);

    return () => window.removeEventListener('refresh-wallet', handleRefresh);
  }, [fetchBalance]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchBalance();
    } else {
      setWalletData(getEmptyWalletData());
      setError(null);
    }
  }, [isAuthenticated, fetchBalance]);

  return {
    walletData,
    isLoading,
    error,
    refreshWallet: () => fetchBalance(true),
  };
}

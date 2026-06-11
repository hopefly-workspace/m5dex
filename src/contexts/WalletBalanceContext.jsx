import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { useAuth } from '../hooks/useAuth';

const WalletBalanceContext = createContext(null);

export const useWalletBalance = () => {
  const context = useContext(WalletBalanceContext);
  if (!context) {
    throw new Error('useWalletBalance must be used within a WalletBalanceProvider');
  }
  return context;
};

export const WalletBalanceProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [balances, setBalances] = useState([]);
  const [totalUsdValue, setTotalUsdValue] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastFetched, setLastFetched] = useState(null);

  const fetchBalance = useCallback(async (forceRefresh = false) => {
    if (!isAuthenticated) {
      setBalances([]);
      setTotalUsdValue(0);
      setError(null);
      setIsLoading(false);
      return;
    }

    const CACHE_DURATION = 30 * 1000;
    const now = Date.now();
    if (!forceRefresh && lastFetched && (now - lastFetched) < CACHE_DURATION && balances.length > 0) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await api.get('/wallet/balance');

      const balanceData = response?.data || response;

      if (balanceData && Array.isArray(balanceData.balances)) {
        setBalances(balanceData.balances);
        setTotalUsdValue(parseFloat(balanceData.total_usd_value || 0));
        setLastFetched(now);
        setError(null);
      } else if (Array.isArray(balanceData)) {
        setBalances(balanceData);
        const total = balanceData.reduce((sum, balance) => {
          return sum + parseFloat(balance.usd_value || 0);
        }, 0);
        setTotalUsdValue(total);
        setLastFetched(now);
        setError(null);
      } else {
        throw new Error('Invalid balance data received from server');
      }
    } catch (err) {
      const errorMessage = err?.message || err?.data?.message || 'Failed to fetch wallet balance';
      setError(errorMessage);
      setBalances([]);
      setTotalUsdValue(0);

      if (err?.status !== 401) {
        console.error('Error fetching wallet balance:', err);
      }
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, lastFetched, balances.length]);

  const refreshBalance = useCallback(() => {
    return fetchBalance(true);
  }, [fetchBalance]);

  const getBalanceByAsset = useCallback((asset) => {
    return balances.find(balance => balance.asset === asset) || null;
  }, [balances]);

  const getTotalBalance = useCallback(() => {
    return balances.reduce((sum, balance) => {
      return sum + parseFloat(balance.total || 0);
    }, 0);
  }, [balances]);

  const getFreeBalance = useCallback(() => {
    return balances.reduce((sum, balance) => {
      return sum + parseFloat(balance.free || 0);
    }, 0);
  }, [balances]);

  const getLockedBalance = useCallback(() => {
    return balances.reduce((sum, balance) => {
      return sum + parseFloat(balance.locked || 0);
    }, 0);
  }, [balances]);

  const clearBalance = useCallback(() => {
    setBalances([]);
    setTotalUsdValue(0);
    setError(null);
    setLastFetched(null);
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchBalance();
    } else {
      clearBalance();
    }
  }, [isAuthenticated, fetchBalance, clearBalance]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const interval = setInterval(() => {
      fetchBalance(true);
    }, 60 * 1000);

    return () => clearInterval(interval);
  }, [isAuthenticated, fetchBalance]);

  const value = {
    balances,
    totalUsdValue,
    isLoading,
    error,
    isBalanceLoaded: balances.length > 0 && !isLoading,
    fetchBalance,
    refreshBalance,
    getBalanceByAsset,
    getTotalBalance,
    getFreeBalance,
    getLockedBalance,
    clearBalance,
    lastFetched,
  };

  return (
    <WalletBalanceContext.Provider value={value}>
      {children}
    </WalletBalanceContext.Provider>
  );
};

export default WalletBalanceContext;

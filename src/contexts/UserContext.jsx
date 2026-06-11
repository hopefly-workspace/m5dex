import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { useAuth } from '../hooks/useAuth';

const UserContext = createContext(null);

/**
 * INR per 1 USDT from GET /users/profile — API may use `usdtvalue` or nest under `data` / `user`.
 * @returns {number|null} positive rate or null
 */
function pickUsdtInrRate(obj) {
  if (!obj || typeof obj !== 'object') return null;
  const v =
    obj.usdtvalue ??
    obj.usdtValue ??
    obj.USDT_Value ??
    obj.usdt_in_rate ??
    obj.data?.usdtvalue ??
    obj.user?.usdtvalue;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Raw crypto leverage from GET /users/profile (field name may vary). */
function pickCryptoLeverageRaw(obj) {
  if (!obj || typeof obj !== 'object') return null;
  const v =
    obj.cryptoleverage ??
    obj.cryptoLeverage ??
    obj.crypto_leverage ??
    obj.data?.cryptoleverage ??
    obj.user?.cryptoleverage;
  const n = Number(v);
  return Number.isFinite(n) && n >= 1 ? n : null;
}

/** Clamp for trading math / API (align with forex panel max 150). */
function resolveCryptoLeverage(raw) {
  if (raw == null || !Number.isFinite(raw) || raw < 1) return 1;
  return Math.min(150, Math.max(1, Math.round(raw)));
}

/**
 * Flatten common profile envelopes so `id`, `email`, `usdtvalue` sit on one object for context.
 */
function normalizeProfileResponse(response) {
  let node = response?.data ?? response?.user ?? response;
  if (!node || typeof node !== 'object') return null;
  if (node.data && typeof node.data === 'object' && (node.data.id || node.data.email)) {
    node = { ...node, ...node.data };
  }
  if (node.user && typeof node.user === 'object' && (node.user.id || node.user.email)) {
    node = { ...node, ...node.user };
  }
  const rate = pickUsdtInrRate(node);
  if (rate != null) {
    node = { ...node, usdtvalue: rate };
  }
  return node;
}

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};

export const UserProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastFetched, setLastFetched] = useState(null);

  const fetchUserProfile = useCallback(async (forceRefresh = false) => {
    if (!isAuthenticated) {
      setUser(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    const CACHE_DURATION = 5 * 60 * 1000;
    const now = Date.now();
    if (!forceRefresh && lastFetched && (now - lastFetched) < CACHE_DURATION && user) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Token is passed automatically: api service adds "Authorization: Bearer <token>"
      // from tokenStorage.getToken() to every request via addSecurityHeaders (api.js).
      const response = await api.get('/users/profile');

      const userData = normalizeProfileResponse(response);

      if (userData && (userData.id || userData.email)) {
        setUser(userData);
        setLastFetched(now);
        setError(null);
      } else {
        throw new Error('Invalid user data received from server');
      }
    } catch (err) {
      const errorMessage = err?.message || err?.data?.message || 'Failed to fetch user profile';
      setError(errorMessage);
      setUser(null);

      if (err?.status !== 401) {
        console.error('Error fetching user profile:', err);
      }
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, lastFetched, user]);

  const updateUser = useCallback((updatedData) => {
    if (user) {
      setUser(prev => ({
        ...prev,
        ...updatedData,
      }));
    }
  }, [user]);

  const clearUser = useCallback(() => {
    setUser(null);
    setError(null);
    setLastFetched(null);
  }, []);

  const refreshProfile = useCallback(() => {
    return fetchUserProfile(true);
  }, [fetchUserProfile]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchUserProfile();
    } else {
      clearUser();
    }
  }, [isAuthenticated, fetchUserProfile, clearUser]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const interval = setInterval(() => {
      fetchUserProfile(true);
    }, 10 * 60 * 1000);

    return () => clearInterval(interval);
  }, [isAuthenticated, fetchUserProfile]);

  const value = {
    user,
    isLoading,
    error,
    isProfileLoaded: !!user && !isLoading,
    fetchUserProfile,
    refreshProfile,
    updateUser,
    clearUser,
    userId: user?.id || null,
    userEmail: user?.email || null,
    userName: user?.full_name || user?.name || null,
    isEmailVerified: user?.email_verified || false,
    isPhoneVerified: user?.phone_verified || false,
    is2FAEnabled: user?.['2fa_enabled'] || false,
    kycStatus: user?.kyc_status || null,
    avatarUrl: user?.avatar_url || null,
    /** INR per 1 USDT from profile API (`usdtvalue`); null if unset or invalid — consumers fall back to 85. */
    usdtInrRate: pickUsdtInrRate(user),
    /** Crypto futures leverage from profile (`cryptoleverage`); 1 if missing — clamped 1–150. */
    cryptoLeverage: resolveCryptoLeverage(pickCryptoLeverageRaw(user)),
    cryptoLeverageIsFromProfile: pickCryptoLeverageRaw(user) != null,
  };

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
};

export default UserContext;

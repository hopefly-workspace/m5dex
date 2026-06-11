import { useState, useEffect, useRef } from 'react';
import { tokenStorage, clearSecureStorage } from '../utils/storage';
import { api, tryRestoreSession } from '../services/api';

export const useAuth = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const hasTriedRestoreSinceTokenMissing = useRef(false);

  useEffect(() => {
    const runCheck = () => {
      const token = tokenStorage.getToken();
      const hasToken = token && typeof token === 'string' && token.trim() !== '';
      const refreshToken = tokenStorage.getRefreshToken();

      if (hasToken) {
        hasTriedRestoreSinceTokenMissing.current = false;
        setIsAuthenticated(true);
        setIsLoading(false);
        return;
      }

      if (!refreshToken) {
        hasTriedRestoreSinceTokenMissing.current = true;
        setIsAuthenticated(false);
        setIsLoading(false);
        return;
      }

      if (hasTriedRestoreSinceTokenMissing.current) {
        return;
      }

      hasTriedRestoreSinceTokenMissing.current = true;
      setIsLoading(true);
      tryRestoreSession()
        .then(({ restored }) => {
          setIsAuthenticated(restored);
        })
        .finally(() => {
          setIsLoading(false);
        });
    };

    runCheck();

    const handleStorageChange = (e) => {
      const tokenKey = import.meta.env.VITE_TOKEN_STORAGE_KEY || 'ark_auth_token';
      const refreshKey = import.meta.env.VITE_REFRESH_TOKEN_KEY || 'ark_refresh_token';

      if (e.key === tokenKey || e.key === refreshKey || e.key === null) {
        hasTriedRestoreSinceTokenMissing.current = false;
        runCheck();
      }
    };

    window.addEventListener('storage', handleStorageChange);

    const checkInterval = setInterval(() => {
      const token = tokenStorage.getToken();
      const hasToken = token && typeof token === 'string' && token.trim() !== '';
      if (hasToken) {
        hasTriedRestoreSinceTokenMissing.current = false;
        setIsAuthenticated(true);
        return;
      }
      const refreshToken = tokenStorage.getRefreshToken();
      if (!refreshToken) {
        setIsAuthenticated(false);
        return;
      }
      if (!hasTriedRestoreSinceTokenMissing.current) {
        runCheck();
      }
    }, 1000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(checkInterval);
    };
  }, []);

  const login = (accessToken, refreshToken, device_token) => {
    if (!accessToken || typeof accessToken !== 'string' || accessToken.trim() === '') {
      return false;
    }

    if (accessToken) {
      tokenStorage.setToken(accessToken);
    }
    if (refreshToken) {
      tokenStorage.setRefreshToken(refreshToken);
    }
    if (device_token) {
      tokenStorage.setDeviceToken(device_token);
    }
    setIsAuthenticated(true);
    setIsLoading(false);
    return true;
  };

  const clearCookies = () => {
    try {
      const cookies = document.cookie.split(';');
      for (let i = 0; i < cookies.length; i++) {
        const cookie = cookies[i];
        const eqPos = cookie.indexOf('=');
        const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=${window.location.hostname}`;
        if (window.location.hostname.startsWith('www.')) {
          const domain = window.location.hostname.replace('www.', '');
          document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=${domain}`;
        }
      }
    } catch (error) {
      console.error('Error clearing cookies:', error);
    }
  };

  const clearAllStorage = () => {
    try {
      const themePreference = localStorage.getItem('theme');
      const deviceId = localStorage.getItem('device_id');
      const rememberMe = localStorage.getItem('remember_me');
      const biometricEnabled = localStorage.getItem('biometric_enabled');
      const biometricType = localStorage.getItem('biometric_type');

      localStorage.clear();

      if (themePreference) {
        localStorage.setItem('theme', themePreference);
      }
      if (deviceId) {
        localStorage.setItem('device_id', deviceId);
      }
      if (rememberMe) {
        localStorage.setItem('remember_me', rememberMe);
      }
      if (biometricEnabled) {
        localStorage.setItem('biometric_enabled', biometricEnabled);
      }
      if (biometricType) {
        localStorage.setItem('biometric_type', biometricType);
      }

      sessionStorage.clear();

      clearSecureStorage();

      clearCookies();
    } catch (error) {
      console.error('Error clearing storage:', error);
    }
  };

  const logout = async () => {
    try {
      try {
        const data = {
          logout_all_devices: false,
        };
        await api.post('/auth/logout', data);
      } catch (error) {
        console.warn('Logout API call failed, continuing with local logout:', error);
      }
    } catch (error) {
      console.warn('Logout API error:', error);
    } finally {
      clearAllStorage();
      setIsAuthenticated(false);
      setIsLoading(false);
    }
  };

  return {
    isAuthenticated,
    isLoading,
    login,
    logout,
  };
};


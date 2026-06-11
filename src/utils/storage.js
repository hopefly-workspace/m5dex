const TOKEN_KEY = import.meta.env.VITE_TOKEN_STORAGE_KEY || 'ark_auth_token';
const REFRESH_TOKEN_KEY = import.meta.env.VITE_REFRESH_TOKEN_KEY || 'ark_refresh_token';
const DEVICE_TOKEN_KEY = import.meta.env.VITE_DEVICE_TOKEN_KEY || 'ark_device_token';

class SecureStorage {
  constructor() {
    this.storage = sessionStorage;
  }


  setItem(key, value) {
    try {
      const encoded = btoa(JSON.stringify(value));
      this.storage.setItem(key, encoded);
      return true;
    } catch (error) {
      console.error('Storage setItem error:', error);
      return false;
    }
  }

  getItem(key) {
    try {
      const item = this.storage.getItem(key);
      if (!item) return null;
      return JSON.parse(atob(item));
    } catch (error) {
      console.error('Storage getItem error:', error);
      return null;
    }
  }

  removeItem(key) {
    try {
      this.storage.removeItem(key);
      return true;
    } catch (error) {
      console.error('Storage removeItem error:', error);
      return false;
    }
  }

  clear() {
    try {
      this.storage.clear();
      return true;
    } catch (error) {
      console.error('Storage clear error:', error);
      return false;
    }
  }
}

const secureStorage = new SecureStorage();

export const tokenStorage = {
  setToken(token) {
    if (!token) return false;
    return secureStorage.setItem(TOKEN_KEY, { token, timestamp: Date.now() });
  },

  getToken() {
    const data = secureStorage.getItem(TOKEN_KEY);
    return data?.token || null;
  },

  removeToken() {
    return secureStorage.removeItem(TOKEN_KEY);
  },

  hasToken() {
    return !!this.getToken();
  },

  setRefreshToken(token) {
    if (!token) return false;
    return secureStorage.setItem(REFRESH_TOKEN_KEY, { token, timestamp: Date.now() });
  },

  getRefreshToken() {
    const data = secureStorage.getItem(REFRESH_TOKEN_KEY);
    return data?.token || null;
  },

  removeRefreshToken() {
    return secureStorage.removeItem(REFRESH_TOKEN_KEY);
  },

  setDeviceToken(token) {
    if (!token) return false;
    return secureStorage.setItem(DEVICE_TOKEN_KEY, { token, timestamp: Date.now() });
  },

  getDeviceToken() {
    const data = secureStorage.getItem(DEVICE_TOKEN_KEY);
    return data?.token || null;
  },

  removeDeviceToken() {
    return secureStorage.removeItem(DEVICE_TOKEN_KEY);
  },

  clearAll() {
    this.removeToken();
    this.removeRefreshToken();
    this.removeDeviceToken();
    return true;
  },
};

export const secureDataStorage = {
  set(key, value) {
    return secureStorage.setItem(key, value);
  },

  get(key) {
    return secureStorage.getItem(key);
  },

  remove(key) {
    return secureStorage.removeItem(key);
  },

  clear() {
    return secureStorage.clear();
  },
};

export const clearSecureStorage = () => {
  tokenStorage.clearAll();
  secureStorage.clear();
};


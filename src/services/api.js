import { tokenStorage } from '../utils/storage.js';
import { buildCdrtokenValue } from '../utils/authTokens.js';
import { generateCSRFToken, validateCSRFToken } from '../utils/security.js';

// Same-origin /api → Vite proxy (dev) / Netlify|Vercel rewrite (prod) forwards to backend. CORS avoid ho jata hai.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
const API_TIMEOUT = parseInt(import.meta.env.VITE_API_TIMEOUT || '30000', 10);
const ENABLE_CSRF = import.meta.env.VITE_ENABLE_CSRF === 'true';
const REFRESH_URL = '/auth/refresh';
const SESSION_EXPIRED_CODE = 101;

let csrfToken = null;
let refreshPromise = null;

const getCSRFToken = () => {
  if (!csrfToken) {
    csrfToken = generateCSRFToken();
    sessionStorage.setItem('csrf_token', csrfToken);
  }
  return csrfToken;
};

const loadCSRFToken = () => {
  const stored = sessionStorage.getItem('csrf_token');
  if (stored && validateCSRFToken(stored)) {
    csrfToken = stored;
  } else {
    csrfToken = getCSRFToken();
  }
};

if (ENABLE_CSRF) {
  loadCSRFToken();
}

const addSecurityHeaders = (config) => {
  const isFormData = config.body instanceof FormData;
  const headers = {
    'Accept': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  };
  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }

  const token = tokenStorage.getToken();
  const cdrtoken = buildCdrtokenValue();

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (cdrtoken) {
    headers['cdrtoken'] = cdrtoken;
  }

  if (ENABLE_CSRF) {
    headers['X-CSRF-Token'] = getCSRFToken();
  }

  headers['X-Content-Type-Options'] = 'nosniff';
  headers['X-Frame-Options'] = 'DENY';

  return {
    ...config,
    headers: {
      ...headers,
      ...config.headers,
    },
  };
};

const isRefreshRequest = (url) => {
  const path = typeof url === 'string' ? url : '';
  return path.replace(/^\//, '').startsWith('auth/refresh') || path.endsWith('/auth/refresh');
};

/**
 * Call /auth/refresh (raw fetch to avoid recursion). Returns { success, sessionExpired }.
 * If backend returns code === 101 → sessionExpired: true (caller must logout).
 * If 200 and new token in body → save token and success: true.
 */
const doRefresh = async () => {
  const base = API_BASE_URL.replace(/\/$/, '');
  const refreshUrl = `${base}${REFRESH_URL.startsWith('/') ? REFRESH_URL : `/${REFRESH_URL}`}`;
  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  };
  const cdrtoken = buildCdrtokenValue();
  if (cdrtoken) {
    headers['cdrtoken'] = cdrtoken;
  }
  if (ENABLE_CSRF) {
    headers['X-CSRF-Token'] = getCSRFToken();
  }
  try {
    const res = await fetch(refreshUrl, {
      method: 'GET',
      headers,
    });
    const data = await res.json().catch(() => ({}));
    const code = data?.code;
    if (code === SESSION_EXPIRED_CODE || (data?.status === false && code === SESSION_EXPIRED_CODE)) {
      return { success: false, sessionExpired: true };
    }
    if (res.ok) {
      const newToken = data?.access_token ?? data?.token ?? data?.accessToken;
      if (newToken) {
        tokenStorage.setToken(newToken);
        if (data?.refresh_token) tokenStorage.setRefreshToken(data.refresh_token);
        const newDevice = data?.device_token ?? data?.devicetoken ?? data?.deviceToken;
        if (newDevice) tokenStorage.setDeviceToken(newDevice);
        return { success: true, sessionExpired: false };
      }
    }
    return { success: false, sessionExpired: false };
  } catch {
    return { success: false, sessionExpired: false };
  } finally {
    refreshPromise = null;
  }
};

const getRefreshResult = () => {
  if (!refreshPromise) refreshPromise = doRefresh();
  return refreshPromise;
};

/**
 * Try to restore session using refresh token (e.g. when ark_auth_token is missing/expired).
 * Call this before showing Sign in. If backend returns code 101, tokens are cleared and
 * caller should show Sign in; otherwise if success, new token is set and caller should
 * treat user as logged in.
 * @returns {Promise<{ restored: boolean, sessionExpired?: boolean }>}
 */
export const tryRestoreSession = async () => {
  if (!tokenStorage.getRefreshToken()) {
    return { restored: false };
  }
  const result = await getRefreshResult();
  if (result.sessionExpired) {
    tokenStorage.clearAll();
    return { restored: false, sessionExpired: true };
  }
  return { restored: result.success };
};

const logoutAndRedirect = () => {
  tokenStorage.clearAll();
  const pathname = window.location.pathname || '';
  if (pathname !== '/login' && pathname !== '/signup') {
    window.location.href = '/login';
  }
};

const handleResponse = async (response) => {
  const cspHeader = response.headers.get('Content-Security-Policy');
  if (cspHeader) {
  }

  if (response.status === 401) {
    logoutAndRedirect();
    throw new Error('Unauthorized - Please login again');
  }

  if (response.status === 403) {
    throw new Error('Access forbidden');
  }

  if (response.status === 429) {
    logoutAndRedirect();
    throw new Error('Too many requests - Please try again later');
  }

  if (!response.ok) {
    let errorData;
    try {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        errorData = await response.json();
      } else {
        const text = await response.text();
        errorData = { message: text || `HTTP error! status: ${response.status}` };
      }
    } catch (parseError) {
      errorData = { message: `HTTP error! status: ${response.status}` };
    }

    const errorMessage = errorData?.message || errorData?.msg || errorData?.error || errorData?.data?.message || errorData?.data?.msg || `HTTP error! status: ${response.status}`;
    const error = new Error(errorMessage);
    error.status = response.status;
    error.data = errorData;
    throw error;
  }

  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return await response.json();
  } else {
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch {
      return { data: text };
    }
  }
};

const secureFetch = async (url, options = {}) => {
  const { baseURL, _retried, ...restOptions } = options;
  const base = baseURL !== undefined && baseURL !== '' ? baseURL : API_BASE_URL;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

  try {
    const config = addSecurityHeaders({
      ...restOptions,
      signal: controller.signal,
    });

    const fullUrl = base === '' ? url : `${base.replace(/\/$/, '')}${url.startsWith('/') ? url : `/${url}`}`;
    const response = await fetch(fullUrl, config);
    clearTimeout(timeoutId);

    if (response.status === 401) {
      if (_retried || isRefreshRequest(url)) {
        logoutAndRedirect();
        throw new Error('Session expired. Please login again.');
      }
      if (!tokenStorage.getRefreshToken()) {
        return await handleResponse(response);
      }
      const result = await getRefreshResult();
      if (result.sessionExpired) {
        logoutAndRedirect();
        throw new Error('Session expired. Please login again.');
      }
      if (result.success) {
        return secureFetch(url, { ...options, _retried: true });
      }
      return await handleResponse(response);
    }

    return await handleResponse(response);
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Request timeout - Please try again');
    }
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new Error('Network error - Please check your connection');
    }
    if (error.message) {
      throw error;
    }
    throw new Error(error.toString() || 'An unexpected error occurred');
  }
};

export const api = {
  get(url, options = {}) {
    return secureFetch(url, {
      ...options,
      method: 'GET',
    });
  },

  post(url, data, options = {}) {
    const isFormData = data instanceof FormData;
    return secureFetch(url, {
      ...options,
      method: 'POST',
      body: isFormData ? data : JSON.stringify(data),
      headers: options.headers,
    });
  },

  put(url, data, options = {}) {
    const isFormData = data instanceof FormData;
    return secureFetch(url, {
      ...options,
      method: 'PUT',
      body: isFormData ? data : JSON.stringify(data),
      headers: options.headers,
    });
  },

  patch(url, data, options = {}) {
    return secureFetch(url, {
      ...options,
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  delete(url, options = {}) {
    return secureFetch(url, {
      ...options,
      method: 'DELETE',
    });
  },

  upload(url, file, onProgress, options = {}) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const formData = new FormData();
      formData.append('file', file);

      const token = tokenStorage.getToken();
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }
      const cdrtoken = buildCdrtokenValue();
      if (cdrtoken) {
        xhr.setRequestHeader('cdrtoken', cdrtoken);
      }
      if (ENABLE_CSRF) {
        xhr.setRequestHeader('X-CSRF-Token', getCSRFToken());
      }

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && onProgress) {
          const percentComplete = (e.loaded / e.total) * 100;
          onProgress(percentComplete);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch {
            resolve(xhr.responseText);
          }
        } else {
          reject(new Error(`Upload failed: ${xhr.statusText}`));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('Upload failed'));
      });

      xhr.open('POST', `${API_BASE_URL}${url}`);
      xhr.send(formData);
    });
  },
};

export const apiWithRetry = async (apiCall, maxRetries = 3) => {
  let lastError;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await apiCall();
    } catch (error) {
      lastError = error;
      if (i < maxRetries - 1) {
        await new Promise((resolve) => setTimeout(resolve, Math.pow(2, i) * 1000));
      }
    }
  }
  throw lastError;
};

export { API_BASE_URL };
export default api;


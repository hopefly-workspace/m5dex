import { tokenStorage } from './storage.js';

/**
 * Normalize backend auth payloads (top-level or nested `data`).
 */
export function extractAuthTokensFromResponse(payload) {
  if (payload == null || typeof payload !== 'object') {
    return { accessToken: null, refreshToken: null, deviceToken: null };
  }
  const nested =
    payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)
      ? payload.data
      : null;
  const p = nested || payload;
  const accessToken =
    p.access_token ??
    p.accessToken ??
    p.token ??
    payload.access_token ??
    payload.accessToken ??
    payload.token ??
    null;
  const refreshToken =
    p.refresh_token ??
    p.refreshToken ??
    payload.refresh_token ??
    payload.refreshToken ??
    null;
  const deviceToken =
    p.device_token ??
    p.devicetoken ??
    p.deviceToken ??
    payload.device_token ??
    payload.devicetoken ??
    payload.deviceToken ??
    null;
  return { accessToken, refreshToken, deviceToken };
}

/**
 * Backend expects: deviceToken $ middleToken $ deviceId
 * Middle is refresh when present; otherwise access (JWT) so cdrtoken is still sent
 * when the API only returns access + device.
 */
export function buildCdrtokenValue() {
  const deviceToken = tokenStorage.getDeviceToken();
  const refreshToken = tokenStorage.getRefreshToken();
  const accessToken = tokenStorage.getToken();
  const deviceId = typeof localStorage !== 'undefined' ? localStorage.getItem('device_id') || '' : '';
  if (!deviceToken) return '';
  const middle = refreshToken || accessToken || '';
  if (!middle) return '';
  return `${deviceToken}$${middle}$${deviceId}`;
}

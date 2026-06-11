/**
 * Simple client-side device/browser detection for Device Management UI.
 * For production, prefer backend-provided device list (e.g. /v1/user/devices).
 */

export function getCurrentDeviceLabel() {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const p = typeof navigator !== 'undefined' ? navigator.platform : '';

  let browser = 'Browser';
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) browser = 'Chrome';
  else if (/Firefox\//i.test(ua)) browser = 'Firefox';
  else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) browser = 'Safari';

  let os = 'Unknown';
  if (/Win/i.test(p)) os = 'Windows';
  else if (/Mac/i.test(p)) os = 'Mac';
  else if (/Linux/i.test(p)) os = 'Linux';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';

  return `${browser} on ${os}`;
}

export function getDeviceId() {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem('device_id');
}

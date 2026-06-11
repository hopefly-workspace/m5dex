import { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import { getCurrentDeviceLabel, getDeviceId } from '../../utils/deviceInfo';
import { formatDateOnly, formatTimeOnly } from '../../utils/formatTime';
import '../../styles/components/profile/DeviceManagementView.css';

const DeviceIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
    <line x1="12" y1="18" x2="12.01" y2="18" />
  </svg>
);

/** Normalize string for matching. */
function normalizeForMatch(str) {
  if (!str || typeof str !== 'string') return '';
  return str.toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Normalize OS for matching. */
function normalizeOs(os) {
  const s = normalizeForMatch(os);
  if (s.includes('win')) return 'win';
  if (s.includes('mac') || s.includes('intel')) return 'mac';
  if (s.includes('linux')) return 'linux';
  if (s.includes('android')) return 'android';
  if (s.includes('iphone') || s.includes('ipad') || s.includes('ios')) return 'ios';
  return s;
}

/** Normalize device ID for comparison (trim, string). */
function normalizeDeviceId(val) {
  if (val == null) return '';
  return String(val).trim();
}

/** Check if API device matches current client. Device ID match is primary. */
function isCurrentDevice(raw, currentLabel, currentDeviceId) {
  if (raw.current === true || raw.is_current === true) return true;
  const normalizedCurrent = normalizeDeviceId(currentDeviceId);
  if (normalizedCurrent) {
    const apiIds = [
      raw.device_id ?? raw.deviceId ?? raw.deviceid,
      raw.id,
    ].filter(Boolean);
    for (const rawId of apiIds) {
      if (normalizeDeviceId(rawId) === normalizedCurrent) return true;
    }
  }
  const apiBrowser = normalizeForMatch(raw.browser ?? raw.browser_name ?? '');
  const apiOs = normalizeOs(raw.os ?? raw.platform ?? raw.operating_system ?? '');
  const apiLabel = normalizeForMatch(raw.label ?? '');
  const currentNorm = normalizeForMatch(currentLabel);
  const currParts = currentNorm.split(/\s+on\s+/);
  const currBrowser = currParts[0] || '';
  const currOs = normalizeOs(currParts[1] || '');
  const browserMatch = (apiBrowser && currBrowser && (apiBrowser.includes(currBrowser) || currBrowser.includes(apiBrowser))) ||
    (apiLabel && currBrowser && apiLabel.includes(currBrowser));
  const osMatch = (apiOs && currOs && (apiOs.includes(currOs) || currOs.includes(apiOs))) ||
    (apiLabel && currOs && apiLabel.includes(currOs));
  return browserMatch && (osMatch || !apiOs);
}

/** Normalize API response to device list. */
function normalizeDevicesResponse(res) {
  if (!res) return [];
  const arr = res.devices ?? res.data ?? (Array.isArray(res) ? res : []);
  const list = Array.isArray(arr) ? arr : (arr?.devices ?? []);
  return Array.isArray(list) ? list : [];
}

const formatDate = (val) => formatDateOnly(val) || '—';

/** Format lastActive as relative (e.g. "2 hours ago") or date. */
function formatLastActive(val) {
  if (!val) return '—';
  const d = typeof val === 'number' ? new Date(val) : new Date(val);
  if (Number.isNaN(d.getTime())) return '—';
  const now = Date.now();
  const diff = now - d.getTime();
  const sec = Math.floor(diff / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  if (sec < 60) return 'Just now';
  if (min < 60) return `${min} minute${min > 1 ? 's' : ''} ago`;
  if (hr < 24) return `${hr} hour${hr > 1 ? 's' : ''} ago`;
  if (day < 7) return `${day} day${day > 1 ? 's' : ''} ago`;
  return `${formatDateOnly(d) || '—'} · ${formatTimeOnly(d)}`;
}

/** Map raw device object to display shape. */
function toDisplayDevice(raw, index, currentLabel, currentDeviceId) {
  const apiDeviceId = raw.device_id ?? raw.deviceId ?? raw.deviceid ?? raw.id ?? null;
  const id = apiDeviceId ?? `d-${index}`;
  let browser = raw.browser ?? raw.browser_name ?? '';
  let os = raw.os ?? raw.platform ?? raw.operating_system ?? '';
  if (!browser && !os && raw.user_agent && raw.user_agent.length < 80) browser = raw.user_agent;
  const apiLabel = raw.label ?? (browser && os ? `${browser} on ${os}` : browser || os || getCurrentDeviceLabel());
  const isCurrent = isCurrentDevice(raw, currentLabel, currentDeviceId);
  const name = raw.name ?? raw.device_name ?? raw.deviceName ?? raw.label ?? (isCurrent ? 'This device' : 'Device');
  const displayName = isCurrent ? 'This device' : name;
  const label = apiLabel;
  const ip = raw.ip ?? raw.ip_address ?? raw.ipAddress ?? raw.last_ip ?? '—';
  const lastActiveRaw = raw.last_active ?? raw.lastActive ?? raw.last_login ?? raw.updated_at ?? raw.created_at ?? null;
  const lastActive = formatLastActive(lastActiveRaw);
  const date = lastActiveRaw ? formatDate(lastActiveRaw) : '—';
  const time = lastActiveRaw ? formatTimeOnly(lastActiveRaw) : '';
  return { id, deviceId: apiDeviceId, name: displayName, label, ip, date, time, lastActive, isCurrent };
}

export default function DeviceManagementView({ isOpen, onClose }) {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [removingId, setRemovingId] = useState(null);
  const [removingAll, setRemovingAll] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(null);
  const [confirmRemoveAll, setConfirmRemoveAll] = useState(false);

  const fetchDevices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/users/devices');
      const rawList = normalizeDevicesResponse(res?.data ?? res);
      const currentLabel = getCurrentDeviceLabel();
      const currentDeviceId = getDeviceId();
      const mapped = rawList.map((r, i) => toDisplayDevice(r, i, currentLabel, currentDeviceId));
      setDevices(mapped);
    } catch (e) {
      setError(e?.message || 'Failed to load devices. Please try again.');
      setDevices([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) fetchDevices();
  }, [isOpen, fetchDevices]);

  useEffect(() => {
    if (!isOpen) return;
    setConfirmRemove(null);
    setConfirmRemoveAll(false);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onEscape = (e) => {
      if (e.key === 'Escape') {
        if (confirmRemoveAll) setConfirmRemoveAll(false);
        else if (confirmRemove) setConfirmRemove(null);
        else onClose();
      }
    };
    window.addEventListener('keydown', onEscape);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onEscape);
      document.body.style.overflow = prev;
    };
  }, [isOpen, onClose, confirmRemove, confirmRemoveAll]);

  const handleRemoveDevice = async (id) => {
    const device = devices.find((d) => d.id === id);
    if (!device || device.isCurrent) return;
    const deviceId = device.deviceId ?? device.id;
    if (!deviceId || String(deviceId).startsWith('d-')) {
      setError('Cannot remove: device ID not available.');
      return;
    }
    setRemovingId(id);
    try {
      await api.post('/auth/logoutbyid', { deviceid: deviceId });
      setDevices((prev) => prev.filter((d) => d.id !== id));
      setConfirmRemove(null);
    } catch (e) {
      setError(e?.message || 'Failed to remove device. Please try again.');
    } finally {
      setRemovingId(null);
    }
  };

  const handleRemoveAllOther = async () => {
    setRemovingAll(true);
    setError(null);
    try {
      await api.post('/users/devices/revoke-others');
      setDevices((prev) => prev.filter((d) => d.isCurrent));
      setConfirmRemoveAll(false);
    } catch (e) {
      setError(e?.message || 'Failed to revoke other devices. Please try again.');
    } finally {
      setRemovingAll(false);
    }
  };

  if (!isOpen) return null;

  const currentDevice = devices.find((d) => d.isCurrent);
  const otherDevices = devices.filter((d) => !d.isCurrent);

  return (
    <div
      className="deviceMgmtOverlay"
      onClick={(e) => {
        if (e.target !== e.currentTarget) return;
        if (confirmRemoveAll) setConfirmRemoveAll(false);
        else if (confirmRemove) setConfirmRemove(null);
        else onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="device-mgmt-title"
    >
      <div className="deviceMgmt" onClick={(e) => e.stopPropagation()}>
        <header className="deviceMgmtHeader">
          <h2 id="device-mgmt-title" className="deviceMgmtTitle">Device Management</h2>
          <button type="button" className="deviceMgmtClose" onClick={onClose} aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </header>
        <p className="deviceMgmtDescription">
          Devices that have accessed your account. You can revoke access for any device. This device cannot be removed.
        </p>

        {error && devices.length > 0 && (
          <div className="deviceMgmtError">
            <span>{error}</span>
            <button type="button" className="deviceMgmtErrorDismiss" onClick={() => setError(null)} aria-label="Dismiss">
              ×
            </button>
          </div>
        )}

        <div className="deviceMgmtBody">
          {loading && (
            <div className="deviceMgmtLoading" aria-busy="true">
              <div className="deviceMgmtLoadingSpinner" />
              <p>Loading devices…</p>
            </div>
          )}

          {!loading && error && devices.length === 0 && (
            <div className="deviceMgmtErrorState">
              <p>Could not load devices.</p>
              <button type="button" className="deviceMgmtRetryBtn" onClick={fetchDevices}>
                Try again
              </button>
            </div>
          )}

          {!loading && !error && devices.length === 0 && (
            <div className="deviceMgmtEmpty">
              <DeviceIcon />
              <p>No devices found.</p>
              <span>Devices will appear here when you sign in from different browsers or devices.</span>
            </div>
          )}

          {!loading && devices.length > 0 && (
            <div className="deviceMgmtSections">
              {currentDevice && (
                <section className="deviceMgmtSection">
                  <h3 className="deviceMgmtSectionTitle deviceMgmtSectionTitle--current">Current device</h3>
                  <ul className="deviceMgmtList">
                    <li key={currentDevice.id} className="deviceCard deviceCard--current">
                      <div className="deviceCardIcon">
                        <DeviceIcon />
                      </div>
                      <div className="deviceCardMain">
                        <div className="deviceCardHead">
                          <span className="deviceCardName">{currentDevice.name}</span>
                          <span className="deviceCardBadge">Current device</span>
                        </div>
                        <p className="deviceCardLabel">{currentDevice.label}</p>
                        <div className="deviceCardMeta">
                          <span>Last active: {currentDevice.lastActive}</span>
                          {currentDevice.ip && currentDevice.ip !== '—' && <span>IP: {currentDevice.ip}</span>}
                        </div>
                      </div>
                    </li>
                  </ul>
                </section>
              )}
              {otherDevices.length > 0 && (
                <section className="deviceMgmtSection">
                  <h3 className="deviceMgmtSectionTitle">Other devices</h3>
                  <ul className="deviceMgmtList">
                    {otherDevices.map((d) => (
                      <li key={d.id} className="deviceCard">
                        <div className="deviceCardIcon">
                          <DeviceIcon />
                        </div>
                        <div className="deviceCardMain">
                          <div className="deviceCardHead">
                            <span className="deviceCardName">{d.name}</span>
                          </div>
                          <p className="deviceCardLabel">{d.label}</p>
                          <div className="deviceCardMeta">
                            <span>Last active: {d.lastActive}</span>
                            {d.ip && d.ip !== '—' && <span>IP: {d.ip}</span>}
                          </div>
                        </div>
                        <div className="deviceCardActions">
                          {confirmRemove === d.id ? (
                            <div className="deviceCardConfirm">
                              <span>Remove?</span>
                              <div>
                                <button
                                  type="button"
                                  className="deviceCardConfirmBtn cancel"
                                  onClick={() => setConfirmRemove(null)}
                                  disabled={removingId !== null}
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  className="deviceCardConfirmBtn remove"
                                  onClick={() => handleRemoveDevice(d.deviceId)}
                                  disabled={removingId !== null}
                                >
                                  {removingId === d.id ? 'Removing…' : 'Remove'}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="deviceCardRemove"
                              onClick={() => setConfirmRemove(d.id)}
                              disabled={removingId !== null}
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          )}
        </div>
      </div>

      {confirmRemoveAll && (
        <div
          className="deviceMgmtConfirmOverlay"
          onClick={(e) => e.target === e.currentTarget && setConfirmRemoveAll(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-remove-all-title"
        >
          <div className="deviceMgmtConfirm">
            <h3 id="confirm-remove-all-title" className="deviceMgmtConfirmTitle">
              Remove all other devices?
            </h3>
            <p className="deviceMgmtConfirmText">
              All other signed-in devices will be logged out. You will stay logged in on this device.
            </p>
            <div className="deviceMgmtConfirmActions">
              <button
                type="button"
                className="deviceMgmtConfirmBtn secondary"
                onClick={() => setConfirmRemoveAll(false)}
                disabled={removingAll}
              >
                Cancel
              </button>
              <button
                type="button"
                className="deviceMgmtConfirmBtn danger"
                onClick={handleRemoveAllOther}
                disabled={removingAll}
              >
                {removingAll ? 'Removing…' : 'Remove all others'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

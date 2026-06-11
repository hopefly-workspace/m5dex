/**
 * Shared date/time formatting utilities.
 */

/** MM:SS from seconds (countdown / remaining). */
export function formatMmSsFromSeconds(seconds) {
  if (seconds == null) return '';
  const s = Math.max(0, Number(seconds));
  const mm = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

/** MM:SS from milliseconds. */
export function formatMmSsFromMs(ms) {
  if (ms == null || ms <= 0) return '00:00';
  const t = Math.floor(Number(ms) / 1000);
  const m = String(Math.floor(t / 60)).padStart(2, '0');
  const s = String(t % 60).padStart(2, '0');
  return `${m}:${s}`;
}

/** Alias for countdown timers (seconds → MM:SS). */
export const formatTimer = formatMmSsFromSeconds;

/** HH:MM:SS from seconds. */
export function formatHmsFromSeconds(seconds) {
  const s = Math.max(0, Math.floor(Number(seconds)));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/** Millisecond timestamp → locale date + short time (e.g. "Jan 31, 2025, 3:45 pm"). */
export function msToDate(ms) {
  if (!ms || Number.isNaN(Number(ms))) return null;
  return new Date(ms).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

/** Timestamp → short locale string (e.g. "Jan 31, 2025, 3:45 PM"). */
export function formatTimestamp(timestamp) {
  if (!timestamp) return 'Never';
  const date = new Date(timestamp);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Date-only string (e.g. "Jan 31, 2025"). */
export function formatDateOnly(val) {
  if (!val) return '';
  const d = typeof val === 'number' ? new Date(val) : new Date(val);
  if (Number.isNaN(d.getTime())) return String(val);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Time-only string (e.g. "3:45 PM"). */
export function formatTimeOnly(val) {
  if (!val) return '';
  const d = typeof val === 'number' ? new Date(val) : new Date(val);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

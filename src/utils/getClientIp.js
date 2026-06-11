/**
 * Fetch client's public IP address.
 * Uses ipify (no API key required). Falls back to null on failure.
 * @returns {Promise<string|null>}
 */
export async function getClientIp() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const res = await fetch('https://api.ipify.org?format=json', {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) return null;
    const data = await res.json();
    return typeof data?.ip === 'string' ? data.ip.trim() : null;
  } catch {
    return null;
  }
}
